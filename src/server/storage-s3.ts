/**
 * BUILDsmore — S3-Compatible Object Storage Service
 * Enforces strict raster image magic-byte validation & UUID filenames before storing.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getServerConfig } from './config';

export interface S3UploadResult {
  key: string;
  url: string;
  bucket: string;
  sizeBytes: number;
  contentType: string;
}

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

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

  // AVIF: .... "ftypavif" or "ftypavis"
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1') {
      return { ext: 'avif', mime: 'image/avif' };
    }
  }

  return null;
}

let s3ClientInstance: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const config = getServerConfig();
    s3ClientInstance = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }
  return s3ClientInstance;
}

/**
 * Validates and uploads a property image to S3 (or hardened local fallback).
 */
export async function uploadPropertyPhoto(
  fileBuffer: Buffer,
  _originalFilename: string,
  mimeType: string
): Promise<S3UploadResult> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported file type. Only JPEG, PNG, WebP, and AVIF images are allowed.');
  }

  const detected = detectSafeImageFormat(fileBuffer);
  if (!detected) {
    throw new Error('File content failed binary image signature verification.');
  }

  const config = getServerConfig();
  const safeFilename = `${Date.now()}-${crypto.randomUUID()}.${detected.ext}`;
  const key = `properties/${safeFilename}`;

  // Try S3 if configured with non-example credentials
  if (
    config.s3.accessKeyId &&
    !config.s3.accessKeyId.includes('EXAMPLE') &&
    !config.s3.accessKeyId.includes('YOUR_')
  ) {
    try {
      const client = getS3Client();
      const command = new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: detected.mime,
        ACL: 'public-read',
      });

      await client.send(command);

      const endpointClean = config.s3.endpoint.replace(/\/$/, '');
      const publicUrl = `${endpointClean}/${config.s3.bucket}/${key}`;

      return {
        key,
        url: publicUrl,
        bucket: config.s3.bucket,
        sizeBytes: fileBuffer.length,
        contentType: detected.mime,
      };
    } catch (err: unknown) {
      console.warn('[Storage] S3 upload error, using local fallback:', (err as Error).message);
    }
  }

  // Local static storage fallback in public/uploads/
  const uploadsDir = path.resolve(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const filePath = path.join(uploadsDir, safeFilename);
  fs.writeFileSync(filePath, fileBuffer);

  return {
    key: `uploads/${safeFilename}`,
    url: `/uploads/${safeFilename}`,
    bucket: 'local-storage',
    sizeBytes: fileBuffer.length,
    contentType: detected.mime,
  };
}

/**
 * Validates S3 credentials and connectivity
 */
export async function testS3Connectivity(): Promise<{ connected: boolean; message: string }> {
  try {
    const config = getServerConfig();
    const client = getS3Client();

    const command = new HeadBucketCommand({
      Bucket: config.s3.bucket,
    });

    await client.send(command);
    return { connected: true, message: `Successfully connected to S3 bucket: ${config.s3.bucket}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      message: `S3 verification response: ${msg}`,
    };
  }
}
