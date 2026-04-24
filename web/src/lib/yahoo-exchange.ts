/** Map Yahoo chart meta exchange codes to TradingView symbol prefixes. */
export function mapYahooCodeToTradingViewExchange(
  code: string | undefined | null
): string | null {
  if (!code || typeof code !== "string") return null;
  const u = code.trim().toUpperCase();
  const table: Record<string, string> = {
    NYQ: "NYSE",
    NYSE: "NYSE",
    PCX: "NYSE",
    NMS: "NASDAQ",
    NASDAQ: "NASDAQ",
    NCM: "NASDAQ",
    NGM: "NASDAQ",
    NGS: "NASDAQ",
    NASDAQGS: "NASDAQ",
    NASDAQGM: "NASDAQ",
    NASDAQCM: "NASDAQ",
    ASE: "AMEX",
    AMEX: "AMEX",
    NYSEAMERICAN: "AMEX",
    BTS: "BATS",
    BATS: "BATS",
    BZX: "BATS",
    CXI: "AMEX",
    TLV: "TASE",
    TASE: "TASE",
    TA: "TASE",
  };
  const mapped = table[u];
  if (mapped) return mapped;
  if (u.includes("NASDAQ")) return "NASDAQ";
  if (u.includes("NYSE")) return "NYSE";
  if (u.includes("AMEX") || u.includes("NYSE AMERICAN")) return "AMEX";
  return null;
}

export async function fetchListingExchangeFromYahoo(
  ticker: string
): Promise<string | null> {
  const q = ticker.toUpperCase().replace(/\./g, "-");
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(q)}?range=5d&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StockScanner/1.0)",
        Accept: "application/json",
      },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const j: unknown = await res.json();
    const meta = (j as { chart?: { result?: { meta?: Record<string, unknown> }[] } })
      ?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    let mic: string | undefined;
    if (typeof meta.exchangeName === "string") mic = meta.exchangeName;
    else if (typeof meta.exchange === "string") mic = meta.exchange;
    else if (typeof meta.fullExchangeName === "string") {
      mic = meta.fullExchangeName;
    }
    return mapYahooCodeToTradingViewExchange(mic ?? null);
  } catch {
    return null;
  }
}
