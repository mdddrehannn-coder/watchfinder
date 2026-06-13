-- Safe support for AI Auto Fill release dates.
-- No data is deleted, reset, dropped, or renamed.

alter table public.movies
  add column if not exists release_date date;

create index if not exists movies_release_date_idx on public.movies(release_date);

notify pgrst, 'reload schema';
