alter table public.movies
  add column if not exists popularity_score numeric default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'movies'
      and column_name = 'popularity_score'
      and data_type <> 'numeric'
  ) then
    alter table public.movies
      alter column popularity_score type numeric
      using (
        case
          when popularity_score is null then null
          when popularity_score::text ~ '^-?[0-9]+(\.[0-9]+)?$' then popularity_score::text::numeric
          else 0
        end
      );
  end if;

  alter table public.movies
    alter column popularity_score set default 0;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'movies'
      and column_name = 'popularity'
      and data_type <> 'numeric'
  ) then
    alter table public.movies
      alter column popularity type numeric
      using (
        case
          when popularity is null then null
          when popularity::text ~ '^-?[0-9]+(\.[0-9]+)?$' then popularity::text::numeric
          else 0
        end
      );
  end if;
end $$;

notify pgrst, 'reload schema';
