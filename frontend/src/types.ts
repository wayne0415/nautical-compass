export interface BenchmarkData {
  price: number;
  dma200: number;
  sigma: number;
  regime: "green" | "red";
}

export interface MarketDataResponse {
  benchmarks: Record<string, BenchmarkData>;
  prices: Record<string, number>;
  stale: boolean;
  cached: boolean;
  error: string | null;
  fetched_at: number; // 最後一次成功抓取的 epoch 秒
}

export interface AssetResult {
  ticker: string;
  series: string;
  horsepower: number;
  L: number;
  shares: number;
  price: number;
  market_value: number;
  weight: number;
  sigma_source: number;
  annual_drag: number;
  monthly_drag: number;
  parking_days: number;
  below_200dma: boolean;
  parking_over_limit: boolean;
  knife_catch_breach: boolean;
}

export interface PortfolioResponse {
  total_assets: number;
  total_speed: number;
  portfolio_monthly_drag: number;
  assets: AssetResult[];
  benchmarks: Record<string, BenchmarkData>;
  series_leveraged_weight: Record<string, number>;
  stale: boolean;
  fetched_at: number; // 最後一次成功抓取的 epoch 秒
  thresholds: {
    sigma_high: number;
    parking_max: number;
    knife_catch_limit: number;
  };
}

// 前端輸入狀態
export interface PositionInput {
  shares: string; // 用字串避免受控 input 的 NaN 問題
  parkingDays: string;
}

export type PositionsState = Record<string, PositionInput>;
