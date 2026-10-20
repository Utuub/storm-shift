import * as THREE from 'three';
import { RAPIER, world, groups, G } from './physics.js';
import { textTexture } from './textures.js';

const HALF = { x: 0.32, y: 0.45, z: 0.5 };
const UP = new THREE.Vector3(0, 1, 0);

// Shopping cart (a GM upgrade). It's a kinematic body: it stays put when
// parked and plows loose items out of the way while you push it.
export class Cart {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.items = [];
    this.cap = 25;
    this.pushing = false;
    this.yaw = 0;
    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.prevYaw = 0;

    const g = new THREE.Group();
    const wire = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, metalness: 0.8, roughness: 0.3, transparent: true, opacity: 0.45 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x9aa4ae, metalness: 0.8, roughness: 0.3 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc0392b });
    const basket = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.95), wire);
    basket.position.y = 0.72;
    g.add(basket);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(basket.geometry), new THREE.LineBasicMaterial({ color: 0x8a949e }));
    edges.position.copy(basket.position);
    g.add(edges);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.64, 8), red);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 1.02, 0.55);
    g.add(handle);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.85), frame);
    base.position.y = 0.2;
    g.add(base);
    const wheelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12);
    for (const [x, z] of [[-0.24, -0.38], [0.24, -0.38], [-0.24, 0.38], [0.24, 0.38]]) {
      const w = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x222222 }));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.06, z);
      g.add(w);
    }
    this.fill = new THREE.Mesh(new THREE.BoxGeometry(0.54, 1, 0.88), new THREE.MeshStandardMaterial({ color: 0xf39c12 }));
    this.fill.position.y = 0.5;
    g.add(this.fill);
    this.labelTex = textTexture('0/25', { w: 192, h: 64 });
    this.label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.labelTex, depthTest: false }));
    this.label.scale.set(0.5, 0.17, 1);
    this.label.position.set(0, 1.3, 0);
    g.add(this.label);
    // no castShadow: the shadow map is only drawn once, and the cart moves
    this.group = g;
    this.q = new THREE.Quaternion();
    this.updateFill();
  }

  spawn(pos, yaw = 0) {
    if (this.active) return;
    this.active = true;
    this.pos.copy(pos);
    this.prev.copy(pos);
    this.yaw = this.prevYaw = yaw;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, HALF.y, pos.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF.x, HALF.y, HALF.z).setCollisionGroups(groups(G.CART)),
      this.body,
    );
    this.scene.add(this.group);
    this.syncMesh();
  }

  remove() {
    if (!this.active) return;
    world.removeRigidBody(this.body);
    this.scene.remove(this.group);
    this.active = false;
    this.pushing = false;
    this.items = [];
    this.cap = 25;
    this.updateFill();
  }

  get handle() { return this.active ? this.collider.handle : -1; }

  near(p, d) {
    return this.active && Math.hypot(this.pos.x - p.x, this.pos.z - p.z) < d;
  }

  updateFill() {
    const r = this.items.length / this.cap;
    this.fill.visible = r > 0;
    this.fill.scale.y = Math.max(0.01, r * 0.42);
    this.fill.position.y = 0.52 + this.fill.scale.y / 2;
    const c = this.labelTex.userData.canvas.getContext('2d');
    c.clearRect(0, 0, 192, 64);
    c.fillStyle = r >= 1 ? 'rgba(179,38,30,0.85)' : 'rgba(0,0,0,0.6)';
    c.fillRect(0, 0, 192, 64);
    c.fillStyle = '#fff';
    c.font = 'bold 32px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${this.items.length}/${this.cap}`, 96, 34);
    this.labelTex.needsUpdate = true;
  }

  // Pushed carts ride in front of the player, clamped inside the store.
  step(player, bounds) {
    if (!this.active) return;
    this.prev.copy(this.pos);
    this.prevYaw = this.yaw;
    if (!this.pushing) return;
    const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
    this.pos.set(
      THREE.MathUtils.clamp(player.pos.x + fx * 1.05, bounds.xL + 0.6, bounds.xR - 0.6),
      HALF.y,
      THREE.MathUtils.clamp(player.pos.z + fz * 1.05, bounds.zF + 0.6, bounds.zB - 0.6),
    );
    this.yaw = player.yaw;
    const q = this.q.setFromAxisAngle(UP, this.yaw);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: HALF.y, z: this.pos.z });
    this.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }

  // alpha blends between physics steps, same as the camera, so the cart doesn't judder
  syncMesh(alpha = 1) {
    if (!this.active) return;
    this.group.position.set(
      this.prev.x + (this.pos.x - this.prev.x) * alpha, 0,
      this.prev.z + (this.pos.z - this.prev.z) * alpha,
    );
    let dy = this.yaw - this.prevYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.group.rotation.y = this.prevYaw + dy * alpha;
    this.label.visible = !this.pushing; // the HUD shows the count while pushing
  }
}
