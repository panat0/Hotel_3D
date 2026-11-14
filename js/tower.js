// Builds the Aurelia tower interiors in three.js from js/layout.js (single source of truth).
// Walls / floors / built-ins are merged per material per level; furniture comes from js/props.js and is instanced.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {floorLayout, FLOORZ, SLAB_T, slabHoles, guestType, SHAFTS, GX, GY, GCH, SLAB, FLOOR_H, CEIL} from './layout.js';
import {buildProp, planarUV} from './props.js';

// ---------- procedural textures (canvas, real-world scale through planar UVs) ----------
function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tex(size, draw, srgb = true){
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size, rng(size * 7 + draw.length));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;
function grain(g, x, y, w, h, r, base, dark, n = 26, vertical = false){
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let i = 0; i < n; i++) {
    g.strokeStyle = dark; g.globalAlpha = .08 + r() * .22; g.lineWidth = .6 + r() * 1.8; g.beginPath();
    const o = r() * (vertical ? w : h), amp = 1 + r() * 4, f = .01 + r() * .03;
    for (let t = 0; t <= (vertical ? h : w); t += 6) { const q = o + Math.sin(t * f + i) * amp; vertical ? (t ? g.lineTo(x + q, y + t) : g.moveTo(x + q, y + t)) : (t ? g.lineTo(x + t, y + q) : g.moveTo(x + t, y + q)); }
    g.stroke();
  }
  g.globalAlpha = 1;
}
function veins(g, s, r, col, n, width){
  g.strokeStyle = col;
  for (let i = 0; i < n; i++) { let x = r() * s, y = r() * s, a = r() * Math.PI * 2; g.globalAlpha = .15 + r() * .35; g.lineWidth = width * (.3 + r()); g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 60; k++) { a += (r() - .5) * .6; x += Math.cos(a) * s / 40; y += Math.sin(a) * s / 40; g.lineTo(x, y); } g.stroke(); }
  g.globalAlpha = 1;
}
function clouds(g, s, r, cols, n){ for (let i = 0; i < n; i++) { const x = r() * s, y = r() * s, rad = s * (.05 + r() * .2), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, cols[i % cols.length]); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = .12; g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } g.globalAlpha = 1; }
function noise(g, s, r, a = .08, cell = 2){ for (let y = 0; y < s; y += cell) for (let x = 0; x < s; x += cell) { const v = r(); g.fillStyle = v > .5 ? `rgba(255,255,255,${(v - .5) * a})` : `rgba(0,0,0,${(.5 - v) * a})`; g.fillRect(x, y, cell, cell); } }
const T = {
  // 1.6 m of oak-walnut planks, 0.2 m wide boards
  woodFloor: [tex(1024, (g, s, r) => { const rows = 8, h = s / rows; for (let j = 0; j < rows; j++) { let x = -r() * s * .5; while (x < s) { const L = s * (.45 + r() * .5), l = 30 + r() * 10; grain(g, x, j * h, L, h, r, hsl(26, 38, l), hsl(22, 45, l - 14), 14); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, j * h, 2, h); x += L; } g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, j * h, s, 2); } }), 1.6],
  walnut: [tex(512, (g, s, r) => { grain(g, 0, 0, s, s, r, hsl(22, 38, 24), hsl(18, 45, 12), 60); clouds(g, s, r, ['rgba(120,70,30,.6)', 'rgba(40,20,10,.6)'], 20); }), .9],
  deck: [tex(1024, (g, s, r) => { const rows = 10, h = s / rows; for (let j = 0; j < rows; j++) { grain(g, 0, j * h, s, h, r, hsl(28, 35, 36 + r() * 6), hsl(24, 40, 22), 10); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, j * h, s, 4); } }), 1.4],
  marble: [tex(1024, (g, s, r) => { g.fillStyle = '#e4ddd0'; g.fillRect(0, 0, s, s); clouds(g, s, r, ['rgba(200,190,175,.8)', 'rgba(255,255,255,.9)'], 50); veins(g, s, r, '#8d8579', 22, 2.2); veins(g, s, r, '#b9ad98', 30, 1); }), 1.8],
  marbleFloor: [tex(1024, (g, s, r) => { g.fillStyle = '#d9cdb8'; g.fillRect(0, 0, s, s); clouds(g, s, r, ['rgba(190,175,150,.8)', 'rgba(245,238,225,.9)'], 60); veins(g, s, r, '#8a7d68', 18, 2.4); veins(g, s, r, '#b8a688', 26, 1); g.fillStyle = 'rgba(80,70,55,.5)'; for (const k of [0, s / 2]) { g.fillRect(k, 0, 2, s); g.fillRect(0, k, s, 2); } }), 1.6],
  marbleBlack: [tex(1024, (g, s, r) => { g.fillStyle = '#121214'; g.fillRect(0, 0, s, s); clouds(g, s, r, ['rgba(40,40,46,.9)', 'rgba(0,0,0,.9)'], 40); veins(g, s, r, '#d9d2c4', 16, 1.6); veins(g, s, r, '#a8894f', 8, 1.2); }), 1.4],
  marbleDark: [tex(512, (g, s, r) => { g.fillStyle = '#6a655e'; g.fillRect(0, 0, s, s); clouds(g, s, r, ['rgba(90,85,78,.8)', 'rgba(50,48,45,.8)'], 30); veins(g, s, r, '#cfc6b6', 10, 1.2); }), 1.2],
  floorStone: [tex(1024, (g, s, r) => { const n = 3, c = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = hsl(36, 18, 62 + r() * 6); g.fillRect(i * c, j * c, c, c); } clouds(g, s, r, ['rgba(160,145,120,.6)', 'rgba(230,222,205,.6)'], 50); noise(g, s, r, .1, 3); g.fillStyle = 'rgba(70,60,45,.45)'; for (let i = 0; i <= n; i++) { g.fillRect(i * c - 1, 0, 3, s); g.fillRect(0, i * c - 1, s, 3); } }), 1.8],
  carpetRed: [tex(512, (g, s, r) => { g.fillStyle = '#6e1720'; g.fillRect(0, 0, s, s); noise(g, s, r, .25, 2); g.strokeStyle = 'rgba(210,160,80,.35)'; g.lineWidth = 3; const k = s / 4; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const x = i * k + k / 2, y = j * k + k / 2; g.beginPath(); g.moveTo(x, y - k * .32); g.lineTo(x + k * .32, y); g.lineTo(x, y + k * .32); g.lineTo(x - k * .32, y); g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, k * .08, 0, 7); g.stroke(); } }), 1.1],
  rug: [tex(512, (g, s, r) => { g.fillStyle = '#a89878'; g.fillRect(0, 0, s, s); noise(g, s, r, .3, 2); g.strokeStyle = 'rgba(70,55,40,.25)'; g.lineWidth = 2; for (let i = 0; i < s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.bezierCurveTo(i + 16, s * .3, i - 16, s * .6, i, s); g.stroke(); } }), 1.4],
  rubber: [tex(256, (g, s, r) => { g.fillStyle = '#2b2c2f'; g.fillRect(0, 0, s, s); noise(g, s, r, .35, 1); }), .5],
  wall: [tex(512, (g, s, r) => { g.fillStyle = '#d8cdb8'; g.fillRect(0, 0, s, s); clouds(g, s, r, ['rgba(255,250,240,.5)', 'rgba(190,178,158,.5)'], 30); noise(g, s, r, .05, 2); }), 2.4],
  concrete: [tex(512, (g, s, r) => { g.fillStyle = '#8b857c'; g.fillRect(0, 0, s, s); clouds(g, s, r, ['rgba(120,115,108,.6)', 'rgba(160,155,148,.6)'], 40); noise(g, s, r, .12, 2); }), 2.0],
  woodSauna: [tex(512, (g, s, r) => { const rows = 6, h = s / rows; for (let j = 0; j < rows; j++) { grain(g, 0, j * h, s, h, r, hsl(32, 45, 50 + r() * 6), hsl(28, 45, 35), 8); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, j * h, s, 2); } }), .9],
};
T.poolTile = [tex(512, (g, s, r) => { const n = 8, c = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = hsl(194, 55, 60 + r() * 7); g.fillRect(i * c, j * c, c, c); } g.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i <= n; i++) { g.fillRect(i * c - 1.5, 0, 3, s); g.fillRect(0, i * c - 1.5, s, 3); } }), 2.0];
const FAB = tex(256, (g, s, r) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); noise(g, s, r, .22, 1); g.strokeStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < s; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); } });
const LEATHER = tex(256, (g, s, r) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * .08})`; g.beginPath(); g.arc(r() * s, r() * s, 1 + r() * 3, 0, 7); g.fill(); } });
const TEXSIZE = {velvetCream: .25, velvetBlush: .25, velvetGreen: .25, velvetNavy: .25, linen: .3, duvet: .3, throw: .25, leather: .35, towel: .2};

const M = (c, r = .6, m = 0, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: m, ...o});
export const MATS = {
  wall: M(0xd6cbb6, .85), concrete: M(0x8d877e, .9), marble: M(0xd9d1c2, .25), marbleBlack: M(0x17171a, .2, .1), marbleDark: M(0x6f6a64, .35), marbleFloor: M(0xbfb19a, .25),
  woodFloor: M(0x8a6443, .55), floorStone: M(0xb9ab92, .45), floorService: M(0x9c978f, .8), carpetRed: M(0x7d1d26, .95), walnut: M(0x4b3121, .5), linen: M(0xefe9df, .95), duvet: M(0xf6f2ea, .95),
  throw: M(0x1f5a43, .9), velvetCream: M(0xd9cbb2, .9), velvetBlush: M(0xb98a84, .9), velvetGreen: M(0x1d5a40, .9), velvetNavy: M(0x1c2d4f, .9), leather: M(0x6e3b1d, .55), rug: M(0x9c8c70, 1),
  ceramic: M(0xf5f3ef, .15), glassShower: M(0xcfe6ef, .05, .1, {transparent: true, opacity: .28, depthWrite: false}), mirror: M(0xcfd8dc, .04, 1), tv: M(0x07080a, .15, .4),
  gold: M(0xc9a24a, .3, .95), steel: M(0x9aa0a6, .35, .8), stair: M(0xcfc6b4, .7), stairNose: M(0x6e6a63, .5, .5), sheer: M(0xf3efe7, 1, 0, {transparent: true, opacity: .12, depthWrite: false}),
  drape: M(0x8f7c5e, .95), acWhite: M(0xeef1f3, .4), acGrille: M(0x3a3f44, .5), pot: M(0xd2c7b2, .7), leaf: M(0x3b7a3a, .75), leafDark: M(0x23502a, .8), blossom: M(0xe3a8b5, .8),
  lampShade: M(0xfff1d6, .7, 0, {emissive: 0xffc98a, emissiveIntensity: .7}), lampGlow: M(0xfff0d0, .5, 0, {emissive: 0xffc070, emissiveIntensity: 1.2}), water: M(0x1683bd, .03, .1, {transparent: true, opacity: .6, depthWrite: false}), poolTile: M(0xffffff, .35, 0, {side: THREE.DoubleSide}),
  towel: M(0xfafaf7, 1), art: M(0x5a2e30, .7), book: M(0x6b4a2e, .8), red: M(0xb3262b, .6), black: M(0x0a0a0b, .45), glassClear: M(0xd9ecf2, .05, 0, {transparent: true, opacity: .4, depthWrite: false}), bottleGreen: M(0x1f4f2a, .15, 0, {transparent: true, opacity: .9}),
  slab: M(0xb7a98f, .7), slabEdge: M(0xcbbd9f, .6), pianoBlack: M(0x050506, .06, .2), bread: M(0xb9803e, .8), chef: M(0x22262c, .7), rubber: M(0x2a2b2e, .9), woodSauna: M(0xb98a52, .7), deck: M(0x8a6a4a, .7),
  soil: M(0x2e2118, 1), trunk: M(0x4a3523, .9), chrome: M(0xdfe3e6, .12, 1), screen: M(0x0b1018, .08, .3, {emissive: 0x0a1626, emissiveIntensity: .6}), skin: M(0xc99a78, .7), tubIn: M(0xf5f3ef, .12), wine: M(0x4a0d16, .15, 0, {transparent: true, opacity: .92}),
  deckPaint: M(0x6a6d70, .8), asphaltDeck: M(0x3c3e42, .9), lineWhite: M(0xf2f2ee, .6), lineYellow: M(0xe8b524, .6), walkGreen: M(0x3f7a52, .8), accessBlue: M(0x1f5fb0, .7),
  carWhite: M(0xeef0f2, .25, .3), carBlack: M(0x101114, .2, .5), carSilver: M(0xaab0b6, .25, .8), carNavy: M(0x1a2a4a, .25, .5), carRed: M(0x8e1a22, .25, .4), carGold: M(0xa48a5a, .3, .7),
  glassCar: M(0x10161c, .05, .6), tyre: M(0x151515, .9), wallCap: M(0x2a2420, .9), bronze: M(0x4a3a2a, .4, .6), canvas: M(0xf4efe4, .9), fenceMeshT: M(0xffffff, .6, 0, {transparent: true, opacity: .5}), courtBlue: M(0x2d5d8e, .6), cladding: M(0xffffff, .6), roofGreen: M(0x5f7f44, .95), gravel: M(0xb9ae98, 1), whitePaint: M(0xf1eee8, .6), leafLight: M(0x5a8f3c, .8), waterJet: M(0xdff4ff, .1, 0, {transparent: true, opacity: .55, depthWrite: false, emissive: 0x9fd8f0, emissiveIntensity: .25}), balGlass: M(0x8fb8ca, .05, .25, {transparent: true, opacity: .5, depthWrite: false})
};
for (const k of ['drape', 'sheer', 'tubIn', 'glassClear', 'lampShade', 'glassShower', 'water', 'leaf', 'leafDark', 'leafLight', 'blossom', 'waterJet', 'red', 'canvas']) MATS[k].side = THREE.DoubleSide;
for (const [k, [t]] of Object.entries(T)) if (MATS[k]) { MATS[k].map = t; MATS[k].color.set(0xffffff); }
MATS.cladding.map = T.marble[0]; MATS.cladding.color.set(0xe6dccb);
MATS.marbleFloor.color.set(0xf0ebe2); MATS.carpetRed.roughness = 1;
for (const k of Object.keys(TEXSIZE)) MATS[k].map = k === 'leather' ? LEATHER : FAB;
const uvSize = m => m === 'cladding' ? 2.4 : T[m]?.[1] ?? TEXSIZE[m] ?? 1;

function boxGeo(it){
  if (it.rot !== undefined) {                                   // rotated box: centre (cx, cy), size w (along rot) x d, Blender ccw angle
    const g = new THREE.BoxGeometry(it.w, it.z1 - it.z0, it.d); g.rotateY(it.rot); g.translate(it.cx, (it.z0 + it.z1) / 2, -it.cy); return g.toNonIndexed();
  }
  const w = it.x1 - it.x0, d = it.y1 - it.y0, h = it.z1 - it.z0;
  const g = it.soft && Math.min(w, d, h) > .05 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(.05, Math.min(w, d, h) * .45)) : new THREE.BoxGeometry(w, h, d);
  g.translate((it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2, -(it.y0 + it.y1) / 2);   // Blender (x, y, z) -> three (x, z, -y)
  return g.index ? g.toNonIndexed() : g;
}
// thin floor finishes on tower floors: clip the rectangle to the chamfered glass outline so no corner pokes outside
const CHAM = GX + GY - GCH;
function crossesCham(it){ return Math.max(it.x1, -it.x0) + Math.max(it.y1, -it.y0) > CHAM + .001; }
function floorGeo(it){
  let poly = [[it.x0, it.y0], [it.x1, it.y0], [it.x1, it.y1], [it.x0, it.y1]];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {                  // Sutherland-Hodgman against sx*x + sy*y <= CHAM
    const f = p => CHAM - (sx * p[0] + sy * p[1]), out = [];
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b);
      if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } }
    poly = out; if (poly.length < 3) return null;
  }
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(poly.map(p => new THREE.Vector2(p[0], p[1]))), {depth: it.z1 - it.z0, bevelEnabled: false});
  g.rotateX(-Math.PI / 2); g.translate(0, it.z0, 0); return g.index ? g.toNonIndexed() : g;
}
function cylGeo(it){
  const g = new THREE.CylinderGeometry(it.r, it.r, it.z1 - it.z0, it.seg || (it.r > 1.5 ? 72 : it.r > .25 ? 32 : 14));
  g.translate(it.x, (it.z0 + it.z1) / 2, -it.y);
  return g.toNonIndexed();
}
function slabGeo(lv){
  const podium = lv === 'G' || lv === 2 || lv === 3, s = new THREE.Shape();
  if (podium) { s.moveTo(-24.45, -13.95); s.lineTo(24.45, -13.95); s.lineTo(24.45, 13.95); s.lineTo(-24.45, 13.95); }
  else { const {x, y, ch} = SLAB; const pts = [[-x + ch, -y], [x - ch, -y], [x, -y + ch], [x, y - ch], [x - ch, y], [-x + ch, y], [-x, y - ch], [-x, -y + ch]]; s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); }
  s.closePath();
  if (lv !== 'G') for (const h of slabHoles(lv)) { const p = new THREE.Path(); p.moveTo(h.x0, h.y0); p.lineTo(h.x0, h.y1); p.lineTo(h.x1, h.y1); p.lineTo(h.x1, h.y0); p.closePath(); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, {depth: SLAB_T, bevelEnabled: false});
  g.rotateX(-Math.PI / 2);                                  // shape (x, y) -> three (x, 0, -y), extrudes upward
  g.translate(0, -SLAB_T, 0);
  return g;
}

const SMALL = new Set(['bottle', 'books', 'bookcase', 'flowers', 'tableLamp', 'basinSet', 'towelBar', 'pastryTray', 'cakeStand', 'chafing', 'monitor', 'barShelf', 'wineWall', 'chandelier', 'pendant', 'umbrella']);
// walls cut by the floor cutaway get a dark section cap so their thickness reads like an architectural plan
const CAPM = new Set(['wall', 'concrete', 'woodSauna', 'marble']);
const isWallCut = it => it.t === 'b' && CAPM.has(it.m) && it.z1 >= CEIL - .02 && it.z1 - it.z0 > .4 && Math.min(it.x1 - it.x0, it.y1 - it.y0) <= .36;
// balconies on every guest room: slab, timber deck, glass balustrade, privacy screens, two chairs + side table (+ plant)
const BAL_D = 1.5, EDGE = SLAB.y;
function balconies(lv, L){
  const items = [], props = [], B = (m, x0, x1, y0, y1, z0, z1) => items.push({t: 'b', m, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0, z1});
  const P = (kind, m, cx, cy, w, d, z0, z1, ang, o = {}, round = false) => props.push({t: 'p', kind, m, cx, cy, w, d, z0, z1, ang, o, round});
  if (!['deluxe', 'club', 'suite', 'sky'].includes(L.type)) return {items, props};
  for (const r of L.rooms) {
    if (r.rt === 'skyStair') continue;
    const s = r.side, a = Math.max(r.x0, -12.3) + .02, b = Math.min(r.x1, 12.3) - .02; if (b - a < 1.6) continue;
    const yi = s * EDGE, yo = s * (EDGE + BAL_D), Y = d => s * (EDGE + d);
    B('concrete', a, b, yi, yo, -.42, -.05); B('deck', a, b, yi, Y(BAL_D - .03), -.05, -.02); B('slabEdge', a, b, Y(BAL_D - .03), yo, -.42, -.02);
    B('balGlass', a + .2, b - .2, Y(BAL_D - .09), Y(BAL_D - .06), -.02, 1.06);
    B('steel', a + .2, b - .2, Y(BAL_D - .12), Y(BAL_D - .03), 1.06, 1.1); B('steel', a + .2, b - .2, Y(BAL_D - .11), Y(BAL_D - .05), -.02, .07);
    for (let x = a + .22; x <= b - .25; x += Math.max(.9, (b - a - .12) / Math.ceil((b - a) / 1.3))) B('steel', x, x + .04, Y(BAL_D - .11), Y(BAL_D - .05), -.02, 1.06);
    B('cladding', a - .02, a + .2, yi, yo, -.42, FLOOR_H - .45); B('cladding', b - .2, b + .02, yi, yo, -.42, FLOOR_H - .45);  // stone side walls between balconies (full storey, flush with piers)
    B('lampGlow', (a + b) / 2 - .08, (a + b) / 2 + .08, Y(.65), Y(.81), -.43, -.42);                                         // soffit downlight
    const back = s < 0 ? 0 : Math.PI, cy = s * (EDGE + .78);
    P('chair', 'linen', a + .65, cy, .48, .5, -.02, .93, back, {wood: 'deck'}); P('chair', 'linen', a + 1.75, cy, .48, .5, -.02, .93, back, {wood: 'deck'});
    P('sideTable', 'marbleBlack', a + 1.2, cy, .36, .36, -.02, .5, 0, {}, true);
    if (b - a > 3.2) P('plant', 'pot', b - .55, s * (EDGE + .55), .6, .6, -.02, 1.3, 0, {potR: .2, type: 'bush'}, true);
  }
  return {items, props};
}
// solid facade: stone piers between rooms, solid core wall on the back facade, solid end walls with one window slot per room
function facade(lv, L){
  const items = [], B = (m, x0, x1, y0, y1, z0, z1) => items.push({t: 'b', m, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0, z1});
  if (typeof lv !== 'number' || lv < 4 || lv > 17) return items;
  const z0 = -.45, z1 = FLOOR_H - .45, GL = GY, ED = SLAB.y, EX = GX;
  for (const side of [-1, 1]) {
    const rs = L.rooms.filter(r => r.side === side).sort((a, b) => a.x0 - b.x0);
    for (let i = 0; i < rs.length - 1; i++) { const xm = (rs[i].x1 + rs[i + 1].x0) / 2; if (Math.abs(xm) > 12.2) continue; B('cladding', xm - .45, xm + .45, side * (GL - .02), side * (ED - .02), z0, z1); }
  }
  B('cladding', -8.3, 8.3, GL - .02, ED - .02, z0, z1);                                              // back facade over the lift / stair core
  for (let x = -6; x <= 6; x += 6) B('glassClear', x - .3, x + .3, ED - .03, ED - .01, .9, 2.3);       // narrow slot windows (stairs / corridor)
  for (const sx of [-1, 1]) {                                                                        // end walls: solid except one window per room
    const xa = sx * (EX - .02), xb = sx * (SLAB.x - .02);
    B('cladding', xa, xb, -6.67, -5.1, z0, z1); B('cladding', xa, xb, -2.9, 2.9, z0, z1); B('cladding', xa, xb, 5.1, 6.67, z0, z1);
    for (const y of [-4, 4]) { B('cladding', xa, xb, y - 1.1, y + 1.1, z0, .45); B('cladding', xa, xb, y - 1.1, y + 1.1, 2.6, z1); }
  }
  // chamfered corners: stone panel between the corner glass and the slab edge (no bare slab ledge), with a corner window
  const L2 = SLAB.ch * Math.SQRT2, T = .36, WO = .7;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const nx = sx / Math.SQRT2, ny = sy / Math.SQRT2, tx = -ny, ty = nx;                       // outward normal, tangent
    const mx = sx * (SLAB.x - SLAB.ch / 2) - nx * T / 2, my = sy * (SLAB.y - SLAB.ch / 2) - ny * T / 2, rot = Math.atan2(ty, tx);
    const R = (u0, u1, za, zb) => items.push({t: 'b', m: 'cladding', rot, cx: mx + tx * (u0 + u1) / 2, cy: my + ty * (u0 + u1) / 2, w: u1 - u0, d: T, z0: za, z1: zb});
    R(-L2 / 2, L2 / 2, z0, .45); R(-L2 / 2, L2 / 2, 2.6, z1); R(-L2 / 2, -WO, .45, 2.6); R(WO, L2 / 2, .45, 2.6);
    B('cladding', sx * 12.28, sx * (SLAB.x - SLAB.ch + .05), sy * (GL - .02), sy * (ED - .02), z0, z1);   // close the strip between the last balcony wall and the chamfer
  }
  return items;
}
export const LEVELS = ['G', 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
export function buildTower(scene){
  const floors = {}, inst = new Map(), _m = new THREE.Matrix4(), _r = new THREE.Matrix4();
  for (const lv of LEVELS) {
    const G = new THREE.Group(); G.name = 'Level_' + lv; G.position.y = FLOORZ[lv]; scene.add(G);
    const slab = new THREE.Mesh(slabGeo(lv), MATS.slab); slab.receiveShadow = true; G.add(slab);
    const L = floorLayout(lv), byMat = {};
    for (const it of L.items) {
      if (it.t === 'clear') continue;
      if (it.t === 'p') {                                       // instanced furniture
        const {key, parts} = buildProp(it); let e = inst.get(key); if (!e) inst.set(key, e = {parts, mats: []});
        _m.makeTranslation(it.cx, FLOORZ[lv] + it.z0, -it.cy).multiply(_r.makeRotationY(it.ang)); e.mats.push(_m.clone()); continue;
      }
      if (it.t === 'b' && typeof lv === 'number' && lv >= 4 && lv <= 17 && it.z1 - it.z0 <= .05 && crossesCham(it)) { const g = floorGeo(it); if (g) (byMat[it.m] ||= []).push(g); continue; }
      (byMat[it.m] ||= []).push(it.t === 'b' ? boxGeo(it) : cylGeo(it));
    }
    for (const it of facade(lv, L)) (byMat[it.m] ||= []).push(boxGeo(it));
    const BAL = balconies(lv, L);
    for (const it of BAL.items) (byMat[it.m] ||= []).push(boxGeo(it));
    for (const it of BAL.props) { const {key, parts} = buildProp(it); let e = inst.get(key); if (!e) inst.set(key, e = {parts, mats: []}); _m.makeTranslation(it.cx, FLOORZ[lv] + it.z0, -it.cy).multiply(_r.makeRotationY(it.ang)); e.mats.push(_m.clone()); }
    for (const it of L.items) if (isWallCut(it)) (byMat.wallCap ||= []).push(boxGeo({...it, z0: it.z1, z1: it.z1 + .012}));
    for (const [m, geos] of Object.entries(byMat)) { const geo = planarUV(mergeGeometries(geos, false), uvSize(m)); const mesh = new THREE.Mesh(geo, MATS[m] || MATS.wall); mesh.name = `L${lv}_${m}`; G.add(mesh); geos.forEach(g => g.dispose()); }
    // invisible pick boxes per room
    const picks = L.rooms.map(r => { const b = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 2.4, r.y1 - r.y0), new THREE.MeshBasicMaterial({color: 0xc9a24a, transparent: true, opacity: 0, depthWrite: false})); b.position.set((r.x0 + r.x1) / 2, 1.2, -(r.y0 + r.y1) / 2); b.userData.room = r; G.add(b); return b; });
    floors[lv] = {group: G, layout: L, picks, type: L.type};
  }
  // podium roof over L3 (around the tower): structural slab, green roof, gravel margin, stone parapet + glass rail
  { const z = FLOORZ[4] - .06, PX2 = 24.45, PY2 = 13.95, {x: sx, y: sy, ch} = SLAB, roof = [], add = (m, g) => roof.push([m, g]);
    const shape = () => { const s = new THREE.Shape(); s.moveTo(-PX2, -PY2); s.lineTo(PX2, -PY2); s.lineTo(PX2, PY2); s.lineTo(-PX2, PY2); s.closePath();
      const h = new THREE.Path(), o = [[-sx + ch, -sy], [sx - ch, -sy], [sx, -sy + ch], [sx, sy - ch], [sx - ch, sy], [-sx + ch, sy], [-sx, sy - ch], [-sx, -sy + ch]]; h.moveTo(...o[0]); o.slice(1).forEach(p => h.lineTo(...p)); h.closePath(); s.holes.push(h); return s; };
    const slab = new THREE.ExtrudeGeometry(shape(), {depth: .4, bevelEnabled: false}); slab.rotateX(-Math.PI / 2); slab.translate(0, z - .4, 0); add('slab', slab);
    const top = new THREE.ShapeGeometry(shape()); top.rotateX(-Math.PI / 2); top.translate(0, z + .005, 0); add('cladding', top);
    const bx = (m, x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0); g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); add(m, g); };
    const M2 = .9;   // gravel margin inside the parapet
    bx('slabEdge', -PX2 + .25, PX2 - .25, -PY2 + .25, -PY2 + M2, z, z + .03); bx('slabEdge', -PX2 + .25, PX2 - .25, PY2 - M2, PY2 - .25, z, z + .03);
    bx('slabEdge', -PX2 + .25, -PX2 + M2, -PY2 + M2, PY2 - M2, z, z + .03); bx('slabEdge', PX2 - M2, PX2 - .25, -PY2 + M2, PY2 - M2, z, z + .03);
    for (const [x0, x1, y0, y1] of [[-PX2, PX2, -PY2, -PY2 + .25], [-PX2, PX2, PY2 - .25, PY2], [-PX2, -PX2 + .25, -PY2, PY2], [PX2 - .25, PX2, -PY2, PY2]]) { bx('cladding', x0, x1, y0, y1, z - .4, z + .6); bx('balGlass', (x0 + x1) / 2 - (x1 - x0) / 2 + .1 * 0, x1, y0, y1, z + .6, z + 1.1); bx('steel', x0, x1, y0, y1, z + 1.1, z + 1.14); }
    for (const [m, g] of roof) { const geo = planarUV(g.index ? g.toNonIndexed() : g, uvSize(m)); const mesh = new THREE.Mesh(geo, MATS[m]); mesh.name = 'PodiumRoof_' + m; scene.add(mesh); }
  }
  // furniture: one InstancedMesh per (prop variant, material) across all levels
  const props = new THREE.Group(); props.name = 'Props'; scene.add(props); let draws = 0, count = 0;
  for (const [key, {parts, mats}] of inst) for (const [m, geo] of Object.entries(parts)) {
    if (!geo.attributes.uv) planarUV(geo, uvSize(m));
    const im = new THREE.InstancedMesh(geo, MATS[m] || MATS.wall, mats.length); mats.forEach((x, i) => im.setMatrixAt(i, x)); im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.name = key + '#' + m; im.userData.small = SMALL.has(key.split('|')[0]) || (m === 'glassClear' || m === 'steel' && /tableRound|tableRect/.test(key)); props.add(im); draws++; count += mats.length;
  }
  console.log(`[tower] props: ${inst.size} variants, ${draws} instanced meshes, ${count} instances`);
  // lift cars: 3 guest + 1 service, travelling G..L18
  const cars = SHAFTS.map((s, i) => { const c = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0 - .1, 2.5, s.y1 - s.y0 - .1), M(i === 0 ? 0x8f949a : 0xf3e6c8, .4, .3, {emissive: i === 0 ? 0x000000 : 0xffc98a, emissiveIntensity: .35})); c.position.set((s.x0 + s.x1) / 2, 2, -(s.y0 + s.y1) / 2); c.userData.ph = i * 1.7; scene.add(c); return c; });
  // shaft walls between levels where no floor layout exists (podium + amenity floors keep the shafts continuous)
  const shaftMat = M(0x5d5852, .9), shaftGeos = [];
  for (const s of SHAFTS) for (const [x0, x1, y0, y1] of [[s.x0 - .15, s.x0, s.y0 - .15, s.y1 + .15], [s.x1, s.x1 + .15, s.y0 - .15, s.y1 + .15], [s.x0, s.x1, s.y1, s.y1 + .15]]) {
    const top = FLOORZ[18] - SLAB_T, g = new THREE.BoxGeometry(x1 - x0, top - .45, y1 - y0); g.translate((x0 + x1) / 2, (top + .45) / 2, -(y0 + y1) / 2); shaftGeos.push(g.toNonIndexed());
  }
  const shaftMesh = new THREE.Mesh(mergeGeometries(shaftGeos), shaftMat); shaftMesh.name = 'LiftShafts'; scene.add(shaftMesh);
  const smalls = props.children.filter(c => c.userData.small); let near = true;
  return {floors, cars, shaftMesh, props, lod(cam){ const d = Math.hypot(cam.position.x, cam.position.z), n = d < 70 || cam.position.y < 70 && d < 110; if (n !== near) { near = n; smalls.forEach(c => c.visible = n); } }, update(t){ cars.forEach(c => { const u = .5 - .5 * Math.cos(t * .16 + c.userData.ph); c.position.y = FLOORZ.G + 1.3 + (FLOORZ[17] - FLOORZ.G) * u; }); }};
}
export {floorLayout, FLOORZ, guestType};
