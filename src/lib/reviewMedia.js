// Photos and videos customers attach to a product review. Everything a customer uploads is checked by what the file
// really is (its first bytes), never by the name or type the browser claims, and a review only goes live after an admin
// approves it.

export const MAX_REVIEW_VIDEO_BYTES = 20 * 1024 * 1024; // the web server accepts 25 MB per request
export const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_REVIEW_MEDIA = 3;

const ascii = (buf, from, to) => buf.subarray(from, to).toString('latin1');

/** Looks at the first bytes of a file. Returns { type: 'video' | 'image', ext, mime } or null if it is not an allowed kind. */
export function sniffReviewMedia(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (ascii(buffer, 4, 8) === 'ftyp') {
    const brand = ascii(buffer, 8, 12);
    return brand === 'qt  ' ? { type: 'video', ext: 'mov', mime: 'video/quicktime' } : { type: 'video', ext: 'mp4', mime: 'video/mp4' };
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return { type: 'video', ext: 'webm', mime: 'video/webm' };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { type: 'image', ext: 'jpg', mime: 'image/jpeg' };
  if (buffer[0] === 0x89 && ascii(buffer, 1, 4) === 'PNG') return { type: 'image', ext: 'png', mime: 'image/png' };
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') return { type: 'image', ext: 'webp', mime: 'image/webp' };
  return null;
}

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;

/** A file this site stored itself (the upload folder). Anything else, such as a link to another site, is refused. */
export function isOwnUploadUrl(url) {
  return typeof url === 'string' && /^\/uploads\/[A-Za-z0-9._-]{1,200}$/.test(url) && !url.includes('..');
}

/** Cleans the media list sent with a review: only our own uploads, at most MAX_REVIEW_MEDIA, type taken from the file name. */
export function cleanReviewMedia(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input) {
    const url = item && typeof item === 'object' ? item.url : null;
    if (!isOwnUploadUrl(url) || out.some((m) => m.url === url)) continue;
    out.push({ url, type: VIDEO_EXT.test(url) ? 'video' : 'image' });
    if (out.length >= MAX_REVIEW_MEDIA) break;
  }
  return out;
}
