import type { Metadata } from "next";
import PromotionBanner from "@/components/PromotionBanner";
import EmptyState from "@/components/EmptyState";
import { getPromotions } from "@/lib/data";

export const metadata: Metadata = {
  title: "Offers",
  description: "Legal WatchFinder promotions and featured OTT updates."
};

export default async function OffersPage() {
  const promotions = await getPromotions("offers");
  return (
    <main className="page-inner">
      <h1>Offers</h1>
      <p className="muted">Brand-safe promotions only. No betting, forced popups, redirects or fake download ads.</p>
      <section className="section form-grid">
        {promotions.length ? promotions.map((promotion) => <PromotionBanner promotion={promotion} key={promotion.id} />) : <EmptyState title="No active offers" />}
      </section>
    </main>
  );
}
