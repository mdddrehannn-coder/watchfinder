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

export function splitLanguages(value?: string | null) {
  return (value || "")
    .split(",")
    .map((language) => language.trim())
    .filter(Boolean);
}

export function joinLanguages(languages: string[]) {
  return languages.map((language) => language.trim()).filter(Boolean).join(", ");
}
