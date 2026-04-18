import {
  LayoutDashboard,
  BookOpen,
  Rocket,
  Briefcase,
  Timer,
  CheckSquare,
  Scale,
  Sparkles,
  ShieldCheck,
  Target,
  Plus,
  X,
  Flag,
  CalendarDays,
} from "lucide-react";
import { VIEWS } from "../constants";
import { useState } from "react";
import { useStore } from "../store/useStore";

const NAV_ITEMS = [
  { view: VIEWS.DASHBOARD, label: "Dashboard", icon: LayoutDashboard },
  { view: VIEWS.COURSES, label: "Courses", icon: BookOpen },
  { view: VIEWS.PASSIVE, label: "Passive Income", icon: Rocket },
  { view: VIEWS.PERSONAL, label: "Personal Projects", icon: Briefcase },
  { view: VIEWS.LOG_SESSION, label: "Log Session", icon: Timer },
  { view: VIEWS.GOALS, label: "Weekly Goals", icon: CheckSquare },
  { view: VIEWS.DECISIONS, label: "Decisions", icon: Scale },
  { view: VIEWS.LOCKED_IN, label: "Locked In", icon: ShieldCheck },
  { view: VIEWS.CALENDAR, label: "Calendar", icon: CalendarDays },
];

const AI_ITEM = { view: VIEWS.AI, label: "AI Assistant", icon: Sparkles };

export default function Sidebar({ currentView, onNavigate }) {
  const customViews = useStore((s) => s.customViews);
  const addCustomView = useStore((s) => s.addCustomView);
  const removeCustomView = useStore((s) => s.removeCustomView);

  const [newViewName, setNewViewName] = useState("");

  const handleAddView = () => {
    const created = addCustomView(newViewName);
    if (created) {
      setNewViewName("");
      onNavigate(created.key);
    }
  };

  return (
    <aside className="w-56 flex-shrink-0 bg-surface-800 border-r border-surface-600 flex flex-col">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-surface-600">
        <div className="w-7 h-7 rounded-lg bg-brand-purple flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-surface-50 tracking-tight text-base">
          FocusBoard
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs text-surface-400 font-medium uppercase tracking-widest px-3 mb-2">
          Navigate
        </p>

        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-brand-purple/20 text-brand-purple"
                  : "text-surface-100 hover:bg-surface-600 hover:text-surface-50"
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${active ? "text-brand-purple" : "text-surface-400"}`}
              />
              {label}
            </button>
          );
        })}

        {customViews.length > 0 && (
          <div className="pt-3 mt-3 border-t border-surface-600">
            <p className="text-[10px] text-surface-500 font-medium uppercase tracking-wider px-3 mb-2">
              Custom Views
            </p>
            <div className="space-y-0.5">
              {customViews.map((item) => {
                const active = currentView === item.key;
                return (
                  <div key={item.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => onNavigate(item.key)}
                      className={`flex-1 text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        active
                          ? "text-white"
                          : "text-surface-100 hover:bg-surface-600 hover:text-surface-50"
                      }`}
                      style={
                        active
                          ? { background: `${item.color}30`, color: item.color }
                          : undefined
                      }
                    >
                      <Flag
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: active ? item.color : "#94a3b8" }}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                    <button
                      onClick={() => {
                        if (currentView === item.key)
                          onNavigate(VIEWS.DASHBOARD);
                        removeCustomView(item.key);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
                      aria-label={`Remove ${item.label}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-3 mt-3 border-t border-surface-600 px-3 space-y-2">
          <p className="text-[10px] text-surface-500 font-medium uppercase tracking-wider">
            Add View
          </p>
          <input
            className="w-full h-9 rounded-lg bg-surface-700 border border-surface-600 px-2.5 text-xs text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
            placeholder="e.g. Tech Challenges"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddView();
            }}
          />
          <button
            onClick={handleAddView}
            disabled={!newViewName.trim()}
            className={`w-full h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              newViewName.trim()
                ? "bg-brand-purple/20 text-brand-purple hover:bg-brand-purple/30"
                : "bg-surface-700 text-surface-500 cursor-not-allowed"
            }`}
          >
            <Plus className="w-3 h-3" />
            Create View
          </button>
        </div>
      </nav>

      {/* AI Placeholder – bottom */}
      <div className="px-3 pb-4 border-t border-surface-600 pt-4">
        <button
          onClick={() => onNavigate(AI_ITEM.view)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentView === AI_ITEM.view
              ? "bg-brand-amber/10 text-brand-amber"
              : "text-surface-100 hover:bg-surface-600 hover:text-surface-50"
          }`}
        >
          <Sparkles
            className={`w-4 h-4 flex-shrink-0 ${
              currentView === AI_ITEM.view
                ? "text-brand-amber"
                : "text-surface-400"
            }`}
          />
          AI Assistant
          <span className="ml-auto text-[10px] bg-brand-amber/20 text-brand-amber font-semibold px-1.5 py-0.5 rounded">
            Soon
          </span>
        </button>
      </div>
    </aside>
  );
}
