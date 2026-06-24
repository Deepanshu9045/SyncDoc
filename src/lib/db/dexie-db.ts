import Dexie, { type Table } from "dexie";

export interface LocalDocument {
  id: string;
  title: string;
  content: string; // HTML or JSON text representation
  ownerId: string;
  yjsState?: Uint8Array; // Saved local Yjs document state binary
  createdAt: number;
  updatedAt: number;
}

export interface SyncQueueItem {
  id?: number; // Auto-incrementing primary key
  documentId: string;
  operation: Uint8Array; // Yjs update binary
  timestamp: number;
  status: "pending" | "syncing" | "failed";
}

class SyncDocDexie extends Dexie {
  documents!: Table<LocalDocument, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("SyncDocDatabase");
    this.version(1).stores({
      documents: "id, title, ownerId, updatedAt",
      syncQueue: "++id, documentId, timestamp, status",
    });
  }
}

export const dexieDb = new SyncDocDexie();
export default dexieDb;
