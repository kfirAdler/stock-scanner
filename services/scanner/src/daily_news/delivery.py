"""One daily delivery with a durable pending marker for ambiguous HTTP outcomes."""
from __future__ import annotations
import fcntl
import json
import os
import re
import time
from datetime import date
from contextlib import ExitStack, contextmanager
from pathlib import Path
import requests


@contextmanager
def daily_lock(directory, day):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / (day + '.lock')).open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Another daily report is already running') from None
        try:
            yield directory / (day + '.json')
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def save_state(path, state):
    temp = path.with_suffix('.tmp')
    with temp.open('w') as handle:
        json.dump(state, handle)
        handle.flush()
        os.fsync(handle.fileno())
    temp.replace(path)


def resolve_channel(token):
    def get(path):
        try:
            response = requests.get('https://discord.com/api/v10' + path,
                                    headers={'Authorization': 'Bot ' + token}, timeout=15)
            if response.status_code != 200:
                raise RuntimeError('Discord channel lookup failed (HTTP ' + str(response.status_code) + ')')
            return response.json()
        except requests.RequestException:
            raise RuntimeError('Discord channel lookup unavailable') from None
    guild = os.getenv('DISCORD_GUILD_ID', '').strip()
    if guild and not re.fullmatch(r'[0-9]{17,20}', guild):
        raise ValueError('Invalid DISCORD_GUILD_ID')
    guilds = [{'id': guild}] if guild else get('/users/@me/guilds?limit=200')
    if len(guilds) > 20:
        raise ValueError('Set DISCORD_GUILD_ID or DISCORD_NEWS_CHANNEL_ID for bots in many servers')
    name = os.getenv('DISCORD_NEWS_CHANNEL_NAME', 'stock-news').strip() or 'stock-news'
    matches = []
    for server in guilds:
        matches.extend(c for c in get('/guilds/' + server['id'] + '/channels')
                       if c.get('name') == name and c.get('type') == 0)
    if len(matches) != 1:
        raise ValueError('Channel name missing or ambiguous; set DISCORD_NEWS_CHANNEL_ID')
    return matches[0]['id']


def delivery_config():
    webhook = os.getenv('DISCORD_NEWS_WEBHOOK_URL', '').strip()
    token = os.getenv('DISCORD_BOT_TOKEN', '').strip()
    channel = os.getenv('DISCORD_NEWS_CHANNEL_ID', '').strip()
    if not webhook and not token:
        raise ValueError('Configure DISCORD_BOT_TOKEN + DISCORD_NEWS_CHANNEL_ID, or DISCORD_NEWS_WEBHOOK_URL')
    if not webhook and not channel:
        channel = resolve_channel(token)
    return webhook, token, channel


def deliver(paths, webhook, marker, day, bot_token='', channel_id=''):
    headers = {}
    params = {'wait': 'true'}
    if not webhook:
        if not bot_token or not re.fullmatch(r'[0-9]{17,20}', channel_id):
            raise ValueError('Configure DISCORD_BOT_TOKEN and a valid DISCORD_NEWS_CHANNEL_ID')
        endpoint = 'https://discord.com/api/v10/channels/' + channel_id + '/messages'
        headers = {'Authorization': 'Bot ' + bot_token}
        params = {}
    elif not re.fullmatch(r'https://(?:discord\.com|discordapp\.com)/api/webhooks/\d+/[A-Za-z0-9._-]+', webhook):
        raise ValueError('Configure a valid DISCORD_NEWS_WEBHOOK_URL')
    else:
        endpoint = webhook
    if marker.exists():
        raise RuntimeError('Delivery already sent or pending; inspect the daily state file before retrying')
    paths = [p for p in paths if p.suffix.lower() == '.png']
    if not paths:
        raise ValueError('Discord delivery requires report images')
    if len(paths) > 2 or sum(p.stat().st_size for p in paths) > 9_000_000:
        raise ValueError('Report exceeds conservative Discord attachment budget')
    payload = {'content': 'חדשות הבוקר - ' + date.fromisoformat(day).strftime('%d.%m.%Y'),
               'allowed_mentions': {'parse': []},
               'attachments': [{'id': i, 'filename': p.name} for i, p in enumerate(paths)]}
    # Record BEFORE POST: on timeout/crash Discord may already have accepted it.
    # Never blindly retry an ambiguous delivery, even after process restart.
    save_state(marker, {'status': 'pending', 'day': day})
    for attempt in range(3):
        try:
            with ExitStack() as stack:
                files = {f'files[{i}]': (p.name, stack.enter_context(p.open('rb')),
                          'image/png' if p.suffix == '.png' else 'text/html') for i, p in enumerate(paths)}
                response = requests.post(endpoint, params=params, headers=headers,
                    data={'payload_json': json.dumps(payload, ensure_ascii=False)}, files=files, timeout=60)
        except requests.RequestException:
            raise RuntimeError('Discord delivery outcome unknown; pending marker retained. Check the channel before retrying.') from None
        if response.status_code == 429:
            if attempt < 2:
                try:
                    wait = float(response.json().get('retry_after', 2))
                except (ValueError, TypeError):
                    wait = 2
                time.sleep(min(max(wait, 1), 60))
                continue
            marker.unlink()  # Explicit rejection; safe to retry later.
            raise RuntimeError('Discord rate limited the report')
        if 400 <= response.status_code < 500:
            marker.unlink()
            raise RuntimeError('Discord rejected report (HTTP ' + str(response.status_code) + ')')
        if not 200 <= response.status_code < 300:
            raise RuntimeError('Discord returned an ambiguous server error; pending marker retained')
        try:
            message_id = response.json()['id']
        except (ValueError, KeyError):
            raise RuntimeError('Discord response could not be confirmed; pending marker retained') from None
        save_state(marker, {'status': 'sent', 'day': day, 'message_id': message_id})
        return message_id
