import type { DailyRecord, OvernightType } from "./types";

export const OVERNIGHT_OPTIONS = [
  { value: "casa", label: "Pernoita em casa" },
  { value: "saida-domingo", label: "Saída Domingo" },
  { value: "fds", label: "Pernoita FDS" },
] as const;

export type OvernightDays = Map<string, Exclude<OvernightType, "">[]>;

export function buildOvernightDays(records: Pick<DailyRecord, "data" | "pernoita">[]): OvernightDays {
  const days: OvernightDays = new Map();
  for (const record of records) {
    const type = record.pernoita;
    if (!type || !OVERNIGHT_OPTIONS.some((option) => option.value === type)) continue;
    const timestamp = Date.parse(`${record.data}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.data) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== record.data) continue;
    const types = days.get(record.data) ?? [];
    if (!types.includes(type)) types.push(type);
    days.set(record.data, types);
  }
  return days;
}

export function summarizeOvernights(days: OvernightDays, year: number) {
  const inYear = (date: string) => date.startsWith(`${year}-`);
  const summary = { casa: 0, saidaDomingo: 0, fds: 0 };
  const fdsDates: string[] = [];
  for (const [date, types] of days) {
    if (inYear(date)) {
      if (types.includes("casa")) summary.casa += 1;
      if (types.includes("saida-domingo")) summary.saidaDomingo += 1;
    }
    if (types.includes("fds")) fdsDates.push(date);
  }
  fdsDates.sort();
  let previousDay: number | undefined;
  let runLength = 0;
  for (const date of fdsDates) {
    const day = Date.parse(`${date}T00:00:00Z`) / 86400000;
    runLength = previousDay !== undefined && day === previousDay + 1 ? runLength + 1 : 1;
    // A run of two or more days counts once, in the year of its second day.
    if (runLength === 2 && inYear(date)) summary.fds += 1;
    previousDay = day;
  }
  return summary;
}
