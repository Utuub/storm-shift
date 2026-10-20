import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  'Thick Cut Bacon': 'box', 'Puppy Pads': 'box', 'Large Eggs': 'eggs',
  'Rice Cakes': 'roll', 'Paper Cups': 'cups',
};

const BY_SHAPE = {
  ball_s: 'apple', ball_m: 'apple', ball_l: 'melon', bunch: 'banana', jug: 'jug', carton: 'carton',
  carton_s: 'carton', stick: 'box', eggs: 'eggs', pouch: 'pillow', slices: 'cheese', tub: 'tub',
  tub_l: 'tub', pizza: 'box', bag_s: 'pillow', box_m: 'box', box_s: 'box', box_long: 'box',
  can: 'can', can_s: 'can', can_l: 'canLid', can_tall: 'can', loaf: 'loaf', buns: 'buns', jar: 'jar',
  jar_l: 'jar', bottle: 'bottle', bottle_s: 'bottle', bottle_l: 'soda', bottle_f: 'flatBottle',
  tray: 'meat:pieces', pack6: 'water6', chips: 'pillow', cereal: 'box', flour: 'paperBag',
  bigbag: 'pillow', roll: 'roll', tp: 'tp', spice: 'spice', dome: 'chicken', plates: 'plates',
};

export const modelKey = (p) => BY_NAME[p.name] || BY_SHAPE[p.shapeKey] || 'box';

// Loose produce has no package, so it needs no label texture.
const NO_LABEL = new Set(['apple', 'orange', 'citrus', 'tomato', 'potato', 'onion', 'avocado', 'peach', 'melon', 'banana']);
export const hasLabel = (p) => !NO_LABEL.has(modelKey(p));

// ---------- helpers ----------
function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
const C = (hex) => new THREE.Color(hex);
const shade = (c, l) => c.clone().offsetHSL(0, 0, l);

// Turn a geometry into a model part: vertex colors + UVs pointing at
// the label art (label=true) or the white strip.
function part(geo, color, label = false) {
  let g = geo.index ? geo.toNonIndexed() : geo;
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

const at = (g, x = 0, y = 0, z = 0) => g.translate(x, y, z);
const box = (w, h, d, ws = 1, hs = 1, ds = 1) => new THREE.BoxGeometry(w, h, d, ws, hs, ds);
// open label sleeves start at the back so the label art's center faces +z
const sleeve = (r, h, seg = 14) => new THREE.CylinderGeometry(r, r, h, seg, 1, true, Math.PI);
const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sphere = (r, ws = 12, hs = 9) => new THREE.SphereGeometry(r, ws, hs);
const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg, Math.PI);

// Puff a box out into a pillow (chip bags, pouches).
function pillow(w, h, d) {
  const g = box(w, h, d, 6, 8, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2), y = pos.getY(i) / (h / 2);
    const k = Math.sqrt(Math.max(0, 1 - x * x) * Math.max(0, 1 - y * y));
    pos.setZ(i, pos.getZ(i) * (0.25 + 0.75 * k));
  }
  g.computeVertexNormals();
  return g;
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

// ---------- builders: (w, h, d, color, product, rand) -> parts ----------
const SILVER = C(0xc9ced6);
const B = {
  box: (w, h, d) => [part(box(w, h, d), null, true)],

  apple(w, h, d, c, p) {
    const r = w / 2;
    const parts = [part(sphere(r).scale(1, 0.92, 1), c)];
    parts.push(part(at(cyl(r * 0.06, r * 0.08, r * 0.35, 5), 0, r * 0.95, 0), C(0x5a3a1a)));
    if (p.name !== 'Oranges') parts.push(part(at(box(r * 0.4, r * 0.04, r * 0.18).rotateZ(0.5), r * 0.2, r * 0.98, 0), C(0x3f8f2f)));
    return parts;
  },
  orange: (w, h, d, c) => [part(sphere(w / 2, 14, 10), c), part(at(sphere(w * 0.07, 6, 4), 0, w * 0.48, 0), C(0x6b8e23))],
  citrus(w, h, d, c) {
    const r = w / 2;
    return [
      part(sphere(r * 0.86).scale(1.15, 0.92, 0.92), c),
      part(at(cyl(0, r * 0.22, r * 0.25, 6).rotateZ(-Math.PI / 2), r * 1.05, 0, 0), shade(c, -0.05)),
      part(at(cyl(0, r * 0.22, r * 0.25, 6).rotateZ(Math.PI / 2), -r * 1.05, 0, 0), shade(c, -0.05)),
    ];
  },
  tomato(w, h, d, c) {
    const r = w / 2;
    return [part(sphere(r).scale(1, 0.82, 1), c), part(at(cyl(r * 0.45, r * 0.3, r * 0.08, 6), 0, r * 0.82, 0), C(0x2f7a2a)),
      part(at(cyl(r * 0.05, r * 0.05, r * 0.25, 4), 0, r * 0.95, 0), C(0x2f7a2a))];
  },
  potato: (w, h, d, c, p, rand) => [part(jitter(sphere(w / 2, 10, 8).scale(1, 0.72, 0.82), 0.18, rand), c)],
  onion(w, h, d, c) {
    const r = w / 2;
    return [part(lathe([[0, -r], [r * 0.6, -r * 0.9], [r, -r * 0.2], [r * 0.85, r * 0.45], [r * 0.25, r * 0.85], [r * 0.08, r]], 12), c),
      part(at(cyl(r * 0.05, r * 0.1, r * 0.3, 5), 0, r * 1.05, 0), C(0x8a6a2a))];
  },
  avocado: (w, h, d, c) => {
    const r = w / 2;
    return [part(lathe([[0, -r], [r * 0.85, -r * 0.7], [r, -r * 0.1], [r * 0.7, r * 0.5], [r * 0.45, r * 0.85], [0, r]], 12).scale(1, 1, 1), c)];
  },
  peach(w, h, d, c) {
    const g = sphere(w / 2, 14, 10);
    const parts = [part(g, c)];
    // red blush on one side
    const col = parts[0].attributes.color, pos = parts[0].attributes.position;
    const blush = C(0xd8433a);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getX(i) / (w / 2));
      col.setXYZ(i, c.r + (blush.r - c.r) * t, c.g + (blush.g - c.g) * t, c.b + (blush.b - c.b) * t);
    }
    return parts;
  },
  melon(w, h, d, c, p, rand) {
    const g = part(sphere(w / 2, 16, 12), c);
    const col = g.attributes.color;
    for (let i = 0; i < col.count; i++) {
      const k = 0.85 + rand() * 0.25;
      col.setXYZ(i, c.r * k, c.g * k, c.b * k);
    }
    return [g];
  },
  banana(w, h, d, c) {
    const parts = [];
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * d * 0.22;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-w * 0.48, h * 0.25, z), new THREE.Vector3(0, -h * 0.55, z * 1.1), new THREE.Vector3(w * 0.48, h * 0.25, z));
      parts.push(part(new THREE.TubeGeometry(curve, 10, h * 0.2, 6), c));
    }
    parts.push(part(at(box(w * 0.08, h * 0.35, d * 0.8), -w * 0.47, h * 0.28, 0), C(0x6b5a2a)));
    return parts;
  },

  jug(w, h, d, c, p) {
    const body = p.name.includes('Milk') ? C(0xf4f4f0) : shade(c, 0.05);
    return [
      part(at(box(w * 0.94, h * 0.72, d * 0.94), 0, -h * 0.14, 0), body),
      part(at(box(w * 0.97, h * 0.34, d * 0.97), 0, -h * 0.12, 0), null, true),
      part(at(cyl(w * 0.16, w * 0.66, h * 0.16, 4).rotateY(Math.PI / 4), 0, h * 0.3, 0), body),
      part(at(cyl(w * 0.15, w * 0.15, h * 0.08), 0, h * 0.42, 0), p.name.includes('Milk') ? c : shade(c, -0.15)),
      part(at(new THREE.TorusGeometry(w * 0.2, w * 0.05, 5, 10, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 4), w * 0.28, h * 0.18, -d * 0.28), body),
    ];
  },
  carton(w, h, d, c) {
    const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, h * 0.17)]);
    const roof = new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, h * 0.28, 0);
    return [
      part(at(box(w, h * 0.78, d), 0, -h * 0.11, 0), null, true),
      part(roof, shade(c, -0.08)),
      part(at(box(w, h * 0.05, d * 0.08), 0, h * 0.475, 0), shade(c, -0.1)),
    ];
  },
  eggs(w, h, d, c, p) {
    const parts = [part(at(box(w, h * 0.55, d), 0, -h * 0.22, 0), C(0xbfb3a0)),
      part(at(box(w * 0.4, h * 0.25, d * 1.01), 0, -h * 0.25, 0), null, true)];
    const er = Math.min(w / 12, d / 4) * 0.95;
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      parts.push(part(at(sphere(er, 8, 6).scale(1, 1.25, 1), (i - 2.5) * w / 6, h * 0.08, (j - 0.5) * d / 2), C(0xf3ead8)));
    }
    return parts;
  },
  pillow: (w, h, d, c) => [
    part(pillow(w, h * 0.9, d), null, true),
    part(at(box(w, h * 0.05, d * 0.25), 0, h * 0.475, 0), shade(c, -0.1)),
    part(at(box(w, h * 0.05, d * 0.25), 0, -h * 0.475, 0), shade(c, -0.1)),
  ],
  paperBag: (w, h, d, c) => [part(at(box(w, h * 0.88, d), 0, -h * 0.06, 0), null, true),
    part(at(box(w * 0.98, h * 0.12, d * 0.45), 0, h * 0.44, 0), shade(c, -0.1))],

  can(w, h, d, c) {
    const r = w / 2;
    return [
      part(sleeve(r, h * 0.9), null, true),
      part(at(cyl(r * 0.96, r * 0.96, h * 0.05), 0, h * 0.475, 0), SILVER),
      part(at(cyl(r * 0.96, r * 0.96, h * 0.05), 0, -h * 0.475, 0), SILVER),
    ];
  },
  canLid(w, h, d, c) {
    const r = w / 2;
    return [part(at(sleeve(r, h * 0.86), 0, -h * 0.05, 0), null, true),
      part(at(cyl(r * 0.97, r * 0.97, h * 0.04), 0, -h * 0.48, 0), SILVER),
      part(at(cyl(r, r, h * 0.1), 0, h * 0.44, 0), shade(c, -0.15))];
  },
  jar(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    const glass = shade(c, -0.12);
    return [
      part(at(lathe([[0, 0], [r * 0.92, 0], [r, h * 0.06], [r, h * 0.76], [r * 0.9, h * 0.84]], 14), 0, y0, 0), glass),
      part(at(sleeve(r * 1.01, h * 0.48), 0, y0 + h * 0.42, 0), null, true),
      part(at(cyl(r * 0.9, r * 0.9, h * 0.14), 0, h / 2 - h * 0.07, 0), C(0xd4a017)),
    ];
  },
  spice(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    return [
      part(at(lathe([[0, 0], [r, 0], [r, h * 0.78]], 10), 0, y0, 0), shade(c, -0.1)),
      part(at(sleeve(r * 1.02, h * 0.45), 0, y0 + h * 0.4, 0), null, true),
      part(at(cyl(r * 1.02, r * 1.02, h * 0.22, 10), 0, h / 2 - h * 0.11, 0), C(0xc0392b)),
    ];
  },
  bottle(w, h, d, c, p) {
    const r = w / 2, y0 = -h / 2;
    const glass = shade(c, -0.05);
    return [
      part(at(lathe([[0, 0], [r * 0.9, 0], [r, h * 0.05], [r, h * 0.6], [r * 0.85, h * 0.7], [r * 0.45, h * 0.8], [r * 0.38, h * 0.88]], 14), 0, y0, 0), glass),
      part(at(sleeve(r * 1.01, h * 0.34), 0, y0 + h * 0.36, 0), null, true),
      part(at(cyl(r * 0.42, r * 0.42, h * 0.12, 10), 0, h / 2 - h * 0.06, 0), p.section.name === 'Drinks' ? C(0xf4f4f4) : shade(c, -0.2)),
    ];
  },
  soda(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    const plastic = shade(c, -0.05);
    return [
      part(at(lathe([[0, 0], [r * 0.7, 0], [r * 0.95, h * 0.04], [r, h * 0.1], [r, h * 0.62], [r * 0.7, h * 0.78], [r * 0.32, h * 0.87]], 14), 0, y0, 0), plastic),
      part(at(sleeve(r * 1.01, h * 0.22), 0, y0 + h * 0.36, 0), null, true),
      part(at(cyl(r * 0.34, r * 0.34, h * 0.1, 10), 0, h / 2 - h * 0.05, 0), C(0xd8d8d8)),
    ];
  },
  flatBottle(w, h, d, c) {
    const r = w / 2, y0 = -h / 2;
    const k = d / w;
    return [
      part(at(lathe([[0, 0], [r * 0.9, 0], [r, h * 0.08], [r, h * 0.7], [r * 0.6, h * 0.82]], 14).scale(1, 1, k), 0, y0, 0), shade(c, 0.05)),
      part(at(sleeve(r * 1.01, h * 0.4).scale(1, 1, k), 0, y0 + h * 0.38, 0), null, true),
      part(at(cyl(r * 0.5, r * 0.6, h * 0.18, 10).scale(1, 1, k * 1.4), 0, h / 2 - h * 0.09, 0), shade(c, -0.25)),
    ];
  },
  tub(w, h, d, c) {
    const r = w / 2;
    return [
      part(new THREE.CylinderGeometry(r, r * 0.8, h * 0.9, 14, 1, true, Math.PI).translate(0, -h * 0.05, 0), null, true),
      part(at(cyl(r * 0.8, r * 0.8, h * 0.02), 0, -h * 0.49, 0), shade(c, -0.1)),
      part(at(cyl(r * 1.0, r * 1.0, h * 0.1), 0, h * 0.45, 0), shade(c, 0.1)),
    ];
  },
  water6(w, h, d) {
    const parts = [];
    const r = Math.min(w / 6, d / 4) * 0.95;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x = (i - 1) * w / 3, z = (j - 0.5) * d / 2;
      parts.push(part(at(lathe([[0, 0], [r, 0], [r, h * 0.7], [r * 0.45, h * 0.85], [r * 0.4, h * 0.95]], 10), x, -h / 2, z), C(0xb8dcf2)));
      parts.push(part(at(cyl(r * 0.42, r * 0.42, h * 0.06, 8), x, h / 2 - h * 0.03, z), C(0x2a6ae8)));
    }
    parts.push(part(at(box(w * 1.01, h * 0.3, d * 1.01), 0, -h * 0.12, 0), null, true));
    return parts;
  },
  roll(w, h, d, c) {
    const r = w / 2;
    return [
      part(cyl(r, r, h * 0.98, 16), C(0xf8f8f4)),
      part(sleeve(r * 1.02, h * 0.5), null, true),
      part(at(cyl(r * 0.3, r * 0.3, h * 0.01, 10), 0, h * 0.495, 0), C(0x8a6a4a)),
    ];
  },
  cups(w, h, d) {
    const r = w / 2;
    return [part(new THREE.CylinderGeometry(r, r * 0.75, h, 14, 1, false, Math.PI), C(0xf2eedd)),
      part(sleeve(r * 0.95, h * 0.4).translate(0, -h * 0.1, 0), null, true)];
  },
  tp(w, h, d) {
    const parts = [];
    const r = Math.min(w / 6, d / 4);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
      parts.push(part(at(cyl(r * 0.97, r * 0.97, h / 2 * 0.98, 12), (i - 1) * w / 3, (k - 0.5) * h / 2, (j - 0.5) * d / 2), C(0xfbfbf8)));
    }
    parts.push(part(at(box(w * 1.01, h * 0.28, d * 1.01), 0, 0, 0), null, true));
    return parts;
  },
  plates: (w, h, d) => [part(cyl(w / 2, w / 2, h, 20), C(0xf6f6f0)), part(sleeve(w / 2 * 1.02, h * 0.5, 20), null, true)],

  loaf(w, h, d, c) {
    const crust = c;
    const top = new THREE.CylinderGeometry(w / 2, w / 2, d, 12, 1, false, Math.PI / 2, Math.PI)
      .rotateX(Math.PI / 2).scale(1, (h * 0.45) / (w / 2), 1).translate(0, h * 0.05, 0);
    return [
      part(at(box(w, h * 0.55, d), 0, -h * 0.225, 0), crust),
      part(top, shade(crust, 0.04)),
      part(at(box(w * 1.03, h * 0.62, d * 0.24), 0, -h * 0.1, d * 0.05), null, true),
      part(at(cyl(w * 0.06, w * 0.18, d * 0.08, 6).rotateX(Math.PI / 2), 0, 0, -d * 0.5), shade(crust, -0.15)),
    ];
  },
  buns(w, h, d, c, p) {
    const parts = [part(at(box(w, h * 0.45, d), 0, -h * 0.275, 0), null, true)];
    const bun = p.name.includes('Bagel') ? C(0xc8905a) : C(0xd9a35a);
    const r = Math.min(w / 4, d / 6) * 0.98;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      parts.push(part(at(sphere(r, 10, 7).scale(1, (h * 0.5) / r, 1), (i - 0.5) * w / 2, -h * 0.05, (j - 1) * d / 3), bun));
    }
    return parts;
  },
  croissant(w, h, d) {
    const parts = [part(at(box(w, h * 0.1, d), 0, -h * 0.45, 0), C(0x2a2a2a)),
      part(at(box(w * 0.5, h * 0.1, 0.004), 0, -h * 0.45, d / 2), null, true)];
    for (let i = 0; i < 3; i++) {
      const t = new THREE.TorusGeometry(d * 0.2, h * 0.28, 7, 10, Math.PI * 1.1).rotateX(Math.PI / 2).rotateY(i * 0.4);
      parts.push(part(at(t, (i - 1) * w * 0.3, -h * 0.1, 0), C(0xd8953a)));
    }
    return parts;
  },
  muffin(w, h, d) {
    const parts = [part(at(box(w, h * 0.1, d), 0, -h * 0.45, 0), C(0x2a2a2a)),
      part(at(box(w * 0.5, h * 0.1, 0.004), 0, -h * 0.45, d / 2), null, true)];
    const r = Math.min(w, d) / 4 * 0.95;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x = (i - 0.5) * w / 2, z = (j - 0.5) * d / 2;
      parts.push(part(at(cyl(r, r * 0.75, h * 0.4, 10), x, -h * 0.2, z), C(0xe8dcc0)));
      parts.push(part(at(sphere(r * 1.15, 10, 6).scale(1, 0.75, 1), x, h * 0.05, z), C(0xa8743a)));
      for (let b = 0; b < 3; b++) parts.push(part(at(sphere(r * 0.18, 5, 4), x + (b - 1) * r * 0.5, h * 0.05 + r * 0.7, z + (b % 2) * r * 0.3), C(0x3a2a6a)));
    }
    return parts;
  },
  chicken(w, h, d) {
    const gold = C(0xb8742a), dark = C(0x8a4f1a);
    return [
      part(at(box(w, h * 0.12, d), 0, -h * 0.44, 0), C(0x1e1e1e)),
      part(at(box(w * 0.45, h * 0.12, 0.004), 0, -h * 0.44, d / 2), null, true),
      part(at(sphere(1, 14, 10).scale(w * 0.34, h * 0.4, d * 0.4), 0, -h * 0.02, -d * 0.02), gold),
      part(at(cyl(w * 0.07, w * 0.04, d * 0.3, 8).rotateX(1.25).rotateZ(0.35), -w * 0.18, -h * 0.05, d * 0.28), dark),
      part(at(cyl(w * 0.07, w * 0.04, d * 0.3, 8).rotateX(1.25).rotateZ(-0.35), w * 0.18, -h * 0.05, d * 0.28), dark),
      part(at(sphere(w * 0.1, 8, 6).scale(1.2, 0.8, 1), -w * 0.34, h * 0.02, -d * 0.05), dark),
      part(at(sphere(w * 0.1, 8, 6).scale(1.2, 0.8, 1), w * 0.34, h * 0.02, -d * 0.05), dark),
    ];
  },
  deli(w, h, d, c) {
    const parts = [part(at(box(w, h * 0.2, d), 0, -h * 0.4, 0), C(0xe8e8e8))];
    const r = Math.min(w, d) / 2 * 0.9;
    for (let i = 0; i < 4; i++) parts.push(part(at(cyl(r, r, h * 0.16, 16), (i - 1.5) * 0.004, -h * 0.22 + i * h * 0.17, 0), i % 2 ? shade(c, 0.05) : c));
    parts.push(part(at(box(w * 0.5, h * 0.25, 0.004), 0, -h * 0.35, d / 2), null, true));
    return parts;
  },
  cheese(w, h, d, c) {
    const parts = [];
    for (let i = 0; i < 4; i++) parts.push(part(at(box(w * 0.92, h * 0.2, d * 0.92).rotateY(i * 0.08), 0, -h * 0.38 + i * h * 0.22, 0), i % 2 ? shade(c, -0.04) : c));
    parts.push(part(at(box(w * 0.55, h * 0.4, 0.004), 0, -h * 0.1, d / 2), null, true));
    return parts;
  },
  tortilla: (w, h, d, c) => [part(cyl(w / 2, w / 2, h, 20), c), part(at(box(w * 0.6, h * 0.6, 0.004), 0, 0, w / 2 * 0.85), null, true)],

  meat(w, h, d, c, p, rand, style) {
    const parts = [part(at(box(w, h * 0.3, d), 0, -h * 0.35, 0), style === 'fillet' ? C(0x1e1e1e) : C(0xf2f2ee))];
    const top = -h * 0.2;
    if (style === 'ground') {
      parts.push(part(jitter(sphere(1, 12, 8).scale(w * 0.42, h * 0.55, d * 0.4), 0.12, rand).translate(0, top, 0), c));
    } else if (style === 'steak') {
      parts.push(part(jitter(cyl(1, 1, 1, 14).scale(w * 0.44, h * 0.4, d * 0.4), 0.1, rand).translate(0, top + h * 0.12, 0), c));
      parts.push(part(at(new THREE.TorusGeometry(w * 0.4, h * 0.08, 4, 14, Math.PI).rotateX(Math.PI / 2).scale(1, 1, d / w), 0, top + h * 0.2, 0), C(0xf3e1cf)));
    } else if (style === 'chops') {
      for (const x of [-0.22, 0.22]) {
        parts.push(part(jitter(cyl(1, 1, 1, 10).scale(w * 0.22, h * 0.3, d * 0.38), 0.12, rand).translate(x * w, top + h * 0.08, 0), c));
        parts.push(part(at(box(w * 0.04, h * 0.32, d * 0.3), x * w + w * 0.12, top + h * 0.08, 0), C(0xf5ecdf)));
      }
    } else if (style === 'fillet') {
      parts.push(part(at(box(w * 0.85, h * 0.4, d * 0.6), 0, top + h * 0.08, 0), c));
      for (let i = 0; i < 4; i++) parts.push(part(at(box(0.004, h * 0.41, d * 0.58), (i - 1.5) * w * 0.18, top + h * 0.08, 0), C(0xf8c8a8)));
    } else {
      for (const [x, z] of [[-0.24, -0.1], [0, 0.12], [0.24, -0.08]]) {
        parts.push(part(jitter(sphere(1, 10, 7).scale(w * 0.17, h * 0.4, d * 0.3), 0.15, rand).translate(x * w, top, z * d), c));
      }
    }
    parts.push(part(at(box(w * 0.35, h * 0.25, 0.004), w * 0.25, -h * 0.35, d / 2), null, true));
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
  const shareKey = ['box', 'can', 'water6', 'tp', 'plates', 'cups'].includes(name) ? `${name}|${p.shapeKey}` : null;
  if (shareKey && cache.has(shareKey)) return cache.get(shareKey);
  const parts = (B[name] || B.box)(w, h, d, C(p.color), p, rng(p.id + 1), style);
  const geo = mergeGeometries(parts, false);
  geo.computeBoundingSphere();
  if (shareKey) cache.set(shareKey, geo);
  return geo;
}
