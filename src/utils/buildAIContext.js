import { getLockedInScore } from "../store/useStore";
import {
  getCategoryLabel,
  getSessionCategoryKey,
  getTrackedCategories,
} from "../viewConfig";
import { computeBestStreak, computeCurrentStreak } from "./computeStreak";
import { buildCalendarEvents } from "./buildCalendarEvents";
import {
  computeWeeklyBudget,
  getWeekRange,
  localDateString,
} from "./computeWeeklyBudget";

const BUILTIN_CATEGORY_KEYS = [
  "courses",
  "passive",
  "personal",
  "work",
  "health",
];

function toStartOfDay(input = new Date()) {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inLastNDays(dateStr, days) {
  const date = parseDate(dateStr);
  if (!date) return false;

  const end = toStartOfDay(new Date());
  const start = toStartOfDay(new Date());
  start.setDate(start.getDate() - (days - 1));

  const check = toStartOfDay(date);
  return check >= start && check <= end;
}

function formatWeekLabel(start, end) {
  return `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

function normalizeWeekKey(dateStr) {
  const { weekStart } = getWeekRange(new Date(dateStr));
  return localDateString(weekStart);
}

function isInRange(dateStr, range) {
  const date = parseDate(dateStr);
  if (!date) return false;
  const check = toStartOfDay(date);
  return check >= range.start && check <= range.end;
}

function minutesToHours(minutes) {
  return Number((minutes / 60).toFixed(1));
}

function getSessionCategory(session) {
  return getSessionCategoryKey(session) || "uncategorized";
}

function buildCategoryMinutes(sessions, range) {
  return sessions.reduce((acc, session) => {
    if (range && !isInRange(session.date, range)) return acc;

    const minutes = Number(session?.minutes || 0);
    if (minutes <= 0) return acc;

    const category = getSessionCategory(session);
    acc[category] = (acc[category] || 0) + minutes;
    return acc;
  }, {});
}

function buildReferenceItem(session, lookup) {
  const category = getSessionCategory(session);

  if (category === "courses") {
    return lookup.courses.get(session.refId)?.title || "Untitled Course";
  }
  if (category === "passive") {
    return lookup.projects.get(session.refId)?.name || "Unnamed Project";
  }
  if (category === "personal") {
    return (
      lookup.personalProjects.get(session.refId)?.name || "Unnamed Project"
    );
  }

  return getCategoryLabel(category, lookup.customViews);
}

function ensureCategoryKeys(...sources) {
  const keys = new Set(BUILTIN_CATEGORY_KEYS);
  sources.forEach((source) => {
    Object.keys(source || {}).forEach((key) => keys.add(key));
  });
  return [...keys];
}

export function buildAIContext(store = {}) {
  // Note: chat history is NOT included in this snapshot.
  // History is passed separately via conversationHistory in ollamaService.
  const courses = store.courses || [];
  const projects = store.projects || [];
  const personalProjects = store.personalProjects || [];
  const sessions = store.sessions || [];
  const goals = store.goals || [];
  const lockedInByDate = store.lockedInByDate || {};
  const customViews = store.customViews || [];
  const categoryTargets = store.categoryTargets || {};

  const lookup = {
    courses: new Map(courses.map((c) => [c.id, c])),
    projects: new Map(projects.map((p) => [p.id, p])),
    personalProjects: new Map(personalProjects.map((p) => [p.id, p])),
    customViews,
  };

  const { weekStart: thisWeekStart, weekEnd: thisWeekEnd } = getWeekRange(
    new Date(),
  );
  const thisWeekRange = { start: thisWeekStart, end: thisWeekEnd };
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const { weekStart: lastWeekStartDate, weekEnd: lastWeekEndDate } =
    getWeekRange(lastWeekStart);
  const lastWeekRange = { start: lastWeekStartDate, end: lastWeekEndDate };

  const allCategoryMinutes = buildCategoryMinutes(sessions);
  const thisWeekMinutes = buildCategoryMinutes(sessions, thisWeekRange);
  const lastWeekMinutes = buildCategoryMinutes(sessions, lastWeekRange);

  const categoryKeys = ensureCategoryKeys(
    categoryTargets,
    allCategoryMinutes,
    thisWeekMinutes,
    lastWeekMinutes,
  );

  const totalLoggedHoursByCategory = {};
  const thisWeekLoggedHoursByCategory = {};
  const lastWeekLoggedHoursByCategory = {};
  const weekOverWeekChange = {};

  categoryKeys.forEach((key) => {
    const totalHours = minutesToHours(allCategoryMinutes[key] || 0);
    const thisWeekHours = minutesToHours(thisWeekMinutes[key] || 0);
    const lastWeekHours = minutesToHours(lastWeekMinutes[key] || 0);
    const diff = Number((thisWeekHours - lastWeekHours).toFixed(1));

    totalLoggedHoursByCategory[key] = totalHours;
    thisWeekLoggedHoursByCategory[key] = thisWeekHours;
    lastWeekLoggedHoursByCategory[key] = lastWeekHours;
    weekOverWeekChange[key] =
      `${diff >= 0 ? "+" : "-"}${Math.abs(diff).toFixed(1)}h`;
  });

  const sessionLookup = sessions.reduce((acc, session) => {
    const key = `${session.type || ""}:${session.refId || ""}`;
    const minutes = Number(session?.minutes || 0);
    acc[key] = (acc[key] || 0) + minutes;
    return acc;
  }, {});

  const coursesSnapshot = courses.map((course) => {
    const minutes = sessionLookup[`course:${course.id}`] || 0;
    const progress = Number(course.completion || 0);
    return {
      name: course.title || "Untitled Course",
      progressPercent: progress,
      loggedHours: minutesToHours(minutes),
      weeklyTargetHours: Number(course.targetHoursPerWeek || 0),
      deadline: course.deadline || "",
      status: progress >= 100 ? "completed" : "active",
    };
  });

  const passiveIncomeProjects = projects.map((project) => {
    const minutes = sessionLookup[`project:${project.id}`] || 0;
    return {
      name: project.name || "Unnamed Project",
      status: project.status || "active",
      loggedHours: minutesToHours(minutes),
      milestones: (project.milestones || []).map((milestone) => ({
        title: milestone.text || "Untitled Milestone",
        completed: Boolean(milestone.done),
      })),
    };
  });

  const personalProjectsSnapshot = personalProjects.map((project) => {
    const minutes = sessionLookup[`personal:${project.id}`] || 0;
    return {
      name: project.name || "Unnamed Project",
      status: project.status || "active",
      loggedHours: minutesToHours(minutes),
      tasks: (project.milestones || []).map((milestone) => ({
        title: milestone.text || "Untitled Task",
        completed: Boolean(milestone.done),
      })),
    };
  });

  const sessionsSnapshot = sessions
    .filter((session) => inLastNDays(session.date, 90))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((session) => ({
      date: session.date,
      category: getSessionCategory(session),
      referenceItem: buildReferenceItem(session, lookup),
      durationMinutes: Number(session.minutes || 0),
    }));

  const currentWeekKey = localDateString(thisWeekRange.start);
  const weeklyGoals = goals
    .filter((goal) => normalizeWeekKey(goal.weekKey) === currentWeekKey)
    .map((goal) => ({
      text: goal.text || "",
      completed: Boolean(goal.done),
    }));

  const lockedInRecentDays = Object.entries(lockedInByDate)
    .filter(([dateKey]) => inLastNDays(dateKey, 30))
    .map(([dateKey, day]) => ({
      date: dateKey,
      score: Number(getLockedInScore(day).toFixed(2)),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const lockedInTotalScore = Number(
    lockedInRecentDays.reduce((total, day) => total + day.score, 0).toFixed(2),
  );

  const lockedInThisWeek = lockedInRecentDays.filter((day) =>
    isInRange(day.date, thisWeekRange),
  );
  const lockedInLastWeek = lockedInRecentDays.filter((day) =>
    isInRange(day.date, lastWeekRange),
  );

  const lockedInThisWeekScore = Number(
    lockedInThisWeek.reduce((total, day) => total + day.score, 0).toFixed(2),
  );
  const lockedInLastWeekScore = Number(
    lockedInLastWeek.reduce((total, day) => total + day.score, 0).toFixed(2),
  );

  const customViewsSnapshot = customViews.map((view) => ({
    name: view.label || "Custom View",
    weeklyTargetHours: Number(categoryTargets[view.key] || 0),
    totalLoggedHours: minutesToHours(allCategoryMinutes[view.key] || 0),
  }));

  const budgetCategories = getTrackedCategories(customViews).map(
    (category) => ({
      key: category.key,
      name: category.label,
      weeklyTargetHours: Number(categoryTargets[category.key] || 0),
      color: category.color,
    }),
  );
  const weeklyBudget = computeWeeklyBudget(
    sessions,
    budgetCategories,
    new Date(),
  );
  const mostBehind = weeklyBudget.categories
    .filter((category) => category.remainingHours > 1)
    .map((category) => {
      const expected = (category.targetHours * category.pace) / 100;
      return {
        name: category.name,
        gapHours: Math.max(0, expected - category.loggedHours),
      };
    })
    .sort((a, b) => b.gapHours - a.gapHours)[0];

  const aiSummary =
    mostBehind && mostBehind.gapHours > 0
      ? `${mostBehind.name} is ${mostBehind.gapHours.toFixed(1)}h behind pace with ${weeklyBudget.daysRemaining} days left; consider prioritizing it today.`
      : "All categories are on or ahead of pace this week.";

  const currentStreak = computeCurrentStreak(sessions);
  const bestStreak = computeBestStreak(sessions);
  const streakAtRisk =
    !currentStreak.todayLogged && new Date().getHours() >= 18;

  const calendarEvents = buildCalendarEvents(store);
  const overdueEvents = calendarEvents.filter((event) => event.overdue);
  const dueSoonEvents = calendarEvents.filter(
    (event) => event.daysUntil >= 0 && event.daysUntil <= 7,
  );
  const dueThisMonthEvents = calendarEvents.filter(
    (event) => event.daysUntil >= 0 && event.daysUntil <= 30,
  );
  const overdueCount = overdueEvents.length;

  return {
    courses: coursesSnapshot,
    passiveIncomeProjects,
    personalProjects: personalProjectsSnapshot,
    sessions: sessionsSnapshot,
    weeklyGoals,
    lockedIn: {
      totalScore: lockedInTotalScore,
      recentDays: lockedInRecentDays,
    },
    customViews: customViewsSnapshot,
    streak: {
      current: currentStreak.current,
      best: bestStreak,
      todayLogged: currentStreak.todayLogged,
      streakAtRisk,
    },
    weeklyBudget: {
      ...weeklyBudget,
      aiSummary,
    },
    upcomingMilestones: {
      overdue: overdueEvents,
      dueSoon: dueSoonEvents,
      dueThisMonth: dueThisMonthEvents,
    },
    overdueCount,
    weekRanges: {
      thisWeek: {
        weekKey: currentWeekKey,
        startDate: thisWeekRange.start.toISOString().slice(0, 10),
        endDate: thisWeekRange.end.toISOString().slice(0, 10),
        label: formatWeekLabel(thisWeekRange.start, thisWeekRange.end),
      },
      lastWeek: {
        startDate: lastWeekRange.start.toISOString().slice(0, 10),
        endDate: lastWeekRange.end.toISOString().slice(0, 10),
        label: formatWeekLabel(lastWeekRange.start, lastWeekRange.end),
      },
    },
    totalLoggedHoursByCategory,
    thisWeekLoggedHoursByCategory,
    lastWeekLoggedHoursByCategory,
    weekOverWeekChange,
    lockedInWeekScores: {
      thisWeek: lockedInThisWeekScore,
      lastWeek: lockedInLastWeekScore,
    },
    generatedAt: new Date().toISOString(),
  };
}
