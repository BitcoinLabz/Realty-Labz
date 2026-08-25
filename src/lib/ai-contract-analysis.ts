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
      }),
    )
    .describe(
      "Every dated contingency/deadline in the contract (inspection, financing, appraisal, title review, closing, etc.). Empty array if none found.",
    ),
});

export type ExtractedContractData = z.infer<typeof extractedContractSchema>;

const SYSTEM_PROMPT = `You are helping a real estate agent review a contract they have received.

Extract the property address, sale price, closing date, and every dated contingency or deadline.

Rules:
- Only report what the document actually states. If something isn't in the document, return null (or an empty deadlines array) rather than guessing.
- Many contracts express deadlines relative to another date, e.g. "inspection within 10 days of acceptance." Compute the actual calendar date from the dates given in the document, and only include the deadline if you can determine a real date.
- Return every date as yyyy-mm-dd.`;

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

  if (!response.parsed_output) {
    throw new ContractAnalysisError("Couldn't read this document. Try a different file.");
  }

  return response.parsed_output;
}
