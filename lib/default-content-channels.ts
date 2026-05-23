import type { ContentChannel, ContentChannelType } from "@/types/watchfinder";

const cartoonDescriptions: Array<[string, string, string]> = [
  ["Disney Channel", "disney-channel", "Cartoon shows and kids favorites"],
  ["Hungama", "hungama", "Anime and kids cartoons in Indian languages"],
  ["Pogo", "pogo", "Kids shows, classics, and Indian cartoons"],
  ["Cartoon Network", "cartoon-network", "Cartoon classics and animated shows"],
  ["Nickelodeon", "nickelodeon", "Cartoon shows and comedy favorites"],
  ["Sonic", "sonic", "Kids comedy, action, and animated shows"],
  ["Disney XD", "disney-xd", "Action cartoons and animated adventures"],
  ["Discovery Kids", "discovery-kids", "Educational cartoons and kids shows"],
  ["Marvel HQ", "marvel-hq", "Superhero cartoons and animated action"],
  ["YouTube", "youtube-cartoons", "Official cartoon clips and episodes"]
];

const tvDescriptions: Array<[string, string, string]> = [
  ["Star Plus", "star-plus", "Hindi family dramas and reality shows"],
  ["Sony TV", "sony-tv", "Hindi entertainment and reality programming"],
  ["Zee TV", "zee-tv", "Hindi TV serials and entertainment"],
  ["Colors", "colors", "Hindi entertainment and reality shows"],
  ["SAB TV", "sab-tv", "Comedy and family entertainment shows"],
  ["&TV", "and-tv", "Hindi fiction and entertainment shows"],
  ["DD National", "dd-national", "Classic and public broadcast TV shows"],
  ["Life OK", "life-ok", "Popular Hindi shows and archive listings"],
  ["MTV", "mtv", "Youth shows, music, and reality programming"],
  ["Channel V", "channel-v", "Youth entertainment and music shows"],
  ["Sony SAB", "sony-sab", "Comedy and family entertainment shows"],
  ["Discovery", "discovery", "Documentary and factual shows"],
  ["National Geographic", "national-geographic", "Science, nature, and factual shows"],
  ["History TV18", "history-tv18", "History, documentary, and factual shows"]
];

function makeChannel([name, slug, description]: [string, string, string], channelType: ContentChannelType): ContentChannel {
  return {
    id: `fallback-${channelType}-${slug}`,
    name,
    slug,
    channel_type: channelType,
    description,
    logo_url: null,
    official_url: null,
    is_active: true,
    sort_order: 0,
    item_count: 0
  };
}

export const fallbackCartoonChannels = cartoonDescriptions.map((channel) => makeChannel(channel, "cartoon"));
export const fallbackTvShowChannels = tvDescriptions.map((channel) => makeChannel(channel, "tv_show"));

export function getFallbackChannels(channelType: ContentChannelType) {
  return channelType === "cartoon" ? fallbackCartoonChannels : fallbackTvShowChannels;
}

export function getFallbackChannelBySlug(channelType: ContentChannelType, slug: string) {
  return getFallbackChannels(channelType).find((channel) => channel.slug === slug) ?? null;
}
