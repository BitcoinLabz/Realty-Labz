export type AssetType = "STOCKS" | "RETIREMENT" | "REAL_ESTATE" | "CRYPTO" | "SAVINGS" | "OTHER";

export type AssetDTO = {
  id: string;
  name: string;
  type: AssetType;
  currentValue: number;
  notes: string | null;
  updatedAt: string; // ISO
};
