import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSite } from "../lib/build-site.mjs";
import { emblemSvg } from "../lib/emblem.mjs";
import { renderMarkdown } from "../lib/markdown.mjs";
import { extractToc, readingMinutes } from "../lib/reading.mjs";

const root = path.resolve(import.meta.dirname, "..");
let failed = 0;

function check(condition, message) {
  if (condition) {
    console.log(`通过：${message}`);
    return;
  }
  failed += 1;
  console.error(`失败：${message}`);
}

function readArticleJsonLd(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)];
  if (blocks.length !== 1) return { error: `结构化数据脚本数量为 ${blocks.length}` };
  try {
    return { data: JSON.parse(blocks[0][1]) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function expectThrow(fn, pattern, message) {
  try {
    fn();
    check(false, `${message}（没有抛出错误）`);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    const shown = text.length > 240 ? `${text.slice(0, 240)}…` : text;
    check(pattern.test(text), `${message}（${shown}）`);
  }
}

function writePost(dir, name, content) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), content);
}

function buildFixture(postsDir, outDir) {
  return buildSite({
    root,
    postsDir,
    outDir,
    publicDir: path.join(root, "public"),
  });
}

const real = buildSite({ root });
const index = fs.readFileSync(path.join(real.outDir, "index.html"), "utf8");
const notFound = fs.readFileSync(path.join(real.outDir, "404.html"), "utf8");
const sitemap = fs.readFileSync(path.join(real.outDir, "sitemap.xml"), "utf8");
const feed = fs.readFileSync(path.join(real.outDir, "feed.xml"), "utf8");
const robots = fs.readFileSync(path.join(real.outDir, "robots.txt"), "utf8");
const cssHref = index.match(/href="(\/assets\/site\.[0-9a-f]{8}\.css)"/)?.[1] ?? "";
const exhibitHref = index.match(/src="(\/assets\/exhibit\.[0-9a-f]{8}\.js)"/)?.[1] ?? "";
const css = cssHref ? fs.readFileSync(path.join(real.outDir, cssHref.slice(1)), "utf8") : "";
const katexCss = fs.readFileSync(path.join(real.outDir, "assets", "katex", "katex.min.css"), "utf8");

check(real.posts === 1, "正式构建包含一篇文章");
check(index.includes("萃见札记"), "首页有中文名称");
check(index.includes("Essight Notes"), "首页有英文名称");
check(!index.includes("数据科学专栏"), "首页不再使用旧栏目名");
check(!notFound.includes("数据科学专栏"), "404 不再使用旧栏目名");
check(feed.includes("萃见札记 · Essight Notes"), "订阅源使用正式名称");
check(!index.includes("暂无文章。"), "有文章时不显示空状态");
check(!index.includes("暂无已发布文章"), "空状态不再解释发布条件");
check(index.includes("高提及率的盲区：从一组 95%+ 的 GEO 监测样本说起"), "首页文章幕露出标题");
check(index.includes('href="/posts/high-mention-rate-blind-spot/"'), "首页文章链接是站点根路径");
check(!index.includes('class="article-footer"'), "首页不用文章页脚");
check(!index.includes("本文由"), "首页不出现文章落款");
check(!index.includes("文稿仓库"), "页面没有文稿仓库入口");
check(!index.includes("github.com/Essight/essight.github.io"), "首页不链向文稿仓库");
check(!index.includes("GitHub Actions"), "首页不提自动构建");
check(!index.includes("Pull Request"), "首页不提 Pull Request");
check(!index.includes("审核"), "首页不提审核流程");
check(!index.includes("不是测量结果"), "序幕不再声明图形不是测量结果");
check(!index.includes("由固定规则绘成"), "序幕不再解释绘图规则");
check(!index.includes("向下滚动"), "序幕不再提示如何换幕");
check(!index.includes("不是任何模型"), "拓扑不再自证不是嵌入");
check(!index.includes("没有样本"), "区间不再声明没有样本");
check(!index.includes("不是一次实验的结果"), "证据链不再声明不是实验结果");
check(index.includes("应当能被观察、被判断"), "序幕保留主副句");
check(index.includes('href="/feed.xml">订阅</a>'), "页脚保留订阅");
check(!notFound.includes("文稿仓库"), "404 没有文稿仓库入口");
check(!notFound.includes("这个地址没有对应的文章或页面"), "404 不再重复说明");
check(notFound.includes('data-exhibit="lost"'), "404 使用失落一幕");
check(index.includes('id="chain"'), "首页有证据链一幕");
for (const id of ["overture", "signal", "topology", "judgment", "interval", "chain", "archive"]) {
  check(index.includes(`id="${id}"`), `首页有 ${id} 一幕`);
}
check(index.includes('<span class="sr-only">近与远，都要被观察</span>'), "逐字动画的标题保留完整文本给读屏");
check(index.includes('class="split" aria-hidden="true"'), "逐字拆分的标题对读屏隐藏");
check(!/<span class="ch"[^>]*>[，。、]/.test(index), "标点不会单独成为一行的行首");
check(index.includes("GEO · 数据科学 · 实践"), "序幕写明栏目方向");
check(index.includes('class="wm-dot"'), "英文名保留品牌金点");

const csp = index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
const bootScripts = [...index.matchAll(/<script>([^<]*)<\/script>/g)].map((match) => match[1]);
check(bootScripts.length === 1, "首页只有一段内联启动脚本");
check(
  bootScripts.every((code) => csp.includes(`'sha256-${createHash("sha256").update(code).digest("base64")}'`)),
  "内联启动脚本的哈希写入了脚本策略",
);
check(csp.includes("script-src 'self' 'sha256-") && !/script-src[^;]*unsafe-inline/.test(csp), "脚本策略不放开 unsafe-inline");
check(!csp.includes("frame-ancestors"), "meta 中不写会被忽略的 frame-ancestors");
check(index.includes("Observation"), "证据链保留 Observation");
check(index.includes("完整日 L1"), "证据链保留完整日 L1");
check(index.includes("Snapshot"), "证据链保留 Snapshot");
check(index.includes("/posts/high-mention-rate-blind-spot/"), "首页链到正式文章");
check(Boolean(exhibitHref) && fs.existsSync(path.join(real.outDir, exhibitHref.slice(1))), "首页使用带内容指纹的站内脚本");
check(index.includes("script-src 'self'"), "首页脚本策略允许同源脚本");
const exhibit = exhibitHref ? fs.readFileSync(path.join(real.outDir, exhibitHref.slice(1)), "utf8") : "";
check(!/https?:\/\//.test(exhibit), "首页脚本不引用外部地址");
check(exhibit.includes("prefers-reduced-motion"), "首页脚本尊重减少动态效果");
check(exhibit.includes('getContext("webgl2"'), "首页脚本使用 WebGL2 绘制");
check(exhibit.includes("no-gl"), "没有 WebGL2 时保留静态背景");
check(exhibit.includes("window.__essight"), "首页脚本向启动脚本报到");
check(!/\beval\(|new Function\(/.test(exhibit), "首页脚本不动态执行代码");
check(css.includes("@view-transition"), "页面之间有视图过渡");
check(css.includes("animation-timeline: scroll(root block)"), "文章阅读进度只用 CSS");
check(css.includes("prefers-reduced-motion"), "样式尊重减少动态效果");
check(notFound.includes(`src="${exhibitHref}"`), "404 使用同一套站内脚本");
check(Boolean(cssHref) && css.includes(".compare-fill"), "首页引用带内容指纹且包含对照图的样式");
check(!index.includes('href="/assets/site.css"'), "首页不引用会命中旧缓存的样式地址");
check(index.includes('href="/assets/katex/katex.min.css"'), "首页引用 KaTeX 样式");
check(index.includes('lang="zh-CN"'), "页面语言为简体中文");
check(notFound.includes("未找到该页面"), "404 页面存在");
check(notFound.includes('content="noindex"'), "404 不被索引");
check(sitemap.includes("<loc>https://essight.github.io/</loc>"), "站点地图包含首页");
check(sitemap.includes("https://essight.github.io/posts/high-mention-rate-blind-spot/"), "站点地图包含文章");
check(feed.includes("<item>"), "订阅源包含文章");
check(feed.includes("高提及率的盲区：从一组 95%+ 的 GEO 监测样本说起"), "订阅源使用文章标题");

const published = fs.readFileSync(
  path.join(real.outDir, "posts", "high-mention-rate-blind-spot", "index.html"),
  "utf8",
);
const publishedHead = published.slice(published.indexOf('class="article-head"'), published.indexOf('class="prose"'));
check(published.includes('href="https://essight.github.io/posts/high-mention-rate-blind-spot/"'), "文章规范地址在 Pages 根路径下");
check(published.includes(`href="${cssHref}"`), "文章页样式是站点根路径上的指纹文件");
check(!published.includes('href="/assets/site.css"'), "文章页不引用会命中旧缓存的样式地址");
check(publishedHead.includes('<time datetime="2026-11-27">2026-11-27</time>'), "文章顶部是发布日期");
check(publishedHead.includes("品牌 A（匿名）· 两个完整七日窗 · 6 平台等权 · 每窗 294 条有效样本"), "文章顶部有数据口径");
check(!publishedHead.includes("Essight Tech Team"), "文章顶部不重复作者");
check(!publishedHead.includes("萃见札记"), "文章顶部不重复专栏名");
check(!publishedHead.includes("Essight Notes"), "文章顶部不重复英文专栏名");
check(!publishedHead.includes("约 "), "文章顶部不放阅读时长");
{
  let cursor = publishedHead.indexOf('class="tags"');
  for (const tag of ["GEO", "指标设计", "AI 搜索评测", "实证分析"]) {
    const at = publishedHead.indexOf(`>${tag}</li>`, cursor);
    check(at > cursor, `文章标签顺序包含 ${tag}`);
    cursor = at;
  }
}
{
  const articleDir = path.join(real.outDir, "posts");
  const articleSlugs = fs
    .readdirSync(articleDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  check(articleSlugs.length === real.posts && articleSlugs.length > 0, "每篇文章都生成了页面");
  const expectedAuthor = JSON.stringify({ "@type": "Organization", name: "Essight Tech Team" });
  for (const slug of articleSlugs) {
    const html = fs.readFileSync(path.join(articleDir, slug, "index.html"), "utf8");
    const parsed = readArticleJsonLd(html);
    check(!parsed.error, `${slug} 的 application/ld+json 是合法 JSON${parsed.error ? `（${parsed.error}）` : ""}`);
    check(
      JSON.stringify(parsed.data?.author) === expectedAuthor,
      `${slug} 的 author 为 {"@type":"Organization","name":"Essight Tech Team"}`,
    );
  }
}
for (const piece of [
  "97.96%",
  "95.92%",
  "-2.04 pp",
  "26.53%",
  "29.25%",
  "+2.72 pp",
  "28.28%",
  "37.97%",
  "+9.69 pp",
  "17.51%",
  "17.40%",
  "-0.11 pp",
  "91.84%",
  "77.55%",
  "+24.06 个百分点",
  "+12.24 个百分点",
  "12.24 个百分点",
  "5.63 到 5.53",
  "83.3%",
  "90.5%",
  "38 至 49 条",
  "39.6",
  "20.8",
  "32.7",
  "40.8",
  "22.4",
  "13.3",
  "45.8",
  "44.9",
  "20.4",
  "53.1",
  "34.7",
  "28.9",
  "98.0",
  "100.0",
  "91.8",
  "77.6",
]) {
  check(published.includes(piece), `保留审定数字 ${piece}`);
}
{
  const chartAt = published.indexOf('class="compare"');
  const chart = published.slice(chartAt, chartAt + 12000);
  let last = -1;
  for (const name of ["豆包", "Kimi", "DeepSeek", "千问", "元宝", "文心一言"]) {
    const at = chart.indexOf(name);
    check(at > last, `对照图平台顺序包含 ${name}`);
    last = at;
  }
}
check(published.includes('id="compare-1-err" checked'), "对照图默认展示 ERR");
check(!published.includes('id="compare-1-mr" checked'), "提及率不是默认项");
check(published.includes("各平台首选推荐率（ERR）前窗与主窗对照。Kimi、千问与元宝拉升明显，DeepSeek 同期反向回落。"), "保留 ERR 图注");
check(published.includes("各平台提及率（MR）前窗与主窗对照。其余五平台几乎满格，整窗 MR 下降几乎全部来自文心一言。"), "保留 MR 图注");
check(published.includes("ESSIGHT NOTES · 萃见札记"), "文章页脚有眉标");
check(
  published.includes("萃见智能（Essight）专注于生成式搜索（GEO）监测与数据分析。本文由 Essight Tech Team 撰写。"),
  "文章页脚有统一署名",
);
check(published.includes('class="article-footer"'), "文章页使用文末署名");
check(published.indexOf('class="article-footer"') < published.indexOf('class="site-footer"'), "文末署名在站点页脚之前");
check(published.includes('class="site-footer"'), "文章页保留站点页脚");
check(published.includes('href="/feed.xml">订阅</a>'), "文章页站点页脚保留订阅");
check(!published.includes("emblem-hero"), "文章页标题区没有装饰图形");
check(!published.includes("文稿仓库"), "文章页没有文稿仓库入口");
check(!published.includes("github.com/Essight"), "文章页不链向文稿仓库");
check(!published.includes("GitHub Actions"), "文章页不提自动构建");
check(!published.includes("Pull Request"), "文章页不提 Pull Request");
check(!/<\s*script(?![^>]*type="application\/ld\+json")/i.test(published), "文章页没有可执行脚本");
check(published.includes("https://doi.org/10.1037/h0040957"), "参考文献保留 DOI");
check(robots.includes("Sitemap: https://essight.github.io/sitemap.xml"), "robots 指向站点地图");
check(css.includes(".table-wrap"), "样式包含表格容器");
check(fs.existsSync(path.join(real.outDir, "assets", "favicon.svg")), "图标已输出");
check(fs.existsSync(path.join(real.outDir, ".nojekyll")), "输出包含 .nojekyll");

const fontMatch = katexCss.match(/url\(fonts\/([^)]+\.woff2)\)/);
check(Boolean(fontMatch), "KaTeX 样式引用 woff2 字体");
if (fontMatch) {
  check(
    fs.existsSync(path.join(real.outDir, "assets", "katex", "fonts", fontMatch[1])),
    "KaTeX 字体文件已复制",
  );
}
check(!katexCss.includes('format("truetype")'), "KaTeX 样式不再请求 ttf");

const inline = renderMarkdown("拟合优度 $R^2$ 与估计量 $\\beta$。");
check(inline.includes('class="katex"'), "行内公式渲染为 KaTeX");
check(inline.includes("拟合优度"), "行内公式保留中文");

const currency = renderMarkdown("费用为 $5 到 $10 美元。");
check(!currency.includes("katex"), "金额区间不当作公式");
check(currency.includes("$5"), "金额文本保留");

const display = renderMarkdown("$$\n\\\\hat{\\\\beta}=(X^{\\\\top}X)^{-1}X^{\\\\top}y\n$$\n");
check(display.includes("katex-display"), "块级公式使用 display 模式");

const paren = renderMarkdown("其中 \\(x\\) 为自变量。");
check(paren.includes('class="katex"'), "\\( \\) 行内公式可用");

const table = renderMarkdown("| 项 | 值 |\n| --- | ---: |\n| a | 1 |\n");
check(table.includes('<div class="table-wrap"><table>'), "表格包在可横向滚动的容器里");
check(table.includes('align="right"'), "表格保留右对齐");
check(table.includes("<td"), "表格包含单元格");

const code = renderMarkdown("```python\nimport math\n```\n");
check(code.includes("hljs-keyword"), "代码块按语言高亮");
check(code.includes("language-python"), "代码块标记语言");
check(code.includes("code-lang"), "代码块显示语言名");

const raw = renderMarkdown("<script>alert(1)</script>\n");
check(raw.includes("&lt;script&gt;"), "原始 HTML 被转义");
check(!/<\s*script\b/i.test(raw), "原始 HTML 不会变成脚本标签");

expectThrow(
  () => renderMarkdown("$$\n\\notacommand{x}\n$$\n"),
  /公式无法解析/,
  "非法公式会使渲染失败",
);

expectThrow(
  () => renderMarkdown("[链接](javascript:alert(1))\n"),
  /不允许的链接地址/,
  "拒绝 javascript 链接",
);

expectThrow(
  () => renderMarkdown("[^bad\"><]: 注入\n\n见脚注[^bad\"><]。\n"),
  /脚注标记/,
  "拒绝不安全的脚注标记",
);

const chart = renderMarkdown(`\`\`\`compare
categories:
  - 甲
  - 乙
windows:
  - 前窗
  - 主窗
default: mr
series:
  - id: err
    label: 首选推荐率 ERR
    caption: ERR 图注。
    values:
      - ["10.0", "20.0"]
      - ["30.0", "40.0"]
  - id: mr
    label: 提及率 MR
    caption: MR 图注。
    values:
      - ["98.0", "100.0"]
      - ["98.0", "77.6"]
\`\`\`
`);
check(chart.includes(">98.0<"), "对照图保留末尾的 0");
check(chart.includes(">100.0<"), "对照图保留 100.0");
check(chart.includes('type="radio"'), "对照图用单选切换");
check(chart.includes('id="compare-1-mr" checked'), "对照图尊重 default");
check(!chart.includes('id="compare-1-err" checked'), "未选中的指标没有 checked");
check(!/<\s*script\b/i.test(chart), "对照图没有脚本");

expectThrow(
  () => renderMarkdown("```compare\ncategories:\n  - 甲\n"),
  /对照图：代码块没有结束/,
  "拒绝没有结束的对照图",
);

expectThrow(
  () =>
    renderMarkdown(`\`\`\`compare
categories:
  - 甲
windows:
  - 前
  - 后
series:
  - id: a
    label: A
    caption: 注
    values:
      - ["10"]
      - ["150"]
\`\`\`
`),
  /超出刻度/,
  "拒绝超出刻度的对照图数值",
);

const footnote = renderMarkdown("正文脚注[^note]。\n\n[^note]: 脚注内容。\n");
check(footnote.includes("footnotes"), "脚注生成列表");
check(footnote.includes("脚注内容"), "脚注保留正文");
check(footnote.includes(">脚注</h2>") || footnote.includes(">脚注<"), "脚注标题为中文");

const emblemA = emblemSvg("alpha-post");
check(emblemA === emblemSvg("alpha-post"), "同一 slug 的生成图形保持一致");
check(emblemA !== emblemSvg("beta-post"), "不同 slug 的生成图形不同");
check(!/<script|on[a-z]+=/i.test(emblemA), "生成图形是纯 SVG");

check(readingMinutes("<p>" + "字".repeat(2100) + "</p>") === 5, "阅读时长按中文字数估算");
check(readingMinutes("<p>短</p>") === 1, "阅读时长至少一分钟");
const toc = extractToc(renderMarkdown("# 甲\n\n## 乙\n\n### 丙\n\n# 丁\n"));
check(toc.length === 3 && toc[1].level === 2, "目录取最高两级标题");

const first = renderMarkdown("# 第一节\n\n## 第一节\n");
const ids = [...first.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
check(ids.length === 2 && ids[0] !== ids[1], "重复标题的锚点互不冲突");
check(first.includes("<h2"), "正文一级标题降为 h2");
check(!first.includes("<h1"), "正文不再产生 h1");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "essight-site-"));
try {
  const postsDir = path.join(tmp, "posts");
  const outDir = path.join(tmp, "dist");
  writePost(
    postsDir,
    "format-check.md",
    `---
title: 格式自检
date: 2026-01-15
slug: format-check
summary: 确认表格、代码、公式与参考文献能生成页面。
tags:
  - 自检
author: 构建脚本
references:
  - title: KaTeX
    authors: KaTeX Authors
    year: "2024"
    url: https://katex.org/
    note: 公式渲染
---

中文句子里的 $R^2$。

# 第一节

## 小节

$$
\\hat{\\beta} = (X^{\\top} X)^{-1} X^{\\top} y
$$

| 项 | 值 |
| --- | ---: |
| a | 1 |

\`\`\`python
import math
\`\`\`

见说明[^note]。

<script>alert(1)</script>

[^note]: 脚注内容。
`,
  );
  writePost(
    postsDir,
    "sort-check.md",
    `---
title: 排序自检
date: 2020-01-01
slug: sort-check
summary: 较早的一篇，用于确认首页按日期倒序。
tags:
  - 排序
---

只有一段正文，没有脚注。
`,
  );

  const built = buildFixture(postsDir, outDir);
  check(built.posts === 2, "临时目录可以构建两篇自检文稿");
  const home = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
  const article = fs.readFileSync(path.join(outDir, "posts", "format-check", "index.html"), "utf8");
  const other = fs.readFileSync(path.join(outDir, "posts", "sort-check", "index.html"), "utf8");
  const formatAt = home.indexOf("/posts/format-check/");
  const sortAt = home.indexOf("/posts/sort-check/");
  check(formatAt !== -1 && sortAt !== -1 && formatAt < sortAt, "首页按日期倒序排列");
  check(article.includes("katex-display"), "文章页包含块级公式");
  check(article.includes("table-wrap"), "文章页包含表格");
  check(article.includes("hljs-keyword"), "文章页包含高亮代码");
  check(article.includes("参考文献"), "文章页包含参考文献");
  check(article.includes("https://katex.org/"), "参考文献保留链接");
  const formatHead = article.slice(article.indexOf('class="article-head"'), article.indexOf('class="prose"'));
  check(formatHead.includes("2026-01-15"), "文章顶部有发布日期");
  check(!formatHead.includes("构建脚本"), "文章顶部不重复作者");
  check(!formatHead.includes("萃见札记"), "文章顶部不重复专栏名");
  check(!formatHead.includes("数据口径"), "没有口径时不显示数据口径");
  {
    const parsed = readArticleJsonLd(article);
    check(!parsed.error, `自检文章的 application/ld+json 是合法 JSON${parsed.error ? `（${parsed.error}）` : ""}`);
    check(
      JSON.stringify(parsed.data?.author) === JSON.stringify({ "@type": "Organization", name: "构建脚本" }),
      "自检文章的 author 类型为 Organization，并保留 frontmatter 署名",
    );
  }
  check(home.includes('class="meta-sep"'), "列表日期与阅读时长之间有间隔号");
  check(article.includes(">自检</li>"), "文章页显示标签");
  check(article.includes("&lt;script&gt;"), "文章页转义原始 HTML");
  check(!/<\s*script(?![^>]*type="application\/ld\+json")/i.test(article), "文章页没有可执行脚本");
  check(!other.includes("脚注内容"), "另一篇文章不会串入脚注");
  check(article.includes(`href="${cssHref}"`), "文章页使用根路径样式");
  check(!article.includes("exhibit.js"), "文章页不加载展示脚本");
  check(!article.includes("文稿仓库"), "文章页没有文稿仓库入口");
  check(article.includes('class="article-footer"'), "文章页使用统一文末署名");
  check(article.includes("ESSIGHT NOTES · 萃见札记"), "文章页脚眉标对每篇都生成");
  check(
    article.includes("萃见智能（Essight）专注于生成式搜索（GEO）监测与数据分析。本文由 Essight Tech Team 撰写。"),
    "文章页脚署名为模板固定文案",
  );
  check(article.includes('class="site-footer"'), "文章页保留站点页脚");
  check(article.includes('href="/feed.xml">订阅</a>'), "文章页站点页脚保留订阅");
  check(!article.includes("emblem-hero"), "文章页标题区没有装饰图形");
  check(home.includes('href="/feed.xml">订阅</a>'), "首页页脚保留订阅");
  check(!home.includes('class="article-footer"'), "首页列表页不用文章页脚");
  check(!home.includes("本文由"), "首页不出现文章落款");
  check(article.includes('class="toc"') && article.includes('href="#第一节"'), "文章页有目录");
  check(!other.includes('class="toc"'), "没有小节的文章不生成目录");
  check(home.includes("约 1 分钟"), "列表显示阅读时长");
  check(!formatHead.includes("约 1 分钟"), "文章顶部不放阅读时长");
  check(home.includes("emblem emblem-card"), "列表保留生成图形");
  check(article.includes('rel="prev"') && article.includes("/posts/sort-check/"), "较新的文章指向较早的一篇");
  check(other.includes('rel="next"') && other.includes("/posts/format-check/"), "较早的文章指向较新的一篇");
  check(article.includes('content="light dark"'), "文章页跟随系统深浅色");
  check(article.includes("view-transition-name: post-format-check"), "文章标题参与视图过渡");
  check(home.includes("view-transition-name: post-format-check"), "列表标题参与视图过渡");
  check(home.includes("emblem emblem-card"), "列表有生成图形");
  check(home.includes('class="filters"'), "多标签时出现标签筛选");

  const untouched = fs.readFileSync(path.join(real.outDir, "index.html"), "utf8");
  check(untouched.includes("高提及率的盲区"), "自检构建没有改写正式首页");
  check(!untouched.includes("格式自检"), "正式首页没有自检标题");

  const emptyDir = path.join(tmp, "empty-posts");
  fs.mkdirSync(emptyDir);
  const emptyBuilt = buildFixture(emptyDir, path.join(tmp, "empty-out"));
  check(emptyBuilt.posts === 0, "空目录构建为零篇文章");
  const emptyHome = fs.readFileSync(path.join(tmp, "empty-out", "index.html"), "utf8");
  check(emptyHome.includes("暂无文章。"), "没有文章时列表留一行空状态");
  check(!emptyHome.includes("/posts/"), "没有文章时首页没有文章链接");

  expectThrow(
    () => {
      const dir = path.join(tmp, "bad-date");
      writePost(
        dir,
        "bad-date.md",
        "---\ntitle: 坏日期\ndate: 2026-02-31\nslug: bad-date\nsummary: 无效日期。\n---\n\n正文。\n",
      );
      buildFixture(dir, path.join(tmp, "bad-date-out"));
    },
    /date 不是有效日期/,
    "拒绝不存在的日期",
  );

  expectThrow(
    () => {
      const dir = path.join(tmp, "bad-slug");
      writePost(
        dir,
        "Bad.md",
        "---\ntitle: 坏标识\ndate: 2026-01-01\nslug: Bad\nsummary: 大写标识。\n---\n\n正文。\n",
      );
      buildFixture(dir, path.join(tmp, "bad-slug-out"));
    },
    /slug/,
    "拒绝非法 slug",
  );

  expectThrow(
    () => {
      const dir = path.join(tmp, "mismatch");
      writePost(
        dir,
        "other-name.md",
        "---\ntitle: 文件名不一致\ndate: 2026-01-01\nslug: right-name\nsummary: 文件名须与 slug 一致。\n---\n\n正文。\n",
      );
      buildFixture(dir, path.join(tmp, "mismatch-out"));
    },
    /文件名必须是/,
    "文件名必须与 slug 一致",
  );

  expectThrow(
    () => {
      const dir = path.join(tmp, "bad-url");
      writePost(
        dir,
        "bad-url.md",
        "---\ntitle: 坏链接\ndate: 2026-01-01\nslug: bad-url\nsummary: 参考文献协议不允许。\nreferences:\n  - title: 坏链接\n    url: javascript:alert(1)\n---\n\n正文。\n",
      );
      buildFixture(dir, path.join(tmp, "bad-url-out"));
    },
    /仅允许 http 或 https/,
    "拒绝参考文献中的 javascript 地址",
  );

  expectThrow(
    () => {
      const dir = path.join(tmp, "unknown");
      writePost(
        dir,
        "unknown.md",
        "---\ntitle: 未知字段\ndate: 2026-01-01\nslug: unknown\nsummary: 有拼写错误的字段。\ndraft: true\n---\n\n正文。\n",
      );
      buildFixture(dir, path.join(tmp, "unknown-out"));
    },
    /未知字段 draft/,
    "拒绝未定义的 frontmatter 字段",
  );

  expectThrow(
    () => buildSite({ root, outDir: path.join(root, "src") }),
    /输出目录必须是 dist/,
    "拒绝把输出写进源码目录",
  );

  expectThrow(
    () => {
      const dir = path.join(tmp, "nested");
      fs.mkdirSync(path.join(dir, "nested"), { recursive: true });
      fs.writeFileSync(path.join(dir, "nested", "note.md"), "正文");
      buildFixture(dir, path.join(tmp, "nested-out"));
    },
    /不支持子目录/,
    "拒绝 posts 子目录",
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failed > 0) {
  console.error(`自检未通过：${failed} 项`);
  process.exit(1);
}

console.log("自检通过");
