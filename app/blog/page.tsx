import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getBlogPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "OTT, Hindi Dubbed and Free Legal Movie Guides - WatchFinder",
  description: "Read WatchFinder guides for OTT releases, Hindi dubbed titles, free legal movies, where-to-watch help and public-domain classics."
};

export default async function BlogPage() {
  const posts = await getBlogPosts(60);
  return (
    <main className="page-inner">
      <section className="discover-hero">
        <p className="rating-badge">Guides</p>
        <h1>OTT and Movie Guides</h1>
        <p className="muted">SEO-friendly guides for OTT releases, Hindi dubbed titles, free legal movies and where-to-watch answers.</p>
      </section>
      <section className="section">
        {posts.length ? (
          <div className="grid">
            {posts.map((post) => (
              <Link className="blog-card" href={`/blog/${post.slug}`} key={post.id}>
                {post.featured_image_url ? <img src={post.featured_image_url} alt={post.title} /> : null}
                <p className="rating-badge">{post.category || "Update"}</p>
                <h2>{post.title}</h2>
                <p className="muted">{post.excerpt}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No published posts" />
        )}
      </section>
    </main>
  );
}
