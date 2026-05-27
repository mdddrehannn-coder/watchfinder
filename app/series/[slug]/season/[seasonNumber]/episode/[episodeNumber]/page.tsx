import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacySeriesEpisodePage({
  params
}: {
  params: Promise<{ slug: string; seasonNumber: string; episodeNumber: string }>;
}) {
  const { slug, seasonNumber, episodeNumber } = await params;
  redirect(`/web-series/${slug}/season/${seasonNumber}/episode/${episodeNumber}`);
}
