import { localDateString } from "./computeStreak";

const TYPE_COLORS = {
  passive: "#1D9E75",
  personal: "#D85A30",
  course: "#7F77DD",
};

function toLocalMidnight(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function daysBetween(dateKey, todayKey) {
  const due = toLocalMidnight(dateKey);
  const today = toLocalMidnight(todayKey);
  return Math.round((due - today) / 86400000);
}

export function buildCalendarEvents(store = {}) {
  const todayKey = localDateString(new Date());
  const courses = store.courses || [];
  const projects = store.projects || [];
  const personalProjects = store.personalProjects || [];

  const events = [];

  projects.forEach((project) => {
    (project.milestones || []).forEach((milestone) => {
      if (!milestone?.dueDate) return;
      const dueDate = milestone.dueDate;
      const completed = Boolean(milestone.done);
      const daysUntil = daysBetween(dueDate, todayKey);
      const overdue = !completed && dueDate < todayKey;

      if (completed && daysUntil < -30) return;

      events.push({
        id: milestone.id,
        title: milestone.text || "Milestone",
        dueDate,
        type: "passive",
        projectName: project.name || "Unnamed Project",
        completed,
        overdue,
        daysUntil,
        color: TYPE_COLORS.passive,
      });
    });
  });

  personalProjects.forEach((project) => {
    (project.milestones || []).forEach((milestone) => {
      if (!milestone?.dueDate) return;
      const dueDate = milestone.dueDate;
      const completed = Boolean(milestone.done);
      const daysUntil = daysBetween(dueDate, todayKey);
      const overdue = !completed && dueDate < todayKey;

      if (completed && daysUntil < -30) return;

      events.push({
        id: milestone.id,
        title: milestone.text || "Task",
        dueDate,
        type: "personal",
        projectName: project.name || "Unnamed Project",
        completed,
        overdue,
        daysUntil,
        color: TYPE_COLORS.personal,
      });
    });
  });

  courses.forEach((course) => {
    if (!course?.deadline) return;
    const dueDate = course.deadline;
    const completed = Number(course.completion || 0) >= 100;
    const daysUntil = daysBetween(dueDate, todayKey);
    const overdue = !completed && dueDate < todayKey;

    if (completed && daysUntil < -30) return;

    events.push({
      id: course.id,
      title: `Course deadline: ${course.title || "Untitled Course"}`,
      dueDate,
      type: "course",
      projectName: course.title || "Untitled Course",
      completed,
      overdue,
      daysUntil,
      color: TYPE_COLORS.course,
    });
  });

  return events.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export { TYPE_COLORS };
