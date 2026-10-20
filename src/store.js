import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addStaticBox, addSensorBox, G } from './physics.js';
import { makeSlotTag, drawSlotTag, signTexture, floorTexture, textTexture } from './textures.js';
import { TOTAL_ITEMS } from './catalog.js';

// Shelf geometry (meters)
const TIER_BASE = 0.12;   // kick plate height = top of the bottom shelf
const DEPTH = 0.42;       // one face of a gondola, front to spine
const SPINE = 0.05;
const GW = DEPTH * 2 + SPINE;
export const AISLE = 2.8;
const PITCH = GW + AISLE;
const GAP = 0.015;        // minimum space between items on a shelf
const CLEAR = 0.09;       // headroom above the tallest item in a tier
const BOARD = 0.03;
const MAX_H = 2.3;        // tallest a shelf face may get
const Z0 = 0;             // aisles start here and run toward +z
const WALL_H = 4.6;
const CELL = 0.46;        // grid spacing of the tornado pile

const runWidth = (p) => p.count * (p.fp.w + GAP);

// One section = one bay of shelving. Use as many shelf levels as fit under
// MAX_H (tallest products on the bottom, short products get more levels),
// balancing the length of each level so the bay comes out full.
function layoutSection(sec) {
  const sorted = [...sec.list].sort((a, b) => b.fp.h - a.fp.h);
  const total = sorted.reduce((a, p) => a + runWidth(p), 0);
  for (let n = 8; n >= 2; n--) {
    const target = total / n;
    const tiers = Array.from({ length: n }, () => ({ items: [], used: 0 }));
    let cum = 0;
    for (const p of sorted) {
      const w = runWidth(p);
      const t = Math.min(n - 1, Math.floor((cum + w / 2) / target));
      tiers[t].items.push(p);
      tiers[t].used += w;
      cum += w;
    }
    if (tiers.some((t) => !t.items.length)) continue;
    let y = TIER_BASE;
    for (const t of tiers) {
      t.y = y;
      t.h = Math.max(...t.items.map((p) => p.fp.h)) + CLEAR;
      y += t.h + BOARD;
    }
    if (y > MAX_H) continue;
    return { sec, tiers, height: y, width: Math.max(...tiers.map((t) => t.used)) + 0.08 };
  }
  throw new Error(`${sec.name} doesn't fit on a shelf`);
}

// Spread the bays over FACES gondola faces so every face is about the same length.
const FACES = 8;
function packFaces(bays) {
  const faces = Array.from({ length: FACES }, () => ({ bays: [], len: 0 }));
  for (const b of [...bays].sort((a, b) => b.width - a.width)) {
    const f = faces.reduce((m, x) => (x.len < m.len ? x : m));
    f.bays.push(b);
    f.len += b.width;
  }
  for (const f of faces) f.bays.sort((a, b) => a.sec.index - b.sec.index);
  return faces;
}

// Grid cells for the tornado pile: an oval mound, up to 4 items high in the middle.
function makeHeap() {
  const pts = [];
  for (let x = -14; x <= 14; x += CELL) {
    for (let z = -10; z <= 10; z += CELL) pts.push({ x, z, d: (x / 1.35) ** 2 + z * z });
  }
  pts.sort((a, b) => a.d - b.d);
  let n = 400;
  const capAt = (i, n) => 1 + Math.floor(3.2 * (1 - i / n));
  for (;;) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += capAt(i, n);
    if (sum >= TOTAL_ITEMS) break;
    n += 10;
  }
  const cells = pts.slice(0, n).map((c, i) => ({ x: c.x, z: c.z, cap: capAt(i, n) }));
  return {
    cells,
    ax: Math.max(...cells.map((c) => Math.abs(c.x))) + CELL,
    bz: Math.max(...cells.map((c) => Math.abs(c.z))) + CELL,
  };
}

export function buildStore(scene, sections) {
  // ---------- layout: one full bay per section, packed onto 8 faces ----------
  const faces = packFaces(sections.map(layoutSection));
  const L = Math.max(...faces.map((f) => f.len));

  const heap = makeHeap();
  const PLAZA = heap.ax * 2 + 2.4;
  const gondolas = FACES / 2;
  const perBank = Math.ceil(gondolas / 2);
  const gxs = [];
  for (let j = perBank - 1; j >= 0; j--) gxs.push(-(PLAZA / 2 + GW / 2 + j * PITCH));
  for (let j = 0; j < gondolas - perBank; j++) gxs.push(PLAZA / 2 + GW / 2 + j * PITCH);

  const xR = Math.max(...gxs.map(Math.abs)) + GW / 2 + AISLE + 0.3;
  const bounds = { xL: -xR, xR, zF: -10, zB: Z0 + L + 4.5 };
  const W = bounds.xR - bounds.xL;
  const D = bounds.zB - bounds.zF;
  const cz = (bounds.zF + bounds.zB) / 2;
  heap.cx = 0;
  heap.cz = Z0 + L / 2;

  // ---------- static geometry, merged into one draw call ----------
  const solid = [];
  const block = (w, h, d, x, y, z, color, collide = true) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(x, y, z);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.deleteAttribute('uv');
    solid.push(g);
    if (collide) addStaticBox(x, y, z, w / 2, h / 2, d / 2);
  };

  const mat = {
    wall: new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.9 }),
    fixture: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.2 }),
    window: new THREE.MeshStandardMaterial({ color: 0x0b1018, emissive: 0x1a2a40, emissiveIntensity: 0.6, roughness: 0.2 }),
    door: new THREE.MeshStandardMaterial({ color: 0x0b1018, emissive: 0x1a2a40, emissiveIntensity: 0.5 }),
  };

  // floor
  const ftex = floorTexture();
  ftex.repeat.set(W / 2.4, D / 2.4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.35, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, cz);
  floor.receiveShadow = true;
  scene.add(floor);
  addStaticBox(0, -0.5, cz, W / 2 + 2, 0.5, D / 2 + 2);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x3a3d42 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, WALL_H, cz);
  scene.add(ceil);

  // walls (own mesh, they don't need to cast shadows)
  const T = 0.5;
  const walls = [];
  const wall = (w, h, d, x, y, z) => {
    walls.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
    addStaticBox(x, y, z, w / 2, h / 2, d / 2);
  };
  wall(W + T * 2, WALL_H, T, 0, WALL_H / 2, bounds.zF - T / 2);
  wall(W + T * 2, WALL_H, T, 0, WALL_H / 2, bounds.zB + T / 2);
  wall(T, WALL_H, D, bounds.xL - T / 2, WALL_H / 2, cz);
  wall(T, WALL_H, D, bounds.xR + T / 2, WALL_H / 2, cz);
  const wallMesh = new THREE.Mesh(mergeGeometries(walls), mat.wall);
  wallMesh.receiveShadow = true;
  scene.add(wallMesh);
  block(W, 0.3, 0.02, 0, 3.2, bounds.zB - 0.01, 0x2e7d4f, false);
  block(0.02, 0.3, D, bounds.xL + 0.01, 3.2, cz, 0x2e7d4f, false);
  block(0.02, 0.3, D, bounds.xR - 0.01, 3.2, cz, 0x2e7d4f, false);

  // front windows + locked doors
  const winGeo = [];
  for (let x = bounds.xL + 3; x < bounds.xR - 2; x += 4.2) {
    if (Math.abs(x) < 2.5) continue;
    winGeo.push(new THREE.PlaneGeometry(3.4, 2.2).translate(x, 1.7, bounds.zF + 0.01));
  }
  scene.add(new THREE.Mesh(mergeGeometries(winGeo), mat.window));
  scene.add(new THREE.Mesh(mergeGeometries([-0.8, 0.8].map((dx) => new THREE.PlaneGeometry(1.5, 2.5).translate(dx, 1.25, bounds.zF + 0.01))), mat.door));
  const locked = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: textTexture('LOCKED', { bg: '#b3261e', font: 'bold 38px Arial' }) }));
  locked.position.set(0, 2.75, bounds.zF + 0.02);
  scene.add(locked);

  // checkouts on the front right, office on the front left (the middle stays clear)
  for (let k = 0; k < 4; k++) {
    const kx = PLAZA / 2 + 1.5 + k * 3.2;
    if (kx > bounds.xR - 1.5) break;
    block(0.9, 0.95, 2.6, kx, 0.475, -5.5, 0x3b4252);
    block(0.7, 0.02, 2.4, kx, 0.96, -5.5, 0x111111, false);
    block(0.35, 0.3, 0.3, kx + 0.25, 1.1, -6.6, 0x5b6470, false);
  }
  const office = { x: bounds.xL + 3.6, z: -7.6 };
  block(2.4, 0.9, 0.9, office.x, 0.45, office.z, 0x7a5434);
  block(0.5, 0.35, 0.05, office.x - 0.5, 1.08, office.z - 0.2, 0x2b2f3a, false);
  const officeSign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75),
    new THREE.MeshBasicMaterial({ map: signTexture('OFFICE', 'GENERAL MANAGER', '#2e7d4f') }));
  officeSign.position.set(office.x, 3.0, bounds.zF + 0.02);
  scene.add(officeSign);

  // ---------- gondolas, shelves, slots ----------
  const slots = [];
  const gHeight = gxs.map((_, g) => Math.max(...[faces[g * 2], faces[g * 2 + 1]].flatMap((f) => f.bays.map((b) => b.height))) + 0.08);
  gxs.forEach((x, g) => {
    const H = gHeight[g];
    block(SPINE, H, L, x, H / 2, Z0 + L / 2, 0xe7e3da);
    block(GW, 0.05, L, x, H + 0.025, Z0 + L / 2, 0x5b6470);
    for (const z of [Z0 - 0.03, Z0 + L + 0.03]) block(GW, H, 0.06, x, H / 2, z, 0x5b6470);
  });

  // aisle numbers (the aisle in the middle is the main aisle)
  const aisleOf = (x, side) => x + side * (GW / 2 + AISLE / 2);
  const centers = [];
  faces.forEach((_, i) => {
    const c = aisleOf(gxs[Math.floor(i / 2)], i % 2 ? 1 : -1);
    if (Math.abs(c) > PLAZA / 2 && !centers.some((v) => Math.abs(v - c) < 0.5)) centers.push(c);
  });
  centers.sort((a, b) => a - b);

  faces.forEach((face, i) => {
    const g = Math.floor(i / 2);
    const side = i % 2 ? 1 : -1;
    const x = gxs[g];
    const shelfX = x + side * (SPINE / 2 + DEPTH / 2);
    const frontX = x + side * (SPINE / 2 + DEPTH);
    const ac = aisleOf(x, side);
    const ai = centers.findIndex((v) => Math.abs(v - ac) < 0.5);
    const sub = ai < 0 ? 'MAIN AISLE' : `AISLE ${ai + 1}`;
    // stretch this face's bays so they fill the whole gondola length
    const stretch = L / face.len;
    let zBay = Z0;

    face.bays.forEach((bay) => {
      const { sec } = bay;
      const BW = bay.width * stretch;
      const zMid = zBay + BW / 2;
      sec.face = { gondola: g, side, frontX };

      // section divider + header sign over this bay
      block(DEPTH, bay.height, 0.03, shelfX, bay.height / 2, zBay + BW, 0x8a929c);
      const sw = Math.min(BW - 0.12, 3.4);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 4),
        new THREE.MeshBasicMaterial({ map: signTexture(sec.name.toUpperCase(), sub, sec.color) }));
      sign.position.set(x + side * 0.02, gHeight[g] + 0.08 + sw / 8, zMid);
      sign.rotation.y = side * Math.PI / 2;
      scene.add(sign);

      bay.tiers.forEach((tier, t) => {
        const y = tier.y;
        if (t === 0) block(DEPTH, TIER_BASE, BW, shelfX, TIER_BASE / 2, zMid, 0xb8bec6);
        else block(DEPTH, BOARD, BW, shelfX, y - BOARD / 2, zMid, 0xc9ced4);
        block(0.012, 0.07, BW, frontX + side * 0.006, y - 0.035, zMid, sec.color, false);

        // spread the leftover length evenly between items so the shelf looks full
        const n = tier.items.reduce((a, p) => a + p.count, 0);
        const extra = (BW - 0.08 - tier.items.reduce((a, p) => a + p.count * p.fp.w, 0)) / n;
        let z = zBay + 0.04;
        for (const p of tier.items) {
          const pitch = p.fp.w + extra;
          const width = p.count * pitch;
          const zCenter = z + width / 2;
          const slot = {
            product: p, section: sec, side, tier: t,
            x: shelfX, y, zStart: z, pitch, zCenter, width, frontX, height: tier.h,
            center: new THREE.Vector3(shelfX, y + tier.h / 2, zCenter),
          };
          // sticks out 6 cm past the shelf edge so it's easy to aim at
          slot.collider = addSensorBox(shelfX + side * 0.03, y + tier.h / 2 - 0.01, zCenter, DEPTH / 2 + 0.03, tier.h / 2 - 0.02, width / 2, G.SLOT);

          const tagW = Math.min(width - 0.02, 0.9);
          const tag = makeSlotTag(tagW, 0.06);
          const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(tagW, 0.06), new THREE.MeshBasicMaterial({ map: tag.texture }));
          tagMesh.position.set(frontX + side * 0.014, t === 0 ? 0.06 : y - 0.035, zCenter);
          tagMesh.rotation.y = side * Math.PI / 2;
          scene.add(tagMesh);
          slot.tag = tag;
          p.slot = slot;
          drawSlotTag(tag, p);
          slots.push(slot);
          z += width;
        }
      });
      zBay += BW;
    });
  });

  const solidMesh = new THREE.Mesh(mergeGeometries(solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }));
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  scene.add(solidMesh);

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0x6d6457, 1.25);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.3);
  dir.position.set(8, 18, cz - 6);
  dir.target.position.set(0, 0, cz);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera;
  sc.left = -W / 2 - 4; sc.right = W / 2 + 4; sc.top = D / 2 + 4; sc.bottom = -D / 2 - 4;
  sc.near = 1; sc.far = 50;
  dir.shadow.bias = -0.0008;
  scene.add(dir, dir.target);

  const fixtures = [];
  for (const x of [...centers, -PLAZA / 4, PLAZA / 4]) fixtures.push(new THREE.BoxGeometry(0.28, 0.06, L + 6).translate(x, WALL_H - 0.1, Z0 + L / 2));
  for (let x = bounds.xL + 3; x < bounds.xR - 2; x += 5) fixtures.push(new THREE.BoxGeometry(2.4, 0.06, 0.28).translate(x, WALL_H - 0.1, -5.5));
  scene.add(new THREE.Mesh(mergeGeometries(fixtures), mat.fixture));

  return {
    slots, bounds, L, office, heap,
    spawn: new THREE.Vector3(0, 0.9, -8),
    lights: { hemi, dir, fixtureMat: mat.fixture, windowMat: mat.window, doorMat: mat.door },
  };
}
