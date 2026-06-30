import { NextResponse } from "next/server";

// In-memory request store for rate limiting (fallback for serverless instances)
const ipCache = new Map();

/**
 * Basic in-memory rate limiter helper for server endpoints.
 * @param {Request} req - The incoming request
 * @param {number} limit - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {NextResponse|null} Returns 429 response if rate limit exceeded, else null
 */
export function rateLimit(req, limit = 5, windowMs = 15 * 60 * 1000) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();

  const requests = ipCache.get(ip) || [];
  
  // Filter out expired timestamps
  const activeRequests = requests.filter(timestamp => now - timestamp < windowMs);
  
  if (activeRequests.length >= limit) {
    console.warn(`[RateLimiter] Rate limit exceeded for IP: ${ip}. Count: ${activeRequests.length}/${limit}`);
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again later." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil(windowMs / 1000).toString()
        }
      }
    );
  }

  // Record current request
  activeRequests.push(now);
  ipCache.set(ip, activeRequests);
  return null;
}
