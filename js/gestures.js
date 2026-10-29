/**
 * Ultra-Fast & Lag-Free MediaPipe Hand Detector
 * Uses Model Complexity 0 (Lite) + frame-dropping lock to eliminate all camera stutter.
 */

export class GestureDetector {
  constructor(videoElement, canvasOverlay, onGestureChange, onHandMove, onFpsUpdate) {
    this.video = videoElement;
    this.canvas = canvasOverlay;
    this.ctx = canvasOverlay ? canvasOverlay.getContext('2d') : null;

    this.onGestureChange = onGestureChange;
    this.onHandMove = onHandMove;
    this.onFpsUpdate = onFpsUpdate;

    this.hands = null;
    this.isTracking = false;
    this.isProcessing = false; // Prevents frame queuing lag!

    this.currentGesture = 'saturn';
    this.candidateGesture = null;
    this.candidateCount = 0;
    this.REQUIRED_FRAMES = 2; // Fast, responsive debounce

    // FPS Counter
    this.frameCount = 0;
    this.lastTime = performance.now();

    this.CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];
  }

  async start() {
    try {
      if (typeof window.Hands === 'undefined') {
        await this.loadMediaPipe();
      }

      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      // Complexity 0 is the fastest, high-accuracy mobile-optimized model
      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 0,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      this.hands.onResults((results) => this.onResults(results));

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 360 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      this.video.srcObject = stream;
      await this.video.play();

      this.isTracking = true;
      this.loop();
      return true;
    } catch (err) {
      console.warn('Failed to start camera:', err);
      throw err;
    }
  }

  async loadMediaPipe() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  loop() {
    const tick = async () => {
      if (!this.isTracking) return;

      if (!this.isProcessing && this.video.readyState >= 2) {
        this.isProcessing = true;
        try {
          await this.hands.send({ image: this.video });
        } catch (e) {
          // ignore transient frame skip
        } finally {
          this.isProcessing = false;
        }
      }

      // FPS tracking
      this.frameCount++;
      const now = performance.now();
      if (now - this.lastTime >= 1000) {
        const fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
        this.frameCount = 0;
        this.lastTime = now;
        if (this.onFpsUpdate) this.onFpsUpdate(fps);
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  onResults(results) {
    if (!this.ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }

    const lm = results.multiHandLandmarks[0];

    // 1. Draw clean skeleton (white lines, red joint dots)
    this.drawSkeleton(lm, w, h);

    // 2. Classify gesture
    this.classifyGesture(lm);
  }

  drawSkeleton(lm, w, h) {
    const ctx = this.ctx;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#ffffff';

    for (const [i, j] of this.CONNECTIONS) {
      ctx.beginPath();
      ctx.moveTo((1 - lm[i].x) * w, lm[i].y * h);
      ctx.lineTo((1 - lm[j].x) * w, lm[j].y * h);
      ctx.stroke();
    }

    for (let i = 0; i < lm.length; i++) {
      const x = (1 - lm[i].x) * w;
      const y = lm[i].y * h;

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444'; // Red joint
      ctx.fill();
    }
  }

  dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  classifyGesture(lm) {
    const wrist = lm[0];

    const indexOpen = this.dist(lm[8], wrist) > this.dist(lm[6], wrist) * 1.15;
    const middleOpen = this.dist(lm[12], wrist) > this.dist(lm[10], wrist) * 1.15;
    const ringOpen = this.dist(lm[16], wrist) > this.dist(lm[14], wrist) * 1.15;
    const pinkyOpen = this.dist(lm[20], wrist) > this.dist(lm[18], wrist) * 1.15;
    const thumbOpen = this.dist(lm[4], lm[17]) > this.dist(lm[3], lm[17]) * 1.18;

    let count = 0;
    if (thumbOpen) count++;
    if (indexOpen) count++;
    if (middleOpen) count++;
    if (ringOpen) count++;
    if (pinkyOpen) count++;

    // Hand Center for 3D tilt
    const handX = (0.5 - lm[9].x) * 2.2;
    const handY = (lm[9].y - 0.5) * 2.2;
    if (this.onHandMove) this.onHandMove(handY, handX);

    let gesture = 'saturn';
    if (count === 0 || (!indexOpen && !middleOpen && !ringOpen && !pinkyOpen)) {
      gesture = 'heart';
    } else if (indexOpen && !middleOpen && !ringOpen && !pinkyOpen) {
      gesture = 'saturn';
    } else if (indexOpen && middleOpen && !ringOpen && !pinkyOpen) {
      gesture = 'text';
    } else if (count >= 5) {
      gesture = 'galaxy';
    }

    if (gesture === this.candidateGesture) {
      this.candidateCount++;
      if (this.candidateCount >= this.REQUIRED_FRAMES && this.currentGesture !== gesture) {
        this.currentGesture = gesture;
        if (this.onGestureChange) this.onGestureChange(this.currentGesture, count);
      }
    } else {
      this.candidateGesture = gesture;
      this.candidateCount = 0;
    }
  }
}
