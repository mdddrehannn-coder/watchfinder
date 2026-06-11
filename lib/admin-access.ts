export const ADMIN_EMAIL = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "mdddrehannn@gmail.com").trim().toLowerCase();

export function normalizeEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase();
}

export function isAdminEmail(email?: string | null) {
  return Boolean(ADMIN_EMAIL && normalizeEmail(email) === ADMIN_EMAIL);
}
