-- Safe compatibility fix for public.movies.video_provider.
-- This aligns admin saves with the production check constraint.
-- It does not delete, reset, truncate, or archive movie data.

alter table public.movies
  add column if not exists video_provider text;

update public.movies
set video_provider = case
  when video_provider is null then 'direct'
  when trim(video_provider) = '' then 'direct'
  when lower(trim(video_provider)) = 'direct' then 'direct'
  when lower(trim(video_provider)) in ('youtube', 'youtube_embed') then 'youtube'
  when lower(trim(video_provider)) = 'vimeo' then 'vimeo'
  when lower(trim(video_provider)) in ('embed', 'iframe', 'external_legal_embed') then 'embed'
  when lower(trim(video_provider)) in ('external_ott_link', 'cloudflare_stream', 'supabase_storage_small_video') then 'direct'
  else 'direct'
end
where video_provider is null
   or video_provider <> lower(trim(video_provider))
   or lower(trim(video_provider)) not in ('direct', 'youtube', 'vimeo', 'embed');

alter table public.movies
  alter column video_provider set default 'direct';

alter table public.movies
  drop constraint if exists movies_video_provider_check;

alter table public.movies
  add constraint movies_video_provider_check
  check (
    video_provider is null
    or video_provider in ('direct', 'youtube', 'vimeo', 'embed')
  );
