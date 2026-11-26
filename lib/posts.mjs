import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";
import { BuildError } from "./errors.mjs";
import { renderMarkdown } from "./markdown.mjs";
import { charLength, collapseWhitespace, isValidYmd, safeUrl } from "./text.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_KEYS = new Set(["title", "date", "slug", "summary", "tags", "author", "references"]);

const matterOptions = {
  engines: {
    yaml: {
      parse(input) {
        const parsed = yaml.load(input, { schema: yaml.CORE_SCHEMA });
        if (parsed == null) return {};
        if (typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new BuildError("frontmatter 必须是字段映射");
        }
        return parsed;
      },
    },
  },
};

function fail(file, message) {
  throw new BuildError(`${file}：${message}`);
}

function plainText(value, file, field, { required = false, max = 200 } = {}) {
  if (value == null || value === "") {
    if (required) fail(file, `缺少必填字段 ${field}`);
    return "";
  }
  if (typeof value !== "string" && typeof value !== "number") {
    fail(file, `${field} 必须是文本`);
  }
  const text = collapseWhitespace(value);
  if (!text) {
    if (required) fail(file, `缺少必填字段 ${field}`);
    return "";
  }
  if (charLength(text) > max) fail(file, `${field} 超过 ${max} 个字符`);
  return text;
}

function normalizeDate(value, file) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    fail(file, "date 必须是 YYYY-MM-DD，例如 2026-01-15");
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!isValidYmd(year, month, day) || year < 1990 || year > 2100) {
    fail(file, "date 不是有效日期");
  }
  return value;
}

function normalizeTags(value, file) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(file, "tags 必须是列表");
  if (value.length > 8) fail(file, "tags 最多 8 个");
  const tags = [];
  for (const item of value) {
    const tag = plainText(item, file, "tags", { required: true, max: 20 });
    if (/[<>]/.test(tag)) fail(file, "tags 不能包含 < 或 >");
    if (tags.includes(tag)) fail(file, `tags 重复：${tag}`);
    tags.push(tag);
  }
  return tags;
}

function normalizeReferences(value, file) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(file, "references 必须是列表");
  if (value.length > 50) fail(file, "references 最多 50 条");
  return value.map((item, index) => {
    const label = `references[${index}]`;
    if (!item || typeof item !== "object" || Array.isArray(item)) fail(file, `${label} 必须是映射`);
    const allowed = new Set(["title", "url", "authors", "year", "note"]);
    for (const key of Object.keys(item)) {
      if (!allowed.has(key)) fail(file, `${label} 含有未知字段 ${key}`);
    }
    const title = plainText(item.title, file, `${label}.title`, { required: true, max: 200 });
    const url = item.url == null || item.url === "" ? "" : plainText(item.url, file, `${label}.url`, { max: 500 });
    if (url && !safeUrl(url)) fail(file, `${label}.url 仅允许 http 或 https`);
    const authors = plainText(item.authors, file, `${label}.authors`, { max: 120 });
    let year = "";
    if (item.year != null && item.year !== "") {
      year = plainText(item.year, file, `${label}.year`, { max: 4 });
      if (!/^\d{4}$/.test(year)) fail(file, `${label}.year 必须是四位年份`);
    }
    const note = plainText(item.note, file, `${label}.note`, { max: 200 });
    return { title, url, authors, year, note };
  });
}

function readPost(postsDir, filename) {
  const file = `posts/${filename}`;
  const raw = fs.readFileSync(path.join(postsDir, filename), "utf8");
  let parsed;
  try {
    parsed = matter(raw, matterOptions);
  } catch (error) {
    if (error instanceof BuildError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    fail(file, `frontmatter 无法解析（${message}）`);
  }

  const data = parsed.data ?? {};
  for (const key of Object.keys(data)) {
    if (!ALLOWED_KEYS.has(key)) fail(file, `未知字段 ${key}`);
  }

  const title = plainText(data.title, file, "title", { required: true, max: 100 });
  const date = normalizeDate(data.date, file);
  const slug = plainText(data.slug, file, "slug", { required: true, max: 80 });
  if (!SLUG.test(slug)) fail(file, "slug 只能包含小写英文、数字和连字符，且不能以连字符开头或结尾");
  if (filename !== `${slug}.md`) fail(file, `文件名必须是 ${slug}.md`);
  const summary = plainText(data.summary, file, "summary", { required: true, max: 280 });
  const author = plainText(data.author, file, "author", { max: 40 });
  const tags = normalizeTags(data.tags, file);
  const references = normalizeReferences(data.references, file);
  const body = parsed.content.trim();
  if (!body) fail(file, "正文不能为空");
  if (body.length > 500000) fail(file, "正文过长");

  let html;
  try {
    html = renderMarkdown(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(file, message.replace(/^posts\/[^：]+：/, ""));
  }

  return { title, date, slug, summary, author, tags, references, html };
}

export function loadPosts(postsDir) {
  if (!fs.existsSync(postsDir)) throw new BuildError(`缺少文章目录：${postsDir}`);
  const posts = [];
  for (const entry of fs.readdirSync(postsDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      throw new BuildError(`posts/ 不支持子目录 ${entry.name}/。请使用 posts/<slug>.md。`);
    }
    if (!entry.isFile()) continue;
    if (entry.name === "README.md" || entry.name.startsWith("_")) continue;
    if (!entry.name.endsWith(".md")) {
      throw new BuildError(`posts/ 只接受 Markdown 文件，发现 ${entry.name}`);
    }
    posts.push(readPost(postsDir, entry.name));
  }

  const seen = new Set();
  for (const post of posts) {
    if (seen.has(post.slug)) throw new BuildError(`slug 重复：${post.slug}`);
    seen.add(post.slug);
  }

  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug, "en")));
  return posts;
}
