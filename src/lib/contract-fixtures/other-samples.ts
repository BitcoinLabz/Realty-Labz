import type { ExtractedContractData } from "@/lib/ai-contract-analysis";

// Two more sample contracts for the reader's test set (2026-11-19), written
// for testing. One plain residential purchase with no options, and one with
// business-day counting, a sale-of-home contingency and a fee-based
// extension (a cost, not a deposit).

export const mapleStreetText = `RESIDENTIAL PURCHASE AGREEMENT

Property: 418 Maple Street, Brighton, MI 48116. Price: $342,500.
Date of Binding Agreement: August 14, 2026.

Earnest money of $3,000 shall be deposited within two (2) business days after the Date of Binding Agreement.
Buyer may conduct inspections within ten (10) days after the Date of Binding Agreement.
This offer is contingent on an appraisal at or above the purchase price within twenty-one (21) days after the Date of Binding Agreement.
Buyer shall obtain a written mortgage commitment within thirty (30) days after the Date of Binding Agreement.
Closing shall take place on or before September 30, 2026.
Buyer may perform a final walk-through one (1) day before closing.`;

export const mapleStreet: ExtractedContractData = {
  propertyAddress: "418 Maple Street, Brighton, MI 48116",
  salePrice: 342500,
  acceptanceDate: "2026-08-14",
  closingDate: "2026-09-30",
  deadlines: [
    d("Earnest money deposit", "2026-08-18", "EARNEST_MONEY", "ACCEPTANCE", 2, "BUSINESS", 3000),
    d("Inspection contingency", "2026-08-24", "INSPECTION", "ACCEPTANCE", 10),
    d("Appraisal contingency", "2026-09-04", "APPRAISAL", "ACCEPTANCE", 21),
    d("Financing contingency", "2026-09-13", "FINANCING", "ACCEPTANCE", 30),
    d("Closing", "2026-09-30", "CLOSING", "FIXED_DATE", null),
    d("Final walk-through", "2026-09-29", "OTHER", "CLOSING", -1),
  ],
  extensionOptions: [],
  mentions: [
    m("DEPOSIT", "Earnest money deposit"),
    m("CONTINGENCY", "Inspection contingency"),
    m("CONTINGENCY", "Appraisal contingency"),
    m("CONTINGENCY", "Financing contingency"),
  ],
  concerns: [],
};

export const lakeviewText = `PURCHASE AGREEMENT — 77 Lakeview Drive, Howell, MI 48843. Price: $289,900.
Seller's acceptance: October 5, 2026.

Buyer shall complete inspections within seven (7) business days after acceptance. Buyer may extend the inspection period by five (5) business days by paying Seller a non-refundable fee of $250 before the inspection period expires.
Earnest money of $2,500 is due within three (3) business days after acceptance.
This Agreement is contingent on the sale and closing of Buyer's home at 12 Elm Court within forty-five (45) days after acceptance.
Closing within ten (10) days after Buyer's home sale closes.`;

export const lakeview: ExtractedContractData = {
  propertyAddress: "77 Lakeview Drive, Howell, MI 48843",
  salePrice: 289900,
  acceptanceDate: "2026-10-05",
  closingDate: "2026-11-29",
  deadlines: [
    // 7 business days from Mon Oct 5: Columbus Day (Oct 12) is skipped.
    d("Inspection period", "2026-10-15", "INSPECTION", "ACCEPTANCE", 7, "BUSINESS"),
    d("Earnest money deposit", "2026-10-08", "EARNEST_MONEY", "ACCEPTANCE", 3, "BUSINESS", 2500),
    d("Sale of buyer's home", "2026-11-19", "SALE_OF_BUYERS_HOME", "ACCEPTANCE", 45),
    { ...d("Closing", "2026-11-29", "CLOSING", "OTHER_DEADLINE", 10), baseDeadlineLabel: "Sale of buyer's home" },
  ],
  extensionOptions: [
    {
      label: "Inspection extension",
      days: 5,
      dayType: "BUSINESS",
      additionalDeposit: null,
      cost: 250,
      exercisableBy: "Buyer",
      noticeText: "Pay the fee before the inspection period expires",
      noticeDate: "2026-10-15",
      affectedDeadlineLabels: ["Inspection period"],
      sourceQuote: "Buyer may extend the inspection period by five (5) business days by paying Seller a non-refundable fee of $250",
      page: 1,
      confidence: "high",
    },
  ],
  mentions: [
    m("CONTINGENCY", "Inspection period"),
    m("EXTENSION", "Inspection extension"),
    m("DEPOSIT", "Earnest money deposit"),
    m("CONTINGENCY", "Sale of buyer's home"),
  ],
  concerns: [],
};

function d(
  label: string,
  dueDate: string | null,
  category: ExtractedContractData["deadlines"][number]["category"],
  baseEvent: ExtractedContractData["deadlines"][number]["baseEvent"],
  offsetDays: number | null,
  dayType: "CALENDAR" | "BUSINESS" = "CALENDAR",
  amount: number | null = null,
): ExtractedContractData["deadlines"][number] {
  return {
    label,
    dueDate,
    sourceQuote: null,
    page: 1,
    basis: null,
    clientExplanation: `${label}.`,
    category,
    baseEvent,
    baseDeadlineLabel: null,
    offsetDays,
    dayType,
    amount,
    confidence: "high",
    ambiguity: null,
  };
}

function m(topic: ExtractedContractData["mentions"][number]["topic"], capturedAs: string) {
  return { topic, summary: capturedAs, sourceQuote: null, capturedAs };
}
