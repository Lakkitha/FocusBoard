import { useEffect, useState } from 'react'
import { useStore } from './store/useStore'
import { VIEWS } from './constants'
import Sidebar from './components/Sidebar'
import Dashboard from './views/Dashboard'
import Courses from './views/Courses'
import PassiveIncome from './views/PassiveIncome'
import LogSession from './views/LogSession'
import Goals from './views/Goals'
import AIChat from './views/AIChat'

export default function App() {
  const init = useStore((s) => s.init)
  const initialized = useStore((s) => s.initialized)
  const [view, setView] = useState(VIEWS.DASHBOARD)

  useEffect(() => { init() }, [init])

  if (!initialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-surface-100 text-sm">Loading FocusBoard…</span>
        </div>
      </div>
    )
  }

  const renderView = () => {
    switch (view) {
      case VIEWS.DASHBOARD:   return <Dashboard onNavigate={setView} />
      case VIEWS.COURSES:     return <Courses />
      case VIEWS.PASSIVE:     return <PassiveIncome />
      case VIEWS.LOG_SESSION: return <LogSession />
      case VIEWS.GOALS:       return <Goals />
      case VIEWS.AI:          return <AIChat />
      default:                return <Dashboard onNavigate={setView} />
    }
  }

  return (
    <div className="flex h-screen bg-surface-900 overflow-hidden">
      <Sidebar currentView={view} onNavigate={setView} />
      <main className="flex-1 overflow-y-auto">
        {renderView()}
      </main>
    </div>
  )
}
