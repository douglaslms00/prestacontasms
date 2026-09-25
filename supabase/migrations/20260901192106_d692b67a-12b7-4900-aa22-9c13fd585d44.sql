CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'info',
  link text,
  advance_id uuid REFERENCES public.advances(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_users_with_permission(_permission app_permission, _title text, _body text, _type text, _link text, _advance_id uuid, _exclude uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, title, body, type, link, advance_id)
  SELECT DISTINCT u.user_id, _title, _body, _type, _link, _advance_id
  FROM (
    SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::public.app_role
    UNION
    SELECT uc.user_id FROM public.user_cargos uc
    JOIN public.cargo_permissions cp ON cp.cargo_id = uc.cargo_id
    WHERE cp.permission = _permission
  ) u
  WHERE _exclude IS NULL OR u.user_id <> _exclude;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_users_with_permission(app_permission, text, text, text, text, uuid, uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_advance_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_id IS DISTINCT FROM NEW.created_by THEN
    INSERT INTO public.notifications (user_id, title, body, type, link, advance_id)
    VALUES (NEW.employee_id, 'Novo adiantamento liberado',
      'Você recebeu o adiantamento "' || NEW.title || '" no valor de R$ ' || to_char(NEW.amount, 'FM999999990.00') || '.',
      'success', '/adiantamento/' || NEW.id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER advances_notify_created
AFTER INSERT ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.notify_advance_created();

CREATE OR REPLACE FUNCTION public.notify_topup_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE a public.advances%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.advances WHERE id = NEW.advance_id;
  IF a.id IS NOT NULL AND a.employee_id IS DISTINCT FROM NEW.created_by THEN
    INSERT INTO public.notifications (user_id, title, body, type, link, advance_id)
    VALUES (a.employee_id, 'Verba adicional liberada',
      'Foram adicionados R$ ' || to_char(NEW.amount, 'FM999999990.00') || ' ao adiantamento "' || a.title || '".',
      'success', '/adiantamento/' || a.id, a.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER advance_topups_notify_created
AFTER INSERT ON public.advance_topups
FOR EACH ROW EXECUTE FUNCTION public.notify_topup_created();

CREATE OR REPLACE FUNCTION public.notify_advance_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_analise'::public.advance_status THEN
      PERFORM public.notify_users_with_permission(
        'aprovar_prestacao'::public.app_permission,
        'Prestação enviada para análise',
        'A prestação "' || NEW.title || '" aguarda aprovação.',
        'info', '/adiantamento/' || NEW.id, NEW.id, NEW.employee_id);
    ELSIF NEW.status = 'fechado'::public.advance_status THEN
      INSERT INTO public.notifications (user_id, title, body, type, link, advance_id)
      VALUES (NEW.employee_id,
        CASE WHEN NEW.decision = 'rejeitado' THEN 'Prestação rejeitada' ELSE 'Prestação aprovada' END,
        'A prestação "' || NEW.title || '" foi ' ||
          CASE WHEN NEW.decision = 'rejeitado' THEN 'rejeitada' ELSE 'aprovada' END ||
          COALESCE('. Comentário: ' || NULLIF(NEW.review_comment, ''), '.'),
        CASE WHEN NEW.decision = 'rejeitado' THEN 'error' ELSE 'success' END,
        '/adiantamento/' || NEW.id, NEW.id);
    ELSIF NEW.status = 'aberto'::public.advance_status THEN
      INSERT INTO public.notifications (user_id, title, body, type, link, advance_id)
      VALUES (NEW.employee_id, 'Prestação reaberta',
        'A prestação "' || NEW.title || '" foi reaberta para ajustes.',
        'info', '/adiantamento/' || NEW.id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER advances_notify_status
AFTER UPDATE ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.notify_advance_status();