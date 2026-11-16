import * as THREE from 'three';
import { drawArt } from './art.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Package art in x 0..224 (brand color, store brand, picture, name). x 224..256
// stays white: model parts that aren't labels sample it (see models.js).
export function productTexture(p) {
  const S = 256, W = 224;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, shade(p.color, 0.1));
  g.addColorStop(1, shade(p.color, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, S);
  // diagonal stripes for some texture
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let x = -S; x < W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, S); ctx.lineTo(x + 14, S); ctx.lineTo(x + 14 + S, 0); ctx.lineTo(x + S, 0);
    ctx.fill();
  }
  // store brand banner
  ctx.fillStyle = shade(p.color, -0.22);
  ctx.fillRect(0, 0, W, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CORNER FRESH', W / 2, 18);
  // picture in a white circle
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(W / 2, 104, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(p.color, -0.25);
  ctx.lineWidth = 4;
  ctx.stroke();
  drawArt(ctx, p.name, W / 2, 104, 104);
  // name plate
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(10, 172, W - 20, 64);
  ctx.fillStyle = '#1b1b1b';
  let size = 26;
  ctx.font = `bold ${size}px Arial, sans-serif`;
  let lines = wrapLines(ctx, p.name, W - 32);
  while ((lines.length > 2 || lines.some((l) => ctx.measureText(l).width > W - 32)) && size > 14) {
    size -= 2;
    ctx.font = `bold ${size}px Arial, sans-serif`;
    lines = wrapLines(ctx, p.name, W - 32);
  }
  lines = lines.slice(0, 2);
  const top = 204 - (lines.length - 1) * (size / 2 + 1);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, top + i * (size + 2)));
  ctx.fillStyle = shade(p.color, -0.22);
  ctx.fillRect(0, S - 14, W, 14);
  const t = tex(c);
  // The label never changes, so once it has been sent to the graphics card the
  // canvas copy in normal memory is freed (about a quarter MB per product).
  t.onUpdate = () => { c.width = c.height = 0; t.onUpdate = null; };
  return t;
}

// Shelf price-tag strip. Redrawn whenever the slot count changes.
export function makeSlotTag(widthM, heightM) {
  const h = 48;
  const w = Math.max(96, Math.min(512, Math.round((widthM / heightM) * h)));
  const c = canvas(w, h);
  return { canvas: c, texture: tex(c) };
}

export function drawSlotTag(tag, p) {
  const { canvas: c } = tag;
  const ctx = c.getContext('2d');
  const done = p.placed >= p.count;
  ctx.fillStyle = done ? '#2f9e44' : '#fdf6d8';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = p.section.color;
  ctx.fillRect(0, 0, 8, c.height);
  ctx.fillStyle = done ? '#ffffff' : '#1b1b1b';
  ctx.textBaseline = 'middle';
  const countText = `${p.placed}/${p.count}`;
  ctx.font = 'bold 22px Arial, sans-serif';
  const cw = ctx.measureText(countText).width;
  ctx.textAlign = 'right';
  ctx.fillText(countText, c.width - 8, c.height / 2 + 1);
  ctx.textAlign = 'left';
  let size = 20;
  ctx.font = `bold ${size}px Arial, sans-serif`;
  const room = c.width - cw - 30;
  while (ctx.measureText(p.name).width > room && size > 11) {
    size--;
    ctx.font = `bold ${size}px Arial, sans-serif`;
  }
  ctx.fillText(p.name, 14, c.height / 2 + 1, room);
  tag.texture.needsUpdate = true;
}

export function signTexture(title, sub, color) {
  const c = canvas(512, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 100, 512, 28);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 54;
  ctx.font = `bold ${size}px Arial, sans-serif`;
  while (ctx.measureText(title).width > 480 && size > 24) {
    size -= 2;
    ctx.font = `bold ${size}px Arial, sans-serif`;
  }
  ctx.fillText(title, 256, 52);
  if (sub) {
    let fs = 20;
    ctx.font = `bold ${fs}px Arial, sans-serif`;
    while (ctx.measureText(sub).width > 490 && fs > 11) { fs--; ctx.font = `bold ${fs}px Arial, sans-serif`; }
    ctx.fillText(sub, 256, 114);
  }
  return tex(c);
}

export function textTexture(text, { w = 256, h = 64, bg = 'rgba(0,0,0,0.6)', fg = '#fff', font = 'bold 30px Arial' } = {}) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const t = tex(c);
  t.userData = { canvas: c };
  return t;
}

export function ceilingTexture() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d6d0';
  ctx.fillRect(0, 0, 256, 256);
  // speckled acoustic tile
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = '#a9a7a1';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 256, 256);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function floorTexture() {
  // Waxed vinyl tile: two close tones in a checker, speckled, with thin seams
  // and a little wear. 4 x 4 tiles per repeat.
  const S = 512, T = S / 4;
  const c = canvas(S, S);
  const ctx = c.getContext('2d');
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const k = Math.round((rnd() - 0.5) * 8);
      const base = (x + y) % 2 ? [176 + k, 171 + k, 160 + k] : [196 + k, 191 + k, 179 + k];
      ctx.fillStyle = `rgb(${base})`;
      ctx.fillRect(x * T, y * T, T, T);
    }
  }
  for (let i = 0; i < 5200; i++) {
    const v = rnd();
    ctx.fillStyle = v < 0.5 ? `rgba(120,112,98,${0.1 + rnd() * 0.18})` : v < 0.8 ? `rgba(255,255,255,${0.25 + rnd() * 0.3})` : `rgba(150,128,96,${0.12 + rnd() * 0.15})`;
    ctx.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // faint scuffs
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = `rgba(70,66,60,${0.04 + rnd() * 0.05})`;
    ctx.lineWidth = 1 + rnd() * 2;
    const x = rnd() * S, y = rnd() * S, a = rnd() * 6.28, len = 20 + rnd() * 60;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + 6, y + Math.sin(a) * len * 0.5 - 6, x + Math.cos(a) * len, y + Math.sin(a) * len); ctx.stroke();
  }
  // seams
  ctx.strokeStyle = 'rgba(60,56,50,0.22)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * T, 0); ctx.lineTo(i * T, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * T); ctx.lineTo(S, i * T); ctx.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Analog wall clock showing h:mm.
export function clockTexture(h, m) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#1b1e24';
  ctx.beginPath(); ctx.arc(128, 128, 126, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fbfaf4';
  ctx.beginPath(); ctx.arc(128, 128, 112, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1b1e24';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillText(String(i), 128 + Math.sin(a) * 90, 128 - Math.cos(a) * 90);
  }
  const hand = (a, len, w, col) => {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); ctx.stroke();
  };
  hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 56, 9, '#1b1e24');
  hand((m / 60) * Math.PI * 2, 84, 6, '#1b1e24');
  hand(0.9, 92, 2, '#c0392b');
  ctx.fillStyle = '#c0392b';
  ctx.beginPath(); ctx.arc(128, 128, 7, 0, Math.PI * 2); ctx.fill();
  const t = tex(c);
  return t;
}

// What you see through the front windows: a wet parking lot at night.
export function nightTexture() {
  const c = canvas(512, 384);
  const ctx = c.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 384);
  sky.addColorStop(0, '#3a4a66');
  sky.addColorStop(0.55, '#5a6a86');
  sky.addColorStop(0.56, '#2a3038');
  sky.addColorStop(1, '#4a5260');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 384);
  // storm clouds
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = `rgba(20,26,40,${0.25 + (i % 5) * 0.08})`;
    ctx.beginPath();
    ctx.ellipse((i * 97) % 512, 20 + (i * 37) % 130, 70 + (i * 13) % 60, 22 + (i * 7) % 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // parking lot lamps with a glow and a streak of reflection on the wet ground
  for (const x of [90, 300, 450]) {
    ctx.fillStyle = '#10141c';
    ctx.fillRect(x - 2, 110, 4, 110);
    const g = ctx.createRadialGradient(x, 108, 2, x, 108, 60);
    g.addColorStop(0, 'rgba(255,236,190,1)');
    g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 60, 48, 120, 120);
    const r = ctx.createLinearGradient(0, 220, 0, 384);
    r.addColorStop(0, 'rgba(255,236,190,0.55)');
    r.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = r;
    ctx.fillRect(x - 9, 220, 18, 164);
  }
  // parking lines and a couple of parked cars
  ctx.strokeStyle = 'rgba(230,230,220,0.5)';
  ctx.lineWidth = 3;
  for (let x = 20; x < 512; x += 62) { ctx.beginPath(); ctx.moveTo(x, 384); ctx.lineTo(x + 26, 250); ctx.stroke(); }
  for (const [x, col] of [[150, '#1b2230'], [370, '#2a1c1c']]) {
    ctx.fillStyle = col;
    ctx.fillRect(x, 204, 96, 26);
    ctx.fillRect(x + 18, 186, 58, 20);
    ctx.fillStyle = '#0c0f14';
    ctx.beginPath(); ctx.arc(x + 20, 232, 9, 0, 7); ctx.arc(x + 76, 232, 9, 0, 7); ctx.fill();
  }
  // rain
  ctx.strokeStyle = 'rgba(210,225,255,0.35)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 260; i++) {
    const x = (i * 71) % 512, y = (i * 113) % 384;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); ctx.stroke();
  }
  return tex(c);
}
