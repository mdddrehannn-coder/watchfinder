export type MovieType = "movie" | "tv_show" | "anime" | "short_film" | "cartoon";
export type MovieStatus = "draft" | "published" | "archived" | "hidden";
export type SeriesStatus = "draft" | "published" | "archived";
export type VideoProvider =
  | "direct"
  | "youtube"
  | "vimeo"
  | "embed"
  | "iframe"
  | "hls"
  | "m3u8"
  | "google_drive"
  | "other"
  | "cloudflare_stream"
  | "youtube_embed"
  | "supabase_storage_small_video"
  | "external_legal_embed"
  | "external_ott_link";

export type Profile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: "user" | "admin" | string | null;
  language_preference?: string | null;
};

export type Genre = {
  id: string;
  name: string;
  slug: string;
};

export type Platform = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  website_url?: string | null;
  description?: string | null;
  is_active?: boolean | null;
};

export type CastMember = {
  id: string;
  name: string;
  slug?: string | null;
  photo_url?: string | null;
  role_label?: string | null;
};

export type Movie = {
  id: string;
  title: string;
  slug: string;
  type: MovieType | string;
  description?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  release_year?: number | null;
  duration_minutes?: number | null;
  rating?: number | null;
  language?: string | null;
  director?: string | null;
  trailer_url?: string | null;
  trailer_provider?: string | null;
  is_trending?: boolean | null;
  is_featured?: boolean | null;
  is_latest?: boolean | null;
  popularity_score?: number | null;
  status?: MovieStatus | string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
  has_licensed_video?: boolean | null;
  video_provider?: VideoProvider | string | null;
  video_embed_url?: string | null;
  video_id?: string | null;
  license_type?: string | null;
  license_owner_name?: string | null;
  license_start_date?: string | null;
  license_expiry_date?: string | null;
  license_notes?: string | null;
  distribution_territory?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  genres?: Genre[];
  cast_members?: CastMember[];
  movie_platform_links?: MoviePlatformLink[];
  content_channels?: ContentChannel[];
  content_channel_items?: ContentChannelItem[];
};

export type Episode = {
  id: string;
  season_id: string;
  series_id: string;
  episode_number: number;
  title: string;
  description?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  thumbnail_url?: string | null;
  trailer_url?: string | null;
  video_embed_url?: string | null;
  watch_url?: string | null;
  video_url: string;
  video_provider?: VideoProvider | string | null;
  platform_name?: string | null;
  availability_type?: string | null;
  language?: string | null;
  quality?: string | null;
  duration_minutes?: number | null;
  duration?: string | null;
  release_date?: string | null;
  status?: SeriesStatus | string | null;
  sort_order?: number | null;
  is_published?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Season = {
  id: string;
  series_id: string;
  season_number: number;
  title?: string | null;
  description?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  release_year?: number | null;
  status?: SeriesStatus | string | null;
  sort_order?: number | null;
  is_published?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  episodes?: Episode[];
};

export type Series = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  poster_url?: string | null;
  banner_url?: string | null;
  genre?: string | null;
  platform_name?: string | null;
  language?: string | null;
  release_year?: number | null;
  rating?: string | null;
  status?: SeriesStatus | string | null;
  trailer_url?: string | null;
  video_embed_url?: string | null;
  video_provider?: VideoProvider | string | null;
  is_featured?: boolean | null;
  is_latest?: boolean | null;
  is_trending?: boolean | null;
  is_hindi_dubbed?: boolean | null;
  is_free_legal?: boolean | null;
  is_official?: boolean | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_published?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  seasons?: Season[];
  season_count?: number;
  episode_count?: number;
};

export type ContentChannelType = "cartoon" | "tv_show";

export type ContentChannel = {
  id: string;
  name: string;
  slug: string;
  channel_type: ContentChannelType | string;
  logo_url?: string | null;
  description?: string | null;
  official_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  item_count?: number;
};

export type ContentChannelItem = {
  id: string;
  channel_id: string;
  movie_id: string;
  season_number?: number | null;
  episode_number?: number | null;
  episode_title?: string | null;
  playlist_group?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  content_channels?: ContentChannel | null;
  movies?: Movie | null;
};

export type MoviePlatformLink = {
  id: string;
  movie_id: string;
  platform_id: string;
  watch_url?: string | null;
  platform_home_url?: string | null;
  platform_search_url?: string | null;
  app_deeplink?: string | null;
  app_store_url?: string | null;
  play_store_url?: string | null;
  fallback_note?: string | null;
  mobile_web_supported?: "unknown" | "yes" | "no" | string | null;
  desktop_web_supported?: "unknown" | "yes" | "no" | string | null;
  app_required?: boolean | null;
  link_type?: string | null;
  open_mode?: string | null;
  availability_type?: string | null;
  language?: string | null;
  quality?: string | null;
  notes?: string | null;
  is_official?: boolean | null;
  is_active?: boolean | null;
  platforms?: Platform | null;
};

export type Promotion = {
  id: string;
  title: string;
  description?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  placement: string;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean | null;
  priority?: number | null;
};

export type AdSlot = {
  id: string;
  slot_name: string;
  placement: string;
  ad_code?: string | null;
  is_active?: boolean | null;
  notes?: string | null;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  featured_image_url?: string | null;
  content?: string | null;
  excerpt?: string | null;
  category?: string | null;
  tags?: string[] | string | null;
  status?: MovieStatus | string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  published_at?: string | null;
};

export type FeedbackMessage = {
  id: string;
  name?: string | null;
  email?: string | null;
  subject?: string | null;
  message: string;
  status?: string | null;
  created_at?: string | null;
};

export type LicenseDocument = {
  id: string;
  movie_id?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  license_type?: string | null;
  owner_name?: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  created_at?: string | null;
};

export type SiteSetting = {
  id: string;
  key?: string | null;
  value?: string | null;
};

export type SelectOption = {
  label: string;
  value: string;
};
