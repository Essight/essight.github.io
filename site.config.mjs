export const site = {
  name: "萃见札记",
  nameEn: "Essight Notes",
  title: "萃见札记 · Essight Notes",
  description:
    "萃见札记 · Essight Notes。以可复核的证据链讨论生成式检索中的信号、判断与日尺度记录。",
  url: "https://essight.github.io",
  lang: "zh-CN",
  locale: "zh_CN",
};

export function absoluteUrl(pathname) {
  if (pathname === "/") return `${site.url}/`;
  return `${site.url}${pathname}`;
}
