import { getLockedInScore, getWeekKey } from "../store/useStore";

function toStartOfDay(input = new Date()) {
  const d = new Date(input);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inLastNDays(dateStr, days = 7) {
  const d = parseDate(dateStr);
  if (!d) return false;

  const end = toStartOfDay(new Date());
  const start = toStartOfDay(new Date());
  start.setDate(start.getDate() - (days - 1));

  const check = toStartOfDay(d);
  return check >= start && check <= end;
}

function formatHours(minutes) {
  return (minutes / 60).toFixed(1);
}

function summarizeSessions(sessions, coursesById, projectsById) {
  const totals = {
    totalMinutes: 0,
    byCourse: new Map(),
    byProject: new Map(),
  };

  for (const session of sessions) {
    const minutes = Number(session?.minutes || 0);
    if (minutes <= 0) continue;

    totals.totalMinutes += minutes;

    if (session.type === "course") {
      const title = coursesById.get(session.refId)?.title || "Untitled Course";
      totals.byCourse.set(title, (totals.byCourse.get(title) || 0) + minutes);
    }

    if (session.type === "project") {
      const title = projectsById.get(session.refId)?.name || "Unnamed Project";
      totals.byProject.set(title, (totals.byProject.get(title) || 0) + minutes);
    }
  }

  return totals;
}

function topBreakdown(map, label) {
  if (map.size === 0) return `0.0 hours on ${label}.`;

  const text = [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(
      ([name, minutes]) => `${formatHours(minutes)} hours on ${label}: ${name}`,
    )
    .join("; ");

  return `${text}.`;
}

export function generateAIContext(storeSnapshot = {}) {
  const courses = storeSnapshot.courses || [];
  const projects = storeSnapshot.projects || [];
  const sessions = storeSnapshot.sessions || [];
  const goals = storeSnapshot.goals || [];
  const lockedInByDate = storeSnapshot.lockedInByDate || {};

  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  const last7LockedIn = Object.entries(lockedInByDate).filter(([dateKey]) =>
    inLastNDays(dateKey, 7),
  );
  let fullDays = 0;
  let partialDays = 0;

  for (const [, day] of last7LockedIn) {
    const score = getLockedInScore(day);
    if (score >= 1) fullDays += 1;
    else if (score > 0) partialDays += 1;
  }

  const recentSessions = sessions.filter((s) => inLastNDays(s.date, 7));
  const sessionSummary = summarizeSessions(
    recentSessions,
    coursesById,
    projectsById,
  );

  const activeCourses = courses
    .filter((c) => Number(c.completion || 0) < 100)
    .sort((a, b) => {
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    })
    .slice(0, 4);

  const activeProjects = projects
    .filter((p) => p.status !== "launched")
    .slice(0, 4);

  const weekKey = getWeekKey();
  const weeklyGoals = goals.filter((g) => g.weekKey === weekKey);
  const weeklyGoalsDone = weeklyGoals.filter((g) => g.done).length;

  const courseLines = activeCourses.length
    ? activeCourses
        .map((c) => {
          const title = c.title || "Untitled Course";
          const completion = Number(c.completion || 0);
          const deadline = c.deadline || "No deadline set";
          const target = Number(c.targetHoursPerWeek || 0);
          return `Active Course: ${title} is at ${completion}% completion, deadline is ${deadline}. Target is ${target} hrs/week.`;
        })
        .join("\n")
    : "Active Course: None currently in progress.";

  const projectLines = activeProjects.length
    ? activeProjects
        .map((p) => {
          const name = p.name || "Unnamed Project";
          const milestones = p.milestones || [];
          const completed = milestones.filter((m) => m.done).length;
          const target = Number(p.targetHoursPerWeek || 0);
          const status = p.status || "active";
          return `Active Project: ${name} is ${status}. Milestones completed: ${completed}/${milestones.length}. Target is ${target} hrs/week.`;
        })
        .join("\n")
    : "Active Project: None currently in progress.";

  return [
    `Locked In: Over the last 7 days, the user had ${fullDays} fully locked in days, and ${partialDays} partial days.`,
    `Sessions: They logged a total of ${formatHours(sessionSummary.totalMinutes)} hours. ${topBreakdown(sessionSummary.byCourse, "Course")} ${topBreakdown(sessionSummary.byProject, "Project")}`,
    "Courses/Projects Status:",
    courseLines,
    projectLines,
    `Goals: They completed ${weeklyGoalsDone} out of ${weeklyGoals.length} weekly goals.`,
  ].join("\n");
}
