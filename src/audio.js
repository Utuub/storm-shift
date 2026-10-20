// All sounds are synthesized with WebAudio, so there are no audio files.
let ctx = null;
let master = null;
let windNodes = null;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
}

function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export const sfx = {
  pickup() { tone(520, 0.08, 'triangle', 0.18, 760); },
  drop() { tone(300, 0.12, 'triangle', 0.15, 160); },
  ding(n = 0) { const f = 880 * Math.pow(1.06, Math.min(n, 12)); tone(f, 0.25, 'sine', 0.25); tone(f * 1.5, 0.3, 'sine', 0.12, null, 0.06); },
  buzz() { tone(110, 0.3, 'square', 0.12, 90); },
  cash() { tone(1200, 0.08, 'square', 0.08); tone(1600, 0.25, 'sine', 0.2, null, 0.08); },
  complete() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, null, i * 0.09)); },
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, null, i * 0.14)); },

  thunder() {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.5);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(1.6, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);
    src.connect(f).connect(g).connect(master);
    src.start();
  },

  wind(on) {
    if (!ctx) return;
    if (on && !windNodes) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(3);
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
      src.connect(f).connect(g).connect(master);
      src.start();
      lfo.start();
      windNodes = { src, lfo, g };
    } else if (!on && windNodes) {
      const { src, lfo, g } = windNodes;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
      src.stop(ctx.currentTime + 2.6);
      lfo.stop(ctx.currentTime + 2.6);
      windNodes = null;
    }
  },
};
