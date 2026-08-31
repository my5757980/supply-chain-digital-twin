/**
 * Creates the demonstration tenant on a deployed instance, using only the
 * public API — no service token, no database access.
 *
 * Sign-up issues the session itself, so everything after it rides the same
 * cookie. The alert is deliberately NOT created here: raising one requires
 * the internal prediction callback, which is service-token guarded, so it
 * belongs to the AI service rather than to a seeding script.
 *
 *   node demo/seed-production.mjs https://your-api-host
 *
 * Prints the owner id to set as DEMO_OWNER_USER_ID.
 */

const API = process.argv[2];
if (!API) {
  console.error("Usage: node demo/seed-production.mjs <api-base-url>");
  process.exit(1);
}

let cookie = "";

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Sign-up sets the session; keep it for every later call.
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

const STOCK = [
  { sku: "RICE-10", name: "Basmati Rice 10kg", quantity_on_hand: 48, reorder_threshold: 20 },
  { sku: "OIL-5L", name: "Sunflower Oil 5L", quantity_on_hand: 14, reorder_threshold: 25 },
  { sku: "SUGAR-5", name: "White Sugar 5kg", quantity_on_hand: 62, reorder_threshold: 20 },
  { sku: "FLOUR-10", name: "All-Purpose Flour 10kg", quantity_on_hand: 36, reorder_threshold: 15 },
  { sku: "TEA-500", name: "Black Tea 500g", quantity_on_hand: 90, reorder_threshold: 30 },
];

const tenant = await call("/tenants", {
  method: "POST",
  body: {
    business_name: "Al Madina Grocers",
    sector: "food",
    owner_email_or_phone: "owner@almadina.example",
  },
});
console.log(`business : ${tenant.business_name}`);

await call("/tenants/me/ai-consent", { method: "POST" });
console.log("consent  : granted");

for (const item of STOCK) {
  await call("/inventory-items", { method: "POST", body: item });
}
console.log(`stock    : ${STOCK.length} items (Sunflower Oil is below its reorder level)`);

await call("/suppliers", {
  method: "POST",
  body: { name: "Gulf Wholesale Trading", kind: "primary", location: "Dubai", typical_lead_time_days: 4 },
});
await call("/suppliers", {
  method: "POST",
  body: { name: "Desert Star Supplies", kind: "backup", location: "Sharjah", typical_lead_time_days: 3 },
});
console.log("suppliers: Gulf Wholesale Trading (main), Desert Star Supplies (backup)");

console.log("\nSet this on the API service, then redeploy:");
console.log(`  DEMO_OWNER_USER_ID=${tenant.owner_user_id}`);
