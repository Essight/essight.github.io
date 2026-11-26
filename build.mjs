import { buildSite } from "./lib/build-site.mjs";

try {
  const result = buildSite();
  console.log(`已生成静态站点：${result.posts} 篇文章 → ${result.outDir}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
