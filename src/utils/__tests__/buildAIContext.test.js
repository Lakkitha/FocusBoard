import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildAIContext } from "../buildAIContext";

describe("buildAIContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds expected snapshot fields from store data", () => {
    const store = {
      courses: [
        {
          id: "c1",
          title: "JS Mastery",
          completion: 50,
          targetHoursPerWeek: 2,
          deadline: "2026-04-20",
        },
      ],
      projects: [
        {
          id: "p1",
          name: "Content Site",
          status: "active",
          milestones: [
            { id: "m1", text: "Write article", done: false, dueDate: "2026-04-15" },
          ],
        },
      ],
      personalProjects: [
        {
          id: "pp1",
          name: "Habit App",
          status: "active",
          milestones: [{ id: "pm1", text: "Refactor", done: true, dueDate: "2026-03-01" }],
        },
      ],
      sessions: [
        { id: "s1", type: "course", refId: "c1", date: "2026-04-06", minutes: 120 },
        { id: "s2", type: "work", date: "2026-04-07", minutes: 60 },
        { id: "s3", category: "custom-deepwork", date: "2026-04-08", minutes: 90 },
      ],
      goals: [{ id: "g1", weekKey: "2026-04-06", text: "Ship feature", done: false }],
      categoryTargets: {
        courses: 10,
        passive: 8,
        work: 40,
        health: 5,
        personal: 5,
        "custom-deepwork": 6,
      },
      customViews: [
        {
          id: "v1",
          key: "custom-deepwork",
          label: "Deep Work",
          color: "#123456",
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ],
      lockedInByDate: {
        "2026-04-07": { morning: true, noon: false, night: true },
      },
    };

    const context = buildAIContext(store);

    expect(context.courses).toHaveLength(1);
    expect(context.sessions).toHaveLength(3);
    expect(context.weeklyGoals).toEqual([{ text: "Ship feature", completed: false }]);
    expect(context.customViews).toEqual([
      { name: "Deep Work", weeklyTargetHours: 6, totalLoggedHours: 1.5 },
    ]);
    expect(context.totalLoggedHoursByCategory.courses).toBe(2);
    expect(context.thisWeekLoggedHoursByCategory.work).toBe(1);
    expect(context.totalLoggedHoursByCategory["custom-deepwork"]).toBe(1.5);
    expect(context.weekRanges.thisWeek.weekKey).toBe("2026-04-06");
    expect(context.generatedAt).toBeDefined();
  });

  it("returns stable empty defaults for an empty store", () => {
    const context = buildAIContext({});

    expect(context.courses).toEqual([]);
    expect(context.sessions).toEqual([]);
    expect(context.weeklyGoals).toEqual([]);
    expect(context.totalLoggedHoursByCategory).toMatchObject({
      courses: 0,
      passive: 0,
      personal: 0,
      work: 0,
      health: 0,
    });
  });
});
