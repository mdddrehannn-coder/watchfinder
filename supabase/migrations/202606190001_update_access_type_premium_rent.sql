alter table public.movies
  add column if not exists access_type text default 'unknown';

update public.movies
set access_type = case
  when lower(trim(access_type)) in ('subscription', 'premium', 'paid', 'subscribed') then 'premium'
  when lower(trim(access_type)) in ('rent_buy', 'rent', 'buy', 'rental', 'purchase') then 'rent'
  when lower(trim(access_type)) = 'free' then 'free'
  else 'unknown'
end
where access_type is null
  or lower(trim(access_type)) not in ('free', 'premium', 'rent', 'unknown');

alter table public.movies
  drop constraint if exists movies_access_type_check;

alter table public.movies
  add constraint movies_access_type_check
  check (access_type in ('free', 'premium', 'rent', 'unknown'));

create index if not exists movies_access_type_idx
  on public.movies(access_type);

notify pgrst, 'reload schema';
