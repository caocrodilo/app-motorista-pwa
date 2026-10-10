import { useMemo } from "react";
import { MONTHS } from "./defaults";
import { monthLabel } from "./format";
import { buildOvernightDays, OVERNIGHT_OPTIONS, summarizeOvernights } from "./overnight";
import type { DailyRecord } from "./types";

const WEEKDAYS = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];

export function OvernightView({ records, year }: { records: DailyRecord[]; year: number }) {
  const days = useMemo(() => buildOvernightDays(records), [records]);
  const summary = useMemo(() => summarizeOvernights(days, year), [days, year]);

  return (
    <section className="screen overnight-screen" aria-label={`Calendário de pernoitas ${year}`}>
      <div className="overnight-legend">
        {OVERNIGHT_OPTIONS.map((option) => (
          <span key={option.value}><i className={`overnight-dot overnight-${option.value}`} aria-hidden="true" />{option.label}</span>
        ))}
      </div>
      {MONTHS.map((month, index) => {
        const firstWeekday = (new Date(Date.UTC(year, index, 1)).getUTCDay() + 6) % 7;
        const daysInMonth = new Date(Date.UTC(year, index + 1, 0)).getUTCDate();
        return (
          <section className="overnight-month" key={month} aria-label={`${monthLabel(month)} ${year}`}>
            <h2>{monthLabel(month)} {year}</h2>
            <div className="overnight-grid">
              {WEEKDAYS.map((weekday) => <span className="overnight-weekday" key={weekday}>{weekday}</span>)}
              {Array.from({ length: firstWeekday }, (_, day) => <span key={`empty-${day}`} aria-hidden="true" />)}
              {Array.from({ length: daysInMonth }, (_, day) => {
                const date = `${year}-${String(index + 1).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}`;
                const types = days.get(date) ?? [];
                const descriptions = OVERNIGHT_OPTIONS.filter((option) => types.includes(option.value)).map((option) => option.label);
                return (
                  <div className="overnight-day" key={date} data-date={date} aria-label={`${day + 1} ${monthLabel(month)} ${year}: ${descriptions.join(", ") || "Sem marcação"}`} title={descriptions.join(", ")}>
                    <span className={`overnight-date${types.length === 1 ? ` overnight-${types[0]}` : ""}`}>{day + 1}</span>
                    {types.length > 1 && <span className="overnight-markers">{types.map((type) => <i className={`overnight-dot overnight-${type}`} key={type} aria-hidden="true" />)}</span>}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      <section className="overnight-summary" aria-label={`Resumo de pernoitas ${year}`}>
        <h2>Resumo {year}</h2>
        <dl>
          <div><dt><i className="overnight-dot overnight-casa" aria-hidden="true" />Pernoita em casa</dt><dd data-overnight-total="casa">{summary.casa}</dd></div>
          <div><dt><i className="overnight-dot overnight-saida-domingo" aria-hidden="true" />Saída Domingo</dt><dd data-overnight-total="saida-domingo">{summary.saidaDomingo}</dd></div>
          <div><dt><i className="overnight-dot overnight-fds" aria-hidden="true" />Pernoita FDS</dt><dd data-overnight-total="fds">{summary.fds}</dd></div>
        </dl>
      </section>
    </section>
  );
}
