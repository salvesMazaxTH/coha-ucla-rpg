/**
 * shared/vfx/deathClaim.js
 * Cinematográfica cinematográfica portado do HTML fornecido.
 *
 * "A Morte O Reclama" - VFX especial de execução do Jeff_The_Death.
 */

/* const rand = (min, max) => Math.random() * (max - min) + min;
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
} */

/* function shake(el, intensity, dur) {
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
} */

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
/* class CreepingShadow {
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
} */

// ─── Desenho da Foice Gigante de Sombra ────
/* function drawScythe(ctx, x, y, angle, scale, alpha) {
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
} */

/**
 * Main export for Special Death Action
 */
/* export async function playDeathClaimEffect(championEl) {
  // 1. Setup Canvas Full-screen
  const canvas = document.createElement("canvas");
  canvas.classList.add("death-claim-canvas-fullscreen");
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
} */

// ─── UTILITÁRIOS ───
const rand = (min, max) => Math.random() * (max - min) + min;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const norm = (v, min, max) => clamp((v - min) / (max - min), 0, 1);
const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─── FUNÇÕES DO DOM ───
function shakeDOM(el, intensity, dur) {
  let start = null;
  const frame = (ts) => {
    if (!start) start = ts;
    const t = Math.min((ts - start) / dur, 1);
    const d = Math.pow(1 - t, 2);
    el.style.transform = `translate(${(Math.random() - 0.5) * intensity * d}px, ${(Math.random() - 0.5) * intensity * d}px)`;
    if (t < 1) requestAnimationFrame(frame);
    else el.style.transform = "";
  };
  requestAnimationFrame(frame);
}

function tweenFilterDOM(el, dur) {
  let start = null;
  const frame = (ts) => {
    if (!start) start = ts;
    const t = Math.min((ts - start) / dur, 1);
    const e = easeOutQuart(t);
    const sat = lerp(0.7, 0.0, e).toFixed(2);
    const bri = lerp(0.9, 0.1, e).toFixed(2);
    el.style.filter = `saturate(${sat}) brightness(${bri}) contrast(1.5) sepia(${e * 0.5}) hue-rotate(180deg)`;
    if (t < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function createGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.2, "rgba(255, 255, 255, 0.8)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// ─── LÓGICA PRINCIPAL WEBGL ───
export async function playDeathClaimEffect(championEl) {
  const container = document.getElementById("webgl-container");
  if (container) container.innerHTML = "";

  // 1. Setup da Cena e Luzes
  const scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);

  const camera = new THREE.OrthographicCamera(
    0,
    window.innerWidth,
    0,
    window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 100;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  if (container) container.appendChild(renderer.domElement);

  // 2. Mapeamento DOM -> WebGL
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

  const pointLight = new THREE.PointLight(0x00aaff, 5, 500);
  pointLight.position.set(targetCx, targetCy, 100);
  scene.add(pointLight);

  // 3. Sistema de Partículas (Duplo: Sombras Opacas vs Almas Brilhantes)
  const particleTexture = createGlowTexture();

  function createParticleGroup(maxCount, blendMode) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const sizes = new Float32Array(maxCount);

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { pointTexture: { value: particleTexture } },
      vertexShader: `
              attribute float size;
              attribute vec3 color;
              varying vec3 vColor;
              void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (100.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
              }
            `,
      fragmentShader: `
              uniform sampler2D pointTexture;
              varying vec3 vColor;
              void main() {
                vec4 texColor = texture2D(pointTexture, gl_PointCoord);
                gl_FragColor = vec4(vColor, texColor.a);
              }
            `,
      blending: blendMode,
      depthTest: false,
      transparent: true,
    });

    const mesh = new THREE.Points(geometry, material);
    scene.add(mesh);

    return {
      geometry,
      material,
      mesh,
      positions,
      colors,
      sizes,
      data: [],
      count: 0,
      max: maxCount,
    };
  }

  const shadowSys = createParticleGroup(2000, THREE.NormalBlending); // Mistura normal para evitar o "branco"
  const soulSys = createParticleGroup(1000, THREE.AdditiveBlending); // Mistura aditiva para magia

  function spawnParticle(
    sys,
    x,
    y,
    vx,
    vy,
    life,
    size,
    r,
    g,
    b,
    isSoul = false,
  ) {
    if (sys.count >= sys.max) return;
    const i = sys.count;
    sys.positions[i * 3] = x;
    sys.positions[i * 3 + 1] = y;
    sys.positions[i * 3 + 2] = isSoul ? 10 : 0;
    sys.colors[i * 3] = r;
    sys.colors[i * 3 + 1] = g;
    sys.colors[i * 3 + 2] = b;
    sys.sizes[i] = size;

    sys.data.push({ vx, vy, life, maxLife: life, isSoul });
    sys.count++;
  }

  // 4. Criação da Foice Extrudada
  const shape = new THREE.Shape();
  shape.moveTo(-8, -180);
  shape.quadraticCurveTo(-150, -220, -320, -100);
  shape.quadraticCurveTo(-150, -100, -8, -60);
  shape.lineTo(-8, 200);
  shape.lineTo(8, 200);
  shape.lineTo(8, -180);

  const extrudeSettings = {
    depth: 12,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 2,
    bevelThickness: 2,
  };
  const scytheGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  scytheGeo.center();

  const scytheMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.8,
    roughness: 0.2,
    transparent: true,
  });
  const scytheMesh = new THREE.Mesh(scytheGeo, scytheMat);

  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x0088ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  });
  const auraMesh = new THREE.Mesh(scytheGeo, auraMat);
  auraMesh.scale.set(1.05, 1.05, 1.5);
  auraMesh.position.z = -1;

  const scytheGroup = new THREE.Group();
  scytheGroup.add(auraMesh);
  scytheGroup.add(scytheMesh);
  scytheGroup.position.set(targetCx + 100, targetCy - 100, 20);
  scytheGroup.visible = false;
  scene.add(scytheGroup);

  // 5. Tela de Flash
  const flashGeo = new THREE.PlaneGeometry(
    window.innerWidth * 2,
    window.innerHeight * 2,
  );
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const flashMesh = new THREE.Mesh(flashGeo, flashMat);
  flashMesh.position.set(window.innerWidth / 2, window.innerHeight / 2, 50);
  scene.add(flashMesh);

  // 6. O "Braço de Sombra"
  const shadowHand = { progress: 0, speed: 0.012 };

  // 7. Dimmer/Vignette (Tela Escura)
  const dimmerGeo = new THREE.PlaneGeometry(
    window.innerWidth * 2,
    window.innerHeight * 2,
  );
  const dimmerMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const dimmerMesh = new THREE.Mesh(dimmerGeo, dimmerMat);
  dimmerMesh.position.set(window.innerWidth / 2, window.innerHeight / 2, 10);
  scene.add(dimmerMesh);

  // 8. Loop de Animação
  let startTime = performance.now();
  let hasStruck = false;

  return new Promise((resolve) => {
    function animate(now) {
      const elapsed = now - startTime;

      // --- Dimmer (Escurecer Tela) ---
      const vigAlpha =
        norm(elapsed, 0, 800) * 0.7 * (1 - norm(elapsed, 4500, 5500));
      dimmerMat.opacity = vigAlpha;

      // --- A Mão Sombria ---
      if (elapsed > 200 && elapsed < 2500) {
        shadowHand.progress = Math.min(
          shadowHand.progress + shadowHand.speed,
          1,
        );

        const dx = targetCx - deathCx;
        const dy = targetCy - deathCy;
        const angle = Math.atan2(dy, dx);

        // Base do pulso (com leve tremor ondulante)
        const wave = Math.sin(shadowHand.progress * 15) * 15;
        const palmX =
          lerp(deathCx, targetCx, shadowHand.progress) +
          Math.cos(angle + Math.PI / 2) * wave;
        const palmY =
          lerp(deathCy, targetCy, shadowHand.progress) +
          Math.sin(angle + Math.PI / 2) * wave;

        if (shadowHand.progress < 1) {
          // Palma da mão (cinza escuro, não branco)
          spawnParticle(
            shadowSys,
            palmX,
            palmY,
            0,
            0,
            60,
            150,
            0.07,
            0.07,
            0.07,
          );

          // Dedos da mão (5 filetes que vão à frente do pulso)
          const fingerSpreads = [-0.6, -0.3, 0, 0.3, 0.6]; // Ângulos de abertura
          fingerSpreads.forEach((spread, index) => {
            const length =
              index === 2 ? 70 : index === 0 || index === 4 ? 40 : 55; // Dedo do meio é maior
            const tipX = palmX + Math.cos(angle + spread) * length;
            const tipY = palmY + Math.sin(angle + spread) * length;

            // Emite fumaça para os dedos (cinza escuro)
            spawnParticle(
              shadowSys,
              tipX,
              tipY,
              rand(-0.2, 0.2),
              rand(-0.2, 0.2),
              rand(40, 70),
              rand(50, 90),
              0.09,
              0.09,
              0.09,
            );
          });
        }
      }

      // Fumaça de Preparação
      if (elapsed > 1000 && elapsed < 2000 && Math.random() < 0.6) {
        spawnParticle(
          shadowSys,
          targetCx + rand(-80, 80),
          targetCy + rand(-50, 150),
          0,
          rand(-2, 0),
          rand(50, 100),
          rand(100, 200),
          0.05,
          0.05,
          0.05,
        );
      }

      // Movimento da Foice
      if (elapsed > 1200 && elapsed < 4000) {
        scytheGroup.visible = true;
        const scytheAge = elapsed - 1200;
        const matP = norm(scytheAge, 0, 600);
        const swingP = norm(scytheAge, 700, 850);
        const fadeP = norm(scytheAge, 2000, 2800);

        const alpha = matP * (1 - fadeP);
        scytheMat.transparent = true;
        scytheMat.opacity = alpha;
        auraMat.opacity = alpha * 0.6;

        const easeCut = easeInOutCubic(swingP);
        scytheGroup.rotation.z = lerp(Math.PI / 4, -Math.PI * 0.6, easeCut);

        scytheGroup.position.x = targetCx + 120 - swingP * 60;
        scytheGroup.position.y = targetCy - 150 + swingP * 150;

        const sca = 0.8 + matP * 0.2;
        scytheGroup.scale.set(sca, sca, 1);
      } else {
        scytheGroup.visible = false;
      }

      // O Impacto
      if (!hasStruck && elapsed > 1950) {
        hasStruck = true;
        shakeDOM(championEl, 40, 1000);
        tweenFilterDOM(targetImg, 1500);
        flashMat.opacity = 1;

        // Explosão de ALMAS (Azul neon - usa o sistema Aditivo)
        for (let i = 0; i < 150; i++) {
          spawnParticle(
            soulSys,
            targetCx,
            targetCy,
            rand(-15, 15),
            rand(-15, 15),
            rand(40, 100),
            rand(30, 80),
            0.2,
            0.6,
            1.0,
            true,
          );
        }
      }

      if (flashMat.opacity > 0) flashMat.opacity -= 0.03;

      // Drenando Almas Continuamente
      if (hasStruck && elapsed < 4500 && Math.random() < 0.4) {
        spawnParticle(
          soulSys,
          targetCx + rand(-40, 40),
          targetCy + rand(-40, 40),
          rand(-2, 2),
          rand(-8, -3),
          rand(60, 120),
          rand(20, 60),
          0.1,
          0.5,
          1.0,
          true,
        );
      }

      // --- Atualização Física Genérica ---
      [shadowSys, soulSys].forEach((sys) => {
        const posAttr = sys.geometry.attributes.position;
        const sizeAttr = sys.geometry.attributes.size;
        const colAttr = sys.geometry.attributes.color;

        for (let i = 0; i < sys.count; i++) {
          let p = sys.data[i];
          if (p.life > 0) {
            p.life--;
            posAttr.array[i * 3] += p.vx;
            posAttr.array[i * 3 + 1] += p.vy;

            if (p.isSoul) {
              p.vy -= 0.1;
              sizeAttr.array[i] *= 0.96;
            } else {
              p.vx *= 0.95;
              p.vy *= 0.95;
              sizeAttr.array[i] += 1.2;
            }

            if (p.life / p.maxLife < 0.3) {
              colAttr.array[i * 3] *= 0.9;
              colAttr.array[i * 3 + 1] *= 0.9;
              colAttr.array[i * 3 + 2] *= 0.9;
            }
          } else {
            posAttr.array[i * 3] = -9999;
          }
        }
        posAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      });

      renderer.render(scene, camera);

      if (elapsed < 6000) {
        requestAnimationFrame(animate);
      } else {
        // Limpeza Final
        renderer.dispose();
        scytheGeo.dispose();
        scytheMat.dispose();
        auraMat.dispose();
        flashGeo.dispose();
        flashMat.dispose();
        dimmerGeo.dispose();
        dimmerMat.dispose();
        shadowSys.geometry.dispose();
        shadowSys.material.dispose();
        soulSys.geometry.dispose();
        soulSys.material.dispose();

        if (container) container.innerHTML = "";
        resolve();
      }
    }

    requestAnimationFrame(animate);
  });
}
