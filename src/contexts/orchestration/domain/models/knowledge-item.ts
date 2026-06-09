/**
 * KnowledgeItem — result from KB query with relevance scoring.
 */

export interface KnowledgeItem {
  readonly itemId: string;
  readonly title: string;
  readonly content: string;
  readonly category: string;
  readonly relevanceScore: number; // 0.0 - 1.0
}
