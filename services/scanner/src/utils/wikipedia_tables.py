"""Fetch Wikipedia HTML tables (403-safe vs bare urllib)."""

import io
import logging

import pandas as pd
import requests

logger = logging.getLogger(__name__)

USER_AGENT = (
    "Mozilla/5.0 (compatible; StockScanner/1.0; +https://github.com/stock-scanner)"
)


def read_wikipedia_tables(url: str) -> list[pd.DataFrame]:
    resp = requests.get(
        url,
        headers={"User-Agent": USER_AGENT},
        timeout=60,
    )
    resp.raise_for_status()
    tables = pd.read_html(io.StringIO(resp.text), flavor="lxml")
    logger.debug("Parsed %d tables from %s", len(tables), url)
    return tables
