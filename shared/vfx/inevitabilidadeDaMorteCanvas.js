// Efeito "Inevitabilidade da Morte" (marca da ult do Jeff)
export function startInevitabilidadeDaMorte(canvas) {
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

  const skullImg = new window.Image();
  let skullReady = false;

  skullImg.onload = () => {
    skullReady = true;
  };

  skullImg.onerror = () => {
    skullReady = false;
  };

  skullImg.src = "/assets/skull.png";

  // Movimento da caveira: troca alvo de deslocamento a cada ~2s (120 frames @60fps)
  const MOVE_INTERVAL_FRAMES = 120;
  let driftX = 0;
  let driftY = 0;
  let targetDriftX = 0;
  let targetDriftY = 0;
  let rotation = 0;
  let rotationSpeed = 0.015;

  function updateSkullMotion(iconSize) {
    if (time % MOVE_INTERVAL_FRAMES === 0) {
      const maxOffset = iconSize * 0.12;
      targetDriftX = (Math.random() - 0.5) * maxOffset * 2;
      targetDriftY = (Math.random() - 0.5) * maxOffset * 2;
      rotationSpeed =
        (Math.random() < 0.5 ? -1 : 1) * (0.01 + Math.random() * 0.02);
    }

    driftX += (targetDriftX - driftX) * 0.06;
    driftY += (targetDriftY - driftY) * 0.06;
    rotation += rotationSpeed;
  }

  function drawSkullIcon(cx, cy, size) {
    if (!skullReady) return;

    updateSkullMotion(size);

    ctx.save();
    ctx.translate(cx + driftX, cy + driftY);
    ctx.rotate(rotation);
    ctx.globalAlpha = 0.95;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 6;
    ctx.drawImage(skullImg, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

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
      this.type = Math.random() < 0.5 ? "skull" : "wisp";
    }
    update(now) {
      if (!running) return;
      this.x += this.vx + Math.sin(now * 0.008 + this.tw) * 0.22;
      this.y += this.vy;
      this.tw += this.twSpeed;
      if (this.y < -10) this.reset();
    }
    draw(ctx, now) {
      ctx.save();
      ctx.globalAlpha =
        this.alpha * (0.7 + 0.3 * Math.sin(now * 0.01 + this.tw));
      if (this.type === "skull") {
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
        ctx.beginPath();
        ctx.arc(
          this.x,
          this.y,
          this.r * (0.7 + 0.3 * Math.sin(now * 0.02 + this.tw)),
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

  const deathParticles = Array.from({ length: 18 }, () => new DeathParticle());

  function render() {
    if (!running) return;
    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.62;

    deathParticles.forEach((p) => {
      p.update(time);
      p.draw(ctx, time);
    });

    drawAura(cx, cy, size, time);
    drawSkullIcon(cx, cy, size * 0.62 * 1.3);

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
