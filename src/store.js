import * as THREE from 'three';
import { addStaticBox, addSensorBox, G } from './physics.js';
import { makeSlotTag, drawSlotTag, signTexture, floorTexture, textTexture } from './textures.js';

// Shelf geometry (meters)
export const TIERS = [0.14, 0.64, 1.14, 1.64]; // top surface of each shelf board
const DEPTH = 0.55;       // one face of a gondola, front to spine
const SPINE = 0.06;
const GONDOLA_H = 2.15;
export const AISLE = 3.2;
const PITCH = DEPTH * 2 + SPINE + AISLE;
const GAP = 0.02;         // space between items on a shelf
const Z0 = 0;             // aisles start here and run toward +z
const WALL_H = 4.6;

const slotWidth = (p) => p.count * (p.fp.w + GAP) + 0.04;

// First-fit decreasing into 4 tiers of length L. Null if it doesn't fit.
function packFace(list, L) {
  const tiers = TIERS.map(() => ({ used: 0, slots: [] }));
  const sorted = [...list].sort((a, b) => slotWidth(b) - slotWidth(a));
  for (const p of sorted) {
    const w = slotWidth(p);
    const tier = tiers.find((t) => t.used + w <= L);
    if (!tier) return null;
    tier.slots.push({ p, w });
    tier.used += w;
  }
  return tiers;
}

export function buildStore(scene, sections) {
  const gondolas = Math.ceil(sections.length / 2);
  const gx = (g) => (g - (gondolas - 1) / 2) * PITCH;

  let L = 5;
  let packs;
  for (;;) {
    packs = sections.map((s) => packFace(s.list, L));
    if (packs.every(Boolean)) break;
    L += 0.25;
  }

  const halfG = DEPTH + SPINE / 2;
  const bounds = {
    xL: gx(0) - halfG - 3.4,
    xR: gx(gondolas - 1) + halfG + 3.4,
    zF: -11,
    zB: Z0 + L + 4,
  };
  const W = bounds.xR - bounds.xL;
  const D = bounds.zB - bounds.zF;
  const cx = (bounds.xL + bounds.xR) / 2;
  const cz = (bounds.zF + bounds.zB) / 2;

  // ---------- materials ----------
  const mat = {
    board: new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.4, roughness: 0.5 }),
    spine: new THREE.MeshStandardMaterial({ color: 0xe7e3da, roughness: 0.8 }),
    cap: new THREE.MeshStandardMaterial({ color: 0x5b6470, roughness: 0.6 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.7 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.6 }),
    belt: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }),
    desk: new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: 0.7 }),
    fixture: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.2 }),
    window: new THREE.MeshStandardMaterial({ color: 0x0b1018, emissive: 0x1a2a40, emissiveIntensity: 0.6, roughness: 0.2 }),
  };

  const box = (w, h, d, m, x, y, z, collide = true, shadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) addStaticBox(x, y, z, w / 2, h / 2, d / 2);
    return mesh;
  };

  // ---------- floor, walls, ceiling ----------
  const ftex = floorTexture();
  ftex.repeat.set(W / 2.4, D / 2.4);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.35, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.receiveShadow = true;
  scene.add(floor);
  addStaticBox(cx, -0.5, cz, W / 2 + 2, 0.5, D / 2 + 2);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x3a3d42 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, WALL_H, cz);
  scene.add(ceil);

  const T = 0.5;
  box(W + T * 2, WALL_H, T, mat.wall, cx, WALL_H / 2, bounds.zF - T / 2, true, false);
  box(W + T * 2, WALL_H, T, mat.wall, cx, WALL_H / 2, bounds.zB + T / 2, true, false);
  box(T, WALL_H, D, mat.wall, bounds.xL - T / 2, WALL_H / 2, cz, true, false);
  box(T, WALL_H, D, mat.wall, bounds.xR + T / 2, WALL_H / 2, cz, true, false);
  // green trim band along the walls
  box(W, 0.3, 0.02, mat.trim, cx, 3.2, bounds.zB - 0.01, false, false);
  box(0.02, 0.3, D, mat.trim, bounds.xL + 0.01, 3.2, cz, false, false);
  box(0.02, 0.3, D, mat.trim, bounds.xR - 0.01, 3.2, cz, false, false);

  // ---------- front: windows, locked doors ----------
  const windows = [];
  for (let x = bounds.xL + 3; x < bounds.xR - 2; x += 4.2) {
    if (Math.abs(x - cx) < 2.5) continue;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), mat.window);
    pane.position.set(x, 1.7, bounds.zF + 0.01);
    scene.add(pane);
    windows.push(pane);
  }
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x0b1018, emissive: 0x1a2a40, emissiveIntensity: 0.5 });
  for (const dx of [-0.8, 0.8]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5), doorMat);
    door.position.set(cx + dx, 1.25, bounds.zF + 0.01);
    scene.add(door);
  }
  const locked = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: textTexture('LOCKED', { bg: '#b3261e', font: 'bold 38px Arial' }) }),
  );
  locked.position.set(cx, 2.75, bounds.zF + 0.02);
  scene.add(locked);

  // ---------- checkouts ----------
  for (const x of [-9, -3, 3, 9]) {
    const kx = cx + x;
    box(0.9, 0.95, 2.6, mat.counter, kx, 0.475, -5);
    box(0.7, 0.02, 2.4, mat.belt, kx, 0.96, -5, false, false);
    box(0.35, 0.3, 0.3, mat.cap, kx + 0.25, 1.1, -6.1, false);
  }

  // ---------- GM office corner ----------
  const office = { x: bounds.xL + 3.6, z: -8.6 };
  box(2.4, 0.9, 0.9, mat.desk, office.x, 0.45, office.z);
  box(0.5, 0.35, 0.05, mat.cap, office.x - 0.5, 1.08, office.z - 0.2, false); // monitor
  const officeSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 0.75),
    new THREE.MeshBasicMaterial({ map: signTexture('OFFICE', 'GENERAL MANAGER', '#2e7d4f') }),
  );
  officeSign.position.set(office.x, 3.0, bounds.zF + 0.02);
  scene.add(officeSign);

  // ---------- gondolas + slots ----------
  const slots = [];
  const capGeo = new THREE.BoxGeometry(DEPTH * 2 + SPINE, GONDOLA_H, 0.06);
  for (let g = 0; g < gondolas; g++) {
    const x = gx(g);
    box(SPINE, GONDOLA_H, L, mat.spine, x, GONDOLA_H / 2, Z0 + L / 2);
    box(DEPTH * 2 + SPINE, 0.05, L, mat.cap, x, GONDOLA_H + 0.025, Z0 + L / 2);
    for (const z of [Z0 - 0.03, Z0 + L + 0.03]) {
      const cap = new THREE.Mesh(capGeo, mat.cap);
      cap.position.set(x, GONDOLA_H / 2, z);
      cap.castShadow = true;
      scene.add(cap);
      addStaticBox(x, GONDOLA_H / 2, z, DEPTH + SPINE / 2, GONDOLA_H / 2, 0.03);
    }
  }

  sections.forEach((sec, i) => {
    const g = Math.floor(i / 2);
    const side = i % 2 ? 1 : -1;
    const x = gx(g);
    const shelfX = x + side * (SPINE / 2 + DEPTH / 2);
    const frontX = x + side * (SPINE / 2 + DEPTH);
    sec.face = { gondola: g, side, frontX, z0: Z0, z1: Z0 + L };

    TIERS.forEach((top, t) => {
      const thick = t === 0 ? top : 0.05;
      box(DEPTH, thick, L, mat.board, shelfX, top - thick / 2, Z0 + L / 2);
      // shelf edge strip in the section color
      box(0.02, 0.04, L, new THREE.MeshStandardMaterial({ color: sec.color }), frontX, top - 0.02, Z0 + L / 2, false, false);
    });

    // header sign above the face
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(L - 0.4, 4.2), 1.05),
      new THREE.MeshBasicMaterial({ map: signTexture(sec.name.toUpperCase(), `AISLE ${g + 1 + (side > 0 ? 1 : 0)}`, sec.color) }),
    );
    sign.position.set(x + side * 0.02, GONDOLA_H + 0.6, Z0 + L / 2);
    sign.rotation.y = side * Math.PI / 2;
    scene.add(sign);

    packs[i].forEach((tier, t) => {
      const slack = (L - tier.used) / (tier.slots.length + 1);
      let z = Z0 + slack;
      for (const { p, w } of tier.slots) {
        const zCenter = z + w / 2;
        const slot = {
          product: p, section: sec, side, tier: t,
          x: shelfX, y: TIERS[t], zStart: z + 0.02, pitch: p.fp.w + GAP,
          zCenter, width: w, frontX,
          center: new THREE.Vector3(shelfX, TIERS[t] + 0.24, zCenter),
        };
        slot.collider = addSensorBox(shelfX, TIERS[t] + 0.24, zCenter, DEPTH / 2, 0.23, w / 2, G.SLOT);

        const tagW = Math.min(w - 0.03, 1.0);
        const tag = makeSlotTag(tagW, 0.09);
        const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(tagW, 0.09), new THREE.MeshBasicMaterial({ map: tag.texture }));
        tagMesh.position.set(frontX + side * 0.004, t === 0 ? 0.08 : TIERS[t] - 0.07, zCenter);
        tagMesh.rotation.y = side * Math.PI / 2;
        scene.add(tagMesh);
        slot.tag = tag;
        slot.tagMesh = tagMesh;
        p.slot = slot;
        drawSlotTag(tag, p);
        slots.push(slot);
        z += w + slack;
      }
    });
  });

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0x6d6457, 1.25);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.3);
  dir.position.set(cx + 8, 18, cz - 6);
  dir.target.position.set(cx, 0, cz);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera;
  sc.left = -W / 2 - 4; sc.right = W / 2 + 4; sc.top = D / 2 + 4; sc.bottom = -D / 2 - 4;
  sc.near = 1; sc.far = 50;
  dir.shadow.bias = -0.0008;
  scene.add(dir, dir.target);

  const fixtureGeo = new THREE.BoxGeometry(0.28, 0.06, L + 6);
  for (let g = 0; g <= gondolas; g++) {
    const fx = g === 0 ? gx(0) - PITCH / 2 : gx(g - 1) + PITCH / 2;
    const f = new THREE.Mesh(fixtureGeo, mat.fixture);
    f.position.set(fx, WALL_H - 0.1, Z0 + L / 2);
    scene.add(f);
  }
  for (let x = bounds.xL + 3; x < bounds.xR - 2; x += 5) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 0.28), mat.fixture);
    f.position.set(x, WALL_H - 0.1, -5.5);
    scene.add(f);
  }

  return {
    slots, bounds, L, office,
    spawn: new THREE.Vector3(cx, 0.9, -2),
    lights: { hemi, dir, fixtureMat: mat.fixture, windowMat: mat.window, doorMat },
  };
}
