// ============================================================
//  Skill Animation System
//
//  Registry-based system for one-shot combat skill animations.
//  Each animation plays in the #webgl-container overlay using
//  Three.js (global) and cleans up after completion.
//
//  Not all skills have animations — only registered ones play.
//  To add a new animation:
//    registerSkillAnimation("skill_key", async ({ targetEl, userEl }) => { ... });
// ============================================================

const skillAnimationRegistry = new Map();

/**
 * Register a skill animation factory.
 * @param {string} skillKey
 * @param {Function} factory - async ({ targetEl, userEl }) => void
 */
export function registerSkillAnimation(skillKey, factory) {
  skillAnimationRegistry.set(skillKey, factory);
}

/**
 * Play a skill animation if one is registered.
 * Returns immediately if no animation exists for the given skill.
 * @param {string} skillKey
 * @param {{ targetEl?: Element, userEl?: Element }} opts
 * @returns {Promise<void>}
 */
export async function animateSkill(skillKey, opts = {}) {
  const factory = skillAnimationRegistry.get(skillKey);
  if (!factory) return;
  await factory(opts);
}

// ============================================================
//  GLSL Simplex Noise
// ============================================================

const snoiseGLSL = `
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                             dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

// ============================================================
//  Shared vertex shader (simple UV pass-through)
// ============================================================

const basicVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================================
//  Gancho Rápido — Kai's Melee Punch Animation
// ============================================================

const swipeFragmentShader = `
  ${snoiseGLSL}
  varying vec2 vUv;
  uniform float uProgress;

  void main() {
    float noise = snoise(vec2(vUv.x * 10.0, vUv.y * 3.0 - uProgress * 20.0));
    float mask = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.3, vUv.x);
    float width = smoothstep(0.5, 0.0, abs(vUv.y - 0.5) * (1.0 + uProgress * 2.0));

    float fire = mask * width * (noise * 0.5 + 0.5);
    float alpha = fire * (1.0 - uProgress);

    vec3 color = vec3(1.0, 0.4, 0.0) * 5.0;
    gl_FragColor = vec4(color, alpha);
  }
`;

const fistPrintFragmentShader = `
  ${snoiseGLSL}
  varying vec2 vUv;
  uniform float uAge;
  uniform sampler2D uTexture;

  void main() {
    vec2 uv = vUv;

    float burnNoise = snoise(uv * 15.0 - uAge) * 0.02;
    uv += burnNoise;

    vec4 texColor = texture2D(uTexture, uv);
    float shape = texColor.a;
    float heatFade = max(0.0, 1.0 - (uAge / 2.0));
    float glow = shape * 0.5;

    vec3 coreColor = vec3(1.0, 0.8, 0.2) * 3.0;
    vec3 edgeColor = vec3(1.0, 0.1, 0.0) * 1.5;
    vec3 finalColor = mix(edgeColor, coreColor, shape);

    float alpha = (shape + glow) * heatFade;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const smokeVertexShader = `
  uniform float uTime;
  attribute float aSize;
  attribute vec3 aVelocity;

  void main() {
    vec3 pos = position + aVelocity * uTime;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 - uTime / 2.0) * (50.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const smokeFragmentShader = `
  uniform float uTime;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.2, dist);
    vec3 smokeColor = vec3(0.05);
    vec3 fireColor = vec3(1.0, 0.3, 0.0);

    float mixFactor = smoothstep(0.0, 0.4, uTime);
    vec3 finalColor = mix(fireColor, smokeColor, mixFactor);

    float globalAlpha = alpha * (1.0 - (uTime / 1.5));
    gl_FragColor = vec4(finalColor, globalAlpha * 0.8);
  }
`;

// ============================================================
//  Punch Silhouette Texture (loaded from assets)
// ============================================================

const textureLoader = new THREE.TextureLoader();
const punchTexture = textureLoader.load("/assets/punch_silouete.png");

// ============================================================
//  Screen → World coordinate conversion
// ============================================================

function screenToWorld(screenX, screenY, camera) {
  const ndcX = (screenX / window.innerWidth) * 2 - 1;
  const ndcY = -(screenY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const worldPos = new THREE.Vector3();
  raycaster.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    worldPos,
  );
  return worldPos;
}

function getElementCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// ============================================================
//  MeleePunchEffect
// ============================================================

class MeleePunchEffect {
  constructor(scene, userPos, targetPos) {
    this.scene = scene;
    this.age = 0;

    // Positions
    this.userPos = userPos.clone();
    this.targetPos = targetPos.clone();
    const dx = targetPos.x - userPos.x;
    const dy = targetPos.y - userPos.y;
    this.distance = Math.sqrt(dx * dx + dy * dy);
    this.direction = new THREE.Vector3(dx, dy, 0).normalize();
    const angle = Math.atan2(dy, dx);

    // --- Phase 1: Swipe trail (travels from user → target) ---
    const swipeGeo = new THREE.PlaneGeometry(8, 2.5);
    this.swipeMat = new THREE.ShaderMaterial({
      vertexShader: basicVertexShader,
      fragmentShader: swipeFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { uProgress: { value: 0 } },
    });
    this.swipe = new THREE.Mesh(swipeGeo, this.swipeMat);
    this.swipe.rotation.z = angle;
    // Starts at user position
    this.swipe.position.set(userPos.x, userPos.y, 0);
    scene.add(this.swipe);

    // --- Phase 2: Fist print (impact mark at target) ---
    const printGeo = new THREE.PlaneGeometry(5, 5);
    this.printMat = new THREE.ShaderMaterial({
      vertexShader: basicVertexShader,
      fragmentShader: fistPrintFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uAge: { value: 0 },
        uTexture: { value: punchTexture },
      },
    });
    this.fistPrint = new THREE.Mesh(printGeo, this.printMat);
    this.fistPrint.rotation.z = angle;
    this.fistPrint.position.set(targetPos.x, targetPos.y, 0);
    this.fistPrint.visible = false;
    scene.add(this.fistPrint);

    // --- Phase 3: Smoke particles (at target) ---
    const particleCount = 30;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pVel = new Float32Array(particleCount * 3);
    const pSize = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // All particles originate at target position
      pPos[i * 3] = targetPos.x;
      pPos[i * 3 + 1] = targetPos.y;
      pPos[i * 3 + 2] = 0;

      // Smoke pushed in direction of punch + radial expansion
      const theta = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      pVel[i * 3] = (Math.cos(theta) * 0.5 + this.direction.x) * speed;
      pVel[i * 3 + 1] = (Math.sin(theta) * 0.5 + this.direction.y) * speed;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * speed;

      pSize[i] = Math.random() * 20 + 15;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aVelocity", new THREE.BufferAttribute(pVel, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));

    this.smokeMat = new THREE.ShaderMaterial({
      vertexShader: smokeVertexShader,
      fragmentShader: smokeFragmentShader,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
    });
    this.particles = new THREE.Points(pGeo, this.smokeMat);
    this.particles.visible = false;
    scene.add(this.particles);

    // Timings
    this.TRAVEL_DUR = 0.15; // swipe travels from user to target
    this.PRINT_DUR = 2.0;
    this.LIFETIME = 2.0;
  }

  update(dt) {
    this.age += dt;

    // Phase 1: Swipe travels from user → target
    if (this.age <= this.TRAVEL_DUR) {
      const t = this.age / this.TRAVEL_DUR;
      this.swipeMat.uniforms.uProgress.value = t;

      // Lerp position from user to target
      this.swipe.position.x =
        this.userPos.x + (this.targetPos.x - this.userPos.x) * t;
      this.swipe.position.y =
        this.userPos.y + (this.targetPos.y - this.userPos.y) * t;

      // Stretch as it travels
      this.swipe.scale.x = 1.0 + t * 2.0;
    } else {
      this.swipe.visible = false;
    }

    // Phase 2 & 3: Impact mark + smoke (at target)
    if (this.age > this.TRAVEL_DUR) {
      const postImpactAge = this.age - this.TRAVEL_DUR;

      this.fistPrint.visible = true;
      this.printMat.uniforms.uAge.value = postImpactAge;

      this.particles.visible = true;
      this.smokeMat.uniforms.uTime.value = postImpactAge;
    }

    return this.age < this.LIFETIME;
  }

  dispose(scene) {
    scene.remove(this.swipe);
    scene.remove(this.fistPrint);
    scene.remove(this.particles);
    this.swipeMat.dispose();
    this.printMat.dispose();
    this.smokeMat.dispose();
    this.swipe.geometry.dispose();
    this.fistPrint.geometry.dispose();
    this.particles.geometry.dispose();
  }
}

// ============================================================
//  Register: gancho_rapido
// ============================================================

registerSkillAnimation("gancho_rapido", async ({ targetEl, userEl }) => {
  const container = document.getElementById("webgl-container");
  if (!container || !targetEl) return;

  // --- Load post-processing addons ---
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] =
    await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
    ]);

  // --- Setup scene ---
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 15;

  // Opaque black background — screen blend mode turns black → transparent
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.mixBlendMode = "screen";
  container.appendChild(renderer.domElement);

  // --- Post-processing (bloom) ---
  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2.5,
    0.5,
    0.1,
  );
  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  // --- Compute world positions ---
  const targetCenter = getElementCenter(targetEl);
  const worldTarget = screenToWorld(targetCenter.x, targetCenter.y, camera);

  let worldUser;
  if (userEl) {
    const userCenter = getElementCenter(userEl);
    worldUser = screenToWorld(userCenter.x, userCenter.y, camera);
  } else {
    worldUser = new THREE.Vector3(worldTarget.x - 5, worldTarget.y, 0);
  }

  // --- Create effect (travels from user → target) ---
  const effect = new MeleePunchEffect(scene, worldUser, worldTarget);

  // --- Render loop (promise-based) ---
  const clock = new THREE.Clock();

  await new Promise((resolve) => {
    function animate() {
      const dt = clock.getDelta();

      if (!effect.update(dt)) {
        effect.dispose(scene);
        composer.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.remove();
        }
        resolve();
        return;
      }

      composer.render();
      requestAnimationFrame(animate);
    }

    animate();
  });
});
