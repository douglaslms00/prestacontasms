INSERT INTO public.cargos (name, description)
SELECT 'Usuario', 'Cargo padrão atribuído automaticamente a novos usuários'
WHERE NOT EXISTS (SELECT 1 FROM public.cargos WHERE lower(name) = 'usuario');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE default_cargo uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN (SELECT count(*) FROM public.user_roles) = 0 THEN 'admin'::public.app_role ELSE 'funcionario'::public.app_role END)
  ON CONFLICT DO NOTHING;

  SELECT id INTO default_cargo FROM public.cargos WHERE lower(name) = 'usuario' LIMIT 1;
  IF default_cargo IS NOT NULL THEN
    INSERT INTO public.user_cargos (user_id, cargo_id)
    SELECT NEW.id, default_cargo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_cargos uc WHERE uc.user_id = NEW.id AND uc.cargo_id = default_cargo
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

INSERT INTO public.user_cargos (user_id, cargo_id)
SELECT u.id, c.id
FROM auth.users u
CROSS JOIN (SELECT id FROM public.cargos WHERE lower(name) = 'usuario' LIMIT 1) c
WHERE NOT EXISTS (SELECT 1 FROM public.user_cargos uc WHERE uc.user_id = u.id);