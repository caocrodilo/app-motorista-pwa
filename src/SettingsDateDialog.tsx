import { useEffect, useId, useRef, useState } from "react";
import { shortDate } from "./format";
import { isValidEffectiveDate, settingsChangeRecords } from "./settingsChanges";
import type { DailyRecord, SettingsVersion } from "./types";

export function SettingsDateDialog({ records, versions, onConfirm, onClose }: {
  records: DailyRecord[];
  versions: SettingsVersion[];
  onConfirm: (date: string) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const affected = isValidEffectiveDate(date) ? settingsChangeRecords(records, versions, date) : null;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} className="settings-date-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
      <form onSubmit={async event => {
        event.preventDefault();
        if (saving || !affected) return;
        setSaving(true);
        setError("");
        try {
          await onConfirm(date);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Não foi possível guardar a alteração. Tenta novamente.");
          setSaving(false);
        }
      }}>
        <h2 id={titleId}>Desde que dia aplicar os valores?</h2>
        <label>
          Entrada em vigor
          <input type="date" value={date} onChange={event => setDate(event.target.value)} required autoFocus disabled={saving} />
        </label>
        {affected && <div className="settings-date-impact" role="status">
          <p>Novos valores desde {shortDate(date)}.</p>
          <p>{affected.records.length} registo(s) serão recalculados. Os dias anteriores mantêm os valores antigos.</p>
          {affected.nextDate && <p>A alteração já guardada para {shortDate(affected.nextDate)} será mantida.</p>}
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" className="primary-action" disabled={saving || !affected}>{saving ? "A guardar..." : "Aplicar valores"}</button>
        </div>
      </form>
    </dialog>
  );
}
