import { useCallback, useEffect, useState } from "react";
import { Users, Plus, Lock, Globe, Search, ArrowLeft, UserPlus, UserMinus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, EmptyState, Loader, Modal, useToast } from "@/components/ui";
import { slugify, timeAgo } from "@/utils/time";
import { cn } from "@/utils/cn";
import type { Community, CommunityMember, Profile } from "@/types/database";

export function CommunitiesPage() {
  const { user, profile } = useAuth();
  const { push } = useToast();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Community | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("communities")
      .select(
        `id, owner_id, name, slug, description, avatar_url, is_private, created_at,
         owner:profiles!communities_owner_id_fkey(id, display_name, username, avatar_url),
         member_count:community_members(count)`
      )
      .order("created_at", { ascending: false });
    if (error) {
      push("error", error.message);
      setLoading(false);
      return;
    }
    // Determine joined status
    let joinedIds = new Set<string>();
    if (user && data && data.length) {
      const { data: mine } = await supabase
        .from("community_members")
        .select("community_id")
        .eq("user_id", user.id);
      joinedIds = new Set((mine || []).map((m: any) => m.community_id));
    }
    setConversations(
      (data || []).map((c: any) => ({
        ...c,
        owner: c.owner,
        member_count: c.member_count?.[0]?.count ?? 0,
        joined: joinedIds.has(c.id),
      }))
    );
    setLoading(false);
  }, [user, push]);

  // helper to satisfy TS for setCommunities rename
  const setConversations = setCommunities;

  useEffect(() => {
    load();
  }, [load]);

  async function openCommunity(c: Community) {
    setActive(c);
    setLoadingMembers(true);
    const { data } = await supabase
      .from("community_members")
      .select(
        `id, community_id, user_id, role, created_at,
         profile:profiles!community_members_user_id_fkey(id, display_name, username, avatar_url)`
      )
      .eq("community_id", c.id);
    setMembers((data || []) as unknown as CommunityMember[]);
    setLoadingMembers(false);
  }

  async function toggleJoin(c: Community) {
    if (!user) return;
    if (c.joined) {
      await supabase
        .from("community_members")
        .delete()
        .eq("community_id", c.id)
        .eq("user_id", user.id);
      push("info", `Left ${c.name}`);
    } else {
      await supabase
        .from("community_members")
        .insert({ community_id: c.id, user_id: user.id });
      push("success", `Joined ${c.name}`);
    }
    load();
    if (active?.id === c.id) {
      openCommunity({ ...c, joined: !c.joined });
    }
  }

  async function create() {
    if (!user || !name.trim()) return;
    setBusy(true);
    const slug = slugify(name) || `community-${Date.now()}`;
    const { data, error } = await supabase
      .from("communities")
      .insert({
        owner_id: user.id,
        name: name.trim(),
        slug,
        description: description.trim(),
        is_private: isPrivate,
      })
      .select("*")
      .maybeSingle();
    if (error) {
      push("error", error.message.includes("unique") ? "That slug is taken, try a different name" : error.message);
      setBusy(false);
      return;
    }
    // join as owner
    if (data) {
      await supabase
        .from("community_members")
        .insert({ community_id: data.id, user_id: user.id, role: "admin" });
    }
    setBusy(false);
    setCreateOpen(false);
    setName("");
    setDescription("");
    setIsPrivate(false);
    push("success", "Community created");
    load();
  }

  const filtered = communities.filter((c) => {
    if (tab === "mine" && !c.joined) return false;
    if (search) {
      return (
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.slug.includes(search.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Communities</h1>
          <p className="text-gray-500 text-sm mt-1">Public and private spaces for any interest.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>
          New community
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input-field pl-10"
            placeholder="Search communities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 p-1 bg-ink-700/60 rounded-xl">
          {(["all", "mine"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
              )}
            >
              {t === "all" ? "All" : "My communities"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loader label="Loading communities…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10" />}
          title="No communities found"
          description={tab === "mine" ? "Join a community or create your own." : "Be the first to create one."}
          action={
            <Button onClick={() => setCreateOpen(true)} icon={<Plus className="w-4 h-4" />}>
              Create community
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="card p-5 hover:border-white/20 transition-colors cursor-pointer"
              onClick={() => openCommunity(c)}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-violet-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    {c.is_private ? (
                      <Lock className="w-3.5 h-3.5 text-gray-500" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">@{c.slug}</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-3 line-clamp-2 min-h-[2.5rem]">
                {c.description || "No description yet."}
              </p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-gray-500">{c.member_count ?? 0} members</span>
                <Button
                  variant={c.joined ? "outline" : "primary"}
                  className="py-1.5 text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleJoin(c);
                  }}
                  icon={c.joined ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                >
                  {c.joined ? "Leave" : "Join"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Community detail */}
      <Modal open={!!active} onClose={() => setActive(null)} title={active?.name} size="lg">
        {active && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {active.is_private ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              {active.is_private ? "Private community" : "Public community"} · @{active.slug}
            </div>
            <p className="text-sm text-gray-300">{active.description || "No description yet."}</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Avatar src={active.owner?.avatar_url} name={active.owner?.display_name} size={24} />
              Owned by {active.owner?.display_name || "unknown"} · created {timeAgo(active.created_at)}
            </div>
            <div className="flex justify-end">
              <Button
                variant={active.joined ? "outline" : "primary"}
                onClick={() => toggleJoin(active)}
                icon={active.joined ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              >
                {active.joined ? "Leave community" : "Join community"}
              </Button>
            </div>
            <div className="border-t border-white/10 pt-4">
              <h4 className="text-sm font-semibold mb-3">Members ({members.length})</h4>
              {loadingMembers ? (
                <Loader className="py-4" />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3">
                      <Avatar src={m.profile?.avatar_url} name={m.profile?.display_name} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {m.profile?.display_name || "User"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">@{m.profile?.username}</p>
                      </div>
                      {m.role === "admin" && <span className="chip">Admin</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create community">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Name</label>
            <input className="input-field" placeholder="e.g. Deep Space Explorers" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-gray-600 mt-1">slug: {slugify(name) || "—"}</p>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1.5 block">Description</label>
            <textarea className="input-field min-h-[90px] resize-none" placeholder="What's this community about?" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setIsPrivate((s) => !s)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors relative",
                isPrivate ? "bg-violet-600" : "bg-white/10"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform",
                  isPrivate ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>
            <span className="text-sm text-gray-300 flex items-center gap-1.5">
              {isPrivate ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
              {isPrivate ? "Private — only members can see it" : "Public — anyone can find it"}
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create} loading={busy} disabled={!name.trim()}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
