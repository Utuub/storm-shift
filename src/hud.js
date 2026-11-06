import { SECTIONS, TOTAL_ITEMS } from './catalog.js';
import { sfx } from './audio.js';

const $ = (id) => document.getElementById(id);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ESC[c]);

export const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

// Only touch the DOM when a value actually changes.
function setText(el, v) { if (el._v !== v) { el._v = v; el.textContent = v; } }
function setHTML(el, v) { if (el._v !== v) { el._v = v; el.innerHTML = v; } }

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'), shelved: $('hud-shelved'), bar: $('hud-bar'), credits: $('hud-credits'),
      score: $('hud-score'), time: $('hud-time'), combo: $('hud-combo'), aim: $('aim'),
      aimSub: $('aim-sub'), hand: $('hand'), cart: $('hud-cart'), stamina: $('stamina'),
      staminaFill: $('stamina-fill'), notices: $('notices'), flash: $('flash'),
      radar: $('radar'), radarArrow: $('radar-arrow'), radarDist: $('radar-dist'),
      checklist: $('checklist'), popups: $('popups'),
      banner: $('banner'), dialog: $('dialog'), dialogText: $('dialog-text'), fps: $('fps'),
      of: $('hud-of'), board: $('board'), feed: $('feed'),
    };
    this.total = TOTAL_ITEMS;
    this.typing = null;
  }

  show(on) { this.el.root.hidden = !on; }

  update(game, player, eff) {
    const e = this.el;
    setText(e.shelved, `${game.shelved}`);
    const w = `${(game.shelved / this.total) * 100}%`;
    if (e.bar._w !== w) { e.bar._w = w; e.bar.style.width = w; }
    setText(e.credits, String(game.credits));
    setText(e.score, String(game.score));
    setText(e.time, fmtTime(game.time));
    const mult = game.comboMult();
    setText(e.combo, mult > 1 ? `COMBO x${mult}` : '');
    e.stamina.hidden = eff.unlimitedSprint || player.stamina >= 1;
    const sw = `${Math.round(player.stamina * 100)}%`;
    if (e.staminaFill._w !== sw) { e.staminaFill._w = sw; e.staminaFill.style.width = sw; }
    e.staminaFill.classList.toggle('low', player.stamina < 0.2);
  }

  setAim(title, sub) {
    setHTML(this.el.aim, title);
    setHTML(this.el.aimSub, sub);
  }

  setHand(hand, cap, cart, sel = hand.length - 1) {
    const slots = [];
    for (let i = 0; i < cap; i++) {
      const item = hand[i];
      slots.push(item
        ? `<div class="hslot full${i === sel ? ' sel' : ''}" title="${item.p.name}"><span style="background:${item.p.color}"></span><em>${i + 1}</em></div>`
        : '<div class="hslot"></div>');
    }
    const cur = hand[sel];
    const hint = hand.length > 1 ? ' <small>scroll to switch</small>' : '';
    this.el.hand.innerHTML = `<div class="hand-label">${cur ? cur.p.name + hint : 'Empty hands'}</div><div class="hslots">${slots.join('')}</div>`;
    this.el.cart.hidden = !cart.active;
    if (cart.active) this.el.cart.innerHTML = `<b>CART</b> ${cart.items.length}/${cart.cap}${cart.pushing ? ' <i>pushing</i>' : ''}`;
  }

  // small game-style notice above the hotbar
  notice(html, kind = '') {
    const n = document.createElement('div');
    n.className = `notice ${kind}`;
    n.innerHTML = html;
    this.el.notices.prepend(n);
    while (this.el.notices.children.length > 3) this.el.notices.lastChild.remove();
    setTimeout(() => n.classList.add('out'), 2600);
    setTimeout(() => n.remove(), 3100);
  }

  // floating "+3" / "WRONG SPOT!" by the crosshair
  popup(text, kind) {
    const p = document.createElement('div');
    p.className = `popup ${kind}`;
    p.textContent = text;
    p.style.left = `${50 + (Math.random() - 0.5) * 6}%`;
    this.el.popups.append(p);
    setTimeout(() => p.remove(), 1100);
  }

  // big center banner for section complete etc.
  banner(title, sub) {
    const b = this.el.banner;
    b.innerHTML = `<div class="banner-title">${title}</div><div class="banner-sub">${sub}</div>`;
    b.className = '';
    void b.offsetWidth;
    b.className = 'show';
  }

  // RPG-style dialogue box with a typewriter effect
  say(text, ms = 6500) {
    const d = this.el.dialog;
    clearInterval(this.typing);
    clearTimeout(this.sayTimer);
    d.hidden = false;
    let i = 0;
    this.el.dialogText.textContent = '';
    this.typing = setInterval(() => {
      i += 2;
      this.el.dialogText.textContent = text.slice(0, i);
      if (i % 6 === 0 && document.pointerLockElement) sfx.blip(); // quiet while paused
      if (i >= text.length) clearInterval(this.typing);
    }, 30);
    this.sayTimer = setTimeout(() => { d.hidden = true; }, ms);
  }

  hideDialog() {
    clearInterval(this.typing);
    this.el.dialog.hidden = true;
  }

  flash(kind) {
    const f = this.el.flash;
    f.className = '';
    void f.offsetWidth;
    f.className = kind;
  }

  radar(angle, dist) {
    const r = this.el.radar;
    if (angle === null) { r.hidden = true; return; }
    r.hidden = false;
    this.el.radarArrow.style.transform = `rotate(${angle}rad)`;
    setText(this.el.radarDist, `${dist.toFixed(0)}m`);
  }

  toggleChecklist(force) {
    const c = this.el.checklist;
    c.hidden = force !== undefined ? !force : !c.hidden;
  }

  renderChecklist() {
    if (this.el.checklist.hidden) return;
    setHTML(this.el.checklist, '<h3>Store Checklist</h3>' + SECTIONS.map((s) => {
      const done = s.list.reduce((a, p) => a + p.placed, 0);
      const total = s.list.reduce((a, p) => a + p.count, 0);
      return `<div class="check-row ${done === total ? 'done' : ''}">
        <span class="swatch" style="background:${s.color}"></span>
        <span class="check-name">${s.name}</span><span class="check-bar"><i style="width:${(done / total) * 100}%"></i></span><span>${done}/${total}</span></div>`;
    }).join(''));
  }


  setTotal(n) {
    this.total = n;
    setText(this.el.of, `/ ${n.toLocaleString()} shelved`);
  }

  // Online leaderboard (top right). b = { done, total, players: [...] } or null to hide.
  board(b, me) {
    const el = this.el.board;
    el.hidden = !b;
    if (!b) { this.el.feed.innerHTML = ''; return; }
    setHTML(el, `<h3>Crew <span>${b.done}/${b.total}</span></h3>` + b.players.map((p, i) => `
      <div class="board-row${p.id === me ? ' me' : ''}"><span class="rank">${i + 1}</span><i style="background:${p.color}"></i>
      <span class="bname">${esc(p.name)}</span><b>${p.shelved}</b>${p.bonks ? `<small title="coworkers bonked">\u{1F4A5}${p.bonks}</small>` : ''}</div>`).join(''));
  }

  // kill-feed style line under the leaderboard
  feed(html) {
    const n = document.createElement('div');
    n.className = 'feed-line';
    n.innerHTML = html;
    this.el.feed.prepend(n);
    while (this.el.feed.children.length > 4) this.el.feed.lastChild.remove();
    setTimeout(() => n.classList.add('out'), 4500);
    setTimeout(() => n.remove(), 5000);
  }

  fps(on, v) {
    this.el.fps.hidden = !on;
    if (on) setText(this.el.fps, `${v} FPS`);
  }
}
