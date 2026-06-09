export interface ModelInvocation {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ModelResponse {
  content: string;
  tokensUsed: number;
}

export interface IModelInvoker {
  invoke(invocation: ModelInvocation): Promise<ModelResponse>;
}
