import type { OrchestrationWorkItem } from "../models/work-item";

export interface IStateStore {
  save(item: OrchestrationWorkItem): Promise<void>;
  get(workItemId: string): Promise<OrchestrationWorkItem | null>;
  update(workItemId: string, updates: Partial<OrchestrationWorkItem>): Promise<void>;
}
