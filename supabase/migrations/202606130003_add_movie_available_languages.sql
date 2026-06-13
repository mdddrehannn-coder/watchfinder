alter table public.movies
add column if not exists available_languages text[];

update public.movies
set available_languages = string_to_array(language, ',')
where available_languages is null
  and language is not null
  and length(trim(language)) > 0;

create index if not exists movies_available_languages_idx
on public.movies using gin (available_languages);

notify pgrst, 'reload schema';
