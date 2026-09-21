/**
 * Lightweight server-side HTML sanitizer for rich content produced by the
 * dashboard content editor. Removes dangerous tags and event-handler
 * attributes while preserving the safe formatting tags the editor emits
 * (headings, paragraphs, bold, italic, lists, quotes, tables, images).
 *
 * This is a defense-in-depth layer — the editor itself only produces safe
 * tags, but we sanitize on save so stored content is always safe to render
 * via dangerouslySetInnerHTML on the public site.
 */

const DANGEROUS_TAGS = /<(script|style|iframe|object|embed|form|input|meta|link|base|noscript|template|applet|frame|frameset)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const DANGEROUS_SELF_CLOSING = /<(script|style|iframe|object|embed|form|input|meta|link|base|noscript|template|applet|frame|frameset)\b[^>]*\/?>/gi;

const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "sub", "sup", "mark",
  "ul", "ol", "li",
  "blockquote", "pre", "code",
  "table", "thead", "tbody", "tfoot", "tr", "td", "th",
  "caption", "colgroup", "col",
  "img", "a",
  "figure", "figcaption",
]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title",
  "width", "height",
  "colspan", "rowspan",
  "style",
]);

const SAFE_STYLE_PATTERN = /^(text-align|font-weight|font-style|text-decoration|color|background-color|padding|margin|width|height|max-width|border-collapse|border-spacing|border|text-transform|font-size|line-height|vertical-align|white-space|list-style-type|display|table-layout)\s*:/i;

function stripDangerousTags(html) {
  let cleaned = html.replace(DANGEROUS_TAGS, "");
  cleaned = cleaned.replace(DANGEROUS_SELF_CLOSING, "");
  return cleaned;
}

function stripEventHandlers(html) {
  return html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

function stripDangerousUrls(html) {
  return html
    .replace(/(href|src)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*["']\s*data:[^"']*["']/gi, '$1="#"');
}

function sanitizeStyleValue(style) {
  if (!style) return "";
  return style
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => decl && SAFE_STYLE_PATTERN.test(decl))
    .join("; ");
}

function sanitizeAttributes(tag, attrs) {
  return attrs.replace(/(\w[\w-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, (match, name, value) => {
    const lowerName = name.toLowerCase();
    if (!ALLOWED_ATTRS.has(lowerName)) return "";
    if (lowerName === "style") {
      const inner = value.replace(/^["']|["']$/g, "");
      const safe = sanitizeStyleValue(inner);
      return safe ? ` style="${safe}"` : "";
    }
    return match;
  });
}

/**
 * Sanitize an HTML string for safe storage and rendering.
 * Removes dangerous tags, event handlers, javascript: URLs, and
 * disallowed attributes/tags.
 */
export function sanitizeRichHtml(html) {
  if (!html || typeof html !== "string") return "";

  let cleaned = stripDangerousTags(html);
  cleaned = stripEventHandlers(cleaned);
  cleaned = stripDangerousUrls(cleaned);

  // Walk tags and keep only allowed ones with allowed attributes.
  cleaned = cleaned.replace(/<\/?(\w[\w-]*)([^>]*)>/g, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(lowerTag)) return "";
    const safeAttrs = sanitizeAttributes(tag, attrs);
    const isClosing = match.startsWith("</");
    return isClosing ? `</${lowerTag}>` : `<${lowerTag}${safeAttrs}>`;
  });

  return cleaned.trim();
}
