import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolConfig } from 'pg';
import { DatabasePort, QueryResult } from '../../core/ports/database.port';

/**
 * PostgreSQL implementation for staging/production.
 *
 * Every application query runs in a short transaction and receives the tenant
 * context with SET LOCAL. AsyncLocalStorage keeps tenant identity request-scoped
 * instead of storing it on the shared pool or connection.
 */
export class PostgresDatabase implements DatabasePort {
  private readonly pool: Pool;
  private readonly tenantContext = new AsyncLocalStorage<string | null>();

  constructor(config: string | PoolConfig) {
    this.pool = new Pool(
      typeof config === 'string'
        ? {
            connectionString: config,
            max: Number(process.env.DB_POOL_MAX ?? 20),
            idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30_000),
            connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 10_000),
            maxUses: Number(process.env.DB_MAX_USES ?? 0) || undefined,
            // A runaway query must not hold a pooled connection forever.
            // 0 disables the limit. Migrations (exec) opt out of it below.
            statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30_000) || undefined,
          }
        : config,
    );
    // An idle client can emit 'error' (database restart, network drop). With no
    // listener Node treats it as an uncaught exception and kills the process.
    this.pool.on('error', (error) => {
      // eslint-disable-next-line no-console
      console.error('[db] idle client error:', error.message);
    });
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    const tenantId = this.tenantContext.getStore() ?? null;
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId ?? '']);
      const result = await client.query(sql, params ?? []);
      await client.query('COMMIT');
      return {
        rows: (result.rows ?? []) as T[],
        rowCount: result.rowCount ?? 0,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async queryAsTenant<T = Record<string, unknown>>(
    tenantId: string,
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('INVALID_UUID');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const result = await client.query(sql, params ?? []);
      await client.query('COMMIT');
      return { rows: (result.rows ?? []) as T[], rowCount: result.rowCount ?? 0 };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /** Execute migrations/bootstrap SQL outside request transactions. */
  async exec(sql: string): Promise<void> {
    // Index builds and data migrations may legitimately exceed the request
    // statement timeout, so lift it for this dedicated connection only.
    const client = await this.pool.connect();
    try {
      await client.query('SET statement_timeout = 0');
      await client.query(sql);
    } finally {
      await client.query('RESET statement_timeout').catch(() => undefined);
      client.release();
    }
  }

  async setTenant(tenantId: string | null): Promise<void> {
    if (tenantId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantId)) {
      throw new Error('INVALID_UUID');
    }
    this.tenantContext.enterWith(tenantId);
  }

  private closed = false;

  async close(): Promise<void> {
    // pg throws if Pool.end() is called twice (explicit close + shutdown hook).
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }

  /** Nest calls this on SIGTERM/SIGINT (enableShutdownHooks) so in-flight queries drain. */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}
