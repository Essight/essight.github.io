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
<p>${escapeHtml(site.title)}</p>
<p><a href="${escapeHtml(site.repoUrl)}" rel="noreferrer">文稿仓库</a> · <a href="/feed.xml">订阅</a></p>
</footer>`;
}

function articleHeader() {
  return `<header class="masthead">
<a class="brand" href="/">${mark()}${escapeHtml(site.name)}</a>
<span class="brand-sep" aria-hidden="true">·</span>
<a class="brand-column" href="/">${escapeHtml(site.column)}</a>
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
    return `<p class="empty">暂无已发布文章。审核通过并合并到 <code>main</code> 的文章会列在这里。</p>`;
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
<p class="kicker">${mark()}Essight</p>
<h1><span class="title-en">GEO</span>数据科学专栏</h1>
<p class="deck">生成式检索里的可见性，应当能被观察、被判断，并留在可以回放的证据链上。</p>
<p class="disclaimer">这一页的图形是方法的形状，由固定规则绘成。<br>它不是测量结果，没有客户、样本或业务数字。</p>
<p class="cue"><span class="cue-line" aria-hidden="true"></span>向下滚动，或按方向键换幕</p>
</div>
</section>
<section class="chapter" id="signal" data-label="信号场">
<div class="chapter-copy">
<p class="kicker">01 — 信号场</p>
<h2>多平台检索不在同一个坐标系里</h2>
<p>查询、引用与时间落在不同的面上。专栏把这些面看成可叠加的场，而不是一个可以相加的总分。</p>
<ul class="pills"><li>查询</li><li>引用</li><li>时间</li></ul>
<p class="note">环与点的运动是示意，用来记住三种信号要分开看。</p>
</div>
</section>
<section class="chapter" id="topology" data-label="拓扑">
<div class="chapter-copy">
<p class="kicker">02 — 提示词空间</p>
<h2>近与远，都要被观察</h2>
<p>同一意图会落在相邻的措辞里，也会被约束推远。不能凭一次回答认定它们的距离。</p>
<p class="note">点来自固定种子的四个概念团：意图、措辞、约束、复述。这不是任何模型的嵌入投影。</p>
</div>
</section>
<section class="chapter" id="interval" data-label="区间">
<div class="chapter-copy">
<p class="kicker">03 — 分布与区间</p>
<h2>没有区间的判断，先不要进入证据链</h2>
<p>色带表示区间。带还宽的时候，判断保持开放。横轴是标准差，纵轴是密度。</p>
<p class="note">没有样本，也没有百分比。这是方法图示。</p>
</div>
</section>
<section class="chapter" id="chain" data-label="证据链">
<div class="chapter-copy chain-copy-wrap">
<p class="kicker">04 — 证据链</p>
<h2>从观测到完整日，再与快照对照</h2>
<p>流向表示方法：Observation → Judgment → 完整日 L1 / Snapshot。不是一次实验的结果。</p>
<div class="chain" style="--stage: 0">
<div class="chain-beam" aria-hidden="true"></div>
<ol class="chain-nodes">
${chainButton("observation", "Observation", "观测", true)}
${chainButton("judgment", "Judgment", "判断")}
${chainButton("l1", "完整日 L1", "一日的第一层")}
${chainButton("snapshot", "Snapshot", "快照")}
</ol>
<div class="chain-panels">
${chainPanel("observation", "记录检索面上未经汇总的信号：查询如何被提出、回答里出现了什么、引用指向哪里、发生在哪一刻。这一步只保存观察，不宣布结论。")}
${chainPanel("judgment", "把多次观察收成一句可以复核的话：信号是否重复出现，是否跨检索面一致，区间是否还宽到不能下结论。判断必须能指回观测。")}
${chainPanel("l1", "以一个完整自然日为粒度做第一层汇总，保留来源与时间，而不是先压成一个分数。日与日可以对照。这里不展示任何一日的实测。")}
${chainPanel("snapshot", "某一个时刻的截面。它与完整日并置：瞬时状态和日尺度不一致时，证据链停在对照，不把快照当成全日结论。")}
</div>
</div>
</div>
</section>
<section class="chapter chapter-paper" id="archive" data-label="文章">
<div class="archive-inner">
<p class="kicker kicker-ink">${mark()}专栏</p>
<h2 id="archive-heading">文章</h2>
<p class="archive-lead">审核通过的文稿，经 Pull Request 合并到 <code>main</code>，由 GitHub Actions 构建后出现在这张列表里。</p>
<ol class="steps">
<li><span>01</span>审核通过</li>
<li><span>02</span>合并 main</li>
<li><span>03</span>自动发布</li>
</ol>
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
    : { "@type": "Organization", name: site.name };
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
    publisher: { "@type": "Organization", name: site.name },
  };
  return page({
    title: `${post.title} · ${site.name}`,
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
    title: `未找到页面 · ${site.name}`,
    description: "这个地址没有对应的文章或页面。",
    canonical: absoluteUrl("/"),
    robots: "noindex",
    shell: "exhibit",
    scripts: ["/assets/exhibit.js"],
    theme: "#090b0e",
    scheme: "dark",
    bodyAttrs: 'data-exhibit="lost"',
    skipHref: "#lost-title",
    skipLabel: "跳到说明",
    body: `<canvas id="field" class="field" width="2" height="2" aria-hidden="true"></canvas>
<main id="main" class="lost">
<p class="kicker">${mark()}Essight</p>
<h1 id="lost-title">未找到该页面</h1>
<p class="deck">这个地址没有对应的文章或页面。</p>
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
