# LinkedIn post drafts

Four versions. Pick one — don't post all four. Each is written to be read
by a human, so edit the wording until it sounds like you.

Start with the full version below; it is the one that answers all three
questions a reader has (what is it, why does it exist, what is it built
with) without turning into a spec sheet.

---

## The full version — post this one with the video

> Most small businesses in the UAE find out their supplier is late on the
> day the delivery doesn't arrive.
>
> By then the choices are bad: pay a premium for an emergency order, or
> tell your customers you're out of stock.
>
> I built **SupplyTwin** for the du SME Resilience & Innovation Challenge —
> a live digital twin of a small business's supply chain that sees the
> pattern before it becomes a stockout.
>
> 𝗪𝗵𝗮𝘁 𝗶𝘁 𝗱𝗼𝗲𝘀
> → Builds one live view of stock, suppliers and orders
> → Predicts a supplier disruption at least 48 hours ahead
> → Finds an alternative — the business's own backup supplier first, then
>   verified local suppliers
> → Hands the owner a step-by-step plan they can accept, change or ignore
>
> 𝗛𝗼𝘄 𝗶𝘁'𝘀 𝗯𝘂𝗶𝗹𝘁
> Next.js 14 and Tailwind on the front end. NestJS 10 with Prisma for the
> platform service. A separate FastAPI service runs the three agents —
> prediction, sourcing, contingency plan. PostgreSQL 15 and Redis 7
> underneath, Server-Sent Events for the live updates. The language model
> sits behind an OpenAI-compatible client, so switching provider is three
> environment variables, not a code change.
>
> 𝗧𝗵𝗿𝗲𝗲 𝘁𝗵𝗶𝗻𝗴𝘀 𝗜 𝗺𝗮𝗱𝗲 𝗻𝗼𝗻-𝗻𝗲𝗴𝗼𝘁𝗶𝗮𝗯𝗹𝗲
>
> **The AI doesn't get to decide the guarantees.** The 48-hour floor and
> the sourcing priority are plain code, checked twice. The model writes the
> explanation, not the rule.
>
> **The database enforces tenant isolation, not the application.** Postgres
> row-level security, running under a non-superuser role so the policies
> actually apply. It fails closed — missing context returns zero rows,
> never everything.
>
> **No data reaches a model without consent.** It's a step in signup, and
> the pipeline returns 403 without it.
>
> And the app shows you the predictions it got wrong. Hiding those would
> make the track record look better than it is.
>
> 96 tests. Built spec-first — constitution → spec → plan → tasks — with
> the full build log in the repo.
>
> To be straight about what this is: a working prototype running locally,
> not a deployed product. Login is still a development shim and alerts are
> logged rather than emailed. But everything in the video is real output
> from the real system — no mockups.
>
> 77-second demo below. Code: github.com/my5757980/supply-chain-digital-twin
>
> #SupplyChain #AI #UAE #SME #du #Ignyte #ResilienceTech #BuildInPublic

---

## Option A — the problem-first one

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
