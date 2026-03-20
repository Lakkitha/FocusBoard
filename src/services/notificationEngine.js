import { buildAIContext } from "../utils/buildAIContext";
import { chatWithOllama } from "./ollamaService";

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_INITIAL_DELAY_MINUTES = 5;

let streakNudgeSentToday = false;
let budgetNudgeSentToday = false;
let midnightResetTimer = null;
let budgetNudgeTimer = null;
let budgetNudgeInterval = null;

function buildNudgeSystemPrompt(storeSnapshot) {
  const snapshotJson = JSON.stringify(storeSnapshot || {}, null, 2);
  return `You are FocusBoard's motivational nudge generator.\n\n## LIVE USER DATA (use only this for any stats)\n${snapshotJson}\n\nRules:\n- Generate one short, specific, coach-like nudge.\n- Compare this week vs last week when possible.\n- If you cannot find relevant data, say you don't have enough information.\n- Keep it under 20 words.`;
}

function buildStreakSystemPrompt(storeSnapshot, currentStreak) {
  const snapshotJson = JSON.stringify(storeSnapshot || {}, null, 2);
  return `You are FocusBoard's streak protector.\n\n## LIVE USER DATA (use only this for any stats)\n${snapshotJson}\n\nRules:\n- Write one short sentence to motivate logging a session before midnight.\n- Mention the current streak length (${currentStreak} days).\n- Keep it under 18 words.`;
}

function buildBudgetSystemPrompt(storeSnapshot, categoryName, daysRemaining) {
  const snapshotJson = JSON.stringify(storeSnapshot || {}, null, 2);
  return `You are FocusBoard's budget coach.\n\n## LIVE USER DATA (use only this for any stats)\n${snapshotJson}\n\nRules:\n- Write one short sentence about staying on pace.\n- Mention ${categoryName} and ${daysRemaining} days left.\n- Keep it under 18 words.`;
}

function scheduleMidnightReset() {
  if (midnightResetTimer) clearTimeout(midnightResetTimer);
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const delay = nextMidnight.getTime() - now.getTime();

  midnightResetTimer = setTimeout(() => {
    streakNudgeSentToday = false;
    budgetNudgeSentToday = false;
    scheduleMidnightReset();
  }, delay);
}

function msUntilNextNineAM() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
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

  scheduleMidnightReset();

  const sendBudgetNudge = async () => {
    if (stopped || budgetNudgeSentToday) return;

    const storeSnapshot = buildAIContext(getState());
    const budget = storeSnapshot?.weeklyBudget;
    if (!budget?.categories?.length) return;

    const behindCategory = budget.categories
      .filter((category) => category.status === "behind")
      .filter((category) => category.remainingHours > 2)
      .map((category) => {
        const expected = (category.targetHours * category.pace) / 100;
        return {
          name: category.name,
          gapHours: Math.max(0, expected - category.loggedHours),
        };
      })
      .sort((a, b) => b.gapHours - a.gapHours)[0];

    if (!behindCategory || behindCategory.gapHours <= 0) return;

    const systemPromptOverride = buildBudgetSystemPrompt(
      storeSnapshot,
      behindCategory.name,
      budget.daysRemaining,
    );
    const userMessage =
      "Write one sentence to nudge focus on the most behind category.";

    try {
      const result = await chatWithOllama({
        userMessage,
        storeSnapshot,
        conversationHistory: [],
        systemPromptOverride,
      });

      if (result?.error || !result?.text) return;

      window.electronAPI.showNotification("FocusBoard Budget", result.text);
      budgetNudgeSentToday = true;
    } catch (error) {
      console.error("Budget nudge failed:", error);
    }
  };

  const sendNudge = async () => {
    if (stopped) return;

    const storeSnapshot = buildAIContext(getState());
    if (storeSnapshot?.streak?.streakAtRisk && !streakNudgeSentToday) {
      const currentStreak = Number(storeSnapshot.streak.current || 0);
      const systemPromptOverride = buildStreakSystemPrompt(
        storeSnapshot,
        currentStreak,
      );
      const userMessage =
        "Write one sentence to keep the streak alive by logging a session tonight.";

      try {
        const result = await chatWithOllama({
          userMessage,
          storeSnapshot,
          conversationHistory: [],
          systemPromptOverride,
        });

        if (result?.error || !result?.text) return;

        window.electronAPI.showNotification(
          "Your streak is at risk 🔥",
          result.text,
        );
        streakNudgeSentToday = true;
      } catch (error) {
        console.error("Streak nudge failed:", error);
      }

      return;
    }

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

  budgetNudgeTimer = setTimeout(() => {
    sendBudgetNudge();
    budgetNudgeInterval = setInterval(sendBudgetNudge, 24 * 60 * 60 * 1000);
  }, msUntilNextNineAM());

  return () => {
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
    if (midnightResetTimer) clearTimeout(midnightResetTimer);
    if (budgetNudgeTimer) clearTimeout(budgetNudgeTimer);
    if (budgetNudgeInterval) clearInterval(budgetNudgeInterval);
  };
}
