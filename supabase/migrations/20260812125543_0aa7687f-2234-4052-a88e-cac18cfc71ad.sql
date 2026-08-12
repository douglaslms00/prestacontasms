CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id text NOT NULL,
  codigo text NOT NULL DEFAULT '',
  nome text NOT NULL,
  cliente text,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (external_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;

ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY obras_select ON public.obras FOR SELECT TO authenticated USING (true);
CREATE POLICY obras_write ON public.obras FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'integrar_obras'::public.app_permission))
  WITH CHECK (has_permission(auth.uid(), 'integrar_obras'::public.app_permission));

CREATE TRIGGER obras_updated_at BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.advances ADD COLUMN obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL;

CREATE TABLE public.obra_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id uuid NOT NULL REFERENCES public.advances(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  success boolean NOT NULL DEFAULT false,
  message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.obra_sync_logs TO authenticated;
GRANT ALL ON public.obra_sync_logs TO service_role;

ALTER TABLE public.obra_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY obra_sync_logs_select ON public.obra_sync_logs FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'integrar_obras'::public.app_permission)
     OR has_permission(auth.uid(), 'ver_todos'::public.app_permission));
CREATE POLICY obra_sync_logs_insert ON public.obra_sync_logs FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'integrar_obras'::public.app_permission)
     OR has_permission(auth.uid(), 'aprovar_prestacao'::public.app_permission));