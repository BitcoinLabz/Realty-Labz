export type AssetType = "STOCKS" | "RETIREMENT" | "REAL_ESTATE" | "CRYPTO" | "SAVINGS" | "OTHER";
export type WalletNetwork = "BITCOIN" | "STACKS";

export type AssetDTO = {
  id: string;
  name: string;
  type: AssetType;
  currentValue: number;
  notes: string | null;
  walletNetwork: WalletNetwork | null;
  walletAddress: string | null;
  walletBalance: number | null;
  walletBalanceCheckedAt: string | null; // ISO
  updatedAt: string; // ISO
};
