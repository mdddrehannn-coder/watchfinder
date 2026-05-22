create table if not exists public.content_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  channel_type text not null check (channel_type in ('cartoon', 'tv_show')),
  logo_url text null,
  description text null,
  official_url text null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.content_channel_items (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.content_channels(id) on delete cascade,
  movie_id uuid not null references public.movies(id) on delete cascade,
  created_at timestamptz default now(),
  unique(channel_id, movie_id)
);

create index if not exists content_channels_channel_type_idx on public.content_channels(channel_type);
create index if not exists content_channels_slug_idx on public.content_channels(slug);
create index if not exists content_channels_is_active_idx on public.content_channels(is_active);
create index if not exists content_channel_items_channel_id_idx on public.content_channel_items(channel_id);
create index if not exists content_channel_items_movie_id_idx on public.content_channel_items(movie_id);

alter table public.content_channels enable row level security;
alter table public.content_channel_items enable row level security;

drop policy if exists "Public can read active content channels" on public.content_channels;
create policy "Public can read active content channels"
on public.content_channels
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage content channels" on public.content_channels;
create policy "Admins can manage content channels"
on public.content_channels
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

drop policy if exists "Public can read active channel items" on public.content_channel_items;
create policy "Public can read active channel items"
on public.content_channel_items
for select
to anon, authenticated
using (
  exists (
    select 1 from public.content_channels
    where content_channels.id = content_channel_items.channel_id
      and content_channels.is_active = true
  )
);

drop policy if exists "Admins can manage channel items" on public.content_channel_items;
create policy "Admins can manage channel items"
on public.content_channel_items
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

insert into public.content_channels (name, slug, channel_type, description, sort_order)
values
  ('Hungama', 'hungama', 'cartoon', 'Cartoon shows and official links.', 10),
  ('Disney', 'disney', 'cartoon', 'Cartoon shows and official links.', 20),
  ('Cartoon Network', 'cartoon-network', 'cartoon', 'Cartoon shows and official links.', 30),
  ('Pogo', 'pogo', 'cartoon', 'Cartoon shows and official links.', 40),
  ('Nickelodeon', 'nickelodeon', 'cartoon', 'Cartoon shows and official links.', 50),
  ('Sonic', 'sonic', 'cartoon', 'Cartoon shows and official links.', 60),
  ('Discovery Kids', 'discovery-kids', 'cartoon', 'Cartoon shows and official links.', 70),
  ('Sony Yay', 'sony-yay', 'cartoon', 'Cartoon shows and official links.', 80),
  ('Official YouTube', 'official-youtube-cartoons', 'cartoon', 'Official cartoon channels and YouTube links.', 90),
  ('Sony SAB', 'sony-sab', 'tv_show', 'TV shows and official links.', 10),
  ('Star Plus', 'star-plus', 'tv_show', 'TV shows and official links.', 20),
  ('Colors', 'colors', 'tv_show', 'TV shows and official links.', 30),
  ('Zee TV', 'zee-tv', 'tv_show', 'TV shows and official links.', 40),
  ('Sony Entertainment Television', 'sony-entertainment-television', 'tv_show', 'TV shows and official links.', 50),
  ('MTV', 'mtv', 'tv_show', 'TV shows and official links.', 60),
  ('Discovery', 'discovery', 'tv_show', 'TV shows and official links.', 70),
  ('National Geographic', 'national-geographic', 'tv_show', 'TV shows and official links.', 80),
  ('History TV18', 'history-tv18', 'tv_show', 'TV shows and official links.', 90),
  ('Official YouTube', 'official-youtube-shows', 'tv_show', 'Official TV show channels and YouTube links.', 100)
on conflict (slug) do nothing;
