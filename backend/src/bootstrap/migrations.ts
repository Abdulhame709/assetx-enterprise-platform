import * as fs from 'node:fs';
import * as path from 'node:path';
import { DatabasePort } from '../core/ports/database.port';

/** Apply numbered repository migrations once, in lexical order. */
export async function applyMigrations(db: DatabasePort): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.resolve(__dirname, '../../../db/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const { rows } = await db.query<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = $1',
      [file],
    );
    if (rows.length > 0) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await db.exec(sql);
    await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
  }
}
