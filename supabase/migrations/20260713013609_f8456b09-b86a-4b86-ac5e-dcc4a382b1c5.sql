DROP TRIGGER IF EXISTS attachments_touch_item ON public.item_attachments;

GRANT DELETE ON public.item_history TO authenticated;

DROP POLICY IF EXISTS own_history_delete ON public.item_history;
CREATE POLICY own_history_delete ON public.item_history
FOR DELETE TO authenticated
USING (auth.uid() = user_id);