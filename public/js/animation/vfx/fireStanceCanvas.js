export function startFireStance(canvas) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let time = 0;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  const particles = [];
  const MAX_PARTICLES = 40;

  function spawnParticle(cx, cy, radius) {
    const angle = Math.random() * Math.PI * 2;

    const baseX = cx + Math.cos(angle) * radius;
    const baseY = cy + Math.sin(angle) * radius;

    particles.push({
      x: baseX,
      y: baseY,
      angle,
      life: 1,
      size: 6 + Math.random() * 6,
      speed: 0.6 + Math.random() * 0.8,
      drift: (Math.random() - 0.5) * 0.8,
    });
  }

  function updateParticles(cx, cy, radius) {
    if (particles.length < MAX_PARTICLES) {
      spawnParticle(cx, cy, radius);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      // Movimento ascendente semi-orgânico
      p.y -= p.speed;
      p.x += Math.sin(time * 4 + p.angle) * 0.6 + p.drift;

      p.life -= 0.015;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life;

      const gradient = ctx.createRadialGradient(
        p.x, p.y, 0,
        p.x, p.y, p.size
      );

      gradient.addColorStop(0, `rgba(255,255,180,${alpha})`);
      gradient.addColorStop(0.4, `rgba(255,140,0,${alpha})`);
      gradient.addColorStop(1, `rgba(255,0,0,0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  function render() {
    if (!running) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 12;

    updateParticles(cx, cy, radius);
    ctx.save();

    ctx.globalCompositeOperation = "lighter";
    drawParticles();
    ctx.restore();

    time += 0.016;
    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}