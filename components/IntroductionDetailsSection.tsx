type DetailValue = string | number | null | undefined;

export type IntroductionDetailItem = {
  label: string;
  value?: DetailValue | DetailValue[];
};

function normalizeValue(value: IntroductionDetailItem["value"]) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return String(value || "").trim();
}

export default function IntroductionDetailsSection({
  eyebrow = "Introduction",
  title = "Introduction / Details",
  description,
  items,
  tags
}: {
  eyebrow?: string;
  title?: string;
  description?: string | null;
  items: IntroductionDetailItem[];
  tags?: string[];
}) {
  const visibleItems = items
    .map((item) => ({ ...item, value: normalizeValue(item.value) }))
    .filter((item) => item.value);
  const visibleTags = (tags || []).map((tag) => tag.trim()).filter(Boolean);

  if (!description && !visibleItems.length && !visibleTags.length) return null;

  return (
    <section className="section panel introduction-details-panel">
      <div className="section-head">
        <div>
          <p className="rating-badge">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </div>
      {description ? <p className="introduction-text">{description}</p> : null}
      {visibleTags.length ? (
        <div className="intro-chip-row">
          {visibleTags.map((tag) => (
            <span className="smart-badge" key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
      {visibleItems.length ? (
        <dl className="introduction-details-grid">
          {visibleItems.map((item) => (
            <div className="intro-detail-item" key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
