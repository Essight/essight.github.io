/*
 * Build-time generative emblem. Every article gets its own orbit figure, derived only from
 * its slug, so the same slug always draws the same picture. Pure SVG: no script, no request.
 */

function hash(text) {
  let h = 0x811c9dc5;
  for (const char of String(text)) {
    h ^= char.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (value) => Math.round(value * 100) / 100;

function onEllipse(ring, t) {
  const { rx, ry, phi } = ring;
  const c = Math.cos(phi);
  const s = Math.sin(phi);
  return [60 + rx * Math.cos(t) * c - ry * Math.sin(t) * s, 60 + rx * Math.cos(t) * s + ry * Math.sin(t) * c];
}

export function emblemSvg(slug, className = "") {
  const rand = rng(hash(slug));
  const count = 2 + Math.floor(rand() * 3);
  const base = rand() * Math.PI;
  const rings = Array.from({ length: count }, (_, index) => {
    const rx = 30 + rand() * 18;
    return {
      rx,
      ry: rx * (0.26 + rand() * 0.34),
      phi: base + (index * Math.PI) / count + (rand() - 0.5) * 0.35,
      tone: index % 3,
    };
  });

  const grid = [];
  for (let gx = 0; gx < 9; gx += 1) {
    for (let gy = 0; gy < 9; gy += 1) {
      const x = 12 + gx * 12;
      const y = 12 + gy * 12;
      if ((x - 60) ** 2 + (y - 60) ** 2 > 50 ** 2) continue;
      if (rand() < 0.55) continue;
      grid.push(`<circle cx="${x}" cy="${y}" r="0.9"/>`);
    }
  }

  const ellipses = rings
    .map(
      (ring) =>
        `<ellipse class="em-ring em-t${ring.tone}" cx="60" cy="60" rx="${r2(ring.rx)}" ry="${r2(ring.ry)}" transform="rotate(${r2((ring.phi * 180) / Math.PI)} 60 60)"/>`,
    )
    .join("");

  const dots = [];
  const dotCount = 7 + Math.floor(rand() * 8);
  for (let k = 0; k < dotCount; k += 1) {
    const ring = rings[Math.floor(rand() * rings.length)];
    const [x, y] = onEllipse(ring, rand() * Math.PI * 2);
    dots.push(`<circle class="em-t${ring.tone}" cx="${r2(x)}" cy="${r2(y)}" r="${r2(1.3 + rand() * 1.5)}"/>`);
  }

  const lead = rings[0];
  const [gx, gy] = onEllipse(lead, rand() * Math.PI * 2);
  const cls = ["emblem", className].filter(Boolean).join(" ");
  return `<svg class="${cls}" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g class="em-grid">${grid.join("")}</g><g class="em-spin">${ellipses}<g class="em-dots">${dots.join("")}</g><circle class="em-gold" cx="${r2(gx)}" cy="${r2(gy)}" r="3.4"/></g><circle class="em-core" cx="60" cy="60" r="2.2"/></svg>`;
}
