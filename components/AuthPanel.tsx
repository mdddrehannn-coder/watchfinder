"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogIn, Mail, UserPlus } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function getSafeNext(value: string | null) {
  return value?.startsWith("/") ? value : "/profile";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email not confirmed") || normalized.includes("not confirmed")) {
    return "Please verify your email before logging in";
  }
  return message;
}

export default function AuthPanel({
  mode
}: {
  mode: "login" | "signup";
}) {
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));
  const isLogin = mode === "login";
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  function authCallbackUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function continueWithGoogle() {
    setError(null);
    setStatus("Opening Google sign in...");
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl() }
    });
    if (error) {
      setError(friendlyAuthError(error.message));
      setStatus(null);
      setBusy(false);
    }
  }

  async function sendEmailOtp() {
    setError(null);
    setStatus(null);
    const email = emailInput.trim();
    if (!email || !isValidEmail(email)) {
      setError("Enter a valid email to receive the login OTP.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: authCallbackUrl(),
          shouldCreateUser: true
        }
      });
      if (error) {
        setError(friendlyAuthError(error.message));
        return;
      }
      setStatus("Email OTP sent. Check your inbox to continue.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirm_password") || "");
    const supabase = createSupabaseBrowserClient();

    try {
      if (!email || !password) {
        setError("Email and password are required.");
        return;
      }

      if (!isValidEmail(email)) {
        setError("Please enter a valid email address.");
        return;
      }

      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      if (!isLogin && password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }

      if (isLogin) {
        const result = await supabase.auth.signInWithPassword({ email, password });

        if (result.error) {
          setError(friendlyAuthError(result.error.message));
          return;
        }

        setStatus("Login successful. Redirecting...");
        window.location.href = next;
        return;
      }

      const result = await supabase.auth.signUp({ email, password });

      if (result.error) {
        setError(friendlyAuthError(result.error.message));
        return;
      }

      await supabase.auth.signOut();
      setStatus("Verification code sent. Redirecting...");
      window.location.href = `/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <BrandLogo variant="auth" />
        <div>
          <h1>{isLogin ? "Welcome back" : "Create your WatchFinder account"}</h1>
          <p className="muted">
            {isLogin ? "Login to save favorites and watch history" : "Create an account to save favorites and watch history"}
          </p>
        </div>

        <div className="auth-provider-stack">
          <button className="button primary auth-submit" type="button" onClick={continueWithGoogle} disabled={busy}>
            <LogIn size={19} /> Continue with Google
          </button>
        </div>

        <div className="auth-divider"><span>or continue with email password</span></div>

        <form className="form-grid" onSubmit={submit}>
          <div className="field">
            <label htmlFor={`${mode}-email`}>Email</label>
            <input
              id={`${mode}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
            />
            {isLogin ? (
              <button className="button auth-otp-button" type="button" onClick={sendEmailOtp} disabled={busy}>
                <Mail size={17} /> Send email OTP
              </button>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor={`${mode}-password`}>Password</label>
            <input
              id={`${mode}-password`}
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>
          {!isLogin ? (
            <div className="field">
              <label htmlFor="signup-confirm-password">Confirm password</label>
              <input
                id="signup-confirm-password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          ) : null}
          {error ? <p className="auth-error">{error}</p> : null}
          {status ? <p className="legal-badge">{status}</p> : null}
          <button className="button primary auth-submit" type="submit" disabled={busy}>
            {isLogin ? <LogIn size={19} /> : <UserPlus size={19} />}
            {busy ? "Please wait..." : isLogin ? "Login" : "Create account"}
          </button>
        </form>

        <p className="muted auth-switch">
          {isLogin ? "New to WatchFinder? " : "Already have an account? "}
          <Link href={isLogin ? `/signup?next=${encodeURIComponent(next)}` : `/login?next=${encodeURIComponent(next)}`}>
            {isLogin ? "Create account" : "Login"}
          </Link>
        </p>
        {isLogin ? (
          <p className="muted auth-switch">
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
