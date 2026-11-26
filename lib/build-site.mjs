import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { BuildError } from "./errors.mjs";
import { loadPosts } from "./posts.mjs";
import { renderArticle, renderHome, renderNotFound, renderRobots, renderRss, renderSitemap } from "./render.mjs";

const require = createRequire(import.meta.url);

function assertSafeOutDir(outDir, root) {
  const resolved = path.resolve(outDir);
  const rootResolved = path.resolve(root);
  const filesystemRoot = path.parse(resolved).root;
  if (
    resolved === filesystemRoot ||
    resolved === rootResolved ||
    rootResolved.startsWith(resolved + path.sep)
  ) {
    throw new BuildError(`拒绝使用该输出目录：${resolved}`);
  }
  const insideProject = resolved.startsWith(rootResolved + path.sep);
  if (insideProject && resolved !== path.resolve(root, "dist")) {
    throw new BuildError(`输出目录必须是 dist/ 或项目外的临时目录：${resolved}`);
  }
}

function copyPublic(src, dest) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) throw new BuildError(`public/ 不支持符号链接：${entry.name}`);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyPublic(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    }
  }
}

function copyKatex(outDir) {
  const katexRoot = path.dirname(require.resolve("katex/package.json"));
  const dist = path.join(katexRoot, "dist");
  const cssPath = path.join(dist, "katex.min.css");
  const css = fs.readFileSync(cssPath, "utf8");
  const stripped = css.replaceAll(/,url\(fonts\/[^)]+?\) format\("(?:woff|truetype)"\)/g, "");
  const target = path.join(outDir, "assets", "katex");
  const fontsOut = path.join(target, "fonts");
  fs.mkdirSync(fontsOut, { recursive: true });
  const woff2Only = stripped !== css && !stripped.includes('format("woff")') && !stripped.includes("truetype");
  const fontDir = path.join(dist, "fonts");
  for (const name of fs.readdirSync(fontDir)) {
    if (woff2Only && !name.endsWith(".woff2")) continue;
    fs.copyFileSync(path.join(fontDir, name), path.join(fontsOut, name));
  }
  fs.writeFileSync(path.join(target, "katex.min.css"), woff2Only ? stripped : css);
}

export function buildSite(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const postsDir = path.resolve(options.postsDir ?? path.join(root, "posts"));
  const publicDir = path.resolve(options.publicDir ?? path.join(root, "public"));
  const outDir = path.resolve(options.outDir ?? path.join(root, "dist"));
  assertSafeOutDir(outDir, root);

  const posts = loadPosts(postsDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(publicDir)) copyPublic(publicDir, outDir);

  const assets = path.join(outDir, "assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.copyFileSync(path.join(root, "src", "site.css"), path.join(assets, "site.css"));
  fs.copyFileSync(path.join(root, "src", "exhibit.js"), path.join(assets, "exhibit.js"));
  fs.copyFileSync(path.join(root, "src", "favicon.svg"), path.join(assets, "favicon.svg"));
  copyKatex(outDir);

  fs.writeFileSync(path.join(outDir, "index.html"), renderHome(posts));
  fs.writeFileSync(path.join(outDir, "404.html"), renderNotFound());
  fs.writeFileSync(path.join(outDir, "robots.txt"), renderRobots());
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(posts));
  fs.writeFileSync(path.join(outDir, "feed.xml"), renderRss(posts));
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "");

  for (const post of posts) {
    const dir = path.join(outDir, "posts", post.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderArticle(post));
  }

  return { outDir, posts: posts.length };
}
