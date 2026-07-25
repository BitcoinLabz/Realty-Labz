export type ClientDTO = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
};

export type ClientOption = {
  id: string;
  name: string;
};

export type DealOption = {
  id: string;
  propertyAddress: string;
};

export type DocumentDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  clientId: string | null;
  dealId: string | null;
  createdAt: string; // ISO
};

