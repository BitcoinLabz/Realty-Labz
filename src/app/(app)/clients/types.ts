export type ClientDTO = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  stage: string;
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

// NOTE: client-level deadlines were removed from the UI (2026-08-25) --
// a client's page is for their contact details and their transactions, not
// a second place to track dates. Deadlines live on a transaction, where the
// contract dates actually belong. The ClientDeadline table still exists in
// the database so no data was destroyed; nothing reads it today.

