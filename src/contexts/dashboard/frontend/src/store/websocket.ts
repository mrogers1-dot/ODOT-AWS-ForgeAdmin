/**
 * Zustand store slice — WebSocket connection state
 */

import { create } from "zustand";

export interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  lastHeartbeat: string | null;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;
  recordHeartbeat: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => ({
  connected: false,
  reconnecting: false,
  lastHeartbeat: null,
  setConnected: (connected) => set({ connected, reconnecting: false }),
  setReconnecting: (reconnecting) => set({ reconnecting }),
  recordHeartbeat: () => set({ lastHeartbeat: new Date().toISOString() }),
}));
