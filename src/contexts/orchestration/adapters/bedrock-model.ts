import type { IModelInvoker, ModelInvocation, ModelResponse } from "../domain/ports/IModelInvoker";

export class BedrockModelInvoker implements IModelInvoker {
  constructor(private readonly modelId: string) {}

  async invoke(_invocation: ModelInvocation): Promise<ModelResponse> {
    // Bedrock InvokeModel API
    return { content: "", tokensUsed: 0 };
  }
}
