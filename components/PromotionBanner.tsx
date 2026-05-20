import Link from "next/link";
import type { Promotion } from "@/types/watchfinder";

export default function PromotionBanner({ promotion }: { promotion?: Promotion | null }) {
  if (!promotion) return null;
  const content = (
    <>
      {promotion.image_url ? <img src={promotion.image_url} alt={promotion.title} /> : null}
      <div className="banner-content">
        <strong>{promotion.title}</strong>
        {promotion.description ? <p className="muted">{promotion.description}</p> : null}
      </div>
    </>
  );

  return promotion.link_url ? (
    <Link className="banner" href={promotion.link_url}>
      {content}
    </Link>
  ) : (
    <div className="banner">{content}</div>
  );
}
