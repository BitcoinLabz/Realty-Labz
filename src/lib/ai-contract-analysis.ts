import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// The one place that decides whether the AI features are available at all.
// Every AI entry point checks this first, and the UI only renders the
// "Analyze with AI" button when it's true -- so the feature is completely
// inert (no dead buttons, no runtime errors) until ANTHROPIC_API_KEY is
// actually configured. Same lazy-config philosophy as getResendClient()
// in src/lib/email.ts and getSupabaseAdmin() in src/lib/supabase.ts.
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export class ContractAnalysisError extends Error {}

// What we ask the model to pull out of a real estate contract. Everything is
// nullable because a contract genuinely might not state it -- a null means
// "not found," which the review UI shows as blank rather than inventing a
// value. Nothing here is ever written to the database without the agent
// confirming it first (see applyContractAnalysisAction).
const extractedContractSchema = z.object({
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
    .describe("The closing/settlement date as yyyy-mm-dd, or null if not stated"),
  deadlines: z
    .array(
      z.object({
        label: z
          .string()
          .describe("Short name for the deadline, e.g. 'Inspection contingency'"),
        dueDate: z.string().describe("The date this is due, as yyyy-mm-dd"),
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
      }),
    )
    .describe(
      "Every dated contingency/deadline in the contract (inspection, financing, appraisal, title review, closing, etc.). Empty array if none found.",
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

Extract the property address, sale price, closing date, and every dated contingency or deadline.

Rules:
- Only report what the document actually states. If something isn't in the document, return null (or an empty deadlines array) rather than guessing.
- Many contracts express deadlines relative to another date, e.g. "inspection within 10 days of acceptance." Compute the actual calendar date from the dates given in the document, and only include the deadline if you can determine a real date.
- Return every date as yyyy-mm-dd.
- For each deadline, quote the contract's own words exactly as written, so the agent can find and check them. Never paraphrase inside sourceQuote.
- The client explanation is read by a home buyer or seller, not a lawyer: one sentence, everyday words, focused on what it means for them.
- Only raise a concern when there is something specific to check. An empty list is a good answer for a clean contract.`;

// Sends the contract PDF to Claude and gets back structured data. Uses
// structured outputs (a Zod schema) rather than parsing free text, so the
// shape is guaranteed rather than hoped for -- the same reliability
// reasoning this project already applied when choosing pdf-lib/ics/papaparse
// over hand-rolling something fragile.
export async function analyzeContractPdf(pdfBuffer: Buffer): Promise<ExtractedContractData> {
  if (!isAiConfigured()) {
    throw new ContractAnalysisError("AI analysis isn't set up yet");
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
