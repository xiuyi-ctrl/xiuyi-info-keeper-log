
-- items table
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  tags text[] NOT NULL DEFAULT '{}',
  account text,
  password_hint text,
  phone text,
  email text,
  notes text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_items_select" ON public.items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_items_insert" ON public.items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_items_update" ON public.items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_items_delete" ON public.items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX items_user_id_idx ON public.items(user_id);
CREATE INDEX items_deleted_at_idx ON public.items(deleted_at);
CREATE INDEX items_category_idx ON public.items(category);

-- history table
CREATE TABLE public.item_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL,
  snapshot jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.item_history TO authenticated;
GRANT ALL ON public.item_history TO service_role;

ALTER TABLE public.item_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_history_select" ON public.item_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_history_insert" ON public.item_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX item_history_item_id_idx ON public.item_history(item_id, changed_at DESC);

-- attachments table
CREATE TABLE public.item_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.item_attachments TO authenticated;
GRANT ALL ON public.item_attachments TO service_role;

ALTER TABLE public.item_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_attach_select" ON public.item_attachments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own_attach_insert" ON public.item_attachments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_attach_delete" ON public.item_attachments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX item_attachments_item_id_idx ON public.item_attachments(item_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_set_updated_at
BEFORE UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- history trigger: write snapshot on insert & update
CREATE OR REPLACE FUNCTION public.write_item_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  act text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    act := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      act := 'delete';
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      act := 'restore';
    ELSE
      act := 'update';
    END IF;
  END IF;

  INSERT INTO public.item_history (item_id, user_id, action, snapshot)
  VALUES (
    NEW.id,
    NEW.user_id,
    act,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER items_write_history
AFTER INSERT OR UPDATE ON public.items
FOR EACH ROW EXECUTE FUNCTION public.write_item_history();
