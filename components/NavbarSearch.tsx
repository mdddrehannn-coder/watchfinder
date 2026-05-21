"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { splitLanguages } from "@/lib/languages";

type Suggestion = {
  id: string;
  title: string;
  slug: string;
  poster_url?: string | null;
  release_year?: number | null;
  language?: string | null;
};

export default function NavbarSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal
        });
        const data = await response.json();
        setResults(data.results || []);
        setOpen(true);
      } catch (error) {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      router.push("/search");
      return;
    }
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form className="navbar-search" onSubmit={submit} ref={wrapperRef} role="search">
      <label className="search-pill navbar-search-pill">
        <Search size={18} />
        <input
          aria-label="Search movies, shows, languages and platforms"
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(Boolean(event.target.value.trim()));
          }}
          onFocus={() => setOpen(Boolean(query.trim()))}
          placeholder="Search movies, shows, platforms"
          value={query}
        />
      </label>
      {open ? (
        <div className="search-suggestions">
          {loading ? <p className="muted search-suggestion-note">Searching...</p> : null}
          {!loading && results.length ? (
            results.map((movie) => {
              const language = splitLanguages(movie.language).slice(0, 2).join(", ");
              return (
                <Link
                  className="search-suggestion"
                  href={`/movie/${movie.slug}`}
                  key={movie.id}
                  onClick={() => setOpen(false)}
                >
                  <span className="search-suggestion-thumb">
                    {movie.poster_url ? <img src={movie.poster_url} alt="" /> : <span>{movie.title.slice(0, 1)}</span>}
                  </span>
                  <span className="search-suggestion-copy">
                    <strong>{movie.title}</strong>
                    <small>{[movie.release_year, language].filter(Boolean).join(" • ") || "WatchFinder title"}</small>
                  </span>
                </Link>
              );
            })
          ) : null}
          {!loading && query.trim() && !results.length ? (
            <p className="muted search-suggestion-note">No quick matches. Press Enter to search.</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
