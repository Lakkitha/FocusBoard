export const BUILTIN_CATEGORIES = [
  {
    key: "courses",
    label: "Courses & Certs",
    color: "#7c6af7",
    sessionType: "course",
    needsRef: true,
  },
  {
    key: "passive",
    label: "Passive Income",
    color: "#2dd4bf",
    sessionType: "project",
    needsRef: true,
  },
  {
    key: "personal",
    label: "Personal Projects",
    color: "#f472b6",
    sessionType: "personal",
    needsRef: true,
  },
  {
    key: "work",
    label: "Job / Main Work",
    color: "#4fa5ff",
    sessionType: "work",
    needsRef: false,
  },
  {
    key: "health",
    label: "Health & Fitness",
    color: "#4ade80",
    sessionType: "health",
    needsRef: false,
  },
];

const TYPE_TO_CATEGORY = {
  course: "courses",
  project: "passive",
  personal: "personal",
  work: "work",
  health: "health",
};

export function getSessionCategoryKey(session) {
  if (session.category) return session.category;
  return TYPE_TO_CATEGORY[session.type] || null;
}

export function getCategoryLabel(categoryKey, customViews = []) {
  const builtIn = BUILTIN_CATEGORIES.find((c) => c.key === categoryKey);
  if (builtIn) return builtIn.label;

  const custom = customViews.find((v) => v.key === categoryKey);
  if (custom) return custom.label;

  return "Custom View";
}

export function getCategoryColor(categoryKey, customViews = []) {
  const builtIn = BUILTIN_CATEGORIES.find((c) => c.key === categoryKey);
  if (builtIn) return builtIn.color;

  const custom = customViews.find((v) => v.key === categoryKey);
  if (custom) return custom.color;

  return "#94a3b8";
}

export function getTrackedCategories(customViews = []) {
  return [
    ...BUILTIN_CATEGORIES,
    ...customViews.map((view) => ({
      key: view.key,
      label: view.label,
      color: view.color,
      sessionType: view.key,
      needsRef: false,
      isCustom: true,
    })),
  ];
}
