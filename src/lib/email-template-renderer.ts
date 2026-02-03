import { db } from "@/lib/db";

/**
 * Email Template Renderer
 *
 * Renders email campaigns with organization branding and consistent styling.
 * Supports both HTML and plain text versions.
 */

export interface OrganizationBranding {
  name: string;
  logo?: string | null;
  primaryColor: string;
  secondaryColor: string;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
}

export interface RenderEmailOptions {
  subject: string;
  body: string; // HTML content from WYSIWYG editor
  branding: OrganizationBranding;
  recipientName?: string;
  unsubscribeUrl?: string;
}

/**
 * Get organization branding for email templates
 */
export async function getOrganizationBranding(organizationId: string): Promise<OrganizationBranding> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    include: {
      websiteConfig: true,
    },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  return {
    name: org.name,
    logo: org.websiteConfig?.logo || org.logo,
    primaryColor: org.websiteConfig?.primaryColor || "#2563eb",
    secondaryColor: org.websiteConfig?.secondaryColor || "#ffffff",
    email: org.email,
    phone: org.phone,
    street: org.street,
    city: org.city,
    stateProvince: org.stateProvince,
    postalCode: org.postalCode,
  };
}

/**
 * Convert hex color to a darker shade for better text contrast
 */
function darkenColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Darken
  const newR = Math.max(0, Math.floor(r * (1 - percent / 100)));
  const newG = Math.max(0, Math.floor(g * (1 - percent / 100)));
  const newB = Math.max(0, Math.floor(b * (1 - percent / 100)));

  // Convert back to hex
  return `#${newR.toString(16).padStart(2, "0")}${newG.toString(16).padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

/**
 * Check if a color is light (for determining text color)
 */
function isLightColor(hex: string): boolean {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

/**
 * Build the formatted address string
 */
function formatAddress(branding: OrganizationBranding): string | null {
  const parts = [
    branding.street,
    [branding.city, branding.stateProvince, branding.postalCode].filter(Boolean).join(", "),
  ].filter(Boolean);

  return parts.length > 0 ? parts.join("<br>") : null;
}

/**
 * Render a full branded email from campaign content
 */
export function renderCampaignEmail(options: RenderEmailOptions): { html: string; text: string } {
  const { subject, body, branding, recipientName, unsubscribeUrl } = options;

  const primaryColor = branding.primaryColor || "#2563eb";
  const buttonTextColor = isLightColor(primaryColor) ? "#000000" : "#ffffff";
  const headerBgColor = primaryColor;
  const headerTextColor = buttonTextColor;
  const address = formatAddress(branding);

  // Process the body to ensure proper styling for email clients
  const processedBody = processHtmlForEmail(body, primaryColor);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    /* Reset styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
    }
    a[x-apple-data-detectors] {
      color: inherit !important;
      text-decoration: none !important;
      font-size: inherit !important;
      font-family: inherit !important;
      font-weight: inherit !important;
      line-height: inherit !important;
    }
    /* Custom styles */
    .email-body p {
      margin: 0 0 16px 0;
      line-height: 1.6;
    }
    .email-body ul, .email-body ol {
      margin: 0 0 16px 0;
      padding-left: 24px;
    }
    .email-body li {
      margin-bottom: 8px;
    }
    .email-body a {
      color: ${primaryColor};
      text-decoration: underline;
    }
    .email-body blockquote {
      border-left: 4px solid ${primaryColor};
      margin: 16px 0;
      padding-left: 16px;
      color: #6b7280;
      font-style: italic;
    }
    .email-body h1, .email-body h2, .email-body h3 {
      color: #1f2937;
      margin: 24px 0 16px 0;
    }
    .email-body h1 { font-size: 24px; }
    .email-body h2 { font-size: 20px; }
    .email-body h3 { font-size: 18px; }
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .email-content {
        padding: 24px 16px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <!-- Email Container -->
        <table role="presentation" class="email-container" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="background-color: ${headerBgColor}; padding: 24px 32px;">
              ${branding.logo 
                ? `<img src="${branding.logo}" alt="${escapeHtml(branding.name)}" style="max-width: 200px; max-height: 60px; height: auto;" />`
                : `<h1 style="margin: 0; font-size: 24px; font-weight: bold; color: ${headerTextColor};">${escapeHtml(branding.name)}</h1>`
              }
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="email-content" style="padding: 32px;">
              ${recipientName ? `<p style="margin: 0 0 16px 0; font-size: 16px; color: #374151;">Hi ${escapeHtml(recipientName)},</p>` : ""}
              
              <div class="email-body" style="font-size: 16px; color: #374151; line-height: 1.6;">
                ${processedBody}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #374151;">
                      ${escapeHtml(branding.name)}
                    </p>
                    ${address ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${address}</p>` : ""}
                    ${branding.email ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;"><a href="mailto:${branding.email}" style="color: #6b7280;">${branding.email}</a></p>` : ""}
                    ${branding.phone ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">${branding.phone}</p>` : ""}
                  </td>
                </tr>
                ${unsubscribeUrl ? `
                <tr>
                  <td style="text-align: center; padding-top: 16px;">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                      <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a> from these emails
                    </p>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>
        </table>

        <!-- Email disclaimer -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
          <tr>
            <td style="padding: 24px 16px; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                This email was sent by ${escapeHtml(branding.name)}. You received this email because you are a member or have registered with this organization.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  // Generate plain text version
  const text = generatePlainText(body, branding, recipientName, unsubscribeUrl);

  return { html, text };
}

/**
 * Process HTML content to ensure proper email client compatibility
 */
function processHtmlForEmail(html: string, primaryColor: string): string {
  // Replace common Tailwind/CSS classes with inline styles
  let processed = html;

  // Process links to have the brand color
  processed = processed.replace(
    /<a\s+href="([^"]+)"([^>]*)>/gi,
    `<a href="$1" style="color: ${primaryColor}; text-decoration: underline;"$2>`
  );

  // Ensure images are responsive
  processed = processed.replace(
    /<img([^>]*)>/gi,
    '<img$1 style="max-width: 100%; height: auto;">'
  );

  // Process text alignment from TipTap
  processed = processed.replace(
    /style="text-align:\s*(left|center|right)"/gi,
    'style="text-align: $1;"'
  );

  return processed;
}

/**
 * Generate plain text version from HTML
 */
function generatePlainText(
  html: string,
  branding: OrganizationBranding,
  recipientName?: string,
  unsubscribeUrl?: string
): string {
  // Simple HTML to text conversion
  let text = html;

  // Remove HTML tags but preserve some structure
  text = text.replace(/<h[1-6][^>]*>/gi, "\n\n## ");
  text = text.replace(/<\/h[1-6]>/gi, "\n");
  text = text.replace(/<p[^>]*>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<li[^>]*>/gi, "\n- ");
  text = text.replace(/<\/li>/gi, "");
  text = text.replace(/<ul[^>]*>|<\/ul>|<ol[^>]*>|<\/ol>/gi, "\n");
  text = text.replace(/<blockquote[^>]*>/gi, "\n> ");
  text = text.replace(/<\/blockquote>/gi, "\n");
  
  // Extract link text and URL
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)");

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  // Build the full plain text email
  const lines = [
    recipientName ? `Hi ${recipientName},` : "",
    "",
    text,
    "",
    "---",
    branding.name,
    branding.email || "",
    branding.phone || "",
    "",
    unsubscribeUrl ? `Unsubscribe: ${unsubscribeUrl}` : "",
  ];

  return lines.filter((line) => line !== undefined).join("\n").trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Generate a preview of the email (for the dashboard)
 */
export function generateEmailPreview(
  body: string,
  branding: OrganizationBranding,
  recipientName?: string
): string {
  const { html } = renderCampaignEmail({
    subject: "Preview",
    body,
    branding,
    recipientName: recipientName || "Preview User",
  });
  return html;
}
