import type { DailyRecord, MonthName, SettingsValues, SettingsVersion } from "./types";

export const MONTHS: MonthName[] = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export const DEFAULT_SETTINGS_VALUES: SettingsValues = {
  base: 1014.02,
  diuturnidades: 24.63,
  complementoSalarial: 50.7,
  tir: 135,
  clausula61: 522.89,
  noturno: 101.4,
  horaFds: 9.08,
  diaFds: 43,
  irs: 0.1144,
  ss: 0.11,
  kmInternacional: 0.09,
  kmNacional: 0.013,
  kmAdr: 0.12,
  kmFds: 0.04,
  descargaIntermedia: 15,
  descargaExtra: 5,
  descargaNoturna: 15,
  virada: 20,
  peqAlmoco: 3.05,
  almoco: 10,
  jantar: 10,
  ceia: 3.05,
  diaAdr: 7.5,
};

export const HOURS_FDS_OPTIONS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8,
];

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const dateParts = (dateIso: string) => {
  const [year, month, day] = dateIso.split("-").map(Number);
  return {
    ano: year,
    mes: MONTHS[month - 1],
    dia: day,
  };
};

export const createInitialSettings = (): SettingsVersion => {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    effectiveFrom: `${new Date().getFullYear()}-01-01`,
    label: `Valores ${new Date().getFullYear()}`,
    active: true,
    ...DEFAULT_SETTINGS_VALUES,
    createdAt: now,
    updatedAt: now,
  };
};

export const createEmptyRecord = (settingsVersionId: string, date = todayIso()): DailyRecord => {
  const now = new Date().toISOString();
  const parts = dateParts(date);

  return {
    id: crypto.randomUUID(),
    data: date,
    ...parts,
    localInicio: "",
    localFim: "",
    horaInicio: "",
    horaFim: "",
    kmNac1Ini: null,
    kmNac1Fim: null,
    kmNac2Ini: null,
    kmNac2Fim: null,
    kmInt1Ini: null,
    kmInt1Fim: null,
    kmInt2Ini: null,
    kmInt2Fim: null,
    diaAdr: false,
    kmAdrIni: null,
    kmAdrFim: null,
    peqAlmoco: false,
    almoco: false,
    jantar: false,
    ceia: false,
    descargaIntermedia: false,
    descargaExtra: 0,
    descargaNoturna: false,
    virada: false,
    diaFds: false,
    horasFds: 0,
    tipo1: "",
    cliente1: "",
    local1: "",
    tipo2: "",
    cliente2: "",
    local2: "",
    tipo3: "",
    cliente3: "",
    local3: "",
    tipo4: "",
    cliente4: "",
    local4: "",
    tipo5: "",
    cliente5: "",
    local5: "",
    diaFolga: "",
    observacoes: "",
    settingsVersionId,
    createdAt: now,
    updatedAt: now,
  };
};
