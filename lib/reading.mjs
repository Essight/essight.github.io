/* Reading aids computed at build time from the rendered article HTML. No client script. */

function visibleText(html) {
  return String(html)
    .replace(/<math[\s\S]*?<\/math>/g, " ")
    .replace(/<pre[\s\S]*?<\/pre>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
}

export function readingMinutes(html) {
  const text = visibleText(html);
  const han = (text.match(/\p{Script=Han}/gu) || []).length;
  const words = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  return Math.max(1, Math.round(han / 420 + words / 230));
}

/* Headings come out of lib/markdown.mjs as <hN id="…">…<a class="heading-anchor" …>. */
export function extractToc(html) {
  const found = [];
  const pattern = /<h([2-4]) id="([^"]+)">([\s\S]*?)<a class="heading-anchor"/g;
  for (const match of String(html).matchAll(pattern)) {
    const text = match[3]
      .replace(/<math[\s\S]*?<\/math>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text) found.push({ depth: Number(match[1]), id: match[2], text });
  }
  if (!found.length) return [];
  const top = Math.min(...found.map((item) => item.depth));
  return found
    .filter((item) => item.depth <= top + 1)
    .map((item) => ({ ...item, level: item.depth === top ? 1 : 2 }));
}
