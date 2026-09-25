REVOKE EXECUTE ON FUNCTION public.notify_advance_created() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_topup_created() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_advance_status() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_users_with_permission(app_permission, text, text, text, text, uuid, uuid) FROM public, anon, authenticated;