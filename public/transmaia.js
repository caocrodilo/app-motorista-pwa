(function () {
  const DB_NAME = "app-motorista-db";
  const DB_VERSION = 2;
  const MONTHS = [
    "janeiro",
    "fevereiro",
    "mar\u00e7o",
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

  const eur = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
  const number = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 });

  const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const monthLabel = (month) => String(month || "").toLocaleUpperCase("pt-PT");
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadAppData() {
    const db = await openDb();
    const transaction = db.transaction(["settingsVersions", "dailyRecords", "userProfile"], "readonly");
    const [settingsVersions, dailyRecords, userProfiles] = await Promise.all([
      requestToPromise(transaction.objectStore("settingsVersions").getAll()),
      requestToPromise(transaction.objectStore("dailyRecords").getAll()),
      requestToPromise(transaction.objectStore("userProfile").getAll()),
    ]);
    db.close();

    return {
      settingsVersions: settingsVersions.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
      dailyRecords,
      userProfile: userProfiles[0] || null,
    };
  }

  function resolveSettingsForDate(versions, dateIso) {
    const eligible = versions
      .filter((version) => version.effectiveFrom <= dateIso)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
    return eligible[0] || versions.slice().sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
  }

  function kmRange(start, end) {
    if (start === null || start === undefined || end === null || end === undefined) return 0;
    if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end))) return 0;
    return Number(end) - Number(start);
  }

  function calculateDailyTotals(record, settings) {
    const totalKmNacional = kmRange(record.kmNac1Ini, record.kmNac1Fim) + kmRange(record.kmNac2Ini, record.kmNac2Fim);
    const totalKmInternacional = kmRange(record.kmInt1Ini, record.kmInt1Fim) + kmRange(record.kmInt2Ini, record.kmInt2Fim);
    const totalKmAdr = kmRange(record.kmAdrIni, record.kmAdrFim);
    const valorKmNacional = totalKmNacional * Number(settings.kmNacional || 0);
    const valorKmInternacional = totalKmInternacional * Number(record.diaFds ? settings.kmFds || 0 : settings.kmInternacional || 0);
    const valorKmAdr = totalKmAdr * Number(settings.kmAdr || 0);
    const valorDiaAdr = record.diaAdr ? Number(settings.diaAdr || 0) : 0;
    const valorRefeicoes =
      (record.peqAlmoco ? Number(settings.peqAlmoco || 0) : 0) +
      (record.almoco ? Number(settings.almoco || 0) : 0) +
      (record.jantar ? Number(settings.jantar || 0) : 0) +
      (record.ceia ? Number(settings.ceia || 0) : 0);
    const valorDescargas =
      (record.descargaIntermedia ? Number(settings.descargaIntermedia || 0) : 0) +
      Number(record.descargaExtra || 0) * Number(settings.descargaExtra || 0) +
      (record.descargaNoturna ? Number(settings.descargaNoturna || 0) : 0);
    const valorVirada = record.virada ? Number(settings.virada || 0) : 0;
    const valorDiaFds = record.diaFds ? Number(settings.diaFds || 0) : 0;

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
    };
  }

  function firstServiceLocal(record) {
    return [record.local1, record.local2, record.local3, record.local4, record.local5].find((item) => String(item || "").trim()) || "";
  }

  function transmaiaLocation(record) {
    const parts = [record.localInicio, firstServiceLocal(record), record.localFim]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    return parts.filter((part, index) => index === 0 || part !== parts[index - 1]).join(" - ");
  }

  function transmaiaValueText(dayData) {
    const parts = [
      ["Km", dayData.valorKm],
      ["Ref", dayData.refeicoes],
      ["Extras", dayData.extras],
      ["FDS", dayData.diaFds],
    ]
      .filter(([, value]) => Number(value) > 0)
      .map(([label, value]) => `${label} ${eur.format(roundMoney(Number(value)))}`);

    if (!parts.length) return "";
    return `${parts.join(" + ")} = ${eur.format(roundMoney(dayData.valor))}`;
  }

  function getSelectedMonthAndYear() {
    const monthSelect = Array.from(document.querySelectorAll("select")).find((select) =>
      Array.from(select.options).some((option) => MONTHS.includes(option.value)),
    );
    const yearSelect = Array.from(document.querySelectorAll(".top-actions select, header select")).find((select) =>
      Array.from(select.options).some((option) => /^\d{4}$/.test(option.value)),
    );
    return {
      month: monthSelect ? monthSelect.value : MONTHS[new Date().getMonth()],
      year: yearSelect ? Number(yearSelect.value) : new Date().getFullYear(),
    };
  }

  function buildReportHtml({ records, settingsVersions, userProfile, month, year }) {
    const recordsByDay = new Map();
    records.forEach((record) => {
      const dayRecords = recordsByDay.get(record.dia) || [];
      dayRecords.push(record);
      recordsByDay.set(record.dia, dayRecords);
    });

    let totalKmInt = 0;
    let totalKmNac = 0;
    let totalValor = 0;
    let totalSubRisco = 0;
    let totalHorasFds = 0;

    const rows = Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const dayRecords = recordsByDay.get(day) || [];
      const dayData = dayRecords.reduce(
        (acc, record) => {
          const settings = settingsVersions.find((item) => item.id === record.settingsVersionId) || resolveSettingsForDate(settingsVersions, record.data);
          const totals = calculateDailyTotals(record, settings);
          const valorKm = totals.valorKmNacional + totals.valorKmInternacional + totals.valorKmAdr;
          const extras = totals.valorDescargas + totals.valorVirada;
          const valor = valorKm + totals.valorRefeicoes + extras + totals.valorDiaFds;

          acc.locations.push(transmaiaLocation(record));
          acc.kmInt += totals.totalKmInternacional;
          acc.kmNac += totals.totalKmNacional;
          acc.valorKm += valorKm;
          acc.refeicoes += totals.valorRefeicoes;
          acc.extras += extras;
          acc.diaFds += totals.valorDiaFds;
          acc.valor += valor;
          acc.subRisco += totals.valorDiaAdr;
          acc.horasFds += Number(record.horasFds || 0);
          return acc;
        },
        { locations: [], kmInt: 0, kmNac: 0, valorKm: 0, refeicoes: 0, extras: 0, diaFds: 0, valor: 0, subRisco: 0, horasFds: 0 },
      );

      totalKmInt += dayData.kmInt;
      totalKmNac += dayData.kmNac;
      totalValor += dayData.valor;
      totalSubRisco += dayData.subRisco;
      totalHorasFds += dayData.horasFds;

      return `<tr>
        <td class="center">${day}</td>
        <td>${escapeHtml(dayData.locations.filter(Boolean).join(" | "))}</td>
        <td></td>
        <td class="num">${dayData.kmInt ? escapeHtml(number.format(dayData.kmInt)) : ""}</td>
        <td class="num">${dayData.kmNac ? escapeHtml(number.format(dayData.kmNac)) : ""}</td>
        <td>${escapeHtml(transmaiaValueText(dayData))}</td>
        <td class="num">${dayData.subRisco ? escapeHtml(eur.format(roundMoney(dayData.subRisco))) : ""}</td>
        <td class="num">${dayData.horasFds ? escapeHtml(number.format(dayData.horasFds)) : ""}</td>
        <td></td>
      </tr>`;
    }).join("");

    return `<!doctype html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mapa de Ajudas de Custo ${escapeHtml(monthLabel(month))} ${year}</title>
  <style>
    @page { size: 297mm 210mm; margin: 10mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { color: #111; font-family: Arial, sans-serif; font-size: 8px; background: white; }
    .actions { margin: 0 0 12px; }
    .actions button { min-height: 40px; padding: 0 16px; border: 0; border-radius: 6px; background: #25634f; color: white; font-weight: 700; }
    .page { width: 277mm; min-height: 190mm; margin: 0 auto; }
    h1 { margin: 0 0 8px; text-align: center; font-size: 16px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1.3px solid #111; padding: 2px 3px; vertical-align: middle; line-height: 1.05; }
    th { height: 24px; text-align: center; font-size: 10px; font-weight: 800; }
    td { height: 13.6px; overflow: hidden; }
    .center { text-align: center; }
    .num { text-align: right; white-space: nowrap; }
    .total-row td { border-top-width: 2px; font-weight: 800; }
    .footer { display: grid; grid-template-columns: 1.4fr 0.8fr 0.8fr 1.1fr; gap: 18px; margin-top: 12px; font-size: 10px; }
    .field { min-height: 22px; border-bottom: 1px solid #111; }
    .field span { display: inline-block; min-width: 96px; font-weight: 700; }
    col.day { width: 4%; }
    col.local { width: 38%; }
    col.car { width: 5.7%; }
    col.km { width: 7.6%; }
    col.value { width: 21.7%; }
    col.risk { width: 4.1%; }
    col.hours { width: 5.4%; }
    col.invoice { width: 7%; }
    @media screen { body { min-width: 1120px; padding: 24px 12px; } .page { box-shadow: 0 0 0 1px #ddd; padding: 10mm; } }
    @media print { .actions { display: none; } .page { width: 277mm; min-height: 190mm; margin: 0; padding: 0; } }
  </style>
</head>
<body>
  <div class="actions"><button onclick="window.print()">Guardar / imprimir PDF</button></div>
  <main class="page">
  <h1>Mapa de Ajudas de Custo</h1>
  <table>
    <colgroup><col class="day" /><col class="local" /><col class="car" /><col class="km" /><col class="km" /><col class="value" /><col class="risk" /><col class="hours" /><col class="invoice" /></colgroup>
    <thead>
      <tr><th>Dias</th><th>Local (inicio/intermedio/fim) - 3 Locais</th><th>N&ordm; Carro</th><th>KM's INT</th><th>KM's NAC</th><th>Valor</th><th>Sub<br />Risco</th><th>Horas<br />FDS</th><th>Fatura</th></tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row"><td></td><td class="center">Total</td><td></td><td class="num">${totalKmInt ? escapeHtml(number.format(totalKmInt)) : ""}</td><td class="num">${totalKmNac ? escapeHtml(number.format(totalKmNac)) : ""}</td><td class="num">${totalValor ? escapeHtml(eur.format(roundMoney(totalValor))) : ""}</td><td class="num">${totalSubRisco ? escapeHtml(eur.format(roundMoney(totalSubRisco))) : ""}</td><td class="num">${totalHorasFds ? escapeHtml(number.format(totalHorasFds)) : ""}</td><td></td></tr>
    </tbody>
  </table>
  <footer class="footer">
    <div class="field"><span>Nome:</span>${escapeHtml(userProfile && userProfile.nomeCompleto)}</div>
    <div class="field"><span>N&ordm; funcionario:</span>${escapeHtml(userProfile && userProfile.numeroFuncionario)}</div>
    <div class="field"><span>Mes:</span>${escapeHtml(monthLabel(month))} ${year}</div>
    <div class="field"><span>Conferido por:</span></div>
  </footer>
  </main>
  <script>setTimeout(function(){ window.print(); }, 250);</script>
</body>
</html>`;
  }

  async function openReport() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("O navegador bloqueou a janela do PDF. Permite pop-ups para esta app e tenta novamente.");
      return;
    }
    printWindow.document.write("<p>A preparar folha Transmaia...</p>");

    try {
      const { month, year } = getSelectedMonthAndYear();
      const data = await loadAppData();
      const records = data.dailyRecords
        .filter((record) => Number(record.ano) === Number(year) && record.mes === month)
        .sort((a, b) => a.data.localeCompare(b.data));
      const html = buildReportHtml({
        records,
        settingsVersions: data.settingsVersions,
        userProfile: data.userProfile,
        month,
        year,
      });
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      printWindow.document.body.innerHTML = `<p>Nao foi possivel gerar a folha Transmaia.</p><pre>${escapeHtml(error && error.message ? error.message : error)}</pre>`;
    }
  }

  function injectButton() {
    if (document.querySelector("[data-transmaia-report]")) return;
    const monthlyPanel = Array.from(document.querySelectorAll(".panel")).find((panel) => /Resumo para PDF/i.test(panel.textContent || ""));
    if (!monthlyPanel) return;
    const pdfButton = Array.from(monthlyPanel.querySelectorAll("button")).find((button) => /Gerar PDF/i.test(button.textContent || ""));
    if (!pdfButton) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.transmaiaReport = "true";
    button.className = "report-button";
    button.textContent = "Folha Transmaia";
    button.addEventListener("click", openReport);

    const actions = pdfButton.parentElement && pdfButton.parentElement.classList.contains("report-actions")
      ? pdfButton.parentElement
      : document.createElement("div");
    if (!actions.classList.contains("report-actions")) {
      actions.className = "report-actions";
      pdfButton.replaceWith(actions);
      actions.appendChild(pdfButton);
    }
    actions.appendChild(button);
  }

  const observer = new MutationObserver(injectButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
})();
