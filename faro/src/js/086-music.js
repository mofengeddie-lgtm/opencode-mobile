'use strict';
// Música propia (v1.1): melodías generadas por el juego con Web Audio, sin archivos.
// Vestíbulo: tranquila (acordes suaves y arpegio). Partida: más rápida, con bajo; cuando hay
// combate se suman bombo, caja y platillos. Volumen guardado en el aparato.

const MUSIC_THEMES = {
  // Acordes por compás (notas MIDI) y tempo.
  lobby: { bpm: 84, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], bass: false, arp: [0, 1, 2, 1, 0, 1, 2, 1] },
  battle: { bpm: 112, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], bass: true, arp: [0, 2, 1, 2, 0, 2, 1, 2] },
};
const MUSIC_LEVELS = [0, 0.3, 0.6, 1];

class Music {
  constructor(sound) {
    this.sound = sound;
    this.theme = null;
    this.intensity = 0;
    this.step = 0;
    this.nextT = 0;
    this.timer = null;
    this.level = 0.6;
    try {
      const v = Number(localStorage.getItem('faro-music'));
      if (localStorage.getItem('faro-music') !== null && MUSIC_LEVELS.includes(v)) this.level = v;
    } catch (err) { /* sin almacenamiento */ }
    this.notes = 0;
  }

  get playing() {
    return !!this.timer;
  }

  setLevel(v) {
    this.level = v;
    try { localStorage.setItem('faro-music', String(v)); } catch (err) { /* sin almacenamiento */ }
    if (this.gain) this.gain.gain.setTargetAtTime(this.volume(), this.sound.ctx.currentTime, 0.2);
    if (v > 0 && this.theme && !this.timer) this.start(this.theme);
    if (v === 0) this.stop();
  }

  volume() {
    return this.sound.on ? this.level * 0.35 : 0;
  }

  // Elige la melodía (lobby o battle) y empieza si el audio ya está desbloqueado.
  play(theme) {
    this.theme = theme;
    if (!this.sound.ctx || this.level === 0) return;
    if (this.timer && this.current === theme) return;
    this.start(theme);
  }

  start(theme) {
    const c = this.sound.ctx;
    if (!c) return;
    if (!this.gain) {
      this.gain = c.createGain();
      this.gain.connect(this.sound.master);
    }
    this.gain.gain.setTargetAtTime(this.volume(), c.currentTime, 0.3);
    this.current = theme;
    this.step = 0;
    this.nextT = c.currentTime + 0.1;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 90);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.current = null;
  }

  // 0 = calma, 1 = combate: suma percusión en la partida. Sube o baja con el tiempo real (no con los cuadros).
  setIntensity(k) {
    this.target = Math.max(0, Math.min(1, k));
  }

  refreshVolume() {
    if (this.gain && this.sound.ctx) this.gain.gain.setTargetAtTime(this.volume(), this.sound.ctx.currentTime, 0.2);
  }

  midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  tick() {
    const c = this.sound.ctx;
    if (!c || !this.current) return;
    if (c.state !== 'running') return;
    this.intensity += ((this.target || 0) - this.intensity) * 0.12;
    const T = MUSIC_THEMES[this.current];
    const eighth = 60 / T.bpm / 2;
    while (this.nextT < c.currentTime + 0.35) {
      this.playStep(T, this.step, this.nextT, eighth);
      this.step = (this.step + 1) % 64;
      this.nextT += eighth;
    }
  }

  playStep(T, step, t, eighth) {
    const bar = Math.floor(step / 16) % T.chords.length;
    const inBar = step % 16;
    const chord = T.chords[bar];
    // Acorde de fondo al empezar cada compás.
    if (inBar === 0) for (const n of chord) this.pad(this.midi(n), t, eighth * 16);
    // Arpegio una octava arriba en corcheas.
    if (inBar % 2 === 0 || this.current === 'battle') {
      const n = chord[T.arp[inBar % 8]] + 12;
      this.pluck(this.midi(n), t, eighth * 1.6, this.current === 'battle' ? 0.05 : 0.06);
    }
    if (T.bass && inBar % 4 === 0) this.bass(this.midi(chord[0] - 12), t, eighth * 3.2);
    if (this.current === 'battle') {
      const k = this.intensity;
      if (k > 0.25 && inBar % 8 === 0) this.kick(t);
      if (k > 0.25 && inBar % 8 === 4) this.snare(t);
      if (k > 0.55 && inBar % 2 === 1) this.hat(t);
    }
  }

  env(t, a, d, peak) {
    const c = this.sound.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(this.gain);
    return g;
  }

  osc(type, f, t, dur, g) {
    const o = this.sound.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
    this.notes++;
    return o;
  }

  pad(f, t, dur) {
    const g = this.env(t, dur * 0.3, dur * 0.7, 0.035);
    this.osc('triangle', f, t, dur, g);
    this.osc('triangle', f * 1.004, t, dur, g);
  }

  pluck(f, t, dur, vol) {
    this.osc('sine', f, t, dur, this.env(t, 0.01, dur, vol));
  }

  bass(f, t, dur) {
    const c = this.sound.ctx;
    const g = this.env(t, 0.02, dur, 0.09);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.connect(g);
    this.osc('sawtooth', f, t, dur, lp);
  }

  kick(t) {
    this.drums = (this.drums || 0) + 1;
    const g = this.env(t, 0.005, 0.25, 0.22);
    const o = this.osc('sine', 120, t, 0.3, g);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
  }

  noise(t, dur, type, freq, vol) {
    const c = this.sound.ctx;
    if (!this.sound.noise) return;
    const src = c.createBufferSource();
    src.buffer = this.sound.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    src.connect(f);
    f.connect(this.env(t, 0.003, dur, vol));
    src.start(t, Math.random() * 0.5, dur + 0.05);
    this.notes++;
  }

  snare(t) {
    this.noise(t, 0.16, 'bandpass', 1800, 0.12);
  }

  hat(t) {
    this.noise(t, 0.05, 'highpass', 7000, 0.05);
  }
}
