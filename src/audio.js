// All sounds are synthesized with WebAudio, so there are no audio files.
// Three volume channels: master -> (sfx, ambient).
let ctx = null;
let master = null;
let sfxBus = null;
let ambBus = null;
let windNodes = null;
let humNodes = null;
const vol = { master: 0.8, sfx: 0.8, ambient: 0.6 };

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  ambBus = ctx.createGain();
  sfxBus.connect(master);
  ambBus.connect(master);
  master.connect(ctx.destination);
  setVolumes(vol);
}

export function setVolumes(v) {
  Object.assign(vol, v);
  if (!ctx) return;
  master.gain.value = vol.master * 0.6;
  sfxBus.gain.value = vol.sfx;
  ambBus.gain.value = vol.ambient;
}

function tone(freq, dur, type = 'sine', v = 0.3, slideTo = null, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noise = null;
function noiseBuffer() {
  if (noise) return noise;
  const len = Math.floor(ctx.sampleRate * 3);
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

export const sfx = {
  pickup() { tone(520, 0.08, 'triangle', 0.18, 760); },
  drop() { tone(300, 0.12, 'triangle', 0.15, 160); },
  ding(n = 0) { const f = 880 * Math.pow(1.06, Math.min(n, 12)); tone(f, 0.25, 'sine', 0.25); tone(f * 1.5, 0.3, 'sine', 0.12, null, 0.06); },
  buzz() { tone(110, 0.3, 'square', 0.12, 90); },
  click() { tone(900, 0.04, 'square', 0.05); },
  cash() { tone(1200, 0.08, 'square', 0.08); tone(1600, 0.25, 'sine', 0.2, null, 0.08); },
  complete() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, null, i * 0.09)); },
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, null, i * 0.14)); },
  blip() { tone(660, 0.05, 'square', 0.06); },

  thunder() {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(1.6, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    src.connect(f).connect(g).connect(ambBus);
    src.start();
    src.stop(t + 2.5);
  },

  wind(on) {
    if (!ctx) return;
    if (on && !windNodes) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 500;
      f.Q.value = 0.7;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.35;
      lfoGain.gain.value = 300;
      lfo.connect(lfoGain).connect(f.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 1.2);
      src.connect(f).connect(g).connect(ambBus);
      src.start();
      lfo.start();
      windNodes = { src, lfo, g };
    } else if (!on && windNodes) {
      const { src, lfo, g } = windNodes;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(Math.max(0.001, g.gain.value), ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      src.stop(ctx.currentTime + 2.6);
      lfo.stop(ctx.currentTime + 2.6);
      windNodes = null;
    }
  },

  // quiet fluorescent-light hum while working
  hum(on) {
    if (!ctx) return;
    if (on && !humNodes) {
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 60;
      o2.type = 'sine'; o2.frequency.value = 120;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 300;
      g.gain.value = 0.025;
      o.connect(f); o2.connect(f); f.connect(g).connect(ambBus);
      o.start(); o2.start();
      humNodes = { o, o2 };
    } else if (!on && humNodes) {
      humNodes.o.stop(); humNodes.o2.stop();
      humNodes = null;
    }
  },
};
