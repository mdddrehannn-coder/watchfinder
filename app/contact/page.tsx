import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Contact WatchFinder",
  description: "Contact WatchFinder for feedback, corrections, legal requests and platform updates."
};

export default function ContactPage() {
  return (
    <InfoPageShell
      title="Contact"
      subtitle="Use the feedback page to report broken links, incorrect availability, legal concerns, content corrections, feature requests or partnership messages."
      cta={{ label: "Send Feedback", href: "/feedback" }}
      sections={[
        {
          title: "Content Corrections",
          body: "If a listing has the wrong title, platform, language, trailer or availability status, send the details and the movie page URL so it can be reviewed."
        },
        {
          title: "Legal Requests",
          body: "Rights holders and representatives can report listings that need correction or removal. WatchFinder is a discovery guide and will review official requests carefully."
        },
        {
          title: "General Feedback",
          body: "Suggestions for search, cartoons, TV shows, platform pages, accessibility and app install behavior are welcome through the feedback form."
        }
      ]}
    />
  );
}
