// Efeito "Abraço da Morte" (marca) — canvas VFX simples seguindo o padrão dos outros arquivos
export function startAbraçoDaMorteMark(canvas) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let time = 0;

  function resize() {
    const box = canvas.parentElement;
    if (!box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
  }
  resize();
  window.addEventListener("resize", resize);

  // Ícone central: caveira usando deathspecter.png na cor original
  const deathspecterImg = new window.Image();
  let deathspecterReady = false;

  deathspecterImg.onload = () => {
    deathspecterReady = true;
  };

  deathspecterImg.onerror = () => {
    deathspecterReady = false;
  };

  deathspecterImg.src = "/assets/the_death_specter.png";

  function drawDeathSpecterIcon(cx, cy, size) {
    if (!deathspecterReady) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 6;
    ctx.drawImage(deathspecterImg, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
  }

  // Efeito "aura" pulsante
  function drawAura(cx, cy, size, t) {
    const pulse = 0.7 + 0.3 * Math.sin(t * 0.04);
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.13 * pulse;
    const grad = ctx.createRadialGradient(
      cx,
      cy,
      size * 0.2,
      cx,
      cy,
      size * 0.7 * pulse,
    );
    grad.addColorStop(0, "#a000ff");
    grad.addColorStop(0.5, "#8000a0");
    grad.addColorStop(1, "rgba(80,0,120,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.7 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // ───────── PARTICULAS DE MORTE ─────────
  class DeathParticle {
    constructor() {
      this.reset(true);
    }
    reset(init = false) {
      this.x = Math.random() * canvas.width;
      this.y = init ? Math.random() * canvas.height : canvas.height + 8;
      this.r = 4.2 + Math.random() * 4.5;
      this.vx = (Math.random() - 0.5) * 0.18;
      this.vy = -0.18 - Math.random() * 0.13;
      this.alpha = 0.18 + Math.random() * 0.22;
      this.tw = Math.random() * Math.PI * 2;
      this.twSpeed = 0.012 + Math.random() * 0.018;
      this.type = Math.random() < 0.5 ? "deathspecter" : "wisp";
    }
    update(time) {
      if (!running) return;
      this.x += this.vx + Math.sin(time * 0.008 + this.tw) * 0.22;
      this.y += this.vy;
      this.tw += this.twSpeed;
      if (this.y < -10) this.reset();
    }
    draw(ctx, time) {
      ctx.save();
      ctx.globalAlpha =
        this.alpha * (0.7 + 0.3 * Math.sin(time * 0.01 + this.tw));
      if (this.type === "deathspecter") {
        // Mini caveira
        ctx.translate(this.x, this.y);
        ctx.scale(this.r / 12, this.r / 12);
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#eae6f7";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 2;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 4, 4, 2.2, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#eae6f7";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-2, -1, 1, 0, Math.PI * 2);
        ctx.arc(2, -1, 1, 0, Math.PI * 2);
        ctx.fillStyle = "#222";
        ctx.fill();
        ctx.restore();
      } else {
        // Wisps sombrios
        ctx.beginPath();
        ctx.arc(
          this.x,
          this.y,
          this.r * (0.7 + 0.3 * Math.sin(time * 0.02 + this.tw)),
          0,
          Math.PI * 2,
        );
        const grad = ctx.createRadialGradient(
          this.x,
          this.y,
          0,
          this.x,
          this.y,
          this.r,
        );
        grad.addColorStop(0, "rgba(120,0,80,0.32)");
        grad.addColorStop(0.7, "rgba(60,0,40,0.13)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      }
    }
  }
  // 18 partículas de "morte"
  let deathParticles = Array.from({ length: 18 }, () => new DeathParticle());

  function render() {
    if (!running) return;
    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.62;

    // Partículas de morte (fundo)
    deathParticles.forEach((p) => {
      p.update(time);
      p.draw(ctx, time);
    });

    drawAura(cx, cy, size, time);
    drawDeathSpecterIcon(cx, cy, size * 0.62);

    // Pequeno "brilho" animado
    const shineAlpha = 0.18 + 0.12 * Math.abs(Math.sin(time * 0.09));
    ctx.save();
    ctx.globalAlpha = shineAlpha;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.38, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();

    time += 1;
    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
    },
  };
}
