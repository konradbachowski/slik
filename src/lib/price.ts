export type FiatCurrency = "USD" | "PLN" | "EUR";

interface PriceCache {
  prices: Record<FiatCurrency, number>;
  fetchedAt: number;
}

let cache: PriceCache | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// Price providers (tried in order, first success wins)
// ---------------------------------------------------------------------------

async function fetchCoinGecko(): Promise<Record<FiatCurrency, number>> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd,pln,eur",
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const data = await res.json();
  return { USD: data.solana.usd, PLN: data.solana.pln, EUR: data.solana.eur };
}

async function fetchBinance(): Promise<Record<FiatCurrency, number>> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT"
  );
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const data = await res.json();
  const usd = parseFloat(data.price);
  if (!usd || usd <= 0) throw new Error("Binance returned invalid price");
  // Approximate PLN/EUR from USD using typical ratios
  // These get overwritten next time CoinGecko works, so rough is fine
  const plnRate = cache?.prices.PLN && cache?.prices.USD
    ? cache.prices.PLN / cache.prices.USD
    : 4.0;
  const eurRate = cache?.prices.EUR && cache?.prices.USD
    ? cache.prices.EUR / cache.prices.USD
    : 0.92;
  return { USD: usd, PLN: usd * plnRate, EUR: usd * eurRate };
}

async function fetchKraken(): Promise<Record<FiatCurrency, number>> {
  const res = await fetch(
    "https://api.kraken.com/0/public/Ticker?pair=SOLUSD"
  );
  if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
  const data = await res.json();
  if (data.error?.length) throw new Error(`Kraken: ${data.error[0]}`);
  const usd = parseFloat(data.result.SOLUSD.c[0]);
  if (!usd || usd <= 0) throw new Error("Kraken returned invalid price");
  const plnRate = cache?.prices.PLN && cache?.prices.USD
    ? cache.prices.PLN / cache.prices.USD
    : 4.0;
  const eurRate = cache?.prices.EUR && cache?.prices.USD
    ? cache.prices.EUR / cache.prices.USD
    : 0.92;
  return { USD: usd, PLN: usd * plnRate, EUR: usd * eurRate };
}

const providers: Array<{ name: string; fn: () => Promise<Record<FiatCurrency, number>> }> = [
  { name: "CoinGecko", fn: fetchCoinGecko },
  { name: "Binance", fn: fetchBinance },
  { name: "Kraken", fn: fetchKraken },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getSolPrice(): Promise<Record<FiatCurrency, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.prices;
  }

  for (const provider of providers) {
    try {
      const prices = await provider.fn();
      cache = { prices, fetchedAt: Date.now() };
      return prices;
    } catch (err) {
      console.warn(`[price] ${provider.name} failed:`, err);
    }
  }

  // All providers failed — use stale cache or hardcoded fallback
  console.error("[price] All providers failed");
  if (cache) return cache.prices;
  return { USD: 140, PLN: 560, EUR: 130 };
}

export function fiatToSol(
  fiatAmount: number,
  currency: FiatCurrency,
  prices: Record<FiatCurrency, number>
): number {
  const solPrice = prices[currency];
  if (!solPrice || solPrice <= 0) return 0;
  return fiatAmount / solPrice;
}
