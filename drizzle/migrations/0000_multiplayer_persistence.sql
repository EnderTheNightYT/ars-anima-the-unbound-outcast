CREATE TABLE public.mp_matches (
  id uuid PRIMARY KEY,
  room_code text NOT NULL,
  mode text NOT NULL,
  difficulty text NOT NULL DEFAULT 'normal',
  outcome text NOT NULL,
  floors integer NOT NULL DEFAULT 1,
  players integer NOT NULL DEFAULT 1,
  started_at timestamptz,
  ended_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mp_matches TO anon, authenticated;
GRANT ALL ON public.mp_matches TO service_role;
ALTER TABLE public.mp_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Matches are public" ON public.mp_matches FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.mp_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.mp_matches(id) ON DELETE CASCADE,
  user_id uuid,
  name text NOT NULL,
  class_id text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  role2 text NOT NULL DEFAULT '',
  place integer NOT NULL,
  score integer NOT NULL DEFAULT 0,
  gold integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  title_meaning text NOT NULL DEFAULT '',
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mp_results_match_user ON public.mp_results(match_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX mp_results_user ON public.mp_results(user_id, created_at DESC);
GRANT SELECT ON public.mp_results TO anon, authenticated;
GRANT ALL ON public.mp_results TO service_role;
ALTER TABLE public.mp_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Results are public" ON public.mp_results FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.mp_profiles (
  user_id uuid PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  matches integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  podiums integer NOT NULL DEFAULT 0,
  victories integer NOT NULL DEFAULT 0,
  defeats integer NOT NULL DEFAULT 0,
  best_score integer NOT NULL DEFAULT 0,
  total_score bigint NOT NULL DEFAULT 0,
  gold bigint NOT NULL DEFAULT 0,
  kills integer NOT NULL DEFAULT 0,
  pvp_kills integer NOT NULL DEFAULT 0,
  betrayals integer NOT NULL DEFAULT 0,
  revives integer NOT NULL DEFAULT 0,
  healing integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mp_profiles TO anon, authenticated;
GRANT ALL ON public.mp_profiles TO service_role;
ALTER TABLE public.mp_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Multiplayer profiles are public" ON public.mp_profiles FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.mp_vault (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  match_id uuid REFERENCES public.mp_matches(id) ON DELETE SET NULL,
  item jsonb NOT NULL,
  claimed_at timestamptz,
  claimed_match text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mp_vault_user ON public.mp_vault(user_id, created_at DESC);
GRANT SELECT ON public.mp_vault TO authenticated;
GRANT ALL ON public.mp_vault TO service_role;
ALTER TABLE public.mp_vault ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their vault" ON public.mp_vault FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mp_record_match(payload jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  inserted uuid;
  uid uuid;
  it jsonb;
BEGIN
  INSERT INTO public.mp_matches(id, room_code, mode, difficulty, outcome, floors, players, started_at, ended_at)
  VALUES ((payload->>'id')::uuid, left(payload->>'code', 12), left(payload->>'mode', 16), left(coalesce(payload->>'difficulty', 'normal'), 16),
          left(payload->>'outcome', 16), coalesce((payload->>'floors')::int, 1), jsonb_array_length(payload->'rows'),
          to_timestamp(coalesce((payload->>'startedAt')::double precision, extract(epoch from now())) / 1000.0), now())
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted;
  IF inserted IS NULL THEN RETURN false; END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(payload->'rows') LOOP
    uid := NULLIF(r->>'userId', '')::uuid;
    INSERT INTO public.mp_results(match_id, user_id, name, class_id, role, role2, place, score, gold, outcome, title, title_meaning, stats)
    VALUES (inserted, uid, left(r->>'name', 24), left(coalesce(r->>'clsId', ''), 32), left(coalesce(r->>'role', ''), 16), left(coalesce(r->>'role2', ''), 16),
            (r->>'place')::int, greatest(0, (r->>'score')::int), greatest(0, (r->>'gold')::int), left(coalesce(r->>'outcome', ''), 16),
            left(coalesce(r->'title'->>'name', ''), 60), left(coalesce(r->'title'->>'meaning', ''), 200), coalesce(r->'stats', '{}'::jsonb));
    IF uid IS NOT NULL THEN
      INSERT INTO public.mp_profiles AS p(user_id, name, matches, wins, podiums, victories, defeats, best_score, total_score, gold, kills, pvp_kills, betrayals, revives, healing, updated_at)
      VALUES (uid, left(r->>'name', 24), 1,
              CASE WHEN (r->>'place')::int = 1 THEN 1 ELSE 0 END,
              CASE WHEN (r->>'place')::int <= 3 THEN 1 ELSE 0 END,
              CASE WHEN payload->>'outcome' = 'victory' THEN 1 ELSE 0 END,
              CASE WHEN payload->>'outcome' = 'victory' THEN 0 ELSE 1 END,
              greatest(0, (r->>'score')::int), greatest(0, (r->>'score')::int), greatest(0, (r->>'gold')::int),
              coalesce((r->'stats'->>'kills')::numeric, 0)::int, coalesce((r->'stats'->>'pvpKills')::numeric, 0)::int,
              coalesce((r->'stats'->>'betrayals')::numeric, 0)::int, coalesce((r->'stats'->>'revives')::numeric, 0)::int,
              coalesce((r->'stats'->>'healing')::numeric, 0)::int, now())
      ON CONFLICT (user_id) DO UPDATE SET
        name = excluded.name, matches = p.matches + 1, wins = p.wins + excluded.wins, podiums = p.podiums + excluded.podiums,
        victories = p.victories + excluded.victories, defeats = p.defeats + excluded.defeats,
        best_score = greatest(p.best_score, excluded.best_score), total_score = p.total_score + excluded.total_score,
        gold = p.gold + excluded.gold, kills = p.kills + excluded.kills, pvp_kills = p.pvp_kills + excluded.pvp_kills,
        betrayals = p.betrayals + excluded.betrayals, revives = p.revives + excluded.revives, healing = p.healing + excluded.healing, updated_at = now();
      FOR it IN SELECT * FROM jsonb_array_elements(coalesce(r->'items', '[]'::jsonb)) LIMIT 6 LOOP
        INSERT INTO public.mp_vault(user_id, match_id, item) VALUES (uid, inserted, it);
      END LOOP;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mp_claim_vault(_user uuid, _id uuid, _match text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.mp_vault SET claimed_at = now(), claimed_match = left(_match, 40)
  WHERE id = _id AND user_id = _user AND claimed_at IS NULL
  RETURNING item;
$$;

REVOKE ALL ON FUNCTION public.mp_record_match(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mp_claim_vault(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mp_record_match(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.mp_claim_vault(uuid, uuid, text) TO service_role;