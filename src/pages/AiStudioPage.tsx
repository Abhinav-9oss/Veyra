import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Plus,
  Send,
  Trash2,
  MessageSquare,
  Bot,
  User,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Button, EmptyState, Loader, Modal, useToast } from "@/components/ui";
import { cn } from "@/utils/cn";
import type { AiConversation, AiMessage } from "@/types/database";

const PERSONAS = [
  { id: "general", name: "Veyra", desc: "General assistant for anything" },
  { id: "creative", name: "Muse", desc: "Brainstorming & creative writing" },
  { id: "analyst", name: "Atlas", desc: "Structured analysis & summaries" },
  { id: "coach", name: "Sage", desc: "Supportive, actionable guidance" },
] as const;

export function AiStudioPage() {
  const { user } = useAuth();
  const { push } = useToast();
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [persona, setPersona] = useState<string>("general");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setConversations((data || []) as AiConversation[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const active = conversations.find((c) => c.id === activeId) || null;

  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    (async () => {
      const { data } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((data || []) as AiMessage[]);
        setLoadingMsgs(false);
      }
    })();

    const ch = supabase
      .channel(`ai-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as AiMessage];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeId]);

  async function createConversation() {
    if (!user) return;
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: user.id, persona, title: "New conversation" })
      .select("*")
      .maybeSingle();
    setNewOpen(false);
    if (error || !data) {
      push("error", "Could not create conversation");
      return;
    }
    await loadConversations();
    setActiveId(data.id);
    setMessages([]);
  }

  async function sendMessage() {
    if (!user || !activeId || !text.trim() || sending) return;
    const content = text.trim();
    setText("");
    setSending(true);

    // Optimistic user message
    const optimistic: AiMessage = {
      id: `pending-${Date.now()}`,
      conversation_id: activeId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
    try {
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ conversation_id: activeId, message: content }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      const body = await res.json();
      if (!body?.message?.content) throw new Error("Empty response from assistant");
      // Replace optimistic message and append assistant reply via reload
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      // Insert user message locally (the edge function already persisted it)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimistic.id),
        {
          id: `user-${Date.now()}`,
          conversation_id: activeId,
          role: "user",
          content,
          created_at: new Date().toISOString(),
        },
        body.message as AiMessage,
      ]);
      await loadConversations();
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(content);
      push("error", (e as Error).message || "Could not reach AI assistant");
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation(id: string) {
    const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
    setConfirmDelete(null);
    if (error) {
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

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-3xl p-6 md:p-7 bg-gradient-to-br from-violet-900/40 via-ink-700/60 to-electric-900/20 border border-white/10 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 bg-electric-500/20 rounded-full blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-electric-600 flex items-center justify-center shadow-glow shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">AI Studio</h1>
            <p className="text-gray-400 text-sm mt-1 max-w-lg">
              Your private space for AI conversations. These threads are completely separate from
              your social chats — AI never joins your group conversations.
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden h-[calc(100vh-17rem)] flex">
        {/* Conversation list */}
        <div className={cn("w-full md:w-72 border-r border-white/10 flex flex-col", activeId && "hidden md:flex")}>
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">AI Threads</h2>
            <Button variant="ghost" className="px-2" onClick={() => setNewOpen(true)} aria-label="New thread">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <Loader label="Loading…" />
            ) : conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Sparkles className="w-8 h-8" />}
                  title="No AI threads yet"
                  description="Start a conversation with your AI assistant."
                  action={
                    <Button onClick={() => setNewOpen(true)} icon={<Plus className="w-4 h-4" />}>
                      New thread
                    </Button>
                  }
                />
              </div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-3 border-b border-white/5 transition-colors",
                    activeId === c.id ? "bg-violet-500/10" : "hover:bg-white/5"
                  )}
                >
                  <button
                    onClick={() => setActiveId(c.id)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-violet-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{c.persona}</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c.id)}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete thread"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat pane */}
        <div className={cn("flex-1 flex flex-col", !activeId && "hidden md:flex")}>
          {!active ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<Sparkles className="w-10 h-10" />}
                title="No thread selected"
                description="Choose a thread on the left or start a new one."
                action={
                  <Button onClick={() => setNewOpen(true)} icon={<Plus className="w-4 h-4" />}>
                    New thread
                  </Button>
                }
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
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-violet-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{active.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{active.persona} persona</p>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {loadingMsgs ? (
                  <Loader label="Loading thread…" />
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-10">
                    <Bot className="w-8 h-8 mx-auto mb-3 text-violet-400/60" />
                    Start the conversation. Ask anything — your AI assistant is ready.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={m.id} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
                        <div
                          className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1",
                            isUser
                              ? "bg-white/5"
                              : "bg-gradient-to-br from-violet-600 to-electric-600 shadow-glow"
                          )}
                        >
                          {isUser ? (
                            <User className="w-4 h-4 text-gray-300" />
                          ) : (
                            <Bot className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div className={cn("max-w-[80%]", isUser && "items-end flex flex-col")}>
                          <div
                            className={cn(
                              "px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed",
                              isUser
                                ? "bg-gradient-to-br from-violet-600 to-violet-500 text-white rounded-br-md"
                                : "bg-white/5 text-gray-100 rounded-bl-md border border-white/5"
                            )}
                          >
                            {m.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {sending && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-electric-600 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-white/5 border border-white/5 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse-glow" />
                      <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse-glow" style={{ animationDelay: "0.2s" }} />
                      <span className="w-2 h-2 bg-violet-400 rounded-full animate-pulse-glow" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-white/10 flex gap-2">
                <input
                  className="input-field"
                  placeholder="Message your AI assistant…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  disabled={sending}
                />
                <Button onClick={sendMessage} loading={sending} disabled={!text.trim()} className="px-3" aria-label="Send">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* New thread modal */}
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="New AI thread">
        <p className="text-sm text-gray-400 mb-4">Choose an assistant persona to start with.</p>
        <div className="space-y-2">
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPersona(p.id)}
              className={cn(
                "w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors",
                persona === p.id
                  ? "bg-violet-500/15 border border-violet-500/30"
                  : "hover:bg-white/5 border border-transparent"
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600/40 to-electric-600/30 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-violet-300" />
              </div>
              <div>
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-gray-500">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
          <Button onClick={createConversation} icon={<Plus className="w-4 h-4" />}>Create thread</Button>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete thread?" size="sm">
        <p className="text-sm text-gray-400">This will permanently remove the conversation and all its messages.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => confirmDelete && deleteConversation(confirmDelete)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
