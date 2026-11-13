// Builds the Aurelia tower interiors in three.js from js/layout.js (single source of truth).
// Walls / floors / built-ins are merged per material per level; furniture comes from js/props.js and is instanced.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {floorLayout, FLOORZ, SLAB_T, slabHoles, guestType, SHAFTS, GX, GY, SLAB, FLOOR_H, CEIL} from './layout.js';
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
const FAB = tex(256, (g, s, r) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); noise(g, s, r, .22, 1); g.strokeStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < s; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); } });
const LEATHER = tex(256, (g, s, r) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${r() * .08})`; g.beginPath(); g.arc(r() * s, r() * s, 1 + r() * 3, 0, 7); g.fill(); } });
const TEXSIZE = {velvetCream: .25, velvetBlush: .25, velvetGreen: .25, velvetNavy: .25, linen: .3, duvet: .3, throw: .25, leather: .35, towel: .2};

const M = (c, r = .6, m = 0, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: m, ...o});
export const MATS = {
  wall: M(0xd6cbb6, .85), concrete: M(0x8d877e, .9), marble: M(0xd9d1c2, .25), marbleBlack: M(0x17171a, .2, .1), marbleDark: M(0x6f6a64, .35), marbleFloor: M(0xbfb19a, .25),
  woodFloor: M(0x8a6443, .55), floorStone: M(0xb9ab92, .45), floorService: M(0x9c978f, .8), carpetRed: M(0x7d1d26, .95), walnut: M(0x4b3121, .5), linen: M(0xefe9df, .95), duvet: M(0xf6f2ea, .95),
  throw: M(0x1f5a43, .9), velvetCream: M(0xd9cbb2, .9), velvetBlush: M(0xb98a84, .9), velvetGreen: M(0x1d5a40, .9), velvetNavy: M(0x1c2d4f, .9), leather: M(0x6e3b1d, .55), rug: M(0x9c8c70, 1),
  ceramic: M(0xf5f3ef, .15), glassShower: M(0xcfe6ef, .05, .1, {transparent: true, opacity: .28, depthWrite: false}), mirror: M(0xcfd8dc, .04, 1), tv: M(0x07080a, .15, .4),
  gold: M(0xc9a24a, .3, .95), steel: M(0x9aa0a6, .35, .8), stair: M(0xcfc6b4, .7), stairNose: M(0x6e6a63, .5, .5), sheer: M(0xf3efe7, 1, 0, {transparent: true, opacity: .35, depthWrite: false}),
  drape: M(0x8f7c5e, .95), acWhite: M(0xeef1f3, .4), acGrille: M(0x3a3f44, .5), pot: M(0xd2c7b2, .7), leaf: M(0x3b7a3a, .75), leafDark: M(0x23502a, .8), blossom: M(0xe3a8b5, .8),
  lampShade: M(0xfff1d6, .7, 0, {emissive: 0xffc98a, emissiveIntensity: .7}), lampGlow: M(0xfff0d0, .5, 0, {emissive: 0xffc070, emissiveIntensity: 1.2}), water: M(0x5fb4d6, .05, .1, {transparent: true, opacity: .85}),
  towel: M(0xfafaf7, 1), art: M(0x5a2e30, .7), book: M(0x6b4a2e, .8), red: M(0xb3262b, .6), black: M(0x0a0a0b, .45), glassClear: M(0xd9ecf2, .05, 0, {transparent: true, opacity: .4, depthWrite: false}), bottleGreen: M(0x1f4f2a, .15, 0, {transparent: true, opacity: .9}),
  slab: M(0xb7a98f, .7), slabEdge: M(0xcbbd9f, .6), pianoBlack: M(0x050506, .06, .2), bread: M(0xb9803e, .8), chef: M(0x22262c, .7), rubber: M(0x2a2b2e, .9), woodSauna: M(0xb98a52, .7), deck: M(0x8a6a4a, .7),
  soil: M(0x2e2118, 1), trunk: M(0x4a3523, .9), chrome: M(0xdfe3e6, .12, 1), screen: M(0x0b1018, .08, .3, {emissive: 0x0a1626, emissiveIntensity: .6}), skin: M(0xc99a78, .7), tubIn: M(0xf5f3ef, .12), wine: M(0x4a0d16, .15, 0, {transparent: true, opacity: .92}),
  deckPaint: M(0x6a6d70, .8), asphaltDeck: M(0x3c3e42, .9), lineWhite: M(0xf2f2ee, .6), lineYellow: M(0xe8b524, .6), walkGreen: M(0x3f7a52, .8), accessBlue: M(0x1f5fb0, .7),
  carWhite: M(0xeef0f2, .25, .3), carBlack: M(0x101114, .2, .5), carSilver: M(0xaab0b6, .25, .8), carNavy: M(0x1a2a4a, .25, .5), carRed: M(0x8e1a22, .25, .4), carGold: M(0xa48a5a, .3, .7),
  glassCar: M(0x10161c, .05, .6), tyre: M(0x151515, .9)
};
for (const k of ['drape', 'sheer', 'tubIn', 'glassClear', 'lampShade', 'glassShower', 'water', 'leaf', 'leafDark', 'blossom']) MATS[k].side = THREE.DoubleSide;
for (const [k, [t]] of Object.entries(T)) if (MATS[k]) { MATS[k].map = t; MATS[k].color.set(0xffffff); }
MATS.marbleFloor.color.set(0xf0ebe2); MATS.carpetRed.roughness = 1;
for (const k of Object.keys(TEXSIZE)) MATS[k].map = k === 'leather' ? LEATHER : FAB;
const uvSize = m => T[m]?.[1] ?? TEXSIZE[m] ?? 1;

function boxGeo(it){
  const w = it.x1 - it.x0, d = it.y1 - it.y0, h = it.z1 - it.z0;
  const g = it.soft && Math.min(w, d, h) > .05 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(.05, Math.min(w, d, h) * .45)) : new THREE.BoxGeometry(w, h, d);
  g.translate((it.x0 + it.x1) / 2, (it.z0 + it.z1) / 2, -(it.y0 + it.y1) / 2);   // Blender (x, y, z) -> three (x, z, -y)
  return g.index ? g.toNonIndexed() : g;
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
  if (lv !== 'G') for (const h of slabHoles()) { const p = new THREE.Path(); p.moveTo(h.x0, h.y0); p.lineTo(h.x0, h.y1); p.lineTo(h.x1, h.y1); p.lineTo(h.x1, h.y0); p.closePath(); s.holes.push(p); }
  const g = new THREE.ExtrudeGeometry(s, {depth: SLAB_T, bevelEnabled: false});
  g.rotateX(-Math.PI / 2);                                  // shape (x, y) -> three (x, 0, -y), extrudes upward
  g.translate(0, -SLAB_T, 0);
  return g;
}

const SMALL = new Set(['bottle', 'books', 'bookcase', 'flowers', 'tableLamp', 'basinSet', 'towelBar', 'pastryTray', 'cakeStand', 'chafing', 'monitor', 'barShelf', 'wineWall', 'chandelier', 'pendant', 'umbrella']);
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
      (byMat[it.m] ||= []).push(it.t === 'b' ? boxGeo(it) : cylGeo(it));
    }
    for (const [m, geos] of Object.entries(byMat)) { const geo = planarUV(mergeGeometries(geos, false), uvSize(m)); const mesh = new THREE.Mesh(geo, MATS[m] || MATS.wall); mesh.name = `L${lv}_${m}`; G.add(mesh); geos.forEach(g => g.dispose()); }
    // invisible pick boxes per room
    const picks = L.rooms.map(r => { const b = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 2.4, r.y1 - r.y0), new THREE.MeshBasicMaterial({color: 0xc9a24a, transparent: true, opacity: 0, depthWrite: false})); b.position.set((r.x0 + r.x1) / 2, 1.2, -(r.y0 + r.y1) / 2); b.userData.room = r; G.add(b); return b; });
    floors[lv] = {group: G, layout: L, picks, type: L.type};
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
    const g = new THREE.BoxGeometry(x1 - x0, FLOORZ[18] + CEIL - .45, y1 - y0); g.translate((x0 + x1) / 2, (FLOORZ[18] + CEIL + .45) / 2, -(y0 + y1) / 2); shaftGeos.push(g.toNonIndexed());
  }
  const shaftMesh = new THREE.Mesh(mergeGeometries(shaftGeos), shaftMat); shaftMesh.name = 'LiftShafts'; scene.add(shaftMesh);
  const smalls = props.children.filter(c => c.userData.small); let near = true;
  return {floors, cars, shaftMesh, props, lod(cam){ const d = Math.hypot(cam.position.x, cam.position.z), n = d < 70 || cam.position.y < 70 && d < 110; if (n !== near) { near = n; smalls.forEach(c => c.visible = n); } }, update(t){ cars.forEach(c => { const u = .5 - .5 * Math.cos(t * .16 + c.userData.ph); c.position.y = FLOORZ.G + 1.3 + (FLOORZ[18] - FLOORZ.G) * u; }); }};
}
export {floorLayout, FLOORZ, guestType};
