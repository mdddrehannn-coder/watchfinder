-- Safe Web Series + Seasons + Episodes support for WatchFinder.
-- Creates dedicated tables requested by the admin/public web series system.
-- This migration does not delete, reset, truncate, archive, or rewrite movie data.

create table if not exists public.web_series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  release_year integer,
  language text,
  genre text,
  platform_name text,
  poster_url text,
  banner_url text,
  trailer_url text,
  video_embed_url text,
  video_provider text default 'direct',
  rating text,
  status text default 'draft',
  is_featured boolean default false,
  is_latest boolean default false,
  is_trending boolean default false,
  is_hindi_dubbed boolean default false,
  is_free_legal boolean default false,
  is_official boolean default false,
  seo_title text,
  seo_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.web_series
  add column if not exists title text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists release_year integer,
  add column if not exists language text,
  add column if not exists genre text,
  add column if not exists platform_name text,
  add column if not exists poster_url text,
  add column if not exists banner_url text,
  add column if not exists trailer_url text,
  add column if not exists video_embed_url text,
  add column if not exists video_provider text default 'direct',
  add column if not exists rating text,
  add column if not exists status text default 'draft',
  add column if not exists is_featured boolean default false,
  add column if not exists is_latest boolean default false,
  add column if not exists is_trending boolean default false,
  add column if not exists is_hindi_dubbed boolean default false,
  add column if not exists is_free_legal boolean default false,
  add column if not exists is_official boolean default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'web_series_slug_key'
      and conrelid = 'public.web_series'::regclass
  ) then
    alter table public.web_series add constraint web_series_slug_key unique (slug);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'web_series_status_check'
      and conrelid = 'public.web_series'::regclass
  ) then
    alter table public.web_series
      add constraint web_series_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create table if not exists public.web_series_seasons (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.web_series(id) on delete cascade,
  season_number integer not null,
  title text,
  description text,
  poster_url text,
  banner_url text,
  release_year integer,
  status text default 'published',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(series_id, season_number)
);

alter table public.web_series_seasons
  add column if not exists series_id uuid references public.web_series(id) on delete cascade,
  add column if not exists season_number integer,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists poster_url text,
  add column if not exists banner_url text,
  add column if not exists release_year integer,
  add column if not exists status text default 'published',
  add column if not exists sort_order integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'web_series_seasons_series_id_season_number_key'
      and conrelid = 'public.web_series_seasons'::regclass
  ) then
    alter table public.web_series_seasons
      add constraint web_series_seasons_series_id_season_number_key
      unique (series_id, season_number);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'web_series_seasons_status_check'
      and conrelid = 'public.web_series_seasons'::regclass
  ) then
    alter table public.web_series_seasons
      add constraint web_series_seasons_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create table if not exists public.web_series_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.web_series(id) on delete cascade,
  season_id uuid not null references public.web_series_seasons(id) on delete cascade,
  episode_number integer not null,
  title text not null,
  description text,
  duration_minutes integer,
  release_date date,
  poster_url text,
  banner_url text,
  trailer_url text,
  video_embed_url text,
  watch_url text,
  video_provider text default 'direct',
  platform_name text,
  availability_type text,
  language text,
  quality text,
  status text default 'published',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(season_id, episode_number)
);

alter table public.web_series_episodes
  add column if not exists series_id uuid references public.web_series(id) on delete cascade,
  add column if not exists season_id uuid references public.web_series_seasons(id) on delete cascade,
  add column if not exists episode_number integer,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists duration_minutes integer,
  add column if not exists release_date date,
  add column if not exists poster_url text,
  add column if not exists banner_url text,
  add column if not exists trailer_url text,
  add column if not exists video_embed_url text,
  add column if not exists watch_url text,
  add column if not exists video_provider text default 'direct',
  add column if not exists platform_name text,
  add column if not exists availability_type text,
  add column if not exists language text,
  add column if not exists quality text,
  add column if not exists status text default 'published',
  add column if not exists sort_order integer default 0,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'web_series_episodes_season_id_episode_number_key'
      and conrelid = 'public.web_series_episodes'::regclass
  ) then
    alter table public.web_series_episodes
      add constraint web_series_episodes_season_id_episode_number_key
      unique (season_id, episode_number);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'web_series_episodes_status_check'
      and conrelid = 'public.web_series_episodes'::regclass
  ) then
    alter table public.web_series_episodes
      add constraint web_series_episodes_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end $$;

create index if not exists web_series_slug_idx on public.web_series(slug);
create index if not exists web_series_status_idx on public.web_series(status);
create index if not exists web_series_created_at_idx on public.web_series(created_at);
create index if not exists web_series_seasons_series_id_idx on public.web_series_seasons(series_id);
create index if not exists web_series_episodes_series_id_idx on public.web_series_episodes(series_id);
create index if not exists web_series_episodes_season_id_idx on public.web_series_episodes(season_id);
create index if not exists web_series_episodes_status_idx on public.web_series_episodes(status);

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
  if not exists (select 1 from pg_trigger where tgname = 'web_series_set_updated_at') then
    create trigger web_series_set_updated_at
      before update on public.web_series
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'web_series_seasons_set_updated_at') then
    create trigger web_series_seasons_set_updated_at
      before update on public.web_series_seasons
      for each row execute function public.set_updated_at();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'web_series_episodes_set_updated_at') then
    create trigger web_series_episodes_set_updated_at
      before update on public.web_series_episodes
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.web_series enable row level security;
alter table public.web_series_seasons enable row level security;
alter table public.web_series_episodes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_series' and policyname = 'Public can read published web series') then
    create policy "Public can read published web series"
    on public.web_series
    for select
    to anon, authenticated
    using (status = 'published');
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_series' and policyname = 'Admins can manage web series') then
    create policy "Admins can manage web series"
    on public.web_series
    for all
    to authenticated
    using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
    with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_series_seasons' and policyname = 'Public can read published web series seasons') then
    create policy "Public can read published web series seasons"
    on public.web_series_seasons
    for select
    to anon, authenticated
    using (
      status = 'published'
      and exists (
        select 1 from public.web_series
        where web_series.id = web_series_seasons.series_id
          and web_series.status = 'published'
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_series_seasons' and policyname = 'Admins can manage web series seasons') then
    create policy "Admins can manage web series seasons"
    on public.web_series_seasons
    for all
    to authenticated
    using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
    with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_series_episodes' and policyname = 'Public can read published web series episodes') then
    create policy "Public can read published web series episodes"
    on public.web_series_episodes
    for select
    to anon, authenticated
    using (
      status = 'published'
      and exists (
        select 1 from public.web_series
        where web_series.id = web_series_episodes.series_id
          and web_series.status = 'published'
      )
      and exists (
        select 1 from public.web_series_seasons
        where web_series_seasons.id = web_series_episodes.season_id
          and web_series_seasons.status = 'published'
      )
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'web_series_episodes' and policyname = 'Admins can manage web series episodes') then
    create policy "Admins can manage web series episodes"
    on public.web_series_episodes
    for all
    to authenticated
    using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
    with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
  end if;
end $$;

