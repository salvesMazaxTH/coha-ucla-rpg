export function startFrozenCanvas(canvas) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let time = 0;

  const box = canvas.parentElement;

  function syncSize() {
    const w = box.clientWidth;
    const h = box.clientHeight;

    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
  }

  syncSize();
  window.addEventListener("resize", syncSize);

  const W = () => canvas.width;
  const H = () => canvas.height;

  /* ───────── ICE CRYSTAL FRACTAL ───────── */

  function drawCrystalBranch(cx, cy, angle, len, depth, alpha) {
    if (depth === 0 || len < 1.5) return;

    const ex = cx + Math.cos(angle) * len;
    const ey = cy + Math.sin(angle) * len;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);

    ctx.strokeStyle = `rgba(160,230,255,${alpha})`;
    ctx.lineWidth = depth * 0.55;
    ctx.stroke();

    const branchAngles = [-Math.PI / 3, Math.PI / 3, -Math.PI / 6, Math.PI / 6];

    branchAngles.forEach((da) => {
      drawCrystalBranch(
        ex,
        ey,
        angle + da,
        len * 0.52,
        depth - 1,
        alpha * 0.75,
      );
    });

    drawCrystalBranch(ex, ey, angle, len * 0.58, depth - 1, alpha * 0.8);
  }

  /* seeds */

  const crystalSeeds = [
    { x: 0, y: 0, angle: Math.PI * 0.25 },
    { x: 1, y: 0, angle: Math.PI * 0.75 },
    { x: 0, y: 1, angle: -Math.PI * 0.25 },
    { x: 1, y: 1, angle: -Math.PI * 0.75 },
    { x: 0.5, y: 0, angle: Math.PI * 0.5 },
    { x: 0, y: 0.5, angle: 0 },
    { x: 1, y: 0.5, angle: Math.PI },
  ];

  /* ───────── ICE MOTES ───────── */

  class IceMote {
    constructor() {
      this.reset(true);
    }

    reset(init = false) {
      this.x = Math.random() * W();
      this.y = init ? Math.random() * H() : H() + 4;
      this.r = 0.8 + Math.random() * 2.2;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = -(0.25 + Math.random() * 0.55);

      this.alpha = 0.15 + Math.random() * 0.55;
      this.twinkleSpeed = 0.02 + Math.random() * 0.04;
      this.twinklePhase = Math.random() * Math.PI * 2;
    }

    update(time) {
      if (!running) return;
      this.x += this.vx + Math.sin(time * 0.0008 + this.twinklePhase) * 0.18;
      this.y += this.vy;

      if (this.y < -6) this.reset();
    }

    draw(time) {
      const a =
        this.alpha *
        (0.65 + 0.35 * Math.sin(time * this.twinkleSpeed + this.twinklePhase));

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,240,255,${a})`;
      ctx.fill();
    }
  }

  const motes = Array.from({ length: 38 }, () => new IceMote());

  /* ───────── ICE PARTICLES ───────── */

  class SnowParticle {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * W();
      this.y = Math.random() * H();

      this.size = Math.random() * 1.8 + 0.5;

      this.speedY = -(Math.random() * 0.4 + 0.1);
      this.speedX = (Math.random() - 0.5) * 0.25;
      this.wobble = Math.random() * Math.PI * 2;
      this.wobbleSpeed = 0.02 + Math.random() * 0.02;
      this.opacity = Math.random() * 0.5 + 0.25;
    }

    update() {
      if (!running) return;
      this.wobble += this.wobbleSpeed;
      this.x += this.speedX + Math.sin(this.wobble) * 0.3;
      this.y += this.speedY;
      if (this.y < -10) {
        this.y = H() + 10;
        this.x = Math.random() * W();
      }
      if (this.x > W()) this.x = 0;
      if (this.x < 0) this.x = W();
    }

    draw() {
      ctx.fillStyle = `rgba(200,235,255,${this.opacity})`;

      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const snowParticles = Array.from({ length: 60 }, () => new SnowParticle());

  /* ───────── MIST ───────── */

  class MistStreak {
    constructor() {
      this.reset(true);
    }

    reset(init = false) {
      this.x = 10 + Math.random() * (W() - 20);
      this.y = init ? Math.random() * H() : H() * (0.6 + Math.random() * 0.4);

      this.w = 18 + Math.random() * 40;
      this.h = 8 + Math.random() * 20;

      this.vy = -(0.12 + Math.random() * 0.28);

      this.alpha = 0.04 + Math.random() * 0.09;

      this.life = 1;
      this.decay = 0.003 + Math.random() * 0.003;
    }

    update() {
      this.y += this.vy;
      this.life -= this.decay;

      if (this.life <= 0) this.reset();
    }

    draw() {
      const g = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.w,
      );

      g.addColorStop(0, `rgba(140,220,255,${this.alpha * this.life})`);
      g.addColorStop(1, `rgba(140,220,255,0)`);

      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.w, this.h, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  const mists = Array.from({ length: 14 }, () => new MistStreak());

  /* ───────── FROST VIGNETTE ───────── */

  function drawFrostVignette(time) {
    const pulse = 0.55 + 0.1 * Math.sin(time * 0.0015);

    let g = ctx.createLinearGradient(0, 0, W() * 0.42, 0);
    g.addColorStop(0, `rgba(100,195,255,${0.22 * pulse})`);
    g.addColorStop(0.5, `rgba(80,160,230,${0.08 * pulse})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W(), H());

    g = ctx.createLinearGradient(W(), 0, W() * 0.58, 0);
    g.addColorStop(0, `rgba(100,195,255,${0.22 * pulse})`);
    g.addColorStop(0.5, `rgba(80,160,230,${0.08 * pulse})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W(), H());

    g = ctx.createLinearGradient(0, 0, 0, H() * 0.45);
    g.addColorStop(0, `rgba(120,210,255,${0.28 * pulse})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W(), H());

    g = ctx.createLinearGradient(0, H(), 0, H() * 0.5);
    g.addColorStop(0, `rgba(80,180,255,${0.32 * pulse})`);
    g.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W(), H());
  }

  /* ───────── CRACKS ───────── */

  const cracks = generateCracks(9);

  function generateCracks(n) {
    return Array.from({ length: n }, () => {
      const startEdge = Math.floor(Math.random() * 4);

      let sx, sy;

      if (startEdge === 0) {
        sx = Math.random();
        sy = 0;
      } else if (startEdge === 1) {
        sx = 1;
        sy = Math.random();
      } else if (startEdge === 2) {
        sx = Math.random();
        sy = 1;
      } else {
        sx = 0;
        sy = Math.random();
      }

      const segs = [];
      let cx = sx;
      let cy = sy;

      const steps = 3 + Math.floor(Math.random() * 4);

      for (let i = 0; i < steps; i++) {
        const ang =
          Math.atan2(0.5 - cy, 0.5 - cx) + (Math.random() - 0.5) * 1.4;
        const len = 0.06 + Math.random() * 0.14;

        cx = Math.min(1, Math.max(0, cx + Math.cos(ang) * len));
        cy = Math.min(1, Math.max(0, cy + Math.sin(ang) * len));

        segs.push({ x: cx, y: cy });
      }

      return { sx, sy, segs, shimmerPhase: Math.random() * Math.PI * 2 };
    });
  }

  function drawCracks(time) {
    cracks.forEach((crack) => {
      const shimmer =
        0.3 + 0.4 * Math.abs(Math.sin(time * 0.0012 + crack.shimmerPhase));

      ctx.beginPath();

      ctx.moveTo(crack.sx * W(), crack.sy * H());

      crack.segs.forEach((s) => ctx.lineTo(s.x * W(), s.y * H()));

      ctx.strokeStyle = `rgba(200,240,255,${shimmer * 0.85})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }

  /* ───────── CRYSTALS ───────── */

  function drawCrystals(time) {
    crystalSeeds.forEach((seed, i) => {
      const baseLen = W() * 0.13;
      const pulse = 0.88 + 0.12 * Math.sin(time * 0.001 + i * 1.1);

      const len = baseLen * pulse;
      const alpha = 0.45 * pulse;

      drawCrystalBranch(seed.x * W(), seed.y * H(), seed.angle, len, 4, alpha);
    });
  }

  /* ───────── GLINT ───────── */

  let glintTimer = 0;
  let glintActive = null;

  function maybeSpawnGlint(time) {
    glintTimer--;

    if (glintTimer <= 0) {
      glintTimer = 90 + Math.floor(Math.random() * 120);

      glintActive = {
        x: W() * (0.1 + Math.random() * 0.8),
        y: H() * (0.1 + Math.random() * 0.8),
        born: time,
        dur: 600,
      };
    }
  }

  function drawGlint(time) {
    if (!glintActive) return;
    const age = time - glintActive.born;
    const prog = age / glintActive.dur;
    if (prog > 1) {
      glintActive = null;
      return;
    }

    const alpha = Math.sin(prog * Math.PI) * 0.9;
    const size = 18 * Math.sin(prog * Math.PI);
    const { x, y } = glintActive;

    const arms = [
      [0, -size],
      [0, size],
      [-size, 0],
      [size, 0],
    ];

    ctx.save();
    arms.forEach(([dx, dy]) => {
      const g = ctx.createLinearGradient(x, y, x + dx, y + dy);
      g.addColorStop(0, `rgba(220,245,255,${alpha})`);
      g.addColorStop(1, `rgba(220,245,255,0)`);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.strokeStyle = g;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
    ctx.restore();
  }
  /* ───────── MAIN LOOP ───────── */

  function render() {
    if (!running) return;

    ctx.clearRect(0, 0, W(), H());

    drawFrostVignette(time);
    drawCracks(time);
    drawCrystals(time);

    snowParticles.forEach((p) => {
      p.update();
      p.draw();
    });

    mists.forEach((m) => {
      m.update();
      m.draw();
    });
    motes.forEach((m) => {
      m.update(time);
      m.draw(time);
    });

    maybeSpawnGlint(time);
    drawGlint(time);

    time += 0.016;

    requestAnimationFrame(render);
  }

  let frameId;

  function loop() {
    render();
    frameId = requestAnimationFrame(loop);
  }

  frameId = requestAnimationFrame(loop);
  return {
    stop() {
      cancelAnimationFrame(frameId);
      running = false;
      window.removeEventListener("resize", syncSize);
    },
  };
}
