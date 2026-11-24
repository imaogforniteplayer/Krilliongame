-- DEEPER backend schema. DRAFT: written to match the local save format and scoring rules, but NOT yet
-- applied or tested against a real Supabase project. Review before use. See docs/BACKEND.md.
--
-- Principles
--  * The browser never supplies points. An Edge Function validates the answer against the curated
--    bank, computes rarity and points with the versions below, and inserts the result.
--  * One ranked attempt per player per day is enforced by a unique index, not by client code.
--  * Players can read public leaderboards and their own rows; they cannot write scores directly.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.questions (
  id text primary key,
  text text not null,
  category text not null,
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  packs text[] not null default '{}',
  explanation text not null,
  verification text not null,
  status text not null default 'draft' check (status in ('active','draft','retired'))
);

create table public.answer_entries (
  id text primary key,
  question_id text not null references public.questions on delete cascade,
  canonical text not null,
  commonness smallint not null check (commonness between 1 and 6),
  aliases text[] not null default '{}'
);

create table public.daily_challenges (
  day date primary key,
  question_ids text[] not null check (array_length(question_ids, 1) = 7),
  scoring_version text not null,
  rarity_version text not null
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  mode text not null check (mode in ('daily','endless','practice')),
  day date,
  points int not null default 0,
  depth_m int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  scoring_version text not null,
  rarity_version text not null
);
-- Duplicate ranked attempts are impossible, whatever the client does.
create unique index one_ranked_attempt_per_day on public.attempts (user_id, day) where mode = 'daily';

create table public.answer_submissions (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts on delete cascade,
  question_id text not null references public.questions,
  typed text not null,
  normalized text not null,
  entry_id text references public.answer_entries,
  tier text,
  points int not null default 0,
  share numeric,
  rarity_source text check (rarity_source in ('estimated','observed')),
  time_taken_ms int not null,
  unique (attempt_id, question_id)
);

-- Aggregated, de-duplicated counts that feed observed rarity (one count per attempt per question).
create table public.answer_stats (
  question_id text not null references public.questions,
  entry_id text not null references public.answer_entries,
  count int not null default 0,
  primary key (question_id, entry_id)
);

create table public.unknown_answers (
  question_id text not null references public.questions,
  normalized text not null,
  sample_typed text not null,
  count int not null default 1,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  primary key (question_id, normalized)
);

create table public.collection (
  user_id uuid not null references public.profiles on delete cascade,
  discovery_id text not null,
  count int not null default 1,
  first_found_at timestamptz not null default now(),
  primary key (user_id, discovery_id)
);

-- Row level security -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.answer_entries enable row level security;
alter table public.daily_challenges enable row level security;
alter table public.attempts enable row level security;
alter table public.answer_submissions enable row level security;
alter table public.answer_stats enable row level security;
alter table public.unknown_answers enable row level security;
alter table public.collection enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "edit own profile" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()));

-- Only released daily challenges are readable (today or earlier), so future questions never leak.
create policy "released challenges" on public.daily_challenges for select using (day <= (now() at time zone 'utc')::date);
create policy "active questions readable" on public.questions for select using (status = 'active');
-- NOTE: answer_entries (the answer lists) are deliberately NOT readable by clients, so the bank cannot be scraped.

create policy "own attempts" on public.attempts for select using (auth.uid() = user_id);
create policy "own submissions" on public.answer_submissions for select
  using (exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid()));
create policy "own collection" on public.collection for select using (auth.uid() = user_id);

-- No insert/update/delete policies on attempts, answer_submissions, answer_stats, unknown_answers
-- or collection: only the service-role Edge Function writes them.

-- Public leaderboard view: finished ranked daily attempts only; no answers are exposed.
create view public.daily_leaderboard as
  select a.day, p.username, a.points, a.depth_m, a.finished_at
  from public.attempts a join public.profiles p on p.id = a.user_id
  where a.mode = 'daily' and a.finished_at is not null;
