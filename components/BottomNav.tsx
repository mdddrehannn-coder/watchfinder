"use client";

import Link from "next/link";
import { Clapperboard, Compass, Home, Tags, UserRound } from "lucide-react";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Streaming", href: "/platforms", icon: Clapperboard },
  { label: "Categories", href: "/categories", icon: Tags },
  { label: "Offers", href: "/offers", icon: Compass },
  { label: "Profile", href: "/profile", icon: UserRound }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link href={item.href} key={item.href}>
            <Icon size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
