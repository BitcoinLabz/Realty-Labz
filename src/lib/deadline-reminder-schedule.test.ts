import { describe, expect, it } from "vitest";
import {
  daysUntilDue,
  describeDaysUntil,
  reminderStageFor,
  todayInReminderZone,
} from "./deadline-reminder-schedule";

const due = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("todayInReminderZone", () => {
  it("uses Michigan's date, not UTC's, in the evening", () => {
    // 11pm Sept 27 in Detroit is already Sept 28 in UTC.
    const now = new Date("2026-09-28T03:00:00.000Z");
    expect(todayInReminderZone(now).toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });

  it("matches UTC's date during the day", () => {
    const now = new Date("2026-09-27T12:00:00.000Z");
    expect(todayInReminderZone(now).toISOString()).toBe("2026-09-27T00:00:00.000Z");
  });
});

describe("daysUntilDue", () => {
  const today = due("2026-09-27");

  it("counts whole calendar days", () => {
    expect(daysUntilDue(due("2026-09-27"), today)).toBe(0);
    expect(daysUntilDue(due("2026-09-28"), today)).toBe(1);
    expect(daysUntilDue(due("2026-09-30"), today)).toBe(3);
    expect(daysUntilDue(due("2026-09-26"), today)).toBe(-1);
  });

  it("crosses a month boundary correctly", () => {
    expect(daysUntilDue(due("2026-10-01"), today)).toBe(4);
  });
});

describe("reminderStageFor", () => {
  const none = { earlySentAt: null, finalSentAt: null };
  const sent = new Date();

  it("sends nothing more than 3 days out", () => {
    expect(reminderStageFor({ daysUntil: 4, ...none })).toBeNull();
  });

  it("sends the early reminder 2-3 days out", () => {
    expect(reminderStageFor({ daysUntil: 3, ...none })).toBe("early");
    expect(reminderStageFor({ daysUntil: 2, ...none })).toBe("early");
  });

  it("never sends the early reminder twice", () => {
    expect(reminderStageFor({ daysUntil: 2, earlySentAt: sent, finalSentAt: null })).toBeNull();
  });

  it("sends the final reminder the day before, even after the early one", () => {
    expect(reminderStageFor({ daysUntil: 1, earlySentAt: sent, finalSentAt: null })).toBe("final");
  });

  it("catches up on a missed day: due today still gets its final reminder", () => {
    expect(reminderStageFor({ daysUntil: 0, ...none })).toBe("final");
  });

  it("never sends the final reminder twice", () => {
    expect(reminderStageFor({ daysUntil: 1, earlySentAt: sent, finalSentAt: sent })).toBeNull();
    expect(reminderStageFor({ daysUntil: 0, earlySentAt: null, finalSentAt: sent })).toBeNull();
  });

  it("doesn't nag about past-due deadlines", () => {
    expect(reminderStageFor({ daysUntil: -1, ...none })).toBeNull();
  });
});

describe("describeDaysUntil", () => {
  it("reads naturally", () => {
    expect(describeDaysUntil(0)).toBe("today");
    expect(describeDaysUntil(1)).toBe("tomorrow");
    expect(describeDaysUntil(3)).toBe("in 3 days");
  });
});
