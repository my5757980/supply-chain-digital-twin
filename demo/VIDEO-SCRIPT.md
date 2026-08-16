# Demo video — shot list and script

Target length: **90–120 seconds**. LinkedIn autoplays muted, so the visuals
have to carry it. Keep captions on screen.

---

## Before you hit record

```powershell
# 1. infrastructure
docker compose up -d

# 2. both services (separate terminals)
cd apps/api  ; npm run start:dev
cd apps/web  ; npm run dev

# 3. seed a realistic demo tenant + a genuine AI alert
pwsh demo/seed-demo.ps1
```

The script prints a one-line `fetch(...)` — paste it into the browser
console (F12) once and refresh. You're now signed in as the owner.

**Recording setup**
- Browser at **1920×1080**, zoom **100%**, no bookmarks bar
- Close every other tab
- Hide desktop icons and notifications (Windows: Focus Assist on)
- Record with **Win + G** (Xbox Game Bar) or OBS

**Dry-run the whole thing once before recording.** The clicks are simple,
but a smooth take reads as a finished product; a hesitant one doesn't.

---

## The shots

### 0:00–0:08 — Landing page
**Show:** `http://localhost:3000`. Let the headline sit for a beat, then
scroll slowly to the three feature cards.

**Caption:** *"Most UAE small businesses find out their supplier is late
when the delivery doesn't arrive."*

---

### 0:08–0:25 — Onboarding
**Show:** Click **Set up your business**. Fill it in at a natural pace —
don't paste, let people see it's a real form:
- Al Madina Grocers · food · owner@almadina.ae

Click **Continue**. Add one item on camera (*Sunflower Oil 5L / OIL-5L /
14*), then click **Continue**.

**Caption:** *"Setup takes two minutes. No IT team, no integration
project."*

> Why type one item live: it proves the form is real, not a mockup. The
> rest of the stock is already seeded so you don't burn 40 seconds typing.

---

### 0:25–0:33 — Consent step
**Show:** Pause on the consent screen. Let the three bullets be readable.
Click **Yes, turn on smart alerts**.

**Caption:** *"Nothing goes to an AI model until the owner says yes."*

> Don't skip this shot. Judges and engineers both notice consent being
> designed in rather than bolted on.

---

### 0:33–0:48 — The live twin
**Show:** The dashboard. Point the cursor at:
1. The green **Live** pill (top right)
2. The three stat tiles
3. The **Low** badge on Sunflower Oil
4. Scroll to suppliers — main and backup

**Caption:** *"One live screen: stock, suppliers, orders. The 'Low' flag is
computed, not typed."*

---

### 0:48–1:05 — The alert
**Show:** Click **Alerts** in the nav. Let the alert card land. Read the
summary on screen, then click into it.

On the detail page, move down slowly:
- *What's happening* — the AI's own wording
- *Where to source instead* — **Desert Star Supplies · Your own backup**
- *Your step-by-step plan* — the four numbered steps

**Caption:** *"Written by the model — 48 hours before the delay lands."*

> The "Your own backup" badge is the moment worth lingering on: it shows
> the system preferred the SME's own supplier over the platform directory.

---

### 1:05–1:15 — Acting on it
**Show:** Click **Accept this plan**. The card flips to *"You accepted this
plan"*. Then click **History** and show the track record — including a
prediction that didn't come true.

**Caption:** *"Every warning is logged, including the ones we got wrong."*

> This is the most credible eight seconds in the video. Anyone can demo a
> confident AI. Showing the misses is what makes the confident parts
> believable.

---

### 1:15–1:25 — The proof
**Show:** Split screen or quick cuts:
1. Terminal: `npx jest --runInBand` → **74 passed**
2. Terminal: `pytest -q` → **22 passed**
3. Browser: `localhost:4000/docs` → the live API contract

**Caption:** *"96 tests. Row-level tenant isolation. Full audit trail."*

---

### 1:25–1:30 — Close
**Show:** The GitHub repo page.

**Caption:** *"Built for the du SME Resilience & Innovation Challenge.
Code is open."*

---

## If you want a 30-second cut instead

Keep only: landing (3s) → twin dashboard (7s) → alert detail with the plan
(12s) → accept (4s) → tests passing (4s). Drop onboarding and consent.

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

Saying "this is a working prototype, here's exactly what's real" is a
stronger position than being vague and getting asked.
