/**
 * BUILDsmore — Production Security Middleware, Rate Limiting & Inquiry Validation
 */

import { Request, Response, NextFunction } from 'express';
import { getServerConfig } from './config';

// =========================================================================
// 1. SLIDING-WINDOW IN-MEMORY RATE LIMITER
// =========================================================================

interface RateBucket {
  timestamps: number[];
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();
  const { windowMs, max, keyPrefix, message } = options;

  // Periodic garbage collection of expired buckets
  const cleanupInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, bucket] of buckets.entries()) {
      bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
      if (bucket.timestamps.length === 0) {
        buckets.delete(key);
      }
    }
  }, Math.max(windowMs, 60_000));
  if (typeof cleanupInterval.unref === 'function') {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      'unknown';
    const key = `${keyPrefix}:${ip}`;

    const bucket = buckets.get(key) || { timestamps: [] };
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

    if (bucket.timestamps.length >= max) {
      const oldest = bucket.timestamps[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        success: false,
        error: message || 'Too many requests. Please wait a moment before trying again.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    bucket.timestamps.push(now);
    buckets.set(key, bucket);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.timestamps.length)));
    next();
  };
}

// =========================================================================
// 2. HTTP SECURITY HEADERS & CORS ORIGIN ENFORCEMENT
// =========================================================================

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isProd = process.env.NODE_ENV === 'production';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  if (isProd) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Baseline CSP compatible with SSR hydration snapshot, Google Fonts, and remote property photography
  const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' https: data: blob:",
    "frame-src 'self' https://www.google.com https://maps.google.com",
    isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
    isProd ? "frame-ancestors 'self'" : "frame-ancestors 'self' https://aistudio.google.com https://*.google.com",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));

  // Prevent caching of sensitive admin or API responses
  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/inquiries') || req.path === '/admin') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
  }

  next();
}

export function apiCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }

  const config = getServerConfig();
  const isProd = config.nodeEnv === 'production';
  const reqHost = req.headers.host;
  const isSameHost =
    reqHost &&
    (origin === `https://${reqHost}` || origin === `http://${reqHost}`);

  const isAllowed =
    isSameHost ||
    config.allowedOrigins.includes(origin) ||
    (!isProd && (origin.startsWith('http://localhost:') || origin.startsWith('https://ais-')));

  if (!isAllowed) {
    res.status(403).json({
      success: false,
      error: 'Origin not permitted by CORS policy.',
    });
    return;
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '600');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

// =========================================================================
// 3. PUBLIC INQUIRY INPUT VALIDATION & SPAM PROTECTION
// =========================================================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type InquirySourceForm = 'hero' | 'modal' | 'contact' | 'property_detail' | 'api';

export interface ValidatedInquiryPayload {
  fullName: string;
  phone: string;
  email: string;
  clientEmailProvided: boolean;
  propertyId?: string;
  propertyTitle?: string;
  propertySlug?: string;
  propertyType: string;
  budgetRange: string;
  preferredLocation: string;
  preferredContactMethod: 'email' | 'phone' | 'whatsapp';
  scheduledTourDate?: string;
  sourceForm: InquirySourceForm;
  message: string;
}

export interface InquiryValidationResult {
  valid: boolean;
  error?: string;
  isSpam?: boolean;
  data?: ValidatedInquiryPayload;
}

function stripControlChars(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function validateAndSanitizeInquiryInput(rawBody: unknown): InquiryValidationResult {
  if (!rawBody || typeof rawBody !== 'object') {
    return { valid: false, error: 'Invalid request payload.' };
  }

  const body = rawBody as Record<string, unknown>;

  // 1. Honeypot check (automated bots frequently fill hidden companyWebsite / website fields)
  const honeypot = body.website ?? body.companyWebsite ?? body.hpField;
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return {
      valid: false,
      isSpam: true,
      error: 'Your submission was flagged by our automated spam protection.',
    };
  }

  // 2. Minimum human interaction timing check (reject < 900ms bot posts)
  if (typeof body._formStartedAt === 'number' && Number.isFinite(body._formStartedAt)) {
    const elapsed = Date.now() - body._formStartedAt;
    if (elapsed >= 0 && elapsed < 900) {
      return {
        valid: false,
        isSpam: true,
        error: 'Submission occurred too quickly. Please review your details and submit again.',
      };
    }
  }

  // 3. Full Name validation
  const rawName = typeof body.fullName === 'string' ? body.fullName : typeof body.name === 'string' ? body.name : '';
  const fullName = stripControlChars(rawName);
  if (fullName.length < 2 || fullName.length > 100) {
    return {
      valid: false,
      error: 'Please enter a valid full name (between 2 and 100 characters).',
    };
  }
  if (/https?:\/\//i.test(fullName)) {
    return { valid: false, isSpam: true, error: 'Links are not permitted in the name field.' };
  }

  // 4. Phone validation
  const rawPhone = typeof body.phone === 'string' ? body.phone : '';
  const phone = stripControlChars(rawPhone);
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone || phone.length > 24 || phoneDigits.length < 7 || phoneDigits.length > 15) {
    return {
      valid: false,
      error: 'Please enter a valid phone number (7 to 15 digits).',
    };
  }

  // 5. Source Form & Email validation
  const validSources = new Set<InquirySourceForm>(['hero', 'modal', 'contact', 'property_detail', 'api']);
  const sourceForm: InquirySourceForm =
    typeof body.sourceForm === 'string' && validSources.has(body.sourceForm as InquirySourceForm)
      ? (body.sourceForm as InquirySourceForm)
      : 'api';

  const rawEmail = typeof body.email === 'string' ? stripControlChars(body.email) : '';
  const emailRequired = sourceForm === 'contact' || sourceForm === 'property_detail';

  if (emailRequired && !rawEmail) {
    return { valid: false, error: 'Please provide a valid email address.' };
  }
  if (rawEmail) {
    if (rawEmail.length > 160 || !EMAIL_REGEX.test(rawEmail)) {
      return { valid: false, error: 'Please enter a valid email address format.' };
    }
  }

  // 6. Optional fields & Message spam check
  const propertyType =
    typeof body.propertyType === 'string'
      ? stripControlChars(body.propertyType).slice(0, 80) || 'Any Asset Class'
      : 'Any Asset Class';
  const budgetRange =
    typeof body.budgetRange === 'string'
      ? stripControlChars(body.budgetRange).slice(0, 80) || 'Flexible / Consultation'
      : 'Flexible / Consultation';
  const preferredLocation =
    typeof body.preferredLocation === 'string'
      ? stripControlChars(body.preferredLocation).slice(0, 120)
      : '';
  const propertyId =
    typeof body.propertyId === 'string' ? stripControlChars(body.propertyId).slice(0, 100) || undefined : undefined;
  const propertyTitle =
    typeof body.propertyTitle === 'string'
      ? stripControlChars(body.propertyTitle).slice(0, 160) || undefined
      : undefined;
  const propertySlug =
    typeof body.propertySlug === 'string'
      ? stripControlChars(body.propertySlug).slice(0, 160) || undefined
      : undefined;
  const scheduledTourDate =
    typeof body.scheduledTourDate === 'string'
      ? stripControlChars(body.scheduledTourDate).slice(0, 40) || undefined
      : undefined;

  const rawChannel = typeof body.preferredContactMethod === 'string' ? body.preferredContactMethod : 'phone';
  const preferredContactMethod: 'email' | 'phone' | 'whatsapp' =
    rawChannel === 'email' || rawChannel === 'whatsapp' ? rawChannel : 'phone';

  const rawMessage = typeof body.message === 'string' ? stripControlChars(body.message) : '';
  if (sourceForm === 'contact' && rawMessage.length < 5) {
    return {
      valid: false,
      error: 'Please enter a brief inquiry message (at least 5 characters).',
    };
  }
  if (rawMessage.length > 2000) {
    return {
      valid: false,
      error: 'Message is too long. Please keep your inquiry under 2,000 characters.',
    };
  }

  // Link spam heuristic (3+ URLs inside inquiry text)
  const urlMatches = rawMessage.match(/https?:\/\/[^\s]+/gi) || [];
  if (urlMatches.length >= 3) {
    return {
      valid: false,
      isSpam: true,
      error: 'Excessive external links detected in inquiry message.',
    };
  }

  const fallbackSummary = `[${sourceForm.toUpperCase()}] Property: ${
    propertyTitle || propertyType
  } | Location: ${preferredLocation || 'Any'} | Budget: ${budgetRange}`;

  return {
    valid: true,
    data: {
      fullName,
      phone,
      email: rawEmail || 'not-provided@buildsmoremohali.com',
      clientEmailProvided: Boolean(rawEmail),
      propertyId,
      propertyTitle,
      propertySlug,
      propertyType,
      budgetRange,
      preferredLocation,
      preferredContactMethod,
      scheduledTourDate,
      sourceForm,
      message: rawMessage || fallbackSummary,
    },
  };
}
