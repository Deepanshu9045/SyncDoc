import { create } from "zustand";

export type ConnectionStatus = "online" | "offline" | "syncing" | "error";

interface SyncState {
  status: ConnectionStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  error: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setPendingCount: (count: number) => void;
  setLastSyncedAt: (date: Date) => void;
  setError: (error: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "online",
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setError: (error) => set({ error }),
}));
