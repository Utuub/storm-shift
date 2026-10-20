import * as THREE from 'three';
import { castRay, G } from './physics.js';
import { drawSlotTag } from './textures.js';
import { TOTAL_ITEMS } from './catalog.js';
import { sfx } from './audio.js';
import { keyLabel } from './settings.js';

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _a = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// Aiming, picking up, stocking shelves, dropping, and the cart controls.
export class Carry {
  constructor({ game, items, player, cart, gm, hud, camera, scene, store, settings, onWin, onMenu }) {
    Object.assign(this, { game, items, player, cart, gm, hud, camera, store, settings, onWin, onMenu });
    this.hand = [];
    this.target = null;
    this.slotByHandle = new Map(store.slots.map((s) => [s.collider.handle, s]));

    // held items render in the lower right of the view
    this.held = new THREE.Group();
    this.held.position.set(0.34, -0.36, -0.7);
    this.held.rotation.set(0.15, -0.5, 0);
    camera.add(this.held);

    // outline for the aimed-at shelf slot
    this.slotBox = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
      new THREE.LineBasicMaterial({ color: 0xffffff }),
    );
    this.slotBox.visible = false;
    scene.add(this.slotBox);

    // scanner upgrade: glowing boxes on the right slots for what you hold
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.28, depthWrite: false });
    this.glows = Array.from({ length: 12 }, () => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.glowMat);
      m.visible = false;
      scene.add(m);
      return m;
    });
  }

  reset() {
    this.hand = [];
    this.target = null;
    this.items.setHover(null);
    this.slotBox.visible = false;
    this.glows.forEach((g) => (g.visible = false));
    this.refreshHeld();
  }

  // ---------- aiming ----------
  aim(eff) {
    this.camera.getWorldPosition(_o);
    this.camera.getWorldDirection(_d);
    const reach = eff.reach;
    const h1 = castRay(_o, _d, reach + 1, G.STATIC | G.ITEM | G.CART | G.NPC);
    const h2 = castRay(_o, _d, reach + 0.5, G.SLOT | G.STATIC, true);

    let t = null;
    if (h1) {
      const hd = h1.collider.handle;
      const item = this.items.byHandle.get(hd);
      if (item && h1.dist <= reach) t = { type: 'item', item };
      else if (hd === this.cart.handle && h1.dist <= reach) t = { type: 'cart' };
      else if (hd === this.gm.collider.handle && h1.dist <= reach + 1) t = { type: 'gm' };
    }
    if (!t && h2) {
      const slot = this.slotByHandle.get(h2.collider.handle);
      if (slot) t = { type: 'slot', slot };
    }
    this.target = t;

    this.items.setHover(t?.type === 'item' ? t.item : null);
    this.slotBox.visible = t?.type === 'slot';
    if (t?.type === 'slot') {
      const s = t.slot;
      this.slotBox.position.copy(s.center);
      this.slotBox.scale.set(0.44, s.height - 0.02, s.width);
    }

    const k = (code) => `<kbd>${keyLabel(this.settings.binds[code])}</kbd>`;
    const lmb = '<kbd class="mouse">LMB</kbd>';
    if (!t) return this.hud.setAim('', '');
    if (t.type === 'item') {
      const full = this.hand.length >= eff.carry && !this.cartAccepts();
      this.hud.setAim(t.item.p.name, full ? '<span class="warn">Hands full</span>' : `${lmb} Grab`);
    } else if (t.type === 'slot') {
      const p = t.slot.product;
      const n = this.matching(p).length;
      const done = p.placed >= p.count;
      this.hud.setAim(`${p.name} <span class="count${done ? ' done' : ''}">${p.placed}/${p.count}</span>`,
        n ? `${lmb} Stock ${n}` : done ? '<span class="ok">Full</span>' : '');
    } else if (t.type === 'gm') {
      this.hud.setAim('Dale', `${k('interact')} Upgrades`);
    } else {
      this.hud.setAim(`Cart ${this.cart.items.length}/${this.cart.cap}`, `${k('interact')} Unload hands &nbsp; ${k('cart')} Push`);
    }
  }

  cartAccepts() {
    const c = this.cart;
    return c.active && c.items.length < c.cap && (c.pushing || c.near(this.player.pos, 4));
  }

  cartInRange(pos) {
    const c = this.cart;
    return c.active && (c.pushing || c.near(pos, 4));
  }

  matching(p) {
    const fromHand = this.hand.filter((i) => i.p === p);
    const fromCart = this.cartInRange(this.player.pos) ? this.cart.items.filter((i) => i.p === p) : [];
    return [...fromHand, ...fromCart];
  }

  // ---------- actions ----------
  // Left click: grab the item you're looking at, or stock the shelf spot.
  click(eff) {
    if (this.target?.type === 'slot') return this.stock(this.target.slot);
    if (this.target?.type !== 'item') return;
    const first = this.target.item;
    let list = [first];
    if (eff.grabber) {
      const fp = this.items.position(first, new THREE.Vector3());
      list = list.concat(first.p.items.filter((i) => i !== first && i.state === 'loose'
        && this.items.position(i, _a).distanceTo(fp) < 2));
    }
    let took = 0;
    for (const item of list) {
      if (this.hand.length < eff.carry) {
        this.items.take(item, 'held');
        this.hand.push(item);
      } else if (this.cartAccepts()) {
        this.items.take(item, 'cart');
        this.cart.items.push(item);
      } else break;
      took++;
    }
    if (!took) {
      sfx.buzz();
      this.hud.notice(this.cart.active ? 'Hands full! Bring your cart closer.' : 'Hands full! Go stock what you have.', 'bad');
      return;
    }
    sfx.pickup();
    this.cart.updateFill();
    this.refreshHeld();
  }

  // Interact key: talk to the GM or unload into the cart.
  use() {
    const t = this.target;
    if (!t) return;
    if (t.type === 'gm') this.onMenu();
    else if (t.type === 'cart') this.unloadToCart();
  }

  unloadToCart() {
    const room = this.cart.cap - this.cart.items.length;
    if (!this.hand.length) return this.hud.notice('Nothing in your hands.');
    if (room <= 0) { sfx.buzz(); return this.hud.notice('Cart is full!', 'bad'); }
    const moved = this.hand.splice(Math.max(0, this.hand.length - room));
    moved.forEach((i) => (i.state = 'cart'));
    this.cart.items.push(...moved);
    sfx.pickup();
    this.cart.updateFill();
    this.refreshHeld();
  }

  stock(slot) {
    const p = slot.product;
    const g = this.game;
    const list = this.matching(p);
    if (!list.length) {
      const holding = this.hand.length || (this.cartInRange(this.player.pos) && this.cart.items.length);
      if (!holding) return this.hud.notice('Your hands are empty.');
      g.wrong++;
      g.combo = 0;
      sfx.buzz();
      this.hud.flash('bad');
      this.hud.popup('WRONG SPOT!', 'bad');
      const top = this.hand[this.hand.length - 1];
      if (top) this.hud.notice(`That's the <b>${p.name}</b> spot. You're holding <b>${top.p.name}</b>.`, 'bad');
      return;
    }

    const set = new Set(list);
    this.hand = this.hand.filter((i) => !set.has(i));
    this.cart.items = this.cart.items.filter((i) => !set.has(i));
    const before = g.credits;
    for (const item of list) this.place(item);
    sfx.ding(Math.floor(g.combo / 5));
    this.hud.flash('good');
    this.hud.popup(`+${g.credits - before}`, 'good');
    this.cart.updateFill();
    this.refreshHeld();
  }

  // Put one item in its slot and pay out credits.
  place(item) {
    const g = this.game;
    const p = item.p;
    this.items.shelve(item, p.placed);
    p.placed++;
    g.shelved++;
    g.combo++;
    const pay = g.comboMult();
    g.credits += pay;
    g.score += pay;
    g.lastProduct = p;
    drawSlotTag(p.slot.tag, p);

    if (p.placed === p.count) {
      g.credits += 5; g.score += 5;
      const sec = p.section;
      if (sec.list.every((x) => x.placed === x.count)) {
        g.credits += 40; g.score += 40;
        sfx.complete();
        this.hud.banner(`${sec.name} restocked!`, '+40 bonus credits');
      }
    }
    if (g.shelved === TOTAL_ITEMS) this.onWin();
  }

  drop() {
    const item = this.hand.pop();
    if (!item) return;
    this.camera.getWorldPosition(_o);
    this.camera.getWorldDirection(_d);
    _o.addScaledVector(_d, 0.6);
    _q.setFromEuler(_e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
    this.items.makeLoose(item, _o, _q, _d.clone().multiplyScalar(3.5).add(new THREE.Vector3(0, 1, 0)), null);
    sfx.drop();
    this.refreshHeld();
  }

  toggleCart() {
    const c = this.cart;
    if (!c.active) return;
    if (c.pushing) {
      c.pushing = false;
      this.player.ignoreHandle = -1;
    } else if (c.near(this.player.pos, 2.6)) {
      c.pushing = true;
      this.player.ignoreHandle = c.handle;
    } else {
      this.hud.notice('Walk up to your cart to push it.');
    }
    this.refreshHeld();
  }

  // ---------- per-frame visuals ----------
  refreshHeld() {
    this.held.clear();
    let y = 0;
    for (const item of this.hand.slice(-6)) {
      const m = new THREE.Mesh(item.p.geometry, item.p.material);
      const h = item.p.fp.h;
      m.position.y = y + h / 2;
      y += h + 0.01;
      this.held.add(m);
    }
    this.held.position.y = -0.36 - Math.min(y, 0.5) * 0.4;
    this.hud.setHand(this.hand, this.game.eff.carry, this.cart);
  }

  updateScanner(eff, t) {
    const prods = eff.scanner ? [...new Set(this.hand.map((i) => i.p))] : [];
    this.glowMat.opacity = 0.18 + Math.sin(t * 5) * 0.1;
    this.glows.forEach((g, i) => {
      const p = prods[i];
      g.visible = !!p;
      if (p) {
        g.position.copy(p.slot.center);
        g.scale.set(0.46, p.slot.height, p.slot.width + 0.02);
      }
    });
  }

  // Radar upgrade: direction to the nearest loose item worth grabbing next.
  radarTarget() {
    const focus = this.hand.length ? this.hand[this.hand.length - 1].p : this.game.lastProduct;
    const loose = this.items.all.filter((i) => i.state === 'loose');
    if (!loose.length) return null;
    const pick = (list) => {
      let best = null, bd = Infinity;
      for (const i of list) {
        const t = this.items.position(i, _a);
        const d = (t.x - this.player.pos.x) ** 2 + (t.z - this.player.pos.z) ** 2;
        if (d < bd) { bd = d; best = { x: t.x, z: t.z }; }
      }
      return best;
    };
    return (focus && (pick(loose.filter((i) => i.p === focus))
      || pick(loose.filter((i) => i.p.section === focus.section)))) || pick(loose);
  }
}
