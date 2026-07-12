
-- Extend history snapshot to include attachments list, and add trigger so attachment changes create history entries.

CREATE OR REPLACE FUNCTION public.write_item_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  act text;
  atts jsonb;
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'file_name', a.file_name,
    'file_path', a.file_path,
    'mime_type', a.mime_type,
    'size', a.size
  ) ORDER BY a.created_at), '[]'::jsonb)
  INTO atts
  FROM public.item_attachments a
  WHERE a.item_id = NEW.id;

  INSERT INTO public.item_history (item_id, user_id, action, snapshot)
  VALUES (
    NEW.id,
    NEW.user_id,
    act,
    to_jsonb(NEW) || jsonb_build_object('attachments', atts)
  );
  RETURN NEW;
END;
$function$;

-- When attachments change, touch the parent item so history captures the new attachment list.
CREATE OR REPLACE FUNCTION public.touch_item_on_attachment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.item_id;
  ELSE
    target_id := NEW.item_id;
  END IF;
  UPDATE public.items SET updated_at = now() WHERE id = target_id AND deleted_at IS NULL;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS attachments_touch_item ON public.item_attachments;
CREATE TRIGGER attachments_touch_item
AFTER INSERT OR DELETE ON public.item_attachments
FOR EACH ROW EXECUTE FUNCTION public.touch_item_on_attachment_change();
