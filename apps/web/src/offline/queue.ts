import type { NbaRecommendation, SyncConflict, SyncFeedbackRequest, SyncVisitRequest } from "../api";

const DB_NAME = "nba-offline";
const DB_VERSION = 1;
const VISITS_STORE = "queued-visits";
const FEEDBACK_STORE = "queued-feedback";
const SNAPSHOT_STORE = "snapshots";
const CONFLICT_STORE = "sync-conflicts";
const NBA_SNAPSHOT_KEY = "nba-next";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VISITS_STORE)) {
        db.createObjectStore(VISITS_STORE, { keyPath: "clientReferenceId" });
      }
      if (!db.objectStoreNames.contains(FEEDBACK_STORE)) {
        db.createObjectStore(FEEDBACK_STORE, { keyPath: "clientReferenceId" });
      }
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
        db.createObjectStore(CONFLICT_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function queueVisit(item: SyncVisitRequest): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(VISITS_STORE, "readwrite");
  tx.objectStore(VISITS_STORE).put(item);
  await txComplete(tx);
  db.close();
}

export async function queueFeedback(item: SyncFeedbackRequest): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(FEEDBACK_STORE, "readwrite");
  tx.objectStore(FEEDBACK_STORE).put(item);
  await txComplete(tx);
  db.close();
}

export async function getQueuedVisits(): Promise<SyncVisitRequest[]> {
  const db = await openDb();
  const tx = db.transaction(VISITS_STORE, "readonly");
  const items = await requestResult(tx.objectStore(VISITS_STORE).getAll()) as SyncVisitRequest[];
  await txComplete(tx);
  db.close();
  return items;
}

export async function getQueuedFeedback(): Promise<SyncFeedbackRequest[]> {
  const db = await openDb();
  const tx = db.transaction(FEEDBACK_STORE, "readonly");
  const items = await requestResult(tx.objectStore(FEEDBACK_STORE).getAll()) as SyncFeedbackRequest[];
  await txComplete(tx);
  db.close();
  return items;
}

export async function removeQueuedItems(visitRefs: string[], feedbackRefs: string[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([VISITS_STORE, FEEDBACK_STORE], "readwrite");
  const visitsStore = tx.objectStore(VISITS_STORE);
  for (const reference of visitRefs) {
    visitsStore.delete(reference);
  }
  const feedbackStore = tx.objectStore(FEEDBACK_STORE);
  for (const reference of feedbackRefs) {
    feedbackStore.delete(reference);
  }
  await txComplete(tx);
  db.close();
}

export async function queueSize(): Promise<number> {
  const db = await openDb();
  const tx = db.transaction([VISITS_STORE, FEEDBACK_STORE], "readonly");
  const visitCount = await requestResult(tx.objectStore(VISITS_STORE).count());
  const feedbackCount = await requestResult(tx.objectStore(FEEDBACK_STORE).count());
  await txComplete(tx);
  db.close();
  return visitCount + feedbackCount;
}

export async function cacheNbaSnapshot(recommendations: NbaRecommendation[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(SNAPSHOT_STORE, "readwrite");
  tx.objectStore(SNAPSHOT_STORE).put({
    key: NBA_SNAPSHOT_KEY,
    recommendations,
    savedAt: new Date().toISOString(),
  });
  await txComplete(tx);
  db.close();
}

export async function getCachedNbaSnapshot(): Promise<{ recommendations: NbaRecommendation[]; savedAt: string } | null> {
  const db = await openDb();
  const tx = db.transaction(SNAPSHOT_STORE, "readonly");
  const stored = await requestResult(tx.objectStore(SNAPSHOT_STORE).get(NBA_SNAPSHOT_KEY)) as
    | { recommendations: NbaRecommendation[]; savedAt: string }
    | undefined;
  await txComplete(tx);
  db.close();
  if (!stored) {
    return null;
  }
  return stored;
}

export async function saveConflicts(conflicts: SyncConflict[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(CONFLICT_STORE, "readwrite");
  const store = tx.objectStore(CONFLICT_STORE);
  store.clear();
  for (const conflict of conflicts) {
    store.add(conflict);
  }
  await txComplete(tx);
  db.close();
}

export async function getConflicts(): Promise<SyncConflict[]> {
  const db = await openDb();
  const tx = db.transaction(CONFLICT_STORE, "readonly");
  const conflicts = await requestResult(tx.objectStore(CONFLICT_STORE).getAll()) as SyncConflict[];
  await txComplete(tx);
  db.close();
  return conflicts;
}