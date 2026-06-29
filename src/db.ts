import { createInitialSettings } from "./defaults";
import type { AppData, DailyRecord, SettingsVersion, UserProfile } from "./types";

const DB_NAME = "app-motorista-db";
const DB_VERSION = 2;
const SETTINGS_STORE = "settingsVersions";
const RECORDS_STORE = "dailyRecords";
const USER_STORE = "userProfile";

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        const store = db.createObjectStore(SETTINGS_STORE, { keyPath: "id" });
        store.createIndex("effectiveFrom", "effectiveFrom", { unique: false });
      }
      if (!db.objectStoreNames.contains(RECORDS_STORE)) {
        const store = db.createObjectStore(RECORDS_STORE, { keyPath: "id" });
        store.createIndex("data", "data", { unique: false });
        store.createIndex("ano", "ano", { unique: false });
        store.createIndex("settingsVersionId", "settingsVersionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(USER_STORE)) {
        db.createObjectStore(USER_STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const loadAppData = async (): Promise<AppData> => {
  const db = await openDb();
  const transaction = db.transaction([SETTINGS_STORE, RECORDS_STORE, USER_STORE], "readonly");
  const settingsStore = transaction.objectStore(SETTINGS_STORE);
  const recordsStore = transaction.objectStore(RECORDS_STORE);
  const userStore = transaction.objectStore(USER_STORE);
  const [settingsVersions, dailyRecords, userProfiles] = await Promise.all([
    requestToPromise<SettingsVersion[]>(settingsStore.getAll()),
    requestToPromise<DailyRecord[]>(recordsStore.getAll()),
    requestToPromise<UserProfile[]>(userStore.getAll()),
  ]);
  db.close();

  if (settingsVersions.length > 0) {
    return {
      settingsVersions: settingsVersions.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom)),
      dailyRecords: dailyRecords.sort((a, b) => b.data.localeCompare(a.data)),
      userProfile: userProfiles[0] ?? null,
    };
  }

  const initialSettings = createInitialSettings();
  await saveSettingsVersion(initialSettings);

  return {
    settingsVersions: [initialSettings],
    dailyRecords,
    userProfile: userProfiles[0] ?? null,
  };
};

export const saveSettingsVersion = async (version: SettingsVersion) => {
  const db = await openDb();
  const transaction = db.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put(version);
  await transactionDone(transaction);
  db.close();
};

export const saveDailyRecord = async (record: DailyRecord) => {
  const db = await openDb();
  const transaction = db.transaction(RECORDS_STORE, "readwrite");
  transaction.objectStore(RECORDS_STORE).put(record);
  await transactionDone(transaction);
  db.close();
};

export const deleteDailyRecord = async (id: string) => {
  const db = await openDb();
  const transaction = db.transaction(RECORDS_STORE, "readwrite");
  transaction.objectStore(RECORDS_STORE).delete(id);
  await transactionDone(transaction);
  db.close();
};

export const saveUserProfile = async (profile: UserProfile) => {
  const db = await openDb();
  const transaction = db.transaction(USER_STORE, "readwrite");
  transaction.objectStore(USER_STORE).put(profile);
  await transactionDone(transaction);
  db.close();
};

export const replaceAppData = async (data: AppData) => {
  const db = await openDb();
  const transaction = db.transaction([SETTINGS_STORE, RECORDS_STORE, USER_STORE], "readwrite");
  const settingsStore = transaction.objectStore(SETTINGS_STORE);
  const recordsStore = transaction.objectStore(RECORDS_STORE);
  const userStore = transaction.objectStore(USER_STORE);

  settingsStore.clear();
  recordsStore.clear();
  userStore.clear();

  for (const version of data.settingsVersions) settingsStore.put(version);
  for (const record of data.dailyRecords) recordsStore.put(record);
  if (data.userProfile) userStore.put(data.userProfile);

  await transactionDone(transaction);
  db.close();
};
