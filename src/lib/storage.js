/**
 * Storage Adapter — Cloudinary + Local Fallback
 *
 * Swap storage backends by changing env vars only.
 * Future: Add STORAGE_ADAPTER=s3 for AWS S3 support.
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Upload a file buffer to the active storage backend.
 * @returns { url, publicId, width, height, format, bytes }
 */
export async function uploadToStorage(buffer, originalName, folder = 'pairo-media') {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    return await uploadToCloudinary(buffer, originalName, folder);
  }
  return await uploadToLocal(buffer, originalName);
}

/**
 * Delete a file from the active storage backend.
 */
export async function deleteFromStorage(publicId) {
  if (process.env.CLOUDINARY_CLOUD_NAME && publicId) {
    return await deleteFromCloudinary(publicId);
  }
  return await deleteFromLocal(publicId);
}

/**
 * Get optimized URL for display (Cloudinary transforms, or original for local)
 */
export function getOptimizedUrl(url, options = {}) {
  if (!url || !process.env.CLOUDINARY_CLOUD_NAME) return url;
  const { width = 800, quality = 'auto', format = 'auto' } = options;
  // Insert transformation into Cloudinary URL
  return url.replace('/upload/', `/upload/w_${width},q_${quality},f_${format}/`);
}

export function getThumbnailUrl(url) {
  if (!url || !process.env.CLOUDINARY_CLOUD_NAME) return url;
  return url.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_auto/');
}

// ── Cloudinary Implementation ─────────────────────────────────
async function uploadToCloudinary(buffer, originalName, folder) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        use_filename: false,
        unique_filename: true,
        overwrite: false,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );
    uploadStream.end(buffer);
  });
}

async function deleteFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
    return { success: true };
  } catch (err) {
    console.error('[Cloudinary Delete Error]', err);
    return { success: false, error: err.message };
  }
}

// ── Local Filesystem Fallback ─────────────────────────────────
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

async function uploadToLocal(buffer, originalName) {
  const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), 'public/uploads');
  await mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${originalName.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '')}`;
  const filePath = path.join(uploadDir, safeName);
  await writeFile(filePath, buffer);
  return {
    url: `/uploads/${safeName}`,
    publicId: safeName,
    width: null,
    height: null,
    format: path.extname(safeName).replace('.', ''),
    bytes: buffer.length,
  };
}

async function deleteFromLocal(publicId) {
  try {
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), 'public/uploads');
    const filePath = path.join(uploadDir, publicId);
    await unlink(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
