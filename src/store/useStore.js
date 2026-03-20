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

  // Custom sidebar/time-tracking views [{ id, key, label, color, createdAt }]
  customViews: [],

  // Locked In by date { 'YYYY-MM-DD': { morning: boolean, noon: boolean, night: boolean } }
  lockedInByDate: {},

  // AI chat threads
  chatThreads: [],
  activeChatThreadId: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

const CUSTOM_COLORS = [
  "#f97316",
  "#22c55e",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#a855f7",
  "#ef4444",
];

function slugifyViewName(name = "") {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function nextCustomColor(customViews = []) {
  return CUSTOM_COLORS[customViews.length % CUSTOM_COLORS.length];
}

function getWeekKey(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 6) % 7; // start of week (Monday)
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function normalizeLockedInDate(date) {
  if (!date) return new Date().toISOString().slice(0, 10);
  return String(date).slice(0, 10);
}

function normalizeLockedInDay(day = {}) {
  return {
    morning: Boolean(day.morning),
    noon: Boolean(day.noon),
    night: Boolean(day.night),
  };
}

export function getLockedInScore(day = {}) {
  const normalized = normalizeLockedInDay(day);
  const checks =
    Number(normalized.morning) +
    Number(normalized.noon) +
    Number(normalized.night);
  return checks / 3;
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
    customViews: state.customViews,
    lockedInByDate: state.lockedInByDate,
    chatThreads: state.chatThreads,
    activeChatThreadId: state.activeChatThreadId,
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

  // ── Custom Views ───────────────────────────────────────────────────────────
  addCustomView: (label, color) => {
    const trimmedLabel = (label || "").trim();
    if (!trimmedLabel) return null;

    const slug = slugifyViewName(trimmedLabel);
    if (!slug) return null;

    const existingKeys = new Set([
      "courses",
      "passive",
      "personal",
      "work",
      "health",
      ...get().customViews.map((v) => v.key),
    ]);

    let key = `custom-${slug}`;
    let suffix = 2;
    while (existingKeys.has(key)) {
      key = `custom-${slug}-${suffix}`;
      suffix += 1;
    }

    const newView = {
      id: uid(),
      key,
      label: trimmedLabel,
      color: color || nextCustomColor(get().customViews),
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      customViews: [...s.customViews, newView],
      categoryTargets: {
        ...s.categoryTargets,
        [newView.key]: 5,
      },
    }));
    get().persist();
    return newView;
  },

  removeCustomView: (key) => {
    set((s) => {
      const nextTargets = { ...s.categoryTargets };
      delete nextTargets[key];

      return {
        customViews: s.customViews.filter((v) => v.key !== key),
        sessions: s.sessions.filter((session) => session.category !== key),
        categoryTargets: nextTargets,
      };
    });
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
      milestones: [],
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

  addPersonalMilestone: (projectId, text) => {
    const milestone = { id: uid(), text, done: false };
    set((s) => ({
      personalProjects: s.personalProjects.map((p) =>
        p.id === projectId
          ? { ...p, milestones: [...(p.milestones || []), milestone] }
          : p,
      ),
    }));
    get().persist();
  },

  togglePersonalMilestone: (projectId, milestoneId) => {
    set((s) => ({
      personalProjects: s.personalProjects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              milestones: (p.milestones || []).map((m) =>
                m.id === milestoneId ? { ...m, done: !m.done } : m,
              ),
            }
          : p,
      ),
    }));
    get().persist();
  },

  deletePersonalMilestone: (projectId, milestoneId) => {
    set((s) => ({
      personalProjects: s.personalProjects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              milestones: (p.milestones || []).filter(
                (m) => m.id !== milestoneId,
              ),
            }
          : p,
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

  // ── Locked In ──────────────────────────────────────────────────────────────
  setLockedInPeriod: (date, period, value) => {
    if (!["morning", "noon", "night"].includes(period)) return;

    const dateKey = normalizeLockedInDate(date);

    set((s) => {
      const current = normalizeLockedInDay(s.lockedInByDate[dateKey]);
      const nextValue =
        typeof value === "boolean" ? value : !Boolean(current[period]);

      return {
        lockedInByDate: {
          ...s.lockedInByDate,
          [dateKey]: {
            ...current,
            [period]: nextValue,
          },
        },
      };
    });

    get().persist();
  },

  setLockedInDay: (date, updates = {}) => {
    const dateKey = normalizeLockedInDate(date);
    set((s) => {
      const current = normalizeLockedInDay(s.lockedInByDate[dateKey]);
      return {
        lockedInByDate: {
          ...s.lockedInByDate,
          [dateKey]: normalizeLockedInDay({ ...current, ...updates }),
        },
      };
    });
    get().persist();
  },

  deleteLockedInDay: (date) => {
    const dateKey = normalizeLockedInDate(date);
    set((s) => {
      const next = { ...s.lockedInByDate };
      delete next[dateKey];
      return { lockedInByDate: next };
    });
    get().persist();
  },

  // ── AI Chat ───────────────────────────────────────────────────────────────
  createChatThread: () => {
    const id =
      globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    const now = new Date().toISOString();
    const newThread = {
      id,
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    set((s) => {
      const trimmedThreads = s.chatThreads.slice(0, 49);
      return {
        chatThreads: [newThread, ...trimmedThreads],
        activeChatThreadId: id,
      };
    });
    get().persist();
    return id;
  },

  setActiveChatThread: (id) => {
    set({ activeChatThreadId: id });
    get().persist();
  },

  appendChatMessage: (threadId, message) => {
    set((s) => {
      const nextThreads = s.chatThreads.map((thread) => {
        if (thread.id !== threadId) return thread;

        const timestamp = new Date().toISOString();
        const nextMessages = [
          ...thread.messages,
          {
            role: message.role,
            content: message.content,
            timestamp,
          },
        ];

        if (nextMessages.length > 100) {
          const trimmed = nextMessages.slice(-99);
          trimmed.unshift({
            role: "system-notice",
            content: "Earlier messages were removed to save space.",
            timestamp,
          });
          return {
            ...thread,
            messages: trimmed,
            updatedAt: timestamp,
          };
        }

        return {
          ...thread,
          messages: nextMessages,
          updatedAt: timestamp,
        };
      });

      return { chatThreads: nextThreads };
    });
    get().persist();
  },

  updateChatThreadTitle: (threadId, title) => {
    set((s) => ({
      chatThreads: s.chatThreads.map((thread) =>
        thread.id === threadId
          ? { ...thread, title, updatedAt: new Date().toISOString() }
          : thread,
      ),
    }));
    get().persist();
  },

  deleteChatThread: (threadId) => {
    set((s) => {
      const remaining = s.chatThreads.filter(
        (thread) => thread.id !== threadId,
      );
      const nextActive =
        s.activeChatThreadId === threadId
          ? remaining[0]?.id || null
          : s.activeChatThreadId;

      return {
        chatThreads: remaining,
        activeChatThreadId: nextActive,
      };
    });
    get().persist();
  },
}));

export { getWeekKey, uid };
