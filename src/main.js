import * as THREE from 'three';
import { initPhysics, world, STEP } from './physics.js';
import { buildCatalog, SECTIONS, TOTAL_ITEMS } from './catalog.js';
import { buildStore } from './store.js';
import { Items } from './items.js';
import { Player } from './player.js';
import { GM } from './gm.js';
import { Cart } from './cart.js';
import { Storm } from './storm.js';
import { HUD, fmtTime } from './hud.js';
import { Carry } from './carry.js';
import { UpgradeMenu, effects, cheapestAvailable } from './upgrades.js';
import { drawSlotTag } from './textures.js';
import { initAudio, sfx } from './audio.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');

// ---------- setup ----------
await initPhysics();
const products = buildCatalog();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2026);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 150);
scene.add(camera);

const store = buildStore(scene, SECTIONS);
const items = new Items(scene, products);
const player = new Player(camera, store.spawn);
const gm = new GM(scene, store.office);
const cart = new Cart(scene);
const hud = new HUD();
const storm = new Storm(items, store, player);

const game = {
  state: 'title', // title | story | storm | play | paused | menu | win
  credits: 0, score: 0, shelved: 0, wrong: 0, combo: 0, time: 0,
  owned: new Set(), lastProduct: null, eff: null,
  comboMult() { return Math.min(3, 1 + Math.floor(this.combo / 15)); },
};
game.eff = effects(game.owned);

const carry = new Carry({
  game, items, player, cart, gm, hud, camera, scene, store,
  onWin: win, onMenu: openMenu,
});
const menu = new UpgradeMenu($('menu'), game, buy, closeMenu);

// Title screen shows the store fully stocked.
storm.restock();
products.forEach((p) => { p.placed = p.count; drawSlotTag(p.slot.tag, p); });
player.updateCamera(1, 0);
carry.refreshHeld();

// ---------- overlays + pointer lock ----------
const overlays = ['title', 'story', 'pause', 'win'];
function showOverlay(id) {
  overlays.forEach((o) => ($(o).hidden = o !== id));
}

function lock() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch) r.catch(() => {});
  } catch { /* browser refused; the pause screen lets them retry */ }
}
const locked = () => document.pointerLockElement === canvas;

document.addEventListener('pointerlockchange', () => {
  if (locked()) {
    if (game.state === 'paused') { game.state = 'play'; showOverlay(null); }
  } else if (game.state === 'play') {
    game.state = 'paused';
    showOverlay('pause');
  }
});

$('btn-title').addEventListener('click', () => {
  initAudio();
  game.state = 'story';
  showOverlay('story');
});
$('btn-story').addEventListener('click', () => { lock(); beginStorm(); });
$('pause').addEventListener('click', () => lock());
$('btn-again').addEventListener('click', () => { lock(); newGame(); });

function beginStorm() {
  game.state = 'storm';
  showOverlay(null);
  hud.show(false);
  $('storm-caption').hidden = false;
  storm.start(onStormDone);
  products.forEach((p) => { p.placed = 0; drawSlotTag(p.slot.tag, p); });
}

function onStormDone() {
  $('storm-caption').hidden = true;
  hud.show(true);
  game.state = 'play';
  if (!locked()) { game.state = 'paused'; showOverlay('pause'); }
  hud.toast('<b>Dale (GM):</b> Doors stay locked till this place is fixed. Every item goes back in its spot. Come see me at the office desk for upgrades.');
}

// ---------- game flow ----------
function newGame() {
  storm.cancel();
  for (const item of items.all) items.removeBody(item);
  carry.reset();
  cart.remove();
  player.ignoreHandle = -1;
  Object.assign(game, { credits: 0, score: 0, shelved: 0, wrong: 0, combo: 0, time: 0, lastProduct: null });
  game.owned.clear();
  game.eff = effects(game.owned);
  carry.refreshHeld();
  menu.close();
  hud.toggleChecklist(false);
  player.teleport(store.spawn);
  beginStorm();
}

function win() {
  game.state = 'win';
  document.exitPointerLock();
  sfx.win();
  const acc = game.shelved / Math.max(1, game.shelved + game.wrong);
  $('win-stats').innerHTML = `
    <div><span>Time</span><b>${fmtTime(game.time)}</b></div>
    <div><span>Items shelved</span><b>${game.shelved} / ${TOTAL_ITEMS}</b></div>
    <div><span>Accuracy</span><b>${(acc * 100).toFixed(1)}%</b></div>
    <div><span>Score</span><b>${game.score}</b></div>
    <div><span>Upgrades bought</span><b>${game.owned.size}</b></div>`;
  showOverlay('win');
}

function openMenu() {
  game.state = 'menu';
  document.exitPointerLock();
  menu.open();
}

function closeMenu() {
  menu.close();
  game.state = 'play';
  lock();
  setTimeout(() => {
    if (game.state === 'play' && !locked()) { game.state = 'paused'; showOverlay('pause'); }
  }, 300);
}

function buy(u) {
  game.credits -= u.cost;
  game.owned.add(u.id);
  game.eff = effects(game.owned);
  sfx.cash();
  if (u.id === 'cart') {
    cart.spawn(new THREE.Vector3(store.office.x + 2.2, 0, store.office.z + 1.6), Math.PI);
    hud.toast('<b>Dale (GM):</b> Your cart is by my desk. Press F next to it to push it.', 'good');
  }
  cart.cap = game.eff.cartCap;
  cart.updateFill();
  carry.refreshHeld();
}

function rescue(item) {
  const b = store.bounds;
  items.makeLoose(item,
    new THREE.Vector3((b.xL + b.xR) / 2 + (Math.random() - 0.5) * 6, 1, -2 + Math.random() * 2),
    new THREE.Quaternion(), null, null);
}

// ---------- input ----------
let lastR = 0;
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); if (game.state === 'play') { hud.toggleChecklist(); hud.renderChecklist(); } return; }
  if (game.state === 'menu' && (e.code === 'Escape' || e.code === 'KeyE')) { closeMenu(); return; }
  if (e.code === 'KeyR' && (game.state === 'play' || game.state === 'win' || game.state === 'paused')) {
    const now = performance.now();
    if (game.state === 'win' || now - lastR < 2000) { hud.resetHint(false); lock(); newGame(); }
    else { lastR = now; hud.resetHint(true); setTimeout(() => hud.resetHint(false), 2000); }
    return;
  }
  if (game.state !== 'play' || e.repeat) return;
  if (e.code === 'KeyE') carry.use(game.eff);
  else if (e.code === 'KeyQ') carry.drop();
  else if (e.code === 'KeyF') carry.toggleCart();
  else if (DEBUG && e.code === 'F9') debugShelve();
  else if (DEBUG && e.code === 'Equal') { game.credits += 500; hud.toast('debug: +500 credits'); }
});

addEventListener('mousedown', (e) => {
  if (!locked() || game.state !== 'play') return;
  if (e.button === 0) carry.click(game.eff);
  else if (e.button === 2) carry.drop();
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (locked() && (game.state === 'play' || game.state === 'storm')) player.look(e.movementX, e.movementY);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// Dev only (?debug): shelve everything except 5 loose items to test the ending.
function debugShelve() {
  const loose = items.all.filter((i) => i.state === 'loose');
  for (const item of loose.slice(0, -5)) carry.place(item);
  hud.toast(`debug: shelved ${loose.length - 5} items`);
}

// ---------- loop ----------
let acc = 0;
let last = performance.now();
let frameN = 0;
const clock = { t: 0 };

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock.t += dt;
  frameN++;
  const st = game.state;

  if (st !== 'paused' && st !== 'title' && st !== 'story') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 2) {
      player.step(STEP, {
        speedMult: game.eff.speedMult * (cart.pushing ? 0.9 : 1),
        unlimitedSprint: game.eff.unlimitedSprint,
        frozen: st !== 'play',
      });
      cart.step(player, store.bounds);
      world.step();
      acc -= STEP;
      steps++;
    }
    if (steps === 2) acc = 0;
    const wakers = st === 'storm' ? [] : [player.pos];
    if (cart.pushing) wakers.push(cart.pos);
    items.manage(wakers);
  }

  if (st === 'storm') storm.update(dt);
  items.sync(store.bounds, rescue);
  cart.syncMesh();
  player.updateCamera(st === 'paused' ? 1 : acc / STEP, dt);

  if (st === 'play') {
    game.time += dt;
    carry.aim(game.eff);
    carry.updateScanner(game.eff, clock.t);
    if (game.eff.radar && frameN % 10 === 0) {
      const t = carry.radarTarget();
      if (t) {
        const dx = t.x - player.pos.x, dz = t.z - player.pos.z;
        let rel = Math.atan2(-dx, -dz) - player.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        hud.radar(-rel, Math.hypot(dx, dz));
      } else hud.radar(null);
    } else if (!game.eff.radar) hud.radar(null);
    if (frameN % 20 === 0) hud.renderChecklist();
  }
  gm.update(clock.t, game.credits >= cheapestAvailable(game.owned), player.pos);
  hud.update(game, player, game.eff);
  renderer.render(scene, camera);
}

$('loading').hidden = true;
showOverlay('title');
requestAnimationFrame(frame);

if (DEBUG) window.__game = { game, items, carry, cart, player, store, products, renderer, scene, camera };
