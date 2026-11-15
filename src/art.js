// Hand-drawn picture for every product (canvas 2D, no image files).
// Used on package labels (textures.js) and as HUD icons (hud.js).
// Every picture is drawn in a -50..50 box, then scaled to the size asked for.

const INK = '#3a2618';
const TAU = Math.PI * 2;
let g = null; // the canvas context being drawn on

// ---------- drawing helpers ----------
function ol(fill, lw = 3) {
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
}
function E(x, y, rx, ry, fill, rot = 0, lw = 3) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); ol(fill, lw); }
function R(x, y, w, h, fill, r = 4, rot = 0, lw = 3) {
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, r); ol(fill, lw); g.restore();
}
function P(pts, fill, lw = 3) {
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); ol(fill, lw);
}
function S(d, fill, lw = 3) {
  const p = new Path2D(d);
  if (fill) { g.fillStyle = fill; g.fill(p); }
  if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(p); }
}
// stroked line with a dark edge under it
function L(d, color, w = 5, edge = true) {
  const p = new Path2D(d);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (edge) { g.strokeStyle = INK; g.lineWidth = w + 4; g.stroke(p); }
  g.strokeStyle = color; g.lineWidth = w; g.stroke(p);
}
function D(x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); }
function hi(x, y, rx = 6, ry = 3, rot = -0.6) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill(); }
function T(x, y, rot, fn, s = 1) { g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); fn(); g.restore(); }
function rnd(seed) { let s = seed * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
// scatter n things inside an ellipse, the same way every time
function sc(n, seed, fn, rx = 30, ry = 20, cx = 0, cy = 0) {
  const r = rnd(seed);
  for (let i = 0; i < n; i++) { const a = r() * TAU, k = Math.sqrt(r()); fn(cx + Math.cos(a) * k * rx, cy + Math.sin(a) * k * ry, r(), i); }
}
function dk(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 - a))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function ring(x, y, ro, ri, fill, sy = 1, lw = 3) {
  const p = new Path2D();
  p.ellipse(x, y, ro, ro * sy, 0, 0, TAU);
  p.moveTo(x + ri, y);
  p.ellipse(x, y, ri, ri * sy, 0, 0, TAU);
  g.fillStyle = fill; g.fill(p, 'evenodd');
  if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(p); }
}
function txt(s, x, y, size, color = '#fff') {
  g.font = `bold ${size}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y);
}

// ---------- small reusable bits ----------
const leaf = (x, y, rot = 0, c = '#4c9a3a', s = 1) => T(x, y, rot, () => {
  S('M0 0 Q9 -11 22 0 Q9 11 0 0Z', c, 2.5); L('M3 0 L17 0', 'rgba(0,0,0,0.3)', 1.2, false);
}, s);
const steam = (x, y) => { for (const dx of [-10, 0, 10]) L(`M${x + dx} ${y} q-5 -5 0 -10 q5 -5 0 -10`, 'rgba(130,140,150,0.8)', 2.5, false); };
const spark = (x, y, s = 6, c = '#ffd23a') => P([[x, y - s], [x + s * 0.28, y - s * 0.28], [x + s, y], [x + s * 0.28, y + s * 0.28],
  [x, y + s], [x - s * 0.28, y + s * 0.28], [x - s, y], [x - s * 0.28, y - s * 0.28]], c, 1.5);
const bub = (x, y, r) => { E(x, y, r, r, 'rgba(190,230,255,0.85)', 0, 2); hi(x - r * 0.3, y - r * 0.3, r * 0.3, r * 0.2); };
const flame = (x, y, s = 1) => T(x, y, 0, () => {
  S('M0 -18 C10 -8 14 0 10 10 C8 18 -8 18 -10 10 C-13 2 -6 -2 -4 -10 C-2 -6 0 -6 0 -18Z', '#f2641a', 2.5);
  S('M0 -2 C5 3 6 8 3 12 C0 15 -5 13 -5 8 C-5 4 -1 2 0 -2Z', '#ffd23a', 0);
}, s);
function cube(x, y, s, c) {
  const k = s * 0.5;
  P([[x, y - s], [x + s, y - k], [x, y], [x - s, y - k]], c, 2.5);
  P([[x - s, y - k], [x, y], [x, y + s], [x - s, y + k]], dk(c, 0.12), 2.5);
  P([[x + s, y - k], [x, y], [x, y + s], [x + s, y + k]], dk(c, 0.25), 2.5);
}
function wheat(x, y, rot = 0, c = '#d9a53a', s = 1) {
  T(x, y, rot, () => {
    L('M0 30 L0 -8', c, 2.5);
    for (let i = 0; i < 4; i++) { E(-5, 6 - i * 9, 4, 6.5, c, -0.5, 2); E(5, 6 - i * 9, 4, 6.5, c, 0.5, 2); }
    E(0, -30, 4, 7, c, 0, 2);
  }, s);
}
function slice(x, y, r, c, rind) {
  E(x, y, r, r, rind); D(x, y, r * 0.8, c);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; L(`M${x - Math.cos(a) * r * 0.75} ${y - Math.sin(a) * r * 0.75} L${x + Math.cos(a) * r * 0.75} ${y + Math.sin(a) * r * 0.75}`, 'rgba(255,255,255,0.7)', 1.6, false); }
  D(x, y, r * 0.12, '#fff6d8');
}
function bone(x, y, len, th, c, rot = 0) {
  T(x, y, rot, () => {
    const h = len / 2, k = th * 0.75;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) E(sx * h, sy * k * 0.7, k, k, c, 0, 3);
    R(0, 0, len, th, c, 2, 0, 3);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) D(sx * h, sy * k * 0.7, k - 1.5, c);
    g.fillStyle = c; g.fillRect(-h, -th / 2 + 1.5, len, th - 3);
  });
}
function paw(x, y, s, c) { E(x, y + s * 0.3, s * 0.6, s * 0.5, c, 0, 0); for (const [dx, dy] of [[-0.7, -0.2], [-0.25, -0.65], [0.25, -0.65], [0.7, -0.2]]) D(x + dx * s, y + dy * s, s * 0.24, c); }
function fish(c, o = {}) {
  S('M-36 0 Q-12 -24 14 -8 L34 -20 Q28 0 34 20 L14 8 Q-12 24 -36 0Z', c);
  if (o.stripes) for (const x of [-14, -2, 9]) L(`M${x} -13 Q${x + 4} 0 ${x} 13`, o.stripes, 3.5, false);
  S('M-8 -15 Q0 -28 8 -11', c, 2.5);
  D(-24, -3, 3.4, '#fff'); D(-24.6, -3, 1.8, INK);
  L('M-16 -8 Q-12 0 -16 8', 'rgba(0,0,0,0.35)', 1.5, false);
}

// ---------- containers ----------
// A bowl with something in it. fn draws the toppings (clipped to the surface).
function bowl(content, fn, col = '#e9eef5', mound = false) {
  if (mound) S('M-32 -6 Q-31 -38 0 -38 Q31 -38 32 -6Z', content);
  S('M-38 -6 Q-36 28 -16 34 L16 34 Q36 28 38 -6Z', col);
  if (!mound) E(0, -6, 38, 11, content);
  if (fn) {
    g.save();
    if (!mound) { g.beginPath(); g.ellipse(0, -6, 36, 9.5, 0, 0, TAU); g.clip(); }
    fn(); g.restore();
  }
  L('M-28 8 Q-24 22 -14 27', 'rgba(255,255,255,0.5)', 2.5, false);
}
function glass(c, o = {}) {
  S('M-22 -30 L-16 32 L16 32 L22 -30Z', 'rgba(225,240,250,0.7)', 0);
  S('M-20.6 -18 L-15 31 L15 31 L20.6 -18Z', c, 0);
  if (o.ice) { R(-6, -6, 13, 13, 'rgba(235,248,255,0.85)', 2, 0.3, 2); R(7, 9, 12, 12, 'rgba(235,248,255,0.85)', 2, -0.4, 2); }
  if (o.bub) for (const [x, y] of [[-8, 16], [4, 22], [10, -4], [-3, 4]]) D(x, y, 1.8, 'rgba(255,255,255,0.8)');
  if (o.straw) { L('M4 22 L18 -44', o.straw, 4); }
  S('M-22 -30 L-16 32 L16 32 L22 -30Z', '', 3);
  if (o.foam) for (const x of [-15, -5, 5, 15]) E(x, -20, 8, 7, '#fff8e8', 0, 2.5);
  if (o.lemon) slice(22, -30, 11, o.lemon, '#f5d63a');
  hi(-13, 2, 2.5, 14, 0.1);
}
function mug(c, liquid, o = {}) {
  L('M22 -4 Q42 -4 42 9 Q42 22 22 22', c, 6);
  R(0, 8, 48, 48, c, 7);
  E(0, -15, 24, 7, liquid);
  if (o.marsh) { R(-8, -17, 9, 7, '#fff', 2, 0.2, 2); R(5, -14, 9, 7, '#fff', 2, -0.3, 2); R(-1, -22, 9, 7, '#fff', 2, 0.5, 2); }
  if (o.foam) for (const x of [-16, -6, 5, 15]) E(x, -18, 8, 7, '#fff3d8', 0, 2.5);
  if (o.steam) steam(0, -26);
  if (o.fn) o.fn();
  hi(-15, 8, 3, 13, 0);
}
function jugIcon(cap, label) {
  S('M-10 -34 L10 -34 L10 -27 L26 -12 L26 36 L-26 36 L-26 -12 L-10 -27Z', '#f7f7f2');
  R(0, -37, 22, 9, cap, 3);
  E(15, -4, 5, 8, 'rgba(0,0,0,0.12)', 0.3, 2);
  R(-3, 16, 38, 22, cap, 3, 0, 2.5);
  txt(label, -3, 17, 13);
}
// squeeze / pump / spray bottle pictures
function bottleIcon(c, top, deco) {
  R(0, 12, 34, 50, c, 9);
  R(0, 16, 24, 22, 'rgba(255,255,255,0.85)', 4, 0, 2);
  if (top === 'pump') { R(0, -18, 12, 10, '#e8e8ee', 2); L('M0 -24 L0 -34 L-16 -34', '#e8e8ee', 5); }
  else if (top === 'cone') { P([[-9, -13], [9, -13], [3, -34], [-3, -34]], dk(c, 0.2)); }
  else if (top === 'spray') {
    R(0, -18, 12, 10, '#f4f4f4', 2);
    P([[-18, -38], [12, -38], [12, -24], [-8, -24]], '#f4f4f4'); L('M-2 -24 Q-10 -18 -8 -10', '#f4f4f4', 4);
    for (const [x, y] of [[-26, -40], [-32, -34], [-27, -30], [-36, -42], [-36, -28]]) D(x, y, 2, '#6cc0f0');
  } else R(0, -18, 16, 10, dk(c, 0.25), 3);
  if (deco) deco();
}

// ---------- produce ----------
const apple = (c) => {
  S('M0 -18 C-14 -30 -36 -18 -32 6 C-30 28 -12 38 0 32 C12 38 30 28 32 6 C36 -18 14 -30 0 -18Z', c);
  L('M0 -18 Q2 -30 8 -34', '#6b4423', 3.5); leaf(6, -28, -0.5); hi(-17, -6, 7, 4);
};
const orange = () => { E(0, 4, 33, 32, '#f28a1c'); sc(16, 3, (x, y) => D(x, y, 1.2, 'rgba(160,70,0,0.45)'), 26, 24, 0, 6); leaf(-2, -28, -0.3); D(0, -27, 3, '#5a7a2a'); hi(-14, -10, 7, 4); };
const lemon = (c) => { S('M-40 2 Q-32 -4 -27 -12 C-12 -32 16 -30 28 -10 Q33 -2 40 0 Q33 6 28 14 C14 32 -14 30 -27 14 Q-32 6 -40 2Z', c); hi(-10, -10, 9, 4, -0.2); };
const tomato = (basil) => {
  E(0, 6, 35, 29, '#e0412d');
  P([[0, -22], [5, -14], [16, -17], [8, -9], [12, 0], [0, -8], [-12, 0], [-8, -9], [-16, -17], [-5, -14]], '#3f8f2f', 2.5);
  hi(-16, -2, 7, 4); if (basil) { leaf(8, 30, -0.5, '#3f9a3a', 1.3); leaf(8, 30, 0.2, '#58b04a', 1.1); }
};
const potato = () => { S('M-34 4 C-36 -16 -10 -26 8 -20 C30 -18 40 -4 34 12 C28 28 -4 30 -18 24 C-30 20 -34 14 -34 4Z', '#b08552'); for (const [x, y] of [[-14, -4], [6, 8], [18, -8], [-4, 16]]) E(x, y, 3, 1.6, '#7a5630', 0.4, 0); hi(-16, -12, 7, 3); };
const onion = (c) => {
  S('M0 -36 Q4 -24 14 -18 C38 -6 36 30 0 32 C-36 30 -38 -6 -14 -18 Q-4 -24 0 -36Z', c);
  L('M-2 -22 Q-20 0 -8 30', 'rgba(120,70,10,0.4)', 1.6, false); L('M2 -22 Q20 0 8 30', 'rgba(120,70,10,0.4)', 1.6, false);
  for (const x of [-5, 0, 5]) L(`M${x} 32 L${x * 1.6} 39`, '#8a6a3a', 1.5, false); hi(-17, -2, 5, 8, 0.4);
};
const onionHalf = () => {
  S('M0 -36 Q4 -24 14 -18 C38 -6 36 30 0 32 C-36 30 -38 -6 -14 -18 Q-4 -24 0 -36Z', '#b05a8a');
  S('M0 -24 Q4 -18 10 -14 C28 -4 27 24 0 26 C-27 24 -28 -4 -10 -14 Q-4 -18 0 -24Z', '#fbf3e6', 2);
  for (const k of [0.72, 0.46, 0.22]) T(0, 3, 0, () => S('M0 -24 C26 -14 27 24 0 26 C-27 24 -26 -14 0 -24Z', '', 1.6), k);
};
const avocado = () => {
  S('M0 -38 C14 -36 16 -14 26 2 C36 20 20 38 0 38 C-20 38 -36 20 -26 2 C-16 -14 -14 -36 0 -38Z', '#3d5a26');
  S('M0 -31 C10 -29 12 -12 20 3 C28 18 16 32 0 32 C-16 32 -28 18 -20 3 C-12 -12 -10 -29 0 -31Z', '#cfe08a', 0);
  E(0, 13, 11, 12, '#8a5a2a'); hi(-4, 8, 3, 2);
};
const peach = () => {
  E(0, 4, 33, 31, '#f6a777');
  g.save(); g.beginPath(); g.ellipse(0, 4, 31.5, 29.5, 0, 0, TAU); g.clip(); E(22, 12, 26, 28, 'rgba(216,67,58,0.55)', 0, 0); g.restore();
  L('M2 -26 Q-10 0 0 34', 'rgba(150,60,30,0.5)', 2, false); leaf(4, -27, -0.4); hi(-16, -6, 6, 4);
};
const melon = () => {
  E(-6, -2, 31, 31, '#d8c38c');
  for (const d of ['M-34 -8 Q-6 6 22 -14', 'M-30 12 Q-6 22 22 8', 'M-22 -28 Q-12 0 -22 26', 'M4 -32 Q14 0 4 28']) L(d, 'rgba(120,100,50,0.45)', 1.5, false);
  S('M-8 34 Q18 40 40 10 Q22 20 -8 34Z', '#6fa04a'); S('M-2 31 Q18 34 36 13 Q20 20 -2 31Z', '#f6a94a', 0);
};
const banana = () => { S('M-38 -16 Q-30 22 6 27 Q32 27 40 6 Q41 1 36 0 Q24 13 6 11 Q-18 8 -29 -20Z', '#f3d34a'); E(-34, -19, 4, 3.5, '#6b4a1a', 0.5, 2); E(38, 3, 3, 3.5, '#6b4a1a', 0, 2); L('M-24 -4 Q-10 16 14 18', 'rgba(170,120,0,0.5)', 1.6, false); };
const strawberry = () => {
  S('M0 38 C-30 20 -38 -4 -28 -16 C-18 -26 18 -26 28 -16 C38 -4 30 20 0 38Z', '#e2283a');
  for (const [x, y] of [[-14, -6], [0, -8], [14, -6], [-8, 6], [8, 6], [0, 18], [-17, 8], [17, 8]]) E(x, y, 1.6, 2.4, '#ffe08a', 0, 0);
  P([[0, -30], [6, -20], [20, -24], [12, -14], [0, -18], [-12, -14], [-20, -24], [-6, -20]], '#3f8f2f', 2.5); hi(-16, -8, 5, 3);
};
const grapes = () => {
  L('M0 -24 L2 -38', '#6b4a1a', 3); leaf(4, -30, -0.2, '#4c9a3a', 1.2);
  for (const [x, y] of [[-18, -16], [0, -16], [18, -16], [-9, -2], [9, -2], [-18, 0], [18, 0], [0, 12], [-9, 14], [9, 14], [0, 28]]) { E(x, y, 10, 10, '#7a2a9a', 0, 2.5); hi(x - 3, y - 3, 3, 2); }
};
const pumpkin = () => { E(-18, 8, 16, 24, '#e57b25'); E(18, 8, 16, 24, '#e57b25'); E(0, 8, 18, 27, '#f08a2a'); S('M-5 -18 Q-4 -32 6 -34 L9 -28 Q4 -26 5 -18Z', '#5a7a2a', 2.5); hi(-6, -4, 4, 8, 0.2); };
const mushroom = () => { S('M-12 2 L-9 30 Q0 36 9 30 L12 2Z', '#f3ead8'); S('M-36 6 C-34 -34 34 -34 36 6 Q0 14 -36 6Z', '#b88a5a'); for (const [x, y, r] of [[-16, -8, 5], [6, -16, 4], [18, -2, 3.5]]) D(x, y, r, '#e9d8bc'); };
const corn = () => {
  T(0, 0, -0.5, () => {
    E(0, -4, 15, 34, '#f4c53a');
    for (let y = -30; y < 24; y += 8) for (let x = -9; x <= 9; x += 6) D(x + ((y / 8) % 2 ? 0 : 3), y, 2.3, 'rgba(190,130,0,0.55)');
    S('M-16 6 Q-22 30 0 40 Q-2 20 -16 6Z', '#5aa83a'); S('M16 6 Q22 30 0 40 Q2 20 16 6Z', '#4c9a3a');
  });
};
const peaPod = () => { S('M-38 -8 Q0 34 38 -8 Q0 8 -38 -8Z', '#3d9b3d'); for (const [x, y] of [[-21, 1], [-7, 6], [7, 6], [21, 1]]) { E(x, y - 4, 7.5, 7.5, '#7ad04a', 0, 2.5); hi(x - 2, y - 7, 2.5, 1.5); } leaf(-38, -8, -2.4, '#3d9b3d', 0.6); };
const carrot = () => { leaf(-14, -22, -2.2, '#4c9a3a', 0.9); leaf(-14, -22, -1.5, '#58b04a', 0.9); P([[-22, -22], [-8, -30], [34, 30]], '#f2781a'); for (const [x, y] of [[-10, -16], [0, -4], [10, 8]]) L(`M${x} ${y} l7 -5`, 'rgba(150,60,0,0.5)', 1.6, false); };
const mixedVeg = () => { T(-8, -4, 0, carrot, 0.8); for (const [x, y] of [[20, -18], [28, -6], [16, -4]]) E(x, y, 6, 6, '#6cc04a', 0, 2.5); for (const [x, y] of [[-24, 22], [-14, 28], [-30, 30]]) R(x, y, 7, 7, '#f4c53a', 2, 0.3, 2); };
const pickle = () => { T(0, 0, -0.5, () => { R(0, 0, 26, 72, '#6a9a3a', 13); for (const [x, y] of [[-5, -22], [5, -10], [-4, 2], [6, 14], [-3, 26]]) D(x, y, 2.2, '#4a7a22'); hi(-7, -10, 2.5, 16, 0); }); };
const chili = (c, o = {}) => {
  S('M-26 -22 C-6 -24 26 -8 34 30 C14 14 -8 2 -30 -8 C-34 -14 -32 -20 -26 -22Z', c);
  S('M-34 -30 Q-28 -26 -24 -20 L-30 -10 Q-36 -18 -40 -24Z', '#3f8f2f', 2.5); hi(-8, -10, 9, 2.5, 0.5);
  if (o.flame) flame(-18, 22, 0.9);
  if (o.pile) { S('M-36 38 Q-22 16 -6 38Z', c, 2.5); }
};
const paprika = () => {
  S('M-22 -14 C-30 -6 -24 26 -8 32 Q0 36 8 32 C24 26 30 -6 22 -14 Q10 -22 0 -16 Q-10 -22 -22 -14Z', '#d0321a');
  L('M0 -16 Q-2 -28 6 -32', '#3f8f2f', 4.5); L('M-6 -10 Q-10 10 -2 30', 'rgba(110,10,0,0.4)', 1.6, false); hi(-14, 0, 3, 9, 0.2);
  for (const x of [28, 36]) L(`M${x} -10 q-4 -6 0 -12 q4 -6 0 -12`, 'rgba(130,130,130,0.7)', 2.2, false);
};
const garlic = () => {
  S('M0 -36 Q3 -22 12 -16 C34 -6 32 28 12 32 Q0 36 -12 32 C-32 28 -34 -6 -12 -16 Q-3 -22 0 -36Z', '#f6efe0');
  L('M-4 -18 Q-16 4 -8 32', 'rgba(140,110,130,0.55)', 1.8, false); L('M4 -18 Q16 4 8 32', 'rgba(140,110,130,0.55)', 1.8, false);
  for (const x of [-4, 0, 4]) L(`M${x} 33 L${x * 1.5} 39`, '#a08a6a', 1.5, false);
};
const cabbage = () => { E(0, 2, 35, 33, '#b8dc8a'); L('M-30 10 Q-10 -10 4 -30', '#7ab04a', 2, false); L('M-10 32 Q-8 4 20 -22', '#7ab04a', 2, false); L('M12 32 Q10 8 32 -4', '#7ab04a', 2, false); S('M-6 4 Q8 -12 20 2 Q10 18 -6 4Z', '#d4eeb0', 2); };

// ---------- pasta, grains, bread ----------
const mound = (c, deco) => { S('M-38 28 Q-30 -22 0 -24 Q30 -22 38 28Z', c); sc(18, 5, (x, y) => D(x, y, 1.3, 'rgba(0,0,0,0.18)'), 22, 16, 0, 10); if (deco) deco(); };
const grains = (c, n, seed, rx = 30, ry = 22) => sc(n, seed, (x, y, r) => E(x, y, 5.5, 2.6, c, r * 3.1, 2), rx, ry);
const breadSlice = (c, crust) => { S('M-28 32 L-28 -4 Q-40 -10 -35 -23 Q-27 -36 0 -34 Q27 -36 35 -23 Q40 -10 28 -4 L28 32Z', crust); S('M-22 26 L-22 -8 Q-32 -12 -28 -21 Q-22 -28 0 -27 Q22 -28 28 -21 Q32 -12 22 -8 L22 26Z', c, 0); };
const bagel = (c) => { ring(0, 0, 35, 11, c, 0.82); sc(18, 9, (x, y) => { if (Math.hypot(x, y / 0.82) > 15) E(x, y, 1.6, 1, '#fff3cf', 0.6, 0); }, 30, 24); };
const croissant = () => {
  S('M-38 8 C-32 -30 32 -30 38 8 C35 18 27 20 22 12 C12 -6 -12 -6 -22 12 C-27 20 -35 18 -38 8Z', '#d8953a');
  for (const d of ['M-28 -8 L-18 6', 'M-14 -20 L-8 -4', 'M0 -24 L0 -6', 'M14 -20 L8 -4', 'M28 -8 L18 6']) L(d, 'rgba(130,70,10,0.6)', 2, false);
  hi(-12, -16, 7, 2.5, -0.4);
};
const muffin = () => {
  P([[-22, 0], [22, 0], [16, 34], [-16, 34]], '#e8dcc0'); for (const x of [-10, 0, 10]) L(`M${x} 4 L${x * 0.8} 32`, 'rgba(120,100,60,0.5)', 1.6, false);
  S('M-30 2 C-32 -30 32 -30 30 2 Q0 10 -30 2Z', '#b8803a'); for (const [x, y] of [[-14, -10], [2, -18], [14, -6], [-2, -4]]) D(x, y, 3.4, '#3a2a7a');
};

// ---------- meat ----------
const drumstick = (c) => { L('M10 10 L30 30', '#f6efe0', 7); E(34, 28, 5, 5, '#f6efe0'); E(29, 34, 5, 5, '#f6efe0'); S('M-34 -10 C-34 -34 2 -36 14 -14 C22 0 18 14 8 16 C-10 22 -34 12 -34 -10Z', c); hi(-18, -14, 8, 4); };
const sausage = (x, y, len, th, c, rot) => T(x, y, rot, () => { R(0, 0, len, th, c, th / 2); D(-len / 2 - 1.5, 0, 2.2, dk(c, 0.3)); D(len / 2 + 1.5, 0, 2.2, dk(c, 0.3)); hi(-len * 0.15, -th * 0.2, len * 0.22, th * 0.1, 0); });
const groundMound = (c, deco) => {
  R(0, 26, 76, 12, '#f4f4f4', 4);
  S('M-34 22 Q-34 -22 0 -24 Q34 -22 34 22Z', c);
  sc(13, 7, (x, y, r) => T(x, y, r * 3, () => L('M-7 0 Q0 -5 7 0', dk(c, -0.18), 3, false)), 22, 15, 0, 2);
  if (deco) deco();
};
const fan = (c, inner, edge) => { for (let i = 3; i >= 0; i--) { const x = -18 + i * 12, y = 8 - i * 6; E(x, y, 22, 19, edge || dk(c, 0.2)); E(x, y, 18.5, 15.5, c, 0, 0); if (inner) E(x, y, 11, 9, inner, 0, 0); } };
const wedge = (c, o = {}) => {
  P([[-36, 4], [22, -26], [36, -6]], dk(c, -0.08)); P([[-36, 4], [36, -6], [36, 22], [-36, 28]], c);
  if (o.holes) for (const [x, y, r] of [[-14, 14, 5], [10, 8, 6.5], [24, 16, 3.5], [-2, 20, 3]]) E(x, y, r, r * 0.85, dk(c, 0.22), 0, 2);
  if (o.flecks) sc(14, 4, (x, y, r) => D(x, y + 12, 1.8, r > 0.5 ? '#d0321a' : '#3f8f2f'), 28, 8);
};

// ---------- candy / snacks ----------
const bear = (x, y, c, s) => T(x, y, 0, () => { E(-7, -20, 5, 5, c, 0, 2.5); E(7, -20, 5, 5, c, 0, 2.5); E(-12, 2, 5, 7, c, 0.5, 2.5); E(12, 2, 5, 7, c, -0.5, 2.5); E(-7, 20, 6, 6, c, 0, 2.5); E(7, 20, 6, 6, c, 0, 2.5); E(0, 6, 11, 14, c, 0, 2.5); E(0, -12, 10, 9, c, 0, 2.5); hi(-3, -15, 3, 2); }, s);
const chipOval = (x, y, rot, c, ridged) => T(x, y, rot, () => { E(0, 0, 22, 15, c); if (ridged) for (const dx of [-12, -4, 4, 12]) L(`M${dx} -10 Q${dx + 3} 0 ${dx} 10`, 'rgba(120,70,0,0.4)', 1.6, false); else sc(6, 3, (a, b) => D(a, b, 1.2, 'rgba(120,70,0,0.4)'), 14, 9); });
const candyCorn = (x, y, rot) => T(x, y, rot, () => { P([[0, -22], [17, 20], [-17, 20]], '#ffd23a'); P([[0, -22], [11, 6], [-11, 6]], '#f28a1c', 0); P([[0, -22], [5, -9], [-5, -9]], '#fff', 0); P([[0, -22], [17, 20], [-17, 20]], '', 3); });
const wrapped = (c, twist, shape) => {
  P([[-16, 0], [-36, -13], [-32, 0], [-36, 13]], twist); P([[16, 0], [36, -13], [32, 0], [36, 13]], twist);
  if (shape === 'disc') { E(0, 0, 20, 20, '#fff'); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 18.5, a, a + TAU / 12); g.closePath(); g.fillStyle = c; g.fill(); } E(0, 0, 20, 20, '', 0, 3); }
  else { R(0, 0, 36, 28, c, 5); hi(-8, -7, 8, 2.5, 0); }
};

// ---------- bowls of cereal ----------
const cereal = (kind, col) => bowl('#fdfdf5', () => {
  if (kind === 'flakes') sc(22, 2, (x, y, r) => T(x, y, r * 3, () => P([[-5, -2], [3, -4], [6, 2], [-2, 4]], '#f2c21a', 1.5)), 30, 7, 0, -6);
  else if (kind === 'os') sc(16, 3, (x, y) => ring(x, y, 4.6, 1.8, '#d8a44a', 0.8, 1.5), 30, 7, 0, -6);
  else if (kind === 'puffs') sc(18, 4, (x, y) => E(x, y, 4, 3.6, '#6a3a1e', 0, 1.5), 30, 7, 0, -6);
  else if (kind === 'rings') sc(16, 5, (x, y, r, i) => ring(x, y, 4.8, 1.9, ['#e83a5a', '#f2a21a', '#3ab84a', '#3a8ae8', '#a04ae8'][i % 5], 0.8, 1.5), 30, 7, 0, -6);
  else sc(22, 6, (x, y, r) => T(x, y, r * 3, () => P([[-5, -2], [3, -4], [6, 2], [-2, 4]], '#8a5a2a', 1.5)), 30, 7, 0, -6);
}, col);

// ---------- household ----------
const roll = (h, sheet) => { R(-4, 4, 38, h, '#fbfbf6', 6); E(-4, 4 - h / 2, 19, 6, '#fbfbf6'); E(-4, 4 - h / 2, 7, 2.4, '#b89a7a', 0, 2); if (sheet) { P([[15, 4 - h / 2 + 4], [30, 4 - h / 2 + 8], [30, 30], [15, 26]], '#fbfbf6'); L('M16 14 L29 18', 'rgba(0,0,0,0.25)', 1.2, false); } sc(8, 2, (x, y) => D(x, y, 1.3, 'rgba(90,150,220,0.5)'), 12, h / 3, -4, 6); };
const fork = (x, y, rot, c) => T(x, y, rot, () => { R(0, 16, 6, 44, c, 3); R(0, -12, 18, 14, c, 4); for (const dx of [-7, -2.4, 2.4, 7]) R(dx, -28, 3, 20, c, 1.5, 0, 2); });
const stackCups = () => { for (let i = 2; i >= 0; i--) { const y = 10 - i * 14; P([[-20, y - 16], [20, y - 16], [14, y + 24], [-14, y + 24]], i % 2 ? '#fff' : '#e2483d'); R(0, y - 16, 44, 6, '#fff', 3); } };
const catFace = (c) => { P([[-28, -8], [-26, -36], [-8, -22]], c); P([[28, -8], [26, -36], [8, -22]], c); E(0, 4, 31, 27, c); E(-12, 0, 4, 5.5, '#2a2a2a', 0, 0); E(12, 0, 4, 5.5, '#2a2a2a', 0, 0); P([[-4, 9], [4, 9], [0, 14]], '#e88aa0', 2); for (const s of [-1, 1]) { L(`M${s * 10} 13 L${s * 34} 9`, INK, 1.4, false); L(`M${s * 10} 16 L${s * 33} 20`, INK, 1.4, false); } };
const dogFace = () => { E(-27, -2, 11, 22, '#7a4a22', 0.25); E(27, -2, 11, 22, '#7a4a22', -0.25); E(0, 2, 27, 29, '#d9a35a'); E(0, 16, 14, 11, '#f3e3c4', 0, 2.5); E(-11, -6, 3.6, 4.6, '#2a2a2a', 0, 0); E(11, -6, 3.6, 4.6, '#2a2a2a', 0, 0); E(0, 10, 5.5, 4, '#2a2a2a', 0, 0); S('M-5 19 Q0 32 5 19Z', '#e85a7a', 2); };

// ---------- one picture per product ----------
const A = {
  // Produce
  'Red Apples': () => apple('#c8202a'),
  'Green Apples': () => apple('#7cc04b'),
  'Oranges': orange,
  'Lemons': () => lemon('#f5d63a'),
  'Limes': () => { E(0, 2, 33, 30, '#5aa832'); D(-28, 2, 3, '#3d7a22'); hi(-12, -10, 8, 4); },
  'Bananas': banana,
  'Tomatoes': () => tomato(false),
  'Russet Potatoes': potato,
  'Yellow Onions': () => onion('#d9a440'),
  'Avocados': avocado,
  'Peaches': peach,
  'Cantaloupe': melon,
  // Dairy
  'Whole Milk Gallon': () => jugIcon('#d93b3b', 'MILK'),
  '2% Milk Gallon': () => jugIcon('#2d6fd1', '2%'),
  'Chocolate 2% Milk': () => glass('#7a4a2a', { straw: '#f2c21a', foam: false }),
  'Skim Milk': () => { glass('#fbfbf5'); S('M24 6 C30 14 34 18 34 23 C34 29 30 32 26 32 C20 32 17 28 18 22 C19 16 22 12 24 6Z', '#fbfbf5', 2.5); },
  'Salted Butter': () => { R(2, 8, 62, 26, '#f4d35e', 3, -0.15); R(-20, 11, 26, 27, '#f3ecd8', 3, -0.15); R(22, -14, 20, 9, '#f8e07a', 2, -0.15); L('M-28 6 L-12 3', 'rgba(0,0,0,0.25)', 1.4, false); },
  'Large Eggs': () => { E(-19, 10, 14, 18, '#e2b98a'); E(19, 10, 14, 18, '#f3ead8'); E(0, -6, 15, 19, '#fbf6ea'); hi(-5, -14, 4, 3); },
  'Shredded Cheddar': () => sc(26, 8, (x, y, r) => T(x, y, r * 3, () => L('M-8 0 Q0 -5 8 0', '#f29b26', 3.2)), 28, 22),
  'Sliced Swiss': () => wedge('#f6e08a', { holes: true }),
  'Strawberry Yogurt': strawberry,
  'Greek Yogurt': () => { bowl('#fdfdf8', () => L('M-14 -6 Q-4 -12 4 -6 Q12 0 18 -8', 'rgba(170,170,190,0.7)', 2.2, false), '#3a5fa8'); L('M14 -12 L34 -36', '#c9ced6', 4.5); E(13, -10, 7, 4.5, '#c9ced6', -0.8, 2.5); },
  'Sour Cream': () => { E(0, 18, 33, 14, '#fbfbf5'); E(0, 5, 23, 11, '#fbfbf5'); E(0, -7, 14, 8, '#fbfbf5'); S('M-6 -12 Q2 -30 11 -21 Q4 -19 6 -11Z', '#fbfbf5'); for (const [x, y] of [[-12, 16], [6, 22], [16, 12]]) E(x, y, 2.6, 1.3, '#4c9a3a', 0.6, 0); },
  'Cottage Cheese': () => bowl('#fbfbf2', () => sc(20, 9, (x, y) => E(x, y, 4.5, 3.4, '#fff', 0, 1.6), 30, 7, 0, -6), '#2f7fc1'),
  // Frozen
  'Pepperoni Pizza': () => { P([[-34, -20], [34, -20], [0, 38]], '#f6cf5a'); L('M-34 -22 Q0 -34 34 -22', '#c98a3a', 9); for (const [x, y] of [[-12, -8], [12, -8], [0, 10]]) E(x, y, 7, 7, '#c0321e', 0, 2.5); },
  'Cheese Pizza': () => { E(0, 0, 37, 37, '#d39a4a'); D(0, 0, 30, '#f6cf5a'); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; L(`M${-Math.cos(a) * 30} ${-Math.sin(a) * 30} L${Math.cos(a) * 30} ${Math.sin(a) * 30}`, 'rgba(160,90,10,0.55)', 1.8, false); } sc(9, 2, (x, y) => D(x, y, 2.4, '#fbe9a0'), 22, 22); },
  'Vanilla Ice Cream': () => { P([[-16, -2], [16, -2], [0, 40]], '#d9a35a'); L('M-9 6 L6 22', 'rgba(120,70,10,0.5)', 1.5, false); L('M9 6 L-6 22', 'rgba(120,70,10,0.5)', 1.5, false); E(0, -14, 20, 18, '#f8ecc4'); E(0, -34, 5, 5, '#d0202a'); hi(-8, -20, 5, 3); },
  'Chocolate Ice Cream': () => { P([[-16, 6], [16, 6], [0, 42]], '#d9a35a'); E(0, -4, 19, 15, '#6a3a22'); E(0, -24, 15, 13, '#7a4628'); S('M-17 2 Q-14 12 -10 4', '#6a3a22', 2.5); hi(-6, -30, 4, 2.5); },
  'Frozen Peas': peaPod,
  'Mixed Vegetables': mixedVeg,
  'Fish Sticks': () => { for (const [x, y, r] of [[-6, -18, -0.2], [2, 2, -0.1], [-4, 22, -0.25]]) { R(x, y, 64, 15, '#e0a03a', 6, r); sc(7, x + 9, (a, b) => D(a, b, 1.2, 'rgba(130,70,0,0.5)'), 26, 4, x, y); } },
  'Chicken Nuggets': () => { for (const [x, y, s] of [[-16, -12, 1], [18, -6, 0.9], [0, 18, 1.05]]) T(x, y, x * 0.02, () => { S('M-18 0 C-18 -14 -4 -16 4 -12 C16 -12 20 -2 16 8 C10 16 -12 16 -18 0Z', '#dba23e'); sc(5, 3, (a, b) => D(a, b, 1.2, 'rgba(130,70,0,0.5)'), 10, 6); }, s); },
  'Frozen Waffles': () => { E(0, 0, 36, 36, '#e2a84a'); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) R(i * 17, j * 17, 11, 11, 'rgba(140,80,20,0.45)', 2, 0, 0); R(4, -4, 14, 12, '#fbe27a', 2, 0.3, 2.5); },
  'Bean Burritos': () => T(0, 0, -0.35, () => { R(0, 0, 70, 32, '#ecd9a8', 16); E(31, 0, 7, 13, '#7a4a2a', 0, 2.5); for (const y of [-6, 0, 6]) D(31, y, 2, '#3a2216'); L('M-20 -15 Q-10 0 -20 15', 'rgba(140,100,40,0.5)', 1.8, false); for (const [x, y] of [[-6, -6], [8, 6], [-12, 8]]) E(x, y, 3, 2, 'rgba(170,110,50,0.5)', 0, 0); }),
  'Tater Tots': () => { for (const [x, y, r] of [[-17, -13, 0.2], [15, -15, -0.3], [-13, 15, -0.2], [18, 13, 0.3]]) T(x, y, r, () => { R(0, 0, 28, 22, '#d9a23a', 8); sc(7, 4, (a, b) => D(a, b, 1.3, 'rgba(130,70,0,0.5)'), 9, 6); }); },
  'Fruit Bars': () => { R(0, 26, 8, 26, '#e8cf9a', 3); R(0, -8, 32, 50, '#e8478a', 13); hi(-8, -14, 3, 13, 0); sc(5, 3, (x, y) => D(x, y, 1.6, '#ffd0e0'), 8, 16, 2, -8); },
  // Canned goods
  'Chicken Noodle Soup': () => bowl('#f2d26a', () => { L('M-26 -8 Q-16 -14 -8 -6 Q0 2 10 -8 Q18 -14 28 -6', '#fff3b8', 3); for (const [x, y] of [[-14, -2], [16, -2]]) R(x, y, 5, 5, '#f2781a', 1, 0.4, 1.4); }, '#c8302c'),
  'Tomato Soup': () => bowl('#e0522a', () => { L('M-12 -6 Q-2 -12 6 -6 Q12 -2 16 -8', '#fff3e0', 2.5, false); leaf(-2, -4, -0.3, '#3f9a3a', 0.5); }, '#fdfdf5'),
  'Green Beans': () => { for (const d of ['M-34 -22 Q-4 -24 30 -2', 'M-36 2 Q-2 -10 34 12', 'M-30 26 Q0 6 32 28']) L(d, '#3a9a3a', 7); },
  'Sweet Corn': corn,
  'Black Beans': () => sc(11, 12, (x, y, r) => { E(x, y, 9, 6.5, '#2b2b2b', r * 3, 2.5); hi(x - 2, y - 2, 2.5, 1.2); }, 26, 22),
  'Kidney Beans': () => sc(8, 14, (x, y, r) => T(x, y, r * 3, () => { L('M-8 3 Q0 -7 8 3', '#8a2a2a', 9); hi(-2, -3, 3, 1.2, 0); }), 24, 22),
  'Diced Tomatoes': () => { cube(-18, 6, 13, '#e0412d'); cube(16, 10, 14, '#d8362a'); cube(0, -14, 13, '#e85040'); },
  'Chunk Light Tuna': () => fish('#5a8ab8'),
  'Peaches in Syrup': () => { for (const [x, y, r] of [[-10, -18, -0.3], [8, 2, 0.1], [-8, 22, -0.2]]) T(x, y, r, () => { S('M-24 -6 Q0 20 24 -6 Q0 2 -24 -6Z', '#f6a030'); L('M-14 -1 Q0 9 14 -1', 'rgba(216,67,58,0.6)', 2, false); }); },
  'Beef Chili': () => bowl('#7a2f1a', () => { sc(10, 3, (x, y) => E(x, y, 3.4, 2.4, '#c8402a', 0.5, 1.2), 30, 7, 0, -6); sc(6, 5, (x, y) => D(x, y, 1.6, '#f2c21a'), 28, 6, 0, -6); }, '#f2e8d8'),
  'Cream of Mushroom': mushroom,
  'Pumpkin Puree': pumpkin,
  // Pasta & rice
  'Spaghetti': () => { for (let i = -3; i <= 3; i++) L(`M${i * 4 - 8} 38 L${i * 4.6 + 6} -38`, '#f2d26a', 2.6, i === -3 || i === 3); R(-1, 0, 36, 10, '#c0392b', 3, -0.18); },
  'Penne': () => { for (const [x, y, r] of [[-12, -16, -0.5], [10, 0, -0.35], [-10, 20, -0.6]]) T(x, y, r, () => { P([[-24, 7], [-16, -7], [24, -7], [16, 7]], '#f2d26a'); for (const dy of [-2.5, 2.5]) L(`M-17 ${dy} L19 ${dy}`, 'rgba(160,110,0,0.45)', 1.3, false); }); },
  'Elbow Macaroni': () => { for (const [x, y, r] of [[-16, -14, 0], [14, -10, 2.2], [-10, 16, 4], [16, 16, 1]]) T(x, y, r, () => L('M-10 6 Q-10 -8 6 -8', '#f2d26a', 8)); },
  'Rotini': () => { for (const [x, r] of [[-16, -0.25], [14, 0.2]]) T(x, 0, r, () => L('M-7 -34 L7 -25 L-7 -15 L7 -5 L-7 5 L7 15 L-7 25 L7 34', '#f2c85a', 7)); },
  'Lasagna Noodles': () => T(0, 0, -0.3, () => { S('M-36 -16 q4 -5 8 0 q4 5 8 0 q4 -5 8 0 q4 5 8 0 q4 -5 8 0 q4 5 8 0 q4 -5 8 0 q4 5 8 0 q4 -5 8 0 L36 16 q-4 5 -8 0 q-4 -5 -8 0 q-4 5 -8 0 q-4 -5 -8 0 q-4 5 -8 0 q-4 -5 -8 0 q-4 5 -8 0 q-4 -5 -8 0 q-4 5 -8 0Z', '#f2d26a'); L('M-32 0 L32 0', 'rgba(160,110,0,0.4)', 1.5, false); }),
  'Egg Noodles': () => { for (const d of ['M-32 -10 Q-16 -30 0 -12 Q16 6 32 -14', 'M-32 8 Q-14 -8 2 8 Q16 22 32 4', 'M-28 26 Q-10 10 6 26 Q18 34 30 22']) L(d, '#f2d16a', 7); },
  'Mac & Cheese': () => bowl('#f6a01c', () => { for (const [x, y, r] of [[-18, -8, 0], [0, -4, 2], [16, -8, 4], [-6, -10, 1]]) T(x, y, r, () => L('M-5 3 Q-5 -4 3 -4', '#ffd23a', 4)); }, '#3a8ae8'),
  'White Rice': () => bowl('#fbfbf2', () => sc(20, 3, (x, y, r) => E(x, y, 3.4, 1.5, '#fff', r * 3, 1.2), 22, 11, 0, -20), '#2a62b8', true),
  'Brown Rice': () => bowl('#b08a58', () => sc(20, 4, (x, y, r) => E(x, y, 3.4, 1.5, '#d0b080', r * 3, 1.2), 22, 11, 0, -20), '#3a8a5a', true),
  'Ramen Noodles': () => { L('M10 -10 L36 -38', '#8a5a2a', 3.5); L('M18 -8 L42 -32', '#8a5a2a', 3.5); bowl('#e8b04a', () => { L('M-28 -6 Q-20 -12 -12 -6 Q-4 0 4 -6 Q10 -12 16 -6', '#fff0a8', 3); E(18, -6, 8, 5, '#fff', 0, 1.6); D(18, -6, 3, '#f2a21a'); for (const x of [-20, -10]) D(x, -1, 1.8, '#3f9a3a'); }, '#c0392b'); },
  'Couscous': () => { E(0, 28, 40, 9, '#e9eef5'); S('M-30 26 Q-26 -18 0 -20 Q26 -18 30 26Z', '#e8c86a'); sc(40, 6, (x, y) => D(x, y, 1.5, 'rgba(150,100,10,0.45)'), 20, 16, 0, 6); },
  'Orzo': () => grains('#f2d98a', 22, 16),
  // Bread & bakery
  'White Bread': () => breadSlice('#fbf0d0', '#c98a3a'),
  'Wheat Bread': () => { breadSlice('#c99a5a', '#7a4a1e'); sc(12, 5, (x, y) => E(x, y, 2.4, 1.2, '#8a5a2a', 0.5, 0), 16, 18, 0, 0); },
  'Sourdough': () => { E(0, 6, 37, 29, '#d8a45a'); L('M-16 -8 Q0 4 16 -8', '#f3dcae', 4); L('M-16 10 Q0 22 16 10', '#f3dcae', 4); sc(10, 2, (x, y) => D(x, y, 1.2, 'rgba(255,255,255,0.6)'), 28, 18, 0, 6); },
  'Hamburger Buns': () => { R(0, 22, 68, 16, '#e3b46a', 7); S('M-36 12 C-36 -30 36 -30 36 12Z', '#d9963a'); for (const [x, y] of [[-16, -6], [0, -14], [16, -6], [-6, 2], [10, 3]]) E(x, y, 3, 1.6, '#fff3cf', 0.5, 0); },
  'Hot Dog Buns': () => T(0, 0, -0.3, () => { R(0, 0, 78, 30, '#e3b46a', 15); L('M-30 0 L30 0', '#f8e6b8', 5); }),
  'Plain Bagels': () => bagel('#c8905a'),
  'English Muffins': () => { R(0, 16, 62, 18, '#e9d8b4', 8); E(0, -6, 31, 14, '#f3e6c8'); sc(14, 3, (x, y) => E(x, y, 2.6, 1.6, 'rgba(150,110,50,0.5)', 0, 0), 24, 9, 0, -6); },
  'Flour Tortillas': () => { E(0, 0, 37, 35, '#f0e2c2'); sc(11, 8, (x, y, r) => E(x, y, 3 + r * 3, 2 + r * 2, 'rgba(170,110,50,0.5)', r * 3, 0), 26, 24); S('M-37 0 Q-10 -10 4 -34 Q-28 -30 -37 0Z', '#e6d4ac', 2.5); },
  'Croissants': croissant,
  'Dinner Rolls': () => { for (const [x, y] of [[-17, 12], [17, 12], [0, -10]]) { S(`M${x - 18} ${y + 12} C${x - 18} ${y - 18} ${x + 18} ${y - 18} ${x + 18} ${y + 12}Z`, '#d9a35a'); hi(x - 6, y - 4, 6, 3); } },
  'Blueberry Muffins': muffin,
  'Rye Bread': () => { E(0, 2, 38, 24, '#7a5230', -0.2); for (const x of [-18, -4, 10, 24]) L(`M${x - 4} ${6 - x * 0.2} L${x + 4} ${-8 - x * 0.2}`, '#c9a878', 3, false); },
  // Sauces & condiments
  'Marinara Sauce': () => tomato(true),
  'Alfredo Sauce': () => bowl('#f8f0d8', () => { L('M-26 -6 Q-14 -14 -2 -6 Q10 2 26 -8', '#f2d98a', 5); sc(6, 3, (x, y) => D(x, y, 1.2, '#3f8f2f'), 26, 6, 0, -6); }, '#5a8a5a'),
  'Ketchup': () => bottleIcon('#d0201a', 'cone', () => tomato2(0, 16)),
  'Yellow Mustard': () => bottleIcon('#f2d21a', 'cone', () => L('M-8 10 Q-2 4 0 14 Q2 24 8 18', '#c98a00', 2.5, false)),
  'Mayonnaise': () => { R(0, 10, 46, 46, '#f6f2e2', 8); R(0, -19, 40, 12, '#3a6ae8', 3); L('M10 -26 L30 -42', '#c9ced6', 4.5); E(-2, 12, 13, 9, '#fff', 0, 2.5); S('M-6 6 Q2 -8 8 2Z', '#fff', 2.5); },
  'BBQ Sauce': () => { drumstick('#7a3216'); L('M-28 -14 Q-12 -22 4 -10', '#b85a2a', 3, false); flame(-26, 26, 0.8); },
  'Hot Sauce': () => chili('#d8281a', { flame: true }),
  'Ranch Dressing': () => bowl('#7ab84a', () => { for (const [x, r] of [[-20, 0.3], [-4, -0.4], [12, 0.2]]) leaf(x, -4, r, '#4c9a3a', 0.9); for (const x of [-10, 20]) E(x, -8, 4, 3, '#e0412d', 0, 1.4); }, '#fdfdf5'),
  'Italian Dressing': () => { S('M-6 -22 L-6 -12 C-22 -4 -24 30 -12 36 L12 36 C24 30 22 -4 6 -12 L6 -22Z', 'rgba(240,220,120,0.9)'); R(0, -28, 12, 12, '#8a5a2a', 2); sc(12, 4, (x, y, r) => D(x, y, 1.6, r > 0.5 ? '#3f8f2f' : '#c0392b'), 12, 14, 0, 16); L('M6 -24 Q22 -28 24 -16', '#c9ced6', 3); },
  'Soy Sauce': () => { E(-12, 6, 22, 22, '#2a2a2a'); D(-12, 6, 16, '#fbfbf5'); E(-12, 6, 7, 7, '#f08a5a', 0, 2); D(-9, 4, 2.2, '#5aa832'); S('M24 -30 C30 -18 34 -12 34 -6 C34 0 30 4 24 4 C18 4 14 0 14 -6 C14 -12 18 -18 24 -30Z', '#3a2216', 2.5); },
  'Chunky Salsa': () => { P([[10, -8], [40, -34], [36, 0]], '#e8b03a'); bowl('#c8452a', () => { sc(8, 3, (x, y) => R(x, y, 4, 4, '#f2e8d8', 1, 0.5, 1), 28, 6, 0, -6); sc(7, 9, (x, y) => D(x, y, 1.7, '#3f8f2f'), 28, 6, 0, -6); }, '#3a8ae8'); },
  'Dill Pickles': pickle,
  // Meat & seafood
  'Ground Beef': () => groundMound('#b8323a'),
  'Chicken Breasts': () => { S('M-34 -4 C-34 -26 -6 -32 12 -22 C34 -12 40 14 26 26 C12 36 -18 30 -28 16 C-33 9 -34 4 -34 -4Z', '#f1b8a8'); L('M-20 -10 Q0 -4 16 12', 'rgba(190,110,100,0.5)', 2, false); hi(-12, -14, 9, 4); },
  'Pork Chops': () => { S('M-34 0 C-34 -26 4 -34 22 -20 C40 -6 36 22 16 30 C-6 38 -34 24 -34 0Z', '#f6e6d2'); S('M-27 0 C-27 -19 2 -26 16 -15 C30 -4 27 16 12 22 C-6 28 -27 18 -27 0Z', '#e88a82', 0); L('M26 -18 L36 -32', '#fbf6ea', 7); E(-2, 0, 6, 5, '#fbf6ea', 0, 2); },
  'Ribeye Steak': () => { S('M-36 2 C-36 -22 -8 -32 14 -24 C34 -18 42 4 32 20 C20 34 -10 32 -24 24 C-33 18 -36 10 -36 2Z', '#f3e1cf'); S('M-29 2 C-29 -16 -6 -25 12 -18 C28 -13 34 4 26 16 C16 26 -8 25 -19 19 C-26 14 -29 9 -29 2Z', '#a82a2a', 0); for (const d of ['M-18 -6 Q-6 -12 4 -4', 'M-8 10 Q6 4 18 8', 'M6 -12 Q14 -8 20 -2']) L(d, '#f3d8c8', 2, false); },
  'Chicken Thighs': () => drumstick('#e8a070'),
  'Thick Cut Bacon': () => { for (const y of [-20, 0, 20]) { L(`M-34 ${y} q8 -8 17 0 q8 8 17 0 q8 -8 17 0 q8 8 17 0`, '#b8322a', 11); L(`M-34 ${y - 1} q8 -8 17 0 q8 8 17 0 q8 -8 17 0 q8 8 17 0`, '#f3c8b8', 2.6, false); } },
  'Breakfast Sausage': () => { sausage(-4, -20, 46, 14, '#b06a3a', -0.2); sausage(4, 0, 46, 14, '#b06a3a', -0.1); sausage(-2, 21, 46, 14, '#b06a3a', -0.25); },
  'Beef Hot Dogs': () => T(0, 0, -0.3, () => { R(0, 6, 70, 26, '#e3b46a', 13); R(0, -4, 80, 15, '#c8382a', 7.5); L('M-28 -5 q5 -5 9 0 q5 5 9 0 q5 -5 9 0 q5 5 9 0 q5 -5 9 0 q5 5 9 0', '#f2d21a', 2.6, false); }),
  'Salmon Fillet': () => { P([[-36, 6], [-16, -22], [36, -14], [22, 22]], '#f08a5a'); for (const x of [-16, -2, 12, 24]) L(`M${x - 6} ${16 - x * 0.1} Q${x + 2} 0 ${x + 4} ${-16 + x * 0.1}`, '#fbd2bc', 2.2, false); },
  'Frozen Shrimp': () => { S('M-22 26 C-40 6 -30 -26 0 -28 C24 -28 36 -8 28 8 C24 16 14 14 14 6 C16 -4 8 -12 -2 -10 C-14 -8 -16 6 -8 16Z', '#f4906a'); for (const d of ['M-28 4 L-14 0', 'M-22 -14 L-10 -6', 'M-4 -27 L-2 -11', 'M18 -22 L8 -10']) L(d, 'rgba(180,70,40,0.6)', 1.8, false); P([[-22, 26], [-8, 16], [-4, 34], [-14, 28], [-22, 38]], '#f2643a', 2.5); D(22, 0, 2, INK); },
  'Ground Turkey': () => groundMound('#e0a898', () => leaf(-6, -18, -0.5, '#4c9a3a', 1.1)),
  'Bratwurst': () => { L('M-30 14 Q0 -30 30 14', '#b8703a', 17); for (const [x, y, r] of [[-18, -2, 0.9], [-6, -10, 0.3], [8, -10, -0.3], [20, -1, -0.9]]) T(x, y, r, () => L('M0 -5 L0 5', '#5a2e12', 2.4, false)); L('M-36 34 L36 34', '#8a8a92', 3); },
  // Drinks
  'Cola 2-Liter': () => glass('#4a1a0e', { ice: true, bub: true, straw: '#e2483d' }),
  'Lemon-Lime Soda': () => { slice(-13, -4, 22, '#f8e45a', '#f5d63a'); slice(15, 10, 20, '#a8e06a', '#5aa832'); for (const [x, y] of [[26, -24], [18, -34], [32, -34]]) bub(x, y, 3.5); },
  'Orange Juice': () => slice(0, 0, 35, '#f9a83a', '#f28a1c'),
  'Apple Juice': () => { S('M0 -18 C-14 -30 -36 -18 -32 6 C-30 28 -12 38 0 32 C12 38 30 28 32 6 C36 -18 14 -30 0 -18Z', '#c8202a'); S('M0 -11 C-12 -21 -29 -13 -26 6 C-24 23 -10 31 0 26 C10 31 24 23 26 6 C29 -13 12 -21 0 -11Z', '#fbf3d0', 0); for (const s of [-1, 1]) E(s * 5, 6, 2.4, 4.5, '#5a3a1a', s * 0.3, 0); L('M0 -18 Q2 -30 8 -34', '#6b4423', 3.5); },
  'Spring Water 6-Pack': () => { S('M0 -38 C16 -12 29 0 29 13 C29 28 15 38 0 38 C-15 38 -29 28 -29 13 C-29 0 -16 -12 0 -38Z', '#5ab0e8'); hi(-12, 10, 4, 10, 0.3); },
  'Sparkling Water': () => { for (const [x, y, r] of [[-14, 14, 15], [14, 6, 12], [-6, -14, 10], [16, -20, 7], [2, 30, 6], [-26, -8, 5]]) bub(x, y, r); },
  'Sweet Iced Tea': () => glass('#b8642a', { ice: true, lemon: '#f8e45a' }),
  'Pink Lemonade': () => glass('#f59ab8', { straw: '#fff', lemon: '#f8b8c8' }),
  'Blue Sports Drink': () => { E(0, 0, 36, 36, '#2a6ae8'); P([[7, -30], [-16, 4], [-1, 4], [-7, 30], [17, -6], [3, -6]], '#fff', 2.5); },
  'Energy Drink': () => { const pts = []; for (let i = 0; i < 16; i++) { const a = i * TAU / 16, r = i % 2 ? 26 : 38; pts.push([Math.cos(a) * r, Math.sin(a) * r]); } P(pts, '#1a1a1a'); P([[7, -26], [-13, 3], [-1, 3], [-6, 26], [14, -5], [3, -5]], '#b8f21a', 2); },
  'Root Beer': () => mug('#8a4a1a', '#fff3d8', { foam: true }),
  'Grape Juice': grapes,
  // Chips & snacks
  'Potato Chips': () => { chipOval(-12, -14, -0.3, '#f2d24a', true); chipOval(12, 2, 0.4, '#f6dc6a', true); chipOval(-8, 20, 0.1, '#f2d24a', true); },
  'BBQ Chips': () => { chipOval(-12, -10, -0.3, '#c8602a', false); chipOval(8, 12, 0.3, '#d8703a', false); flame(26, -20, 0.8); },
  'Tortilla Chips': () => { for (const [x, y, r] of [[-12, -10, 0.2], [14, 0, -0.5], [-6, 20, 0.9]]) T(x, y, r, () => { P([[0, -20], [19, 14], [-19, 14]], '#e8b03a'); sc(5, 3, (a, b) => D(a, b + 4, 1.2, 'rgba(130,80,0,0.5)'), 8, 7); }); },
  'Cheese Puffs': () => { for (const [x, y, r] of [[-14, -16, 0.2], [12, -6, 2.6], [-12, 10, 3.4], [14, 22, 0.6]]) T(x, y, r, () => L('M-14 4 Q0 -10 14 4', '#f2781a', 10)); },
  'Pretzel Twists': () => { L('M0 30 C-44 12 -36 -32 -12 -24 C4 -18 2 2 18 18', '#a8642a', 7); L('M0 30 C44 12 36 -32 12 -24 C-4 -18 -2 2 -18 18', '#a8642a', 7); for (const [x, y] of [[-26, -8], [26, -8], [0, 28], [-10, 6], [10, 6], [0, -16]]) R(x, y, 3, 3, '#fff', 1, 0.5, 0); },
  'Microwave Popcorn': () => { for (const [x, y] of [[-16, -12], [0, -22], [16, -12], [-8, -6], [8, -6]]) E(x, y, 10, 9, '#fbf3cf', 0, 2.5); P([[-24, -4], [24, -4], [17, 36], [-17, 36]], '#fff'); for (const x of [-14, 0, 14]) P([[x - 4, -4], [x + 4, -4], [x * 0.72 + 3, 36], [x * 0.72 - 3, 36]], '#d8282a', 0); P([[-24, -4], [24, -4], [17, 36], [-17, 36]], '', 3); },
  'Corn Chips': () => { for (const [x, y, r] of [[-10, -18, 0.2], [10, 0, -0.3], [-8, 20, 0.4]]) T(x, y, r, () => S('M-18 -8 Q0 8 18 -8 L18 4 Q0 20 -18 4Z', '#d8a82a')); },
  'Cheddar Crackers': () => { for (const [x, y, r] of [[-12, -10, -0.2], [12, 12, 0.25]]) T(x, y, r, () => { R(0, 0, 34, 34, '#f2781a', 4); D(0, 0, 3, '#b84a00'); for (const [a, b] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) D(a, b, 1.5, '#b84a00'); }); },
  'Salted Peanuts': () => { T(-6, 0, -0.5, () => { S('M-30 0 C-30 -14 -12 -16 -2 -8 C10 -18 30 -14 30 0 C30 14 10 18 -2 8 C-12 16 -30 14 -30 0Z', '#d8b07a'); for (const x of [-18, -8, 8, 18]) L(`M${x} -9 L${x} 9`, 'rgba(120,80,30,0.5)', 1.4, false); L('M-26 0 L26 0', 'rgba(120,80,30,0.5)', 1.4, false); }); E(22, 24, 8, 6, '#b8742a', 0.4, 2.5); },
  'Trail Mix': () => sc(20, 21, (x, y, r, i) => { if (i % 4 === 0) E(x, y, 5, 3.6, '#5a2a3a', r * 3, 2); else if (i % 4 === 1) E(x, y, 6, 4, '#d8b07a', r * 3, 2); else if (i % 4 === 2) E(x, y, 4, 4, ['#e2483d', '#f2c21a', '#3a8ae8'][i % 3], 0, 2); else E(x, y, 5, 3, '#a8642a', r * 3, 2); }, 30, 26),
  'Pork Rinds': () => { for (const [x, y, s] of [[-14, -12, 1], [16, -2, 0.9], [-4, 20, 1]]) T(x, y, x * 0.03, () => { S('M-18 2 C-20 -12 -6 -18 2 -12 C12 -18 22 -6 18 4 C16 14 4 12 0 16 C-8 18 -16 12 -18 2Z', '#e8c898'); sc(5, 2, (a, b) => D(a, b, 1.5, 'rgba(150,100,40,0.5)'), 10, 7); }, s); },
  'Rice Cakes': () => { for (const y of [22, 4, -14]) { R(0, y, 62, 17, '#f3ecd8', 8); sc(9, y + 30, (a, b) => D(a, b, 1.3, 'rgba(150,130,90,0.55)'), 26, 5, 0, y); } },
  // Cereal & breakfast
  'Corn Flakes': () => cereal('flakes', '#3a8ae8'),
  'Honey Oat Cereal': () => cereal('os', '#f2c21a'),
  'Chocolate Puffs': () => cereal('puffs', '#e2483d'),
  'Fruit Rings': () => cereal('rings', '#a04ae8'),
  'Bran Flakes': () => cereal('bran', '#3a8a5a'),
  'Rolled Oats': () => { wheat(-14, 4, -0.3); wheat(14, 4, 0.3); wheat(0, 2, 0, '#e8b84a'); },
  'Instant Oatmeal': () => { bowl('#e3cfa4', () => { L('M-16 -6 Q-6 -12 4 -6 Q12 -2 18 -8', '#c9a86a', 2.5, false); sc(8, 3, (x, y) => D(x, y, 1.3, '#8a4a1a'), 26, 6, 0, -6); }, '#c8623a'); steam(0, -20); },
  'Granola': () => { R(0, 0, 70, 28, '#c8963a', 5, -0.25); sc(12, 6, (x, y) => E(x, y, 3.4, 2.2, '#f0d8a0', 0.5, 1.2), 26, 8); sc(5, 2, (x, y) => D(x, y, 2.2, '#5a2a1a'), 24, 7); },
  'Pancake Mix': () => { for (const y of [24, 12, 0]) { E(0, y, 34, 11, '#c88a3a'); } E(0, -3, 34, 11, '#e8b86a'); S('M-30 -2 Q-26 16 -18 6 Q-12 20 -4 4', '#a85a1a', 2); R(2, -7, 13, 9, '#fbe27a', 2, 0.2, 2.5); },
  'Maple Syrup': () => { P([[0, -38], [8, -22], [20, -28], [16, -10], [36, -12], [26, 2], [34, 10], [12, 14], [14, 26], [2, 20], [2, 38], [-2, 38], [-2, 20], [-14, 26], [-12, 14], [-34, 10], [-26, 2], [-36, -12], [-16, -10], [-20, -28], [-8, -22]], '#d8501a'); L('M0 -24 L0 18', 'rgba(110,30,0,0.5)', 1.6, false); },
  'Toaster Pastries': () => T(0, 0, 0.2, () => { R(0, 0, 50, 64, '#e3b06a', 7); R(0, 0, 36, 48, '#f7b6d2', 9, 0, 2); sc(12, 4, (x, y, r, i) => T(x, y, r * 3, () => L('M-2 0 L2 0', ['#e2483d', '#3a8ae8', '#f2c21a', '#3ab84a'][i % 4], 2, false)), 13, 19); }),
  'Peanut Butter': () => { breadSlice('#f3dcae', '#c98a3a'); S('M-18 -4 C-22 -18 18 -22 20 -6 C24 8 12 22 -4 20 C-18 18 -14 6 -18 -4Z', '#b8742a', 2.5); L('M-8 -6 Q2 -12 10 -4 Q4 6 -6 4', '#8a4e16', 2.2, false); },
  // Baking
  'All-Purpose Flour': () => { S('M-22 -22 Q-28 6 -26 34 L26 34 Q28 6 22 -22 Q10 -16 0 -22 Q-10 -16 -22 -22Z', '#f4eede'); S('M-22 -22 Q-14 -34 -18 -40 L18 -40 Q14 -34 22 -22 Q10 -16 0 -22 Q-10 -16 -22 -22Z', '#e8dfc8'); wheat(0, 8, 0, '#d9a53a', 0.75); },
  'Granulated Sugar': () => { cube(-16, 16, 13, '#ffffff'); cube(16, 16, 13, '#ffffff'); cube(0, 4, 13, '#ffffff'); cube(0, -18, 13, '#ffffff'); },
  'Brown Sugar': () => { cube(-16, 16, 13, '#b07a45'); cube(16, 16, 13, '#b07a45'); cube(0, -4, 13, '#c08a55'); },
  'Baking Soda': () => { T(0, 6, -0.3, () => { P([[-30, -8], [10, -12], [14, 14], [-26, 14]], '#c9ced6'); R(26, 0, 26, 9, '#c9ced6', 4); S('M-28 -8 Q-10 -30 10 -12Z', '#fff', 2.5); }); for (const [x, y, r] of [[-10, -28, 4], [4, -34, 3], [16, -24, 2.5]]) bub(x, y, r); },
  'Baking Powder': () => { L('M8 8 L38 34', '#c9ced6', 6); E(-8, -6, 26, 20, '#c9ced6', 0.5); S('M-28 -12 Q-10 -40 14 -4 Q-6 -2 -28 -12Z', '#fff', 2.5); },
  'Vanilla Extract': () => { L('M-34 34 Q-10 14 -6 -4', '#3a2216', 4.5); L('M-22 38 Q4 22 8 0', '#3a2216', 4.5); for (let i = 0; i < 5; i++) T(12, -12, i * TAU / 5, () => E(0, -13, 8, 13, '#fbf6e0', 0, 2.5)); D(12, -12, 5.5, '#f2c21a'); },
  'Chocolate Chips': () => { for (const [x, y, s] of [[-17, 12, 1], [17, 14, 0.9], [0, -12, 1.1]]) T(x, y, 0, () => { S('M-15 12 C-17 0 -6 -4 -2 -16 Q2 -20 2 -14 C6 -4 17 0 15 12Z', '#5a2e1a'); hi(-6, 2, 4, 2); }, s); },
  'Yellow Cake Mix': () => { P([[-34, 30], [-34, -2], [34, -18], [34, 14]], '#f6d25a'); P([[-34, -2], [0, -30], [34, -18]], '#fbf3e0'); L('M-34 14 L34 -2', '#fbf3e0', 4, false); P([[-34, 30], [-34, -2], [34, -18], [34, 14]], '', 3); E(4, -24, 5, 5, '#d0202a', 0, 2.5); },
  'Chocolate Frosting': () => { P([[-20, 6], [20, 6], [14, 36], [-14, 36]], '#e85a8a'); for (const x of [-9, 0, 9]) L(`M${x} 9 L${x * 0.75} 34`, 'rgba(120,20,60,0.45)', 1.5, false); E(0, 2, 25, 10, '#5a2e1a'); E(0, -10, 18, 9, '#5a2e1a'); E(0, -21, 11, 7, '#5a2e1a'); S('M-4 -26 Q2 -38 7 -30Z', '#5a2e1a', 2.5); for (const [x, y, c] of [[-10, 0, '#f2c21a'], [8, -8, '#3ac8e8'], [2, 4, '#fff']]) D(x, y, 1.8, c); },
  'Vegetable Oil': () => { S('M-6 -38 C8 -14 20 -2 20 10 C20 24 8 32 -6 32 C-20 32 -32 24 -32 10 C-32 -2 -20 -14 -6 -38Z', '#f0c82a'); hi(-18, 8, 4, 9, 0.3); for (let i = 0; i < 8; i++) T(26, 22, i * TAU / 8, () => E(0, -9, 3.4, 6, '#f2a21a', 0, 1.5)); D(26, 22, 5.5, '#6b4423'); },
  'Cornmeal': () => mound('#f2d26a', () => { for (const [x, y, r] of [[-30, -22, -0.3], [-16, -32, 0.2], [26, -24, 0.4]]) T(x, y, r, () => S('M0 -8 C6 -6 7 4 0 9 C-7 4 -6 -6 0 -8Z', '#f4c53a', 2)); }),
  'Powdered Sugar': () => mound('#ffffff', () => sc(12, 3, (x, y) => D(x, y, 1.6, '#b8c4d4'), 30, 8, 0, -32)),
  // Candy
  'Milk Chocolate Bars': () => T(0, 0, -0.2, () => { R(0, -8, 44, 52, '#6a3a1e', 4); for (const x of [-11, 11]) for (const y of [-24, -8]) R(x, y, 17, 12, '#7a4628', 2, 0, 1.5); P([[-24, 8], [24, 2], [24, 34], [-24, 34]], '#c9ced6'); P([[-24, 18], [24, 13], [24, 34], [-24, 34]], '#d0202a'); }),
  'Gummy Bears': () => { bear(-18, 4, '#e83a3a', 0.9); bear(18, 4, '#3ab84a', 0.9); bear(0, -2, '#f2c21a', 1.05); },
  'Sour Worms': () => { L('M-34 10 q8 -22 17 0 q8 22 17 0 q8 -22 17 0 q8 22 17 0', '#e8478a', 10); L('M2 12 q7 20 15 -2 q8 -22 17 0', '#8ae83a', 10, false); sc(14, 3, (x, y) => D(x, y, 1.2, '#fff'), 30, 10, 0, 10); D(-30, 2, 1.8, INK); },
  'Peanut Butter Cups': () => { P([[-30, -6], [30, -6], [22, 28], [-22, 28]], '#5a2e1a'); for (const x of [-18, -9, 0, 9, 18]) L(`M${x} -2 L${x * 0.8} 26`, 'rgba(0,0,0,0.35)', 1.6, false); E(0, -6, 30, 11, '#7a4628'); E(0, -6, 17, 6, '#d8a85a', 0, 2); },
  'Red Licorice': () => { for (const x of [-18, 0, 18]) { L(`M${x - 6} 36 L${x + 6} -36`, '#c8102a', 9); for (let y = -28; y <= 28; y += 11) L(`M${x - y / 6 - 4} ${y + 3} L${x - y / 6 + 4} ${y - 3}`, '#7a0a18', 1.8, false); } },
  'Lollipops': () => { L('M4 16 L18 42', '#f4f4f4', 4); E(-4, -8, 28, 28, '#fff'); L('M-4 -8 q8 -8 0 -12 q-14 -2 -14 12 q2 18 18 18 q20 -2 20 -22', '#e85ab8', 5, false); },
  'Peppermints': () => wrapped('#d0202a', 'rgba(230,240,250,0.9)', 'disc'),
  'Soft Caramels': () => wrapped('#c8822a', '#f2d21a'),
  'Jelly Beans': () => sc(11, 31, (x, y, r, i) => T(x, y, r * 3, () => { L('M-6 2 Q0 -6 6 2', ['#e83a3a', '#f2a21a', '#3ab84a', '#3a8ae8', '#a04ae8', '#e85ab8'][i % 6], 8); hi(-1, -3, 2.5, 1, 0); }), 26, 24),
  'Candy Corn': () => { candyCorn(-15, 4, -0.3); candyCorn(15, 4, 0.3); },
  'Chewing Gum': () => { for (const [x, r] of [[-22, -0.2], [-8, -0.1]]) T(x, 8, r, () => { R(0, 0, 13, 50, '#c9ced6', 2); R(0, 8, 13, 30, '#3ac8e8', 2); }); E(16, -8, 20, 20, '#f59ab8'); hi(9, -16, 5, 3); },
  'English Toffee': () => { P([[-34, -6], [-4, -24], [16, -4], [-10, 14]], '#d8a04a'); P([[-34, -6], [-4, -24], [6, -14], [-24, 2]], '#5a2e1a', 0); P([[4, 10], [34, -6], [36, 20], [14, 32]], '#d8a04a'); P([[4, 10], [34, -6], [35, 6], [8, 20]], '#5a2e1a', 0); P([[-34, -6], [-4, -24], [16, -4], [-10, 14]], '', 3); P([[4, 10], [34, -6], [36, 20], [14, 32]], '', 3); sc(6, 2, (x, y) => E(x, y, 2.2, 1.4, '#f3e3c4', 0.5, 0), 12, 5, -12, -10); },
  // Coffee & tea
  'Ground Coffee': () => mug('#c8282a', '#3a2216', { steam: true }),
  'Whole Bean Coffee': () => { for (const [x, y, r] of [[-16, -10, -0.5], [16, -4, 0.6], [-2, 20, 0.1]]) T(x, y, r, () => { E(0, 0, 13, 18, '#5a3220'); L('M0 -16 Q-6 -4 0 0 Q6 4 0 16', '#2a140a', 2.2, false); hi(-6, -6, 3, 5, 0); }); },
  'Decaf Coffee': () => mug('#2a8a4a', '#3a2216', { fn: () => { g.save(); g.beginPath(); g.arc(0, 10, 10, 0, TAU); g.arc(5, 7, 8.5, 0, TAU, true); g.fillStyle = '#fbf3c0'; g.fill('evenodd'); g.restore(); } }),
  'Instant Coffee': () => { L('M6 4 L36 34', '#c9ced6', 6); E(-8, -8, 26, 19, '#c9ced6', 0.5); S('M-28 -14 Q-12 -40 14 -6 Q-6 -4 -28 -14Z', '#5a3220', 2.5); sc(8, 2, (x, y) => D(x, y, 1.4, '#8a5a3a'), 12, 6, -8, -18); },
  'Coffee Pods': () => { P([[-26, -18], [26, -18], [18, 30], [-18, 30]], '#2a2a2a'); E(0, -18, 26, 9, '#c9ced6'); E(0, -18, 14, 4.5, '#8a6a4a', 0, 1.6); L('M-18 0 L18 0', '#c8282a', 4, false); },
  'Green Tea': () => { E(0, 26, 34, 7, '#e9eef5'); S('M-26 -8 Q-24 20 0 22 Q24 20 26 -8Z', '#fbfbf5'); E(0, -8, 26, 8, '#a8c84a'); L('M26 -2 Q40 0 30 12', '#fbfbf5', 4.5); leaf(-8, -9, -0.2, '#4c9a3a', 0.8); },
  'Black Tea': () => { L('M24 -6 Q44 -4 40 10 Q36 22 24 18', '#b8382a', 6); S('M-24 4 Q-42 0 -40 -14 L-34 -14 Q-34 -4 -22 -4Z', '#b8382a'); E(0, 8, 28, 24, '#b8382a'); R(0, -16, 30, 7, '#8a2a1e', 3); E(0, -22, 5, 4, '#8a2a1e'); hi(-12, 0, 4, 9, 0.3); },
  'Chamomile Tea': () => { L('M0 10 Q4 28 -4 40', '#4c9a3a', 3.5); leaf(0, 28, 0.3, '#4c9a3a', 0.8); for (let i = 0; i < 10; i++) T(0, -6, i * TAU / 10, () => E(0, -17, 5.5, 12, '#fff', 0, 2.2)); E(0, -6, 9, 9, '#f2c21a', 0, 2.5); },
  'Hot Cocoa Mix': () => mug('#3a8ae8', '#6a3a22', { marsh: true, steam: false }),
  'Coffee Creamer': () => { E(0, 6, 38, 34, '#fbfbf5'); E(0, 6, 30, 27, '#c8905a', 0, 2.5); S('M0 24 C-22 8 -12 -10 0 -2 C12 -10 22 8 0 24Z', '#fff6e6', 0); L('M0 -14 L0 -6', '#fff6e6', 3, false); },
  'Clover Honey': () => { for (const [x, y] of [[-20, 16], [-4, 25], [-20, 34]]) P([0, 1, 2, 3, 4, 5].map((i) => [x + Math.cos(i * TAU / 6) * 9.5, y + Math.sin(i * TAU / 6) * 9.5]), '#f2b21a', 2.2); L('M30 -38 L8 -8', '#c8963a', 4.5); for (const [x, y, r] of [[8, -8, 8], [3, -1, 10], [-2, 6, 8]]) E(x, y, r, r * 0.55, '#e8a01a', -0.9, 2.5); S('M-8 12 C-4 18 -4 24 -8 26 C-12 24 -12 18 -8 12Z', '#f2b21a', 2); },
  'Cold Brew': () => { glass('#2a1a12', { ice: true }); T(30, 24, 0.5, () => { E(0, 0, 7, 10, '#5a3220', 0, 2.5); L('M0 -8 Q-3 0 0 8', '#2a140a', 1.6, false); }); },
  // Deli
  'Sliced Turkey': () => fan('#f0d8c0', null, '#c89a6a'),
  'Honey Ham': () => { S('M-34 6 C-36 -22 -4 -34 16 -24 C32 -16 34 4 26 18 C16 32 -30 32 -34 6Z', '#c8743a'); S('M-24 8 C-26 -12 -2 -22 12 -15 C24 -9 25 4 19 13 C12 23 -22 24 -24 8Z', '#f0a0a8', 2); for (const d of ['M-14 -4 L6 14', 'M0 -12 L18 4', 'M-16 12 L8 -12', 'M-4 18 L20 -4']) L(d, 'rgba(160,60,70,0.5)', 1.5, false); L('M26 -20 L36 -32', '#fbf6ea', 6); },
  'Genoa Salami': () => { T(6, -10, -0.5, () => { R(0, 0, 60, 24, '#8a2a30', 12); for (const x of [-16, 0, 16]) L(`M${x} -12 L${x} 12`, '#f3e3c4', 1.6, false); }); E(-12, 20, 17, 14, '#a8323a'); sc(8, 3, (x, y) => D(x, y, 1.8, '#f6e0d8'), 11, 9, -12, 20); },
  'Roast Beef': () => fan('#8a4a32', '#d87a7a', '#5a2e1a'),
  'Provolone': () => { E(-8, 6, 30, 26, '#f2e8c2'); E(10, -4, 30, 26, '#f8f0d0'); for (const [x, y, r] of [[2, -10, 3], [18, 4, 2.4], [8, 10, 2]]) E(x, y, r, r, '#e0d2a0', 0, 1.5); },
  'Pepper Jack': () => wedge('#f8ecc0', { flecks: true }),
  'Potato Salad': () => bowl('#f2e28a', () => { sc(9, 3, (x, y) => R(x, y, 8, 7, '#fbf3c8', 2, 0.4, 1.4), 28, 6, 0, -6); sc(6, 5, (x, y) => D(x, y, 1.5, '#3f8f2f'), 28, 6, 0, -6); }, '#e2483d'),
  'Coleslaw': cabbage,
  'Hummus': () => bowl('#d8b47a', () => { L('M-18 -6 Q-8 -14 2 -8 Q12 -2 6 2 Q-2 4 -6 -2', '#c09a5a', 2.5, false); E(4, -6, 6, 3, '#f0c82a', 0, 0); sc(8, 3, (x, y) => D(x, y, 1.3, '#c8321a'), 24, 6, 0, -6); }, '#a85a3a'),
  'Rotisserie Chicken': () => { S('M-30 4 C-32 -22 -6 -30 10 -24 C30 -18 34 6 24 18 C12 30 -26 28 -30 4Z', '#c8822a'); S('M14 12 Q30 16 36 28', '', 0); L('M16 14 L32 28', '#b8742a', 9); E(36, 31, 4.5, 4.5, '#fbf6ea'); L('M-22 16 L-34 30', '#b8742a', 9); E(-37, 33, 4.5, 4.5, '#fbf6ea'); hi(-10, -12, 10, 4); },
  'Pasta Salad': () => bowl('#f3e3b0', () => { for (const [x, c] of [[-20, '#e8a03a'], [-6, '#3f9a3a'], [8, '#e0522a'], [22, '#f2d26a']]) L(`M${x - 5} -9 l4 2 l-4 2 l4 2 l-4 2`, c, 3.5); }, '#16a085'),
  'Pimento Cheese': () => { R(0, 10, 60, 44, '#e3b46a', 6, -0.1); for (const [x, y] of [[-18, -4], [18, -8], [-16, 24], [20, 20]]) D(x, y, 1.8, '#a8742a'); S('M-18 8 C-22 -8 16 -14 18 2 C22 16 6 26 -6 22 C-16 20 -14 14 -18 8Z', '#f29a3a', 2.5); sc(7, 3, (x, y) => D(x, y, 1.6, '#d0201a'), 12, 9, 0, 6); },
  // Cleaning
  'Dish Soap': () => { E(-4, 8, 32, 30, '#fbfbf5'); E(-4, 8, 20, 19, '#eef2f6', 0, 2); for (const [x, y, r] of [[20, -18, 10], [32, -2, 6], [10, -30, 6], [28, -30, 4]]) bub(x, y, r); },
  'Laundry Detergent': () => { P([[-14, -30], [-34, -18], [-26, -2], [-18, -8], [-18, 32], [18, 32], [18, -8], [26, -2], [34, -18], [14, -30], [6, -24], [-6, -24]], '#3a8ae8'); spark(-4, 4, 8, '#fff'); spark(8, 18, 5, '#fff'); },
  'Bleach': () => { S('M-8 -36 L8 -36 L8 -26 L24 -14 L24 36 L-24 36 L-24 -20Z', '#fbfbf5'); R(0, -38, 20, 8, '#2a62b8', 3); ring(13, -6, 9, 4.5, '#e2e8ee', 1.3, 2); R(-4, 16, 30, 20, '#2a62b8', 3, 0, 2.5); spark(-4, 16, 7, '#fff'); spark(30, -30, 6); },
  'Glass Cleaner': () => { R(0, 0, 62, 66, '#8a5a2a', 4); R(0, 0, 50, 54, '#aee0f8', 2, 0, 2); L('M0 -27 L0 27', '#8a5a2a', 3.5, false); L('M-25 0 L25 0', '#8a5a2a', 3.5, false); L('M-18 -8 L-8 -20', '#fff', 2.5, false); L('M8 20 L18 8', '#fff', 2.5, false); spark(26, -26, 8); },
  'All-Purpose Spray': () => bottleIcon('#5ac83a', 'spray'),
  'Scrub Sponges': () => { R(0, 8, 64, 34, '#f2d21a', 6); R(0, -12, 64, 14, '#3a9a4a', 5); sc(12, 3, (x, y) => E(x, y, 2.4, 1.8, 'rgba(170,130,0,0.5)', 0, 0), 26, 10, 0, 10); },
  'Trash Bags': () => { S('M-10 -18 C-36 -6 -34 34 -18 36 L18 36 C34 34 36 -6 10 -18Z', '#2e2e34'); P([[-8, -18], [-20, -36], [0, -26], [20, -36], [8, -18]], '#2e2e34'); L('M-9 -18 L9 -18', '#f2c21a', 3, false); hi(-14, 6, 4, 12, 0.3); },
  'Dishwasher Pods': () => { R(0, 0, 58, 54, '#fbfbf5', 14); S('M0 0 C-24 -4 -22 -22 0 -22Z', '#2a62b8', 2); S('M0 0 C24 -4 22 18 6 20Z', '#3ab84a', 2); S('M0 0 C-4 22 -22 18 -22 2Z', '#3ac8e8', 2); hi(-16, -16, 5, 2.5); },
  'Fabric Softener': () => { for (const [y, c] of [[22, '#a87ae8'], [4, '#f59ab8'], [-14, '#8ad8f2']]) { R(0, y, 62, 18, c, 6); L(`M-24 ${y + 2} L20 ${y + 2}`, 'rgba(0,0,0,0.2)', 1.5, false); } for (let i = 0; i < 5; i++) T(20, -30, i * TAU / 5, () => E(0, -6, 4, 6, '#fff', 0, 1.8)); D(20, -30, 3, '#f2c21a'); },
  'Floor Cleaner': () => { L('M-30 -40 L4 14', '#c8963a', 4.5); for (const d of ['M4 14 L-8 34', 'M4 14 L0 36', 'M4 14 L8 36', 'M4 14 L16 32']) L(d, '#f4f4f4', 4); P([[6, 4], [38, 4], [34, 36], [10, 36]], '#3a8ae8'); L('M6 6 Q22 -14 38 6', '#c9ced6', 3); },
  'Scrub Brush': () => { R(0, -14, 68, 20, '#c8863a', 9); for (let x = -27; x <= 27; x += 6) L(`M${x} -2 L${x} 22`, '#f4f4f4', 3.4); E(18, -14, 5, 3, '#8a5a1e', 0, 0); },
  'Rubber Gloves': () => { S('M-14 38 L-16 6 Q-30 -4 -26 -12 Q-20 -14 -14 -4 L-14 -30 Q-10 -38 -6 -30 L-5 -8 L-3 -36 Q1 -44 5 -36 L5 -8 L8 -32 Q12 -40 16 -32 L15 -4 L19 -22 Q24 -28 26 -20 L22 10 L20 38Z', '#f2e21a'); L('M-14 28 L20 28', 'rgba(150,120,0,0.6)', 2, false); },
  // Paper goods
  'Paper Towels': () => roll(62, true),
  'Toilet Paper 12-Pack': () => { E(-4, -2, 30, 30, '#fbfbf6'); E(-4, -2, 10, 10, '#b89a7a', 0, 2.5); D(-4, -2, 6, '#8a6a4a'); P([[26, -2], [38, -2], [38, 34], [26, 34]], '#fbfbf6'); L('M27 16 L37 16', 'rgba(0,0,0,0.25)', 1.2, false); },
  'Facial Tissues': () => { P([[-34, -4], [34, -4], [34, 32], [-34, 32]], '#8ac8e8'); P([[-34, -4], [-22, -18], [36, -18], [34, -4]], '#b0dcf2'); E(4, -11, 16, 4, '#5a9ac8', 0, 2); S('M-6 -11 Q-10 -36 2 -30 Q8 -42 14 -28 Q20 -24 14 -11Z', '#fff', 2.5); for (const [x, y] of [[-18, 14], [16, 14]]) spark(x, y, 5, '#fff'); },
  'Paper Plates': () => { for (const y of [22, 14]) E(0, y, 38, 13, '#f2f2ea'); E(0, 4, 38, 15, '#fbfbf6'); E(0, 4, 24, 9, '#f2f2ea', 0, 2); for (let i = 0; i < 12; i++) { const a = i * TAU / 12; L(`M${Math.cos(a) * 27} ${4 + Math.sin(a) * 10.5} L${Math.cos(a) * 35} ${4 + Math.sin(a) * 13.5}`, 'rgba(0,0,0,0.2)', 1.3, false); } },
  'Napkins': () => { R(0, 24, 62, 12, '#e8e8e8', 2); P([[-34, 16], [0, -32], [34, 16]], '#fbfbf6'); P([[0, -32], [34, 16], [8, 16]], '#eeeee6', 2); sc(6, 2, (x, y) => D(x, y, 1.4, '#e2483d'), 10, 8, -10, 4); },
  'Aluminum Foil': () => { P([[-6, -10], [36, -26], [38, 20], [0, 30]], '#dfe4ea'); for (const d of ['M6 0 L30 -12', 'M8 16 L34 4', 'M16 -8 L22 22']) L(d, 'rgba(255,255,255,0.9)', 1.8, false); T(-14, 8, -0.35, () => { R(0, 0, 22, 62, '#aab4c0', 8); hi(-4, 0, 2.5, 22, 0); }); },
  'Plastic Wrap': () => { P([[-6, -10], [36, -26], [38, 20], [0, 30]], 'rgba(190,225,250,0.55)'); L('M8 0 L30 -12', 'rgba(255,255,255,0.95)', 2.2, false); T(-14, 8, -0.35, () => { R(0, 0, 22, 62, '#d84a3a', 8); R(0, 0, 22, 20, '#fbfbf5', 2, 0, 2); }); },
  'Zipper Bags': () => { R(0, 4, 60, 62, 'rgba(210,235,250,0.7)', 5); L('M-28 -18 L28 -18', '#3a6ae8', 2.4, false); L('M-28 -13 L28 -13', '#e2483d', 2.4, false); R(18, -15.5, 12, 11, '#3a6ae8', 2, 0, 2.5); E(-4, 14, 14, 13, '#d8a04a'); for (const [x, y] of [[-9, 10], [0, 18], [3, 9]]) D(x, y, 2.2, '#5a2e1a'); },
  'Paper Cups': stackCups,
  'Coffee Filters': () => { P([[-36, -18], [36, -18], [16, 32], [-16, 32]], '#fbf6ea'); for (const x of [-24, -12, 0, 12, 24]) L(`M${x} -16 L${x * 0.45} 30`, 'rgba(150,120,80,0.5)', 1.6, false); S('M-30 -18 Q0 -2 30 -18Z', '#5a3220', 2.5); },
  'Parchment Paper': () => { S('M-30 -24 L24 -30 Q38 -28 34 -16 L30 26 L-24 32 Q-38 30 -34 18Z', '#e3cfa4'); S('M24 -30 Q38 -28 34 -16 Q26 -18 24 -30Z', '#c8b28a', 2.5); for (const [x, y] of [[-10, -6], [12, 10]]) { E(x, y, 12, 11, '#d8a04a', 0, 2.5); for (const [a, b] of [[-4, -3], [3, 3], [4, -4]]) D(x + a, y + b, 2, '#5a2e1a'); } },
  'Plastic Forks': () => { fork(-12, 2, -0.3, '#f4f4f4'); fork(12, 2, 0.3, '#e8e8ee'); },
  // Health & beauty
  'Shampoo': () => bottleIcon('#5a8ae8', 'pump', () => { for (const [x, y, r] of [[26, -20, 7], [34, -6, 5], [24, -34, 4]]) bub(x, y, r); }),
  'Conditioner': () => { R(0, -20, 70, 14, '#e85aa8', 5); for (let x = -30; x <= 30; x += 7.5) L(`M${x} -12 L${x} 26`, '#e85aa8', 3.6); },
  'Body Wash': () => { L('M0 -26 Q-16 -44 -4 -44 Q8 -44 0 -26', '#fbfbf5', 3); E(0, 6, 34, 32, '#3ac8a8'); for (const d of ['M-26 0 Q-14 -14 -2 0 Q10 14 24 0', 'M-22 18 Q-10 6 2 18 Q12 28 22 16', 'M-18 -16 Q-6 -28 6 -16 Q14 -8 22 -18']) L(d, '#1e9a80', 2.2, false); bub(28, -24, 6); },
  'Toothpaste': () => T(0, 0, -0.35, () => { P([[-36, -14], [14, -11], [14, 11], [-36, 14]], '#fbfbf5'); P([[-36, -14], [-36, 14], [-28, 14], [-28, -14]], '#e83a3a', 2); R(22, 0, 16, 16, '#e83a3a', 3); L('M-18 0 L4 0', '#3a8ae8', 4, false); L('M32 0 q5 -8 9 0 q-2 8 4 10', '#3ac8e8', 5); }),
  'Toothbrushes': () => T(0, 0, -0.6, () => { R(8, 6, 78, 9, '#3ab8e8', 4.5); for (let x = -28; x <= -10; x += 4.5) L(`M${x} 2 L${x} -12`, '#fbfbf5', 3.2); }),
  'Deodorant': () => { R(0, 12, 34, 44, '#2a3a6a', 6); R(0, 30, 34, 9, '#1a2444', 3); S('M-15 -10 L-15 -24 Q0 -40 15 -24 L15 -10Z', '#e8eef8'); R(0, 10, 22, 16, '#8ad8f2', 3, 0, 2); },
  'Bar Soap': () => { R(0, 10, 64, 38, '#e8c8f0', 12); E(0, 10, 20, 9, '#d8b0e8', 0, 2); for (const [x, y, r] of [[-20, -18, 8], [-4, -28, 6], [10, -18, 5], [26, -22, 7]]) bub(x, y, r); },
  'Hand Lotion': () => bottleIcon('#f2c8a8', 'pump', () => { for (let i = 0; i < 5; i++) T(0, 16, i * TAU / 5, () => E(0, -5, 3, 5, '#e85a8a', 0, 1.4)); D(0, 16, 2.4, '#f2c21a'); }),
  'Pain Reliever': () => { T(-8, -10, -0.6, () => { R(0, 0, 50, 20, '#fbfbf5', 10); g.save(); g.beginPath(); g.rect(-25, -10, 25, 20); g.clip(); R(0, 0, 50, 20, '#d82a2a', 10); g.restore(); }); E(14, 20, 15, 13, '#fbfbf5'); L('M3 20 L25 20', 'rgba(0,0,0,0.3)', 1.6, false); },
  'Bandages': () => T(0, 0, -0.5, () => { R(0, 0, 76, 26, '#e8c8a8', 13); R(0, 0, 26, 26, '#f6e6d2', 2, 0, 2.5); for (const sx of [-1, 1]) for (const [x, y] of [[20, -5], [26, 0], [20, 5]]) D(sx * x, y, 1.5, '#b8926a'); }),
  'Mint Mouthwash': () => { for (const [r, c, s] of [[-2.2, '#3ab84a', 1.5], [-1.1, '#58d06a', 1.6], [-0.2, '#3ab84a', 1.5]]) leaf(0, 28, r, c, s * 1.2); spark(26, -22, 8, '#8ad8f2'); spark(-28, -24, 5, '#8ad8f2'); },
  'Cotton Swabs': () => { for (const r of [-0.6, 0.6]) T(0, 0, r, () => { L('M0 -30 L0 30', '#8ac8e8', 3.5); E(0, -32, 6, 9, '#fff', 0, 2.5); E(0, 32, 6, 9, '#fff', 0, 2.5); }); },
  // Pet supplies
  'Dry Dog Food': () => { S('M-28 0 Q-30 -22 0 -22 Q30 -22 28 0Z', '#8a5a2a'); sc(14, 3, (x, y) => D(x, y, 2.4, '#6b4020'), 20, 8, 0, -10); P([[-30, 0], [30, 0], [38, 32], [-38, 32]], '#d0282a'); bone(0, 17, 22, 7, '#fff'); },
  'Dry Cat Food': () => catFace('#f2a03a'),
  'Wet Cat Food': () => { R(0, 16, 60, 30, '#e85a8a', 5); E(0, 2, 30, 10, '#b86a4a'); E(14, -20, 28, 9, '#c9ced6', -0.5); T(0, 20, 0, () => fish('#fff'), 0.42); },
  'Wet Dog Food': dogFace,
  'Dog Treats': () => { bone(-8, -14, 36, 11, '#d8a45a', -0.3); bone(8, 16, 36, 11, '#c8863a', 0.2); },
  'Cat Litter': () => { P([[-38, -2], [38, -2], [30, 32], [-30, 32]], '#5a8a9a'); E(0, -2, 38, 11, '#e3d2a8'); sc(14, 3, (x, y) => D(x, y, 1.4, '#b8a070'), 30, 7, 0, -2); L('M10 -10 L34 -38', '#e2483d', 5); R(8, -8, 16, 12, '#e2483d', 3, -0.8); },
  'Bird Seed': () => { S('M-30 4 C-30 -18 -6 -26 10 -18 L18 -24 Q30 -22 28 -8 C34 10 14 26 -4 24 L-30 34 L-22 16 Q-30 12 -30 4Z', '#3a8ae8'); S('M-12 0 Q4 -6 12 8 Q-2 16 -12 0Z', '#2a62b8', 2); P([[28, -16], [40, -12], [28, -8]], '#f2a21a', 2.5); D(20, -15, 2.4, INK); sc(7, 3, (x, y) => E(x, y, 2.4, 1.6, '#c8a83a', 0.5, 1), 14, 4, 16, 34); },
  'Fish Flakes': () => { fish('#f28a1c', { stripes: '#fff' }); bub(-30, -26, 4); bub(-22, -36, 3); },
  'Chew Toys': () => { E(0, 0, 35, 35, '#c8e83a'); L('M-26 -22 Q-4 0 -26 22', '#fff', 3.5, false); L('M26 -22 Q4 0 26 22', '#fff', 3.5, false); hi(-6, -22, 8, 3, 0); },
  'Cat Treats': () => { for (const [x, y, r, c] of [[-10, -18, -0.2, '#e8a03a'], [10, 2, 0.2, '#d8703a'], [-8, 22, -0.1, '#e8b85a']]) T(x, y, r, () => fish(c), 0.55); },
  'Puppy Pads': () => { R(0, 0, 70, 60, '#8ad8f2', 6); R(0, 0, 56, 46, '#fbfbf5', 4, 0, 2); for (const x of [-14, 0, 14]) L(`M${x} -22 L${x} 22`, 'rgba(120,170,210,0.4)', 1.2, false); paw(0, 0, 14, '#5a9ac8'); },
  'Rawhide Bones': () => { bone(0, 0, 44, 15, '#f0e2c2', -0.4); T(0, 0, -0.4, () => { for (const x of [-12, 0, 12]) L(`M${x - 3} -7 L${x + 3} 7`, 'rgba(150,110,60,0.55)', 1.8, false); }); },
  // Spices
  'Black Pepper': () => sc(14, 41, (x, y, r) => { E(x, y, 6 + r * 2, 6 + r * 2, '#2e2a28', 0, 2); hi(x - 2, y - 2, 2, 1.2); }, 28, 24),
  'Sea Salt': () => { S('M-16 -14 L-20 34 L20 34 L16 -14Z', 'rgba(225,240,250,0.85)'); S('M-17 6 L-19 33 L19 33 L17 6Z', '#fff', 0); S('M-16 -14 C-16 -34 16 -34 16 -14Z', '#c9ced6'); for (const [x, y] of [[-6, -22], [0, -27], [6, -22]]) D(x, y, 1.6, INK); txt('S', 0, 18, 20, '#3a6ae8'); },
  'Garlic Powder': garlic,
  'Onion Powder': onionHalf,
  'Smoked Paprika': paprika,
  'Ground Cinnamon': () => { for (const [x, r] of [[-12, -0.25], [0, -0.1], [12, 0.1]]) T(x, 0, r, () => { R(0, 0, 13, 70, '#9a5a2a', 5); E(0, -34, 6.5, 3, '#6a3a16', 0, 2); L('M-2 -34 q3 1 2 3', '#3a1e0a', 1.2, false); }); R(0, 6, 46, 7, '#e8d8a8', 3, -0.08); },
  'Chili Powder': () => chili('#8a1c12', { pile: true }),
  'Ground Cumin': () => sc(18, 44, (x, y, r) => T(x, y, r * 3, () => { E(0, 0, 8, 2.8, '#a8742a', 0, 1.8); L('M-6 0 L6 0', 'rgba(70,40,0,0.5)', 1, false); }), 30, 24),
  'Dried Oregano': () => { L('M0 38 Q4 0 -2 -34', '#5a7a2a', 3); for (const [y, s] of [[-28, 5], [-14, 7], [2, 8.5], [18, 9.5]]) { E(-s - 1, y, s, s * 0.8, '#6a9a3a', -0.4, 2.2); E(s + 3, y + 4, s, s * 0.8, '#7aaa4a', 0.4, 2.2); } },
  'Italian Seasoning': () => { leaf(-34, 20, -0.9, '#3f9a3a', 2.3); L('M22 36 L16 -34', '#6a5a2a', 2.5); for (let y = -30; y <= 28; y += 7) { L(`M${18 + y * -0.09} ${y} l-10 -6`, '#4a8a3a', 2.2, false); L(`M${18 + y * -0.09} ${y} l10 -6`, '#4a8a3a', 2.2, false); } },
  'Taco Seasoning': () => { S('M-36 22 C-36 -32 36 -32 36 22Z', '#f2c23a'); for (const x of [-22, -8, 6, 20]) E(x, 20, 9, 7, '#5ab83a', 0, 2.5); for (const x of [-14, 0, 14]) E(x, 24, 5, 4, '#e0412d', 0, 2); sc(8, 3, (x, y) => D(x, y, 1.4, 'rgba(150,90,0,0.5)'), 22, 12, 0, -4); L('M-36 26 L36 26', '#d8a02a', 5); },
  'Red Pepper Flakes': () => sc(26, 47, (x, y, r, i) => { if (i % 3) T(x, y, r * 3, () => P([[-5, -2], [2, -4], [5, 1], [-1, 4]], i % 2 ? '#d8401a' : '#a8281a', 1.5)); else E(x, y, 2.6, 2, '#f2d88a', 0, 1.2); }, 30, 26),
};

// little tomato printed on the ketchup bottle
function tomato2(x, y) { E(x, y, 8, 7, '#e0412d', 0, 2); D(x, y - 6, 2.4, '#3f8f2f'); }

export const hasArt = (name) => name in A;

// Draw a product's picture centered at (cx, cy), about `size` pixels across.
export function drawArt(ctx, name, cx, cy, size) {
  const f = A[name];
  if (!f) return false;
  g = ctx;
  g.save();
  g.translate(cx, cy);
  g.scale(size / 100, size / 100);
  try { f(); } finally { g.restore(); }
  return true;
}

// Small PNG of a product's picture for HUD <img> tags. Cached, and handed out
// as a short blob: URL so HUD markup stays small.
const icons = new Map();
export function iconURL(name) {
  if (!icons.has(name)) {
    const c = document.createElement('canvas');
    c.width = c.height = 72;
    drawArt(c.getContext('2d'), name, 36, 36, 70);
    const bin = atob(c.toDataURL('image/png').split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    icons.set(name, URL.createObjectURL(new Blob([bytes], { type: 'image/png' })));
  }
  return icons.get(name);
}
