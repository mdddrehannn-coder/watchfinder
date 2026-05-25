import Link from "next/link";

export type InfoSection = {
  title: string;
  body: string;
};

export default function InfoPageShell({
  title,
  subtitle,
  sections,
  cta
}: {
  title: string;
  subtitle: string;
  sections: InfoSection[];
  cta?: { label: string; href: string };
}) {
  return (
    <main className="page-inner">
      <section className="section info-hero">
        <p className="rating-badge">WatchFinder</p>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {cta ? (
          <Link className="button primary" href={cta.href}>
            {cta.label}
          </Link>
        ) : null}
      </section>
      <section className="section info-page-grid">
        {sections.map((section) => (
          <article className="panel info-panel" key={section.title}>
            <h2>{section.title}</h2>
            <p className="muted">{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
