# startupideas

Business research skills for Claude Code.

## Skills

### `startupideas`

A six-step workflow for turning what people actually say in online communities into a
validated product opportunity with a defensible angle:

1. Find fast-growing niche subreddits (10k–100k members, with a clear "why now")
2. Mine the audience cluster for pain points and solution requests
3. Audit existing products through their 1–3 star reviews to find the gap
4. Study niche creators and their comment sections for sentiment and vocabulary
5. Position, name, and wireframe the smallest MVP that tests demand
6. Build a content strategy from the formats that already work in the community

Lives in `.claude/skills/startupideas/`. It triggers on requests for startup ideas,
niche market research, customer pain point discovery, competitor gap analysis, app
review mining, and content ideas for a specific community.

Supporting references:

- `references/reddit-research.md` — Reddit JSON endpoints, fallbacks for when Reddit
  blocks automated requests, growth heuristics without an API, and a query bank for
  surfacing unmet demand
- `references/competitor-audit.md` — where reviews live per product type, how to read
  the 2–3 star band, and how to judge whether a gap is structural
