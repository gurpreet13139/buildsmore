/**
 * BUILDsmore — PostgreSQL Database Client & Drizzle ORM Adapter
 * Configures connection pooling via DATABASE_URL, automatic migrations,
 * and secure initial administrator initialization (with bcrypt hashing and zero-reset protection).
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'fs';
import path from 'path';
import * as schema from '../db/schema';
import { getServerConfig, INSECURE_DEFAULT_ADMIN_PASSWORDS } from './config';
import { hashPassword } from './auth';

let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
    const config = getServerConfig();
    poolInstance = new Pool({
      connectionString: config.databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    poolInstance.on('error', (err) => {
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[PostgreSQL] Pool background error:', err.message);
      }
    });
  }
  return poolInstance;
}

export function getDrizzleDb() {
  if (!dbInstance) {
    const pool = getDbPool();
    dbInstance = drizzle(pool, { schema });
  }
  return dbInstance;
}

/**
 * Runs initial database migrations to create schema tables and indexes
 */
export async function runDatabaseMigrations(): Promise<{ success: boolean; message: string }> {
  const pool = getDbPool();
  try {
    const migrationFile = path.resolve(process.cwd(), 'src/db/migrations/0001_initial_schema.sql');
    if (fs.existsSync(migrationFile)) {
      const sql = fs.readFileSync(migrationFile, 'utf-8');
      await pool.query(sql);
      return { success: true, message: 'Drizzle database migrations applied successfully.' };
    }
    return { success: false, message: 'Migration SQL file not found at expected location.' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Migration notice: ${msg}` };
  }
}

/**
 * Creates the initial administrator using ADMIN_INITIAL_EMAIL and ADMIN_INITIAL_PASSWORD
 * ONLY if no administrator currently exists.
 * Strictly refuses to seed default/placeholder passwords in production.
 * Strictly preserves existing administrator credentials on subsequent application restarts.
 */
export async function initializeFirstAdministrator(): Promise<{ created: boolean; email: string }> {
  const config = getServerConfig();
  const pool = getDbPool();

  try {
    // 1. Check if any admin exists
    const checkResult = await pool.query('SELECT id, email, role FROM administrators LIMIT 1');
    if (checkResult.rows && checkResult.rows.length > 0) {
      // Administrator already exists: NEVER reset password automatically!
      return {
        created: false,
        email: checkResult.rows[0].email,
      };
    }

    if (
      config.nodeEnv === 'production' &&
      INSECURE_DEFAULT_ADMIN_PASSWORDS.has(config.admin.initialPassword)
    ) {
      throw new Error(
        'Refusing to seed production administrator with an insecure default ADMIN_INITIAL_PASSWORD.'
      );
    }

    // 2. No administrator exists: Hash initial password securely with bcrypt
    const hashedPassword = await hashPassword(config.admin.initialPassword);

    await pool.query(
      `INSERT INTO administrators (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        config.admin.initialEmail.toLowerCase().trim(),
        hashedPassword,
        'Executive Managing Director',
        'SuperAdmin',
        true,
      ]
    );

    return {
      created: true,
      email: config.admin.initialEmail,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Refusing to seed production administrator')) {
      throw err;
    }
    // Graceful fallback if database table not yet reachable
    return {
      created: false,
      email: config.admin.initialEmail,
    };
  }
}

/**
 * Validates PostgreSQL connectivity
 */
export async function testDatabaseConnectivity(): Promise<{ connected: boolean; message: string }> {
  const pool = getDbPool();
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db');
    return {
      connected: true,
      message: `Connected to PostgreSQL database "${res.rows[0]?.db}" at ${res.rows[0]?.current_time}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      message: `Database connection notice: ${msg}`,
    };
  }
}
