export function startFireStance(canvas, data = {}) {
  const ctx = canvas.getContext("2d");

  const mode = data.mode || "fireStanceIdle"; // "idle" ou "active"
  console.log("Initializing fire stance VFX with mode:", mode);
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
  // IDLE PARTICLES (base)
  // ============================
  const particles = [];
  const MAX_PARTICLES = isActive ? 80 : 40;

  function spawnParticle(cx, cy, radius) {
    const angle = Math.random() * Math.PI * 2;

    const baseX = cx + Math.cos(angle) * radius;
    const baseY = cy + Math.sin(angle) * radius;

    particles.push({
      x: baseX,
      y: baseY,
      angle,
      life: 1,
      size: /* isActive ? 10 + Math.random() * 16 : */ 6 + Math.random() * 6,
      speed:
        /* isActive ? 1.5 + Math.random() * 1.5 : */ 0.5 + Math.random() * 0.7,
      drift:
        /* isActive ? (Math.random() - 0.5) * 2 : */ (Math.random() - 0.5) *
        0.8,
    });
  }

  function updateParticles(cx, cy, radius) {
    if (particles.length < MAX_PARTICLES) {
      spawnParticle(cx, cy, radius);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      /*       if (isActive) {
        // Partículas mais agressivas e erráticas
        p.y -= p.speed;
        p.x += Math.sin(time * 6 + p.angle) * 1.2 + p.drift;
        p.size += 0.985; // Afina quando sobe
      } else { */
      p.y -= p.speed;
      p.x += Math.sin(time * 4 + p.angle) * 0.6 + p.drift;
      //}

      p.life -= isActive ? 0.02 : 0.015;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = p.life;

      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);

      //if (isActive) {
      // 🔥 CHAMA REAL (núcleo branco quente)
      gradient.addColorStop(0, `rgba(255,255,220,${alpha})`);
      gradient.addColorStop(0.25, `rgba(255,200,80,${alpha})`);
      gradient.addColorStop(0.6, `rgba(255,80,0,${alpha})`);
      gradient.addColorStop(1, `rgba(255,0,0,0)`);
      //} else {
      // 🔥 IDLE ORIGINAL (inalterado)
      gradient.addColorStop(0, `rgba(255,255,180,${alpha})`);
      gradient.addColorStop(0.4, `rgba(255,140,0,${alpha})`);
      gradient.addColorStop(1, `rgba(255,0,0,0)`);
      //}

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
  }

  // ============================
  // ACTIVE AURA (orgânica)
  // ============================

  function drawActiveFlame(cx, cy, radius) {
    const segments = 80;
    const amplitude = 20;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    ctx.beginPath();

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;

      const noise =
        Math.sin(time * 4 + angle * 6) * 0.5 +
        Math.sin(time * 3 + angle * 3) * 0.5;

      const verticalBoost = Math.sin(angle) > 0 ? Math.sin(angle) * 25 : 0;

      const dynamicRadius = radius + noise * amplitude + verticalBoost;

      const x = cx + Math.cos(angle) * dynamicRadius;
      const y = cy + Math.sin(angle) * dynamicRadius;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    const gradient = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.6,
      cx,
      cy,
      radius + amplitude + 25,
    );

    gradient.addColorStop(0, `rgba(255,220,120,0.15)`);
    gradient.addColorStop(0.4, `rgba(255,140,0,0.35)`);
    gradient.addColorStop(0.7, `rgba(255,60,0,0.7)`);
    gradient.addColorStop(1, `rgba(255,0,0,0)`);

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

    // 🔥 CLIP no círculo do retrato
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    if (isActive) {
      drawActiveFlame(cx, cy, radius);
    } else {
      updateParticles(cx, cy, radius);
      ctx.globalCompositeOperation = "lighter";
      drawParticles();
    }

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
