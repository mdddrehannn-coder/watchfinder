export const WATCHFINDER_LANGUAGES = [
  "Hindi",
  "English",
  "Tamil",
  "Telugu",
  "Malayalam",
  "Kannada",
  "Marathi",
  "Bengali",
  "Punjabi",
  "Gujarati",
  "Urdu",
  "Odia",
  "Assamese",
  "Bhojpuri",
  "Haryanvi",
  "Rajasthani",
  "Nepali",
  "Sanskrit",
  "Konkani",
  "Manipuri / Meitei",
  "Bodo",
  "Dogri",
  "Kashmiri",
  "Maithili",
  "Santali",
  "Sindhi",
  "Tulu",
  "Multi-language",
  "Hindi Dubbed",
  "English Dubbed"
];

const LANGUAGE_ALIASES: Record<string, string> = {
  hindi: "Hindi",
  english: "English",
  tamil: "Tamil",
  telugu: "Telugu",
  malayalam: "Malayalam",
  kannada: "Kannada",
  marathi: "Marathi",
  bengali: "Bengali",
  punjabi: "Punjabi",
  gujarati: "Gujarati",
  urdu: "Urdu",
  odia: "Odia",
  oriya: "Odia",
  assamese: "Assamese",
  bhojpuri: "Bhojpuri",
  haryanvi: "Haryanvi",
  rajasthani: "Rajasthani",
  nepali: "Nepali",
  sanskrit: "Sanskrit",
  konkani: "Konkani",
  manipuri: "Manipuri / Meitei",
  meitei: "Manipuri / Meitei",
  bodo: "Bodo",
  dogri: "Dogri",
  kashmiri: "Kashmiri",
  maithili: "Maithili",
  santali: "Santali",
  sindhi: "Sindhi",
  tulu: "Tulu",
  "multi language": "Multi-language",
  multilanguage: "Multi-language",
  multilingual: "Multi-language",
  "hindi dubbed": "Hindi Dubbed",
  "english dubbed": "English Dubbed"
};

export const LANGUAGE_META_LABELS = new Set(["Multi-language", "Hindi Dubbed", "English Dubbed"]);
export const SOUTH_INDIAN_LANGUAGES = new Set(["Tamil", "Telugu", "Malayalam", "Kannada", "Tulu"]);

export function splitLanguages(value?: string | null) {
  return (value || "")
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean);
}

export function joinLanguages(languages: string[]) {
  return languages.map((language) => language.trim()).filter(Boolean).join(", ");
}

export function normalizeLanguageLabel(value?: string | null) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!key) return null;
  const alias = LANGUAGE_ALIASES[key];
  if (alias && WATCHFINDER_LANGUAGES.includes(alias)) return alias;
  return WATCHFINDER_LANGUAGES.find((language) => language.toLowerCase() === key) || null;
}

export function uniqueLanguages(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => normalizeLanguageLabel(value))
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function actualAudioLanguages(values: string[]) {
  return uniqueLanguages(values).filter((language) => !LANGUAGE_META_LABELS.has(language));
}

export function withLanguageDisplayLabels(values: string[], originalLanguage?: string | null) {
  const normalized = uniqueLanguages(values);
  const actual = actualAudioLanguages(normalized);
  const labels = new Set(normalized);
  if (actual.length > 1) labels.add("Multi-language");

  const original = normalizeLanguageLabel(originalLanguage);
  if (actual.includes("Hindi") && original && original !== "Hindi") labels.add("Hindi Dubbed");
  if (actual.includes("Hindi") && actual.some((language) => SOUTH_INDIAN_LANGUAGES.has(language))) labels.add("Hindi Dubbed");

  return Array.from(labels);
}

export function primaryLanguageForSelection(values: string[]) {
  const actual = actualAudioLanguages(values);
  if (actual.length > 1 || values.includes("Multi-language")) return "Multi-language";
  return actual[0] || "";
}
