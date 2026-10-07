-- Usuário comum só enxerga adiantamento ativo.
-- Fechado (prestação aprovada) some para o usuário e fica visível só p/ gestor/admin.

-- 1. advances: dono só vê se status <> 'fechado'; gestor/admin vê tudo
DROP POLICY IF EXISTS advances_select ON public.advances;
CREATE POLICY advances_select ON public.advances FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'ver_todos')
  OR public.has_permission(auth.uid(), 'aprovar_prestacao')
  OR public.has_permission(auth.uid(), 'adicionar_verba')
  OR public.has_permission(auth.uid(), 'criar_adiantamento')
  OR (
    (employee_id = auth.uid() OR created_by = auth.uid())
    AND status <> 'fechado'::public.advance_status
  )
);

-- 2. expenses: segue a visibilidade do adiantamento pai
DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'ver_todos')
  OR public.has_permission(auth.uid(), 'aprovar_prestacao')
  OR public.has_permission(auth.uid(), 'adicionar_verba')
  OR public.has_permission(auth.uid(), 'criar_adiantamento')
  OR EXISTS (
    SELECT 1 FROM public.advances a
    WHERE a.id = advance_id
    AND (a.employee_id = auth.uid() OR a.created_by = auth.uid())
    AND a.status <> 'fechado'::public.advance_status
  )
);

-- 3. advance_topups: segue a visibilidade do adiantamento pai
DROP POLICY IF EXISTS topups_select ON public.advance_topups;
CREATE POLICY topups_select ON public.advance_topups FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_permission(auth.uid(), 'ver_todos')
  OR public.has_permission(auth.uid(), 'aprovar_prestacao')
  OR public.has_permission(auth.uid(), 'adicionar_verba')
  OR public.has_permission(auth.uid(), 'criar_adiantamento')
  OR EXISTS (
    SELECT 1 FROM public.advances a
    WHERE a.id = advance_id
    AND (a.employee_id = auth.uid() OR a.created_by = auth.uid())
    AND a.status <> 'fechado'::public.advance_status
  )
);
