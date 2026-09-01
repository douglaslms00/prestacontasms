DROP POLICY IF EXISTS advances_delete_admin ON public.advances;
CREATE POLICY advances_delete_gestor ON public.advances
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_permission(auth.uid(), 'aprovar_prestacao'::app_permission));