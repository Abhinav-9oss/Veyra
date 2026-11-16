import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Edit3,
  MapPin,
  Globe,
  Calendar,
  Shield,
  Ban,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, EmptyState, Loader, Modal, useToast } from "@/components/ui";
import { PostCard } from "@/components/PostCard";
import { timeAgo } from "@/utils/time";
import { cn } from "@/utils/cn";
import type { Block, Post, Profile } from "@/types/database";

export function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    location: "",
    website: "",
    is_private: false,
  });
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [tab, setTab] = useState<"posts" | "settings" | "blocked">("posts");
  const [blocked, setBlocked] = useState<(Block & { profile?: Profile })[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadPosts = useCallback(async () => {
    if (!user) return;
    setLoadingPosts(true);
    const { data } = await supabase
      .from("posts")
      .select(
        `id, author_id, content, image_url, created_at,
         author:profiles!posts_author_id_fkey(id, display_name, username, avatar_url, is_private),
         like_count:likes(count),
         comment_count:comments(count)`
      )
      .eq("author_id", user.id)
      .order("created_at", { ascending: false });
    const shaped: Post[] = (data || []).map((p: any) => ({
      id: p.id,
      author_id: p.author_id,
      content: p.content,
      image_url: p.image_url,
      created_at: p.created_at,
      author: p.author,
      like_count: p.like_count?.[0]?.count ?? 0,
      comment_count: p.comment_count?.[0]?.count ?? 0,
    }));
    setPosts(shaped);
    setLoadingPosts(false);
  }, [user]);

  const loadBlocked = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("blocks")
      .select(
        `id, blocker_id, blocked_id, created_at,
         profile:profiles!blocks_blocked_id_fkey(id, display_name, username, avatar_url)`
      )
      .eq("blocker_id", user.id);
    setBlocked((data || []) as unknown as (Block & { profile?: Profile })[]);
  }, [user]);

  useEffect(() => {
    loadPosts();
    loadBlocked();
  }, [loadPosts, loadBlocked]);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
        location: profile.location || "",
        website: profile.website || "",
        is_private: profile.is_private,
      });
    }
  }, [profile]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true });
    if (upErr) {
      push("error", "Upload failed: " + upErr.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl })
      .eq("id", user.id);
    setUploading(false);
    if (updErr) {
      push("error", "Could not update profile picture");
    } else {
      await refreshProfile();
      push("success", "Profile picture updated");
    }
  }

  async function saveProfile() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: form.display_name.trim() || profile?.username || "User",
        username: form.username.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        website: form.website.trim(),
        is_private: form.is_private,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      push("error", error.message.includes("username") ? "Username already taken" : error.message);
      return;
    }
    await refreshProfile();
    setEditing(false);
    push("success", "Profile updated");
  }

  async function unblock(b: Block) {
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user!.id)
      .eq("blocked_id", b.blocked_id);
    if (error) {
      push("error", "Could not unblock user");
      return;
    }
    loadBlocked();
    push("info", "User unblocked");
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="card overflow-hidden">
        <div className="h-32 md:h-40 bg-gradient-to-br from-violet-700/40 via-electric-700/20 to-ink-700 relative">
          <div className="absolute inset-0 bg-grid-faint bg-[size:24px_24px] opacity-30" />
        </div>
        <div className="px-5 md:px-7 pb-6 -mt-12 md:-mt-14">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div className="relative">
              <div className="ring-4 ring-ink-800 rounded-full">
                <Avatar
                  src={profile?.avatar_url}
                  name={profile?.display_name}
                  size={96}
                  ring
                />
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-violet-600 hover:bg-violet-500 flex items-center justify-center shadow-glow transition-colors"
                aria-label="Change avatar"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadAvatar(f);
                  e.target.value = "";
                }}
              />
            </div>
            <Button variant="outline" onClick={() => setEditing(true)} icon={<Edit3 className="w-4 h-4" />}>
              Edit profile
            </Button>
          </div>

          <div className="mt-4">
            <h1 className="font-display text-2xl font-bold">
              {profile?.display_name || "New user"}
            </h1>
            <p className="text-gray-500">@{profile?.username}</p>
            {profile?.bio && <p className="text-gray-300 mt-2 max-w-xl">{profile.bio}</p>}
            <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
              {profile?.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> {profile.location}
                </span>
              )}
              {profile?.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-violet-300"
                >
                  <Globe className="w-4 h-4" /> {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {profile?.created_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Joined {timeAgo(profile.created_at)} ago
                </span>
              )}
              {profile?.is_private && (
                <span className="flex items-center gap-1.5 text-violet-300">
                  <Shield className="w-4 h-4" /> Private
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-ink-700/60 rounded-xl w-fit">
        {([
          ["posts", "Posts"],
          ["settings", "Settings"],
          ["blocked", "Blocked"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === id ? "bg-violet-600 text-white" : "text-gray-400 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "posts" &&
        (loadingPosts ? (
          <Loader label="Loading posts…" />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={<Edit3 className="w-10 h-10" />}
            title="No posts yet"
            description="Your published posts will show up here."
          />
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDelete={loadPosts} />
            ))}
          </div>
        ))}

      {tab === "settings" && (
        <div className="card p-6 max-w-xl space-y-4">
          <h3 className="font-display text-lg font-semibold">Account settings</h3>
          <div className="space-y-3">
            <SettingRow label="Display name">
              <input className="input-field" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </SettingRow>
            <SettingRow label="Username">
              <input className="input-field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </SettingRow>
            <SettingRow label="Bio">
              <textarea className="input-field min-h-[80px] resize-none" maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </SettingRow>
            <SettingRow label="Location">
              <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </SettingRow>
            <SettingRow label="Website">
              <input className="input-field" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </SettingRow>
            <SettingRow label="Privacy">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_private: !form.is_private })}
                  className={cn("w-11 h-6 rounded-full transition-colors relative", form.is_private ? "bg-violet-600" : "bg-white/10")}
                >
                  <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform", form.is_private ? "translate-x-5" : "translate-x-0.5")} />
                </button>
                <span className="text-sm text-gray-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  {form.is_private ? "Private account" : "Public account"}
                </span>
              </label>
            </SettingRow>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={saveProfile} loading={saving} icon={<Check className="w-4 h-4" />}>Save changes</Button>
          </div>
          <div className="border-t border-white/10 pt-4 mt-4">
            <Button variant="danger" onClick={signOut} icon={<Trash2 className="w-4 h-4" />}>Sign out</Button>
          </div>
        </div>
      )}

      {tab === "blocked" &&
        (blocked.length === 0 ? (
          <EmptyState
            icon={<Ban className="w-10 h-10" />}
            title="No blocked users"
            description="People you block won't be able to contact you or see your content."
          />
        ) : (
          <div className="space-y-2 max-w-xl">
            {blocked.map((b) => (
              <div key={b.id} className="card p-3 flex items-center gap-3">
                <Avatar src={b.profile?.avatar_url} name={b.profile?.display_name} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{b.profile?.display_name || "User"}</p>
                  <p className="text-xs text-gray-500 truncate">@{b.profile?.username}</p>
                </div>
                <Button variant="outline" className="py-1.5 text-sm" onClick={() => unblock(b)}>Unblock</Button>
              </div>
            ))}
          </div>
        ))}

      {/* Edit modal */}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit profile" size="lg">
        <div className="space-y-4">
          <SettingRow label="Display name">
            <input className="input-field" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </SettingRow>
          <SettingRow label="Username">
            <input className="input-field" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </SettingRow>
          <SettingRow label="Bio">
            <textarea className="input-field min-h-[80px] resize-none" maxLength={200} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </SettingRow>
          <SettingRow label="Location">
            <input className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </SettingRow>
          <SettingRow label="Website">
            <input className="input-field" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </SettingRow>
          <SettingRow label="Privacy">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() => setForm({ ...form, is_private: !form.is_private })}
                className={cn("w-11 h-6 rounded-full transition-colors relative", form.is_private ? "bg-violet-600" : "bg-white/10")}
              >
                <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform", form.is_private ? "translate-x-5" : "translate-x-0.5")} />
              </button>
              <span className="text-sm text-gray-300">{form.is_private ? "Private" : "Public"}</span>
            </label>
          </SettingRow>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button onClick={saveProfile} loading={saving}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm text-gray-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
