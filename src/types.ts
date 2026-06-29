export type MonthName =
  | "janeiro"
  | "fevereiro"
  | "março"
  | "abril"
  | "maio"
  | "junho"
  | "julho"
  | "agosto"
  | "setembro"
  | "outubro"
  | "novembro"
  | "dezembro";

export type ServiceType = "" | "D" | "C" | "TR";
export type DayOffType = "" | "Ganha" | "Gasta" | "Ganha 1/2" | "Gasta 1/2";
export type KmValue = number | null;

export type SettingsValues = {
  base: number;
  diuturnidades: number;
  complementoSalarial: number;
  tir: number;
  clausula61: number;
  noturno: number;
  irs: number;
  ss: number;
  horaFds: number;
  diaFds: number;
  diaAdr: number;
  kmNacional: number;
  kmInternacional: number;
  kmAdr: number;
  kmFds: number;
  peqAlmoco: number;
  almoco: number;
  jantar: number;
  ceia: number;
  descargaIntermedia: number;
  descargaExtra: number;
  descargaNoturna: number;
  virada: number;
};

export type SettingsVersion = SettingsValues & {
  id: string;
  effectiveFrom: string;
  label: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyRecord = {
  id: string;
  data: string;
  ano: number;
  mes: MonthName;
  dia: number;
  localInicio: string;
  localFim: string;
  horaInicio: string;
  horaFim: string;
  kmNac1Ini: KmValue;
  kmNac1Fim: KmValue;
  kmNac2Ini: KmValue;
  kmNac2Fim: KmValue;
  kmInt1Ini: KmValue;
  kmInt1Fim: KmValue;
  kmInt2Ini: KmValue;
  kmInt2Fim: KmValue;
  diaAdr: boolean;
  kmAdrIni: KmValue;
  kmAdrFim: KmValue;
  peqAlmoco: boolean;
  almoco: boolean;
  jantar: boolean;
  ceia: boolean;
  descargaIntermedia: boolean;
  descargaExtra: number;
  descargaNoturna: boolean;
  virada: boolean;
  diaFds: boolean;
  horasFds: number;
  tipo1: ServiceType;
  cliente1: string;
  local1: string;
  tipo2: ServiceType;
  cliente2: string;
  local2: string;
  tipo3: ServiceType;
  cliente3: string;
  local3: string;
  tipo4: ServiceType;
  cliente4: string;
  local4: string;
  tipo5: ServiceType;
  cliente5: string;
  local5: string;
  diaFolga: DayOffType;
  observacoes: string;
  settingsVersionId: string;
  createdAt: string;
  updatedAt: string;
};

export type DailyTotals = {
  totalKmNacional: number;
  totalKmInternacional: number;
  totalKmAdr: number;
  valorKmNacional: number;
  valorKmInternacional: number;
  valorKmAdr: number;
  valorDiaAdr: number;
  valorRefeicoes: number;
  valorDescargas: number;
  valorVirada: number;
  valorDiaFds: number;
  totalDia: number;
};

export type MonthlySummary = {
  ano: number;
  mes: MonthName;
  horasFds: number;
  valorHorasFds: number;
  salarioBruto: number;
  valorIrs: number;
  valorSs: number;
  salarioLiquido: number;
  ajudas: number;
  folgasGanhas: number;
  folgasGastas: number;
  totalFinal: number;
};

export type AppData = {
  settingsVersions: SettingsVersion[];
  dailyRecords: DailyRecord[];
  userProfile: UserProfile | null;
};

export type UserProfile = {
  id: string;
  numeroFuncionario: string;
  nomeCompleto: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};
