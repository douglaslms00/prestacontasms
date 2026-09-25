-- Gestores são usuários com a permissão de aprovar prestações.
-- A regra no banco protege as operações mesmo que alguém tente chamar a API diretamente.
DROP POLICY IF EXISTS advances_delete_admin ON public.advances;

CREATE POLICY advances_delete_manager ON public.advances
FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), 'aprovar_prestacao'));
