export function formatTickerPrice(ticker: string, price: number): string {
  return `${ticker} $${price.toFixed(2)}`;
}

export function formatCapturePrice(ticker: string, price: number): string {
  return `${formatTickerPrice(ticker, price)} at capture`;
}

export function formatQuotePrice(price: number, currency = "USD"): string {
  if (currency === "USD") return `$${price.toFixed(2)}`;
  return `${price.toFixed(2)} ${currency}`;
}

export function percentChange(current: number, baseline: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}
