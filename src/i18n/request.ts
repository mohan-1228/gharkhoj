import { getRequestConfig } from "next-intl/server";

/**
 * English only for v1. Nepali (`ne`) is wired in by adding src/messages/ne.json
 * and resolving the locale from a cookie or Accept-Language here (see ADR-0008).
 */
export const locales = ["en", "ne"] as const;
export const defaultLocale = "en";

export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    timeZone: "Asia/Kathmandu",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
