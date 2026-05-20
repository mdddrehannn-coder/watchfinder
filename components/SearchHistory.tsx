"use client";

import { useEffect, useState } from "react";

export default function SearchHistory({ currentQuery }: { currentQuery?: string }) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const existing = JSON.parse(localStorage.getItem("watchfinder-search-history") || "[]") as string[];
    const next = currentQuery
      ? [currentQuery, ...existing.filter((item) => item.toLowerCase() !== currentQuery.toLowerCase())].slice(0, 8)
      : existing;
    localStorage.setItem("watchfinder-search-history", JSON.stringify(next));
    setItems(next);
  }, [currentQuery]);

  if (!items.length) return null;

  return (
    <section className="section">
      <h2>Search History</h2>
      <div className="chip-row">
        {items.map((item) => (
          <a className="chip" href={`/search?q=${encodeURIComponent(item)}`} key={item}>
            {item}
          </a>
        ))}
      </div>
    </section>
  );
}
