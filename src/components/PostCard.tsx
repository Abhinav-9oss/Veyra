import { useState } from "react";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Flag,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, Modal, useToast } from "@/components/ui";
import { timeAgo } from "@/utils/time";
import type { Post, Comment, Profile } from "@/types/database";
import { cn } from "@/utils/cn";

export function PostCard({ post, onDelete }: { post: Post; onDelete?: () => void }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [liked, setLiked] = useState(post.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState(false);

  const isMine = user?.id === post.author_id;

  async function toggleLike() {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase.from("likes").delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      await supabase.from("likes").insert({ user_id: user.id, post_id: post.id });
      if (post.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.author_id,
          actor_id: user.id,
          type: "like",
          entity_id: post.id,
        });
      }
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    const { data } = await supabase
      .from("comments")
      .select(
        `id, post_id, author_id, content, created_at,
         author:profiles!comments_author_id_fkey(id, display_name, username, avatar_url)`
      )
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments((data || []) as unknown as Comment[]);
    setLoadingComments(false);
  }

  async function sendComment() {
    if (!user || !commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");
    const { data } = await supabase
      .from("comments")
      .insert({ post_id: post.id, author_id: user.id, content: text })
      .select(
        `id, post_id, author_id, content, created_at,
         author:profiles!comments_author_id_fkey(id, display_name, username, avatar_url)`
      )
      .maybeSingle();
    if (data) {
      setComments((prev) => [...prev, data as unknown as Comment]);
      if (post.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.author_id,
          actor_id: user.id,
          type: "comment",
          entity_id: post.id,
        });
      }
    }
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    setBusy(false);
    setMenuOpen(false);
    if (error) {
      push("error", "Could not delete post");
    } else {
      push("success", "Post deleted");
      onDelete?.();
    }
  }

  async function report() {
    if (!user || !reportReason.trim()) return;
    setBusy(true);
    await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "post",
      target_id: post.id,
      reason: reportReason.trim(),
    });
    setBusy(false);
    setReportOpen(false);
    setReportReason("");
    push("success", "Report submitted. Thank you.");
  }

  return (
    <article className="card p-5 animate-fade-in hover:border-white/20 transition-colors">
      <div className="flex items-start gap-3">
        <Avatar src={post.author?.avatar_url} name={post.author?.display_name} size={44} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">
              {post.author?.display_name || "Unknown"}
            </span>
            <span className="text-gray-500 text-sm">@{post.author?.username}</span>
            <span className="text-gray-600 text-sm">· {timeAgo(post.created_at)}</span>
          </div>
          <p className="mt-2 text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
            {post.content}
          </p>
          {post.image_url && (
            <img
              src={post.image_url}
              alt=""
              className="mt-3 rounded-xl border border-white/10 max-h-96 w-full object-cover"
              referrerPolicy="no-referrer"
            />
          )}

          <div className="flex items-center gap-1 mt-4">
            <button
              onClick={toggleLike}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
                liked
                  ? "text-violet-300 bg-violet-500/10"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Heart className={cn("w-4 h-4", liked && "fill-current")} />
              {likeCount > 0 && likeCount}
            </button>
            <button
              onClick={() => {
                setShowComments((s) => {
                  const next = !s;
                  if (next && comments.length === 0) loadComments();
                  return next;
                });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              {(post.comment_count ?? 0) > 0 && (post.comment_count ?? 0)}
            </button>

            <div className="ml-auto relative">
              <button
                onClick={() => setMenuOpen((s) => !s)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5"
                aria-label="Post menu"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 glass-strong rounded-xl py-1 z-20"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setReportOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                  >
                    <Flag className="w-4 h-4" /> Report post
                  </button>
                  {isMine && (
                    <button
                      onClick={remove}
                      disabled={busy}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-white/5"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {showComments && (
            <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
              {loadingComments ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-500">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar src={c.author?.avatar_url} name={c.author?.display_name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {c.author?.display_name || "User"}
                        </span>
                        <span className="text-xs text-gray-600">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-gray-300 break-words">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
              {user && (
                <div className="flex gap-2 pt-1">
                  <input
                    className="input-field py-2 text-sm"
                    placeholder="Write a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  />
                  <Button onClick={sendComment} className="px-3" aria-label="Send">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report post">
        <p className="text-sm text-gray-400 mb-3">
          Help us keep Veyra safe. Tell us what's wrong with this post.
        </p>
        <textarea
          className="input-field min-h-[100px] resize-none"
          placeholder="Describe the issue…"
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="ghost" onClick={() => setReportOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={report} disabled={!reportReason.trim()}>
            Submit report
          </Button>
        </div>
      </Modal>
    </article>
  );
}

export function ComposeBox({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const { push } = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function post() {
    if (!user || !text.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("posts")
      .insert({ author_id: user.id, content: text.trim() });
    setBusy(false);
    if (error) {
      push("error", "Could not publish post");
    } else {
      setText("");
      push("success", "Posted to your feed");
      onPosted();
    }
  }

  return (
    <div className="card p-4">
      <div className="flex gap-3">
        <Avatar src={profile?.avatar_url} name={profile?.display_name} size={44} />
        <div className="flex-1">
          <textarea
            className="w-full bg-transparent outline-none resize-none placeholder-gray-500 text-gray-100 min-h-[60px]"
            placeholder="What's on your mind?"
            value={text}
            maxLength={500}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-600">{text.length}/500</span>
            <Button onClick={post} loading={busy} disabled={!text.trim()}>
              Post
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// silence unused import warning when Profile is only used as a type
export type { Profile };
