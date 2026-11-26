export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function jsonForScript(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

export function collapseWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

export function charLength(value) {
  return [...value].length;
}

export function isValidYmd(year, month, day) {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function formatYmd(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SAFE_SCHEMES = new Set(["http", "https"]);

export function safeUrl(raw, { mailto = false } = {}) {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (!href || /[\u0000-\u001F\s]/.test(href)) return null;
  if (href.startsWith("//") || href.startsWith("\\\\")) return null;

  let decoded = href;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    return null;
  }
  if (/[\u0000-\u001F\s]/.test(decoded)) return null;

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(decoded);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (SAFE_SCHEMES.has(name)) return href;
    if (mailto && name === "mailto" && href.length > "mailto:".length) return href;
    return null;
  }

  if (href.startsWith("#") || href.startsWith("/") || href.startsWith("./") || href.startsWith("../")) {
    return href;
  }
  if (!href.includes(":")) return href;
  return null;
}

export function headingId(text, used) {
  const plain = String(text)
    .replace(/<[^>]+>/g, "")
    .trim()
    .toLowerCase();
  let id = plain
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]+/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!id) id = "section";
  let unique = id;
  let suffix = 2;
  while (used.has(unique)) {
    unique = `${id}-${suffix}`;
    suffix += 1;
  }
  used.add(unique);
  return unique;
}
