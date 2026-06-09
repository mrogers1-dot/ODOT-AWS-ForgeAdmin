import { describe, it, expect, vi } from "vitest";
import { checkDuplicate } from "./deduplication";

describe("deduplication", () => {
  it("returns true when item already exists", async () => {
    const mockLookup = vi.fn().mockResolvedValue(true);
    const result = await checkDuplicate("servicenow", "INC001", mockLookup);
    expect(result).toBe(true);
    expect(mockLookup).toHaveBeenCalledWith("servicenow", "INC001");
  });

  it("returns false for new item", async () => {
    const mockLookup = vi.fn().mockResolvedValue(false);
    const result = await checkDuplicate("servicenow", "INC999", mockLookup);
    expect(result).toBe(false);
  });
});
