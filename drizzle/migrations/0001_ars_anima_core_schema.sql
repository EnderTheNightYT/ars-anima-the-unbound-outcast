CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Anónimo',
  avatar_url text,
  title text NOT NULL DEFAULT '',
  discord text NOT NULL DEFAULT '',
  discord_hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles own insert" ON public.profiles;
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles own update" ON public.profiles;
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
    left(coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Anónimo'), 24),
    NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.cloud_saves (
  user_id uuid PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cloud_saves TO authenticated;
GRANT ALL ON public.cloud_saves TO service_role;
ALTER TABLE public.cloud_saves ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saves own select" ON public.cloud_saves;
CREATE POLICY "saves own select" ON public.cloud_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "saves own insert" ON public.cloud_saves;
CREATE POLICY "saves own insert" ON public.cloud_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saves own update" ON public.cloud_saves;
CREATE POLICY "saves own update" ON public.cloud_saves FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "saves own delete" ON public.cloud_saves;
CREATE POLICY "saves own delete" ON public.cloud_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  run_key text NOT NULL,
  player_name text NOT NULL,
  title text NOT NULL DEFAULT '',
  class_name text NOT NULL,
  subclass text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'normal',
  outcome text NOT NULL,
  cause text NOT NULL DEFAULT '',
  score integer NOT NULL,
  floor integer NOT NULL,
  level integer NOT NULL,
  kills integer NOT NULL DEFAULT 0,
  seconds integer NOT NULL DEFAULT 0,
  melee text NOT NULL DEFAULT '',
  ranged text NOT NULL DEFAULT '',
  armor text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, run_key)
);
CREATE INDEX IF NOT EXISTS runs_score_idx ON public.runs (score DESC);
GRANT SELECT ON public.runs TO anon;
GRANT SELECT, INSERT ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "runs public read" ON public.runs;
CREATE POLICY "runs public read" ON public.runs FOR SELECT USING (true);
DROP POLICY IF EXISTS "runs own insert" ON public.runs;
CREATE POLICY "runs own insert" ON public.runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target text NOT NULL,
  user_id uuid NOT NULL,
  author_name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comments_target_idx ON public.comments (target, created_at DESC);
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments public read" ON public.comments;
CREATE POLICY "comments public read" ON public.comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "comments own insert" ON public.comments;
CREATE POLICY "comments own insert" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "comments own delete" ON public.comments;
CREATE POLICY "comments own delete" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.live_runs (
  user_id uuid PRIMARY KEY,
  run_key text NOT NULL,
  player_name text NOT NULL,
  class_name text NOT NULL DEFAULT '',
  difficulty text NOT NULL DEFAULT 'normal',
  region text NOT NULL DEFAULT '',
  floor integer NOT NULL DEFAULT 1,
  level integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  kills integer NOT NULL DEFAULT 0,
  seconds integer NOT NULL DEFAULT 0,
  melee text NOT NULL DEFAULT '',
  ranged text NOT NULL DEFAULT '',
  armor text NOT NULL DEFAULT '',
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.live_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.live_runs TO authenticated;
GRANT ALL ON public.live_runs TO service_role;
ALTER TABLE public.live_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "live public read" ON public.live_runs;
CREATE POLICY "live public read" ON public.live_runs FOR SELECT USING (true);
DROP POLICY IF EXISTS "live own insert" ON public.live_runs;
CREATE POLICY "live own insert" ON public.live_runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "live own update" ON public.live_runs;
CREATE POLICY "live own update" ON public.live_runs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "live own delete" ON public.live_runs;
CREATE POLICY "live own delete" ON public.live_runs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.weapon_finds (
  name text PRIMARY KEY,
  weapon_type text NOT NULL,
  ranged boolean NOT NULL DEFAULT false,
  rarity integer NOT NULL DEFAULT 0,
  dmg_mult numeric NOT NULL DEFAULT 1,
  crit integer NOT NULL DEFAULT 0,
  acc integer NOT NULL DEFAULT 0,
  affixes text[] NOT NULL DEFAULT '{}',
  times_found integer NOT NULL DEFAULT 1,
  first_finder text NOT NULL DEFAULT '',
  first_found_at timestamptz NOT NULL DEFAULT now(),
  last_found_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weapon_finds_type_idx ON public.weapon_finds (weapon_type);
GRANT SELECT ON public.weapon_finds TO anon, authenticated;
GRANT ALL ON public.weapon_finds TO service_role;
ALTER TABLE public.weapon_finds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finds public read" ON public.weapon_finds;
CREATE POLICY "finds public read" ON public.weapon_finds FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.record_weapon_find(_name text, _type text, _ranged boolean, _rarity integer, _dmg numeric, _crit integer, _acc integer, _affixes text[], _finder text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF char_length(_name) > 80 OR char_length(_type) > 30 OR _rarity NOT BETWEEN 0 AND 4 OR _dmg NOT BETWEEN 0 AND 10 OR _crit NOT BETWEEN 0 AND 100 OR _acc NOT BETWEEN 0 AND 20 OR coalesce(array_length(_affixes,1),0) > 9 THEN
    RAISE EXCEPTION 'invalid weapon';
  END IF;
  INSERT INTO public.weapon_finds (name, weapon_type, ranged, rarity, dmg_mult, crit, acc, affixes, first_finder)
  VALUES (_name, _type, _ranged, _rarity, _dmg, _crit, _acc, _affixes, left(coalesce(_finder,''),24))
  ON CONFLICT (name) DO UPDATE SET times_found = weapon_finds.times_found + 1, last_found_at = now(),
    rarity = GREATEST(weapon_finds.rarity, EXCLUDED.rarity), dmg_mult = GREATEST(weapon_finds.dmg_mult, EXCLUDED.dmg_mult),
    crit = GREATEST(weapon_finds.crit, EXCLUDED.crit), acc = GREATEST(weapon_finds.acc, EXCLUDED.acc),
    affixes = (SELECT array_agg(DISTINCT a) FROM unnest(weapon_finds.affixes || EXCLUDED.affixes) a);
END $$;
REVOKE EXECUTE ON FUNCTION public.record_weapon_find(text,text,boolean,integer,numeric,integer,integer,text[],text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_weapon_find(text,text,boolean,integer,numeric,integer,integer,text[],text) TO authenticated;

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dismissed','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, reporter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_reports TO authenticated;
GRANT ALL ON public.comment_reports TO service_role;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "report own insert" ON public.comment_reports;
CREATE POLICY "report own insert" ON public.comment_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND status = 'pending');
DROP POLICY IF EXISTS "report admin read" ON public.comment_reports;
CREATE POLICY "report admin read" ON public.comment_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = reporter_id);
DROP POLICY IF EXISTS "report admin update" ON public.comment_reports;
CREATE POLICY "report admin update" ON public.comment_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "report admin delete" ON public.comment_reports;
CREATE POLICY "report admin delete" ON public.comment_reports FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "comments admin delete" ON public.comments;
CREATE POLICY "comments admin delete" ON public.comments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.floor_averages()
RETURNS TABLE(floor integer, runs bigint, players bigint, deaths bigint, avg_seconds numeric, avg_kills numeric, avg_score numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT r.floor, count(*), count(DISTINCT r.user_id),
    count(*) FILTER (WHERE r.outcome = 'death'),
    round(avg(r.seconds)::numeric, 0), round(avg(r.kills)::numeric, 1), round(avg(r.score)::numeric, 0)
  FROM public.runs r GROUP BY r.floor ORDER BY r.floor
$$;
GRANT EXECUTE ON FUNCTION public.floor_averages() TO anon, authenticated;

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.runs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.combat_ai_status (id text PRIMARY KEY, paused boolean NOT NULL DEFAULT false, reason text NOT NULL DEFAULT '', status integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.combat_ai_status TO service_role;
ALTER TABLE public.combat_ai_status ENABLE ROW LEVEL SECURITY;