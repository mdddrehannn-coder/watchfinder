import type { Metadata } from "next";
import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import { getBlogPosts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Blog and OTT News",
  description: "Read WatchFinder movie news, OTT updates and legal streaming guides."
};

export default async function BlogPage() {
  const posts = await getBlogPosts(60);
  return (
    <main className="page-inner">
      <h1>Blog and News</h1>
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
