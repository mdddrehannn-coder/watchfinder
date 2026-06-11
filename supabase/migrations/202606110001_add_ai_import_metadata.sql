-- Optional AI import metadata support for WatchFinder Admin AI Assistant.
-- Safe migration only: no data is deleted, reset, dropped, or rewritten.

alter table public.movies
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

alter table public.web_series
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

create index if not exists movies_tmdb_id_idx on public.movies(tmdb_id);
create index if not exists movies_imdb_id_idx on public.movies(imdb_id);
create index if not exists web_series_tmdb_id_idx on public.web_series(tmdb_id);
create index if not exists web_series_imdb_id_idx on public.web_series(imdb_id);

notify pgrst, 'reload schema';
