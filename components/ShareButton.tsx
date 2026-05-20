"use client";

import { Share2 } from "lucide-react";

export default function ShareButton({ title }: { title: string }) {
  async function share() {
    if (navigator.share) {
      await navigator.share({ title, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <button className="button ghost" type="button" onClick={share}>
      <Share2 size={18} /> Share
    </button>
  );
}
