alter table public.analytics_sessions
  add column if not exists current_page text null,
  add column if not exists device_type text null,
  add column if not exists browser_name text null;

alter table public.analytics_events enable row level security;
alter table public.analytics_sessions enable row level security;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'Anyone can insert analytics events'
  ) then
    execute $policy$
      alter policy "Anyone can insert analytics events"
      on public.analytics_events
      to anon, authenticated
      with check (true)
    $policy$;
  else
    execute $policy$
      create policy "Anyone can insert analytics events"
      on public.analytics_events
      for insert
      to anon, authenticated
      with check (true)
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_sessions'
      and policyname = 'Anyone can insert analytics sessions'
  ) then
    execute $policy$
      alter policy "Anyone can insert analytics sessions"
      on public.analytics_sessions
      to anon, authenticated
      with check (true)
    $policy$;
  else
    execute $policy$
      create policy "Anyone can insert analytics sessions"
      on public.analytics_sessions
      for insert
      to anon, authenticated
      with check (true)
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_sessions'
      and policyname = 'Anyone can update analytics sessions'
  ) then
    execute $policy$
      alter policy "Anyone can update analytics sessions"
      on public.analytics_sessions
      to anon, authenticated
      using (true)
      with check (true)
    $policy$;
  else
    execute $policy$
      create policy "Anyone can update analytics sessions"
      on public.analytics_sessions
      for update
      to anon, authenticated
      using (true)
      with check (true)
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_events'
      and policyname = 'Admins can read analytics events'
  ) then
    execute $policy$
      alter policy "Admins can read analytics events"
      on public.analytics_events
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
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
      )
    $policy$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'analytics_sessions'
      and policyname = 'Admins can read analytics sessions'
  ) then
    execute $policy$
      alter policy "Admins can read analytics sessions"
      on public.analytics_sessions
      to authenticated
      using (
        exists (
          select 1 from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
    $policy$;
  else
    execute $policy$
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
      )
    $policy$;
  end if;
end $$;

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

create index if not exists analytics_events_event_type_idx on public.analytics_events(event_type);
create index if not exists analytics_events_created_at_idx on public.analytics_events(created_at);
create index if not exists analytics_sessions_last_seen_at_idx on public.analytics_sessions(last_seen_at);
create index if not exists analytics_sessions_current_page_idx on public.analytics_sessions(current_page);
