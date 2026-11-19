import type { ExtractedContractData } from "@/lib/ai-contract-analysis";

// A sample contract MODELED on the 0 Crooked Lake Road purchase agreement
// (vacant land) whose optional extension the reader originally missed. The
// wording is written for testing, not copied from the real document; the
// terms that matter are the same: base deadlines, plus an optional 60-day
// extension of due diligence tied to an additional $5,000 deposit.
//
// `text` feeds the live evaluation script (scripts/eval-contract-reader.ts,
// which costs money and only runs when asked). `expected` is what a correct
// reading looks like, used by the free unit tests.

export const text = `VACANT LAND PURCHASE AGREEMENT

Property: 0 Crooked Lake Road, Fenton, Michigan 48430 (Parcel 03-12-200-014)
Purchase Price: $185,000.00

1. BINDING AGREEMENT DATE. This Agreement is binding on the date of Seller's final acceptance: September 1, 2026.

2. EARNEST MONEY. Buyer shall deposit $2,000.00 with Lakeshore Title Agency within three (3) business days after the Binding Agreement Date.

3. FINANCING. This Agreement is contingent on Buyer obtaining a land loan commitment within twenty-one (21) days after the Binding Agreement Date.

4. TITLE. Buyer shall deliver any written objections to the title commitment within fifteen (15) days after the Binding Agreement Date.

5. DUE DILIGENCE. Buyer shall have ninety (90) days after the Binding Agreement Date (the "Due Diligence Period") to complete soil, perc, survey, wetlands and zoning investigations, and may terminate this Agreement by written notice before the Due Diligence Period expires.

6. EXTENSION OF DUE DILIGENCE. Buyer may extend the Due Diligence Period by an additional sixty (60) days by giving Seller written notice and depositing an additional $5,000.00 in earnest money with the title company before the original Due Diligence Period expires. The additional deposit shall be applicable to the Purchase Price.

7. CLOSING. Closing shall take place within fifteen (15) days after the expiration of the Due Diligence Period, as it may be extended.

8. POSSESSION. Possession at closing.`;

const dd = "Due diligence period ends";

export const expected: ExtractedContractData = {
  propertyAddress: "0 Crooked Lake Road, Fenton, Michigan 48430",
  salePrice: 185000,
  acceptanceDate: "2026-09-01",
  closingDate: "2026-12-15",
  deadlines: [
    {
      label: "Initial earnest money deposit",
      dueDate: "2026-09-04",
      sourceQuote: "Buyer shall deposit $2,000.00 with Lakeshore Title Agency within three (3) business days after the Binding Agreement Date.",
      page: 1,
      basis: "3 business days after acceptance (Sep 1)",
      clientExplanation: "Your first $2,000 deposit is due to the title company by this date.",
      category: "EARNEST_MONEY",
      baseEvent: "ACCEPTANCE",
      baseDeadlineLabel: null,
      offsetDays: 3,
      dayType: "BUSINESS",
      amount: 2000,
      confidence: "high",
      ambiguity: null,
    },
    {
      label: "Financing contingency",
      dueDate: "2026-09-22",
      sourceQuote: "contingent on Buyer obtaining a land loan commitment within twenty-one (21) days after the Binding Agreement Date",
      page: 1,
      basis: "21 days after acceptance",
      clientExplanation: "Your lender needs to approve your land loan by this date.",
      category: "FINANCING",
      baseEvent: "ACCEPTANCE",
      baseDeadlineLabel: null,
      offsetDays: 21,
      dayType: "CALENDAR",
      amount: null,
      confidence: "high",
      ambiguity: null,
    },
    {
      label: "Title objections",
      dueDate: "2026-09-16",
      sourceQuote: "Buyer shall deliver any written objections to the title commitment within fifteen (15) days after the Binding Agreement Date.",
      page: 1,
      basis: "15 days after acceptance",
      clientExplanation: "Last day to raise any problems found in the title report.",
      category: "TITLE",
      baseEvent: "ACCEPTANCE",
      baseDeadlineLabel: null,
      offsetDays: 15,
      dayType: "CALENDAR",
      amount: null,
      confidence: "high",
      ambiguity: null,
    },
    {
      label: dd,
      dueDate: "2026-11-30",
      sourceQuote: "Buyer shall have ninety (90) days after the Binding Agreement Date (the \"Due Diligence Period\")",
      page: 1,
      basis: "90 days after acceptance",
      clientExplanation: "Your window to finish soil, survey, wetlands and zoning checks and back out if needed.",
      category: "DUE_DILIGENCE",
      baseEvent: "ACCEPTANCE",
      baseDeadlineLabel: null,
      offsetDays: 90,
      dayType: "CALENDAR",
      amount: null,
      confidence: "high",
      ambiguity: null,
    },
    {
      label: "Closing",
      dueDate: "2026-12-15",
      sourceQuote: "Closing shall take place within fifteen (15) days after the expiration of the Due Diligence Period, as it may be extended.",
      page: 1,
      basis: "15 days after due diligence ends",
      clientExplanation: "The day the land becomes yours.",
      category: "CLOSING",
      baseEvent: "OTHER_DEADLINE",
      baseDeadlineLabel: dd,
      offsetDays: 15,
      dayType: "CALENDAR",
      amount: null,
      confidence: "high",
      ambiguity: null,
    },
  ],
  extensionOptions: [
    {
      label: "Buyer's optional 60-day due diligence extension",
      days: 60,
      dayType: "CALENDAR",
      additionalDeposit: 5000,
      cost: null,
      exercisableBy: "Buyer",
      noticeText: "Written notice and the additional deposit before the original due diligence period expires",
      noticeDate: "2026-11-30",
      affectedDeadlineLabels: [dd],
      sourceQuote: "Buyer may extend the Due Diligence Period by an additional sixty (60) days by giving Seller written notice and depositing an additional $5,000.00",
      page: 1,
      confidence: "high",
    },
  ],
  mentions: [
    { topic: "DEPOSIT", summary: "Initial $2,000 deposit within 3 business days", sourceQuote: null, capturedAs: "Initial earnest money deposit" },
    { topic: "CONTINGENCY", summary: "Financing within 21 days", sourceQuote: null, capturedAs: "Financing contingency" },
    { topic: "CONTINGENCY", summary: "Title objections within 15 days", sourceQuote: null, capturedAs: "Title objections" },
    { topic: "CONTINGENCY", summary: "90-day due diligence period", sourceQuote: null, capturedAs: dd },
    {
      topic: "EXTENSION",
      summary: "Buyer may extend due diligence 60 days with an additional $5,000 deposit",
      sourceQuote: "Buyer may extend the Due Diligence Period by an additional sixty (60) days",
      capturedAs: "Buyer's optional 60-day due diligence extension",
    },
    { topic: "DEPOSIT", summary: "Additional $5,000 deposit to extend", sourceQuote: null, capturedAs: "Buyer's optional 60-day due diligence extension" },
  ],
  concerns: [],
};

/**
 * What the original reader effectively produced: the fixed dates, with the
 * extension folded away. With the new schema the model must still LIST the
 * passage under mentions -- and capturedAs null is what raises the warning.
 */
export const missedExtension: ExtractedContractData = {
  ...expected,
  extensionOptions: [],
  mentions: expected.mentions.map((m) => (m.topic === "EXTENSION" || m.summary.includes("$5,000") ? { ...m, capturedAs: null } : m)),
};
