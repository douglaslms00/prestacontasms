-- 1) remove auth coupling
DROP TRIGGER IF EXISTS advances_enforce_update ON public.advances;
DROP FUNCTION IF EXISTS public.enforce_advance_update();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.advances DROP CONSTRAINT IF EXISTS advances_employee_id_fkey;
ALTER TABLE public.advances DROP CONSTRAINT IF EXISTS advances_created_by_fkey;
ALTER TABLE public.advances DROP CONSTRAINT IF EXISTS advances_reviewed_by_fkey;
ALTER TABLE public.advances ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_user_id_fkey;
ALTER TABLE public.expenses ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.advance_topups DROP CONSTRAINT IF EXISTS advance_topups_created_by_fkey;
ALTER TABLE public.user_cargos DROP CONSTRAINT IF EXISTS user_cargos_user_id_fkey;

-- 2) open policies on app tables
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','advances','expenses','advance_topups','cargos','cargo_permissions','user_cargos']
  LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t || '_public_all', t);
  END LOOP;
END $$;

-- 3) open storage policies for the cupons bucket
DROP POLICY IF EXISTS "cupons_select" ON storage.objects;
DROP POLICY IF EXISTS "cupons_insert" ON storage.objects;
DROP POLICY IF EXISTS "cupons_update" ON storage.objects;
DROP POLICY IF EXISTS "cupons_delete" ON storage.objects;
DROP POLICY IF EXISTS "cupons_public_all" ON storage.objects;
CREATE POLICY "cupons_public_all" ON storage.objects
  FOR ALL TO anon, authenticated
  USING (bucket_id = 'cupons') WITH CHECK (bucket_id = 'cupons');