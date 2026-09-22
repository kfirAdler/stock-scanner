from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from unittest.mock import Mock
import json
import pytest
import requests
from src.daily_news import sources, summary, delivery, job
from src.daily_news.render import render

NOW = datetime(2026, 9, 22, 12, tzinfo=timezone.utc)


def source(**overrides):
    return dict(dict(id='1', title='Apple announces new product', text='', url='https://example.com/1',
                     source='Example', published_at=NOW.isoformat(), category='companies',
                     kind='headline', tickers=['AAPL']), **overrides)


@pytest.mark.parametrize('offset,include', [(-24, True), (-24.01, False), (0, True), (0.01, False)])
def test_rss_window(offset, include):
    date = format_datetime(NOW + timedelta(hours=offset))
    xml = f'<rss><channel><item><title>News</title><link>https://example.com</link><pubDate>{date}</pubDate></item></channel></rss>'
    assert bool(sources.parse_rss(xml, 'market', NOW)) is include


@pytest.mark.parametrize('date', ['', 'bad', 'Tue, 22 Sep 2026 12:00:00'])
def test_unknown_dates_are_not_today(date):
    xml = f'<rss><channel><item><title>News</title><link>https://example.com</link><pubDate>{date}</pubDate></item></channel></rss>'
    assert sources.parse_rss(xml, 'market', NOW) == []


def test_dedup_and_mega_cap_order():
    normal = source(title='Retail earnings', tickers=[], url='https://example.com/2')
    items = sources.prepare([normal, source(), source()])
    assert len(items) == 2
    assert items[0]['tickers'] == ['AAPL']


def test_fallback_no_credentials(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    monkeypatch.setattr(summary.requests, 'post', lambda *a, **k: pytest.fail('No API calls expected'))
    items, warning = summary.summarize([source()])
    assert items[0]['title'] == source()['title']
    assert warning


def test_fabricated_source_rejected():
    with pytest.raises(ValueError, match='source'):
        summary.validate({'items': [dict(category='companies', title='כותרת', summary='תקציר',
                                         tickers=['AAPL'], source_ids=['fake'])]}, [source()])


def test_social_label_is_enforced_outside_model():
    item = dict(category='companies', title='כותרת', summary='תקציר', tickers=[], source_ids=['1'])
    assert summary.validate({'items': [item]}, [source(kind='social')])[0]['social_only']


@pytest.mark.parametrize('month,utc_hour', [(1, 13), (7, 12), (3, 12), (10, 13)])
def test_schedule_israel_dst(month, utc_hour):
    now = datetime(2026, month, 28, utc_hour, tzinfo=timezone.utc)
    assert job.scheduled_cutoff(now) == now
    assert job.scheduled_cutoff(now-timedelta(seconds=1)) is None


def test_html_escapes_untrusted_text():
    report = job.demo_report(NOW)
    report['items'][0]['title'] = '<script>alert(1)</script>'
    report['items'][0]['sources'][0]['url'] = 'javascript:alert(1)'
    html = render(report)
    assert '<script>' not in html
    assert 'javascript:' not in html
    assert '&lt;script&gt;' in html
    assert 'dir="rtl"' in html


def test_timeout_leaves_pending_and_no_second_send(tmp_path, monkeypatch):
    path = tmp_path / 'report.html'
    path.write_text('report')
    marker = tmp_path / 'state.json'
    post = Mock(side_effect=requests.Timeout())
    monkeypatch.setattr(delivery.requests, 'post', post)
    with pytest.raises(RuntimeError, match='unknown'):
        delivery.deliver([path], 'https://discord.com/api/webhooks/123/token', marker, '2026-09-22')
    assert json.loads(marker.read_text())['status'] == 'pending'
    with pytest.raises(RuntimeError, match='already'):
        delivery.deliver([path], 'https://discord.com/api/webhooks/123/token', marker, '2026-09-22')
    assert post.call_count == 1


def test_success_records_message_and_suppresses_mentions(tmp_path, monkeypatch):
    path = tmp_path / 'report.html'
    path.write_text('report')
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'id': '456'}))
    monkeypatch.setattr(delivery.requests, 'post', post)
    marker = tmp_path / 'state.json'
    delivery.deliver([path], 'https://discord.com/api/webhooks/123/token', marker, '2026-09-22')
    assert json.loads(marker.read_text())['message_id'] == '456'
    assert json.loads(post.call_args.kwargs['data']['payload_json'])['allowed_mentions'] == {'parse': []}


def test_rate_limit_retries_explicit_rejection(tmp_path, monkeypatch):
    path = tmp_path / 'report.html'
    path.write_text('report')
    post = Mock(side_effect=[Mock(status_code=429, json=lambda: {'retry_after': 1}),
                             Mock(status_code=200, json=lambda: {'id': '456'})])
    monkeypatch.setattr(delivery.requests, 'post', post)
    monkeypatch.setattr(delivery.time, 'sleep', lambda _: None)
    delivery.deliver([path], 'https://discord.com/api/webhooks/123/token', tmp_path/'state.json', '2026-09-22')
    assert post.call_count == 2


def test_empty_news_does_not_generate_report(monkeypatch):
    monkeypatch.setattr(job, 'collect_rss', lambda _: ([], []))
    monkeypatch.setattr(job, 'collect_x', lambda _: ([], []))
    with pytest.raises(RuntimeError, match='No timestamped'):
        job.build(NOW)


def test_default_run_never_sends(tmp_path, monkeypatch):
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(job, 'deliver', lambda *a: pytest.fail('Unexpected send'))
    paths = job.run(tmp_path/'out', tmp_path/'state', images=False, cutoff=NOW)
    assert paths[0].is_file()
    assert not (tmp_path/'state'/'2026-09-22.json').exists()


def test_pending_skips_rebuild(tmp_path, monkeypatch):
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: pytest.fail('Should not rebuild'))
    (tmp_path/'2026-09-22.json').write_text('{"status":"pending"}')
    assert job.run(tmp_path/'out', tmp_path, send=True, cutoff=NOW) == []


def test_demo_cannot_send(tmp_path):
    with pytest.raises(ValueError, match='Demo'):
        job.run(tmp_path, tmp_path, send=True, demo=True)


def test_bot_delivery_uses_channel_and_authorization(tmp_path, monkeypatch):
    path = tmp_path/'report.html'
    path.write_text('report')
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'id': '456'}))
    monkeypatch.setattr(delivery.requests, 'post', post)
    delivery.deliver([path], '', tmp_path/'state.json', '2026-09-22',
                     bot_token='test-token', channel_id='123456789012345678')
    assert post.call_args.args[0] == 'https://discord.com/api/v10/channels/123456789012345678/messages'
    assert post.call_args.kwargs['headers'] == {'Authorization': 'Bot test-token'}
    assert post.call_args.kwargs['params'] == {}


def test_bot_without_channel_fails_before_send(tmp_path, monkeypatch):
    monkeypatch.setattr(delivery.requests, 'post', lambda *a, **k: pytest.fail('Unexpected send'))
    with pytest.raises(ValueError, match='CHANNEL_ID'):
        delivery.deliver([], '', tmp_path/'state.json', '2026-09-22', bot_token='test-token')
    assert not (tmp_path/'state.json').exists()


def test_fallback_preserves_broad_coverage_and_orders_mega_caps_first():
    items = [source(id=str(i), title=f'Apple news {i}', url=f'https://example.com/{i}') for i in range(12)]
    items += [source(id=str(i), title=f'Bank earnings {i}', url=f'https://example.com/{i}', tickers=[]) for i in range(12, 24)]
    result = summary.fallback(items)
    assert len(result) == 16
    assert all(r['tickers'] == ['AAPL'] for r in result[:8])
    assert all(not r['tickers'] for r in result[8:])


def test_model_response_is_validated(monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    payload = {'items': [dict(category='companies', title='עדכון חברה', summary='תקציר בעברית', tickers=['AAPL'], source_ids=['1'])]}
    response = Mock(status_code=200, json=lambda: {'status':'completed', 'output':[{'content':[{'type':'output_text','text':json.dumps(payload)}]}]})
    monkeypatch.setattr(summary.requests, 'post', Mock(return_value=response))
    result, warning = summary.summarize([source()])
    assert not warning
    assert result[0]['summary'] == 'תקציר בעברית'
    assert result[0]['sources'][0]['url'] == source()['url']


def test_model_incomplete_falls_back(monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'test-key')
    monkeypatch.setattr(summary.requests, 'post', Mock(return_value=Mock(status_code=200, json=lambda: {'status': 'incomplete'})))
    result, warning = summary.summarize([source()])
    assert warning
    assert result[0]['title'] == source()['title']


def test_channel_lookup_requires_unique_name(monkeypatch):
    monkeypatch.delenv('DISCORD_GUILD_ID', raising=False)
    monkeypatch.setenv('DISCORD_NEWS_CHANNEL_NAME', 'stock-news')
    def get(url, **kwargs):
        if '/users/' in url:
            return Mock(status_code=200, json=lambda: [{'id': 'one'}, {'id': 'two'}])
        return Mock(status_code=200, json=lambda: [{'id': '123456789012345678', 'name': 'stock-news', 'type': 0}])
    monkeypatch.setattr(delivery.requests, 'get', get)
    with pytest.raises(ValueError, match='ambiguous'):
        delivery.resolve_channel('test')


def test_channel_lookup_uses_unique_text_channel(monkeypatch):
    monkeypatch.delenv('DISCORD_GUILD_ID', raising=False)
    monkeypatch.setenv('DISCORD_NEWS_CHANNEL_NAME', 'stock-news')
    responses = [Mock(status_code=200, json=lambda: [{'id': 'one'}]),
                 Mock(status_code=200, json=lambda: [{'id': '123456789012345678', 'name': 'stock-news', 'type': 0}])]
    monkeypatch.setattr(delivery.requests, 'get', Mock(side_effect=responses))
    assert delivery.resolve_channel('test') == '123456789012345678'


def test_remote_claim_conflict_prevents_send(tmp_path, monkeypatch):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = None
    remote.claim.return_value = False
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(job, 'deliver', lambda *a, **k: pytest.fail('Duplicate send'))
    assert job.run(tmp_path/'out', tmp_path/'state', send=True, images=False, cutoff=NOW)
    remote.sent.assert_not_called()


def test_remote_pending_prevents_rebuild(tmp_path, monkeypatch):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = 'pending'
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setattr(job, 'build', lambda _: pytest.fail('Should not rebuild'))
    with pytest.raises(RuntimeError, match='Pending remote'):
        job.run(tmp_path, tmp_path, send=True, images=False, cutoff=NOW)


def test_remote_ambiguous_failure_retains_claim(tmp_path, monkeypatch):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = None
    remote.claim.return_value = True
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(delivery.requests, 'post', Mock(side_effect=requests.Timeout()))
    with pytest.raises(RuntimeError, match='unknown'):
        job.run(tmp_path/'out', tmp_path/'state', send=True, images=False, cutoff=NOW)
    remote.release.assert_not_called()
    remote.sent.assert_not_called()


def test_remote_explicit_rejection_releases_claim(tmp_path, monkeypatch):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = None
    remote.claim.return_value = True
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(delivery.requests, 'post', Mock(return_value=Mock(status_code=403)))
    with pytest.raises(RuntimeError, match='rejected'):
        job.run(tmp_path/'out', tmp_path/'state', send=True, images=False, cutoff=NOW)
    remote.release.assert_called_once_with('2026-09-22')


def test_remote_success_records_discord_id(tmp_path, monkeypatch):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = None
    remote.claim.return_value = True
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(delivery.requests, 'post', Mock(return_value=Mock(status_code=200, json=lambda: {'id':'message-123'})))
    job.run(tmp_path/'out', tmp_path/'state', send=True, images=False, cutoff=NOW)
    remote.sent.assert_called_once_with('2026-09-22','message-123')
