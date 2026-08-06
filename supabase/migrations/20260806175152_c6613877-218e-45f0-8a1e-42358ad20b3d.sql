REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_terapeuta() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.conteudo_liberado(UUID, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_terapeuta() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.conteudo_liberado(UUID, UUID, UUID) TO authenticated, service_role;