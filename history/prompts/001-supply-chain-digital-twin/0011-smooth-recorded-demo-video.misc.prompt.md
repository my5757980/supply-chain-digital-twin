---
id: 0011
title: Smooth Recorded Demo Video
stage: misc
date: 2026-08-17
surface: agent
model: claude-opus-5
feature: 001-supply-chain-digital-twin
branch: main
user: my5757980@gmail.com
command: (direct request)
labels: ["demo", "video", "playwright", "prisma", "connection-pool", "sse"]
links:
  spec: specs/001-supply-chain-digital-twin/spec.md
  ticket: https://challenges.ignyte.ae/competition/00B42B34-228F-F111-B337-6045BD14DEDF
  adr: null
  pr: null
files:
 - demo/record-demo.mjs
 - demo/build-video.ps1
 - demo/VIDEO-SCRIPT.md
 - demo/LINKEDIN-POST.md
 - demo/supplytwin-demo.mp4
 - apps/api/src/common/prisma/prisma.service.ts
 - apps/api/package.json
 - apps/api/.env.example
 - .gitignore
 - package.json
tests:
 - apps/api — 74/74 across 27 suites, re-run after the Prisma transaction change
 - visual verification of six extracted frames from the final encode
---

## Prompt

"yar ya videoo mazaa nahii kar rahiii tum smooth wali video bana kar do naaa
cheez sab real huuutaa cursor khud wo waliiii tum nayy mujayy phlayy bhi khi
roject ki bana kar dieee hai yar"

(The slideshow video isn't enjoyable — make the smooth kind, all real, with
the cursor itself, like you've made for me before.)

## Response snapshot

**Replaced the slideshow with a scripted screen recording.** `record-demo.mjs`
drives the real app through Playwright's `recordVideo`, so scrolls,
transitions and state changes are genuinely animated rather than stitched
stills. Playwright captures the page and not the desktop, so there is no OS
cursor in frame; the script injects an arrow that follows the same
coordinates the automation moves through, eased so it accelerates and
settles like a hand, with a ripple on click. Stated plainly to the user that
the pointer is synthetic even though the interactions are real. It also
writes `timeline.json` as it goes, and `build-video.ps1` places captions
from that file — so a caption can be reworded and re-encoded without
re-shooting.

**Four takes failed before the cause was clear, and it was not the script.**
The symptom was `Transaction API error: Unable to start a transaction in the
given time` and `Can't reach database server`, only ever while recording.
Two real defects sat underneath:

- Row-level security forces *every* request through an interactive
  transaction, so each in-flight request holds a connection for its whole
  duration. Prisma's defaults — 2s to acquire a connection, 5s to complete,
  a pool of 5 — are far too tight for that shape. Raised to 15s/20s in
  `withTenantContext` and documented `connection_limit=25` in
  `.env.example`. This was not a video problem; it would have surfaced in
  the pilot as intermittent 500s under trivial load.
- `apps/api`'s `start` script pointed at `dist/main.js`, but `nest build`
  emits `dist/src/main.js`. `npm start` had never worked, which means the
  documented Railway deployment command would have failed on first boot.

The remaining instability was environmental: at 1080p the VP8 encoder
starved the app and the Dockerised Postgres on a 4-core machine. Dropped the
capture to 1280×720 — cheaper to encode, and a normal laptop width is closer
to what viewers actually see. Also switched the recording to run against
production builds rather than `next dev`/`nest start --watch`, whose
compilers competed for the same cores.

**Two smaller findings.** `waitUntil: "networkidle"` never fires in this app
because every authenticated page holds an SSE stream open; it was silently
adding 20–30s of dead air per navigation until it hit its timeout. And one
caption claimed the app "shows you the predictions it got wrong" while the
seeded demo has no resolved-wrong prediction on screen — reworded to
describe what the page does rather than what the model has achieved.

Final take was clean: no retries, no error states, 77s at 1280×720, 2.1 MB.
Six frames spot-checked across the timeline. The API suite was re-run after
the Prisma change: 74/74 across 27 suites.

## Follow-ups and risks

- The Groq API key pasted into chat earlier still needs regenerating; it is
  only in the gitignored `apps/ai-service/.env`, but it is in the transcript.
- Railway/Vercel deployment is still not started, and the `app_runtime`
  password in the migration remains public on GitHub — rotate before the
  database is reachable.
- Ignyte submission materials (Concept Summary, Pilot Strategy, Risk
  Mitigation) are still unwritten.
