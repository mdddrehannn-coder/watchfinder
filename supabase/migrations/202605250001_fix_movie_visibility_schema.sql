alter table public.movies
  add column if not exists slug text,
  add column if not exists type text default 'movie',
  add column if not exists status text default 'draft',
  add column if not exists release_year integer null,
  add column if not exists duration_minutes integer null,
  add column if not exists rating numeric null,
  add column if not exists language text null,
  add column if not exists director text null,
  add column if not exists popularity_score integer default 0,
  add column if not exists description text null,
  add column if not exists poster_url text null,
  add column if not exists banner_url text null,
  add column if not exists trailer_url text null,
  add column if not exists trailer_provider text default 'youtube',
  add column if not exists availability_type text null,
  add column if not exists quality text null,
  add column if not exists watch_link_language text null,
  add column if not exists has_licensed_video boolean default false,
  add column if not exists video_provider text null,
  add column if not exists video_embed_url text null,
  add column if not exists video_id text null,
  add column if not exists license_type text null,
  add column if not exists license_owner_name text null,
  add column if not exists license_start_date date null,
  add column if not exists license_expiry_date date null,
  add column if not exists license_notes text null,
  add column if not exists distribution_territory text null,
  add column if not exists seo_title text null,
  add column if not exists seo_description text null,
  add column if not exists og_image_url text null,
  add column if not exists is_featured boolean default false,
  add column if not exists is_latest boolean default false,
  add column if not exists is_trending boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists movies_slug_idx on public.movies(slug);
create index if not exists movies_status_idx on public.movies(status);
create index if not exists movies_homepage_flags_idx on public.movies(status, is_featured, is_latest, is_trending);
create index if not exists movies_created_at_idx on public.movies(created_at);

alter table public.movies enable row level security;

drop policy if exists "Public can read published movies" on public.movies;
create policy "Public can read published movies"
on public.movies
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all movies" on public.movies;
create policy "Admins can read all movies"
on public.movies
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can manage movies" on public.movies;
create policy "Admins can manage movies"
on public.movies
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
