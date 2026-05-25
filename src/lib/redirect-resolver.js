import { redirect, permanentRedirect } from "next/navigation";
import dbConnect from "@/lib/db";
import Redirect from "@/models/Redirect";

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "product",
  "blog",
  "shop",
  "checkout",
  "cart",
  "login",
  "signup",
  "profile",
  "order-tracking",
  "search",
  "sitemap.xml",
  "robots.txt"
];

/**
 * Normalizes a path for consistent lookup:
 * - lowercase
 * - trim whitespaces
 * - ensures starting slash
 * - strips trailing slash (except for absolute URLs and '/')
 * - cleans duplicate slashes (e.g. //product//slug -> /product/slug)
 * - decodes URI components to handle encoding consistently
 */
export function normalizePath(path) {
  if (!path) return "";
  let clean = path.trim();
  
  // Return absolute URLs as-is (except basic formatting)
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    return clean;
  }
  
  try {
    clean = decodeURIComponent(clean);
  } catch (e) {
    // Fallback if malformed URI encoding
  }

  clean = clean.toLowerCase();
  
  // Clean duplicate slashes
  clean = clean.replace(/\/+/g, "/");

  if (!clean.startsWith("/")) {
    clean = "/" + clean;
  }
  if (clean.endsWith("/") && clean.length > 1) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

/**
 * Checks if a given path's first segment is a reserved system route.
 * - Always reserves /admin, /api, /checkout, /cart, /shop, /login, /signup, etc. (including subpaths)
 * - Reserves exact matching top-level system paths (e.g. /product, /blog) but allows deeper subpaths (e.g. /product/slug, /blog/slug)
 */
export function isReservedPath(path) {
  const clean = normalizePath(path);
  const pathWithoutQuery = clean.split("?")[0];
  const segments = pathWithoutQuery.split("/").filter(Boolean);
  
  if (segments.length === 0) return false;

  const firstSegment = segments[0];

  // Base list of system prefixes that are always reserved (including subpaths)
  const systemPrefixes = [
    "admin",
    "api",
    "shop",
    "checkout",
    "cart",
    "login",
    "signup",
    "profile",
    "order-tracking",
    "search",
    "sitemap.xml",
    "robots.txt"
  ];

  if (systemPrefixes.includes(firstSegment)) {
    return true;
  }

  // "product" and "blog" are only reserved if they are the exact top-level slug (1 segment)
  if (segments.length === 1) {
    return RESERVED_SLUGS.includes(firstSegment);
  }

  return false;
}

/**
 * Checks for a redirect record starting at a given path.
 * Resolves redirect chains recursively (up to 5 hops) to find the final destination.
 * Detects and breaks redirect loops.
 * 
 * @param {string} rawPath The requested path (e.g. /product/old-slug)
 * @returns {Promise<{ newPath: string, statusCode: number }|null>} Redirect target info or null
 */
export async function resolveRedirect(rawPath) {
  await dbConnect();
  
  // Split query string from the raw path
  const [pathWithoutQuery, queryString] = rawPath.split("?");
  const startPath = normalizePath(pathWithoutQuery);
  
  let currentPath = startPath;
  let finalStatus = 301;
  const visited = new Set();
  
  const MAX_HOPS = 5;
  let hops = 0;
  
  while (hops < MAX_HOPS) {
    visited.add(currentPath);
    const match = await Redirect.findOne({ oldPath: currentPath }).lean();
    
    if (!match) {
      break;
    }
    
    // Normalize target path without query params for redirect resolution
    const [targetPathOnly] = match.newPath.split("?");
    const target = normalizePath(targetPathOnly);
    finalStatus = match.statusCode || 301;
    
    // Detect redirect loop (target goes back to something we already visited)
    if (visited.has(target)) {
      console.warn(`[Redirect Resolver] Loop detected: ${startPath} -> ... -> ${currentPath} -> ${target}. Breaking redirect.`);
      return null;
    }
    
    currentPath = target;
    hops++;
  }
  
  // If we found a redirect target and it's different from the original path
  if (currentPath !== startPath) {
    let finalPath = currentPath;
    
    // Merge original query parameters with any query parameters defined on the redirect destination
    const matchRecord = await Redirect.findOne({ oldPath: startPath }).lean();
    let destQueryParams = "";
    if (matchRecord && matchRecord.newPath.includes("?")) {
      destQueryParams = matchRecord.newPath.split("?")[1];
    }
    
    const mergedParams = new URLSearchParams();
    if (destQueryParams) {
      const dp = new URLSearchParams(destQueryParams);
      dp.forEach((val, key) => mergedParams.set(key, val));
    }
    if (queryString) {
      const qp = new URLSearchParams(queryString);
      qp.forEach((val, key) => mergedParams.set(key, val));
    }
    
    const finalQuery = mergedParams.toString();
    if (finalQuery) {
      finalPath += `?${finalQuery}`;
    }
    
    return {
      newPath: finalPath,
      statusCode: finalStatus
    };
  }
  
  return null;
}

/**
 * Atomic registration of redirects to prevent loops and chains.
 * Blocks redirects from reserved routes.
 * 
 * @param {string} rawOldPath Source path
 * @param {string} rawNewPath Destination path
 * @param {number} statusCode HTTP redirect status code (301 or 302)
 */
export async function registerRedirect(rawOldPath, rawNewPath, statusCode = 301) {
  await dbConnect();
  
  // Strip query string from old path to ensure exact path matching
  const [oldPathWithoutQuery] = rawOldPath.split("?");
  const oldPath = normalizePath(oldPathWithoutQuery);
  
  // For newPath, normalize the path part but keep the query parameters if they exist
  const [newPathWithoutQuery, newPathQuery] = rawNewPath.split("?");
  let newPath = normalizePath(newPathWithoutQuery);
  if (newPathQuery) {
    newPath += `?${newPathQuery}`;
  }
  
  if (!oldPath || !newPath || oldPath === newPath) {
    return null;
  }
  
  if (isReservedPath(oldPath)) {
    console.warn(`[Redirect Resolver] Blocked redirect from reserved path: ${oldPath}`);
    return null;
  }
  
  // Resolve where the destination currently points to avoid chain
  const resolvedTarget = await resolveRedirect(newPath);
  const finalDestination = resolvedTarget ? resolvedTarget.newPath : newPath;
  
  // Prevent circular loop: if destination points back to oldPath
  const [destPathOnly] = finalDestination.split("?");
  if (normalizePath(destPathOnly) === oldPath) {
    console.warn(`[Redirect Resolver] Circular redirect loop prevented: ${oldPath} -> ${newPath} -> ${oldPath}`);
    return null;
  }
  
  // Upsert the redirect mapping
  const redirectRecord = await Redirect.findOneAndUpdate(
    { oldPath },
    { newPath: finalDestination, statusCode },
    { upsert: true, new: true }
  );
  
  // Flatten existing redirect chains: update any record pointing to `oldPath` to point to `finalDestination`
  await Redirect.updateMany(
    { newPath: oldPath },
    { newPath: finalDestination }
  );
  
  return redirectRecord;
}

/**
 * Checks for a redirect and triggers Next.js redirect if found.
 * Call this function on 404 pages or route handlers where a document is missing.
 * 
 * @param {string} pathname The current path.
 */
export async function checkAndApplyRedirect(pathname) {
  try {
    const redirectInfo = await resolveRedirect(pathname);
    if (redirectInfo) {
      if (redirectInfo.statusCode === 301) {
        permanentRedirect(redirectInfo.newPath);
      } else {
        redirect(redirectInfo.newPath);
      }
    }
  } catch (error) {
    // If it's a Next.js redirect exception, re-throw it so Next.js handles it!
    if (error.digest && (error.digest.startsWith("NEXT_REDIRECT") || error.message === "NEXT_REDIRECT")) {
      throw error;
    }
    console.error("[Redirect Resolver] Error running redirect check:", error);
  }
}
