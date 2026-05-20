import { splitLanguages } from "@/lib/languages";

export default function LanguageTags({
  value,
  compact = false
}: {
  value?: string | null;
  compact?: boolean;
}) {
  const languages = splitLanguages(value);

  if (!languages.length) {
    return <span className="language-tag">{compact ? "Multi" : "Multi-language"}</span>;
  }

  return (
    <span className={compact ? "language-tags compact" : "language-tags"}>
      {languages.map((language) => (
        <span className="language-tag" key={language}>
          {language}
        </span>
      ))}
    </span>
  );
}
