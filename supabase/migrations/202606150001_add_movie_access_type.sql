alter table public.movies
  add column if not exists access_type text default 'unknown';

update public.movies
set access_type = 'unknown'
where access_type is null or trim(access_type) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movies_access_type_check'
      and conrelid = 'public.movies'::regclass
  ) then
    alter table public.movies
      add constraint movies_access_type_check
      check (access_type in ('free', 'subscription', 'rent_buy', 'unknown'));
  end if;
end $$;

create index if not exists movies_access_type_idx
  on public.movies(access_type);

notify pgrst, 'reload schema';
