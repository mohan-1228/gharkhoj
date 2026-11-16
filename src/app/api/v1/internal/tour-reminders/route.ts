import { assertInternalRequest } from "@/server/auth/internal";
import { json, route } from "@/server/lib/http";
import { sendDueReminders } from "@/server/services/tour-service";

/** POST /api/v1/internal/tour-reminders — called by the tour-reminders Lambda (EventBridge, every 15 min). */
export const POST = route(async (req) => {
  assertInternalRequest(req);
  return json(await sendDueReminders());
});
