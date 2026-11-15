/**
 * Pagination guards.
 * Query-string values arrive as strings (or garbage). Left unchecked, `limit=1000000`
 * would load a whole table into memory and `limit=abc` would reach the database as an
 * invalid LIMIT. These helpers coerce and clamp every page/limit pair.
 */

/** Largest page an interactive list endpoint may return (the web UI asks for 500). */
export const MAX_PAGE_SIZE = 500;

/** Hard ceiling for any repository query, including exports. Override with EXPORT_MAX_ROWS. */
export function maxExportRows(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.EXPORT_MAX_ROWS);
  return Number.isFinite(configured) && configured >= 1 ? Math.floor(configured) : 50_000;
}

export interface PagingOptions {
  defaultLimit: number;
  maxLimit: number;
}

export interface Paging {
  page: number;
  limit: number;
  offset: number;
}

function toPositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const int = Math.floor(n);
  return int >= 1 ? int : null;
}

/** Coerce page/limit into safe positive integers (limit <= maxLimit). */
export function normalizePaging(
  page: unknown,
  limit: unknown,
  options: PagingOptions = { defaultLimit: 20, maxLimit: MAX_PAGE_SIZE },
): Paging {
  const safeLimit = Math.min(toPositiveInt(limit) ?? options.defaultLimit, options.maxLimit);
  // Cap page so (page - 1) * limit stays a safe integer and a sane OFFSET.
  const safePage = Math.min(toPositiveInt(page) ?? 1, 1_000_000);
  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}
