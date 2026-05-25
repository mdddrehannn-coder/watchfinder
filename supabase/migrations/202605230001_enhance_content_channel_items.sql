alter table public.content_channel_items
  add column if not exists season_number integer null,
  add column if not exists episode_number integer null,
  add column if not exists episode_title text null,
  add column if not exists playlist_group text null,
  add column if not exists sort_order integer default 0;

create index if not exists content_channel_items_season_number_idx on public.content_channel_items(season_number);
create index if not exists content_channel_items_episode_number_idx on public.content_channel_items(episode_number);
create index if not exists content_channel_items_sort_order_idx on public.content_channel_items(sort_order);

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
  and exists (
    select 1 from public.movies
    where movies.id = content_channel_items.movie_id
      and movies.status = 'published'
  )
);

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
  description = excluded.description,
  sort_order = excluded.sort_order,
  channel_type = excluded.channel_type;
