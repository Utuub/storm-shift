import * as THREE from 'three';
import { drawArt } from './art.js';

// Package labels, drawn like the front of a real package: brand logo up top,
// big product name, the food filling the lower half, a flavor band and net
// weight, sometimes a starburst badge. Art lives in x 0..224; x 224..256
// stays white (models.js samples it for parts that aren't labels).

// Made-up brands (no real ones). The store brand shows up on about a quarter.
const BRANDS = ['Crunch Co.', 'Hearthside', 'Clover Hill', 'Sunny Acres', 'Big Barn', 'Northfield', 'Kettle & Co.',
  'Bramble', 'Maple Lane', 'Pinecrest', 'Golden Mill', 'Red Wagon', 'Bluebird', 'Prairie Gold', 'Oak & Ember'];
const TAGLINES = ['ORIGINAL', 'CLASSIC', 'FAMILY SIZE', 'REAL FLAVOR', 'NO ARTIFICIAL COLORS', 'SINCE 1962', 'FRESH TASTE', 'NEW RECIPE'];
const BADGES = [['NEW!', ''], ['25%', 'MORE'], ['BIG', 'BAG'], ['BEST', 'SELLER'], ['VALUE', 'PACK']];
const BAGS = new Set(['chips', 'bigbag', 'pouch', 'bag_s', 'flour']);
const DISPLAY = '"Lilita One", "Arial Black", Impact, sans-serif';

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const col = (hex) => new THREE.Color(hex);
function shade(hex, amt) { return '#' + col(hex).offsetHSL(0, 0, amt).getHexString(); }
function mix(a, b, t) { return '#' + col(a).lerp(col(b), t).getHexString(); }
function lum(hex) { const c = col(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }

function wrapLines(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Text with a thick outline, shrunk until it fits maxW.
function bigText(ctx, text, x, y, maxW, size, fill, stroke, lw, font = DISPLAY, pre = '') {
  ctx.font = `${pre}${size}px ${font}`;
  while (ctx.measureText(text).width > maxW && size > 9) { size -= 1; ctx.font = `${pre}${size}px ${font}`; }
  ctx.lineJoin = 'round';
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

export function drawLabel(ctx, p) {
  const S = 256, W = 224, cx = W / 2;
  const h = hash(p.name);
  const r = (k) => ((h >>> (k * 3)) % 1000) / 1000;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, W, S); ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const base = p.color;
  const light = lum(base) > 0.62;
  const ink = light ? '#1d1a17' : '#ffffff';
  const edge = light ? '#ffffff' : shade(base, -0.3);
  const accent = light ? shade(base, -0.38) : (lum(base) < 0.3 ? '#f2c21a' : '#ffffff');

  // background: the brand color with a warm glow burst behind the food
  ctx.fillStyle = shade(base, -0.08);
  ctx.fillRect(0, 0, W, S);
  const glow = ctx.createRadialGradient(cx, 165, 6, cx, 165, 160);
  glow.addColorStop(0, mix(base, '#fff6dc', 0.6));
  glow.addColorStop(0.45, shade(base, 0.04));
  glow.addColorStop(1, shade(base, -0.2));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, S);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2, a1 = a0 + Math.PI / 36;
    ctx.beginPath(); ctx.moveTo(cx, 165);
    ctx.lineTo(cx + Math.cos(a0) * 320, 165 + Math.sin(a0) * 320);
    ctx.lineTo(cx + Math.cos(a1) * 320, 165 + Math.sin(a1) * 320);
    ctx.fill();
  }

  // brand logo (three styles)
  const store = r(1) < 0.25;
  const brand = store ? 'Corner Fresh' : BRANDS[h % BRANDS.length];
  const style = store ? 0 : (h >>> 5) % 3;
  ctx.save();
  ctx.translate(cx, 25);
  ctx.rotate(-0.05);
  if (style === 0) {
    ctx.fillStyle = store ? '#1f7a45' : '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, 86, 19, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = store ? '#f2c21a' : shade(base, -0.3); ctx.lineWidth = 3; ctx.stroke();
    bigText(ctx, brand, 0, 1, 150, 22, store ? '#ffffff' : shade(base, -0.35));
  } else if (style === 1) {
    ctx.fillStyle = '#c8201e';
    ctx.beginPath();
    ctx.moveTo(-94, -15); ctx.lineTo(94, -15); ctx.lineTo(84, 0); ctx.lineTo(94, 15); ctx.lineTo(-94, 15); ctx.lineTo(-84, 0); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
    bigText(ctx, brand.toUpperCase(), 0, 1, 152, 19, '#ffffff');
  } else {
    bigText(ctx, brand, 0, 0, 180, 28, ink, edge, 6, 'Georgia, serif', 'italic 900 ');
  }
  ctx.restore();

  // product name, big and outlined
  ctx.font = `30px ${DISPLAY}`;
  let lines = wrapLines(ctx, p.name.toUpperCase(), W - 24);
  if (lines.length > 2) lines = [lines.slice(0, -1).join(' '), lines[lines.length - 1]];
  if (lines.length === 1) bigText(ctx, lines[0], cx, 68, W - 16, 36, ink, edge, 7);
  else lines.forEach((l, i) => bigText(ctx, l, cx, 58 + i * 27, W - 16, 28, ink, edge, 6));

  // the food: one big hero with two more behind it, soft drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  drawArt(ctx, p.name, cx - 58, 162, 82);
  drawArt(ctx, p.name, cx + 60, 158, 82);
  drawArt(ctx, p.name, cx, 170, 116);
  ctx.restore();

  // flavor band (a swoosh) and net weight
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, 214); ctx.quadraticCurveTo(cx, 198, W, 212); ctx.lineTo(W, 236); ctx.quadraticCurveTo(cx, 226, 0, 238); ctx.closePath();
  ctx.fill();
  const tag = store ? 'QUALITY GUARANTEED' : TAGLINES[(h >>> 9) % TAGLINES.length];
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillStyle = accent === '#ffffff' || accent === '#f2c21a' ? shade(base, -0.35) : '#ffffff';
  ctx.fillText(tag, cx, 219, W - 30);
  const oz = [4, 6, 8, 10, 12, 14, 16, 18, 24, 32][(h >>> 12) % 10];
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillStyle = ink;
  ctx.fillText(`NET WT ${oz} OZ (${Math.round(oz * 28.35)}g)`, cx, 247);

  // starburst badge on about a third of products
  if (r(2) < 0.35) {
    const [b1, b2] = BADGES[(h >>> 15) % BADGES.length];
    ctx.save();
    ctx.translate(W - 30, 112);
    ctx.rotate(0.25);
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, rr = i % 2 ? 22 : 28;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#f7d21a'; ctx.fill();
    ctx.strokeStyle = '#c8201e'; ctx.lineWidth = 2; ctx.stroke();
    if (b2) { bigText(ctx, b1, 0, -6, 38, 15, '#c8201e'); bigText(ctx, b2, 0, 8, 38, 11, '#c8201e'); }
    else bigText(ctx, b1, 0, 1, 40, 15, '#c8201e');
    ctx.restore();
  }

  // foil bags get a shiny streak
  if (BAGS.has(p.shapeKey)) {
    const gl = ctx.createLinearGradient(0, 0, W, S);
    gl.addColorStop(0.16, 'rgba(255,255,255,0)');
    gl.addColorStop(0.27, 'rgba(255,255,255,0.24)');
    gl.addColorStop(0.36, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, S);
  }
  ctx.restore();
}

export function productTexture(p) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  drawLabel(c.getContext('2d'), p);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // The label never changes, so once it has been sent to the graphics card the
  // canvas copy in normal memory is freed (about a quarter MB per product).
  t.onUpdate = () => { c.width = c.height = 0; t.onUpdate = null; };
  return t;
}
