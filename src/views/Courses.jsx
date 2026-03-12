import { useState, useMemo } from 'react'
import { useStore } from '../store/useStore'
import PlatformLogo, { PLATFORMS } from '../components/PlatformLogo'
import ProgressBar from '../components/ProgressBar'
import Modal from '../components/Modal'
import { Plus, Pencil, Trash2, CalendarDays, BookOpen, Clock } from 'lucide-react'

const BLANK = {
  title: '',
  platform: 'Coursera',
  completion: 0,
  deadline: '',
  notes: '',
  targetHoursPerWeek: 2,
}

function daysRemaining(deadline) {
  if (!deadline) return null
  const diff = new Date(deadline) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function DeadlineBadge({ deadline }) {
  const days = daysRemaining(deadline)
  if (days === null) return null
  let cls = 'text-surface-400'
  if (days < 0)  cls = 'text-red-400'
  else if (days <= 7)  cls = 'text-brand-amber'
  else if (days <= 30) cls = 'text-brand-blue'
  else cls = 'text-brand-green'

  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${cls}`}>
      <CalendarDays className="w-3 h-3" />
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </span>
  )
}

function CourseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...BLANK, ...initial })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Course / Certification Title</label>
        <input className="input" placeholder="e.g. AWS Solutions Architect" value={form.title}
          onChange={(e) => set('title', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Platform</label>
          <select className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Target hrs/week</label>
          <input type="number" className="input" min={0} max={40} value={form.targetHoursPerWeek}
            onChange={(e) => set('targetHoursPerWeek', Number(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="label">% Completion — {form.completion}%</label>
        <input type="range" min={0} max={100} value={form.completion}
          onChange={(e) => set('completion', Number(e.target.value))} />
      </div>

      <div>
        <label className="label">Deadline</label>
        <input type="date" className="input" value={form.deadline}
          onChange={(e) => set('deadline', e.target.value)} />
      </div>

      <div>
        <label className="label">Notes / Next Steps</label>
        <textarea className="input min-h-[80px] resize-none" placeholder="Write anything useful…"
          value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} className="btn-primary flex-1">Save</button>
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
      </div>
    </div>
  )
}

export default function Courses() {
  const courses      = useStore((s) => s.courses)
  const addCourse    = useStore((s) => s.addCourse)
  const updateCourse = useStore((s) => s.updateCourse)
  const deleteCourse = useStore((s) => s.deleteCourse)
  const sessions     = useStore((s) => s.sessions)

  const [showAdd,  setShowAdd]  = useState(false)
  const [editing,  setEditing]  = useState(null) // course id
  const [search,   setSearch]   = useState('')
  const [platform, setPlatform] = useState('All')

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch   = !search   || c.title.toLowerCase().includes(search.toLowerCase())
      const matchPlatform = platform === 'All' || c.platform === platform
      return matchSearch && matchPlatform
    })
  }, [courses, search, platform])

  const totalLoggedMinutes = (courseId) =>
    sessions.filter((s) => s.type === 'course' && s.refId === courseId)
            .reduce((acc, s) => acc + s.minutes, 0)

  const handleAdd = (form) => {
    if (!form.title.trim()) return
    addCourse(form)
    setShowAdd(false)
  }

  const handleEdit = (form) => {
    updateCourse(editing, form)
    setEditing(null)
  }

  const editingCourse = courses.find((c) => c.id === editing)

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-brand-purple" />
          <h1 className="text-2xl font-bold text-surface-50">Courses & Certifications</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Course
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          className="input max-w-xs"
          placeholder="Search courses…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input max-w-[180px]" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="All">All Platforms</option>
          {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-purple">{courses.length}</p>
          <p className="text-xs text-surface-400 mt-0.5">Total Courses</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-green">
            {courses.filter((c) => c.completion === 100).length}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">Completed</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-blue">
            {courses.length > 0
              ? Math.round(courses.reduce((a, c) => a + c.completion, 0) / courses.length)
              : 0}%
          </p>
          <p className="text-xs text-surface-400 mt-0.5">Avg Progress</p>
        </div>
      </div>

      {/* Course Cards */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <BookOpen className="w-10 h-10 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">No courses found</p>
          <p className="text-surface-400 text-sm mt-1">
            {courses.length === 0 ? 'Add your first course to get started.' : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((course) => {
            const loggedMins      = totalLoggedMinutes(course.id)
            const targetMins      = course.targetHoursPerWeek * 60
            const progressPct     = course.completion
            const isComplete      = progressPct === 100

            return (
              <div
                key={course.id}
                className={`card flex flex-col gap-3 relative group transition-all hover:border-surface-400 ${
                  isComplete ? 'border-brand-green/30' : ''
                }`}
              >
                {/* Card Header */}
                <div className="flex items-start gap-3">
                  <PlatformLogo platform={course.platform} size={36} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-50 text-sm leading-tight truncate">
                      {course.title || 'Untitled Course'}
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">{course.platform}</p>
                  </div>
                  {isComplete && (
                    <span className="badge bg-brand-green/10 text-brand-green text-[10px]">Done</span>
                  )}
                </div>

                {/* Progress */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-300">Progress</span>
                    <span className="font-semibold text-brand-purple">{progressPct}%</span>
                  </div>
                  <ProgressBar value={progressPct} max={100} color="#7c6af7" height={5} />
                </div>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-surface-400">
                  <DeadlineBadge deadline={course.deadline} />
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {(loggedMins / 60).toFixed(1)}h logged
                  </span>
                </div>

                {/* Target */}
                <div className="text-[11px] text-surface-400 flex items-center justify-between">
                  <span>Target: {course.targetHoursPerWeek}h/wk</span>
                  {course.notes && (
                    <span className="text-surface-500 truncate max-w-[120px]" title={course.notes}>
                      📝 {course.notes.slice(0, 30)}{course.notes.length > 30 ? '…' : ''}
                    </span>
                  )}
                </div>

                {/* Actions (show on hover) */}
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditing(course.id)}
                    className="btn-ghost flex items-center gap-1.5 flex-1 justify-center py-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this course?')) deleteCourse(course.id) }}
                    className="btn-danger flex items-center gap-1.5 flex-1 justify-center py-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Add Course / Certification" onClose={() => setShowAdd(false)}>
          <CourseForm initial={BLANK} onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {/* Edit Modal */}
      {editingCourse && (
        <Modal title="Edit Course" onClose={() => setEditing(null)}>
          <CourseForm initial={editingCourse} onSave={handleEdit} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  )
}
