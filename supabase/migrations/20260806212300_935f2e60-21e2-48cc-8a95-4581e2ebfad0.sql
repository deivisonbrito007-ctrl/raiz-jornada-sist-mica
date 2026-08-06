GRANT EXECUTE ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_terapeuta() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;