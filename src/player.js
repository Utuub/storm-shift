import * as THREE from 'three';
import { RAPIER, world, groups, queryGroups, G } from './physics.js';

const EYE = 0.75;          // camera height above the capsule center
const BASE_SPEED = 3.6;
const SPRINT = 1.6;
const SPIKE = 300;         // mouse deltas bigger than this are a browser glitch, not a flick

const _move = new THREE.Vector3();

// First-person worker: kinematic capsule + Rapier character controller.
// It walks through loose items (and shoves them) but is blocked by walls,
// shelves, the GM, and the cart.
export class Player {
  constructor(camera, spawn, settings) {
    this.camera = camera;
    this.settings = settings;
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
    this.filter = (c) => c.handle !== this.ignoreHandle;

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  look(dx, dy) {
    if (Math.abs(dx) > SPIKE || Math.abs(dy) > SPIKE) return;
    const k = 0.0022 * this.settings.sensitivity;
    this.yaw -= dx * k;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k * (this.settings.invertY ? -1 : 1), -1.45, 1.45);
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

  down(action) {
    const b = this.settings.binds;
    const k = this.keys;
    if (k.has(b[action])) return true;
    // arrow keys always work too
    return (action === 'forward' && k.has('ArrowUp')) || (action === 'back' && k.has('ArrowDown'))
      || (action === 'left' && k.has('ArrowLeft')) || (action === 'right' && k.has('ArrowRight'))
      || (action === 'sprint' && b.sprint === 'ShiftLeft' && k.has('ShiftRight'));
  }

  // One fixed physics step. mods: { speedMult, unlimitedSprint, frozen }
  step(dt, mods) {
    this.prev.copy(this.pos);
    const f = (this.down('forward') ? 1 : 0) - (this.down('back') ? 1 : 0);
    const s = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
    _move.set(0, 0, 0);
    if (!mods.frozen && (f || s)) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      _move.set(-sin * f + cos * s, 0, -cos * f - sin * s).normalize();
    }

    const wantSprint = this.down('sprint') && _move.lengthSq() > 0;
    this.sprinting = wantSprint && (mods.unlimitedSprint || this.stamina > 0.02);
    if (this.sprinting && !mods.unlimitedSprint) this.stamina = Math.max(0, this.stamina - dt / 5);
    else if (!this.sprinting) this.stamina = Math.min(1, this.stamina + dt / 4);

    const speed = BASE_SPEED * mods.speedMult * (this.sprinting ? SPRINT : 1);
    this.vy = Math.max(-20, this.vy - 9.81 * dt);
    const desired = { x: _move.x * speed * dt, y: this.vy * dt, z: _move.z * speed * dt };

    this.controller.computeColliderMovement(
      this.collider, desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      queryGroups(G.STATIC | G.CART | G.NPC),
      this.ignoreHandle >= 0 ? this.filter : undefined,
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
      c.position.x += (Math.random() - 0.5) * this.shake * 0.1;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.07;
    }
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
