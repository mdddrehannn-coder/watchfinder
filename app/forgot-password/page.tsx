import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "WatchFinder password reset placeholder."
};

export default function ForgotPasswordPage() {
  return (
    <main className="page-inner">
      <section className="section panel profile-login-card">
        <div className="platform-logo">WF</div>
        <h1>Forgot password?</h1>
        <p className="muted">Password reset will be added here. For now, create a new account or contact support.</p>
        <Link className="button primary" href="/login">
          Back to login
        </Link>
      </section>
    </main>
  );
}
