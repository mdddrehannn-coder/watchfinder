import type { Genre, Platform } from "@/types/watchfinder";
import { WATCHFINDER_LANGUAGES } from "@/lib/languages";

export default function SearchFilters({
  genres,
  platforms,
  defaults = {},
  showDiscoveryFilters = false
}: {
  genres: Genre[];
  platforms: Platform[];
  defaults?: Record<string, string | undefined>;
  showDiscoveryFilters?: boolean;
}) {
  return (
    <div className="form-grid two">
      <div className="field">
        <label htmlFor="type">Type</label>
        <select id="type" name="type" defaultValue={defaults.type || ""}>
          <option value="">All</option>
          <option value="movie">Movie</option>
          <option value="tv_show">TV Show</option>
          <option value="anime">Anime</option>
          <option value="short_film">Short Film</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="language">Language</label>
        <select id="language" name="language" defaultValue={defaults.language || ""}>
          <option value="">All languages</option>
          {WATCHFINDER_LANGUAGES.map((language) => (
            <option value={language} key={language}>
              {language}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="genre">Genre</label>
        <select id="genre" name="genre" defaultValue={defaults.genre || ""}>
          <option value="">All genres</option>
          {genres.map((genre) => (
            <option value={genre.slug} key={genre.id}>
              {genre.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="year">Year</label>
        <input id="year" name="year" inputMode="numeric" placeholder="2026" defaultValue={defaults.year || ""} />
      </div>
      <div className="field">
        <label htmlFor="platform">Platform</label>
        <select id="platform" name="platform" defaultValue={defaults.platform || ""}>
          <option value="">All platforms</option>
          {platforms.map((platform) => (
            <option value={platform.slug} key={platform.id}>
              {platform.name}
            </option>
          ))}
        </select>
      </div>
      {showDiscoveryFilters ? (
        <>
          <div className="field">
            <label htmlFor="availability">Availability</label>
            <select id="availability" name="availability" defaultValue={defaults.availability || ""}>
              <option value="">Any availability</option>
              <option value="free">Free</option>
              <option value="official">Official</option>
              <option value="subscription">Subscription</option>
              <option value="rent">Rent</option>
              <option value="buy">Buy</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="quality">Quality</label>
            <select id="quality" name="quality" defaultValue={defaults.quality || ""}>
              <option value="">Any quality</option>
              <option value="720p HD">720p HD</option>
              <option value="1080p Full HD">1080p Full HD</option>
              <option value="2160p 4K">2160p 4K</option>
              <option value="HDR">HDR</option>
              <option value="Dolby Vision">Dolby Vision</option>
            </select>
          </div>
        </>
      ) : null}
      <button className="button primary" type="submit">
        Apply filters
      </button>
    </div>
  );
}
