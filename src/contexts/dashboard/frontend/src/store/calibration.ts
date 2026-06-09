/**
 * Zustand store slice — Calibration data
 */

import { create } from "zustand";

export interface CalibrationPoint {
  band: string;
  predictedMean: number;
  actualSuccessRate: number;
  deviation: number;
  sampleSize: number;
}

export interface MiscalibrationAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  category: string;
  module: string;
  direction: "over" | "under";
  deviation: number;
  dismissed: boolean;
}

export interface CalibrationState {
  points: CalibrationPoint[];
  brierScore: number | null;
  alerts: MiscalibrationAlert[];
  loading: boolean;
  setCalibrationData: (points: CalibrationPoint[], brierScore: number) => void;
  setAlerts: (alerts: MiscalibrationAlert[]) => void;
  dismissAlert: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useCalibrationStore = create<CalibrationState>((set) => ({
  points: [],
  brierScore: null,
  alerts: [],
  loading: false,
  setCalibrationData: (points, brierScore) => set({ points, brierScore, loading: false }),
  setAlerts: (alerts) => set({ alerts }),
  dismissAlert: (id) =>
    set((prev) => ({
      alerts: prev.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
    })),
  setLoading: (loading) => set({ loading }),
}));
