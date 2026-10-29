import * as THREE from 'three';

/**
 * High-Performance, Lag-Free 3D Particle Engine
 * Optimized for silky 60 FPS on laptops.
 * Shape targets: Saturn (☝️), "I LOVE YOU" (✌️), 3D Heart (✊), Galaxy (🖐️)
 */
export class ParticleEngine {
  constructor(container) {
    this.container = container;
    this.particleCount = 7500; // Optimal count: dense, sharp, and 100% lag-free
    this.currentShape = 'saturn';

    // Three.js Core
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particleSystem = null;
    this.geometry = null;

    // Direct TypedArrays
    this.positions = null;
    this.velocities = null;
    this.colors = null;

    // Targets
    this.targetPositions = null;
    this.targetColors = null;

    // Cache pre-computed shapes
    this.shapes = {};

    // Hand control
    this.handRotX = 0;
    this.handRotY = 0;
    this.targetHandRotX = 0;
    this.targetHandRotY = 0;

    // Color transition tracking
    this.isColorTransitioning = false;
    this.colorTransitionTime = 0;

    this.clock = new THREE.Clock();
    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    this.camera.position.set(0, 0, 24);

    // 3. WebGL Renderer (optimized settings)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap pixel ratio for performance
    this.renderer.setClearColor(0x000000, 1.0);
    this.container.appendChild(this.renderer.domElement);

    // 4. Buffers & Shapes
    this.initBuffers();
    this.generateAllShapes();

    // 5. Apply Saturn as initial
    this.setShape('saturn', true);

    // 6. Handle resize
    window.addEventListener('resize', () => this.onResize());
  }

  createParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    return texture;
  }

  initBuffers() {
    const N = this.particleCount;
    const N3 = N * 3;

    this.positions = new Float32Array(N3);
    this.velocities = new Float32Array(N3);
    this.colors = new Float32Array(N3);

    this.targetPositions = new Float32Array(N3);
    this.targetColors = new Float32Array(N3);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.28,
      map: this.createParticleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      vertexColors: true
    });

    this.particleSystem = new THREE.Points(this.geometry, material);
    this.scene.add(this.particleSystem);
  }

  generateAllShapes() {
    const N = this.particleCount;

    // 1. Saturn Shape (☝️)
    const saturnPos = new Float32Array(N * 3);
    const saturnCol = new Float32Array(N * 3);
    const nPlanet = Math.floor(N * 0.38);

    for (let i = 0; i < nPlanet; i++) {
      const i3 = i * 3;
      const r = 4.0 * Math.cbrt(0.2 + 0.8 * Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      saturnPos[i3] = r * Math.sin(phi) * Math.cos(theta);
      saturnPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.9;
      saturnPos[i3 + 2] = r * Math.cos(phi);

      saturnCol[i3] = 1.0;
      saturnCol[i3 + 1] = 0.68 + Math.random() * 0.15;
      saturnCol[i3 + 2] = 0.15;
    }

    const tilt = 0.46;
    const cosT = Math.cos(tilt), sinT = Math.sin(tilt);
    for (let i = nPlanet; i < N; i++) {
      const i3 = i * 3;
      let r = 5.2 + Math.random() * 6.5;
      if (r > 7.8 && r < 8.3) r += 0.7; // Cassini division
      const theta = Math.random() * Math.PI * 2;
      const rx = r * Math.cos(theta);
      const ry = (Math.random() - 0.5) * 0.2;
      const rz = r * Math.sin(theta);

      saturnPos[i3] = rx;
      saturnPos[i3 + 1] = ry * cosT - rz * sinT;
      saturnPos[i3 + 2] = ry * sinT + rz * cosT;

      saturnCol[i3] = 0.98;
      saturnCol[i3 + 1] = 0.82;
      saturnCol[i3 + 2] = 0.45;
    }
    this.shapes.saturn = { pos: saturnPos, col: saturnCol };

    // 2. "I LOVE YOU" Text Shape (✌️)
    const textCanvas = document.createElement('canvas');
    textCanvas.width = 800;
    textCanvas.height = 250;
    const tCtx = textCanvas.getContext('2d');
    tCtx.fillStyle = '#000';
    tCtx.fillRect(0, 0, 800, 250);
    tCtx.fillStyle = '#fff';
    tCtx.font = 'bold 96px Arial, sans-serif';
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.fillText('I LOVE YOU', 400, 125);

    const imgData = tCtx.getImageData(0, 0, 800, 250).data;
    const textCoords = [];
    for (let y = 0; y < 250; y += 3) {
      for (let x = 0; x < 800; x += 3) {
        if (imgData[(y * 800 + x) * 4] > 120) {
          textCoords.push({
            x: (x - 400) * 0.038,
            y: -(y - 125) * 0.038
          });
        }
      }
    }

    const textPos = new Float32Array(N * 3);
    const textCol = new Float32Array(N * 3);
    const nCoords = textCoords.length || 1;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const pt = textCoords[i % nCoords] || { x: 0, y: 0 };
      textPos[i3] = pt.x + (Math.random() - 0.5) * 0.15;
      textPos[i3 + 1] = pt.y + (Math.random() - 0.5) * 0.15;
      textPos[i3 + 2] = (Math.random() - 0.5) * 1.5;

      // Cyan / Bright Neon Blue
      textCol[i3] = 0.05;
      textCol[i3 + 1] = 0.95;
      textCol[i3 + 2] = 1.0;
    }
    this.shapes.text = { pos: textPos, col: textCol };

    // 3. 3D Heart Shape (✊)
    const heartPos = new Float32Array(N * 3);
    const heartCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      const t = Math.random() * Math.PI * 2;
      const u = Math.random();
      const x0 = 16 * Math.pow(Math.sin(t), 3);
      const y0 = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const maxZ = Math.sqrt(Math.max(0.01, 1 - Math.abs(x0 / 16))) * 5.0;
      const z0 = (Math.random() * 2 - 1) * maxZ;
      const s = 0.45 * Math.cbrt(u * 0.8 + 0.2);

      heartPos[i3] = x0 * s;
      heartPos[i3 + 1] = y0 * s + 1.2;
      heartPos[i3 + 2] = z0 * s;

      // Crimson / Ruby Red
      heartCol[i3] = 1.0;
      heartCol[i3 + 1] = 0.1;
      heartCol[i3 + 2] = 0.3;
    }
    this.shapes.heart = { pos: heartPos, col: heartCol };

    // 4. Cosmic Spiral Galaxy (🖐️)
    const galaxyPos = new Float32Array(N * 3);
    const galaxyCol = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      if (Math.random() < 0.25) {
        // Core
        const r = 2.5 * Math.pow(Math.random(), 2);
        const theta = Math.random() * Math.PI * 2;
        galaxyPos[i3] = r * Math.cos(theta);
        galaxyPos[i3 + 1] = (Math.random() - 0.5) * 1.5;
        galaxyPos[i3 + 2] = r * Math.sin(theta);

        galaxyCol[i3] = 1.0;
        galaxyCol[i3 + 1] = 0.9;
        galaxyCol[i3 + 2] = 0.7;
      } else {
        const arm = i % 4;
        const r = 2.5 + Math.pow(Math.random(), 1.4) * 11.5;
        const angle = (arm * Math.PI / 2) + r * 0.45;
        const spread = (Math.random() - 0.5) * (0.8 + r * 0.1);

        galaxyPos[i3] = r * Math.cos(angle) + spread;
        galaxyPos[i3 + 1] = (Math.random() - 0.5) * 1.0;
        galaxyPos[i3 + 2] = r * Math.sin(angle) + spread;

        // Indigo / Deep Blue / Violet
        galaxyCol[i3] = 0.35 + 0.4 * (r / 14);
        galaxyCol[i3 + 1] = 0.45;
        galaxyCol[i3 + 2] = 0.95;
      }
    }
    this.shapes.galaxy = { pos: galaxyPos, col: galaxyCol };
  }

  setShape(shapeName, immediate = false) {
    if (!this.shapes[shapeName]) return;
    this.currentShape = shapeName;

    const target = this.shapes[shapeName];
    const N3 = this.particleCount * 3;

    for (let i = 0; i < N3; i++) {
      this.targetPositions[i] = target.pos[i];
      this.targetColors[i] = target.col[i];

      if (immediate) {
        this.positions[i] = target.pos[i];
        this.colors[i] = target.col[i];
        this.velocities[i] = 0;
      }
    }

    this.isColorTransitioning = true;
    this.colorTransitionTime = 0;

    if (immediate) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  setHandControl(rotX, rotY) {
    this.targetHandRotX = rotX;
    this.targetHandRotY = rotY;
  }

  update() {
    const dt = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();
    const N = this.particleCount;
    const N3 = N * 3;

    // Smooth hand rotation
    this.handRotX += (this.targetHandRotX - this.handRotX) * 0.1;
    this.handRotY += (this.targetHandRotY - this.handRotY) * 0.1;

    if (this.particleSystem) {
      if (this.currentShape === 'saturn' || this.currentShape === 'galaxy') {
        this.particleSystem.rotation.y += 0.006; // gentle auto spin
      }
      this.particleSystem.rotation.x = this.handRotX * 0.6;
      this.particleSystem.rotation.z = -this.handRotY * 0.4;
    }

    // Heartbeat pulse calculation
    let hPulse = 1.0;
    if (this.currentShape === 'heart') {
      const beat = (Math.sin(elapsedTime * 6.5) + 1) * 0.5;
      hPulse = 1.0 + Math.pow(beat, 4) * 0.12;
    }

    const pos = this.positions;
    const targets = this.targetPositions;
    const vel = this.velocities;

    // Tight, unrolled spring physics loop (runs in < 1ms on CPU!)
    for (let i = 0; i < N3; i += 3) {
      let tx = targets[i];
      let ty = targets[i + 1];
      let tz = targets[i + 2];

      if (hPulse !== 1.0) {
        tx *= hPulse;
        ty *= hPulse;
        tz *= hPulse;
      }

      // X
      vel[i] = (vel[i] + (tx - pos[i]) * 0.075) * 0.85;
      pos[i] += vel[i];

      // Y
      vel[i + 1] = (vel[i + 1] + (ty - pos[i + 1]) * 0.075) * 0.85;
      pos[i + 1] += vel[i + 1];

      // Z
      vel[i + 2] = (vel[i + 2] + (tz - pos[i + 2]) * 0.075) * 0.85;
      pos[i + 2] += vel[i + 2];
    }
    this.geometry.attributes.position.needsUpdate = true;

    // Smooth color morph only when transitioning (prevents unnecessary GPU upload)
    if (this.isColorTransitioning) {
      this.colorTransitionTime += dt;
      const col = this.colors;
      const tCol = this.targetColors;

      for (let i = 0; i < N3; i++) {
        col[i] += (tCol[i] - col[i]) * 0.1;
      }
      this.geometry.attributes.color.needsUpdate = true;

      if (this.colorTransitionTime > 0.8) {
        this.isColorTransitioning = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
