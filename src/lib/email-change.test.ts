import { describe, expect, it } from "vitest";
import { emailChangeProblem, normalizeEmail } from "./email-change";

describe("emailChangeProblem", () => {
  it("accepts a different, valid address", () => {
    expect(emailChangeProblem("old@gmail.com", "new.address@icloud.com")).toBeNull();
  });

  it("ignores case and spaces when comparing with the current address", () => {
    expect(emailChangeProblem("Justin@Gmail.com", "  justin@gmail.com ")).toBe("That's already your sign-in email");
  });

  it("rejects blanks and malformed addresses", () => {
    expect(emailChangeProblem("old@gmail.com", "   ")).toBe("Enter the new email address");
    expect(emailChangeProblem("old@gmail.com", "not an email")).toMatch(/doesn't look like/);
    expect(emailChangeProblem("old@gmail.com", "sam@gmail")).toMatch(/doesn't look like/);
  });

  it("accepts addresses containing the letter s (the portal regex bug)", () => {
    expect(emailChangeProblem("old@gmail.com", "sales.susan@gmail.com")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("trims and lower-cases", () => {
    expect(normalizeEmail("  Sam@Example.COM ")).toBe("sam@example.com");
  });
});
