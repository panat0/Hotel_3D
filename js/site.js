// Garden Parking garage: painted deck, stall layout, aisle markings, wheel stops, column guards and parked cars.
// Garage (Blender coords): x 50..86, y -46..-12, deck tops z 0.15 / 3.15 / 6.15, columns on x 50.6 + 5.8k, y -45.4 + 6.56k.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildProp} from './props.js';
import {MATS} from './tower.js';

const DECKS = [.15, 3.15, 6.15], CX = [50.6, 56.4, 62.2, 68.0, 73.8, 79.6, 85.4];
// rows: [y0, y1, aisle side] ; aisles avoid the column lines (y -38.84, -32.28, -25.72, -19.16)
const ROWS = [{y0: -43.6, y1: -38.6, nose: 1}, {y0: -32.56, y1: -27.56, nose: -1}, {y0: -19.44, y1: -14.44, nose: -1}];
const AISLES = [[-38.56, -32.56], [-25.44, -19.44]];
function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function buildParking(scene){
  // the exported garage base is a solid 9.6 m block hiding the decks: replace it with a ground pad so the open-sided structure shows
  let base = null; scene.traverse(o => { if (/^Garage_Ground/.test(o.name)) base = o; if (/^(Park_Car_G|Garage_Bays)/.test(o.name)) o.visible = false; });
  if (base) { base.visible = false; const pad = new THREE.Mesh(new THREE.BoxGeometry(46, .35, 42), base.material); pad.position.set(68, -.025, 29); pad.name = 'Garage_Pad'; scene.add(pad); }
  const geo = {}, put = (m, g) => (geo[m] ||= []).push(g.index ? g.toNonIndexed() : g);
  const box = (m, x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0); g.translate((x0 + x1) / 2, (z0 + z1) / 2, -(y0 + y1) / 2); put(m, g); };
  const flat = (m, shape, z, rot = 0, x = 0, y = 0) => { const g = new THREE.ShapeGeometry(shape); g.rotateZ(rot); g.translate(x, y, 0); g.rotateX(-Math.PI / 2); g.translate(0, z, 0); put(m, g); };
  const arrow = () => { const s = new THREE.Shape(); s.moveTo(-.18, -1.2); s.lineTo(.18, -1.2); s.lineTo(.18, .2); s.lineTo(.5, .2); s.lineTo(0, 1.2); s.lineTo(-.5, .2); s.lineTo(-.18, .2); s.closePath(); return s; };
  const wheel = () => { const s = new THREE.Shape(); s.absarc(0, 0, .55, 0, Math.PI * 2, false); const h = new THREE.Path(); h.absarc(0, 0, .45, 0, Math.PI * 2, true); s.holes.push(h); return s; };
  const cars = [], r = rng(42), paints = ['carWhite', 'carBlack', 'carSilver', 'carNavy', 'carRed', 'carWhite', 'carSilver', 'carBlack', 'carGold'];
  DECKS.forEach((z, k) => {
    const zp = z + .004, zl = z + .009;
    box('deckPaint', 50.15, 85.85, -45.85, -12.15, z, zp);                         // epoxy coated deck
    for (const [a, b] of AISLES) {                                                  // aisles: darker asphalt, yellow centre dashes, two-way arrows
      box('asphaltDeck', 50.15, 85.85, a, b, zp, zp + .002);
      const ym = (a + b) / 2; for (let x = 51; x < 85.5; x += 3) box('lineYellow', x, x + 1.6, ym - .06, ym + .06, zl, zl + .002);
      for (const x of [58.5, 70.9, 82.0]) { flat('lineWhite', arrow(), zl + .002, -Math.PI / 2, x, ym + 1.5); flat('lineWhite', arrow(), zl + .002, Math.PI / 2, x + 2, ym - 1.5); }
    }
    box('asphaltDeck', 79.9, 85.85, -32.56, -25.44, zp, zp + .002);                 // connector lane between the two aisles (east bay)
    flat('lineWhite', arrow(), zl + .002, 0, 82.9, -29.0);
    // pedestrian walkway (green) between aisle 1 rows and lift core, zebra crossings over both aisles at x 68
    box('walkGreen', 50.15, 79.9, -27.56, -25.44, zp, zp + .002);
    for (const [a, b] of AISLES) for (let x = 66.6; x < 69.5; x += .6) box('lineWhite', x, x + .35, a + .2, b - .2, zl, zl + .002);
    ROWS.forEach((row, ri) => {
      const d = row.y1 - row.y0;
      for (let c = 0; c < CX.length - 1; c++) for (let h = 0; h < 2; h++) {
        const x0 = CX[c] + h * 2.9, x1 = x0 + 2.9, xm = (x0 + x1) / 2;
        if (ri === 0 && c === 0) continue;                                          // ramp landing / entry lane
        if (ri === 1 && c === CX.length - 2) continue;                              // connector lane
        box('lineWhite', x0 - .06, x0 + .06, row.y0, row.y1, zl, zl + .002);
        if (c === CX.length - 2 && h === 1) box('lineWhite', x1 - .06, x1 + .06, row.y0, row.y1, zl, zl + .002);
        const back = row.nose > 0 ? row.y0 : row.y1; box('lineWhite', x0, x1, back - .06, back + .06, zl, zl + .002);
        const ws = back + row.nose * .75; box('concrete', xm - .8, xm + .8, ws - .1, ws + .1, z, z + .12); box('lineYellow', xm - .8, xm + .8, ws - .1, ws + .1, z + .12, z + .125);
        const accessible = ri === 1 && c === 2 && k === 0;
        if (accessible) { box('accessBlue', x0 + .1, x1 - .1, row.y0 + .1, row.y1 - .1, zp + .002, zp + .004); flat('lineWhite', wheel(), zl + .004, 0, xm, (row.y0 + row.y1) / 2); }
        if (!accessible && r() < .68) cars.push({x: xm, y: (row.y0 + row.y1) / 2 + (r() - .5) * .3, z, ang: (r() < .7 ? 0 : Math.PI) + (row.nose > 0 ? 0 : Math.PI) + (r() - .5) * .04, paint: paints[Math.floor(r() * paints.length)], wide: r() < .25});
      }
    });
    // column guards: yellow/black hazard bands on every column foot
    for (const x of CX) for (let j = 0; j < 6; j++) { const y = -45.4 + j * 6.56; for (let i = 0; i < 4; i++) box(i % 2 ? 'black' : 'lineYellow', x - .3, x + .3, y - .3, y + .3, z + i * .25, z + (i + 1) * .25); }
    // level number painted on the entry lane + EXIT arrow
    flat('lineWhite', arrow(), zl + .002, -Math.PI / 2, 53.5, -41.0);
  });
  const group = new THREE.Group(); group.name = 'ParkingMarks';
  for (const [m, gs] of Object.entries(geo)) { const mesh = new THREE.Mesh(mergeGeometries(gs, false), MATS[m] || MATS.wall); mesh.name = 'Park_' + m; group.add(mesh); }
  // parked cars: instanced detailed prop per paint/size
  const byKey = new Map(), _m = new THREE.Matrix4(), _r = new THREE.Matrix4();
  for (const c of cars) { const it = {kind: 'car', m: c.paint, w: 1.85, d: c.wide ? 4.85 : 4.45, z0: 0, z1: c.wide ? 1.55 : 1.42, o: c.wide ? {suv: true} : {}};
    const {key, parts} = buildProp(it); let e = byKey.get(key); if (!e) byKey.set(key, e = {parts, mats: []}); e.mats.push(_m.makeTranslation(c.x, c.z, -c.y).multiply(_r.makeRotationY(c.ang)).clone()); }
  for (const {parts, mats} of byKey.values()) for (const [m, g] of Object.entries(parts)) { if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); const im = new THREE.InstancedMesh(g, MATS[m] || MATS.wall, mats.length); mats.forEach((x, i) => im.setMatrixAt(i, x)); im.computeBoundingSphere(); group.add(im); }
  scene.add(group); console.log(`[site] parking: ${cars.length} parked cars`); return group;
}
