export function startFireStance(canvas, data = {}) {
  const ctx = canvas.getContext("2d");
  const mode = data.mode || "fireStanceIdle";
  const isActive = mode === "fireStanceActive";

  let running = true;
  let time = 0;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  // ============================
  // PARTÍCULAS DE FOGO
  // ============================
  const particles = [];
  const MAX_PARTICLES = isActive ? 200 : 60;

  function spawnParticle(cx, cy, radius) {
    const spreadX = (Math.random() - 0.5) * radius * 1.4;
    const baseY = cy + radius * 0.6;

    particles.push({
      x: cx + spreadX,
      y: baseY,
      vx: (Math.random() - 0.5) * 2,
      vy: -(2.5 + Math.random() * 4),
      life: 1,
      size: 5 + Math.random() * 12,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 2 + Math.random() * 3,
    });
  }

  function updateParticles(cx, cy, radius) {
    while (particles.length < MAX_PARTICLES) {
      spawnParticle(cx, cy, radius);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.x += p.vx + Math.sin(time * p.wobbleSpeed + p.wobble) * 0.8;
      p.y += p.vy;
      p.vy -= 0.08;
      p.size *= 0.97;
      p.life -= 0.015;

      if (p.life <= 0 || p.size < 0.5) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life * 0.9;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);

      if (p.life > 0.7) {
        gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha})`);
        gradient.addColorStop(0.3, `rgba(255, 220, 100, ${alpha * 0.9})`);
        gradient.addColorStop(0.6, `rgba(255, 120, 0, ${alpha * 0.7})`);
        gradient.addColorStop(1, `rgba(255, 50, 0, 0)`);
      } else if (p.life > 0.4) {
        gradient.addColorStop(0, `rgba(255, 200, 80, ${alpha})`);
        gradient.addColorStop(0.4, `rgba(255, 100, 0, ${alpha * 0.8})`);
        gradient.addColorStop(1, `rgba(200, 0, 0, 0)`);
      } else {
        gradient.addColorStop(0, `rgba(255, 80, 0, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(200, 0, 0, ${alpha * 0.6})`);
        gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  // ============================
  // FORMA DE CHAMA 🔥
  // ============================
  function drawFlameShape(cx, cy, radius) {
    const baseWidth = radius * 1.2;
    const height = radius * 1.8;
    
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    
    const flicker = Math.sin(time * 8) * 0.15 + Math.sin(time * 12) * 0.1;
    const tipY = cy - height + flicker * 20;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy + radius * 0.8);
    
    const leftWobble = Math.sin(time * 6) * baseWidth * 0.2;
    const rightWobble = Math.sin(time * 5 + 1) * baseWidth * 0.2;
    
    ctx.quadraticCurveTo(
      cx - baseWidth - leftWobble,
      cy - height * 0.2,
      cx - baseWidth * 0.4 + Math.sin(time * 7) * 15,
      tipY
    );
    
    ctx.quadraticCurveTo(
      cx,
      tipY - radius * 0.3,
      cx + baseWidth * 0.4 + Math.sin(time * 6) * 15,
      tipY
    );
    
    ctx.quadraticCurveTo(
      cx + baseWidth + rightWobble,
      cy - height * 0.2,
      cx,
      cy + radius * 0.8
    );
    
    ctx.closePath();
    
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy - height * 0.3, radius * 1.5);
    gradient.addColorStop(0, `rgba(255, 255, 220, 0.4)`);
    gradient.addColorStop(0.15, `rgba(255, 220, 100, 0.35)`);
    gradient.addColorStop(0.4, `rgba(255, 120, 0, 0.25)`);
    gradient.addColorStop(0.7, `rgba(255, 50, 0, 0.15)`);
    gradient.addColorStop(1, `rgba(200, 0, 0, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.restore();
  }

  // ============================
  // RENDER LOOP
  // ============================
  function render() {
    if (!running) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 12;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    ctx.globalCompositeOperation = "lighter";
    
    if (isActive) {
      drawFlameShape(cx, cy, radius);
    }
    
    updateParticles(cx, cy, radius);
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