"""Bounded public RSS / optional X collection with strict publication windows."""
from __future__ import annotations

import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from urllib.parse import urlparse
from xml.etree import ElementTree

import requests
from .tickers import NAMES, identify, explicit_names

log = logging.getLogger(__name__)
UTC = timezone.utc
QUERIES = [
    ('market', 'US stock market (S&P OR Nasdaq OR futures)'),
    ('macro', '(Federal Reserve OR inflation OR treasury OR tariffs OR oil) market'),
    ('macro', '(geopolitics OR trade OR sanctions) US markets'),
    ('companies', '(Apple OR Microsoft OR Nvidia OR Amazon OR Meta OR Alphabet OR Tesla) stock'),
    ('companies', 'US stocks (earnings OR guidance OR merger OR acquisition)'),
    ('companies', 'US stocks (semiconductor OR biotech OR retail OR banking OR energy)'),
    ('week', '(economic calendar OR earnings calendar OR Federal Reserve) this week'),
]
PRIORITY = {'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'TSLA'}
ALIASES = {
    'AAPL': r'\bapple\b', 'MSFT': r'\bmicrosoft\b', 'NVDA': r'\bnvidia\b',
    'AMZN': r'\bamazon\b', 'META': r'\bmeta\b', 'GOOGL': r'\balphabet\b|\bgoogle\b',
    'TSLA': r'\btesla\b',
}


def safe_url(value):
    parsed = urlparse(value or '')
    return value if parsed.scheme in {'https', 'http'} and parsed.netloc else ''


def plain(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', value or ''))).strip()


def parse_date(value):
    try:
        date = parsedate_to_datetime(value)
        return date.astimezone(UTC) if date.tzinfo else None
    except (ValueError, TypeError, OverflowError):
        return None


def parse_rss(content, category, cutoff):
    root = ElementTree.fromstring(content)
    items = []
    for item in root.findall('./channel/item'):
        date = parse_date(item.findtext('pubDate'))
        if date is None or not cutoff - timedelta(hours=24) <= date <= cutoff:
            continue
        title, url = plain(item.findtext('title')), safe_url(item.findtext('link'))
        if not title or not url:
            continue
        source = plain(item.findtext('source')) or 'RSS'
        if title.endswith(' - ' + source):
            title = title[:-(len(source) + 3)]
        items.append(dict(title=title[:600], text=plain(item.findtext('description'))[:1200],
                          url=url, source=source, published_at=date.isoformat(),
                          category=category, kind='headline'))
    return items


def collect_rss(cutoff):
    def fetch(query):
        category, search = query
        try:
            response = requests.get('https://news.google.com/rss/search', params={
                'q': search + ' when:1d', 'hl': 'en-US', 'gl': 'US', 'ceid': 'US:en'
            }, timeout=20)
            response.raise_for_status()
            return parse_rss(response.content, category, cutoff)[:35], None
        except Exception as exc:
            log.warning('RSS category %s failed (%s)', category, type(exc).__name__)
            return [], 'מקור חדשות לא זמין: ' + category
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, QUERIES))
    return [item for items, _ in results for item in items], [w for _, w in results if w]


def collect_x(cutoff):
    token = os.getenv('X_BEARER_TOKEN', '')
    accounts = [s.strip().lstrip('@') for s in os.getenv('NEWS_X_ACCOUNTS', '').split(',') if s.strip()]
    if not token or not accounts:
        return [], []
    if len(accounts) > 15 or any(not re.fullmatch(r'[A-Za-z0-9_]{1,15}', a) for a in accounts):
        raise ValueError('NEWS_X_ACCOUNTS must contain up to 15 valid account names')
    params = {'query': '(' + ' OR '.join('from:' + a for a in accounts) + ') -is:retweet',
              'start_time': (cutoff - timedelta(hours=24)).isoformat().replace('+00:00', 'Z'),
              'end_time': (cutoff - timedelta(seconds=15)).isoformat().replace('+00:00', 'Z'),
              'max_results': 100, 'tweet.fields': 'created_at,author_id',
              'expansions': 'author_id', 'user.fields': 'username'}
    items, warnings = [], []
    try:
        for page in range(3):
            response = requests.get('https://api.x.com/2/tweets/search/recent', params=params,
                                    headers={'Authorization': 'Bearer ' + token}, timeout=25)
            if response.status_code != 200:
                raise RuntimeError('X HTTP ' + str(response.status_code))
            payload = response.json()
            users = {u['id']: u['username'] for u in payload.get('includes', {}).get('users', [])}
            for post in payload.get('data', []):
                date = datetime.fromisoformat(post['created_at'].replace('Z', '+00:00'))
                if not cutoff - timedelta(hours=24) <= date <= cutoff:
                    continue
                items.append(dict(title=post['text'][:600], text=post['text'][:1800],
                                  url='https://x.com/i/status/' + post['id'],
                                  source='X @' + users.get(post['author_id'], post['author_id']),
                                  published_at=date.isoformat(), category='companies', kind='social'))
            next_token = payload.get('meta', {}).get('next_token')
            if not next_token:
                break
            params['next_token'] = next_token
            if page == 2:
                warnings.append('מקורות X נדגמו עד 300 פרסומים; ייתכן שקיימים נוספים.')
    except Exception as exc:
        log.warning('X collection failed (%s)', type(exc).__name__)
        warnings.append('מקור X אינו זמין או שהגישה מוגבלת; הסקירה מבוססת על המקורות הזמינים.')
    return items, warnings


def prepare(items, catalog=None):
    catalog = catalog if catalog is not None else NAMES
    seen_urls, seen_titles, unique = set(), set(), []
    # Recent items win exact duplicates. Topic-level consolidation happens in the summary.
    for item in sorted(items, key=lambda i: i['published_at'], reverse=True):
        key = re.sub(r'\W+', '', item['title'].casefold())
        if key in seen_titles or item['url'] in seen_urls:
            continue
        seen_urls.add(item['url'])
        seen_titles.add(key)
        item = dict(item)
        item['tickers'] = [ticker for ticker, pattern in ALIASES.items()
                           if re.search(pattern, item['title'], re.I)]
        explicit = re.findall(r'\$([A-Z]{1,6}(?:\.[A-Z])?)\b|(?:NASDAQ|NYSE):\s*([A-Z]{1,6}(?:\.[A-Z])?)\b', item['title'])
        item['tickers'] = list(dict.fromkeys(item['tickers'] + [a or b for a, b in explicit]))
        item['company_names'] = identify(item['title'], catalog)
        for ticker, names in explicit_names(item['title']).items():
            item['company_names'].setdefault(ticker, []).extend(names)
        item['tickers'] = list(dict.fromkeys(item['tickers'] + list(item['company_names'])))
        unique.append(item)
    # Preserve coverage outside mega caps and prevent a busy source swallowing the budget.
    selected = []
    for category, limit in [('market', 20), ('macro', 30), ('week', 12), ('companies', 65)]:
        candidates = [i for i in unique if i['category'] == category]
        candidates.sort(key=lambda i: (not bool(set(i['tickers']) & PRIORITY), -datetime.fromisoformat(i['published_at']).timestamp()))
        selected.extend(candidates[:limit])
    return [dict(item, id=str(index)) for index, item in enumerate(selected, 1)]


def collect_quotes():
    import yfinance as yf
    instruments = [('S&P 500', '^GSPC'), ('Nasdaq', '^IXIC'), ('Dow Jones', '^DJI'),
                   ('S&P futures', 'ES=F'), ('WTI נפט', 'CL=F'), ('Bitcoin', 'BTC-USD'),
                   ('תשואת אג״ח 10 שנים (%)', '^TNX')]
    def fetch(instrument):
        label, symbol = instrument
        try:
            frame = yf.Ticker(symbol).history(period='5d', interval='1d', auto_adjust=False)
            close = frame['Close'].dropna()
            if len(close) < 2:
                raise ValueError('missing quote')
            latest, previous = float(close.iloc[-1]), float(close.iloc[-2])
            if previous <= 0:
                raise ValueError('invalid baseline')
            return dict(label=label, symbol=symbol, value=round(latest, 2),
                        change=round((latest / previous - 1) * 100, 2),
                        session_date=str(close.index[-1].date()),
                        url='https://finance.yahoo.com/quote/' + symbol)
        except Exception:
            return dict(label=label, symbol=symbol, value=None, change=None, session_date='', url='')
    with ThreadPoolExecutor(max_workers=3) as pool:
        return list(pool.map(fetch, instruments))
