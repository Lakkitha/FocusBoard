import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { getSessionCategoryKey } from "../viewConfig";
import { Clock, Flag } from "lucide-react";
import { VIEWS } from "../constants";

function formatHours(minutes) {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default function CustomView({ viewKey, onNavigate }) {
  const customViews = useStore((s) => s.customViews);
  const sessions = useStore((s) => s.sessions);
  const categoryTargets = useStore((s) => s.categoryTargets);
  const setCategoryTarget = useStore((s) => s.setCategoryTarget);

  const current = customViews.find((v) => v.key === viewKey);

  const totalMinutes = useMemo(
    () =>
      sessions
        .filter((session) => getSessionCategoryKey(session) === viewKey)
        .reduce((sum, session) => sum + (Number(session.minutes) || 0), 0),
    [sessions, viewKey],
  );

  const recent = useMemo(
    () =>
      [...sessions]
        .filter((session) => getSessionCategoryKey(session) === viewKey)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 15),
    [sessions, viewKey],
  );

  if (!current) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="card text-center py-10 space-y-3">
          <p className="text-surface-200">This custom view no longer exists.</p>
          <button
            className="btn-primary"
            onClick={() => onNavigate(VIEWS.DASHBOARD)}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const targetHours = Number(categoryTargets[viewKey] || 0);
  const targetMinutes = targetHours * 60;
  const progress =
    targetMinutes > 0 ? Math.min(100, (totalMinutes / targetMinutes) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${current.color}25` }}
        >
          <Flag className="w-4 h-4" style={{ color: current.color }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-50">
            {current.label}
          </h1>
          <p className="text-surface-400 text-sm">
            Track time and target progress for this custom view.
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-surface-300">
            Weekly target (hours)
          </span>
          <input
            type="number"
            className="input w-28"
            min={0}
            max={168}
            value={targetHours}
            onChange={(e) =>
              setCategoryTarget(viewKey, Number(e.target.value) || 0)
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-surface-300 mb-1.5">
            <span>All-time logged</span>
            <span className="font-semibold" style={{ color: current.color }}>
              {formatHours(totalMinutes)} / {targetHours}h
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-600 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: current.color,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>

        <button
          className="btn-secondary text-sm"
          onClick={() => onNavigate(VIEWS.LOG_SESSION)}
        >
          Log Time to This View
        </button>
      </div>

      <div className="card">
        <h2 className="font-semibold text-surface-50 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-surface-400" />
          Recent Sessions
        </h2>

        {recent.length === 0 ? (
          <p className="text-sm text-surface-400">
            No sessions yet for this view.
          </p>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <div
                key={s.id}
                className="bg-surface-700 border border-surface-600 rounded-lg px-3 py-2"
              >
                <div className="text-sm text-surface-100">
                  {(Number(s.minutes) || 0) > 0
                    ? formatHours(Number(s.minutes))
                    : "0.0h"}
                </div>
                <div className="text-xs text-surface-400 mt-0.5">
                  {s.date}
                  {s.note ? ` · ${s.note}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
