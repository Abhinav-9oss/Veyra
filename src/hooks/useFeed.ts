import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import type { Post } from "@/types/database";

export function useFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("posts")
      .select(
        `id, author_id, content, image_url, created_at,
         author:profiles!posts_author_id_fkey(id, display_name, username, avatar_url, is_private),
         like_count:likes(count),
         comment_count:comments(count)`
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Determine which posts current user has liked
    let likedIds = new Set<string>();
    if (user && data && data.length > 0) {
      const { data: likes } = await supabase
        .from("likes")
        .select("post_id")
        .eq("user_id", user.id)
        .in(
          "post_id",
          data.map((p: any) => p.id)
        );
      likedIds = new Set((likes || []).map((l: any) => l.post_id));
    }

    const shaped: Post[] = (data || []).map((p: any) => ({
      id: p.id,
      author_id: p.author_id,
      content: p.content,
      image_url: p.image_url,
      created_at: p.created_at,
      author: p.author,
      like_count: p.like_count?.[0]?.count ?? 0,
      comment_count: p.comment_count?.[0]?.count ?? 0,
      liked_by_me: likedIds.has(p.id),
    }));

    setPosts(shaped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: new posts
  useEffect(() => {
    const channel = supabase
      .channel("posts-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "posts" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  return { posts, loading, error, reload: load };
}
