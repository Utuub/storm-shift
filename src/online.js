import * as THREE from 'three';
import { SECTIONS } from './catalog.js';
import { Avatar, escapeHTML } from './avatars.js';
import { sfx } from './audio.js';

// Online "Crew Shift": 2-6 workers clean up the same wrecked store together.
//
// How it stays in sync:
// - Socket.IO to the Node server (server/server.js). The server decides who
//   owns each item, so two players can't both end up holding the same can.
// - Every client builds the same tornado pile from a shared random seed. The
//   host then reports where the pile physically settled so everyone matches.
// - When you throw or knock items loose, your client reports where they land.
// - Each player sends their position, look direction, crouch, what they're
//   holding, their cart, and whether they're stunned, 15 times a second.

const $ = (id) => document.getElementById(id);
const COLORS = ['#e2483d', '#3d8bff', '#4cd964', '#ffc53d', '#b45cff', '#ff8a3d'];
const PROFILE_KEY = 'stormshift.profile.v1';
const SEND_HZ = 15;
const STUN_TIME = 1.6;
const SIZES = {
  rush: { label: 'Rush', sections: 2, desc: '2 sections' },
  quick: { label: 'Quick', sections: 5, desc: '5 sections' },
  half: { label: 'Half Store', sections: 10, desc: '10 sections' },
  full: { label: 'Full Store', sections: 20, desc: 'all 1,500 items' },
};

// Small seeded random number generator so every client builds the same tornado.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r3 = (n) => Math.round(n * 1000) / 1000;

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch { return {}; }
}
function saveProfile(p) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

// Center-crop an uploaded photo to a small square JPEG for the avatar's face.
function photoToFace(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 128, 128);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('not an image')); };
    img.src = url;
  });
}

export class Online {
  // ctx: game objects from main.js plus a few main.js functions (see main.js)
  constructor(ctx) {
    Object.assign(this, ctx);
    this.socket = null;
    this.id = null;
    this.room = null;           // latest lobby state from the server
    this.peers = new Map();     // id -> Avatar
    this.info = new Map();      // id -> { name, color } (survives the avatar)
    this.stockQ = [];
    this.trickQ = [];
    this.restQ = [];
    this.thrown = new Set();
    this.sendT = 0;
    this.flushT = 0;
    this.statsT = 0;
    this.lastStats = '';
    this.shiftSize = 'quick';
    this.profile = { name: '', color: COLORS[0], face: null, room: 'STORE', ...loadProfile() };
    this.items.onRest = (item) => this.queueRest(item);
    this.buildLobbyUI();
  }

  get active() { return !!this.socket && this.game.online; }
  get isHost() { return this.room?.hostId === this.id; }
  nameOf(id) {
    if (id === this.id) return '<b>You</b>';
    const i = this.info.get(id);
    return i ? `<b style="color:${i.color}">${escapeHTML(i.name)}</b>` : 'Someone';
  }

  // ---------- lobby screen ----------
  buildLobbyUI() {
    $('lb-colors').innerHTML = COLORS.map((c) => `<button class="swatch-btn" data-color="${c}" style="background:${c}" aria-label="apron color ${c}"></button>`).join('');
    $('lb-colors').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      sfx.click();
      this.profile.color = b.dataset.color;
      this.renderProfile();
    });
    $('lb-face').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        this.profile.face = await photoToFace(file);
        this.status('Looking good.');
      } catch { this.status("That file isn't an image I can read.", true); }
      this.renderProfile();
    });
    $('lb-face-clear').addEventListener('click', () => { sfx.click(); this.profile.face = null; this.renderProfile(); });
    $('lb-join').addEventListener('click', () => this.join());
    $('lb-back').addEventListener('click', () => { sfx.click(); this.toTitle(); });
    $('lb-leave').addEventListener('click', () => { sfx.click(); this.leave(); });
    $('lb-start').addEventListener('click', () => this.hostStart());
    $('lb-sizes').innerHTML = Object.entries(SIZES).map(([k, s]) =>
      `<button class="size-btn" data-size="${k}"><b>${s.label}</b><small>${s.desc}</small></button>`).join('');
    $('lb-sizes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-size]');
      if (!b) return;
      sfx.click();
      this.shiftSize = b.dataset.size;
      this.renderRoom();
    });
    for (const id of ['lb-name', 'lb-room']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join(); });
    $('lb-url').textContent = location.origin;
  }

  renderProfile() {
    const p = this.profile;
    document.querySelectorAll('#lb-colors .swatch-btn').forEach((b) => b.classList.toggle('on', b.dataset.color === p.color));
    const prev = $('lb-face-prev');
    prev.style.borderColor = p.color;
    prev.style.backgroundImage = p.face ? `url(${p.face})` : '';
    prev.classList.toggle('empty', !p.face);
    $('lb-face-clear').hidden = !p.face;
  }

  status(msg, bad = false) {
    const s = $('lb-status');
    s.textContent = msg;
    s.classList.toggle('bad', bad);
  }

  // Title screen -> lobby
  async open() {
    this.show('lobby');
    this.game.state = 'lobby';
    $('lb-name').value = this.profile.name || '';
    $('lb-room').value = this.profile.room || 'STORE';
    this.renderProfile();
    $('lobby-join').hidden = !!this.socket;
    $('lobby-room').hidden = !this.socket;
    if (this.socket) return this.renderRoom();
    this.status('');
    $('lb-join').disabled = false;
    if (!this.io) {
      try {
        // served by the Socket.IO server; missing on a static host like GitHub Pages
        this.io = (await import('/socket.io/socket.io.esm.min.js')).io;
      } catch {
        $('lb-join').disabled = true;
        this.status('Online play needs the Storm Shift server. Start it with "docker compose up" (or "npm start") and open http://localhost:3000. See the README.', true);
      }
    }
  }

  join() {
    if (!this.io || this.socket || this.joining) return;
    sfx.click();
    const name = $('lb-name').value.trim().slice(0, 16);
    if (!name) { this.status('Put your name on your name tag first.', true); $('lb-name').focus(); return; }
    const room = ($('lb-room').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'STORE').slice(0, 12);
    Object.assign(this.profile, { name, room });
    saveProfile(this.profile);
    this.status('Clocking in…');
    this.joining = true;
    const socket = this.io({ transports: ['websocket', 'polling'], reconnection: false, timeout: 6000 });
    socket.on('connect_error', () => {
      this.joining = false;
      socket.close();
      this.status("Can't reach the server.", true);
    });
    socket.on('connect', () => {
      socket.emit('join', { room, name, color: this.profile.color, face: this.profile.face }, (res) => {
        this.joining = false;
        if (!res?.ok) { socket.close(); return this.status(res?.error || 'Could not join.', true); }
        this.socket = socket;
        this.id = res.id;
        this.profile.color = res.color;
        this.status('');
        $('lobby-join').hidden = true;
        $('lobby-room').hidden = false;
      });
    });
    this.wire(socket);
  }

  renderRoom() {
    const r = this.room;
    if (!r) return;
    $('lb-code').textContent = r.code;
    $('lb-players').innerHTML = r.players.map((p) => `
      <div class="crew-card" style="--c:${p.color}">
        <div class="crew-face${p.face ? '' : ' empty'}" style="${p.face ? `background-image:url(${p.face})` : ''}"></div>
        <div class="crew-name">${escapeHTML(p.name)}${p.id === this.id ? ' <small>(you)</small>' : ''}</div>
        ${p.id === r.hostId ? '<div class="crew-tag">HOST</div>' : ''}
      </div>`).join('');
    const host = this.isHost;
    $('lb-host').hidden = !host;
    $('lb-wait').hidden = host;
    $('lb-wait').textContent = r.phase === 'playing' ? 'A shift is already running. Hang on…' : 'Waiting for the host to start the shift…';
    document.querySelectorAll('#lb-sizes .size-btn').forEach((b) => b.classList.toggle('on', b.dataset.size === this.shiftSize));
    $('lb-start').textContent = r.players.length < 2 ? 'Start Solo (others can join late)' : `Start Shift (${r.players.length} workers)`;
  }

  hostStart() {
    if (!this.isHost) return;
    sfx.click();
    // the host's click is the user gesture that allows mouse capture
    this.goFullscreen();
    this.lock();
    const seed = (Math.random() * 2 ** 32) >>> 0;
    const rand = mulberry32(seed ^ 0x9e3779b9);
    const order = SECTIONS.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const chosen = order.slice(0, SIZES[this.shiftSize].sections).sort((a, b) => a - b);
    const set = new Set(chosen.map((i) => SECTIONS[i]));
    const ids = this.items.all.filter((it) => set.has(it.p.section)).map((it) => it.id);
    this.socket.emit('start', { seed, sections: chosen, ids, size: this.shiftSize });
  }

  leave() {
    if (this.socket) { this.socket.emit('leave'); this.socket.close(); }
    this.cleanup();
    this.toTitle();
  }

  cleanup() {
    this.socket = null;
    this.room = null;
    this.id = null;
    for (const a of this.peers.values()) a.dispose();
    this.peers.clear();
    this.carry.peerByHandle.clear();
    this.carry.net = null;
    this.storm.reportPile = false;
    this.thrown.clear();
    this.stockQ = []; this.trickQ = []; this.restQ = [];
    this.game.online = false;
    this.hud.board(null);
  }

  // ---------- peers ----------
  syncPeers(list) {
    const ids = new Set(list.map((p) => p.id));
    for (const p of list) {
      this.info.set(p.id, { name: p.name, color: p.color });
      if (p.id === this.id || this.peers.has(p.id)) continue;
      const a = new Avatar(this.scene, p, this.products);
      this.peers.set(p.id, a);
      this.carry.peerByHandle.set(a.handle, a);
    }
    for (const [id, a] of this.peers) {
      if (ids.has(id)) continue;
      this.carry.peerByHandle.delete(a.handle);
      a.dispose();
      this.peers.delete(id);
    }
  }

  // ---------- socket events ----------
  wire(socket) {
    const items = this.items.all;
    const { carry, game, hud } = this;

    socket.on('disconnect', () => {
      if (!this.socket) return; // we left on purpose
      const wasPlaying = this.game.online;
      this.cleanup();
      if (wasPlaying) { this.toTitle(); this.hud.show(false); }
      this.open();
      this.status('Lost the connection to the server.', true);
    });

    socket.on('lobby', (r) => {
      this.room = r;
      if (this.game.online) this.syncPeers(r.players);
      if (this.game.state === 'lobby') this.renderRoom();
    });

    socket.on('start', (d) => {
      this.beginShift(d, false);
    });

    socket.on('sync', (d) => {
      // joined while a shift was running
      this.beginShift(d, true);
    });

    socket.on('peer-join', (p) => {
      if (!this.game.online) return;
      this.syncPeers([...(this.room?.players || []).filter((x) => x.id !== p.id), p]);
      hud.notice(`${this.nameOf(p.id)} clocked in.`);
    });

    socket.on('state', (s) => this.peers.get(s.id)?.apply(s));

    socket.on('taken', ({ id, ids }) => {
      if (!this.game.online) return;
      let lost = 0;
      for (const n of ids) {
        const item = items[n];
        if (!item) continue;
        if (carry.lose(item)) lost++;
        if (item.state !== 'shelved') this.items.take(item, 'remote', false);
      }
      if (lost) hud.notice(`${this.nameOf(id)} grabbed that first!`, 'bad');
    });

    socket.on('denied', (list) => {
      for (const [n, owner] of list) {
        const item = items[n];
        if (!item) continue;
        carry.lose(item);
        if (owner === 'S') carry.placeRemote(item, 'a coworker');
        else if (item.state !== 'shelved') { this.items.removeBody(item); item.state = 'remote'; this.items.hide(item); }
      }
    });

    socket.on('shelved', ({ id, ids }) => {
      if (!this.game.online) return;
      const who = this.nameOf(id).replace(/<[^>]+>/g, '');
      for (const n of ids) if (items[n]) carry.placeRemote(items[n], who);
    });

    socket.on('thrown', ({ id, item: n, p, q, v }) => {
      const item = items[n];
      if (!item || !this.game.online) return;
      carry.lose(item);
      this.items.makeLoose(item, new THREE.Vector3(...p), new THREE.Quaternion(...q).normalize(), new THREE.Vector3(...v), null);
      this.peers.get(id)?.playThrow();
    });

    socket.on('rest', (flat) => {
      if (!this.game.online) return;
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      for (let i = 0; i < flat.length; i += 8) {
        const item = items[flat[i]];
        if (!item || item.state !== 'loose') continue;
        pos.set(flat[i + 1], flat[i + 2], flat[i + 3]);
        quat.set(flat[i + 4], flat[i + 5], flat[i + 6], flat[i + 7]).normalize();
        this.items.freezeAt(item, pos, quat);
      }
    });

    socket.on('given', ({ from, item: n }) => {
      const item = items[n];
      if (!item || !this.game.online) return;
      item.state = 'held';
      carry.hand.push(item);
      carry.sel = carry.hand.length - 1;
      sfx.pickup();
      hud.notice(`${this.nameOf(from)} handed you <b>${item.p.name}</b>`, 'good');
      if (carry.hand.length > game.eff.carry) {
        // hands already full: it falls at your feet
        carry.drop(null);
        hud.notice('Your hands were full, so it fell.', 'bad');
      }
      carry.refreshHeld();
    });

    socket.on('bonked', ({ by, item: n }) => {
      if (!this.game.online) return;
      this.stun = STUN_TIME;
      this.player.shake = 0.8;
      sfx.buzz();
      hud.flash('bad');
      hud.popup('BONKED!', 'bad');
      const what = items[n] ? ` with <b>${items[n].p.name}</b>` : '';
      hud.notice(`${this.nameOf(by)} beaned you${what}!`, 'bad');
      game.combo = 0;
      // it knocks whatever you're holding out of your hands
      if (carry.selected) carry.drop(null);
    });

    socket.on('feed', (f) => {
      if (!this.game.online) return;
      const it = items[f.item]?.p.name || 'something';
      if (f.kind === 'bonk') {
        if (f.by !== this.id && f.to !== this.id) hud.feed(`${this.nameOf(f.by)} bonked ${this.nameOf(f.to)} with ${escapeHTML(it)}`);
        else if (f.by === this.id) hud.feed(`You bonked ${this.nameOf(f.to)} with ${escapeHTML(it)}`);
        else hud.feed(`${this.nameOf(f.by)} bonked you with ${escapeHTML(it)}`);
      } else if (f.kind === 'give' && f.to !== this.id) {
        hud.feed(`${this.nameOf(f.by)} handed ${escapeHTML(it)} to ${this.nameOf(f.to)}`);
      }
    });

    socket.on('left', ({ id, ids, at }) => {
      if (!this.game.online) return;
      hud.notice(`${this.nameOf(id)} clocked out.`);
      // whatever they held lands where they stood (same spot on every screen)
      const q = new THREE.Quaternion();
      const base = at || [0, 0.9, -7];
      ids.forEach((n, i) => {
        const item = items[n];
        if (!item || item.state === 'shelved') return;
        carry.lose(item);
        const pos = new THREE.Vector3(base[0] + ((i % 4) - 1.5) * 0.28, item.p.fp.h / 2 + 0.01, base[2] + (Math.floor(i / 4) - 1) * 0.28);
        this.items.freezeAt(item, pos, q);
      });
      const a = this.peers.get(id);
      if (a) { this.carry.peerByHandle.delete(a.handle); a.dispose(); this.peers.delete(id); }
    });

    socket.on('board', (b) => {
      this.boardData = b;
      hud.board(b, this.id);
    });

    socket.on('win', (d) => {
      this.flush(true);
      this.onWin(d);
    });
  }

  beginShift(d, late) {
    this.room = this.room || { players: d.players };
    this.syncPeers(d.players);
    for (const a of this.peers.values()) { a.seen = false; a.group.visible = false; }
    this.thrown.clear();
    this.stockQ = []; this.trickQ = []; this.restQ = [];
    this.stun = 0;
    this.carry.net = this;
    const me = d.players.find((p) => p.id === this.id);
    this.startShift({
      seed: d.seed, ids: d.ids, late, slot: me?.slot ?? 0,
      isHost: this.room.hostId === this.id, sync: late ? d : null,
    });
    this.hud.board(this.boardData || null, this.id);
  }

  // ---------- outgoing (called by carry.js) ----------
  grab(ids) { this.socket?.emit('grab', { ids }); }

  stocked(item, trick) {
    (trick ? this.trickQ : this.stockQ).push(item.id);
  }

  release(item, pos, quat, vel) {
    if (!this.socket) return;
    this.socket.emit('release', {
      id: item.id, p: [pos.x, pos.y, pos.z].map(r3), q: [quat.x, quat.y, quat.z, quat.w].map(r3), v: [vel.x, vel.y, vel.z].map(r3),
    });
    this.thrown.add(item);
  }

  give(to, item) { this.socket?.emit('give', { to, item: item.id }); }

  queueRest(item) {
    if (!this.active) return;
    const p = item.restPos, q = item.restQuat;
    this.restQ.push(item.id, r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w));
  }

  flush(force = false) {
    const s = this.socket;
    if (!s) return;
    if (this.stockQ.length) { s.emit('stock', { ids: this.stockQ, score: this.game.score }); this.stockQ = []; }
    if (this.trickQ.length) { s.emit('stock', { ids: this.trickQ, score: this.game.score, trick: true }); this.trickQ = []; }
    if (this.restQ.length) {
      // big pile reports go in chunks so one message stays small
      const chunk = force ? this.restQ.length : 8 * 300;
      s.emit('rest', this.restQ.splice(0, chunk));
    }
  }

  // ---------- per frame ----------
  update(dt, t) {
    if (!this.active) return;
    for (const a of this.peers.values()) a.update(dt, t);
    if (this.stun > 0) {
      this.stun -= dt;
      this.player.shake = Math.max(0, this.stun / STUN_TIME) * 0.5;
      if (this.stun <= 0) this.player.shake = 0;
    }
    this.checkBonks();

    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / SEND_HZ;
      const { player, carry, cart } = this;
      const sel = carry.selected;
      const hand = sel ? [sel, ...carry.hand.filter((i) => i !== sel)] : carry.hand;
      this.socket.volatile.emit('state', {
        p: [r3(player.pos.x), r3(player.pos.y), r3(player.pos.z)],
        yaw: r3(player.yaw), pitch: r3(player.pitch), cr: player.crouch > 0.5 ? 1 : 0,
        h: hand.slice(0, 6).map((i) => i.p.id),
        c: cart.active ? [r3(cart.pos.x), r3(cart.pos.z), r3(cart.yaw), cart.items.length, cart.cap] : 0,
        st: this.stun > 0 ? 1 : 0,
      });
    }
    this.flushT -= dt;
    if (this.flushT <= 0) { this.flushT = 0.1; this.flush(); }
    this.statsT -= dt;
    if (this.statsT <= 0) {
      this.statsT = 1;
      const s = `${this.game.score}|${this.game.wrong}`;
      if (s !== this.lastStats) { this.lastStats = s; this.socket.emit('stats', { score: this.game.score, wrong: this.game.wrong }); }
    }
  }

  // Our thrown items that fly into another player bonk them.
  checkBonks() {
    if (!this.thrown.size) return;
    const now = performance.now();
    const p = new THREE.Vector3();
    for (const item of this.thrown) {
      if (item.state !== 'loose' || !item.body || now - (item.thrownAt || 0) > 3000) { this.thrown.delete(item); continue; }
      const v = item.body.linvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z < 2.5) continue;
      const t = item.body.translation();
      p.set(t.x, t.y, t.z);
      for (const a of this.peers.values()) {
        if (a.stunned || !a.hitBy(p)) continue;
        this.socket.emit('bonk', { target: a.id, item: item.id });
        a.stunned = true; // shows stars right away; their next update confirms
        this.thrown.delete(item);
        sfx.ding(10);
        this.hud.popup('BONK!', 'good');
        break;
      }
    }
  }

  get frozen() { return this.stun > 0; }
}
