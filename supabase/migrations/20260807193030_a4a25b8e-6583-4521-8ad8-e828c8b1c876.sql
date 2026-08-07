-- Internal-only helpers: not callable through the API at all
REVOKE ALL ON FUNCTION public.tem_permissao(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Access-check helpers: needed by RLS policies and server functions for signed-in users only
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_terapeuta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_terapeuta() TO authenticated;

REVOKE ALL ON FUNCTION public.pode(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode(text) TO authenticated;

REVOKE ALL ON FUNCTION public.pode_administrar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pode_administrar() TO authenticated;

REVOKE ALL ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conteudo_liberado(uuid, uuid, uuid) TO authenticated;

-- Signup screen needs this one publicly
GRANT EXECUTE ON FUNCTION public.existe_terapeuta() TO anon, authenticated;