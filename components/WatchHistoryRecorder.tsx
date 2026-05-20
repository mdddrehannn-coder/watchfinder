"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function WatchHistoryRecorder({ movieId }: { movieId: string }) {
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!user) return;
      await supabase
        .from("watch_history")
        .upsert(
          {
            user_id: user.id,
            movie_id: movieId,
            watched_at: new Date().toISOString()
          },
          { onConflict: "user_id,movie_id" }
        );
    });
  }, [movieId]);

  return null;
}
