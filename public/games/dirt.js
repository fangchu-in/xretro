/* DIRT DASH — side-view motocross for 1–4 players, on one screen or online.
   Gas, turbo (watch the engine temperature), lane changes, and big jumps:
   tilt in the air so you land level. All art and music are original and drawn in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants (world units: "wu") ---------- */
const VW = 384, VH = 216;
const LANES = 4, LANE_H = 11, BOTTOM = 16, WB = 16, RES = 2;
const GRAV = 330, LAUNCH = 34, ACC = 150, DECEL = 70;
const FONT = '"Silkscreen","Courier New",monospace';
const DEG = Math.PI / 180;

const DIFF = {
  kids:   { label: 'Kids',   autoGas: true,  assist: 3.2, noseLimit: -55, tailLimit: 80, heatTurbo: 11, hayCrash: false, bumpCrash: false, cpu: 0.8,  limit: 0 },
  normal: { label: 'Normal', autoGas: false, assist: 0.9, noseLimit: -32, tailLimit: 58, heatTurbo: 22, hayCrash: true,  bumpCrash: true,  cpu: 0.94, limit: 30 },
  pro:    { label: 'Pro',    autoGas: false, assist: 0,   noseLimit: -24, tailLimit: 48, heatTurbo: 30, hayCrash: true,  bumpCrash: true,  cpu: 1.0,  limit: 20 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];
const CPU_RIDERS = [
  { name: 'Ace', color: '#e9ecf1' }, { name: 'Viper', color: '#e2463c' }, { name: 'Bolt', color: '#9b7bff' }, { name: 'Rex', color: '#7fcf5a' }
];

/* ---------- Tracks ----------
   Ground shapes are lists of [distance, height]. Lanes: 0 = nearest, 3 = farthest. */
const SHAPES = {
  bump:   [[0, 0], [20, 8], [40, 0]],
  ramp:   [[0, 0], [60, 26], [66, 26], [76, 0]],
  kick:   [[0, 0], [80, 40], [86, 40], [104, 0]],
  table:  [[0, 0], [50, 22], [150, 22], [200, 0]],
  camel:  [[0, 0], [40, 20], [62, 8], [104, 26], [150, 0]],
  gap:    [[0, 0], [52, 26], [56, 26], [60, 0], [150, 0], [153, 30], [236, 0]],
  biggap: [[0, 0], [70, 36], [74, 36], [78, 0], [196, 0], [199, 38], [300, 0]],
  step:   [[0, 0], [30, 14], [70, 14], [100, 28], [140, 28], [190, 0]]
};
const TRACKS = [
  { name: 'Dusty Hills', sky: ['#5fa3e0', '#bfe0f5'], hills: ['#8fb86a', '#6f9a4f'], dirt: '#a8703f', dirtTop: '#c98b4f', grass: '#4f8a3a',
    items: 'flat 260 | bump | flat 120 | ramp | flat 160 | cool 12 | flat 120 | table | flat 140 | whoops 5 | flat 140 | mud 01 140 | flat 60 | camel | flat 160 | ramp | flat 140 | hay 3 | flat 80 | hay 0 | flat 120 | kick | flat 200 | cool 03 | flat 140 | whoops 6 | flat 120 | table | flat 160 | bump | flat 60 | bump | flat 160 | ramp | flat 300' },
  { name: 'Canyon Leap', sky: ['#e98a4f', '#f7cf8e'], hills: ['#c0683f', '#9a4e2e'], dirt: '#b5653a', dirtTop: '#d9844e', grass: '#8a5a33',
    items: 'flat 240 | ramp | flat 160 | gap | flat 160 | cool 1 | flat 100 | camel | flat 120 | hay 2 | flat 60 | hay 1 | flat 140 | kick | flat 180 | whoops 6 | flat 120 | gap | flat 180 | mud 23 160 | flat 80 | table | flat 140 | cool 2 | flat 120 | biggap | flat 180 | step | flat 160 | ramp | flat 300' },
  { name: 'Monsoon Mud', rain: true, sky: ['#566676', '#8f9eab'], hills: ['#4f7a52', '#3d6242'], dirt: '#7a5236', dirtTop: '#94663f', grass: '#3f6b35',
    items: 'flat 240 | mud 12 180 | flat 80 | bump | flat 100 | ramp | flat 140 | mud 03 200 | flat 60 | cool 12 | flat 80 | camel | flat 140 | whoops 7 | flat 120 | hay 1 | flat 40 | mud 23 140 | flat 100 | table | flat 160 | mud 01 160 | flat 80 | kick | flat 200 | cool 0 | flat 100 | gap | flat 160 | mud 0123 120 | flat 140 | ramp | flat 300' },
  { name: 'Night Rally', night: true, sky: ['#0d1330', '#27305e'], hills: ['#1f2a4a', '#18203a'], dirt: '#6d4a33', dirtTop: '#8a5e3e', grass: '#1f3a2a',
    items: 'flat 240 | kick | flat 160 | hay 0 | flat 30 | hay 3 | flat 140 | camel | flat 120 | cool 23 | flat 120 | gap | flat 150 | whoops 6 | flat 140 | biggap | flat 160 | mud 12 140 | flat 80 | step | flat 140 | hay 2 | flat 60 | hay 1 | flat 140 | table | flat 120 | cool 01 | flat 100 | kick | flat 180 | ramp | flat 300' },
  { name: 'Himalaya Pro', snow: true, sky: ['#7fb0e6', '#dbe9f7'], hills: ['#e8eef5', '#b9c6d6'], dirt: '#8c6a4f', dirtTop: '#a88363', grass: '#dfe7ee',
    items: 'flat 240 | biggap | flat 160 | whoops 8 | flat 100 | hay 3 | flat 30 | hay 0 | flat 120 | gap | flat 140 | cool 12 | flat 100 | kick | flat 160 | camel | flat 120 | mud 01 160 | flat 60 | step | flat 140 | biggap | flat 160 | hay 1 | flat 40 | hay 2 | flat 140 | table | flat 140 | cool 3 | flat 80 | gap | flat 160 | kick | flat 300' }
];

const LAPS = 2;
function buildTrack(def){
  const one = def.items.split('|').map(s => s.trim().split(/\s+/)).map(it => it[0] === 'flat' ? ['flat', String(Math.round(+it[1] * 1.35))] : it);
  const items = [];
  for(let l = 0; l < LAPS; l++){ items.push(...(l ? one.slice(1) : one)); items.push(['lap']); }
  let x = 0; const feats = [], laps = [];
  for(const it of items){
    const k = it[0];
    if(k === 'flat'){ x += +it[1]; continue; }
    if(k === 'lap'){ laps.push(x); x += 120; continue; }
    if(k === 'whoops'){ const n = +it[1]; for(let i = 0; i < n; i++){ feats.push({ kind: 'ground', x, shape: [[0, 0], [12, 6], [24, 0]], lanes: '0123' }); x += 24; } feats.push({ kind: 'whoops', x: x - n * 24, x2: x, lanes: '0123' }); continue; }
    if(k === 'mud'){ feats.push({ kind: 'mud', x, x2: x + (+it[2]), lanes: it[1] }); continue; }
    if(k === 'cool'){ feats.push({ kind: 'cool', x, x2: x + 50, lanes: it[1] }); continue; }
    if(k === 'hay'){ feats.push({ kind: 'hay', x, x2: x + 10, lanes: it[1] }); continue; }
    if(SHAPES[k]){ const sh = SHAPES[k]; feats.push({ kind: 'ground', x, shape: sh, lanes: it[1] || '0123' }); x += sh[sh.length - 1][0]; }
  }
  const len = Math.ceil(x);
  const n = Math.ceil((len + 300) / RES) + 400;
  const g = []; for(let l = 0; l < LANES; l++) g.push(new Float32Array(n));
  for(const f of feats) if(f.kind === 'ground'){
    for(const ch of f.lanes){
      const arr = g[+ch], sh = f.shape;
      for(let i = 0; i < sh.length - 1; i++){
        const [x0, h0] = sh[i], [x1, h1] = sh[i + 1];
        for(let xx = Math.ceil((f.x + x0) / RES); xx * RES <= f.x + x1; xx++){
          const t = x1 === x0 ? 1 : (xx * RES - f.x - x0) / (x1 - x0);
          arr[xx] = Math.max(arr[xx], h0 + (h1 - h0) * t);
        }
      }
    }
  }
  const zones = { mud: [[], [], [], []], cool: [[], [], [], []], hay: [[], [], [], []], whoops: [[], [], [], []] };
  for(const f of feats) if(zones[f.kind]) for(const ch of f.lanes) zones[f.kind][+ch].push([f.x, f.x2]);
  return { def, len: len + 300, g, zones, finish: laps[laps.length - 1], lapLine: laps[0] };
}
let TR = null;
function ground(x, lane){
  const arr = TR.g[Math.max(0, Math.min(3, Math.round(lane)))];
  const f = x / RES, i = Math.floor(f);
  if(i < 0) return 0; if(i >= arr.length - 1) return 0;
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
}
const slopeAt = (x, lane) => (ground(x + 2, lane) - ground(x - 2, lane)) / 4;
const inZone = (kind, x, lane) => TR.zones[kind][Math.max(0, Math.min(3, Math.round(lane)))].some(z => x >= z[0] && x <= z[1]);

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('dirt.diff', 'normal'), trackIx: 0, rivals: A.Store.get('dirt.rivals', true),
  riders: [], players: [], time: 0, stateT: 0, raceT: 0, firstFinish: -1, net: null, results: null
};
if(!DIFF[G.diff]) G.diff = 'normal';
const D = () => DIFF[G.diff];
let netSfx = [];
const S = name => { if(G.demo) return; A.Sound.play(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name); };

/* Game sounds */
const SX = {
  land:    s => s.noise({ t: 0.16, v: 0.18, f: 900, f2: 200 }),
  perfect: s => s.melody([[784, .06], [988, .06], [1175, .06], [1568, .12]], { v: 0.1 }),
  crash:   s => { s.noise({ t: 0.7, v: 0.35, f: 1400, f2: 80 }); s.tone({ wave: 'sawtooth', f: 220, f2: 50, t: 0.5, v: 0.1 }); },
  overheat: s => { for(let i = 0; i < 3; i++) s.tone({ f: 1760, t: 0.08, v: 0.08, at: i * 0.16 }); },
  cool:    s => s.noise({ t: 0.35, v: 0.12, f: 6000, f2: 1500, type: 'highpass' }),
  lane:    s => s.tone({ f: 320, f2: 380, t: 0.05, v: 0.05, wave: 'triangle' }),
  finish:  s => s.melody([[523, .1], [659, .1], [784, .1], [1047, .3]], { v: 0.12 }),
  hay:     s => s.noise({ t: 0.25, v: 0.2, f: 3000, f2: 600, type: 'bandpass' })
};
function sfx(name){ if(G.demo) return; const f = SX[name]; if(f) try{ f(A.Sound); }catch(e){} if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('~' + name); }
function playNetSfx(n){ if(n[0] === '~'){ const f = SX[n.slice(1)]; if(f) try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* Music: an original rock-chip theme */
const DIRT_THEME = {
  bpm: 152, chords: ['E', 'B', 'C#m', 'A', 'E', 'B', 'C#m', 'B'], bass: 'drive', arp: 'fast', leadVol: 0.07,
  lead: [
    'E5 - G#5 - B5 - - - G#5 - E5 - F#5 - G#5 -', 'F#5 - - - D#5 - B4 - D#5 - F#5 - B5 - A5 -',
    'G#5 - - - E5 - C#5 - E5 - G#5 - C#6 - B5 -', 'A5 - - - - - E5 - C#5 - E5 - A5 - B5 -',
    'B5 - - - G#5 - B5 - E6 - - - D#6 - B5 -', 'D#6 - - - B5 - F#5 - B5 - D#6 - F#6 - E6 -',
    'C#6 - B5 - G#5 - E5 - C#5 - E5 - G#5 - B5 -', 'A5 - - - B5 - - - B5 - C#6 - D#6 - - -'],
  drums: ['k.h.s.hkk.h.s.h.', 'k.h.s.hkk.hks.hs', 'k.h.s.hkk.h.s.h.', 'k.hkskhkk.hks.ss']
};

/* ---------- Riders ---------- */
let nextId = 1;
function makeRider(o){
  return Object.assign({ id: nextId++, x: 0, lane: 0, target: 0, h: 0, vy: 0, vx: 0, pitch: 0, air: false, crashT: 0, spin: 0, invT: 0,
    heat: 0, overT: 0, airT: 0, turbo: false, gas: false, wheelie: false, fin: -1, place: 0, cool: 0, laneCool: 0, wheel: 0, msg: '', msgT: 0, perfect: 0 }, o);
}
function setMsg(r, msg){ r.msg = msg; r.msgT = 1.2; }

function controls(r){
  if(r.cpu) return cpuControls(r);
  const s = A.Input.get(r.source), on = !!(s && s.connected);
  return {
    gas: r.fin >= 0 || ((G.state === 'race' || G.state === 'finishing') && (D().autoGas || (on && s.fire))),
    turbo: on && s.right, back: on && s.left,
    up: on && s.up, down: on && s.down, upP: on && A.Input.pressed(s, 'up'), downP: on && A.Input.pressed(s, 'down')
  };
}
function cpuControls(r){
  const c = { gas: true, turbo: false, back: false, up: false, down: false, upP: false, downP: false };
  if(!r.air){
    const lookA = r.x + 40, lookB = r.x + 40 + r.vx * 0.8;
    const bad = l => [0, 1, 2, 3].includes(l) ? (TR.zones.hay[l].some(z => z[1] > lookA - 30 && z[0] < lookB) ? 3 : 0) + (TR.zones.mud[l].some(z => z[1] > lookA && z[0] < lookB) ? 2 : 0) : 99;
    const cur = Math.round(r.lane);
    if(r.laneCool <= 0){
      const here = bad(cur), up = bad(cur + 1), dn = bad(cur - 1);
      const coolBetter = l => r.heat > 55 && [0, 1, 2, 3].includes(l) && TR.zones.cool[l].some(z => z[0] > r.x && z[0] < r.x + 220);
      if(here > 0 || (!coolBetter(cur) && (coolBetter(cur + 1) || coolBetter(cur - 1)))){
        const pick = [[cur + 1, up - (coolBetter(cur + 1) ? 1 : 0)], [cur - 1, dn - (coolBetter(cur - 1) ? 1 : 0)]].sort((a, b) => a[1] - b[1])[0];
        if(pick[1] < here || coolBetter(pick[0])){ if(pick[0] > cur) c.upP = true; else c.downP = true; r.laneCool = 0.5; }
      }
    }
    c.turbo = r.heat < r.skill.heat && !inZone('mud', r.x, r.lane);
  } else {
    // predict where we land and match that slope
    let x = r.x, h = r.h, vy = r.vy;
    for(let i = 0; i < 60; i++){ x += r.vx * 0.03; vy -= GRAV * 0.03; h += vy * 0.03; if(h <= ground(x, r.lane)) break; }
    const want = Math.atan(slopeAt(x, r.lane)) / DEG + r.skill.aim;
    if(r.pitch > want + 6) c.turbo = true; else if(r.pitch < want - 6) c.back = true;
  }
  return c;
}

function crash(r, why){
  if(r.crashT > 0 || r.invT > 0) return;
  r.crashT = G.diff === 'kids' ? 1.0 : 1.5; r.spin = 0; r.air = false; r.turbo = false; setMsg(r, why || 'CRASH!');
  burst(r.x + 8, r.lane, r.h + 4, 14, '#c9a27a');
  sfx('crash');
}
function stepRider(r, dt){
  r.wheel += r.vx * dt;
  if(r.msgT > 0) r.msgT -= dt;
  if(r.invT > 0) r.invT -= dt;
  if(r.laneCool > 0) r.laneCool -= dt;
  if(r.perfect > 0) r.perfect -= dt;
  if(r.crashT > 0){
    r.crashT -= dt; r.spin += dt * 9; r.vx = Math.max(0, r.vx - 260 * dt); r.x += r.vx * dt;
    r.h = Math.max(ground(r.x, r.lane), r.h - 60 * dt);
    if(r.crashT <= 0){ r.h = ground(r.x, r.lane); r.vy = 0; r.pitch = Math.atan(slopeAt(r.x, r.lane)) / DEG; r.invT = 1.6; r.heat = Math.min(r.heat, 40); r.overT = 0; }
    return;
  }
  const c = (G.state === 'race' || G.state === 'finishing' || G.demo || r.fin >= 0) ? controls(r) : { gas: false };
  const d = D();
  r.gas = !!c.gas; r.turbo = !!(c.turbo && c.gas && !r.air); r.wheelie = !!(c.back && !r.air);

  // lane changes (only with wheels on the ground)
  if(!r.air){
    if((c.upP || (c.up && r.laneCool <= 0)) && r.target < 3){ r.target++; r.laneCool = 0.25; if(!r.cpu) sfx('lane'); }
    else if((c.downP || (c.down && r.laneCool <= 0)) && r.target > 0){ r.target--; r.laneCool = 0.25; if(!r.cpu) sfx('lane'); }
  }
  if(r.lane !== r.target){ const dl = Math.sign(r.target - r.lane) * 5 * dt; r.lane = Math.abs(r.target - r.lane) <= Math.abs(dl) ? r.target : r.lane + dl; }

  // engine and temperature
  if(r.overT > 0){ r.overT -= dt; r.heat = Math.max(50, r.heat - 20 * dt); }
  else if(!r.air){
    if(r.turbo) r.heat += (r.cpu ? 18 : d.heatTurbo) * dt; else if(r.gas) r.heat += 1.5 * dt; else r.heat -= 18 * dt;
    if(inZone('cool', r.x, r.lane)){ if(r.heat > 5 && !r.cool) sfx('cool'); r.heat = 0; r.cool = 1; } else r.cool = 0;
    if(r.heat >= 100){ r.heat = 100; r.overT = 2.2; setMsg(r, 'OVERHEAT!'); sfx('overheat'); }
  } else r.heat -= 4 * dt;
  r.heat = Math.max(0, r.heat);

  const cpuScale = r.cpu ? r.skill.speed : 1;
  let target = r.overT > 0 ? 0 : r.turbo ? 250 : r.gas ? 196 : 0;
  target *= cpuScale;
  if(r.fin >= 0) target = 120;
  if(!r.air){
    if(inZone('mud', r.x, r.lane)) target = Math.min(target, 85);
    if(inZone('whoops', r.x, r.lane) && !r.wheelie) target = Math.min(target, 130);
    if(r.vx < target) r.vx = Math.min(target, r.vx + ACC * dt);
    else r.vx = Math.max(target, r.vx - DECEL * (r.overT > 0 ? 1.6 : 1) * dt);
    r.vx -= slopeAt(r.x, r.lane) * 30 * dt;
    r.vx = Math.max(0, r.vx);
  } else r.vx *= 1 - 0.04 * dt;

  // move + ground contact
  const nx = r.x + r.vx * dt, gNew = ground(nx, r.lane);
  if(!r.air){
    const vyG = (gNew - r.h) / dt;
    const sl = (gNew - ground(nx - 2, r.lane)) / 2;
    if(sl > 3 && gNew - r.h > 4){ crash(r, 'OUCH!'); r.vx = 0; return; }       // rode into a wall
    if(r.vy - vyG > LAUNCH && r.vx > 40){ r.air = true; r.airT = 0; r.h += r.vy * dt; }
    else { r.h = gNew; r.vy = vyG; }
    r.x = nx;
    const ang = Math.atan(slopeAt(r.x, r.lane)) / DEG + (r.wheelie ? 24 : 0);
    r.pitch += (ang - r.pitch) * Math.min(1, dt * 14);
  } else {
    r.x = nx; r.vy -= GRAV * dt; r.h += r.vy * dt; r.airT += dt;
    r.pitch += ((c.back ? 1 : 0) - (c.turbo ? 1 : 0)) * 190 * dt;
    if(d.assist && !r.cpu){
      let x = r.x, h = r.h, vy = r.vy;
      for(let i = 0; i < 40; i++){ x += r.vx * 0.03; vy -= GRAV * 0.03; h += vy * 0.03; if(h <= ground(x, r.lane)) break; }
      const want = Math.atan(slopeAt(x, r.lane)) / DEG;
      r.pitch += (want - r.pitch) * Math.min(1, d.assist * dt);
    }
    r.pitch = Math.max(-80, Math.min(85, r.pitch));
    const g = ground(r.x, r.lane);
    if(r.h <= g){
      r.air = false; r.h = g;
      const sl = slopeAt(r.x, r.lane);
      const land = Math.atan(sl) / DEG, diff = r.pitch - land;
      const big = r.airT > 0.38;
      if(r.airT > 0.15) burst(r.x + 2, r.lane, g, big ? 8 : 4, '#d8b58c');
      if(sl > 2.5 || diff < (r.cpu ? -40 : d.noseLimit) || diff > (r.cpu ? 70 : d.tailLimit)){ crash(r, diff < 0 ? 'NOSE DIVE!' : 'LOOPED OUT!'); return; }
      r.vy = r.vx * sl;
      if(big && Math.abs(diff) < 11){ r.vx = Math.min(275, r.vx * 1.12 + 10); r.perfect = 0.6; setMsg(r, 'PERFECT!'); if(!r.cpu) sfx('perfect'); }
      else { if(Math.abs(diff) > 32) r.vx *= 0.72; if(r.airT > 0.15 && !r.cpu) sfx('land'); }
      r.pitch = land + Math.max(-15, Math.min(25, diff * 0.3));
    }
  }

  // hay bales
  if(!r.air || r.h - ground(r.x, r.lane) < 6){
    if(inZone('hay', r.x + WB, r.lane) && r.invT <= 0){
      if(d.hayCrash && !r.cpu) crash(r, 'HAY!');
      else if(r.cpu && r.skill.speed > 0.95) crash(r, 'HAY!');
      else { r.vx *= 0.35; r.invT = 0.8; setMsg(r, 'OOF!'); sfx('hay'); }
    }
  }
  // finishing
  if(!r.lap2 && r.x >= TR.lapLine && r.fin < 0){ r.lap2 = true; if(!r.cpu && G.state === 'race') setMsg(r, 'FINAL LAP!'); }
  if(r.fin < 0 && r.x >= TR.finish && G.state === 'race'){
    r.fin = G.raceT; setMsg(r, place(r) === 1 ? 'WINNER!' : 'FINISH!');
    if(!r.cpu){ sfx('finish'); if(G.firstFinish < 0) G.firstFinish = G.raceT; }
  }
}
function riderCollisions(){
  const R = G.riders;
  for(const a of R) for(const b of R){
    if(a === b || a.air || b.air || a.crashT > 0 || b.crashT > 0 || a.invT > 0) continue;
    if(Math.abs(a.lane - b.lane) > 0.6) continue;
    const gap = b.x - a.x;
    if(gap > 4 && gap < WB + 4 && a.vx > b.vx + 25){
      if(D().bumpCrash && !a.cpu && a.vx > b.vx + 70) crash(a, 'BUMPED!');
      else { a.vx = b.vx * 0.85; a.invT = 0.3; }
    }
  }
}
function place(r){
  const sorted = G.riders.slice().sort((a, b) => (a.fin >= 0 && b.fin >= 0) ? a.fin - b.fin : (a.fin >= 0 ? -1 : b.fin >= 0 ? 1 : b.x - a.x));
  return sorted.indexOf(r) + 1;
}

/* ---------- Cosmetic particles (run on every device from rider state) ---------- */
let parts = [];
function burst(x, lane, h, n, col){
  for(let i = 0; i < n; i++) parts.push({ x, lane, h, vx: (Math.random() - 0.3) * 90, vh: Math.random() * 70 + 10, t: 0, life: 0.5 + Math.random() * 0.4, col, r: 1 + Math.random() * 1.6 });
  if(parts.length > 300) parts.splice(0, parts.length - 300);
}
function fxStep(dt){
  for(const r of G.riders){
    if(r.crashT > 0 || r.air || G.demo && Math.random() < 0.5) continue;
    if(r.gas && r.vx > 20 && Math.random() < (r.turbo ? 0.9 : 0.35))
      parts.push({ x: r.x - 2, lane: r.lane, h: r.h + 1, vx: -r.vx * 0.3 - 20, vh: 20 + Math.random() * 40, t: 0, life: 0.35, col: inZone('mud', r.x, r.lane) ? '#5a3b25' : '#c9a27a', r: 1.2 });
    if(r.overT > 0 && Math.random() < 0.5) parts.push({ x: r.x + 7, lane: r.lane, h: r.h + 8, vx: -10, vh: 30, t: 0, life: 0.8, col: 'rgba(200,200,200,.7)', r: 2.2 });
  }
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.h += p.vh * dt; p.vh -= 160 * dt; }
  parts = parts.filter(p => p.t < p.life);
}

/* ---------- Race flow ---------- */
function setupRace(humans){
  TR = buildTrack(TRACKS[G.trackIx]);
  G.riders = [];
  humans.forEach((p, i) => G.riders.push(makeRider({ human: true, source: p.source, name: p.name, color: p.color, slot: p.slot, lane: i % 4, target: i % 4 })));
  const d = D();
  if((G.rivals || G.demo) && G.riders.length < 4){
    const pool = CPU_RIDERS.slice();
    for(let k = G.riders.length, j = 0; k < 4; k++, j++){
      const c = pool[j];
      const lanes = [0, 1, 2, 3].filter(l => !G.riders.some(r => r.target === l));
      const lane = lanes[0];
      G.riders.push(makeRider({ cpu: true, name: c.name, color: c.color, slot: 10 + j, lane, target: lane,
        skill: { speed: d.cpu * (0.95 + j * 0.03), heat: G.diff === 'pro' ? 88 : G.diff === 'normal' ? 74 : 55, aim: (Math.random() - 0.5) * (G.diff === 'kids' ? 20 : 10) } }));
    }
  }
  G.riders.forEach((r, i) => { r.x = -i * 3; });
  G.raceT = 0; G.firstFinish = -1; G.results = null; parts = [];
}
function startDemo(){
  G.demo = true; G.state = G.state === 'race' ? 'title' : G.state; G.players = [];
  G.trackIx = Math.floor(Math.random() * TRACKS.length);
  setupRace([]);
  for(const r of G.riders){ r.skill.speed = 0.9 + Math.random() * 0.08; r.x = Math.random() * 30; }
  G.demoState = 'race';
}
function newRace(players){
  G.demo = false; G.players = players.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot }));
  setupRace(G.players);
  G.state = 'count'; G.stateT = 0;
  A.Menu.close(); A.keepAwake();
}
function finishRace(){
  G.state = 'results'; G.stateT = 0;
  const order = G.riders.slice().sort((a, b) => place(a) - place(b));
  const key = 'dirt.best.' + G.trackIx + '.' + G.diff, best = A.Store.get(key, 0);
  let newBest = false;
  const humanTimes = order.filter(r => r.human && r.fin >= 0).map(r => r.fin);
  if(humanTimes.length && (!best || Math.min(...humanTimes) < best)){ A.Store.set(key, Math.min(...humanTimes)); newBest = true; }
  G.results = order.map((r, i) => ({ place: i + 1, name: r.name, color: r.color, time: r.fin, cpu: !!r.cpu }));
  S('win');
  const rows = G.results.map(r => '<b style="color:' + r.color + '">' + (r.place) + '. ' + A.esc(r.name) + '</b>' + (r.cpu ? ' <span style="opacity:.6">(rival)</span>' : '') +
    ' · ' + (r.time >= 0 ? fmt(r.time) : r.cpu ? 'still riding' : 'did not finish')).join('<br>');
  const bestNow = A.Store.get(key, 0);
  A.Menu.open({ center: true, shared: true, kicker: TRACKS[G.trackIx].name + ' · ' + D().label, title: G.results[0].cpu ? 'Race over' : A.esc(G.results[0].name) + ' wins!',
    text: rows + (bestNow ? '<br><br>Track record <b>' + fmt(bestNow) + '</b>' + (newBest ? ' · <b>new record!</b>' : '') : ''),
    items: [
      { label: 'Next track', select: () => { G.trackIx = (G.trackIx + 1) % TRACKS.length; newRace(G.players); } },
      { label: 'Race again', select: () => newRace(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  if(G.state === 'race' || G.demo) G.raceT += dt;
  for(const r of G.riders) stepRider(r, dt);
  riderCollisions();
  if(G.demo){ for(const r of G.riders) if(r.x > TR.finish + 150){ r.x = 0; r.h = 0; r.air = false; } return; }
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
  A.Menu.open({ kicker: 'xRetro', title: 'DIRT DASH',
    text: 'Motocross for the whole family. <b>Gas</b> with A, <b>turbo</b> by holding right, and land your jumps <b>level</b>. Up to 4 riders on one screen or online.',
    items: [
      { label: 'Race', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Track', value: () => (G.trackIx + 1) + ' · ' + TRACKS[G.trackIx].name, change: d => { G.trackIx = (G.trackIx + d + TRACKS.length) % TRACKS.length; } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('dirt.diff', G.diff); } },
      { label: 'Rival riders', value: () => G.rivals ? 'On' : 'Off', change: () => { G.rivals = !G.rivals; A.Store.set('dirt.rivals', G.rivals); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: bestLine() });
}
function bestLine(){
  const b = A.Store.get('dirt.best.' + G.trackIx + '.' + G.diff, 0);
  const n = A.Input.pads().length;
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + (b ? 'Record on this track: ' + fmt(b) + '.' : '');
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + TRACKS[G.trackIx].name + ' · ' + D().label,
    title: 'Who is riding?',
    text: online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 riders' + (G.rivals ? '; rival riders fill the empty spots.' : '.'),
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
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart race', select: () => newRace(G.players) }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: TRACKS[G.trackIx].name, title: 'Paused', items, back: resume });
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
      { label: 'Host a race', select: s => hostRoom(s) },
      { label: 'Join with a code', select: () => A.Online.codeEntry(code => joinRoom(code), () => onlineMenu(src, 1)) },
      { label: 'Your name', value: () => A.Names.device() || 'not set', change: () => A.Online.askName(() => onlineMenu(src, 2), () => onlineMenu(src, 2)) },
      { label: 'Back', select: titleMenu }
    ], back: titleMenu });
}
function withName(then, back){ const n = A.Names.device(); if(n) then(n); else A.Online.askName(then, back); }
function hostRoom(src){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Play online', title: 'Opening a room…', items: [] });
    Net.host('dirt', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'dirt', name, netHandlers).then(() => {
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
    text: '<b>A / Space / FIRE</b> gas (automatic in Kids mode) · hold <b>right</b> for turbo · hold <b>left</b> to wheelie over bumps · <b>up/down</b> change lane.<br>' +
          'Turbo heats the engine: too hot and it stalls. Ride over the <b>blue arrows</b> to cool down. Mud slows you; hay bales make you fall.<br>' +
          'In the air, <b>left/right tilt</b> the bike. Land level with the ground for a <b>PERFECT</b> boost; nose-first means a tumble.',
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
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), rt: r2(G.raceT), tr: G.trackIx, d: G.diff, dm: G.demo ? 1 : 0, ff: r2(G.firstFinish),
    r: G.riders.map(r => [r.id, r1(r.x), r2(r.lane), r1(r.h), r1(r.pitch), r1(r.vx), (r.air ? 1 : 0) | (r.gas ? 2 : 0) | (r.turbo ? 4 : 0) | (r.cpu ? 8 : 0) | (r.human ? 16 : 0) | (r.wheelie ? 32 : 0),
      Math.round(r.heat), r2(r.crashT), r2(r.spin), r2(r.overT), r2(r.fin), r2(r.invT), r.name, r.color, r.source || '', r.msgT > 0 ? r.msg : '', r2(r.msgT), r2(r.perfect)]) };
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  Net.broadcast(s);
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!TR || TR.def !== TRACKS[s.tr]){ TR = buildTrack(TRACKS[s.tr]); parts = []; }
  G.trackIx = s.tr; G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.raceT = a.st === b.st ? L(a.rt, b.rt) : b.rt; G.firstFinish = s.ff;
  const prev = new Map(a.r.map(r => [r[0], r]));
  G.riders = s.r.map(q => {
    const o = prev.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60;
    const f = q[6];
    return { id: q[0], x: near ? L(o[1], q[1]) : q[1], lane: near ? L(o[2], q[2]) : q[2], h: near ? L(o[3], q[3]) : q[3], pitch: near ? L(o[4], q[4]) : q[4], vx: q[5],
      air: !!(f & 1), gas: !!(f & 2), turbo: !!(f & 4), cpu: !!(f & 8), human: !!(f & 16), wheelie: !!(f & 32),
      heat: q[7], crashT: q[8], spin: near ? L(o[9], q[9]) : q[9], overT: q[10], fin: q[11], invT: q[12], name: q[13], color: q[14], source: q[15], msg: q[16], msgT: q[17], perfect: q[18],
      wheel: (near ? L(o[1], q[1]) : q[1]) };
  });
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  if(G.demo || G.state === 'title' || G.state === 'lobby' || G.state === 'online') want = A.THEMES.menu;
  else if(G.state === 'race' || G.state === 'paused' || G.state === 'count' || G.state === 'finishing') want = DIRT_THEME;
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(G.state === 'paused' || G.state === 'results');
}
function myRiders(){
  const hum = G.riders.filter(r => r.human);
  const mine = hum.filter(r => G.net === 'guest' ? Net.isMine(r.source) : !String(r.source).includes('/'));
  return (mine.length ? mine : hum).slice(0, 4);
}
function step(dt){
  G.time += dt;
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = (G.state === 'race' || G.state === 'count') && myRiders().some(r => r.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); }
    Net.setPlaying(G.state === 'race' || G.state === 'count');
    music(); return;
  }
  const wantTouch = (G.state === 'race' || G.state === 'count') && G.riders.some(r => r.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('GAS'); }
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
      sim(dt); break;
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
const ordinal = n => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

function drawView(c, v, r, dt){
  const td = TR.def;
  const visH = v.h > 150 ? 150 : 112;
  const s = v.h / visH;
  const cam = cams.get(r.id) || { x: r.x - 60, h: 0 };
  cam.x = r.x - (v.w / s) * 0.3;
  cam.h += (Math.max(0, r.h - visH * 0.55) - cam.h) * Math.min(1, dt * 5);
  cams.set(r.id, cam);
  const X = wx => v.x + (wx - cam.x) * s;
  const Y = (lane, h) => v.y + v.h - (h + lane * LANE_H + BOTTOM - cam.h) * s;
  c.save(); c.beginPath(); c.rect(v.x, v.y, v.w, v.h); c.clip();

  // sky
  const sky = c.createLinearGradient(0, v.y, 0, v.y + v.h);
  sky.addColorStop(0, td.sky[0]); sky.addColorStop(1, td.sky[1]);
  c.fillStyle = sky; c.fillRect(v.x, v.y, v.w, v.h);
  if(td.night){
    c.fillStyle = '#dfe6ff';
    for(let i = 0; i < 40; i++){ const sx = v.x + ((rng(i) * 900 - cam.x * 0.05) % v.w + v.w) % v.w, sy = v.y + rng(i + 99) * v.h * 0.5; c.fillRect(sx, sy, 0.8, 0.8); }
    c.fillStyle = '#f4f1dc'; c.beginPath(); c.arc(v.x + v.w * 0.8, v.y + v.h * 0.18, 7 * s, 0, 7); c.fill();
  } else if(!td.rain){ c.fillStyle = 'rgba(255,245,200,.9)'; c.beginPath(); c.arc(v.x + v.w * 0.82, v.y + v.h * 0.2, 9 * s, 0, 7); c.fill(); }
  // hills (parallax)
  for(let layer = 0; layer < 2; layer++){
    const par = layer ? 0.35 : 0.15, base = Y(4, 40 + (1 - layer) * 16), amp = (layer ? 18 : 30) * s;
    c.fillStyle = td.hills[layer]; c.beginPath(); c.moveTo(v.x, v.y + v.h);
    for(let sx = 0; sx <= v.w + 6; sx += 6){
      const wx = cam.x * par + sx / s;
      const hgt = (Math.sin(wx * 0.011 + layer * 2) * 0.5 + Math.sin(wx * 0.027 + layer) * 0.3 + 0.8) * amp;
      c.lineTo(v.x + sx, base - hgt);
    }
    c.lineTo(v.x + v.w, v.y + v.h); c.fill();
    if(td.snow && layer === 0){ c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(v.x, base - amp * 1.6, v.w, amp * 0.2); }
  }
  // crowd stands and barrier
  const standTop = Y(4, 34), standBot = Y(4, 6);
  c.fillStyle = td.night ? '#1d2236' : '#3d4150'; c.fillRect(v.x, standTop, v.w, standBot - standTop);
  const cs = 5 * s, cw = Math.max(1, cs * 0.7);
  const bounce = Math.sin(G.time * 12);
  for(let row = 0; row < 4; row++){
    const yy = standTop + (row + 0.6) * (standBot - standTop) / 4.4;
    const startW = Math.floor(cam.x / 5) - 1;
    for(let k = 0; k < v.w / s / 5 + 2; k++){
      const wi = startW + k + row * 1000, sx = X((startW + k) * 5 + (row % 2) * 2.5);
      const hue = ['#f5c542', '#e2463c', '#3fd0b0', '#7aa8ff', '#ff7eb6', '#f4efe2', '#ff9f43'][Math.floor(rng(wi) * 7)];
      c.fillStyle = hue; c.fillRect(sx, yy - (rng(wi + 7) > 0.6 ? Math.max(0, bounce) * s : 0), cw, cw);
    }
  }
  c.fillStyle = td.night ? '#c9cfe0' : '#f4efe2'; c.fillRect(v.x, standBot, v.w, 2.2 * s);
  for(let k = Math.floor(cam.x / 40); k < cam.x / 40 + v.w / s / 40 + 1; k++){ c.fillStyle = k % 2 ? '#e2463c' : '#f4efe2'; c.fillRect(X(k * 40), standBot + 2.2 * s, 40 * s, 1.6 * s); }
  if(td.night){ for(let k = Math.floor(cam.x / 260); k < cam.x / 260 + 3; k++){ const lx = X(k * 260 + 60); c.fillStyle = '#6a7090'; c.fillRect(lx, standTop - 30 * s, 1.5 * s, 30 * s); c.fillStyle = 'rgba(255,248,210,.95)'; c.fillRect(lx - 4 * s, standTop - 32 * s, 9 * s, 3 * s); } }

  // lanes, far to near, with riders in each lane
  const x0 = cam.x, x1 = cam.x + v.w / s;
  const byLane = [[], [], [], []];
  for(const q of G.riders) if(q.x > x0 - 40 && q.x < x1 + 30) byLane[Math.max(0, Math.min(3, Math.round(q.lane)))].push(q);
  for(let L = 3; L >= 0; L--){
    const shadeK = 1 - L * 0.06;
    const dirt = shade(td.dirt, shadeK), top = shade(td.dirtTop, shadeK);
    const baseY = Y(L, 0), botY = baseY + LANE_H * s + 0.5;
    c.fillStyle = dirt; c.beginPath(); c.moveTo(v.x, botY);
    const step = 3;
    const pts = [];
    for(let sx = 0; sx <= v.w + step; sx += step){ const wx = x0 + sx / s; const y = Y(L, ground(wx, L)); pts.push(y); c.lineTo(v.x + sx, y); }
    c.lineTo(v.x + v.w + step, botY); c.fill();
    // lit slopes and crest
    c.lineWidth = Math.max(1, 1.6 * s);
    for(let i = 1; i < pts.length; i++){
      const d = pts[i] - pts[i - 1];
      c.strokeStyle = d < -0.3 ? shade(td.dirtTop, shadeK * 1.15) : d > 0.3 ? shade(td.dirt, shadeK * 0.8) : top;
      c.beginPath(); c.moveTo(v.x + (i - 1) * step, pts[i - 1] + 0.6 * s); c.lineTo(v.x + i * step, pts[i] + 0.6 * s); c.stroke();
    }
    // lane line
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = Math.max(0.6, 0.7 * s); c.setLineDash([6 * s, 6 * s]); c.lineDashOffset = cam.x * s;
    c.beginPath(); for(let i = 0; i < pts.length; i++){ const y = pts[i] + LANE_H * s; i ? c.lineTo(v.x + i * step, y) : c.moveTo(v.x, y); } c.stroke(); c.setLineDash([]);
    // zones on this lane
    for(const z of TR.zones.mud[L]) if(z[1] > x0 && z[0] < x1){ c.fillStyle = 'rgba(58,36,22,.8)'; c.beginPath(); c.ellipse(X((z[0] + z[1]) / 2), baseY + LANE_H * s * 0.5, (z[1] - z[0]) * s / 2, LANE_H * s * 0.38, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(120,90,60,.5)'; for(let k = 0; k < (z[1] - z[0]) / 20; k++) c.fillRect(X(z[0] + 10 + k * 20), baseY + LANE_H * s * (0.3 + rng(k + z[0]) * 0.4), 4 * s, 0.8 * s); }
    for(const z of TR.zones.cool[L]) if(z[1] > x0 && z[0] < x1){
      for(let k = 0; k < 3; k++){ const ax = X(z[0] + 8 + k * 14), ay = baseY + LANE_H * s * 0.5;
        c.fillStyle = (Math.floor(G.time * 8) + k) % 3 === 0 ? '#bff0ff' : '#3fb0e8';
        c.beginPath(); c.moveTo(ax, ay - 3.5 * s); c.lineTo(ax + 6 * s, ay); c.lineTo(ax, ay + 3.5 * s); c.lineTo(ax + 2 * s, ay); c.fill(); }
    }
    for(const z of TR.zones.hay[L]) if(z[1] > x0 && z[0] < x1){
      const hx = X(z[0]), hy = baseY + LANE_H * s * 0.75, w = 10 * s, h = 8 * s;
      c.fillStyle = '#d9b24a'; c.fillRect(hx, hy - h, w, h); c.fillStyle = '#b08a2e'; c.fillRect(hx, hy - h * 0.6, w, 0.8 * s); c.fillRect(hx, hy - h * 0.25, w, 0.8 * s);
      c.fillStyle = '#f0d27a'; c.fillRect(hx, hy - h, w, 1 * s);
    }
    // start / finish gates
    for(const gx of [0, TR.lapLine, TR.finish]) if(gx > x0 - 20 && gx < x1 + 20){
      const fx = X(gx);
      for(let k = 0; k < 6; k++){ c.fillStyle = k % 2 ? '#111' : '#f4efe2'; c.fillRect(fx, baseY + k * LANE_H * s / 6, 3 * s, LANE_H * s / 6 + 0.3); }
    }
    for(const q of byLane[L].sort((a, b) => a.x - b.x)) drawRider(c, q, X(q.x), Y(q.lane, q.h), s, q === r);
  }
  // finish banner
  if(TR.finish > x0 - 40 && TR.finish < x1 + 40){
    const fx = X(TR.finish), topY = Y(4, 46), bot = Y(0, 0) + LANE_H * s;
    c.fillStyle = '#e8e8ee'; c.fillRect(fx - 21 * s, topY, 1.6 * s, bot - topY); c.fillRect(fx + 19 * s, topY, 1.6 * s, bot - topY);
    for(let k = 0; k < 10; k++) for(let j = 0; j < 2; j++){ c.fillStyle = (k + j) % 2 ? '#111' : '#fff'; c.fillRect(fx - 20 * s + k * 4 * s, topY + j * 4 * s, 4 * s, 4 * s); }
    outlined(c, 'FINISH', fx, topY - 5 * s, 6 * s, '#f5c542');
  }
  // grass strip at the front
  c.fillStyle = td.grass; c.fillRect(v.x, Y(0, 0) + LANE_H * s, v.w, v.h);
  // particles
  for(const p of parts){ if(p.x < x0 - 10 || p.x > x1 + 10) continue; c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col; c.fillRect(X(p.x) - p.r * s / 2, Y(p.lane, p.h) + LANE_H * s * 0.45 - p.r * s / 2, p.r * s, p.r * s); }
  c.globalAlpha = 1;
  // weather
  if(td.rain){ c.strokeStyle = 'rgba(200,215,235,.5)'; c.lineWidth = 0.8; c.beginPath();
    for(let i = 0; i < 60; i++){ const rx = v.x + ((rng(i) * v.w + G.time * 60 - cam.x * s * 0.2) % v.w + v.w) % v.w, ry = v.y + ((rng(i + 5) * v.h + G.time * 420) % v.h); c.moveTo(rx, ry); c.lineTo(rx - 2, ry + 7); } c.stroke(); }
  if(td.night){ const g = c.createRadialGradient(X(r.x + 10), Y(r.lane, r.h + 8), 4, X(r.x + 10), Y(r.lane, r.h + 8), v.w * 0.7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,.35)'); c.fillStyle = g; c.fillRect(v.x, v.y, v.w, v.h); }

  drawViewHUD(c, v, r);
  c.restore();
}

function drawRider(c, r, sx, sy, s, focus){
  if(r.invT > 0 && r.crashT <= 0 && Math.floor(G.time * 12) % 2) return;
  const col = r.color;
  sy += LANE_H * s * 0.62;
  // shadow
  const gy = sy + (r.h - ground(r.x, r.lane)) * s;
  c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(sx + 8 * s, gy, 9 * s, 1.4 * s, 0, 0, 7); c.fill();
  c.save(); c.translate(sx, sy); c.scale(s, s);
  if(r.crashT > 0){
    // tumbling bike and rider
    c.save(); c.translate(8, -4); c.rotate(r.spin); drawBike(c, r, true); c.restore();
    c.save(); c.translate(-6 + (1.5 - r.crashT) * 12, -4 - Math.abs(Math.sin(r.spin * 0.7)) * 8); c.rotate(-r.spin * 0.8); drawRiderBody(c, col, true); c.restore();
    c.restore(); return;
  }
  c.rotate(-r.pitch * DEG);
  if(r.turbo && Math.floor(G.time * 30) % 2){ c.fillStyle = '#ff9f43'; c.beginPath(); c.moveTo(-1, -6); c.lineTo(-7 - Math.random() * 3, -5); c.lineTo(-1, -4); c.fill(); }
  drawBike(c, r, false);
  drawRiderBody(c, col, false, r);
  c.restore();
  if(!focus && !G.demo) outlined(c, r.name.toUpperCase(), sx + 8 * s, sy - 30 * s, Math.max(4, 4.2 * s), col);
  if(r.msgT > 0 && r.msg){ outlined(c, r.msg, sx + 8 * s, sy - 38 * s - (1.2 - r.msgT) * 10 * s, Math.max(5, 6 * s), r.msg === 'PERFECT!' ? '#7fe3ff' : r.msg.includes('!') && r.msg !== 'FINISH!' && r.msg !== 'WINNER!' ? '#ff8a6a' : '#f5c542'); }
}
function drawBike(c, r, loose){
  const wa = (r.wheel || 0) * 0.35;
  const wheel = (x) => {
    c.strokeStyle = '#17181d'; c.lineWidth = 2.2; c.beginPath(); c.arc(x, -4, 3.6, 0, 7); c.stroke();
    c.strokeStyle = '#8a8f9c'; c.lineWidth = 0.5;
    for(let k = 0; k < 3; k++){ const a = wa + k * Math.PI / 3; c.beginPath(); c.moveTo(x - Math.cos(a) * 3, -4 - Math.sin(a) * 3); c.lineTo(x + Math.cos(a) * 3, -4 + Math.sin(a) * 3); c.stroke(); }
  };
  wheel(0); wheel(WB);
  // frame
  c.strokeStyle = r.color; c.lineWidth = 1.7; c.lineCap = 'round';
  c.beginPath(); c.moveTo(0, -4); c.lineTo(6, -7); c.lineTo(12, -10.5); c.lineTo(WB, -4); c.stroke();
  c.strokeStyle = '#2a2d36'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(6, -7); c.lineTo(9, -4.5); c.lineTo(13, -9); c.stroke();
  // engine, tank, seat, number plate
  c.fillStyle = '#3a3e4a'; c.fillRect(5.5, -7.2, 4.5, 3.4);
  c.fillStyle = r.color; c.beginPath(); c.moveTo(4, -9.5); c.lineTo(12, -11.5); c.lineTo(12, -9); c.lineTo(5, -8); c.fill();
  c.fillStyle = '#1b1d24'; c.fillRect(1.5, -10, 6, 1.4);
  c.fillStyle = '#f4efe2'; c.fillRect(12.4, -12.8, 3, 3);
  c.strokeStyle = '#c8ccd6'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(12.5, -11); c.lineTo(11, -14); c.lineTo(13, -14.3); c.stroke();
  // exhaust
  c.fillStyle = '#9aa0ab'; c.fillRect(-1.5, -7.6, 4.5, 1.1);
  void loose;
}
function drawRiderBody(c, col, loose, r){
  const lean = r && r.turbo ? 1.5 : r && r.wheelie ? -1 : 0;
  c.strokeStyle = '#2b2f3a'; c.lineWidth = 2.2; c.lineCap = 'round';
  if(loose){ c.beginPath(); c.moveTo(0, 0); c.lineTo(-3, 5); c.moveTo(0, 0); c.lineTo(3, 5); c.stroke(); c.strokeStyle = col; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -7); c.stroke(); c.fillStyle = col; c.beginPath(); c.arc(0, -10, 2.8, 0, 7); c.fill(); return; }
  // legs
  c.beginPath(); c.moveTo(5, -9.5); c.lineTo(8.5, -7.5); c.lineTo(7.5, -5); c.stroke();
  // torso
  c.strokeStyle = col; c.lineWidth = 2.6;
  c.beginPath(); c.moveTo(5, -10); c.lineTo(7 + lean, -16.5); c.stroke();
  // arms
  c.strokeStyle = shade(col, 0.75); c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(7.3 + lean, -15.5); c.lineTo(10.5, -13.5); c.lineTo(12, -14); c.stroke();
  // helmet + visor
  c.fillStyle = col; c.beginPath(); c.arc(8 + lean, -19.5, 2.9, 0, 7); c.fill();
  c.fillStyle = '#1b1d24'; c.fillRect(8.8 + lean, -20.3, 2.4, 1.3);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(6.6 + lean, -21.6, 2, 0.8);
}
function drawViewHUD(c, v, r){
  const small = v.h < 150, k = small ? 0.62 : 1;
  const pad = 4 * k + 2;
  // position + name
  const pl = G.demo ? 0 : place(r);
  if(!G.demo){
    outlined(c, ordinal(pl), v.x + pad + 14 * k, v.y + pad + 7 * k, 12 * k, pl === 1 ? '#f5c542' : '#f4efe2', 'center');
    text(c, r.name.toUpperCase(), v.x + pad + 30 * k, v.y + pad + 2 * k, 6 * k, r.color);
    // timer
    const tm = r.fin >= 0 ? r.fin : Math.max(0, G.raceT);
    text(c, fmt(tm), v.x + v.w - pad, v.y + pad + 2 * k, 7 * k, '#f4efe2', 'right');
    text(c, r.fin >= 0 ? 'DONE' : 'LAP ' + (r.x < TR.lapLine ? 1 : 2) + '/2', v.x + v.w - pad, v.y + pad + 12 * k, 5 * k, r.x >= TR.lapLine && r.fin < 0 ? '#f5c542' : '#9d9cab', 'right');
    // temperature
    const bw = 44 * k, bh = 3.5 * k, bx = v.x + pad + 1, by = v.y + pad + 26 * k;
    text(c, r.overT > 0 ? 'OVERHEAT' : 'ENGINE TEMP', bx, by - 7 * k, 4.5 * k, r.overT > 0 && Math.floor(G.time * 6) % 2 ? '#ff5a4e' : '#f4efe2');
    c.fillStyle = 'rgba(10,10,14,.65)'; c.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    const hcol = r.heat > 80 ? (Math.floor(G.time * 8) % 2 ? '#ff5a4e' : '#ff9f43') : r.heat > 55 ? '#ff9f43' : '#3fd0b0';
    c.fillStyle = hcol; c.fillRect(bx, by, bw * Math.min(1, r.heat / 100), bh);
    // progress bar with every rider
    const px = v.x + v.w * 0.3, pw = v.w * 0.4, py = v.y + pad + 4 * k;
    c.fillStyle = 'rgba(10,10,14,.55)'; c.fillRect(px, py, pw, 2.5 * k);
    for(const q of G.riders){ const f = Math.max(0, Math.min(1, q.x / TR.finish)); c.fillStyle = q.color; c.fillRect(px + f * pw - 1.5 * k, py - 1.5 * k, 3 * k, 5.5 * k); }
    if(G.firstFinish >= 0 && r.fin < 0 && D().limit){
      const left = Math.max(0, D().limit - (G.raceT - G.firstFinish));
      outlined(c, 'FINISH IN ' + Math.ceil(left), v.x + v.w / 2, v.y + pad + 16 * k, 7 * k, '#ff8a6a');
    }
  }
  // countdown lights
  if(G.state === 'count'){
    const n = Math.ceil(3 - G.stateT), cx = v.x + v.w / 2, cy = v.y + v.h * 0.35;
    c.fillStyle = 'rgba(10,10,14,.8)'; c.fillRect(cx - 40 * k, cy - 10 * k, 80 * k, 20 * k);
    for(let i = 0; i < 3; i++){ c.fillStyle = i < 4 - n ? '#ff5a4e' : '#3a1c1c'; c.beginPath(); c.arc(cx - 22 * k + i * 22 * k, cy, 6.5 * k, 0, 7); c.fill(); }
    outlined(c, n > 0 ? String(n) : 'GO!', cx, cy + 24 * k, 16 * k, '#f5c542');
  } else if(G.state === 'race' && G.raceT < 1){ outlined(c, 'GO!', v.x + v.w / 2, v.y + v.h * 0.35, 22 * k, '#3fd07a'); }
}

let lastT = 0;
function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  if(!TR || !G.riders.length){ return; }
  fxStep(Math.min(dt, 0.05));
  c.setTransform(s, 0, 0, s, 0, 0);
  const follow = G.demo ? [G.riders[0]] : myRiders();
  const n = follow.length;
  const views = n <= 1 ? [{ x: 0, y: 0, w: VW, h: VH }]
    : n === 2 ? [{ x: 0, y: 0, w: VW, h: VH / 2 - 1 }, { x: 0, y: VH / 2 + 1, w: VW, h: VH / 2 - 1 }]
    : [{ x: 0, y: 0, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: VW / 2 + 1, y: 0, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: 0, y: VH / 2 + 1, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: VW / 2 + 1, y: VH / 2 + 1, w: VW / 2 - 1, h: VH / 2 - 1 }];
  follow.forEach((r, i) => drawView(c, views[i], r, dt));
  if(n === 3){ const v = views[3]; c.fillStyle = '#14161d'; c.fillRect(v.x, v.y, v.w, v.h); drawMiniMap(c, v); }
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.3)'; c.fillRect(0, 0, VW, VH); }
  engine(follow[0]);
  lastT = G.time;
}
function drawMiniMap(c, v){
  text(c, TRACKS[G.trackIx].name.toUpperCase(), v.x + v.w / 2, v.y + 10, 7, '#f5c542', 'center');
  const sorted = G.riders.slice().sort((a, b) => place(a) - place(b));
  sorted.forEach((q, i) => { text(c, (i + 1) + '. ' + q.name.toUpperCase(), v.x + 14, v.y + 26 + i * 12, 6, q.color); });
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
  const f = live ? 48 + r.vx * 0.42 + (r.turbo ? 22 : 0) + (r.air ? 18 : 0) + (r.overT > 0 ? -20 : 0) : 40;
  Engine.osc.frequency.setTargetAtTime(f, t, 0.05); Engine.sub.frequency.setTargetAtTime(f / 2, t, 0.05);
  Engine.filt.frequency.setTargetAtTime(live ? 500 + r.vx * 3 : 300, t, 0.08);
  Engine.gain.gain.setTargetAtTime(live ? (r.gas ? 0.05 : 0.025) : 0, t, 0.1);
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('GAS');
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
window.__dirt = G;
window.__dirtDebug = { Net, TR: () => TR, place, crash, ground };
})();
