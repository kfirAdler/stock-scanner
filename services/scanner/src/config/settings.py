import os
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parents[4] / ".env.local"
if _env_path.exists():
    load_dotenv(_env_path)

SUPABASE_URL: str = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

TIMEFRAME = "1D"
RETENTION_BARS = 750
SUPPORTED_SMA_LENGTHS = [20, 50, 150, 200]
ATR_PERIOD = 14
BB_PERIOD = 20
BB_STD_DEV = 2.0
SEQUENCE_RECENT_THRESHOLD = 2

STOOQ_BASE_URL = "https://stooq.com/q/d/l/"

SP500_TICKER_SOURCE = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
TA125_TICKER_SOURCE = "https://en.wikipedia.org/wiki/TA-125_Index"
