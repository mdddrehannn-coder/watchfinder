import { slugify } from "@/lib/format";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export const storageBuckets = {
  posters: "movie-posters",
  banners: "movie-banners",
  promotions: "promotion-banners",
  blogs: "blog-images",
  avatars: "avatars",
  licenses: "license-documents",
  smallVideos: "licensed-videos-small"
} as const;

export async function uploadPublicFile(bucket: string, path: string, file: File) {
  const supabase = createSupabaseBrowserClient();
  const extension = file.name.split(".").pop();
  const cleanPath = `${path}/${slugify(file.name.replace(/\.[^.]+$/, ""))}-${Date.now()}${extension ? `.${extension}` : ""}`;
  const { error } = await supabase.storage.from(bucket).upload(cleanPath, file, {
    cacheControl: "3600",
    upsert: true
  });

  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
  return data.publicUrl;
}

export const uploadPoster = (movieId: string, file: File) =>
  uploadPublicFile(storageBuckets.posters, `movies/${movieId}/poster`, file);

export const uploadBanner = (movieId: string, file: File) =>
  uploadPublicFile(storageBuckets.banners, `movies/${movieId}/banner`, file);

export const uploadPromotionBanner = (promotionId: string, file: File) =>
  uploadPublicFile(storageBuckets.promotions, `promotions/${promotionId}`, file);

export const uploadBlogImage = (blogId: string, file: File) =>
  uploadPublicFile(storageBuckets.blogs, `blogs/${blogId}`, file);

export const uploadLicenseDocument = (movieId: string, file: File) =>
  uploadPublicFile(storageBuckets.licenses, `licenses/${movieId}`, file);

export const uploadAvatar = (userId: string, file: File) =>
  uploadPublicFile(storageBuckets.avatars, `avatars/${userId}`, file);
