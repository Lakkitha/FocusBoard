import { buildAIContext } from "../utils/buildAIContext";
import { chatWithOllama } from "./ollamaService";

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_INITIAL_DELAY_MINUTES = 5;

function buildNudgeSystemPrompt(storeSnapshot) {
  const snapshotJson = JSON.stringify(storeSnapshot || {}, null, 2);
  return `You are FocusBoard's motivational nudge generator.\n\n## LIVE USER DATA (use only this for any stats)\n${snapshotJson}\n\nRules:\n- Generate one short, specific, coach-like nudge.\n- Compare this week vs last week when possible.\n- If you cannot find relevant data, say you don't have enough information.\n- Keep it under 20 words.`;
}

export function startNotificationEngine({
  getState,
  intervalMinutes = DEFAULT_INTERVAL_MINUTES,
  initialDelayMinutes = DEFAULT_INITIAL_DELAY_MINUTES,
} = {}) {
  if (
    !getState ||
    typeof window === "undefined" ||
    !window.electronAPI?.showNotification
  ) {
    return () => {};
  }

  let intervalId = null;
  let timeoutId = null;
  let stopped = false;

  const sendNudge = async () => {
    if (stopped) return;

    const storeSnapshot = buildAIContext(getState());
    const systemPromptOverride = buildNudgeSystemPrompt(storeSnapshot);
    const userMessage =
      "Generate one short motivational nudge based on the current week progress.";

    try {
      const result = await chatWithOllama({
        userMessage,
        storeSnapshot,
        conversationHistory: [],
        systemPromptOverride,
      });

      if (result?.error || !result?.text) return;

      window.electronAPI.showNotification("FocusBoard", result.text);
    } catch (error) {
      console.error("Notification nudge failed:", error);
    }
  };

  timeoutId = setTimeout(
    () => {
      sendNudge();
      intervalId = setInterval(
        sendNudge,
        Math.max(1, intervalMinutes) * 60 * 1000,
      );
    },
    Math.max(1, initialDelayMinutes) * 60 * 1000,
  );

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
  };
}
