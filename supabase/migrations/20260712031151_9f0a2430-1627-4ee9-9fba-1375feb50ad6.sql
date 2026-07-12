
REVOKE EXECUTE ON FUNCTION public.write_item_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_item_on_attachment_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
