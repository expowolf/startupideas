# Swing Desk

Local single-ticker research dashboard for swing trading (days to a few weeks).
Runs **locally only**: Yahoo rate-limits cloud IPs.

## Status

- [x] Phase 1: engine skeleton (FastAPI, yfinance + FRED clients, SQLite cache, backoff, coverage script)
- [ ] Phase 2: frontend shell + price panel
- [ ] Phases 3-7: see `BUILD_PROMPT.md` section 8

## Setup

```bash
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env        # then add your FRED_API_KEY
```

## Run

```bash
# from engine/
python -m scripts.validate              # coverage report: AAPL, MSFT, AMSF + every FRED series
python -m scripts.validate NVDA CALM    # or your own tickers
uvicorn app.main:app --reload --port 8000
pytest                                  # offline tests, no network needed
```

Endpoints: `GET /health`, `GET /api/prices/{ticker}`, `GET /api/macro/{series_id}`.

Cached data lives in `engine/data/desk.db` (prices 12h, earnings 24h, FRED 12h).
Delete the file to force a refetch.
