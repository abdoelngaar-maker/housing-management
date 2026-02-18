/**
 * Storage helpers - supports S3-compatible storage or local file storage
 * For S3: Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET
 * For local: Files are saved to ./uploads directory
 */

import { ENV } from './_core/env';
import fs from 'node:fs';
import path from 'node:path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function isS3Configured(): boolean {
  return !!(ENV.s3Endpoint && ENV.s3AccessKey && ENV.s3SecretKey && ENV.s3Bucket);
}

async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string
): Promise<{ key: string; url: string }> {
  // Dynamic import to avoid issues when S3 is not configured
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

  const client = new S3Client({
    endpoint: ENV.s3Endpoint,
    region: ENV.s3Region,
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    forcePathStyle: true,
  });

  const buffer = typeof data === "string" ? Buffer.from(data) : data;

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: relKey,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
    })
  );

  const url = `${ENV.s3Endpoint}/${ENV.s3Bucket}/${relKey}`;
  return { key: relKey, url };
}

async function localPut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType: string
): Promise<{ key: string; url: string }> {
  ensureUploadsDir();

  const filePath = path.join(UPLOADS_DIR, relKey);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  // Return a URL relative to the server
  const url = `/uploads/${relKey}`;
  return { key: relKey, url };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (isS3Configured()) {
    return s3Put(relKey, data, contentType);
  }
  return localPut(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  if (isS3Configured()) {
    const url = `${ENV.s3Endpoint}/${ENV.s3Bucket}/${relKey}`;
    return { key: relKey, url };
  }
  return { key: relKey, url: `/uploads/${relKey}` };
}
