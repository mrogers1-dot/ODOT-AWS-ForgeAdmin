/**
 * KB Query Handler — queries the knowledge base and returns filtered, ranked results.
 */

export interface KBQueryInput {
  category: string;
  keywords: string[];
}

export interface KBQueryItem {
  itemId: string;
  title: string;
  content: string;
  relevanceScore: number;
}

export interface KBQueryResult {
  items: KBQueryItem[];
  kbUnavailable: boolean;
}

export type KBQueryFn = (category: string, keywords: string[]) => Promise<KBQueryItem[]>;

export async function handleKBQuery(input: KBQueryInput, queryFn: KBQueryFn): Promise<KBQueryResult> {
  try {
    const raw = await queryFn(input.category, input.keywords);
    const filtered = raw
      .filter((item) => item.relevanceScore >= 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);
    return { items: filtered, kbUnavailable: false };
  } catch {
    return { items: [], kbUnavailable: true };
  }
}
