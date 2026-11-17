import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Procedural 3D models for every product. Each model is merged into ONE
// geometry with vertex colors so a product is still a single draw call.
// The product's label texture is 256x256: x 0..224 is the label art and
// x 232..256 is plain white, so untextured parts sample white and just
// show their vertex color.

export const LABEL_U = 224 / 256;
const WHITE_U = 244 / 256;

// Models picked by product name (the rest are picked by shape).
const BY_NAME = {
  'Red Apples': 'apple', 'Green Apples': 'apple', 'Oranges': 'orange', 'Lemons': 'citrus',
  'Limes': 'citrus', 'Bananas': 'banana', 'Tomatoes': 'tomato', 'Russet Potatoes': 'potato',
  'Yellow Onions': 'onion', 'Avocados': 'avocado', 'Peaches': 'peach', 'Cantaloupe': 'melon',
  'Rotisserie Chicken': 'chicken', 'Croissants': 'croissant', 'Blueberry Muffins': 'muffin',
  'Ground Beef': 'meat:ground', 'Ground Turkey': 'meat:ground', 'Chicken Breasts': 'meat:pieces',
  'Chicken Thighs': 'meat:pieces', 'Pork Chops': 'meat:chops', 'Ribeye Steak': 'meat:steak',
  'Salmon Fillet': 'meat:fillet',
  'Sliced Turkey': 'deli', 'Honey Ham': 'deli', 'Genoa Salami': 'deli', 'Roast Beef': 'deli',
  'Provolone': 'deli', 'Pepper Jack': 'cheese', 'Sliced Swiss': 'cheese', 'Flour Tortillas': 'tortilla',
  'Thick Cut Bacon': 'meat:bacon', 'Puppy Pads': 'box', 'Large Eggs': 'eggs',
  'Rice Cakes': 'roll', 'Paper Cups': 'cups',
  'Bratwurst': 'meat:links', 'Breakfast Sausage': 'meat:links',
  'Glass Cleaner': 'spray', 'All-Purpose Spray': 'spray',
  'Ketchup': 'squeeze', 'Yellow Mustard': 'squeeze', 'Clover Honey': 'squeeze',
  'Hand Lotion': 'pump', 'Maple Syrup': 'syrup', 'Pain Reliever': 'pillBottle', 'Deodorant': 'deodorant',
  'Sparkling Water': 'sodaCan', 'Energy Drink': 'sodaCan',
  'Scrub Sponges': 'sponge', 'Scrub Brush': 'brush', 'Rawhide Bones': 'bone', 'Chew Toys': 'ringToy',
};

const BY_SHAPE = {
  ball_s: 'apple', ball_m: 'apple', ball_l: 'melon', bunch: 'banana', jug: 'jug', carton: 'carton',
  carton_s: 'carton', stick: 'box', eggs: 'box', pouch: 'pillow', slices: 'cheese', tub: 'tub',
  tub_l: 'tub', pizza: 'box', bag_s: 'pillow', box_m: 'box', box_s: 'box', box_long: 'box',
  can: 'can', can_s: 'can', can_l: 'canLid', can_tall: 'can', loaf: 'loaf', buns: 'buns', jar: 'jar',
  jar_l: 'jar', bottle: 'bottle', bottle_s: 'bottle', bottle_l: 'soda', bottle_f: 'flatBottle',
  tray: 'meat:pieces', pack6: 'water6', chips: 'pillow', cereal: 'box', flour: 'paperBag',
  bigbag: 'pillow', roll: 'roll', tp: 'tp', spice: 'spice', dome: 'chicken', plates: 'plates',
};

export const modelKey = (p) => BY_NAME[p.name] || BY_SHAPE[p.shapeKey] || 'box';

// Fresh food (no package) needs no label texture.
const NO_LABEL = new Set(['apple', 'orange', 'citrus', 'tomato', 'potato', 'onion', 'avocado', 'peach', 'melon', 'banana',
  'loaf', 'buns', 'croissant', 'muffin', 'chicken', 'deli', 'cheese', 'tortilla', 'meat', 'water6',
  'sponge', 'brush', 'bone', 'ringToy']);
export const hasLabel = (p) => !NO_LABEL.has(modelKey(p));

// Surface finish by package type: cans are metal, bottles are glossy, boxes are matte.
export function finish(p) {
  const k = modelKey(p).split(':')[0];
  if (['can', 'canLid', 'sodaCan'].includes(k)) return { roughness: 0.3, metalness: 0.45 };
  if (['bottle', 'soda', 'flatBottle', 'jug', 'jar', 'spice', 'spray', 'squeeze', 'pump', 'syrup', 'pillBottle', 'deodorant'].includes(k)) return { roughness: 0.22, metalness: 0.05 };
  if (['pillow'].includes(k)) return { roughness: 0.35, metalness: 0.1 };
  return { roughness: 0.6, metalness: 0 };
}

// ---------- helpers ----------
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const C = (hex) => new THREE.Color(hex);
const shade = (c, l) => c.clone().offsetHSL(0, 0, l);
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const V3 = THREE.Vector3;

// Smooth 3D value noise (0..1) for organic bumps and color patterns.
function hash(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function noise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(
    L(L(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), L(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    L(L(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), L(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x, y, z, oct = 3) {
  let a = 0.5, f = 1, s = 0, n = 0;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, y * f, z * f); n += a; f *= 2.03; a *= 0.5; }
  return s / n;
}

// Turn a geometry into a model part: vertex colors + UVs pointing at
// the label art (label=true) or the white strip.
// Kept indexed (shared corners) so smooth shapes cost a third of the memory.
function part(geo, color, label = false) {
  const g = geo;
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.position.count;
  const uv = g.attributes.uv;
  for (let i = 0; i < n; i++) {
    if (label) uv.setX(i, uv.getX(i) * LABEL_U);
    else uv.setXY(i, WHITE_U, 0.5);
  }
  const c = label ? C(0xffffff) : color;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}

// Per-vertex coloring of a finished part: fn(position, normal) -> Color.
function paint(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
  const v = new V3(), nn = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); nn.fromBufferAttribute(n, i);
    const col = fn(v, nn);
    c.setXYZ(i, col.r, col.g, col.b);
  }
  return g;
}
const painted = (geo, fn) => paint(part(geo, C(0xffffff)), fn);

// Move every vertex: fn(v) edits the Vector3 in place.
function warp(g, fn) {
  const p = g.attributes.position, v = new V3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v); p.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
// Weld seams and recompute normals so warped shapes shade smoothly.
function smooth(g) {
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-6);
  m.computeVertexNormals();
  return m;
}
// Organic lumps: push vertices in or out from the center using noise.
const bumpy = (g, amp, freq, seed = 0, oct = 2) => warp(g, (v) => {
  v.multiplyScalar(1 + (fbm(v.x * freq + seed, v.y * freq + seed * 1.7, v.z * freq - seed, oct) - 0.5) * 2 * amp);
});

// Detail level: every round shape's segment count is scaled by this. 1500
// items are drawn each frame, so this is the main speed/looks trade-off.
let Q = 0.55;
// Item detail setting (Settings > Video). Rebuilt models use the new level.
export function setDetail(v) { Q = Math.min(1, Math.max(0.3, +v || 0.55)); cache.clear(); }
const q = (n, m = 2) => Math.max(m * 2, Math.round((n * Q) / m) * m);

const at = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
const torus = (R, r, rs, ts, arc) => new THREE.TorusGeometry(R, r, Math.max(3, Math.round(rs * Q)), q(ts), arc);
const box = (w, h, d, ws = 1, hs = 1, ds = 1) => new THREE.BoxGeometry(w, h, d, ws, hs, ds);
// rounded-edge box, so packages catch light on their edges instead of looking razor sharp
const rbox = (w, h, d, k = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * k);
// open label sleeves start at the back so the label art's center faces +z
const sleeve = (r, h, seg = 28) => new THREE.CylinderGeometry(r, r, h, q(seg), 1, true, Math.PI);
const cyl = (rt, rb, h, seg = 24) => new THREE.CylinderGeometry(rt, rb, h, q(seg));
const sphere = (r, ws = 20, hs = 14, ...rest) => new THREE.SphereGeometry(r, q(ws), q(hs, 1), ...rest);
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), q(seg), Math.PI);
// lathe through a smooth curve that passes through the given profile points
function slathe(pts, scale, seg = 28, n = 28) {
  const curve = new THREE.SplineCurve(pts.map(([x, y]) => new THREE.Vector2(Math.max(x, 0.0005) * scale, y * scale)));
  return new THREE.LatheGeometry(curve.getPoints(q(n, 1)), q(seg));
}
// cap with grip ridges around its side
function ribbedCap(r, h, ribs = 24) {
  const g = new THREE.CylinderGeometry(r, r, h, q(ribs) * 2, 1);
  ribs = q(ribs);
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getY(i)) > 0.5) continue;           // only the side, not the top/bottom
    const s = 1 + 0.05 * (Math.cos(Math.atan2(p.getZ(i), p.getX(i)) * ribs) > 0 ? 1 : 0);
    p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

// A tube along a curve whose radius can change along it: rFn(t, angle).
// Ends close up when rFn goes to ~0 there. Used for bananas, sausages, legs.
function taperTube(curve, rFn, tub = 24, rad = 12) {
  tub = q(tub, 1); rad = q(rad);
  const frames = curve.computeFrenetFrames(tub, false);
  const pos = [], idx = [];
  for (let i = 0; i <= tub; i++) {
    const t = i / tub, P = curve.getPointAt(t), N = frames.normals[i], Bn = frames.binormals[i];
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * Math.PI * 2, r = Math.max(1e-4, rFn(t, a));
      pos.push(P.x + r * (Math.cos(a) * N.x + Math.sin(a) * Bn.x), P.y + r * (Math.cos(a) * N.y + Math.sin(a) * Bn.y), P.z + r * (Math.cos(a) * N.z + Math.sin(a) * Bn.z));
    }
  }
  for (let i = 0; i < tub; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = (i + 1) * rad + j, c = (i + 1) * rad + (j + 1) % rad, d = i * rad + (j + 1) % rad;
    idx.push(a, b, d, b, c, d);
  }
  // face outward: compare one triangle's normal with the direction away from the spine
  const mid = Math.floor(tub / 2) * rad, P = curve.getPointAt(Math.floor(tub / 2) / tub);
  const va = new V3().fromArray(pos, mid * 3), vb = new V3().fromArray(pos, (mid + rad) * 3), vd = new V3().fromArray(pos, (mid + 1) * 3);
  const fn = vb.clone().sub(va).cross(vd.clone().sub(va));
  if (fn.dot(va.clone().sub(P)) < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A flat organic piece (steak, chop, slice, tortilla) lying in the xz plane:
// sx/sz half-sizes, t thickness, R(angle) outline wobble, dome = top rise.
// Top and bottom have inner rings so they can carry color patterns.
function slab(sx, sz, t, R = () => 1, dome = 0, seg = 40, rings = 8) {
  seg = q(seg, 4); rings = q(rings, 1);
  const top = new THREE.RingGeometry(1e-4, 1, seg, rings).rotateX(-Math.PI / 2);
  const bot = new THREE.RingGeometry(1e-4, 1, seg, rings).rotateX(Math.PI / 2);
  const side = new THREE.CylinderGeometry(1, 1, t, seg, 3, true);
  const flat = (g, y0, sgn) => warp(g, (v) => {
    const rr = Math.hypot(v.x, v.z), a = Math.atan2(v.z, v.x), k = R(a) * rr;
    v.set(Math.cos(a) * k * sx, y0 + sgn * dome * (1 - rr * rr), Math.sin(a) * k * sz);
  });
  flat(top, t / 2, 1);
  flat(bot, -t / 2, 0);
  warp(side, (v) => {
    const a = Math.atan2(v.z, v.x), bulge = 1 + 0.05 * Math.cos((v.y / t) * Math.PI);
    v.set(Math.cos(a) * R(a) * sx * bulge, v.y, Math.sin(a) * R(a) * sz * bulge);
  });
  for (const g of [top, bot, side]) { g.deleteAttribute('uv'); g.deleteAttribute('normal'); g.computeVertexNormals(); }
  return mergeGeometries([top, bot, side], false);
}
// Normalized "how far out from the center" (0 center .. 1 rim) for a slab point.
const slabR = (v, sx, sz, R) => { const a = Math.atan2(v.z / sz, v.x / sx); return Math.hypot(v.x / sx, v.z / sz) / R(a); };

// A small pointed leaf, lying along +x from the origin, drooping a little.
function leaf(len, wid, droop = 0.25) {
  return warp(sphere(1, 12, 6).scale(0.5, 0.06, 0.5), (v) => {
    const x = v.x + 0.5;                    // 0..1 along the leaf
    v.z *= Math.sin(Math.PI * Math.pow(clamp01(x), 0.8)) * 1.2;
    v.set(x * len, v.y * wid - droop * x * x * len, v.z * wid);
  });
}

// Superellipsoid from a sphere: e < 1 squares off that axis. Separate
// exponents for top and bottom so loaves and buns can sit flat.
function blob(w, h, d, ex, ez, eTop, eBot, ws = 32, hs = 24) {
  const p = (n, e) => Math.sign(n) * Math.pow(Math.abs(n), e);
  return warp(sphere(1, ws, hs), (v) => {
    v.set(p(v.x, ex) * w / 2, p(v.y, v.y > 0 ? eTop : eBot) * h / 2, p(v.z, ez) * d / 2);
  });
}

// Puff a box out into a pillow (chip bags, pouches), with a few soft creases.
function pillow(w, h, d, seed = 0) {
  const g = box(w, h, d, 8, 10, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2);
    // puffed in the middle, pinched flat at the sealed top and bottom
    const k = Math.pow(Math.max(0, 1 - x * x), 0.6) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(y), 2.5)), 0.7);
    const crease = (noise(x * 2.5 + seed, y * 2.5, seed) - 0.5) * 0.3;
    pos.setZ(i, pos.getZ(i) * (0.08 + 1.25 * k + crease * k));
  }
  g.computeVertexNormals();
  return g;
}
// Crimped seal strip across the top or bottom of a bag.
function crimp(w, h, d) {
  return warp(box(w, h, d, 24, 1, 1), (v) => { v.z *= 1 + 0.6 * Math.abs(Math.sin((v.x / w) * Math.PI * 12)); });
}

function jitter(g, amt, rand) {
  const pos = g.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, 1 + (rand() - 0.5) * amt);
    const s = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

// A sausage link along x, slightly bent, with rounded pinched ends.
function sausage(len, r, bend = 0.12) {
  const curve = new THREE.QuadraticBezierCurve3(new V3(-len / 2, 0, 0), new V3(0, 0, len * bend), new V3(len / 2, 0, 0));
  return smooth(taperTube(curve, (t) => r * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), 6)), 0.45), 28, 12));
}

// ---------- builders: (w, h, d, color, product, rand) -> parts ----------
const SILVER = C(0xc9ced6);
const B = {
  box: (w, h, d) => [part(rbox(w, h, d), null, true)],

  // ---- produce ----
  apple(w, h, d, c, p, rand) {
    const r = w / 2, red = p.name.startsWith('Red');
    const g = smooth(bumpy(slathe([[0, -0.7], [0.3, -0.82], [0.7, -0.7], [0.95, -0.3], [1, 0.1], [0.9, 0.5], [0.66, 0.8], [0.34, 0.86], [0.14, 0.72], [0, 0.64]], r), 0.025, 3 / r, p.id));
    const dark = red ? C(0x7a0f18) : C(0x5f9a2c), light = red ? C(0xe8b64a) : C(0xd8e07a);
    const parts = [painted(g, (v) => {
      const a = Math.atan2(v.z, v.x), streak = fbm(Math.cos(a) * 3, Math.sin(a) * 3 + v.y / r * 0.6, 7, 3);
      let col = mix(c, dark, (streak - 0.35) * (red ? 1.1 : 0.5));
      col = mix(col, light, smoothstep(-0.3, -0.8, v.y / r) * (red ? 0.35 : 0.3) + (red ? 0 : streak * 0.12));
      return col;
    })];
    const stem = new THREE.QuadraticBezierCurve3(new V3(0, r * 0.62, 0), new V3(0, r * 0.95, 0), new V3(r * 0.12, r * 1.08, 0));
    parts.push(part(taperTube(stem, (t) => r * (0.06 - t * 0.02), 6, 6), C(0x5a3a1a)));
    if (rand() < 0.6) parts.push(part(at(leaf(r * 0.7, r * 0.32, 0.15).rotateY(-0.6), r * 0.08, r * 0.98, 0), C(0x3f8f2f)));
    return parts;
  },
  orange(w, h, d, c, p) {
    const r = w / 2;
    const g = smooth(warp(sphere(r, 32, 24).scale(1, 0.96, 1), (v) => {
      v.multiplyScalar(1 + (noise(v.x * 90, v.y * 90, v.z * 90) - 0.5) * 0.03);
      if (v.y > r * 0.85) v.y -= (v.y - r * 0.85) * 0.8;      // flat navel end
    }));
    return [
      painted(g, (v) => mix(c, C(0xd8650c), fbm(v.x * 30, v.y * 30, v.z * 30) * 0.6 - 0.1)),
      part(at(cyl(r * 0.1, r * 0.13, r * 0.06, 8), 0, -r * 0.94, 0), C(0x6b7a23)),
    ];
  },
  citrus(w, h, d, c, p) {
    const r = w / 2, lime = p.name.startsWith('Lime');
    const tip = lime ? 0.9 : 1.12;
    const g = smooth(warp(slathe([[0, -tip], [0.14, -tip + 0.08], [0.45, -0.82], [0.8, -0.42], [0.88, 0], [0.8, 0.42], [0.45, 0.82], [0.14, tip - 0.08], [0, tip]], r * 0.9, 28, 30),
      (v) => v.multiplyScalar(1 + (noise(v.x * 110, v.y * 110, v.z * 110) - 0.5) * 0.035)).rotateZ(Math.PI / 2));
    return [painted(g, (v) => mix(c, lime ? C(0x2f7a1a) : C(0xe8b820), fbm(v.x * 25, v.y * 25, v.z * 25) - 0.35 + smoothstep(0.75, 1, Math.abs(v.x) / r) * 0.5))];
  },
  tomato(w, h, d, c, p) {
    const r = w / 2;
    const g = smooth(warp(sphere(r, 32, 24), (v) => {
      const yn = v.y / r, a = Math.atan2(v.z, v.x);
      const lobe = 1 + 0.045 * Math.cos(a * 5) * (0.4 + 0.6 * Math.max(0, yn));
      v.x *= lobe; v.z *= lobe;
      v.y *= 0.8;
      if (yn > 0.7) v.y -= (yn - 0.7) * r * 0.45;
    }));
    const parts = [painted(g, (v) => mix(mix(c, C(0x8a1410), fbm(v.x * 20, v.y * 20, v.z * 20) - 0.35), C(0xe08a2a), smoothstep(0.45, 0.75, v.y / r) * 0.35))];
    for (let i = 0; i < 5; i++) parts.push(part(at(leaf(r * 0.48, r * 0.22, 0.4).rotateY((i / 5) * Math.PI * 2), 0, r * 0.68, 0), C(0x2f7a2a)));
    parts.push(part(at(cyl(r * 0.05, r * 0.07, r * 0.22, 6), 0, r * 0.76, 0), C(0x3f7a2a)));
    return parts;
  },
  potato(w, h, d, c, p, rand) {
    const r = w / 2;
    const eyes = Array.from({ length: 5 }, () => new V3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
    const g = smooth(warp(bumpy(sphere(1, 28, 20).scale(r, r * 0.66, r * 0.8), 0.14, 1.6 / r, p.id + rand() * 9), (v) => {
      const n = v.clone().normalize();
      for (const e of eyes) { const k = n.dot(e); if (k > 0.97) v.multiplyScalar(1 - (k - 0.97) * 1.4); }
    }));
    return [painted(g, (v) => {
      const n = v.clone().normalize();
      let col = mix(c, C(0x6a4a2a), fbm(v.x * 40, v.y * 40, v.z * 40) - 0.3);
      if (noise(v.x * 160, v.y * 160, v.z * 160) > 0.72) col = mix(col, C(0x4a3018), 0.6);
      for (const e of eyes) if (n.dot(e) > 0.985) col = C(0x4a3018);
      return col;
    })];
  },
  onion(w, h, d, c) {
    const r = w / 2;
    const g = smooth(slathe([[0, -0.8], [0.3, -0.86], [0.66, -0.7], [0.94, -0.3], [0.98, 0.05], [0.84, 0.45], [0.52, 0.76], [0.22, 0.95], [0.09, 1.12], [0.05, 1.28], [0, 1.32]], r * 0.94, 28, 32));
    const parts = [painted(g, (v) => {
      const a = Math.atan2(v.z, v.x);
      const stripe = 0.5 + 0.5 * Math.sin(a * 18 + noise(v.x * 30, v.y * 12, v.z * 30) * 6);
      const skin = mix(c, C(0xb8783a), 0.65);
      let col = mix(shade(skin, -0.1), shade(skin, 0.08), stripe);
      col = mix(col, C(0x7a4a1a), smoothstep(0.8, 1.15, v.y / r));
      return mix(col, C(0xe8d8b0), smoothstep(-0.6, -0.8, v.y / r) * 0.6);
    })];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const root = new THREE.QuadraticBezierCurve3(new V3(0, -r * 0.78, 0), new V3(Math.cos(a) * r * 0.1, -r * 0.92, Math.sin(a) * r * 0.1), new V3(Math.cos(a) * r * 0.22, -r * 0.88, Math.sin(a) * r * 0.22));
      parts.push(part(taperTube(root, (t) => r * 0.025 * (1 - t * 0.6), 4, 4), C(0xd8c49a)));
    }
    return parts;
  },
  avocado(w, h, d, c, p) {
    const r = w / 2;
    const g = smooth(warp(slathe([[0, -0.95], [0.45, -0.9], [0.86, -0.55], [0.95, -0.1], [0.8, 0.35], [0.56, 0.7], [0.38, 0.95], [0.16, 1.07], [0, 1.1]], r, 28, 30),
      (v) => v.multiplyScalar(1 + (noise(v.x * 70, v.y * 70, v.z * 70) - 0.5) * 0.08)));
    return [painted(g, (v) => mix(c, C(0x14200c), noise(v.x * 50, v.y * 50, v.z * 50) * 1.1 - 0.2)),
      part(at(cyl(r * 0.05, r * 0.08, r * 0.12, 6), 0, r * 1.12, 0), C(0x5a3a1a))];
  },
  peach(w, h, d, c, p) {
    const r = w / 2;
    const g = smooth(warp(sphere(r, 32, 24), (v) => {
      // the seam line down one side, and a dip where the stem was
      const crease = 0.06 * Math.exp(-Math.pow(v.x / r, 2) * 60) * smoothstep(0, 0.5, v.z / r);
      const top = 0.1 * smoothstep(0.75, 1, v.y / r);
      v.multiplyScalar(1 - crease - top);
    }));
    return [painted(g, (v) => mix(c, C(0xd23a2a), smoothstep(-0.2, 0.8, v.x / r + (fbm(v.x * 18, v.y * 18, v.z * 18) - 0.5) * 1.6) * 0.85))];
  },
  melon(w, h, d, c, p) {
    const r = w / 2;
    const net = (v) => 1 - Math.abs(noise(v.x * 55, v.y * 55, v.z * 55) * 2 - 1);
    const g = smooth(warp(sphere(r, 44, 32).scale(1, 0.94, 1), (v) => {
      const a = Math.atan2(v.z, v.x);
      v.multiplyScalar(1 + 0.015 * Math.cos(a * 10) + 0.012 * smoothstep(0.7, 0.95, net(v)));
    }));
    return [painted(g, (v) => {
      const a = Math.atan2(v.z, v.x);
      const col = mix(C(0xa8a070), C(0x8a8a58), 0.5 + 0.5 * Math.cos(a * 10));
      return mix(col, C(0xd8cca0), smoothstep(0.7, 0.95, net(v)) * 0.5);
    }), part(at(cyl(r * 0.06, r * 0.1, r * 0.1, 8), 0, r * 0.95, 0), C(0x8a7a4a))];
  },
  banana(w, h, d, c) {
    const parts = [];
    const crown = new V3(-w * 0.44, h * 0.18, 0);
    const R = h * 0.21, green = C(0x9bb84a), brown = C(0x4a3418);
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * d * 0.21;
      const curve = new THREE.CubicBezierCurve3(crown.clone().setZ(z * 0.3),
        new V3(-w * 0.18, -h * 0.4, z), new V3(w * 0.22, -h * 0.38, z * 1.1), new V3(w * 0.46, h * 0.18, z * 1.15));
      const finger = smooth(taperTube(curve, (t, a) => {
        const prof = Math.min(1, 0.35 + t * 4) * (t > 0.82 ? Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.82) / 0.18, 2))) * 0.8 + 0.2 : 1);
        return R * prof * (1 + 0.08 * Math.cos(a * 5));
      }, 24, 10));
      parts.push(painted(finger, (v) => {
        const t = (v.x - crown.x) / (w * 0.9);
        let col = mix(c, green, smoothstep(0.3, 0.02, t));
        col = mix(col, brown, smoothstep(0.93, 0.99, t));
        if (noise(v.x * 200, v.y * 200, v.z * 200) > 0.8) col = mix(col, brown, 0.5);
        return col;
      }));
      parts.push(part(at(sphere(R * 0.22, 6, 4), w * 0.46, h * 0.18, z * 1.15), brown));
    }
    const stem = new THREE.QuadraticBezierCurve3(crown.clone(), new V3(-w * 0.49, h * 0.3, 0), new V3(-w * 0.47, h * 0.44, 0));
    parts.push(part(taperTube(stem, () => R * 0.5, 6, 8), C(0x6b6a2a)));
    return parts;
  },

  // ---- jugs, cartons, bags ----
  eggs(w, h, d) {
    // closed pulp egg carton: a row of cups underneath, labeled lid on top
    const pulp = C(0xc4bba8);
    const speck = (v) => mix(pulp, shade(pulp, -0.12), noise(v.x * 300, v.y * 300, v.z * 300));
    const parts = [
      part(at(rbox(w, h * 0.4, d, 0.2), 0, h * 0.3, 0), null, true),
      painted(at(rbox(w * 1.01, h * 0.07, d * 1.03, 0.3), 0, h * 0.07, 0), speck),
    ];
    const cr = Math.min(w / 12, d / 4) * 1.02;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      const cup = slathe([[0, 0], [0.62, 0.03], [0.92, 0.35], [1, 0.75], [1, 1]], 1, 16, 10).scale(cr, h * 0.6, cr);
      parts.push(painted(at(cup, (i - 2.5) * w / 6, -h / 2, (j - 0.5) * d / 2), speck));
    }
    return parts;
  },
  jug(w, h, d, c, p) {
    const milk = p.name.includes('Milk');
    const body = milk ? C(0xf4f4f0) : shade(c, 0.05);
    const sq = (a, k) => k / Math.pow(Math.pow(Math.abs(Math.cos(a)), 6) + Math.pow(Math.abs(Math.sin(a)), 6), 1 / 6);
    const hw = w * 0.47, bh = h * 0.6, neck = w * 0.15;
    const yb = -h / 2;
    // rounded-square column for the body, lofting into a round neck at the shoulder
    const column = (g, y0, y1, r0, r1) => warp(g, (v) => {
      const a = Math.atan2(v.z, v.x), t = (v.y + 0.5);
      const e = t * t * (3 - 2 * t);
      const k = r0(a) + (r1(a) - r0(a)) * e;
      const rr = Math.hypot(v.x, v.z) > 1e-6 ? 1 : 0;
      v.set(Math.cos(a) * k * rr, y0 + (y1 - y0) * t, Math.sin(a) * k * rr);
    });
    const bodyG = column(new THREE.CylinderGeometry(1, 1, 1, 48, 6), yb, yb + bh, (a) => sq(a, hw), (a) => sq(a, hw));
    const label = column(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true, Math.PI), yb + bh * 0.25, yb + bh * 0.85, (a) => sq(a, hw * 1.012), (a) => sq(a, hw * 1.012));
    const shoulder = column(new THREE.CylinderGeometry(1, 1, 1, 48, 6, true), yb + bh, yb + h * 0.86, (a) => sq(a, hw), () => neck);
    const handle = new THREE.CatmullRomCurve3([new V3(hw * 0.35, yb + h * 0.84, -hw * 0.35), new V3(hw * 0.75, yb + h * 0.8, -hw * 0.75), new V3(hw * 0.95, yb + h * 0.6, -hw * 0.95), new V3(hw * 0.9, yb + bh * 0.95, -hw * 0.9)]);
    return [
      part(bodyG, body),
      part(label, null, true),
      part(shoulder, body),
      part(taperTube(handle, () => w * 0.075, 16, 10), body),
      part(at(cyl(neck, neck, h * 0.04, 20), 0, yb + h * 0.88, 0), body),
      part(at(ribbedCap(neck * 1.1, h * 0.08, 16), 0, yb + h * 0.94, 0), milk ? c : shade(c, -0.15)),
    ];
  },
  carton(w, h, d, c) {
    const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h * 0.17)]);
    const roof = new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, h * 0.28, 0);
    return [
      part(at(rbox(w, h * 0.78, d, 0.04), 0, -h * 0.11, 0), null, true),
      part(roof, shade(c, -0.08)),
      part(at(box(w, h * 0.06, d * 0.06), 0, h * 0.47, 0), shade(c, -0.1)),
      part(at(cyl(w * 0.12, w * 0.12, d * 0.08, 14).rotateX(Math.PI / 2).rotateX(-0.85), w * 0.18, h * 0.39, d * 0.2), C(0xf4f4f4)),
    ];
  },
  pillow: (w, h, d, c, p) => [
    part(pillow(w, h * 0.88, d, p.id), null, true),
    part(at(crimp(w, h * 0.06, d * 0.14), 0, h * 0.47, 0), shade(c, -0.1)),
    part(at(crimp(w, h * 0.06, d * 0.14), 0, -h * 0.47, 0), shade(c, -0.1)),
  ],
  paperBag: (w, h, d, c) => [part(at(rbox(w, h * 0.86, d, 0.1), 0, -h * 0.07, 0), null, true),
    part(at(warp(box(w * 0.98, h * 0.14, d * 0.4, 8, 2, 1), (v) => { v.z *= 1 - (v.y / (h * 0.14) + 0.5) * 0.6; }), 0, h * 0.43, 0), shade(c, -0.1))],

  // ---- cans, jars, bottles ----
  can(w, h, d, c) {
    const r = w / 2;
    return [
      part(sleeve(r, h * 0.88), null, true),
      part(at(torus(r * 0.97, h * 0.025, 6, 28).rotateX(Math.PI / 2), 0, h * 0.465, 0), SILVER),
      part(at(cyl(r * 0.92, r * 0.92, h * 0.03, 28), 0, h * 0.455, 0), shade(SILVER, -0.06)),
      part(at(torus(r * 0.97, h * 0.025, 6, 28).rotateX(Math.PI / 2), 0, -h * 0.465, 0), SILVER),
      part(at(cyl(r * 0.92, r * 0.92, h * 0.03, 28), 0, -h * 0.455, 0), shade(SILVER, -0.06)),
    ];
  },
  canLid(w, h, d, c) {
    const r = w / 2;
    return [part(at(sleeve(r, h * 0.84), 0, -h * 0.06, 0), null, true),
      part(at(torus(r * 0.97, h * 0.02, 6, 28).rotateX(Math.PI / 2), 0, -h * 0.48, 0), SILVER),
      part(at(cyl(r * 0.93, r * 0.93, h * 0.02, 28), 0, -h * 0.48, 0), shade(SILVER, -0.06)),
      part(at(ribbedCap(r * 1.01, h * 0.12, 30), 0, h * 0.42, 0), shade(c, -0.15))];
  },
  jar(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    const glass = shade(c, -0.12);
    return [
      part(at(slathe([[0, 0], [0.88, 0], [1, 0.05], [1, 0.72], [0.94, 0.8], [0.86, 0.84]], 1, 28, 24).scale(r, h, r), 0, y0, 0), glass),
      part(at(sleeve(r * 1.01, h * 0.46), 0, y0 + h * 0.4, 0), null, true),
      part(at(ribbedCap(r * 0.9, h * 0.15, 30), 0, h / 2 - h * 0.075, 0), C(0xd4a017)),
    ];
  },
  spice(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    return [
      part(at(lathe([[0, 0], [r * 0.95, 0], [r, h * 0.03], [r, h * 0.78]], 24), 0, y0, 0), shade(c, -0.1)),
      part(at(sleeve(r * 1.02, h * 0.45), 0, y0 + h * 0.4, 0), null, true),
      part(at(ribbedCap(r * 1.02, h * 0.22, 20), 0, h / 2 - h * 0.11, 0), C(0xc0392b)),
    ];
  },
  bottle(w, h, d, c, p) {
    const r = w / 2, y0 = -h / 2;
    const glass = shade(c, -0.05);
    return [
      part(at(slathe([[0, 0], [0.9, 0], [1, 0.04], [1, 0.58], [0.88, 0.68], [0.5, 0.8], [0.4, 0.86], [0.4, 0.88]], 1, 28, 30).scale(r, h, r), 0, y0, 0), glass),
      part(at(sleeve(r * 1.01, h * 0.34), 0, y0 + h * 0.34, 0), null, true),
      part(at(ribbedCap(r * 0.44, h * 0.12, 18), 0, h / 2 - h * 0.06, 0), p.section.name === 'Drinks' ? C(0xf4f4f4) : shade(c, -0.2)),
    ];
  },
  soda(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    const plastic = shade(c, -0.05);
    // the 5-footed bottom of a soda bottle
    const g = warp(slathe([[0, 0.02], [0.6, 0], [0.95, 0.05], [1, 0.12], [1, 0.6], [0.86, 0.7], [0.5, 0.82], [0.33, 0.88], [0.33, 0.9]], 1, 28, 32).scale(r, h, r), (v) => {
      if (v.y < h * 0.1) { const a = Math.atan2(v.z, v.x); const k = 1 - 0.12 * (1 - v.y / (h * 0.1)) * (0.5 + 0.5 * Math.cos(a * 5)); v.x *= k; v.z *= k; }
    });
    return [
      part(at(g, 0, y0, 0), plastic),
      part(at(sleeve(r * 1.01, h * 0.22), 0, y0 + h * 0.36, 0), null, true),
      part(at(ribbedCap(r * 0.36, h * 0.09, 18), 0, h / 2 - h * 0.05, 0), C(0xd8d8d8)),
    ];
  },
  flatBottle(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    const k = d / w;
    return [
      part(at(slathe([[0, 0], [0.9, 0], [1, 0.07], [1, 0.68], [0.8, 0.78], [0.58, 0.82]], 1, 28, 24).scale(r, h, r * k), 0, y0, 0), shade(c, 0.05)),
      part(at(sleeve(r * 1.01, h * 0.4).scale(1, 1, k), 0, y0 + h * 0.38, 0), null, true),
      part(at(cyl(r * 0.5, r * 0.6, h * 0.18, 20).scale(1, 1, k * 1.4), 0, h / 2 - h * 0.09, 0), shade(c, -0.25)),
    ];
  },
  tub(w, h, d, c) {
    const r = w / 2;
    return [
      part(new THREE.CylinderGeometry(r * 0.98, r * 0.8, h * 0.88, 28, 1, true, Math.PI).translate(0, -h * 0.06, 0), null, true),
      part(at(cyl(r * 0.8, r * 0.8, h * 0.02, 28), 0, -h * 0.49, 0), shade(c, -0.1)),
      part(at(torus(r * 0.98, h * 0.03, 6, 28).rotateX(Math.PI / 2), 0, h * 0.38, 0), shade(c, 0.1)),
      part(at(cyl(r * 1.02, r * 1.02, h * 0.08, 28), 0, h * 0.45, 0), shade(c, 0.1)),
    ];
  },
  water6(w, h, d) {
    const parts = [];
    const r = Math.min(w / 6, d / 4) * 0.95;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x = (i - 1) * w / 3, z = (j - 0.5) * d / 2;
      parts.push(part(at(slathe([[0, 0], [0.92, 0], [1, 0.05], [1, 0.62], [0.8, 0.74], [0.42, 0.86], [0.4, 0.94]], 1, 16, 20).scale(r, h, r), x, -h / 2, z), C(0xb8dcf2)));
      parts.push(part(at(sleeve(r * 1.01, h * 0.16, 16), x, -h * 0.1, z), C(0x2a6ae8)));
      parts.push(part(at(cyl(r * 0.42, r * 0.42, h * 0.06, 12), x, h / 2 - h * 0.03, z), C(0x2a6ae8)));
    }
    return parts;
  },
  roll(w, h, d, c) {
    const r = w / 2;
    return [
      part(cyl(r, r, h * 0.98, 28), C(0xf8f8f4)),
      part(sleeve(r * 1.02, h * 0.5), null, true),
      part(at(cyl(r * 0.3, r * 0.3, h * 0.01, 16), 0, h * 0.495, 0), C(0x8a6a4a)),
    ];
  },
  cups(w, h, d) {
    const r = w / 2;
    return [part(new THREE.CylinderGeometry(r, r * 0.75, h, 24, 1, false, Math.PI), C(0xf2eedd)),
      part(at(torus(r, h * 0.02, 5, 24).rotateX(Math.PI / 2), 0, h / 2, 0), C(0xf2eedd)),
      part(sleeve(r * 0.95, h * 0.4).translate(0, -h * 0.1, 0), null, true)];
  },
  tp(w, h, d) {
    const parts = [];
    const r = Math.min(w / 6, d / 4);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      parts.push(part(at(cyl(r * 0.97, r * 0.97, h / 2 * 0.98, 16), (i - 1) * w / 3, (k - 0.5) * h / 2, (j - 0.5) * d / 2), C(0xfbfbf8)));
    }
    parts.push(part(at(rbox(w * 1.01, h * 0.28, d * 1.01, 0.05), 0, 0, 0), null, true));
    return parts;
  },
  plates: (w, h, d) => [part(cyl(w / 2, w / 2, h, 32), C(0xf6f6f0)), part(sleeve(w / 2 * 1.02, h * 0.5, 32), null, true)],

  // ---- packages with a real shape ----
  spray(w, h, d, c) {
    const r = w / 2, y0 = -h / 2, white = C(0xf4f4f4);
    return [
      part(at(slathe([[0, 0], [0.9, 0], [1, 0.05], [1, 0.5], [0.6, 0.6], [0.32, 0.66], [0.3, 0.7]], 1, 28, 26).scale(r, h, r), 0, y0, 0), shade(c, 0.05)),
      part(at(sleeve(r * 1.01, h * 0.32), 0, y0 + h * 0.3, 0), null, true),
      part(at(ribbedCap(r * 0.32, h * 0.1, 14), 0, y0 + h * 0.74, 0), white),
      part(at(rbox(r * 0.7, h * 0.12, r * 1.5, 0.2), 0, y0 + h * 0.86, r * 0.2), white),
      part(at(rbox(r * 0.25, h * 0.14, r * 0.2, 0.2).rotateX(0.25), 0, y0 + h * 0.73, r * 0.6), C(0xd8d8d8)),
      part(at(cyl(r * 0.12, r * 0.12, r * 0.25, 10).rotateX(Math.PI / 2), 0, y0 + h * 0.88, r * 0.98), shade(c, -0.2)),
    ];
  },
  squeeze(w, h, d, c) {
    const r = w / 2, y0 = -h / 2, white = C(0xf4f4f4);
    return [
      part(at(slathe([[0, 0], [0.85, 0], [1, 0.06], [0.97, 0.6], [0.62, 0.74], [0.5, 0.78]], 1, 28, 24).scale(r, h, r), 0, y0, 0), c),
      part(at(sleeve(r * 1.01, h * 0.34), 0, y0 + h * 0.34, 0), null, true),
      part(at(ribbedCap(r * 0.53, h * 0.06, 16), 0, y0 + h * 0.81, 0), white),
      part(at(cyl(r * 0.08, r * 0.4, h * 0.16, 16), 0, y0 + h * 0.92, 0), white),
    ];
  },
  pump(w, h, d, c) {
    const r = w / 2, y0 = -h / 2, white = C(0xf4f4f4);
    return [
      part(at(slathe([[0, 0], [0.92, 0], [1, 0.05], [1, 0.58], [0.8, 0.68], [0.3, 0.72]], 1, 28, 24).scale(r, h, r), 0, y0, 0), shade(c, 0.03)),
      part(at(sleeve(r * 1.01, h * 0.36), 0, y0 + h * 0.32, 0), null, true),
      part(at(ribbedCap(r * 0.34, h * 0.07, 14), 0, y0 + h * 0.75, 0), white),
      part(at(cyl(r * 0.1, r * 0.1, h * 0.14, 10), 0, y0 + h * 0.85, 0), white),
      part(at(rbox(r * 0.4, h * 0.05, r * 1.3, 0.3), 0, y0 + h * 0.95, r * 0.35), white),
    ];
  },
  syrup(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    return [
      part(at(slathe([[0, 0], [0.9, 0], [1, 0.05], [1, 0.5], [0.55, 0.68], [0.4, 0.86]], 1, 28, 24).scale(r, h, r), 0, y0, 0), c),
      part(at(sleeve(r * 1.01, h * 0.32), 0, y0 + h * 0.3, 0), null, true),
      part(at(torus(r * 0.3, r * 0.09, 8, 16).rotateY(Math.PI / 2), -r * 0.62, y0 + h * 0.72, 0), c),
      part(at(ribbedCap(r * 0.45, h * 0.12, 18), 0, h / 2 - h * 0.06, 0), C(0xd4a017)),
    ];
  },
  pillBottle(w, h, d, c) {
    const r = w / 2;
    return [
      part(at(cyl(r * 0.92, r * 0.92, h * 0.74, 24), 0, -h * 0.13, 0), C(0xe8842a)),
      part(at(sleeve(r * 0.95, h * 0.5), 0, -h * 0.15, 0), null, true),
      part(at(ribbedCap(r, h * 0.26, 24), 0, h * 0.37, 0), C(0xf6f6f6)),
    ];
  },
  deodorant(w, h, d, c) {
    const r = w / 2, k = 0.7;
    return [
      part(at(cyl(r, r, h * 0.6, 24).scale(1, 1, k), 0, -h * 0.12, 0), c),
      part(at(sleeve(r * 1.02, h * 0.36).scale(1, 1, k), 0, -h * 0.1, 0), null, true),
      part(at(cyl(r, r, h * 0.08, 24).scale(1, 1, k), 0, -h * 0.46, 0), shade(c, -0.12)),
      part(at(sphere(r, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, (h * 0.32) / r, k), 0, h * 0.18, 0), C(0xe8eef8)),
    ];
  },
  sodaCan(w, h, d) {
    const r = w / 2;
    return [
      part(sleeve(r, h * 0.8), null, true),
      part(at(cyl(r * 0.8, r, h * 0.08, 28), 0, h * 0.44, 0), SILVER),
      part(at(torus(r * 0.8, h * 0.012, 5, 28).rotateX(Math.PI / 2), 0, h * 0.485, 0), SILVER),
      part(at(cyl(r * 0.78, r * 0.78, h * 0.02, 28), 0, h * 0.475, 0), shade(SILVER, -0.1)),
      part(at(cyl(r, r * 0.82, h * 0.1, 28), 0, -h * 0.45, 0), SILVER),
      part(at(rbox(r * 0.3, h * 0.012, r * 0.6, 0.3), 0, h * 0.49, r * 0.2), shade(SILVER, -0.25)),
    ];
  },

  // ---- things sold without a box ----
  sponge(w, h, d, c, p) {
    const soft = smooth(warp(rbox(w, h, d * 0.68, 0.15), (v) => v.multiplyScalar(1 + (noise(v.x * 220, v.y * 220, v.z * 220) - 0.5) * 0.03)));
    return [
      painted(at(soft, 0, 0, -d * 0.16), (v) => mix(C(0xf2d21a), C(0xc8a010), noise(v.x * 300, v.y * 300, v.z * 300) * 0.8)),
      part(at(rbox(w, h, d * 0.3, 0.1), 0, 0, d * 0.35), C(0x3a9a4a)),
    ];
  },
  brush(w, h, d) {
    const parts = [part(at(rbox(w * 0.9, h * 0.96, d * 0.38, 0.25), 0, 0, -d * 0.31), C(0xc8863a))];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      parts.push(part(at(cyl(w * 0.06, w * 0.07, d * 0.6, 6).rotateX(Math.PI / 2), (i - 1.5) * w * 0.2, (j - 2.5) * h * 0.145, d * 0.18), C(0xf4f4f0)));
    }
    return parts;
  },
  bone(w, h, d) {
    const cream = C(0xf0e2c2), k = Math.min(w * 0.24, d * 0.5);
    const parts = [part(cyl(k * 0.62, k * 0.62, h * 0.72, 16), cream)];
    for (const sy of [-1, 1]) for (const sx of [-1, 1]) parts.push(part(at(sphere(k, 16, 12), sx * k * 0.75, sy * (h / 2 - k), 0), cream));
    // rawhide knot wraps
    for (const y of [-0.12, 0.12]) parts.push(part(at(torus(k * 0.66, k * 0.14, 6, 16).rotateX(Math.PI / 2), 0, y * h, 0), C(0xd8c098)));
    return parts;
  },
  ringToy(w, h, d, c) {
    const tube = d * 0.45, R0 = w / 2 - tube;
    const parts = [part(torus(R0, tube, 12, 28), c)];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      parts.push(part(at(sphere(tube * 0.42, 8, 6), Math.cos(a) * (R0 + tube * 0.75), Math.sin(a) * (R0 + tube * 0.75), 0), shade(c, -0.15)));
    }
    return parts;
  },

  // ---- bakery: just the food, no packaging ----
  loaf(w, h, d, c, p) {
    const g = smooth(warp(blob(w, h, d * 0.97, 0.45, 0.32, 0.75, 0.22), (v) => {
      if (v.y > 0) v.y *= 1 + (noise(v.x * 30, v.y * 30, v.z * 30) - 0.5) * 0.12;
    }));
    const top = shade(c, -0.08), side = shade(c, 0.1), base = mix(c, C(0xe8cfa0), 0.6);
    const parts = [painted(g, (v, n) => {
      let col = n.y > 0 ? mix(side, top, smoothstep(0.1, 0.8, n.y)) : mix(side, base, smoothstep(-0.2, -0.8, n.y));
      return mix(col, C(0x5a3010), (fbm(v.x * 25, v.y * 25, v.z * 25) - 0.5) * 0.6 * Math.max(0, n.y));
    })];
    return parts;
  },
  buns(w, h, d, c, p) {
    const bagel = p.name.includes('Bagel');
    const bun = bagel ? C(0xc8905a) : C(0xd9a35a);
    const parts = [];
    const r = Math.min(w / 4, d / 6) * 0.98;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const x = (i - 0.5) * w / 2, z = (j - 1) * d / 3;
      const g = bagel
        ? smooth(torus(r * 0.64, r * 0.34, 14, 28).rotateX(Math.PI / 2).scale(1, (h * 0.45) / (r * 0.68), 1))
        : smooth(blob(r * 2, h, r * 2, 0.8, 0.8, 0.85, 0.25, 24, 16));
      parts.push(painted(at(g, x, bagel ? -h * 0.22 : 0, z), (v, n) =>
        mix(mix(shade(bun, 0.14), shade(bun, -0.1), smoothstep(-0.1, 0.8, n.y)), C(0x6a3a10), (noise(v.x * 60, v.y * 60, v.z * 60) - 0.5) * 0.4 * Math.max(0, n.y))));
    }
    return parts;
  },
  croissant(w, h, d) {
    const curve = new THREE.QuadraticBezierCurve3(new V3(-w * 0.46, 0, -d * 0.25), new V3(0, 0, d * 0.62), new V3(w * 0.46, 0, -d * 0.25));
    const ridges = 5;
    const g = smooth(taperTube(curve, (t) => {
      const body = Math.pow(Math.sin(Math.PI * t), 0.7);
      const seg = 0.8 + 0.2 * Math.abs(Math.cos(t * Math.PI * ridges));
      return h * 0.5 * Math.max(0.12, body) * seg;
    }, 48, 14).scale(1, 0.75, 1));
    const gold = C(0xd8953a), deep = C(0x8a4a14), pale = C(0xf0c87a);
    return [painted(at(g, 0, -h * 0.05, -d * 0.05), (v, n) => {
      const t = clamp01(v.x / w + 0.5);
      const groove = 1 - Math.abs(Math.cos(t * Math.PI * ridges));
      return mix(mix(pale, gold, smoothstep(-0.3, 0.6, n.y)), deep, groove * 0.5 + Math.max(0, n.y) * 0.25);
    })];
  },
  muffin(w, h, d) {
    const parts = [];
    const r = Math.min(w, d) / 4 * 0.95;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = (i - 0.5) * w / 2, z = (j - 0.5) * d / 2;
      // pleated paper cup
      const cup = warp(new THREE.CylinderGeometry(r, r * 0.78, h * 0.5, 88, 1), (v) => {
        const k = Math.hypot(v.x, v.z);
        if (k > 1e-6) { const s = 1 + 0.04 * Math.cos(Math.atan2(v.z, v.x) * 22); v.x *= s; v.z *= s; }
      });
      cup.computeVertexNormals();
      parts.push(part(at(cup, x, -h * 0.25, z), C(0xe8dcc0)));
      const top = smooth(bumpy(sphere(r * 1.18, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, (h * 0.5) / (r * 1.18), 1), 0.08, 14 / r, i * 3 + j));
      parts.push(painted(at(top, x, 0, z), (v, n) => mix(C(0xc89048), C(0x7a4a1a), smoothstep(0.2, 0.9, n.y) * 0.7 + (noise(v.x * 90, v.y * 90, v.z * 90) - 0.5) * 0.5)));
      for (let b = 0; b < 5; b++) {
        const a = b * 1.3 + i + j, rr = r * (0.25 + 0.15 * (b % 3));
        const by = Math.sqrt(Math.max(0, 1 - Math.pow(rr / (r * 1.18), 2))) * h * 0.5 * 0.92;
        parts.push(part(at(sphere(r * 0.13, 8, 6), x + Math.cos(a) * rr, by, z + Math.sin(a) * rr), C(0x2a1a4a)));
      }
    }
    return parts;
  },
  chicken(w, h, d) {
    const gold = C(0xb8742a), dark = C(0x6a3810), pale = C(0xd8a060);
    const roast = (v, n) => mix(mix(pale, gold, smoothstep(-0.6, 0.3, n.y)), dark, fbm(v.x * 22, v.y * 22, v.z * 22) * 1.1 - 0.35);
    const body = smooth(warp(bumpy(sphere(1, 32, 24).scale(w * 0.36, h * 0.44, d * 0.42), 0.04, 9 / w, 3), (v) => {
      if (v.y < -h * 0.3) v.y = -h * 0.3 - (v.y + h * 0.3) * 0.3;     // sits flat
      v.y += h * 0.06 * Math.exp(-Math.pow(v.x / (w * 0.12), 2)) * Math.max(0, v.y / (h * 0.44)); // breast ridge
    }));
    const parts = [painted(at(body, 0, 0, -d * 0.04), roast)];
    for (const s of [-1, 1]) {
      const leg = new THREE.CatmullRomCurve3([new V3(s * w * 0.18, -h * 0.05, d * 0.1), new V3(s * w * 0.22, -h * 0.1, d * 0.3), new V3(s * w * 0.16, -h * 0.18, d * 0.46)]);
      parts.push(painted(smooth(taperTube(leg, (t) => w * (0.11 - t * 0.065 + (t > 0.85 ? (t - 0.85) * 0.25 : 0)), 16, 12)), roast));
      parts.push(part(at(sphere(w * 0.028, 8, 6), s * w * 0.16, -h * 0.18, d * 0.48), C(0xf0e0c0)));
      parts.push(painted(at(smooth(bumpy(sphere(1, 16, 12).scale(w * 0.07, h * 0.16, d * 0.2), 0.06, 30 / w, s)).rotateZ(s * 0.3), s * w * 0.35, 0, -d * 0.02), roast));
    }
    return parts;
  },

  // ---- deli and cheese ----
  deli(w, h, d, c, p) {
    // a shingled fan of thin round slices
    const parts = [];
    const r = Math.min(w, d) / 2 * 0.82, n = 5, th = h / n * 0.6;
    const salami = p.name.includes('Salami'), beef = p.name.includes('Beef'), ham = p.name.includes('Ham');
    for (let i = 0; i < n; i++) {
      const R = (a) => 1 + 0.025 * Math.sin(a * 3 + i);
      const g = warp(slab(r, r, th, R, 0, 28, 4), (v) => { v.y += Math.sin(v.x / r * 2.5 + i) * th * 0.6; });
      const off = (i - (n - 1) / 2) * (w - 2 * r) / (n - 1);
      parts.push(painted(at(g.rotateY(i * 0.4), off, -h / 2 + th / 2 + i * (h - th) / n, 0), (v) => {
        const rr = Math.hypot(v.x - off, v.z) / r;
        if (salami) return noise(v.x * 400, v.z * 400, i) > 0.68 ? C(0xf0d8d0) : mix(c, C(0x5a1418), noise(v.x * 120, v.z * 120, i) * 0.6);
        if (beef) return mix(C(0xb84a4a), C(0x5a3020), smoothstep(0.75, 0.95, rr));
        if (ham) return mix(c, C(0xf8d8d0), smoothstep(0.8, 0.96, rr) * 0.7);
        return mix(c, shade(c, -0.08), noise(v.x * 80, v.z * 80, i));
      }));
    }
    return parts;
  },
  cheese(w, h, d, c, p) {
    const parts = [];
    const n = 5, swiss = p.name.includes('Swiss');
    for (let i = 0; i < n; i++) parts.push(part(at(rbox(w * 0.94, h / n * 0.9, d * 0.94, 0.15).rotateY((i - 2) * 0.06), 0, -h / 2 + (i + 0.5) * h / n, 0), i % 2 ? shade(c, -0.04) : c));
    const ty = h / 2 - h / n * 0.05;
    for (let k = 0; k < (swiss ? 7 : 22); k++) {
      const x = (hash(k, 1, 2) - 0.5) * w * 0.8, z = (hash(k, 3, 4) - 0.5) * d * 0.8;
      if (swiss) parts.push(part(at(cyl(w * 0.05 * (0.6 + hash(k, 5, 6)), w * 0.05, h * 0.02, 12), x, ty, z), shade(c, -0.18)));
      else parts.push(part(at(sphere(w * 0.012, 5, 4).scale(1, 0.4, 1), x, ty, z), k % 2 ? C(0xc0392b) : C(0x2f7a2a)));
    }
    return parts;
  },
  tortilla(w, h, d, c, p, rand) {
    const parts = [];
    const n = 5, th = h / n * 0.85;
    for (let i = 0; i < n; i++) {
      const R = (a) => 1 + 0.025 * Math.sin(a * 7 + i * 2) + 0.015 * Math.sin(a * 3 + i);
      const g = warp(slab(w / 2, d / 2, th, R, 0, 36, 4), (v) => { v.y += Math.sin(v.x / w * 9 + i) * th * 0.25; });
      parts.push(painted(at(g, 0, -h / 2 + (i + 0.5) * h / n, 0), (v) => mix(c, C(0x8a5a2a), smoothstep(0.62, 0.8, fbm(v.x * 60, v.z * 60, i)) * 0.8)));
    }
    return parts;
  },

  // ---- meat and fish ----
  meat(w, h, d, c, p, rand, style) {
    const parts = [];
    const fat = C(0xf3e4d2);
    if (style === 'ground') {
      const g = smooth(warp(sphere(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(w * 0.46, h * 0.95, d * 0.44), (v) => {
        v.multiplyScalar(1 + (noise(v.x * 260, v.y * 260, v.z * 260) - 0.5) * 0.07);
      }));
      parts.push(painted(at(g, 0, -h / 2, 0), (v) => {
        const k = noise(v.x * 300, v.y * 300, v.z * 300);
        return mix(mix(c, shade(c, -0.12), k), shade(c, 0.1), fbm(v.x * 40, v.y * 40, v.z * 40) - 0.4);
      }));
      parts.push(part(at(new THREE.CircleGeometry(1, 32).rotateX(Math.PI / 2).scale(w * 0.46, 1, d * 0.44), 0, -h / 2, 0), shade(c, -0.1)));
    } else if (style === 'steak') {
      const R = (a) => 1 + 0.1 * Math.sin(2 * a + 0.6) + 0.05 * Math.sin(3 * a + 1.3) - 0.14 * Math.exp(-Math.pow(a - 1.9, 2) * 5);
      const sx = w * 0.44, sz = d * 0.42;
      parts.push(painted(slab(sx, sz, h * 0.6, R, h * 0.12, 48, 10), (v, n) => {
        const rr = slabR(v, sx, sz, R), a = Math.atan2(v.z / sz, v.x / sx);
        const onCap = a < -0.5 && a > -2.6;
        if (onCap && rr > 0.8) return fat;
        if (Math.abs(n.y) < 0.5) return onCap ? fat : shade(c, -0.1);
        return mix(c, shade(c, -0.1), fbm(v.x * 30, v.z * 30, 3));
      }));
    } else if (style === 'chops') {
      const R = (a) => 1 - 0.28 * Math.max(0, Math.cos(a + 0.3)) + 0.06 * Math.sin(3 * a);
      for (const s of [-1, 1]) {
        const sx = w * 0.24, sz = d * 0.44;
        const g = slab(sx, sz, h * 0.6, R, h * 0.08, 40, 8);
        if (s > 0) g.rotateY(Math.PI);
        parts.push(painted(at(g, s * w * 0.24, 0, 0), (v, n) => {
          const f = s > 0 ? -1 : 1;                       // undo the half turn
          const lx = (v.x - s * w * 0.24) * f;
          const rr = slabR(new V3(lx, 0, v.z * f), sx, sz, R);
          const rim = mix(fat, c, 0.25);
          if (Math.abs(n.y) < 0.5) return lx > 0 ? rim : shade(c, -0.06);
          if (rr > 0.9 && lx > -sx * 0.2) return rim;
          return mix(c, shade(c, 0.06), noise(v.x * 90, v.z * 90, s));
        }));
      }
    } else if (style === 'links') {
      // sausage links, lying along the longest side of the package
      const brown = (v) => mix(c, shade(c, -0.15), noise(v.x * 120, v.y * 120, v.z * 120));
      if (w >= h) {
        const r = Math.min(h / 2, d / 4) * 0.95;
        for (const z of [-1, 1]) parts.push(painted(at(sausage(w * 0.96, r, 0.05 * z), 0, -h / 2 + r, z * d / 4), brown));
      } else {
        const r = Math.min(w / 6, d / 2) * 0.95;
        for (let i = 0; i < 3; i++) parts.push(painted(at(sausage(h * 0.96, r, 0.04 * (i - 1)).rotateZ(Math.PI / 2), (i - 1) * w / 3, 0, 0), brown));
      }
    } else if (style === 'bacon') {
      // wavy strips with fat and lean running down their length
      const n = 4, stripW = w / n * 0.9;
      for (let i = 0; i < n; i++) {
        const x0 = (i - (n - 1) / 2) * w / n;
        const g = warp(box(stripW, h * 0.22, d * 0.96, 8, 1, 24), (v) => {
          v.y += Math.sin(v.z / d * 14 + i * 1.3) * h * 0.18;
          v.x += Math.sin(v.z / d * 6 + i) * stripW * 0.06;
        });
        g.computeVertexNormals();
        parts.push(painted(at(g, x0, -h * 0.1, 0), (v) => {
          const u = (v.x - x0) / stripW + 0.5 + Math.sin(v.z * 40 + i) * 0.04;
          const isFat = (u > 0.12 && u < 0.3) || (u > 0.58 && u < 0.7) || u > 0.92;
          return isFat ? C(0xf6d8c8) : mix(c, C(0x7a1a1a), noise(v.x * 100, 0, v.z * 100) * 0.5);
        }));
      }
    } else if (style === 'fillet') {
      const R = (a) => 1 - 0.42 * Math.pow(Math.max(0, Math.cos(a)), 2) + 0.04 * Math.sin(3 * a);
      const sx = w * 0.46, sz = d * 0.4;
      parts.push(painted(slab(sx, sz, h * 0.5, R, h * 0.3, 48, 10), (v, n) => {
        if (n.y < -0.5) return C(0xa8acb4);
        const lines = Math.abs(Math.sin((v.x * 0.85 + Math.abs(v.z) * 0.5) / w * Math.PI * 9));
        return mix(mix(c, C(0xf8a070), slabR(v, sx, sz, R) * 0.4), C(0xfbe8dc), smoothstep(0.86, 0.97, lines) * 0.85);
      }));
    } else {
      // chicken breasts (2 smooth teardrops) or thighs (3 rounder pieces)
      const thighs = p.name.includes('Thigh');
      const spots = thighs ? [[-0.27, -0.1, 0.4], [0.02, 0.13, -0.3], [0.28, -0.08, 1.2]] : [[-0.22, 0, 0.3], [0.22, 0.02, -2.8]];
      for (const [x, z, rot] of spots) {
        const R = thighs ? (a) => 1 + 0.12 * Math.sin(3 * a + rot) : (a) => 1 - 0.35 * Math.max(0, Math.cos(a)) ** 2;
        const sx = thighs ? w * 0.18 : w * 0.26, sz = thighs ? d * 0.3 : d * 0.4;
        const g = slab(sx, sz, h * 0.45, R, h * (thighs ? 0.18 : 0.32), 40, 8).rotateY(rot);
        parts.push(painted(at(g, x * w, -h * 0.12, z * d), (v, n) => {
          const k = noise(v.x * 70, v.y * 70, v.z * 70);
          return Math.abs(n.y) < 0.5 && thighs ? mix(c, C(0xf4e0b8), 0.5) : mix(c, shade(c, 0.07), k);
        }));
      }
    }
    return parts;
  },
};

const cache = new Map();

// Geometry for one product, sized to its shape's bounding box.
export function buildModel(p) {
  const key = modelKey(p);
  const [name, style] = key.split(':');
  const s = p.shape.size;
  const w = p.shape.kind === 'box' ? s[0] : s[0] * 2;
  const h = p.shape.kind === 'box' ? s[1] : p.shape.kind === 'cyl' ? s[1] : s[0] * 2;
  const d = p.shape.kind === 'box' ? s[2] : s[0] * 2;
  // models without per-product colors or randomness can be shared
  const shareKey = ['box', 'can', 'sodaCan', 'water6', 'tp', 'plates', 'cups'].includes(name) ? `${name}|${p.shapeKey}` : null;
  if (shareKey && cache.has(shareKey)) return cache.get(shareKey);
  const parts = (B[name] || B.box)(w, h, d, C(p.color), p, rng(p.id + 1), style);
  const geo = mergeGeometries(parts, false);
  geo.computeBoundingSphere();
  if (shareKey) cache.set(shareKey, geo);
  return geo;
}
