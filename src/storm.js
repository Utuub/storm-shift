import * as THREE from 'three';
import { sfx } from './audio.js';
import { modelKey } from './models.js';

const UPRIGHT = new Set(['chicken', 'croissant', 'muffin', 'meat', 'deli', 'cheese', 'eggs', 'tortilla', 'buns', 'plates', 'tub']);

const RELEASE = 4.5;     // seconds over which items get ripped off the shelves
const MIN_LEN = 6.5;     // shortest the storm can be
const GRAV = 9.81;
const SWIRL = 1.6;       // radians of tornado spin added mid-flight

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _s = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _fq = new THREE.Quaternion();

// How an item ends up lying in the pile: which face is down, any spin, and a
// little tilt so the pile looks messy. y = half its height in that pose.
function restPose(p, rand) {
  const s = p.shape.size;
  const q = new THREE.Quaternion();
  let y;
  const r = rand();
  if (p.shape.kind === 'ball') {
    q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
    return { q, y: s[0] };
  }
  if (p.shape.kind === 'cyl') {
    if (r < 0.35 || UPRIGHT.has(modelKey(p).split(':')[0])) y = s[1] / 2;
    else { q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); y = s[0]; }
  } else if (UPRIGHT.has(modelKey(p).split(':')[0])) {
    y = s[1] / 2; // trays of food land right side up
  } else {
    // flat sides are more likely to end up down: weight each face by 1/size^2
    const wy = 1 / s[1] ** 2, wz = 1 / s[2] ** 2, wx = 1 / s[0] ** 2;
    const pick = r * (wx + wy + wz);
    if (pick < wy) y = s[1] / 2;
    else if (pick < wy + wz) { q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 * (rand() < 0.5 ? 1 : -1)); y = s[2] / 2; }
    else { q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); y = s[0] / 2; }
  }
  q.premultiply(_q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5)));
  return { q, y };
}

// Half-size of an item's world bounding box in a given orientation.
const _m3 = new THREE.Matrix3();
function halfExtents(p, q) {
  const s = p.shape.size;
  const h = p.shape.kind === 'box' ? [s[0] / 2, s[1] / 2, s[2] / 2]
    : p.shape.kind === 'cyl' ? [s[0], s[1] / 2, s[0]] : [s[0], s[0], s[0]];
  const e = _m3.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)).elements;
  // column-major: e[col*3+row]
  return [0, 1, 2].map((r) => Math.abs(e[r]) * h[0] + Math.abs(e[3 + r]) * h[1] + Math.abs(e[6 + r]) * h[2]);
}

// Drop every item onto a height map one at a time, so they land on top of
// whatever is already there. Items aim for the middle, so it piles up into
// a messy mound.
const HF = 0.1;
function buildPile(items, heap, rand) {
  const hf = new Map();
  const key = (i, j) => i * 10007 + j;
  return items.map((item) => {
    const pose = restPose(item.p, rand);
    const [ex, ey, ez] = halfExtents(item.p, pose.q);
    let best = null;
    for (let tries = 0; tries < 4; tries++) {
      const r = heap.R * Math.pow(rand(), 1.25); // >1 bunches items toward the middle
      const a = rand() * Math.PI * 2;
      const x = heap.cx + Math.cos(a) * r, z = heap.cz + Math.sin(a) * r;
      const i0 = Math.floor((x - ex) / HF), i1 = Math.floor((x + ex) / HF);
      const j0 = Math.floor((z - ez) / HF), j1 = Math.floor((z + ez) / HF);
      let base = 0;
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) base = Math.max(base, hf.get(key(i, j)) || 0);
      if (!best || base < best.base) best = { x, z, base, i0, i1, j0, j1 };
      if (base < 1.3) break; // keep the pile below eye level
    }
    // settle a little into the gaps below so it doesn't look stacked
    const y = best.base * 0.92 + ey;
    const top = y + ey;
    for (let i = best.i0; i <= best.i1; i++) for (let j = best.j0; j <= best.j1; j++) {
      hf.set(key(i, j), Math.max(hf.get(key(i, j)) || 0, top));
    }
    return { item, to: new THREE.Vector3(best.x, y, best.z), toQ: pose.q };
  });
}

function funnelTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 256, x = Math.random() * 256, len = 40 + Math.random() * 140;
    ctx.strokeStyle = `rgba(${150 + Math.random() * 60},${150 + Math.random() * 60},${160 + Math.random() * 60},${0.15 + Math.random() * 0.35})`;
    ctx.lineWidth = 2 + Math.random() * 7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + len * 0.15);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

// Opening cutscene: a tornado touches down in the middle of the store and
// rips every item off its shelf into one big pile around it. The flight is
// scripted (not Rapier) so all 1500 items can be in the air at once; each
// item becomes a resting physics collider when it lands.
export class Storm {
  constructor(items, store, player, scene) {
    this.items = items;
    this.store = store;
    this.player = player;
    this.active = false;
    this.flights = [];

    const tex = funnelTexture();
    const mk = (rt, rb, h, op) => new THREE.Mesh(
      new THREE.CylinderGeometry(rt, rb, h, 28, 1, true),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, color: 0x9aa3b0 }),
    );
    this.funnel = new THREE.Group();
    this.funnelOuter = mk(5.2, 0.9, 5, 0.55);
    this.funnelInner = mk(3.4, 0.5, 5, 0.45);
    this.funnel.add(this.funnelOuter, this.funnelInner);
    this.funnel.position.set(store.heap.cx, 2.5, store.heap.cz);
    this.funnel.visible = false;
    scene.add(this.funnel);
  }

  // Put every item back on its shelf (the store before the storm).
  restock() {
    for (const p of this.items.products) p.items.forEach((item, k) => this.items.shelve(item, k));
  }

  start(onDone) {
    this.restock();
    this.onDone = onDone;
    this.t = 0;
    this.active = true;
    this.nextBolt = 0.3;
    this.funnel.visible = true;
    const rand = Math.random;
    const { heap } = this.store;

    // items closer to the funnel get pulled first, and land first (underneath)
    const list = this.items.all.map((item) => {
      const c = item.p.slot.center;
      const d = Math.hypot(c.x - heap.cx, c.z - heap.cz);
      return { item, release: 0.4 + (d / 30) * RELEASE * 0.75 + rand() * RELEASE * 0.25 };
    }).sort((a, b) => a.release - b.release);
    const pile = buildPile(list.map((l) => l.item), heap, rand);

    this.flights = list.map(({ item, release }, i) => {
      const { to, toQ } = pile[i];
      const from = new THREE.Vector3();
      const fromQ = new THREE.Quaternion();
      this.items.slotTransform(item.p, item.p.items.indexOf(item), from, fromQ);
      const apex = Math.min(4.2, Math.max(from.y, to.y) + 1.6 + rand() * 1.2);
      const vy = Math.sqrt(2 * GRAV * (apex - from.y));
      const T = vy / GRAV + Math.sqrt(2 * (apex - to.y) / GRAV);
      return {
        item, release, from, fromQ, to, toQ, vy, T,
        spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        spinRate: 5 + rand() * 9, launched: false, done: false,
      };
    });
    this.landed = 0;
    this.end = Math.max(MIN_LEN, ...this.flights.map((f) => f.release + f.T)) + 0.3;
    sfx.wind(true);
    sfx.thunder();
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const { lights, heap } = this.store;
    const p = _p, q = _fq;

    for (const f of this.flights) {
      if (f.done || this.t < f.release) continue;
      if (!f.launched) { f.launched = true; this.items.setFlying(f.item); }
      const tau = this.t - f.release;
      if (tau >= f.T) {
        f.done = true;
        this.landed++;
        this.items.freezeAt(f.item, f.to, f.toQ);
        continue;
      }
      const k = tau / f.T;
      p.set(
        f.from.x + (f.to.x - f.from.x) * k,
        f.from.y + f.vy * tau - 0.5 * GRAV * tau * tau,
        f.from.z + (f.to.z - f.from.z) * k,
      );
      // tornado swirl around the funnel, zero at both ends of the flight
      const a = SWIRL * Math.sin(Math.PI * k);
      const dx = p.x - heap.cx, dz = p.z - heap.cz;
      p.x = heap.cx + dx * Math.cos(a) - dz * Math.sin(a);
      p.z = heap.cz + dx * Math.sin(a) + dz * Math.cos(a);
      q.copy(f.fromQ).premultiply(_s.setFromAxisAngle(f.spin, f.spinRate * tau));
      if (k > 0.7) q.slerp(f.toQ, (k - 0.7) / 0.3);
      this.items.setMatrix(f.item, p, q);
    }

    // funnel: spins, fades in and out
    const fade = Math.min(1, this.t / 0.8, Math.max(0, (this.end - this.t) / 1.2));
    this.funnelOuter.rotation.y += dt * 4;
    this.funnelInner.rotation.y -= dt * 6;
    this.funnelOuter.material.opacity = 0.55 * fade;
    this.funnelInner.material.opacity = 0.45 * fade;
    this.funnelOuter.material.map.offset.y += dt * 0.6;
    this.funnel.scale.setScalar(0.6 + 0.4 * fade);

    // flicker + lightning
    const flicker = Math.random() < 0.12 ? 0.25 : 1;
    lights.fixtureMat.emissiveIntensity = 1.2 * flicker;
    lights.hemi.intensity = 0.55 + 0.6 * flicker;
    if (this.t > this.nextBolt && this.t < this.end - 1) {
      this.nextBolt = this.t + 0.9 + Math.random() * 1.6;
      this.bolt = 0.18;
      sfx.thunder();
    }
    const bolt = this.bolt > 0 ? 1 : 0;
    this.bolt -= dt;
    lights.windowMat.emissive.setHex(bolt ? 0xdde8ff : 0x1a2a40);
    lights.windowMat.emissiveIntensity = bolt ? 2.5 : 0.6;
    lights.doorMat.emissive.copy(lights.windowMat.emissive);
    if (bolt) lights.hemi.intensity = 2.4;

    this.player.shake = Math.max(0, Math.min(1, (this.end - 1.5 - this.t)));

    if (this.t >= this.end) this.finish();
  }

  finish() {
    for (const f of this.flights) if (!f.done) this.items.freezeAt(f.item, f.to, f.toQ);
    this.flights = [];
    this.active = false;
    this.funnel.visible = false;
    const { lights } = this.store;
    lights.fixtureMat.emissiveIntensity = 1.2;
    lights.hemi.intensity = 1.25;
    lights.windowMat.emissive.setHex(0x1a2a40);
    lights.windowMat.emissiveIntensity = 0.6;
    lights.doorMat.emissive.setHex(0x1a2a40);
    this.player.shake = 0;
    sfx.wind(false);
    this.onDone?.();
  }

  cancel() {
    this.active = false;
    this.flights = [];
    this.funnel.visible = false;
    sfx.wind(false);
  }
}
