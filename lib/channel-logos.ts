const channelLogoMap: Record<string, string> = {};

export function getChannelLogo(slug?: string | null) {
  if (!slug) return null;
  return channelLogoMap[slug] ?? null;
}
