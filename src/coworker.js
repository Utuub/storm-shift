import * as THREE from 'three';
import { textTexture } from './textures.js';

const SPEED = 3.0;
const _v = new THREE.Vector3();

// Does the segment a->b cross a rectangle? (Liang-Barsky clip on xz)
function hits(a, b, r) {
  let t0 = 0, t1 = 1;
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [p, q] of [[-dx, a.x - r.x0], [dx, r.x1 - a.x], [-dz, a.z - r.z0], [dz, r.z1 - a.z]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}

// Jess, the coworker you can hire from Dale. Walks to the pile, grabs up to
// `cap` items, and shelves them. No physics: she walks the aisles and
// walkways, going around the center gondolas.
export class Coworker {
  constructor(scene, { items, store, carry }) {
    Object.assign(this, { scene, items, store, carry });
    this.active = false;
    this.cap = 1;
    this.held = [];
    this.path = [];
    this.state = 'idle';
    this.wait = 0;
    this.speed = SPEED;

    const g = new THREE.Group();
    const m = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const part = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    const pants = m(0x3b3f4a);
    this.legL = part(new THREE.BoxGeometry(0.15, 0.8, 0.18), pants, -0.1, 0.4, 0);
    this.legR = part(new THREE.BoxGeometry(0.15, 0.8, 0.18), pants, 0.1, 0.4, 0);
    part(new THREE.BoxGeometry(0.44, 0.6, 0.26), m(0xf3c23a), 0, 1.1, 0);      // shirt
    part(new THREE.BoxGeometry(0.4, 0.55, 0.02), m(0x2e7d4f), 0, 1.05, 0.14);   // green apron
    this.armL = part(new THREE.BoxGeometry(0.11, 0.55, 0.13), m(0xf3c23a), -0.29, 1.1, 0.05);
    this.armR = part(new THREE.BoxGeometry(0.11, 0.55, 0.13), m(0xf3c23a), 0.29, 1.1, 0.05);
    part(new THREE.SphereGeometry(0.15, 14, 10), m(0x8d5a3b), 0, 1.58, 0);     // head
    part(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m(0x2a1a12), 0, 1.62, -0.01); // hair
    part(new THREE.BoxGeometry(0.3, 0.06, 0.32), m(0x2e7d4f), 0, 1.72, 0.03);  // cap
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('JESS · CREW', { w: 256, h: 64, bg: 'rgba(243,156,18,0.92)' }), depthTest: false }));
    tag.scale.set(0.75, 0.19, 1);
    tag.position.set(0, 2.0, 0);
    g.add(tag);
    this.hands = new THREE.Group();
    this.hands.position.set(0, 1.05, 0.32);
    g.add(this.hands);
    this.group = g;
    this.pos = g.position;
  }

  spawn(at) {
    if (this.active) return;
    this.active = true;
    this.pos.set(at.x, 0, at.z);
    this.scene.add(this.group);
    this.state = 'idle';
  }

  remove() {
    if (!this.active) return;
    this.scene.remove(this.group);
    this.active = false;
    this.dropAll();
  }

  setLevel(n) {
    this.cap = n;
    this.speed = SPEED * (n >= 3 ? 1.25 : 1);
  }

  // Put anything she's carrying back on the floor at her feet (used on reset/save).
  dropAll() {
    const q = new THREE.Quaternion();
    this.held.forEach((item, i) => {
      if (item.state !== 'helper') return;
      this.items.freezeAt(item, _v.set(this.pos.x + (i - 1) * 0.25, item.p.fp.h / 2, this.pos.z + 0.4), q);
    });
    this.held = [];
    this.refreshHands();
    this.state = 'idle';
  }

  refreshHands() {
    this.hands.clear();
    let y = 0;
    for (const item of this.held) {
      const mesh = new THREE.Mesh(item.p.geometry, item.p.material);
      mesh.position.y = y + item.p.fp.h / 2;
      y += item.p.fp.h + 0.01;
      this.hands.add(mesh);
    }
  }

  // Waypoints from here to `to`, going around the gondolas via the front or back walkway.
  route(to) {
    const a = this.pos;
    const { rects, front, back } = this.store.nav;
    if (!rects.some((r) => hits(a, to, r))) return [to.clone()];
    const zw = Math.abs(a.z - front) + Math.abs(to.z - front) <= Math.abs(a.z - back) + Math.abs(to.z - back) ? front : back;
    return [new THREE.Vector3(a.x, 0, zw), new THREE.Vector3(to.x, 0, zw), to.clone()];
  }

  // Nearest resting item. With `like`, items going to the same shelf (then
  // the same section) count as much closer, so one trip delivers to one spot.
  nearestLoose(from, maxD = Infinity, like = null) {
    let best = null, bd = maxD * maxD;
    for (const i of this.items.all) {
      if (i.state !== 'loose' || !i.rest) continue;
      let d = (i.restPos.x - from.x) ** 2 + (i.restPos.z - from.z) ** 2;
      if (d > maxD * maxD) continue;
      if (like) d *= i.p === like.p ? 0.05 : i.p.section === like.p.section ? 0.3 : 1;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  goTo(target, state) {
    this.path = this.route(new THREE.Vector3(target.x, 0, target.z));
    this.state = state;
  }

  // Walk along the path. Returns true on arrival.
  walk(dt) {
    const next = this.path[0];
    if (!next) return true;
    _v.set(next.x - this.pos.x, 0, next.z - this.pos.z);
    const d = _v.length();
    const step = this.speed * dt;
    if (d <= step) {
      this.pos.x = next.x; this.pos.z = next.z;
      this.path.shift();
    } else {
      this.pos.addScaledVector(_v, step / d);
    }
    if (d > 0.01) this.group.rotation.y = Math.atan2(_v.x, _v.z);
    this.t = (this.t || 0) + dt * 9;
    const swing = Math.sin(this.t) * 0.5;
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    return this.path.length === 0;
  }

  update(dt) {
    if (!this.active) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    this.legL.rotation.x *= 0.8; this.legR.rotation.x *= 0.8;

    if (this.state === 'idle') {
      if (this.held.length) return this.deliverNext();
      this.target = this.nearestLoose(this.pos);
      if (this.target) this.goTo(this.target.restPos, 'toItem');
      return;
    }

    if (this.state === 'toItem') {
      if (this.target.state !== 'loose' || !this.target.rest) { this.state = 'idle'; return; } // someone else got it
      if (!this.walk(dt)) return;
      this.items.take(this.target, 'helper');
      this.held.push(this.target);
      this.refreshHands();
      this.wait = 0.35;
      const more = this.held.length < this.cap ? this.nearestLoose(this.pos, 4, this.held[0]) : null;
      if (more) { this.target = more; this.goTo(more.restPos, 'toItem'); } else this.deliverNext();
      return;
    }

    if (this.state === 'deliver') {
      if (!this.walk(dt)) return;
      const p = this.deliverTo;
      for (const item of this.held.filter((i) => i.p === p)) this.carry.place(item, true);
      this.held = this.held.filter((i) => i.p !== p);
      this.refreshHands();
      this.wait = 0.4;
      this.state = 'idle';
    }
  }

  deliverNext() {
    // closest shelf first
    this.held.sort((a, b) => a.p.slot.stand.distanceToSquared(this.pos) - b.p.slot.stand.distanceToSquared(this.pos));
    this.deliverTo = this.held[0].p;
    this.goTo(this.deliverTo.slot.stand, 'deliver');
  }
}
