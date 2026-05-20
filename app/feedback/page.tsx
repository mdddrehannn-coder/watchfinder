import type { Metadata } from "next";
import FeedbackForm from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Contact WatchFinder with feedback or corrections."
};

export default function FeedbackPage() {
  return (
    <main className="page-inner">
      <h1>Feedback</h1>
      <p className="muted">Send corrections, suggestions, license questions or platform updates.</p>
      <section className="section">
        <FeedbackForm />
      </section>
    </main>
  );
}
