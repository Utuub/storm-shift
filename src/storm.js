import * as THREE from 'three';
import { sfx } from './audio.js';
import { AISLE } from './store.js';

const DURATION = 7;      // seconds of storm before play starts
const SWEEP = 3.6;       // time for the wind front to cross the store
const GRAV = 9.81;

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _axis = new THREE.Vector3();

// Pick how an item ends up lying on the floor: which face is down, plus a random spin.
function restPose(p) {
  const s = p.shape.size;
  const q = new THREE.Quaternion();
  let y;
  const r = Math.random();
  if (p.shape.kind === 'ball') {
    q.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    return { q, y: s[0] };
  }
  if (p.shape.kind === 'cyl') {
    if (r < 0.35) { y = s[1] / 2; }
    else { q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); y = s[0]; }
  } else if (r < 0.25) { y = s[1] / 2; }
  else if (r < 0.75) { q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1)); y = s[2] / 2; }
  else { q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); y = s[0] / 2; }
  q.premultiply(_q.setFromAxisAngle(UP, Math.random() * Math.PI * 2));
  return { q, y };
}

// Opening cutscene: a wind front sweeps from the front windows to the back
// wall, blowing every item off its shelf into the aisle, with flickering
// lights and thunder. The flight is a cheap scripted fall (not Rapier) so
// 1500 items can be in the air at once; each one becomes a resting physics
// collider when it lands.
export class Storm {
  constructor(items, store, player) {
    this.items = items;
    this.store = store;
    this.player = player;
    this.active = false;
    this.flying = [];
  }

  // Put every item back on its shelf (the store before the storm).
  restock() {
    for (const p of this.items.products) {
      p.items.forEach((item, k) => this.items.shelve(item, k));
    }
  }

  start(onDone) {
    this.restock();
    this.onDone = onDone;
    this.t = 0;
    this.active = true;
    this.nextBolt = 0.3;
    this.flying = [];
    const { zF, zB } = this.store.bounds;
    this.zFront = zF;
    this.zSpan = zB - zF;
    // release order: by depth into the store, with a little jitter
    this.queue = this.items.all
      .map((item) => ({ item, z: item.p.slot.zCenter + Math.random() * 1.5 }))
      .sort((a, b) => a.z - b.z);
    this.qi = 0;
    sfx.wind(true);
    sfx.thunder();
  }

  launch(item) {
    const s = item.p.slot;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    this.items.slotTransform(item.p, item.p.items.indexOf(item), pos, quat);
    const out = 2.5 + Math.random() * 4;
    const pose = restPose(item.p);
    const half = item.p.fp.w / 2 + 0.05;
    const { zF, zB } = this.store.bounds;
    const fly = {
      item, pos, quat,
      vel: new THREE.Vector3(s.side * out, 0.5 + Math.random() * 2.5, 1.5 + (Math.random() - 0.3) * 3),
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spinRate: 6 + Math.random() * 12,
      restQ: pose.q, restY: pose.y,
      // stay inside this face's aisle so nothing lands inside a shelf
      xa: Math.min(s.frontX, s.frontX + s.side * AISLE) + half,
      xb: Math.max(s.frontX, s.frontX + s.side * AISLE) - half,
      za: zF + 0.4, zb: zB - 0.4,
      grounded: 0,
    };
    this.items.setFlying(item);
    this.flying.push(fly);
  }

  // Integrate one flying item. Returns true once it has settled.
  fly(f, dt) {
    const { pos, vel } = f;
    vel.y -= GRAV * dt;
    pos.addScaledVector(vel, dt);
    const inShelf = f.item.p.slot.side > 0 ? pos.x < f.xa : pos.x > f.xb;
    if (!inShelf) {
      if (pos.x < f.xa) { pos.x = f.xa; vel.x = Math.abs(vel.x) * 0.35; }
      if (pos.x > f.xb) { pos.x = f.xb; vel.x = -Math.abs(vel.x) * 0.35; }
    }
    if (pos.z < f.za) { pos.z = f.za; vel.z = Math.abs(vel.z) * 0.35; }
    if (pos.z > f.zb) { pos.z = f.zb; vel.z = -Math.abs(vel.z) * 0.35; }

    if (pos.y <= f.restY) {
      if (inShelf) {
        // fell straight down at the shelf face: nudge it out into the aisle
        pos.x = f.item.p.slot.side > 0 ? f.xa : f.xb;
      }
      pos.y = f.restY;
      if (vel.y < -1.2) {
        vel.y = -vel.y * 0.3;
        vel.x *= 0.6; vel.z *= 0.6;
        f.spinRate *= 0.6;
      } else {
        vel.y = 0;
        f.grounded += dt;
      }
    }
    if (f.grounded > 0) {
      const k = Math.max(0, 1 - 5 * dt);
      vel.x *= k; vel.z *= k;
      f.quat.slerp(f.restQ, Math.min(1, 10 * dt));
    } else {
      _dq.setFromAxisAngle(_axis.copy(f.spin), f.spinRate * dt);
      f.quat.premultiply(_dq);
    }
    this.items.setMatrix(f.item, pos, f.quat);
    return f.grounded > 0.35 && vel.x * vel.x + vel.z * vel.z < 0.01;
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const { lights } = this.store;

    const front = this.zFront + (this.t / SWEEP) * this.zSpan;
    while (this.qi < this.queue.length && this.queue[this.qi].z < front) {
      this.launch(this.queue[this.qi++].item);
    }
    this.flying = this.flying.filter((f) => {
      if (!this.fly(f, dt)) return true;
      this.items.freezeAt(f.item, f.pos, f.restQ);
      return false;
    });

    // flicker + lightning
    const flicker = Math.random() < 0.12 ? 0.25 : 1;
    lights.fixtureMat.emissiveIntensity = 1.2 * flicker;
    lights.hemi.intensity = 0.55 + 0.6 * flicker;
    if (this.t > this.nextBolt && this.t < DURATION - 1) {
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

    this.player.shake = this.t < SWEEP + 1 ? 1 : Math.max(0, 1 - (this.t - SWEEP - 1));

    if (this.t >= DURATION && this.qi >= this.queue.length) this.finish();
  }

  finish() {
    // anything still in the air drops where it is
    for (const f of this.flying) {
      f.pos.y = f.restY;
      this.items.freezeAt(f.item, f.pos, f.restQ);
    }
    this.flying = [];
    this.active = false;
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
    this.queue = [];
    this.flying = [];
    sfx.wind(false);
  }
}
