# Demo video

The video is **recorded by a script**, not by hand: `demo/record-demo.mjs`
drives the real app in a real browser, and `demo/build-video.ps1` burns the
captions in. Re-running it gives you the same take every time, so you can
change one caption without re-shooting the whole thing.

Current output: `demo/supplytwin-demo.mp4` — 77s, 1280×720, H.264, ~2 MB.

---

## Producing it

```powershell
# 1. infrastructure
docker compose up -d

# 2. build and run both services
npm run build --workspace apps/api ; npm run build --workspace apps/web
cd apps/api ; node dist/src/main.js      # separate terminal
cd apps/web ; npx next start             # separate terminal

# 3. seed a realistic demo tenant + a genuine AI alert
pwsh demo/seed-demo.ps1 -Reset

# 4. record (the seed script prints the owner id)
$env:DEMO_OWNER_ID = '<owner id from step 3>'
node demo/record-demo.mjs

# 5. burn in captions and encode
pwsh demo/build-video.ps1
```

**Use the production builds, not `next dev` / `nest start --watch`.** On a
4-core machine the dev compilers plus the video encoder starve the API
enough that ordinary reads time out, and the take dies half way through.
Re-seed with `-Reset` before each take: the recording accepts the plan, so a
second run would open on an already-decided alert.

---

## What the script does, shot by shot

Timings come out of `demo/raw/timeline.json`, which `record-demo.mjs`
writes as it goes — the captions are placed from that file rather than
being timed by hand.

| Shot | On screen | Caption |
|---|---|---|
| Landing | Headline, then the feature cards | Most UAE small businesses find out their supplier is late on delivery day. |
| Twin | Live pill, stat tiles | One live view of stock, suppliers and orders. |
| Twin | The **Low** badge on Sunflower Oil | 'Low' is worked out from the data, not typed in by the owner. |
| Alerts | The alert card | A warning 48 hours before the delay lands — in plain language. |
| Alert detail | *What's happening* | Why it thinks so, written for a shop owner — not a data analyst. |
| Alert detail | **Desert Star Supplies · Your own backup** | It reached for the business's OWN backup supplier first. |
| Alert detail | The four numbered steps | Then a step-by-step plan they can actually follow. |
| Alert detail | Accept this plan → "You accepted this plan" | The owner decides. Nothing is actioned without them. |
| History | Track record | Every warning it has made — including the ones that turn out to be nothing. |
| Settings | Auto-trigger rules | Automatic action is opt-in, per supplier, owner-only. |

The two moments worth protecting if you shorten it: the **Your own backup**
badge (the system preferred the SME's own supplier over the platform
directory) and the **track record** page (showing the misses is what makes
the confident parts believable).

---

## The cursor

Playwright's recorder captures the page, not the desktop, so there is no OS
cursor in the frame. The script injects an arrow that follows the same
coordinates the automation moves through, eased so it accelerates and
settles the way a hand does, with a ripple on click. The interactions are
real; the pointer drawing them is synthetic.

If you specifically need browser chrome or the real OS cursor in frame,
screen-record the script while it runs (Win + G) instead of using the
`.webm` it produces.

---

## Changing a caption without re-recording

Edit the string in `demo/raw/timeline.json`, then re-run
`pwsh demo/build-video.ps1`. Put the same edit in `record-demo.mjs` so the
next recording keeps it.

---

## Things not to claim on camera

Be accurate — someone will ask, and being caught overstating costs more
than the extra feature was worth:

- It is **not deployed** yet. Say "running locally" or don't mention it.
- Email alerts are **logged, not sent**. The UI says "we told you here and
  by email" because `channels_sent` records the intent; no provider is
  connected yet.
- Login is a **development shim** — there's no real authentication yet.
- The 150-tenant load figures are from a **laptop**, not a deployed
  environment.
- The supplier signals are **simulated**, not live feeds from real
  logistics providers. This is in scope by design (see `research.md` §7),
  but don't imply live carrier data.
- The track record page in this take shows one prediction, still open. It
  is not evidence of accuracy yet — the caption says what the page does,
  not what the model has achieved.

Saying "this is a working prototype, here's exactly what's real" is a
stronger position than being vague and getting asked.
