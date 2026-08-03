/**
 * AssetX error code catalog (subset for the Backend Foundation).
 * Reference: API Spec (DOC-10) §16 · ES-08 Error Code Catalog (planned)
 * Maps domain error strings to HTTP status + a stable error code.
 */
export const ERROR_CODES: Record<string, { http: number; code: string }> = {
  UNAUTHORIZED:            { http: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN:               { http: 403, code: 'FORBIDDEN' },
  INVALID_CREDENTIALS:     { http: 401, code: 'INVALID_CREDENTIALS' },
  PASSWORD_TOO_WEAK:       { http: 400, code: 'VALIDATION_ERROR' },
  TENANT_REQUIRED:         { http: 400, code: 'VALIDATION_ERROR' },
  USERNAME_EXISTS:         { http: 409, code: 'CONFLICT' },
  USER_NOT_FOUND:          { http: 404, code: 'NOT_FOUND' },
  TENANT_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  SESSION_REVOKED:         { http: 401, code: 'UNAUTHORIZED' },
};
