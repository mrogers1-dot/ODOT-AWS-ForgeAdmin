export interface DigestInput {
  overnightActions: number;
  pendingApprovals: number;
  moduleHealth: { healthy: number; degraded: number };
  anomalies: string[];
}

export interface DigestResult {
  message: string;
  hasActivity: boolean;
}

export function generateDigest(input: DigestInput): DigestResult {
  if (input.overnightActions === 0 && input.pendingApprovals === 0 && input.anomalies.length === 0) {
    return { message: "☀️ Good morning! No overnight activity to report.", hasActivity: false };
  }

  const parts: string[] = ["☀️ ForgeAdmin Morning Digest"];
  parts.push(`• Overnight actions: ${input.overnightActions}`);
  parts.push(`• Pending approvals: ${input.pendingApprovals}`);
  parts.push(`• Module health: ${input.moduleHealth.healthy} healthy, ${input.moduleHealth.degraded} degraded`);

  if (input.anomalies.length > 0) {
    parts.push(`• ⚠️ Anomalies: ${input.anomalies.join(", ")}`);
  }

  return { message: parts.join("\n"), hasActivity: true };
}
