# Competitor Audit: Mining Reviews for the Gap

How to find what existing products fail at, and how to turn that into a wedge.

## Contents

- [Finding the real competitive set](#finding-the-real-competitive-set)
- [Where the reviews live](#where-the-reviews-live)
- [Handling blocked or JS-only sources](#handling-blocked-or-js-only-sources)
- [How to read reviews](#how-to-read-reviews)
- [Is the gap structural?](#is-the-gap-structural)
- [Writing the angle](#writing-the-angle)

## Finding the real competitive set

Search engines return the competitors with the best SEO, which is not the same as the
competitors your audience actually uses. Better sources, roughly in order of reliability:

1. **The threads you already read.** Whatever users name in the Reddit comments *is* the
   competitive set. "I just use X" and "I switched from X to Y" are worth more than any
   listicle.
2. **"Alternative to X" searches**, once you have one name. Each alternative page names
   several more, and the comparison pages reveal which axes buyers care about.
3. **App Store / Play Store search** for the category, sorted by relevance. Note review
   counts — a 200-review app and a 200,000-review app are different competitors.
4. **Product Hunt and Indie Hackers** for recent entrants and, on IH, occasionally public
   revenue numbers.
5. **The category's own aggregator** — G2, Capterra, and Trustpilot for B2B software;
   subreddit wikis and sidebar links for hobbyist tools.

Include the "competitor" that is a spreadsheet, a Notion template, a freelancer, or doing
nothing. Often it's the real one, and it's free, which sets a hard floor on pricing.

## Where the reviews live

| Product type | Best sources |
|---|---|
| Mobile app | App Store, Google Play, TikTok/YouTube comment sections |
| B2B SaaS | G2, Capterra, TrustRadius, the vendor's subreddit |
| Consumer web | Trustpilot, Reddit, X/Twitter replies to the company account |
| Physical product | Amazon reviews (filter 1-3 star), niche forums |
| Course / info product | Reddit, YouTube comments, refund complaints |
| Open source | GitHub issues sorted by 👍, the repo's Discussions tab |

Two underrated sources: **GitHub issues** on any open-source competitor are a
feature-request list sorted by demand, with the maintainers' own reasons for declining
attached. Cite them as full URLs (`https://github.com/<owner>/<repo>/issues/<n>`) rather
than as bare issue numbers — the number alone makes the reader search for what you already
had open. And **support forums or Discords** show the problems that never make it to a
public review, because the user was still hoping for a fix.

## Handling blocked or JS-only sources

Review pages are often rendered client-side, so a plain fetch returns an empty shell.

- **App Store**: the web page renders reviews client-side. Apple's public RSS feed works
  and returns JSON:
  `https://itunes.apple.com/<country>/rss/customerreviews/id=<appId>/sortBy=mostRecent/json`
  (page through with `/page=N/`). Get `<appId>` from the App Store URL. Note that this
  feed is capped at a few hundred recent reviews — enough for patterns, not for counts.
- **Google Play**: the page is JS-heavy. Search-engine snippets and third-party review
  aggregators are the practical fallback.
- **G2 / Capterra**: aggressive bot protection. Use search with
  `site:g2.com <product> reviews` and read snippets, or find the same complaints restated
  on Reddit, which is usually more candid anyway.
- **Amazon**: fetch the reviews URL with the filter parameters for one and two stars.

When a source won't load, don't silently substitute a guess. Note
`[could not retrieve: Play Store reviews for X]` in the brief and get the complaints from
Reddit and YouTube comments instead — those are less structured but more honest, since
nobody is farming them.

## How to read reviews

**Focus on 2-3 stars.** One-star reviews are disproportionately billing disputes, crashes
on one device, and people angry about something unrelated. Two and three stars come from
users who wanted the product to work, used it long enough to hit real limits, and can
articulate what those limits were. That is the richest band by a wide margin.

**Sort by most recent as well as most helpful.** "Most helpful" surfaces old, heavily
voted reviews that may describe fixed problems. Recent reviews tell you what's broken now,
and comparing the two tells you whether the team is actually shipping.

**Count, don't cherry-pick.** Tally how many reviews mention each complaint. A brief that
says "12 of 60 recent reviews mention the sync failing" is defensible; "users say sync is
bad" is not. When the volume is large, sample systematically — the most recent 50 in the
1-3 star band — and say that's what you did.

**Watch for the pattern where good reviews and bad reviews describe the same feature.**
That usually means the product works well for one segment and badly for another, and the
underserved segment is a business.

**Check the developer responses.** "This is on our roadmap" repeated for three years is a
structural gap. A response that says "this isn't a direction we're taking the product" is
an explicit invitation.

Sort every complaint into one of four buckets, because the bucket determines strategy:

- **Missing features** — proven demand, articulated by the buyer. Cleanest wedge.
- **Usability / UX** — real, but design is copyable, so it's only a moat when the
  incumbent's complexity serves a customer they can't abandon.
- **Bugs / reliability** — strong wedge if complaints span years or the product is in
  maintenance mode; weak if they cluster around one bad release.
- **Pricing** — often the most durable, since fixing it costs the incumbent revenue.

## Is the gap structural?

The question that separates a real opportunity from a to-do item on someone else's
backlog: **why hasn't the incumbent fixed this?**

Gaps that tend to hold:

- Fixing it would cannibalize their pricing or their enterprise tier
- Their main customer segment wants the opposite thing
- It requires rewriting an architecture they shipped a decade ago
- The product is in maintenance mode, acquired, or the team has visibly moved on
- Their compliance, contracts, or platform constraints forbid it
- The affected segment is too small to matter to them, but large enough to matter to you

Gaps that tend to close:

- It's a UI polish issue
- It's a recent regression they're already apologizing for in responses
- It's on a public roadmap with a date
- They ship frequently and respond to feedback in the review threads

Check the changelog, release notes, and recent reviews before concluding. If the answer is
"they'll probably fix it next quarter," say so — the user needs to know they'd be racing.

## Writing the angle

Assemble the evidence into a claim someone could disagree with:

> Users of **<product>** consistently report **<specific failure>** — <N> of <M> recent
> 1-3 star reviews mention it (links). The incumbent hasn't fixed it because
> **<structural reason, with evidence>**. We win by **<specific approach>**, which matters
> to **<segment>** because **<consequence they described in their own words>**.

The test of a good angle is that a reasonable person could push back on it with facts. If
nobody could disagree with your angle, it's too vague to build from — "better UX",
"cheaper", and "AI-powered" all fail this test. Go back to the reviews and find the
specific thing.
