import type { IKnowledgeBase } from "../domain/ports/IKnowledgeBase";
import type { KnowledgeItem } from "../domain/models/knowledge-item";

export class KnowledgeBaseClient implements IKnowledgeBase {
  constructor(private readonly kbId: string) {}

  async query(_category: string, _keywords: string[]): Promise<KnowledgeItem[]> {
    // Bedrock KB RetrieveAndGenerate API
    return [];
  }
}
