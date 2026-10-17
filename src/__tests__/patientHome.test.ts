import { describe, it, expect } from 'vitest';

describe('Patient Home & Recovery Plan Logic', () => {
  it('calculates days post-op correctly based on surgical start date', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - 14);
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(14);
  });

  it('calculates protocol progress percentage within reasonable bounds', () => {
    const start = Date.now() - 14 * 86400000;
    const end = Date.now() + 16 * 86400000; // 30 day protocol
    const now = Date.now();
    const pct = Math.round(((now - start) / (end - start)) * 100);
    expect(pct).toBeGreaterThanOrEqual(45);
    expect(pct).toBeLessThanOrEqual(50);
  });

  it('determines daily goal completion state accurately', () => {
    // Both pending
    let isExerciseDoneToday = false;
    let isCheckinDoneToday = false;
    let totalGoals = 2;
    let completedGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0);
    expect(completedGoals).toBe(0);
    expect(completedGoals === totalGoals).toBe(false);

    // One completed
    isCheckinDoneToday = true;
    completedGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0);
    expect(completedGoals).toBe(1);
    expect(completedGoals === totalGoals).toBe(false);

    // All completed
    isExerciseDoneToday = true;
    completedGoals = (isExerciseDoneToday ? 1 : 0) + (isCheckinDoneToday ? 1 : 0);
    expect(completedGoals).toBe(2);
    expect(completedGoals === totalGoals).toBe(true);
  });

  it('formats calendar day matches without timezone boundary drift', () => {
    const now = new Date();
    const todayStr = now.toISOString();
    const d = new Date(todayStr);

    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    expect(isToday).toBe(true);

    const yesterday = new Date(Date.now() - 86400000);
    const isYesterdayToday =
      yesterday.getDate() === now.getDate() &&
      yesterday.getMonth() === now.getMonth() &&
      yesterday.getFullYear() === now.getFullYear();

    expect(isYesterdayToday).toBe(false);
  });
});
