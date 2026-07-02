(function () {
  const DB_NAME = "app-motorista-db";
  const DB_VERSION = 2;
  const SETTINGS_STORE = "settingsVersions";
  const RECORDS_STORE = "dailyRecords";
  const USER_STORE = "userProfile";

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

  const createShareButton = () => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Partilhar backup";
    button.dataset.shareBackup = "true";
    button.addEventListener("click", () => {
      shareBackup().catch(() => {
        alert("Não foi possível partilhar o backup. Usa Exportar JSON para guardar o ficheiro.");
      });
    });
    return button;
  };

  const injectShareButton = () => {
    if (document.querySelector("[data-share-backup]")) return;
    const exportButton = Array.from(document.querySelectorAll("button")).find(
      (button) => (button.textContent || "").trim() === "Exportar JSON",
    );
    if (!exportButton) return;
    const backupActions = exportButton.closest(".backup-actions");
    if (!backupActions) return;
    backupActions.appendChild(createShareButton());
  };

  const observer = new MutationObserver(injectShareButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("load", injectShareButton);
  setInterval(injectShareButton, 1000);
})();
