import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "../config/ai";

const CHAT_ENDPOINT = `${OLLAMA_BASE_URL}/api/chat`;
const GENERATE_ENDPOINT = `${OLLAMA_BASE_URL}/api/generate`;

export const OLLAMA_OFFLINE_MESSAGE =
  "Ollama isn't running. Start it with: ollama serve";

function buildSystemPrompt(storeSnapshot) {
  const snapshotJson = JSON.stringify(storeSnapshot || {}, null, 2);
  return `You are FocusBoard's personal productivity AI assistant.\n\n## LIVE USER DATA (use only this for any stats)\n${snapshotJson}\n\nRules:\n- Never estimate or use training knowledge for any numbers.\n- If a stat is not in the data above, say you don't have that information.\n- Keep responses concise, motivating, and coach-like.\n- Use comparisons (this week vs last week) when relevant.\n- When answering weekly questions, always name the week ranges from weekRanges.thisWeek and weekRanges.lastWeek.\n- When asked about streaks, consistency, or habits, reference streak.current, streak.best, and streak.todayLogged from the data and be specific (e.g. how close to the best).\n- For questions about this week's focus, priorities, or what to work on, reference weeklyBudget. Use weeklyBudget.aiSummary first, then add specific category details and mention how many days are left.\n- For questions about deadlines, upcoming work, or project planning, reference upcomingMilestones and always mention specific milestone names and due dates. If overdueCount > 0, proactively mention it when the user asks about projects or priorities.\n\nYou have access to the conversation history above. Use it to maintain continuity. If the user refers to something mentioned earlier in this conversation, reference it directly. Do not re-explain things you already covered unless asked. If the conversation history is empty, treat this as a fresh start.`;
}

function buildTitleSystemPrompt() {
  return "You generate short 4-5 word conversation titles. Reply with ONLY the title, no punctuation, no quotes.";
}

function fallbackTitle(text = "") {
  const trimmed = text.trim();
  if (trimmed.length <= 30) return trimmed || "New conversation";
  return `${trimmed.slice(0, 30)}...`;
}

function buildGeneratePrompt(systemPrompt, conversationHistory, userMessage) {
  const historyText = (conversationHistory || [])
    .filter((message) => ["user", "assistant"].includes(message.role))
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");

  return [
    systemPrompt,
    historyText ? "\n\nCONVERSATION HISTORY:\n" + historyText : "",
    "\n\nUSER:\n" + userMessage,
  ].join("");
}

function safeParseJSONLine(line) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

function isOfflineError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error?.name === "TypeError" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("connection")
  );
}

export async function chatWithOllama({
  userMessage,
  storeSnapshot,
  conversationHistory = [],
  onChunk,
  systemPromptOverride,
} = {}) {
  try {
    const systemPrompt =
      systemPromptOverride || buildSystemPrompt(storeSnapshot);
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.filter((message) =>
        ["user", "assistant"].includes(message.role),
      ),
      { role: "user", content: userMessage },
    ];

    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: true,
      }),
    });

    let activeResponse = response;
    let usedGenerate = false;

    if (!response.ok && response.status === 404) {
      const prompt = buildGeneratePrompt(
        systemPrompt,
        conversationHistory,
        userMessage,
      );
      activeResponse = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: true,
        }),
      });
      usedGenerate = true;
    }

    if (!activeResponse.ok) {
      const error = new Error(
        `Ollama request failed with status ${activeResponse.status}`,
      );
      error.status = activeResponse.status;
      throw error;
    }

    if (!activeResponse.body) {
      throw new Error("No response stream returned by Ollama");
    }

    const reader = activeResponse.body.getReader();
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

        const parsed = safeParseJSONLine(trimmed);
        if (!parsed) continue;

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        const content = usedGenerate
          ? parsed.response || ""
          : parsed.message?.content || parsed.response || "";
        if (content) {
          fullText += content;
          if (onChunk) onChunk(fullText);
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      const parsedTail = safeParseJSONLine(tail);
      const content = usedGenerate
        ? parsedTail?.response || ""
        : parsedTail?.message?.content || parsedTail?.response || "";
      if (content) {
        fullText += content;
        if (onChunk) onChunk(fullText);
      }
    }

    return { text: fullText.trim(), error: null };
  } catch (error) {
    if (isOfflineError(error)) {
      return { text: OLLAMA_OFFLINE_MESSAGE, error: "offline" };
    }
    throw error;
  }
}

export async function generateThreadTitle(firstUserMessage = "") {
  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: "system", content: buildTitleSystemPrompt() },
          { role: "user", content: firstUserMessage },
        ],
        stream: false,
      }),
    });

    let activeResponse = response;
    let usedGenerate = false;

    if (!response.ok && response.status === 404) {
      const prompt = `${buildTitleSystemPrompt()}\n\nUSER:\n${firstUserMessage}`;
      activeResponse = await fetch(GENERATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: false,
        }),
      });
      usedGenerate = true;
    }

    if (!activeResponse.ok) {
      return fallbackTitle(firstUserMessage);
    }

    const data = await activeResponse.json();
    const content = usedGenerate
      ? data?.response
      : data?.message?.content || data?.response;

    return String(content || "").trim() || fallbackTitle(firstUserMessage);
  } catch {
    return fallbackTitle(firstUserMessage);
  }
}
