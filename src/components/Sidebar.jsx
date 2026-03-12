import {
  LayoutDashboard,
  BookOpen,
  Rocket,
  Timer,
  CheckSquare,
  Sparkles,
  Target,
} from 'lucide-react'
import { VIEWS } from '../constants'

const NAV_ITEMS = [
  { view: VIEWS.DASHBOARD,   label: 'Dashboard',      icon: LayoutDashboard },
  { view: VIEWS.COURSES,     label: 'Courses',        icon: BookOpen },
  { view: VIEWS.PASSIVE,     label: 'Passive Income', icon: Rocket },
  { view: VIEWS.LOG_SESSION, label: 'Log Session',    icon: Timer },
  { view: VIEWS.GOALS,       label: 'Weekly Goals',   icon: CheckSquare },
]

const AI_ITEM = { view: VIEWS.AI, label: 'AI Assistant', icon: Sparkles }

export default function Sidebar({ currentView, onNavigate }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-surface-800 border-r border-surface-600 flex flex-col">
      {/* Logo / Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-surface-600">
        <div className="w-7 h-7 rounded-lg bg-brand-purple flex items-center justify-center flex-shrink-0">
          <Target className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-surface-50 tracking-tight text-base">FocusBoard</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-xs text-surface-400 font-medium uppercase tracking-widest px-3 mb-2">
          Navigate
        </p>

        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const active = currentView === view
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-brand-purple/20 text-brand-purple'
                  : 'text-surface-100 hover:bg-surface-600 hover:text-surface-50'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-brand-purple' : 'text-surface-400'}`} />
              {label}
            </button>
          )
        })}
      </nav>

      {/* AI Placeholder – bottom */}
      <div className="px-3 pb-4 border-t border-surface-600 pt-4">
        <button
          onClick={() => onNavigate(AI_ITEM.view)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
            currentView === AI_ITEM.view
              ? 'bg-brand-amber/10 text-brand-amber'
              : 'text-surface-100 hover:bg-surface-600 hover:text-surface-50'
          }`}
        >
          <Sparkles
            className={`w-4 h-4 flex-shrink-0 ${
              currentView === AI_ITEM.view ? 'text-brand-amber' : 'text-surface-400'
            }`}
          />
          AI Assistant
          <span className="ml-auto text-[10px] bg-brand-amber/20 text-brand-amber font-semibold px-1.5 py-0.5 rounded">
            Soon
          </span>
        </button>
      </div>
    </aside>
  )
}
