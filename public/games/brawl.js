/* BLACKTOP BRAWL — cartoon highway racing for 1–4 riders, on one screen or online.
   The bike rides itself: hold RIGHT to floor it, LEFT to brake, UP/DOWN to change lane.
   FIRE bonks whoever is alongside (foam glove, pool noodle or squeaky mallet).
   DOWN + FIRE hops potholes, cones, beach balls and even cars.
   Nobody gets hurt: bonked riders wobble, tumble off and pop straight back up.
   All art, music and sound are original and drawn in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants (world units: "wu") ---------- */
const VW = 384, VH = 216;
const LANE_H = 13, BOTTOM = 18, WB = 15;
const FONT = '"Silkscreen","Courier New",monospace';

const DIFF = {
  kids:   { label: 'Kids',   cpuBonk: 0,     carTumble: false, wob: 0,   cpu: 0.8,  heatBoost: 12, hole: 0.85, slick: 0.85, limit: 0,  hopCd: 0.5, crash: 0.8 },
  normal: { label: 'Normal', cpuBonk: 0.012, carTumble: true,  wob: 1,   cpu: 0.94, heatBoost: 22, hole: 0.6,  slick: 0.7,  limit: 30, hopCd: 0.8, crash: 1.3 },
  pro:    { label: 'Pro',    cpuBonk: 0.022, carTumble: true,  wob: 1.3, cpu: 1.0,  heatBoost: 30, hole: 0.5,  slick: 0.6,  limit: 20, hopCd: 0.9, crash: 1.3 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];
const CPU_RIVALS = [
  { name: 'Ratchet', color: '#e9ecf1' }, { name: 'Noodles', color: '#e2463c' }, { name: 'Bronco', color: '#9b7bff' }, { name: 'Zippy', color: '#7fcf5a' }
];

/* Weapons and items. Everything is soft and silly. */
const SWING = ['glove', 'noodle', 'mallet'];
const ITEMS = ['', 'noodle', 'mallet'];
const REACH = { glove: 18, noodle: 28, mallet: 22 };
const POWER = { glove: 24, noodle: 32, mallet: 60, rocket: 20 };
const USES = { noodle: 4, mallet: 3 };
const AIR = { hop: [0.55, 10], ramp: [1.0, 24], boing: [0.5, 9], bigboing: [0.75, 17] };

/* ---------- Routes ----------
   Each route is generated from a seed, so the host and every guest build exactly the same road.
   Traffic moves at a fixed speed per lane, so cars never overlap and their position is just
   x0 + speed × time: guests work it out from the clock instead of receiving it. */
const ROUTES = [
  { name: 'Sunset Coast', seed: 1207, len: 8400, look: 'coast', sky: ['#ff8a5c', '#ffd9a0'], road: '#3b3c46', edge: '#f4efe2', side: '#e3c98f', slick: 'oil',
    traffic: [54, 70, 62, 76], gap: 1.0, mix: { car: 6, truck: 2, bus: 1, van: 2, hole: 3, slick: 2, cones: 3, ball: 3, ramp: 2, pad: 2, gift: 3 } },
  { name: 'Neon City', seed: 3301, len: 8800, look: 'city', night: true, sky: ['#0b1030', '#2a2360'], road: '#262734', edge: '#ffd166', side: '#2c3142', slick: 'oil',
    traffic: [58, 72, 66, 80], gap: 0.9, mix: { car: 8, truck: 2, bus: 2, van: 1, hole: 3, slick: 3, cones: 3, ball: 1, ramp: 2, pad: 3, gift: 3 } },
  { name: 'Canyon Run', seed: 5519, len: 9000, look: 'canyon', sky: ['#f2a65a', '#fde3b0'], road: '#5b4d42', edge: '#f4efe2', side: '#c9955b', slick: 'mud',
    traffic: [50, 66, 58, 72], gap: 1.0, mix: { car: 5, truck: 3, bus: 1, van: 1, hole: 4, slick: 3, cones: 2, ball: 2, ramp: 4, pad: 2, gift: 3 } },
  { name: 'Snowy Pass', seed: 7741, len: 9200, look: 'snow', snow: true, sky: ['#8fb8e8', '#e6f0fa'], road: '#4a4f5c', edge: '#ffd166', side: '#eef3f8', slick: 'ice',
    traffic: [48, 64, 56, 70], gap: 0.95, mix: { car: 6, truck: 2, bus: 1, van: 1, hole: 2, slick: 5, cones: 3, ball: 2, ramp: 3, pad: 2, gift: 3 } }
];
const VEH = { car: { len: 16, h: 8 }, van: { len: 19, h: 10 }, truck: { len: 26, h: 12 }, bus: { len: 30, h: 12 } };
const CAR_COLS = ['#e2463c', '#3f8fe0', '#f5c542', '#3fd0b0', '#9b7bff', '#ff7eb6', '#e9ecf1', '#ff9f43'];
const CRUISE = 180;

function mulberry(seed){
  return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function buildRoute(def){
  const rnd = mulberry(def.seed);
  const R = { def, finish: def.len, traffic: [], holes: [], slicks: [], cones: [], balls: [], ramps: [], pads: [], gifts: [], rid: 0 };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const lanes = n => { const l = [0, 1, 2, 3]; for(let i = 3; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); const t = l[i]; l[i] = l[j]; l[j] = t; } return l.slice(0, n); };
  const kinds = Object.keys(def.mix), total = kinds.reduce((a, k) => a + def.mix[k], 0);
  const laneEnd = [0, 0, 0, 0];
  let gid = 0, cid = 0, vid = 0;
  const gifts = (x, ls) => ls.forEach(l => R.gifts.push({ id: gid++, x, lane: l, back: 0 }));
  gifts(420, [0, 1, 2, 3]);
  let x = 580;
  while(x < def.len - 320){
    let w = rnd() * total, k = kinds[0];
    for(const kk of kinds){ w -= def.mix[kk]; if(w < 0){ k = kk; break; } }
    if(VEH[k]){
      const l = Math.floor(rnd() * 4), vx = def.traffic[l];
      // start it far enough ahead that a rider at cruising speed meets it around x
      const x0 = Math.max(x * (CRUISE - vx) / CRUISE, laneEnd[l]);
      R.traffic.push({ id: vid++, kind: k, lane: l, x0, vx, col: pick(CAR_COLS) });
      laneEnd[l] = x0 + VEH[k].len + 34;
    } else if(k === 'hole') lanes(rnd() < 0.4 ? 2 : 1).forEach(l => R.holes.push({ x: x + rnd() * 10, lane: l }));
    else if(k === 'slick'){ const l = Math.floor(rnd() * 3); R.slicks.push({ x, x2: x + 45 + rnd() * 35, lanes: rnd() < 0.5 ? [l] : [l, l + 1] }); }
    else if(k === 'cones'){ const l = Math.floor(rnd() * 4); for(let i = 0; i < 3; i++) R.cones.push({ id: cid++, x: x + i * 10, lane: l, hit: false }); }
    else if(k === 'ball') R.balls.push({ x, ph: rnd() * 6.28, w: 0.9 + rnd() * 0.8 });
    else if(k === 'ramp') R.ramps.push({ x, lane: Math.floor(rnd() * 4) });
    else if(k === 'pad') R.pads.push({ x, x2: x + 40, lane: Math.floor(rnd() * 4) });
    else if(k === 'gift') gifts(x, lanes(rnd() < 0.5 ? 3 : 2));
    x += (80 + rnd() * 70) * def.gap;
  }
  return R;
}
let RT = null;
const vehX = v => v.x0 + v.vx * G.simT;
const ballLane = (b, t) => Math.max(0, Math.min(3, 1.5 + 1.9 * Math.sin(t * b.w + b.ph)));
const ballH = (b, t) => Math.abs(Math.sin(t * 5 + b.ph)) * 7;
const inSlick = (x, lane) => RT.slicks.some(z => x >= z.x && x <= z.x2 && z.lanes.includes(Math.round(lane)));

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('brawl.diff', 'normal'), routeIx: 0, rivals: A.Store.get('brawl.rivals', true),
  riders: [], players: [], time: 0, stateT: 0, raceT: 0, simT: 0, raceId: 0, firstFinish: -1, net: null, results: null
};
if(!DIFF[G.diff]) G.diff = 'normal';
const D = () => DIFF[G.diff];
let netSfx = [];
const S = name => { if(G.demo) return; A.Sound.play(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name); };

/* Game sounds: cartoon bonks, boings and slide whistles */
const SX = {
  bonk:    s => { s.tone({ wave: 'triangle', f: 560, f2: 170, t: 0.12, v: 0.22 }); s.tone({ f: 1250, f2: 900, t: 0.035, v: 0.05 }); },
  noodle:  s => { s.noise({ t: 0.12, v: 0.16, f: 900, f2: 250 }); s.tone({ wave: 'sine', f: 320, f2: 150, t: 0.15, v: 0.18 }); },
  squeak:  s => { s.tone({ f: 1400, f2: 2300, t: 0.07, v: 0.06 }); s.tone({ f: 2300, f2: 1500, t: 0.09, v: 0.06, at: 0.07 }); s.tone({ wave: 'triangle', f: 420, f2: 150, t: 0.12, v: 0.16 }); },
  swing:   s => s.noise({ t: 0.1, v: 0.06, f: 3200, f2: 900, type: 'bandpass' }),
  boing:   s => s.tone({ wave: 'triangle', f: 170, f2: 640, t: 0.3, v: 0.16, vib: true }),
  tumble:  s => { s.tone({ wave: 'sine', f: 1500, f2: 280, t: 0.6, v: 0.12 }); s.noise({ t: 0.25, v: 0.1, f: 900, f2: 200, at: 0.1 }); },
  backOn:  s => s.melody([[523, .06], [784, .06], [1047, .1]], { wave: 'triangle', v: 0.1 }),
  hop:     s => s.tone({ f: 300, f2: 900, t: 0.16, v: 0.07 }),
  whee:    s => s.tone({ wave: 'sine', f: 380, f2: 1700, t: 0.5, v: 0.12 }),
  land:    s => s.noise({ t: 0.12, v: 0.12, f: 900, f2: 200 }),
  zoom:    s => { s.tone({ wave: 'sawtooth', f: 200, f2: 900, t: 0.35, v: 0.06 }); s.noise({ t: 0.3, v: 0.07, f: 5000, f2: 1500, type: 'highpass' }); },
  gift:    s => s.melody([[880, .05], [1175, .05], [1568, .1]], { v: 0.1 }),
  rocket:  s => { s.noise({ t: 0.7, v: 0.16, f: 2500, f2: 500 }); s.tone({ wave: 'sawtooth', f: 150, f2: 520, t: 0.5, v: 0.07 }); },
  shield:  s => s.melody([[660, .05], [990, .05], [1320, .12]], { wave: 'triangle', v: 0.11 }),
  pop:     s => { s.tone({ wave: 'sine', f: 900, f2: 200, t: 0.08, v: 0.2 }); s.noise({ t: 0.06, v: 0.1, f: 4000 }); },
  cone:    s => s.tone({ wave: 'triangle', f: 720, f2: 340, t: 0.08, v: 0.12 }),
  pothole: s => { s.noise({ t: 0.14, v: 0.18, f: 600, f2: 120 }); s.tone({ wave: 'sine', f: 130, f2: 60, t: 0.12, v: 0.2 }); },
  slick:   s => s.noise({ t: 0.3, v: 0.12, f: 2400, f2: 500, type: 'bandpass' }),
  beep:    s => { s.tone({ f: 440, t: 0.09, v: 0.06 }); s.tone({ f: 350, t: 0.13, v: 0.06, at: 0.11 }); },
  overheat: s => { for(let i = 0; i < 3; i++) s.tone({ f: 1760, t: 0.08, v: 0.08, at: i * 0.16 }); },
  finish:  s => s.melody([[523, .1], [659, .1], [784, .1], [1047, .3]], { v: 0.12 }),
  pass:    s => s.melody([[880, .05], [1320, .09]], { v: 0.07 }),
  stretch: s => s.melody([[659, .08], [784, .08], [1047, .2]], { v: 0.1 }),
  lane:    s => s.tone({ f: 320, f2: 380, t: 0.05, v: 0.04, wave: 'triangle' })
};
function sfx(name){ if(G.demo) return; const f = SX[name]; if(f) try{ f(A.Sound); }catch(e){} if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('~' + name); }
function playNetSfx(n){ if(n[0] === '~'){ const f = SX[n.slice(1)]; if(f) try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* Music: an original bouncy road-rock theme */
const BRAWL_THEME = {
  bpm: 150, chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'], bass: 'drive', arp: 'fast', leadVol: 0.072,
  lead: [
    'G5 - B5 - D6 - - - B5 - G5 - A5 - B5 -', 'E5 - - - G5 - B5 - G5 - E5 - F#5 - G5 -',
    'C6 - - - B5 - A5 - G5 - E5 - G5 - A5 -', 'A5 - - - - - F#5 - D5 - F#5 - A5 - C6 -',
    'B5 - D6 - B5 - G5 - B5 - - - A5 - G5 -', 'E5 - G5 - E5 - B4 - E5 - G5 - B5 - - -',
    'C6 - B5 - C6 - E6 - D6 - C6 - B5 - A5 -', 'D6 - - - C6 - B5 - A5 - - - F#5 - - -'],
  drums: ['k.h.s.hkk.h.s.h.', 'k.h.s.hkk.hks.hs', 'k.h.s.hkk.h.s.h.', 'k.hkskhkk.hks.ss']
};

/* ---------- Riders ---------- */
let nextId = 1;
function makeRider(o){
  return Object.assign({ id: nextId++, x: 0, lane: 0, target: 0, vx: 0, h: 0, air: null, wob: 0, wobT: 9, heat: 0, overT: 0, crashT: 0, invT: 0, hitT: 0,
    attackT: 0, attackCd: 0, swing: 0, hopCd: 0, item: '', uses: 0, rocketT: 0, shieldT: 0, padT: 0, bumpT: 0, beepT: 0, slick: false, laneCd: 0, pendDown: 0,
    boost: false, brake: false, skill: { speed: 1, heat: 70 }, fin: -1, msg: '', msgT: 0, lastPlace: 0, stretch: false, stats: { bonks: 0, tumbles: 0, airs: 0, gifts: 0 } }, o);
}
function setMsg(r, msg){ r.msg = msg; r.msgT = 1.1; }
const NONE = { boost: false, brake: false, up: false, down: false, upP: false, downP: false, fireP: false };

function controls(r){
  if(r.cpu || G.bot) return cpuControls(r);     // G.bot: test hook, humans drive themselves
  const s = A.Input.get(r.source), on = !!(s && s.connected);
  return {
    boost: on && s.right, brake: on && s.left, up: on && s.up, down: on && s.down,
    upP: on && A.Input.pressed(s, 'up'), downP: on && A.Input.pressed(s, 'down'), fireP: on && A.Input.pressed(s, 'fire')
  };
}
/* How bad is lane l for the next stretch of road? (negative = something good ahead) */
function laneDanger(r, l){
  if(l < 0 || l > 3) return 99;
  const a = r.x + 6, b = r.x + 44 + r.vx * 0.45;
  let v = 0;
  for(const h of RT.holes) if(h.lane === l && h.x > a && h.x < b) v += 2;
  for(const z of RT.slicks) if(z.lanes.includes(l) && z.x2 > a && z.x < b) v += 1.5;
  for(const k of RT.cones) if(!k.hit && k.lane === l && k.x > a && k.x < b){ v += 1; break; }
  for(const t of RT.traffic) if(t.lane === l){ const tx = vehX(t); if(tx + VEH[t.kind].len > a - 8 && tx < b + 12) v += 4; }
  for(const bl of RT.balls) if(bl.x > a && bl.x < b && Math.abs(ballLane(bl, G.simT + (bl.x - r.x) / Math.max(60, r.vx)) - l) < 0.9) v += 1.5;
  for(const p of RT.pads) if(p.lane === l && p.x > a && p.x < b + 40) v -= 1;
  for(const p of RT.ramps) if(p.lane === l && p.x > a && p.x < b + 40) v -= 0.8;
  if(!r.item) for(const g of RT.gifts) if(g.lane === l && g.back <= G.simT && g.x > a && g.x < b + 30) v -= 0.6;
  return v;
}
function hazardClose(r, l){
  const a = r.x + 8, b = r.x + 34;
  if(RT.holes.some(h => h.lane === l && h.x > a && h.x < b)) return true;
  if(RT.cones.some(k => !k.hit && k.lane === l && k.x > a && k.x < b)) return true;
  return RT.traffic.some(t => t.lane === l && vehX(t) > a - 4 && vehX(t) < b);
}
function cpuControls(r){
  const c = Object.assign({}, NONE);
  const cur = r.target;
  const here = laneDanger(r, cur);
  if(r.laneCd <= 0){
    const up = laneDanger(r, cur + 1), dn = laneDanger(r, cur - 1);
    const best = up < dn || (up === dn && Math.random() < 0.5) ? [cur + 1, up] : [cur - 1, dn];
    if(best[1] < here - 0.5){ if(best[0] > cur) c.upP = true; else c.downP = true; r.laneCd = 0.3 + Math.random() * 0.25; }
  }
  if(!r.air && r.hopCd <= 0 && here >= 1 && hazardClose(r, cur) && Math.random() < (G.diff === 'kids' ? 0.5 : 0.25)){ c.fireP = true; c.down = true; }
  c.boost = r.heat < r.skill.heat && r.overT <= 0 && here < 1;
  const bonk = D().cpuBonk;
  if(bonk && !c.fireP && r.attackCd <= 0 && Math.random() < bonk && findTarget(r, REACH[r.item || 'glove'])) c.fireP = true;
  return c;
}
/* Rubber band: rivals ease off when far ahead of every human and push when far behind. */
function band(r){
  const hum = G.riders.filter(q => q.human && q.fin < 0);
  if(!hum.length) return 1;
  let lead = -1e9, back = 1e9;
  for(const q of hum){ lead = Math.max(lead, q.x); back = Math.min(back, q.x); }
  const ahead = r.x - lead, behind = back - r.x;
  if(ahead > 120) return Math.max(G.diff === 'kids' ? 0.62 : 0.7, 1 - (ahead - 120) / (G.diff === 'kids' ? 900 : 1400));
  if(behind > 150) return Math.min(1.15, 1 + (behind - 150) / 1500);
  return 1;
}

function findTarget(r, reach){
  let best = null, bestD = 1e9;
  for(const q of G.riders){
    if(q === r || q.crashT > 0 || q.invT > 0.3 || q.fin >= 0) continue;
    const dl = Math.abs(q.lane - r.lane); if(dl > 1.15) continue;
    const dx = q.x - r.x; if(dx < -12 || dx > reach) continue;
    const d = Math.abs(dx) + dl * 10;
    if(d < bestD){ bestD = d; best = q; }
  }
  return best;
}
function attack(r){
  const w = r.item || 'glove';
  r.attackT = 0.25; r.attackCd = w === 'mallet' ? 0.6 : 0.45; r.swing = SWING.indexOf(w);
  const t = findTarget(r, REACH[w]);
  if(!t){ if(!r.cpu) sfx('swing'); return; }
  bonk(r, t, w);
  if(r.item && --r.uses <= 0){ r.item = ''; r.uses = 0; }
}
function bonk(a, t, w){
  a.stats.bonks++;
  if(t.shieldT > 0){ t.shieldT = 0; t.invT = 0.6; setMsg(t, 'BLOCKED!'); sfx('pop'); return; }
  const d = D();
  t.hitT = 0.4; t.invT = Math.max(t.invT, 0.25);
  t.vx = Math.max(40, t.vx - (w === 'mallet' ? 80 : 50) * (d.wob ? 1 : 0.6));
  if(w === 'noodle' || w === 'mallet'){    // a good bonk scoots them over a lane
    const dir = t.lane > a.lane + 0.2 ? 1 : t.lane < a.lane - 0.2 ? -1 : (t.target < 3 ? 1 : -1);
    t.target = Math.max(0, Math.min(3, t.target + dir));
  }
  setMsg(t, w === 'mallet' ? 'SQUEAK!' : w === 'rocket' ? 'OOF!' : 'BONK!');
  sfx(w === 'mallet' ? 'squeak' : w === 'noodle' ? 'noodle' : 'bonk');
  addWob(t, POWER[w] * d.wob);
}
function addWob(r, n){
  if(!n || r.crashT > 0) return;
  r.wob += n; r.wobT = 0;
  if(r.wob >= 100) tumble(r, 'TUMBLE!');
}
function tumble(r, why){
  if(r.crashT > 0) return;
  r.crashT = D().crash; r.air = null; r.h = 0; r.boost = false; r.rocketT = 0; r.padT = 0; r.pendDown = 0;
  r.stats.tumbles++; setMsg(r, why || 'TUMBLE!'); sfx('tumble');
}
function startAir(r, kind){
  const [dur, peak] = AIR[kind];
  r.air = { t: 0, dur, peak }; r.pendDown = 0;
  if(kind === 'hop'){ r.hopCd = D().hopCd; r.stats.airs++; if(!r.cpu) sfx('hop'); }
  else if(kind === 'ramp'){ r.vx = Math.max(r.vx, 215); r.stats.airs++; setMsg(r, 'WHEE!'); sfx('whee'); }
  else { setMsg(r, 'BOING!'); sfx('boing'); }
}
function rollItem(r){
  const n = G.riders.length, back = n > 1 ? (place(r) - 1) / (n - 1) : 0;    // 0 = leading, 1 = last
  const w = { noodle: 3 - back * 1.5, mallet: 2, bubble: 3 - back, rocket: 0.5 + back * 4 };
  if(r.item){ w.noodle = 0; w.mallet = 0; }
  let sum = 0; for(const k in w) sum += w[k];
  let p = Math.random() * sum;
  for(const k in w){ p -= w[k]; if(p < 0) return k; }
  return 'bubble';
}
function giveItem(r){
  const it = rollItem(r);
  r.stats.gifts++;
  if(it === 'rocket'){ r.rocketT = 2.4; r.heat = 0; r.overT = 0; setMsg(r, 'ROCKET!'); sfx('rocket'); }
  else if(it === 'bubble'){ r.shieldT = 12; setMsg(r, 'BUBBLE!'); sfx('shield'); }
  else { r.item = it; r.uses = USES[it]; setMsg(r, it.toUpperCase() + '!'); sfx('gift'); }
}

function stepRider(r, dt){
  for(const k of ['msgT', 'invT', 'hitT', 'attackT', 'attackCd', 'hopCd', 'rocketT', 'shieldT', 'padT', 'bumpT', 'beepT', 'laneCd']) if(r[k] > 0) r[k] -= dt;
  r.wobT += dt;
  if(r.wobT > 1.2 && r.wob > 0) r.wob = Math.max(0, r.wob - 12 * dt);
  if(r.crashT > 0){
    r.crashT -= dt; r.vx = Math.max(0, r.vx - 170 * dt); r.x += r.vx * dt;
    if(r.crashT <= 0){ r.crashT = 0; r.invT = 1.4; r.wob = 0; r.heat = Math.min(r.heat, 30); r.overT = 0; setMsg(r, 'BACK ON!'); sfx('backOn'); }
    return;
  }
  const racing = G.state === 'race' || G.state === 'finishing' || G.demo || r.fin >= 0;
  const c = racing ? controls(r) : NONE;
  const d = D();

  // FIRE: bonk, or hop when DOWN is held (a quick DOWN tap waits a moment so DOWN+FIRE never changes lane)
  let hopped = false;
  if(c.fireP){
    if(c.down || r.pendDown > 0){ r.pendDown = 0; hopped = true; if(!r.air && r.hopCd <= 0) startAir(r, 'hop'); }
    else if(r.attackCd <= 0) attack(r);
  }
  if(c.upP && r.target < 3){ r.target++; r.pendDown = 0; if(!r.cpu) sfx('lane'); }
  else if(c.downP && !hopped && r.target > 0){ if(r.cpu) r.target--; else r.pendDown = 0.1; }
  if(r.pendDown > 0){ r.pendDown -= dt; if(r.pendDown <= 0 && r.target > 0){ r.target--; sfx('lane'); } }
  if(r.lane !== r.target){ const dl = Math.sign(r.target - r.lane) * 5.5 * dt; r.lane = Math.abs(r.target - r.lane) <= Math.abs(dl) ? r.target : r.lane + dl; }

  // engine temperature
  r.boost = !!c.boost && r.hitT <= 0; r.brake = !!c.brake;
  if(r.rocketT > 0 || r.padT > 0) r.heat = Math.max(0, r.heat - 40 * dt);
  else if(r.overT > 0){ r.overT -= dt; r.heat = Math.max(40, r.heat - 22 * dt); }
  else if(r.boost) r.heat += (r.cpu ? 18 : d.heatBoost) * dt;
  else r.heat = Math.max(0, r.heat - 16 * dt);
  if(r.heat >= 100){ r.heat = 100; r.overT = 1.8; setMsg(r, 'OVERHEAT!'); sfx('overheat'); }

  // speed
  const lane = Math.round(r.lane);
  const onSlick = !r.air && r.rocketT <= 0 && inSlick(r.x + 8, r.lane);
  if(onSlick && !r.slick){ setMsg(r, RT.def.slick === 'ice' ? 'ICY!' : 'SLIPPY!'); sfx('slick'); }
  r.slick = onSlick;
  let target = r.overT > 0 ? 70 : r.brake ? 85 : r.boost ? 232 : 175;
  if(r.cpu) target *= r.skill.speed * band(r);
  if(r.padT > 0) target = 265;
  if(r.rocketT > 0) target = 300;
  if(onSlick) target *= d.slick;
  if(r.hitT > 0) target = Math.min(target, 110);
  if(r.fin >= 0) target = 130;
  const acc = r.vx < target ? (r.rocketT > 0 || r.padT > 0 ? 420 : 140) : -110;
  r.vx = r.vx < target ? Math.min(target, r.vx + acc * dt) : Math.max(target, r.vx + acc * dt);
  r.x += r.vx * dt;
  if(onSlick) addWob(r, 10 * d.wob * dt);

  // hops and jumps
  if(r.air){
    r.air.t += dt;
    const u = r.air.t / r.air.dur;
    if(u >= 1){ r.air = null; r.h = 0; if(!r.cpu) sfx('land'); }
    else r.h = r.air.peak * 4 * u * (1 - u);
  }

  // things on the road (skipped in the air; potholes and friends leave you alone right after a tumble)
  if(!r.air){
    const fx = r.x + 8;
    const ramp = RT.ramps.find(p => p.lane === lane && fx + 4 > p.x && fx + 4 < p.x + 14);
    if(ramp){ startAir(r, 'ramp'); }
    else {
      const pad = RT.pads.find(p => p.lane === lane && fx > p.x && fx < p.x2);
      if(pad){ if(r.padT <= 0){ setMsg(r, 'ZOOM!'); sfx('zoom'); } r.padT = 1.2; }
      if(r.bumpT <= 0 && r.invT <= 0 && r.rocketT <= 0 && RT.holes.some(h => h.lane === lane && Math.abs(h.x - fx) < 7)){
        r.vx *= d.hole; r.bumpT = 0.5; addWob(r, 18 * d.wob); setMsg(r, 'BUMP!'); sfx('pothole');
      }
      for(const k of RT.cones) if(!k.hit && k.lane === lane && Math.abs(k.x - (fx + 2)) < 5){
        k.hit = true; if(r.rocketT <= 0){ r.vx *= 0.88; setMsg(r, 'OOPS!'); } sfx('cone');
      }
      if(r.bumpT <= 0 && r.invT <= 0) for(const b of RT.balls) if(Math.abs(b.x - fx) < 7 && Math.abs(ballLane(b, G.simT) - r.lane) < 0.55){
        startAir(r, 'boing'); r.vx *= 0.8; r.bumpT = 0.6; break;
      }
    }
  }
  for(const g of RT.gifts) if(g.back <= G.simT && g.lane === lane && Math.abs(g.x - (r.x + 8)) < 7 && r.h < 8){ g.back = G.simT + 3; giveItem(r); }

  // callouts and finishing
  if(r.human && !r.stretch && r.x > RT.finish * 0.85 && G.state === 'race'){ r.stretch = true; setMsg(r, 'FINAL STRETCH!'); sfx('stretch'); }
  if(r.fin < 0 && r.x >= RT.finish && G.state === 'race'){
    r.fin = G.raceT; setMsg(r, place(r) === 1 ? 'WINNER!' : 'FINISH!');
    if(!r.cpu){ sfx('finish'); if(G.firstFinish < 0) G.firstFinish = G.raceT; }
  }
}
function trafficCollisions(){
  for(const r of G.riders){
    if(r.crashT > 0 || r.air || r.fin >= 0) continue;
    const lane = Math.round(r.lane);
    for(const v of RT.traffic){
      if(v.lane !== lane) continue;
      const vx = vehX(v);
      if(!(r.x + WB + 1 > vx && r.x < vx + VEH[v.kind].len)) continue;
      if(r.rocketT > 0){ if(r.beepT <= 0){ r.beepT = 1; sfx('beep'); } continue; }
      if(r.invT > 0) continue;
      if(r.shieldT > 0){ r.shieldT = 0; r.invT = 0.5; startAir(r, 'bigboing'); setMsg(r, 'BLOCKED!'); sfx('pop'); r.vx = Math.max(r.vx, v.vx + 80); }
      else if(D().carTumble){ tumble(r, 'BOING!'); r.vx = Math.min(r.vx, v.vx * 0.5); sfx('beep'); }
      else { startAir(r, 'bigboing'); r.vx = Math.max(r.vx * 0.8, v.vx + 75); }
      break;
    }
  }
}
function rocketRams(){
  for(const r of G.riders) if(r.rocketT > 0 && r.crashT <= 0)
    for(const q of G.riders) if(q !== r && q.crashT <= 0 && q.invT <= 0 && q.fin < 0 && Math.abs(q.lane - r.lane) < 0.6 && q.x - r.x > 0 && q.x - r.x < 14) bonk(r, q, 'rocket');
}
function place(r){
  const sorted = G.riders.slice().sort((a, b) => (a.fin >= 0 && b.fin >= 0) ? a.fin - b.fin : (a.fin >= 0 ? -1 : b.fin >= 0 ? 1 : b.x - a.x));
  return sorted.indexOf(r) + 1;
}

/* ---------- Cosmetic effects: worked out from rider state, so guests see them too ---------- */
let parts = [];
const fxPrev = new Map();
const CONFETTI = ['#f5c542', '#e2463c', '#3fd0b0', '#7aa8ff', '#ff7eb6', '#f4efe2'];
function burst(x, lane, h, n, col, kind){
  for(let i = 0; i < n; i++) parts.push({ x, lane, h, vx: (Math.random() - 0.4) * 90, vh: Math.random() * 70 + 15, t: 0, life: 0.45 + Math.random() * 0.4, col: Array.isArray(col) ? col[i % col.length] : col, r: 1 + Math.random() * 1.4, kind: kind || 'sq', rot: Math.random() * 6 });
  if(parts.length > 320) parts.splice(0, parts.length - 320);
}
function fxStep(dt){
  for(const r of G.riders){
    const p = fxPrev.get(r.id) || { crash: 0, hit: 0, h: 0, fin: -1, pad: 0 };
    if(!G.demo || Math.random() < 0.5){
      if(r.crashT > 0 && p.crash <= 0) burst(r.x + 8, r.lane, 10, 12, ['#f5c542', '#fff3b0', '#ffffff'], 'star');
      if(r.hitT > p.hit + 0.05) burst(r.x + 10, r.lane, 16, 7, ['#f5c542', '#ffffff', '#ff9f43'], 'star');
      if(r.h > 0.5 && p.h <= 0.5) burst(r.x + 4, r.lane, 0, 5, '#d8c8a8');
      if(r.h <= 0.5 && p.h > 2) burst(r.x + 8, r.lane, 0, 7, '#d8c8a8');
    }
    if(r.fin >= 0 && p.fin < 0 && !G.demo) for(let i = 0; i < (r.human ? 40 : 12); i++) parts.push({ x: r.x + 8, lane: r.lane, h: 16, vx: (Math.random() - 0.5) * 140, vh: 40 + Math.random() * 110, t: 0, life: 1 + Math.random() * 0.8, col: CONFETTI[i % CONFETTI.length], r: 1.4, kind: 'sq', rot: 0 });
    if(r.crashT <= 0 && !r.air){
      if(r.boost && r.vx > 150 && Math.random() < 0.5) parts.push({ x: r.x - 2, lane: r.lane, h: 2, vx: -r.vx * 0.3 - 20, vh: 12, t: 0, life: 0.3, col: '#ff9f43', r: 1, kind: 'sq', rot: 0 });
      if(r.slick && Math.random() < 0.5) parts.push({ x: r.x + 2, lane: r.lane, h: 1, vx: -30, vh: 20 + Math.random() * 20, t: 0, life: 0.35, col: RT.def.slick === 'ice' ? '#dff4ff' : RT.def.slick === 'mud' ? '#6b4a2f' : '#3a3550', r: 1.2, kind: 'sq', rot: 0 });
    }
    if(r.rocketT > 0 && Math.random() < 0.9) parts.push({ x: r.x - 4, lane: r.lane, h: r.h + 5, vx: -r.vx * 0.2 - 60, vh: (Math.random() - 0.5) * 30, t: 0, life: 0.35, col: Math.random() < 0.5 ? '#ffd166' : '#ff7a3c', r: 1.6, kind: 'sq', rot: 0 });
    if(r.overT > 0 && Math.random() < 0.4) parts.push({ x: r.x + 7, lane: r.lane, h: r.h + 8, vx: -10, vh: 30, t: 0, life: 0.8, col: 'rgba(210,210,210,.7)', r: 2.2, kind: 'sq', rot: 0 });
    fxPrev.set(r.id, { crash: r.crashT, hit: r.hitT, h: r.h, fin: r.fin });
  }
  for(const k of RT.cones) if(k.hit && !k.flew){ k.flew = true; parts.push({ x: k.x, lane: k.lane, h: 2, vx: 70 + Math.random() * 40, vh: 70 + Math.random() * 30, t: 0, life: 0.9, col: '#ff7a1a', r: 1, kind: 'cone', rot: 0 }); }
  for(const q of parts){ q.t += dt; q.x += q.vx * dt; q.h = Math.max(0, q.h + q.vh * dt); q.vh -= 170 * dt; q.rot += dt * 9; }
  parts = parts.filter(q => q.t < q.life);
}

/* ---------- Race flow ---------- */
function setupRace(humans){
  RT = buildRoute(ROUTES[G.routeIx]);
  RT.rid = ++G.raceId;
  G.riders = [];
  humans.forEach((p, i) => G.riders.push(makeRider({ human: true, source: p.source, name: p.name, color: p.color, slot: p.slot, lane: i % 4, target: i % 4 })));
  if((G.rivals || G.demo) && G.riders.length < 4){
    for(let k = G.riders.length, j = 0; k < 4; k++, j++) G.riders.push(cpuRider(j));
  }
  G.riders.forEach((r, i) => { r.x = -i * 6; });
  G.raceT = 0; G.simT = 0; G.firstFinish = -1; G.results = null; parts = []; fxPrev.clear();
}
function cpuRider(j){
  const c = CPU_RIVALS[j % CPU_RIVALS.length], d = D();
  const lanes = [0, 1, 2, 3].filter(l => !G.riders.some(r => r.target === l));
  const lane = lanes.length ? lanes[0] : j % 4;
  return makeRider({ cpu: true, name: c.name, color: c.color, slot: 10 + j, lane, target: lane,
    skill: { speed: d.cpu * (0.95 + j * 0.03), heat: G.diff === 'pro' ? 85 : G.diff === 'normal' ? 72 : 55 } });
}
function startDemo(){
  G.demo = true; G.state = G.state === 'race' ? 'title' : G.state; G.players = [];
  G.routeIx = Math.floor(Math.random() * ROUTES.length);
  setupRace([]);
  for(const r of G.riders){ r.skill.speed = 0.9 + Math.random() * 0.08; r.x = Math.random() * 30; }
}
function newRace(players){
  G.demo = false; G.players = players.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot }));
  setupRace(G.players);
  G.state = 'count'; G.stateT = 0;
  A.Menu.close(); A.keepAwake();
}
/* Drop-in: someone new presses FIRE mid-race and joins at the back of the pack. */
function dropIn(){
  if(G.demo || G.state !== 'race') return;
  const hum = G.riders.filter(r => r.human);
  if(hum.length >= 4) return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.riders.some(r => r.source === s.id)) continue;
    const used = hum.map(r => r.slot);
    const slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.riders.map(r => r.name));
    if(G.riders.length >= 4){      // make room: the last rival rider pulls over
      const cpus = G.riders.filter(r => r.cpu).sort((a, b) => a.x - b.x);
      if(!cpus.length) return;
      G.riders.splice(G.riders.indexOf(cpus[0]), 1);
    }
    const running = hum.filter(r => r.fin < 0);
    const ref = running.length ? running.reduce((a, b) => a.x < b.x ? a : b) : hum[0];
    const lane = [0, 1, 2, 3].find(l => !G.riders.some(r => Math.round(r.lane) === l && Math.abs(r.x - (ref.x - 20)) < 20)) || 0;
    const r = makeRider({ human: true, source: s.id, name, color: A.PLAYER_COLORS[slot], slot, lane, target: lane, x: Math.max(0, ref.x - 20), vx: 160, invT: 2 });
    r.lastPlace = 0; setMsg(r, 'JOINED!');
    G.riders.push(r);
    G.players.push({ source: s.id, name, color: r.color, slot });
    G.players.sort((a, b) => a.slot - b.slot);
    S('join');
    return;
  }
}
function finishRace(){
  G.state = 'results'; G.stateT = 0;
  const order = G.riders.slice().sort((a, b) => place(a) - place(b));
  const key = 'brawl.best.' + G.routeIx + '.' + G.diff, best = A.Store.get(key, 0);
  let newBest = false;
  const humanTimes = order.filter(r => r.human && r.fin >= 0).map(r => r.fin);
  if(humanTimes.length && (!best || Math.min(...humanTimes) < best)){ A.Store.set(key, Math.min(...humanTimes)); newBest = true; }
  G.results = order.map((r, i) => ({ place: i + 1, name: r.name, color: r.color, time: r.fin, cpu: !!r.cpu }));
  S('win');
  const rows = G.results.map(r => '<b style="color:' + r.color + '">' + r.place + '. ' + A.esc(r.name) + '</b>' + (r.cpu ? ' <span style="opacity:.6">(rival)</span>' : '') +
    ' · ' + (r.time >= 0 ? fmt(r.time) : r.cpu ? 'still riding' : 'still riding')).join('<br>');
  const bestNow = A.Store.get(key, 0);
  A.Menu.open({ center: true, shared: true, kicker: ROUTES[G.routeIx].name + ' · ' + D().label, title: G.results[0].cpu ? 'Route over' : A.esc(G.results[0].name) + ' wins!',
    text: rows + awards() + (bestNow ? '<br><br>Route record <b>' + fmt(bestNow) + '</b>' + (newBest ? ' · <b>new record!</b>' : '') : ''),
    items: [
      { label: 'Next route', select: () => { G.routeIx = (G.routeIx + 1) % ROUTES.length; newRace(G.players); } },
      { label: 'Ride again', select: () => newRace(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change riders', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
/* Fun little awards for the humans */
function awards(){
  const hum = G.riders.filter(r => r.human);
  if(!hum.length) return '';
  const out = [];
  const top = (key, label) => {
    const b = hum.slice().sort((a, c) => c.stats[key] - a.stats[key])[0];
    if(b && b.stats[key] > 0) out.push('<b style="color:' + b.color + '">' + A.esc(b.name) + '</b> · ' + label + ' (' + b.stats[key] + ')');
  };
  top('bonks', 'Bonk Boss'); top('airs', 'Air Ace'); top('gifts', 'Gift Grabber');
  if(G.diff !== 'kids'){ const steady = hum.filter(r => r.stats.tumbles === 0 && r.fin >= 0); if(steady.length && steady.length < 4) out.push(steady.map(r => '<b style="color:' + r.color + '">' + A.esc(r.name) + '</b>').join(', ') + ' · Never tumbled!'); }
  return out.length ? '<br><br>' + out.slice(0, 4).join('<br>') : '';
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  if(G.state === 'race' || G.demo) G.raceT += dt;
  G.simT += dt;
  for(const r of G.riders) stepRider(r, dt);
  trafficCollisions();
  rocketRams();
  if(G.state === 'race' && G.raceT > 3){
    for(const r of G.riders){
      if(!r.human || r.fin >= 0) continue;
      const pl = place(r);
      if(r.lastPlace && pl < r.lastPlace && (r.msgT <= 0.4 || /^\d/.test(r.msg))){ setMsg(r, ordinal(pl) + '!'); sfx('pass'); }
      r.lastPlace = pl;
    }
  }
  if(G.demo){
    if(G.riders.some(r => r.x > RT.finish + 100)){
      RT = buildRoute(RT.def); RT.rid = ++G.raceId; G.simT = 0; fxPrev.clear(); parts = [];
      for(const r of G.riders){ r.x = Math.random() * 30; r.wob = 0; r.item = ''; r.air = null; r.h = 0; }
    }
    return;
  }
  if(G.state !== 'race') return;
  const humans = G.riders.filter(r => r.human);
  const lim = D().limit;
  if(humans.every(r => r.fin >= 0)){ G.state = 'finishing'; G.stateT = 0; }
  else if(lim && G.firstFinish >= 0 && G.raceT - G.firstFinish > lim){ G.state = 'finishing'; G.stateT = 0; }
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
function titleMenu(){
  G.state = 'title';
  A.Menu.open({ kicker: 'xRetro', title: 'BLACKTOP BRAWL',
    text: 'Highway bonk racing! Hold <b>right</b> to zoom, <b>FIRE</b> to bonk riders with a foam glove, <b>Down+FIRE</b> to hop. Grab gift boxes for noodles, mallets, rockets and bubbles. Up to 4 riders on one screen or online.',
    items: [
      { label: 'Ride', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Route', value: () => (G.routeIx + 1) + ' · ' + ROUTES[G.routeIx].name, change: d => { G.routeIx = (G.routeIx + d + ROUTES.length) % ROUTES.length; } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('brawl.diff', G.diff); } },
      { label: 'Rival riders', value: () => G.rivals ? 'On' : 'Off', change: () => { G.rivals = !G.rivals; A.Store.set('brawl.rivals', G.rivals); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: bestLine() });
}
function bestLine(){
  const b = A.Store.get('brawl.best.' + G.routeIx + '.' + G.diff, 0);
  const n = A.Input.pads().length;
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + (b ? 'Record on this route: ' + fmt(b) + '.' : '');
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + ROUTES[G.routeIx].name + ' · ' + D().label,
    title: 'Who is riding?',
    text: online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 riders' + (G.rivals ? '; rival riders fill the empty spots.' : '.') + ' More can drop in mid-race by pressing FIRE.',
    min: 1, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => newRace(players),
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'race' && G.state !== 'count') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart route', select: () => newRace(G.players) }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: ROUTES[G.routeIx].name, title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'race'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'race'; }
function toTitle(){
  A.Menu.close(); A.Lobby.close(); A.Mirror.hide(); buf.clear();
  if(G.net) Net.close();
  G.net = null; startDemo(); titleMenu();
}
function leaveRoom(src, back){
  if(fromGuest(src)){ const peer = Net.peerOf(src.id); Net.kick(peer, 'kicked'); A.Input.Remote.disconnect(peer + '/'); return; }
  A.Menu.open({ center: true, kicker: 'Room ' + Net.code, title: 'Close the room?', text: 'Everyone playing online will be sent back to their title screen.',
    items: [{ label: 'Keep playing', select: back }, { label: 'Close the room', select: toTitle }], back });
}
function onlineMenu(src, start){
  G.state = 'online';
  if(!Net || !Net.available()){
    A.Menu.open({ center: true, kicker: 'Play online', title: 'Needs the internet', text: 'Online rooms work when the game is opened from <b>xretro.pages.dev</b>.',
      items: [{ label: 'Back', select: titleMenu }], back: titleMenu });
    return;
  }
  A.Menu.open({ center: true, kicker: 'Play online', title: 'Online rooms', start: start || 0,
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 riders from any mix of devices.',
    items: [
      { label: 'Host a route', select: s => hostRoom(s) },
      { label: 'Join with a code', select: () => A.Online.codeEntry(code => joinRoom(code), () => onlineMenu(src, 1)) },
      { label: 'Your name', value: () => A.Names.device() || 'not set', change: () => A.Online.askName(() => onlineMenu(src, 2), () => onlineMenu(src, 2)) },
      { label: 'Back', select: titleMenu }
    ], back: titleMenu });
}
function withName(then, back){ const n = A.Names.device(); if(n) then(n); else A.Online.askName(then, back); }
function hostRoom(src){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Play online', title: 'Opening a room…', items: [] });
    Net.host('brawl', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'brawl', name, netHandlers).then(() => {
      G.net = 'guest'; A.Menu.close(); buf.clear(); A.Sound.play('online');
      history.replaceState(null, '', location.pathname + '?room=' + code);
    }, why => {
      if(String(why).startsWith('other-game:')){ location.href = why.slice(11) + '.html?room=' + code; return; }
      A.toast(Net.why(why), 4500); onlineMenu(null, 1);
    });
  }, () => onlineMenu(null, 1));
}
function settingsMenu(back){
  A.Menu.open({ center: true, kicker: 'Settings', title: 'Settings', text: 'Resolution now: ' + display.resolutionLabel() + '.',
    items: A.settingsItems(display).concat([{ label: 'Back', select: back }]), back });
}
function helpMenu(back){
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to ride',
    text: 'The bike rides itself. Hold <b>right</b> to zoom (watch the engine heat), <b>left</b> to brake, <b>up/down</b> to change lane.<br>' +
          '<b>FIRE</b> bonks a rider next to you with your foam glove. Bonks fill their <b>wobble</b> meter; full wobble means a silly tumble, then they pop straight back up.<br>' +
          '<b>Down + FIRE</b> hops over potholes, cones, beach balls and even cars. Ramps launch you, blue arrows zoom you.<br>' +
          'Ride through <b>gift boxes</b> for a pool noodle, a squeaky mallet, a rocket or a bubble shield. Kids mode: no tumbles, cars just boing you over.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0;
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onRename(id, name){ const r = G.riders.find(x => x.source === id); if(r) r.name = name; const p = G.players.find(x => x.source === id); if(p) p.name = name; },
  onMessage(m){ if(m.t === 's'){ if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx); buf.push(m); } }
};
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
function sendSnap(){
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), rt: r2(G.raceT), sm: r2(G.simT), ri: RT.rid, tr: G.routeIx, d: G.diff, dm: G.demo ? 1 : 0, ff: r2(G.firstFinish),
    r: G.riders.map(r => [r.id, r1(r.x), r2(r.lane), Math.round(r.vx),
      (r.boost ? 1 : 0) | (r.cpu ? 2 : 0) | (r.human ? 4 : 0) | (r.brake ? 8 : 0) | (r.overT > 0 ? 16 : 0) | (r.slick ? 32 : 0) | (r.padT > 0 ? 64 : 0),
      Math.round(r.wob), Math.round(r.heat), r2(r.crashT), r2(r.invT), r2(r.hitT), r2(r.attackT), r1(r.h), ITEMS.indexOf(r.item), r.uses, r.swing, r2(r.fin),
      r.name, r.color, r.source || '', r.msgT > 0 ? r.msg : '', r2(r.msgT), r1(r.rocketT), r1(r.shieldT)]),
    ch: RT.cones.filter(k => k.hit).map(k => k.id), gg: RT.gifts.filter(g => g.back > G.simT).map(g => g.id) };
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  Net.broadcast(s);
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!RT || RT.def !== ROUTES[s.tr] || RT.rid !== s.ri){ RT = buildRoute(ROUTES[s.tr]); RT.rid = s.ri; parts = []; fxPrev.clear(); }
  const same = a.ri === b.ri;
  G.routeIx = s.tr; G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.firstFinish = s.ff;
  G.raceT = same && a.st === b.st ? L(a.rt, b.rt) : b.rt;
  G.simT = same ? L(a.sm, b.sm) : b.sm;
  const prev = new Map(a.r.map(q => [q[0], q]));
  G.riders = s.r.map(q => {
    const o = same ? prev.get(q[0]) : null, near = o && Math.abs(o[1] - q[1]) < 60;
    const f = q[4];
    return { id: q[0], x: near ? L(o[1], q[1]) : q[1], lane: near ? L(o[2], q[2]) : q[2], vx: q[3],
      boost: !!(f & 1), cpu: !!(f & 2), human: !!(f & 4), brake: !!(f & 8), overT: (f & 16) ? 1 : 0, slick: !!(f & 32), padT: (f & 64) ? 1 : 0,
      wob: q[5], heat: q[6], crashT: q[7], invT: q[8], hitT: q[9], attackT: q[10], h: near ? L(o[11], q[11]) : q[11], air: q[11] > 0 ? {} : null,
      item: ITEMS[q[12]] || '', uses: q[13], swing: q[14], fin: q[15], name: q[16], color: q[17], source: q[18], msg: q[19], msgT: q[20], rocketT: q[21], shieldT: q[22] };
  });
  const hit = new Set(s.ch || []); for(const k of RT.cones) k.hit = hit.has(k.id);
  const gone = new Set(s.gg || []); for(const g of RT.gifts) g.back = gone.has(g.id) ? Infinity : 0;
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  if(G.demo || G.state === 'title' || G.state === 'lobby' || G.state === 'online') want = A.THEMES.menu;
  else if(G.state === 'race' || G.state === 'paused' || G.state === 'count' || G.state === 'finishing') want = BRAWL_THEME;
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(G.state === 'paused' || G.state === 'results');
}
function myRiders(){
  const hum = G.riders.filter(r => r.human);
  const mine = hum.filter(r => G.net === 'guest' ? Net.isMine(r.source) : !String(r.source).includes('/'));
  return (mine.length ? mine : hum).sort((a, b) => (a.slot || 0) - (b.slot || 0)).slice(0, 4);
}
function step(dt){
  G.time += dt;
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = (G.state === 'race' || G.state === 'count') && myRiders().some(r => r.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('BONK'); }
    Net.setPlaying(G.state === 'race' || G.state === 'count');
    music(); return;
  }
  const wantTouch = (G.state === 'race' || G.state === 'count') && G.riders.some(r => r.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('BONK'); }
  music();
  if(Net) Net.setPlaying(G.state === 'race' || G.state === 'count');
  hostStep(dt);
  if(G.net === 'host'){ Net.hostTick(); if(++netStep % 2 === 0 && Net.hasGuests()) sendSnap(); }
}
function hostStep(dt){
  if(A.Lobby.isOpen()){ A.Lobby.update(); sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); if(G.demo) sim(dt); return; }
  if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
  const pausePressed = A.Input.all().some(s => A.Input.pressed(s, 'pause') && (s.kind !== 'net' || G.riders.some(r => r.source === s.id)));
  switch(G.state){
    case 'count':
      if(pausePressed){ pause(); return; }
      G.stateT += dt;
      { const before = Math.ceil(3 - (G.stateT - dt)), now = Math.ceil(3 - G.stateT); if(now !== before && now > 0) S('countdown'); }
      if(G.stateT >= 3){ G.state = 'race'; S('go'); }
      break;
    case 'race':
      if(pausePressed){ pause(); return; }
      dropIn(); sim(dt); break;
    case 'finishing':
      G.stateT += dt; sim(dt);
      if(G.stateT > 2.2) finishRace();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || (G.state !== 'race' && G.state !== 'count') || G.net === 'guest') return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);
const cams = new Map();

function rng(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function text(c, str, x, y, size, color, align, base){
  c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y);
}
function outlined(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(1.5, size / 4); c.strokeStyle = 'rgba(10,10,14,.85)'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function shade(hex, k){
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
}
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
function rrect(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r); c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath(); }
function circle(c, x, y, r){ c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
function star(c, x, y, r, rot){
  c.beginPath();
  for(let i = 0; i < 10; i++){ const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
const ordinal = n => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');
const crashLen = () => D().crash;

/* Parallax helper: calls fn(index, screenX) for every item of a repeating row that is on screen. */
function row(v, camX, s, par, spacing, fn){
  const off = camX * par, i0 = Math.floor(off / spacing) - 1, n = Math.ceil(v.w / s / spacing) + 3;
  for(let i = i0; i < i0 + n; i++) fn(i, v.x + (i * spacing - off) * s);
}
function hills(c, v, camX, s, par, base, amp, col, seed){
  c.fillStyle = col; c.beginPath(); c.moveTo(v.x, base);
  for(let sx = 0; sx <= v.w + 6; sx += 6){
    const wx = camX * par + sx / s;
    c.lineTo(v.x + sx, base - (Math.sin(wx * 0.011 + seed) * 0.5 + Math.sin(wx * 0.027 + seed * 2) * 0.3 + 0.8) * amp);
  }
  c.lineTo(v.x + v.w, base); c.fill();
}
function drawBackdrop(c, v, td, camX, s, roadTop){
  const horizon = roadTop - 34 * s;
  const sky = c.createLinearGradient(0, v.y, 0, roadTop);
  sky.addColorStop(0, td.sky[0]); sky.addColorStop(1, td.sky[1]);
  c.fillStyle = sky; c.fillRect(v.x, v.y, v.w, roadTop - v.y);
  if(td.night){
    c.fillStyle = '#dfe6ff';
    for(let i = 0; i < 40; i++){ const sx = v.x + ((rng(i) * 900 - camX * 0.03) % v.w + v.w) % v.w, sy = v.y + rng(i + 99) * (horizon - v.y) * 0.8; c.fillRect(sx, sy, 0.8, 0.8); }
    c.fillStyle = '#f4f1dc'; circle(c, v.x + v.w * 0.8, v.y + (horizon - v.y) * 0.3, 7 * s);
  } else {
    const sy = td.look === 'coast' ? horizon - 6 * s : v.y + (horizon - v.y) * 0.35;
    c.fillStyle = 'rgba(255,250,215,.35)'; circle(c, v.x + v.w * 0.78, sy, 17 * s);
    c.fillStyle = 'rgba(255,248,220,.95)'; circle(c, v.x + v.w * 0.78, sy, 11 * s);
  }
  if(td.look === 'coast'){
    hills(c, v, camX, s, 0.05, horizon, 10 * s, '#d27b5a', 1);
    const sea = c.createLinearGradient(0, horizon, 0, roadTop);
    sea.addColorStop(0, '#3f86c4'); sea.addColorStop(1, '#6cb7e0');
    c.fillStyle = sea; c.fillRect(v.x, horizon, v.w, roadTop - horizon);
    c.fillStyle = 'rgba(255,240,200,.7)';
    for(let i = 0; i < 18; i++){ const sx = v.x + ((rng(i + 7) * 700 - camX * 0.2) % v.w + v.w) % v.w, sy = horizon + 2 * s + rng(i + 30) * (roadTop - horizon - 10 * s); if((Math.floor(G.time * 3) + i) % 4) c.fillRect(sx, sy, 3 * s, 0.6 * s); }
    row(v, camX, s, 0.06, 420, (i, sx) => { if(rng(i) < 0.5) return; const by = horizon + 4 * s; c.fillStyle = '#f4efe2'; c.beginPath(); c.moveTo(sx, by); c.lineTo(sx + 6 * s, by - 10 * s); c.lineTo(sx + 6 * s, by); c.fill(); c.fillStyle = '#7a4b2a'; c.fillRect(sx - 3 * s, by, 12 * s, 2 * s); });
    c.fillStyle = '#ecd79f'; c.fillRect(v.x, roadTop - 8 * s, v.w, 8 * s);
    row(v, camX, s, 1, 110, (i, sx) => { if(rng(i + 3) < 0.25) return; palm(c, sx, roadTop - 3 * s, s, i); });
  } else if(td.look === 'city'){
    row(v, camX, s, 0.12, 26, (i, sx) => { const h = (26 + rng(i) * 34) * s, w = (18 + rng(i + 1) * 8) * s; c.fillStyle = '#1a1f3d'; c.fillRect(sx, roadTop - 10 * s - h, w, h + 10 * s); });
    row(v, camX, s, 0.3, 34, (i, sx) => {
      const h = (20 + rng(i + 50) * 30) * s, w = (22 + rng(i + 51) * 8) * s, top = roadTop - 4 * s - h;
      c.fillStyle = '#272d55'; c.fillRect(sx, top, w, h + 4 * s);
      c.fillStyle = 'rgba(255,214,120,.85)';
      for(let yy = 3 * s; yy < h - 3 * s; yy += 5 * s) for(let xx = 2 * s; xx < w - 3 * s; xx += 4.5 * s) if(rng(i * 31 + Math.round(yy + xx * 7)) > 0.55) c.fillRect(sx + xx, top + yy, 1.6 * s, 1.8 * s);
      if(rng(i + 9) > 0.6){ const nc = ['#ff4fa3', '#3ff0e0', '#ffd166'][((i % 3) + 3) % 3]; c.fillStyle = (Math.floor(G.time * 2 + i) % 5) ? nc : shade(nc, 0.5); c.fillRect(sx + 3 * s, top + 4 * s, w - 6 * s, 4 * s); }
    });
    c.fillStyle = '#343a50'; c.fillRect(v.x, roadTop - 5 * s, v.w, 5 * s);
    row(v, camX, s, 1, 90, (i, sx) => {
      c.fillStyle = '#6a7090'; c.fillRect(sx, roadTop - 34 * s, 1.4 * s, 32 * s); c.fillRect(sx, roadTop - 34 * s, 7 * s, 1.4 * s);
      const g = c.createRadialGradient(sx + 7 * s, roadTop - 32 * s, 0, sx + 7 * s, roadTop - 32 * s, 14 * s); g.addColorStop(0, 'rgba(255,240,190,.55)'); g.addColorStop(1, 'rgba(255,240,190,0)');
      c.fillStyle = g; c.fillRect(sx - 8 * s, roadTop - 48 * s, 30 * s, 30 * s); c.fillStyle = '#fff4c8'; c.fillRect(sx + 5.5 * s, roadTop - 33 * s, 3 * s, 1.5 * s);
    });
  } else if(td.look === 'canyon'){
    row(v, camX, s, 0.1, 120, (i, sx) => {
      if(rng(i) < 0.35) return;
      const w = (50 + rng(i + 2) * 40) * s, h = (22 + rng(i + 3) * 18) * s, by = horizon + 10 * s;
      c.fillStyle = '#c4683f'; c.beginPath(); c.moveTo(sx, by); c.lineTo(sx + 8 * s, by - h); c.lineTo(sx + w - 8 * s, by - h); c.lineTo(sx + w, by); c.fill();
      c.fillStyle = '#a8552f'; c.fillRect(sx + 5 * s, by - h * 0.55, w - 10 * s, 2.5 * s); c.fillRect(sx + 3 * s, by - h * 0.25, w - 6 * s, 2 * s);
    });
    hills(c, v, camX, s, 0.3, roadTop, 14 * s, '#d99a62', 4);
    row(v, camX, s, 1, 85, (i, sx) => { if(rng(i + 5) < 0.3) return; cactus(c, sx, roadTop - 2 * s, s, i); });
  } else if(td.look === 'snow'){
    row(v, camX, s, 0.07, 90, (i, sx) => {
      const h = (30 + rng(i) * 22) * s, w = (70 + rng(i + 1) * 30) * s, by = horizon + 8 * s;
      c.fillStyle = '#8aa3c4'; c.beginPath(); c.moveTo(sx, by); c.lineTo(sx + w / 2, by - h); c.lineTo(sx + w, by); c.fill();
      c.fillStyle = '#f4f8fc'; c.beginPath(); c.moveTo(sx + w / 2, by - h); c.lineTo(sx + w / 2 - w * 0.13, by - h * 0.74); c.lineTo(sx + w / 2, by - h * 0.8); c.lineTo(sx + w / 2 + w * 0.13, by - h * 0.74); c.fill();
    });
    hills(c, v, camX, s, 0.25, roadTop, 12 * s, '#dfe8f2', 2);
    row(v, camX, s, 0.4, 28, (i, sx) => { if(rng(i + 8) < 0.4) return; pine(c, sx, roadTop - 8 * s, s * 0.6, '#4d7a68'); });
    row(v, camX, s, 1, 70, (i, sx) => { if(rng(i + 11) < 0.35) return; pine(c, sx, roadTop - 2 * s, s, '#2f5e4d'); });
  }
  // guardrail along the back of the road
  c.fillStyle = td.night ? '#8e96ad' : '#c8ccd6';
  row(v, camX, s, 1, 22, (i, sx) => c.fillRect(sx, roadTop - 6 * s, 1.4 * s, 6 * s));
  c.fillRect(v.x, roadTop - 6 * s, v.w, 1.8 * s);
}
function palm(c, x, by, s, i){
  const lean = (rng(i) - 0.5) * 6 * s, h = (24 + rng(i + 1) * 8) * s, sway = Math.sin(G.time * 1.6 + i) * 0.08;
  c.strokeStyle = '#7a5230'; c.lineWidth = 2 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + lean * 0.3, by - h * 0.5, x + lean, by - h); c.stroke();
  c.fillStyle = '#3f8f4a';
  for(let k = 0; k < 6; k++){ const ang = -Math.PI / 2 + (k - 2.5) * 0.62 + sway; c.save(); c.translate(x + lean, by - h); c.rotate(ang); c.beginPath(); c.ellipse(6 * s, 0, 7 * s, 1.8 * s, 0.25, 0, 7); c.fill(); c.restore(); }
  c.fillStyle = '#6b4a2a'; circle(c, x + lean - 1 * s, by - h + 1.5 * s, 1.3 * s); circle(c, x + lean + 1.4 * s, by - h + 1.8 * s, 1.3 * s);
}
function cactus(c, x, by, s, i){
  const h = (12 + rng(i) * 7) * s;
  c.strokeStyle = '#3f7a45'; c.lineCap = 'round'; c.lineWidth = 3 * s;
  c.beginPath(); c.moveTo(x, by); c.lineTo(x, by - h); c.stroke();
  c.lineWidth = 2 * s; c.beginPath(); c.moveTo(x, by - h * 0.45); c.lineTo(x - 4 * s, by - h * 0.45); c.lineTo(x - 4 * s, by - h * 0.75);
  c.moveTo(x, by - h * 0.6); c.lineTo(x + 4 * s, by - h * 0.6); c.lineTo(x + 4 * s, by - h * 0.9); c.stroke();
  if(rng(i + 4) > 0.6){ c.fillStyle = '#ff7eb6'; circle(c, x, by - h - 1 * s, 1.2 * s); }
}
function pine(c, x, by, s, col){
  c.fillStyle = '#5a4030'; c.fillRect(x - 1 * s, by - 4 * s, 2 * s, 4 * s);
  for(let k = 0; k < 3; k++){
    const w = (9 - k * 2.2) * s, y = by - 4 * s - k * 6 * s;
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, y); c.lineTo(x, y - 9 * s); c.lineTo(x + w, y); c.fill();
    c.fillStyle = '#f4f8fc'; c.beginPath(); c.moveTo(x - w * 0.45, y - 5 * s); c.lineTo(x, y - 9 * s); c.lineTo(x + w * 0.45, y - 5 * s); c.fill();
  }
}

function drawView(c, v, r){
  const td = RT.def;
  const visH = v.h > 150 ? 150 : 112;
  const s = v.h / visH;
  const cam = cams.get(r.id) || { x: r.x };
  cam.x = r.x - (v.w / s) * 0.3; cams.set(r.id, cam);
  const X = wx => v.x + (wx - cam.x) * s;
  const Y = lane => v.y + v.h - (lane * LANE_H + BOTTOM) * s;      // top edge of a lane
  const GY = lane => Y(lane) + LANE_H * 0.62 * s;                  // where wheels touch in that lane
  c.save(); c.beginPath(); c.rect(v.x, v.y, v.w, v.h); c.clip();
  if(r.crashT > crashLen() - 0.3 && !G.demo){ const k = (r.crashT - (crashLen() - 0.3)) * 8 * s; c.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k); }

  const roadTop = Y(3) - 3 * s, roadBot = Y(-1);
  drawBackdrop(c, v, td, cam.x, s, roadTop);
  // road
  c.fillStyle = td.road; c.fillRect(v.x, roadTop, v.w, roadBot - roadTop);
  c.fillStyle = 'rgba(255,255,255,.04)';
  row(v, cam.x, s, 1, 47, (i, sx) => { if(rng(i + 70) > 0.5) c.fillRect(sx, Y(Math.floor(rng(i + 71) * 4)) + 3 * s, (8 + rng(i) * 14) * s, 2 * s); });
  c.fillStyle = td.edge; c.fillRect(v.x, Y(3) - 1 * s, v.w, 1.2 * s); c.fillRect(v.x, roadBot - 2.2 * s, v.w, 1.2 * s);
  c.strokeStyle = 'rgba(244,239,226,.55)'; c.lineWidth = Math.max(0.6, 0.9 * s); c.setLineDash([9 * s, 7 * s]); c.lineDashOffset = cam.x * s;
  for(let L = 0; L < 3; L++){ const ly = Y(L); c.beginPath(); c.moveTo(v.x, ly); c.lineTo(v.x + v.w, ly); c.stroke(); }
  c.setLineDash([]);
  c.fillStyle = td.side; c.fillRect(v.x, roadBot, v.w, v.y + v.h - roadBot);
  if(td.look === 'coast' || td.look === 'canyon'){ c.fillStyle = 'rgba(0,0,0,.08)'; row(v, cam.x, s, 1, 13, (i, sx) => c.fillRect(sx, roadBot + (2 + rng(i) * 6) * s, 1.5 * s, 1 * s)); }
  if(td.look === 'snow'){ c.fillStyle = '#ffffff'; c.fillRect(v.x, roadBot, v.w, 1.6 * s); }

  const x0 = cam.x - 30, x1 = cam.x + v.w / s + 30;
  // flat things painted on the road
  for(const x of [0, RT.finish]) if(x > x0 && x < x1){
    for(let L = 0; L < 4; L++) for(let k = 0; k < 4; k++) for(let j = 0; j < 2; j++){ c.fillStyle = (k + j) % 2 ? '#111' : '#f4efe2'; c.fillRect(X(x) + j * 2.5 * s, Y(L) + k * LANE_H * s / 4, 2.5 * s, LANE_H * s / 4 + 0.3); }
  }
  const slickCol = td.slick === 'ice' ? ['rgba(200,235,255,.75)', 'rgba(255,255,255,.8)'] : td.slick === 'mud' ? ['rgba(92,62,38,.85)', 'rgba(150,110,70,.6)'] : ['rgba(26,24,40,.8)', 'rgba(150,120,220,.45)'];
  for(const z of RT.slicks) if(z.x2 > x0 && z.x < x1) for(const L of z.lanes){
    const oy = Y(L) + LANE_H * s * 0.5;
    c.fillStyle = slickCol[0]; c.beginPath(); c.ellipse(X((z.x + z.x2) / 2), oy, (z.x2 - z.x) * s / 2, LANE_H * s * 0.38, 0, 0, 7); c.fill();
    c.fillStyle = slickCol[1]; c.beginPath(); c.ellipse(X(z.x + 14), oy - 1.2 * s, 5 * s, 1.2 * s, 0.2, 0, 7); c.fill(); c.beginPath(); c.ellipse(X(z.x2 - 16), oy + 1.4 * s, 4 * s, 1 * s, -0.2, 0, 7); c.fill();
  }
  for(const h of RT.holes) if(h.x > x0 && h.x < x1){
    const hy = Y(h.lane) + LANE_H * s * 0.6;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(X(h.x), hy + 0.6 * s, 7 * s, 2.8 * s, 0, 0, 7); c.fill();
    c.fillStyle = '#15161c'; c.beginPath(); c.ellipse(X(h.x), hy, 6 * s, 2.3 * s, 0, 0, 7); c.fill();
  }
  for(const p of RT.pads) if(p.x2 > x0 && p.x < x1){
    const ay = Y(p.lane) + LANE_H * s * 0.5;
    for(let k = 0; k < 3; k++){ const ax = X(p.x + 6 + k * 12);
      c.fillStyle = (Math.floor(G.time * 10) - k) % 3 === 0 ? '#bff0ff' : '#3fb0e8';
      c.beginPath(); c.moveTo(ax, ay - 4 * s); c.lineTo(ax + 7 * s, ay); c.lineTo(ax, ay + 4 * s); c.lineTo(ax + 2.5 * s, ay); c.fill(); }
  }
  // lanes far to near: ramps, cones, gifts, balls, traffic and riders
  const byLane = [[], [], [], []];
  for(const q of G.riders) if(q.x > x0 - 20 && q.x < x1) byLane[Math.max(0, Math.min(3, Math.round(q.lane)))].push(q);
  for(let L = 3; L >= 0; L--){
    const gy = GY(L);
    for(const p of RT.ramps) if(p.lane === L && p.x > x0 && p.x < x1) drawRamp(c, X(p.x), gy, s);
    for(const k of RT.cones) if(!k.hit && k.lane === L && k.x > x0 && k.x < x1) drawCone(c, X(k.x), gy, s);
    for(const g of RT.gifts) if(g.lane === L && g.back <= G.simT && g.x > x0 && g.x < x1) drawGift(c, X(g.x), gy - (4 + Math.sin(G.time * 4 + g.id) * 1.5) * s, s, g.id);
    for(const b of RT.balls) if(b.x > x0 && b.x < x1){ const bl = ballLane(b, G.simT); if(Math.round(bl) === L) drawBall(c, X(b.x), GY(bl) - ballH(b, G.simT) * s, GY(bl), s, td.look === 'snow', b); }
    for(const vh of RT.traffic) if(vh.lane === L){ const vx = vehX(vh); if(vx > x0 - 30 && vx < x1) drawVehicle(c, vh, X(vx), gy, s, td.night); }
    for(const q of byLane[L].sort((a, b) => a.x - b.x)) drawRider(c, q, X(q.x), GY(q.lane), s, q === r);
  }
  // finish arch
  if(RT.finish > x0 - 20 && RT.finish < x1 + 20){
    const fx = X(RT.finish), topY = roadTop - 40 * s, bot = roadBot;
    c.fillStyle = '#e8e8ee'; c.fillRect(fx - 2 * s, topY, 1.8 * s, bot - topY); c.fillRect(fx + 22 * s, topY - 4 * s, 1.8 * s, roadTop - topY + 4 * s);
    for(let k = 0; k < 12; k++) for(let j = 0; j < 2; j++){ c.fillStyle = (k + j) % 2 ? '#111' : '#fff'; c.fillRect(fx - 1 * s + k * 2 * s, topY - 4 * s + k * -0.3 * s + j * 3 * s, 2 * s, 3 * s); }
    outlined(c, 'FINISH', fx + 11 * s, topY - 10 * s, 6 * s, '#f5c542');
  }
  // particles
  for(const p of parts){
    if(p.x < x0 || p.x > x1) continue;
    const px = X(p.x), py = GY(p.lane) - p.h * s;
    c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.col;
    if(p.kind === 'star') star(c, px, py, p.r * 1.6 * s, p.rot);
    else if(p.kind === 'cone'){ c.save(); c.translate(px, py); c.rotate(p.rot); drawCone(c, 0, 3 * s, s); c.restore(); }
    else c.fillRect(px - p.r * s / 2, py - p.r * s / 2, p.r * s, p.r * s);
  }
  c.globalAlpha = 1;
  // speed lines
  if(!G.demo && ((r.boost && r.vx > 200) || r.rocketT > 0 || r.padT > 0)){
    c.strokeStyle = r.rocketT > 0 ? 'rgba(255,209,102,.55)' : r.padT > 0 ? 'rgba(127,227,255,.55)' : 'rgba(255,255,255,.32)'; c.lineWidth = Math.max(0.6, 0.7 * s); c.beginPath();
    for(let i = 0; i < 14; i++){ const ly = v.y + rng(i + 40) * v.h, len = (20 + rng(i + 80) * 40) * s, lx = v.x + ((rng(i) * v.w * 1.5 - G.time * 900 * s) % (v.w * 1.5) + v.w * 1.5) % (v.w * 1.5) - len;
      c.moveTo(lx, ly); c.lineTo(lx + len, ly); }
    c.stroke();
  }
  if(td.snow){ c.fillStyle = 'rgba(255,255,255,.85)'; for(let i = 0; i < 50; i++){ const sx = v.x + ((rng(i) * v.w + Math.sin(G.time + i) * 8 * s - cam.x * s * 0.3) % v.w + v.w) % v.w, sy = v.y + ((rng(i + 5) * v.h + G.time * (30 + rng(i + 9) * 30) * s) % v.h); c.fillRect(sx, sy, 1.2 * s, 1.2 * s); } }
  if(td.night){ const g = c.createRadialGradient(X(r.x + 10), GY(r.lane) - 8 * s, 4, X(r.x + 10), GY(r.lane) - 8 * s, v.w * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,.35)'); c.fillStyle = g; c.fillRect(v.x, v.y, v.w, v.h); }

  drawViewHUD(c, v, r);
  c.restore();
}
function drawRamp(c, x, gy, s){
  c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x, gy, 15 * s, 1.5 * s);
  c.fillStyle = '#f5c542'; c.beginPath(); c.moveTo(x, gy); c.lineTo(x + 14 * s, gy - 6 * s); c.lineTo(x + 14 * s, gy); c.fill();
  c.fillStyle = '#222'; for(let k = 0; k < 3; k++){ const a = x + (2 + k * 4) * s; c.beginPath(); c.moveTo(a, gy - (a - x) / s * 0.43 * s); c.lineTo(a + 2 * s, gy - (a - x + 2 * s) / s * 0.43 * s); c.lineTo(a + 2 * s, gy); c.lineTo(a, gy); c.fill(); }
  c.fillStyle = '#8a8f9c'; c.fillRect(x + 13 * s, gy - 6 * s, 1.2 * s, 6 * s);
}
function drawCone(c, x, gy, s){
  c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(x - 2.6 * s, gy); c.lineTo(x, gy - 7 * s); c.lineTo(x + 2.6 * s, gy); c.fill();
  c.fillStyle = '#f4efe2'; c.fillRect(x - 1.5 * s, gy - 4 * s, 3 * s, 1.2 * s);
  c.fillStyle = '#d65a10'; c.fillRect(x - 3.4 * s, gy - 0.8 * s, 6.8 * s, 1 * s);
}
function drawGift(c, x, y, s, id){
  const col = ['#e2463c', '#3fd0b0', '#9b7bff', '#ff7eb6'][id % 4];
  c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x, y + 7 * s, 4 * s, 1 * s, 0, 0, 7); c.fill();
  c.fillStyle = col; rrect(c, x - 3.5 * s, y - 3.5 * s, 7 * s, 7 * s, 1 * s); c.fill();
  c.fillStyle = '#fff3b0'; c.fillRect(x - 0.7 * s, y - 3.5 * s, 1.4 * s, 7 * s); c.fillRect(x - 3.5 * s, y - 0.7 * s, 7 * s, 1.4 * s);
  c.beginPath(); c.ellipse(x - 1.6 * s, y - 4.3 * s, 1.6 * s, 1 * s, -0.5, 0, 7); c.ellipse(x + 1.6 * s, y - 4.3 * s, 1.6 * s, 1 * s, 0.5, 0, 7); c.fill();
  if(Math.floor(G.time * 4 + id) % 4 === 0){ c.fillStyle = '#ffffff'; star(c, x + 3.5 * s, y - 4 * s, 1.4 * s, G.time); }
}
function drawBall(c, x, y, gy, s, snow, b){
  c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(x, gy, 4 * s, 1 * s, 0, 0, 7); c.fill();
  const R = 4.2 * s;
  if(snow){ c.fillStyle = '#ffffff'; circle(c, x, y - R, R); c.fillStyle = 'rgba(150,180,220,.5)'; circle(c, x + 1.2 * s, y - R + 1.2 * s, R * 0.6); return; }
  const rot = G.simT * 3 + b.ph;
  const cols = ['#e2463c', '#f4efe2', '#3f8fe0', '#f5c542'];
  for(let k = 0; k < 4; k++){ c.fillStyle = cols[k]; c.beginPath(); c.moveTo(x, y - R); c.arc(x, y - R, R, rot + k * Math.PI / 2, rot + (k + 1) * Math.PI / 2); c.fill(); }
  c.fillStyle = '#ffffff'; circle(c, x, y - R, 1 * s);
}
function drawVehicle(c, v, sx, gy, s, night){
  const V = VEH[v.kind], L = V.len, H = V.h;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx + L * s / 2, gy + 0.5 * s, L * s * 0.55, 1.8 * s, 0, 0, 7); c.fill();
  if(night){ const g = c.createLinearGradient(sx + L * s, 0, sx + (L + 40) * s, 0); g.addColorStop(0, 'rgba(255,240,180,.45)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(sx + L * s, gy - 5 * s); c.lineTo(sx + (L + 40) * s, gy - 9 * s); c.lineTo(sx + (L + 40) * s, gy + 2 * s); c.fill(); }
  c.save(); c.translate(sx, gy); c.scale(s, s);
  if(v.kind === 'truck'){
    c.fillStyle = '#e9ecf1'; rrect(c, 0, -H - 2, L - 8, H, 1.2); c.fill();
    c.fillStyle = v.col; c.fillRect(1, -H + 2, L - 10, 2.2);
    c.fillStyle = v.col; rrect(c, L - 8, -9, 8, 7, 1.6); c.fill();
    c.fillStyle = '#bfe0f5'; c.fillRect(L - 4.5, -8, 3, 3);
  } else if(v.kind === 'bus'){
    c.fillStyle = '#f5c542'; rrect(c, 0, -H - 2, L, H, 2); c.fill();
    c.fillStyle = '#bfe0f5'; for(let k = 0; k < 6; k++) c.fillRect(2 + k * 4.5, -H, 3.2, 3.5);
    c.fillStyle = '#e2463c'; c.fillRect(0, -5, L, 1.2);
  } else if(v.kind === 'van'){
    c.fillStyle = '#ffb3d1'; rrect(c, 0, -H - 2, L, H, 2.4); c.fill();
    c.fillStyle = '#fff3e0'; c.fillRect(0, -H - 2, L - 5, 2.5);
    c.fillStyle = '#bfe0f5'; c.fillRect(L - 5, -H + 1, 3.5, 3.5);
    c.fillStyle = '#e8b36a'; c.beginPath(); c.moveTo(6, -H - 2); c.lineTo(8, -H - 8); c.lineTo(10, -H - 2); c.fill();
    c.fillStyle = '#ff7eb6'; circle(c, 8, -H - 8.5, 2.2);
  } else {
    c.fillStyle = v.col; rrect(c, 0, -7, L, 5.5, 2); c.fill();
    c.fillStyle = shade(v.col, 0.85); c.beginPath(); c.moveTo(3, -7); c.lineTo(5.5, -11.5); c.lineTo(L - 5, -11.5); c.lineTo(L - 2, -7); c.fill();
    c.fillStyle = '#bfe0f5'; c.beginPath(); c.moveTo(6.3, -7.6); c.lineTo(7.4, -10.6); c.lineTo(L - 5.6, -10.6); c.lineTo(L - 3.6, -7.6); c.fill();
    c.fillStyle = shade(v.col, 0.85); c.fillRect(L / 2 - 0.4, -10.8, 0.8, 3.4);
  }
  c.fillStyle = '#fff4c8'; c.fillRect(L - 1.2, -5.5, 1.2, 1.4);
  c.fillStyle = '#ff4a3c'; c.fillRect(0, -5.5, 1, 1.4);
  for(const wx of [3.2, L - 3.2]){ c.fillStyle = '#17181d'; circle(c, wx, -1.5, 2.6); c.fillStyle = '#9aa0ab'; circle(c, wx, -1.5, 1); }
  c.restore();
}
function drawRider(c, r, sx, gy, s, focus){
  if(r.invT > 0 && r.crashT <= 0 && Math.floor(G.time * 12) % 2 && r.invT > 0.3) return;
  const col = r.color;
  const air = r.h || 0;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx + 8 * s, gy, (9 - Math.min(5, air * 0.2)) * s, 1.4 * s, 0, 0, 7); c.fill();
  const y = gy - air * s;
  c.save(); c.translate(sx, y); c.scale(s, s);
  if(r.crashT > 0){ drawTumble(c, r); c.restore(); labels(c, r, sx, y, s, focus); return; }
  let rot = 0;
  if(air > 0.5) rot = -0.12;
  if(r.wob > 45) rot += Math.sin(G.time * 14 + r.id) * 0.07 * (r.wob / 100);
  if(r.slick) rot += Math.sin(G.time * 22 + r.id) * 0.05;
  if(rot){ c.translate(8, -2); c.rotate(rot); c.translate(-8, 2); }
  if(r.rocketT > 0){
    c.fillStyle = '#e9ecf1'; rrect(c, -4, -9.5, 9, 3, 1.4); c.fill(); c.fillStyle = '#e2463c'; c.beginPath(); c.moveTo(5, -9.5); c.lineTo(8, -8); c.lineTo(5, -6.5); c.fill();
    c.fillStyle = Math.floor(G.time * 30) % 2 ? '#ffd166' : '#ff7a3c'; c.beginPath(); c.moveTo(-4, -9.5); c.lineTo(-11 - Math.random() * 4, -8); c.lineTo(-4, -6.5); c.fill();
  } else if((r.boost || r.padT > 0) && Math.floor(G.time * 30) % 2){ c.fillStyle = r.padT > 0 ? '#7fe3ff' : '#ff9f43'; c.beginPath(); c.moveTo(-1, -6.5); c.lineTo(-7 - Math.random() * 3, -5.5); c.lineTo(-1, -4.5); c.fill(); }
  drawBike(c, r);
  drawBody(c, r);
  if(r.shieldT > 0 && (r.shieldT > 2 || Math.floor(G.time * 8) % 2)){
    const pr = 14 + Math.sin(G.time * 6) * 0.6;
    c.fillStyle = 'rgba(127,227,255,.16)'; circle(c, 8, -11, pr);
    c.strokeStyle = 'rgba(160,236,255,.85)'; c.lineWidth = 1; c.beginPath(); c.arc(8, -11, pr, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(8, -11, pr - 3, -2.6, -1.8); c.stroke();
  }
  c.restore();
  if(r.hitT > 0.15){ // comic "BONK" burst
    const k = (r.hitT - 0.15) / 0.25, bx = sx + 11 * s, by = y - 20 * s;
    c.fillStyle = 'rgba(255,243,176,' + (0.9 * k) + ')'; star(c, bx, by, (7 + (1 - k) * 3) * s, 0.3);
    c.fillStyle = 'rgba(255,255,255,' + k + ')'; star(c, bx, by, (4 + (1 - k) * 2) * s, 0.9);
  }
  labels(c, r, sx, y, s, focus);
}
function labels(c, r, sx, y, s, focus){
  if(!focus && !G.demo) outlined(c, r.name.toUpperCase(), sx + 8 * s, y - 30 * s, Math.max(4, 4.2 * s), r.color);
  if(r.msgT > 0 && r.msg){
    const m = r.msg;
    const col = /^\d/.test(m) ? '#3fd07a' : /BONK|SQUEAK|OOF|BOING|TUMBLE|BUMP|OOPS|OVERHEAT|SLIPPY|ICY/.test(m) ? '#ff9f43' : m === 'BLOCKED!' ? '#7fe3ff' : '#f5c542';
    outlined(c, m, sx + 8 * s, y - 38 * s - (1.1 - r.msgT) * 10 * s, Math.max(5, 6 * s), col);
  }
}
function drawTumble(c, r){
  const len = crashLen(), u = Math.max(0, Math.min(1, 1 - r.crashT / len));
  // the bike tips over, slides and rights itself; the rider flips up in the air and lands back on
  const tip = u < 0.75 ? -Math.min(1, u * 4) * 0.9 : -0.9 * (1 - u) / 0.25;
  c.save(); c.translate(8, -1); c.rotate(tip); c.translate(-8, 1); drawBike(c, r); c.restore();
  const arc = Math.sin(u * Math.PI);
  c.save(); c.translate(7 + arc * 6, -12 - arc * 22); c.rotate(u * Math.PI * 4 * (u < 0.85 ? 1 : 0));
  // arms and legs flailing
  c.strokeStyle = '#2b2f3a'; c.lineWidth = 2.2; c.lineCap = 'round';
  const fl = Math.sin(G.time * 30) * 0.6;
  c.beginPath(); c.moveTo(0, 2); c.lineTo(-3 + fl, 7); c.moveTo(0, 2); c.lineTo(3 - fl, 7); c.stroke();
  c.strokeStyle = r.color; c.lineWidth = 2.8; c.beginPath(); c.moveTo(0, 2); c.lineTo(0, -4); c.stroke();
  c.strokeStyle = shade(r.color, 0.75); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -3); c.lineTo(-5, -6 - fl * 3); c.moveTo(0, -3); c.lineTo(5, -6 + fl * 3); c.stroke();
  c.fillStyle = r.color; circle(c, 0, -7.5, 3.1);
  c.fillStyle = '#1b1d24'; c.fillRect(0.8, -8.3, 2.4, 1.3);
  c.restore();
  if(u > 0.35){ // dizzy stars
    const hx = 7 + arc * 6, hy = -20 - arc * 22;
    for(let k = 0; k < 3; k++){ const a = G.time * 7 + k * 2.1; c.fillStyle = k % 2 ? '#fff3b0' : '#f5c542'; star(c, hx + Math.cos(a) * 5, hy + Math.sin(a) * 1.6, 1.6, a); }
  }
}
function drawBike(c, r){
  const wa = r.x * 0.35;
  const wheel = x => {
    c.strokeStyle = '#17181d'; c.lineWidth = 2.2; c.beginPath(); c.arc(x, -4, 3.6, 0, 7); c.stroke();
    c.strokeStyle = '#8a8f9c'; c.lineWidth = 0.5;
    for(let k = 0; k < 3; k++){ const a = wa + k * Math.PI / 3; c.beginPath(); c.moveTo(x - Math.cos(a) * 3, -4 - Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 3, -4 + Math.sin(a) * 3); c.stroke(); }
  };
  wheel(0); wheel(WB);
  c.strokeStyle = r.color; c.lineWidth = 1.7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -4); c.lineTo(6, -7); c.lineTo(12, -10.5); c.lineTo(WB, -4); c.stroke();
  c.strokeStyle = '#2a2d36'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, -7); c.lineTo(9, -4.5); c.lineTo(13, -9); c.stroke();
  c.fillStyle = '#3a3e4a'; c.fillRect(5.5, -7.2, 4.5, 3.4);
  c.fillStyle = r.color; c.beginPath(); c.moveTo(4, -9.5); c.lineTo(12, -11.5); c.lineTo(12, -9); c.lineTo(5, -8); c.fill();
  c.fillStyle = '#1b1d24'; c.fillRect(1.5, -10, 6, 1.4);
  c.fillStyle = '#f4efe2'; c.fillRect(12.4, -12.8, 3, 3);
  c.strokeStyle = '#c8ccd6'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(12.5, -11); c.lineTo(11, -14); c.lineTo(13, -14.3); c.stroke();
  c.fillStyle = '#9aa0ab'; c.fillRect(-1.5, -7.6, 4.5, 1.1);
}
function drawBody(c, r){
  const col = r.color;
  const lean = r.boost || r.rocketT > 0 || r.padT > 0 ? 1.4 : r.brake ? -0.8 : 0;
  c.strokeStyle = '#2b2f3a'; c.lineWidth = 2.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(5, -9.5); c.lineTo(8.5, -7.5); c.lineTo(7.5, -5); c.stroke();
  c.strokeStyle = col; c.lineWidth = 2.8;
  c.beginPath(); c.moveTo(5, -10); c.lineTo(7 + lean, -16.5); c.stroke();
  // helmet
  c.fillStyle = col; circle(c, 8 + lean, -19.5, 3.1);
  c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(5.2 + lean, -20.2, 5.6, 0.9);
  c.fillStyle = '#1b1d24'; c.fillRect(8.9 + lean, -19.6, 2.6, 1.4);
  // arm and weapon: wind up behind, then swing forward
  const held = r.item || '';
  let a;
  if(r.attackT > 0){ const p = 1 - r.attackT / 0.25; a = p < 0.3 ? 0.35 - (p / 0.3) * 2.75 : -2.4 + ((p - 0.3) / 0.7) * 2.6; }
  else a = held ? -1.05 : 0.35;
  const sx = 7.3 + lean, sy = -15.5, len = 5.6, hx = sx + Math.cos(a) * len, hy = sy + Math.sin(a) * len;
  const weapon = r.attackT > 0 ? SWING[r.swing | 0] || 'glove' : (held || 'glove');
  if(r.attackT > 0 && r.attackT < 0.18){
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(sx, sy, len + (weapon === 'glove' ? 4 : weapon === 'noodle' ? 14 : 11), -2.4, a); c.stroke();
  }
  c.strokeStyle = shade(col, 0.75); c.lineWidth = 1.6; c.beginPath(); c.moveTo(sx, sy); c.lineTo(hx, hy); c.stroke();
  drawWeapon(c, weapon, hx, hy, a, r.attackT > 0);
}
function drawWeapon(c, w, x, y, a, swinging){
  c.save(); c.translate(x, y); c.rotate(a);
  if(w === 'glove'){ c.fillStyle = '#ff5a4e'; circle(c, 1.8, 0, swinging ? 3 : 2.3); c.fillStyle = '#f4efe2'; c.fillRect(-0.9, -1.6, 1.3, 3.2); }
  else if(w === 'noodle'){
    const bend = swinging ? 4 : -1.5;
    c.strokeStyle = '#ff7eb6'; c.lineWidth = 2.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(8, bend * 0.3, 16, bend); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(1, -0.8); c.quadraticCurveTo(8, bend * 0.3 - 0.8, 15, bend - 0.8); c.stroke();
  } else if(w === 'mallet'){
    c.strokeStyle = '#e8c27a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(9, 0); c.stroke();
    c.fillStyle = '#e2463c'; rrect(c, 8, -3.6, 5.2, 7.2, 1.4); c.fill();
    c.fillStyle = '#f5c542'; c.fillRect(8, -3.6, 1.2, 7.2); c.fillRect(12, -3.6, 1.2, 7.2);
  }
  c.restore();
}
function drawItemIcon(c, it, x, y, k){
  c.save(); c.translate(x, y); c.scale(k, k);
  if(it === 'noodle'){ c.strokeStyle = '#ff7eb6'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, 4); c.quadraticCurveTo(0, -1, 4, -4); c.stroke(); }
  else if(it === 'mallet'){ c.strokeStyle = '#e8c27a'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-4, 4); c.lineTo(1, -1); c.stroke(); c.save(); c.rotate(-0.78); c.fillStyle = '#e2463c'; c.fillRect(-2.5, -4.5, 5, 3.4); c.restore(); }
  else if(it === 'rocket'){ c.fillStyle = '#e9ecf1'; rrect(c, -4, -1.5, 7, 3, 1.4); c.fill(); c.fillStyle = '#ff7a3c'; c.beginPath(); c.moveTo(-4, -1.5); c.lineTo(-7, 0); c.lineTo(-4, 1.5); c.fill(); }
  else if(it === 'bubble'){ c.strokeStyle = 'rgba(160,236,255,.95)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.stroke(); c.fillStyle = 'rgba(127,227,255,.3)'; circle(c, 0, 0, 4); }
  else { c.fillStyle = '#ff5a4e'; circle(c, 0.5, 0, 2.6); c.fillStyle = '#f4efe2'; c.fillRect(-3, -1.4, 1.6, 2.8); }
  c.restore();
}
function drawViewHUD(c, v, r){
  const small = v.h < 150, k = small ? 0.62 : 1;
  const pad = 4 * k + 2;
  if(!G.demo){
    const pl = place(r);
    outlined(c, ordinal(pl), v.x + pad + 14 * k, v.y + pad + 7 * k, 12 * k, pl === 1 ? '#f5c542' : '#f4efe2', 'center');
    { const nm = r.name.toUpperCase(); text(c, nm, v.x + pad + 30 * k, v.y + pad + 2 * k, fitText(c, nm, v.w * 0.28 - pad - 30 * k, 6 * k), r.color); }
    // wobble + engine bars
    const bw = 44 * k, bh = 3.2 * k, bx = v.x + pad + 1;
    const bar = (label, val, y, col, flash) => {
      text(c, label, bx, y - 6.5 * k, 4.5 * k, flash && Math.floor(G.time * 6) % 2 ? '#ff5a4e' : '#f4efe2');
      c.fillStyle = 'rgba(10,10,14,.65)'; c.fillRect(bx - 1, y - 1, bw + 2, bh + 2);
      c.fillStyle = col; c.fillRect(bx, y, bw * Math.max(0, Math.min(1, val / 100)), bh);
    };
    if(G.diff !== 'kids') bar('WOBBLE', r.wob, v.y + pad + 24 * k, r.wob > 70 ? '#ff5a4e' : r.wob > 40 ? '#ff9f43' : '#7fe3ff', r.wob > 70);
    bar(r.overT > 0 ? 'OVERHEAT' : 'ENGINE', r.heat, v.y + pad + (G.diff !== 'kids' ? 37 : 24) * k, r.heat > 80 ? (Math.floor(G.time * 8) % 2 ? '#ff5a4e' : '#ff9f43') : r.heat > 55 ? '#ff9f43' : '#3fd0b0', r.overT > 0);
    // time and item box
    const tm = r.fin >= 0 ? r.fin : Math.max(0, G.raceT);
    text(c, fmt(tm), v.x + v.w - pad, v.y + pad + 2 * k, 7 * k, '#f4efe2', 'right');
    const ib = 13 * k, ix = v.x + v.w - pad - ib, iy = v.y + pad + 12 * k;
    c.fillStyle = 'rgba(10,10,14,.6)'; rrect(c, ix, iy, ib, ib, 2 * k); c.fill();
    c.strokeStyle = r.item || r.rocketT > 0 || r.shieldT > 0 ? '#f5c542' : 'rgba(244,239,226,.35)'; c.lineWidth = 0.8 * k; c.stroke();
    const it = r.rocketT > 0 ? 'rocket' : r.item || (r.shieldT > 0 ? 'bubble' : 'glove');
    drawItemIcon(c, it, ix + ib / 2, iy + ib / 2, k * 1.1);
    if(r.item) text(c, '×' + r.uses, ix - 1.5 * k, iy + ib - 6 * k, 5 * k, '#f5c542', 'right');
    if(r.fin >= 0) text(c, 'DONE', ix - 1.5 * k, iy + 1 * k, 5 * k, '#9d9cab', 'right');
    // progress bar with every rider
    const px = v.x + v.w * 0.3, pw = v.w * 0.4, py = v.y + pad + 4 * k;
    c.fillStyle = 'rgba(10,10,14,.55)'; c.fillRect(px, py, pw, 2.5 * k);
    c.fillStyle = '#f4efe2'; c.fillRect(px + pw, py - 3 * k, 1 * k, 8 * k);
    for(const q of G.riders){ const f = Math.max(0, Math.min(1, q.x / RT.finish)); c.fillStyle = q.color; c.fillRect(px + f * pw - 1.5 * k, py - 1.5 * k, 3 * k, 5.5 * k); }
    if(G.firstFinish >= 0 && r.fin < 0 && D().limit){
      const left = Math.max(0, D().limit - (G.raceT - G.firstFinish));
      outlined(c, 'FINISH IN ' + Math.ceil(left), v.x + v.w / 2, v.y + pad + 16 * k, 7 * k, '#ff8a6a');
    }
  }
  if(G.state === 'count'){
    const n = Math.ceil(3 - G.stateT), cx = v.x + v.w / 2, cy = v.y + v.h * 0.35;
    c.fillStyle = 'rgba(10,10,14,.8)'; c.fillRect(cx - 40 * k, cy - 10 * k, 80 * k, 20 * k);
    for(let i = 0; i < 3; i++){ c.fillStyle = i < 4 - n ? '#ff5a4e' : '#3a1c1c'; c.beginPath(); c.arc(cx - 22 * k + i * 22 * k, cy, 6.5 * k, 0, 7); c.fill(); }
    outlined(c, n > 0 ? String(n) : 'GO!', cx, cy + 24 * k, 16 * k, '#f5c542');
  } else if(G.state === 'race' && G.raceT < 1){ outlined(c, 'GO!', v.x + v.w / 2, v.y + v.h * 0.35, 22 * k, '#3fd07a'); }
}

function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  if(!RT || !G.riders.length) return;
  fxStep(Math.min(dt, 0.05));
  c.setTransform(s, 0, 0, s, 0, 0);
  const follow = G.demo ? [G.riders[0]] : myRiders();
  const n = follow.length;
  const views = n <= 1 ? [{ x: 0, y: 0, w: VW, h: VH }]
    : n === 2 ? [{ x: 0, y: 0, w: VW, h: VH / 2 - 1 }, { x: 0, y: VH / 2 + 1, w: VW, h: VH / 2 - 1 }]
    : [{ x: 0, y: 0, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: VW / 2 + 1, y: 0, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: 0, y: VH / 2 + 1, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: VW / 2 + 1, y: VH / 2 + 1, w: VW / 2 - 1, h: VH / 2 - 1 }];
  follow.forEach((r, i) => drawView(c, views[i], r));
  if(n === 3){ const v = views[3]; c.fillStyle = '#14161d'; c.fillRect(v.x, v.y, v.w, v.h); drawStandings(c, v); }
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.3)'; c.fillRect(0, 0, VW, VH); }
  // a reminder of the two moves while the race starts
  if(!G.demo && (G.state === 'count' || (G.state === 'race' && G.raceT < 4))){
    const tip = A.Input.isTouch ? 'BONK: bop a rider   ▼ + BONK: hop' : 'FIRE: bonk a rider   DOWN + FIRE: hop   RIGHT: zoom';
    c.fillStyle = 'rgba(10,10,14,.7)'; c.fillRect(VW / 2 - 110, VH - 13, 220, 11);
    text(c, tip, VW / 2, VH - 11, 5, '#f4efe2', 'center');
  }
  engine(follow[0]);
}
function drawStandings(c, v){
  text(c, ROUTES[G.routeIx].name.toUpperCase(), v.x + v.w / 2, v.y + 10, 7, '#f5c542', 'center');
  const sorted = G.riders.slice().sort((a, b) => place(a) - place(b));
  sorted.forEach((q, i) => {
    const y = v.y + 26 + i * 16, nm = (i + 1) + '. ' + q.name.toUpperCase();
    text(c, nm, v.x + 14, y, fitText(c, nm, v.w - 60, 6), q.color);
    c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(v.x + 14, y + 8, v.w - 28, 2);
    c.fillStyle = q.color; c.fillRect(v.x + 14, y + 8, (v.w - 28) * Math.max(0, Math.min(1, q.x / RT.finish)), 2);
    if(q.item || q.rocketT > 0 || q.shieldT > 0) drawItemIcon(c, q.rocketT > 0 ? 'rocket' : q.item || 'bubble', v.x + v.w - 20, y + 3, 0.8);
  });
}

/* Engine sound for the rider this screen follows */
const Engine = { osc: null, sub: null, gain: null, filt: null };
function engine(r){
  const S0 = A.Sound;
  if(!S0.ctx || S0.ctx.state !== 'running') return;
  if(!Engine.osc){
    const c = S0.ctx;
    Engine.osc = c.createOscillator(); Engine.osc.type = 'sawtooth';
    Engine.sub = c.createOscillator(); Engine.sub.type = 'square';
    Engine.filt = c.createBiquadFilter(); Engine.filt.type = 'lowpass'; Engine.filt.frequency.value = 700;
    Engine.gain = c.createGain(); Engine.gain.gain.value = 0;
    const sg = c.createGain(); sg.gain.value = 0.5;
    Engine.osc.connect(Engine.filt); Engine.sub.connect(sg); sg.connect(Engine.filt); Engine.filt.connect(Engine.gain); Engine.gain.connect(S0.bus);
    Engine.osc.start(); Engine.sub.start();
  }
  const live = r && !G.demo && (G.state === 'race' || G.state === 'count' || G.state === 'finishing') && r.crashT <= 0;
  const t = S0.ctx.currentTime;
  const f = live ? 48 + r.vx * 0.42 + (r.boost ? 22 : 0) + (r.rocketT > 0 ? 40 : 0) + (r.overT > 0 ? -20 : 0) : 40;
  Engine.osc.frequency.setTargetAtTime(f, t, 0.05); Engine.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
  Engine.filt.frequency.setTargetAtTime(live ? 500 + r.vx * 3 : 300, t, 0.08);
  Engine.gain.gain.setTargetAtTime(live ? 0.04 : 0, t, 0.1);
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('BONK');
A.registerOffline();
startDemo();
const boot = () => {
  titleMenu(); A.run(step, render, display);
  const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if(/^[A-Z]{4}$/.test(room) && Net && Net.available()) joinRoom(room);
};
if(document.fonts && document.fonts.load){
  Promise.race([document.fonts.load('10px "Silkscreen"'), new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
} else boot();
window.__brawl = G;
window.__brawlDebug = { Net, RT: () => RT, place, tumble, buildRoute, ROUTES, setRT: t => { RT = t; }, makeRider, stepRider, giveItem, sim, newRace, finishRace };
})();
