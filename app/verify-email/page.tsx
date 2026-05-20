import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailPanel from "@/components/VerifyEmailPanel";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Verify your WatchFinder account with the 6 digit code sent to your email."
};

export default function VerifyEmailPage() {
  return (
    <main className="page-inner">
      <Suspense fallback={<div className="skeleton" />}>
        <VerifyEmailPanel />
      </Suspense>
    </main>
  );
}
