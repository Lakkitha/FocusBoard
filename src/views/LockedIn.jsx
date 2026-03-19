import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { ShieldCheck, Sunrise, Sun, Moon, Trash2 } from "lucide-react";
import { useStore, getLockedInScore } from "../store/useStore";

const PERIODS = [
  { key: "morning", label: "Morning", icon: Sunrise },
  { key: "noon", label: "Noon", icon: Sun },
  { key: "night", label: "Night", icon: Moon },
];

const EMPTY_DAY = { morning: false, noon: false, night: false };

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getBarColor(score) {
  if (score >= 1) return "#4ade80";
  if (score >= 2 / 3) return "#2dd4bf";
  if (score > 0) return "#fbbf24";
  return "#64748b";
}

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0].payload;
  return (
    <div className="bg-surface-600 border border-surface-400 rounded-lg px-3 py-2 shadow-xl text-xs">
      <p className="text-surface-100 font-medium">{label}</p>
      <p className="text-surface-50 font-semibold mt-0.5">
        {row.score.toFixed(2)} day{row.score === 1 ? "" : "s"}
      </p>
      <p className="text-surface-300 mt-0.5">
        {row.completed}/3 periods locked in
      </p>
    </div>
  );
}

export default function LockedIn() {
  const lockedInByDate = useStore((s) => s.lockedInByDate);
  const setLockedInPeriod = useStore((s) => s.setLockedInPeriod);
  const deleteLockedInDay = useStore((s) => s.deleteLockedInDay);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const dayEntry = lockedInByDate[selectedDate] || EMPTY_DAY;
  const dayScore = getLockedInScore(dayEntry);
  const hasSelectedRecord = Boolean(lockedInByDate[selectedDate]);

  const historyData = useMemo(() => {
    return Object.entries(lockedInByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, day]) => {
        const completed =
          Number(day.morning) + Number(day.noon) + Number(day.night);
        return {
          dateKey,
          label: formatDateLabel(dateKey),
          completed,
          score: getLockedInScore(day),
        };
      });
  }, [lockedInByDate]);

  const summary = useMemo(() => {
    const totalLockedInDays = historyData.reduce(
      (acc, row) => acc + row.score,
      0,
    );
    const fullyLocked = historyData.filter((row) => row.score === 1).length;
    const partialDays = historyData.filter(
      (row) => row.score > 0 && row.score < 1,
    ).length;
    const periodsCompleted = historyData.reduce(
      (acc, row) => acc + row.completed,
      0,
    );

    return {
      totalLockedInDays,
      fullyLocked,
      partialDays,
      periodsCompleted,
    };
  }, [historyData]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-brand-green" />
        <h1 className="text-2xl font-bold text-surface-50">Locked In</h1>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:justify-between">
          <div>
            <label className="label">Select Date</label>
            <input
              type="date"
              className="input"
              value={selectedDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="text-left sm:text-right">
            <p className="text-xs text-surface-300 font-medium">Daily Score</p>
            <p className="text-2xl font-bold text-surface-50">
              {dayScore.toFixed(2)} days
            </p>
            <p className="text-xs text-surface-400 mt-0.5">
              {Math.round(dayScore * 3)}/3 periods completed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PERIODS.map(({ key, label, icon: Icon }) => {
            const active = Boolean(dayEntry[key]);
            return (
              <button
                key={key}
                onClick={() => setLockedInPeriod(selectedDate, key)}
                className={`card p-3 flex items-center justify-between transition-all ${
                  active
                    ? "border-brand-green/40 bg-brand-green/10"
                    : "hover:border-surface-400"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-brand-green" : "text-surface-400"
                    }`}
                  />
                  <span className="text-sm font-medium text-surface-100">
                    {label}
                  </span>
                </div>
                <span
                  className={`w-4 h-4 rounded border transition-colors ${
                    active
                      ? "bg-brand-green border-brand-green"
                      : "border-surface-400 bg-surface-600"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => {
              if (confirm(`Delete Locked In record for ${selectedDate}?`)) {
                deleteLockedInDay(selectedDate);
              }
            }}
            disabled={!hasSelectedRecord}
            className={`btn-danger flex items-center gap-2 ${
              !hasSelectedRecord ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Day Record
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card">
          <p className="text-xs text-surface-300">Days Locked In</p>
          <p className="text-2xl font-bold text-surface-50 mt-1">
            {summary.totalLockedInDays.toFixed(2)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-300">Fully Locked Days</p>
          <p className="text-2xl font-bold text-brand-green mt-1">
            {summary.fullyLocked}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-300">Partial Days</p>
          <p className="text-2xl font-bold text-brand-amber mt-1">
            {summary.partialDays}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-300">Periods Completed</p>
          <p className="text-2xl font-bold text-surface-50 mt-1">
            {summary.periodsCompleted}
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-surface-50">Locked In History</h2>
          <span className="text-xs text-surface-400">
            Per day score (0.00 to 1.00)
          </span>
        </div>

        {historyData.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-surface-300 font-medium">
              No Locked In days yet
            </p>
            <p className="text-surface-400 text-sm mt-1">
              Start by checking Morning, Noon, or Night for a date.
            </p>
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={historyData}
                margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#3a3a48"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#a3a3b3", fontSize: 11 }}
                  axisLine={{ stroke: "#4a4a58" }}
                  tickLine={{ stroke: "#4a4a58" }}
                />
                <YAxis
                  domain={[0, 1]}
                  ticks={[0, 1 / 3, 2 / 3, 1]}
                  tick={{ fill: "#a3a3b3", fontSize: 11 }}
                  axisLine={{ stroke: "#4a4a58" }}
                  tickLine={{ stroke: "#4a4a58" }}
                />
                <Tooltip
                  content={<HistoryTooltip />}
                  cursor={{ fill: "#ffffff10" }}
                />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {historyData.map((row) => (
                    <Cell key={row.dateKey} fill={getBarColor(row.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
