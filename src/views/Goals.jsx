import { useState, useMemo } from "react";
import { useStore, getWeekKey } from "../store/useStore";
import { getWeekRange, localDateString } from "../utils/computeWeeklyBudget";
import {
  CheckSquare,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekLabel(weekKey) {
  const start = new Date(weekKey);
  const end = new Date(weekKey);
  end.setDate(end.getDate() + 6);
  const fmt = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function normalizeWeekKey(dateKey) {
  const { weekStart } = getWeekRange(new Date(dateKey));
  return localDateString(weekStart);
}

export default function Goals() {
  const goals = useStore((s) => s.goals);
  const addGoal = useStore((s) => s.addGoal);
  const toggleGoal = useStore((s) => s.toggleGoal);
  const deleteGoal = useStore((s) => s.deleteGoal);
  const updateGoalText = useStore((s) => s.updateGoalText);

  const currentWeek = getWeekKey();
  const [weekOffset, setWeekOffset] = useState(0);
  const [input, setInput] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");

  const activeWeek = useMemo(() => {
    const base = new Date(currentWeek);
    base.setDate(base.getDate() + weekOffset * 7);
    return base.toISOString().slice(0, 10);
  }, [currentWeek, weekOffset]);

  const isCurrentWeek = activeWeek === currentWeek;

  const weekGoals = useMemo(
    () => goals.filter((g) => normalizeWeekKey(g.weekKey) === activeWeek),
    [goals, activeWeek],
  );

  const done = weekGoals.filter((g) => g.done).length;
  const total = weekGoals.length;
  const pct = total > 0 ? (done / total) * 100 : 0;

  const handleAdd = () => {
    const text = input.trim();
    if (!text || total >= 5) return;
    addGoal(text, activeWeek);
    setInput("");
  };

  const handleSaveEdit = (id) => {
    const text = editText.trim();
    if (text) updateGoalText(id, text);
    setEditId(null);
    setEditText("");
  };

  // Carry over incomplete goals from previous week
  const handleCarryOver = () => {
    const prevWeek = addDays(activeWeek, -7);
    const prevGoals = goals.filter(
      (g) => normalizeWeekKey(g.weekKey) === prevWeek && !g.done,
    );
    prevGoals.forEach((g) => {
      if (total < 5) addGoal(g.text, activeWeek);
    });
  };

  const prevWeek = addDays(activeWeek, -7);
  const prevIncomplete = goals.filter(
    (g) => normalizeWeekKey(g.weekKey) === prevWeek && !g.done,
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CheckSquare className="w-5 h-5 text-brand-green" />
        <h1 className="text-2xl font-bold text-surface-50">Weekly Goals</h1>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-between card py-3">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="btn-ghost p-2"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <p className="text-sm font-medium text-surface-50">
            {weekLabel(activeWeek)}
          </p>
          {isCurrentWeek && (
            <span className="text-[11px] font-semibold text-brand-green">
              Current Week
            </span>
          )}
        </div>

        <button
          onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
          disabled={isCurrentWeek}
          className={`btn-ghost p-2 ${isCurrentWeek ? "opacity-30 cursor-not-allowed" : ""}`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-surface-300 font-medium">Progress</span>
            <span className="font-bold text-surface-50">
              {done}/{total} completed
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-500 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background:
                  pct === 100
                    ? "linear-gradient(90deg, #4ade80, #22d3ee)"
                    : "#4ade80",
              }}
            />
          </div>
          {pct === 100 && (
            <p className="text-center text-sm text-brand-green font-semibold animate-pulse">
              🎉 All goals complete!
            </p>
          )}
        </div>
      )}

      {/* Add goal input */}
      {isCurrentWeek && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Add a goal for this week</label>
            <span
              className={`text-xs ${total >= 5 ? "text-red-400" : "text-surface-400"}`}
            >
              {total}/5 goals
            </span>
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="e.g. Complete AWS module 3"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              disabled={total >= 5}
            />
            <button
              onClick={handleAdd}
              disabled={total >= 5 || !input.trim()}
              className={`btn-primary flex-shrink-0 flex items-center gap-1.5 ${
                total >= 5 || !input.trim()
                  ? "opacity-40 cursor-not-allowed"
                  : ""
              }`}
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          {total >= 5 && (
            <p className="text-xs text-surface-400">Max 5 goals per week.</p>
          )}
        </div>
      )}

      {/* Carry over button */}
      {isCurrentWeek && prevIncomplete > 0 && (
        <button
          onClick={handleCarryOver}
          className="btn-secondary flex items-center gap-2 text-xs w-full justify-center py-2.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Carry over {prevIncomplete} incomplete goal
          {prevIncomplete > 1 ? "s" : ""} from last week
        </button>
      )}

      {/* Goal list */}
      {weekGoals.length === 0 ? (
        <div className="card text-center py-12">
          <CheckSquare className="w-10 h-10 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">No goals for this week</p>
          {isCurrentWeek && (
            <p className="text-surface-400 text-sm mt-1">
              Add up to 5 goals to stay focused.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {weekGoals.map((g) => (
            <div
              key={g.id}
              className={`card flex items-start gap-3 group hover:border-surface-400 transition-all py-3 ${
                g.done ? "border-brand-green/20 bg-surface-700/50" : ""
              }`}
            >
              <button
                onClick={() => toggleGoal(g.id)}
                className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110"
              >
                {g.done ? (
                  <CheckCircle2 className="w-5 h-5 text-brand-green" />
                ) : (
                  <Circle className="w-5 h-5 text-surface-400 hover:text-surface-200" />
                )}
              </button>

              {editId === g.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    className="input py-1"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit(g.id);
                      if (e.key === "Escape") {
                        setEditId(null);
                        setEditText("");
                      }
                    }}
                  />
                  <button
                    onClick={() => handleSaveEdit(g.id)}
                    className="btn-primary px-3 py-1 text-xs"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <span
                  onClick={() => {
                    setEditId(g.id);
                    setEditText(g.text);
                  }}
                  className={`flex-1 text-sm cursor-pointer ${
                    g.done
                      ? "line-through text-surface-400"
                      : "text-surface-100 hover:text-surface-50"
                  }`}
                >
                  {g.text}
                </span>
              )}

              <button
                onClick={() => deleteGoal(g.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
