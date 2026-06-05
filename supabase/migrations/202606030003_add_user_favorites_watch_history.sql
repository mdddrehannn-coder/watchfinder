create table if not exists public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  guest_id text null,
  content_id uuid null,
  content_slug text not null,
  content_type text default 'movie',
  title text,
  poster_url text,
  created_at timestamptz default now()
);

create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  guest_id text null,
  content_id uuid null,
  content_slug text not null,
  content_type text default 'movie',
  title text,
  poster_url text,
  platform_name text,
  last_action text,
  progress_seconds integer default 0,
  duration_seconds integer default 0,
  watch_count integer default 1,
  last_watched_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.user_favorites add column if not exists user_id uuid null;
alter table public.user_favorites add column if not exists guest_id text null;
alter table public.user_favorites add column if not exists content_id uuid null;
alter table public.user_favorites add column if not exists content_slug text;
alter table public.user_favorites add column if not exists content_type text default 'movie';
alter table public.user_favorites add column if not exists title text;
alter table public.user_favorites add column if not exists poster_url text;
alter table public.user_favorites add column if not exists created_at timestamptz default now();

alter table public.watch_history add column if not exists user_id uuid null;
alter table public.watch_history add column if not exists guest_id text null;
alter table public.watch_history add column if not exists movie_id uuid null;
alter table public.watch_history add column if not exists watched_at timestamptz null;
alter table public.watch_history add column if not exists content_id uuid null;
alter table public.watch_history add column if not exists content_slug text;
alter table public.watch_history add column if not exists content_type text default 'movie';
alter table public.watch_history add column if not exists title text;
alter table public.watch_history add column if not exists poster_url text;
alter table public.watch_history add column if not exists platform_name text;
alter table public.watch_history add column if not exists last_action text;
alter table public.watch_history add column if not exists progress_seconds integer default 0;
alter table public.watch_history add column if not exists duration_seconds integer default 0;
alter table public.watch_history add column if not exists watch_count integer default 1;
alter table public.watch_history add column if not exists last_watched_at timestamptz default now();
alter table public.watch_history add column if not exists created_at timestamptz default now();
alter table public.watch_history add column if not exists updated_at timestamptz default now();

update public.watch_history
set
  content_id = coalesce(content_id, movie_id),
  content_slug = coalesce(content_slug, movies.slug),
  content_type = coalesce(content_type, movies.type, 'movie'),
  title = coalesce(watch_history.title, movies.title),
  poster_url = coalesce(watch_history.poster_url, movies.poster_url),
  last_watched_at = coalesce(watch_history.last_watched_at, watch_history.watched_at, watch_history.created_at, now()),
  updated_at = coalesce(watch_history.updated_at, now())
from public.movies
where watch_history.movie_id = movies.id
  and (watch_history.content_slug is null or watch_history.content_id is null);

update public.watch_history
set
  content_slug = coalesce(content_slug, content_id::text, movie_id::text),
  content_type = coalesce(content_type, 'movie'),
  watch_count = greatest(coalesce(watch_count, 1), 1),
  progress_seconds = greatest(coalesce(progress_seconds, 0), 0),
  duration_seconds = greatest(coalesce(duration_seconds, 0), 0),
  last_watched_at = coalesce(last_watched_at, watched_at, created_at, now()),
  updated_at = coalesce(updated_at, now())
where content_slug is null
   or content_type is null
   or watch_count is null
   or progress_seconds is null
   or duration_seconds is null
   or last_watched_at is null;

create index if not exists user_favorites_user_id_idx on public.user_favorites(user_id);
create index if not exists user_favorites_guest_id_idx on public.user_favorites(guest_id);
create index if not exists user_favorites_content_slug_idx on public.user_favorites(content_slug);
create index if not exists watch_history_user_id_idx on public.watch_history(user_id);
create index if not exists watch_history_guest_id_idx on public.watch_history(guest_id);
create index if not exists watch_history_last_watched_at_idx on public.watch_history(last_watched_at desc);
create index if not exists watch_history_content_slug_idx on public.watch_history(content_slug);

do $$
begin
  if not exists (select 1 from pg_class where relname = 'user_favorites_user_content_unique_idx')
    and not exists (
      select 1
      from public.user_favorites
      where user_id is not null and content_slug is not null
      group by user_id, content_slug, content_type
      having count(*) > 1
    ) then
    create unique index user_favorites_user_content_unique_idx
      on public.user_favorites(user_id, content_slug, content_type)
      where user_id is not null and content_slug is not null;
  end if;

  if not exists (select 1 from pg_class where relname = 'user_favorites_guest_content_unique_idx')
    and not exists (
      select 1
      from public.user_favorites
      where guest_id is not null and content_slug is not null
      group by guest_id, content_slug, content_type
      having count(*) > 1
    ) then
    create unique index user_favorites_guest_content_unique_idx
      on public.user_favorites(guest_id, content_slug, content_type)
      where guest_id is not null and content_slug is not null;
  end if;

  if not exists (select 1 from pg_class where relname = 'watch_history_user_content_unique_idx')
    and not exists (
      select 1
      from public.watch_history
      where user_id is not null and content_slug is not null
      group by user_id, content_slug, content_type
      having count(*) > 1
    ) then
    create unique index watch_history_user_content_unique_idx
      on public.watch_history(user_id, content_slug, content_type)
      where user_id is not null and content_slug is not null;
  end if;

  if not exists (select 1 from pg_class where relname = 'watch_history_guest_content_unique_idx')
    and not exists (
      select 1
      from public.watch_history
      where guest_id is not null and content_slug is not null
      group by guest_id, content_slug, content_type
      having count(*) > 1
    ) then
    create unique index watch_history_guest_content_unique_idx
      on public.watch_history(guest_id, content_slug, content_type)
      where guest_id is not null and content_slug is not null;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'watch_history_set_updated_at') then
    create trigger watch_history_set_updated_at
      before update on public.watch_history
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.user_favorites enable row level security;
alter table public.watch_history enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_favorites' and policyname = 'Users can read own favorites') then
    create policy "Users can read own favorites"
      on public.user_favorites for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_favorites' and policyname = 'Users can insert own favorites') then
    create policy "Users can insert own favorites"
      on public.user_favorites for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_favorites' and policyname = 'Users can delete own favorites') then
    create policy "Users can delete own favorites"
      on public.user_favorites for delete to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_favorites' and policyname = 'Admins can manage favorites') then
    create policy "Admins can manage favorites"
      on public.user_favorites for all to authenticated
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
      with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'watch_history' and policyname = 'Users can read own watch history') then
    create policy "Users can read own watch history"
      on public.watch_history for select to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'watch_history' and policyname = 'Users can insert own watch history') then
    create policy "Users can insert own watch history"
      on public.watch_history for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'watch_history' and policyname = 'Users can update own watch history') then
    create policy "Users can update own watch history"
      on public.watch_history for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'watch_history' and policyname = 'Users can delete own watch history') then
    create policy "Users can delete own watch history"
      on public.watch_history for delete to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'watch_history' and policyname = 'Admins can manage watch history') then
    create policy "Admins can manage watch history"
      on public.watch_history for all to authenticated
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
      with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
  end if;
end $$;

notify pgrst, 'reload schema';
