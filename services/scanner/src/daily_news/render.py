"""Fixed-size mobile-first RTL briefing rendered as one 1080x1920 PNG."""
from __future__ import annotations

import base64
import re
from datetime import datetime
from functools import lru_cache
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

from .sources import safe_url
from .tickers import replace_company_names

VIEWPORT = {'width': 540, 'height': 960}
DEVICE_SCALE_FACTOR = 2
MAX_STORIES = 12
MIN_STORIES = 8
LABELS = {
    'market': 'שוק', 'macro': 'מאקרו', 'company': 'חברה', 'companies': 'חברה',
    'earnings': 'דוחות', 'regulatory': 'רגולציה', 'crypto': 'קריפטו', 'israel': 'ישראל',
}
CSS = '''
@page{size:540px 960px;margin:0}*{box-sizing:border-box}
html,body{margin:0;width:540px;height:960px;overflow:hidden;background:#f4f7f5;color:#10231c;font-family:Heebo,Arial,sans-serif}
#daily-brief{width:540px;height:960px;overflow:hidden;background:#f4f7f5;padding:18px 22px;display:flex;flex-direction:column}
header{height:62px;flex:none;border-bottom:2px solid #075b45;display:flex;direction:ltr;align-items:center;justify-content:space-between;padding:0 0 10px}
.identity{display:flex;flex-direction:column;gap:6px;text-align:left}.brand{direction:ltr;color:#075b45;font-size:8px;line-height:1;font-weight:850;letter-spacing:1.5px}.brand:before{content:"";display:inline-block;width:12px;height:3px;margin:0 6px 2px 0;background:#075b45;border-radius:2px}.date{direction:ltr;color:#64746d;font-size:12px;line-height:1;font-weight:700;font-variant-numeric:tabular-nums}.market-heading{direction:rtl;text-align:right}.market-heading h1{margin:0;font-size:24px;line-height:1;font-weight:820}
.market-groups{height:138px;flex:none;display:grid;grid-template-columns:repeat(2,1fr);grid-template-rows:repeat(2,1fr);gap:7px;padding:10px 0;border-bottom:1px solid #d7e2dc}.market-group{min-width:0;border:1px solid #dce7e1;border-radius:7px;background:#f9fbfa;padding:6px 9px}.group-title{color:#64746d;font-size:8.5px;line-height:1;font-weight:800}.group-quotes{margin-top:5px;display:flex;flex-direction:column;gap:3px}.quote{display:grid;grid-template-columns:minmax(48px,1fr) 48px 43px;align-items:center;gap:4px;font-size:10px;line-height:1.15;font-variant-numeric:tabular-nums}.quote-label{direction:ltr;unicode-bidi:isolate;font-weight:750}.quote-value,.quote-change{direction:ltr;unicode-bidi:isolate;text-align:left;font-weight:780}.up{color:#087a55}.down{color:#c83c4a}.missing{color:#8b9892}
.summary{height:92px;flex:none;padding:10px 0;border-bottom:1px solid #d7e2dc}.section-label{font-size:10px;line-height:1;color:#075b45;font-weight:850;letter-spacing:.2px}.summary-list{margin:7px 0 0;padding:0 15px 0 0;display:grid;gap:3px;font-size:11px;line-height:1.25;font-variant-numeric:tabular-nums}.summary-list li::marker{color:#087a55}
.stories{flex:1;min-height:0}.story{height:58px;padding:9px 0;border-bottom:1px solid #dde7e2;display:grid;grid-template-columns:55px 1fr;column-gap:10px;align-items:start;break-inside:avoid}.story.top{height:64px;padding-top:10px}.badge{justify-self:start;max-width:55px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#e5efe9;color:#075b45;border-radius:4px;padding:4px 7px;font-size:9px;line-height:1.1;font-weight:850;text-align:center}.story-body{min-width:0}.story-title{margin:0;font-size:14px;line-height:1.3;font-weight:680;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.top .story-title{font-size:15px;font-weight:760}.english-title{direction:ltr;unicode-bidi:isolate;text-align:left}.numeric,.ticker{direction:ltr;unicode-bidi:isolate}
'''


@lru_cache(maxsize=1)
def embedded_font():
    data = base64.b64encode((Path(__file__).parent / 'assets/Heebo.ttf').read_bytes()).decode('ascii')
    return '@font-face{font-family:Heebo;font-style:normal;font-weight:100 900;src:url(data:font/ttf;base64,' + data + ') format("truetype");}'


def e(value):
    return escape(str(value), quote=True)


def clean_headline(text):
    text = re.sub(r'\s+', ' ', text or '').strip()
    text = re.sub(r'^Stock Market Today:\s*', '', text, flags=re.I)
    text = re.sub(r'\bQ([1-4]) CY(20\d{2}) Earnings Results:\s*', r'Q\1 \2: ', text)
    return re.split(r'\.\s+It[’\']s (?:a |the )?lifeline', text, flags=re.I)[0].strip()


def news_text(text, item, prefix=False):
    text = clean_headline(text)
    text = replace_company_names(text, item)
    allowed = set(item.get('tickers', []))
    result, start = [], 0
    for match in re.finditer(r'\$([A-Z]{1,6}(?:\.[A-Z])?)(?![\w])', text):
        result.append(e(text[start:match.start()]))
        result.append('<bdi class="ticker"><strong>' + e(match.group()) + '</strong></bdi>'
                      if match.group(1) in allowed else e(match.group()))
        start = match.end()
    result.append(e(text[start:]))
    return ''.join(result)


def _quote_key(label):
    normalized = str(label).upper().strip()
    return {'NASDAQ': 'NASDAQ', 'BITCOIN': 'BTC', 'WTI נפט': 'WTI'}.get(normalized, normalized)


def _quote_markup(quotes):
    wanted = {
        'מניות': ('S&P 500', 'NASDAQ'), 'קריפטו': ('BTC',),
        'סחורות': ('WTI',), 'אג״ח': ('US10Y',),
    }
    by_label = {_quote_key(quote['label']): quote for quote in quotes}
    out = []
    for group, labels in wanted.items():
        rows = []
        for label in labels:
            quote = by_label.get(_quote_key(label))
            if not quote or quote.get('value') is None:
                rows.append(f'<div class="quote missing"><span class="quote-label">{e(label)}</span>'
                            '<span class="quote-value">—</span><span class="quote-change">—</span></div>')
                continue
            value = quote.get('value')
            change = quote.get('change')
            decimals = 2 if abs(value) < 1000 else 0
            color = 'up' if (change or 0) >= 0 else 'down'
            rows.append(f'<div class="quote"><span class="quote-label">{e(label)}</span>'
                        f'<span class="quote-value">{value:,.{decimals}f}</span>'
                        f'<span class="quote-change {color}">{change:+.2f}%</span></div>')
        out.append(f'<section class="market-group"><div class="group-title">{e(group)}</div>'
                   f'<div class="group-quotes">{"".join(rows)}</div></section>')
    return ''.join(out)


def quote_notes(quotes):
    groups, missing = {}, []
    for quote in quotes:
        if quote.get('value') is None:
            missing.append(quote['label'])
        elif quote.get('session_date'):
            groups.setdefault(quote['session_date'], []).append(quote['label'])
    notes = []
    if len(groups) == 1:
        notes.append('תאריך נתוני השוק: ' + datetime.fromisoformat(next(iter(groups))).strftime('%d.%m'))
    elif groups:
        notes.append('תאריכי נתוני השוק: ' + ' · '.join(
            datetime.fromisoformat(day).strftime('%d.%m') + ' — ' + ', '.join(labels)
            for day, labels in sorted(groups.items(), reverse=True)))
    if missing:
        notes.append('נתון חסר: ' + ', '.join(missing))
    return ' · '.join(notes)


def _summary_points(report):
    shown = {'S&P 500', 'NASDAQ', 'BTC', 'WTI', 'US10Y'}
    available = [q for q in report['quotes'] if _quote_key(q['label']) in shown
                 and q.get('value') is not None and q.get('change') is not None]
    strongest = sorted(available, key=lambda q: abs(q['change']), reverse=True)[:3]
    parts = [f"{q['label']}: {'עלייה' if q['change'] >= 0 else 'ירידה'} של {abs(q['change']):.1f}%"
             for q in strongest]
    titles = ' '.join(item['title'] for item in report['items'])
    if re.search(r'Fed|פד|ריבית', titles, re.I):
        parts.append('הפד במוקד')
    earnings = sum(item['category'] == 'earnings' for item in report['items'])
    if earnings:
        parts.append(f'{earnings} דוחות בולטים')
    if not parts:
        parts = ['המגמות המרכזיות מופיעות בכותרות שלמטה']
    if len(parts) == 1:
        parts.append('האירועים הבולטים מסודרים לפי חשיבות ועדכניות')
    return parts[:3]


def _badge(item):
    return LABELS.get(item['category'], 'שוק')


def render(report, items=None, page_label='', overview=True):
    cutoff = datetime.fromisoformat(report['cutoff']).astimezone(ZoneInfo('Asia/Jerusalem'))
    selected = list(report['items'] if items is None else items)[:MAX_STORIES]
    title = 'Daily Market Brief' if not report.get('demo') else 'תצוגת Daily Brief'
    out = ['<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">',
           '<meta name="viewport" content="width=540,initial-scale=1"><title>', e(title),
           '</title><style>', embedded_font(), CSS, '</style></head><body>',
           '<main id="daily-brief"><header><div class="identity"><div class="brand">DAILY MARKET BRIEF</div>',
           '<div class="date">', cutoff.strftime('%d.%m.%Y'), '</div></div>',
           '<div class="market-heading"><h1>חדשות היום</h1></div></header>',
           '<div class="market-groups">', _quote_markup(report['quotes']) if overview else '', '</div>',
           '<div class="summary"><div class="section-label">סיכום היום</div><ul class="summary-list">',
           ''.join('<li>' + e(point) + '</li>' for point in _summary_points(report)) if overview else '',
           '</ul></div><div class="stories">']
    for index, item in enumerate(selected):
        source = item['sources'][0]
        language = item.get('language') or source.get('language', 'en')
        direction = ' class="story-title english-title" dir="ltr"' if language == 'en' else ' class="story-title" dir="auto"'
        out.extend(['<article class="story', ' top' if index == 0 else '', '"><div class="badge">',
                    e(_badge(item)), '</div><div class="story-body"><h2', direction, '>',
                    news_text(item['title'], item), '</h2></div></article>'])
    out.extend(['</div></main></body></html>'])
    return ''.join(out)


def fit_items(report, page):
    items = list(report['items'][:MAX_STORIES])
    while items:
        page.set_content(render(report, items), wait_until='load')
        page.evaluate('document.fonts.ready')
        overflow = page.locator('#daily-brief').evaluate('node => node.scrollHeight > node.clientHeight')
        if not overflow:
            return items
        items.pop()
    raise ValueError('Report header exceeds fixed portrait canvas')


def write_report(report, directory, images=True):
    import json
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    html = directory / 'report.html'
    paths = [html]
    retained = list(report['items'][:MAX_STORIES])
    if images:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            try:
                page = browser.new_page(viewport=VIEWPORT, device_scale_factor=DEVICE_SCALE_FACTOR)
                page.route('**/*', lambda route: route.abort())
                retained = fit_items(report, page)
                page.set_content(render(report, retained), wait_until='load')
                page.evaluate('document.fonts.ready')
                for old in directory.glob('news-*.png'):
                    old.unlink()
                image = directory / 'news-01.png'
                page.locator('#daily-brief').screenshot(path=str(image), type='png')
                paths.append(image)
            finally:
                browser.close()
    report['items'] = retained
    html.write_text(render(report, retained), encoding='utf-8')
    (directory / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return paths
