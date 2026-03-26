export async function playDeathClaimEffect(championEl) {
  const wrapper = championEl.querySelector(".portrait-wrapper");
  if (!wrapper) return;

  const portraitEl = wrapper.querySelector(".portrait");
  if (!portraitEl) return;

  const imgEl = portraitEl.querySelector("img");
  if (!imgEl) return;

  const rect = portraitEl.getBoundingClientRect();

  // 🔥 canvas LOCAL (igual obliterate)
  const canvas = document.createElement("canvas");
  canvas.classList.add("death-claim-canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;

  portraitEl.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // 🔥 desenha imagem (igual obliterate)
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

  imgEl.style.visibility = "hidden";

  // 🔥 aplica filtro + tremor (DO TEU CÓDIGO)
  shake(portraitEl, 8, 400);
  tweenFilter(portraitEl, 600);

  // 🔥 executa animação principal
  await playDarkAnimationLocal(ctx, canvas);

  // cleanup
  canvas.remove();
}

async function playDarkAnimationLocal(ctx, canvas) {
  const W = canvas.width;
  const H = canvas.height;

  const CX = W / 2;
  const CY = H / 2;

  const particles = [];
  const shadows = [];

  // spawn partículas (do teu código)
  for (let i = 0; i < 60; i++) {
    particles.push(
      new ShadowParticle(
        CX,
        CY,
        (Math.random() - 0.5) * 2,
        -Math.random() * 2,
        8 + Math.random() * 10,
        60 + Math.random() * 40,
        Math.random() > 0.5 ? "shadow" : "soul",
      ),
    );
  }

  // tentáculos (adaptado)
  for (let i = 0; i < 3; i++) {
    shadows.push(new CreepingShadow(Math.random() * W, H, CX, CY));
  }

  let t = 0;

  await new Promise((resolve) => {
    function loop() {
      ctx.clearRect(0, 0, W, H);

      // fundo escurecendo
      ctx.fillStyle = `rgba(0,0,0,${Math.min(t / 80, 0.7)})`;
      ctx.fillRect(0, 0, W, H);

      // tentáculos
      shadows.forEach((s) => s.draw(ctx));

      // partículas
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      // 🔥 FOICE (do teu código)
      const progress = Math.min(t / 80, 1);

      drawScythe(ctx, CX, CY, -Math.PI / 4, 0.6 + progress * 0.4, progress);

      t++;

      if (t < 100) {
        requestAnimationFrame(loop);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(loop);
  });
}
