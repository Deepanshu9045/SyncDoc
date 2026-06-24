import * as Y from "yjs";
import { dexieDb } from "../db/dexie-db";
import { useSyncStore, ConnectionStatus } from "../store/sync-store";

// Base64 Helpers
export function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

class OfflineSyncEngine {
  private backoffDelays = [1000, 2000, 4000, 8000, 16000];
  private backoffIndex = 0;
  private syncTimeout: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
      
      // Initial status check
      const initialStatus = navigator.onLine ? "online" : "offline";
      useSyncStore.getState().setStatus(initialStatus);

      // Start periodic sync and initial check
      this.startSyncLoop();
    }
  }

  private handleNetworkChange(isOnline: boolean) {
    const store = useSyncStore.getState();
    if (isOnline) {
      store.setStatus("online");
      this.backoffIndex = 0;
      this.triggerSync();
    } else {
      store.setStatus("offline");
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }
    }
  }

  public async queueOperation(documentId: string, operation: Uint8Array) {
    await dexieDb.syncQueue.add({
      documentId,
      operation,
      timestamp: Date.now(),
      status: "pending",
    });

    const pendingCount = await dexieDb.syncQueue.count();
    useSyncStore.getState().setPendingCount(pendingCount);

    this.triggerSync();
  }

  public triggerSync() {
    if (this.isSyncing) return;
    if (typeof window !== "undefined" && !navigator.onLine) {
      useSyncStore.getState().setStatus("offline");
      return;
    }

    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    this.syncTimeout = setTimeout(() => this.processSyncQueue(), 0);
  }

  private startSyncLoop() {
    this.triggerSync();
    // Periodically sync every 30 seconds just in case
    setInterval(() => this.triggerSync(), 30000);
  }

  private async processSyncQueue() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    const store = useSyncStore.getState();
    const pendingCount = await dexieDb.syncQueue.count();
    store.setPendingCount(pendingCount);

    if (pendingCount === 0) {
      this.isSyncing = false;
      if (navigator.onLine) store.setStatus("online");
      return;
    }

    store.setStatus("syncing");

    try {
      // Group queue items by documentId to sync in batches
      const allPending = await dexieDb.syncQueue.toArray();
      const docsToSync = Array.from(new Set(allPending.map((item) => item.documentId)));

      for (const docId of docsToSync) {
        const docUpdates = allPending.filter((item) => item.documentId === docId);
        
        // Load the local Yjs state vector so the server knows what updates we have
        const localDoc = await dexieDb.documents.get(docId);
        let stateVectorB64 = "";

        if (localDoc?.yjsState) {
          const ydoc = new Y.Doc();
          Y.applyUpdate(ydoc, localDoc.yjsState);
          stateVectorB64 = uint8ArrayToBase64(Y.encodeStateVector(ydoc));
        }

        const pendingUpdatesB64 = docUpdates.map((item) =>
          uint8ArrayToBase64(item.operation)
        );

        // Send to backend endpoint
        const res = await fetch(`/api/documents/${docId}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stateVector: stateVectorB64,
            pendingUpdates: pendingUpdatesB64,
          }),
        });

        if (!res.ok) {
          throw new Error(`Sync request failed with status ${res.status}`);
        }

        const data = await res.json();

        // Apply server updates to local IndexedDB doc cache
        if (data.serverUpdate) {
          const serverUpdateBinary = base64ToUint8Array(data.serverUpdate);
          
          // Apply to local state
          const currentLocalDoc = await dexieDb.documents.get(docId);
          let newLocalState: Uint8Array;
          
          if (currentLocalDoc?.yjsState) {
            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, currentLocalDoc.yjsState);
            Y.applyUpdate(ydoc, serverUpdateBinary);
            newLocalState = Y.encodeStateAsUpdate(ydoc);
          } else {
            newLocalState = serverUpdateBinary;
          }

          // Convert to readable text representation (just text content or empty string)
          const tempYdoc = new Y.Doc();
          Y.applyUpdate(tempYdoc, newLocalState);
          const ytext = tempYdoc.getText("default");
          
          await dexieDb.documents.update(docId, {
            yjsState: newLocalState,
            content: ytext.toString(),
            updatedAt: Date.now(),
          });
        }

        // Delete synced items from IndexedDB syncQueue
        const syncedIds = docUpdates.map((item) => item.id).filter((id): id is number => id !== undefined);
        await dexieDb.syncQueue.bulkDelete(syncedIds);
      }

      // Reset exponential backoff on success
      this.backoffIndex = 0;
      store.setStatus("online");
      store.setLastSyncedAt(new Date());
      store.setError(null);

      // Recursive call to check if new items entered during sync
      const finalCount = await dexieDb.syncQueue.count();
      store.setPendingCount(finalCount);
      this.isSyncing = false;

      if (finalCount > 0) {
        this.triggerSync();
      }
    } catch (err: any) {
      console.error("OfflineSyncEngine Sync Error:", err);
      store.setStatus("error");
      store.setError(err.message || "Failed to synchronize changes");
      this.isSyncing = false;

      // Retry using exponential backoff
      const delay = this.backoffDelays[this.backoffIndex];
      this.backoffIndex = Math.min(this.backoffIndex + 1, this.backoffDelays.length - 1);
      
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }
      this.syncTimeout = setTimeout(() => this.processSyncQueue(), delay);
    }
  }
}

// Global engine instance
let syncEngineInstance: OfflineSyncEngine | null = null;

export function getSyncEngine(): OfflineSyncEngine {
  if (!syncEngineInstance) {
    syncEngineInstance = new OfflineSyncEngine();
  }
  return syncEngineInstance;
}
