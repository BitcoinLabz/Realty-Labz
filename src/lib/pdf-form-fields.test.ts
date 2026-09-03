import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractAcroFormFields } from "./pdf-form-fields";

// Builds a real fillable PDF with fields at known point positions, so the
// extraction is checked against an actual file rather than a mock. US Letter
// (612x792) is what essentially every real estate form uses.
async function buildSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([612, 792]);
  const p2 = doc.addPage([612, 792]);
  const form = doc.getForm();

  form.createTextField("Buyer_Name").addToPage(p1, {
    x: 61.2, y: 712.8, width: 306, height: 39.6, font, borderWidth: 0,
  });
  form.createTextField("Closing_Date").addToPage(p1, {
    x: 306, y: 396, width: 153, height: 19.8, font, borderWidth: 0,
  });
  form.createCheckBox("Buyer_Agrees").addToPage(p1, {
    x: 61.2, y: 158.4, width: 15.84, height: 15.84, borderWidth: 0,
  });
  form.createTextField("Buyer_Signature").addToPage(p2, {
    x: 61.2, y: 79.2, width: 244.8, height: 39.6, font, borderWidth: 0,
  });

  return Buffer.from(await doc.save());
}

describe("extractAcroFormFields", () => {
  it("reads every field with the right page and position", async () => {
    const fields = await extractAcroFormFields(await buildSamplePdf());
    expect(fields).toHaveLength(4);

    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f]));

    // The sample is built with borderWidth: 0 deliberately. pdf-lib expands a
    // widget rect by half its border when writing the file, so a bordered
    // field lands 0.5pt off the position requested -- invisible in practice,
    // but it would force a loose tolerance here and hide a real drift later.
    // With no border the stored rect is exact, so this asserts to 6 decimals.
    //
    // 61.2/612 = 0.1 across; (792 - 712.8 - 39.6)/792 = 0.05 down from the top.
    expect(byLabel["Buyer Name"].page).toBe(0);
    expect(byLabel["Buyer Name"].x).toBeCloseTo(0.1, 6);
    expect(byLabel["Buyer Name"].y).toBeCloseTo(0.05, 6);
    expect(byLabel["Buyer Name"].width).toBeCloseTo(0.5, 6);
    expect(byLabel["Buyer Name"].height).toBeCloseTo(0.05, 6);

    expect(byLabel["Closing Date"].y).toBeCloseTo(0.475, 6);
    expect(byLabel["Buyer Agrees"].y).toBeCloseTo(0.78, 6);

    // Second page, and the page index must come through as 1.
    expect(byLabel["Buyer Signature"].page).toBe(1);
    expect(byLabel["Buyer Signature"].y).toBeCloseTo(0.85, 6);
    expect(byLabel["Buyer Signature"].width).toBeCloseTo(0.4, 6);
  });

  it("infers a usable type from the field's name", async () => {
    const fields = await extractAcroFormFields(await buildSamplePdf());
    const byLabel = Object.fromEntries(fields.map((f) => [f.label, f]));

    expect(byLabel["Buyer Name"].type).toBe("TEXT");
    expect(byLabel["Closing Date"].type).toBe("DATE");
    expect(byLabel["Buyer Agrees"].type).toBe("CHECKBOX");
    expect(byLabel["Buyer Signature"].type).toBe("SIGNATURE");
  });

  it("returns fields in reading order — down the page, then across", async () => {
    const fields = await extractAcroFormFields(await buildSamplePdf());
    expect(fields.map((f) => f.label)).toEqual([
      "Buyer Name",
      "Closing Date",
      "Buyer Agrees",
      "Buyer Signature",
    ]);
  });

  it("returns nothing for a flattened PDF instead of throwing", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const flat = Buffer.from(await doc.save());
    expect(await extractAcroFormFields(flat)).toEqual([]);
  });

  it("returns nothing for a file that isn't a PDF at all", async () => {
    expect(await extractAcroFormFields(Buffer.from("not a pdf"))).toEqual([]);
  });
});
