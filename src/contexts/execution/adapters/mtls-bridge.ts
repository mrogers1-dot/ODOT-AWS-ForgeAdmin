export interface IExecutionBridge {
  submitCommand(command: string): Promise<{ success: boolean; output: string }>;
}

export class MtlsBridge implements IExecutionBridge {
  constructor(private readonly endpoint: string) {}

  async submitCommand(_command: string): Promise<{ success: boolean; output: string }> {
    // mTLS HTTPS request via Transit Gateway
    return { success: true, output: "" };
  }
}
