import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/data";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Blog" };
  return {
    title: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || undefined,
    openGraph: {
      title: post.seo_title || post.title,
      description: post.seo_description || post.excerpt || undefined,
      images: [post.featured_image_url || ""].filter(Boolean)
    }
  };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="page-inner">
      <article className="section panel">
        {post.featured_image_url ? <img src={post.featured_image_url} alt={post.title} /> : null}
        <p className="rating-badge">{post.category || "WatchFinder"}</p>
        <h1>{post.title}</h1>
        {post.excerpt ? <p className="muted">{post.excerpt}</p> : null}
        <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{post.content}</div>
      </article>
    </main>
  );
}
