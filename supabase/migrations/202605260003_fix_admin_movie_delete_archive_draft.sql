-- Safe admin policies for movie delete/archive/draft/publish actions.
-- This migration does not delete, reset, truncate, or rewrite production data.

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'movies',
    'movie_genres',
    'movie_platform_links',
    'movie_cast',
    'content_channel_items',
    'license_documents'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is not null then
      execute format('alter table public.%I enable row level security', target_table);

      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = target_table
          and policyname = 'Admins can manage ' || target_table
      ) then
        execute format(
          'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = %L)) with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = %L))',
          'Admins can manage ' || target_table,
          target_table,
          'admin',
          'admin'
        );
      end if;
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.analytics_events') is not null then
    alter table public.analytics_events enable row level security;

    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'analytics_events'
        and policyname = 'Admins can update analytics events'
    ) then
      create policy "Admins can update analytics events"
      on public.analytics_events
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      )
      with check (
        exists (
          select 1
          from public.profiles
          where profiles.id = auth.uid()
            and profiles.role = 'admin'
        )
      );
    end if;
  end if;
end $$;
