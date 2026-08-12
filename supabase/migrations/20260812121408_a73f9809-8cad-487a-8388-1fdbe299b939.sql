-- 1. Drop overly permissive policies
DROP POLICY IF EXISTS profiles_public_all ON public.profiles;
DROP POLICY IF EXISTS advances_public_all ON public.advances;
DROP POLICY IF EXISTS expenses_public_all ON public.expenses;
DROP POLICY IF EXISTS advance_topups_public_all ON public.advance_topups;
DROP POLICY IF EXISTS cargos_public_all ON public.cargos;
DROP POLICY IF EXISTS cargo_permissions_public_all ON public.cargo_permissions;
DROP POLICY IF EXISTS user_cargos_public_all ON public.user_cargos;
DROP POLICY IF EXISTS cupons_public_all ON storage.objects;

-- 2. Tighten grants (no anon access anywhere)
REVOKE ALL ON public.profiles, public.advances, public.expenses, public.advance_topups,
  public.cargos, public.cargo_permissions, public.user_cargos, public.user_roles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.advances, public.expenses,
  public.advance_topups, public.cargos, public.cargo_permissions, public.user_cargos TO authenticated;
GRANT ALL ON public.profiles, public.advances, public.expenses, public.advance_topups,
  public.cargos, public.cargo_permissions, public.user_cargos, public.user_roles TO service_role;

-- 3. profiles
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_permission(auth.uid(), 'ver_todos') OR public.has_permission(auth.uid(), 'gerenciar_acessos'));
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own_or_admin ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY profiles_delete_admin ON public.profiles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. advances
CREATE POLICY advances_select ON public.advances FOR SELECT TO authenticated
USING (employee_id = auth.uid() OR created_by = auth.uid() OR public.has_permission(auth.uid(), 'ver_todos'));
CREATE POLICY advances_insert ON public.advances FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'criar_adiantamento'));
CREATE POLICY advances_update ON public.advances FOR UPDATE TO authenticated
USING (employee_id = auth.uid() OR public.has_permission(auth.uid(), 'aprovar_prestacao'))
WITH CHECK (employee_id = auth.uid() OR public.has_permission(auth.uid(), 'aprovar_prestacao'));
CREATE POLICY advances_delete_admin ON public.advances FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. expenses (visibility follows the parent advance)
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id));
CREATE POLICY expenses_insert ON public.expenses FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id)
  AND (user_id = auth.uid() OR public.has_permission(auth.uid(), 'lancar_despesa'))
);
CREATE POLICY expenses_update ON public.expenses FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'lancar_despesa'))
WITH CHECK (user_id = auth.uid() OR public.has_permission(auth.uid(), 'lancar_despesa'));
CREATE POLICY expenses_delete ON public.expenses FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'lancar_despesa'));

-- 6. advance_topups
CREATE POLICY topups_select ON public.advance_topups FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id));
CREATE POLICY topups_insert ON public.advance_topups FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'adicionar_verba')
  AND EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id AND a.status = 'aberto')
);
CREATE POLICY topups_update_admin ON public.advance_topups FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY topups_delete ON public.advance_topups FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'adicionar_verba'));

-- 7. cargos / cargo_permissions / user_cargos
CREATE POLICY cargos_select ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY cargos_write ON public.cargos FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'gerenciar_acessos'))
WITH CHECK (public.has_permission(auth.uid(), 'gerenciar_acessos'));

CREATE POLICY cargo_permissions_select ON public.cargo_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY cargo_permissions_write ON public.cargo_permissions FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'gerenciar_acessos'))
WITH CHECK (public.has_permission(auth.uid(), 'gerenciar_acessos'));

CREATE POLICY user_cargos_select ON public.user_cargos FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'gerenciar_acessos'));
CREATE POLICY user_cargos_write ON public.user_cargos FOR ALL TO authenticated
USING (public.has_permission(auth.uid(), 'gerenciar_acessos'))
WITH CHECK (public.has_permission(auth.uid(), 'gerenciar_acessos'));

-- 8. SECURITY DEFINER functions: not callable by anonymous visitors
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;