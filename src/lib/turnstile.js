/**
 * Cloudflare Turnstile Server-side Token Verification Helper
 * 
 * Verifies Turnstile tokens against Cloudflare's official verification API:
 * https://challenges.cloudflare.com/turnstile/v0/siteverify
 */

const CLOUDFLARE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Official Cloudflare Dummy Keys for Testing
// Always passes: 1x0000000000000000000000000000000AA
const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

/**
 * Verifies a Cloudflare Turnstile CAPTCHA token.
 * 
 * @param {string} token - The cf-turnstile-response token submitted by the client
 * @param {string} [remoteIp] - The client IP address
 * @returns {Promise<{ success: boolean, error?: string, errorCodes?: string[] }>}
 */
export async function verifyTurnstileToken(token, remoteIp = null) {
  // If no token is supplied
  if (!token || typeof token !== "string" || token.trim() === "") {
    // In test environment, bypass if not strictly testing turnstile
    if (process.env.NODE_ENV === "test" && process.env.STRICT_CAPTCHA_TEST !== "true") {
      return { success: true, bypassed: true };
    }
    return {
      success: false,
      error: "Captcha verification is required. Please complete the security check."
    };
  }

  const secretKey = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || TEST_SECRET_KEY;

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token.trim());
    if (remoteIp && remoteIp !== "unknown" && remoteIp !== "127.0.0.1") {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(CLOUDFLARE_SITEVERIFY_URL, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        hostname: data.hostname,
        challengeTs: data.challenge_ts
      };
    }

    console.warn("[Turnstile] Verification failed:", data["error-codes"]);
    return {
      success: false,
      error: "Security verification failed. Please check the captcha and try again.",
      errorCodes: data["error-codes"] || []
    };
  } catch (err) {
    console.error("[Turnstile] Siteverify API network error:", err.message);
    // If running in development and Cloudflare servers are unreachable, allow test bypass
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Turnstile Dev Fallback] Allowing request in development mode due to connection error.");
      return { success: true, warning: "Turnstile connection failed in dev mode." };
    }
    return {
      success: false,
      error: "Unable to verify security challenge. Please try again later."
    };
  }
}

export default {
  verifyTurnstileToken
};
