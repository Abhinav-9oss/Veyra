import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, UserCheck, Users as UsersIcon, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, EmptyState, Loader, useToast } from "@/components/ui";
import { cn } from "@/utils/cn";
import type { Profile } from "@/types/database";

export function DiscoverPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState<"people" | "communities">("people");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [communities, setCommunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [peopleRes, commRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url, bio, is_private")
        .neq("id", user?.id || "")
        .limit(40),
      supabase
        .from("communities")
        .select(
          `id, name, slug, description, is_private,
           member_count:community_members(count)`
        )
        .eq("is_private", false)
        .limit(30),
    ]);

    let following = new Set<string>();
    let joined = new Set<string>();
    if (user) {
      const [fRes, jRes] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", user.id),
        supabase.from("community_members").select("community_id").eq("user_id", user.id),
      ]);
      following = new Set((fRes.data || []).map((x: any) => x.following_id));
      joined = new Set((jRes.data || []).map((x: any) => x.community_id));
    }
    setPeople((peopleRes.data || []) as Profile[]);
    setCommunities(
      (commRes.data || []).map((c: any) => ({
        ...c,
        member_count: c.member_count?.[0]?.count ?? 0,
      }))
    );
    setFollowingIds(following);
    setJoinedIds(joined);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleFollow(target: Profile) {
    if (!user) return;
    const isFollowing = followingIds.has(target.id);
    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", target.id);
      setFollowingIds((s) => {
        const n = new Set(s);
        n.delete(target.id);
        return n;
      });
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: target.id });
      await supabase.from("notifications").insert({
        user_id: target.id,
        actor_id: user.id,
        type: "follow",
      });
      setFollowingIds((s) => new Set(s).add(target.id));
      push("success", `Following ${target.display_name}`);
    }
  }

  async function toggleJoin(c: any) {
    if (!user) return;
    if (joinedIds.has(c.id)) {
      await supabase.from("community_members").delete().eq("community_id", c.id).eq("user_id", user.id);
      setJoinedIds((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
    } else {
      await supabase.from("community_members").insert({ community_id: c.id, user_id: user.id });
      setJoinedIds((s) => new Set(s).add(c.id));
      push("success", `Joined ${c.name}`);
    }
  }

  const q = query.toLowerCase();
  const filteredPeople = people.filter(
    (p) => !q || p.display_name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
  );
  const filteredComms = communities.filter(
    (c) => !q || c.name.toLowerCase().includes(q) || c.slug.includes(q)
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold">Discover</h1>
        <p className="text-gray-500 text-sm mt-1">Find people to follow and communities to join.</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          className="input-field pl-10"
          placeholder={tab === "people" ? "Search people…" : "Search communities…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex gap-1 p-1 bg-ink-700/60 rounded-xl w-fit">
        {(["people", "communities"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
              tab === t ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <Loader label="Loading…" />
      ) : tab === "people" ? (
        filteredPeople.length === 0 ? (
          <EmptyState icon={<UserPlus className="w-10 h-10" />} title="No people found" description="Try a different search." />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {filteredPeople.map((p) => {
              const following = followingIds.has(p.id);
              return (
                <div key={p.id} className="card p-4 flex items-center gap-3 hover:border-white/20 transition-colors">
                  <Avatar src={p.avatar_url} name={p.display_name} size={44} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.display_name}</p>
                    <p className="text-xs text-gray-500 truncate">@{p.username}</p>
                    {p.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{p.bio}</p>}
                  </div>
                  <Button
                    variant={following ? "outline" : "primary"}
                    className="py-1.5 text-sm"
                    onClick={() => toggleFollow(p)}
                    icon={following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  >
                    {following ? "Following" : "Follow"}
                  </Button>
                </div>
              );
            })}
          </div>
        )
      ) : filteredComms.length === 0 ? (
        <EmptyState icon={<UsersIcon className="w-10 h-10" />} title="No communities found" description="Try a different search." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filteredComms.map((c) => {
            const joined = joinedIds.has(c.id);
            return (
              <div key={c.id} className="card p-4 flex items-center gap-3 hover:border-white/20 transition-colors">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center shrink-0">
                  <UsersIcon className="w-5 h-5 text-violet-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.member_count} members · @{c.slug}</p>
                </div>
                <Button
                  variant={joined ? "outline" : "primary"}
                  className="py-1.5 text-sm"
                  onClick={() => toggleJoin(c)}
                >
                  {joined ? "Joined" : "Join"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
