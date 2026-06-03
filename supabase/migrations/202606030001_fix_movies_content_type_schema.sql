-- Safe fix for Admin Add Content uploads.
-- Adds the content_type column used by Movie, Trailer, TV Show, Cartoon, and Short Film saves.

alter table public.movies
add column if not exists content_type text default 'movie';

update public.movies
set content_type = 'movie'
where content_type is null;

create index if not exists movies_content_type_idx
on public.movies(content_type);

notify pgrst, 'reload schema';
