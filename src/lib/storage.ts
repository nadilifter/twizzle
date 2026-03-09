/**
 * S3 Storage Abstraction Library
 * 
 * This module provides a unified interface for file storage that works with:
 * - AWS S3 in production/staging/development environments
 * - MinIO in local development (S3-compatible)
 * 
 * Usage:
 *   import { uploadFile, getSignedUrl, deleteFile, getPublicUrl } from '@/lib/storage';
 */

import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnvConfig, getCurrentEnvironment } from './env-domains';

export type StorageBucket = 'assets' | 'documents';

// S3 Client singleton
let s3Client: S3Client | null = null;

/**
 * Get or create the S3 client
 * Configures for MinIO in local environment
 */
function getS3Client(): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const isLocal = getCurrentEnvironment() === 'local';
  
  s3Client = new S3Client({
    region: process.env.AWS_S3_REGION || 'us-east-1',
    // For local development with MinIO
    ...(isLocal && {
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true' || isLocal,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin',
      },
    }),
    // For cloud environments, use standard credentials
    ...(!isLocal && process.env.AWS_ACCESS_KEY_ID && {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    }),
  });

  return s3Client;
}

/**
 * Get the bucket name for a given storage type
 */
function getBucketName(bucket: StorageBucket): string {
  const config = getEnvConfig();
  return bucket === 'assets' ? config.s3Bucket : config.s3DocumentsBucket;
}

/**
 * Generate a storage key for organization assets
 */
export function getOrganizationAssetKey(
  organizationId: string,
  filename: string,
  type?: string
): string {
  const timestamp = Date.now();
  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  const sanitizedType = (type || 'file').replace(/[^a-z0-9]/gi, '_');
  return `organizations/${organizationId}/${sanitizedType}-${timestamp}${ext ? `.${ext}` : ''}`;
}

/**
 * Generate a storage key for user documents
 */
export function getUserDocumentKey(
  userId: string,
  filename: string,
  documentType?: string
): string {
  const timestamp = Date.now();
  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  const sanitizedType = (documentType || 'document').replace(/[^a-z0-9]/gi, '_');
  return `users/${userId}/documents/${sanitizedType}-${timestamp}${ext ? `.${ext}` : ''}`;
}

/**
 * Generate a storage key for registration file uploads (music, photos, etc.)
 */
export function getRegistrationFileKey(
  organizationId: string,
  athleteId: string,
  entityType: 'program' | 'competition' | 'event',
  entityId: string,
  filename: string
): string {
  const timestamp = Date.now();
  const ext = filename.includes('.') ? filename.split('.').pop() : '';
  return `organizations/${organizationId}/registration-files/${entityType}/${entityId}/${athleteId}-${timestamp}${ext ? `.${ext}` : ''}`;
}

export interface UploadOptions {
  /** Content type (MIME type) */
  contentType?: string;
  /** Cache control header */
  cacheControl?: string;
  /** Whether the file should be publicly accessible */
  isPublic?: boolean;
  /** Custom metadata */
  metadata?: Record<string, string>;
}

/**
 * Upload a file to S3/MinIO
 * 
 * @param bucket - 'assets' for public files, 'documents' for private files
 * @param key - The storage key (path) for the file
 * @param file - The file data as Buffer
 * @param options - Upload options
 * @returns The storage key of the uploaded file
 */
export async function uploadFile(
  bucket: StorageBucket,
  key: string,
  file: Buffer,
  options: UploadOptions = {}
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);
  const config = getEnvConfig();

  // Only set public-read ACL if there's no CDN (CloudFront handles public access)
  // and the bucket is assets and isPublic is not explicitly false
  const shouldSetPublicAcl = bucket === 'assets' 
    && options.isPublic !== false 
    && !config.cdnUrl;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: file,
    ContentType: options.contentType || 'application/octet-stream',
    CacheControl: options.cacheControl || (bucket === 'assets' ? 'public, max-age=31536000' : 'private, no-cache'),
    // Set ACL only when not using CloudFront CDN
    ...(shouldSetPublicAcl && {
      ACL: 'public-read',
    }),
    ...(options.metadata && { Metadata: options.metadata }),
  });

  await client.send(command);
  return key;
}

/**
 * Get a signed URL for private file access
 * 
 * @param bucket - The storage bucket
 * @param key - The storage key
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Signed URL for temporary access
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return awsGetSignedUrl(client, command, { expiresIn });
}

/**
 * Get a signed URL for uploading a file directly from the client
 * 
 * @param bucket - The storage bucket
 * @param key - The storage key
 * @param contentType - The content type of the file
 * @param expiresIn - URL expiration time in seconds (default: 15 minutes)
 * @returns Signed URL for upload
 */
export async function getUploadSignedUrl(
  bucket: StorageBucket,
  key: string,
  contentType: string,
  expiresIn: number = 900
): Promise<string> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  return awsGetSignedUrl(client, command, { expiresIn });
}

/**
 * Delete a file from storage
 * 
 * @param bucket - The storage bucket
 * @param key - The storage key to delete
 */
export async function deleteFile(
  bucket: StorageBucket,
  key: string
): Promise<void> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await client.send(command);
}

/**
 * Check if a file exists in storage
 * 
 * @param bucket - The storage bucket
 * @param key - The storage key
 * @returns True if the file exists
 */
export async function fileExists(
  bucket: StorageBucket,
  key: string
): Promise<boolean> {
  const client = getS3Client();
  const bucketName = getBucketName(bucket);

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Get the public URL for an asset
 * Uses CDN URL if available, otherwise direct S3 URL
 * 
 * @param key - The storage key
 * @returns Public URL for the asset
 */
export function getPublicUrl(key: string): string {
  const config = getEnvConfig();
  const isLocal = getCurrentEnvironment() === 'local';

  if (config.cdnUrl) {
    return `${config.cdnUrl}/${key}`;
  }

  if (isLocal) {
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    return `${endpoint}/${config.s3Bucket}/${key}`;
  }

  // Direct S3 URL
  const region = process.env.AWS_S3_REGION || 'us-east-1';
  return `https://${config.s3Bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Parse a public URL to extract the storage key
 * 
 * @param url - The public URL
 * @returns The storage key, or null if not a valid storage URL
 */
export function parseStorageUrl(url: string): string | null {
  const config = getEnvConfig();
  
  // Check CDN URL
  if (config.cdnUrl && url.startsWith(config.cdnUrl)) {
    return url.slice(config.cdnUrl.length + 1);
  }
  
  // Check S3 URL patterns
  const s3Patterns = [
    new RegExp(`https://${config.s3Bucket}\\.s3\\.[^/]+\\.amazonaws\\.com/(.+)`),
    new RegExp(`https://s3\\.[^/]+\\.amazonaws\\.com/${config.s3Bucket}/(.+)`),
  ];
  
  for (const pattern of s3Patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // Check local MinIO URL
  if (url.includes('localhost:9000') || url.includes('minio')) {
    const match = url.match(/\/[^/]+\/(.+)$/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Migrate a file from local public/uploads to S3
 * This is a helper for the migration process
 * 
 * @param localPath - Path relative to public/ (e.g., 'uploads/orgId/logo.png')
 * @param bucket - Target storage bucket
 * @param key - Target storage key
 * @returns The new public URL
 */
export async function migrateFromLocal(
  localPath: string,
  bucket: StorageBucket,
  key: string
): Promise<string> {
  // This would be called during migration
  // In production, files would be read from the filesystem and uploaded
  // For now, this serves as a placeholder for the migration script
  throw new Error('Migration should be run via a dedicated script, not in application code');
}
