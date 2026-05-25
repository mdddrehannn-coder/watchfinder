import type { ContentChannel, ContentChannelType } from "@/types/watchfinder";

const cartoonDescriptions: Array<[string, string, string]> = [
  ["Hungama", "hungama", "Anime and kids cartoons in Indian languages"],
  ["Disney Channel", "disney-channel", "Cartoon shows and kids favorites"],
  ["Cartoon Network", "cartoon-network", "Cartoon classics and animated shows"],
  ["Pogo", "pogo", "Kids shows, classics, and Indian cartoons"],
  ["Nickelodeon", "nickelodeon", "Cartoon shows and comedy favorites"],
  ["Sonic", "sonic", "Kids comedy, action, and animated shows"],
  ["Sony YAY!", "sony-yay", "Kids cartoons and animated shows"],
  ["Discovery Kids", "discovery-kids", "Educational cartoons and kids shows"],
  ["ETV Bal Bharat", "etv-bal-bharat", "Indian kids cartoons and animated shows"],
  ["Nick Jr.", "nick-jr", "Preschool cartoons and kids favorites"],
  ["YouTube Official Kids", "youtube-official-kids", "Official cartoon clips and episodes"]
];

const tvDescriptions: Array<[string, string, string]> = [
  ["Star Plus", "star-plus", "Hindi family dramas and reality shows"],
  ["Sony SAB", "sony-sab", "Comedy and family entertainment shows"],
  ["Sony Entertainment Television", "sony-entertainment-television", "Hindi entertainment and reality programming"],
  ["Zee TV", "zee-tv", "Hindi TV serials and entertainment"],
  ["Colors TV", "colors-tv", "Hindi entertainment and reality shows"],
  ["Dangal TV", "dangal-tv", "Hindi serials and family entertainment"],
  ["DD National", "dd-national", "Classic and public broadcast TV shows"],
  ["MTV India", "mtv-india", "Youth shows, music, and reality programming"],
  ["Discovery", "discovery", "Documentary and factual shows"],
  ["National Geographic", "national-geographic", "Science, nature, and factual shows"],
  ["History TV18", "history-tv18", "History, documentary, and factual shows"],
  ["YouTube Official Shows", "youtube-official-shows", "Official TV show clips and episodes"]
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
