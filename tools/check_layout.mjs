// Validates the procedural tower layout: collisions, objects outside the glass, objects outside their room, blocked passages.
// Furniture props are tested with their real oriented footprint (rotated rectangle or circle), boxes as rectangles, cylinders as circles.
// Run: node tools/check_layout.mjs
import {floorLayout, insideTower} from '../js/layout.js';
import {readFileSync} from 'node:fs';
const PROPS = Object.fromEntries([...readFileSync(new URL('../js/props.js', import.meta.url), 'utf8').matchAll(/^  (\w+)\(K, /gm)].map(m => [m[1], 1]));

const EPS = .004, CEIL_TOP = 2.55;
const levels = ['G', 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
let total = 0;
// 2-D shape: {circle: [x, y, r]} or {poly: [[x, y] x4]}
function shape(it){
  if (it.t === 'c') return {circle: [it.x, it.y, it.r]};
  if (it.t === 'p' && it.round) return {circle: [it.cx, it.cy, it.w / 2]};
  if (it.t === 'p') { const c = Math.cos(it.ang), s = Math.sin(it.ang), hw = it.w / 2, hd = it.d / 2;
    return {poly: [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => [it.cx + x * c - y * s, it.cy + x * s + y * c])}; }
  return {poly: [[it.x0, it.y0], [it.x1, it.y0], [it.x1, it.y1], [it.x0, it.y1]]};
}
const axes = P => P.map((p, i) => { const q = P[(i + 1) % P.length], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [-dy / l, dx / l]; });
const proj = (P, a) => { let lo = Infinity, hi = -Infinity; for (const p of P) { const v = p[0] * a[0] + p[1] * a[1]; lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };
function polyPoly(A, B){ for (const a of [...axes(A), ...axes(B)]) { const [a0, a1] = proj(A, a), [b0, b1] = proj(B, a); if (Math.min(a1, b1) - Math.max(a0, b0) <= EPS) return false; } return true; }
function circPoly([x, y, r], P){
  let best = Infinity, cp = null;
  for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], dx = q[0] - p[0], dy = q[1] - p[1], t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy))), cx = p[0] + t * dx, cy = p[1] + t * dy, d = Math.hypot(x - cx, y - cy); if (d < best) { best = d; cp = [cx, cy]; } }
  const inside = axes(P).every((a, i) => (x - P[i][0]) * a[0] + (y - P[i][1]) * a[1] >= 0) || axes(P).every((a, i) => (x - P[i][0]) * a[0] + (y - P[i][1]) * a[1] <= 0);
  return inside || best < r - EPS;
}
function overlap2(A, B){
  if (A.circle && B.circle) return Math.hypot(A.circle[0] - B.circle[0], A.circle[1] - B.circle[1]) < A.circle[2] + B.circle[2] - EPS;
  if (A.circle) return circPoly(A.circle, B.poly); if (B.circle) return circPoly(B.circle, A.poly);
  return polyPoly(A.poly, B.poly);
}
const zov = (a, b) => Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0) > EPS;
const bb = it => it.t === 'c' ? {x0: it.x - it.r, x1: it.x + it.r, y0: it.y - it.r, y1: it.y + it.r} : it;
const aabbHit = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > EPS && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > EPS;
const name = it => `${it.kind || it.m}${it.tag ? '[' + it.tag.split(' /')[0] + ']' : ''}@${it.room} (${[bb(it).x0, bb(it).x1, bb(it).y0, bb(it).y1].map(v => (+v).toFixed(2)).join(',')} z${it.z0.toFixed(2)}-${it.z1.toFixed(2)})`;
const corners = s => s.circle ? [[s.circle[0] - s.circle[2], s.circle[1] - s.circle[2]], [s.circle[0] + s.circle[2], s.circle[1] + s.circle[2]], [s.circle[0] - s.circle[2], s.circle[1] + s.circle[2]], [s.circle[0] + s.circle[2], s.circle[1] - s.circle[2]]] : s.poly;
const seen = new Set(), kinds = new Set();
for (const lv of levels) {
  const L = floorLayout(lv), errs = [];
  for (const i of L.items) if (i.t === 'p') { kinds.add(i.kind); if (!PROPS[i.kind]) errs.push(`UNKNOWN-PROP ${i.kind}`); if (!(i.w > 0 && i.d > 0 && i.z1 > i.z0)) errs.push(`BAD-SIZE ${name(i)}`); }
  const solids = L.items.filter(i => i.s).map(i => ({i, b: bb(i), sh: shape(i)}));
  for (let a = 0; a < solids.length; a++) for (let b = a + 1; b < solids.length; b++) {
    const A = solids[a], B = solids[b];
    const WALLS = /^(wall|concrete|woodSauna|marble|glassShower|cladding)$/;
    if (A.i.t === 'b' && B.i.t === 'b' && WALLS.test(A.i.m) && WALLS.test(B.i.m) && A.i.z1 >= CEIL_TOP && B.i.z1 >= CEIL_TOP) continue;   // wall junctions overlap by design
    if (zov(A.i, B.i) && aabbHit(A.b, B.b) && overlap2(A.sh, B.sh)) errs.push(`COLLIDE  ${name(A.i)}  x  ${name(B.i)}`);
  }
  const inside = L.podium ? (([x, y]) => Math.abs(x) <= 24.3 && Math.abs(y) <= 13.8) : (([x, y]) => insideTower(x, y, .05));
  for (const {i, sh} of solids) if (corners(sh).some(p => !inside(p))) errs.push(`OUTSIDE  ${name(i)}`);
  for (const r of L.rooms) for (const {i, sh} of solids.filter(s => s.i.room === r.id)) {
    if (corners(sh).some(([x, y]) => x < r.x0 - .01 || x > r.x1 + .01 || y < r.y0 - .01 || y > r.y1 + .01)) errs.push(`LEAVES-ROOM  ${name(i)}  room ${r.x0.toFixed(2)}..${r.x1.toFixed(2)}`);
  }
  for (const z of L.items.filter(i => i.t === 'clear')) { const zs = shape(z); for (const {i, b, sh} of solids) { if (i.door) continue; if (zov(z, i) && aabbHit(z, b) && overlap2(zs, sh)) errs.push(`BLOCKS-PASSAGE  ${name(i)}  in clear zone ${z.x0.toFixed(2)}..${z.x1.toFixed(2)},${z.y0.toFixed(2)}..${z.y1.toFixed(2)}`); } }
  const fresh = errs.map(e => e.replace(/@R\d+/g, '@R*')).filter(e => !seen.has(e));
  fresh.forEach(e => seen.add(e));
  const np = L.items.filter(i => i.t === 'p').length;
  console.log(`L${lv} ${L.type}: ${L.items.length} items (${np} props), ${L.rooms.length} rooms, ${errs.length} problems${fresh.length < errs.length ? ` (${errs.length - fresh.length} repeated)` : ''}`);
  fresh.slice(0, 60).forEach(e => console.log('   ' + e));
  total += errs.length;
}
console.log(`prop kinds used: ${[...kinds].sort().join(', ')}`);
console.log(total ? `\nFAIL: ${total} problems` : '\nPASS: no collisions, nothing outside the glass, nothing outside its room, passages clear');
process.exit(total ? 1 : 0);
