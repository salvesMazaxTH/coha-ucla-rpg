function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function playExecuteEffect(championEl) {
  const wrapper = championEl.querySelector(".portrait-wrapper");
  if (!wrapper) return;

  const portraitEl = wrapper.querySelector(".portrait");
  if (!portraitEl) return;

  const imgEl = portraitEl.querySelector("img");
  if (!imgEl) return;

  const portraitRect = portraitEl.getBoundingClientRect();

  // Crack overlay dentro do .portrait (respeita overflow:hidden e border-radius)
  const crackOverlay = document.createElement("div");
  crackOverlay.classList.add("execute-crack");
  crackOverlay.style.backgroundImage = `url("${generateCrackSVG(portraitRect.width, portraitRect.height)}")`;
  portraitEl.appendChild(crackOverlay);

  // Canvas dentro do .portrait também
  const canvas = document.createElement("canvas");
  canvas.classList.add("execute-canvas");
  canvas.width = portraitRect.width;
  canvas.height = portraitRect.height;
  portraitEl.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // ✅ Desenha a imagem no canvas — canvas agora É a imagem visualmente
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

  portraitEl.classList.add("execute-flash");
  await wait(80);

  // ✅ Esconde img SÓ agora — sem salto visível pois o canvas já a está renderizando
  imgEl.style.visibility = "hidden";

  await wait(320); // rachaduras aparecem sobre o canvas

  portraitEl.classList.remove("execute-flash");

  // ✅ Estilhaça o canvas em fragmentos com pixels reais da imagem
  await playCutEffect(canvas, ctx);
  await Promise.all([
    shatterCanvas(canvas, ctx),
    explodeParticles(canvas, ctx),
  ]);

  crackOverlay.remove();
  canvas.remove();
}

function shatterCanvas(canvas, ctx, imgEl) {
  return new Promise((resolve) => {
    const COLS = 7,
      ROWS = 9;
    const W = canvas.width,
      H = canvas.height;
    const CX = W / 2,
      CY = H / 2;
    const cellW = W / COLS,
      cellH = H / ROWS;

    const snap = document.createElement("canvas");
    snap.width = W;
    snap.height = H;
    snap.getContext("2d").drawImage(canvas, 0, 0);

    const fragments = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const sx = c * cellW,
          sy = r * cellH;
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
        // ✅ Desenha direto da imgEl — sem toDataURL, sem taint error
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

function generateCrackSVG(w, h) {
  let lines = "";
  for (let i = 0; i < 12; i++) {
    const x1 = Math.random() * w;
    const y1 = Math.random() * h;
    const x2 = Math.random() * w;
    const y2 = Math.random() * h;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(140,210,255,0.9)" stroke-width="1.5" opacity="0.9"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${lines}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function playCutEffect(canvas, ctx) {
  const W = canvas.width,
    H = canvas.height;
  const x1 = W * 0.1,
    y1 = H * 0.35;
  const x2 = W * 0.9,
    y2 = H * 0.65;
  const duration = 120;
  const start = performance.now();

  await new Promise((resolve) => {
    function loop(now) {
      const p = Math.min((now - start) / duration, 1);
      ctx.clearRect(0, 0, W, H);

      // Redraw snap fica por conta do caller — aqui só desenha o corte
      const cx = x1 + (x2 - x1) * p;
      const cy = y1 + (y2 - y1) * p;

      // Trilha do corte
      ctx.save();
      const grad = ctx.createLinearGradient(x1, y1, cx, cy);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.6, "rgba(180,230,255,0.6)");
      grad.addColorStop(1, "rgba(255,255,255,1)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(120,220,255,1)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx, cy);
      ctx.stroke();

      // Ponta brilhante
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.restore();

      if (p < 1) requestAnimationFrame(loop);
      else resolve();
    }
    requestAnimationFrame(loop);
  });

  // Flash de impacto — cataclismo mágico
  await new Promise((resolve) => {
    const start = performance.now();
    const duration = 520;

    function fade(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - p * p;

      ctx.save();
      ctx.globalAlpha = eased * 0.92;

      // Base — azul etéreo, não branco sólido
      const grad = ctx.createRadialGradient(
        W / 2,
        H / 2,
        0,
        W / 2,
        H / 2,
        W * 0.8,
      );
      grad.addColorStop(0, "rgba(200,240,255,1)");
      grad.addColorStop(0.3, "rgba(100,180,255,0.9)");
      grad.addColorStop(0.7, "rgba(40,80,180,0.6)");
      grad.addColorStop(1, "rgba(10,10,40,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Fissuras por cima do gradiente
      ctx.globalAlpha = eased * 0.7;
      ctx.strokeStyle = "rgba(200,235,255,0.95)";
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "rgba(100,200,255,1)";
      ctx.shadowBlur = 8;
      for (const line of magicCracks) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }

      ctx.restore();

      if (p < 1) requestAnimationFrame(fade);
      else resolve();
    }

    // Gera as fissuras uma vez só
    const magicCracks = Array.from({ length: 18 }, () => ({
      x1: Math.random() * W,
      y1: Math.random() * H,
      x2: Math.random() * W,
      y2: Math.random() * H,
    }));

    requestAnimationFrame(fade);
  });
}

class Particle {
  constructor(x, y) {
    this.x = x + (Math.random() - 0.5) * 20;
    this.y = y + (Math.random() - 0.5) * 20;
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    this.vx = Math.cos(angle) * speed * 0.4;
    this.vy = Math.sin(angle) * speed * 0.4 - 1.2;
    this.width = 2 + Math.random() * 3;
    this.height = 6 + Math.random() * 10;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.08;
    this.alpha = 1;
    this.gravity = -0.018; // sobe lentamente, como fumaça
    this.drag = 0.985;
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
    ctx.fillStyle = "rgba(230,230,240,0.9)";
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.restore();
  }
}

function explodeParticles(canvas, ctx) {
  return new Promise((resolve) => {
    const CX = canvas.width / 2;
    const CY = canvas.height / 2;

    const shards = Array.from({ length: 160 }, () => new Particle(CX, CY));

    function loop() {
      //ctx.clearRect(0, 0, canvas.width, canvas.height);
      shards.forEach((p) => {
        p.step();
        p.draw(ctx);
      });

      if (shards.some((p) => p.alpha > 0)) {
        requestAnimationFrame(loop);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(loop);
  });
}
