-- Safe support for AI import match confidence and quality scoring.
-- No existing rows, tables, or columns are deleted or reset.

alter table public.movies
  add column if not exists metadata_source text,
  add column if not exists metadata_confidence numeric,
  add column if not exists quality_score numeric;

create index if not exists movies_metadata_confidence_idx
  on public.movies(metadata_confidence);

notify pgrst, 'reload schema';
