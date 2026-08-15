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
  PASSWORD_RESET_TOKEN_INVALID: { http: 400, code: 'VALIDATION_ERROR' },
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
  ASSET_BULK_EMPTY:         { http: 400, code: 'VALIDATION_ERROR' },
  ASSET_BULK_FIELDS_REQUIRED: { http: 400, code: 'VALIDATION_ERROR' },
  ASSET_HAS_REFERENCES:     { http: 409, code: 'CONFLICT' },
  // Master data
  NAME_INVALID:              { http: 400, code: 'VALIDATION_ERROR' },
  DUPLICATE_LOCATION:        { http: 409, code: 'CONFLICT' },
  DUPLICATE_CATEGORY:        { http: 409, code: 'CONFLICT' },
  DUPLICATE_MODEL:           { http: 409, code: 'CONFLICT' },
  LOCATION_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  CATEGORY_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  MODEL_NOT_FOUND:           { http: 404, code: 'NOT_FOUND' },
  EMPLOYEE_NOT_FOUND:        { http: 404, code: 'NOT_FOUND' },
  STATUS_NOT_FOUND:          { http: 404, code: 'NOT_FOUND' },
  DUPLICATE_STATUS:          { http: 409, code: 'CONFLICT' },
  COLOR_INVALID:             { http: 400, code: 'VALIDATION_ERROR' },
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
  // Phase 10
  INVALID_AUDIT_ACTION:    { http: 400, code: 'VALIDATION_ERROR' },
  COMPLIANCE_VIEW_DENIED:  { http: 403, code: 'FORBIDDEN' },
  // Phase 11
  TEMPLATE_NOT_FOUND:      { http: 404, code: 'NOT_FOUND' },
  NOTIFICATION_NOT_FOUND:  { http: 404, code: 'NOT_FOUND' },
  // Phase 11.3 Export
  UNSUPPORTED_EXPORT_FORMAT: { http: 400, code: 'VALIDATION_ERROR' },
  UNSUPPORTED_EXPORT_RESOURCE: { http: 400, code: 'VALIDATION_ERROR' },
  // Phase 11.4 Search
  UNSUPPORTED_SEARCH_RESOURCE: { http: 400, code: 'VALIDATION_ERROR' },
  // Phase 11.4 Saved Searches (ADR-011)
  INVALID_SAVED_SEARCH_NAME: { http: 400, code: 'VALIDATION_ERROR' },
  INVALID_SAVED_SEARCH_RESOURCE: { http: 400, code: 'VALIDATION_ERROR' },
  SAVED_SEARCH_PAYLOAD_TOO_LARGE: { http: 400, code: 'VALIDATION_ERROR' },
  SAVED_SEARCH_NAME_EXISTS: { http: 409, code: 'CONFLICT' },
  SAVED_SEARCH_LIMIT_EXCEEDED: { http: 409, code: 'CONFLICT' },
  SAVED_SEARCH_NOT_FOUND: { http: 404, code: 'NOT_FOUND' },
  // RC1 stabilization (D2) — UUID validation for API params and filters
  INVALID_UUID:            { http: 400, code: 'VALIDATION_ERROR' },
};
