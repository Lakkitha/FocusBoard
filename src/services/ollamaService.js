import { OLLAMA_BASE_URL, OLLAMA_MODEL } from "../config/ai";

const CHAT_ENDPOINT = `${OLLAMA_BASE_URL}/api/chat`;
const GENERATE_ENDPOINT = `${OLLAMA_BASE_URL}/api/generate`;

export const OLLAMA_OFFLINE_MESSAGE =
  "Ollama isn't running. Start it with: ollama serve";

function buildSystemPrompt(storeSnapshot) {
  const snapshotJson = JSON.stringify(storeSnapshot || {}, null, 2);
  return `You are FocusBoard's personal productivity AI assistant.\n\n## LIVE USER DATA (use only this for any stats)\n${snapshotJson}\n\nRules:\n- Never estimate or use training knowledge for any numbers.\n- If a stat is not in the data above, say you don't have that information.\n- Keep responses concise, motivating, and coach-like.\n- Use comparisons (this week vs last week) when relevant.\n- When answering weekly questions, always name the week ranges from weekRanges.thisWeek and weekRanges.lastWeek.`;
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
