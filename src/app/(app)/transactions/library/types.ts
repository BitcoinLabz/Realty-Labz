// A raw uploaded contract/form file, shared with the team (or just yours,
// if solo) — the "browse the library" source you build a fillable
// FormTemplate from. mimeType gates whether "Create fillable template" can
// show for a given row (only PDFs go through the pdfjs/pdf-lib field
// designer — see createFormTemplateFromLibraryAction).
export type DocumentTemplateDTO = {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string; // ISO
  creatorName: string;
};
