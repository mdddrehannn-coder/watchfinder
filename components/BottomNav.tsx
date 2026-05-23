"use client";

import Link from "next/link";
import { Clapperboard, Home, Smile, Tv, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Streaming", href: "/platforms", icon: Clapperboard },
  { label: "Cartoons", href: "/cartoons", icon: Smile },
  { label: "TV Shows", href: "/tv-shows", icon: Tv },
  { label: "Profile", href: "/profile", icon: UserRound }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link aria-current={isActive ? "page" : undefined} className={isActive ? "active" : undefined} href={item.href} key={item.href}>
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
