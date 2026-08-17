---
name: startupideas
description: Find validated startup, product, and content ideas by mining Reddit communities for real pain points and solution requests, then auditing existing products through their 1-3 star reviews to define a superior angle. Use this whenever the user wants startup ideas, business ideas, something to build, niche or audience market research, customer pain point discovery, competitor gap analysis, app/product review mining, or content ideas for a specific online community — including indirect asks like "what should I build for X", "is there a market for Y", "why do people hate Z app", "find me an underserved niche", or "what do people in <community> actually complain about".
---

# Reddit Startup Ideator

A research workflow for turning what people actually say in online communities into a
validated product opportunity with a specific, defensible angle.

The value here is not idea generation — anyone can brainstorm. The value is **evidence**:
a real community, real quotes, a real gap in what exists today, and an honest read on
whether the gap is worth building into.

## The core discipline: evidence over invention

Every claim in the final brief must trace back to something you actually read. This
matters more than anything else in this skill, because a plausible-sounding brief built
on invented numbers is worse than no brief — the user will spend real months and real
money on it.

Concretely:

- **Quotes are verbatim and linked.** If you paraphrase, mark it as a paraphrase. Never
  compose a quote that "sounds like" what a user would say.
- **A link means a resolvable URL, not an identifier.** `PrusaSlicer #4898` and
  `AnkiDroid #7959` are precise and checkable, but the reader has to go hunting. Write
  `https://github.com/prusa3d/PrusaSlicer/issues/4898` instead — most identifiers expand
  into a URL mechanically, so there's rarely a reason not to. The test is whether the user
  can verify a claim in one click; anything more than that and the citation is decorative.
- **Numbers come from a page you fetched.** Subscriber counts, review counts, star
  ratings, video view counts — fetch them or omit them. Do not estimate a subreddit's
  size from vibes.
- **Say when you couldn't get data.** Reddit blocks automated requests fairly often, App
  Store review pages are JS-heavy, some sources 403. When a source fails, write
  `[could not retrieve: <source>]` in the brief and move on. An honest gap is useful
  information; a confident guess is a trap.
- **Distinguish signal strength.** Three separate people complaining across three months
  is different from one upvoted rant. Say which you found.

If the research comes back thin — the community is quiet, the pain is mild, the existing
tools are actually good — report that. "This niche looks saturated and the incumbents are
well-liked" is a genuinely valuable finding that saves the user a quarter of their life.

## Workflow

Six steps. Work through them in order; each one narrows the funnel. Don't skip ahead to
the MVP — the whole point is that positioning is *derived* from steps 1-4, not assumed.

Read `references/reddit-research.md` before starting step 1 — it has the access patterns,
fallbacks for when Reddit blocks you, and the query bank you'll use in step 2.

### Step 1 — Find fast-growing niche subreddits

**Target the 10k-100k member range.** Below ~10k there usually isn't enough post volume
to see a pattern. Above ~100k the community is broad, well-served, and already picked
over by everyone else doing this exercise. The sweet spot is a community big enough to
have recurring conversations but small enough that nobody has built the obvious tool yet.

**Growth matters more than size.** A 30k sub growing fast is a much better hunting ground
than a 90k sub that peaked in 2019 — growth means new people arriving with unsolved
problems and no established habits. Since subscriber history is hard to get, use these
proxies:

- Compare `top` posts of the **past month** against `top` of **all time**. If recent
  posts have comparable scores, the community is growing right now.
- Check post frequency on `new` — several posts a day in a 20k sub is a live community.
- Look for "we just hit N members" milestone posts and their dates.
- Note the founding date from the sidebar. A 40k sub created 18 months ago is a
  different animal than a 40k sub created in 2013.

**Identify the "why now."** The best openings come from something that changed recently:
a new platform or regulation, a cost shift, a technology that just became cheap, a
cultural trend, a large incumbent degrading its product. Write one sentence naming the
change. If you can't name one, the opportunity is probably not fresh, and you're
competing on execution against people who started earlier.

**Filter for the user's edge.** Ask what domains the user actually knows, has worked in,
or has access to. A mediocre idea in a domain they understand beats a great idea in one
they don't. If the user hasn't said, ask — this single answer changes which subreddits
are worth looking at.

Output of this step: 5-10 candidate subreddits with member count, activity read, why-now
sentence, and a note on fit.

### Step 2 — Mine pain points and solution requests

**Build an audience cluster first.** One subreddit is a topic; three or four related
subreddits are an *audience*. Cluster subs whose members overlap — e.g. a hobby sub, its
gear sub, its "beginner questions" sub, and the adjacent profession sub. Clusters matter
because they tell you the person, not just the interest, and a person has a budget and a
job and a set of tools.

**Search the cluster with the query bank** in `references/reddit-research.md`. It covers
the phrasings that reliably surface unmet demand — people asking for tools that don't
exist, describing workarounds, or venting about a specific product.

Sort results by top over the past year, and read the **comments**, not just the post.
Comments are where the specifics live: the actual workflow, the tool names, the prices
people paid, the thing they gave up on.

Categorize what you find:

| Category | What it looks like | Why it matters |
|---|---|---|
| **Recurring pain** | Same frustration, many threads, months apart | Durable problem, not a news cycle |
| **Solution request** | "Is there an app that..." with no good answer | Demand with no supply — the strongest signal |
| **Workaround stack** | Spreadsheets, duct-taped tools, manual process | People already pay in time; they'll pay in money |
| **Product rage** | Named product + specific complaint | Feeds step 3 directly |
| **Money talk** | "I pay $X for...", "worth it?", pricing debates | Proves budget exists and reveals the ceiling |

The last row deserves attention. A community that complains but never discusses paying
for anything is a hard place to start a business. Look for evidence of existing spend.

**Capture the vocabulary.** Save the exact words the community uses for their problem —
their jargon, their nicknames, their insults. This becomes your landing page copy in step
5 and your naming in the same step, and it's the difference between a page that reads as
"one of us" and one that reads as marketing.

Output of this step: a pain inventory with categories, verbatim quotes, links, and a
count of how many independent threads support each pain.

### Step 3 — Audit existing products for the gap

Search whether something already exists for the top pains. Something usually does. **That
is good news** — an existing product proves demand and hands you a list of its failures.
An empty market more often means no market.

Where to find the failures: App Store and Google Play reviews, G2 / Capterra /
Trustpilot, the product's own subreddit or Discord, and Reddit threads that name the
product. `references/competitor-audit.md` covers how to reach each of these and what to
do when a source is JS-only or blocked.

**Read 1-3 star reviews specifically.** Five-star reviews tell you what the product does;
one-to-three-star reviews tell you what it fails at, and the 2-3 star band is the richest
— those are users who *wanted* it to work and stayed long enough to hit the real problems.

Sort what you find into four buckets, because each implies a different strategy:

- **Missing features** — repeatedly requested, never shipped. Usually the cleanest wedge:
  the demand is proven and articulated for you.
- **Usability and UX pain** — confusing flows, slow performance, brutal onboarding. Great
  wedge if the incumbent is enterprise-bloated, but note that "it's ugly" alone is a weak
  moat, since design is copyable.
- **Bugs and reliability** — crashes, sync failures, broken integrations. Strong wedge
  *if* it's structural (bad architecture, dead maintenance) rather than a bad release
  they'll fix next month. Check whether the complaints span years or cluster in one week.
- **Pricing frustration** — sudden paywalls, per-seat gouging, features moved behind
  enterprise tiers. Often the most actionable, since it's a business-model gap the
  incumbent can't close without hurting revenue.

**Check whether the gap is structural.** The critical question: *why hasn't the incumbent
fixed this?* If it's laziness, they may fix it the moment you show traction. If it
conflicts with their business model, their architecture, or their main customer segment,
you have a real opening. Say which you believe, and why.

**Then state the superior angle explicitly**, tied to specific evidence:

> "Users of <product> consistently report <specific failure> (N reviews, links). The
> incumbent can't fix it because <structural reason>. We win by <specific approach>, which
> matters to <segment> because <consequence of the failure>."

Vague angles ("better UX", "more affordable", "AI-powered") mean the audit didn't go deep
enough. Go back and read more reviews.

### Step 4 — Study creators and customer sentiment

Reddit skews toward a particular kind of person. Triangulate by finding where the niche
learns: top YouTube channels, popular newsletters, TikTok accounts, forums, Discord
servers.

Find the highest-view videos or most-shared posts in the niche and read the **comments**.
Comment sections on educational content are unusually rich because people arrive
mid-problem: they say what they were trying to do, what confused them, and what they still
can't figure out after watching a tutorial that was supposed to fix it.

Look for:

- **Unaddressed desires** — "great video but how do you handle X" repeated across videos
- **The vocabulary again** — cross-check that the language matches what Reddit uses
- **Willingness to pay** — people asking about courses, tools, services, "who do I hire"
- **Who's already selling** — creators with products reveal what the niche will buy, and
  a creator with an audience is a distribution partner, not just a competitor

Note also whether *tutorials exist at all* for the pain you found. A pain that requires a
40-minute YouTube tutorial to work around is a product waiting to happen.

### Step 5 — Position, name, and wireframe an MVP

**Synthesize positioning from steps 2-4.** Reframe from category language to outcome
language, using the community's own words. Categories describe what you are; outcomes
describe what changes for the buyer, and buyers pay for outcomes. If step 2 gave you the
vocabulary, this step is mostly assembly.

Write the positioning as a single sentence with all four parts filled from evidence:

> For **<specific segment from step 2>** who **<pain, in their words>**, <name> is a
> **<category>** that **<outcome>** — unlike **<incumbent>**, which **<the audited gap>**.

**Name it from the community's vocabulary.** Terms that already circulate in the niche
arrive pre-validated: people recognize them, search for them, and don't need them
explained. Pull 5-10 candidate names from the language you captured, and check each for
domain availability and existing trademark conflicts before recommending it.

**Then wireframe the smallest test.** The goal is a demand signal this week, not a
product this quarter. Match the artifact to what's actually uncertain:

- Uncertain whether anyone cares → landing page with an email capture, posted where the
  audience already is
- Uncertain whether they'll pay → a pricing page with a real checkout, or presell to a
  handful of people from step 2 by name
- Uncertain whether it's buildable → a manual, hand-delivered version for 5 users before
  writing any code

Specify the hero headline (in community vocabulary), the three pain bullets (from step
2), the differentiator (from step 3), and one call to action. Include a plan for how the
user will reach the audience honestly — most subreddits ban promotion, so read the rules
and prefer participation, an offer to a community that knows you, or DMs to people who
posted the pain.

Set a kill number before launching: how many signups from how many visitors would make
this worth continuing. Deciding after the fact is how projects survive on hope.

### Step 6 — Build the content strategy

The formats that already work in a community work because that community rewards them.
Rather than importing a generic content playbook, study the top posts of the past year and
note their *shape*: personal transformation stories, before/afters, teardowns, "I tested
N things so you don't have to", deep-dive guides, memes, questions that invite the
community to show off.

For each of the top 3-5 formats, note what makes it land in this specific community, and
map a concrete piece of content you could make that fits the format and connects to the
product. Pay attention to what the community *punishes* too — most niches have a
recognizable pattern of self-promotion that gets downvoted on sight, and knowing it is
worth as much as knowing what works.

## Scoring and shortlisting

When comparing several opportunities, score each 1-5 and show the table. The scores are a
thinking aid, not an oracle — a compelling narrative can outrank a higher total, but you
should have to say so out loud.

| Dimension | The question |
|---|---|
| **Pain intensity** | Is this an emergency or a mild annoyance? |
| **Frequency** | Daily, or twice a year? |
| **Budget** | Is there evidence they already pay for something here? |
| **Reachability** | Can you reach them in a known place, cheaply? |
| **Wedge** | Is the gap structural, or will the incumbent close it? |
| **Feasibility** | Can a small team ship a real V1 in weeks? |

Kill criteria worth stating plainly when they apply: the audience has no money or no
buying authority; the incumbent is beloved and the complaints are trivial; the pain is
real but occurs once a year; the market is a dozen subreddit regulars; the workaround is
already free, good, and popular.

## Output format

Use this structure for the final brief. Adapt the depth to the request — a quick "what
should I build" gets a condensed version, a full research engagement gets all of it — but
keep the evidence links throughout.

```markdown
# Opportunity Brief: <name>

## TL;DR
<3-4 sentences: audience, pain, gap, proposed wedge.>

## The audience
Cluster: r/x, r/y, r/z (<member counts>). Who they are, what they do, what they spend on.

## The pain (evidence)
Ranked, each with: description, N supporting threads, 2-3 verbatim quotes with links.

## Why now
The change that opened this window.

## What exists today
Per competitor: what it is, pricing, rating + review count, and the top complaints from
1-3 star reviews with links.

## The gap and our angle
The specific failure, why the incumbent can't fix it, and how we win.

## Positioning
For <segment> who <pain>, <name> is a <category> that <outcome> — unlike <incumbent>,
which <gap>.

## MVP test
What to build, what it tests, the kill number, and how to reach the audience.

## Content strategy
Top 3-5 formats in the community, with a concrete piece for each.

## Confidence and gaps
What is well-supported, what is thin, what you couldn't retrieve, what to check next.
```

That last section is not optional padding. It's what makes the brief trustworthy — it
tells the user which parts they can act on and which parts need their own eyes.

## Common failure modes

- **Confirming a preconception.** If the user arrives with an idea, the temptation is to
  find quotes that support it. Actively search for the threads where people say the
  problem isn't real or the existing tools are fine, and report them.
- **Falling for one loud thread.** A single 3k-upvote rant is a story, not a pattern.
  Require independent threads across time.
- **Mistaking "annoying" for "worth paying to fix."** Most complaints are about things
  people will keep tolerating for free. Look for evidence of spend.
- **Angle too vague to build.** "Better and cheaper" isn't a wedge. Go back to the reviews.
- **Skipping the competitor audit** because nothing turned up on the first search. Search
  the product names people mention in the threads themselves — the real competitors are
  usually named by users, not by search engines.

## Reference files

- `references/reddit-research.md` — how to actually get data out of Reddit, fallbacks when
  it blocks you, growth heuristics, and the pain-mining query bank. Read before step 1.
- `references/competitor-audit.md` — where to find reviews for each product type, how to
  read them, and what to do with JS-only or blocked sources. Read before step 3.
