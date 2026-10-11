/**
 * ============================================================================
 * SCHEDULER ARCADE - audio.js
 * ============================================================================
 * Procedural 8-bit sound effects using the Web Audio API.
 * Zero external audio files required. Square, triangle, and noise oscillators
 * synthesized on the fly with volume control and muted states.
 * ============================================================================
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
    this.initialized = false;
  }

  init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.initialized = true;
      }
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(muted) {
    this.enabled = !muted;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Generic tone generator with frequency sweep and ADSR envelope.
   */
  playTone(freqStart, freqEnd, type, duration, gainMax = 1.0) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    this.resume();

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      if (freqEnd && freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), now + duration);
      }

      const peak = this.volume * gainMax;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {
      // Audio playback suppressed safely
    }
  }

  // 1. UI Click / Select beep
  playSelect() {
    this.playTone(440, 880, 'square', 0.08, 0.4);
  }

  // 2. Character jump / dash
  playJump() {
    this.playTone(180, 540, 'triangle', 0.15, 0.5);
  }

  // 3. Process dispatch / attack strike
  playAttack() {
    this.playTone(600, 150, 'sawtooth', 0.12, 0.6);
  }

  // 4. Context switch thud (impact/screen shake sound)
  playContextSwitch() {
    this.playTone(120, 40, 'square', 0.22, 0.8);
  }

  // 5. Process completion celebration chime
  playComplete() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    this.resume();

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.05, 'triangle', 0.12, 0.5);
      }, idx * 60);
    });
  }

  // 6. Preemption alert (urgent buzz)
  playPreempt() {
    this.playTone(320, 220, 'square', 0.18, 0.6);
  }

  // 7. Starvation alarm beep
  playStarvationAlert() {
    this.playTone(800, 750, 'square', 0.2, 0.5);
  }

  // 8. SLA violation / Damage hurt sound
  playHurt() {
    this.playTone(200, 80, 'sawtooth', 0.25, 0.7);
  }

  // 9. Victory Fanfare
  playVictory() {
    if (!this.enabled) return;
    const melody = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 659.25, d: 0.15 }, // E5
      { f: 783.99, d: 0.15 }, // G5
      { f: 1046.50, d: 0.35 } // C6
    ];
    let delay = 0;
    melody.forEach(note => {
      setTimeout(() => {
        this.playTone(note.f, note.f, 'triangle', note.d, 0.7);
      }, delay);
      delay += note.d * 1000 + 30;
    });
  }

  // 10. Defeat / Game Over
  playDefeat() {
    if (!this.enabled) return;
    const melody = [
      { f: 400, d: 0.2 },
      { f: 350, d: 0.2 },
      { f: 300, d: 0.25 },
      { f: 220, d: 0.5 }
    ];
    let delay = 0;
    melody.forEach(note => {
      setTimeout(() => {
        this.playTone(note.f, note.f * 0.9, 'sawtooth', note.d, 0.7);
      }, delay);
      delay += note.d * 1000 + 40;
    });
  }

  // 11. Power-up activated (Aging / SRTF Dash)
  playPowerUp() {
    this.playTone(300, 900, 'sine', 0.25, 0.6);
  }
}

export const audio = new SoundEngine();
