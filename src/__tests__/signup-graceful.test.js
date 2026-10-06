import { describe, it, expect, vi } from "vitest";
import { POST } from "../app/api/auth/signup/route";

// Mock dbConnect to not connect to actual MongoDB
vi.mock("@/lib/db", () => {
  return {
    default: vi.fn().mockResolvedValue(true),
  };
});

// Mock the email library to throw an error (simulating SMTP failure)
vi.mock("@/lib/email", () => {
  return {
    sendEmailVerification: vi.fn().mockRejectedValue(new Error("SMTP connection timeout")),
  };
});

// Mock Customer model with fresh object creation to avoid shared mutation bugs
vi.mock("@/models/Customer", () => {
  const mockSave = vi.fn().mockResolvedValue(true);

  return {
    default: {
      findOne: vi.fn().mockImplementation(async ({ email }) => {
        if (email === "existing-unverified@test.com") {
          return {
            _id: "mocked_customer_id_123",
            name: "Graceful Test User",
            email: "existing-unverified@test.com",
            emailVerified: false,
            save: mockSave,
          };
        }
        return null;
      }),
      create: vi.fn().mockImplementation(async (data) => {
        return {
          _id: "mocked_customer_id_123",
          name: data.name,
          email: data.email,
          emailVerified: false,
          save: mockSave,
        };
      }),
    },
  };
});

describe("Signup SMTP Failure Handling (Mocked DB)", () => {
  it("should succeed registration gracefully when sendEmailVerification fails during creation", async () => {
    const req = {
      json: async () => ({
        name: "Graceful Test User",
        email: "graceful-test@test.com",
        password: "StrongPassword123!",
      }),
    };

    const response = await POST(req);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.pendingVerification).toBe(true);
    expect(body.warning).toBe("email_delayed");
  });

  it("should succeed resending gracefully when resending verification email encounters SMTP error", async () => {
    const req = {
      json: async () => ({
        name: "Graceful Test User",
        email: "existing-unverified@test.com",
        password: "StrongPassword123!",
      }),
    };

    const response = await POST(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.resent).toBe(true);
    expect(body.pendingVerification).toBe(true);
  });
});
