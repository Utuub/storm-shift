// Storm Shift game server.
// Serves the game files and runs the online "Crew Shift" mode over Socket.IO.
//
// The server is the referee for who owns each item: an item is loose (null),
// shelved ('S'), or held by one player (that player's socket id). Clients act
// right away on their own screen and tell the server; the server accepts or
// denies and forwards the result to everyone else in the room.
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 6;
const TOTAL_ITEMS = 1500;
const COLORS = ['#e2483d', '#3d8bff', '#4cd964', '#ffc53d', '#b45cff', '#ff8a3d'];

// ---------- static files ----------
const app = express();
app.disable('x-powered-by');
const noCache = (res) => res.set('Cache-Control', 'no-store');
app.get('/', (req, res) => { noCache(res); res.sendFile(path.join(ROOT, 'index.html')); });
app.get('/style.css', (req, res) => { noCache(res); res.sendFile(path.join(ROOT, 'style.css')); });
app.use('/src', express.static(path.join(ROOT, 'src'), { setHeaders: noCache }));
app.use('/assets', express.static(path.join(ROOT, 'assets'), { setHeaders: noCache }));
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

const http = createServer(app);
const io = new Server(http, { maxHttpBufferSize: 2e5 });

// ---------- rooms ----------
const rooms = new Map();

function makeRoom(code) {
  return {
    code, hostId: null, phase: 'lobby', players: new Map(),
    owners: [], shift: null, total: 0, done: 0, seed: 0, sections: [], size: 'quick',
    rests: new Map(), startedAt: 0, boardTimer: null, lastBoard: '',
  };
}

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const isInt = (n) => Number.isInteger(n) && n >= 0 && n < TOTAL_ITEMS;
const nums = (a, n) => Array.isArray(a) && a.length === n && a.every((x) => typeof x === 'number' && Number.isFinite(x));

function publicPlayer(p) {
  return { id: p.id, name: p.name, color: p.color, face: p.face, slot: p.slot };
}

function lobbyState(room) {
  return {
    code: room.code, hostId: room.hostId, phase: room.phase, size: room.size,
    players: [...room.players.values()].map(publicPlayer),
  };
}

function board(room) {
  return [...room.players.values()]
    .map((p) => ({ id: p.id, name: p.name, color: p.color, shelved: p.shelved, score: p.score, bonks: p.bonks, bonked: p.bonked, tricks: p.tricks, wrong: p.wrong, gives: p.gives }))
    .sort((a, b) => b.shelved - a.shelved || b.score - a.score);
}

// Leaderboard updates are batched to at most 4 per second per room.
function sendBoard(room) {
  if (room.boardTimer) return;
  room.boardTimer = setTimeout(() => {
    room.boardTimer = null;
    const b = { done: room.done, total: room.total, players: board(room) };
    const s = JSON.stringify(b);
    if (s === room.lastBoard) return;
    room.lastBoard = s;
    io.to(room.code).emit('board', b);
  }, 250);
}

function resetStats(p) {
  Object.assign(p, { shelved: 0, score: 0, bonks: 0, bonked: 0, tricks: 0, wrong: 0, gives: 0, lastBonkAt: 0 });
}

// The lowest free spawn slot, so players don't stand inside each other.
function freeSlot(room) {
  const used = new Set([...room.players.values()].map((p) => p.slot));
  for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i;
  return 0;
}

function syncPayload(room) {
  // owners: 0 = loose, 1 = shelved, otherwise the holder's id
  return {
    seed: room.seed, sections: room.sections, ids: room.shift ? [...room.shift] : [],
    owners: room.owners.map((o) => (o === null ? 0 : o === 'S' ? 1 : o)),
    rests: [...room.rests.entries()].flatMap(([id, r]) => [id, ...r]),
    elapsed: (Date.now() - room.startedAt) / 1000,
  };
}

io.on('connection', (socket) => {
  let room = null;
  let me = null;

  socket.on('join', (data, reply = () => {}) => {
    if (room) return reply({ ok: false, error: 'Already in a room.' });
    const code = clean(data?.room, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'STORE';
    const name = clean(data?.name, 16) || 'Worker';
    let face = typeof data?.face === 'string' ? data.face : null;
    // custom avatar photo: a small JPEG data URL made by the client
    if (face && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(face) || face.length > 120000)) face = null;
    let r = rooms.get(code);
    if (!r) { r = makeRoom(code); rooms.set(code, r); }
    if (r.players.size >= MAX_PLAYERS) return reply({ ok: false, error: `Room ${code} is full (${MAX_PLAYERS} max).` });
    const taken = new Set([...r.players.values()].map((p) => p.color));
    let color = COLORS.includes(data?.color) ? data.color : COLORS[0];
    if (taken.has(color)) color = COLORS.find((c) => !taken.has(c)) || color;

    room = r;
    me = { id: socket.id, name, color, face, slot: freeSlot(r), last: null };
    resetStats(me);
    r.players.set(socket.id, me);
    if (!r.hostId) r.hostId = socket.id;
    socket.join(code);
    reply({ ok: true, id: socket.id, color });
    io.to(code).emit('lobby', lobbyState(r));
    if (r.phase === 'playing') {
      // late joiner: hand over the whole shift so far
      socket.emit('sync', { ...syncPayload(r), players: [...r.players.values()].map(publicPlayer) });
      socket.to(code).emit('peer-join', publicPlayer(me));
      sendBoard(r);
    }
  });

  const inGame = () => room && me && room.phase === 'playing';

  // Host starts a shift. The host's client picks which sections the tornado hits
  // (seeded) and sends the item ids; every client then builds the same pile.
  socket.on('start', (data) => {
    if (!room || room.hostId !== socket.id || room.phase === 'playing') return;
    const ids = Array.isArray(data?.ids) ? [...new Set(data.ids.filter(isInt))] : [];
    if (!ids.length) return;
    room.seed = Number(data.seed) >>> 0;
    room.sections = Array.isArray(data.sections) ? data.sections.filter((n) => Number.isInteger(n)).slice(0, 40) : [];
    room.size = clean(data.size, 10) || 'quick';
    room.shift = new Set(ids);
    room.owners = Array.from({ length: TOTAL_ITEMS }, (_, i) => (room.shift.has(i) ? null : 'S'));
    room.total = ids.length;
    room.done = 0;
    room.rests.clear();
    room.phase = 'playing';
    room.startedAt = Date.now();
    for (const p of room.players.values()) resetStats(p);
    io.to(room.code).emit('start', {
      seed: room.seed, sections: room.sections, ids, size: room.size,
      players: [...room.players.values()].map(publicPlayer),
    });
    io.to(room.code).emit('lobby', lobbyState(room));
    sendBoard(room);
  });

  // Back to the lobby after a shift (host only).
  socket.on('to-lobby', () => {
    if (!room || room.hostId !== socket.id) return;
    room.phase = 'lobby';
    io.to(room.code).emit('lobby', lobbyState(room));
  });

  // Player transform + what they're doing, ~15 times a second. Relayed as-is.
  socket.on('state', (s) => {
    if (!inGame() || !s || !nums(s.p, 3)) return;
    me.last = s.p;
    socket.volatile.to(room.code).emit('state', { id: socket.id, ...s });
  });

  socket.on('grab', (data) => {
    if (!inGame() || !Array.isArray(data?.ids)) return;
    const ok = [], denied = [];
    for (const id of data.ids) {
      if (!isInt(id)) continue;
      if (room.owners[id] === null) { room.owners[id] = socket.id; room.rests.delete(id); ok.push(id); }
      else if (room.owners[id] !== socket.id) denied.push([id, room.owners[id]]);
    }
    if (ok.length) socket.to(room.code).emit('taken', { id: socket.id, ids: ok });
    if (denied.length) socket.emit('denied', denied);
  });

  socket.on('stock', (data) => {
    if (!inGame() || !Array.isArray(data?.ids)) return;
    const ok = [];
    for (const id of data.ids) {
      if (!isInt(id) || !room.shift.has(id)) continue;
      const o = room.owners[id];
      // null = a thrown item that landed in its own spot (Trick Shot)
      if (o === socket.id || o === null) { room.owners[id] = 'S'; room.rests.delete(id); ok.push(id); }
    }
    if (typeof data.score === 'number') me.score = Math.max(0, Math.floor(data.score));
    if (data.trick) me.tricks += ok.length;
    if (!ok.length) return;
    me.shelved += ok.length;
    room.done += ok.length;
    socket.to(room.code).emit('shelved', { id: socket.id, ids: ok });
    sendBoard(room);
    if (room.done >= room.total) {
      room.phase = 'done';
      const time = (Date.now() - room.startedAt) / 1000;
      clearTimeout(room.boardTimer); room.boardTimer = null;
      io.to(room.code).emit('win', { time, total: room.total, players: board(room) });
      io.to(room.code).emit('lobby', lobbyState(room));
    }
  });

  // Dropped or thrown: the item is loose again. Others replay the same throw.
  socket.on('release', (d) => {
    if (!inGame() || !isInt(d?.id) || room.owners[d.id] !== socket.id) return;
    if (!nums(d.p, 3) || !nums(d.q, 4) || !nums(d.v, 3)) return;
    room.owners[d.id] = null;
    socket.to(room.code).emit('thrown', { id: socket.id, item: d.id, p: d.p, q: d.q, v: d.v });
  });

  // Where loose items came to rest on the reporting player's screen, as a flat
  // list [id, x, y, z, qx, qy, qz, qw, ...]. Everyone else snaps to it.
  socket.on('rest', (flat) => {
    if (!inGame() || !Array.isArray(flat) || flat.length % 8 || flat.length > 8 * TOTAL_ITEMS) return;
    const out = [];
    for (let i = 0; i < flat.length; i += 8) {
      const id = flat[i];
      const r = flat.slice(i + 1, i + 8);
      if (!isInt(id) || room.owners[id] !== null || !nums(r, 7)) continue;
      room.rests.set(id, r);
      out.push(id, ...r);
    }
    if (out.length) socket.to(room.code).emit('rest', out);
  });

  // Hand the item you're holding to another player.
  socket.on('give', (d) => {
    if (!inGame() || !isInt(d?.item) || room.owners[d.item] !== socket.id) return;
    const to = room.players.get(d.to);
    if (!to) return;
    room.owners[d.item] = to.id;
    me.gives++;
    io.to(to.id).emit('given', { from: socket.id, item: d.item });
    io.to(room.code).emit('feed', { kind: 'give', by: socket.id, to: to.id, item: d.item });
    sendBoard(room);
  });

  // A thrown item hit another player. 2 s cooldown per target so it can't be spammed.
  socket.on('bonk', (d) => {
    if (!inGame() || !isInt(d?.item)) return;
    const target = room.players.get(d.target);
    if (!target || target.id === socket.id) return;
    const now = Date.now();
    if (now - target.lastBonkAt < 2000) return;
    target.lastBonkAt = now;
    target.bonked++;
    me.bonks++;
    io.to(target.id).emit('bonked', { by: socket.id, item: d.item });
    io.to(room.code).emit('feed', { kind: 'bonk', by: socket.id, to: target.id, item: d.item });
    sendBoard(room);
  });

  socket.on('stats', (d) => {
    if (!inGame() || !d) return;
    if (typeof d.score === 'number') me.score = Math.max(0, Math.floor(d.score));
    if (typeof d.wrong === 'number') me.wrong = Math.max(0, Math.floor(d.wrong));
    sendBoard(room);
  });

  function leave() {
    if (!room || !me) return;
    const r = room;
    r.players.delete(socket.id);
    socket.leave(r.code);
    // anything they were holding falls where they stood
    const ids = [];
    r.owners.forEach((o, i) => { if (o === socket.id) { r.owners[i] = null; ids.push(i); } });
    if (r.hostId === socket.id) r.hostId = r.players.keys().next().value ?? null;
    if (!r.players.size) {
      clearTimeout(r.boardTimer);
      rooms.delete(r.code);
    } else {
      io.to(r.code).emit('left', { id: socket.id, ids, at: me.last });
      io.to(r.code).emit('lobby', lobbyState(r));
      sendBoard(r);
    }
    room = null;
    me = null;
  }
  socket.on('leave', leave);
  socket.on('disconnect', leave);
});

http.listen(PORT, () => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal).map((n) => `http://${n.address}:${PORT}`);
  console.log(`Storm Shift server running.\n  This computer: http://localhost:${PORT}`);
  // inside Docker the addresses above are the container's, not the computer's
  if (process.env.IN_DOCKER) console.log(`  Other computers on the same network: http://<this computer's IP address>:${PORT}`);
  else if (lan.length) console.log(`  Other computers on the same network: ${lan.join('  ')}`);
});
