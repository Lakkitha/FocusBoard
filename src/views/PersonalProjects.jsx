import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import Modal from "../components/Modal";
import {
  Plus, Pencil, Trash2, Briefcase, Clock,
  CheckCircle2, Circle, ChevronDown, ChevronUp,
} from "lucide-react";

const STATUSES = ["idea", "active", "paused", "completed"];

const STATUS_STYLES = {
  idea:      { badge: "bg-surface-500 text-surface-300",  dot: "#6b7280" },
  active:    { badge: "bg-pink-500/10 text-pink-400",     dot: "#f472b6" },
  paused:    { badge: "bg-amber-500/10 text-brand-amber", dot: "#fbbf24" },
  completed: { badge: "bg-green-500/10 text-brand-green", dot: "#4ade80" },
};

const BLANK_PROJECT = {
  name: "",
  description: "",
  status: "idea",
  targetHoursPerWeek: 5,
};

function ProjectForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...BLANK_PROJECT, ...initial });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Project Name</label>
        <input
          className="input"
          placeholder="e.g. Build portfolio site"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select
            className="input"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Target hrs/week</label>
          <input
            type="number"
            className="input"
            min={0}
            max={60}
            value={form.targetHoursPerWeek}
            onChange={(e) => set("targetHoursPerWeek", Number(e.target.value))}
          />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          className="input min-h-[80px] resize-none"
          placeholder="What is this project about?"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => { if (!form.name.trim()) return; onSave(form); }}
          className="btn-primary flex-1"
        >
          Save
        </button>
        <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
      </div>
    </div>
  );
}

function MilestoneSection({ project }) {
  const addPersonalMilestone    = useStore((s) => s.addPersonalMilestone);
  const togglePersonalMilestone = useStore((s) => s.togglePersonalMilestone);
  const deletePersonalMilestone = useStore((s) => s.deletePersonalMilestone);
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const text = input.trim();
    if (!text) return;
    addPersonalMilestone(project.id, text);
    setInput("");
  };

  const milestones = project.milestones || [];
  const done = milestones.filter((m) => m.done).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-surface-400">
        <span className="font-medium text-surface-300">Tasks</span>
        <span>{done}/{milestones.length} done</span>
      </div>

      {milestones.length > 0 && (
        <div className="h-1 rounded-full bg-surface-500 overflow-hidden">
          <div
            className="h-full rounded-full bg-pink-400 transition-all duration-500"
            style={{ width: `${(done / milestones.length) * 100}%` }}
          />
        </div>
      )}

      <ul className="space-y-1.5 mt-2">
        {milestones.map((m) => (
          <li key={m.id} className="flex items-center gap-2 group/item">
            <button onClick={() => togglePersonalMilestone(project.id, m.id)} className="flex-shrink-0">
              {m.done
                ? <CheckCircle2 className="w-4 h-4 text-pink-400" />
                : <Circle className="w-4 h-4 text-surface-400 hover:text-surface-200" />
              }
            </button>
            <span className={`flex-1 text-xs ${m.done ? "line-through text-surface-400" : "text-surface-200"}`}>
              {m.text}
            </span>
            <button
              onClick={() => deletePersonalMilestone(project.id, m.id)}
              className="opacity-0 group-hover/item:opacity-100 text-surface-500 hover:text-red-400 transition-all"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          className="input text-xs py-1.5"
          placeholder="Add task…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd} className="btn-secondary px-3 py-1.5 text-xs flex-shrink-0">
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProjectCard({ project, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const sessions = useStore((s) => s.sessions);

  const loggedMins = sessions
    .filter((s) => s.type === "personal" && s.refId === project.id)
    .reduce((acc, s) => acc + s.minutes, 0);

  const s = STATUS_STYLES[project.status] || STATUS_STYLES.idea;
  const milestones = project.milestones || [];
  const milestoneDone = milestones.filter((m) => m.done).length;

  return (
    <div className="card group flex flex-col gap-3 hover:border-pink-500/30 transition-all">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-pink-500/15">
          <Briefcase className="w-4 h-4 text-pink-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-surface-50 text-sm leading-tight truncate">
            {project.name || "Unnamed Project"}
          </h3>
          <span className={`badge mt-1 text-[10px] ${s.badge}`}>{project.status}</span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-surface-400">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {(loggedMins / 60).toFixed(1)}h logged
        </span>
        <span className="flex items-center gap-3">
          {milestones.length > 0 && <span>{milestoneDone}/{milestones.length} tasks</span>}
          <span>{project.targetHoursPerWeek}h/wk</span>
        </span>
      </div>

      {milestones.length > 0 && (
        <div className="h-1 rounded-full bg-surface-500 overflow-hidden">
          <div
            className="h-full rounded-full bg-pink-400 transition-all duration-500"
            style={{ width: `${(milestoneDone / milestones.length) * 100}%` }}
          />
        </div>
      )}

      {project.description && (
        <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
          {project.description}
        </p>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expanded ? "Hide" : "Show"} tasks
      </button>

      {expanded && <MilestoneSection project={project} />}

      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(project)}
          className="btn-ghost flex items-center gap-1.5 flex-1 justify-center py-1.5"
        >
          <Pencil className="w-3.5 h-3.5" /> Edit
        </button>
        <button
          onClick={() => onDelete(project.id)}
          className="btn-danger flex items-center gap-1.5 flex-1 justify-center py-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    </div>
  );
}

export default function PersonalProjects() {
  const personalProjects      = useStore((s) => s.personalProjects);
  const addPersonalProject    = useStore((s) => s.addPersonalProject);
  const updatePersonalProject = useStore((s) => s.updatePersonalProject);
  const deletePersonalProject = useStore((s) => s.deletePersonalProject);

  const [showAdd,      setShowAdd]      = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    if (statusFilter === "All") return personalProjects;
    return personalProjects.filter((p) => p.status === statusFilter);
  }, [personalProjects, statusFilter]);

  const handleAdd    = (form) => { addPersonalProject(form);                setShowAdd(false); };
  const handleEdit   = (form) => { updatePersonalProject(editing.id, form); setEditing(null);  };
  const handleDelete = (id)   => { if (confirm("Delete this project?")) deletePersonalProject(id); };

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-pink-400" />
          <h1 className="text-2xl font-bold text-surface-50">Personal Projects</h1>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Project
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? "bg-pink-500/20 text-pink-400"
                : "bg-surface-600 text-surface-300 hover:bg-surface-500"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((s) => {
          const count = personalProjects.filter((p) => p.status === s).length;
          const style = STATUS_STYLES[s];
          return (
            <div key={s} className="card text-center">
              <p className="text-xl font-bold text-surface-50">{count}</p>
              <span className={`badge mt-1 ${style.badge} text-[10px]`}>{s}</span>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase className="w-10 h-10 text-surface-500 mx-auto mb-3" />
          <p className="text-surface-300 font-medium">No personal projects yet</p>
          <p className="text-surface-400 text-sm mt-1">
            Add your first personal project to start tracking time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={(proj) => setEditing(proj)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <Modal title="Add Personal Project" onClose={() => setShowAdd(false)}>
          <ProjectForm initial={BLANK_PROJECT} onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Personal Project" onClose={() => setEditing(null)}>
          <ProjectForm initial={editing} onSave={handleEdit} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}
