"""Process queued pattern searches using the existing Supabase credentials."""
import logging
from src.jobs.process_pattern_requests import run

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run()
    print(result)
    raise SystemExit(1 if result["failed"] else 0)
