/**
 * UUID validation (RC1 stabilization — D2).
 * Guards API params and filters so malformed UUIDs never reach the database
 * (PGlite raises a raw 500 on invalid uuid input). Throws the domain error
 * INVALID_UUID, mapped by HttpExceptionFilter to HTTP 400 VALIDATION_ERROR.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** Throw INVALID_UUID (→ 400 VALIDATION_ERROR) when value is not a valid UUID. */
export function assertUuid(value: string): void {
  if (!isValidUuid(value)) throw new Error('INVALID_UUID');
}

/** Like assertUuid, but skips undefined / null / empty (optional fields). */
export function assertOptionalUuid(value: string | null | undefined): void {
  if (value === undefined || value === null || value === '') return;
  assertUuid(value);
}
