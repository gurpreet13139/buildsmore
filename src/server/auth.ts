/**
 * BUILDsmore — Authentication & Cryptographic Security
 * Bcrypt password hashing, constant-time secret verification, & JWT token validation.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  getServerConfig,
  INSECURE_DEFAULT_JWT_SECRET,
  INSECURE_DEFAULT_ADMIN_PASSWORDS,
  ServerConfig,
} from './config';

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: string;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  admin?: AdminJwtPayload;
}

export interface AdminLoginDbPool {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export interface AdminLoginResult {
  ok: boolean;
  status: number;
  token?: string;
  user?: AdminJwtPayload;
  error?: string;
}

/**
 * Constant-time string comparison using SHA-256 digests to prevent length/timing side-channels.
 */
export function constantTimePasswordMatch(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = crypto.createHash('sha256').update(provided, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Hash password securely using bcrypt with work factor 12
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainText, salt);
}

/**
 * Compare plain text password against stored bcrypt hash
 */
export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

function getValidatedJwtSecret(): string {
  const config = getServerConfig();
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error('Server cannot sign tokens: JWT_SECRET is unconfigured or insufficient.');
  }
  if (config.nodeEnv === 'production' && config.jwtSecret === INSECURE_DEFAULT_JWT_SECRET) {
    throw new Error('Refusing to use insecure development JWT_SECRET fallback in production.');
  }
  return config.jwtSecret;
}

/**
 * Sign JWT token for authenticated administrator
 */
export function signAdminToken(payload: AdminJwtPayload): string {
  const secret = getValidatedJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: '12h',
    algorithm: 'HS256',
    issuer: 'buildsmore-api',
  });
}

/**
 * Verify and decode JWT token
 */
export function verifyAdminToken(token: string): AdminJwtPayload {
  const secret = getValidatedJwtSecret();
  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer: 'buildsmore-api',
  }) as AdminJwtPayload;
}

/**
 * Authenticates an administrator exclusively using a verified email address and password.
 * - Legacy aliases ('admin', 'administrator', 'buildsmore') are completely disabled.
 * - When PostgreSQL is reachable, only active rows in the `administrators` table are accepted.
 * - In production, if PostgreSQL is unreachable or configured with an insecure default password, login is refused (503).
 */
export async function authenticateAdminLogin(params: {
  email: unknown;
  password: unknown;
  pool: AdminLoginDbPool | null;
  config?: ServerConfig;
}): Promise<AdminLoginResult> {
  const config = params.config || getServerConfig();

  if (
    typeof params.email !== 'string' ||
    typeof params.password !== 'string' ||
    !params.email.trim() ||
    !params.password.trim() ||
    params.email.length > 160 ||
    params.password.length > 160
  ) {
    return {
      ok: false,
      status: 400,
      error: 'A valid administrator email address and password are required.',
    };
  }

  const normalizedEmail = params.email.toLowerCase().trim();
  const trimmedPassword = params.password.trim();

  // Strictly require an email format (legacy aliases like 'admin', 'administrator', 'buildsmore' are rejected)
  const emailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail);
  if (!emailFormatValid) {
    return {
      ok: false,
      status: 401,
      error: 'A valid administrator email address is required.',
    };
  }

  let dbReachable = false;
  let adminRow: any = null;

  if (params.pool) {
    try {
      const queryRes = await params.pool.query(
        'SELECT id, email, password_hash, full_name, role, is_active FROM administrators WHERE LOWER(email) = $1 LIMIT 1',
        [normalizedEmail]
      );
      dbReachable = true;
      adminRow = queryRes.rows?.[0] || null;
    } catch {
      dbReachable = false;
    }
  }

  if (dbReachable) {
    if (!adminRow || adminRow.is_active === false) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid administrator credentials.',
      };
    }

    const validHash = await comparePassword(trimmedPassword, String(adminRow.password_hash || ''));
    if (!validHash) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid administrator credentials.',
      };
    }

    try {
      await params.pool?.query('UPDATE administrators SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [
        adminRow.id,
      ]);
    } catch {
      // Non-fatal audit timestamp update
    }

    const adminData: AdminJwtPayload = {
      adminId: String(adminRow.id),
      email: String(adminRow.email),
      name: String(adminRow.full_name || 'Administrator'),
      role: String(adminRow.role || 'SuperAdmin'),
    };
    const token = signAdminToken(adminData);
    return { ok: true, status: 200, token, user: adminData };
  }

  // PostgreSQL unreachable: strictly block fallback in production
  if (config.nodeEnv === 'production') {
    return {
      ok: false,
      status: 503,
      error: 'Administrator authentication database is unavailable. Database-backed authentication is required in production.',
    };
  }

  // Local non-production preview fallback: exact configured admin email ONLY (no username aliases)
  const configuredEmail = config.admin.initialEmail.toLowerCase().trim();
  if (
    normalizedEmail === configuredEmail &&
    constantTimePasswordMatch(trimmedPassword, config.admin.initialPassword)
  ) {
    const adminData: AdminJwtPayload = {
      adminId: 'admin-dev-01',
      email: config.admin.initialEmail,
      name: 'Executive Managing Director',
      role: 'SuperAdmin',
    };
    const token = signAdminToken(adminData);
    return { ok: true, status: 200, token, user: adminData };
  }

  return {
    ok: false,
    status: 401,
    error: 'Invalid administrator credentials.',
  };
}

/**
 * Extracts and verifies optional admin session without failing public requests.
 */
export function getOptionalAdmin(req: Request): AdminJwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return verifyAdminToken(token);
  } catch {
    return null;
  }
}

/**
 * Express middleware to protect administrative endpoints
 */
export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token missing. Please sign in to the administrator portal.',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token missing.',
    });
    return;
  }

  try {
    const payload = verifyAdminToken(token);
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({
      error: 'InvalidToken',
      message: 'Session expired or token invalid. Please re-authenticate.',
    });
  }
}
