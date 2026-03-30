/**
 * Bridge Token Utilities
 *
 * Helper functions for creating and validating session bridge tokens
 * for cross-domain authentication.
 */

const BRIDGE_TOKEN_MAX_AGE = 60; // 60 seconds

/**
 * Create a bridge token for cross-domain session transfer
 * This is used in the custom Google callback to pass authentication
 * from localhost:3000 to the subdomain.
 */
export function createBridgeToken(email: string, secret: string): string {
  const crypto = require("crypto");
  const exp = Date.now() + BRIDGE_TOKEN_MAX_AGE * 1000;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${email}:${exp}`)
    .digest("base64url");

  const tokenData = { email, exp, signature };
  return Buffer.from(JSON.stringify(tokenData)).toString("base64url");
}
