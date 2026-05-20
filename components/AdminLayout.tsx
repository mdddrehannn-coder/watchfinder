import Link from "next/link";

const sections = [
  "Dashboard overview",
  "Movies",
  "Add Movie",
  "Genres",
  "Platforms",
  "Cast Members",
  "Promotions",
  "Ad Slots",
  "Blog Posts",
  "Feedback Messages",
  "License Documents",
  "Site Settings"
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Admin sections">
        {sections.map((section) => (
          <a className="chip" href={`#${section.toLowerCase().replaceAll(" ", "-")}`} key={section}>
            {section}
          </a>
        ))}
        <Link className="chip" href="/">Public site</Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}
