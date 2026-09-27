/* ROUND-UP RIDERS — side-on herding for 1–4 riders on one shared screen, or online.
   Inspired by the 1981 classic Stampede: one tense screen, a herd bolting for the open range,
   and a corral at the other end. Coax them, don't crash them.
   LEFT/RIGHT ride the trail, UP/DOWN cross the pasture, tap FIRE = "HYAH!" (a holler that turns
   the animals in front of you), hold FIRE = gentle herding (slow, calm, never spooks).
   Everything that isn't the herd (spawns, gates, gophers, tumbleweeds, gusts, crossing herds) is
   seeded and runs on the round clock, so online guests rebuild it themselves; snapshots carry only
   the riders and the animals. All art, sound and music are original and drawn in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;
const GAME = 'stampede';
A.Input.eightWay = true;            // free 2D riding: diagonals on sticks and the touch stick

/* ---------- Screen and field (logical pixels) ---------- */
const VW = 384, VH = 216;
const FONT = '"Silkscreen","Courier New",monospace';
const SANS = '"Chakra Petch","Trebuchet MS",sans-serif';
const FY0 = 76, FY1 = 208;                  // far and near edges of the pasture
const EDGE_X = 12;                          // the open range: past this line an animal is getting away
const PEN_X = 342, PEN_Y0 = 104, PEN_Y1 = 184, GATE_Y0 = 120, GATE_Y1 = 168;   // the corral and its gate
const GATE_MID = (GATE_Y0 + GATE_Y1) / 2;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;
function mulberry(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* perspective: things further up the field (smaller y) are a little smaller */
const depth = y => 0.95 + 0.35 * clamp((y - FY0) / (FY1 - FY0), 0, 1);

/* ---------- Difficulty ---------- */
const DIFF = {
  kids:   { label: 'Kids',   n: 8,  per: 2, speed: 0.74, juke: 0.4, spook: 99,  clock: 0,    lostMax: 0, edgeT: 5.5, autoBack: true,  penalty: 0, memory: 2,   home: 0.17, charge: false, reach: 1.25, gentleSpook: false, par: 1 },
  normal: { label: 'Normal', n: 12, per: 3, speed: 1,    juke: 1,   spook: 1,   clock: 1,    lostMax: 5, edgeT: 2.6, autoBack: false, penalty: 2, memory: 1,   home: 0,    charge: true,  reach: 1,    gentleSpook: false, par: 1 },
  pro:    { label: 'Pro',    n: 14, per: 3, speed: 1.14, juke: 1.4, spook: 0.88, clock: 0.9, lostMax: 3, edgeT: 1.7, autoBack: false, penalty: 3, memory: 0.8, home: 0,    charge: true,  reach: 0.95, gentleSpook: false, par: 1 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];
const MODES = [{ id: 'quick', label: 'Quick round' }, { id: 'champ', label: 'Ranch Championship' }, { id: 'tt', label: 'Time trial' }];
const DOG_OPTS = [{ id: 'auto', label: 'Kids only' }, { id: 'on', label: 'Always' }, { id: 'off', label: 'Off' }];

/* ---------- The herd ----------
   spd: calm drift speed, max: running speed, turn: how fast they change heading (rad/s),
   skit: how strongly riders push them, sense: how far away they feel you, crash: closing speed that spooks
   them on contact, mem: seconds they keep heading for the corral after being turned, val: points. */
const SPECIES = {
  cattle: { label: 'Cattle', one: 'steer', spd: 20, max: 60, turn: 2.4, skit: 0.9,  sense: 44, crash: 100, mem: 5, val: 100, size: 1,    r: 6,   juke: 0.5,  call: 'moo' },
  horse:  { label: 'Wild horses', one: 'mustang', spd: 27, max: 82, turn: 3.0, skit: 1.1, sense: 48, crash: 108, mem: 3.6, val: 150, size: 1.02, r: 6, juke: 1.1, call: 'neigh' },
  sheep:  { label: 'Sheep', one: 'sheep', spd: 18, max: 52, turn: 3.6, skit: 1.15, sense: 40, crash: 82,  mem: 4.5, val: 60,  size: 0.72, r: 4.4, juke: 0.35, call: 'baa', flock: true },
  boar:   { label: 'Wild boars', one: 'boar', spd: 23, max: 70, turn: 3.2, skit: 1.0,  sense: 40, crash: 92,  mem: 3.6, val: 120, size: 0.82, r: 5,   juke: 0.8,  call: 'oink', charger: true },
  bison:  { label: 'Bison', one: 'bison', spd: 18, max: 62, turn: 1.35, skit: 0.72, sense: 38, crash: 86,  mem: 6, val: 180, size: 1.22, r: 7.4, juke: 0.35, call: 'grunt', heavy: true }
};
const SPECIES_ORDER = ['cattle', 'horse', 'sheep', 'boar', 'bison'];
const SPECIES_TIP = {
  cattle: 'Steady cattle: get behind them and they walk home.',
  horse: 'Mustangs are fast and jumpy: turn them early, never ride at their faces.',
  sheep: 'Sheep bunch together, and if one panics they all do. Hold FIRE near a flock.',
  boar: 'Boars charge back if you corner them or spook them. Give them room.',
  bison: 'Bison are heavy and slow to turn, but once they head home they keep going.'
};

/* ---------- Biomes ----------
   herd: species weights; clock: seconds on Normal; haz: hazards; wx: weather; music: theme name */
const BIOMES = [
  { name: 'Sunny Ranch', short: 'Ranch', herd: { cattle: 1 }, clock: 100, wx: 'clear',
    sky: ['#5ea8e6', '#cfe9f7'], far: '#8fbf6a', mid: '#6fa04f', ground: ['#86c25a', '#6fae47'], tuft: '#4f8a34', edge: '#c9a46a',
    haz: { gopher: 3, rock: 3, bush: 4, fence: 0, flowers: 1 }, music: 'hoedown',
    fact: 'Cattle like to walk in a line behind a leader. Get behind the leader and the rest follow.' },
  { name: 'Red Rock Canyon', short: 'Canyon', herd: { horse: 1 }, clock: 100, wx: 'dust',
    sky: ['#f08a4b', '#fbd49a'], far: '#c7643b', mid: '#a84f2d', ground: ['#e0a568', '#cf8f52'], tuft: '#b27a3e', edge: '#8e4a26',
    haz: { snake: 2, tumble: 1, gust: 1, cactus: 4, rock: 3 }, music: 'western',
    fact: 'Wild mustangs can gallop over 50 km/h. Turn them early, before they get going.' },
  { name: 'Willow Creek', short: 'Creek', herd: { sheep: 0.7, cattle: 0.3 }, clock: 105, wx: 'mist',
    sky: ['#9cc9e8', '#e7f1ea'], far: '#7fb07a', mid: '#5f9a5b', ground: ['#8cc466', '#76b050'], tuft: '#4f8a3a', edge: '#6a8f4a',
    haz: { river: 1, cross: 1, mud: 2, bush: 3, gopher: 1, flowers: 1 }, music: 'hoedown',
    fact: 'Sheep feel safest in a bunch. Move slowly near a flock so they stay together.' },
  { name: 'Pine Foothills', short: 'Foothills', herd: { boar: 0.65, cattle: 0.35 }, clock: 105, wx: 'dusk',
    sky: ['#f2a36b', '#f7dfb0'], far: '#5d7f63', mid: '#3f6649', ground: ['#7fae5a', '#699a48'], tuft: '#3f7032', edge: '#4d3b2b',
    haz: { fence: 1, log: 3, gopher: 2, rock: 2, pine: 5, fireflies: 1 }, music: 'highland',
    fact: 'A wild boar that feels trapped turns around. Always leave it a way to run.' },
  { name: 'Frost Range', short: 'Frost', herd: { bison: 1 }, clock: 110, wx: 'snow',
    sky: ['#9fb7d6', '#e6eef7'], far: '#c9d6e6', mid: '#aabdd3', ground: ['#eef3f8', '#dfe8f2'], tuft: '#b8c7d8', edge: '#8ea3bd',
    haz: { ice: 2, drift: 3, fence: 1, rock: 2, pine: 3 }, music: 'highland',
    fact: 'Bison swing their big heads to push snow away and find the grass underneath.' },
  { name: 'Moonlight Badlands', short: 'Badlands', herd: { horse: 0.5, cattle: 0.5 }, clock: 110, wx: 'night',
    sky: ['#0e1433', '#2a2f5c'], far: '#2b2440', mid: '#221d33', ground: ['#5a4b5c', '#4c3f50'], tuft: '#3c3244', edge: '#1c1826',
    haz: { snake: 2, rock: 4, cactus: 2, gopher: 1, fireflies: 1 }, music: 'campfire',
    fact: 'Night herders sang to their cattle so a sudden noise wouldn’t start a stampede.' },
  { name: 'Seaside Bluffs', short: 'Seaside', herd: { sheep: 0.4, cattle: 0.3, boar: 0.3 }, clock: 115, wx: 'fog',
    sky: ['#86c3e8', '#e4f3fb'], far: '#5aa0c8', mid: '#8fc27a', ground: ['#9ccd73', '#86b95d'], tuft: '#5d9444', edge: '#c9b98a',
    haz: { crab: 3, fence: 1, cross: 1, rock: 3, bush: 2, flowers: 1 }, music: 'hoedown',
    fact: 'Salt-marsh sheep graze right next to the sea. The salty grass gives their wool a soft shine.' }
];
BIOMES.forEach((b, i) => { b.bi = i; });
const BIOME_OPEN = 3;         // the first three are open; a medal on one unlocks the next

/* ---------- Sounds: moos, baas, hollers and hoofbeats ---------- */
let netSfx = [];
const SX = {
  moo:     s => { s.tone({ wave: 'sawtooth', f: 150, f2: 118, t: 0.55, v: 0.07, vib: true, vibRate: 5, lp: 900, lpFrom: 300 }); s.tone({ wave: 'triangle', f: 300, f2: 236, t: 0.5, v: 0.03, attack: 0.08 }); },
  baa:     s => { s.tone({ wave: 'square', f: 560, f2: 500, t: 0.32, v: 0.035, vib: true, vibRate: 13, vibDepth: 0.05, lp: 1800 }); },
  neigh:   s => { s.tone({ wave: 'sawtooth', f: 700, f2: 1300, t: 0.18, v: 0.035, vib: true, vibRate: 18, vibDepth: 0.06, lp: 2400 }); s.tone({ wave: 'sawtooth', f: 1200, f2: 520, t: 0.34, v: 0.03, at: 0.16, vib: true, vibRate: 16, vibDepth: 0.06, lp: 2000 }); },
  oink:    s => { s.tone({ wave: 'square', f: 280, f2: 200, t: 0.08, v: 0.05, lp: 900 }); s.tone({ wave: 'square', f: 300, f2: 190, t: 0.09, v: 0.05, at: 0.12, lp: 900 }); },
  grunt:   s => { s.tone({ wave: 'sawtooth', f: 95, f2: 70, t: 0.35, v: 0.09, lp: 500, lpFrom: 200 }); s.noise({ t: 0.2, v: 0.05, f: 500, f2: 200 }); },
  hyah:    s => { s.noise({ t: 0.16, v: 0.1, f: 1500, type: 'bandpass', q: 4 }); s.tone({ wave: 'square', f: 520, f2: 760, t: 0.14, v: 0.035, lp: 2200 }); s.noise({ t: 0.03, v: 0.12, f: 6000, type: 'highpass', at: 0.02 }); },
  crack:   s => { s.noise({ t: 0.05, v: 0.2, f: 7000, type: 'highpass' }); s.tone({ wave: 'triangle', f: 2200, f2: 900, t: 0.04, v: 0.05 }); },
  nudge:   s => s.tone({ wave: 'triangle', f: 660, f2: 880, t: 0.07, v: 0.05 }),
  scatter: s => { s.noise({ t: 0.3, v: 0.12, f: 2400, f2: 600, type: 'bandpass' }); s.tone({ wave: 'triangle', f: 900, f2: 300, t: 0.3, v: 0.07 }); },
  corral:  s => { s.tone({ wave: 'triangle', f: 988, t: 0.08, v: 0.08 }); s.tone({ wave: 'triangle', f: 1319, t: 0.14, v: 0.08, at: 0.07 }); },
  latch:   s => { s.tone({ wave: 'square', f: 240, f2: 180, t: 0.05, v: 0.05 }); s.noise({ t: 0.04, v: 0.06, f: 2500, f2: 900 }); },
  stampede: s => { for(let i = 0; i < 6; i++) s.noise({ t: 0.07, v: 0.1, f: 700, f2: 250, at: i * 0.06 }); s.melody([[784, .06], [988, .06], [1175, .06], [1568, .16]], { wave: 'triangle', v: 0.09, at: 0.3 }); },
  rescue:  s => s.melody([[523, .05], [784, .05], [1047, .12]], { wave: 'triangle', v: 0.1 }),
  lost:    s => { s.tone({ wave: 'triangle', f: 660, f2: 220, t: 0.5, v: 0.1 }); s.tone({ wave: 'sine', f: 330, f2: 165, t: 0.5, v: 0.06, at: 0.05 }); },
  edge:    s => { s.tone({ wave: 'square', f: 1245, t: 0.06, v: 0.04 }); s.tone({ wave: 'square', f: 1245, t: 0.06, v: 0.04, at: 0.12 }); },
  rattle:  s => { for(let i = 0; i < 7; i++) s.noise({ t: 0.03, v: 0.06, f: 5200, type: 'highpass', at: i * 0.045 }); },
  gopher:  s => { s.tone({ wave: 'sine', f: 400, f2: 900, t: 0.08, v: 0.08 }); s.noise({ t: 0.08, v: 0.05, f: 900, f2: 300 }); },
  crab:    s => { for(let i = 0; i < 3; i++) s.tone({ wave: 'square', f: 1800, t: 0.02, v: 0.03, at: i * 0.05 }); },
  boof:    s => { s.tone({ wave: 'triangle', f: 200, f2: 600, t: 0.25, v: 0.14, vib: true }); s.noise({ t: 0.12, v: 0.1, f: 900, f2: 300 }); },
  charge:  s => { s.tone({ wave: 'sawtooth', f: 150, f2: 260, t: 0.3, v: 0.06, lp: 800 }); s.noise({ t: 0.3, v: 0.06, f: 600, f2: 300 }); },
  splash:  s => s.noise({ t: 0.22, v: 0.07, f: 3000, f2: 800, type: 'bandpass' }),
  hop:     s => { s.tone({ wave: 'triangle', f: 330, f2: 660, t: 0.16, v: 0.07 }); s.noise({ t: 0.08, v: 0.05, f: 1400, f2: 500, at: 0.24 }); },
  gateWarn: s => { for(let i = 0; i < 3; i++) s.tone({ wave: 'sine', f: 1760, t: 0.08, v: 0.05, at: i * 0.16 }); },
  gateShut: s => { s.tone({ wave: 'square', f: 200, f2: 130, t: 0.1, v: 0.07 }); s.noise({ t: 0.1, v: 0.08, f: 1200, f2: 300 }); },
  gust:    s => { s.noise({ t: 1.4, v: 0.08, f: 500, f2: 1600, type: 'bandpass', q: 2 }); s.tone({ wave: 'sine', f: 700, f2: 1100, t: 1.2, v: 0.02, vib: true }); },
  quack:   s => { s.tone({ wave: 'square', f: 560, f2: 420, t: 0.09, v: 0.04, lp: 1600 }); },
  whoa:    s => { s.tone({ wave: 'sawtooth', f: 900, f2: 500, t: 0.3, v: 0.03, vib: true, vibRate: 15, lp: 1800 }); s.noise({ t: 0.1, v: 0.06, f: 800, f2: 300 }); },
  streak:  s => s.melody([[1047, .04], [1319, .04], [1568, .04], [2093, .08]], { wave: 'triangle', v: 0.07 }),
  breakLost: s => s.tone({ wave: 'triangle', f: 500, f2: 300, t: 0.18, v: 0.06 }),
  clop:    s => { s.tone({ wave: 'triangle', f: 1300, f2: 700, t: 0.03, v: 0.018 }); },
  join:    s => s.melody([[659, .06], [880, .06], [1319, .1]], { v: 0.1 }),
  complete: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .18], [0, .04], [880, .1], [1047, .36]], { wave: 'triangle', v: 0.12 }); s.melody([[262, .3], [392, .3], [523, .5]], { wave: 'pulse25', v: 0.05 }); },
  timeUp:  s => s.melody([[784, .14], [659, .14], [523, .14], [392, .4]], { wave: 'triangle', v: 0.12 }),
  results: s => s.melody([[784, .1], [988, .1], [1175, .1], [1568, .16], [0, .05], [1319, .1], [1568, .36]], { wave: 'triangle', v: 0.12 }),
  unlock:  s => s.melody([[523, .08], [659, .08], [784, .08], [1047, .08], [1319, .08], [1568, .24]], { wave: 'triangle', v: 0.11 }),
  herdIn:  s => { s.noise({ t: 0.6, v: 0.07, f: 600, f2: 200 }); for(let i = 0; i < 4; i++) s.tone({ wave: 'triangle', f: 1300, f2: 700, t: 0.03, v: 0.02, at: i * 0.11 }); },
  dog:     s => { s.tone({ wave: 'square', f: 700, f2: 500, t: 0.06, v: 0.04, lp: 1800 }); s.tone({ wave: 'square', f: 760, f2: 520, t: 0.06, v: 0.04, at: 0.1, lp: 1800 }); }
};
function sfx(name){ if(G.demo) return; const f = SX[name]; if(f) try{ f(A.Sound); }catch(e){} if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('~' + name); }
function S(name){ if(G.demo) return; A.Sound.play(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name); }
function playNetSfx(n){ if(n[0] === '~'){ const f = SX[n.slice(1)]; if(f) try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* ---------- Music (all original) ---------- */
const MUSIC = {
  hoedown: {       // sunny ranch hoedown: fiddle-quick melody over a galloping bass
    bpm: 152, chords: ['G', 'C', 'G', 'D', 'G', 'C', 'D', 'G'], bass: 'gallop', arp: 'fast', leadVol: 0.07,
    lead: [
      'G5 A5 B5 - D6 - B5 - G5 A5 B5 - A5 - G5 -', 'E5 - G5 - C6 - B5 - A5 - G5 - E5 - G5 -',
      'D5 - G5 - B5 - D6 - B5 - G5 - D5 E5 F#5 G5', 'A5 - - - F#5 - D5 - F#5 - A5 - C6 - B5 A5',
      'B5 - D6 - B5 - G5 - B5 - D6 - G6 - - -', 'E6 - D6 - C6 - B5 - A5 - C6 - E6 - D6 -',
      'D6 - C6 - B5 - A5 - F#5 - A5 - D6 - C6 -', 'B5 - G5 - D5 - G5 - G5 - - - . . . .'],
    drums: ['k.c.s.c.k.c.s.c.', 'k.c.s.c.k.ckscc.', 'k.c.s.c.k.c.s.c.', 'k.cks.ckk.c.sscs']
  },
  western: {       // canyon twang: a plucked lead, clip-clop bongos and a lonely minor tune
    bpm: 118, chords: ['Am', 'Am', 'Dm', 'E', 'Am', 'C', 'Dm', 'E'], bass: 'gallop', arp: 'slow', sitar: true, leadVol: 0.085,
    lead: [
      'A4 - - - E5 - - - A5 - G5 - E5 - - -', 'D5 - C5 - B4 - C5 - A4 - - - . . . .',
      'D5 - - - F5 - - - A5 - G5 - F5 - E5 -', 'E5 - - - - - G#4 - B4 - D5 - E5 - - -',
      'A5 - - - G5 - E5 - C5 - D5 - E5 - - -', 'G5 - - - E5 - C5 - G4 - C5 - E5 - G5 -',
      'F5 - - - E5 - D5 - C5 - B4 - A4 - - -', 'G#4 - - - B4 - - - E5 - - - - - . .'],
    drums: ['k..bl.b.k..bl.bc', 'k..bl.b.s..bl.b.', 'k..bl.b.k..bl.bc', 'k..bl.b.s..bsbsb']
  },
  highland: {      // foothills and snow: a breathy whistle tune over a walking bass
    bpm: 108, chords: ['D', 'A', 'Bm', 'G', 'D', 'G', 'A', 'D'], bass: 'walk', arp: 'slow', flute: true, leadVol: 0.085,
    lead: [
      'F#5 - - - A5 - - - D6 - - - A5 - - -', 'E5 - - - A5 - - - C#6 - - - B5 - A5 -',
      'B5 - - - F#5 - - - D5 - F#5 - B5 - - -', 'G5 - - - - - B5 - D6 - - - B5 - - -',
      'A5 - - - F#5 - A5 - D6 - - - E6 - F#6 -', 'G6 - - - F#6 - E6 - D6 - - - B5 - - -',
      'A5 - - - C#6 - - - E6 - D6 - C#6 - - -', 'D6 - - - - - - - . . . . . . . .'],
    drums: ['k...h...s...h...', 'k...h...s...h.h.', 'k...h...s...h...', 'k...h.k.s...hhs.']
  },
  campfire: {      // moonlit badlands: a soft plucked campfire song
    bpm: 92, chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B'], bass: 'walk', arp: 'slow', steel: true, leadVol: 0.07,
    lead: [
      'E5 - - - G5 - B5 - - - A5 - G5 - - -', 'E5 - - - - - C5 - E5 - G5 - - - . .',
      'D5 - - - G5 - B5 - D6 - - - B5 - - -', 'A5 - - - F#5 - - - D5 - - - . . . .',
      'E5 - - - G5 - B5 - E6 - - - D6 - B5 -', 'C6 - - - B5 - G5 - E5 - - - G5 - - -',
      'A5 - - - C6 - - - B5 - A5 - E5 - - -', 'D#5 - - - F#5 - - - B5 - - - - - - -'],
    drums: ['k.......k.c.....', 'k...c...k.c.c...', 'k.......k.c.....', 'k...c...k.c.l.l.']
  },
  sunset: {        // results and the championship: a brass round-up fanfare
    bpm: 120, chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'], bass: 'tuba', arp: 'slow', brass: true, leadVol: 0.07,
    lead: [
      'G4 - C5 - E5 - G5 - - - E5 - G5 - - -', 'A5 - - - F5 - A5 - C6 - - - A5 - - -',
      'B5 - - - G5 - D5 - G5 - B5 - D6 - - -', 'C6 - - - G5 - E5 - C5 - - - . . . .',
      'E5 - - - A5 - C6 - E6 - - - C6 - A5 -', 'F5 - A5 - C6 - F6 - E6 - - - C6 - - -',
      'D6 - - - B5 - G5 - D6 - E6 - F6 - D6 -', 'C6 - - - - - - - . . . . . . . .'],
    drums: ['k...s...k.k.s...', 'k...s...k.k.s...', 'k...s...k.k.s...', 'k...s...z...r.r.']
  }
};

/* ---------- Building a round (deterministic from biome + seed + difficulty) ---------- */
function farFromAll(list, x, y, d){ return list.every(o => hyp(o.x - x, o.y - y) > d + (o.r || 0)); }
function buildRound(bi, diff, seed, riders, mode){
  const B = BIOMES[bi], d = DIFF[diff], rnd = mulberry(seed * 7919 + bi * 104729 + 13);
  const R = (a, b) => a + (b - a) * rnd();
  const H = B.haz;
  const L = { bi, B, diff, seed, riders, mode, obst: [], fences: [], river: null, patches: [], holes: [], snakes: [], tumble: [], cross: [], gusts: [], waves: [], deco: [] };
  const keep = [{ x: PEN_X - 20, y: GATE_MID, r: 40 }, { x: 40, y: 142, r: 18 }];   // corral mouth and the riders' start stay clear
  // river ford (a band across the whole pasture)
  if(H.river){ const x0 = Math.round(R(150, 190)); L.river = { x0, x1: x0 + 26 }; keep.push({ x: x0 + 13, y: 142, r: 0 }); }
  // fences with a gate that opens and shuts on a timer (riders hop fences, animals need the gate)
  for(let i = 0; i < (H.fence || 0); i++){
    let x = Math.round(R(118, 150) + i * 70);
    if(L.river && Math.abs(x - L.river.x0) < 50) x = L.river.x0 > 170 ? L.river.x0 - 56 : L.river.x1 + 30;
    const g0 = Math.round(R(FY0 + 14, FY1 - 56));
    L.fences.push({ x, g0, g1: g0 + 40, period: R(10.5, 13), open: R(6.4, 7.6), phase: R(0, 5) });
  }
  // obstacles
  const place = (k, n, r0, r1, xs, ys) => {
    for(let i = 0, tries = 0; i < n && tries < 200; tries++){
      const r = R(r0, r1), x = R(xs[0], xs[1]), y = R(ys ? ys[0] : FY0 + 8, ys ? ys[1] : FY1 - 6);
      if(!farFromAll(keep.concat(L.obst), x, y, r + 16)) continue;
      if(L.river && x > L.river.x0 - r - 8 && x < L.river.x1 + r + 8) continue;
      if(L.fences.some(f => Math.abs(f.x - x) < r + 10)) continue;
      L.obst.push({ k, x, y, r, s: rnd() }); i++;
    }
  };
  place('rock', H.rock || 0, 4, 7, [60, 310]);
  place('bush', H.bush || 0, 4.5, 6.5, [60, 310]);
  place('cactus', H.cactus || 0, 3.5, 4.5, [60, 310]);
  place('pine', H.pine || 0, 5, 6.5, [70, 300], [FY0 + 6, FY0 + 40]);
  for(let i = 0; i < (H.log || 0); i++){
    const before = L.obst.length; place('log', 1, 4, 4.5, [80, 300]);
    const o = L.obst[before]; if(o){ o.len = R(12, 18); }
  }
  // soft ground: mud, snowdrifts, ice (flat patches)
  const patch = (k, n) => { for(let i = 0, tries = 0; i < n && tries < 100; tries++){ const x = R(70, 300), y = R(FY0 + 18, FY1 - 16), rx = R(18, 30), ry = R(8, 13);
    if(!farFromAll(keep, x, y, rx)) continue; if(L.patches.some(p => hyp(p.x - x, p.y - y) < rx + p.rx)) continue; L.patches.push({ k, x, y, rx, ry }); i++; } };
  patch('mud', H.mud || 0); patch('drift', H.drift || 0); patch('ice', H.ice || 0);
  // gopher holes / crab burrows: pop up on a timer and startle anything nearby
  const holeN = (H.gopher || 0) + (H.crab || 0);
  for(let i = 0, tries = 0; i < holeN && tries < 100; tries++){
    const x = R(70, 320), y = R(FY0 + 10, FY1 - 8);
    if(!farFromAll(keep.concat(L.obst), x, y, 10)) continue;
    L.holes.push({ x, y, k: i < (H.gopher || 0) ? 'gopher' : 'crab', period: R(6, 9.5), phase: R(0, 9) }); i++;
  }
  // rattlesnakes (they stay put until someone hollers them away)
  for(let i = 0, tries = 0; i < (H.snake || 0) && tries < 100; tries++){
    const x = R(90, 262), y = R(FY0 + 14, FY1 - 12);
    if(!farFromAll(keep.concat(L.obst, L.snakes), x, y, 24)) continue;
    L.snakes.push({ id: i, x, y, hx: x, hy: y, st: 0, t: 0 }); i++;
  }
  // round length (seconds) and the release schedule
  const kids = diff === 'kids', total = d.n + d.per * Math.max(0, riders - 1) + (mode === 'tt' ? 0 : 0);
  L.total = total;
  L.clock = kids ? 0 : Math.round(B.clock * d.clock + (riders - 1) * 8);
  const spanT = (kids ? 70 : B.clock * 0.55) * (1 + (riders - 1) * 0.08);
  // pick species for the whole herd, then split into waves (sheep come as a flock)
  const sp = []; const names = Object.keys(B.herd), wsum = names.reduce((a, k) => a + B.herd[k], 0);
  while(sp.length < total){
    let u = rnd() * wsum, k = names[0]; for(const n of names){ u -= B.herd[n]; if(u <= 0){ k = n; break; } }
    const grp = k === 'sheep' ? Math.min(total - sp.length, 3 + Math.floor(rnd() * 3)) : Math.min(total - sp.length, 1 + Math.floor(rnd() * 3));
    sp.push({ k, n: grp });
    for(let j = 1; j < grp; j++) sp.push(null);
  }
  const groups = sp.filter(Boolean);
  let t = 1.2, id = 1;
  groups.forEach((g, gi) => {
    const from = gi === 0 ? 'right' : ['right', 'right', 'ridge', 'right', 'ridge'][Math.floor(rnd() * 5)];
    let x, y;
    if(from === 'right'){ x = 396; y = rnd() < 0.5 ? R(FY0 + 6, PEN_Y0 - 8) : R(PEN_Y1 + 8, FY1 - 4); }
    else { x = R(170, 320); y = FY0 - 14; }
    const w = { t, k: g.k, from, list: [] };
    for(let j = 0; j < g.n; j++) w.list.push({ id: id++, x: x + (from === 'right' ? j * 11 : (j - g.n / 2) * 9), y: y + (from === 'right' ? (rnd() - 0.5) * 12 : -j * 5), seed: Math.floor(rnd() * 1e9) });
    L.waves.push(w);
    t += spanT / groups.length * R(0.7, 1.3);
  });
  // tumbleweeds and wind gusts (canyon): scheduled for the whole round
  const tEnd = 240;
  if(H.gust){ for(let g = R(16, 22); g < tEnd; g += R(17, 24)) L.gusts.push({ t0: g, dur: R(2.6, 3.6) }); }
  if(H.tumble){ for(let s = R(3, 6); s < tEnd; s += R(2.5, 4.5)){ const gust = L.gusts.some(g => s > g.t0 - 1 && s < g.t0 + g.dur); L.tumble.push({ id: L.tumble.length, t0: s, y: R(FY0 + 6, FY1 - 6), v: (gust ? 1.6 : 1) * R(42, 64), dir: gust || rnd() < 0.7 ? -1 : 1, r: R(3.5, 5.5) }); } }
  // another ranch hand's herd crossing the pasture (ducks behind a farmer on a mule)
  if(H.cross){ for(let c = R(24, 34); c < tEnd; c += R(30, 42)){ L.cross.push({ t0: c, x: Math.round(R(120, 280)), dur: R(7, 9), n: 4 + Math.floor(rnd() * 3), kind: bi === 6 ? 'goat' : 'duck' }); } }
  // decoration for the background (flowers, tufts, pebbles, snow sparkles)
  for(let i = 0; i < 150; i++) L.deco.push({ x: R(0, VW), y: R(FY0 + 2, FY1), k: rnd(), s: rnd() });
  return L;
}

/* ---------- Things that run on the round clock (identical on every screen) ---------- */
function gateState(f, t){
  const c = ((t + f.phase) % f.period + f.period) % f.period;
  return { open: c < f.open, warn: c < f.open && c > f.open - 1.6, u: c };
}
function holeState(h, t){
  const c = ((t + h.phase) % h.period + h.period) % h.period;
  return c < 1.3 ? 'up' : c > h.period - 0.7 ? 'wiggle' : 'down';
}
function gustAt(L, t){ for(const g of L.gusts){ if(t >= g.t0 && t < g.t0 + g.dur) return 1; if(t >= g.t0 - 1.6 && t < g.t0) return 0.5; } return 0; }
function tumblePos(w, t){ const u = t - w.t0; if(u < 0) return null; const x = w.dir < 0 ? 400 - w.v * u : -16 + w.v * u; if(x < -20 || x > 404) return null; return { x, y: w.y - Math.abs(Math.sin(u * 5)) * 3, rot: u * w.v / w.r * w.dir }; }
function crossMembers(c, t){
  const u = (t - c.t0) / c.dur; if(u < -0.05 || u > 1.25) return null;
  const out = [], y0 = FY0 - 16 + u * (FY1 - FY0 + 40);
  for(let j = 0; j <= c.n; j++){ const y = y0 - j * 10; if(y > FY0 - 12 && y < FY1 + 6) out.push({ x: c.x + Math.sin(t * 3 + j) * 1.5, y, lead: j === 0, j }); }
  return out;
}

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, time: 0, stateT: 0, roundT: 0, net: null,
  diff: A.Store.get('stampede.diff', 'normal'), biome: A.Store.get('stampede.biome', 0), mode: A.Store.get('stampede.mode', 'quick'),
  dogOpt: A.Store.get('stampede.dog', 'auto'), unlocked: A.Store.get('stampede.unlocked', BIOME_OPEN),
  L: null, riders: [], players: [], animals: [], waveIx: 0, score: 0, streak: 0, bestStreak: 0, mult: 1, corr: 0, lost: 0, scatters: 0,
  clockPen: 0, group: null, stampedes: 0, banner: null, fx: [], results: null, champ: null, rec: null, bot: false, over: null, seed: 1, rid: 0
};
if(!DIFF[G.diff]) G.diff = 'normal';
if(!MODES.some(m => m.id === G.mode)) G.mode = 'quick';
if(!DOG_OPTS.some(o => o.id === G.dogOpt)) G.dogOpt = 'auto';
G.unlocked = clamp(G.unlocked | 0, BIOME_OPEN, BIOMES.length);
if(!(G.biome >= 0 && G.biome < G.unlocked)) G.biome = 0;
const D = () => DIFF[G.diff];
const running = () => G.state === 'play' || G.demo;
function fmt(t){ if(!(t >= 0)) return '--:--'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function fmtClock(t){ t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }
let netFx = [];
/* floating text: "NICE!", "+300", "SAVED!" (sent to guests as small events) */
function pop(text, x, y, col, big){
  if(G.demo && !big) return;
  const f = { text, x: Math.round(x), y: Math.round(y), col: col || '#fff4d8', big: big ? 1 : 0, t: 0 };
  G.fx.push(f); if(G.fx.length > 40) G.fx.shift();
  if(Net && Net.role === 'host' && netFx.length < 16) netFx.push([f.text, f.x, f.y, f.col, f.big]);
}
function banner(text, sub, col, t){ G.banner = { text, sub: sub || '', col: col || '#ffd45e', t: t || 2.2, at: G.time }; }

/* ---------- Riders ---------- */
let nextId = 1;
const HORSES = ['#9a5b32', '#e0b56a', '#f1ece2', '#3b2f2f', '#7b4a2b'];
function newStats(){ return { corrals: 0, rescues: 0, hollers: 0, scatters: 0, gentleT: 0, dist: 0, hops: 0, stamp: 0, bestStreak: 0, stuns: 0, sp: { cattle: 0, horse: 0, sheep: 0, boar: 0, bison: 0 } }; }
function makeRider(o){
  return Object.assign({ id: nextId++, x: 40, y: GATE_MID, vx: 0, vy: 0, face: 1, fireT: 0, fireWas: false, gentle: false, spurT: 0, holT: 0, hdx: 1, hdy: 0,
    cool: 0, stunT: 0, hopT: 0, rearT: 0, slowT: 0, msg: '', msgT: 0, msgCol: '#fff', gait: 0, invT: 0, aiT: 0, tgt: null, fireBot: 0, stats: newStats(), horse: 0 }, o);
}
function say(r, msg, col, t){ r.msg = msg; r.msgT = t || 1.1; r.msgCol = col || '#fff4d8'; }

function controls(r){
  if(r.dog || (r.bot || (G.bot && r.human) || G.demo)) return botControls(r);
  const s = A.Input.get(r.source), on = !!(s && s.connected);
  if(!on) return { mx: 0, my: 0, fire: false };
  let mx = (s.right ? 1 : 0) - (s.left ? 1 : 0), my = (s.down ? 1 : 0) - (s.up ? 1 : 0);
  if(mx && my){ mx *= 0.7071; my *= 0.7071; }
  return { mx, my, fire: !!s.fire };
}

/* ---------- Field geometry helpers ---------- */
function inPen(x, y, pad){ return x > PEN_X - pad && y > PEN_Y0 - pad && y < PEN_Y1 + pad; }
function gapOpen(f){ return gateState(f, G.roundT).open; }
function terrainAt(x, y){
  const L = G.L; let k = 1, ice = false, water = false;
  if(L.river && x > L.river.x0 && x < L.river.x1){ k = 0.58; water = true; }
  for(const p of L.patches){
    const u = (x - p.x) / p.rx, v = (y - p.y) / p.ry;
    if(u * u + v * v < 1){ if(p.k === 'ice') ice = true; else k = Math.min(k, p.k === 'mud' ? 0.62 : 0.6); }
  }
  return { k, ice, water };
}
/* solid things for the herd: obstacles, the corral, closed fences, crossing herds */
function pushOutObstacles(o, rad){
  const L = G.L;
  for(const ob of L.obst){
    if(ob.k === 'log'){
      // a log is a short capsule lying across the field
      const hx = ob.len / 2, dx = clamp(o.x - ob.x, -hx, hx), cx = ob.x + dx, dd = hyp(o.x - cx, o.y - ob.y), min = ob.r + rad;
      if(dd < min && dd > 0.001){ o.x = cx + (o.x - cx) / dd * min; o.y = ob.y + (o.y - ob.y) / dd * min; o.hitObs = true; }
      continue;
    }
    const dd = hyp(o.x - ob.x, o.y - ob.y), min = ob.r + rad;
    if(dd < min && dd > 0.001){ o.x = ob.x + (o.x - ob.x) / dd * min; o.y = ob.y + (o.y - ob.y) / dd * min; o.hitObs = true; }
  }
}
function penBlock(o, rad, gateOk){
  if(!inPen(o.x, o.y, rad)) return false;
  if(gateOk && o.y > GATE_Y0 + 1 && o.y < GATE_Y1 - 1 && o.x < PEN_X + 2) return false;   // the gate itself is open
  // push to the nearest outside edge (left, top or bottom)
  const dl = o.x - (PEN_X - rad), dt = o.y - (PEN_Y0 - rad), db = (PEN_Y1 + rad) - o.y;
  const m = Math.min(dl, dt, db);
  if(m === dl) o.x = PEN_X - rad; else if(m === dt) o.y = PEN_Y0 - rad; else o.y = PEN_Y1 + rad;
  o.hitObs = true;
  return true;
}

/* ---------- The herd ---------- */
function makeAnimal(w, m){
  const sp = SPECIES[w.k], rnd = mulberry(m.seed);
  const a = { id: m.id, k: w.k, x: m.x, y: m.y, head: w.from === 'right' ? Math.PI : Math.PI / 2, spd: sp.spd, st: 'enter', stT: 0, drive: 0, burst: 0, by: 0,
    rnd, jukeT: 2 + rnd() * 4, jukeHold: 0, jukeDir: 1, alert: 0, clean: true, px: 0, py: 0, wob: rnd() * TAU, from: w.from, dawdle: 0, tgt: 0, pen: -1, calm: 0 };
  a.enterY = w.from === 'right' ? a.y : FY0 + 10 + rnd() * 10;
  return a;
}
/* where a driven animal heads: straight in through the gate, or (if it's beside the corral) out and round to the front of it */
function gateAim(a){
  // a fence between it and the corral? first through that fence's gate
  let fx = null;
  for(const f of G.L.fences) if(f.x > a.x + 3 && (!fx || f.x < fx.x)) fx = f;
  if(fx){ const m = (fx.g0 + fx.g1) / 2; return { x: fx.x + 14, y: m + clamp(a.y - m, -(fx.g1 - fx.g0) / 2 + 9, (fx.g1 - fx.g0) / 2 - 9) }; }
  // close to the corral but not lined up with the gate: slide across in front of it first
  if(PEN_X - a.x < 34 && Math.abs(a.y - GATE_MID) > 16) return { x: a.x - 8, y: GATE_MID + (a.y < GATE_MID ? -8 : 8) };
  return { x: PEN_X + 12, y: GATE_MID + clamp(a.y - GATE_MID, -15, 15) };
}
function spook(a, r, why, chain){
  if(a.st !== 'run' && a.st !== 'enter') return;
  const sp = SPECIES[a.k], d = D();
  a.st = 'scatter'; a.stT = 1.1; a.drive = 0; a.clean = false;
  const ang = r ? Math.atan2(a.y - r.y, a.x - r.x) : a.rnd() * TAU;
  a.head = ang + (a.rnd() - 0.5) * 1.1; a.spd = sp.max;
  if(G.log) G.log.push([Math.round(G.roundT), a.k, why || 'SCATTER!', r ? (r.dog ? 'dog' : 'rider') : 'env', Math.round(a.x), Math.round(a.y)]);
  if(!chain){
    G.scatters++; if(r && r.stats) r.stats.scatters++;
    breakStreak(a.x, a.y);
    if(d.penalty && G.L.clock && r){ G.clockPen += d.penalty; pop('-' + d.penalty + 's', a.x, a.y - 22, '#ff8a6a'); }
    pop(why || 'SCATTER!', a.x, a.y - 14, '#ff8a6a');
    G.score = Math.max(0, G.score - 50);
    sfx('scatter'); sfx(sp.call);
  }
  // sheep panic together
  if(sp.flock) for(const b of G.animals) if(b !== a && b.k === a.k && (b.st === 'run') && hyp(b.x - a.x, b.y - a.y) < 34) spook(b, r, null, true);
  // boars may turn round and charge whoever spooked them
  if(sp.charger && d.charge && r && !r.dog && a.rnd() < 0.55){ a.st = 'charge'; a.stT = 1.05; a.alert = 0.32; a.tgt = r.id; a.spd = 0; sfx('charge'); pop('GRRR!', a.x, a.y - 22, '#ffb14a'); }
}
function breakStreak(x, y){
  if(G.streak >= 3) pop('STREAK LOST', x, y - 30, '#ff8a6a');
  G.streak = 0; G.mult = 1;
}
function rescue(a, r){
  const sp = SPECIES[a.k], d = D();
  a.st = 'run'; a.x = Math.max(a.x, EDGE_X + 4); a.head = 0; a.drive = sp.mem * d.memory * 1.2; a.burst = 0.8; a.by = r ? r.id : 0; a.saved = 1.8;
  if(!a.rescued){ a.rescued = true; if(r && r.stats) r.stats.rescues++; G.score += 150; pop('SAVED! +150', a.x + 10, a.y - 16, '#7ff0b0'); }
  else pop('SAVED!', a.x + 10, a.y - 16, '#7ff0b0');
  sfx('rescue'); sfx(sp.call);
}
function corral(a){
  const sp = SPECIES[a.k];
  a.st = 'in'; a.stT = 0; a.drive = 0;
  G.corr++; G.streak++;
  G.bestStreak = Math.max(G.bestStreak, G.streak);
  const m = Math.min(5, 1 + Math.floor(G.streak / 3));
  if(m > G.mult){ pop('x' + m + ' COMBO!', PEN_X - 20, GATE_Y0 - 16, '#ffd45e', true); sfx('streak'); }
  G.mult = m;
  const pts = sp.val * G.mult; G.score += pts;
  // credit whoever drove it (or the nearest rider)
  let r = G.riders.find(q => q.id === a.by && !q.dog && !q.ghost);
  if(!r){ let best = 1e9; for(const q of G.riders){ if(q.dog || q.ghost) continue; const dd = hyp(q.x - a.x, q.y - a.y); if(dd < best){ best = dd; r = q; } } }
  if(r){ r.stats.corrals++; r.stats.sp[a.k]++; r.stats.bestStreak = Math.max(r.stats.bestStreak, G.streak); }
  // pen slot: animals mill about inside the corral
  a.pen = G.corr - 1;
  const cols = 4, i = a.pen % 16, row = Math.floor(i / cols), col = i % cols;
  a.px = PEN_X + 8 + col * 9 + (row % 2) * 4; a.py = PEN_Y0 + 10 + row * 18 + (a.rnd() - 0.5) * 6;
  pop('+' + pts, PEN_X - 6, a.y - 12, '#ffe27a');
  sfx('corral'); if(a.rnd() < 0.5) sfx(sp.call);
  // bunches score a STAMPEDE bonus
  const g = G.group;
  if(g && G.roundT - g.t < 1.4){ g.n++; g.t = G.roundT; if(r) g.by.push(r.id); }
  else { finishGroup(); G.group = { n: 1, t: G.roundT, by: r ? [r.id] : [] }; }
}
function finishGroup(){
  const g = G.group; G.group = null;
  if(!g || g.n < 3) return;
  const bonus = g.n * g.n * 50;
  G.score += bonus; G.stampedes++;
  for(const id of g.by){ const r = G.riders.find(q => q.id === id); if(r) r.stats.stamp++; }
  pop('STAMPEDE x' + g.n + '! +' + bonus, PEN_X - 60, GATE_Y0 - 30, '#ffd45e', true);
  banner('STAMPEDE BONUS!', g.n + ' in one go · +' + bonus, '#ffd45e', 1.6);
  sfx('stampede');
}
function loseAnimal(a){
  const d = D(), sp = SPECIES[a.k];
  if(d.autoBack){ a.st = 'back'; a.x = -10; a.stT = 1.2 + a.rnd(); a.head = 0; pop('BACK YOU COME!', 30, a.y - 14, '#7ff0b0'); sfx(sp.call); return; }
  a.st = 'lost'; G.lost++;
  breakStreak(20, a.y);
  pop('GOT AWAY!', 34, a.y - 14, '#ff8a6a'); sfx('lost');
  if(G.mode === 'tt') pop('+5s', 34, a.y - 24, '#ff8a6a');
}

/* One animal, one step (host only) */
function stepAnimal(a, dt){
  const sp = SPECIES[a.k], d = D(), L = G.L;
  const ramp = G.ramp;
  a.wob += dt * (2 + a.spd * 0.12);
  if(a.alert > 0) a.alert -= dt;
  if(a.st === 'lost') return;
  if(a.st === 'in'){
    // mill about inside the corral
    a.stT += dt;
    const tx = a.px + Math.sin(G.time * 0.4 + a.id) * 3, ty = a.py + Math.cos(G.time * 0.33 + a.id * 2) * 2;
    const dx = tx - a.x, dy = ty - a.y, dd = hyp(dx, dy);
    if(dd > 1){ a.head = Math.atan2(dy, dx); a.spd = Math.min(24, dd * 3); a.x += dx / dd * a.spd * dt; a.y += dy / dd * a.spd * dt; } else a.spd = 0;
    return;
  }
  if(a.st === 'edge'){
    // at the open range: a short window to win it back
    a.stT -= dt; a.spd = 10; a.head = Math.PI; a.x -= 10 * dt;
    for(const r of G.riders){ if(r.ghost) continue; if(hyp(r.x - a.x, r.y - a.y) < 24){ rescue(a, r); return; } }
    if(a.stT <= 0) loseAnimal(a);
    return;
  }
  if(a.st === 'back'){
    a.stT -= dt; if(a.stT > 0) return;
    a.head = 0; a.spd = sp.spd * 0.9; a.x += a.spd * dt;
    if(a.x > 30){ a.st = 'run'; a.drive = sp.mem * 2; }
    return;
  }
  // the lanes beside the corral are entry-only: anything in there walks back out onto the pasture
  if(a.st !== 'enter' && a.x > PEN_X - 5 && (a.y < GATE_Y0 + 1 || a.y > GATE_Y1 - 1)){ a.st = 'enter'; a.from = 'right'; a.drive = 0; }
  const t = terrainAt(a.x, a.y);
  let tgtSpd = sp.spd, want = null, W = 0;
  if(a.st === 'enter'){
    // walking in from the edge of the screen
    if(a.from === 'right'){ want = { x: -1, y: (a.y < GATE_MID ? -0.15 : 0.15) }; if(a.x < PEN_X - 14) a.st = 'run'; }
    else { want = { x: -0.3, y: 1 }; if(a.y > a.enterY) a.st = 'run'; }
    tgtSpd = sp.spd * 1.5;
  } else if(a.st === 'scatter'){
    a.stT -= dt; tgtSpd = sp.max * 1.05; want = { x: Math.cos(a.head), y: Math.sin(a.head) };
    if(a.stT <= 0){ a.st = 'run'; a.calm = Math.max(a.calm, 1.5); }
  } else if(a.st === 'charge'){
    a.stT -= dt;
    const r = G.riders.find(q => q.id === a.tgt);
    if(a.alert > 0 || !r){ tgtSpd = 0; want = r ? { x: r.x - a.x, y: r.y - a.y } : null; }
    else { want = { x: r.x - a.x, y: r.y - a.y }; tgtSpd = 100; }
    if(a.stT <= 0){ a.st = 'run'; a.calm = 4; if(r) a.head = Math.atan2(a.y - r.y, a.x - r.x); }
  } else {
    // --- running free: drift toward the open range, unless riders say otherwise ---
    if(a.drive > 0){ a.drive -= dt; if(a.drive <= 0 && !(a.breakaway > 0)) a.graze = 3.2 * (1 - 0.55 * ramp) * (0.7 + a.rnd() * 0.6); }
    if(a.burst > 0) a.burst -= dt;
    if(a.calm > 0) a.calm -= dt;
    if(a.saved > 0) a.saved -= dt;
    const wander = Math.sin(G.roundT * 0.45 + a.id * 1.7) * 0.4;
    let wx = -1, wy = wander;
    const aim = gateAim(a), gx = aim.x - a.x, gy = aim.y - a.y, gl = hyp(gx, gy) || 1;
    // close to the corral and heading home: they see the others in there and keep going
    if(a.drive > 0 && gl < 95) a.drive = Math.max(a.drive, 1.2);
    // an escort riding behind keeps them going; so does a driven herd-mate right next to them
    if(a.drive > 0 && a.drive < 1) for(const r of G.riders){ if(r.ghost) continue; const ex = r.x - a.x, ey = r.y - a.y, ed = hyp(ex, ey); if(ed < 64 && (ex * gx + ey * gy) / (gl * (ed || 1)) < -0.2){ a.drive = 1; break; } }
    if(a.drive < 0.8 && a.st === 'run' && !(a.breakaway > 0)) for(const b of G.animals){ if(b !== a && b.st === 'run' && b.drive > 1.2 && hyp(b.x - a.x, b.y - a.y) < (sp.flock ? 30 : 22)){ a.drive = 1; break; } }
    const dr = Math.min(1, a.drive / 1.2);
    wx = wx * (1 - dr) + gx / gl * dr * 1.3; wy = wy * (1 - dr) + gy / gl * dr * 1.3;
    if(d.home){ wx += gx / gl * d.home; wy += gy / gl * d.home; }
    // riders push
    let fx = 0, fy = 0;
    for(const r of G.riders){
      if(r.ghost || r.hopT > 0.05 || a.saved > 0) continue;
      const R = sp.sense * (r.gentle ? 1.4 : 1) * (r.dog ? 0.9 : 1);
      const dx = a.x - r.x, dy = a.y - r.y, dd = hyp(dx, dy);
      if(dd > R || dd < 0.01) continue;
      const w = Math.pow(1 - dd / R, 1.1) * sp.skit * (r.gentle ? 0.75 : 1) * (r.dog ? 0.7 : 1);
      fx += dx / dd * w; fy += dy / dd * w; W += w;
    }
    if(W > 0.02){
      const fl = hyp(fx, fy) || 1;
      const k = Math.min(0.9, W * 1.4);
      wx = wx * (1 - k) + fx / fl * k * 1.5; wy = wy * (1 - k) + fy / fl * k * 1.5;
      // pushed toward the corral: remember it for a while
      if(fx / fl > 0.15) a.drive = Math.min(sp.mem * d.memory * (1 - 0.35 * ramp), a.drive + dt * 3.2 * Math.min(1, W * 2));
      // a boar with its back to a wall turns round
      if(sp.charger && d.charge && W > 0.55 && a.calm <= 0){
        const px = a.x + fx / fl * 16, py = a.y + fy / fl * 16;
        if((py < FY0 + 2 || py > FY1 - 1 || inPen(px, py, 2) || G.L.obst.some(o => hyp(o.x - px, o.y - py) < o.r + 3)) && W > 0.7 && a.rnd() < 0.5){
          let near = null, best = 1e9; for(const r of G.riders){ if(r.ghost || r.dog) continue; const dd = hyp(r.x - a.x, r.y - a.y); if(dd < best){ best = dd; near = r; } }
          if(near && !near.gentle && best < 30){ a.st = 'charge'; a.stT = 1.05; a.alert = 0.4; a.tgt = near.id; sfx('charge'); pop('CORNERED!', a.x, a.y - 20, '#ffb14a'); return; }
        }
      }
    }
    // sheep keep together
    if(sp.flock){
      let cx = 0, cy = 0, hx = 0, hy = 0, n = 0;
      for(const b of G.animals){ if(b === a || b.k !== a.k || b.st !== 'run') continue; const dd = hyp(b.x - a.x, b.y - a.y); if(dd < 44){ cx += b.x; cy += b.y; hx += Math.cos(b.head); hy += Math.sin(b.head); n++; } }
      if(n){ cx = cx / n - a.x; cy = cy / n - a.y; const cl = hyp(cx, cy) || 1; wx += cx / cl * 0.35 + hx / n * 0.3; wy += cy / cl * 0.35 + hy / n * 0.3; }
    }
    // wind gusts push everything toward the open range
    if(gustAt(L, G.roundT) === 1){ wx -= 0.55; }
    // juke: a head toss (the "!"), then a swerve; late in the round a driven animal may break away
    a.jukeT -= dt * d.juke * sp.juke * (1 + ramp * 1.3);
    if(a.jukeT <= 0 && a.alert <= 0 && a.jukeHold <= 0){ a.alert = 0.34; a.jukeT = 2.2 + a.rnd() * 3.6; a.jukeDir = a.rnd() < 0.5 ? -1 : 1; a.jukePending = true; }
    if(a.jukePending && a.alert <= 0){
      a.jukePending = false; a.jukeHold = 0.45 + ramp * 0.3;
      if(a.drive > 0 && !G.demo && a.rnd() < 0.12 + ramp * 0.35 * d.juke){ a.drive = 0; a.breakaway = 1; }
    }
    if(a.jukeHold > 0){ a.jukeHold -= dt; const an = Math.atan2(wy, wx) + a.jukeDir * (0.8 + ramp * 0.5), l = hyp(wx, wy); wx = Math.cos(an) * l; wy = Math.sin(an) * l; }
    // steer round rocks and bushes ahead
    const hx = Math.cos(a.head), hy = Math.sin(a.head);
    for(const o of L.obst){
      const dx = o.x - a.x, dy = o.y - a.y, ahead = dx * hx + dy * hy;
      if(ahead < 0 || ahead > 22 + o.r) continue;
      const side = -dx * hy + dy * hx, clear = o.r + sp.r + 3 + (o.len ? o.len / 2 : 0);
      if(Math.abs(side) < clear){ const s = side > 0 ? -1 : 1; wx += -hy * s * 1.2; wy += hx * s * 1.2; }
    }
    // head for an open gate when a fence is in the way
    for(const f of L.fences){
      const dx = f.x - a.x;
      if(Math.abs(dx) > 34 || Math.sign(dx) !== Math.sign(wx) || Math.abs(wx) < 0.1) continue;
      if(a.y > f.g0 + 4 && a.y < f.g1 - 4 && gapOpen(f)) continue;
      const gy = (f.g0 + f.g1) / 2 - a.y; wy += Math.sign(gy) * 0.9;
    }
    // river: sometimes they stop for a drink
    if(t.water && W < 0.05 && a.drive <= 0){ if(a.dawdle <= 0 && a.rnd() < dt * 0.35) a.dawdle = 1.4; }
    if(a.dawdle > 0){ a.dawdle -= dt; tgtSpd *= 0.2; }
    // after being driven a while they stop to graze, then remember they wanted to run
    if(a.graze > 0 && a.drive <= 0){ a.graze -= dt; if(W < 0.05){ wx = Math.cos(a.head) * 0.2 + wander * 0.3; wy = Math.sin(a.head) * 0.2; } }
    want = { x: wx, y: wy };
    tgtSpd = a.graze > 0 && a.drive <= 0 && W < 0.05 ? 5 : (a.drive > 0 ? Math.max(sp.spd * 1.2, sp.max * 0.5) : sp.spd) + (sp.max - sp.spd) * Math.min(1, W * 1.1) + (a.burst > 0 ? sp.max * 0.35 : 0);
    tgtSpd *= (1 + ramp * 0.3);
    if(a.breakaway > 0){ a.breakaway -= dt; tgtSpd = sp.max; }
  }
  tgtSpd *= d.speed * t.k;
  // turn toward where it wants to go
  if(want && (want.x || want.y)){
    const target = Math.atan2(want.y, want.x);
    let da = target - a.head; while(da > Math.PI) da -= TAU; while(da < -Math.PI) da += TAU;
    const tr = sp.turn * (t.ice ? 0.45 : 1) * (a.st === 'scatter' ? 1.6 : 1) * (a.st === 'charge' ? 2.5 : 1);
    a.head += clamp(da, -tr * dt, tr * dt);
  }
  const acc = t.ice ? 30 : 110;
  a.spd += clamp(tgtSpd - a.spd, -acc * dt, acc * dt);
  const ox = a.x, oy = a.y;
  a.x += Math.cos(a.head) * a.spd * dt; a.y += Math.sin(a.head) * a.spd * dt * 0.85;
  // the field's edges, the corral, rocks and fences
  if(a.st !== 'enter'){
    if(a.y < FY0 + 3){ a.y = FY0 + 3; a.head = -a.head; }
    if(a.y > FY1 - 1){ a.y = FY1 - 1; a.head = -a.head; }
    if(a.x > 380){ a.x = 380; a.head = Math.PI - a.head; }
  }
  // beside the corral is fenced off: once they're out on the pasture, the only way in is the gate
  if(a.st !== 'enter' && a.x > PEN_X - 5 && ox <= PEN_X - 5 && (a.y < GATE_Y0 + 2 || a.y > GATE_Y1 - 2)){ a.x = PEN_X - 5; a.head = Math.PI - a.head; }
  // into the corral through the gate?
  if(a.x > PEN_X - 1 && ox <= PEN_X - 1 && a.y > GATE_Y0 + 2 && a.y < GATE_Y1 - 2 && a.st !== 'enter'){ corral(a); return; }
  a.hitObs = false;
  penBlock(a, SPECIES[a.k].r, true);
  pushOutObstacles(a, sp.r);
  for(const f of L.fences){
    const crossed = (ox - f.x) * (a.x - f.x) <= 0 && ox !== a.x;
    if(!crossed) continue;
    if(a.y > f.g0 + 2 && a.y < f.g1 - 2 && gapOpen(f)) continue;
    a.x = f.x + (ox < f.x ? -2.5 : 2.5); a.head = Math.PI - a.head; a.hitObs = true;
  }
  if(a.hitObs && a.st === 'run') a.head += (a.rnd() - 0.5) * 0.5;
  // crossing herds are solid
  for(const c of L.cross){ const ms = crossMembers(c, G.roundT); if(!ms) continue; for(const m of ms){ const dd = hyp(a.x - m.x, a.y - m.y), min = sp.r + (m.lead ? 6 : 3.5); if(dd < min && dd > 0.01){ a.x = m.x + (a.x - m.x) / dd * min; a.y = m.y + (a.y - m.y) / dd * min; } } }
  // tumbleweeds startle
  for(const w of L.tumble){ if(G.tumbleGone.has(w.id)) continue; const p = tumblePos(w, G.roundT); if(!p) continue; if(hyp(p.x - a.x, p.y - a.y) < w.r + sp.r + 2 && a.st === 'run'){ a.head = Math.atan2(a.y - p.y, a.x - p.x); a.burst = 0.4; } }
  // gophers and crabs pop up and startle
  for(const h of L.holes){ if(holeState(h, G.roundT) !== 'up') continue; const dd = hyp(h.x - a.x, h.y - a.y);
    if(dd < 22 && a.st === 'run'){ if(dd < 11 && G.diff === 'pro' && a.calm <= 0) spook(a, null, 'EEK!'); else { a.head = Math.atan2(a.y - h.y, a.x - h.x); a.burst = 0.35; a.calm = 0.5; } } }
  // rattlesnakes
  for(const s of L.snakes){ if(s.st === 2) continue; const dd = hyp(s.x - a.x, s.y - a.y);
    if(dd < 30 && a.st === 'run'){ s.rattle = 0.8;
      const into = (Math.cos(a.head) * (s.x - a.x) + Math.sin(a.head) * (s.y - a.y)) / (dd || 1);
      if(dd < 17 && into > 0.3 && a.calm <= 0 && !(s.tired > 0)){ s.tired = 7;
        if(G.diff === 'kids'){ a.head = Math.atan2(a.y - s.y, a.x - s.x); a.burst = 0.5; a.calm = 2; } else { spook(a, null, 'RATTLE!'); a.calm = 4; sfx('rattle'); } }
      else if(a.calm <= 0 && into > 0){ a.head += Math.sign(Math.sin(Math.atan2(s.y - a.y, s.x - a.x) - a.head)) * -0.12; } } }
  // the open range
  if(a.x < EDGE_X && a.st !== 'enter' && a.st !== 'back'){
    a.st = 'edge'; a.stT = D().edgeT; a.x = EDGE_X - 1; sfx('edge'); pop('!', a.x + 6, a.y - 18, '#ff5a4e', true);
  }
}
function animalSeparation(){
  const list = G.animals;
  for(let i = 0; i < list.length; i++){
    const a = list[i]; if(a.st === 'lost' || a.st === 'in' || a.st === 'back') continue;
    for(let j = i + 1; j < list.length; j++){
      const b = list[j]; if(b.st === 'lost' || b.st === 'in' || b.st === 'back') continue;
      const dx = b.x - a.x, dy = b.y - a.y, dd = hyp(dx, dy), min = (SPECIES[a.k].r + SPECIES[b.k].r) * 0.9;
      if(dd < min && dd > 0.01){ const p = (min - dd) / 2, nx = dx / dd, ny = dy / dd; a.x -= nx * p; a.y -= ny * p; b.x += nx * p; b.y += ny * p;
        // being bumped from behind by a driven herd-mate keeps you moving
        if(a.drive > 1 && b.drive < 0.6 && nx > 0.3) b.drive = Math.max(b.drive, 0.8);
        if(b.drive > 1 && a.drive < 0.6 && nx < -0.3) a.drive = Math.max(a.drive, 0.8);
      }
    }
  }
}

/* ---------- Riding ---------- */
const RIDE_X = 94, RIDE_Y = 68;
function stepRider(r, dt){
  if(r.ghost) return;
  const d = D(), L = G.L;
  if(r.msgT > 0) r.msgT -= dt;
  if(r.cool > 0) r.cool -= dt;
  if(r.holT > 0) r.holT -= dt;
  if(r.spurT > 0) r.spurT -= dt;
  if(r.invT > 0) r.invT -= dt;
  if(r.slowT > 0) r.slowT -= dt;
  if(r.hopT > 0) r.hopT -= dt;
  const live = G.state === 'play' || G.demo;
  const ctl = live ? controls(r) : { mx: 0, my: 0, fire: false };
  if(r.stunT > 0 || r.rearT > 0){
    r.stunT -= dt; r.rearT -= dt; ctl.mx = ctl.my = 0; ctl.fire = false;
  }
  // FIRE: a quick tap hollers, holding it herds gently
  if(ctl.fire){ r.fireT += dt; }
  else { if(r.fireWas && r.fireT < 0.18 && !r.dog) holler(r); r.fireT = 0; }
  r.fireWas = ctl.fire;
  r.gentle = ctl.fire && r.fireT >= 0.18;
  if(r.gentle) r.stats.gentleT += dt;
  if(ctl.mx) r.face = ctl.mx > 0 ? 1 : -1;
  const t = terrainAt(r.x, r.y);
  let k = t.k * (r.gentle ? 0.55 : 1) * (r.spurT > 0 ? 1.5 : 1) * (r.slowT > 0 ? 0.5 : 1) * (r.dog ? 0.9 : 1);
  const tx = ctl.mx * RIDE_X * k, ty = ctl.my * RIDE_Y * k;
  const acc = t.ice ? 150 : 560;
  r.vx += clamp(tx - r.vx, -acc * dt, acc * dt); r.vy += clamp(ty - r.vy, -acc * dt, acc * dt);
  const ox = r.x;
  r.x += r.vx * dt; r.y += r.vy * dt;
  r.x = clamp(r.x, 5, PEN_X - 6); r.y = clamp(r.y, FY0 + 2, FY1);
  penBlock(r, 6);
  pushOutObstacles(r, 5);
  const sp = hyp(r.vx, r.vy);
  r.gait += sp * dt * 0.16;
  r.stats.dist += sp * dt;
  // fences: riders hop them (animals need the gate)
  for(const f of L.fences){
    if((ox - f.x) * (r.x - f.x) < 0 && !(r.y > f.g0 + 2 && r.y < f.g1 - 2 && gapOpen(f))){
      if(r.hopT <= 0){ r.hopT = 0.42; if(!r.dog){ r.stats.hops++; sfx('hop'); say(r, 'HUP!', '#ffe27a', 0.6); } }
    }
  }
  if(t.water && sp > 30 && Math.random() < dt * 3) sfx('splash');
  // snakes make the horse rear up
  for(const s of L.snakes){ if(s.st === 2) continue; const dd = hyp(s.x - r.x, s.y - r.y);
    if(dd < 30) s.rattle = 0.8;
    if(dd < 14 && r.rearT <= 0 && r.invT <= 0 && !r.dog && G.diff !== 'kids'){ r.rearT = 0.6; r.invT = 1.4; r.vx = -r.vx * 0.3; r.vy = -r.vy * 0.3; say(r, 'WHOA!', '#ff8a6a'); sfx('whoa'); sfx('rattle'); } }
  // gophers trip you up a little
  for(const h of L.holes){ if(holeState(h, G.roundT) === 'up' && hyp(h.x - r.x, h.y - r.y) < 8 && r.slowT <= 0 && !r.dog){ r.slowT = 0.5; say(r, h.k === 'crab' ? 'PINCH!' : 'OOPS!', '#ffb14a', 0.7); sfx(h.k === 'crab' ? 'crab' : 'gopher'); } }
  // tumbleweeds go poof
  for(const w of L.tumble){ if(G.tumbleGone.has(w.id)) continue; const p = tumblePos(w, G.roundT); if(p && hyp(p.x - r.x, p.y - r.y) < w.r + 6){ G.tumbleGone.add(w.id); if(!r.dog) pop('POOF!', p.x, p.y - 10, '#f5deb3'); } }
  // bumping the neighbour's herd
  for(const c of L.cross){ const ms = crossMembers(c, G.roundT); if(!ms) continue; for(const m of ms){ const dd = hyp(r.x - m.x, r.y - m.y);
    if(dd < (m.lead ? 9 : 6) && dd > 0.01){ r.x = m.x + (r.x - m.x) / dd * (m.lead ? 9 : 6); if(r.invT <= 0 && !r.dog){ r.invT = 1.2; r.slowT = 0.6; say(r, m.lead ? 'SORRY!' : 'QUACK!', '#ffb14a'); sfx('quack'); G.score = Math.max(0, G.score - 30); } } } }
}
/* HYAH! a holler that turns the animals in front of you */
function holler(r){
  if(r.cool > 0 || r.stunT > 0) return;
  const d = D();
  r.cool = 0.5; r.holT = 0.35; r.spurT = 0.28;
  const sp = hyp(r.vx, r.vy);
  let hx = sp > 20 ? r.vx / sp : r.face, hy = sp > 20 ? r.vy / sp : 0;
  r.hdx = hx; r.hdy = hy;
  sfx('hyah');
  const reach = 42 * d.reach;
  let clean = 0, bad = 0;
  for(const a of G.animals){
    if(a.st !== 'run' && a.st !== 'edge' && a.st !== 'enter' && a.st !== 'scatter') continue;
    const dx = a.x - r.x, dy = a.y - r.y, dd = hyp(dx, dy);
    if(a.st === 'edge'){ if(dd < reach){ rescue(a, r); clean++; } continue; }
    if(dd > reach || dd < 0.01) continue;
    if((dx * hx + dy * hy) / dd < 0.62) continue;          // not in front of you
    if(a.st === 'scatter' || (a.st === 'enter' && a.x > PEN_X - 14)) continue;
    const s = SPECIES[a.k];
    // hollering at an animal's face, or right on top of it, spooks it
    const face = (Math.cos(a.head) * -dx + Math.sin(a.head) * -dy) / dd;
    if(G.diff !== 'kids' && ((face > 0.62 && a.spd > 14) || dd < 9)){ spook(a, r, dd < 9 ? 'TOO CLOSE!' : 'HEAD-ON!'); bad++; continue; }
    const aim = gateAim(a), gx = aim.x - a.x, gy = aim.y - a.y, gl = hyp(gx, gy) || 1;
    const nx = hx * 0.55 + gx / gl * 0.45, ny = hy * 0.55 + gy / gl * 0.45;
    a.head = Math.atan2(ny, nx); a.drive = s.mem * d.memory * (1 - 0.3 * G.ramp) * (nx > 0 ? 1 : 0.4); a.burst = 0.6; a.by = r.id; a.calm = 0.3;
    if(a.st === 'enter') a.st = 'run';
    clean++;
  }
  // hollering at a rattlesnake shoos it away
  for(const s of G.L.snakes){ if(s.st === 2) continue; const dx = s.x - r.x, dy = s.y - r.y, dd = hyp(dx, dy);
    if(dd < reach + 6 && (dx * hx + dy * hy) / (dd || 1) > 0.4){ s.st = 2; s.t = 0; s.vx = dx / (dd || 1); pop('SHOO!', s.x, s.y - 10, '#7ff0b0'); } }
  if(clean && !bad){ r.stats.hollers += clean; G.score += 10 * clean; say(r, clean > 1 ? 'HYAH! x' + clean : 'HYAH!', '#ffe27a', 0.7); sfx('crack'); }
  else if(!bad) say(r, 'HYAH!', '#f4efe2', 0.5);
}
/* rider ↔ animal contact */
function contacts(){
  const d = D();
  for(const r of G.riders){
    if(r.ghost || r.hopT > 0.08) continue;
    for(const a of G.animals){
      if(a.st === 'in' || a.st === 'lost' || a.st === 'back') continue;
      const sp = SPECIES[a.k], dx = a.x - r.x, dy = a.y - r.y, dd = hyp(dx, dy), min = sp.r + 5.5;
      if(dd > min || dd < 0.01) continue;
      const nx = dx / dd, ny = dy / dd;
      if(a.st === 'edge'){ rescue(a, r); continue; }
      if(a.st === 'enter'){ r.x -= nx * (min - dd); r.y -= ny * (min - dd); continue; }   // walking in: the rider makes room
      if(a.st === 'charge'){
        if(a.alert <= 0 && a.tgt === r.id && r.stunT <= 0 && r.invT <= 0 && !r.dog){
          r.stunT = 0.8; r.invT = 1.6; r.vx = -nx * 80; r.vy = -ny * 60; r.stats.stuns++;
          say(r, 'BOOF!', '#ffb14a'); sfx('boof'); a.stT = 0;
        }
        continue;
      }
      // crashing into it: riding hard at its face, or ramming it very fast from any side
      const impact = r.vx * nx + r.vy * ny, headOn = -(Math.cos(a.head) * nx + Math.sin(a.head) * ny);
      if(!r.gentle && !r.dog && d.spook < 99 && a.st === 'run' && ((headOn > 0.55 && impact > 58 * d.spook) || impact > sp.crash * d.spook)){ spook(a, r, headOn > 0.55 ? 'HEAD-ON!' : 'SPOOKED!'); continue; }
      const over = min - dd;
      if(sp.heavy){
        // bison hardly budge: the rider bounces
        a.x += nx * over * 0.3; a.y += ny * over * 0.3; r.x -= nx * over * 0.7; r.y -= ny * over * 0.7;
        const vn = r.vx * nx + r.vy * ny; if(vn > 0){ r.vx -= nx * vn * 1.4; r.vy -= ny * vn * 1.4; }
      } else { a.x += nx * over; a.y += ny * over; }
      if(nx > 0.2 && a.st === 'run'){ a.drive = Math.max(a.drive, sp.mem * d.memory * 0.6); a.by = r.id; }
      else if(a.st === 'run' && !r.dog) a.by = r.id;
    }
  }
  // riders nudge each other apart
  const rs = G.riders.filter(r => !r.ghost);
  for(let i = 0; i < rs.length; i++) for(let j = i + 1; j < rs.length; j++){
    const a = rs[i], b = rs[j], dx = b.x - a.x, dy = b.y - a.y, dd = hyp(dx, dy);
    if(dd < 10 && dd > 0.01){ const p = (10 - dd) / 2; a.x -= dx / dd * p; a.y -= dy / dd * p; b.x += dx / dd * p; b.y += dy / dd * p; }
  }
}
/* snakes that were shooed slither off and come back somewhere nearby later */
function stepSnakes(dt){
  for(const s of G.L.snakes){
    if(s.rattle > 0){ if(s.rattleSfx <= 0 || s.rattleSfx === undefined){ s.rattleSfx = 1.2; if(!G.demo && s.st !== 2) sfx('rattle'); } s.rattle -= dt; }
    if(s.rattleSfx > 0) s.rattleSfx -= dt;
    if(s.tired > 0) s.tired -= dt;
    if(s.st === 2){ s.t += dt; s.x += (s.vx || 1) * 40 * dt; if(s.t > 22){ s.st = 0; s.x = s.hx; s.y = s.hy; } }
  }
}

/* ---------- Bot riders (debug bot, demo, and the ranch dog) ---------- */
function botControls(r){
  const out = { mx: 0, my: 0, fire: false };
  r.aiT -= 1 / 60;
  const act = G.animals.filter(a => a.st === 'run' || a.st === 'edge' || a.st === 'scatter' || a.st === 'charge' || (a.st === 'enter' && a.x < PEN_X - 14));
  if(r.aiT <= 0 || !r.tgt || !act.includes(r.tgt)){
    r.aiT = 0.35;
    let best = null, bs = -1e9;
    for(const a of act){
      if(r.dog && a.x > 190 && a.st !== 'edge') continue;      // Biscuit guards the open-range half; the corral is the riders' job
      let u = (400 - a.x) * 1.2 - hyp(a.x - r.x, a.y - r.y) * 0.5;
      if(a.st === 'edge') u += 420;
      if(a.drive > 1.2 && a.st === 'run') u -= 160;
      if(a.st === 'charge') u -= 300;
      if(G.riders.some(q => q !== r && !q.ghost && q.tgt === a)) u -= 240;
      if(r.tgt === a) u += 40;
      if(u > bs){ bs = u; best = a; }
    }
    r.tgt = best;
  }
  let a = r.tgt;
  let px = r.dog ? 70 : 60, py = GATE_MID;
  const tap = () => { if(r.fireBot <= 0 && !r.fireWas) r.fireBot = 2; };
  // a rattlesnake next to the animal we're working? shoo it first
  if(!r.dog && a && a.st === 'run'){
    for(const s of G.L.snakes){ if(s.st === 2) continue; if(hyp(s.x - a.x, s.y - a.y) < 55 && hyp(s.x - r.x, s.y - r.y) < 90){ r.snake = s; break; } }
  }
  if(r.snake && (r.snake.st === 2 || !a)) r.snake = null;
  if(r.snake){
    const s = r.snake, dx = s.x - r.x, dy = s.y - r.y, dd = hyp(dx, dy);
    if(dd < 40 && dd > 16 && r.cool <= 0 && (dx * r.vx + dy * r.vy) / (dd * (hyp(r.vx, r.vy) || 1)) > 0.75) tap();
    a = null;
    if(dd < 18){ px = s.x - dx / (dd || 1) * 34; py = s.y - dy / (dd || 1) * 34; r.snakeSlow = false; }
    else if(r.cool <= 0.05){ px = s.x; py = s.y; r.snakeSlow = dd < 44; } else { px = s.x - dx / (dd || 1) * 30; py = s.y - dy / (dd || 1) * 30; r.snakeSlow = false; }
  }
  if(a){
    if(a.st === 'edge'){ px = a.x + 4; py = a.y; }
    else if(a.st === 'charge'){ px = r.x + (r.x - a.x); py = r.y + (r.y - a.y); }
    else {
      const lead = a.st === 'run' ? 0.35 : 0.1;
      const ax = a.x + Math.cos(a.head) * a.spd * lead, ay = a.y + Math.sin(a.head) * a.spd * lead;
      const aim = gateAim(a), gx = aim.x - ax, gy = aim.y - ay, gl = hyp(gx, gy) || 1, ux = gx / gl, uy = gy / gl;
      const back = SPECIES[a.k].heavy ? 13 : 17;
      px = ax - ux * back; py = ay - uy * back;
      // on the corral side of it? go round, keeping a wide berth
      const rx = r.x - ax, ry = r.y - ay, along = rx * ux + ry * uy;
      if(along > -6){ const side = (-rx * uy + ry * ux) >= 0 ? 1 : -1, off = SPECIES[a.k].sense + 6; px = ax - uy * side * off - ux * 8; py = ay + ux * side * off - uy * 8;
        if(py < FY0 + 4 || py > FY1 - 2){ px = ax + uy * side * off - ux * 8; py = ay - ux * side * off - uy * 8; } }
      const dd = hyp(r.x - px, r.y - py), da = hyp(r.x - a.x, r.y - a.y);
      // in position and it isn't looking at us: HYAH!
      const face = (Math.cos(a.head) * (r.x - a.x) + Math.sin(a.head) * (r.y - a.y)) / (da || 1);
      if(!r.dog && dd < 14 && da < 34 && face < 0.35 && a.drive < 1.6 && r.cool <= 0 && a.st === 'run' && G.state !== 'count'){ tap(); }
      if(!r.dog && SPECIES[a.k].flock && da < 42 && along < -6) r.gentleBot = 0.5;
    }
  }
  if(r.fireBot > 0){ out.fire = r.fireBot === 2; r.fireBot--; }
  else if(r.gentleBot > 0){ r.gentleBot -= 1 / 60; out.fire = true; }
  py = clamp(py, FY0 + 3, FY1 - 1); px = clamp(px, 8, PEN_X - 8);
  let dx = px - r.x, dy = py - r.y;
  // steer round snakes and rocks
  for(const s of G.L.snakes){ if(s.st === 2 || s === r.snake) continue; const sx = r.x - s.x, sy = r.y - s.y, sd = hyp(sx, sy); if(sd < 26){ dx += sx / sd * 30; dy += sy / sd * 30; } }
  const dl = hyp(dx, dy);
  if(dl > 2){ const k = r.snake && r.snakeSlow ? 0.4 : clamp(dl / 26, 0.3, 1); out.mx = dx / dl * k; out.my = dy / dl * k; }
  return out;
}

/* ---------- Round flow ---------- */
function dogWanted(){ return G.dogOpt === 'on' || (G.dogOpt === 'auto' && G.diff === 'kids'); }
function setupRound(hs, seed){
  G.seed = seed; G.rid++;
  const nh = Math.max(1, hs.length);
  G.L = buildRound(G.biome, G.diff, seed, nh, G.mode);
  G.riders = []; G.animals = []; G.waveIx = 0; G.score = 0; G.streak = 0; G.bestStreak = 0; G.mult = 1; G.corr = 0; G.lost = 0; G.scatters = 0;
  G.clockPen = 0; G.group = null; G.stampedes = 0; G.banner = null; G.fx = []; G.results = null; G.roundT = 0; G.ramp = 0; G.over = null; G.tumbleGone = new Set();
  hs.forEach((p, i) => G.riders.push(makeRider({ human: true, source: p.source, name: p.name, color: p.color, slot: p.slot, x: 30 + (i % 2) * 14, y: GATE_MID + (i - (hs.length - 1) / 2) * 20, horse: p.slot % HORSES.length })));
  if(G.demo){ for(let i = 0; i < 2; i++) G.riders.push(makeRider({ bot: true, name: ['Dusty', 'Sage'][i], color: A.PLAYER_COLORS[i + 1], slot: 10 + i, x: 30, y: GATE_MID - 20 + i * 40, horse: i + 1 })); }
  if(!G.demo && dogWanted()) G.riders.push(makeRider({ dog: true, name: 'Biscuit', color: '#d9a55a', slot: 20, x: 26, y: GATE_MID + 30 }));
  if(G.mode === 'tt' && !G.demo){ const g = loadGhost(); if(g) G.riders.push(...g); G.rec = { k: -1, runs: {} }; } else G.rec = null;
}
function startDemo(){
  G.demo = true; G.players = [];
  const keep = G.biome;
  G.biome = Math.floor(Math.random() * BIOMES.length);
  const dk = G.diff; G.diff = 'normal';
  setupRound([], Math.floor(Math.random() * 1e6));
  G.demoBiome = G.biome; G.biome = keep; G.demoDiff = dk; G.diff = dk;
}
function newRound(players, seed){
  G.demo = false; G.players = players.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot }));
  const s = seed !== undefined ? seed : G.mode === 'tt' ? 1000 + G.biome : Math.floor(Math.random() * 1e6);
  setupRound(G.players, s);
  G.state = 'count'; G.stateT = 0;
  A.Menu.close(); A.keepAwake();
  const kinds = Array.from(new Set(G.L.waves.map(w => w.k)));
  banner(BIOMES[G.biome].name.toUpperCase(), kinds.map(k => SPECIES[k].label).join(' + ') + ' · ' + G.L.total + ' to round up', '#ffd45e', 3);
  A.toast(kinds.map(k => SPECIES_TIP[k]).join(' '), 4200);
}
function startChampionship(players){
  G.mode = 'champ';
  G.champ = { round: 0, biomes: BIOMES.map((b, i) => i).filter(i => i < G.unlocked), score: 0, saved: 0, total: 0, rows: [], stats: {} };
  G.biome = G.champ.biomes[0]; newRound(players);
}
/* Drop-in: a new controller presses FIRE mid-round and rides in from the left */
function dropIn(){
  if(G.demo || G.state !== 'play') return;
  const hum = G.riders.filter(r => r.human);
  if(hum.length >= 4) return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.riders.some(r => r.source === s.id)) continue;
    const used = hum.map(r => r.slot), slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.riders.map(r => r.name));
    const r = makeRider({ human: true, source: s.id, name, color: A.PLAYER_COLORS[slot], slot, x: 20, y: GATE_MID, horse: slot % HORSES.length, invT: 1.5, fireWas: true, fireT: 1 });
    G.riders.push(r);
    say(r, 'JOINED! YEE-HAW!', '#7ff0b0', 2);
    G.players.push({ source: s.id, name, color: r.color, slot }); G.players.sort((a, b) => a.slot - b.slot);
    S('join');
    return;
  }
}
function timeLeft(){ return G.L && G.L.clock ? G.L.clock - G.roundT - G.clockPen : Infinity; }
function sim(dt){
  const L = G.L;
  if(running()) G.roundT += dt;
  // release the herd in waves
  while(G.waveIx < L.waves.length && G.roundT >= L.waves[G.waveIx].t && (G.state === 'play' || G.demo)){
    const w = L.waves[G.waveIx++];
    for(const m of w.list) G.animals.push(makeAnimal(w, m));
    if(!G.demo){ if(G.waveIx === 1) banner('HERE THEY COME!', '', '#ffd45e', 1.6); sfx(SPECIES[w.k].call); }
  }
  G.ramp = clamp(G.waveIx / L.waves.length * 0.55 + (L.clock ? G.roundT / L.clock : G.roundT / 110) * 0.45, 0, 1);
  for(const r of G.riders){ if(r.ghost) stepGhost(r); else stepRider(r, dt); }
  if(running()){
    for(const a of G.animals) stepAnimal(a, dt);
    animalSeparation();
    contacts();
    stepSnakes(dt);
    if(G.group && G.roundT - G.group.t > 1.4) finishGroup();
  }
  // gate warnings and gusts (host announces; every screen can see them coming anyway)
  if(!G.demo && G.state === 'play'){
    for(const f of L.fences){ const s = gateState(f, G.roundT), p = gateState(f, G.roundT - dt); if(s.warn && !p.warn) sfx('gateWarn'); if(!s.open && p.open) sfx('gateShut'); if(s.open && !p.open) sfx('latch'); }
    const g = gustAt(L, G.roundT), gp = gustAt(L, G.roundT - dt);
    if(g === 0.5 && gp === 0) banner('WIND GUST!', 'hold them back', '#f5deb3', 1.4);
    if(g === 1 && gp !== 1) sfx('gust');
    for(const c of L.cross){ if(G.roundT - dt < c.t0 - 2.5 && G.roundT >= c.t0 - 2.5) banner('HERD CROSSING!', 'the neighbour is coming through', '#ffe27a', 2); }
  }
  if(G.demo){
    if(G.roundT > 70 || (G.waveIx >= L.waves.length && G.animals.every(a => a.st === 'in' || a.st === 'lost'))){ const b = G.biome; startDemo(); G.biome = b; }
    return;
  }
  dropIn(); recordGhosts();
  if(G.state !== 'play') return;
  const all = G.waveIx >= L.waves.length && G.animals.length === L.total && G.animals.every(a => a.st === 'in' || a.st === 'lost');
  if(all) endRound(G.lost ? 'done' : 'complete');
  else if(L.clock && timeLeft() <= 0) endRound('time');
  else if(D().lostMax && G.mode !== 'tt' && G.lost >= D().lostMax) endRound('away');
}
function endRound(why){
  if(G.state !== 'play') return;
  finishGroup();
  G.state = 'over'; G.stateT = 0; G.over = why;
  const t = { complete: ['ROUND-UP COMPLETE!', 'every last one', '#7ff0b0'], done: ['ROUND-UP DONE!', G.corr + ' of ' + G.L.total + ' home', '#ffd45e'],
    time: ["TIME'S UP!", G.corr + ' of ' + G.L.total + ' home', '#ffb14a'], away: ['THE HERD GOT AWAY!', G.corr + ' of ' + G.L.total + ' home', '#ff8a6a'] }[why];
  banner(t[0], t[1], t[2], 3);
  if(why === 'complete' || why === 'done'){ sfx('complete'); sfx('herdIn'); } else sfx('timeUp');
}

/* ---------- Ghost (time trial): the family's best team run ---------- */
function ghostKey(){ return 'stampede.ghost.' + G.biome + '.' + (G.diff === 'kids' ? 'kids' : 'std'); }
function loadGhost(){
  const g = A.Store.get(ghostKey(), null);
  if(!g || !Array.isArray(g.runs) || !g.runs.length) return null;
  return g.runs.filter(q => Array.isArray(q.d) && q.d.length > 6).slice(0, 4).map((q, i) => makeRider({ ghost: true, name: q.n, color: q.c || '#e9ecf1', gd: q.d, slot: 30 + i, horse: q.h || 0, gt: g.t }));
}
function stepGhost(r){
  const d = r.gd, f = G.roundT / 0.1, k = Math.floor(f), u = f - k, n = d.length / 3;
  if(G.state !== 'play' && G.state !== 'over'){ r.x = d[0]; r.y = d[1]; return; }
  if(k >= n - 1){ r.x = d[(n - 1) * 3]; r.y = d[(n - 1) * 3 + 1]; r.vx = r.vy = 0; return; }
  const a = k * 3, b = a + 3, ox = r.x;
  r.x = d[a] + (d[b] - d[a]) * u; r.y = d[a + 1] + (d[b + 1] - d[a + 1]) * u; r.face = d[a + 2] || 1;
  r.vx = (d[b] - d[a]) / 0.1; r.vy = (d[b + 1] - d[a + 1]) / 0.1; r.gait += Math.abs(r.x - ox) * 0.16 + Math.abs(r.vy) * 0.002;
}
function recordGhosts(){
  if(!G.rec || G.state !== 'play') return;
  const k = Math.floor(G.roundT / 0.1);
  if(k === G.rec.k) return;
  G.rec.k = k;
  for(const r of G.riders) if(r.human){
    const a = G.rec.runs[r.id] || (G.rec.runs[r.id] = { n: r.name, c: r.color, h: r.horse, d: [] });
    while(a.d.length / 3 <= k) a.d.push(Math.round(r.x), Math.round(r.y), r.face);
  }
}

/* ---------- Results, medals, bests, unlocks ---------- */
/* Par times: the test bot's clean-round time per biome (1 rider), a little over. Tune after family play. */
const KIDS_PAR = [70, 72, 78, 78, 80, 76, 84];
const TT_PAR = [62, 66, 72, 70, 74, 70, 78];
const AWARD_DEFS = [
  { title: 'Best Wrangler', stat: p => p.stats.corrals, min: 2 },
  { title: 'Rescue Ranger', stat: p => p.stats.rescues, min: 1 },
  { title: 'Stampede Starter', stat: p => p.stats.stamp, min: 1 },
  { title: 'Cleanest Streak', stat: p => p.stats.bestStreak, min: 5 },
  { title: 'Holler Hero', stat: p => p.stats.hollers, min: 5 },
  { title: 'Gentlest Hands', stat: p => Math.round(p.stats.gentleT), min: 6, runnerUp: 'Soft Touch' },
  { title: 'Mustang Tamer', stat: p => p.stats.sp.horse, min: 3 },
  { title: 'Flock Friend', stat: p => p.stats.sp.sheep, min: 4 },
  { title: 'Boar Whisperer', stat: p => p.stats.sp.boar, min: 2 },
  { title: 'Bison Boss', stat: p => p.stats.sp.bison, min: 2 },
  { title: 'Trail Boss', stat: p => p.stats.sp.cattle, min: 3 },
  { title: 'Fence Hopper', stat: p => p.stats.hops, min: 3 },
  { title: 'Long Rider', stat: p => Math.round(p.stats.dist / 100), min: 25 },
  { title: 'Steady Rider', stat: p => p.stats.scatters, low: true, min: 0, all: true }
];
function medalFor(res){
  const kids = G.diff === 'kids';
  if(G.mode === 'tt'){ const par = TT_PAR[G.biome] * (kids ? 1.3 : G.diff === 'pro' ? 0.95 : 1) * (1 + (G.L.riders - 1) * 0.08); return res.complete ? A.Medals.pick(res.ttTime, { gold: par, silver: par * 1.2 }, true) : null; }
  if(kids){ const par = KIDS_PAR[G.biome] * (1 + (G.L.riders - 1) * 0.1); return A.Medals.pick(G.roundT, { gold: par * 1.3, silver: par * 2 }, true); }
  const frac = G.corr / G.L.total;
  if(frac >= 1 && res.left >= G.L.clock * 0.15) return 'gold';
  if(frac >= 0.85) return 'silver';
  if(frac >= 0.6) return 'bronze';
  return null;
}
function finishRound(){
  G.state = 'podium'; G.stateT = 0;
  const L = G.L, d = D(), hum = G.riders.filter(r => r.human), bi = G.biome, B = BIOMES[bi], notes = [];
  const complete = G.over === 'complete' || G.over === 'done';
  const left = L.clock ? Math.max(0, timeLeft()) : 0;
  const res = { why: G.over, complete, left, notes, total: L.total, corr: G.corr, lost: G.lost, scatters: G.scatters, stampedes: G.stampedes, time: G.roundT, rows: [], bonus: [] };
  // bonuses
  const base = G.score;
  if(L.clock && complete){ const tb = Math.round(left) * 20; if(tb){ G.score += tb; res.bonus.push('time left ' + fmtClock(left) + ' +' + tb); } }
  if(!L.clock && complete && G.mode !== 'tt'){ const par = KIDS_PAR[bi] * 1.5, tb = Math.max(0, Math.round((par - G.roundT) * 10)); if(tb){ G.score += tb; res.bonus.push('quick round +' + tb); } }
  if(complete && G.lost === 0){ G.score += 1000; res.bonus.push('whole herd home +1000'); }
  if(complete && G.scatters === 0){ G.score += 1000; res.bonus.push('not one scatter +1000'); }
  res.base = base; res.score = G.score;
  res.ttTime = G.roundT + G.lost * 5;
  // medal
  const medal = hum.length ? medalFor(res) : null;
  if(medal){ const mr = A.Medals.award(GAME, 'b' + (bi + 1), G.diff, medal); res.medal = medal; res.medalImproved = mr.improved; }
  // unlock the next biome with any medal
  if(medal && G.mode !== 'tt' && bi + 2 > G.unlocked && G.unlocked < BIOMES.length){ G.unlocked = Math.min(BIOMES.length, bi + 2); A.Store.set('stampede.unlocked', G.unlocked); notes.push('New range unlocked: <b>' + BIOMES[G.unlocked - 1].name + '</b>!'); sfx('unlock'); }
  // personal bests
  if(hum.length){
    const rs = A.Celebrate.record(GAME, 'score.' + bi + '.' + G.diff, G.score, false); res.bestScore = rs.isNew;
    if(complete && G.lost === 0 && G.mode !== 'tt'){ const rt = A.Celebrate.record(GAME, 'time.' + bi + '.' + G.diff, Math.round(G.roundT * 10) / 10, true); res.bestTime = rt.isNew; }
    const sv = A.Celebrate.record(GAME, 'saved.' + bi + '.' + G.diff, G.corr, false); res.bestSaved = sv.isNew && G.corr < L.total && G.corr > 0;
    if(G.bestStreak >= 5){ const st = A.Celebrate.record(GAME, 'streak', G.bestStreak, false); res.bestStreak = st.isNew; }
    if(G.mode === 'tt' && complete){
      const rt = A.Celebrate.record(GAME, 'tt.' + bi + '.' + (G.diff === 'kids' ? 'kids' : 'std'), Math.round(res.ttTime * 10) / 10, true); res.bestTT = rt.isNew;
      const key = 'stampede.tt.' + bi + '.' + (G.diff === 'kids' ? 'kids' : 'std'), list = A.Store.get(key, []);
      list.push({ n: hum.map(r => r.name).join(' + '), t: Math.round(res.ttTime * 10) / 10 }); list.sort((a, b) => a.t - b.t); A.Store.set(key, list.slice(0, 5));
      const g = A.Store.get(ghostKey(), null);
      if((!g || res.ttTime < g.t) && G.rec){
        const runs = hum.map(r => G.rec.runs[r.id]).filter(Boolean);
        if(runs.length){ A.Store.set(ghostKey(), { t: res.ttTime, runs }); notes.push('<b>' + A.esc(hum.map(r => r.name).join(' + ')) + '</b> ' + (runs.length > 1 ? 'are' : 'is') + ' the new family ghost on ' + B.name + '!'); }
      }
    }
  }
  // championship totals
  if(G.mode === 'champ' && G.champ){
    const c = G.champ; c.round++; c.score += G.score; c.saved += G.corr; c.total += L.total;
    c.rows.push({ bi, score: G.score, corr: G.corr, total: L.total, medal: medal || null });
    for(const r of hum){ const s = c.stats[r.name] || (c.stats[r.name] = { name: r.name, color: r.color, stats: newStats() }); for(const k in r.stats){ if(k === 'sp'){ for(const q in r.stats.sp) s.stats.sp[q] += r.stats.sp[q]; } else if(k === 'bestStreak') s.stats[k] = Math.max(s.stats[k], r.stats[k]); else s.stats[k] += r.stats[k]; } }
  }
  G.results = res;
  // one big celebration (it goes to every online screen too)
  const cols = hum.map(r => r.color).concat(['#ffd45e']);
  if(res.bestTT) A.Celebrate.show({ title: 'NEW BEST!', sub: B.name + ' time trial in ' + fmt(res.ttTime), colors: cols });
  else if(res.bestTime) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Fastest clean round-up on ' + B.name + ': ' + fmt(G.roundT) + (res.medalImproved ? ' · ' + A.Medals.label(medal) + ' medal!' : ''), colors: cols });
  else if(res.medalImproved) A.Celebrate.show({ title: A.Medals.label(medal).toUpperCase() + ' MEDAL!', sub: B.name + ' · ' + d.label, colors: cols });
  else if(res.bestScore && G.score > 0) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Top score ' + G.score.toLocaleString() + ' on ' + B.name, colors: cols });
  else if(res.bestSaved) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Most saved on ' + B.name + ': ' + G.corr, colors: cols });
  else if(res.bestStreak) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Longest clean streak: ' + G.bestStreak, colors: cols });
}
function awardsHtml(players){
  if(!players.length) return '';
  const res = A.Awards.pick(players, AWARD_DEFS, { max: 3 });
  return A.Awards.html(res);
}
function resultsMenu(){
  G.state = 'results'; sfx('results');
  const res = G.results, B = BIOMES[G.biome], hum = G.riders.filter(r => r.human);
  const title = { complete: 'Round-up complete!', done: 'Round-up done!', time: "Time's up!", away: 'The herd got away!' }[res.why];
  let text = '<b>' + res.corr + ' of ' + res.total + '</b> home' + (res.lost ? ' · ' + res.lost + ' got away' : '') + ' · ' + res.scatters + ' scatter' + (res.scatters === 1 ? '' : 's') +
    (res.stampedes ? ' · ' + res.stampedes + ' stampede bonus' + (res.stampedes > 1 ? 'es' : '') : '') + ' · longest streak ' + G.bestStreak;
  text += '<br>' + (G.mode === 'tt' ? 'Time <b>' + fmt(res.ttTime) + '</b>' + (res.lost ? ' (incl. +' + res.lost * 5 + 's for strays)' : '') : 'Round time ' + fmt(res.time)) + ' · Score <b>' + res.score.toLocaleString() + '</b>' + (res.bonus.length ? ' (' + res.bonus.join(', ') + ')' : '');
  if(res.medal) text += '<br>' + A.Medals.html(res.medal) + ' <b>' + A.Medals.label(res.medal) + ' medal</b>' + (res.medalImproved ? ' · new!' : '');
  const nb = [res.bestScore && 'top score', res.bestTime && 'fastest clean round', res.bestTT && 'best time', res.bestSaved && 'most saved', res.bestStreak && 'longest streak'].filter(Boolean);
  if(nb.length) text += (res.medal ? ' · ' : '<br>') + '<b>New best:</b> ' + nb.join(', ');
  if(res.notes.length) text += '<br>' + res.notes.join('<br>');
  if(G.mode === 'tt'){ const list = A.Store.get('stampede.tt.' + G.biome + '.' + (G.diff === 'kids' ? 'kids' : 'std'), []); if(list.length) text += '<br>Family best times: ' + list.map((e, i) => (i + 1) + '. ' + A.esc(e.n) + ' ' + fmt(e.t)).join(' · '); }
  text += '<br><br>' + awardsHtml(hum);
  let items;
  if(G.mode === 'champ' && G.champ){
    const c = G.champ, over = c.round >= c.biomes.length;
    text += '<br><br><b>Championship after ' + c.round + ' of ' + c.biomes.length + '</b> · ' + c.saved + ' of ' + c.total + ' saved · ' + c.score.toLocaleString() + ' pts';
    items = over ? [{ label: 'See the final tally', select: championMenu }]
      : [{ label: 'Next range: ' + BIOMES[c.biomes[c.round]].name, select: () => { G.biome = c.biomes[c.round]; newRound(G.players); } },
         { label: 'Quit championship', select: () => { G.champ = null; hosting() ? openLobby(null) : toTitle(); } }];
  } else {
    const next = (G.biome + 1) % G.unlocked;
    items = [
      { label: G.mode === 'tt' ? 'Try again' : 'Play again', select: () => newRound(G.players) },
      { label: 'Next range: ' + BIOMES[next].name, select: () => { G.biome = next; A.Store.set('stampede.biome', G.biome); newRound(G.players); } },
      { label: hosting() ? 'Back to room lobby' : 'Change riders', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ];
  }
  A.Menu.open({ center: true, shared: true, kicker: B.name + ' · ' + (G.mode === 'tt' ? 'Time trial · ' : G.mode === 'champ' ? 'Championship · ' : '') + D().label, title, text, items });
}
function championMenu(){
  const c = G.champ;
  G.state = 'champion'; G.stateT = 0;
  const rec = A.Celebrate.record(GAME, 'champ.' + G.diff, c.score, false);
  const golds = c.rows.filter(r => r.medal === 'gold').length;
  A.Celebrate.show({ title: rec.isNew ? 'NEW BEST!' : 'RANCH CHAMPIONS!', sub: c.saved + ' of ' + c.total + ' saved · ' + c.score.toLocaleString() + ' pts', colors: G.players.map(p => p.color).concat(['#ffd45e', '#ffffff']) });
  const rows = c.rows.map(r => (r.medal ? A.Medals.html(r.medal) + ' ' : '') + '<b>' + BIOMES[r.bi].name + '</b> ' + r.corr + '/' + r.total + ' · ' + r.score.toLocaleString() + ' pts').join('<br>');
  const ps = Object.values(c.stats);
  A.Menu.open({ center: true, shared: true, kicker: 'Ranch Championship · ' + D().label, title: c.saved === c.total ? 'Every animal home!' : 'Ranch champions!',
    text: rows + '<br><br><b>Total ' + c.score.toLocaleString() + ' pts</b> · ' + c.saved + ' of ' + c.total + ' saved · ' + golds + ' gold' + (rec.isNew ? ' · <b>new best!</b>' : '') + '<br><br>' + awardsHtml(ps),
    items: [
      { label: 'New championship', select: () => startChampionship(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change riders', select: () => { G.champ = null; openLobby(null); } },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: () => { G.champ = null; toTitle(); } }])
    ] });
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
function biomeLine(i){
  const m = A.Medals.get(GAME, 'b' + (i + 1));
  return (i + 1) + ' · ' + BIOMES[i].name + (m ? ' · ' + A.Medals.label(m) : '');
}
function medalBoard(){
  return BIOMES.map((b, i) => i < G.unlocked ? (A.Medals.html(A.Medals.get(GAME, 'b' + (i + 1))) || '<span class="medal" style="opacity:.25;border:1px solid currentColor;border-radius:50%"></span>') : '<span title="locked" style="opacity:.6">🔒</span>').join(' ');
}
function titleMenu(start){
  G.state = 'title';
  const champ = G.mode === 'champ', tt = G.mode === 'tt', touch = A.Input.isTouch;
  A.Menu.open({ kicker: 'xRetro', title: 'ROUND-UP RIDERS', start: start || 0,
    text: 'The herd has bolted! Ride them back into the corral before they reach the open range. <b>' + (touch ? 'Tap HYAH' : 'Tap FIRE') + '</b> hollers them round, <b>hold</b> it to herd gently. Coax them, don’t crash them. ' +
          '<span class="medal-row">' + medalBoard() + '</span>',
    items: [
      { label: champ ? 'Start the championship' : tt ? 'Start time trial' : 'Ride', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Mode', value: () => MODES.find(m => m.id === G.mode).label + (champ ? ' · ' + G.unlocked + ' ranges' : ''), change: d => { const i = MODES.findIndex(m => m.id === G.mode); G.mode = MODES[(i + d + MODES.length) % MODES.length].id; A.Store.set('stampede.mode', G.mode); titleMenu(2); } },
      ...(champ ? [] : [{ label: 'Range', value: () => biomeLine(G.biome), change: d => { G.biome = (G.biome + d + G.unlocked) % G.unlocked; A.Store.set('stampede.biome', G.biome); titleMenu(3); } }]),
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('stampede.diff', G.diff); } },
      { label: 'Ranch dog', value: () => DOG_OPTS.find(o => o.id === G.dogOpt).label, change: d => { const i = DOG_OPTS.findIndex(o => o.id === G.dogOpt); G.dogOpt = DOG_OPTS[(i + d + DOG_OPTS.length) % DOG_OPTS.length].id; A.Store.set('stampede.dog', G.dogOpt); } },
      { label: 'Family bests', select: () => bestsMenu(() => titleMenu(0)) },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: bestLine() });
}
function bestLine(){
  const n = A.Input.pads().length, b = G.biome;
  const sc = A.Store.get('best.' + GAME + '.score.' + b + '.' + G.diff, null), tm = A.Store.get('best.' + GAME + '.time.' + b + '.' + G.diff, null);
  const locked = BIOMES.length - G.unlocked;
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') +
    (sc ? 'Best on ' + BIOMES[b].name + ': ' + sc.toLocaleString() + ' pts' + (tm ? ', clean round-up ' + fmt(tm) : '') + '. ' : '') + (locked ? locked + ' range' + (locked > 1 ? 's' : '') + ' locked: win a medal to open the next.' : '');
}
function bestsMenu(back){
  const lines = BIOMES.map((b, i) => {
    const m = A.Medals.get(GAME, 'b' + (i + 1));
    const sc = DIFF_ORDER.map(dk => { const v = A.Store.get('best.' + GAME + '.score.' + i + '.' + dk, null); return v ? DIFF[dk].label + ' ' + v.toLocaleString() : ''; }).filter(Boolean).join(', ');
    const tm = A.Store.get('best.' + GAME + '.time.' + i + '.normal', null);
    const tt = A.Store.get('stampede.tt.' + i + '.std', [])[0];
    return (i < G.unlocked ? '' : '🔒 ') + (m ? A.Medals.html(m) + ' ' : '') + '<b>' + b.name + '</b>' + (sc ? ' · ' + sc : '') + (tm ? ' · clean ' + fmt(tm) : '') + (tt ? ' · time trial: ' + A.esc(tt.n) + ' ' + fmt(tt.t) : '');
  });
  const st = A.Store.get('best.' + GAME + '.streak', null), ch = A.Store.get('best.' + GAME + '.champ.normal', null);
  A.Menu.open({ center: true, kicker: 'Round-Up Riders', title: 'Family bests',
    text: lines.join('<br>') + '<br><br>' + (st ? 'Longest clean streak: <b>' + st + '</b><br>' : '') + (ch ? 'Best Ranch Championship (Normal): <b>' + ch.toLocaleString() + ' pts</b>' : ''),
    items: [{ label: 'Back', select: back }], back });
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting(), champ = G.mode === 'champ', tt = G.mode === 'tt';
  const B = BIOMES[G.biome], kinds = Object.keys(B.herd);
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + (champ ? 'Ranch Championship · ' + G.unlocked + ' ranges' : B.name) + (tt ? ' · Time trial' : '') + ' · ' + D().label,
    title: 'Who is riding?',
    text: (online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 riders work the same herd together (more riders, bigger herd). More can drop in mid-round by pressing FIRE.') +
          (champ ? '' : '<br><b>' + B.name + ':</b> ' + kinds.map(k => SPECIES_TIP[k]).join(' ')),
    min: 1, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => { if(G.mode === 'champ') startChampionship(players); else newRound(players); },
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'play' && G.state !== 'count') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart round', select: () => newRound(G.players, G.mode === 'tt' ? undefined : G.seed) }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: BIOMES[G.biome].name + ' · ' + G.corr + ' of ' + G.L.total + ' home', title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'play'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'play'; }
function toTitle(){
  A.Menu.close(); A.Lobby.close(); A.Mirror.hide(); buf.clear();
  if(G.net) Net.close();
  G.net = null; G.champ = null;
  startDemo(); titleMenu();
}
function leaveRoom(src, back){
  if(fromGuest(src)){ const peer = Net.peerOf(src.id); Net.kick(peer, 'kicked'); A.Input.Remote.disconnect(peer + '/'); return; }
  A.Menu.open({ center: true, kicker: 'Room ' + Net.code, title: 'Close the room?', text: 'Everyone playing online will be sent back to their title screen.',
    items: [{ label: 'Keep riding', select: back }, { label: 'Close the room', select: toTitle }], back });
}
function onlineMenu(src, start){
  G.state = 'online';
  if(!Net || !Net.available()){
    A.Menu.open({ center: true, kicker: 'Play online', title: 'Needs the internet', text: 'Online rooms work when the game is opened from <b>xretro.pages.dev</b>.',
      items: [{ label: 'Back', select: titleMenu }], back: titleMenu });
    return;
  }
  A.Menu.open({ center: true, kicker: 'Play online', title: 'Online rooms', start: start || 0,
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 riders from any mix of devices, all working the same herd.',
    items: [
      { label: 'Host a round-up', select: s => hostRoom(s) },
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
  const t = A.Input.isTouch, F = t ? 'HYAH' : 'FIRE';
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to herd',
    text: 'The herd runs for the <b>open range</b> on the left. Get them into the <b>corral</b> on the right before the clock runs out.<br>' +
          '<b>' + (t ? 'Stick' : 'Left/right') + '</b> rides along the trail, <b>' + (t ? 'up/down on the stick' : 'up/down') + '</b> crosses the pasture (diagonals work).<br>' +
          'Animals move <b>away from you</b>. Ride round to get <b>behind</b> one (between it and the open range) and it heads for home, and keeps going for a while.<br>' +
          '<b>Tap ' + F + '</b> = HYAH!: a holler that turns the animals in front of you toward the corral, with a little spur. Holler at an animal’s <b>face</b> or right on top of it and it <b>scatters</b>. ' +
          '<b>Hold ' + F + '</b> = gentle herding: you walk, they feel you from further away, nothing spooks.<br>' +
          'Riding <b>into</b> an animal fast, head-on, scatters it too (costs time and your streak). Boars charge back if you corner them. Sheep panic together.<br>' +
          'An animal that reaches the open range isn’t gone yet: <b>ride up to it</b> quickly to win it back.<br>' +
          '<b>Points:</b> clean corrals build a <b>streak</b> (x2…x5). Drive 3 or more in together for a <b>STAMPEDE</b> bonus. Horses hop fences; the herd needs the gate, which opens and shuts on a timer.<br>' +
          '<b>Kids mode:</b> nothing is ever lost (strays wander back), slower animals, no clock, and Biscuit the ranch dog helps.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0;
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onRename(id, name){ const r = G.riders.find(x => x.source === id); if(r) r.name = name; const p = G.players.find(x => x.source === id); if(p) p.name = name; },
  onMessage(m){ if(m.t === 's'){ if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx); if(m.fx) for(const f of m.fx) G.fx.push({ text: f[0], x: f[1], y: f[2], col: f[3], big: f[4], t: 0 }); buf.push(m); } }
};
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const ST = ['enter', 'run', 'scatter', 'charge', 'edge', 'back', 'in', 'lost'];
function sendSnap(){
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), rt: r2(G.roundT), bi: G.demo ? G.demoBiome : G.biome, d: G.demo ? 'normal' : G.diff, sd: G.seed, rid: G.rid,
    md: G.mode, dm: G.demo ? 1 : 0, nr: G.L.riders, sc: G.score, mu: G.mult, sk: G.streak, co: G.corr, lo: G.lost, cp: r1(G.clockPen), ov: G.over || '', wi: G.waveIx,
    bn: G.banner ? [G.banner.text, G.banner.sub, G.banner.col, r2(G.banner.t - (G.time - G.banner.at))] : null,
    tg: Array.from(G.tumbleGone), sn: G.L.snakes.map(q => [Math.round(q.x), Math.round(q.y), q.st, q.rattle > 0 ? 1 : 0]),
    r: G.riders.map(r => [r.id, r1(r.x), r1(r.y), Math.round(r.vx), Math.round(r.vy), r.face, (r.human ? 1 : 0) | (r.dog ? 2 : 0) | (r.ghost ? 4 : 0) | (r.gentle ? 8 : 0) | (r.bot ? 16 : 0),
      r2(r.holT), r2(r.hdx), r2(r.hdy), r2(r.stunT), r2(r.hopT), r2(r.rearT), r2(r.invT), r.name, r.color, r.source || '', r.msgT > 0 ? r.msg : '', r2(r.msgT), r.msgCol, r.slot, r.horse, r2(r.spurT)]),
    a: G.animals.map(a => [a.id, r1(a.x), r1(a.y), r2(a.head), Math.round(a.spd), ST.indexOf(a.st), SPECIES_ORDER.indexOf(a.k), r2(a.stT), a.alert > 0 ? 1 : 0, a.drive > 0.3 ? 1 : 0]) };
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  if(netFx.length){ s.fx = netFx; netFx = []; }
  Net.broadcast(s);
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, Lp = (x, y) => x + (y - x) * t;
  if(!G.L || G.L.bi !== s.bi || G.L.seed !== s.sd || G.L.diff !== s.d || G.L.riders !== s.nr || G.gRid !== s.rid){ G.L = buildRound(s.bi, s.d, s.sd, s.nr, s.md); G.gRid = s.rid; G.tumbleGone = new Set(); parts = []; }
  const same = a.rid === b.rid;
  G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.diff = s.d; G.biome = s.bi; G.mode = s.md; G.seed = s.sd;
  G.roundT = same && a.st === b.st ? Lp(a.rt, b.rt) : b.rt;
  G.score = s.sc; G.mult = s.mu; G.streak = s.sk; G.corr = s.co; G.lost = s.lo; G.clockPen = s.cp; G.over = s.ov; G.waveIx = s.wi;
  G.banner = s.bn ? { text: s.bn[0], sub: s.bn[1], col: s.bn[2], t: s.bn[3], at: G.time } : null;
  G.tumbleGone = new Set(s.tg || []);
  if(s.sn) s.sn.forEach((q, i) => { const sn = G.L.snakes[i]; if(sn){ sn.x = q[0]; sn.y = q[1]; sn.st = q[2]; sn.rattle = q[3] ? 0.5 : 0; } });
  const prevR = new Map(same ? a.r.map(q => [q[0], q]) : []), oldR = new Map(G.riders.map(r => [r.id, r]));
  G.riders = s.r.map(q => {
    const o = prevR.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60, f = q[6], old = oldR.get(q[0]);
    return { id: q[0], x: near ? Lp(o[1], q[1]) : q[1], y: near ? Lp(o[2], q[2]) : q[2], vx: q[3], vy: q[4], face: q[5], human: !!(f & 1), dog: !!(f & 2), ghost: !!(f & 4), gentle: !!(f & 8), bot: !!(f & 16),
      holT: q[7], hdx: q[8], hdy: q[9], stunT: q[10], hopT: q[11], rearT: q[12], invT: q[13], name: q[14], color: q[15], source: q[16], msg: q[17], msgT: q[18], msgCol: q[19], slot: q[20], horse: q[21], spurT: q[22],
      gait: old ? old.gait + hyp(q[3], q[4]) * dt * 0.16 : 0, stats: newStats() };
  });
  const prevA = new Map(same ? a.a.map(q => [q[0], q]) : []), oldA = new Map(G.animals.map(x => [x.id, x]));
  G.animals = s.a.map(q => {
    const o = prevA.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 40, old = oldA.get(q[0]);
    let hd = q[3]; if(near){ let dh = q[3] - o[3]; while(dh > Math.PI) dh -= TAU; while(dh < -Math.PI) dh += TAU; hd = o[3] + dh * t; }
    return { id: q[0], x: near ? Lp(o[1], q[1]) : q[1], y: near ? Lp(o[2], q[2]) : q[2], head: hd, spd: q[4], st: ST[q[5]] || 'run', k: SPECIES_ORDER[q[6]] || 'cattle', stT: q[7], alert: q[8] ? 0.2 : 0, drive: q[9] ? 1 : 0,
      wob: old ? old.wob + dt * (2 + q[4] * 0.12) : 0 };
  });
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  if(G.demo || G.state === 'title' || G.state === 'lobby' || G.state === 'online') want = A.THEMES.menu;
  else if(G.state === 'podium' || G.state === 'results' || G.state === 'champion') want = MUSIC.sunset;
  else if(G.L) want = MUSIC[BIOMES[G.biome].music];
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(G.state === 'paused' || G.state === 'count');
}
function myRiders(){
  const hum = G.riders.filter(r => r.human);
  return hum.filter(r => G.net === 'guest' ? Net.isMine(r.source) : !String(r.source).includes('/'));
}
function step(dt){
  G.time += dt;
  const playing = G.state === 'play' || G.state === 'count';
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = playing && myRiders().some(r => r.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('HYAH'); }
    Net.setPlaying(playing);
    music(); return;
  }
  const wantTouch = playing && G.riders.some(r => r.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('HYAH'); }
  music();
  if(Net) Net.setPlaying(playing);
  hostStep(dt);
  if(G.net === 'host'){ Net.hostTick(); if(++netStep % 2 === 0 && Net.hasGuests()) sendSnap(); }
}
function hostStep(dt){
  if(A.Lobby.isOpen()){ A.Lobby.update(); sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); G.stateT += dt; if(G.demo) sim(dt); else if(G.state === 'results' || G.state === 'champion') coolDown(dt); return; }
  if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
  const pausePressed = A.Input.all().some(s => A.Input.pressed(s, 'pause') && (s.kind !== 'net' || G.riders.some(r => r.source === s.id)));
  switch(G.state){
    case 'count':
      if(pausePressed){ pause(); return; }
      { const before = G.stateT; G.stateT += dt; for(let i = 0; i < 3; i++){ const at = 0.6 + i * 0.8; if(before < at && G.stateT >= at) S('countdown'); } }
      if(G.stateT >= 3){ G.state = 'play'; S('go'); }
      sim(dt); break;
    case 'play':
      if(pausePressed){ pause(); return; }
      sim(dt); break;
    case 'over':
      G.stateT += dt; coolDown(dt);
      if(G.stateT > 2.6) finishRound();
      break;
    case 'podium':
      G.stateT += dt; coolDown(dt);
      if(G.stateT > 2.2 || (G.stateT > 0.8 && A.Input.all().some(s => A.Input.pressed(s, 'fire')))) resultsMenu();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
/* After the round: the corral mills about, strays graze, riders trot to a stop */
function coolDown(dt){
  for(const a of G.animals){
    if(a.st === 'in') stepAnimal(a, dt);
    else if(a.st !== 'lost'){ a.spd *= Math.pow(0.2, dt); a.x += Math.cos(a.head) * a.spd * dt; a.y += Math.sin(a.head) * a.spd * dt * 0.85; a.wob += dt * 2; }
  }
  for(const r of G.riders){ if(r.ghost) continue; r.vx *= Math.pow(0.1, dt); r.vy *= Math.pow(0.1, dt); r.x += r.vx * dt; r.y += r.vy * dt; r.gait += hyp(r.vx, r.vy) * dt * 0.16; if(r.msgT > 0) r.msgT -= dt; r.holT = Math.max(0, r.holT - dt); }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || (G.state !== 'play' && G.state !== 'count') || G.net === 'guest') return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);
function rng(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function text(c, str, x, y, size, color, align, base){ c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y); }
function outlined(c, str, x, y, size, color, align, font){
  c.font = size + 'px ' + (font || FONT); c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(1.2, size / 4); c.lineJoin = 'round'; c.strokeStyle = 'rgba(20,12,8,.9)'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
const RGB = new Map();
function rgb(hex){ let v = RGB.get(hex); if(!v){ const n = parseInt(hex.slice(1), 16); v = [n >> 16, n >> 8 & 255, n & 255]; RGB.set(hex, v); } return v; }
function shade(hex, k){ const [r, g, b] = rgb(hex), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
function mixc(a, b, t){ const A1 = rgb(a), B1 = rgb(b); return 'rgb(' + [0, 1, 2].map(i => Math.round(A1[i] * (1 - t) + B1[i] * t)).join(',') + ')'; }
function ell(c, x, y, rx, ry, rot){ c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); }
function rr(c, x, y, w, h, r){ r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function line(c, x1, y1, x2, y2){ c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

/* ---------- Background (sky, backdrop, pasture) drawn once per round into an offscreen canvas ---------- */
let bg = null, bgKey = '';
function drawBackground(L){
  const key = L.bi + '/' + L.seed + '/' + L.diff + '/' + canvas.width + 'x' + canvas.height;
  if(bg && key === bgKey) return;
  bgKey = key;
  if(!bg) bg = document.createElement('canvas');
  bg.width = canvas.width; bg.height = canvas.height;
  const c = bg.getContext('2d'), s = display.scale;
  c.setTransform(s, 0, 0, s, 0, 0);
  const B = L.B, night = B.wx === 'night';
  // sky
  const sky = c.createLinearGradient(0, 0, 0, FY0);
  sky.addColorStop(0, B.sky[0]); sky.addColorStop(1, B.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, VW, FY0 + 2);
  if(night){
    for(let i = 0; i < 90; i++){ c.fillStyle = 'rgba(240,240,255,' + (0.3 + rng(i) * 0.7) + ')'; c.fillRect(rng(i + 3) * VW, rng(i + 9) * (FY0 - 10), rng(i) > 0.9 ? 1.2 : 0.7, rng(i) > 0.9 ? 1.2 : 0.7); }
    c.fillStyle = '#fbf6dc'; circ(c, 300, 30, 11); c.fill(); c.fillStyle = B.sky[0]; circ(c, 305, 27, 9.5); c.fill();
    c.fillStyle = 'rgba(251,246,220,.08)'; circ(c, 300, 30, 26); c.fill();
  } else if(B.wx === 'dusk'){
    const g = c.createRadialGradient(290, FY0 - 12, 2, 290, FY0 - 12, 70); g.addColorStop(0, 'rgba(255,236,170,.95)'); g.addColorStop(0.2, 'rgba(255,200,120,.5)'); g.addColorStop(1, 'rgba(255,170,100,0)');
    c.fillStyle = g; c.fillRect(200, 0, 184, FY0); c.fillStyle = '#fff1c4'; circ(c, 290, FY0 - 12, 9); c.fill();
  } else if(B.wx !== 'snow' && B.wx !== 'fog'){ c.fillStyle = 'rgba(255,248,210,.95)'; circ(c, 320, 24, 9); c.fill(); c.fillStyle = 'rgba(255,248,210,.18)'; circ(c, 320, 24, 18); c.fill(); }
  // backdrop per biome
  const hills = (base, amp, col, seed, freq) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, FY0 + 2); for(let x = 0; x <= VW + 4; x += 4){ const h = (Math.sin(x * freq + seed) * 0.55 + Math.sin(x * freq * 2.3 + seed * 3) * 0.3 + Math.sin(x * freq * 5.1 + seed) * 0.12) * amp; c.lineTo(x, base - amp - h); } c.lineTo(VW, FY0 + 2); c.fill(); };
  const peaks = (base, col, snow, seed, n, hMin, hMax) => {
    for(let i = 0; i < n; i++){ const x = rng(seed + i) * (VW + 60) - 30, w = 40 + rng(seed + i + 50) * 50, h = hMin + rng(seed + i + 80) * (hMax - hMin);
      c.fillStyle = col; c.beginPath(); c.moveTo(x - w, base); c.lineTo(x, base - h); c.lineTo(x + w, base); c.fill();
      if(snow){ c.fillStyle = snow; c.beginPath(); c.moveTo(x - w * 0.28, base - h * 0.72); c.lineTo(x, base - h); c.lineTo(x + w * 0.28, base - h * 0.72); c.lineTo(x + w * 0.12, base - h * 0.66); c.lineTo(x, base - h * 0.74); c.lineTo(x - w * 0.12, base - h * 0.66); c.fill(); } }
  };
  const mesas = (base, col, seed, n, shadow) => {
    for(let i = 0; i < n; i++){ const x = rng(seed + i) * VW, w = 22 + rng(seed + i + 7) * 46, h = 16 + rng(seed + i + 17) * 22;
      c.fillStyle = col; c.beginPath(); c.moveTo(x - w / 2 - 8, base); c.lineTo(x - w / 2, base - h); c.lineTo(x + w / 2, base - h); c.lineTo(x + w / 2 + 10, base); c.fill();
      if(shadow){ c.fillStyle = shadow; c.fillRect(x - w / 2 + 1, base - h + 4, w, 1.2); c.fillRect(x - w / 2 + 3, base - h + 9, w - 3, 1); } }
  };
  switch(L.bi){
    case 0: // ranch: rolling hills, a red barn and a windmill
      hills(FY0, 14, B.far, 1, 0.012); hills(FY0 + 2, 8, B.mid, 4, 0.02);
      barn(c, 250, FY0 - 4); windmill(c, 206, FY0 - 2);
      for(let i = 0; i < 6; i++){ tree(c, 20 + i * 36 + rng(i) * 10, FY0 - 2 + rng(i + 4) * 3, 0.8, '#4f8a3a'); }
      break;
    case 1: // canyon: layered red mesas
      mesas(FY0 - 6, shade(B.far, 1.05), 11, 5, 'rgba(255,220,180,.25)'); mesas(FY0 + 1, B.mid, 21, 4, 'rgba(90,30,10,.3)');
      c.fillStyle = shade(B.mid, 0.8); c.fillRect(0, FY0 - 2, VW, 4);
      break;
    case 2: // creek: soft hills and willows
      hills(FY0, 12, B.far, 2, 0.01); hills(FY0 + 2, 7, B.mid, 6, 0.018);
      for(let i = 0; i < 7; i++) willow(c, 16 + i * 55 + rng(i + 20) * 20, FY0 + 1);
      break;
    case 3: // foothills: pine slopes and a snowy peak at sunset
      peaks(FY0 - 4, '#8a7a88', '#fbe7d0', 31, 4, 26, 44); hills(FY0, 10, B.far, 3, 0.016);
      for(let x = 4; x < VW; x += 9) pineTree(c, x + rng(x) * 5, FY0 + 1 - rng(x + 1) * 5, 0.55 + rng(x + 2) * 0.3, '#2f5a3c');
      break;
    case 4: // frost: big white mountains
      peaks(FY0 - 2, '#b3c3d8', '#ffffff', 41, 5, 30, 52); peaks(FY0 + 2, '#c9d6e6', '#ffffff', 47, 4, 14, 24);
      for(let x = 8; x < VW; x += 16) pineTree(c, x + rng(x) * 8, FY0 + 2, 0.5 + rng(x + 3) * 0.25, '#4b6b62', true);
      break;
    case 5: // badlands at night
      mesas(FY0 - 5, '#3a2f52', 51, 5, null); mesas(FY0 + 1, B.mid, 57, 4, null);
      for(let i = 0; i < 3; i++) cactusBig(c, 60 + i * 120 + rng(i + 60) * 30, FY0 + 1, 0.8, '#1f2a24');
      break;
    case 6: { // seaside: the sea, a lighthouse on the bluff
      c.fillStyle = B.far; c.fillRect(0, FY0 - 22, VW, 22);
      c.fillStyle = 'rgba(255,255,255,.35)'; for(let i = 0; i < 26; i++) c.fillRect(rng(i + 70) * VW, FY0 - 20 + rng(i + 71) * 16, 6 + rng(i) * 8, 0.6);
      hills(FY0, 8, B.mid, 8, 0.015);
      lighthouse(c, 330, FY0 - 6);
      break; }
  }
  // pasture
  const gr = c.createLinearGradient(0, FY0, 0, VH);
  gr.addColorStop(0, B.ground[1]); gr.addColorStop(1, B.ground[0]);
  c.fillStyle = gr; c.fillRect(0, FY0, VW, VH - FY0);
  c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, FY0, VW, 2);
  // patches (mud, snowdrifts, ice)
  for(const p of L.patches){
    if(p.k === 'mud'){ c.fillStyle = '#6b4a2e'; ell(c, p.x, p.y, p.rx, p.ry); c.fill(); c.fillStyle = 'rgba(40,24,12,.35)'; for(let i = 0; i < 6; i++){ ell(c, p.x + (rng(p.x + i) - 0.5) * p.rx * 1.2, p.y + (rng(p.y + i) - 0.5) * p.ry, 2.5, 1); c.fill(); } c.fillStyle = 'rgba(255,255,255,.15)'; ell(c, p.x - p.rx * 0.3, p.y - p.ry * 0.3, p.rx * 0.3, p.ry * 0.2); c.fill(); }
    else if(p.k === 'ice'){ c.fillStyle = '#bfe3f5'; ell(c, p.x, p.y, p.rx, p.ry); c.fill(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.6; line(c, p.x - p.rx * 0.5, p.y - 1, p.x - p.rx * 0.1, p.y - p.ry * 0.5); line(c, p.x + p.rx * 0.1, p.y + 2, p.x + p.rx * 0.5, p.y - 1); c.fillStyle = 'rgba(255,255,255,.4)'; ell(c, p.x - p.rx * 0.35, p.y - p.ry * 0.3, p.rx * 0.25, p.ry * 0.18); c.fill(); }
    else { c.fillStyle = '#ffffff'; for(let i = 0; i < 5; i++){ ell(c, p.x + (i - 2) * p.rx * 0.35, p.y - Math.sin(i * 1.3) * 1.5, p.rx * 0.36, p.ry * 0.8); c.fill(); } c.fillStyle = 'rgba(150,175,205,.35)'; ell(c, p.x, p.y + p.ry * 0.5, p.rx, p.ry * 0.35); c.fill(); }
  }
  // decoration: tufts, flowers, pebbles, sparkles
  for(const d of L.deco){
    if(L.river && d.x > L.river.x0 - 2 && d.x < L.river.x1 + 2) continue;
    if(d.x > PEN_X - 2 && d.y > PEN_Y0 - 4 && d.y < PEN_Y1 + 2) continue;
    const k = depth(d.y);
    if(d.k < 0.55){ c.strokeStyle = B.tuft; c.lineWidth = 0.6; c.beginPath(); c.moveTo(d.x - 1.5 * k, d.y - 2.5 * k); c.lineTo(d.x, d.y); c.lineTo(d.x + 1.5 * k, d.y - 2.8 * k); c.moveTo(d.x, d.y); c.lineTo(d.x + 0.2, d.y - 3.2 * k); c.stroke(); }
    else if(d.k < 0.8 && B.haz.flowers){ c.fillStyle = ['#fff4c2', '#ff9fc2', '#ffd45e', '#ffffff', '#c7a5ff'][Math.floor(d.s * 5)]; circ(c, d.x, d.y - 1, 0.9 * k); c.fill(); }
    else if(d.k < 0.8){ c.fillStyle = shade(B.ground[0], 0.75); ell(c, d.x, d.y, 1.4 * k, 0.8 * k); c.fill(); }
    else if(B.wx === 'snow'){ c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(d.x, d.y, 0.8, 0.8); }
  }
  // river ford
  if(L.river){
    const { x0, x1 } = L.river;
    c.fillStyle = '#8a6a44'; c.fillRect(x0 - 3, FY0, x1 - x0 + 6, VH - FY0);
    const w = c.createLinearGradient(x0, 0, x1, 0); w.addColorStop(0, '#3f8fc8'); w.addColorStop(0.5, '#62b2e0'); w.addColorStop(1, '#3f8fc8');
    c.fillStyle = w; c.beginPath(); c.moveTo(x0, FY0); for(let y = FY0; y <= VH; y += 6) c.lineTo(x0 + Math.sin(y * 0.2) * 1.2, y); c.lineTo(x1, VH); for(let y = VH; y >= FY0; y -= 6) c.lineTo(x1 + Math.sin(y * 0.2 + 1) * 1.2, y); c.fill();
    c.fillStyle = '#9aa3ad'; for(let i = 0; i < 7; i++){ ell(c, x0 + 6 + rng(i + 90) * (x1 - x0 - 12), FY0 + 12 + i * 18, 2.4, 1.2); c.fill(); }
  }
  // the open range (the way out on the left)
  const og = c.createLinearGradient(0, 0, EDGE_X + 10, 0); og.addColorStop(0, 'rgba(255,80,60,.35)'); og.addColorStop(1, 'rgba(255,80,60,0)');
  c.fillStyle = og; c.fillRect(0, FY0, EDGE_X + 10, VH - FY0);
  c.fillStyle = 'rgba(255,255,255,.35)';
  for(let y = FY0 + 8; y < VH; y += 16){ c.beginPath(); c.moveTo(7, y); c.lineTo(3, y + 3); c.lineTo(7, y + 6); c.lineTo(8, y + 5); c.lineTo(5, y + 3); c.lineTo(8, y + 1); c.fill(); }
  // corral floor
  c.fillStyle = night ? '#6b5a48' : B.wx === 'snow' ? '#d9cfc2' : '#c7a06a'; c.fillRect(PEN_X, PEN_Y0, VW - PEN_X, PEN_Y1 - PEN_Y0);
  c.fillStyle = 'rgba(0,0,0,.08)'; for(let i = 0; i < 40; i++) c.fillRect(PEN_X + rng(i + 200) * (VW - PEN_X), PEN_Y0 + rng(i + 300) * (PEN_Y1 - PEN_Y0), 2, 0.6);
  c.fillStyle = '#e8c85a'; ell(c, 374, PEN_Y1 - 10, 6, 3); c.fill(); c.fillStyle = '#c9a53d'; ell(c, 374, PEN_Y1 - 11, 4, 1.4); c.fill();   // hay
  c.fillStyle = '#6f8fa8'; rr(c, 366, PEN_Y0 + 6, 14, 5, 1.5); c.fill(); c.fillStyle = '#7fc4ec'; c.fillRect(367.5, PEN_Y0 + 6.8, 11, 1.8);   // trough
  c.setTransform(1, 0, 0, 1, 0, 0);
}
/* little backdrop props */
function barn(c, x, y){
  c.fillStyle = '#b23a2e'; c.fillRect(x - 14, y - 14, 28, 14);
  c.fillStyle = '#8f2c23'; c.beginPath(); c.moveTo(x - 16, y - 14); c.lineTo(x, y - 24); c.lineTo(x + 16, y - 14); c.fill();
  c.strokeStyle = '#f4efe2'; c.lineWidth = 0.8; c.strokeRect(x - 5, y - 10, 10, 10); line(c, x - 5, y - 10, x + 5, y); line(c, x + 5, y - 10, x - 5, y);
  c.fillStyle = '#f4efe2'; c.fillRect(x - 2, y - 19, 4, 3);
  c.fillStyle = '#c9c2b3'; c.fillRect(x + 16, y - 20, 6, 20); c.fillStyle = '#9d968a'; ell(c, x + 19, y - 20, 3, 2); c.fill();
}
function windmill(c, x, y){
  c.strokeStyle = '#7a6a58'; c.lineWidth = 0.8; line(c, x - 4, y, x, y - 20); line(c, x + 4, y, x, y - 20); line(c, x - 3, y - 6, x + 3, y - 6);
  c.fillStyle = '#e8e2d4'; for(let i = 0; i < 8; i++){ c.save(); c.translate(x, y - 21); c.rotate(i * Math.PI / 4); c.fillRect(0, -0.6, 6, 1.2); c.restore(); }
}
function tree(c, x, y, k, col){ c.fillStyle = '#6b4a2e'; c.fillRect(x - 0.8 * k, y - 6 * k, 1.6 * k, 6 * k); c.fillStyle = col; circ(c, x, y - 8 * k, 4.5 * k); c.fill(); c.fillStyle = shade(col, 1.2); circ(c, x - 1.4 * k, y - 9.5 * k, 2.4 * k); c.fill(); }
function willow(c, x, y){ c.fillStyle = '#6b4a2e'; c.fillRect(x - 1, y - 9, 2, 9); c.fillStyle = '#6fa84f'; circ(c, x, y - 12, 6.5); c.fill(); c.strokeStyle = '#5a9a40'; c.lineWidth = 0.8; for(let i = -5; i <= 5; i += 2){ line(c, x + i, y - 11, x + i * 1.3, y - 2); } }
function pineTree(c, x, y, k, col, snow){
  c.fillStyle = '#5a3f2a'; c.fillRect(x - 0.7 * k, y - 3 * k, 1.4 * k, 3 * k);
  for(let i = 0; i < 3; i++){ c.fillStyle = shade(col, 1 + i * 0.08); c.beginPath(); c.moveTo(x - (7 - i * 1.8) * k, y - (3 + i * 5) * k); c.lineTo(x, y - (12 + i * 5) * k); c.lineTo(x + (7 - i * 1.8) * k, y - (3 + i * 5) * k); c.fill();
    if(snow){ c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x - (3 - i) * k, y - (8 + i * 5) * k); c.lineTo(x, y - (12 + i * 5) * k); c.lineTo(x + (3 - i) * k, y - (8 + i * 5) * k); c.fill(); } }
}
function cactusBig(c, x, y, k, col){ c.fillStyle = col; rr(c, x - 2 * k, y - 18 * k, 4 * k, 18 * k, 2 * k); c.fill(); rr(c, x - 7 * k, y - 13 * k, 3 * k, 8 * k, 1.5 * k); c.fill(); c.fillRect(x - 7 * k, y - 7 * k, 6 * k, 2.5 * k); rr(c, x + 4 * k, y - 15 * k, 3 * k, 8 * k, 1.5 * k); c.fill(); c.fillRect(x + 1 * k, y - 9 * k, 6 * k, 2.5 * k); }
function lighthouse(c, x, y){
  c.fillStyle = '#7a8a6a'; c.beginPath(); c.moveTo(x - 30, y + 6); c.lineTo(x - 18, y - 4); c.lineTo(x + 20, y - 4); c.lineTo(x + 40, y + 6); c.fill();
  c.fillStyle = '#f4efe2'; c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x - 2.6, y - 30); c.lineTo(x + 2.6, y - 30); c.lineTo(x + 4, y - 4); c.fill();
  c.fillStyle = '#d9434f'; c.fillRect(x - 3.6, y - 14, 7.2, 4); c.fillRect(x - 3, y - 24, 6, 3.5);
  c.fillStyle = '#39424e'; c.fillRect(x - 3.4, y - 35, 6.8, 5); c.fillStyle = '#ffe98a'; c.fillRect(x - 2.2, y - 34, 4.4, 3);
  c.fillStyle = '#39424e'; c.beginPath(); c.moveTo(x - 4, y - 35); c.lineTo(x, y - 39); c.lineTo(x + 4, y - 35); c.fill();
}

/* ---------- Sprites (side view, facing right, feet at y = 0) ---------- */
const COATS = {
  cattle: ['#8a5230', '#2e2a2a', '#c98f55', '#f2efe8', '#9b3b22', '#6b4a36'],
  horse:  ['#7a4424', '#a45a2a', '#9aa0a8', '#d9b46a', '#f1ece2', '#3b2f2f'],
  sheep:  ['#f4f1e8', '#efe8d6', '#f7f4ee', '#e6dcc8', '#f4f1e8', '#3a3434'],
  boar:   ['#5a3b2a', '#4a3226', '#6b4a36', '#3e2b20'],
  bison:  ['#4a3222', '#553a26', '#402a1c']
};
function legs(c, xs, top, len, ph, amp, col, w){
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round';
  xs.forEach((x, i) => { const sw = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.3 : 0)) * amp; c.beginPath(); c.moveTo(x, top); c.lineTo(x + sw, top + len * 0.55); c.lineTo(x + sw * 0.6, top + len); c.stroke(); });
}
function drawCattle(c, coat, ph, amp, id){
  const dark = shade(coat, 0.6);
  legs(c, [-4.5, -2.6, 4.2, 6], -6.5, 6.5, ph, amp, dark, 1.5);
  c.strokeStyle = dark; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-7.5, -9); c.quadraticCurveTo(-9.5, -6 + Math.sin(ph * 0.5) * 1, -9, -3.5); c.stroke();
  c.fillStyle = shade(coat, 0.5); circ(c, -9, -3.4, 0.9); c.fill();
  c.fillStyle = coat; ell(c, 0, -8.5, 7.8, 4.3); c.fill();
  if(coat === '#f2efe8'){ c.fillStyle = '#2e2a2a'; ell(c, -2.5, -9.5, 2.4, 1.8, 0.4); c.fill(); ell(c, 3, -7.4, 1.8, 1.4); c.fill(); }
  c.fillStyle = 'rgba(255,255,255,.14)'; ell(c, -1, -11, 5, 1.3); c.fill();
  // head
  c.fillStyle = coat; ell(c, 8.6, -10.2, 3, 2.7, 0.3); c.fill();
  c.fillStyle = coat === '#2e2a2a' ? '#6b5a5a' : '#e9c4a4'; ell(c, 10.6, -9, 1.7, 1.5); c.fill();
  c.fillStyle = '#f4e8c8'; c.beginPath(); c.moveTo(7.2, -12.4); c.quadraticCurveTo(6.6, -14.6, 5.4, -14.2); c.lineTo(6.6, -12); c.fill(); c.beginPath(); c.moveTo(9, -12.7); c.quadraticCurveTo(9.8, -14.8, 11, -14.4); c.lineTo(9.6, -12.2); c.fill();
  c.fillStyle = shade(coat, 0.8); ell(c, 6.4, -11.4, 1.5, 0.8, -0.4); c.fill();
  c.fillStyle = '#1b1414'; circ(c, 8.9, -10.8, 0.55); c.fill();
  void id;
}
function drawHorse(c, coat, ph, amp, mane, saddle){
  const dark = shade(coat, 0.62);
  legs(c, [-5, -3.2, 4.2, 6], -9.5, 9.5, ph, amp * 1.4, dark, 1.35);
  // tail
  c.fillStyle = mane; c.beginPath(); c.moveTo(-7, -12.5); c.quadraticCurveTo(-12.5, -11 + Math.sin(ph) * 1.2, -11.5 + Math.sin(ph * 0.8), -4.5); c.quadraticCurveTo(-9.5, -9, -6.5, -10.5); c.fill();
  c.fillStyle = coat; ell(c, 0, -12, 7.6, 3.8); c.fill();
  // neck and head
  c.beginPath(); c.moveTo(3.6, -14.5); c.lineTo(7.8, -20.5); c.lineTo(10.3, -19.4); c.lineTo(7.4, -11); c.closePath(); c.fill();
  ell(c, 10.6, -18.4, 3.3, 1.7, 0.55); c.fill();
  c.fillStyle = shade(coat, 0.8); ell(c, 12.4, -16.8, 1.3, 1.1); c.fill();
  c.fillStyle = mane; c.beginPath(); c.moveTo(3.4, -15); c.lineTo(7.4, -21.6); c.lineTo(8.6, -21); c.lineTo(5.6, -14.6); c.fill();
  c.fillStyle = coat; c.beginPath(); c.moveTo(8.5, -20.2); c.lineTo(8.8, -22.8); c.lineTo(9.8, -20.4); c.fill();
  c.fillStyle = '#140f0f'; circ(c, 10.2, -19.2, 0.5); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; ell(c, -1, -14.6, 5, 1.1); c.fill();
  if(coat === '#f1ece2' && !saddle){ c.fillStyle = '#6b4a36'; ell(c, -2, -12, 2.5, 2); c.fill(); ell(c, 3, -11, 1.6, 1.3); c.fill(); }
}
function drawSheep(c, coat, ph, amp, t){
  legs(c, [-3, -1.5, 2.2, 3.5], -4.5, 4.5, ph, amp * 0.8, '#2d2828', 1.1);
  c.fillStyle = shade(coat, 0.86);
  for(let i = 0; i < 6; i++){ circ(c, -4 + i * 1.6, -6.2 + Math.sin(i * 1.7) * 0.8, 2.7); c.fill(); }
  c.fillStyle = coat;
  for(let i = 0; i < 6; i++){ circ(c, -4 + i * 1.6, -7.4 + Math.cos(i * 1.3) * 0.9, 2.6); c.fill(); }
  c.fillStyle = '#2d2828'; ell(c, 5.6, -7.2, 2.2, 1.9, 0.4); c.fill();
  ell(c, 4.2, -8.6, 1.3, 0.6, -0.5); c.fill();
  c.fillStyle = '#fff'; circ(c, 6.1, -7.8, 0.45); c.fill();
  c.fillStyle = coat; circ(c, 4.4, -9.2, 1.3); c.fill();
  void t;
}
function drawBoar(c, coat, ph, amp){
  const dark = shade(coat, 0.6);
  legs(c, [-3.8, -2.4, 3, 4.4], -4.5, 4.5, ph, amp, dark, 1.3);
  c.strokeStyle = dark; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-6.5, -7); c.quadraticCurveTo(-8.5, -8.5, -7.6, -6); c.stroke();
  c.fillStyle = coat; c.beginPath(); c.moveTo(-6.8, -6); c.quadraticCurveTo(-6.6, -10.4, -1, -10.8); c.quadraticCurveTo(4, -11, 6, -8.5); c.lineTo(9.6, -6.4); c.lineTo(9.2, -4.6); c.quadraticCurveTo(2, -3.4, -6, -4); c.closePath(); c.fill();
  c.strokeStyle = shade(coat, 0.45); c.lineWidth = 0.6; c.beginPath(); for(let i = 0; i < 8; i++) c.lineTo(-5 + i * 1.3, -10.4 - (i % 2) * 1.1); c.stroke();
  c.fillStyle = '#b0826a'; ell(c, 9.6, -5.5, 0.8, 1.1); c.fill();
  c.fillStyle = '#fbf3de'; c.beginPath(); c.moveTo(7.8, -5); c.quadraticCurveTo(9, -7, 8.6, -7.4); c.lineTo(8.2, -5); c.fill();
  c.fillStyle = dark; c.beginPath(); c.moveTo(4, -9.6); c.lineTo(4.6, -12.2); c.lineTo(5.8, -9.4); c.fill();
  c.fillStyle = '#1b1010'; circ(c, 6.3, -8.1, 0.5); c.fill();
}
function drawBison(c, coat, ph, amp){
  const dark = shade(coat, 0.65), mane = shade(coat, 0.72);
  legs(c, [-5, -3.4, 4, 5.8], -6.5, 6.5, ph, amp * 0.8, dark, 1.8);
  c.strokeStyle = dark; c.lineWidth = 0.8; line(c, -7.4, -9.5, -8.6, -5.5);
  c.fillStyle = shade(coat, 1.25); ell(c, -2.6, -8.8, 5.8, 3.8); c.fill();
  c.fillStyle = mane; c.beginPath(); c.moveTo(-2, -5.5); c.quadraticCurveTo(-1.5, -15.6, 3.6, -15.2); c.quadraticCurveTo(8.4, -13.8, 8.4, -8.4); c.quadraticCurveTo(7.2, -4.4, 2.4, -4.2); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.1)'; ell(c, 1.6, -13.2, 3, 1); c.fill();
  c.fillStyle = shade(coat, 0.5); ell(c, 9, -7, 2.8, 2.9); c.fill();
  c.beginPath(); c.moveTo(8, -4.6); c.lineTo(9.6, -2.2); c.lineTo(10.2, -4.6); c.fill();   // beard
  c.strokeStyle = '#e8dcc0'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(8.2, -9.2); c.quadraticCurveTo(8, -11, 9.2, -11.2); c.stroke();
  c.fillStyle = '#0e0909'; circ(c, 10.1, -7.8, 0.5); c.fill();
}
function drawDog(c, ph, amp){
  legs(c, [-2.4, -1.4, 2, 3], -3.4, 3.4, ph, amp, '#8a5a2c', 0.9);
  c.strokeStyle = '#d9a55a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3.6, -4.6); c.quadraticCurveTo(-5.6, -7 + Math.sin(G.time * 18) * 1.2, -5, -8); c.stroke();
  c.fillStyle = '#d9a55a'; ell(c, 0, -4.6, 4, 1.9); c.fill();
  c.fillStyle = '#f4ead8'; ell(c, 1.5, -3.8, 1.6, 0.9); c.fill();
  c.fillStyle = '#d9a55a'; circ(c, 4, -6.4, 1.9); c.fill(); ell(c, 5.8, -6, 1.3, 0.8); c.fill();
  c.fillStyle = '#8a5a2c'; ell(c, 3.2, -7.4, 0.8, 1.5, 0.5); c.fill();
  c.fillStyle = '#1b1010'; circ(c, 7, -6.2, 0.45); c.fill(); circ(c, 4.6, -6.9, 0.35); c.fill();
  c.fillStyle = '#d9434f'; c.fillRect(2.4, -5.4, 1.6, 0.7);
}
const SKIN = ['#f1c8a0', '#c98e62', '#8d5a3b', '#e8b48a'];
function drawCowboy(c, r, ph, spd){
  const col = r.color, bounce = Math.abs(Math.sin(ph)) * Math.min(1, spd / 50) * 0.9;
  c.save(); c.translate(0, -bounce);
  // saddle blanket and saddle
  c.fillStyle = col; rr(c, -3.6, -15.6, 6.4, 3.6, 0.8); c.fill();
  c.fillStyle = '#6b3f22'; rr(c, -2.6, -16.6, 5, 2.2, 1); c.fill();
  // leg (jeans + boot)
  c.strokeStyle = '#3a5a8c'; c.lineWidth = 1.8; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, -16.2); c.lineTo(1.4, -12.6); c.lineTo(0.8, -10.4); c.stroke();
  c.fillStyle = '#5a3620'; rr(c, 0, -11, 2.6, 1.4, 0.5); c.fill();
  // body
  c.fillStyle = shade(col, 0.82); rr(c, -1.8, -22.6, 4, 6.8, 1.6); c.fill();
  c.fillStyle = '#d9434f'; c.beginPath(); c.moveTo(-1.4, -22.4); c.lineTo(2.2, -22.4); c.lineTo(0.6, -20.4); c.fill();
  // arm
  c.strokeStyle = shade(col, 0.7); c.lineWidth = 1.4;
  if(r.holT > 0){ const u = r.holT / 0.35; c.beginPath(); c.moveTo(1, -21.4); c.lineTo(3.4, -24.5); c.lineTo(4.2 + u * 1.6, -27.4); c.stroke(); c.fillStyle = SKIN[(r.slot || 0) % 4]; circ(c, 4.2 + u * 1.6, -27.8, 0.9); c.fill(); }
  else if(r.gentle){ const w = Math.sin(G.time * 5) * 0.8; c.beginPath(); c.moveTo(1, -21.2); c.lineTo(4, -20.4 + w); c.lineTo(6.4, -20.6 + w); c.stroke(); }
  else { c.beginPath(); c.moveTo(1, -21.2); c.lineTo(3.4, -18.6); c.lineTo(5.6, -18.4); c.stroke(); }
  // head, hat
  c.fillStyle = SKIN[(r.slot || 0) % 4]; circ(c, 0.6, -24.8, 2.1); c.fill();
  c.fillStyle = '#1b1414'; circ(c, 1.8, -25.1, 0.4); c.fill();
  const hatUp = r.holT > 0 ? -0.8 : 0;
  c.fillStyle = col; ell(c, 0.4, -26.4 + hatUp, 4.4, 1.05); c.fill();
  rr(c, -1.6, -29.6 + hatUp, 4, 3.4, 1.2); c.fill();
  c.fillStyle = shade(col, 0.55); c.fillRect(-1.6, -27.2 + hatUp, 4, 0.8);
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-1, -29.2 + hatUp, 1, 1.6);
  c.restore();
}

/* ---------- Per-frame drawing ---------- */
const faceMem = new Map();
function facing(id, cx){ let f = faceMem.get(id) || (cx < 0 ? -1 : 1); if(cx > 0.22) f = 1; else if(cx < -0.22) f = -1; faceMem.set(id, f); return f; }
function drawShadow(c, x, y, w){ c.fillStyle = 'rgba(0,0,0,.2)'; ell(c, x, y + 0.5, w, w * 0.28); c.fill(); }
function animalSprite(c, a){
  const sp = SPECIES[a.k], k = depth(a.y) * sp.size, dir = facing('a' + a.id, Math.cos(a.head));
  const coats = COATS[a.k], coat = coats[a.id % coats.length];
  const moving = a.spd > 3, ph = a.wob * 2.2, amp = moving ? Math.min(2, a.spd / 18) : 0;
  const scared = a.st === 'scatter' || a.st === 'edge';
  drawShadow(c, a.x, a.y, 8 * k);
  c.save(); c.translate(a.x, a.y);
  if(a.st === 'charge' && a.alert > 0) c.translate(Math.sin(G.time * 60) * 0.6, 0);
  c.scale(dir * k, k);
  if(moving) c.translate(0, -Math.abs(Math.sin(ph)) * 0.6);
  if(a.k === 'cattle') drawCattle(c, coat, ph, amp, a.id);
  else if(a.k === 'horse') drawHorse(c, coat, ph, amp, shade(coat, 0.45), false);
  else if(a.k === 'sheep') drawSheep(c, coat, ph, amp, G.time);
  else if(a.k === 'boar') drawBoar(c, coat, ph, amp);
  else drawBison(c, coat, ph, amp);
  c.restore();
  // mood marks
  const top = a.y - (a.k === 'horse' ? 24 : a.k === 'bison' ? 19 : a.k === 'sheep' ? 12 : 15) * k;
  if(a.st === 'edge'){
    const u = clamp(a.stT / D().edgeT, 0, 1);
    c.strokeStyle = '#ff5a4e'; c.lineWidth = 1.2; c.beginPath(); c.arc(a.x, top - 5, 4, -Math.PI / 2, -Math.PI / 2 + TAU * u); c.stroke();
    if(Math.floor(G.time * 8) % 2) outlined(c, '!', a.x, top - 5, 6, '#ff5a4e');
  } else if(a.alert > 0 || a.st === 'charge'){ outlined(c, a.st === 'charge' ? '!!' : '!', a.x + dir * 4, top - 3, 6, a.st === 'charge' ? '#ff5a4e' : '#ffd45e'); }
  else if(scared){ c.fillStyle = '#bfe8ff'; for(let i = 0; i < 2; i++){ ell(c, a.x - dir * (3 + i * 3), top + 2 - i * 2, 0.8, 1.3); c.fill(); } }
  else if(a.st === 'in' && (a.id + Math.floor(G.time * 0.5)) % 7 === 0){ c.fillStyle = '#ff7eb6'; heart(c, a.x, top - 2, 1.6); }
}
function heart(c, x, y, s){ c.beginPath(); c.moveTo(x, y + s); c.bezierCurveTo(x - s * 2, y - s * 0.4, x - s * 0.8, y - s * 1.8, x, y - s * 0.6); c.bezierCurveTo(x + s * 0.8, y - s * 1.8, x + s * 2, y - s * 0.4, x, y + s); c.fill(); }
function riderSprite(c, r, dt){
  const k = depth(r.y), dir = r.face || 1, spd = hyp(r.vx, r.vy);
  const ph = r.gait * 1.4, amp = spd > 6 ? Math.min(2.2, spd / 40) : 0;
  const hop = r.hopT > 0 ? Math.sin(Math.PI * (1 - r.hopT / 0.42)) * 9 : 0;
  if(r.ghost) c.globalAlpha = 0.35;
  if(r.invT > 0 && !r.ghost && r.stunT <= 0 && Math.floor(G.time * 14) % 2) c.globalAlpha = 0.55;
  // pressure ring on the ground (only for real riders)
  if(!r.ghost && !r.dog && (G.state === 'play' || G.state === 'count') && !G.demo){
    c.strokeStyle = r.color; c.globalAlpha *= r.gentle ? 0.5 : 0.22; c.lineWidth = r.gentle ? 1 : 0.7;
    if(r.gentle) c.setLineDash([3, 2.5]);
    ell(c, r.x, r.y, (r.gentle ? 34 : 24) * k, (r.gentle ? 12 : 8.5) * k); c.stroke(); c.setLineDash([]);
    c.globalAlpha = r.ghost ? 0.35 : 1;
  }
  drawShadow(c, r.x, r.y, (r.dog ? 5 : 9) * k * (1 - hop / 20));
  c.save(); c.translate(r.x, r.y - hop);
  c.scale(dir * k, k);
  if(r.dog){ drawDog(c, ph * 1.6, amp); c.restore(); c.globalAlpha = 1; return; }
  if(r.rearT > 0){ c.translate(-5, 0); c.rotate(-0.42); c.translate(5, 0); }
  if(r.stunT > 0) c.rotate(Math.sin(G.time * 20) * 0.08);
  const coat = HORSES[(r.horse || 0) % HORSES.length];
  drawHorse(c, coat, ph, amp, shade(coat, 0.4), true);
  drawCowboy(c, r, ph, spd);
  c.restore();
  // holler: sound waves in front
  if(r.holT > 0){
    const u = 1 - r.holT / 0.35, hx = r.hdx || dir, hy = r.hdy || 0, a = Math.atan2(hy, hx);
    c.strokeStyle = 'rgba(255,240,200,' + (1 - u) + ')'; c.lineWidth = 1;
    for(let i = 0; i < 3; i++){ const R = (10 + i * 7 + u * 16) * k; c.beginPath(); c.arc(r.x + hx * 4, r.y - 18 * k + hy * 4, R, a - 0.55, a + 0.55); c.stroke(); }
  }
  if(r.stunT > 0){ c.fillStyle = '#ffd45e'; for(let i = 0; i < 3; i++){ const an = G.time * 7 + i * TAU / 3; star(c, r.x + Math.cos(an) * 5, r.y - 31 * k + Math.sin(an) * 1.6, 1.4); } }
  c.globalAlpha = 1;
}
function star(c, x, y, R){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); c.fill(); }
function obstacleSprite(c, o, B){
  const k = depth(o.y);
  if(o.k === 'rock'){ drawShadow(c, o.x, o.y, o.r * 1.2); const col = B.wx === 'night' ? '#6a6076' : B.wx === 'snow' ? '#8d98a6' : B.bi === 1 ? '#a8624a' : '#8e8e86';
    c.fillStyle = shade(col, 0.8); ell(c, o.x, o.y - o.r * 0.5, o.r * 1.15, o.r * 0.75); c.fill(); c.fillStyle = col; ell(c, o.x - o.r * 0.15, o.y - o.r * 0.7, o.r * 0.9, o.r * 0.55); c.fill();
    c.fillStyle = 'rgba(255,255,255,.2)'; ell(c, o.x - o.r * 0.35, o.y - o.r * 0.95, o.r * 0.4, o.r * 0.18); c.fill();
    if(B.wx === 'snow'){ c.fillStyle = '#fff'; ell(c, o.x - o.r * 0.1, o.y - o.r * 1.05, o.r * 0.7, o.r * 0.22); c.fill(); } }
  else if(o.k === 'bush'){ drawShadow(c, o.x, o.y, o.r * 1.2); const col = B.bi === 6 ? '#5f9a4a' : '#4f8a3a'; c.fillStyle = shade(col, 0.8); circ(c, o.x - o.r * 0.5, o.y - o.r * 0.6, o.r * 0.7); c.fill(); circ(c, o.x + o.r * 0.5, o.y - o.r * 0.55, o.r * 0.7); c.fill(); c.fillStyle = col; circ(c, o.x, o.y - o.r * 0.95, o.r * 0.8); c.fill();
    if(o.s > 0.5){ c.fillStyle = '#e2463c'; for(let i = 0; i < 4; i++){ circ(c, o.x + (rng(o.x + i) - 0.5) * o.r * 1.4, o.y - o.r * (0.5 + rng(o.y + i) * 0.8), 0.6); c.fill(); } } }
  else if(o.k === 'cactus'){ drawShadow(c, o.x, o.y, 4); cactusBig(c, o.x, o.y, 0.55 * k * (o.r / 4), B.wx === 'night' ? '#2f4a3c' : '#4f8a4a'); if(B.wx !== 'night' && o.s > 0.6){ c.fillStyle = '#ff7eb6'; circ(c, o.x, o.y - 10.5 * k * (o.r / 4), 1.1); c.fill(); } }
  else if(o.k === 'pine'){ drawShadow(c, o.x, o.y, 5); pineTree(c, o.x, o.y, 0.8 * k, B.wx === 'snow' ? '#3f6b5a' : '#2f6a42', B.wx === 'snow'); }
  else if(o.k === 'log'){ const hx = o.len / 2; drawShadow(c, o.x, o.y, hx + 2); c.fillStyle = '#7a4f2e'; rr(c, o.x - hx, o.y - o.r * 1.6, o.len, o.r * 1.6, o.r * 0.8); c.fill(); c.fillStyle = '#c9a070'; ell(c, o.x + hx - 0.5, o.y - o.r * 0.8, o.r * 0.55, o.r * 0.8); c.fill(); c.strokeStyle = '#8a6040'; c.lineWidth = 0.4; circ(c, o.x + hx - 0.5, o.y - o.r * 0.8, o.r * 0.3); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 0.5; line(c, o.x - hx + 2, o.y - o.r, o.x + hx - 3, o.y - o.r * 1.1); if(B.wx === 'snow'){ c.fillStyle = '#fff'; rr(c, o.x - hx, o.y - o.r * 1.7, o.len, 1.2, 0.6); c.fill(); } }
}
function postSprite(c, x, y, h, col, cap){ c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, x + 1, y, 2, 0.6); c.fill(); c.fillStyle = col; c.fillRect(x - 1.1, y - h, 2.2, h); c.fillStyle = shade(col, 1.25); c.fillRect(x - 0.9, y - h, 1.8, 0.9); if(cap){ c.globalAlpha = 0.3; c.fillStyle = cap; circ(c, x, y - h - 1.4, 3.4); c.fill(); c.globalAlpha = 1; circ(c, x, y - h - 1.4, 1.5); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; circ(c, x - 0.4, y - h - 1.9, 0.5); c.fill(); } }
function fenceRun(c, x, ya, yb, h, col){ c.strokeStyle = col; c.lineWidth = 1.4; line(c, x, ya - h * 0.85, x, yb - h * 0.85); line(c, x, ya - h * 0.45, x, yb - h * 0.45); }
function snakeSprite(c, s){
  if(s.st === 2){ // slithering away
    c.strokeStyle = '#8a9a4a'; c.lineWidth = 1.4; c.beginPath(); for(let i = 0; i < 8; i++) c.lineTo(s.x - i * 1.6 * Math.sign(s.vx || 1), s.y - 0.8 + Math.sin(G.time * 12 + i) * 1); c.stroke(); return;
  }
  const shake = s.rattle > 0 ? Math.sin(G.time * 70) * 0.8 : 0;
  c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, s.x, s.y, 5, 1.6); c.fill();
  c.strokeStyle = '#8a9a4a'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(s.x, s.y - 1.4, 4.2, 1.8, 0, 0, TAU); c.stroke();
  c.strokeStyle = '#6f7d38'; c.lineWidth = 1.4; c.beginPath(); c.ellipse(s.x, s.y - 2.8, 2.8, 1.3, 0, 0, TAU); c.stroke();
  c.fillStyle = '#8a9a4a'; ell(c, s.x + 1.5, s.y - 5.3, 1.6, 1.1, 0.3); c.fill();
  c.fillStyle = '#1b1010'; circ(c, s.x + 2.2, s.y - 5.6, 0.35); c.fill();
  if(s.rattle > 0 && Math.floor(G.time * 10) % 2){ c.strokeStyle = '#e2463c'; c.lineWidth = 0.5; line(c, s.x + 3, s.y - 5, s.x + 4.6, s.y - 4.7); }
  c.fillStyle = '#d9c28a'; ell(c, s.x - 4.6 + shake, s.y - 3, 0.8, 1.3); c.fill();
  if(s.rattle > 0){ c.strokeStyle = 'rgba(255,240,200,.8)'; c.lineWidth = 0.5; for(let i = 0; i < 2; i++) { c.beginPath(); c.arc(s.x - 4.6, s.y - 3, 2 + i * 1.6 + (G.time * 6 % 1), Math.PI * 0.7, Math.PI * 1.3); c.stroke(); } }
}
function holeSprite(c, h, st){
  c.fillStyle = h.k === 'crab' ? 'rgba(90,70,40,.6)' : 'rgba(60,38,20,.65)'; ell(c, h.x, h.y, 3.2, 1.2); c.fill();
  c.fillStyle = h.k === 'crab' ? '#e0cf9a' : '#8a6a44'; ell(c, h.x + 3, h.y + 0.4, 1.4, 0.6); c.fill();
  if(st === 'wiggle'){ c.fillStyle = '#8a6a44'; for(let i = 0; i < 3; i++){ circ(c, h.x + (rng(i + G.time * 30 | 0) - 0.5) * 5, h.y - rng(i + 4 + (G.time * 30 | 0)) * 3, 0.6); c.fill(); } }
  if(st === 'up'){
    if(h.k === 'crab'){ c.fillStyle = '#e2563c'; ell(c, h.x, h.y - 1.4, 2.4, 1.4); c.fill(); c.strokeStyle = '#e2563c'; c.lineWidth = 0.7; const w = Math.sin(G.time * 14) * 0.8; line(c, h.x - 2, h.y - 2, h.x - 3.6, h.y - 3.6 + w); line(c, h.x + 2, h.y - 2, h.x + 3.6, h.y - 3.6 - w); c.fillStyle = '#1b1010'; circ(c, h.x - 0.7, h.y - 2.8, 0.35); c.fill(); circ(c, h.x + 0.7, h.y - 2.8, 0.35); c.fill(); }
    else { c.fillStyle = '#a0764a'; ell(c, h.x, h.y - 2.6, 2.2, 2.8); c.fill(); c.fillStyle = '#e8cfa8'; ell(c, h.x, h.y - 1.8, 1.3, 1.4); c.fill(); c.fillStyle = '#1b1010'; circ(c, h.x - 0.8, h.y - 3.6, 0.35); c.fill(); circ(c, h.x + 0.8, h.y - 3.6, 0.35); c.fill(); c.fillStyle = '#fff'; c.fillRect(h.x - 0.5, h.y - 2.2, 1, 0.9); }
  }
}
function tumbleSprite(c, w, p){
  c.fillStyle = 'rgba(0,0,0,.15)'; ell(c, p.x, w.y + 0.5, w.r, w.r * 0.3); c.fill();
  c.save(); c.translate(p.x, p.y - w.r); c.rotate(p.rot);
  c.strokeStyle = '#b08850'; c.lineWidth = 0.6;
  for(let i = 0; i < 6; i++){ c.beginPath(); c.arc((rng(w.id + i) - 0.5) * w.r * 0.6, (rng(w.id + i + 9) - 0.5) * w.r * 0.6, w.r * (0.5 + rng(i) * 0.5), i, i + 3.6); c.stroke(); }
  c.restore();
}
function crossSprite(c, m, kind, rid){
  if(m.lead){
    // the neighbour on a mule, waving
    drawShadow(c, m.x, m.y, 7);
    c.save(); c.translate(m.x, m.y); c.scale(0.9 * depth(m.y), 0.9 * depth(m.y));
    drawHorse(c, '#8a7a6a', G.time * 8, 1.2, '#4a3a2a', true);
    drawCowboy(c, { color: '#9aa65a', slot: 2, holT: 0, gentle: Math.sin(G.time * 2) > 0 }, G.time * 8, 30);
    c.restore(); return;
  }
  const k = depth(m.y);
  drawShadow(c, m.x, m.y, 3);
  c.save(); c.translate(m.x, m.y); c.scale(k, k);
  if(kind === 'goat'){ legs(c, [-2, 2], -3, 3, G.time * 10 + m.j, 1, '#6b5a4a', 0.8); c.fillStyle = '#e8e0d0'; ell(c, 0, -4.4, 3.4, 1.8); c.fill(); circ(c, 3, -6, 1.4); c.fill(); c.strokeStyle = '#8a7a6a'; c.lineWidth = 0.5; line(c, 2.6, -7.2, 1.6, -8.6); }
  else { c.fillStyle = '#fbfbf5'; ell(c, 0, -2.6, 2.4, 1.8); c.fill(); circ(c, 1.8, -4.4, 1.2); c.fill(); c.fillStyle = '#f5a623'; c.fillRect(2.6, -4.6, 1.4, 0.6); c.fillRect(-0.8, -0.9, 0.6, 0.9 + Math.sin(G.time * 16 + m.j) * 0.3); c.fillRect(0.6, -0.9, 0.6, 0.9 - Math.sin(G.time * 16 + m.j) * 0.3); c.fillStyle = '#1b1010'; circ(c, 2.2, -4.7, 0.3); c.fill(); }
  c.restore(); void rid;
}

/* ---------- Particles (cosmetic, made on every screen from what's moving) ---------- */
let parts = [];
function puff(x, y, col, n, spread, up){
  for(let i = 0; i < n; i++) parts.push({ x: x + (Math.random() - 0.5) * spread, y, vx: (Math.random() - 0.5) * 14, vy: -(Math.random() * (up || 6)), r: 1 + Math.random() * 1.6, t: 0, life: 0.45 + Math.random() * 0.35, col });
  if(parts.length > 260) parts.splice(0, parts.length - 260);
}
function fxStep(dt){
  const L = G.L, B = L.B;
  const dust = B.wx === 'snow' ? 'rgba(255,255,255,.8)' : B.wx === 'night' ? 'rgba(120,100,130,.5)' : 'rgba(214,180,130,.55)';
  for(const a of G.animals){
    if(a.st === 'lost' || a.st === 'back' || a.spd < 30) continue;
    if(Math.random() < dt * (a.spd / 12)){ const t = terrainAt(a.x, a.y); puff(a.x - Math.cos(a.head) * 6, a.y, t.water ? 'rgba(200,235,255,.8)' : dust, 1, 3, t.water ? 10 : 5); }
  }
  for(const r of G.riders){
    if(r.ghost) continue;
    const sp = hyp(r.vx, r.vy);
    if(sp > 40 && Math.random() < dt * sp / 10){ const t = terrainAt(r.x, r.y); puff(r.x - (r.face || 1) * 7, r.y, t.water ? 'rgba(200,235,255,.8)' : dust, 1, 3, t.water ? 12 : 5); }
    if(r.hopT > 0 && r.hopT < 0.05) puff(r.x, r.y, dust, 5, 8, 8);
  }
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 10 * dt; p.r += dt * 2; }
  parts = parts.filter(p => p.t < p.life);
  for(const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < (f.big ? 1.6 : 1.1));
}

/* ---------- Weather ---------- */
let nightCv = null;
function drawWeather(c, L){
  const B = L.B, t = G.time;
  if(B.wx === 'snow'){
    c.fillStyle = 'rgba(255,255,255,.85)';
    for(let i = 0; i < 80; i++){ const x = ((rng(i) * VW + t * (8 + rng(i + 1) * 10) + Math.sin(t + i) * 6) % VW + VW) % VW, y = (rng(i + 2) * VH + t * (14 + rng(i + 3) * 14)) % VH; c.fillRect(x, y, 1 + rng(i + 4) * 0.8, 1 + rng(i + 4) * 0.8); }
    c.fillStyle = 'rgba(230,238,248,.12)'; c.fillRect(0, FY0 - 10, VW, 40);
  } else if(B.wx === 'dust'){
    const g = gustAt(L, G.roundT);
    if(g === 1){ c.fillStyle = 'rgba(230,190,140,.18)'; c.fillRect(0, 0, VW, VH); c.strokeStyle = 'rgba(255,235,200,.45)'; c.lineWidth = 0.7; c.beginPath();
      for(let i = 0; i < 30; i++){ const y = rng(i) * VH, x = ((rng(i + 7) * VW * 1.4 - t * 260) % (VW * 1.4) + VW * 1.4) % (VW * 1.4) - 20; c.moveTo(x, y); c.lineTo(x + 14 + rng(i) * 16, y); } c.stroke(); }
    else { c.fillStyle = 'rgba(240,200,150,.05)'; c.fillRect(0, FY0, VW, VH - FY0); }
  } else if(B.wx === 'mist'){
    for(let i = 0; i < 3; i++){ const y = FY0 + 20 + i * 40, x = ((t * (4 + i * 2) + i * 130) % (VW + 200)) - 100; const g = c.createLinearGradient(0, y - 10, 0, y + 10); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x, y - 10, 220, 20); }
  } else if(B.wx === 'fog'){
    for(let i = 0; i < 4; i++){ const x = ((t * (5 + i * 1.5) + i * 110) % (VW + 160)) - 80, y = FY0 + 20 + (i * 37) % 120; c.fillStyle = 'rgba(245,250,255,.28)'; ell(c, x, y, 46, 14); c.fill(); ell(c, x + 26, y - 5, 30, 10); c.fill(); }
  } else if(B.wx === 'dusk'){
    c.fillStyle = 'rgba(255,150,80,.08)'; c.fillRect(0, 0, VW, VH);
  }
  if(B.haz.fireflies){ for(let i = 0; i < 14; i++){ const x = 40 + rng(i) * 300 + Math.sin(t * 0.7 + i) * 12, y = FY0 + 8 + rng(i + 5) * 110 + Math.cos(t * 0.9 + i * 2) * 6, on = (Math.sin(t * 2 + i * 1.7) + 1) / 2; c.fillStyle = 'rgba(230,255,140,' + (on * 0.9) + ')'; circ(c, x, y, 0.8); c.fill(); c.fillStyle = 'rgba(230,255,140,' + (on * 0.18) + ')'; circ(c, x, y, 3); c.fill(); } }
  if(B.wx === 'night'){
    // lanterns: a dark overlay with pools of light (drawn small, scaled up)
    const s = 0.5;
    if(!nightCv){ nightCv = document.createElement('canvas'); nightCv.width = VW * s; nightCv.height = VH * s; }
    const n = nightCv.getContext('2d');
    n.globalCompositeOperation = 'source-over'; n.clearRect(0, 0, nightCv.width, nightCv.height);
    n.fillStyle = 'rgba(6,8,28,.78)'; n.fillRect(0, 0, nightCv.width, nightCv.height);
    n.globalCompositeOperation = 'destination-out';
    const hole = (x, y, R, k) => { const g = n.createRadialGradient(x * s, y * s, 0, x * s, y * s, R * s); g.addColorStop(0, 'rgba(0,0,0,' + k + ')'); g.addColorStop(0.6, 'rgba(0,0,0,' + k * 0.7 + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); n.fillStyle = g; n.fillRect((x - R) * s, (y - R) * s, R * 2 * s, R * 2 * s); };
    for(const r of G.riders) if(!r.ghost) hole(r.x, r.y - 10, r.dog ? 34 : 62, 1);
    hole(PEN_X - 2, GATE_Y0 - 16, 44, 0.95); hole(PEN_X - 2, GATE_Y1 - 6, 36, 0.8);
    hole(300, 30, 90, 0.45);
    c.drawImage(nightCv, 0, 0, VW, VH);
    // eyes glint in the dark
    for(const a of G.animals){ if(a.st === 'lost' || a.st === 'in' || a.st === 'back') continue; if(G.riders.some(r => !r.ghost && hyp(r.x - a.x, r.y - a.y) < 50)) continue;
      const k = depth(a.y) * SPECIES[a.k].size, dir = facing('a' + a.id, Math.cos(a.head)); c.fillStyle = 'rgba(255,240,150,.9)'; c.fillRect(a.x + dir * 8.6 * k, a.y - (a.k === 'horse' ? 19 : 10) * k, 0.9, 0.9); }
    // lanterns
    for(const [x, y] of [[PEN_X - 3, GATE_Y0 - 14], [PEN_X - 3, GATE_Y1 - 14]]){ c.fillStyle = 'rgba(255,210,120,.35)'; circ(c, x, y, 4); c.fill(); c.fillStyle = '#ffe9a8'; rr(c, x - 1.2, y - 1.8, 2.4, 3.2, 0.6); c.fill(); }
    for(const r of G.riders){ if(r.ghost || r.dog) continue; const k = depth(r.y), lx = r.x - (r.face || 1) * 3 * k, ly = r.y - 17 * k; c.fillStyle = 'rgba(255,210,120,.3)'; circ(c, lx, ly, 3); c.fill(); c.fillStyle = '#ffe9a8'; c.fillRect(lx - 0.8, ly - 1, 1.6, 2.2); }
  }
}

/* ---------- The scene ---------- */
function drawScene(c, dt){
  const L = G.L, B = L.B, t = G.roundT;
  c.drawImage(bg, 0, 0, VW, VH);
  // clouds drifting over the backdrop
  if(B.wx !== 'night'){ c.fillStyle = B.wx === 'snow' || B.wx === 'fog' ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.8)';
    for(let i = 0; i < 4; i++){ const x = ((rng(i + 40) * VW + G.time * (2 + i)) % (VW + 80)) - 40, y = 10 + rng(i + 41) * 30; ell(c, x, y, 14, 3.6); c.fill(); ell(c, x + 6, y - 2.6, 8, 3.4); c.fill(); ell(c, x - 6, y - 1.4, 7, 2.6); c.fill(); } }
  if(B.bi === 0 || B.bi === 6){ c.strokeStyle = 'rgba(40,40,50,.6)'; c.lineWidth = 0.6; for(let i = 0; i < 3; i++){ const x = ((G.time * 12 + i * 90) % (VW + 40)) - 20, y = 22 + i * 7 + Math.sin(G.time + i) * 3, w = Math.sin(G.time * 8 + i) * 1.2; c.beginPath(); c.moveTo(x - 2.5, y - w); c.lineTo(x, y); c.lineTo(x + 2.5, y - w); c.stroke(); } }
  // river ripples
  if(L.river){ c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 0.6; for(let i = 0; i < 14; i++){ const y = FY0 + ((rng(i + 5) * (VH - FY0) + G.time * 18) % (VH - FY0)), x = L.river.x0 + 4 + rng(i + 6) * (L.river.x1 - L.river.x0 - 8); line(c, x, y, x + 3, y + 1); } }
  // hazards flat on the ground
  for(const h of L.holes) holeSprite(c, h, holeState(h, t));
  // gate warning lights on the ground side
  // everything that stands up, sorted by depth
  const items = [];
  for(const o of L.obst) items.push({ y: o.y, f: () => obstacleSprite(c, o, B) });
  for(const s of L.snakes) items.push({ y: s.y, f: () => snakeSprite(c, s) });
  for(const w of L.tumble){ if(G.tumbleGone.has(w.id)) continue; const p = tumblePos(w, t); if(p) items.push({ y: w.y, f: () => tumbleSprite(c, w, p) }); }
  for(const cr of L.cross){ const ms = crossMembers(cr, t); if(ms) for(const m of ms) items.push({ y: m.y, f: () => crossSprite(c, m, cr.kind) }); }
  for(const a of G.animals){ if(a.st === 'lost' || (a.st === 'back' && a.x < -6)) continue; items.push({ y: a.y, f: () => animalSprite(c, a) }); }
  for(const r of G.riders) items.push({ y: r.y + (r.ghost ? -0.01 : 0), f: () => riderSprite(c, r, dt) });
  // corral fence: back rail, west side posts (gate in the middle), front rail
  const wood = B.wx === 'night' ? '#5a4632' : '#8a5a34', rail = B.wx === 'night' ? '#7a6048' : '#b07a48';
  items.push({ y: PEN_Y0, f: () => { c.strokeStyle = rail; c.lineWidth = 1; line(c, PEN_X, PEN_Y0 - 8, VW, PEN_Y0 - 8); line(c, PEN_X, PEN_Y0 - 4.5, VW, PEN_Y0 - 4.5); for(let x = PEN_X; x <= VW; x += 10) postSprite(c, x, PEN_Y0, 10, wood); } });
  items.push({ y: PEN_Y1, f: () => { c.strokeStyle = rail; c.lineWidth = 1.2; line(c, PEN_X, PEN_Y1 - 9, VW, PEN_Y1 - 9); line(c, PEN_X, PEN_Y1 - 5, VW, PEN_Y1 - 5); for(let x = PEN_X; x <= VW; x += 10) postSprite(c, x, PEN_Y1, 11, wood); } });
  for(let y = PEN_Y0; y <= GATE_Y0; y += 8){ const yy = Math.min(y, GATE_Y0); items.push({ y: yy, f: () => { postSprite(c, PEN_X, yy, 10, wood); if(yy < GATE_Y0){ fenceRun(c, PEN_X, yy, Math.min(yy + 8, GATE_Y0), 10, rail); } } }); }
  for(let y = GATE_Y1; y <= PEN_Y1; y += 8){ const yy = y; items.push({ y: yy, f: () => { postSprite(c, PEN_X, yy, 10, wood); if(yy < PEN_Y1) fenceRun(c, PEN_X, yy, Math.min(yy + 8, PEN_Y1), 10, rail); } }); }
  // swung-open gate leaves
  items.push({ y: GATE_Y0 + 0.1, f: () => { c.strokeStyle = rail; c.lineWidth = 1; line(c, PEN_X, GATE_Y0 - 8.5, PEN_X - 12, GATE_Y0 - 11); line(c, PEN_X, GATE_Y0 - 4.5, PEN_X - 12, GATE_Y0 - 7); line(c, PEN_X - 12, GATE_Y0 - 12, PEN_X - 12, GATE_Y0 - 5.5); } });
  items.push({ y: GATE_Y1 + 0.1, f: () => { c.strokeStyle = rail; c.lineWidth = 1; line(c, PEN_X, GATE_Y1 - 8.5, PEN_X - 12, GATE_Y1 - 5); line(c, PEN_X, GATE_Y1 - 4.5, PEN_X - 12, GATE_Y1 - 1); line(c, PEN_X - 12, GATE_Y1 - 6, PEN_X - 12, GATE_Y1 + 0.5); } });
  // mid-field fences with timed gates
  for(const f of L.fences){
    const st = gateState(f, t);
    for(let y = FY0 + 2; y <= FY1; y += 9){
      const inGap = y > f.g0 - 4 && y < f.g1 + 4;
      if(inGap) continue;
      const yy = y, next = Math.min(y + 9, FY1);
      const gapNext = next > f.g0 - 4 && next < f.g1 + 4;
      items.push({ y: yy, f: () => { postSprite(c, f.x, yy, 9, wood); if(!gapNext && yy < FY1) fenceRun(c, f.x, yy, next, 9, rail); } });
    }
    items.push({ y: f.g0, f: () => { postSprite(c, f.x, f.g0, 11, wood, st.warn && Math.floor(G.time * 6) % 2 ? '#ff5a4e' : st.open ? '#3fd07a' : '#ff5a4e'); } });
    items.push({ y: f.g1, f: () => {
      postSprite(c, f.x, f.g1, 11, wood, st.warn && Math.floor(G.time * 6) % 2 ? '#ff5a4e' : st.open ? '#3fd07a' : '#ff5a4e');
      if(st.open){ // gate leaf swung back along the fence
        c.strokeStyle = rail; c.lineWidth = 1; const sw = Math.min(1, st.u / 0.5);
        const ex = f.x + 10 * sw, ey = f.g1 - (f.g1 - f.g0) * (1 - sw);
        line(c, f.x, f.g1 - 8, ex, ey - 8); line(c, f.x, f.g1 - 4, ex, ey - 4);
      } else {
        c.strokeStyle = '#d9894f'; c.lineWidth = 1.1; line(c, f.x, f.g0 - 8, f.x, f.g1 - 8); line(c, f.x, f.g0 - 4, f.x, f.g1 - 4);
        c.strokeStyle = '#e2463c'; c.lineWidth = 0.8; line(c, f.x, f.g0 - 9, f.x, f.g1 - 3);
      }
      if(st.warn && !G.demo) outlined(c, '!', f.x, (f.g0 + f.g1) / 2 - 16, 6, Math.floor(G.time * 6) % 2 ? '#ff5a4e' : '#ffd45e');
    } });
  }
  items.sort((p, q) => p.y - q.y);
  for(const it of items) it.f();
  // corral sign with the count
  const sy = PEN_Y0 - 22;
  c.fillStyle = wood; c.fillRect(PEN_X + 2, sy + 6, 1.4, 12); c.fillRect(PEN_X + 32, sy + 6, 1.4, 12);
  c.fillStyle = B.wx === 'night' ? '#6b4f38' : '#c98f55'; rr(c, PEN_X - 1, sy - 3, 38, 12, 2); c.fill(); c.strokeStyle = 'rgba(60,30,10,.6)'; c.lineWidth = 0.6; rr(c, PEN_X - 1, sy - 3, 38, 12, 2); c.stroke();
  text(c, 'CORRAL', PEN_X + 18, sy - 1.6, 4, '#3a220e', 'center');
  text(c, G.corr + '/' + L.total, PEN_X + 18, sy + 3.2, 5, '#fff4d8', 'center');
  // open range signpost
  c.fillStyle = wood; c.fillRect(20, FY0 - 6, 1.4, 12);
  c.fillStyle = '#e8d8b0'; c.beginPath(); c.moveTo(8, FY0 - 9); c.lineTo(34, FY0 - 9); c.lineTo(34, FY0 - 2); c.lineTo(8, FY0 - 2); c.lineTo(5, FY0 - 5.5); c.fill();
  text(c, 'OPEN RANGE', 20, FY0 - 8.2, 3.3, '#7a3a20', 'center');
  // particles
  for(const p of parts){ c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.col; circ(c, p.x, p.y, p.r); c.fill(); }
  c.globalAlpha = 1;
  drawWeather(c, L);
  // popups
  for(const f of G.fx){
    const u = f.t / (f.big ? 1.6 : 1.1);
    c.globalAlpha = Math.min(1, (1 - u) * 3);
    outlined(c, f.text, clamp(f.x, 30, VW - 30), f.y - u * 14, f.big ? 8 : 6, f.col);
  }
  c.globalAlpha = 1;
  // rider callouts and name tags
  const many = G.riders.filter(r => r.human).length > 1 || G.net;
  for(const r of G.riders){
    const k = depth(r.y), top = r.y - (r.dog ? 12 : 33) * k;
    if(r.msgT > 0 && r.msg){ c.globalAlpha = Math.min(1, r.msgT * 3); outlined(c, r.msg, clamp(r.x, 24, VW - 24), top - 5 - (1.1 - Math.min(1.1, r.msgT)) * 6, 6, r.msgCol || '#fff4d8'); c.globalAlpha = 1; }
    else if(!G.demo && (many || r.ghost || r.dog)){ const nm = (r.ghost ? '👻 ' : '') + r.name.toUpperCase(); c.globalAlpha = r.ghost ? 0.5 : 0.9; outlined(c, nm, r.x, top - 2, 4, r.color); c.globalAlpha = 1; }
  }
}

/* ---------- HUD ---------- */
function herdIcons(c, cx, y){
  const L = G.L, n = L.total, w = Math.min(7, 250 / n), x0 = cx - (n * w) / 2;
  const kinds = [];
  for(const wv of L.waves) for(let j = 0; j < wv.list.length; j++) kinds.push(wv.k);
  const byId = new Map(G.animals.map(a => [a.id, a]));
  let i = 0;
  for(const wv of L.waves) for(const m of wv.list){
    const a = byId.get(m.id), x = x0 + i * w + w / 2; i++;
    const st = a ? a.st : 'wait';
    c.fillStyle = st === 'in' ? '#ffd45e' : st === 'lost' ? '#ff5a4e' : st === 'wait' ? 'rgba(255,255,255,.18)' : st === 'edge' ? (Math.floor(G.time * 8) % 2 ? '#ff5a4e' : '#fff4d8') : '#f4efe2';
    if(st === 'lost'){ c.strokeStyle = '#ff5a4e'; c.lineWidth = 1; line(c, x - 1.8, y - 1.8, x + 1.8, y + 1.8); line(c, x + 1.8, y - 1.8, x - 1.8, y + 1.8); continue; }
    if(wv.k === 'sheep'){ circ(c, x, y, 1.8); c.fill(); }
    else if(wv.k === 'horse'){ ell(c, x, y + 0.4, 2.2, 1.3); c.fill(); c.fillRect(x + 1, y - 2.2, 1.1, 2.4); }
    else if(wv.k === 'bison'){ ell(c, x, y + 0.4, 2.4, 1.6); c.fill(); circ(c, x + 0.8, y - 0.8, 1.5); c.fill(); }
    else if(wv.k === 'boar'){ ell(c, x, y + 0.3, 2.2, 1.4); c.fill(); c.fillRect(x + 1.6, y, 1.2, 0.9); }
    else { ell(c, x, y + 0.3, 2.3, 1.4); c.fill(); c.fillRect(x + 1.6, y - 1.2, 1.2, 1.3); }
  }
}
function drawHUD(c){
  const L = G.L, d = D(), B = L.B;
  if(G.demo) return;
  // top bar
  c.fillStyle = 'rgba(20,12,8,.55)'; c.fillRect(0, 0, VW, 13);
  text(c, B.name.toUpperCase(), 4, 3.2, 5, '#f5deb3');
  text(c, d.label.toUpperCase() + (G.mode === 'tt' ? ' · TIME TRIAL' : G.mode === 'champ' && G.champ ? ' · ROUND ' + (G.champ.round + (G.state === 'podium' || G.state === 'results' ? 0 : 1)) + '/' + G.champ.biomes.length : ''), 4, 8.6, 3.2, '#bfa98a');
  // clock
  let clock, warn = false;
  if(L.clock && G.mode !== 'tt'){ const left = Math.max(0, timeLeft()); clock = fmtClock(left); warn = left < 15 && G.state === 'play'; }
  else clock = fmt(G.roundT + (G.mode === 'tt' ? G.lost * 5 : 0));
  outlined(c, clock, VW / 2, 7, 9, warn && Math.floor(G.time * 4) % 2 ? '#ff5a4e' : '#fff4d8');
  // score and streak
  text(c, G.score.toLocaleString(), VW - 4, 2.4, 6, '#ffd45e', 'right');
  if(G.mult > 1 || G.streak){ text(c, (G.mult > 1 ? 'x' + G.mult + ' · ' : '') + 'STREAK ' + G.streak, VW - 4, 8.8, 3.2, G.mult > 1 ? '#ffe27a' : '#bfa98a', 'right'); }
  // herd icons (on a little pill so they read over clouds)
  { const w = Math.min(7, 250 / L.total) * L.total + 8; c.fillStyle = 'rgba(20,12,8,.35)'; rr(c, VW / 2 - w / 2, 14.5, w, 8, 4); c.fill(); }
  herdIcons(c, VW / 2, 18.5);
  if(d.lostMax && G.mode !== 'tt'){ text(c, 'LOST ' + G.lost + '/' + d.lostMax, VW / 2 + Math.min(7, 250 / L.total) * L.total / 2 + 6, 16.4, 3.6, G.lost ? '#ff8a6a' : '#bfa98a'); }
  // next wave coming: an arrow where they'll appear
  const nw = L.waves[G.waveIx];
  if(nw && G.state === 'play' && nw.t - G.roundT < 2 && nw.t - G.roundT > 0 && Math.floor(G.time * 5) % 2){
    const m = nw.list[0], x = nw.from === 'right' ? VW - 14 : m.x, y = nw.from === 'right' ? m.y - 8 : FY0 + 4;
    outlined(c, (nw.from === 'right' ? '◀ ' : '▼ ') + nw.list.length + ' ' + (nw.list.length > 1 ? SPECIES[nw.k].label.toUpperCase() : SPECIES[nw.k].one.toUpperCase()), clamp(x - 16, 40, VW - 40), y, 5, '#ffd45e');
  }
  // countdown
  if(G.state === 'count'){
    const n = Math.ceil(3 - G.stateT);
    outlined(c, n > 0 ? String(n) : 'GO!', VW / 2, 110, 26, '#ffd45e');
  }
  // banner
  const bn = G.banner;
  if(bn){
    const age = G.time - bn.at, left = bn.t - age;
    if(left > 0){
      const a = Math.min(1, left * 3, age * 6);
      c.globalAlpha = a;
      const y = G.state === 'count' ? 70 : 58;
      c.fillStyle = 'rgba(20,12,8,.45)'; c.fillRect(0, y - 11, VW, bn.sub ? 25 : 18);
      outlined(c, bn.text, VW / 2, y - 1, 12, bn.col, 'center', SANS);
      if(bn.sub) outlined(c, bn.sub, VW / 2, y + 9, 5, '#fff4d8');
      c.globalAlpha = 1;
    } else G.banner = null;
  }
  if(G.state === 'paused'){ c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, VW, VH); }
}

let clopMem = new Map();
function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  if(!G.L){ c.fillStyle = '#1a120c'; c.fillRect(0, 0, canvas.width, canvas.height); return; }
  drawBackground(G.L);
  c.setTransform(s, 0, 0, s, 0, 0);
  fxStep(Math.min(dt, 0.05));
  drawScene(c, dt);
  drawHUD(c);
  if(G.demo){ c.fillStyle = 'rgba(20,12,8,0.28)'; c.fillRect(0, 0, VW, VH); }
  // hoofbeats for this screen's riders
  if(!G.demo && (G.state === 'play' || G.state === 'count')){
    const mine = myRiders().slice(0, 2);
    for(const r of mine){ const g = Math.floor(r.gait * 1.4 / Math.PI), prev = clopMem.get(r.id); if(prev !== undefined && g !== prev && hyp(r.vx, r.vy) > 25){ const f = SX.clop; try{ f(A.Sound); }catch(e){} } clopMem.set(r.id, g); }
  }
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('HYAH');
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
window.__stampede = G;
window.__stampedeDebug = { Net, BIOMES, SPECIES, DIFF, buildRound, setupRound, newRound, startChampionship, finishRound, resultsMenu, endRound, sim, step, render, display,
  makeRider, stepRider, stepAnimal, holler, spook, corral, rescue, titleMenu, medalFor, KIDS_PAR, TT_PAR, gateState, crossMembers, tumblePos, timeLeft, openLobby };
})();
