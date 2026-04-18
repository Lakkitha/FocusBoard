import { useMemo, useState } from "react";
import {
  CheckCircle,
  ChevronLeft,
  Plus,
  RotateCcw,
  Trash2,
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
import { useStore } from "../store/useStore";

const TABS = ["Setup", "Score Matrix", "Results"];

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

  const [activeTab, setActiveTab] = useState("Setup");
  const [expandedResults, setExpandedResults] = useState(() => new Set());

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
