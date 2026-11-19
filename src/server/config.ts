/**
 * BUILDsmore — Server Configuration & Environment Validation
 * Validates all required server-side environment variables on startup.
 * Strictly masks sensitive values in logs and error messages.
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// In local development / preview only, allow .env.development.local to override
// container-injected environment defaults. Strictly skipped in production and tests.
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  const devLocalEnvPath = path.resolve(process.cwd(), '.env.development.local');
  if (fs.existsSync(devLocalEnvPath)) {
    dotenv.config({ path: devLocalEnvPath, override: true });
  }
}

export const DEFAULT_INQUIRY_NOTIFY_EMAIL = 'buildsmore66@gmail.com';
export const INSECURE_DEFAULT_JWT_SECRET = 'luxury_estate_jwt_secret_minimum_32_characters_long_2026';
export const INSECURE_DEFAULT_ADMIN_PASSWORDS = new Set([
  'buildsmore2026!',
  'ChangeMeInProduction2026!',
]);

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  notifyTo: string;
}

export interface ServerConfig {
  databaseUrl: string;
  redisUrl: string;
  s3: {
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  admin: {
    initialEmail: string;
    initialPassword: string;
  };
  smtp: SmtpConfig;
  allowedOrigins: string[];
  jwtSecret: string;
  appUrl: string;
  port: number;
  nodeEnv: string;
}

export interface ValidationResult {
  isValid: boolean;
  missingVariables: string[];
  errors: string[];
  warnings?: string[];
  smtpConfigured?: boolean;
  productionReady?: boolean;
}

function isPlaceholderValue(val?: string): boolean {
  if (!val || val.trim() === '') return true;
  const trimmed = val.trim();
  return (
    trimmed.includes('YOUR_') ||
    trimmed.includes('MY_') ||
    trimmed === 'generate_a_secure_random_64_char_secret'
  );
}

/**
 * Checks whether real SMTP credentials are configured in server environment variables.
 */
export function isSmtpConfigured(smtp: SmtpConfig = getServerConfig().smtp): boolean {
  return (
    !isPlaceholderValue(smtp.host) &&
    Number.isFinite(smtp.port) &&
    smtp.port > 0 &&
    smtp.port <= 65535 &&
    !isPlaceholderValue(smtp.user) &&
    !isPlaceholderValue(smtp.pass)
  );
}

/**
 * Validates that all required server environment variables are present and meet security standards.
 * Never logs or returns secret values in cleartext.
 */
export function validateEnvironment(): ValidationResult {
  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredKeys = [
    'DATABASE_URL',
    'REDIS_URL',
    'S3_ENDPOINT',
    'S3_BUCKET',
    'S3_REGION',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'ADMIN_INITIAL_EMAIL',
    'ADMIN_INITIAL_PASSWORD',
    'JWT_SECRET',
  ];

  for (const key of requiredKeys) {
    const val = process.env[key];
    if (isPlaceholderValue(val)) {
      missing.push(key);
    }
  }

  // Security Check: JWT_SECRET strength
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32 && !jwtSecret.includes('YOUR_')) {
    errors.push('JWT_SECRET must be at least 32 characters in length for production security.');
  }
  if (jwtSecret === INSECURE_DEFAULT_JWT_SECRET) {
    warnings.push('JWT_SECRET is set to the development example default and must be rotated before production.');
  }

  // Security Check: ADMIN_INITIAL_PASSWORD strength
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (adminPassword && adminPassword.length < 8 && !adminPassword.includes('YOUR_')) {
    errors.push('ADMIN_INITIAL_PASSWORD must be at least 8 characters in length.');
  }
  if (adminPassword && INSECURE_DEFAULT_ADMIN_PASSWORDS.has(adminPassword)) {
    warnings.push('ADMIN_INITIAL_PASSWORD uses a placeholder/default password and must be changed for production.');
  }

  // Email format check
  const adminEmail = process.env.ADMIN_INITIAL_EMAIL;
  if (adminEmail && !adminEmail.includes('@') && !adminEmail.includes('YOUR_')) {
    errors.push('ADMIN_INITIAL_EMAIL is not a valid email format.');
  }

  // SMTP configuration check (non-fatal if omitted in local preview, reported explicitly)
  const smtpMissing = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'].filter((k) =>
    isPlaceholderValue(process.env[k])
  );
  if (smtpMissing.length > 0) {
    warnings.push(
      `SMTP email notifications are not yet active; missing env var(s): ${smtpMissing.join(', ')}`
    );
  }

  const config = getServerConfig();
  const smtpReady = isSmtpConfigured(config.smtp);
  const prodSecretsSafe =
    missing.length === 0 &&
    errors.length === 0 &&
    config.jwtSecret !== INSECURE_DEFAULT_JWT_SECRET &&
    !INSECURE_DEFAULT_ADMIN_PASSWORDS.has(config.admin.initialPassword);

  return {
    isValid: missing.length === 0 && errors.length === 0,
    missingVariables: missing,
    errors,
    warnings,
    smtpConfigured: smtpReady,
    productionReady: prodSecretsSafe && smtpReady,
  };
}

/**
 * Masks a secret string for safe display in logs (e.g., "sec****26")
 */
export function maskSecret(val?: string): string {
  if (!val) return '[NOT CONFIGURED]';
  if (val.length <= 4) return '****';
  return `${val.slice(0, 3)}****${val.slice(-2)}`;
}

/**
 * Retrieves the parsed server configuration object
 */
export function getServerConfig(): ServerConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const smtpPortRaw = parseInt(process.env.SMTP_PORT || '465', 10);
  const smtpSecureEnv = (process.env.SMTP_SECURE || '').trim().toLowerCase();
  const smtpSecure =
    smtpSecureEnv === 'true' ||
    smtpSecureEnv === '1' ||
    (smtpSecureEnv === '' && smtpPortRaw === 465);

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const allowedFromEnv = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgresql://buildsmore_admin:LuxurySecured2026@localhost:5432/buildsmore_db?sslmode=disable',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    s3: {
      endpoint: process.env.S3_ENDPOINT || 'https://s3.eu-central-1.amazonaws.com',
      bucket: process.env.S3_BUCKET || 'buildsmore-properties-media',
      region: process.env.S3_REGION || 'eu-central-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || 'AKIAEXAMPLEKEY12345',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'SecretAccessKeyExamplePlaceholder67890',
    },
    admin: {
      initialEmail: process.env.ADMIN_INITIAL_EMAIL || 'info@buildsmoremohali.com',
      initialPassword: process.env.ADMIN_INITIAL_PASSWORD || 'buildsmore2026!',
    },
    smtp: {
      host: (process.env.SMTP_HOST || '').trim(),
      port: Number.isFinite(smtpPortRaw) ? smtpPortRaw : 465,
      secure: smtpSecure,
      user: smtpUser,
      pass: process.env.SMTP_PASS || '',
      from: (process.env.SMTP_FROM || (smtpUser ? `BUILDsmore Concierge <${smtpUser}>` : '')).trim(),
      notifyTo: (process.env.INQUIRY_NOTIFY_EMAIL || DEFAULT_INQUIRY_NOTIFY_EMAIL).trim(),
    },
    allowedOrigins: Array.from(
      new Set([
        'https://buildsmoremohali.com',
        'https://www.buildsmoremohali.com',
        ...allowedFromEnv,
      ])
    ),
    jwtSecret: process.env.JWT_SECRET || INSECURE_DEFAULT_JWT_SECRET,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
    port: Number.isFinite(port) ? port : 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}
