CREATE POLICY "cupons_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cupons' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "cupons_select_own_or_admin" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'cupons' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "cupons_delete_own_or_admin" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'cupons' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));