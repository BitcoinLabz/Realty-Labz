import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// The one place that decides whether contract reading is available. Every
// entry point checks this first. The key itself stays in the server log --
// the page tells the agent the feature isn't available, not how to configure
// the host.
let loggedMissingKey = false;

export function isAiConfigured(): boolean {
  const on = !!process.env.ANTHROPIC_API_KEY;
  if (!on && !loggedMissingKey) {
    loggedMissingKey = true;
    console.error(
      "[contract-reading] ANTHROPIC_API_KEY is not set. Contract reading stays unavailable until the key is added and the app is redeployed.",
    );
  }
  return on;
}

export class ContractAnalysisError extends Error {}

// What we ask the model to pull out of a real estate contract. Everything is
// nullable because a contract genuinely might not state it -- a null means
// "not found," which the review UI shows as blank rather than inventing a
// value. Nothing here is ever written to the database without the agent
// confirming it first (see applyContractAnalysisAction).
export const extractedContractSchema = z.object({
  propertyAddress: z
    .string()
    .nullable()
    .describe("The full street address of the property, or null if not stated"),
  salePrice: z
    .number()
    .nullable()
    .describe("The purchase/sale price in dollars as a plain number, or null if not stated"),
  closingDate: z
    .string()
    .nullable()
    .describe("The closing/settlement date as yyyy-mm-dd, or null if not stated or not computable"),
  acceptanceDate: z
    .string()
    .nullable()
    .describe(
      "The date the agreement became binding (final acceptance / binding agreement date / effective date) as yyyy-mm-dd, or null if not stated",
    ),
  deadlines: z
    .array(
      z.object({
        label: z
          .string()
          .describe("Short name for the deadline, e.g. 'Inspection contingency'"),
        dueDate: z
          .string()
          .nullable()
          .describe(
            "The date this is due, as yyyy-mm-dd. Null only when it's counted from something whose date isn't in the document (e.g. acceptance with no date filled in).",
          ),
        // "Show your work": the agent checks each date against the contract's
        // own words instead of trusting it blind. Shown under the deadline in
        // the review screen and kept on the saved deadline.
        sourceQuote: z
          .string()
          .nullable()
          .describe(
            "The exact sentence or phrase from the contract this deadline comes from, copied verbatim and kept under 200 characters. Null only if there is no single passage.",
          ),
        page: z
          .number()
          .int()
          .nullable()
          .describe("The 1-based page number of the PDF where sourceQuote appears, or null if unsure"),
        basis: z
          .string()
          .nullable()
          .describe(
            "How the date was worked out when it isn't written as a calendar date, e.g. '10 days after acceptance (Sep 1)'. Null when the contract states the date directly.",
          ),
        clientExplanation: z
          .string()
          .describe(
            "One short, plain-English sentence telling the buyer or seller what this deadline means for them and what they need to do, with no legal jargon. For example: 'Your window to have the home inspected and ask the seller for repairs.'",
          ),
        // The deadline as a rule, so the app can recalculate it when the
        // acceptance date changes or an extension is used (2026-11-19).
        category: z
          .enum([
            "INSPECTION",
            "FINANCING",
            "APPRAISAL",
            "TITLE",
            "SALE_OF_BUYERS_HOME",
            "DUE_DILIGENCE",
            "EARNEST_MONEY",
            "CLOSING",
            "OTHER",
          ])
          .describe("What kind of deadline this is. Earnest money deposits (initial and additional) are EARNEST_MONEY."),
        baseEvent: z
          .enum(["ACCEPTANCE", "CLOSING", "OTHER_DEADLINE", "FIXED_DATE"])
          .describe(
            "What the deadline is counted from: ACCEPTANCE (binding agreement), CLOSING, OTHER_DEADLINE (another deadline in this list, e.g. 'within 15 days after the due diligence period ends'), or FIXED_DATE when the contract states a calendar date.",
          ),
        baseDeadlineLabel: z
          .string()
          .nullable()
          .describe("For OTHER_DEADLINE: the exact label of the deadline in this list it counts from. Otherwise null."),
        offsetDays: z
          .number()
          .int()
          .nullable()
          .describe("The number of days from the base event; negative for 'before'. Null for FIXED_DATE."),
        dayType: z
          .enum(["CALENDAR", "BUSINESS"])
          .describe("Whether the contract counts calendar days or business/banking days. CALENDAR if it just says 'days'."),
        amount: z
          .number()
          .nullable()
          .describe("For EARNEST_MONEY: the deposit amount in dollars. Otherwise null."),
        confidence: z
          .enum(["high", "medium", "low"])
          .describe(
            "How sure you are of this date: low if the text is hard to read, blank, handwritten, contradicts itself, or the date depends on something not in the document.",
          ),
        ambiguity: z
          .string()
          .nullable()
          .describe("If confidence isn't high: one short sentence saying exactly what is unclear. Otherwise null."),
      }),
    )
    .describe(
      "Every dated contingency/deadline in the contract (inspection, financing, appraisal, title review, closing, etc.). Empty array if none found.",
    ),
  extensionOptions: z
    .array(
      z.object({
        label: z.string().describe("Short name, e.g. 'Buyer's optional 60-day due diligence extension'"),
        days: z.number().int().describe("How many days the extension adds"),
        dayType: z.enum(["CALENDAR", "BUSINESS"]),
        additionalDeposit: z
          .number()
          .nullable()
          .describe("Additional earnest money required to use it, in dollars, or null"),
        cost: z.number().nullable().describe("Any non-refundable fee or price change to use it, in dollars, or null"),
        exercisableBy: z.string().nullable().describe("Who can use it, e.g. 'Buyer', 'Seller', 'Either party'"),
        noticeText: z
          .string()
          .nullable()
          .describe("How and by when notice must be given to use it, in a short phrase, e.g. 'Written notice before the due diligence period expires'"),
        noticeDate: z.string().nullable().describe("The last day to give that notice as yyyy-mm-dd, if it can be worked out"),
        affectedDeadlineLabels: z
          .array(z.string())
          .describe("Exact labels of the deadlines in the deadlines list that this extension moves"),
        sourceQuote: z.string().nullable().describe("The contract's own words, verbatim, under 300 characters"),
        page: z.number().int().nullable(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .describe(
      "Every OPTIONAL or CONDITIONAL extension the contract allows (often tied to an additional earnest money deposit or a fee). Look carefully in addenda, special provisions, and typed-in terms. Empty array if none.",
    ),
  mentions: z
    .array(
      z.object({
        topic: z.enum(["EXTENSION", "DEPOSIT", "CONTINGENCY", "OTHER_DATE"]),
        summary: z.string().describe("One short sentence describing the term"),
        sourceQuote: z.string().nullable().describe("Verbatim, under 200 characters"),
        capturedAs: z
          .string()
          .nullable()
          .describe("The label of the deadline or extension option above that captures this term, or null if none does"),
      }),
    )
    .describe(
      "Every passage that mentions an extension, an earnest money deposit, a contingency, or a date-driven obligation -- including ones you could NOT turn into a dated deadline. Used to warn the agent about anything missed.",
    ),
  concerns: z
    .array(
      z.object({
        issue: z.string().describe("One short sentence describing what an agent should double-check"),
        sourceQuote: z
          .string()
          .nullable()
          .describe("The contract text this concern is about, verbatim and under 200 characters, or null"),
      }),
    )
    .describe(
      "Things in this contract an agent would want to double-check: dates that conflict with each other, a contingency with no date, blank or unfilled fields, unusually short windows, or terms that look unusual. Empty array if nothing stands out. Do not pad this list.",
    ),
});

export type ExtractedContractData = z.infer<typeof extractedContractSchema>;

const SYSTEM_PROMPT = `You are helping a real estate agent review a contract they have received.

Extract the property address, sale price, acceptance (binding agreement) date, closing date, every dated contingency or deadline, every earnest money deposit, and every optional or conditional extension.

Rules:
- Only report what the document actually states. If something isn't in the document, return null (or an empty deadlines array) rather than guessing.
- Many contracts express deadlines relative to another date, e.g. "inspection within 10 days of acceptance." Compute the calendar date from the dates given in the document when you can; if the base date isn't filled in, still list the deadline with its rule and a null date.
- Return every date as yyyy-mm-dd.
- For each deadline, quote the contract's own words exactly as written, so the agent can find and check them. Never paraphrase inside sourceQuote.
- The client explanation is read by a home buyer or seller, not a lawyer: one sentence, everyday words, focused on what it means for them.
- Only raise a concern when there is something specific to check. An empty list is a good answer for a clean contract.
- Record HOW each deadline is calculated (base event, number of days, calendar vs. business days), not just the date. Use the contract's own counting: "business days" or "banking days" is BUSINESS; plain "days" is CALENDAR.
- Earnest money deposits are deadlines too (category EARNEST_MONEY, with the amount): the initial deposit and any additional deposits.
- Optional and conditional terms matter as much as fixed dates. If the contract lets a party extend a period (for example, an additional 60 days for an additional deposit), list it under extensionOptions with its length, cost, additional deposit, who can use it, and the notice deadline. Do not fold it into the base deadline's date.
- In mentions, list every extension, deposit, contingency or date-driven term you saw, and set capturedAs to the deadline or option that covers it, or null if you couldn't capture it. Never drop a term silently.
- Mark confidence honestly. Low confidence with a clear ambiguity note is far more useful than a confident guess.`;

// Sends the contract PDF to Claude and gets back structured data. Uses
// structured outputs (a Zod schema) rather than parsing free text, so the
// shape is guaranteed rather than hoped for -- the same reliability
// reasoning this project already applied when choosing pdf-lib/ics/papaparse
// over hand-rolling something fragile.
export async function analyzeContractPdf(pdfBuffer: Buffer): Promise<ExtractedContractData> {
  if (!isAiConfigured()) {
    throw new ContractAnalysisError("Contract reading isn't available right now.");
  }

  const client = new Anthropic();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    // Deadlines are often stated relatively ("within 10 days of acceptance"),
    // so the model has real date arithmetic to do here, not just lookup.
    thinking: { type: "adaptive" },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBuffer.toString("base64"),
            },
          },
          { type: "text", text: "Extract the contract details and deadlines from this document." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(extractedContractSchema) },
  });

  // Logged so real spend shows up in the Vercel function logs rather than
  // only on the bill. input_tokens is dominated by the PDF itself: a page
  // sent as a document block is rendered as an image as well as having its
  // text read, which is why the count runs far above the contract's word
  // count.
  const usage = response.usage;
  console.log(
    "[contract-analysis] tokens in=%d out=%d",
    usage.input_tokens,
    usage.output_tokens,
  );

  // A safety decline arrives as a normal 200 with no parsed output; say so
  // plainly rather than blaming the file.
  if (response.stop_reason === "refusal") {
    throw new ContractAnalysisError("This document couldn't be read automatically. Add the dates by hand.");
  }
  if (!response.parsed_output) {
    throw new ContractAnalysisError("Couldn't read this document. Try a different file.");
  }

  return response.parsed_output;
}
