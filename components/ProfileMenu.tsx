"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Heart, LogIn, LogOut, MessageSquare, Settings, ShieldCheck, Share2, SunMoon } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import InstallAppButton from "@/components/InstallAppButton";
import { isAdminEmail } from "@/lib/admin-access";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useFavorites, useWatchHistory } from "@/lib/user-library";

export default function ProfileMenu({
  accessDenied = false,
  initialEmail,
  initiallyAdmin = false,
  initiallyLoggedIn = false
}: {
  accessDenied?: boolean;
  initialEmail: string;
  initiallyAdmin?: boolean;
  initiallyLoggedIn?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loggedIn, setLoggedIn] = useState(initiallyLoggedIn);
  const [isAdmin, setIsAdmin] = useState(initiallyAdmin);
  const { favorites } = useFavorites();
  const { history } = useWatchHistory();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setLoggedIn(Boolean(data.user));
      setIsAdmin(isAdminEmail(data.user?.email));
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
      {accessDenied ? (
        <div className="status-error">Access denied. This Admin Panel is available only for the configured admin Gmail.</div>
      ) : null}

      <div className="panel">
        <BrandLogo href="" variant="profile" showText={false} />
        <h2>{loggedIn ? "Your Account" : "Guest Profile"}</h2>
        <p className="muted">{email}</p>
        {loggedIn ? (
          <button className="button" onClick={logout} type="button">
            <LogOut size={18} /> Logout
          </button>
        ) : (
          <Link className="button primary" href="/login?next=/profile">
            <LogIn size={18} /> Login to sync
          </Link>
        )}
      </div>

      <div className="grid">
        {loggedIn && isAdmin ? (
          <Link className="panel profile-action-card admin-profile-card" href="/admin">
            <ShieldCheck size={22} />
            <strong>Admin Panel</strong>
            <p className="muted">Manage content, AI Import, movies, series, users and settings</p>
          </Link>
        ) : null}
        <Link className="panel profile-action-card" href="/favorites"><Heart size={22} /> <strong>Favorites</strong><p className="muted">{favorites.length} saved</p></Link>
        <Link className="panel profile-action-card" href="/history"><Clock size={22} /> <strong>Watch History</strong><p className="muted">{history.length ? `${history.length} recent` : "No activity yet"}</p></Link>
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
