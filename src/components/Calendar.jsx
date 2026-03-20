import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "../store/useStore";
import { buildCalendarEvents, TYPE_COLORS } from "../utils/buildCalendarEvents";
import { localDateString } from "../utils/computeStreak";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toLocalDateKey(date) {
  return localDateString(date);
}

function getMonthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = startOffset + daysInMonth <= 35 ? 35 : 42;
  const gridStart = new Date(year, month, 1 - startOffset);

  const cells = [];
  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push({
      date,
      dateKey: toLocalDateKey(date),
      isCurrentMonth: date.getMonth() === month,
      rowIndex: Math.floor(i / 7),
      colIndex: i % 7,
    });
  }

  return { cells, rows: totalCells / 7 };
}

export default function Calendar() {
  const courses = useStore((s) => s.courses);
  const projects = useStore((s) => s.projects);
  const personalProjects = useStore((s) => s.personalProjects);

  const todayKey = toLocalDateKey(new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const containerRef = useRef(null);

  const events = useMemo(
    () => buildCalendarEvents({ courses, projects, personalProjects }),
    [courses, projects, personalProjects],
  );

  const eventsByDate = useMemo(() => {
    return events.reduce((acc, event) => {
      if (!acc[event.dueDate]) acc[event.dueDate] = [];
      acc[event.dueDate].push(event);
      return acc;
    }, {});
  }, [events]);

  const { cells, rows } = useMemo(
    () => getMonthGrid(viewDate.getFullYear(), viewDate.getMonth()),
    [viewDate],
  );

  const overdueItems = useMemo(
    () =>
      events
        .filter((event) => event.overdue)
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [events],
  );

  const upcomingItems = useMemo(
    () =>
      events
        .filter((event) => event.daysUntil >= 0 && event.daysUntil <= 60)
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [events],
  );

  useEffect(() => {
    const handleClick = (event) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target)) {
        setSelectedDate(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const monthLabel = getMonthLabel(viewDate.getFullYear(), viewDate.getMonth());

  const handleToday = () => {
    setViewDate(new Date());
    setSelectedDate(null);
  };

  const handlePrevMonth = () => {
    const next = new Date(viewDate);
    next.setMonth(viewDate.getMonth() - 1);
    setViewDate(next);
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    const next = new Date(viewDate);
    next.setMonth(viewDate.getMonth() + 1);
    setViewDate(next);
    setSelectedDate(null);
  };

  const renderStatusBadge = (event) => {
    if (event.overdue) {
      return (
        <span
          className="badge"
          style={{
            background: "var(--color-background-danger)",
            color: "var(--color-text-danger)",
          }}
        >
          {Math.abs(event.daysUntil)} days overdue
        </span>
      );
    }

    if (event.daysUntil === 0) {
      return (
        <span
          className="badge"
          style={{
            background: "var(--color-background-warning)",
            color: "var(--color-text-warning)",
          }}
        >
          Due today
        </span>
      );
    }

    if (event.daysUntil <= 7) {
      return (
        <span
          className="badge"
          style={{
            background: "var(--color-background-warning)",
            color: "var(--color-text-warning)",
          }}
        >
          in {event.daysUntil} days
        </span>
      );
    }

    return (
      <span className="badge bg-surface-600 text-surface-300">
        {new Date(`${event.dueDate}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto" ref={containerRef}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-50">Calendar</h1>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-surface-50">
            {monthLabel}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth} className="btn-ghost">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={handleToday} className="btn-ghost text-xs">
              Today
            </button>
            <button onClick={handleNextMonth} className="btn-ghost">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-[11px] text-surface-400">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {cells.map((cell) => {
            const dayEvents = eventsByDate[cell.dateKey] || [];
            const isToday = cell.dateKey === todayKey;
            const showPopover = selectedDate === cell.dateKey;
            const popoverOnTop = cell.rowIndex >= rows - 2;
            const maxVisible = 2;
            const hiddenCount = Math.max(0, dayEvents.length - maxVisible);

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() =>
                  setSelectedDate(dayEvents.length ? cell.dateKey : null)
                }
                className={`relative rounded-lg border p-2 text-left min-h-[90px] transition-colors ${
                  cell.isCurrentMonth
                    ? "border-surface-600 bg-surface-800"
                    : "border-surface-700 bg-surface-900"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[11px] font-semibold ${
                      cell.isCurrentMonth
                        ? "text-surface-200"
                        : "text-surface-500"
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                  {isToday && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{
                        background: "var(--color-background-info)",
                        color: "var(--color-text-info)",
                      }}
                    >
                      today
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {dayEvents.slice(0, maxVisible).map((event) => {
                    const pillStyle = event.overdue
                      ? {
                          background: "var(--color-background-danger)",
                          color: "var(--color-text-danger)",
                        }
                      : {
                          background: `${event.color}33`,
                          color: event.color,
                        };

                    return (
                      <div
                        key={event.id}
                        className={`text-[10px] px-2 py-0.5 rounded-full truncate ${
                          event.completed ? "line-through text-surface-400" : ""
                        }`}
                        style={event.completed ? undefined : pillStyle}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <div className="text-[10px] text-surface-500">
                      +{hiddenCount} more
                    </div>
                  )}
                </div>

                {showPopover && dayEvents.length > 0 && (
                  <div
                    className={`absolute z-10 left-2 right-2 rounded-lg border border-surface-500 bg-surface-700 p-3 text-xs shadow-xl ${
                      popoverOnTop ? "bottom-full mb-2" : "top-full mt-2"
                    }`}
                  >
                    <div className="space-y-2">
                      {dayEvents.map((event) => (
                        <div key={event.id} className="space-y-0.5">
                          <p className="text-surface-50 font-medium">
                            {event.title}
                          </p>
                          <p className="text-surface-400 text-[11px]">
                            {event.projectName}
                          </p>
                          <p className="text-[11px] text-surface-300">
                            {event.overdue
                              ? `${Math.abs(event.daysUntil)} days overdue`
                              : event.daysUntil === 0
                                ? "Due today"
                                : `in ${event.daysUntil} days`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-[11px] text-surface-400">
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: TYPE_COLORS.passive }}
            />
            Passive income
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: TYPE_COLORS.course }}
            />
            Courses
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: TYPE_COLORS.personal }}
            />
            Personal projects
          </span>
          <span className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "var(--color-background-danger)" }}
            />
            Overdue
          </span>
        </div>
      </div>

      <div className="card space-y-4">
        <p className="text-[11px] text-surface-400 uppercase tracking-wide">
          Upcoming & overdue
        </p>

        {overdueItems.length === 0 && upcomingItems.length === 0 ? (
          <p className="text-sm text-surface-400">
            No upcoming deadlines. Add due dates to milestones in your projects
            to see them here.
          </p>
        ) : (
          <div className="space-y-3">
            {[...overdueItems, ...upcomingItems].map((event) => (
              <div
                key={`${event.type}-${event.id}`}
                className="flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-[13px] text-surface-50">{event.title}</p>
                  <p className="text-[11px] text-surface-400">
                    {event.projectName}
                  </p>
                </div>
                {renderStatusBadge(event)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
