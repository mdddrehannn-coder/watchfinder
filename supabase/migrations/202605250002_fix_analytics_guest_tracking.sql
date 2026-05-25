create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id uuid null references auth.users(id) on delete set null,
  anonymous_session_id text null,
  movie_id uuid null references public.movies(id) on delete set null,
  movie_slug text null,
  page_path text null,
  referrer text null,
  search_query text null,
  platform_name text null,
  video_provider text null,
  watch_seconds integer default 0,
  progress_percent integer null,
  device_type text null,
  browser_name text null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  anonymous_session_id text unique not null,
  user_id uuid null references auth.users(id) on delete set null,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  page_views integer default 0,
  total_watch_seconds integer default 0,
  current_page text null,
  device_type text null,
  browser_name text null
);

alter table public.analytics_sessions
  add column if not exists current_page text null,
  add column if not exists device_type text null,
  add column if not exists browser_name text null;

create index if not exists analytics_events_event_type_idx on public.analytics_events(event_type);
create index if not exists analytics_events_movie_id_idx on public.analytics_events(movie_id);
create index if not exists analytics_events_movie_slug_idx on public.analytics_events(movie_slug);
create index if not exists analytics_events_user_id_idx on public.analytics_events(user_id);
create index if not exists analytics_events_anonymous_session_id_idx on public.analytics_events(anonymous_session_id);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at);
create index if not exists analytics_events_page_path_idx on public.analytics_events(page_path);
create index if not exists analytics_sessions_anonymous_session_id_idx on public.analytics_sessions(anonymous_session_id);
create index if not exists analytics_sessions_user_id_idx on public.analytics_sessions(user_id);
create index if not exists analytics_sessions_last_seen_at_idx on public.analytics_sessions(last_seen_at);
create index if not exists analytics_sessions_current_page_idx on public.analytics_sessions(current_page);

alter table public.analytics_events enable row level security;
alter table public.analytics_sessions enable row level security;

drop policy if exists "Anyone can insert analytics events" on public.analytics_events;
create policy "Anyone can insert analytics events"
on public.analytics_events
for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can read analytics events" on public.analytics_events;
create policy "Admins can read analytics events"
on public.analytics_events
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Anyone can insert analytics sessions" on public.analytics_sessions;
create policy "Anyone can insert analytics sessions"
on public.analytics_sessions
for insert
to anon, authenticated
with check (true);

drop policy if exists "Anyone can update analytics sessions" on public.analytics_sessions;
create policy "Anyone can update analytics sessions"
on public.analytics_sessions
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Admins can read analytics sessions" on public.analytics_sessions;
create policy "Admins can read analytics sessions"
on public.analytics_sessions
for select
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

create or replace function public.record_analytics_session(
  p_anonymous_session_id text,
  p_user_id uuid,
  p_page_view_increment integer default 0,
  p_watch_seconds_increment integer default 0,
  p_device_type text default null,
  p_browser_name text default null,
  p_current_page text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.analytics_sessions (
    anonymous_session_id,
    user_id,
    first_seen_at,
    last_seen_at,
    page_views,
    total_watch_seconds,
    current_page,
    device_type,
    browser_name
  )
  values (
    p_anonymous_session_id,
    p_user_id,
    now(),
    now(),
    greatest(coalesce(p_page_view_increment, 0), 0),
    greatest(coalesce(p_watch_seconds_increment, 0), 0),
    p_current_page,
    p_device_type,
    p_browser_name
  )
  on conflict (anonymous_session_id)
  do update set
    user_id = coalesce(excluded.user_id, analytics_sessions.user_id),
    last_seen_at = now(),
    page_views = analytics_sessions.page_views + greatest(coalesce(p_page_view_increment, 0), 0),
    total_watch_seconds = analytics_sessions.total_watch_seconds + greatest(coalesce(p_watch_seconds_increment, 0), 0),
    current_page = coalesce(excluded.current_page, analytics_sessions.current_page),
    device_type = coalesce(excluded.device_type, analytics_sessions.device_type),
    browser_name = coalesce(excluded.browser_name, analytics_sessions.browser_name);
end;
$$;

grant execute on function public.record_analytics_session(text, uuid, integer, integer, text, text, text) to anon, authenticated;
