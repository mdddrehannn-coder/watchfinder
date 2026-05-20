import type { Genre, Platform } from "@/types/watchfinder";

export default function SearchFilters({
  genres,
  platforms
}: {
  genres: Genre[];
  platforms: Platform[];
}) {
  return (
    <div className="form-grid two">
      <div className="field">
        <label htmlFor="type">Type</label>
        <select id="type" name="type">
          <option value="">All</option>
          <option value="movie">Movie</option>
          <option value="tv_show">TV Show</option>
          <option value="anime">Anime</option>
          <option value="short_film">Short Film</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="language">Language</label>
        <input id="language" name="language" placeholder="Hindi, English, Tamil" />
      </div>
      <div className="field">
        <label htmlFor="genre">Genre</label>
        <select id="genre" name="genre">
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
        <input id="year" name="year" inputMode="numeric" placeholder="2026" />
      </div>
      <div className="field">
        <label htmlFor="platform">Platform</label>
        <select id="platform" name="platform">
          <option value="">All platforms</option>
          {platforms.map((platform) => (
            <option value={platform.slug} key={platform.id}>
              {platform.name}
            </option>
          ))}
        </select>
      </div>
      <button className="button primary" type="submit">
        Apply filters
      </button>
    </div>
  );
}
