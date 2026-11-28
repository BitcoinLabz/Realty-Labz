import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { clientsToCsv, safeCell } from "./client-csv";

const base = {
  name: "Jo Li",
  email: "jo@x.co",
  phone: "(248) 555-0100",
  street: "418 Maple Street",
  city: "Brighton",
  state: "MI",
  zip: "48116",
  source: "REFERRAL",
  stage: "ACTIVE",
  notes: null,
};

function parse(csv: string) {
  return Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), { header: true }).data;
}

describe("clientsToCsv", () => {
  it("has every column in order, with readable labels", () => {
    const csv = clientsToCsv([base]);
    expect(csv.startsWith("﻿Name,Email,Phone,Street,City,State,ZIP,Lead source,Stage,Notes\r\n")).toBe(true);
    const [row] = parse(csv);
    expect(row["Lead source"]).toBe("Referral");
    expect(row.Stage).toBe("Active");
    expect(row.ZIP).toBe("48116");
  });

  it("survives commas, quotes and line breaks in notes", () => {
    const notes = 'Wants a lake view, 3+ acres.\nSaid "no HOA", please.';
    const [row] = parse(clientsToCsv([{ ...base, notes }]));
    expect(row.Notes).toBe(notes);
  });

  it("leaves blanks empty rather than writing null", () => {
    const [row] = parse(clientsToCsv([{ ...base, email: null, source: null, street: null }]));
    expect(row.Email).toBe("");
    expect(row["Lead source"]).toBe("");
    expect(row.Street).toBe("");
  });
});

describe("safeCell", () => {
  it("stops a spreadsheet from running a formula", () => {
    expect(safeCell('=HYPERLINK("http://evil","x")')).toBe(`'=HYPERLINK("http://evil","x")`);
    expect(safeCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(safeCell("-2+3")).toBe("'-2+3");
  });

  it("keeps a + phone number readable, as text", () => {
    expect(safeCell("+1 248 555 0100")).toBe("'+1 248 555 0100");
  });

  it("leaves ordinary text alone", () => {
    expect(safeCell("Jo Li")).toBe("Jo Li");
    expect(safeCell(null)).toBe("");
  });
});
