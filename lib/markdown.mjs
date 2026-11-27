import hljs from "highlight.js";
import katex from "katex";
import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import { compareChartExtension } from "./compare.mjs";
import { BuildError } from "./errors.mjs";
import { escapeHtml, headingId, safeUrl } from "./text.mjs";

const INLINE_MATH = /^\$((?:\\.|[^$\n])+?)\$/;
const BLOCK_MATH = /^\$\$[ \t]*\n([\s\S]+?)\n\$\$[ \t]*(?:\n|$)/;
const INLINE_PAREN = /^\\\(([^\n]+?)\\\)/;
const BLOCK_BRACKET = /^\\\[([ \t]*\n[\s\S]+?)\n\\\][ \t]*(?:\n|$)/;

function looksLikeMath(text) {
  const value = text.trim();
  if (!value || value.length > 2000) return false;
  // Dollar signs around Chinese prose are kept as text. TeX can still opt in with a command.
  if (/[\p{Script=Han}]/u.test(value) && !value.includes("\\")) return false;
  if (/[\\^_{}]/.test(value) || value.includes("=")) return true;
  // Spaced phrases without a formula marker are left alone, so "$5 到 $10" is not math.
  if (/\s/.test(value)) return false;
  return /^[A-Za-z][A-Za-z0-9+\-*/<>,.'()|]*$/.test(value);
}

function assertFootnoteLabels(source) {
  for (const match of source.matchAll(/(?:^|\n)\[\^([^\]\n]+)\]:/g)) {
    const label = match[1];
    if (label.length > 40 || /[<>"'&=]/.test(label)) {
      throw new BuildError(`脚注标记包含不允许的字符：${label}`);
    }
  }
}

function renderKatex(tex, displayMode) {
  const source = tex.trim();
  if (!source) throw new BuildError("公式为空");
  if (source.length > 20000) throw new BuildError("公式过长");
  try {
    return katex.renderToString(source, {
      displayMode,
      throwOnError: true,
      strict: "ignore",
      trust: false,
      output: "htmlAndMathml",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BuildError(`公式无法解析：${message}`);
  }
}

function inlineMathExtension() {
  return {
    name: "inlineKatex",
    level: "inline",
    start(src) {
      let from = 0;
      while (from < src.length) {
        const index = src.indexOf("$", from);
        if (index === -1) return;
        if (src[index + 1] === "$") {
          from = index + 2;
          continue;
        }
        const match = INLINE_MATH.exec(src.slice(index));
        if (match && looksLikeMath(match[1])) return index;
        from = index + 1;
      }
    },
    tokenizer(src) {
      const match = INLINE_MATH.exec(src);
      if (!match || !looksLikeMath(match[1])) return;
      return {
        type: "inlineKatex",
        raw: match[0],
        text: match[1].trim(),
        displayMode: false,
      };
    },
    renderer(token) {
      return renderKatex(token.text, false);
    },
  };
}

function parenMathExtension() {
  return {
    name: "parenKatex",
    level: "inline",
    start(src) {
      const index = src.indexOf("\\(");
      return index === -1 ? undefined : index;
    },
    tokenizer(src) {
      const match = INLINE_PAREN.exec(src);
      if (!match) return;
      return {
        type: "parenKatex",
        raw: match[0],
        text: match[1].trim(),
      };
    },
    renderer(token) {
      return renderKatex(token.text, false);
    },
  };
}

function blockMathExtension() {
  return {
    name: "blockKatex",
    level: "block",
    start(src) {
      const index = src.indexOf("$$");
      return index === -1 ? undefined : index;
    },
    tokenizer(src) {
      const match = BLOCK_MATH.exec(src);
      if (!match) return;
      return {
        type: "blockKatex",
        raw: match[0],
        text: match[1].trim(),
        displayMode: true,
      };
    },
    renderer(token) {
      return `${renderKatex(token.text, true)}\n`;
    },
  };
}

function bracketMathExtension() {
  return {
    name: "bracketKatex",
    level: "block",
    start(src) {
      const index = src.indexOf("\\[");
      return index === -1 ? undefined : index;
    },
    tokenizer(src) {
      const match = BLOCK_BRACKET.exec(src);
      if (!match) return;
      return {
        type: "bracketKatex",
        raw: match[0],
        text: match[1].trim(),
      };
    },
    renderer(token) {
      return `${renderKatex(token.text, true)}\n`;
    },
  };
}

function resolveLanguage(lang) {
  const raw = (lang || "").trim().split(/\s+/)[0] ?? "";
  if (!raw) return "";
  if (hljs.getLanguage(raw)) return raw;
  const lower = raw.toLowerCase();
  if (hljs.getLanguage(lower)) return lower;
  return "";
}

function languageLabel(lang) {
  return (lang || "")
    .trim()
    .split(/\s+/)[0]
    .replace(/[^\w#+.-]/g, "")
    .slice(0, 24);
}

function requireUrl(href, kind) {
  const safe = safeUrl(href, { mailto: kind === "link" });
  if (!safe) throw new BuildError(`不允许的${kind === "image" ? "图片" : "链接"}地址：${href}`);
  return safe;
}

function createMarked(usedIds) {
  const charts = { n: 0 };
  const marked = new Marked({ gfm: true, breaks: false });
  marked.use(
    markedFootnote({
      description: "脚注",
      refMarkers: true,
      footnoteDivider: false,
      headingClass: "footnotes-title",
      sectionClass: "footnotes",
      backRefLabel: "返回正文引用 {0}",
    }),
  );
  marked.use({
    extensions: [
      compareChartExtension(charts),
      blockMathExtension(),
      bracketMathExtension(),
      inlineMathExtension(),
      parenMathExtension(),
    ],
    renderer: {
      html(token) {
        return escapeHtml(token.text);
      },
      heading(token) {
        const depth = Math.min(token.depth + 1, 6);
        const inner = this.parser.parseInline(token.tokens);
        const id = headingId(token.text, usedIds);
        const encoded = escapeHtml(id);
        return `<h${depth} id="${encoded}">${inner}<a class="heading-anchor" href="#${encoded}" aria-label="章节链接">#</a></h${depth}>\n`;
      },
      code(token) {
        const requested = languageLabel(token.lang);
        const resolved = resolveLanguage(token.lang);
        const highlighted = resolved
          ? hljs.highlight(token.text, { language: resolved, ignoreIllegals: true }).value
          : escapeHtml(token.text);
        const className = resolved ? `hljs language-${escapeHtml(resolved)}` : "hljs";
        const label = requested ? `<span class="code-lang">${escapeHtml(requested)}</span>` : "";
        return `<div class="code-block">${label}<pre><code class="${className}">${highlighted}</code></pre></div>\n`;
      },
      codespan(token) {
        return `<code>${escapeHtml(token.text)}</code>`;
      },
      link(token) {
        const text = this.parser.parseInline(token.tokens);
        const href = requireUrl(token.href, "link");
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        const external = /^https?:/i.test(href) ? ' rel="noreferrer"' : "";
        return `<a href="${escapeHtml(href)}"${title}${external}>${text}</a>`;
      },
      image(token) {
        const href = requireUrl(token.href, "image");
        if (href.startsWith("mailto:")) throw new BuildError(`不允许的图片地址：${token.href}`);
        const title = token.title ? ` title="${escapeHtml(token.title)}"` : "";
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(token.text || "")}"${title}>`;
      },
      table(token) {
        let header = "";
        for (const cell of token.header) header += this.tablecell(cell);
        let body = "";
        for (const row of token.rows) {
          let cells = "";
          for (const cell of row) cells += this.tablecell(cell);
          body += this.tablerow({ text: cells });
        }
        const bodyHtml = body ? `<tbody>${body}</tbody>` : "";
        return `<div class="table-wrap"><table>\n<thead>\n${this.tablerow({ text: header })}</thead>\n${bodyHtml}</table></div>\n`;
      },
    },
  });
  return marked;
}

function assertSafeHtml(html) {
  if (/<\s*(script|iframe|object|embed|form|link|meta)\b/i.test(html)) {
    throw new BuildError("渲染结果包含不允许的 HTML 标签");
  }
}

export function renderMarkdown(source) {
  const usedIds = new Set();
  const marked = createMarked(usedIds);
  const normalized = String(source).replaceAll("\r\n", "\n");
  assertFootnoteLabels(normalized);
  let html;
  try {
    html = marked.parse(normalized);
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).replace(
      /\nPlease report this to https:\/\/github\.com\/markedjs\/marked\.\s*$/,
      "",
    );
    throw new BuildError(message);
  }
  if (typeof html !== "string") throw new BuildError("Markdown 渲染结果异常");
  assertSafeHtml(html);
  return html;
}
