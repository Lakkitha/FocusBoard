import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Trash2, Plus, AlertTriangle } from "lucide-react";
import { useStore } from "../store/useStore";
import { buildAIContext } from "../utils/buildAIContext";
import { chatWithOllama, generateThreadTitle } from "../services/ollamaService";
import { getChatContext } from "../utils/getChatContext";

const SUGGESTED_PROMPTS = [
  "How did I do this week?",
  "What should I focus on today?",
  "Give me a weekly summary",
  "Am I on track for my goals?",
];

const OFFLINE_BANNER =
  "Ollama isn't running. Open a terminal and run: ollama serve - then try again.";

const WEEKLY_SUMMARY_PROMPT =
  "Generate a structured weekly review covering: total hours this week by category, week over week comparison for each category, locked in score for the week, goals completion rate, biggest improvement, biggest gap, and one suggested focus for next week. Always mention the week ranges from weekRanges.thisWeek and weekRanges.lastWeek.";

function toStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function relativeDateLabel(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = toStartOfDay(new Date());
  const target = toStartOfDay(date);
  const diffDays = Math.round((today - target) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return target.toLocaleDateString("en-US", { weekday: "short" });
  }
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isWeeklySummaryRequest(text = "") {
  const value = text.toLowerCase();
  return value.includes("weekly summary") || value.includes("weekly review");
}

export default function AIChat() {
  const chatThreads = useStore((s) => s.chatThreads);
  const activeChatThreadId = useStore((s) => s.activeChatThreadId);
  const createChatThread = useStore((s) => s.createChatThread);
  const setActiveChatThread = useStore((s) => s.setActiveChatThread);
  const appendChatMessage = useStore((s) => s.appendChatMessage);
  const updateChatThreadTitle = useStore((s) => s.updateChatThreadTitle);
  const deleteChatThread = useStore((s) => s.deleteChatThread);

  const [input, setInput] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThreadId, setStreamingThreadId] = useState(null);
  const [offlineError, setOfflineError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const activeThread = useMemo(
    () => chatThreads.find((thread) => thread.id === activeChatThreadId),
    [chatThreads, activeChatThreadId],
  );

  useEffect(() => {
    if (!activeChatThreadId && chatThreads.length > 0) {
      setActiveChatThread(chatThreads[0].id);
    }
  }, [activeChatThreadId, chatThreads, setActiveChatThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread?.messages, streamingContent]);

  const handleNewChat = () => {
    const newId = createChatThread();
    setPendingDeleteId(null);
    setTimeout(() => inputRef.current?.focus(), 0);
    return newId;
  };

  const handleDeleteThread = (threadId) => {
    deleteChatThread(threadId);
    setPendingDeleteId(null);
  };

  const handleSend = async (rawMessage) => {
    const text = rawMessage.trim();
    if (!text || streamingThreadId) return;

    setOfflineError("");

    const threadId = activeChatThreadId || handleNewChat();
    appendChatMessage(threadId, { role: "user", content: text });
    setInput("");

    const currentThread = useStore
      .getState()
      .chatThreads.find((thread) => thread.id === threadId);

    const conversationHistory = getChatContext(currentThread?.messages || []);
    const storeSnapshot = buildAIContext(useStore.getState());

    setStreamingThreadId(threadId);
    setStreamingContent("");

    try {
      const result = await chatWithOllama({
        userMessage: text,
        storeSnapshot,
        conversationHistory,
        onChunk: (partial) => setStreamingContent(partial),
      });

      if (result?.error === "offline") {
        setOfflineError(OFFLINE_BANNER);
      }

      const finalText =
        result?.text ||
        "I could not generate a response just now. Please try again.";
      appendChatMessage(threadId, { role: "assistant", content: finalText });

      if ((currentThread?.messages?.length || 0) === 1) {
        generateThreadTitle(text).then((title) => {
          if (title) updateChatThreadTitle(threadId, title);
        });
      }
    } catch (error) {
      console.error("Ollama chat error:", error);
      setOfflineError(
        error?.message
          ? "Something went wrong. Please try again."
          : OFFLINE_BANNER,
      );
      appendChatMessage(threadId, {
        role: "assistant",
        content: "I hit a snag. Please try again in a moment.",
      });
    } finally {
      setStreamingThreadId(null);
      setStreamingContent("");
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleSend(input);
  };

  const handleWeeklySummary = () => {
    handleSend(WEEKLY_SUMMARY_PROMPT);
  };

  const renderMessage = (message, index) => {
    if (message.role === "system-notice") {
      return (
        <div
          key={`${message.timestamp || index}-notice`}
          className="text-center text-xs italic text-surface-400"
        >
          {message.content}
        </div>
      );
    }

    const isUser = message.role === "user";
    const previous = activeThread?.messages?.[index - 1];
    const isSummary =
      message.role === "assistant" &&
      previous?.role === "user" &&
      isWeeklySummaryRequest(previous.content || "");

    return (
      <div
        key={message.timestamp || index}
        className={`flex items-start gap-3 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        {!isUser && (
          <div className="w-7 h-7 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-purple">
            FB
          </div>
        )}

        <div
          title={
            message.timestamp
              ? new Date(message.timestamp).toLocaleString()
              : ""
          }
          className={`max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "bg-brand-blue/30 text-white rounded-tr-md"
              : isSummary
                ? "bg-surface-700 text-surface-100 border border-brand-blue/30 rounded-tl-md"
                : "bg-surface-600 text-surface-100 border border-surface-500 rounded-tl-md"
          }`}
        >
          {isSummary && (
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-blue mb-2">
              Weekly Summary
            </div>
          )}
          {isUser ? (
            message.content
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 space-y-1">{children}</ol>
                ),
                strong: ({ children }) => (
                  <strong className="text-surface-50">{children}</strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    );
  };

  const messageCount = (activeThread?.messages || []).filter((message) =>
    ["user", "assistant"].includes(message.role),
  ).length;

  if (chatThreads.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md space-y-3">
          <p className="text-surface-300">
            No conversations yet. Start one to ask anything about your focus
            data.
          </p>
          <button onClick={handleNewChat} className="btn-primary">
            Start a conversation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <aside className="w-[200px] min-w-[200px] border-r border-surface-700 bg-surface-900 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-xs font-semibold text-surface-300">
            Conversations
          </span>
          <button
            type="button"
            onClick={handleNewChat}
            className="btn-ghost p-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-2">
          {chatThreads.map((thread) => {
            const isActive = thread.id === activeChatThreadId;
            const relativeTime = relativeDateLabel(thread.updatedAt);
            const isPendingDelete = pendingDeleteId === thread.id;

            if (isPendingDelete) {
              return (
                <div
                  key={thread.id}
                  className={`rounded-lg border px-2 py-2 text-xs ${
                    isActive
                      ? "border-brand-purple/40 bg-brand-purple/10"
                      : "border-surface-600 bg-surface-800"
                  }`}
                >
                  <p className="text-surface-200 mb-2">Delete this chat?</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-surface-200"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-danger text-xs"
                      onClick={() => handleDeleteThread(thread.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => {
                  setActiveChatThread(thread.id);
                  setPendingDeleteId(null);
                }}
                className={`group w-full text-left rounded-lg border px-2 py-2 transition-colors ${
                  isActive
                    ? "border-brand-purple/40 bg-brand-purple/10"
                    : "border-surface-700 hover:border-surface-500"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-surface-100 truncate">
                      {thread.title}
                    </p>
                    <p className="text-[10px] text-surface-400">
                      {relativeTime}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (thread.messages.length === 0) {
                        handleDeleteThread(thread.id);
                      } else {
                        setPendingDeleteId(thread.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            );
          })}
        </div>

        {chatThreads.length >= 40 && (
          <div className="px-3 py-2 text-[10px] text-surface-500">
            Older chats are auto-removed after 50
          </div>
        )}
      </aside>

      <section className="flex-1 flex flex-col">
        <div className="border-b border-surface-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-surface-50">
              {activeThread?.title || "Conversation"}
            </h1>
            <p className="text-xs text-surface-400">
              {messageCount} messages ·{" "}
              {relativeDateLabel(activeThread?.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleWeeklySummary}
            className="btn-secondary text-xs"
            disabled={Boolean(streamingThreadId)}
          >
            Weekly Summary
          </button>
        </div>

        {offlineError && (
          <div className="mx-6 mt-4 card border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{offlineError}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {activeThread?.messages?.length ? (
            activeThread.messages.map((message, index) =>
              renderMessage(message, index),
            )
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-surface-300">
                Start by asking about your week or goals.
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="btn-ghost border border-surface-500 text-surface-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {streamingThreadId === activeChatThreadId &&
            streamingContent !== "" && (
              <div className="flex items-start gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-purple">
                  FB
                </div>
                <div className="max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap bg-surface-600 text-surface-100 border border-surface-500 rounded-tl-md">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 last:mb-0">{children}</p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc pl-4 space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal pl-4 space-y-1">
                          {children}
                        </ol>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-surface-50">{children}</strong>
                      ),
                    }}
                  >
                    {streamingContent}
                  </ReactMarkdown>
                </div>
              </div>
            )}

          {streamingThreadId === activeChatThreadId &&
            streamingContent === "" && (
              <div className="flex items-start gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-purple">
                  FB
                </div>
                <div className="max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-surface-600 text-surface-100 border border-surface-500 rounded-tl-md">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-surface-200 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-surface-200 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-surface-200 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-surface-700 px-6 py-4 bg-surface-900">
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="label mb-2">Ask your coach</label>
              <textarea
                ref={inputRef}
                className="input min-h-[70px] resize-none"
                placeholder="Ask about your week, goals, or focus plan..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!input.trim()) return;
                    handleSubmit(event);
                  }
                }}
                disabled={Boolean(streamingThreadId)}
              />
            </div>

            <button
              type="submit"
              disabled={Boolean(streamingThreadId) || !input.trim()}
              className={`btn-primary flex items-center gap-2 ${
                Boolean(streamingThreadId) || !input.trim()
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              {streamingThreadId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
