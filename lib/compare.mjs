/*
 * Two-window grouped bar chart. A ```compare fence becomes HTML at build time.
 * Metric switching is a radio group, so the article page stays script-free.
 */

import yaml from "js-yaml";
import { BuildError } from "./errors.mjs";
import { collapseWhitespace, escapeHtml } from "./text.mjs";

const TOP_KEYS = new Set(["categories", "windows", "series", "max", "unit", "default"]);
const SERIES_KEYS = new Set(["id", "label", "caption", "values"]);
const NUMBER = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,4})?$/;
const SERIES_ID = /^[a-z][a-z0-9-]{0,24}$/;

function fail(message) {
  throw new BuildError(`对照图：${message}`);
}

function mapping(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} 必须是字段映射`);
  return value;
}

function text(value, label, max) {
  if (typeof value !== "string") fail(`${label} 必须是文本`);
  const normalized = collapseWhitespace(value);
  if (!normalized) fail(`${label} 不能为空`);
  if ([...normalized].length > max) fail(`${label} 过长`);
  if (/[<>]/.test(normalized)) fail(`${label} 不能包含 < 或 >`);
  return normalized;
}

function textList(value, label, { min, max, itemMax }) {
  if (!Array.isArray(value)) fail(`${label} 必须是列表`);
  if (value.length < min || value.length > max) {
    fail(min === max ? `${label} 必须是 ${min} 项` : `${label} 需要 ${min} 到 ${max} 项`);
  }
  return value.map((item, index) => text(item, `${label}[${index}]`, itemMax));
}

function numberString(value, label) {
  if (typeof value !== "string") fail(`${label} 必须是数值`);
  const text = value.trim();
  if (!NUMBER.test(text)) fail(`${label} 不是合法数值`);
  return text;
}

export function parseCompare(source) {
  let data;
  try {
    data = yaml.load(source, { schema: yaml.FAILSAFE_SCHEMA });
  } catch {
    fail("无法解析");
  }
  const spec = mapping(data, "对照图");
  for (const key of Object.keys(spec)) {
    if (!TOP_KEYS.has(key)) fail(`未知字段 ${key}`);
  }

  const categories = textList(spec.categories, "categories", { min: 1, max: 8, itemMax: 16 });
  const windows = textList(spec.windows, "windows", { min: 2, max: 2, itemMax: 32 });
  if (!Array.isArray(spec.series)) fail("series 必须是列表");
  if (spec.series.length < 1 || spec.series.length > 4) fail("series 需要 1 到 4 个指标");

  const max = spec.max == null || spec.max === "" ? "100" : numberString(spec.max, "max");
  const maxValue = Number(max);
  if (!(maxValue > 0)) fail("max 必须大于 0");

  let unit = "";
  if (spec.unit != null && spec.unit !== "") {
    if (typeof spec.unit !== "string") fail("unit 必须是文本");
    unit = spec.unit.trim();
    if ([...unit].length > 8 || /[<>&"']/.test(unit)) fail("unit 不合法");
  }

  const seen = new Set();
  const series = spec.series.map((item, index) => {
    const label = `series[${index}]`;
    const entry = mapping(item, label);
    for (const key of Object.keys(entry)) {
      if (!SERIES_KEYS.has(key)) fail(`${label} 含有未知字段 ${key}`);
    }
    if (typeof entry.id !== "string" || !SERIES_ID.test(entry.id)) fail(`${label}.id 只能使用小写英文、数字和连字符`);
    if (seen.has(entry.id)) fail(`${label}.id 重复：${entry.id}`);
    seen.add(entry.id);
    const name = text(entry.label, `${label}.label`, 32);
    const caption = text(entry.caption, `${label}.caption`, 240);
    if (!Array.isArray(entry.values) || entry.values.length !== windows.length) {
      fail(`${label}.values 须与窗口一一对应`);
    }
    const values = entry.values.map((row, rowIndex) => {
      if (!Array.isArray(row) || row.length !== categories.length) {
        fail(`${label}.values[${rowIndex}] 须与类别一一对应`);
      }
      return row.map((cell, cellIndex) => {
        const text = numberString(cell, `${label}.values[${rowIndex}][${cellIndex}]`);
        const numeric = Number(text);
        if (numeric > maxValue) fail(`${label}.values[${rowIndex}][${cellIndex}] 超出刻度`);
        return text;
      });
    });
    return { id: entry.id, label: name, caption, values };
  });

  const fallback = series[0].id;
  const chosen = spec.default == null || spec.default === "" ? fallback : spec.default;
  if (typeof chosen !== "string" || !series.some((item) => item.id === chosen)) fail("default 没有对应的指标");

  return { categories, windows, series, max, unit, defaultId: chosen };
}

function rowsHtml(categories, values) {
  return categories
    .map((name, index) => {
      const bars = values
        .map((row, windowIndex) => {
          const value = row[index];
          return `<div class="compare-bar"><span class="compare-track"><span class="compare-fill is-${windowIndex}" style="--v:${escapeHtml(value)}"></span></span><span class="compare-num">${escapeHtml(value)}</span></div>`;
        })
        .join("");
      return `<div class="compare-row"><div class="compare-name">${escapeHtml(name)}</div><div class="compare-pair">${bars}</div></div>`;
    })
    .join("");
}

function tableHtml(series, categories, windows, max, unit) {
  const unitText = unit ? `，单位 ${escapeHtml(unit)}` : "";
  const head = windows.map((name) => `<th scope="col">${escapeHtml(name)}</th>`).join("");
  const body = categories
    .map((name, index) => {
      const cells = series.values.map((row) => `<td>${escapeHtml(row[index])}</td>`).join("");
      return `<tr><th scope="row">${escapeHtml(name)}</th>${cells}</tr>`;
    })
    .join("");
  return `<div class="sr-only"><table><caption>${escapeHtml(series.label)}${unitText}，刻度 0–${escapeHtml(max)}</caption><thead><tr><th scope="col">类别</th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderCompareChart(spec, index) {
  const single = spec.series.length === 1;
  const picks = spec.series
    .map((series) => {
      const id = `compare-${index}-${series.id}`;
      const checked = series.id === spec.defaultId ? " checked" : "";
      return `<input class="compare-pick" type="radio" name="compare-${index}" id="${id}"${checked}><label for="${id}">${escapeHtml(series.label)}</label>`;
    })
    .join("");
  const views = spec.series
    .map(
      (series) => `<div class="compare-view"><p class="compare-metric">${escapeHtml(series.label)}</p><div class="compare-plot" aria-hidden="true">${rowsHtml(spec.categories, series.values)}</div>${tableHtml(series, spec.categories, spec.windows, spec.max, spec.unit)}</div>`,
    )
    .join("");
  const notes = spec.series.map((series) => `<p class="compare-note">${escapeHtml(series.caption)}</p>`).join("");
  const legend = spec.windows
    .map(
      (name, windowIndex) =>
        `<span class="compare-key"><i class="compare-swatch is-${windowIndex}"></i>${escapeHtml(name)}</span>`,
    )
    .join("");
  const scale = `0–${spec.max}${spec.unit}`;
  const switchHtml = single
    ? ""
    : `<div class="compare-switch" role="radiogroup" aria-label="切换指标">${picks}</div>`;
  return `<figure class="compare${single ? " is-single" : ""}" style="--max:${escapeHtml(spec.max)}">${switchHtml}<div class="compare-legend" aria-hidden="true">${legend}<span class="compare-scale">${escapeHtml(scale)}</span></div><div class="compare-views">${views}</div><figcaption class="compare-notes">${notes}</figcaption></figure>`;
}

const FENCE = /^ {0,3}```compare[ \t]*\n([\s\S]*?)\n {0,3}```[ \t]*(?:\n|$)/;

export function compareChartExtension(state) {
  return {
    name: "compareChart",
    level: "block",
    start(src) {
      const index = src.search(/(?:^|\n) {0,3}```compare(?:[ \t]*\n)/);
      return index === -1 ? undefined : index;
    },
    tokenizer(src) {
      if (!/^ {0,3}```compare(?:[ \t]*\n|$)/.test(src)) return;
      const match = FENCE.exec(src);
      if (!match) fail("代码块没有结束");
      if (match[1].length > 20000) fail("内容过长");
      return {
        type: "compareChart",
        raw: match[0],
        spec: parseCompare(match[1]),
      };
    },
    renderer(token) {
      state.n += 1;
      return `${renderCompareChart(token.spec, state.n)}\n`;
    },
  };
}
