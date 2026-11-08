import type { DailyRecord, SettingsVersion } from "./types";

export function isValidEffectiveDate(date: string) {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}

export function settingsChangeRecords(records: DailyRecord[], versions: SettingsVersion[], from: string) {
  if (!isValidEffectiveDate(from)) throw new Error("Escolhe uma data de entrada em vigor válida.");
  const nextDate = versions.map(version => version.effectiveFrom).filter(date => date > from).sort()[0];
  return {
    nextDate,
    records: records.filter(record => record.data >= from && (!nextDate || record.data < nextDate)),
  };
}

export function planSettingsChange(records: DailyRecord[], versions: SettingsVersion[], draft: SettingsVersion) {
  if (versions.some(version => version.id === draft.id)) throw new Error("Esta alteração precisa de uma nova versão de valores.");
  const affected = settingsChangeRecords(records, versions, draft.effectiveFrom);
  const previousTimestamp = Math.max(0, ...versions.filter(version => version.effectiveFrom === draft.effectiveFrom).map(version => Date.parse(version.updatedAt) || 0));
  const updatedAt = new Date(Math.max(Date.parse(draft.updatedAt) || Date.now(), previousTimestamp + 1)).toISOString();
  const version = { ...draft, updatedAt };
  return {
    version,
    records: affected.records.map(record => ({ ...record, settingsVersionId: version.id, updatedAt })),
  };
}
