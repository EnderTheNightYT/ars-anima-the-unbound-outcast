-- Discord handles marked as hidden must not be readable by other players.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, display_name, avatar_url, title, discord_hidden, updated_at) ON public.profiles TO anon, authenticated;
GRANT UPDATE (display_name, avatar_url, title, discord, discord_hidden, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.public_discords(_ids uuid[])
RETURNS TABLE (id uuid, discord text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.discord FROM public.profiles p
  WHERE p.id = ANY (_ids[1:300]) AND NOT coalesce(p.discord_hidden, false) AND coalesce(p.discord, '') <> ''
$$;

CREATE OR REPLACE FUNCTION public.my_discord()
RETURNS TABLE (discord text, discord_hidden boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.discord, coalesce(p.discord_hidden, false) FROM public.profiles p WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.public_discords(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_discord() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_discords(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_discord() TO authenticated;