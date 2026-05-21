"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Heart, LogOut, MessageSquare, Share2, Settings, SunMoon } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import InstallAppButton from "@/components/InstallAppButton";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function ProfileMenu({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  async function logout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function share() {
    const title = "WatchFinder";
    if (navigator.share) await navigator.share({ title, url: window.location.origin });
    else await navigator.clipboard.writeText(window.location.origin);
  }

  return (
    <div className="form-grid">
      <div className="panel">
        <BrandLogo href="" variant="profile" />
        <h2>Your Account</h2>
        <p className="muted">{email}</p>
        <button className="button" onClick={logout} type="button">
          <LogOut size={18} /> Logout
        </button>
      </div>

      <div className="grid">
        <Link className="panel" href="/favorites"><Heart size={22} /> <strong>Favorites</strong></Link>
        <Link className="panel" href="/history"><Clock size={22} /> <strong>Watch History</strong></Link>
        <Link className="panel" href="/feedback"><MessageSquare size={22} /> <strong>Feedback</strong></Link>
        <Link className="panel" href="/settings"><Settings size={22} /> <strong>Settings</strong></Link>
        <Link className="panel" href="/settings/theme"><SunMoon size={22} /> <strong>Theme Settings</strong><p className="muted">Auto, Dark/Night, or Day/Light mode</p></Link>
        <button className="panel" onClick={share} type="button"><Share2 size={22} /> <strong>Share WatchFinder</strong></button>
      </div>

      <div className="panel install-app-card">
        <h2>Download My App</h2>
        <p className="muted">Install WatchFinder on your phone for quick access.</p>
        <InstallAppButton />
      </div>

      <div className="panel">
        <h2>Official Contact</h2>
        <p className="muted">Customer service details can be managed later from site settings.</p>
      </div>
    </div>
  );
}
