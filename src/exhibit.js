/*
 * 萃见札记 · Essight Notes — exhibit engine for the homepage and the 404 page.
 *
 * One particle field travels through the measurement chain. Each act is a formation; scrolling
 * scrubs the morph between formations and the build inside each act; the last act distills the
 * whole field into the gold dot, which opens into the paper that carries the articles.
 *
 * The figures illustrate method with fixed rules and seeded randomness. They are not measurements.
 * No external requests. Honors prefers-reduced-motion. Without WebGL2 the static CSS field remains.
 */
(() => {
  "use strict";

  window.__essight = true;
  const root = document.documentElement;
  root.classList.add("js");

  const body = document.body;
  const lost = body.dataset.exhibit === "lost";
  const canvas = document.getElementById("field");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  let reduced = motionQuery.matches;

  const acts = [...document.querySelectorAll(".act")];
  const archive = document.querySelector(".archive");
  const archiveInner = archive?.querySelector(".archive-inner");
  const railLinks = [...document.querySelectorAll(".rail a")];
  const live = document.querySelector(".rail-live");
  const progressBar = document.querySelector(".progress");
  const hudNow = document.querySelector(".hud-now");
  const hudLabel = document.querySelector(".hud-label");
  const hudCount = document.querySelector(".hud-count");
  const lens = document.querySelector(".lens");
  const rim = document.querySelector(".portal-rim");
  const chain = document.querySelector(".chain");
  const lostMain = document.querySelector(".lost");
  const labels = [...document.querySelectorAll(".glabel")].map((el) => ({
    el,
    scene: Number(el.dataset.scene),
    i: el.dataset.i,
    shown: false,
    last: "",
  }));

  const S = { MARK: 0, PLANES: 1, CLOUD: 2, FLOW: 3, HIST: 4, CHAIN: 5, DOT: 6, GLYPH: 7 };
  const LAST = lost ? S.GLYPH : S.DOT;
  const WARM = [0.35, 0.12, 0.08, 0.18, 0.55, 0.3, 0.95, 0.15];
  const CLUSTERS = [
    [-0.5, 0.34, 0.12],
    [0.46, 0.44, -0.22],
    [-0.34, -0.44, -0.28],
    [0.52, -0.3, 0.3],
  ];
  const HIST_COLS = 4;

  /* ---------- small math -------------------------------------------------------------- */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const rx = (a, v) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
  };
  const ry = (a, v) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
  };
  const rz = (a, v) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
  };
  const project = (v, f) => {
    const k = 3.4 / (3.4 - clamp(v[2], -2.5, 2.5));
    return [f[0] + v[0] * k * f[2], f[1] - v[1] * k * f[2]];
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- particle data (computed once) ------------------------------------------------ */

  const smallScreen = Math.min(window.screen.width, window.screen.height) < 600 || !finePointer;
  const cores = navigator.hardwareConcurrency || 4;
  const N = lost ? (smallScreen ? 2600 : 5200) : smallScreen ? 3600 : cores <= 4 ? 5400 : 7600;

  function buildParticles() {
    const rand = mulberry32(0xe55147);
    const gauss = () => {
      const u = Math.max(1e-9, rand());
      const v = rand();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    const seed = new Float32Array(N * 4);
    for (let i = 0; i < seed.length; i += 1) seed[i] = rand();

    // Prompt space: key prompts with neighbor edges, a halo around each cluster, loose dust.
    const cloud = new Float32Array(N * 4);
    const keyCount = Math.min(560, Math.round(N * 0.075));
    const keys = [];
    for (let i = 0; i < N; i += 1) {
      const cl = i % 4;
      const role = i < keyCount ? 0 : rand() < 0.55 ? 1 : 2;
      let x;
      let y;
      let z;
      if (role === 2) {
        const r = 0.9 + rand() * 1.0;
        const zz = rand() * 2 - 1;
        const th = rand() * Math.PI * 2;
        const rr = Math.sqrt(1 - zz * zz);
        x = rr * Math.cos(th) * r;
        y = rr * Math.sin(th) * r;
        z = zz * r;
      } else {
        const sd = role === 0 ? 0.105 : 0.19;
        x = gauss() * sd * 1.25;
        y = gauss() * sd;
        z = gauss() * sd;
      }
      const hub = role === 0 && i < 12;
      cloud[i * 4] = x;
      cloud[i * 4 + 1] = y;
      cloud[i * 4 + 2] = z;
      cloud[i * 4 + 3] = cl + 4 * role + (hub ? 0.5 : 0);
      if (role === 0) {
        const c = CLUSTERS[cl];
        keys.push({ i, cl, x: c[0] + x, y: c[1] + y, z: c[2] + z });
      }
    }
    const edges = [];
    const seen = new Set();
    const link = (a, b) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push(a, b);
    };
    const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
    for (const a of keys) {
      let b1 = null;
      let b2 = null;
      let d1 = Infinity;
      let dd2 = Infinity;
      for (const b of keys) {
        if (b === a) continue;
        const d = d2(a, b);
        if (d < d1) {
          dd2 = d1;
          b2 = b1;
          d1 = d;
          b1 = b;
        } else if (d < dd2) {
          dd2 = d;
          b2 = b;
        }
      }
      if (b1) link(a.i, b1.i);
      if (b2) link(a.i, b2.i);
    }
    // Bridges: near and far both get observed.
    for (const [ca, cb] of [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 3],
      [0, 3],
    ]) {
      let best = null;
      let bestD = Infinity;
      for (const a of keys) {
        if (a.cl !== ca) continue;
        for (const b of keys) {
          if (b.cl !== cb) continue;
          const d = d2(a, b);
          if (d < bestD) {
            bestD = d;
            best = [a.i, b.i];
          }
        }
      }
      if (best) link(best[0], best[1]);
    }

    // Distribution: every particle owns a bin and a stack slot, in the order it is sampled.
    const bins = N < 4500 ? 31 : 41;
    const hist = new Float32Array(N * 4);
    const order = Array.from({ length: N }, (_, i) => i);
    for (let i = N - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const counts = new Array(bins).fill(0);
    let maxRow = 1;
    order.forEach((index, rank) => {
      const z = clamp(gauss(), -3.19, 3.19);
      const bin = Math.floor(((z + 3.2) / 6.4) * bins);
      const k = counts[bin];
      counts[bin] += 1;
      const row = Math.floor(k / HIST_COLS);
      maxRow = Math.max(maxRow, row + 1);
      hist[index * 4] = bin;
      hist[index * 4 + 1] = k % HIST_COLS;
      hist[index * 4 + 2] = row;
      hist[index * 4 + 3] = rank / N;
    });

    const glyph = lost ? sampleGlyph("404", rand) : new Float32Array(N * 2);
    return { seed, cloud, edges: new Uint16Array(edges), hist, bins, maxRow, glyph };
  }

  function sampleGlyph(text, rand) {
    const out = new Float32Array(N * 2);
    const w = 640;
    const h = 300;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return out;
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = '700 250px "Avenir Next", "Helvetica Neue", "Segoe UI", Arial, sans-serif';
    g.fillText(text, w / 2, h / 2 + 10);
    const data = g.getImageData(0, 0, w, h).data;
    const pts = [];
    for (let y = 0; y < h; y += 2) {
      for (let x = 0; x < w; x += 2) {
        if (data[(y * w + x) * 4 + 3] > 128) pts.push(x, y);
      }
    }
    const count = pts.length / 2;
    if (!count) return out;
    for (let i = 0; i < N; i += 1) {
      const j = Math.floor(rand() * count);
      out[i * 2] = (pts[j * 2] - w / 2 + rand() * 2) / (w / 2);
      out[i * 2 + 1] = (pts[j * 2 + 1] - h / 2 + rand() * 2) / (w / 2);
    }
    return out;
  }

  /* ---------- shaders ------------------------------------------------------------------- */

  const PARTICLE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeed;
layout(location = 1) in vec4 aCloud;
layout(location = 2) in vec4 aHist;
layout(location = 3) in vec2 aGlyph;

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform int uA;
uniform int uB;
uniform float uMix;
uniform vec4 uFrame[8];
uniform float uP[8];
uniform vec2 uTilt;
uniform vec3 uPointer;
uniform vec4 uPulse;
uniform float uIntro;
uniform float uStage;
uniform vec4 uNodeX;
uniform vec4 uNodeY;
uniform float uNodeR;
uniform vec4 uHist;
uniform float uBins;
uniform float uBand;
uniform float uTrickle;
uniform float uLines;
uniform float uEdge;

out vec4 vColor;

const float PI = 3.14159265;
const float TAU = 6.2831853;
const vec3 GOLD = vec3(0.871, 0.706, 0.349);
const vec3 BAMBOO = vec3(0.337, 0.824, 0.627);
const vec3 CREAM = vec3(0.969, 0.961, 0.937);
const vec3 ROSE = vec3(0.86, 0.5, 0.42);

struct P { vec2 xy; float k; vec3 col; float a; float size; };

mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }

vec3 sphereDir(vec2 s) {
  float z = s.x * 2.0 - 1.0;
  float th = s.y * TAU;
  float r = sqrt(max(0.0, 1.0 - z * z));
  return vec3(r * cos(th), r * sin(th), z);
}

P place(vec3 q, vec4 f) {
  P o;
  float k = 3.4 / (3.4 - clamp(q.z, -2.5, 2.5));
  o.xy = vec2(f.x + q.x * k * f.z, f.y - q.y * k * f.z);
  o.k = k;
  o.col = CREAM;
  o.a = 1.0;
  o.size = 1.0;
  return o;
}

P dust(float t, vec4 f, float spread) {
  vec3 q = sphereDir(vec2(fract(aSeed.y * 3.1), fract(aSeed.z * 5.7))) * spread * (0.55 + fract(aSeed.w * 9.3));
  q += vec3(sin(t * 0.2 + aSeed.z * 6.0), cos(t * 0.17 + aSeed.w * 6.0), 0.0) * 0.06;
  q = rotY(t * 0.03) * q;
  P o = place(q, f);
  o.col = mix(CREAM, BAMBOO, step(0.62, fract(aSeed.z * 9.1)));
  o.a = 0.2;
  o.size = (0.7 + aSeed.w * 0.7) * o.k;
  return o;
}

/* 00 — the Essight mark: three tilted orbits around a gold core. */
P sMark(float t, float p, vec4 f) {
  float role = aSeed.x;
  vec3 q;
  vec3 col;
  float a;
  float sz;
  if (role < 0.72) {
    float ring = floor(aSeed.y * 3.0);
    float dir = ring == 1.0 ? -1.0 : 1.0;
    float th = aSeed.z * TAU + t * (0.16 + 0.04 * ring) * dir;
    float r = 1.0 + (aSeed.w - 0.5) * 0.04;
    q = rotZ(ring * PI / 3.0) * (rotX(1.0786) * vec3(cos(th) * r, sin(th) * r, 0.0));
    col = ring < 0.5 ? GOLD : (ring < 1.5 ? BAMBOO : CREAM);
    a = 0.8;
    sz = 0.9 + aSeed.w * 1.3;
  } else if (role < 0.77) {
    q = sphereDir(aSeed.yz) * pow(fract(aSeed.w * 13.7), 2.0) * 0.09;
    col = GOLD;
    a = 0.95;
    sz = 1.4 + aSeed.y * 1.8;
  } else {
    P d = dust(t, f, 2.4);
    return d;
  }
  q = rotZ(t * 0.03 + p * 0.6) * q;
  q = rotX(uTilt.y * 0.3 + p * 0.9) * rotY(sin(t * 0.23) * 0.3 + uTilt.x * 0.4 + p * 1.4) * q;
  P o = place(q, f);
  o.col = col;
  o.a = a;
  o.size = sz * o.k;
  return o;
}

/* 01 — signal field: three coordinate planes, aligned at first, then pulled apart. */
vec3 planeAngles(float pl, float sep) {
  vec3 target = pl < 0.5 ? vec3(1.25, 0.0, 0.18) : (pl < 1.5 ? vec3(0.2, 1.15, 0.0) : vec3(-0.5, -0.45, 0.6));
  return mix(vec3(1.0, 0.0, 0.0), target, sep);
}

vec3 planeOffset(float pl, float sep) {
  vec3 o = pl < 0.5 ? vec3(-0.05, -0.45, 0.1) : (pl < 1.5 ? vec3(0.52, 0.14, -0.1) : vec3(-0.42, 0.4, -0.15));
  return o * sep;
}

P sPlanes(float t, float p, vec4 f) {
  if (aSeed.x >= 0.86) return dust(t, f, 2.2);
  float sep = smoothstep(0.05, 0.85, p);
  float pl = floor(aSeed.y * 3.0);
  float across = floor(fract(aSeed.w * 7.31) * 7.0) / 6.0;
  float flow = fract(aSeed.z + t * (0.025 + 0.01 * pl));
  vec2 uv = fract(aSeed.w * 3.7) < 0.5 ? vec2(flow, across) : vec2(across, flow);
  uv = uv * 2.0 - 1.0;
  float d = length(uv);
  float wave = sin(d * 7.5 - t * 1.8 - pl * 2.1) * 0.08 * (1.0 - smoothstep(0.3, 1.4, d));
  vec3 q = vec3(uv * 0.62, wave);
  vec3 ang = planeAngles(pl, sep);
  q = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x) * q + planeOffset(pl, sep);
  q = rotY(t * 0.05 + uTilt.x * 0.4) * rotX(-0.12 + uTilt.y * 0.25) * q;
  P o = place(q, f);
  o.col = pl < 0.5 ? GOLD : (pl < 1.5 ? BAMBOO : CREAM);
  o.a = 0.55 + 3.2 * abs(wave);
  o.size = (0.95 + aSeed.w * 0.5) * o.k;
  return o;
}

/* 02 — prompt space: four clusters separate out of one blob; neighbors stay linked. */
vec3 clusterCenter(float c) {
  if (c < 0.5) return vec3(-0.5, 0.34, 0.12);
  if (c < 1.5) return vec3(0.46, 0.44, -0.22);
  if (c < 2.5) return vec3(-0.34, -0.44, -0.28);
  return vec3(0.52, -0.3, 0.3);
}

P sCloud(float t, float p, vec4 f) {
  float code = floor(aCloud.w + 0.01);
  float hub = step(0.25, fract(aCloud.w));
  float cl = mod(code, 4.0);
  float role = floor(code / 4.0);
  float sep = smoothstep(0.0, 0.8, p);
  vec3 q;
  vec3 col;
  float a;
  float sz;
  if (role < 1.5) {
    q = clusterCenter(cl) * mix(0.1, 1.0, sep) + aCloud.xyz * mix(1.8, 1.0, sep);
    q += sin(t * 0.7 + aSeed.z * TAU) * 0.012 * normalize(aCloud.xyz + 1e-4);
    if (role < 0.5) {
      col = hub > 0.5 ? GOLD : CREAM;
      a = hub > 0.5 ? 1.0 : 0.85;
      sz = hub > 0.5 ? 3.2 : 1.25 + aSeed.w * 0.8;
    } else {
      col = mix(CREAM, BAMBOO, 0.55);
      a = 0.3;
      sz = 0.8 + aSeed.w * 0.6;
    }
  } else {
    q = aCloud.xyz + vec3(sin(t * 0.2 + aSeed.z * 6.0), cos(t * 0.15 + aSeed.w * 6.0), 0.0) * 0.04;
    col = CREAM;
    a = 0.15;
    sz = 0.7;
  }
  q = rotY(t * 0.08 + uTilt.x * 0.5) * rotX(0.22 + uTilt.y * 0.3) * q;
  P o = place(q, f);
  o.col = col;
  o.a = a;
  o.size = sz * o.k;
  return o;
}

/* 03 — judgment: answers stream through five gates. Invalid and unmentioned answers fall away;
   the rest are ranked into lanes, weighed for recommendation, then colored by sentiment. */
float gateU(int k) { return 0.14 + float(k) * 0.165; }

P sFlow(float t, float p, vec4 f) {
  float gates = p * 5.6;
  P o;
  o.k = 1.0;
  if (aSeed.x < 0.88) {
    float u = fract(aSeed.y + t * (0.035 + aSeed.z * 0.025));
    float y = aSeed.w * 2.0 - 1.0;
    y = sign(y) * pow(abs(y), 1.3);
    vec3 col = CREAM * 0.85;
    float a = 0.7;
    float sz = 0.9 + aSeed.z * 0.9;
    float r = fract(aSeed.x * 31.7);
    float drop = 0.0;
    if (r < 0.14) drop = max(0.0, u - gateU(0)) * clamp(gates, 0.0, 1.0);
    else if (r < 0.42) drop = max(0.0, u - gateU(1)) * clamp(gates - 1.0, 0.0, 1.0);
    float n0 = smoothstep(gateU(0) - 0.02, gateU(0) + 0.05, u) * clamp(gates, 0.0, 1.0);
    float n1 = smoothstep(gateU(1) - 0.02, gateU(1) + 0.05, u) * clamp(gates - 1.0, 0.0, 1.0);
    y = mix(y, y * 0.7, n0);
    y = mix(y, y * 0.42, n1);
    float lane = floor(fract(aSeed.w * 5.3) * 3.0) - 1.0;
    float n2 = smoothstep(gateU(2) - 0.02, gateU(2) + 0.06, u) * clamp(gates - 2.0, 0.0, 1.0);
    y = mix(y, lane * 0.36 + y * 0.12, n2);
    float n3 = smoothstep(gateU(3) - 0.01, gateU(3) + 0.04, u) * clamp(gates - 3.0, 0.0, 1.0);
    float rec = fract(aSeed.z * 7.7);
    col = mix(col, mix(CREAM * 0.55, GOLD, rec), n3);
    sz *= 1.0 + n3 * rec * 0.8;
    float n4 = smoothstep(gateU(4) - 0.01, gateU(4) + 0.04, u) * clamp(gates - 4.0, 0.0, 1.0);
    float sent = fract(aSeed.y * 11.3);
    vec3 sc = sent < 0.56 ? BAMBOO : (sent < 0.88 ? CREAM : ROSE);
    col = mix(col, sc, n4);
    float glint = 0.0;
    for (int k = 0; k < 5; k++) {
      float du = (u - gateU(k)) * 60.0;
      glint += exp(-du * du) * clamp(gates - float(k), 0.0, 1.0);
    }
    a += glint * 0.9;
    a *= 1.0 - smoothstep(0.0, 0.1, drop);
    a *= smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.94, 1.0, u));
    o.xy = vec2(f.x + u * f.z, f.y + y * f.w + drop * drop * f.w * 30.0);
    o.col = col;
    o.a = a;
    o.size = sz;
  } else {
    int k = int(floor(fract(aSeed.y * 13.7) * 5.0));
    float on = clamp(gates - float(k), 0.0, 1.0);
    vec2 post = vec2(f.x + gateU(k) * f.z, f.y + (aSeed.z * 2.0 - 1.0) * 1.15 * f.w);
    vec2 loose = vec2(f.x + aSeed.w * f.z, f.y + (aSeed.z * 2.0 - 1.0) * f.w * 1.8);
    o.xy = mix(loose, post, on);
    o.col = mix(CREAM, GOLD, on);
    o.a = mix(0.08, 0.5 * (0.6 + 0.4 * sin(t * 2.0 + aSeed.w * TAU)), on);
    o.size = 0.9;
  }
  return o;
}

/* 04 — distribution: samples drain from a reservoir into a histogram; the band narrows as n grows. */
P sHist(float t, float p, vec4 f) {
  float n = mix(0.05, 1.0, smoothstep(0.0, 0.92, p));
  float rank = aHist.w;
  float bw = uHist.z / uBins;
  vec2 target = vec2(uHist.x + (aHist.x + (aHist.y + 0.5) / ${HIST_COLS}.0) * bw, uHist.y - (aHist.z + 0.5) * uHist.w);
  float zs = ((aHist.x + 0.5) / uBins) * 6.4 - 3.2;
  float inBand = 1.0 - smoothstep(uBand - 0.04, uBand + 0.04, abs(zs));
  P o;
  o.k = 1.0;
  if (rank < n - uTrickle) {
    o.xy = target;
    o.col = mix(CREAM * 0.78, GOLD, inBand);
    o.a = 0.82;
    o.size = 1.1 + aSeed.w * 0.5;
  } else if (rank < n) {
    float e = fract(t * 0.5 + aSeed.y * 7.0);
    vec2 start = vec2(f.x + (aSeed.z - 0.5) * f.z * 0.25, f.y + f.z * 0.5);
    float wig = sin(e * 18.0 + aSeed.w * 30.0) * bw * 1.4 * (1.0 - e);
    o.xy = vec2(mix(start.x, target.x, smoothstep(0.0, 1.0, e)) + wig, mix(start.y, target.y, e * e));
    o.col = CREAM;
    o.a = 0.9 * smoothstep(0.0, 0.1, e) * (1.0 - smoothstep(0.85, 1.0, e));
    o.size = 1.2;
  } else {
    float ang = aSeed.w * TAU + t * (0.2 + aSeed.y * 0.3);
    float rr = sqrt(aSeed.z) * f.z;
    o.xy = vec2(f.x + cos(ang) * rr, f.y + sin(ang) * rr * 0.55);
    o.col = CREAM * 0.7;
    o.a = 0.4;
    o.size = 0.9 + aSeed.w * 0.6;
  }
  return o;
}

/* 05 — evidence chain: observation cloud, judgment ring, a 24-hour complete day, a frozen snapshot. */
vec2 nodeXY(int k) { return vec2(uNodeX[k], uNodeY[k]); }

P sChain(float t, float p, vec4 f) {
  P o;
  if (aSeed.x < 0.8) {
    int ki = int(floor(aSeed.y * 4.0));
    float k = float(ki);
    float emph = 1.0 - clamp(abs(k - uStage), 0.0, 1.0);
    float reached = 1.0 - smoothstep(-0.5, 0.5, k - uStage);
    float s1 = fract(aSeed.y * 9.7);
    float s2 = fract(aSeed.z * 5.1);
    float s3 = fract(aSeed.w * 3.3);
    vec3 q;
    vec3 col;
    if (ki == 0) {
      q = sphereDir(aSeed.zw) * pow(s1, 0.5);
      q += vec3(sin(t * 0.9 + aSeed.w * 9.0), cos(t * 0.8 + aSeed.z * 9.0), sin(t * 0.7 + s1 * 9.0)) * 0.07;
      col = CREAM;
    } else if (ki == 1) {
      float th = aSeed.z * TAU;
      if (s3 < 0.6) {
        q = vec3(cos(th), sin(th), 0.0) * 0.86;
      } else {
        float tk = floor(aSeed.z * 12.0) / 12.0 * TAU;
        q = vec3(cos(tk), sin(tk), 0.0) * (0.98 + s2 * 0.25);
      }
      q = rotX(0.55) * rotZ(t * 0.2) * q;
      col = BAMBOO;
    } else if (ki == 2) {
      if (s3 < 0.1) {
        float hand = t * 0.3;
        q = vec3(sin(hand), cos(hand), 0.0) * s2 * 0.75;
        col = GOLD;
      } else {
        float seg = floor(aSeed.z * 24.0);
        float th = (seg + 0.12 + 0.76 * s2) / 24.0 * TAU;
        q = vec3(sin(th), cos(th), 0.0) * (0.9 + (s1 - 0.5) * 0.07);
        col = mix(GOLD, CREAM, 0.25);
      }
      q = rotX(-0.3) * q;
    } else {
      vec3 g = floor(vec3(aSeed.z, aSeed.w, s1) * 4.0);
      q = (g / 3.0 * 2.0 - 1.0) * 0.58 + (vec3(s2, s3, fract(aSeed.x * 7.7)) - 0.5) * 0.03;
      q = rotY(t * 0.25 + 0.6) * rotX(0.5) * q;
      col = CREAM;
    }
    float kk = 3.4 / (3.4 - q.z);
    float R = uNodeR * mix(0.78, 1.18, emph);
    o.xy = nodeXY(ki) + vec2(q.x, -q.y) * kk * R;
    o.k = kk;
    o.col = mix(col * 0.75, col, emph);
    o.a = mix(0.22, 0.95, max(emph, 0.45 * reached));
    o.size = (0.9 + aSeed.w * 0.9) * kk * mix(0.9, 1.25, emph);
  } else {
    int seg = int(floor(fract(aSeed.y * 7.3) * 3.0));
    float u = fract(aSeed.z + t * (0.1 + aSeed.w * 0.06));
    vec2 a0 = nodeXY(seg);
    vec2 b0 = nodeXY(seg + 1);
    vec2 d = b0 - a0;
    vec2 nrm = normalize(vec2(-d.y, d.x) + 1e-4);
    float lit = clamp(uStage - float(seg), 0.0, 1.0);
    o.xy = mix(a0, b0, u) + nrm * sin(u * PI) * (aSeed.w - 0.5) * uNodeR * 0.5;
    o.k = 1.0;
    o.col = mix(CREAM * 0.6, GOLD, lit);
    o.a = mix(0.18, 0.75, lit) * sin(u * PI);
    o.size = 0.9;
  }
  return o;
}

/* 06 — the gold dot: everything distilled to one point. */
P sDot(float t, float p, vec4 f) {
  P o;
  o.k = 1.0;
  if (aSeed.x < 0.07) {
    float r = pow(aSeed.z, 2.2) * 10.0;
    float th = aSeed.w * TAU + t * (0.8 + aSeed.y);
    o.xy = f.xy + vec2(cos(th), sin(th)) * r;
    o.col = mix(GOLD, CREAM, 0.2 * (1.0 - aSeed.z));
    o.a = 0.55;
    o.size = 1.0;
  } else if (aSeed.x < 0.12) {
    float r = 16.0 + aSeed.z * 38.0;
    float th = aSeed.w * TAU + t * 0.3 * (aSeed.y - 0.5);
    o.xy = f.xy + vec2(cos(th), sin(th)) * r;
    o.col = GOLD;
    o.a = 0.16 * (1.0 - aSeed.z);
    o.size = 0.8;
  } else {
    o.xy = f.xy + (aSeed.yz - 0.5) * 6.0;
    o.col = GOLD;
    o.a = 0.0;
    o.size = 0.5;
  }
  return o;
}

/* 404 — the address resolves to nothing but noise. */
P sGlyph(float t, float p, vec4 f) {
  if (aSeed.x >= 0.88) return dust(t, f, 2.6);
  vec2 g = aGlyph;
  float band = floor((g.y + 1.0) * 9.0);
  float tick = floor(t * 1.6);
  float h1 = fract(sin(band * 12.9898 + tick * 78.233) * 43758.5453);
  float h2 = fract(sin(band * 39.346 + tick * 11.135) * 24634.6345);
  float glitch = step(0.9, h1) * (h2 - 0.5) * 0.22;
  g.x += glitch;
  g += vec2(sin(t * 0.8 + aSeed.z * TAU), cos(t * 0.7 + aSeed.w * TAU)) * 0.006;
  P o;
  o.k = 1.0;
  o.xy = f.xy + g * f.z;
  o.col = aSeed.y < 0.08 ? GOLD : (abs(glitch) > 0.0 ? BAMBOO : CREAM);
  o.a = 0.85;
  o.size = 1.0 + aSeed.w * 0.9;
  return o;
}

P scene(int id, float t) {
  vec4 f = uFrame[id];
  float p = uP[id];
  if (id == 0) return sMark(t, p, f);
  if (id == 1) return sPlanes(t, p, f);
  if (id == 2) return sCloud(t, p, f);
  if (id == 3) return sFlow(t, p, f);
  if (id == 4) return sHist(t, p, f);
  if (id == 5) return sChain(t, p, f);
  if (id == 6) return sDot(t, p, f);
  return sGlyph(t, p, f);
}

void main() {
  float t = uTime;
  P a = scene(uA, t);
  P b = scene(uB, t);

  float delay = 0.5 * clamp(a.xy.x / uRes.x, 0.0, 1.0) + 0.25 * aSeed.w;
  float m = clamp(uMix * 1.75 - delay, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);

  vec2 xy = mix(a.xy, b.xy, m);
  vec2 dir = b.xy - a.xy;
  xy += vec2(-dir.y, dir.x) * sin(m * PI) * (aSeed.x - 0.5) * 0.35;
  vec3 col = mix(a.col, b.col, m);
  float alpha = mix(a.a, b.a, m) * (1.0 + sin(m * PI) * 0.35);
  float size = mix(a.size, b.size, m);

  if (uIntro < 1.0) {
    vec2 from = vec2(aSeed.z, fract(aSeed.y * 7.7)) * uRes * 1.3 - uRes * 0.15;
    float d = clamp(uIntro * 1.6 - aSeed.w * 0.6, 0.0, 1.0);
    d = 1.0 - pow(1.0 - d, 3.0);
    vec2 swirl = vec2(-(from.y - xy.y), from.x - xy.x) * sin(d * PI) * 0.25;
    xy = mix(from, xy, d) + swirl;
    alpha *= mix(0.12, 1.0, d);
  }

  vec2 dp = xy - uPointer.xy;
  float dl = length(dp);
  float push = 1.0 - smoothstep(0.0, 150.0, dl);
  xy += dp / max(dl, 1.0) * push * push * 42.0 * uPointer.z;
  alpha *= 1.0 + push * 0.7 * uPointer.z;

  if (uPulse.w > 0.0) {
    vec2 dq = xy - uPulse.xy;
    float L = length(dq);
    float w = (L - uPulse.z * 820.0) / 46.0;
    float wave = exp(-w * w) * uPulse.w;
    xy += dq / max(L, 1.0) * wave * 30.0;
    alpha *= 1.0 + wave * 1.4;
  }

  gl_Position = vec4(xy.x / uRes.x * 2.0 - 1.0, 1.0 - xy.y / uRes.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(1.0, size * uDpr * 2.6);
  if (uLines > 0.5) {
    vColor = vec4(mix(BAMBOO, CREAM, 0.35), 0.26 * uEdge * min(uIntro, 1.0));
  } else {
    vColor = vec4(col, clamp(alpha, 0.0, 1.6));
  }
}`;

  const PARTICLE_FS = `#version 300 es
precision mediump float;
in vec4 vColor;
uniform highp float uLines;
out vec4 outColor;
void main() {
  if (uLines > 0.5) {
    outColor = vec4(vColor.rgb * vColor.a, 1.0);
    return;
  }
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float v = (exp(-d * 7.0) + exp(-d * 2.2) * 0.22) * vColor.a;
  outColor = vec4(vColor.rgb * v, 1.0);
}`;

  const BG_VS = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

  const BG_FS = `#version 300 es
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec4 uFocus;
out vec4 outColor;
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float m = min(uRes.x, uRes.y);
  vec2 q = (fc - uFocus.xy) / m;
  vec3 col = vec3(0.020, 0.052, 0.043);
  col += vec3(0.063, 0.349, 0.263) * exp(-dot(q, q) * 3.0) * 0.42;
  vec2 np = fc / m * 1.4;
  float n = fbm(np + vec2(uTime * 0.018, -uTime * 0.011));
  float n2 = fbm(np * 0.6 - vec2(uTime * 0.01, uTime * 0.02) + n * 1.3);
  vec3 aur = mix(vec3(0.063, 0.349, 0.263), vec3(0.87, 0.7, 0.35), uFocus.w);
  col += aur * smoothstep(0.48, 0.92, n2) * 0.11;
  vec2 v = (fc - 0.5 * uRes) / m;
  col *= 1.0 - 0.62 * smoothstep(0.35, 1.05, length(v));
  col += (hash(fc + fract(uTime * 7.0) * 311.0) - 0.5) * 0.028;
  outColor = vec4(col, 1.0);
}`;

  /* ---------- WebGL ------------------------------------------------------------------- */

  let data = null;
  let G = null;

  function createGL() {
    if (!canvas) return null;
    let gl = null;
    try {
      gl = canvas.getContext("webgl2", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      gl = null;
    }
    if (!gl) return null;

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        console.warn(gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };
    const program = (vsSource, fsSource, names) => {
      const vs = compile(gl.VERTEX_SHADER, vsSource);
      const fs = compile(gl.FRAGMENT_SHADER, fsSource);
      if (!vs || !fs) return null;
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
        console.warn(gl.getProgramInfoLog(prog));
        return null;
      }
      const u = {};
      for (const name of names) u[name] = gl.getUniformLocation(prog, name);
      return { prog, u };
    };

    const particles = program(PARTICLE_VS, PARTICLE_FS, [
      "uRes",
      "uDpr",
      "uTime",
      "uA",
      "uB",
      "uMix",
      "uFrame",
      "uP",
      "uTilt",
      "uPointer",
      "uPulse",
      "uIntro",
      "uStage",
      "uNodeX",
      "uNodeY",
      "uNodeR",
      "uHist",
      "uBins",
      "uBand",
      "uTrickle",
      "uLines",
      "uEdge",
    ]);
    const backdrop = program(BG_VS, BG_FS, ["uRes", "uTime", "uFocus"]);
    if (!particles || !backdrop) return null;

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const attribute = (location, array, size) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };
    attribute(0, data.seed, 4);
    attribute(1, data.cloud, 4);
    attribute(2, data.hist, 4);
    attribute(3, data.glyph, 2);
    const elements = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.edges, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    const empty = gl.createVertexArray();

    return { gl, particles, backdrop, vao, empty, edgeCount: data.edges.length };
  }

  /* ---------- layout ------------------------------------------------------------------ */

  const view = { w: 1, h: 1, dpr: 1, wide: true };
  const geo = {
    frames: new Float32Array(32),
    focus: Array.from({ length: 8 }, () => [0, 0]),
    hist: [0, 0, 1, 1],
    histTop: 0,
    nodeX: new Float32Array(4),
    nodeY: new Float32Array(4),
    nodeR: 30,
  };

  function figureArea(act) {
    const { w, h } = view;
    const copy = act?.querySelector(".copy");
    if (view.wide) {
      let left = w * 0.46;
      if (copy) {
        const rect = copy.getBoundingClientRect();
        if (rect.width) left = rect.right + w * 0.05;
      }
      left = clamp(left, w * 0.4, w * 0.62);
      return { left, right: w * 0.95, top: h * 0.12, bottom: h * 0.88 };
    }
    let bottom = h * 0.5;
    if (copy) bottom = clamp(copy.offsetTop - 14, h * 0.3, h * 0.62);
    return { left: w * 0.06, right: w * 0.94, top: 70, bottom };
  }

  function layout() {
    const { w, h } = view;
    const f = geo.frames;
    const set = (i, a, b, c, d = 0) => {
      f[i * 4] = a;
      f[i * 4 + 1] = b;
      f[i * 4 + 2] = c;
      f[i * 4 + 3] = d;
      geo.focus[i] = [a, b];
    };

    if (lost) {
      const s = view.wide ? Math.min(w * 0.24, h * 0.46) : Math.min(w * 0.44, h * 0.3);
      set(S.GLYPH, view.wide ? w * 0.64 : w * 0.5, view.wide ? h * 0.4 : h * 0.3, s);
      return;
    }

    const areas = acts.map(figureArea);
    const box = (a) => ({
      cx: (a.left + a.right) / 2,
      cy: (a.top + a.bottom) / 2,
      hw: (a.right - a.left) / 2,
      hh: (a.bottom - a.top) / 2,
    });

    let b = box(areas[0]);
    if (view.wide) set(S.MARK, w * 0.69, h * 0.5, Math.min(w * 0.2, h * 0.31));
    else set(S.MARK, w / 2, b.cy, Math.min(w * 0.34, b.hh * 0.78));

    b = box(areas[1]);
    set(S.PLANES, b.cx, b.cy, view.wide ? Math.min(b.hw * 0.86, b.hh * 0.86, h * 0.36) : Math.min(b.hw * 0.74, b.hh * 0.8));

    b = box(areas[2]);
    set(S.CLOUD, b.cx, b.cy, Math.min(b.hw * 0.9, b.hh * 0.95, view.wide ? h * 0.4 : 999));

    const a3 = areas[3];
    b = box(a3);
    set(S.FLOW, a3.left, b.cy, a3.right - a3.left, Math.min(b.hh * 0.62, (a3.right - a3.left) * 0.2));
    geo.focus[S.FLOW] = [b.cx, b.cy];

    const a4 = areas[4];
    const histW = a4.right - a4.left;
    const span = a4.bottom - a4.top;
    const base = view.wide ? h * 0.8 : a4.bottom - 22;
    const top = view.wide ? h * 0.4 : a4.top + span * 0.4;
    const hopperR = Math.min(histW * 0.15, (top - a4.top) * 0.42, 120);
    set(S.HIST, a4.left + histW / 2, view.wide ? h * 0.2 : a4.top + span * 0.17, hopperR);
    geo.hist = [a4.left, base, histW, (base - top) / data.maxRow];
    geo.histTop = top;
    geo.focus[S.HIST] = [a4.left + histW / 2, (top + base) / 2];

    const a5 = areas[5];
    b = box(a5);
    const nodeSpan = a5.right - a5.left;
    for (let k = 0; k < 4; k += 1) {
      geo.nodeX[k] = a5.left + ((k + 0.5) / 4) * nodeSpan;
      geo.nodeY[k] = b.cy + (view.wide ? (k % 2 ? -1 : 1) * h * 0.06 : 0);
    }
    geo.nodeR = view.wide ? Math.min(nodeSpan / 8 * 0.62, h * 0.1) : Math.min(w * 0.085, b.hh * 0.42);
    set(S.CHAIN, b.cx, b.cy, geo.nodeR);

    set(S.DOT, w / 2, h / 2, 1);
  }

  function resize() {
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.wide = view.w >= 900;
    view.dpr = Math.min(window.devicePixelRatio || 1, view.wide ? 2 : 1.75);
    if (G) {
      canvas.width = Math.max(1, Math.round(view.w * view.dpr));
      canvas.height = Math.max(1, Math.round(view.h * view.dpr));
    }
    if (data) layout();
    measure();
  }

  /* ---------- scroll model -------------------------------------------------------------- */

  const state = {
    blend: 0,
    blendTarget: 0,
    p: new Float32Array(8),
    pTarget: new Float32Array(8),
    stage: 0,
    stageTarget: 0,
    intro: 1,
    introStart: 0,
    portal: 0,
    tilt: [0, 0],
    tiltTarget: [0, 0],
    pointer: [-9999, -9999],
    pointerTarget: [-9999, -9999],
    pointerOn: 0,
    pointerOnTarget: 0,
    pulse: { x: 0, y: 0, start: -1e9 },
    active: -1,
    covered: false,
    lensHot: false,
  };
  let metrics = [];
  let archiveTop = Infinity;
  let innerTop = Infinity;
  const varCache = new Map();

  function setVar(el, name, value) {
    const key = `${el.id}:${name}`;
    const rounded = Math.round(value * 1000) / 1000;
    if (varCache.get(key) === rounded) return;
    varCache.set(key, rounded);
    el.style.setProperty(name, String(rounded));
  }

  function measure() {
    const sy = window.scrollY;
    metrics = acts.map((el) => {
      const top = el.getBoundingClientRect().top + sy;
      const height = el.offsetHeight;
      return { top, height, hold: Math.max(1, height - view.h) };
    });
    if (archive) archiveTop = archive.getBoundingClientRect().top + sy;
    if (archiveInner) innerTop = archiveInner.getBoundingClientRect().top + sy;
    readScroll();
  }

  function readScroll() {
    const y = window.scrollY;
    const vh = view.h;
    let blend = 0;
    metrics.forEach((m, i) => {
      const rel = y - m.top;
      let p = 0;
      let out = 0;
      if (rel >= m.hold) {
        p = 1;
        out = clamp((rel - m.hold) / (vh * 0.7), 0, 1);
      } else if (rel > 0) {
        p = rel / m.hold;
      }
      state.pTarget[i] = p;
      setVar(acts[i], "--p", p);
      setVar(acts[i], "--out", out);
      if (rel >= 0) blend = rel <= m.hold ? i : i + clamp((rel - m.hold) / vh, 0, 1);
    });
    state.blendTarget = clamp(blend, 0, LAST);

    if (archive) {
      const g = clamp((y - archiveTop) / (vh * 0.95), 0, 1);
      state.portal = g;
      const maxR = Math.hypot(view.w / 2, vh / 2) + 12;
      const r = maxR * g * g;
      const open = g >= 1;
      archive.classList.toggle("is-open", open);
      if (!open) {
        archive.style.setProperty("--r", `${r.toFixed(1)}px`);
        archive.style.setProperty("--cy", `${(vh / 2 - (archiveTop - y)).toFixed(1)}px`);
      }
      if (rim) {
        const show = g > 0 && !open;
        rim.style.opacity = show ? String(1 - g ** 3) : "0";
        if (show) {
          rim.style.width = `${(r * 2).toFixed(1)}px`;
          rim.style.height = `${(r * 2).toFixed(1)}px`;
          rim.style.transform = `translate3d(${(view.w / 2 - r).toFixed(1)}px, ${(vh / 2 - r).toFixed(1)}px, 0)`;
        }
      }
      body.classList.toggle("on-paper", g >= 0.97);
      const covered = open;
      if (covered !== state.covered) {
        state.covered = covered;
        if (!covered) wake();
      }
    }

    if (progressBar) {
      const max = Math.max(1, document.documentElement.scrollHeight - vh);
      progressBar.style.transform = `scaleX(${clamp(y / max, 0, 1).toFixed(4)})`;
    }
    syncChapter();
    syncChain();
    if (reduced) requestRender();
  }

  /* ---------- chapter, rail and HUD ------------------------------------------------------ */

  let introHold = false;

  function syncChapter() {
    if (lost || !acts.length) return;
    const index = clamp(Math.floor(state.blendTarget + 0.35), 0, LAST);
    railLinks.forEach((link, i) => {
      const fill = i < index ? 1 : i === index ? (i < acts.length ? state.pTarget[i] : state.portal) : 0;
      link.style.setProperty("--fill", fill.toFixed(3));
    });
    if (index === state.active) return;
    state.active = index;
    acts.forEach((el, i) => el.classList.toggle("is-active", i === index && !introHold));
    railLinks.forEach((link, i) => {
      if (i === index) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    const section = index < acts.length ? acts[index] : archive;
    const label = section?.dataset.label || "";
    if (hudNow) hudNow.textContent = String(index).padStart(2, "0");
    if (hudLabel) hudLabel.textContent = label;
    if (hudCount) hudCount.style.opacity = index < acts.length ? "1" : "0";
    if (live) live.textContent = label;
  }

  /* ---------- evidence chain ------------------------------------------------------------- */

  const chainButtons = chain ? [...chain.querySelectorAll("button[data-stage]")] : [];
  const chainPanels = chain ? [...chain.querySelectorAll(".chain-copy")] : [];
  const chainIndex = acts.findIndex((el) => el.id === "chain");
  let stageIndex = -1;
  let manual = null;

  function setStage(index) {
    index = clamp(index, 0, chainButtons.length - 1);
    if (index === stageIndex) return;
    stageIndex = index;
    chainButtons.forEach((button, i) => {
      const on = i === index;
      button.setAttribute("aria-pressed", on ? "true" : "false");
      button.closest(".chain-step")?.classList.toggle("is-active", on);
    });
    chainPanels.forEach((panel, i) => {
      panel.hidden = i !== index;
    });
    chain.style.setProperty("--stage", String(index));
    state.stageTarget = index;
    labels.forEach((label) => {
      if (label.scene === S.CHAIN) label.el.classList.toggle("is-hot", Number(label.i) === index);
    });
    if (reduced) requestRender();
  }

  function autoStage() {
    return chainIndex < 0 ? 0 : clamp(Math.floor(state.pTarget[chainIndex] * 4), 0, 3);
  }

  function syncChain() {
    if (!chain || chainIndex < 0) return;
    const auto = autoStage();
    if (manual && (Math.abs(state.blendTarget - chainIndex) > 0.9 || auto !== manual.at)) manual = null;
    if (!manual) setStage(auto);
  }

  if (chain) {
    chain.classList.add("is-enhanced");
    setStage(0);
    chain.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-stage]");
      if (!button) return;
      const index = chainButtons.indexOf(button);
      manual = { index, at: autoStage() };
      setStage(index);
    });
    chain.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const index = chainButtons.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      event.stopPropagation();
      const next = clamp(index + (event.key === "ArrowRight" ? 1 : -1), 0, chainButtons.length - 1);
      chainButtons[next].focus();
      manual = { index: next, at: autoStage() };
      setStage(next);
    });
  }

  /* ---------- tag filter in the archive --------------------------------------------------- */

  const filters = document.querySelector(".filters");
  if (filters) {
    filters.hidden = false;
    filters.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-tag]");
      if (!button) return;
      const tag = button.dataset.tag;
      filters.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === button ? "true" : "false"));
      document.querySelectorAll(".post").forEach((post) => {
        post.hidden = Boolean(tag) && !post.dataset.tags.split("|").includes(tag);
      });
    });
  }

  /* ---------- navigation: beats, rail, keys ------------------------------------------------ */

  let tween = null;

  function scrollToY(target) {
    const max = Math.max(0, document.documentElement.scrollHeight - view.h);
    const to = clamp(target, 0, max);
    const from = window.scrollY;
    if (Math.abs(to - from) < 2) return;
    if (reduced) {
      window.scrollTo(0, to);
      return;
    }
    tween = { from, to, start: performance.now(), dur: clamp((Math.abs(to - from) / view.h) * 380, 700, 1700) };
    wake();
  }

  function beats() {
    const list = [];
    metrics.forEach((m, i) => {
      if (i === chainIndex) for (let k = 0; k < 4; k += 1) list.push(m.top + m.hold * (k / 4 + 0.02));
      else list.push(m.top + (i === 0 ? 0 : 2));
    });
    if (archive) list.push(innerTop);
    return list;
  }

  function focusHeading(el) {
    const heading = el?.querySelector("h1, h2");
    if (!heading) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }

  function step(direction) {
    const y = window.scrollY;
    const list = beats();
    let target = null;
    if (direction > 0) target = list.find((b) => b > y + 4);
    else target = [...list].reverse().find((b) => b < y - 4);
    if (target == null) return;
    scrollToY(target);
    const sections = [...acts, archive].filter(Boolean);
    const owner = sections.find((el) => {
      const top = el === archive ? archiveTop : metrics[acts.indexOf(el)].top;
      const end = el === archive ? Infinity : top + el.offsetHeight;
      return target >= top - 4 && target < end;
    });
    focusHeading(owner);
  }

  railLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const id = link.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      event.preventDefault();
      scrollToY(el === archive ? innerTop : el.getBoundingClientRect().top + window.scrollY + (el === acts[0] ? 0 : 2));
      focusHeading(el);
    });
  });

  window.addEventListener("keydown", (event) => {
    if (lost || event.altKey || event.metaKey || event.ctrlKey) return;
    const target = event.target;
    if (target && (target.closest?.("input, textarea, select") || target.isContentEditable)) return;
    // Inside the article list the page scrolls natively; only "back" from its very top re-enters the show.
    if (archive && window.scrollY >= innerTop - 4) {
      const back = event.key === "ArrowUp" || event.key === "PageUp" || (event.key === " " && event.shiftKey);
      if (!back || window.scrollY > innerTop + 4) return;
    }
    const keys = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
    if (event.key === " " && event.shiftKey) {
      event.preventDefault();
      step(-1);
      return;
    }
    if (event.key === " " && target?.closest?.("button, a")) return;
    if (event.key in keys) {
      event.preventDefault();
      step(keys[event.key]);
    } else if (event.key === "Home") {
      event.preventDefault();
      scrollToY(0);
      focusHeading(acts[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      scrollToY(innerTop);
      focusHeading(archive);
    }
  });

  const cancelTween = () => {
    tween = null;
  };
  window.addEventListener("wheel", cancelTween, { passive: true });
  window.addEventListener("touchstart", cancelTween, { passive: true });

  /* ---------- pointer: lens, tilt, ripple --------------------------------------------------- */

  window.addEventListener(
    "pointermove",
    (event) => {
      state.tiltTarget = [(event.clientX / view.w) * 2 - 1, (event.clientY / view.h) * 2 - 1];
      if (event.pointerType === "mouse" || event.pressure > 0) {
        state.pointerTarget = [event.clientX, event.clientY];
        state.pointerOnTarget = 1;
        if (state.pointer[0] < -1000) state.pointer = [event.clientX, event.clientY];
      }
      state.lensHot = Boolean(event.target?.closest?.("a, button"));
      if (reduced) requestRender();
    },
    { passive: true },
  );
  document.addEventListener("pointerleave", () => {
    state.pointerOnTarget = 0;
  });
  window.addEventListener("blur", () => {
    state.pointerOnTarget = 0;
  });
  window.addEventListener(
    "pointerup",
    (event) => {
      if (event.pointerType !== "mouse") state.pointerOnTarget = 0;
    },
    { passive: true },
  );
  window.addEventListener(
    "pointerdown",
    (event) => {
      if (event.pointerType !== "mouse") {
        state.pointerTarget = [event.clientX, event.clientY];
        state.pointer = [event.clientX, event.clientY];
        state.pointerOnTarget = 1;
      }
      if (reduced || state.covered || body.classList.contains("on-paper")) return;
      if (event.target?.closest?.("a, button, .copy p, h1, h2")) return;
      state.pulse = { x: event.clientX, y: event.clientY, start: performance.now() };
      wake();
    },
    { passive: true },
  );

  /* ---------- figure labels (mirror the shader math for a handful of anchors) ------------------- */

  function planeAngles(pl, sep) {
    const target = pl === 0 ? [1.25, 0, 0.18] : pl === 1 ? [0.2, 1.15, 0] : [-0.5, -0.45, 0.6];
    return [lerp(1, target[0], sep), lerp(0, target[1], sep), lerp(0, target[2], sep)];
  }

  function planeOffset(pl, sep) {
    const o = pl === 0 ? [-0.05, -0.45, 0.1] : pl === 1 ? [0.52, 0.14, -0.1] : [-0.42, 0.4, -0.15];
    return o.map((x) => x * sep);
  }

  function labelPosition(label, t) {
    const f = geo.frames;
    const frame = (i) => [f[i * 4], f[i * 4 + 1], f[i * 4 + 2], f[i * 4 + 3]];
    const tilt = state.tilt;
    switch (label.scene) {
      case S.PLANES: {
        const pl = Number(label.i);
        const sep = smooth(0.05, 0.85, state.p[S.PLANES]);
        const ang = planeAngles(pl, sep);
        let v = [0.58, 0.58, 0];
        v = rz(ang[2], ry(ang[1], rx(ang[0], v)));
        const off = planeOffset(pl, sep);
        v = [v[0] + off[0], v[1] + off[1], v[2] + off[2]];
        v = ry(t * 0.05 + tilt[0] * 0.4, rx(-0.12 + tilt[1] * 0.25, v));
        return { xy: project(v, frame(S.PLANES)), alpha: 1 };
      }
      case S.CLOUD: {
        const c = CLUSTERS[Number(label.i)];
        const sep = smooth(0, 0.8, state.p[S.CLOUD]);
        let v = c.map((x) => x * lerp(0.1, 1, sep));
        v = ry(t * 0.08 + tilt[0] * 0.5, rx(0.22 + tilt[1] * 0.3, v));
        const xy = project(v, frame(S.CLOUD));
        xy[1] -= f[S.CLOUD * 4 + 2] * 0.3;
        return { xy, alpha: smooth(0.15, 0.6, state.p[S.CLOUD]) };
      }
      case S.FLOW: {
        const k = Number(label.i);
        const fr = frame(S.FLOW);
        const on = clamp(state.p[S.FLOW] * 5.6 - k, 0, 1);
        return { xy: [fr[0] + (0.14 + k * 0.165) * fr[2], fr[1] - fr[3] * 1.15 - 22], alpha: on };
      }
      case S.HIST: {
        const [left, base, width] = geo.hist;
        if (label.i === "band") {
          const band = bandWidth();
          return { band: true, left: left + ((3.2 - band) / 6.4) * width, right: left + ((3.2 + band) / 6.4) * width, top: geo.histTop, bottom: base, alpha: 1 };
        }
        const sigma = [-2, 0, 2][Number(label.i)];
        return { xy: [left + ((sigma + 3.2) / 6.4) * width, base + 16], alpha: 1 };
      }
      case S.CHAIN: {
        const k = Number(label.i);
        return { xy: [geo.nodeX[k], geo.nodeY[k] + geo.nodeR * 1.5 + 12], alpha: 1 };
      }
      default:
        return null;
    }
  }

  function bandWidth() {
    return 0.42 + 2.3 / Math.sqrt(1 + 30 * state.p[S.HIST]);
  }

  function placeLabels(t, A, B, mix) {
    const eased = smooth(0, 1, mix);
    const weight = (scene) => (A === scene ? 1 - eased : 0) + (B === scene && B !== A ? eased : 0);
    for (const label of labels) {
      const w = G ? weight(label.scene) * state.intro : 0;
      const pos = w > 0.02 ? labelPosition(label, t) : null;
      const alpha = pos ? clamp(w * pos.alpha, 0, 1) * smooth(0.25, 0.9, w) : 0;
      if (alpha < 0.01) {
        if (label.shown) {
          label.shown = false;
          label.el.classList.remove("is-shown");
          label.el.style.opacity = "0";
        }
        continue;
      }
      if (!label.shown) {
        label.shown = true;
        label.el.classList.add("is-shown");
      }
      let transform;
      if (pos.band) {
        const width = Math.max(2, pos.right - pos.left);
        label.el.style.width = `${width.toFixed(1)}px`;
        label.el.style.height = `${(pos.bottom - pos.top).toFixed(1)}px`;
        transform = `translate3d(${pos.left.toFixed(1)}px, ${pos.top.toFixed(1)}px, 0)`;
      } else {
        transform = `translate3d(${pos.xy[0].toFixed(1)}px, ${pos.xy[1].toFixed(1)}px, 0) translate(-50%, -50%)`;
      }
      if (transform !== label.last) {
        label.el.style.transform = transform;
        label.last = transform;
      }
      label.el.style.opacity = alpha.toFixed(3);
    }
  }

  /* ---------- render loop --------------------------------------------------------------- */

  let running = false;
  let pendingRender = false;

  function wake() {
    if (reduced) {
      requestRender();
      return;
    }
    if (running || document.hidden) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function requestRender() {
    if (pendingRender) return;
    pendingRender = true;
    requestAnimationFrame((now) => {
      pendingRender = false;
      frame(now);
    });
  }

  function loop(now) {
    if (document.hidden || reduced) {
      running = false;
      return;
    }
    frame(now);
    const idle = state.covered && !tween;
    if (idle) {
      running = false;
      return;
    }
    requestAnimationFrame(loop);
  }

  let lastNow = 0;
  const approach = (rate, dt) => 1 - Math.exp(-rate * dt);

  function frame(now) {
    const dt = clamp((now - (lastNow || now)) / 1000, 0, 0.25);
    lastNow = now;
    if (tween) {
      const k = clamp((now - tween.start) / tween.dur, 0, 1);
      window.scrollTo(0, lerp(tween.from, tween.to, easeInOut(k)));
      if (k >= 1) tween = null;
    }

    const t = reduced ? 0 : now / 1000;
    const k = (rate) => (reduced ? 1 : approach(rate, dt));
    state.blend += (state.blendTarget - state.blend) * k(8.5);
    if (Math.abs(state.blend - state.blendTarget) < 0.0005) state.blend = state.blendTarget;
    const kp = k(7.5);
    for (let i = 0; i < 8; i += 1) state.p[i] += (state.pTarget[i] - state.p[i]) * kp;
    state.stage += (state.stageTarget - state.stage) * k(5);
    const kt = reduced ? 0 : approach(2.5, dt);
    state.tilt[0] += (state.tiltTarget[0] - state.tilt[0]) * kt;
    state.tilt[1] += (state.tiltTarget[1] - state.tilt[1]) * kt;
    const kq = approach(15, dt);
    state.pointer[0] += (state.pointerTarget[0] - state.pointer[0]) * kq;
    state.pointer[1] += (state.pointerTarget[1] - state.pointer[1]) * kq;
    state.pointerOn += (state.pointerOnTarget - state.pointerOn) * approach(5, dt);
    if (!reduced && state.intro < 1) state.intro = clamp((now - state.introStart) / 2800, 0, 1);

    let A;
    let B;
    let mix;
    if (lost) {
      A = S.GLYPH;
      B = S.GLYPH;
      mix = 0;
    } else {
      A = Math.floor(state.blend);
      B = Math.min(A + 1, LAST);
      mix = state.blend - A;
      if (reduced) {
        if (mix >= 0.5) A = B;
        mix = 0;
        B = A;
      }
    }

    if (lens && finePointer) {
      lens.style.transform = `translate3d(${state.pointer[0].toFixed(1)}px, ${state.pointer[1].toFixed(1)}px, 0)`;
      lens.classList.toggle("is-on", !reduced && state.pointerOnTarget > 0.5 && !body.classList.contains("on-paper"));
      lens.classList.toggle("is-hot", state.lensHot);
    }

    if (G && !state.covered) draw(t, A, B, mix, now);
    placeLabels(t, A, B, mix);
  }

  function draw(t, A, B, mix, now) {
    const { gl, particles, backdrop } = G;
    gl.viewport(0, 0, canvas.width, canvas.height);

    const eased = smooth(0, 1, mix);
    const fa = geo.focus[A];
    const fb = geo.focus[B];
    gl.disable(gl.BLEND);
    gl.useProgram(backdrop.prog);
    gl.uniform2f(backdrop.u.uRes, canvas.width, canvas.height);
    gl.uniform1f(backdrop.u.uTime, t);
    gl.uniform4f(
      backdrop.u.uFocus,
      lerp(fa[0], fb[0], eased) * view.dpr,
      lerp(fa[1], fb[1], eased) * view.dpr,
      0,
      lerp(WARM[A], WARM[B], eased),
    );
    gl.bindVertexArray(G.empty);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.useProgram(particles.prog);
    const u = particles.u;
    gl.uniform2f(u.uRes, view.w, view.h);
    gl.uniform1f(u.uDpr, view.dpr);
    gl.uniform1f(u.uTime, t);
    gl.uniform1i(u.uA, A);
    gl.uniform1i(u.uB, B);
    gl.uniform1f(u.uMix, mix);
    gl.uniform4fv(u.uFrame, geo.frames);
    gl.uniform1fv(u.uP, state.p);
    gl.uniform2f(u.uTilt, state.tilt[0], state.tilt[1]);
    gl.uniform3f(u.uPointer, state.pointer[0], state.pointer[1], reduced ? 0 : state.pointerOn);
    const age = (now - state.pulse.start) / 1000;
    gl.uniform4f(u.uPulse, state.pulse.x, state.pulse.y, age, age < 1.6 ? 1 - age / 1.6 : 0);
    gl.uniform1f(u.uIntro, state.intro);
    gl.uniform1f(u.uStage, state.stage);
    gl.uniform4fv(u.uNodeX, geo.nodeX);
    gl.uniform4fv(u.uNodeY, geo.nodeY);
    gl.uniform1f(u.uNodeR, geo.nodeR);
    gl.uniform4f(u.uHist, geo.hist[0], geo.hist[1], geo.hist[2], geo.hist[3]);
    gl.uniform1f(u.uBins, data.bins);
    gl.uniform1f(u.uBand, bandWidth());
    gl.uniform1f(u.uTrickle, reduced ? 0 : 0.025);
    gl.bindVertexArray(G.vao);

    // Edges follow particles whose morph timing differs, so they show only once the cloud is settled.
    const settled = A === S.CLOUD ? 1 - smooth(0, 0.12, mix) : B === S.CLOUD ? smooth(0.86, 1, mix) : 0;
    const edge = settled * smooth(0.1, 0.7, state.p[S.CLOUD]);
    if (edge > 0.01 && G.edgeCount) {
      gl.uniform1f(u.uLines, 1);
      gl.uniform1f(u.uEdge, edge);
      gl.drawElements(gl.LINES, G.edgeCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.uniform1f(u.uLines, 0);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  /* ---------- boot ------------------------------------------------------------------- */

  data = buildParticles();
  G = createGL();
  if (!G) {
    root.classList.add("no-gl");
    // A context that failed to compile would paint black; a fresh canvas shows the CSS field instead.
    canvas?.replaceWith(canvas.cloneNode(false));
  }

  canvas?.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    G = null;
    root.classList.add("no-gl");
  });
  canvas?.addEventListener("webglcontextrestored", () => {
    G = createGL();
    if (G) {
      root.classList.remove("no-gl");
      resize();
      wake();
    }
  });

  window.addEventListener("scroll", readScroll, { passive: true });
  let resizeQueued = false;
  window.addEventListener("resize", () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
      if (reduced) requestRender();
    });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });
  motionQuery.addEventListener?.("change", (event) => {
    reduced = event.matches;
    if (reduced) {
      state.intro = 1;
      tween = null;
      requestRender();
    } else {
      wake();
    }
  });
  document.fonts?.ready.then(() => {
    resize();
    if (reduced) requestRender();
  });

  resize();

  const atTop = window.scrollY < 8 && !window.location.hash;
  if (!reduced && atTop) {
    state.intro = 0;
    state.introStart = performance.now() + 120;
    if (!lost) {
      introHold = true;
      state.active = -1;
      syncChapter();
      window.setTimeout(() => {
        introHold = false;
        state.active = -1;
        syncChapter();
      }, 650);
    }
  } else {
    state.intro = 1;
    state.blend = state.blendTarget;
    state.p.set(state.pTarget);
    state.stage = state.stageTarget;
  }

  if (lostMain) window.setTimeout(() => lostMain.classList.add("is-active"), reduced ? 0 : 500);

  if (reduced) requestRender();
  else wake();
})();
