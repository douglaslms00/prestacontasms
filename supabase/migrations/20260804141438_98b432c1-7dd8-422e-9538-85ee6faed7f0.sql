ALTER TABLE public.advances
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS review_comment text,
  ADD COLUMN IF NOT EXISTS decision text;

ALTER TABLE public.advances
  ADD CONSTRAINT advances_decision_check CHECK (decision IN ('aprovado','rejeitado'));

CREATE OR REPLACE FUNCTION public.enforce_advance_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
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
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_advance_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS advances_enforce_update ON public.advances;
CREATE TRIGGER advances_enforce_update
BEFORE UPDATE ON public.advances
FOR EACH ROW EXECUTE FUNCTION public.enforce_advance_update();

DROP POLICY IF EXISTS advances_submit_own ON public.advances;
CREATE POLICY advances_submit_own ON public.advances
FOR UPDATE TO authenticated
USING (employee_id = auth.uid() AND status = 'aberto')
WITH CHECK (employee_id = auth.uid());