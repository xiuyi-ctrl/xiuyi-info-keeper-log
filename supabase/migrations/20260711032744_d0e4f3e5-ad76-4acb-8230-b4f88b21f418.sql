
REVOKE EXECUTE ON FUNCTION public.write_item_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage policies for vault-attachments bucket
-- Files are stored under {user_id}/{item_id}/{filename}
CREATE POLICY "vault_own_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "vault_own_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "vault_own_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'vault-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
