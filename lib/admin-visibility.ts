import type { Movie } from "@/types/watchfinder";

export type MovieVisibilityCheck = {
  visibleOnPublicPages: boolean;
  visibleOnHomepageSlider: boolean;
  publicReasons: string[];
  homepageReasons: string[];
  warnings: string[];
};

function hasWatchLink(movie: Movie) {
  return Boolean(movie.movie_platform_links?.some((link) => link.is_active !== false && link.is_official !== false));
}

export function getMovieVisibilityCheck(movie: Movie): MovieVisibilityCheck {
  const status = movie.status || "draft";
  const visibleOnPublicPages = status === "published";
  const visibleOnHomepageSlider = visibleOnPublicPages && Boolean(movie.is_featured || movie.is_latest || movie.is_trending);
  const publicReasons: string[] = [];
  const homepageReasons: string[] = [];
  const warnings: string[] = [];

  if (status === "archived") publicReasons.push("Archived");
  else if (status === "hidden") publicReasons.push("Hidden");
  else if (status !== "published") publicReasons.push("Not published");
  else publicReasons.push("Visible on Movies and Search pages");

  if (!movie.poster_url) warnings.push("Missing poster");
  if (!movie.banner_url) warnings.push("Missing banner");
  if (!movie.trailer_url && !hasWatchLink(movie)) warnings.push("No trailer/watch link");

  if (!visibleOnPublicPages) {
    homepageReasons.push("Not visible publicly");
  } else if (!visibleOnHomepageSlider) {
    homepageReasons.push("Not featured/latest/trending");
  } else {
    homepageReasons.push("Visible on homepage slider");
  }

  return {
    visibleOnPublicPages,
    visibleOnHomepageSlider,
    publicReasons,
    homepageReasons,
    warnings
  };
}

export function getMovieSaveVisibilityMessage(movie: Movie) {
  const check = getMovieVisibilityCheck(movie);
  if (!check.visibleOnPublicPages) {
    return "Saved as draft/hidden. This will not appear publicly until status is Published.";
  }
  if (!check.visibleOnHomepageSlider) {
    return "Saved and visible on Movies/Search pages. Add Featured, Latest, or Trending to show on the homepage slider.";
  }
  return "Saved, visible publicly, and eligible for the homepage slider.";
}
