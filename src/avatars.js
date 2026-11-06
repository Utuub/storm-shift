import * as THREE from 'three';
import { RAPIER, world, groups, G } from './physics.js';
import { textTexture } from './textures.js';
import { Cart } from './cart.js';

// Custom texture file (assets/): the store's badge, printed on every crew apron.
let badgeTex = null;
function badge() {
  if (!badgeTex) {
    badgeTex = new THREE.TextureLoader().load('assets/corner-fresh-badge.png');
    badgeTex.colorSpace = THREE.SRGBColorSpace;
  }
  return badgeTex;
}

const FEET = 0.9;   // player.pos is the capsule center; the floor is this far below it
const _v = new THREE.Vector3();

export const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A face drawn on a canvas, used when a player didn't upload a photo.
function defaultFace(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#e0ac82';
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 26); // cap brim
  x.fillStyle = '#2b2113';
  x.beginPath(); x.arc(42, 60, 8, 0, Math.PI * 2); x.arc(86, 60, 8, 0, Math.PI * 2); x.fill();
  x.lineWidth = 6; x.strokeStyle = '#2b2113'; x.lineCap = 'round';
  x.beginPath(); x.arc(64, 78, 22, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function faceTexture(dataURL, color) {
  if (!dataURL) return defaultFace(color);
  const t = new THREE.TextureLoader().load(dataURL);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Little spinning stars over a stunned (bonked) player's head.
function makeStars() {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  const geo = new THREE.OctahedronGeometry(0.06);
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(geo, mat);
    const a = (i / 5) * Math.PI * 2;
    s.position.set(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28);
    g.add(s);
  }
  g.visible = false;
  return g;
}

// Another player in an online Crew Shift. Driven entirely by the state
// messages their client sends (~15 per second); we ease toward the latest one.
export class Avatar {
  constructor(scene, info, products) {
    this.scene = scene;
    this.products = products;
    this.id = info.id;
    this.name = info.name;
    this.color = info.color;
    this.nameHTML = `<b style="color:${info.color}">${escapeHTML(info.name)}</b>`;
    this.pos = new THREE.Vector3(0, FEET, -7);
    this.target = this.pos.clone();
    this.yaw = Math.PI;
    this.targetYaw = Math.PI;
    this.pitch = 0;
    this.crouch = 0;
    this.walk = 0;
    this.throwT = 0;
    this.stunned = false;
    this.hold = [];
    this.seen = false;

    const g = new THREE.Group();
    const m = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
    const part = (parent, geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
    const shirt = m(0xf4f1ea);
    const apron = m(info.color);
    const pants = m(0x2f3442);
    const skin = m(0xe0ac82);

    // legs pivot at the hip so they can swing
    this.legL = new THREE.Group(); this.legL.position.set(-0.1, 0.82, 0); g.add(this.legL);
    this.legR = new THREE.Group(); this.legR.position.set(0.1, 0.82, 0); g.add(this.legR);
    part(this.legL, new THREE.BoxGeometry(0.15, 0.8, 0.18), pants, 0, -0.4, 0);
    part(this.legR, new THREE.BoxGeometry(0.15, 0.8, 0.18), pants, 0, -0.4, 0);
    part(this.legL, new THREE.BoxGeometry(0.16, 0.08, 0.26), m(0x1b1b1b), 0, -0.78, 0.04);
    part(this.legR, new THREE.BoxGeometry(0.16, 0.08, 0.26), m(0x1b1b1b), 0, -0.78, 0.04);

    this.upper = new THREE.Group(); this.upper.position.y = 0.82; g.add(this.upper);
    part(this.upper, new THREE.BoxGeometry(0.46, 0.62, 0.26), shirt, 0, 0.31, 0);
    part(this.upper, new THREE.BoxGeometry(0.42, 0.6, 0.02), apron, 0, 0.24, 0.14); // apron in their color
    const logo = part(this.upper, new THREE.PlaneGeometry(0.22, 0.22), new THREE.MeshStandardMaterial({ map: badge(), transparent: true, roughness: 0.6 }), 0, 0.3, 0.152);
    logo.renderOrder = 1;

    // arms pivot at the shoulder: down at the sides, or forward when carrying
    this.armL = new THREE.Group(); this.armL.position.set(-0.3, 0.58, 0); this.upper.add(this.armL);
    this.armR = new THREE.Group(); this.armR.position.set(0.3, 0.58, 0); this.upper.add(this.armR);
    part(this.armL, new THREE.BoxGeometry(0.11, 0.56, 0.13), shirt, 0, -0.26, 0);
    part(this.armR, new THREE.BoxGeometry(0.11, 0.56, 0.13), shirt, 0, -0.26, 0);
    part(this.armL, new THREE.BoxGeometry(0.1, 0.1, 0.1), skin, 0, -0.56, 0);
    part(this.armR, new THREE.BoxGeometry(0.1, 0.1, 0.1), skin, 0, -0.56, 0);

    // head: their uploaded photo on the front face of a box, plus a cap
    this.head = new THREE.Group(); this.head.position.y = 0.8; this.upper.add(this.head);
    this.faceTex = faceTexture(info.face, info.color);
    const faceMat = new THREE.MeshStandardMaterial({ map: this.faceTex, roughness: 0.8 });
    const hair = m(0x3a2a1e);
    // BoxGeometry face order: +x, -x, +y, -y, +z (front), -z
    part(this.head, new THREE.BoxGeometry(0.3, 0.32, 0.3), [skin, skin, hair, skin, faceMat, hair], 0, 0.16, 0);
    part(this.head, new THREE.BoxGeometry(0.33, 0.07, 0.33), apron, 0, 0.34, 0);
    part(this.head, new THREE.BoxGeometry(0.3, 0.03, 0.14), apron, 0, 0.31, 0.2); // brim

    // what they're carrying, held out in front
    this.hands = new THREE.Group(); this.hands.position.set(0, 0.28, 0.34); this.upper.add(this.hands);

    const tag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTexture(info.name.toUpperCase(), { w: 320, h: 72, bg: hexToRGBA(info.color, 0.92), font: 'bold 44px Arial' }), depthTest: false,
    }));
    tag.scale.set(0.9, 0.2, 1);
    tag.position.y = 2.1;
    tag.renderOrder = 5;
    g.add(tag);
    this.stars = makeStars();
    this.stars.position.y = 1.95;
    g.add(this.stars);

    g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    // soft blob shadow so they look planted on the floor (the real shadow map is drawn once)
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.012;
    g.add(blob);
    g.visible = false;
    scene.add(g);
    this.group = g;

    // their cart, if they bought one (visual only; their client does the physics)
    this.cart = new Cart(scene);
    this.cart.group.visible = false;
    scene.add(this.cart.group);

    // a kinematic capsule so you can aim at them and thrown items bounce off them
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, -10, 0));
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.32).setCollisionGroups(groups(G.PEER)),
      this.body,
    );
  }

  get handle() { return this.collider.handle; }

  // s = { p:[x,y,z], yaw, pitch, cr (crouch 0/1), h:[product ids], c:[x,z,yaw,n,cap]|0, st (stunned), sp (sprinting) }
  apply(s) {
    this.target.set(s.p[0], s.p[1], s.p[2]);
    this.targetYaw = s.yaw;
    this.pitch = s.pitch || 0;
    this.crouchTarget = s.cr ? 1 : 0;
    this.stunned = !!s.st;
    if (!this.seen) { this.seen = true; this.pos.copy(this.target); this.yaw = this.targetYaw; this.group.visible = true; }
    const h = Array.isArray(s.h) ? s.h.slice(0, 6) : [];
    if (h.join() !== this.hold.join()) { this.hold = h; this.refreshHands(); }
    if (Array.isArray(s.c)) {
      const [x, z, yaw, n, cap] = s.c;
      this.cart.group.visible = true;
      this.cart.group.position.set(x, 0, z);
      this.cart.group.rotation.y = yaw;
      if (this.cart.items.length !== n || this.cart.cap !== cap) {
        this.cart.cap = cap; this.cart.items = Array(n).fill(0); this.cart.updateFill();
      }
    } else this.cart.group.visible = false;
  }

  refreshHands() {
    this.hands.clear();
    let y = 0;
    for (const pid of this.hold) {
      const p = this.products[pid];
      if (!p) continue;
      const mesh = new THREE.Mesh(p.geometry, p.material);
      mesh.position.y = y + p.fp.h / 2;
      y += p.fp.h + 0.01;
      this.hands.add(mesh);
      if (y > 0.6) break;
    }
  }

  playThrow() { this.throwT = 0.35; }

  // ease toward the last reported state and animate
  update(dt, t) {
    if (!this.seen) return;
    const k = 1 - Math.exp(-dt * 14);
    const before = _v.copy(this.pos);
    const moved = Math.hypot(this.target.x - before.x, this.target.z - before.z);
    if (moved > 4) this.pos.copy(this.target); // teleported (respawn): don't slide across the store
    else this.pos.lerp(this.target, k);
    let dy = this.targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.crouch += ((this.crouchTarget || 0) - this.crouch) * Math.min(1, dt * 10);

    const g = this.group;
    g.position.set(this.pos.x, this.pos.y - FEET, this.pos.z);
    g.rotation.y = this.yaw + Math.PI;
    const speed = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / Math.max(dt, 1e-3);
    this.walk += speed * dt * 3.2;
    const swing = Math.min(1, speed / 3) * Math.sin(this.walk) * 0.6;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    // crouch: lower the body, bend the legs
    this.upper.position.y = 0.82 - this.crouch * 0.35;
    this.legL.scale.y = this.legR.scale.y = 1 - this.crouch * 0.4;
    this.legL.position.y = this.legR.position.y = 0.82 - this.crouch * 0.35;
    this.head.rotation.x = -this.pitch * 0.6;

    const carrying = this.hold.length > 0;
    const armFwd = carrying ? -1.2 : 0;
    this.armL.rotation.x = armFwd - (carrying ? 0 : swing * 0.8);
    this.armR.rotation.x = armFwd + (carrying ? 0 : swing * 0.8);
    if (this.throwT > 0) {
      this.throwT -= dt;
      const a = 1 - this.throwT / 0.35;
      this.armR.rotation.x = -2.8 + a * 2.6; // overhand throw
    }
    if (this.stunned) {
      g.rotation.z = Math.sin(t * 9) * 0.12;
      this.stars.visible = true;
      this.stars.rotation.y = t * 5;
    } else {
      g.rotation.z = 0;
      this.stars.visible = false;
    }
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y - this.crouch * 0.3, z: this.pos.z });
  }

  // feet-to-head segment check for thrown items (bonks)
  hitBy(p, r = 0.38) {
    if (!this.seen) return false;
    const dx = p.x - this.pos.x, dz = p.z - this.pos.z;
    const y = p.y - (this.pos.y - FEET);
    return dx * dx + dz * dz < r * r && y > 0.1 && y < 1.95 - this.crouch * 0.4;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.cart.group);
    world.removeRigidBody(this.body);
    this.faceTex.dispose();
  }
}

function hexToRGBA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
