export type DealSide = "BUYER" | "SELLER" | "DUAL" | "TENANT" | "LANDLORD";
export type DealStatus = "ACTIVE" | "UNDER_CONTRACT" | "PENDING" | "CLOSED" | "FELL_THROUGH";

// Shared across every screen that shows a deal's side/status (previously
// duplicated locally in forms/[id]/page.tsx) — one place to keep these in
// sync, same pattern as src/lib/client-categories.ts.
export const DEAL_SIDE_LABELS: Record<DealSide, string> = {
  BUYER: "Buyer",
  SELLER: "Seller",
  DUAL: "Dual",
  TENANT: "Tenant",
  LANDLORD: "Landlord",
};

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  ACTIVE: "Active",
  UNDER_CONTRACT: "Under Contract",
  PENDING: "Pending",
  CLOSED: "Closed",
  FELL_THROUGH: "Fell Through",
};

// One row in the "Files" list (/forms/files) — every deal across the
// session's visible clients (teamOrOwnFilter), with the counts SkySlope's
// Files view shows: how many plain Documents and how many e-signature
// FormSubmissions ("envelopes") are attached to this property.
export type DealFileDTO = {
  id: string;
  propertyAddress: string | null;
  side: DealSide;
  status: DealStatus;
  clientId: string | null;
  clientName: string | null;
  agentName: string;
  documentCount: number;
  envelopeCount: number;
  updatedAt: string; // ISO
};

export type DealDTO = {
  id: string;
  side: DealSide;
  status: DealStatus;
  propertyAddress: string | null;
  mlsNumber: string | null;
  listPrice: number | null;
  salePrice: number | null;
  commissionRate: number | null;
  commissionAmount: number | null;
  closingDate: string | null; // yyyy-mm-dd
  notes: string | null;
  clientId: string | null;
  clientName: string | null;
  agentId: string;
  agentName: string;
};

// One consistent fallback for the many places that display a deal by its
// property address — a deal can now exist before a property is found (see
// the Create a file wizard), so every one of those call sites needs a
// fallback rather than assuming propertyAddress is always a real string.
export function dealDisplayName(
  propertyAddress: string | null,
  clientName?: string | null,
): string {
  if (propertyAddress) return propertyAddress;
  return clientName ? `${clientName} — new file` : "New file";
}

export type DealDeadlineDTO = {
  id: string;
  label: string;
  dueDate: string; // yyyy-mm-dd
  completedAt: string | null;
};

export type OpenHouseVisitorDTO = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  interested: boolean | null;
  feedback: string | null;
  createdAt: string;
};

export type ReferralPartnerOption = {
  id: string;
  name: string;
};

export type ReferralPartnerDTO = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOwed: number;
};

export type OpenHouseDTO = {
  id: string;
  date: string; // yyyy-mm-dd
  startTime: string;
  endTime: string;
  notes: string | null;
  visitors: OpenHouseVisitorDTO[];
};
