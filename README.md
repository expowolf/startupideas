# Swing Desk

Single-ticker research dashboard for swing trading (holds of days to a few weeks).
`BUILD_PROMPT.md` is the spec, and `MANIFESTO.md` overrides it on philosophy and design.

## Status

All seven phases are built:

- [x] 1 Engine: FastAPI, yfinance + FRED clients, SQLite cache, backoff, coverage script
- [x] 2 Shell: layout, ticker search, watchlist, candles + volume + MA20/50/200 + RSI/MACD panes, TradingView embed
- [x] 3 Earnings (surprise vs reaction, hold-window warning), fundamentals (divergence flags), valuation (own-history percentiles)
- [x] 4 Options (IV term structure, skew, expected move), macro (FRED), regime badge in the top bar
- [x] 5 Sentiment (VIX percentile, crowd signals), trap detector (+ headline tagging), verdict scorecard → "Log as trade"
- [x] 6 Trade journal + behavior analytics (setup, emotion, weekday, plan-following, disposition effect)
- [x] 7 Backtester (no look-ahead, tested), S1-S4, IS/OOS hold-out, walk-forward, variant counter, t ≥ 3 hurdle, CSV upload

**Not yet run on live data.** The build sandbox cannot reach Yahoo, so everything was tested against
synthetic data (49 engine tests). Your first local run is the real test; tell me what breaks.

## Pages

| Page | What it is for |
|---|---|
| `/t/TICKER` | All panels for one stock, ending in the Verdict: score, thesis, invalidation, exit, "Log as trade" |
| `/journal` | Every trade, plus where your results come from (setup, emotion, weekday, plan-following, hold times) |
| `/lab` | Backtest S1-S3 (+ S4 regime filter) on tickers or an uploaded CSV |
| `/settings` | Scorecard weights (saved in your browser) |

## How it runs (no computer needed)

```
GitHub Action (weekdays after the US close)          Vercel website
  watchlist.txt -> engine/scripts/snapshot.py -> data branch -> reads JSON
GitHub Action "Run backtest" (you click Run) -> data branch -> Lab "Load latest result"
```

- **Data:** the *Nightly data snapshot* Action runs every weekday at 22:37 UTC. It runs every
  analysis for the tickers in [`watchlist.txt`](watchlist.txt) and publishes JSON to the `data` branch.
  To add a ticker, edit `watchlist.txt` on GitHub (max 60); a fresh snapshot starts automatically when
  you commit the change (~5-10 min), or run the Action by hand: Actions -> *Nightly data snapshot* -> *Run workflow*.
- **Macro + regime badge:** add a free FRED key as a repo secret named `FRED_API_KEY`
  (Settings -> Secrets and variables -> Actions). Without it those panels stay empty.
- **Journal:** stored in your browser. Use *Export* on the Journal page to back it up.
- **Backtests:** on the Lab page click *Prepare GitHub run*, copy the request, paste it into
  Actions -> *Run backtest* -> *Run workflow*, then *Load latest result* a few minutes later.
- **Vercel:** Root Directory `web`. Leave `NEXT_PUBLIC_ENGINE_URL` **unset** (setting it switches the
  site to live-engine mode).

The site reads `https://raw.githubusercontent.com/expowolf/startupideas/data/...`, so the repo must
stay public. A private repo would need the data published elsewhere.

## Optional: live engine on your computer

Any ticker on demand, journal in SQLite, CSV uploads in the lab. Windows commands:

```bash
cd engine
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy ..\.env.example .env          # add FRED_API_KEY
uvicorn app.main:app --port 8000

cd ..\web
npm install
echo NEXT_PUBLIC_ENGINE_URL=http://localhost:8000 > .env.local
npm run dev                         # http://localhost:3000
```

Engine tools (from `engine/`): `python -m scripts.validate` (data coverage report), `pytest` (offline tests).

## Decisions log

| Topic | Decision | Why |
|---|---|---|
| Hosting | Vercel UI + nightly GitHub Action snapshot (live engine optional) | Swing trading needs daily bars, not live quotes; free, nothing left running. Yahoo blocks many cloud IPs, so the Action fails loudly if it gets no prices |
| "Hedge fund algorithms" | Not built as such | Proprietary. We implement the published anomalies they trade (S1-S3) |
| Manipulation detection | "Trap detector" from daily OHLCV + yfinance headlines (phase 5) | Spoofing needs paid order-book data. Panel measures failed breakouts, stop sweeps and faded news gaps; it does not claim who caused them |
| TradingView | Free embed widget as a second chart tab | No account API exists. Widget data is display-only and never feeds the scorecard or backtests |
| FinanceDatabase | Not needed after all | Sector → ETF mapping is a fixed 11-row table (Yahoo sector → SPDR fund); a 100 MB dependency was not worth it |
| Regime rule | SPY vs 200-day average + VIX (25 / 20 thresholds), fixed in advance | High-yield spread shown but excluded: FRED only serves ~3 years of it, so it can't be backtested |
| Revenue-surprise filter (S1) | Not offered | yfinance has no history of revenue estimates |
| Yield curve | Added DGS1, DGS5, DGS30 to the FRED list | Three points don't make a curve; `scripts.validate` checks them like the rest |
| investing-algorithm-framework | Not adopted | Lacks the variant counter, IS/OOS hold-out and t-stat hurdle this spec requires |
| Congress trades | Not built yet (pending your call) | See research below |
| shadcn/ui | Components hand-written in shadcn style | The shadcn registry was unreachable from the build sandbox; run `npx shadcn add …` locally if you want the originals |

### Congress trading research (kadoa-org/congress-trading-monitor)

- Data is a **static JSON snapshot** (~157 MB) committed to their repo, built from House Clerk, Senate eFD and OGE filings. The repo has no scraper; Kadoa collects the data with its paid service, and "continuous updates" require contacting Kadoa sales.
- In its latest 5,000 trades, the **median delay from trade to disclosure is 61 days**, and 59% were flagged late.
- For a 2-week swing hold, that is history, not a signal.
