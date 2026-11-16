import "server-only";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { env } from "./env";
import { logger } from "./logger";

let sns: SNSClient | undefined;

/** Transactional SMS via Amazon SNS. No-op unless SMS_ENABLED (Nepal carrier deliverability must be verified first). */
export async function sendSms(phoneE164: string | null | undefined, message: string): Promise<void> {
  if (!env.SMS_ENABLED || !phoneE164) return;
  try {
    sns ??= new SNSClient({ region: env.AWS_REGION });
    await sns.send(
      new PublishCommand({
        PhoneNumber: phoneE164,
        Message: message.slice(0, 300),
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
          "AWS.SNS.SMS.SenderID": { DataType: "String", StringValue: "GharKhoj" },
        },
      }),
    );
  } catch (err) {
    logger.warn({ err }, "sms send failed");
  }
}
