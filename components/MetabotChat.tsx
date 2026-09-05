"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, BotMessageSquare, Loader2 } from "lucide-react";

interface Message { role: "user" | "assistant"; content: string }

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
          <BotMessageSquare size={14} className="text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "bg-gray-900 text-white rounded-br-sm"
            : "bg-gray-100 text-gray-800 rounded-bl-sm"
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}

export default function MetabotChat() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const { reply, error } = await res.json();
      setMessages([...next, { role: "assistant", content: reply ?? error ?? "Something went wrong." }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open Metabot"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9000,
          width: 52, height: 52, borderRadius: "50%",
          background: "#111827", border: "none", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "transform 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open
          ? <X size={20} color="white" />
          : <BotMessageSquare size={20} color="white" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 88, right: 24, zIndex: 9000,
            width: 380, height: 540,
            background: "#fff", borderRadius: 16,
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
            display: "flex", flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ background: "#111827", padding: "14px 18px", flexShrink: 0 }}>
            <div className="flex items-center gap-2.5">
              <BotMessageSquare size={18} className="text-white" />
              <div>
                <p className="text-white font-bold text-sm leading-none">Metabot</p>
                <p className="text-gray-400 text-xs mt-0.5">Ask anything about your campaign data</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-xs mt-8 leading-relaxed px-4">
                Ask me about impressions, leads, top districts, campaign performance, and more.
              </div>
            )}
            {messages.map((m, i) => <Bubble key={i} msg={m} />)}
            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="shrink-0 w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center mt-0.5">
                  <BotMessageSquare size={14} className="text-white" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5">
                  <Loader2 size={13} className="animate-spin text-gray-500" />
                  <span className="text-xs text-gray-500">Thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ borderTop: "1px solid #f3f4f6", padding: "10px 12px", flexShrink: 0, display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your data…"
              disabled={loading}
              style={{
                flex: 1, border: "1px solid #e5e7eb", borderRadius: 10,
                padding: "8px 12px", fontSize: 13, outline: "none",
                background: loading ? "#f9fafb" : "#fff",
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: loading || !input.trim() ? "#e5e7eb" : "#111827",
                border: "none", cursor: loading || !input.trim() ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
              }}
            >
              <Send size={15} color={loading || !input.trim() ? "#9ca3af" : "white"} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
