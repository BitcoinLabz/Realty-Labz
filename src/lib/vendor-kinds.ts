// Plain data, no "use client": imported from both server and client code
// (the same reason transaction-categories.ts and client-categories.ts exist).
export const VENDOR_KIND_LABELS: Record<string, string> = {
  TITLE: "Title company",
  LENDER: "Lender",
  INSPECTOR: "Inspector",
  APPRAISER: "Appraiser",
  SIGNS: "Signs",
  OTHER: "Other",
};

export const DEAL_SIDE_SHORT: Record<string, string> = {
  BUYER: "Buyer",
  SELLER: "Listing",
  DUAL: "Dual",
  TENANT: "Tenant",
  LANDLORD: "Landlord",
};
