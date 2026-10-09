export type AiTextRole = 'system' | 'user' | 'assistant';

export interface AiTextMessage {
  role: AiTextRole;
  content: string;
}

export interface AiJsonSchema {
  name: string;
  strict: true;
  schema: Record<string, unknown>;
}

export interface AiTextCompletionRequest {
  messages: AiTextMessage[];
  maxTokens?: number;
  responseFormat?: AiJsonSchema;
}

export interface AiTextCompletionResponse {
  content: string;
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
}

/** Provider boundary for server-side AI text generation. */
export interface AiTextPort {
  isAvailable(): boolean;
  complete(request: AiTextCompletionRequest): Promise<AiTextCompletionResponse>;
}
