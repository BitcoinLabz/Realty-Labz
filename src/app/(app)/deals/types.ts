export type DealSide = "BUYER" | "SELLER" | "DUAL";
export type DealStatus = "ACTIVE" | "UNDER_CONTRACT" | "PENDING" | "CLOSED" | "FELL_THROUGH";

export type DealDTO = {
  id: string;
  side: DealSide;
  status: DealStatus;
  propertyAddress: string;
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
