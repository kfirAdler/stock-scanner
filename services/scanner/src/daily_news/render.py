"""Self-contained RTL HTML and section images rendered by Chromium."""
from __future__ import annotations
import re
import base64
from functools import lru_cache
from datetime import datetime
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo
from .sources import safe_url
from .tickers import replace_company_names

LABELS = {'market': 'מצב השוק', 'macro': 'מאקרו וגיאופוליטיקה',
          'companies': 'חדשות החברות', 'week': 'על הפרק השבוע'}
MAX_PAGE_HEIGHT = 1600
CSS = '''
*{box-sizing:border-box}body{margin:0;background:#edf3ef;color:#15251e;font-family:Heebo,Arial,sans-serif}
main{max-width:1120px;margin:0 auto;background:white}header{background:linear-gradient(115deg,#092f26 0%,#075a3e 55%,#15925a 100%);color:white;padding:16px 28px}
.brand{font-size:11px;letter-spacing:1.6px;opacity:.8}h1{font-size:26px;margin:6px 0}header p{margin:3px 0;font-size:13px}
.quotes{display:flex;flex-wrap:wrap;background:#eef6f1;padding:10px 22px;gap:7px}.quote{flex:1;min-width:130px;padding:7px;background:white;border-radius:5px}
.quote strong{display:block;font-size:18px;margin-top:3px}.quote small{font-size:11px;color:#65796c}.up{color:#128354}.down{color:#c33b4e}
section{padding:12px 28px 5px;border-bottom:1px solid #dfebe4}h2{font-size:19px;margin:0 0 8px;color:#126344}
article{margin:0 0 10px;padding-right:10px;border-right:2px solid #c5ddcd;break-inside:avoid}
h3{font-weight:400;font-size:17px;line-height:1.4;margin:0 0 3px}article p{font-size:17px;line-height:1.4;margin:0 0 3px}
a{color:#44715b;text-decoration:none}.sources{font-size:12px;line-height:1.3;color:#667c6e}.ticker{display:inline-block;direction:ltr;color:#075a3e;padding:0;margin:0;font-size:inherit;font-weight:700}
.quote-notes{display:flex;flex-wrap:wrap;gap:4px 14px;padding:3px 28px 8px;background:#eef6f1;color:#65796c;font-size:11px;line-height:1.45}.quote span{font-size:13px}.notice{background:#fff7dd;color:#655125;padding:6px 28px;font-size:12px;line-height:1.3}.social{color:#996517;font-size:12px}footer{padding:9px 28px;color:#718076;font-size:11px;line-height:1.35}
@media(max-width:650px){header,section{padding:14px}h1{font-size:26px}.quotes{padding:10px}h3{font-size:18px}article p{font-size:17px}}
@media print{body{background:white}main{margin:0}article{break-inside:avoid}}
'''



@lru_cache(maxsize=1)
def embedded_font():
    data = base64.b64encode((Path(__file__).parent / 'assets/Heebo.ttf').read_bytes()).decode('ascii')
    return '@font-face{font-family:Heebo;font-style:normal;font-weight:100 900;src:url(data:font/ttf;base64,' + data + ') format("truetype");}'


def quote_notes(quotes):
    groups, missing = {}, []
    for quote in quotes:
        if quote['value'] is None:
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


def quote_notes_markup(quotes):
    # Isolate each date/asset group to prevent mixed Hebrew/English bidi reordering.
    parts = quote_notes(quotes).split(' · ')
    result = []
    for part in parts:
        match = re.search(r'(\d{2}\.\d{2}) — (.*)', part)
        if match:
            value = e(part[:match.start()]) + '<bdi dir="ltr">' + e(match.group(1)) + '</bdi> — <bdi dir="auto">' + e(match.group(2)) + '</bdi>'
        else:
            value = e(part)
        result.append('<span>' + value + '</span>')
    return ''.join(result)


def clean_headline(text):
    # Remove editorial wrappers without inventing or paraphrasing source facts.
    text = re.sub(r'^Stock Market Today:\s*', '', text, flags=re.I)
    text = re.sub(r'\bQ([1-4]) CY(20\d{2}) Earnings Results:\s*', r'Q\1 \2: ', text)
    text = re.split(r'\.\s+It[’\']s (?:a |the )?lifeline', text, flags=re.I)[0]
    return text.strip()


def e(value):
    return escape(str(value), quote=True)


def news_text(text, item, prefix=False):
    text = clean_headline(text)
    if item['category'] == 'companies':
        text = re.sub(r'^(?:Dow|Nasdaq|S&P)[^;]*;\s*', '', text, flags=re.I)
    text = replace_company_names(text, item)
    if prefix and item['category'] == 'companies' and item['tickers'] and not any('$' + t in text for t in item['tickers']):
        text = ' / '.join('$' + t for t in item['tickers']) + ': ' + text
    allowed = set(item['tickers'])
    result, start = [], 0
    for match in re.finditer(r'\$([A-Z]{1,6}(?:\.[A-Z])?)(?![\w])', text):
        result.append(e(text[start:match.start()]))
        result.append('<bdi class="ticker"><strong>' + e(match.group()) + '</strong></bdi>'
                      if match.group(1) in allowed else e(match.group()))
        start = match.end()
    result.append(e(text[start:]))
    return ''.join(result)


def render(report, items=None, page_label='', overview=True):
    cutoff = datetime.fromisoformat(report['cutoff']).astimezone(ZoneInfo('Asia/Jerusalem'))
    start = datetime.fromisoformat(report['window_start']).astimezone(ZoneInfo('Asia/Jerusalem'))
    title = 'חדשות הבוקר'
    if report.get('demo'):
        title = 'תצוגת דוגמה — לא חדשות אמיתיות'
    out = ['<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width, initial-scale=1">',
           '<title>' + title + '</title><style>' + embedded_font() + CSS + '</style><main>',
           '<header><div class="brand" dir="ltr">STOCK SCANNER / DAILY BRIEF</div>',
           '<h1>' + title + ' · ' + cutoff.strftime('%d.%m.%Y') + '</h1>',
           '<p>השוק האמריקאי · ' + start.strftime('%d.%m %H:%M') + ' עד ' + cutoff.strftime('%d.%m %H:%M') + ' · שעון ישראל</p>',
           ('<p><bdi dir="ltr">' + e(page_label) + '</bdi></p>' if page_label and not page_label.endswith('/ 1') else '') + '</header><div class="quotes">']
    for q in report['quotes'] if overview else []:
        if q['value'] is None:
            continue
        value = 'לא זמין' if q['value'] is None else f"{q['value']:,.2f}"
        delta = '' if q['change'] is None else f"{q['change']:+.2f}%"
        color = 'up' if (q['change'] or 0) >= 0 else 'down'
        out.append(f'<div class="quote"><span>{e(q["label"])}</span><strong dir="ltr">{e(value)}</strong><b dir="ltr" class="{color}">{e(delta)}</b></div>')
    out.append('</div>')
    if overview:
        out.append('<div class="quote-notes">' + quote_notes_markup(report['quotes']) + '</div>')
        warnings = [w for w in report['warnings'] if not w.startswith('חלק מנתוני השוק לא התקבלו')]
        if warnings:
            out.append('<div class="notice">' + ' · '.join(e(w) for w in warnings) + '</div>')
    selected = report['items'] if items is None else items
    for category, label in LABELS.items():
        group = [i for i in selected if i['category'] == category]
        if not group:
            continue
        out.append('<section><h2>' + label + '</h2>')
        for item in group:
            out.append('<article><h3 dir="auto">' + news_text(item['title'], item, prefix=True) + '</h3>')
            if item['summary']:
                out.append('<p dir="auto">' + news_text(item['summary'], item) + '</p>')
            if item['social_only']:
                out.append('<div class="social">דיווח ב־X · לא אומת מול מקור נוסף</div>')
            links = []
            for s in item['sources'][:2]:
                published = datetime.fromisoformat(s['published_at']).astimezone(ZoneInfo('Asia/Jerusalem')).strftime('%d.%m %H:%M')
                links.append('<a href="' + e(safe_url(s['url'])) + '" target="_blank" rel="noopener noreferrer">' + e(s['source']) + ' · ' + published + '</a>')
            out.append('<div class="sources">' + ' / '.join(links) + '</div></article>')
        out.append('</section>')
    out.append('<footer>מחירים: Yahoo Finance · נתונים אחרונים זמינים, ייתכן עיכוב · השינוי מול יום המסחר הקודם.</footer></main></html>')
    return ''.join(out)


def fit_pages(report, page):
    """Measure actual browser layout; keep whole stories, readable type and at most two cards."""
    while True:
        chunks, current = [], []
        for item in report['items']:
            trial = current + [item]
            page.set_content(render(report, trial, '2 / 2', overview=not chunks), wait_until='load')
            page.evaluate('document.fonts.ready')
            height = page.locator('main').bounding_box()['height']
            if height > MAX_PAGE_HEIGHT and current:
                chunks.append(current)
                current = [item]
            else:
                current = trial
        if current or not chunks:
            chunks.append(current)
        if len(chunks) <= 2:
            # Validate each final card (including a possible long single-story card).
            fits = True
            for index, chunk in enumerate(chunks):
                page.set_content(render(report, chunk, '2 / 2', overview=index == 0), wait_until='load')
                if page.locator('main').bounding_box()['height'] > MAX_PAGE_HEIGHT:
                    fits = False
            if fits:
                return chunks
        if not report['items']:
            raise ValueError('Report header exceeds image height budget')
        # Drop the lowest-ranked tail story instead of clipping text or shrinking the font.
        report['items'] = report['items'][:-1]


def write_report(report, directory, images=True):
    import json
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    html = directory / 'report.html'
    paths = [html]
    if images:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={'width': 1120, 'height': 900}, device_scale_factor=1)
                page.route('**/*', lambda route: route.abort())
                chunks = fit_pages(report, page)
                if not report['items']:
                    raise ValueError('No stories fit within the report page budget')
                # Remove previous generated cards so reruns cannot retain a stale third page in artifacts.
                for old in directory.glob('news-*.png'):
                    old.unlink()
                for index, chunk in enumerate(chunks, 1):
                    page.set_content(render(report, chunk, f'{index} / {len(chunks)}', overview=index == 1), wait_until='load')
                    page.evaluate('document.fonts.ready')
                    path = directory / f'news-{index:02d}.png'
                    page.locator('main').screenshot(path=str(path))
                    paths.append(path)
            finally:
                browser.close()
    # Persist exactly the retained stories, matching Discord and the delivery journal.
    html.write_text(render(report), encoding='utf-8')
    (directory / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return paths
