"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import { slugify } from "@/lib/format";
import { storageBuckets, uploadPublicFile } from "@/lib/storage";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { ContentChannel, ContentChannelType } from "@/types/watchfinder";

function emptyChannel(channelType: ContentChannelType): ContentChannel {
  return {
    id: "",
    name: "",
    slug: "",
    channel_type: channelType,
    logo_url: "",
    description: "",
    official_url: "",
    sort_order: 0,
    is_active: true
  };
}

function channelTypeLabel(channelType?: string | null) {
  return channelType === "cartoon" ? "Cartoon" : "TV Show";
}

function cleanUrl(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || "";
}

function LogoPreview({ channel, compact = false }: { channel: ContentChannel; compact?: boolean }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = cleanUrl(channel.logo_url);

  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  return (
    <div className={compact ? "channel-logo-preview-card compact" : "channel-logo-preview-card"}>
      <div className={compact ? "channel-logo-preview compact" : "channel-logo-preview"}>
        {logoUrl && !failed ? (
          <img src={logoUrl} alt={`${channel.name || "Channel"} logo preview`} onError={() => setFailed(true)} />
        ) : (
          <span>{(channel.name || channel.channel_type || "?").slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      {!compact ? (
        <div>
          <strong>{channel.name || `${channelTypeLabel(channel.channel_type)} logo preview`}</strong>
          <p className={logoUrl && failed ? "form-helper error-text" : "form-helper"}>
            {logoUrl && failed ? "Logo failed to load. Check URL." : logoUrl ? "Logo preview from URL." : "Fallback preview until a logo URL is added."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminChannelManager({
  initialChannels,
  channelType,
  title,
  tableError
}: {
  initialChannels: ContentChannel[];
  channelType: ContentChannelType;
  title: string;
  tableError?: string | null;
}) {
  const [channels, setChannels] = useState(initialChannels.filter((channel) => channel.channel_type === channelType));
  const [editing, setEditing] = useState<ContentChannel>(emptyChannel(channelType));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContentChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function resolveUniqueSlug(baseSlug: string, currentId?: string | null) {
    const supabase = createSupabaseBrowserClient();
    const base = slugify(baseSlug || editing.name || `${channelType}-channel`) || `${channelType}-channel`;
    let candidate = base;
    let suffix = 2;

    while (suffix < 100) {
      const { data, error } = await supabase
        .from("content_channels")
        .select("id")
        .eq("slug", candidate)
        .maybeSingle();

      if (error) throw error;
      if (!data || data.id === currentId) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return `${base}-${Date.now()}`;
  }

  function editChannel(channel: ContentChannel) {
    setEditing({ ...channel, channel_type: channelType });
    setMessage(null);
    setDeleteTarget(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage("Uploading logo...");
    try {
      const pathName = slugify(editing.slug || editing.name || file.name.replace(/\.[^.]+$/, "")) || `${channelType}-logo`;
      const publicUrl = await uploadPublicFile(storageBuckets.posters, `channels/${channelType}/${pathName}`, file);
      setEditing((current) => ({ ...current, logo_url: publicUrl }));
      setMessage("Logo uploaded. Review the preview, then save the channel.");
    } catch (error) {
      setMessage(error instanceof Error ? `Logo upload failed: ${error.message}` : "Logo upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing.name.trim()) {
      setMessage("Channel name is required.");
      return;
    }

    setSaving(true);
    setMessage("Saving channel...");
    try {
      const supabase = createSupabaseBrowserClient();
      const finalSlug = await resolveUniqueSlug(editing.slug || editing.name, editing.id || null);
      const payload = {
        name: editing.name.trim(),
        slug: finalSlug,
        channel_type: channelType,
        logo_url: cleanUrl(editing.logo_url) || null,
        description: cleanUrl(editing.description) || null,
        official_url: cleanUrl(editing.official_url) || null,
        sort_order: Number(editing.sort_order || 0),
        is_active: editing.is_active !== false,
        updated_at: new Date().toISOString()
      };

      const query = editing.id
        ? supabase.from("content_channels").update(payload).eq("id", editing.id)
        : supabase.from("content_channels").insert(payload);

      const { data, error } = await query.select("*").single();
      if (error || !data) {
        setMessage(error?.message || "Channel save failed.");
        return;
      }

      setChannels((current) => {
        const exists = current.some((channel) => channel.id === data.id);
        const next = exists
          ? current.map((channel) => channel.id === data.id ? { ...channel, ...data } : channel)
          : [...current, { ...data, item_count: 0 }];
        return next.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name));
      });
      setEditing(emptyChannel(channelType));
      setMessage(`Channel saved. Slug: ${data.slug}`);
    } catch (error) {
      setMessage(error instanceof Error ? `Channel save failed: ${error.message}` : "Channel save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteChannel() {
    if (!deleteTarget?.id) return;
    setSaving(true);
    setMessage("Deleting channel...");
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("content_channels")
      .delete()
      .eq("id", deleteTarget.id);

    setSaving(false);
    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }

    setChannels((current) => current.filter((channel) => channel.id !== deleteTarget.id));
    if (editing.id === deleteTarget.id) setEditing(emptyChannel(channelType));
    setDeleteTarget(null);
    setMessage("Channel deleted.");
  }

  return (
    <div className="form-grid">
      <div>
        <h2>{title}</h2>
        <p className="muted">Create and edit {channelTypeLabel(channelType).toLowerCase()} channel cards, logos, links, sorting, and public visibility.</p>
      </div>
      {tableError ? (
        <div className="notice-card error">
          <strong>Cartoon/TV Show tables are missing.</strong>
          <p>{tableError}</p>
        </div>
      ) : null}
      {message ? <p className="form-message info">{message}</p> : null}
      <form className="panel form-grid" onSubmit={saveChannel}>
        <div className="form-grid two">
          <div className="field">
            <label>Name</label>
            <input value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} />
          </div>
          <div className="field">
            <label>Slug</label>
            <input value={editing.slug} onChange={(event) => setEditing((current) => ({ ...current, slug: slugify(event.target.value) }))} />
          </div>
          <div className="field">
            <label>Logo URL</label>
            <input placeholder="https://..." value={editing.logo_url || ""} onChange={(event) => setEditing((current) => ({ ...current, logo_url: event.target.value }))} />
          </div>
          <div className="field">
            <label>Logo Upload</label>
            <input accept="image/*" ref={fileInputRef} type="file" onChange={handleLogoUpload} />
            <p className="form-helper">Optional. Upload uses the existing public poster storage bucket and fills Logo URL automatically.</p>
          </div>
          <div className="field">
            <label>Official URL</label>
            <input placeholder="https://official-site.example" value={editing.official_url || ""} onChange={(event) => setEditing((current) => ({ ...current, official_url: event.target.value }))} />
          </div>
          <div className="field">
            <label>Sort Order</label>
            <input inputMode="numeric" value={editing.sort_order || 0} onChange={(event) => setEditing((current) => ({ ...current, sort_order: Number(event.target.value) }))} />
          </div>
          <label className="chip">
            <input checked={editing.is_active !== false} onChange={(event) => setEditing((current) => ({ ...current, is_active: event.target.checked }))} type="checkbox" />
            Active
          </label>
        </div>
        <div className="field">
          <label>Description</label>
          <textarea value={editing.description || ""} onChange={(event) => setEditing((current) => ({ ...current, description: event.target.value }))} />
        </div>
        <LogoPreview channel={editing} />
        <div className="chip-row">
          <button className="button primary" type="submit" disabled={saving || uploading}>
            <Save size={18} /> {saving ? "Saving..." : editing.id ? "Update Channel" : "Add Channel"}
          </button>
          <button className="button" disabled={uploading} type="button" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={18} /> {uploading ? "Uploading..." : "Choose Logo"}
          </button>
          {editing.id ? <button className="button ghost" type="button" onClick={() => setEditing(emptyChannel(channelType))}>Cancel edit</button> : null}
        </div>
      </form>
      {deleteTarget ? (
        <div className="notice-card error">
          <strong>Delete this channel?</strong>
          <p>This deletes only <b>{deleteTarget.name}</b> from {title}. Linked channel rows may be removed by the existing database cascade, but movies are not deleted.</p>
          <div className="chip-row">
            <button className="button danger" disabled={saving} type="button" onClick={deleteChannel}>
              <Trash2 size={16} /> {saving ? "Deleting..." : "Delete Channel"}
            </button>
            <button className="button ghost" type="button" onClick={() => setDeleteTarget(null)}>Cancel</button>
          </div>
        </div>
      ) : null}
      <div className="admin-movie-list">
        {channels.map((channel) => (
          <article className="admin-movie-row" key={channel.id}>
            <div className="admin-movie-thumb">
              <LogoPreview channel={channel} compact />
            </div>
            <div className="admin-movie-main">
              <strong>{channel.name}</strong>
              <p className="muted">{channel.slug}</p>
              <div className="meta-line">
                <span>{channel.is_active ? "active" : "inactive"}</span>
                <span>{channel.item_count || 0} linked titles</span>
                <span>Order {channel.sort_order || 0}</span>
              </div>
            </div>
            <div className="admin-row-actions">
              <button className="button" type="button" onClick={() => editChannel(channel)}>Edit</button>
              <button className="button danger" type="button" onClick={() => setDeleteTarget(channel)}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </article>
        ))}
        {!channels.length ? <div className="empty">No channels yet.</div> : null}
      </div>
    </div>
  );
}
