import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'path';
import * as schema from './schema';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
export const db = drizzle(pool, { schema });
export { schema };

export async function runMigrations() {
  // Works from both src/ (tsx) and dist/ (node) since drizzle/ sits at the package root.
  const folder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder: folder });
}
