import { MONTHS } from "./defaults";
import type { DailyRecord, DailyTotals, MonthName, MonthlySummary, SettingsVersion } from "./types";

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const resolveSettingsForDate = (versions: SettingsVersion[], dateIso: string) => {
  const eligible = versions
    .filter((version) => version.effectiveFrom <= dateIso)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  return eligible[0] ?? versions.slice().sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
};

export const calculateDailyTotals = (record: DailyRecord, settings: SettingsVersion): DailyTotals => {
  const totalKmNacional = record.kmNac1Fim - record.kmNac1Ini + record.kmNac2Fim - record.kmNac2Ini;
  const totalKmInternacional = record.kmInt1Fim - record.kmInt1Ini + record.kmInt2Fim - record.kmInt2Ini;
  const totalKmAdr = record.kmAdrFim - record.kmAdrIni;
  const valorKmNacional = totalKmNacional * settings.kmNacional;
  const valorKmInternacional = totalKmInternacional * (record.diaFds ? settings.kmFds : settings.kmInternacional);
  const valorKmAdr = totalKmAdr * settings.kmAdr;
  const valorDiaAdr = record.diaAdr ? settings.diaAdr : 0;
  const valorRefeicoes =
    (record.peqAlmoco ? settings.peqAlmoco : 0) +
    (record.almoco ? settings.almoco : 0) +
    (record.jantar ? settings.jantar : 0) +
    (record.ceia ? settings.ceia : 0);
  const valorDescargas =
    (record.descargaIntermedia ? settings.descargaIntermedia : 0) +
    record.descargaExtra * settings.descargaExtra +
    (record.descargaNoturna ? settings.descargaNoturna : 0);
  const valorVirada = record.virada ? settings.virada : 0;
  const valorDiaFds = record.diaFds ? settings.diaFds : 0;
  const totalDia =
    valorKmNacional +
    valorKmInternacional +
    valorKmAdr +
    valorDiaAdr +
    valorRefeicoes +
    valorDescargas +
    valorVirada +
    valorDiaFds;

  return {
    totalKmNacional,
    totalKmInternacional,
    totalKmAdr,
    valorKmNacional,
    valorKmInternacional,
    valorKmAdr,
    valorDiaAdr,
    valorRefeicoes,
    valorDescargas,
    valorVirada,
    valorDiaFds,
    totalDia,
  };
};

export const calculateMonthlySummary = (
  records: DailyRecord[],
  settingsVersions: SettingsVersion[],
  year: number,
  month: MonthName,
): MonthlySummary => {
  const monthRecords = records.filter((record) => record.ano === year && record.mes === month);
  const monthEnd = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-31`;
  const salarySettings = resolveSettingsForDate(settingsVersions, monthEnd);

  const horasFds = monthRecords.reduce((sum, record) => sum + record.horasFds, 0);
  const valorHorasFds = horasFds * salarySettings.horaFds;
  const salarioBruto =
    salarySettings.base +
    salarySettings.diuturnidades +
    salarySettings.complementoSalarial +
    salarySettings.tir +
    salarySettings.clausula61 +
    salarySettings.noturno +
    valorHorasFds;
  const valorIrs = salarioBruto * salarySettings.irs;
  const valorSs = salarioBruto * salarySettings.ss;
  const salarioLiquido = salarioBruto - valorIrs - valorSs;
  const ajudas = monthRecords.reduce((sum, record) => {
    const settings = settingsVersions.find((item) => item.id === record.settingsVersionId) ?? resolveSettingsForDate(settingsVersions, record.data);
    return sum + calculateDailyTotals(record, settings).totalDia;
  }, 0);
  const folgasGanhas = monthRecords.reduce((sum, record) => {
    if (record.diaFolga === "Ganha") return sum + 1;
    if (record.diaFolga === "Ganha 1/2") return sum + 0.5;
    return sum;
  }, 0);
  const folgasGastas = monthRecords.reduce((sum, record) => {
    if (record.diaFolga === "Gasta") return sum + 1;
    if (record.diaFolga === "Gasta 1/2") return sum + 0.5;
    return sum;
  }, 0);

  return {
    ano: year,
    mes: month,
    horasFds,
    valorHorasFds,
    salarioBruto,
    valorIrs,
    valorSs,
    salarioLiquido,
    ajudas,
    folgasGanhas,
    folgasGastas,
    totalFinal: salarioLiquido + ajudas,
  };
};

export const calculateYearSummaries = (records: DailyRecord[], settingsVersions: SettingsVersion[], year: number) =>
  MONTHS.map((month) => calculateMonthlySummary(records, settingsVersions, year, month));

export const calculateDayOffBalance = (records: DailyRecord[]) => {
  const folgasGanhas = records.reduce((sum, record) => {
    if (record.diaFolga === "Ganha") return sum + 1;
    if (record.diaFolga === "Ganha 1/2") return sum + 0.5;
    return sum;
  }, 0);
  const folgasGastas = records.reduce((sum, record) => {
    if (record.diaFolga === "Gasta") return sum + 1;
    if (record.diaFolga === "Gasta 1/2") return sum + 0.5;
    return sum;
  }, 0);

  return {
    folgasGanhas,
    folgasGastas,
    saldo: folgasGanhas - folgasGastas,
  };
};
