import { notFound } from "next/navigation";
import InAppBrowser from "@/components/InAppBrowser";

export const dynamic = "force-dynamic";

export default async function WatchPlatformPage({
  params,
  searchParams
}: {
  params: Promise<{ platform: string }>;
  searchParams: Promise<{ url?: string; title?: string; movie?: string; platformName?: string }>;
}) {
  const { platform } = await params;
  const query = await searchParams;
  const url = query.url || "";
  if (!url) notFound();

  return (
    <InAppBrowser
      platform={platform}
      platformName={query.platformName || platform.replaceAll("-", " ")}
      title={query.title || "Official platform"}
      url={url}
      movieSlug={query.movie || null}
    />
  );
}
