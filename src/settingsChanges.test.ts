import { describe, expect, it } from "vitest";
import { calculateDailyTotals, calculateMonthlySummary, calculateWeekendHoursBreakdown, resolveSettingsForDate } from "./calculations";
import { createEmptyRecord, createInitialSettings } from "./defaults";
import { isValidEffectiveDate, planSettingsChange } from "./settingsChanges";

const initial = { ...createInitialSettings(), id: "initial", effectiveFrom: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", almoco: 10, horaFds: 5, base: 1000 };
const version = (effectiveFrom: string, id = "new") => ({ ...initial, id, effectiveFrom, almoco: 20, horaFds: 8, base: 2000, createdAt: "2026-11-08T10:00:00.000Z", updatedAt: "2026-11-08T10:00:00.000Z" });
const record = (date: string) => ({ ...createEmptyRecord(initial.id, date), almoco: true, horasFds: 2, numeroCarro: "0007", pernoita: "casa" as const, observacoes: "Manter", cliente1: "Cliente" });

describe("settings effective date", () => {
  it.each(["", "2026-02-30", "2026-13-01", "2026-2-1", "invalid"])("rejects invalid date %s", date => {
    expect(isValidEffectiveDate(date)).toBe(false);
    expect(() => planSettingsChange([], [initial], version(date))).toThrow();
  });

  it("accepts leap days and past or future dates", () => {
    for (const date of ["2024-02-29", "2025-01-01", "2030-12-31"]) expect(isValidEffectiveDate(date)).toBe(true);
  });

  it("updates the selected day inclusively, keeping all earlier data untouched", () => {
    const before = record("2026-06-14");
    const on = record("2026-06-15");
    const after = record("2026-06-30");
    const snapshot = structuredClone([before, on, after]);
    const plan = planSettingsChange([before, on, after], [initial], version("2026-06-15"));
    expect(plan.records.map(item => item.data)).toEqual(["2026-06-15", "2026-06-30"]);
    expect([before, on, after]).toEqual(snapshot);
    expect(plan.records[0]).toEqual({ ...on, settingsVersionId: "new", updatedAt: plan.version.updatedAt });
    expect(calculateDailyTotals(before, initial).totalDia).toBe(10);
    expect(calculateDailyTotals(plan.records[0], plan.version).totalDia).toBe(20);
  });

  it("keeps the next saved version and its records at that date", () => {
    const later = version("2026-07-01", "later");
    const plan = planSettingsChange([record("2026-06-30"), record("2026-07-01"), record("2026-07-02")], [initial, later], version("2026-06-15"));
    expect(plan.records.map(item => item.data)).toEqual(["2026-06-30"]);
  });

  it("schedules future values without changing current records", () => {
    const scheduled = version("2030-01-01");
    const plan = planSettingsChange([record("2026-06-01")], [initial], scheduled);
    expect(plan.records).toEqual([]);
    expect(resolveSettingsForDate([initial, plan.version], "2026-11-08").id).toBe(initial.id);
    expect(resolveSettingsForDate([initial, plan.version], "2030-01-01").id).toBe(scheduled.id);
  });

  it("uses the new revision for the same effective date and preserves older linked records", () => {
    const old = record("2025-12-31");
    const replacement = version(initial.effectiveFrom);
    const plan = planSettingsChange([old, record("2026-01-01")], [initial], replacement);
    expect(plan.records).toHaveLength(1);
    expect(resolveSettingsForDate([plan.version, initial], "2026-01-01").id).toBe("new");
    expect(resolveSettingsForDate([initial, plan.version], "2026-01-01").id).toBe("new");
    expect(resolveSettingsForDate([initial, plan.version], "2025-12-31").id).toBe("initial");
    expect(old.settingsVersionId).toBe("initial");
  });

  it("makes same-date revisions unambiguous even with equal timestamps", () => {
    const plan = planSettingsChange([], [initial], { ...version(initial.effectiveFrom), updatedAt: initial.updatedAt });
    expect(plan.version.updatedAt > initial.updatedAt).toBe(true);
    expect(resolveSettingsForDate([plan.version, initial], initial.effectiveFrom).id).toBe("new");
  });

  it("preserves the baseline before a newly backdated earliest version", () => {
    expect(resolveSettingsForDate([initial, version("2025-11-15")], "2025-10-31").id).toBe("initial");
  });

  it("does not overwrite an existing version", () => {
    expect(() => planSettingsChange([], [initial], { ...version("2026-06-15"), id: initial.id })).toThrow();
  });

  it("prices weekend hours by day and keeps the month-end fixed salary rule", () => {
    const before = record("2026-06-14");
    const on = record("2026-06-15");
    const plan = planSettingsChange([before, on], [initial], version("2026-06-15"));
    const records = [before, ...plan.records];
    const versions = [initial, plan.version];
    expect(calculateWeekendHoursBreakdown(records, versions)).toEqual([{ rate: 5, hours: 2, value: 10 }, { rate: 8, hours: 2, value: 16 }]);
    const summary = calculateMonthlySummary(records, versions, 2026, "junho");
    expect(summary.valorHorasFds).toBe(26);
    expect(summary.ajudas).toBe(30);
    expect(summary.salarioBruto).toBe(2000 + initial.diuturnidades + initial.complementoSalarial + initial.tir + initial.clausula61 + initial.noturno + 26);
    expect(calculateMonthlySummary([], versions, 2026, "maio").salarioBruto).toBe(1000 + initial.diuturnidades + initial.complementoSalarial + initial.tir + initial.clausula61 + initial.noturno);
  });
});
