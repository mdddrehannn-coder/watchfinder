"use client";

import { FormEvent, useState } from "react";
import { Save } from "lucide-react";
import { slugify } from "@/lib/format";
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

  function editChannel(channel: ContentChannel) {
    setEditing(channel);
    setMessage(null);
  }

  async function saveChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing.name.trim()) {
      setMessage("Channel name is required.");
      return;
    }

    setSaving(true);
    setMessage("Saving channel...");
    const supabase = createSupabaseBrowserClient();
    const payload = {
      name: editing.name.trim(),
      slug: slugify(editing.slug || editing.name),
      channel_type: channelType,
      logo_url: editing.logo_url || null,
      description: editing.description || null,
      official_url: editing.official_url || null,
      sort_order: Number(editing.sort_order || 0),
      is_active: editing.is_active !== false,
      updated_at: new Date().toISOString()
    };

    const query = editing.id
      ? supabase.from("content_channels").update(payload).eq("id", editing.id)
      : supabase.from("content_channels").insert(payload);

    const { data, error } = await query.select("*").single();
    setSaving(false);
    if (error || !data) {
      setMessage(error?.message || "Channel save failed.");
      return;
    }

    setChannels((current) => {
      const exists = current.some((channel) => channel.id === data.id);
      if (exists) return current.map((channel) => channel.id === data.id ? { ...channel, ...data } : channel);
      return [...current, { ...data, item_count: 0 }].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    });
    setEditing(emptyChannel(channelType));
    setMessage("Channel saved.");
  }

  return (
    <div className="form-grid">
      <div>
        <h2>{title}</h2>
        <p className="muted">Create and edit channel cards used by public discovery pages.</p>
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
            <input value={editing.logo_url || ""} onChange={(event) => setEditing((current) => ({ ...current, logo_url: event.target.value }))} />
          </div>
          <div className="field">
            <label>Official URL</label>
            <input value={editing.official_url || ""} onChange={(event) => setEditing((current) => ({ ...current, official_url: event.target.value }))} />
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
        <div className="chip-row">
          <button className="button primary" type="submit" disabled={saving}>
            <Save size={18} /> {saving ? "Saving..." : editing.id ? "Update Channel" : "Add Channel"}
          </button>
          {editing.id ? <button className="button ghost" type="button" onClick={() => setEditing(emptyChannel(channelType))}>Cancel edit</button> : null}
        </div>
      </form>
      <div className="admin-movie-list">
        {channels.map((channel) => (
          <article className="admin-movie-row" key={channel.id}>
            <div className="admin-movie-thumb">
              {channel.logo_url ? <img src={channel.logo_url} alt="" /> : <span>{channel.name.slice(0, 1)}</span>}
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
            </div>
          </article>
        ))}
        {!channels.length ? <div className="empty">No channels yet.</div> : null}
      </div>
    </div>
  );
}
