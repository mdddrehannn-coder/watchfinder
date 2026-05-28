import { splitLanguages } from "@/lib/languages";

export function languageBadge(value?: string | null, primaryLanguage?: string | null) {
  const primary = String(primaryLanguage || "").trim();
  if (primary) return primary;

  const languages = splitLanguages(value);
  if (!languages.length) return null;
  if (languages.length === 1) return languages[0];
  return "Multilingual";
}
