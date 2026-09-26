"""Deterministic, Hebrew-first market-news aggregation from public sources."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from xml.etree import ElementTree

import requests

from .tickers import NAMES, identify, explicit_names

log = logging.getLogger(__name__)
UTC = timezone.utc
WINDOW_HOURS = 30
REQUEST_TIMEOUT = 8
REQUEST_RETRIES = 2
CACHE_SECONDS = 15 * 60
MAX_ITEMS = 12
MIN_ITEMS = 8
PRIORITY = {'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA',
            'AMD', 'AVGO', 'INTC', 'MU'}
TRACKING_KEYS = {'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid', 'ref', 'referrer'}
STOPWORDS = set('של על עם את אל גם או כי זה זו היה היו היא הוא מן אם אך לא כל בין לאחר לפני בעקבות לקראת היום'.split())
STOPWORDS |= set('the a an and or of to in on for as at by with from its stock stocks shares market markets today news'.split())
HEBREW_RE = re.compile(r'[\u0590-\u05ff]')
SPONSORED_RE = re.compile(r'תוכן\s*ממומן|בשיתוף|sponsored|partner content', re.I)
EXCLUDED_RE = re.compile(r'נדל[״"]ן|משכנת|צרכנות|לייף.?סטייל|מתכון|פורום|personal finance', re.I)
LOW_VALUE_RE = re.compile(r'פיקדון|עו[״"]ש|כרטיס אשראי|משקפיים רגילים|watchOS|iPhone|מחיר מטורף|\bhow to\b|\bbest stocks?\b|stocks? to buy|מניות שכדאי', re.I)
FOREIGN_MARKET_RE = re.compile(r'אסיה|ניקיי|האנג סנג|Kospi|Nifty|Sensex|FTSE|DAX|CAC 40|שווייץ|ברזיל|וייטנאם|יפן|גרמניה', re.I)
CLICKBAIT_RE = re.compile(r'מה עושים|למה (?:הוא|היא)|לא תאמינו|האם כדאי|\?$|הסוד|מטורף', re.I)
CATALYST_RE = re.compile(r'דוחות|דו[״"]ח|earnings|guidance|תחזית|הכנסות|רווח|מיזוג|רכישה|עסקה|חוזה|השקעה|שבבים|מפעל|פיטורים|אישור|FDA|antitrust|מכסים|מעלה|מוריד|קיצוץ|מכפיל|השקה', re.I)
GOOGLE_SOURCE_RE = re.compile(r'Reuters|CNBC|Bloomberg|Associated Press|\bAP\b|WSJ|Wall Street Journal|Financial Times|MarketWatch|Yahoo Finance|Investing\.com|Barron|גלובס|ביזפורטל|כלכליסט|TheMarker|ספונסר|Sponser', re.I)
MACRO_RE = re.compile(r'Fed|Federal Reserve|פד|ריבית|אינפלציה|CPI|PCE|תעסוקה|אג[״"]ח|תשוא|מכסים|נפט|WTI', re.I)
EARNINGS_RE = re.compile(r'earnings|guidance|דוחות|דו[״"]ח|תחזית|הכנסות|רווח', re.I)
MARKET_RE = re.compile(r'Wall Street|וול סטריט|Nasdaq|נאסד[״"]ק|S&P|דאו|Dow Jones|מדדים', re.I)
CRYPTO_RE = re.compile(r'Bitcoin|Ethereum|Crypto|ביטקוין|אתריום|קריפטו', re.I)
ISRAEL_RE = re.compile(r'ישראל|תל אביב|ת[״”"]א|הבורסה(?: המקומית)?|חברות ביטוח|בורסה בתל אביב', re.I)
_cache: dict[str, tuple[float, bytes]] = {}

GOOGLE_FEEDS = [
    ('market', '"וול סטריט" when:1d'),
    ('market', '(Nasdaq OR "S&P 500" OR "Dow Jones") when:1d'),
    ('macro', '(Fed OR פד OR ריבית OR אינפלציה) when:1d'),
    ('earnings', '(earnings OR דוחות) (מניות OR "Wall Street") when:1d'),
    ('company', '(Nvidia OR AMD OR Intel OR Microsoft OR Apple OR Amazon OR Meta OR Tesla) when:1d'),
]
SPONSER_FEEDS = [
    ('company', 'https://www.sponser.co.il/Content_rss_articles.aspx?CatId=5'),
    ('israel', 'https://www.sponser.co.il/Content_rss_articles.aspx?CatId=7'),
    ('macro', 'https://www.sponser.co.il/Content_rss_articles.aspx?CatId=6'),
]
SOURCE_TIER = {
    'SEC': 18, 'Nasdaq Trader': 18, 'Reuters': 16, 'CNBC': 16,
    'Bloomberg': 16, 'Associated Press': 15, 'AP': 15, 'WSJ': 15,
    'Bizportal': 13, 'גלובס': 13, 'כלכליסט': 13, 'TheMarker': 13,
    'Sponser': 12,
}


def safe_url(value):
    parsed = urlparse(value or '')
    return value if parsed.scheme in {'https', 'http'} and parsed.netloc else ''


def canonical_url(value):
    value = safe_url(value)
    if not value:
        return ''
    parsed = urlparse(value)
    query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
             if not k.lower().startswith('utm_') and k.lower() not in TRACKING_KEYS]
    host = parsed.netloc.lower().removeprefix('www.')
    path = re.sub(r'/+', '/', parsed.path).rstrip('/') or '/'
    return urlunparse((parsed.scheme.lower(), host, path, '', urlencode(query), ''))


def plain(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', value or ''))).strip()


def compact_title(value, source=''):
    title = plain(value)
    suffix = ' - ' + source
    if source and title.casefold().endswith(suffix.casefold()):
        title = title[:-len(suffix)]
    return title.strip(' -–—')[:600]


def parse_date(value):
    if not value:
        return None
    try:
        date = parsedate_to_datetime(value)
    except (ValueError, TypeError, OverflowError):
        try:
            date = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except (ValueError, TypeError):
            return None
    return date.astimezone(UTC) if date.tzinfo else None


def language_of(text):
    letters = re.findall(r'[A-Za-z\u0590-\u05ff]', text or '')
    if not letters:
        return 'en'
    return 'he' if sum(bool(HEBREW_RE.match(c)) for c in letters) / len(letters) >= .25 else 'en'


def infer_category(text, fallback='company'):
    if ISRAEL_RE.search(text):
        return 'israel'
    if CRYPTO_RE.search(text):
        return 'crypto'
    if MACRO_RE.search(text):
        return 'macro'
    if EARNINGS_RE.search(text):
        return 'earnings'
    if MARKET_RE.search(text):
        return 'market'
    return fallback


def _request(url, *, params=None, headers=None):
    key = url + '?' + urlencode(sorted((params or {}).items()))
    cached = _cache.get(key)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]
    last = None
    for attempt in range(REQUEST_RETRIES + 1):
        try:
            response = requests.get(url, params=params, headers=headers, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            _cache[key] = (time.monotonic(), response.content)
            return response.content
        except requests.RequestException as exc:
            last = exc
            if attempt < REQUEST_RETRIES:
                time.sleep(.25 * (attempt + 1))
    raise last


def _source_text(item, name):
    node = item.find(name)
    return plain(node.text if node is not None else '')


def parse_rss(content, category, cutoff, provider='rss', default_source='RSS'):
    root = ElementTree.fromstring(content)
    nodes = root.findall('./channel/item') or root.findall('.//{*}entry')
    items = []
    start = cutoff - timedelta(hours=WINDOW_HOURS)
    for node in nodes:
        date = parse_date(_source_text(node, 'pubDate') or _source_text(node, '{*}published')
                          or _source_text(node, '{*}updated'))
        if date is None or not start <= date <= cutoff:
            continue
        link = _source_text(node, 'link')
        if not link:
            link_node = node.find('{*}link')
            link = link_node.get('href', '') if link_node is not None else ''
        url = safe_url(link)
        source_node = node.find('source')
        source = plain(source_node.text if source_node is not None else '') or default_source
        source_url = safe_url(source_node.get('url', '')) if source_node is not None else ''
        title = compact_title(_source_text(node, 'title') or _source_text(node, '{*}title'), source)
        description = _source_text(node, 'description') or _source_text(node, '{*}summary')
        if not title or not url or SPONSORED_RE.search(title) or EXCLUDED_RE.search(title):
            continue
        actual_category = infer_category(title + ' ' + description, category)
        market = 'IL' if actual_category == 'israel' else ('GLOBAL' if actual_category == 'crypto' else 'US')
        items.append(dict(title=title, text=description[:1200], url=url, source=source,
                          source_url=source_url, published_at=date.isoformat(), category=actual_category,
                          language=language_of(title), market=market, provider=provider, kind='headline'))
    return items


class NewsProvider:
    id = 'provider'
    def fetch(self, cutoff):
        raise NotImplementedError


class GoogleNewsHebrewProvider(NewsProvider):
    id = 'google-news-he'
    def fetch(self, cutoff):
        items = []
        for category, query in GOOGLE_FEEDS:
            content = _request('https://news.google.com/rss/search', params={
                'q': query, 'hl': 'he', 'gl': 'IL', 'ceid': 'IL:he'})
            items.extend(parse_rss(content, category, cutoff, self.id, 'Google News'))
        return items


class SponserProvider(NewsProvider):
    id = 'sponser'
    def fetch(self, cutoff):
        items = []
        for category, url in SPONSER_FEEDS:
            items.extend(parse_rss(_request(url), category, cutoff, self.id, 'Sponser'))
        return items


class _LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self._href, self._text = [], '', []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self._href, self._text = dict(attrs).get('href', ''), []
    def handle_data(self, data):
        if self._href:
            self._text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self._href:
            title = plain(' '.join(self._text))
            if title:
                self.links.append((self._href, title))
            self._href, self._text = '', []


class BizportalProvider(NewsProvider):
    """Metadata-only fallback isolated from the rest of the pipeline."""
    id = 'bizportal'
    url = 'https://www.bizportal.co.il/wallstreet'
    def fetch(self, cutoff):
        html = _request(self.url).decode('utf-8', errors='ignore')
        items = []
        blocks = re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
                            html, flags=re.I | re.S)
        def walk(value):
            if isinstance(value, list):
                for child in value:
                    yield from walk(child)
            elif isinstance(value, dict):
                if value.get('@type') in {'NewsArticle', 'Article'}:
                    yield value
                for child in value.values():
                    if isinstance(child, (list, dict)):
                        yield from walk(child)
        for block in blocks:
            try:
                records = walk(json.loads(unescape(block)))
            except (ValueError, TypeError):
                continue
            for record in records:
                title = compact_title(record.get('headline', ''), 'Bizportal')
                raw_url = record.get('url', '')
                if isinstance(record.get('mainEntityOfPage'), str) and not raw_url:
                    raw_url = record['mainEntityOfPage']
                url = safe_url(urljoin(self.url, raw_url))
                published = parse_date(record.get('datePublished'))
                if (not title or not url or published is None
                        or not cutoff - timedelta(hours=WINDOW_HOURS) <= published <= cutoff
                        or SPONSORED_RE.search(title) or EXCLUDED_RE.search(title)):
                    continue
                items.append(dict(title=title, text='', url=url, source='Bizportal', source_url=self.url,
                                  published_at=published.isoformat(), category=infer_category(title),
                                  language=language_of(title), market='US', provider=self.id, kind='headline'))
        return items[:20]


class SecProvider(NewsProvider):
    id = 'sec'
    url = 'https://www.sec.gov/cgi-bin/browse-edgar'
    def fetch(self, cutoff):
        agent = os.getenv('SEC_USER_AGENT', 'stock-scanner/1.0 kfiradler@users.noreply.github.com')
        content = _request(self.url, params={
            'action': 'getcurrent', 'type': '8-k', 'count': '40', 'output': 'atom'},
            headers={'User-Agent': agent, 'Accept-Encoding': 'gzip, deflate'})
        return parse_rss(content, 'regulatory', cutoff, self.id, 'SEC')


class NasdaqTraderProvider(NewsProvider):
    id = 'nasdaq-trader'
    url = 'https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts'
    def fetch(self, cutoff):
        return parse_rss(_request(self.url), 'regulatory', cutoff, self.id, 'Nasdaq Trader')


PROVIDERS = [GoogleNewsHebrewProvider(), SponserProvider(), BizportalProvider(),
             SecProvider(), NasdaqTraderProvider()]


def collect_rss(cutoff):
    all_items, warnings = [], []
    with ThreadPoolExecutor(max_workers=len(PROVIDERS)) as pool:
        futures = {pool.submit(provider.fetch, cutoff): provider for provider in PROVIDERS}
        for future in as_completed(futures):
            provider = futures[future]
            try:
                items = future.result()
                all_items.extend(items)
                log.info('[news] %s: %d items', provider.id, len(items))
            except Exception as exc:
                log.warning('[news] %s failed (%s)', provider.id, type(exc).__name__)
                warnings.append('מקור חדשות לא זמין: ' + provider.id)
    return all_items, warnings


def collect_x(cutoff):
    return [], []


def _title_tokens(title):
    tokens = set(re.findall(r'[a-z0-9\u0590-\u05ff]+', title.casefold().replace('$', ''))) - STOPWORDS
    aliases = {'אנבידיה': 'nvda', 'נבידיה': 'nvda', 'טסלה': 'tsla', 'אפל': 'aapl',
               'מיקרוסופט': 'msft', 'אמזון': 'amzn', 'גוגל': 'googl', 'אלפבית': 'googl',
               'מטא': 'meta', 'אינטל': 'intc', 'ברודקום': 'avgo', 'מיקרון': 'mu'}
    return {aliases.get(token, token) for token in tokens}


def _similar(left, right):
    a, b = _title_tokens(left), _title_tokens(right)
    if not a or not b:
        return False
    overlap = len(a & b)
    return (overlap / len(a | b) >= .55
            or overlap / min(len(a), len(b)) >= .68)


def _same_event(left, right):
    if _similar(left['title'], right['title']):
        return True
    a, b = _title_tokens(left['title']), _title_tokens(right['title'])
    shared_tickers = set(left.get('tickers', [])) & set(right.get('tickers', []))
    # Paraphrased headlines about the same company still need two meaningful
    # shared event terms; ticker overlap alone would merge unrelated stories.
    return bool(shared_tickers and len(a & b) >= 2
                and len(a & b) / min(len(a), len(b)) >= .5
                and left.get('category') == right.get('category'))


def _representative_quality(item):
    tokens = _title_tokens(item['title'])
    return (24 if item['language'] == 'he' else 0) + SOURCE_TIER.get(item['source'], 0) + min(18, len(tokens) * 2) \
        + min(8, len(item['title']) // 18) + (4 if item.get('text') else 0) \
        + (4 if item.get('tickers') else 0) - (8 if '?' in item['title'] else 0)


def _ticker_tags(item, catalog):
    title = item['title']
    companies = identify(title, catalog)
    for ticker, names in explicit_names(title).items():
        companies.setdefault(ticker, []).extend(names)
    explicit = [a or b for a, b in re.findall(
        r'\$([A-Z]{1,6}(?:\.[A-Z])?)\b|(?:NASDAQ|NYSE):\s*([A-Z]{1,6}(?:\.[A-Z])?)\b', title)]
    return list(dict.fromkeys(explicit + list(companies))), companies


def _score(item, cutoff, cluster_size=1):
    age = (cutoff - datetime.fromisoformat(item['published_at'])).total_seconds() / 3600
    freshness = 30 if age < 2 else 24 if age < 6 else 16 if age < 12 else 8 if age <= 24 else -20
    source = next((score for name, score in SOURCE_TIER.items() if name.casefold() in item['source'].casefold()), 5)
    category = {'macro': 14, 'earnings': 12, 'market': 10, 'regulatory': 10,
                'company': 7, 'crypto': 4, 'israel': 3}.get(item['category'], 0)
    return (freshness + source + category + (8 if item['language'] == 'he' else 0)
            + (15 if item['tickers'] else 0) + (8 if set(item['tickers']) & PRIORITY else 0)
            + (12 if cluster_size > 1 else 0))


def prepare(items, catalog=None, cutoff=None):
    catalog = catalog if catalog is not None else NAMES
    cutoff = cutoff or datetime.now(UTC)
    enriched = []
    for raw in items:
        item = dict(raw)
        item.setdefault('language', language_of(item['title']))
        item.setdefault('market', 'US')
        item.setdefault('provider', 'legacy')
        item.setdefault('source_url', '')
        item.setdefault('kind', 'headline')
        item['url'] = canonical_url(item.get('url', ''))
        if (not item['url'] or SPONSORED_RE.search(item['title'])
                or EXCLUDED_RE.search(item['title']) or LOW_VALUE_RE.search(item['title'])
                or FOREIGN_MARKET_RE.search(item['title']) or CLICKBAIT_RE.search(item['title'])):
            continue
        item['tickers'], item['company_names'] = _ticker_tags(item, catalog)
        item['category'] = infer_category(item['title'] + ' ' + item.get('text', ''), item.get('category', 'company'))
        if item['provider'] == 'google-news-he' and not GOOGLE_SOURCE_RE.search(item['source']):
            continue
        if item['tickers'] and item['category'] == 'market':
            item['category'] = 'earnings' if EARNINGS_RE.search(item['title']) else 'company'
        enriched.append(item)

    clusters = []
    for item in sorted(enriched, key=lambda row: row['published_at'], reverse=True):
        date = datetime.fromisoformat(item['published_at'])
        cluster = next((c for c in clusters if item['url'] == c[0]['url'] or (
            abs((date - datetime.fromisoformat(c[0]['published_at'])).total_seconds()) <= 12 * 3600
            and _same_event(item, c[0]))), None)
        if cluster is None:
            clusters.append([item])
        else:
            cluster.append(item)

    representatives = []
    for cluster in clusters:
        cluster.sort(key=lambda row: (-_representative_quality(row),
                                      -datetime.fromisoformat(row['published_at']).timestamp()))
        chosen = dict(cluster[0])
        chosen['cluster_size'] = len({row['source'] for row in cluster})
        chosen['score'] = _score(chosen, cutoff, chosen['cluster_size'])
        chosen['id'] = hashlib.sha256((chosen['url'] or chosen['title']).encode()).hexdigest()[:16]
        representatives.append(chosen)
    log.info('[news] after dedupe: %d', len(representatives))

    representatives.sort(key=lambda row: (-row['score'], -datetime.fromisoformat(row['published_at']).timestamp()))
    selected, publishers, ticker_counts = [], {}, {}
    for item in representatives:
        if len(selected) >= MAX_ITEMS:
            break
        source_key = item['source'].casefold()
        if publishers.get(source_key, 0) >= 3:
            continue
        if item['category'] == 'israel' and sum(i['category'] == 'israel' for i in selected) >= 2:
            continue
        if any(ticker_counts.get(ticker, 0) >= 2 for ticker in item['tickers']):
            continue
        if item['category'] in {'company', 'earnings', 'regulatory'} and not item['tickers']:
            continue
        if item['category'] == 'company' and not CATALYST_RE.search(item['title']):
            continue
        if item['category'] == 'market' and not MARKET_RE.search(item['title']):
            continue
        if item['category'] == 'israel' and not (item['tickers'] or CATALYST_RE.search(item['title'])):
            continue
        if item['language'] == 'en' and sum(row['language'] == 'en' for row in selected) >= 2:
            continue
        publishers[source_key] = publishers.get(source_key, 0) + 1
        for ticker in item['tickers']:
            ticker_counts[ticker] = ticker_counts.get(ticker, 0) + 1
        selected.append(item)
    log.info('[news] selected: %d', len(selected))
    return selected


def collect_quotes():
    import yfinance as yf
    instruments = [('S&P 500', '^GSPC'), ('NASDAQ', '^IXIC'), ('DOW', '^DJI'),
                   ('WTI', 'CL=F'), ('BTC', 'BTC-USD'), ('US10Y', '^TNX')]
    def fetch(instrument):
        label, symbol = instrument
        try:
            frame = yf.Ticker(symbol).history(period='5d', interval='1d', auto_adjust=False)
            close = frame['Close'].dropna()
            if len(close) < 2:
                raise ValueError('missing quote')
            latest, previous = float(close.iloc[-1]), float(close.iloc[-2])
            return dict(label=label, symbol=symbol, value=round(latest, 2),
                        change=round((latest / previous - 1) * 100, 2),
                        session_date=str(close.index[-1].date()),
                        url='https://finance.yahoo.com/quote/' + symbol)
        except Exception:
            return dict(label=label, symbol=symbol, value=None, change=None, session_date='', url='')
    with ThreadPoolExecutor(max_workers=3) as pool:
        return list(pool.map(fetch, instruments))
