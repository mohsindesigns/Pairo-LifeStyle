import { describe, it, expect } from "vitest";
import {
  sanitizeText,
  sanitizeObject,
  sanitizeRichHtml,
  escapeHtml
} from "@/lib/sanitize";

describe("Enterprise Security - Anti-XSS & Anti-Injection Sanitization", () => {
  describe("sanitizeText (Plain text input fields)", () => {
    it("should strip <script> tags and embedded executable javascript", () => {
      const input = "Hello <script>alert('pwned')</script> World";
      const result = sanitizeText(input);
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("alert");
      expect(result).toBe("Hello  World");
    });

    it("should remove javascript: pseudo-protocols", () => {
      const input = "javascript:alert(1)";
      const result = sanitizeText(input);
      expect(result.toLowerCase()).not.toContain("javascript:");
    });

    it("should remove DOM event handlers like onerror and onload", () => {
      const input = '<img src="x" onerror="alert(document.cookie)">';
      const result = sanitizeText(input);
      expect(result).not.toContain("onerror");
      expect(result).not.toContain("alert");
    });

    it("should strip out all HTML tags from plain text inputs", () => {
      const input = "<b>Bold</b> and <i>Italic</i> <iframe src='http://evil.com'></iframe>";
      const result = sanitizeText(input);
      expect(result).toBe("Bold and Italic");
    });

    it("should handle null and undefined safely", () => {
      expect(sanitizeText(null)).toBe("");
      expect(sanitizeText(undefined)).toBe("");
      expect(sanitizeText(12345)).toBe("12345");
    });
  });

  describe("sanitizeObject (NoSQL injection & recursive payload scrubber)", () => {
    it("should strip MongoDB operator keys starting with $", () => {
      const payload = {
        username: "admin",
        password: { $gt: "" },
        nested: {
          $where: "sleep(5000)",
          cleanKey: "cleanValue"
        }
      };

      const sanitized = sanitizeObject(payload);
      expect(sanitized.password.$gt).toBeUndefined();
      expect(sanitized.nested.$where).toBeUndefined();
      expect(sanitized.nested.cleanKey).toBe("cleanValue");
    });

    it("should remove keys with dots (.) that could cause Mongo path injection", () => {
      const payload = {
        "admin.role": "superadmin",
        validKey: "valid"
      };

      const sanitized = sanitizeObject(payload);
      expect(sanitized["admin.role"]).toBeUndefined();
      expect(sanitized.validKey).toBe("valid");
    });

    it("should recursively clean XSS in string fields within objects and arrays", () => {
      const payload = {
        comments: [
          "<script>bad()</script>Nice jacket!",
          { title: "<img src=x onerror=alert(1)>Great leather", score: 5 }
        ]
      };

      const sanitized = sanitizeObject(payload);
      expect(sanitized.comments[0]).toBe("Nice jacket!");
      expect(sanitized.comments[1].title).not.toContain("onerror");
      expect(sanitized.comments[1].score).toBe(5);
    });
  });

  describe("sanitizeRichHtml (Admin Rich Text / Content Safety)", () => {
    it("should allow safe markup while removing dangerous elements like script and iframe", () => {
      const html = '<p>This is <strong>great</strong> content.</p><script>alert(1)</script><iframe src="evil.com"></iframe>';
      const result = sanitizeRichHtml(html);
      expect(result).toContain("<p>This is <strong>great</strong> content.</p>");
      expect(result).not.toContain("<script>");
      expect(result).not.toContain("<iframe");
    });

    it("should strip inline script events from allowed tags", () => {
      const html = '<a href="https://example.com" onclick="alert(1)">Link</a>';
      const result = sanitizeRichHtml(html);
      expect(result).not.toContain("onclick");
      expect(result).toContain('href="https://example.com"');
    });
  });

  describe("escapeHtml (SSR & Email Template Interpolation)", () => {
    it("should escape special characters to prevent HTML rendering", () => {
      const text = '<div class="test">& "Hello" \'World\'</div>';
      const escaped = escapeHtml(text);
      expect(escaped).toBe("&lt;div class=&quot;test&quot;&gt;&amp; &quot;Hello&quot; &#x27;World&#x27;&lt;&#x2F;div&gt;");
    });
  });
});
