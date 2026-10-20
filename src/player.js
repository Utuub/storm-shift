import * as THREE from 'three';
import { RAPIER, world, groups, queryGroups, G } from './physics.js';

const EYE = 0.75;          // camera height above the capsule center
const BASE_SPEED = 3.6;
const SPRINT = 1.6;

// First-person worker: kinematic capsule + Rapier character controller.
// It walks through loose items (and shoves them) but is blocked by walls,
// shelves, the GM, and the cart.
export class Player {
  constructor(camera, spawn) {
    this.camera = camera;
    this.spawn = spawn.clone();
    this.pos = spawn.clone();
    this.prev = spawn.clone();
    this.yaw = Math.PI;
    this.pitch = -0.05;
    this.vy = 0;
    this.stamina = 1;
    this.sprinting = false;
    this.keys = new Set();
    this.shake = 0;
    this.ignoreHandle = -1;

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.5, 0.35).setCollisionGroups(groups(G.PLAYER)),
      this.body,
    );
    this.controller = world.createCharacterController(0.02);
    this.controller.enableSnapToGround(0.3);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -1.45, 1.45);
  }

  forward(out) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  teleport(p, yaw = Math.PI) {
    this.pos.copy(p);
    this.prev.copy(p);
    this.vy = 0;
    this.yaw = yaw;
    this.pitch = -0.05;
    this.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
  }

  // One fixed physics step. mods: { speedMult, unlimitedSprint, frozen }
  step(dt, mods) {
    this.prev.copy(this.pos);
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const move = new THREE.Vector3();
    if (!mods.frozen && (f || s)) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      move.set(-sin * f + cos * s, 0, -cos * f - sin * s).normalize();
    }

    const wantSprint = (k.has('ShiftLeft') || k.has('ShiftRight')) && move.lengthSq() > 0;
    this.sprinting = wantSprint && (mods.unlimitedSprint || this.stamina > 0.02);
    if (this.sprinting && !mods.unlimitedSprint) this.stamina = Math.max(0, this.stamina - dt / 5);
    else if (!this.sprinting) this.stamina = Math.min(1, this.stamina + dt / 4);

    const speed = BASE_SPEED * mods.speedMult * (this.sprinting ? SPRINT : 1);
    this.vy -= 9.81 * dt;
    const desired = { x: move.x * speed * dt, y: this.vy * dt, z: move.z * speed * dt };

    const ignore = this.ignoreHandle;
    this.controller.computeColliderMovement(
      this.collider, desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      queryGroups(G.STATIC | G.CART | G.NPC),
      ignore >= 0 ? (c) => c.handle !== ignore : undefined,
    );
    const m = this.controller.computedMovement();
    if (this.controller.computedGrounded()) this.vy = 0;
    this.pos.x += m.x; this.pos.y += m.y; this.pos.z += m.z;
    if (this.pos.y < -2) this.teleport(this.spawn, this.yaw);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }

  // Called every render frame; alpha blends between the last two physics steps.
  updateCamera(alpha, dt) {
    const c = this.camera;
    c.position.lerpVectors(this.prev, this.pos, alpha);
    c.position.y += EYE;
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake * 0.12;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.08;
      this.shake = Math.max(0, this.shake - dt * 0.6);
    }
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
