import { useEffect, useMemo, useState } from "react";
import {
  calculateDailyTotals,
  calculateDayOffBalance,
  calculateMonthlySummary,
  calculateYearSummaries,
  resolveSettingsForDate,
  roundMoney,
} from "./calculations";
import { hashPassword, verifyPassword } from "./auth";
import { createEmptyRecord, dateParts, HOURS_FDS_OPTIONS, MONTHS, todayIso } from "./defaults";
import { deleteDailyRecord, loadAppData, replaceAppData, saveDailyRecord, saveSettingsVersion, saveUserProfile } from "./db";
import { eur, monthLabel, number, shortDate } from "./format";
import type { AppData, DailyRecord, DayOffType, KmValue, MonthName, ServiceType, SettingsVersion, SettingsValues, UserProfile } from "./types";

type View = "dashboard" | "daily" | "monthly" | "folgas" | "settings";

const emptyData: AppData = {
  settingsVersions: [],
  dailyRecords: [],
  userProfile: null,
};

const SESSION_KEY = "app-motorista-session";
const SETTINGS_PIN = "0000";
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const settingFields: { key: keyof SettingsValues; label: string; step?: string }[] = [
  { key: "base", label: "Base" },
  { key: "diuturnidades", label: "Diuturnidades" },
  { key: "complementoSalarial", label: "Complemento Salarial" },
  { key: "tir", label: "TIR" },
  { key: "clausula61", label: "Cláusula 61" },
  { key: "noturno", label: "Noturno" },
  { key: "irs", label: "Taxa IRS", step: "0.0001" },
  { key: "ss", label: "Taxa SS", step: "0.0001" },
  { key: "horaFds", label: "Hora FDS" },
  { key: "diaFds", label: "Dia FDS" },
  { key: "diaAdr", label: "Dia ADR" },
  { key: "kmNacional", label: "Km Nacional", step: "0.001" },
  { key: "kmInternacional", label: "Km Internacional", step: "0.001" },
  { key: "kmAdr", label: "Km ADR", step: "0.001" },
  { key: "kmFds", label: "Km FDS", step: "0.001" },
  { key: "peqAlmoco", label: "Pequeno-almoço" },
  { key: "almoco", label: "Almoço" },
  { key: "jantar", label: "Jantar" },
  { key: "ceia", label: "Ceia" },
  { key: "descargaIntermedia", label: "Descarga Intermédia" },
  { key: "descargaExtra", label: "Descarga Extra" },
  { key: "descargaNoturna", label: "Descarga Noturna" },
  { key: "virada", label: "Virada" },
];

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [data, setData] = useState<AppData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingRecord, setEditingRecord] = useState<DailyRecord | null>(null);
  const [authenticated, setAuthenticated] = useState(sessionStorage.getItem(SESSION_KEY) === "ok");
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);

  const refresh = async () => {
    const loaded = await loadAppData();
    setData(loaded);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const activeSettings = data.settingsVersions[data.settingsVersions.length - 1];
  const todayParts = dateParts(todayIso());
  const dashboardSummary =
    activeSettings && calculateMonthlySummary(data.dailyRecords, data.settingsVersions, selectedYear, todayParts.mes);
  const yearSummaries = useMemo(
    () => (activeSettings ? calculateYearSummaries(data.dailyRecords, data.settingsVersions, selectedYear) : []),
    [activeSettings, data.dailyRecords, data.settingsVersions, selectedYear],
  );
  const dayOffBalance = useMemo(() => calculateDayOffBalance(data.dailyRecords), [data.dailyRecords]);
  const years = Array.from(
    new Set([new Date().getFullYear(), ...data.dailyRecords.map((record) => record.ano), ...data.settingsVersions.map((item) => Number(item.effectiveFrom.slice(0, 4)))]),
  ).sort((a, b) => b - a);

  const startNewRecord = () => {
    if (!activeSettings) return;
    const record = createEmptyRecord(activeSettings.id);
    setEditingRecord(record);
    goToView("daily");
  };

  const saveRecord = async (record: DailyRecord) => {
    await saveDailyRecord({ ...record, updatedAt: new Date().toISOString() });
    await refresh();
    setEditingRecord(null);
    goToView("dashboard");
  };

  const removeRecord = async (id: string) => {
    await deleteDailyRecord(id);
    await refresh();
    setEditingRecord(null);
  };

  const createSettingsVersion = async (draft: SettingsVersion) => {
    await saveSettingsVersion({ ...draft, updatedAt: new Date().toISOString() });
    await refresh();
  };

  const createUser = async (
    profile: Omit<UserProfile, "id" | "passwordHash" | "createdAt" | "updatedAt"> & { password: string },
  ) => {
    const now = new Date().toISOString();
    await saveUserProfile({
      id: crypto.randomUUID(),
      numeroFuncionario: profile.numeroFuncionario.trim(),
      nomeCompleto: profile.nomeCompleto.trim(),
      username: profile.username.trim(),
      passwordHash: await hashPassword(profile.password),
      createdAt: now,
      updatedAt: now,
    });
    sessionStorage.setItem(SESSION_KEY, "ok");
    setAuthenticated(true);
    await refresh();
  };

  const login = async (username: string, password: string) => {
    if (!data.userProfile) return false;
    const validUser = username.trim() === data.userProfile.username;
    const validPassword = await verifyPassword(password, data.userProfile.passwordHash);
    if (!validUser || !validPassword) return false;
    sessionStorage.setItem(SESSION_KEY, "ok");
    setAuthenticated(true);
    return true;
  };

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
    setSettingsUnlocked(false);
    setView("dashboard");
  };

  const exportBackup = () => {
    const payload = {
      app: "app-motorista-pwa",
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `app-motorista-backup-${todayIso()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importBackup = async (file: File) => {
    const text = await file.text();
    const payload = JSON.parse(text) as { app?: string; data?: AppData };
    if (payload.app !== "app-motorista-pwa" || !payload.data?.settingsVersions || !payload.data?.dailyRecords) {
      throw new Error("Ficheiro de backup inválido.");
    }
    await replaceAppData(payload.data);
    sessionStorage.setItem(SESSION_KEY, "ok");
    setAuthenticated(true);
    setSettingsUnlocked(false);
    await refresh();
  };

  function goToView(nextView: View) {
    if (view === "settings" && nextView !== "settings") setSettingsUnlocked(false);
    setView(nextView);
  }

  if (loading || !activeSettings) {
    return (
      <main className="app-shell">
        <div className="loading">A preparar dados offline...</div>
      </main>
    );
  }

  if (!data.userProfile) {
    return <AuthStartScreen onCreate={createUser} onImportBackup={importBackup} />;
  }

  if (!authenticated) {
    return <LoginScreen profile={data.userProfile} onLogin={login} />;
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">App Motorista</p>
          <h1>{viewTitle(view)}</h1>
        </div>
        <div className="top-actions">
          <select value={selectedYear} onChange={(event) => setSelectedYear(Number(event.target.value))} aria-label="Ano">
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button type="button" onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      {view === "dashboard" && dashboardSummary && (
        <Dashboard
          summary={dashboardSummary}
          balance={dayOffBalance}
          records={data.dailyRecords}
          settingsVersions={data.settingsVersions}
          onNew={startNewRecord}
          onEdit={(record) => {
            setEditingRecord(record);
            goToView("daily");
          }}
          onNavigate={goToView}
        />
      )}

      {view === "daily" && (
        <DailyForm
          record={editingRecord ?? createEmptyRecord(resolveSettingsForDate(data.settingsVersions, todayIso()).id)}
          settingsVersions={data.settingsVersions}
          onCancel={() => {
            setEditingRecord(null);
            goToView("dashboard");
          }}
          onDelete={removeRecord}
          onSave={saveRecord}
        />
      )}

      {view === "monthly" && (
        <MonthlyView
          summaries={yearSummaries}
          records={data.dailyRecords}
          settingsVersions={data.settingsVersions}
          year={selectedYear}
        />
      )}

      {view === "folgas" && <FolgasView records={data.dailyRecords} balance={dayOffBalance} />}

      {view === "settings" && !settingsUnlocked && <SettingsPinGate onUnlock={() => setSettingsUnlocked(true)} />}
      {view === "settings" && settingsUnlocked && (
        <SettingsView
          activeSettings={activeSettings}
          versions={data.settingsVersions}
          onSave={createSettingsVersion}
          onExportBackup={exportBackup}
          onImportBackup={importBackup}
        />
      )}

      <nav className="bottom-nav" aria-label="Menu principal">
        <button className={view === "dashboard" ? "active" : ""} onClick={() => goToView("dashboard")}>
          Início
        </button>
        <button className={view === "daily" ? "active" : ""} onClick={startNewRecord}>
          Diário
        </button>
        <button className={view === "monthly" ? "active" : ""} onClick={() => goToView("monthly")}>
          Mensal
        </button>
        <button className={view === "folgas" ? "active" : ""} onClick={() => goToView("folgas")}>
          Folgas
        </button>
        <button className={view === "settings" ? "active" : ""} onClick={() => goToView("settings")}>
          Def.
        </button>
      </nav>
    </main>
  );
}

function AuthStartScreen({
  onCreate,
  onImportBackup,
}: {
  onCreate: (profile: Omit<UserProfile, "id" | "passwordHash" | "createdAt" | "updatedAt"> & { password: string }) => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
}) {
  const [mode, setMode] = useState<"start" | "new" | "existing">("start");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  if (mode === "new") {
    return <RegisterScreen onCreate={onCreate} onImportBackup={onImportBackup} onBack={() => setMode("start")} />;
  }

  if (mode === "existing") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <button className="text-button" type="button" onClick={() => setMode("start")}>
            Voltar
          </button>
          <p className="eyebrow">Utilizador existente</p>
          <h1>Entrar com dados guardados</h1>
          <p className="muted">
            Neste dispositivo ainda não existe utilizador local. Para entrar com um utilizador já existente,
            importa o backup JSON criado noutro telemóvel/browser.
          </p>
          <label className="file-button full-width">
            Importar backup JSON
            <input
              type="file"
              accept="application/json,.json"
              disabled={importing}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  setImporting(true);
                  setError("");
                  await onImportBackup(file);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Não foi possível importar o backup.");
                } finally {
                  setImporting(false);
                }
              }}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">App Motorista</p>
        <h1>Como queres entrar?</h1>
        <div className="choice-grid">
          <button className="primary-action" type="button" onClick={() => setMode("new")}>
            Novo utilizador
          </button>
          <button type="button" onClick={() => setMode("existing")}>
            Login existente
          </button>
        </div>
        <p className="muted">
          Se já tinhas dados noutro dispositivo, usa “Login existente” e importa o backup JSON.
        </p>
      </section>
    </main>
  );
}

function RegisterScreen({
  onCreate,
  onImportBackup,
  onBack,
}: {
  onCreate: (profile: Omit<UserProfile, "id" | "passwordHash" | "createdAt" | "updatedAt"> & { password: string }) => Promise<void>;
  onImportBackup: (file: File) => Promise<void>;
  onBack: () => void;
}) {
  const [numeroFuncionario, setNumeroFuncionario] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  return (
    <main className="auth-shell">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!numeroFuncionario.trim() || !nomeCompleto.trim() || !username.trim() || !password) {
            setError("Preenche todos os campos obrigatórios.");
            return;
          }
          await onCreate({ numeroFuncionario, nomeCompleto, username, password });
        }}
      >
        <button className="text-button" type="button" onClick={onBack}>
          Voltar
        </button>
        <p className="eyebrow">Primeiro acesso</p>
        <h1>Criar utilizador</h1>
        <label>
          Número de funcionário
          <input value={numeroFuncionario} onChange={(event) => setNumeroFuncionario(event.target.value)} required />
        </label>
        <label>
          Nome completo
          <input value={nomeCompleto} onChange={(event) => setNomeCompleto(event.target.value)} required />
        </label>
        <label>
          Utilizador
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" type="submit">
          Criar e entrar
        </button>
        <div className="backup-actions">
          <span>Já tens backup?</span>
          <label className="file-button">
            Importar backup
            <input
              type="file"
              accept="application/json,.json"
              disabled={importing}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  setImporting(true);
                  setError("");
                  await onImportBackup(file);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Não foi possível importar o backup.");
                } finally {
                  setImporting(false);
                }
              }}
            />
          </label>
        </div>
      </form>
    </main>
  );
}

function LoginScreen({
  profile,
  onLogin,
}: {
  profile: UserProfile;
  onLogin: (username: string, password: string) => Promise<boolean>;
}) {
  const [username, setUsername] = useState(profile.username);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="auth-shell">
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          const ok = await onLogin(username, password);
          if (!ok) setError("Utilizador ou password incorretos.");
        }}
      >
        <p className="eyebrow">App Motorista</p>
        <h1>Entrar</h1>
        <div className="profile-note">
          <strong>{profile.nomeCompleto}</strong>
          <span>Funcionário {profile.numeroFuncionario}</span>
        </div>
        <label>
          Utilizador
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" autoFocus />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" type="submit">
          Entrar
        </button>
      </form>
    </main>
  );
}

function SettingsPinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="screen">
      <form
        className="panel pin-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (pin === SETTINGS_PIN) {
            onUnlock();
            return;
          }
          setError("PIN incorreto.");
        }}
      >
        <h2>Definições protegidas</h2>
        <p className="muted">Introduz o PIN para alterar valores de referência.</p>
        <label>
          PIN
          <input type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} autoFocus />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-action" type="submit">
          Desbloquear
        </button>
      </form>
    </section>
  );
}

function Dashboard({
  summary,
  balance,
  records,
  settingsVersions,
  onNew,
  onEdit,
  onNavigate,
}: {
  summary: ReturnType<typeof calculateMonthlySummary>;
  balance: ReturnType<typeof calculateDayOffBalance>;
  records: DailyRecord[];
  settingsVersions: SettingsVersion[];
  onNew: () => void;
  onEdit: (record: DailyRecord) => void;
  onNavigate: (view: View) => void;
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = records.filter((record) => {
    if (!normalizedQuery) return true;
    return [
      record.data,
      record.mes,
      record.localInicio,
      record.localFim,
      record.cliente1,
      record.cliente2,
      record.cliente3,
      record.cliente4,
      record.cliente5,
      record.local1,
      record.local2,
      record.local3,
      record.local4,
      record.local5,
      record.observacoes,
      record.diaFolga,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });

  return (
    <section className="screen">
      <div className="summary-grid">
        <Metric label={`Ajudas de ${monthLabel(summary.mes)}`} value={eur.format(roundMoney(summary.ajudas))} />
        <Metric label="Horas FDS" value={number.format(summary.horasFds)} />
        <Metric label="Folgas ganhas" value={number.format(balance.folgasGanhas)} />
        <Metric label="Saldo folgas" value={number.format(balance.saldo)} />
      </div>

      <div className="action-grid">
        <button className="primary-action" onClick={onNew}>
          Registo Diário
        </button>
        <button onClick={() => onNavigate("monthly")}>Registo Mensal</button>
        <button onClick={() => onNavigate("folgas")}>Banco de Folgas</button>
        <button onClick={() => onNavigate("settings")}>Definições</button>
        <button disabled>Folhas do Mês</button>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h2>Registos</h2>
          <span>{filteredRecords.length}</span>
        </div>
        <label className="search-field">
          <span>Pesquisar registos</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar data, local, cliente, observações..."
          />
        </label>
        {filteredRecords.length === 0 ? (
          <p className="muted">Ainda não há registos.</p>
        ) : (
          <div className="record-list">
            {filteredRecords.map((record) => {
              const settings = settingsVersions.find((item) => item.id === record.settingsVersionId) ?? resolveSettingsForDate(settingsVersions, record.data);
              const total = calculateDailyTotals(record, settings).totalDia;
              return (
                <button className="record-row" key={record.id} onClick={() => onEdit(record)}>
                  <span>
                    <strong>{shortDate(record.data)}</strong>
                    <small>{record.localInicio || "Sem local"} → {record.localFim || "Sem local"}</small>
                  </span>
                  <b>{eur.format(roundMoney(total))}</b>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}

function DailyForm({
  record,
  settingsVersions,
  onCancel,
  onDelete,
  onSave,
}: {
  record: DailyRecord;
  settingsVersions: SettingsVersion[];
  onCancel: () => void;
  onDelete: (id: string) => void;
  onSave: (record: DailyRecord) => void;
}) {
  const [draft, setDraft] = useState(record);
  const settings = settingsVersions.find((item) => item.id === draft.settingsVersionId) ?? resolveSettingsForDate(settingsVersions, draft.data);
  const totals = calculateDailyTotals(draft, settings);

  const patch = (changes: Partial<DailyRecord>) => setDraft((current) => ({ ...current, ...changes }));
  const patchDate = (date: string) => {
    const settingsForDate = resolveSettingsForDate(settingsVersions, date);
    patch({
      data: date,
      ...dateParts(date),
      settingsVersionId: settingsForDate.id,
    });
  };

  return (
    <form
      className="screen form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <section className="total-strip">
        <span>Total diário</span>
        <strong>{eur.format(roundMoney(totals.totalDia))}</strong>
        <small>Horas FDS não incluídas</small>
      </section>

      <FormSection title="Data e locais">
        <label>
          Data
          <input type="date" value={draft.data} onChange={(event) => patchDate(event.target.value)} />
        </label>
        <div className="two-cols">
          <label>
            Início
            <input value={draft.localInicio} onChange={(event) => patch({ localInicio: event.target.value })} />
          </label>
          <label>
            Fim
            <input value={draft.localFim} onChange={(event) => patch({ localFim: event.target.value })} />
          </label>
        </div>
        <div className="two-cols">
          <label>
            Hora início
            <TimeSelect value={draft.horaInicio} onChange={(value) => patch({ horaInicio: value })} />
          </label>
          <label>
            Hora fim
            <TimeSelect value={draft.horaFim} onChange={(value) => patch({ horaFim: value })} />
          </label>
        </div>
      </FormSection>

      <FormSection title="Quilómetros">
        <KmLine label="Nacional 1" ini={draft.kmNac1Ini} fim={draft.kmNac1Fim} onIni={(value) => patch({ kmNac1Ini: value })} onFim={(value) => patch({ kmNac1Fim: value })} />
        <KmLine label="Nacional 2" ini={draft.kmNac2Ini} fim={draft.kmNac2Fim} onIni={(value) => patch({ kmNac2Ini: value })} onFim={(value) => patch({ kmNac2Fim: value })} />
        <ReadOnly label="Total Km Nacional" value={number.format(totals.totalKmNacional)} />
        <KmLine label="Internacional 1" ini={draft.kmInt1Ini} fim={draft.kmInt1Fim} onIni={(value) => patch({ kmInt1Ini: value })} onFim={(value) => patch({ kmInt1Fim: value })} />
        <KmLine label="Internacional 2" ini={draft.kmInt2Ini} fim={draft.kmInt2Fim} onIni={(value) => patch({ kmInt2Ini: value })} onFim={(value) => patch({ kmInt2Fim: value })} />
        <ReadOnly label="Total Km Internacional" value={number.format(totals.totalKmInternacional)} />
        <KmLine label="ADR" ini={draft.kmAdrIni} fim={draft.kmAdrFim} onIni={(value) => patch({ kmAdrIni: value })} onFim={(value) => patch({ kmAdrFim: value })} />
        <ReadOnly label="Total Km ADR" value={number.format(totals.totalKmAdr)} />
      </FormSection>

      <FormSection title="Ajudas">
        <ToggleGrid
          items={[
            ["Dia ADR", draft.diaAdr, (value) => patch({ diaAdr: value })],
            ["Peq. almoço", draft.peqAlmoco, (value) => patch({ peqAlmoco: value })],
            ["Almoço", draft.almoco, (value) => patch({ almoco: value })],
            ["Jantar", draft.jantar, (value) => patch({ jantar: value })],
            ["Ceia", draft.ceia, (value) => patch({ ceia: value })],
            ["Desc. intermédia", draft.descargaIntermedia, (value) => patch({ descargaIntermedia: value })],
            ["Desc. noturna", draft.descargaNoturna, (value) => patch({ descargaNoturna: value })],
            ["Virada", draft.virada, (value) => patch({ virada: value })],
            ["Dia FDS", draft.diaFds, (value) => patch({ diaFds: value })],
          ]}
        />
        <div className="two-cols">
          <label>
            Descarga Extra
            <select value={draft.descargaExtra} onChange={(event) => patch({ descargaExtra: Number(event.target.value) })}>
              {[0, 1, 2, 3, 4].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label>
            Horas FDS
            <select value={draft.horasFds} onChange={(event) => patch({ horasFds: Number(event.target.value) })}>
              {HOURS_FDS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </FormSection>

      <FormSection title="Serviços">
        {[1, 2, 3, 4, 5].map((index) => (
          <ServiceLine key={index} index={index} draft={draft} patch={patch} />
        ))}
      </FormSection>

      <FormSection title="Folgas e observações">
        <label>
          Dia Folga
          <select value={draft.diaFolga} onChange={(event) => patch({ diaFolga: event.target.value as DayOffType })}>
            {["", "Ganha", "Gasta", "Ganha 1/2", "Gasta 1/2"].map((item) => (
              <option key={item || "empty"} value={item}>
                {item || "Vazio"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Observações
          <textarea value={draft.observacoes} onChange={(event) => patch({ observacoes: event.target.value })} rows={3} />
        </label>
      </FormSection>

      <section className="calc-box">
        <ReadOnly label="Valor Km Nacional" value={eur.format(roundMoney(totals.valorKmNacional))} />
        <ReadOnly label="Valor Km Internacional" value={eur.format(roundMoney(totals.valorKmInternacional))} />
        <ReadOnly label="Valor Km ADR" value={eur.format(roundMoney(totals.valorKmAdr))} />
        <ReadOnly label="Refeições" value={eur.format(roundMoney(totals.valorRefeicoes))} />
        <ReadOnly label="Descargas" value={eur.format(roundMoney(totals.valorDescargas))} />
      </section>

      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
        {record.createdAt !== record.updatedAt && (
          <button type="button" className="danger" onClick={() => onDelete(record.id)}>
            Apagar
          </button>
        )}
        <button type="submit" className="primary-action">
          Guardar
        </button>
      </div>
    </form>
  );
}

function MonthlyView({
  summaries,
  records,
  settingsVersions,
  year,
}: {
  summaries: ReturnType<typeof calculateYearSummaries>;
  records: DailyRecord[];
  settingsVersions: SettingsVersion[];
  year: number;
}) {
  const currentMonth = dateParts(todayIso()).mes;
  const [selectedMonth, setSelectedMonth] = useState<MonthName>(currentMonth);
  const selectedSummary = summaries.find((summary) => summary.mes === selectedMonth) ?? summaries[0];
  const monthRecords = records
    .filter((record) => record.ano === year && record.mes === selectedMonth)
    .sort((a, b) => a.data.localeCompare(b.data));

  const printReport = () => {
    openMonthlyReportWindow(selectedSummary, monthRecords, settingsVersions);
  };

  return (
    <section className="screen">
      <section className="panel form-section no-print">
        <h2>Resumo para PDF</h2>
        <div className="two-cols">
          <label>
            Mês
            <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value as MonthName)}>
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {monthLabel(month)}
                </option>
              ))}
            </select>
          </label>
          <button className="primary-action report-button" onClick={printReport}>
            Gerar PDF
          </button>
        </div>
        <div className="summary-grid compact">
          <Metric label="Ajudas" value={eur.format(roundMoney(selectedSummary.ajudas))} />
          <Metric label="Horas FDS" value={number.format(selectedSummary.horasFds)} />
          <Metric label="Líquido" value={eur.format(roundMoney(selectedSummary.salarioLiquido))} />
          <Metric label="Total Final" value={eur.format(roundMoney(selectedSummary.totalFinal))} />
        </div>
      </section>

      <div className="monthly-list">
        {summaries.map((summary) => (
          <article className="month-card" key={summary.mes}>
            <div>
              <h2>{monthLabel(summary.mes)}</h2>
              <p>{number.format(summary.horasFds)} h FDS · {number.format(summary.folgasGanhas)} ganhas · {number.format(summary.folgasGastas)} gastas</p>
            </div>
            <dl>
              <div><dt>Horas FDS</dt><dd>{eur.format(roundMoney(summary.valorHorasFds))}</dd></div>
              <div><dt>Ajudas</dt><dd>{eur.format(roundMoney(summary.ajudas))}</dd></div>
              <div><dt>Líquido</dt><dd>{eur.format(roundMoney(summary.salarioLiquido))}</dd></div>
              <div><dt>Total Final</dt><dd>{eur.format(roundMoney(summary.totalFinal))}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function openMonthlyReportWindow(
  summary: ReturnType<typeof calculateMonthlySummary>,
  records: DailyRecord[],
  settingsVersions: SettingsVersion[],
) {
  const html = buildMonthlyReportHtml(summary, records, settingsVersions);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("O navegador bloqueou a janela do PDF. Permite pop-ups para esta app e tenta novamente.");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function buildMonthlyReportHtml(
  summary: ReturnType<typeof calculateMonthlySummary>,
  records: DailyRecord[],
  settingsVersions: SettingsVersion[],
) {
  const monthEnd = `${summary.ano}-${String(MONTHS.indexOf(summary.mes) + 1).padStart(2, "0")}-31`;
  const salarySettings = resolveSettingsForDate(settingsVersions, monthEnd);
  const additions = [
    ["Base", salarySettings.base],
    ["Diuturnidades", salarySettings.diuturnidades],
    ["Complemento Salarial", salarySettings.complementoSalarial],
    ["TIR", salarySettings.tir],
    ["Cláusula 61", salarySettings.clausula61],
    ["Noturno", salarySettings.noturno],
    [`Horas FDS (${number.format(summary.horasFds)} h x ${eur.format(salarySettings.horaFds)})`, summary.valorHorasFds],
  ] as const;
  const rows = records.length
    ? records
        .map((record) => {
          const settings = settingsVersions.find((item) => item.id === record.settingsVersionId) ?? resolveSettingsForDate(settingsVersions, record.data);
          const totals = calculateDailyTotals(record, settings);
          return `<tr>
            <td>${escapeHtml(shortDate(record.data))}</td>
            <td>${escapeHtml(record.localInicio || "-")}</td>
            <td>${escapeHtml(record.localFim || "-")}</td>
            <td>${escapeHtml(number.format(totals.totalKmNacional))}</td>
            <td>${escapeHtml(number.format(totals.totalKmInternacional))}</td>
            <td>${escapeHtml(number.format(record.horasFds))}</td>
            <td>${escapeHtml(selectedFieldValues(record, settings).join(", ") || "-")}</td>
            <td>${escapeHtml(eur.format(roundMoney(totals.totalDia)))}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="8">Sem registos neste mês.</td></tr>`;
  const addLines = additions
    .map(
      ([label, value]) =>
        `<div class="payroll-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(eur.format(roundMoney(value)))}</strong></div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resumo Mensal ${escapeHtml(monthLabel(summary.mes))} ${summary.ano}</title>
  <style>
    @page { margin: 9mm; }
    body { color: #111; font-family: Arial, sans-serif; font-size: 9px; }
    header { display:flex; justify-content:space-between; gap:24px; align-items:flex-end; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px; }
    h1,h2,h3,p { margin:0; }
    h1 { font-size:22px; }
    h2 { margin:16px 0 8px; font-size:15px; }
    h3 { margin:0 0 8px; font-size:13px; }
    table { width:100%; border-collapse:collapse; page-break-inside:auto; table-layout:fixed; }
    thead { display:table-header-group; }
    tr { page-break-inside:avoid; page-break-after:auto; }
    th,td { border:1px solid #999; padding:3px 4px; text-align:left; vertical-align:top; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    th { background:#e9eee9; }
    .daily-table th:nth-child(1), .daily-table td:nth-child(1) { width:9%; }
    .daily-table th:nth-child(2), .daily-table td:nth-child(2),
    .daily-table th:nth-child(3), .daily-table td:nth-child(3) { width:14%; }
    .daily-table th:nth-child(4), .daily-table td:nth-child(4),
    .daily-table th:nth-child(5), .daily-table td:nth-child(5),
    .daily-table th:nth-child(6), .daily-table td:nth-child(6) { width:8%; text-align:right; }
    .daily-table th:nth-child(7), .daily-table td:nth-child(7) { width:27%; }
    .daily-table th:nth-child(8), .daily-table td:nth-child(8) { width:12%; text-align:right; }
    .payroll-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; break-inside:avoid; }
    .payroll-line { display:flex; justify-content:space-between; gap:12px; border-bottom:1px solid #ddd; padding:5px 0; }
    .payroll-line.total { margin-top:6px; border-top:1px solid #111; font-weight:800; }
    .payroll-line.final { margin-top:12px; border-top:2px solid #111; border-bottom:2px solid #111; padding:8px 0; font-size:14px; font-weight:900; }
    @media screen { body { max-width: 960px; margin: 24px auto; } .actions { display:block; margin-bottom:16px; } button { min-height:40px; padding:0 16px; } }
    @media print { .actions { display:none; } }
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Guardar / imprimir PDF</button></div>
  <header><h1>Resumo Mensal</h1><p>${escapeHtml(monthLabel(summary.mes))} ${summary.ano}</p></header>
  <section>
    <h2>Resumo diário</h2>
    <table class="daily-table">
      <thead><tr><th>Dia</th><th>Local INI</th><th>Local FIN</th><th>Km NAC</th><th>Km INT</th><th>Hr FDS</th><th>Valores selecionados</th><th>Total dia</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  <section class="payroll">
    <h2>Cálculo mensal</h2>
    <div class="payroll-grid">
      <div>
        <h3>Valores a somar</h3>
        ${addLines}
        <div class="payroll-line total"><span>Salário bruto</span><strong>${escapeHtml(eur.format(roundMoney(summary.salarioBruto)))}</strong></div>
        <div class="payroll-line total"><span>Ajudas do mês</span><strong>${escapeHtml(eur.format(roundMoney(summary.ajudas)))}</strong></div>
      </div>
      <div>
        <h3>Valores a subtrair</h3>
        <div class="payroll-line"><span>IRS (${escapeHtml(number.format(salarySettings.irs * 100))}%)</span><strong>-${escapeHtml(eur.format(roundMoney(summary.valorIrs)))}</strong></div>
        <div class="payroll-line"><span>SS (${escapeHtml(number.format(salarySettings.ss * 100))}%)</span><strong>-${escapeHtml(eur.format(roundMoney(summary.valorSs)))}</strong></div>
        <div class="payroll-line total"><span>Salário líquido</span><strong>${escapeHtml(eur.format(roundMoney(summary.salarioLiquido)))}</strong></div>
        <div class="payroll-line final"><span>Total final</span><strong>${escapeHtml(eur.format(roundMoney(summary.totalFinal)))}</strong></div>
      </div>
    </div>
  </section>
  <script>setTimeout(function(){ window.print(); }, 250);</script>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function PrintMonthlyReport({
  summary,
  records,
  settingsVersions,
}: {
  summary: ReturnType<typeof calculateMonthlySummary>;
  records: DailyRecord[];
  settingsVersions: SettingsVersion[];
}) {
  const monthEnd = `${summary.ano}-${String(MONTHS.indexOf(summary.mes) + 1).padStart(2, "0")}-31`;
  const salarySettings = resolveSettingsForDate(settingsVersions, monthEnd);
  const additions = [
    ["Base", salarySettings.base],
    ["Diuturnidades", salarySettings.diuturnidades],
    ["Complemento Salarial", salarySettings.complementoSalarial],
    ["TIR", salarySettings.tir],
    ["Cláusula 61", salarySettings.clausula61],
    ["Noturno", salarySettings.noturno],
    [`Horas FDS (${number.format(summary.horasFds)} h x ${eur.format(salarySettings.horaFds)})`, summary.valorHorasFds],
  ] as const;

  return (
    <article className="print-report print-only">
      <header>
        <h1>Resumo Mensal</h1>
        <p>{monthLabel(summary.mes)} {summary.ano}</p>
      </header>

      <section>
        <h2>Resumo diário</h2>
        <table>
          <thead>
            <tr>
              <th>Dia</th>
              <th>Local INI</th>
              <th>Local FIN</th>
              <th>Km NAC</th>
              <th>Km INT</th>
              <th>Hr FDS</th>
              <th>Campos selecionados</th>
              <th>Total dia</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={8}>Sem registos neste mês.</td>
              </tr>
            ) : (
              records.map((record) => {
                const settings = settingsVersions.find((item) => item.id === record.settingsVersionId) ?? resolveSettingsForDate(settingsVersions, record.data);
                const totals = calculateDailyTotals(record, settings);

                return (
                  <tr key={record.id}>
                    <td>{shortDate(record.data)}</td>
                    <td>{record.localInicio || "-"}</td>
                    <td>{record.localFim || "-"}</td>
                    <td>{number.format(totals.totalKmNacional)}</td>
                    <td>{number.format(totals.totalKmInternacional)}</td>
                    <td>{number.format(record.horasFds)}</td>
                    <td>{selectedFieldValues(record, settings).join(", ") || "-"}</td>
                    <td>{eur.format(roundMoney(totals.totalDia))}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="payroll">
        <h2>Cálculo mensal</h2>
        <div className="payroll-grid">
          <div>
            <h3>Valores a somar</h3>
            {additions.map(([label, value]) => (
              <div className="payroll-line" key={label}>
                <span>{label}</span>
                <strong>{eur.format(roundMoney(value))}</strong>
              </div>
            ))}
            <div className="payroll-line total">
              <span>Salário bruto</span>
              <strong>{eur.format(roundMoney(summary.salarioBruto))}</strong>
            </div>
            <div className="payroll-line total">
              <span>Ajudas do mês</span>
              <strong>{eur.format(roundMoney(summary.ajudas))}</strong>
            </div>
          </div>
          <div>
            <h3>Valores a subtrair</h3>
            <div className="payroll-line">
              <span>IRS ({number.format(salarySettings.irs * 100)}%)</span>
              <strong>-{eur.format(roundMoney(summary.valorIrs))}</strong>
            </div>
            <div className="payroll-line">
              <span>SS ({number.format(salarySettings.ss * 100)}%)</span>
              <strong>-{eur.format(roundMoney(summary.valorSs))}</strong>
            </div>
            <div className="payroll-line total">
              <span>Salário líquido</span>
              <strong>{eur.format(roundMoney(summary.salarioLiquido))}</strong>
            </div>
            <div className="payroll-line final">
              <span>Total final</span>
              <strong>{eur.format(roundMoney(summary.totalFinal))}</strong>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}

function selectedFieldValues(record: DailyRecord, settings: SettingsVersion) {
  const fields: string[] = [];
  if (record.diaAdr) fields.push(eur.format(settings.diaAdr));
  if (record.peqAlmoco) fields.push(eur.format(settings.peqAlmoco));
  if (record.almoco) fields.push(eur.format(settings.almoco));
  if (record.jantar) fields.push(eur.format(settings.jantar));
  if (record.ceia) fields.push(eur.format(settings.ceia));
  if (record.descargaIntermedia) fields.push(eur.format(settings.descargaIntermedia));
  if (record.descargaExtra > 0) fields.push(eur.format(record.descargaExtra * settings.descargaExtra));
  if (record.descargaNoturna) fields.push(eur.format(settings.descargaNoturna));
  if (record.virada) fields.push(eur.format(settings.virada));
  if (record.diaFds) fields.push(eur.format(settings.diaFds));
  if (record.diaFolga) fields.push(`Folga: ${record.diaFolga}`);
  return fields;
}

function FolgasView({ records, balance }: { records: DailyRecord[]; balance: ReturnType<typeof calculateDayOffBalance> }) {
  const history = records.filter((record) => record.diaFolga);

  return (
    <section className="screen">
      <div className="summary-grid">
        <Metric label="Ganhas" value={number.format(balance.folgasGanhas)} />
        <Metric label="Gastas" value={number.format(balance.folgasGastas)} />
        <Metric label="Saldo" value={number.format(balance.saldo)} />
      </div>
      <section className="panel">
        <h2>Histórico</h2>
        {history.length === 0 ? (
          <p className="muted">Sem movimentos de folgas.</p>
        ) : (
          <div className="record-list">
            {history.map((record) => (
              <div className="record-row static" key={record.id}>
                <span>
                  <strong>{shortDate(record.data)}</strong>
                  <small>{record.localInicio || record.observacoes || "Sem detalhe"}</small>
                </span>
                <b>{record.diaFolga}</b>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function SettingsView({
  activeSettings,
  versions,
  onSave,
  onExportBackup,
  onImportBackup,
}: {
  activeSettings: SettingsVersion;
  versions: SettingsVersion[];
  onSave: (settings: SettingsVersion) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => Promise<void>;
}) {
  const [draft, setDraft] = useState<SettingsVersion>({
    ...activeSettings,
    id: crypto.randomUUID(),
    effectiveFrom: todayIso(),
    label: `Valores ${todayIso()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [backupMessage, setBackupMessage] = useState("");

  const patch = (key: keyof SettingsVersion, value: string | number | boolean) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      className="screen form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <section className="notice">
        Alterar valores cria uma nova versão. Registos antigos continuam com os valores que estavam em vigor na data deles.
      </section>
      <FormSection title="Backup">
        <div className="backup-actions">
          <button type="button" onClick={onExportBackup}>
            Exportar JSON
          </button>
          <label className="file-button">
            Importar JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try {
                  await onImportBackup(file);
                  setBackupMessage("Backup importado com sucesso.");
                } catch (err) {
                  setBackupMessage(err instanceof Error ? err.message : "Não foi possível importar o backup.");
                }
              }}
            />
          </label>
        </div>
        {backupMessage && <p className="muted">{backupMessage}</p>}
      </FormSection>
      <FormSection title="Nova versão">
        <label>
          Entrada em vigor
          <input type="date" value={draft.effectiveFrom} onChange={(event) => patch("effectiveFrom", event.target.value)} />
        </label>
        <label>
          Nome
          <input value={draft.label} onChange={(event) => patch("label", event.target.value)} />
        </label>
      </FormSection>
      <FormSection title="Valores de referência">
        <div className="settings-grid">
          {settingFields.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                type="number"
                step={field.step ?? "0.01"}
                value={draft[field.key]}
                onChange={(event) => patch(field.key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
      </FormSection>
      <section className="panel">
        <h2>Versões guardadas</h2>
        <div className="record-list">
          {versions
            .slice()
            .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
            .map((version) => (
              <div className="record-row static" key={version.id}>
                <span>
                  <strong>{version.label}</strong>
                  <small>Desde {shortDate(version.effectiveFrom)}</small>
                </span>
              </div>
            ))}
        </div>
      </section>
      <div className="form-actions">
        <button type="submit" className="primary-action">
          Guardar nova versão
        </button>
      </div>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel form-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function KmLine({
  label,
  ini,
  fim,
  onIni,
  onFim,
}: {
  label: string;
  ini: KmValue;
  fim: KmValue;
  onIni: (value: KmValue) => void;
  onFim: (value: KmValue) => void;
}) {
  return (
    <div className="km-line">
      <span>{label}</span>
      <CleanNumberInput value={ini} onChange={onIni} ariaLabel={`${label} início`} />
      <CleanNumberInput value={fim} onChange={onFim} ariaLabel={`${label} fim`} />
    </div>
  );
}

function TimeSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [selectedHour = "", selectedMinute = ""] = value.split(":");
  const update = (hour: string, minute: string) => {
    if (!hour && !minute) {
      onChange("");
      return;
    }
    onChange(`${hour || "00"}:${minute || "00"}`);
  };

  return (
    <div className="time-wheel" role="group" aria-label="Selecionar hora">
      <select value={selectedHour} size={5} onChange={(event) => update(event.target.value, selectedMinute)}>
        <option value="">--</option>
        {HOUR_OPTIONS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>
      <span>:</span>
      <select value={selectedMinute} size={5} onChange={(event) => update(selectedHour, event.target.value)}>
        <option value="">--</option>
        {MINUTE_OPTIONS.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>
    </div>
  );
}

function CleanNumberInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: KmValue;
  onChange: (value: KmValue) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value === null ? "" : String(value)}
      placeholder="0"
      onChange={(event) => {
        const clean = event.target.value.replace(",", ".");
        if (clean === "") {
          onChange(null);
          return;
        }
        const nextValue = Number(clean);
        if (Number.isNaN(nextValue)) return;
        onChange(nextValue);
      }}
      aria-label={ariaLabel}
    />
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="readonly">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ToggleGrid({ items }: { items: [string, boolean, (value: boolean) => void][] }) {
  return (
    <div className="toggle-grid">
      {items.map(([label, checked, onChange]) => (
        <label className={checked ? "toggle checked" : "toggle"} key={label}>
          <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
          {label}
        </label>
      ))}
    </div>
  );
}

function ServiceLine({
  index,
  draft,
  patch,
}: {
  index: number;
  draft: DailyRecord;
  patch: (changes: Partial<DailyRecord>) => void;
}) {
  const typeKey = `tipo${index}` as keyof DailyRecord;
  const clientKey = `cliente${index}` as keyof DailyRecord;
  const localKey = `local${index}` as keyof DailyRecord;

  return (
    <div className="service-line">
      <select value={draft[typeKey] as ServiceType} onChange={(event) => patch({ [typeKey]: event.target.value as ServiceType } as Partial<DailyRecord>)} aria-label={`Tipo ${index}`}>
        {["", "D", "C", "TR"].map((item) => (
          <option key={item || "empty"} value={item}>
            {item || "-"}
          </option>
        ))}
      </select>
      <input value={draft[clientKey] as string} onChange={(event) => patch({ [clientKey]: event.target.value } as Partial<DailyRecord>)} placeholder={`Cliente ${index}`} />
      <input value={draft[localKey] as string} onChange={(event) => patch({ [localKey]: event.target.value } as Partial<DailyRecord>)} placeholder="Local" />
    </div>
  );
}

function viewTitle(view: View) {
  if (view === "dashboard") return "Dashboard";
  if (view === "daily") return "Registo Diário";
  if (view === "monthly") return "Registo Mensal";
  if (view === "folgas") return "Banco de Folgas";
  return "Definições";
}

export default App;
