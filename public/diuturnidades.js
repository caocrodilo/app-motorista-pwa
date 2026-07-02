(function () {
  const DB_NAME = "app-motorista-db";
  const DB_VERSION = 2;
  const SETTINGS_STORE = "settingsVersions";
  const state = {
    nominal: null,
    quantity: 1,
  };

  const clampQuantity = (value) => {
    const quantity = Number(value);
    if (!Number.isFinite(quantity)) return 1;
    return Math.min(5, Math.max(0, quantity));
  };

  const requestToPromise = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const openDb = () =>
    new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const getLatestSettings = async () => {
    const db = await openDb();
    const transaction = db.transaction(SETTINGS_STORE, "readonly");
    const versions = await requestToPromise(transaction.objectStore(SETTINGS_STORE).getAll());
    db.close();
    return versions.sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom))).at(-1) || null;
  };

  const getNominalValue = (settings) => {
    const quantity = clampQuantity(settings.diuturnidadesQuantidade ?? 1);
    if (Number.isFinite(Number(settings.diuturnidadesNominal))) return Number(settings.diuturnidadesNominal);
    if (quantity > 0) return Number(settings.diuturnidades) / quantity;
    return Number(settings.diuturnidades) || 0;
  };

  const dispatchNativeInput = (input) => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const findDiuturnidadesInput = () => {
    const labels = Array.from(document.querySelectorAll("label"));
    const label = labels.find((item) => {
      const text = item.childNodes[0]?.textContent || item.textContent || "";
      return text.trim() === "Diuturnidades";
    });
    return label?.querySelector("input") || null;
  };

  const hydrateFromDb = async (input, select) => {
    try {
      const settings = await getLatestSettings();
      if (!settings) return;
      state.quantity = clampQuantity(settings.diuturnidadesQuantidade ?? 1);
      state.nominal = getNominalValue(settings);
      select.value = String(state.quantity);
      input.value = String(Math.round((state.nominal + Number.EPSILON) * 100) / 100);
      dispatchNativeInput(input);
    } catch {
      // The original settings UI remains usable even if this enhancement cannot hydrate.
    }
  };

  const injectQuantitySelect = () => {
    if (document.querySelector("[data-diuturnidades-quantity]")) return;
    const input = findDiuturnidadesInput();
    if (!input) return;

    const label = document.createElement("label");
    label.dataset.diuturnidadesQuantity = "true";
    label.textContent = "N.º diuturnidades";

    const select = document.createElement("select");
    [0, 1, 2, 3, 4, 5].forEach((quantity) => {
      const option = document.createElement("option");
      option.value = String(quantity);
      option.textContent = String(quantity);
      select.appendChild(option);
    });
    label.appendChild(select);

    input.closest("label")?.insertAdjacentElement("afterend", label);

    input.addEventListener("input", () => {
      state.nominal = Number(input.value) || 0;
    });
    select.addEventListener("change", () => {
      state.quantity = clampQuantity(select.value);
      state.nominal = Number(input.value) || 0;
      dispatchNativeInput(input);
    });

    hydrateFromDb(input, select);
  };

  const originalPut = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function patchedPut(value, ...args) {
    if (this.name === SETTINGS_STORE && value && typeof value === "object" && "diuturnidades" in value) {
      const quantity = clampQuantity(value.diuturnidadesQuantidade ?? state.quantity);
      const nominal = Number.isFinite(Number(value.diuturnidadesNominal))
        ? Number(value.diuturnidadesNominal)
        : Number.isFinite(Number(state.nominal))
          ? Number(state.nominal)
          : getNominalValue(value);
      value = {
        ...value,
        diuturnidadesNominal: nominal,
        diuturnidadesQuantidade: quantity,
        diuturnidades: nominal * quantity,
      };
    }
    return originalPut.call(this, value, ...args);
  };

  const observer = new MutationObserver(injectQuantitySelect);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", injectQuantitySelect);
  setInterval(injectQuantitySelect, 1000);
})();
