/* VOLT GP — retro electric Grand Prix racing for 1–4 drivers, on one screen or online.
   Behind-the-car view on a 3-lane track with curves, hills, tunnels and night races.
   The car accelerates on its own. LEFT/RIGHT change lane, DOWN brakes (and regenerates energy),
   hold FIRE to BOOST with stored battery energy, UP asks the team to "box" for a pit stop.
   Formula-style extras: Attack Mode pads, DRS zones, slipstream, Pit Boost stops, safety car,
   start lights, fastest laps, a podium and a championship. All art, music and sound are original, made in code.
   Real city/circuit place names only: no official series, team, driver or sponsor names or logos. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants ---------- */
const VW = 384, VH = 216;
const FONT = '"Silkscreen","Courier New",monospace';
const SEG = 200;             // segment length (world units)
const ROADW = 2000;          // half the road width
const LANES = [-2 / 3, 0, 2 / 3];
const CAM_H = 800, CAM_BACK = 1400, FOV_DEPTH = 1 / Math.tan(50 * Math.PI / 180);
const DRAW = 130;            // segments drawn ahead
const MAXV = 9200;           // top speed (world units / s)  ~ 320 km/h on the dash
const KMH = 320 / MAXV;
const ACC = 4200, BRAKE = 9500, COAST = 900;
const CAR_W = 0.36, CAR_L = 700;     // car width (road half-widths) and length (world units)
const PUSH = 4.0, STEER = 2.1;       // corner push at full speed on the hardest bend, and steering strength

const DIFF = {
  kids:   { label: 'Kids',   cpu: 0.84,  drain: 0.6, floor: 22, wallSlow: 0.85, spin: false, push: 0.72, sc: false, limit: 0 },
  normal: { label: 'Normal', cpu: 0.965, drain: 1.0, floor: 0,  wallSlow: 0.6,  spin: true,  push: 1.0,  sc: true,  limit: 40 },
  pro:    { label: 'Pro',    cpu: 1.0, drain: 1.15, floor: 0, wallSlow: 0.5,  spin: true,  push: 1.1,  sc: true,  limit: 30 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];
const LENGTHS = [{ label: 'Short', laps: 3 }, { label: 'Medium', laps: 5 }, { label: 'Long', laps: 8 }];
const WEATHER = ['Auto', 'Dry', 'Wet'];
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4];
const RIVALS = [   // colours kept clear of the four player colours (yellow, teal, blue, pink)
  { name: 'Zap', color: '#e2463c', skill: 1.0 }, { name: 'Volty', color: '#e9ecf1', skill: 0.99 }, { name: 'Jolt', color: '#9b7bff', skill: 0.98 },
  { name: 'Flux', color: '#ff9f43', skill: 0.97 }, { name: 'Dynamo', color: '#3fd07a', skill: 0.96 }, { name: 'Ohmi', color: '#a0703c', skill: 0.95 },
  { name: 'Coil', color: '#5b6275', skill: 0.94 }
];

/* ---------- Sounds ---------- */
const SX = {
  boost:  s => { s.tone({ wave: 'sawtooth', f: 300, f2: 1400, t: 0.35, v: 0.06 }); s.noise({ t: 0.3, v: 0.06, f: 6000, f2: 2500, type: 'highpass' }); },
  regen:  s => s.tone({ wave: 'sine', f: 1400, f2: 600, t: 0.25, v: 0.05 }),
  attack: s => s.melody([[784, .05], [1047, .05], [1319, .05], [1568, .14]], { wave: 'triangle', v: 0.11 }),
  drs:    s => { s.tone({ f: 900, t: 0.05, v: 0.06 }); s.tone({ f: 1350, t: 0.08, v: 0.06, at: 0.06 }); },
  bump:   s => { s.noise({ t: 0.12, v: 0.16, f: 900, f2: 200 }); s.tone({ wave: 'triangle', f: 220, f2: 90, t: 0.1, v: 0.12 }); },
  wall:   s => { s.noise({ t: 0.25, v: 0.2, f: 2400, f2: 300 }); s.tone({ wave: 'square', f: 140, f2: 60, t: 0.18, v: 0.08 }); },
  spin:   s => { s.noise({ t: 0.7, v: 0.12, f: 3000, f2: 800, type: 'bandpass' }); s.tone({ wave: 'sine', f: 900, f2: 300, t: 0.6, v: 0.07 }); },
  squeal: s => s.noise({ t: 0.2, v: 0.05, f: 3200, f2: 2600, type: 'bandpass', q: 8 }),
  light:  s => s.tone({ wave: 'square', f: 440, t: 0.12, v: 0.08 }),
  lightsOut: s => { s.tone({ wave: 'square', f: 880, t: 0.3, v: 0.1 }); },
  lap:    s => s.melody([[784, .06], [1047, .1]], { v: 0.09 }),
  finalLap: s => s.melody([[659, .08], [784, .08], [988, .08], [1319, .2]], { v: 0.1 }),
  purple: s => s.melody([[1047, .05], [1319, .05], [1568, .05], [2093, .12]], { wave: 'triangle', v: 0.09 }),
  pass:   s => s.melody([[880, .05], [1320, .09]], { v: 0.07 }),
  lost:   s => s.melody([[660, .06], [440, .1]], { wave: 'triangle', v: 0.06 }),
  radio:  s => { s.noise({ t: 0.06, v: 0.05, f: 2500, type: 'bandpass' }); s.tone({ f: 1200, t: 0.04, v: 0.04, at: 0.06 }); },
  box:    s => s.melody([[523, .07], [523, .07]], { wave: 'triangle', v: 0.1 }),
  pitGo:  s => s.melody([[523, .05], [784, .05], [1047, .1]], { v: 0.1 }),
  charge: s => s.tone({ wave: 'sine', f: 300, f2: 1200, t: 0.6, v: 0.06 }),
  empty:  s => { for(let i = 0; i < 3; i++) s.tone({ f: 330, t: 0.08, v: 0.07, at: i * 0.14 }); },
  sc:     s => { for(let i = 0; i < 4; i++) s.tone({ f: i % 2 ? 700 : 900, t: 0.12, v: 0.07, at: i * 0.15 }); },
  green:  s => s.melody([[659, .06], [880, .06], [1175, .14]], { v: 0.1 }),
  flag:   s => s.melody([[523, .1], [659, .1], [784, .1], [1047, .12], [784, .08], [1047, .3]], { v: 0.12 })
};
let netSfx = [];
function sfx(name){ if(G.demo) return; const f = SX[name]; if(f) try{ f(A.Sound); }catch(e){} if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('~' + name); }
function S(name){ if(G.demo) return; A.Sound.play(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name); }
function playNetSfx(n){ if(n[0] === '~'){ const f = SX[n.slice(1)]; if(f) try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* ---------- Music (all original) ---------- */
const VOLT_THEME = {
  bpm: 148, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B'], bass: 'drive', arp: 'fast', leadWave: 'sawtooth', leadVol: 0.05,
  lead: [
    'E5 - G5 - B5 - - - A5 - G5 - E5 - F#5 -', 'G5 - - - E5 - C5 - E5 - G5 - C6 - B5 -',
    'B5 - - - D6 - B5 - G5 - - - A5 - B5 -', 'A5 - - - F#5 - D5 - F#5 - A5 - D6 - - -',
    'E6 - - - D6 - B5 - G5 - B5 - E6 - D6 -', 'C6 - - - B5 - G5 - E5 - G5 - C6 - E6 -',
    'C6 - B5 - A5 - E5 - A5 - C6 - E6 - C6 -', 'B5 - - - D#6 - - - F#6 - - - B5 - - -'],
  drums: ['k.h.s.hkk.h.s.h.', 'k.hhs.hkk.h.s.hs', 'k.h.s.hkk.h.s.h.', 'k.hks.hkk.hkssss']
};
const NIGHT_THEME = {
  bpm: 128, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'], bass: 'pulse', arp: 'fast', arpOct: 1, leadWave: 'pulse25', leadVol: 0.06,
  lead: [
    'A4 - - - C5 - E5 - - - A5 - G5 - E5 -', 'F5 - - - - - C5 - F5 - A5 - C6 - - -',
    'G5 - - - E5 - C5 - - - E5 - G5 - C6 -', 'B5 - - - - - G5 - D5 - G5 - B5 - - -',
    'C6 - - - B5 - A5 - - - E5 - A5 - C6 -', 'A5 - - - F5 - - - C6 - - - A5 - F5 -',
    'D5 - F5 - A5 - D6 - - - C6 - A5 - F5 -', 'E5 - - - G#5 - - - B5 - - - E6 - - -'],
  drums: ['k...h.k.s...h...', 'k...h.k.s..kh.h.', 'k...h.k.s...h...', 'k.k.h.k.s.s.hsss']
};
const INDIA_THEME = {
  bpm: 140, chords: ['Dm', 'C', 'Dm', 'A', 'Dm', 'Gm', 'C', 'A'], bass: 'drive', arp: 'fast', sitar: true, leadVol: 0.085, drone: true, droneRoot: 'D3',
  lead: [
    'D5 - E5 - F5 - A5 - - - G5 - F5 - E5 -', 'E5 - - - G5 - E5 - C5 - D5 - E5 - - -',
    'F5 - - - A5 - D6 - - - C6 - A5 - F5 -', 'E5 - - - C#5 - E5 - A5 - - - G5 - E5 -',
    'D6 - - - C6 - A5 - F5 - A5 - D6 - - -', 'D6 - C6 - A#5 - G5 - A#5 - - - D6 - C6 -',
    'C6 - - - A#5 - G5 - E5 - G5 - C6 - E6 -', 'E6 - - - C#6 - - - A5 - - - E5 - - -'],
  drums: ['d.tnk.t.d.tns.t.', 'd.tnk.tnd.t.s.tt', 'd.tnk.t.d.tns.t.', 'g.tng.tnd.dns.ss']
};
const PODIUM_THEME = {
  bpm: 120, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], bass: 'walk', arp: 'slow', leadWave: 'pulse25', leadVol: 0.07,
  lead: [
    'C5 - E5 - G5 - - - C6 - - - G5 - - -', 'B4 - D5 - G5 - - - B5 - - - A5 - G5 -',
    'A5 - - - C6 - - - E6 - - - C6 - - -', 'A5 - - - F5 - - - C6 - - - A5 - - -',
    'G5 - - - C6 - - - E6 - D6 - C6 - - -', 'D6 - - - B5 - - - G5 - - - B5 - - -',
    'C6 - - - A5 - - - F5 - A5 - C6 - - -', 'D6 - - - - - - - G5 - A5 - B5 - - -'],
  drums: ['k...s...k.k.s...', 'k...s...k...s.s.', 'k...s...k.k.s...', 'k.k.s...k.k.ssss']
};

/* ---------- Tracks ----------
   Each track is a list of sections: [segments, curve (-6 left … +6 right), hill (in segment lengths), flags].
   Sections ease in and out, so the road always bends smoothly. Flags: pit (pit straight), drs, attack,
   tunnel, under (a bridge passes overhead), over (the road crosses a bridge). */
const TRACKS = [
  { name: 'Monaco', place: 'Monaco', street: true, look: 'harbour', music: VOLT_THEME, sky: ['#5fb4ff', '#d8f0ff'], grass: ['#2f7d3a', '#2a7134'], wallCol: '#cfd5de',
    fact: 'The slowest, twistiest track of all, with a tunnel under a hotel and a harbour full of yachts.',
    sec: [[80, 0, 0, 'pit drs'], [40, 6, 0], [120, 1, 30], [50, -3, 10], [40, 4, 0], [60, 0, -20], [40, -5, -10], [30, 6, -10], [40, 4, -10],
          [160, 1.5, 0, 'tunnel'], [50, 0, 0], [20, -5, 0], [20, 5, 0], [80, 0, 0, 'attack'], [30, -4, 0], [40, 4, 0], [40, -4, 0], [30, -5, 0], [30, 5, 0], [60, 0, 0, 'pit']] },
  { name: 'Singapore', place: 'Singapore', street: true, night: true, look: 'marina', music: NIGHT_THEME, sky: ['#070a1e', '#1d1848'], grass: ['#1d3a2a', '#193325'], wallCol: '#8f96a6',
    fact: 'A night race on city streets, lit up by hundreds of floodlights along the bay.',
    sec: [[120, 0, 0, 'pit drs'], [30, -5, 0], [30, 5, 0], [40, -4, 0], [140, 0.5, 0, 'drs'], [30, 5, 0], [60, 0, 0], [30, 5, 0], [80, 0, 0], [30, -5, 0], [30, 4, 0],
          [100, 0, 0], [40, 5, 0], [50, -3, 0], [40, -5, 0], [60, 0, 0], [30, 5, 10, 'over'], [120, -1, -10, 'attack'], [40, 5, 0], [40, -5, 0], [30, 4, 0], [80, 0, 0],
          [30, 5, 0], [40, -4, 0], [60, 0, 0, 'pit']] },
  { name: 'Silverstone', place: 'Britain', look: 'fields', music: VOLT_THEME, sky: ['#8fb4d8', '#e6eef6'], grass: ['#3f9a3c', '#378a35'], rainy: true,
    fact: 'Fast sweeping bends on an old airfield. It often rains here!',
    sec: [[140, 0, 0, 'pit drs'], [50, 4, 0], [30, -2, 0], [60, 0, 0], [40, 5, 0], [30, -5, 0], [150, 0, 0, 'drs'], [50, -3, 0], [60, 3, 10], [60, -2, 0],
          [140, 0, 0, 'attack'], [50, 4, 0], [60, 0, 0], [30, -4, 0], [30, 4, 0], [60, -2, 0], [30, 4, 0], [30, -4, 0], [30, 4, 0], [30, -4, 0], [120, 0, -10],
          [40, 3, 0], [40, -2, 0, 'pit']] },
  { name: 'Monza', place: 'Italy', look: 'park', music: VOLT_THEME, sky: ['#6fc2ff', '#fff4d8'], grass: ['#4aa33e', '#419236'],
    fact: 'The "Temple of Speed": the fastest track, with long straights through an old royal park.',
    sec: [[200, 0, 0, 'pit drs'], [20, -5, 0], [20, 5, 0], [80, 2, 0], [100, 0, 0, 'drs'], [20, 5, 0], [20, -5, 0], [60, 0, 0], [40, 4, 0], [40, 4, 0],
          [160, -0.5, -10], [20, -4, 0], [20, 4, 0], [180, 0, 10, 'attack'], [100, 5, 0], [60, 0, 0, 'pit']] },
  { name: 'Suzuka', place: 'Japan', look: 'suzuka', music: VOLT_THEME, sky: ['#7ec8ff', '#f4f8ff'], grass: ['#3fa04a', '#379042'],
    fact: 'The only figure-of-eight track: the road crosses over itself on a bridge!',
    sec: [[100, 0, 0, 'pit drs'], [50, 4, 0], [30, -3, 0], [30, 3, 0], [30, -3, 0], [30, 3, 0], [60, -4, 0], [60, 0, 20], [40, 5, 0], [30, 5, 0],
          [40, 0, -10, 'under'], [40, -4, 0], [40, -6, 0], [140, 2, 0], [60, -4, 0], [60, -4, 0], [200, 0, 10, 'attack over'], [60, -2.5, -20], [20, 5, 0], [20, -5, 0], [80, 0, 0, 'pit']] },
  { name: 'Spa', place: 'Belgium', look: 'forest', music: VOLT_THEME, sky: ['#9ab8cf', '#e8eef2'], grass: ['#357f38', '#2f7132'], rainy: true,
    fact: 'Deep in the forest, with a famous plunge down the valley and a steep climb straight back up.',
    sec: [[80, 0, 0, 'pit'], [30, -6, 0], [80, 0, -30], [30, 3, -10], [40, -4, 40], [200, 0, 10, 'drs'], [40, 4, 0], [30, -4, 0], [60, 0, -20], [60, 5, -20],
          [60, 0, 0], [60, -4, -10], [60, -3, 0], [80, 0, 0], [40, 4, 0], [40, -4, 0], [60, 5, 0], [160, 0.5, 10, 'attack'], [60, -2, 0], [20, -5, 0], [20, 5, 0], [60, 0, 0, 'pit']] },
  { name: 'Buddh', place: 'India', look: 'plains', music: INDIA_THEME, sky: ['#ff9f6a', '#ffe2a8'], grass: ['#8aa53e', '#7d9636'],
    fact: "India's Grand Prix track near Delhi, with a super-long back straight and a huge sweeping right-hander.",
    sec: [[140, 0, 0, 'pit drs'], [40, 5, 0], [60, 0, 10], [40, -4, 0], [40, -6, 0], [240, 0, 20, 'drs'], [40, 5, 0], [60, 0, 0], [40, -3, 0], [40, 3, 0],
          [60, 0, -10], [100, 3, -10], [80, 0, 0], [40, -4, 0], [40, 4, 0], [60, 0, -10, 'attack'], [40, 5, 0, 'pit']] },
  { name: 'Hyderabad', place: 'India', street: true, night: true, look: 'lake', music: INDIA_THEME, sky: ['#0a0c24', '#2a1d4a'], grass: ['#23402c', '#1e3826'], wallCol: '#9aa1b0',
    fact: 'A street track around a big city lake. Electric race cars really raced here in 2023!',
    sec: [[160, 0, 0, 'pit drs'], [30, 5, 0], [40, -3, 0], [30, 5, 0], [120, 0, 0, 'attack'], [40, -5, 0], [60, 0, 0], [30, 5, 0], [30, -5, 0], [100, 1, 0],
          [40, 5, 0], [140, 0, 0, 'drs'], [30, -5, 0], [60, 0, 0], [40, 4, 0], [40, -4, 0], [60, 0, 0, 'pit']] }
];

/* Build the segment list for a track. Deterministic, so every screen builds the same road. */
function mulberry(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const easeIn = (a, b, p) => a + (b - a) * Math.pow(p, 2);
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
function buildTrack(ix){
  const def = TRACKS[ix], segs = [], rnd = mulberry(ix * 7919 + 17);
  let y = 0;
  const add = (curve, yy, flags) => { const n = segs.length; segs.push({ i: n, curve, y1: y, y2: yy, flags, sprites: [], color: Math.floor(n / 3) % 2 }); y = yy; };
  for(const [n, curve, hill, fl] of def.sec){
    const flags = {}; (fl || '').split(' ').filter(Boolean).forEach(f => flags[f] = 1);
    const enter = Math.floor(n * 0.25), hold = n - enter * 2, y0 = y, y1 = y0 + hill * SEG;
    const total = enter * 2 + hold;
    for(let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(y0, y1, i / total), flags);
    for(let i = 0; i < hold; i++) add(curve, easeInOut(y0, y1, (enter + i) / total), flags);
    for(let i = 0; i < enter; i++) add(easeInOut(curve, 0, i / enter), easeInOut(y0, y1, (enter + hold + i) / total), flags);
  }
  // bring the road gently back to its starting height over the last stretch
  const N = segs.length, endY = y, fix = Math.min(160, Math.floor(N / 4));
  for(let k = 0; k < fix; k++){ const s = segs[N - fix + k], p = (k + 1) / fix; s.y2 -= endY * easeInOut(0, 1, p); if(k) s.y1 = segs[N - fix + k - 1].y2; }
  segs[0].y1 = segs[N - 1].y2;
  const T = { def, ix, segs, N, len: N * SEG, pitIn: N - 70, pitBox: 18, pitOut: 70, drs: [], attack: [] };
  // mark zones
  segs.forEach(s => {
    s.pitLane = s.i >= T.pitIn || s.i < T.pitOut;
    if(s.flags.drs && !(segs[(s.i - 1 + N) % N].flags.drs)) T.drs.push(s.i);
    if(s.flags.attack && !(segs[(s.i - 1 + N) % N].flags.attack)) T.attack.push(s.i + 20);
  });
  // attack pads: 12 segments on the left lane, part way into each attack section
  for(const a of T.attack) for(let k = 0; k < 12; k++) segs[(a + k) % N].pad = 1;
  // roadside scenery
  const look = def.look, sp = (i, kind, x, o) => { if(i >= 0 && i < N) segs[i].sprites.push(Object.assign({ kind, x }, o || {})); };
  const ads = ['VOLT GP', 'HUMBLE YETI', 'XRETRO', 'ZAP!', 'GO GREEN', 'CHARGE!'];
  for(let i = 12; i < N; i += 6){
    const s = segs[i], side = (Math.floor(i / 6) % 2) ? 1 : -1;
    if(s.flags.tunnel) continue;
    if(def.night && i % 24 === 0){ sp(i, 'flood', -1.55); sp(i, 'flood', 1.55); }
    if(i % 60 === 0 && !s.pitLane){ sp(i, 'board', side * (def.street ? 1.32 : 1.5), { text: ads[Math.floor(rnd() * ads.length)] }); continue; }
    if(i % 90 === 30){ sp(i, 'marshal', -side * (def.street ? 1.32 : 1.6)); }
    const r = rnd();
    if(look === 'harbour'){ if(r < 0.55) sp(i, 'palm', side * (1.5 + rnd() * 0.5)); else if(r < 0.7) sp(i, 'house', side * (2 + rnd()), { col: ['#f4d7a6', '#f0b8a0', '#fbe9d0', '#e8c4c4'][Math.floor(rnd() * 4)] }); }
    else if(look === 'marina' || look === 'lake'){ if(r < 0.35) sp(i, 'tower', side * (2.2 + rnd() * 1.5), { h: 3 + rnd() * 5, col: rnd() < 0.5 ? '#232a4a' : '#2b2440' }); else if(r < 0.6) sp(i, 'palm', side * (1.5 + rnd() * 0.4)); }
    else if(look === 'fields'){ if(r < 0.35) sp(i, 'tree', side * (1.8 + rnd() * 2)); else if(r < 0.45) sp(i, 'bush', side * (1.5 + rnd() * 0.5)); }
    else if(look === 'park'){ if(r < 0.7) sp(i, 'tree', side * (1.6 + rnd() * 1.5)); if(rnd() < 0.3) sp(i, 'tree', -side * (1.8 + rnd())); }
    else if(look === 'forest'){ sp(i, 'pine', side * (1.6 + rnd() * 1.2)); if(rnd() < 0.6) sp(i, 'pine', -side * (1.7 + rnd() * 1.5)); }
    else if(look === 'suzuka'){ if(r < 0.5) sp(i, 'tree', side * (1.7 + rnd() * 1.5)); else if(r < 0.6) sp(i, 'bush', side * 1.5); }
    else if(look === 'plains'){ if(r < 0.25) sp(i, 'tree', side * (2 + rnd() * 3), { dry: 1 }); else if(r < 0.35) sp(i, 'bush', side * 1.6); }
  }
  // grandstands along the pit straight, a start gantry, and signs for DRS and Attack Mode
  for(let i = N - 40; i < N + 30; i += 10){ const k = (i + N) % N; if(k > 8) sp(k, 'stand', -1.9); }
  sp(3, 'gantry', 0);
  for(const d of T.drs){ sp(d, 'sign', 1.3, { text: 'DRS' }); }
  for(const a of T.attack){ sp(Math.max(0, a - 10), 'sign', -1.3, { text: 'ATTACK', col: '#ff4fd8' }); }
  sp(T.pitIn - 20, 'sign', 1.3, { text: 'PIT', col: '#f5c542' });
  // a bridge over the road where the Suzuka figure-of-eight crosses
  segs.forEach((s, i) => { if(s.flags.under && !segs[i - 1].flags.under) sp(i + 18, 'bridge', 0); });
  return T;
}
let TK = null;
const segAt = z => TK.segs[Math.floor(((z % TK.len) + TK.len) % TK.len / SEG)];
const wrapZ = z => ((z % TK.len) + TK.len) % TK.len;

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('volt.diff', 'normal'), trackIx: A.Store.get('volt.track', 0), lenIx: A.Store.get('volt.len', 0),
  weather: A.Store.get('volt.weather', 0), mode: 'quick', champ: null,
  cars: [], players: [], time: 0, stateT: 0, raceT: 0, raceId: 0, laps: 3, rain: false, hold: 0.8,
  scT: 0, scUsed: false, scMsg: 0, scLap: -1, firstFinish: -1, fastest: null, net: null, results: null
};
if(!DIFF[G.diff]) G.diff = 'normal';
if(!(G.trackIx >= 0 && G.trackIx < TRACKS.length)) G.trackIx = 0;
if(!(G.lenIx >= 0 && G.lenIx < LENGTHS.length)) G.lenIx = 0;
const D = () => DIFF[G.diff];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const ordinal = n => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');
function fmt(t){ if(!(t >= 0)) return '--:--.-'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function fmtLap(t){ if(!(t > 0)) return '-:--.--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }

/* ---------- Cars ---------- */
let nextId = 1;
function makeCar(o){
  return Object.assign({ id: nextId++, dist: 0, x: 0, tx: 1, v: 0, bat: 100, boost: false, brake: false, regen: false, attackT: 0, attackLap: -9, drs: false, slip: false,
    tyre: 1, pitReq: false, pitSt: 0, pitT: 0, pitGood: 0, spinT: 0, hitT: 0, bumpT: 0, off: false, lapStart: 0, lastLap: 0, bestLap: 0, fin: -1,
    msg: '', msgT: 0, msgKey: '', lastPlace: 0, skill: 1, cpuBoostT: 0, cpuLaneCd: 0, cpuPitGo: 2, squealT: 0, lowWarn: 0, boxWarn: -1, stats: { passes: 0, boosts: 0, regen: 0 } }, o);
}
const lapOf = c => Math.floor(c.dist / TK.len);
function say(c, msg, key, t){
  if(!c.human) return;
  if(key && c.msgKey === key && c.msgT > 0) return;
  c.msg = msg; c.msgT = t || 1.8; c.msgKey = key || '';
  if(key && key[0] === '!') sfx('radio');
}
const NONE = { left: false, right: false, leftP: false, rightP: false, down: false, fire: false, upP: false, fireP: false };
function controls(c){
  if(c.cpu || G.bot) return cpuControls(c);
  const s = A.Input.get(c.source), on = !!(s && s.connected);
  if(!on) return NONE;
  return { left: s.left, right: s.right, leftP: A.Input.pressed(s, 'left'), rightP: A.Input.pressed(s, 'right'), down: s.down, fire: s.fire,
    upP: A.Input.pressed(s, 'up'), fireP: A.Input.pressed(s, 'fire') };
}
const grip = c => (0.72 + 0.28 * c.tyre) * (G.rain ? 0.86 : 1);
const cornerSpeed = (curve, g) => Math.abs(curve) < 0.05 ? 1.2 : Math.sqrt(STEER * g * 6 / (Math.abs(curve) * PUSH * D().push));
function carAhead(c, maxDz, laneOnly){
  let best = null, bd = maxDz;
  for(const o of G.cars){
    if(o === c || (o.pitSt > 0) !== (c.pitSt > 0)) continue;
    let dz = wrapZ(o.dist - c.dist); if(dz > TK.len / 2) continue;
    if(dz <= 0 || dz > bd) continue;
    if(laneOnly && Math.abs(o.x - c.x) > CAR_W * 1.2) continue;
    best = o; bd = dz;
  }
  return best ? { car: best, dz: bd } : null;
}

/* CPU drivers: brake for the bends (regen!), boost on straights, dodge slower cars, grab Attack Mode, pit when tyres fade. */
function cpuControls(c){
  const k = { left: false, right: false, leftP: false, rightP: false, down: false, fire: false, upP: false, fireP: false };
  if(c.pitSt === 2){ if(c.pitT > c.cpuPitGo) k.fireP = true; return k; }
  const seg0 = Math.floor(wrapZ(c.dist) / SEG), g = grip(c) * (c.cpu ? 1 : 0.97);
  // how fast may we go right now, given the bends coming up?
  const look = 12 + Math.floor(c.v / MAXV * 55);
  let target = MAXV * 2;
  for(let i = 1; i <= look; i++){
    const s = TK.segs[(seg0 + i) % TK.N], vc = Math.min(1.2, cornerSpeed(s.curve, g) * 0.97) * MAXV;
    const d = i * SEG, allowed = Math.sqrt(vc * vc + 2 * BRAKE * 0.7 * d);
    if(allowed < target) target = allowed;
  }
  const here = Math.min(1.2, cornerSpeed(TK.segs[seg0].curve, g) * 0.98) * MAXV;
  target = Math.min(target, here);
  if(c.v > target * 1.02) k.down = true;
  // boost on straights, or to make a pass
  if(c.cpuBoostT > 0){ c.cpuBoostT -= 1 / 60; k.fire = true; }
  else if(!k.down && G.scT <= 0 && G.state === 'race'){
    let straight = true; for(let i = 1; i < 30; i++) if(Math.abs(TK.segs[(seg0 + i) % TK.N].curve) > 1){ straight = false; break; }
    const ahead = carAhead(c, 10 * SEG, false), left = G.laps - lapOf(c);
    const reserve = 30 + 30 / Math.max(1, left);
    if(straight && c.bat > reserve && (ahead || Math.random() < 0.004 * c.skill)) c.cpuBoostT = 0.6 + Math.random() * 0.8;
  }
  // lanes: dodge slower cars ahead, sometimes go for the Attack Mode pad
  if(c.cpuLaneCd > 0) c.cpuLaneCd -= 1 / 60;
  else {
    const lane = c.tx, block = carAhead(c, 7 * SEG, true);
    let want = lane;
    if(block && block.car.v < c.v + 400){
      const free = l => l >= 0 && l <= 2 && !G.cars.some(o => o !== c && Math.abs(o.x - LANES[l]) < CAR_W * 1.3 && Math.abs(wrapZ(o.dist - c.dist + TK.len / 2) - TK.len / 2) < 4 * SEG);
      const opts = [lane - 1, lane + 1].filter(free);
      if(opts.length) want = opts[Math.floor(Math.random() * opts.length)];
    }
    for(const a of TK.attack){ const dz = wrapZ(a * SEG - c.dist); if(dz < 40 * SEG && dz > 4 * SEG && c.attackLap !== lapOf(c) && c.skill > 0.955 && G.scT <= 0) want = 0; }
    if(c.pitReq && wrapZ(TK.pitIn * SEG - c.dist) < 40 * SEG) want = 2;
    if(want !== lane){ if(want < lane) k.leftP = true; else k.rightP = true; c.cpuLaneCd = 0.5 + Math.random() * 0.6; }
  }
  if((c.cpu || G.bot) && !c.pitReq && c.pitSt === 0 && c.tyre < 0.62 && G.laps - lapOf(c) >= 2 && G.state === 'race') k.upP = true;
  return k;
}

function stepCar(c, dt){
  const d = D(), racing = G.state === 'race' || G.state === 'finishing' || G.demo;
  const ctl = racing && c.spinT <= 0 ? controls(c) : NONE;
  if(c.msgT > 0) c.msgT -= dt;
  if(c.hitT > 0) c.hitT -= dt;
  if(c.bumpT > 0) c.bumpT -= dt;
  if(c.attackT > 0) c.attackT -= dt;
  if(c.squealT > 0) c.squealT -= dt;
  if(!racing){ c.v = 0; return; }
  const seg = segAt(c.dist), done = c.fin >= 0, sp = c.v / MAXV;
  // pit requests
  if(ctl.upP && !done && c.pitSt === 0){
    c.pitReq = !c.pitReq;
    if(c.human){ sfx('box'); say(c, c.pitReq ? 'BOX THIS LAP!' : 'STAY OUT', 'box', 1.6); }
  }
  // lane changes
  if(c.pitSt === 0 && c.spinT <= 0){
    if(ctl.leftP && c.tx > 0) c.tx--;
    if(ctl.rightP && c.tx < 2) c.tx++;
  }
  // pit lane: in at the end of the lap (right lane), stop at the box just past the line, out again
  const si = seg.i;
  if(c.pitSt === 0 && c.pitReq && si >= TK.pitIn && si < TK.pitIn + 14 && !done){
    if(c.x > 0.35){ c.pitSt = 1; c.tx = 2; if(c.human) say(c, 'PIT LANE', 'pit', 1.4); }
    else if(si >= TK.pitIn + 12 && c.human) say(c, 'MISSED THE PIT! STAY RIGHT', 'miss', 2);
  }
  if(c.pitSt === 1 && si === TK.pitBox){ c.pitSt = 2; c.pitT = 0; c.pitW = 0; c.v = 0; c.cpuPitGo = 1.4 + Math.random() * 0.8; }
  if(c.pitSt === 2){
    c.pitT += dt; c.pitW = (c.pitW || 0) + dt; c.v = 0;
    const needle = pitNeedle(c.pitT), kids = G.diff === 'kids', green = kids ? needle > 0.2 && needle < 0.8 : needle > 0.4 && needle < 0.6;
    if(c.pitT > 0.8 && ctl.fireP){
      if(green || c.cpu || G.bot){ finishPit(c, green ? 1 : 0); }
      else { c.pitW += 0.5; if(c.human){ say(c, 'WHOOPS! WAIT FOR GREEN', 'fumble', 1); sfx('bump'); } }
    }
    if(c.pitSt === 2 && c.pitW > 4.2) finishPit(c, 0);
    return;
  }
  if(c.pitSt === 3 && si >= TK.pitOut && si < TK.pitOut + 10){ c.pitSt = 0; c.tx = 2; }
  const inPit = c.pitSt === 1 || c.pitSt === 3;
  // speed limits
  const sc = G.scT > 0 && !done, limp = c.bat <= 0.01;
  let boostOn = ctl.fire && !limp && !sc && !inPit && !done && c.spinT <= 0 && G.state === 'race';
  // DRS: on a DRS straight, less than about a second behind someone (not on lap 1, not behind the safety car)
  const ahead = carAhead(c, 26 * SEG, false);
  c.drs = !!(seg.flags.drs && !inPit && !sc && lapOf(c) >= 1 && ahead && ahead.dz / Math.max(2000, c.v) < 1.0 && G.state === 'race');
  if(c.drs && !c.drsWas && c.human) sfx('drs');
  c.drsWas = c.drs;
  // slipstream: tucked in right behind another car
  const tow = carAhead(c, 6 * SEG, true);
  c.slip = !!(tow && tow.dz > CAR_L * 1.1 && !inPit && c.v > MAXV * 0.5);
  let vmax = MAXV * c.skill * (boostOn ? 1.16 : 1) * (c.attackT > 0 ? 1.07 : 1) * (c.drs ? 1.07 : 1) * (c.slip ? 1.04 : 1);
  if(c.off) vmax *= 0.48;
  if(limp) vmax *= 0.55;
  if(sc) vmax = Math.min(vmax, MAXV * 0.5);
  if(inPit) vmax = MAXV * 0.36;
  if(done) vmax = Math.min(vmax, MAXV * 0.5);
  if(G.cool) vmax = Math.min(vmax, MAXV * 0.5);
  // Kids: brake assist slows the car for bends by itself (and still recharges the battery)
  let assist = false;
  if(c.human && G.diff === 'kids' && !ctl.down && c.spinT <= 0 && !inPit){
    const g = grip(c), s0 = seg.i;
    for(let i = 0; i < 14 && !assist; i++){ const s2 = TK.segs[(s0 + i) % TK.N]; if(c.v > cornerSpeed(s2.curve, g) * MAXV * (1.02 + i * 0.02)) assist = true; }
  }
  // rivals ease off a little when far ahead of every human, and push a little when far behind
  if(c.cpu && !G.demo && G.state === 'race'){
    const hum = G.cars.filter(h => h.human && h.fin < 0);
    if(hum.length){
      const best = Math.max(...hum.map(h => h.dist)), worst = Math.min(...hum.map(h => h.dist));
      const kids = G.diff === 'kids';
      if(c.dist - best > TK.len * (kids ? 0.12 : 0.25)) vmax *= kids ? 0.9 : 0.97;
      else if(worst - c.dist > TK.len * 0.3) vmax *= 1.02;
    }
  }
  // throttle is automatic; DOWN brakes and regenerates energy
  c.brake = (!!ctl.down || assist) && c.v > 200;
  c.regen = false;
  const drain = d.drain * clamp(3.4 / G.laps, 0.4, 1.1);
  if(c.spinT > 0){ c.spinT -= dt; c.v = Math.max(0, c.v - BRAKE * 0.4 * dt); if(c.spinT <= 0){ let best = 1; LANES.forEach((l, i) => { if(Math.abs(l - c.x) < Math.abs(LANES[best] - c.x)) best = i; }); c.tx = best; } }
  else if(c.brake){
    c.v = Math.max(0, c.v - BRAKE * dt);
    if(sp > 0.2){ c.regen = true; c.bat += 10 * dt; c.stats.regen += 10 * dt; }
  } else if(c.v < vmax){
    c.v = Math.min(vmax, c.v + ACC * (boostOn ? 1.6 : 1) * (1 - 0.55 * c.v / vmax) * dt);
  } else c.v = Math.max(vmax, c.v - (c.off ? 9000 : 2600) * dt);
  if(!c.brake && seg.y2 < seg.y1 - 8 && !boostOn){ c.bat += 1.4 * dt; c.regen = c.regen || c.human && seg.y2 < seg.y1 - 20; }
  if(!done && G.state === 'race'){
    c.bat -= sp * 0.75 * drain * (c.attackT > 0 ? 0.5 : 1) * dt;
    if(boostOn){ c.bat -= 13 * Math.sqrt(drain) * dt; if(!c.boost) c.stats.boosts++; }
  }
  if(boostOn && !c.boost && c.human) sfx('boost');
  c.boost = boostOn;
  c.bat = clamp(c.bat, d.floor, 100);
  if(c.human && !done){
    if(c.bat <= 0.01 && c.lowWarn < 2){ c.lowWarn = 2; sfx('empty'); say(c, 'BATTERY EMPTY! BRAKE TO RECHARGE', '!empty', 2.4); }
    else if(c.bat < 22 && c.lowWarn < 1){ c.lowWarn = 1; say(c, 'LOW BATTERY: BRAKE EARLY TO REGEN', '!low', 2.4); }
    if(c.bat > 40) c.lowWarn = 0;
  }
  // Attack Mode: drive over the glowing pad in the left lane
  if(seg.pad && !inPit && Math.abs(c.x - LANES[0]) < 0.3 && c.attackLap !== lapOf(c) && !sc && G.state === 'race' && !done){
    c.attackT = G.diff === 'kids' ? 10 : 8; c.attackLap = lapOf(c);
    if(c.human){ sfx('attack'); say(c, 'ATTACK MODE!', 'attack', 1.6); }
  }
  // steering: the car holds its lane unless the bend pushes harder than the tyres can grip
  const push = -seg.curve / 6 * sp * sp * PUSH * d.push;
  const cap = STEER * grip(c);
  const tgt = inPit ? 1.45 : LANES[c.tx];
  if(c.spinT > 0) c.x += push * 0.5 * dt;
  else {
    const want = clamp((tgt - c.x) * 7, -2.6, 2.6);
    const steer = clamp(want - push, -cap, cap);
    c.x += (steer + push) * dt;
    // too fast for the bend: the tyres scrub and the car slides wide
    const excess = Math.abs(push) - cap;
    if(excess > 0){ c.v = Math.max(MAXV * 0.3, c.v - excess * 1100 * dt); c.scrub = true; } else c.scrub = false;
    if(excess > -0.05 && c.human && c.squealT <= 0 && sp > 0.4){ sfx('squeal'); c.squealT = 0.35; }
  }
  // edges of the track: walls on street tracks, grass elsewhere
  c.off = false;
  if(!inPit){
    const lim = TK.def.street ? 1.02 : 1.9;
    if(!TK.def.street && Math.abs(c.x) > 1.0) c.off = true;
    if(Math.abs(c.x) > lim){
      c.x = Math.sign(c.x) * lim;
      if(c.hitT <= 0){
        c.hitT = 0.45;
        if(sp > 0.62 && d.spin && TK.def.street && G.state === 'race' && !done){ spin(c); }
        else { c.v *= TK.def.street ? d.wallSlow : 0.8; if(c.human){ sfx('wall'); } }
      }
      c.tx = c.x < 0 ? 0 : 2;
    }
  } else c.x += (1.45 - c.x) * Math.min(1, dt * 4);
  // move along
  const before = lapOf(c);
  c.dist += c.v * dt;
  const after = lapOf(c);
  if(after > before && G.state !== 'lights' && !G.demo) crossLine(c, after);
}
function spin(c){
  c.spinT = 1.2; c.v *= 0.35; c.hitT = 0.8;
  if(c.human){ sfx('spin'); say(c, 'SPIN! HANG ON', 'spin', 1.4); }
  else sfx('wall');
  if(D().sc && !G.scUsed && G.state === 'race' && Math.random() < 0.35 && leaderLap() < G.laps - 1) safetyCar();
}
function pitNeedle(t){ const p = ((t - 0.8) * 0.9) % 2; return t < 0.8 ? 0 : p < 1 ? p : 2 - p; }
function finishPit(c, good){
  c.pitSt = 3; c.pitReq = false; c.tyre = 1; c.bat = Math.min(100, c.bat + 25);
  if(c.human){ sfx(good ? 'pitGo' : 'charge'); say(c, good ? 'PERFECT STOP! PIT BOOST +25%' : 'PIT BOOST +25%, FRESH TYRES', 'pitgo', 2); }
}
function crossLine(c, lap){
  const t = G.raceT;
  if(lap >= 1){
    const lt = t - c.lapStart;
    c.lastLap = lt;
    if(!c.bestLap || lt < c.bestLap) c.bestLap = lt;
    if(lap >= 1 && (!G.fastest || lt < G.fastest.t)){
      G.fastest = { t: lt, name: c.name, color: c.color, id: c.id };
      if(c.human && lap >= 1){ sfx('purple'); say(c, 'FASTEST LAP! ' + fmtLap(lt), 'fl', 2); }
    }
    c.tyre = Math.max(0.2, c.tyre - 0.08 * (G.rain ? 0.8 : 1));
  }
  c.lapStart = t;
  if(lap >= G.laps && c.fin < 0){
    c.fin = t;
    if(G.firstFinish < 0) G.firstFinish = t;
    if(c.human){ sfx('flag'); say(c, ordinal(place(c)) + ' PLACE!', 'fin', 3); }
    return;
  }
  if(c.human){
    if(lap === G.laps - 1){ sfx('finalLap'); say(c, 'FINAL LAP!', 'final', 2); }
    else if(lap >= 1){ sfx('lap'); say(c, 'LAP ' + (lap + 1) + ' · ' + fmtLap(c.lastLap), 'lap', 1.8); }
    if(c.tyre < 0.62 && !c.pitReq && G.laps - lap >= 2) say(c, A.Input.isTouch ? 'BOX BOX! TAP ▲ TO PIT' : 'BOX BOX! PRESS UP TO PIT', '!boxbox', 3);
  }
}
const leaderLap = () => Math.max(0, ...G.cars.map(lapOf));
function safetyCar(){
  if(G.scT > 0 || G.scUsed) return;
  G.scUsed = true; G.scT = 9; G.scMsg = 2.5;
  S('countdown'); sfx('sc');
  for(const c of G.cars) if(c.human) say(c, 'SAFETY CAR! NO OVERTAKING', 'sc', 2.5);
}
function place(c){ return G.order ? G.order.indexOf(c) + 1 : 1; }
function orderCars(){
  G.order = G.cars.slice().sort((a, b) => {
    if(a.fin >= 0 && b.fin >= 0) return a.fin - b.fin;
    if(a.fin >= 0) return -1; if(b.fin >= 0) return 1;
    return b.dist - a.dist;
  });
}
/* Cars bump instead of passing through each other */
function collisions(){
  const list = G.cars;
  for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
    let a = list[i], b = list[j];
    if((a.pitSt > 0) !== (b.pitSt > 0) || a.pitSt === 2 || b.pitSt === 2) continue;
    let dz = wrapZ(b.dist - a.dist); if(dz > TK.len / 2){ dz -= TK.len; }
    if(Math.abs(dz) >= CAR_L || Math.abs(a.x - b.x) >= CAR_W) continue;
    if(dz < 0){ const t = a; a = b; b = t; dz = -dz; }        // a is behind b
    if(dz > CAR_L * 0.55){
      const rel = a.v - b.v;
      a.dist -= (CAR_L - dz);
      if(rel > 0){ a.v = Math.max(0, b.v - rel * 0.2); b.v = Math.min(MAXV * 1.2, b.v + rel * 0.25); }
      if(rel > 900 && (a.human || b.human) && a.bumpT <= 0){ sfx('bump'); a.bumpT = 0.4; b.bumpT = 0.4; }
    } else {
      const push = (CAR_W - Math.abs(a.x - b.x)) / 2 + 0.01, s = a.x < b.x ? -1 : 1;
      a.x += s * push; b.x -= s * push;
      if((a.human || b.human) && a.bumpT <= 0){ sfx('bump'); a.bumpT = 0.4; b.bumpT = 0.4; }
    }
  }
}
/* Behind the safety car the field bunches up and nobody passes */
function safetyCarStep(dt){
  if(G.scT <= 0) return;
  G.scT -= dt; if(G.scMsg > 0) G.scMsg -= dt;
  const run = G.order.filter(c => c.fin < 0 && c.pitSt === 0);
  run.forEach((c, i) => {
    if(i === 0){ c.v = Math.min(c.v, MAXV * 0.45); return; }
    const a = run[i - 1], gap = a.dist - c.dist;
    if(gap < 3 * SEG) c.v = Math.min(c.v, a.v);
  });
  if(G.scT <= 0){ sfx('green'); for(const c of G.cars) if(c.human) say(c, 'GREEN FLAG! GO GO GO!', 'green', 2); }
}

/* ---------- Race flow ---------- */
function setupRace(humans){
  TK = buildTrack(G.trackIx); TK.rid = ++G.raceId;
  G.laps = G.demo ? 999 : LENGTHS[G.lenIx].laps;
  G.rain = !G.demo && (G.weather === 2 || (G.weather === 0 && TK.def.rainy && Math.random() < 0.45));
  G.cars = []; G.order = null; G.scT = 0; G.scUsed = false; G.scLap = -1; G.firstFinish = -1; G.fastest = null; G.results = null; G.cool = false;
  G.hold = 0.5 + Math.random() * 0.7;
  const total = 8, nh = humans.length;
  // grid: rivals ahead, humans start from the back half so there is plenty to overtake
  const grid = [];
  const cpuN = total - nh;
  for(let j = 0; j < cpuN; j++){ const r = RIVALS[j % RIVALS.length]; grid.push(makeCar({ cpu: true, name: r.name, color: r.color, slot: 10 + j, skill: D().cpu * (r.skill - (G.diff === 'kids' ? 0.02 * j : 0)) })); }
  humans.forEach(p => grid.splice(Math.min(grid.length, cpuN - Math.floor(cpuN / 2) + Math.floor(Math.random() * 2)), 0, makeCar({ human: true, source: p.source, name: p.name, color: p.color, slot: p.slot, skill: 1 })));
  grid.forEach((c, i) => {
    c.tx = i % 2 === 0 ? 0 : 2; if(i % 4 === 3) c.tx = 1;
    c.x = LANES[c.tx]; c.dist = -(i + 1) * 2.2 * SEG + (G.demo ? 0 : 0);
  });
  G.cars = grid;
  G.raceT = 0;
  orderCars();
}
function startDemo(){
  G.demo = true; G.state = G.state === 'race' ? 'title' : G.state; G.players = [];
  G.trackIx = Math.floor(Math.random() * TRACKS.length);
  const keep = G.trackIx;
  setupRace([]);
  G.trackIx = A.Store.get('volt.track', 0);
  TK = buildTrack(keep); TK.rid = ++G.raceId; G.demoTrack = keep;
  for(const c of G.cars){ c.skill = 0.86 + Math.random() * 0.1; c.dist += 8 * SEG; c.v = MAXV * 0.6; }
}
function newRace(players){
  G.demo = false; G.players = players.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot }));
  setupRace(G.players);
  G.state = 'lights'; G.stateT = 0;
  A.Menu.close(); A.keepAwake();
  if(G.rain) A.toast('Rain at ' + TK.def.name + '! Less grip: brake a little earlier.', 3000);
}
function startChampionship(players){
  G.mode = 'champ'; G.champ = { round: 0, pts: {}, cols: {}, names: [] };
  G.trackIx = 0; newRace(players);
}
/* Drop-in: someone new presses FIRE mid-race and takes over the last rival's car */
function dropIn(){
  if(G.demo || G.state !== 'race') return;
  const hum = G.cars.filter(c => c.human);
  if(hum.length >= 4) return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.cars.some(c => c.source === s.id)) continue;
    const used = hum.map(c => c.slot), slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.cars.map(c => c.name));
    const cpus = G.order.filter(c => c.cpu && c.fin < 0);
    if(!cpus.length) return;
    const car = cpus[cpus.length - 1];
    Object.assign(car, { cpu: false, human: true, source: s.id, name, color: A.PLAYER_COLORS[slot], slot, skill: 1 });
    say(car, 'JOINED! GO GO GO', 'join', 2);
    G.players.push({ source: s.id, name, color: car.color, slot }); G.players.sort((a, b) => a.slot - b.slot);
    S('join');
    return;
  }
}
function sim(dt){
  if(G.state === 'lights'){
    const before = G.stateT; G.stateT += dt;
    for(let i = 0; i < 5; i++){ const at = 0.5 + i * 0.7; if(before < at && G.stateT >= at) sfx('light'); }
    if(G.stateT >= 0.5 + 4 * 0.7 + G.hold){ G.state = 'race'; G.raceT = 0; sfx('lightsOut'); for(const c of G.cars) c.lapStart = 0; }
    for(const c of G.cars) stepCar(c, dt);
    return;
  }
  if(G.state === 'race' || G.state === 'finishing' || G.demo) G.raceT += dt;
  for(const c of G.cars) stepCar(c, dt);
  collisions();
  orderCars();
  safetyCarStep(dt);
  if(G.demo){
    // keep the demo cars circulating forever
    for(const c of G.cars){ if(c.dist > TK.len * 50) c.dist -= TK.len * 40; c.bat = Math.max(c.bat, 40); }
    return;
  }
  if(G.state === 'race'){
    // a random safety car in longer races
    if(D().sc && !G.scUsed && G.laps >= 5 && G.scLap < 0) G.scLap = 1 + Math.floor(Math.random() * (G.laps - 2)) + (Math.random() < 0.55 ? 0 : 99);
    if(G.scLap > 0 && leaderLap() === G.scLap && !G.scUsed && wrapZ(G.order[0].dist) > TK.len * 0.4) safetyCar();
    if(G.raceT > 3){
      for(const c of G.cars){
        if(!c.human || c.fin >= 0) continue;
        const pl = place(c);
        if(c.lastPlace && pl < c.lastPlace){ c.stats.passes++; if(!c.msgT || c.msgT < 0.6 || /^P\d/.test(c.msg)) { say(c, 'P' + pl + '!', 'p', 1.1); sfx('pass'); } }
        c.lastPlace = pl;
      }
    }
    const humans = G.cars.filter(c => c.human);
    const lim = D().limit;
    if(humans.length && humans.every(c => c.fin >= 0)){ G.state = 'finishing'; G.stateT = 0; }
    else if(lim && G.firstFinish >= 0 && G.raceT - G.firstFinish > lim){ G.state = 'finishing'; G.stateT = 0; }
  }
}
function finishRace(){
  G.state = 'podium'; G.stateT = 0; G.cool = true;
  orderCars();
  const order = G.order;
  const leaderFin = order[0].fin;
  G.results = order.map((c, i) => {
    const behind = G.laps * TK.len - c.dist, lapsDown = Math.floor(behind / TK.len);
    const gap = i === 0 ? fmt(c.fin) : c.fin >= 0 ? '+' + (c.fin - leaderFin).toFixed(1) + 's' : lapsDown >= 1 ? '+' + lapsDown + ' LAP' + (lapsDown > 1 ? 'S' : '') : '+' + (G.raceT - leaderFin + behind / (MAXV * 0.8)).toFixed(1) + 's';
    return { place: i + 1, name: c.name, color: c.color, cpu: !!c.cpu, gap, best: c.bestLap, id: c.id };
  });
  // records
  const hum = order.filter(c => c.human && c.bestLap > 0);
  const key = 'volt.lap.' + G.trackIx, best = A.Store.get(key, 0);
  G.newRecord = false;
  if(hum.length){ const b = Math.min(...hum.map(c => c.bestLap)); if(!best || b < best){ A.Store.set(key, b); G.newRecord = true; } }
  // championship points (plus 1 for the fastest lap)
  if(G.mode === 'champ' && G.champ){
    G.results.forEach(r => { const p = POINTS[r.place - 1] || 0; G.champ.pts[r.name] = (G.champ.pts[r.name] || 0) + p; G.champ.cols[r.name] = r.color; });
    if(G.fastest){ G.champ.pts[G.fastest.name] = (G.champ.pts[G.fastest.name] || 0) + 1; }
    G.champ.round++;
  }
}
function resultsMenu(){
  G.state = 'results';
  const def = TK.def, rows = G.results.map(r => '<b style="color:' + r.color + '">' + r.place + '. ' + A.esc(r.name) + '</b>' + (r.cpu ? ' <span style="opacity:.6">(rival)</span>' : '') +
    ' · ' + r.gap + (G.fastest && G.fastest.id === r.id ? ' <span style="color:#c77dff">· fastest lap ' + fmtLap(G.fastest.t) + '</span>' : '')).join('<br>');
  const rec = A.Store.get('volt.lap.' + G.trackIx, 0);
  let extra = rec ? '<br><br>Lap record at ' + def.name + ': <b>' + fmtLap(rec) + '</b>' + (G.newRecord ? ' · <b>new record!</b>' : '') : '';
  let items;
  if(G.mode === 'champ' && G.champ){
    const tbl = Object.keys(G.champ.pts).sort((a, b) => G.champ.pts[b] - G.champ.pts[a]).slice(0, 8)
      .map((n, i) => '<b style="color:' + G.champ.cols[n] + '">' + (i + 1) + '. ' + A.esc(n) + '</b> ' + G.champ.pts[n] + ' pts').join('<br>');
    const over = G.champ.round >= TRACKS.length;
    extra += '<br><br><b>Championship after round ' + G.champ.round + ' of ' + TRACKS.length + '</b><br>' + tbl;
    items = over ? [{ label: 'See the champion', select: championMenu }]
      : [{ label: 'Next round: ' + TRACKS[G.champ.round].name, select: () => { G.trackIx = G.champ.round; newRace(G.players); } },
         { label: 'Quit championship', select: () => { G.mode = 'quick'; G.champ = null; hosting() ? openLobby(null) : toTitle(); } }];
  } else {
    items = [
      { label: 'Next track', select: () => { G.trackIx = (G.trackIx + 1) % TRACKS.length; A.Store.set('volt.track', G.trackIx); newRace(G.players); } },
      { label: 'Race again', select: () => newRace(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change drivers', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ];
  }
  A.Menu.open({ center: true, shared: true, kicker: def.name + ' · ' + G.laps + ' laps · ' + D().label + (G.rain ? ' · wet' : ''),
    title: G.results[0].cpu ? 'Chequered flag' : A.esc(G.results[0].name) + ' wins!', text: rows + extra, items });
}
function championMenu(){
  const names = Object.keys(G.champ.pts).sort((a, b) => G.champ.pts[b] - G.champ.pts[a]);
  const w = names[0];
  G.state = 'champion'; G.stateT = 0; G.champWinner = { name: w, color: G.champ.cols[w] };
  A.Menu.open({ center: true, shared: true, kicker: 'Volt GP World Championship', title: A.esc(w) + ' is the champion!',
    text: names.slice(0, 8).map((n, i) => '<b style="color:' + G.champ.cols[n] + '">' + (i + 1) + '. ' + A.esc(n) + '</b> ' + G.champ.pts[n] + ' pts').join('<br>') +
      '<br><br>Eight tracks, one battery, a whole lot of regen. Well driven!',
    items: [
      { label: 'New championship', select: () => startChampionship(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change drivers', select: () => { G.mode = 'quick'; G.champ = null; openLobby(null); } },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: () => { G.mode = 'quick'; G.champ = null; toTitle(); } }])
    ] });
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
function titleMenu(start){
  G.state = 'title';
  const champ = G.mode === 'champ';
  A.Menu.open({ kicker: 'xRetro', title: 'VOLT GP', start: start || 0,
    text: 'Electric Grand Prix racing on 3 lanes! Your car accelerates by itself: <b>left/right</b> change lane, <b>down</b> brakes and <b>recharges the battery</b>, hold <b>FIRE to BOOST</b>. ' +
          'Grab Attack Mode, use DRS, pit for fresh tyres. 8 tracks, 1–4 drivers on one screen or online. Weather Auto: it may rain at Silverstone and Spa.',
    items: [
      { label: champ ? 'Start championship' : 'Race', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Mode', value: () => champ ? 'Championship (8 rounds)' : 'Quick race', change: () => { G.mode = G.mode === 'champ' ? 'quick' : 'champ'; titleMenu(2); } },
      ...(champ ? [] : [{ label: 'Track', value: () => (G.trackIx + 1) + ' · ' + TRACKS[G.trackIx].name + (TRACKS[G.trackIx].night ? ' (night)' : ''), change: d => { G.trackIx = (G.trackIx + d + TRACKS.length) % TRACKS.length; A.Store.set('volt.track', G.trackIx); } }]),
      { label: 'Race length', value: () => LENGTHS[G.lenIx].label + ' · ' + LENGTHS[G.lenIx].laps + ' laps', change: d => { G.lenIx = (G.lenIx + d + 3) % 3; A.Store.set('volt.len', G.lenIx); } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('volt.diff', G.diff); } },
      { label: 'Weather', value: () => WEATHER[G.weather], change: d => { G.weather = (G.weather + d + 3) % 3; A.Store.set('volt.weather', G.weather); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: bestLine() });
}
function bestLine(){
  const b = A.Store.get('volt.lap.' + G.trackIx, 0);
  const n = A.Input.pads().length;
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + (b ? 'Lap record at ' + TRACKS[G.trackIx].name + ': ' + fmtLap(b) + '.' : '');
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting(), champ = G.mode === 'champ';
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + (champ ? 'Championship · 8 rounds' : TRACKS[G.trackIx].name) + ' · ' + LENGTHS[G.lenIx].laps + ' laps · ' + D().label,
    title: 'Who is driving?',
    text: online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 drivers; rival cars fill the grid. More can drop in mid-race by pressing FIRE.',
    min: 1, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => { if(G.mode === 'champ') startChampionship(players); else newRace(players); },
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'race' && G.state !== 'lights') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart race', select: () => newRace(G.players) }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: TK.def.name + ' · lap ' + Math.max(1, Math.min(G.laps, 1 + leaderLap())) + '/' + G.laps, title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'race'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'race'; }
function toTitle(){
  A.Menu.close(); A.Lobby.close(); A.Mirror.hide(); buf.clear();
  if(G.net) Net.close();
  G.net = null; G.mode = G.mode === 'champ' && !G.champ ? 'champ' : 'quick'; G.champ = null;
  startDemo(); titleMenu();
}
function leaveRoom(src, back){
  if(fromGuest(src)){ const peer = Net.peerOf(src.id); Net.kick(peer, 'kicked'); A.Input.Remote.disconnect(peer + '/'); return; }
  A.Menu.open({ center: true, kicker: 'Room ' + Net.code, title: 'Close the room?', text: 'Everyone playing online will be sent back to their title screen.',
    items: [{ label: 'Keep racing', select: back }, { label: 'Close the room', select: toTitle }], back });
}
function onlineMenu(src, start){
  G.state = 'online';
  if(!Net || !Net.available()){
    A.Menu.open({ center: true, kicker: 'Play online', title: 'Needs the internet', text: 'Online rooms work when the game is opened from <b>xretro.pages.dev</b>.',
      items: [{ label: 'Back', select: titleMenu }], back: titleMenu });
    return;
  }
  A.Menu.open({ center: true, kicker: 'Play online', title: 'Online rooms', start: start || 0,
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 drivers from any mix of devices.',
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
    Net.host('volt', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'volt', name, netHandlers).then(() => {
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
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to drive',
    text: 'Your electric car <b>accelerates by itself</b>. <b>Left/right</b> change lane, <b>down</b> brakes.<br>' +
          '<b>Regen:</b> braking (and rolling downhill) charges your battery. <b>Hold FIRE to BOOST</b>: extra speed that uses the battery. Empty battery = slow car, so brake before bends to charge up!<br>' +
          '<b>Bends:</b> take a bend too fast and the car slides wide (into the wall on street tracks). Brake a little first.<br>' +
          '<b>Attack Mode:</b> drive over the glowing pink pad in the left lane for 8 seconds of extra power. <b>DRS:</b> less than a second behind someone on a DRS straight? You get extra speed automatically. Tuck in behind a car for a <b>slipstream</b> tow.<br>' +
          '<b>Pit stop:</b> press <b>up</b> to "box", stay in the right lane at the end of the lap, then press FIRE when the needle is green for fresh tyres and a Pit Boost charge.<br>' +
          '<b>Safety car:</b> after a big spin, everyone slows down and nobody may pass until the green flag.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0;
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onRename(id, name){ const c = G.cars.find(x => x.source === id); if(c) c.name = name; const p = G.players.find(x => x.source === id); if(p) p.name = name; },
  onMessage(m){ if(m.t === 's'){ if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx); buf.push(m); } }
};
function sendSnap(){
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), rt: r2(G.raceT), ri: TK.rid, tk: TK.ix, d: G.diff, dm: G.demo ? 1 : 0,
    lp: G.laps, rn: G.rain ? 1 : 0, sc: r1(G.scT), ho: r2(G.hold), fl: G.fastest ? [r2(G.fastest.t), G.fastest.id] : 0,
    c: G.cars.map(c => [c.id, Math.round(c.dist), r3(c.x), Math.round(c.v),
      (c.boost ? 1 : 0) | (c.cpu ? 2 : 0) | (c.human ? 4 : 0) | (c.brake ? 8 : 0) | (c.regen ? 16 : 0) | (c.drs ? 32 : 0) | (c.slip ? 64 : 0) | (c.pitReq ? 128 : 0) | (c.off ? 256 : 0),
      Math.round(c.bat), r1(c.attackT), r2(c.tyre), c.pitSt, r2(c.pitT), r2(c.spinT), r2(c.hitT), r2(c.fin), r2(c.lastLap), r2(c.bestLap),
      c.name, c.color, c.source || '', c.msgT > 0 ? c.msg : '', r2(c.msgT), c.tx, r2(c.lapStart)]) };
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  Net.broadcast(s);
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!TK || TK.ix !== s.tk || TK.rid !== s.ri){ TK = buildTrack(s.tk); TK.rid = s.ri; }
  const same = a.ri === b.ri;
  G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.laps = s.lp; G.rain = !!s.rn; G.scT = s.sc; G.hold = s.ho;
  G.raceT = same && a.st === b.st ? L(a.rt, b.rt) : b.rt;
  G.fastest = s.fl ? { t: s.fl[0], id: s.fl[1] } : null;
  const prev = new Map(a.c.map(q => [q[0], q]));
  G.cars = s.c.map(q => {
    const o = same ? prev.get(q[0]) : null, near = o && Math.abs(o[1] - q[1]) < 3000, f = q[4];
    return { id: q[0], dist: near ? L(o[1], q[1]) : q[1], x: near ? L(o[2], q[2]) : q[2], v: q[3],
      boost: !!(f & 1), cpu: !!(f & 2), human: !!(f & 4), brake: !!(f & 8), regen: !!(f & 16), drs: !!(f & 32), slip: !!(f & 64), pitReq: !!(f & 128), off: !!(f & 256),
      bat: q[5], attackT: q[6], tyre: q[7], pitSt: q[8], pitT: q[9], spinT: q[10], hitT: q[11], fin: q[12], lastLap: q[13], bestLap: q[14],
      name: q[15], color: q[16], source: q[17], msg: q[18], msgT: q[19], tx: q[20], lapStart: q[21] };
  });
  G.fastest && (G.fastest.name = (G.cars.find(c => c.id === G.fastest.id) || {}).name);
  orderCars();
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  if(G.demo || G.state === 'title' || G.state === 'lobby' || G.state === 'online') want = A.THEMES.menu;
  else if(G.state === 'podium' || G.state === 'results' || G.state === 'champion') want = PODIUM_THEME;
  else if(TK) want = TK.def.music;
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(G.state === 'paused' || G.state === 'lights');
}
function myCars(){
  const hum = G.cars.filter(c => c.human);
  const mine = hum.filter(c => G.net === 'guest' ? Net.isMine(c.source) : !String(c.source).includes('/'));
  return (mine.length ? mine : hum).sort((a, b) => (a.slot || 0) - (b.slot || 0)).slice(0, 4);
}
function step(dt){
  G.time += dt;
  const racing = G.state === 'race' || G.state === 'lights';
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = racing && myCars().some(c => c.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('BOOST'); }
    Net.setPlaying(racing);
    music(); return;
  }
  const wantTouch = racing && G.cars.some(c => c.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('BOOST'); }
  music();
  if(Net) Net.setPlaying(racing);
  hostStep(dt);
  if(G.net === 'host'){ Net.hostTick(); if(++netStep % 2 === 0 && Net.hasGuests()) sendSnap(); }
}
function hostStep(dt){
  if(A.Lobby.isOpen()){ A.Lobby.update(); sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); if(G.demo || G.state === 'results' || G.state === 'champion') { G.stateT += dt; if(!G.demo) coolDown(dt); else sim(dt); } return; }
  if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
  const pausePressed = A.Input.all().some(s => A.Input.pressed(s, 'pause') && (s.kind !== 'net' || G.cars.some(c => c.source === s.id)));
  switch(G.state){
    case 'lights':
    case 'race':
      if(pausePressed){ pause(); return; }
      if(G.state === 'race') dropIn();
      sim(dt); break;
    case 'finishing':
      G.stateT += dt; sim(dt);
      if(G.stateT > 2.5) finishRace();
      break;
    case 'podium':
      G.stateT += dt; coolDown(dt);
      if(G.stateT > 5 || (G.stateT > 1.5 && A.Input.all().some(s => A.Input.pressed(s, 'fire')))) resultsMenu();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
/* After the flag everyone keeps rolling round slowly */
function coolDown(dt){
  G.cool = true;
  for(const c of G.cars){ c.v = Math.min(c.v, MAXV * 0.4); c.boost = false; c.brake = false; c.dist += c.v * dt; c.x += (LANES[c.tx] - c.x) * Math.min(1, dt * 3); if(c.pitSt) { c.pitSt = 0; } }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || (G.state !== 'race' && G.state !== 'lights') || G.net === 'guest') return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);
const cams = new Map();
const NEAR = 40;

function rng(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function text(c, str, x, y, size, color, align, base){ c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y); }
function outlined(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(1, size / 4); c.strokeStyle = 'rgba(8,8,14,.85)'; c.lineJoin = 'round'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function shade(hex, k){ const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
function rr(c, x, y, w, h, r){ r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); }
function quad(c, x1, y1, x2, y2, x3, y3, x4, y4, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4); c.closePath(); c.fill(); }
function bolt(c, x, y, s, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x + 0.2 * s, y - s); c.lineTo(x - 0.45 * s, y + 0.1 * s); c.lineTo(x - 0.02 * s, y + 0.1 * s); c.lineTo(x - 0.2 * s, y + s); c.lineTo(x + 0.45 * s, y - 0.12 * s); c.lineTo(x + 0.02 * s, y - 0.12 * s); c.closePath(); c.fill(); }

/* Colours for the road and verges */
function palette(def, seg){
  const night = def.night, wet = G.rain, alt = seg.color, tun = seg.flags.tunnel;
  const dim = tun ? 0.45 : night ? 0.62 : 1;
  const road = wet ? (alt ? '#43474f' : '#474b54') : (alt ? '#5a5c63' : '#5f6168');
  return {
    grass: tun ? '#2a2724' : def.street ? (alt ? shade('#8a8d96', dim) : shade('#80838c', dim)) : shade(alt ? def.grass[0] : def.grass[1], night ? 0.7 : 1),
    kerb: alt ? '#e8383a' : '#f4f1ea',
    road: shade(road, dim * (night && !tun ? 1.15 : 1)),
    line: tun ? '#b9b39a' : '#f0eee6'
  };
}

function drawView(c, v, car){
  let cam = cams.get(car.id); if(!cam){ cam = { bg: 0, last: G.time }; cams.set(car.id, cam); }
  const def = TK.def, f = v.h * 0.9, cx = v.x + v.w / 2, hy = v.y + v.h * 0.5;
  const cz0 = wrapZ(car.dist - CAM_BACK), b = Math.floor(cz0 / SEG), frac = (cz0 - b * SEG) / SEG;
  const carSeg = segAt(car.dist), cp = (wrapZ(car.dist) % SEG) / SEG;
  const carY = carSeg.y1 + (carSeg.y2 - carSeg.y1) * cp;
  const camY = carY + CAM_H, camX = car.x * ROADW * 0.82;
  const dt = Math.min(0.05, Math.max(0, G.time - cam.last)); cam.last = G.time;
  cam.bg += carSeg.curve * (car.v / MAXV) * dt * 14;
  c.save(); c.beginPath(); c.rect(v.x, v.y, v.w, v.h); c.clip();
  drawBackdrop(c, v, hy, cam.bg, def);
  // project the road ahead
  const P = [];
  let x = 0, dx = -(TK.segs[b % TK.N].curve * frac);
  for(let n = 0; n < DRAW; n++){
    const seg = TK.segs[(b + n) % TK.N];
    const z1 = n * SEG - frac * SEG, z2 = z1 + SEG;
    const x1 = x, x2 = x + dx; x += dx; dx += seg.curve;
    const zz1 = Math.max(NEAR, z1), zz2 = Math.max(NEAR + 1, z2);
    const s1 = FOV_DEPTH / zz1, s2 = FOV_DEPTH / zz2;
    P.push({ seg, z1, z2, x1, x2, s1, s2,
      sx1: cx + s1 * (x1 - camX) * f, sy1: hy - s1 * (seg.y1 - camY) * f, w1: s1 * ROADW * f,
      sx2: cx + s2 * (x2 - camX) * f, sy2: hy - s2 * (seg.y2 - camY) * f, w2: s2 * ROADW * f, cars: [] });
  }
  // ground under everything
  c.fillStyle = palette(def, TK.segs[b % TK.N]).grass; c.fillRect(v.x, hy, v.w, v.y + v.h - hy);
  // put every car (and the safety car) into the segment it is on
  const list = G.cars.slice();
  if(G.scT > 0 && G.order && G.order.length){ const lead = G.order.find(q => q.fin < 0) || G.order[0]; list.push({ sc: true, id: -1, dist: lead.dist + 6 * SEG, x: 0, v: lead.v }); }
  for(const q of list){
    const rz = wrapZ(q.dist - cz0);
    if(rz < NEAR + 60 || rz >= (DRAW - 1) * SEG) continue;
    const n = Math.floor((rz + frac * SEG) / SEG);
    if(P[n]) P[n].cars.push({ q, rz });
  }
  for(let n = DRAW - 1; n >= 0; n--){
    const p = P[n];
    if(p.z2 <= NEAR) continue;
    drawSegment(c, v, p, def, n);
    drawSegmentExtras(c, v, p, def, f, n, P);
    for(const spr of p.seg.sprites) drawSprite(c, v, p, spr, f, def);
    p.cars.sort((a, b2) => b2.rz - a.rz);
    for(const it of p.cars){
      const q = it.q, t = clamp((it.rz - p.z1) / SEG, 0, 1), s = FOV_DEPTH / it.rz;
      const wy = p.seg.y1 + (p.seg.y2 - p.seg.y1) * t, wx = p.x1 + (p.x2 - p.x1) * t + q.x * ROADW;
      const sx = cx + s * (wx - camX) * f, sy = hy - s * (wy - camY) * f;
      if(q.sc){ drawSafetyCar(c, sx, sy, s * f); continue; }
      // cars right behind yours (between you and the camera) would fill the screen: fade them, skip the closest
      if(q !== car && it.rz < CAM_BACK - 150){ if(it.rz < CAM_BACK * 0.72) continue; c.globalAlpha = 0.5; }
      drawCar(c, q, sx, sy, s * f, q === car, v);
      c.globalAlpha = 1;
    }
  }
  if(def.night) nightGlow(c, v, hy);
  if(G.rain) drawRain(c, v, car);
  drawViewHUD(c, v, car);
  c.restore();
}

function drawSegment(c, v, p, def, n){
  const seg = p.seg, col = palette(def, seg);
  const y1 = p.sy1, y2 = p.sy2;
  if(y2 >= y1 - 0.01 && n > 0) { /* seen from behind a crest: still paint the verge so nothing shows through */ }
  const top = Math.min(y1, y2), bot = Math.max(y1, y2);
  c.fillStyle = col.grass; c.fillRect(v.x, top, v.w, bot - top + 1);
  // pit lane on the right-hand side
  if(seg.pitLane){
    c.fillStyle = col.road; c.beginPath(); c.moveTo(p.sx1 + p.w1 * 1.1, y1); c.lineTo(p.sx1 + p.w1 * 1.85, y1); c.lineTo(p.sx2 + p.w2 * 1.85, y2); c.lineTo(p.sx2 + p.w2 * 1.1, y2); c.fill();
    if(seg.color) quad(c, p.sx1 + p.w1 * 1.1, y1, p.sx1 + p.w1 * 1.13, y1, p.sx2 + p.w2 * 1.13, y2, p.sx2 + p.w2 * 1.1, y2, '#f0eee6');
    if(seg.i === TK.pitBox || seg.i === TK.pitBox + 1) quad(c, p.sx1 + p.w1 * 1.25, y1, p.sx1 + p.w1 * 1.7, y1, p.sx2 + p.w2 * 1.7, y2, p.sx2 + p.w2 * 1.25, y2, '#f5c542');
  }
  // kerbs
  const kw1 = p.w1 * 0.1, kw2 = p.w2 * 0.1;
  quad(c, p.sx1 - p.w1 - kw1, y1, p.sx1 - p.w1, y1, p.sx2 - p.w2, y2, p.sx2 - p.w2 - kw2, y2, col.kerb);
  quad(c, p.sx1 + p.w1 + kw1, y1, p.sx1 + p.w1, y1, p.sx2 + p.w2, y2, p.sx2 + p.w2 + kw2, y2, col.kerb);
  // road
  quad(c, p.sx1 - p.w1, y1, p.sx1 + p.w1, y1, p.sx2 + p.w2, y2, p.sx2 - p.w2, y2, col.road);
  // white edge lines and dashed lane lines (3 lanes)
  const e1 = p.w1 * 0.025, e2 = p.w2 * 0.025;
  quad(c, p.sx1 - p.w1, y1, p.sx1 - p.w1 + e1, y1, p.sx2 - p.w2 + e2, y2, p.sx2 - p.w2, y2, col.line);
  quad(c, p.sx1 + p.w1, y1, p.sx1 + p.w1 - e1, y1, p.sx2 + p.w2 - e2, y2, p.sx2 + p.w2, y2, col.line);
  if(seg.color){
    for(const lx of [-1 / 3, 1 / 3]){
      const a1 = p.sx1 + p.w1 * lx, a2 = p.sx2 + p.w2 * lx, h1 = p.w1 * 0.014, h2 = p.w2 * 0.014;
      quad(c, a1 - h1, y1, a1 + h1, y1, a2 + h2, y2, a2 - h2, y2, col.line);
    }
  }
  // Attack Mode pad: glowing pink panel in the left lane
  if(seg.pad){
    const glow = 0.55 + 0.35 * Math.sin(G.time * 10 + seg.i);
    c.globalAlpha = glow; quad(c, p.sx1 - p.w1 * 0.97, y1, p.sx1 - p.w1 * 0.37, y1, p.sx2 - p.w2 * 0.37, y2, p.sx2 - p.w2 * 0.97, y2, '#ff4fd8'); c.globalAlpha = 1;
    if(seg.i % 3 === 0){ const m1 = p.sx1 - p.w1 * 0.67, m2 = p.sx2 - p.w2 * 0.67; quad(c, m1 - p.w1 * 0.15, y1, m1, y1 - (y1 - y2) * 0.2, m2, y2, m2 - p.w2 * 0.15, y2, 'rgba(255,255,255,.6)'); }
  }
  // wet road shine
  if(G.rain && seg.color && !seg.flags.tunnel){ c.globalAlpha = 0.12; quad(c, p.sx1 - p.w1 * 0.2, y1, p.sx1 + p.w1 * 0.2, y1, p.sx2 + p.w2 * 0.2, y2, p.sx2 - p.w2 * 0.2, y2, '#cfe6ff'); c.globalAlpha = 1; }
  // start/finish: a chequered band; grid boxes behind it
  if(seg.i === 0){
    const rows = 2, cols = 14;
    for(let r = 0; r < rows; r++) for(let k = 0; k < cols; k++){
      if((r + k) % 2) continue;
      const ya = y1 + (y2 - y1) * (r / rows), yb = y1 + (y2 - y1) * ((r + 1) / rows);
      const sa = p.sx1 + (p.sx2 - p.sx1) * (r / rows), wa = p.w1 + (p.w2 - p.w1) * (r / rows);
      const sb = p.sx1 + (p.sx2 - p.sx1) * ((r + 1) / rows), wb = p.w1 + (p.w2 - p.w1) * ((r + 1) / rows);
      const u0 = -1 + 2 * k / cols, u1 = -1 + 2 * (k + 1) / cols;
      quad(c, sa + wa * u0, ya, sa + wa * u1, ya, sb + wb * u1, yb, sb + wb * u0, yb, '#f4f1ea');
    }
    quad(c, p.sx1 - p.w1, y1, p.sx1 + p.w1, y1, p.sx1 + p.w1, y1 - 0.01, p.sx1 - p.w1, y1 - 0.01, '#111');
  } else if(seg.i > TK.N - 20 && seg.i % 2 === 0){
    const lane = (seg.i / 2) % 2 ? 0 : 2, lx = LANES[lane];
    const a1 = p.sx1 + p.w1 * lx, a2 = p.sx2 + p.w2 * lx;
    quad(c, a1 - p.w1 * 0.22, y1, a1 + p.w1 * 0.22, y1, a2 + p.w2 * 0.22, y2, a2 - p.w2 * 0.22, y2, 'rgba(244,241,234,.55)');
    quad(c, a1 - p.w1 * 0.19, y1, a1 + p.w1 * 0.19, y1, a2 + p.w2 * 0.19, y2, a2 - p.w2 * 0.19, y2, col.road);
  }
}

/* Walls, tunnels, bridges and pit walls: vertical surfaces built from the segment's edges */
function wallQuad(c, p, u, hWorld, f, col, u2){
  const ua = u, ub = u2 === undefined ? u : u2;
  const bx1 = p.sx1 + p.w1 * ua, bx2 = p.sx2 + p.w2 * ub;
  const t1 = p.sy1 - hWorld * p.s1 * f, t2 = p.sy2 - hWorld * p.s2 * f;
  quad(c, bx1, p.sy1, bx2, p.sy2, bx2, t2, bx1, t1, col);
  return [bx1, t1, bx2, t2];
}
function drawSegmentExtras(c, v, p, def, f, n, P){
  const seg = p.seg, alt = seg.color;
  if(seg.flags.tunnel){
    const H = 1500;
    const L = wallQuad(c, p, -1.12, H, f, alt ? '#6b6158' : '#62584f'), R = wallQuad(c, p, 1.12, H, f, alt ? '#6b6158' : '#62584f');
    quad(c, L[0], L[1], R[0], R[1], R[2], R[3], L[2], L[3], alt ? '#3d3630' : '#37302b');
    if(seg.i % 8 === 0 && p.z1 > 400){ c.fillStyle = '#fff1b0'; const lx = (L[0] + R[0]) / 2, ly = (L[1] + R[1]) / 2 + 1; rr(c, lx - p.w1 * 0.3, ly, p.w1 * 0.6, Math.max(1, p.w1 * 0.04), 1); c.fill(); }
    // the tunnel mouth, seen from outside
    const prev = TK.segs[(seg.i - 1 + TK.N) % TK.N];
    if(!prev.flags.tunnel){
      const top = p.sy1 - H * p.s1 * f, lx = p.sx1 - p.w1 * 1.12, rx = p.sx1 + p.w1 * 1.12;
      c.fillStyle = '#e9d3b0'; c.fillRect(v.x, v.y, v.w, top - v.y);
      c.fillRect(v.x, top, lx - v.x, p.sy1 - top); c.fillRect(rx, top, v.x + v.w - rx, p.sy1 - top);
      c.fillStyle = '#c9b08a'; c.fillRect(v.x, top - p.w1 * 0.08, v.w, p.w1 * 0.08);
      // hotel windows above the tunnel
      c.fillStyle = def.night ? '#ffd98a' : '#7fa8c8';
      const ww = p.w1 * 0.12, gap = p.w1 * 0.3;
      for(let wx = lx - gap * 6; wx < rx + gap * 6; wx += gap) for(let k = 1; k < 5; k++){ const wyy = top - k * p.w1 * 0.3; if(wyy > v.y - 10) c.fillRect(wx, wyy, ww, p.w1 * 0.15); }
    }
    return;
  }
  if(def.street){
    const pit = seg.pitLane, ad = Math.floor(seg.i / 6) % 4;
    const colA = ad === 0 ? (def.wallCol || '#cfd5de') : ad === 1 ? '#3f8fe0' : ad === 2 ? (def.wallCol || '#cfd5de') : '#e2463c';
    wallQuad(c, p, -1.12, 260, f, colA);
    if(pit){ wallQuad(c, p, 1.1, 170, f, '#f4f1ea'); wallQuad(c, p, 1.95, 300, f, '#8d93a1'); }
    else wallQuad(c, p, 1.12, 260, f, ad === 1 ? '#e2463c' : ad === 3 ? '#3f8fe0' : (def.wallCol || '#cfd5de'));
  } else if(seg.pitLane){
    wallQuad(c, p, 1.1, 170, f, '#f4f1ea');
    if(seg.i % 4 < 2) wallQuad(c, p, 1.1, 170, f, '#e2463c');
  }
  if(seg.flags.over){
    wallQuad(c, p, -1.14, 180, f, alt ? '#b8bec8' : '#a8aeb8'); wallQuad(c, p, 1.14, 180, f, alt ? '#b8bec8' : '#a8aeb8');
  }
}

/* ---------- Sprites ---------- */
function drawSprite(c, v, p, spr, f, def){
  const s = p.s1 * f;                          // pixels per world unit
  if(s * 2000 < 0.8) return;
  const x = p.sx1 + p.w1 * spr.x, y = p.sy1, night = def.night;
  if(x < v.x - s * 4000 || x > v.x + v.w + s * 4000) return;
  switch(spr.kind){
    case 'palm': {
      const h = 2300 * s, lean = (spr.x < 0 ? -1 : 1) * 300 * s;
      c.strokeStyle = night ? '#3c2e22' : '#8a6038'; c.lineWidth = Math.max(1, 110 * s); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x, y - h * 0.6, x + lean, y - h); c.stroke();
      c.strokeStyle = night ? '#1f4a2a' : '#2f9e44'; c.lineWidth = Math.max(1, 130 * s); c.lineCap = 'round';
      for(let i = 0; i < 6; i++){ const a = -Math.PI / 2 + (i - 2.5) * 0.55, L = 900 * s; c.beginPath(); c.moveTo(x + lean, y - h); c.quadraticCurveTo(x + lean + Math.cos(a) * L * 0.7, y - h + Math.sin(a) * L * 0.5 - 200 * s, x + lean + Math.cos(a) * L, y - h + 280 * s); c.stroke(); }
      c.lineCap = 'butt'; break;
    }
    case 'tree': {
      const h = 1900 * s, r = 700 * s;
      c.fillStyle = night ? '#2a2018' : '#6b4a2e'; c.fillRect(x - 70 * s, y - h * 0.55, 140 * s, h * 0.55);
      const cA = spr.dry ? '#8f9a3a' : night ? '#1c3b24' : '#3a8a3a', cB = spr.dry ? '#a9b44a' : night ? '#24492d' : '#4fa446';
      c.fillStyle = cA; circ(c, x, y - h * 0.7, r); c.fill(); circ(c, x - r * 0.6, y - h * 0.55, r * 0.7); c.fill(); circ(c, x + r * 0.6, y - h * 0.58, r * 0.7); c.fill();
      c.fillStyle = cB; circ(c, x - r * 0.25, y - h * 0.8, r * 0.55); c.fill(); break;
    }
    case 'pine': {
      const h = 2400 * s, w = 800 * s;
      c.fillStyle = '#4a3322'; c.fillRect(x - 60 * s, y - h * 0.2, 120 * s, h * 0.2);
      for(let k = 0; k < 3; k++){ c.fillStyle = k % 2 ? '#1f5a2e' : '#256b35'; c.beginPath(); const yb = y - h * (0.15 + k * 0.25), yt = yb - h * 0.45; const ww = w * (1 - k * 0.22); c.moveTo(x - ww, yb); c.lineTo(x, yt); c.lineTo(x + ww, yb); c.closePath(); c.fill(); }
      break;
    }
    case 'bush': { c.fillStyle = night ? '#1d3a24' : '#3d8f3a'; circ(c, x, y - 200 * s, 320 * s); c.fill(); circ(c, x + 280 * s, y - 150 * s, 240 * s); c.fill(); break; }
    case 'house': {
      const w = 1700 * s, h = 1400 * s;
      c.fillStyle = spr.col; c.fillRect(x - w / 2, y - h, w, h);
      c.fillStyle = '#c0583a'; c.beginPath(); c.moveTo(x - w * 0.55, y - h); c.lineTo(x, y - h - 400 * s); c.lineTo(x + w * 0.55, y - h); c.fill();
      c.fillStyle = '#5a7fa0'; for(let i = 0; i < 3; i++) for(let k = 0; k < 2; k++) c.fillRect(x - w * 0.38 + i * w * 0.28, y - h * 0.85 + k * h * 0.38, w * 0.14, h * 0.2);
      break;
    }
    case 'tower': {
      const w = 1500 * s, h = spr.h * 1000 * s;
      c.fillStyle = spr.col; c.fillRect(x - w / 2, y - h, w, h);
      c.fillStyle = night ? '#ffd98a' : '#9fc4e0';
      const cw = Math.max(1, w * 0.12), ch = Math.max(1, 180 * s);
      for(let yy = y - h + 200 * s; yy < y - 300 * s; yy += 420 * s) for(let i = 0; i < 4; i++) if(rng(Math.floor(yy) * 7 + i + spr.h * 13) < 0.6) c.fillRect(x - w * 0.4 + i * w * 0.22, yy, cw, ch);
      break;
    }
    case 'flood': {
      const h = 2800 * s;
      c.fillStyle = '#6f7482'; c.fillRect(x - 40 * s, y - h, 80 * s, h);
      c.fillStyle = '#9aa0ad'; c.fillRect(x - 380 * s, y - h - 120 * s, 760 * s, 240 * s);
      c.fillStyle = '#fffbe0'; for(let i = 0; i < 4; i++) c.fillRect(x - 340 * s + i * 180 * s, y - h - 90 * s, 140 * s, 180 * s);
      c.globalAlpha = 0.1; c.fillStyle = '#fff3b8'; circ(c, x, y - h, 520 * s); c.fill(); c.globalAlpha = 0.16; circ(c, x, y - h, 260 * s); c.fill(); c.globalAlpha = 1;
      break;
    }
    case 'board': {
      const w = 1800 * s, h = 460 * s, top = y - 700 * s;
      c.fillStyle = '#444'; c.fillRect(x - w * 0.4, top + h, 60 * s, 240 * s); c.fillRect(x + w * 0.4, top + h, 60 * s, 240 * s);
      const hy = spr.text === 'HUMBLE YETI';
      c.fillStyle = hy ? '#328F42' : spr.text === 'XRETRO' ? '#17181d' : '#f5c542'; c.fillRect(x - w / 2, top, w, h);
      if(h > 4){ const sz = fitText(c, spr.text, w * 0.9, h * 0.6); text(c, spr.text, x, top + h / 2 + 0.5, sz, hy ? '#F5E20A' : spr.text === 'XRETRO' ? '#ff5a4e' : '#17181d', 'center', 'middle'); }
      break;
    }
    case 'sign': {
      const w = 760 * s, h = 360 * s, top = y - 900 * s;
      c.fillStyle = '#555'; c.fillRect(x - 30 * s, top + h, 60 * s, 540 * s);
      c.fillStyle = spr.col || '#3fd07a'; c.fillRect(x - w / 2, top, w, h);
      if(h > 3){ const sz = fitText(c, spr.text, w * 0.86, h * 0.62); text(c, spr.text, x, top + h / 2 + 0.5, sz, '#101014', 'center', 'middle'); }
      break;
    }
    case 'marshal': {
      const h = 800 * s;
      c.fillStyle = '#e9ecf1'; c.fillRect(x - 200 * s, y - h, 400 * s, h);
      c.fillStyle = '#e2463c'; c.fillRect(x - 200 * s, y - h, 400 * s, 90 * s);
      const col = G.scT > 0 ? '#f5c542' : G.state === 'race' || G.demo ? '#3fd07a' : '#f5c542';
      const wv = Math.sin(G.time * 9 + spr.x) * 80 * s;
      c.fillStyle = '#333'; c.fillRect(x + 150 * s, y - h - 500 * s, 30 * s, 500 * s);
      c.fillStyle = col; c.beginPath(); c.moveTo(x + 180 * s, y - h - 500 * s); c.lineTo(x + 560 * s, y - h - 440 * s + wv); c.lineTo(x + 180 * s, y - h - 280 * s); c.fill();
      break;
    }
    case 'stand': {
      const w = 2600 * s, h = 1000 * s;
      c.fillStyle = '#b8bec8'; c.fillRect(x - w / 2, y - h, w, h);
      c.fillStyle = '#e2463c'; c.fillRect(x - w / 2 - 60 * s, y - h - 180 * s, w + 120 * s, 180 * s);
      if(s * 100 > 0.6){
        for(let r = 0; r < 4; r++) for(let k = 0; k < 14; k++){
          const hue = Math.floor(rng(r * 31 + k * 7 + spr.x * 3) * 360), bob = Math.sin(G.time * 6 + k + r) * 20 * s;
          c.fillStyle = 'hsl(' + hue + ',70%,' + (def.night ? 55 : 60) + '%)'; c.fillRect(x - w * 0.46 + k * w * 0.066, y - h + 160 * s + r * 200 * s + bob, 110 * s, 110 * s);
        }
      }
      break;
    }
    case 'gantry': {
      const pw = 120 * s, top = y - 1500 * s, lx = p.sx1 - p.w1 * 1.18, rx = p.sx1 + p.w1 * 1.18;
      c.fillStyle = '#3a3d48'; c.fillRect(lx - pw / 2, top, pw, y - top); c.fillRect(rx - pw / 2, top, pw, y - top);
      c.fillStyle = '#23252e'; c.fillRect(lx, top, rx - lx, 380 * s);
      if(380 * s > 4){ const sz = fitText(c, 'VOLT GP', (rx - lx) * 0.25, 250 * s); text(c, 'VOLT GP', lx + (rx - lx) * 0.16, top + 190 * s, sz, '#7fe3ff', 'center', 'middle'); text(c, TK.def.name.toUpperCase(), lx + (rx - lx) * 0.84, top + 190 * s, fitText(c, TK.def.name.toUpperCase(), (rx - lx) * 0.25, 250 * s), '#f5c542', 'center', 'middle'); }
      const lit = lightsLit();
      for(let i = 0; i < 5; i++){
        const bx = x - 560 * s + i * 280 * s;
        c.fillStyle = '#101014'; c.fillRect(bx - 110 * s, top + 40 * s, 220 * s, 300 * s);
        c.fillStyle = i < lit ? '#ff3b30' : '#3a1414'; circ(c, bx, top + 190 * s, 90 * s); c.fill();
      }
      break;
    }
    case 'bridge': {
      const top = y - 1900 * s, deck = 380 * s;
      c.fillStyle = '#9aa1ad'; c.fillRect(v.x, top, v.w, deck);
      c.fillStyle = '#7d8492'; c.fillRect(v.x, top + deck, v.w, 60 * s);
      c.fillStyle = '#e2463c'; c.fillRect(v.x, top - 90 * s, v.w, 90 * s);
      c.fillStyle = '#8d94a1'; for(const u of [-1.45, 1.45]){ const px = p.sx1 + p.w1 * u; c.fillRect(px - 150 * s, top + deck, 300 * s, y - top - deck); }
      break;
    }
  }
}
function lightsLit(){
  if(G.state !== 'lights') return 0;
  let n = 0; for(let i = 0; i < 5; i++) if(G.stateT >= 0.5 + i * 0.7) n++;
  return n;
}

/* ---------- Cars (seen from behind) ---------- */
function drawCar(c, q, sx, sy, ppu, focus, v){
  const W = CAR_W * ROADW * ppu;          // pixel width of the car
  if(W < 1.2) return;
  const H = W * 0.5;
  c.save(); c.translate(sx, sy);
  // shadow
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, -W * 0.01, W * 0.56, W * 0.07, 0, 0, Math.PI * 2); c.fill();
  if(q.spinT > 0) c.rotate(Math.sin(q.spinT * 14) * 0.45);
  const col = q.color || '#e2463c', dk = shade(col, 0.62), lt = shade(col, 1.25);
  // boost: blue electric crackle behind the car
  if(q.boost){
    c.strokeStyle = 'rgba(127,227,255,.9)'; c.lineWidth = Math.max(0.6, W * 0.025);
    for(let k = 0; k < 3; k++){
      c.beginPath(); let px = (rng(Math.floor(G.time * 30) + k * 9) - 0.5) * W * 0.5, py = -H * 0.25;
      c.moveTo(px, py);
      for(let j = 0; j < 4; j++){ px += (rng(Math.floor(G.time * 30) + k * 9 + j) - 0.5) * W * 0.25; py += W * 0.07; c.lineTo(px, py); }
      c.stroke();
    }
    c.fillStyle = 'rgba(127,227,255,.25)'; c.beginPath(); c.ellipse(0, -H * 0.2, W * 0.5, H * 0.45, 0, 0, Math.PI * 2); c.fill();
  }
  // rain spray
  if(G.rain && q.v > MAXV * 0.3){
    c.fillStyle = 'rgba(220,235,255,.28)';
    for(let k = 0; k < 4; k++){ const ph = (G.time * 3 + k * 0.25) % 1; c.beginPath(); c.ellipse((k % 2 ? 1 : -1) * W * (0.4 + ph * 0.1), -H * 0.25 - ph * H * 0.6, W * (0.1 + ph * 0.14), H * (0.16 + ph * 0.16), 0, 0, Math.PI * 2); c.fill(); }
  }
  // rear tyres
  const tw = W * 0.2, th = H * 0.72;
  for(const sgn of [-1, 1]){
    const tx = sgn * (W * 0.5 - tw / 2);
    c.fillStyle = '#15151a'; rr(c, tx - tw / 2, -th, tw, th, tw * 0.3); c.fill();
    if(W > 12){ c.fillStyle = '#2c2c34'; const ph = (q.dist || 0) / 60 % 1; for(let k = 0; k < 3; k++){ const yy = -th + ((k / 3 + ph) % 1) * th; c.fillRect(tx - tw / 2 + tw * 0.15, yy, tw * 0.7, Math.max(0.5, th * 0.06)); } }
    if(W > 10){ c.fillStyle = q.tyre < 0.5 ? '#ff9f43' : '#f5c542'; c.fillRect(tx - tw / 2 + tw * 0.1, -th * 0.55, tw * 0.8, Math.max(0.5, th * 0.05)); }
  }
  // floor & diffuser
  c.fillStyle = '#1d1e25'; c.fillRect(-W * 0.3, -H * 0.3, W * 0.6, H * 0.3);
  // sidepods and engine cover
  c.fillStyle = dk; c.beginPath(); c.moveTo(-W * 0.3, -H * 0.3); c.lineTo(-W * 0.26, -H * 0.62); c.lineTo(W * 0.26, -H * 0.62); c.lineTo(W * 0.3, -H * 0.3); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(-W * 0.15, -H * 0.3); c.lineTo(-W * 0.1, -H * 1.0); c.lineTo(W * 0.1, -H * 1.0); c.lineTo(W * 0.15, -H * 0.3); c.fill();
  c.fillStyle = lt; c.fillRect(-W * 0.03, -H * 0.98, W * 0.06, H * 0.66);
  // halo and helmet
  const hy = -H * 1.06;
  c.fillStyle = q.human ? col : '#f4f1ea'; circ(c, 0, hy, W * 0.075); c.fill();
  c.fillStyle = q.human ? '#fff' : col; c.fillRect(-W * 0.075, hy - W * 0.012, W * 0.15, W * 0.024);
  c.strokeStyle = q.attackT > 0 ? (Math.floor(G.time * 10) % 2 ? '#ff4fd8' : '#ff9ff0') : '#26272f'; c.lineWidth = Math.max(0.6, W * 0.03);
  c.beginPath(); c.arc(0, hy + W * 0.02, W * 0.1, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  if(q.attackT > 0){ c.fillStyle = 'rgba(255,79,216,.25)'; circ(c, 0, hy, W * 0.2); c.fill(); }
  // rear wing: endplates, main plane and flap (the flap lifts when DRS is open)
  const wy = -H * 1.25, ww = W * 0.44;
  c.fillStyle = '#26272f'; c.fillRect(-ww - W * 0.03, wy - H * 0.05, W * 0.05, H * 0.55); c.fillRect(ww - W * 0.02, wy - H * 0.05, W * 0.05, H * 0.55);
  c.fillStyle = dk; c.fillRect(-ww, wy + H * 0.2, ww * 2, H * 0.14);
  c.fillStyle = col; c.fillRect(-ww, q.drs ? wy - H * 0.12 : wy, ww * 2, H * 0.16);
  if(W > 18){ c.fillStyle = '#fff'; const nm = (q.name || '').toUpperCase().slice(0, 8), sz = fitText(c, nm, ww * 1.4, H * 0.13); text(c, nm, 0, (q.drs ? wy - H * 0.12 : wy) + H * 0.08, sz, '#fff', 'center', 'middle'); }
  // rear light: steady red, flashes when harvesting energy (regen), bright when braking
  const flash = q.regen && Math.floor(G.time * 12) % 2;
  c.fillStyle = q.brake ? '#ff2d2d' : flash ? '#ff8080' : '#b31f2a';
  c.beginPath(); c.moveTo(-W * 0.06, -H * 0.18); c.lineTo(W * 0.06, -H * 0.18); c.lineTo(0, -H * 0.02); c.fill();
  if(q.brake || flash){ c.fillStyle = 'rgba(255,60,60,.3)'; circ(c, 0, -H * 0.12, W * 0.12); c.fill(); }
  // slipstream air lines
  if(q.slip && focus){ c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; for(let k = 0; k < 4; k++){ const xx = (k - 1.5) * W * 0.38, ph = (G.time * 4 + k * 0.3) % 1; c.beginPath(); c.moveTo(xx * (1 + ph * 0.3), -H * (1.9 - ph * 0.6)); c.lineTo(xx * (1.1 + ph * 0.3), -H * (1.6 - ph * 0.6)); c.stroke(); } }
  // wall sparks
  if(q.hitT > 0){ c.strokeStyle = '#ffd166'; c.lineWidth = Math.max(0.6, W * 0.02); for(let k = 0; k < 6; k++){ const a = rng(Math.floor(G.time * 40) + k) * Math.PI - Math.PI, L = W * (0.2 + rng(k + 3) * 0.3); const ox = (q.x < 0 ? -1 : 1) * W * 0.5; c.beginPath(); c.moveTo(ox, -H * 0.3); c.lineTo(ox + Math.cos(a) * L, -H * 0.3 + Math.sin(a) * L); c.stroke(); } }
  c.restore();
  // name tag over other human cars (and yours when screens are shared)
  if(q.human && !focus && W > 6 && W < 70){
    const nm = (q.name || '').toUpperCase(), sz = Math.max(3.5, Math.min(6, W * 0.12));
    outlined(c, nm, sx, sy - H * 1.7 - sz, sz, q.color);
  }
}
function drawSafetyCar(c, sx, sy, ppu){
  const W = 0.42 * ROADW * ppu; if(W < 1.2) return;
  const H = W * 0.45;
  c.save(); c.translate(sx, sy);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 0, W * 0.55, W * 0.06, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#15151a'; c.fillRect(-W * 0.48, -H * 0.4, W * 0.18, H * 0.4); c.fillRect(W * 0.3, -H * 0.4, W * 0.18, H * 0.4);
  c.fillStyle = '#f5c542'; rr(c, -W * 0.5, -H * 1.0, W, H * 0.7, H * 0.15); c.fill();
  c.fillStyle = '#2a2d38'; rr(c, -W * 0.34, -H * 1.35, W * 0.68, H * 0.42, H * 0.12); c.fill();
  const on = Math.floor(G.time * 6) % 2;
  c.fillStyle = on ? '#ff9f1a' : '#7a4a0a'; c.fillRect(-W * 0.3, -H * 1.5, W * 0.25, H * 0.14);
  c.fillStyle = on ? '#7a4a0a' : '#ff9f1a'; c.fillRect(W * 0.05, -H * 1.5, W * 0.25, H * 0.14);
  c.fillStyle = '#ff3b30'; c.fillRect(-W * 0.46, -H * 0.8, W * 0.12, H * 0.14); c.fillRect(W * 0.34, -H * 0.8, W * 0.12, H * 0.14);
  if(W > 16){ const sz = fitText(c, 'SAFETY CAR', W * 0.8, H * 0.2); text(c, 'SAFETY CAR', 0, -H * 0.6, sz, '#17181d', 'center', 'middle'); }
  c.restore();
}

/* ---------- Backgrounds: every track has its own skyline ---------- */
function drawBackdrop(c, v, hy, off, def){
  const g = c.createLinearGradient(0, v.y, 0, hy);
  g.addColorStop(0, def.sky[0]); g.addColorStop(1, G.rain ? '#9aa4b0' : def.sky[1]);
  c.fillStyle = g; c.fillRect(v.x, v.y, v.w, hy - v.y + 1);
  const W = v.w, k = v.h / 216, px = (par, span) => ((-off * par * 60 * k) % span + span) % span;
  if(def.night){
    c.fillStyle = '#fff';
    for(let i = 0; i < 40; i++){ const sx = v.x + ((rng(i) * W * 2 + px(0.05, W * 2)) % (W * 2)) - W * 0.5, sy = v.y + rng(i + 50) * (hy - v.y) * 0.8; if(sx > v.x && sx < v.x + W) c.fillRect(sx, sy, 1, 1); }
    c.fillStyle = '#f4f1dc'; circ(c, v.x + W * 0.8, v.y + (hy - v.y) * 0.25, 7 * k); c.fill();
  } else if(!G.rain){
    c.fillStyle = 'rgba(255,248,210,.9)'; circ(c, v.x + W * 0.78, v.y + (hy - v.y) * 0.3, (def.look === 'plains' ? 14 : 9) * k); c.fill();
  }
  // clouds (or rain clouds)
  if(!def.night){
    c.fillStyle = G.rain ? 'rgba(90,98,112,.85)' : 'rgba(255,255,255,.85)';
    for(let i = 0; i < 5; i++){ const span = W * 1.6, cx = v.x - W * 0.3 + (rng(i * 3) * span + px(0.12, span)) % span, cy = v.y + (0.15 + rng(i * 5) * 0.35) * (hy - v.y); const r = (6 + rng(i) * 6) * k; circ(c, cx, cy, r); c.fill(); circ(c, cx + r, cy + r * 0.2, r * 0.8); c.fill(); circ(c, cx - r, cy + r * 0.25, r * 0.7); c.fill(); }
  }
  const layer = (par, fn) => { const span = W * 2, o = px(par, span); for(let rep = -1; rep < 2; rep++) fn(v.x + rep * span - o + W * 0.0, span); };
  const look = def.look;
  if(look === 'harbour' || look === 'marina' || look === 'lake'){
    // water at the horizon
    c.fillStyle = def.night ? '#0d1838' : '#2f8fd0'; c.fillRect(v.x, hy - 5 * k, W, 5 * k + 1);
    c.fillStyle = def.night ? 'rgba(255,217,138,.35)' : 'rgba(255,255,255,.45)'; for(let i = 0; i < 10; i++) c.fillRect(v.x + ((rng(i + 9) * W + px(0.3, W)) % W), hy - (1 + rng(i) * 3) * k, 5 * k, 0.6);
  }
  if(look === 'harbour'){
    layer(0.25, (x0, span) => { c.fillStyle = '#6f8f6a'; c.beginPath(); c.moveTo(x0, hy - 5 * k); for(let i = 0; i <= 16; i++) c.lineTo(x0 + i * span / 16, hy - 5 * k - (14 + 10 * Math.sin(i * 1.3)) * k); c.lineTo(x0 + span, hy - 5 * k); c.fill();
      for(let i = 0; i < 28; i++){ c.fillStyle = ['#f4d7a6', '#f0b8a0', '#fbe9d0', '#e8c4c4'][i % 4]; c.fillRect(x0 + i * span / 28, hy - 5 * k - (6 + rng(i) * 12) * k, 5 * k, (4 + rng(i + 1) * 8) * k); } });
    layer(0.45, (x0, span) => { for(let i = 0; i < 6; i++){ const bx = x0 + (i + 0.3) * span / 6, by = hy - 2 * k; c.fillStyle = '#f4f1ea'; c.beginPath(); c.moveTo(bx - 7 * k, by - 2 * k); c.lineTo(bx + 8 * k, by - 2 * k); c.lineTo(bx + 5 * k, by); c.lineTo(bx - 5 * k, by); c.fill(); c.fillRect(bx - 2 * k, by - 4 * k, 5 * k, 2 * k); c.fillStyle = '#c9cdd6'; c.fillRect(bx, by - 10 * k, 0.6, 8 * k); } });
  } else if(look === 'marina' || look === 'lake'){
    layer(0.2, (x0, span) => {
      for(let i = 0; i < 22; i++){
        const bw = (8 + rng(i * 3) * 8) * k, bh = (18 + rng(i * 7) * 34) * k, bx = x0 + i * span / 22;
        c.fillStyle = def.look === 'lake' ? '#1b1c3a' : '#161a36'; c.fillRect(bx, hy - 5 * k - bh, bw, bh);
        c.fillStyle = 'rgba(255,217,138,.8)'; for(let yy = hy - 5 * k - bh + 3 * k; yy < hy - 7 * k; yy += 4 * k) for(let xx = 1; xx < bw - 1; xx += 3 * k) if(rng(i * 97 + yy * 3 + xx) < 0.45) c.fillRect(bx + xx, yy, 1.2 * k, 1.2 * k);
      }
      if(look === 'marina'){
        // three tall towers joined by a long roof deck, and a giant observation wheel
        const tx = x0 + span * 0.55;
        c.fillStyle = '#20264a'; for(let t = 0; t < 3; t++) c.fillRect(tx + t * 12 * k, hy - 5 * k - 58 * k, 8 * k, 58 * k);
        c.fillStyle = '#2b3360'; c.fillRect(tx - 6 * k, hy - 5 * k - 62 * k, 44 * k, 4 * k);
        c.strokeStyle = 'rgba(160,220,255,.8)'; c.lineWidth = 1; circ(c, x0 + span * 0.3, hy - 5 * k - 26 * k, 22 * k); c.stroke();
        for(let s2 = 0; s2 < 12; s2++){ const a = s2 / 12 * Math.PI * 2 + G.time * 0.1; c.fillStyle = 'hsl(' + (s2 * 30) + ',80%,70%)'; c.fillRect(x0 + span * 0.3 + Math.cos(a) * 22 * k - 1, hy - 5 * k - 26 * k + Math.sin(a) * 22 * k - 1, 2, 2); }
      } else {
        // a rocky island in the lake with a tall statue on it, and an old four-towered gateway on the far shore
        const ix = x0 + span * 0.35;
        c.fillStyle = '#2a2a3a'; c.beginPath(); c.ellipse(ix, hy - 4 * k, 16 * k, 4 * k, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#d8dce8'; c.fillRect(ix - 2.5 * k, hy - 22 * k, 5 * k, 16 * k); circ(c, ix, hy - 24 * k, 2.6 * k); c.fill();
        const gx = x0 + span * 0.72;
        c.fillStyle = '#3a2f4a'; c.fillRect(gx, hy - 5 * k - 22 * k, 26 * k, 22 * k);
        for(let t = 0; t < 4; t++){ c.fillRect(gx + (t % 2 ? 22 : 0) * k + (t > 1 ? 0 : 0), hy - 5 * k - 36 * k, 4 * k, 36 * k); }
        c.fillStyle = 'rgba(255,217,138,.9)'; c.beginPath(); c.arc(gx + 13 * k, hy - 5 * k - 8 * k, 5 * k, Math.PI, 0); c.fill();
      }
    });
  } else if(look === 'fields' || look === 'suzuka' || look === 'park' || look === 'plains'){
    const far = look === 'plains' ? '#c9a46a' : look === 'suzuka' ? '#6f9f7a' : '#7fae6a', near = look === 'plains' ? '#a8923f' : look === 'park' ? '#2f6e2f' : '#5f9e4a';
    layer(0.15, (x0, span) => { c.fillStyle = far; c.beginPath(); c.moveTo(x0, hy); for(let i = 0; i <= 20; i++) c.lineTo(x0 + i * span / 20, hy - (look === 'plains' ? 4 + 3 * Math.sin(i * 2.1) : 12 + 9 * Math.sin(i * 0.9) + 5 * Math.sin(i * 2.3)) * k); c.lineTo(x0 + span, hy); c.fill(); });
    if(look === 'suzuka') layer(0.22, (x0, span) => { const wx = x0 + span * 0.4, wy = hy - 30 * k; c.strokeStyle = '#e9ecf1'; c.lineWidth = 1; circ(c, wx, wy, 20 * k); c.stroke(); for(let s2 = 0; s2 < 10; s2++){ const a = s2 / 10 * Math.PI * 2 + G.time * 0.15; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * 20 * k, wy + Math.sin(a) * 20 * k); c.stroke(); c.fillStyle = ['#e2463c', '#f5c542', '#3f8fe0'][s2 % 3]; c.fillRect(wx + Math.cos(a) * 20 * k - 1.5, wy + Math.sin(a) * 20 * k - 1.5, 3, 3); } c.fillStyle = '#8d94a1'; c.fillRect(wx - 1, wy, 2, 30 * k); });
    if(look === 'plains') layer(0.25, (x0, span) => { for(let i = 0; i < 8; i++){ c.fillStyle = 'rgba(120,90,70,.55)'; c.fillRect(x0 + i * span / 8, hy - (6 + rng(i) * 10) * k, (6 + rng(i + 3) * 10) * k, (6 + rng(i) * 10) * k); } });
    layer(0.35, (x0, span) => { c.fillStyle = near; for(let i = 0; i < 30; i++){ const tx2 = x0 + i * span / 30, r = (3 + rng(i * 11) * 4) * k; circ(c, tx2, hy - r * 0.6, r); c.fill(); } });
  } else if(look === 'forest'){
    layer(0.12, (x0, span) => { c.fillStyle = '#5d7f86'; c.beginPath(); c.moveTo(x0, hy); for(let i = 0; i <= 12; i++) c.lineTo(x0 + i * span / 12, hy - (22 + 12 * Math.sin(i * 1.1)) * k); c.lineTo(x0 + span, hy); c.fill(); });
    layer(0.3, (x0, span) => { c.fillStyle = '#1f4a2e'; for(let i = 0; i < 40; i++){ const tx2 = x0 + i * span / 40, h2 = (10 + rng(i) * 10) * k; c.beginPath(); c.moveTo(tx2 - 4 * k, hy); c.lineTo(tx2, hy - h2); c.lineTo(tx2 + 4 * k, hy); c.fill(); } });
  }
  if(G.rain){ c.fillStyle = 'rgba(120,130,145,.25)'; c.fillRect(v.x, v.y, W, hy - v.y); }
}
function nightGlow(c, v, hy){
  const g = c.createLinearGradient(0, hy, 0, v.y + v.h);
  g.addColorStop(0, 'rgba(255,230,160,0)'); g.addColorStop(1, 'rgba(255,230,160,.08)');
  c.fillStyle = g; c.fillRect(v.x, hy, v.w, v.y + v.h - hy);
}
function drawRain(c, v, car){
  c.strokeStyle = 'rgba(200,215,235,.45)'; c.lineWidth = 0.7;
  const n = Math.floor(v.w * v.h / 900), sp = car.v / MAXV;
  c.beginPath();
  for(let i = 0; i < n; i++){
    const x = v.x + (rng(i) * v.w + G.time * (40 + i % 7 * 5)) % v.w, y = v.y + (rng(i + 99) * v.h + G.time * 260) % v.h;
    c.moveTo(x, y); c.lineTo(x - 1.5 - sp * 3, y + 5 + sp * 5);
  }
  c.stroke();
}

/* ---------- HUD ---------- */
function trackMap(){
  if(TK.map) return TK.map;
  let hx = 0, hy = 0, a = 0; const pts = [];
  for(const s of TK.segs){ a += s.curve * 0.0026; hx += Math.cos(a); hy += Math.sin(a); pts.push([hx, hy]); }
  // close the loop by spreading the gap along the lap
  const ex = pts[pts.length - 1][0], ey = pts[pts.length - 1][1];
  pts.forEach((p, i) => { p[0] -= ex * (i + 1) / pts.length; p[1] -= ey * (i + 1) / pts.length; });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for(const p of pts){ x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const sc = 1 / Math.max(x1 - x0, y1 - y0);
  TK.map = pts.map(p => [(p[0] - (x0 + x1) / 2) * sc, (p[1] - (y0 + y1) / 2) * sc]);
  return TK.map;
}
function chip(c, x, y, label, col, k, on){
  c.font = (5 * k) + 'px ' + FONT; const w = c.measureText(label).width + 5 * k;
  c.fillStyle = on === false ? 'rgba(10,10,14,.5)' : col; rr(c, x, y, w, 8 * k, 2 * k); c.fill();
  text(c, label, x + 2.5 * k, y + 1.6 * k, 5 * k, on === false ? col : '#101014');
  return w + 2 * k;
}
function drawViewHUD(c, v, car){
  if(G.demo) return;
  const k = Math.max(0.55, Math.min(1, v.h / 216)), pad = 4 * k + 1;
  const pl = place(car), total = G.cars.length;
  // position
  outlined(c, 'P' + pl, v.x + pad + 11 * k, v.y + pad + 8 * k, 14 * k, pl === 1 ? '#f5c542' : '#f4efe2', 'center');
  text(c, '/' + total, v.x + pad + 25 * k, v.y + pad + 6 * k, 6 * k, '#c9c6d6');
  { const nm = car.name.toUpperCase(); text(c, nm, v.x + pad, v.y + pad + 17 * k, fitText(c, nm, 60 * k, 5 * k), car.color); }
  // lap counter and lap time
  const lap = clamp(lapOf(car) + 1, 1, G.laps), finalLap = lap === G.laps && car.fin < 0;
  outlined(c, 'LAP ' + lap + '/' + G.laps, v.x + v.w / 2, v.y + pad + 4 * k, 7 * k, finalLap ? (Math.floor(G.time * 4) % 2 ? '#ff5a4e' : '#f5c542') : '#f4efe2');
  if(G.state === 'race' && car.fin < 0) text(c, fmtLap(Math.max(0, G.raceT - car.lapStart)), v.x + v.w / 2, v.y + pad + 9 * k, 5 * k, '#c9c6d6', 'center');
  // right side: best lap + minimap
  if(car.bestLap > 0){ const purple = G.fastest && G.fastest.id === car.id; text(c, 'BEST ' + fmtLap(car.bestLap), v.x + v.w - pad, v.y + pad, 5 * k, purple ? '#c77dff' : '#c9c6d6', 'right'); }
  if(v.h >= 100 && v.w >= 180){
    const m = trackMap(), mw = 44 * k, mx = v.x + v.w - pad - mw / 2, my = v.y + pad + 9 * k + mw / 2;
    c.fillStyle = 'rgba(10,10,14,.45)'; rr(c, mx - mw / 2 - 2, my - mw / 2 - 2, mw + 4, mw + 4, 3); c.fill();
    c.strokeStyle = 'rgba(244,239,226,.75)'; c.lineWidth = 1.2 * k; c.beginPath();
    for(let i = 0; i < m.length; i += 4){ const p = m[i]; if(i === 0) c.moveTo(mx + p[0] * mw, my + p[1] * mw); else c.lineTo(mx + p[0] * mw, my + p[1] * mw); }
    c.closePath(); c.stroke();
    const sm = m[0]; c.fillStyle = '#fff'; c.fillRect(mx + sm[0] * mw - 1.5, my + sm[1] * mw - 1.5, 3, 3);
    for(const q of G.cars.slice().sort((a, b) => (a === car) - (b === car))){
      const i = Math.floor(wrapZ(q.dist) / SEG) % m.length, p = m[i];
      c.fillStyle = q.color; circ(c, mx + p[0] * mw, my + p[1] * mw, (q === car ? 2.2 : 1.4) * k); c.fill();
      if(q === car){ c.strokeStyle = '#fff'; c.lineWidth = 0.8; c.stroke(); }
    }
  }
  // battery
  const bx = v.x + pad, by = v.y + v.h - pad - 20 * k, bw = 70 * k, bh = 6 * k, bat = car.bat;
  const bcol = bat > 50 ? '#3fd07a' : bat > 20 ? '#f5c542' : (Math.floor(G.time * 6) % 2 ? '#ff5a4e' : '#7a2020');
  c.fillStyle = 'rgba(10,10,14,.6)'; rr(c, bx - 1, by - 1, bw + 12 * k, bh + 2, 2); c.fill();
  bolt(c, bx + 3.5 * k, by + bh / 2, 3.2 * k, car.regen ? '#7dff8a' : car.boost ? '#7fe3ff' : '#f5c542');
  const sx = bx + 8 * k, sw = bw - 4 * k;
  for(let i = 0; i < 20; i++){ const on = bat >= (i + 0.5) * 5; c.fillStyle = on ? bcol : 'rgba(255,255,255,.12)'; c.fillRect(sx + i * sw / 20, by + 1, sw / 20 - 0.6, bh - 2); }
  c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(bx + bw + 8 * k, by + bh * 0.25, 1.5 * k, bh * 0.5);
  text(c, Math.round(bat) + '%', bx + bw + 12 * k, by - 0.2, 6 * k, bcol === '#7a2020' ? '#ff5a4e' : bcol);
  text(c, 'BATTERY', bx, by - 7 * k, 4.5 * k, '#c9c6d6');
  // status chips
  let cx2 = bx, cy2 = by + bh + 3 * k;
  if(car.regen && Math.floor(G.time * 8) % 3) cx2 += chip(c, cx2, cy2, '+ REGEN', '#7dff8a', k);
  if(car.boost) cx2 += chip(c, cx2, cy2, 'BOOST', '#7fe3ff', k);
  if(car.attackT > 0) cx2 += chip(c, cx2, cy2, 'ATTACK ' + Math.ceil(car.attackT), '#ff4fd8', k);
  if(car.drs) cx2 += chip(c, cx2, cy2, 'DRS', '#3fd07a', k);
  if(car.slip && !car.drs) cx2 += chip(c, cx2, cy2, 'TOW', '#e9ecf1', k);
  if(car.pitReq && Math.floor(G.time * 3) % 2) cx2 += chip(c, cx2, cy2, 'BOX', '#f5c542', k);
  if(car.bat <= 0.01 && car.fin < 0) cx2 += chip(c, cx2, cy2, 'LOW POWER', '#ff5a4e', k);
  // speed and tyres
  const kmh = Math.round(car.v * KMH);
  outlined(c, String(kmh), v.x + v.w - pad - 16 * k, v.y + v.h - pad - 14 * k, 12 * k, car.boost ? '#7fe3ff' : '#f4efe2');
  text(c, 'KM/H', v.x + v.w - pad, v.y + v.h - pad - 6 * k, 4.5 * k, '#c9c6d6', 'right');
  if(G.laps >= 5 || car.tyre < 0.9){ const tc = car.tyre > 0.6 ? '#3fd07a' : car.tyre > 0.4 ? '#f5c542' : '#ff5a4e'; text(c, 'TYRES ' + Math.round(car.tyre * 100) + '%', v.x + v.w - pad, v.y + v.h - pad - 27 * k, 4.5 * k, tc, 'right'); }
  // team radio
  if(car.msgT > 0 && car.msg){
    const a = Math.min(1, car.msgT * 3), sz = fitText(c, car.msg, v.w * 0.7, 6.5 * k), my = v.y + v.h * 0.27;
    c.globalAlpha = a; c.font = sz + 'px ' + FONT; const w = c.measureText(car.msg).width + 10 * k;
    c.fillStyle = 'rgba(10,10,14,.72)'; rr(c, v.x + v.w / 2 - w / 2, my - 6 * k, w, 12 * k, 3); c.fill();
    text(c, car.msg, v.x + v.w / 2, my, sz, car.msgKey && car.msgKey[0] === '!' ? '#ffd166' : '#f4efe2', 'center', 'middle'); c.globalAlpha = 1;
  }
  // safety car banner
  if(G.scT > 0){ const on = Math.floor(G.time * 3) % 2; c.fillStyle = on ? '#f5c542' : '#c99a1a'; rr(c, v.x + v.w / 2 - 36 * k, v.y + pad + 14 * k, 72 * k, 9 * k, 2); c.fill(); text(c, 'SAFETY CAR', v.x + v.w / 2, v.y + pad + 18.5 * k, 5.5 * k, '#17181d', 'center', 'middle'); }
  // start lights
  if(G.state === 'lights'){
    const lit = lightsLit(), cxl = v.x + v.w / 2, cyl = v.y + v.h * 0.38;
    c.fillStyle = 'rgba(10,10,14,.85)'; rr(c, cxl - 52 * k, cyl - 11 * k, 104 * k, 22 * k, 4); c.fill();
    for(let i = 0; i < 5; i++){ c.fillStyle = i < lit ? '#ff3b30' : '#3a1818'; circ(c, cxl - 40 * k + i * 20 * k, cyl, 7 * k); c.fill(); }
    if(lit === 5) text(c, 'GET READY…', cxl, cyl + 15 * k, 5 * k, '#f4efe2', 'center');
  } else if(G.state === 'race' && G.raceT < 1.2){ outlined(c, 'LIGHTS OUT!', v.x + v.w / 2, v.y + v.h * 0.38, 16 * k, '#3fd07a'); }
  // pit stop timing game
  if(car.pitSt === 2){
    const cxp = v.x + v.w / 2, cyp = v.y + v.h * 0.42, pw = 120 * k;
    c.fillStyle = 'rgba(10,10,14,.85)'; rr(c, cxp - pw / 2 - 6 * k, cyp - 18 * k, pw + 12 * k, 34 * k, 4); c.fill();
    text(c, 'PIT STOP · FRESH TYRES + PIT BOOST', cxp, cyp - 14 * k, 4.8 * k, '#f5c542', 'center');
    const gz = G.diff === 'kids' ? [0.2, 0.8] : [0.4, 0.6];
    c.fillStyle = '#3a1818'; c.fillRect(cxp - pw / 2, cyp - 3 * k, pw, 7 * k);
    c.fillStyle = '#3fd07a'; c.fillRect(cxp - pw / 2 + pw * gz[0], cyp - 3 * k, pw * (gz[1] - gz[0]), 7 * k);
    const nd = pitNeedle(car.pitT); c.fillStyle = '#fff'; c.fillRect(cxp - pw / 2 + pw * nd - 1, cyp - 5 * k, 2, 11 * k);
    text(c, car.pitT < 0.8 ? 'CREW AT WORK…' : (A.Input.isTouch ? 'TAP BOOST ON GREEN!' : 'PRESS FIRE ON GREEN!'), cxp, cyp + 7 * k, 5 * k, '#f4efe2', 'center');
  }
  // chequered flag
  if(car.fin >= 0 && G.state !== 'lights'){
    const cxf = v.x + v.w / 2, cyf = v.y + v.h * 0.4;
    for(let r = 0; r < 4; r++) for(let q2 = 0; q2 < 8; q2++){ c.fillStyle = (r + q2) % 2 ? '#111' : '#f4f1ea'; c.fillRect(cxf - 32 * k + q2 * 8 * k, cyf - 30 * k + r * 5 * k + Math.sin(G.time * 6 + q2 * 0.7) * 2 * k, 8 * k, 5 * k); }
    outlined(c, 'FINISHED ' + ordinal(pl), cxf, cyf + 4 * k, 11 * k, pl <= 3 ? '#f5c542' : '#f4efe2');
  }
  if(G.firstFinish >= 0 && car.fin < 0 && D().limit && G.state === 'race'){
    const left = Math.max(0, D().limit - (G.raceT - G.firstFinish));
    outlined(c, 'FINISH IN ' + Math.ceil(left), v.x + v.w / 2, v.y + pad + 30 * k, 6 * k, '#ff8a6a');
  }
}

/* ---------- Podium and champion scenes ---------- */
function drawPodium(c){
  const def = TK.def, v = { x: 0, y: 0, w: VW, h: VH }, hy = VH * 0.55;
  drawBackdrop(c, v, hy, 0, def);
  c.fillStyle = def.street ? '#80838c' : def.grass[0]; c.fillRect(0, hy, VW, VH - hy);
  const top = (G.results || []).slice(0, 3), cxp = VW * 0.66;
  const blocks = [[cxp, 58, 1], [cxp - 58, 40, 2], [cxp + 58, 30, 3]];
  for(const [bx, h, n] of blocks){
    c.fillStyle = '#e9ecf1'; c.fillRect(bx - 26, VH - 20 - h, 52, h);
    c.fillStyle = '#c9ced8'; c.fillRect(bx - 26, VH - 20 - h, 52, 4);
    text(c, String(n), bx, VH - 20 - h / 2, 14, n === 1 ? '#d4a017' : '#6a6f7a', 'center', 'middle');
    const r = top[n - 1]; if(!r) continue;
    const car = G.cars.find(q => q.id === r.id) || { color: r.color, name: r.name, human: !r.cpu };
    drawCar(c, Object.assign({}, car, { boost: false, brake: false, regen: false, spinT: 0, hitT: 0, drs: false, slip: false, attackT: 0, dist: 0, x: 0, v: 0 }), bx, VH - 20 - h, 0.034 * (n === 1 ? 1.1 : 1), true, v);
    const nm = r.name.toUpperCase(); outlined(c, nm, bx, VH - 20 - h - 26, fitText(c, nm, 60, 7), r.color);
    if(n === 1){ c.fillStyle = '#f5c542'; c.beginPath(); c.moveTo(bx - 6, VH - 20 - h - 50); c.lineTo(bx + 6, VH - 20 - h - 50); c.lineTo(bx + 3, VH - 20 - h - 40); c.lineTo(bx - 3, VH - 20 - h - 40); c.fill(); c.fillRect(bx - 1, VH - 20 - h - 40, 2, 4); c.fillRect(bx - 4, VH - 20 - h - 36, 8, 2); }
  }
  // confetti
  for(let i = 0; i < 70; i++){ const x = (rng(i) * VW + Math.sin(G.time + i) * 10) % VW, y = (rng(i + 7) * VH + G.time * (30 + rng(i + 3) * 40)) % VH; c.fillStyle = 'hsl(' + Math.floor(rng(i + 1) * 360) + ',85%,62%)'; c.fillRect(x, y, 2, 3); }
  if(G.state === 'results') return;
  outlined(c, G.state === 'champion' ? 'CHAMPION!' : 'CHEQUERED FLAG', VW * 0.66, 18, 12, '#f5c542');
  outlined(c, def.name.toUpperCase() + (G.fastest && G.fastest.name ? ' · FASTEST LAP ' + G.fastest.name.toUpperCase() + ' ' + fmtLap(G.fastest.t) : ''), VW * 0.66, 32, 5, '#f4efe2');
  if(G.state === 'podium' && G.stateT > 1.5 && G.net !== 'guest') text(c, A.Input.isTouch ? 'TAP BOOST FOR RESULTS' : 'PRESS FIRE FOR RESULTS', VW * 0.66, VH - 10, 5, 'rgba(244,239,226,.7)', 'center');
}
function drawChampion(c){
  drawPodium(c);
  if(G.champWinner){ c.fillStyle = 'rgba(10,10,14,.45)'; c.fillRect(VW * 0.4, 50, VW * 0.55, 26); outlined(c, G.champWinner.name.toUpperCase() + ' WINS THE TITLE!', VW * 0.66, 63, 8, G.champWinner.color); }
}

function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  if(!TK || !G.cars.length) return;
  c.setTransform(s, 0, 0, s, 0, 0);
  if(!G.demo && (G.state === 'podium' || G.state === 'results')){ drawPodium(c); engine(null); return; }
  if(!G.demo && G.state === 'champion'){ drawChampion(c); engine(null); return; }
  const follow = G.demo ? [G.order ? G.order[Math.min(2, G.order.length - 1)] : G.cars[0]] : myCars();
  if(!follow.length || !follow[0]) return;
  const n = follow.length;
  const views = n <= 1 ? [{ x: 0, y: 0, w: VW, h: VH }]
    : n === 2 ? [{ x: 0, y: 0, w: VW, h: VH / 2 - 1 }, { x: 0, y: VH / 2 + 1, w: VW, h: VH / 2 - 1 }]
    : [{ x: 0, y: 0, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: VW / 2 + 1, y: 0, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: 0, y: VH / 2 + 1, w: VW / 2 - 1, h: VH / 2 - 1 }, { x: VW / 2 + 1, y: VH / 2 + 1, w: VW / 2 - 1, h: VH / 2 - 1 }];
  follow.forEach((car, i) => drawView(c, views[i], car));
  if(n === 3){ const v = views[3]; c.fillStyle = '#14161d'; c.fillRect(v.x, v.y, v.w, v.h); drawStandings(c, v); }
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.3)'; c.fillRect(0, 0, VW, VH); }
  if(!G.demo && (G.state === 'lights' || (G.state === 'race' && G.raceT < 5))){
    const tip = A.Input.isTouch ? '◀ ▶ LANE   ▼ BRAKE = RECHARGE   BOOST: SPEED   ▲ PIT' : '◀ ▶ LANE   ▼ BRAKE = RECHARGE   HOLD FIRE: BOOST   ▲ PIT';
    c.fillStyle = 'rgba(10,10,14,.7)'; c.fillRect(VW / 2 - 124, VH - 13, 248, 11);
    text(c, tip, VW / 2, VH - 11, 5, '#f4efe2', 'center');
  }
  engine(follow[0]);
}
function drawStandings(c, v){
  text(c, TK.def.name.toUpperCase(), v.x + v.w / 2, v.y + 6, 7, '#f5c542', 'center');
  text(c, 'LAP ' + clamp(leaderLap() + 1, 1, G.laps) + '/' + G.laps, v.x + v.w / 2, v.y + 15, 5, '#c9c6d6', 'center');
  (G.order || []).forEach((q, i) => {
    const y = v.y + 24 + i * 10, nm = (i + 1) + '. ' + q.name.toUpperCase();
    text(c, nm, v.x + 10, y, fitText(c, nm, v.w - 50, 5.5), q.color);
    const bw = 22; c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(v.x + v.w - 10 - bw, y + 1.5, bw, 3);
    c.fillStyle = q.bat > 20 ? '#3fd07a' : '#ff5a4e'; c.fillRect(v.x + v.w - 10 - bw, y + 1.5, bw * q.bat / 100, 3);
  });
}

/* Electric motor whine for the car this screen follows (no engine noise: it's electric!) */
const Motor = { a: null, b: null, gain: null, filt: null };
function engine(car){
  const S0 = A.Sound;
  if(!S0.ctx || S0.ctx.state !== 'running') return;
  if(!Motor.a){
    const c = S0.ctx;
    Motor.a = c.createOscillator(); Motor.a.type = 'sine';
    Motor.b = c.createOscillator(); Motor.b.type = 'triangle';
    Motor.filt = c.createBiquadFilter(); Motor.filt.type = 'bandpass'; Motor.filt.frequency.value = 900; Motor.filt.Q.value = 0.8;
    Motor.gain = c.createGain(); Motor.gain.gain.value = 0;
    const bg = c.createGain(); bg.gain.value = 0.35;
    Motor.a.connect(Motor.filt); Motor.b.connect(bg); bg.connect(Motor.filt); Motor.filt.connect(Motor.gain); Motor.gain.connect(S0.bus);
    Motor.a.start(); Motor.b.start();
  }
  const live = car && !G.demo && (G.state === 'race' || G.state === 'finishing') && car.pitSt !== 2;
  const t = S0.ctx.currentTime, sp = car ? car.v / MAXV : 0;
  const f = 140 + sp * 820 + (car && car.boost ? 180 : 0);
  Motor.a.frequency.setTargetAtTime(f, t, 0.06); Motor.b.frequency.setTargetAtTime(f * 1.5, t, 0.06);
  Motor.filt.frequency.setTargetAtTime(car && car.regen ? 600 : 700 + sp * 1400, t, 0.08);
  Motor.gain.gain.setTargetAtTime(live ? 0.035 + (car.boost ? 0.02 : 0) : 0, t, 0.1);
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('BOOST');
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
window.__volt = G;
window.__voltDebug = { Net, TK: () => TK, TRACKS, buildTrack, newRace, startChampionship, finishRace, resultsMenu, sim, place, safetyCar, spin, makeCar, stepCar, cpuControls, orderCars, lapOf };
})();
