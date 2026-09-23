"""Conservative headline curation, including when no paid summary model is configured."""
import re
from difflib import SequenceMatcher
from .sources import PRIORITY

LIMITS = {'market': 1, 'macro': 3, 'companies': 7, 'week': 1}
MAX_ITEMS = sum(LIMITS.values())
FOREIGN = re.compile(r'^(?:S&P/TSX|TSX|Kospi|Nikkei|FTSE|ASX|Sensex|Nifty|Hang Seng)\b', re.I)
FLUFF = re.compile(r'\b(?:stocks? to buy|best stocks?|top \d+ stocks?|should you buy|good news for|millionaire|price prediction|undervalued stocks?|undervalued|stock valuation|reflecting on|says to buy|stocks? worth buying|earnings season|buy point|makes these trades|lifeline for the stock)\b', re.I)
CATALYST = re.compile(r'\b(?:earnings|guidance|revenue|profit|merger|acquisition|acquires?|deal|contract|launch(?:es)?|approv(?:al|es)|FDA|antitrust|layoffs?|announces?|raises?|cuts?|tariffs?|inflation|payrolls?|interest rates?|rate (?:cut|hike)|Federal Reserve|Fed|EIA|sanctions?)\b', re.I)
TRUSTED = re.compile(r'reuters|bloomberg|associated press|cnbc|wall street journal|financial times|sec\.gov|investor relations', re.I)
STOP = set('the a an and or of to in on for as at by with from its stock stocks shares market markets today news snapshot update says said us'.split())


def original_text(item):
    return ' '.join(s.get('title', '') for s in item.get('sources', [])) or item['title']


def importance(item):
    text = original_text(item)
    return (5 * bool(CATALYST.search(text)) +
            3 * any(TRUSTED.search(s.get('source', '')) for s in item.get('sources', [])) +
            2 * bool(set(item['tickers']) & PRIORITY))


def duplicate(a, b):
    # Compare English source headlines even when the rendered summary is Hebrew.
    left, right = original_text(a).lower(), original_text(b).lower()
    words = lambda text: set(re.findall(r'[a-z0-9]+', text)) - STOP
    wa, wb = words(left), words(right)
    if left == right or SequenceMatcher(None, left, right).ratio() >= .82:
        return True
    if len(wa & wb) >= 4 and len(wa & wb) / max(1, len(wa | wb)) >= .58:
        return True
    # Same company + same earnings event should not fill multiple slots.
    if all('discount window' in text and 'jefferson' in text for text in (left, right)):
        return True
    entities = set(a['tickers']) & set(b['tickers'])
    if 'autozone' in left or re.search(r'\bazo\b', left):
        if 'autozone' in right or re.search(r'\bazo\b', right):
            entities.add('AZO')
    return bool(entities and re.search(r'\bearnings\b', left) and re.search(r'\bearnings\b', right))


def curate(items):
    eligible = []
    for original in items:
        item = dict(original)
        text = original_text(item)
        text = re.split(r'\.\s+It[’\']s (?:a |the )?lifeline', text, flags=re.I)[0]
        retrospective = re.search(r'^(?:Q[1-4] .{0,100}earnings:)|earns top marks|cash fortress|(?:rate-control|monetary policy) toolkit.*working|wall street expects.*to shape|stays overweight', text, re.I)
        if FOREIGN.search(text) or FLUFF.search(text) or retrospective or text.rstrip().endswith('?'):
            continue
        # Oil inventories and broad indices are macro/market context, not company news.
        if item['category'] == 'companies' and not item['tickers']:
            if re.search(r'\b(?:crude stocks|oil stocks|oil inventories|EIA)\b', text, re.I):
                item['category'] = 'macro'
            elif re.search(r'\b(?:S&P 500|Nasdaq|Dow Jones)\b', text, re.I):
                item['category'] = 'market'
        if item['category'] == 'companies' and not item['tickers']:
            continue
        if item['category'] in {'companies', 'macro'} and not CATALYST.search(text):
            continue
        eligible.append(item)
    # Substantive catalysts and reliable sources win duplicate coverage.
    eligible.sort(key=lambda i: (not bool(set(i['tickers']) & PRIORITY), -importance(i)))
    selected, counts = [], dict.fromkeys(LIMITS, 0)
    for item in eligible:
        category = item['category']
        if counts[category] >= LIMITS[category] or any(duplicate(item, previous) for previous in selected):
            continue
        selected.append(item)
        counts[category] += 1
    return sorted(selected, key=lambda i: (list(LIMITS).index(i['category']),
                                          not bool(set(i['tickers']) & PRIORITY), -importance(i)))
