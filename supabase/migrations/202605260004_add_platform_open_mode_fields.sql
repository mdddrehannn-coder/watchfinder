-- Safe optional fields for official platform launch behavior.
-- No data is deleted or rewritten.

alter table public.movie_platform_links
  add column if not exists platform_home_url text,
  add column if not exists platform_search_url text,
  add column if not exists app_deeplink text,
  add column if not exists open_mode text default 'in_app_browser';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movie_platform_links_open_mode_check'
      and conrelid = 'public.movie_platform_links'::regclass
  ) then
    alter table public.movie_platform_links
      add constraint movie_platform_links_open_mode_check
      check (open_mode in ('trailer_modal', 'in_app_browser', 'external'));
  end if;
end $$;

create index if not exists movie_platform_links_open_mode_idx on public.movie_platform_links(open_mode);
