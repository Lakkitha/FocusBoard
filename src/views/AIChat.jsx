import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "../store/useStore";
import { generateAIContext } from "../utils/aiContext";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = "mistral:7b";

const SYSTEM_INSTRUCTIONS = `You are the FocusBoard AI Coach, a concise and highly analytical productivity mentor.

APP VOCABULARY:
- Courses: Formal learning with deadlines (e.g., Certifications).
- Projects: Personal or Passive Income builds with milestones.
- Custom Views: User-defined tracking categories (e.g., "Tech Challenges", "Fitness").
- Locked In: A daily focus score tracking Morning, Noon, and Night sessions.

STRICT RULES:
1. NEVER hallucinate or invent data. If the user asks about a project, course, or custom view that has no data in the CONTEXT below, reply: "I don't have any recent data logged for that."
2. Do not conflate Custom Views with Courses. They are separate.
3. Keep responses to 2-3 sentences max. Be direct and actionable.
4. Do not start your response with "Focus Coach:" or any labels. Just answer naturally.

DATA CONTEXT:
{systemContext}`;

const OFFLINE_MESSAGE =
  "Connection refused. Ensure Ollama is running and OLLAMA_ORIGINS is configured.";

const MODEL_NOT_FOUND_MESSAGE =
  "Model not found. Please run 'ollama run mistral' in your terminal.";

function parseJSONLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function fetchLocalAIResponse(userMessage, systemContext, onChunk) {
  const prompt = SYSTEM_INSTRUCTIONS.replace("{systemContext}", systemContext)
    .concat("\n\nUSER QUESTION:\n")
    .concat(userMessage);

  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = new Error(
      `Ollama request failed with status ${response.status}`,
    );
    error.status = response.status;
    error.statusText = response.statusText;
    throw error;
  }

  if (!response.body) {
    throw new Error("No response stream returned by Ollama");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const parsed = parseJSONLine(trimmed);
      if (!parsed) continue;

      if (parsed.error) {
        throw new Error(parsed.error);
      }

      if (parsed.response) {
        fullText += parsed.response;
        onChunk(fullText);
      }
    }
  }

  const tail = buffer.trim();
  if (tail) {
    const parsedTail = parseJSONLine(tail);
    if (parsedTail?.response) {
      fullText += parsedTail.response;
      onChunk(fullText);
    }
  }

  return fullText.trim();
}

export default function AIChat() {
  const courses = useStore((s) => s.courses);
  const projects = useStore((s) => s.projects);
  const sessions = useStore((s) => s.sessions);
  const goals = useStore((s) => s.goals);
  const lockedInByDate = useStore((s) => s.lockedInByDate);

  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your local Focus Coach. Ask me anything about your momentum, deadlines, or where to focus next.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [offlineError, setOfflineError] = useState("");
  const messagesEndRef = useRef(null);

  const aiContext = useMemo(
    () =>
      generateAIContext({ courses, projects, sessions, goals, lockedInByDate }),
    [courses, projects, sessions, goals, lockedInByDate],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (rawMessage) => {
    const userMessage = rawMessage.trim();
    if (!userMessage || isLoading) return;

    const userId = `user-${Date.now()}`;
    const assistantId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    setOfflineError("");
    setMessages((prev) => [
      ...prev,
      { id: userId, role: "user", content: userMessage },
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsLoading(true);

    try {
      const finalText = await fetchLocalAIResponse(
        userMessage,
        aiContext,
        (partial) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: partial } : m,
            ),
          );
        },
      );

      if (!finalText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    "I could not generate a response just now. Please try again.",
                }
              : m,
          ),
        );
      }
    } catch (error) {
      let errorMessage = OFFLINE_MESSAGE;

      if (error?.status === 404) {
        errorMessage = MODEL_NOT_FOUND_MESSAGE;
      } else if (error?.message && !error?.status) {
        const lower = String(error.message).toLowerCase();
        if (
          lower.includes("failed to fetch") ||
          lower.includes("networkerror")
        ) {
          errorMessage = OFFLINE_MESSAGE;
        }
      }

      setOfflineError(errorMessage);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: errorMessage } : m,
        ),
      );
      console.error("Ollama Fetch Error:", error?.message, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const prompt = input;
    setInput("");
    await sendMessage(prompt);
  };

  const handleWeeklyReview = async () => {
    await sendMessage(
      "Generate my weekly review and give me the 2 most important next actions.",
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-full flex flex-col gap-4">
      <div className="card flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 badge bg-brand-purple/15 text-brand-purple">
            <Sparkles className="w-3.5 h-3.5" />
            Focus Coach (Local)
          </div>
          <h1 className="text-xl font-bold text-surface-50">
            Private AI Productivity Coach
          </h1>
          <p className="text-sm text-surface-300 max-w-2xl">
            Your data stays local. This coach uses your last 7 days of
            FocusBoard activity to generate personalized guidance.
          </p>
        </div>

        <button
          type="button"
          onClick={handleWeeklyReview}
          disabled={isLoading}
          className={`btn-primary whitespace-nowrap flex items-center gap-2 ${isLoading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Generate Weekly Review
        </button>
      </div>

      {offlineError && (
        <div className="card border-red-500/30 bg-red-500/10 text-red-300 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{offlineError}</span>
        </div>
      )}

      <div className="card flex-1 min-h-[420px] max-h-[62vh] overflow-y-auto space-y-3">
        {messages.map((message) => {
          const isUser = message.role === "user";

          return (
            <div
              key={message.id}
              className={`flex items-start gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-brand-purple/15 border border-brand-purple/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-brand-purple" />
                </div>
              )}

              <div
                className={`max-w-[78%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser
                    ? "bg-brand-purple text-white rounded-tr-md"
                    : "bg-surface-600 text-surface-100 border border-surface-500 rounded-tl-md"
                }`}
              >
                {message.content || (isLoading && !isUser ? "Thinking..." : "")}
              </div>

              {isUser && (
                <div className="w-8 h-8 rounded-full bg-brand-blue/20 border border-brand-blue/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-brand-blue" />
                </div>
              )}
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="card p-3 space-y-2">
        <label className="label mb-0">Ask your coach</label>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="Am I on track for my course deadline?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className={`btn-primary flex items-center gap-2 ${isLoading || !input.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
