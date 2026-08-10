-- 1) Storage: explicit UPDATE policy for cupons
DROP POLICY IF EXISTS "cupons_update_own_or_admin" ON storage.objects;
CREATE POLICY "cupons_update_own_or_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cupons'
  AND (((storage.foldername(name))[1] = auth.uid()::text) OR public.has_role(auth.uid(), 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id = 'cupons'
  AND (((storage.foldername(name))[1] = auth.uid()::text) OR public.has_role(auth.uid(), 'admin'::public.app_role))
);

-- 2) user_roles: admin-only write policies
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "roles_admin_insert" ON public.user_roles;
CREATE POLICY "roles_admin_insert" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "roles_admin_update" ON public.user_roles;
CREATE POLICY "roles_admin_update" ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "roles_admin_delete" ON public.user_roles;
CREATE POLICY "roles_admin_delete" ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND user_id <> auth.uid());

-- 3) SECURITY DEFINER functions: least privilege on EXECUTE
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_advance_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
