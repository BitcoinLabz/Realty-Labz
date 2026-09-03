import {
  PDFCheckBox,
  PDFDocument,
  PDFSignature,
  PDFTextField,
  type PDFField,
  type PDFPage,
} from "pdf-lib";
import { pdfPointsToFieldRect } from "@/lib/pdf-fields";
import type { FormFieldType } from "@/generated/prisma/enums";

export type DetectedField = {
  page: number; // 0-based, matching FormField.page
  x: number;
  y: number;
  width: number;
  height: number;
  type: FormFieldType;
  label: string;
};

/**
 * Guesses a field's type from the name the form's author gave it.
 *
 * A PDF text field is just a text field -- nothing in the format says
 * "this one is a date" or "sign here". But real forms name their fields, and
 * those names are consistent enough to be worth reading: a box called
 * "Buyer_Signature" is a signature box. Wrong guesses are cheap here, since
 * every imported field lands in the designer where the agent can change its
 * type before the template is ever sent.
 */
function inferTypeFromName(name: string): FormFieldType {
  // Separators become spaces BEFORE the word-boundary tests. Underscore is a
  // word character in JS regex, so /\bdate\b/ does not match "Closing_Date" --
  // and PDF field names are overwhelmingly underscore- or dot-separated, which
  // would have made every one of these rules silently never fire.
  const n = name.toLowerCase().replace(/[._\-\d]+/g, " ");
  if (/\binitials?\b/.test(n)) return "INITIALS";
  if (/\bsign(ature|ed|here)?\b/.test(n)) return "SIGNATURE";
  if (/\bdates?\b|\bdob\b|\bdeadline\b|\bexpir\w*\b/.test(n)) return "DATE";
  return "TEXT";
}

/**
 * Turns a PDF field's internal name into something a person can read.
 * "Buyer_1_Full.Name" -> "Buyer 1 Full Name".
 */
function humanizeName(name: string): string {
  const cleaned = name
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Field";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function typeForField(field: PDFField): FormFieldType {
  if (field instanceof PDFSignature) return "SIGNATURE";
  if (field instanceof PDFCheckBox) return "CHECKBOX";
  if (field instanceof PDFTextField) return inferTypeFromName(field.getName());
  // Dropdowns, option lists and radio groups have no equivalent in this app's
  // five field types. TEXT is the honest fallback -- the signer can still type
  // the value, rather than the field silently disappearing from the form.
  return inferTypeFromName(field.getName());
}

/**
 * Reads the fields a fillable PDF already carries.
 *
 * Standard association forms (the MAR purchase agreement and friends) ship as
 * AcroForms: every box already has a name, a type, a page and an exact
 * rectangle. Until now this app ignored all of that and made the agent
 * click-and-drag forty boxes onto a page that already described them.
 *
 * Returns an empty array for a flattened, scanned or printed PDF -- those
 * genuinely have no fields, and the click-to-place designer remains the
 * answer for them. Never throws on a malformed form: a PDF we can't read
 * fields from should fall back to manual placement, not fail the upload.
 */
export async function extractAcroFormFields(pdfBuffer: Buffer): Promise<DetectedField[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  } catch {
    return [];
  }

  let fields: PDFField[];
  try {
    fields = doc.getForm().getFields();
  } catch {
    return [];
  }

  const pages = doc.getPages();
  // Widget -> page has to be resolved by identity: a widget knows its page
  // only by reference, and pdf-lib exposes no direct lookup. Building the map
  // once keeps this linear rather than rescanning every page per widget.
  const pageIndexByRef = new Map<string, number>();
  pages.forEach((page: PDFPage, index: number) => {
    pageIndexByRef.set(page.ref.toString(), index);
  });

  const detected: DetectedField[] = [];

  for (const field of fields) {
    const name = field.getName();
    const type = typeForField(field);

    let widgets: ReturnType<typeof field.acroField.getWidgets>;
    try {
      widgets = field.acroField.getWidgets();
    } catch {
      continue;
    }

    // One field can appear in several places (an initials box repeated on
    // every page). Each widget becomes its own placement, numbered so the
    // agent can tell them apart in the designer.
    widgets.forEach((widget, widgetIndex) => {
      let rect: { x: number; y: number; width: number; height: number };
      try {
        rect = widget.getRectangle();
      } catch {
        return;
      }

      // A zero-size widget is a placeholder the author never positioned.
      // Importing it would drop an invisible box on the page.
      if (rect.width <= 0 || rect.height <= 0) return;

      const pageRef = widget.P();
      const pageIndex = pageRef ? pageIndexByRef.get(pageRef.toString()) : undefined;
      if (pageIndex === undefined) return;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const normalized = pdfPointsToFieldRect(rect, pageWidth, pageHeight);

      detected.push({
        page: pageIndex,
        ...normalized,
        type,
        label:
          widgets.length > 1
            ? `${humanizeName(name)} (${widgetIndex + 1})`
            : humanizeName(name),
      });
    });
  }

  // Reading order: down the page, then left to right. Matches how someone
  // reads the form, so the designer's list lines up with the document.
  return detected.sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
}
