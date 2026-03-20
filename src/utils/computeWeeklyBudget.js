function localDateString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekRange(today) {
  const base = toLocalMidnight(today);
  const dayIndex = (base.getDay() + 6) % 7; // Mon=0 ... Sun=6
  const weekStart = addDays(base, -dayIndex);
  const weekEnd = addDays(weekStart, 6);
  return { weekStart, weekEnd, dayIndex };
}

function roundToHalf(value) {
  return Math.round(value * 2) / 2;
}

export function computeWeeklyBudget(
  sessions = [],
  categories = [],
  today = new Date(),
) {
  const { weekStart, weekEnd, dayIndex } = getWeekRange(today);
  const weekStartKey = localDateString(weekStart);
  const weekEndKey = localDateString(weekEnd);
  const daysElapsed = dayIndex + 1;
  const daysRemaining = Math.max(0, 7 - daysElapsed);

  const dailyTotals = {};
  for (let i = 0; i < 7; i += 1) {
    const key = localDateString(addDays(weekStart, i));
    dailyTotals[key] = 0;
  }

  const categoryMinutes = categories.reduce((acc, category) => {
    acc[category.key] = 0;
    return acc;
  }, {});

  const typeToCategory = {
    course: "courses",
    project: "passive",
    personal: "personal",
    work: "work",
    health: "health",
  };

  const nameToKey = categories.reduce((acc, category) => {
    acc[String(category.name || "").toLowerCase()] = category.key;
    return acc;
  }, {});

  sessions.forEach((session) => {
    if (!session?.date) return;
    const dateKey = localDateString(session.date);
    if (dateKey < weekStartKey || dateKey > weekEndKey) return;

    const minutes = Number(
      session.durationMinutes ?? session.minutes ?? session.duration ?? 0,
    );
    const rawCategory = session.category || typeToCategory[session.type] || "";
    const categoryKey =
      categoryMinutes[rawCategory] !== undefined
        ? rawCategory
        : nameToKey[String(rawCategory).toLowerCase()];

    if (dailyTotals[dateKey] !== undefined) {
      dailyTotals[dateKey] += minutes / 60;
    }
    if (categoryKey && categoryMinutes[categoryKey] !== undefined) {
      categoryMinutes[categoryKey] += minutes / 60;
    }
  });

  const totalTargetHours = categories.reduce(
    (sum, category) => sum + Number(category.weeklyTargetHours || 0),
    0,
  );
  const totalLoggedHours = Object.values(categoryMinutes).reduce(
    (sum, value) => sum + value,
    0,
  );
  const totalRemainingHours = totalTargetHours - totalLoggedHours;
  const requiredDailyHours =
    daysRemaining > 0 ? totalRemainingHours / daysRemaining : 0;

  const pace = (daysElapsed / 7) * 100;

  const categoryResults = categories.map((category) => {
    const targetHours = Number(category.weeklyTargetHours || 0);
    const loggedHours = Number(categoryMinutes[category.key] || 0);
    const remainingHours = targetHours - loggedHours;
    const rawPercent = targetHours > 0 ? (loggedHours / targetHours) * 100 : 0;
    const percentUsed = Math.min(120, Number(rawPercent.toFixed(1)));

    let status = "on-track";
    if (loggedHours > targetHours) {
      status = "over";
    } else if (
      targetHours > 0 &&
      loggedHours >= targetHours * 0.95 &&
      loggedHours <= targetHours
    ) {
      status = "complete";
    } else if (percentUsed < pace - 20) {
      status = "behind";
    }

    return {
      key: category.key,
      name: category.name,
      color: category.color,
      targetHours,
      loggedHours: Number(loggedHours.toFixed(1)),
      remainingHours: Number(remainingHours.toFixed(1)),
      percentUsed,
      status,
      pace: Number(pace.toFixed(1)),
    };
  });

  const overCandidate = categoryResults
    .map((category) => ({
      key: category.key,
      surplus: category.loggedHours - category.targetHours,
    }))
    .filter((category) => category.surplus > 0)
    .sort((a, b) => b.surplus - a.surplus)[0];

  const behindCandidate = categoryResults
    .map((category) => {
      if (category.targetHours <= 0) return null;
      const expected = (category.targetHours * pace) / 100;
      const gapHours = Math.max(0, expected - category.loggedHours);
      return {
        key: category.key,
        gapHours,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.gapHours - a.gapHours)[0];

  let rebalanceSuggestion = { from: null, to: null, hours: null };

  if (overCandidate && behindCandidate) {
    const surplus = overCandidate.surplus;
    const gapHours = behindCandidate.gapHours;

    if (surplus >= 0.5 && gapHours >= 1) {
      rebalanceSuggestion = {
        from: overCandidate.key,
        to: behindCandidate.key,
        hours: roundToHalf(Math.min(surplus, gapHours)),
      };
    }
  }

  return {
    weekStart: weekStartKey,
    weekEnd: weekEndKey,
    totalTargetHours: Number(totalTargetHours.toFixed(1)),
    totalLoggedHours: Number(totalLoggedHours.toFixed(1)),
    totalRemainingHours: Number(totalRemainingHours.toFixed(1)),
    daysElapsed,
    daysRemaining,
    requiredDailyHours: Number(requiredDailyHours.toFixed(1)),
    categories: categoryResults,
    dailyTotals,
    rebalanceSuggestion,
  };
}

export { localDateString, getWeekRange };
