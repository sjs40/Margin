export type PriceQuote = {
  ticker: string;
  price: number;
  currency: string;
  asOf: string;
  provider: "yahoo" | "stooq";
};

export type PriceProviderName = "yahoo" | "stooq" | "none";
