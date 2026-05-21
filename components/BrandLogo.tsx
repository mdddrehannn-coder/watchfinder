import Image from "next/image";
import Link from "next/link";
import { cx } from "@/lib/format";

export default function BrandLogo({
  href = "/",
  variant = "header",
  showText = true
}: {
  href?: string;
  variant?: "header" | "auth" | "profile" | "splash";
  showText?: boolean;
}) {
  const content = (
    <>
      <span className="brand-logo-mark-shell" aria-hidden="true">
        <Image
          className="brand-logo-mark brand-logo-mark-dark"
          src="/brand/watchfinder-icon-dark.png"
          alt=""
          width={variant === "header" ? 44 : 76}
          height={variant === "header" ? 44 : 76}
          priority={variant === "header"}
        />
        <Image
          className="brand-logo-mark brand-logo-mark-light"
          src="/brand/watchfinder-icon-light.png"
          alt=""
          width={variant === "header" ? 44 : 76}
          height={variant === "header" ? 44 : 76}
          priority={variant === "header"}
        />
      </span>
      {showText ? (
        <span className="brand-wordmark-shell" aria-label="WatchFinder">
          <Image
            className="brand-wordmark brand-wordmark-dark"
            src="/brand/watchfinder-wordmark-dark.png"
            alt="WatchFinder"
            width={variant === "header" ? 180 : 240}
            height={variant === "header" ? 60 : 80}
            priority={variant === "header"}
          />
          <Image
            className="brand-wordmark brand-wordmark-light"
            src="/brand/watchfinder-wordmark-light.png"
            alt="WatchFinder"
            width={variant === "header" ? 180 : 240}
            height={variant === "header" ? 60 : 80}
            priority={variant === "header"}
          />
        </span>
      ) : null}
    </>
  );

  if (!href) {
    return <div className={cx("brand-logo", `brand-logo-${variant}`)}>{content}</div>;
  }

  return (
    <Link className={cx("brand-logo", `brand-logo-${variant}`)} href={href}>
      {content}
    </Link>
  );
}
