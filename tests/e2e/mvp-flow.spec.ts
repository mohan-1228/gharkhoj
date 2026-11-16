import { expect, test } from "@playwright/test";
import { devSignIn, expectEmail, newContext, signInAsDemo, testPhoto } from "./helpers";

/**
 * CLAUDE.md §11 — Definition of Done, end to end:
 * landlord lists (pin + photo + amenities) → submits → admin approves → visitor finds it
 * on list + map → renter favourites + requests a tour → landlord confirms → both get email.
 */
test("MVP flow: list → approve → discover → favourite → tour → confirm", async ({ browser }) => {
  test.setTimeout(180_000);
  const run = Date.now().toString(36);
  const title = `E2E sunny flat ${run} near Baneshwor`;
  const landlordEmail = `landlord-${run}@e2e.test`;
  const renterEmail = `renter-${run}@e2e.test`;

  // ── 1. Landlord creates and submits a listing ──
  const landlordCtx = await newContext(browser);
  const landlord = await landlordCtx.newPage();
  await devSignIn(landlord, landlordEmail, "landlord");
  await landlord.goto("/landlord/listings/new");
  await landlord.locator("#title").fill(title);
  await landlord
    .locator("#description")
    .fill("Bright flat with 24 hour water, inverter backup and a quiet lane close to the main road.");
  await landlord.locator("#rentNpr").fill("22000");
  await landlord.locator("#cityId").selectOption({ label: "Kathmandu" });
  await landlord.locator("#neighborhoodId").selectOption({ label: "Baneshwor" });
  await landlord.getByText("Wi-Fi", { exact: true }).click();
  await landlord.getByText("24h water", { exact: true }).click();
  // Place the map pin by tapping the map.
  const map = landlord.locator(".leaflet-container");
  await map.scrollIntoViewIfNeeded();
  await map.click({ position: { x: 200, y: 140 } });
  await expect(landlord.getByText(/^Pin: /)).toBeVisible();
  await landlord.getByRole("button", { name: "Save draft & continue" }).click();
  await landlord.waitForURL(/\/landlord\/listings\/[0-9a-f-]+\/edit/);

  await landlord
    .locator('input[type="file"][accept*="image/jpeg"][multiple]')
    .first()
    .setInputFiles(await testPhoto());
  // Wait until the upload is processed (thumbnail rendered from the WebP variant).
  await expect(landlord.getByRole("img", { name: "Photo 1", exact: true })).toBeVisible({ timeout: 30_000 });
  await landlord.getByRole("button", { name: "Submit for review" }).click();
  await landlord.waitForURL("**/landlord/listings");
  await expect(landlord.getByText(title)).toBeVisible();
  await expect(landlord.getByText("Pending review").first()).toBeVisible();

  // ── 2. Admin approves it ──
  const adminCtx = await newContext(browser);
  const admin = await adminCtx.newPage();
  await signInAsDemo(admin, /Admin User/);
  await admin.goto("/admin/review");
  const card = admin.locator("li", { has: admin.getByRole("link", { name: title }) });
  await card.getByRole("button", { name: "Approve & publish" }).click();
  await expect(admin.getByRole("link", { name: title })).toHaveCount(0);
  await expectEmail(landlordEmail, "Your listing is live");

  // ── 3. A visitor finds it on list and map views ──
  const visitorCtx = await newContext(browser);
  const visitor = await visitorCtx.newPage();
  await visitor.goto(`/rent/kathmandu?q=${run}`);
  await expect(visitor.getByRole("link", { name: title })).toBeVisible();
  await visitor.goto(`/rent/kathmandu?q=${run}&view=map`);
  await expect(visitor.locator(".price-pin").first()).toBeVisible({ timeout: 15_000 });
  await expect(visitor.getByText("1 rental on the map")).toBeVisible();

  // ── 4. Renter favourites and requests a tour ──
  const renterCtx = await newContext(browser);
  const renter = await renterCtx.newPage();
  await devSignIn(renter, renterEmail, "renter");
  await renter.goto(`/rent/kathmandu?q=${run}`);
  await renter.getByRole("link", { name: title }).click();
  await renter.getByRole("button", { name: "Save to favourites" }).first().click();
  await expect(renter.getByRole("button", { name: "Remove from favourites" }).first()).toBeVisible();

  const panel = renter.locator("#schedule-tour");
  await panel.locator("button.rdp-day_button:not([disabled])").first().click();
  await panel.getByRole("group", { name: "Available times" }).getByRole("button").first().click();
  await panel.getByLabel("Your mobile number").fill("9841234567");
  await panel.getByRole("button", { name: /Request tour/ }).click();
  await expect(panel.getByText("Request sent!")).toBeVisible();
  await expectEmail(landlordEmail, "New tour request");

  await renter.goto("/account/favorites");
  await expect(renter.getByRole("link", { name: title })).toBeVisible();

  // ── 5. Landlord confirms; both receive confirmation emails ──
  await landlord.goto("/landlord/tours");
  const tour = landlord.locator("article", { has: landlord.getByRole("link", { name: title }) });
  await tour.getByRole("button", { name: "Confirm" }).first().click();
  await expect(tour.getByText("Confirmed")).toBeVisible();
  await expectEmail(renterEmail, "Tour confirmed");
  await expectEmail(landlordEmail, "Tour confirmed");

  // Renter now sees the landlord's contact + address and can add it to a calendar.
  await renter.goto("/account/tours");
  await expect(renter.getByRole("link", { name: "Add to calendar" })).toBeVisible();

  await Promise.all([landlordCtx, adminCtx, visitorCtx, renterCtx].map((c) => c.close()));
});
