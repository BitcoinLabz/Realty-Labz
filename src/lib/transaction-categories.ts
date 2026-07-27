// Pure data, deliberately kept dependency-free (no prisma/db import) so it
// can be safely imported from client components (budgets-section.tsx,
// csv-import-flow.tsx) as well as server-side code (finance-data.ts) --
// importing anything from finance-data.ts itself would pull the whole
// prisma/pg module graph into the browser bundle, which fails to build
// (pg needs Node built-ins like fs/net/tls that don't exist in a browser).
//
// HOME_OFFICE is included so any pre-2026-07-24 manually-entered rows still
// get a readable label instead of falling back to the raw enum string — it's
// no longer manually selectable in the UI (see transaction-form.tsx), since
// its deduction is computed by getHomeOfficeDeduction in finance-data.ts.
export const CATEGORY_LABELS: Record<string, string> = {
  HOME_OFFICE: "Home office (manual entry)",
  PHONE: "Phone",
  MARKETING_ADVERTISING: "Marketing & advertising",
  MLS_DUES: "MLS / association dues",
  CONTINUING_EDUCATION: "Continuing education",
  CLIENT_GIFTS: "Client gifts",
  OFFICE_SUPPLIES: "Office supplies",
  SOFTWARE_SUBSCRIPTIONS: "Software & subscriptions",
  INSURANCE: "Insurance",
  LICENSING_FEES: "Licensing fees",
  MEALS_ENTERTAINMENT: "Meals & entertainment",
  PROFESSIONAL_SERVICES: "Professional services",
  OTHER: "Other",
};
