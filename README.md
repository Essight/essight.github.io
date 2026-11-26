# Essight · GEO 数据科学专栏

公开静态站点，发布地址为 [https://essight.github.io/](https://essight.github.io/)。

本仓库只发布已经审核通过的文章。当前站点是阅读框架：首页有专栏介绍和空的文章列表，没有样例文章，也没有业务数据。

## 技术方案

站点由一个 Node.js 构建脚本生成，不使用 Jekyll、Astro 或 Eleventy。

- 文章放在 `posts/*.md`，用 [gray-matter](https://github.com/jonschlinkert/gray-matter) 读取 frontmatter，用 [marked](https://marked.js.org/) 渲染 GitHub 风格 Markdown（含表格）。
- 数学公式在构建时由 [KaTeX](https://katex.org/) 写成 HTML。页面不加载客户端 JavaScript，也不依赖公式 CDN。
- 代码块在构建时用 highlight.js 着色。KaTeX 的样式和 woff2 字体、站点样式都输出到 `dist/assets/`，阅读时不请求第三方字体服务。
- 中文排版使用系统字体：界面用苹方 / 思源黑体 / 微软雅黑，正文用宋体 / 思源宋体。版心约 36 个汉字，表格和长公式可以横向滚动。

本地与 GitHub Actions 都使用 Node.js 22。`npm run check` 会先构建正式站点，再用临时文稿检查表格、代码、公式、脚注和参考文献，临时文件不会写入 `posts/`，也不会进入 `dist/`。

## 本地预览

```bash
npm ci
npm run preview
```

浏览器打开 <http://127.0.0.1:4173/>。预览命令会先构建再启动本地服务器。只构建、不启动服务器时用 `npm run build`，产物在 `dist/`。提交前可以运行 `npm run check`。

不要把 `dist/` 或 `node_modules/` 提交进仓库。

## 目录

```text
.github/workflows/   check.yml 在 Pull Request 上构建；pages.yml 在 main 上部署
lib/                 读取文章、渲染 Markdown、生成页面
posts/               已审核文章，一篇一个 posts/<slug>.md
public/              原样复制到站点根目录的图片等文件
scripts/             本地预览与构建自检
src/                 样式和图标
build.mjs            构建入口
site.config.mjs      站点名称、简介和正式域名
```

## 新增文章

在 `posts/` 新增 `posts/<slug>.md`。`slug` 与文件名必须一致，只能使用小写英文、数字和连字符。

```yaml
---
title: 文章标题
date: 2026-01-15
slug: article-slug
summary: 一两句纯文本摘要，显示在首页列表和文章页导语。
tags:
  - 数据科学
author: 作者名
references:
  - title: 文献或资料标题
    authors: 作者
    year: "2024"
    url: https://example.com/paper
    note: 可选补充说明
---
```

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题，同时作为页面 `<h1>` |
| `date` | 是 | 发布日期，`YYYY-MM-DD` |
| `slug` | 是 | 小写英文 slug，文件名必须是 `posts/<slug>.md` |
| `summary` | 是 | 纯文本摘要，不解析 Markdown |
| `tags` | 否 | 最多 8 个短标签 |
| `author` | 否 | 作者 |
| `references` | 否 | 参考文献。`title` 必填；`url` 只能是 http 或 https |

构建只认这些字段。写错字段名会导致构建失败，文章不会发布。首页按 `date` 从新到旧排列。文章地址是 `/posts/<slug>/`。

正文使用 Markdown：

- 表格用 GitHub 风格表格。过宽的表可以在手机上横向滚动。
- 代码块使用围栏并写上语言，例如 `python`、`r`、`sql`、`bash`、`js`。
- 参考文献写在 frontmatter 的 `references`。站点会在文末生成「参考文献」，不必在正文里再写一节。
- 脚注使用 `[^note]` 和 `[^note]: 内容`。
- 行内公式：`$R^2$`、`$\beta$`，或 `\(...\)`。块级公式的 `$$` 单独占一行：

```markdown
$$
\hat{\beta} = (X^{\top} X)^{-1} X^{\top} y
$$
```

也可以用单独成段的 `\[ ... \]`。每个公式单独渲染，不能依赖上一则公式里的 `\newcommand`。美元金额请写成 `\$5`，或避免把两个 `$` 包住一段普通文字；`\( ... \)` 不会和金额冲突。

正文里的一级标题 `#` 会显示为小节标题。页面的 `<h1>` 始终是 frontmatter 的 `title`。

图片放在 `public/`，例如 `public/images/figure.png`，正文用根路径引用：`![图的说明](/images/figure.png)`。不要在 `posts/` 里建子目录。

## 发布流程

1. 文章审核通过后，向 `main` 提交 Pull Request，只加入对应的 `posts/<slug>.md` 和需要的 `public/` 文件。
2. Pull Request 会运行 **Check site build**。构建失败时不会进入站点。
3. 合并到 `main` 后，**Deploy GitHub Pages** 执行 `npm run check`，并用官方的 `actions/configure-pages`、`actions/upload-pages-artifact`、`actions/deploy-pages` 把 `dist/` 发布到 GitHub Pages。
4. 文章随后出现在首页列表和 `/posts/<slug>/`。

## 首次开启 GitHub Pages

仓库目前的 Pages 来源是「Deploy from a branch」（`main` 分支的根目录），不是 GitHub Actions。合并本仓库的部署工作流之后，需要改一次设置，否则工作流无法把构建结果发布出去，分支发布也不会使用 `dist/`。

1. 确认 `.github/workflows/pages.yml` 已经在 `main` 上。
2. 打开仓库 **Settings → Pages → Build and deployment**。
3. 将 **Source** 设为 **GitHub Actions**。
4. 如果合并时工作流因为尚未切换 Source 而失败，切换后到 **Actions** 里重新运行 **Deploy GitHub Pages**。

完成后站点地址为 <https://essight.github.io/>。
