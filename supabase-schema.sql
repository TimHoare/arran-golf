-- Golf week — database setup.
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.
-- Safe to re-run.

-- One row per player per hole per round. gross is null when a score is cleared;
-- 0 means the ball was picked up (hole played, no score).
create table if not exists hole_scores (
  round_id   text not null,
  player_id  text not null,
  hole       smallint not null check (hole between 1 and 18),
  gross      smallint check (gross between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole)
);

-- Scramble day: one row per team per hole.
create table if not exists team_scores (
  round_id   text not null,
  team       smallint not null,
  hole       smallint not null check (hole between 1 and 18),
  gross      smallint check (gross between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (round_id, team, hole)
);

-- Databases created before pickups existed allow only 1–20; widen to 0–20.
alter table hole_scores drop constraint if exists hole_scores_gross_check;
alter table hole_scores add constraint hole_scores_gross_check check (gross between 0 and 20);
alter table team_scores drop constraint if exists team_scores_gross_check;
alter table team_scores add constraint team_scores_gross_check check (gross between 0 and 20);

-- Hidden-pairs draw per round: the sealed pairs and whether they've been revealed.
create table if not exists pair_draws (
  round_id   text primary key,
  pairs      jsonb not null,
  revealed   boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Group draw per round: player ids per tee group, overriding the placeholders.
create table if not exists group_draws (
  round_id   text primary key,
  groups     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Side bets: one row per round, tee group, kind (cuckoo/camel/fish/threeputt)
-- and hole. counts = { player_id: n }; last_pid = who had the last one there.
create table if not exists bit_events (
  round_id   text not null,
  grp        smallint not null,
  kind       text not null check (kind in ('cuckoo','camel','fish','threeputt','lostball')),
  hole       smallint not null check (hole between 1 and 18),
  counts     jsonb not null default '{}',
  last_pid   text,
  updated_at timestamptz not null default now(),
  primary key (round_id, grp, kind, hole)
);

-- Databases created before lost balls existed only allow the original four kinds.
alter table bit_events drop constraint if exists bit_events_kind_check;
alter table bit_events add constraint bit_events_kind_check check (kind in ('cuckoo','camel','fish','threeputt','lostball'));

-- Bonus balls: one row per player for the whole trip. used = { round_id: hole
-- index 0–17 } where the 2× was played each round; lost_round = the round the
-- ball was lost in (null while still in play).
create table if not exists bonus_balls (
  player_id  text primary key,
  used       jsonb not null default '{}',
  lost_round text,
  updated_at timestamptz not null default now()
);

-- Tee choice per round, when a course is played off something other than the
-- default tees in the app. Absent row = default; tee = the TeeSet key.
create table if not exists tee_choices (
  round_id   text primary key,
  tee        text not null,
  updated_at timestamptz not null default now()
);

-- Side-bet stakes (pence each), one shared row edited from app settings.
create table if not exists stakes (
  id         smallint primary key,
  stakes     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Access model: the app URL is the secret. Anyone with the link can read and
-- write scores (it's a mates' trip, not a bank). RLS is on, so the anon key can't
-- touch anything except these tables — and it can't DELETE scores at all. The
-- app never deletes from the score tables; only clearing a pair draw, group draw
-- or tee choice removes a row. So a phone (or anyone with the key) can't wipe
-- the week, however hard it tries. To start fresh between trips, run this in
-- the SQL editor (the history table below keeps a copy of everything anyway):
--   truncate hole_scores, team_scores, pair_draws, group_draws, bit_events, bonus_balls, tee_choices, stakes;
alter table hole_scores enable row level security;
alter table team_scores enable row level security;
alter table pair_draws  enable row level security;
alter table group_draws enable row level security;
alter table bit_events  enable row level security;
alter table stakes      enable row level security;
alter table bonus_balls enable row level security;
alter table tee_choices enable row level security;

-- Older databases had one "open access" policy per table that also allowed delete.
drop policy if exists "open access" on hole_scores;
drop policy if exists "open access" on team_scores;
drop policy if exists "open access" on pair_draws;
drop policy if exists "open access" on group_draws;
drop policy if exists "open access" on bit_events;
drop policy if exists "open access" on stakes;
drop policy if exists "open access" on bonus_balls;
drop policy if exists "open access" on tee_choices;

drop policy if exists "read"   on hole_scores; create policy "read"   on hole_scores for select using (true);
drop policy if exists "add"    on hole_scores; create policy "add"    on hole_scores for insert with check (true);
drop policy if exists "change" on hole_scores; create policy "change" on hole_scores for update using (true) with check (true);
drop policy if exists "read"   on team_scores; create policy "read"   on team_scores for select using (true);
drop policy if exists "add"    on team_scores; create policy "add"    on team_scores for insert with check (true);
drop policy if exists "change" on team_scores; create policy "change" on team_scores for update using (true) with check (true);
drop policy if exists "read"   on bit_events;  create policy "read"   on bit_events  for select using (true);
drop policy if exists "add"    on bit_events;  create policy "add"    on bit_events  for insert with check (true);
drop policy if exists "change" on bit_events;  create policy "change" on bit_events  for update using (true) with check (true);
drop policy if exists "read"   on stakes;      create policy "read"   on stakes      for select using (true);
drop policy if exists "add"    on stakes;      create policy "add"    on stakes      for insert with check (true);
drop policy if exists "change" on stakes;      create policy "change" on stakes      for update using (true) with check (true);
drop policy if exists "read"   on bonus_balls; create policy "read"   on bonus_balls for select using (true);
drop policy if exists "add"    on bonus_balls; create policy "add"    on bonus_balls for insert with check (true);
drop policy if exists "change" on bonus_balls; create policy "change" on bonus_balls for update using (true) with check (true);
-- Draws and tee choices are cleared by deleting the row, so these three keep delete.
drop policy if exists "read"   on pair_draws;  create policy "read"   on pair_draws  for select using (true);
drop policy if exists "add"    on pair_draws;  create policy "add"    on pair_draws  for insert with check (true);
drop policy if exists "change" on pair_draws;  create policy "change" on pair_draws  for update using (true) with check (true);
drop policy if exists "remove" on pair_draws;  create policy "remove" on pair_draws  for delete using (true);
drop policy if exists "read"   on group_draws; create policy "read"   on group_draws for select using (true);
drop policy if exists "add"    on group_draws; create policy "add"    on group_draws for insert with check (true);
drop policy if exists "change" on group_draws; create policy "change" on group_draws for update using (true) with check (true);
drop policy if exists "remove" on group_draws; create policy "remove" on group_draws for delete using (true);
drop policy if exists "read"   on tee_choices; create policy "read"   on tee_choices for select using (true);
drop policy if exists "add"    on tee_choices; create policy "add"    on tee_choices for insert with check (true);
drop policy if exists "change" on tee_choices; create policy "change" on tee_choices for update using (true) with check (true);
drop policy if exists "remove" on tee_choices; create policy "remove" on tee_choices for delete using (true);

-- History: every insert, update and delete on every table above is copied here,
-- so nothing is ever truly lost and "who changed hole 7 and when" has an answer.
-- The app can read it but never write to it; the trigger runs as the table owner.
-- (Backups of all tables also land in the repo's `backups` branch every 15 min —
-- see README.md → Backups and recovery.)
create table if not exists history (
  id   bigint generated always as identity primary key,
  tbl  text not null,
  op   text not null,          -- INSERT / UPDATE / DELETE
  data jsonb not null,         -- the row after the change (the row removed, for DELETE)
  at   timestamptz not null default now()
);
create index if not exists history_tbl_at on history (tbl, at);
alter table history enable row level security;
drop policy if exists "read" on history; create policy "read" on history for select using (true);

create or replace function log_history() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into history (tbl, op, data) values (tg_table_name, tg_op, to_jsonb(old));
    return old;
  end if;
  insert into history (tbl, op, data) values (tg_table_name, tg_op, to_jsonb(new));
  return new;
end $$;

drop trigger if exists history on hole_scores; create trigger history after insert or update or delete on hole_scores for each row execute function log_history();
drop trigger if exists history on team_scores; create trigger history after insert or update or delete on team_scores for each row execute function log_history();
drop trigger if exists history on pair_draws;  create trigger history after insert or update or delete on pair_draws  for each row execute function log_history();
drop trigger if exists history on group_draws; create trigger history after insert or update or delete on group_draws for each row execute function log_history();
drop trigger if exists history on bit_events;  create trigger history after insert or update or delete on bit_events  for each row execute function log_history();
drop trigger if exists history on stakes;      create trigger history after insert or update or delete on stakes      for each row execute function log_history();
drop trigger if exists history on bonus_balls; create trigger history after insert or update or delete on bonus_balls for each row execute function log_history();
drop trigger if exists history on tee_choices; create trigger history after insert or update or delete on tee_choices for each row execute function log_history();

-- Recovery from history: put hole_scores back as they stood at a moment. Change
-- the timestamp, run in the SQL editor; phones pick the rows up live. The same
-- shape works for the other tables (swap the key columns and fields).
--   insert into hole_scores (round_id, player_id, hole, gross, updated_at)
--   select data->>'round_id', data->>'player_id', (data->>'hole')::smallint, (data->>'gross')::smallint, now()
--   from (
--     select distinct on (data->>'round_id', data->>'player_id', data->>'hole') op, data
--     from history
--     where tbl = 'hole_scores' and at <= '2026-09-09 15:00+01'
--     order by data->>'round_id', data->>'player_id', data->>'hole', at desc, id desc
--   ) last
--   where op <> 'DELETE'
--   on conflict (round_id, player_id, hole) do update set gross = excluded.gross, updated_at = excluded.updated_at;

-- Realtime: broadcast row changes to connected phones.
do $$
begin
  alter publication supabase_realtime add table hole_scores;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table team_scores;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table pair_draws;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table group_draws;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table bit_events;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table stakes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table bonus_balls;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table tee_choices;
exception when duplicate_object then null;
end $$;
