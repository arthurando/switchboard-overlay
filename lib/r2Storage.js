/**
 * Cloudflare R2 Storage Handler
 * S3-compatible object storage for temporary image hosting
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize R2 client
let r2Client = null;

function getR2Client() {
  if (!r2Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.');
    }

    r2Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return r2Client;
}

/**
 * Upload image to R2 and return public URL
 *
 * @param {Buffer} imageBuffer - Image data
 * @param {string} contentType - MIME type (e.g., 'image/png')
 * @returns {Promise<{url: string, key: string}>} - Public URL and object key
 */
export async function uploadToR2(imageBuffer, contentType = 'image/png') {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || 'switchboard-images';
  const publicDomain = process.env.R2_PUBLIC_DOMAIN; // e.g., 'images.yourdomain.com'

  // Generate unique filename with timestamp
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const key = `product-covers/${timestamp}-${random}.png`;

  try {
    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await client.send(command);

    // Construct public URL
    let url;
    if (publicDomain) {
      // Custom domain (recommended)
      url = `https://${publicDomain}/${key}`;
    } else {
      // R2.dev subdomain (only if bucket is public)
      const r2DevDomain = process.env.R2_DEV_SUBDOMAIN;
      if (r2DevDomain) {
        url = `https://${r2DevDomain}.r2.dev/${key}`;
      } else {
        throw new Error('R2_PUBLIC_DOMAIN or R2_DEV_SUBDOMAIN must be configured');
      }
    }

    console.log(`[R2] ✅ Uploaded: ${key} → ${url}`);

    return { url, key };

  } catch (error) {
    console.error('[R2] ❌ Upload failed:', error);
    throw new Error(`R2 upload failed: ${error.message}`);
  }
}

/**
 * Delete image from R2 (cleanup after successful use)
 *
 * @param {string} key - Object key to delete
 * @returns {Promise<void>}
 */
export async function deleteFromR2(key) {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || 'switchboard-images';

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await client.send(command);
    console.log(`[R2] 🗑️  Deleted: ${key}`);

  } catch (error) {
    // Don't throw - deletion failure shouldn't break the flow
    console.error('[R2] ⚠️  Delete failed:', error.message);
  }
}

/**
 * Cleanup old images (run periodically)
 * Deletes images older than specified hours
 *
 * @param {number} maxAgeHours - Delete images older than this (default: 24 hours)
 * @returns {Promise<number>} - Number of deleted images
 */
export async function cleanupOldImages(maxAgeHours = 24) {
  const client = getR2Client();
  const bucketName = process.env.R2_BUCKET_NAME || 'switchboard-images';

  try {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'product-covers/',
    });

    const response = await client.send(listCommand);
    const objects = response.Contents || [];

    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let deletedCount = 0;

    for (const obj of objects) {
      if (obj.LastModified.getTime() < cutoffTime) {
        await deleteFromR2(obj.Key);
        deletedCount++;
      }
    }

    console.log(`[R2] 🧹 Cleanup complete: ${deletedCount} images deleted`);
    return deletedCount;

  } catch (error) {
    console.error('[R2] ❌ Cleanup failed:', error);
    throw error;
  }
}
