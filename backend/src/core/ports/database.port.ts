/**
 * Database port — abstract data access for the application layer.
 * Enables Clean Architecture: infrastructure implements this, domain depends on it.
 */

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
}

/**
 * A unit of work / query interface against the relational store.
 * Implementations: PGlite (embedded PostgreSQL) locally; pg/Supabase in production.
 */
export interface DatabasePort {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Execute multiple statements in a single call (DDL/migration) */
  exec(sql: string): Promise<void>;
  /** Set the active tenant context for the connection (drives RLS). */
  setTenant(tenantId: string | null): Promise<void>;
  /** Close the connection. */
  close(): Promise<void>;
}
