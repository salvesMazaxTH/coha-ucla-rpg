export function startShield(canvas) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let time = 0;
  let globalRotation = 0;

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  resize();
  window.addEventListener("resize", resize);

  function drawHexGrid(cx, cy, radius) {
    const size = 14; // tamanho dos hexágonos
    const hexHeight = Math.sqrt(3) * size;
    const hexWidth = 2 * size;
    const vertDist = hexHeight;
    const horizDist = hexWidth * 0.75;

    ctx.strokeStyle = "rgba(80, 210, 255, 0.25)";

    ctx.lineWidth = 1;

    for (let x = -radius; x < radius; x += horizDist) {
      for (let y = -radius; y < radius; y += vertDist) {
        const offset = Math.floor(x / horizDist) % 2 === 0 ? 0 : vertDist / 2;

        const hx = cx + x;
        const hy = cy + y + offset;

        const dist = Math.hypot(hx - cx, hy - cy);
        if (dist > radius - size) continue;

        drawHex(hx, hy, size);
      }
    }
  }

  function drawHex(x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + time * 0.1;
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function render() {
    if (!running) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) / 2 - 10;

    const pulse = 1 + Math.sin(time * 2) * 0.04; // 1 → 1.04
    const alphaPulse = 0.8 + Math.sin(time * 2) * 0.2;

    ctx.save();

    ctx.translate(cx, cy);
    ctx.rotate(globalRotation);
    ctx.scale(pulse, pulse);
    ctx.translate(-cx, -cy);

    ctx.globalAlpha = alphaPulse;

    // Glow
    const gradient = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.6,
      cx,
      cy,
      radius,
    );

    gradient.addColorStop(0, "rgba(120,200,255,0.15)");
    gradient.addColorStop(1, "rgba(0,120,255,0.6)");

    /*     gradient.addColorStop(0, "rgba(255, 230, 120, 0.15)");
    gradient.addColorStop(1, "rgba(255, 180, 0, 0.6)"); */

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Borda externa
    /*     ctx.strokeStyle = "rgba(255, 220, 80, 0.9)"; */
    ctx.strokeStyle = "rgba(80, 220, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Grade hexagonal
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
    ctx.clip();

    drawHexGrid(cx, cy, radius - 6);

    ctx.restore();

    // Arco rotatório
    ctx.strokeStyle = "rgba(80, 220, 255, 0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 6, time, time + Math.PI / 1.4);
    ctx.stroke();

    ctx.restore();

    time += 0.015;
    globalRotation += 0.003; // rotação lenta suave

    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
    },
  };
}
