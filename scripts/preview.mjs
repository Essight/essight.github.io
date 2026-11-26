import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { buildSite } from "../lib/build-site.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function safeFile(urlPath) {
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  } catch {
    return null;
  }
  const relative = pathname.replace(/^\/+/, "");
  const resolved = path.resolve(dist, relative);
  if (resolved !== dist && !resolved.startsWith(dist + path.sep)) return null;
  return resolved;
}

function send(response, status, file, type) {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(response);
}

function sendNotFound(response) {
  const file = path.join(dist, "404.html");
  if (!fs.existsSync(file)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("未找到该页面");
    return;
  }
  send(response, 404, file, types[".html"]);
}

function resolveFile(requestPath) {
  const candidate = safeFile(requestPath);
  if (!candidate) return null;
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    const index = path.join(candidate, "index.html");
    return fs.existsSync(index) ? index : null;
  }
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  if (!path.extname(candidate)) {
    const index = path.join(candidate, "index.html");
    if (fs.existsSync(index)) return index;
  }
  return null;
}

try {
  buildSite({ root });
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const file = resolveFile(request.url || "/");
  if (!file) {
    sendNotFound(response);
    return;
  }
  const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
  if (request.method === "HEAD") {
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-cache" });
    response.end();
    return;
  }
  send(response, 200, file, type);
});

server.listen(port, host, () => {
  console.log(`本地预览：http://${host}:${port}/`);
});
