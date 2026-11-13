// Aurelia Tower - architectural layout data (pure JS, no THREE).
// Coordinates follow Blender: x = tower length (east +), y = depth (river side is y < 0), z = up, metres.
// z is measured from the top of the floor slab of the level being built.

export const FLOORZ = {18:58.25,17:54.85,16:51.45,15:48.05,14:44.65,13:41.25,12:37.85,11:34.45,10:31.05,9:27.65,8:24.25,7:20.85,6:17.45,5:14.05,4:10.65,3:7.25,2:3.85,G:.45};
export const FLOOR_H = 3.4, SLAB_T = .45, CEIL = 2.75;
// tower glazing (measured from the Blender model)
export const GX = 13.85, GY = 8.07, GCH = 1.4;          // glass half-length, half-depth, corner chamfer
export const SLAB = {x: 14.31, y: 8.53, ch: 1.8};       // slab edge (chamfered)
export const IX = 13.75, IY = 7.95;                     // interior finish line
export const COR = 1.1, CW = .2;                        // corridor half width, corridor wall thickness
export const V0 = COR + CW;                             // room depth starts here (|y|)
export const D = IY - V0;                               // room depth 6.65 m
export const BAY = 24.9 / 17;                           // curtain-wall mullion spacing
export const xb = k => -12.45 + k * BAY;                // mullion x for bay index k (0..17)
export const PW = .15;                                  // party wall thickness

// is point (x,y) inside the interior octagon (with a small inset)
export function insideTower(x, y, inset = .1){
  const ax = Math.abs(x), ay = Math.abs(y);
  return ax <= GX - inset + 1e-6 && ay <= GY - inset + 1e-6 && ax + ay * (GCH / (GY - 6.68)) <= 12.45 + GY * (GCH / (GY - 6.68)) - inset * 1.42 + 1e-6;
}

// ---------- stairs / core geometry (shared by every level so they line up vertically) ----------
export const STAIRS = [{x0: xb(3) + PW / 2, x1: xb(5) - PW / 2}, {x0: xb(12) + PW / 2, x1: xb(14) - PW / 2}];
export const STAIR = {land: 1.4, run: 2.8, risers: 10, rise: FLOOR_H / 20, tread: .28, well: .2};
export const CORE = {x0: xb(5) + PW / 2, x1: xb(12) - PW / 2, lobby: 1.9, shaftD: 2.45};
export const SHAFTS = (() => { const w = (CORE.x1 - CORE.x0 - .15 * 5) / 4, a = []; for (let i = 0; i < 4; i++) { const x0 = CORE.x0 + .15 + i * (w + .15); a.push({x0, x1: x0 + w, y0: V0 + CORE.lobby + .15, y1: V0 + CORE.lobby + .15 + CORE.shaftD, service: i === 0}); } return a; })();
// slab openings (stair wells + lift shafts), y > 0 side
export function slabHoles(){
  const h = [];
  for (const s of STAIRS) h.push({x0: s.x0, x1: s.x1, y0: V0 + STAIR.land, y1: V0 + STAIR.land + STAIR.run + STAIR.land});
  for (const s of SHAFTS) h.push({x0: s.x0, x1: s.x1, y0: s.y0, y1: s.y1});
  return h;
}

// ---------- room programme per level ----------
// river side (y<0) splits and back side (y>0) splits are bay indices; -1 / 18 mean the glass end of the tower
const RIVER = {deluxe: [[-1, 4, 'deluxeCorner'], [4, 7, 'deluxe'], [7, 10, 'deluxe'], [10, 13, 'deluxe'], [13, 18, 'deluxeCorner']],
               club:   [[-1, 4, 'clubCorner'], [4, 8, 'club'], [8, 13, 'clubPlus'], [13, 18, 'clubCorner']],
               suite:  [[-1, 6, 'execSuite'], [6, 11, 'juniorSuite'], [11, 18, 'execSuite']],
               sky:    [[-1, 18, 'presidential']],
               pool:   [[-1, 18, 'poolHall']],
               lounge: [[-1, 18, 'clubLounge']]};
const BACK = {deluxe: 'deluxeCorner', club: 'clubCorner', suite: 'clubCorner', sky: 'clubCorner', pool: ['changingM', 'changingF'], lounge: ['meeting', 'business']};
export const ROOM_NAMES = {deluxe: 'Deluxe King', deluxeCorner: 'Deluxe Corner King', club: 'Club Room', clubPlus: 'Club Premier', clubCorner: 'Club Corner',
  juniorSuite: 'Junior Suite', execSuite: 'Executive Suite', presidential: 'Presidential Sky Suite', poolHall: 'Indoor Pool & Wellness', clubLounge: 'Club Lounge',
  changingM: 'Changing Room (Men)', changingF: 'Changing Room (Women)', meeting: 'Boardroom (10 seats)', business: 'Business Centre'};
export const ROOM_TIER = {deluxe: 'Deluxe', deluxeCorner: 'Deluxe', club: 'Luxury', clubPlus: 'Luxury', clubCorner: 'Luxury', juniorSuite: 'Luxury Suite', execSuite: 'Luxury Suite', presidential: 'Ultra Luxury', poolHall: 'Amenity', clubLounge: 'Amenity', changingM: 'Amenity', changingF: 'Amenity', meeting: 'Amenity', business: 'Amenity'};
export function guestType(lv){ if (lv === 'G') return null; if (lv === 17) return 'sky'; if (lv === 15 || lv === 16) return 'suite'; if (lv === 9) return 'pool'; if (lv === 14) return 'lounge'; if (lv >= 10 && lv <= 13) return 'club'; if (lv >= 4 && lv <= 8) return 'deluxe'; return null; }

const bx = k => k < 0 ? -IX : k > 17 ? IX : xb(k);

// ---------- builder ----------
let _prop = null;                                        // current floor's prop emitter (floorLayout is synchronous)
// local frame helper shared by rooms and facility spaces: back = 'u+','u-','v+','v-' (or x/y) or a [bu, bv] vector
function makeP(X, Y, sx, sy, id, tags, tagZ = .25){
  const Pc = (kind, m, uc, vc, w, d, z0, z1, back, o = {}) => {
    let bu, bv; if (Array.isArray(back)) [bu, bv] = back; else { const ax = back[0] === 'u' || back[0] === 'x'; bu = ax ? (back[1] === '+' ? 1 : -1) : 0; bv = ax ? 0 : (back[1] === '+' ? 1 : -1); }
    const ang = Math.atan2(-bu * sx, bv * sy), it = _prop(kind, m, X(uc), Y(vc), w, d, z0, z1, ang, {...o, room: o.room ?? id});
    if (o.tag) tags.push([o.tag, it.cx, it.cy, z1 + tagZ]); return it;
  };
  const P = (kind, m, u0, u1, v0, v1, z0, z1, back, o = {}) => {
    const a0 = Math.min(u0, u1), a1 = Math.max(u0, u1), b0 = Math.min(v0, v1), b1 = Math.max(v0, v1);
    const alongV = Array.isArray(back) ? Math.abs(back[1]) >= Math.abs(back[0]) : (back[0] === 'v' || back[0] === 'y');
    return Pc(kind, m, (a0 + a1) / 2, (b0 + b1) / 2, o.w ?? (alongV ? a1 - a0 : b1 - b0), o.d ?? (alongV ? b1 - b0 : a1 - a0), z0, z1, back, o);
  };
  return {P, Pc};
}
export function floorLayout(lv){
  const type = guestType(lv), items = [], rooms = [], labels = [];
  const add = it => { items.push(it); return it; };
  _prop = (kind, m, cx, cy, w, d, z0, z1, ang, o = {}) => {
    const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang)), hx = o.round ? w / 2 : (w * c + d * s) / 2, hy = o.round ? w / 2 : (w * s + d * c) / 2;
    return add({t: 'p', kind, m, cx, cy, w, d, z0, z1, ang, o: o.o || {}, round: !!o.round, x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy, s: o.s ?? true, room: o.room ?? 'common', tag: o.tag});
  };
  const box = (m, x0, x1, y0, y1, z0, z1, o = {}) => add({t: o.clear ? 'clear' : 'b', door: o.door, m, x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0, z1, s: o.clear ? false : (o.s ?? true), room: o.room ?? 'common', tag: o.tag, soft: o.soft});
  const cyl = (m, x, y, r, z0, z1, o = {}) => add({t: 'c', m, x, y, r, z0, z1, s: o.s ?? true, room: o.room ?? 'common', tag: o.tag, seg: o.seg});
  if (!type) {                                   // podium / amenity levels: the vertical core still runs through
    const podium = lv === 'G' || lv === 2 || lv === 3;
    for (const x of [bx(3), bx(5), bx(12), bx(14)]) box('wall', x - PW / 2, x + PW / 2, V0, IY, 0, CEIL);
    if (podium) { box('wall', bx(3) - PW / 2, -1.3, IY, IY + .15, 0, CEIL); box('wall', -1.3, -.4, IY, IY + .15, 2.2, CEIL); box('wall', -.4, bx(14) + PW / 2, IY, IY + .15, 0, CEIL); box('clear', -1.3, -.4, IY - .7, IY + .9, .05, 1.9, {clear: true}); }
    else box('wall', bx(3) - PW / 2, bx(14) + PW / 2, IY, IY + .15, 0, CEIL, {s: false});
    corridorWall(box, 1, [...STAIRS.map(s => ({x0: s.x0 + .2, x1: s.x0 + 1.25, fire: true})), {x0: CORE.x0, x1: CORE.x1, lobby: true}], bx(3) - PW / 2, bx(14) + PW / 2);
    coreBlock(box, cyl, labels);
    for (const s of STAIRS) stairBlock(box, s, labels, lv);
    if (lv === 18) labels.forEach(l => { if (/^Housekeeping/.test(l[0])) l[0] = 'Lift Machine Room / ห้องเครื่องลิฟต์'; if (/^MEP/.test(l[0])) l[0] = 'Roof Plant / ห้องเครื่องดาดฟ้า'; });
    if (FAC[lv]) FAC[lv](box, cyl, rooms, labels);
    return {items, rooms, labels, type: FAC[lv] ? 'facility' : null, podium};
  }
  // ----- corridor (y in [-COR, COR]) with red carpet runner
  box('floorStone', -IX, IX, -COR, COR, 0, .015, {s: false});
  box('carpetRed', -IX + .9, IX - .9, -.8, .8, .015, .03, {s: false});
  box('gold', -IX + .9, IX - .9, .8, .86, .015, .032, {s: false}); box('gold', -IX + .9, IX - .9, -.86, -.8, .015, .032, {s: false});
  labels.push(['Corridor / ทางเดินพรมแดง', 0, -.3, 1.2]);
  // corridor-end windows: bench + plants
  for (const sx of [-1, 1]) { const x = sx * (IX - .45); box('walnut', x - .22, x + .22, -.45, .45, 0, .45); box('velvetGreen', x - .2, x + .2, -.43, .43, .45, .55, {soft: true}); for (const py of [-.78, .78]) _prop('plant', 'pot', x, py, .5, .5, 0, 1.2, 0, {round: true, o: {potR: .18}}); }
  // ----- corridor walls (river side y=-COR-CW..-COR and back side) with door openings filled later
  const doorsRiver = [], doorsBack = [];
  // ----- river rooms
  const rspec = RIVER[type];
  rspec.forEach(([k0, k1, rt], i) => {
    const x0 = bx(k0) + (k0 < 0 ? 0 : PW / 2), x1 = bx(k1) - (k1 > 17 ? 0 : PW / 2);
    const outer = k0 < 0 ? 'L' : k1 > 17 ? 'R' : null;
    const flip = outer === 'L' ? true : outer === 'R' ? false : (i % 2 === 1);
    const num = (typeof lv === 'number' ? lv : 0) * 100 + i + 1;
    rooms.push(buildRoom({lv, num, rt, x0, x1, side: -1, flip, outer}, box, cyl, doorsRiver));
  });
  // ----- back corner rooms
  const backRooms = [[-1, 3, 'L'], [14, 18, 'R']];
  backRooms.forEach(([k0, k1, outer], i) => {
    const x0 = bx(k0) + (k0 < 0 ? 0 : PW / 2), x1 = bx(k1) - (k1 > 17 ? 0 : PW / 2);
    const num = (typeof lv === 'number' ? lv : 0) * 100 + rspec.length + i + 1;
    const room = buildRoom({lv, num, rt: Array.isArray(BACK[type]) ? BACK[type][i] : BACK[type], x0, x1, side: 1, flip: outer === 'L', outer}, box, cyl, doorsBack);
    if (type === 'suite') { room.name = 'Executive Studio'; room.tier = 'Luxury'; } if (type === 'sky') { room.name = 'Sky Guest Room (connecting)'; room.tier = 'Ultra Luxury'; }
    rooms.push(room);
  });
  // ----- party walls
  const partyRiver = rspec.slice(1).map(r => bx(r[0]));
  for (const x of partyRiver) box('wall', x - PW / 2, x + PW / 2, -IY, -V0, 0, CEIL, {tag: null});
  for (const x of [bx(3), bx(5), bx(12), bx(14)]) box('wall', x - PW / 2, x + PW / 2, V0, IY, 0, CEIL);
  // ----- corridor walls with door openings
  corridorWall(box, -1, doorsRiver, -IX, IX);
  const backOpen = [...doorsBack, ...STAIRS.map(s => ({x0: s.x0 + .2, x1: s.x0 + 1.25, fire: true})), {x0: CORE.x0, x1: CORE.x1, lobby: true}];
  corridorWall(box, 1, backOpen, -IX, IX);
  // sconces along corridor walls between doors
  for (let x = -IX + 1.6; x < IX - 1.4; x += 2.2) for (const sy of [-1, 1]) {
    const open = (sy < 0 ? doorsRiver : backOpen).some(d => x > d.x0 - .35 && x < d.x1 + .35); if (open) continue;
    const y = sy * COR; box('gold', x - .07, x + .07, y - sy * .07, y, 1.55, 1.85, {s: false}); box('lampGlow', x - .05, x + .05, y - sy * .1, y - sy * .07, 1.58, 1.82, {s: false});
  }
  // ----- core: lift lobby, shafts, service rooms
  coreBlock(box, cyl, labels);
  // ----- stairs (up flights for this level; the flight from the level below shows through the slab opening)
  for (const s of STAIRS) stairBlock(box, s, labels, lv);
  return {items, rooms, labels, type};
}

function corridorWall(box, side, openings, xa, xb_){
  const y0 = side * COR, y1 = side * (COR + CW), ops = openings.slice().sort((a, b) => a.x0 - b.x0);
  let x = xa;
  for (const o of ops) { if (o.x0 > x + .01) box('wall', x, o.x0, y0, y1, 0, CEIL); if (!o.lobby) box('wall', o.x0, o.x1, y0, y1, 2.2, CEIL); x = Math.max(x, o.x1); }
  if (x < xb_ - .01) box('wall', x, xb_, y0, y1, 0, CEIL);
  for (const o of ops) {
    if (o.lobby) continue;
    // door frame + room plate on the corridor face
    box(o.fire ? 'steel' : 'gold', o.x0 - .05, o.x0, y0, y1, 0, 2.25, {s: false}); box(o.fire ? 'steel' : 'gold', o.x1, o.x1 + .05, y0, y1, 0, 2.25, {s: false});
    if (!o.fire) box('gold', o.x1 + .12, o.x1 + .32, y0 - side * .01, y0, 1.45, 1.6, {s: false});
  }
}

function coreBlock(box, cyl, labels){
  const {x0, x1, lobby} = CORE, yL = V0 + lobby;
  box('floorStone', x0, x1, COR, yL, 0, .015, {s: false}); box('carpetRed', x0 + .5, x1 - .5, COR + .1, yL - .2, .015, .03, {s: false});
  // lobby side walls + shaft front wall with lift doors
  box('marble', x0, x0 + .02, COR + CW, yL, 0, CEIL, {s: false}); box('marble', x1 - .02, x1, COR + CW, yL, 0, CEIL, {s: false});
  const yf = SHAFTS[0].y0 - .15, yBk = SHAFTS[0].y1;
  for (let i = 0; i <= SHAFTS.length; i++) { const gx0 = i === 0 ? CORE.x0 : SHAFTS[i - 1].x1, gx1 = i === SHAFTS.length ? CORE.x1 : SHAFTS[i].x0; box('concrete', gx0, gx1, yf, yBk, 0, CEIL); }
  { const sv = SHAFTS[0], dm = (sv.x0 + sv.x1) / 2; box('concrete', sv.x0, dm - .55, yBk, yBk + .15, 0, CEIL); box('concrete', dm - .55, dm + .55, yBk, yBk + .15, 2.2, CEIL); box('concrete', dm + .55, SHAFTS[3].x1, yBk, yBk + .15, 0, CEIL); box('steel', dm - .55, dm + .55, yBk + .15, yBk + .18, 0, 2.2, {s: false}); }
  for (const s of SHAFTS) {
    const dm = (s.x0 + s.x1) / 2;
    if (s.service) { box('marble', s.x0, s.x1, yf, s.y0, 0, CEIL); box('art', dm - .5, dm + .5, yf - .02, yf, 1.2, 2.0, {s: false}); continue; }
    box('marble', s.x0, dm - .55, yf, s.y0, 0, CEIL); box('marble', dm + .55, s.x1, yf, s.y0, 0, CEIL); box('marble', dm - .55, dm + .55, yf, s.y0, 2.2, CEIL);
    box('gold', dm - .55, dm + .55, yf - .03, yf, 0, 2.2, {s: false}); box('black', dm - .005, dm + .005, yf - .04, yf - .03, 0, 2.2, {s: false});
    box('lampGlow', dm - .25, dm + .25, yf - .04, yf - .03, 2.3, 2.4, {s: false});
  }
  for (const s of SHAFTS.slice(0, 3)) box('gold', (s.x1 + SHAFTS[SHAFTS.indexOf(s) + 1].x0) / 2 - .04, (s.x1 + SHAFTS[SHAFTS.indexOf(s) + 1].x0) / 2 + .04, SHAFTS[0].y0 - .2, SHAFTS[0].y0 - .15, 1.1, 1.3, {s: false});
  labels.push(['Service Lift / ลิฟต์บริการ', (SHAFTS[0].x0 + SHAFTS[0].x1) / 2, SHAFTS[0].y1 + .6, 2.4]);
  labels.push(['Guest Elevators / ลิฟต์ผู้เข้าพัก 3 ตัว', (x0 + x1) / 2, V0 + .9, 2.6]);
  // lobby console + plants on side walls
  for (const sx of [-1, 1]) { const x = sx < 0 ? x0 + .02 : x1 - .02, xi = x - sx * .45; box('walnut', Math.min(x, xi), Math.max(x, xi), COR + .55, COR + 1.55, 0, .8); box('marbleBlack', Math.min(x, xi) - .02, Math.max(x, xi) + .02, COR + .53, COR + 1.57, .8, .84); _prop('flowers', 'gold', (x + xi) / 2, COR + 1.05, .4, .4, .84, 1.5, 0, {round: true, o: {vase: 'gold'}}); box('art', x - sx * .02, x, COR + .5, COR + 1.6, 1.3, 2.2, {s: false}); }
  // service rooms behind the shafts
  const yb = SHAFTS[0].y1 + .15;
  box('wall', x0, x1, yb, yb + .12, 0, CEIL, {s: false}); box('wall', (x0 + x1) / 2 - .06, (x0 + x1) / 2 + .06, yb + .12, IY - 1.1, 0, CEIL); box('wall', (x0 + x1) / 2 - .06, (x0 + x1) / 2 + .06, IY - 1.1, IY, 2.2, CEIL);
  box('floorService', x0, x1, yb + .12, IY, 0, .015, {s: false});
  for (let i = 0; i < 3; i++) box('steel', x0 + .2 + i * 1.1, x0 + 1.1 + i * 1.1, IY - .6, IY - .05, 0, 1.9);   // linen racks
  { const dm = (SHAFTS[0].x0 + SHAFTS[0].x1) / 2; box('clear', dm - .55, dm + .55, yb + .14, yb + .9, .05, 1.9, {clear: true}); }
  box('linen', x0 + .3, x0 + 1.0, IY - .55, IY - .1, .9, 1.3, {s: false});
  box('steel', (x0 + x1) / 2 + .3, x1 - .3, IY - .7, IY - .1, 0, 2.2);                                        // MEP / AHU
  labels.push(['Housekeeping / ห้องแม่บ้าน', x0 + 2, IY - 1, 2.2], ['MEP / ห้องงานระบบ', x1 - 2, IY - 1, 2.2]);
}

function stairBlock(box, s, labels, lv){
  const {land, run, risers, rise, tread, well} = STAIR, w = (s.x1 - s.x0 - well) / 2;
  const yA = V0, yL = V0 + land, yM = yL + run, yE = yM + land;
  // enclosure walls (sides already party walls) + back wall at the facade line side
  box('concrete', s.x0, s.x1, yE, yE + .15, 0, CEIL);
  box('floorStone', s.x0, s.x1, yA, yL, 0, .02, {s: false});
  const fa = {x0: s.x0, x1: s.x0 + w}, fb = {x0: s.x1 - w, x1: s.x1};
  const top = lv === 18;
  for (let i = 0; i < risers; i++) {
    // flight A: up from this floor landing (yL) toward mid landing (z 0 -> 1.7)
    const za = (i + 1) * rise, ya0 = yL + i * tread;
    if (!top) box('stair', fa.x0, fa.x1, ya0, ya0 + tread, za - .05, za);
    if (!top) box('stairNose', fa.x0, fa.x1, ya0, ya0 + .04, za - .045, za + .003, {s: false});
    // flight B: from mid landing back to the upper floor (z 1.7 -> 3.4)
    const zb = FLOOR_H / 2 + (i + 1) * rise, yb0 = yM - (i + 1) * tread;
    if (!top) box('stair', fb.x0, fb.x1, yb0, yb0 + tread, zb - .05, zb);
    if (!top) box('stairNose', fb.x0, fb.x1, yb0 + tread - .04, yb0 + tread, zb - .045, zb + .003, {s: false});
    // flight B of the level below (arriving at this floor) seen through the opening
    const zc = -FLOOR_H / 2 + (i + 1) * rise;
    if (lv !== 'G') box('stair', fb.x0, fb.x1, yb0, yb0 + tread, zc - .05, zc);
  }
  // stringers (inclined, approximated by stepped soffit blocks)
  for (let i = 0; i < risers && !top; i++) { box('concrete', fa.x0, fa.x1, yL + i * tread, yL + (i + 1) * tread, (i + 1) * rise - .25, (i + 1) * rise - .05, {s: false}); }
  if (!top) box('stair', s.x0, s.x1, yM, yE, FLOOR_H / 2 - .15, FLOOR_H / 2);                 // mid landing
  if (lv !== 'G') box('stair', s.x0, s.x1, yM, yE, -FLOOR_H / 2 - .15, -FLOOR_H / 2);               // lower mid landing
  // handrails on the well side
  const xr = s.x0 + w + well / 2;
  box('gold', xr - .025, xr + .025, yL, yM, .9, .95, {s: false}); box('gold', xr - .02, xr + .02, yL, yM, 0, .9, {s: false});
  // fire door leaf (open against the landing side wall)
  box('steel', s.x0 + .02, s.x0 + .08, yA + .02, yA + 1.0, 0, 2.15);
  box('red', s.x0 + .1, s.x0 + .45, yA + .02, yA + .03, 2.3, 2.45, {s: false});
  const up = lv === 'G' ? 'L2' : lv === 18 ? '' : lv === 17 ? 'Rooftop' : 'L' + (lv + 1), dn = lv === 'G' ? '' : lv === 2 ? ' ▼G' : ' ▼L' + (lv - 1);
  labels.push([`Stairs / บันไดหนีไฟ ${up ? '▲' + up : ''}${dn}`, (s.x0 + s.x1) / 2, V0 + 1.0, 2.5]);
}

// ---------- room templates ----------
// Local frame: u across the room (0 = plumbing / party-wall side), v from the corridor wall (0) to the window (D).
function frame(r){
  const W = r.x1 - r.x0;
  const X = u => r.flip ? r.x1 - u : r.x0 + u, Y = v => r.side * (V0 + v);
  return {W, X, Y};
}
function buildRoom(r, box, cyl, doors){
  const {W, X, Y} = frame(r), id = 'R' + r.num, tags = [];
  const B = (m, u0, u1, v0, v1, z0, z1, o = {}) => { const it = box(m, X(u0), X(u1), Y(v0), Y(v1), z0, z1, {...o, room: id}); if (o.tag) tags.push([o.tag, (it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2, z1 + .25]); return it; };
  const C = (m, u, v, rad, z0, z1, o = {}) => { const it = cyl(m, X(u), Y(v), rad, z0, z1, {...o, room: id}); if (o.tag) tags.push([o.tag, it.x, it.y, z1 + .25]); return it; };
  const {P, Pc} = makeP(X, Y, r.flip ? -1 : 1, r.side, id, tags);
  const T = TEMPLATES[r.rt];
  const res = T({W, B, C, P, Pc, r, doors, X});
  const [eu, ev] = res?.eye ?? EYE[r.rt]?.(W) ?? [W / 2, D - 1.6];
  B('clear', eu - .2, eu + .2, ev - .2, ev + .2, 1.1, 1.9, {clear: true});
  const xs = [X(0), X(W)];
  return {id, num: r.num, rt: r.rt, name: ROOM_NAMES[r.rt], tier: ROOM_TIER[r.rt], side: r.side, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(Y(0), Y(D)), y1: Math.max(Y(0), Y(D)), tags, area: res?.area ?? +(W * D).toFixed(1), view: r.side < 0 ? 'River view' : 'City view', outer: r.outer, eye: [X(eu), Y(ev)], side: r.side};
}

// standing viewpoint (local u, v) used for the window view - kept clear by the checker
const EYE = {deluxe: W => [W - 1.25, D - 1.7], deluxeCorner: W => [3.05, D - 1.0], club: W => [W - 1.6, D - 1.9], clubPlus: W => [W - 1.6, D - 1.9], clubCorner: W => [3.3, D - 1.0],
  juniorSuite: W => [5.6, D - 1.6], execSuite: W => [6.4, D - 1.3], presidential: W => [6.2, D - .6], poolHall: W => [13.9, 2.2], clubLounge: W => [13.9, D - 1.0],
  changingM: W => [2.2, 3.0], changingF: W => [2.2, 3.0], meeting: W => [2.9, 1.5], business: W => [2.2, 2.0]};
// shared pieces
function floorFinish(B, W, bath){ B('woodFloor', 0, W, 0, D, 0, .012, {s: false}); if (bath) B('marbleFloor', bath.u0, bath.u1, bath.v0, bath.v1, .012, .02, {s: false}); }
function entryDoor(ctx, u0){ const {B, doors, X} = ctx; doors.push({x0: Math.min(X(u0), X(u0 + .95)), x1: Math.max(X(u0), X(u0 + .95))}); B('walnut', u0 - .1, u0 - .05, .02, .98, 0, 2.15, {door: true}); B('clear', u0, u0 + .95, .05, 1.2, .05, 1.9, {clear: true}); B('gold', u0 - .11, u0 - .1, .75, .85, 1.0, 1.08, {s: false}); }
function windowSide(ctx, u0, u1, endGlass){
  const {B, P, W} = ctx;
  P('curtain', 'sheer', u0, u1, D - .14, D - .11, .02, CEIL - .08, 'v+', {o: {lambda: .14}});
  P('curtain', 'drape', u0, Math.min(u0 + .45, u1), D - .22, D - .15, .02, CEIL - .08, 'v+', {o: {lambda: .17}}); P('curtain', 'drape', Math.max(u1 - .45, u0), u1, D - .22, D - .15, .02, CEIL - .08, 'v+', {o: {lambda: .17}});
  B('gold', u0, u1, D - .24, D - .1, CEIL - .08, CEIL - .05, {s: false});
  if (endGlass) { P('curtain', 'sheer', W - .14, W - .11, .3, D - 1.55, .02, CEIL - .08, 'u+', {o: {lambda: .14}}); P('curtain', 'drape', W - .22, W - .15, .3, .75, .02, CEIL - .08, 'u+', {o: {lambda: .17}}); B('gold', W - .24, W - .1, .3, D - 1.55, CEIL - .08, CEIL - .05, {s: false}); }
}
function acUnit(ctx, u0, v, facing){ ctx.P('ac', 'acWhite', u0, u0 + .95, v, v + facing * .24, 2.3, 2.6, facing > 0 ? 'v-' : 'v+', {tag: 'AC / แอร์'}); }
function bedKing(ctx, uHead, v0, len = 2.15, wid = 1.95){
  const {B, C} = ctx, v1 = v0 + wid;
  B('walnut', 0, .03, v0 - .9, v1 + .9, 0, 2.55, {s: false});                                   // wall panel behind bed (on the wall face)
  ctx.P('bed', ctx.bedFab || 'velvetCream', uHead + .03, uHead + .13 + len, v0 - .05, v1 + .05, 0, 1.35, 'u-', {tag: 'King Bed / เตียงคิง', o: ctx.bedOpt || {}});
  for (const [a, b] of [[v0 - .58, v0 - .06], [v1 + .06, v1 + .58]]) {
    ctx.P('nightstand', 'walnut', uHead + .03, uHead + .5, a, b, 0, .57, 'u-');
    ctx.Pc('tableLamp', 'ceramic', uHead + .27, (a + b) / 2, .32, .32, .57, 1.17, 'u-', {round: true});
    B('gold', 0, .06, (a + b) / 2 - .05, (a + b) / 2 + .05, 1.45, 1.6, {s: false});           // reading sconce
  }
  B('rug', uHead + .9, uHead + len + .7, v0 - .55, v1 + .55, 0, .014, {s: false});
}
function tvConsole(ctx, uWall, v0, v1, dir){        // dir = -1 when the wall is at u = W
  const {B, P} = ctx, a = uWall, b = uWall + dir * .5, bk = dir > 0 ? 'u-' : 'u+';
  P('desk', 'walnut', a, b, v0, v1, 0, .75, bk, {tag: 'Writing Desk / โต๊ะทำงาน'});
  const vm = (v0 + v1) / 2;
  P('tv', 'black', a, a + dir * .05, vm - .73, vm + .73, 1.05, 1.88, bk, {tag: 'TV 65" / ทีวี'});
  B('walnut', a, a + dir * .02, v0 - .15, v1 + .15, .75, 2.4, {s: false});
  B('walnut', a, a + dir * .26, vm + .8, vm + 1.0, 1.95, 1.98, {s: false}); B('walnut', a, a + dir * .26, vm - 1.0, vm - .8, 1.95, 1.98, {s: false});   // floating shelves
}
// chair facing a point (fu, fv); without a target the back is toward +v
function backFrom(u, v, face){ if (!face) return 'v+'; const du = u - face[0], dv = v - face[1], l = Math.hypot(du, dv) || 1; return [du / l, dv / l]; }
function deskChair(ctx, u, v, face, kind = 'officeChair', fab = 'leather'){ ctx.Pc(kind, fab, u, v, .5, .5, 0, .92, backFrom(u, v, face)); }
function diningChair(ctx, u, v, face, fab = 'velvetCream'){ ctx.Pc('chair', fab, u, v, .48, .5, 0, .95, backFrom(u, v, face)); }
function armchair(ctx, u, v, fab, back = 1, face){ ctx.Pc('armchair', fab, u, v, .76, .72, 0, .82, face ? backFrom(u, v, face) : back > 0 ? 'v+' : 'v-', {o: {accent: fab === 'velvetBlush' ? 'linen' : 'velvetBlush'}}); }
function coffee(ctx, u, v, r, h = .42, o = {}){ return ctx.Pc('coffeeRound', o.top || 'marbleBlack', u, v, 2 * r, 2 * r, 0, h, 'v+', {round: true, tag: o.tag, o: o.decor === false ? {decor: false} : {}}); }
function sideTable(ctx, u, v, r = .22, h = .55){ return ctx.Pc('sideTable', 'marbleBlack', u, v, 2 * r, 2 * r, 0, h, 'v+', {round: true}); }
function sofa(ctx, u0, u1, v, depth, fab, backDir){ ctx.P('sofa', fab, u0, u1, v - depth / 2, v + depth / 2, 0, .85, backDir > 0 ? 'v+' : 'v-', {tag: 'Sofa / โซฟา', o: {accent: fab === 'velvetBlush' ? 'velvetCream' : 'velvetBlush'}}); }
function sofaV(ctx, uBack, dir, v0, v1, fab){ ctx.P('sofa', fab, uBack, uBack + dir * .88, v0, v1, 0, .85, dir > 0 ? 'u-' : 'u+', {tag: 'Sofa / โซฟา'}); }
function wardrobe(ctx, uWall, v0, v1, dir, label = 'Wardrobe / ตู้เสื้อผ้า'){ ctx.P('wardrobe', 'walnut', uWall, uWall + dir * .6, v0, v1, 0, 2.4, dir > 0 ? 'u-' : 'u+', {tag: label || null}); }
function bottles(ctx, u, v0, v1, z, n, dir = 1){ for (let i = 0; i < n; i++) ctx.Pc('bottle', i % 3 === 1 ? 'glassClear' : i % 3 === 2 ? 'wine' : 'bottleGreen', u, v0 + (i + .5) * (v1 - v0) / n, .075, .075, z, z + .3, 'v+', {round: true, s: false}); }
function minibar(ctx, uWall, v0, v1, dir){
  const {B, P} = ctx, a = uWall, b = uWall + dir * .58;
  P('minibar', 'walnut', a, b, v0, v1, 0, 1.3, dir > 0 ? 'u-' : 'u+', {tag: 'Minibar & Coffee / มินิบาร์'});
  for (const z of [1.4, 1.8]) B('walnut', a, a + dir * .3, v0 + .05, v1 - .05, z, z + .03, {tag: z === 1.4 ? 'Shelves / ชั้นวางของ' : null});
  bottles(ctx, a + dir * .15, v0 + .1, v1 - .1, 1.43, 4);
}
function vanity(ctx, u0, u1, v, dir, basins = 1){
  const {B, P} = ctx, vb = v + dir * .55;
  B('marble', u0, u1, Math.min(v, vb), Math.max(v, vb), .55, .87, {tag: basins > 1 ? 'Double Basin / อ่างล้างหน้าคู่' : 'Basin / อ่างล้างหน้า'});
  B('walnut', u0, u1, Math.min(v, vb), Math.max(v, vb), .3, .55);
  for (let i = 0; i < basins; i++) { const uc = u0 + (u1 - u0) * (i + .5) / basins; P('basinSet', 'ceramic', uc - .22, uc + .22, v + dir * .02, v + dir * .54, .87, 1.17, dir > 0 ? 'v-' : 'v+'); B('gold', uc - .08, uc + .08, vb - dir * .005, vb, .4, .42, {s: false}); }
  B('mirror', u0 + .05, u1 - .05, Math.min(v, v + dir * .02), Math.max(v, v + dir * .02), 1.05, 2.0, {tag: 'Mirror / กระจก'});
  B('lampGlow', u0 + .05, u1 - .05, Math.min(v + dir * .02, v + dir * .035), Math.max(v + dir * .02, v + dir * .035), 2.0, 2.04, {s: false});
}
function wc(ctx, uWall, vc, dir){ ctx.P('wc', 'ceramic', uWall, uWall + dir * .66, vc - .2, vc + .2, 0, 1.05, dir > 0 ? 'u-' : 'u+', {tag: 'Toilet / ชักโครก'}); }
function showerBox(ctx, u0, u1, v0, v1, glassU, glassV){
  const {B, C} = ctx;
  B('marbleDark', u0, u1, v0, v1, 0, .04, {tag: 'Rain Shower / ฝักบัว'});
  if (glassV != null) B('glassShower', u0 + .35, u1, glassV - .01, glassV + .01, .04, 2.05);
  if (glassU != null) B('glassShower', glassU - .01, glassU + .01, v0, v1, .04, 2.05);
  C('gold', (u0 + u1) / 2, (v0 + v1) / 2, .14, 2.22, 2.25, {s: false}); C('gold', (u0 + u1) / 2, (v0 + v1) / 2, .012, 2.25, CEIL, {s: false});
}
function bathtub(ctx, u0, u1, v0, v1, free){ ctx.P(free ? 'tubFree' : 'tub', free ? 'ceramic' : 'marble', u0, u1, v0, v1, 0, free ? .92 : .8, 'v+', {tag: free ? 'Freestanding Tub / อ่างอาบน้ำ' : 'Bathtub / อ่างอาบน้ำ', o: {th: free ? .6 : .58}}); }
function towels(ctx, u0, u1, v, dir){ ctx.P('towelBar', 'towel', u0, u1, v, v + dir * .08, .6, 1.2, dir > 0 ? 'v-' : 'v+', {s: false}); }
function plant(ctx, u, v, h = 1.1, R = .32, potR = .2, type){ ctx.Pc('plant', 'pot', u, v, 2 * R, 2 * R, 0, .45 + h, 'v+', {round: true, o: {potR, ...(type ? {type} : {})}}); }
function lamp(ctx, u, v){ ctx.Pc('floorLamp', 'gold', u, v, .4, .4, 0, 1.75, 'v+', {round: true}); }
// bathroom block 0..bw x 0..bd with door in the wall u=bw, opening v in [d0,d1]
function bathWalls(ctx, bw, bd, d0, d1){
  const {B} = ctx;
  B('wall', bw, bw + .1, 0, d0, 0, CEIL); B('wall', bw, bw + .1, d1, bd + .1, 0, CEIL); B('wall', bw, bw + .1, d0, d1, 2.2, CEIL);
  B('wall', 0, bw, bd, bd + .1, 0, CEIL);
  B('walnut', bw + .1, bw + .14, d0 - .85, d0 + .02, 0, 2.15, {door: true});         // sliding door parked on the passage side
  B('clear', bw + .15, bw + .95, d0 + .05, d1 - .05, .05, 1.9, {clear: true}); B('clear', bw - .75, bw - .02, d0 + .05, d1 - .05, .05, 1.9, {clear: true});
}

const TEMPLATES = {
  poolHall(ctx){
    const {W, B, C} = ctx; B('marbleFloor', 0, W, 0, D, 0, .015, {s: false});
    entryDoor(ctx, 13.4);
    const p0 = 4.2, p1 = 23.3, v0 = 2.6, v1 = 5.75;            // lap pool basin (raised coping)
    B('marble', p0 - .3, p1 + .3, v0 - .3, v0, 0, .45); B('marble', p0 - .3, p1 + .3, v1, v1 + .3, 0, .45); B('marble', p0 - .3, p0, v0, v1, 0, .45); B('marble', p1, p1 + .3, v0, v1, 0, .45);
    B('water', p0, p1, v0, v1, 0, .38, {s: false, tag: 'Lap Pool 19 m / สระว่ายน้ำ'}); for (let i = 1; i < 4; i++) B('gold', p0, p1, v0 + i * (v1 - v0) / 4 - .02, v0 + i * (v1 - v0) / 4 + .02, .38, .385, {s: false});
    for (let i = 0; i < 17; i++) { const u = p0 + .2 + i * 1.12; if (u > 12.7 && u < 15.0) continue; if (u + .72 > p1) break; ctx.P('lounger', 'linen', u, u + .72, .35, 2.0, 0, .75, 'v-', {tag: i === 1 ? 'Sun Loungers / เตียงอาบแดด' : null}); }
    C('marble', 2.15, 3.6, 1.15, 0, .5); C('water', 2.15, 3.6, .95, .5, .52, {s: false, tag: 'Jacuzzi / อ่างน้ำวน'});
    B('walnut', 24.3, 26.0, .4, 1.1, 0, 1.0, {tag: 'Towel Station / จุดรับผ้าเช็ดตัว'}); for (let i = 0; i < 4; i++) B('towel', 24.4 + i * .4, 24.75 + i * .4, .5, 1.0, 1.0, 1.15, {s: false});
    for (const u of [.6, 3.4]) plant(ctx, u, 1.2, 1.4);
    ctx.P('daybed', 'linen', 24.6, 26.4, 2.4, 4.4, 0, .75, 'u+', {tag: 'Daybed / เตียงพักผ่อน'});
    return {area: 182};
  },
  changingM(ctx){ return TEMPLATES.changing(ctx); },
  changingF(ctx){ return TEMPLATES.changing(ctx); },
  changing(ctx){
    const {W, B, C} = ctx; B('marbleFloor', 0, W, 0, D, 0, .015, {s: false});
    entryDoor(ctx, 2.6);
    for (let i = 0; i < 4; i++) ctx.P('locker', 'walnut', 0, .55, .3 + i * .55, .82 + i * .55, 0, 2.1, 'u-', {tag: i === 0 ? 'Lockers / ตู้ล็อกเกอร์' : null});
    ctx.P('cushionedBench', 'leather', 1.0, 1.4, .6, 2.4, 0, .45, 'u+', {tag: 'Bench / ม้านั่ง'});
    for (let i = 0; i < 3; i++) { const u0 = .1 + i * 1.15; B('marbleDark', u0, u0 + 1.0, D - 1.25, D - .05, 0, .04, {tag: i === 1 ? 'Showers / ห้องอาบน้ำ' : null}); B('glassShower', u0 + 1.0, u0 + 1.04, D - 1.25, D - .05, .04, 2.05); B('glassShower', u0, u0 + 1.0, D - 1.29, D - 1.25, .04, 2.05); C('gold', u0 + .5, D - .6, .12, 2.2, 2.23, {s: false}); }
    vanity(ctx, 3.75, W - .1, 0, 1, 2);
    for (let i = 0; i < 2; i++) { const v0 = 2.6 + i * 1.3; B('wall', W - 1.4, W - 1.35, v0, v0 + 1.25, 0, 2.1); wc(ctx, W, v0 + .62, -1); }
    B('wall', W - 1.4, W, 2.55, 2.6, 0, 2.1); B('wall', W - 1.4, W, 5.15, 5.2, 0, 2.1);
    return {area: +(W * D).toFixed(1)};
  },
  clubLounge(ctx){
    const {W, B, C} = ctx; floorFinish(B, W, null); B('rug', 2.0, 25.5, 2.0, 6.0, .012, .02, {s: false});
    entryDoor(ctx, 13.4);
    B('walnut', 16.0, 22.0, .55, 1.25, 0, 1.05, {tag: 'Bar / บาร์'}); B('marbleBlack', 15.95, 22.05, .5, 1.3, 1.05, 1.1, {s: false}); B('gold', 15.95, 22.05, 1.25, 1.3, .3, 1.05, {s: false});
    ctx.P('barShelf', 'walnut', 16.0, 22.0, 0, .3, 1.1, 2.5, 'v-');
    for (let i = 0; i < 7; i++) ctx.Pc('stool', 'leather', 16.4 + i * .85, 1.75, .4, .4, 0, .78, 'v+', {round: true});
    ctx.P('bookcase', 'walnut', 3.0, 9.0, 0, .45, 0, 2.4, 'v-', {tag: 'Library / ห้องสมุด'});
    B('walnut', 9.6, 12.6, .4, 1.1, 0, .92, {tag: 'Afternoon Tea Buffet / บุฟเฟต์'}); B('marble', 9.55, 12.65, .35, 1.15, .92, .96, {s: false}); for (let i = 0; i < 5; i++) { if (i % 2) ctx.Pc('pastryTray', 'marble', 9.9 + i * .6, .75, .4, .32, .96, 1.04, 'v-'); else ctx.Pc('cakeStand', 'gold', 9.9 + i * .6, .75, .34, .34, .96, 1.34, 'v-', {round: true}); }
    const sets = [[4.0, 4.6], [9.0, 4.6], [18.5, 4.6], [23.0, 4.6]];
    sets.forEach(([u, v], k) => { coffee(ctx, u, v, .45); sofa(ctx, u - 1.1, u + 1.1, v + 1.15, .85, k % 2 ? 'velvetNavy' : 'velvetGreen', 1); armchair(ctx, u - 1.55, v - .1, 'velvetBlush', 1, [u, v]); armchair(ctx, u + 1.55, v - .1, 'velvetBlush', 1, [u, v]); });
    for (const u of [13.0, 14.8]) { ctx.Pc('tableRound', 'linen', u, 3.8, .84, .84, 0, .76, 'v+', {round: true, o: {seats: 2, a0: Math.PI / 2, setting: 'coffee'}}); diningChair(ctx, u, 3.05, [u, 3.8]); diningChair(ctx, u, 4.6, [u, 3.8]); }
    for (const u of [1.0, 26.3]) plant(ctx, u, 2.6, 1.3);
    windowSide(ctx, 1.5, W - 1.5, false);
    return {area: 182};
  },
  meeting(ctx){
    const {W, B} = ctx; floorFinish(B, W, null);
    entryDoor(ctx, 2.9);
    ctx.P('tableRect', 'walnut', 1.4, 4.4, 2.6, 4.0, 0, .77, 'v+', {tag: 'Boardroom Table / โต๊ะประชุม', o: {setting: 'none'}});
    for (let i = 0; i < 4; i++) { deskChair(ctx, 1.75 + i * .8, 2.15, [1.75 + i * .8, 3.3]); deskChair(ctx, 1.75 + i * .8, 4.45, [1.75 + i * .8, 3.3]); }
    deskChair(ctx, .95, 3.3, [2.9, 3.3]); deskChair(ctx, 4.85, 3.3, [2.9, 3.3]);
    B('tv', 0, .06, 2.1, 4.5, 1.0, 2.35, {tag: 'Display / จอประชุม'}); B('walnut', 0, .45, .3, 1.6, 0, .9, {tag: 'Credenza / ตู้เก็บของ'});
    windowSide(ctx, 0, W - 1.5, true);
  },
  business(ctx){
    const {W, B} = ctx; floorFinish(B, W, null);
    entryDoor(ctx, 2.9);
    for (let i = 0; i < 3; i++) { const v = 2.2 + i * 1.35; ctx.P('desk', 'walnut', 0, .7, v, v + 1.2, 0, .76, 'u-', {tag: i === 0 ? 'Work Desks / โต๊ะทำงาน' : null, o: {lamp: false}}); ctx.P('monitor', 'black', .1, .55, v + .25, v + .95, .76, 1.25, 'u-', {s: false}); deskChair(ctx, 1.05, v + .6, [0, v + .6]); }
    B('steel', 0, .7, .3, 1.1, 0, 1.1, {tag: 'Printer / เครื่องพิมพ์'}); sofa(ctx, 2.0, 3.8, D - 1.2, .85, 'velvetNavy', 1); plant(ctx, 4.4, 2.2, 1.2);
    windowSide(ctx, 0, W - 1.5, true);
  },
  deluxe(ctx){
    const {W, B} = ctx, bw = 2.3, bd = 2.75; floorFinish(B, W, {u0: 0, u1: bw, v0: 0, v1: bd});
    bathWalls(ctx, bw, bd, 1.65, 2.45);
    showerBox(ctx, 0, 1.2, 0, 1.08, 1.2, null); vanity(ctx, 1.3, bw - .05, 0, 1); wc(ctx, 0, 2.1, 1); towels(ctx, 1.0, 1.7, bd, -1);
    entryDoor(ctx, bw + .3);
    wardrobe(ctx, W, .15, 1.75, -1); minibar(ctx, W, 1.8, 2.75, -1);
    B('walnut', 0, 1.9, bd + .1, bd + .4, 1.0, 1.03, {s: false, tag: null}); B('walnut', 0, 1.9, bd + .1, bd + .4, 1.45, 1.48, {s: false});   // open shelves on bath back wall
    acUnit(ctx, .9, bd + .1, 1);
    bedKing(ctx, 0, 3.75);
    tvConsole(ctx, W, 3.7, 5.7, -1); deskChair(ctx, W - .85, 4.25, [W, 4.25]);
    const o = !!ctx.r.outer; armchair(ctx, o ? 3.0 : W - 1.35, D - .75, 'velvetGreen'); sideTable(ctx, o ? 3.65 : W - .62, D - .6, .2, .5);
    windowSide(ctx, 0, o ? W - 1.5 : W, o);
  },
  deluxeCorner(ctx){
    const {W, B, r} = ctx, bw = 2.3, bd = 2.75; floorFinish(B, W, {u0: 0, u1: bw, v0: 0, v1: bd});
    bathWalls(ctx, bw, bd, 1.65, 2.45);
    showerBox(ctx, 0, 1.2, 0, 1.08, 1.2, null); vanity(ctx, 1.3, bw - .05, 0, 1); wc(ctx, 0, 2.1, 1); towels(ctx, 1.0, 1.7, bd, -1);
    entryDoor(ctx, bw + .3);
    wardrobe(ctx, bw + 2.05, .15, 1.75, -1); minibar(ctx, bw + 2.05, 1.8, 2.75, -1);
    acUnit(ctx, .9, bd + .1, 1);
    bedKing(ctx, 0, 3.75);
    tvConsole(ctx, bw + 2.05, 3.7, 5.7, -1);
    B('wall', bw + 2.05, bw + 2.15, 3.2, 5.4, 0, 1.3);            // half-height TV partition
    const lz = W - (bw + 2.15);                       // lounge strip between partition and end glass
    if (lz >= 2.4) { sofa(ctx, W - 2.55, W - .5, 1.6, .9, 'velvetNavy', -1); coffee(ctx, W - 1.5, 2.6, .38); armchair(ctx, W - 1.5, 3.75, 'velvetBlush', 1); plant(ctx, W - .65, 3.6); }
    else { armchair(ctx, bw + 2.15 + lz / 2, 2.3, 'velvetBlush', 1); sideTable(ctx, bw + 2.15 + lz / 2, 3.35, .22, .5); }
    lamp(ctx, W - .6, .7);
    deskChair(ctx, bw + 1.2, 4.2, [bw + 2.05, 4.2]);
    windowSide(ctx, 0, W - 1.5, true);
  },
  club(ctx){ return TEMPLATES.clubBase(ctx, false); },
  clubPlus(ctx){ return TEMPLATES.clubBase(ctx, true); },
  clubBase(ctx, plus){
    const {W, B, C} = ctx, bw = 2.8, bd = 3.0; floorFinish(B, W, {u0: 0, u1: bw, v0: 0, v1: bd});
    bathWalls(ctx, bw, bd, 1.55, 2.35);
    showerBox(ctx, 0, 1.0, 0, 1.25, 1.0, null); vanity(ctx, 1.1, bw - .05, 0, 1, 2); wc(ctx, 0, 1.6, 1); bathtub(ctx, .05, 1.8, bd - .82, bd - .02, false); towels(ctx, 2.0, 2.7, bd, -1);
    entryDoor(ctx, bw + .3);
    wardrobe(ctx, W, .15, 1.95, -1); minibar(ctx, W, 2.0, 2.95, -1);
    acUnit(ctx, 1.0, bd + .1, 1);
    bedKing(ctx, 0, 3.85);
    tvConsole(ctx, W, 3.85, 5.85, -1); deskChair(ctx, W - .85, 4.4, [W, 4.4]);
    const o = !!ctx.r.outer; if (!o) { sofa(ctx, 2.85, plus ? W - 1.6 : W - 1.15, D - .75, .85, 'velvetGreen', 1); coffee(ctx, plus ? (2.85 + W - 1.6) / 2 : (2.85 + W - 1.15) / 2, D - 1.65, .3); } else { armchair(ctx, 3.0, D - .75, 'velvetGreen'); }
    if (plus) { armchair(ctx, W - 1.0, D - .75, 'velvetBlush'); }
    lamp(ctx, 2.2, D - .45);
    windowSide(ctx, 0, o ? W - 1.5 : W, o);
  },
  clubCorner(ctx){
    const {W, B, C} = ctx, bw = 2.8, bd = 3.0; floorFinish(B, W, {u0: 0, u1: bw, v0: 0, v1: bd});
    bathWalls(ctx, bw, bd, 1.55, 2.35);
    showerBox(ctx, 0, 1.0, 0, 1.25, 1.0, null); vanity(ctx, 1.1, bw - .05, 0, 1, 2); wc(ctx, 0, 1.6, 1); bathtub(ctx, .05, 1.8, bd - .82, bd - .02, false); towels(ctx, 2.0, 2.7, bd, -1);
    entryDoor(ctx, bw + .3);
    wardrobe(ctx, bw + 2.0, .15, 1.95, -1); minibar(ctx, bw + 2.0, 2.0, 2.95, -1);
    acUnit(ctx, 1.0, bd + .1, 1);
    bedKing(ctx, 0, 3.85);
    tvConsole(ctx, bw + 2.0, 3.85, 5.85, -1); B('wall', bw + 2.0, bw + 2.1, 3.4, 5.4, 0, 1.3);
    const lz = W - (bw + 2.1);
    if (lz >= 2.2) { sofa(ctx, W - 2.0, W - .3, 1.45, .85, 'velvetGreen', -1); coffee(ctx, W - 1.15, 2.4, .32); armchair(ctx, W - 1.15, 3.6, 'velvetBlush', 1); }
    else if (lz >= .9) { armchair(ctx, bw + 2.1 + lz / 2, 2.3, 'velvetBlush', 1); sideTable(ctx, bw + 2.1 + lz / 2, 3.35, .22, .5); }
    else { const pu = bw + 2.1 + Math.min(lz / 2, .28); plant(ctx, pu, 2.4, 1.25, .22, .16); plant(ctx, pu, 3.3, .95, .22, .16); }
    deskChair(ctx, bw + 1.2, 4.3, [bw + 2.0, 4.3]);
    windowSide(ctx, 0, W - 1.5, true); lamp(ctx, W - .6, .7);
  },
  juniorSuite(ctx){
    const {W, B, C} = ctx, bw = 2.8, bd = 3.0; floorFinish(B, W, {u0: 0, u1: bw, v0: 0, v1: bd});
    bathWalls(ctx, bw, bd, 1.55, 2.35);
    showerBox(ctx, 0, 1.0, 0, 1.25, 1.0, null); vanity(ctx, 1.1, bw - .05, 0, 1, 2); wc(ctx, 0, 1.6, 1); bathtub(ctx, .05, 1.8, bd - .82, bd - .02, false); towels(ctx, 2.0, 2.7, bd, -1);
    entryDoor(ctx, bw + .3);
    // walk-in wardrobe + minibar
    B('wall', bw + 1.4, bw + 1.5, 0, 2.2, 0, CEIL); wardrobe(ctx, W, .15, 2.15, -1, 'Walk-in Closet / ห้องแต่งตัว'); minibar(ctx, bw + 1.5, .2, 1.2, 1);
    acUnit(ctx, 1.0, bd + .1, 1);
    bedKing(ctx, 0, 3.85);
    B('wall', 4.6, 4.7, 3.4, 6.2, 0, 1.3); tvConsole(ctx, 4.6, 3.95, 5.75, -1);
    sofaV(ctx, W - .05, -1, 3.4, 5.6, 'velvetNavy');
    coffee(ctx, W - 1.55, 4.5, .3); armchair(ctx, 5.3, D - .6, 'velvetBlush'); armchair(ctx, 6.2, D - .6, 'velvetBlush');
    lamp(ctx, W - .3, D - .55);
    windowSide(ctx, 0, W, false);
  },
  execSuite(ctx){
    // bedroom wing (u 0..4.9, plumbing side) | partition | living wing (4.9..W, outer end)
    const {W, B, C} = ctx; floorFinish(B, W, {u0: 0, u1: 3.2, v0: 0, v1: 3.0});
    const P = 4.9;
    B('wall', P, P + .1, 0, 1.8, 0, CEIL); B('wall', P, P + .1, 2.7, D, 0, CEIL); B('wall', P, P + .1, 1.8, 2.7, 2.2, CEIL);
    B('walnut', P + .1, P + .14, .95, 1.82, 0, 2.15);                                   // bedroom door (sliding, parked)
    // master bath 0..3.2 x 0..3.0, door in wall u=3.2 at v 1.9..2.8
    B('wall', 3.2, 3.3, 0, 1.9, 0, CEIL); B('wall', 3.2, 3.3, 2.8, 3.1, 0, CEIL); B('wall', 3.2, 3.3, 1.9, 2.8, 2.2, CEIL); B('wall', 0, 3.2, 3.0, 3.1, 0, CEIL);
    showerBox(ctx, 0, 1.1, 0, 1.3, 1.1, null); vanity(ctx, 1.25, 3.15, 0, 1, 2); wc(ctx, 3.2, 1.15, -1); bathtub(ctx, .05, 1.85, 2.15, 2.95, false); towels(ctx, 2.0, 3.0, 3.0, -1);
    // walk-in closet 3.3..4.9 x 0..1.7
    B('wall', 3.3, P, 1.7, 1.8, 0, CEIL); wardrobe(ctx, P, .1, 1.65, -1, 'Walk-in Closet / ห้องแต่งตัว'); B('walnut', 3.3, 3.75, .1, 1.65, 0, .9);
    acUnit(ctx, .9, 3.1, 1);
    bedKing(ctx, 0, 3.85);
    tvConsole(ctx, P, 3.85, 5.85, -1);
    windowSide(ctx, 0, P, false);
    // foyer + powder room + entry
    entryDoor(ctx, 5.35);
    B('wall', 6.5, 6.6, 0, 1.7, 0, CEIL); B('wall', 6.6, 8.0, 1.7, 1.8, 0, CEIL); B('wall', 8.0, 8.1, 0, 1.8, 0, CEIL);
    B('marbleFloor', 6.6, 8.0, 0, 1.7, .012, .02, {s: false}); vanity(ctx, 6.65, 7.5, 0, 1); wc(ctx, 8.0, 1.2, -1); B('walnut', 6.6, 6.64, .95, 1.7, 0, 2.15);
    B('art', P + .1, P + .12, .2, .85, 1.2, 1.9, {s: false});
    // living
    tvConsole(ctx, P + .1, 3.4, 5.4, 1);
    sofaV(ctx, 7.45, -1, 3.25, 5.55, 'velvetGreen');
    coffee(ctx, 6.05, 4.4, .32, .42, {tag: 'Coffee Table / โต๊ะกลาง'});
    B('rug', 5.6, 7.5, 3.0, 5.9, 0, .014, {s: false}); armchair(ctx, 6.1, 6.0, 'velvetBlush');
    // dining for 4 (round)
    ctx.Pc('tableRound', 'linen', 8.75, 3.2, 1.1, 1.1, 0, .76, 'v+', {round: true, tag: 'Dining / โต๊ะอาหาร 4 ที่', o: {seats: 4}});
    for (const [u, v] of [[8.75, 2.35], [8.75, 4.05], [7.9, 3.2], [9.6, 3.2]]) diningChair(ctx, u, v, [8.75, 3.2]);
    ctx.Pc('pendant', 'lampShade', 8.75, 3.2, .5, .5, 1.95, 2.7, 'v+', {round: true, s: false});
    lamp(ctx, 9.6, 2.0); plant(ctx, 5.75, 2.3, 1.2);
    windowSide(ctx, P + .1, W - 1.5, true);
    return {area: +(W * D - 1).toFixed(1)};
  },
  presidential(ctx){
    const {W, B, C} = ctx; floorFinish(B, W, {u0: 3.0, u1: 8.5, v0: 0, v1: 3.2});
    // ---- master wing (u 0..11.9)
    B('wall', 11.9, 12.0, 0, .9, 0, CEIL); B('wall', 11.9, 12.0, 1.9, D, 0, CEIL); B('wall', 11.9, 12.0, .9, 1.9, 2.2, CEIL); B('walnut', 12.0, 12.04, 1.88, 2.75, 0, 2.15);
    // master bath 3.0..8.5 x 0..3.2 (door at u 8.5, v 2.3..3.1)
    B('wall', 2.95, 3.05, 0, 3.3, 0, CEIL); B('wall', 3.05, 8.6, 3.2, 3.3, 0, CEIL); B('wall', 8.5, 8.6, 0, 2.3, 0, CEIL); B('wall', 8.5, 8.6, 2.3, 3.1, 2.2, CEIL);
    showerBox(ctx, 3.05, 4.45, 0, 1.4, 4.45, null); vanity(ctx, 4.6, 7.35, 0, 1, 2);
    B('wall', 7.45, 7.55, 0, 1.45, 0, CEIL); B('glassShower', 7.55, 8.5, 1.44, 1.46, 0, 2.1); wc(ctx, 8.5, .75, -1);
    bathtub(ctx, 4.3, 6.1, 2.2, 3.05, true); towels(ctx, 6.4, 7.4, 3.2, -1); plant(ctx, 3.45, 2.75, .9);
    // walk-in 8.6..11.9 x 0..2.2
    B('wall', 8.6, 11.9, 2.2, 2.3, 0, 1.2); wardrobe(ctx, 8.6, .1, 2.15, 1, 'Walk-in Closet / ห้องแต่งตัว'); wardrobe(ctx, 11.9, .9, 2.15, -1, '');
    B('marbleBlack', 9.7, 10.8, .8, 1.6, 0, .9, {tag: 'Island / ตู้กลางห้องแต่งตัว'});
    // bedroom (bed faces the river)
    acUnit(ctx, 9.0, 3.3 + .02, 1);
    B('walnut', 4.4, 8.0, 3.3, 3.33, 0, 2.6, {s: false});
    ctx.P('bed', 'velvetCream', 5.1, 7.3, 3.33, 5.68, 0, 1.4, 'v-', {tag: 'King Bed / เตียงคิง', o: {throw: 'velvetNavy'}});
    for (const u of [4.5, 7.4]) { ctx.P('nightstand', 'walnut', u, u + .5, 3.45, 3.95, 0, .57, 'v-'); ctx.Pc('tableLamp', 'ceramic', u + .25, 3.7, .32, .32, .57, 1.17, 'v-', {round: true}); }
    B('rug', 4.2, 8.2, 4.4, 6.3, 0, .014, {s: false});
    sofa(ctx, 9.0, 10.9, 5.8, .85, 'velvetNavy', -1); coffee(ctx, 10.0, 4.85, .3);
    tvConsole(ctx, 11.9, 3.7, 5.3, -1);
    ctx.P('desk', 'walnut', .3, 1.5, 1.0, 1.6, 0, .75, 'v-', {tag: 'Vanity Desk / โต๊ะแต่งตัว', o: {lamp: false}}); deskChair(ctx, .9, 2.05, [.9, 1.3], 'chair', 'velvetBlush'); B('mirror', .3, 1.5, 0, .02, .9, 1.9);
    sofa(ctx, .4, 2.3, 4.4, .9, 'velvetBlush', -1);
    windowSide(ctx, 1.5, 11.9, false); ctx.P('curtain', 'sheer', .11, .14, .3, D - 1.55, .02, CEIL - .08, 'u-', {o: {lambda: .14}});
    // ---- foyer + powder + pantry (u 12..21)
    entryDoor(ctx, 13.4);
    B('marbleFloor', 12.0, 15.7, 0, 2.6, .012, .02, {s: false}); coffee(ctx, 13.9, 2.0, .55, .8, {tag: 'Foyer / โถงทางเข้า', decor: false}); ctx.Pc('flowers', 'gold', 13.9, 2.0, .7, .7, .8, 1.6, 'v+', {round: true, o: {vase: 'gold'}});
    B('wall', 15.8, 15.9, 0, 1.9, 0, CEIL); B('wall', 15.9, 17.6, 1.9, 2.0, 0, CEIL); B('wall', 17.6, 17.7, 0, 2.0, 0, CEIL);
    vanity(ctx, 15.95, 16.85, 0, 1); wc(ctx, 17.6, 1.4, -1); B('walnut', 15.9, 15.94, 1.0, 1.88, 0, 2.15);
    B('wall', 17.7, 20.6, 1.9, 2.0, 0, 1.05); B('marbleBlack', 17.7, 20.6, 1.4, 2.0, 1.05, 1.1, {tag: 'Pantry & Bar / แพนทรี'});
    B('walnut', 17.8, 19.85, 0, .62, 0, .92); B('marble', 17.8, 19.85, 0, .65, .92, .96, {s: false}); B('walnut', 17.8, 19.85, 0, .35, 1.4, 2.3); B('steel', 19.9, 20.5, 0, .62, 0, 1.9);
    // dining for 8
    ctx.P('tableRect', 'walnut', 16.0, 19.4, 3.35, 4.45, 0, .76, 'v+', {tag: 'Dining / โต๊ะอาหาร 8 ที่', o: {perSide: 3, ends: true}});
    for (let i = 0; i < 3; i++) { diningChair(ctx, 16.5 + i * 1.2, 2.9, [16.5 + i * 1.2, 3.9]); diningChair(ctx, 16.5 + i * 1.2, 4.95, [16.5 + i * 1.2, 3.9]); }
    diningChair(ctx, 15.55, 3.9, [17.7, 3.9]); diningChair(ctx, 19.85, 3.9, [17.7, 3.9]);
    ctx.Pc('chandelier', 'gold', 17.7, 3.9, 1.1, 1.1, 1.95, 2.7, 'v+', {round: true, s: false});
    // living (u 21..W)
    B('wall', 21.0, 21.1, 2.6, D - .7, 0, 1.1); tvConsole(ctx, 21.1, 3.3, 5.3, 1);
    sofaV(ctx, 25.1, -1, 3.0, 5.6, 'velvetGreen');
    coffee(ctx, 23.1, 4.3, .55, .42, {tag: 'Coffee Table / โต๊ะกลาง'}); armchair(ctx, 22.6, 2.75, 'velvetBlush', -1); armchair(ctx, 23.6, 2.75, 'velvetBlush', -1);
    B('rug', 21.9, 25.3, 2.4, 6.0, 0, .014, {s: false});
    ctx.P('bookcase', 'walnut', 22.0, 25.5, 0, .45, 0, 2.4, 'v-', {tag: 'Library Shelves / ชั้นหนังสือ'});
    ctx.P('desk', 'walnut', 25.8, 26.9, 1.0, 1.7, 0, .76, 'v-', {tag: 'Study Desk / โต๊ะทำงาน'}); deskChair(ctx, 26.35, 2.1, [26.35, 1.35]);
    acUnit(ctx, 20.0, .01, 1); lamp(ctx, 25.5, 3.0); plant(ctx, 21.5, 2.2, 1.3);
    windowSide(ctx, 12.0, W - 1.5, true);
    return {area: 186};
  }
};

// ================= facility levels (podium G/2/3 and rooftop 18), authored in absolute floor coordinates =================
export const PX = 23.85, PY = 13.35;                    // podium interior finish line (glass at 24.09 / 13.59)
function spaceCtx(lv, box, cyl, rooms, spec){
  const id = 'S' + spec.num, tags = [];
  const B = (m, x0, x1, y0, y1, z0, z1, o = {}) => { const it = box(m, x0, x1, y0, y1, z0, z1, {...o, room: o.room ?? id}); if (o.tag) tags.push([o.tag, (it.x0 + it.x1) / 2, (it.y0 + it.y1) / 2, z1 + .3]); return it; };
  const C = (m, x, y, r, z0, z1, o = {}) => { const it = cyl(m, x, y, r, z0, z1, {...o, room: o.room ?? id}); if (o.tag) tags.push([o.tag, x, y, z1 + .3]); return it; };
  const {P, Pc} = makeP(u => u, v => v, 1, 1, id, tags, .3);
  const ctx = {B, C, P, Pc, W: spec.x1 - spec.x0, r: {outer: null}, doors: [], X: u => u, tags};
  const room = {id, num: spec.num, rt: spec.rt || 'space', name: spec.name, tier: spec.tier || 'Facility', side: spec.side ?? -1, x0: spec.x0, x1: spec.x1, y0: spec.y0, y1: spec.y1, tags, area: +((spec.x1 - spec.x0) * (spec.y1 - spec.y0)).toFixed(0), view: spec.view || (spec.side > 0 ? 'Back of house' : 'River view'), outer: null, eye: spec.eye, side2: spec.side};
  B('clear', spec.eye[0] - .2, spec.eye[0] + .2, spec.eye[1] - .2, spec.eye[1] + .2, 1.1, 1.9, {clear: true});
  rooms.push(room); return ctx;
}
// partition wall along x (at y) or along y (at x) with optional door openings [a,b]
function wallX(B, y, x0, x1, doors = [], m = 'wall', t = .12){ const o = {room: 'common'}; let x = x0; for (const [a, b] of doors.slice().sort((p, q) => p[0] - q[0])) { if (a > x + .01) B(m, x, a, y - t / 2, y + t / 2, 0, CEIL, o); B(m, a, b, y - t / 2, y + t / 2, 2.2, CEIL, o); x = b; } if (x1 > x + .01) B(m, x, x1, y - t / 2, y + t / 2, 0, CEIL, o); }
function wallY(B, x, y0, y1, doors = [], m = 'wall', t = .12){ const o = {room: 'common'}; let y = y0; for (const [a, b] of doors.slice().sort((p, q) => p[0] - q[0])) { if (a > y + .01) B(m, x - t / 2, x + t / 2, y, a, 0, CEIL, o); B(m, x - t / 2, x + t / 2, a, b, 2.2, CEIL, o); y = b; } if (y1 > y + .01) B(m, x - t / 2, x + t / 2, y, y1, 0, CEIL, o); }
function glassX(B, y, x0, x1, door){ B('glassShower', x0, door ? door[0] : x1, y - .02, y + .02, 0, 2.6); if (door) B('glassShower', door[1], x1, y - .02, y + .02, 0, 2.6); B('gold', x0, x1, y - .04, y + .04, 2.6, 2.66, {s: false}); }
function roundTable(ctx, x, y, r, seats, chairMat = 'velvetCream', a0 = 0){ ctx.Pc('tableRound', 'linen', x, y, 2 * r, 2 * r, 0, .76, 'v+', {round: true, o: {seats, a0}}); for (let i = 0; i < seats; i++) { const a = a0 + i * 2 * Math.PI / seats; diningChair(ctx, x + Math.cos(a) * (r + .42), y + Math.sin(a) * (r + .42), [x, y], chairMat); } }
function stools(ctx, pts, h = .8){ for (const [x, y] of pts) ctx.Pc('stool', 'leather', x, y, .4, .4, 0, h, 'v+', {round: true}); }
function restroomBlock(ctx, x0, x1, y0, y1, doorY){
  const {B} = ctx, xm = (x0 + x1) / 2;
  B('marbleFloor', x0, x1, y0, y1, 0, .015, {s: false});
  wallX(B, doorY, x0, x1, [[x0 + .5, x0 + 1.4], [xm + .5, xm + 1.4]]); wallY(B, xm, doorY + .06, y1 - .06); wallX(B, y1, x0, x1);
  for (const [a, b, lab] of [[x0, xm, 'Restroom (Men) / ห้องน้ำชาย'], [xm, x1, 'Restroom (Women) / ห้องน้ำหญิง']]) {
    vanity(ctx, a + 1.9, b - .3, doorY + .06, 1, 2);
    for (let i = 0; i < 2; i++) { const ys = y1 - 1.45 - i * 1.5; B('walnut', a + .06, b - .06 > a + 1.6 ? a + 1.6 : b - .06, ys - .03, ys + .03, 0, 2.1); wc(ctx, a + .06, ys + .72, 1); }
    B('art', a + 1.0, a + 1.8, doorY + .07, doorY + .08, 1.4, 2.0, {s: false, tag: lab});
  }
}
const FAC = {
  G(box, cyl, rooms, labels){
    // ---- grand lobby (front, full width)
    const L = spaceCtx('G', box, cyl, rooms, {num: 'G01', name: 'Grand Lobby & Reception', x0: -PX, x1: PX, y0: -PY, y1: 1.1, side: -1, eye: [0, -9.5], tier: 'Arrival'});
    const {B, C} = L;
    B('marbleFloor', -PX, PX, -PY, 1.1, 0, .015, {s: false}); B('marbleBlack', -3.6, 3.6, -PY, -11.6, .015, .02, {s: false}); C('marbleBlack', 0, -6.5, 3.2, .015, .021, {s: false}); C('gold', 0, -6.5, 3.0, .021, .024, {s: false}); C('marbleFloor', 0, -6.5, 2.9, .024, .026, {s: false});
    B('clear', -3.6, 3.6, -PY, -11.6, .05, 2.0, {clear: true});                                          // revolving-door landing
    L.Pc('floralGrand', 'marbleBlack', 0, -6.5, 2.0, 2.0, 0, 2.0, 'v+', {round: true, tag: 'Floral Centrepiece / ดอกไม้กลางล็อบบี้'}); L.Pc('chandelier', 'gold', 0, -6.5, 2.4, 2.4, 2.03, 2.7, 'v+', {round: true, s: false});
    for (const x of [-6.6, 6.6]) L.Pc('plant', 'pot', x, -11.0, 1.5, 1.5, 0, 2.7, 'v+', {round: true, o: {potR: .45, potH: .8, type: 'palm', pot: 'marbleBlack'}});
    // reception (left) + concierge (right): counters face the entrance, staff side behind
    B('walnut', -16.0, -10.4, -4.4, -3.6, 0, 1.1, {tag: 'Reception / เคาน์เตอร์ต้อนรับ'}); B('marbleBlack', -16.05, -10.35, -4.45, -3.55, 1.1, 1.15, {s: false}); B('gold', -16.05, -10.35, -4.47, -4.43, .2, 1.1, {s: false});
    for (let i = 0; i < 3; i++) { L.P('monitor', 'black', -15.25 + i * 1.8, -14.65 + i * 1.8, -4.3, -3.75, 1.15, 1.52, 'v-', {s: false}); deskChair(L, -14.95 + i * 1.8, -2.9, [-14.95 + i * 1.8, -4.0]); }
    B('walnut', -16.4, -10.0, -1.75, -1.6, 0, 2.7, {s: false}); B('art', -14.6, -11.8, -1.8, -1.75, 1.2, 2.4, {s: false, tag: 'Feature Wall / ผนังโลโก้'});
    B('walnut', 10.4, 13.6, -4.4, -3.6, 0, 1.1, {tag: 'Concierge / คอนเซียร์จ'}); B('marbleBlack', 10.35, 13.65, -4.45, -3.55, 1.1, 1.15, {s: false}); deskChair(L, 11.2, -2.9, [11.2, -4.0]); deskChair(L, 12.8, -2.9, [12.8, -4.0]);
    B('walnut', 4.4, 6.0, -12.4, -11.7, 0, 1.1, {tag: 'Bell Desk / จุดบริการกระเป๋า'}); for (const x of [7.8, 8.8]) L.P('trolley', 'gold', x - .35, x + .35, -12.2, -11.4, 0, 1.8, 'v+');
    // lobby lounge (right wing) + grand piano
    [[14.5, -10.2], [20.0, -10.2], [17.2, -6.6]].forEach(([x, y], k) => { coffee(L, x, y, .5); sofa(L, x - 1.15, x + 1.15, y + 1.2, .9, k === 2 ? 'velvetNavy' : 'velvetGreen', 1); armchair(L, x - 1.6, y - .25, 'velvetBlush', 1, [x, y]); armchair(L, x + 1.6, y - .25, 'velvetBlush', 1, [x, y]); });
    B('rug', 12.6, 22.0, -12.8, -5.0, .015, .025, {s: false});
    for (const x of [-8.6, 8.6]) { coffee(L, x, -8.6, .45); armchair(L, x - 1.15, -8.6, 'velvetGreen', 1, [x, -8.6]); armchair(L, x + 1.15, -8.6, 'velvetGreen', 1, [x, -8.6]); B('rug', x - 1.8, x + 1.8, -9.6, -7.6, .015, .025, {s: false}); }
    L.P('piano', 'pianoBlack', 20.6, 22.4, -4.2, -2.2, 0, 1.9, 'v-', {tag: 'Grand Piano / แกรนด์เปียโน'}); L.P('pianoBench', 'leather', 21.1, 21.9, -1.85, -1.45, 0, .5, 'v+');
    // café & patisserie (left wing)
    B('walnut', -22.6, -16.8, -5.6, -4.8, 0, 1.05, {tag: 'Café & Patisserie / คาเฟ่'}); B('glassShower', -22.6, -16.8, -5.62, -5.58, 1.05, 1.45); for (let i = 0; i < 6; i++) { if (i % 2) L.Pc('cakeStand', 'gold', -22.2 + i * .95, -5.2, .3, .3, 1.05, 1.4, 'v+', {round: true}); else L.Pc('pastryTray', 'marble', -22.2 + i * .95, -5.2, .4, .3, 1.05, 1.13, 'v+'); }
    B('steel', -18.4, -17.2, -4.7, -4.2, 1.05, 1.6);
    for (const x of [-21.5, -18.5, -15.5, -12.5]) for (const y of [-12.0, -8.8]) roundTable(L, x, y, .4, 2);
    // lift hall walkway marker
    B('carpetRed', -2.0, 2.0, -4.5, 1.1, .015, .03, {s: false});
    labels.push(['Main Entrance / ทางเข้าหลัก', 0, -12.6, 2.6]);
    // ---- back of house + guest services (y > 1.3)
    const R = spaceCtx('G', box, cyl, rooms, {num: 'G02', name: 'Restrooms', x0: -16.0, x1: -8.3, y0: 1.3, y1: 8.0, side: 1, eye: [-14.0, 2.6], tier: 'Guest Service'});
    wallX(R.B, 1.3, -PX, -16.12, [[-20.5, -19.6]]); restroomBlock(R, -16.0, -8.3, 1.3, 8.0, 1.3);
    wallY(R.B, -16.06, 1.24, PY);
    const O = spaceCtx('G', box, cyl, rooms, {num: 'G03', name: 'Front Office & Luggage', x0: -PX, x1: -16.1, y0: 1.3, y1: PY, side: 1, eye: [-20.0, 3.2], tier: 'Back of House'});
    wallX(O.B, 6.5, -PX, -16.12, [[-21.0, -20.1]]);
    for (let i = 0; i < 3; i++) { O.P('desk', 'walnut', -23.2 + i * 2.3, -21.6 + i * 2.3, 4.7, 5.5, 0, .76, 'v+', {tag: i === 0 ? 'Front Office / สำนักงานส่วนหน้า' : null, o: {lamp: false}}); O.P('monitor', 'black', -22.7 + i * 2.3, -22.1 + i * 2.3, 4.85, 5.45, .76, 1.2, 'v+', {s: false}); deskChair(O, -22.4 + i * 2.3, 4.0, [-22.4 + i * 2.3, 5.1]); }
    for (let i = 0; i < 4; i++) O.B('steel', -23.6 + i * 1.8, -22.2 + i * 1.8, PY - .6, PY - .05, 0, 2.0, {tag: i === 0 ? 'Luggage Store / ห้องฝากกระเป๋า' : null});
    for (let i = 0; i < 6; i++) O.B('leather', -23.4 + i * 1.1, -22.8 + i * 1.1, 8.0, 8.6, 0, .55);
    const X = spaceCtx('G', box, cyl, rooms, {num: 'G04', name: 'Lobby Bar & Boutique', x0: 8.3, x1: PX, y0: 1.3, y1: PY, side: 1, eye: [16.0, 3.2], tier: 'Guest Service'});
    wallX(X.B, 1.3, 8.2, PX, [[9.0, 23.6]]);
    X.B('walnut', 10.5, 17.5, 5.6, 6.3, 0, 1.05, {tag: 'Lobby Bar / ล็อบบี้บาร์'}); X.B('marbleBlack', 10.45, 17.55, 5.55, 6.35, 1.05, 1.1, {s: false}); X.B('walnut', 10.5, 17.5, 7.6, 7.9, 0, 1.0); X.P('barShelf', 'walnut', 10.5, 17.5, 7.6, 7.9, 1.0, 2.5, 'v+'); stools(X, Array.from({length: 7}, (_, i) => [11.0 + i * 1.0, 4.85]));
    wallY(X.B, 18.6, 1.36, PY, [[2.0, 3.2]]);
    for (let i = 0; i < 3; i++) X.B('walnut', 19.2, 23.6, 4.0 + i * 3.0, 4.6 + i * 3.0, 0, 1.6, {tag: i === 0 ? 'Boutique / ร้านค้า' : null});
    X.B('glassClear', 20.4, 22.4, 2.2, 3.2, 0, 1.0);
    const S = spaceCtx('G', box, cyl, rooms, {num: 'G05', name: 'Staff & Loading (BOH)', x0: -8.13, x1: 8.13, y0: 8.1, y1: PY, side: 1, eye: [0, 10.8], tier: 'Back of House'});
    for (let i = 0; i < 8; i++) S.B('steel', -7.6 + i * 1.9, -6.2 + i * 1.9, PY - .55, PY - .05, 0, 1.9, {tag: i === 0 ? 'Staff Lockers / ล็อกเกอร์พนักงาน' : null});
  },
  2(box, cyl, rooms, labels){
    const D0 = spaceCtx(2, box, cyl, rooms, {num: '201', name: 'All-Day Dining', x0: -PX, x1: 10.0, y0: -PY, y1: 1.1, side: -1, eye: [-6.0, -6.8], tier: 'Dining'});
    const {B, C} = D0;
    B('woodFloor', -PX, 10.0, -PY, 1.1, 0, .015, {s: false}); B('rug', -22.8, 8.8, -12.8, -6.6, .015, .025, {s: false});
    for (const x of [-20.8, -16.6, -12.4, -8.2, -0.2, 4.0, 8.0]) for (const y of [-11.6, -8.0]) roundTable(D0, x, y, .55, 4, 'velvetGreen');
    // buffet islands + dessert
    B('walnut', -4.6, 2.6, -5.0, -3.9, 0, .92, {tag: 'Buffet Island / บุฟเฟต์'}); B('marble', -4.65, 2.65, -5.05, -3.85, .92, .96, {s: false}); for (let i = 0; i < 7; i++) D0.Pc('chafing', 'steel', -4.1 + i * 1.0, -4.45, .52, .52, .96, 1.14, 'v+', {round: true, o: {food: ['bread', 'red', 'leaf', 'bread', 'linen', 'blossom', 'bread'][i]}}); B('glassShower', -4.6, 2.6, -4.47, -4.43, 1.14, 1.55);
    B('walnut', -12.6, -7.8, -5.0, -3.9, 0, .92, {tag: 'Dessert & Patisserie / ของหวาน'}); B('marble', -12.65, -7.75, -5.05, -3.85, .92, .96, {s: false}); for (let i = 0; i < 5; i++) { if (i % 2) D0.Pc('pastryTray', 'marble', -12.1 + i * 1.0, -4.45, .55, .42, .96, 1.04, 'v+'); else D0.Pc('cakeStand', 'gold', -12.1 + i * 1.0, -4.45, .44, .44, .96, 1.42, 'v+', {round: true}); }
    // show-kitchen counter along the back
    B('steel', -22.5, -9.0, -1.6, -.8, 0, .92, {tag: 'Live Cooking Stations / ครัวเปิด'}); B('marbleBlack', -22.55, -8.95, -1.65, -.75, .92, .96, {s: false}); for (let i = 0; i < 4; i++) { const x = -21.0 + i * 3.4; D0.Pc('person', 'towel', x, -.2, .64, .64, 0, 1.9, 'v+', {round: true, o: {hat: true, bottom: 'chef', apron: 'chef'}}); }
    for (const x of [-22.6, 9.0]) plant(D0, x, -12.6, 1.6);
    // private dining + wine bar (right)
    const P1 = spaceCtx(2, box, cyl, rooms, {num: '202', name: 'Private Dining Room (10)', x0: 10.1, x1: 16.9, y0: -PY, y1: -5.2, side: -1, eye: [13.5, -6.4], tier: 'Dining'});
    wallY(P1.B, 10.06, -PY, -5.26); wallX(P1.B, -5.2, 10.0, PX, [[12.6, 13.6], [19.6, 20.6]]); wallY(P1.B, 16.96, -PY, -5.26);
    P1.P('tableRect', 'walnut', 11.6, 15.4, -10.4, -8.9, 0, .76, 'v+', {tag: 'Table for 10 / โต๊ะ 10 ที่', o: {perSide: 4, ends: true}}); P1.Pc('chandelier', 'gold', 13.5, -9.65, 1.3, 1.3, 1.95, 2.7, 'v+', {round: true, s: false});
    for (let i = 0; i < 4; i++) { diningChair(P1, 12.05 + i * .95, -11.2, [12.05 + i * .95, -9.65]); diningChair(P1, 12.05 + i * .95, -8.1, [12.05 + i * .95, -9.65]); } diningChair(P1, 11.05, -9.65, [13.5, -9.65]); diningChair(P1, 15.95, -9.65, [13.5, -9.65]);
    P1.B('art', 10.12, 10.14, -11.5, -7.5, 1.2, 2.3, {s: false});
    const P2 = spaceCtx(2, box, cyl, rooms, {num: '203', name: 'Chef’s Table (8)', x0: 17.0, x1: PX, y0: -PY, y1: -5.2, side: -1, eye: [20.4, -6.4], tier: 'Dining'});
    roundTable(P2, 20.4, -9.6, 1.0, 8, 'velvetNavy'); P2.Pc('chandelier', 'gold', 20.4, -9.6, 1.2, 1.2, 1.95, 2.7, 'v+', {round: true, s: false}); P2.tags.push(["Chef's Table / เชฟส์เทเบิล", 20.4, -9.6, 1.1]);
    const W2 = spaceCtx(2, box, cyl, rooms, {num: '204', name: 'Wine Bar & Cellar', x0: 10.1, x1: PX, y0: -5.1, y1: 1.1, side: -1, eye: [14.0, -2.0], tier: 'Dining'});
    W2.P('wineWall', 'walnut', 18.0, 23.6, .1, .7, 0, 2.5, 'v+', {tag: 'Wine Wall / ผนังไวน์'});
    W2.B('walnut', 12.0, 16.5, -2.2, -1.5, 0, 1.05, {tag: 'Bar / บาร์'}); W2.B('marbleBlack', 11.95, 16.55, -2.25, -1.45, 1.05, 1.1, {s: false}); stools(W2, Array.from({length: 5}, (_, i) => [12.4 + i * 1.0, -2.9]));
    // kitchen + restrooms behind
    const K = spaceCtx(2, box, cyl, rooms, {num: '205', name: 'Main Kitchen', x0: -PX, x1: -8.3, y0: 1.3, y1: PY, side: 1, eye: [-16.0, 6.5], tier: 'Back of House'});
    wallX(K.B, 1.3, -PX, -8.2, [[-12.0, -10.8]]);
    K.B('steel', -20.5, -12.5, 4.2, 5.4, 0, .92, {tag: 'Cooking Line / เตาครัว'}); K.B('black', -20.5, -12.5, 4.2, 5.4, .92, .97, {s: false}); K.B('steel', -20.5, -12.5, 4.5, 5.1, 2.0, 2.5, {s: false});
    K.B('steel', -20.5, -12.5, 7.4, 8.2, 0, .9, {tag: 'Prep Tables / โต๊ะเตรียมอาหาร'}); K.B('steel', -23.6, -21.2, 9.6, PY - .05, 0, 2.4, {tag: 'Walk-in Cold Room / ห้องเย็น'}); K.B('steel', -14.0, -9.0, PY - .8, PY - .05, 0, .95, {tag: 'Dishwash / ล้างจาน'});
    const R2 = spaceCtx(2, box, cyl, rooms, {num: '206', name: 'Restrooms', x0: 8.3, x1: 16.0, y0: 1.3, y1: 8.0, side: 1, eye: [10.2, 2.6], tier: 'Guest Service'});
    wallX(R2.B, 1.3, 16.12, PX, [[18.0, 19.0]]); restroomBlock(R2, 8.3, 16.0, 1.3, 8.0, 1.3); wallY(R2.B, 16.06, 1.24, PY);
    const T2 = spaceCtx(2, box, cyl, rooms, {num: '207', name: 'Pastry Kitchen & Stores', x0: 16.1, x1: PX, y0: 1.3, y1: PY, side: 1, eye: [20.0, 3.2], tier: 'Back of House'});
    T2.B('steel', 17.0, 23.0, 5.5, 6.3, 0, .9, {tag: 'Pastry Kitchen / ครัวขนม'}); for (let i = 0; i < 3; i++) T2.B('steel', 16.6 + i * 2.4, 18.6 + i * 2.4, PY - .6, PY - .05, 0, 2.2);
  },
  3(box, cyl, rooms, labels){
    // circulation: lift hall -> foyer (x -8.2..8.2, y -3.55..1.1) with the shared fitness/spa reception
    const FY = spaceCtx(3, box, cyl, rooms, {num: '300', name: 'Fitness & Spa Reception', x0: -8.2, x1: 8.2, y0: -3.55, y1: 1.1, side: -1, eye: [0, .2], tier: 'Wellness'});
    FY.B('marbleFloor', -8.2, 8.2, -3.5, 1.1, 0, .015, {s: false});
    FY.B('walnut', -1.8, 1.8, -2.3, -1.6, 0, 1.05, {tag: 'Fitness & Spa Reception / เคาน์เตอร์ฟิตเนสและสปา'}); FY.B('marbleBlack', -1.85, 1.85, -2.35, -1.55, 1.05, 1.1, {s: false}); deskChair(FY, -.7, -2.9, [-.7, -2.0]); deskChair(FY, .7, -2.9, [.7, -2.0]);
    plant(FY, -7.6, .4, 1.4); plant(FY, 7.6, .4, 1.4);
    wallX(FY.B, -3.55, -PX, -2.2, [[-20.5, -19.6], [-12.6, -11.7], [-6.0, -5.0]]);      // gym back wall: doors to both changing rooms + foyer
    wallX(FY.B, -3.55, 8.3, PX, [[8.6, 9.6]]);                                         // spa corridor -> relaxation lounge
    wallY(FY.B, 8.25, -3.49, 1.3, [[-2.9, -1.9]]); wallY(FY.B, 8.25, 1.3, PY);          // foyer | spa corridor, then treatment block edge
    wallY(FY.B, -8.25, -3.49, PY); wallY(FY.B, -16.05, -3.49, PY);                     // changing rooms
    const F = spaceCtx(3, box, cyl, rooms, {num: '301', name: 'Fitness Centre', x0: -PX, x1: -2.2, y0: -PY, y1: -3.6, side: -1, eye: [-12.0, -6.0], tier: 'Wellness'});
    const {B, C} = F;
    B('rubber', -PX, -2.2, -PY, -3.6, 0, .015, {s: false});
    for (let i = 0; i < 8; i++) { const x = -22.6 + i * 2.35; F.P('treadmill', 'black', x, x + .85, -12.7, -10.75, 0, 1.45, 'v-', {tag: i === 0 ? 'Treadmills / ลู่วิ่ง' : null}); }
    for (let i = 0; i < 3; i++) { const x = -21.5 + i * 3.4; F.P('rack', 'steel', x, x + 1.6, -7.6, -6.4, 0, 2.2, 'v+', {tag: i === 0 ? 'Strength Racks / เครื่องเวท' : null}); F.P('weightBench', 'leather', x + .5, x + 1.1, -8.8, -7.9, 0, .45, 'v+'); }
    F.P('dumbbellRack', 'steel', -10.6, -7.0, -4.4, -3.9, 0, .95, 'v+', {tag: 'Dumbbells / ดัมเบล'});
    B('mirror', -10.6, -7.0, -3.68, -3.64, 1.0, 2.4, {s: false});
    B('glassShower', -2.24, -2.2, -PY, -3.61, 0, 2.6);
    const Y = spaceCtx(3, box, cyl, rooms, {num: '302', name: 'Yoga & Pilates Studio', x0: -2.1, x1: 8.0, y0: -PY, y1: -3.6, side: -1, eye: [3.0, -5.0], tier: 'Wellness'});
    Y.B('woodFloor', -2.1, 8.0, -PY, -3.6, 0, .015, {s: false}); Y.B('glassShower', 8.21, 8.25, -PY, -3.61, 0, 2.6, {room: 'common'});
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) Y.B(j ? 'velvetBlush' : 'velvetGreen', -1.2 + i * 2.3, -.4 + i * 2.3, -11.6 + j * 3.2, -9.6 + j * 3.2, .015, .03, {s: false, tag: i === 0 && j === 0 ? 'Yoga Mats / เสื่อโยคะ' : null});
    Y.B('mirror', -2.05, 7.9, -PY + .02, -PY + .06, .3, 2.4, {s: false});
    wallX(Y.B, -3.55, -2.2, 8.25, [[2.3, 3.3]], 'glassShower', .04);
    const SR = spaceCtx(3, box, cyl, rooms, {num: '303', name: 'Relaxation Lounge', x0: 8.3, x1: PX, y0: -PY, y1: -3.6, side: -1, eye: [16.0, -5.2], tier: 'Wellness'});
    for (let i = 0; i < 5; i++) { const x = 13.6 + i * 1.95; SR.P('lounger', 'velvetCream', x, x + .8, -12.8, -10.8, 0, .75, 'v+', {tag: i === 0 ? 'Relaxation Loungers / เตียงพักผ่อน' : null, o: {wood: 'walnut'}}); }
    sofa(SR, 9.4, 11.8, -9.0, .9, 'velvetCream', -1); coffee(SR, 10.6, -10.3, .4, .42, {tag: 'Herbal Tea Bar / ชาสมุนไพร'}); plant(SR, 23.3, -6.0, 1.5); plant(SR, 9.0, -12.6, 1.5);
    // changing rooms (entered from the gym), each with sauna + steam
    for (const [num, nm, x0, x1] of [['304', 'Changing Room (Men) · Sauna · Steam', -PX, -16.11], ['305', 'Changing Room (Women) · Sauna · Steam', -15.99, -8.31]]) {
      const Cn = spaceCtx(3, box, cyl, rooms, {num, name: nm, x0, x1, y0: -3.49, y1: PY, side: 1, eye: [x0 + 2.6, -1.0], tier: 'Wellness'});
      Cn.B('marbleFloor', x0, x1, -3.49, PY, 0, .015, {s: false});
      for (let i = 0; i < 8; i++) Cn.P('locker', 'walnut', x0 + .05, x0 + .6, -2.0 + i * .55, -1.48 + i * .55, 0, 2.1, 'u-', {tag: i === 0 ? 'Lockers / ตู้ล็อกเกอร์' : null});
      Cn.P('cushionedBench', 'leather', x0 + 1.5, x0 + 1.9, -1.4, 1.8, 0, .45, 'u+', {tag: 'Bench / ม้านั่ง'}); vanity(Cn, x0 + 4.0, x1 - .1, -3.43, 1, 2);
      for (let i = 0; i < 3; i++) { const xs = x0 + .1 + i * 1.3; Cn.B('marbleDark', xs, xs + 1.15, 4.4, 5.6, 0, .04, {tag: i === 0 ? 'Showers / ห้องอาบน้ำ' : null}); Cn.B('glassShower', xs, xs + 1.15, 4.36, 4.4, .04, 2.05); Cn.B('glassShower', xs + 1.15, xs + 1.19, 4.4, 5.6, .04, 2.05); }
      Cn.B('woodSauna', x0 + .1, x0 + 3.3, 7.0, 10.0, 0, .02, {s: false}); wallX(Cn.B, 6.95, x0 + .1, x0 + 3.4, [[x0 + 2.2, x0 + 3.0]], 'woodSauna'); wallY(Cn.B, x0 + 3.46, 6.89, 10.11, [], 'woodSauna'); wallX(Cn.B, 10.05, x0 + .1, x0 + 3.4, [], 'woodSauna');
      Cn.B('woodSauna', x0 + .15, x0 + 3.3, 9.3, 9.98, 0, .45, {tag: 'Sauna / ซาวน่า'});
      wallX(Cn.B, 6.95, x0 + 3.55, x1 - .05, [[x0 + 4.0, x0 + 4.8]], 'glassShower', .04); Cn.B('marble', x0 + 3.65, x1 - .15, 9.4, 9.95, 0, .45, {tag: 'Steam Room / ห้องอบไอน้ำ'}); wallX(Cn.B, 10.05, x0 + 3.55, x1 - .05, [], 'glassShower', .04);
      for (let i = 0; i < 2; i++) { const ys = PY - 1.3 - i * 1.3; wc(Cn, x1 - .06, ys, -1); Cn.B('walnut', x1 - 1.5, x1 - .06, ys - .68, ys - .62, 0, 2.1); }
    }
    // treatment suites (right back) along the spa corridor x 8.31..9.7
    const TR = spaceCtx(3, box, cyl, rooms, {num: '306', name: 'Treatment Rooms (5) & Couples Suite', x0: 8.31, x1: PX, y0: -3.49, y1: PY, side: 1, eye: [9.0, 1.0], tier: 'Wellness'});
    TR.B('woodFloor', 8.31, 9.7, -3.49, PY, 0, .015, {s: false});
    const xs = [9.76, 14.5, 19.2, PX];
    for (const [ya, yb] of [[-3.49, -.2], [-.2, 3.1]]) {
      for (let i = 0; i < 3; i++) { if (ya > -1 && i === 2) continue; const a = xs[i], b = xs[i + 1];
        TR.B('woodFloor', a + .06, b - .06, ya + .06, yb - .06, 0, .015, {s: false}); TR.P('massageTable', 'linen', a + 1.2, b - 1.2, (ya + yb) / 2 - .4, (ya + yb) / 2 + .4, 0, .72, 'u+', {tag: i === 0 && ya < -1 ? 'Treatment Room / ห้องนวด' : null}); TR.B('walnut', b - .7, b - .12, yb - .66, yb - .18, 0, .85); }
      wallX(TR.B, yb, 9.79, PX, []); }
    wallY(TR.B, 9.73, -3.49, 3.16, [[-2.6, -1.7], [.7, 1.6]]); for (const x of [14.5, 19.2]) { wallY(TR.B, x, -3.49, -.26); wallY(TR.B, x, -.14, 3.04); }
    wallY(TR.B, 9.73, 3.16, PY, [[4.0, 5.0]]);
    TR.B('woodFloor', 9.8, PX, 3.2, PY, 0, .015, {s: false});
    TR.P('massageTable', 'linen', 11.0, 11.9, 6.0, 8.0, 0, .72, 'v+', {tag: 'Couples Suite / ห้องสปาคู่'}); TR.P('massageTable', 'linen', 12.8, 13.7, 6.0, 8.0, 0, .72, 'v+');
    bathtub(TR, 16.5, 18.5, 9.8, 11.2, true); TR.B('marbleDark', 20.0, 21.4, 9.8, 11.4, 0, .04); TR.B('glassShower', 19.96, 20.0, 9.8, 11.4, .04, 2.05);
    sofa(TR, 15.6, 17.8, 5.0, .85, 'velvetCream', -1); plant(TR, 23.2, 4.0, 1.4);
    TR.B('steel', 8.4, 9.6, 9.0, PY - .1, 0, 2.0, {tag: 'Linen & Laundry / ห้องผ้า'});
    labels.push(['Spa Corridor / ทางเดินสปา', 9.0, 1.0, 2.3]);
    const LD = spaceCtx(3, box, cyl, rooms, {num: '307', name: 'Spa Laundry & Staff', x0: -8.13, x1: 8.13, y0: 8.1, y1: PY, side: 1, eye: [-.85, 9.6], tier: 'Back of House'});
    for (let i = 0; i < 4; i++) LD.B('steel', 1.0 + i * 1.0, 1.85 + i * 1.0, PY - .8, PY - .1, 0, 1.0, {tag: i === 0 ? 'Washers & Dryers / เครื่องซักผ้า' : null});
    for (let i = 0; i < 3; i++) LD.B('steel', -7.6 + i * 1.6, -6.2 + i * 1.6, PY - .6, PY - .1, 0, 2.0, {tag: i === 0 ? 'Staff Lockers / ล็อกเกอร์พนักงาน' : null});
  },
  18(box, cyl, rooms, labels){
    const R = spaceCtx(18, box, cyl, rooms, {num: 'R01', name: 'Sky Pool & Rooftop Bar', x0: -IX, x1: IX, y0: -IY, y1: IY, side: -1, eye: [0, -2.4], tier: 'Rooftop'});
    const {B, C} = R;
    B('deck', -IX, IX, -IY, IY, 0, .02, {s: false});
    // glass balustrade along the slab edge (not solid for the inside check)
    for (const [x0, x1, y0, y1] of [[-12.5, 12.5, -8.45, -8.4], [-12.5, 12.5, 8.4, 8.45], [-14.25, -14.2, -6.7, 6.7], [14.2, 14.25, -6.7, 6.7]]) { B('glassShower', x0, x1, y0, y1, 0, 1.15, {s: false}); B('gold', x0, x1, y0, y1, 1.15, 1.2, {s: false}); }
    // infinity pool along the river edge
    B('marble', -11.2, 5.8, -7.8, -7.5, 0, .5); B('marble', -11.2, 5.8, -3.6, -3.3, 0, .5); B('marble', -11.2, -10.9, -7.5, -3.6, 0, .5); B('marble', 5.5, 5.8, -7.5, -3.6, 0, .5);
    B('water', -10.9, 5.5, -7.5, -3.6, 0, .46, {s: false, tag: 'Infinity Sky Pool / สระอินฟินิตี้'});
    for (let i = 0; i < 8; i++) { const x = -10.6 + i * 2.0; R.P('lounger', 'linen', x, x + .75, -2.9, -1.0, 0, .75, 'v+', {tag: i === 0 ? 'Sun Loungers / เตียงอาบแดด' : null}); if (i % 2 === 1 && i < 7) R.Pc('umbrella', 'linen', x + 1.375, -2.4, .5, .5, 0, 2.6, 'v+', {round: true, s: false}); }
    // bar (east)
    B('walnut', 9.0, 9.8, -6.6, -1.4, 0, 1.08, {tag: 'Rooftop Bar / บาร์ดาดฟ้า'}); B('marbleBlack', 8.95, 9.85, -6.65, -1.35, 1.08, 1.13, {s: false}); B('walnut', 11.6, 12.2, -6.6, -1.4, 0, 1.0); R.P('barShelf', 'walnut', 11.6, 12.2, -6.6, -1.4, 1.0, 2.4, 'u+');
    stools(R, Array.from({length: 6}, (_, i) => [8.4, -6.2 + i * .9]));
    // cabanas + lounge (back, around the core)
    for (const x of [-12.6, 10.6]) { R.P('daybed', 'linen', x, x + 2.0, 1.8, 3.8, 0, .75, 'v+', {tag: x < 0 ? 'Cabana / คาบาน่า' : null}); for (const [dx, dy] of [[0, 1.6], [2.0, 1.6], [0, 4.0], [2.0, 4.0]]) C('gold', x + dx, dy, .04, 0, 2.6, {s: false}); R.P('curtain', 'sheer', x, x + 2.0, 3.99, 4.05, .02, 2.6, 'v+', {s: false, o: {lambda: .16}}); B('gold', x, x + 2.0, 1.58, 1.62, 2.58, 2.62, {s: false}); B('gold', x, x + 2.0, 3.98, 4.02, 2.58, 2.62, {s: false}); }
    [[-2.6, -0.2], [2.6, -0.2]].forEach(([x, y]) => { coffee(R, x, y, .45); armchair(R, x - 1.25, y, 'velvetNavy', 1, [x, y]); armchair(R, x + 1.25, y, 'velvetNavy', 1, [x, y]); });
    for (const x of [-13.3, 13.3]) for (const y of [-6.0, 0.6]) plant(R, x, y, 1.5);
    for (const y of [-5.6, -2.6]) { R.Pc('cocktailTable', 'marbleBlack', 6.9, y, .7, .7, 0, 1.05, 'v+', {round: true}); stools(R, [[6.9, y - .75], [6.9, y + .75]], .75); }
    labels.push(['River View Deck / จุดชมวิวแม่น้ำ', 0, -7.9, 1.6]);
  }
};
