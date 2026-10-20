import * as THREE from 'three';

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

// Package art: brand color, a light label band with the product name.
export function productTexture(p) {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = p.color;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = shade(p.color, -0.12);
  ctx.fillRect(0, 0, 128, 14);
  ctx.fillRect(0, 114, 128, 14);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(6, 34, 116, 60);
  ctx.fillStyle = '#1b1b1b';
  ctx.font = 'bold 17px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, p.name, 110).slice(0, 3);
  const top = 64 - (lines.length - 1) * 9;
  lines.forEach((l, i) => ctx.fillText(l, 64, top + i * 18));
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
