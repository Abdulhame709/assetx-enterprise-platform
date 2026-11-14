import { MAX_PAGE_SIZE, maxExportRows, normalizePaging } from '../src/common/utils/pagination';
import { buildThrottlers, isCredentialRoute } from '../src/common/http/throttle-config';
import { assertImportRowCount, assertXlsxBuffer, isZipBuffer, MAX_IMPORT_ROWS } from '../src/application/import-limits';
import { csvSafe } from '../src/infrastructure/export/cell-format';

describe('normalizePaging', () => {
  it('uses defaults for missing or garbage input', () => {
    expect(normalizePaging(undefined, undefined)).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(normalizePaging('abc', 'xyz')).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(normalizePaging(NaN, Infinity).limit).toBe(20);
  });

  it('coerces query-string numbers', () => {
    expect(normalizePaging('3', '50')).toEqual({ page: 3, limit: 50, offset: 100 });
  });

  it('caps the limit', () => {
    expect(normalizePaging(1, 999_999).limit).toBe(MAX_PAGE_SIZE);
    expect(normalizePaging(1, '1e9').limit).toBe(MAX_PAGE_SIZE);
    expect(normalizePaging(1, 99_999, { defaultLimit: 10, maxLimit: 50_000 }).limit).toBe(50_000);
  });

  it('rejects zero, negative and fractional values', () => {
    expect(normalizePaging(0, -5)).toEqual({ page: 1, limit: 20, offset: 0 });
    expect(normalizePaging(2.9, 10.7)).toEqual({ page: 2, limit: 10, offset: 10 });
  });

  it('keeps the offset finite for absurd pages', () => {
    const { offset } = normalizePaging(Number.MAX_SAFE_INTEGER, 500);
    expect(Number.isSafeInteger(offset)).toBe(true);
  });
});

describe('maxExportRows', () => {
  it('defaults to 50000 and honours EXPORT_MAX_ROWS', () => {
    expect(maxExportRows({} as NodeJS.ProcessEnv)).toBe(50_000);
    expect(maxExportRows({ EXPORT_MAX_ROWS: '1000' } as unknown as NodeJS.ProcessEnv)).toBe(1000);
    expect(maxExportRows({ EXPORT_MAX_ROWS: 'nope' } as unknown as NodeJS.ProcessEnv)).toBe(50_000);
    expect(maxExportRows({ EXPORT_MAX_ROWS: '0' } as unknown as NodeJS.ProcessEnv)).toBe(50_000);
  });
});

describe('credential throttling', () => {
  it('recognises login and reset-password routes only', () => {
    expect(isCredentialRoute('/auth/login')).toBe(true);
    expect(isCredentialRoute('/auth/login?x=1')).toBe(true);
    expect(isCredentialRoute('/auth/reset-password')).toBe(true);
    expect(isCredentialRoute('/api/auth/login')).toBe(true);
    expect(isCredentialRoute('/auth/refresh')).toBe(false);
    expect(isCredentialRoute('/assets')).toBe(false);
    expect(isCredentialRoute(undefined)).toBe(false);
  });

  it('defines a default and a slower credential window', () => {
    const [def, cred] = buildThrottlers({} as NodeJS.ProcessEnv);
    expect(def).toMatchObject({ name: 'default', limit: 60, ttl: 60_000 });
    expect(cred).toMatchObject({ name: 'credential', limit: 40, ttl: 900_000 });
    expect(buildThrottlers({ AUTH_THROTTLE_LIMIT: '10' } as unknown as NodeJS.ProcessEnv)[1]).toMatchObject({ limit: 10 });
  });

  it('skips the credential window on non-credential routes', () => {
    const cred = buildThrottlers({} as NodeJS.ProcessEnv)[1];
    const ctx = (url: string) => ({ switchToHttp: () => ({ getRequest: () => ({ url }) }) }) as never;
    const skipIf = cred.skipIf as (c: never) => boolean;
    expect(skipIf(ctx('/auth/login'))).toBe(false);
    expect(skipIf(ctx('/assets'))).toBe(true);
  });
});

describe('import file guards', () => {
  it('accepts a ZIP signature and rejects other content', () => {
    expect(isZipBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]))).toBe(true);
    expect(isZipBuffer(Buffer.from('MZ\x90\x00 not a zip'))).toBe(false);
    expect(isZipBuffer(Buffer.from('<html>'))).toBe(false);
    expect(isZipBuffer(Buffer.alloc(2))).toBe(false);
    expect(() => assertXlsxBuffer(Buffer.from('plain text renamed .xlsx'))).toThrow('IMPORT_FILE_INVALID');
    expect(() => assertXlsxBuffer(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).not.toThrow();
  });

  it('rejects sheets above the row cap (header row excluded)', () => {
    expect(() => assertImportRowCount(MAX_IMPORT_ROWS + 1)).not.toThrow();
    expect(() => assertImportRowCount(MAX_IMPORT_ROWS + 2)).toThrow('IMPORT_TOO_MANY_ROWS');
  });
});

describe('csvSafe (formula injection)', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=1', '\r=1'])('neutralises %j', (input) => {
    const out = String(csvSafe(input));
    expect(out.startsWith("'") || !/^[=+\-@\t\r]/.test(out)).toBe(true);
  });

  it('leaves ordinary text alone', () => {
    expect(csvSafe('Laptop Dell')).toBe('Laptop Dell');
  });
});
