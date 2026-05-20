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
      <Image
        className="brand-logo-mark"
        src="/logo.png"
        alt="WatchFinder logo"
        width={variant === "header" ? 40 : 76}
        height={variant === "header" ? 40 : 76}
        priority={variant === "header"}
      />
      {showText ? (
        <span className="brand-logo-text">
          Watch<span>Finder</span>
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
