-- Safe AI import one-link schema support.
-- No tables or existing movie data are deleted, reset, dropped, or renamed.

alter table public.movies
  add column if not exists official_watch_url text,
  add column if not exists tmdb_id integer,
  add column if not exists imdb_id text,
  add column if not exists ai_import_source text,
  add column if not exists ai_import_payload jsonb,
  add column if not exists tagline text,
  add column if not exists original_language text,
  add column if not exists country text,
  add column if not exists budget bigint,
  add column if not exists revenue bigint,
  add column if not exists vote_count integer,
  add column if not exists age_rating text,
  add column if not exists production_companies_json jsonb default '[]'::jsonb,
  add column if not exists external_ids_json jsonb default '{}'::jsonb;

update public.movies
set official_watch_url = watch_url
where official_watch_url is null
  and watch_url is not null;

create index if not exists movies_official_watch_url_idx on public.movies(official_watch_url);
create index if not exists movies_tmdb_id_idx on public.movies(tmdb_id);
create index if not exists movies_imdb_id_idx on public.movies(imdb_id);

alter table public.web_series
  add column if not exists official_watch_url text,
  add column if not exists watch_url text,
  add column if not exists official_platform text,
  add column if not exists open_mode text default 'auto';

update public.web_series
set official_watch_url = watch_url
where official_watch_url is null
  and watch_url is not null;

create index if not exists web_series_official_watch_url_idx on public.web_series(official_watch_url);

notify pgrst, 'reload schema';
