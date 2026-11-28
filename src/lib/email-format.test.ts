import { describe, expect, it } from "vitest";
import { isPlausibleEmail } from "./email-format";

describe("isPlausibleEmail", () => {
  it("accepts ordinary addresses, including ones with the letter s", () => {
    expect(isPlausibleEmail("sam.smith@gmail.com")).toBe(true);
    expect(isPlausibleEmail("buyers@realtylabz.com")).toBe(true);
    expect(isPlausibleEmail("jo@x.co")).toBe(true);
  });

  it("rejects blanks, spaces and missing parts", () => {
    expect(isPlausibleEmail("")).toBe(false);
    expect(isPlausibleEmail("sam smith@gmail.com")).toBe(false);
    expect(isPlausibleEmail("sam@gmail")).toBe(false);
    expect(isPlausibleEmail("@gmail.com")).toBe(false);
    expect(isPlausibleEmail("sam@gmailcom")).toBe(false);
  });
});
