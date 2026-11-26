import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildSite } from "../lib/build-site.mjs";
import { renderMarkdown } from "../lib/markdown.mjs";

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
const css = fs.readFileSync(path.join(real.outDir, "assets", "site.css"), "utf8");
const katexCss = fs.readFileSync(path.join(real.outDir, "assets", "katex", "katex.min.css"), "utf8");

check(real.posts === 0, "正式构建不包含文章");
check(index.includes("萃见札记"), "首页有中文名称");
check(index.includes("Essight Notes"), "首页有英文名称");
check(!index.includes("数据科学专栏"), "首页不再使用旧栏目名");
check(!notFound.includes("数据科学专栏"), "404 不再使用旧栏目名");
check(feed.includes("萃见札记 · Essight Notes"), "订阅源使用正式名称");
check(index.includes("暂无文章。"), "文章幕空状态为一行");
check(!index.includes("暂无已发布文章"), "空状态不再解释发布条件");
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
check(index.includes('id="chain"'), "首页有证据链一幕");
check(index.includes("Observation"), "证据链保留 Observation");
check(index.includes("完整日 L1"), "证据链保留完整日 L1");
check(index.includes("Snapshot"), "证据链保留 Snapshot");
check(!index.includes("/posts/"), "首页没有文章链接");
check(index.includes('src="/assets/exhibit.js"'), "首页使用站内脚本");
check(index.includes("script-src 'self'"), "首页脚本策略允许同源脚本");
const exhibit = fs.readFileSync(path.join(real.outDir, "assets", "exhibit.js"), "utf8");
check(!/https?:\/\//.test(exhibit), "首页脚本不引用外部地址");
check(exhibit.includes("prefers-reduced-motion"), "首页脚本尊重减少动态效果");
check(css.includes("prefers-reduced-motion"), "样式尊重减少动态效果");
check(notFound.includes('src="/assets/exhibit.js"'), "404 使用同一套站内脚本");
check(index.includes('href="/assets/site.css"'), "首页引用样式");
check(index.includes('href="/assets/katex/katex.min.css"'), "首页引用 KaTeX 样式");
check(index.includes('lang="zh-CN"'), "页面语言为简体中文");
check(notFound.includes("未找到该页面"), "404 页面存在");
check(notFound.includes('content="noindex"'), "404 不被索引");
check(sitemap.includes("<loc>https://essight.github.io/</loc>"), "站点地图包含首页");
check(!sitemap.includes("/posts/"), "站点地图没有文章地址");
check(!feed.includes("<item>"), "订阅源没有文章条目");
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

const footnote = renderMarkdown("正文脚注[^note]。\n\n[^note]: 脚注内容。\n");
check(footnote.includes("footnotes"), "脚注生成列表");
check(footnote.includes("脚注内容"), "脚注保留正文");
check(footnote.includes(">脚注</h2>") || footnote.includes(">脚注<"), "脚注标题为中文");

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
  check(article.includes("构建脚本"), "文章页显示作者");
  check(article.includes('class="meta-sep"'), "日期和作者之间有间隔号");
  check(article.includes(">自检</li>"), "文章页显示标签");
  check(article.includes("&lt;script&gt;"), "文章页转义原始 HTML");
  check(!/<\s*script(?![^>]*type="application\/ld\+json")/i.test(article), "文章页没有可执行脚本");
  check(!other.includes("脚注内容"), "另一篇文章不会串入脚注");
  check(article.includes('href="/assets/site.css"'), "文章页使用根路径样式");
  check(!article.includes("exhibit.js"), "文章页不加载展示脚本");
  check(!article.includes("文稿仓库"), "文章页没有文稿仓库入口");
  check(article.includes('href="/feed.xml">订阅</a>'), "文章页页脚保留订阅");

  const untouched = fs.readFileSync(path.join(real.outDir, "index.html"), "utf8");
  check(untouched.includes("暂无文章。"), "自检构建没有改写正式首页");
  check(!untouched.includes("格式自检"), "正式首页没有自检标题");

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
