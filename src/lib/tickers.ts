export type KnownTicker = {
  ticker: string;
  name: string;
  aliases: string[];
  exchange?: string;
};

export const KNOWN_TICKERS: KnownTicker[] = [
  { ticker: "CART", name: "Maplebear", aliases: ["Instacart", "Maplebear Inc"] },
  { ticker: "UBER", name: "Uber Technologies", aliases: ["Uber"] },
  { ticker: "GOOGL", name: "Alphabet", aliases: ["Google", "GOOG"] },
  { ticker: "ON", name: "ON Semiconductor", aliases: ["onsemi", "ON Semi"] },
  { ticker: "NVTS", name: "Navitas Semiconductor", aliases: ["Navitas"] },
  { ticker: "POWI", name: "Power Integrations", aliases: ["Power Integrations"] },
  { ticker: "RL", name: "Ralph Lauren", aliases: ["Ralph Lauren"] },
  { ticker: "ABNB", name: "Airbnb", aliases: ["Airbnb"] },
  { ticker: "PINS", name: "Pinterest", aliases: ["Pinterest"] },
  { ticker: "CAVA", name: "CAVA Group", aliases: ["CAVA"] },
  { ticker: "DUOL", name: "Duolingo", aliases: ["Duolingo"] },
  { ticker: "NAVI", name: "Navient", aliases: ["Navient"] },
  { ticker: "AMZN", name: "Amazon", aliases: ["Amazon.com"] },
  { ticker: "META", name: "Meta Platforms", aliases: ["Facebook", "Instagram"] },
  { ticker: "AAPL", name: "Apple", aliases: ["Apple"] },
  { ticker: "MSFT", name: "Microsoft", aliases: ["Microsoft"] },
  { ticker: "TSLA", name: "Tesla", aliases: ["Tesla"] },
  { ticker: "NFLX", name: "Netflix", aliases: ["Netflix"] },
  { ticker: "SHOP", name: "Shopify", aliases: ["Shopify"] },
  { ticker: "MELI", name: "MercadoLibre", aliases: ["Mercado Libre"] },
];

const byTicker = new Map(KNOWN_TICKERS.map((item) => [item.ticker, item]));

export function lookupTicker(ticker: string): KnownTicker | undefined {
  return byTicker.get(ticker.trim().toUpperCase());
}

const AMBIGUOUS_SHORT_TICKERS = new Set(["ON", "OR", "IT", "ALL", "A", "T", "C", "F", "GM", "SO"]);

export function isAmbiguousTickerToken(ticker: string): boolean {
  return AMBIGUOUS_SHORT_TICKERS.has(ticker.toUpperCase()) || ticker.length <= 2;
}
