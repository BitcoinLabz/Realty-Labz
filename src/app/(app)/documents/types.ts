export type DocumentDTO = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  clientId: string | null;
  createdAt: string; // ISO
};

export type ClientOption = {
  id: string;
  name: string;
};
