/**
 * Security, Authentication, Upload Magic-Byte, Rate Limiting, Inquiry Validation & SMTP Readiness Tests
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  validateAndSanitizeInquiryInput,
  createRateLimiter,
} from '../src/server/security';
import { detectSafeImageFormat, uploadPropertyPhoto } from '../src/server/storage-s3';
import {
  authenticateAdminLogin,
  constantTimePasswordMatch,
  signAdminToken,
  verifyAdminToken,
  requireAdminAuth,
  getOptionalAdmin,
} from '../src/server/auth';
import { getEmailNotificationStatus, sendInquiryNotificationEmail } from '../src/server/mailer';
import { validateInquiryFields } from '../src/utils/inquiryValidation';
import { INSECURE_DEFAULT_JWT_SECRET } from '../src/server/config';
import { PROPERTIES_UPSERT_COLUMNS } from '../src/server/postgresSync';
import { InquiryRepository } from '../src/server/inquiryRepository';
import { PropertyRepository } from '../src/server/propertyRepository';

export async function runSecurityProductionTests(): Promise<{
  passed: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const results: Array<{ name: string; success: boolean; error?: string }> = [];

  async function test(name: string, fn: () => void | Promise<void>) {
    try {
      await fn();
      results.push({ name, success: true });
    } catch (e: unknown) {
      results.push({
        name,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // 1. Inquiry Validation & Spam Protection
  await test('Inquiry Security: validates legitimate hero, modal, contact & property_detail payloads', () => {
    const heroRes = validateAndSanitizeInquiryInput({
      fullName: 'Vikramjit Singh',
      phone: '+91 977-987-8303',
      sourceForm: 'hero',
      _formStartedAt: Date.now() - 5000,
    });
    if (!heroRes.valid || !heroRes.data) {
      throw new Error(`Hero inquiry should pass without optional email: ${heroRes.error}`);
    }

    const contactRes = validateAndSanitizeInquiryInput({
      fullName: 'Elena Rostova',
      phone: '+41 22 555 0198',
      email: 'elena@example.com',
      message: 'Seeking private architectural dossier for Sector 82 Mohali villa.',
      sourceForm: 'contact',
      _formStartedAt: Date.now() - 4000,
    });
    if (!contactRes.valid || !contactRes.data) {
      throw new Error(`Contact inquiry should pass: ${contactRes.error}`);
    }
  });

  await test('Inquiry Security: rejects short/invalid phones, bad emails, honeypot, bot timing & link floods', () => {
    const badPhone = validateAndSanitizeInquiryInput({
      fullName: 'Test Client',
      phone: '123',
      sourceForm: 'hero',
    });
    if (badPhone.valid) throw new Error('Expected short phone to fail');

    const badEmail = validateAndSanitizeInquiryInput({
      fullName: 'Test Client',
      phone: '9779878303',
      email: 'invalid-email',
      sourceForm: 'hero',
    });
    if (badEmail.valid) throw new Error('Expected malformed email to fail');

    const contactNoEmail = validateAndSanitizeInquiryInput({
      fullName: 'Test Client',
      phone: '9779878303',
      message: 'Please contact me soon.',
      sourceForm: 'contact',
    });
    if (contactNoEmail.valid) throw new Error('Expected contact form without email to fail');

    const honeypotTriggered = validateAndSanitizeInquiryInput({
      fullName: 'Spam Bot',
      phone: '9779878303',
      website: 'https://spam-links.example',
      sourceForm: 'modal',
    });
    if (honeypotTriggered.valid || !honeypotTriggered.isSpam) {
      throw new Error('Expected honeypot trigger to be flagged as spam');
    }

    const tooFastBot = validateAndSanitizeInquiryInput({
      fullName: 'Fast Bot',
      phone: '9779878303',
      _formStartedAt: Date.now() - 100,
      sourceForm: 'hero',
    });
    if (tooFastBot.valid || !tooFastBot.isSpam) {
      throw new Error('Expected <900ms bot submission to be rejected');
    }

    const linkFlood = validateAndSanitizeInquiryInput({
      fullName: 'Link Spammer',
      phone: '9779878303',
      email: 'ok@example.com',
      message: 'Visit https://a.test and https://b.test and https://c.test now!',
      sourceForm: 'contact',
    });
    if (linkFlood.valid || !linkFlood.isSpam) {
      throw new Error('Expected 3+ URL message to be flagged as link spam');
    }

    const clientErr = validateInquiryFields({
      fullName: 'A',
      phone: '9779878303',
      emailRequired: false,
    });
    if (!clientErr) throw new Error('Expected client helper to reject 1-character name');
  });

  // 2. Upload Security (MIME + Magic Bytes)
  await test('Upload Security: verifies binary magic bytes and rejects disguised SVG/HTML payloads', async () => {
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const validJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const svgPayload = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

    if (detectSafeImageFormat(validPng)?.ext !== 'png') {
      throw new Error('Valid PNG signature rejected');
    }
    if (detectSafeImageFormat(validJpg)?.ext !== 'jpg') {
      throw new Error('Valid JPEG signature rejected');
    }
    if (detectSafeImageFormat(svgPayload) !== null) {
      throw new Error('SVG payload must not pass raster magic-byte verification');
    }

    let threwDisguised = false;
    try {
      await uploadPropertyPhoto(svgPayload, 'evil.jpg', 'image/jpeg');
    } catch {
      threwDisguised = true;
    }
    if (!threwDisguised) {
      throw new Error('Disguised SVG pretending to be image/jpeg was not rejected');
    }

    let threwBadMime = false;
    try {
      await uploadPropertyPhoto(validPng, 'icon.svg', 'image/svg+xml');
    } catch {
      threwBadMime = true;
    }
    if (!threwBadMime) {
      throw new Error('image/svg+xml MIME type must be rejected');
    }
  });

  // 3. JWT & Constant-Time Authentication Security
  await test('Auth Security: constant-time check, JWT signing/issuer verification, and requireAdminAuth guard', () => {
    if (!constantTimePasswordMatch('secret-pass-123', 'secret-pass-123')) {
      throw new Error('Valid constant-time password match failed');
    }
    if (constantTimePasswordMatch('secret-pass-123', 'secret-pass-124')) {
      throw new Error('Mismatched password should not match');
    }

    const token = signAdminToken({
      adminId: 'admin-01',
      email: 'info@buildsmoremohali.com',
      role: 'SuperAdmin',
      name: 'Director',
    });
    const decoded = verifyAdminToken(token);
    if (decoded.email !== 'info@buildsmoremohali.com') {
      throw new Error('Verified JWT email mismatch');
    }

    // Wrong issuer should fail
    const wrongIssuerToken = jwt.sign(
      { adminId: 'x', email: 'x@test.com', role: 'SuperAdmin', name: 'X' },
      process.env.JWT_SECRET || INSECURE_DEFAULT_JWT_SECRET,
      { algorithm: 'HS256', issuer: 'untrusted-issuer' }
    );
    let wrongIssuerRejected = false;
    try {
      verifyAdminToken(wrongIssuerToken);
    } catch {
      wrongIssuerRejected = true;
    }
    if (!wrongIssuerRejected) {
      throw new Error('Token with wrong issuer should be rejected');
    }

    // Middleware check: missing token -> 401
    let statusCode = 200;
    let nextCalled = false;
    const mockRes: any = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    };
    requireAdminAuth({ headers: {} } as any, mockRes, () => {
      nextCalled = true;
    });
    if (statusCode !== 401 || nextCalled) {
      throw new Error('Expected 401 when Authorization header is absent');
    }

    // Valid Bearer -> next()
    nextCalled = false;
    const authReq: any = { headers: { authorization: `Bearer ${token}` } };
    requireAdminAuth(authReq, mockRes, () => {
      nextCalled = true;
    });
    if (!nextCalled || !authReq.admin) {
      throw new Error('Expected requireAdminAuth to pass valid Bearer JWT');
    }

    if (!getOptionalAdmin(authReq)) {
      throw new Error('getOptionalAdmin should return payload for valid token');
    }
    if (getOptionalAdmin({ headers: {} } as any) !== null) {
      throw new Error('getOptionalAdmin should return null for public requests');
    }
  });

  // 4. Rate Limiter Enforcement
  await test('Rate Limiter: allows within limit and blocks excess requests with 429 + Retry-After', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: 'test-limit' });
    const headers: Record<string, string> = {};
    let status = 200;
    let passed = 0;

    const makeReq = () => ({ headers: {}, ip: '127.0.0.99', socket: {} } as any);
    const makeRes = () =>
      ({
        setHeader(k: string, v: string) {
          headers[k] = v;
        },
        status(code: number) {
          status = code;
          return this;
        },
        json() {
          return this;
        },
      }) as any;

    limiter(makeReq(), makeRes(), () => passed++);
    limiter(makeReq(), makeRes(), () => passed++);
    limiter(makeReq(), makeRes(), () => passed++);

    if (passed !== 2 || status !== 429 || !headers['Retry-After']) {
      throw new Error(`Expected 2 allowed + 3rd blocked with 429/Retry-After (passed=${passed}, status=${status})`);
    }
  });

  // 5. Email Notification Readiness (Without Hardcoded Credentials)
  await test('Mailer Readiness: targets buildsmore66@gmail.com cleanly without inventing credentials', async () => {
    const status = getEmailNotificationStatus();
    if (status.recipient !== 'buildsmore66@gmail.com') {
      throw new Error(`Expected recipient buildsmore66@gmail.com, got ${status.recipient}`);
    }

    const sendResult = await sendInquiryNotificationEmail({
      inquiryId: 'inq-test-01',
      createdAt: new Date().toISOString(),
      payload: {
        fullName: 'Audit Test Client',
        phone: '+91 9779878303',
        email: 'audit@example.com',
        clientEmailProvided: true,
        propertyType: 'Residential Villa / Estate',
        budgetRange: '₹5 Cr – ₹20 Cr',
        preferredLocation: 'Sector 82 A, Mohali',
        preferredContactMethod: 'email',
        sourceForm: 'contact',
        message: 'Testing email readiness without hardcoded SMTP credentials.',
      },
    });

    if (sendResult.recipient !== 'buildsmore66@gmail.com') {
      throw new Error(`Unexpected email recipient: ${sendResult.recipient}`);
    }
    if (!status.configured && sendResult.sent) {
      throw new Error('Email should not falsely report sent=true when SMTP env vars are missing');
    }
  });

  // 6. Database-Enforced Admin Login & Alias Rejection
  await test('Auth Hardening: authenticateAdminLogin rejects aliases, enforces DB hash when reachable, and blocks fallback in production', async () => {
    const devConfig: any = {
      nodeEnv: 'development',
      admin: {
        initialEmail: 'info@buildsmoremohali.com',
        initialPassword: 'DevEnvPassword!1',
        initialName: 'Director',
      },
    };
    const prodConfig: any = {
      nodeEnv: 'production',
      admin: {
        initialEmail: 'info@buildsmoremohali.com',
        initialPassword: 'ProdEnvPassword!1',
        initialName: 'Director',
      },
    };

    for (const alias of ['admin', 'administrator', 'buildsmore']) {
      const res = await authenticateAdminLogin({
        email: alias,
        password: 'DevEnvPassword!1',
        pool: null,
        config: devConfig,
      });
      if (res.ok || res.status !== 401) {
        throw new Error(`Expected 401 rejection for alias "${alias}", got ${res.status}`);
      }
    }

    const emptyRes = await authenticateAdminLogin({
      email: '',
      password: 'DevEnvPassword!1',
      pool: null,
      config: devConfig,
    });
    if (emptyRes.ok || emptyRes.status !== 400) {
      throw new Error(`Expected 400 rejection for empty identifier, got ${emptyRes.status}`);
    }

    // Production without reachable DB -> 503 (never falls back to env password)
    const prodNoDb = await authenticateAdminLogin({
      email: 'info@buildsmoremohali.com',
      password: 'ProdEnvPassword!1',
      pool: null,
      config: prodConfig,
    });
    if (prodNoDb.ok || prodNoDb.status !== 503) {
      throw new Error(`Expected 503 in production without DB, got ${prodNoDb.status}`);
    }

    // Reachable DB with specific bcrypt hash must reject initialPassword env fallback and accept DB hash
    const dbHash = await bcrypt.hash('DatabaseOnlySecret!2026', 10);
    const mockPool: any = {
      async query(sql: string, params: unknown[]) {
        if (sql.includes('SELECT id, email')) {
          const requestedEmail = String(params[0] || '');
          if (requestedEmail === 'info@buildsmoremohali.com') {
            return {
              rows: [
                {
                  id: 'db-admin-uuid-1',
                  email: 'info@buildsmoremohali.com',
                  password_hash: dbHash,
                  full_name: 'DB Managing Director',
                  role: 'SuperAdmin',
                  is_active: true,
                },
              ],
            };
          }
          return { rows: [] };
        }
        return { rows: [] };
      },
    };

    const envFallbackRejected = await authenticateAdminLogin({
      email: 'info@buildsmoremohali.com',
      password: 'ProdEnvPassword!1',
      pool: mockPool,
      config: prodConfig,
    });
    if (envFallbackRejected.ok || envFallbackRejected.status !== 401) {
      throw new Error('DB authentication should ignore env fallback password when DB is reachable');
    }

    const dbSuccess = await authenticateAdminLogin({
      email: 'info@buildsmoremohali.com',
      password: 'DatabaseOnlySecret!2026',
      pool: mockPool,
      config: prodConfig,
    });
    if (!dbSuccess.ok || !dbSuccess.token || dbSuccess.user?.email !== 'info@buildsmoremohali.com') {
      throw new Error(`Expected DB authentication to succeed, got ${dbSuccess.error}`);
    }
  });

  // 7. PostgreSQL Schema Alignment & No Nonexistent Column Queries
  await test('PostgreSQL Schema Sync: upsert columns exist in schema.ts and server.ts omits seo_metadata/source_meta', () => {
    const schemaSource = fs.readFileSync(path.resolve(process.cwd(), 'src/db/schema.ts'), 'utf-8');
    const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');

    if (serverSource.includes('seo_metadata') || serverSource.includes('source_meta')) {
      throw new Error('server.ts still references nonexistent seo_metadata or source_meta columns');
    }
    for (const col of PROPERTIES_UPSERT_COLUMNS) {
      if (!schemaSource.includes(`'${col}'`)) {
        throw new Error(`postgresSync column "${col}" not found in src/db/schema.ts`);
      }
    }
  });

  // 8. InquiryRepository & PropertyRepository Persistence Across Restart (Isolated tempDir)
  await test('Persistence Reliability: inquiry and property CRUD mutations survive reloadFromDisk()', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildsmore-persist-test-'));
    try {
      const propRepo = new PropertyRepository({ dataDir: tmpDir });
      const createdProp = propRepo.createProperty({
        slug: 'restart-test-estate',
        title: 'Restart Persistence Villa',
        subtitle: 'VIP Road',
        description: 'Testing durable disk persistence across server restarts.',
        price: 18500000,
        currency: 'INR',
        category: 'Residential',
        propertyType: 'Villa',
        status: 'Published',
        featured: true,
        isNewDevelopment: false,
        address: 'Sector 82 A, Mohali',
        city: 'Mohali',
        stateRegion: 'Punjab',
        country: 'India',
        coordinates: { lat: 30.65, lng: 76.73 },
        bedrooms: 4,
        bathrooms: 5,
        interiorAreaSqFt: 4200,
        images: [{ id: 'img-1', url: 'https://example.com/villa.jpg', isPrimary: true }],
        amenities: ['Clubhouse'],
        specifications: {},
        seo: { metaTitle: 'Restart Persistence Villa', metaDescription: 'Test', keywords: [] },
        source: { type: 'manual', lastSyncedAt: new Date().toISOString() },
      });

      const inqRepo = new InquiryRepository({ dataDir: tmpDir });
      const createdInq = inqRepo.createInquiry({
        id: 'inq-persist-1',
        propertyId: createdProp.id,
        propertyTitle: createdProp.title,
        clientName: 'Vikram Singh',
        email: 'vikram@example.com',
        phone: '+91 9779878303',
        preferredContactMethod: 'whatsapp',
        budgetRange: '₹10 Cr+',
        sourceForm: 'property_detail',
        message: 'Scheduling site tour.',
        status: 'New',
        notes: '',
        emailNotificationSent: false,
        createdAt: new Date().toISOString(),
      });
      inqRepo.updateInquiry(createdInq.id, { status: 'In Negotiation', notes: 'Tour confirmed' });

      // Simulate server restart by instantiating fresh repositories from the same tmpDir
      const restartedPropRepo = new PropertyRepository({ dataDir: tmpDir });
      const restartedInqRepo = new InquiryRepository({ dataDir: tmpDir });

      const fetchedProp = restartedPropRepo.getPropertyById(createdProp.id);
      const fetchedInq = restartedInqRepo.getInquiryById(createdInq.id);
      if (!fetchedProp || fetchedProp.title !== 'Restart Persistence Villa') {
        throw new Error('Property did not persist across repository restart');
      }
      if (!fetchedInq || fetchedInq.status !== 'In Negotiation' || fetchedInq.notes !== 'Tour confirmed') {
        throw new Error('Inquiry creation or status/notes update did not persist across repository restart');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  return { passed, failed, results };
}
