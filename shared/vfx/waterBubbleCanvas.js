export function startWaterBubble(canvas) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let t = 0;

  function syncSize() {
    const box = canvas.parentElement;
    if (!box) return;
    const w = box.clientWidth || 160;
    const h = box.clientHeight || 160;
    canvas.width = w;
    canvas.height = h;
  }

  syncSize();
  window.addEventListener("resize", syncSize);

  const W = () => canvas.width;
  const H = () => canvas.height;
  const cx = () => W() / 2;
  const cy = () => H() / 2;
  const R = () => Math.min(W(), H()) / 2 - 8;

  // ───────── BUBBLES ─────────
  const bubbles = Array.from({ length: 18 }, () => ({
    x: 0,
    y: 0,
    r: Math.random() * 4 + 1.5,
    vy: Math.random() * 0.6 + 0.25,
    phase: Math.random() * Math.PI * 2,
    wSpeed: Math.random() * 0.04 + 0.015,
  }));

  function resetBubble(b, init = false) {
    const r = R();
    b.x = cx() + (Math.random() - 0.5) * r * 1.1;
    b.y = init
      ? cy() + Math.random() * r * 0.9
      : cy() + r * 0.7 + Math.random() * r * 0.15;
  }

  bubbles.forEach((b) => resetBubble(b, true));

  // ───────── ORBITS ─────────
  const orbits = Array.from({ length: 22 }, () => ({
    angle: Math.random() * Math.PI * 2,
    distOffset: 12 + Math.random() * 28,
    size: Math.random() * 2.5 + 0.8,
    speed: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 0.008 + 0.003),
    phase: Math.random() * Math.PI * 2,
  }));

  // ───────── CAUSTICS ─────────
  const caustics = Array.from({ length: 9 }, () => ({
    ox: (Math.random() - 0.5) * 0.6,
    oy: Math.random() * 0.4 + 0.3,
    r: Math.random() * 22 + 10,
    phase: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.4 + 0.2,
  }));

  // ───────── CLIP PATH ─────────
  function clipToOrb() {
    ctx.beginPath();
    ctx.arc(cx(), cy(), R() - 2, 0, Math.PI * 2);
    ctx.clip();
  }

  // ───────── RENDER ─────────
  function render() {
    if (!running) return;

    const w = W();
    const h = H();
    const x0 = cx();
    const y0 = cy();
    const r = R();

    ctx.clearRect(0, 0, w, h);
    t += 0.016;

    // outer aura
    const aura = ctx.createRadialGradient(
      x0,
      y0 - 20,
      r * 0.5,
      x0,
      y0,
      r * 1.7,
    );
    aura.addColorStop(0, "rgba(30,120,220,.07)");
    aura.addColorStop(0.5, "rgba(50,160,255,.05)");
    aura.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(x0, y0, r * 1.7, 0, Math.PI * 2);
    ctx.fillStyle = aura;
    ctx.fill();
    ctx.restore();

    // orbiting sparkles
    orbits.forEach((o) => {
      o.angle += o.speed;
      const dist = r + o.distOffset;
      const sx = x0 + Math.cos(o.angle) * dist;
      const sy = y0 + Math.sin(o.angle) * dist * 0.72;
      const alpha = (0.3 + 0.6 * Math.abs(Math.sin(t * 1.8 + o.phase))) * 0.65;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${200 + Math.sin(o.phase + t) * 40},100%,80%)`;
      ctx.beginPath();
      ctx.arc(sx, sy, o.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // === INSIDE CLIP ===
    ctx.save();
    clipToOrb();

    // deep water base
    const base = ctx.createRadialGradient(x0 - 20, y0 + 20, 10, x0, y0, r);
    base.addColorStop(0, "#0a6eb5");
    base.addColorStop(0.4, "#0551a0");
    base.addColorStop(0.8, "#0a3580");
    base.addColorStop(1, "#051a55");
    ctx.fillStyle = base;
    ctx.fillRect(x0 - r, y0 - r, r * 2, r * 2);

    // caustic lights
    caustics.forEach((c) => {
      const cx2 = x0 + c.ox * r + Math.sin(t * c.speed + c.phase) * 18;
      const cy2 = y0 + c.oy * r + Math.cos(t * c.speed * 0.7 + c.phase) * 8;
      const g = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, c.r);
      g.addColorStop(0, "rgba(100,210,255,.16)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx2, cy2, c.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // animated wave surface
    const wl = y0 - r * 0.12 + Math.sin(t * 0.4) * 4;
    ctx.beginPath();
    ctx.moveTo(x0 - r, wl);
    for (let x = -r; x <= r; x += 2) {
      const y =
        wl +
        Math.sin((x / r) * 4.5 + t * 1.8) * 7 +
        Math.sin((x / r) * 8.2 + t * 1.1 + 1.3) * 4 +
        Math.sin((x / r) * 13 + t * 2.5 + 2.7) * 2;
      ctx.lineTo(x0 + x, y);
    }
    ctx.lineTo(x0 + r, y0 + r);
    ctx.lineTo(x0 - r, y0 + r);
    ctx.closePath();
    const waveSurface = ctx.createLinearGradient(x0, wl - 12, x0, wl + 30);
    waveSurface.addColorStop(0, "rgba(130,220,255,.55)");
    waveSurface.addColorStop(0.3, "rgba(60,170,240,.3)");
    waveSurface.addColorStop(1, "rgba(10,80,200,0)");
    ctx.fillStyle = waveSurface;
    ctx.fill();

    // secondary deep shimmer
    const shimmer = ctx.createLinearGradient(
      x0 - r * 0.7,
      y0,
      x0 + r * 0.6,
      y0 + r * 0.3,
    );
    shimmer.addColorStop(0, "rgba(80,180,255,.06)");
    shimmer.addColorStop(0.5, "rgba(150,230,255,.09)");
    shimmer.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shimmer;
    ctx.fillRect(x0 - r, y0, r * 2, r);

    // air bubbles
    bubbles.forEach((b) => {
      b.y -= b.vy;
      b.phase += b.wSpeed;
      b.x += Math.sin(b.phase) * 0.35;
      if (b.y < y0 - r * 0.88) resetBubble(b);

      const g = ctx.createRadialGradient(
        b.x - b.r * 0.35,
        b.y - b.r * 0.35,
        0,
        b.x,
        b.y,
        b.r,
      );
      g.addColorStop(0, "rgba(255,255,255,.75)");
      g.addColorStop(0.5, "rgba(180,235,255,.18)");
      g.addColorStop(1, "rgba(80,170,255,.08)");
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(200,240,255,.35)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    ctx.restore();
    // === END CLIP ===

    // glass rim
    ctx.beginPath();
    ctx.arc(x0, y0, r, 0, Math.PI * 2);
    const rimG = ctx.createLinearGradient(x0 - r, y0 - r, x0 + r, y0 + r);
    rimG.addColorStop(0, "rgba(200,240,255,.7)");
    rimG.addColorStop(0.3, "rgba(100,200,255,.35)");
    rimG.addColorStop(0.7, "rgba(40,110,220,.25)");
    rimG.addColorStop(1, "rgba(10,50,160,.5)");
    ctx.strokeStyle = rimG;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // inner halo rim
    ctx.beginPath();
    ctx.arc(x0, y0, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(180,235,255,.12)";
    ctx.lineWidth = 9;
    ctx.stroke();

    // === HIGHLIGHTS CLIP ===
    ctx.save();
    clipToOrb();

    // large top-left glow
    const hl = ctx.createRadialGradient(
      x0 - r * 0.38,
      y0 - r * 0.4,
      0,
      x0 - r * 0.28,
      y0 - r * 0.3,
      r * 0.5,
    );
    hl.addColorStop(0, "rgba(255,255,255,.38)");
    hl.addColorStop(0.5, "rgba(255,255,255,.07)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(x0 - r * 0.28, y0 - r * 0.3, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = hl;
    ctx.fill();

    // tight specular dot
    const dot = ctx.createRadialGradient(
      x0 - r * 0.5,
      y0 - r * 0.5,
      0,
      x0 - r * 0.5,
      y0 - r * 0.5,
      r * 0.09,
    );
    dot.addColorStop(0, "rgba(255,255,255,.9)");
    dot.addColorStop(1, "rgba(255,255,255,0)");
    ctx.beginPath();
    ctx.arc(x0 - r * 0.5, y0 - r * 0.5, r * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = dot;
    ctx.fill();

    // bottom-right sub-reflection
    const br = ctx.createRadialGradient(
      x0 + r * 0.42,
      y0 + r * 0.42,
      0,
      x0 + r * 0.42,
      y0 + r * 0.42,
      r * 0.25,
    );
    br.addColorStop(0, "rgba(120,210,255,.1)");
    br.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.arc(x0 + r * 0.42, y0 + r * 0.42, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = br;
    ctx.fill();

    // thin specular arc (top edge)
    ctx.beginPath();
    ctx.arc(x0, y0, r - 3, Math.PI * 1.1, Math.PI * 1.7);
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
    // === END HIGHLIGHTS CLIP ===

    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", syncSize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
