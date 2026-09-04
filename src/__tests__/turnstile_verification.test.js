import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTurnstileToken } from "@/lib/turnstile";

describe("Cloudflare Turnstile Verification", () => {
  const originalEnv = process.env;
  const TEST_SECRET_KEY = "0x4AAAAAAEJg7b1or2dWbrKr";
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("should bypass in test environment when token is missing (dev friendly)", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.STRICT_CAPTCHA_TEST;

    const result = await verifyTurnstileToken(null);
    expect(result.success).toBe(true);
    expect(result.bypassed).toBe(true);
  });

  it("should fail when strict mode is active and token is missing", async () => {
    process.env.STRICT_CAPTCHA_TEST = "true";

    const result = await verifyTurnstileToken("");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Captcha verification is required");
  });

  it("should successfully verify official test token against Cloudflare", async () => {
    process.env.STRICT_CAPTCHA_TEST = "true";
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY || TEST_SECRET_KEY;
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        "challenge_ts": new Date().toISOString(),
        hostname: "localhost"
      })
    });

    const result = await verifyTurnstileToken("dummy-pass-token", "127.0.0.1");
    expect(result.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      })
    );
  });

  it("should return error message when verification fails", async () => {
    process.env.STRICT_CAPTCHA_TEST = "true";

    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        success: false,
        "error-codes": ["invalid-input-response"]
      })
    });

    const result = await verifyTurnstileToken("invalid-token", "127.0.0.1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("Security verification failed");
    expect(result.errorCodes).toContain("invalid-input-response");
  });
});
