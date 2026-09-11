import { NextRequest, NextResponse } from "next/server";
import { assertFullMarketDataAccess } from "@/lib/market-access";

type NewsItem = {
  title: string;
  source: string | null;
  url: string;
  publishedAt: string | null;
};

const MAX_ITEMS = 4;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tagValue(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() || null : null;
}

function parseNewsRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const seen = new Set<string>();
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    let title = tagValue(block, "title");
    const url = tagValue(block, "link");
    if (!title || !url || seen.has(title)) continue;

    let source = tagValue(block, "source");
    if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(` - ${source}`).length).trim();
    } else if (!source && title.includes(" - ")) {
      const parts = title.split(" - ");
      source = parts.pop()?.trim() || null;
      title = parts.join(" - ").trim();
    }

    seen.add(title);
    const published = tagValue(block, "pubDate");
    const publishedDate = published ? new Date(published) : null;
    items.push({
      title,
      source,
      url,
      publishedAt: publishedDate && !Number.isNaN(publishedDate.getTime())
        ? publishedDate.toISOString()
        : null,
    });
    if (items.length >= MAX_ITEMS) break;
  }
  return items;
}

function safeContext(value: string | null): string {
  return (value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

async function fetchNews(query: string, locale: string): Promise<NewsItem[]> {
  const isHebrew = locale === "he";
  const params = new URLSearchParams({
    q: `${query} when:7d`,
    hl: isHebrew ? "he" : "en-US",
    gl: isHebrew ? "IL" : "US",
    ceid: isHebrew ? "IL:he" : "US:en",
  });
  const response = await fetch(`https://news.google.com/rss/search?${params}`, {
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(10_000),
    headers: { "User-Agent": "StockScanner/1.0" },
  });
  if (!response.ok) throw new Error(`News feed returned ${response.status}`);
  return parseNewsRss(await response.text());
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const gate = await assertFullMarketDataAccess();
  if (!gate.allowed) return gate.response;

  const { ticker } = await params;
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!/^[A-Z0-9.-]{1,20}$/.test(normalizedTicker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }

  const company = safeContext(request.nextUrl.searchParams.get("company"));
  const sector = safeContext(request.nextUrl.searchParams.get("sector"));
  const industry = safeContext(request.nextUrl.searchParams.get("industry"));
  const locale = request.nextUrl.searchParams.get("market") === "TA" ? "he" : "en";
  const companyQuery = company ? `"${company}" OR ${normalizedTicker} stock` : `${normalizedTicker} stock`;
  const sectorQuery = industry
    ? `"${industry}" stocks industry`
    : sector
      ? `"${sector} sector" stocks market`
      : `${normalizedTicker} industry stocks`;

  const [companyResult, sectorResult] = await Promise.allSettled([
    fetchNews(companyQuery, locale),
    fetchNews(sectorQuery, locale),
  ]);

  return NextResponse.json(
    {
      company: companyResult.status === "fulfilled" ? companyResult.value : [],
      sector: sectorResult.status === "fulfilled" ? sectorResult.value : [],
    },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
