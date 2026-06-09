/**
 * Zustand store slice — Approvals
 */

import { create } from "zustand";

export interface Approval {
  id: string;
  workItemId: string;
  planId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  confidenceScore: number;
  riskLevel: "low" | "medium" | "high";
  justification: string;
  createdAt: string;
}

export interface ApprovalsState {
  approvals: Approval[];
  loading: boolean;
  setApprovals: (approvals: Approval[]) => void;
  addApproval: (approval: Approval) => void;
  updateStatus: (id: string, status: Approval["status"]) => void;
}

export const useApprovalsStore = create<ApprovalsState>((set) => ({
  approvals: [],
  loading: false,
  setApprovals: (approvals) => set({ approvals, loading: false }),
  addApproval: (approval) => set((prev) => ({ approvals: [...prev.approvals, approval] })),
  updateStatus: (id, status) =>
    set((prev) => ({
      approvals: prev.approvals.map((a) => (a.id === id ? { ...a, status } : a)),
    })),
}));
