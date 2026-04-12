function localDateString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toLocalMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDateSet(sessions) {
  const set = new Set();
  (sessions || []).forEach((session) => {
    if (!session?.date) return;
    if (Number(session.minutes || 0) <= 0) return;
    set.add(localDateString(session.date));
  });
  return set;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function computeCurrentStreak(sessions) {
  const dateSet = getDateSet(sessions);
  const todayMidnight = toLocalMidnight(new Date());
  const todayKey = localDateString(todayMidnight);
  const yesterdayMidnight = addDays(todayMidnight, -1);
  const yesterdayKey = localDateString(yesterdayMidnight);

  const todayLogged = dateSet.has(todayKey);

  if (!todayLogged && !dateSet.has(yesterdayKey)) {
    return { current: 0, todayLogged: false };
  }

  let current = 0;
  let cursor = todayLogged ? todayMidnight : yesterdayMidnight;

  while (dateSet.has(localDateString(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, todayLogged };
}

export function computeBestStreak(sessions) {
  const dateSet = getDateSet(sessions);
  if (dateSet.size === 0) return 0;

  let best = 0;
  const dates = [...dateSet].sort();

  dates.forEach((dateStr) => {
    const date = toLocalMidnight(dateStr);
    const prevDate = localDateString(addDays(date, -1));

    if (dateSet.has(prevDate)) return;

    let length = 0;
    let cursor = date;
    while (dateSet.has(localDateString(cursor))) {
      length += 1;
      cursor = addDays(cursor, 1);
    }

    if (length > best) best = length;
  });

  return best;
}

export { localDateString };
