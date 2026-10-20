import * as THREE from 'three';
import { RAPIER, world, groups, queryGroups, G } from './physics.js';

const EYE = 0.75;          // camera height above the capsule center
const CROUCH_EYE = 0.2;
const BASE_SPEED = 3.6;
const SPRINT = 1.6;
const CROUCH = 0.45;
const JUMP = 4.6;          // takeoff speed, about a 1 m hop
const RECOVER = 0.35;      // stamina needed before you can sprint again after running out
const SPIKE = 300;         // mouse deltas bigger than this are a browser glitch, not a flick

const _move = new THREE.Vector3();

// First-person worker: kinematic capsule + Rapier character controller.
// It walks straight through products on the floor (no collision at all) but
// is blocked by walls, shelves, the GM, and the cart.
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
    this.exhausted = false;
    this.grounded = true;
    this.crouch = 0;          // 0 standing .. 1 crouched, eased for a smooth camera
    this.jumpQueued = false;
    this.keys = new Set();
    this.shake = 0;
    this.ignoreHandle = -1;

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      // only touches static geometry, the cart and the GM; items ignore the player
      RAPIER.ColliderDesc.capsule(0.5, 0.35).setCollisionGroups(groups(G.PLAYER, G.STATIC | G.CART | G.NPC)),
      this.body,
    );
    this.controller = world.createCharacterController(0.02);
    this.controller.enableSnapToGround(0.3);
    this.controller.setSlideEnabled(true);
    this.controller.setApplyImpulsesToDynamicBodies(false);
    this.filter = (c) => c.handle !== this.ignoreHandle;

    addEventListener('keydown', (e) => {
      if (!e.repeat && e.code === this.settings.binds.jump) this.jumpQueued = true;
      this.keys.add(e.code);
    });
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

    const crouching = !mods.frozen && this.down('crouch');
    this.crouch += ((crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 12);

    // Running the bar to zero locks sprint out until it refills to RECOVER.
    if (this.stamina <= 0) this.exhausted = true;
    if (this.exhausted && this.stamina >= RECOVER) this.exhausted = false;
    const wantSprint = this.down('sprint') && _move.lengthSq() > 0 && !crouching;
    this.sprinting = wantSprint && (mods.unlimitedSprint || !this.exhausted);
    if (this.sprinting && !mods.unlimitedSprint) this.stamina = Math.max(0, this.stamina - dt / 5);
    else if (!this.sprinting) this.stamina = Math.min(1, this.stamina + dt / 4);

    const speed = BASE_SPEED * mods.speedMult * (this.sprinting ? SPRINT : 1) * (crouching ? CROUCH : 1);
    if (this.jumpQueued && this.grounded && !mods.frozen) this.vy = JUMP;
    this.jumpQueued = false;
    this.vy = Math.max(-20, this.vy - 9.81 * dt);
    // snapping to the ground would cancel the start of a jump
    if (this.vy > 0) this.controller.disableSnapToGround();
    else this.controller.enableSnapToGround(0.3);
    const desired = { x: _move.x * speed * dt, y: this.vy * dt, z: _move.z * speed * dt };

    this.controller.computeColliderMovement(
      this.collider, desired,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      queryGroups(G.STATIC | G.CART | G.NPC),
      this.ignoreHandle >= 0 ? this.filter : undefined,
    );
    const m = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.vy < 0) this.vy = 0;
    this.pos.x += m.x; this.pos.y += m.y; this.pos.z += m.z;
    if (this.pos.y < -2) this.teleport(this.spawn, this.yaw);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
  }

  // Called every render frame; alpha blends between the last two physics steps.
  updateCamera(alpha, dt) {
    const c = this.camera;
    c.position.lerpVectors(this.prev, this.pos, alpha);
    c.position.y += EYE + (CROUCH_EYE - EYE) * this.crouch;
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake * 0.1;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.07;
    }
    c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
