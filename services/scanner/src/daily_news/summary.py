"""Deterministic story selection; no language model or translation service."""
from __future__ import annotations

from .editorial import curate


def fallback(sources):
    chosen = sources if all('score' in source for source in sources) else curate(sources)
    return [dict(category=source['category'], title=source['title'], summary='',
                 tickers=source.get('tickers', []), sources=[source], social_only=False,
                 language=source.get('language', 'en'), score=source.get('score', 0))
            for source in chosen]


def summarize(sources):
    return fallback(sources), ''
