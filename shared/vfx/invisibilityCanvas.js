export function startInvisibilityCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  let running = true;
  let time = 0;

  const box = canvas.parentElement;
  let lastW = 0;
  let lastH = 0;

  function syncSize() {
    const w = box?.clientWidth || 0;
    const h = box?.clientHeight || 0;
    if (!w || !h) return;

    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      lastW = w;
      lastH = h;
    }
  }

  syncSize();
  window.addEventListener("resize", syncSize);

  const W = () => canvas.width;
  const H = () => canvas.height;

  class VeilMote {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      const minR = Math.min(W(), H()) * 0.22;
      const maxR = Math.min(W(), H()) * 0.49;

      this.theta = Math.random() * Math.PI * 2;
      this.radius = minR + Math.random() * (maxR - minR);
      this.speed = 0.0012 + Math.random() * 0.0024;
      this.size = 1 + Math.random() * 2.4;
      this.alpha = 0.08 + Math.random() * 0.18;
      this.twinkle = Math.random() * Math.PI * 2;
      this.twinkleSpeed = 0.001 + Math.random() * 0.0025;

      if (!initial) {
        this.theta = Math.random() * Math.PI * 2;
      }
    }

    update() {
      this.theta += this.speed;
      this.twinkle += this.twinkleSpeed;
      if (this.theta > Math.PI * 2) this.theta -= Math.PI * 2;
    }

    draw(cx, cy) {
      const x = cx + Math.cos(this.theta) * this.radius;
      const y = cy + Math.sin(this.theta * 1.08) * this.radius * 0.72;
      const pulse = 0.65 + 0.35 * Math.sin(this.twinkle);

      ctx.beginPath();
      ctx.arc(x, y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(186, 232, 255, ${this.alpha * pulse})`;
      ctx.fill();
    }
  }

  const motes = Array.from({ length: 18 }, () => new VeilMote());

  function drawVeil(cx, cy, radius) {
    const pulse = 0.88 + Math.sin(time * 0.0017) * 0.12;

    const veil = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.22,
      cx,
      cy,
      radius * 1.05,
    );
    veil.addColorStop(0, `rgba(130, 210, 255, ${0.06 * pulse})`);
    veil.addColorStop(0.5, `rgba(150, 230, 255, ${0.11 * pulse})`);
    veil.addColorStop(1, "rgba(110, 180, 230, 0)");

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = veil;
    ctx.fill();
  }

  function drawRefractionRings(cx, cy, radius) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const outer = radius * 0.95;
    const inner = radius * 0.72;

    ctx.setLineDash([8, 11]);
    ctx.lineDashOffset = -time * 0.04;
    ctx.strokeStyle = "rgba(184, 236, 255, 0.26)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([3, 9]);
    ctx.lineDashOffset = time * 0.06;
    ctx.strokeStyle = "rgba(205, 244, 255, 0.18)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawShimmerBands(cx, cy, radius) {
    const bandCount = 3;

    for (let i = 0; i < bandCount; i++) {
      const phase = time * 0.0024 + i * 1.7;
      const y = cy + Math.sin(phase) * radius * 0.46;
      const width = radius * (1.25 + Math.sin(phase * 1.4) * 0.2);
      const alpha = 0.06 + (Math.sin(phase * 1.6) * 0.5 + 0.5) * 0.08;

      const grad = ctx.createLinearGradient(cx - width, y, cx + width, y);
      grad.addColorStop(0, "rgba(170, 220, 255, 0)");
      grad.addColorStop(0.5, `rgba(206, 245, 255, ${alpha})`);
      grad.addColorStop(1, "rgba(170, 220, 255, 0)");

      ctx.fillStyle = grad;
      ctx.fillRect(cx - width, y - 1.2, width * 2, 2.4);
    }
  }

  function render() {
    if (!running) return;

    syncSize();
    ctx.clearRect(0, 0, W(), H());

    const cx = W() / 2;
    const cy = H() / 2;
    const radius = Math.max(10, Math.min(W(), H()) * 0.49);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    drawVeil(cx, cy, radius);
    drawShimmerBands(cx, cy, radius);

    for (const mote of motes) {
      mote.update();
      mote.draw(cx, cy);
    }

    ctx.restore();

    drawRefractionRings(cx, cy, radius);

    time += 16;
    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", syncSize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setLineDash([]);
    },
  };
}
