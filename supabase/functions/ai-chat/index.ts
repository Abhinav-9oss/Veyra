// Veyra AI Studio — conversation edge function (v2 deploy trigger)
// Responds to user messages in an AI Studio thread.
//
// If an AI provider key is configured via the AI_API_KEY secret, this forwards
// the conversation to that provider. Otherwise it runs a built-in deterministic
// response engine so AI Studio works end-to-end without external dependencies.
//
// AI is strictly separated from social conversations: this function only ever
// reads/writes the ai_conversations + ai_messages tables, never the human
// `conversations` / `messages` tables.

import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PERSONAS: Record<string, { name: string; prefix: string }> = {
  general: { name: "Veyra", prefix: "" },
  creative: { name: "Muse", prefix: "You respond with vivid, imaginative language. " },
  analyst: { name: "Atlas", prefix: "You respond with concise, structured analysis. " },
  coach: { name: "Sage", prefix: "You respond with supportive, actionable guidance. " },
};

function localReply(persona: string, history: { role: string; content: string }[], userText: string): string {
  const p = PERSONAS[persona] || PERSONAS.general;
  const text = userText.trim();

  if (!text) return "I'm here — what would you like to explore?";

  const lower = text.toLowerCase();
  const greetings = ["hi", "hello", "hey", "yo", "sup", "good morning", "good evening"];
  if (greetings.some((g) => lower === g || lower.startsWith(g + " ") || lower.startsWith(g + "!"))) {
    return `Hi! I'm ${p.name}, your Veyra AI assistant. I can help you brainstorm, analyze ideas, write, or just chat. What's on your mind?`;
  }

  if (lower.includes("who are you") || lower.includes("what are you")) {
    return `I'm ${p.name}, a Veyra AI assistant. I live in AI Studio, separate from your social conversations with people. I never join your group chats or communities — I'm only here when you open AI Studio.`;
  }

  if (lower.includes("help") || lower.includes("what can you do")) {
    return [
      `Here are a few things I can help with:`,
      `• Brainstorming ideas and naming things`,
      `• Drafting and editing writing`,
      `• Summarizing or explaining concepts`,
      `• Working through decisions step by step`,
      ``,
      `Just tell me what you're working on and we'll take it from there.`,
    ].join("\n");
  }

  if (text.endsWith("?")) {
    return `That's a great question. Here's how I'd think about "${text.slice(0, -1)}":\n\n1. Consider the core goal and constraints.\n2. Look at what you already know.\n3. Identify the one thing that, if decided, makes the rest easier.\n\nWant me to dig into any of those?`;
  }

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 6) {
    return `Tell me more about "${text}" — what outcome are you hoping for?`;
  }

  // Reflective, structured default
  const theme = text.split(/[.!?]/)[0].slice(0, 80);
  return [
    `Here's a take on "${theme}":`,
    ``,
    `• Key idea: the heart of this is what you're trying to achieve and who it's for.`,
    `• One angle worth exploring: simplify before adding — the clearest version usually wins.`,
    `• A next step: pick the smallest action that moves this forward today.`,
    ``,
    `Want me to expand on any of these, or draft something concrete?`,
  ].join("\n");
}

async function providerReply(
  persona: string,
  history: { role: string; content: string }[],
  userText: string,
  apiKey: string
): Promise<string> {
  const system = (PERSONAS[persona]?.prefix || "") +
    "You are a helpful AI assistant inside Veyra's AI Studio. Be concise, warm, and useful.";
  const messages = [
    { role: "system", content: system },
    ...history.slice(-10).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: userText },
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, max_tokens: 600 }),
  });
  if (!res.ok) {
    throw new Error(`provider returned ${res.status}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("provider returned empty content");
  }
  return content.trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const body = await req.json().catch(() => null);
    if (!body || typeof body.conversation_id !== "string" || typeof body.message !== "string") {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify the caller's JWT and load the conversation to confirm ownership
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false }, global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: conv, error: convErr } = await supabase
      .from("ai_conversations")
      .select("id, user_id, persona")
      .eq("id", body.conversation_id)
      .maybeSingle();
    if (convErr || !conv || conv.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist the user's message
    const { error: insertUserErr } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: conv.id, role: "user", content: body.message });
    if (insertUserErr) throw insertUserErr;

    // Load recent history for context
    const { data: historyRows } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })
      .limit(20);

    const history = (historyRows || []).map((r: any) => ({ role: r.role, content: r.content }));

    // Generate the assistant reply
    let reply: string;
    const apiKey = Deno.env.get("AI_API_KEY");
    if (apiKey) {
      try {
        reply = await providerReply(conv.persona, history, body.message, apiKey);
      } catch (e) {
        console.warn("provider failed, falling back:", (e as Error).message);
        reply = localReply(conv.persona, history, body.message);
      }
    } else {
      // Simulate a brief thinking delay for nicer UX
      await new Promise((r) => setTimeout(r, 350));
      reply = localReply(conv.persona, history, body.message);
    }

    const { data: assistantRow, error: insertAssistantErr } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: conv.id, role: "assistant", content: reply })
      .select("id, created_at")
      .maybeSingle();
    if (insertAssistantErr) throw insertAssistantErr;

    // Auto-title the conversation from the first user message
    if (conv.persona !== undefined) {
      const { data: titleCheck } = await supabase
        .from("ai_conversations")
        .select("title")
        .eq("id", conv.id)
        .maybeSingle();
      if (titleCheck?.title === "New conversation") {
        const newTitle = body.message.slice(0, 50).trim() || "New conversation";
        await supabase.from("ai_conversations").update({ title: newTitle }).eq("id", conv.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: {
          id: assistantRow?.id,
          role: "assistant",
          content: reply,
          created_at: assistantRow?.created_at,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
