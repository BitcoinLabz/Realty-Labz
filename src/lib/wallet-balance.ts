import type { WalletNetwork } from "@/generated/prisma/enums";

// Free, public, no-API-key block explorer + price endpoints — see CLAUDE.md
// for why these were chosen (zero cost, no auth, generous enough rate limits
// for an on-demand "Refresh balance" button rather than live/scheduled polling).
const MEMPOOL_SPACE_URL = "https://mempool.space/api/address";
const HIRO_STACKS_URL = "https://api.hiro.so/extended/v1/address";
const COINGECKO_PRICE_URL = "https://api.coingecko.com/api/v3/simple/price";

// CoinGecko's price-lookup id for STX is the historical project name, not "stacks".
const COINGECKO_IDS: Record<WalletNetwork, string> = {
  BITCOIN: "bitcoin",
  STACKS: "blockstack",
};

export class WalletBalanceError extends Error {}

async function fetchBitcoinBalance(address: string): Promise<number> {
  const res = await fetch(`${MEMPOOL_SPACE_URL}/${encodeURIComponent(address)}`);
  if (!res.ok) {
    throw new WalletBalanceError(
      res.status === 400 || res.status === 404
        ? "That doesn't look like a valid Bitcoin address."
        : "Couldn't reach the Bitcoin network right now. Try again shortly.",
    );
  }
  const data = await res.json();
  const satoshis =
    Number(data.chain_stats.funded_txo_sum) - Number(data.chain_stats.spent_txo_sum);
  return satoshis / 1e8;
}

async function fetchStacksBalance(address: string): Promise<number> {
  const res = await fetch(`${HIRO_STACKS_URL}/${encodeURIComponent(address)}/balances`);
  if (!res.ok) {
    throw new WalletBalanceError(
      res.status === 400 || res.status === 404
        ? "That doesn't look like a valid Stacks address."
        : "Couldn't reach the Stacks network right now. Try again shortly.",
    );
  }
  const data = await res.json();
  const microStx = Number(data.stx.balance);
  return microStx / 1e6;
}

async function fetchUsdPrice(network: WalletNetwork): Promise<number> {
  const id = COINGECKO_IDS[network];
  const res = await fetch(`${COINGECKO_PRICE_URL}?ids=${id}&vs_currencies=usd`);
  if (!res.ok) {
    throw new WalletBalanceError("Couldn't fetch a current price. Try again shortly.");
  }
  const data = await res.json();
  const price = data[id]?.usd;
  if (typeof price !== "number") {
    throw new WalletBalanceError("Couldn't fetch a current price. Try again shortly.");
  }
  return price;
}

export async function fetchWalletBalanceUsd(
  network: WalletNetwork,
  address: string,
): Promise<{ balance: number; usdValue: number }> {
  const [balance, price] = await Promise.all([
    network === "BITCOIN" ? fetchBitcoinBalance(address) : fetchStacksBalance(address),
    fetchUsdPrice(network),
  ]);

  return { balance, usdValue: balance * price };
}
