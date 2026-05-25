create table if not exists public.content_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  channel_type text not null,
  logo_url text null,
  description text null,
  official_url text null,
  sort_order integer default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.content_channels
  add column if not exists logo_url text null,
  add column if not exists description text null,
  add column if not exists official_url text null,
  add column if not exists sort_order integer default 0,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_channels_channel_type_check'
      and conrelid = 'public.content_channels'::regclass
  ) then
    alter table public.content_channels
      add constraint content_channels_channel_type_check
      check (channel_type in ('cartoon', 'tv_show'));
  end if;
end $$;

create table if not exists public.content_channel_items (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.content_channels(id) on delete cascade,
  movie_id uuid references public.movies(id) on delete cascade,
  season_number integer null,
  episode_number integer null,
  episode_title text null,
  playlist_group text null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table public.content_channel_items
  add column if not exists season_number integer null,
  add column if not exists episode_number integer null,
  add column if not exists episode_title text null,
  add column if not exists playlist_group text null,
  add column if not exists sort_order integer default 0,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_channel_items_channel_id_movie_id_key'
      and conrelid = 'public.content_channel_items'::regclass
  ) then
    alter table public.content_channel_items
      add constraint content_channel_items_channel_id_movie_id_key
      unique (channel_id, movie_id);
  end if;
end $$;

create index if not exists content_channels_channel_type_idx on public.content_channels(channel_type);
create index if not exists content_channels_slug_idx on public.content_channels(slug);
create index if not exists content_channels_is_active_idx on public.content_channels(is_active);
create index if not exists content_channel_items_channel_id_idx on public.content_channel_items(channel_id);
create index if not exists content_channel_items_movie_id_idx on public.content_channel_items(movie_id);
create index if not exists content_channel_items_season_number_idx on public.content_channel_items(season_number);
create index if not exists content_channel_items_episode_number_idx on public.content_channel_items(episode_number);

alter table public.content_channels enable row level security;
alter table public.content_channel_items enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_channels'
      and policyname = 'Public can read active content channels'
  ) then
    execute $policy$
      alter policy "Public can read active content channels"
      on public.content_channels
      to anon, authenticated
      using (is_active = true)
    $policy$;
  else
    execute $policy$
      create policy "Public can read active content channels"
      on public.content_channels
      for select
      to anon, authenticated
      using (is_active = true)
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_channels'
      and policyname = 'Admins can manage content channels'
  ) then
    execute $policy$
      alter policy "Admins can manage content channels"
      on public.content_channels
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
      )
    $policy$;
  else
    execute $policy$
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
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_channel_items'
      and policyname = 'Public can read active channel items'
  ) then
    execute $policy$
      alter policy "Public can read active channel items"
      on public.content_channel_items
      to anon, authenticated
      using (
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
      )
    $policy$;
  else
    execute $policy$
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
        and exists (
          select 1 from public.movies
          where movies.id = content_channel_items.movie_id
            and movies.status = 'published'
        )
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'content_channel_items'
      and policyname = 'Admins can manage channel items'
  ) then
    execute $policy$
      alter policy "Admins can manage channel items"
      on public.content_channel_items
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
      )
    $policy$;
  else
    execute $policy$
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
      )
    $policy$;
  end if;
end $$;

insert into public.content_channels (name, slug, channel_type, description, sort_order)
values
  ('Hungama', 'hungama', 'cartoon', 'Anime and kids cartoons in Indian languages.', 10),
  ('Disney Channel', 'disney-channel', 'cartoon', 'Cartoon shows and kids favorites.', 20),
  ('Cartoon Network', 'cartoon-network', 'cartoon', 'Cartoon classics and animated shows.', 30),
  ('Pogo', 'pogo', 'cartoon', 'Kids shows, classics, and Indian cartoons.', 40),
  ('Nickelodeon', 'nickelodeon', 'cartoon', 'Cartoon shows and comedy favorites.', 50),
  ('Sonic', 'sonic', 'cartoon', 'Kids comedy, action, and animated shows.', 60),
  ('Sony YAY!', 'sony-yay', 'cartoon', 'Kids cartoons and animated shows.', 70),
  ('Discovery Kids', 'discovery-kids', 'cartoon', 'Educational cartoons and kids shows.', 80),
  ('ETV Bal Bharat', 'etv-bal-bharat', 'cartoon', 'Indian kids cartoons and animated shows.', 90),
  ('Nick Jr.', 'nick-jr', 'cartoon', 'Preschool cartoons and kids favorites.', 100),
  ('YouTube Official Kids', 'youtube-official-kids', 'cartoon', 'Official cartoon clips and episodes.', 110),
  ('Star Plus', 'star-plus', 'tv_show', 'Hindi family dramas and reality shows.', 10),
  ('Sony SAB', 'sony-sab', 'tv_show', 'Comedy and family entertainment shows.', 20),
  ('Sony Entertainment Television', 'sony-entertainment-television', 'tv_show', 'Hindi entertainment and reality programming.', 30),
  ('Zee TV', 'zee-tv', 'tv_show', 'Hindi TV serials and entertainment.', 40),
  ('Colors TV', 'colors-tv', 'tv_show', 'Hindi entertainment and reality shows.', 50),
  ('Dangal TV', 'dangal-tv', 'tv_show', 'Hindi serials and family entertainment.', 60),
  ('DD National', 'dd-national', 'tv_show', 'Classic and public broadcast TV shows.', 70),
  ('MTV India', 'mtv-india', 'tv_show', 'Youth shows, music, and reality programming.', 80),
  ('Discovery', 'discovery', 'tv_show', 'Documentary and factual shows.', 90),
  ('National Geographic', 'national-geographic', 'tv_show', 'Science, nature, and factual shows.', 100),
  ('History TV18', 'history-tv18', 'tv_show', 'History, documentary, and factual shows.', 110),
  ('YouTube Official Shows', 'youtube-official-shows', 'tv_show', 'Official TV show clips and episodes.', 120)
on conflict (slug) do update set
  name = excluded.name,
  channel_type = excluded.channel_type,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();
