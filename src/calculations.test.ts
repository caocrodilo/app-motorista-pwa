import { describe, expect, it } from "vitest";
import { createEmptyRecord, createInitialSettings } from "./defaults";
import { calculateDailyTotals, calculateMonthlySummary } from "./calculations";

describe("Excel V2 calculation rules", () => {
  it("does not include horasFds in the daily total", () => {
    const settings = createInitialSettings();
    const record = {
      ...createEmptyRecord(settings.id, "2026-06-24"),
      horasFds: 8,
      diaFds: true,
    };

    const totals = calculateDailyTotals(record, settings);

    expect(totals.totalDia).toBe(settings.diaFds);
  });

  it("uses kmFds instead of kmInternacional when diaFds is selected", () => {
    const settings = createInitialSettings();
    const record = {
      ...createEmptyRecord(settings.id, "2026-06-24"),
      kmInt1Ini: 100,
      kmInt1Fim: 200,
      diaFds: true,
    };

    const totals = calculateDailyTotals(record, settings);

    expect(totals.valorKmInternacional).toBe(100 * settings.kmFds);
  });

  it("only counts km when start and end are filled", () => {
    const settings = createInitialSettings();
    const record = {
      ...createEmptyRecord(settings.id, "2026-06-24"),
      kmNac1Ini: 100,
      kmNac1Fim: null,
      kmNac2Ini: 0,
      kmNac2Fim: 20,
    };

    const totals = calculateDailyTotals(record, settings);

    expect(totals.totalKmNacional).toBe(20);
  });

  it("keeps historical records tied to their settings version", () => {
    const oldSettings = createInitialSettings();
    const newSettings = {
      ...oldSettings,
      id: "new",
      effectiveFrom: "2026-07-01",
      kmNacional: 1,
    };
    const oldRecord = {
      ...createEmptyRecord(oldSettings.id, "2026-06-24"),
      kmNac1Ini: 0,
      kmNac1Fim: 10,
    };
    const newRecord = {
      ...createEmptyRecord(newSettings.id, "2026-07-02"),
      kmNac1Ini: 0,
      kmNac1Fim: 10,
    };

    const june = calculateMonthlySummary([oldRecord, newRecord], [oldSettings, newSettings], 2026, "junho");
    const july = calculateMonthlySummary([oldRecord, newRecord], [oldSettings, newSettings], 2026, "julho");

    expect(june.ajudas).toBe(10 * oldSettings.kmNacional);
    expect(july.ajudas).toBe(10 * newSettings.kmNacional);
  });
});
