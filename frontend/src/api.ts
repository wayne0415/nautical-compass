import type { MarketDataResponse, PortfolioResponse, PositionsState } from "./types";

const BASE = "http://localhost:8000";

export async function getMarketData(force = false): Promise<MarketDataResponse> {
  const url = force ? `${BASE}/api/market-data?force=true` : `${BASE}/api/market-data`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`market-data failed: ${res.status}`);
  }
  return res.json();
}

export async function postPortfolio(
  positions: PositionsState,
  cash: number
): Promise<PortfolioResponse> {
  const payload: { positions: Record<string, { shares: number; parking_days: number }>; cash: number } = {
    positions: {},
    cash,
  };
  for (const [ticker, inp] of Object.entries(positions)) {
    if (ticker === "CASH") continue;
    payload.positions[ticker] = {
      shares: Number(inp.shares) || 0,
      parking_days: Number(inp.parkingDays) || 0,
    };
  }
  const res = await fetch(`${BASE}/api/portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`portfolio failed: ${res.status}`);
  }
  return res.json();
}
