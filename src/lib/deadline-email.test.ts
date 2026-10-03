import { describe, expect, it } from "vitest";
import { deadlineEmailHref } from "./deadline-email";

const base = {
  to: { name: "ABC Title", contactName: "Dana Smith", email: "closings@abctitle.com" },
  propertyLabel: "8127 Gary Ave",
  deadlineLabel: "Closing",
  dueDate: "2026-10-30",
  agentName: "Justin Berry",
};

describe("deadlineEmailHref", () => {
  it("addresses the vendor and fills in the subject and body", () => {
    const href = deadlineEmailHref(base);
    expect(href.startsWith("mailto:closings%40abctitle.com?subject=")).toBe(true);
    const body = decodeURIComponent(href.split("&body=")[1]);
    expect(body).toContain("Hi Dana,");
    expect(body).toContain("Closing is due Friday, October 30.");
    expect(body.endsWith("Justin Berry")).toBe(true);
  });

  it("greets the company when there's no contact name", () => {
    const body = decodeURIComponent(deadlineEmailHref({ ...base, to: { ...base.to, contactName: null } }).split("&body=")[1]);
    expect(body).toContain("Hi ABC Title,");
  });

  it("doesn't shift the date a day in any time zone", () => {
    const subject = decodeURIComponent(deadlineEmailHref(base).split("?subject=")[1].split("&body=")[0]);
    expect(subject).toBe("8127 Gary Ave — Closing (Friday, October 30)");
  });

  it("encodes characters that would break the link", () => {
    const href = deadlineEmailHref({ ...base, propertyLabel: "12 Oak & Elm #3" });
    expect(href).not.toContain(" ");
    expect(decodeURIComponent(href.split("?subject=")[1].split("&body=")[0])).toContain("12 Oak & Elm #3");
  });
});
