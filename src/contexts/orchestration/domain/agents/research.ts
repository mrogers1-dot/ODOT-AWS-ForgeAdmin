/**
 * Research Agent — queries the knowledge base and returns ranked, filtered results.
 */

import type { KnowledgeItem } from "../models/knowledge-item";
import type { IKnowledgeBase } from "../ports/IKnowledgeBase";

export interface ResearchResult {
  items: KnowledgeItem[];
  knowledgeGap: boolean;
  kbUnavailable: boolean;
}

const RELEVANCE_THRESHOLD = 0.3;
const MAX_ITEMS = 10;

export async function research(
  kb: IKnowledgeBase,
  category: string,
  keywords: string[],
): Promise<ResearchResult> {
  let rawItems: KnowledgeItem[];

  try {
    rawItems = await kb.query(category, keywords);
  } catch {
    return { items: [], knowledgeGap: false, kbUnavailable: true };
  }

  const filtered = rawItems
    .filter((item) => item.relevanceScore >= RELEVANCE_THRESHOLD)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, MAX_ITEMS);

  return {
    items: filtered,
    knowledgeGap: filtered.length === 0,
    kbUnavailable: false,
  };
}
