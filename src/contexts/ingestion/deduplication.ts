/**
 * Deduplication checker for ingested work items.
 *
 * Checks whether a work item with the same source system + original ID
 * has already been ingested.
 */

import type { DuplicateLookup } from "./models";

export async function checkDuplicate(
  sourceSystem: string,
  originalId: string,
  lookup: DuplicateLookup,
): Promise<boolean> {
  return lookup(sourceSystem, originalId);
}
