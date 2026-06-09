export type Role = "team_lead" | "team_member" | "unknown";

export interface CommandResult {
  response: string;
  actionTaken?: string;
  denied?: boolean;
}

export function parseCommand(message: string, userRole: Role): CommandResult {
  const trimmed = message.trim().toLowerCase();

  if (userRole === "unknown") {
    return { response: "⛔ Access denied. Your identity could not be verified.", denied: true };
  }

  if (trimmed === "status" || trimmed.startsWith("status")) {
    return { response: "📊 Module Status: All systems operational.", actionTaken: "status_query" };
  }

  if (trimmed.startsWith("approve ")) {
    const id = trimmed.replace("approve ", "").trim();
    if (userRole === "team_lead" || userRole === "team_member") {
      return { response: `✅ Approval recorded for ${id}.`, actionTaken: `approve:${id}` };
    }
    return { response: "⛔ Insufficient permissions to approve.", denied: true };
  }

  if (trimmed.startsWith("reject ")) {
    const id = trimmed.replace("reject ", "").trim();
    if (userRole === "team_lead" || userRole === "team_member") {
      return { response: `❌ Rejection recorded for ${id}.`, actionTaken: `reject:${id}` };
    }
    return { response: "⛔ Insufficient permissions to reject.", denied: true };
  }

  return {
    response: "🤖 Available commands: status, approve [id], reject [id]\nFor help: help",
    actionTaken: "help",
  };
}
