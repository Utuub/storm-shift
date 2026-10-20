import * as THREE from 'three';
import { drawSlotTag } from './textures.js';

// Save game in localStorage: every item's state + transform, hand, cart,
// upgrades, score, timer, and where the player is standing.
const KEY = 'stormshift.save.v1';
const r3 = (n) => Math.round(n * 1000) / 1000;

export function readSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    const ok = d?.v === 1 && d.game && d.player && Array.isArray(d.items) && Array.isArray(d.hand);
    return ok ? d : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

export function writeSave(ctx) {
  const { game, items, carry, cart, player } = ctx;
  const data = {
    v: 1,
    savedAt: Date.now(),
    game: {
      credits: game.credits, score: game.score, shelved: game.shelved, wrong: game.wrong,
      combo: game.combo, time: game.time, owned: [...game.owned],
    },
    player: { x: r3(player.pos.x), y: r3(player.pos.y), z: r3(player.pos.z), yaw: r3(player.yaw), pitch: r3(player.pitch) },
    items: items.all.map((i) => {
      if (i.state === 'shelved') return 's';
      if (i.state === 'held') return 'h';
      if (i.state === 'cart') return 'c';
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      if (i.body) {
        const t = i.body.translation(), r = i.body.rotation();
        p.set(t.x, t.y, t.z); q.set(r.x, r.y, r.z, r.w);
      } else { p.copy(i.restPos); q.copy(i.restQuat); }
      return [r3(p.x), r3(p.y), r3(p.z), r3(q.x), r3(q.y), r3(q.z), r3(q.w)];
    }),
    hand: carry.hand.map((i) => i.id),
    cart: cart.active ? { x: r3(cart.pos.x), z: r3(cart.pos.z), yaw: r3(cart.yaw), items: cart.items.map((i) => i.id) } : null,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// Rebuild the world from a save. The caller resets everything first.
export function applySave(data, ctx) {
  const { game, items, carry, cart, player, products } = ctx;
  if (data.items.length !== items.all.length) throw new Error('save is from a different catalog');
  for (const p of products) p.placed = 0;
  const p3 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  items.all.forEach((item, idx) => {
    const s = data.items[idx];
    if (s === 's') items.shelve(item, item.p.placed++);
    else if (s === 'h' || s === 'c') items.take(item, s === 'h' ? 'held' : 'cart');
    else if (Array.isArray(s)) {
      p3.set(s[0], s[1], s[2]);
      q.set(s[3], s[4], s[5], s[6]).normalize();
      items.freezeAt(item, p3, q);
    }
  });
  for (const p of products) drawSlotTag(p.slot.tag, p);

  Object.assign(game, data.game, { owned: new Set(data.game.owned) });
  game.shelved = products.reduce((a, p) => a + p.placed, 0);
  carry.hand = data.hand.map((id) => items.all[id]).filter((i) => i && i.state === 'held');
  if (data.cart) {
    cart.spawn(new THREE.Vector3(data.cart.x, 0, data.cart.z), data.cart.yaw);
    cart.items = data.cart.items.map((id) => items.all[id]).filter((i) => i && i.state === 'cart');
  }
  player.teleport(new THREE.Vector3(data.player.x, data.player.y, data.player.z), data.player.yaw);
  player.pitch = data.player.pitch;
}
