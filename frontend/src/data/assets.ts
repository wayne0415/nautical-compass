// 單一真相來源（鏡像後端 ASSETS）
// 鐵律：horsepower 只給「時速」用；L 只給「胎耗」用，永不混用。
// 命名防呆：半導體 2x ETF 內部 key 為 "USD"，顯示 "USD (ProShares Ultra Semis)"；
//           現金內部 key 為 "CASH"，顯示 "Cash"。兩者嚴禁共用。

export type Series = "sp500" | "nasdaq" | "semi" | "cash";

export interface AssetMeta {
  key: string;
  displayName: string;
  series: Series;
  horsepower: number; // 真實馬力（時速用）
  L: number; // 每日槓桿（胎耗用）∈ {0,1,2,3}
  sigmaSrc: string | null;
}

export const ASSETS: Record<string, AssetMeta> = {
  VOO: { key: "VOO", displayName: "VOO", series: "sp500", horsepower: 1.0, L: 1, sigmaSrc: "VOO" },
  SSO: { key: "SSO", displayName: "SSO", series: "sp500", horsepower: 2.0, L: 2, sigmaSrc: "VOO" },
  UPRO: { key: "UPRO", displayName: "UPRO", series: "sp500", horsepower: 3.0, L: 3, sigmaSrc: "VOO" },
  QQQ: { key: "QQQ", displayName: "QQQ", series: "nasdaq", horsepower: 1.2, L: 1, sigmaSrc: "QQQ" },
  QLD: { key: "QLD", displayName: "QLD", series: "nasdaq", horsepower: 2.4, L: 2, sigmaSrc: "QQQ" },
  TQQQ: { key: "TQQQ", displayName: "TQQQ", series: "nasdaq", horsepower: 3.6, L: 3, sigmaSrc: "QQQ" },
  SOXX: { key: "SOXX", displayName: "SOXX", series: "semi", horsepower: 1.5, L: 1, sigmaSrc: "SOXX" },
  USD: { key: "USD", displayName: "USD (ProShares Ultra Semis)", series: "semi", horsepower: 3.0, L: 2, sigmaSrc: "SOXX" },
  SOXL: { key: "SOXL", displayName: "SOXL", series: "semi", horsepower: 4.5, L: 3, sigmaSrc: "SOXX" },
  CASH: { key: "CASH", displayName: "Cash", series: "cash", horsepower: 0.0, L: 0, sigmaSrc: null },
};

export const SERIES_LABEL: Record<Series, string> = {
  sp500: "S&P 500",
  nasdaq: "Nasdaq 100",
  semi: "半導體",
  cash: "現金",
};

export const SERIES_BENCHMARK: Record<Series, string | null> = {
  sp500: "VOO",
  nasdaq: "QQQ",
  semi: "SOXX",
  cash: null,
};

// 依板塊分組（現金獨立）
export const SECTOR_GROUPS: { series: Series; tickers: string[] }[] = [
  { series: "sp500", tickers: ["VOO", "SSO", "UPRO"] },
  { series: "nasdaq", tickers: ["QQQ", "QLD", "TQQQ"] },
  { series: "semi", tickers: ["SOXX", "USD", "SOXL"] },
];

export const BENCHMARKS = ["VOO", "QQQ", "SOXX"] as const;
