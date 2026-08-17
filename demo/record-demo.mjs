/**
 * Records a smooth walkthrough of the running app.
 *
 * Playwright's own recorder captures the page as it actually renders, so
 * hovers, transitions and state changes are genuinely animated rather than
 * stitched screenshots. It does not capture the OS cursor, so this injects
 * a visible pointer that follows the same coordinates the automation moves
 * through, and eases the mouse between targets so the motion reads as a
 * person rather than a teleport.
 *
 * Every page in the app fits 1920x1080 without scrolling, so the pacing
 * here is hover-and-navigate rather than scroll.
 *
 * Prerequisites: both dev servers running, and `demo/seed-demo.ps1` run
 * (it prints the owner id this script needs).
 *
 *   $env:DEMO_OWNER_ID = '<owner id>'
 *   node demo/record-demo.mjs
 *
 * Output: demo/raw/<hash>.webm — convert with demo/build-video.ps1 -FromRecording
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "raw");
// 720p, not 1080p: on a 4-core machine the VP8 encoder for a 1080p capture
// starves the app and the database enough to turn ordinary reads into 500s
// mid-take. 1280 wide is also a normal laptop width, so the layout on
// camera is the one most viewers will actually see.
const WIDTH = 1280;
const HEIGHT = 720;

const APP = process.env.DEMO_APP_URL ?? "http://localhost:3000";
const API = process.env.DEMO_API_URL ?? "http://localhost:4000";
const OWNER_ID = process.env.DEMO_OWNER_ID;

if (!OWNER_ID) {
  console.error("Set DEMO_OWNER_ID first — demo/seed-demo.ps1 prints it.");
  process.exit(1);
}

/**
 * A pointer the video can actually see. Drawn as the familiar arrow rather
 * than a dot, because on a light UI a dot reads as part of the page; the
 * arrow reads instantly as "someone is using this". Its tip sits exactly on
 * the coordinate the automation moved to.
 */
const CURSOR_SCRIPT = `
  (() => {
    if (window.__demoCursor) return;
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position: 'fixed', left: '50%', top: '50%', width: '28px', height: '44px',
      pointerEvents: 'none', zIndex: '2147483647',
      filter: 'drop-shadow(0 2px 4px rgba(15,23,42,.45))',
    });
    wrap.innerHTML =
      '<svg viewBox="0 0 12 19" width="28" height="44" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M0 0 L0 14.6 L3.6 11.3 L5.9 16.4 L8.6 15.2 L6.3 10.2 L10.3 10.2 Z" ' +
      'fill="#ffffff" stroke="#1E1B4B" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(wrap);
    window.__demoCursor = wrap;
    window.__moveDemoCursor = (x, y) => { wrap.style.left = x + 'px'; wrap.style.top = y + 'px'; };
    window.__clickDemoCursor = () => {
      const ring = document.createElement('div');
      Object.assign(ring.style, {
        position: 'fixed', left: wrap.style.left, top: wrap.style.top,
        width: '14px', height: '14px', borderRadius: '50%',
        border: '3px solid rgba(79,70,229,.95)', pointerEvents: 'none',
        zIndex: '2147483646', transform: 'translate(-50%,-50%)',
        transition: 'width .5s ease-out, height .5s ease-out, opacity .5s ease-out',
        opacity: '1',
      });
      document.documentElement.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.width = '76px'; ring.style.height = '76px'; ring.style.opacity = '0';
      });
      setTimeout(() => ring.remove(), 560);
    };
  })();
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

class Demo {
  constructor(page) {
    this.page = page;
    this.x = WIDTH / 2;
    this.y = HEIGHT / 2;
  }

  /** Re-inject after a full navigation and put the pointer back where it was. */
  async ensureCursor() {
    await this.page.evaluate(CURSOR_SCRIPT).catch(() => {});
    await this.page
      .evaluate(([x, y]) => window.__moveDemoCursor?.(x, y), [this.x, this.y])
      .catch(() => {});
  }

  /** Eased so the pointer accelerates away and settles, the way a hand does. */
  async moveTo(x, y, steps = 30) {
    const [sx, sy] = [this.x, this.y];
    for (let i = 1; i <= steps; i++) {
      const e = easeInOut(i / steps);
      const cx = sx + (x - sx) * e;
      const cy = sy + (y - sy) * e;
      await this.page.mouse.move(cx, cy);
      await this.page
        .evaluate(([a, b]) => window.__moveDemoCursor?.(a, b), [cx, cy])
        .catch(() => {});
      await sleep(11);
    }
    this.x = x;
    this.y = y;
  }

  /** Move onto an element and hold, so the viewer's eye can land on it too. */
  async hover(selector, hold = 900) {
    const el = this.page.locator(selector).first();
    try {
      await el.waitFor({ state: "visible", timeout: 12000 });
    } catch {
      // Encoding 1080p video competes with the app for CPU on a 4-core
      // machine, so a request occasionally times out and the page renders
      // its error state. One reload is cheaper than losing the take.
      console.warn(`   (retrying after reload: ${selector})`);
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await this.ensureCursor();
      try {
        await el.waitFor({ state: "visible", timeout: 20000 });
      } catch (err) {
        // Knowing which page we were actually on turns a timeout into a
        // one-line diagnosis.
        console.error(`\n!! "${selector}" never appeared on ${this.page.url()}`);
        console.error((await this.page.evaluate(() => document.body.innerText)).slice(0, 900));
        throw err;
      }
    }
    // At 720p some pages need scrolling. Playwright's own
    // scrollIntoViewIfNeeded jumps instantly, which looks like a cut in the
    // video, so ask the page to animate it instead.
    const scrolled = await el.evaluate((node) => {
      const r = node.getBoundingClientRect();
      if (r.top >= 80 && r.bottom <= window.innerHeight - 40) return false;
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    });
    if (scrolled) await sleep(900);

    const box = await el.boundingBox();
    if (!box) throw new Error(`no bounding box for ${selector}`);
    await this.moveTo(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(hold);
    return el;
  }

  async click(selector, settle = 1500) {
    const el = await this.hover(selector, 350);
    await this.page.evaluate(() => window.__clickDemoCursor?.()).catch(() => {});
    await sleep(140);
    await el.click();
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
    await this.ensureCursor();
    await sleep(settle);
  }

  async goto(url, settle = 1600) {
    // Never "networkidle": every authenticated page holds an SSE stream
    // open, so the network is never idle and the wait just burns seconds of
    // dead air into the recording. The hover() calls that follow do the
    // real waiting, on the element we actually care about.
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    await this.ensureCursor();
    await sleep(settle);
  }
}

async function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // The full Chromium build, not the headless shell: the shell has no
  // compositor, so CSS transitions render as jumps in the recording.
  const browser = await chromium.launch({ channel: "chromium" });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: { dir: outDir, size: { width: WIDTH, height: HEIGHT } },
  });

  // Keeps the pointer alive across client-side navigations.
  await context.addInitScript(CURSOR_SCRIPT);

  const page = await context.newPage();
  const demo = new Demo(page);

  // A take can only fail because a request to the API failed or hung, so
  // surface exactly that rather than leaving a timeout to be guessed at.
  page.on("requestfailed", (r) => {
    if (r.url().includes(API)) console.warn(`   xx ${r.method()} ${r.url().replace(API, "")} :: ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.url().includes(API) && r.status() >= 400) console.warn(`   xx ${r.status()} ${r.url().replace(API, "")}`);
  });

  // Recording starts with the page, so times measured from here line up
  // with the video timeline. build-video.ps1 reads these to place captions
  // rather than anyone timing them by hand.
  const videoStart = Date.now();
  const timeline = [];
  const scene = (caption) => {
    const at = (Date.now() - videoStart) / 1000;
    timeline.push({ at, caption });
    console.log(`→ ${at.toFixed(1)}s  ${caption}`);
  };

  // Sign in before recording anything interesting. Login is a development
  // shim; it is not part of the story the video tells.
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    async ([api, id]) => {
      await fetch(`${api}/auth/dev-login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
    },
    [API, OWNER_ID],
  );

  await demo.goto(APP, 1200);
  scene("Most UAE small businesses find out their supplier is late on delivery day.");
  await demo.hover("h1", 2600);
  await demo.hover("text=Know 48 hours early", 1600);

  await demo.click('a[href="/twin"]', 1200);
  scene("One live view of stock, suppliers and orders.");
  await demo.hover('text="Live"', 1600);
  await demo.hover("text=Items in stock", 1400);
  scene("'Low' is worked out from the data, not typed in by the owner.");
  await demo.hover("text=Sunflower Oil 5L", 1600);
  await demo.hover('text="Low"', 2000);
  await demo.hover("text=Gulf Wholesale Trading", 1800);

  await demo.click('a[href="/alerts"]', 1200);
  scene("A warning 48 hours before the delay lands - in plain language.");
  await demo.hover("text=Possible delay from", 2600);

  await demo.click("text=Possible delay from", 1200);
  scene("Why it thinks so, written for a shop owner - not a data analyst.");
  await demo.hover("text=What's happening", 3000);
  await demo.hover("text=Where to source instead", 1000);
  scene("It reached for the business's OWN backup supplier first.");
  await demo.hover("text=Desert Star Supplies", 2400);
  scene("Then a step-by-step plan they can actually follow.");
  await demo.hover("text=Your step-by-step plan", 2800);

  scene("The owner decides. Nothing is actioned without them.");
  await demo.hover('button:has-text("I\'ll do something different")', 1600);
  await demo.click('button:has-text("Accept this plan")', 2600);

  await demo.goto(`${APP}/alerts/history`, 800);
  // Deliberately not "the predictions it got wrong": the seeded demo has no
  // resolved-wrong prediction on screen, and the video should not claim
  // something the viewer cannot see.
  scene("Every warning it has made - including the ones that turn out to be nothing.");
  await demo.hover("text=Track record", 3400);

  await demo.goto(`${APP}/settings/auto-trigger-rules`, 800);
  scene("Automatic action is opt-in, per supplier, owner-only.");
  await demo.hover("text=Automatic actions", 1600);
  await demo.hover('button:has-text("Turn this on")', 2600);

  const totalSecs = (Date.now() - videoStart) / 1000;
  await context.close();
  await browser.close();

  writeFileSync(
    join(outDir, "timeline.json"),
    JSON.stringify({ totalSecs, scenes: timeline }, null, 2),
  );
  console.log(`\nRaw recording written to ${outDir} (${totalSecs.toFixed(1)}s)`);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
