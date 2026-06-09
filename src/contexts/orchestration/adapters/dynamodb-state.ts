import type { IStateStore } from "../domain/ports/IStateStore";
import type { OrchestrationWorkItem } from "../domain/models/work-item";

export class DynamoDBStateStore implements IStateStore {
  constructor(private readonly tableName: string) {}

  async save(_item: OrchestrationWorkItem): Promise<void> {
    // DynamoDB PutItem
    return;
  }

  async get(_workItemId: string): Promise<OrchestrationWorkItem | null> {
    // DynamoDB GetItem
    return null;
  }

  async update(_workItemId: string, _updates: Partial<OrchestrationWorkItem>): Promise<void> {
    // DynamoDB UpdateItem
    return;
  }
}
