import { describe, it, expect } from "vitest";
import { z } from "zod";

// Re-define schemas to test their logic
const createDocSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
});

const memberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["OWNER", "EDITOR", "VIEWER"]),
});

describe("Zod Validation Schemas", () => {
  it("should validate document titles correctly", () => {
    // Valid title
    expect(createDocSchema.safeParse({ title: "My Project Proposal" }).success).toBe(true);

    // Empty title
    const emptyResult = createDocSchema.safeParse({ title: "" });
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      expect(emptyResult.error.issues[0].message).toBe("Title is required");
    }

    // Too long title
    const longTitle = "a".repeat(101);
    const longResult = createDocSchema.safeParse({ title: longTitle });
    expect(longResult.success).toBe(false);
    if (!longResult.success) {
      expect(longResult.error.issues[0].message).toBe("Title too long");
    }
  });

  it("should validate member emails and roles correctly", () => {
    // Valid member
    expect(
      memberSchema.safeParse({ email: "editor@example.com", role: "EDITOR" }).success
    ).toBe(true);

    // Invalid email
    const emailResult = memberSchema.safeParse({ email: "invalid-email", role: "EDITOR" });
    expect(emailResult.success).toBe(false);
    if (!emailResult.success) {
      expect(emailResult.error.issues[0].message).toBe("Invalid email address");
    }

    // Invalid role
    const roleResult = memberSchema.safeParse({ email: "viewer@example.com", role: "ADMIN" });
    expect(roleResult.success).toBe(false);
  });
});
