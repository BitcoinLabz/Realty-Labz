import { describe, expect, it } from "vitest";
import { portalSignInSchema } from "./validation";

// Regression: the portal sign-in form rejected every email containing the
// letter "s" because its regex had `[^s@]` where it meant `[^\s@]`.
describe("portal sign-in email", () => {
  it.each([
    "justin@gmail.com",
    "sarah.smith@example.com",
    "buyers+house@realtylabz.com",
    "s@s.us",
  ])("accepts %s", (email) => {
    expect(portalSignInSchema.safeParse({ email }).success).toBe(true);
  });

  it("trims and lowercases before matching clients", () => {
    const parsed = portalSignInSchema.parse({ email: "  Sarah.Smith@Example.COM " });
    expect(parsed.email).toBe("sarah.smith@example.com");
  });

  it.each(["", "not-an-email", "a@b", "two words@example.com", "a@@example.com"])(
    "rejects %j",
    (email) => {
      expect(portalSignInSchema.safeParse({ email }).success).toBe(false);
    },
  );
});
