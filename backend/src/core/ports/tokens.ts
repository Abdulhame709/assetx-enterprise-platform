/**
 * Dependency-injection tokens for core ports (NestJS requires value tokens).
 * Keeps Clean Architecture: domain ports are injectable by string token.
 */
export const DATABASE_PORT = 'DATABASE_PORT';
export const PASSWORD_HASHER = 'PASSWORD_HASHER';
export const TOKEN_MANAGER = 'TOKEN_MANAGER';
export const PGLITE = 'PGLITE';
export const ASSET_PORT = 'ASSET_PORT';
