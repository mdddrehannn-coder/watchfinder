export type AccessType = "free" | "subscription" | "rent_buy" | "unknown";

export const ACCESS_TYPE_OPTIONS: Array<{ value: AccessType; label: string; detail: string }> = [
  { value: "free", label: "Free", detail: "Free to Watch" },
  { value: "subscription", label: "Premium", detail: "Premium Subscription Required" },
  { value: "rent_buy", label: "Rent/Buy", detail: "Rent/Buy Required" },
  { value: "unknown", label: "Unknown", detail: "Availability info unknown" }
];

export const ACCESS_TYPE_BADGES: Record<AccessType, { label: string; detail: string; className: string }> = {
  free: {
    label: "FREE",
    detail: "Free to Watch",
    className: "access-badge access-badge-free"
  },
  subscription: {
    label: "PREMIUM",
    detail: "Premium Subscription Required",
    className: "access-badge access-badge-subscription"
  },
  rent_buy: {
    label: "RENT",
    detail: "Rent/Buy Required",
    className: "access-badge access-badge-rent-buy"
  },
  unknown: {
    label: "INFO",
    detail: "Availability info unknown",
    className: "access-badge access-badge-unknown"
  }
};

const accessValues = new Set<AccessType>(["free", "subscription", "rent_buy", "unknown"]);

export function normalizeAccessType(value?: string | null): AccessType {
  const clean = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (clean === "premium" || clean === "paid" || clean === "subscribed") return "subscription";
  if (clean === "rent" || clean === "buy" || clean === "rental" || clean === "rent_or_buy") return "rent_buy";
  if (clean === "info" || clean === "not_sure" || clean === "not sure") return "unknown";
  return accessValues.has(clean as AccessType) ? clean as AccessType : "unknown";
}

export function accessTypeMeta(value?: string | null) {
  return ACCESS_TYPE_BADGES[normalizeAccessType(value)];
}

export function accessTypeFromAvailability(value?: string | null): AccessType {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "free") return "free";
  if (clean === "subscription" || clean === "premium" || clean === "official") return "subscription";
  if (clean === "rent" || clean === "buy" || clean === "rent_buy") return "rent_buy";
  return "unknown";
}

function platformKey(platform?: { key?: string | null; name?: string | null } | string | null) {
  const value = typeof platform === "string" ? platform : `${platform?.key || ""} ${platform?.name || ""}`;
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function defaultAccessTypeForPlatform(platform?: { key?: string | null; name?: string | null } | string | null): AccessType | null {
  const key = platformKey(platform);
  if (!key) return null;
  if (key.includes("netflix")) return "subscription";
  return null;
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.find((pattern) => pattern.test(text)) || null;
}

export function detectAccessTypeFromText(
  value?: string | null,
  platform?: { key?: string | null; name?: string | null } | string | null
): { accessType: AccessType; reason: string | null } {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/free\s+trial/gi, "trial")
    .toLowerCase();

  const rentBuy = hasAny(normalized, [
    /\brent(?:al|ed|ing)?\b/,
    /\bbuy\b/,
    /\bpurchase\b/,
    /\bavailable to rent\b/,
    /\brent or buy\b/,
    /\bbuy or rent\b/,
    /\bpaid movie\b/,
    /\bpay per view\b/
  ]);
  if (rentBuy) return { accessType: "rent_buy", reason: `Detected "${rentBuy.source}" pricing signal.` };

  const subscription = hasAny(normalized, [
    /\bincluded with (?:a )?subscription\b/,
    /\bsubscription required\b/,
    /\bsubscribe to watch\b/,
    /\bmembership required\b/,
    /\bwatch with (?:a )?plan\b/,
    /\bwith (?:a )?plan\b/,
    /\bpremium\b/,
    /\bvip\b/,
    /\bincluded with prime\b/,
    /\bprime membership\b/,
    /\bsubscriber only\b/
  ]);
  if (subscription) return { accessType: "subscription", reason: `Detected "${subscription.source}" subscription signal.` };

  const free = hasAny(normalized, [
    /\bfree with ads\b/,
    /\bfree to watch\b/,
    /\bwatch free\b/,
    /\bstream free\b/,
    /\bavailable for free\b/,
    /\bfree movie\b/,
    /\bfree episode\b/
  ]);
  if (free) return { accessType: "free", reason: `Detected "${free.source}" free access signal.` };

  const platformDefault = defaultAccessTypeForPlatform(platform);
  if (platformDefault) {
    return { accessType: platformDefault, reason: "Defaulted from platform rule." };
  }

  return { accessType: "unknown", reason: null };
}
