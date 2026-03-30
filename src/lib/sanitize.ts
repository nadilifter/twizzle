import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML content for safe rendering via dangerouslySetInnerHTML.
 * Strips all tags/attributes except a curated allowlist of formatting elements.
 */
export const sanitizeHtml = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "br",
      "p",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "span",
      "h1",
      "h2",
      "h3",
      "h4",
      "div",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    ALLOWED_ATTR: ["href", "class", "target", "rel", "style"],
  });

/**
 * Sanitize SVG content server-side before storing uploaded files.
 * Preserves valid SVG structure while stripping scripts and event handlers.
 */
export const sanitizeSvg = (dirty: string): string =>
  DOMPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
