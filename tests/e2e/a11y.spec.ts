import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { newContext } from "./helpers";

/** WCAG 2.1 AA automated checks on key pages (CLAUDE.md §4.9). Manual checks are in docs/qa/accessibility.md. */
const PAGES = ["/", "/rent/kathmandu", "/login", "/help", "/privacy"];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ browser }) => {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude(".leaflet-container")
      .analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    await ctx.close();
  });
}

test("listing detail page is accessible", async ({ browser }) => {
  const ctx = await newContext(browser);
  const page = await ctx.newPage();
  await page.goto("/rent/kathmandu");
  await page.locator("article a").first().click();
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .exclude(".leaflet-container")
    .analyze();
  expect(results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual(
    [],
  );
  await ctx.close();
});
