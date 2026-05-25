import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Terms",
  description: "WatchFinder terms for legal movie discovery and app usage."
};

export default function TermsPage() {
  return (
    <InfoPageShell
      title="Terms"
      subtitle="By using WatchFinder, you agree to use the service as a legal discovery guide for official links, trailers and availability information."
      sections={[
        {
          title: "Discovery Service",
          body: "WatchFinder helps users find official trailers, public-domain content, licensed videos and legal platform availability. It is not a piracy or torrent service."
        },
        {
          title: "No Unauthorized Use",
          body: "Do not use WatchFinder to request, share or promote unauthorized downloads, pirated streams, cracked apps or illegal access to copyrighted content."
        },
        {
          title: "Listing Accuracy",
          body: "Availability can change by country, provider and time. WatchFinder aims to keep information useful, but users should verify final availability on the official platform."
        },
        {
          title: "Admin Responsibility",
          body: "Admins should upload only accurate listings and use free/legal labels only when a full video is legally available through public-domain, licensed or creator-permitted rights."
        }
      ]}
    />
  );
}
