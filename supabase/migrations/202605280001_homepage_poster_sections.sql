-- Safe homepage placement fields. No content is deleted or reset.

alter table public.movies
  add column if not exists content_type text default 'movie',
  add column if not exists primary_section text default 'recently_added',
  add column if not exists show_in_hero boolean default false,
  add column if not exists primary_language text,
  add column if not exists languages_json jsonb default '[]'::jsonb,
  add column if not exists platform_name text,
  add column if not exists updated_at timestamptz default now();

update public.movies
set content_type = coalesce(nullif(trim(content_type), ''), type, 'movie')
where content_type is null or trim(content_type) = '';

update public.movies
set primary_section = case
  when is_trending = true then 'trending'
  when is_latest = true then 'recently_added'
  when type = 'cartoon' then 'cartoon'
  when type = 'tv_show' then 'tv_show'
  else coalesce(nullif(primary_section, ''), 'recently_added')
end
where primary_section is null or trim(primary_section) = '';

update public.movies
set show_in_hero = true
where show_in_hero is false and is_featured = true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movies_primary_section_check'
      and conrelid = 'public.movies'::regclass
  ) then
    alter table public.movies
      add constraint movies_primary_section_check
      check (primary_section in (
        'none',
        'hero',
        'trending',
        'recently_added',
        'ott_release',
        'hindi_dubbed',
        'free_legal',
        'official_youtube',
        'web_series',
        'cartoon',
        'tv_show',
        'platform_only'
      ));
  end if;
end $$;

create index if not exists movies_primary_section_idx on public.movies(primary_section);
create index if not exists movies_show_in_hero_idx on public.movies(show_in_hero);
create index if not exists movies_content_type_idx on public.movies(content_type);
create index if not exists movies_created_at_desc_idx on public.movies(created_at desc);
