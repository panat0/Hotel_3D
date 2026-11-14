// Detailed, reusable furniture / fixture models for the Aurelia interiors.
// Every prop is built inside its footprint: x in [-w/2, w/2], y in [-d/2, d/2] (back = +y), z in [0, h]  (Blender-style axes)
// and returned as {materialName: BufferGeometry} in three.js axes, ready to be instanced.
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
function rng(seed){ let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s){ let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function clean(g){
  g = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
// planar UVs from position/normal (metres / size) so procedural textures keep a real-world scale
export function planarUV(g, size = 1){
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i)), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let u, v; if (ay >= ax && ay >= az) { u = x; v = z; } else if (ax >= az) { u = z; v = y; } else { u = x; v = y; }
    uv[i * 2] = u / size; uv[i * 2 + 1] = v / size;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}

class Kit {
  constructor(){ this.parts = {}; this.M = null; }
  add(m, g){ if (this.M) g.applyMatrix4(this.M); (this.parts[m] ||= []).push(clean(g)); return g; }
  // run fn with a local frame at Blender (x, y, z) rotated by rz about the vertical axis
  at(x, y, z, rz, fn){ const prev = this.M, m = new THREE.Matrix4().makeTranslation(x, z, -y).multiply(new THREE.Matrix4().makeRotationY(rz || 0)); this.M = prev ? prev.clone().multiply(m) : m; fn(); this.M = prev; }
  geo(g, cx, cy, cz, rx = 0, ry = 0, rz = 0){ if (rx) g.rotateX(rx); if (ry) g.rotateZ(-ry); if (rz) g.rotateY(rz); g.translate(cx, cz, -cy); return g; }
  box(m, x0, x1, y0, y1, z0, z1, r = 0, seg = 2){
    const w = x1 - x0, d = y1 - y0, h = z1 - z0, rr = Math.min(r, Math.min(w, d, h) * .49);
    const g = rr >= .018 ? new RoundedBoxGeometry(w, h, d, rr < .045 ? 1 : Math.min(seg, 2), rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(m, this.geo(g, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  }
  rbox(m, cx, cy, cz, w, d, h, o = {}){
    const rr = Math.min(o.r || 0, Math.min(w, d, h) * .49), g = rr >= .018 ? new RoundedBoxGeometry(w, h, d, rr < .045 ? 1 : Math.min(o.seg || 2, 2), rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(m, this.geo(g, cx, cy, cz, o.rx, o.ry, o.rz));
  }
  cyl(m, x, y, rb, rt, z0, z1, seg = 16, open = false){ return this.add(m, this.geo(new THREE.CylinderGeometry(rt, rb, z1 - z0, seg, 1, open), x, y, (z0 + z1) / 2)); }
  // cylinder along an arbitrary direction between two Blender points
  rod(m, a, b, r, seg = 8, r2){
    const A = new THREE.Vector3(a[0], a[2], -a[1]), B = new THREE.Vector3(b[0], b[2], -b[1]), dir = B.clone().sub(A), len = dir.length();
    const g = new THREE.CylinderGeometry(r2 ?? r, r, len, seg, 1); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())); g.translate(A.x, A.y, A.z); return this.add(m, g);
  }
  hcyl(m, cx, cy, cz, r, len, axis = 'x', seg = 12){ const g = new THREE.CylinderGeometry(r, r, len, seg); if (axis === 'x') g.rotateZ(Math.PI / 2); else g.rotateX(Math.PI / 2); g.translate(cx, cz, -cy); return this.add(m, g); }
  lathe(m, x, y, pts, seg = 24, sx = 1, sy = 1, mod, phi0 = 0, phiL = TAU){
    const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-4), z)), seg, phi0, phiL);
    if (mod) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const px = p.getX(i), pz = p.getZ(i), k = mod(Math.atan2(pz, px), p.getY(i)); p.setXYZ(i, px * k, p.getY(i), pz * k); } }
    g.scale(sx, 1, sy); g.translate(x, 0, -y); return this.add(m, g);
  }
  ell(m, x, y, z, rx, ry, rz, o = {}){ const g = new THREE.SphereGeometry(1, o.ws || 10, o.hs || 7); g.scale(rx, rz, ry); return this.add(m, this.geo(g, x, y, z, o.ax, o.ay, o.az)); }
  torus(m, x, y, z, R, r, o = {}){
    const g = new THREE.TorusGeometry(R, r, o.rs || 8, o.ts || 28, o.arc || TAU); if (o.sx || o.sy) g.scale(o.sx || 1, o.sy || 1, 1);
    if (o.rot) g.rotateZ(o.rot);
    if ((o.axis || 'z') === 'z') g.rotateX(-Math.PI / 2); else if (o.axis === 'x') g.rotateY(Math.PI / 2);
    if (o.rz) g.rotateY(o.rz);
    g.translate(x, z, -y); return this.add(m, g);
  }
  ext(m, shape, z0, z1, o = {}){
    const g = new THREE.ExtrudeGeometry(shape, {depth: z1 - z0, bevelEnabled: !!o.bevel, bevelSize: o.bevel || 0, bevelThickness: o.bevel || 0, bevelSegments: 2, curveSegments: o.cs || 24});
    g.rotateX(-Math.PI / 2); g.translate(0, z0, 0); return this.add(m, g);
  }
  // organic low-poly lump (tree canopy cluster): jittered icosphere, flat normals
  blob(m, x, y, z, rx, ry, rz, r){
    let g = mergeVertices(new THREE.IcosahedronGeometry(1, 1)); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const k = .82 + r() * .32; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    g = g.toNonIndexed(); g.computeVertexNormals(); g.scale(rx, rz, ry); g.translate(x, z, -y); return this.add(m, g);
  }
  // side profile [[y, z]] extruded across x0..x1
  extX(m, pts, x0, x1, bevel = 0){
    const g = new THREE.ExtrudeGeometry(sh(pts), {depth: x1 - x0 - 2 * bevel, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4});
    g.translate(0, 0, bevel); g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, x0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1)); return this.add(m, g);
  }
  // parametric sheet: f(u, v) -> [x, y, z] (Blender)
  sheet(m, f, nu, nv){
    const pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const [x, y, z] = f(i / nu, j / nv); pos.push(x, z, -y); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return this.add(m, g);
  }
}
const sh = pts => { const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); s.closePath(); return s; };

// ---------- shared small pieces ----------
function taperLeg(K, m, x, y, z0, z1, r = .018){ K.cyl(m, x, y, r * .6, r, z0, z1, 8); }
function placeSetting(K, kind){        // at origin, diner toward -y
  if (kind === 'coffee') { K.cyl('ceramic', 0, -.02, .07, .075, 0, .008, 16); K.lathe('ceramic', 0, -.02, [[0, .008], [.03, .008], [.042, .03], [.045, .07], [.04, .07], [.036, .03], [0, .014]], 14); K.torus('ceramic', .05, -.02, .045, .015, .004, {axis: 'y', ts: 10, rs: 5}); return; }
  K.cyl('gold', 0, 0, .15, .15, 0, .006, 24);
  K.lathe('ceramic', 0, 0, [[0, .006], [.09, .006], [.12, .014], [.135, .024], [.128, .025], [.1, .014], [0, .012]], 24);
  K.rbox('linen', 0, 0, .03, .1, .15, .022, {r: .008});
  K.box('steel', -.2, -.188, -.09, .1, 0, .005); K.box('steel', -.226, -.214, -.08, .1, 0, .005);
  K.box('steel', .19, .202, -.1, .1, 0, .005); K.box('steel', .218, .228, -.08, .1, 0, .005);
  const glass = (x, y, s) => K.lathe('glassClear', x, y, [[0, 0], [.035 * s, 0], [.035 * s, .004], [.005, .01], [.005, .1 * s], [.03 * s, .12 * s], [.04 * s, .17 * s], [.036 * s, .2 * s], [0, .13 * s]], 14);
  glass(.17, .14, 1); glass(.07, .17, .85);
}
function flowerDome(K, cx, cy, z, R, n, seed, cols = ['blossom', 'linen', 'blossom', 'red'], sz = 1){
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, el = Math.acos(1 - r() * .95), rr = R * (.75 + r() * .25);
    const x = cx + Math.cos(a) * Math.sin(el) * rr, y = cy + Math.sin(a) * Math.sin(el) * rr, zz = z + Math.cos(el) * rr * .9, s = (.028 + r() * .03) * sz;
    K.ell(cols[i % cols.length], x, y, zz, s * 1.1, s * 1.1, s * .8, {ws: 7, hs: 5});
  }
  for (let i = 0; i < n * .6; i++) { const a = r() * TAU, rr = R * (.9 + r() * .2); K.ell(i % 2 ? 'leaf' : 'leafDark', cx + Math.cos(a) * rr * .92, cy + Math.sin(a) * rr * .92, z + r() * R * .35, .07, .022, .012, {ws: 6, hs: 4, az: -a + Math.PI / 2, ax: .5}); }
}

// ---------- the catalogue ----------
export const PROPS = {
  bed(K, w, d, h, o){
    const fab = o.fab || 'velvetCream', acc = o.accent || 'velvetBlush', thr = o.throw || 'throw', yH = d / 2 - .1;
    K.box('walnut', -w / 2, w / 2, yH + .065, d / 2, 0, h, .01);
    const n = Math.max(6, Math.round((w - .1) / .2)), cw = (w - .1) / n;
    for (let i = 0; i < n; i++) K.box(fab, -w / 2 + .05 + i * cw + .003, -w / 2 + .05 + (i + 1) * cw - .003, yH, yH + .075, .32, h - .05, .03, 2);
    K.box('gold', -w / 2 + .03, w / 2 - .03, yH + .02, yH + .07, h - .05, h - .035);
    K.box('walnut', -w / 2 + .03, w / 2 - .03, -d / 2, yH, .1, .33, .025);
    K.box('black', -w / 2 + .15, w / 2 - .15, -d / 2 + .12, yH - .1, 0, .1);
    K.box('linen', -w / 2 + .06, w / 2 - .06, -d / 2 + .03, yH - .02, .33, .57, .06, 3);
    const yD = yH - .64;
    K.box('duvet', -w / 2 + .035, w / 2 - .035, -d / 2 + .01, yD, .42, .635, .075, 3);
    K.box('duvet', -w / 2 + .045, w / 2 - .045, yD - .03, yD + .15, .54, .665, .055, 3);
    K.box(thr, -w / 2 + .03, w / 2 - .03, -d / 2 + .2, -d / 2 + .7, .615, .648, .012);
    for (const s of [-1, 1]) K.box(thr, s > 0 ? w / 2 - .034 : -w / 2 + .022, s > 0 ? w / 2 - .022 : -w / 2 + .034, -d / 2 + .2, -d / 2 + .7, .36, .64, .008);
    for (const s of [-1, 1]) {
      const x = s * (w / 4 - .01);
      K.rbox('linen', x, yH - .17, .84, w / 2 - .14, .17, .56, {r: .085, seg: 3, rx: -.26});
      K.rbox('duvet', x, yH - .45, .7, w / 2 - .2, .15, .42, {r: .07, seg: 3, rx: -.95});
      K.rbox(acc, s * (w / 4 - .17), yH - .6, .73, .4, .12, .38, {r: .06, seg: 3, rx: -.5, rz: s * .12});
    }
    K.hcyl(acc, 0, yH - .74, .72, .1, .8, 'x', 18); K.hcyl('gold', -.41, yH - .74, .72, .07, .02, 'x', 14); K.hcyl('gold', .41, yH - .74, .72, .07, .02, 'x', 14);
  },
  nightstand(K, w, d, h, o){
    K.box(o.top || 'marbleBlack', -w / 2, w / 2, -d / 2, d / 2, h - .03, h, .006);
    K.box('walnut', -w / 2 + .01, w / 2 - .01, -d / 2 + .03, d / 2, .14, h - .03, .008);
    const zs = [.15, .15 + (h - .2) / 2, h - .045];
    for (let k = 0; k < 2; k++) { K.box('walnut', -w / 2 + .02, w / 2 - .02, -d / 2 + .008, -d / 2 + .032, zs[k] + .008, zs[k + 1] - .008, .006); K.box('gold', -.07, .07, -d / 2, -d / 2 + .01, (zs[k] + zs[k + 1]) / 2 - .008, (zs[k] + zs[k + 1]) / 2 + .008); }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) taperLeg(K, 'gold', sx * (w / 2 - .05), sy * (d / 2 - .06), 0, .14, .016);
  },
  tableLamp(K, w, d, h, o){
    const r = w / 2, b = h * .55;
    K.lathe(o.base || 'ceramic', 0, 0, [[0, 0], [r * .45, 0], [r * .5, .015], [r * .42, .04], [r * .62, b * .35], [r * .64, b * .6], [r * .45, b * .85], [r * .18, b * .95], [r * .1, b], [0, b]], 24);
    K.cyl('gold', 0, 0, .008, .008, b, h - .03, 8);
    K.cyl('lampShade', 0, 0, r * .98, r * .78, h * .62, h, 28, true);
    K.cyl('gold', 0, 0, r * .99, r * .99, h * .62, h * .62 + .008, 28, true); K.cyl('gold', 0, 0, r * .79, r * .79, h - .008, h, 28, true);
    K.cyl('lampGlow', 0, 0, r * .25, r * .2, h * .66, h * .78, 12);
  },
  floorLamp(K, w, d, h, o){
    const r = w / 2; K.lathe('marbleBlack', 0, 0, [[0, 0], [r * .6, 0], [r * .62, .025], [r * .5, .04], [0, .04]], 24);
    K.cyl('gold', 0, 0, .012, .012, .04, h - .05, 8); K.cyl('lampShade', 0, 0, r, r * .85, h - .36, h, 28, true);
    K.cyl('gold', 0, 0, r * 1.0, r * 1.0, h - .36, h - .35, 28, true); K.cyl('lampGlow', 0, 0, .05, .04, h - .3, h - .18, 10);
  },
  armchair(K, w, d, h, o){
    const fab = o.fab || 'velvetGreen', acc = o.accent;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) taperLeg(K, 'walnut', sx * (w / 2 - .07), sy * (d / 2 - .07), 0, .15, .02);
    K.box(fab, -w / 2 + .1, w / 2 - .1, -d / 2 + .02, d / 2 - .12, .14, .32, .04);
    K.box(fab, -w / 2 + .11, w / 2 - .11, -d / 2 + .03, d / 2 - .16, .31, .45, .055, 3);
    for (const s of [-1, 1]) { K.box(fab, s > 0 ? w / 2 - .13 : -w / 2 + .01, s > 0 ? w / 2 - .01 : -w / 2 + .13, -d / 2 + .02, d / 2 - .02, .14, .58, .05, 3); K.hcyl(fab, s * (w / 2 - .075), 0, .58, .062, d - .1, 'y', 14); }
    K.rbox(fab, 0, d / 2 - .13, .6, w - .14, .16, .44, {r: .06, seg: 3, rx: -.16});
    K.rbox(fab, 0, d / 2 - .25, .6, w - .3, .1, .3, {r: .045, seg: 3, rx: -.2});
    if (acc) K.rbox(acc, 0, d / 2 - .33, .57, .34, .1, .3, {r: .05, seg: 3, rx: -.35});
  },
  sofa(K, w, d, h, o){
    const fab = o.fab || 'velvetGreen', acc = o.accent || 'velvetBlush', aw = .17;
    const legX = w > 2.1 ? [-w / 2 + .07, 0, w / 2 - .07] : [-w / 2 + .07, w / 2 - .07];
    for (const x of legX) for (const sy of [-1, 1]) taperLeg(K, 'walnut', x, sy * (d / 2 - .07), 0, .11, .02);
    K.box(fab, -w / 2 + .02, w / 2 - .02, -d / 2 + .03, d / 2 - .02, .1, .3, .03);
    for (const s of [-1, 1]) { K.box(fab, s > 0 ? w / 2 - aw : -w / 2, s > 0 ? w / 2 : -w / 2 + aw, -d / 2 + .02, d / 2, .1, .6, .06, 3); K.hcyl(fab, s * (w / 2 - aw / 2), .01, .6, aw / 2 - .005, d - .06, 'y', 14); }
    K.box(fab, -w / 2 + aw - .01, w / 2 - aw + .01, d / 2 - .19, d / 2, .3, h - .1, .05);
    const wi = w - 2 * aw, n = Math.max(1, Math.round(wi / .8)), cw = wi / n;
    for (let i = 0; i < n; i++) {
      const x0 = -wi / 2 + i * cw, xc = x0 + cw / 2;
      K.box(fab, x0 + .006, x0 + cw - .006, -d / 2 + .04, d / 2 - .19, .3, .46, .055, 3);
      K.rbox(fab, xc, d / 2 - .27, .655, cw - .02, .19, .4, {r: .08, seg: 3, rx: -.18});
    }
    for (const s of [-1, 1]) K.rbox(acc, s * (wi / 2 - .24), d / 2 - .42, .63, .42, .12, .4, {r: .06, seg: 3, rx: -.35, rz: -s * .15});
    if (wi > 1.7) K.rbox(o.accent2 || 'linen', 0, d / 2 - .42, .62, .4, .11, .36, {r: .055, seg: 3, rx: -.35});
  },
  chair(K, w, d, h, o){
    const fab = o.fab || 'leather', wood = o.wood || 'walnut';
    for (const sx of [-1, 1]) { taperLeg(K, wood, sx * (w / 2 - .045), -d / 2 + .05, 0, .43, .02); K.rod(wood, [sx * (w / 2 - .045), d / 2 - .03, 0], [sx * (w / 2 - .05), d / 2 - .09, .44], .019, 8, .014); }
    K.box(wood, -w / 2 + .03, w / 2 - .03, -d / 2 + .03, d / 2 - .06, .37, .43, .01);
    K.box(fab, -w / 2 + .01, w / 2 - .01, -d / 2 + .005, d / 2 - .05, .42, .5, .035, 2);
    K.rbox(fab, 0, d / 2 - .075, (h + .5) / 2 + .01, w - .06, .065, h - .53, {r: .03, rx: -.12});
    for (const sx of [-1, 1]) K.rod(wood, [sx * (w / 2 - .05), d / 2 - .09, .44], [sx * (w / 2 - .06), d / 2 - .04, h - .04], .014, 8);
  },
  officeChair(K, w, d, h, o){
    const fab = o.fab || 'leather', R = Math.min(w, d) / 2 - .03;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; K.rod('steel', [0, 0, .07], [Math.cos(a) * R, Math.sin(a) * R, .05], .018, 6); K.ell('black', Math.cos(a) * R, Math.sin(a) * R, .028, .028, .028, .028, {ws: 8, hs: 6}); }
    K.cyl('steel', 0, 0, .03, .03, .06, .38, 10); K.cyl('black', 0, 0, .045, .045, .06, .2, 10);
    K.box(fab, -w / 2 + .03, w / 2 - .03, -d / 2 + .02, d / 2 - .07, .4, .49, .04, 2);
    K.rbox(fab, 0, d / 2 - .07, (h + .52) / 2, w - .1, .07, h - .54, {r: .035, rx: -.14});
    for (const s of [-1, 1]) { K.rod('steel', [s * (w / 2 - .04), -.02, .45], [s * (w / 2 - .04), .02, .63], .012, 6); K.box('black', s * (w / 2 - .04) - .03, s * (w / 2 - .04) + .03, -.14, .1, .63, .66, .012); }
  },
  stool(K, w, d, h, o){
    const r = w / 2;
    K.lathe('gold', 0, 0, [[0, 0], [r * .85, 0], [r * .88, .01], [r * .3, .03], [0, .03]], 24);
    K.cyl('gold', 0, 0, .025, .025, .03, h - .06, 10); K.torus('gold', 0, 0, h * .38, r * .7, .012, {ts: 24, rs: 6});
    K.lathe(o.fab || 'leather', 0, 0, [[0, h - .07], [r * .92, h - .07], [r, h - .045], [r * .96, h - .005], [r * .7, h], [0, h]], 24);
  },
  coffeeRound(K, w, d, h, o){
    const r = w / 2, top = o.top || 'marbleBlack';
    K.lathe(top, 0, 0, [[0, h - .045], [r - .015, h - .045], [r, h - .03], [r, h - .012], [r - .012, h], [0, h]], 40);
    K.torus('gold', 0, 0, .03, r * .68, .012, {ts: 36, rs: 6});
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .4; K.rod('gold', [Math.cos(a) * r * .68, Math.sin(a) * r * .68, .03], [Math.cos(a) * r * .55, Math.sin(a) * r * .55, h - .045], .012, 6); }
    if (o.decor !== false && r > .28) {
      K.box('book', -r * .5, -r * .5 + .26, -r * .25, -r * .25 + .2, h, h + .035, .004); K.box('velvetNavy', -r * .5 + .02, -r * .5 + .23, -r * .23, -r * .23 + .17, h + .035, h + .06, .004);
      K.lathe('gold', r * .3, r * .1, [[0, h], [.05, h], [.11, h + .05], [.115, h + .055], [.1, h + .05], [.04, h + .01], [0, h + .01]], 20);
      K.ell('blossom', r * .3, r * .1, h + .05, .05, .05, .03, {ws: 8, hs: 5}); K.ell('bread', r * .3 + .05, r * .1 - .02, h + .045, .03, .03, .025, {ws: 8, hs: 5});
    }
  },
  sideTable(K, w, d, h, o){
    const r = w / 2; K.lathe(o.top || 'marbleBlack', 0, 0, [[0, h - .03], [r, h - .03], [r, h], [0, h]], 28);
    K.lathe('gold', 0, 0, [[0, 0], [r * .7, 0], [r * .7, .015], [r * .12, .05], [r * .08, h * .5], [r * .14, h - .03], [0, h - .03]], 20);
    K.lathe('ceramic', 0, 0, [[0, h], [.035, h], [.05, h + .06], [.03, h + .12], [.025, h + .14], [0, h + .14]], 14);
  },
  tableRound(K, w, d, h, o){
    const r = w / 2, cloth = o.cloth || 'linen', seats = o.seats || 4, top = h;
    K.lathe('gold', 0, 0, [[0, 0], [Math.min(.28, r * .55), 0], [Math.min(.28, r * .55), .02], [.05, .06], [.04, top - .3], [0, top - .3]], 24);
    const skirt = top - (o.drop ?? .32);
    K.lathe(cloth, 0, 0, [[0, top], [r - .03, top], [r - .005, top - .012], [r - .006, top - .04], [r - .01, skirt + .02], [r - .008, skirt], [r - .03, skirt - .003]], 72, 1, 1,
      (a, y) => y < top - .03 ? 1 - .018 * (1 + Math.sin(a * Math.round(r * 30))) * Math.min(1, (top - .03 - y) / .2) : 1);
    if (o.setting !== 'none') for (let i = 0; i < seats; i++) { const a = (o.a0 || 0) + i * TAU / seats; K.at(Math.cos(a) * (r - .2), Math.sin(a) * (r - .2), top, a + Math.PI / 2, () => placeSetting(K, o.setting || (r < .5 ? 'coffee' : 'dinner'))); }
    if (o.game) {                                                      // chess board + pieces
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) K.box((i + j) % 2 ? 'black' : 'linen', -.2 + i * .05, -.15 + i * .05, -.2 + j * .05, -.15 + j * .05, top, top + .006);
      for (let i = 0; i < 8; i++) for (const [j, m] of [[0, 'linen'], [1, 'linen'], [6, 'black'], [7, 'black']]) K.cyl(m, -.175 + i * .05, -.175 + j * .05, .015, .012, top + .006, top + .03 + (j % 7 === 0 ? .02 : 0), 8);
      return;
    }
    if (r >= .5) { K.lathe('glassClear', 0, 0, [[0, top], [.05, top], [.06, top + .1], [.04, top + .16], [0, top + .14]], 14); flowerDome(K, 0, 0, top + .19, .09, 14, hash('c' + r)); for (const a of [0, Math.PI]) K.cyl('lampGlow', Math.cos(a) * .2, Math.sin(a) * .2, .022, .022, top, top + .12, 10); }
    else { K.cyl('glassClear', 0, 0, .025, .025, top, top + .1, 10); K.ell('blossom', 0, 0, top + .12, .035, .035, .03, {ws: 8, hs: 5}); }
  },
  tableRect(K, w, d, h, o){
    // long axis along x; seats on the -y and +y sides, optional heads at the ends
    const wood = o.wood || 'walnut';
    K.box(wood, -w / 2, w / 2, -d / 2, d / 2, h - .045, h, .012);
    for (const sx of [-1, 1]) { K.box(wood, sx * (w / 2 - .25) - .05, sx * (w / 2 - .25) + .05, -d / 2 + .12, d / 2 - .12, 0, h - .045, .01); K.box('gold', sx * (w / 2 - .25) - .07, sx * (w / 2 - .25) + .07, -d / 2 + .1, d / 2 - .1, 0, .015); }
    K.box(wood, -w / 2 + .3, w / 2 - .3, -.05, .05, .1, .16, .01);
    K.box(o.runner || 'linen', -w / 2 + .15, w / 2 - .15, -.18, .18, h, h + .004);
    const per = o.perSide || Math.max(1, Math.floor(w / .75));
    if (o.setting !== 'none') {
      for (let i = 0; i < per; i++) { const x = -w / 2 + (i + .5) * w / per; K.at(x, -d / 2 + .2, h, 0, () => placeSetting(K, 'dinner')); K.at(x, d / 2 - .2, h, Math.PI, () => placeSetting(K, 'dinner')); }
      if (o.ends) { K.at(-w / 2 + .2, 0, h, -Math.PI / 2, () => placeSetting(K, 'dinner')); K.at(w / 2 - .2, 0, h, Math.PI / 2, () => placeSetting(K, 'dinner')); }
    }
    if (o.setting === 'none') return;
    const nc = Math.max(1, Math.round(w / 1.4));
    for (let i = 0; i < nc; i++) { const x = -w / 2 + (i + .5) * w / nc; K.lathe('gold', x, 0, [[0, h], [.05, h], [.06, h + .06], [.035, h + .1], [0, h + .1]], 14); flowerDome(K, x, 0, h + .13, .1, 16, hash('t' + i + w)); K.cyl('lampGlow', x - .3, 0, .02, .02, h, h + .14, 8); K.cyl('lampGlow', x + .3, 0, .02, .02, h, h + .14, 8); }
  },
  desk(K, w, d, h, o){
    K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, h - .05, h - .02, .006); K.box(o.top || 'marbleBlack', -w / 2, w / 2, -d / 2, d / 2, h - .02, h, .004);
    for (const s of [-1, 1]) K.box('walnut', s > 0 ? w / 2 - .05 : -w / 2 + .01, s > 0 ? w / 2 - .01 : -w / 2 + .05, -d / 2 + .02, d / 2, 0, h - .05, .006);
    K.box('walnut', -w / 2 + .05, w / 2 - .05, d / 2 - .03, d / 2, .3, h - .05);
    const nd = Math.max(1, Math.round((w - .1) / .55));
    for (let i = 0; i < nd; i++) { const x0 = -w / 2 + .06 + i * (w - .12) / nd, x1 = x0 + (w - .12) / nd; K.box('walnut', x0 + .004, x1 - .004, -d / 2 + .02, d / 2 - .04, h - .17, h - .05, .005); K.box('gold', (x0 + x1) / 2 - .06, (x0 + x1) / 2 + .06, -d / 2 + .01, -d / 2 + .02, h - .115, h - .1); }
    if (o.lamp !== false) { const x = w / 2 - .22; K.lathe('gold', x, d / 2 - .22, [[0, h], [.07, h], [.07, h + .012], [0, h + .012]], 20); K.cyl('gold', x, d / 2 - .22, .008, .008, h, h + .42, 8); K.cyl('lampShade', x, d / 2 - .22, .12, .09, h + .3, h + .48, 24, true); }
    if (w > 1) { K.box('leather', -.25, .25, -d / 2 + .05, -d / 2 + .38, h, h + .006, .002); K.box('linen', -.12, .1, -d / 2 + .1, -d / 2 + .3, h + .006, h + .012); K.rod('gold', [.13, -d / 2 + .12, h + .014], [.15, -d / 2 + .3, h + .014], .004, 6); }
  },
  wardrobe(K, w, d, h, o){
    K.box('walnut', -w / 2, w / 2, -d / 2 + .025, d / 2, .08, h - .04, .006);
    K.box('black', -w / 2 + .03, w / 2 - .03, -d / 2 + .06, d / 2, 0, .08);
    K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, h - .04, h, .008);
    const n = Math.max(1, Math.round(w / .5)), dw = w / n;
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + i * dw + .004, x1 = x0 + dw - .008;
      K.box('walnut', x0, x1, -d / 2 + .008, -d / 2 + .028, .09, h - .05, .006);
      K.box('walnut', x0 + .07, x1 - .07, -d / 2 + .003, -d / 2 + .01, .2, h * .45, .004); K.box('walnut', x0 + .07, x1 - .07, -d / 2 + .003, -d / 2 + .01, h * .5, h - .17, .004);
      const hx = i % 2 ? x0 + .04 : x1 - .04; K.box('gold', hx - .008, hx + .008, -d / 2, -d / 2 + .008, .85, 1.45, .003);
    }
  },
  minibar(K, w, d, h, o){
    const ch = .92; K.box('walnut', -w / 2, w / 2, -d / 2 + .025, d / 2, .06, ch, .006); K.box('black', -w / 2 + .03, w / 2 - .03, -d / 2 + .06, d / 2, 0, .06);
    K.box('marbleBlack', -w / 2, w / 2, -d / 2, d / 2, ch, ch + .03, .005);
    const n = Math.max(1, Math.round(w / .45)), dw = w / n;
    for (let i = 0; i < n; i++) { const x0 = -w / 2 + i * dw + .004, x1 = x0 + dw - .008; K.box('walnut', x0, x1, -d / 2 + .005, -d / 2 + .028, .07, ch - .01, .006); K.box('gold', (x0 + x1) / 2 - .05, (x0 + x1) / 2 + .05, -d / 2, -d / 2 + .006, ch - .09, ch - .075); }
    const z = ch + .03;
    if (w >= .7) {
      const mx = -w / 2 + .2; K.rbox('steel', mx, d / 2 - .2, z + .16, .2, .3, .32, {r: .03}); K.box('black', mx - .07, mx + .07, d / 2 - .36, d / 2 - .34, z + .2, z + .27); K.cyl('ceramic', mx, d / 2 - .3, .035, .035, z + .03, z + .1, 12);
      K.lathe('steel', w / 2 - .2, d / 2 - .18, [[0, z], [.07, z], [.08, z + .12], [.06, z + .2], [.03, z + .22], [0, z + .22]], 16);
      K.box('gold', -.12, .2, -d / 2 + .05, -d / 2 + .3, z, z + .012); for (let i = 0; i < 2; i++) placeCup(K, -.05 + i * .14, -d / 2 + .17, z + .012);
    }
  },
  tv(K, w, d, h, o){
    K.box('black', -w / 2, w / 2, -d / 2 + .01, d / 2, 0, h, .006);
    K.box('screen', -w / 2 + .012, w / 2 - .012, -d / 2, -d / 2 + .012, .012, h - .012);
  },
  monitor(K, w, d, h, o){
    K.box('black', -w / 2 + .02, w / 2 - .02, d / 2 - .035, d / 2 - .015, h * .32, h, .006); K.box('screen', -w / 2 + .03, w / 2 - .03, d / 2 - .04, d / 2 - .035, h * .34, h - .015);
    K.box('steel', -.03, .03, d / 2 - .02, d / 2, 0, h * .4); K.box('steel', -.1, .1, d / 2 - .14, d / 2, 0, .01, .004);
    K.box('ceramic', -w / 2 + .05, w / 2 - .05, -d / 2, -d / 2 + .14, 0, .012, .004);
  },
  basinSet(K, w, d, h, o){
    const r = Math.min(w / 2, .2), cy = -d / 2 + r + .01;
    K.lathe('ceramic', 0, cy, [[0, .0], [r * .55, 0], [r * .8, .02], [r * .97, .07], [r, .12], [r * .93, .125], [r * .9, .08], [r * .7, .035], [r * .3, .022], [0, .022]], 32);
    K.cyl('gold', 0, cy, .022, .022, .022, .026, 12);
    const fy = d / 2 - .05; K.cyl('gold', 0, fy, .022, .022, 0, .02, 12); K.cyl('gold', 0, fy, .013, .013, .02, h - .07, 10);
    K.torus('gold', 0, fy - .065, h - .07, .065, .013, {axis: 'x', arc: Math.PI, ts: 14, rs: 6});
    K.cyl('gold', 0, fy - .13, .011, .013, h - .13, h - .07, 10);
    K.rod('gold', [.06, fy, .07], [.1, fy - .04, .07], .008, 6); K.cyl('gold', .06, fy, .016, .016, 0, .07, 10);
  },
  wc(K, w, d, h, o){
    const ledge = o.ledge || 'marble', cy = d / 2 - .16 - .25;
    K.box(ledge, -w / 2, w / 2, d / 2 - .16, d / 2, 0, h, .008); K.box('gold', -.1, .1, d / 2 - .165, d / 2 - .158, .82, .95, .004); K.box('steel', -.003, .003, d / 2 - .17, d / 2 - .165, .84, .93);
    K.rbox('ceramic', 0, (cy + d / 2 - .16) / 2, .3, .26, d / 2 - .16 - cy, .17, {r: .06});
    K.lathe('ceramic', 0, cy, [[0, .2], [.08, .2], [.15, .24], [.18, .3], [.19, .37], [.19, .4], [0, .4]], 28, 1, 1.3);
    K.torus('ceramic', 0, cy, .41, .155, .022, {ts: 30, rs: 8, sy: 1.3});
    K.ell('ceramic', 0, cy - .005, .44, .175, .235, .03, {ws: 20, hs: 8});
  },
  tub(K, w, d, H, o){
    const h = o.th || H - .22, deck = o.deck || 'marble', a = w / 2 - .1, b = d / 2 - .1;
    const s = new THREE.Shape(); s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
    const hole = new THREE.Path(); hole.absellipse(0, 0, a, b, 0, TAU, true); s.holes.push(hole);
    K.ext(deck, s, h - .05, h, {cs: 40});
    K.box(deck, -w / 2, w / 2, -d / 2, -d / 2 + .04, 0, h - .05); K.box(deck, -w / 2, w / 2, d / 2 - .04, d / 2, 0, h - .05); K.box(deck, -w / 2, -w / 2 + .04, -d / 2 + .04, d / 2 - .04, 0, h - .05); K.box(deck, w / 2 - .04, w / 2, -d / 2 + .04, d / 2 - .04, 0, h - .05);
    K.lathe('tubIn', 0, 0, [[a, h - .05], [a * .97, h - .2], [a * .9, h - .38], [a * .7, h - .45], [0, h - .46]].reverse(), 40, 1, b / a);
    K.cyl('water', 0, 0, a * .95, a * .95, h - .17, h - .165, 40); const wg = K.parts.water.pop(); wg.scale(1, 1, b / a); K.parts.water.push(wg);
    K.cyl('gold', a - .03, 0, .02, .02, h, h + .2, 10); K.rod('gold', [a - .03, 0, h + .2], [a - .16, 0, h + .2], .014, 8); K.cyl('gold', a - .03, .1, .022, .022, h, h + .05, 10); K.cyl('gold', a - .03, -.1, .022, .022, h, h + .05, 10);
    K.rbox('towel', -a + .1, b * .2, h + .03, .3, .22, .06, {r: .025});
  },
  tubFree(K, w, d, H, o){
    const h = o.th || H - .32, a = w / 2, b = d / 2;
    K.lathe('ceramic', 0, 0, [[0, .03], [.75, .02], [.86, .06], [.94, .2], [.985, .4], [1, h], [.95, h + .005], [.93, h - .04], [.9, .32], [.82, .15], [.6, .1], [0, .1]].map(([r, z]) => [r * a, z]), 48, 1, b / a);
    K.cyl('water', 0, 0, a * .9, a * .9, h - .14, h - .135, 40); const wg = K.parts.water.pop(); wg.scale(1, 1, b / a); K.parts.water.push(wg);
    const fx = a - .06, fy = b - .06; K.cyl('gold', fx, fy, .04, .04, 0, .02, 12); K.cyl('gold', fx, fy, .018, .018, .02, h + .3, 10); K.rod('gold', [fx, fy, h + .3], [fx - .2, fy - .12, h + .26], .014, 8);
  },
  towelBar(K, w, d, h, o){
    K.hcyl('gold', 0, d / 2 - .04, h - .03, .012, w, 'x', 10); for (const s of [-1, 1]) K.box('gold', s * w / 2 - (s > 0 ? .02 : 0), s * w / 2 + (s < 0 ? .02 : 0), d / 2 - .04, d / 2, h - .045, h - .015);
    const tw = w - .14; K.hcyl(o.m || 'towel', 0, d / 2 - .04, h - .03, .026, tw, 'x', 12);
    K.box(o.m || 'towel', -tw / 2, tw / 2, d / 2 - .07, d / 2 - .055, h - .5, h - .03, .006); K.box(o.m || 'towel', -tw / 2, tw / 2, d / 2 - .025, d / 2 - .01, h - .42, h - .03, .006);
    K.box('gold', -tw / 2, tw / 2, d / 2 - .072, d / 2 - .07, h - .44, h - .425);
  },
  plant(K, w, d, h, o){
    const R = w / 2, pr = o.potR || Math.min(.2, R), ph = o.potH || .45, r = rng(hash(`p${w}${h}${o.type || ''}`)), pot = o.pot || 'pot';
    K.lathe(pot, 0, 0, [[0, 0], [pr * .78, 0], [pr * .86, .02], [pr * .97, ph - .06], [pr, ph - .02], [pr * 1.0, ph], [pr * .93, ph], [pr * .92, ph - .04], [0, ph - .04]], 24);
    K.cyl('soil', 0, 0, pr * .9, pr * .9, ph - .06, ph - .045, 18);
    const top = h - .02, type = o.type || (h - ph > 1.3 ? 'tall' : 'bush');
    if (type === 'tall') {
      // fiddle-leaf / ficus: woody stems with large leaves
      const stems = 3; for (let s = 0; s < stems; s++) {
        const a = s * TAU / stems + r(), lean = .06 + r() * .08, sx = Math.cos(a) * lean, sy = Math.sin(a) * lean;
        K.rod('trunk', [0, 0, ph - .05], [sx, sy, top - .25], .018, 6, .01);
        const n = 14; for (let i = 0; i < n; i++) {
          const t = .35 + .65 * i / n, cx = sx * t, cy = sy * t, cz = ph + (top - .25 - ph) * t + .05, la = r() * TAU, rl = Math.min(R - .12, .1 + r() * .14) * (1.1 - t * .4);
          K.ell(i % 3 ? 'leaf' : 'leafDark', cx + Math.cos(la) * rl, cy + Math.sin(la) * rl, cz, .1, .06, .012, {ws: 8, hs: 5, az: la, ax: .5 - r() * .9});
        }
        K.ell('leaf', sx, sy, top - .12, .08, .05, .012, {ws: 8, hs: 5, ax: 1.2, az: a});
      }
    } else if (type === 'palm') {
      K.rod('trunk', [0, 0, ph - .05], [0, 0, top * .62], .045, 8, .03);
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + r() * .3, L = Math.min(R - .03, (top - top * .62) * 1.2);
        for (let k = 1; k <= 7; k++) { const t = k / 7, x = Math.cos(a) * L * t, y = Math.sin(a) * L * t, z = top * .62 + (top - top * .62) * Math.sin(t * Math.PI * .8) * .9; K.ell(k % 2 ? 'leaf' : 'leafDark', x, y, z, .11 * (1 - t * .5), .03, .008, {ws: 6, hs: 4, az: -a + Math.PI / 2 + (k % 2 ? .6 : -.6), ax: .3}); }
        K.rod('trunk', [0, 0, top * .62], [Math.cos(a) * L * .9, Math.sin(a) * L * .9, top * .62 + (top - top * .62) * .5], .006, 4); }
    } else {
      // bushy: dense mound of leaves
      const n = Math.round(28 + 40 * Math.min(1, (R * (h - ph)) / .4));
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, el = r(), hz = ph + (top - ph) * (.15 + .85 * Math.sqrt(r())), maxr = (R - .06) * Math.sin(Math.PI * Math.min(1, .25 + (hz - ph) / (top - ph) * .8)), rr = maxr * (.4 + .6 * Math.sqrt(el));
        K.ell(i % 3 ? 'leaf' : 'leafDark', Math.cos(a) * rr, Math.sin(a) * rr, hz, .075, .035, .01, {ws: 6, hs: 4, az: -a + r() - .5, ax: .3 + r() * .8});
      }
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5; K.rod('trunk', [0, 0, ph - .04], [Math.cos(a) * (R - .1) * .5, Math.sin(a) * (R - .1) * .5, ph + (top - ph) * .55], .008, 4); }
    }
  },
  flowers(K, w, d, h, o){
    const R = w / 2, vh = h * .42;
    K.lathe(o.vase || 'glassClear', 0, 0, [[0, 0], [R * .35, 0], [R * .45, vh * .4], [R * .3, vh * .85], [R * .34, vh], [0, vh * .9]], 18);
    for (let i = 0; i < 7; i++) { const a = i * TAU / 7; K.rod('leaf', [0, 0, vh * .8], [Math.cos(a) * R * .4, Math.sin(a) * R * .4, h - R * .7], .006, 4); }
    flowerDome(K, 0, 0, h - R * .75, R * .65, Math.round(20 + R * 60), hash('f' + w + h), o.cols);
  },
  floralGrand(K, w, d, h, o){
    const R = w / 2;
    K.lathe('marbleBlack', 0, 0, [[0, 0], [R * .62, 0], [R * .64, .04], [R * .55, .08], [R * .48, .7], [R * .98, .74], [R, .8], [R * .97, .82], [0, .82]], 48, 1, 1, (a, y) => y > .08 && y < .7 ? 1 + .03 * Math.cos(a * 24) : 1);
    K.lathe('gold', 0, 0, [[0, .82], [.22, .82], [.18, .86], [.3, 1.0], [.34, 1.15], [.24, 1.28], [.27, 1.32], [0, 1.3]], 32);
    const DR = Math.min(R * .62, h - 1.38);
    K.ell('leafDark', 0, 0, 1.36, DR * .92, DR * .92, DR * .62, {ws: 20, hs: 12});
    flowerDome(K, 0, 0, 1.36, DR, 560, hash('grand'), ['blossom', 'linen', 'blossom', 'red', 'linen', 'blossom'], 1.6);
    const r = rng(7); for (let i = 0; i < 40; i++) { const a = i * TAU / 40 + r() * .2, rr = DR * (.85 + r() * .3); K.ell(i % 2 ? 'leaf' : 'leafDark', Math.cos(a) * rr, Math.sin(a) * rr, 1.3 + r() * .12, .16, .055, .012, {ws: 7, hs: 4, az: -a + Math.PI / 2, ax: -.5 - r() * .4}); }
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3; K.rod('leaf', [0, 0, 1.3], [Math.cos(a) * .25, Math.sin(a) * .25, h - .12], .006, 4); K.ell('linen', Math.cos(a) * .25, Math.sin(a) * .25, h - .1, .05, .05, .04, {ws: 8, hs: 5}); }
  },
  lounger(K, w, d, h, o){
    const wood = o.wood || 'deck', fab = o.fab || 'linen';
    for (const s of [-1, 1]) { K.box(wood, s * w / 2 - (s > 0 ? .05 : 0), s * w / 2 + (s < 0 ? .05 : 0), -d / 2, d / 2 - .02, .18, .26, .01); K.box(wood, s * (w / 2 - .025) - .025, s * (w / 2 - .025) + .025, d / 2 - .1, d / 2 - .04, 0, .18); K.hcyl('rubber', s * (w / 2 - .03), -d / 2 + .1, .09, .09, .04, 'x', 16); }
    for (let y = -d / 2 + .05; y < d / 2 - .7; y += .075) K.box(wood, -w / 2 + .05, w / 2 - .05, y, y + .05, .23, .255);
    K.box(fab, -w / 2 + .04, w / 2 - .04, -d / 2 + .03, d / 2 - .68, .255, .33, .03, 2);
    const L = .66; K.rbox(wood, 0, d / 2 - .36, .28 + L / 2 * Math.sin(.8), w - .1, L, .03, {rx: .8});
    K.rbox(fab, 0, d / 2 - .38, .32 + L / 2 * Math.sin(.8), w - .1, L - .02, .07, {r: .03, rx: .8});
    K.rbox(o.towel || 'towel', 0, -d / 2 + .35, .35, w - .2, .32, .04, {r: .015});
  },
  daybed(K, w, d, h, o){
    K.box('deck', -w / 2, w / 2, -d / 2, d / 2, 0, .3, .02); K.box(o.fab || 'linen', -w / 2 + .04, w / 2 - .04, -d / 2 + .04, d / 2 - .04, .3, .44, .05, 3);
    K.rbox('velvetNavy', 0, d / 2 - .2, .54, w - .3, .16, .32, {r: .07, seg: 3, rx: -.4});
    for (const s of [-1, 1]) K.rbox('linen', s * .35, d / 2 - .38, .55, .42, .12, .38, {r: .06, seg: 3, rx: -.5});
  },
  treadmill(K, w, d, h, o){
    K.box('black', -w / 2, w / 2, -d / 2, d / 2 - .15, 0, .18, .04); K.box('rubber', -w / 2 + .1, w / 2 - .1, -d / 2 + .05, d / 2 - .2, .18, .2, .01);
    for (const s of [-1, 1]) { K.box('steel', s * (w / 2 - .05) - .04, s * (w / 2 - .05) + .04, -d / 2 + .05, d / 2 - .2, .16, .22, .015); K.rod('steel', [s * (w / 2 - .06), d / 2 - .2, .15], [s * (w / 2 - .08), d / 2 - .1, 1.2], .035, 10); K.rod('black', [s * (w / 2 - .08), d / 2 - .25, 1.0], [s * (w / 2 - .08), d / 2 - .65, 1.02], .02, 8); }
    K.rbox('black', 0, d / 2 - .15, 1.25, w - .1, .16, .32, {r: .03, rx: -.5}); K.rbox('screen', 0, d / 2 - .205, 1.28, w - .3, .01, .22, {rx: -.5});
    K.hcyl('black', 0, d / 2 - .2, 1.05, .018, w - .1, 'x', 8); K.box('black', -w / 2, w / 2, d / 2 - .25, d / 2, 0, .16, .03);
  },
  rack(K, w, d, h, o){
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { K.box('steel', sx * (w / 2 - .04) - .035, sx * (w / 2 - .04) + .035, sy * (d / 2 - .04) - .035, sy * (d / 2 - .04) + .035, 0, h, .006); for (let z = .4; z < h - .2; z += .1) K.box('black', sx * (w / 2 - .04) - .01, sx * (w / 2 - .04) + .01, sy * (d / 2 - .04) - .036, sy * (d / 2 - .04) - .03, z, z + .02); }
    for (const sy of [-1, 1]) K.box('steel', -w / 2 + .01, w / 2 - .01, sy * (d / 2 - .04) - .035, sy * (d / 2 - .04) + .035, h - .07, h, .006);
    for (const sx of [-1, 1]) { K.box('steel', sx * (w / 2 - .04) - .035, sx * (w / 2 - .04) + .035, -d / 2 + .01, d / 2 - .01, h - .07, h, .006); K.box('black', sx * (w / 2 - .04) - .04, sx * (w / 2 - .04) + .04, -d / 2 + .01, d / 2 - .01, 0, .04); }
    K.hcyl('chrome', 0, -d / 2 + .25, 1.35, .014, w - .02, 'x', 10);
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) K.hcyl(i ? 'rubber' : 'red', s * (w / 2 - .14 - i * .045), -d / 2 + .25, 1.35, .225 - i * .03, .035, 'x', 24);
    for (let i = 0; i < 4; i++) K.hcyl('rubber', -w / 2 + .3 + i * .15, d / 2 - .22, .25, .2 - i * .02, .04, 'x', 22);
  },
  weightBench(K, w, d, h, o){
    K.rbox('leather', 0, 0, h - .05, w - .02, d - .02, .1, {r: .03}); K.box('steel', -.04, .04, -d / 2 + .1, d / 2 - .1, h - .1, h - .1 + .02);
    for (const s of [-1, 1]) { K.box('steel', -.04, .04, s * (d / 2 - .1) - .03, s * (d / 2 - .1) + .03, 0, h - .1); K.box('steel', -w / 2 + .02, w / 2 - .02, s * (d / 2 - .1) - .03, s * (d / 2 - .1) + .03, 0, .04, .01); }
  },
  dumbbellRack(K, w, d, h, o){
    for (const s of [-1, 1]) K.box('steel', s * (w / 2 - .03) - .03, s * (w / 2 - .03) + .03, -d / 2 + .05, d / 2 - .05, 0, h, .006);
    for (const [z, y] of [[h * .55, -d / 4 + .02], [h - .03, d / 4 - .02]]) { K.rbox('steel', 0, y, z, w - .04, d / 2 - .06, .03, {rx: .25}); const n = Math.floor((w - .1) / .32);
      for (let i = 0; i < n; i++) { const x = -w / 2 + .2 + i * .32, r = .045 + i * .006; K.hcyl('chrome', x, y, z + .07, .014, .26, 'x', 8); for (const s of [-1, 1]) K.hcyl('black', x + s * .1, y, z + .07, r, .06, 'x', 6); } }
  },
  piano(K, w, d, h, o){
    // keyboard toward -y; straight bass side at -x, tail toward +y
    const y0 = -d / 2 + .32, s = new THREE.Shape();
    s.moveTo(-w / 2, y0); s.lineTo(w / 2, y0); s.lineTo(w / 2, y0 + .32);
    s.bezierCurveTo(w / 2, y0 + .78, w * .02, y0 + .6, w * .02, d / 2 - .55);
    s.bezierCurveTo(w * .02, d / 2 - .1, -w * .1, d / 2, -w * .25, d / 2);
    s.bezierCurveTo(-w * .42, d / 2, -w / 2, d / 2 - .1, -w / 2, d / 2 - .3); s.closePath();
    K.ext('pianoBlack', s, .62, .96, {cs: 30}); K.ext('gold', s, .955, .962, {cs: 30});
    const lid = K.ext('pianoBlack', s, 0, .015, {cs: 30}); K.parts.pianoBlack.pop();
    lid.translate(w / 2, 0, 0); lid.rotateZ(.5); lid.translate(-w / 2, .962 + Math.sin(.5) * 0, 0); K.parts.pianoBlack.push(lid);
    K.rod('pianoBlack', [w * .3, y0 + .5, .962], [w * .3, y0 + .5, .962 + w * .78 * Math.sin(.5)], .008, 6);
    K.box('pianoBlack', -w / 2, w / 2, -d / 2 + .02, y0, .6, .7, .01);
    for (const sx of [-1, 1]) K.box('pianoBlack', sx > 0 ? w / 2 - .06 : -w / 2, sx > 0 ? w / 2 : -w / 2 + .06, -d / 2, y0, .6, .8, .01);
    K.box('ceramic', -w / 2 + .07, w / 2 - .07, -d / 2 + .03, y0 - .06, .7, .725);
    const kw = (w - .14) / 52; let k = 0; for (let i = 0; i < 51; i++) { const n = i % 7; if (n === 2 || n === 6) continue; const x = -w / 2 + .07 + (i + 1) * kw; K.box('black', x - kw * .3, x + kw * .3, -d / 2 + .09, y0 - .06, .725, .742); k++; }
    K.rbox('pianoBlack', 0, y0 + .05, 1.08, w * .55, .02, .26, {rx: -.25});
    for (const [x, y] of [[-w / 2 + .12, y0 + .08], [w / 2 - .12, y0 + .08], [-w * .22, d / 2 - .3]]) { K.lathe('pianoBlack', x, y, [[0, .05], [.05, .05], [.04, .15], [.06, .45], [.07, .62], [0, .62]], 16); K.ell('gold', x, y, .03, .03, .03, .03, {ws: 8, hs: 6}); }
    K.box('pianoBlack', -.08, .08, y0 + .05, y0 + .12, .05, .62); K.box('pianoBlack', -.14, .14, y0 + .02, y0 + .14, .03, .07, .01); for (const x of [-.06, 0, .06]) K.box('gold', x - .015, x + .015, y0 - .05, y0 + .03, .05, .065, .004);
  },
  pianoBench(K, w, d, h, o){ K.box('leather', -w / 2, w / 2, -d / 2, d / 2, h - .07, h, .025, 2); K.box('pianoBlack', -w / 2 + .02, w / 2 - .02, -d / 2 + .02, d / 2 - .02, h - .14, h - .07); for (const sx of [-1, 1]) for (const sy of [-1, 1]) taperLeg(K, 'pianoBlack', sx * (w / 2 - .05), sy * (d / 2 - .05), 0, h - .14, .022); },
  curtain(K, w, d, h, o){
    const A = d / 2 - .004, lam = o.lambda || .2, nu = Math.max(6, Math.ceil(w / lam * 5));
    K.sheet(o.m || 'drape', (u, v) => { const x = -w / 2 + u * w; return [x, A * Math.sin(TAU * x / lam), v * h]; }, nu, 3);
  },
  ac(K, w, d, h, o){
    K.rbox('acWhite', 0, .01, h / 2 + .01, w, d - .02, h - .02, {r: .035, seg: 3});
    K.box('acGrille', -w / 2 + .05, w / 2 - .05, -d / 2 + .02, -d / 2 + .1, .01, .03);
    K.rbox('acWhite', 0, -d / 2 + .04, .05, w - .1, .07, .012, {rx: .5});
    K.box('lampGlow', w / 2 - .12, w / 2 - .1, -d / 2 + .005, -d / 2 + .01, .12, .13);
  },
  trolley(K, w, d, h, o){
    K.box('carpetRed', -w / 2 + .02, w / 2 - .02, -d / 2 + .02, d / 2 - .02, .16, .2, .015); K.box('gold', -w / 2, w / 2, -d / 2, d / 2, .13, .16, .01);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.hcyl('rubber', sx * (w / 2 - .07), sy * (d / 2 - .1), .065, .065, .04, 'x', 14);
    const R = w / 2 - .03; for (const sy of [-.25, .25]) { for (const sx of [-1, 1]) K.cyl('gold', sx * R, sy * d, .015, .015, .16, h - R, 10); K.torus('gold', 0, sy * d, h - R, R, .015, {axis: 'y', arc: Math.PI, ts: 20, rs: 6}); }
    K.hcyl('gold', 0, 0, h - .02, .014, d * .5, 'y', 8);
    K.rbox('leather', -.12, -.05, .48, .22, .5, .56, {r: .03}); K.rbox('black', .14, -.1, .42, .2, .38, .44, {r: .03}); K.rbox('velvetNavy', .05, .18, .36, .4, .24, .32, {r: .04});
    K.rbox('velvetNavy', 0, 0, h - .45, .5, .08, .8, {r: .03});
  },
  massageTable(K, w, d, h, o){
    // head toward +y with face cradle
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.box('walnut', sx * (w / 2 - .08) - .03, sx * (w / 2 - .08) + .03, sy * (d / 2 - .32) - .03, sy * (d / 2 - .32) + .03, 0, h - .1);
    K.box('walnut', -w / 2 + .05, w / 2 - .05, -d / 2 + .25, d / 2 - .45, h - .14, h - .1, .01);
    K.box('linen', -w / 2, w / 2, -d / 2, d / 2 - .25, h - .1, h, .04, 3);
    K.torus('linen', 0, d / 2 - .17, h - .05, .1, .04, {sy: 1.15, ts: 24, rs: 8}); K.rod('walnut', [0, d / 2 - .32, h - .12], [0, d / 2 - .19, h - .1], .02, 6);
    K.rbox('towel', 0, -d / 2 + .35, h + .03, w - .12, .4, .05, {r: .02}); K.hcyl('velvetCream', 0, -d / 2 + .7, h + .07, .07, w - .2, 'x', 14);
    K.rbox('towel', 0, .1, h + .02, w - .02, .6, .025, {r: .01});
  },
  locker(K, w, d, h, o){
    K.box('walnut', -w / 2, w / 2, -d / 2 + .02, d / 2, 0, h, .004);
    for (const [z0, z1] of [[.08, h / 2 - .01], [h / 2 + .01, h - .04]]) { K.box('walnut', -w / 2 + .01, w / 2 - .01, -d / 2 + .004, -d / 2 + .022, z0, z1, .005); K.box('gold', w / 2 - .06, w / 2 - .045, -d / 2, -d / 2 + .006, z0 + .25, z0 + .45); K.box('gold', -.04, .04, -d / 2, -d / 2 + .006, z1 - .1, z1 - .06); }
  },
  chafing(K, w, d, h, o){
    const r = w / 2;
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + TAU / 8; K.rod('steel', [Math.cos(a) * r * .9, Math.sin(a) * r * .9, 0], [Math.cos(a) * r * .8, Math.sin(a) * r * .8, h * .5], .008, 6); }
    K.lathe('steel', 0, 0, [[0, h * .35], [r * .8, h * .35], [r * .95, h * .55], [r, h * .55], [r * .9, h * .56], [0, h * .5]], 28);
    const f = o.food || 'bread', rr = rng(hash('food' + f));
    K.lathe(f, 0, 0, [[0, h * .52], [r * .85, h * .52], [r * .8, h * .58], [0, h * .6]], 20);
    for (let i = 0; i < 9; i++) { const a = rr() * Math.PI + Math.PI, q = r * .55 * Math.sqrt(rr()); K.ell(i % 3 ? f : 'leaf', Math.cos(a) * q, Math.sin(a) * q, h * .6, .04, .035, .02, {ws: 7, hs: 4}); }
    K.lathe('steel', 0, 0, [[r * .92, h * .6], [r * .75, h * .85], [r * .4, h * .97], [0, h]], 24, 1, 1, null, 0, Math.PI);
    K.rod('steel', [r * .2, -r * .2, h * .6], [r * .75, -r * .55, h * .9], .008, 6); K.ell('steel', r * .2, -r * .2, h * .6, .04, .03, .012, {ws: 8, hs: 4});
  },
  cakeStand(K, w, d, h, o){
    const r = w / 2; K.lathe('gold', 0, 0, [[0, 0], [r * .4, 0], [r * .15, .03], [r * .1, h * .25], [r * .95, h * .27], [r, h * .3], [0, h * .3]], 24);
    const z = h * .3; K.cyl('linen', 0, 0, r * .7, r * .7, z, z + h * .14, 24); K.cyl(o.food || 'blossom', 0, 0, r * .55, r * .55, z + h * .14, z + h * .24, 24); K.cyl('linen', 0, 0, r * .56, r * .56, z + h * .24, z + h * .25, 24);
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; K.ell('red', Math.cos(a) * r * .38, Math.sin(a) * r * .38, z + h * .27, .018, .018, .018, {ws: 6, hs: 5}); }
    K.lathe('glassClear', 0, 0, [[r * .96, z], [r * .96, z + h * .45], [r * .8, z + h * .6], [r * .3, h - .03], [.02, h - .02], [0, h - .02]], 24);
    K.ell('gold', 0, 0, h - .02, .02, .02, .02, {ws: 8, hs: 5});
  },
  pastryTray(K, w, d, h, o){
    K.box('marble', -w / 2, w / 2, -d / 2, d / 2, 0, .02, .006); const r = rng(hash('pt' + w));
    const nx = Math.max(2, Math.floor(w / .09)), ny = Math.max(2, Math.floor(d / .09));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = -w / 2 + (i + .5) * w / nx, y = -d / 2 + (j + .5) * d / ny, m = ['bread', 'blossom', 'linen', 'bread', 'red'][(i + j * 2) % 5];
      if ((i + j) % 2) K.ell(m, x, y, .045, .035, .035, .028, {ws: 8, hs: 5}); else K.cyl(m, x, y, .032, .03, .02, .06 + r() * .02, 10); }
  },
  person(K, w, d, h, o){
    const top = o.top || 'towel', bot = o.bottom || 'chef', skin = 'skin', s = h / 1.75;
    for (const sx of [-1, 1]) { K.cyl('black', sx * .09 * s, .01, .05 * s, .055 * s, 0, .07 * s, 10); K.rod(bot, [sx * .09 * s, 0, .06 * s], [sx * .1 * s, 0, .88 * s], .065 * s, 10, .075 * s); }
    K.lathe(top, 0, 0, [[0, .82 * s], [.17 * s, .84 * s], [.2 * s, 1.0 * s], [.21 * s, 1.3 * s], [.2 * s, 1.42 * s], [.08 * s, 1.48 * s], [0, 1.49 * s]], 16, 1, .65);
    for (const sx of [-1, 1]) { K.rod(top, [sx * .2 * s, 0, 1.4 * s], [sx * .24 * s, -.04 * s, 1.08 * s], .045 * s, 8); K.rod(skin, [sx * .24 * s, -.04 * s, 1.08 * s], [sx * .2 * s, -.18 * s, .98 * s], .036 * s, 8); }
    K.cyl(skin, 0, 0, .045 * s, .045 * s, 1.47 * s, 1.55 * s, 8); K.ell(skin, 0, 0, 1.64 * s, .095 * s, .105 * s, .12 * s, {ws: 12, hs: 9});
    if (o.hat) K.lathe('towel', 0, 0, [[0, 1.7 * s], [.1 * s, 1.7 * s], [.11 * s, 1.78 * s], [.13 * s, 1.88 * s], [.1 * s, h], [0, h]], 14); else K.ell('black', 0, .015, 1.68 * s, .1 * s, .105 * s, .09 * s, {ws: 12, hs: 8});
    if (o.apron) K.box(o.apron, -.17 * s, .17 * s, -.14 * s, -.12 * s, .6 * s, 1.15 * s);
  },
  bottle(K, w, d, h, o){
    const r = w / 2; K.lathe(o.m || 'bottleGreen', 0, 0, [[0, 0], [r * .96, 0], [r, .02], [r, h * .62], [r * .92, h * .7], [r * .4, h * .8], [r * .33, h * .84], [r * .33, h - .005], [r * .38, h], [0, h]], 14);
    K.cyl('linen', 0, 0, r * 1.002, r * 1.002, h * .2, h * .45, 14, true); K.cyl('gold', 0, 0, r * .36, r * .36, h * .86, h, 10);
  },
  books(K, w, d, h, o){
    const r = rng(hash('b' + w + d + h + (o.seed || 0))), cols = ['book', 'art', 'velvetNavy', 'linen', 'velvetGreen', 'leather', 'throw', 'book'];
    let x = -w / 2 + .01;
    while (x < w / 2 - .05) {
      if (r() < .12) { const ww = Math.min(.18, w / 2 - x - .01); if (ww > .08) { if (r() < .5) { K.lathe('ceramic', x + ww / 2, 0, [[0, 0], [.035, 0], [.05, .08], [.03, .16], [0, .16]].map(([a, b]) => [a, Math.min(b, h - .01)]), 14); } else { for (let i = 0; i < 3; i++) K.box(cols[(i + 2) % cols.length], x, x + ww, -d / 2 + .02, d / 2 - .03, i * .035, i * .035 + .033, .003); } x += ww + .02; continue; } }
      const bw = .022 + r() * .035, bh = h * (.68 + r() * .3), bd = d * (.75 + r() * .2), m = cols[Math.floor(r() * cols.length)];
      if (x + bw > w / 2 - .01) break;
      K.box(m, x, x + bw, -d / 2, -d / 2 + bd, 0, bh, .003); if (r() < .5) K.box('gold', x, x + bw, -d / 2 - .0, -d / 2 + .002, bh * .8, bh * .84);
      x += bw + .002;
    }
  },
  chandelier(K, w, d, h, o){
    const R = w / 2, r = rng(hash('ch' + w)); K.cyl('gold', 0, 0, .012, .012, h * .55, h, 8); K.lathe('gold', 0, 0, [[0, h - .04], [.08, h - .04], [.06, h], [0, h]], 16);
    const tiers = [[R * .95, h * .25], [R * .7, h * .4], [R * .42, h * .55]];
    for (const [rr, z] of tiers) { K.torus('gold', 0, 0, z, rr, .01, {ts: 48, rs: 6}); const n = Math.round(rr * 40);
      for (let i = 0; i < n; i++) { const a = i * TAU / n; K.rod('glassClear', [Math.cos(a) * rr, Math.sin(a) * rr, z], [Math.cos(a) * rr, Math.sin(a) * rr, z - .06 - r() * .1], .004, 4); K.ell('glassClear', Math.cos(a) * rr, Math.sin(a) * rr, z - .1 - r() * .08, .014, .014, .022, {ws: 6, hs: 4}); }
      const nb = Math.max(4, Math.round(rr * 10)); for (let i = 0; i < nb; i++) { const a = (i + .5) * TAU / nb; K.cyl('linen', Math.cos(a) * rr, Math.sin(a) * rr, .012, .012, z, z + .08, 8); K.ell('lampGlow', Math.cos(a) * rr, Math.sin(a) * rr, z + .1, .018, .018, .03, {ws: 8, hs: 5}); } }
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; K.rod('gold', [0, 0, h * .55], [Math.cos(a) * R * .95, Math.sin(a) * R * .95, h * .25], .008, 6); }
    K.ell('glassClear', 0, 0, .05, .06, .06, .09, {ws: 10, hs: 8});
  },
  pendant(K, w, d, h, o){ const r = w / 2; K.cyl('gold', 0, 0, .006, .006, h * .4, h, 6); K.cyl('lampShade', 0, 0, r, r * .92, 0, h * .4, 28, true); K.cyl('gold', 0, 0, r, r, h * .4 - .01, h * .4, 28, true); K.cyl('lampGlow', 0, 0, r * .3, r * .3, h * .1, h * .25, 10); },
  cocktailTable(K, w, d, h, o){ const r = w / 2; K.lathe(o.top || 'marbleBlack', 0, 0, [[0, h - .035], [r, h - .035], [r, h], [0, h]], 32); K.lathe('gold', 0, 0, [[0, 0], [r * .6, 0], [r * .6, .02], [.04, .06], [.03, h - .035], [0, h - .035]], 20); K.cyl('lampGlow', 0, 0, .03, .03, h, h + .08, 10); K.lathe('glassClear', 0, 0, [[0, h], [.045, h], [.05, h + .1], [0, h + .1]].map(([a, b]) => [a, b]), 12); },
  bookcase(K, w, d, h, o){
    const t = .025; K.box('walnut', -w / 2, w / 2, d / 2 - .02, d / 2, 0, h); K.box('walnut', -w / 2, -w / 2 + t, -d / 2, d / 2, 0, h, .004); K.box('walnut', w / 2 - t, w / 2, -d / 2, d / 2, 0, h, .004);
    K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, h - .04, h, .006); K.box('walnut', -w / 2 + t, w / 2 - t, -d / 2 + .02, d / 2, 0, .1);
    const nb = Math.max(1, Math.round((w - .05) / .9)), bw = (w - 2 * t) / nb;
    for (let i = 1; i < nb; i++) K.box('walnut', -w / 2 + t + i * bw - .012, -w / 2 + t + i * bw + .012, -d / 2 + .01, d / 2 - .02, .1, h - .04);
    const rows = []; for (let z = .1; z < h - .3; z += .42) rows.push(z);
    rows.forEach((z, k) => { K.box('walnut', -w / 2 + t, w / 2 - t, -d / 2 + .01, d / 2 - .02, z, z + .025); K.box('lampGlow', -w / 2 + t, w / 2 - t, d / 2 - .06, d / 2 - .05, z + .38, z + .385);
      for (let i = 0; i < nb; i++) { const x0 = -w / 2 + t + i * bw + .02, x1 = x0 + bw - .04; K.at((x0 + x1) / 2, 0, z + .025, 0, () => PROPS.books(K, x1 - x0, d - .1, .34, {seed: k * 7 + i})); } });
  },
  wineWall(K, w, d, h, o){
    K.box('walnut', -w / 2, w / 2, d / 2 - .03, d / 2, 0, h); K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, h - .05, h, .006); K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, 0, .12, .006);
    const nc = Math.max(1, Math.round(w / .95)), cw = w / nc; for (let i = 0; i <= nc; i++) K.box('walnut', -w / 2 + i * cw - (i ? .02 : 0), -w / 2 + i * cw + (i < nc ? .02 : 0), -d / 2, d / 2 - .03, .12, h - .05);
    for (let z = .12; z < h - .25; z += .4) { K.box('walnut', -w / 2, w / 2, -d / 2, d / 2 - .03, z, z + .02); K.box('lampGlow', -w / 2 + .02, w / 2 - .02, d / 2 - .045, d / 2 - .03, z + .36, z + .37);
      for (let i = 0; i < nc; i++) for (let r = 0; r < 2; r++) for (let k = 0; k < 9; k++) { const x = -w / 2 + i * cw + .07 + k * (cw - .14) / 8, zz = z + .065 + r * .095 + (k % 2) * .0;
        if (k % 9 === 8 && r) continue; const m = (i + k + r) % 4 === 0 ? 'wine' : 'bottleGreen';
        K.hcyl(m, x, -.02, zz, .037, .26, 'y', 10); K.hcyl(m, x, -.2, zz, .014, .1, 'y', 8); K.hcyl('gold', x, -.26, zz, .015, .03, 'y', 8); } }
  },
  barShelf(K, w, d, h, o){
    // back panel at +y with backlit glass shelves and bottles
    K.box('walnut', -w / 2, w / 2, d / 2 - .03, d / 2, 0, h); K.box('mirror', -w / 2 + .05, w / 2 - .05, d / 2 - .035, d / 2 - .03, .05, h - .1);
    for (const s of [-1, 1]) K.box('walnut', s > 0 ? w / 2 - .04 : -w / 2, s > 0 ? w / 2 : -w / 2 + .04, -d / 2, d / 2 - .03, 0, h, .004);
    K.box('walnut', -w / 2, w / 2, -d / 2, d / 2 - .03, h - .06, h, .005);
    const r = rng(hash('bar' + w)); const cols = ['bottleGreen', 'glassClear', 'wine', 'gold', 'bottleGreen', 'glassClear', 'bread'];
    for (let z = .12; z < h - .35; z += .4) { K.box('glassClear', -w / 2 + .04, w / 2 - .04, -d / 2 + .01, d / 2 - .03, z, z + .012); K.box('lampGlow', -w / 2 + .04, w / 2 - .04, d / 2 - .06, d / 2 - .035, z + .012, z + .02);
      for (let x = -w / 2 + .1; x < w / 2 - .1; x += .085 + r() * .05) { const bh = .22 + r() * .1, br = .028 + r() * .012, m = cols[Math.floor(r() * cols.length)];
        K.lathe(m, x, 0, [[0, z + .012], [br, z + .012], [br, z + .012 + bh * .62], [br * .4, z + .012 + bh * .8], [br * .35, z + .012 + bh], [0, z + .012 + bh]], 10); } }
  },
  umbrella(K, w, d, h, o){
    K.lathe('black', 0, 0, [[0, 0], [.22, 0], [.22, .06], [.05, .08], [0, .08]], 16); K.cyl('walnut', 0, 0, .025, .025, .08, h - .05, 8);
    K.lathe('canvas', 0, 0, [[0, h], [.15, h - .05], [1.2, h - .42], [1.25, h - .5], [1.2, h - .5]], 8, 1, 1);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; K.rod('walnut', [0, 0, h - .1], [Math.cos(a) * 1.15, Math.sin(a) * 1.15, h - .47], .008, 4); }
  },
  car(K, w, d, h, o){
    // sedan / SUV built from side profiles extruded across the width; nose toward -y
    const p = o.m || 'carWhite', suv = !!o.suv, F = -d / 2, R = d / 2, belt = suv ? .98 : .84;
    const body = suv ? [[F + .05, .3], [R - .05, .3], [R, .5], [R - .02, belt], [R - .3, belt + .04], [F + 1.0, belt + .02], [F + .06, belt - .12], [F, .55]]
                     : [[F + .05, .28], [R - .05, .28], [R, .48], [R - .03, .76], [R - .85, belt + .02], [F + 1.05, belt], [F + .05, .7], [F, .5]];
    K.extX(p, body, -w / 2 + .02, w / 2 - .02, .03);
    const g0 = suv ? F + 1.15 : F + 1.25, g1 = suv ? R - .32 : R - .85;
    const glass = suv ? [[g0, belt], [g1, belt + .02], [g1 - .08, h - .07], [g0 + .7, h - .07]] : [[g0, belt], [g1, belt + .01], [g1 - .55, h - .07], [g0 + .8, h - .07]];
    K.extX('glassCar', glass, -w / 2 + .1, w / 2 - .1, .02);
    const roof = suv ? [[g0 + .72, h - .09], [g1 - .06, h - .09], [g1 - .1, h], [g0 + .76, h]] : [[g0 + .82, h - .09], [g1 - .53, h - .09], [g1 - .6, h], [g0 + .88, h]];
    K.extX(p, roof, -w / 2 + .14, w / 2 - .14, .015);
    for (const sx of [-1, 1]) K.box(p, sx > 0 ? w / 2 - .12 : -w / 2 + .1, sx > 0 ? w / 2 - .1 : -w / 2 + .12, (g0 + g1) / 2 - .04, (g0 + g1) / 2 + .04, belt, h - .08);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const y = sy * (d / 2 - (suv ? .82 : .78)); K.hcyl('tyre', sx * (w / 2 - .14), y, .34, .34, .24, 'x', 20); K.hcyl('chrome', sx * (w / 2 - .013), y, .34, .21, .012, 'x', 16); K.hcyl('black', sx * (w / 2 - .004), y, .34, .1, .008, 'x', 10); }
    for (const sx of [-1, 1]) { K.box('lampGlow', sx * (w / 2 - .3) - .2, sx * (w / 2 - .3) + .2, F + .02, F + .06, .6, .67, .02); K.box('red', sx * (w / 2 - .26) - .22, sx * (w / 2 - .26) + .22, R - .06, R - .02, .66, .74, .02); K.box('black', sx * (w / 2 - .01) - .03, sx * (w / 2 - .01) + .03, g0 + .05, g0 + .2, belt, belt + .09, .01); }
    K.box('black', -w / 2 + .35, w / 2 - .35, F, F + .05, .36, .5, .02); K.box('chrome', -.12, .12, R - .03, R, .5, .56);
  },
  tree(K, w, d, h, o){
    // broad tropical shade tree (rain tree) or smaller frangipani; canopy from jittered clusters
    const R = w / 2, r = rng(hash('tree' + (o.seed || 0) + w + h + (o.type || ''))), fr = o.type === 'frangi', th = h * (fr ? .45 : .4);
    const lx = (r() - .5) * R * .12, ly = (r() - .5) * R * .12, tr = fr ? Math.max(.08, R * .06) : Math.max(.14, R * .06);
    K.rod('trunk', [0, 0, 0], [lx, ly, th], tr, 9, tr * .7); K.cyl('trunk', 0, 0, tr * 1.5, tr, 0, .35, 9);
    const n = fr ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n + r() * .5, rr = R * (.28 + r() * .22), cx = lx + Math.cos(a) * rr, cy = ly + Math.sin(a) * rr, cz = th + (h - th) * (fr ? .45 + r() * .3 : .35 + r() * .3), s = R * (.3 + r() * .14);
      K.rod('trunk', [lx, ly, th * .92], [lx + Math.cos(a) * rr * .75, ly + Math.sin(a) * rr * .75, cz - s * .4], tr * .45, 6, tr * .25);
      K.blob(i % 3 === 0 ? 'leafDark' : i % 3 === 1 ? 'leaf' : 'leafLight', cx, cy, cz, s * 1.12, s * 1.12, s * (fr ? .7 : .55), r);
      if (fr) for (let k = 0; k < 6; k++) { const b = r() * TAU; K.ell(k % 2 ? 'linen' : 'blossom', cx + Math.cos(b) * s * .9, cy + Math.sin(b) * s * .9, cz + s * .3, .07, .07, .05, {ws: 6, hs: 4}); }
    }
    K.blob('leaf', lx, ly, h - R * .32, R * .5, R * .5, R * .3, r);
  },
  palm(K, w, d, h, o){
    const R = w / 2, r = rng(hash('palm' + (o.seed || 0) + w + h)), top = h - .5, bx = (r() - .5) * 1.4, by = (r() - .5) * 1.4;
    const pt = t => [bx * t * t, by * t * t, top * t];
    for (let i = 0; i < 7; i++) { const a = pt(i / 7), b = pt((i + 1) / 7); K.rod('trunk', a, b, .2 - i * .012, 9, .19 - (i + 1) * .012); K.torus('trunk', b[0], b[1], b[2] - .02, .19 - (i + 1) * .012, .025, {ts: 10, rs: 4}); }
    const C = pt(1); K.ell('leafDark', C[0], C[1], C[2], .3, .3, .35, {ws: 8, hs: 6});
    for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + .4; K.ell('bread', C[0] + Math.cos(a) * .22, C[1] + Math.sin(a) * .22, C[2] - .25, .1, .1, .12, {ws: 6, hs: 5}); }
    const nf = 13;
    for (let i = 0; i < nf; i++) {
      const a = i * TAU / nf + r() * .25, L = R * (.85 + r() * .15), dr = .45 + r() * .35, ca = Math.cos(a), sa = Math.sin(a), up = i % 3 === 0 ? .35 : 0;
      K.sheet(i % 2 ? 'leaf' : 'leafDark', (u, v) => { const vv = v * 2 - 1, s = u * L, wd = .55 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - u * .4);
        return [C[0] + ca * s - sa * vv * wd, C[1] + sa * s + ca * vv * wd, C[2] + Math.sin(u * Math.PI * .55) * L * (.22 + up) - u * u * L * dr * .55 - Math.abs(vv) * .1 * wd]; }, 10, 2);
    }
  },
  lampPost(K, w, d, h, o){
    K.lathe('bronze', 0, 0, [[0, 0], [.2, 0], [.2, .08], [.13, .14], [.1, .5], [.07, .6], [0, .6]], 12);
    K.cyl('bronze', 0, 0, .065, .05, .6, h - .55, 10);
    K.box('bronze', -.17, .17, -.17, .17, h - .58, h - .55); K.box('lampGlow', -.13, .13, -.13, .13, h - .55, h - .17);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.box('bronze', sx * .14 - .02, sx * .14 + .02, sy * .14 - .02, sy * .14 + .02, h - .55, h - .17);
    K.cyl('bronze', 0, 0, .21, .03, h - .17, h - .02, 4); K.ell('gold', 0, 0, h - .02, .03, .03, .03, {ws: 6, hs: 4});
  },
  bollard(K, w, d, h, o){ K.cyl('bronze', 0, 0, w / 2, w / 2 * .9, 0, h - .15, 14); K.cyl('lampGlow', 0, 0, w / 2 * .85, w / 2 * .85, h - .15, h - .05, 14); K.cyl('bronze', 0, 0, w / 2 * .95, w / 2, h - .05, h, 14); },
  parkBench(K, w, d, h, o){
    for (const s of [-1, 1]) { K.box('bronze', s * (w / 2 - .12) - .03, s * (w / 2 - .12) + .03, -d / 2 + .05, d / 2 - .05, 0, .42); K.box('bronze', s * (w / 2 - .12) - .03, s * (w / 2 - .12) + .03, d / 2 - .12, d / 2 - .05, .42, h); }
    for (let i = 0; i < 5; i++) K.box('deck', -w / 2, w / 2, -d / 2 + .04 + i * .085, -d / 2 + .11 + i * .085, .42, .46, .006);
    for (let i = 0; i < 3; i++) K.rbox('deck', 0, d / 2 - .1, .58 + i * .11, w, .03, .08, {rx: -.15});
  },
  fountain(K, w, d, h, o){
    const R = w / 2;
    K.lathe('marble', 0, 0, [[R - .5, .08], [R - .5, .52], [R - .55, .62], [R + .02, .62], [R, .5], [R, 0], [R - .5, 0]].reverse(), 72);
    K.cyl('water', 0, 0, R - .5, R - .5, .3, .46, 72);
    K.lathe('marble', 0, 0, [[0, .46], [1.1, .46], [.8, .7], [.5, 1.0], [.42, 1.3], [0, 1.3]], 32);
    K.lathe('marble', 0, 0, [[0, 1.25], [.5, 1.25], [2.4, 1.48], [2.65, 1.62], [2.58, 1.68], [2.35, 1.56], [0, 1.52]], 48); K.cyl('water', 0, 0, 2.36, 2.36, 1.5, 1.6, 48);
    K.cyl('waterJet', 0, 0, 2.82, 2.6, .46, 1.62, 48, true);
    K.lathe('marble', 0, 0, [[0, 1.6], [.32, 1.6], [.25, 2.0], [.22, 2.35], [0, 2.35]], 24);
    K.lathe('marble', 0, 0, [[0, 2.3], [.3, 2.3], [1.2, 2.48], [1.35, 2.6], [1.3, 2.65], [1.18, 2.55], [0, 2.52]], 40); K.cyl('water', 0, 0, 1.19, 1.19, 2.5, 2.58, 40);
    K.cyl('waterJet', 0, 0, 1.45, 1.33, 1.6, 2.62, 40, true);
    K.lathe('gold', 0, 0, [[0, 2.55], [.18, 2.55], [.1, 2.8], [.16, 2.95], [0, 3.05]], 16);
    K.lathe('waterJet', 0, 0, [[0, 3.0], [.14, 3.0], [.08, h - .5], [.18, h - .25], [0, h]], 16);
    const nj = 18; for (let i = 0; i < nj; i++) { const a = i * TAU / nj, r0 = R - .7, r1 = 3.1, pts = []; for (let k = 0; k <= 7; k++) { const t = k / 7, rr = r0 + (r1 - r0) * t; pts.push([Math.cos(a) * rr, Math.sin(a) * rr, .46 + Math.sin(Math.PI * t) * 1.5]); } for (let k = 0; k < 7; k++) K.rod('waterJet', pts[k], pts[k + 1], .035, 5); }
    for (let i = 0; i < 12; i++) { const a = (i + .5) * TAU / 12; K.cyl('lampGlow', Math.cos(a) * (R - .9), Math.sin(a) * (R - .9), .12, .12, .3, .33, 10); }
  },
  flagPole(K, w, d, h, o){
    K.cyl('steel', 0, 0, .09, .05, 0, h, 10); K.ell('gold', 0, 0, h + .04, .08, .08, .08, {ws: 8, hs: 6});
    K.sheet(o.cloth || 'red', (u, v) => [.06 + u * 1.9, Math.sin(u * 6) * .12 * u, h - .25 - v * 1.25], 14, 2);
  },
  gazebo(K, w, d, h, o){
    const R = w / 2;
    K.lathe('marble', 0, 0, [[0, 0], [R, 0], [R, .45], [0, .45]], 8); K.lathe('marble', 0, 0, [[R, 0], [R + .4, 0], [R + .4, .15], [R, .15]], 8);
    for (let i = 0; i < 8; i++) { const a = (i + .5) * TAU / 8; K.cyl('whitePaint', Math.cos(a) * (R - .45), Math.sin(a) * (R - .45), .14, .12, .45, h * .58, 12); }
    K.lathe('whitePaint', 0, 0, [[0, h * .58], [R, h * .58], [R + .1, h * .6], [R + .1, h * .64], [0, h * .64]], 8);
    K.lathe('whitePaint', 0, 0, [[R + .2, h * .64], [R * .7, h * .78], [R * .3, h * .9], [.1, h - .3], [0, h - .3]], 8); K.cyl('gold', 0, 0, .05, .02, h - .3, h, 8);
    K.cyl('lampGlow', 0, 0, .3, .3, h * .56, h * .58, 12);
  },
  cabana(K, w, d, h, o){
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.box('walnut', sx * (w / 2 - .08) - .06, sx * (w / 2 - .08) + .06, sy * (d / 2 - .08) - .06, sy * (d / 2 - .08) + .06, 0, h - .15);
    K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, h - .2, h - .1, .02); K.rbox('linen', 0, 0, h - .05, w, d, .1, {r: .04});
    K.sheet('sheer', (u, v) => [-w / 2 + u * w, d / 2 - .1 + Math.sin(u * 30) * .04, .05 + v * (h - .3)], 40, 2);
    for (const sx of [-1, 1]) K.sheet('sheer', (u, v) => [sx * (w / 2 - .1) + Math.sin(u * 20) * .04, -d / 2 + u * d * .35, .05 + v * (h - .3)], 14, 2);
    K.at(0, .1, 0, 0, () => PROPS.daybed(K, w - .5, d - .6, .75, {}));
  },
  hotTub(K, w, d, h, o){
    const R = w / 2;
    K.lathe('marble', 0, 0, [[R - .18, .05], [R - .18, h], [R, h], [R, 0], [R - .18, 0]].reverse(), 40);
    K.lathe('poolTile', 0, 0, [[0, .05], [R - .18, .05], [R - .18, h - .02]], 40); K.lathe('poolTile', 0, 0, [[R - .5, .05], [R - .5, .45], [R - .18, .45]], 40);
    K.cyl('water', 0, 0, R - .19, R - .19, .05, h - .1, 40);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; K.cyl('lampGlow', Math.cos(a) * (R - .2), Math.sin(a) * (R - .2), .04, .04, .3, .34, 8); }
  },
  billiard(K, w, d, h, o){
    // long axis along local x; felt bed, cushions, pockets, balls, cues
    for (const sx of [-1, 0, 1]) for (const sy of [-1, 1]) K.lathe('walnut', sx * (w / 2 - .2), sy * (d / 2 - .2), [[0, 0], [.09, 0], [.07, .1], [.1, .35], [.08, h - .2], [0, h - .2]], 12);
    K.box('walnut', -w / 2, w / 2, -d / 2, d / 2, h - .22, h - .06, .03); K.box('throw', -w / 2 + .14, w / 2 - .14, -d / 2 + .14, d / 2 - .14, h - .06, h - .04);
    for (const s of [-1, 1]) { K.box('walnut', -w / 2, w / 2, s > 0 ? d / 2 - .14 : -d / 2, s > 0 ? d / 2 : -d / 2 + .14, h - .06, h, .02); K.box('walnut', s > 0 ? w / 2 - .14 : -w / 2, s > 0 ? w / 2 : -w / 2 + .14, -d / 2 + .14, d / 2 - .14, h - .06, h, .02); }
    for (const x of [-w / 2 + .12, 0, w / 2 - .12]) for (const y of [-d / 2 + .12, d / 2 - .12]) K.cyl('black', x, y, .06, .06, h - .055, h + .002, 10);
    const cols = ['linen', 'red', 'gold', 'velvetNavy', 'black', 'red', 'throw', 'leather']; for (let i = 0; i < 9; i++) K.ell(cols[i % cols.length], w * .18 + (i % 3) * .06, -.06 + Math.floor(i / 3) * .06 - .06, h - .01, .028, .028, .028, {ws: 8, hs: 6});
    K.ell('linen', -w * .25, 0, h - .01, .028, .028, .028, {ws: 8, hs: 6}); K.rod('walnut', [-w * .45, -.1, h + .01], [w * .05, .15, h + .02], .012, 6);
  },
  pingpong(K, w, d, h, o){
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.box('steel', sx * (w / 2 - .35) - .03, sx * (w / 2 - .35) + .03, sy * (d / 2 - .2) - .03, sy * (d / 2 - .2) + .03, 0, h - .04);
    K.box('courtBlue', -w / 2, w / 2, -d / 2, d / 2, h - .04, h - .01); for (const y of [-d / 2 + .02, d / 2 - .02]) K.box('lineWhite', -w / 2, w / 2, y - .01, y + .01, h - .01, h - .005);
    for (const x of [-w / 2 + .02, w / 2 - .02]) K.box('lineWhite', x - .01, x + .01, -d / 2, d / 2, h - .01, h - .005); K.box('lineWhite', -w / 2, w / 2, -.004, .004, h - .01, h - .005);
    K.box('fenceMeshT', -.008, .008, -d / 2 - .0, d / 2, h - .01, h + .14); K.box('black', -.02, .02, -d / 2, d / 2, h + .13, h + .15);
    for (const s of [-1, 1]) K.ell('linen', s * w * .3, s * .2, h + .02, .02, .02, .02, {ws: 8, hs: 6});
  },
  foosball(K, w, d, h, o){
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.box('walnut', sx * (w / 2 - .12) - .04, sx * (w / 2 - .12) + .04, sy * (d / 2 - .1) - .04, sy * (d / 2 - .1) + .04, 0, h - .2);
    K.box('walnut', -w / 2 + .05, w / 2 - .05, -d / 2 + .1, d / 2 - .1, h - .3, h - .02, .02); K.box('throw', -w / 2 + .1, w / 2 - .1, -d / 2 + .14, d / 2 - .14, h - .1, h - .09);
    for (let i = 0; i < 8; i++) { const x = -w / 2 + .2 + i * (w - .4) / 7; K.hcyl('chrome', x, 0, h - .06, .008, d, 'y', 6); for (let k = -1; k <= 1; k++) K.box(i % 2 ? 'red' : 'velvetNavy', x - .015, x + .015, k * .12 - .015, k * .12 + .015, h - .1, h - .03); }
  },
  beanbag(K, w, d, h, o){ const r = w / 2; K.lathe(o.fab || 'velvetNavy', 0, 0, [[0, 0], [r * .8, 0], [r, h * .3], [r * .85, h * .75], [r * .4, h], [0, h * .95]], 20); },
  bike(K, w, d, h, o){
    // spin bike, rider faces -y: flywheel at the front, saddle at the back
    K.box('black', -w / 2 + .05, w / 2 - .05, -d / 2, -d / 2 + .12, 0, .06, .02); K.box('black', -w / 2 + .05, w / 2 - .05, d / 2 - .12, d / 2, 0, .06, .02);
    K.rod('black', [0, -d / 2 + .06, .06], [0, -d / 2 + .3, .55], .035, 8); K.rod('black', [0, d / 2 - .06, .06], [0, d / 2 - .35, .72], .035, 8); K.rod('black', [0, -d / 2 + .3, .55], [0, d / 2 - .35, .72], .03, 8);
    K.hcyl('chrome', 0, -d / 2 + .3, .5, .24, .05, 'x', 28); K.hcyl('black', 0, -d / 2 + .3, .5, .2, .06, 'x', 20);
    K.rod('black', [0, d / 2 - .35, .72], [0, d / 2 - .3, h - .3], .022, 8); K.rbox('leather', 0, d / 2 - .3, h - .27, .2, .3, .07, {r: .03});
    K.rod('black', [0, -d / 2 + .3, .55], [0, -d / 2 + .22, h - .12], .024, 8); K.hcyl('chrome', 0, -d / 2 + .2, h - .1, .018, w - .1, 'x', 8);
    K.rbox('screen', 0, -d / 2 + .16, h - .02, .22, .03, .14, {rx: -.6});
    for (const s of [-1, 1]) K.box('black', s * .14 - .05, s * .14 + .05, -d / 2 + .25, -d / 2 + .37, .38, .41);
  },
  elliptical(K, w, d, h, o){
    K.box('black', -.1, .1, -d / 2 + .2, d / 2 - .1, 0, .1, .02); K.cyl('black', 0, d / 2 - .25, .25, .25, .05, .55, 20); K.box('black', -w / 2 + .05, w / 2 - .05, d / 2 - .2, d / 2, 0, .06, .02);
    for (const s of [-1, 1]) { K.box('rubber', s * .16 - .07, s * .16 + .07, -.2 + s * .1, .25 + s * .1, .22 + (s > 0 ? .08 : 0), .26 + (s > 0 ? .08 : 0), .01); K.rod('steel', [s * .16, .2, .26], [s * .16, d / 2 - .3, .4], .02, 6); K.rod('steel', [s * .2, -d / 2 + .25, .45], [s * .26, -d / 2 + .1, h - .1], .02, 6); }
    K.rod('black', [0, -d / 2 + .25, .05], [0, -d / 2 + .25, 1.3], .04, 8); K.rbox('black', 0, -d / 2 + .2, 1.35, .38, .1, .24, {r: .03, rx: -.4}); K.rbox('screen', 0, -d / 2 + .15, 1.36, .3, .01, .17, {rx: -.4});
  },
  cableStation(K, w, d, h, o){
    for (const s of [-1, 1]) { const x = s * (w / 2 - .25);
      K.box('steel', x - .25, x + .25, -d / 2 + .1, d / 2 - .1, 0, .06); for (const dx of [-.22, .22]) K.box('steel', x + dx - .04, x + dx + .04, -.05, .05, 0, h);
      for (let i = 0; i < 14; i++) K.box(i % 2 ? 'black' : 'rubber', x - .16, x + .16, -.08, .08, .08 + i * .055, .13 + i * .055);
      K.hcyl('chrome', x, 0, .08 + 14 * .055 + .1, .012, .2, 'x', 6); K.hcyl('black', x, -.1, h - .15, .06, .05, 'x', 14); K.rod('black', [x, -.1, h - .2], [x, -d / 2 + .05, 1.2], .006, 4); K.box('chrome', x - .12, x + .12, -d / 2 + .02, -d / 2 + .06, 1.18, 1.2); }
    K.box('steel', -w / 2 + .2, w / 2 - .2, -.06, .06, h - .1, h);
    K.box('steel', -.35, .35, -.08, .08, 2.0, 2.06); K.hcyl('chrome', 0, -.15, 2.0, .015, 1.2, 'x', 8);
  },
  yogaMat(K, w, d, h, o){
    K.box(o.m || 'velvetGreen', -w / 2, w / 2, -d / 2, d / 2 - .25, 0, .006, .002);
    K.rbox('walnut', -w / 2 + .15, d / 2 - .12, .05, .22, .14, .1, {r: .02}); K.hcyl('linen', w / 2 - .2, d / 2 - .12, .07, .07, .3, 'x', 14);
  },
  saunaHeater(K, w, d, h, o){
    K.box('steel', -w / 2 + .06, w / 2 - .06, -d / 2 + .06, d / 2 - .06, 0, h - .2, .02);
    const r = rng(hash('stones')); for (let i = 0; i < 26; i++) K.ell(i % 3 ? 'marbleDark' : 'black', (r() - .5) * (w - .2), (r() - .5) * (d - .2), h - .18 + r() * .1, .06, .05, .04, {ws: 6, hs: 4});
    for (const s of [-1, 1]) K.box('woodSauna', -w / 2, w / 2, s > 0 ? d / 2 - .04 : -d / 2, s > 0 ? d / 2 : -d / 2 + .04, .1, h - .1); K.box('lampGlow', -w / 2 + .1, w / 2 - .1, -d / 2 + .05, -d / 2 + .06, .2, .3);
  },
  towelShelf(K, w, d, h, o){
    K.box('walnut', -w / 2, w / 2, d / 2 - .03, d / 2, 0, h); for (const s of [-1, 1]) K.box('walnut', s > 0 ? w / 2 - .03 : -w / 2, s > 0 ? w / 2 : -w / 2 + .03, -d / 2, d / 2, 0, h);
    for (let z = .1; z < h - .1; z += .38) { K.box('walnut', -w / 2 + .03, w / 2 - .03, -d / 2, d / 2 - .03, z, z + .025); for (let x = -w / 2 + .14; x < w / 2 - .1; x += .17) for (let k = 0; k < 2; k++) K.hcyl(o.roll || 'towel', x, -.015, z + .1 + k * .15, .075, d - .12, 'y', 12); }
  },
  kitchenRange(K, w, d, h, o){
    // front toward -y: oven doors + knobs; burners on top, a few pans
    K.box('steel', -w / 2, w / 2, -d / 2 + .02, d / 2, 0, h - .04, .01); K.box('black', -w / 2, w / 2, -d / 2, d / 2, h - .04, h);
    const n = Math.max(2, Math.round(w / .4)); for (let i = 0; i < n; i++) for (const y of [-d / 4, d / 4]) { const x = -w / 2 + (i + .5) * w / n; K.torus('black', x, y, h + .01, .1, .012, {ts: 16, rs: 5}); K.cyl('steel', x, y, .035, .035, h, h + .015, 10); }
    const r = rng(hash('rg' + w)); for (let i = 0; i < n; i++) if (r() < .5) { const x = -w / 2 + (i + .5) * w / n, y = (r() < .5 ? -1 : 1) * d / 4; K.lathe('chrome', x, y, [[0, h + .02], [.13, h + .02], [.14, h + .14], [.13, h + .14], [.12, h + .03], [0, h + .03]], 16); { const sd = x > 0 ? -1 : 1; K.rod('black', [x + sd * .13, y, h + .1], [x + sd * .33, y, h + .11], .012, 6); } }
    for (let i = 0; i < Math.max(1, Math.floor(w / .8)); i++) { const x0 = -w / 2 + .05 + i * (w - .1) / Math.max(1, Math.floor(w / .8)), x1 = x0 + (w - .1) / Math.max(1, Math.floor(w / .8)) - .05; K.box('black', x0, x1, -d / 2, -d / 2 + .02, .12, .6, .01); K.box('chrome', x0 + .05, x1 - .05, -d / 2 - .0, -d / 2 + .005, .63, .65); }
    for (let i = 0; i < n * 2; i++) K.cyl('chrome', -w / 2 + .1 + i * (w - .2) / (n * 2 - 1), -d / 2 + .01, .02, .02, .72, .75, 8);
  },
  prepTable(K, w, d, h, o){
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.box('steel', sx * (w / 2 - .05) - .02, sx * (w / 2 - .05) + .02, sy * (d / 2 - .05) - .02, sy * (d / 2 - .05) + .02, 0, h - .04);
    K.box('steel', -w / 2, w / 2, -d / 2, d / 2, h - .04, h, .005); K.box('steel', -w / 2 + .05, w / 2 - .05, -d / 2 + .05, d / 2 - .05, .18, .21);
    K.box('walnut', -.3, .2, -.2, .12, h, h + .03, .01); const r = rng(hash('pt' + w));
    for (let i = 0; i < 7; i++) K.ell(['leaf', 'red', 'bread', 'leafDark', 'red', 'linen', 'bread'][i], .35 + (i % 3) * .12, -.15 + Math.floor(i / 3) * .12, h + .05, .05, .05, .04, {ws: 7, hs: 5});
    K.box('chrome', -.25, .05, -.25, -.23, h + .03, h + .035); K.cyl('steel', -w / 2 + .3, .1, .14, .16, h, h + .12, 14);
  },
  sinkUnit(K, w, d, h, o){
    K.box('steel', -w / 2, w / 2, -d / 2, d / 2, 0, h - .03, .01); K.box('steel', -w / 2, w / 2, -d / 2, d / 2, h - .03, h); K.box('steel', -w / 2, w / 2, d / 2 - .05, d / 2, h, h + .25);
    for (const x of [-w / 4, w / 4]) { K.box('black', x - w / 4 + .06, x + w / 4 - .06, -d / 2 + .08, d / 2 - .12, h - .01, h + .001); K.cyl('chrome', x, d / 2 - .1, .015, .015, h, h + .45, 8); K.torus('chrome', x, d / 2 - .2, h + .45, .1, .012, {axis: 'x', arc: Math.PI, ts: 10, rs: 5}); }
  },
  wireShelf(K, w, d, h, o){
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) K.cyl('chrome', sx * (w / 2 - .02), sy * (d / 2 - .02), .015, .015, 0, h, 6);
    const r = rng(hash('ws' + w + (o.seed || 0)));
    for (let z = .15; z < h; z += .45) { K.box('chrome', -w / 2, w / 2, -d / 2, d / 2, z, z + .015); for (let x = -w / 2 + .12; x < w / 2 - .1; x += .22 + r() * .1) { const m = ['ceramic', 'linen', 'bread', 'steel', 'red', 'leaf'][Math.floor(r() * 6)], bh = .12 + r() * .2; K.box(m, x - .09, x + .09, -d / 2 + .05, d / 2 - .05, z + .015, z + .015 + bh, .01); } }
  },
  combiOven(K, w, d, h, o){
    K.box('steel', -w / 2, w / 2, -d / 2 + .02, d / 2, 0, .4, .01);
    for (const z0 of [.4, .4 + (h - .4) / 2]) { const z1 = z0 + (h - .4) / 2 - .02; K.box('steel', -w / 2, w / 2, -d / 2 + .02, d / 2, z0, z1, .01); K.box('black', -w / 2 + .05, w / 2 - .3, -d / 2, -d / 2 + .02, z0 + .05, z1 - .05, .01); K.box('screen', w / 2 - .25, w / 2 - .05, -d / 2, -d / 2 + .02, z1 - .3, z1 - .08); K.box('chrome', -w / 2 + .08, -w / 2 + .1, -d / 2 - .0, -d / 2 + .005, z0 + .1, z1 - .1); }
  },
  mixer(K, w, d, h, o){
    K.box('steel', -w / 2, w / 2, -d / 2, d / 2, 0, .75, .01);
    K.box('ceramic', -.12, .12, -.05, .15, .75, .82, .02); K.box('ceramic', -.06, .06, .05, .15, .82, h - .1); K.rbox('ceramic', 0, -.02, h - .07, .14, .3, .12, {r: .04});
    K.lathe('chrome', 0, -.08, [[0, .82], [.05, .82], [.13, .88], [.15, 1.05], [.14, 1.06], [0, .9]], 18);
  },
  saladBowl(K, w, d, h, o){
    const R = w / 2, r = rng(hash('sb' + (o.seed || 0)));
    K.lathe('ceramic', 0, 0, [[0, 0], [R * .5, 0], [R * .9, h * .6], [R, h], [R * .94, h], [R * .84, h * .62], [0, .03]], 24);
    const cols = [o.food || 'leaf', 'leafDark', 'red', 'bread']; for (let i = 0; i < 14; i++) { const a = r() * TAU, q = R * .7 * Math.sqrt(r()); K.ell(cols[i % 4], Math.cos(a) * q, Math.sin(a) * q, h * .7, .045, .04, .025, {ws: 6, hs: 4}); }
    K.rod('steel', [R * .2, 0, h * .7], [R * .82, .03, h + .1], .008, 5);
  },
  plateStack(K, w, d, h, o){ const r = w / 2; for (let z = 0; z < h - .01; z += .022) K.cyl('ceramic', 0, 0, r * .85, r, z, z + .018, 24); },
  juiceDispenser(K, w, d, h, o){
    K.box('chrome', -w / 2, w / 2, -d / 2, d / 2, 0, .06, .01); const n = 3;
    for (let i = 0; i < n; i++) { const x = -w / 2 + (i + .5) * w / n; K.cyl('glassClear', x, 0, .09, .09, .06, h - .04, 16, true); K.cyl(['bread', 'red', 'leaf'][i], x, 0, .085, .085, .07, h * .7, 16); K.cyl('chrome', x, 0, .095, .095, h - .04, h, 16); K.box('chrome', x - .02, x + .02, -d / 2, -d / 2 + .06, .1, .16); }
  },
  hostStand(K, w, d, h, o){
    K.box('walnut', -w / 2, w / 2, -d / 2 + .05, d / 2, 0, h - .05, .02); K.box('marbleBlack', -w / 2 - .0, w / 2, -d / 2, d / 2, h - .05, h, .01);
    K.box('gold', -w / 2 + .05, w / 2 - .05, -d / 2 + .04, -d / 2 + .05, .15, h - .1); K.rbox('screen', 0, .05, h + .01, .3, .22, .01, {rx: -.2}); K.cyl('gold', w / 2 - .12, .1, .05, .05, h, h + .25, 8); K.cyl('lampShade', w / 2 - .12, .1, .09, .07, h + .25, h + .38, 14, true);
  },
  iceDisplay(K, w, d, h, o){
    K.box('marble', -w / 2, w / 2, -d / 2, d / 2, 0, .05, .01); K.box('linen', -w / 2 + .05, w / 2 - .05, -d / 2 + .05, d / 2 - .05, .05, .12, .04);
    const r = rng(7); for (let i = 0; i < 40; i++) { const x = (r() - .5) * (w - .2), y = (r() - .5) * (d - .2), k = i % 4; K.ell(['red', 'black', 'bread', 'gold'][k], x, y, .14, k === 1 ? .04 : .05, .025, .02, {ws: 6, hs: 4, az: r() * 3}); }
  },
  cushionedBench(K, w, d, h, o){ K.box(o.fab || 'leather', -w / 2, w / 2, -d / 2, d / 2, h - .1, h, .03, 2); K.box('walnut', -w / 2 + .03, w / 2 - .03, -d / 2 + .03, d / 2 - .03, h - .14, h - .1); for (const sx of [-1, 1]) for (const sy of [-1, 1]) taperLeg(K, 'gold', sx * (w / 2 - .06), sy * (d / 2 - .06), 0, h - .14, .02); },
};
function placeCup(K, x, y, z){ K.cyl('ceramic', x, y, .05, .05, z, z + .006, 14); K.lathe('ceramic', x, y, [[0, z + .006], [.03, z + .006], [.04, z + .03], [.042, z + .07], [.038, z + .07], [.034, z + .03], [0, z + .012]], 14); }

const CACHE = new Map();
export function buildProp(it){
  const o = it.o || {}, key = `${it.kind}|${it.m}|${it.w.toFixed(3)}|${it.d.toFixed(3)}|${(it.z1 - it.z0).toFixed(3)}|${JSON.stringify(o)}`;
  if (CACHE.has(key)) return {key, parts: CACHE.get(key)};
  const K = new Kit(), f = PROPS[it.kind];
  if (!f) throw new Error('unknown prop ' + it.kind);
  f(K, it.w, it.d, it.z1 - it.z0, {...o, fab: o.fab || it.m, m: o.m || it.m});
  const parts = {}; for (const [m, gs] of Object.entries(K.parts)) parts[m] = mergeGeometries(gs, false);
  CACHE.set(key, parts); return {key, parts};
}
