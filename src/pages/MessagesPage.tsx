import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Send, Plus, Users, MessageSquare, ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { Avatar, Button, EmptyState, Loader, Modal, useToast } from "@/components/ui";
import { formatTime, timeAgo } from "@/utils/time";
import { cn } from "@/utils/cn";
import type { Conversation, Message, Profile } from "@/types/database";

export function MessagesPage() {
  const { user, profile } = useAuth();
  const { push } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Get participant rows for this user, then conversations
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", user.id);

    const ids = (parts || []).map((p: any) => p.conversation_id);
    if (ids.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const { data: convs } = await supabase
      .from("conversations")
      .select("*")
      .in("id", ids)
      .order("created_at", { ascending: false });

    // Fetch participants + profiles for each conversation
    const shaped: Conversation[] = await Promise.all(
      (convs || []).map(async (c: any) => {
        const { data: cp } = await supabase
          .from("conversation_participants")
          .select(
            `user_id, profile:profiles!conversation_participants_user_id_fkey(id, display_name, username, avatar_url)`
          )
          .eq("conversation_id", c.id);
        const participants = (cp || []).map((p: any) => p.profile).filter(Boolean) as Profile[];

        const { data: last } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, content, created_at")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...c,
          participants,
          last_message: (last as Message) || null,
        } as Conversation;
      })
    );
    setConversations(shaped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Realtime conversation list (new messages reorder/refresh)
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("conv-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadConversations()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversation_participants" },
        () => loadConversations()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, loadConversations]);

  // Load messages for active conversation + subscribe
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingMsgs(true);

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select(
          `id, conversation_id, sender_id, content, created_at,
           sender:profiles!messages_sender_id_fkey(id, display_name, username, avatar_url)`
        )
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setMessages((data || []) as unknown as Message[]);
        setLoadingMsgs(false);
      }
    })();

    const ch = supabase
      .channel(`msgs-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeId]);

  async function send() {
    if (!user || !activeId || !text.trim()) return;
    const content = text.trim();
    setText("");
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content })
      .select(
        `id, conversation_id, sender_id, content, created_at,
         sender:profiles!messages_sender_id_fkey(id, display_name, username, avatar_url)`
      )
      .maybeSingle();
    if (error) {
      push("error", "Message failed to send");
      setText(content);
    } else if (data) {
      setMessages((prev) => [...prev, data as unknown as Message]);
    }
  }

  function chatTitle(c: Conversation): string {
    if (c.is_group) return c.name || "Group chat";
    const other = c.participants?.find((p) => p.id !== user?.id);
    return other?.display_name || "Direct message";
  }

  function chatAvatar(c: Conversation) {
    if (c.is_group) return null;
    const other = c.participants?.find((p) => p.id !== user?.id);
    return other?.avatar_url;
  }

  async function openNewChat() {
    setNewChatOpen(true);
    setSelectedUsers([]);
    setGroupName("");
    setSearch("");
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, username, avatar_url, is_private")
      .neq("id", user?.id || "")
      .limit(30);
    setPeople((data || []) as Profile[]);
  }

  async function createConversation() {
    if (!user) return;
    if (selectedUsers.length === 0) return;
    const isGroup = selectedUsers.length > 1;
    const name = isGroup ? groupName.trim() || "Group chat" : "";

    const { data: conv, error } = await supabase
      .from("conversations")
      .insert({
        created_by: user.id,
        is_group: isGroup,
        name,
      })
      .select("*")
      .maybeSingle();

    if (error || !conv) {
      push("error", "Could not create conversation");
      return;
    }

    const participants = [user.id, ...selectedUsers.map((u) => u.id)];
    const { error: perr } = await supabase
      .from("conversation_participants")
      .insert(participants.map((uid) => ({ conversation_id: conv.id, user_id: uid })));

    if (perr) {
      push("error", "Could not add participants");
      return;
    }

    setNewChatOpen(false);
    await loadConversations();
    setActiveId(conv.id);
    push("success", "Conversation created");
  }

  return (
    <div className="card overflow-hidden h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] flex">
      {/* Conversation list */}
      <div
        className={cn(
          "w-full md:w-72 border-r border-white/10 flex flex-col",
          activeId && "hidden md:flex"
        )}
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Messages</h2>
          <Button variant="ghost" className="px-2" onClick={openNewChat} aria-label="New chat">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <Loader label="Loading…" />
          ) : conversations.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<MessageSquare className="w-8 h-8" />}
                title="No conversations"
                description="Start a new chat with someone you follow."
                action={
                  <Button onClick={openNewChat} icon={<Plus className="w-4 h-4" />}>
                    New chat
                  </Button>
                }
              />
            </div>
          ) : (
            conversations.map((c) => {
              const other = c.participants?.find((p) => p.id !== user?.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 text-left border-b border-white/5 transition-colors",
                    activeId === c.id ? "bg-violet-500/10" : "hover:bg-white/5"
                  )}
                >
                  {c.is_group ? (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-electric-600/40 to-violet-600/30 flex items-center justify-center shrink-0">
                      <Users className="w-5 h-5 text-gray-300" />
                    </div>
                  ) : (
                    <Avatar src={other?.avatar_url} name={other?.display_name} size={44} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{chatTitle(c)}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.last_message
                        ? `${c.last_message.sender_id === user?.id ? "You: " : ""}${c.last_message.content}`
                        : "No messages yet"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat pane */}
      <div className={cn("flex-1 flex flex-col", !activeId && "hidden md:flex")}>
        {!active ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare className="w-10 h-10" />}
              title="Select a conversation"
              description="Choose a chat on the left, or start a new one."
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
              {active.is_group ? (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-electric-600/40 to-violet-600/30 flex items-center justify-center">
                  <Users className="w-4 h-4 text-gray-300" />
                </div>
              ) : (
                <Avatar src={chatAvatar(active)} name={chatTitle(active)} size={36} />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{chatTitle(active)}</p>
                <p className="text-xs text-gray-500">
                  {active.is_group
                    ? `${active.participants?.length ?? 0} members`
                    : `@${active.participants?.find((p) => p.id !== user?.id)?.username ?? ""}`}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {loadingMsgs ? (
                <Loader label="Loading messages…" />
              ) : messages.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-10">
                  No messages yet. Say hello!
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div
                      key={m.id}
                      className={cn("flex gap-2.5", mine && "flex-row-reverse")}
                    >
                      {!mine && (
                        <Avatar
                          src={m.sender?.avatar_url}
                          name={m.sender?.display_name}
                          size={28}
                          className="mt-1"
                        />
                      )}
                      <div className={cn("max-w-[75%]", mine && "items-end flex flex-col")}>
                        {!mine && active.is_group && (
                          <span className="text-xs text-gray-500 mb-0.5 px-2">
                            {m.sender?.display_name}
                          </span>
                        )}
                        <div
                          className={cn(
                            "px-3.5 py-2.5 rounded-2xl text-sm break-words",
                            mine
                              ? "bg-gradient-to-br from-violet-600 to-violet-500 text-white rounded-br-md"
                              : "bg-white/5 text-gray-100 rounded-bl-md border border-white/5"
                          )}
                        >
                          {m.content}
                        </div>
                        <span className="text-[10px] text-gray-600 mt-0.5 px-2">
                          {formatTime(m.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                className="input-field"
                placeholder="Type a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              />
              <Button onClick={send} disabled={!text.trim()} className="px-3" aria-label="Send">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* New chat modal */}
      <Modal open={newChatOpen} onClose={() => setNewChatOpen(false)} title="New conversation" size="md">
        <div className="space-y-4">
          {selectedUsers.length > 1 && (
            <input
              className="input-field"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          )}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="input-field pl-10"
              placeholder="Search people…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  className="chip cursor-pointer"
                  onClick={() => setSelectedUsers((s) => s.filter((x) => x.id !== u.id))}
                >
                  {u.display_name} ✕
                </span>
              ))}
            </div>
          )}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {people
              .filter((p) =>
                search
                  ? p.display_name.toLowerCase().includes(search.toLowerCase()) ||
                    p.username.toLowerCase().includes(search.toLowerCase())
                  : true
              )
              .map((p) => {
                const sel = selectedUsers.some((u) => u.id === p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setSelectedUsers((s) =>
                        sel ? s.filter((x) => x.id !== p.id) : [...s, p]
                      )
                    }
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors",
                      sel ? "bg-violet-500/15 border border-violet-500/30" : "hover:bg-white/5"
                    )}
                  >
                    <Avatar src={p.avatar_url} name={p.display_name} size={34} />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.display_name}</p>
                      <p className="text-xs text-gray-500 truncate">@{p.username}</p>
                    </div>
                  </button>
                );
              })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setNewChatOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createConversation} disabled={selectedUsers.length === 0}>
              {selectedUsers.length > 1 ? "Create group" : "Start chat"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
