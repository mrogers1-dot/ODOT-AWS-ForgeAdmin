import { describe, it, expect, vi } from "vitest";
import { handleKBQuery } from "./query-handler";
import type { KBQueryFn, KBQueryItem } from "./query-handler";

function makeItem(id: string, score: number): KBQueryItem {
  return {
    itemId: id,
    title: `Article ${id}`,
    content: `Content for ${id}`,
    relevanceScore: score,
  };
}

describe("KB Query Handler", () => {
  it("returns ranked items filtered by threshold (0.3)", async () => {
    const queryFn: KBQueryFn = vi.fn().mockResolvedValue([
      makeItem("kb-1", 0.9),
      makeItem("kb-2", 0.5),
      makeItem("kb-3", 0.2), // below threshold
    ]);

    const result = await handleKBQuery({ category: "health", keywords: ["disk"] }, queryFn);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].itemId).toBe("kb-1");
    expect(result.items[1].itemId).toBe("kb-2");
    expect(result.kbUnavailable).toBe(false);
  });

  it("caps at 10 items", async () => {
    const items = Array.from({ length: 15 }, (_, i) => makeItem(`kb-${i}`, 0.9 - i * 0.03));
    const queryFn: KBQueryFn = vi.fn().mockResolvedValue(items);

    const result = await handleKBQuery({ category: "health", keywords: ["cpu"] }, queryFn);

    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it("empty results return empty array", async () => {
    const queryFn: KBQueryFn = vi.fn().mockResolvedValue([]);

    const result = await handleKBQuery({ category: "health", keywords: ["unknown"] }, queryFn);

    expect(result.items).toHaveLength(0);
    expect(result.kbUnavailable).toBe(false);
  });

  it("error returns error result with kbUnavailable flag", async () => {
    const queryFn: KBQueryFn = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const result = await handleKBQuery({ category: "health", keywords: ["disk"] }, queryFn);

    expect(result.items).toHaveLength(0);
    expect(result.kbUnavailable).toBe(true);
  });
});
