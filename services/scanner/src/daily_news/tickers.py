"""Company identities from the scanner's catalogue; no speculative ticker generation."""
import os
import re
import requests

NAMES = {
    'NVDA': ['NVIDIA Corporation', 'Nvidia', 'אנבידיה', 'אנבידייה', 'אנוידיה'],
    'AAPL': ['Apple Inc.', 'Apple', 'אפל'],
    'MSFT': ['Microsoft Corporation', 'Microsoft', 'מיקרוסופט'],
    'AMZN': ['Amazon.com, Inc.', 'Amazon.com', 'Amazon', 'אמזון'],
    'META': ['Meta Platforms, Inc.', 'Meta Platforms', 'Meta', 'מטא'],
    'GOOGL': ['Alphabet Inc.', 'Alphabet', 'Google', 'אלפבית', 'גוגל'],
    'TSLA': ['Tesla, Inc.', 'Tesla', 'טסלה'],
    'AZO': ['AutoZone, Inc.', 'AutoZone'],
    'JPM': ['JPMorgan Chase & Co.', 'JPMorgan Chase', 'JPMorgan'],
}


def pattern(name):
    return r'(?<![\w])' + re.escape(name) + r'(?![\w])'


def company_catalog():
    catalog = {ticker: list(names) for ticker, names in NAMES.items()}
    url, key = os.getenv('NEXT_PUBLIC_SUPABASE_URL', ''), os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
    if not url.startswith('https://') or not key:
        return catalog
    try:
        # The scanner already owns these company-name/ticker mappings. Bound the read.
        for offset in range(0, 5000, 1000):
            response = requests.get(url.rstrip('/') + '/rest/v1/symbol_metadata',
                params={'select': 'ticker,company_name', 'order': 'ticker', 'limit': 1000, 'offset': offset},
                headers={'apikey': key, 'Authorization': 'Bearer ' + key}, timeout=10)
            if response.status_code != 200:
                break
            rows = response.json()
            for row in rows:
                ticker, name = row.get('ticker', ''), row.get('company_name') or ''
                if not re.fullmatch(r'[A-Z]{1,6}(?:\.[A-Z])?', ticker) or ticker.endswith('.TA') or len(name) < 4:
                    continue
                short = re.sub(r',?\s+(?:Inc\.?|Corporation|Corp\.?|Ltd\.?|plc|Limited|Company|Co\.?)$', '', name, flags=re.I).strip()
                names = catalog.setdefault(ticker, [])
                names.append(name)
                if len(short) >= 5:
                    names.append(short)
            if len(rows) < 1000:
                break
    except (requests.RequestException, ValueError, TypeError):
        pass  # Known identities still work when metadata is unavailable.
    return catalog


def identify(title, catalog):
    matches = {}
    title = re.sub(r'\b(?:NASDAQ|NYSE):', '', title, flags=re.I)
    for ticker, names in catalog.items():
        matching = [name for name in names if re.search(pattern(name), title, re.I)]
        if matching:
            matches[ticker] = list(dict.fromkeys(names))
    # Alphabet share classes share company names; use the established canonical symbol.
    if 'GOOGL' in matches:
        matches.pop('GOOG', None)
    return matches


def replace_company_names(text, item):
    if item['category'] != 'companies':
        return text
    text = re.sub(r'\((?:NASDAQ|NYSE):\s*\$?([A-Z]{1,6}(?:\.[A-Z])?)\)', r'($\1)', text)
    names = {t: list(NAMES.get(t, [])) for t in item['tickers']}
    for source in item.get('sources', []):
        for ticker, aliases in source.get('company_names', {}).items():
            if ticker in names:
                names[ticker].extend(aliases)
    substitutions = sorted(((alias, ticker) for ticker, aliases in names.items() for alias in set(aliases)),
                           key=lambda p: len(p[0]), reverse=True)
    for alias, ticker in substitutions:
        text = re.sub(pattern(alias), lambda _: '$' + ticker, text, flags=re.I)
    text = re.sub(r'\((?:NASDAQ|NYSE):\s*\$?([A-Z]{1,6}(?:\.[A-Z])?)\)', r'($\1)', text)
    # Normalize existing ticker mentions, while avoiding double dollars.
    for ticker in item['tickers']:
        text = re.sub(r'(?<![\w$])\$?' + re.escape(ticker) + r'(?![\w])', lambda _: '$' + ticker, text)
    text = re.sub(r'(\$[A-Z]{1,6}(?:\.[A-Z])?)\s*\(\1\)', r'\1', text)
    return text


def explicit_names(title):
    # A publisher's explicit Name (EXCHANGE:TICKER) label supplies its own identity mapping.
    matches = re.finditer(r"([A-Z][A-Za-z.&'-]*(?:\s+(?:(?:of|and|the)\s+)?[A-Z][A-Za-z.&'-]*){0,4})\s*\((?:(?:NYSE|NASDAQ):\s*|\$)([A-Z]{1,6}(?:\.[A-Z])?)\)", title)
    return {match.group(2): [match.group(1)] for match in matches}
