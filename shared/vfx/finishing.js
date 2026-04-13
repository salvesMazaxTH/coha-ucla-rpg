function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FINISHING_VARIANTS = {
  obliterate: {
    crackColor: "rgba(140,210,255,0.9)",
    slashCore: "rgba(255,255,255,0.96)",
    slashGlow: "rgba(120,220,255,1)",
    slashTrail: "rgba(180,230,255,0.7)",
    particlePalette: ["rgba(230,230,240,0.9)", "rgba(180,215,255,0.85)"],
    flash: {
      enabled: true,
      duration: 520,
      inner: "rgba(200,240,255,1)",
      mid: "rgba(100,180,255,0.9)",
      outer: "rgba(40,80,180,0.6)",
      edge: "rgba(10,10,40,0)",
      crack: "rgba(200,235,255,0.95)",
      crackGlow: "rgba(100,200,255,1)",
    },
    blood: false,
  },

  // Isarelis execution: physical slash + blood accents, no magic blue flash.
  isarelis_finishing: {
    crackColor: "rgba(210,25,25,0.9)",
    slashCore: "rgba(255,250,250,0.96)",
    slashGlow: "rgba(210,40,40,0.85)",
    slashTrail: "rgba(255,120,120,0.7)",
    particlePalette: ["rgba(220,40,40,0.9)", "rgba(235,235,235,0.78)"],
    flash: { enabled: false },
    blood: true,
  },
};

function getVariantStyle(variant) {
  return FINISHING_VARIANTS[variant] || FINISHING_VARIANTS.obliterate;
}

export async function playFinishingEffect(
  championEl,
  { variant = "obliterate" } = {},
) {
  const wrapper = championEl.querySelector(".portrait-wrapper");
  if (!wrapper) return;

  const portraitEl = wrapper.querySelector(".portrait");
  if (!portraitEl) return;

  const imgEl = portraitEl.querySelector("img");
  if (!imgEl) return;

  const style = getVariantStyle(variant);
  const portraitRect = portraitEl.getBoundingClientRect();

  const crackOverlay = document.createElement("div");
  crackOverlay.classList.add("finishing-crack");
  crackOverlay.style.backgroundImage = `url("${generateCrackSVG(
    portraitRect.width,
    portraitRect.height,
    style.crackColor,
  )}")`;
  portraitEl.appendChild(crackOverlay);

  const canvas = document.createElement("canvas");
  canvas.classList.add("finishing-canvas");
  canvas.width = portraitRect.width;
  canvas.height = portraitRect.height;
  portraitEl.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    crackOverlay.remove();
    canvas.remove();
    return;
  }

  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

  portraitEl.classList.add("finishing-flash");
  await wait(70);
  imgEl.style.visibility = "hidden";
  await wait(280);
  portraitEl.classList.remove("finishing-flash");

  await playCutEffect(canvas, ctx, style);
  await Promise.all([
    shatterCanvas(canvas, ctx),
    explodeParticles(canvas, ctx, style.particlePalette),
  ]);

  crackOverlay.remove();
  canvas.remove();
}

function shatterCanvas(canvas, ctx) {
  return new Promise((resolve) => {
    const COLS = 7;
    const ROWS = 9;
    const W = canvas.width;
    const H = canvas.height;
    const CX = W / 2;
    const CY = H / 2;
    const cellW = W / COLS;
    const cellH = H / ROWS;

    const snap = document.createElement("canvas");
    snap.width = W;
    snap.height = H;
    snap.getContext("2d").drawImage(canvas, 0, 0);

    const fragments = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sx = c * cellW;
        const sy = r * cellH;
        const dirX = (sx + cellW / 2 - CX) / (W / 2);
        const dirY = (sy + cellH / 2 - CY) / (H / 2);
        const speed = 2.5 + Math.random() * 5;
        fragments.push({
          x: sx,
          y: sy,
          sx,
          sy,
          sw: cellW,
          sh: cellH,
          vx: dirX * speed + (Math.random() - 0.5) * 2,
          vy: dirY * speed - Math.random() * 4,
          rot: 0,
          vr: (Math.random() - 0.5) * 0.2,
          alpha: 1,
        });
      }
    }

    function loop() {
      ctx.clearRect(0, 0, W, H);
      let alive = false;

      for (const f of fragments) {
        if (f.alpha <= 0) continue;
        alive = true;

        f.x += f.vx;
        f.y += f.vy;
        f.vy += 0.12;
        f.vx *= 0.97;
        f.vy *= 0.97;
        f.rot += f.vr;
        f.alpha -= 0.01;

        ctx.save();
        ctx.globalAlpha = Math.max(0, f.alpha);
        ctx.translate(f.x + f.sw / 2, f.y + f.sh / 2);
        ctx.rotate(f.rot);
        ctx.drawImage(
          snap,
          f.sx,
          f.sy,
          f.sw,
          f.sh,
          -f.sw / 2,
          -f.sh / 2,
          f.sw,
          f.sh,
        );
        ctx.restore();
      }

      if (alive) requestAnimationFrame(loop);
      else resolve();
    }

    requestAnimationFrame(loop);
  });
}

function generateCrackSVG(w, h, strokeColor) {
  let lines = "";
  for (let i = 0; i < 12; i++) {
    const x1 = Math.random() * w;
    const y1 = Math.random() * h;
    const x2 = Math.random() * w;
    const y2 = Math.random() * h;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="1.5" opacity="0.9"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function playCutEffect(canvas, ctx, style) {
  const W = canvas.width;
  const H = canvas.height;
  const x1 = W * 0.12;
  const y1 = H * 0.28;
  const x2 = W * 0.88;
  const y2 = H * 0.72;
  const duration = 120;
  const start = performance.now();

  const snap = document.createElement("canvas");
  snap.width = W;
  snap.height = H;
  snap.getContext("2d").drawImage(canvas, 0, 0);

  await new Promise((resolve) => {
    function loop(now) {
      const p = Math.min((now - start) / duration, 1);
      const cx = x1 + (x2 - x1) * p;
      const cy = y1 + (y2 - y1) * p;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(snap, 0, 0);

      const grad = ctx.createLinearGradient(x1, y1, cx, cy);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.58, style.slashTrail);
      grad.addColorStop(1, style.slashCore);

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.6;
      ctx.shadowColor = style.slashGlow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = style.slashCore;
      ctx.fill();
      ctx.restore();

      if (style.blood) {
        drawBloodDroplets(ctx, cx, cy, p);
      }

      if (p < 1) requestAnimationFrame(loop);
      else resolve();
    }

    requestAnimationFrame(loop);
  });

  if (!style.flash?.enabled) return;

  await new Promise((resolve) => {
    const startTime = performance.now();
    const flashDuration = style.flash.duration;
    const cracks = Array.from({ length: 18 }, () => ({
      x1: Math.random() * W,
      y1: Math.random() * H,
      x2: Math.random() * W,
      y2: Math.random() * H,
    }));

    function fade(now) {
      const p = Math.min((now - startTime) / flashDuration, 1);
      const eased = 1 - p * p;

      ctx.save();
      ctx.globalAlpha = eased * 0.9;

      const grad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        0,
        W / 2,
        H / 2,
        W * 0.8,
      );
      grad.addColorStop(0, style.flash.inner);
      grad.addColorStop(0.3, style.flash.mid);
      grad.addColorStop(0.7, style.flash.outer);
      grad.addColorStop(1, style.flash.edge);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      ctx.globalAlpha = eased * 0.7;
      ctx.strokeStyle = style.flash.crack;
      ctx.lineWidth = 1.2;
      ctx.shadowColor = style.flash.crackGlow;
      ctx.shadowBlur = 8;
      for (const line of cracks) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }

      ctx.restore();

      if (p < 1) requestAnimationFrame(fade);
      else resolve();
    }

    requestAnimationFrame(fade);
  });
}

function drawBloodDroplets(ctx, x, y, progress) {
  const count = 3;
  const alpha = Math.max(0, 1 - progress * 0.85);
  for (let i = 0; i < count; i++) {
    const spread = 6 + Math.random() * 10;
    const dx = (Math.random() - 0.5) * spread;
    const dy = Math.random() * 8;
    const radius = 0.9 + Math.random() * 1.7;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(180,20,20,0.95)";
    ctx.fill();
    ctx.restore();
  }
}

class Particle {
  constructor(x, y, palette) {
    this.x = x + (Math.random() - 0.5) * 20;
    this.y = y + (Math.random() - 0.5) * 20;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    this.vx = Math.cos(angle) * speed * 0.45;
    this.vy = Math.sin(angle) * speed * 0.45 - 1.0;
    this.width = 2 + Math.random() * 3;
    this.height = 5 + Math.random() * 9;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.08;
    this.alpha = 1;
    this.gravity = -0.01;
    this.drag = 0.985;
    this.palette = palette;
  }

  step() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += this.gravity;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.rotation += this.rotationSpeed;
    this.alpha -= 0.006;
  }

  draw(ctx) {
    if (this.alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    const color = this.palette[Math.floor(Math.random() * this.palette.length)];
    ctx.fillStyle = color;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }
}

function explodeParticles(canvas, ctx, palette) {
  return new Promise((resolve) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const shards = Array.from(
      { length: 160 },
      () => new Particle(centerX, centerY, palette),
    );

    function loop() {
      shards.forEach((particle) => {
        particle.step();
        particle.draw(ctx);
      });

      if (shards.some((particle) => particle.alpha > 0)) {
        requestAnimationFrame(loop);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(loop);
  });
}

export async function playObliterateEffect(championEl) {
  return playFinishingEffect(championEl, { variant: "obliterate" });
}
