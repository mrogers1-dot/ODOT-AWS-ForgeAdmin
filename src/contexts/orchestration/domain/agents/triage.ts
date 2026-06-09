/**
 * Triage Agent — classifies work items into category, risk, and urgency.
 *
 * This is a rule-based classifier. In production, the LLM augments these
 * rules, but the deterministic fallback ensures we always produce a result.
 */

import type { WorkItemCategory, RiskLevel, UrgencyLevel } from "@forgeadmin/shared";
import type { OrchestrationWorkItem } from "../models/work-item";

export interface TriageResult {
  category: WorkItemCategory;
  riskLevel: RiskLevel;
  urgencyLevel: UrgencyLevel;
  justification: string;
}

const SECURITY_KEYWORDS = [
  "brute force", "unauthorized", "intrusion", "malware", "ransomware",
  "phishing", "vulnerability", "exploit", "attack", "breach", "threat",
  "fortisiem", "security",
];

const HEALTH_KEYWORDS = [
  "disk", "memory", "cpu", "service down", "unreachable", "timeout",
  "degraded", "capacity", "outage", "connectivity", "health",
];

const ACCOUNT_KEYWORDS = [
  "locked", "lockout", "password", "reset", "access", "permission",
  "account", "provisioning", "deprovisioning",
];

function classifyCategory(item: OrchestrationWorkItem): WorkItemCategory {
  const text = `${item.title} ${item.description} ${item.affectedSystem ?? ""}`.toLowerCase();

  // FortiSIEM source is always security
  if (item.sourceSystem === "fortisiem") return "security_alert";

  // Keyword matching by priority
  if (SECURITY_KEYWORDS.some((kw) => text.includes(kw))) return "security_alert";
  if (HEALTH_KEYWORDS.some((kw) => text.includes(kw))) return "health_remediation";
  if (ACCOUNT_KEYWORDS.some((kw) => text.includes(kw))) return "account_service_request";

  return "knowledge_capture";
}

function classifyRisk(item: OrchestrationWorkItem, category: WorkItemCategory): RiskLevel {
  // Security alerts default to high
  if (category === "security_alert") return "high";

  const text = `${item.title} ${item.description}`.toLowerCase();

  // Multi-system or environment-wide indicators
  if (text.includes("all") || text.includes("environment") || text.includes("multiple")) return "high";
  if (text.includes("server") || text.includes("service")) return "medium";

  return "low";
}

function classifyUrgency(item: OrchestrationWorkItem, category: WorkItemCategory, riskLevel: RiskLevel): UrgencyLevel {
  if (category === "security_alert" || riskLevel === "high") return "high";
  if (riskLevel === "medium") return "normal";
  if (item.priority === "1" || item.urgency === "1") return "critical";
  if (item.priority === "2" || item.urgency === "2") return "high";
  return "normal";
}

function hasInsufficientData(item: OrchestrationWorkItem): boolean {
  return (!item.title || item.title.trim() === "") &&
         (!item.description || item.description.trim() === "");
}

function buildJustification(
  item: OrchestrationWorkItem,
  category: WorkItemCategory,
  riskLevel: RiskLevel,
  urgencyLevel: UrgencyLevel,
  insufficient: boolean,
): string {
  if (insufficient) {
    return `Defaulted to high risk/high urgency due to missing title and description attributes. Source: ${item.sourceSystem}, ID: ${item.originalId}.`;
  }

  const parts: string[] = [];
  parts.push(`Category=${category}: based on "${item.title || item.description}".`);

  if (item.sourceSystem === "fortisiem") {
    parts.push("Source is FortiSIEM — classified as security alert.");
  }
  if (item.affectedSystem) {
    parts.push(`Affected system: ${item.affectedSystem}.`);
  }
  parts.push(`Risk=${riskLevel}, Urgency=${urgencyLevel}.`);

  return parts.join(" ");
}

export function triage(item: OrchestrationWorkItem): TriageResult {
  const insufficient = hasInsufficientData(item);

  if (insufficient) {
    return {
      category: "knowledge_capture",
      riskLevel: "high",
      urgencyLevel: "high",
      justification: buildJustification(item, "knowledge_capture", "high", "high", true),
    };
  }

  const category = classifyCategory(item);
  const riskLevel = classifyRisk(item, category);
  const urgencyLevel = classifyUrgency(item, category, riskLevel);
  const justification = buildJustification(item, category, riskLevel, urgencyLevel, false);

  return { category, riskLevel, urgencyLevel, justification };
}
