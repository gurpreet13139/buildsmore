/**
 * BUILDsmore — Local Disk Media Storage Service (Primary VPS Storage)
 * Stores validated raster images securely in public/uploads/ and serves them via /uploads.
 * Enforces strict MIME allow-list, binary magic-byte verification, UUID filenames,
 * and path-traversal confinement.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface LocalUploadResult {
  key: string;
  url: string;
  storage: 'local-disk';
  bucket: 'local-storage';
  sizeBytes: number;
  contentType: string;
}

export interface LocalStorageHealth {
  healthy: boolean;
  writable: boolean;
  storage: 'local-disk';
  path: string;
  route: string;
  fileCount: number;
  message: string;
}

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export function getUploadsDirectory(): string {
  return path.resolve(process.cwd(), 'public/uploads');
}

/**
 * Verifies actual binary magic bytes to reject disguised HTML/SVG/script uploads.
 */
export function detectSafeImageFormat(
  buffer: Buffer
): { ext: 'jpg' | 'png' | 'webp' | 'avif'; mime: string } | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { ext: 'png', mime: 'image/png' };
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  // AVIF: .... "ftypavif" or "ftypavis" or "ftypmif1"
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return { ext: 'avif', mime: 'image/avif' };
    }
  }

  return null;
}

/**
 * Validates and saves a property or editorial image directly to local disk in public/uploads/.
 */
export async function uploadPropertyPhoto(
  fileBuffer: Buffer,
  _originalFilename: string,
  mimeType: string
): Promise<LocalUploadResult> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported file type. Only JPEG, PNG, WebP, and AVIF images are allowed.');
  }

  const detected = detectSafeImageFormat(fileBuffer);
  if (!detected) {
    throw new Error('File content failed binary image signature verification.');
  }

  const uploadsDir = getUploadsDirectory();
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const safeFilename = path.basename(`${Date.now()}-${crypto.randomUUID()}.${detected.ext}`);
  const filePath = path.resolve(uploadsDir, safeFilename);
  if (!filePath.startsWith(`${uploadsDir}${path.sep}`)) {
    throw new Error('Rejected unsafe upload target path.');
  }

  await fs.promises.writeFile(filePath, fileBuffer);

  return {
    key: `uploads/${safeFilename}`,
    url: `/uploads/${safeFilename}`,
    storage: 'local-disk',
    bucket: 'local-storage',
    sizeBytes: fileBuffer.length,
    contentType: detected.mime,
  };
}

/**
 * Verifies that local disk storage (public/uploads/) exists and is readable/writable.
 */
export async function testLocalStorageHealth(): Promise<LocalStorageHealth> {
  const uploadsDir = getUploadsDirectory();
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    await fs.promises.access(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
    const entries = await fs.promises.readdir(uploadsDir);
    const fileCount = entries.filter((name) => !name.startsWith('.')).length;

    return {
      healthy: true,
      writable: true,
      storage: 'local-disk',
      path: uploadsDir,
      route: '/uploads',
      fileCount,
      message: `Local disk storage ready at public/uploads/ (${fileCount} file${fileCount === 1 ? '' : 's'})`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      healthy: false,
      writable: false,
      storage: 'local-disk',
      path: uploadsDir,
      route: '/uploads',
      fileCount: 0,
      message: `Local storage check failed: ${msg}`,
    };
  }
}
