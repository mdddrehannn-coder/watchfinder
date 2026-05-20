"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function HeaderAuthButton() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [nextPath, setNextPath] = useState("/profile");

  useEffect(() => {
    setNextPath(`${window.location.pathname}${window.location.search}`);

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setLoggedIn(Boolean(data.user)));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session?.user));
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <Link className={loggedIn ? "button" : "button primary"} href={loggedIn ? "/profile" : `/login?next=${encodeURIComponent(nextPath)}`}>
      <UserRound size={17} />
      {loggedIn ? "Profile" : "Login"}
    </Link>
  );
}
