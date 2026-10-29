/**
 * Cyberpunk & Cosmic Sound Synthesizer via Web Audio API
 * Generates futuristic procedural sound effects without external audio files.
 */
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.masterGain = null;
    this.heartbeatTimer = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  }

  ensureContext() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.25, this.ctx.currentTime);
    }
    return this.muted;
  }

  /**
   * Sound effect when particles morph into a new shape
   */
  playMorph(shape) {
    if (this.muted) return;
    this.ensureContext();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    switch (shape) {
      case 'heart':
        this.playChord([220, 277.18, 329.63, 440], 0.8, 'sine');
        this.triggerHeartThump(t + 0.1);
        break;

      case 'text': // "I LOVE YOU"
        this.playArpeggio([523.25, 659.25, 783.99, 1046.50, 1318.51], 0.1, 0.9, 'triangle');
        break;

      case 'saturn':
        this.playChord([146.83, 220, 293.66, 440, 587.33], 1.2, 'sine');
        this.playWhoosh(150, 600, 0.7);
        break;

      case 'galaxy':
        this.playWhoosh(120, 900, 1.2);
        this.playChord([196, 261.63, 392, 523.25], 1.4, 'sine');
        break;

      case 'fireworks':
        this.playWhoosh(80, 1200, 0.4);
        setTimeout(() => {
          this.playBurst();
        }, 350);
        break;

      case 'helix':
        this.playArpeggio([440, 554.37, 659.25, 880, 1108.73], 0.08, 0.7, 'sawtooth');
        break;

      default:
        this.playChord([330, 440, 550], 0.6, 'sine');
        break;
    }
  }

  playChord(frequencies, duration, type = 'sine') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    frequencies.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2500, t);

      const amp = (0.2 / frequencies.length) * (1 - i * 0.15);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(amp, t + 0.05 + i * 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + duration + 0.1);
    });
  }

  playArpeggio(notes, stepTime, noteDur, type = 'sine') {
    if (!this.ctx || this.muted) return;
    const startTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const t = startTime + idx * stepTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + noteDur);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + noteDur + 0.05);
    });
  }

  playWhoosh(startFreq, endFreq, duration) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(endFreq * 0.8, t);
    filter.Q.setValueAtTime(3.0, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }

  playBurst() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;

    // Multi-frequency sparkle
    const freqs = [880, 1046.5, 1318.5, 1760, 2093];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.03);

      gain.gain.setValueAtTime(0, t + idx * 0.03);
      gain.gain.linearRampToValueAtTime(0.12, t + idx * 0.03 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.03 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.03);
      osc.stop(t + idx * 0.03 + 0.45);
    });
  }

  triggerHeartThump(time) {
    if (!this.ctx || this.muted) return;
    const t = time || this.ctx.currentTime;

    // Sub-bass kick (lub-dub)
    [0, 0.22].forEach((offset, idx) => {
      const hitTime = t + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 80 : 65, hitTime);
      osc.frequency.exponentialRampToValueAtTime(35, hitTime + 0.15);

      gain.gain.setValueAtTime(0.25, hitTime);
      gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(hitTime);
      osc.stop(hitTime + 0.22);
    });
  }

  startHeartbeatLoop() {
    this.stopHeartbeatLoop();
    this.heartbeatTimer = setInterval(() => {
      this.triggerHeartThump();
    }, 1100);
  }

  stopHeartbeatLoop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  playPinchBoom() {
    if (!this.ctx || this.muted) return;
    this.ensureContext();
    const t = this.ctx.currentTime;

    // High explosion sound
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.4);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.5);

    this.playBurst();
  }
}

export const soundEngine = new SoundEngine();
