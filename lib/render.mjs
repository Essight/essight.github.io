import { createHash } from "node:crypto";
import { absoluteUrl, site } from "../site.config.mjs";
import { emblemSvg } from "./emblem.mjs";
import { extractToc, readingMinutes } from "./reading.mjs";
import { escapeHtml, jsonForScript } from "./text.mjs";

const sha256 = (text) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;

/*
 * Runs before first paint on exhibit pages so pre-reveal states never flash. Hashed into the CSP.
 * If the exhibit script never arrives, the class is withdrawn and every line shows as plain text.
 */
const BOOT =
  'var d=document.documentElement;d.classList.add("js");setTimeout(function(){if(!window.__essight)d.classList.remove("js")},2500)';

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
  bodyAttrs = "",
  skipHref = "#main",
  skipLabel = "跳到正文",
  assets,
}) {
  const exhibit = shell === "exhibit";
  const structuredData = jsonLd ? jsonForScript(jsonLd) : "";
  const scriptSources = [
    scripts.length ? "'self'" : "",
    exhibit ? sha256(BOOT) : "",
    structuredData ? sha256(structuredData) : "",
  ].filter(Boolean);
  const scriptSrc = scriptSources.join(" ") || "'none'";
  const structured = structuredData ? `<script type="application/ld+json">${structuredData}</script>` : "";
  const boot = exhibit ? `<script>${BOOT}</script>` : "";
  const scriptTags = scripts.map((src) => `<script src="${escapeHtml(src)}" defer></script>`).join("\n");
  const themeMeta = exhibit
    ? `<meta name="theme-color" content="#06100d">
<meta name="color-scheme" content="dark">`
    : `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f5ef">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1613">
<meta name="color-scheme" content="light dark">`;
  return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${robots}">
<meta name="referrer" content="strict-origin-when-cross-origin">
${themeMeta}
<link rel="canonical" href="${escapeHtml(canonical)}">
<link rel="icon" href="${escapeHtml(assets.favicon)}" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${escapeHtml(site.title)}" href="/feed.xml">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="${jsonLd?.["@type"] === "Article" ? "article" : "website"}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:site_name" content="${escapeHtml(site.title)}">
<meta property="og:locale" content="${site.locale}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src ${scriptSrc}; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'">
${boot}
<link rel="stylesheet" href="${escapeHtml(assets.katex)}">
<link rel="stylesheet" href="${escapeHtml(assets.css)}">
${structured}
</head>
<body class="${exhibit ? "exhibit" : "read"}"${bodyAttrs ? ` ${bodyAttrs}` : ""}>
<a class="skip" href="${escapeHtml(skipHref)}">${escapeHtml(skipLabel)}</a>
${body}
${scriptTags}
</body>
</html>
`;
}

function mark() {
  return `<svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="16" rx="11" ry="5.2" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="16" cy="16" rx="11" ry="5.2" transform="rotate(60 16 16)" fill="none" stroke="currentColor" stroke-width="1.3"/><ellipse cx="16" cy="16" rx="11" ry="5.2" transform="rotate(120 16 16)" fill="none" stroke="currentColor" stroke-width="1.3"/><circle class="mark-core" cx="16" cy="16" r="1.9"/></svg>`;
}

/* Heading text split per character for the reveal; the intact text stays for assistive tech. */
const CLOSING = /^[，。、；：！？）」』》〉”’…—,.;:!?)]$/u;

function split(text) {
  const tokens = [];
  for (const char of text) {
    // Keep closing punctuation glued to the character before it, so no line opens with "，".
    if (tokens.length && CLOSING.test(char)) tokens[tokens.length - 1] += char;
    else tokens.push(char);
  }
  const chars = tokens
    .map((token, index) =>
      token === " " ? `<span class="ch sp"> </span>` : `<span class="ch" style="--i:${index}">${escapeHtml(token)}</span>`,
    )
    .join("");
  return `<span class="sr-only">${escapeHtml(text)}</span><span class="split" aria-hidden="true">${chars}</span>`;
}

/* "Essight" with the brand's gold dot riding the i. */
function wordmark(className = "wordmark") {
  return `<p class="${className}"><span class="sr-only">${escapeHtml(site.nameEn)}</span><span class="wm" aria-hidden="true">Ess<span class="wm-i"><span class="wm-dot"></span>ı</span>ght <span class="wm-notes">Notes</span></span></p>`;
}

function footer() {
  return `<footer class="site-footer">
<p>${escapeHtml(site.title)} · <a href="/feed.xml">订阅</a></p>
</footer>`;
}

/* Shared close for every article. The byline lives here, not under the title. */
function articleFooter() {
  return `<footer class="article-footer">
<div class="article-footer-inner">
<div class="article-footer-copy">
<p class="article-footer-kicker">ESSIGHT NOTES · 萃见札记</p>
<p class="article-footer-note">萃见智能（Essight）专注于生成式搜索（GEO）监测与数据分析。本文由 Essight Tech Team 撰写。</p>
</div>
</div>
</footer>`;
}

function chapterLink(id, num, label, current = false) {
  const currentAttr = current ? ' aria-current="true"' : "";
  return `<li><a href="#${id}"${currentAttr}><span class="rail-num" aria-hidden="true">${num}</span><span class="dot" aria-hidden="true"><span class="dot-fill"></span></span><span class="label">${label}</span></a></li>`;
}

function chainButton(stage, index, en, zh, pressed = false) {
  return `<li class="chain-step${pressed ? " is-active" : ""}" style="--k:${index}">
<button type="button" data-stage="${stage}" aria-pressed="${pressed ? "true" : "false"}" aria-controls="panel-${stage}">
<span class="chain-tick" aria-hidden="true"></span>
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

function metaHtml(post, minutes = 0) {
  const time = minutes
    ? `<span class="meta-sep" aria-hidden="true">·</span><span class="read-time">约 ${minutes} 分钟</span>`
    : "";
  return `<p class="post-meta"><time datetime="${post.date}">${post.date}</time>${time}</p>`;
}

function scopeHtml(scope) {
  if (!scope) return "";
  return `<p class="post-scope"><span class="scope-label">数据口径</span><span class="scope-text">${escapeHtml(scope)}</span></p>`;
}

function postList(posts) {
  if (!posts.length) {
    return `<p class="empty">暂无文章。</p>`;
  }
  const items = posts
    .map((post, index) => {
      const tagData = post.tags.map((tag) => escapeHtml(tag)).join("|");
      return `<li class="post" data-tags="${tagData}">
<article>
<span class="post-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
${emblemSvg(post.slug, "emblem-card")}
<div class="post-body">
${metaHtml(post, readingMinutes(post.html))}
<h3><a class="post-link" href="/posts/${post.slug}/" style="view-transition-name: post-${post.slug}">${escapeHtml(post.title)}</a></h3>
<p class="post-summary">${escapeHtml(post.summary)}</p>
${tagsHtml(post.tags)}
</div>
<span class="post-arrow" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg></span>
</article>
</li>`;
    })
    .join("\n");
  const allTags = [...new Set(posts.flatMap((post) => post.tags))];
  const filters =
    allTags.length > 1
      ? `<div class="filters" role="group" aria-label="按标签筛选" hidden>
<button type="button" aria-pressed="true" data-tag="">全部</button>
${allTags.map((tag) => `<button type="button" aria-pressed="false" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("\n")}
</div>`
      : "";
  return `${filters}
<ol class="post-list">
${items}
</ol>`;
}

const ACTS = [
  { id: "overture", label: "序幕" },
  { id: "signal", label: "信号场" },
  { id: "topology", label: "拓扑" },
  { id: "judgment", label: "判断" },
  { id: "interval", label: "区间" },
  { id: "chain", label: "证据链" },
  { id: "archive", label: "文章" },
];

function act({ id, index, hold, className = "", copy }) {
  const num = String(index).padStart(2, "0");
  return `<section class="act${className ? ` ${className}` : ""}" id="${id}" data-label="${ACTS[index].label}" data-scene="${index}" style="--hold:${hold}">
<div class="stage">
<p class="act-num" aria-hidden="true">${num}</p>
<div class="copy">
${copy}
</div>
</div>
</section>`;
}

/* Overlay labels for the canvas figures. Decorative: the copy carries the meaning. */
function figureLabels() {
  const set = (scene, words, extra = "") =>
    words.map((word, i) => `<span class="glabel${extra}" data-scene="${scene}" data-i="${i}">${word}</span>`).join("");
  return `<div class="glabels" aria-hidden="true">
${set(1, ["查询", "引用", "时间"], " glabel-plane")}
${set(2, ["意图", "措辞", "约束", "复述"], " glabel-cluster")}
${set(3, ["有效", "提及", "位次", "推荐", "情感"], " glabel-gate")}
${set(4, ["−2σ", "0", "+2σ"], " glabel-tick")}
<span class="glabel glabel-band" data-scene="4" data-i="band"><span class="band-fill"></span><span class="band-label">区间</span></span>
${set(5, ["观测", "判断", "完整日", "快照"], " glabel-node")}
</div>`;
}

export function renderHome(posts, assets) {
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
  const rail = ACTS.map((item, index) =>
    chapterLink(item.id, index < ACTS.length - 1 ? String(index).padStart(2, "0") : "→", item.label, index === 0),
  ).join("\n");
  return page({
    title: site.title,
    description: site.description,
    canonical: absoluteUrl("/"),
    jsonLd,
    shell: "exhibit",
    scripts: [assets.exhibit],
    assets,
    bodyAttrs: 'data-exhibit="home"',
    skipHref: "#archive-heading",
    skipLabel: "跳到文章",
    body: `<canvas id="field" class="field" width="2" height="2" aria-hidden="true"></canvas>
${figureLabels()}
<div class="lens" aria-hidden="true"></div>
<div class="portal-rim" aria-hidden="true"></div>
<div class="progress" aria-hidden="true"></div>
<header class="hud">
<a class="hud-brand" href="/">${mark()}<span>${escapeHtml(site.name)}</span></a>
<p class="hud-count" aria-hidden="true"><span class="hud-now">00</span><span class="hud-total">/ 05</span><span class="hud-label">序幕</span></p>
</header>
<nav class="rail" aria-label="章节">
<ol>
${rail}
</ol>
<p class="rail-live sr-only" aria-live="polite"></p>
</nav>
<main id="main">
${act({
  id: "overture",
  index: 0,
  hold: 70,
  className: "act-overture",
  copy: `<p class="kicker">${mark()}<span>${escapeHtml(site.tagline)}</span></p>
<h1>${split(site.name)}</h1>
${wordmark()}
<p class="deck">生成式检索里的可见性，应当能被观察、被判断，并留在可以回放的证据链上。</p>`,
})}
${act({
  id: "signal",
  index: 1,
  hold: 110,
  copy: `<p class="kicker">01 — 信号场</p>
<h2>${split("多平台检索不在同一个坐标系里")}</h2>
<p class="body">查询、引用与时间落在不同的面上，不能加成一个总分。</p>`,
})}
${act({
  id: "topology",
  index: 2,
  hold: 110,
  copy: `<p class="kicker">02 — 提示词空间</p>
<h2>${split("近与远，都要被观察")}</h2>
<p class="body">同一意图会落在相邻的措辞里，也会被约束推远。不能凭一次回答认定它们的距离。</p>`,
})}
${act({
  id: "judgment",
  index: 3,
  hold: 130,
  copy: `<p class="kicker">03 — 逐项判断</p>
<h2>${split("每一项判断，都指回原文")}</h2>
<p class="body">有效、提及、位次、推荐、情感，逐项判断，逐项留下依据。</p>`,
})}
${act({
  id: "interval",
  index: 4,
  hold: 150,
  copy: `<p class="kicker">04 — 分布与区间</p>
<h2>${split("没有区间的判断，先不要进入证据链")}</h2>
<p class="body">带还宽的时候，判断保持开放。</p>`,
})}
${act({
  id: "chain",
  index: 5,
  hold: 230,
  className: "act-chain",
  copy: `<p class="kicker">05 — 证据链</p>
<h2>${split("从观测到完整日，再与快照对照")}</h2>
<div class="chain" style="--stage: 0">
<ol class="chain-nodes">
${chainButton("observation", 0, "Observation", "观测", true)}
${chainButton("judgment", 1, "Judgment", "判断")}
${chainButton("l1", 2, "完整日 L1", "一日的第一层")}
${chainButton("snapshot", 3, "Snapshot", "快照")}
</ol>
<div class="chain-panels">
${chainPanel("observation", "记录检索面上的信号，不宣布结论。")}
${chainPanel("judgment", "判断必须能指回观测。")}
${chainPanel("l1", "以一个完整自然日汇总，不先压成一个分数。")}
${chainPanel("snapshot", "某一时刻的截面，与完整日对照。")}
</div>
</div>`,
})}
<section class="archive" id="archive" data-label="文章" data-scene="6">
<div class="portal" aria-hidden="true"></div>
<div class="archive-inner">
<p class="kicker kicker-ink">${mark()}<span>${escapeHtml(site.name)}</span></p>
<h2 id="archive-heading" tabindex="-1">文章</h2>
${postList(posts)}
${footer()}
</div>
</section>
</main>`,
  });
}

function tocHtml(entries) {
  if (entries.length < 2) return "";
  const items = entries
    .map((item) => `<li class="toc-l${item.level}"><a href="#${escapeHtml(item.id)}">${item.text}</a></li>`)
    .join("\n");
  return `<nav class="toc" aria-labelledby="toc-heading">
<details open>
<summary id="toc-heading">目录</summary>
<ol>
${items}
</ol>
</details>
</nav>`;
}

function pagerHtml(newer, older) {
  if (!newer && !older) return "";
  const link = (post, rel, label) =>
    post
      ? `<a class="pager-${rel}" href="/posts/${post.slug}/" rel="${rel}"><span class="pager-label">${label}</span><span class="pager-title">${escapeHtml(post.title)}</span></a>`
      : `<span class="pager-${rel} pager-empty" aria-hidden="true"></span>`;
  return `<nav class="pager" aria-label="相邻文章">
${link(older, "prev", "较早")}
${link(newer, "next", "较新")}
</nav>`;
}

export function renderArticle(post, { newer = null, older = null } = {}, assets) {
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
  const toc = tocHtml(extractToc(post.html));
  return page({
    title: `${post.title} · ${site.title}`,
    description: post.summary,
    canonical,
    jsonLd,
    assets,
    body: `<div class="read-progress" aria-hidden="true"></div>
<header class="masthead">
<a class="brand" href="/">${mark()}<span class="brand-zh">${escapeHtml(site.name)}</span><span class="brand-en">${escapeHtml(site.nameEn)}</span></a>
<a class="back" href="/#archive-heading">全部文章</a>
</header>
<main id="main" class="article-main${toc ? " has-toc" : ""}">
<article class="article">
<header class="article-head">
${emblemSvg(post.slug, "emblem-hero")}
<h1 class="article-title" style="view-transition-name: post-${post.slug}">${escapeHtml(post.title)}</h1>
<p class="article-summary">${escapeHtml(post.summary)}</p>
${metaHtml(post)}
${scopeHtml(post.scope)}
${tagsHtml(post.tags)}
</header>
${toc}
<div class="prose">
${post.html}
</div>
<p class="end-mark" aria-hidden="true"><span></span></p>
${referenceHtml(post.references)}
</article>
${pagerHtml(newer, older)}
</main>
${articleFooter()}`,
  });
}

export function renderNotFound(assets) {
  return page({
    title: `未找到页面 · ${site.title}`,
    description: "未找到该页面。",
    canonical: absoluteUrl("/"),
    robots: "noindex",
    shell: "exhibit",
    scripts: [assets.exhibit],
    assets,
    bodyAttrs: 'data-exhibit="lost"',
    skipHref: "#lost-title",
    skipLabel: "跳到标题",
    body: `<canvas id="field" class="field" width="2" height="2" aria-hidden="true"></canvas>
<div class="lens" aria-hidden="true"></div>
<header class="hud">
<a class="hud-brand" href="/">${mark()}<span>${escapeHtml(site.name)}</span></a>
</header>
<main id="main" class="lost">
<p class="kicker">${mark()}<span>${escapeHtml(site.name)}</span></p>
${wordmark("wordmark lost-en")}
<h1 id="lost-title" tabindex="-1">${split("未找到该页面")}</h1>
<p class="cue"><a class="return" href="/"><span>返回首页</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg></a></p>
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
