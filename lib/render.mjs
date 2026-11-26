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

function page({ title, description, canonical, robots = "index,follow", jsonLd, body }) {
  const structuredData = jsonLd ? jsonForScript(jsonLd) : "";
  const scriptSrc = structuredData
    ? `'sha256-${createHash("sha256").update(structuredData).digest("base64")}'`
    : "'none'";
  const structured = structuredData ? `<script type="application/ld+json">${structuredData}</script>` : "";
  return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${robots}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#f6f3ec">
<meta name="color-scheme" content="light">
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
<body>
<a class="skip" href="#main">跳到正文</a>
<div class="wrap">
${body}
</div>
</body>
</html>
`;
}

function footer() {
  return `<footer class="site-footer">
<p>${escapeHtml(site.title)}</p>
<p><a href="${escapeHtml(site.repoUrl)}" rel="noreferrer">文稿仓库</a> · <a href="/feed.xml">订阅</a></p>
</footer>`;
}

function homeHeader() {
  return `<header class="masthead">
<a class="brand" href="/">${escapeHtml(site.name)}</a>
</header>`;
}

function articleHeader() {
  return `<header class="masthead">
<a class="brand" href="/">${escapeHtml(site.name)}</a>
<span class="brand-sep" aria-hidden="true">·</span>
<a class="brand-column" href="/">${escapeHtml(site.column)}</a>
</header>`;
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
    body: `${homeHeader()}
<main id="main">
<h1>${escapeHtml(site.column)}</h1>
<p class="lede">${escapeHtml(site.description)}</p>
<section class="archive" aria-labelledby="archive-heading">
<h2 id="archive-heading">文章</h2>
${postList(posts)}
</section>
</main>
${footer()}`,
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
    body: `${articleHeader()}
<main id="main">
<h1>未找到该页面</h1>
<p class="lede">这个地址没有对应的文章或页面。</p>
<p class="back"><a href="/">返回首页</a></p>
</main>
${footer()}`,
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
