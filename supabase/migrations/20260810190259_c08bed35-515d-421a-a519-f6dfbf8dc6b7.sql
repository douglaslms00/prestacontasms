-- 1. Permissions enum
CREATE TYPE public.app_permission AS ENUM (
  'criar_adiantamento',
  'adicionar_verba',
  'aprovar_prestacao',
  'ver_todos',
  'lancar_despesa',
  'gerenciar_acessos'
);

-- 2. Cargos
CREATE TABLE public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargos TO authenticated;
GRANT ALL ON public.cargos TO service_role;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cargo_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cargo_id, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargo_permissions TO authenticated;
GRANT ALL ON public.cargo_permissions TO service_role;
ALTER TABLE public.cargo_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cargo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cargos TO authenticated;
GRANT ALL ON public.user_cargos TO service_role;
ALTER TABLE public.user_cargos ENABLE ROW LEVEL SECURITY;

-- 3. has_permission (security definer, avoids recursion)
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission public.app_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'::public.app_role
  ) OR EXISTS (
    SELECT 1
    FROM public.user_cargos uc
    JOIN public.cargo_permissions cp ON cp.cargo_id = uc.cargo_id
    WHERE uc.user_id = _user_id AND cp.permission = _permission
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO authenticated;

-- 4. Policies for cargos tables
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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER cargos_updated_at BEFORE UPDATE ON public.cargos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Verbas adicionais
CREATE TABLE public.advance_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  note text,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_topups TO authenticated;
GRANT ALL ON public.advance_topups TO service_role;
ALTER TABLE public.advance_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY topups_select ON public.advance_topups FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id AND a.employee_id = auth.uid())
  OR public.has_permission(auth.uid(), 'ver_todos')
  OR public.has_permission(auth.uid(), 'adicionar_verba')
);

CREATE POLICY topups_insert ON public.advance_topups FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), 'adicionar_verba')
  AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id AND a.status = 'aberto'::public.advance_status)
);

CREATE POLICY topups_delete ON public.advance_topups FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), 'adicionar_verba')
  AND EXISTS (SELECT 1 FROM public.advances a WHERE a.id = advance_id AND a.status = 'aberto'::public.advance_status)
);

-- 6. Existing policies now consider permissions
DROP POLICY IF EXISTS advances_select ON public.advances;
CREATE POLICY advances_select ON public.advances FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR public.has_permission(auth.uid(), 'ver_todos')
  OR public.has_permission(auth.uid(), 'aprovar_prestacao')
  OR public.has_permission(auth.uid(), 'adicionar_verba')
);

CREATE POLICY advances_insert_permission ON public.advances FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), 'criar_adiantamento'));

CREATE POLICY advances_review_permission ON public.advances FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), 'aprovar_prestacao'))
WITH CHECK (public.has_permission(auth.uid(), 'aprovar_prestacao'));

DROP POLICY IF EXISTS expenses_select ON public.expenses;
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_permission(auth.uid(), 'ver_todos')
  OR public.has_permission(auth.uid(), 'aprovar_prestacao')
);

-- 7. Trigger allows reviewers with permission
CREATE OR REPLACE FUNCTION public.enforce_advance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') OR public.has_permission(auth.uid(), 'aprovar_prestacao') THEN
    RETURN NEW;
  END IF;

  IF NEW.employee_id <> auth.uid() OR OLD.employee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF OLD.status <> 'aberto' OR NEW.status <> 'em_analise' THEN
    RAISE EXCEPTION 'Somente o envio da prestação é permitido';
  END IF;

  NEW.title := OLD.title;
  NEW.description := OLD.description;
  NEW.amount := OLD.amount;
  NEW.issued_at := OLD.issued_at;
  NEW.created_by := OLD.created_by;
  NEW.employee_id := OLD.employee_id;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.review_comment := OLD.review_comment;
  NEW.decision := NULL;
  NEW.submitted_at := now();
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_advance_update() FROM PUBLIC, anon, authenticated;