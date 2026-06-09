export interface ExecutionState {
  planId: string;
  status: "running" | "completed" | "failed";
  currentStep: number;
  startedAt: string;
}

export class ExecutionDynamoDBState {
  constructor(private readonly tableName: string) {}

  async save(_state: ExecutionState): Promise<void> {
    return;
  }

  async get(_planId: string): Promise<ExecutionState | null> {
    return null;
  }

  async update(_planId: string, _updates: Partial<ExecutionState>): Promise<void> {
    return;
  }
}
