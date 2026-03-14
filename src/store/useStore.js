import { create } from "zustand";

// ─── Seed/default data ────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  // Courses & Certifications
  courses: [],

  // Passive Income Projects
  projects: [],

  // Personal Projects
  personalProjects: [],

  // Time sessions  [{ id, type:'course'|'project'|'personal', refId, date, minutes, note }]
  sessions: [],

  // Weekly Goals  [{ id, weekKey, text, done }]
  goals: [],

  // Category targets (hours/week)
  categoryTargets: {
    courses: 10,
    passive: 8,
    work: 40,
    health: 5,
    personal: 5,
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
  return d.toISOString().slice(0, 10);
}

// ─── Persistence ─────────────────────────────────────────────────────────────
async function loadFromStorage() {
  try {
    if (window.electronAPI) {
      const data = await window.electronAPI.readStore();
      return data || DEFAULT_STATE;
    }
    const raw = localStorage.getItem("focusboard-data");
    return raw ? JSON.parse(raw) : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

async function saveToStorage(state) {
  const payload = {
    courses: state.courses,
    projects: state.projects,
    personalProjects: state.personalProjects,
    sessions: state.sessions,
    goals: state.goals,
    categoryTargets: state.categoryTargets,
  };
  try {
    if (window.electronAPI) {
      await window.electronAPI.writeStore(payload);
    } else {
      localStorage.setItem("focusboard-data", JSON.stringify(payload));
    }
  } catch (e) {
    console.error("Save failed:", e);
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useStore = create((set, get) => ({
  ...DEFAULT_STATE,
  initialized: false,

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  init: async () => {
    const data = await loadFromStorage();
    set({ ...DEFAULT_STATE, ...data, initialized: true });
  },

  persist: () => saveToStorage(get()),

  // ── Category targets ───────────────────────────────────────────────────────
  setCategoryTarget: (category, hours) => {
    set((s) => ({
      categoryTargets: { ...s.categoryTargets, [category]: hours },
    }));
    get().persist();
  },

  // ── Courses ────────────────────────────────────────────────────────────────
  addCourse: (course) => {
    const newCourse = {
      id: uid(),
      title: "",
      platform: "Coursera",
      completion: 0,
      deadline: "",
      notes: "",
      targetHoursPerWeek: 2,
      createdAt: new Date().toISOString(),
      ...course,
    };
    set((s) => ({ courses: [...s.courses, newCourse] }));
    get().persist();
    return newCourse;
  },

  updateCourse: (id, updates) => {
    set((s) => ({
      courses: s.courses.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
    get().persist();
  },

  deleteCourse: (id) => {
    set((s) => ({
      courses: s.courses.filter((c) => c.id !== id),
      sessions: s.sessions.filter(
        (s2) => !(s2.type === "course" && s2.refId === id),
      ),
    }));
    get().persist();
  },

  // ── Projects ───────────────────────────────────────────────────────────────
  addProject: (project) => {
    const newProject = {
      id: uid(),
      name: "",
      type: "content",
      status: "idea",
      targetHoursPerWeek: 5,
      notes: "",
      milestones: [],
      createdAt: new Date().toISOString(),
      ...project,
    };
    set((s) => ({ projects: [...s.projects, newProject] }));
    get().persist();
    return newProject;
  },

  updateProject: (id, updates) => {
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
    get().persist();
  },

  deleteProject: (id) => {
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      sessions: s.sessions.filter(
        (s2) => !(s2.type === "project" && s2.refId === id),
      ),
    }));
    get().persist();
  },

  addMilestone: (projectId, text) => {
    const milestone = { id: uid(), text, done: false };
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, milestones: [...(p.milestones || []), milestone] }
          : p,
      ),
    }));
    get().persist();
  },

  toggleMilestone: (projectId, milestoneId) => {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              milestones: p.milestones.map((m) =>
                m.id === milestoneId ? { ...m, done: !m.done } : m,
              ),
            }
          : p,
      ),
    }));
    get().persist();
  },

  deleteMilestone: (projectId, milestoneId) => {
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              milestones: p.milestones.filter((m) => m.id !== milestoneId),
            }
          : p,
      ),
    }));
    get().persist();
  },

  // ── Personal Projects ──────────────────────────────────────────────────────
  addPersonalProject: (project) => {
    const newProject = {
      id: uid(),
      name: "",
      description: "",
      status: "idea",
      targetHoursPerWeek: 5,
      createdAt: new Date().toISOString(),
      ...project,
    };
    set((s) => ({ personalProjects: [...s.personalProjects, newProject] }));
    get().persist();
    return newProject;
  },

  updatePersonalProject: (id, updates) => {
    set((s) => ({
      personalProjects: s.personalProjects.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    }));
    get().persist();
  },

  deletePersonalProject: (id) => {
    set((s) => ({
      personalProjects: s.personalProjects.filter((p) => p.id !== id),
      sessions: s.sessions.filter(
        (s2) => !(s2.type === "personal" && s2.refId === id),
      ),
    }));
    get().persist();
  },

  // ── Sessions ───────────────────────────────────────────────────────────────
  addSession: (session) => {
    const newSession = {
      id: uid(),
      type: "course",
      refId: "",
      date: new Date().toISOString().slice(0, 10),
      minutes: 0,
      note: "",
      ...session,
    };
    set((s) => ({ sessions: [...s.sessions, newSession] }));
    get().persist();
    return newSession;
  },

  deleteSession: (id) => {
    set((s) => ({ sessions: s.sessions.filter((s2) => s2.id !== id) }));
    get().persist();
  },

  // ── Goals ──────────────────────────────────────────────────────────────────
  addGoal: (text, weekKey) => {
    const wk = weekKey || getWeekKey();
    const newGoal = { id: uid(), weekKey: wk, text, done: false };
    set((s) => ({ goals: [...s.goals, newGoal] }));
    get().persist();
    return newGoal;
  },

  toggleGoal: (id) => {
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
    }));
    get().persist();
  },

  deleteGoal: (id) => {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    get().persist();
  },

  updateGoalText: (id, text) => {
    set((s) => ({
      goals: s.goals.map((g) => (g.id === id ? { ...g, text } : g)),
    }));
    get().persist();
  },
}));

export { getWeekKey, uid };
