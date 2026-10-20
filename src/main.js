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
import { initAudio, setVolumes, sfx, musicStart, musicStop, duckMusic } from './audio.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadSettings, saveSettings, DEFAULTS, ACTIONS, keyLabel } from './settings.js';
import { readSave, writeSave, applySave, clearSave } from './save.js';
import { Coworker } from './coworker.js';

const $ = (id) => document.getElementById(id);
const DEBUG = new URLSearchParams(location.search).has('debug');
const settings = loadSettings();

// ---------- setup ----------
await initPhysics();
const products = buildCatalog();

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the shelves never move, so draw shadows once
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);
const canvas = renderer.domElement;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d2026);
// soft studio reflections on everything (shiny floor, cans, bottles, glass)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
scene.fog = new THREE.Fog(0x2a2d33, 50, 120);
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 150);
scene.add(camera);

const store = buildStore(scene, SECTIONS);
const items = new Items(scene, products);
const player = new Player(camera, store.spawn, settings);
const gm = new GM(scene, store.office);
const cart = new Cart(scene);
const hud = new HUD();
const storm = new Storm(items, store, player, scene);

const game = {
  state: 'title', // title | story | storm | play | paused | menu | win
  credits: 0, score: 0, shelved: 0, wrong: 0, combo: 0, time: 0,
  owned: new Set(), lastProduct: null, eff: null,
  comboMult() { return Math.min(3, 1 + Math.floor(this.combo / 15)); },
};
game.eff = effects(game.owned);

const carry = new Carry({
  game, items, player, cart, gm, hud, camera, scene, store, settings,
  onWin: win, onMenu: openShop,
});
const menu = new UpgradeMenu($('menu'), game, buy, closeShop);
const coworker = new Coworker(scene, { items, store, carry });
const saveCtx = { game, items, carry, cart, player, products, store };

// Title screen shows the store fully stocked.
storm.restock();
products.forEach((p) => { p.placed = p.count; drawSlotTag(p.slot.tag, p); });
player.updateCamera(1, 0);
carry.refreshHeld();
applySettings();

// ---------- screens ----------
const SCREENS = ['title', 'story', 'pause', 'options', 'resume-click', 'win', 'menu'];
function show(id) {
  SCREENS.forEach((s) => ($(s).hidden = s !== id));
}

function refreshTitle() {
  const s = readSave();
  $('btn-continue').hidden = !s;
  if (s) $('continue-info').textContent = `${s.game.shelved ?? 0}/1500 shelved · ${fmtTime(s.game.time || 0)}`;
}

// ---------- fullscreen + pointer lock ----------
// In fullscreen the game can "keyboard lock" Esc, so Esc pauses and unpauses
// without the browser kicking you out of mouse capture (which would force a
// "click to resume"). Must be called from a click.
function goFullscreen() {
  if (!settings.fullscreen || document.fullscreenElement) return;
  const el = document.documentElement;
  el.requestFullscreen?.({ navigationUI: 'hide' })
    .then(() => navigator.keyboard?.lock?.(['Escape']))
    .catch(() => {});
}
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) navigator.keyboard?.lock?.(['Escape'])?.catch?.(() => {});
});

const locked = () => document.pointerLockElement === canvas;
function lock() {
  const fallback = () => {
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(lockFailed);
    } catch { lockFailed(); }
  };
  try {
    // unadjustedMovement avoids the Windows mouse-acceleration jumps
    const r = canvas.requestPointerLock({ unadjustedMovement: true });
    if (r && r.catch) r.catch(fallback);
  } catch { fallback(); }
}
function lockFailed() {
  if (locked()) return;
  if (game.state === 'play' || game.state === 'paused') { game.state = 'paused'; show('resume-click'); }
}

document.addEventListener('pointerlockchange', () => {
  if (locked()) {
    if (game.state === 'paused') { game.state = 'play'; show(null); }
  } else if (game.state === 'play') {
    pause();
  }
});
document.addEventListener('pointerlockerror', lockFailed);
$('resume-click').addEventListener('click', () => { goFullscreen(); lock(); });

function pause() {
  game.state = 'paused';
  $('save-status').textContent = '';
  restartArmed = false;
  $('btn-restart').textContent = 'Restart Shift';
  show('pause');
}

function resume() {
  show(null);
  lock();
}

let restartArmed = false;
$('pause').addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  sfx.click();
  if (act === 'resume') { goFullscreen(); resume(); }
  else if (act === 'restart') {
    // two clicks so you can't wipe a run by accident
    if (!restartArmed) { restartArmed = true; e.target.closest('button').textContent = 'Click again to restart'; return; }
    goFullscreen(); lock(); newGame();
  }
  else if (act === 'settings' || act === 'controls') openOptions(act, 'pause');
  else if (act === 'save') {
    const ok = writeSave(saveCtx);
    $('save-status').textContent = ok ? `Saved at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Could not save (storage blocked)';
  } else if (act === 'quit') quitToTitle();
});

// ---------- title / story ----------
const STORY = [
  "It's the closing shift at Corner Fresh Market. The last customer left twenty minutes ago, and you're mopping aisle 4 when the tornado sirens go off.",
  'Dale, the general manager, locks the front doors and yells for everyone to get away from the windows.',
  'Then the tornado touches down. Right in the middle of the store.',
  "When it's over, nothing is broken, but all 1,500 items are in one giant pile in the main aisle. Dale has one rule: nobody clocks out until this store is back in order.",
].join('\n\n');
let storyTimer = null;

$('btn-new').addEventListener('click', () => {
  initAudio(); sfx.click();
  game.state = 'story';
  show('story');
  let i = 0;
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    i += 2;
    $('story-text').textContent = STORY.slice(0, i);
    if (i >= STORY.length) clearInterval(storyTimer);
  }, 18);
});
$('story').addEventListener('click', (e) => {
  if (e.target.closest('#btn-story')) return;
  clearInterval(storyTimer);
  $('story-text').textContent = STORY;
});
$('btn-story').addEventListener('click', () => {
  clearInterval(storyTimer);
  sfx.click();
  goFullscreen();
  lock();
  newGame();
});
$('btn-continue').addEventListener('click', () => {
  initAudio(); sfx.click();
  const s = readSave();
  if (!s) return refreshTitle();
  goFullscreen();
  lock();
  try {
    loadGame(s);
  } catch {
    // a broken save shouldn't strand the player: drop it and start fresh
    clearSave();
    newGame();
  }
});
$('btn-title-options').addEventListener('click', () => { initAudio(); sfx.click(); openOptions('settings', 'title'); });
$('btn-again').addEventListener('click', () => { sfx.click(); goFullscreen(); lock(); newGame(); });
$('btn-win-title').addEventListener('click', () => { sfx.click(); toTitle(); });

// ---------- game flow ----------
function resetWorld() {
  storm.cancel();
  for (const item of items.all) items.removeBody(item);
  carry.reset();
  cart.remove();
  coworker.remove();
  player.ignoreHandle = -1;
  Object.assign(game, { credits: 0, score: 0, shelved: 0, wrong: 0, combo: 0, time: 0, lastProduct: null });
  game.owned.clear();
  game.eff = effects(game.owned);
  menu.close();
  hud.toggleChecklist(false);
  hud.hideDialog();
  player.teleport(store.spawn);
}

function newGame() {
  resetWorld();
  carry.refreshHeld();
  game.state = 'storm';
  show(null);
  hud.show(false);
  sfx.hum(false);
  $('storm-caption').hidden = false;
  storm.start(onStormDone);
  products.forEach((p) => { p.placed = 0; drawSlotTag(p.slot.tag, p); });
}

function onStormDone() {
  $('storm-caption').hidden = true;
  startPlay();
  hud.say("Doors stay locked till this place is fixed. Every item goes back in its own spot. Come find me at the office desk when you've earned some credits.");
}

function loadGame(data) {
  resetWorld();
  applySave(data, saveCtx);
  game.eff = effects(game.owned);
  syncCoworker();
  cart.cap = game.eff.cartCap;
  cart.updateFill();
  carry.refreshHeld();
  startPlay();
  hud.say('Back already? Good. That pile isn\'t going to shelve itself.', 4000);
}

function startPlay() {
  hud.show(true);
  show(null);
  sfx.hum(true);
  game.state = 'play';
  autosaveAt = game.time + 60;
  if (!locked()) { game.state = 'paused'; show('resume-click'); }
}

function quitToTitle() {
  if (!writeSave(saveCtx)) {
    $('save-status').textContent = 'Could not save (storage blocked). Not quitting.';
    return;
  }
  toTitle();
}

function toTitle() {
  game.state = 'title';
  if (locked()) document.exitPointerLock();
  hud.show(false);
  sfx.hum(false);
  refreshTitle();
  show('title');
}

function win() {
  game.state = 'win';
  clearSave();
  sfx.hum(false);
  document.exitPointerLock();
  sfx.win();
  const acc = game.shelved / Math.max(1, game.shelved + game.wrong);
  $('win-stats').innerHTML = `
    <div><span>Time</span><b>${fmtTime(game.time)}</b></div>
    <div><span>Items shelved</span><b>${game.shelved} / ${TOTAL_ITEMS}</b></div>
    <div><span>Accuracy</span><b>${(acc * 100).toFixed(1)}%</b></div>
    <div><span>Score</span><b>${game.score}</b></div>
    <div><span>Upgrades bought</span><b>${game.owned.size}</b></div>`;
  show('win');
}

function openShop() {
  game.state = 'menu';
  document.exitPointerLock();
  hud.hideDialog();
  menu.open();
  show('menu');
}

function closeShop() {
  menu.close();
  show(null);
  game.state = 'play';
  lock();
}

function buy(u) {
  game.credits -= u.cost;
  game.owned.add(u.id);
  game.eff = effects(game.owned);
  sfx.cash();
  if (u.id === 'cart') {
    cart.spawn(new THREE.Vector3(store.office.door.x + 2, 0, store.office.door.z + 0.3), Math.PI);
  }
  cart.cap = game.eff.cartCap;
  cart.updateFill();
  carry.refreshHeld();
  if (u.branch === 'Crew') {
    syncCoworker();
    if (u.id === 'crew1') hud.say("Jess is on the clock now. She'll pull from the pile and shelve stuff while you work.", 5000);
  }
}

function syncCoworker() {
  if (!game.eff.crew) return;
  coworker.spawn(store.office.door);
  coworker.setLevel(game.eff.crew);
}

function rescue(item) {
  items.freezeAt(item,
    new THREE.Vector3(store.heap.cx + (Math.random() - 0.5) * 3, 0.15, store.heap.cz + (Math.random() - 0.5) * 3),
    new THREE.Quaternion());
}

// ---------- settings + controls screen ----------
let optionsFrom = 'pause';
let waitingBind = null;
const SLIDERS = {
  sensitivity: (v) => `${v.toFixed(2)}x`, fov: (v) => `${v}°`, renderScale: (v) => `${Math.round(v * 100)}%`,
  master: (v) => `${Math.round(v * 100)}`, sfx: (v) => `${Math.round(v * 100)}`, ambient: (v) => `${Math.round(v * 100)}`, music: (v) => `${Math.round(v * 100)}`,
};

function openOptions(tab, from) {
  optionsFrom = from;
  selectTab(tab);
  syncOptions();
  show('options');
}
function selectTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === tab));
  $('tab-settings').hidden = tab !== 'settings';
  $('tab-controls').hidden = tab !== 'controls';
}
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { sfx.click(); selectTab(t.dataset.tab); }));

function syncOptions() {
  for (const [k, fmt] of Object.entries(SLIDERS)) {
    const el = $(`set-${k}`);
    el.value = settings[k];
    el.nextElementSibling.textContent = fmt(+settings[k]);
  }
  for (const k of ['invertY', 'shadows', 'showFps', 'fullscreen']) $(`set-${k}`).checked = settings[k];
  $('binds').innerHTML = ACTIONS.map(([a, label]) =>
    `<div class="row bind"><span>${label}</span><button class="bindbtn${waitingBind === a ? ' waiting' : ''}" data-bind="${a}">${waitingBind === a ? 'Press a key…' : keyLabel(settings.binds[a])}</button></div>`).join('');
}

const VIDEO = new Set(['fov', 'renderScale', 'shadows']);
let saveTimer = null;
function settingChanged(k) {
  if (VIDEO.has(k)) applySettings();
  else {
    setVolumes({ master: settings.master, sfx: settings.sfx, ambient: settings.ambient, music: settings.music });
    if (k === 'showFps' && !settings.showFps) hud.fps(false);
    if (k === 'fullscreen' && !settings.fullscreen && document.fullscreenElement) document.exitFullscreen();
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSettings(settings), 300);
}
for (const k of Object.keys(SLIDERS)) {
  $(`set-${k}`).addEventListener('input', (e) => {
    settings[k] = +e.target.value;
    e.target.nextElementSibling.textContent = SLIDERS[k](settings[k]);
    settingChanged(k);
  });
}
for (const k of ['invertY', 'shadows', 'showFps', 'fullscreen']) {
  $(`set-${k}`).addEventListener('change', (e) => { settings[k] = e.target.checked; settingChanged(k); });
}
$('binds').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bind]');
  if (!b) return;
  waitingBind = b.dataset.bind;
  syncOptions();
});
$('binds-reset').addEventListener('click', () => {
  settings.binds = { ...DEFAULTS.binds };
  waitingBind = null;
  applySettings();
  syncOptions();
});
$('options-back').addEventListener('click', () => {
  sfx.click();
  waitingBind = null;
  show(optionsFrom);
});

function applySettings() {
  camera.fov = settings.fov;
  camera.updateProjectionMatrix();
  const ratio = Math.min(2, devicePixelRatio * settings.renderScale);
  if (renderer.getPixelRatio() !== ratio) {
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight);
  }
  if (renderer.shadowMap.enabled !== settings.shadows || !applySettings.done) {
    renderer.shadowMap.enabled = settings.shadows;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    renderer.shadowMap.needsUpdate = true;
    applySettings.done = true;
  }
  setVolumes({ master: settings.master, sfx: settings.sfx, ambient: settings.ambient, music: settings.music });
  if (!settings.showFps) hud.fps(false);
  saveSettings(settings);
  if (game.state === 'play') carry.refreshHeld();
}

// ---------- input ----------
const isBind = (e, action) => e.code === settings.binds[action];

addEventListener('keydown', (e) => {
  // rebinding a control
  if (waitingBind) {
    e.preventDefault();
    if (e.code !== 'Escape') {
      const other = Object.keys(settings.binds).find((a) => settings.binds[a] === e.code);
      if (other) settings.binds[other] = settings.binds[waitingBind]; // swap so nothing is unbound
      settings.binds[waitingBind] = e.code;
      applySettings();
    }
    waitingBind = null;
    syncOptions();
    return;
  }
  const st = game.state;
  if (st === 'play' && (isBind(e, 'checklist') || e.code === 'Tab')) e.preventDefault();
  // ignore key auto-repeat everywhere: holding a key must not double-fire
  if (e.repeat) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (st === 'play') { document.exitPointerLock(); pause(); }        // only reaches us in fullscreen
    else if (st === 'menu') closeShop();
    else if (st === 'paused' && (!$('pause').hidden || !$('options').hidden)) {
      if (!$('options').hidden && optionsFrom !== 'pause') return show(optionsFrom);
      waitingBind = null;
      resume();                                                          // Esc from pause or settings: straight back in
    } else if (st === 'title' && !$('options').hidden) show('title');
    return;
  }
  if (st === 'menu' && isBind(e, 'interact')) { closeShop(); return; }
  if (st !== 'play') return;
  if (isBind(e, 'interact')) carry.use();
  else if (isBind(e, 'drop')) carry.drop(game.eff);
  else if (/^Digit[1-9]$/.test(e.code)) carry.select(+e.code.slice(5) - 1);
  else if (isBind(e, 'cart')) carry.toggleCart();
  else if (isBind(e, 'checklist')) { hud.toggleChecklist(); hud.renderChecklist(); }
  else if (DEBUG && e.code === 'F9') debugShelve();
  else if (DEBUG && e.code === 'Equal') { game.credits += 500; hud.notice('debug: +500 credits'); }
});

addEventListener('mousedown', (e) => {
  if (!locked() || game.state !== 'play') return;
  if (e.button === 0) carry.click(game.eff);
  else if (e.button === 2) carry.drop(game.eff);
});
addEventListener('wheel', (e) => {
  if (locked() && game.state === 'play' && Math.abs(e.deltaY) > 0) carry.cycle(e.deltaY > 0 ? 1 : -1);
}, { passive: true });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (locked() && (game.state === 'play' || game.state === 'storm')) player.look(e.movementX, e.movementY);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
addEventListener('beforeunload', () => { if (['play', 'paused', 'menu'].includes(game.state)) writeSave(saveCtx); });

// Dev only (?debug): shelve everything except 5 loose items to test the ending.
function debugShelve() {
  const loose = items.all.filter((i) => i.state === 'loose');
  for (const item of loose.slice(0, -5)) carry.place(item);
  hud.notice(`debug: shelved ${Math.max(0, loose.length - 5)} items`);
}

// ---------- loop ----------
const MAX_STEPS = 5;
let acc = 0;
let last = performance.now();
let frameN = 0;
let t = 0;
let autosaveAt = 60;
let fpsFrames = 0, fpsT = 0;
const wakers = [];
let musicOn = false, ducked = false;
player.onStep = (land) => sfx.step(land);

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
  last = now;
  t += dt;
  frameN++;
  fpsFrames++; fpsT += dt;
  if (fpsT >= 0.5) { if (settings.showFps) hud.fps(true, Math.round(fpsFrames / fpsT)); fpsFrames = 0; fpsT = 0; }
  const st = game.state;

  if (st === 'play' || st === 'storm' || st === 'menu' || st === 'win') {
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      player.step(STEP, {
        speedMult: game.eff.speedMult * (cart.pushing ? 0.9 : 1),
        unlimitedSprint: game.eff.unlimitedSprint,
        frozen: st !== 'play',
      });
      cart.step(player, store.bounds);
      world.step();
      if (st === 'play') carry.checkTrickShots(game.eff);
      acc -= STEP;
      steps++;
    }
    // too far behind: drop the backlog but keep the interpolation fraction valid
    if (acc >= STEP) acc %= STEP;
    wakers.length = 0;
    if (cart.pushing) wakers.push(cart.pos);
    items.manage(wakers);
  }

  if (st === 'storm') storm.update(dt);
  items.sync(store.bounds, rescue);
  cart.syncMesh(acc / STEP);
  if (st === 'title') {
    // slow flyover of the store behind the title screen
    const a = t * 0.06;
    camera.position.set(Math.sin(a) * 13, 3.8, store.heap.cz + Math.cos(a) * 11);
    camera.lookAt(0, 1, store.heap.cz);
  } else {
    player.updateCamera(acc / STEP, dt);
    // sprinting widens the view a little
    const fov = settings.fov + (player.sprinting ? 7 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 8); camera.updateProjectionMatrix(); }
    carry.sway(player, t);
  }

  // music plays everywhere except the tornado and the win screen; quieter in menus
  const wantMusic = st !== 'storm' && st !== 'win';
  if (wantMusic && !musicOn) musicOn = musicStart(); // no-op until audio is unlocked by a click
  else if (!wantMusic && musicOn) { musicStop(); musicOn = false; }
  const wantDuck = st !== 'play';
  if (wantDuck !== ducked) { ducked = wantDuck; duckMusic(wantDuck); }

  if (st === 'play') {
    game.time += dt;
    carry.aim(game.eff);
    carry.updateScanner(game.eff, t);
    coworker.update(dt);
    if (game.eff.radar && frameN % 10 === 0) {
      const target = carry.radarTarget();
      if (target) {
        const dx = target.x - player.pos.x, dz = target.z - player.pos.z;
        let rel = Math.atan2(-dx, -dz) - player.yaw;
        rel = Math.atan2(Math.sin(rel), Math.cos(rel));
        hud.radar(-rel - Math.PI / 2, Math.hypot(dx, dz));
      } else hud.radar(null);
    } else if (!game.eff.radar) hud.radar(null);
    if (frameN % 20 === 0) hud.renderChecklist();
    if (game.time >= autosaveAt) { autosaveAt = game.time + 60; writeSave(saveCtx); }
  }
  if (st === 'play' || st === 'menu') {
    gm.update(t, game.credits >= cheapestAvailable(game.owned), player.pos);
    hud.update(game, player, game.eff);
  }
  renderer.render(scene, camera);
}

$('loading').hidden = true;
refreshTitle();
show('title');
requestAnimationFrame(frame);

if (DEBUG) window.__game = { game, items, carry, cart, player, store, products, renderer, scene, camera, storm, hud, coworker };
