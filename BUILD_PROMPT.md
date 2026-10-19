# Build Prompt: Swing Desk (working name)

> Paste this whole file into Claude Code as the first message in an empty project folder.
> If a `MANIFESTO.md` exists in the project root, read it first. Where it conflicts with this file on philosophy, design, or priorities, the manifesto wins. Where it conflicts on data sources or anti-overfitting rules, stop and ask me.

---

## 1. What we're building

A local, single-ticker research dashboard for **swing trading (holding period: days to a few weeks)**. It should feel like an institutional terminal: dense, fast, dark, precise. It combines seven panels into one ticker page plus a backtest lab and a trade journal.

The goal is a **repeatable decision process**, not more data. Every ticker page ends in a verdict: scorecard, written thesis, invalidation level, exit plan.

**Hard rule:** if a feature has no clean free data source, cut it. Do not build placeholder charts that sit empty. Do not invent or simulate data.

## 2. Stack

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- **Animation/UI:** components from 21st.dev (use the 21st.dev Magic MCP if I have it configured; otherwise copy component code via the shadcn CLI), plus Magic UI, Aceternity UI, Animate UI, React Bits, and the `motion` library (formerly Framer Motion)
- **Charts:** TradingView `lightweight-charts` for candlesticks/volume/indicators; Recharts for everything else
- **Backend:** Python FastAPI service in `/engine`
- **Data:** `yfinance` (prices, financials, earnings, options chain) and FRED via `fredapi` (macro). FRED key in `.env` as `FRED_API_KEY`
- **Storage:** SQLite (`/engine/data/desk.db`) for cached data, journal entries, and backtest results
- **Runs locally only.** Yahoo rate-limits cloud IPs, so no Vercel deploy for the engine.

## 3. Design direction

- Dark terminal aesthetic. Monospace numerals (tabular figures). Green/red used only for direction, never decoration.
- **Animation is restrained.** Allowed: number count-ups on load, panel fade/slide-in, animated tab switching, hover glow on cards, a subtle animated background on the landing/search screen only. **Not allowed:** animations on chart data that delay reading a price, looping motion inside panels, anything that slows the page. Respect `prefers-reduced-motion`.
- Layout: left sidebar (watchlist, nav), top bar (ticker search, market regime badge), main grid of panels with collapsible cards.
- Every chart has a one-line "what this tells you" caption and a tooltip explaining the metric. I'm learning; the dashboard should teach.

## 4. Panels (ticker page)

### 4.1 Price action and technicals
- Candlesticks + volume (lightweight-charts), 20/50/200-day MAs, toggleable
- RSI(14), RSI(2), MACD sub-panes
- Relative strength line vs SPY and vs the stock's sector ETF
- Distance from 52-week high (%), and ratio of 52-week high to all-time high (see strategy S3)
- ATR(14) and suggested stop distance in ATR multiples

### 4.2 Earnings
- **Surprise bars:** actual vs estimate EPS per quarter, colored by beat/miss, with surprise %
- **Post-earnings reaction:** next-day and 5-day return after each report, plotted beside the surprise
- Next earnings date, with a **warning banner if it falls inside a typical 2-week hold**
- Validate first: test `yf.Ticker(...).get_earnings_dates()` on AAPL, MSFT, and a small-cap. Report how many quarters of estimate history it actually returns. If coverage is thin, show what exists and label it.

### 4.3 Options (current-day only)
- IV term structure (ATM IV by expiration)
- IV skew (IV by strike, nearest monthly expiry)
- Expected move into next earnings from the ATM straddle
- **No IV history, no IV rank.** There is no free source; this was cut on purpose.

### 4.4 Fundamentals
- Revenue, gross/operating margin, free cash flow, net debt, quarterly and annual
- Flag divergences automatically, e.g. revenue up while FCF down, with a caption listing possible good and bad explanations

### 4.5 Valuation
- P/E, EV/EBITDA, P/FCF vs the stock's own 5-year history (percentile band chart)
- No peer comparisons in v1 (no clean free source)

### 4.6 Macro (FRED)
- Yield curve snapshot and 10Y-2Y / 10Y-3M spreads over time
- Fed funds, CPI and core CPI YoY, unemployment, initial jobless claims
- High-yield credit spread, VIX
- Candidate series IDs: `DGS10 DGS2 DGS3MO T10Y2Y T10Y3M DFF CPIAUCSL CPILFESL UNRATE ICSA BAMLH0A0HYM2 VIXCLS`. **Verify each exists and is current before using it; drop any that don't.**
- A **regime badge** in the top bar (e.g. Risk-On / Neutral / Risk-Off) from a transparent rule set shown on hover. Keep the rule simple and documented; do not tune it to make history look good.

### 4.7 Verdict
- Scorecard with weights for swing trading: technicals 30%, earnings catalyst 25%, macro regime 15%, fundamentals 15%, valuation 15%. Weights editable in settings.
- Free-text fields I must fill in: thesis, what proves me wrong, invalidation price, target, position size, planned exit date
- Button: "Log as trade" sends it to the journal

## 5. Sentiment panel (market psychology)
Only sources with a clean free plug-in:
- VIX level and its percentile over 1 year (FRED)
- Price-based crowd signals for the ticker: % above 50-day MA, gap frequency, volume vs 50-day average, consecutive up/down days
- Do **not** add put/call ratios, AAII, or social sentiment unless you find a free, reliable, documented API. If you find one, propose it to me before building.

## 6. Trade journal (my psychology)
- Each entry: ticker, date, entry, stop, target, size, thesis, setup type, emotion at entry (dropdown: calm / FOMO / revenge / bored / confident / anxious), followed plan? (Y/N), exit, P&L, R-multiple, post-trade note
- Analytics page: win rate and average R by setup type, by emotion, by day of week, by whether I followed the plan; holding time of winners vs losers (disposition effect check: am I cutting winners and holding losers?)
- This is the most important feature for actual results. Build it properly.

## 7. Backtest lab

### 7.1 Engine requirements (non-negotiable)
- Signals computed on bar *t* close, executed at bar *t+1* open. No look-ahead.
- Commission and slippage parameters, default 5 bps per side slippage
- Stop and target logic in ATR multiples plus a max holding period
- Outputs: trade count, win rate, avg win/loss, expectancy in R, profit factor, max drawdown, CAGR, Sharpe, exposure %, equity curve, trade list, and a **t-statistic of mean trade return**
- **In-sample / out-of-sample split** (default: last 30% held out, never touched during tuning) and an optional walk-forward mode
- **Variant counter:** every parameter combination I test on a strategy is logged. The results page shows how many variants were tried and warns that the best result is inflated by that number. Flag any result with t-stat below 3.0 as "not distinguishable from data mining" (Harvey, Liu & Zhu 2016 hurdle).
- **Survivorship warning** on every report: yfinance only has stocks that exist today, so multi-stock tests on a current universe overstate returns.
- Minimum 30 trades out-of-sample before a result is shown as anything other than "insufficient sample."
- Benchmark: buy-and-hold SPY and the ticker over the same window.

### 7.2 Strategies to implement (from the research brief below)
Implement these as pluggable strategy classes with parameters exposed:

**S1. Post-earnings drift (PEAD)**
- Entry: day 2 after an earnings report where EPS surprise is positive AND the day-1 reaction is positive (and optionally revenue also beat)
- Exit: ATR stop, or N days (test 5, 10, 20), or before the next earnings date
- Expectation: weak in large caps; test across a mix of market caps and report results by cap bucket

**S2. Short-term reversal (pullback in uptrend)**
- Filter: close above 200-day MA
- Entry: RSI(2) below threshold (test 5, 10) or 3+ consecutive down closes
- Exit: close above 5-day MA, or N days, or ATR stop
- Report results separately for periods following market drawdowns vs calm periods

**S3. 52-week-high anchoring breakout**
- Filter: price within X% of 52-week high (test 2%, 5%) AND 52-week high within Y% of all-time high (test 5%, 10%)
- Entry: close above prior 52-week high on volume above 1.5× 50-day average
- Exit: close back below breakout level within 3 days (failed breakout), trailing ATR stop, or N days

**S4. Regime filter overlay**
- Apply the macro regime badge as an on/off filter to S1-S3 and compare results with and without it

### 7.3 CSV upload
Backtest lab accepts uploaded OHLCV CSVs (Date, Open, High, Low, Close, Volume) so I can test data from other sources.

## 8. Build order (stop after each phase, show me it running, wait for my go-ahead)

1. **Engine skeleton:** FastAPI, yfinance + FRED clients with SQLite caching and rate-limit backoff, data validation script that prints coverage for AAPL / MSFT / one small-cap
2. **Frontend shell:** layout, ticker search, sidebar, theme, animations, price panel with candlesticks
3. Earnings, fundamentals, valuation panels
4. Options and macro panels, regime badge
5. Sentiment panel and verdict/scorecard
6. Trade journal and analytics
7. Backtest engine with tests (write unit tests proving no look-ahead: shifting future data must not change past signals), then S1-S4, then the lab UI

Keep each phase small. Don't refactor completed phases unless I ask. Write a short `README.md` with setup steps (Python venv, `npm install`, `.env` keys, how to run both servers).

---

## Appendix: Research brief (why these strategies)

These are hypotheses to test, not edges to trust.

- **PEAD.** The oldest documented anomaly: prices keep drifting in the direction of an earnings surprise. But it has largely faded. Martineau (2022, "Rest in Peace Post-Earnings Announcement Drift") finds it disappearing from non-microcaps after ~2001 and near zero in large caps by ~2006. Griffin, McInnis & Zhao (2026) argue the decline is mostly because earnings news has become less informative about future earnings, not just more arbitrage. Drift is stronger when revenue and earnings surprise in the same direction (Jegadeesh & Livnat). Where it survives: small, illiquid, thinly covered stocks.
- **Short-term reversal.** Losers over the past week/month tend to bounce, winners give back. Nagel ("Evaporating Liquidity") frames the profits as payment for providing liquidity, so returns cluster after market selloffs. That also makes it behave like a short-volatility strategy. Transaction costs eat much of it; Connors-style RSI(2) results were published without data-mining corrections or out-of-sample tests.
- **52-week-high anchoring.** George & Hwang (2004): nearness to the 52-week high predicts returns better than past returns do, and doesn't reverse long-term. Mechanism: investors anchor on the high and underreact to good news near it. Later work finds it mainly works when the 52-week high is close to the all-time high.
- **Data mining risk.** Harvey, Liu & Zhu (2016) argue a new return predictor needs a t-stat above 3.0, not 2.0, because so many have been tested. Chen (2021) disputes the "most findings are false" conclusion, but the higher hurdle is a sensible guard for a solo trader testing many variants.
- **Behavioral self-sabotage.** Odean (1998) documents the disposition effect (selling winners too early, holding losers too long); Barber & Odean (2000) show the most active retail traders earned the lowest returns. This is why the journal exists.
