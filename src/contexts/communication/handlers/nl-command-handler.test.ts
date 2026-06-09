import { describe, it, expect } from "vitest";
import { parseCommand } from "./nl-command-handler";

describe("NL Command Handler", () => {
  it('"status" query returns module state summary', () => {
    const result = parseCommand("status", "team_lead");
    expect(result.actionTaken).toBe("status_query");
    expect(result.response).toContain("Module Status");
  });

  it('"approve [id]" returns approval action', () => {
    const result = parseCommand("approve WI-456", "team_lead");
    expect(result.actionTaken).toBe("approve:wi-456");
    expect(result.response).toContain("Approval recorded");
  });

  it("unknown command returns help text", () => {
    const result = parseCommand("do something random", "team_member");
    expect(result.actionTaken).toBe("help");
    expect(result.response).toContain("Available commands");
  });

  it("unauthorized user gets denial", () => {
    const result = parseCommand("status", "unknown");
    expect(result.denied).toBe(true);
    expect(result.response).toContain("Access denied");
  });
});
