import { CONFIG } from "../../shared/config";

export interface SavedSession {
  id: string;
  userId: typeof CONFIG.userId;
  songId: string;
  referenceVersion: number;
  appVersion: string;
  state: "COMPLETED" | "STOPPED";
  startedAt: number;
  endedAt: number;
  calibrationOffsetMs: number;
  metrics: Record<string, number>;
}

export class SessionRepository {
  async open() {
    return await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("pitch-matcher-sessions", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async save(session: SavedSession) {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("sessions", "readwrite");
      tx.objectStore("sessions").put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async history() {
    const db = await this.open();
    const rows = await new Promise<SavedSession[]>((resolve, reject) => {
      const tx = db.transaction("sessions", "readonly");
      const request = tx.objectStore("sessions").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return rows;
  }
}
