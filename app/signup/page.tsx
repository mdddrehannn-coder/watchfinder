import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Signup",
  description: "Create your WatchFinder account with Supabase Auth."
};

export default function SignupPage() {
  return (
    <main className="page-inner">
      <Suspense fallback={<div className="skeleton" />}>
        <AuthPanel mode="signup" />
      </Suspense>
    </main>
  );
}
