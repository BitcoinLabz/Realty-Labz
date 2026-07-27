// Free, public, no-API-key stock quote lookup — mirrors the crypto
// wallet-balance pattern in src/lib/wallet-balance.ts (fetch on add + a
// manual "Refresh" button, never polled/scheduled). Unlike the crypto
// lookups (mempool.space, Hiro, CoinGecko are all documented public APIs),
// there's no equivalent official free stock API — this uses Yahoo Finance's
// undocumented quote endpoint, which many hobby finance tools rely on. It
// could change or get blocked by Yahoo without notice; if that ever
// happens, this is the one file that needs to change.
const YAHOO_FINANCE_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

// A plain server-side fetch with no User-Agent gets rejected by Yahoo far
// more often than a browser-like one — this isn't optional politeness, it's
// the difference between this working and not.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export class StockPriceError extends Error {}

export async function fetchStockPricePerShare(ticker: string): Promise<number> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) {
    throw new StockPriceError("Enter a ticker symbol.");
  }

  const res = await fetch(`${YAHOO_FINANCE_CHART_URL}/${encodeURIComponent(symbol)}`, {
    headers: { "User-Agent": BROWSER_USER_AGENT },
  });

  if (!res.ok) {
    throw new StockPriceError(
      res.status === 404
        ? `Couldn't find a ticker called "${symbol}."`
        : "Couldn't fetch a current price right now. Try again shortly.",
    );
  }

  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number") {
    throw new StockPriceError(`Couldn't find a ticker called "${symbol}."`);
  }

  return price;
}

export async function fetchStockValueUsd(
  ticker: string,
  shareCount: number,
): Promise<{ pricePerShare: number; usdValue: number }> {
  const pricePerShare = await fetchStockPricePerShare(ticker);
  return { pricePerShare, usdValue: pricePerShare * shareCount };
}
