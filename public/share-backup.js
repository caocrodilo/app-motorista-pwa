(function () {
  const DB_NAME = "app-motorista-db";
  const DB_VERSION = 2;
  const SETTINGS_STORE = "settingsVersions";
  const RECORDS_STORE = "dailyRecords";
  const USER_STORE = "userProfile";
  let allowOriginalExport = false;

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

  const loadBackupData = async () => {
    const db = await openDb();
    const transaction = db.transaction([SETTINGS_STORE, RECORDS_STORE, USER_STORE], "readonly");
    const settingsStore = transaction.objectStore(SETTINGS_STORE);
    const recordsStore = transaction.objectStore(RECORDS_STORE);
    const userStore = transaction.objectStore(USER_STORE);
    const [settingsVersions, dailyRecords, userProfiles] = await Promise.all([
      requestToPromise(settingsStore.getAll()),
      requestToPromise(recordsStore.getAll()),
      requestToPromise(userStore.getAll()),
    ]);
    db.close();

    return {
      app: "app-motorista-pwa",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        settingsVersions,
        dailyRecords,
        userProfile: userProfiles[0] || null,
      },
    };
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const downloadFile = (file) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };

  const shareBackup = async () => {
    const payload = await loadBackupData();
    const file = new File([JSON.stringify(payload, null, 2)], `app-motorista-backup-${todayIso()}.json`, {
      type: "text/plain",
    });

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: "Backup App Motorista",
          text: "Cópia de segurança da App Motorista",
          files: [file],
        });
        return;
      }
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }

    downloadFile(file);
  };

  const isExportButton = (target) => {
    const button = target instanceof Element ? target.closest("button") : null;
    return button && (button.textContent || "").trim() === "Exportar JSON";
  };

  document.addEventListener(
    "click",
    (event) => {
      if (allowOriginalExport) return;
      if (!isExportButton(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      shareBackup().catch(() => {
        const originalButton = event.target instanceof Element ? event.target.closest("button") : null;
        if (!originalButton) return;
        allowOriginalExport = true;
        originalButton.click();
        allowOriginalExport = false;
      });
    },
    true,
  );
})();
