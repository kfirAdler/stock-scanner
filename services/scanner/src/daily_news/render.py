"""Self-contained RTL HTML and section images rendered by Chromium."""
from __future__ import annotations
from datetime import datetime
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo
from .sources import safe_url

LABELS = {'market': 'מצב השוק', 'macro': 'מאקרו וגיאופוליטיקה',
          'companies': 'חדשות החברות', 'week': 'על הפרק השבוע'}
CSS = '''
*{box-sizing:border-box}body{margin:0;background:#eceaf3;color:#191729;font-family:Arial,"Noto Sans Hebrew",sans-serif}
main{max-width:1120px;margin:28px auto;background:white}header{background:#5917ec;color:white;padding:30px 40px}
.brand{font-size:14px;letter-spacing:2px;opacity:.85}h1{font-size:38px;margin:12px 0}header p{margin:8px 0;font-size:16px}
.quotes{display:flex;flex-wrap:wrap;background:#f3efff;padding:16px 26px;gap:12px}.quote{flex:1;min-width:130px;padding:10px;background:white;border-radius:8px}
.quote strong{display:block;font-size:21px;margin-top:7px}.quote small{font-size:12px;color:#696378}.up{color:#128354}.down{color:#c33b4e}
section{padding:24px 38px;border-bottom:1px solid #e4deef}h2{font-size:25px;margin:0 0 16px;color:#4b16c5}
article{margin:0 0 20px;padding-right:15px;border-right:3px solid #ddd0fc;break-inside:avoid}
h3{font-size:21px;line-height:1.5;margin:0 0 5px}article p{font-size:20px;line-height:1.65;margin:0 0 7px}
a{color:#6641ac;text-decoration:none}.sources{font-size:13px;line-height:1.8;color:#6a637a}.ticker{display:inline-block;direction:ltr;background:#eee7ff;color:#5222a7;border-radius:5px;padding:1px 7px;margin-left:5px;font-size:15px}
.notice{background:#fff7dd;color:#655125;padding:14px 38px;font-size:15px;line-height:1.6}.social{color:#996517;font-size:14px}footer{padding:20px 38px;color:#777080;font-size:13px;line-height:1.7}.empty{color:#82798d}
@media(max-width:650px){main{margin:0}header,section{padding:22px}h1{font-size:29px}.quotes{padding:14px}h3{font-size:19px}article p{font-size:18px}}
@media print{body{background:white}main{margin:0}section{break-inside:avoid}}
'''


def e(value):
    return escape(str(value), quote=True)


def render(report, items=None, page_label=''):
    cutoff = datetime.fromisoformat(report['cutoff']).astimezone(ZoneInfo('Asia/Jerusalem'))
    start = datetime.fromisoformat(report['window_start']).astimezone(ZoneInfo('Asia/Jerusalem'))
    title = 'חדשות היום בבורסה'
    if report.get('demo'):
        title = 'תצוגת דוגמה — לא חדשות אמיתיות'
    out = ['<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">',
           '<meta name="viewport" content="width=device-width, initial-scale=1">',
           '<title>' + title + '</title><style>' + CSS + '</style><main>',
           '<header><div class="brand" dir="ltr">STOCK SCANNER / DAILY BRIEF</div>',
           '<h1>' + title + ' · ' + cutoff.strftime('%d.%m.%Y') + '</h1>',
           '<p>השוק האמריקאי · ' + start.strftime('%d.%m %H:%M') + ' עד ' + cutoff.strftime('%d.%m %H:%M') + ' · שעון ישראל</p>',
           '<p><bdi dir="ltr">' + e(page_label) + '</bdi></p></header><div class="quotes">']
    for q in report['quotes']:
        value = 'לא זמין' if q['value'] is None else f"{q['value']:,.2f}"
        delta = '' if q['change'] is None else f"{q['change']:+.2f}%"
        color = 'up' if (q['change'] or 0) >= 0 else 'down'
        out.append(f'<div class="quote"><span>{e(q["label"])}</span><strong dir="ltr">{e(value)}</strong><b dir="ltr" class="{color}">{e(delta)}</b><br><small>{e(q["session_date"])}</small></div>')
    out.append('</div>')
    for warning in report['warnings']:
        out.append('<div class="notice">' + e(warning) + '</div>')
    selected = report['items'] if items is None else items
    for category, label in LABELS.items():
        group = [i for i in selected if i['category'] == category]
        if not group:
            continue
        out.append('<section><h2>' + label + '</h2>')
        for item in group:
            tickers = ''.join('<bdi class="ticker">$' + e(t) + '</bdi>' for t in item['tickers'])
            out.append('<article>' + tickers + '<h3 dir="auto">' + e(item['title']) + '</h3>')
            if item['summary']:
                out.append('<p dir="auto">' + e(item['summary']) + '</p>')
            if item['social_only']:
                out.append('<div class="social">דיווח ב־X · לא אומת מול מקור נוסף</div>')
            links = []
            for s in item['sources']:
                published = datetime.fromisoformat(s['published_at']).astimezone(ZoneInfo('Asia/Jerusalem')).strftime('%d.%m %H:%M')
                links.append('<a href="' + e(safe_url(s['url'])) + '" target="_blank" rel="noopener noreferrer">' + e(s['source']) + ' · ' + published + '</a>')
            out.append('<div class="sources">' + ' / '.join(links) + '</div></article>')
        out.append('</section>')
    out.append('<footer>מחירים: Yahoo Finance; הנתון האחרון הזמין עשוי להיות מושהה או משקף סגירה. השינוי הוא מול בר המסחר היומי הקודם, ואינו בהכרח שינוי ב־24 שעות. תאריך הנתון מופיע בכל כרטיס.<br>הסקירה מרכזת דיווחים מהמקורות הזמינים ואינה מכסה כל ידיעה בשוק. פריטים חסרים אינם מושלמים ממידע לא מבוסס.</footer></main></html>')
    return ''.join(out)


def write_report(report, directory, images=True):
    import json
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    html = directory / 'report.html'
    html.write_text(render(report), encoding='utf-8')
    (directory / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    paths = [html]
    if not images:
        return paths
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            page = browser.new_page(viewport={'width': 1120, 'height': 900}, device_scale_factor=1)
            page.route('**/*', lambda route: route.abort())
            # Six short items per card keep Discord images readable without slicing text.
            chunks = [report['items'][i:i+6] for i in range(0, len(report['items']), 6)] or [[]]
            for index, chunk in enumerate(chunks, 1):
                page.set_content(render(report, chunk, f'{index} / {len(chunks)}'), wait_until='load')
                page.evaluate('document.fonts.ready')
                path = directory / f'news-{index:02d}.png'
                page.locator('main').screenshot(path=str(path))
                paths.append(path)
        finally:
            browser.close()
    return paths
