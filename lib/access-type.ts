export type AccessType = "free" | "premium" | "rent" | "unknown";

export type AccessTypeMeta = {
  label: string;
  detail: string;
  className: string;
  visible: boolean;
};

export const ACCESS_TYPE_OPTIONS: Array<{ value: AccessType; label: string; detail: string }> = [
  { value: "free", label: "Free", detail: "Free to Watch" },
  { value: "premium", label: "Premium", detail: "Premium Subscription Required" },
  { value: "rent", label: "Rent/Buy", detail: "Rent Required" },
  { value: "unknown", label: "Unknown", detail: "Availability not confirmed" }
];

export const ACCESS_TYPE_BADGES: Record<AccessType, AccessTypeMeta> = {
  free: {
    label: "FREE",
    detail: "Free to Watch",
    className: "access-badge access-badge-free",
    visible: true
  },
  premium: {
    label: "PREMIUM",
    detail: "Premium Subscription Required",
    className: "access-badge access-badge-premium",
    visible: true
  },
  rent: {
    label: "RENT",
    detail: "Rent Required",
    className: "access-badge access-badge-rent",
    visible: true
  },
  unknown: {
    label: "Unknown",
    detail: "Availability not confirmed",
    className: "access-badge access-badge-unknown",
    visible: false
  }
};

const accessValues = new Set<AccessType>(["free", "premium", "rent", "unknown"]);

export function normalizeAccessType(value?: string | null): AccessType {
  const clean = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (clean === "premium" || clean === "paid" || clean === "subscribed" || clean === "subscription" || clean === "subscriber_only") return "premium";
  if (clean === "rent" || clean === "buy" || clean === "rental" || clean === "rent_or_buy" || clean === "rent_buy" || clean === "purchase") return "rent";
  if (clean === "info" || clean === "not_sure" || clean === "not sure") return "unknown";
  return accessValues.has(clean as AccessType) ? clean as AccessType : "unknown";
}

export function accessTypeMeta(value?: string | null) {
  return ACCESS_TYPE_BADGES[normalizeAccessType(value)];
}

export function accessTypeFromAvailability(value?: string | null): AccessType {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "free") return "free";
  if (clean === "subscription" || clean === "premium" || clean === "official") return "premium";
  if (clean === "rent" || clean === "buy" || clean === "rent_buy") return "rent";
  return "unknown";
}

function platformKey(platform?: { key?: string | null; name?: string | null } | string | null) {
  const value = typeof platform === "string" ? platform : `${platform?.key || ""} ${platform?.name || ""}`;
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function defaultAccessTypeForPlatform(platform?: { key?: string | null; name?: string | null } | string | null): AccessType | null {
  const key = platformKey(platform);
  if (!key) return null;
  if (key.includes("netflix")) return "premium";
  if (key.includes("amazon minitv") || key.includes("amazon mx player") || key.includes("mx player") || key.includes("mxplayer")) return "free";
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
    /\bpaid\b/,
    /\bpay to watch\b/,
    /\bavailable to rent\b/,
    /\brent or buy\b/,
    /\bbuy or rent\b/,
    /\bpaid movie\b/,
    /\bpay per view\b/,
    /\bppv\b/,
    /\b₹\s*\d+/,
    /\brs\.?\s*\d+/,
    /\$\s*\d+/
  ]);
  if (rentBuy) return { accessType: "rent", reason: `Detected "${rentBuy.source}" pricing signal.` };

  const subscription = hasAny(normalized, [
    /\bsubscribe\b/,
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
    /\bsubscriber only\b/,
    /\bplan required\b/
  ]);
  if (subscription) return { accessType: "premium", reason: `Detected "${subscription.source}" subscription signal.` };

  const free = hasAny(normalized, [
    /\bfree with ads\b/,
    /\bfree to watch\b/,
    /\bwatch for free\b/,
    /\bwatch free\b/,
    /\bstream free\b/,
    /\bstream for free\b/,
    /\bavailable for free\b/,
    /\bfree movie\b/,
    /\bfree episode\b/,
    /\bno subscription required\b/
  ]);
  if (free) return { accessType: "free", reason: `Detected "${free.source}" free access signal.` };

  const platformDefault = defaultAccessTypeForPlatform(platform);
  if (platformDefault) {
    return { accessType: platformDefault, reason: "Defaulted from platform rule." };
  }

  return { accessType: "unknown", reason: null };
}
