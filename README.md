# Swing Desk

Single-ticker research dashboard for swing trading (holds of days to a few weeks).
`BUILD_PROMPT.md` is the spec, and `MANIFESTO.md` overrides it on philosophy and design.

## Status

- [x] Phase 1: engine (FastAPI, yfinance + FRED clients, SQLite cache, backoff, coverage script)
- [x] Phase 2: frontend shell, ticker search, watchlist, price panel (candles, volume, MA20/50/200), TradingView embed
- [ ] Phase 3: earnings, fundamentals, valuation
- [ ] Phase 4: options, macro, regime badge
- [ ] Phase 5: sentiment, trap detector, verdict/scorecard
- [ ] Phase 6: trade journal + analytics
- [ ] Phase 7: backtest engine + S1-S4 + lab UI

## Setup

```bash
# engine
cd engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env            # add FRED_API_KEY

# web
cd ../web
npm install
cp .env.example .env.local
```

## Run locally

```bash
# terminal 1, from engine/
uvicorn app.main:app --reload --port 8000

# terminal 2, from web/
npm run dev                        # http://localhost:3000
```

Other engine commands (from `engine/`):

```bash
python -m scripts.validate              # data coverage: AAPL, MSFT, AMSF + every FRED series
python -m scripts.validate NVDA CALM    # your own tickers
pytest                                  # offline tests
```

## Deploying the UI to Vercel

The engine **cannot** run on Vercel: Yahoo blocks cloud IPs, and Vercel's filesystem does not keep SQLite.
So the UI goes on Vercel and the engine stays on your machine, reached through an HTTPS tunnel.

1. Start the engine locally, then expose it: `cloudflared tunnel --url http://localhost:8000` (free; prints an `https://….trycloudflare.com` URL).
2. Vercel → New Project → import this repo → set **Root Directory** to `web`.
3. Add env var `NEXT_PUBLIC_ENGINE_URL` = the tunnel URL, then deploy.
4. In `engine/.env` set `ALLOWED_ORIGINS=http://localhost:3000,https://<your-app>.vercel.app` and restart the engine.

The site only shows data while your computer and the tunnel are running. Quick tunnels get a new URL each run; a named Cloudflare tunnel keeps a fixed one.

## Decisions log

| Topic | Decision | Why |
|---|---|---|
| Hosting | Vercel UI + local engine | Yahoo blocks cloud IPs (confirmed: this build sandbox was refused too) |
| "Hedge fund algorithms" | Not built as such | Proprietary. We implement the published anomalies they trade (S1-S3) |
| Manipulation detection | "Trap detector" from daily OHLCV + yfinance headlines (phase 5) | Spoofing needs paid order-book data. Panel measures failed breakouts, stop sweeps and faded news gaps; it does not claim who caused them |
| TradingView | Free embed widget as a second chart tab | No account API exists. Widget data is display-only and never feeds the scorecard or backtests |
| FinanceDatabase | Adopt in phase 3 for sector/industry → sector ETF mapping | Free, MIT, fills a gap in the spec |
| investing-algorithm-framework | Not adopted | Lacks the variant counter, IS/OOS hold-out and t-stat hurdle this spec requires |
| Congress trades | Not built yet (pending your call) | See research below |
| shadcn/ui | Components hand-written in shadcn style | The shadcn registry was unreachable from the build sandbox; run `npx shadcn add …` locally if you want the originals |

### Congress trading research (kadoa-org/congress-trading-monitor)

- Data is a **static JSON snapshot** (~157 MB) committed to their repo, built from House Clerk, Senate eFD and OGE filings. The repo has no scraper; Kadoa collects the data with its paid service, and "continuous updates" require contacting Kadoa sales.
- In its latest 5,000 trades, the **median delay from trade to disclosure is 61 days**, and 59% were flagged late.
- For a 2-week swing hold, that is history, not a signal.
