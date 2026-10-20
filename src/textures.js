import * as THREE from 'three';
import { ART, DRAWN } from './labels.js';

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

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function drawPicture(ctx, p, cx, cy, size) {
  const d = DRAWN[p.name];
  if (d?.kind === 'cubes') {
    // a little stack of sugar cubes
    const s = size * 0.3;
    const cubes = [[-1, 0], [0, 0], [1, 0], [-0.5, -1], [0.5, -1], [0, -2]];
    for (const [i, j] of cubes) {
      const x = cx + i * s * 1.05 - s / 2, y = cy + size * 0.25 + j * s * 0.95 - s;
      ctx.fillStyle = d.color;
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + s * 0.7, y, s * 0.3, s);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, s, s);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 6; k++) ctx.fillRect(x + ((k * 37) % 10) / 10 * s, y + ((k * 53) % 10) / 10 * s, 2, 2);
    }
    return;
  }
  if (d?.kind === 'mound') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.3, size * 0.48, size * 0.42, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(cx + size * 0.15, cy + size * 0.1, size * 0.12, size * 0.06, 0.4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const art = ART[p.name];
  if (!art) return;
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(art, cx, cy);
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
  drawPicture(ctx, p, W / 2, 108, 78);
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
  return tex(c);
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
    ctx.font = 'bold 20px Arial, sans-serif';
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

export function floorTexture() {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#d9d4c7' : '#ece8dc';
      ctx.fillRect(x * 64, y * 64, 64, 64);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(256, i * 64); ctx.stroke();
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
