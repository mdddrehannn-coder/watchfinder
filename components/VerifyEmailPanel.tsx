"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { MailCheck, RotateCcw } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function getSafeNext(value: string | null) {
  return value?.startsWith("/") ? value : "/profile";
}

function friendlyOtpError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired")) {
    return "This verification code has expired. Please request a new code.";
  }
  if (normalized.includes("invalid") || normalized.includes("token")) {
    return "The verification code is incorrect. Please check your email and try again.";
  }
  return message;
}

export default function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const next = getSafeNext(searchParams.get("next"));
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    const token = otp.replace(/\D/g, "");
    if (!email) {
      setError("Email is missing. Please go back to signup.");
      return;
    }
    if (token.length !== 6) {
      setError("Enter the 6 digit verification code from your email.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup"
      });

      if (verifyError) {
        setError(friendlyOtpError(verifyError.message));
        return;
      }

      setStatus("Account verified. Redirecting...");
      window.location.href = next;
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setStatus(null);

    if (!email) {
      setError("Email is missing. Please go back to signup.");
      return;
    }

    if (cooldown) {
      setStatus("Please wait before requesting another code.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email
      });

      if (resendError) {
        setError(friendlyOtpError(resendError.message));
        return;
      }

      setCooldown(60);
      setStatus("A new verification code has been sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/">
          Watch<span>Finder</span>
        </Link>
        <div>
          <h1>Verify your email</h1>
          <p className="muted">We sent a 6 digit verification code to your email</p>
          {email ? <p className="legal-badge">{email}</p> : null}
        </div>

        <form className="form-grid" onSubmit={verify}>
          <div className="field">
            <label htmlFor="otp">6 digit OTP</label>
            <input
              className="otp-input"
              id="otp"
              inputMode="numeric"
              maxLength={6}
              name="otp"
              pattern="[0-9]{6}"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          {status ? <p className="legal-badge">{status}</p> : null}
          <button className="button primary auth-submit" type="submit" disabled={busy}>
            <MailCheck size={19} />
            {busy ? "Verifying..." : "Verify Account"}
          </button>
        </form>

        <button className="button auth-submit" type="button" onClick={resend} disabled={busy || Boolean(cooldown)}>
          <RotateCcw size={18} />
          {cooldown ? `Resend in ${cooldown}s` : "Resend Code"}
        </button>

        <p className="muted auth-switch">
          <Link href="/signup">Back to signup</Link>
        </p>
      </section>
    </div>
  );
}
