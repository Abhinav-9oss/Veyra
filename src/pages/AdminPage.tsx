import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  ArrowLeft,
  Trash2,
  Edit3,
  Save,
  X,
  Users,
  MessageSquare,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, EmptyState, Loader, Modal, useToast } from "@/components/ui";
import { timeAgo, formatTime } from "@/utils/time";
import { cn } from "@/utils/cn";
import type { AdminConversation, AdminMessage } from "@/types/database";

export function AdminPage() {
  const { profile } = useAuth();
  const { push } = useToast();
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteConvId, setDeleteConvId] = useState<string | null>(null);
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("admin_list_conversations");
    if (err) {
      setError(err.message.includes("Not authorized") ? "Admin access required." : err.message);
      setLoading(false);
      return;
    }
    setConversations((data || []) as AdminConversation[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data, error: err } = await supabase.rpc("admin_get_messages", {
      p_conversation: convId,
    });
    if (err) {
      push("error", "Could not load messages");
      setLoadingMsgs(false);
      return;
    }
    setMessages((data || []) as AdminMessage[]);
    setLoadingMsgs(false);
  }, [push]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId, loadMessages]);

  async function saveEdit() {
    if (!editingId || !editText.trim()) return;
    const { error: err } = await supabase.rpc("admin_update_message", {
      p_message: editingId,
      p_content: editText.trim(),
    });
    if (err) {
      push("error", "Could not update message");
      return;
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === editingId ? { ...m, content: editText.trim() } : m))
    );
    setEditingId(null);
    setEditText("");
    push("success", "Message updated");
  }

  async function deleteMessage(id: string) {
    const { error: err } = await supabase.rpc("admin_delete_message", { p_message: id });
    setDeleteMsgId(null);
    if (err) {
      push("error", "Could not delete message");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
    push("success", "Message deleted");
  }

  async function deleteConversation(id: string) {
    const { error: err } = await supabase.rpc("admin_delete_conversation", {
      p_conversation: id,
    });
    setDeleteConvId(null);
    if (err) {
      push("error", "Could not delete conversation");
      return;
    }
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
    push("success", "Conversation deleted");
    loadConversations();
  }

  if (profile?.role !== "admin") {
    return (
      <EmptyState
        icon={<Shield className="w-10 h-10" />}
        title="Admin access required"
        description="You don't have permission to view this page."
      />
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-red-300 text-sm">{error}</div>
    );
  }

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.participants?.toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  });

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-3xl p-6 md:p-7 bg-gradient-to-br from-violet-900/40 via-ink-700/60 to-electric-900/20 border border-white/10 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-electric-600 flex items-center justify-center shadow-glow shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">Admin Moderation</h1>
            <p className="text-gray-400 text-sm mt-1 max-w-lg">
              View and moderate all conversations and messages on Veyra, including private and group chats.
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden h-[calc(100vh-17rem)] flex">
        {/* Conversation list */}
        <div className={cn("w-full md:w-80 border-r border-white/10 flex flex-col", activeId && "hidden md:flex")}>
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="input-field pl-10 py-2 text-sm"
                placeholder="Search conversations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <Loader label="Loading conversations…" />
            ) : filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<MessageSquare className="w-8 h-8" />}
                  title="No conversations"
                  description="There are no conversations to moderate yet."
                />
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-3 border-b border-white/5 transition-colors",
                    activeId === c.id ? "bg-violet-500/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {c.is_group ? (
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-electric-600/40 to-violet-600/30 flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4 text-gray-300" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-violet-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.is_group ? c.name || "Group chat" : "Direct message"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {c.participant_count} participants · {c.message_count} messages
                      </p>
                      <p className="text-xs text-gray-600 truncate mt-0.5">{c.participants}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Message pane */}
        <div className={cn("flex-1 flex flex-col", !activeId && "hidden md:flex")}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<MessageSquare className="w-10 h-10" />}
                title="Select a conversation"
                description="Choose a conversation on the left to view and moderate its messages."
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                <button
                  className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-gray-300"
                  onClick={() => setActiveId(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {active.is_group ? active.name || "Group chat" : "Direct message"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{active.participants}</p>
                </div>
                <Button
                  variant="danger"
                  className="py-1.5 text-sm"
                  onClick={() => setDeleteConvId(active.id)}
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Delete conversation
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {loadingMsgs ? (
                  <Loader label="Loading messages…" />
                ) : messages.length === 0 ? (
                  <p className="text-center text-gray-500 text-sm py-10">No messages in this conversation.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="group flex gap-2.5">
                      <Avatar
                        src={m.sender_avatar}
                        name={m.sender_name || "User"}
                        size={32}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {m.sender_name || "Unknown"}
                          </span>
                          <span className="text-xs text-gray-600">
                            @{m.sender_username || "?"} · {formatTime(m.created_at)} · {timeAgo(m.created_at)} ago
                          </span>
                        </div>
                        {editingId === m.id ? (
                          <div className="mt-1 flex gap-2">
                            <textarea
                              className="input-field min-h-[60px] resize-none text-sm py-2"
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="flex flex-col gap-1">
                              <Button
                                className="px-2 py-1.5"
                                onClick={saveEdit}
                                icon={<Save className="w-3.5 h-3.5" />}
                                aria-label="Save"
                              />
                              <Button
                                variant="ghost"
                                className="px-2 py-1.5"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditText("");
                                }}
                                icon={<X className="w-3.5 h-3.5" />}
                                aria-label="Cancel"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 mt-1">
                            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-white/5 border border-white/5 text-sm text-gray-100 break-words whitespace-pre-wrap flex-1">
                              {m.content}
                            </div>
                            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setEditingId(m.id);
                                  setEditText(m.content);
                                }}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-violet-300 hover:bg-white/5"
                                aria-label="Edit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteMsgId(m.id)}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-white/5"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete conversation confirm */}
      <Modal open={!!deleteConvId} onClose={() => setDeleteConvId(null)} title="Delete conversation?" size="sm">
        <p className="text-sm text-gray-400">
          This will permanently delete the conversation and all its messages. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setDeleteConvId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteConvId && deleteConversation(deleteConvId)}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Delete message confirm */}
      <Modal open={!!deleteMsgId} onClose={() => setDeleteMsgId(null)} title="Delete message?" size="sm">
        <p className="text-sm text-gray-400">This message will be permanently removed.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setDeleteMsgId(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteMsgId && deleteMessage(deleteMsgId)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
