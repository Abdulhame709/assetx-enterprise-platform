import { Injectable } from '@nestjs/common';
import {
  AiTextCompletionRequest,
  AiTextCompletionResponse,
  AiTextPort,
} from '../../core/ports/ai-text.port';

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function positiveInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeBaseUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

type ProviderResponse = {
  model?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

@Injectable()
export class OpenAiCompatibleTextProvider implements AiTextPort {
  private readonly isEnabled = enabled(process.env.AI_ENABLED);
  private readonly provider = (process.env.AI_PROVIDER ?? 'disabled').trim().toLowerCase();
  private readonly baseUrl = normalizeBaseUrl(process.env.AI_BASE_URL);
  private readonly apiKey = (process.env.AI_API_KEY ?? '').trim();
  private readonly model = (process.env.AI_MODEL ?? '').trim();
  private readonly timeoutMs = positiveInt(process.env.AI_TIMEOUT_MS, 15_000, 1_000, 60_000);
  private readonly defaultMaxTokens = positiveInt(process.env.AI_MAX_OUTPUT_TOKENS, 900, 128, 4_000);

  isAvailable(): boolean {
    return this.isEnabled
      && this.provider === 'openai-compatible'
      && this.baseUrl.length > 0
      && this.apiKey.length > 0
      && this.model.length > 0;
  }

  async complete(request: AiTextCompletionRequest): Promise<AiTextCompletionResponse> {
    if (!this.isAvailable()) throw new Error('AI_PROVIDER_UNAVAILABLE');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          max_tokens: Math.min(4_000, Math.max(128, request.maxTokens ?? this.defaultMaxTokens)),
          ...(request.responseFormat ? {
            response_format: {
              type: 'json_schema',
              json_schema: request.responseFormat,
            },
          } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('AI_PROVIDER_HTTP_ERROR');
      const payload = await response.json() as ProviderResponse;
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        throw new Error('AI_PROVIDER_EMPTY_RESPONSE');
      }

      return {
        content,
        model: typeof payload.model === 'string' ? payload.model : this.model,
        provider: this.provider,
        inputTokens: this.toOptionalNumber(payload.usage?.prompt_tokens),
        outputTokens: this.toOptionalNumber(payload.usage?.completion_tokens),
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new Error('AI_PROVIDER_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private toOptionalNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }
}
