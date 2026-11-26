export const site = {
  name: "Essight",
  column: "GEO 数据科学专栏",
  title: "Essight · GEO 数据科学专栏",
  description:
    "发布经审核的中文技术与数据科学文章。文稿使用 Markdown 维护，支持表格、代码、参考文献与数学公式；合并到 main 分支后，会出现在首页列表和独立文章页。",
  url: "https://essight.github.io",
  lang: "zh-CN",
  locale: "zh_CN",
  repoUrl: "https://github.com/Essight/essight.github.io",
};

export function absoluteUrl(pathname) {
  if (pathname === "/") return `${site.url}/`;
  return `${site.url}${pathname}`;
}
