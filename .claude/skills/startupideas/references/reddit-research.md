# Reddit Research: Access, Heuristics, and Query Bank

Practical notes for getting real data out of Reddit and reading it well.

## Contents

- [Getting data out of Reddit](#getting-data-out-of-reddit)
- [When Reddit blocks you](#when-reddit-blocks-you)
- [Finding candidate subreddits](#finding-candidate-subreddits)
- [Reading growth without an API](#reading-growth-without-an-api)
- [The pain-mining query bank](#the-pain-mining-query-bank)
- [Reading threads well](#reading-threads-well)

## Getting data out of Reddit

Reddit exposes JSON on almost every page by appending `.json`. No key required, but it is
rate-limited and frequently blocks datacenter IPs, so treat it as the fast path and expect
to fall back.

| Goal | URL |
|---|---|
| Subreddit metadata (subscribers, created date, description) | `https://www.reddit.com/r/<sub>/about.json` |
| Top posts, last year | `https://www.reddit.com/r/<sub>/top.json?t=year&limit=100` |
| Top posts, last month (growth check) | `https://www.reddit.com/r/<sub>/top.json?t=month&limit=100` |
| Top posts, all time (growth baseline) | `https://www.reddit.com/r/<sub>/top.json?t=all&limit=100` |
| Newest posts (activity check) | `https://www.reddit.com/r/<sub>/new.json?limit=100` |
| Search within a subreddit | `https://www.reddit.com/r/<sub>/search.json?q=<query>&restrict_sr=1&sort=top&t=year` |
| Search all of Reddit | `https://www.reddit.com/search.json?q=<query>&sort=top&t=year` |
| Full thread with comments | `<permalink>.json?limit=500` |
| Find related subreddits | `https://www.reddit.com/subreddits/search.json?q=<topic>` |

Useful parameters: `t=` accepts `hour|day|week|month|year|all`; `sort=` accepts
`relevance|top|new|comments`; `raw_json=1` avoids HTML-escaped entities in the response.

The fields worth pulling from post JSON: `title`, `selftext`, `score`, `num_comments`,
`created_utc` (epoch seconds), `permalink`, `link_flair_text`, `upvote_ratio`. From
`about.json`: `subscribers`, `active_user_count`, `created_utc`, `public_description`.

A low `upvote_ratio` (below ~0.8) on a complaint post is worth noticing — it usually means
the community is split on the premise, which is itself a finding.

## When Reddit blocks you

Blocks show up as 403s, 429s, or an HTML "whoa there, pardner" page instead of JSON. In
order of what to try:

1. **Retry `old.reddit.com`** instead of `www.reddit.com` — same paths, different
   frontend, sometimes different treatment.
2. **Use web search with `site:reddit.com`** and your query. Search engines have Reddit
   indexed thoroughly, and snippets often carry enough to decide whether a thread is
   worth fetching. This is the most reliable fallback.
3. **Fetch the individual thread permalinks** that search returns, rather than listing
   endpoints — single pages fail less often than bulk listings.
4. **Slow down.** If a first request works and the fifth fails, you're rate-limited, not
   blocked. Space requests out and batch what you need.

If none of it works, say so in the brief with `[could not retrieve: <what>]` and continue
with what search gave you. Partial evidence honestly labeled is fine. Invented subscriber
counts are not — they're the single most common way this research goes wrong, because
they look authoritative and nobody checks them.

## Finding candidate subreddits

- **Start from the problem, not the subreddit.** Search the pain phrasing across all of
  Reddit first, then note which subreddits the results cluster in. This surfaces
  communities you would never have guessed the name of.
- **Read sidebars for "related communities."** Curated by moderators, and usually the
  fastest route to a real audience cluster.
- **Check where the same usernames post.** Heavy contributors in one niche sub are
  usually active in three others, which is the cluster you're looking for.
- **Search for the tool names**, not just the topic. `r/<productname>` subs and threads
  naming a product lead straight to step 3's competitor audit.
- **Directory sites** (subredditstats.com, redditlist.com, anvaka's related-subreddit
  maps) help with discovery and sometimes carry growth charts. Their numbers can be stale
  by months — verify anything you plan to cite against `about.json`.

## Reading growth without an API

Subscriber history isn't exposed. These proxies work well together:

1. **Month vs. all-time top scores.** Pull `top?t=month` and `top?t=all`. If the best post
   of the past month would rank in the all-time top 20, the community is meaningfully
   bigger and more active now than it was historically. This is the strongest single
   signal available without an API.
2. **Post velocity on `/new`.** Look at `created_utc` on the 100 newest posts and compute
   the span. Twenty posts a day in a 20k sub is a live community; twenty posts a week is
   a slow one.
3. **Comments per post.** Compare median `num_comments` on recent top posts against older
   ones. Rising engagement per post means an active core, not just drive-by subscribers.
4. **Milestone posts.** Search the sub for "members" or "subscribers" — communities
   celebrate round numbers, and those posts are dated, giving you two points on a curve.
5. **Founding date.** `created_utc` from `about.json`. Subscribers divided by months since
   founding is crude, but it separates "grew steadily for a decade" from "exploded last
   year."

A community that is large but flat is usually a worse opportunity than a smaller one
climbing, because in the flat one every obvious product already exists.

## The pain-mining query bank

Run these across the audience cluster with `sort=top&t=year`. Substitute the niche's own
vocabulary — the exact terms you collected while reading.

**Solution requests (strongest signal — demand with no supply):**

```
"is there an app that"          "is there a tool"
"does anyone know of a"         "looking for an app"
"recommend me a"                "what do you use for"
"I wish there was"              "why is there no"
"someone should build"          "does this exist"
"how do you all handle"         "what's your setup for"
```

**Frustration and rage:**

```
"I hate that"                   "so frustrating"
"why is it so hard to"          "am I the only one who"
"rant"                          "PSA"
"the worst part about"          "sick of"
"finally gave up on"            "switching away from"
```

**Workarounds (people already paying in time):**

```
"my spreadsheet"                "I built a script"
"my workflow"                   "here's how I track"
"hacky"                         "workaround"
"I do this manually"            "took me hours"
```

**Money and willingness to pay:**

```
"worth it?"                     "is it worth the money"
"how much do you pay"           "cheaper alternative"
"cancelled my subscription"     "price increase"
"free alternative to"           "best budget"
```

**Product-specific (feeds the competitor audit):**

```
"<product> alternative"         "<product> vs"
"switching from <product>"      "<product> is terrible"
"anyone else having issues with <product>"
```

**Beginner confusion (reveals onboarding gaps and content opportunities):**

```
"where do I start"              "beginner question"
"stupid question"               "I don't understand"
"confused about"                "help a newbie"
```

Post flairs are worth checking too — many subs have a "Help", "Question", "Rant", or
"Discussion" flair, and filtering by flair (`https://www.reddit.com/r/<sub>/?f=flair_name%3A%22Help%22`)
gets you a pre-sorted pile of exactly the posts you want.

## Reading threads well

- **The comments hold the specifics.** The post says "this is frustrating"; the comments
  say which tool, which version, which step, and what they paid. Always fetch the thread,
  not just the listing.
- **Look for the reply that says "I just use X."** That's a competitor you didn't know
  about, named by an actual user — the most reliable source of the real competitive set.
- **Weight upvoted comments, but read the buried ones.** Highly upvoted comments show
  consensus; low-scored replies often contain the specific edge case that becomes the
  wedge.
- **Note the date.** A 2019 complaint may have been fixed. Check whether the same
  complaint appears in the past six months before building on it.
- **Count independent threads, not upvotes.** Five separate people raising the same
  problem in five threads across a year is far stronger evidence than one thread with
  5,000 upvotes, which may just have been well-timed.
- **Watch for the "solved" reply.** If someone answers the solution request with a working
  product and the thread agrees, that pain is served. Record it as a dead end — knowing
  which pains are already solved is what keeps the shortlist honest.
