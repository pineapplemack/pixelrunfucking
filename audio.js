'use strict';

/* WebAudio 合成音效：零外部文件 */
const Sfx = {
  ac: null,
  master: null,
  muted: false,
  volume: 0.6,

  unlock() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume * 0.4;
      this.master.connect(this.ac.destination);
    }
    if (this.ac.state === 'suspended') this.ac.resume();
  },

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v * 0.4;
  },

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume * 0.4;
  },

  tone(freq, dur, type, vol, slideTo, delay) {
    if (this.muted) return;
    this.unlock();
    if (!this.ac) return;
    const t0 = this.ac.currentTime + (delay || 0);
    const o = this.ac.createOscillator();
    const g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(25, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol || 0.25), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  },

  noise(dur, vol) {
    if (this.muted) return;
    this.unlock();
    if (!this.ac) return;
    const len = Math.floor(this.ac.sampleRate * dur);
    const buf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ac.createBufferSource();
    const g = this.ac.createGain();
    g.gain.value = vol || 0.15;
    src.buffer = buf;
    src.connect(g); g.connect(this.master);
    src.start();
  },

  doubleJump() {
    if (this.muted) return;
    this.tone(620, 0.07, 'square', 0.06, 880);
    this.tone(980, 0.09, 'triangle', 0.05, 1240, 0.04);
  },

  spring() {
    if (this.muted) return;
    this.tone(300, 0.18, 'square', 0.07, 1000);
  },

  jump() { this.tone(300, 0.13, 'square', 0.18, 620); },
  coin() { this.tone(988, 0.07, 'square', 0.16); this.tone(1319, 0.16, 'square', 0.16, null, 0.07); },
  stomp() { this.tone(240, 0.09, 'square', 0.2, 90); },
  bump() { this.tone(160, 0.07, 'square', 0.18, 110); },
  brick() { this.noise(0.16, 0.18); this.tone(180, 0.09, 'square', 0.12, 60); },
  power() {
    const seq = [392, 523, 659, 784, 1047];
    seq.forEach((f, i) => this.tone(f, 0.09, 'square', 0.15, null, i * 0.06));
  },
  fire() { this.tone(700, 0.08, 'sawtooth', 0.13, 240); },
  hurt() { this.tone(420, 0.22, 'square', 0.2, 130); },
  die() {
    const seq = [523, 494, 440, 392, 330, 262, 196];
    seq.forEach((f, i) => this.tone(f, 0.11, 'square', 0.18, null, i * 0.09));
  },
  clear() {
    const seq = [523, 659, 784, 1047, 784, 1047, 1319];
    seq.forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.2, null, i * 0.1));
  },
  oneup() {
    [659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.10, 'triangle', 0.18, null, i * 0.07));
  },
  dash() { this.tone(520, 0.10, 'sawtooth', 0.13, 180); },
  kick() { this.tone(320, 0.08, 'square', 0.16, 760); }
};
