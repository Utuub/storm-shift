import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addStaticBox, addSensorBox, G } from './physics.js';
import { makeSlotTag, drawSlotTag, signTexture, floorTexture, textTexture } from './textures.js';

// Shelf geometry (meters)
const GAP = 0.015;        // minimum space between items on a shelf
const CLEAR = 0.09;       // headroom above the tallest item in a tier
const BOARD = 0.03;
const WALL_H = 5;
const SPINE = 0.05;
const DEPTH = 0.42;       // one face of a center gondola, front to spine
const GW = DEPTH * 2 + SPINE;
export const AISLE = 3.4;
const PITCH = GW + AISLE;
const Z0 = 0;             // center aisles start here and run toward +z
const SIDE_WALK = 6;      // walkway between the gondolas and the wall coolers
const HEAP_R = 4.6;       // radius of the tornado pile
const FACES = 8;          // center gondola faces (4 double-sided gondolas)

// How each kind of fixture is built. D = depth from the front edge to the
// back; shelves run from shelfOff to shelfOff + shelfD (measured from the front).
const STYLES = {
  gondola: { D: DEPTH, shelfOff: 0, shelfD: DEPTH, base: 0.12, maxH: 2.3, board: 0xc9ced4, kick: 0xb8bec6 },
  cooler: { D: 0.95, shelfOff: 0.16, shelfD: 0.62, base: 0.18, maxH: 2.12, board: 0xe3e7ec, kick: 0x2b2f36, top: 2.75 },
  open: { D: 1.0, shelfOff: 0.12, shelfD: 0.62, base: 0.32, maxH: 1.85, board: 0xd5d9de, kick: 0x2b2f36, top: 2.3 },
  wood: { D: 0.8, shelfOff: 0.05, shelfD: 0.62, base: 0.25, maxH: 1.55, board: 0xa8743f, kick: 0x6b4423, top: 1.75 },
};

// Sections that live on the walls, like a real grocery store.
// Each wall's bays sit side by side as one continuous run (a cooler wall).
const WALL_SECTIONS = {
  left: [['Dairy', 'cooler'], ['Frozen', 'cooler'], ['Drinks', 'cooler']],
  right: [['Produce', 'wood'], ['Bread & Bakery', 'wood']],
  back: [['Meat & Seafood', 'open'], ['Deli', 'open']],
};
const BAY_GAP = 0.12;

const runWidth = (p) => p.count * (p.fp.w + GAP);

// One section = one bay of shelving. Use as many shelf levels as fit under
// maxH (tallest products on the bottom, short products get more levels),
// balancing the length of each level so the bay comes out full.
function layoutSection(sec, style) {
  const st = STYLES[style];
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
    let y = st.base;
    for (const t of tiers) {
      t.y = y;
      t.h = Math.max(...t.items.map((p) => p.fp.h)) + CLEAR;
      y += t.h + BOARD;
    }
    if (y > st.maxH) continue;
    return { sec, style, tiers, height: y, width: Math.max(...tiers.map((t) => t.used)) + 0.08 };
  }
  throw new Error(`${sec.name} doesn't fit on a shelf`);
}

// Spread the center bays over the gondola faces so every face is about the same length.
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

export function buildStore(scene, sections) {
  const byName = Object.fromEntries(sections.map((s) => [s.name, s]));
  const onWall = new Set(Object.values(WALL_SECTIONS).flat().map(([n]) => n));

  // ---------- layout ----------
  const faces = packFaces(sections.filter((s) => !onWall.has(s.name)).map((s) => layoutSection(s, 'gondola')));
  const L = Math.max(...faces.map((f) => f.len));
  const wallRuns = Object.fromEntries(Object.entries(WALL_SECTIONS).map(([wall, list]) => {
    const bays = list.map(([n, style]) => layoutSection(byName[n], style));
    return [wall, { bays, len: bays.reduce((a, b) => a + b.width, 0) + (bays.length - 1) * BAY_GAP }];
  }));

  const PLAZA = HEAP_R * 2 + 4;
  const gondolas = FACES / 2;
  const perBank = gondolas / 2;
  const gxs = [];
  for (let j = perBank - 1; j >= 0; j--) gxs.push(-(PLAZA / 2 + GW / 2 + j * PITCH));
  for (let j = 0; j < perBank; j++) gxs.push(PLAZA / 2 + GW / 2 + j * PITCH);

  const xR = Math.max(...gxs) + GW / 2 + SIDE_WALK + STYLES.cooler.D;
  // deep enough for the back walkway and for the side wall runs (which start at z = -7)
  const zB = Math.max(Z0 + L + 5 + STYLES.open.D, Math.max(wallRuns.left.len, wallRuns.right.len) - 7 + 2.2);
  const bounds = { xL: -xR, xR, zF: -15, zB };
  const W = bounds.xR - bounds.xL;
  const D = bounds.zB - bounds.zF;
  const cz = (bounds.zF + bounds.zB) / 2;
  const heap = { cx: 0, cz: Z0 + L / 2, R: HEAP_R };

  // ---------- static geometry, merged into a few draw calls ----------
  const solid = [];
  const glass = [];
  const glow = [];
  const colored = (g, color) => {
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  };
  const block = (w, h, d, x, y, z, color, collide = true, into = solid) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed().translate(x, y, z);
    g.deleteAttribute('uv');
    into.push(into === solid ? colored(g, color) : g);
    if (collide) addStaticBox(x, y, z, w / 2, h / 2, d / 2);
  };

  const mat = {
    wall: new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.9 }),
    fixture: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.2 }),
    window: new THREE.MeshStandardMaterial({ color: 0x0b1018, emissive: 0x1a2a40, emissiveIntensity: 0.6, roughness: 0.2 }),
    door: new THREE.MeshStandardMaterial({ color: 0x0b1018, emissive: 0x1a2a40, emissiveIntensity: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, depthWrite: false }),
    glow: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeaf6ff, emissiveIntensity: 1.6 }),
  };

  // floor, ceiling, walls
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
  block(W, 0.35, 0.02, 0, 3.9, bounds.zB - 0.01, 0x2e7d4f, false);
  block(0.02, 0.35, D, bounds.xL + 0.01, 3.9, cz, 0x2e7d4f, false);
  block(0.02, 0.35, D, bounds.xR - 0.01, 3.9, cz, 0x2e7d4f, false);
  block(W, 0.15, 0.02, 0, 0.075, bounds.zB - 0.01, 0x55606b, false);

  // front windows + locked doors
  const winGeo = [];
  for (let x = bounds.xL + 3; x < bounds.xR - 2; x += 4.2) {
    if (Math.abs(x) < 2.5) continue;
    winGeo.push(new THREE.PlaneGeometry(3.4, 2.4).translate(x, 1.8, bounds.zF + 0.01));
  }
  scene.add(new THREE.Mesh(mergeGeometries(winGeo), mat.window));
  scene.add(new THREE.Mesh(mergeGeometries([-0.8, 0.8].map((dx) => new THREE.PlaneGeometry(1.5, 2.5).translate(dx, 1.25, bounds.zF + 0.01))), mat.door));
  const locked = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
    new THREE.MeshBasicMaterial({ map: textTexture('LOCKED', { bg: '#b3261e', font: 'bold 38px Arial' }) }));
  locked.position.set(0, 2.75, bounds.zF + 0.02);
  scene.add(locked);

  // checkouts front right, office front left, carts by the door
  for (let k = 0; k < 4; k++) {
    const kx = PLAZA / 2 + 1.2 + k * 3.2;
    if (kx > bounds.xR - 1.5) break;
    block(0.9, 0.95, 2.6, kx, 0.475, -9, 0x3b4252);
    block(0.7, 0.02, 2.4, kx, 0.96, -9, 0x111111, false);
    block(0.35, 0.3, 0.3, kx + 0.25, 1.1, -10.1, 0x5b6470, false);
    block(0.06, 1.8, 0.06, kx - 0.35, 1.85, -10.1, 0x9aa4ae, false);
    block(0.4, 0.3, 0.04, kx - 0.35, 2.6, -10.1, 0x2e7d4f, false);
  }
  const office = { x: bounds.xL + 4, z: bounds.zF + 3.6 };
  block(2.4, 0.9, 0.9, office.x, 0.45, office.z, 0x7a5434);
  block(0.5, 0.35, 0.05, office.x - 0.5, 1.08, office.z - 0.2, 0x2b2f3a, false);
  const officeSign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75),
    new THREE.MeshBasicMaterial({ map: signTexture('OFFICE', 'GENERAL MANAGER', '#2e7d4f') }));
  officeSign.position.set(office.x, 3.0, bounds.zF + 0.02);
  scene.add(officeSign);

  // ---------- fixture runs ----------
  const slots = [];
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  // A run is a line of bays: origin = front edge at floor level, u = along
  // the run, n = facing out into the store. Local (a, y, d): a along u, d
  // measured from the front edge toward the back.
  function makeRun(origin, u, n) {
    const L2W = (a, y, d, out = new THREE.Vector3()) => out.copy(origin).addScaledVector(u, a).addScaledVector(UP, y).addScaledVector(n, -d);
    const lbox = (a0, a1, y0, y1, d0, d1, color, collide = true, into = solid) => {
      L2W(a0, y0, d0, tmpA); L2W(a1, y1, d1, tmpB);
      const w = Math.abs(tmpB.x - tmpA.x), h = Math.abs(tmpB.y - tmpA.y), dd = Math.abs(tmpB.z - tmpA.z);
      if (w < 1e-4 || h < 1e-4 || dd < 1e-4) return;
      block(w, h, dd, (tmpA.x + tmpB.x) / 2, (tmpA.y + tmpB.y) / 2, (tmpA.z + tmpB.z) / 2, color, collide, into);
    };
    const yaw = Math.atan2(n.x, n.z);
    return { origin, u, n, L2W, lbox, yaw };
  }

  function plane(w, h, map, run, a, y, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
    run.L2W(a, y, d, m.position);
    m.rotation.y = run.yaw;
    scene.add(m);
    return m;
  }

  // Build one bay (one section) starting at local a0, BW wide.
  function emitBay(run, bay, a0, BW, sub, signY) {
    const st = STYLES[bay.style];
    const { sec } = bay;
    const { lbox } = run;
    const s0 = st.shelfOff, s1 = st.shelfOff + st.shelfD;

    // housing
    if (bay.style !== 'gondola') {
      const top = st.top;
      lbox(a0 - 0.06, a0, 0, top, 0, st.D, 0x3a3f47);
      lbox(a0 + BW, a0 + BW + 0.06, 0, top, 0, st.D, 0x3a3f47);
      lbox(a0, a0 + BW, 0, top, st.D - 0.04, st.D, bay.style === 'wood' ? 0x7a5230 : 0xf2f4f6);
      lbox(a0, a0 + BW, 0, st.base, 0, s1, st.kick);
    } else {
      lbox(a0, a0 + BW, 0, st.base, s0, s1, st.kick);
    }
    if (bay.style === 'cooler') {
      lbox(a0 - 0.06, a0 + BW + 0.06, 2.2, st.top, 0, st.D, 0x2b2f36);
      lbox(a0, a0 + BW, 2.15, 2.2, 0.05, st.D - 0.05, null, false, glow);
      // glass doors with frames and handles
      const doors = Math.max(1, Math.round(BW / 0.75));
      const dw = BW / doors;
      for (let i = 0; i <= doors; i++) lbox(a0 + i * dw - 0.025, a0 + i * dw + 0.025, st.base, 2.2, 0, 0.05, 0x8c949e, false);
      lbox(a0, a0 + BW, st.base - 0.04, st.base, 0, 0.05, 0x8c949e, false);
      lbox(a0, a0 + BW, 2.16, 2.2, 0, 0.05, 0x8c949e, false);
      lbox(a0, a0 + BW, st.base, 2.16, 0.02, 0.03, null, false, glass);
      for (let i = 0; i < doors; i++) lbox(a0 + (i + 1) * dw - 0.1, a0 + (i + 1) * dw - 0.08, 0.9, 1.5, -0.05, 0, 0xd0d6dc, false);
    } else if (bay.style === 'open') {
      lbox(a0 - 0.06, a0 + BW + 0.06, 2.1, st.top, st.D * 0.35, st.D, 0x2b2f36);
      lbox(a0, a0 + BW, 2.05, 2.1, st.D * 0.4, st.D - 0.05, null, false, glow);
      lbox(a0, a0 + BW, 0.25, st.base, -0.02, 0.02, 0x8c949e, false);
    } else if (bay.style === 'wood') {
      lbox(a0, a0 + BW, st.top - 0.12, st.top, 0, st.D, 0x6b4423);
    }

    // section sign: above gondolas, on the cooler header. Open cases and wood
    // displays get the big wall banner instead (see wallRun).
    if (bay.style === 'gondola' || bay.style === 'cooler') {
      const sw = Math.min(BW - 0.1, bay.style === 'gondola' ? 3.4 : 2.2);
      plane(sw, sw / 4, signTexture(sec.name.toUpperCase(), sub, sec.color), run, a0 + BW / 2,
        bay.style === 'cooler' ? (2.2 + st.top) / 2 : signY + sw / 8, bay.style === 'cooler' ? -0.01 : st.D - 0.02);
    }

    bay.tiers.forEach((tier, t) => {
      const y = tier.y;
      if (t > 0) lbox(a0, a0 + BW, y - BOARD, y, s0, s1, st.board);
      lbox(a0, a0 + BW, y - 0.07, y, s0 - 0.012, s0, sec.color, false);

      // spread the leftover length evenly between items so the shelf looks full
      const n = tier.items.reduce((a, p) => a + p.count, 0);
      const extra = (BW - 0.08 - tier.items.reduce((a, p) => a + p.count * p.fp.w, 0)) / n;
      let a = a0 + 0.04;
      const dMid = (s0 + s1) / 2;
      for (const p of tier.items) {
        const pitch = p.fp.w + extra;
        const width = p.count * pitch;
        const aMid = a + width / 2;
        const slot = {
          product: p, section: sec, tier: t, y, pitch, width, height: tier.h,
          start: run.L2W(a, 0, dMid), u: run.u.clone(), yaw: run.yaw,
          center: run.L2W(aMid, y + tier.h / 2, dMid),
          stand: run.L2W(aMid, 0, -0.75),
          boxSize: Math.abs(run.u.x) > 0.5 ? new THREE.Vector3(width, tier.h, st.shelfD) : new THREE.Vector3(st.shelfD, tier.h, width),
        };
        // sensor sticks 6 cm past the shelf edge so it's easy to aim at
        run.L2W(a, y + 0.01, s0 - 0.06, tmpA);
        run.L2W(a + width, y + tier.h - 0.02, s1, tmpB);
        slot.collider = addSensorBox((tmpA.x + tmpB.x) / 2, (tmpA.y + tmpB.y) / 2, (tmpA.z + tmpB.z) / 2,
          Math.abs(tmpB.x - tmpA.x) / 2, Math.abs(tmpB.y - tmpA.y) / 2, Math.abs(tmpB.z - tmpA.z) / 2, G.SLOT);

        const tagW = Math.min(width - 0.02, 0.9);
        const tag = makeSlotTag(tagW, 0.06);
        slot.tagMesh = plane(tagW, 0.06, tag.texture, run, aMid, t === 0 ? st.base / 2 : y - 0.035, s0 - 0.014);
        slot.tag = tag;
        p.slot = slot;
        drawSlotTag(tag, p);
        slots.push(slot);
        a += width;
      }
    });
  }

  // center gondolas
  const gHeight = gxs.map((_, g) => Math.max(...[faces[g * 2], faces[g * 2 + 1]].flatMap((f) => f.bays.map((b) => b.height))) + 0.08);
  gxs.forEach((x, g) => {
    const H = gHeight[g];
    block(SPINE, H, L, x, H / 2, Z0 + L / 2, 0xe7e3da);
    block(GW, 0.05, L, x, H + 0.025, Z0 + L / 2, 0x5b6470);
    for (const z of [Z0 - 0.03, Z0 + L + 0.03]) block(GW, H, 0.06, x, H / 2, z, 0x5b6470);
  });
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
    const run = makeRun(new THREE.Vector3(x + side * (SPINE / 2 + DEPTH), 0, Z0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(side, 0, 0));
    const ai = centers.findIndex((v) => Math.abs(v - aisleOf(x, side)) < 0.5);
    const sub = ai < 0 ? 'MAIN AISLE' : `AISLE ${ai + 1}`;
    const stretch = L / face.len;
    let a = 0;
    face.bays.forEach((bay) => {
      const BW = bay.width * stretch;
      emitBay(run, bay, a, BW, sub, gHeight[g] + 0.08);
      a += BW;
      if (a < L - 0.01) run.lbox(a - 0.015, a + 0.015, 0, bay.height, 0, DEPTH, 0x8a929c);
    });
  });

  // wall runs, centered on their wall
  const wallRun = (wall, run, from, to) => {
    const r = wallRuns[wall];
    let a = Math.max(from, (from + to - r.len) / 2);
    for (const bay of r.bays) {
      emitBay(run, bay, a, bay.width, 'FRESH', STYLES[bay.style].top + 0.1);
      // big lettering on the wall above (coolers already have a header sign)
      if (bay.style !== 'cooler') plane(Math.min(bay.width - 0.1, 4), Math.min(bay.width - 0.1, 4) / 4,
        signTexture(bay.sec.name.toUpperCase(), '', bay.sec.color), run, a + bay.width / 2,
        STYLES[bay.style].top + 0.15 + Math.min(bay.width - 0.1, 4) / 8, STYLES[bay.style].D - 0.02);
      a += bay.width + BAY_GAP;
    }
  };
  const sideFrom = -7, sideTo = bounds.zB - STYLES.open.D - 0.6;
  wallRun('left', makeRun(new THREE.Vector3(bounds.xL + STYLES.cooler.D, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)), sideFrom, sideTo);
  wallRun('right', makeRun(new THREE.Vector3(bounds.xR - STYLES.cooler.D, 0, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)), -sideTo, -sideFrom);
  wallRun('back', makeRun(new THREE.Vector3(0, 0, bounds.zB - STYLES.open.D), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, -1)),
    bounds.xL + 2, bounds.xR - 2);

  const solidMesh = new THREE.Mesh(mergeGeometries(solid), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }));
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  scene.add(solidMesh);
  if (glass.length) scene.add(new THREE.Mesh(mergeGeometries(glass), mat.glass));
  if (glow.length) scene.add(new THREE.Mesh(mergeGeometries(glow), mat.glow));

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xfff8ee, 0x6d6457, 1.25);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 1.3);
  dir.position.set(8, 20, cz - 6);
  dir.target.position.set(0, 0, cz);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera;
  sc.left = -W / 2 - 4; sc.right = W / 2 + 4; sc.top = D / 2 + 4; sc.bottom = -D / 2 - 4;
  sc.near = 1; sc.far = 60;
  dir.shadow.bias = -0.0008;
  scene.add(dir, dir.target);

  const fixtures = [];
  for (const x of [...centers, -PLAZA / 4, PLAZA / 4, bounds.xL + 2.5, bounds.xR - 2.5]) {
    fixtures.push(new THREE.BoxGeometry(0.28, 0.06, D - 4).translate(x, WALL_H - 0.1, cz));
  }
  scene.add(new THREE.Mesh(mergeGeometries(fixtures), mat.fixture));

  // navigation for the coworker: gondola footprints + walkways around them
  const nav = {
    rects: gxs.map((x) => ({ x0: x - GW / 2 - 0.35, x1: x + GW / 2 + 0.35, z0: Z0 - 0.35, z1: Z0 + L + 0.35 })),
    front: Z0 - 1.6,
    back: Z0 + L + 1.6,
  };

  return {
    slots, bounds, L, office, heap, nav,
    spawn: new THREE.Vector3(0, 0.9, -7),
    lights: { hemi, dir, fixtureMat: mat.fixture, windowMat: mat.window, doorMat: mat.door },
  };
}
