---
id: 0010
title: UI Redesign And Provider Swap
stage: refactor
date: 2026-08-16
surface: agent
model: claude-opus-5
feature: 001-supply-chain-digital-twin
branch: 001-supply-chain-digital-twin
user: my5757980@gmail.com
command: (direct request)
labels: ["ui", "design-system", "llm-provider", "cors", "consent-ux", "test-hygiene"]
links:
  spec: specs/001-supply-chain-digital-twin/spec.md
  ticket: https://challenges.ignyte.ae/competition/00B42B34-228F-F111-B337-6045BD14DEDF
  adr: null
  pr: null
files:
 - apps/web/app/globals.css
 - apps/web/tailwind.config.ts
 - apps/web/app/layout.tsx
 - apps/web/app/page.tsx
 - apps/web/app/onboarding/page.tsx
 - apps/web/app/twin/page.tsx
 - apps/web/app/alerts/page.tsx
 - apps/web/app/alerts/[id]/page.tsx
 - apps/web/app/alerts/history/page.tsx
 - apps/web/app/settings/auto-trigger-rules/page.tsx
 - apps/web/components/app-shell.tsx
 - apps/web/components/ui/button.tsx
 - apps/web/components/ui/card.tsx
 - apps/web/components/ui/badge.tsx
 - apps/web/components/ui/input.tsx
 - apps/web/components/ui/feedback.tsx
 - apps/web/lib/api.ts
 - apps/ai-service/app/config.py
 - apps/ai-service/app/agents/llm_client.py
 - apps/ai-service/app/agents/prediction_agent.py
 - apps/ai-service/app/agents/contingency_plan_agent.py
 - apps/ai-service/tests/stub_llm.py
 - apps/ai-service/requirements.txt
 - apps/api/src/main.ts
 - apps/api/test/helpers/test-app.ts
 - apps/api/test/integration/auth.spec.ts
 - apps/api/test/README.md
 - apps/api/package.json
 - specs/001-supply-chain-digital-twin/research.md
 - specs/001-supply-chain-digital-twin/plan.md
 - specs/001-supply-chain-digital-twin/quickstart.md
tests:
 - apps/api — 74/74 across 27 suites, verified stable over 3 consecutive full runs
 - apps/ai-service — 22/22 (agent tests migrated to a provider-agnostic stub)
 - manual browser walkthrough of every page via Playwright
---

## Prompt

Three requests across this session, in order:

1. "tum playwrite use karoo may login kar do gaa naa jaoo" — show the
   running project in a real browser.
2. "gsk_… ya loo apiii khud dekh looooo work kar rahii haiii" — user
   supplied a Groq API key after finding Anthropic credits unavailable,
   having first asked me to check whether the challenge provides any.
3. "uiux par bilkul simple kueeee professional honii chiyaa decenttt … ab
   is ko 100% kar dooo" — the UI is too plain; make it professional.

## Response snapshot

**Browser walkthrough found two bugs that no test had caught.** First, a
CORS misconfiguration: `enableCors({ credentials: true })` emits
`Access-Control-Allow-Origin: *`, which browsers reject on credentialed
requests — so the frontend could not reach the backend *at all* from a
browser. Every prior test was server-side (supertest/curl), where CORS is
never enforced, so 74 passing tests said nothing about it. Fixed with an
explicit `CORS_ORIGINS` allowlist. Second, onboarding never asked for AI
consent, so any tenant created through the UI was permanently blocked by
the Phase 6 consent gate — the security control worked exactly as designed
and made a missing UX step visible. Added a third onboarding step that
explains the data flow in plain language and offers "Not right now",
since consent that can't be declined isn't consent.

**Provider swap.** Before swapping I checked the challenge listing
(Overview, Rules, Discussion, Official Updates) and confirmed no API or
cloud credits are offered to participants — worth verifying rather than
assuming, since the user believed otherwise. I also declined to state
Groq's or xAI's current free-tier terms from memory, as those change often
and I had no way to verify them. The real defect wasn't the vendor choice
but that the agents imported a vendor SDK directly, making the provider a
code concern. Replaced it with a thin OpenAI-compatible client
(`llm_client.py`); provider is now three environment variables. Verified
against the live Groq API: the Prediction Agent produced a genuine
confidence score and rationale, and the Contingency Plan Agent produced
real steps — both rendered end-to-end in the browser. Hardened
`parse_json_reply` for fenced and prose-wrapped JSON, since smaller open
models format less strictly, with a regression test for each.

**UI redesign.** Built an actual design system rather than restyling
pages: HSL token palette with light/dark support and a `prefers-reduced-motion`
guard, then Button/Card/Badge/Input/Select/Field/EmptyState/Skeleton/Notice
primitives, an `AppShell` with persistent navigation, and a rewrite of all
seven pages. Added things the plain version lacked entirely — a landing
page, an onboarding stepper, stat tiles, low-stock flags, supplier status,
loading skeletons, empty states, and a track-record accuracy figure on the
history page (which deliberately surfaces false positives, since hiding
them would overstate the system's reliability).

**Test hygiene, found while verifying.** The suite began failing
intermittently. Rather than rerun until green, I traced it: `auth.spec.ts`
predated the shared `createTestApp` helper, duplicated the bootstrap, and
was missing the global exception filter — the same drift caught in Phase 4,
recurring in the one file that hadn't been migrated. Separately,
`cleanupTenant` never deleted `users` or `audit_log_entries`, whose FKs are
`ON DELETE SET NULL`, so deleting a tenant silently orphaned them; 392 rows
had accumulated. The flakiness itself was a too-tight `testTimeout` cutting
off legitimate slow bootstraps under load (`auth.spec.ts` failing at 35s
against a 30s limit) — connection counts were clean, so it was timing, not
leakage. Fixed all three and confirmed stability over three consecutive
full runs.

## Outcome

- ✅ Impact: The product now looks like something judges would take
  seriously, runs on real AI, works in a browser, and its test suite is
  stable and no longer leaks data.
- 🧪 Tests: 74/74 (api) stable across 3 consecutive runs; 22/22
  (ai-service); `tsc`/`eslint`/`next build`/`nest build`/`mypy`/`ruff` all
  clean; every page verified visually.
- 📁 Files: ~31 modified across all three apps plus three spec documents.
- 🔁 Next: deploy (Railway + Vercel) and the submission deck. Also pending:
  the user should rotate the Groq key, which entered the transcript.
- 🧠 Reflection: Every defect this session was invisible to the existing
  tests because they all tested the same layer. CORS needed a browser;
  the consent gap needed the full signup path; the plain UI needed a human
  looking at it. A suite can be green and thorough and still say nothing
  about whether the product works.

## Evaluation notes (flywheel)

- Failure modes observed: (1) wildcard CORS breaking all credentialed
  browser requests; (2) a security gate with no UI path to satisfy it;
  (3) vendor SDK coupling turning a config choice into a code change;
  (4) one test file drifting from the shared bootstrap; (5) cleanup
  orphaning `ON DELETE SET NULL` children; (6) a test timeout tight enough
  to fail on legitimate slow boots.
- Graders run and results (PASS/FAIL): all PASS — Jest 74/74 ×3, pytest
  22/22, tsc/eslint (api + web), mypy/ruff (ai-service), nest build, next
  build, live Groq API calls, browser walkthrough of all pages.
- Prompt variant (if applicable): N/A
- Next experiment (smallest change to try): add one browser-level smoke
  test (Playwright) to CI covering signup → twin → alert → decision. Every
  bug found this session sat in the gap that test would cover.
