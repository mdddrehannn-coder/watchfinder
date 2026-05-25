import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "WatchFinder privacy policy for accounts, analytics, feedback and app usage."
};

export default function PrivacyPolicyPage() {
  return (
    <InfoPageShell
      title="Privacy Policy"
      subtitle="WatchFinder collects only the information needed to run accounts, improve discovery, protect the service and understand basic audience activity."
      sections={[
        {
          title: "Account Information",
          body: "If you sign up, WatchFinder may store your email and profile details needed for authentication, favorites, watch history and admin access."
        },
        {
          title: "Privacy-friendly Analytics",
          body: "Analytics track page views, searches, movie views, trailer interactions, sessions, device type and browser type. WatchFinder does not store raw IP addresses."
        },
        {
          title: "Feedback And Messages",
          body: "Feedback submissions may include the name, email and message you provide so the team can understand and respond to the request."
        },
        {
          title: "Third-party Links",
          body: "Official watch links may open external platforms such as YouTube or OTT services. Their privacy practices are controlled by those services, not WatchFinder."
        }
      ]}
    />
  );
}
