alter table public.movie_platform_links
  add column if not exists link_type text default 'direct_title_page',
  add column if not exists notes text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movie_platform_links_link_type_check'
      and conrelid = 'public.movie_platform_links'::regclass
  ) then
    alter table public.movie_platform_links
      add constraint movie_platform_links_link_type_check
      check (
        link_type in (
          'direct_title_page',
          'platform_search',
          'platform_home',
          'app_deeplink'
        )
      );
  end if;
end $$;

create index if not exists movie_platform_links_link_type_idx on public.movie_platform_links(link_type);
