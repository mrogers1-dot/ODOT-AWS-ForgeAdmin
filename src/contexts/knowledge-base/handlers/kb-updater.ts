/**
 * KB Updater — persists resolution data to the knowledge base with retry logic.
 */

export interface KBUpdateInput {
  workItemId: string;
  resolutionSteps: string[];
  rootCause: string;
  affectedSystems: string[];
}

export type UpdateStoreFn = (data: KBUpdateInput) => Promise<void>;

export interface KBUpdateResult {
  success: boolean;
  notifyFailure: boolean;
  error?: string;
}

export async function updateKnowledgeBase(
  input: KBUpdateInput,
  store: UpdateStoreFn,
  maxRetries: number = 3,
): Promise<KBUpdateResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await store(input);
      return { success: true, notifyFailure: false };
    } catch (err) {
      if (attempt === maxRetries) {
        return { success: false, notifyFailure: true, error: (err as Error).message };
      }
    }
  }
  return { success: false, notifyFailure: true, error: "Max retries exceeded" };
}
