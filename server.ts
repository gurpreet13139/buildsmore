/**
 * BUILDsmore — Full-Stack Node.js / Express Server
 * Serves REST API endpoints, Drizzle ORM PostgreSQL persistence, S3 photo ingestion,
 * Redis/BullMQ background synchronization, and Vite frontend.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  generateRobotsTxt,
  generateSitemapXml,
  InitialAppData,
  injectSeoIntoHtml,
  normalizePathname,
  resolveSeoForRoute,
} from './src/utils/seo';
import { 
  getServerConfig, 
  validateEnvironment, 
  maskSecret,
} from './src/server/config';
import { 
  runDatabaseMigrations, 
  initializeFirstAdministrator, 
  testDatabaseConnectivity,
  getDbPool
} from './src/server/db';
import { 
  authenticateAdminLogin,
  getOptionalAdmin,
  requireAdminAuth, 
  AuthenticatedRequest 
} from './src/server/auth';
import {
  syncPropertyToPostgres,
  deletePropertyFromPostgres,
  ensurePropertyInPostgres,
  reconcileWithPostgres,
  syncBlogToPostgres,
  deleteBlogFromPostgres,
  reconcileBlogsWithPostgres,
} from './src/server/postgresSync';
import {
  inquiryRepository,
  normalizeInquiryStatus,
} from './src/server/inquiryRepository';
import { 
  ALLOWED_IMAGE_MIME_TYPES,
  uploadPropertyPhoto, 
  testS3Connectivity 
} from './src/server/storage-s3';
import { 
  testRedisConnectivity, 
  getImportQueue 
} from './src/server/redis';
import { 
  scrapePropertyWebsite, 
  validateSafeUrl, 
  convertExtractedDataToProperty 
} from './src/server/universalScraper';
import { Property, ExtractedWebsiteData, ImportJob } from './src/types/property';
import { propertyRepository } from './src/server/propertyRepository';
import { blogRepository } from './src/server/blogRepository';
import { 
  inspectWordPressSite, 
  fetchWordPressPosts, 
  executeWordPressImport 
} from './src/server/wordpressService';
import {
  apiCorsMiddleware,
  createRateLimiter,
  securityHeadersMiddleware,
  validateAndSanitizeInquiryInput,
} from './src/server/security';
import {
  getEmailNotificationStatus,
  sendInquiryNotificationEmail,
} from './src/server/mailer';

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per image

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_UPLOAD_BYTES,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only JPEG, PNG, WebP, and AVIF images are allowed.'));
    }
  },
});

const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 180,
  keyPrefix: 'api-general',
  message: 'Too many API requests. Please slow down and try again.',
});

const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'auth-login',
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
});

const inquiryRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 8,
  keyPrefix: 'public-inquiry',
  message: 'Too many inquiry submissions from this connection. Please wait a few minutes or call +91 977-987-8303.',
});

const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  keyPrefix: 'admin-upload',
  message: 'Upload rate limit reached. Please try again shortly.',
});

const scraperRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 25,
  keyPrefix: 'admin-scraper',
  message: 'Website inspection rate limit reached. Please wait a few minutes.',
});

async function startServer() {
  const config = getServerConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(securityHeadersMiddleware);
  app.use('/api', apiCorsMiddleware, apiRateLimiter);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(
    '/uploads',
    (_req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
      next();
    },
    express.static(path.resolve(process.cwd(), 'public/uploads'), {
      maxAge: '30d',
      dotfiles: 'ignore',
    })
  );

  // 1. Validate Environment Variables at Startup
  console.log('----------------------------------------------------');
  console.log('BUILDsmore Luxury Real Estate Platform — Server Init');
  console.log('----------------------------------------------------');

  const validation = validateEnvironment();
  if (!validation.isValid) {
    console.warn('[Config Warning] The following environment variables are using default or placeholder values:');
    validation.missingVariables.forEach((v) => console.warn(`  - ${v}`));
    if (validation.errors.length > 0) {
      console.warn('[Config Errors]:');
      validation.errors.forEach((e) => console.warn(`  - ${e}`));
    }
  } else {
    console.log('[Config] All required environment variables validated successfully.');
  }

  const emailStatus = getEmailNotificationStatus();
  console.log(`[Config] Database: ${maskSecret(config.databaseUrl)}`);
  console.log(`[Config] Redis:    ${maskSecret(config.redisUrl)}`);
  console.log(`[Config] S3 Bucket: ${config.s3.bucket} (${config.s3.region})`);
  console.log(`[Config] S3 Key ID: ${maskSecret(config.s3.accessKeyId)}`);
  console.log(`[Config] Admin:    ${config.admin.initialEmail}`);
  console.log(`[Config] JWT:      ${maskSecret(config.jwtSecret)}`);
  console.log(
    `[Config] SMTP:     ${emailStatus.configured ? `Configured -> ${emailStatus.recipient}` : `NOT CONFIGURED (Missing: ${emailStatus.missingVariables.join(', ')})`}`
  );
  console.log('----------------------------------------------------');

  // 2. Initial Database Migrations, First Admin Setup & PostgreSQL Property Reconciliation
  try {
    const migrationResult = await runDatabaseMigrations();
    console.log(`[Database] ${migrationResult.message}`);
    
    const adminInit = await initializeFirstAdministrator();
    if (adminInit.created) {
      console.log(`[Admin] Initial administrator created for: ${adminInit.email}`);
    } else {
      console.log(`[Admin] Administrator account verified for: ${adminInit.email} (Password preserved)`);
    }

    const pgSync = await reconcileWithPostgres(propertyRepository);
    if (pgSync.connected) {
      console.log(
        `[PostgreSQL Sync] Reconciled cleanly (restoredFromPg=${pgSync.restoredFromPg}, syncedToPg=${pgSync.syncedToPg})`
      );
    }

    const blogPgSync = await reconcileBlogsWithPostgres(blogRepository);
    if (blogPgSync.connected) {
      console.log(
        `[PostgreSQL Blog Sync] Reconciled cleanly (restoredFromPg=${blogPgSync.restoredFromPg}, syncedToPg=${blogPgSync.syncedToPg})`
      );
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Database Init Note]:', msg);
  }

  // 3. API Health (Public minimal status; detailed infra diagnostics gated to Admin)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/admin/health', requireAdminAuth, async (_req, res) => {
    const dbStatus = await testDatabaseConnectivity();
    const redisStatus = await testRedisConnectivity();
    const s3Status = await testS3Connectivity();
    const smtpStatus = getEmailNotificationStatus();

    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus,
        s3: s3Status,
        smtp: smtpStatus,
      },
      environment: {
        nodeEnv: config.nodeEnv,
        bucket: config.s3.bucket,
        s3Endpoint: config.s3.endpoint,
        databaseTarget: maskSecret(config.databaseUrl),
      },
    });
  });

  // 4. Authentication Endpoints (Strict Email + DB Auth; Legacy Aliases Removed)
  app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
    try {
      const { email, password } = req.body as { email?: unknown; password?: unknown };
      const authResult = await authenticateAdminLogin({
        email,
        password,
        pool: getDbPool(),
        config,
      });

      if (!authResult.ok || !authResult.token || !authResult.user) {
        res.status(authResult.status).json({ error: authResult.error || 'Authentication rejected.' });
        return;
      }

      res.json({
        token: authResult.token,
        user: authResult.user,
      });
    } catch {
      res.status(500).json({ error: 'Authentication service unavailable.' });
    }
  });

  app.get('/api/auth/me', requireAdminAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.admin });
  });

  // 5. Photo Upload Endpoints (Admin-only, MIME + Magic-byte validated)
  const handleSingleUploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.single('photo')(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Invalid file upload request.';
        const status = message.toLowerCase().includes('large') ? 413 : 400;
        res.status(status).json({ error: message });
        return;
      }
      next();
    });
  };

  const handleMultiUploadMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.array('photos', 20)(req, res, (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Invalid batch upload request.';
        const status = message.toLowerCase().includes('large') ? 413 : 400;
        res.status(status).json({ error: message });
        return;
      }
      next();
    });
  };

  app.post('/api/upload', requireAdminAuth, uploadRateLimiter, handleSingleUploadMiddleware, async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file was provided in the upload request.' });
        return;
      }

      const uploadResult = await uploadPropertyPhoto(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      res.json(uploadResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Photo upload failed';
      res.status(400).json({ error: 'Photo upload rejected', message: msg });
    }
  });

  app.post('/api/upload-multiple', requireAdminAuth, uploadRateLimiter, handleMultiUploadMiddleware, async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files provided' });
        return;
      }
      const results = [];
      for (const file of files) {
        const up = await uploadPropertyPhoto(file.buffer, file.originalname, file.mimetype);
        results.push(up);
      }
      res.json({ uploaded: results });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch upload failed';
      res.status(400).json({ error: 'Batch upload rejected', message: msg });
    }
  });

  // Update manual main image for a specific property (Admin-only)
  app.patch('/api/properties/:id/main-image', requireAdminAuth, async (req, res) => {
    try {
      const { url, caption } = req.body as { url?: string; caption?: string };
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({ error: 'A valid image url is required.' });
        return;
      }

      const existing = propertyRepository.getPropertyById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const cleanUrl = url.trim();
      const remainingImages = (existing.images || [])
        .filter(img => img.url !== cleanUrl)
        .map(img => ({ ...img, isPrimary: false }));

      const manualCover = {
        id: `img-custom-${Date.now()}`,
        url: cleanUrl,
        caption: typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, 200) : `${existing.title} - Primary Cover`,
        isPrimary: true,
        origin: 'manual' as const,
        isManual: true,
        isLogoFallback: false,
      };

      const updated = propertyRepository.updateProperty(existing.id, {
        images: [manualCover, ...remainingImages],
        hasManualMainImage: true,
      });

      if (updated) {
        await syncPropertyToPostgres(updated);
      }

      res.json({ success: true, property: updated });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Failed to update main image', message: msg });
    }
  });

  // =========================================================================
  // CENTRAL PROPERTY MANAGEMENT REST API (Scales to 1,000+ properties)
  // =========================================================================

  // GET /api/properties (Public sees only Published; Admin token unlocks all/Draft)
  app.get('/api/properties', (req, res) => {
    try {
      const {
        search,
        category,
        status,
        featured,
        trophyOnly,
        locationId,
        page,
        limit,
        sortBy,
        all,
      } = req.query;

      const isAdmin = Boolean(getOptionalAdmin(req));
      const pageNum = page ? Math.max(1, parseInt(String(page), 10) || 1) : 1;
      const limitNum = all === 'true' ? 5000 : limit ? Math.min(5000, Math.max(1, parseInt(String(limit), 10) || 1000)) : 1000;

      const effectiveStatus = isAdmin ? (status ? String(status) : undefined) : 'Published';

      const result = propertyRepository.getAllProperties({
        search: search ? String(search) : undefined,
        category: category ? String(category) : undefined,
        status: effectiveStatus,
        featured: featured === 'true' ? true : undefined,
        trophyOnly: trophyOnly === 'true' ? true : undefined,
        locationId: locationId ? String(locationId) : undefined,
        page: pageNum,
        limit: limitNum,
        sortBy: sortBy as any,
      });

      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to retrieve properties', message: (err as Error).message });
    }
  });

  // GET /api/properties/:idOrSlug
  app.get('/api/properties/:idOrSlug', (req, res) => {
    try {
      const { idOrSlug } = req.params;
      const isAdmin = Boolean(getOptionalAdmin(req));
      const prop = propertyRepository.getPropertyBySlug(idOrSlug) || propertyRepository.getPropertyById(idOrSlug);
      if (!prop || (!isAdmin && prop.status !== 'Published')) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }
      res.json(prop);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to retrieve property', message: (err as Error).message });
    }
  });

  // POST /api/properties (Admin-only)
  app.post('/api/properties', requireAdminAuth, async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object' || typeof req.body.title !== 'string' || !req.body.title.trim()) {
        res.status(400).json({ error: 'Property title is required.' });
        return;
      }
      const property = propertyRepository.createProperty(req.body);
      await syncPropertyToPostgres(property);
      res.status(201).json(property);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to create property', message: (err as Error).message });
    }
  });

  // PUT /api/properties/:id (Admin-only)
  app.put('/api/properties/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Invalid property update payload.' });
        return;
      }
      const updated = propertyRepository.updateProperty(id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Property not found for update' });
        return;
      }
      await syncPropertyToPostgres(updated);
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to update property', message: (err as Error).message });
    }
  });

  // DELETE /api/properties/:id (Admin-only)
  app.delete('/api/properties/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = propertyRepository.deleteProperty(id);
      if (!success) {
        res.status(404).json({ error: 'Property not found for deletion' });
        return;
      }
      await deletePropertyFromPostgres(id);
      res.json({ success: true, message: 'Property deleted successfully' });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to delete property', message: (err as Error).message });
    }
  });

  // PATCH toggles (Admin-only)
  app.patch('/api/properties/:id/toggle-publish', requireAdminAuth, async (req, res) => {
    const prop = propertyRepository.togglePublish(req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    await syncPropertyToPostgres(prop);
    res.json(prop);
  });

  app.patch('/api/properties/:id/toggle-featured', requireAdminAuth, async (req, res) => {
    const prop = propertyRepository.toggleFeatured(req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    await syncPropertyToPostgres(prop);
    res.json(prop);
  });

  app.patch('/api/properties/:id/toggle-latest', requireAdminAuth, async (req, res) => {
    const prop = propertyRepository.toggleLatest(req.params.id);
    if (!prop) return res.status(404).json({ error: 'Property not found' });
    await syncPropertyToPostgres(prop);
    res.json(prop);
  });

  app.patch('/api/properties/:id/toggle-trophy', requireAdminAuth, async (req, res) => {
    const isTrophy = propertyRepository.toggleTrophyHolding(req.params.id);
    const updated = propertyRepository.getPropertyById(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Property not found' });
    await syncPropertyToPostgres(updated);
    res.json({ isTrophyHolding: isTrophy, property: updated });
  });

  // =========================================================================
  // TROPHY HOLDINGS OF THE SEASON REST API
  // =========================================================================

  app.get('/api/trophy-holdings', (_req, res) => {
    try {
      const holdings = propertyRepository.getTrophyHoldings();
      res.json(holdings);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch trophy holdings', message: (err as Error).message });
    }
  });

  app.put('/api/trophy-holdings', requireAdminAuth, async (req, res) => {
    try {
      const { propertyIds } = req.body;
      if (!Array.isArray(propertyIds)) {
        res.status(400).json({ error: 'propertyIds must be an array of string IDs' });
        return;
      }
      const updated = propertyRepository.updateTrophyHoldings(propertyIds);
      for (const prop of updated) {
        await syncPropertyToPostgres(prop);
      }
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to update trophy holdings', message: (err as Error).message });
    }
  });

  // =========================================================================
  // CURATED INVESTMENT COLLECTIONS REST API
  // =========================================================================

  app.get('/api/collections', (req, res) => {
    try {
      const isAdmin = Boolean(getOptionalAdmin(req));
      const includeDrafts = isAdmin && req.query.includeDrafts === 'true';
      const collections = propertyRepository.getAllCollections(includeDrafts);
      res.json(collections);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch collections', message: (err as Error).message });
    }
  });

  app.get('/api/collections/:slug', (req, res) => {
    try {
      const isAdmin = Boolean(getOptionalAdmin(req));
      const collection = propertyRepository.getCollectionBySlug(req.params.slug);
      if (!collection || (!isAdmin && collection.status !== 'Published')) {
        res.status(404).json({ error: 'Collection not found' });
        return;
      }
      res.json(collection);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch collection', message: (err as Error).message });
    }
  });

  app.post('/api/collections', requireAdminAuth, (req, res) => {
    try {
      const created = propertyRepository.createCollection(req.body);
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to create collection', message: (err as Error).message });
    }
  });

  app.put('/api/collections/:id', requireAdminAuth, (req, res) => {
    try {
      const updated = propertyRepository.updateCollection(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Collection not found for update' });
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to update collection', message: (err as Error).message });
    }
  });

  app.delete('/api/collections/:id', requireAdminAuth, (req, res) => {
    try {
      const success = propertyRepository.deleteCollection(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'Collection not found for deletion' });
        return;
      }
      res.json({ success: true, message: 'Collection deleted (properties preserved)' });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to delete collection', message: (err as Error).message });
    }
  });

  app.post('/api/collections/:id/properties', requireAdminAuth, (req, res) => {
    try {
      const { propertyId } = req.body;
      if (!propertyId) return res.status(400).json({ error: 'propertyId required' });
      const success = propertyRepository.addPropertyToCollection(req.params.id, propertyId);
      res.json({ success });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to add property to collection', message: (err as Error).message });
    }
  });

  app.delete('/api/collections/:id/properties/:propertyId', requireAdminAuth, (req, res) => {
    try {
      const success = propertyRepository.removePropertyFromCollection(req.params.id, req.params.propertyId);
      res.json({ success });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to remove property from collection', message: (err as Error).message });
    }
  });

  app.put('/api/collections/:id/reorder', requireAdminAuth, (req, res) => {
    try {
      const { propertyIds } = req.body;
      if (!Array.isArray(propertyIds)) return res.status(400).json({ error: 'propertyIds must be array' });
      const success = propertyRepository.reorderCollectionProperties(req.params.id, propertyIds);
      res.json({ success });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to reorder collection properties', message: (err as Error).message });
    }
  });

  // =========================================================================
  // DYNAMIC LOCATION MANAGEMENT REST API
  // =========================================================================

  app.get('/api/locations', (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true';
      const locations = propertyRepository.getAllLocations(activeOnly);
      res.json(locations);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch locations', message: (err as Error).message });
    }
  });

  app.get('/api/locations/:idOrSlug', (req, res) => {
    try {
      const { idOrSlug } = req.params;
      const loc = propertyRepository.getLocationBySlug(idOrSlug) || propertyRepository.getLocationById(idOrSlug);
      if (!loc) {
        res.status(404).json({ error: 'Location not found' });
        return;
      }
      res.json(loc);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch location', message: (err as Error).message });
    }
  });

  app.post('/api/locations', requireAdminAuth, (req, res) => {
    try {
      const created = propertyRepository.createLocation(req.body);
      res.status(201).json(created);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to create location', message: (err as Error).message });
    }
  });

  app.put('/api/locations/:id', requireAdminAuth, (req, res) => {
    try {
      const updated = propertyRepository.updateLocation(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Location not found for update' });
        return;
      }
      res.json(updated);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to update location', message: (err as Error).message });
    }
  });

  app.delete('/api/locations/:id', requireAdminAuth, (req, res) => {
    try {
      const success = propertyRepository.deleteLocation(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'Location not found for deletion' });
        return;
      }
      res.json({ success: true, message: 'Location deleted successfully' });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to delete location', message: (err as Error).message });
    }
  });

  app.post('/api/locations/match', requireAdminAuth, (req, res) => {
    try {
      const { query, address, locality } = req.body;
      const match = propertyRepository.findLocationMatch(query, address, locality);
      res.json(match);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to match location', message: (err as Error).message });
    }
  });

  // =========================================================================
  // WORDPRESS PROPERTY IMPORT REST API (Admin-only + Rate Limited)
  // =========================================================================

  app.post('/api/wordpress/inspect', requireAdminAuth, scraperRateLimiter, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: 'WordPress website URL is required.' });
      const discovery = await inspectWordPressSite(url);
      res.json(discovery);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Inspection failed', message: (err as Error).message });
    }
  });

  app.post('/api/wordpress/fetch-posts', requireAdminAuth, scraperRateLimiter, async (req, res) => {
    try {
      const { url, endpoint, page, perPage } = req.body;
      if (!url || typeof url !== 'string') return res.status(400).json({ error: 'WordPress website URL is required.' });
      const result = await fetchWordPressPosts(url, endpoint, page || 1, perPage || 20);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch WordPress posts', message: (err as Error).message });
    }
  });

  app.post('/api/wordpress/import', requireAdminAuth, scraperRateLimiter, async (req, res) => {
    try {
      const { url, posts, mapping, syncPolicy } = req.body;
      if (!url || !Array.isArray(posts) || posts.length === 0) {
        res.status(400).json({ error: 'url and non-empty posts array are required.' });
        return;
      }
      const report = await executeWordPressImport(url, posts, mapping, syncPolicy);
      for (const importedProp of report.properties) {
        await syncPropertyToPostgres(importedProp);
      }
      res.json(report);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Import execution failed', message: (err as Error).message });
    }
  });

  // 6. BullMQ Asynchronous Job Trigger
  app.post('/api/jobs/sync', requireAdminAuth, async (req, res) => {
    try {
      const { sourceId, isDryRun } = req.body;
      const queue = getImportQueue();

      const job = await queue.add('sync-wordpress-site', {
        sourceId,
        isDryRun: Boolean(isDryRun),
        initiatedAt: new Date().toISOString(),
      });

      res.json({
        jobId: job.id,
        status: 'queued',
        message: 'Import synchronization task queued in Redis BullMQ pipeline.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: 'Queue failure', message: msg });
    }
  });

  // 7. Lead & Property Inquiries Endpoint (Rate Limited + Durable Disk/PG Persistence + SMTP Notification)
  app.post('/api/inquiries', inquiryRateLimiter, async (req, res) => {
    try {
      const validationResult = validateAndSanitizeInquiryInput(req.body);
      if (!validationResult.valid || !validationResult.data) {
        res.status(400).json({
          success: false,
          error: validationResult.error || 'Please check your inquiry fields and try again.',
        });
        return;
      }

      const payload = validationResult.data;
      let persistedId = `inq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let dbSaved = false;
      const createdAt = new Date().toISOString();

      // Attempt PostgreSQL persistence (syncing property FK first if needed)
      try {
        const pool = getDbPool();
        let pgPropertyId: string | null = null;
        if (payload.propertyId) {
          const existsInPg = await ensurePropertyInPostgres(payload.propertyId, propertyRepository, pool);
          pgPropertyId = existsInPg ? payload.propertyId : null;
        }

        const insertRes = await pool.query(
          `INSERT INTO inquiries (property_id, client_name, email, phone, preferred_contact_method, investment_budget, scheduled_tour_date, message, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, created_at`,
          [
            pgPropertyId,
            payload.fullName,
            payload.email,
            payload.phone,
            payload.preferredContactMethod,
            payload.budgetRange,
            payload.scheduledTourDate || null,
            payload.message,
            'New',
          ]
        );

        if (insertRes.rows && insertRes.rows.length > 0) {
          persistedId = String(insertRes.rows[0].id);
          dbSaved = true;
        }
      } catch (dbErr: unknown) {
        console.warn('[Server Inquiry Notice] PostgreSQL insertion skipped:', dbErr instanceof Error ? dbErr.message : String(dbErr));
      }

      // Send email notification to buildsmore66@gmail.com via server-side SMTP env vars
      const emailResult = await sendInquiryNotificationEmail({
        inquiryId: persistedId,
        createdAt,
        payload,
      });

      const savedRecord = inquiryRepository.createInquiry({
        id: persistedId,
        clientName: payload.fullName,
        phone: payload.phone,
        email: payload.clientEmailProvided ? payload.email : 'Not provided',
        propertyId: payload.propertyId,
        propertyTitle: payload.propertyTitle,
        propertySlug: payload.propertySlug,
        propertyType: payload.propertyType,
        budgetRange: payload.budgetRange,
        preferredLocation: payload.preferredLocation,
        preferredContactMethod: payload.preferredContactMethod,
        scheduledTourDate: payload.scheduledTourDate,
        sourceForm: payload.sourceForm,
        message: payload.message,
        status: 'New',
        notes: '',
        emailNotificationSent: emailResult.sent,
        createdAt,
        updatedAt: createdAt,
      });

      res.status(201).json({
        success: true,
        inquiryId: persistedId,
        savedToDatabase: dbSaved,
        savedToDisk: true,
        emailNotification: {
          sent: emailResult.sent,
          configured: emailResult.configured,
          recipient: emailResult.recipient,
        },
        inquiry: savedRecord,
        message: emailResult.sent
          ? 'Your inquiry has been submitted and forwarded to our advisory team. A property specialist will contact you shortly.'
          : 'Your inquiry has been registered with our advisory desk. For immediate assistance, please call +91 977-987-8303.',
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Unable to submit inquiry right now. Please try again or call +91 977-987-8303.',
      });
    }
  });

  app.get('/api/inquiries', requireAdminAuth, async (_req, res) => {
    try {
      const pool = getDbPool();
      try {
        const dbRes = await pool.query('SELECT * FROM inquiries ORDER BY created_at DESC LIMIT 200');
        if (dbRes.rows && dbRes.rows.length > 0) {
          const merged = inquiryRepository.mergeFromDatabase(dbRes.rows);
          res.json({ inquiries: merged });
          return;
        }
      } catch {
        // Database not reachable, serve durable disk repository
      }
      res.json({ inquiries: inquiryRepository.getAllInquiries() });
    } catch {
      res.status(500).json({ error: 'Failed to retrieve inquiries' });
    }
  });

  app.patch('/api/inquiries/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes, assignedAdvisor } = req.body as {
        status?: unknown;
        notes?: unknown;
        assignedAdvisor?: unknown;
      };

      const validStatuses = new Set(['New', 'Contacted', 'In Negotiation', 'Closed', 'Archived']);
      if (status !== undefined && (typeof status !== 'string' || !validStatuses.has(status))) {
        res.status(400).json({ error: 'Invalid inquiry status value.' });
        return;
      }

      const existing = inquiryRepository.getInquiryById(id);
      let updated = existing
        ? inquiryRepository.updateInquiry(id, { status, notes, assignedAdvisor })
        : null;

      try {
        const pool = getDbPool();
        const dbRes = await pool.query(
          `UPDATE inquiries
           SET status = COALESCE($2, status),
               notes = COALESCE($3, notes),
               assigned_advisor = COALESCE($4, assigned_advisor),
               updated_at = NOW()
           WHERE id::text = $1
           RETURNING *`,
          [
            id,
            status !== undefined ? normalizeInquiryStatus(status) : null,
            typeof notes === 'string' ? notes.slice(0, 4000) : null,
            typeof assignedAdvisor === 'string' ? assignedAdvisor.trim().slice(0, 200) : null,
          ]
        );
        if (!updated && dbRes.rows && dbRes.rows.length > 0) {
          const merged = inquiryRepository.mergeFromDatabase(dbRes.rows);
          updated = merged.find((i) => i.id === id) || null;
        }
      } catch {
        // DB unreachable; disk update already persisted atomically
      }

      if (!updated) {
        res.status(404).json({ error: 'Inquiry not found for update.' });
        return;
      }

      res.json({ success: true, inquiry: updated });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to update inquiry', message: (err as Error).message });
    }
  });

  app.delete('/api/inquiries/:id', requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deletedDisk = inquiryRepository.deleteInquiry(id);
      let deletedDb = false;
      try {
        const pool = getDbPool();
        const dbRes = await pool.query('DELETE FROM inquiries WHERE id::text = $1 RETURNING id', [id]);
        deletedDb = (dbRes.rows?.length || 0) > 0;
      } catch {
        // DB unreachable
      }

      if (!deletedDisk && !deletedDb) {
        res.status(404).json({ error: 'Inquiry not found for deletion.' });
        return;
      }
      res.json({ success: true, message: 'Inquiry deleted successfully.' });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to delete inquiry', message: (err as Error).message });
    }
  });

  // 8. Universal One-Page Real Estate Website Importer & Inspector API (Admin-only)
  const serverUniversalJobsStore: ImportJob[] = [];

  // 8.1 Single Website Inspection & Validation
  app.post('/api/sources/inspect-website', requireAdminAuth, scraperRateLimiter, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string' || !url.trim()) {
        res.status(400).json({ success: false, error: 'A valid website URL is required.' });
        return;
      }

      const trimmedUrl = url.trim();
      const safeCheck = await validateSafeUrl(trimmedUrl);
      if (!safeCheck.safe) {
        res.status(400).json({ success: false, error: safeCheck.reason || 'URL failed SSRF validation.' });
        return;
      }

      const extracted = await scrapePropertyWebsite(trimmedUrl);
      res.json({
        success: true,
        data: extracted,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: msg });
    }
  });

  // 8.2 Bulk Website Inspection (Multi-URL / CSV Batch)
  app.post('/api/sources/inspect-bulk', requireAdminAuth, scraperRateLimiter, async (req, res) => {
    try {
      const { urls } = req.body;
      if (!Array.isArray(urls) || urls.length === 0) {
        res.status(400).json({ success: false, error: 'An array of website URLs is required.' });
        return;
      }

      // Limit to 60 URLs per bulk request for safety and responsiveness
      const sanitizedUrls = Array.from(
        new Set(
          urls
            .map(u => (typeof u === 'string' ? u.trim() : ''))
            .filter(u => u.startsWith('http://') || u.startsWith('https://'))
        )
      ).slice(0, 60);

      if (sanitizedUrls.length === 0) {
        res.status(400).json({ success: false, error: 'No valid HTTP/HTTPS URLs provided in request.' });
        return;
      }

      const results: Array<{
        url: string;
        success: boolean;
        data?: ExtractedWebsiteData;
        error?: string;
      }> = [];

      for (const targetUrl of sanitizedUrls) {
        try {
          const safeCheck = await validateSafeUrl(targetUrl);
          if (!safeCheck.safe) {
            results.push({
              url: targetUrl,
              success: false,
              error: safeCheck.reason || 'Blocked by SSRF filter',
            });
            continue;
          }

          const extracted = await scrapePropertyWebsite(targetUrl);
          results.push({
            url: targetUrl,
            success: true,
            data: extracted,
          });

          // Pacing delay between live target fetches to avoid rate-limiting partner servers
          if (sanitizedUrls.length > 1) {
            await new Promise(r => setTimeout(r, 150));
          }
        } catch (scanErr: unknown) {
          const msg = scanErr instanceof Error ? scanErr.message : String(scanErr);
          results.push({
            url: targetUrl,
            success: false,
            error: msg,
          });
        }
      }

      res.json({
        success: true,
        total: sanitizedUrls.length,
        processed: results.length,
        successfulCount: results.filter(r => r.success).length,
        failedCount: results.filter(r => !r.success).length,
        results,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: 'Bulk inspection failed', details: msg });
    }
  });

  // 8.3 Commit Extracted Properties to Central Catalog (Admin-only)
  app.post('/api/sources/import-universal', requireAdminAuth, async (req, res) => {
    try {
      const { items, syncPolicy } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ success: false, error: 'Items array of extracted website data is required.' });
        return;
      }

      const policy: 'preserve_central' | 'update_existing' =
        syncPolicy === 'update_existing' ? 'update_existing' : 'preserve_central';
      const jobId = `job-univ-${Date.now()}`;
      const now = new Date().toISOString();
      const logs: Array<{ timestamp: string; level: 'info' | 'warn' | 'error'; message: string; recordId?: string }> = [];

      let newCount = 0;
      let updatedCount = 0;
      let duplicateCount = 0;
      const committedProperties: Property[] = [];
      const preservedIds: string[] = [];

      for (const item of items as ExtractedWebsiteData[]) {
        try {
          const existingAll = propertyRepository.getAllProperties({ limit: 5000 }).items;
          const { property, diffSummary } = convertExtractedDataToProperty(item, existingAll);
          const outcome = propertyRepository.upsertImportedProperty(property, policy);

          if (outcome.action === 'updated') {
            updatedCount++;
            committedProperties.push(outcome.property);
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Updated existing property "${outcome.property.title}": ${diffSummary.join(', ')}`,
              recordId: outcome.property.id,
            });
          } else if (outcome.action === 'skipped') {
            duplicateCount++;
            preservedIds.push(outcome.property.id);
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Preserved central record for "${outcome.property.title}". Skipped overwrite under preserve policy.`,
              recordId: outcome.property.id,
            });
            continue;
          } else {
            newCount++;
            committedProperties.push(outcome.property);
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'info',
              message: `Created new property listing "${outcome.property.title}" (${outcome.property.currency} ${outcome.property.price.toLocaleString()})`,
              recordId: outcome.property.id,
            });
          }

          // Schema-aligned PostgreSQL sync (created or updated records)
          const pgRes = await syncPropertyToPostgres(outcome.property);
          if (!pgRes.synced && pgRes.error) {
            logs.push({
              timestamp: new Date().toISOString(),
              level: 'warn',
              message: `Disk repository saved "${outcome.property.title}"; PostgreSQL sync notice: ${pgRes.error}`,
              recordId: outcome.property.id,
            });
          }
        } catch (itemErr: unknown) {
          const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
          logs.push({
            timestamp: new Date().toISOString(),
            level: 'error',
            message: `Failed to commit property: ${msg}`,
          });
        }
      }

      const completedJob: ImportJob = {
        id: jobId,
        sourceName: `Universal One-Page Importer (${items.length} sites)`,
        type: 'wordpress',
        status: 'Completed',
        isDryRun: false,
        totalRecords: items.length,
        processedRecords: items.length,
        newRecords: newCount,
        updatedRecords: updatedCount,
        duplicateRecords: duplicateCount,
        failedRecords: items.length - (newCount + updatedCount + duplicateCount),
        startedAt: now,
        completedAt: new Date().toISOString(),
        logs,
        reportSummary: `Successfully imported ${newCount} new properties, updated ${updatedCount} existing records, and preserved ${duplicateCount} unchanged properties across ${items.length} one-page property websites.`,
      };

      serverUniversalJobsStore.unshift(completedJob);

      res.status(201).json({
        success: true,
        jobId,
        newCount,
        updatedCount,
        duplicateCount,
        properties: committedProperties,
        preservedIds,
        job: completedJob,
        message: `Successfully processed ${items.length} property websites into Buildsmore catalog.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: 'Import failed', details: msg });
    }
  });

  // 8.4 Get Universal Importer Jobs (Admin-only)
  app.get('/api/sources/universal-jobs', requireAdminAuth, async (_req, res) => {
    res.json({ jobs: serverUniversalJobsStore });
  });

  // =========================================================================
  // 8.5 EDITORIAL JOURNAL & BLOG REST API
  // =========================================================================

  // GET /api/blogs (Public sees Published only; Admin token unlocks Drafts via ?includeDrafts=true or ?all=true)
  app.get('/api/blogs', (req, res) => {
    try {
      const isAdmin = Boolean(getOptionalAdmin(req));
      const includeDrafts =
        isAdmin && (req.query.includeDrafts === 'true' || req.query.all === 'true');
      const result = blogRepository.getAllBlogs({
        includeDrafts,
        category: req.query.category ? String(req.query.category) : undefined,
        tag: req.query.tag ? String(req.query.tag) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        page: req.query.page ? Math.max(1, parseInt(String(req.query.page), 10) || 1) : 1,
        limit: req.query.limit
          ? Math.min(500, Math.max(1, parseInt(String(req.query.limit), 10) || 100))
          : 100,
      });
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to retrieve blogs', message: (err as Error).message });
    }
  });

  // GET /api/blogs/:idOrSlug
  app.get('/api/blogs/:idOrSlug', (req, res) => {
    try {
      const isAdmin = Boolean(getOptionalAdmin(req));
      const post =
        blogRepository.getBlogBySlug(req.params.idOrSlug) ||
        blogRepository.getBlogById(req.params.idOrSlug);
      if (!post || (!isAdmin && post.status !== 'Published')) {
        res.status(404).json({ error: 'Blog article not found' });
        return;
      }
      res.json(post);
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to retrieve blog article', message: (err as Error).message });
    }
  });

  // POST /api/blogs (Admin-only)
  app.post('/api/blogs', requireAdminAuth, async (req, res) => {
    try {
      const { title, content } = req.body || {};
      if (typeof title !== 'string' || !title.trim() || typeof content !== 'string' || !content.trim()) {
        res.status(400).json({ error: 'Article title and content are required.' });
        return;
      }
      const created = blogRepository.createBlog({
        ...req.body,
        title: title.trim(),
        content: content.trim(),
      });
      await syncBlogToPostgres(created);
      res.status(201).json({ success: true, blog: created });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to create blog article', message: (err as Error).message });
    }
  });

  // PUT /api/blogs/:id (Admin-only)
  app.put('/api/blogs/:id', requireAdminAuth, async (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        res.status(400).json({ error: 'Invalid blog update payload.' });
        return;
      }
      const updated = blogRepository.updateBlog(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: 'Blog article not found for update.' });
        return;
      }
      await syncBlogToPostgres(updated);
      res.json({ success: true, blog: updated });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to update blog article', message: (err as Error).message });
    }
  });

  // PATCH /api/blogs/:id/toggle-publish (Admin-only)
  app.patch('/api/blogs/:id/toggle-publish', requireAdminAuth, async (req, res) => {
    try {
      const updated = blogRepository.togglePublish(req.params.id);
      if (!updated) {
        res.status(404).json({ error: 'Blog article not found.' });
        return;
      }
      await syncBlogToPostgres(updated);
      res.json({ success: true, blog: updated });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to toggle publication status', message: (err as Error).message });
    }
  });

  // DELETE /api/blogs/:id (Admin-only)
  app.delete('/api/blogs/:id', requireAdminAuth, async (req, res) => {
    try {
      const success = blogRepository.deleteBlog(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'Blog article not found for deletion.' });
        return;
      }
      await deleteBlogFromPostgres(req.params.id);
      res.json({ success: true, message: 'Article deleted successfully.' });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to delete blog article', message: (err as Error).message });
    }
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // =========================================================================
  // 8. TECHNICAL SEO ENDPOINTS: robots.txt & dynamic sitemap.xml
  // =========================================================================
  app.get('/robots.txt', (_req, res) => {
    res
      .status(200)
      .setHeader('Content-Type', 'text/plain; charset=utf-8')
      .setHeader('Cache-Control', 'public, max-age=300')
      .send(generateRobotsTxt());
  });

  app.get('/sitemap.xml', (_req, res) => {
    try {
      const properties = propertyRepository.getAllProperties({ limit: 5000 }).items;
      const collections = propertyRepository.getAllCollections(false);
      const blogs = blogRepository.getAllBlogs({ includeDrafts: false, limit: 500 }).items;
      const xml = generateSitemapXml(properties, collections, blogs);
      res
        .status(200)
        .setHeader('Content-Type', 'application/xml; charset=utf-8')
        .setHeader('Cache-Control', 'public, max-age=300')
        .send(xml);
    } catch (err: unknown) {
      res.status(500).setHeader('Content-Type', 'text/plain').send(`Sitemap generation error: ${(err as Error).message}`);
    }
  });

  const isSpaDocumentRequest = (req: express.Request): boolean => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false;
    const pathname = normalizePathname(req.path);
    if (
      pathname.startsWith('/api') ||
      pathname.startsWith('/uploads') ||
      pathname.startsWith('/assets') ||
      pathname.startsWith('/src/') ||
      pathname.startsWith('/node_modules') ||
      pathname.startsWith('/@') ||
      pathname === '/robots.txt' ||
      pathname === '/sitemap.xml'
    ) {
      return false;
    }
    const lastSegment = pathname.split('/').pop() || '';
    if (lastSegment.includes('.')) {
      return false;
    }
    const accept = (req.headers.accept || '').toLowerCase();
    if (accept && !accept.includes('text/html') && !accept.includes('*/*')) {
      return false;
    }
    return true;
  };

  // Public SSR initial payload strictly includes Published holdings, collections & blogs (never Drafts)
  const getSsrInitialData = (): InitialAppData => ({
    properties: propertyRepository.getAllProperties({ status: 'Published', limit: 5000 }).items,
    collections: propertyRepository.getAllCollections(false),
    locations: propertyRepository.getAllLocations(true),
    trophyHoldings: propertyRepository.getTrophyHoldings(),
    blogs: blogRepository.getAllBlogs({ includeDrafts: false, limit: 500 }).items,
  });

  // 9. Mount Frontend (Vite SSR in Dev, Dist + SSR in Prod)
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(async (req, res, next) => {
      if (!isSpaDocumentRequest(req)) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const transformed = await vite.transformIndexHtml(req.originalUrl, template);
        const initialData = getSsrInitialData();
        const seo = resolveSeoForRoute(req.path, {
          properties: initialData.properties,
          collections: initialData.collections,
          blogs: initialData.blogs,
        });

        let appHtml = '';
        try {
          const ssrMod = await vite.ssrLoadModule('/src/entry-server.tsx');
          appHtml = ssrMod.render(req.originalUrl || req.path, initialData);
        } catch (ssrErr) {
          console.warn('[SSR Dev Fallback]:', (ssrErr as Error).message);
        }

        const finalHtml = injectSeoIntoHtml(transformed, seo, {
          ...(appHtml ? { appHtml } : {}),
          initialData,
        });
        res
          .status(seo.isNotFound ? 404 : 200)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .send(finalHtml);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    const distIndexPath = path.resolve(distPath, 'index.html');
    const distServerEntry = path.resolve(process.cwd(), 'dist-server/entry-server.js');
    let prodSsrPromise: Promise<{ render: (url: string, data: InitialAppData) => string }> | null = null;
    const loadProdSsr = () => {
      if (!prodSsrPromise) {
        prodSsrPromise = fs.existsSync(distServerEntry)
          ? import(pathToFileURL(distServerEntry).href)
          : import('./src/entry-server');
      }
      return prodSsrPromise;
    };

    app.use(express.static(distPath, { index: false }));

    app.get('*', async (req, res) => {
      if (!isSpaDocumentRequest(req)) {
        res.status(404).send('Not Found');
        return;
      }
      try {
        const template = fs.readFileSync(distIndexPath, 'utf-8');
        const initialData = getSsrInitialData();
        const seo = resolveSeoForRoute(req.path, {
          properties: initialData.properties,
          collections: initialData.collections,
          blogs: initialData.blogs,
        });

        let appHtml = '';
        try {
          const ssrMod = await loadProdSsr();
          appHtml = ssrMod.render(req.originalUrl || req.path, initialData);
        } catch (ssrErr) {
          console.warn('[SSR Prod Fallback]:', (ssrErr as Error).message);
        }

        const finalHtml = injectSeoIntoHtml(template, seo, {
          ...(appHtml ? { appHtml } : {}),
          initialData,
        });
        res
          .status(seo.isNotFound ? 404 : 200)
          .setHeader('Content-Type', 'text/html; charset=utf-8')
          .send(finalHtml);
      } catch {
        res.sendFile(distIndexPath);
      }
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`BUILDsmore server active on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup exception:', err);
  process.exit(1);
});
