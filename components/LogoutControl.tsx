"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function LogoutControl({
  className = "panel logout-panel"
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function confirmLogout() {
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setMessage({ type: "success", text: "Logged out successfully" });
      window.setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    } catch {
      setMessage({ type: "error", text: "Could not logout. Try again." });
      setLoading(false);
    }
  }

  return (
    <>
      <div className={className}>
        <div>
          <h2>Logout</h2>
          <p className="muted">Sign out from this account and choose another Gmail anytime.</p>
        </div>
        {message ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
        <button className="button danger logout-bottom-button" onClick={() => setOpen(true)} disabled={loading} type="button">
          <LogOut size={18} /> {loading ? "Logging out..." : "Logout"}
        </button>
      </div>

      {open ? (
        <div className="admin-action-modal-backdrop logout-modal-backdrop" role="presentation" onMouseDown={() => !loading && setOpen(false)}>
          <section
            aria-labelledby="logout-modal-title"
            aria-modal="true"
            className="admin-action-modal logout-modal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="section-head">
              <div>
                <p className="status-badge status-hidden">Account action</p>
                <h2 id="logout-modal-title">Logout?</h2>
                <p className="muted">Are you sure you want to logout from this account?</p>
              </div>
              <LogOut size={22} />
            </div>
            {message ? <p className={`form-message ${message.type}`}>{message.text}</p> : null}
            <div className="admin-action-modal-actions">
              <button className="button" onClick={() => setOpen(false)} disabled={loading} type="button">
                Cancel
              </button>
              <button className="button danger" onClick={confirmLogout} disabled={loading} type="button">
                {loading ? "Logging out..." : "Logout"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
