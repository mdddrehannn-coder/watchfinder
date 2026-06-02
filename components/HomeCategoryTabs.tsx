import Link from "next/link";

const tabs = [
  { label: "Recommend", href: "/" },
  { label: "Movies", href: "/movies" },
  { label: "TV Shows", href: "/tv-shows" },
  { label: "Anime", href: "/anime" },
  { label: "Cartoons", href: "/cartoons" }
];

export default function HomeCategoryTabs() {
  return (
    <nav className="home-category-tabs" aria-label="Homepage categories">
      {tabs.map((tab, index) => (
        <Link className={index === 0 ? "active" : ""} href={tab.href} key={tab.href}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
