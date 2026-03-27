/**
 * Email Parser
 *
 * Utilities for parsing raw email content from SES inbound notifications.
 * Extracts text and HTML body parts and strips quoted reply content.
 */

/**
 * Extract text and HTML body from a raw email string.
 * Handles simple single-part and multipart/alternative emails.
 */
export function extractEmailBody(rawEmail: string): {
  text: string;
  html: string | null;
} {
  const boundaryMatch = rawEmail.match(/boundary="?([^"\r\n;]+)"?/i);

  if (!boundaryMatch) {
    const bodyStart = rawEmail.indexOf("\r\n\r\n");
    if (bodyStart === -1) {
      const altBodyStart = rawEmail.indexOf("\n\n");
      const body = altBodyStart !== -1 ? rawEmail.substring(altBodyStart + 2) : rawEmail;
      return { text: stripQuotedContent(body.trim()), html: null };
    }
    const body = rawEmail.substring(bodyStart + 4);
    return { text: stripQuotedContent(body.trim()), html: null };
  }

  const boundary = boundaryMatch[1];
  const parts = rawEmail.split(`--${boundary}`);

  let text = "";
  let html: string | null = null;

  for (const part of parts) {
    if (part.trim() === "--" || part.trim() === "") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      const altHeaderEnd = part.indexOf("\n\n");
      if (altHeaderEnd === -1) continue;
      const headers = part.substring(0, altHeaderEnd).toLowerCase();
      const body = part.substring(altHeaderEnd + 2).trim();
      if (headers.includes("text/plain")) text = body;
      else if (headers.includes("text/html")) html = body;
      continue;
    }

    const headers = part.substring(0, headerEnd).toLowerCase();
    const body = part.substring(headerEnd + 4).trim();

    if (headers.includes("text/plain")) {
      text = body;
    } else if (headers.includes("text/html")) {
      html = body;
    }
  }

  return {
    text: stripQuotedContent(text),
    html,
  };
}

/**
 * Strip quoted reply content from email text.
 * Removes lines starting with "> " and common "On ... wrote:" preambles.
 */
function stripQuotedContent(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (line.startsWith(">")) break;
    if (/^On .+ wrote:$/i.test(line.trim())) break;
    if (/^-{3,}\s*Original Message/i.test(line.trim())) break;
    if (/^_{3,}$/i.test(line.trim())) break;
    result.push(line);
  }

  return result.join("\n").trim();
}
