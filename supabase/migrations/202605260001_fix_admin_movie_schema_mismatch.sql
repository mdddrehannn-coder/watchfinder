-- Safe admin movie save compatibility migration.
-- This migration only creates missing tables/columns/indexes/policies.
-- It does not delete, truncate, archive, or overwrite existing movie data.

create extension if not exists pgcrypto;

alter table public.movies
  add column if not exists slug text,
  add column if not exists type text default 'movie',
  add column if not exists description text,
  add column if not exists release_year integer,
  add column if not exists duration_minutes integer,
  add column if not exists rating numeric,
  add column if not exists language text,
  add column if not exists director text,
  add column if not exists poster_url text,
  add column if not exists banner_url text,
  add column if not exists trailer_url text,
  add column if not exists trailer_provider text,
  add column if not exists video_provider text,
  add column if not exists video_embed_url text,
  add column if not exists video_id text,
  add column if not exists availability_type text,
  add column if not exists quality text,
  add column if not exists watch_link_language text,
  add column if not exists has_licensed_video boolean default false,
  add column if not exists license_type text,
  add column if not exists license_owner_name text,
  add column if not exists license_start_date date,
  add column if not exists license_expiry_date date,
  add column if not exists license_notes text,
  add column if not exists distribution_territory text,
  add column if not exists popularity_score integer default 0,
  add column if not exists status text default 'draft',
  add column if not exists is_featured boolean default false,
  add column if not exists is_trending boolean default false,
  add column if not exists is_latest boolean default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists og_image_url text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists movies_slug_idx on public.movies(slug);
create index if not exists movies_status_idx on public.movies(status);
create index if not exists movies_feature_flags_idx on public.movies(is_featured, is_latest, is_trending);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz default now()
);

alter table public.genres
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists created_at timestamptz default now();

create index if not exists genres_slug_idx on public.genres(slug);

create table if not exists public.cast_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  role_label text,
  photo_url text,
  bio text,
  created_at timestamptz default now()
);

alter table public.cast_members
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists role_label text,
  add column if not exists photo_url text,
  add column if not exists bio text,
  add column if not exists created_at timestamptz default now();

create index if not exists cast_members_slug_idx on public.cast_members(slug);

create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  logo_url text,
  website_url text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.platforms
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists logo_url text,
  add column if not exists website_url text,
  add column if not exists description text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

create index if not exists platforms_slug_idx on public.platforms(slug);
create index if not exists platforms_is_active_idx on public.platforms(is_active);

create table if not exists public.movie_genres (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references public.movies(id) on delete cascade,
  genre_id uuid references public.genres(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.movie_genres
  add column if not exists movie_id uuid references public.movies(id) on delete cascade,
  add column if not exists genre_id uuid references public.genres(id) on delete cascade,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movie_genres_movie_id_genre_id_key'
      and conrelid = 'public.movie_genres'::regclass
  ) then
    alter table public.movie_genres
      add constraint movie_genres_movie_id_genre_id_key unique (movie_id, genre_id);
  end if;
end $$;

create index if not exists movie_genres_movie_id_idx on public.movie_genres(movie_id);
create index if not exists movie_genres_genre_id_idx on public.movie_genres(genre_id);

create table if not exists public.movie_cast (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references public.movies(id) on delete cascade,
  cast_member_id uuid references public.cast_members(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.movie_cast
  add column if not exists movie_id uuid references public.movies(id) on delete cascade,
  add column if not exists cast_member_id uuid references public.cast_members(id) on delete cascade,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movie_cast_movie_id_cast_member_id_key'
      and conrelid = 'public.movie_cast'::regclass
  ) then
    alter table public.movie_cast
      add constraint movie_cast_movie_id_cast_member_id_key unique (movie_id, cast_member_id);
  end if;
end $$;

create index if not exists movie_cast_movie_id_idx on public.movie_cast(movie_id);
create index if not exists movie_cast_cast_member_id_idx on public.movie_cast(cast_member_id);

create table if not exists public.movie_platform_links (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references public.movies(id) on delete cascade,
  platform_id uuid references public.platforms(id) on delete cascade,
  watch_url text,
  link_type text default 'direct_title_page',
  availability_type text default 'unknown',
  language text,
  quality text,
  notes text,
  is_official boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.movie_platform_links
  add column if not exists movie_id uuid references public.movies(id) on delete cascade,
  add column if not exists platform_id uuid references public.platforms(id) on delete cascade,
  add column if not exists watch_url text,
  add column if not exists link_type text default 'direct_title_page',
  add column if not exists availability_type text default 'unknown',
  add column if not exists language text,
  add column if not exists quality text,
  add column if not exists notes text,
  add column if not exists is_official boolean default true,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movie_platform_links_link_type_check'
      and conrelid = 'public.movie_platform_links'::regclass
  ) then
    alter table public.movie_platform_links
      add constraint movie_platform_links_link_type_check
      check (link_type in ('direct_title_page', 'platform_search', 'platform_home', 'app_deeplink'));
  end if;
end $$;

create index if not exists movie_platform_links_movie_id_idx on public.movie_platform_links(movie_id);
create index if not exists movie_platform_links_platform_id_idx on public.movie_platform_links(platform_id);
create index if not exists movie_platform_links_is_active_idx on public.movie_platform_links(is_active);

create table if not exists public.content_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  channel_type text not null check (channel_type in ('cartoon', 'tv_show')),
  logo_url text,
  description text,
  official_url text,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.content_channels
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists channel_type text,
  add column if not exists logo_url text,
  add column if not exists description text,
  add column if not exists official_url text,
  add column if not exists sort_order integer default 0,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists content_channels_slug_unique_idx on public.content_channels(slug);
create index if not exists content_channels_channel_type_idx on public.content_channels(channel_type);
create index if not exists content_channels_is_active_idx on public.content_channels(is_active);

create table if not exists public.content_channel_items (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.content_channels(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  season_number integer,
  episode_number integer,
  episode_title text,
  playlist_group text,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.content_channel_items
  add column if not exists channel_id uuid references public.content_channels(id) on delete cascade,
  add column if not exists movie_id uuid references public.movies(id) on delete cascade,
  add column if not exists season_number integer,
  add column if not exists episode_number integer,
  add column if not exists episode_title text,
  add column if not exists playlist_group text,
  add column if not exists sort_order integer default 0,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_channel_items_channel_id_movie_id_key'
      and conrelid = 'public.content_channel_items'::regclass
  ) then
    alter table public.content_channel_items
      add constraint content_channel_items_channel_id_movie_id_key unique (channel_id, movie_id);
  end if;
end $$;

create index if not exists content_channel_items_channel_id_idx on public.content_channel_items(channel_id);
create index if not exists content_channel_items_movie_id_idx on public.content_channel_items(movie_id);

create table if not exists public.license_documents (
  id uuid primary key default gen_random_uuid(),
  movie_id uuid references public.movies(id) on delete cascade,
  file_url text,
  file_path text,
  file_name text,
  license_type text,
  owner_name text,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.license_documents
  add column if not exists movie_id uuid references public.movies(id) on delete cascade,
  add column if not exists file_url text,
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists license_type text,
  add column if not exists owner_name text,
  add column if not exists notes text,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

create index if not exists license_documents_movie_id_idx on public.license_documents(movie_id);

alter table public.genres enable row level security;
alter table public.cast_members enable row level security;
alter table public.platforms enable row level security;
alter table public.movie_genres enable row level security;
alter table public.movie_cast enable row level security;
alter table public.movie_platform_links enable row level security;
alter table public.content_channels enable row level security;
alter table public.content_channel_items enable row level security;
alter table public.license_documents enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'genres' and policyname = 'Public can read genres') then
    create policy "Public can read genres" on public.genres for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'cast_members' and policyname = 'Public can read cast members') then
    create policy "Public can read cast members" on public.cast_members for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'platforms' and policyname = 'Public can read active platforms') then
    create policy "Public can read active platforms" on public.platforms for select using (is_active is distinct from false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movie_genres' and policyname = 'Public can read published movie genres') then
    create policy "Public can read published movie genres" on public.movie_genres
      for select using (
        exists (
          select 1 from public.movies
          where movies.id = movie_genres.movie_id
            and movies.status = 'published'
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movie_cast' and policyname = 'Public can read published movie cast') then
    create policy "Public can read published movie cast" on public.movie_cast
      for select using (
        exists (
          select 1 from public.movies
          where movies.id = movie_cast.movie_id
            and movies.status = 'published'
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'movie_platform_links' and policyname = 'Public can read published movie platform links') then
    create policy "Public can read published movie platform links" on public.movie_platform_links
      for select using (
        is_active is distinct from false
        and exists (
          select 1 from public.movies
          where movies.id = movie_platform_links.movie_id
            and movies.status = 'published'
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'content_channels' and policyname = 'Public can read active content channels') then
    create policy "Public can read active content channels" on public.content_channels
      for select using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'content_channel_items' and policyname = 'Public can read published channel items') then
    create policy "Public can read published channel items" on public.content_channel_items
      for select using (
        exists (
          select 1 from public.content_channels
          where content_channels.id = content_channel_items.channel_id
            and content_channels.is_active = true
        )
        and exists (
          select 1 from public.movies
          where movies.id = content_channel_items.movie_id
            and movies.status = 'published'
        )
      );
  end if;
end $$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'genres',
    'cast_members',
    'platforms',
    'movie_genres',
    'movie_cast',
    'movie_platform_links',
    'content_channels',
    'content_channel_items',
    'license_documents'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and policyname = 'Admins can manage ' || target_table
    ) then
      execute format(
        'create policy %I on public.%I for all using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = %L)) with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = %L))',
        'Admins can manage ' || target_table,
        target_table,
        'admin',
        'admin'
      );
    end if;
  end loop;
end $$;
