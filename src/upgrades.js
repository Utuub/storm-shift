// The GM's upgrade tree. Each node has a cost and prerequisites.
export const UPGRADES = [
  { id: 'hands1', branch: 'Hands', name: 'Two-Handed Stack', cost: 40, req: [], desc: 'Carry 5 items' },
  { id: 'hands2', branch: 'Hands', name: 'Chin Tuck Technique', cost: 150, req: ['hands1'], desc: 'Carry 8 items' },
  { id: 'hands3', branch: 'Hands', name: 'Forklift Certified', cost: 400, req: ['hands2'], desc: 'Carry 12 items' },
  { id: 'grabber', branch: 'Hands', name: 'The Scoop', cost: 350, req: ['hands2'], desc: 'One click grabs every matching item within 2 m' },

  { id: 'legs1', branch: 'Legs', name: 'Comfy Insoles', cost: 30, req: [], desc: '+15% walk speed' },
  { id: 'legs2', branch: 'Legs', name: 'Running Shoes', cost: 100, req: ['legs1'], desc: '+15% walk speed' },
  { id: 'legs3', branch: 'Legs', name: 'Roller Skates', cost: 250, req: ['legs2'], desc: '+15% walk speed' },
  { id: 'legs4', branch: 'Legs', name: 'Marathon Lungs', cost: 300, req: ['legs3'], desc: 'Sprint never runs out' },

  { id: 'cart', branch: 'Cart', name: 'Shopping Cart', cost: 150, req: ['hands2'], desc: 'A cart that holds 25. Push it with the cart key. Stocking near it pulls matching items from it' },
  { id: 'cart2', branch: 'Cart', name: 'Bigger Basket', cost: 300, req: ['cart'], desc: 'Cart holds 50' },
  { id: 'cart3', branch: 'Cart', name: 'Flatbed Cart', cost: 600, req: ['cart2'], desc: 'Cart holds 100' },

  { id: 'scan1', branch: 'Scanner', name: 'Price Scanner', cost: 80, req: [], desc: 'Highlights the shelf spot for whatever you are holding' },
  { id: 'scan2', branch: 'Scanner', name: 'Section Radar', cost: 250, req: ['scan1'], desc: 'Arrow to the nearest loose item that matches what you hold' },

  { id: 'reach1', branch: 'Reach', name: 'Long Arms', cost: 60, req: [], desc: '+1 m pickup reach' },
  { id: 'reach2', branch: 'Reach', name: 'Grabber Pole', cost: 180, req: ['reach1'], desc: '+1 m pickup reach' },

  { id: 'crew1', branch: 'Crew', name: 'Call In a Coworker', cost: 250, req: [], desc: 'Jess clocks in and shelves items for you, 1 at a time' },
  { id: 'crew2', branch: 'Crew', name: 'Jess Gets a Basket', cost: 450, req: ['crew1'], desc: 'Jess carries 2 items per trip' },
  { id: 'crew3', branch: 'Crew', name: 'Jess Goes Full-Time', cost: 700, req: ['crew2'], desc: 'Jess carries 3 items and walks faster' },
];

export const BRANCHES = ['Hands', 'Legs', 'Cart', 'Scanner', 'Reach', 'Crew'];

export function effects(owned) {
  const has = (id) => owned.has(id);
  return {
    carry: has('hands3') ? 12 : has('hands2') ? 8 : has('hands1') ? 5 : 3,
    speedMult: 1 + 0.15 * ['legs1', 'legs2', 'legs3'].filter(has).length,
    unlimitedSprint: has('legs4'),
    cart: has('cart'),
    cartCap: has('cart3') ? 100 : has('cart2') ? 50 : 25,
    scanner: has('scan1'),
    radar: has('scan2'),
    reach: 3 + (has('reach1') ? 1 : 0) + (has('reach2') ? 1 : 0),
    grabber: has('grabber'),
    crew: has('crew3') ? 3 : has('crew2') ? 2 : has('crew1') ? 1 : 0,
  };
}

export const canBuy = (u, owned, credits) =>
  !owned.has(u.id) && u.req.every((r) => owned.has(r)) && credits >= u.cost;

export const cheapestAvailable = (owned) => {
  const open = UPGRADES.filter((u) => !owned.has(u.id) && u.req.every((r) => owned.has(r)));
  return open.length ? Math.min(...open.map((u) => u.cost)) : Infinity;
};

const GM_LINES = [
  "Every can back where it goes. Then you can go home.",
  "Corporate's gonna ask about this. Let's have an answer.",
  "You're doing fine. The cereal aisle looks like a crime scene, though.",
  "I've managed this store for fifteen years. Never seen a cantaloupe in the pet aisle.",
  "Credits are credits. Spend 'em on something that makes you faster.",
  "If the storm comes back, I'm blaming you.",
];

export class UpgradeMenu {
  constructor(root, game, onBuy, onClose) {
    this.root = root;
    this.game = game;
    this.onBuy = onBuy;
    root.querySelector('#menu-close').addEventListener('click', onClose);
    this.tree = root.querySelector('#menu-tree');
    this.tree.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const u = UPGRADES.find((x) => x.id === btn.dataset.id);
      if (canBuy(u, game.owned, game.credits)) {
        this.onBuy(u);
        this.render();
      }
    });
  }

  open() {
    this.root.querySelector('#menu-quote').textContent = `"${GM_LINES[Math.floor(Math.random() * GM_LINES.length)]}"`;
    this.render();
    this.root.hidden = false;
  }

  close() { this.root.hidden = true; }

  render() {
    const { owned, credits } = this.game;
    this.root.querySelector('#menu-credits').textContent = credits;
    this.tree.innerHTML = BRANCHES.map((b) => `
      <div class="branch">
        <h3>${b}</h3>
        ${UPGRADES.filter((u) => u.branch === b).map((u) => {
          const have = owned.has(u.id);
          const unlocked = u.req.every((r) => owned.has(r));
          const afford = credits >= u.cost;
          const cls = have ? 'owned' : !unlocked ? 'locked' : afford ? 'buy' : 'poor';
          const needs = !unlocked ? `Needs ${u.req.map((r) => UPGRADES.find((x) => x.id === r).name).join(', ')}` : '';
          return `<button class="node ${cls}" data-id="${u.id}" ${have || !unlocked || !afford ? 'disabled' : ''}>
            <span class="node-name">${u.name}</span>
            <span class="node-desc">${u.desc}</span>
            <span class="node-cost">${have ? 'Owned' : needs || `${u.cost} credits`}</span>
          </button>`;
        }).join('')}
      </div>`).join('');
  }
}
