// Live evaluation of the contract reader against the sample contract set
// (2026-11-19). THIS COSTS MONEY: each contract is one paid Anthropic API
// call (a one-page sample is roughly 2-4 cents). It refuses to run unless
// RUN_PAID_EVAL=yes is set, and per the project's standing rule it should
// only be run when the founder has said yes to that specific run.
//
//   RUN_PAID_EVAL=yes npx tsx --env-file=.env.local scripts/eval-contract-reader.ts
//
// Each sample's text is laid out into a PDF with pdf-lib, read by the real
// reader, and scored against the hand-written expected reading: every
// deadline found with the right date, rule and amount; every extension
// option found with the right length, deposit and target; and no "missed"
// warnings on a contract where everything should be captured.

import { PDFDocument, StandardFonts } from "pdf-lib";
import { analyzeContractPdf, type ExtractedContractData } from "../src/lib/ai-contract-analysis";
import { buildContractReview } from "../src/lib/contract-review";
import * as crookedLake from "../src/lib/contract-fixtures/crooked-lake-road";
import { lakeview, lakeviewText, mapleStreet, mapleStreetText } from "../src/lib/contract-fixtures/other-samples";

const SAMPLES: { name: string; text: string; expected: ExtractedContractData }[] = [
  { name: "0 Crooked Lake Road (vacant land, optional 60-day extension)", text: crookedLake.text, expected: crookedLake.expected },
  { name: "418 Maple Street (plain residential)", text: mapleStreetText, expected: mapleStreet },
  { name: "77 Lakeview Drive (business days, fee extension)", text: lakeviewText, expected: lakeview },
];

async function toPdf(text: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 10;
  const maxWidth = 612 - 72 * 2;
  let page = pdf.addPage([612, 792]);
  let y = 792 - 72;
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let line = "";
    const flush = () => {
      if (y < 72) {
        page = pdf.addPage([612, 792]);
        y = 792 - 72;
      }
      page.drawText(line, { x: 72, y, size, font });
      y -= size * 1.5;
      line = "";
    };
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth) flush();
      line = line ? `${line} ${word}` : word;
    }
    flush();
  }
  return Buffer.from(await pdf.save());
}

const norm = (s: string) => s.toLowerCase();

function score(expected: ExtractedContractData, actual: ExtractedContractData): string[] {
  const problems: string[] = [];
  if (actual.acceptanceDate !== expected.acceptanceDate) {
    problems.push(`acceptance date: expected ${expected.acceptanceDate}, got ${actual.acceptanceDate}`);
  }
  const review = buildContractReview(actual);
  for (const want of expected.deadlines) {
    const got = review.items.find((i) => i.category === want.category && (want.category !== "EARNEST_MONEY" || i.amount === want.amount));
    if (!got) {
      problems.push(`missing deadline: ${want.label}`);
      continue;
    }
    if (got.dueDate !== want.dueDate) problems.push(`${want.label}: expected ${want.dueDate}, got ${got.dueDate}`);
    if (want.baseEvent !== "FIXED_DATE" && !got.rule) problems.push(`${want.label}: no rule captured`);
    if (got.rule && want.offsetDays != null && got.rule.offsetDays !== want.offsetDays) {
      problems.push(`${want.label}: expected ${want.offsetDays} days, got ${got.rule.offsetDays}`);
    }
    if (got.rule && got.rule.dayType !== want.dayType) problems.push(`${want.label}: expected ${want.dayType} days`);
  }
  for (const want of expected.extensionOptions) {
    const got = review.options.find((o) => o.days === want.days);
    if (!got) {
      problems.push(`missing extension option: ${want.label}`);
      continue;
    }
    if (got.additionalDeposit !== want.additionalDeposit) problems.push(`${want.label}: deposit ${got.additionalDeposit}`);
    if (got.cost !== want.cost) problems.push(`${want.label}: cost ${got.cost}`);
    const targets = got.targetIndexes.map((i) => norm(review.items[i].label));
    if (targets.length === 0) problems.push(`${want.label}: not linked to any deadline`);
    else if (!want.affectedDeadlineLabels.some((l) => targets.some((t) => t.includes(norm(l).split(" ")[0])))) {
      problems.push(`${want.label}: linked to ${targets.join(", ")}`);
    }
  }
  const missed = review.warnings.filter((w) => w.kind === "missed");
  if (missed.length) problems.push(`${missed.length} "possibly missed" warning(s): ${missed.map((w) => w.text).join(" / ")}`);
  return problems;
}

async function main() {
  if (process.env.RUN_PAID_EVAL !== "yes") {
    console.error("Refusing to run: this makes paid API calls. Set RUN_PAID_EVAL=yes once the cost is approved.");
    process.exit(1);
  }
  let failed = 0;
  for (const sample of SAMPLES) {
    const actual = await analyzeContractPdf(await toPdf(sample.text));
    const problems = score(sample.expected, actual);
    console.log(`\n${problems.length ? "✗" : "✓"} ${sample.name}`);
    for (const p of problems) console.log(`   - ${p}`);
    if (problems.length) failed++;
  }
  console.log(`\n${SAMPLES.length - failed}/${SAMPLES.length} samples read correctly.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
