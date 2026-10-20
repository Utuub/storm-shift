import { SECTIONS, TOTAL_ITEMS } from './catalog.js';

const $ = (id) => document.getElementById(id);

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
export { fmtTime };

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'), shelved: $('hud-shelved'), bar: $('hud-bar'), credits: $('hud-credits'),
      score: $('hud-score'), time: $('hud-time'), combo: $('hud-combo'), aim: $('aim'),
      aimSub: $('aim-sub'), hand: $('hand'), cart: $('hud-cart'), stamina: $('stamina'),
      staminaFill: $('stamina-fill'), toasts: $('toasts'), flash: $('flash'),
      radar: $('radar'), radarArrow: $('radar-arrow'), radarDist: $('radar-dist'),
      checklist: $('checklist'), resetHint: $('reset-hint'),
    };
  }

  show(on) { this.el.root.hidden = !on; }

  update(game, player, eff) {
    const e = this.el;
    e.shelved.textContent = `${game.shelved} / ${TOTAL_ITEMS}`;
    e.bar.style.width = `${(game.shelved / TOTAL_ITEMS) * 100}%`;
    e.credits.textContent = game.credits;
    e.score.textContent = game.score;
    e.time.textContent = fmtTime(game.time);
    const mult = game.comboMult();
    e.combo.textContent = mult > 1 ? `x${mult} combo` : '';
    e.stamina.hidden = eff.unlimitedSprint;
    e.staminaFill.style.width = `${player.stamina * 100}%`;
    e.staminaFill.classList.toggle('low', player.stamina < 0.2);
  }

  setAim(title, sub = '') {
    this.el.aim.textContent = title;
    this.el.aimSub.textContent = sub;
  }

  setHand(hand, cap, cart) {
    const counts = new Map();
    for (const item of hand) counts.set(item.p, (counts.get(item.p) || 0) + 1);
    const rows = [...counts].reverse().map(([p, n]) =>
      `<div class="hand-row"><span class="swatch" style="background:${p.color}"></span>${p.name}${n > 1 ? ` ×${n}` : ''}</div>`);
    this.el.hand.innerHTML = `<div class="hand-head">Hands ${hand.length}/${cap}</div>${rows.join('') || '<div class="hand-row dim">empty</div>'}`;
    this.el.cart.hidden = !cart.active;
    if (cart.active) this.el.cart.textContent = `Cart ${cart.items.length}/${cart.cap}${cart.pushing ? ' · pushing' : ''}`;
  }

  toast(html, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.innerHTML = html;
    this.el.toasts.prepend(t);
    while (this.el.toasts.children.length > 4) this.el.toasts.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3800);
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
    this.el.radarDist.textContent = `${dist.toFixed(0)} m`;
  }

  toggleChecklist(force) {
    const c = this.el.checklist;
    c.hidden = force !== undefined ? !force : !c.hidden;
  }

  renderChecklist() {
    if (this.el.checklist.hidden) return;
    this.el.checklist.innerHTML = '<h3>Store checklist</h3>' + SECTIONS.map((s) => {
      const done = s.list.reduce((a, p) => a + p.placed, 0);
      const total = s.list.reduce((a, p) => a + p.count, 0);
      return `<div class="check-row ${done === total ? 'done' : ''}">
        <span class="swatch" style="background:${s.color}"></span>
        <span class="check-name">${s.name}</span><span>${done}/${total}</span></div>`;
    }).join('');
  }

  resetHint(on) { this.el.resetHint.hidden = !on; }
}
