from __future__ import annotations
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from .delivery import daily_lock, deliver, delivery_config
from .render import write_report
from .sources import collect_rss, collect_x, collect_quotes, prepare
from .summary import summarize
from .tickers import company_catalog

ISRAEL = ZoneInfo('Asia/Jerusalem')
log = logging.getLogger(__name__)


def scheduled_cutoff(now):
    local = now.astimezone(ISRAEL)
    due = local.replace(hour=15, minute=0, second=0, microsecond=0)
    return due.astimezone(timezone.utc) if local >= due else None


def demo_report(cutoff):
    entries = [
        ('market', [], 'תמונת מצב לקראת פתיחת המסחר', 'כאן יופיעו הכותרות המרכזיות שמשפיעות על השוק האמריקאי, עם זמן פרסום וקישור למקור.'),
        ('macro', [], 'מאקרו, ריבית וגיאופוליטיקה', 'כל אירוע יסוכם בנקודה קצרה. נתונים ותאריכים יופיעו רק כשהם מופיעים במקור.'),
        ('companies', ['NVDA'], 'דוגמה למבנה ידיעה על חברה', 'שם החברה והטיקר יוצגו לצד תקציר בעברית. זהו טקסט להמחשת העיצוב בלבד.'),
        ('companies', ['AAPL'], 'עדכונים עסקיים ודוחות כספיים', 'חדשות מהותיות ירוכזו ללא חזרה על אותו אירוע מכמה מקורות.'),
        ('companies', ['JPM'], 'סיקור חברות ממגוון ענפים', 'בנקים, אנרגיה, בריאות, תעשייה וצריכה ייכללו בהתאם לחדשות הזמינות באותו היום.'),
        ('week', [], 'אירועים להמשך השבוע', 'כאן יופיעו אירועים עתידיים רק אם נמצא מקור שמציין אותם במפורש.'),
    ]
    source = dict(id='demo', source='מקור לדוגמה', url='https://example.com', published_at=cutoff.isoformat(), kind='headline')
    return dict(cutoff=cutoff.isoformat(), window_start=(cutoff-timedelta(hours=24)).isoformat(),
                generated_at=datetime.now(timezone.utc).isoformat(), demo=True,
                warnings=['דוגמת עיצוב בלבד. אין כאן חדשות או מחירי שוק אמיתיים.'],
                quotes=[dict(label=x, value=None, change=None, session_date='', url='') for x in ['S&P 500', 'Nasdaq', 'WTI נפט', 'Bitcoin']],
                items=[dict(category=c, tickers=t, title=h, summary=s, sources=[source], social_only=False) for c,t,h,s in entries])


def build(cutoff):
    articles, warnings = collect_rss(cutoff)
    posts, x_warnings = collect_x(cutoff)
    sources = prepare(articles + posts, company_catalog())
    if not sources:
        raise RuntimeError('No timestamped news found in the last 24 hours; nothing will be sent')
    items, summary_warning = summarize(sources)
    if not items:
        raise RuntimeError('No reportable news; nothing will be sent')
    quotes = collect_quotes()
    warnings += x_warnings
    if summary_warning:
        warnings.append(summary_warning)
    if any(q['value'] is None for q in quotes):
        warnings.append('חלק מנתוני השוק לא התקבלו ומסומנים כלא זמינים.')
    return dict(cutoff=cutoff.isoformat(), window_start=(cutoff-timedelta(hours=24)).isoformat(),
                generated_at=datetime.now(timezone.utc).isoformat(), demo=False,
                items=items, quotes=quotes, warnings=list(dict.fromkeys(warnings)))


def run(output, state, send=False, demo=False, images=True, cutoff=None):
    if send and not images:
        raise ValueError('Sending requires images; --html-only is for local previews')
    if demo and send:
        raise ValueError('Demo reports cannot be sent')
    cutoff = cutoff or datetime.now(timezone.utc)
    day = cutoff.astimezone(ISRAEL).date().isoformat()
    journal = None
    backend = os.getenv('NEWS_STATE_BACKEND', 'local')
    if backend not in {'local', 'supabase'}:
        raise ValueError('NEWS_STATE_BACKEND must be local or supabase')
    if send and backend == 'supabase':
        from .journal import Journal
        journal = Journal()
        previous = journal.status(day)
        if False:
            if previous == 'pending':
                raise RuntimeError('Pending remote delivery; check Discord before retrying')
            log.info('Report already sent for %s', day)
            return []
    config = delivery_config() if send else None
    with daily_lock(state, day) as marker:
        if send and marker.exists():
            log.info('Daily delivery already recorded for %s; skipping', day)
            return []
        report = demo_report(cutoff) if demo else build(cutoff)
        paths = write_report(report, Path(output) / day, images)
        if send:
            webhook, token, channel = config
            destination = channel or ('webhook:' + webhook.split('/')[-2])
            if journal and not journal.claim(day, destination, report):
                log.info('Another runner claimed this daily report')
                return paths
            try:
                message_id = deliver(paths, webhook, marker, day, bot_token=token, channel_id=channel)
            except Exception:
                # No local pending marker means validation or an explicit rejection, not an ambiguous POST.
                if journal and not marker.exists():
                    journal.release(day)
                raise
            if journal:
                journal.sent(day, message_id)
        log.info('Report created for %s (%s files, sent=%s)', day, len(paths), send)
        return paths


def daemon(output, state, images=True):
    delivery_config()
    log.info('Daily news service ready: 15:00 Asia/Jerusalem, every calendar day')
    while True:
        due = scheduled_cutoff(datetime.now(timezone.utc))
        if due is not None and not (Path(state) / (due.astimezone(ISRAEL).date().isoformat() + '.json')).exists():
            try:
                run(output, state, send=True, images=images, cutoff=due)
            except Exception as exc:
                # Do not log request URLs or exception messages that might contain credentials.
                log.error('Daily news run failed (%s); inspect configuration and delivery state', type(exc).__name__)
                time.sleep(900)
                continue
        time.sleep(30)
