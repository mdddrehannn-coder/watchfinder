import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPanel from "@/components/AuthPanel";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to WatchFinder to save favorites and watch history."
};

export default function LoginPage() {
  return (
    <main className="page-inner">
      <Suspense fallback={<div className="skeleton" />}>
        <AuthPanel mode="login" />
      </Suspense>
    </main>
  );
}
