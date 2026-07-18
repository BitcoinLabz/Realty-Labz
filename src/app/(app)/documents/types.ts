export type DocumentDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  clientId: string | null;
  dealId: string | null;
  createdAt: string; // ISO
};

export type ClientOption = {
  id: string;
  name: string;
};

export type DealOption = {
  id: string;
  propertyAddress: string;
};
