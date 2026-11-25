-- Accounts: automatic profile creation and private cloud backups of a player's save.
-- DRAFT: written against the documented Supabase schema but NOT yet applied to a real project.
-- Run after 0001_init.sql. See docs/AUTH.md.

-- 1. Create a profile row for every new auth user (Google or email) with a safe, unique username.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  tries int := 0;
begin
  base := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1), ''),
    '[^a-zA-Z0-9]', '', 'g'));
  if char_length(base) < 3 then
    base := 'miner' || base;
  end if;
  base := left(base, 14);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    tries := tries + 1;
    candidate := base || floor(random() * 900000 + 100000)::int::text;  -- 6 digits, total <= 20 chars
    exit when tries > 20;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Private backup of the local save. Convenience only: the browser writes this, so it must never feed
--    scoring, rarity or leaderboards (those use server-validated attempts from 0001).
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  constraint player_saves_size check (pg_column_size(data) <= 400000)
);

alter table public.player_saves enable row level security;

create policy "read own save" on public.player_saves for select using (auth.uid() = user_id);
create policy "insert own save" on public.player_saves for insert with check (auth.uid() = user_id);
create policy "update own save" on public.player_saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own save" on public.player_saves for delete using (auth.uid() = user_id);
