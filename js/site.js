// Aurelia Tower site plan, built procedurally (Blender coords: x east, y north, z up; the river road is at y -70..-54).
// Replaces the exported site landscape with one coherent design:
//   front  - street sidewalk + trees, name-sign island between separate entry/exit lanes, one-way roundabout around a tiered
//            fountain that passes under the entrance canopy, branch roads to the parking garage (east) and spa (west),
//            service lanes from the river road, formal gardens with reflecting pools, covered walkways
//   garage - 3 decks + roof parking, scissor ramps, stall markings, lights, parked cars
//   rear   - pool terrace, resort pool with island, sun deck, cabanas, tennis court, event lawn + gazebo, pool villas, jogging path
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildProp, planarUV} from './props.js';
import {MATS} from './tower.js';

const TAU = Math.PI * 2;
function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tex(size, draw){ const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size, rng(size + draw.length * 13)); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t; }
function noise(g, s, r, a = .1, cell = 2){ for (let y = 0; y < s; y += cell) for (let x = 0; x < s; x += cell) { const v = r(); g.fillStyle = v > .5 ? `rgba(255,255,255,${(v - .5) * a})` : `rgba(0,0,0,${(.5 - v) * a})`; g.fillRect(x, y, cell, cell); } }
const tiles = (base, l0, dl, grout, n) => (g, s, r) => { const c = s / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = `hsl(${base},${l0[0]}%,${l0[1] + r() * dl}%)`; g.fillRect(i * c, j * c, c, c); } noise(g, s, r, .1, 2); g.fillStyle = grout; for (let i = 0; i <= n; i++) { g.fillRect(i * c - 1, 0, 2, s); g.fillRect(0, i * c - 1, s, 2); } };
const TX = {
  grass: tex(512, (g, s, r) => { g.fillStyle = '#4c7a36'; g.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; g.fillRect(i * s / 4, 0, s / 4, s); } noise(g, s, r, .22, 2); }),
  asphalt: tex(512, (g, s, r) => { g.fillStyle = '#3b3d41'; g.fillRect(0, 0, s, s); noise(g, s, r, .25, 2); }),
  paver: tex(512, tiles(38, [24, 70], 7, 'rgba(95,82,64,.55)', 4)),
  granite: tex(512, tiles(30, [6, 30], 6, 'rgba(10,10,10,.6)', 4)),
  gravel: tex(256, (g, s, r) => { g.fillStyle = '#c7b796'; g.fillRect(0, 0, s, s); noise(g, s, r, .45, 2); }),
};
const SM = (c, r, o = {}) => new THREE.MeshStandardMaterial({color: c, roughness: r, ...o});
const SMAT = {
  grass: SM(0xffffff, 1, {map: TX.grass}), asphaltS: SM(0xffffff, .95, {map: TX.asphalt}), paver: SM(0xffffff, .75, {map: TX.paver}), paverDark: SM(0xffffff, .55, {map: TX.granite}), gravel: SM(0xffffff, 1, {map: TX.gravel}),
  curb: SM(0xb9b3a7, .8), hedge: SM(0x2d5a2b, .95), poolWater: SM(0x1683bd, .03, {metalness: .1, transparent: true, opacity: .6, depthWrite: false}), courtBlue: SM(0x2d5d8e, .85), courtGreen: SM(0x3b6b48, .85),
  terracotta: SM(0x6e3b2a, .8), fenceMesh: SM(0x1e2522, .7, {transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide}), sand: SM(0xdccca4, 1),
};
const UV = {poolTile: 2, grass: 6, asphaltS: 4, paver: 2.4, paverDark: 2.4, gravel: 2, deck: 1.4, marble: 1.8};
const MAT = m => SMAT[m] || MATS[m] || MATS.wall;

// exported site parts replaced by this file (tower, podium, entrance canopy, sign monolith, gate pillars, spa pavilion and the city stay)
const HIDE = /^(Drv_(DrvAsphalt|DrvCurb|CMarkW|Lane\d|Grass\d|Hedge|Leaf|Bloom.|Bronze|LedWarm|LuxGold|LuxLacquerBlack|Pool|Travertine|P\d)|Garden_|Bal_|Bench_|Garage_|Green_Tree|Hedge_|Palm_|Ppl_|Rear_|Site_(Plaza|Pool|Planter|Sidewalk)|Flag_|Entrance_Canopy|Spa_Base|Spa_InteriorGlow|Park_Car|Quay_Tree)/;

export function buildSite(scene){
  scene.traverse(o => { if (o.name && HIDE.test(o.name)) o.visible = false; });
  // the exported ground planes sit at z 0: draw them first without depth so the sunken pools can be seen below ground level
  [['Site_Ground', -3], ['OsmG_CGround', -2]].forEach(([n, ro]) => scene.getObjectByName(n)?.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.depthWrite = false; m.renderOrder = ro; } }));
  const G = {}, put = (m, g) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); (G[m] ||= []).push(g); };
  const box = (m, x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0), z1 - z0, Math.abs(y1 - y0)); g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); put(m, g); };
  const rbox = (m, cx, cy, w, d, z0, z1, ang = 0, tilt = 0) => { const g = new THREE.BoxGeometry(w, z1 - z0, d); if (tilt) g.rotateX(tilt); g.rotateY(ang); g.translate(cx, (z0 + z1) / 2, -cy); put(m, g); };
  const shp = pts => { const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); s.closePath(); return s; };
  const rect = (x0, x1, y0, y1) => shp([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  const disc = (cx, cy, r) => { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, TAU, false); return s; };
  const ring = (cx, cy, r0, r1, a0 = 0, a1 = TAU) => { const s = new THREE.Shape(); if (a1 - a0 >= TAU - 1e-6) { s.absarc(cx, cy, r1, 0, TAU, false); const h = new THREE.Path(); h.absarc(cx, cy, r0, 0, TAU, true); s.holes.push(h); } else { s.absarc(cx, cy, r1, a0, a1, false); s.absarc(cx, cy, r0, a1, a0, true); s.closePath(); } return s; };
  const blobShape = (cx, cy, a, b, wob, n = 96) => { const pts = []; for (let i = 0; i < n; i++) { const t = i / n * TAU, k = 1 + wob(t); pts.push([cx + Math.cos(t) * a * k, cy + Math.sin(t) * b * k]); } return shp(pts); };
  const flat = (m, s, z, seg = 64) => { const g = new THREE.ShapeGeometry(s, seg); g.rotateX(-Math.PI / 2); g.translate(0, z, 0); put(m, g); };
  const slab = (m, s, z0, z1, seg = 64) => { const g = new THREE.ExtrudeGeometry(s, {depth: z1 - z0, bevelEnabled: false, curveSegments: seg}); g.rotateX(-Math.PI / 2); g.translate(0, z0, 0); put(m, g); };
  const props = [], glows = [], P = (kind, m, x, y, w, d, z0, z1, ang = 0, o = {}) => {
    props.push({kind, m, cx: x, cy: y, w, d, z0, z1, ang, o});
    if (kind === 'lampPost') glows.push([x, y, z0 + .03, 5.5]); else if (kind === 'bollard' && z0 < .5) glows.push([x, y, z0 + .03, 2.4]); else if (kind === 'palm') glows.push([x, y, z0 + .07, 2.0, .55]);
  };
  const R = rng(2027);
  const Z = {lawn: .01, pave: .03, road: .045, mark: .052};
  const arrow = () => shp([[-.2, -1.3], [.2, -1.3], [.2, .2], [.55, .2], [0, 1.3], [-.55, .2], [-.2, .2]]);
  const arrowAt = (x, y, dir) => { const g = new THREE.ShapeGeometry(arrow()); g.rotateZ(dir); g.translate(x, y, 0); g.rotateX(-Math.PI / 2); g.translate(0, Z.mark + .001, 0); put('lineWhite', g); };
  const dashX = (m, x0, x1, y, w = .15, dash = 3, gap = 3) => { for (let x = x0; x < x1 - .1; x += dash + gap) box(m, x, Math.min(x + dash, x1), y - w / 2, y + w / 2, Z.mark, Z.mark + .002); };
  const dashY = (m, x, y0, y1, w = .15, dash = 3, gap = 3) => { for (let y = y0; y < y1 - .1; y += dash + gap) box(m, x - w / 2, x + w / 2, y, Math.min(y + dash, y1), Z.mark, Z.mark + .002); };
  const zebraX = (x0, x1, y0, y1) => { for (let x = x0 + .3; x < x1 - .3; x += 1.0) box('lineWhite', x, x + .5, y0, y1, Z.mark, Z.mark + .002); };     // stripes along y (crossing a road that runs along y)
  const zebraY = (x0, x1, y0, y1) => { for (let y = y0 + .3; y < y1 - .3; y += 1.0) box('lineWhite', x0, x1, y, y + .5, Z.mark, Z.mark + .002); };     // stripes along x (crossing a road that runs along x)
  const hedge = (x0, x1, y0, y1, h = .9) => box('hedge', x0, x1, y0, y1, Z.lawn, h);
  const curbX = (x0, x1, y) => box('curb', x0, x1, y - .08, y + .08, Z.lawn, .16);
  const curbY = (x, y0, y1) => box('curb', x - .08, x + .08, y0, y1, Z.lawn, .16);
  const tree = (x, y, s = 1, type = 'rain') => P('tree', 'trunk', x, y, 9 * s * (type === 'frangi' ? .5 : 1), 9 * s, 0, (type === 'frangi' ? 4.5 : 9.5) * s, R() * TAU, {type, seed: Math.floor(R() * 4)});
  const palm = (x, y, h = 8) => P('palm', 'trunk', x, y, 6, 6, 0, h, R() * TAU, {seed: Math.floor(R() * 5)});
  const lamp = (x, y, h = 4.2) => P('lampPost', 'bronze', x, y, .45, .45, Z.pave, Z.pave + h);
  const bollard = (x, y) => P('bollard', 'bronze', x, y, .2, .2, Z.pave, Z.pave + .9);
  const bench = (x, y, ang) => P('parkBench', 'deck', x, y, 1.8, .65, Z.pave, Z.pave + .85, ang);

  // ================= ground =================
  const PC = [0, 44], wob = t => .07 * Math.sin(3 * t + .6) + .05 * Math.cos(5 * t);
  const V2 = a => a.map(p => Array.isArray(p) ? new THREE.Vector2(p[0], p[1]) : p);
  const POOL = blobShape(PC[0], PC[1], 28, 12, wob).getPoints(96), VILLAX = [-75, -45, -15, 15, 45, 75], VPOOL = cx => [[cx - 5, 77.8], [cx + .2, 77.8], [cx + .2, 80.7], [cx - 5, 80.7]];
  const holed = (sh, list) => { for (const h of list) sh.holes.push(new THREE.Path(V2(h))); return sh; };
  // sunken pool: tiled walls + floor, transparent water, underwater lights
  const basin = (pts, zTop, zFloor, zWater) => {
    const V = V2(pts), pos = [];
    for (let i = 0; i < V.length; i++) { const a = V[i], b = V[(i + 1) % V.length]; pos.push(a.x, zTop, -a.y, b.x, zTop, -b.y, b.x, zFloor, -b.y, a.x, zTop, -a.y, b.x, zFloor, -b.y, a.x, zFloor, -a.y); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); put('poolTile', g);
    const sh = new THREE.Shape(V); flat('poolTile', sh, zFloor); flat('poolWater', new THREE.Shape(V), zWater);
    for (let i = 0; i < V.length; i += Math.max(1, Math.floor(V.length / 10))) { const a = V[i]; box('lampGlow', a.x - .12, a.x + .12, a.y - .12, a.y + .12, (zFloor + zWater) / 2 - .05, (zFloor + zWater) / 2 + .05); }
  };
  flat('grass', holed(rect(-100, 100, -50, 106), [POOL, ...VILLAX.map(VPOOL)]), Z.lawn);
  flat('paver', rect(-112, 112, -54, -50), Z.pave);                                   // street sidewalk
  curbX(-112, 112, -54);
  // ================= front: entry / exit / roundabout =================
  const C = [0, -33], RI = 10, RO = 17;                                                 // roundabout centre, inner/outer radius
  flat('paver', rect(-24.5, 24.5, -25, -13.6), Z.pave);                               // entrance forecourt (drop-off under the canopy)
  flat('paver', ring(C[0], C[1], RO, RO + 3.5), Z.pave);                              // sidewalk ring
  for (const s of [-1, 1]) flat('paver', rect(Math.min(s * 16, s * 19.5), Math.max(s * 16, s * 19.5), -50, -40), Z.pave);
  flat('asphaltS', ring(C[0], C[1], RI, RO), Z.road);
  flat('asphaltS', rect(-16, -9, -54, -42), Z.road + .001); flat('asphaltS', rect(9, 16, -54, -42), Z.road + .001);    // entry (west) / exit (east)
  flat('asphaltS', rect(-50, -13, -41, -34.5), Z.road + .001); flat('asphaltS', rect(13, 50, -41, -34.5), Z.road + .001);   // branch roads
  flat('asphaltS', rect(-48, -41, -54, -41), Z.road + .002); flat('asphaltS', rect(41, 48, -54, -41), Z.road + .002);     // service lanes
  // island: curb, flower ring, lawn, fountain
  slab('curb', ring(C[0], C[1], RI - .25, RI), Z.lawn, .18);
  flat('grass', disc(C[0], C[1], RI - .25), .17); slab('hedge', ring(C[0], C[1], RI - 1.7, RI - .9), .17, .75);
  for (let i = 0; i < 44; i++) { const a = i / 44 * TAU; P('flowers', 'leaf', C[0] + Math.cos(a) * (RI - .55), C[1] + Math.sin(a) * (RI - .55), .5, .5, .17, .6, 0, {vase: 'leaf', cols: i % 2 ? ['red', 'blossom'] : ['linen', 'blossom']}); }
  P('fountain', 'marble', C[0], C[1], 15, 15, .17, 5.8);
  // outer curbs (gaps where lanes / branches / forecourt meet the ring)
  // kept arcs (angle from +x, ccw): south between the lanes, east and west between the branch roads and the forecourt
  for (const [a0, a1] of [[-2.13, -1.01], [0, .49], [2.65, Math.PI]]) slab('curb', ring(C[0], C[1], RO, RO + .16, a0, a1), Z.lawn, .16);
  // markings: ring edge lines, clockwise arrows (left-hand traffic), give-way lines at the entries, stop lines at the street
  slab('lineWhite', ring(C[0], C[1], RI + .35, RI + .5), Z.road, Z.mark + .002); slab('lineWhite', ring(C[0], C[1], RO - .5, RO - .35), Z.road, Z.mark + .002);
  for (const a of [-2.6, -1.0, .2, 1.4, 2.4]) { const r = (RI + RO) / 2; arrowAt(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r, a + Math.PI); }   // clockwise: heading = a - 90deg
  for (let a = -2.8; a < -2.13; a += .06) rbox('lineWhite', C[0] + Math.cos(a) * (RO + .5), C[1] + Math.sin(a) * (RO + .5), .45, .3, Z.mark, Z.mark + .002, a);   // give-way teeth at the entry
  box('lineWhite', 9.2, 15.8, -52.5, -52.1, Z.mark, Z.mark + .002); box('lineWhite', -47.8, -44.6, -52.5, -52.1, Z.mark, Z.mark + .002); box('lineWhite', 44.6, 47.8, -52.5, -52.1, Z.mark, Z.mark + .002);
  arrowAt(-12.5, -51.5, 0); arrowAt(12.5, -49.5, Math.PI);
  zebraX(-16, -9, -53.8, -50.2); zebraX(9, 16, -53.8, -50.2); zebraX(-48, -41, -53.8, -50.2); zebraX(41, 48, -53.8, -50.2);
  zebraY(-21, -18.2, -41, -34.5); zebraY(18.2, 21, -41, -34.5);                                                                                     // walkway crossings over the branch roads
  for (const s of [-1, 1]) { dashX('lineYellow', Math.min(s * 19, s * 50), Math.max(s * 19, s * 50), -37.75); dashY('lineYellow', s * 44.5, -54, -41); }
  // lane edge curbs
  for (const s of [-1, 1]) { curbY(s * 16, -50, -39); curbY(s * 41, -50, -41); curbY(s * 48, -50, -41); curbX(Math.min(s * 19.5, s * 41), Math.max(s * 19.5, s * 41), -41); curbX(Math.min(s * 19.5, s * 41), Math.max(s * 19.5, s * 41), -34.5); }
  // sign island between the lanes (the exported monolith + gate pillars stand here)
  slab('curb', rect(-9, 9, -54, -50.6), Z.lawn, .18); flat('grass', rect(-8.8, 8.8, -53.8, -50.8), .181);
  for (let i = 0; i < 15; i++) if (Math.abs(-7 + i) > 2.6) P('flowers', 'leaf', -7 + i, i % 2 ? -51.4 : -53.2, .55, .55, .18, .6, 0, {vase: 'leaf', cols: ['red', 'blossom', 'linen']});
  // bollards + lamps along the drive, flag poles on the ring sidewalk
  for (let i = 0; i < 9; i++) { const a = Math.PI / 2 + (i - 4) * .26; if (Math.abs(i - 4) < 1) continue; bollard(C[0] + Math.cos(a) * (RO + .5), C[1] + Math.sin(a) * (RO + .5)); }
  for (const a of [-2.75, -.4, .4, 2.75]) lamp(C[0] + Math.cos(a) * (RO + 2.6), C[1] + Math.sin(a) * (RO + 2.6), 4.6);
  [-23, -20.5, 20.5, 23].forEach((x, i) => P('flagPole', 'steel', x, -17, .3, .3, Z.pave, 9, 0, {cloth: ['red', 'velvetNavy', 'velvetNavy', 'red'][i]}));
  // porte-cochere: cantilevered canopy over the drop-off lane, held by tie-rods from the podium face (no columns in the road)
  { const x0 = -11, x1 = 11, y0 = -22.5, y1 = -13.6, z = 4.7;
    box('whitePaint', x0, x1, y0, y1, z, z + .35); box('gold', x0 - .05, x1 + .05, y0 - .05, y0 + .05, z, z + .35); box('gold', x0 - .05, x0 + .05, y0, y1, z, z + .35); box('gold', x1 - .05, x1 + .05, y0, y1, z, z + .35);
    for (let x = x0 + 1.5; x < x1 - 1; x += 3) for (let y = y0 + 1.5; y < y1 - .5; y += 2.5) { box('lampGlow', x - .25, x + .25, y - .25, y + .25, z - .02, z); glows.push([x, y, Z.road + .012, 2.6]); }
    for (const x of [-8, -3, 3, 8]) { const A = new THREE.Vector3(x, z + .35, -(y0 + .4)), B = new THREE.Vector3(x, z + 5.2, -(y1 - .05)), d = B.clone().sub(A), g = new THREE.CylinderGeometry(.04, .04, d.length(), 8); g.translate(0, d.length() / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z); put('steel', g); box('steel', x - .15, x + .15, y1 - .1, y1, z + 5.0, z + 5.4); }
    box('steel', x0, x1, y1 - .25, y1, z - .1, z + .45); }
  // entrance steps up to the lobby floor (+0.45)
  for (let i = 0; i < 3; i++) box('marble', -7, 7, -15.5 + i * .5, -13.6, Z.pave, Z.pave + .14 * (i + 1));
  for (const s of [-1, 1]) for (const x of [10, 17]) P('plant', 'pot', s * x, -15, 1.2, 1.2, Z.pave, 2.4, 0, {potR: .5, potH: .7, type: 'tall', pot: 'marbleBlack'});
  // ================= front gardens (mirrored) =================
  for (const s of [-1, 1]) {
    const X = v => s * v, xr = (a, b) => [Math.min(X(a), X(b)), Math.max(X(a), X(b))];
    // north garden: reflecting pool with jets between hedges, palms at the corners
    flat('gravel', rect(...xr(19.5, 41), -34.3, -14), Z.pave);
    { const [a, b] = xr(24, 37); slab('marble', holed(rect(...xr(23.5, 37.5), -31, -18.5), [[[a, -30.5], [b, -30.5], [b, -19], [a, -19]]]), Z.lawn, .45); flat('paverDark', rect(a, b, -30.5, -19), .06); flat('poolWater', rect(a, b, -30.5, -19), .38); }
    hedge(...xr(20, 41), -34.2, -33.4, .8); hedge(...xr(20, 20.8), -33.4, -14.5, .8); hedge(...xr(40.2, 41), -33.4, -14.5, .8);
    for (const [x, y] of [[22, -32.5], [39, -32.5], [22, -16.5], [39, -16.5]]) palm(X(x), y, 8.5);
    for (const y of [-29, -21]) bench(X(21.6), y, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    // south garden: lawn, shade trees, flower beds, hedge along the street wall
    hedge(...xr(19.5, 41), -49.6, -48.6, 1.2); tree(X(26), -45.5, .95); tree(X(35), -45, 1.05);
    slab('hedge', rect(...xr(20, 23), -44, -42), Z.lawn, .5);
    // garden strip between service lane and garage / spa
    hedge(...xr(48.4, 49.6), -50, -41.3, 1.4);
  }
  // reflecting pool jets (arcs) - built as thin water rods via a prop-free path
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const x = s * (25.5 + i * 2.2); for (let k = 0; k < 6; k++) { const t0 = k / 6, t1 = (k + 1) / 6, p0 = [x, -29.5 + t0 * 9.5, .42 + Math.sin(Math.PI * t0) * 1.2], p1 = [x, -29.5 + t1 * 9.5, .42 + Math.sin(Math.PI * t1) * 1.2];
    const A = new THREE.Vector3(p0[0], p0[2], -p0[1]), B = new THREE.Vector3(p1[0], p1[2], -p1[1]), d = B.clone().sub(A), g = new THREE.CylinderGeometry(.03, .03, d.length(), 5); g.translate(0, d.length() / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z); put('waterJet', g); } }
  // street frontage: low travertine wall + bronze railing + pillars with lanterns (openings for the drives)
  for (const [a, b] of [[-100, -48], [-41, -19.5], [19.5, 41], [48, 100]]) {
    box('marble', a, b, -50.3, -49.7, Z.lawn, .7); box('bronze', a, b, -50.05, -49.95, 1.3, 1.36);
    for (let x = a + .15; x < b; x += .18) box('bronze', x, x + .03, -50.02, -49.98, .7, 1.3);
    for (let x = a; x <= b + .01; x += (b - a) / Math.max(1, Math.round((b - a) / 7))) { box('marble', x - .35, x + .35, -50.35, -49.65, Z.lawn, 1.6); P('bollard', 'bronze', x, -50, .3, .3, 1.6, 2.05); }
  }
  // street trees + lamps on the sidewalk (skipping the drive openings)
  for (let x = -106; x <= 106; x += 9) { if ((x > -50 && x < -38) || (x > -18 && x < 18) || (x > 38 && x < 50)) continue; tree(x, -52, .7); box('paverDark', x - .8, x + .8, -52.8, -51.2, Z.pave, Z.pave + .005); }
  for (let x = -101.5; x <= 101.5; x += 18) { if ((x > -50 && x < -38) || (x > -18 && x < 18) || (x > 38 && x < 50)) continue; lamp(x, -53.4, 6); }
  // ================= covered walkways: lobby -> garage core (east), lobby -> spa (west) =================
  const walkway = (x0, x1, y0, y1) => {
    flat('paverDark', rect(x0, x1, y0, y1), Z.pave + .002);
    const along = (x1 - x0) > (y1 - y0), L = along ? x1 - x0 : y1 - y0, n = Math.max(2, Math.round(L / 3));
    for (let i = 0; i <= n; i++) { const t = i / n; for (const side of [0, 1]) { const x = along ? x0 + t * (x1 - x0) : (side ? x1 - .15 : x0 + .15), y = along ? (side ? y1 - .15 : y0 + .15) : y0 + t * (y1 - y0); box('bronze', x - .08, x + .08, y - .08, y + .08, Z.pave, 3.0); } }
    box('whitePaint', x0 - .3, x1 + .3, y0 - .3, y1 + .3, 3.0, 3.22); box('bronze', x0 - .32, x1 + .32, y0 - .32, y1 + .32, 3.22, 3.26);
    for (let i = 0; i < n; i++) { const t = (i + .5) / n; glows.push([along ? x0 + t * (x1 - x0) : (x0 + x1) / 2, along ? (y0 + y1) / 2 : y0 + t * (y1 - y0), Z.pave + .012, 2.2]); box('lampGlow', along ? x0 + t * (x1 - x0) - .2 : (x0 + x1) / 2 - .2, along ? x0 + t * (x1 - x0) + .2 : (x0 + x1) / 2 + .2, along ? (y0 + y1) / 2 - .2 : y0 + t * (y1 - y0) - .2, along ? (y0 + y1) / 2 + .2 : y0 + t * (y1 - y0) + .2, 2.97, 3.0); }
  };
  walkway(24.6, 45.5, -12, -8.5); walkway(-60, -24.6, -12, -8.5); walkway(-62, -58.5, -16, -12);
  // paths from the garden walkways to the forecourt + drop-off at the spa
  flat('paver', rect(-50, -24.5, -14, -12), Z.pave); flat('paver', rect(24.5, 45.5, -14, -12), Z.pave);
  flat('paver', rect(-88, -48, -44, -14), Z.pave);                                                                                 // spa pavilion apron
  // ================= spa pavilion interior (exported shell x -86..-50, y -42..-16) =================
  flat('marbleFloor' in MATS ? 'marbleFloor' : 'paver', rect(-85.5, -50.5, -41.5, -16.5), .05);
  P('desk', 'walnut', -55.5, -30, 2.6, .7, .05, .85, Math.PI / 2, {lamp: false}); P('officeChair', 'leather', -54.6, -30, .5, .5, .05, .97, -Math.PI / 2);
  P('flowers', 'gold', -55.5, -27.6, .5, .5, .05, 1.4, 0, {vase: 'gold'});
  for (const y of [-38, -21]) { P('sofa', 'velvetCream', -60, y, 2.4, .9, .05, .9, y < -30 ? Math.PI : 0, {accent: 'velvetGreen'}); P('coffeeRound', 'marbleBlack', -60, y + (y < -30 ? 1.3 : -1.3), 1.0, 1.0, .05, .47, 0, {}); P('armchair', 'velvetGreen', -62.3, y + (y < -30 ? 1.3 : -1.3), .76, .72, .05, .87, Math.PI / 2, {}); }
  for (let i = 0; i < 4; i++) { const y = -40.5 + i * 6; box('walnut', -85.5, -72, y + 5.6, y + 5.75, .05, 2.6); P('massageTable', 'linen', -79, y + 2.8, .8, 2.2, .05, .77, Math.PI / 2); P('nightstand', 'walnut', -84.5, y + 1.2, .5, .45, .05, .62, -Math.PI / 2); P('plant', 'pot', -73, y + 4.8, .6, .6, .05, 1.6, 0, {potR: .2}); }
  box('walnut', -72, -71.85, -41.5, -18.5, .05, 2.6);
  slab('marble', holed(rect(-70, -64, -27, -19), [[[-69.6, -26.6], [-64.4, -26.6], [-64.4, -19.4], [-69.6, -19.4]]]), .05, .55); flat('poolTile', rect(-69.6, -64.4, -26.6, -19.4), .08); flat('poolWater', rect(-69.6, -64.4, -26.6, -19.4), .48); for (const x of [-69, -65]) P('lounger', 'velvetCream', x, -30, .75, 2.0, .05, .8, 0, {wood: 'walnut'});
  for (const [x, y] of [[-51.5, -41], [-51.5, -17.5], [-70.5, -40.5]]) P('plant', 'pot', x, y, 1.0, 1.0, .05, 2.4, 0, {potR: .4, potH: .6, type: 'tall', pot: 'marbleBlack'});
  // ================= parking garage =================
  const arrowZ = (x, y, dir, z) => { const g = new THREE.ShapeGeometry(arrow()); g.rotateZ(dir); g.translate(x, y, 0); g.rotateX(-Math.PI / 2); g.translate(0, z, 0); put('lineWhite', g); };
  garage(box, rbox, flat, slab, rect, P, arrowZ, R);
  // lawn + trees beside the podium, garage and spa
  for (const [x, y, sc] of [[30, 2, 1], [40, 9, .9], [58, 2, 1.1], [72, 6, 1], [88, 0, 1], [92, -20, .9], [92, -38, .85], [-30, 2, 1], [-40, 9, .9], [-58, 2, 1.1], [-72, 6, 1], [-88, 0, 1], [-93, -20, .8], [-93, -40, .8]]) tree(x, y, sc);
  // ================= rear: terrace, resort pool, cabanas =================
  flat('paver', rect(-32, 32, 13.9, 24), Z.pave); for (let i = 0; i < 3; i++) box('marble', -10, 10, 24 + i * .5, 24.5 + i * .5, Z.lawn, .2 - i * .06);
  for (const x of [-26, -14, 14, 26]) P('plant', 'pot', x, 22.5, 1.1, 1.1, Z.pave, 2.2, 0, {potR: .45, potH: .7, type: 'tall', pot: 'marbleBlack'});
  for (const x of [-20, -8, 8, 20]) { P('tableRound', 'linen', x, 18.5, 1.0, 1.0, Z.pave, Z.pave + .76, 0, {seats: 4}); for (let k = 0; k < 4; k++) { const a = k * TAU / 4; P('chair', 'linen', x + Math.cos(a) * .92, 18.5 + Math.sin(a) * .92, .48, .5, Z.pave, Z.pave + .95, Math.atan2(-Math.cos(a), Math.sin(a)), {wood: 'deck'}); } P('umbrella', 'linen', x, 18.5, .5, .5, Z.pave, Z.pave + 2.7); }
  const deck = blobShape(PC[0], PC[1], 36, 19, wob); deck.holes.push(new THREE.Path(blobShape(PC[0], PC[1], 28, 12, wob).getPoints(96)));
  slab('deck', deck, Z.lawn, .12, 96);
  const cope = blobShape(PC[0], PC[1], 28.6, 12.6, wob); cope.holes.push(new THREE.Path(blobShape(PC[0], PC[1], 28, 12, wob).getPoints(96)));
  slab('marble', cope, Z.lawn, .16, 96); basin(POOL, .16, -1.5, -.12);
  slab('sand', disc(6, 46, 3.6), -1.5, .25); flat('grass', disc(6, 46, 3.0), .251); palm(6, 46, 8); palm(4.6, 47.2, 6.5);
  for (let i = 0; i < 14; i++) { const t = Math.PI * (1.08 + i / 13 * .84), k = 1 + wob(t), x = PC[0] + Math.cos(t) * 32 * k, y = PC[1] + Math.sin(t) * 15.5 * k; P('lounger', 'linen', x, y, .75, 2.0, .12, .87, Math.atan2(-Math.cos(t), Math.sin(t)), {}); if (i % 2) P('umbrella', 'linen', x + Math.cos(t) * 1.6, y + Math.sin(t) * 1.6, .5, .5, .12, 2.8); }
  for (let i = 0; i < 6; i++) { const x = -22.5 + i * 9; P('cabana', 'linen', x, 61.5, 3.2, 3.0, .12, 2.9, Math.PI); }
  for (const [x, y] of [[-34, 38], [-30, 54], [34, 38], [31, 54], [-20, 30.5], [20, 30.5]]) palm(x, y, 8 + R() * 2);
  for (const t of [.2, 1.0, 2.1, 2.9, 3.6, 4.4, 5.3, 6.0]) lamp(PC[0] + Math.cos(t) * 37.5, PC[1] + Math.sin(t) * 20.5, 4);
  // pool bar (east of the pool)
  { const bx = 37, by = 44; slab('deck', rect(bx - 4, bx + 4, by - 4, by + 4), Z.lawn, .12); box('walnut', bx - 2.5, bx + 2.5, by - .4, by + .4, .12, 1.18); box('marbleBlack', bx - 2.6, bx + 2.6, by - .5, by + .5, 1.18, 1.23);
    for (const [x, y] of [[bx - 3.6, by - 3.6], [bx + 3.6, by - 3.6], [bx - 3.6, by + 3.6], [bx + 3.6, by + 3.6]]) box('walnut', x - .12, x + .12, y - .12, y + .12, .12, 3.2);
    const roof = new THREE.ConeGeometry(6.2, 2.2, 4, 1); roof.rotateY(Math.PI / 4); roof.translate(bx, 4.3, -by); put('terracotta', roof);
    for (let i = 0; i < 5; i++) P('stool', 'leather', bx - 2 + i, by - 1.2, .4, .4, .12, .9); P('barShelf', 'walnut', bx - 2.5, by + 1.5, 5, .35, .12, 2.4, 0); }
  // ================= tennis court (west) =================
  { const x0 = -90, x1 = -56, y0 = 22, y1 = 40, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    flat('courtGreen', rect(x0, x1, y0, y1), Z.pave); flat('courtBlue', rect(cx - 11.885, cx + 11.885, cy - 5.485, cy + 5.485), Z.pave + .002);
    const L = (a, b, c, d) => box('lineWhite', a, b, c, d, Z.pave + .003, Z.pave + .006);
    L(cx - 11.885, cx + 11.885, cy - 5.485, cy - 5.435); L(cx - 11.885, cx + 11.885, cy + 5.435, cy + 5.485); L(cx - 11.885, cx + 11.885, cy - 4.165, cy - 4.115); L(cx - 11.885, cx + 11.885, cy + 4.115, cy + 4.165);
    L(cx - 11.885, cx - 11.835, cy - 5.485, cy + 5.485); L(cx + 11.835, cx + 11.885, cy - 5.485, cy + 5.485); L(cx - 6.425, cx - 6.375, cy - 4.165, cy + 4.165); L(cx + 6.375, cx + 6.425, cy - 4.165, cy + 4.165); L(cx - 6.4, cx + 6.4, cy - .025, cy + .025);
    box('whitePaint', cx - .02, cx + .02, cy - 6.4, cy + 6.4, .9, 1.0); box('fenceMesh', cx - .01, cx + .01, cy - 6.4, cy + 6.4, .1, .9); for (const s of [-1, 1]) box('steel', cx - .05, cx + .05, cy + s * 6.4 - .05, cy + s * 6.4 + .05, 0, 1.07);
    for (const [a, b, c, d] of [[x0, x1, y0, y0], [x0, x1, y1, y1], [x0, x0, y0, y1], [x1, x1, y0, y1]]) { box('fenceMesh', a - .01, b + .01, c - .01, d + .01, 0, 3.6); const n = Math.round(Math.max(b - a, d - c) / 3); for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n, y = c + (d - c) * i / n; box('black', x - .05, x + .05, y - .05, y + .05, 0, 3.7); } }
    for (const [x, y] of [[x0 + .4, y0 + .4], [x1 - .4, y0 + .4], [x0 + .4, y1 - .4], [x1 - .4, y1 - .4]]) lamp(x, y, 8);
    flat('gravel', rect(x1, -43, 29.5, 32), Z.pave); }
  // ================= event lawn + gazebo (east) =================
  P('gazebo', 'whitePaint', 70, 31, 9, 9, Z.lawn, 6.2);
  flat('gravel', ring(70, 31, 6, 7.4), Z.pave); flat('gravel', rect(46, 63.2, 29.5, 32), Z.pave);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P('tree', 'trunk', 70 + Math.cos(a) * 12, 31 + Math.sin(a) * 9.5, 4, 4, 0, 4.4, a, {type: 'frangi', seed: i}); }
  // ================= pool villas along the rear boundary =================
  for (const vx of [-75, -45, -15, 15, 45, 75]) villa(vx);
  // ================= paths, jogging loop, boundary =================
  const path = (x0, x1, y0, y1) => flat('gravel', rect(x0, x1, y0, y1), Z.pave);
  path(-46, -43, 24, 72); path(43, 46, 24, 72); path(-92, 92, 72, 75); path(-1.5, 1.5, 64.5, 72); path(-43, -32, 19, 22); path(32, 43, 19, 22);
  path(-96, -93, 16, 101); path(93, 96, 16, 101); path(-96, 96, 101, 104); path(-96, -32, 14, 17); path(32, 96, 14, 17);
  for (const x of [-44.5, 44.5]) for (let y = 30; y <= 70; y += 10) lamp(x + Math.sign(x) * 2.2, y, 3.6);
  for (let x = -90; x <= 90; x += 15) bollard(x, 76);
  for (const x of [-42.4, 42.4]) for (let y = 27; y <= 70; y += 6) bollard(x, y);
  for (const s of [-1, 1]) for (let y = -48; y <= 104; y += 4) hedge(s * 99.2 - .6, s * 99.2 + .6, y, Math.min(y + 4, 105), 1.8);
  hedge(-100, 100, 104.4, 105.6, 1.8);
  for (let x = -90; x <= 90; x += 12) tree(x + (R() - .5) * 3, 108 - 4 + (R() - .5), .8);
  for (const [x, y] of [[-52, 20], [-50, 50], [-60, 62], [50, 50], [58, 62], [86, 52], [-86, 52], [86, 66], [-86, 66], [50, 20]]) tree(x, y, .9 + R() * .3);

  // ---------- emit ----------
  const group = new THREE.Group(); group.name = 'Site';
  for (const [m, gs] of Object.entries(G)) { const g = mergeGeometries(gs, false); planarUV(g, UV[m] || 1); const mesh = new THREE.Mesh(g, MAT(m)); mesh.name = 'Site_' + m; group.add(mesh); }
  const inst = new Map(), _m = new THREE.Matrix4(), _r = new THREE.Matrix4();
  for (const it of props) { if (it.w < .05) continue; const {key, parts} = buildProp(it); let e = inst.get(key); if (!e) inst.set(key, e = {parts, mats: []}); e.mats.push(_m.makeTranslation(it.cx, it.z0, -it.cy).multiply(_r.makeRotationY(it.ang)).clone()); }
  for (const {parts, mats} of inst.values()) for (const [m, g] of Object.entries(parts)) { if (!g.attributes.uv) planarUV(g, UV[m] || 1); const im = new THREE.InstancedMesh(g, MAT(m), mats.length); mats.forEach((x, i) => im.setMatrixAt(i, x)); im.computeBoundingSphere(); group.add(im); }
  // warm light pools on the ground under the lamps (night only, additive, no real lights needed)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; { const g = gc.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const glowMat = new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(gc), color: 0xffb35c, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false});
  const gGeo = new THREE.PlaneGeometry(2, 2); gGeo.rotateX(-Math.PI / 2);
  const glowMesh = new THREE.InstancedMesh(gGeo, glowMat, glows.length); glows.forEach(([x, y, z, r], i) => glowMesh.setMatrixAt(i, _m.makeTranslation(x, z, -y).multiply(_r.makeScale(r, 1, r)))); glowMesh.computeBoundingSphere(); glowMesh.visible = false; glowMesh.renderOrder = 2; group.add(glowMesh);
  const baseEm = {lampGlow: MATS.lampGlow.emissiveIntensity, lampShade: MATS.lampShade.emissiveIntensity};
  group.userData.setNight = k => { glowMesh.visible = k > .02; glowMat.opacity = .42 * k; MATS.lampGlow.emissiveIntensity = baseEm.lampGlow * (1 + 1.4 * k); MATS.lampShade.emissiveIntensity = baseEm.lampShade * (1 + 1.2 * k); };
  scene.add(group); console.log(`[site] ${props.length} props, ${Object.keys(G).length} static materials`); return group;

  // ---------- pool villa (12 x 12 pavilion, hip roof, deck + plunge pool, garden walls) ----------
  function villa(cx){
    const y0 = 84, y1 = 96;
    slab('marble', rect(cx - 7, cx + 7, y0 - 1, y1 + 1), Z.lawn, .4);
    box('wall', cx - 6, cx + 6, y1 - .3, y1, .4, 3.6); box('wall', cx - 6, cx - 5.7, y0, y1, .4, 3.6); box('wall', cx + 5.7, cx + 6, y0, y1, .4, 3.6);
    box('glassShower', cx - 5.7, cx + 5.7, y0, y0 + .05, .4, 3.4); for (let x = cx - 5.7; x <= cx + 5.8; x += 2.85) box('bronze', x - .05, x + .05, y0 - .02, y0 + .07, .4, 3.6); box('bronze', cx - 6, cx + 6, y0 - .02, y0 + .07, 3.4, 3.6);
    box('woodFloor', cx - 5.7, cx + 5.7, y0 + .05, y1 - .3, .4, .42); box('lampGlow', cx - 3, cx + 3, (y0 + y1) / 2 - .15, (y0 + y1) / 2 + .15, 3.38, 3.4);
    box('wall', cx - .1, cx + .1, y0 + 6.5, y1 - .3, .42, 3.4);                                                    // bedroom / bath partition
    P('bed', 'velvetCream', cx - 2.9, y0 + 3.4, 2.05, 2.25, .42, 1.77, 0, {});
    for (const dx of [-4.25, -1.55]) P('nightstand', 'walnut', cx + dx, y0 + 4.27, .5, .45, .42, .99, 0);
    P('sofa', 'velvetGreen', cx + 3.2, y0 + 4.2, 2.2, .9, .42, 1.27, 0, {accent: 'velvetBlush'}); P('coffeeRound', 'marbleBlack', cx + 3.2, y0 + 2.5, .9, .9, .42, .84, 0, {}); P('armchair', 'velvetBlush', cx + 1.2, y0 + 2.0, .76, .72, .42, 1.24, Math.PI / 2, {});
    P('tubFree', 'ceramic', cx - 3, y1 - 2.2, 1.7, .8, .42, 1.34, 0, {th: .6}); P('plant', 'pot', cx + 5, y0 + .8, .6, .6, .42, 1.9, 0, {potR: .2});
    const roof = new THREE.ConeGeometry(10.6, 3.2, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, 1); roof.translate(cx, 3.6 + 1.6, -(y0 + y1) / 2); put('terracotta', roof);
    box('walnut', cx - 7.6, cx + 7.6, y0 - 1.6, y1 + 1.6, 3.5, 3.62);
    slab('deck', holed(rect(cx - 7, cx + 7, 76, y0 - 1), [VPOOL(cx)]), Z.lawn, .35); slab('marble', holed(rect(cx - 5.4, cx + .6, 77.4, 81.1), [VPOOL(cx)]), Z.lawn, .37); basin(VPOOL(cx), .37, -1.0, .24);
    P('lounger', 'linen', cx + 2.6, 79.5, .75, 2.0, .35, 1.1, Math.PI); P('lounger', 'linen', cx + 4.4, 79.5, .75, 2.0, .35, 1.1, Math.PI); P('umbrella', 'linen', cx + 3.5, 82, .5, .5, .35, 3.0);
    for (const s of [-1, 1]) hedge(cx + s * 9 - .5, cx + s * 9 + .5, 75.5, 100, 2.0);
    P('tree', 'trunk', cx - 6, 99.5, 4, 4, 0, 4.4, 0, {type: 'frangi', seed: cx}); P('palm', 'trunk', cx + 6.8, 77, 5, 5, 0, 7, cx);
    flat('gravel', rect(cx - .9, cx + .9, 75, 76), Z.pave);
  }
}

// ---------- multi-storey car park: x 50..86, y -46..-13, decks at 0 / 3.15 / 6.3 and roof parking at 9.45 ----------
function garage(box, rbox, flat, slab, rect, P, arrowZ, R){
  const X0 = 50, X1 = 86, XR = 79.4, Y0 = -46, Y1 = -13, LV = [.04, 3.15, 6.3, 9.45], T = .3;
  const L1 = [79.6, 82.7], L2 = [82.9, 86];                                            // ramp lanes: L1 up 0->1 and 2->3 (south->north), L2 1->2 (north->south)
  const RS = -40, RN = -19;                                                            // ramp ends (y)
  flat('asphaltS', rect(X0, X1, Y0, Y1), .045);
  for (let k = 1; k < 4; k++) {
    const z = LV[k]; box('concrete', X0, XR, Y0, Y1, z - T, z);                         // parking deck
    const ends = [[Y0, RS], [RN, Y1]];
    for (const [a, b] of ends) box('concrete', XR, L2[1], a, b, z - T, z);               // landings across both lanes
    if (k === 1 || k === 3) box('concrete', L2[0] - .2, L2[1], RS, RN, z - T, z);          // L2 strip full at levels 1 and roof
    box('deckPaint', X0, XR, Y0, Y1, z, z + .006);
  }
  box('deckPaint', X0, XR, Y0, Y1, LV[0], LV[0] + .004);
  // ramps (sloped slabs with curbs)
  const ramp = (x0, x1, ya, za, yb, zb) => { const L = Math.abs(yb - ya), ang = Math.atan2(zb - za, L) * Math.sign(yb - ya), cy = (ya + yb) / 2, cz = (za + zb) / 2, len = Math.hypot(L, zb - za);
    rbox('concrete', (x0 + x1) / 2, cy, x1 - x0, len, cz - T, cz, 0, ang); rbox('asphaltS', (x0 + x1) / 2, cy, x1 - x0 - .1, len, cz + .005, cz + .015, 0, ang);
    for (const x of [x0 + .1, x1 - .1]) rbox('curb', x, cy, .2, len, cz, cz + .2, 0, ang); };
  ramp(L1[0], L1[1], RS, LV[0], RN, LV[1]); ramp(L2[0], L2[1], RN, LV[1], RS, LV[2]); ramp(L1[0], L1[1], RS, LV[2], RN, LV[3]);
  // columns (stall lines 52.8 + 2.6k; grid x 60.6 / 68.4 / 76.2 + perimeter) on row-back lines
  const CX = [X0 + .25, 60.6, 68.4, 76.2, XR, X1 - .25], CY = [Y0 + .25, -29.5, Y1 - .25];
  for (let k = 0; k < 3; k++) for (const x of CX) for (const y of CY) box('concrete', x - .25, x + .25, y - .25, y + .25, LV[k] + (k ? 0 : 0), LV[k + 1] - T);
  // parapets on the upper decks and roof (west side of ground level stays open for the entry)
  for (let k = 1; k < 4; k++) { const z = LV[k]; box('concrete', X0, X1, Y0, Y0 + .2, z, z + 1.05); box('concrete', X0, X1, Y1 - .2, Y1, z, z + 1.05); box('concrete', X1 - .2, X1, Y0, Y1, z, z + 1.05); box('concrete', X0, X0 + .2, Y0, Y1, z, z + 1.05);
    box('steel', X0, X1, Y0 + .05, Y0 + .15, z + 1.05, z + 1.1); box('steel', X0, X1, Y1 - .15, Y1 - .05, z + 1.05, z + 1.1); }
  // timber louvre screen on south / east / north faces of the upper levels
  for (let x = X0 + .4; x < X1 - .2; x += .55) { box('walnut', x, x + .09, Y0 - .45, Y0 - .2, 3.0, 10.4); box('walnut', x, x + .09, Y1 + .2, Y1 + .45, 3.0, 10.4); }
  for (let y = Y0 + .4; y < Y1 - .2; y += .55) box('walnut', X1 + .2, X1 + .45, y, y + .09, 3.0, 10.4);
  box('walnut', X0 - .5, X1 + .5, Y0 - .5, Y0 - .15, 10.4, 10.55); box('walnut', X0 - .5, X1 + .5, Y1 + .15, Y1 + .5, 10.4, 10.55); box('walnut', X1 + .15, X1 + .5, Y0, Y1, 10.4, 10.55);
  // ground-level planters along the street side
  box('hedge', X0, X1, Y0 - 1.6, Y0 - .6, .01, 1.1);
  // P sign (roof, south face) + lift / stair core (north-west, joins the covered walkway)
  box('accessBlue', 66.5, 69.5, Y0 - .62, Y0 - .5, 10.6, 13.6); box('lineWhite', 67.4, 67.8, Y0 - .66, Y0 - .62, 11.0, 13.2); box('lineWhite', 67.8, 68.8, Y0 - .66, Y0 - .62, 12.8, 13.2); box('lineWhite', 67.8, 68.8, Y0 - .66, Y0 - .62, 11.9, 12.3); box('lineWhite', 68.6, 68.9, Y0 - .66, Y0 - .62, 12.1, 13.0);
  box('concrete', 45.5, 50, -17, -16.7, 0, 12.2); box('concrete', 45.5, 50, -8.8, -8.5, 0, 12.2); box('bronze', 45.4, 45.5, -17, -8.5, 0, .1); box('bronze', 45.4, 45.5, -17, -8.5, 11.9, 12.2); box('concrete', 45.3, 50.2, -17.2, -8.3, 12.2, 12.6);
  box('glassShower', 45.42, 45.46, -16.6, -8.9, 0, 12); box('gold', 49.9, 50.0, -14.2, -12.4, .05, 2.2); box('accessBlue', 45.36, 45.4, -16.4, -15.0, 9.4, 11.6);
  // markings, wheel stops, lights and cars on every level
  const zebra = (x0, x1, y0, y1, z) => { for (let x = x0 + .2; x < x1 - .2; x += .6) box('lineWhite', x, x + .35, y0, y1, z + .008, z + .01); };
  const ROWS = [{y0: Y0, y1: -41, back: Y0, nose: 1}, {y0: -34.5, y1: -29.5, back: -29.5, nose: -1}, {y0: -29.5, y1: -24.5, back: -29.5, nose: 1}, {y0: -18, y1: Y1, back: Y1, nose: -1}];
  const AISLES = [[-41, -34.5], [-24.5, -18]];
  const paints = ['carWhite', 'carBlack', 'carSilver', 'carNavy', 'carRed', 'carWhite', 'carSilver', 'carBlack', 'carGold'];
  LV.forEach((z, k) => {
    const zl = z + .008;
    box('walkGreen', X0 + .2, 52.6, Y0 + .2, Y1 - .2, z + .006, z + .008);
    for (const [a, b] of AISLES) { const ym = (a + b) / 2; for (let x = 53, i = 0; x < XR - 1; x += 3, i++) box('lineYellow', x, x + 1.6, ym - .06, ym + .06, zl, zl + .002); zebra(X0 + .2, 52.6, a, b, z); }
    ROWS.forEach((row, ri) => {
      for (let i = 0; i < 10; i++) {
        const x0 = 52.8 + i * 2.6, x1 = x0 + 2.6, xm = (x0 + x1) / 2;
        box('lineWhite', x0 - .06, x0 + .06, row.y0, row.y1, zl, zl + .002); if (i === 9) box('lineWhite', x1 - .06, x1 + .06, row.y0, row.y1, zl, zl + .002);
        box('lineWhite', x0, x1, row.back - .06 * row.nose, row.back + .06 * row.nose, zl, zl + .002);
        const ws = row.back + row.nose * .75; box('concrete', xm - .75, xm + .75, ws - .1, ws + .1, z, z + .12); box('lineYellow', xm - .75, xm + .75, ws - .1, ws + .1, z + .12, z + .125);
        const acc = k === 0 && ri === 3 && i < 2;
        if (acc) box('accessBlue', x0 + .1, x1 - .1, row.y0 + .1, row.y1 - .1, z + .007, z + .009);
        else if (R() < (k === 3 ? .5 : .66)) P('car', ['carWhite', 'carBlack', 'carSilver', 'carNavy', 'carRed', 'carWhite', 'carSilver', 'carBlack', 'carGold'][Math.floor(R() * 9)], xm, (row.y0 + row.y1) / 2 + (R() - .5) * .3, 1.85, R() < .25 ? 4.85 : 4.45, z, z + 1.5, (R() < .7 ? 0 : Math.PI) + (row.nose > 0 ? 0 : Math.PI), R() < .25 ? {suv: true} : {});
      }
    });
    // lights: ceiling strips under the next deck, light poles on the roof
    if (k < 3) for (const [a, b] of AISLES) box('lampGlow', 53, XR - .5, (a + b) / 2 - .1, (a + b) / 2 + .1, LV[k + 1] - T - .04, LV[k + 1] - T);
    else for (const x of [56, 64.5, 73]) for (const y of [-37.75, -21.25]) P('lampPost', 'bronze', x, y, .45, .45, z, z + 6);
    for (const [a, b] of AISLES) { arrowZ(60, (a + b) / 2 + 1.6, -Math.PI / 2, zl + .003); arrowZ(72, (a + b) / 2 - 1.6, Math.PI / 2, zl + .003); }
  });
  for (const k of [0, 2]) arrowZ((L1[0] + L1[1]) / 2, RS - 2.5, 0, LV[k] + .012);
}
