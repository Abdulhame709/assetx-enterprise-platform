/**
 * Dependency-injection tokens for core ports (NestJS requires value tokens).
 * Keeps Clean Architecture: domain ports are injectable by string token.
 */
export const DATABASE_PORT = 'DATABASE_PORT';
export const PASSWORD_HASHER = 'PASSWORD_HASHER';
export const TOKEN_MANAGER = 'TOKEN_MANAGER';
export const PGLITE = 'PGLITE';
export const ASSET_PORT = 'ASSET_PORT';
export const LOCATION_PORT = 'LOCATION_PORT';
export const CATEGORY_PORT = 'CATEGORY_PORT';
export const MODEL_PORT = 'MODEL_PORT';
export const EMPLOYEE_PORT = 'EMPLOYEE_PORT';
export const CYCLE_PORT = 'CYCLE_PORT';
export const RECORD_PORT = 'RECORD_PORT';
export const RESULT_PORT = 'RESULT_PORT';
export const MOVEMENT_PORT = 'MOVEMENT_PORT';
export const REPORTING_PORT = 'REPORTING_PORT';
export const AUDIT_PORT = 'AUDIT_PORT';
export const EVENT_BUS = 'EVENT_BUS';
export const NOTIFICATION_PORT = 'NOTIFICATION_PORT';
export const REALTIME_PORT = 'REALTIME_PORT';
export const EXPORT_PROVIDERS = 'EXPORT_PROVIDERS';
export const SEARCH_PROVIDERS = 'SEARCH_PROVIDERS';
