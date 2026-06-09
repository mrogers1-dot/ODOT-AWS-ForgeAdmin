import type { KnowledgeItem } from "../models/knowledge-item";

export interface IKnowledgeBase {
  query(category: string, keywords: string[]): Promise<KnowledgeItem[]>;
}
