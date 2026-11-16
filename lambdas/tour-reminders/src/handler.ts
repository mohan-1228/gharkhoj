/**
 * tour-reminders Lambda — triggered by EventBridge Scheduler every 15 minutes.
 * Delegates to the app's internal endpoint so business logic stays in
 * src/server/services (single source of truth, testable, no DB creds in Lambda).
 */
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const secrets = new SecretsManagerClient({});
let secret: string | undefined;

export async function handler(): Promise<{ sent: number }> {
  secret ??= (await secrets.send(new GetSecretValueCommand({ SecretId: process.env.INTERNAL_SECRET_ARN! })))
    .SecretString!;
  const res = await fetch(`${process.env.APP_URL}/api/v1/internal/tour-reminders`, {
    method: "POST",
    headers: { "x-internal-secret": secret, "content-type": "application/json" },
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`Reminder endpoint failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { sent: number };
  console.log(JSON.stringify({ msg: "tour reminders sent", ...body }));
  return body;
}
