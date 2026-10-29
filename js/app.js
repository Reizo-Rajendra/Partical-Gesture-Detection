import { ParticleEngine } from './particles.js';
import { GestureDetector } from './gestures.js';
import { soundEngine } from './audio.js';

/**
 * Clean & Minimal Application Coordinator
 * Side-by-side Hand Sensor Monitor and 3D Particle Space (matches photo).
 */
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');
  const video = document.getElementById('webcam-video');
  const overlayCanvas = document.getElementById('webcam-overlay');
  const sensorWindow = document.querySelector('.sensor-window');
  const startCameraBtn = document.getElementById('btn-start-camera');
  const telemetryInfo = document.getElementById('telemetry-info');
  const gestureTag = document.getElementById('gesture-tag');
  const gestureIcon = document.getElementById('gesture-icon');
  const gestureName = document.getElementById('gesture-name');
  const customTextInput = document.getElementById('custom-text-input');
  const btnApplyText = document.getElementById('btn-apply-text');

  // Initialize Particle Engine with Saturn as default (matching photo)
  const engine = new ParticleEngine(container);
  engine.applyShape('saturn', true);

  const GESTURE_MAP = {
    saturn: { icon: '☝️', name: '1 FINGER [SATURN]' },
    text: { icon: '✌️', name: '2 FINGERS [I LOVE YOU]' },
    heart: { icon: '✊', name: 'FIST [HEART]' },
    galaxy: { icon: '🖐️', name: '5 FINGERS [GALAXY]' },
    fireworks: { icon: '🤟', name: '3 FINGERS [FIREWORKS]' },
    helix: { icon: '🖖', name: '4 FINGERS [DNA HELIX]' }
  };

  let activeShape = 'saturn';
  let currentFps = 30;
  let currentFingers = 1;

  function updateTelemetry() {
    const info = GESTURE_MAP[activeShape] || { name: activeShape.toUpperCase() };
    telemetryInfo.textContent = `FPS: ${currentFps} | GESTURE: ${info.name}`;
  }

  // Handle Gesture Change
  function onGestureRecognized(shapeKey, fingerCount) {
    if (activeShape === shapeKey) return;
    activeShape = shapeKey;
    currentFingers = fingerCount;

    const info = GESTURE_MAP[shapeKey] || { icon: '✨', name: shapeKey.toUpperCase() };
    gestureIcon.textContent = info.icon;
    gestureName.textContent = shapeKey.toUpperCase();

    // Morph 3D Particles
    engine.applyShape(shapeKey, false);

    // Audio
    soundEngine.playMorph(shapeKey);
    if (shapeKey === 'heart') {
      soundEngine.startHeartbeatLoop();
    } else {
      soundEngine.stopHeartbeatLoop();
    }

    updateTelemetry();

    // Tag pulse
    gestureTag.classList.add('pulse');
    setTimeout(() => gestureTag.classList.remove('pulse'), 500);
  }

  // Handle Hand Move
  function onHandMove(rotX, rotY, scale) {
    engine.setHandControl(rotX, rotY, scale);
  }

  // Handle Pinch
  let pinchActiveLast = false;
  function onPinch(isPinching, pinchX, pinchY) {
    engine.setPinch(isPinching, pinchX, pinchY);
    if (isPinching !== pinchActiveLast) {
      if (!isPinching) {
        soundEngine.playPinchBoom();
      }
      pinchActiveLast = isPinching;
    }
  }

  // Handle FPS update from vision detector
  function onFpsUpdate(fps) {
    currentFps = fps;
    updateTelemetry();
  }

  // Initialize Detector
  const detector = new GestureDetector(
    video,
    overlayCanvas,
    onGestureRecognized,
    onHandMove,
    onPinch,
    onFpsUpdate
  );

  function syncCanvasSize() {
    overlayCanvas.width = video.videoWidth || 640;
    overlayCanvas.height = video.videoHeight || 480;
  }
  video.addEventListener('loadedmetadata', syncCanvasSize);

  // Start Camera Function
  async function activateCamera() {
    startCameraBtn.disabled = true;
    startCameraBtn.textContent = 'STARTING...';
    try {
      soundEngine.ensureContext();
      await detector.start();
      syncCanvasSize();
      sensorWindow.classList.add('active');
    } catch (err) {
      console.warn('Camera permission issue:', err);
      startCameraBtn.disabled = false;
      startCameraBtn.textContent = 'IZINKAN KAMERA';
    }
  }

  startCameraBtn.addEventListener('click', activateCamera);

  // Auto-start camera immediately on page load
  activateCamera();

  // Custom Text Input for 2-finger gesture
  function applyCustomText() {
    const text = customTextInput.value.trim() || 'I LOVE YOU';
    engine.setCustomText(text);
    if (activeShape === 'text') {
      engine.applyShape('text', false);
      soundEngine.playMorph('text');
    }
  }
  btnApplyText.addEventListener('click', applyCustomText);
  customTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyCustomText();
  });

  // Render Loop
  function animate() {
    requestAnimationFrame(animate);
    engine.update();
  }
  animate();
});
