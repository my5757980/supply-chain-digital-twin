# LinkedIn post drafts

Three versions. Pick one — don't post all three. Each is written to be read
by a human, so edit the wording until it sounds like you.

---

## Option A — the problem-first one (recommended)

> Most small businesses in the UAE find out their supplier is late the day
> the delivery doesn't show up.
>
> By then the options are bad: pay a premium for an emergency order, or
> tell customers you're out of stock.
>
> I spent the last few weeks building **SupplyTwin** for the du SME
> Resilience & Innovation Challenge — a live digital twin of an SME's
> supply chain that spots the pattern *before* it becomes a stockout.
>
> What it does:
> → Builds one live view of stock, suppliers and orders
> → Predicts a disruption at least 48 hours ahead
> → Finds an alternative — the business's own backup supplier first, then
>   a directory of verified local suppliers
> → Hands the owner a step-by-step plan they can accept, adjust or ignore
>
> Three things I made non-negotiable while building it:
>
> **The AI doesn't get to decide the guarantees.** The 48-hour minimum and
> the sourcing priority are plain code, checked twice. The model writes the
> explanation, not the rules.
>
> **The database enforces tenant isolation, not the application.** Postgres
> row-level security, running under a non-superuser role so the policies
> actually apply. It fails closed — no context returns zero rows, never
> everything.
>
> **No data goes to an AI model without consent.** It's a step in signup,
> and the pipeline returns 403 without it.
>
> Also — the app shows you the predictions it got *wrong*. Hiding those
> would make the track record look better than it is.
>
> 96 tests. Built spec-first: constitution → spec → plan → tasks, all in
> the repo along with the full build log.
>
> Code: github.com/my5757980/supply-chain-digital-twin
>
> #SupplyChain #AI #UAE #SME #du #Hackathon #BuildInPublic

---

## Option B — the build-log one

> I built a supply chain digital twin for UAE SMEs in a few weeks. Here's
> what actually went wrong.
>
> **74 passing tests told me nothing about whether it worked.** The
> frontend couldn't reach the backend from a browser at all — a CORS
> misconfiguration. Every test I'd written was server-side, where CORS is
> never enforced. I only found it by opening the app like a user would.
>
> **The plan claimed a security control that didn't exist.** My own
> architecture doc said consent gated the AI pipeline. It didn't. The
> column existed; nothing enforced it. Writing "mitigated by X" had made me
> stop checking whether X was real.
>
> **A test passed for the wrong reason.** A "should NOT auto-trigger" case
> was green because of leftover state from an earlier test, not because the
> feature worked.
>
> **The API contract had been invalid the whole time.** It's the source of
> truth for the whole system. Nothing had ever parsed it until I wired up
> the docs endpoint.
>
> All four are fixed, and each one now has a test that would catch it
> again. But the pattern is what stuck with me: every one of them was
> invisible to the layer I was testing at.
>
> The product: predicts supplier disruptions 48h ahead, recommends an
> alternative supplier, gives the owner a plan. Built for the du SME
> Resilience & Innovation Challenge.
>
> Code and the full build log: github.com/my5757980/supply-chain-digital-twin
>
> #BuildInPublic #SoftwareEngineering #AI #SupplyChain #UAE

---

## Option C — short

> Your supplier is going to be late. You'll find out on delivery day.
>
> SupplyTwin tells you 48 hours earlier — and gives you an alternative
> supplier and a plan, in plain language.
>
> Built for the du SME Resilience & Innovation Challenge.
> ↓ 77 second demo
>
> github.com/my5757980/supply-chain-digital-twin
>
> #SupplyChain #AI #UAE #SME

---

## Posting notes

- **Upload the video natively.** LinkedIn suppresses posts that send people
  off-platform; a YouTube link will reach far fewer people than the same
  video uploaded directly.
- **Put the repo link in the first comment** if reach matters more than
  clicks — same reason.
- **Burn captions into the video.** Most people watch muted.
- **Post Tuesday–Thursday morning, UAE time.** Then actually reply to
  comments for the first hour — that's what drives distribution.
- **Tag thoughtfully.** Tagging du or Ignyte is reasonable if the post is
  genuinely about their challenge; tagging people who had nothing to do
  with it reads as spam.

## One honest caution

Don't describe this as "live" or "in production" — it runs locally, login
is still a development shim, and email alerts are logged rather than sent.
"Working prototype" is accurate and nobody will hold it against you.
Claiming more is the kind of thing a technical reader spots in the demo
itself, and it costs more credibility than the claim was worth.
