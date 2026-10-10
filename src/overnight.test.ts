import { describe, expect, it } from "vitest";
import { buildOvernightDays, summarizeOvernights } from "./overnight";
import { calculateDailyTotals, calculateMonthlySummary } from "./calculations";
import { createEmptyRecord, createInitialSettings } from "./defaults";
import type { OvernightType } from "./types";

const record = (data: string, pernoita?: OvernightType) => ({ data, pernoita });
const summary = (records: ReturnType<typeof record>[], year = 2026) => summarizeOvernights(buildOvernightDays(records), year);

describe("overnight calendar", () => {
  it("keeps legacy and unfilled records unmarked", () => {
    expect(summary([record("2026-10-01"), record("2026-10-02", "")])).toEqual({ casa: 0, saidaDomingo: 0, fds: 0 });
  });

  it("counts home nights and Sunday departures by distinct date", () => {
    expect(summary([record("2026-10-01", "casa"), record("2026-10-01", "casa"), record("2026-10-02", "saida-domingo"), record("2025-10-02", "casa")])).toEqual({ casa: 1, saidaDomingo: 1, fds: 0 });
  });

  it.each([1, 2, 3, 4, 7])("counts a run of %i FDS days once only when at least two days", (length) => {
    const records = Array.from({ length }, (_, index) => record(`2026-10-${String(index + 1).padStart(2, "0")}`, "fds"));
    expect(summary(records).fds).toBe(length < 2 ? 0 : 1);
  });

  it("separates runs and ignores isolated days and duplicate records", () => {
    const dates = ["2026-10-01", "2026-10-01", "2026-10-02", "2026-10-04", "2026-10-06", "2026-10-07", "2026-10-08"];
    expect(summary(dates.reverse().map(date => record(date, "fds"))).fds).toBe(2);
  });

  it("joins runs across months, leap days, DST and year boundaries", () => {
    expect(summary([record("2026-01-31", "fds"), record("2026-02-01", "fds")]).fds).toBe(1);
    expect(summary([record("2024-02-28", "fds"), record("2024-02-29", "fds"), record("2024-03-01", "fds")], 2024).fds).toBe(1);
    expect(summary([record("2026-03-28", "fds"), record("2026-03-29", "fds"), record("2026-03-30", "fds")]).fds).toBe(1);
    const crossing = [record("2025-12-31", "fds"), record("2026-01-01", "fds"), record("2026-01-02", "fds")];
    expect(summary(crossing, 2025).fds).toBe(0);
    expect(summary(crossing, 2026).fds).toBe(1);
  });

  it("does not join across an unmarked or differently marked day", () => {
    expect(summary([record("2026-10-01", "fds"), record("2026-10-02", "casa"), record("2026-10-03", "fds")]).fds).toBe(0);
  });

  it("ignores malformed dates and unsupported types from backups", () => {
    expect(summary([record("2026-02-30", "fds"), record("bad", "fds"), record("2026-10-01", "unknown" as OvernightType)])).toEqual({ casa: 0, saidaDomingo: 0, fds: 0 });
  });

  it("keeps payroll and daily totals unchanged for all overnight types", () => {
    const settings = createInitialSettings();
    const daily = { ...createEmptyRecord(settings.id, "2026-10-01"), kmNac1Ini: 100, kmNac1Fim: 360, almoco: true, diaFds: true, horasFds: 8, diaAdr: true, descargaExtra: 2 };
    const dailyTotals = calculateDailyTotals(daily, settings);
    const monthlyTotals = calculateMonthlySummary([daily], [settings], 2026, "outubro");
    for (const pernoita of ["", "casa", "saida-domingo", "fds"] as OvernightType[]) {
      expect(calculateDailyTotals({ ...daily, pernoita }, settings)).toEqual(dailyTotals);
      expect(calculateMonthlySummary([{ ...daily, pernoita }], [settings], 2026, "outubro")).toEqual(monthlyTotals);
    }
  });
});
