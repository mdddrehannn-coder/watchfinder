"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Image as ImageIcon, Loader2, Search, Sparkles } from "lucide-react";
import { accessTypeMeta } from "@/lib/access-type";
import type { AiImportCandidate, AiImportDraft, AiImportPlatform, AiImportResponse } from "@/lib/ai-import-types";

type AiContentType = "movie" | "web_series" | "tv_show" | "cartoon";

type Message = {
  type: "success" | "error" | "info" | "warning";
  text: string;
};

type MetadataProviderStatus = {
  configured: boolean;
  connected: boolean | null;
  message: string;
  maskedKey?: string | null;
};

const AI_AUTOFILL_STEPS = [
  "Detecting title",
  "Searching metadata",
  "Fetching credits",
  "Finding trailer",
  "Generating SEO",
  "Filling form",
  "Ready for review"
];

const contentTypeOptions: Array<{ label: string; value: AiContentType }> = [
  { label: "Movie", value: "movie" },
  { label: "Web Series", value: "web_series" },
  { label: "TV Show", value: "tv_show" },
  { label: "Cartoon", value: "cartoon" }
];

function statusClass(type: Message["type"]) {
  if (type === "success") return "form-message success";
  if (type === "error") return "form-message error";
  if (type === "warning") return "form-message warning";
  return "form-message info";
}

function mediaTypeForContentType(contentType: AiContentType) {
  if (contentType === "web_series" || contentType === "tv_show") return "tv";
  if (contentType === "movie") return "movie";
  return "auto";
}

function compactList(values?: string[], limit = 5) {
  const clean = (values || []).map((item) => item.trim()).filter(Boolean);
  if (!clean.length) return "Not found";
  return clean.length > limit ? `${clean.slice(0, limit).join(", ")} +${clean.length - limit}` : clean.join(", ");
}

export default function AdminAIAssistant({
  onDraftReady,
  initialContentType = "movie",
  embedded = false
}: {
  onDraftReady?: (draft: AiImportDraft) => void;
  initialContentType?: AiContentType;
  embedded?: boolean;
}) {
  const [contentType, setContentType] = useState<AiContentType>(initialContentType);
  const [titleInput, setTitleInput] = useState("");
  const [officialLinkInput, setOfficialLinkInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [fixSummary, setFixSummary] = useState<{ fixed: string[]; missing: string[] } | null>(null);
  const [progressIndex, setProgressIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<AiImportDraft | null>(null);
  const [candidates, setCandidates] = useState<AiImportCandidate[]>([]);
  const [extractedTitle, setExtractedTitle] = useState<string | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<AiImportPlatform | null>(null);
  const [detectedAvailableLanguages, setDetectedAvailableLanguages] = useState<string[]>([]);
  const [officialWatchUrl, setOfficialWatchUrl] = useState<string | null>(null);
  const [tmdbStatus, setTmdbStatus] = useState<MetadataProviderStatus | null>(null);
  const [checkingProviders, setCheckingProviders] = useState(true);

  async function checkMetadataProviders() {
    setCheckingProviders(true);
    try {
      const response = await fetch("/api/admin/metadata-providers", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.ok) throw new Error(json.error || "Metadata provider check failed.");
      setTmdbStatus(json.providers?.tmdb || {
        configured: false,
        connected: false,
        message: "TMDb API key is not configured."
      });
    } catch (error) {
      setTmdbStatus({
        configured: false,
        connected: false,
        message: error instanceof Error ? error.message : "Metadata provider check failed."
      });
    } finally {
      setCheckingProviders(false);
    }
  }

  useEffect(() => {
    checkMetadataProviders();
  }, []);

  function startProgress() {
    setProgressIndex(0);
    let index = 0;
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, AI_AUTOFILL_STEPS.length - 2);
      setProgressIndex(index);
    }, 650);
    return timer;
  }

  function applyDraft(nextDraft: AiImportDraft) {
    setDraft(nextDraft);
    setCandidates([]);
    setExtractedTitle(nextDraft.extractedTitle || null);
    setDetectedPlatform(nextDraft.platform || null);
    setDetectedAvailableLanguages(nextDraft.availableLanguages || []);
    setOfficialWatchUrl(nextDraft.officialWatchUrl || null);
    setMessage({
      type: "success",
      text: `${nextDraft.title} is ready. Review the filled form before saving.`
    });
    onDraftReady?.(nextDraft);
  }

  async function generateDetails() {
    if (tmdbStatus?.connected !== true) {
      setMessage({ type: "error", text: tmdbStatus?.message || "TMDb API key is not configured." });
      return;
    }

    const title = titleInput.trim();
    const officialLink = officialLinkInput.trim();
    const source = title || officialLink;
    if (!source) {
      setMessage({ type: "error", text: "Enter a movie/show name or paste an official OTT/YouTube link first." });
      return;
    }

    setLoading(true);
    setDraft(null);
    setCandidates([]);
    setMessage({ type: "info", text: "Generating details from public metadata..." });
    const timer = startProgress();

    try {
      const response = await fetch("/api/admin/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "search",
          mode: "auto",
          input: source,
          title,
          officialWatchUrl: officialLink || null,
          mediaType: mediaTypeForContentType(contentType),
          requestedContentType: contentType,
          includeSeasons: contentType === "web_series"
        })
      });
      const json = (await response.json()) as AiImportResponse;
      if (!response.ok || !json.ok) throw new Error(json.error || "AI Auto Fill failed.");

      if (json.draft) {
        applyDraft(json.draft);
      } else if (json.candidates?.length) {
        setCandidates(json.candidates);
        setExtractedTitle(json.extractedTitle || null);
        setDetectedPlatform(json.platform || null);
        setDetectedAvailableLanguages(json.availableLanguages || []);
        setOfficialWatchUrl(officialLink || (source.startsWith("http") ? source : null));
        setMessage({
          type: "warning",
          text: `Multiple matches found for "${json.extractedTitle || source}". Select the correct one to fill the form.`
        });
      } else {
        throw new Error("Metadata not found. Try another official link or movie/show name.");
      }
      setProgressIndex(AI_AUTOFILL_STEPS.length - 1);
    } catch (error) {
      setProgressIndex(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "AI Auto Fill failed." });
    } finally {
      window.clearInterval(timer);
      setLoading(false);
      window.setTimeout(() => setProgressIndex(null), 1100);
    }
  }

  async function selectCandidate(candidate: AiImportCandidate) {
    setLoading(true);
    setMessage({ type: "info", text: `Fetching ${candidate.title} details...` });
    const timer = startProgress();
    try {
      const response = await fetch("/api/admin/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "details",
          input: titleInput.trim() || officialLinkInput.trim(),
          title: titleInput.trim(),
          tmdbId: candidate.tmdbId,
          selectedMediaType: candidate.mediaType,
          requestedContentType: contentType,
          includeSeasons: contentType === "web_series",
          officialWatchUrl: officialLinkInput.trim() || officialWatchUrl,
          extractedTitle,
          platform: detectedPlatform,
          availableLanguages: detectedAvailableLanguages
        })
      });
      const json = (await response.json()) as AiImportResponse;
      if (!response.ok || !json.ok || !json.draft) throw new Error(json.error || "Full details could not be fetched.");
      applyDraft(json.draft);
      setProgressIndex(AI_AUTOFILL_STEPS.length - 1);
    } catch (error) {
      setProgressIndex(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Full details could not be fetched." });
    } finally {
      window.clearInterval(timer);
      setLoading(false);
      window.setTimeout(() => setProgressIndex(null), 1100);
    }
  }

  async function fixMissingData() {
    if (tmdbStatus?.connected !== true) {
      setMessage({ type: "error", text: tmdbStatus?.message || "TMDb API key is not configured." });
      return;
    }

    if (!draft) {
      setMessage({ type: "error", text: "Generate details first, then fix missing data." });
      return;
    }
    if (!window.confirm("Fix Missing Data will update empty or weak AI-filled fields. Continue?")) {
      return;
    }

    setFixing(true);
    setMessage({ type: "info", text: "Retrying missing metadata only..." });
    const timer = startProgress();
    try {
      const response = await fetch("/api/admin/ai-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix_missing",
          input: titleInput.trim() || officialLinkInput.trim() || draft.input,
          title: titleInput.trim(),
          draft,
          mediaType: mediaTypeForContentType(contentType),
          requestedContentType: contentType,
          includeSeasons: contentType === "web_series",
          officialWatchUrl: officialLinkInput.trim() || draft.officialWatchUrl || null
        })
      });
      const json = (await response.json()) as AiImportResponse;
      if (!response.ok || !json.ok || !json.draft) throw new Error(json.error || "Missing data could not be fixed.");
      applyDraft(json.draft);
      setFixSummary({
        fixed: json.fixedFields || [],
        missing: json.stillMissing || json.draft.missingFields || []
      });
      setMessage({
        type: "success",
        text: (json.fixedFields || []).length
          ? `Fixed: ${(json.fixedFields || []).join(", ")}.`
          : "No new missing data was found from available sources."
      });
      setProgressIndex(AI_AUTOFILL_STEPS.length - 1);
    } catch (error) {
      setProgressIndex(null);
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Missing data could not be fixed." });
    } finally {
      window.clearInterval(timer);
      setFixing(false);
      window.setTimeout(() => setProgressIndex(null), 1100);
    }
  }

  return (
    <section className={embedded ? "panel ai-assistant-shell ai-autofill-panel" : "section ai-assistant-shell"}>
      <div className="section-head">
        <div>
          <p className="rating-badge">Admin only</p>
          <h2><Sparkles size={24} /> AI Auto Fill</h2>
          <p className="muted">
            Paste one official link or a title. WatchFinder fills the existing Add Content form as a draft for review.
          </p>
        </div>
        <div className="ai-source-stack">
          <span className="chip active">TMDb</span>
          <span className={tmdbStatus?.configured ? "chip active" : "chip"}>
            TMDb configured = {tmdbStatus?.configured ? "true" : "false"}
          </span>
          <span className="chip">YouTube trailer</span>
        </div>
      </div>

      {message ? <p className={statusClass(message.type)}>{message.text}</p> : null}

      {tmdbStatus?.connected !== true ? (
        <div className="notice-card warning ai-provider-setup-card">
          <strong><AlertTriangle size={16} /> TMDb setup required</strong>
          <p>{checkingProviders ? "Checking TMDb connection..." : tmdbStatus?.message || "TMDb API key is not configured."}</p>
          <p className="muted">
            Add `TMDB_API_KEY=` with a real TMDb key in `.env.local` or your hosting environment, restart/redeploy,
            then test it from Settings &gt; Metadata Providers.
          </p>
          <button className="button" type="button" onClick={checkMetadataProviders} disabled={checkingProviders}>
            {checkingProviders ? <Loader2 className="spin-icon" size={16} /> : null}
            Recheck connection
          </button>
        </div>
      ) : (
        <p className="form-message success"><CheckCircle2 size={16} /> TMDb Connected. AI Auto Fill is ready.</p>
      )}

      <div className="form-grid two">
        <label className="field">
          <span>Content Type</span>
          <select value={contentType} onChange={(event) => setContentType(event.target.value as AiContentType)}>
            {contentTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Movie/Show Name</span>
          <input
            value={titleInput}
            onChange={(event) => setTitleInput(event.target.value)}
            placeholder="The Arctic Convoy"
          />
        </label>
        <label className="field">
          <span>Official Watch Link</span>
          <input
            value={officialLinkInput}
            onChange={(event) => setOfficialLinkInput(event.target.value)}
            placeholder="https://www.hotstar.com/in/movies/the-arctic-convoy/1271649867/watch"
          />
          <small className="form-helper">Optional when title is provided. Saved only as the legal official watch link.</small>
        </label>
      </div>

      <div className="save-actions">
        <button className="button primary" disabled={loading || checkingProviders || tmdbStatus?.connected !== true} onClick={generateDetails} type="button">
          {loading ? <Loader2 className="spin-icon" size={18} /> : <Sparkles size={18} />}
          {loading ? "Generating..." : "Generate Details"}
        </button>
        <button className="button" disabled={!draft || loading || fixing || checkingProviders || tmdbStatus?.connected !== true} onClick={fixMissingData} type="button">
          {fixing ? <Loader2 className="spin-icon" size={18} /> : <Search size={18} />}
          {fixing ? "Fixing..." : "Fix Missing Data"}
        </button>
      </div>

      {progressIndex !== null ? (
        <div className="ai-progress-steps" aria-live="polite">
          {AI_AUTOFILL_STEPS.map((step, index) => (
            <span className={index <= progressIndex ? "active" : ""} key={step}>
              {index < progressIndex ? <CheckCircle2 size={13} /> : index === progressIndex && loading ? <Loader2 className="spin-icon" size={13} /> : null}
              {step}
            </span>
          ))}
        </div>
      ) : null}

      {candidates.length ? (
        <div className="ai-candidate-panel">
          <div>
            <strong>Choose the correct match</strong>
            <p className="muted">
              {detectedPlatform ? `${detectedPlatform.name} link detected. ` : ""}
              {extractedTitle ? `Detected title: ${extractedTitle}. ` : ""}
              The best match is highlighted.
            </p>
          </div>
          <div className="ai-candidate-grid">
            {candidates.slice(0, 3).map((candidate) => (
              <button
                className={`ai-candidate-card${candidate.isBestMatch ? " recommended" : ""}`}
                disabled={loading}
                key={`${candidate.mediaType}-${candidate.tmdbId}`}
                onClick={() => selectCandidate(candidate)}
                type="button"
              >
                {candidate.posterUrl ? <img alt={candidate.title} src={candidate.posterUrl} /> : <span className="ai-candidate-poster"><ImageIcon size={22} /></span>}
                <span>
                  {candidate.isBestMatch ? <em className="ai-best-match-badge">Best match</em> : null}
                  <strong>{candidate.title}</strong>
                  <small>{candidate.mediaType === "tv" ? "Series/TV" : "Movie"} {candidate.releaseYear ? `- ${candidate.releaseYear}` : ""}</small>
                  <small>{candidate.confidence ? `${Math.round(candidate.confidence)}% confidence` : "Public metadata result"}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="ai-review-stack compact-ai-review">
          <div className="ai-quality-card">
            <div>
              <span className="rating-badge">AI Quality Score</span>
              <strong>{draft.qualityScore?.label || "Draft quality pending"}</strong>
              <p className="muted">
                {draft.qualityScore?.warnings?.length
                  ? `Needs: ${draft.qualityScore.warnings.join(", ")}`
                  : "Core fields look complete."}
              </p>
            </div>
            <div className="ai-quality-ring" style={{ ["--score" as string]: `${draft.qualityScore?.score || 0}%` }}>
              {draft.qualityScore?.score || 0}%
            </div>
          </div>

          <div className="ai-hero-preview">
            {draft.bannerUrl || draft.posterUrl ? (
              <img alt={draft.title} src={draft.bannerUrl || draft.posterUrl || ""} />
            ) : (
              <span><ImageIcon size={28} /> No image found</span>
            )}
            <div>
              <span className="rating-badge">{draft.sourceLabel}</span>
              <h3>{draft.title}</h3>
              <p>{draft.shortDescription || draft.description || "Review the filled form below before saving."}</p>
            </div>
          </div>
          <div className="ai-detail-grid">
            <div><strong>Type</strong><p className="muted">{draft.contentType.replace("_", " ")}</p></div>
            <div><strong>Year</strong><p className="muted">{draft.releaseYear || "Missing"}</p></div>
            <div><strong>Genres</strong><p className="muted">{compactList(draft.genres)}</p></div>
            <div><strong>Platform</strong><p className="muted">{draft.platform?.name || "Not linked"}</p></div>
            <div><strong>Official link</strong><p className="muted">{draft.officialLinkValidation?.message || "Not checked"}</p></div>
            <div><strong>Access Type</strong><p className="muted">{accessTypeMeta(draft.accessType).detail}</p></div>
            <div><strong>Suggested placement</strong><p className="muted">{draft.suggestedPlacement?.primarySection?.replace("_", " ") || "recently added"}</p></div>
          </div>
          {draft.suggestedPlacement?.reasons?.length ? (
            <div className="notice-card">
              <strong>Category suggestion</strong>
              <p>{draft.suggestedPlacement.reasons.join(" ")}</p>
            </div>
          ) : null}
          {draft.assistantNotes?.length ? (
            <div className="notice-card">
              <strong>Assistant notes</strong>
              <ul className="ai-note-list">
                {draft.assistantNotes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          ) : null}
          {draft.duplicateWarnings.length ? (
            <div className="notice-card warning">
              <strong><AlertTriangle size={16} /> Duplicate checker</strong>
              <p>This title may already exist. {draft.duplicateWarnings.join(" ")}</p>
              <p className="muted">Before saving, use the existing form options to open existing content, save as new listing, or cancel.</p>
            </div>
          ) : null}
          {fixSummary ? (
            <div className="notice-card">
              <strong>Fix Missing Data result</strong>
              <p>Fixed: {fixSummary.fixed.length ? fixSummary.fixed.join(", ") : "Nothing new found"}.</p>
              <p className="muted">Still missing: {fixSummary.missing.length ? fixSummary.missing.join(", ") : "None"}.</p>
            </div>
          ) : null}
          {(draft.missingFields.length || draft.qualityWarnings.length) ? (
            <div className="notice-card">
              <strong><AlertTriangle size={16} /> Review warnings</strong>
              <p>{[...draft.missingFields, ...draft.qualityWarnings].join(", ")}</p>
            </div>
          ) : (
            <p className="form-message success"><CheckCircle2 size={16} /> Form filled. Keep status as draft until you review it.</p>
          )}
        </div>
      ) : null}

      <p className="form-helper">
        Legal safety: this only stores public metadata and official watch links. It never scrapes, downloads, or hosts OTT videos.
      </p>
    </section>
  );
}
