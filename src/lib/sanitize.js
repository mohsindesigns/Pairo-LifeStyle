/**
 * Enterprise Anti-XSS, Input Sanitization & NoSQL Injection Protection
 * 
 * Provides strict input sanitation to prevent:
 * 1. Stored & Reflected Cross-Site Scripting (XSS)
 * 2. JavaScript execution via inline event handlers (onload, onerror, onclick, etc.)
 * 3. JavaScript pseudo-protocols (javascript:, vbscript:, data:text/html)
 * 4. NoSQL / MongoDB Operator Injections ($gt, $ne, $where, $regex, dot notation keys)
 * 5. HTML Injection in emails and rendered HTML
 */

/**
 * HTML entities map for escaping
 */
const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;'
};

/**
 * Escapes characters to prevent HTML/XSS injection in HTML templates or emails.
 * @param {string} str 
 * @returns {string}
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return str == null ? '' : String(str);
  return str.replace(/[&<>"'`\/]/g, (char) => HTML_ESCAPES[char]);
}

/**
 * Strips all HTML tags, script blocks, event handlers, and javascript: protocols.
 * Intended for plain-text user inputs (names, emails, phone numbers, notes, reviews, questions, etc.).
 * @param {string} input 
 * @returns {string}
 */
export function sanitizeText(input) {
  if (typeof input !== 'string') {
    return input == null ? '' : String(input);
  }

  let sanitized = input;

  // 1. Remove any <script ...>...</script> blocks entirely including multiline
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Remove <style ...>...</style> blocks
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // 3. Strip all remaining HTML tags
  sanitized = sanitized.replace(/<\/?[^>]+(>|$)/g, '');

  // 4. Remove dangerous javascript: / data: / vbscript: pseudo-protocols
  sanitized = sanitized.replace(/(javascript|vbscript|data):/gi, '');

  // 5. Remove inline event handler attributes like onerror=, onclick=, onload=, onmouseover=
  sanitized = sanitized.replace(/\bon[a-zA-Z]+\s*=/gi, '');

  // 6. Normalize whitespace
  return sanitized.trim();
}

/**
 * Checks whether a given string contains suspicious JavaScript / XSS payloads.
 * @param {string} str 
 * @returns {boolean}
 */
export function containsMaliciousPayload(str) {
  if (typeof str !== 'string') return false;

  const patterns = [
    /<script\b/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /\bon[a-z]+\s*=/i,
    /<iframe\b/i,
    /<embed\b/i,
    /<object\b/i,
    /<svg\b[^>]*\bon/i,
    /<img\b[^>]*\bonerror/i,
    /eval\s*\(/i,
    /expression\s*\(/i
  ];

  return patterns.some(pattern => pattern.test(str));
}

/**
 * Sanitizes rich HTML for trusted admin inputs (e.g. blog post bodies, rich page sections).
 * Strips script tags, iframes, objects, embeds, and malicious event handlers while preserving safe tags.
 * @param {string} html 
 * @returns {string}
 */
export function sanitizeRichHtml(html) {
  if (typeof html !== 'string') return '';

  let clean = html;

  // Strip script, iframe, object, embed, form, applet tags completely with their contents
  clean = clean.replace(/<(script|iframe|object|embed|applet|meta|link)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  clean = clean.replace(/<(script|iframe|object|embed|applet|meta|link)\b[^>]*\/?>/gi, '');

  // Strip javascript: and vbscript: URIs in href/src
  clean = clean.replace(/(href|src)\s*=\s*["']?\s*(?:javascript|vbscript|data:text\/html):[^"'>\s]*/gi, '$1="#"');

  // Strip all inline event handlers (onerror, onload, onclick, onmouseover, etc.)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  return clean;
}

/**
 * Recursively sanitizes an entire object or array:
 * 1. Sanitizes all string values (stripping HTML & JS)
 * 2. Neutralizes MongoDB / NoSQL injection operators (keys starting with '$' or containing '.')
 * @param {*} data 
 * @param {Object} options - Optional config { allowRichHtmlKeys: string[] }
 * @returns {*}
 */
export function sanitizeObject(data, options = {}) {
  const allowRichHtmlKeys = new Set(options.allowRichHtmlKeys || []);

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeText(data);
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeObject(item, options));
  }

  if (typeof data === 'object') {
    // Preserve special objects like Date, Buffer, ObjectId
    if (data instanceof Date || (typeof data.toHexString === 'function')) {
      return data;
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      // Prevent NoSQL Injection: reject or rename keys starting with '$' or containing '.'
      if (key.startsWith('$') || key.includes('.')) {
        console.warn(`[Security Alert] Blocked NoSQL Injection attempt with key: "${key}"`);
        continue; // Skip dangerous MongoDB operators like $gt, $ne, $where
      }

      if (typeof value === 'string') {
        if (allowRichHtmlKeys.has(key)) {
          cleaned[key] = sanitizeRichHtml(value);
        } else {
          cleaned[key] = sanitizeText(value);
        }
      } else {
        cleaned[key] = sanitizeObject(value, options);
      }
    }
    return cleaned;
  }

  return data;
}

export default {
  escapeHtml,
  sanitizeText,
  containsMaliciousPayload,
  sanitizeRichHtml,
  sanitizeObject,
};
