import type { FormFieldType } from "@/generated/prisma/enums";

export type SignFieldDTO = {
  id: string;
  page: number; // 0-indexed, matches DB/pdf-lib convention — +1 when calling pdfjs
  x: number;
  y: number;
  width: number;
  height: number;
  type: FormFieldType;
  label: string;
  required: boolean;
};
