import { describe, it, expect, vi } from "vitest";
import { research } from "./research";
import type { IKnowledgeBase } from "../ports/IKnowledgeBase";
import type { KnowledgeItem } from "../models/knowledge-item";

function makeItem(id: string, score: number): KnowledgeItem {
  return {
    itemId: id,
    title: `KB Article ${id}`,
    content: `Content for ${id}`,
    category: "health_remediation",
    relevanceScore: score,
  };
}

function mockKb(items: KnowledgeItem[]): IKnowledgeBase {
  return { query: vi.fn().mockResolvedValue(items) };
}

describe("Research Agent", () => {
  it("returns ranked items with relevance scores", async () => {
    const items = [makeItem("kb-1", 0.9), makeItem("kb-2", 0.7), makeItem("kb-3", 0.5)];
    const result = await research(mockKb(items), "health_remediation", ["disk"]);

    expect(result.items).toHaveLength(3);
    expect(result.items[0].relevanceScore).toBeGreaterThanOrEqual(result.items[1].relevanceScore);
    expect(result.items[1].relevanceScore).toBeGreaterThanOrEqual(result.items[2].relevanceScore);
    expect(result.knowledgeGap).toBe(false);
    expect(result.kbUnavailable).toBe(false);
  });

  it("filters out items below 0.3 threshold", async () => {
    const items = [makeItem("kb-1", 0.8), makeItem("kb-2", 0.2), makeItem("kb-3", 0.1)];
    const result = await research(mockKb(items), "health_remediation", ["disk"]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].itemId).toBe("kb-1");
  });

  it("returns max 10 items even if more available", async () => {
    const items = Array.from({ length: 15 }, (_, i) => makeItem(`kb-${i}`, 0.9 - i * 0.03));
    const result = await research(mockKb(items), "health_remediation", ["disk"]);

    expect(result.items.length).toBeLessThanOrEqual(10);
  });

  it("flags knowledge gap when no items are above threshold", async () => {
    const items = [makeItem("kb-1", 0.1), makeItem("kb-2", 0.2)];
    const result = await research(mockKb(items), "health_remediation", ["disk"]);

    expect(result.items).toHaveLength(0);
    expect(result.knowledgeGap).toBe(true);
  });

  it("returns kbUnavailable when KB query fails", async () => {
    const kb: IKnowledgeBase = { query: vi.fn().mockRejectedValue(new Error("Connection refused")) };
    const result = await research(kb, "health_remediation", ["disk"]);

    expect(result.items).toHaveLength(0);
    expect(result.kbUnavailable).toBe(true);
  });
});
