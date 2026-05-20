"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Heart, LogIn, LogOut, MessageSquare, Moon, Share2, Settings } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ProfileMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function login() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    });
  }

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setEmail(null);
  }

  async function share() {
    const title = "WatchFinder";
    if (navigator.share) await navigator.share({ title, url: window.location.origin });
    else await navigator.clipboard.writeText(window.location.origin);
  }

  return (
    <div className="form-grid">
      <div className="panel">
        <div className="platform-logo">WF</div>
        <h2>{email ? "Your Account" : "Sign in"}</h2>
        <p className="muted">{email || "Sign in to save favorites and watch history."}</p>
        {email ? (
          <button className="button" onClick={logout} type="button">
            <LogOut size={18} /> Logout
          </button>
        ) : (
          <button className="button primary" onClick={login} type="button">
            <LogIn size={18} /> Login with Google
          </button>
        )}
      </div>

      <div className="grid">
        <Link className="panel" href="/favorites"><Heart size={22} /> <strong>Favorites</strong></Link>
        <Link className="panel" href="/history"><Clock size={22} /> <strong>Watch History</strong></Link>
        <Link className="panel" href="/feedback"><MessageSquare size={22} /> <strong>Feedback</strong></Link>
        <Link className="panel" href="/settings"><Settings size={22} /> <strong>Settings</strong></Link>
        <button className="panel" onClick={share} type="button"><Share2 size={22} /> <strong>Share WatchFinder</strong></button>
        <div className="panel"><Moon size={22} /> <strong>Dark mode</strong><p className="muted">Enabled by default</p></div>
      </div>

      <div className="panel">
        <h2>Official Contact</h2>
        <p className="muted">Customer service details can be managed later from site settings.</p>
      </div>
    </div>
  );
}
