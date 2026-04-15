function getElementCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quadraticPoint(p0, p1, p2, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
    y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
  };
}

function drawBurst(ctx, x, y, radius, alpha, colorA, colorB) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${colorA}, ${alpha})`);
  g.addColorStop(0.5, `rgba(${colorB}, ${alpha * 0.55})`);
  g.addColorStop(1, "rgba(0, 0, 0, 0)");

  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function playLifestealTransferVFX({
  fromEl,
  toEl,
  duration = 760,
} = {}) {
  if (!fromEl || !toEl) return Promise.resolve();

  const canvas = document.createElement("canvas");
  canvas.className = "vfx-canvas vfx-layer vfx-lifesteal-transfer";
  canvas.style.position = "fixed";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "1300";

  const ctx = canvas.getContext("2d");
  document.body.appendChild(canvas);

  let rafId = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  resize();

  const particleCount = 22;
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    base: i / particleCount,
    speed: 0.6 + Math.random() * 0.6,
    size: 2 + Math.random() * 3.5,
    sway: 6 + Math.random() * 12,
  }));

  const startAt = performance.now();

  return new Promise((resolve) => {
    function cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      resolve();
    }

    function frame(now) {
      const elapsed = now - startAt;
      const t = Math.min(1, elapsed / duration);

      const from = getElementCenter(fromEl);
      const to = getElementCenter(toEl);

      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const arch = Math.min(130, Math.max(40, dist * 0.22));

      const ctrl = {
        x: (from.x + to.x) / 2 + nx * arch,
        y: (from.y + to.y) / 2 + ny * arch,
      };

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const beamAlpha = (1 - Math.abs(0.5 - t) * 2) * 0.9;

      const trailStart = quadraticPoint(from, ctrl, to, 0.02);
      const trailEnd = quadraticPoint(from, ctrl, to, 0.98);
      const beamGrad = ctx.createLinearGradient(
        trailStart.x,
        trailStart.y,
        trailEnd.x,
        trailEnd.y,
      );
      beamGrad.addColorStop(0, `rgba(255, 48, 84, ${0.15 + beamAlpha * 0.65})`);
      beamGrad.addColorStop(
        0.45,
        `rgba(255, 92, 128, ${0.3 + beamAlpha * 0.55})`,
      );
      beamGrad.addColorStop(
        1,
        `rgba(80, 255, 154, ${0.35 + beamAlpha * 0.55})`,
      );

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 4 + beamAlpha * 3;
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(255, 52, 90, 0.7)";
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.quadraticCurveTo(ctrl.x, ctrl.y, to.x, to.y);
      ctx.stroke();
      ctx.restore();

      for (const p of particles) {
        const head = (t * p.speed + p.base) % 1;
        const point = quadraticPoint(from, ctrl, to, head);
        const wobble = Math.sin((head + t) * Math.PI * 9) * p.sway;
        const px = point.x + nx * wobble * (1 - head);
        const py = point.y + ny * wobble * (1 - head);

        const alpha = 0.45 + (1 - head) * 0.45;
        ctx.fillStyle =
          head < 0.65
            ? `rgba(255, 70, 110, ${alpha})`
            : `rgba(110, 255, 170, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.65 + (1 - head) * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }

      const srcPulse = 12 + (1 - t) * 18;
      const dstPulse = 10 + t * 20;

      drawBurst(
        ctx,
        from.x,
        from.y,
        srcPulse,
        0.35 + (1 - t) * 0.3,
        "255,70,110",
        "255,160,180",
      );
      drawBurst(
        ctx,
        to.x,
        to.y,
        dstPulse,
        0.4 + t * 0.35,
        "95,255,155",
        "180,255,220",
      );

      if (t >= 1) {
        cleanup();
        return;
      }

      rafId = requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    rafId = requestAnimationFrame(frame);
  });
}
