/* Method illustration for the homepage and 404. Fixed rules, not measurements. */
(() => {
  const canvas = document.getElementById("field");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lost = document.body.dataset.exhibit === "lost";
  document.documentElement.classList.add("js");

  const chapters = [...document.querySelectorAll(".chapter")];
  const railLinks = [...document.querySelectorAll(".rail a")];
  const live = document.querySelector(".rail-live");
  const progress = document.querySelector(".progress");
  const chain = document.querySelector(".chain");

  const view = { w: 1, h: 1, dpr: 1 };
  const pointer = { x: 0.68, y: 0.46, tx: 0.68, ty: 0.46 };
  let blend = 0;
  let blendTarget = 0;
  let active = -1;
  let running = false;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeField() {
    const count = window.innerWidth < 760 ? 78 : 150;
    const rand = mulberry32(0xe55147);
    const bands = [0, 1, 2];
    return Array.from({ length: count }, (_, index) => ({
      band: bands[index % 3],
      angle: rand() * Math.PI * 2,
      speed: (0.12 + rand() * 0.22) * (index % 2 === 0 ? 1 : -1),
      size: 1.05 + rand() * 1.7,
      wobble: rand() * Math.PI * 2,
    }));
  }

  let field = makeField();

  const clusters = [
    ["意图", 0.36, 0.4],
    ["措辞", 0.63, 0.34],
    ["约束", 0.44, 0.66],
    ["复述", 0.72, 0.6],
  ];
  const topoRand = mulberry32(20261126);
  const points = [];
  for (const [name, cx, cy] of clusters) {
    for (let k = 0; k < 16; k += 1) {
      const angle = topoRand() * Math.PI * 2;
      const radius = topoRand() ** 0.55 * 0.105;
      points.push({
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.82,
        hub: k === 0,
        name,
      });
    }
  }
  const edges = [];
  for (let i = 0; i < points.length; i += 1) {
    const nearest = [];
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const dx = points[i].x - points[j].x;
      const dy = points[i].y - points[j].y;
      nearest.push({ j, d: dx * dx + dy * dy });
    }
    nearest.sort((a, b) => a.d - b.d);
    for (let k = 0; k < 2; k += 1) {
      if (nearest[k].j > i) edges.push([i, nearest[k].j]);
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2);
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    view.dpr = dpr;
    canvas.width = Math.max(1, Math.round(view.w * dpr));
    canvas.height = Math.max(1, Math.round(view.h * dpr));
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    field = makeField();
  }

  function center() {
    const narrow = view.w < 760;
    return {
      x: view.w * (narrow ? 0.5 : 0.78),
      y: view.h * (narrow ? 0.32 : 0.52),
      unit: Math.min(view.w, view.h),
    };
  }

  function background(warm) {
    const g = ctx.createRadialGradient(
      view.w * 0.62,
      view.h * 0.42,
      20,
      view.w * 0.5,
      view.h * 0.5,
      Math.max(view.w, view.h) * 0.72,
    );
    g.addColorStop(0, warm ? "#1a1612" : "#12161a");
    g.addColorStop(0.5, "#0c0e12");
    g.addColorStop(1, "#07080b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function vignette() {
    const g = ctx.createRadialGradient(
      view.w * 0.58,
      view.h * 0.45,
      view.w * 0.15,
      view.w * 0.5,
      view.h * 0.5,
      Math.max(view.w, view.h) * 0.72,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawField(time, variant) {
    const fade = ctx.globalAlpha || 1;
    background(variant !== "dim");
    const { x: cx, y: cy, unit } = center();
    const radii = [unit * 0.12, unit * 0.2, unit * 0.28];
    const colors = ["#d7b07a", "#9ec9c2", "#f4efe4"];
    ctx.save();
    ctx.globalAlpha = fade * (variant === "dim" ? 0.4 : 1);
    radii.forEach((radius, band) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, radius * 1.35, radius, -0.3, 0, Math.PI * 2);
      ctx.strokeStyle = band === 0 ? "rgba(215,176,122,0.45)" : "rgba(244,239,228,0.16)";
      ctx.lineWidth = band === 0 ? 1.4 : 1;
      ctx.stroke();
    });

    const placed = field.map((particle) => {
      const radius = radii[particle.band];
      const angle = particle.angle + (reduced ? 0 : time * particle.speed);
      const breathe = reduced ? 0 : Math.sin(time * 0.7 + particle.wobble) * 6;
      const pullX = (pointer.x - 0.5) * (variant === "overture" ? 28 : 16);
      const pullY = (pointer.y - 0.5) * 16;
      return {
        x: cx + Math.cos(angle) * (radius * 1.35 + breathe) + pullX,
        y: cy + Math.sin(angle) * (radius + breathe * 0.6) + pullY,
        band: particle.band,
        size: particle.size,
      };
    });

    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        if (placed[i].band !== placed[j].band) continue;
        const dx = placed[i].x - placed[j].x;
        const dy = placed[i].y - placed[j].y;
        const dist = Math.hypot(dx, dy);
        const limit = variant === "overture" ? 78 : 64;
        if (dist > limit) continue;
        ctx.strokeStyle = `rgba(215,176,122,${(1 - dist / limit) * 0.28})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(placed[i].x, placed[i].y);
        ctx.lineTo(placed[j].x, placed[j].y);
        ctx.stroke();
      }
    }

    placed.forEach((particle) => {
      ctx.beginPath();
      ctx.fillStyle = colors[particle.band];
      ctx.globalAlpha = fade * (variant === "dim" ? 0.4 : 0.92);
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawTopology(time) {
    background(false);
    const narrow = view.w < 760;
    const left = narrow ? view.w * 0.08 : view.w * 0.42;
    const top = narrow ? view.h * 0.08 : view.h * 0.16;
    const width = narrow ? view.w * 0.84 : view.w * 0.5;
    const height = narrow ? view.h * 0.36 : view.h * 0.62;
    const drift = reduced ? 0 : Math.sin(time * 0.35) * 5;

    ctx.save();
    edges.forEach(([a, b]) => {
      const pa = points[a];
      const pb = points[b];
      ctx.strokeStyle = pa.name === pb.name ? "rgba(158,201,194,0.35)" : "rgba(244,239,228,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left + pa.x * width + drift, top + pa.y * height);
      ctx.lineTo(left + pb.x * width - drift, top + pb.y * height);
      ctx.stroke();
    });
    points.forEach((point) => {
      const x = left + point.x * width + (point.hub ? 0 : drift * 0.3);
      const y = top + point.y * height;
      ctx.beginPath();
      ctx.fillStyle = point.hub ? "#e7c27a" : "rgba(244,239,228,0.85)";
      ctx.arc(x, y, point.hub ? 3.2 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.font = "600 14px 'Segoe UI', 'PingFang SC', 'Noto Sans CJK SC', 'WenQuanYi Micro Hei', sans-serif";
    ctx.fillStyle = "rgba(244,239,228,0.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    clusters.forEach(([name, cx, cy]) => {
      ctx.fillText(name, left + cx * width, top + cy * height - 12);
    });
    ctx.restore();
  }

  function drawInterval(time) {
    background(true);
    const narrow = view.w < 760;
    const plot = {
      x: narrow ? view.w * 0.08 : view.w * 0.4,
      y: narrow ? view.h * 0.1 : view.h * 0.24,
      w: narrow ? view.w * 0.84 : view.w * 0.48,
      h: narrow ? view.h * 0.3 : view.h * 0.46,
    };
    const gauss = (x) => Math.exp(-0.5 * x * x);
    const xOf = (sigma) => plot.x + ((sigma + 3.2) / 6.4) * plot.w;
    const yOf = (density) => plot.y + plot.h - density * plot.h * 0.92;

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= 120; i += 1) {
      const sigma = -3.2 + (6.4 * i) / 120;
      const x = xOf(sigma);
      const y = yOf(gauss(sigma));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(xOf(3.2), plot.y + plot.h);
    ctx.lineTo(xOf(-3.2), plot.y + plot.h);
    ctx.closePath();
    ctx.fillStyle = "rgba(244,239,228,0.04)";
    ctx.fill();

    ctx.beginPath();
    const bandL = -1.15;
    const bandR = 1.15;
    ctx.moveTo(xOf(bandL), plot.y + plot.h);
    for (let i = 0; i <= 80; i += 1) {
      const sigma = bandL + ((bandR - bandL) * i) / 80;
      ctx.lineTo(xOf(sigma), yOf(gauss(sigma)));
    }
    ctx.lineTo(xOf(bandR), plot.y + plot.h);
    ctx.closePath();
    ctx.fillStyle = "rgba(215,176,122,0.28)";
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i <= 160; i += 1) {
      const sigma = -3.2 + (6.4 * i) / 160;
      const x = xOf(sigma);
      const y = yOf(gauss(sigma));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#f4efe4";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.strokeStyle = "rgba(244,239,228,0.35)";
    ctx.beginPath();
    ctx.moveTo(plot.x, plot.y + plot.h);
    ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
    ctx.stroke();

    const scanSigma = reduced ? 0 : -3.2 + ((time * 0.35) % 6.4);
    ctx.strokeStyle = "rgba(158,201,194,0.85)";
    ctx.beginPath();
    ctx.moveTo(xOf(scanSigma), plot.y);
    ctx.lineTo(xOf(scanSigma), plot.y + plot.h);
    ctx.stroke();

    ctx.font = "12px 'Segoe UI', 'Iowan Old Style', Palatino, serif";
    ctx.fillStyle = "rgba(244,239,228,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    [-2, 0, 2].forEach((tick) => {
      ctx.fillText(tick === 0 ? "0" : `${tick}σ`, xOf(tick), plot.y + plot.h + 8);
    });
    ctx.restore();
  }

  const scenes = lost
    ? [(time) => drawField(time, "overture")]
    : [
        (time) => drawField(time, "overture"),
        (time) => drawField(time, "signal"),
        drawTopology,
        drawInterval,
        (time) => drawField(time, "dim"),
        (time) => drawField(time, "dim"),
      ];

  function render(time) {
    const seconds = reduced ? 0 : time / 1000;
    if (!reduced) {
      pointer.x += (pointer.tx - pointer.x) * 0.06;
      pointer.y += (pointer.ty - pointer.y) * 0.06;
      blend += (blendTarget - blend) * 0.085;
      if (Math.abs(blend - blendTarget) < 0.001) blend = blendTarget;
    } else {
      blend = blendTarget;
    }

    const last = scenes.length - 1;
    const i0 = Math.max(0, Math.min(last, Math.floor(blend)));
    const i1 = Math.min(last, i0 + 1);
    const mix = i0 === i1 ? 0 : blend - i0;

    ctx.clearRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.globalAlpha = i0 === i1 ? 1 : 1 - mix;
    scenes[i0](seconds);
    ctx.restore();
    if (mix > 0.01) {
      ctx.save();
      ctx.globalAlpha = mix;
      scenes[i1](seconds);
      ctx.restore();
    }
    vignette();

    const fade = blend < 4.4 ? 1 : Math.max(0, 1 - (blend - 4.4) / 0.6);
    canvas.style.opacity = lost ? "1" : String(fade);
    syncChapter();
  }

  function syncChapter() {
    if (!chapters.length) return;
    const index = Math.max(0, Math.min(chapters.length - 1, Math.round(blend)));
    if (index === active) return;
    active = index;
    const id = chapters[index].id;
    railLinks.forEach((link) => {
      const on = link.getAttribute("href") === `#${id}`;
      if (on) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    document.body.classList.toggle("on-paper", id === "archive");
    if (live) {
      const label = chapters[index].dataset.label || "";
      live.textContent = label;
    }
  }

  function measure() {
    if (!chapters.length) {
      blendTarget = 0;
      return;
    }
    const y = window.scrollY + window.innerHeight * 0.42;
    let next = chapters.length - 1;
    for (let i = 0; i < chapters.length; i += 1) {
      const top = chapters[i].getBoundingClientRect().top + window.scrollY;
      const bottom =
        i + 1 < chapters.length
          ? chapters[i + 1].getBoundingClientRect().top + window.scrollY
          : top + chapters[i].offsetHeight;
      if (y < bottom) {
        const local = (y - top) / Math.max(1, bottom - top);
        next = i + Math.max(0, (local - 0.58) / 0.42);
        break;
      }
    }
    blendTarget = Math.max(0, Math.min(chapters.length - 1, next));
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, window.scrollY / max)})`;
    if (reduced) render(0);
  }

  function go(index, focusHeading) {
    const chapter = chapters[Math.max(0, Math.min(chapters.length - 1, index))];
    if (!chapter) return;
    chapter.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    if (focusHeading) {
      const heading = chapter.querySelector("h1, h2");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
  }

  function currentIndex() {
    return Math.max(0, Math.min(chapters.length - 1, Math.round(blend)));
  }

  if (chain) {
    const buttons = [...chain.querySelectorAll("button[data-stage]")];
    const panels = [...chain.querySelectorAll(".chain-copy")];
    const setStage = (stage) => {
      buttons.forEach((button, index) => {
        const on = button.dataset.stage === stage;
        button.setAttribute("aria-pressed", on ? "true" : "false");
        button.closest(".chain-step")?.classList.toggle("is-active", on);
        if (on) chain.style.setProperty("--stage", String(index));
      });
      panels.forEach((panel) => {
        if (panel.dataset.stage === stage) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
      });
    };
    chain.classList.add("is-enhanced");
    setStage("observation");
    chain.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-stage]");
      if (!button) return;
      setStage(button.dataset.stage);
    });
    chain.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const buttons = [...chain.querySelectorAll("button[data-stage]")];
      const index = buttons.findIndex((button) => button === document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      event.stopPropagation();
      const next = event.key === "ArrowRight" ? index + 1 : index - 1;
      const button = buttons[Math.max(0, Math.min(buttons.length - 1, next))];
      button.focus();
      setStage(button.dataset.stage);
    });
  }

  window.addEventListener(
    "pointermove",
    (event) => {
      if (reduced) return;
      pointer.tx = event.clientX / Math.max(1, window.innerWidth);
      pointer.ty = event.clientY / Math.max(1, window.innerHeight);
    },
    { passive: true },
  );

  window.addEventListener(
    "keydown",
    (event) => {
      if (lost || event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      if (target && target.closest(".chain") && (event.key === "ArrowRight" || event.key === "ArrowLeft")) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "PageDown" && event.key !== "PageUp" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      event.preventDefault();
      if (event.key === "Home") go(0, true);
      else if (event.key === "End") go(chapters.length - 1, true);
      else {
        const delta = event.key === "ArrowDown" || event.key === "PageDown" ? 1 : -1;
        go(currentIndex() + delta, true);
      }
    },
  );

  window.addEventListener("scroll", measure, { passive: true });
  window.addEventListener("resize", () => {
    resize();
    measure();
    if (reduced) render(0);
  });

  resize();
  measure();
  render(0);

  if (!reduced) {
    const loop = (time) => {
      if (document.hidden) {
        running = false;
        return;
      }
      render(time);
      requestAnimationFrame(loop);
    };
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && !running) {
        running = true;
        requestAnimationFrame(loop);
      }
    });
    running = true;
    requestAnimationFrame(loop);
  }
})();
