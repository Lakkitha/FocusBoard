import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckSquare,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Square,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { VIEWS } from "../constants";
import ProgressBar from "../components/ProgressBar";
import {
  computeConsensusScore,
  computeMatrix,
  computeSensitivity,
  getScoreLabel,
  getWinMargin,
} from "../utils/decisionEngine";
import { chatWithOllama } from "../services/ollamaService";
import { getChatContext } from "../utils/getChatContext";
import { useStore } from "../store/useStore";

const TABS = ["Setup", "Score Matrix", "Results"];
const ASSISTANT_START_PROMPT =
  "Start the decision assistant. Ask the first question to build the weighted decision matrix.";
const ASSISTANT_MATRIX_PROMPT =
  "Based on what we discussed, propose a full decision matrix now with options, criteria, weights, directions, and scores.";
const ASSISTANT_OFFLINE_MESSAGE =
  "Ollama is not running. Open a terminal and run: ollama serve";

function normalizeLabel(value) {
  const base = String(value || "")
    .trim()
    .toLowerCase();
  const cleaned = base
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || base;
}

function buildDecisionSystemPrompt(decision) {
  const title = decision?.title || "Untitled decision";
  const description = decision?.description || "";
  const options = (decision?.options || []).map((option) => ({
    label: option.label || "",
    notes: option.notes || "",
  }));
  const criteria = (decision?.criteria || []).map((criterion) => ({
    label: criterion.label || "",
    weight: criterion.weight,
    direction: criterion.direction,
    description: criterion.description || "",
  }));

  const optionsText = options.length
    ? options
        .map((item) => `- ${item.label}${item.notes ? ` (${item.notes})` : ""}`)
        .join("\n")
    : "None yet.";
  const criteriaText = criteria.length
    ? criteria
        .map(
          (item) =>
            `- ${item.label} | weight: ${item.weight ?? ""} | direction: ${
              item.direction || "higher_is_better"
            }${item.description ? ` | ${item.description}` : ""}`,
        )
        .join("\n")
    : "None yet.";

  return `You are FocusBoard's Decision Assistant. Your job is to guide the user through a weighted decision matrix by asking one short follow-up question at a time.

Decision:
- Title: ${title}
- Description: ${description || "None"}

Existing options:
${optionsText}

Existing criteria:
${criteriaText}

Rules:
- Ask one question at a time.
- Suggest new options/criteria only if they are not already listed.
- When asked to propose a matrix, include scores for every option/criterion pair.
- Weights can be any positive numbers (they will be normalized later). Prefer 1-10.
- Directions must be "higher_is_better" or "lower_is_better".
- Scores must be integers from 1 to 10.
- When asking a question, leave suggestions arrays empty.
- When suggesting new items, do not repeat existing items.
- For scores, reference option and criterion labels exactly as shown above.
- Respond ONLY with a JSON object in this exact shape:
{
  "assistantMessage": "your question or guidance",
  "suggestions": {
    "options": [{ "label": "", "notes": "" }],
    "criteria": [{ "label": "", "weight": 5, "direction": "higher_is_better", "description": "" }],
    "scores": [{ "option": "Option label", "criterion": "Criterion label", "score": 7 }]
  }
}
- Use empty arrays when there are no new suggestions.
- Do not wrap the JSON in code fences or add extra text.`;
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseAssistantPayload(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;

  const jsonText = extractJsonObject(trimmed);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      return {
        assistantMessage: String(
          parsed?.assistantMessage || parsed?.message || parsed?.question || "",
        ).trim(),
        suggestions:
          parsed?.suggestions || parsed?.matrix || parsed?.data || null,
      };
    } catch {
      return { assistantMessage: trimmed, suggestions: null };
    }
  }

  return { assistantMessage: trimmed, suggestions: null };
}

function normalizeSuggestions(rawSuggestions) {
  const suggestions = rawSuggestions || {};
  return {
    options: Array.isArray(suggestions.options) ? suggestions.options : [],
    criteria: Array.isArray(suggestions.criteria) ? suggestions.criteria : [],
    scores: Array.isArray(suggestions.scores) ? suggestions.scores : [],
  };
}

function createEmptySelection() {
  return {
    options: new Set(),
    criteria: new Set(),
    scores: new Set(),
  };
}

function buildSelectionFromSuggestions(suggestions) {
  const options = new Set();
  const criteria = new Set();
  const scores = new Set();

  (suggestions?.options || []).forEach((item) => {
    const key = normalizeLabel(item?.label);
    if (key) options.add(key);
  });

  (suggestions?.criteria || []).forEach((item) => {
    const key = normalizeLabel(item?.label);
    if (key) criteria.add(key);
  });

  (suggestions?.scores || []).forEach((item) => {
    const optionKey = normalizeLabel(item?.option);
    const criterionKey = normalizeLabel(item?.criterion);
    if (!optionKey || !criterionKey) return;
    scores.add(`${optionKey}::${criterionKey}`);
  });

  return { options, criteria, scores };
}

function coerceOptionSuggestion(item) {
  if (!item) return null;
  if (typeof item === "string") {
    return { label: item, notes: "" };
  }
  if (typeof item === "object") {
    const label = item.label || item.name || "";
    return {
      label,
      notes: item.notes || item.note || "",
    };
  }
  return null;
}

function coerceCriterionSuggestion(item) {
  if (!item) return null;
  if (typeof item === "string") {
    return {
      label: item,
      weight: 5,
      direction: "higher_is_better",
      description: "",
    };
  }
  if (typeof item === "object") {
    return {
      label: item.label || item.name || "",
      weight: item.weight,
      direction: item.direction,
      description: item.description || item.details || "",
    };
  }
  return null;
}

function coerceScoreSuggestion(item) {
  if (!item || typeof item !== "object") return null;
  return {
    option: item.option || item.optionLabel || item.option_name || "",
    criterion:
      item.criterion || item.criterionLabel || item.criterion_name || "",
    score: item.score,
  };
}

function sanitizeSuggestions(rawSuggestions, options = [], criteria = []) {
  const normalized = normalizeSuggestions(rawSuggestions);
  const existingOptions = new Set(
    options
      .filter((option) => option.label)
      .map((option) => normalizeLabel(option.label)),
  );
  const existingCriteria = new Set(
    criteria
      .filter((criterion) => criterion.label)
      .map((criterion) => normalizeLabel(criterion.label)),
  );

  const optionMap = new Map();
  normalized.options.forEach((item) => {
    const coerced = coerceOptionSuggestion(item);
    if (!coerced) return;
    const label = String(coerced.label || "").trim();
    if (!label) return;
    const key = normalizeLabel(label);
    if (!key || existingOptions.has(key) || optionMap.has(key)) return;
    optionMap.set(key, { label, notes: String(coerced.notes || "") });
  });

  const criterionMap = new Map();
  normalized.criteria.forEach((item) => {
    const coerced = coerceCriterionSuggestion(item);
    if (!coerced) return;
    const label = String(coerced.label || "").trim();
    if (!label) return;
    const key = normalizeLabel(label);
    if (!key || existingCriteria.has(key) || criterionMap.has(key)) return;

    const weightValue = Number(coerced.weight);
    const weight = Number.isFinite(weightValue)
      ? Math.min(100, Math.max(1, weightValue))
      : 5;
    const direction =
      coerced.direction === "lower_is_better"
        ? "lower_is_better"
        : "higher_is_better";

    criterionMap.set(key, {
      label,
      weight,
      direction,
      description: String(coerced.description || ""),
    });
  });

  const scoreList = [];
  const scoreKeys = new Set();
  normalized.scores.forEach((item) => {
    const coerced = coerceScoreSuggestion(item);
    if (!coerced) return;
    const optionLabel = String(coerced.option || "").trim();
    const criterionLabel = String(coerced.criterion || "").trim();
    if (!optionLabel || !criterionLabel) return;

    const optionKey = normalizeLabel(optionLabel);
    const criterionKey = normalizeLabel(criterionLabel);
    if (!optionKey || !criterionKey) return;

    const scoreValue = Number(coerced.score);
    if (!Number.isFinite(scoreValue)) return;

    const score = Math.min(10, Math.max(1, Math.round(scoreValue)));
    const key = `${optionKey}::${criterionKey}`;
    if (scoreKeys.has(key)) return;
    scoreKeys.add(key);

    scoreList.push({
      option: optionLabel,
      criterion: criterionLabel,
      score,
    });
  });

  return {
    options: [...optionMap.values()],
    criteria: [...criterionMap.values()],
    scores: scoreList,
  };
}

export default function DecisionDetail({ decisionId, onNavigate }) {
  const decision = useStore((s) =>
    s.decisions.find((item) => item.id === decisionId),
  );
  const addOption = useStore((s) => s.addOption);
  const updateOption = useStore((s) => s.updateOption);
  const deleteOption = useStore((s) => s.deleteOption);
  const addCriterion = useStore((s) => s.addCriterion);
  const updateCriterion = useStore((s) => s.updateCriterion);
  const deleteCriterion = useStore((s) => s.deleteCriterion);
  const setScore = useStore((s) => s.setScore);
  const commitDecision = useStore((s) => s.commitDecision);
  const reopenDecision = useStore((s) => s.reopenDecision);
  const appendDecisionAssistantLog = useStore(
    (s) => s.appendDecisionAssistantLog,
  );
  const clearDecisionAssistantLog = useStore(
    (s) => s.clearDecisionAssistantLog,
  );

  const [activeTab, setActiveTab] = useState("Setup");
  const [expandedResults, setExpandedResults] = useState(() => new Set());
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantError, setAssistantError] = useState("");
  const [assistantSuggestions, setAssistantSuggestions] = useState(null);
  const [assistantSelection, setAssistantSelection] =
    useState(createEmptySelection);
  const assistantAutoStartRef = useRef(false);

  if (!decision) {
    return (
      <div className="p-6 space-y-4 max-w-4xl mx-auto">
        <button
          className="btn-ghost flex items-center gap-2"
          onClick={() => onNavigate(VIEWS.DECISIONS)}
        >
          <ChevronLeft className="w-4 h-4" />
          All Decisions
        </button>
        <div className="card">
          <p className="text-surface-300 font-medium">Decision not found.</p>
        </div>
      </div>
    );
  }

  const criteria = decision.criteria || [];
  const options = decision.options || [];
  const totalWeight = criteria.reduce(
    (sum, criterion) => sum + (Number(criterion.weight) || 0),
    0,
  );
  const resultsDisabled = criteria.length === 0 || options.length === 0;
  const assistantLog = decision.assistantLog || [];
  const shouldAutoOpen =
    assistantLog.length === 0 && criteria.length === 0 && options.length === 0;

  useEffect(() => {
    if (shouldAutoOpen) {
      setAssistantOpen(true);
    }
  }, [shouldAutoOpen]);

  useEffect(() => {
    if (assistantLog.length === 0) {
      assistantAutoStartRef.current = false;
    }
  }, [assistantLog.length]);

  const results = useMemo(() => {
    if (resultsDisabled) return [];
    return computeMatrix(criteria, options);
  }, [criteria, options, resultsDisabled]);

  const sensitivity = useMemo(() => {
    if (resultsDisabled) return [];
    return computeSensitivity(criteria, options);
  }, [criteria, options, resultsDisabled]);

  const consensus = useMemo(() => {
    if (resultsDisabled) return [];
    return computeConsensusScore(criteria, options, 300);
  }, [criteria, options, resultsDisabled]);

  const winMargin = useMemo(() => getWinMargin(results), [results]);

  const winner = options.find((option) => option.id === decision.winnerId);
  const winnerLabel = winner?.label || "Selected option";

  const chartData = results.map((item) => ({
    name: item.label || "Option",
    score: item.totalScore,
    optionId: item.optionId,
  }));

  const sendAssistantMessage = async (
    message,
    { logUserMessage = true } = {},
  ) => {
    const trimmed = String(message || "").trim();
    if (!trimmed || assistantBusy) return;

    setAssistantError("");

    const historySeed = logUserMessage
      ? [...assistantLog, { role: "user", content: trimmed }]
      : assistantLog;

    if (logUserMessage) {
      appendDecisionAssistantLog(decisionId, {
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString(),
      });
    }

    setAssistantBusy(true);

    try {
      const conversationHistory = getChatContext(historySeed, 14);
      const result = await chatWithOllama({
        userMessage: trimmed,
        conversationHistory,
        systemPromptOverride: buildDecisionSystemPrompt(decision),
      });

      if (result?.error === "offline") {
        setAssistantError(ASSISTANT_OFFLINE_MESSAGE);
      }

      const payload = parseAssistantPayload(result?.text || "");
      const assistantMessage =
        payload?.assistantMessage ||
        result?.text ||
        "I could not generate a response just now.";

      appendDecisionAssistantLog(decisionId, {
        role: "assistant",
        content: assistantMessage,
        timestamp: new Date().toISOString(),
      });

      const suggestions = sanitizeSuggestions(
        payload?.suggestions,
        options,
        criteria,
      );
      const hasSuggestions =
        suggestions.options.length > 0 ||
        suggestions.criteria.length > 0 ||
        suggestions.scores.length > 0;

      if (hasSuggestions) {
        setAssistantSuggestions(suggestions);
        setAssistantSelection(buildSelectionFromSuggestions(suggestions));
      } else {
        setAssistantSuggestions(null);
        setAssistantSelection(createEmptySelection());
      }
    } catch (error) {
      console.error("Decision assistant error:", error);
      setAssistantError("Something went wrong. Please try again.");
      appendDecisionAssistantLog(decisionId, {
        role: "assistant",
        content: "I hit a snag. Please try again in a moment.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setAssistantBusy(false);
    }
  };

  useEffect(() => {
    if (!assistantOpen) return;
    if (assistantLog.length > 0) return;
    if (assistantAutoStartRef.current || assistantBusy) return;

    assistantAutoStartRef.current = true;
    sendAssistantMessage(ASSISTANT_START_PROMPT, { logUserMessage: false });
  }, [assistantOpen, assistantBusy, assistantLog.length]);

  const handleAssistantSubmit = (event) => {
    event?.preventDefault?.();
    if (!assistantInput.trim()) return;
    sendAssistantMessage(assistantInput, { logUserMessage: true });
    setAssistantInput("");
  };

  const handleAssistantMatrix = () => {
    sendAssistantMessage(ASSISTANT_MATRIX_PROMPT, { logUserMessage: true });
  };

  const handleAssistantReset = () => {
    if (!confirm("Clear the assistant log for this decision?")) return;
    clearDecisionAssistantLog(decisionId);
    setAssistantSuggestions(null);
    setAssistantSelection(createEmptySelection());
    setAssistantInput("");
  };

  const toggleAssistantSelection = (type, key) => {
    if (!key) return;
    setAssistantSelection((prev) => {
      const next = {
        options: new Set(prev.options),
        criteria: new Set(prev.criteria),
        scores: new Set(prev.scores),
      };
      if (next[type]?.has(key)) {
        next[type].delete(key);
      } else {
        next[type].add(key);
      }
      return next;
    });
  };

  const selectedCounts = {
    options: assistantSelection.options.size,
    criteria: assistantSelection.criteria.size,
    scores: assistantSelection.scores.size,
  };

  const selectedTotal =
    selectedCounts.options + selectedCounts.criteria + selectedCounts.scores;

  const handleApplySuggestions = () => {
    if (!assistantSuggestions) return;

    const sanitized = sanitizeSuggestions(
      assistantSuggestions,
      options,
      criteria,
    );
    const existingOptions = new Map(
      options
        .filter((option) => option.label)
        .map((option) => [normalizeLabel(option.label), option]),
    );
    const existingCriteria = new Map(
      criteria
        .filter((criterion) => criterion.label)
        .map((criterion) => [normalizeLabel(criterion.label), criterion]),
    );

    sanitized.options.forEach((item) => {
      const label = String(item?.label || "").trim();
      if (!label) return;
      const key = normalizeLabel(label);
      if (!assistantSelection.options.has(key)) return;
      if (existingOptions.has(key)) return;

      const created = addOption(decisionId, {
        label,
        notes: String(item?.notes || ""),
      });

      if (created?.id) {
        existingOptions.set(key, created);
      }
    });

    sanitized.criteria.forEach((item) => {
      const label = String(item?.label || "").trim();
      if (!label) return;
      const key = normalizeLabel(label);
      if (!assistantSelection.criteria.has(key)) return;
      if (existingCriteria.has(key)) return;

      const direction =
        item?.direction === "lower_is_better"
          ? "lower_is_better"
          : "higher_is_better";
      const weight = Number(item?.weight);

      const created = addCriterion(decisionId, {
        label,
        description: String(item?.description || ""),
        weight: Number.isFinite(weight) && weight > 0 ? weight : 5,
        direction,
      });

      if (created?.id) {
        existingCriteria.set(key, created);
      }
    });

    sanitized.scores.forEach((item) => {
      const optionKey = normalizeLabel(item?.option);
      const criterionKey = normalizeLabel(item?.criterion);
      const scoreValue = Number(item?.score);
      if (!optionKey || !criterionKey || !Number.isFinite(scoreValue)) return;

      const scoreKey = `${optionKey}::${criterionKey}`;
      if (!assistantSelection.scores.has(scoreKey)) return;

      const option = existingOptions.get(optionKey);
      const criterion = existingCriteria.get(criterionKey);
      if (!option || !criterion) return;

      if (
        option.scores &&
        Object.prototype.hasOwnProperty.call(option.scores, criterion.id)
      ) {
        return;
      }

      setScore(decisionId, option.id, criterion.id, scoreValue);
    });

    setAssistantSuggestions(null);
    setAssistantSelection(createEmptySelection());
  };

  const toggleBreakdown = (optionId) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      return next;
    });
  };

  const handleCommit = () => {
    const topResult = results[0];
    if (!topResult) return;
    if (
      !confirm(
        `Commit to ${topResult.label || "this option"}? This records your decision.`,
      )
    ) {
      return;
    }
    commitDecision(decisionId, topResult.optionId);
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="space-y-4">
        <button
          className="btn-ghost flex items-center gap-2"
          onClick={() => onNavigate(VIEWS.DECISIONS)}
        >
          <ChevronLeft className="w-4 h-4" />
          All Decisions
        </button>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-surface-50">
            {decision.title || "Untitled decision"}
          </h1>
          {decision.status === "decided" ? (
            <div className="bg-brand-green/10 border border-brand-green/30 text-brand-green rounded-lg px-4 py-2 text-sm">
              <span aria-hidden="true">&#10003;</span> Decision made:{" "}
              {winnerLabel}
            </div>
          ) : null}
        </div>

        {criteria.length === 0 && options.length === 0 ? (
          <div className="card space-y-2">
            <p className="text-sm font-semibold text-surface-50">
              How weighted decisions work
            </p>
            <p className="text-xs text-surface-300">
              Add options, define criteria, then score each option from 1 to 10.
              We normalize your weights so only their relative importance
              matters.
            </p>
            <div className="text-xs text-surface-400 space-y-1">
              <p>
                1) Each criterion gets a weight and direction (higher or lower
                is better).
              </p>
              <p>2) Scores are weighted and summed into a total out of 10.</p>
              <p>
                3) For "lower is better", scores are inverted so lower values
                rank higher.
              </p>
            </div>
          </div>
        ) : null}

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-purple" />
              <div>
                <p className="text-sm font-semibold text-surface-50">
                  Decision Assistant
                </p>
                <p className="text-xs text-surface-400">
                  Guided questions to build your matrix
                </p>
              </div>
            </div>
            <button
              className="btn-ghost flex items-center gap-2"
              onClick={() => setAssistantOpen((prev) => !prev)}
            >
              {assistantOpen ? (
                <>
                  Hide
                  <ChevronUp className="w-4 h-4" />
                </>
              ) : (
                <>
                  Show
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {assistantOpen ? (
            <div className="space-y-4">
              {assistantError ? (
                <div className="flex items-start gap-2 text-xs text-brand-red bg-brand-red/10 border border-brand-red/30 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{assistantError}</span>
                </div>
              ) : null}

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {assistantLog.length === 0 && !assistantBusy ? (
                  <p className="text-sm text-surface-400">
                    The assistant will ask a few questions to shape your
                    criteria, options, and scores.
                  </p>
                ) : null}
                {assistantLog.map((entry, index) => {
                  const isUser = entry.role === "user";
                  return (
                    <div
                      key={entry.timestamp || index}
                      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                          isUser
                            ? "bg-brand-blue/30 text-white"
                            : "bg-surface-600 text-surface-100 border border-surface-500"
                        }`}
                      >
                        {entry.content}
                      </div>
                    </div>
                  );
                })}
                {assistantBusy ? (
                  <div className="flex items-center gap-2 text-xs text-surface-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Thinking...
                  </div>
                ) : null}
              </div>

              <form
                onSubmit={handleAssistantSubmit}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  className="input flex-1"
                  placeholder="Answer the assistant or ask a question..."
                  value={assistantInput}
                  onChange={(event) => setAssistantInput(event.target.value)}
                  disabled={assistantBusy}
                />
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-2"
                  disabled={assistantBusy || !assistantInput.trim()}
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary flex items-center gap-2"
                  onClick={handleAssistantMatrix}
                  disabled={assistantBusy}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate matrix
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleAssistantReset}
                  disabled={assistantBusy}
                >
                  Reset assistant
                </button>
              </div>

              {assistantSuggestions ? (
                <div className="bg-surface-800 border border-surface-600 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-surface-300">
                      Suggested additions
                    </p>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => {
                        setAssistantSuggestions(null);
                        setAssistantSelection(createEmptySelection());
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="text-xs text-surface-400">
                    Selected {selectedTotal} of{" "}
                    {assistantSuggestions.options.length +
                      assistantSuggestions.criteria.length +
                      assistantSuggestions.scores.length}
                  </div>

                  {assistantSuggestions.options.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-surface-400">Options</p>
                      <div className="space-y-1">
                        {assistantSuggestions.options.map((item, index) => {
                          const key = normalizeLabel(item?.label);
                          const selected = assistantSelection.options.has(key);
                          return (
                            <button
                              key={`${item.label}-${index}`}
                              type="button"
                              onClick={() =>
                                toggleAssistantSelection("options", key)
                              }
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded-md border text-xs transition-colors ${
                                selected
                                  ? "border-brand-purple/40 bg-brand-purple/10 text-surface-50"
                                  : "border-surface-600 text-surface-300 hover:bg-surface-700"
                              }`}
                            >
                              {selected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-brand-purple" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-surface-400" />
                              )}
                              <span className="truncate">
                                {item.label || "Untitled option"}
                              </span>
                              {item.notes ? (
                                <span className="text-surface-500 truncate">
                                  - {item.notes}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {assistantSuggestions.criteria.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-surface-400">Criteria</p>
                      <div className="space-y-1">
                        {assistantSuggestions.criteria.map((item, index) => {
                          const key = normalizeLabel(item?.label);
                          const selected = assistantSelection.criteria.has(key);
                          return (
                            <button
                              key={`${item.label}-${index}`}
                              type="button"
                              onClick={() =>
                                toggleAssistantSelection("criteria", key)
                              }
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded-md border text-xs transition-colors ${
                                selected
                                  ? "border-brand-purple/40 bg-brand-purple/10 text-surface-50"
                                  : "border-surface-600 text-surface-300 hover:bg-surface-700"
                              }`}
                            >
                              {selected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-brand-purple" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-surface-400" />
                              )}
                              <span className="truncate">
                                {item.label || "Untitled criterion"}
                              </span>
                              <span className="text-surface-500">
                                {item.weight ? `(${item.weight})` : ""}
                              </span>
                              <span className="text-surface-500 truncate">
                                {item.direction === "lower_is_better"
                                  ? "Lower"
                                  : "Higher"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {assistantSuggestions.scores.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-surface-400">Scores</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {assistantSuggestions.scores.map((item, index) => {
                          const optionKey = normalizeLabel(item?.option);
                          const criterionKey = normalizeLabel(item?.criterion);
                          const scoreKey =
                            optionKey && criterionKey
                              ? `${optionKey}::${criterionKey}`
                              : "";
                          const selected = scoreKey
                            ? assistantSelection.scores.has(scoreKey)
                            : false;
                          return (
                            <button
                              key={`${item.option}-${item.criterion}-${index}`}
                              type="button"
                              onClick={() =>
                                toggleAssistantSelection("scores", scoreKey)
                              }
                              className={`w-full flex items-center gap-2 px-2 py-1 rounded-md border text-xs transition-colors ${
                                selected
                                  ? "border-brand-purple/40 bg-brand-purple/10 text-surface-50"
                                  : "border-surface-600 text-surface-300 hover:bg-surface-700"
                              }`}
                            >
                              {selected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-brand-purple" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-surface-400" />
                              )}
                              <span className="truncate">
                                {item.option || "Option"} /{" "}
                                {item.criterion || "Criterion"}
                              </span>
                              <span className="text-surface-500">
                                {item.score}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="btn-primary flex items-center gap-2"
                    onClick={handleApplySuggestions}
                    disabled={selectedTotal === 0}
                  >
                    <Wand2 className="w-4 h-4" />
                    Apply suggestions
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            const isDisabled = tab === "Results" && resultsDisabled;
            return (
              <button
                key={tab}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  isActive
                    ? "bg-brand-purple/20 text-brand-purple border-brand-purple/30"
                    : "bg-surface-600 text-surface-300 border-transparent hover:bg-surface-500"
                } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => {
                  if (isDisabled) return;
                  setActiveTab(tab);
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "Setup" ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-surface-50">Options</h2>
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={() => addOption(decisionId, {})}
              >
                <Plus className="w-4 h-4" />
                Add Option
              </button>
            </div>

            {options.length === 0 ? (
              <p className="text-sm text-surface-400">
                Add at least 2 options to compare
              </p>
            ) : null}

            {options.map((option) => (
              <div key={option.id} className="card space-y-2">
                <input
                  className="input"
                  placeholder="Option name..."
                  value={option.label}
                  onChange={(e) =>
                    updateOption(decisionId, option.id, {
                      label: e.target.value,
                    })
                  }
                />
                <textarea
                  className="input min-h-[60px] resize-none"
                  placeholder="Notes..."
                  value={option.notes}
                  onChange={(e) =>
                    updateOption(decisionId, option.id, {
                      notes: e.target.value,
                    })
                  }
                />
                {options.length > 1 ? (
                  <button
                    className="btn-danger flex items-center gap-2"
                    onClick={() => {
                      if (!confirm("Delete this option?")) return;
                      deleteOption(decisionId, option.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Option
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-surface-50">
                Criteria & Weights
              </h2>
              <button
                className="btn-secondary flex items-center gap-2"
                onClick={() => addCriterion(decisionId, {})}
              >
                <Plus className="w-4 h-4" />
                Add Criterion
              </button>
            </div>

            <p className="text-xs text-surface-400">
              Enter any numbers - weights are automatically normalized.
            </p>
            <p className="text-xs text-surface-400">
              Total weight: {totalWeight}
            </p>

            {criteria.map((criterion) => (
              <div key={criterion.id} className="card space-y-3">
                <div className="flex items-start gap-2">
                  <input
                    className="input"
                    placeholder="Criterion name..."
                    value={criterion.label}
                    onChange={(e) =>
                      updateCriterion(decisionId, criterion.id, {
                        label: e.target.value,
                      })
                    }
                  />
                  <button
                    className="btn-danger"
                    onClick={() => {
                      if (!confirm("Delete this criterion?")) return;
                      deleteCriterion(decisionId, criterion.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Weight</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="input"
                      value={criterion.weight}
                      onChange={(e) =>
                        updateCriterion(decisionId, criterion.id, {
                          weight: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Direction</label>
                    <select
                      className="input"
                      value={criterion.direction}
                      onChange={(e) =>
                        updateCriterion(decisionId, criterion.id, {
                          direction: e.target.value,
                        })
                      }
                    >
                      <option value="higher_is_better">Higher is better</option>
                      <option value="lower_is_better">Lower is better</option>
                    </select>
                  </div>
                </div>

                <input
                  className="input"
                  placeholder="What does this measure?"
                  value={criterion.description}
                  onChange={(e) =>
                    updateCriterion(decisionId, criterion.id, {
                      description: e.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === "Score Matrix" ? (
        <div className="space-y-4">
          {resultsDisabled ? (
            <div className="text-sm text-surface-400 text-center">
              Add at least one option and one criterion in the Setup tab first.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      <th className="bg-surface-700 px-3 py-2 text-left" />
                      {criteria.map((criterion) => (
                        <th
                          key={criterion.id}
                          className="bg-surface-700 px-3 py-2 text-left text-xs font-medium text-surface-300"
                        >
                          <div>{criterion.label || "Untitled"}</div>
                          <div className="text-[10px] text-surface-400">
                            ({criterion.weight})
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((option) => (
                      <tr key={option.id}>
                        <td className="bg-surface-700 sticky left-0 z-10 px-3 py-2 text-sm font-medium text-surface-100">
                          {option.label || "Option"}
                        </td>
                        {criteria.map((criterion) => {
                          const score = option.scores?.[criterion.id] ?? 5;
                          return (
                            <td key={criterion.id} className="px-3 py-2">
                              <div className="flex flex-col items-center gap-1">
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={score}
                                  onChange={(e) =>
                                    setScore(
                                      decisionId,
                                      option.id,
                                      criterion.id,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-16 text-center bg-surface-600 border border-surface-500 rounded-lg px-2 py-1.5 text-sm text-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-purple/50"
                                />
                                <span className="text-[10px] text-surface-400 text-center">
                                  {getScoreLabel(score)}
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    options.forEach((option) => {
                      criteria.forEach((criterion) => {
                        setScore(decisionId, option.id, criterion.id, 5);
                      });
                    });
                  }}
                >
                  Fill all with 5
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {activeTab === "Results" ? (
        <div className="space-y-6">
          {resultsDisabled ? (
            <div className="text-sm text-surface-400 text-center">
              Add at least one option and one criterion in the Setup tab first.
            </div>
          ) : (
            <>
              {results[0] ? (
                <div className="bg-brand-purple/10 border border-brand-purple/30 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-surface-400 uppercase tracking-wide">
                    <span aria-hidden="true">&#x1F3C6;</span> Recommended Choice
                  </p>
                  <div className="text-2xl font-bold text-surface-50">
                    {results[0].label || "Top option"}
                  </div>
                  <div className="text-sm text-surface-300">
                    {results[0].totalScore}/10 weighted score -{" "}
                    {results[0].percentageOfMax}% of maximum
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {winMargin?.isClose ? (
                      <span className="badge bg-brand-amber/20 text-brand-amber">
                        <span aria-hidden="true">&#9888;</span> Close call -
                        margin of {winMargin.margin.toFixed(2)}
                      </span>
                    ) : null}
                    {winMargin?.isClear ? (
                      <span className="badge bg-brand-green/20 text-brand-green">
                        Clear winner
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="card">
                <h3 className="text-sm font-semibold text-surface-50 mb-4">
                  Score Comparison
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#3a3a48"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a3a3b3", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fill: "#a3a3b3", fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => Number(value).toFixed(2)}
                      contentStyle={{
                        background: "#1f1f27",
                        border: "1px solid #3a3a48",
                      }}
                      labelStyle={{ color: "#e8e8e8" }}
                    />
                    <Bar dataKey="score" fill="#7c6af7" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.optionId}
                          fill={
                            entry.optionId === results[0]?.optionId
                              ? "#4ade80"
                              : "#7c6af7"
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-surface-50">
                  Ranked Results
                </h3>
                {results.map((result, index) => {
                  const rank = index + 1;
                  const rankColor =
                    rank === 1
                      ? "text-brand-green"
                      : rank === 2
                        ? "text-brand-blue"
                        : rank === 3
                          ? "text-brand-amber"
                          : "text-surface-400";
                  const isExpanded = expandedResults.has(result.optionId);

                  return (
                    <div key={result.optionId} className="card space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-2xl font-bold ${rankColor}`}>
                            {rank}
                          </span>
                          <div>
                            <p className="font-semibold text-surface-50">
                              {result.label || "Option"}
                            </p>
                            <p className="text-xs text-surface-400">
                              {result.totalScore.toFixed(2)} / 10
                            </p>
                          </div>
                        </div>
                        <button
                          className="text-sm text-brand-purple hover:text-brand-purple/80"
                          onClick={() => toggleBreakdown(result.optionId)}
                        >
                          {isExpanded ? "Hide breakdown" : "Show breakdown"}
                        </button>
                      </div>

                      <ProgressBar
                        value={result.totalScore}
                        max={10}
                        color={rank === 1 ? "#4ade80" : "#7c6af7"}
                      />

                      {isExpanded ? (
                        <div className="space-y-1">
                          {criteria.map((criterion) => {
                            const detail = result.breakdown[criterion.id];
                            if (!detail) return null;
                            return (
                              <div
                                key={criterion.id}
                                className="text-xs text-surface-400"
                              >
                                {criterion.label}: score {detail.rawScore}/10{" "}
                                <span aria-hidden="true">&#8594;</span>{" "}
                                contributes {detail.contribution.toFixed(2)}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-surface-50">
                    Sensitivity Analysis
                  </h3>
                  <p className="text-xs text-surface-400 italic">
                    Shows what happens if each criterion's weight is reduced by
                    20%
                  </p>
                </div>
                <div className="space-y-2">
                  {sensitivity.map((item) => (
                    <div
                      key={item.criterionId}
                      className="card flex items-center justify-between"
                    >
                      <span className="text-sm text-surface-50">
                        {item.criterionLabel}
                      </span>
                      {item.winnerChanges ? (
                        <span className="badge bg-red-500/10 text-red-400">
                          Winner changes!
                        </span>
                      ) : (
                        <span className="badge bg-brand-green/10 text-brand-green">
                          Stable
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-surface-50">
                    Robustness Check
                  </h3>
                  <p className="text-xs text-surface-400">
                    How often each option wins across 300 random weight
                    distributions
                  </p>
                </div>
                <div className="space-y-3">
                  {consensus.map((item) => {
                    const color =
                      item.consensusPercentage > 60
                        ? "#4ade80"
                        : item.consensusPercentage > 40
                          ? "#7c6af7"
                          : "#fbbf24";

                    return (
                      <div key={item.optionId} className="card space-y-2">
                        <div className="flex items-center justify-between text-sm text-surface-50">
                          <span>{item.label}</span>
                          <span>{item.consensusPercentage}%</span>
                        </div>
                        <ProgressBar
                          value={item.consensusPercentage}
                          max={100}
                          color={color}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                {decision.status === "active" && results[0] ? (
                  <button
                    className="btn-primary flex items-center gap-2"
                    onClick={handleCommit}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Commit to: {results[0].label || "Top option"}
                  </button>
                ) : null}

                {decision.status === "decided" ? (
                  <div className="space-y-2">
                    <p className="text-sm text-surface-400">
                      Decision committed on{" "}
                      {new Date(decision.decidedAt).toLocaleDateString()}
                    </p>
                    <button
                      className="btn-ghost flex items-center gap-2"
                      onClick={() => reopenDecision(decisionId)}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reopen Decision
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
