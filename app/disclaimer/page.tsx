import type { Metadata } from "next";
import InfoPageShell from "@/components/InfoPageShell";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "WatchFinder disclaimer for official links, trailers and availability listings."
};

export default function DisclaimerPage() {
  return (
    <InfoPageShell
      title="Disclaimer"
      subtitle="WatchFinder is a discovery and availability guide. It does not promise free access to copyrighted movies unless a listing is clearly marked as legal and verified."
      sections={[
        {
          title: "Official Links",
          body: "Links may lead to external official platforms, creator channels or streaming services. WatchFinder is not responsible for external platform pricing, region limits or changes."
        },
        {
          title: "Trailer-only Listings",
          body: "Trailer-only pages are clearly marked. They are for discovery and do not mean WatchFinder hosts or provides full unauthorized videos."
        },
        {
          title: "Rights And Takedowns",
          body: "Rights holders can use the feedback/contact flow to request corrections. WatchFinder will review reported listings and update discovery information where appropriate."
        }
      ]}
    />
  );
}
