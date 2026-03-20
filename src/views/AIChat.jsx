import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Send,
  Loader2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { buildAIContext } from "../utils/buildAIContext";
import { chatWithOllama } from "../services/ollamaService";

const SUGGESTED_PROMPTS = [
  "How many hours on Passive Income this week?",
  "Compare my focus this week vs last week",
  "What should I focus on today?",
  "Give me a weekly summary",
];

const OFFLINE_BANNER =
  "Ollama isn't running. Open a terminal and run: ollama serve - then try again.";

const WEEKLY_SUMMARY_PROMPT =
  "Generate a structured weekly review covering: total hours this week by category, week over week comparison for each category, locked in score for the week, goals completion rate, biggest improvement, biggest gap, and one suggested focus for next week. Always mention the week ranges from weekRanges.thisWeek and weekRanges.lastWeek.";

export default function AIChat() {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your FocusBoard coach. Ask about your progress, week over week trends, or next focus.",
    },
  ]);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState(null);
  const [offlineError, setOfflineError] = useState("");
  const messagesEndRef = useRef(null);

  const isFirstLoad = conversationHistory.length === 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const updateAssistantMessage = (id, content) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, content } : message,
      ),
    );
  };

  const finalizeAssistantMessage = (id, content) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? { ...message, content, isStreaming: false }
          : message,
      ),
    );
  };

  const sendMessage = async (rawMessage, options = {}) => {
    const userMessage = rawMessage.trim();
    if (!userMessage || isStreaming) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`;

    setOfflineError("");
    setIsStreaming(true);
    setStreamingId(assistantId);

    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: userMessage },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        variant: options.variant,
        isStreaming: true,
      },
    ]);

    try {
      const storeSnapshot = buildAIContext(useStore.getState());
      const result = await chatWithOllama({
        userMessage,
        storeSnapshot,
        conversationHistory,
        onChunk: (partial) => updateAssistantMessage(assistantId, partial),
      });

      if (result?.error === "offline") {
        setOfflineError(OFFLINE_BANNER);
      }

      const finalText =
        result?.text ||
        "I could not generate a response just now. Please try again.";

      finalizeAssistantMessage(assistantId, finalText);

      if (!result?.error) {
        setConversationHistory((prev) => [
          ...prev,
          { role: "user", content: userMessage },
          { role: "assistant", content: finalText },
        ]);
      }
    } catch (error) {
      console.error("Ollama chat error:", error);
      setOfflineError(
        error?.message
          ? "Something went wrong. Please try again."
          : OFFLINE_BANNER,
      );
      finalizeAssistantMessage(
        assistantId,
        "I hit a snag. Please try again in a moment.",
      );
    } finally {
      setIsStreaming(false);
      setStreamingId(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const prompt = input;
    setInput("");
    await sendMessage(prompt);
  };

  const handleWeeklySummary = async () => {
    await sendMessage(WEEKLY_SUMMARY_PROMPT, { variant: "summary" });
  };

  const handleSuggestedPrompt = async (prompt) => {
    setInput("");
    await sendMessage(prompt);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-6 pb-4 border-b border-surface-700">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 badge bg-brand-purple/15 text-brand-purple">
              <Sparkles className="w-3.5 h-3.5" />
              FocusBoard AI Coach
            </div>
            <h1 className="text-xl font-bold text-surface-50">AI Assistant</h1>
            <p className="text-sm text-surface-300 max-w-2xl">
              Always grounded in your live data. Ask about progress, compare
              weeks, or plan next actions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleWeeklySummary}
            disabled={isStreaming}
            className={`btn-primary whitespace-nowrap flex items-center gap-2 ${isStreaming ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <BarChart3 className="w-4 h-4" />
            )}
            Weekly Summary
          </button>
        </div>
      </div>

      {offlineError && (
        <div className="mx-6 mt-4 card border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{offlineError}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const isSummary = message.variant === "summary";
          const isTyping =
            message.id === streamingId && isStreaming && !message.content;

          return (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                isUser ? "justify-end" : "justify-start"
              }`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center flex-shrink-0 text-xs font-semibold text-brand-purple">
                  FB
                </div>
              )}

              <div
                className={`max-w-[78%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-brand-purple text-white rounded-tr-md"
                    : isSummary
                      ? "bg-surface-700 text-surface-100 border border-brand-blue/30 rounded-tl-md"
                      : "bg-surface-600 text-surface-100 border border-surface-500 rounded-tl-md"
                }`}
              >
                {isSummary && (
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-brand-blue mb-2">
                    <BarChart3 className="w-3.5 h-3.5" />
                    Weekly Summary
                  </div>
                )}
                {isUser ? (
                  message.content
                ) : isTyping ? (
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-surface-200 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-surface-200 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-surface-200 animate-pulse" />
                  </div>
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
                        <ol className="list-decimal pl-4 space-y-1">
                          {children}
                        </ol>
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
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-surface-700 px-6 py-4 bg-surface-900">
        {isFirstLoad && (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSuggestedPrompt(prompt)}
                className="btn-ghost border border-surface-500 text-surface-200"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label mb-2">Ask your coach</label>
            <textarea
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
              disabled={isStreaming}
            />
          </div>

          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className={`btn-primary flex items-center gap-2 ${
              isStreaming || !input.trim()
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
