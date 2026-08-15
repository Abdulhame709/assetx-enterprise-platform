/**
 * DomainError preserves safe, structured context for known business-rule
 * violations while keeping the API error envelope consistent.
 */
export class DomainError extends Error {
  constructor(
    code: string,
    readonly details: Record<string, number | string | boolean | null> = {},
  ) {
    super(code);
    this.name = 'DomainError';
  }
}
