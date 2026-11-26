import { createHash } from "node:crypto";
import { absoluteUrl, site } from "../site.config.mjs";
import { escapeHtml, jsonForScript } from "./text.mjs";

function tagsHtml(tags) {
  if (!tags.length) return "";
  const items = tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("");
  return `<ul class="tags">${items}</ul>`;
}

function referenceHtml(references) {
  if (!references.length) return "";
  const items = references
    .map((ref, index) => {
      let text = "";
      if (ref.authors) text += `${escapeHtml(ref.authors)}`;
      if (ref.year) text += `（${escapeHtml(ref.year)}）`;
      if (ref.authors || ref.year) text += "。";
      const title = ref.url
        ? `<a href="${escapeHtml(ref.url)}" rel="noreferrer">${escapeHtml(ref.title)}</a>`
        : escapeHtml(ref.title);
      text += `<cite>${title}</cite>。`;
      if (ref.note) text += `${escapeHtml(ref.note)}。`;
      return `<li id="ref-${index + 1}">${text}</li>`;
    })
    .join("\n");
  return `<section class="references" aria-labelledby="references-heading">
<h2 id="references-heading">参考文献</h2>
<ol>
${items}
</ol>
</section>`;
}

function page({
  title,
  description,
  canonical,
  robots = "index,follow",
  jsonLd,
  body,
  shell = "read",
  scripts = [],
  theme = "#f6f3ec",
  scheme = "light",
  bodyAttrs = "",
  skipHref = "#main",
  skipLabel = "跳到正文",
}) {
  const structuredData = jsonLd ? jsonForScript(jsonLd) : "";
  const scriptSources = [
    scripts.length ? "'self'" : "",
    structuredData ? `'sha256-${createHash("sha256").update(structuredData).digest("base64")}'` : "",
  ].filter(Boolean);
  const scriptSrc = scriptSources.join(" ") || "'none'";
  const structured = structuredData ? `<script type="application/ld+json">${structuredData}</script>` : "";
  const scriptTags = scripts.map((src) => `<script src="${escapeHtml(src)}" defer></script>`).join("\n");
  const inner = shell === "exhibit" ? body : `<div class="wrap">\n${body}\n</div>`;
  return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${robots}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="${escapeHtml(theme)}">
<meta name="color-scheme" content="${escapeHtml(scheme)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.title)}" href="/feed.xml">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="${jsonLd?.["@type"] === "Article" ? "article" : "website"}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:locale" content="${site.locale}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${scriptSrc}; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'none'">
<link rel="stylesheet" href="/assets/katex/katex.min.css">
<link rel="stylesheet" href="/assets/site.css">
${structured}
</head>
<body class="${shell === "exhibit" ? "exhibit" : "read"}"${bodyAttrs ? ` ${bodyAttrs}` : ""}>
<a class="skip" href="${escapeHtml(skipHref)}">${escapeHtml(skipLabel)}</a>
${inner}
${scriptTags}
</body>
</html>
`;
}

function mark() {
  return `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="16" rx="11" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="16" cy="16" rx="11" ry="5.2" transform="rotate(60 16 16)" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="16" cy="16" rx="11" ry="5.2" transform="rotate(120 16 16)" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="16" cy="16" r="1.7" fill="currentColor"/></svg>`;
}

function footer() {
  return `<footer class="site-footer">
<p>${escapeHtml(site.title)} · <a href="/feed.xml">订阅</a></p>
</footer>`;
}

function articleHeader() {
  return `<header class="masthead">
<a class="brand" href="/">${mark()}<span class="brand-zh">${escapeHtml(site.name)}</span></a>
<span class="brand-sep" aria-hidden="true">·</span>
<a class="brand-column" href="/">${escapeHtml(site.nameEn)}</a>
</header>`;
}

function chapterLink(id, label, current = false) {
  const currentAttr = current ? ' aria-current="true"' : "";
  return `<li><a href="#${id}"${currentAttr}><span class="dot"></span><span class="label">${label}</span></a></li>`;
}

function chainButton(stage, en, zh, pressed = false) {
  return `<li class="chain-step${pressed ? " is-active" : ""}">
<button type="button" data-stage="${stage}" aria-pressed="${pressed ? "true" : "false"}" aria-controls="panel-${stage}">
<span class="chain-en">${en}</span>
<span class="chain-zh">${zh}</span>
</button>
</li>`;
}

function chainPanel(stage, copy) {
  return `<div class="chain-copy" id="panel-${stage}" data-stage="${stage}">
<p>${copy}</p>
</div>`;
}

function metaHtml(post) {
  const author = post.author
    ? `<span class="meta-sep" aria-hidden="true">·</span><span class="author">${escapeHtml(post.author)}</span>`
    : "";
  return `<p class="post-meta"><time datetime="${post.date}">${post.date}</time>${author}</p>`;
}

function postList(posts) {
  if (!posts.length) {
    return `<p class="empty">暂无文章。</p>`;
  }
  const items = posts
    .map((post) => {
      return `<li>
<article>
${metaHtml(post)}
<h3><a href="/posts/${post.slug}/">${escapeHtml(post.title)}</a></h3>
<p class="post-summary">${escapeHtml(post.summary)}</p>
${tagsHtml(post.tags)}
</article>
</li>`;
    })
    .join("\n");
  return `<ol class="post-list">
${items}
</ol>`;
}

export function renderHome(posts) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: site.title,
    description: site.description,
    url: absoluteUrl("/"),
    inLanguage: site.lang,
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      datePublished: post.date,
      url: absoluteUrl(`/posts/${post.slug}/`),
    })),
  };
  return page({
    title: site.title,
    description: site.description,
    canonical: absoluteUrl("/"),
    jsonLd,
    shell: "exhibit",
    scripts: ["/assets/exhibit.js"],
    theme: "#090b0e",
    scheme: "dark",
    bodyAttrs: 'data-exhibit="home"',
    skipHref: "#archive",
    skipLabel: "跳到文章",
    body: `<canvas id="field" class="field" width="2" height="2" aria-hidden="true"></canvas>
<div class="progress" aria-hidden="true"></div>
<nav class="rail" aria-label="章节">
<ol>
${chapterLink("overture", "序幕", true)}
${chapterLink("signal", "信号场")}
${chapterLink("topology", "拓扑")}
${chapterLink("interval", "区间")}
${chapterLink("chain", "证据链")}
${chapterLink("archive", "文章")}
</ol>
<p class="rail-live" aria-live="polite"></p>
</nav>
<main id="main">
<section class="chapter" id="overture" data-label="序幕">
<div class="chapter-copy overture-copy">
<p class="kicker">${mark()}${escapeHtml(site.nameEn)}</p>
<h1>${escapeHtml(site.name)}</h1>
<p class="deck">生成式检索里的可见性，应当能被观察、被判断，并留在可以回放的证据链上。</p>
</div>
</section>
<section class="chapter" id="signal" data-label="信号场">
<div class="chapter-copy">
<p class="kicker">01 — 信号场</p>
<h2>多平台检索不在同一个坐标系里</h2>
<p>查询、引用与时间落在不同的面上，不能加成一个总分。</p>
</div>
</section>
<section class="chapter" id="topology" data-label="拓扑">
<div class="chapter-copy">
<p class="kicker">02 — 提示词空间</p>
<h2>近与远，都要被观察</h2>
<p>同一意图会落在相邻的措辞里，也会被约束推远。不能凭一次回答认定它们的距离。</p>
</div>
</section>
<section class="chapter" id="interval" data-label="区间">
<div class="chapter-copy">
<p class="kicker">03 — 分布与区间</p>
<h2>没有区间的判断，先不要进入证据链</h2>
<p>带还宽的时候，判断保持开放。</p>
</div>
</section>
<section class="chapter" id="chain" data-label="证据链">
<div class="chapter-copy chain-copy-wrap">
<p class="kicker">04 — 证据链</p>
<h2>从观测到完整日，再与快照对照</h2>
<div class="chain" style="--stage: 0">
<div class="chain-beam" aria-hidden="true"></div>
<ol class="chain-nodes">
${chainButton("observation", "Observation", "观测", true)}
${chainButton("judgment", "Judgment", "判断")}
${chainButton("l1", "完整日 L1", "一日的第一层")}
${chainButton("snapshot", "Snapshot", "快照")}
</ol>
<div class="chain-panels">
${chainPanel("observation", "记录检索面上的信号，不宣布结论。")}
${chainPanel("judgment", "判断必须能指回观测。")}
${chainPanel("l1", "以一个完整自然日汇总，不先压成一个分数。")}
${chainPanel("snapshot", "某一时刻的截面，与完整日对照。")}
</div>
</div>
</div>
</section>
<section class="chapter chapter-paper" id="archive" data-label="文章">
<div class="archive-inner">
<p class="kicker kicker-ink">${mark()}${escapeHtml(site.name)}</p>
<h2 id="archive-heading">文章</h2>
${postList(posts)}
${footer()}
</div>
</section>
</main>`,
  });
}

export function renderArticle(post) {
  const canonical = absoluteUrl(`/posts/${post.slug}/`);
  const author = post.author
    ? { "@type": "Person", name: post.author }
    : { "@type": "Organization", name: site.title };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    inLanguage: site.lang,
    mainEntityOfPage: canonical,
    url: canonical,
    author,
    publisher: { "@type": "Organization", name: site.title },
  };
  return page({
    title: `${post.title} · ${site.title}`,
    description: post.summary,
    canonical,
    jsonLd,
    body: `${articleHeader()}
<main id="main">
<article>
<p class="back"><a href="/">全部文章</a></p>
<h1 class="article-title">${escapeHtml(post.title)}</h1>
${metaHtml(post)}
${tagsHtml(post.tags)}
<p class="article-summary">${escapeHtml(post.summary)}</p>
<div class="prose">
${post.html}
</div>
${referenceHtml(post.references)}
</article>
</main>
${footer()}`,
  });
}

export function renderNotFound() {
  return page({
    title: `未找到页面 · ${site.title}`,
    description: "未找到该页面。",
    canonical: absoluteUrl("/"),
    robots: "noindex",
    shell: "exhibit",
    scripts: ["/assets/exhibit.js"],
    theme: "#090b0e",
    scheme: "dark",
    bodyAttrs: 'data-exhibit="lost"',
    skipHref: "#lost-title",
    skipLabel: "跳到标题",
    body: `<canvas id="field" class="field" width="2" height="2" aria-hidden="true"></canvas>
<main id="main" class="lost">
<p class="kicker">${mark()}${escapeHtml(site.name)}</p>
<p class="lost-en">${escapeHtml(site.nameEn)}</p>
<h1 id="lost-title">未找到该页面</h1>
<p class="cue"><a class="return" href="/">返回首页</a></p>
</main>`,
  });
}

export function renderRobots() {
  return `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}

export function renderSitemap(posts) {
  const urls = ["/", ...posts.map((post) => `/posts/${post.slug}/`)];
  const body = urls
    .map((pathname) => {
      const lastmod = pathname === "/" ? "" : `\n    <lastmod>${posts.find((post) => pathname === `/posts/${post.slug}/`).date}</lastmod>`;
      return `  <url>\n    <loc>${escapeHtml(absoluteUrl(pathname))}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function rssDate(ymd) {
  return new Date(`${ymd}T12:00:00Z`).toUTCString();
}

export function renderRss(posts) {
  const items = posts
    .map(
      (post) => `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(absoluteUrl(`/posts/${post.slug}/`))}</link>
      <guid>${escapeHtml(absoluteUrl(`/posts/${post.slug}/`))}</guid>
      <pubDate>${rssDate(post.date)}</pubDate>
      <description>${escapeHtml(post.summary)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(site.title)}</title>
    <link>${escapeHtml(absoluteUrl("/"))}</link>
    <description>${escapeHtml(site.description)}</description>
    <language>${site.lang}</language>
${items}
  </channel>
</rss>
`;
}
