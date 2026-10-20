import * as THREE from 'three';
import { RAPIER, world, groups, G } from './physics.js';
import { productTexture } from './textures.js';
import { buildModel, hasLabel } from './models.js';

function colliderDesc(shape) {
  const s = shape.size;
  if (shape.kind === 'box') return RAPIER.ColliderDesc.cuboid(s[0] / 2, s[1] / 2, s[2] / 2);
  if (shape.kind === 'cyl') return RAPIER.ColliderDesc.cylinder(s[1] / 2, s[0]);
  return RAPIER.ColliderDesc.ball(s[0]);
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Vector3(0, 0, 0);
const WHITE = new THREE.Color(1, 1, 1);
const HOVER = new THREE.Color(1.7, 1.7, 0.9);
const UP = new THREE.Vector3(0, 1, 0);

const WAKE_R = 0.9;     // items this close to the player or cart get a live body
const FREEZE_R = 1.7;   // ...and only freeze again once they're this far away
const STILL_FRAMES = 25;

// One InstancedMesh per product. Each item is one instance. A loose item is
// either "active" (a dynamic Rapier body) or "resting" (a cheap fixed collider
// kept only so it can be aimed at). Only dropped/falling items and items the
// pushed cart plows into are active, which keeps 1500 items affordable.
export class Items {
  constructor(scene, products) {
    this.products = products;
    this.all = [];
    this.byHandle = new Map();
    this.hovered = null;
    this.dirty = new Set();

    const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    for (const p of products) {
      const material = hasLabel(p)
        ? new THREE.MeshStandardMaterial({ map: productTexture(p), vertexColors: true, roughness: 0.55 })
        : plain;
      p.material = material;
      p.geometry = buildModel(p);
      const mesh = new THREE.InstancedMesh(p.geometry, material, p.count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      for (let k = 0; k < p.count; k++) mesh.setColorAt(k, WHITE);
      scene.add(mesh);
      p.mesh = mesh;
      p.items = [];
      for (let k = 0; k < p.count; k++) {
        const item = {
          id: this.all.length, p, idx: k, state: 'shelved', body: null, collider: null,
          rest: false, still: 0, restPos: new THREE.Vector3(), restQuat: new THREE.Quaternion(),
        };
        p.items.push(item);
        this.all.push(item);
      }
    }
  }

  setMatrix(item, pos, quat, scale = _s) {
    _m.compose(pos, quat, scale);
    item.p.mesh.setMatrixAt(item.idx, _m);
    this.dirty.add(item.p.mesh);
  }

  hide(item) {
    this.setMatrix(item, ZERO, _q.identity(), ZERO);
  }

  // Transform of the k-th spot in a product's shelf slot.
  slotTransform(p, k, outPos, outQuat) {
    const s = p.slot;
    const restY = p.shape.kind === 'ball' ? p.fp.w / 2 : p.fp.h / 2;
    outPos.copy(s.start).addScaledVector(s.u, (k + 0.5) * s.pitch);
    outPos.y = s.y + restY + 0.002;
    outQuat.setFromAxisAngle(UP, s.yaw);
  }

  shelve(item, k) {
    this.removeBody(item);
    item.state = 'shelved';
    this.slotTransform(item.p, k, _p, _q);
    this.setMatrix(item, _p, _q);
  }

  makeLoose(item, pos, quat, linvel, angvel) {
    this.removeBody(item);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      .setLinearDamping(0.25)
      // round things need rolling resistance or they roll forever
      .setAngularDamping(item.p.shape.kind === 'box' ? 0.5 : 2.5);
    if (linvel) desc.setLinvel(linvel.x, linvel.y, linvel.z);
    if (angvel) desc.setAngvel({ x: angvel.x, y: angvel.y, z: angvel.z });
    const body = world.createRigidBody(desc);
    const col = world.createCollider(
      colliderDesc(item.p.shape).setFriction(0.7).setRestitution(0.15).setDensity(0.8)
        .setCollisionGroups(groups(G.ITEM)),
      body,
    );
    item.body = body;
    item.collider = col;
    item.state = 'loose';
    item.rest = false;
    item.still = 0;
    this.byHandle.set(col.handle, item);
    this.setMatrix(item, pos, quat);
  }

  // Storm flight is animated by storm.js; the item has no physics until it lands.
  setFlying(item) {
    this.removeBody(item);
    item.state = 'loose';
    item.flying = true;
  }

  // Swap a settled body for a fixed collider in the same spot.
  freeze(item) {
    const t = item.body.translation();
    const r = item.body.rotation();
    this.freezeAt(item, _p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w));
  }

  freezeAt(item, pos, quat) {
    this.removeBody(item);
    item.restPos.copy(pos);
    item.restQuat.copy(quat);
    item.collider = world.createCollider(
      colliderDesc(item.p.shape)
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
        .setCollisionGroups(groups(G.ITEM)),
    );
    item.state = 'loose';
    item.flying = false;
    item.rest = true;
    this.byHandle.set(item.collider.handle, item);
    this.setMatrix(item, pos, quat);
  }

  wake(item) {
    this.makeLoose(item, item.restPos.clone(), item.restQuat.clone(), null, null);
  }

  removeBody(item) {
    if (item.collider) this.byHandle.delete(item.collider.handle);
    if (item.body) world.removeRigidBody(item.body);
    else if (item.collider) world.removeCollider(item.collider, false);
    item.body = null;
    item.collider = null;
    item.rest = false;
    item.flying = false;
  }

  // Take an item off the floor (into a hand, cart, or the coworker's hands).
  take(item, state) {
    if (this.hovered === item) this.setHover(null);
    const wasResting = item.state === 'loose' && item.rest;
    const from = item.restPos.clone();
    this.removeBody(item);
    item.state = state;
    this.hide(item);
    if (wasResting) this.dropAbove(from);
  }

  // Anything resting on top of a removed item falls down instead of floating.
  dropAbove(p) {
    for (const o of this.all) {
      if (o.state !== 'loose' || !o.rest || o.restPos.y <= p.y + 0.02) continue;
      if ((o.restPos.x - p.x) ** 2 + (o.restPos.z - p.z) ** 2 < 0.35 * 0.35) this.wake(o);
    }
  }

  position(item, out) {
    if (item.rest || !item.body) return out.copy(item.restPos);
    const t = item.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  // wakers: points (the pushed cart) that bring nearby items to life.
  // The player is not a waker: you walk straight through items on the floor.
  manage(wakers) {
    const near = (x, z, r) => wakers.some((w) => (w.x - x) ** 2 + (w.z - z) ** 2 < r * r);
    for (const item of this.all) {
      if (item.state !== 'loose' || item.flying) continue;
      if (item.rest) {
        if (near(item.restPos.x, item.restPos.z, WAKE_R)) this.wake(item);
        continue;
      }
      const v = item.body.linvel();
      const w = item.body.angvel();
      const slow = item.body.isSleeping()
        || (v.x * v.x + v.y * v.y + v.z * v.z < 0.02 && w.x * w.x + w.y * w.y + w.z * w.z < 2);
      item.still = slow ? item.still + 1 : 0;
      if (item.still >= STILL_FRAMES) {
        const t = item.body.translation();
        if (!near(t.x, t.z, FREEZE_R)) this.freeze(item);
      }
    }
  }

  setHover(item) {
    if (this.hovered === item) return;
    if (this.hovered) {
      this.hovered.p.mesh.setColorAt(this.hovered.idx, WHITE);
      this.hovered.p.mesh.instanceColor.needsUpdate = true;
    }
    this.hovered = item;
    if (item) {
      item.p.mesh.setColorAt(item.idx, HOVER);
      item.p.mesh.instanceColor.needsUpdate = true;
    }
  }

  // Copy physics transforms into the instanced meshes. Sleeping bodies are skipped.
  sync(bounds, rescue) {
    for (const item of this.all) {
      if (item.state !== 'loose' || item.rest || item.flying || item.body.isSleeping()) continue;
      const t = item.body.translation();
      if (t.y < -3 || t.x < bounds.xL - 1 || t.x > bounds.xR + 1 || t.z < bounds.zF - 1 || t.z > bounds.zB + 1) {
        rescue(item);
        continue;
      }
      const r = item.body.rotation();
      _p.set(t.x, t.y, t.z);
      _q.set(r.x, r.y, r.z, r.w);
      this.setMatrix(item, _p, _q);
    }
    for (const mesh of this.dirty) mesh.instanceMatrix.needsUpdate = true;
    this.dirty.clear();
  }

  looseItems() {
    return this.all.filter((i) => i.state === 'loose');
  }
}
