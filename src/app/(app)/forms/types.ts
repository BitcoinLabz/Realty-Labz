import type { FormFieldType, FormSignerStatus, FormSubmissionStatus } from "@/generated/prisma/enums";

export type FormTemplateDTO = {
  id: string;
  name: string;
  fileName: string;
  size: number;
  createdAt: string;
  creatorName: string;
  signerCount: number;
  fieldCount: number;
  hasSubmissions: boolean;
};

export type TemplateSignerDTO = {
  id: string;
  order: number;
  label: string;
};

export type TemplateFieldDTO = {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: FormFieldType;
  label: string;
  required: boolean;
  order: number;
  signerId: string;
};

export type FormSubmissionSummaryDTO = {
  id: string;
  templateName: string;
  status: FormSubmissionStatus;
  createdAt: string;
  clientId: string | null;
  clientName: string | null;
  signers: { id: string; name: string; status: FormSignerStatus; order: number }[];
};
