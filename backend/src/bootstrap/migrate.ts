import 'reflect-metadata';
import { PostgresDatabase } from '../infrastructure/database/postgres.database';
import { applyMigrations } from './migrations';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL_REQUIRED_FOR_MIGRATIONS');
  }

  const db = new PostgresDatabase(databaseUrl);
  try {
    await applyMigrations(db);
    console.log('AssetX migrations applied successfully');
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
  });
}

export { main };
