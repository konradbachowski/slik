const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,pln,eur";

export type FiatCurrency = "USD" | "PLN" | "EUR";

interface PriceCache {
  prices: Record<FiatCurrency, number>;
  fetchedAt: number;
}

let cache: PriceCache | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Fetch current SOL prices from CoinGecko.
 * Results are cached for 1 minute.
 *
 * When called with a specific currency, returns just that currency's price.
 * When called without arguments, returns all supported currencies.
 */
export async function getSolPrice(): Promise<Record<FiatCurrency, number>>;
export async function getSolPrice(currency: FiatCurrency): Promise<number>;
export async function getSolPrice(
  currency?: FiatCurrency
): Promise<number | Record<FiatCurrency, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return currency ? cache.prices[currency] : cache.prices;
  }

  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

    const data = await res.json();
    const prices: Record<FiatCurrency, number> = {
      USD: data.solana.usd,
      PLN: data.solana.pln,
      EUR: data.solana.eur,
    };

    cache = { prices, fetchedAt: Date.now() };
    return currency ? prices[currency] : prices;
  } catch (err) {
    console.error("[slik/price] Failed to fetch SOL price:", err);
    // Fallback prices if API fails
    if (cache) {
      return currency ? cache.prices[currency] : cache.prices;
    }
    const fallback: Record<FiatCurrency, number> = {
      USD: 140,
      PLN: 560,
      EUR: 130,
    };
    return currency ? fallback[currency] : fallback;
  }
}

/**
 * Convert a fiat amount to SOL using the given price table.
 */
export function fiatToSol(
  fiatAmount: number,
  currency: FiatCurrency,
  prices: Record<FiatCurrency, number>
): number {
  const solPrice = prices[currency];
  if (!solPrice || solPrice <= 0) return 0;
  return fiatAmount / solPrice;
}
