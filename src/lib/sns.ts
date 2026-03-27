import MessageValidator from "sns-validator";

const snsValidator = new MessageValidator();

/**
 * Validate an SNS message signature. Rejects with an error if invalid.
 */
export function validateSnsMessage(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    snsValidator.validate(body, (err, message) => {
      if (err) reject(err);
      else if (message) resolve(message);
      else reject(new Error("SNS validation returned no message"));
    });
  });
}

/**
 * Validate an SNS SubscribeURL to prevent SSRF.
 *
 * Even though the SNS message signature is verified, an attacker who
 * compromises the signing certificate (or a future vulnerability in
 * sns-validator) could inject an arbitrary URL.  Defence-in-depth:
 * only allow HTTPS to official AWS SNS endpoints.
 *
 * Legitimate URLs look like:
 *   https://sns.us-east-1.amazonaws.com/?Action=ConfirmSubscription&...
 */
export function validateSubscribeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:") return false;

  return /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(parsed.hostname);
}
