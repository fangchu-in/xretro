/* FULL TANK RALLY — a top-down, vertically scrolling road race for 1–4 drivers, split into lanes on one
   screen, or online. Inspired by the 1984 arcade classic Road Fighter: a long road, busy traffic, a fuel
   gauge that only refills when you catch the fuel truck, and a finish line before the clock runs out.
   LEFT/RIGHT steer, UP = high gear (boost), DOWN = brake. The throttle is automatic: tap FIRE = horn
   (swervers and lane-changers move over), hold FIRE = boost, so FIRE + steering can finish every stage.
   The course, traffic, hazards, weather and pickups are built from the stage + seed + difficulty, and the
   traffic is simulated once for the whole race and looked up from the race clock, so online guests
   rebuild the whole world themselves; snapshots carry only the racers and a few small events.
   All art, sound and music are original and drawn in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;
const GAME = 'fulltank';

/* ---------- Screen, road and cars (logical pixels = world units at scale 1) ---------- */
const VW = 384, VH = 216;
const FONT = '"Silkscreen","Courier New",monospace';
const SANS = '"Chakra Petch","Trebuchet MS",sans-serif';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const hyp = Math.hypot;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
function mulberry(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const LANE = 25, LANES = [-37.5, -12.5, 12.5, 37.5];
const HW = 50;                     // normal road half width (4 lanes)
const SEG = 10;                    // road table resolution (units)
const CAR_W = 10, CAR_L = 17;
const VLO = 200, VHI = 322;        // top speed in low gear (cruise) and high gear (boost)
const EXP = 236;                   // average speed a decent driver makes (units/s): used to place the traffic
const CLOCK_V = 205;               // the speed the checkpoint clock allows for
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
function codeToSeed(code){ let n = 0; for(const ch of code) n = n * 20 + Math.max(0, CODE_LETTERS.indexOf(ch)); return n; }
function seedToCode(n){ n = ((n % 160000) + 160000) % 160000; let s = ''; for(let i = 0; i < 4; i++){ s = CODE_LETTERS[n % 20] + s; n = Math.floor(n / 20); } return s; }
function randomCode(){ return seedToCode(Math.floor(Math.random() * 160000)); }

/* ---------- Difficulty ---------- */
const DIFF = {
  kids:   { label: 'Kids',   traffic: 0.5,  tspd: 0.82, haz: 0.55, clock: 0,   crashFuel: 0, spin: false, aggro: 0,   drain: 0,    rival: 0.9,  par: 1.3 },
  normal: { label: 'Normal', traffic: 1,    tspd: 1,    haz: 1,    clock: 1,   crashFuel: 4, spin: true,  aggro: 1,   drain: 1,    rival: 1,    par: 1 },
  pro:    { label: 'Pro',    traffic: 1.25, tspd: 1.1,  haz: 1.25, clock: 0.94, crashFuel: 7, spin: true,  aggro: 1.4, drain: 1.14, rival: 1.04, par: 0.95 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];
const MODES = [{ id: 'quick', label: 'Quick race' }, { id: 'champ', label: 'Championship' }, { id: 'tt', label: 'Time trial' }, { id: 'relay', label: 'Team relay' }, { id: 'daily', label: 'Daily challenge' }];
const LEVELS = [{ id: 'std', label: 'Standard' }, { id: 'assist', label: 'Assist' }, { id: 'junior', label: 'Junior' }];
const RIVAL_OPTS = [{ id: 'full', label: 'Full grid + boss' }, { id: 'boss', label: 'Boss only' }, { id: 'off', label: 'No rivals' }];

/* ---------- Garage: original cars (stats are multipliers) ---------- */
const CARS = [
  { id: 'buzzy',  name: 'Buzzy',  shape: 'hatch',  top: 1,    grip: 1,    tank: 1,    boost: 1,    eco: 1,    need: null,          desc: 'Friendly hatchback. Good at everything.' },
  { id: 'rover',  name: 'Rover',  shape: 'van',    top: 0.96, grip: 0.9,  tank: 1.45, boost: 0.9,  eco: 0.96, need: { medals: 1 }, desc: 'Boxy camper van: a huge tank, a bit lazy in the bends.' },
  { id: 'gecko',  name: 'Gecko',  shape: 'buggy',  top: 0.97, grip: 1.28, tank: 0.92, boost: 1,    eco: 1,    need: { medals: 3 }, desc: 'Beach buggy that sticks to the road like a gecko.' },
  { id: 'arrow',  name: 'Arrow',  shape: 'sports', top: 1.07, grip: 0.86, tank: 0.95, boost: 1.05, eco: 1.08, need: { medals: 5 }, desc: 'Low sports car: fastest top speed, slippery when wet.' },
  { id: 'sipper', name: 'Sipper', shape: 'bubble', top: 0.95, grip: 1.05, tank: 0.9,  boost: 0.85, eco: 0.66, need: { medals: 8 }, desc: 'Tiny bubble car that barely sips fuel.' },
  { id: 'blazer', name: 'Blazer', shape: 'muscle', top: 1.02, grip: 0.95, tank: 1.05, boost: 1.32, eco: 1.28, need: { golds: 4 },  desc: 'Muscle car: monster boost, very thirsty.' },
  { id: 'nimbus', name: 'Nimbus', shape: 'ev',     top: 1.05, grip: 1.12, tank: 1.1,  boost: 1.1,  eco: 0.9,  need: { golds: 7 },  desc: 'Sleek electric racer: the best all-rounder.' }
];
const BALANCED = { top: 1, grip: 1.04, tank: 1.05, boost: 1.02, eco: 0.95 };
const LIVERIES = [
  { id: 'plain', name: 'Plain', cost: 0 }, { id: 'stripes', name: 'Racing stripes', cost: 120 }, { id: 'flames', name: 'Flames', cost: 250 },
  { id: 'stars', name: 'Stars', cost: 250 }, { id: 'checker', name: 'Checker', cost: 350 }, { id: 'bolt', name: 'Lightning', cost: 450 },
  { id: 'polka', name: 'Polka dots', cost: 500 }, { id: 'chrome', name: 'Gold chrome', cost: 900 }
];

/* ---------- Rival racers (named, with personalities) and one boss per stage ---------- */
const RIVALS = [
  { name: 'Prudence',    pers: 'cautious', color: '#8fd6c6', car: 1, spd: 0.96, aggro: 0.05, caution: 1.6, boost: 0.25, line: 'Slow and steady, dearie!' },
  { name: 'Hotrod Hank', pers: 'hothead',  color: '#ff6b3d', car: 5, spd: 1.0,  aggro: 1,    caution: 0.55, boost: 0.95, line: 'Outta my way!' },
  { name: 'Penny Pinch', pers: 'saver',    color: '#c9e265', car: 4, spd: 0.99, aggro: 0.15, caution: 1,   boost: 0.12, line: 'Every drop counts.' },
  { name: 'Zara Zoom',   pers: 'racer',    color: '#b48cff', car: 3, spd: 1.01, aggro: 0.35, caution: 0.85, boost: 0.7, line: 'Catch me if you can!' }
];
/* tricks: cones (drops cones behind), oil (drops oil slicks), tow (a wide tow truck that weaves to block) */
const BOSSES = [
  { name: 'Coney Joe',    trick: 'cones', color: '#ff9f1c', line: 'Mind my cones!' },
  { name: 'Dusty Dune',   trick: 'oil',   color: '#d9a066', line: 'Slippery sands ahead!' },
  { name: 'Timber Tess',  trick: 'tow',   color: '#6fbf73', line: 'Nobody passes my tow truck!' },
  { name: 'Frosty Flo',   trick: 'oil',   color: '#a8d8ff', line: 'Watch the ice slick!' },
  { name: 'Neon Nico',    trick: 'cones', color: '#ff4fd8', line: 'Cones! Cones everywhere!' },
  { name: 'Big Bridget',  trick: 'tow',   color: '#f2c14e', line: 'This bridge is MINE!' },
  { name: 'Thunder Rex',  trick: 'all',   color: '#ffe066', line: 'Storm’s coming for you!' }
];

/* ---------- Stages ----------
   len: course length, curve: how far the road wanders, traffic kinds, hazard counts, weather, music */
const STAGES = [
  { name: 'Sunny Coast Highway', short: 'Coast', len: 15800, curve: 44, wx: 'day', music: 'cruise', ground: '#8fcf6a', ground2: '#7cbe58', shoulder: '#d9c48c', asphalt: '#50545c', line: '#f7f3e3',
    sea: 1, props: ['palm', 'hut', 'palm', 'bush'], kinds: { sedan: 5, van: 2, camper: 2, truck: 1.4, bike: 0 },
    haz: { puddle: 3, oil: 3, works: 2, bridge: 1, ramp: 2, side: 1, can: 3 }, tip: 'The fuel truck has rainbow stripes: drive into it to fill up!' },
  { name: 'Cactus Canyon', short: 'Canyon', len: 16200, curve: 58, wx: 'hot', music: 'cruise', ground: '#e3b577', ground2: '#d6a263', shoulder: '#c98f52', asphalt: '#5b5550', line: '#fff1cf',
    props: ['cactus', 'rock', 'mesa', 'cactus', 'skull'], kinds: { sedan: 4, jeep: 3, truck: 2, van: 1 },
    haz: { sand: 6, oil: 2, cross: 2, ramp: 3, side: 1, can: 3 }, tip: 'Sand drifts slow you down. Trains don’t wait: stop at red lights!' },
  { name: 'Whispering Woods', short: 'Woods', len: 16600, curve: 54, wx: 'day', music: 'woods', ground: '#5f9e4a', ground2: '#548f40', shoulder: '#8b7a55', asphalt: '#4b4f55', line: '#f2eedc',
    river: 1, props: ['tree', 'tree', 'pine', 'log', 'mushroom'], kinds: { sedan: 4, tractor: 2, van: 2, truck: 1.5 },
    haz: { puddle: 5, tunnel: 2, bridge: 1, cross: 1, works: 1, ramp: 1, side: 1, can: 3 }, tip: 'Puddles make you skid a little. Leafy tunnels are dark: follow your headlights.' },
  { name: 'Snowcap Pass', short: 'Snow', len: 16600, curve: 62, wx: 'snow', music: 'woods', ground: '#eef3f8', ground2: '#dfe8f2', shoulder: '#c9d6e4', asphalt: '#5d6570', line: '#ffffff',
    props: ['pinesnow', 'pinesnow', 'snowman', 'rocksnow'], kinds: { sedan: 4, plow: 1.5, truck: 2, jeep: 2 },
    haz: { ice: 7, tunnel: 2, bridge: 2, works: 1, side: 1, ramp: 1, can: 4 }, tip: 'Ice patches have almost no grip: steer early and gently.' },
  { name: 'Neon City Nights', short: 'City', len: 17100, curve: 38, wx: 'night', music: 'night', ground: '#3a3f55', ground2: '#34384c', shoulder: '#6b6f80', asphalt: '#2d3038', line: '#ffe9a8',
    props: ['building', 'lamp', 'building', 'neon', 'lamp'], kinds: { sedan: 4, taxi: 3, bus: 2, van: 2 },
    haz: { works: 5, cross: 2, puddle: 3, tunnel: 1, oil: 2, ramp: 1, can: 4 }, tip: 'Night drive: only your headlights light the way. Road works close lanes.' },
  { name: 'Sky Bridge Peaks', short: 'Peaks', len: 17500, curve: 66, wx: 'wind', music: 'night', ground: '#8a8f7a', ground2: '#7d826e', shoulder: '#a39a86', asphalt: '#4a4d52', line: '#f5f0dc',
    chasm: 1, props: ['rockbig', 'pine', 'rockbig', 'flag'], kinds: { sedan: 4, truck: 2.5, van: 2, jeep: 1 },
    haz: { bridge: 3, gust: 3, tunnel: 2, rock: 5, ramp: 2, can: 4 }, tip: 'Wind blows you sideways on the bridges: watch the wind socks.' },
  { name: 'Thunder Storm Finale', short: 'Storm', len: 18900, curve: 56, wx: 'storm', music: 'storm', ground: '#35414a', ground2: '#2f3a42', shoulder: '#5b646b', asphalt: '#2a2d33', line: '#b8f7ff',
    props: ['neon', 'tree', 'building', 'lamp', 'neon'], kinds: { sedan: 4, truck: 2, bus: 1.5, taxi: 2, van: 1 },
    haz: { puddle: 5, oil: 3, cross: 1, works: 2, bridge: 2, tunnel: 1, gust: 1, ramp: 2, side: 1, can: 4 }, tip: 'Rain means long skids. Everything you have learned, all at once!' }
];
STAGES.forEach((s, i) => { s.si = i; });

/* ---------- Sounds ---------- */
let netSfx = [];
const SX = {
  horn:    s => { s.tone({ wave: 'square', f: 392, t: 0.22, v: 0.06, lp: 1800 }); s.tone({ wave: 'square', f: 494, t: 0.22, v: 0.05, lp: 1800 }); },
  boost:   s => { s.noise({ t: 0.5, v: 0.08, f: 600, f2: 3200, type: 'bandpass', q: 1.5 }); s.tone({ wave: 'sawtooth', f: 180, f2: 420, t: 0.4, v: 0.04, lp: 1600 }); },
  shift:   s => s.tone({ wave: 'square', f: 300, f2: 200, t: 0.05, v: 0.04, lp: 1200 }),
  whoosh:  s => { s.noise({ t: 0.28, v: 0.1, f: 2400, f2: 500, type: 'bandpass', q: 1.2 }); s.tone({ wave: 'triangle', f: 1400, f2: 700, t: 0.16, v: 0.04 }); },
  skid:    s => s.noise({ t: 0.45, v: 0.09, f: 3000, f2: 1800, type: 'bandpass', q: 6 }),
  crash:   s => { s.noise({ t: 0.5, v: 0.26, f: 1800, f2: 120 }); s.tone({ wave: 'sawtooth', f: 160, f2: 50, t: 0.3, v: 0.1 }); s.tone({ wave: 'triangle', f: 900, f2: 1500, t: 0.12, v: 0.05, at: 0.08 }); },
  boing:   s => { s.tone({ wave: 'triangle', f: 220, f2: 660, t: 0.22, v: 0.12, vib: true, vibRate: 14, vibDepth: 0.05 }); },
  bump:    s => { s.noise({ t: 0.12, v: 0.12, f: 900, f2: 300 }); s.tone({ wave: 'square', f: 150, f2: 90, t: 0.08, v: 0.06 }); },
  scrape:  s => { s.noise({ t: 0.22, v: 0.08, f: 5000, f2: 2500, type: 'bandpass', q: 3 }); },
  fuel:    s => { s.melody([[523, .06], [659, .06], [784, .06], [1047, .06], [1319, .14]], { wave: 'triangle', v: 0.11 }); s.noise({ t: 0.3, v: 0.05, f: 800, f2: 400, type: 'bandpass', at: 0.05 }); },
  coin:    s => { s.tone({ wave: 'square', f: 1568, t: 0.04, v: 0.05 }); s.tone({ wave: 'square', f: 2093, t: 0.08, v: 0.05, at: 0.04 }); },
  power:   s => s.melody([[784, .05], [988, .05], [1175, .05], [1568, .12]], { wave: 'triangle', v: 0.1 }),
  shield:  s => { s.tone({ wave: 'sine', f: 400, f2: 1200, t: 0.3, v: 0.08, vib: true }); },
  pop:     s => { s.noise({ t: 0.1, v: 0.12, f: 3000, f2: 800 }); s.tone({ wave: 'triangle', f: 900, f2: 300, t: 0.15, v: 0.06 }); },
  ghost:   s => { s.tone({ wave: 'sine', f: 660, f2: 330, t: 0.5, v: 0.06, vib: true, vibRate: 9, vibDepth: 0.04 }); },
  checkpoint: s => { s.melody([[784, .08], [1047, .08], [1319, .08], [1568, .2]], { wave: 'pulse25', v: 0.09 }); },
  lowfuel: s => { s.tone({ wave: 'square', f: 880, t: 0.07, v: 0.05 }); s.tone({ wave: 'square', f: 660, t: 0.09, v: 0.05, at: 0.1 }); },
  cone:    s => { s.tone({ wave: 'triangle', f: 700, f2: 300, t: 0.1, v: 0.07 }); s.noise({ t: 0.06, v: 0.06, f: 2000, f2: 800 }); },
  splash:  s => s.noise({ t: 0.3, v: 0.09, f: 3200, f2: 700, type: 'bandpass', q: 1 }),
  sand:    s => s.noise({ t: 0.25, v: 0.07, f: 900, f2: 400 }),
  ice:     s => { s.tone({ wave: 'sine', f: 2200, f2: 1800, t: 0.18, v: 0.03 }); s.noise({ t: 0.2, v: 0.04, f: 6000, type: 'highpass' }); },
  jump:    s => s.tone({ wave: 'triangle', f: 260, f2: 780, t: 0.3, v: 0.08 }),
  land:    s => { s.noise({ t: 0.14, v: 0.12, f: 700, f2: 200 }); s.tone({ wave: 'sine', f: 120, f2: 60, t: 0.12, v: 0.12 }); },
  trick:   s => s.melody([[1047, .04], [1319, .04], [1568, .04], [2093, .1]], { wave: 'triangle', v: 0.08 }),
  bell:    s => { for(let i = 0; i < 4; i++) s.tone({ wave: 'sine', f: 1760, t: 0.08, v: 0.05, at: i * 0.18 }); },
  train:   s => { s.tone({ wave: 'sawtooth', f: 330, t: 0.8, v: 0.04, lp: 1200 }); s.tone({ wave: 'sawtooth', f: 415, t: 0.8, v: 0.035, lp: 1200 }); },
  gust:    s => { s.noise({ t: 1.2, v: 0.08, f: 500, f2: 1500, type: 'bandpass', q: 2 }); },
  warn:    s => { s.tone({ wave: 'sine', f: 1250, t: 0.06, v: 0.04 }); s.tone({ wave: 'sine', f: 1250, t: 0.06, v: 0.04, at: 0.1 }); },
  oilDrop: s => { s.tone({ wave: 'sine', f: 300, f2: 120, t: 0.2, v: 0.08 }); s.noise({ t: 0.15, v: 0.05, f: 600, f2: 200 }); },
  cheer:   s => { for(let i = 0; i < 5; i++) s.noise({ t: 0.2, v: 0.05, f: 1600 + i * 300, type: 'bandpass', q: 3, at: i * 0.05 }); s.melody([[784, .08], [988, .08], [1175, .14]], { wave: 'square', v: 0.05, at: 0.1 }); },
  photo:   s => { s.noise({ t: 0.05, v: 0.15, f: 6000, type: 'highpass' }); s.tone({ wave: 'square', f: 1800, t: 0.03, v: 0.05, at: 0.06 }); },
  near:    s => { s.noise({ t: 0.2, v: 0.08, f: 3500, f2: 1200, type: 'bandpass', q: 2 }); s.tone({ wave: 'triangle', f: 1175, t: 0.06, v: 0.05, at: 0.05 }); },
  chain:   s => s.melody([[1319, .05], [1568, .05], [2093, .05], [2637, .12]], { wave: 'pulse25', v: 0.07 }),
  slip:    s => s.tone({ wave: 'sine', f: 500, f2: 900, t: 0.35, v: 0.05, vib: true }),
  join:    s => s.melody([[659, .06], [880, .06], [1319, .1]], { v: 0.1 }),
  unlock:  s => s.melody([[523, .08], [659, .08], [784, .08], [1047, .08], [1319, .08], [1568, .24]], { wave: 'triangle', v: 0.11 }),
  outFuel: s => s.melody([[784, .12], [659, .12], [523, .12], [392, .12], [262, .4]], { wave: 'triangle', v: 0.1 }),
  startJingle: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .2], [0, .05], [988, .1], [1047, .3]], { wave: 'pulse25', v: 0.1 }); s.melody([[131, .3], [196, .3], [262, .4]], { wave: 'triangle', v: 0.12 }); },
  finish:  s => { s.melody([[784, .09], [784, .09], [784, .09], [1047, .3], [0, .06], [988, .09], [1047, .09], [1319, .45]], { wave: 'pulse25', v: 0.11 }); s.melody([[262, .27], [330, .27], [392, .3], [523, .6]], { wave: 'triangle', v: 0.12 }); for(let i = 0; i < 6; i++) s.tone({ wave: 'sine', f: 2400 + i * 260, t: 0.07, v: 0.03, at: 0.9 + i * 0.05 }); },
  results: s => s.melody([[784, .1], [988, .1], [1175, .1], [1568, .16], [0, .05], [1319, .1], [1568, .36]], { wave: 'triangle', v: 0.12 }),
  widget:  s => { s.tone({ wave: 'sine', f: 1200, f2: 1600, t: 0.08, v: 0.05 }); s.tone({ wave: 'sine', f: 1600, f2: 1300, t: 0.08, v: 0.05, at: 0.09 }); }
};
function playSx(name){ const f = SX[name]; if(f) try{ f(A.Sound); }catch(e){} }
/* sounds for everyone (sent to guests too) */
function sfx(name){ if(G.demo || G.replay) return; playSx(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('~' + name); }
function S(name){ if(G.demo) return; A.Sound.play(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name); }
/* sounds only for the device that drives this car (low fuel, pickups, horn…) */
function sfxFor(r, name){
  if(G.demo || G.replay || !r || !r.human) return;
  const src = String(driverOf(r).source || '');
  if(!src.includes('/')) playSx(name);
  else if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('@' + src.slice(0, src.indexOf('/')) + '~' + name);
}
function playNetSfx(n){
  if(n[0] === '@'){ const i = n.indexOf('~'); if(n.slice(1, i) === Net.peer) playSx(n.slice(i + 1)); return; }
  if(n[0] === '~') playSx(n.slice(1)); else A.Sound.play(n);
}

/* ---------- Engine: one purring oscillator per screen, following this device's first driver ---------- */
const Engine = {
  on: false, osc: null, osc2: null, g: null, f: null,
  ensure(){
    const S0 = A.Sound, c = S0.ctx;
    if(this.osc || !c || c.state !== 'running') return !!this.osc;
    try{
      this.osc = c.createOscillator(); this.osc.type = 'sawtooth';
      this.osc2 = c.createOscillator(); this.osc2.type = 'square';
      this.f = c.createBiquadFilter(); this.f.type = 'lowpass'; this.f.frequency.value = 600; this.f.Q.value = 2;
      this.g = c.createGain(); this.g.gain.value = 0;
      this.osc.connect(this.f); this.osc2.connect(this.f); this.f.connect(this.g); this.g.connect(S0.bus);
      this.osc.start(); this.osc2.start();
    }catch(e){ this.osc = null; }
    return !!this.osc;
  },
  set(v, boost, on){
    if(!this.ensure()) return;
    const c = A.Sound.ctx, t = c.currentTime;
    const vol = on && A.Settings.volume > 0 ? 0.05 : 0;
    const rev = 38 + v * 0.34 + (boost ? 26 : 0), wob = Math.sin(t * 31) * 1.5;
    this.osc.frequency.setTargetAtTime(rev + wob, t, 0.05);
    this.osc2.frequency.setTargetAtTime(rev * 0.502, t, 0.05);
    this.f.frequency.setTargetAtTime(420 + v * 3.2 + (boost ? 600 : 0), t, 0.08);
    this.g.gain.setTargetAtTime(vol, t, 0.08);
  }
};

/* ---------- Music (all original) ---------- */
const MUSIC = {
  cruise: {        // sunny highway: bright, bouncy, windows down
    bpm: 150, chords: ['E', 'C#m', 'A', 'B', 'E', 'G#m', 'A', 'B'], bass: 'drive', arp: 'fast', leadVol: 0.07,
    lead: [
      'B4 - E5 - G#5 - B5 - - - G#5 - B5 C#6', 'C#6 - - - B5 - G#5 - E5 - - - G#5 - - -',
      'A5 - - - C#6 - E6 - C#6 - A5 - E5 - F#5 G#5', 'F#5 - - - D#5 - F#5 - B5 - - - A5 - G#5 F#5',
      'G#5 - B5 - E6 - - - D#6 - B5 - G#5 - B5 -', 'B5 - - - G#5 - D#5 - G#5 - B5 - D#6 - - -',
      'C#6 - B5 - A5 - C#6 - E6 - - - C#6 - A5 -', 'B5 - - - D#6 - F#6 - E6 - - - . . . .'],
    drums: ['k.h.s.h.k.k.s.h.', 'k.h.s.h.k.h.s.hs', 'k.h.s.h.k.k.s.h.', 'k.h.s.hkk.hks.ss']
  },
  woods: {         // forest and snow: a breathy whistle over a rolling walking bass
    bpm: 128, chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'], bass: 'walk', arp: 'slow', flute: true, leadVol: 0.085,
    lead: [
      'D5 - - - G5 - - - B5 - A5 - G5 - - -', 'F#5 - - - A5 - - - D6 - - - C6 - B5 -',
      'B5 - - - G5 - E5 - G5 - B5 - E6 - - -', 'C6 - - - - - E5 - G5 - C6 - B5 - A5 -',
      'B5 - - - D6 - - - G6 - - - F#6 - E6 -', 'D6 - - - A5 - - - F#5 - A5 - D6 - - -',
      'E6 - - - C6 - - - G5 - A5 - B5 - C6 -', 'D6 - - - - - - - A5 - - - F#5 - - -'],
    drums: ['k...h.k.s...h...', 'k...h.k.s...h.h.', 'k...h.k.s...h...', 'k.k.h.k.s...hhs.']
  },
  night: {         // neon city: a moody minor groove with a sliding synth lead
    bpm: 108, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E'], bass: 'pulse', arp: 'fast', leadWave: 'sawtooth', leadVol: 0.05,
    lead: [
      'E5 - - - A5 - - - C6 - B5 - A5 - - -', 'A5 - - - - - F5 - A5 - C6 - - - . .',
      'G5 - - - E5 - G5 - C6 - - - B5 - G5 -', 'D5 - - - G5 - - - B5 - - - . . . .',
      'A5 - C6 - E6 - - - D6 - C6 - B5 - A5 -', 'F5 - - - A5 - C6 - F6 - - - E6 - - -',
      'D6 - - - C6 - A5 - F5 - A5 - D6 - - -', 'E6 - - - - - - - G#5 - B5 - E6 - - -'],
    drums: ['k.......s.......', 'k.....k.s.......', 'k.......s.....h.', 'k.....k.s...s.ss']
  },
  storm: {         // the finale: tense, fast, thunder on the drums
    bpm: 168, chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'], bass: 'drive', arp: 'fast', leadVol: 0.068,
    lead: [
      'E5 - G5 - B5 - E6 - - - D6 - B5 - G5 -', 'E5 - - - G5 - C6 - - - B5 - G5 - E5 -',
      'F#5 - A5 - D6 - - - C6 - A5 - F#5 - A5 -', 'B5 - - - D#6 - - - F#6 - - - D#6 - B5 -',
      'G5 - B5 - E6 - G6 - - - F#6 - E6 - D6 -', 'C6 - - - E6 - G6 - E6 - C6 - G5 - C6 -',
      'A5 - C6 - E6 - - - D6 - C6 - B5 - A5 -', 'B5 - - - D#6 - F#6 - B6 - - - . . . .'],
    drums: ['k.h.s.hkk.h.s.h.', 'k.h.s.hkk.h.s.hs', 'k.h.s.hkk.h.s.h.', 'z.h.s.hkk.hss.rs']
  },
  podium: {        // results: a brass victory lap
    bpm: 124, chords: ['F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'F'], bass: 'tuba', arp: 'slow', brass: true, leadVol: 0.07,
    lead: [
      'C5 - F5 - A5 - C6 - - - A5 - C6 - - -', 'D6 - - - Bb5 - D6 - F6 - - - D6 - - -',
      'E6 - - - C6 - G5 - C6 - E6 - G6 - - -', 'F6 - - - C6 - A5 - F5 - - - . . . .',
      'A5 - - - D6 - F6 - A6 - - - F6 - D6 -', 'Bb5 - D6 - F6 - Bb6 - A6 - - - F6 - - -',
      'G6 - - - E6 - C6 - G6 - A6 - Bb6 - G6 -', 'F6 - - - - - - - . . . . . . . .'],
    drums: ['k...s...k.k.s...', 'k...s...k.k.s...', 'k...s...k.k.s...', 'k...s...z...r.r.']
  }
};

/* ================= The course: built from stage + seed + difficulty (identical on every screen) ================= */
const VK = {
  sedan:   { w: 10, l: 17, v: [96, 136],  cols: ['#e04f4f', '#4f8fe0', '#f2f2f2', '#3a3a44', '#e0c24f', '#5fbf6f', '#b06fd0', '#f08a3c'] },
  van:     { w: 11, l: 21, v: [86, 116],  cols: ['#f2f2f2', '#d9d2c0', '#6aa6d8', '#8fd18a'] },
  camper:  { w: 12, l: 26, v: [74, 100],  cols: ['#f4efe2', '#ffe3b0'] },
  truck:   { w: 14, l: 34, v: [70, 95],   cols: ['#d8573f', '#3d7bd8', '#4aa35a', '#e2b23a'] },
  bus:     { w: 14, l: 38, v: [70, 92],   cols: ['#f2c230', '#2f9fd8'] },
  taxi:    { w: 10, l: 18, v: [104, 142], cols: ['#ffcf2e'] },
  jeep:    { w: 11, l: 18, v: [92, 126],  cols: ['#8a7a4a', '#c8553d', '#3d6b4a'] },
  tractor: { w: 12, l: 16, v: [44, 60],   cols: ['#3f9a3f', '#d8573f'] },
  plow:    { w: 16, l: 28, v: [56, 76],   cols: ['#ff8c1a'] },
  fuel:    { w: 12, l: 26, v: [78, 90],   cols: ['#ffffff'] },
  tow:     { w: 20, l: 30, v: [0, 0],     cols: ['#f2c14e'] }
};
const TDT = 0.25, TREC = 2;          // traffic simulation step, recorded every 2nd step (0.5 s)
const PUPS = ['shield', 'magnet', 'oil', 'ghost'];
const PUP_LABEL = { shield: 'SHIELD', magnet: 'MAGNET', oil: 'OIL DROP', ghost: 'GHOST', can: 'FUEL CAN' };

let RC = null;   // the current course (every lookup below reads it)
function roadIx(y){ let f = (y - RC.Y0) / SEG; if(f < 0) f = 0; else if(f > RC.n - 1.001) f = RC.n - 1.001; return f; }
function cxAt(y){ const f = roadIx(y), i = f | 0, u = f - i; return RC.cx[i] + (RC.cx[i + 1] - RC.cx[i]) * u; }
function hwAt(y){ const f = roadIx(y), i = f | 0, u = f - i; return RC.hw[i] + (RC.hw[i + 1] - RC.hw[i]) * u; }
function wallAt(y){ return RC.wall[Math.round(roadIx(y))]; }
function zoneAt(y){ return RC.zone[Math.round(roadIx(y))]; }
/* the shortcut side road: a narrow lane beside the main road with gravel links at both ends */
function sideAtRaw(y){ return sideAt(y) || { x: cxAt(y) + (RC.side ? RC.side.s : 1) * (HW + 36), hw: 11, link: 1 }; }
function sideAt(y){
  const sd = RC.side; if(!sd || y < sd.y0 || y > sd.y1) return null;
  const e = Math.min(y - sd.y0, sd.y1 - y);
  return { x: cxAt(y) + sd.s * (HW + 36), hw: 11, link: e < 110 ? 1 - e / 110 : 0 };
}
function crossState(c, t){
  const u = ((t + c.phase) % c.period + c.period) % c.period;
  return { closed: u < c.dur, warn: u > c.period - 1.9, u };
}
function gustAt(g, t){
  const u = ((t + g.phase) % g.period + g.period) % g.period;
  if(u < g.dur) return { f: g.dir * g.str * Math.sin(Math.PI * u / g.dur), warn: false, u };
  return { f: 0, warn: u > g.period - 1.6, u };
}
function laneOpenAt(C, L, y){
  for(const b of C.bridges) if((L === 0 || L === 3) && y > b.y0 - 110 && y < b.y1 + 30) return false;
  for(const w of C.works) if(y > w.y0 - 50 && y < w.y1 + 10 && w.closed.includes(L)) return false;
  return true;
}

function buildCourse(si, diff, seed, mode){
  const S = STAGES[si], d = DIFF[diff], rnd = mulberry(seed * 7919 + si * 104729 + 17);
  const R = (a, b) => a + (b - a) * rnd(), RI = (a, b) => Math.floor(a + (b - a + 1) * rnd());
  const len = S.len, Y0 = -500, n = Math.ceil((len + 1700) / SEG) + 1;
  const C = { si, S, diff, seed, code: seedToCode(seed), mode, len, Y0, n, cx: new Float32Array(n), hw: new Float32Array(n), wall: new Uint8Array(n), zone: new Uint8Array(n),
    bridges: [], tunnels: [], works: [], cross: [], gusts: [], side: null, patches: [], cones: [], boards: [], ramps: [], rocks: [], coins: [], pups: [], cps: [], deco: [], signs: [], veh: [] };
  const prev = RC; RC = C;
  // road centre: control points every 520 units, smoothly joined; straight start and finish
  const pts = []; let last = 0;
  for(let y = Y0; y <= len + 1300; y += 520){
    let v = (y < 700 || y > len - 350) ? 0 : clamp(R(-S.curve, S.curve), last - S.curve * 1.25, last + S.curve * 1.25);
    pts.push(v); last = v;
  }
  for(let i = 0; i < n; i++){
    const y = Y0 + i * SEG, f = (y - Y0) / 520, k = Math.min(pts.length - 2, Math.floor(f)), u = f - k;
    C.cx[i] = pts[k] + (pts[k + 1] - pts[k]) * smooth(u); C.hw[i] = HW;
  }
  // big features on non-overlapping stretches
  const occ = [];
  const free = (a, b, m) => occ.every(o => b < o[0] - (m || 140) || a > o[1] + (m || 140));
  const reserve = (L, lo, hi, m) => { for(let t = 0; t < 90; t++){ const y0 = R(lo, hi - L); if(free(y0, y0 + L, m)){ occ.push([y0, y0 + L]); return y0; } } return null; };
  C.cps = [0.25, 0.5, 0.75].map(f => Math.round(len * f / 10) * 10);
  C.cps.forEach(y => occ.push([y - 60, y + 60]));
  occ.push([len - 260, len + 400]);
  const H = S.haz, cnt = k => Math.max(0, Math.round((H[k] || 0) * (k === 'bridge' || k === 'tunnel' || k === 'side' || k === 'cross' || k === 'gust' ? 1 : d.haz)));
  const setRange = (y0, y1, fn) => { for(let i = Math.max(0, Math.floor((y0 - Y0) / SEG)); i < n && Y0 + i * SEG <= y1; i++) fn(i, Y0 + i * SEG); };
  for(let b = 0; b < cnt('bridge'); b++){
    const L = R(380, 600), y = reserve(L + 200, 1000, len - 500, 900); if(y === null) continue;
    const y0 = y + 100, y1 = y0 + L; C.bridges.push({ y0, y1 });
    setRange(y0 - 100, y1 + 100, (i, yy) => { const e = Math.min(yy - (y0 - 100), y1 + 100 - yy); C.hw[i] = e >= 80 ? 26 : lerp(HW, 26, smooth(e / 80)); C.wall[i] = 1; if(yy >= y0 && yy <= y1) C.zone[i] = 1; });
  }
  for(let b = 0; b < cnt('tunnel'); b++){
    const L = R(420, 700), y0 = reserve(L, 1000, len - 500); if(y0 === null) continue;
    C.tunnels.push({ y0, y1: y0 + L });
    setRange(y0, y0 + L, i => { C.wall[i] = 1; C.zone[i] = 2; C.hw[i] = 48; });
  }
  if(cnt('side')){
    const L = R(760, 1050), y0 = reserve(L, 1400, len - 800);
    if(y0 !== null) C.side = { s: rnd() < 0.5 ? -1 : 1, y0, y1: y0 + L };
  }
  for(let b = 0; b < cnt('works'); b++){
    const L = R(260, 460), y0 = reserve(L, 1000, len - 400); if(y0 === null) continue;
    const side = rnd() < 0.5 ? -1 : 1, lanes = diff === 'kids' ? 1 : (rnd() < 0.45 ? 2 : 1);
    const closed = side < 0 ? [0, 1].slice(0, lanes) : [3, 2].slice(0, lanes);
    const xb = side * (HW - lanes * LANE);            // boundary between the closed lanes and the open road
    const w = { y0, y1: y0 + L, side, lanes, closed, xb }; C.works.push(w);
    // cone taper from the road edge to the boundary, then a line of cones; a barrier board and a digger inside
    for(let y = y0 - 70; y <= y0 + L; y += 14){
      const u = clamp((y - (y0 - 70)) / 70, 0, 1), off = lerp(side * (HW - 3), xb, u);
      if(y < y0 || Math.round((y - y0) / 14) % 2 === 0) C.cones.push({ id: C.cones.length, x: cxAt(y) + off, y });
    }
    C.boards.push({ x: cxAt(y0 + 12) + (side * HW + xb) / 2, y: y0 + 12, w: Math.abs(side * HW - xb) - 4, h: 5, k: 'board' });
    C.boards.push({ x: cxAt(y0 + L * 0.55) + (side * HW + xb) / 2, y: y0 + L * 0.55, w: Math.min(20, Math.abs(side * HW - xb) - 6), h: 16, k: 'digger' });
    C.signs.push({ y: y0 - 240, k: 'works', side });
  }
  for(let b = 0; b < cnt('cross'); b++){
    const y = reserve(60, 1100, len - 500); if(y === null) continue;
    const period = R(15, 21);
    C.cross.push({ y: y + 30, period, dur: diff === 'kids' ? 3.4 : 4.4, phase: R(0, period), dir: rnd() < 0.5 ? -1 : 1 });
    C.signs.push({ y: y - 220, k: 'cross' });
  }
  C.cross.sort((a, b) => a.y - b.y);
  if(cnt('gust')){
    const on = C.bridges.slice(0, cnt('gust'));
    for(const b of on) C.gusts.push({ y0: b.y0 - 60, y1: b.y1 + 60, period: R(6.5, 9), dur: 2.6, phase: R(0, 8), dir: rnd() < 0.5 ? -1 : 1, str: diff === 'kids' ? 30 : 58 });
    for(let k = on.length; k < cnt('gust'); k++){ const y0 = reserve(520, 1100, len - 500); if(y0 !== null) C.gusts.push({ y0, y1: y0 + 520, period: R(6.5, 9), dur: 2.6, phase: R(0, 8), dir: rnd() < 0.5 ? -1 : 1, str: diff === 'kids' ? 30 : 58 }); }
    for(const g of C.gusts) C.signs.push({ y: g.y0 - 200, k: 'wind' });
  }
  const inWorks = (x, y, pad) => C.works.some(w => y > w.y0 - 80 - pad && y < w.y1 + pad && Math.sign(x - cxAt(y) - w.xb) === w.side);
  const nearCross = (y, pad) => C.cross.some(c => Math.abs(c.y - y) < pad);
  for(let b = 0; b < cnt('ramp'); b++){
    for(let t = 0; t < 40; t++){
      const y = R(900, len - 400), L = RI(0, 3), x = cxAt(y) + LANES[L];
      if(Math.abs(x - cxAt(y)) > hwAt(y) - 10 || inWorks(x, y, 60) || nearCross(y, 160) || zoneAt(y) || C.ramps.some(r => Math.abs(r.y - y) < 700)) continue;
      C.ramps.push({ id: C.ramps.length, x, y, w: 18, l: 12 }); break;
    }
  }
  if(C.side){ const sd = C.side, y = sd.y0 + (sd.y1 - sd.y0) * 0.45; C.ramps.push({ id: C.ramps.length, x: cxAt(y) + sd.s * (HW + 36), y, w: 16, l: 12, side: 1 }); }
  for(let b = 0; b < cnt('rock'); b++){
    for(let t = 0; t < 40; t++){
      const y = R(1000, len - 400), L = RI(0, 3), x = cxAt(y) + LANES[L] + R(-4, 4);
      if(Math.abs(x - cxAt(y)) > hwAt(y) - 8 || inWorks(x, y, 80) || nearCross(y, 200) || C.rocks.some(r => Math.abs(r.y - y) < 500)) continue;
      C.rocks.push({ id: C.rocks.length, x, y, r: 6 }); C.signs.push({ y: y - 230, k: 'rock' }); break;
    }
  }
  // flat patches: puddles, oil, ice, sand
  const PAT = { puddle: [11, 15, 7, 10], oil: [8, 10, 6, 8], ice: [12, 19, 10, 16], sand: [14, 24, 9, 13] };
  for(const k of ['puddle', 'oil', 'ice', 'sand']){
    for(let b = 0; b < cnt(k); b++){
      for(let t = 0; t < 40; t++){
        const y = R(800, len - 250), L = RI(0, 3), x = cxAt(y) + LANES[L] + R(-5, 5), p = PAT[k];
        if(Math.abs(x - cxAt(y)) > hwAt(y) - 6 || inWorks(x, y, 40) || nearCross(y, 90) || C.patches.some(q => Math.abs(q.y - y) < 220)) continue;
        C.patches.push({ id: C.patches.length, k, x, y, rx: R(p[0], p[1]), ry: R(p[2], p[3]) }); break;
      }
    }
  }
  C.patches.sort((a, b) => a.y - b.y);
  // pickups: power-ups, fuel cans and coins (the same for every driver)
  const pickupOk = (x, y) => Math.abs(x - cxAt(y)) < hwAt(y) - 8 && !inWorks(x, y, 30) && !nearCross(y, 80) && !C.patches.some(q => Math.abs(q.y - y) < 30 && Math.abs(q.x - x) < 22) && !C.rocks.some(q => Math.abs(q.y - y) < 40);
  const npu = mode === 'tt' ? 0 : 5;
  for(let b = 0; b < npu + cnt('can'); b++){
    const k = b < npu ? PUPS[RI(0, 3)] : 'can';
    for(let t = 0; t < 40; t++){
      const y = R(900, len - 300), x = cxAt(y) + LANES[RI(0, 3)];
      if(!pickupOk(x, y) || C.pups.some(q => Math.abs(q.y - y) < 500)) continue;
      C.pups.push({ id: C.pups.length, k, x, y }); break;
    }
  }
  C.pups.sort((a, b) => a.y - b.y);
  for(let y = 700 + R(0, 300); y < len - 200; y += R(300, 560)){
    const L = RI(0, 3), weave = rnd() < 0.3, dir = L < 2 ? 1 : -1, nC = RI(5, 7);
    for(let j = 0; j < nC; j++){
      const yy = y + j * 16, off = LANES[L] + (weave ? dir * LANE * smooth(j / (nC - 1)) : 0), x = cxAt(yy) + off;
      if(pickupOk(x, yy)) C.coins.push({ id: C.coins.length, x, y: yy });
    }
  }
  if(C.side){ const sd = C.side; for(let y = sd.y0 + 130; y < sd.y1 - 130; y += 24){ if(Math.abs(y - C.ramps[C.ramps.length - 1].y) > 30) C.coins.push({ id: C.coins.length, x: cxAt(y) + sd.s * (HW + 36), y, side: 1 }); } }
  C.coins.sort((a, b) => a.y - b.y);
  // roadside scenery: props on both sides, billboards, warning signs
  const props = S.props, boards = ['FULL TANK', 'XRETRO', 'HUMBLE YETI', 'ZOOM COLA', 'GAS & GO', 'DRIVE SAFE'];
  for(const s of [-1, 1]){
    for(let y = Y0 + R(0, 40); y < len + 1100; y += R(26, 52)){
      let off = HW + R(14, 88);
      if(S.sea && s > 0) off = HW + R(12, 58);
      if(C.side && s === C.side.s && y > C.side.y0 - 20 && y < C.side.y1 + 20 && off < HW + 60) off = HW + R(60, 92);
      if(zoneAt(y) === 1 && off < HW + 30) off = HW + R(32, 80);
      C.deco.push({ y, s, off, k: props[RI(0, props.length - 1)], v: rnd() });
    }
  }
  for(let y = 900; y < len; y += R(1300, 1900)) C.deco.push({ y, s: rnd() < 0.5 ? -1 : 1, off: HW + 26, k: 'board', v: rnd(), text: boards[RI(0, boards.length - 1)] });
  C.deco.sort((a, b) => a.y - b.y);
  C.signs.sort((a, b) => a.y - b.y);
  buildTraffic(C, d, rnd, R, RI);
  RC = prev || C;
  return C;
}

/* ---------- Traffic: placed so drivers meet it evenly (a calm start, busier toward the finish), then
   simulated once for the whole race: follows slower cars, changes lane, merges round road works and
   bridges, queues at level crossings. Only arithmetic, so every browser gets the same traffic. ---------- */
function buildTraffic(C, d, rnd, R, RI){
  const S = C.S, len = C.len, kids = C.diff === 'kids', expv = EXP * (kids ? 0.88 : 1);
  const kinds = Object.keys(S.kinds), wsum = kinds.reduce((a, k) => a + S.kinds[k], 0);
  const pick = () => { let u = rnd() * wsum; for(const k of kinds){ u -= S.kinds[k]; if(u <= 0) return k; } return kinds[0]; };
  const V = C.veh, spacing = 94 / d.traffic;
  const add = (o) => { o.id = V.length; V.push(o); };
  const fuelAt = (C.diff === 'pro' ? [0.27, 0.52, 0.76] : [0.22, 0.43, 0.63, 0.82]).map(f => len * f + R(-200, 200));
  let fi = 0;
  for(let y = 420; y < len + 260;){
    const f = y / len, dens = y < 1000 ? 0.4 : lerp(0.66, 1.2, f);
    y += spacing / dens * R(0.55, 1.45);
    let k = pick(), beh = 'norm';
    if(fi < fuelAt.length && y > fuelAt[fi]){ k = 'fuel'; fi++; }
    const K = VK[k];
    if(k !== 'fuel'){
      const u = rnd();
      if((k === 'sedan' || k === 'taxi' || k === 'jeep') && u < 0.16) beh = 'swerve';
      else if((k === 'sedan' || k === 'taxi') && u < 0.34) beh = 'lc';
      else if((k === 'sedan' || k === 'van') && u > 0.965 && y > 1400) beh = 'stop';
    }
    let L = RI(0, 3);
    if(beh === 'stop'){ L = rnd() < 0.5 ? 0 : 3; if(!laneOpenAt(C, L, y) || zoneAt(y) || C.cross.some(c => Math.abs(c.y - y) < 200) || C.works.some(w => y > w.y0 - 150 && y < w.y1 + 60)) continue; }
    for(let t = 0; t < 4 && !laneOpenAt(C, L, y); t++) L = RI(0, 3);
    if(k !== 'fuel' && C.bridges.some(b => y > b.y0 - 260 && y < b.y1 + 120) && rnd() < 0.55) continue;
    if(k !== 'fuel' && C.works.some(w => y > w.y0 - 200 && y < w.y1 + 60) && rnd() < 0.35) continue;
    const v = beh === 'stop' ? 0 : R(K.v[0], K.v[1]) * (k === 'fuel' ? 1 : d.tspd * (1 + 0.12 * f)), te = y / (k === 'fuel' ? expv * 0.82 : expv);
    const y0 = beh === 'stop' ? y : y - v * te;
    if(y0 > -240 && y0 < 220) continue;                       // keep the start grid clear
    add({ k, beh, w: K.w, l: K.l, cv: v, lane: L, y0, col: K.cols[RI(0, K.cols.length - 1)], ph: R(0, TAU), sw: R(1.6, 2.6), amp: R(10, 16), seed: RI(0, 1e6) });
  }
  // simulate
  const kidsT = kids ? 1.25 : 1, T = Math.ceil(len / 92 * kidsT + 50), NS = Math.ceil(T / (TDT * TREC)) + 2, NV = V.length;
  C.tN = NS; C.tT = (NS - 1) * TDT * TREC;
  C.vY = new Float32Array(NV * NS); C.vX = new Float32Array(NV * NS);
  const st = V.map(o => ({ o, y: o.y0, lx: LANES[o.lane] + (o.beh === 'stop' ? (o.lane === 0 ? -5 : 5) : 0), tl: o.lane, v: o.cv, wait: 0 }));
  const order = st.slice();
  const steps = (NS - 1) * TREC;
  for(let s = 0; s <= steps; s++){
    const t = s * TDT;
    if(s % TREC === 0){ const k = s / TREC; for(let i = 0; i < NV; i++){ C.vY[i * NS + k] = st[i].y; C.vX[i * NS + k] = st[i].lx; } }
    if(s === steps) break;
    order.sort((a, b) => a.y - b.y);
    for(let oi = 0; oi < NV; oi++){
      const a = order[oi], o = a.o;
      if(o.beh === 'stop') continue;
      if(a.y > len + 900 || a.y < -900 && a.y + a.v * 40 < -900){ a.y += a.v * TDT; continue; }
      // the nearest thing ahead in my lane
      let gap = 1e9, lv = 0;
      for(let j = oi + 1; j < NV; j++){
        const b = order[j], dy = b.y - a.y; if(dy > 110) break;
        if(Math.abs(b.lx - a.lx) < (o.w + b.o.w) / 2 + 2){ const g = dy - (o.l + b.o.l) / 2; if(g < gap){ gap = g; lv = b.v; } }
      }
      // a level crossing that will be closed when I get there: stop at the line
      for(const c of C.cross){
        const dy = c.y - 14 - a.y - o.l / 2; if(dy < -2 || dy > 170) continue;
        const arrive = t + Math.max(0, dy) / Math.max(a.v, 25), cs = crossState(c, arrive), cn = crossState(c, t);
        if(cs.closed || cn.closed || cn.warn) if(dy < gap){ gap = dy; lv = 0; }
      }
      // my lane closes ahead (bridge, road works): change lane, or queue at the closure
      const shut = !laneOpenAt(C, a.tl, a.y + 60) || !laneOpenAt(C, a.tl, a.y + 140);
      let want = a.tl;
      if(Math.abs(a.lx - LANES[a.tl]) < 3 && (shut || (gap < 80 && lv < o.cv - 8) || (o.k !== 'fuel' && rnd() < 0.0015))){
        const cands = a.tl === 0 ? [1] : a.tl === 3 ? [2] : (rnd() < 0.5 ? [a.tl - 1, a.tl + 1] : [a.tl + 1, a.tl - 1]);
        for(const c of cands){
          if(!laneOpenAt(C, c, a.y + 30) || !laneOpenAt(C, c, a.y + 160)) continue;
          let ok = true;
          for(let j = oi - 1; j >= 0; j--){ const b = order[j]; if(a.y - b.y > 60) break; if(Math.abs(b.lx - LANES[c]) < 13) { ok = false; break; } }
          for(let j = oi + 1; ok && j < NV; j++){ const b = order[j]; if(b.y - a.y > 70) break; if(Math.abs(b.lx - LANES[c]) < 13) ok = false; }
          if(ok || (shut && a.wait > 6)){ want = c; break; }
        }
      }
      if(shut && want === a.tl){
        a.wait += TDT;
        let cl = 1e9;
        for(const b of C.bridges) if(b.y0 - 110 - a.y > 0) cl = Math.min(cl, b.y0 - 110 - a.y);
        for(const w of C.works) if(w.closed.includes(a.tl) && w.y0 - 50 - a.y > 0) cl = Math.min(cl, w.y0 - 50 - a.y);
        if(cl - o.l / 2 < gap){ gap = cl - o.l / 2; lv = 0; }
      } else a.wait = 0;
      a.tl = want;
      // speed: cruise, follow, stop
      let des = o.cv;
      if(gap < 16) des = Math.min(lv * 0.6, des);
      else if(gap < 16 + Math.max(0, a.v - lv) * 1.4 + 10) des = Math.min(des, lv);
      const dv = des - a.v; a.v += clamp(dv, -110 * TDT, 45 * TDT); if(a.v < 0) a.v = 0;
      a.y += a.v * TDT;
      const tx = LANES[a.tl], dx = tx - a.lx; a.lx += clamp(dx, -22 * TDT, 22 * TDT);
    }
  }
}
/* where a vehicle is at time t (y, and lateral offset from the road centre) */
const VP = { y: 0, lx: 0, dx: 0 };
function vehAt(C, i, t){
  let f = t / (TDT * TREC); if(f < 0) f = 0; else if(f > C.tN - 1.001) f = C.tN - 1.001;
  const k = f | 0, u = f - k, b = i * C.tN + k;
  VP.y = C.vY[b] + (C.vY[b + 1] - C.vY[b]) * u; VP.lx = C.vX[b] + (C.vX[b + 1] - C.vX[b]) * u; VP.dx = (C.vX[b + 1] - C.vX[b]) * 2;
  return VP;
}

/* ================= State ================= */
const OPT_DEF = { rubber: true, balanced: false, rivals: 'full', boostMode: 'hold', cb: false, calm: false, bigHud: false, autoSteer: 'assist', bigHit: 'assist' };
const G = {
  state: 'title', demo: true, time: 0, stateT: 0, raceT: 0, net: null, C: null,
  diff: A.Store.get('fulltank.diff', 'normal'), stage: A.Store.get('fulltank.stage', 0), mode: A.Store.get('fulltank.mode', 'quick'),
  code: A.Store.get('fulltank.code', ''), unlocked: A.Store.get('fulltank.unlocked', 1),
  opts: Object.assign({}, OPT_DEF, A.Store.get('fulltank.opts', {})),
  racers: [], players: [], items: [], itemId: 1, events: [], evSeq: 0, dodge: new Map(), taken: new Map(),
  banner: null, fx: [], slowT: 0, photo: null, replay: null, rec: null, results: null, champ: null, bot: false, seed: 1, rid: 0,
  cheerT: 0, over: null, ghostRec: null, finishOrder: []
};
if(!DIFF[G.diff]) G.diff = 'normal';
if(!MODES.some(m => m.id === G.mode)) G.mode = 'quick';
G.unlocked = clamp(G.unlocked | 0, 1, STAGES.length);
if(!(G.stage >= 0 && G.stage < G.unlocked)) G.stage = 0;
if(!/^[A-Z]{4}$/.test(G.code)) G.code = '';
const D = () => DIFF[G.diff];
const saveOpts = () => A.Store.set('fulltank.opts', G.opts);
const running = () => G.state === 'race' || G.state === 'over' || G.demo;
function fmt(t){ if(!(t >= 0)) return '--:--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function fmtClock(t){ t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
function ordinal(n){ return n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'); }
function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailySpec(){ const day = today(), h = hashStr('fulltank-daily-' + day); return { day, stage: h % STAGES.length, seed: (h >>> 5) % 160000 }; }
const PAL_STD = A.PLAYER_COLORS, PAL_CB = ['#f0e442', '#56b4e9', '#e69f00', '#cc79a7'];
const pcol = slot => (G.opts.cb ? PAL_CB : PAL_STD)[slot % 4];
let netFx = [];
/* floating text: "NEAR MISS!", "+50" (sent to guests as small events) */
function pop(text, x, y, col, big, rid){
  if(G.demo || G.replay) return;
  const f = { text, x: Math.round(x), y: Math.round(y), col: col || '#fff4d8', big: big ? 1 : 0, t: 0, rid: rid || 0 };
  G.fx.push(f); if(G.fx.length > 40) G.fx.shift();
  if(Net && Net.role === 'host' && netFx.length < 16) netFx.push([f.text, f.x, f.y, f.col, f.big, f.rid]);
}
function banner(text, sub, col, t){ G.banner = { text, sub: sub || '', col: col || '#ffd45e', t: t || 2.2, at: G.time }; }
function say(r, msg, col, t){ r.msg = msg; r.msgT = t || 1.1; r.msgCol = col || '#fff4d8'; }

/* ---------- Racers ---------- */
let nextId = 1;
function newStats(){ return { crashes: 0, scrapes: 0, near: 0, overtakes: 0, bestChain: 0, boostT: 0, horns: 0, fuelPicks: 0, coins: 0, slipT: 0, lanes: 0, brakeT: 0, air: 0, tricks: 0, recover: 0, gained: 0, fuelUsed: 0, driveT: 0, pups: 0, cones: 0, daily: 0, finished: 0, dist: 0, fuelT: 0 }; }
function makeRacer(o){
  return Object.assign({ id: nextId++, kind: 'human', x: 0, y: 0, v: 0, vx: 0, ang: 0, spinT: 0, spinDir: 1, invT: 0, airT: 0, airDur: 0, twist: 0, lastSteer: 0,
    boost: false, toggled: false, fireT: 0, fireWas: false, upWas: false, hornCd: 0, hornT: 0, fuel: 100, fuelMax: 100, clock: 0, cp: 0, finished: false, finishT: 0, out: null, place: 0, worst: 0,
    score: 0, combo: 0, comboT: 0, chain: 0, chainT: -9, slipT: 0, slip: false, sandT: 0, iceT: 0, oilT: 0, splashT: 0, surf: 'road', lastLane: 1, brakeOn: false,
    pu: { shield: 0, magnet: 0, ghost: 0, oil: 0 }, catchT: 0, msg: '', msgT: 0, msgCol: '#fff', crew: [], drv: 0, car: 0, livery: 'plain', level: 'std',
    lastCrashT: -9, recovering: false, plan: null, planT: 0, nm: new Map(), touch: new Map(), hitSet: new Set(), bumpCd: 0, lowT: 0, helpT: 0, moments: [], relaySwaps: 0 }, o);
}
function driverOf(r){ return r.crew && r.crew.length ? r.crew[r.drv % r.crew.length] : { source: '', name: r.name, color: r.color, stats: newStats() }; }
function statsOf(r){ return driverOf(r).stats; }
function isJunior(r){ return r.kind === 'human' && (G.diff === 'kids' || r.level === 'junior'); }
function isAssist(r, which){ const o = G.opts[which]; return r.kind === 'human' && !G.demo && (o === 'all' || (o === 'assist' && (r.level === 'assist' || isJunior(r)))); }
function clockOn(r){ return r.kind === 'human' && !isJunior(r) && D().clock > 0 && G.mode !== 'tt'; }
function carStats(r){
  if(r.kind === 'rival') return CARS[r.car] || CARS[0];
  return G.opts.balanced ? BALANCED : (CARS[r.car] || CARS[0]);
}
function humans(){ return G.racers.filter(r => r.kind === 'human'); }
function pstrips(){ return G.racers.filter(r => r.kind === 'human' && !r.demoHidden); }

/* ---------- Per-driver traffic reactions (horn, cut-ins, knocks), sent to guests as small events ---------- */
function dmapOf(rid){ let m = G.dodge.get(rid); if(!m){ m = new Map(); G.dodge.set(rid, m); } return m; }
function takenOf(rid){ let s = G.taken.get(rid); if(!s){ s = new Set(); G.taken.set(rid, s); } return s; }
function vent(e){ if(!dmapOf(e[1])) return; applyEvent(e); if(Net && Net.role === 'host'){ G.events.push({ q: ++G.evSeq, a: e }); if(G.events.length > 90) G.events.shift(); } }
/* e = [type, racerId, a, t0, val, flag] */
function applyEvent(e){
  const [k, rid, a, t0, val, flag] = e;
  if(k === 't'){ takenOf(rid).add(a); return; }
  const m = dmapOf(rid); let v = m.get(a); if(!v){ v = { d: [], b: null, lc: false }; m.set(a, v); }
  if(k === 'd'){ if(!v.d.some(x => x.t0 === t0)) v.d.push({ t0, dx: val, calm: !!flag }); if(flag === 2) v.lc = true; }
  else if(k === 'b'){ if(!v.b) v.b = { t0, dir: val }; }
  else if(k === 'l') v.lc = true;
}
/* a vehicle's x on one driver's road (vehAt must have been called for this vehicle and time) */
function vehX(o, t, dm){
  let add = 0, calm = false, bx = 0;
  if(dm){ const ev = dm.get(o.id); if(ev){ for(const e of ev.d){ add += e.dx * smooth((t - e.t0) / 0.7); if(e.calm && t >= e.t0) calm = true; } if(ev.b){ const u = clamp((t - ev.b.t0) / 0.9, 0, 1); bx = ev.b.dir * 26 * (1 - (1 - u) * (1 - u)); } } }
  let lx = VP.lx + add;
  if(o.beh === 'swerve' && !calm) lx += Math.sin(t * o.sw + o.ph) * o.amp;
  const h = hwAt(VP.y) - o.w / 2 - 1.5;
  return cxAt(VP.y) + clamp(lx, -h, h) + bx;
}
function vehGone(o, t, dm){ const ev = dm && dm.get(o.id); return !!(ev && ev.b && t - ev.b.t0 > 0.05); }
function vehSpeed(C, i, t){ const f = clamp(t / (TDT * TREC), 0, C.tN - 1.001), k = f | 0, b = i * C.tN + k; return (C.vY[b + 1] - C.vY[b]) / (TDT * TREC); }

/* ---------- Controls ---------- */
function humanInput(r){
  const p = driverOf(r), s = A.Input.get(p.source), on = !!(s && s.connected);
  if(!on) return { steer: 0, up: false, down: false, fire: false };
  return { steer: (s.right ? 1 : 0) - (s.left ? 1 : 0), up: !!s.up, down: !!s.down, fire: !!s.fire };
}
/* tap FIRE = horn, hold FIRE (or UP) = boost; toggle mode: a long press or UP switches boost on/off */
function actions(r, inp, dt){
  let horn = false;
  const toggle = G.opts.boostMode === 'toggle';
  if(inp.fire) r.fireT += dt;
  else { if(r.fireWas && r.fireT < 0.2) horn = true; if(r.fireWas && toggle && r.fireT >= 0.2) r.toggled = !r.toggled; r.fireT = 0; }
  if(toggle){ if(inp.up && !r.upWas) r.toggled = !r.toggled; if(inp.down) r.toggled = false; }
  r.fireWas = inp.fire; r.upWas = inp.up;
  const held = inp.fire && r.fireT >= 0.2;
  const boost = toggle ? (r.toggled || held) : (inp.up || held);
  const a = { steer: inp.steer, boost: boost && !inp.down, brake: inp.down, horn };
  if(!a.steer && isAssist(r, 'autoSteer')){
    // auto-steer assist: a gentle pull to a clear lane when you let go of the stick
    r.planT -= dt; if(r.planT <= 0 || !r.plan){ r.planT = 0.12; r.plan = plan(r, { caution: 1.2, boost: 0, aggro: 0 }); }
    const err = r.plan.tx - r.x - r.vx * 0.22; if(Math.abs(err) > 2.5) a.steer = clamp(err / 14, -0.7, 0.7);
    if(r.plan.stop && !a.boost) a.brake = true;
  }
  return a;
}

/* ---------- Driving AI: rivals, test bots, the demo, and the auto-steer assist ---------- */
const OBS = [];
function inWorksAt(x, y){ for(const w of RC.works) if(y > w.y0 - 60 && y < w.y1 + 6 && Math.sign(x - cxAt(y) - w.xb) === w.side) return true; return false; }
/* plan a line: everything is measured across the road (offset from the centre), so bends don't matter */
function plan(r, pers){
  const C = RC, t = G.raceT, y = r.y, look = 70 + r.v * 0.8 * (pers.caution || 1);
  const dm = r.kind === 'human' ? G.dodge.get(r.id) : null, taken = r.kind === 'human' ? G.taken.get(r.id) : null;
  const add = (o) => { o.off = o.x - cxAt(o.y); if(o.offP === undefined) o.offP = o.off; OBS.push(o); };
  OBS.length = 0;
  for(const o of C.veh){
    vehAt(C, o.id, t); const dy = VP.y - y; if(dy < -34 || dy > look + 50) continue;
    if(vehGone(o, t, dm)) continue;
    const x = vehX(o, t, dm), v = vehSpeed(C, o.id, t), vy = VP.y, ldx = VP.dx;
    if(o.k === 'fuel'){ if(r.kind === 'human' && !(taken && taken.has('f' + o.id)) && (r.fuel < r.fuelMax * 0.9 || isJunior(r))) add({ x, y: vy, w: o.w, l: o.l, v, want: -1400 }); continue; }
    const closing = Math.max(1, r.v - v), tm = Math.min(1.4, Math.max(0, dy - (o.l + CAR_L) / 2) / closing);
    const ob = { x, y: vy, w: o.w, l: o.l, v, veh: o };
    // where it will be when we get there: lane changes, swerves and cut-ins
    let wide = 0;
    if(o.beh === 'swerve'){ const ev = dm && dm.get(o.id); if(!(ev && ev.d.some(e => e.calm && t >= e.t0))) wide = o.amp; }
    if(o.beh === 'lc' && r.kind === 'human' && dy > 20 && dy < 140){ const ev = dm && dm.get(o.id); if(!(ev && ev.lc)) wide = Math.max(wide, 10); }
    add(ob); ob.offP = ob.off + ldx * tm; ob.wide = wide;
  }
  for(const q of G.racers){ if(q === r || q.kind === 'ghost' || (q.kind === 'human' && r.kind === 'human') || (q.kind === 'rival' && r.kind === 'rival') || q.finished) continue; const dy = q.y - y; if(dy > -24 && dy < look) add({ x: q.x, y: q.y, w: CAR_W + (q.boss ? 8 : 2), l: CAR_L, v: q.v }); }
  for(const b of C.boards){ const dy = b.y - y; if(dy > -20 && dy < look + 30) add({ x: b.x, y: b.y, w: b.w + 4, l: b.h + 4, v: 0 }); }
  for(const k of C.rocks){ const dy = k.y - y; if(dy > -20 && dy < look + 30) add({ x: k.x, y: k.y, w: 14, l: 14, v: 0 }); }
  for(const q of C.cones){ const dy = q.y - y; if(dy > -12 && dy < look) add({ x: q.x, y: q.y, w: 6, l: 6, v: 0, soft: 700 }); }
  for(const p of C.patches){ const dy = p.y - y; if(dy > -20 && dy < look) add({ x: p.x, y: p.y, w: p.rx * 2, l: p.ry * 2, v: 0, soft: p.k === 'oil' ? 1100 : p.k === 'ice' ? 600 : p.k === 'sand' ? 300 : 180 }); }
  for(const it of G.items){ const dy = it.y - y; if(dy > -20 && dy < look && !r.hitSet.has('i' + it.id) && it.own !== r.id) add({ x: it.x, y: it.y, w: 12, l: 10, v: 0, soft: it.k === 'oil' ? 1100 : 700 }); }
  if(r.kind === 'human'){
    for(const p of C.pups){ const dy = p.y - y; if(dy > 10 && dy < look && !(taken && taken.has('p' + p.id))) add({ x: p.x, y: p.y, w: 8, l: 8, v: 0, want: p.k === 'can' ? (r.fuel < r.fuelMax * 0.75 ? -500 : -60) : -160 }); }
    for(let i = lowerBound(C.coins, y + 10); i < C.coins.length && C.coins[i].y < y + look * 0.7; i++){ const q = C.coins[i]; if(!(taken && taken.has('c' + q.id))) add({ x: q.x, y: q.y, w: 6, l: 6, v: 0, want: -25 }); }
  }
  for(const g of C.ramps){ const dy = g.y - y; if(dy > 10 && dy < look && !g.side) add({ x: g.x, y: g.y, w: g.w, l: g.l, v: 0, want: -70 }); }
  const roff = r.x - cxAt(y);
  const hs = [30, 70, 120].filter(d => d < look + 40).map(d => [d, hwAt(y + d)]);
  const hw0 = Math.min(hwAt(y), hwAt(y + 15));
  let best = 1e9, boff = roff, bestBlock = 1e9;
  for(let off = -hw0 + 7; off <= hw0 - 7 + 0.01; off += 3.125){
    let cost = Math.abs(off - roff) * 0.35 + Math.min(...LANES.map(l => Math.abs(off - l))) * 0.2, block = 1e9;
    for(const [d, hw] of hs){ if(Math.abs(off) > hw - 7 || inWorksAt(cxAt(y + d) + off, y + d)) cost += 2600 * (1.4 - d / 150); }
    for(const o of OBS){
      const dy = o.y - y, reach = (o.w + CAR_W) / 2 + 3 + (o.wide || 0);
      const gap = dy - (o.l + CAR_L) / 2;
      if(o.want){ if(Math.abs(o.off - off) < (o.w + CAR_W) / 2 && dy > 0) cost += o.want * (1 - dy / (look + 80)); continue; }
      const closing = r.v - o.v;
      const hit = Math.abs(o.off - off) < reach || Math.abs(o.offP - off) < reach - (o.wide || 0);
      if(hit && gap > -6 && (closing > 5 || gap < 26)){
        cost += (o.soft || 3000) * clamp(1.35 - gap / (look + 30), 0.2, 1.35);
        if(!o.soft) block = Math.min(block, gap);
      }
      // the way there: something alongside, between here and there
      if(!o.soft && gap < 26 && gap > -o.l - CAR_L - 4){ const lo = Math.min(roff, off) - reach + 3, hi = Math.max(roff, off) + reach - 3; if(o.off > lo && o.off < hi && Math.abs(off - roff) > 2.5) cost += 3600; }
    }
    if(cost < best){ best = cost; boff = off; bestBlock = block; }
  }
  const lead = Math.min(40, r.v * 0.18);
  const P = { tx: cxAt(y + lead) + boff, off: boff, boost: false, brake: false, horn: false, stop: false, cost: best };
  // level crossings: stop for the red lights
  for(const c of C.cross){
    const dist = c.y - 14 - y - CAR_L / 2; if(dist < -4 || dist > r.v * 1.8 + 100) continue;
    const arrive = t + Math.max(0, dist) / Math.max(r.v, 30), now = crossState(c, t), then = crossState(c, arrive);
    if(now.closed || now.warn || then.closed || then.warn){ if(dist < r.v * r.v / 600 + 24){ P.brake = true; P.stop = true; } P.noBoost = true; }
  }
  // something in our chosen line that we can't steer round in time: brake
  const moveT = Math.abs(boff - roff) / 85 + 0.15, trapped = best >= 3000;
  for(const o of OBS){
    if(o.soft || o.want) continue;
    const gap = o.y - y - (o.l + CAR_L) / 2, cl = r.v - o.v;
    if(gap < -6 || cl <= 0) continue;
    const inCur = Math.abs(o.off - roff) < (o.w + CAR_W) / 2 + 2 + (o.wide || 0) * 0.5, inBest = Math.abs(o.off - boff) < (o.w + CAR_W) / 2 + 2;
    const ttc = gap / cl;
    if((inCur && (ttc < moveT || (trapped && ttc < 1.1))) || (inBest && gap < cl * cl / 560 + 12)){ P.brake = true; break; }
  }
  const clear = bestBlock > r.v * 0.6 + 30 && !P.noBoost && best < 1400;
  const fuelOk = isJunior(r) || r.fuel > r.fuelMax * 0.22 || r.kind === 'rival';
  const bu = pers.boost === undefined ? 0.85 : pers.boost;
  P.boost = clear && fuelOk && !P.brake && (r.kind !== 'rival' || bu >= 0.5 || Math.sin(t * 0.37 + r.id * 1.7) > 1 - 3.2 * bu);
  // horn at a swerver or a car sitting in the way
  const ahead = OBS.find(o => o.veh && Math.abs(o.off - roff) < 16 && o.y - y > 12 && o.y - y < 110);
  if(ahead && (ahead.veh.beh === 'swerve' || ahead.veh.beh === 'lc' || best > 1400) && r.hornCd <= 0) P.horn = true;
  return P;
}
function botDrive(r, dt){
  const pers = r.pers || { caution: 1, boost: 0.85, aggro: 0 };
  r.planT -= dt;
  if(r.planT <= 0 || !r.plan){ r.planT = r.kind === 'rival' ? 0.14 : 0.1; r.plan = plan(r, pers); if(r.kind === 'rival') rivalTricks(r, r.plan); }
  const P = r.plan;
  const err = P.tx - r.x - r.vx * 0.24;
  const out = { steer: Math.abs(err) < 1.2 ? 0 : clamp(err / 7, -1, 1), boost: P.boost, brake: P.brake && !(G.noBrake && r.kind === 'human'), horn: P.horn };
  P.horn = false;
  // human test bots drop their oil on whoever is right behind
  if(r.pu.oil > 0 && G.racers.some(q => q.kind === 'rival' && r.y - q.y > 8 && r.y - q.y < 60)) out.horn = true;
  return out;
}
/* hot-heads cut you off; bosses do their trick (cones, oil, a weaving tow truck) */
function rivalTricks(r, P){
  const hs = humans().filter(h => !h.finished && !h.out);
  const behind = hs.filter(h => r.y - h.y > 10 && r.y - h.y < (r.boss ? 270 : 150)).sort((a, b) => b.y - a.y)[0];
  const d = D();
  if(r.pers.aggro > 0.5 && behind && d.aggro > 0 && Math.sin(G.raceT * 0.5 + r.id) > 0.2 && P.cost < 900){
    const hx = clamp(behind.x, cxAt(r.y) - hwAt(r.y) + 8, cxAt(r.y) + hwAt(r.y) - 8);
    P.tx = lerp(P.tx, hx, 0.8); if(r.msgT <= 0 && Math.abs(r.x - hx) < 8) say(r, r.pers.line, r.color, 1.4);
  }
  if(!r.boss || !behind || d.aggro <= 0) return;
  const trick = r.trick === 'all' ? ['cones', 'oil', 'tow'][Math.floor(G.raceT / 9) % 3] : r.trick;
  r.trickCd = (r.trickCd || 0) - 0.14;
  if(trick === 'tow' && r.y - behind.y < 150){
    // weave to block, but give up after a while so it stays fair
    r.blockT = (r.blockT || 0) + 0.14;
    if(r.blockT < 3.2){ P.tx = clamp(behind.x, cxAt(r.y) - hwAt(r.y) + 11, cxAt(r.y) + hwAt(r.y) - 11); P.boost = false; }
    else if(r.blockT > 7) r.blockT = 0;
  } else if((trick === 'cones' || trick === 'oil') && r.trickCd <= 0 && r.y - behind.y < 260){
    r.trickCd = (trick === 'cones' ? 2.1 : 3.2) / d.aggro;
    dropItem(trick === 'cones' ? 'cone' : 'oil', r.x + (Math.sin(G.raceT * 3) * 4), r.y - 20, r.id);
    if(r.msgT <= 0) say(r, trick === 'cones' ? 'CONES!' : 'OIL!', r.color, 0.8);
  }
}
function dropItem(k, x, y, own){
  G.items.push({ id: G.itemId++, k, x, y, t0: G.raceT, own });
  if(G.items.length > 24) G.items.shift();
  sfx(k === 'oil' ? 'oilDrop' : 'cone');
}

/* ---------- Physics ---------- */
function weatherGrip(){ const wx = RC.S.wx; return wx === 'storm' ? 0.78 : wx === 'snow' ? 0.84 : 1; }
function hitScale(r){ return isAssist(r, 'bigHit') ? 0.62 : 0.86; }
function stepRacer(r, dt){
  if(r.kind === 'ghost'){ stepGhost(r); return; }
  const C = RC, d = D();
  if(r.msgT > 0) r.msgT -= dt;
  if(r.finished){ r.v = Math.max(90, r.v - 70 * dt); r.y += r.v * dt; r.vx *= Math.pow(0.05, dt); r.x += (cxAt(r.y) + (r.x - cxAt(r.y)) * 0.98 - r.x); r.spinT = 0; return; }
  if(r.out){ r.v = Math.max(0, r.v - 120 * dt); r.y += r.v * dt; r.vx *= Math.pow(0.02, dt); r.x += r.vx * dt; return; }
  if(r.kind === 'rival' && !G.demo && offscreenRival(r, dt)) return;
  const cs = carStats(r), jun = isJunior(r), st = r.kind === 'human' ? statsOf(r) : null;
  let a;
  if(r.kind === 'human' && !(G.bot || r.bot || G.demo)) a = actions(r, humanInput(r), dt);
  else a = botDrive(r, dt);
  if(r.spinT > 0){ a = { steer: 0, boost: false, brake: false, horn: false }; }
  if(r.catchT > 0) r.catchT -= dt;
  if(r.invT > 0) r.invT -= dt;
  if(r.hornCd > 0) r.hornCd -= dt;
  if(r.hornT > 0) r.hornT -= dt;
  if(r.bumpCd > 0) r.bumpCd -= dt;
  for(const k in r.pu) if(k !== 'oil' && k !== 'shield' && r.pu[k] > 0) r.pu[k] = Math.max(0, r.pu[k] - dt);
  if(r.pu.shield > 0){ r.pu.shield -= dt; if(r.pu.shield <= 0) r.pu.shield = 0; }
  if(r.comboT > 0){ r.comboT -= dt; if(r.comboT <= 0) r.combo = 0; }
  if(r.chain && G.raceT - r.chainT > 1.8) endChain(r);
  // horn (or oil drop when you carry oil)
  if(a.horn && r.hornCd <= 0 && r.airT <= 0){
    r.hornCd = 0.45; r.hornT = 0.35; if(st) st.horns++;
    if(r.pu.oil > 0){ r.pu.oil--; dropItem('oil', r.x, r.y - 14, r.id); say(r, 'OIL DROP!', '#ffd45e', 0.8); }
    else { if(r.kind === 'human') sfxFor(r, 'horn'); else sfx('horn'); honk(r); }
  }
  // surface under the car
  const y = r.y, cx = cxAt(y), hw = hwAt(y), off = r.x - cx, side = sideAt(y);
  let surf = 'road';
  if(r.airT > 0) surf = 'air';
  else if(Math.abs(off) <= hw) surf = 'road';
  else if(side && Math.abs(r.x - side.x) <= side.hw) surf = 'side';
  else if(side && side.link > 0 && Math.sign(off) === C.side.s && Math.abs(off) < HW + 48) surf = 'gravel';
  else surf = 'grass';
  r.surf = surf;
  let grip = cs.grip * weatherGrip();
  if(r.iceT > 0){ r.iceT -= dt; grip *= 0.27; }
  if(r.oilT > 0){ r.oilT -= dt; grip *= 0.1; }
  if(r.sandT > 0) r.sandT -= dt;
  if(r.splashT > 0) r.splashT -= dt;
  // speed
  const outGas = !jun && r.fuel <= 0, outTime = clockOn(r) && r.clock <= 0;
  const rivalK = r.kind === 'rival' ? r.pers.spd * d.rival * rubberRival(r) : 1;
  const boosting = a.boost && !outGas && !outTime && r.spinT <= 0;
  let top = (boosting ? VHI * (0.95 + 0.05 * cs.boost) : VLO) * cs.top * rivalK;
  if(r.slip) top *= 1.07;
  if(r.catchT > 0) top *= 1.16;
  if(r.kind === 'human' && G.opts.rubber && !G.demo) top *= rubberHuman(r);
  if(G.diff === 'kids') top *= 0.9;
  if(surf === 'grass') top = Math.min(top, 104); else if(surf === 'gravel') top = Math.min(top, 175); else if(surf === 'side') top *= 1.04;
  if(r.sandT > 0) top = Math.min(top, 150);
  if(outGas || outTime){
    r.v = Math.max(0, r.v - 55 * dt);
    if(r.v < 3){ r.v = 0; r.out = outGas ? 'fuel' : 'time'; say(r, outGas ? 'OUT OF FUEL!' : "TIME'S UP!", '#ff8a6a', 3); sfxFor(r, 'outFuel'); if(r.kind === 'human') banner(driverOf(r).name.toUpperCase() + (outGas ? ' IS OUT OF FUEL' : ' RAN OUT OF TIME'), '', '#ff8a6a', 2.4); }
  } else if(a.brake){ r.v = Math.max(0, r.v - 360 * dt); if(st) st.brakeT += dt; }
  else if(r.v < top){ const acc = r.v < 120 ? 205 : boosting ? 60 * cs.boost + (r.v < VLO * cs.top ? 70 : 0) : 125; r.v = Math.min(top, r.v + acc * dt); }
  else r.v = Math.max(top, r.v - (surf === 'grass' ? 280 : 95) * dt);
  if(boosting && !r.boost && r.kind === 'human') sfxFor(r, 'boost');
  r.boost = boosting; r.brakeOn = !!a.brake;
  if(st && boosting) st.boostT += dt;
  // steering
  if(r.spinT > 0){
    r.spinT -= dt; r.ang += r.spinDir * 13 * dt; r.v = Math.max(55, r.v - 160 * dt); r.vx *= Math.pow(0.3, dt);
    if(r.spinT <= 0){ r.ang = 0; r.invT = Math.max(r.invT, 1.1); r.recovering = true; }
  } else {
    if(r.ang){ r.ang *= Math.pow(0.001, dt); if(Math.abs(r.ang) < 0.01) r.ang = 0; }
    const lat = 102 * (0.55 + 0.45 * Math.min(1, r.v / 180)) * (boosting ? 1.2 : 1);
    const acc = (boosting ? 540 : 760) * grip;
    if(a.steer && r.airT <= 0) r.vx += clamp(a.steer * lat - r.vx, -acc * dt, acc * dt);
    else if(r.airT <= 0) r.vx *= Math.exp(-(boosting ? 5.2 : 9) * grip * dt);
    if(r.airT > 0 && a.steer && Math.sign(a.steer) !== Math.sign(r.lastSteer || 0)){ r.twist++; }
    if(a.steer) r.lastSteer = a.steer;
  }
  if(r.recovering && r.v > 190){ r.recovering = false; if(st && G.raceT - r.lastCrashT < 5){ st.recover++; say(r, 'BACK UP TO SPEED!', '#7ff0b0', 1); } }
  // wind gusts on the bridges
  for(const g of C.gusts){ if(y > g.y0 && y < g.y1 && r.airT <= 0){ const ga = gustAt(g, G.raceT); r.x += ga.f * dt * (jun ? 0.5 : 1); } }
  // Kids / Junior: Widget the helper drone nudges you back onto the road
  if(jun && r.kind === 'human' && (surf === 'grass' || Math.abs(off) > hw - 3)){
    r.vx += -Math.sign(off) * 150 * dt;
    r.helpT = 1.2; if(r.msgT <= 0 && surf === 'grass'){ say(r, 'WIDGET: THIS WAY!', '#9fe8ff', 1.2); sfxFor(r, 'widget'); }
  }
  if(r.helpT > 0) r.helpT -= dt;
  r.x += r.vx * dt; r.y += r.v * dt;
  if(r.airT > 0){ r.airT -= dt; if(r.airT <= 0) land(r); }
  if(st){ st.driveT += dt; st.dist += r.v * dt; }
  // lane changes (Lane Dancer)
  if(st && surf === 'road'){ const ln = clamp(Math.floor((r.x - cxAt(r.y) + 50) / 25), 0, 3); if(ln !== r.lastLane){ r.lastLane = ln; st.lanes++; } }
  edges(r, dt, jun);
  // fuel
  if(r.kind === 'human' && !jun && !r.out){
    const use = (0.45 + r.v / VHI * 0.75 + (boosting ? 0.4 : 0)) * cs.eco * d.drain * (G.opts.rubber && rubberHuman(r) > 1 ? 0.82 : 1) * dt;
    r.fuel = Math.max(0, r.fuel - use); if(st){ st.fuelUsed += use; st.fuelT += dt; }
    if(r.fuel < r.fuelMax * 0.2 && r.fuel > 0){ r.lowT -= dt; if(r.lowT <= 0){ r.lowT = 1.3; sfxFor(r, 'lowfuel'); if(r.msgT <= 0) say(r, 'LOW FUEL!', '#ff8a6a', 0.9); } }
  }
  if(clockOn(r) && !r.out) r.clock -= dt;
  if(r.kind === 'human') humanWorld(r, dt, jun);
  else rivalWorld(r, dt);
  statics(r, jun);
  // checkpoints and the finish
  while(r.cp < C.cps.length && r.y >= C.cps[r.cp]) checkpoint(r);
  if(r.y >= C.len) finish(r);
}
/* rivals nobody can see race at a steady pace (they can't use the horn, so the traffic would hold them
   up unfairly); as soon as they are on anyone's road they drive for real */
function offscreenRival(r, dt){
  const hs = humans(); if(!hs.length) return false;
  const near = hs.some(h => Math.abs(h.y - r.y) < 330);
  if(near){ if(r.offT){ r.offT = 0; r.invT = Math.max(r.invT, 0.8); r.plan = null; } return false; }
  r.offT = (r.offT || 0) + dt;
  const want = 207 * r.pers.spd * D().rival * rubberRival(r) * (G.diff === 'kids' ? 0.9 : 1);
  r.v += clamp(want - r.v, -120 * dt, 60 * dt);
  for(const c of RC.cross){ const line = c.y - 11 - CAR_L / 2, dist = line - r.y; if(dist > 0 && dist < 60){ const cs = crossState(c, G.raceT); if(cs.closed || cs.warn) r.v = Math.min(r.v, dist * 2); } }
  const lane = LANES.reduce((b, l) => Math.abs(l - (r.x - cxAt(r.y))) < Math.abs(b - (r.x - cxAt(r.y))) ? l : b, LANES[1]);
  const lim = hwAt(r.y + 60) - 8, tx = cxAt(r.y) + clamp(lane, -lim, lim);
  r.x += clamp(tx - r.x, -40 * dt, 40 * dt); r.vx = 0; r.spinT = 0; r.ang = 0; r.boost = r.v > VLO; r.brakeOn = false;
  r.y += r.v * dt;
  while(r.cp < RC.cps.length && r.y >= RC.cps[r.cp]) r.cp++;
  if(r.y >= RC.len) finish(r);
  return true;
}
function honk(r){
  if(r.kind !== 'human') return;
  const C = RC, t = G.raceT, dm = dmapOf(r.id);
  for(const o of C.veh){
    if(o.beh === 'stop' || o.k === 'fuel') continue;
    vehAt(C, o.id, t); const dy = VP.y - r.y; if(dy < 8 || dy > 150) continue;
    const x = vehX(o, t, dm); if(Math.abs(x - r.x) > 36) continue;
    const ev = dm.get(o.id); if(ev && ev.d.length >= 2) continue;
    const cxv = cxAt(VP.y), h = hwAt(VP.y) - o.w / 2 - 2;
    let dir = x >= r.x ? 1 : -1;
    if(Math.abs(x - cxv + dir * LANE) > h) dir = -dir;
    if(Math.abs(x - cxv + dir * LANE) > h) continue;
    vent(['d', r.id, o.id, Math.round(t * 100) / 100, dir * LANE, 1]);
    if(o.beh === 'swerve' || o.beh === 'lc') pop('MOVE OVER!', x, VP.y + 10, '#ffe27a', 0, r.id);
  }
}
function land(r){
  r.airT = 0; sfxFor(r, 'land'); puff(r.x, r.y - 6, '#d9c7a0', 6, 10);
  if(r.kind !== 'human') return;
  const st = statsOf(r); st.air++;
  const mult = comboMult(r), twist = r.twist >= 2;
  const pts = (twist ? 300 : 150) * mult; r.score += pts; r.combo++; r.comboT = 3;
  if(twist) st.tricks++;
  say(r, (twist ? 'TWISTER! +' : 'BIG AIR! +') + pts, '#ffd45e', 1.2); sfxFor(r, 'trick');
  r.moments.push({ t: G.raceT, k: 'air', s: pts, label: twist ? 'Twister jump' : 'Big air' });
}
function comboMult(r){ return Math.min(5, 1 + Math.floor(r.combo / 2)); }
function endChain(r){
  const n = r.chain; r.chain = 0;
  if(r.kind !== 'human' || n < 6) return;
  const st = statsOf(r), pts = n * n * 5; r.score += pts; st.bestChain = Math.max(st.bestChain, n);
  say(r, 'CHAIN x' + n + '! +' + pts, '#7ff0b0', 1.3); sfxFor(r, 'chain');
  r.moments.push({ t: r.chainT - 1, k: 'chain', s: pts, label: n + ' cars in a row' });
}
/* road edges: walls on bridges and in tunnels, grass and scenery everywhere else */
function edges(r, dt, jun){
  const y = r.y, cx = cxAt(y), hw = hwAt(y), off = r.x - cx, st = r.kind === 'human' ? statsOf(r) : null;
  if(wallAt(y) && r.airT <= 0){
    const lim = hw - CAR_W / 2;
    if(Math.abs(off) > lim){
      const s = Math.sign(off); r.x = cx + s * lim; const hard = Math.abs(r.vx) > 45;
      r.vx = -s * Math.max(20, Math.abs(r.vx) * 0.35); r.v *= hard ? 0.9 : 0.985;
      if(!jun && r.kind === 'human') r.fuel = Math.max(0, r.fuel - (hard ? 0.8 : 0.1));
      if(r.bumpCd <= 0){ r.bumpCd = 0.4; if(st) st.scrapes++; sparks(r.x + s * 4, r.y, 5); if(r.kind === 'human'){ sfxFor(r, 'scrape'); say(r, jun ? 'BOING!' : 'SCRAPE!', '#ffcf8a', 0.6); } }
    }
    return;
  }
  const lim = hw + 64;
  if(Math.abs(off) > lim){
    const s = Math.sign(off); r.x = cx + s * (lim - 1); r.vx = -s * 50; r.v *= jun ? 0.8 : 0.6;
    if(!jun && r.kind === 'human') r.fuel = Math.max(0, r.fuel - 1.5);
    if(r.bumpCd <= 0){ r.bumpCd = 0.5; if(st) st.scrapes++; if(r.kind === 'human'){ sfxFor(r, jun ? 'boing' : 'bump'); say(r, jun ? 'BOING!' : 'BONK!', '#ffcf8a', 0.7); } }
  }
  if(r.surf === 'grass' && r.kind === 'human' && !jun) r.fuel = Math.max(0, r.fuel - 1.4 * dt);
}
function sparks(x, y, n){ for(let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80 + 30, t: 0, life: 0.35, col: Math.random() < 0.5 ? '#ffe27a' : '#ff9f40', r: 0.8 }); }
function crash(r, dir, why){
  const d = D(), jun = isJunior(r), st = r.kind === 'human' ? statsOf(r) : null;
  if(G.log && r.kind === 'human') G.log.push([Math.round(G.raceT * 10) / 10, why || 'x', Math.round(r.v), Math.round(r.y), r.invT > 0 ? 'inv' : '']);
  if(r.pu.shield > 0){ r.pu.shield = 0; r.invT = 1; say(r, 'SHIELD SAVED YOU!', '#9fe8ff', 1.2); if(r.kind === 'human') sfxFor(r, 'pop'); return false; }
  if(r.invT > 0) return false;
  if(jun || !d.spin){
    r.v *= 0.72; r.vx = dir * 90; r.invT = 0.7; say(r, 'BOING!', '#ffcf8a', 0.8);
    if(r.kind === 'human') sfxFor(r, 'boing'); if(st) st.scrapes++;
    return true;
  }
  r.spinT = 0.95; r.spinDir = dir || 1; r.v *= 0.36; r.invT = 2.1; r.combo = 0; r.comboT = 0; r.lastCrashT = G.raceT; r.slip = false;
  if(r.chain) endChain(r);
  if(r.kind === 'human'){ r.fuel = Math.max(0, r.fuel - d.crashFuel); st.crashes++; sfxFor(r, 'crash'); sfx('skid'); r.moments.push({ t: G.raceT, k: 'crash', s: 1, label: why || 'Crash' }); shake(r, 1); }
  else sfx('crash');
  say(r, 'CRASH!', '#ff8a6a', 1); sparks(r.x, r.y + 6, 10); puff(r.x, r.y, '#cfcfcf', 8, 10);
  return true;
}
function shake(r, k){ if(!G.opts.calm) r.shakeT = Math.max(r.shakeT || 0, 0.35 * k); }

/* traffic, pickups, near misses: the human's own road */
function humanWorld(r, dt, jun){
  const C = RC, t = G.raceT, dm = dmapOf(r.id), taken = takenOf(r.id), st = statsOf(r), hb = hitScale(r);
  let slipCand = null;
  for(const o of C.veh){
    vehAt(C, o.id, t); const vy = VP.y, dy = vy - r.y;
    if(dy > 150 || dy < -70){ if(r.nm.has(o.id)) r.nm.delete(o.id); continue; }
    const x = vehX(o, t, dm), gone = vehGone(o, t, dm);
    // lane changers cut in when you get close (their blinker flashes first)
    if(o.beh === 'lc' && dy > 40 && dy < 105 && !gone){ const ev = dm.get(o.id); if(!(ev && ev.lc) && r.v > vehSpeed(C, o.id, t) + 30){
      const cxv = cxAt(vy), h = hwAt(vy) - o.w / 2 - 2, dir = r.x > x ? 1 : -1;
      if(Math.abs(x - cxv + dir * LANE) <= h && Math.abs(r.x - x) > 6) vent(['d', r.id, o.id, Math.round((t + 0.55) * 100) / 100, dir * LANE, 2]);
      else vent(['l', r.id, o.id, 0, 0, 0]);
    } }
    if(gone) continue;
    if(o.k === 'fuel'){
      if(!taken.has('f' + o.id) && Math.abs(x - r.x) < (o.w + CAR_W) / 2 + 2 && Math.abs(dy) < (o.l + CAR_L) / 2 + 2 && r.airT <= 0){
        vent(['t', r.id, 'f' + o.id, 0, 0, 0]);
        const add = r.fuelMax * 0.55; r.fuel = Math.min(r.fuelMax, r.fuel + add); st.fuelPicks++; r.score += 200;
        say(r, 'FUEL UP!', '#7ff0b0', 1.3); sfxFor(r, 'fuel'); pop('+FUEL', r.x, r.y + 16, '#7ff0b0', 0, r.id);
      }
      continue;
    }
    // near misses and overtakes (you pass a car's rear bumper)
    const prev = r.nm.get(o.id);
    if(prev !== undefined && prev > 0 && dy <= 0 && r.spinT <= 0){
      st.overtakes++; r.score += 10;
      if(G.raceT - r.chainT < 1.8) r.chain++; else { if(r.chain) endChain(r); r.chain = 1; }
      r.chainT = G.raceT;
      const gap = Math.abs(x - r.x) - (o.w + CAR_W) / 2, tt = r.touch.get(o.id);
      if(gap < 6 && gap > -1 && !(tt !== undefined && G.raceT - tt < 1.2) && r.airT <= 0 && r.pu.ghost <= 0){
        r.combo++; r.comboT = 3; const pts = 50 * comboMult(r); r.score += pts; st.near++;
        say(r, 'NEAR MISS! +' + pts, '#9fe8ff', 0.9); sfxFor(r, 'near');
        if(r.combo >= 4) r.moments.push({ t: G.raceT, k: 'near', s: pts, label: 'Near-miss streak' });
      }
    }
    r.nm.set(o.id, dy);
    // slipstream behind trucks and buses
    if((o.k === 'truck' || o.k === 'bus' || o.k === 'plow' || o.k === 'camper') && dy > (o.l + CAR_L) / 2 + 2 && dy < (o.l + CAR_L) / 2 + 42 && Math.abs(x - r.x) < 6) slipCand = o;
    // contact
    if(r.airT > 0 || r.pu.ghost > 0) continue;
    const ox = (o.w + CAR_W * hb) / 2 - Math.abs(x - r.x), oy = (o.l + CAR_L * hb) / 2 - Math.abs(dy);
    if(ox <= 0 || oy <= 0) continue;
    r.touch.set(o.id, G.raceT);
    const s = r.x >= x ? 1 : -1;
    if(dy < -((o.l + CAR_L) / 2) * 0.55){ // it ran into us from behind (we stopped): it swerves round
      const ev = dm.get(o.id); if(!ev || !ev.d.length){ const cxv = cxAt(vy), h = hwAt(vy) - o.w / 2 - 2, dir = Math.abs(x - cxv - s * LANE) <= h ? -s : s; vent(['d', r.id, o.id, Math.round(t * 100) / 100, dir * LANE, 1]); }
      continue;
    }
    if(ox < oy * 0.55){                          // side contact: a scrape and a shove
      r.x += s * (ox + 0.4); r.vx = s * 75; r.v *= 0.95;
      if(r.bumpCd <= 0){ r.bumpCd = 0.35; st.scrapes++; sfxFor(r, 'scrape'); sparks(r.x - s * 5, r.y, 4); say(r, jun ? 'BOING!' : 'SCRAPE!', '#ffcf8a', 0.6); }
      continue;
    }
    const vv = vehSpeed(C, o.id, t), rel = r.v - vv;
    if(G.log && r.invT <= 0) G.log.push(['HIT', o.beh, o.k, Math.round(dy), Math.round(x - r.x), Math.round(VP.dx), Math.round(rel), r.plan ? Math.round(r.plan.off) : null, Math.round(r.x - cxAt(r.y)), Math.round(x - cxAt(vy)), r.plan && Math.round(r.plan.cost), Math.round(r.vx)]);
    if(rel > 70 || o.beh === 'stop'){
      if(crash(r, s, 'Hit a ' + (o.k === 'tractor' ? 'tractor' : o.k === 'truck' ? 'truck' : 'car'))){ vent(['b', r.id, o.id, Math.round(t * 100) / 100, -s, 0]); r.y = vy - (o.l + CAR_L) / 2 - 1; }
      else if(r.pu.shield <= 0){ r.y = vy - (o.l + CAR_L) / 2 - 1; r.v = Math.min(r.v, vv * 0.9); }
      else vent(['b', r.id, o.id, Math.round(t * 100) / 100, -s, 0]);
    } else { r.y = vy - (o.l + CAR_L) / 2 - 0.5; r.v = Math.min(r.v, Math.max(0, vv - 12)); if(r.bumpCd <= 0){ r.bumpCd = 0.4; sfxFor(r, 'bump'); say(r, 'BUMP!', '#ffcf8a', 0.5); } }
  }
  // slipstream
  if(slipCand && r.spinT <= 0){ r.slipT += dt; if(r.slipT > 0.7 && !r.slip){ r.slip = true; say(r, 'SLIPSTREAM!', '#9fe8ff', 1); sfxFor(r, 'slip'); } }
  else { r.slipT = 0; r.slip = false; }
  if(r.slip){ st.slipT += dt; r.score += 40 * dt; }
  // pickups
  const mag = r.pu.magnet > 0 ? 40 : 0;
  for(const c of C.coins){
    if(c.y < r.y - 30) continue; if(c.y > r.y + 60) break;
    const k = 'c' + c.id; if(taken.has(k)) continue;
    if(Math.abs(c.x - r.x) < 7 + mag && Math.abs(c.y - r.y) < 10 + mag){ vent(['t', r.id, k, 0, 0, 0]); r.score += 10; r.coins = (r.coins || 0) + 1; st.coins++; sfxFor(r, 'coin'); if(mag) coinFly(c.x, c.y, r); }
  }
  for(const p of C.pups){
    if(p.y < r.y - 30) continue; if(p.y > r.y + 60) break;
    const k = 'p' + p.id; if(taken.has(k)) continue;
    const reach = p.k === 'can' && mag ? mag : 0;
    if(Math.abs(p.x - r.x) < 9 + reach && Math.abs(p.y - r.y) < 11 + reach){ vent(['t', r.id, k, 0, 0, 0]); powerUp(r, p.k); }
  }
  // rivals bump you
  for(const q of G.racers){
    if(q.kind !== 'rival' || q.finished || q.out) continue;
    const ox = CAR_W + (q.boss ? 8 : 0) - Math.abs(q.x - r.x), oy = CAR_L - Math.abs(q.y - r.y);
    if(ox <= 0 || oy <= 0 || r.airT > 0 || r.pu.ghost > 0) continue;
    const s = r.x >= q.x ? 1 : -1, hot = q.pers.aggro > 0.5 && D().aggro > 0, k = jun ? 0.5 : hot ? 1.3 : 0.9;
    r.x += s * (ox / 2 + 0.3); q.x -= s * (ox / 2 + 0.3); r.vx = s * 80 * k; q.vx = -s * 55;
    if(Math.abs(q.y - r.y) > 8){ if(q.y > r.y){ r.v = Math.min(r.v, q.v - 8); r.y = q.y - CAR_L; } else { q.v = Math.min(q.v, r.v - 8); q.y = r.y - CAR_L; } }
    if(r.bumpCd <= 0){ r.bumpCd = 0.5; st.scrapes++; sfxFor(r, 'bump'); say(r, jun ? 'BOING!' : 'BUMPED BY ' + q.name.split(' ')[0].toUpperCase() + '!', '#ffcf8a', 0.8); }
  }
}
function coinFly(x, y, r){ parts.push({ x, y, vx: (r.x - x) * 6, vy: (r.y - y) * 6, t: 0, life: 0.16, col: '#ffd45e', r: 1.4 }); }
function powerUp(r, k){
  const st = statsOf(r); st.pups++;
  if(k === 'can'){ r.fuel = Math.min(r.fuelMax, r.fuel + 22); say(r, 'FUEL CAN! +FUEL', '#7ff0b0', 1); sfxFor(r, 'fuel'); r.score += 50; return; }
  sfxFor(r, k === 'ghost' ? 'ghost' : k === 'shield' ? 'shield' : 'power');
  if(k === 'shield') r.pu.shield = 25;
  else if(k === 'magnet') r.pu.magnet = 10;
  else if(k === 'ghost') r.pu.ghost = 3;
  else if(k === 'oil') r.pu.oil = 3;
  say(r, PUP_LABEL[k] + '!' + (k === 'oil' ? ' TAP TO DROP' : ''), '#ffd45e', 1.3); r.score += 100;
}
/* rivals: the shared traffic (no per-driver reactions) */
function rivalWorld(r, dt){
  const C = RC, t = G.raceT;
  if(r.airT > 0) return;
  for(const o of C.veh){
    if(o.k === 'fuel') continue;
    vehAt(C, o.id, t); const dy = VP.y - r.y; if(dy > 40 || dy < -40) continue;
    const x = vehX(o, t, null), w = r.boss ? 18 : CAR_W;
    const ox = (o.w + w) / 2 - Math.abs(x - r.x), oy = (o.l + CAR_L) / 2 - Math.abs(dy);
    if(ox <= 0 || oy <= 0 || dy < 0) continue;
    const vv = vehSpeed(C, o.id, t);
    if(ox < oy * 0.55){ r.x += (r.x >= x ? 1 : -1) * (ox + 0.3); r.v *= 0.97; continue; }
    if(r.v - vv > 80 && r.invT <= 0) crash(r, r.x >= x ? 1 : -1);
    r.y = VP.y - (o.l + CAR_L) / 2 - 0.5; r.v = Math.min(r.v, vv);
  }
}
/* fixed things on the road: cones, barrier boards, rocks, the crossing barrier, ramps, patches, dropped items */
function statics(r, jun){
  const C = RC, t = G.raceT, st = r.kind === 'human' ? statsOf(r) : null, hb = r.kind === 'human' ? hitScale(r) : 0.9;
  const taken = r.kind === 'human' ? takenOf(r.id) : null, ghost = r.pu.ghost > 0;
  if(r.airT <= 0 && !ghost){
    for(const c of C.cones){
      if(Math.abs(c.y - r.y) > 12 || Math.abs(c.x - r.x) > 9) continue;
      const k = 'k' + c.id; if(taken ? taken.has(k) : r.hitSet.has(k)) continue;
      if(taken) vent(['t', r.id, k, 0, 0, 0]); else r.hitSet.add(k);
      r.v *= jun ? 0.95 : 0.88; if(st){ st.cones++; if(!jun) r.fuel = Math.max(0, r.fuel - 0.5); sfxFor(r, 'cone'); say(r, 'CONE!', '#ffb14a', 0.5); }
    }
    for(const b of C.boards){
      if(Math.abs(b.y - r.y) > (b.h + CAR_L * hb) / 2 || Math.abs(b.x - r.x) > (b.w + CAR_W * hb) / 2) continue;
      const s = r.x >= b.x ? 1 : -1;
      if(r.v > 60 && crash(r, s, 'Hit the road works')){} else { r.v = Math.min(r.v, 30); }
      r.y = b.y - (b.h + CAR_L) / 2 - 0.5; if(r.v > 40) r.v = 40;
    }
    for(const k of C.rocks){
      if(hyp(k.x - r.x, (k.y - r.y) * 0.8) > k.r + CAR_W * hb * 0.5 + 1) continue;
      const s = r.x >= k.x ? 1 : -1;
      crash(r, s, 'Hit a rock'); r.y = k.y - k.r - CAR_L / 2 - 0.5; r.x += s * 2;
    }
    for(const it of G.items){
      if(it.own === r.id || Math.abs(it.y - r.y) > 9 || Math.abs(it.x - r.x) > 9) continue;
      const k = 'i' + it.id; if(r.hitSet.has(k)) continue; r.hitSet.add(k);
      if(it.k === 'cone'){ r.v *= jun ? 0.95 : 0.86; if(st){ st.cones++; sfxFor(r, 'cone'); } say(r, 'CONE!', '#ffb14a', 0.5); }
      else oilHit(r, jun);
    }
    for(const p of C.patches){
      if(p.y - r.y > p.ry + 6) break; if(r.y - p.y > p.ry + 6) continue;
      const u = (r.x - p.x) / (p.rx + 2), v = (r.y - p.y) / (p.ry + 4); if(u * u + v * v > 1) continue;
      if(p.k === 'ice'){ if(r.iceT <= 0 && st){ sfxFor(r, 'ice'); say(r, 'ICE!', '#bfe8ff', 0.6); } r.iceT = 0.3; }
      else if(p.k === 'sand'){ if(r.sandT <= 0){ if(st) sfxFor(r, 'sand'); } r.sandT = 0.3; if(Math.random() < 0.4) puff(r.x, r.y - 6, '#e3c48a', 1, 6); }
      else if(p.k === 'puddle'){ if(r.splashT <= 0){ r.splashT = 0.6; r.v *= 0.93; r.vx += (Math.sin(p.id * 7 + t) > 0 ? 1 : -1) * (RC.S.wx === 'storm' ? 55 : 35); if(st){ sfxFor(r, 'splash'); say(r, 'SPLASH!', '#9fd8ff', 0.5); } puff(r.x, r.y, '#bfe3ff', 6, 10); } }
      else if(p.k === 'oil'){ const k = 'o' + p.id + ':' + Math.floor(t / 3); if(!r.hitSet.has(k)){ r.hitSet.add(k); oilHit(r, jun); } }
    }
  }
  // ramps: big air (you fly over the traffic)
  if(r.airT <= 0) for(const g of C.ramps){
    if(Math.abs(g.y - r.y) > g.l / 2 + 2 || Math.abs(g.x - r.x) > g.w / 2 + 1) continue;
    r.airDur = r.airT = 0.42 + r.v / 800; r.twist = 0; r.lastSteer = 0; if(st) sfxFor(r, 'jump');
    break;
  }
  // level crossings: the barrier stops you
  for(const c of C.cross){
    const line = c.y - 11 - CAR_L / 2;
    if(r.y > line && r.y - r.v / 60 - 3 <= line){
      const cs = crossState(c, t);
      if(cs.closed || cs.u > c.period - 0.5){
        r.y = line - 0.5; if(r.v > 40 && r.kind === 'human'){ sfxFor(r, jun ? 'boing' : 'bump'); say(r, jun ? 'WAIT FOR THE TRAIN!' : 'BONK! WAIT!', '#ffcf8a', 1.2); if(!jun) r.fuel = Math.max(0, r.fuel - 1.5); if(st) st.scrapes++; }
        r.v = 0;
      }
    }
  }
}
function oilHit(r, jun){
  const st = r.kind === 'human' ? statsOf(r) : null;
  if(st) sfxFor(r, 'skid'); else sfx('skid');
  if(r.pu.shield > 0 || jun || !D().spin || r.v < 130){ r.oilT = 0.8; r.vx += (Math.random() < 0.5 ? -1 : 1) * 40; say(r, 'SLIPPY!', '#ffe27a', 0.6); return; }
  r.spinT = 0.6; r.spinDir = Math.random() < 0.5 ? -1 : 1; r.v *= 0.7; r.invT = 1.2; r.combo = 0; say(r, 'OIL SLICK!', '#ffe27a', 0.9);
  if(st){ st.crashes++; r.moments.push({ t: G.raceT, k: 'crash', s: 1, label: 'Oil slick spin' }); }
}
function checkpoint(r){
  const C = RC, i = r.cp, prevY = i ? C.cps[i - 1] : 0, seg = C.cps[i] - prevY;
  r.cp++;
  if(r.kind !== 'human') return;
  let sub = '';
  if(clockOn(r)){ const add = Math.round(nextSeg(i) / CLOCK_V * 1.2 * D().clock); r.clock += add; sub = ' +' + add + 's'; }
  r.score += 300; say(r, 'CHECKPOINT!' + sub, '#7ff0b0', 1.5); sfxFor(r, 'checkpoint');
  if(G.mode === 'relay' && r.crew.length > 1){
    r.drv = (r.drv + 1) % r.crew.length; r.relaySwaps++; r.fireWas = true; r.fireT = 1;
    banner('SWAP!', driverOf(r).name + ' takes the wheel', driverOf(r).color, 2);
  }
}
function nextSeg(i){ const C = RC, a = C.cps[i], b = i + 1 < C.cps.length ? C.cps[i + 1] : C.len; return b - a; }
function finish(r){
  r.finished = true; r.finishT = G.raceT; r.y = Math.max(r.y, RC.len);
  G.finishOrder.push(r.id);
  const pl = G.finishOrder.length;
  // a close finish: slow motion and a photo
  const close = G.racers.some(q => q !== r && q.kind !== 'ghost' && ((!q.finished && !q.out && r.y - q.y < 34 && r.y - q.y > -5) || (q.finished && q !== r && G.raceT - q.finishT < 0.25)));
  if(close && !G.demo && G.slowT <= 0){ G.slowT = 1.4; banner('PHOTO FINISH!', '', '#ffffff', 1.6); sfx('photo'); }
  if(r.kind === 'human'){
    const st = statsOf(r); st.finished = 1;
    const bonus = [1500, 1000, 700, 500, 400, 300, 200, 100][pl - 1] || 100;
    r.score += bonus + (isJunior(r) ? 0 : Math.round(r.fuel) * 5);
    say(r, pl === 1 ? 'WINNER!' : ordinal(pl).toUpperCase() + '!', pl === 1 ? '#ffd45e' : '#fff4d8', 3);
    sfxFor(r, 'finish');
    if(isJunior(r)){ for(let i = 0; i < 30; i++) parts.push({ x: r.x + (Math.random() - 0.5) * 30, y: r.y + 10, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 120, t: 0, life: 1.6, col: ['#ffd45e', '#ff7eb6', '#7aa8ff', '#7ff0b0'][i % 4], r: 1.2, conf: 1 }); say(r, 'YOU DID IT!', '#ffd45e', 3); }
  }
}
function rubberHuman(r){
  const hs = humans(); if(hs.length < 2 && !G.racers.some(q => q.kind === 'rival')) return 1;
  const lead = Math.max(...G.racers.filter(q => q.kind !== 'ghost').map(q => q.y));
  return lead - r.y > 300 ? 1.05 : 1;
}
function rubberRival(r){
  const hs = humans().filter(h => !h.out); if(!hs.length) return 1;
  const hmax = Math.max(...hs.map(h => h.y)), hmin = Math.min(...hs.map(h => h.y));
  if(r.boss && r.y - hmax > 280 && r.y < RC.len * 0.8) return 0.8;          // the boss hangs about just ahead, doing its trick
  if(r.y - hmax > 450) return 0.88;
  if(r.y - hmax > 220) return 0.95;
  if(hmin - r.y > 420) return 1.08;
  return 1;
}

/* ================= Race flow ================= */
const PICKS = A.Store.get('fulltank.picks', {});
function pickOf(src){ const k = String(src); let p = PICKS[k]; if(!p || !CARS[p.car]){ p = PICKS[k] = { car: 0, level: 'std' }; } if(!carUnlocked(p.car)) p.car = 0; if(!LEVELS.some(l => l.id === p.level)) p.level = 'std'; return p; }
function savePicks(){ const keep = {}; for(const k in PICKS) if(!k.includes('/')) keep[k] = PICKS[k]; A.Store.set('fulltank.picks', keep); }
function medalCount(){ const s = A.Medals.summary(GAME, STAGES.length); return s; }
function carUnlocked(i){ const c = CARS[i]; if(!c) return false; if(!c.need) return true; const m = medalCount(); return c.need.medals ? m.won >= c.need.medals : m.gold >= c.need.golds; }
function carNeed(c){ return !c.need ? '' : c.need.medals ? c.need.medals + ' medal' + (c.need.medals > 1 ? 's' : '') : c.need.golds + ' gold medals'; }
function liveryOf(ci){ const m = A.Store.get('fulltank.carLiv', {}); const id = m[CARS[ci].id]; return LIVERIES.some(l => l.id === id) && ownsLivery(id) ? id : 'plain'; }
function ownsLivery(id){ return id === 'plain' || A.Store.get('fulltank.liveries', []).includes(id); }
function wallet(){ return A.Store.get('fulltank.wallet', 0) | 0; }
const STAGE_PAR = [78, 82, 84, 86, 82, 90, 99];     // the test bot's Normal times (1 driver), a little over: tune after family play
const START_Y = [0, 0, -26, -26], START_X = [LANES[1], LANES[2], LANES[0], LANES[3]];

function setupRace(ps, seed){
  G.seed = seed; G.rid++;
  G.C = buildCourse(G.stage, G.diff, seed, G.mode); RC = G.C;
  G.racers = []; G.items = []; G.events = []; G.dodge = new Map(); G.taken = new Map(); G.fx = []; parts = []; skids = [];
  G.raceT = 0; G.slowT = 0; G.doneT = 0; G.banner = null; G.finishOrder = []; G.results = null; G.over = null; G.photo = null; G.replay = null; G.cheerT = 0;
  G.rec = { k: -1, runs: new Map() }; G.ghostRec = null;
  const C = G.C, d = D();
  const clock0 = Math.round(C.cps[0] / CLOCK_V * 1.32 * d.clock + 5);
  const mk = (list, i) => {
    const p0 = list[0], cs = G.opts.balanced ? BALANCED : CARS[p0.car || 0];
    const r = makeRacer({ kind: 'human', crew: list.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot, stats: newStats() })),
      name: list.map(p => p.name).join(' + '), color: p0.color, slot: p0.slot, car: p0.car || 0, livery: liveryOf(p0.car || 0), level: G.diff === 'kids' ? 'junior' : (p0.level || 'std'),
      x: START_X[i % 4], y: START_Y[i % 4], v: 0, bot: !!p0.bot });
    r.fuelMax = r.fuel = Math.round(100 * cs.tank); r.clock = clock0;
    G.racers.push(r); return r;
  };
  if(G.mode === 'relay' && ps.length) mk(ps, 0);
  else ps.forEach((p, i) => mk([p], i));
  const nh = G.racers.length;
  const ro = G.demo ? 'full' : G.mode === 'tt' ? 'off' : G.opts.rivals;
  if(ro === 'full'){
    const n = Math.max(G.demo ? 3 : 1, 4 - nh);
    for(let i = 0; i < n && i < RIVALS.length; i++){
      const R = RIVALS[(i + G.stage) % RIVALS.length];
      G.racers.push(makeRacer({ kind: 'rival', name: R.name, color: R.color, car: R.car, pers: R, x: [LANES[0], LANES[3], LANES[1], LANES[2]][i], y: i < 2 ? 30 : -54, livery: ['stripes', 'flames', 'stars', 'checker'][i] }));
    }
  }
  if(ro !== 'off'){
    const B = BOSSES[G.stage];
    G.racers.push(makeRacer({ kind: 'rival', boss: true, trick: B.trick, name: B.name, color: B.color, car: 5, pers: { name: B.name, spd: 1.01, aggro: 0.7, caution: 0.8, boost: 0.8, line: B.line }, x: 0, y: 64, livery: 'bolt' }));
  }
  if(G.mode === 'tt' && !G.demo){ const g = loadGhost(); if(g) G.racers.push(g); G.ghostRec = []; }
  G.racers.forEach(r => { if(r.kind === 'human') r.worst = G.racers.filter(q => q.kind !== 'ghost').length; });
}
function startDemo(){
  G.demo = true; G.players = [];
  const keepS = G.stage, keepD = G.diff, keepM = G.mode;
  G.stage = Math.floor(Math.random() * STAGES.length); G.diff = 'normal'; G.mode = 'quick';
  setupRace([{ source: 'demo', name: 'Rally Bot', color: pcol(0), slot: 0, car: Math.floor(Math.random() * CARS.length), bot: true }], Math.floor(Math.random() * 160000));
  G.demoStage = G.stage; G.stage = keepS; G.diff = keepD; G.mode = keepM;
}
function raceSeed(){
  if(G.mode === 'daily') return dailySpec().seed;
  if(G.code) return codeToSeed(G.code);
  if(G.mode === 'tt') return 7000 + G.stage * 1111;
  return Math.floor(Math.random() * 160000);
}
function newRace(players, seed){
  G.demo = false; G.players = players.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot, car: p.car || 0, level: p.level || 'std', bot: p.bot }));
  if(G.mode === 'daily') G.stage = dailySpec().stage;
  setupRace(G.players, seed !== undefined ? seed : raceSeed());
  G.state = 'count'; G.stateT = 0;
  A.Menu.close(); A.keepAwake();
  const S = STAGES[G.stage];
  banner(S.name.toUpperCase(), (G.mode === 'daily' ? 'Daily challenge ' + dailySpec().day : G.mode === 'tt' ? 'Time trial' : G.mode === 'relay' ? 'Team relay: swap at every checkpoint' : 'Course ' + G.C.code) + ' · ' + D().label, '#ffd45e', 3);
  A.toast(S.tip, 4200);
  sfx('startJingle');
}
function startChampionship(players){
  G.mode = 'champ';
  G.champ = { round: 0, stages: STAGES.map((s, i) => i).filter(i => i < G.unlocked), table: {}, rows: [] };
  G.stage = G.champ.stages[0]; newRace(players);
}
/* Drop-in: a new controller presses FIRE mid-race and starts at the back with a catch-up boost */
function dropIn(){
  if(G.demo || G.state !== 'race') return;
  const hum = humans(), people = hum.reduce((a, r) => a + r.crew.length, 0);
  if(people >= 4) return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || hum.some(r => r.crew.some(c => c.source === s.id))) continue;
    const used = G.players.map(p => p.slot), slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.players.map(p => p.name));
    const pk = pickOf(s.id), p = { source: s.id, name, color: pcol(slot), slot, car: pk.car, level: pk.level };
    G.players.push(p); G.players.sort((a, b) => a.slot - b.slot);
    if(G.mode === 'relay' && hum[0]){ hum[0].crew.push({ source: s.id, name, color: p.color, slot, stats: newStats() }); hum[0].name = hum[0].crew.map(c => c.name).join(' + '); banner(name.toUpperCase() + ' JOINS THE TEAM!', 'drives after the next swap', p.color, 2); S('join'); return; }
    const back = Math.max(0, Math.min(...hum.map(r => r.y)) - 60), cs = G.opts.balanced ? BALANCED : CARS[p.car];
    const r = makeRacer({ kind: 'human', crew: [{ source: s.id, name, color: p.color, slot, stats: newStats() }], name, color: p.color, slot, car: p.car, livery: liveryOf(p.car), level: G.diff === 'kids' ? 'junior' : p.level,
      x: cxAt(back) + LANES[1], y: back, v: 170, catchT: 6, invT: 2, fireWas: true, fireT: 1 });
    r.fuelMax = r.fuel = Math.round(100 * cs.tank); r.clock = Math.max(20, Math.max(...hum.map(h => h.clock)));
    while(r.cp < RC.cps.length && r.y >= RC.cps[r.cp]) r.cp++;
    r.worst = G.racers.filter(q => q.kind !== 'ghost').length + 1;
    G.racers.push(r);
    say(r, 'JOINED! CATCH-UP BOOST!', '#7ff0b0', 2.2);
    S('join');
    return;
  }
}
function updatePlaces(){
  const list = G.racers.filter(r => r.kind !== 'ghost');
  list.sort((a, b) => (a.finished && b.finished) ? a.finishT - b.finishT : a.finished ? -1 : b.finished ? 1 : b.y - a.y);
  const n = list.length;
  list.forEach((r, i) => {
    const was = r.place; r.place = i + 1;
    if(r.kind === 'human' && G.state === 'race'){
      r.worst = Math.max(r.worst || 0, r.place);
      if(was === n && r.place < n && n > 1 && G.raceT > 6 && G.time - G.cheerT > 6 && !r.finished){ G.cheerT = G.time; banner('GO, GO, GO!', driverOf(r).name + ' is off the bottom!', driverOf(r).color, 1.8); sfx('cheer'); }
    }
  });
}
/* hazard cues (a sign in the HUD and a beep for every hazard, so nothing relies on colour or sound alone) */
function buildCues(C){
  const q = [];
  for(const p of C.patches) if(p.k !== 'puddle') q.push({ y: p.y - p.ry, x: p.x, k: p.k });
  for(const w of C.works) q.push({ y: w.y0 - 70, x: cxAt(w.y0) + (w.side * HW + w.xb) / 2, k: 'works' });
  for(const c of C.cross) q.push({ y: c.y, x: null, k: 'cross', c });
  for(const b of C.bridges) q.push({ y: b.y0 - 100, x: null, k: 'bridge' });
  for(const t of C.tunnels) q.push({ y: t.y0, x: null, k: 'tunnel' });
  for(const g of C.gusts) q.push({ y: g.y0, x: null, k: 'wind' });
  for(const k of C.rocks) q.push({ y: k.y, x: k.x, k: 'rock' });
  if(C.side) q.push({ y: C.side.y0, x: cxAt(C.side.y0) + C.side.s * (HW + 30), k: 'side' });
  q.sort((a, b) => a.y - b.y); q.forEach((c, i) => { c.i = i; });
  return q;
}
const CUE_LABEL = { oil: 'OIL', ice: 'ICE', sand: 'SAND', works: 'ROAD WORKS', cross: 'TRAIN CROSSING', bridge: 'NARROW BRIDGE', tunnel: 'TUNNEL', wind: 'SIDE WIND', rock: 'ROCK', side: 'SHORTCUT' };
function cuesFor(r){
  const C = RC; if(!C.cues) C.cues = buildCues(C);
  const out = [], look = Math.max(160, r.v * 1.9);
  for(const c of C.cues){ const dy = c.y - r.y; if(dy < 0) continue; if(dy > look) break; out.push(c); if(out.length > 3) break; }
  return out;
}
function timeLeft(r){ return r.clock; }
function sim(dt){
  const C = RC;
  if(running()) G.raceT += dt;
  for(const r of G.racers) stepRacer(r, running() ? dt : 0);
  for(let i = G.items.length - 1; i >= 0; i--) if(G.raceT - G.items[i].t0 > 30) G.items.splice(i, 1);
  updatePlaces();
  if(G.demo){
    const h = G.racers.find(r => r.kind === 'human');
    if(G.raceT > 95 || (h && (h.finished && G.raceT - h.finishT > 3 || h.out))) startDemo();
    return;
  }
  // cues, bells and trains for the drivers on this screen (host); guests do their own in render
  for(const r of humans()){
    if(r.finished || r.out) continue;
    const cs = cuesFor(r);
    r.warned = r.warned || new Set();
    for(const c of cs){ if(!r.warned.has(c.i) && c.y - r.y < r.v * 1.7 + 40){ r.warned.add(c.i); sfxFor(r, c.k === 'cross' ? 'bell' : c.k === 'wind' ? 'gust' : 'warn'); } }
  }
  for(const c of C.cross){ const a = crossState(c, G.raceT), b = crossState(c, G.raceT - dt); if(a.closed && !b.closed && humans().some(r => Math.abs(r.y - c.y) < 500)) sfx('train'); }
  dropIn(); recordAll();
  if(G.state !== 'race') return;
  const hs = humans();
  if(hs.length && hs.every(r => r.finished || r.out) && !G.over){
    // give rivals close to the line a few seconds to finish, so the photo is a real photo finish
    G.doneT = G.doneT || G.raceT;
    const close = G.racers.some(q => q.kind === 'rival' && !q.finished && !q.out && q.y > C.len - 1300);
    if(!close || G.raceT - G.doneT > 6){ G.over = hs.some(r => r.finished) ? 'done' : 'out'; G.state = 'over'; G.stateT = 0; }
  }
  if(G.raceT > C.tT - 1 && !G.over){ for(const r of hs) if(!r.finished) r.out = 'time'; }
}

/* ---------- Ghost (time trial): the family's best run on this course ---------- */
function ghostKey(){ return 'fulltank.ghost.' + G.stage + '.' + G.seed + '.' + (G.diff === 'kids' ? 'kids' : 'std'); }
function loadGhost(){
  const g = A.Store.get(ghostKey(), null);
  if(!g || !Array.isArray(g.d) || g.d.length < 12) return null;
  return makeRacer({ kind: 'ghost', name: g.n + ' (ghost)', color: g.c || '#e9ecf1', gd: g.d, gt: g.t, car: g.car || 0, livery: g.liv || 'plain', x: g.d[0], y: g.d[1] });
}
function stepGhost(r){
  const d = r.gd, f = G.raceT / 0.1, k = Math.floor(f), u = f - k, n = d.length / 2;
  if(k >= n - 1){ r.x = d[(n - 1) * 2]; r.y = d[(n - 1) * 2 + 1] + (G.raceT - (n - 1) * 0.1) * 120; r.v = 120; r.finished = G.raceT >= r.gt; return; }
  const a = k * 2, b = a + 2;
  r.x = d[a] + (d[b] - d[a]) * u; r.y = d[a + 1] + (d[b + 1] - d[a + 1]) * u; r.v = (d[b + 1] - d[a + 1]) / 0.1;
}
/* recordings: the ghost (every 0.1 s) and every racer for the replay (every 0.05 s) */
function recordAll(){
  if(!G.rec || G.state !== 'race') return;
  const k = Math.floor(G.raceT / 0.05);
  if(k === G.rec.k) return;
  G.rec.k = k;
  for(const r of G.racers){
    if(r.kind === 'ghost') continue;
    let a = G.rec.runs.get(r.id); if(!a){ a = []; G.rec.runs.set(r.id, a); }
    a.push(Math.round(G.raceT * 100) / 100, Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10, Math.round(r.ang * 100) / 100, Math.round(r.v), (r.boost ? 1 : 0) | (r.airT > 0 ? 2 : 0) | (r.pu.shield > 0 ? 4 : 0) | (r.pu.ghost > 0 ? 8 : 0));
  }
  if(G.ghostRec && k % 2 === 0){ const h = humans()[0]; if(h && !h.finished){ const n = Math.floor(G.raceT / 0.1); while(G.ghostRec.length / 2 <= n) G.ghostRec.push(Math.round(h.x * 10) / 10, Math.round(h.y)); } }
}
function recAt(rid, t){
  const a = G.rec && G.rec.runs.get(rid); if(!a || !a.length) return null;
  let lo = 0, hi = a.length / 6 - 1;
  if(t <= a[0]) return { x: a[1], y: a[2], ang: a[3], v: a[4], f: a[5] };
  while(hi - lo > 1){ const m = (lo + hi) >> 1; if(a[m * 6] <= t) lo = m; else hi = m; }
  const i = lo * 6, j = hi * 6, u = a[j] > a[i] ? clamp((t - a[i]) / (a[j] - a[i]), 0, 1) : 0;
  return { x: a[i + 1] + (a[j + 1] - a[i + 1]) * u, y: a[i + 2] + (a[j + 2] - a[i + 2]) * u, ang: a[i + 3] + (a[j + 3] - a[i + 3]) * u, v: a[i + 4], f: a[i + 5] };
}

/* ---------- Results, medals, bests, unlocks ---------- */
const AWARD_DEFS = [
  { title: 'Daily Champion', stat: p => p.stats.daily, min: 1 },
  { title: 'Near-Miss King', stat: p => p.stats.near, min: 3 },
  { title: 'Smoothest Driver', stat: p => p.stats.crashes * 3 + p.stats.scrapes, low: true, min: 2, all: false },
  { title: 'Fuel Saver', stat: p => p.stats.fuelT > 20 ? Math.round(p.stats.fuelUsed / p.stats.fuelT * 100) : 999, low: true, min: 150 },
  { title: 'Boost Baron', stat: p => Math.round(p.stats.boostT), min: 15 },
  { title: 'Comeback Kid', stat: p => p.stats.gained, min: 2 },
  { title: 'Horn Hero', stat: p => p.stats.horns, min: 4 },
  { title: 'Best Crash Recovery', stat: p => p.stats.recover, min: 1 },
  { title: 'Lane Dancer', stat: p => p.stats.lanes, min: 25 },
  { title: 'Slipstream Surfer', stat: p => Math.round(p.stats.slipT), min: 3 },
  { title: 'Never Braked', stat: p => p.stats.finished && p.stats.brakeT < 0.05 ? 1 : 0, min: 1, all: true },
  { title: 'Pit-Stop Pro', stat: p => p.stats.fuelPicks, min: 2 },
  { title: 'Coin Collector', stat: p => p.stats.coins, min: 12 },
  { title: 'Chain Champ', stat: p => p.stats.bestChain, min: 6 },
  { title: 'High Flyer', stat: p => p.stats.air, min: 1, runnerUp: 'Air Time' },
  { title: 'Overtake Ace', stat: p => p.stats.overtakes, min: 20, runnerUp: 'Road Warrior' }
];
const PTS = [10, 8, 6, 5, 4, 3, 2, 1];
function medalFor(r){
  if(!r.finished) return null;
  const par = STAGE_PAR[G.stage] * D().par * (RC.len / STAGES[G.stage].len), t = r.finishT;
  if(G.diff === 'kids') return A.Medals.pick(t, { gold: par * 1.3, silver: par * 1.8 }, true) || 'bronze';
  return A.Medals.pick(t, { gold: par, silver: par * 1.12 }, true) || 'bronze';
}
function persons(){ const out = []; for(const r of humans()) for(const c of r.crew) out.push({ name: c.name, color: c.color, stats: c.stats, r }); return out; }
function finishRace(){
  const S = STAGES[G.stage], d = D(), hs = humans(), notes = [], si = G.stage, dk = G.diff === 'kids' ? 'kids' : 'std';
  updatePlaces();
  const all = G.racers.filter(r => r.kind !== 'ghost').sort((a, b) => a.place - b.place);
  const res = { notes, rows: [], why: G.over, medal: null, stage: si, code: RC.code };
  for(const r of all) res.rows.push({ id: r.id, name: r.name, color: r.color, human: r.kind === 'human', boss: !!r.boss, place: r.place, time: r.finished ? r.finishT : null, out: r.out, score: Math.round(r.score), car: r.car, livery: r.livery, dist: Math.round(Math.min(r.y, RC.len)) });
  for(const r of hs){ for(const c of r.crew) c.stats.gained = Math.max(0, (r.worst || r.place) - r.place); }
  // family coins
  const coins = hs.reduce((a, r) => a + (r.coins || 0), 0);
  if(coins){ A.Store.set('fulltank.wallet', wallet() + coins); res.coins = coins; }
  const carsBefore = CARS.filter((c, i) => carUnlocked(i)).length;
  // medal: the family's best finisher earns it for the stage
  const fin = hs.filter(r => r.finished).sort((a, b) => a.finishT - b.finishT);
  const best = fin[0];
  if(best){
    const medal = medalFor(best);
    if(medal){ const mr = A.Medals.award(GAME, 's' + (si + 1), G.diff, medal); res.medal = medal; res.medalImproved = mr.improved; }
    if(si + 2 > G.unlocked && G.unlocked < STAGES.length && si === G.unlocked - 1){ G.unlocked = si + 2; A.Store.set('fulltank.unlocked', G.unlocked); notes.push('New stage unlocked: <b>' + STAGES[G.unlocked - 1].name + '</b>!'); sfx('unlock'); }
    const bt = A.Celebrate.record(GAME, 'time.' + si + '.' + G.diff, Math.round(best.finishT * 10) / 10, true); res.bestTime = bt.isNew; res.bestT = best.finishT;
  }
  const top = hs.reduce((m, r) => Math.max(m, Math.round(r.score)), 0);
  if(top > 0){ const bs = A.Celebrate.record(GAME, 'score.' + si + '.' + G.diff, top, false); res.bestScore = bs.isNew; res.topScore = top; }
  const chain = Math.max(0, ...persons().map(p => p.stats.bestChain));
  if(chain >= 6){ const bc = A.Celebrate.record(GAME, 'chain', chain, false); res.bestChain = bc.isNew && chain; }
  const carsAfter = CARS.filter((c, i) => carUnlocked(i));
  if(carsAfter.length > carsBefore) notes.push('New car in the garage: <b>' + carsAfter[carsAfter.length - 1].name + '</b>!');
  // time trial: family top 5 and the ghost
  if(G.mode === 'tt' && best){
    const key = 'fulltank.tt.' + si + '.' + G.seed + '.' + dk, list = A.Store.get(key, []);
    list.push({ n: best.name, t: Math.round(best.finishT * 10) / 10 }); list.sort((a, b) => a.t - b.t); A.Store.set(key, list.slice(0, 5));
    const g = A.Store.get(ghostKey(), null);
    if((!g || best.finishT < g.t) && G.ghostRec && G.ghostRec.length > 12 && best === hs[0]){
      A.Store.set(ghostKey(), { t: best.finishT, n: best.name, c: best.color, car: best.car, liv: best.livery, d: G.ghostRec });
      notes.push('<b>' + A.esc(best.name) + '</b> is the new family ghost on ' + S.name + '!');
    }
    const rt = A.Celebrate.record(GAME, 'tt.' + si + '.' + G.seed + '.' + dk, Math.round(best.finishT * 10) / 10, true); res.bestTT = rt.isNew;
  }
  // daily challenge: the family board for today
  if(G.mode === 'daily'){
    const spec = dailySpec(); let db = A.Store.get('fulltank.daily', null);
    if(!db || db.date !== spec.day) db = { date: spec.day, runs: [] };
    const prevBest = db.runs.filter(x => x.t).sort((a, b) => a.t - b.t)[0];
    for(const r of hs) db.runs.push({ n: r.name, t: r.finished ? Math.round(r.finishT * 10) / 10 : 0 });
    db.runs = db.runs.sort((a, b) => (a.t || 999) - (b.t || 999)).slice(0, 12); A.Store.set('fulltank.daily', db);
    if(best && (!prevBest || best.finishT < prevBest.t)){ for(const c of best.crew) c.stats.daily = 1; notes.push('<b>' + A.esc(best.name) + '</b> leads the family today!'); }
    res.daily = db.runs;
  }
  // championship
  if(G.mode === 'champ' && G.champ){
    const c = G.champ; c.round++;
    for(const r of all){ const e = c.table[r.name] || (c.table[r.name] = { name: r.name, color: r.color, pts: 0, human: r.kind === 'human', stats: r.kind === 'human' ? newStats() : null });
      e.pts += (r.finished || r.kind === 'rival' ? PTS[r.place - 1] || 1 : 1) + (r.kind === 'human' ? 1 : 0);
      if(e.stats) for(const k in e.stats) e.stats[k] += r.crew[0].stats[k] || 0; }
    c.rows.push({ si, winner: all[0] && all[0].name, medal: res.medal || null });
  }
  // replay moment: the best overtake / jump, or the last crash, of the first finisher (or first driver)
  const star = best || hs[0];
  if(star){
    const m = star.moments.filter(x => x.k !== 'crash').sort((a, b) => b.s - a.s)[0] || star.moments.filter(x => x.k === 'crash').pop();
    if(m) res.moment = { rid: star.id, t0: Math.max(0, m.t - 2.2), t1: m.t + 1.8, label: m.label, name: star.name };
  }
  res.awards = A.Awards.pick(persons(), AWARD_DEFS, { max: 3 });
  G.results = res;
  // the photo finish
  const w = all.find(r => r.finished) || all[0];
  G.photo = { stage: si, rows: all.slice(0, 5).map(r => ({ name: r.name, color: r.color, car: r.car, livery: r.livery, human: r.kind === 'human', boss: !!r.boss,
    gap: r.finished && w && w.finished ? (r.finishT - w.finishT) : null, behind: r.finished ? 0 : Math.max(0, RC.len - r.y), x: (r.x - cxAt(RC.len)), time: r.finished ? r.finishT : null, place: r.place, out: r.out })) };
  // one big celebration (it goes to every online screen too)
  const cols = hs.map(r => r.color).concat(['#ffd45e']);
  if(res.bestTT) A.Celebrate.show({ title: 'NEW BEST!', sub: S.name + ' time trial in ' + fmt(best.finishT), colors: cols });
  else if(res.bestTime) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Fastest on ' + S.name + ': ' + fmt(best.finishT) + (res.medalImproved ? ' · ' + A.Medals.label(res.medal) + ' medal!' : ''), colors: cols });
  else if(res.medalImproved) A.Celebrate.show({ title: A.Medals.label(res.medal).toUpperCase() + ' MEDAL!', sub: S.name + ' · ' + d.label, colors: cols });
  else if(res.bestScore) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Top score ' + top.toLocaleString() + ' on ' + S.name, colors: cols });
  else if(res.bestChain) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Longest overtaking chain: ' + chain + ' cars', colors: cols });
  else if(G.diff === 'kids' && best) A.Celebrate.show({ title: 'YOU DID IT!', sub: S.name + ' · finished!', colors: cols });
}
function resultsMenu(){
  G.state = 'results'; G.replay = null; sfx('results');
  const res = G.results, S = STAGES[res.stage], hs = humans();
  const winner = res.rows[0];
  const title = res.why === 'out' ? 'Out of the race!' : winner && winner.human ? winner.name + ' wins!' : winner ? winner.name + ' wins' : 'Race over';
  let text = res.rows.map(x => '<b style="color:' + x.color + '">' + ordinal(x.place) + ' ' + A.esc(x.name) + '</b> ' + (x.time !== null ? fmt(x.time) : x.out === 'fuel' ? 'out of fuel' : x.out === 'time' ? 'out of time' : Math.round(x.dist / RC.len * 100) + '%') + (x.human ? ' · ' + x.score.toLocaleString() + ' pts' : '')).join('<br>');
  if(res.medal) text += '<br>' + A.Medals.html(res.medal) + ' <b>' + A.Medals.label(res.medal) + ' medal</b>' + (res.medalImproved ? ' · new!' : '');
  const nb = [res.bestTime && 'fastest time', res.bestTT && 'time trial', res.bestScore && 'top score', res.bestChain && 'longest chain'].filter(Boolean);
  if(nb.length) text += (res.medal ? ' · ' : '<br>') + '<b>New best:</b> ' + nb.join(', ');
  if(res.coins) text += '<br>+' + res.coins + ' coins for the family garage (' + wallet() + ' in the jar)';
  if(res.notes.length) text += '<br>' + res.notes.join('<br>');
  if(G.mode === 'tt'){ const list = A.Store.get('fulltank.tt.' + res.stage + '.' + G.seed + '.' + (G.diff === 'kids' ? 'kids' : 'std'), []); if(list.length) text += '<br>Family best times: ' + list.map((e, i) => (i + 1) + '. ' + A.esc(e.n) + ' ' + fmt(e.t)).join(' · '); }
  if(res.daily) text += '<br>Today’s family board: ' + res.daily.filter(x => x.t).slice(0, 5).map((e, i) => (i + 1) + '. ' + A.esc(e.n) + ' ' + fmt(e.t)).join(' · ');
  text += '<br>Course code <b>' + res.code + '</b> (type it in to race this exact course again)';
  text += '<br><br>' + A.Awards.html(res.awards);
  const again = () => newRace(G.players, G.mode === 'tt' || G.mode === 'daily' || G.code ? undefined : G.seed);
  let items;
  const replay = res.moment ? [{ label: 'Watch replay: ' + res.moment.label, select: () => startReplay(res.moment) }] : [];
  if(G.mode === 'champ' && G.champ){
    const c = G.champ, over = c.round >= c.stages.length;
    text += '<br><br><b>Championship after ' + c.round + ' of ' + c.stages.length + '</b>: ' + champTable().slice(0, 5).map(e => A.esc(e.name) + ' ' + e.pts).join(' · ');
    items = (over ? [{ label: 'See the champion', select: championMenu }]
      : [{ label: 'Next stage: ' + STAGES[c.stages[c.round]].name, select: () => { G.stage = c.stages[c.round]; newRace(G.players); } }])
      .concat(replay, [{ label: 'Quit championship', select: () => { G.champ = null; hosting() ? openLobby(null) : toTitle(); } }]);
  } else {
    const next = (G.stage + 1) % G.unlocked;
    items = [{ label: G.mode === 'tt' ? 'Try again' : G.mode === 'daily' ? 'Race it again (practice)' : 'Race again (same course)', select: again }]
      .concat(G.mode === 'daily' ? [] : [{ label: 'Next stage: ' + STAGES[next].name, select: () => { G.stage = next; A.Store.set('fulltank.stage', G.stage); newRace(G.players); } }])
      .concat(replay, [{ label: hosting() ? 'Back to room lobby' : 'Change drivers', select: () => openLobby(null) }], hosting() ? [] : [{ label: 'Quit to title', select: toTitle }]);
  }
  A.Menu.open({ center: true, shared: true, kicker: S.name + ' · ' + MODES.find(m => m.id === G.mode).label + ' · ' + D().label, title, text, items });
}
function champTable(){ return Object.values(G.champ.table).sort((a, b) => b.pts - a.pts); }
function championMenu(){
  const c = G.champ, tab = champTable(), champ = tab[0];
  G.state = 'champion'; G.stateT = 0;
  const humanTop = tab.find(e => e.human);
  if(humanTop){ const rec = A.Celebrate.record(GAME, 'champ.' + G.diff, humanTop.pts, false); if(rec.isNew) c.best = true; }
  A.Celebrate.show({ title: champ.human ? 'CHAMPION!' : 'CHAMPIONSHIP OVER!', sub: champ.name + ' · ' + champ.pts + ' points', colors: G.players.map(p => p.color).concat(['#ffd45e', '#ffffff']) });
  const rows = tab.map((e, i) => '<b style="color:' + e.color + '">' + ordinal(i + 1) + ' ' + A.esc(e.name) + '</b> ' + e.pts + ' pts').join('<br>');
  const stages = c.rows.map(r => (r.medal ? A.Medals.html(r.medal) + ' ' : '') + STAGES[r.si].short + ': ' + A.esc(r.winner || '')).join(' · ');
  const ps = tab.filter(e => e.human && e.stats);
  A.Menu.open({ center: true, shared: true, kicker: 'Championship · ' + D().label, title: champ.human ? champ.name + ' is the champion!' : champ.name + ' takes the crown',
    text: rows + '<br><br>' + stages + (c.best ? '<br><b>New family best championship!</b>' : '') + '<br><br>' + A.Awards.html(A.Awards.pick(ps, AWARD_DEFS, { max: 3 })),
    items: [
      { label: 'New championship', select: () => startChampionship(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change drivers', select: () => { G.champ = null; openLobby(null); } },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: () => { G.champ = null; toTitle(); } }])
    ] });
}
function startReplay(m){
  A.Menu.close();
  G.replay = { rid: m.rid, t0: m.t0, t1: m.t1, t: m.t0, label: m.label, name: m.name };
  G.state = 'replay'; G.stateT = 0;
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
function stageLine(i){ const m = A.Medals.get(GAME, 's' + (i + 1)); return (i + 1) + ' · ' + STAGES[i].name + (m ? ' · ' + A.Medals.label(m) : ''); }
function medalBoard(){
  return STAGES.map((s, i) => i < G.unlocked ? (A.Medals.html(A.Medals.get(GAME, 's' + (i + 1))) || '<span class="medal" style="opacity:.25;border:1px solid currentColor;border-radius:50%"></span>') : '<span title="locked" style="opacity:.6">🔒</span>').join(' ');
}
function cycle(list, cur, d){ const i = Math.max(0, list.findIndex(o => o.id === cur)); return list[(i + d + list.length) % list.length].id; }
function titleMenu(start){
  G.state = 'title';
  const md = G.mode, touch = A.Input.isTouch;
  const startLabel = { quick: 'Race', champ: 'Start the championship', tt: 'Start time trial', relay: 'Start the relay', daily: 'Race today’s challenge' }[md];
  const items = [
    { label: startLabel, select: src => openLobby(src) },
    { label: 'Play online', select: src => onlineMenu(src) },
    { label: 'Mode', value: () => MODES.find(m => m.id === G.mode).label, change: d => { G.mode = cycle(MODES, G.mode, d); A.Store.set('fulltank.mode', G.mode); titleMenu(2); } }
  ];
  if(md !== 'champ' && md !== 'daily') items.push({ label: 'Stage', value: () => stageLine(G.stage), change: d => { G.stage = (G.stage + d + G.unlocked) % G.unlocked; A.Store.set('fulltank.stage', G.stage); } });
  if(md === 'daily') items.push({ label: 'Today', value: () => { const sp = dailySpec(); return STAGES[sp.stage].short + ' · code ' + seedToCode(sp.seed); }, change: () => {} });
  items.push({ label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('fulltank.diff', G.diff); } });
  if(md === 'quick' || md === 'tt' || md === 'relay') items.push({ label: 'Course code', value: () => G.code || 'Random', select: () => codeMenu(items.length), change: () => { if(G.code){ G.code = ''; A.Store.set('fulltank.code', ''); } else codeMenu(); } });
  if(md !== 'tt') items.push({ label: 'Rivals', value: () => RIVAL_OPTS.find(o => o.id === G.opts.rivals).label, change: d => { G.opts.rivals = cycle(RIVAL_OPTS, G.opts.rivals, d); saveOpts(); } });
  items.push(
    { label: 'Garage', select: () => garageMenu(0) },
    { label: 'Options & assists', select: () => optionsMenu(0, () => titleMenu(0)) },
    { label: 'More…', select: () => moreMenu() });
  A.Menu.open({ kicker: 'xRetro', title: 'FULL TANK RALLY', start: start || 0,
    text: 'Race down the long road, thread the traffic and catch the <b>rainbow fuel truck</b> before your tank runs dry. <b>' + (touch ? 'Tap BOOST' : 'Tap FIRE') + '</b> honks the horn, <b>hold</b> it to boost. ' +
          '<span class="medal-row">' + medalBoard() + '</span>',
    items, footer: bestLine() });
}
function moreMenu(){
  const back = () => titleMenu(0);
  A.Menu.open({ center: true, kicker: 'Full Tank Rally', title: 'More', items: [
    { label: 'How to play', select: () => helpMenu(moreMenu) },
    { label: 'Family bests', select: () => bestsMenu(moreMenu) },
    { label: 'Settings', select: () => settingsMenu(moreMenu) },
    { label: 'All games', select: () => { location.href = 'index.html'; } },
    { label: 'Back', select: back }], back });
}
function codeMenu(){
  A.TextEntry.open({ kicker: 'Course code', title: 'Type a course code', text: 'Four letters, like a room code. The same code and stage always build the same road, traffic and pickups.', value: '', max: 4, letters: true,
    onDone: v => { G.code = v; A.Store.set('fulltank.code', v); titleMenu(0); }, onCancel: () => titleMenu(0) });
}
function bestLine(){
  const n = A.Input.pads().length, s = G.stage;
  const tm = A.Store.get('best.' + GAME + '.time.' + s + '.' + G.diff, null);
  const locked = STAGES.length - G.unlocked;
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') +
    (tm ? 'Best on ' + STAGES[s].short + ': ' + fmt(tm) + '. ' : '') + (locked ? locked + ' stage' + (locked > 1 ? 's' : '') + ' locked: finish a stage to open the next. ' : '') + 'Coin jar: ' + wallet() + '.';
}
function bar(v){ const n = clamp(Math.round((v - 0.6) / 0.8 * 8), 1, 8); return '▮'.repeat(n) + '<span style="opacity:.3">' + '▮'.repeat(8 - n) + '</span>'; }
function garageMenu(start){
  const cm = A.Store.get('fulltank.carLiv', {}), m = medalCount();
  const lines = CARS.map((c, i) => carUnlocked(i)
    ? '<b>' + c.name + '</b>: ' + c.desc + '<br><small>Speed ' + bar(c.top * 1.2 - 0.2) + ' Grip ' + bar(c.grip) + ' Tank ' + bar(c.tank) + ' Boost ' + bar(c.boost) + ' Thrift ' + bar(1.6 - c.eco * 0.6) + '</small>'
    : '🔒 <b>' + c.name + '</b>: unlock with ' + carNeed(c) + ' (you have ' + (c.need.medals ? m.won : m.gold) + ')');
  const items = CARS.map((c, i) => ({ label: c.name + ' livery', dim: !carUnlocked(i), value: () => carUnlocked(i) ? LIVERIES.find(l => l.id === liveryOf(i)).name : 'locked',
    change: d => { if(!carUnlocked(i)) return; const own = LIVERIES.filter(l => ownsLivery(l.id)); const cur = own.findIndex(l => l.id === liveryOf(i)); cm[c.id] = own[(cur + d + own.length) % own.length].id; A.Store.set('fulltank.carLiv', cm); } }));
  for(const l of LIVERIES) if(!ownsLivery(l.id)) items.push({ label: 'Buy ' + l.name + ' (' + l.cost + ' coins)', select: () => {
    if(wallet() < l.cost){ A.toast('The coin jar has ' + wallet() + '. Collect coins on the road!'); return; }
    A.Store.set('fulltank.wallet', wallet() - l.cost); A.Store.set('fulltank.liveries', A.Store.get('fulltank.liveries', []).concat([l.id])); sfx('unlock'); A.toast(l.name + ' is yours! Pick it for any car.'); garageMenu(0); } });
  items.push({ label: 'Back', select: () => titleMenu(0) });
  A.Menu.open({ center: true, kicker: 'Garage · coin jar ' + wallet(), title: 'Garage', start,
    text: lines.join('<br>') + '<br><br>Each driver picks a car in the lobby with <b>◀ ▶</b>. Liveries are bought with coins from the road; everyone keeps their own colour. <b>Car stats: ' + (G.opts.balanced ? 'Balanced' : 'per car') + '</b> (change it in Options).',
    items, back: () => titleMenu(0) });
}
function optionsMenu(start, back){
  const onoff = v => v ? 'On' : 'Off';
  const who = [{ id: 'assist', label: 'Assist drivers' }, { id: 'all', label: 'Everyone' }, { id: 'off', label: 'Off' }];
  const set = (k, v) => { G.opts[k] = v; saveOpts(); };
  A.Menu.open({ center: true, kicker: 'Options', title: 'Assists & accessibility', start,
    text: 'Mixed ages? Each driver picks <b>Standard</b>, <b>Assist</b> (auto-steer, bigger margin for error) or <b>Junior</b> (no fuel worries, bumps just bounce, Widget the helper drone) in the lobby with <b>▼</b>.',
    items: [
      { label: 'Rubber-band (help the back)', value: () => onoff(G.opts.rubber), change: () => set('rubber', !G.opts.rubber) },
      { label: 'Car stats', value: () => G.opts.balanced ? 'Balanced (all the same)' : 'Per car', change: () => set('balanced', !G.opts.balanced) },
      { label: 'Auto-steer assist', value: () => who.find(o => o.id === G.opts.autoSteer).label, change: d => set('autoSteer', cycle(who, G.opts.autoSteer, d)) },
      { label: 'Big-hitbox forgiveness', value: () => who.find(o => o.id === G.opts.bigHit).label, change: d => set('bigHit', cycle(who, G.opts.bigHit, d)) },
      { label: 'Boost button', value: () => G.opts.boostMode === 'hold' ? 'Hold' : 'Toggle', change: () => set('boostMode', G.opts.boostMode === 'hold' ? 'toggle' : 'hold') },
      { label: 'Colour-blind colours', value: () => onoff(G.opts.cb), change: () => set('cb', !G.opts.cb) },
      { label: 'Reduced motion', value: () => onoff(G.opts.calm), change: () => set('calm', !G.opts.calm) },
      { label: 'Large HUD text', value: () => onoff(G.opts.bigHud), change: () => set('bigHud', !G.opts.bigHud) },
      { label: 'Back', select: back }
    ], back });
}
function bestsMenu(back){
  const lines = STAGES.map((s, i) => {
    const m = A.Medals.get(GAME, 's' + (i + 1));
    const tm = DIFF_ORDER.map(dk => { const v = A.Store.get('best.' + GAME + '.time.' + i + '.' + dk, null); return v ? DIFF[dk].label + ' ' + fmt(v) : ''; }).filter(Boolean).join(', ');
    const sc = A.Store.get('best.' + GAME + '.score.' + i + '.normal', null);
    const tt = A.Store.get('fulltank.tt.' + i + '.' + (7000 + i * 1111) + '.std', [])[0];
    return (i < G.unlocked ? '' : '🔒 ') + (m ? A.Medals.html(m) + ' ' : '') + '<b>' + s.name + '</b>' + (tm ? ' · ' + tm : '') + (sc ? ' · ' + sc.toLocaleString() + ' pts' : '') + (tt ? ' · time trial: ' + A.esc(tt.n) + ' ' + fmt(tt.t) : '');
  });
  const ch = A.Store.get('best.' + GAME + '.chain', null), cp = A.Store.get('best.' + GAME + '.champ.normal', null);
  const db = A.Store.get('fulltank.daily', null), dl = db && db.date === today() ? db.runs.filter(x => x.t).slice(0, 5) : [];
  A.Menu.open({ center: true, kicker: 'Full Tank Rally', title: 'Family bests',
    text: lines.join('<br>') + '<br><br>' + (ch ? 'Longest overtaking chain: <b>' + ch + '</b><br>' : '') + (cp ? 'Best championship (Normal): <b>' + cp + ' pts</b><br>' : '') +
      (dl.length ? 'Today’s challenge: ' + dl.map((e, i) => (i + 1) + '. ' + A.esc(e.n) + ' ' + fmt(e.t)).join(' · ') + '<br>' : '') + 'Coin jar: <b>' + wallet() + '</b>',
    items: [{ label: 'Back', select: back }], back });
}
/* the lobby: FIRE joins, ◀ ▶ picks your car, ▼ picks your driver level */
const baseSlotModel = A.Lobby.slotModel.bind(A.Lobby);
A.Lobby.slotModel = function(x){
  const m = baseSlotModel(x);
  if(G.state === 'lobby'){ const pk = pickOf(x.source); m.label = '◀ ' + CARS[pk.car].name + ' ▶' + (G.diff === 'kids' ? '' : ' · ' + LEVELS.find(l => l.id === pk.level).label) + ' · ' + m.label; }
  return m;
};
/* online guests: net.js labels your own lobby card "This device"; put your car back on it */
const baseMirrorShow = A.Mirror.show.bind(A.Mirror);
A.Mirror.show = function(ui){
  baseMirrorShow(ui);
  try{
    if(ui && ui.lobby && this.layer){
      const cards = this.layer.querySelectorAll('.slot');
      ui.lobby.slots.forEach((s, i) => { if(s && Net.isMine(s.src) && cards[i]){ const e = cards[i].querySelector('.slot-src'); if(e && /◀/.test(s.label)) e.textContent = s.label.split(' · ').slice(0, -1).join(' · ') + ' · This device'; } });
    }
  }catch(e){}
};
function lobbyPicks(){
  if(!A.Lobby.isOpen() || A.TextEntry.isOpen()) return;
  let ch = false;
  for(const s of A.Input.all()){
    const slot = A.Lobby.slots.find(x => x.source === s.id); if(!slot || slot.ready) continue;
    const pk = pickOf(s.id), d = A.Input.pressed(s, 'right') ? 1 : A.Input.pressed(s, 'left') ? -1 : 0;
    if(d){ let c = pk.car; for(let k = 0; k < CARS.length; k++){ c = (c + d + CARS.length) % CARS.length; if(carUnlocked(c)) break; } pk.car = c; ch = true; A.Sound.play('select'); }
    if(A.Input.pressed(s, 'down') && G.diff !== 'kids'){ pk.level = cycle(LEVELS, pk.level, 1); ch = true; A.Sound.play('select'); }
  }
  if(ch){ savePicks(); A.Lobby.render(); }
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting(), md = G.mode, S = STAGES[md === 'daily' ? dailySpec().stage : G.stage];
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + (md === 'champ' ? 'Championship · ' + G.unlocked + ' stages' : S.name) + ' · ' + MODES.find(m => m.id === md).label + ' · ' + D().label,
    title: md === 'relay' ? 'Who is on the team?' : 'Who is driving?',
    text: (online ? 'Friends join from any device with the code or invite link. ' : '') + 'Everyone presses FIRE to join, then FIRE again when ready. <b>◀ ▶</b> picks your car' + (G.diff === 'kids' ? '.' : ', <b>▼</b> your driver level (Standard, Assist, Junior).') +
      (md === 'relay' ? ' One car, one tank: the wheel passes on at every checkpoint.' : ' 1 to 4 drivers, one road each, same course and traffic. More can drop in mid-race.'),
    min: 1, max: 4, colors: G.opts.cb ? PAL_CB : PAL_STD, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => { players.forEach(p => { const pk = pickOf(p.source); p.car = pk.car; p.level = pk.level; }); if(G.mode === 'champ') startChampionship(players); else newRace(players); },
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'race' && G.state !== 'count') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart race', select: () => newRace(G.players, G.seed) }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Options & assists', select: () => optionsMenu(0, pauseAgain) });
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: STAGES[G.stage].name + ' · course ' + RC.code, title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'race'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'race'; }
function toTitle(){
  A.Menu.close(); A.Lobby.close(); A.Mirror.hide(); buf.clear();
  if(G.net) Net.close();
  G.net = null; G.champ = null; G.replay = null;
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
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 drivers from any mix of devices, each on their own road with the same course and traffic.',
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
    Net.host(GAME, name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, GAME, name, netHandlers).then(() => {
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
  const t = A.Input.isTouch, F = t ? 'BOOST' : 'FIRE';
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to drive',
    text: 'The car drives itself forward. <b>' + (t ? 'Stick left/right' : 'Left/right') + '</b> steers. <b>Hold ' + F + '</b> (or ' + (t ? 'stick up' : 'UP') + ') = high gear: faster, thirstier and twitchier. <b>' + (t ? 'Stick down' : 'DOWN') + '</b> brakes. <b>Tap ' + F + '</b> = horn: swerving cars and lane-hoppers move over.<br>' +
      'Your <b>fuel</b> drains all the time (faster when boosting). Drive into the <b>rainbow fuel truck</b> to fill up; fuel cans help too. Empty tank = you roll to a stop.<br>' +
      'Hitting traffic <b>spins you out</b> (costs fuel and speed). Grass slows you. <b>Checkpoints</b> add time to your clock; reach the finish before it runs out.<br>' +
      'Pass cars <b>close without touching</b> = NEAR MISS (combo x2…x5). Pass lots in a row = CHAIN bonus. Sit behind a truck = SLIPSTREAM. Ramps = big air (steer left-right in the air for a TWISTER).<br>' +
      'Hazards: oil spins you, ice has no grip, puddles and sand slow you, trains close the crossing (stop at the red lights!), road works close lanes, wind pushes you on bridges. A sign at the top of your road warns you of each one.<br>' +
      'Power-ups: <b>Shield</b> (saves one crash), <b>Magnet</b> (pulls in coins), <b>Oil drop</b> (tap to leave oil for the rivals), <b>Ghost</b> (drive through traffic for 3 s), <b>Fuel can</b>.<br>' +
      '<b>Kids / Junior:</b> no fuel worries, bumps just bounce, and Widget the helper drone steers you back onto the road.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0;
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onRename(id, name){ for(const r of G.racers) if(r.crew) for(const c of r.crew) if(c.source === id){ c.name = name; if(r.crew.length === 1) r.name = name; } const p = G.players.find(x => x.source === id); if(p) p.name = name; },
  onMessage(m){ if(m.t === 's'){ if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx); if(m.fx) for(const f of m.fx) G.fx.push({ text: f[0], x: f[1], y: f[2], col: f[3], big: f[4], rid: f[5] || 0, t: 0 }); buf.push(m); } }
};
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const OUTS = ['', 'fuel', 'time'];
function sendSnap(){
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), rt: r2(G.raceT), sg: G.demo ? G.demoStage : G.stage, d: G.demo ? 'normal' : G.diff, sd: G.seed, md: G.demo ? 'quick' : G.mode, dm: G.demo ? 1 : 0, rid: G.rid,
    sl: G.slowT > 0 ? 1 : 0, cb: G.opts.cb ? 1 : 0,
    bn: G.banner ? [G.banner.text, G.banner.sub, G.banner.col, r2(G.banner.t - (G.time - G.banner.at))] : null,
    ev: G.events.filter(e => G.raceT - (e.a[3] || 0) < 3 || e.q > G.evSeq - 24).map(e => [e.q].concat(e.a)),
    it: G.items.map(i => [i.id, i.k, r1(i.x), r1(i.y), i.own]),
    r: G.racers.map(r => {
      const f = (r.kind === 'human' ? 1 : 0) | (r.kind === 'rival' ? 2 : 0) | (r.kind === 'ghost' ? 4 : 0) | (r.boost ? 8 : 0) | (r.airT > 0 ? 16 : 0) | (r.spinT > 0 ? 32 : 0) | (r.finished ? 64 : 0) | (r.out ? 128 : 0) |
        (r.brakeOn ? 256 : 0) | (r.slip ? 512 : 0) | (isJunior(r) ? 1024 : 0) | (r.boss ? 2048 : 0) | (r.helpT > 0 ? 4096 : 0) | (r.hornT > 0 ? 8192 : 0) | (r.catchT > 0 ? 16384 : 0) | (r.invT > 0 && r.spinT <= 0 ? 32768 : 0);
      return [r.id, r1(r.x), r1(r.y), Math.round(r.v), r2(r.ang), f, r1(r.fuel), r1(r.clock), r.cp, r.place, r.name, r.color, r.car, r.livery,
        r.crew ? r.crew.map(c => c.source).join('|') : '', r.kind === 'human' ? driverOf(r).name : '', r.msgT > 0 ? r.msg : '', r2(r.msgT), r.msgCol, Math.round(r.score), comboMult(r), r2(r.finishT), OUTS.indexOf(r.out || ''),
        r.pu.shield > 0 ? 1 : 0, r1(r.pu.magnet), r1(r.pu.ghost), r.pu.oil, r.slot || 0, r.coins || 0, r1(r.shakeT || 0), Math.round(r.fuelMax), r.airDur > 0 ? r2(r.airT / r.airDur) : 0, r.drv || 0, r.chain || 0, r.level || 'std'];
    }) };
  if(G.state === 'photo' && G.photo) s.ph = G.photo;
  if(G.replay) s.rp = [G.replay.rid, r2(G.replay.t), G.replay.label, G.replay.name];
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  if(netFx.length){ s.fx = netFx; netFx = []; }
  Net.broadcast(s);
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, Lp = (x, y) => x + (y - x) * t;
  if(!G.C || G.C.si !== s.sg || G.C.seed !== s.sd || G.C.diff !== s.d || G.C.mode !== s.md || G.gRid !== s.rid){
    G.C = buildCourse(s.sg, s.d, s.sd, s.md); RC = G.C; G.gRid = s.rid; G.dodge = new Map(); G.taken = new Map(); G.lastQ = 0; parts = []; skids = [];
    G.rec = { k: -1, runs: new Map() };
  }
  RC = G.C;
  const same = a.rid === b.rid;
  G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.diff = s.d; G.stage = s.sg; G.mode = s.md; G.seed = s.sd; G.opts.cb = !!s.cb;
  if(G.demo) G.demoStage = s.sg;
  G.raceT = same && a.st === b.st ? Lp(a.rt, b.rt) : b.rt;
  G.banner = s.bn ? { text: s.bn[0], sub: s.bn[1], col: s.bn[2], t: s.bn[3], at: G.time } : null;
  for(const e of s.ev || []) if(e[0] > (G.lastQ || 0)){ applyEvent(e.slice(1)); G.lastQ = e[0]; }
  G.items = (s.it || []).map(q => ({ id: q[0], k: q[1], x: q[2], y: q[3], own: q[4] }));
  G.photo = s.ph || (G.state === 'photo' ? G.photo : null);
  G.replay = s.rp ? { rid: s.rp[0], t: s.rp[1], label: s.rp[2], name: s.rp[3] } : null;
  const prev = new Map(same ? a.r.map(q => [q[0], q]) : []), old = new Map(G.racers.map(r => [r.id, r]));
  G.racers = s.r.map(q => {
    const o = prev.get(q[0]), near = o && Math.abs(o[2] - q[2]) < 80, f = q[5], was = old.get(q[0]);
    const r = was || makeRacer({ id: q[0] });
    Object.assign(r, { x: near ? Lp(o[1], q[1]) : q[1], y: near ? Lp(o[2], q[2]) : q[2], v: q[3], ang: q[4], kind: f & 1 ? 'human' : f & 2 ? 'rival' : 'ghost',
      boost: !!(f & 8), airT: f & 16 ? 1 : 0, spinT: f & 32 ? 1 : 0, finished: !!(f & 64), out: f & 128 ? (OUTS[q[22]] || 'fuel') : null, brakeOn: !!(f & 256), slip: !!(f & 512), jun: !!(f & 1024), boss: !!(f & 2048), helpT: f & 4096 ? 1 : 0, hornT: f & 8192 ? 1 : 0, catchT: f & 16384 ? 1 : 0, invT: f & 32768 ? 1 : 0,
      fuel: q[6], clock: q[7], cp: q[8], place: q[9], name: q[10], color: q[11], car: q[12], livery: q[13], srcs: q[14] ? q[14].split('|') : [], drvName: q[15], msg: q[16], msgT: q[17], msgCol: q[18],
      score: q[19], mult: q[20], finishT: q[21], pu: { shield: q[23], magnet: q[24], ghost: q[25], oil: q[26] }, slot: q[27], coins: q[28], shakeT: q[29], fuelMax: q[30], airU: q[31], drv: q[32], chain: q[33], level: q[34] });
    if(r.kind === 'human' && (!r.crew || r.crew.length !== r.srcs.length)) r.crew = r.srcs.map((src, i) => ({ source: src, name: i === r.drv ? r.drvName : '', color: r.color, stats: newStats() }));
    if(r.crew && r.crew[r.drv]) r.crew[r.drv].name = r.drvName;
    return r;
  });
  // the guest keeps its own recording for replays
  if(G.state === 'race'){ const k = Math.floor(G.raceT / 0.05); if(k !== G.rec.k){ G.rec.k = k; for(const r of G.racers){ if(r.kind === 'ghost') continue; let arr = G.rec.runs.get(r.id); if(!arr){ arr = []; G.rec.runs.set(r.id, arr); } arr.push(r2(G.raceT), r1(r.x), r1(r.y), r2(r.ang), r.v, (r.boost ? 1 : 0) | (r.airT ? 2 : 0) | (r.pu.shield ? 4 : 0) | (r.pu.ghost ? 8 : 0)); } } }
  // guests pick up coins and cones on their own screen straight away (the host's events confirm them)
  for(const r of G.racers){
    if(r.kind !== 'human') continue;
    const tk = takenOf(r.id), mag = r.pu.magnet > 0 ? 40 : 0;
    for(const c of RC.coins){ if(c.y < r.y - 20) continue; if(c.y > r.y + 50) break; if(Math.abs(c.x - r.x) < 7 + mag && Math.abs(c.y - r.y) < 10 + mag) tk.add('c' + c.id); }
    guestCues(r);
  }
}
function guestCues(r){
  if(!Net.isMine(driverOf(r).source) || r.finished || r.out || G.state !== 'race') return;
  r.warned = r.warned || new Set();
  for(const c of cuesFor(r)) if(!r.warned.has(c.i) && c.y - r.y < r.v * 1.7 + 40){ r.warned.add(c.i); playSx(c.k === 'cross' ? 'bell' : c.k === 'wind' ? 'gust' : 'warn'); }
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  if(G.demo || G.state === 'title' || G.state === 'lobby' || G.state === 'online') want = A.THEMES.menu;
  else if(G.state === 'photo' || G.state === 'results' || G.state === 'champion' || G.state === 'replay') want = MUSIC.podium;
  else if(G.C) want = MUSIC[STAGES[G.stage].music];
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(G.state === 'paused' || G.state === 'count' || G.state === 'replay');
}
function myRacers(){
  return humans().filter(r => { const src = String(driverOf(r).source || ''); return G.net === 'guest' ? Net.isMine(src) : !src.includes('/'); });
}
function engine(){
  const mine = myRacers()[0];
  const on = !G.demo && !!mine && (G.state === 'race' || G.state === 'count') && !mine.out;
  Engine.set(mine ? mine.v : 0, mine && mine.boost, on);
}
function step(dt){
  G.time += dt;
  const playing = G.state === 'race' || G.state === 'count';
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = playing && myRacers().some(r => driverOf(r).source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('BOOST'); }
    Net.setPlaying(playing);
    music(); engine(); return;
  }
  const wantTouch = playing && humans().some(r => r.crew.some(c => c.source === 'touch'));
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('BOOST'); }
  music(); engine();
  if(Net) Net.setPlaying(playing);
  hostStep(dt);
  if(G.net === 'host'){ Net.hostTick(); if(++netStep % 2 === 0 && Net.hasGuests()) sendSnap(); }
}
function hostStep(dt){
  if(A.Lobby.isOpen()){ lobbyPicks(); A.Lobby.update(); sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); G.stateT += dt; if(G.demo) sim(dt); else if(G.state === 'results' || G.state === 'champion') coolDown(dt); return; }
  if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
  const pausePressed = A.Input.all().some(s => A.Input.pressed(s, 'pause') && (s.kind !== 'net' || humans().some(r => r.crew.some(c => c.source === s.id))));
  let sdt = dt;
  if(G.slowT > 0){ G.slowT -= dt; sdt = dt * 0.3; }
  switch(G.state){
    case 'count':
      if(pausePressed){ pause(); return; }
      { const before = G.stateT; G.stateT += dt; for(let i = 0; i < 3; i++){ const at = 0.6 + i * 0.8; if(before < at && G.stateT >= at) S('countdown'); } }
      if(G.stateT >= 3){ G.state = 'race'; S('go'); }
      sim(0); break;
    case 'race':
      if(pausePressed){ pause(); return; }
      sim(sdt); break;
    case 'over':
      G.stateT += dt; sim(sdt);
      if(G.stateT > 1.8){ finishRace(); G.state = 'photo'; G.stateT = 0; sfx('photo'); }
      break;
    case 'photo':
      G.stateT += dt; coolDown(dt);
      if(G.stateT > 4 || (G.stateT > 1 && A.Input.all().some(s => A.Input.pressed(s, 'fire')))) resultsMenu();
      break;
    case 'replay': {
      const R = G.replay; if(!R){ resultsMenu(); break; }
      const mid = Math.abs(R.t - (R.t1 - 1.8)) < 0.9;
      R.t += dt * (mid ? 0.35 : 0.8);
      if(R.t >= R.t1 || A.Input.all().some(s => A.Input.pressed(s, 'fire') || A.Input.pressed(s, 'back'))) resultsMenu();
      break; }
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
/* after the finish: everyone rolls on past the line */
function coolDown(dt){
  for(const r of G.racers){ if(r.kind === 'ghost') continue; r.v = Math.max(0, r.v - 90 * dt); r.y += r.v * dt; r.vx *= Math.pow(0.05, dt); r.x += r.vx * dt; r.spinT = 0; r.ang *= Math.pow(0.01, dt); if(r.msgT > 0) r.msgT -= dt; }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || (G.state !== 'race' && G.state !== 'count') || G.net === 'guest') return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);
function rng(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function text(c, str, x, y, size, color, align, base){ c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y); }
function outlined(c, str, x, y, size, color, align, font){
  c.font = size + 'px ' + (font || FONT); c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(1.2, size / 4); c.lineJoin = 'round'; c.strokeStyle = 'rgba(12,10,20,.9)'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
const RGB = new Map();
function rgb(hex){ let v = RGB.get(hex); if(!v){ const n = parseInt(hex.slice(1), 16); v = [n >> 16, n >> 8 & 255, n & 255]; RGB.set(hex, v); } return v; }
function shade(hex, k){ const [r, g, b] = rgb(hex), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
function ell(c, x, y, rx, ry, rot){ c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); }
function rr(c, x, y, w, h, r){ r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function line(c, x1, y1, x2, y2){ c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function star(c, x, y, R){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); c.fill(); }

/* ---------- Particles, skid marks (world coordinates, shared by every strip) ---------- */
let parts = [], skids = [];
function puff(x, y, col, n, spread){ if(G.opts.calm) n = Math.ceil(n / 2); for(let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.5, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 30, t: 0, life: 0.5 + Math.random() * 0.4, col, r: 1.5 + Math.random() * 1.5, grow: 1 }); }
function fxStep(dt){
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if(p.conf){ p.vy -= 140 * dt; p.vx *= 0.98; } }
  parts = parts.filter(p => p.t < p.life); if(parts.length > 400) parts.splice(0, parts.length - 400);
  for(const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < 1.1);
  if(G.state !== 'race' && G.state !== 'over') return;
  for(const r of G.racers){
    if(r.kind === 'ghost' || r.airT > 0 || r.finished) continue;
    const skid = r.spinT > 0 || (r.oilT > 0) || (r.brakeOn && r.v > 120) || (r.iceT > 0 && Math.abs(r.vx) > 40);
    const lastK = 'sk' + r.id, prev = skidMem.get(lastK);
    if(skid){ if(prev) for(const s of [-3.5, 3.5]) skids.push({ x1: prev.x + s, y1: prev.y - 6, x2: r.x + s, y2: r.y - 6, t: G.time }); skidMem.set(lastK, { x: r.x, y: r.y }); }
    else skidMem.delete(lastK);
    if(r.surf === 'grass' && r.v > 60 && Math.random() < 0.3) puff(r.x, r.y - 8, RC.S.wx === 'snow' ? '#ffffff' : '#9c8a5a', 1, 6);
    if(r.boost && Math.random() < 0.5 && !G.opts.calm) parts.push({ x: r.x + (Math.random() - 0.5) * 4, y: r.y - 10, vx: 0, vy: -40, t: 0, life: 0.25, col: Math.random() < 0.5 ? '#ffb347' : '#fff2a8', r: 1.1 });
  }
  if(skids.length > 360) skids.splice(0, skids.length - 360);
}
const skidMem = new Map();

/* ---------- Sprites: cars drawn once per look and size, then stamped ---------- */
const SPR = new Map();
function sprite(key, w, h, px, draw){
  let s = SPR.get(key);
  if(!s){
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * px)); cv.height = Math.max(1, Math.ceil(h * px));
    const c = cv.getContext('2d'); c.setTransform(px, 0, 0, px, 0, 0); c.translate(w / 2, h / 2); draw(c);
    s = { cv, w, h }; SPR.set(key, s);
    if(SPR.size > 600){ const k0 = SPR.keys().next().value; SPR.delete(k0); }
  }
  return s;
}
function stamp(c, s, x, y, rot, alpha){
  if(alpha !== undefined) c.globalAlpha = alpha;
  if(rot){ c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(s.cv, -s.w / 2, -s.h / 2, s.w, s.h); c.restore(); }
  else c.drawImage(s.cv, x - s.w / 2, y - s.h / 2, s.w, s.h);
  if(alpha !== undefined) c.globalAlpha = 1;
}
/* a player or rival car, pointing up (the direction of travel) */
function drawCar(c, shape, col, liv){
  const W = shape === 'buggy' ? 9.4 : shape === 'bubble' ? 9 : shape === 'muscle' ? 10.4 : 10, L = shape === 'van' ? 18 : shape === 'bubble' ? 14 : shape === 'sports' ? 18 : 17;
  const x = -W / 2, y = -L / 2, body = liv === 'chrome' ? '#e8c14a' : col;
  c.fillStyle = 'rgba(0,0,0,.28)'; rr(c, x + 0.8, y + 1.2, W, L, 3); c.fill();
  c.fillStyle = '#1c1c22'; for(const wy of [y + 2.5, y + L - 5.5]) for(const wx of [x - 0.9, x + W - 1.4]) rr(c, wx, wy, 2.3, 3.6, 0.8), c.fill();
  c.fillStyle = body;
  if(shape === 'bubble'){ ell(c, 0, 0, W / 2, L / 2); c.fill(); }
  else if(shape === 'sports'){ c.beginPath(); c.moveTo(-W / 2 + 1.5, y); c.lineTo(W / 2 - 1.5, y); c.lineTo(W / 2, y + 6); c.lineTo(W / 2, y + L - 1.5); c.lineTo(-W / 2, y + L - 1.5); c.lineTo(-W / 2, y + 6); c.closePath(); c.fill(); rr(c, x, y + L - 3, W, 3, 1); c.fill(); }
  else { rr(c, x, y, W, L, shape === 'van' ? 1.6 : 3); c.fill(); }
  if(liv === 'chrome'){ const g = c.createLinearGradient(x, 0, x + W, 0); g.addColorStop(0, '#fff3b0'); g.addColorStop(0.5, '#c9971e'); g.addColorStop(1, '#fff0a0'); c.fillStyle = g; rr(c, x + 0.6, y + 0.6, W - 1.2, L - 1.2, 2.5); c.fill(); }
  // livery
  c.save(); rr(c, x, y, W, L, 3); c.clip();
  if(liv === 'stripes'){ c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(-2, y, 1.2, L); c.fillRect(0.8, y, 1.2, L); }
  else if(liv === 'flames'){ c.fillStyle = '#ff6a1a'; for(let i = 0; i < 3; i++){ c.beginPath(); c.moveTo(x + i * W / 3, y + 1); c.lineTo(x + i * W / 3 + W / 6, y + 7 + (i % 2) * 2); c.lineTo(x + (i + 1) * W / 3, y + 1); c.fill(); } c.fillStyle = '#ffd23a'; for(let i = 0; i < 3; i++){ c.beginPath(); c.moveTo(x + i * W / 3 + 0.8, y + 1); c.lineTo(x + i * W / 3 + W / 6, y + 4.5); c.lineTo(x + (i + 1) * W / 3 - 0.8, y + 1); c.fill(); } }
  else if(liv === 'stars'){ c.fillStyle = '#ffffff'; star(c, -2, y + 4, 1.4); star(c, 2.2, y + L - 4, 1.2); star(c, 2, y + 3, 0.8); }
  else if(liv === 'checker'){ for(let i = 0; i < 4; i++) for(let j = 0; j < 3; j++){ c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(-3 + i * 1.5, -1.5 + j * 1.5, 1.5, 1.5); } }
  else if(liv === 'bolt'){ c.fillStyle = '#ffe14a'; c.beginPath(); c.moveTo(1.5, y + 1); c.lineTo(-2, y + L * 0.5); c.lineTo(0.5, y + L * 0.5); c.lineTo(-1.5, y + L - 1); c.lineTo(2.8, y + L * 0.42); c.lineTo(0.3, y + L * 0.42); c.closePath(); c.fill(); }
  else if(liv === 'polka'){ c.fillStyle = 'rgba(255,255,255,.85)'; for(let i = 0; i < 7; i++){ circ(c, x + 1.5 + rng(i + 3) * (W - 3), y + 1.5 + rng(i + 9) * (L - 3), 0.8); c.fill(); } }
  c.restore();
  // glass, roof, lights
  c.fillStyle = 'rgba(20,30,50,.85)';
  if(shape === 'buggy'){ c.fillStyle = '#2a2a2a'; rr(c, x + 1.8, y + 5.5, W - 3.6, 6, 1); c.fill(); c.strokeStyle = '#d9d9d9'; c.lineWidth = 0.8; line(c, x + 1.5, y + 11, x + W - 1.5, y + 11); c.fillStyle = '#f1c8a0'; circ(c, 0, y + 8.4, 1.4); c.fill(); }
  else if(shape === 'van'){ rr(c, x + 1, y + 1.5, W - 2, 3, 1); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; rr(c, x + 1.3, y + 5.5, W - 2.6, L - 7.5, 1); c.fill(); }
  else { rr(c, x + 1.2, y + (shape === 'sports' ? 5 : 3.6), W - 2.4, 3.2, 1.2); c.fill(); rr(c, x + 1.6, y + L - 5.2, W - 3.2, 2, 0.8); c.fill(); c.fillStyle = shade(body.startsWith('#') ? body : '#888888', 1.12); rr(c, x + 1.6, y + (shape === 'sports' ? 8.4 : 7), W - 3.2, L - (shape === 'sports' ? 14 : 12.4), 1.2); c.fill(); }
  if(shape === 'muscle'){ c.fillStyle = '#222'; rr(c, -1.2, y + 1, 2.4, 2.2, 0.5); c.fill(); }
  if(shape === 'ev'){ c.fillStyle = '#7ff7ff'; c.fillRect(x + 1, y + 0.4, W - 2, 0.7); }
  c.fillStyle = '#fff6c8'; c.fillRect(x + 1, y + 0.2, 2, 1); c.fillRect(x + W - 3, y + 0.2, 2, 1);
  c.fillStyle = '#ff3b3b'; c.fillRect(x + 1, y + L - 1.1, 2, 0.9); c.fillRect(x + W - 3, y + L - 1.1, 2, 0.9);
}
function carSprite(shape, col, liv, px){ const k = 'C' + shape + col + liv + Math.round(px * 4); return sprite(k, 16, 22, px, c => drawCar(c, shape, col, liv)); }
/* traffic vehicles */
function drawVeh(c, k, col, w, l){
  const x = -w / 2, y = -l / 2;
  c.fillStyle = 'rgba(0,0,0,.28)'; rr(c, x + 1, y + 1.4, w, l, 2.5); c.fill();
  c.fillStyle = '#1c1c22'; for(const wy of [y + 2.5, y + l - 5.5]) for(const wx of [x - 0.8, x + w - 1.5]) { rr(c, wx, wy, 2.3, 3.6, 0.8); c.fill(); }
  if(k === 'truck' || k === 'fuel' || k === 'plow' || k === 'tow'){
    const cab = k === 'fuel' ? 8 : 9;
    c.fillStyle = k === 'fuel' ? '#e8eef5' : k === 'tow' ? '#f2c14e' : col; rr(c, x + 0.5, y, w - 1, cab, 2); c.fill();
    c.fillStyle = 'rgba(20,30,50,.85)'; rr(c, x + 1.5, y + 1.8, w - 3, 2.6, 1); c.fill();
    if(k === 'fuel'){
      c.fillStyle = '#dfe6ee'; rr(c, x, y + cab + 1, w, l - cab - 1, w / 2); c.fill();
      const cols = ['#ff5a5a', '#ffae3a', '#ffe14a', '#5ee07a', '#4fb8ff', '#b77cff'];
      cols.forEach((cc, i) => { c.fillStyle = cc; c.fillRect(x + 1, y + cab + 3 + i * 2.3, w - 2, 1.6); });
      c.fillStyle = '#ffffff'; c.font = '3px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(0, y + l - 3.5); c.fillText('FUEL', 0, 0); c.restore();
    } else if(k === 'plow'){
      c.fillStyle = '#ff8c1a'; rr(c, x + 1, y + cab + 1, w - 2, l - cab - 1, 1.5); c.fill(); c.fillStyle = '#c9d2dc'; c.beginPath(); c.moveTo(x - 2, y - 1); c.lineTo(x + w + 2, y - 1); c.lineTo(x + w, y + 2); c.lineTo(x, y + 2); c.fill();
      c.fillStyle = '#ffd45e'; c.fillRect(-1.5, y + 4.5, 3, 1.3);
    } else if(k === 'tow'){
      c.fillStyle = '#3a3a44'; rr(c, x + 2, y + cab + 1, w - 4, l - cab - 1, 1); c.fill(); c.strokeStyle = '#9aa2ad'; c.lineWidth = 1.2; line(c, 0, y + cab + 2, 0, y + l + 2); c.fillStyle = '#ff9f1c'; c.fillRect(x + 2, y + 4.5, 3, 1.2); c.fillRect(x + w - 5, y + 4.5, 3, 1.2);
    } else {
      c.fillStyle = shade(col, 0.9); rr(c, x, y + cab + 1, w, l - cab - 1, 1); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + 1, y + cab + 2, w - 2, 1.2);
    }
  } else if(k === 'bus'){
    c.fillStyle = col; rr(c, x, y, w, l, 2); c.fill(); c.fillStyle = 'rgba(20,30,50,.8)'; rr(c, x + 1.2, y + 1.2, w - 2.4, 2.6, 1); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + 2, y + 6, w - 4, l - 9);
  } else if(k === 'tractor'){
    c.fillStyle = '#1c1c22'; rr(c, x - 1.5, y + l - 8, 3.5, 7, 1); c.fill(); rr(c, x + w - 2, y + l - 8, 3.5, 7, 1); c.fill();
    c.fillStyle = col; rr(c, x + 2, y, w - 4, l - 2, 1.5); c.fill(); c.fillStyle = '#d9d9d9'; rr(c, x + 2.5, y + l - 9, w - 5, 5, 1); c.fill(); c.fillStyle = '#333'; c.fillRect(-0.6, y + 1, 1.2, 3);
  } else {
    c.fillStyle = col; rr(c, x, y, w, l, k === 'van' || k === 'camper' ? 1.8 : 3); c.fill();
    c.fillStyle = 'rgba(20,30,50,.85)'; rr(c, x + 1.2, y + 3.2, w - 2.4, 3, 1.2); c.fill(); rr(c, x + 1.6, y + l - 4.8, w - 3.2, 1.8, 0.8); c.fill();
    if(k === 'van' || k === 'camper'){ c.fillStyle = k === 'camper' ? '#e08a3c' : 'rgba(255,255,255,.25)'; c.fillRect(x + 1, y + 7, w - 2, k === 'camper' ? 2 : l - 10); }
    if(k === 'camper'){ c.fillStyle = '#9fd3ff'; rr(c, x + 2.5, y + 11, w - 5, 5, 1); c.fill(); }
    if(k === 'taxi'){ c.fillStyle = '#111'; for(let i = 0; i < 4; i++) c.fillRect(x + 1 + i * (w - 2) / 4, y + 8.5, (w - 2) / 8, 1.3); c.fillStyle = '#fff'; c.fillRect(-1.6, y + 10.5, 3.2, 1.5); }
    if(k === 'jeep'){ c.fillStyle = '#1c1c22'; circ(c, 0, y + l - 0.5, 2); c.fill(); }
  }
  c.fillStyle = '#fff6c8'; c.fillRect(x + 1, y + 0.2, 2, 0.9); c.fillRect(x + w - 3, y + 0.2, 2, 0.9);
  c.fillStyle = '#ff3b3b'; c.fillRect(x + 1, y + l - 1, 2, 0.9); c.fillRect(x + w - 3, y + l - 1, 2, 0.9);
}
function vehSprite(o, px){ return sprite('V' + o.k + o.col + Math.round(px * 4), o.w + 5, o.l + 5, px, c => drawVeh(c, o.k, o.col, o.w, o.l)); }

/* ---------- Ground tiles (drawn once per stage and size) ---------- */
function groundTile(S, px){
  px = Math.max(1, Math.round(48 * px)) / 48;
  return sprite('G' + S.si + Math.round(px * 48), 48, 48, px, c => {
    c.translate(-24, -24); c.fillStyle = S.ground; c.fillRect(0, 0, 48, 48);
    for(let i = 0; i < 38; i++){ const x = rng(i + S.si * 50) * 48, y = rng(i + 90 + S.si * 50) * 48; c.fillStyle = i % 3 ? S.ground2 : shade(S.ground, 1.08);
      if(S.wx === 'snow'){ c.fillStyle = i % 2 ? '#ffffff' : '#d6e2ee'; c.fillRect(x, y, 1, 1); }
      else if(S.si === 1){ ell(c, x, y, 1.6, 0.8); c.fill(); }
      else if(S.si === 4 || S.si === 6){ c.fillRect(x, y, 2, 2); }
      else { c.fillRect(x, y, 0.8, 2.2); c.fillRect(x + 1.2, y + 0.6, 0.8, 1.6); } }
  });
}

/* one pre-rendered ground layer per road strip, scrolled with a single un-scaled copy each frame */
const GROUND = [];
function groundLayer(L, S, si){
  const s = display.scale, key = S.si + '/' + L.w + '/' + L.k + '/' + s;
  let g = GROUND[si]; if(g && g.key === key) return g;
  const tile = groundTile(S, s * L.k), P = tile.cv.width;
  const cv = g && g.cv || document.createElement('canvas');
  cv.width = Math.ceil(L.w * s) + 3 * P; cv.height = Math.ceil(VH * s) + 2 * P;
  const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = c.createPattern(tile.cv, 'repeat'); c.fillRect(0, 0, cv.width, cv.height);
  g = GROUND[si] = { cv, key, P }; return g;
}
/* ---------- Roadside props (top-down, drawn directly) ---------- */
function prop(c, d, x, y, k, S){
  const v = d.v;
  switch(d.k){
    case 'palm': c.fillStyle = 'rgba(0,0,0,.18)'; circ(c, x + 2, y + 2, 7 * k); c.fill(); c.strokeStyle = '#3e9b4a'; c.lineWidth = 2.2 * k; for(let i = 0; i < 6; i++){ const a = i * TAU / 6 + v * 3; line(c, x, y, x + Math.cos(a) * 7 * k, y + Math.sin(a) * 7 * k); } c.fillStyle = '#7a5a36'; circ(c, x, y, 1.6 * k); c.fill(); break;
    case 'hut': c.fillStyle = '#c98f52'; rr(c, x - 7 * k, y - 6 * k, 14 * k, 12 * k, 1); c.fill(); c.fillStyle = '#e8b86a'; c.fillRect(x - 7 * k, y - 0.6 * k, 14 * k, 1.2 * k); c.fillStyle = ['#ff6b6b', '#4fb8ff', '#ffd45e'][Math.floor(v * 3)]; c.fillRect(x - 7 * k, y + 5 * k, 14 * k, 1.5 * k); break;
    case 'bush': case 'tree': case 'mushroom': {
      const r = (d.k === 'tree' ? 8 : d.k === 'mushroom' ? 3 : 4.5) * k * (0.8 + v * 0.4);
      c.fillStyle = 'rgba(0,0,0,.2)'; circ(c, x + 2, y + 2, r); c.fill();
      c.fillStyle = d.k === 'mushroom' ? '#e0503d' : S.si === 6 ? '#2e5a3a' : '#3f7f3a'; circ(c, x, y, r); c.fill();
      c.fillStyle = d.k === 'mushroom' ? '#fff' : 'rgba(255,255,255,.15)'; circ(c, x - r * 0.3, y - r * 0.3, r * 0.4); c.fill(); break; }
    case 'pine': case 'pinesnow': { const r = 6 * k * (0.8 + v * 0.4); c.fillStyle = 'rgba(0,0,0,.2)'; circ(c, x + 2, y + 2, r); c.fill(); c.fillStyle = '#2f5a3c'; star(c, x, y, r); c.fillStyle = d.k === 'pinesnow' ? '#ffffff' : '#3f7050'; star(c, x, y, r * 0.55); break; }
    case 'cactus': c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, x + 2, y + 2, 3 * k, 5 * k); c.fill(); c.fillStyle = '#4f9a4a'; rr(c, x - 1.6 * k, y - 5 * k, 3.2 * k, 10 * k, 1.6 * k); c.fill(); rr(c, x - 5 * k, y - 2 * k, 3 * k, 2 * k, 1); c.fill(); rr(c, x + 2 * k, y, 3 * k, 2 * k, 1); c.fill(); break;
    case 'rock': case 'rocksnow': case 'rockbig': { const r = (d.k === 'rockbig' ? 9 : 4.5) * k * (0.8 + v * 0.4); c.fillStyle = 'rgba(0,0,0,.22)'; ell(c, x + 2, y + 2, r, r * 0.8); c.fill(); c.fillStyle = S.si === 1 ? '#b0703f' : '#8d8a84'; ell(c, x, y, r, r * 0.8); c.fill(); c.fillStyle = d.k === 'rocksnow' ? '#fff' : 'rgba(255,255,255,.2)'; ell(c, x - r * 0.25, y - r * 0.2, r * 0.5, r * 0.35); c.fill(); break; }
    case 'mesa': c.fillStyle = '#b8653a'; rr(c, x - 12 * k, y - 8 * k, 24 * k, 16 * k, 3 * k); c.fill(); c.fillStyle = '#cf7d4a'; rr(c, x - 9 * k, y - 6 * k, 18 * k, 10 * k, 2 * k); c.fill(); break;
    case 'skull': c.fillStyle = '#f2ead8'; circ(c, x, y, 2 * k); c.fill(); c.strokeStyle = '#f2ead8'; c.lineWidth = 0.8 * k; line(c, x - 4 * k, y - 1 * k, x - 1 * k, y); line(c, x + 1 * k, y, x + 4 * k, y - 1 * k); break;
    case 'log': c.fillStyle = '#7a5433'; rr(c, x - 7 * k, y - 1.8 * k, 14 * k, 3.6 * k, 1.8 * k); c.fill(); c.fillStyle = '#c9a070'; circ(c, x + 7 * k, y, 1.6 * k); c.fill(); break;
    case 'snowman': c.fillStyle = 'rgba(0,0,0,.12)'; circ(c, x + 1.5, y + 1.5, 4 * k); c.fill(); c.fillStyle = '#fff'; circ(c, x, y, 3.6 * k); c.fill(); circ(c, x, y - 3.4 * k, 2.4 * k); c.fill(); c.fillStyle = '#ff8c1a'; c.fillRect(x - 0.4, y - 3.6 * k, 2 * k, 0.8); c.fillStyle = '#d9434f'; c.fillRect(x - 2.4 * k, y - 1.6 * k, 4.8 * k, 1 * k); break;
    case 'building': { const w = (14 + v * 12) * k, h = (14 + rng(d.y) * 14) * k; c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x - w / 2 + 3, y - h / 2 + 3, w, h); c.fillStyle = ['#4a4f6a', '#5a4a62', '#3f5a66'][Math.floor(v * 3)]; c.fillRect(x - w / 2, y - h / 2, w, h);
      c.fillStyle = 'rgba(255,230,150,.75)'; for(let i = 0; i < 6; i++) if(rng(d.y + i) > 0.4) c.fillRect(x - w / 2 + 2 + (i % 3) * w / 3.2, y - h / 2 + 2 + Math.floor(i / 3) * h / 2.4, 2.2 * k, 2.2 * k); break; }
    case 'lamp': c.fillStyle = '#9aa2ad'; circ(c, x, y, 1.2 * k); c.fill(); c.strokeStyle = '#9aa2ad'; c.lineWidth = 0.8; line(c, x, y, x - d.s * 7 * k, y); c.fillStyle = '#fff3c4'; circ(c, x - d.s * 7 * k, y, 1.3 * k); c.fill(); break;
    case 'neon': { const col = ['#ff4fd8', '#4ff7ff', '#ffe14a', '#7dff6a'][Math.floor(v * 4)]; c.fillStyle = '#1a1a26'; rr(c, x - 8 * k, y - 4 * k, 16 * k, 8 * k, 1.5); c.fill(); c.strokeStyle = col; c.lineWidth = 0.9; rr(c, x - 7 * k, y - 3 * k, 14 * k, 6 * k, 1.2); c.stroke(); c.fillStyle = col; c.font = (3.2 * k) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(['GAS', 'EAT', 'ZOOM', 'OPEN'][Math.floor(v * 4)], x, y); break; }
    case 'flag': c.strokeStyle = '#ddd'; c.lineWidth = 0.7; line(c, x, y + 4, x, y - 4); c.fillStyle = '#ff6b3d'; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x + 5 * k * Math.cos(G.time * 4 + v * 5), y - 2.6); c.lineTo(x, y - 1.4); c.fill(); break;
    case 'board': { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x - 13 + 2, y - 5 + 2, 26, 10); c.fillStyle = '#f4efe2'; c.fillRect(x - 13, y - 5, 26, 10); c.fillStyle = d.text === 'HUMBLE YETI' ? '#328F42' : '#d9434f'; c.fillRect(x - 12, y - 4, 24, 8);
      c.fillStyle = d.text === 'HUMBLE YETI' ? '#F5E20A' : '#fff'; c.font = '3.2px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(d.text, x, y + 0.3); break; }
  }
}
function signGlyph(c, x, y, k, kind){
  c.fillStyle = '#6b6b6b'; c.fillRect(x - 0.4, y, 0.8, 5 * k);
  c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(x, y - 5 * k); c.lineTo(x + 4.6 * k, y + 2.4 * k); c.lineTo(x - 4.6 * k, y + 2.4 * k); c.closePath(); c.fill();
  c.strokeStyle = '#1a1a1a'; c.lineWidth = 0.6; c.stroke();
  c.fillStyle = '#1a1a1a'; c.font = (3 * k) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText({ works: 'W', cross: 'X', wind: '~', rock: '!' }[kind] || '!', x, y + 0.2);
}

/* ---------- One driver's road ---------- */
function layout(n){
  if(n <= 1) return [{ x0: 104, w: 176, k: 0.95, carY: 176, solo: true }];
  if(n === 2) return [0, 1].map(i => ({ x0: i * 192, w: 192, k: 0.9, carY: 180 }));
  if(n === 3) return [0, 1, 2].map(i => ({ x0: i * 128, w: 128, k: 0.76, carY: 182 }));
  return [0, 1, 2, 3].map(i => ({ x0: i * 96, w: 96, k: 0.64, carY: 186 }));
}
const camMem = new Map();
const DBG = {};
const MASKS = [];
let hlSprite = null;
function headlight(){
  if(hlSprite) return hlSprite;
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 96; const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 92, 2, 32, 70, 70); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(26, 96); c.lineTo(0, 0); c.lineTo(64, 0); c.lineTo(38, 96); c.closePath(); c.fill();
  const g2 = c.createRadialGradient(32, 90, 1, 32, 90, 14); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.fillRect(0, 70, 64, 26);
  hlSprite = cv; return cv;
}
let glowSprite = null;
function glow(){ if(glowSprite) return glowSprite; const cv = document.createElement('canvas'); cv.width = cv.height = 48; const c = cv.getContext('2d'); const g = c.createRadialGradient(24, 24, 1, 24, 24, 24); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 48, 48); glowSprite = cv; return cv; }

function drawStrip(c, L, r, si, t){
  const C = RC, S = C.S, k = L.k, s = display.scale;
  // camera: follows the road a little ahead, leaning toward the car
  const ahead = r.y + 50 / k, cxA = cxAt(ahead);
  let camX = lerp(cxA, r.x, 0.38);
  const mem = camMem.get(si);
  if(mem && mem.id === r.id && Math.abs(mem.x - camX) < 40) camX = lerp(mem.x, camX, 0.25);
  camMem.set(si, { x: camX, id: r.id });
  const camY = r.y;
  let sx0 = 0, sy0 = 0;
  if(r.shakeT > 0 && !G.opts.calm){ sx0 = (Math.random() - 0.5) * 3 * r.shakeT; sy0 = (Math.random() - 0.5) * 3 * r.shakeT; r.shakeT = Math.max(0, r.shakeT - 1 / 60); }
  const ox = L.x0 + L.w / 2 + sx0, X = wx => ox + (wx - camX) * k, Y = wy => L.carY + sy0 - (wy - camY) * k;
  const y0 = camY - (VH - L.carY) / k - 30, y1 = camY + L.carY / k + 40;
  c.save(); c.beginPath(); c.rect(L.x0, 0, L.w, VH); c.clip();
  // ground
  if(!DBG.ground){
    const g = groundLayer(L, S, si), P = g.P, oy = ((camY * k * s) % P + P) % P, oxp = ((camX * k * s) % P + P) % P;
    c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false;
    c.drawImage(g.cv, Math.round(L.x0 * s - oxp - P), Math.round(oy - P));
    c.imageSmoothingEnabled = true; c.setTransform(s, 0, 0, s, 0, 0);
  }
  // the sea (coast), rivers and chasms under the bridges
  const step = SEG * (k < 0.7 ? 2 : 1), ys = [];
  for(let wy = Math.floor(y0 / step) * step; wy <= y1; wy += step) ys.push(wy);
  if(S.sea){
    c.fillStyle = '#3f9fd8'; c.beginPath(); c.moveTo(L.x0 + L.w + 2, Y(ys[0]));
    for(const wy of ys) c.lineTo(X(cxAt(wy) + hwAt(wy) + 70 + Math.sin(wy * 0.02) * 6), Y(wy));
    c.lineTo(L.x0 + L.w + 2, Y(ys[ys.length - 1])); c.fill();
    c.fillStyle = '#f0dfa8'; c.beginPath(); for(const wy of ys) c.lineTo(X(cxAt(wy) + hwAt(wy) + 62 + Math.sin(wy * 0.02) * 6), Y(wy)); for(let i = ys.length - 1; i >= 0; i--){ const wy = ys[i]; c.lineTo(X(cxAt(wy) + hwAt(wy) + 71 + Math.sin(wy * 0.02) * 6), Y(wy)); } c.fill();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 0.8;
    for(let i = 0; i < 6; i++){ const wy = Math.floor(y0 / 60) * 60 + i * 60 + ((G.time * 8) % 60); const xx = X(cxAt(wy) + hwAt(wy) + 90 + rng(Math.floor(wy / 60)) * 30); line(c, xx, Y(wy), xx + 8 * k, Y(wy)); }
  }
  for(const b of C.bridges){
    if(b.y1 + 110 < y0 || b.y0 - 110 > y1) continue;
    const ya = Y(b.y1 + 40), yb = Y(b.y0 - 40);
    if(S.chasm){ const g = c.createLinearGradient(L.x0, 0, L.x0 + L.w, 0); g.addColorStop(0, '#2a2622'); g.addColorStop(0.5, '#0d0c0b'); g.addColorStop(1, '#2a2622'); c.fillStyle = g; c.fillRect(L.x0, ya, L.w, yb - ya); c.fillStyle = 'rgba(255,255,255,.08)'; for(let i = 0; i < 5; i++) c.fillRect(L.x0 + rng(i + b.y0) * L.w, ya + rng(i + 7) * (yb - ya), 12, 2); }
    else { c.fillStyle = S.wx === 'snow' ? '#9fd0ea' : '#3f8fc8'; c.fillRect(L.x0, ya, L.w, yb - ya); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.7; for(let i = 0; i < 8; i++){ const yy = ya + ((i * 13 + G.time * 10) % Math.max(1, yb - ya)); line(c, L.x0 + rng(i) * L.w, yy, L.x0 + rng(i) * L.w + 10, yy); } }
    c.fillStyle = S.shoulder; c.fillRect(L.x0, ya - 2, L.w, 2); c.fillRect(L.x0, yb, L.w, 2);
  }
  // roadside props (behind the road)
  const deco = C.deco;
  for(let i = lowerBound(deco, y0 - 30); i < deco.length && deco[i].y < y1 + 30; i++){
    const d = deco[i]; if(zoneAt(d.y) === 1 && d.off < HW + 30) continue;
    const x = cxAt(d.y) + d.s * (hwAt(d.y) - HW + d.off); if(!DBG.props) prop(c, d, X(x), Y(d.y), k, S);
  }
  // side road and gravel links
  if(C.side && C.side.y1 > y0 && C.side.y0 < y1){
    const sd = C.side, a = Math.max(y0, sd.y0), b = Math.min(y1, sd.y1), pts = [];
    for(let wy = a; wy < b; wy += SEG) pts.push(wy);
    pts.push(b);
    const sideAt = wy => sideAtRaw(clamp(wy, sd.y0, sd.y1));
    c.fillStyle = '#b89b6a'; c.beginPath();
    for(const wy of pts){ const sa = sideAt(wy); c.lineTo(X(sa.x - sa.hw - 2), Y(wy)); }
    for(let i = pts.length - 1; i >= 0; i--){ const sa = sideAt(pts[i]); c.lineTo(X(sa.x + sa.hw + 2), Y(pts[i])); } c.fill();
    c.fillStyle = '#8f7a55'; c.beginPath();
    for(const wy of pts){ const sa = sideAt(wy); c.lineTo(X(sa.x - sa.hw), Y(wy)); }
    for(let i = pts.length - 1; i >= 0; i--){ const sa = sideAt(pts[i]); c.lineTo(X(sa.x + sa.hw), Y(pts[i])); } c.fill();
    for(const [ya, yb] of [[sd.y0, sd.y0 + 110], [sd.y1 - 110, sd.y1]]){ if(yb < y0 || ya > y1) continue; c.fillStyle = '#b89b6a'; c.beginPath(); c.moveTo(X(cxAt(ya) + sd.s * HW), Y(ya)); c.lineTo(X(cxAt(yb) + sd.s * HW), Y(yb)); c.lineTo(X(cxAt(yb) + sd.s * (HW + 30)), Y(yb)); c.lineTo(X(cxAt(ya) + sd.s * (HW + 30)), Y(ya)); c.fill(); }
    // arrows: SHORTCUT
    if(sd.y0 - 120 < y1 && sd.y0 > y0){ const xx = X(cxAt(sd.y0 - 60) + sd.s * (HW + 16)); outlined(c, sd.s < 0 ? '◀' : '▶', xx, Y(sd.y0 - 60), 6 * k + 2, '#ffd45e'); }
  }
  // the road: shoulder, asphalt, edge lines, lane dashes
  c.fillStyle = S.shoulder; c.beginPath();
  for(const wy of ys) c.lineTo(X(cxAt(wy) - hwAt(wy) - 4), Y(wy));
  for(let i = ys.length - 1; i >= 0; i--){ const wy = ys[i]; c.lineTo(X(cxAt(wy) + hwAt(wy) + 4), Y(wy)); } c.fill();
  c.fillStyle = S.asphalt; c.beginPath();
  for(const wy of ys) c.lineTo(X(cxAt(wy) - hwAt(wy)), Y(wy));
  for(let i = ys.length - 1; i >= 0; i--){ const wy = ys[i]; c.lineTo(X(cxAt(wy) + hwAt(wy)), Y(wy)); } c.fill();
  c.strokeStyle = S.line; c.lineWidth = Math.max(0.6, 1.2 * k);
  for(const sgn of [-1, 1]){ c.beginPath(); for(const wy of ys) c.lineTo(X(cxAt(wy) + sgn * (hwAt(wy) - 2.2)), Y(wy)); c.stroke(); }
  c.fillStyle = S.line;
  for(let wy = Math.floor(y0 / 40) * 40; wy < y1; wy += 40){
    const hw = hwAt(wy), cx = cxAt(wy), cx2 = cxAt(wy + 20), ya = Y(wy + 20), yb = Y(wy);
    for(const o of [-25, 0, 25]){ if(Math.abs(o) > hw - 6) continue; c.beginPath(); c.moveTo(X(cx + o) - 0.5 * k, yb); c.lineTo(X(cx2 + o) - 0.5 * k, ya); c.lineTo(X(cx2 + o) + 0.5 * k + 0.3, ya); c.lineTo(X(cx + o) + 0.5 * k + 0.3, yb); c.fill(); }
  }
  // guard rails on the bridges, concrete walls in the tunnels
  for(const b of C.bridges){
    const a = Math.max(y0, b.y0 - 100), e = Math.min(y1, b.y1 + 100); if(a >= e) continue;
    for(const sgn of [-1, 1]){
      c.strokeStyle = '#c9ced6'; c.lineWidth = 1.6 * k; c.beginPath(); for(let wy = a; wy <= e; wy += SEG) c.lineTo(X(cxAt(wy) + sgn * (hwAt(wy) + 1.5)), Y(wy)); c.stroke();
      c.fillStyle = '#7a808a'; for(let wy = Math.ceil(a / 24) * 24; wy <= e; wy += 24) c.fillRect(X(cxAt(wy) + sgn * (hwAt(wy) + 1.5)) - 1 * k, Y(wy) - 1 * k, 2 * k, 2 * k);
    }
  }
  for(const q of C.tunnels){
    const a = Math.max(y0, q.y0), e = Math.min(y1, q.y1); if(a >= e) continue;
    for(const sgn of [-1, 1]){ c.strokeStyle = '#6d6a66'; c.lineWidth = 3 * k; c.beginPath(); for(let wy = a; wy <= e; wy += SEG) c.lineTo(X(cxAt(wy) + sgn * (hwAt(wy) + 2)), Y(wy)); c.stroke(); }
    for(const wy of [q.y0, q.y1]) if(wy > y0 && wy < y1){ c.fillStyle = '#58544f'; c.fillRect(X(cxAt(wy) - hwAt(wy) - 14), Y(wy) - 2 * k, (hwAt(wy) * 2 + 28) * k, 4 * k); }
  }
  // start grid, checkpoints and the finish
  const checker = (wy, h) => { const cx = cxAt(wy), hw = hwAt(wy), n = 12; for(let i = 0; i < n; i++) for(let j = 0; j < 2; j++){ c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(X(cx - hw + i * hw * 2 / n), Y(wy + (j + 1) * h / 2), hw * 2 / n * k + 0.3, h / 2 * k + 0.3); } };
  if(0 > y0 - 20 && 0 < y1) checker(-2, 4);
  if(C.len > y0 && C.len < y1 + 40){ checker(C.len, 8); arch(c, X, Y, C.len + 4, 'FINISH', '#ffd45e', k); }
  for(let i = 0; i < C.cps.length; i++){ const cy = C.cps[i]; if(cy > y0 && cy < y1 + 40){ c.fillStyle = 'rgba(127,240,176,.8)'; c.fillRect(X(cxAt(cy) - hwAt(cy)), Y(cy) - 1, hwAt(cy) * 2 * k, 2); arch(c, X, Y, cy + 2, 'CHECKPOINT', '#7ff0b0', k); } }
  // patches, ramps, crossings, works, rocks
  for(const p of C.patches){
    if(p.y < y0 - 20) continue; if(p.y > y1 + 20) break;
    const px = X(p.x), py = Y(p.y), rx = p.rx * k, ry = p.ry * k;
    if(p.k === 'oil'){ c.fillStyle = '#15131a'; ell(c, px, py, rx, ry); c.fill(); c.fillStyle = 'rgba(160,110,255,.35)'; ell(c, px - rx * 0.3, py - ry * 0.2, rx * 0.45, ry * 0.3); c.fill(); c.fillStyle = 'rgba(80,220,255,.25)'; ell(c, px + rx * 0.3, py + ry * 0.2, rx * 0.35, ry * 0.25); c.fill(); }
    else if(p.k === 'puddle'){ c.fillStyle = 'rgba(90,150,210,.75)'; ell(c, px, py, rx, ry); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, px - rx * 0.3, py - ry * 0.3, rx * 0.3, ry * 0.2); c.fill(); }
    else if(p.k === 'ice'){ c.fillStyle = 'rgba(200,236,255,.85)'; ell(c, px, py, rx, ry); c.fill(); c.strokeStyle = '#ffffff'; c.lineWidth = 0.6; line(c, px - rx * 0.5, py, px, py - ry * 0.4); line(c, px + rx * 0.1, py + ry * 0.3, px + rx * 0.5, py - ry * 0.1); }
    else { c.fillStyle = 'rgba(232,200,140,.92)'; for(let i = 0; i < 4; i++){ ell(c, px + (i - 1.5) * rx * 0.45, py + Math.sin(i * 2) * ry * 0.25, rx * 0.4, ry * 0.7); c.fill(); } }
  }
  for(const g of C.ramps){ if(g.y < y0 - 20 || g.y > y1 + 20) continue; const px = X(g.x), py = Y(g.y); c.fillStyle = '#6b5a45'; c.fillRect(px - g.w / 2 * k, py - g.l / 2 * k, g.w * k, g.l * k); for(let i = 0; i < 4; i++){ c.fillStyle = i % 2 ? '#ffd23a' : '#1a1a1a'; c.fillRect(px - g.w / 2 * k + i * g.w / 4 * k, py - g.l / 2 * k, g.w / 4 * k, 2.2 * k); } c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(px - g.w / 2 * k, py + g.l / 2 * k - 1.5 * k, g.w * k, 1.5 * k); outlined(c, '▲', px, py + 1, 5 * k + 1, '#ffd23a'); }
  for(const q of C.signs){ if(q.y < y0 - 20 || q.y > y1 + 20) continue; for(const sg of [-1, 1]) signGlyph(c, X(cxAt(q.y) + sg * (hwAt(q.y) + 9)), Y(q.y), k, q.k); }
  for(const cr of C.cross){
    if(cr.y < y0 - 60 || cr.y > y1 + 60) continue;
    const yy = Y(cr.y), cx = cxAt(cr.y), cs = crossState(cr, t);
    c.fillStyle = '#6b5a45'; for(let i = -8; i < 9; i++) c.fillRect(X(cx + i * 9) - 1 * k, yy - 6 * k, 2.4 * k, 12 * k);
    c.fillStyle = '#b8bec6'; c.fillRect(L.x0, yy - 3.4 * k, L.w, 1.1 * k); c.fillRect(L.x0, yy + 2.3 * k, L.w, 1.1 * k);
    c.fillStyle = '#ffffff'; c.fillRect(X(cx - hwAt(cr.y)), yy - 13 * k, hwAt(cr.y) * 2 * k, 1.4 * k);
    const down = cs.closed || cs.u > cr.period - 0.5, blink = (cs.closed || cs.warn) && Math.floor(G.time * 4) % 2;
    for(const sg of [-1, 1]){
      const px = X(cx + sg * (hwAt(cr.y) + 5)), py = yy - 11 * k;
      c.fillStyle = '#333'; circ(c, px, py, 2.2 * k); c.fill(); c.fillStyle = blink ? '#ff3b3b' : '#552222'; circ(c, px, py - 0.5, 1.3 * k); c.fill();
      c.save(); c.translate(px, py); c.rotate(down ? 0 : -sg * 1.35); c.fillStyle = '#ffffff'; c.fillRect(sg < 0 ? 0 : -hwAt(cr.y) * k, -0.9 * k, hwAt(cr.y) * k, 1.8 * k); c.fillStyle = '#ff3b3b'; for(let i = 0; i < 5; i++) c.fillRect((sg < 0 ? 0 : -hwAt(cr.y) * k) + i * hwAt(cr.y) * k / 5, -0.9 * k, hwAt(cr.y) * k / 10, 1.8 * k); c.restore();
    }
    if(cs.closed || (blink && cs.warn)) outlined(c, 'STOP', X(cx), yy - 18 * k, 5 * k + 1, '#ff5a4e');
  }
  for(const w of C.works){ if(w.y1 + 60 < y0 || w.y0 - 280 > y1) continue; const cx = cxAt(w.y0 + 40); c.fillStyle = 'rgba(255,160,40,.12)'; c.beginPath(); for(let wy = Math.max(y0, w.y0); wy <= Math.min(y1, w.y1); wy += SEG) c.lineTo(X(cxAt(wy) + w.xb), Y(wy)); for(let wy = Math.min(y1, w.y1); wy >= Math.max(y0, w.y0); wy -= SEG) c.lineTo(X(cxAt(wy) + w.side * hwAt(wy)), Y(wy)); c.fill(); }
  const tkn = G.taken.get(r.id);
  for(const q of C.cones){ if(q.y < y0 || q.y > y1) continue; const gone = tkn && tkn.has('k' + q.id); drawCone(c, X(q.x + (gone ? 7 : 0)), Y(q.y + (gone ? 4 : 0)), k, gone); }
  for(const b of C.boards){ if(b.y < y0 - 20 || b.y > y1 + 20) continue; const px = X(b.x), py = Y(b.y);
    if(b.k === 'board'){ c.fillStyle = '#ffffff'; c.fillRect(px - b.w / 2 * k, py - b.h / 2 * k, b.w * k, b.h * k); for(let i = 0; i < 6; i++){ c.fillStyle = '#ff5a1a'; c.fillRect(px - b.w / 2 * k + i * b.w / 6 * k, py - b.h / 2 * k, b.w / 12 * k, b.h * k); } c.fillStyle = Math.floor(G.time * 3) % 2 ? '#ffd23a' : '#7a5a00'; circ(c, px - b.w / 2 * k + 1.5, py - b.h / 2 * k - 1, 1.2 * k); c.fill(); circ(c, px + b.w / 2 * k - 1.5, py - b.h / 2 * k - 1, 1.2 * k); c.fill(); }
    else { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(px - b.w / 2 * k + 2, py - b.h / 2 * k + 2, b.w * k, b.h * k); c.fillStyle = '#ffb000'; rr(c, px - b.w / 2 * k, py - b.h / 2 * k, b.w * k, b.h * k, 2); c.fill(); c.fillStyle = '#3a3a3a'; c.fillRect(px - b.w / 2 * k, py - 2 * k, b.w * k, 4 * k); c.fillStyle = '#9fd3ff'; c.fillRect(px - 3 * k, py + b.h / 2 * k - 5 * k, 6 * k, 3 * k); c.fillStyle = '#6b5a45'; ell(c, px, py - b.h / 2 * k - 3 * k, 5 * k, 3 * k); c.fill(); } }
  for(const q of C.rocks){ if(q.y < y0 - 20 || q.y > y1 + 20) continue; const px = X(q.x), py = Y(q.y); c.fillStyle = 'rgba(0,0,0,.3)'; ell(c, px + 1.5, py + 1.5, q.r * k, q.r * 0.8 * k); c.fill(); c.fillStyle = '#8d8a84'; ell(c, px, py, q.r * k, q.r * 0.8 * k); c.fill(); c.fillStyle = '#b5b1aa'; ell(c, px - 1.4 * k, py - 1.4 * k, q.r * 0.45 * k, q.r * 0.35 * k); c.fill(); }
  // coins and power-ups
  for(let i = lowerBound(C.coins, y0); i < C.coins.length && C.coins[i].y < y1; i++){
    const q = C.coins[i]; if(tkn && tkn.has('c' + q.id)) continue;
    const px = X(q.x), py = Y(q.y), w = Math.abs(Math.cos(G.time * 5 + q.id)) * 2.4 * k + 0.4;
    c.fillStyle = '#b07d0c'; ell(c, px, py, w + 0.5, 2.9 * k); c.fill(); c.fillStyle = '#ffd54a'; ell(c, px, py, w, 2.5 * k); c.fill();
  }
  for(const p of C.pups){ if(p.y < y0 || p.y > y1) continue; if(tkn && tkn.has('p' + p.id)) continue; drawPup(c, X(p.x), Y(p.y) + Math.sin(G.time * 4 + p.id) * 1, k, p.k); }
  // skid marks
  c.strokeStyle = 'rgba(20,20,20,.35)'; c.lineWidth = 1.4 * k; c.beginPath();
  for(const q of skids){ if(q.y2 < y0 || q.y1 > y1 || G.time - q.t > 14) continue; c.moveTo(X(q.x1), Y(q.y1)); c.lineTo(X(q.x2), Y(q.y2)); } c.stroke();
  // dropped items
  for(const it of G.items){ if(it.y < y0 || it.y > y1) continue; if(it.k === 'cone') drawCone(c, X(it.x), Y(it.y), k, r.hitSet && r.hitSet.has('i' + it.id)); else { c.fillStyle = '#15131a'; ell(c, X(it.x), Y(it.y), 9 * k, 6 * k); c.fill(); c.fillStyle = 'rgba(160,110,255,.35)'; ell(c, X(it.x) - 2 * k, Y(it.y) - 1 * k, 4 * k, 2.5 * k); c.fill(); } }
  // traffic
  const dm = G.dodge.get(r.id), px = s * k, night = S.wx === 'night' || S.wx === 'storm';
  const lights = [];
  for(const o of C.veh){
    vehAt(C, o.id, t); if(VP.y < y0 - 30 || VP.y > y1 + 20) continue;
    const vy = VP.y, dx = VP.dx, x = vehX(o, t, dm), ev = dm && dm.get(o.id);
    let rot = clamp(dx * 0.012, -0.25, 0.25), alpha;
    if(ev && ev.b){ const u = t - ev.b.t0; rot += ev.b.dir * u * 7; alpha = clamp(1.4 - u, 0, 1); if(alpha <= 0) continue; }
    if(o.k === 'fuel' && tkn && tkn.has('f' + o.id)) alpha = 0.55;
    if(ev && ev.d.length){ for(const e of ev.d){ if(t >= e.t0 - 0.6 && t < e.t0 + 0.7){ rot += Math.sign(e.dx) * 0.12 * smooth(clamp((t - e.t0) / 0.3, 0, 1)); } } }
    if(Math.abs(rot) < 0.035) rot = 0;
    const sp = vehSprite(o, px); if(!DBG.veh) stamp(c, sp, X(x), Y(vy), rot, alpha);
    // blinkers before a lane change, hazard lights on a broken-down car, the fuel truck's beacon
    const bl = Math.floor(G.time * 5) % 2;
    let blinkDir = 0; if(ev) for(const e of ev.d) if(t > e.t0 - 0.65 && t < e.t0 + 0.4) blinkDir = Math.sign(e.dx);
    if(!blinkDir && Math.abs(dx) > 4) blinkDir = Math.sign(dx);
    if(bl && (blinkDir || o.beh === 'stop')){ c.fillStyle = '#ffae1a'; for(const sg of o.beh === 'stop' ? [-1, 1] : [blinkDir]){ circ(c, X(x + sg * (o.w / 2 - 0.5)), Y(vy + o.l / 2 - 1), 1 * k + 0.4); c.fill(); circ(c, X(x + sg * (o.w / 2 - 0.5)), Y(vy - o.l / 2 + 1), 1 * k + 0.4); c.fill(); } }
    if(o.beh === 'stop'){ c.fillStyle = '#ff3b3b'; c.beginPath(); const tx = X(x), ty = Y(vy - o.l / 2 - 16); c.moveTo(tx, ty - 2.6 * k); c.lineTo(tx + 2.4 * k, ty + 1.6 * k); c.lineTo(tx - 2.4 * k, ty + 1.6 * k); c.closePath(); c.fill(); }
    if(o.k === 'fuel' && !(tkn && tkn.has('f' + o.id))){ c.globalAlpha = 0.5 + 0.5 * Math.sin(G.time * 8); c.fillStyle = '#7ff0b0'; circ(c, X(x), Y(vy), (o.l / 2 + 4) * k); c.fill(); c.globalAlpha = 1; outlined(c, 'FUEL', X(x), Y(vy + o.l / 2 + 6), 4 * k + 1.5, '#7ff0b0'); }
    if(night) lights.push([X(x), Y(vy + o.l / 2), 0.7]);
  }
  // racers: rivals, the other drivers (see-through), the family ghost, then this road's own car on top
  const others = G.racers.filter(q => q !== r && q.y > y0 - 20 && q.y < y1 + 20);
  for(const q of others){
    const alpha = q.kind === 'ghost' ? 0.4 : q.kind === 'human' ? 0.42 : 1;
    drawRacer(c, q, X(q.x), Y(q.y), k, px, alpha);
    if(q.kind !== 'human' || G.state === 'race') { const tag = q.kind === 'ghost' ? 'GHOST' : q.name.split(' ')[0].toUpperCase(); outlined(c, tag, X(q.x), Y(q.y + CAR_L / 2 + 5), 3.2 * k + 1.2, q.boss ? '#ffd45e' : q.kind === 'human' ? q.color : '#fff4d8'); }
    if(night && q.kind !== 'ghost') lights.push([X(q.x), Y(q.y + CAR_L / 2), 1]);
  }
  // particles
  for(const p of parts){ if(p.y < y0 || p.y > y1) continue; c.globalAlpha = clamp(1 - p.t / p.life, 0, 1); c.fillStyle = p.col; const rr0 = p.r * k * (p.grow ? 1 + p.t * 2 : 1); if(p.conf) c.fillRect(X(p.x), Y(p.y), 1.6 * k, 1 * k); else { circ(c, X(p.x), Y(p.y), rr0); c.fill(); } } c.globalAlpha = 1;
  drawRacer(c, r, X(r.x), Y(r.y), k, px, 1, true);
  lights.push([X(r.x), Y(r.y + CAR_L / 2), 1.2]);
  // Widget the helper drone (Kids / Junior)
  if((isJunior(r) || r.jun) && (G.state === 'race' || G.state === 'count')){
    const hx = X(r.x) + (r.helpT > 0 ? Math.sign(cxAt(r.y) - r.x) * 6 : 11) * k, hy = Y(r.y) - 6 * k + Math.sin(G.time * 6) * 1.5;
    c.fillStyle = 'rgba(0,0,0,.2)'; ell(c, hx + 3, hy + 6, 3 * k, 1.4 * k); c.fill();
    c.fillStyle = '#9fe8ff'; circ(c, hx, hy, 2.6 * k); c.fill(); c.fillStyle = '#1a3a4a'; circ(c, hx - 0.8 * k, hy - 0.3, 0.6 * k); c.fill(); circ(c, hx + 0.8 * k, hy - 0.3, 0.6 * k); c.fill();
    c.strokeStyle = '#e8f7ff'; c.lineWidth = 0.6; const sp = G.time * 40; line(c, hx - 4 * k * Math.cos(sp), hy - 3 * k, hx + 4 * k * Math.cos(sp), hy - 3 * k);
  }
  // trains at the crossings
  for(const cr of C.cross){ if(cr.y < y0 - 30 || cr.y > y1 + 30) continue; const cs = crossState(cr, t); if(!cs.closed) continue; const u = cs.u / cr.dur, span = L.w / k + 260, head = cxAt(cr.y) - cr.dir * span / 2 + cr.dir * u * span * 1.4, yy = Y(cr.y);
    for(let j = 0; j < 6; j++){ const tx = X(head - cr.dir * j * 30); if(tx < L.x0 - 40 || tx > L.x0 + L.w + 40) continue; c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(tx - 14 * k + 2, yy - 5 * k + 2, 28 * k, 10 * k); c.fillStyle = j ? ['#3d7bd8', '#d8573f', '#4aa35a'][j % 3] : '#2a2a33'; rr(c, tx - 14 * k, yy - 5 * k, 28 * k, 10 * k, 2 * k); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(tx - 12 * k, yy - 1 * k, 24 * k, 2 * k); if(!j){ c.fillStyle = '#ffd45e'; c.fillRect(tx + cr.dir * 12 * k - 1, yy - 3 * k, 2, 6 * k); } }
    if(night) lights.push([X(head + cr.dir * 14), yy, 1.4]); }
  // tunnels (roof shadow), night and storm darkness with headlights cut out
  if(!DBG.dark) drawDark(c, L, si, X, Y, y0, y1, lights, night, k);
  if(!DBG.wx) drawWeather(c, L, S, k);
  // floating texts
  for(const f of G.fx){ if(f.y < y0 || f.y > y1 || (f.rid && f.rid !== r.id)) continue; outlined(c, f.text, X(f.x), Y(f.y) - f.t * 12, (f.big ? 6 : 4) * k + 2, f.col); }
  if(r.msgT > 0 && r.msg){ c.globalAlpha = clamp(r.msgT * 3, 0, 1); const sz = fitText(c, r.msg, L.w - 6, (5.5 * (G.opts.bigHud ? 1.25 : 1)) * Math.max(0.8, k)); outlined(c, r.msg, X(r.x), Y(r.y + CAR_L / 2 + 9), sz, r.msgCol || '#fff'); c.globalAlpha = 1; }
  if(G.state === 'race' || G.state === 'count') drawCues(c, L, r, X);
  c.restore();
}
function lowerBound(a, y){ let lo = 0, hi = a.length; while(lo < hi){ const m = (lo + hi) >> 1; if(a[m].y < y) lo = m + 1; else hi = m; } return lo; }
function arch(c, X, Y, wy, label, col, k){
  const cx = cxAt(wy), hw = hwAt(wy) + 6, y = Y(wy);
  c.fillStyle = '#555'; c.fillRect(X(cx - hw) - 1.5 * k, y - 2 * k, 3 * k, 4 * k); c.fillRect(X(cx + hw) - 1.5 * k, y - 2 * k, 3 * k, 4 * k);
  c.fillStyle = 'rgba(20,20,30,.85)'; c.fillRect(X(cx - hw), y - 3 * k, hw * 2 * k, 5 * k);
  c.fillStyle = col; c.font = (3.6 * k + 0.4) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, X(cx), y - 0.4 * k);
}
function drawCone(c, x, y, k, down){
  if(down){ c.fillStyle = '#ff7a1a'; c.save(); c.translate(x, y); c.rotate(1.2); c.fillRect(-1.2 * k, -3 * k, 2.4 * k, 6 * k); c.restore(); return; }
  c.fillStyle = 'rgba(0,0,0,.25)'; circ(c, x + 1, y + 1, 2.6 * k); c.fill();
  c.fillStyle = '#ff7a1a'; circ(c, x, y, 2.4 * k); c.fill(); c.fillStyle = '#ffffff'; circ(c, x, y, 1.4 * k); c.fill(); c.fillStyle = '#ff7a1a'; circ(c, x, y, 0.7 * k); c.fill();
}
const PUP_COL = { shield: '#7fd8ff', magnet: '#ff6b6b', oil: '#b58cff', ghost: '#e9ecf1', can: '#7ff0b0' };
const PUP_CH = { shield: 'S', magnet: 'M', oil: 'O', ghost: 'G', can: 'F' };
function drawPup(c, x, y, k, kind){
  c.fillStyle = 'rgba(0,0,0,.25)'; circ(c, x + 1, y + 1.5, 4 * k); c.fill();
  if(kind === 'can'){ c.fillStyle = '#d9434f'; rr(c, x - 3 * k, y - 4 * k, 6 * k, 8 * k, 1); c.fill(); c.fillStyle = '#ffd23a'; c.fillRect(x - 1 * k, y - 5.2 * k, 2 * k, 1.4 * k); c.fillStyle = '#fff'; c.font = (3.2 * k + 0.3) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('F', x, y + 0.4); return; }
  c.fillStyle = PUP_COL[kind]; circ(c, x, y, 4 * k); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; circ(c, x - 1.3 * k, y - 1.3 * k, 1.3 * k); c.fill();
  c.fillStyle = '#1a1a26'; c.font = (4 * k + 0.3) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(PUP_CH[kind], x, y + 0.4);
}
function drawRacer(c, r, x, y, k, px, alpha, own){
  const cs = CARS[r.car] || CARS[0];
  const air = r.airT > 0 ? Math.sin(Math.PI * clamp(r.airDur ? 1 - r.airT / r.airDur : 1 - (r.airU || 0.5), 0, 1)) : 0;
  const lift = air * 7 * k, scale = 1 + air * 0.35;
  if(lift){ c.fillStyle = 'rgba(0,0,0,.25)'; ell(c, x + lift * 0.4, y + lift * 0.4, 5 * k, 8 * k); c.fill(); }
  let a = alpha;
  if(r.pu && r.pu.ghost > 0) a = Math.min(a, 0.45);
  if(r.invT > 0 && r.spinT <= 0 && Math.floor(G.time * 12) % 2 && own) a *= 0.45;
  let sp;
  if(r.boss && r.trick === 'tow' || (r.boss && G.net === 'guest' && BOSSES[G.stage] && BOSSES[G.stage].trick === 'tow')) sp = sprite('Btow' + Math.round(px * 4), 25, 35, px, cc => drawVeh(cc, 'tow', '#f2c14e', 20, 30));
  else sp = carSprite(cs.shape, r.color, r.livery || 'plain', px * scale);
  const rot = r.ang + (r.vx ? clamp(r.vx / 700, -0.12, 0.12) : 0);
  c.save(); c.translate(x, y - lift); if(scale !== 1) c.scale(scale, scale); stamp(c, sp, 0, 0, rot, a); c.restore();
  if(r.boost && r.spinT <= 0 && !lift){ c.globalAlpha = a; c.fillStyle = Math.floor(G.time * 20) % 2 ? '#ffb347' : '#fff2a8'; c.beginPath(); c.moveTo(x - 2 * k, y + 8.5 * k); c.lineTo(x, y + (12 + Math.random() * 3) * k); c.lineTo(x + 2 * k, y + 8.5 * k); c.fill(); c.globalAlpha = 1; }
  if(r.brakeOn){ c.fillStyle = 'rgba(255,40,40,.55)'; circ(c, x - 3.5 * k, y + 8 * k, 1.8 * k); c.fill(); circ(c, x + 3.5 * k, y + 8 * k, 1.8 * k); c.fill(); }
  if(r.pu && r.pu.shield > 0){ c.strokeStyle = 'rgba(127,216,255,' + (0.5 + 0.3 * Math.sin(G.time * 6)) + ')'; c.lineWidth = 1.1; ell(c, x, y - lift, 8 * k, 11 * k); c.stroke(); }
  if(r.pu && r.pu.magnet > 0){ c.strokeStyle = 'rgba(255,107,107,.4)'; c.lineWidth = 0.7; circ(c, x, y, (18 + (G.time * 30) % 20) * k); c.stroke(); }
  if(r.hornT > 0){ c.strokeStyle = 'rgba(255,240,180,.8)'; c.lineWidth = 0.8; for(let i = 0; i < 2; i++){ c.beginPath(); c.arc(x, y - 10 * k, (5 + i * 4) * k, -Math.PI * 0.8, -Math.PI * 0.2); c.stroke(); } }
  if(r.spinT > 0 && own){ c.fillStyle = '#ffe27a'; for(let i = 0; i < 3; i++){ const aa = G.time * 8 + i * 2.1; star(c, x + Math.cos(aa) * 7 * k, y - 10 * k + Math.sin(aa) * 2 * k, 1.4 * k); } }
  if(r.boss && alpha > 0.9){ c.fillStyle = '#ffd45e'; c.beginPath(); const bx = x, by = y - 12 * k; c.moveTo(bx - 3 * k, by); c.lineTo(bx - 3 * k, by - 2.5 * k); c.lineTo(bx - 1.5 * k, by - 1.2 * k); c.lineTo(bx, by - 3 * k); c.lineTo(bx + 1.5 * k, by - 1.2 * k); c.lineTo(bx + 3 * k, by - 2.5 * k); c.lineTo(bx + 3 * k, by); c.fill(); }
  if(own && r.slip){ c.strokeStyle = 'rgba(160,230,255,.6)'; c.lineWidth = 0.7; for(let i = 0; i < 3; i++){ const yy = y - 14 * k - ((G.time * 80 + i * 8) % 24) * k; line(c, x - 5 * k, yy, x - 5 * k, yy + 5 * k); line(c, x + 5 * k, yy, x + 5 * k, yy + 5 * k); } }
}
let warmHl = null, warmGl = null;
function warmSprites(){
  if(warmHl) return;
  warmHl = document.createElement('canvas'); warmHl.width = 64; warmHl.height = 96; let c = warmHl.getContext('2d');
  const g = c.createRadialGradient(32, 92, 2, 32, 60, 70); g.addColorStop(0, 'rgba(255,240,200,.95)'); g.addColorStop(0.45, 'rgba(255,230,170,.45)'); g.addColorStop(1, 'rgba(255,220,150,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(27, 96); c.lineTo(2, 0); c.lineTo(62, 0); c.lineTo(37, 96); c.closePath(); c.fill();
  warmGl = document.createElement('canvas'); warmGl.width = warmGl.height = 48; c = warmGl.getContext('2d');
  const g2 = c.createRadialGradient(24, 24, 1, 24, 24, 24); g2.addColorStop(0, 'rgba(255,236,190,.9)'); g2.addColorStop(1, 'rgba(255,220,160,0)'); c.fillStyle = g2; c.fillRect(0, 0, 48, 48);
}
/* night, storm and tunnels: a dark wash, then warm headlight and lamp light added on top */
function drawDark(c, L, si, X, Y, y0, y1, lights, night, k){
  const C = RC, S = C.S;
  const tun = C.tunnels.filter(q => q.y1 > y0 && q.y0 < y1);
  if(!night && !tun.length) return;
  warmSprites();
  if(night && !DBG.wash){ c.fillStyle = S.wx === 'storm' ? 'rgba(6,10,26,.6)' : 'rgba(6,8,24,.72)'; c.fillRect(L.x0, 0, L.w, VH); }
  for(const q of tun){ const ya = Math.max(0, Y(q.y1)), yb = Math.min(VH, Y(q.y0)); if(yb > ya){ c.fillStyle = 'rgba(8,8,14,.66)'; c.fillRect(L.x0, ya, L.w, yb - ya); } }
  const inDark = y => night || tun.some(q => y >= Y(q.y1) - 20 && y <= Y(q.y0) + 20);
  for(const [x, y, a] of lights){ if(!inDark(y)) continue; const w = a >= 1 ? 1 : 0.8; c.globalAlpha = 0.3 * Math.min(1, a); c.drawImage(warmHl, x - 13 * k * w, y - 60 * k * w, 26 * k * w, 42 * k * w); if(a >= 1){ c.globalAlpha = 0.3; c.drawImage(warmGl, x - 7 * k, y - 7 * k, 14 * k, 14 * k); } }
  c.globalAlpha = 0.34;
  if(night) for(let i = lowerBound(C.deco, y0 - 30); i < C.deco.length && C.deco[i].y < y1 + 30; i++){ const d = C.deco[i]; if(d.k !== 'lamp' && d.k !== 'neon') continue; const x = X(cxAt(d.y) + d.s * (hwAt(d.y) - HW + d.off) - (d.k === 'lamp' ? d.s * 7 : 0)), y = Y(d.y), rr0 = (d.k === 'lamp' ? 24 : 16) * k; c.drawImage(warmGl, x - rr0, y - rr0, rr0 * 2, rr0 * 2); }
  for(const q of tun){ for(let wy = Math.ceil(q.y0 / 90) * 90; wy < q.y1; wy += 90){ if(wy < y0 || wy > y1) continue; for(const sg of [-1, 1]){ const x = X(cxAt(wy) + sg * (hwAt(wy) - 2)), y = Y(wy); c.drawImage(warmGl, x - 11 * k, y - 11 * k, 22 * k, 22 * k); } } }
  c.globalAlpha = 1;
  // tunnel walls and lamps on top
  for(const q of tun){ const ya = Math.max(0, Y(q.y1)), yb = Math.min(VH, Y(q.y0)); c.fillStyle = '#2a2a33'; c.fillRect(L.x0, ya, L.w, 2); c.fillRect(L.x0, yb - 2, L.w, 2); for(let wy = Math.ceil(q.y0 / 90) * 90; wy < q.y1; wy += 90){ if(wy < y0 || wy > y1) continue; c.fillStyle = '#ffe9a8'; for(const sg of [-1, 1]) c.fillRect(X(cxAt(wy) + sg * (hwAt(wy) - 1)) - 1, Y(wy) - 0.5, 2, 1); } }
}
function drawWeather(c, L, S, k){
  const wx = S.wx, n = G.opts.calm ? 0.5 : 1, t = G.time;
  if(wx === 'storm'){ c.strokeStyle = 'rgba(180,210,255,.45)'; c.lineWidth = 0.6; c.beginPath(); for(let i = 0; i < 60 * n * L.w / 192; i++){ const x = L.x0 + ((rng(i) * L.w + t * 40) % L.w), y = ((rng(i + 50) * VH + t * 420) % (VH + 10)) - 5; c.moveTo(x, y); c.lineTo(x - 1.5, y + 6); } c.stroke();
    if(!G.opts.calm && Math.sin(t * 0.7) > 0.995){ c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(L.x0, 0, L.w, VH); } }
  else if(wx === 'snow'){ c.fillStyle = 'rgba(255,255,255,.85)'; for(let i = 0; i < 45 * n * L.w / 192; i++){ const x = L.x0 + ((rng(i) * L.w + Math.sin(t + i) * 8 + t * 10) % L.w + L.w) % L.w, y = (rng(i + 50) * VH + t * 60) % VH; c.fillRect(x, y, 1.1, 1.1); } }
  else if(wx === 'hot'){ c.fillStyle = 'rgba(255,220,160,.06)'; c.fillRect(L.x0, 0, L.w, VH); }
  else if(wx === 'wind'){ c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.6; for(let i = 0; i < 10 * n; i++){ const y = rng(i + 3) * VH, x = L.x0 + ((rng(i) * L.w + t * 90) % L.w); line(c, x, y, x + 10, y); } }
}
/* the hazard signs at the top of the road: a picture, a word and (in sim) a beep for every one */
function drawCues(c, L, r, X){
  const cs = cuesFor(r); if(!cs.length) return;
  const big = G.opts.bigHud ? 1.25 : 1, top = L.solo ? 4 : 24 * big;
  let i = 0;
  for(const q of cs){
    if(q.y - r.y > r.v * 1.9 + 60) continue;
    const x = q.x === null ? L.x0 + L.w / 2 : clamp(X(q.x), L.x0 + 14, L.x0 + L.w - 14), y = top + 5 + i * 11 * big;
    const lab = CUE_LABEL[q.k], sz = fitText(c, lab, L.w - 20, 3.6 * big);
    const w = c.measureText(lab).width + 12 * big;
    const flash = Math.floor(G.time * 4) % 2;
    c.fillStyle = 'rgba(20,16,10,.72)'; rr(c, x - w / 2, y - 4.5 * big, w, 9 * big, 2); c.fill();
    c.fillStyle = flash ? '#ffd23a' : '#ffae1a'; c.beginPath(); c.moveTo(x - w / 2 + 4.5 * big, y - 3.4 * big); c.lineTo(x - w / 2 + 8.2 * big, y + 3 * big); c.lineTo(x - w / 2 + 0.8 * big, y + 3 * big); c.closePath(); c.fill();
    c.fillStyle = '#1a1a1a'; c.font = (3 * big) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', x - w / 2 + 4.5 * big, y + 0.8 * big);
    text(c, lab, x - w / 2 + 10 * big, y - sz / 2 + 0.3, sz, '#fff4d8');
    if(++i >= 2) break;
  }
}

/* ---------- HUD ---------- */
function gauge(c, x, y, w, h, frac, col, label){
  c.fillStyle = 'rgba(10,10,20,.6)'; rr(c, x, y, w, h, 1.5); c.fill();
  c.fillStyle = col; rr(c, x + 0.8, y + 0.8, Math.max(0, (w - 1.6) * clamp(frac, 0, 1)), h - 1.6, 1); c.fill();
  if(label) text(c, label, x + 1.5, y + (h - 3.4) / 2 + 0.2, 3.4, '#10131a');
}
function fuelCol(f){ return f < 0.2 ? (Math.floor(G.time * 4) % 2 ? '#ff5a4e' : '#ffae1a') : f < 0.4 ? '#ffd23a' : '#7ff0b0'; }
function minimap(c, x, y0, y1, w){
  c.fillStyle = 'rgba(10,10,20,.55)'; rr(c, x - w / 2, y0 - 2, w, y1 - y0 + 4, w / 2); c.fill();
  const P = wy => y1 - clamp(wy / RC.len, 0, 1) * (y1 - y0);
  c.fillStyle = 'rgba(127,240,176,.8)'; for(const cy of RC.cps) c.fillRect(x - w / 2, P(cy), w, 0.8);
  c.fillStyle = '#ffd45e'; c.fillRect(x - w / 2, y0 - 1, w, 1.4);
  for(const q of G.racers){ if(q.kind === 'ghost') continue; c.fillStyle = q.color; const py = P(q.y); if(q.kind === 'human'){ circ(c, x, py, w * 0.55); c.fill(); c.fillStyle = '#10131a'; c.font = (w * 0.8) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String((q.slot || 0) + 1), x, py + 0.3); } else { c.fillRect(x - w * 0.35, py - 0.6, w * 0.7, 1.2); } }
}
function drawStripHud(c, L, r){
  const big = G.opts.bigHud ? 1.25 : 1, jun = isJunior(r) || r.jun, name = G.mode === 'relay' ? (driverOf(r).name || r.drvName || r.name) : r.name;
  const clockTxt = clockOn(r) || (r.kind === 'human' && G.mode !== 'tt' && !jun && D().clock > 0) ? fmtClock(r.clock) : fmt(r.finished ? r.finishT : G.raceT);
  const warnClock = clockOn(r) && r.clock < 10 && !r.finished;
  const nRacers = G.racers.filter(q => q.kind !== 'ghost').length;
  if(L.solo){
    // left panel: stage, standings, progress strip
    const S = RC.S;
    c.fillStyle = 'rgba(12,14,24,.82)'; c.fillRect(0, 0, L.x0, VH); c.fillRect(L.x0 + L.w, 0, VW - L.x0 - L.w, VH);
    text(c, S.name.toUpperCase(), 6, 5, fitText(c, S.name.toUpperCase(), L.x0 - 10, 4.4), '#ffd45e');
    text(c, MODES.find(m => m.id === G.mode).label.toUpperCase() + ' · ' + D().label.toUpperCase(), 6, 12, 3.2, '#9aa4b8');
    text(c, 'COURSE ' + RC.code, 6, 18, 3.2, '#9aa4b8');
    minimap(c, 12, 30, touchShown ? 120 : 206, 5 * big);
    const list = G.racers.filter(q => q.kind !== 'ghost').sort((a, b) => a.place - b.place).slice(0, 8);
    list.forEach((q, i) => { const yy = 30 + i * 11 * big; c.fillStyle = q === r ? 'rgba(255,212,94,.18)' : 'rgba(255,255,255,.04)'; c.fillRect(20, yy - 1, L.x0 - 24, 10 * big); text(c, q.place + '', 22, yy + 1, 4 * big, q === r ? '#ffd45e' : '#fff4d8');
      const nm = (q.boss ? '♛ ' : '') + q.name; text(c, nm, 29, yy + 1, fitText(c, nm, L.x0 - 36, 3.6 * big), q.color);
      text(c, q.finished ? fmt(q.finishT) : q.out ? 'OUT' : Math.round(q.y / RC.len * 100) + '%', 29, yy + 5.5 * big, 2.8 * big, '#9aa4b8'); });
    // right panel: speed, gear, fuel, clock, checkpoints, score, power-ups
    const rx = L.x0 + L.w + 6, rw = VW - rx - 6;
    text(c, fitName(c, name, rw, 4.6), rx, 5, fitText(c, name, rw, 4.6 * big), r.color);
    outlined(c, String(Math.round(r.v * 1.12)), rx + rw / 2, 22, 13 * big, '#fff4d8', 'center', SANS);
    text(c, 'KM/H', rx + rw / 2, 30, 3.2, '#9aa4b8', 'center');
    const hi = r.boost; c.fillStyle = hi ? '#ffb347' : 'rgba(255,255,255,.12)'; rr(c, rx + rw / 2 + 1, 36, rw / 2 - 1, 8, 2); c.fill(); c.fillStyle = !hi ? '#7ff0b0' : 'rgba(255,255,255,.12)'; rr(c, rx, 36, rw / 2 - 1, 8, 2); c.fill();
    text(c, 'LO', rx + rw / 4, 38, 4, '#10131a', 'center'); text(c, 'HI', rx + rw * 0.75, 38, 4, '#10131a', 'center');
    text(c, 'FUEL', rx, 50, 3.4 * big, '#9aa4b8');
    if(jun) outlined(c, '∞ KIDS TANK', rx + rw / 2, 60, 5, '#7ff0b0'); else gauge(c, rx, 55, rw, 10 * big, r.fuel / (r.fuelMax || 100), fuelCol(r.fuel / (r.fuelMax || 100)), r.fuel < (r.fuelMax || 100) * 0.2 ? 'LOW!' : '');
    text(c, clockOn(r) ? 'TIME LEFT' : 'TIME', rx, 72, 3.4 * big, '#9aa4b8');
    outlined(c, clockTxt, rx + rw / 2, 83, 9 * big, warnClock && Math.floor(G.time * 4) % 2 ? '#ff5a4e' : '#fff4d8', 'center', SANS);
    text(c, 'CHECKPOINTS ' + Math.min(r.cp, RC.cps.length) + '/' + RC.cps.length, rx, 92, 3.2 * big, '#9aa4b8');
    text(c, 'POS', rx, 102, 3.4 * big, '#9aa4b8'); outlined(c, ordinal(r.place || 1), rx + rw / 2, 113, 9 * big, '#ffd45e', 'center', SANS); text(c, 'OF ' + nRacers, rx + rw / 2, 120, 3, '#9aa4b8', 'center');
    text(c, 'SCORE', rx, 128, 3.4 * big, '#9aa4b8'); text(c, Math.round(r.score).toLocaleString(), rx + rw, 127.5, 4.6 * big, '#ffd45e', 'right');
    const mult = r.mult || comboMult(r); if(mult > 1) outlined(c, 'COMBO x' + mult, rx + rw / 2, 139, 5 * big, '#9fe8ff');
    text(c, '● ' + (r.coins || 0), rx, 145, 3.6 * big, '#ffd54a');
    puIcons(c, rx + (touchShown ? 18 : 0), touchShown ? 143 : 154, r, big);
    if(G.mode === 'relay' && r.crew && r.crew.length > 1){ const nx = r.crew[(r.drv + 1) % r.crew.length]; text(c, 'NEXT: ' + (nx.name || '?'), rx, 196, fitText(c, 'NEXT: ' + (nx.name || '?'), rw, 3.4), '#9aa4b8'); }
    if(!A.Input.isTouch && G.state === 'race' && G.raceT < 8) text(c, 'TAP FIRE = HORN · HOLD = BOOST', rx, 204, fitText(c, 'TAP FIRE = HORN · HOLD = BOOST', rw, 3), '#9aa4b8');
    return;
  }
  // multi-strip: a compact bar at the top of each road
  const x0 = L.x0 + 2, w = L.w - 9, h = 21 * big;
  c.fillStyle = 'rgba(12,14,24,.72)'; c.fillRect(L.x0, 0, L.w, h);
  const nm = (G.mode === 'relay' ? '▶ ' : '') + name;
  text(c, nm, x0, 1.6, fitText(c, nm, w * 0.55, 4 * big), r.color);
  text(c, ordinal(r.place || 1), x0 + w * 0.62, 1.4, 4.4 * big, '#ffd45e');
  text(c, clockTxt, x0 + w, 1.6, fitText(c, clockTxt, w * 0.28, 4 * big), warnClock && Math.floor(G.time * 4) % 2 ? '#ff5a4e' : '#fff4d8', 'right');
  if(jun) text(c, '∞ FUEL', x0, 8 * big, 3.4 * big, '#7ff0b0'); else gauge(c, x0, 7.6 * big, w * 0.5, 5 * big, r.fuel / (r.fuelMax || 100), fuelCol(r.fuel / (r.fuelMax || 100)));
  text(c, Math.round(r.v * 1.12) + (r.boost ? ' HI' : ' LO'), x0 + w * 0.55, 8 * big, 3.4 * big, r.boost ? '#ffb347' : '#fff4d8');
  text(c, 'CP ' + Math.min(r.cp, RC.cps.length) + '/' + RC.cps.length, x0 + w, 8 * big, 3.2 * big, '#9aa4b8', 'right');
  const mult = r.mult || comboMult(r);
  text(c, Math.round(r.score).toLocaleString() + (mult > 1 ? ' x' + mult : ''), x0, 14.4 * big, 3.2 * big, mult > 1 ? '#9fe8ff' : '#ffd45e');
  puIcons(c, x0 + w * 0.5, 14 * big, r, big * 0.8);
  minimap(c, L.x0 + L.w - 3, h + 6, VH - 8, 3.4);
}
function fitName(c, s){ return s; }
function puIcons(c, x, y, r, big){
  let i = 0; const pu = r.pu || {};
  for(const k of ['shield', 'magnet', 'ghost', 'oil']){
    if(!(pu[k] > 0)) continue;
    const cx = x + 3.5 * big + i * 9 * big; c.fillStyle = PUP_COL[k]; circ(c, cx, y + 3 * big, 3 * big); c.fill();
    c.fillStyle = '#1a1a26'; c.font = (3.4 * big) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(k === 'oil' ? String(pu.oil) : PUP_CH[k], cx, y + 3.3 * big); i++;
  }
}
function drawBanner(c){
  const bn = G.banner; if(!bn) return;
  const age = G.time - bn.at, left = bn.t - age;
  if(left <= 0){ G.banner = null; return; }
  c.globalAlpha = Math.min(1, left * 3, age * 6);
  const y = G.state === 'count' ? 62 : 70;
  c.fillStyle = 'rgba(12,10,20,.5)'; c.fillRect(0, y - 11, VW, bn.sub ? 25 : 18);
  const sz = fitText(c, bn.text, VW - 20, 12); outlined(c, bn.text, VW / 2, y - 1, sz, bn.col, 'center', SANS);
  if(bn.sub) outlined(c, bn.sub, VW / 2, y + 9, fitText(c, bn.sub, VW - 20, 5), '#fff4d8');
  c.globalAlpha = 1;
}
function drawCountdown(c){
  const n = Math.ceil(3 - G.stateT);
  const cx = VW / 2, y = 108;
  c.fillStyle = 'rgba(12,10,20,.75)'; rr(c, cx - 30, y - 9, 60, 18, 4); c.fill();
  for(let i = 0; i < 3; i++){ const on = 3 - n > i, go = n <= 0; c.fillStyle = go ? '#7ff0b0' : on ? '#ff3b3b' : '#3a2020'; circ(c, cx - 18 + i * 18, y, 6); c.fill(); }
  outlined(c, n > 0 ? String(n) : 'GO!', cx, y + 22, 14, n > 0 ? '#ffd45e' : '#7ff0b0', 'center', SANS);
}

/* ---------- The photo finish (after every race) ---------- */
function drawPhoto(c){
  const P = G.photo, S = STAGES[P.stage];
  c.fillStyle = '#0c0e18'; c.fillRect(0, 0, VW, VH);
  const fx = 40, fy = 16, fw = 200, fh = 170, k = 1.25;
  c.fillStyle = '#f4efe2'; c.fillRect(fx - 5, fy - 5, fw + 10, fh + 22);
  c.save(); c.beginPath(); c.rect(fx, fy, fw, fh); c.clip();
  c.fillStyle = S.ground; c.fillRect(fx, fy, fw, fh);
  const cx = fx + fw / 2, lineY = fy + 64;
  c.fillStyle = S.shoulder; c.fillRect(cx - (HW + 4) * k, fy, (HW + 4) * 2 * k, fh);
  c.fillStyle = S.asphalt; c.fillRect(cx - HW * k, fy, HW * 2 * k, fh);
  for(let i = 0; i < 14; i++) for(let j = 0; j < 2; j++){ c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(cx - HW * k + i * HW * 2 * k / 14, lineY - j * 4, HW * 2 * k / 14 + 0.3, 4); }
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 0.5; for(let i = 0; i < 8; i++) line(c, fx, fy + 8 + i * 22, fx + fw, fy + 8 + i * 22);
  const px = display.scale * k;
  P.rows.forEach((q, i) => {
    const y = lineY + 10 + (q.gap !== null ? q.gap * 105 : 8 + (q.behind || 0)) * k - (i === 0 ? 8 : 0);
    if(y > fy + fh + 20) return;
    const x = cx + clamp(q.x, -HW + 6, HW - 6) * k;
    const sp = q.boss && BOSSES[P.stage].trick === 'tow' ? sprite('Btow' + Math.round(px * 4), 25, 35, px, cc => drawVeh(cc, 'tow', '#f2c14e', 20, 30)) : carSprite((CARS[q.car] || CARS[0]).shape, q.color, q.livery || 'plain', px);
    stamp(c, sp, x, y, 0);
    outlined(c, q.name.split(' ')[0].toUpperCase(), x, y + 15, 4, q.human ? q.color : '#fff4d8');
  });
  c.restore();
  // flash
  if(G.stateT < 0.5 && !G.opts.calm){ c.fillStyle = 'rgba(255,255,255,' + (1 - G.stateT * 2) + ')'; c.fillRect(0, 0, VW, VH); }
  c.fillStyle = '#3a3a44'; c.font = '5px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PHOTO FINISH · ' + S.name.toUpperCase(), fx + fw / 2, fy + fh + 8.5);
  // the order and the gaps
  const tx = 252;
  outlined(c, 'RESULT', tx + 60, 22, 9, '#ffd45e', 'center', SANS);
  P.rows.forEach((q, i) => {
    const y = 40 + i * 26;
    c.fillStyle = i === 0 ? 'rgba(255,212,94,.2)' : 'rgba(255,255,255,.06)'; rr(c, tx, y - 2, 124, 22, 3); c.fill();
    outlined(c, ordinal(q.place), tx + 11, y + 9, 7, i === 0 ? '#ffd45e' : '#fff4d8', 'center', SANS);
    text(c, q.name, tx + 22, y + 1.5, fitText(c, q.name, 96, 5), q.color);
    text(c, q.time !== null ? fmt(q.time) + (i && q.gap !== null ? '  +' + q.gap.toFixed(2) + 's' : '') : q.out === 'fuel' ? 'out of fuel' : q.out === 'time' ? 'out of time' : 'still racing', tx + 22, y + 10, 4, '#9aa4b8');
  });
  if(G.stateT > 1 && Math.floor(G.time * 2) % 2) text(c, 'FIRE to continue', tx + 62, 204, 4, '#9aa4b8', 'center');
}

/* ---------- Render ---------- */
function replayRacer(){
  const R = G.replay, q = recAt(R.rid, R.t), base = G.racers.find(x => x.id === R.rid);
  if(!q || !base) return null;
  const v = makeRacer({ id: -R.rid, kind: base.kind, name: base.name, color: base.color, car: base.car, livery: base.livery, x: q.x, y: q.y, ang: q.ang, v: q.v, boost: !!(q.f & 1), crew: base.crew, level: base.level, jun: base.jun });
  v.airT = q.f & 2 ? 0.5 : 0; v.airDur = 1; v.pu.shield = q.f & 4 ? 1 : 0; v.pu.ghost = q.f & 8 ? 1 : 0;
  return v;
}
function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  if(!G.C){ c.fillStyle = '#0c0e18'; c.fillRect(0, 0, canvas.width, canvas.height); return; }
  RC = G.C;
  c.setTransform(s, 0, 0, s, 0, 0);
  fxStep(Math.min(dt, 0.05) * (G.slowT > 0 || (G.net === 'guest' && false) ? 0.3 : 1));
  if(G.state === 'photo' && G.photo){ drawPhoto(c); drawBanner(c); return; }
  if(G.state === 'replay' && G.replay){
    const q = replayRacer();
    c.fillStyle = '#0c0e18'; c.fillRect(0, 0, VW, VH);
    if(q){
      const L = { x0: 96, w: 192, k: 1, carY: 150, solo: false };
      const keep = G.racers; G.racers = G.racers.map(r => { if(r.id === G.replay.rid || r.kind === 'ghost') return null; const p = recAt(r.id, G.replay.t); return p ? Object.assign(Object.create(Object.getPrototypeOf(r)), r, { x: p.x, y: p.y, ang: p.ang, boost: !!(p.f & 1), msgT: 0 }) : null; }).filter(Boolean);
      const keepM = q.msgT; q.msgT = 0; q.id = G.replay.rid;
      drawStrip(c, L, q, 9, G.replay.t);
      G.racers = keep; q.msgT = keepM;
    }
    c.fillStyle = '#000'; c.fillRect(0, 0, VW, 14); c.fillRect(0, VH - 14, VW, 14);
    outlined(c, '● REPLAY', 8, 7, 6, Math.floor(G.time * 2) % 2 ? '#ff5a4e' : '#fff4d8', 'left');
    outlined(c, G.replay.name + ': ' + G.replay.label, VW / 2, VH - 7, fitText(c, G.replay.name + ': ' + G.replay.label, VW - 20, 5), '#ffd45e');
    text(c, 'FIRE skips', VW - 8, 4, 3.6, '#9aa4b8', 'right');
    return;
  }
  const strips = G.racers.filter(r => r.kind === 'human');
  const Ls = layout(Math.max(1, strips.length));
  c.fillStyle = '#0c0e18'; c.fillRect(0, 0, VW, VH);
  strips.forEach((r, i) => { const L = Ls[i]; if(L) drawStrip(c, L, r, i, G.raceT); });
  if(!G.demo && !DBG.hud) strips.forEach((r, i) => { const L = Ls[i]; if(L) drawStripHud(c, L, r); });
  c.fillStyle = '#0c0e18'; for(let i = 1; i < Ls.length; i++) c.fillRect(Ls[i].x0 - 0.75, 0, 1.5, VH);
  if(G.state === 'count' && !G.demo) drawCountdown(c);
  drawBanner(c);
  if(G.demo){ c.fillStyle = 'rgba(12,10,20,0.3)'; c.fillRect(0, 0, VW, VH); }
  if(G.state === 'paused'){ c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, VW, VH); }
  if(G.slowT > 0 && !G.demo){ c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.strokeRect(3, 3, VW - 6, VH - 6); outlined(c, 'PHOTO FINISH', VW / 2, VH - 12, 6, '#ffffff'); }
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
  Promise.race([Promise.all([document.fonts.load('10px "Silkscreen"'), document.fonts.load('600 10px "Chakra Petch"')]), new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
} else boot();
window.__fulltank = G;
window.__fulltankDebug = { Net, STAGES, CARS, RIVALS, BOSSES, DIFF, buildCourse, setupRace, newRace, startChampionship, finishRace, resultsMenu, sim, step, render, display, makeRacer, stepRacer, plan, crash,
  titleMenu, openLobby, medalFor, STAGE_PAR, vehAt, vehX, cxAt, hwAt, crossState, gustAt, codeToSeed, seedToCode, dailySpec, startReplay, recAt, garageMenu, optionsMenu, get RC(){ return RC; }, set RC(v){ RC = v; }, humans, dropIn, carUnlocked, DBG, powerUp, dropItem, honk, oilHit, humanWorld, statics, wallet, liveryOf };
})();
