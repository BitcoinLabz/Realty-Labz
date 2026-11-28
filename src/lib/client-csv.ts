import Papa from "papaparse";
import { CLIENT_SOURCE_LABELS, CLIENT_STAGE_LABELS } from "@/lib/client-categories";

// Clients export (2026-11-28). Pure and tested (client-csv.test.ts).

export type ClientCsvRow = {
  name: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  source: string | null;
  stage: string;
  notes: string | null;
};

// A cell starting with = + - @ (or a tab/return) is run as a formula by
// Excel and Google Sheets. A note like "=HYPERLINK(...)" typed into a
// client record must open as text, so those cells get a leading apostrophe.
// Phone numbers like "+1 248..." are legitimate, so for those only the
// formula characters are neutralised, never removed.
export function safeCell(value: string | null | undefined): string {
  const text = value ?? "";
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export function clientsToCsv(clients: ClientCsvRow[]): string {
  const rows = clients.map((c) => ({
    Name: safeCell(c.name),
    Email: safeCell(c.email),
    Phone: safeCell(c.phone),
    Street: safeCell(c.street),
    City: safeCell(c.city),
    State: safeCell(c.state),
    ZIP: safeCell(c.zip),
    "Lead source": c.source ? (CLIENT_SOURCE_LABELS[c.source] ?? c.source) : "",
    Stage: CLIENT_STAGE_LABELS[c.stage] ?? c.stage,
    Notes: safeCell(c.notes),
  }));
  const csv = Papa.unparse(rows, {
    columns: ["Name", "Email", "Phone", "Street", "City", "State", "ZIP", "Lead source", "Stage", "Notes"],
    newline: "\r\n",
  });
  // The byte-order mark makes Excel read accents and em dashes as UTF-8.
  return `﻿${csv}`;
}
