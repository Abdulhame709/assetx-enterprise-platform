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
  // Asset module
  ASSET_NOT_FOUND:         { http: 404, code: 'NOT_FOUND' },
  ASSET_NAME_INVALID:      { http: 400, code: 'VALIDATION_ERROR' },
  CATEGORY_REQUIRED:       { http: 400, code: 'VALIDATION_ERROR' },
  LOCATION_REQUIRED:       { http: 400, code: 'VALIDATION_ERROR' },
  STATUS_REQUIRED:         { http: 400, code: 'VALIDATION_ERROR' },
  QUANTITY_INVALID:        { http: 400, code: 'VALIDATION_ERROR' },
  PRICE_INVALID:           { http: 400, code: 'VALIDATION_ERROR' },
  DEPRECIATION_RATE_INVALID: { http: 400, code: 'VALIDATION_ERROR' },
  TRANSFER_TARGET_REQUIRED: { http: 400, code: 'VALIDATION_ERROR' },
  // Master data
  NAME_INVALID:              { http: 400, code: 'VALIDATION_ERROR' },
  DUPLICATE_LOCATION:        { http: 409, code: 'CONFLICT' },
  DUPLICATE_CATEGORY:        { http: 409, code: 'CONFLICT' },
  DUPLICATE_MODEL:           { http: 409, code: 'CONFLICT' },
  LOCATION_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  CATEGORY_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  MODEL_NOT_FOUND:           { http: 404, code: 'NOT_FOUND' },
  EMPLOYEE_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  PARENT_NOT_FOUND:          { http: 404, code: 'NOT_FOUND' },
  LOCATION_HAS_CHILDREN:     { http: 409, code: 'CONFLICT' },
  LOCATION_HAS_ASSETS:       { http: 409, code: 'CONFLICT' },
  EMPLOYEE_HAS_ASSETS:       { http: 409, code: 'CONFLICT' },
  // Inventory
  INVALID_YEAR:              { http: 400, code: 'VALIDATION_ERROR' },
  CYCLE_YEAR_EXISTS:         { http: 409, code: 'CONFLICT' },
  CYCLE_NOT_FOUND:           { http: 404, code: 'NOT_FOUND' },
  CYCLE_CLOSED:              { http: 409, code: 'CONFLICT' },
  INVALID_CYCLE_TRANSITION:  { http: 409, code: 'CONFLICT' },
  RECORD_NOT_FOUND:          { http: 404, code: 'NOT_FOUND' },
  ASSET_NOT_IN_CYCLE:        { http: 404, code: 'NOT_FOUND' },
  CANNOT_VERIFY_UNINVENTORIED: { http: 409, code: 'CONFLICT' },
  // Movement
  MOVEMENT_NOT_FOUND:      { http: 404, code: 'NOT_FOUND' },
  MOVEMENT_NOT_PENDING:    { http: 409, code: 'CONFLICT' },
  ASSET_INACTIVE:          { http: 409, code: 'CONFLICT' },
  EMPLOYEE_INACTIVE:       { http: 409, code: 'CONFLICT' },
  SAME_LOCATION:           { http: 409, code: 'CONFLICT' },
  DUPLICATE_PENDING:       { http: 409, code: 'CONFLICT' },
  // Phase 9.5
  PERMISSIONS_STALE:       { http: 401, code: 'PERMISSIONS_STALE' },
};
