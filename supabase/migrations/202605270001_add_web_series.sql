-- Safe Web Series support for WatchFinder.
-- This migration only creates/adds tables, indexes, triggers, and RLS policies.
-- It does not delete, reset, truncate, archive, or rewrite existing movie data.

create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  poster_url text,
  banner_url text,
  genre text,
  language text,
  release_year integer,
  rating text,
  status text default 'ongoing',
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.series
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists poster_url text,
  add column if not exists banner_url text,
  add column if not exists genre text,
  add column if not exists language text,
  add column if not exists release_year integer,
  add column if not exists rating text,
  add column if not exists status text default 'ongoing',
  add column if not exists is_published boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'series_slug_key'
      and conrelid = 'public.series'::regclass
  ) then
    alter table public.series add constraint series_slug_key unique (slug);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'series_status_check'
      and conrelid = 'public.series'::regclass
  ) then
    alter table public.series
      add constraint series_status_check
      check (status in ('ongoing', 'completed'));
  end if;
end $$;

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid references public.series(id) on delete cascade,
  season_number integer not null,
  title text,
  description text,
  poster_url text,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(series_id, season_number)
);

alter table public.seasons
  add column if not exists series_id uuid references public.series(id) on delete cascade,
  add column if not exists season_number integer,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists poster_url text,
  add column if not exists is_published boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'seasons_series_id_season_number_key'
      and conrelid = 'public.seasons'::regclass
  ) then
    alter table public.seasons
      add constraint seasons_series_id_season_number_key
      unique (series_id, season_number);
  end if;
end $$;

create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete cascade,
  series_id uuid references public.series(id) on delete cascade,
  episode_number integer not null,
  title text not null,
  description text,
  thumbnail_url text,
  video_url text not null,
  duration text,
  release_date date,
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(season_id, episode_number)
);

alter table public.episodes
  add column if not exists season_id uuid references public.seasons(id) on delete cascade,
  add column if not exists series_id uuid references public.series(id) on delete cascade,
  add column if not exists episode_number integer,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists thumbnail_url text,
  add column if not exists video_url text,
  add column if not exists duration text,
  add column if not exists release_date date,
  add column if not exists is_published boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'episodes_season_id_episode_number_key'
      and conrelid = 'public.episodes'::regclass
  ) then
    alter table public.episodes
      add constraint episodes_season_id_episode_number_key
      unique (season_id, episode_number);
  end if;
end $$;

create index if not exists series_slug_idx on public.series(slug);
create index if not exists series_is_published_idx on public.series(is_published);
create index if not exists series_status_idx on public.series(status);
create index if not exists series_created_at_idx on public.series(created_at);
create index if not exists seasons_series_id_idx on public.seasons(series_id);
create index if not exists seasons_published_number_idx on public.seasons(is_published, season_number);
create index if not exists episodes_series_id_idx on public.episodes(series_id);
create index if not exists episodes_season_id_idx on public.episodes(season_id);
create index if not exists episodes_published_number_idx on public.episodes(is_published, episode_number);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'series_set_updated_at') then
    create trigger series_set_updated_at
      before update on public.series
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'seasons_set_updated_at') then
    create trigger seasons_set_updated_at
      before update on public.seasons
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'episodes_set_updated_at') then
    create trigger episodes_set_updated_at
      before update on public.episodes
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.series enable row level security;
alter table public.seasons enable row level security;
alter table public.episodes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'series'
      and policyname = 'Public can read published series'
  ) then
    create policy "Public can read published series"
    on public.series
    for select
    to anon, authenticated
    using (is_published = true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'series'
      and policyname = 'Admins can manage series'
  ) then
    create policy "Admins can manage series"
    on public.series
    for all
    to authenticated
    using (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'seasons'
      and policyname = 'Public can read published seasons'
  ) then
    create policy "Public can read published seasons"
    on public.seasons
    for select
    to anon, authenticated
    using (
      is_published = true
      and exists (
        select 1 from public.series
        where series.id = seasons.series_id
          and series.is_published = true
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'seasons'
      and policyname = 'Admins can manage seasons'
  ) then
    create policy "Admins can manage seasons"
    on public.seasons
    for all
    to authenticated
    using (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'episodes'
      and policyname = 'Public can read published episodes'
  ) then
    create policy "Public can read published episodes"
    on public.episodes
    for select
    to anon, authenticated
    using (
      is_published = true
      and exists (
        select 1 from public.series
        where series.id = episodes.series_id
          and series.is_published = true
      )
      and exists (
        select 1 from public.seasons
        where seasons.id = episodes.season_id
          and seasons.is_published = true
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'episodes'
      and policyname = 'Admins can manage episodes'
  ) then
    create policy "Admins can manage episodes"
    on public.episodes
    for all
    to authenticated
    using (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    )
    with check (
      exists (
        select 1 from public.profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
    );
  end if;
end $$;
