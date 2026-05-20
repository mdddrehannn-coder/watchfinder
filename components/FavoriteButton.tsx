"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function FavoriteButton({ movieId }: { movieId: string }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setUserId(user?.id ?? null);
      if (!user) return;
      const { data: favorite } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", user.id)
        .eq("movie_id", movieId)
        .maybeSingle();
      setFavoriteId(favorite?.id ?? null);
    });
  }, [movieId]);

  async function toggleFavorite() {
    const supabase = createSupabaseBrowserClient();
    setBusy(true);
    try {
      if (!userId) {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback` }
        });
        return;
      }
      if (favoriteId) {
        await supabase.from("favorites").delete().eq("id", favoriteId);
        setFavoriteId(null);
      } else {
        const { data } = await supabase
          .from("favorites")
          .insert({ user_id: userId, movie_id: movieId })
          .select("id")
          .single();
        setFavoriteId(data?.id ?? null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="button" type="button" onClick={toggleFavorite} disabled={busy}>
      <Heart size={18} fill={favoriteId ? "currentColor" : "none"} /> {favoriteId ? "Favorited" : "Add to favorites"}
    </button>
  );
}
