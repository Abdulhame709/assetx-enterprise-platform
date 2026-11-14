/**
 * Production configuration guard.
 * Refuses to boot a production process with missing, short or placeholder
 * secrets, a wildcard CORS origin, or no real database. Extracted from main.ts
 * so it can be unit-tested without starting the application.
 */
const WEAK_MARKERS = ['change-me', 'changeme', 'assetx-local-', 'dev-only', 'replace-me'];
const MIN_SECRET_LENGTH = 32;

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const secrets = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const required = [...secrets, 'CORS_ORIGIN'];
  const value = (key: string) => (env[key] ?? '').trim();

  const missing = required.filter((key) => !value(key));
  const tooShort = secrets.filter((key) => value(key) && value(key).length < MIN_SECRET_LENGTH);
  const weak = required.filter((key) =>
    WEAK_MARKERS.some((marker) => value(key).toLowerCase().includes(marker)),
  );

  if (tooShort.length) {
    throw new Error(
      `PRODUCTION_CONFIG_INVALID: secrets shorter than ${MIN_SECRET_LENGTH} characters: ${tooShort.join(',')}`,
    );
  }
  if (missing.length || weak.length) {
    throw new Error(
      `PRODUCTION_CONFIG_INVALID: missing=${missing.join(',') || 'none'} weak=${weak.join(',') || 'none'}`,
    );
  }
  if (value('JWT_ACCESS_SECRET') === value('JWT_REFRESH_SECRET')) {
    throw new Error('PRODUCTION_CONFIG_INVALID: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (value('CORS_ORIGIN').split(',').map((o) => o.trim()).includes('*')) {
    throw new Error('PRODUCTION_CONFIG_INVALID: CORS_ORIGIN cannot be *');
  }
  // Without DATABASE_URL the app silently falls back to the in-memory dev
  // database, so every restart would lose all data.
  if (!value('DATABASE_URL')) {
    throw new Error('PRODUCTION_CONFIG_INVALID: DATABASE_URL is required in production');
  }
}
