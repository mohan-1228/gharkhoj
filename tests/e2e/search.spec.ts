import { expect, test } from "@playwright/test";
import { newContext } from "./helpers";

test.describe("search & browse", () => {
  test("filters live in the URL and narrow results", async ({ browser }) => {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto("/rent/kathmandu");
    const count = async () => Number((await page.locator("#results-heading").innerText()).match(/\d+/)?.[0] ?? 0);
    const before = await count();
    await page.getByRole("button", { name: "3+" }).first().click();
    await page.waitForURL(/beds=3/);
    await expect.poll(count).toBeLessThanOrEqual(before);
    // Shareable: reloading the URL keeps the filter.
    await page.reload();
    await expect(page.getByRole("button", { name: "3+" }).first()).toHaveAttribute("aria-pressed", "true");
    await ctx.close();
  });

  test("SEO pages have canonical URLs and listing pages have JSON-LD", async ({ page }) => {
    await page.goto("/rent/lalitpur/apartments");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/rent\/lalitpur\/apartments$/);
    await page
      .getByRole("link")
      .filter({ hasText: /apartment/i })
      .first()
      .click();
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  });

  test("protected pages redirect to sign-in", async ({ page }) => {
    await page.goto("/landlord/listings");
    await expect(page).toHaveURL(/\/login\?returnTo=%2Flandlord%2Flistings/);
  });

  test("@mobile listing page shows the sticky tour CTA and filter sheet works", async ({ browser }) => {
    const ctx = await newContext(browser, { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto("/rent/kathmandu");
    await page.getByRole("button", { name: /Filters/ }).click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator("article a").first().click();
    await expect(page.getByRole("button", { name: "Schedule a tour" })).toBeVisible();
    await ctx.close();
  });
});
