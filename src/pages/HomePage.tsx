import { Sparkles, RefreshCw } from "lucide-react";
import { ComposeBox, PostCard } from "@/components/PostCard";
import { useFeed } from "@/hooks/useFeed";
import { Loader, EmptyState, Button } from "@/components/ui";

export function HomePage() {
  const { posts, loading, error, reload } = useFeed();

  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-6 md:p-8 bg-gradient-to-br from-violet-900/40 via-ink-700/60 to-electric-900/20 border border-white/10 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 chip mb-3">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Your digital world
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Welcome to Veyra</h1>
          <p className="text-gray-400 mt-2 max-w-xl">
            Connect with people, join communities, and talk to your AI assistant — all in one place.
          </p>
        </div>
      </div>

      <ComposeBox onPosted={reload} />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Feed</h2>
        <Button variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={reload}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Loader label="Loading feed…" />
      ) : error ? (
        <div className="card p-6 text-red-300 text-sm">{error}</div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-10 h-10" />}
          title="No posts yet"
          description="Be the first to share something. Write a post above and it'll show up here."
        />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onDelete={reload} />
          ))}
        </div>
      )}
    </div>
  );
}
