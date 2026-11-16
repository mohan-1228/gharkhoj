import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";
import path from "node:path";
import os from "node:os";

export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

/** New isolated browser context with the cookie notice pre-dismissed. */
export async function newContext(
  browser: Browser,
  opts: Parameters<Browser["newContext"]>[0] = {},
): Promise<BrowserContext> {
  const ctx = await browser.newContext(opts);
  await ctx.addInitScript(() => localStorage.setItem("gk_cookie_notice_v1", "1"));
  return ctx;
}

/** Dev-mode sign-in (AUTH_MODE=dev). Creates the account if it doesn't exist. */
export async function devSignIn(page: Page, email: string, role: "renter" | "landlord" = "renter") {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Account type for new accounts").selectOption(role);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function signInAsDemo(page: Page, name: RegExp) {
  await page.goto("/login");
  await page.getByRole("button", { name }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

export async function testPhoto(): Promise<string> {
  const file = path.join(os.tmpdir(), `gk-e2e-${Date.now()}.jpg`);
  await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#7a9" } })
    .jpeg()
    .toFile(file);
  return file;
}

/** Wait for an email to arrive in Mailpit for a recipient with a subject fragment. */
export async function expectEmail(to: string, subjectIncludes: string) {
  await expect
    .poll(
      async () => {
        const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
        if (!res.ok) return [];
        const body = (await res.json()) as { messages: { Subject: string }[] };
        return body.messages.map((m) => m.Subject);
      },
      { timeout: 15_000, message: `email to ${to} containing "${subjectIncludes}"` },
    )
    .toEqual(expect.arrayContaining([expect.stringContaining(subjectIncludes)]));
}
