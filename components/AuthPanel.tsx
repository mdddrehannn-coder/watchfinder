"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthPanel({
  mode
}: {
  mode: "login" | "signup";
}) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/profile";
  const isLogin = mode === "login";

  async function continueWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() }
    });
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          Watch<span>Finder</span>
        </Link>
        <div>
          <h1>{isLogin ? "Welcome back" : "Create your WatchFinder account"}</h1>
          <p className="muted">
            {isLogin ? "Login to save favorites and watch history" : "Sign up with Google to save favorites and watch history"}
          </p>
        </div>
        <button className="button primary auth-google" type="button" onClick={continueWithGoogle}>
          <LogIn size={19} />
          {isLogin ? "Continue with Google" : "Sign up with Google"}
        </button>
        <p className="muted auth-switch">
          {isLogin ? "New to WatchFinder? " : "Already have an account? "}
          <Link href={isLogin ? `/signup?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`}>
            {isLogin ? "Create account" : "Login"}
          </Link>
        </p>
      </section>
    </div>
  );
}
