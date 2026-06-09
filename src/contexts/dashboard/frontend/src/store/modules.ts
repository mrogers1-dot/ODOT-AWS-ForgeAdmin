/**
 * Zustand store slice — Modules
 */

import { create } from "zustand";

export interface Module {
  id: string;
  name: string;
  state: "enabled" | "disabled" | "shadow";
  confidenceThreshold: number;
  lastExecution?: string;
  confidenceScore?: number;
}

export interface ModulesState {
  modules: Module[];
  loading: boolean;
  error: string | null;
  setModules: (modules: Module[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateModuleState: (id: string, state: Module["state"]) => void;
}

export const useModulesStore = create<ModulesState>((set) => ({
  modules: [],
  loading: false,
  error: null,
  setModules: (modules) => set({ modules, loading: false, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  updateModuleState: (id, state) =>
    set((prev) => ({
      modules: prev.modules.map((m) => (m.id === id ? { ...m, state } : m)),
    })),
}));
