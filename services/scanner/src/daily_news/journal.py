"""Durable cross-run delivery journal for ephemeral GitHub Actions runners."""
from __future__ import annotations
import os
from datetime import datetime, timezone
import requests


class Journal:
    def __init__(self):
        url = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
        key = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
        if not url.startswith('https://') or not key:
            raise ValueError('Supabase URL and service role key are required for remote delivery state')
        self.url = url + '/rest/v1/daily_news_deliveries'
        self.headers = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'return=minimal'}

    def request(self, method, **kwargs):
        try:
            return requests.request(method, self.url, headers=self.headers, timeout=20, **kwargs)
        except requests.RequestException:
            raise RuntimeError('Delivery journal is unavailable') from None

    def status(self, day):
        response = self.request('GET', params={'market_date': 'eq.' + day, 'select': 'status', 'limit': 1})
        if response.status_code != 200:
            raise RuntimeError('Cannot read delivery journal; check migration 026 and Supabase secrets')
        rows = response.json()
        return rows[0]['status'] if rows else None

    def claim(self, day, channel, report):
        response = self.request('POST', json={'market_date': day, 'channel_id': channel, 'status': 'pending', 'report': report})
        if response.status_code == 409:
            return False
        if response.status_code != 201:
            raise RuntimeError('Cannot reserve daily delivery')
        return True

    def sent(self, day, message_id):
        response = self.request('PATCH', params={'market_date': 'eq.' + day},
                                json={'status': 'sent', 'message_id': message_id, 'sent_at': datetime.now(timezone.utc).isoformat()})
        if response.status_code not in (200, 204):
            raise RuntimeError('Report sent but journal confirmation failed; check the Discord channel')

    def release(self, day):
        response = self.request('DELETE', params={'market_date': 'eq.' + day, 'status': 'eq.pending'})
        if response.status_code not in (200, 204):
            raise RuntimeError('Discord rejected the report but the pending reservation could not be released')
