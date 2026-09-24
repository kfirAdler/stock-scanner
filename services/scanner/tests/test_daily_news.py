from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from pathlib import Path
from unittest.mock import Mock
import json
import pytest
import requests
import run_daily_news
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
    item = dict(category='companies', title='כותרת', summary='תקציר', tickers=['AAPL'], source_ids=['1'])
    assert summary.validate({'items': [item]}, [source(kind='social')])[0]['social_only']


@pytest.mark.parametrize('month,utc_hour', [(1, 13), (7, 12), (3, 12), (10, 13)])
def test_schedule_israel_dst(month, utc_hour):
    now = datetime(2026, month, 28, utc_hour, tzinfo=timezone.utc)
    assert job.scheduled_cutoff(now) == now
    assert job.scheduled_cutoff(now-timedelta(seconds=1)) is None


def test_scheduled_cli_enables_remote_deduplication(monkeypatch):
    run = Mock(return_value=[])
    monkeypatch.setattr(job, 'run', run)
    monkeypatch.setattr(job, 'scheduled_cutoff', lambda _: NOW)
    monkeypatch.setattr('sys.argv', ['run_daily_news.py', '--send', '--scheduled'])

    run_daily_news.main()

    assert run.call_args.kwargs['cutoff'] == NOW
    assert run.call_args.kwargs['scheduled'] is True


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
    path = tmp_path / 'report.png'
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


def test_success_records_message_and_allows_only_everyone(tmp_path, monkeypatch):
    path = tmp_path / 'report.png'
    path.write_text('report')
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'id': '456'}))
    monkeypatch.setattr(delivery.requests, 'post', post)
    marker = tmp_path / 'state.json'
    delivery.deliver([path], 'https://discord.com/api/webhooks/123/token', marker, '2026-09-22')
    assert json.loads(marker.read_text())['message_id'] == '456'
    assert json.loads(post.call_args.kwargs['data']['payload_json'])['allowed_mentions'] == {'parse': ['everyone'], 'users': [], 'roles': []}


def test_rate_limit_retries_explicit_rejection(tmp_path, monkeypatch):
    path = tmp_path / 'report.png'
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
    assert job.run(tmp_path/'out', tmp_path, send=True, cutoff=NOW, scheduled=True) == []


def test_demo_cannot_send(tmp_path):
    with pytest.raises(ValueError, match='Demo'):
        job.run(tmp_path, tmp_path, send=True, demo=True)


def test_bot_delivery_uses_channel_and_authorization(tmp_path, monkeypatch):
    path = tmp_path/'report.png'
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
    items = [source(title='Nvidia launches new AI chip', tickers=['NVDA']),
             source(title='Apple raises revenue guidance', tickers=['AAPL']),
             source(title='Pfizer wins FDA approval', tickers=['PFE']),
             source(title='JPMorgan announces acquisition', tickers=['JPM'])]
    result = summary.fallback(items)
    assert len(result) == 4
    assert all(set(r['tickers']) & sources.PRIORITY for r in result[:2])
    assert {r['tickers'][0] for r in result[2:]} == {'PFE', 'JPM'}


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


def test_remote_claim_conflict_prevents_send(tmp_path, monkeypatch, fake_render):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = None
    remote.claim.return_value = False
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(job, 'deliver', lambda *a, **k: pytest.fail('Duplicate send'))
    assert job.run(tmp_path/'out', tmp_path/'state', send=True, images=True,
                   cutoff=NOW, scheduled=True)
    remote.sent.assert_not_called()


def test_remote_pending_prevents_rebuild(tmp_path, monkeypatch, fake_render):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = 'pending'
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setattr(job, 'build', lambda _: pytest.fail('Should not rebuild'))
    with pytest.raises(RuntimeError, match='Pending remote'):
        job.run(tmp_path, tmp_path, send=True, images=True, cutoff=NOW, scheduled=True)


def test_remote_ambiguous_failure_retains_claim(tmp_path, monkeypatch, fake_render):
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
        job.run(tmp_path/'out', tmp_path/'state', send=True, images=True,
                cutoff=NOW, scheduled=True)
    remote.release.assert_not_called()
    remote.sent.assert_not_called()


def test_remote_explicit_rejection_releases_claim(tmp_path, monkeypatch, fake_render):
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
        job.run(tmp_path/'out', tmp_path/'state', send=True, images=True,
                cutoff=NOW, scheduled=True)
    remote.release.assert_called_once_with('2026-09-22')


def test_remote_success_records_discord_id(tmp_path, monkeypatch, fake_render):
    from src.daily_news import journal
    remote = Mock()
    remote.status.return_value = None
    remote.claim.return_value = True
    monkeypatch.setattr(journal, 'Journal', lambda: remote)
    monkeypatch.setenv('NEWS_STATE_BACKEND', 'supabase')
    monkeypatch.setenv('DISCORD_NEWS_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/token')
    monkeypatch.setattr(job, 'build', lambda _: job.demo_report(NOW))
    monkeypatch.setattr(delivery.requests, 'post', Mock(return_value=Mock(status_code=200, json=lambda: {'id':'message-123'})))
    job.run(tmp_path/'out', tmp_path/'state', send=True, images=True,
            cutoff=NOW, scheduled=True)
    remote.sent.assert_called_once_with('2026-09-22','message-123')


@pytest.fixture
def fake_render(monkeypatch):
    def write(report, directory, images=True):
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / 'news-01.png'
        path.write_bytes(b'fake png for mocked transport')
        return [path]
    monkeypatch.setattr(job, 'write_report', write)


def test_discord_only_sends_png_with_requested_caption(tmp_path, monkeypatch):
    png, html = tmp_path/'news-01.png', tmp_path/'report.html'
    png.write_bytes(b'image')
    html.write_text('local report')
    post = Mock(return_value=Mock(status_code=200, json=lambda: {'id': '456'}))
    monkeypatch.setattr(delivery.requests, 'post', post)
    delivery.deliver([html, png], 'https://discord.com/api/webhooks/123/token', tmp_path/'state.json', '2026-09-22')
    payload = json.loads(post.call_args.kwargs['data']['payload_json'])
    assert payload['content'] == '@everyone חדשות הבוקר - 22.09.2026'
    assert payload['attachments'] == [{'id': 0, 'filename': 'news-01.png'}]
    assert len(post.call_args.kwargs['files']) == 1


def test_html_only_cannot_be_sent(tmp_path):
    with pytest.raises(ValueError, match='requires images'):
        job.run(tmp_path, tmp_path, send=True, images=False)


def test_curation_drops_foreign_indices_fluff_and_duplicate_earnings():
    items = [source(title='Kospi Barely Holds 7,000 Despite Surge in US Chip Stocks', tickers=[]),
             source(title='Best stocks to buy: Nvidia', tickers=['NVDA']),
             source(title='AutoZone posts upbeat earnings', tickers=['AZO']),
             source(title='AZO Q4 earnings beat expectations', tickers=['AZO'])]
    result = summary.fallback(items)
    assert len(result) == 1
    assert result[0]['tickers'] == ['AZO']


def test_company_names_are_replaced_and_only_tickers_are_bold():
    from src.daily_news.render import news_text
    item = dict(category='companies', title='', tickers=['NVDA', 'MSFT'], sources=[])
    result = news_text('Nvidia announces a deal with Microsoft', item)
    assert 'Nvidia' not in result and 'Microsoft' not in result
    assert '<strong>$NVDA</strong>' in result and '<strong>$MSFT</strong>' in result
    assert 'announces a deal with' in result
    assert '<strong>announces' not in result


def test_catalogue_names_replace_non_mega_caps():
    from src.daily_news.render import news_text
    item = dict(category='companies', tickers=['LLY'], sources=[{'company_names': {'LLY': ['Eli Lilly']}}])
    assert 'Eli Lilly' not in news_text('Eli Lilly announces a new trial', item)
    assert '<strong>$LLY</strong>' in news_text('Eli Lilly announces a new trial', item)


def test_unknown_company_tickers_are_not_invented():
    assert summary.fallback([source(title='Unknown Firm announces acquisition', tickers=[])]) == []


def test_overview_is_not_repeated_on_second_page():
    report = job.demo_report(NOW)
    html = render(report, page_label='2 / 2', overview=False)
    assert 'S&amp;P 500' not in html
    assert report['warnings'][0] not in html


def test_retrospectives_and_valuation_listicles_are_excluded():
    items = [source(title='Reflecting On Therapeutics Stocks Q2 Earnings: AbbVie', tickers=['ABBV']),
             source(title='Morgan Stanley says to buy these 15 stocks', tickers=['MS']),
             source(title='Nvidia stock valuation hits decade low despite profit boom', tickers=['NVDA'])]
    assert summary.fallback(items) == []


def test_explicit_company_identity_replaces_name_and_exchange_label():
    from src.daily_news.tickers import explicit_names
    from src.daily_news.render import news_text
    title = 'Vulcan Materials (NYSE:VMC) raises guidance'
    names = explicit_names(title)
    item = dict(category='companies', tickers=['VMC'], sources=[{'company_names': names}])
    html = news_text(title, item)
    assert 'Vulcan' not in html and 'NYSE' not in html
    assert html.count('<strong>$VMC</strong>') == 1


def test_discord_rejects_more_than_two_images(tmp_path):
    paths = [tmp_path/f'news-{i}.png' for i in range(3)]
    for path in paths:
        path.write_bytes(b'image')
    marker = tmp_path/'state.json'
    with pytest.raises(ValueError, match='budget'):
        delivery.deliver(paths, 'https://discord.com/api/webhooks/123/token', marker, '2026-09-22')
    assert not marker.exists()


def test_exchange_label_is_not_identified_as_nasdaq_company():
    item = source(title='ExlService (NASDAQ:EXLS) raises guidance', tickers=[])
    prepared = sources.prepare([item], {'NDAQ': ['Nasdaq'], 'EXLS': ['ExlService']})[0]
    assert prepared['tickers'] == ['EXLS']
    assert 'NDAQ' not in prepared['company_names']


def test_market_dates_are_grouped_instead_of_repeated_in_cards():
    from src.daily_news.render import quote_notes
    quotes = [dict(label='S&P 500',value=100,change=1,session_date='2026-09-22'),
              dict(label='Nasdaq',value=100,change=1,session_date='2026-09-22'),
              dict(label='Bitcoin',value=100,change=1,session_date='2026-09-23'),
              dict(label='Dow Jones',value=None,change=None,session_date='')]
    notes = quote_notes(quotes)
    assert notes.count('22.09') == 1 and notes.count('23.09') == 1
    assert 'S&P 500, Nasdaq' in notes and 'נתון חסר: Dow Jones' in notes
    report = job.demo_report(NOW)
    report['quotes'] = quotes
    cards = render(report).split('<div class="quotes">')[1].split('quote-notes')[0]
    assert '<small>' not in cards
    assert 'Dow Jones' not in cards


def test_company_possessive_and_duplicate_ticker_are_normalized():
    from src.daily_news.render import news_text
    item = dict(category='companies',tickers=['KBH'],sources=[])
    result = news_text("KB Home’s (KBH) Q3 CY2026 Earnings Results: Revenue In Line", item)
    assert 'KB Home' not in result
    assert result.count('<strong>$KBH</strong>') == 1
    assert 'Q3 2026:' in result


def test_paypal_partnership_keeps_fact_and_drops_promotional_sentence():
    from src.daily_news.render import news_text
    prepared = sources.prepare([source(title="PayPal Announces Meta Muse Partnership. It’s a Lifeline for the Stock.")])
    item = summary.fallback(prepared)[0]
    text = news_text(item['title'], item)
    assert '<strong>$PYPL</strong>' in text and '<strong>$META</strong>' in text
    assert 'Partnership' in text and 'Lifeline' not in text and 'PayPal' not in text


def test_low_information_toolkit_and_stock_picking_headlines_are_dropped():
    items = [source(title="NY Fed's Perli says monetary policy toolkit working very well",category='macro'),
             source(title='Stock Market Today: Dow Skids But Apple Eyes A Buy Point',category='market')]
    assert summary.fallback(items) == []


def test_font_is_bundled_for_offline_rendering():
    from src.daily_news.render import embedded_font, CSS
    assert 'data:font/ttf;base64,' in embedded_font()
    assert 'font-family:Heebo' in CSS
    assert 'font-size:inherit;font-weight:700' in CSS


def test_question_headlines_do_not_substitute_for_market_facts():
    item = source(title='How Are Stock Futures Moving Ahead Of The Fed Meeting?', category='market')
    assert summary.fallback([item]) == []
