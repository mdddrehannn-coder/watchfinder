-- Safe OTT playback capability fields for official platform links.
-- No data is deleted or reset.

alter table public.movie_platform_links
  add column if not exists mobile_web_supported text default 'unknown',
  add column if not exists desktop_web_supported text default 'unknown',
  add column if not exists app_required boolean default false,
  add column if not exists app_deeplink text,
  add column if not exists app_store_url text,
  add column if not exists play_store_url text,
  add column if not exists fallback_note text;

update public.movie_platform_links
set mobile_web_supported = 'unknown'
where mobile_web_supported is null or trim(mobile_web_supported) = '';

update public.movie_platform_links
set desktop_web_supported = 'unknown'
where desktop_web_supported is null or trim(desktop_web_supported) = '';

update public.movie_platform_links
set app_required = false
where app_required is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'movie_platform_links_mobile_web_supported_check'
      and conrelid = 'public.movie_platform_links'::regclass
  ) then
    alter table public.movie_platform_links
      add constraint movie_platform_links_mobile_web_supported_check
      check (mobile_web_supported in ('unknown', 'yes', 'no'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'movie_platform_links_desktop_web_supported_check'
      and conrelid = 'public.movie_platform_links'::regclass
  ) then
    alter table public.movie_platform_links
      add constraint movie_platform_links_desktop_web_supported_check
      check (desktop_web_supported in ('unknown', 'yes', 'no'));
  end if;
end $$;

create index if not exists movie_platform_links_mobile_web_supported_idx on public.movie_platform_links(mobile_web_supported);
create index if not exists movie_platform_links_app_required_idx on public.movie_platform_links(app_required);
