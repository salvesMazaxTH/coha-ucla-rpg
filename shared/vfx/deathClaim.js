/**
 * shared/vfx/deathClaim.js
 * Cinematográfica cinematográfica portado do HTML fornecido.
 *
 * "A Morte O Reclama" - VFX especial de execução do Jeff_The_Death.
 */

const rand = (min, max) => Math.random() * (max - min) + min;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const norm = (v, min, max) => clamp((v - min) / (max - min), 0, 1);
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

function animDOM(duration, onFrame, onEnd) {
  let start = null;
  const frame = (ts) => {
    if (!start) start = ts;
    const t = Math.min((ts - start) / duration, 1);
    onFrame(t);
    if (t < 1) requestAnimationFrame(frame);
    else if (onEnd) onEnd();
  };
  requestAnimationFrame(frame);
}

function shake(el, intensity, dur) {
  animDOM(
    dur,
    (t) => {
      const d = Math.pow(1 - t, 2);
      el.style.transform = `translate(${(Math.random() - 0.5) * intensity * d}px, ${(Math.random() - 0.5) * intensity * d}px)`;
    },
    () => (el.style.transform = ""),
  );
}

function tweenFilter(el, dur) {
  animDOM(dur, (t) => {
    const e = easeOutQuart(t);
    // O alvo perde cor e brilho (como se a alma estivesse sendo drenada)
    const sat = lerp(0.7, 0.05, e).toFixed(2);
    const bri = lerp(0.9, 0.25, e).toFixed(2);
    el.style.filter = `saturate(${sat}) brightness(${bri}) contrast(1.2)`;
  });
}

// ─── Partículas de Fumaça (Sombras e Almas) ────
class ShadowParticle {
  constructor(x, y, vx, vy, size, life, type = "shadow") {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.type = type; // "shadow" ou "soul"
    this.angle = rand(0, Math.PI * 2);
    this.rotSpd = rand(-0.02, 0.02);
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.angle += this.rotSpd;
    this.life--;
    if (this.type === "soul") {
      this.size *= 0.95; // almas diminuem
      this.y -= rand(0.5, 2); // almas sobem um pouco mais
    } else {
      this.size += 0.8; // sombras se expandem
    }
  }
  draw(ctx) {
    const p = this.life / this.maxLife;
    const alpha = p > 0.8 ? (1 - p) / 0.2 : p < 0.2 ? p / 0.2 : 1;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.type === "soul") {
      ctx.globalAlpha = alpha * 0.8;
      ctx.globalCompositeOperation = "screen";
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
      g.addColorStop(0, "rgba(220, 240, 255, 1)");
      g.addColorStop(0.2, "rgba(100, 180, 255, 0.5)");
      g.addColorStop(1, "rgba(0, 50, 150, 0)");
      ctx.fillStyle = g;
    } else {
      // shadow
      ctx.globalAlpha = alpha * 0.6;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
      g.addColorStop(0, "rgba(100, 100, 100, 1)");
      g.addColorStop(0.5, "rgba(70, 70, 70, 0.8)");
      g.addColorStop(1, "rgba(40, 40, 40, 0)");
      ctx.fillStyle = g;
    }

    ctx.beginPath();
    ctx.arc(0, 0, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Tentáculos de sombra rastejantes no chão ────
class CreepingShadow {
  constructor(startX, startY, targetX, targetY) {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.progress = 0;
    this.ctrls = [];
    const steps = 6;
    const dist = Math.hypot(targetX - startX, targetY - startY);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      this.ctrls.push({
        x: lerp(startX, targetX, t) + rand(-dist * 0.15, dist * 0.15),
        y: lerp(startY, targetY, t) + rand(-dist * 0.15, dist * 0.15),
      });
    }
  }
  draw(ctx, _elapsed) {
    this.progress = Math.min(this.progress + 0.012, 1);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this.startX, this.startY);
    const limit = Math.floor(this.progress * this.ctrls.length);
    let curX = this.startX,
      curY = this.startY;

    for (let i = 0; i < limit; i++) {
      ctx.lineTo(this.ctrls[i].x, this.ctrls[i].y);
      curX = this.ctrls[i].x;
      curY = this.ctrls[i].y;
    }
    if (this.progress < 1 && limit < this.ctrls.length) {
      const pt = this.progress * this.ctrls.length - limit;
      ctx.lineTo(
        lerp(curX, this.ctrls[limit].x, pt),
        lerp(curY, this.ctrls[limit].y, pt),
      );
    } else if (this.progress === 1) {
      ctx.lineTo(this.targetX, this.targetY);
    }

    ctx.strokeStyle = "rgba(90, 90, 90, 0.95)";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(60, 60, 60, 1)";
    ctx.shadowBlur = 15;
    ctx.stroke();

    // Core mais escuro (agora cinza escurecido)
    ctx.strokeStyle = "rgba(50, 50, 50, 1)";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.restore();
  }
}

// ─── Desenho da Foice Gigante de Sombra ────
function drawScythe(ctx, x, y, angle, scale, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, Math.abs(scale) > 0 ? scale : 1);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  ctx.shadowColor = "rgba(80, 80, 80, 1)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#555555";

  // Cabo
  ctx.beginPath();
  ctx.rect(-8, -220, 16, 450);
  ctx.fill();

  // Lâmina curvada
  ctx.beginPath();
  ctx.moveTo(-8, -180);
  // Curva convexa de cima
  ctx.quadraticCurveTo(-150, -220, -320, -100);
  // Curva côncava de baixo
  ctx.quadraticCurveTo(-150, -100, -8, -60);
  ctx.closePath();
  ctx.fill();

  // Efeito fantasmagórico de beirada na lâmina
  ctx.strokeStyle = "rgba(120, 120, 120, 0.8)";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.stroke();

  ctx.restore();
}

/**
 * Main export for Special Death Action
 */
export async function playDeathClaimEffect(championEl) {
  // 1. Setup Canvas Full-screen
  const canvas = document.createElement("canvas");
  canvas.classList.add("death-claim-canvas-fullscreen");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.zIndex = "1000";
  canvas.style.pointerEvents = "none";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  // 2. Identify Attacker (Jeff) and Target
  const targetImg = championEl.querySelector("img");
  const allChampionEls = Array.from(document.querySelectorAll(".champion"));
  const jeffEl =
    allChampionEls.find((el) => {
      const img = el.querySelector("img");
      return img && img.src.toLowerCase().includes("jeff");
    }) || championEl;

  const jeffRect = jeffEl.getBoundingClientRect();
  const targetRect = championEl.getBoundingClientRect();

  const deathCx = jeffRect.left + jeffRect.width / 2;
  const deathCy = jeffRect.top + jeffRect.height / 2;
  const targetCx = targetRect.left + targetRect.width / 2;
  const targetCy = targetRect.top + targetRect.height / 2;

  // 3. Start Loop
  let startTime = performance.now();
  let particles = [];
  let creepers = [];
  let hasStruck = false;

  // Cria as sombras rastejantes
  for (let i = 0; i < 6; i++) {
    creepers.push(
      new CreepingShadow(
        deathCx,
        deathCy + rand(-30, 100),
        targetCx + rand(-60, 60),
        targetCy + rand(0, 100),
      ),
    );
  }

  return new Promise((resolve) => {
    function loop(now) {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Vinheta escura
      const vigAlpha =
        norm(elapsed, 0, 800) * 0.7 * (1 - norm(elapsed, 4500, 5500));
      if (vigAlpha > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${vigAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // 2. Spawn de fumaça
      if (elapsed < 4000) {
        // Sombra ao redor do Jeff
        if (Math.random() < 0.4) {
          particles.push(
            new ShadowParticle(
              deathCx + rand(-100, 100),
              deathCy + rand(-100, 100),
              rand(-1, 0),
              rand(-1, 1),
              rand(60, 130),
              rand(60, 100),
              "shadow",
            ),
          );
        }
        // Sombra ao redor do alvo
        if (elapsed > 800 && Math.random() < 0.5) {
          particles.push(
            new ShadowParticle(
              targetCx + rand(-90, 90),
              targetCy + rand(-60, 150),
              rand(-0.2, 0.2),
              rand(-1.5, 0.5),
              rand(50, 100),
              rand(50, 80),
              "shadow",
            ),
          );
        }
        // Almas escapando no impacto
        if (elapsed > 2000 && Math.random() < 0.3) {
          particles.push(
            new ShadowParticle(
              targetCx + rand(-30, 30),
              targetCy + rand(-30, 30),
              rand(-4, 0),
              rand(-4, -1),
              rand(15, 30),
              rand(30, 50),
              "soul",
            ),
          );
        }
        // Almas fluindo
        if (elapsed > 2500 && Math.random() < 0.3) {
          particles.push(
            new ShadowParticle(
              targetCx + rand(-50, 50),
              targetCy - rand(50, 100),
              rand(0, 4),
              rand(-4, -2),
              rand(12, 25),
              rand(30, 40),
              "soul",
            ),
          );
        }
      }

      // 3. Atualizar e desenhar partículas
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
      }

      // 4. Sombras rastejantes
      if (elapsed > 300 && elapsed < 4500) {
        for (let c of creepers) c.draw(ctx, elapsed);
      }

      // 5. Foice
      if (elapsed > 1200 && elapsed < 5000) {
        const scytheAge = elapsed - 1200;
        const matP = norm(scytheAge, 0, 600);
        const fadeP = norm(scytheAge, 2500, 3500);
        const alpha = matP * (1 - fadeP);

        if (alpha > 0) {
          const swingP = norm(scytheAge, 700, 900);
          const angle = lerp(Math.PI / 4, -Math.PI * 0.4, easeInOutCubic(swingP));
          const sx = targetCx + 80 - swingP * 40;
          const sy = targetCy - 120 + swingP * 120;
          drawScythe(ctx, sx, sy, angle, 0.75 + matP * 0.25, alpha);
        }
      }

      // 6. Impacto
      if (!hasStruck && elapsed > 2000) {
        hasStruck = true;
        shake(championEl, 30, 900);
        tweenFilter(targetImg, 1200);

        ctx.fillStyle = "rgba(80, 80, 80, 0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (elapsed < 5500) {
        requestAnimationFrame(loop);
      } else {
        window.removeEventListener("resize", resize);
        canvas.remove();
        resolve();
      }
    }
    requestAnimationFrame(loop);
  });
}
