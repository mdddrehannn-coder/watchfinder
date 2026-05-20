import Link from "next/link";
import type { Promotion } from "@/types/watchfinder";

export default function HeroCarousel({ promotions }: { promotions: Promotion[] }) {
  const hero = promotions[0];

  if (!hero) {
    return (
      <section className="hero-card">
        <div className="hero-content">
          <p className="rating-badge">Legal OTT discovery</p>
          <h1>WatchFinder</h1>
          <p className="muted">Find Movies, Web Series and OTT Updates in One Place</p>
          <Link className="button primary" href="/search">
            Start exploring
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-carousel">
      {hero.link_url ? (
        <Link className="hero-card" href={hero.link_url}>
          {hero.image_url ? <img src={hero.image_url} alt={hero.title} /> : null}
          <div className="hero-content">
            <p className="rating-badge">Featured</p>
            <h1>{hero.title}</h1>
            {hero.description ? <p>{hero.description}</p> : null}
          </div>
        </Link>
      ) : (
        <div className="hero-card">
          {hero.image_url ? <img src={hero.image_url} alt={hero.title} /> : null}
          <div className="hero-content">
            <p className="rating-badge">Featured</p>
            <h1>{hero.title}</h1>
            {hero.description ? <p>{hero.description}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
