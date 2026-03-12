import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { Timer, Plus, Trash2, Clock, CalendarDays } from 'lucide-react'
import PlatformLogo from '../components/PlatformLogo'

const SESSION_TYPES = [
  { value: 'course',  label: 'Course / Certification', color: '#7c6af7' },
  { value: 'project', label: 'Passive Income Project',  color: '#2dd4bf' },
  { value: 'work',    label: 'Job / Main Work',         color: '#4fa5ff' },
  { value: 'health',  label: 'Health & Fitness',        color: '#4ade80' },
]

function formatDuration(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

export default function LogSession() {
  const sessions     = useStore((s) => s.sessions)
  const courses      = useStore((s) => s.courses)
  const projects     = useStore((s) => s.projects)
  const addSession   = useStore((s) => s.addSession)
  const deleteSession = useStore((s) => s.deleteSession)

  const today = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    type:    'course',
    refId:   '',
    date:    today,
    minutes: 30,
    note:    '',
    category: '',
  })
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const refOptions = useMemo(() => {
    if (form.type === 'course')   return courses.map((c) => ({ id: c.id, label: c.title || 'Untitled' }))
    if (form.type === 'project')  return projects.map((p) => ({ id: p.id, label: p.name || 'Unnamed' }))
    return []
  }, [form.type, courses, projects])

  const handleTypeChange = (type) => {
    set('type', type)
    set('refId', '')
  }

  const handleSubmit = () => {
    if (form.minutes <= 0) return
    if ((form.type === 'course' || form.type === 'project') && !form.refId) return

    addSession({
      type:     form.type,
      refId:    form.refId,
      date:     form.date,
      minutes:  Number(form.minutes),
      note:     form.note,
      category: form.type === 'work'   ? 'work'
               : form.type === 'health' ? 'health'
               : form.type === 'course' ? 'courses'
               : 'passive',
    })

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setForm({ ...form, refId: '', minutes: 30, note: '' })
  }

  // Recent sessions (last 20)
  const recent = useMemo(() =>
    [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 20),
    [sessions]
  )

  const getRefLabel = (s) => {
    if (s.type === 'course') {
      const c = courses.find((c) => c.id === s.refId)
      return c ? c.title : '—'
    }
    if (s.type === 'project') {
      const p = projects.find((p) => p.id === s.refId)
      return p ? p.name : '—'
    }
    return s.type === 'work' ? 'Main Work' : 'Health & Fitness'
  }

  const typeColor = (type) => SESSION_TYPES.find((t) => t.value === type)?.color || '#7c6af7'

  const needsRef = form.type === 'course' || form.type === 'project'

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Timer className="w-5 h-5 text-brand-blue" />
        <h1 className="text-2xl font-bold text-surface-50">Log a Session</h1>
      </div>

      {/* Log Form */}
      <div className="card space-y-5">
        {/* Type */}
        <div>
          <label className="label">Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SESSION_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTypeChange(t.value)}
                className={`px-3 py-2.5 rounded-lg text-xs font-medium text-center transition-all border ${
                  form.type === t.value
                    ? 'border-transparent text-white'
                    : 'border-surface-500 text-surface-300 bg-surface-600 hover:bg-surface-500'
                }`}
                style={form.type === t.value ? { background: `${t.color}25`, borderColor: t.color, color: t.color } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ref selector (course or project) */}
        {needsRef && (
          <div>
            <label className="label">
              {form.type === 'course' ? 'Course / Certification' : 'Project'}
            </label>
            {refOptions.length === 0 ? (
              <p className="text-xs text-surface-400">
                No {form.type === 'course' ? 'courses' : 'projects'} added yet.
              </p>
            ) : (
              <select className="input" value={form.refId} onChange={(e) => set('refId', e.target.value)}>
                <option value="">— select —</option>
                {refOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Date + Duration */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={(e) => set('date', e.target.value)} />
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input type="number" className="input" min={1} max={720} value={form.minutes}
              onChange={(e) => set('minutes', e.target.value)} />
          </div>
        </div>

        {/* Quick duration buttons */}
        <div className="flex gap-2 flex-wrap">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <button
              key={m}
              onClick={() => set('minutes', m)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                Number(form.minutes) === m
                  ? 'bg-brand-purple text-white'
                  : 'bg-surface-600 text-surface-300 hover:bg-surface-500'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>

        {/* Note */}
        <div>
          <label className="label">Note (optional)</label>
          <input className="input" placeholder="What did you work on?"
            value={form.note} onChange={(e) => set('note', e.target.value)} />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={needsRef && !form.refId}
          className={`btn-primary w-full py-3 flex items-center justify-center gap-2 transition-all ${
            saved ? 'bg-brand-green' : ''
          } ${needsRef && !form.refId ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Plus className="w-4 h-4" />
          {saved ? '✓ Session Logged!' : `Log ${Number(form.minutes) > 0 ? formatDuration(Number(form.minutes)) : ''} Session`}
        </button>
      </div>

      {/* Recent Sessions */}
      <div>
        <h2 className="section-title flex items-center gap-2">
          <Clock className="w-4 h-4 text-surface-400" />
          Recent Sessions
        </h2>

        {recent.length === 0 ? (
          <div className="card text-center py-8">
            <Timer className="w-8 h-8 text-surface-500 mx-auto mb-2" />
            <p className="text-surface-400 text-sm">No sessions logged yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <div key={s.id} className="card flex items-center gap-3 py-3 group hover:border-surface-400 transition-all">
                {/* Color dot */}
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: typeColor(s.type) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-50 font-medium truncate">{getRefLabel(s)}</p>
                  <p className="text-xs text-surface-400 flex items-center gap-1.5 mt-0.5">
                    <CalendarDays className="w-3 h-3" />
                    {s.date}
                    <span className="text-surface-500">·</span>
                    {formatDuration(s.minutes)}
                    {s.note && (
                      <>
                        <span className="text-surface-500">·</span>
                        <span className="truncate max-w-[160px]">{s.note}</span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => deleteSession(s.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
