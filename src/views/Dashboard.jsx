import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useStore, getWeekKey } from "../store/useStore";
import {
  ArrowRight,
  Clock,
  TrendingUp,
  CheckCircle2,
  Circle,
  Settings2,
  Briefcase,
} from "lucide-react";
import { VIEWS } from "../constants";
import { getTrackedCategories, getSessionCategoryKey } from "../viewConfig";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value, color } = payload[0];
    return (
      <div className="bg-surface-600 border border-surface-400 rounded-lg px-3 py-2 shadow-xl text-xs">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: color }}
          />
          <span className="text-surface-100">{name}</span>
        </div>
        <p className="text-surface-50 font-semibold mt-0.5">
          {(value / 60).toFixed(1)} hrs
        </p>
      </div>
    );
  }
  return null;
};

const RADIAN = Math.PI / 180;
const renderCustomLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  if (percent < 0.06) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="11"
      fontWeight="600"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Dashboard({ onNavigate }) {
  const sessions = useStore((s) => s.sessions);
  const courses = useStore((s) => s.courses);
  const projects = useStore((s) => s.projects);
  const personalProjects = useStore((s) => s.personalProjects);
  const customViews = useStore((s) => s.customViews);
  const categoryTargets = useStore((s) => s.categoryTargets);
  const goals = useStore((s) => s.goals);
  const setCategoryTarget = useStore((s) => s.setCategoryTarget);

  const [editTargets, setEditTargets] = useState(false);
  const [draftTargets, setDraftTargets] = useState({});
  const categories = useMemo(
    () => getTrackedCategories(customViews),
    [customViews],
  );

  // Minutes per category — all time
  const actualMinutes = useMemo(() => {
    const map = categories.reduce((acc, cat) => {
      acc[cat.key] = 0;
      return acc;
    }, {});

    for (const s of sessions) {
      const cat = getSessionCategoryKey(s);
      if (cat && map[cat] !== undefined) map[cat] += s.minutes || 0;
    }
    return map;
  }, [sessions, categories]);

  // Target minutes per category
  const targetMinutes = useMemo(
    () =>
      categories.reduce((acc, cat) => {
        acc[cat.key] = (categoryTargets[cat.key] || 0) * 60;
        return acc;
      }, {}),
    [categoryTargets, categories],
  );

  const totalActual = Object.values(actualMinutes).reduce((a, b) => a + b, 0);
  const totalTarget = Object.values(targetMinutes).reduce((a, b) => a + b, 0);

  // Donut data – actual hours; fallback to target if nothing logged yet
  const donutData = useMemo(() => {
    const data = categories.map((cat) => ({
      name: cat.label,
      value: actualMinutes[cat.key] || 0,
      color: cat.color,
      key: cat.key,
    }));
    const hasAny = data.some((d) => d.value > 0);
    if (!hasAny) {
      return categories.map((cat) => ({
        name: cat.label,
        value: targetMinutes[cat.key] || 1,
        color: `${cat.color}55`,
        key: cat.key,
        phantom: true,
      }));
    }
    return data.filter((d) => d.value > 0);
  }, [actualMinutes, targetMinutes, categories]);

  // This week's goals
  const weekKey = getWeekKey();
  const weekGoals = useMemo(
    () => goals.filter((g) => g.weekKey === weekKey),
    [goals, weekKey],
  );
  const doneGoals = weekGoals.filter((g) => g.done).length;

  // Recent courses (top 3 by closest deadline or most recent)
  const recentCourses = useMemo(
    () => [...courses].slice(-3).reverse(),
    [courses],
  );
  const recentProjects = useMemo(
    () => [...projects].slice(-3).reverse(),
    [projects],
  );
  const recentPersonalProjects = useMemo(
    () => [...personalProjects].slice(-3).reverse(),
    [personalProjects],
  );

  const handleSaveTargets = () => {
    Object.entries(draftTargets).forEach(([k, v]) => {
      if (v !== "" && !isNaN(Number(v))) setCategoryTarget(k, Number(v));
    });
    setEditTargets(false);
    setDraftTargets({});
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-50">Dashboard</h1>
          <p className="text-surface-400 text-sm mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={() => {
            setEditTargets(true);
            setDraftTargets({ ...categoryTargets });
          }}
          className="btn-secondary flex items-center gap-2"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Targets
        </button>
      </div>

      {/* Edit Targets modal-like inline */}
      {editTargets && (
        <div className="card border-brand-purple/30 space-y-4">
          <h3 className="font-semibold text-surface-50 text-sm">
            Weekly Hour Targets
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {categories.map((cat) => (
              <div key={cat.key}>
                <label className="label" style={{ color: cat.color }}>
                  {cat.label}
                </label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={168}
                  value={draftTargets[cat.key] ?? categoryTargets[cat.key]}
                  onChange={(e) =>
                    setDraftTargets((d) => ({
                      ...d,
                      [cat.key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={handleSaveTargets} className="btn-primary">
              Save
            </button>
            <button
              onClick={() => setEditTargets(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {categories.map((cat) => {
          const actual = actualMinutes[cat.key];
          const pct = totalActual > 0 ? (actual / totalActual) * 100 : 0;
          return (
            <div key={cat.key} className="card space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-surface-300">
                  {cat.label}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: cat.color }}
                >
                  {(actual / 60).toFixed(1)}h
                </span>
              </div>
              <div className="relative h-1.5 rounded-full bg-surface-500 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: cat.color }}
                />
              </div>
              <p className="text-[11px] text-surface-400">
                Target: {categoryTargets[cat.key]}h/wk
              </p>
            </div>
          );
        })}
      </div>

      {/* Main row: donut + goals */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Donut Chart */}
        <div className="lg:col-span-3 card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-50">All-Time Activity</h2>
            <div className="flex flex-col items-end">
              <span className="text-xl font-bold text-surface-50">
                {(totalActual / 60).toFixed(1)}h
              </span>
              <span className="text-xs text-surface-400">
                · {(totalTarget / 60).toFixed(0)}h/wk target
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-52 h-52 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-3 w-full">
              {categories.map((cat) => {
                const actual = actualMinutes[cat.key];
                const pct = totalActual > 0 ? (actual / totalActual) * 100 : 0;
                return (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: cat.color }}
                        />
                        <span className="text-surface-200">{cat.label}</span>
                      </div>
                      <span className="text-surface-300 tabular-nums">
                        {(actual / 60).toFixed(1)}h · {categoryTargets[cat.key]}
                        h/wk
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-500 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: cat.color,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Weekly Goals */}
        <div className="lg:col-span-2 card flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-50">Weekly Goals</h2>
            <span className="text-xs text-surface-400">
              {doneGoals}/{weekGoals.length} done
            </span>
          </div>

          {weekGoals.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <CheckCircle2 className="w-8 h-8 text-surface-500 mb-2" />
              <p className="text-surface-400 text-sm">No goals set this week</p>
              <button
                onClick={() => onNavigate(VIEWS.GOALS)}
                className="mt-3 btn-primary text-xs py-1.5"
              >
                Add Goals
              </button>
            </div>
          ) : (
            <ul className="flex-1 space-y-2 overflow-y-auto">
              {weekGoals.map((g) => (
                <li key={g.id} className="flex items-start gap-2.5 group">
                  {g.done ? (
                    <CheckCircle2 className="w-4 h-4 text-brand-green flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-surface-400 flex-shrink-0 mt-0.5" />
                  )}
                  <span
                    className={`text-sm ${g.done ? "line-through text-surface-400" : "text-surface-100"}`}
                  >
                    {g.text}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {weekGoals.length > 0 && (
            <button
              onClick={() => onNavigate(VIEWS.GOALS)}
              className="mt-3 flex items-center gap-1.5 text-xs text-brand-purple hover:text-purple-400 transition-colors"
            >
              Manage goals <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom row: Recent Courses + Recent Projects + Recent Personal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Courses */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-50">Recent Courses</h2>
            <button
              onClick={() => onNavigate(VIEWS.COURSES)}
              className="flex items-center gap-1 text-xs text-brand-purple hover:text-purple-400 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentCourses.length === 0 ? (
            <p className="text-surface-400 text-sm text-center py-4">
              No courses yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentCourses.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-600 hover:bg-surface-500 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-purple/20">
                    <TrendingUp className="w-4 h-4 text-brand-purple" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-50 truncate">
                      {c.title}
                    </p>
                    <p className="text-xs text-surface-400">{c.platform}</p>
                  </div>
                  <span className="text-xs font-semibold text-brand-purple">
                    {c.completion}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-50">
              Passive Income Projects
            </h2>
            <button
              onClick={() => onNavigate(VIEWS.PASSIVE)}
              className="flex items-center gap-1 text-xs text-brand-teal hover:text-teal-400 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentProjects.length === 0 ? (
            <p className="text-surface-400 text-sm text-center py-4">
              No projects yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentProjects.map((p) => {
                const statusColors = {
                  idea: "text-surface-400 bg-surface-500",
                  active: "text-brand-teal bg-teal-500/10",
                  paused: "text-brand-amber bg-amber-500/10",
                  launched: "text-brand-green bg-green-500/10",
                };
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-600 hover:bg-surface-500 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-brand-teal/20">
                      <TrendingUp className="w-4 h-4 text-brand-teal" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-50 truncate">
                        {p.name}
                      </p>
                      <p className="text-xs text-surface-400">{p.type}</p>
                    </div>
                    <span
                      className={`badge text-[10px] ${statusColors[p.status] || statusColors.idea}`}
                    >
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Personal Projects */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-surface-50">Personal Projects</h2>
            <button
              onClick={() => onNavigate(VIEWS.PERSONAL)}
              className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition-colors"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {recentPersonalProjects.length === 0 ? (
            <p className="text-surface-400 text-sm text-center py-4">
              No personal projects yet.
            </p>
          ) : (
            <div className="space-y-3">
              {recentPersonalProjects.map((p) => {
                const statusColors = {
                  idea: "text-surface-400 bg-surface-500",
                  active: "text-pink-400 bg-pink-500/10",
                  paused: "text-brand-amber bg-amber-500/10",
                  completed: "text-brand-green bg-green-500/10",
                };
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-600 hover:bg-surface-500 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-pink-500/20">
                      <Briefcase className="w-4 h-4 text-pink-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-50 truncate">
                        {p.name}
                      </p>
                      {p.description && (
                        <p className="text-xs text-surface-400 truncate">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <span
                      className={`badge text-[10px] ${statusColors[p.status] || statusColors.idea}`}
                    >
                      {p.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick log button */}
      <div className="flex justify-center">
        <button
          onClick={() => onNavigate(VIEWS.LOG_SESSION)}
          className="btn-primary flex items-center gap-2 py-3 px-6 text-sm"
        >
          <Clock className="w-4 h-4" />
          Log a Session
        </button>
      </div>
    </div>
  );
}
