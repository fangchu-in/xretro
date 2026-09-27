/* BLACKTOP BRAWL — chase-cam biker brawling and racing for 1–4 riders, on one shared screen or online.
   A third-person camera rides behind the pack (MotoGP-style): bikes lean into bends, the view widens and
   shakes at speed, and pulls in tight when the pack bunches up in traffic.
   The throttle is automatic. LEFT/RIGHT steer anywhere across the road, DOWN brakes, UP fires NITRO
   (or tucks in when the tank is empty). FIRE throws a side punch at whoever is alongside, DOWN+FIRE kicks,
   hold FIRE to block. Hits fill a rider's BALANCE meter: full = stagger, another hit = a cartoon tumble.
   Civilian traffic, police bikes and road hazards on 7 tracks. Nobody gets hurt: it is all stars, boings
   and dust clouds. All art, music and sound are original and made in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;
const GAME = 'brawl';

/* ---------- Constants (world units) ---------- */
const VW = 384, VH = 216;
const FONT = '"Silkscreen","Courier New",monospace';
const SANS = '"Chakra Petch","Trebuchet MS",sans-serif';
const SEG = 200;              // segment length
const ROADW = 2400;           // half the road width (4 lanes)
const LANE_X = [-0.75, -0.25, 0.25, 0.75];
const DRAW = 136, NEAR = 40;
const MAXV = 8600;            // cruising top speed (~240 km/h on the dash)
const KMH = 240 / MAXV;
const ACC = 3900, BRAKE = 9000;
const BIKE_W = 0.09, BIKE_L = 420;      // bike width (road half-widths) and length
const PUSH = 3.2, STEER = 1.9;           // bend push at full speed on the hardest bend; steering speed
const START_Z = 30 * SEG;                // start line
const TDT = 0.2, TEND = 280;             // traffic simulation step and length (seconds)

const DIFF = {
  kids:   { label: 'Kids',   cpu: 0.86, aggro: 0.25, kick: 0, falls: false, dmg: 0.55, traffic: 0.6, police: 0.9, gentle: true,  limit: 0,  hole: 0.93, barrier: 0.4, cross: 2.6, nitro: 1.6 },
  normal: { label: 'Normal', cpu: 0.97, aggro: 1,    kick: 1, falls: true,  dmg: 1,    traffic: 1,   police: 1.06, gentle: false, limit: 40, hole: 0.85, barrier: 0.2, cross: 4.2, nitro: 1 },
  pro:    { label: 'Pro',    cpu: 1.0,  aggro: 1.5,  kick: 1.3, falls: true, dmg: 1.2, traffic: 1.3, police: 1.12, gentle: false, limit: 30, hole: 0.8,  barrier: 0.1, cross: 4.6, nitro: 0.85 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];
const MODES = [{ id: 'quick', label: 'Quick race' }, { id: 'champ', label: 'Championship' }, { id: 'tt', label: 'Time trial' }];
const GRIDS = [{ label: 'Full grid + police', n: 8, cops: true }, { label: 'Full grid, no police', n: 8, cops: false }, { label: 'Small grid + police', n: 5, cops: true }, { label: 'Just us + police', n: 0, cops: true }, { label: 'Just us', n: 0, cops: false }];
const POINTS = [25, 18, 15, 12, 10, 8, 6, 4];
const PLACE_SCORE = [5000, 3500, 2500, 1800, 1200, 800, 500, 300];
/* Rival riders: each has a personality, so races play out differently.
   aggro = how often they swing, kick = how much they like kicking, block = how often they guard,
   care = how carefully they avoid traffic, nitro = how eagerly they burn nitro, counter = hit back when hit. */
const RIVALS = [
  { name: 'Brutus',  color: '#e2463c', type: 'Brawler',  skill: 0.985, aggro: 1.8, kick: 0.5, block: 0.35, care: 1.0, nitro: 0.5, counter: 0.9 },
  { name: 'Zippy',   color: '#e9ecf1', type: 'Speedster', skill: 1.0,  aggro: 0.25, kick: 0.1, block: 0.6, care: 1.3, nitro: 0.9, counter: 0.3 },
  { name: 'Crash',   color: '#ff9f43', type: 'Reckless', skill: 0.99, aggro: 0.9, kick: 0.3, block: 0.1, care: 0.35, nitro: 1.0, counter: 0.5 },
  { name: 'Rosie',   color: '#9b7bff', type: 'All-rounder', skill: 0.975, aggro: 0.8, kick: 0.3, block: 0.5, care: 1.0, nitro: 0.6, counter: 0.6 },
  { name: 'Tank',    color: '#6b7a8f', type: 'Blocker',  skill: 0.965, aggro: 0.7, kick: 0.2, block: 0.9, care: 1.1, nitro: 0.3, counter: 0.8 },
  { name: 'Moxie',   color: '#3fd07a', type: 'Kicker',   skill: 0.97, aggro: 1.1, kick: 0.9, block: 0.3, care: 0.9, nitro: 0.5, counter: 0.6 },
  { name: 'Nitro Nell', color: '#c77dff', type: 'Nitro fiend', skill: 0.96, aggro: 0.5, kick: 0.2, block: 0.3, care: 0.8, nitro: 1.4, counter: 0.4 }
];
/* Bikes: cosmetic styles, unlocked by winning */
const BIKES = [
  { id: 'street',  label: 'Street',  how: '' },
  { id: 'scooter', label: 'Scooter', how: 'finish a Kids race' },
  { id: 'cruiser', label: 'Cruiser', how: 'win a race' },
  { id: 'cafe',    label: 'Café racer', how: 'podium on 3 tracks' },
  { id: 'neon',    label: 'Neon',    how: 'win a championship' },
  { id: 'gold',    label: 'Golden',  how: 'gold medals on all 7 tracks' }
];

/* ---------- Sounds: cartoon bops, boings and whooshes ---------- */
const SX = {
  punch:   s => { s.tone({ wave: 'triangle', f: 520, f2: 160, t: 0.12, v: 0.22 }); s.noise({ t: 0.05, v: 0.12, f: 2600, f2: 700 }); },
  kick:    s => { s.tone({ wave: 'triangle', f: 380, f2: 90, t: 0.18, v: 0.26 }); s.noise({ t: 0.09, v: 0.16, f: 1600, f2: 300 }); s.tone({ f: 1500, f2: 900, t: 0.04, v: 0.05 }); },
  block:   s => { s.tone({ wave: 'square', f: 900, f2: 700, t: 0.06, v: 0.06 }); s.tone({ wave: 'triangle', f: 300, f2: 250, t: 0.08, v: 0.12 }); },
  whoosh:  s => s.noise({ t: 0.12, v: 0.07, f: 3600, f2: 900, type: 'bandpass' }),
  stagger: s => { for(let i = 0; i < 3; i++) s.tone({ wave: 'sine', f: 1600 + i * 300, f2: 1200 + i * 300, t: 0.08, v: 0.05, at: i * 0.09 }); },
  fall:    s => { s.tone({ wave: 'sine', f: 1500, f2: 250, t: 0.6, v: 0.12 }); s.noise({ t: 0.45, v: 0.12, f: 1200, f2: 200, at: 0.12 }); },
  backOn:  s => s.melody([[523, .06], [784, .06], [1047, .1]], { wave: 'triangle', v: 0.1 }),
  honk:    s => { s.tone({ wave: 'square', f: 392, t: 0.16, v: 0.05 }); s.tone({ wave: 'square', f: 494, t: 0.16, v: 0.04 }); },
  boing:   s => s.tone({ wave: 'triangle', f: 170, f2: 640, t: 0.3, v: 0.16, vib: true }),
  crash:   s => { s.noise({ t: 0.2, v: 0.18, f: 1400, f2: 200 }); s.tone({ wave: 'triangle', f: 260, f2: 80, t: 0.2, v: 0.16 }); },
  scrape:  s => s.noise({ t: 0.18, v: 0.08, f: 3200, f2: 1800, type: 'bandpass', q: 3 }),
  near:    s => { s.noise({ t: 0.18, v: 0.07, f: 2400, f2: 5200, type: 'bandpass' }); s.tone({ f: 1320, t: 0.06, v: 0.05, at: 0.1 }); },
  pass:    s => s.melody([[880, .05], [1320, .08]], { v: 0.06 }),
  rival:   s => s.melody([[784, .05], [1047, .05], [1568, .1]], { v: 0.08 }),
  combo:   s => s.melody([[1047, .04], [1319, .04], [1568, .04], [2093, .08]], { wave: 'triangle', v: 0.07 }),
  nitro:   s => { s.tone({ wave: 'sawtooth', f: 180, f2: 900, t: 0.45, v: 0.07 }); s.noise({ t: 0.5, v: 0.1, f: 5000, f2: 1200, type: 'highpass' }); },
  nitroFull: s => s.melody([[659, .05], [988, .05], [1319, .1]], { wave: 'triangle', v: 0.08 }),
  whee:    s => s.tone({ wave: 'sine', f: 380, f2: 1700, t: 0.5, v: 0.12 }),
  land:    s => s.noise({ t: 0.14, v: 0.12, f: 900, f2: 200 }),
  pothole: s => { s.noise({ t: 0.14, v: 0.18, f: 600, f2: 120 }); s.tone({ wave: 'sine', f: 130, f2: 60, t: 0.12, v: 0.2 }); },
  slide:   s => s.noise({ t: 0.35, v: 0.1, f: 2600, f2: 700, type: 'bandpass' }),
  poof:    s => { s.noise({ t: 0.25, v: 0.14, f: 900, f2: 300 }); s.tone({ wave: 'sine', f: 300, f2: 180, t: 0.15, v: 0.1 }); },
  cone:    s => s.tone({ wave: 'triangle', f: 720, f2: 340, t: 0.08, v: 0.12 }),
  clunk:   s => { s.tone({ wave: 'square', f: 180, f2: 120, t: 0.08, v: 0.08 }); s.noise({ t: 0.08, v: 0.1, f: 1200, f2: 400 }); },
  siren:   s => { for(let i = 0; i < 4; i++) s.tone({ wave: 'triangle', f: i % 2 ? 660 : 880, t: 0.22, v: 0.05, at: i * 0.24 }); },
  bell:    s => { for(let i = 0; i < 4; i++) s.tone({ wave: 'sine', f: 1760, t: 0.12, v: 0.05, at: i * 0.2 }); },
  horn:    s => { s.tone({ wave: 'sawtooth', f: 220, t: 0.6, v: 0.05 }); s.tone({ wave: 'sawtooth', f: 277, t: 0.6, v: 0.04 }); },
  animal:  s => { s.tone({ wave: 'sawtooth', f: 300, f2: 520, t: 0.25, v: 0.05, vib: true }); },
  monkey:  s => { s.tone({ f: 900, f2: 1400, t: 0.07, v: 0.06 }); s.tone({ f: 1100, f2: 1600, t: 0.07, v: 0.06, at: 0.1 }); },
  rumble:  s => s.noise({ t: 0.6, v: 0.12, f: 400, f2: 90 }),
  flag:    s => s.melody([[523, .1], [659, .1], [784, .1], [1047, .12], [784, .08], [1047, .3]], { v: 0.12 }),
  results: s => s.melody([[784, .1], [988, .1], [1175, .1], [1568, .16], [0, .05], [1319, .1], [1568, .36]], { wave: 'triangle', v: 0.12 }),
  challenge: s => s.melody([[1047, .06], [1319, .06], [1568, .06], [2093, .14]], { v: 0.1 }),
  unlock:  s => s.melody([[523, .08], [659, .08], [784, .08], [1047, .08], [1319, .08], [1568, .24]], { wave: 'triangle', v: 0.11 }),
  final:   s => s.melody([[659, .08], [784, .08], [1047, .2]], { v: 0.1 }),
  steer:   s => s.tone({ f: 320, f2: 380, t: 0.05, v: 0.03, wave: 'triangle' })
};
let netSfx = [];
function sfx(name){ if(G.demo) return; const f = SX[name]; if(f) try{ f(A.Sound); }catch(e){} if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push('~' + name); }
function S(name){ if(G.demo) return; A.Sound.play(name); if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name); }
function playNetSfx(n){ if(n[0] === '~'){ const f = SX[n.slice(1)]; if(f) try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* ---------- Music (all original) ---------- */
const ROAD_THEME = {
  bpm: 150, chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'], bass: 'drive', arp: 'fast', leadVol: 0.072,
  lead: [
    'G5 - B5 - D6 - - - B5 - G5 - A5 - B5 -', 'E5 - - - G5 - B5 - G5 - E5 - F#5 - G5 -',
    'C6 - - - B5 - A5 - G5 - E5 - G5 - A5 -', 'A5 - - - - - F#5 - D5 - F#5 - A5 - C6 -',
    'B5 - D6 - B5 - G5 - B5 - - - A5 - G5 -', 'E5 - G5 - E5 - B4 - E5 - G5 - B5 - - -',
    'C6 - B5 - C6 - E6 - D6 - C6 - B5 - A5 -', 'D6 - - - C6 - B5 - A5 - - - F#5 - - -'],
  drums: ['k.h.s.hkk.h.s.h.', 'k.h.s.hkk.hks.hs', 'k.h.s.hkk.h.s.h.', 'k.hkskhkk.hks.ss']
};
const SURF_THEME = {
  bpm: 166, chords: ['E', 'E', 'A', 'A', 'B', 'A', 'E', 'B'], bass: 'drive', arp: 'fast', leadWave: 'pulse25', leadVol: 0.07,
  lead: [
    'E5 - E5 G#5 B5 - G#5 - E5 - F#5 - G#5 - - -', 'E5 - B4 - E5 - G#5 - B5 - - - A5 - G#5 -',
    'A5 - A5 C#6 E6 - C#6 - A5 - B5 - C#6 - - -', 'C#6 - B5 - A5 - F#5 - A5 - B5 - C#6 - E6 -',
    'D#6 - - - B5 - F#5 - B5 - D#6 - F#6 - - -', 'E6 - C#6 - A5 - E5 - A5 - C#6 - E6 - - -',
    'G#5 - E5 - B4 - E5 - G#5 - B5 - E6 - B5 -', 'B5 - A5 - G#5 - F#5 - D#5 - F#5 - B5 - - -'],
  drums: ['k.h.s.hkk.h.s.hs', 'k.hhs.hkk.hhs.hs', 'k.h.s.hkk.h.s.hs', 'k.hks.hkk.hkssss']
};
const DUST_THEME = {
  bpm: 132, chords: ['Am', 'Am', 'G', 'G', 'F', 'E', 'Am', 'E'], bass: 'gallop', arp: 'slow', leadWave: 'sawtooth', leadVol: 0.052,
  lead: [
    'A4 - - - E5 - - - A5 - G5 - E5 - - -', 'A5 - - - C6 - B5 - A5 - - - E5 - - -',
    'G5 - - - D5 - - - G5 - F5 - D5 - - -', 'B4 - D5 - G5 - - - B5 - A5 - G5 - - -',
    'F5 - - - A5 - C6 - - - A5 - F5 - C5 -', 'E5 - - - G#5 - B5 - - - E6 - D6 - B5 -',
    'C6 - B5 - A5 - - - E5 - A5 - C6 - E6 -', 'E6 - - - D6 - C6 - B5 - - - G#5 - - -'],
  drums: ['k.hkk.hks.hkk.hk', 'k.hkk.hks.hkk.hs', 'k.hkk.hks.hkk.hk', 'k.hkk.hks.skssss']
};
const JUNGLE_THEME = {
  bpm: 126, chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'G'], bass: 'calypso', arp: 'slow', steel: true, leadVol: 0.07,
  lead: [
    'E5 - G5 - C6 - G5 - E5 - D5 - C5 - - -', 'F5 - A5 - C6 - A5 - F5 - - - E5 - D5 -',
    'D5 - G5 - B5 - D6 - B5 - G5 - F5 - D5 -', 'E5 - - - G5 - C6 - E6 - - - D6 - C6 -',
    'A5 - C6 - E6 - C6 - A5 - G5 - E5 - - -', 'F5 - - - A5 - C6 - F6 - E6 - D6 - C6 -',
    'B5 - D6 - G6 - D6 - B5 - A5 - G5 - F5 -', 'G5 - - - B5 - - - D6 - - - G5 - - -'],
  drums: ['k.bck.lcs.bck.lc', 'k.bck.lcs.bcblcc', 'k.bck.lcs.bck.lc', 'k.bbk.llsbbc.lss']
};
const FROST_THEME = {
  bpm: 122, chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], bass: 'pulse', arp: 'fast', arpOct: 1, leadWave: 'square', leadVol: 0.042,
  lead: [
    'D5 - - - F5 - A5 - - - D6 - C6 - A5 -', 'Bb5 - - - - - F5 - D5 - F5 - Bb5 - - -',
    'A5 - - - C6 - F6 - - - E6 - C6 - A5 -', 'G5 - - - E5 - C5 - E5 - G5 - C6 - - -',
    'D6 - - - C6 - A5 - F5 - A5 - D6 - F6 -', 'F6 - - - D6 - Bb5 - F5 - - - D6 - - -',
    'D6 - C6 - Bb5 - G5 - Bb5 - D6 - G6 - - -', 'E6 - - - C#6 - - - A5 - - - E5 - - -'],
  drums: ['k...h.k.s..kh...', 'k...h.k.s..kh.h.', 'k...h.k.s..kh...', 'k.k.h.k.s.s.hsss']
};
const PODIUM_THEME = {
  bpm: 116, chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'D'], bass: 'walk', arp: 'slow', brass: true, leadVol: 0.07,
  lead: [
    'G5 - B5 - D6 - - - G6 - - - D6 - - -', 'F#5 - A5 - D6 - - - F#6 - - - E6 - D6 -',
    'E6 - - - G6 - - - B5 - - - E6 - - -', 'C6 - - - E6 - - - G5 - C6 - E6 - - -',
    'D6 - - - B5 - - - G5 - - - B5 - D6 -', 'A5 - - - F#5 - - - D6 - - - A5 - - -',
    'C6 - - - E6 - - - G6 - E6 - C6 - - -', 'D6 - - - - - - - F#5 - A5 - D6 - - -'],
  drums: ['k...s...k.k.s...', 'k...s...k...s.s.', 'k...s...k.k.s...', 'k.k.s...k.k.ssss']
};

/* ---------- Tracks ----------
   Every layout is generated from its own seed and style, so every screen builds exactly the same road.
   style: len (segments to the finish), curvy (chance a section bends), bend (sharpest bend), hills,
   plus special pieces at fixed spots. Hazards come from `haz` (weights) and `cross` (things that cross the road). */
const TRACKS = [
  { id: 'meadow', name: 'Meadow Run', biome: 'meadow', time: 'day', music: ROAD_THEME, seed: 1301,
    sky: ['#58a8f0', '#cfe9ff'], ground: ['#5cad45', '#53a03e'], shoulder: '#7a8f3a', road: ['#56585f', '#5c5e66'], line: '#f4f1ea', rumble: ['#e8e2d0', '#b9443a'],
    fact: 'Rolling farm roads: slow tractors, hay bales, sheep crossings and a railway level crossing.',
    style: { len: 2500, curvy: 0.55, bend: 3.4, hills: 16 }, special: [[0.34, 'bridge'], [0.78, 'bridge']],
    traffic: { car: 5, van: 2, truck: 1, bus: 1, tractor: 4 }, spacing: 5600,
    haz: { hole: 3, bale: 3, cones: 2, rough: 1, debris: 1, ramp: 1 }, cross: [['train', 0.22], ['sheep', 0.5], ['train', 0.66], ['sheep', 0.88]],
    challenges: [['overtakes', 30], ['nofall', 1], ['copbop', 1]] },
  { id: 'surf', name: 'Surf Coast', biome: 'beach', time: 'dusk', music: SURF_THEME, seed: 2207,
    sky: ['#ff7a59', '#ffd49a'], ground: ['#e9cf8e', '#e2c683'], shoulder: '#f0dca0', road: ['#4d4a55', '#53505b'], line: '#fff4d8', rumble: ['#f4efe2', '#3f8fe0'],
    fact: 'A seaside town at sunset: sand blows onto the road, the tide leaves driftwood and the dunes make great jumps.',
    style: { len: 2600, curvy: 0.6, bend: 3.2, hills: 8 }, special: [[0.55, 'bridge']],
    traffic: { car: 6, van: 2, icecream: 2, bus: 1, camper: 1 }, spacing: 5200,
    haz: { sand: 4, debris: 3, ramp: 3, hole: 1, cones: 1, oil: 1 }, cross: [],
    challenges: [['air', 4], ['nearmiss', 8], ['win', 1]] },
  { id: 'summit', name: 'Summit Pass', biome: 'mountain', time: 'day', music: DUST_THEME, seed: 3313, fog: '#c9d3dc', rainy: true,
    sky: ['#8fb0cc', '#dfe7ee'], ground: ['#5f8a4f', '#577f48'], shoulder: '#8a8f86', road: ['#55575e', '#5a5c63'], line: '#f4f1ea', rumble: ['#f4f1ea', '#d9434f'],
    fact: 'Hairpin switchbacks, rockfall zones, a tunnel through the mountain and a narrow bridge over the gorge. It can rain up here!',
    style: { len: 2600, curvy: 0.7, bend: 4.2, hills: 30 }, special: [[0.2, 'switch'], [0.4, 'tunnel'], [0.58, 'bridge'], [0.72, 'switch']],
    traffic: { car: 5, van: 1, truck: 2, camper: 2, bus: 1 }, spacing: 6200,
    haz: { hole: 2, rough: 2, debris: 2, cones: 2, oil: 1 }, cross: [['rock', 0.3], ['rock', 0.5], ['rock', 0.86]],
    challenges: [['nofall', 1], ['takedowns', 2], ['streak', 8]] },
  { id: 'mirage', name: 'Mirage Highway', biome: 'desert', time: 'day', music: DUST_THEME, seed: 4421, haze: true,
    sky: ['#4fa4e8', '#f7e3b0'], ground: ['#e0b36c', '#d9aa62'], shoulder: '#d6a55e', road: ['#5a5054', '#605659'], line: '#fff0c8', rumble: ['#f4efe2', '#e2463c'],
    fact: 'The fastest track: long straight desert highway, heat haze, rolling tumbleweeds and swirling dust devils.',
    style: { len: 2800, curvy: 0.35, bend: 2.6, hills: 12 }, special: [[0.3, 'straight'], [0.7, 'straight']],
    traffic: { car: 5, truck: 3, van: 1, bus: 1, camper: 1 }, spacing: 5400,
    haz: { ramp: 3, sand: 2, hole: 2, debris: 1, cones: 1 }, cross: [['tumble', 0.14], ['devil', 0.26], ['tumble', 0.4], ['devil', 0.52], ['tumble', 0.62], ['devil', 0.8], ['tumble', 0.9]],
    challenges: [['topspeed', 270], ['overtakes', 35], ['air', 3]] },
  { id: 'jungle', name: 'Canopy Trail', biome: 'jungle', time: 'day', music: JUNGLE_THEME, seed: 5519,
    sky: ['#5fc6a8', '#d8f4d0'], ground: ['#2f7d3a', '#2a7134'], shoulder: '#6b4a2e', road: ['#4f4a44', '#554f49'], line: '#f4efd8', rumble: ['#f4efd8', '#e9a23b'],
    fact: 'Deep jungle: fallen logs, cheeky monkeys darting across, rickety bridges and green light through the canopy.',
    style: { len: 2500, curvy: 0.65, bend: 3.6, hills: 14 }, special: [[0.25, 'canopy'], [0.45, 'bridge'], [0.65, 'canopy'], [0.84, 'bridge']],
    traffic: { car: 4, jeep: 3, van: 2, truck: 1 }, spacing: 6000,
    haz: { log: 3, hole: 2, debris: 2, oil: 1, ramp: 1 }, cross: [['monkey', 0.18], ['monkey', 0.36], ['monkey', 0.55], ['monkey', 0.74], ['monkey', 0.92]],
    challenges: [['nearmiss', 10], ['blocks', 5], ['podium', 1]] },
  { id: 'savanna', name: 'Savanna Reserve', biome: 'savanna', time: 'dusk', music: JUNGLE_THEME, seed: 6607,
    sky: ['#ff9a5a', '#ffe0a0'], ground: ['#c9a54e', '#c09c47'], shoulder: '#b88c4a', road: ['#5e5249', '#64584e'], line: '#fff0d0', rumble: ['#f4efe2', '#8a5a2a'],
    fact: 'Golden hour in the wildlife reserve: zebras, elephants and giraffes have right of way, so weave round them gently!',
    style: { len: 2600, curvy: 0.45, bend: 3, hills: 10 }, special: [[0.6, 'bridge']],
    traffic: { jeep: 4, car: 3, van: 1, truck: 1, bus: 1 }, spacing: 6200,
    haz: { hole: 3, rough: 3, debris: 1, ramp: 2, sand: 1 }, cross: [['zebra', 0.2], ['elephant', 0.4], ['giraffe', 0.55], ['zebra', 0.72], ['elephant', 0.9]],
    challenges: [['copbop', 1], ['streak', 10], ['overtakes', 28]] },
  { id: 'tundra', name: 'Frost Tundra', biome: 'tundra', time: 'night', music: FROST_THEME, seed: 7741, snow: true,
    sky: ['#070b24', '#1c2c55'], ground: ['#dfe9f3', '#d5e0ec'], shoulder: '#c4d2e2', road: ['#3e4452', '#434958'], line: '#ffd166', rumble: ['#f4f1ea', '#3f8fe0'],
    fact: 'A night ride under the northern lights: ice patches, snowdrifts and reindeer crossing the frozen road.',
    style: { len: 2600, curvy: 0.55, bend: 3.2, hills: 18 }, special: [[0.5, 'bridge']],
    traffic: { car: 4, truck: 2, van: 2, bus: 1, camper: 1 }, spacing: 6000,
    haz: { ice: 4, drift: 3, hole: 1, cones: 1, ramp: 1 }, cross: [['reindeer', 0.3], ['reindeer', 0.62], ['reindeer', 0.86]],
    challenges: [['nofall', 1], ['nitros', 4], ['win', 1]] }
];
const CHALLENGE_TEXT = {
  overtakes: n => 'Overtake ' + n + ' vehicles', nofall: () => 'Finish without falling', copbop: () => 'Knock a police rider off',
  air: n => 'Get big air ' + n + ' times', nearmiss: n => n + ' near misses', win: () => 'Win the race', podium: () => 'Finish on the podium',
  takedowns: n => 'Knock off ' + n + ' riders', streak: n => 'A ' + n + ' second speed streak', topspeed: n => 'Hit ' + n + ' km/h',
  blocks: n => 'Block ' + n + ' hits', nitros: n => 'Fire nitro ' + n + ' times'
};
/* Vehicles: w = width (road half-widths), len/h in world units, v = speed range */
const VEH = {
  car:      { w: 0.28, len: 900,  h: 520,  v: [4300, 5200] },
  van:      { w: 0.31, len: 1100, h: 820,  v: [3900, 4600] },
  icecream: { w: 0.31, len: 1100, h: 840,  v: [3200, 3700] },
  camper:   { w: 0.33, len: 1400, h: 900,  v: [3300, 3900] },
  jeep:     { w: 0.29, len: 950,  h: 640,  v: [3600, 4400] },
  bus:      { w: 0.37, len: 2400, h: 1050, v: [3200, 3700] },
  truck:    { w: 0.37, len: 2800, h: 1100, v: [2900, 3500] },
  tractor:  { w: 0.30, len: 800,  h: 760,  v: [1500, 1900] }
};
const CAR_COLS = ['#e2463c', '#3f8fe0', '#f5c542', '#3fd0b0', '#9b7bff', '#ff7eb6', '#e9ecf1', '#ff9f43', '#5b6275', '#7fcf5a'];
/* Things that cross the road: dur = how long it is on the road each cycle (traffic waits), n = how many */
const CROSS = {
  train:    { period: 20, dur: 4.2, n: 1, w: 0, walk: 3.4, gap: 0, soft: false },
  sheep:    { period: 28, dur: 6.5, n: 6, w: 0.06, walk: 4.0, gap: 0.45, soft: true },
  zebra:    { period: 26, dur: 5.6, n: 4, w: 0.08, walk: 3.6, gap: 0.6, soft: true },
  elephant: { period: 30, dur: 6.0, n: 2, w: 0.17, walk: 4.4, gap: 1.2, soft: true },
  giraffe:  { period: 28, dur: 6.0, n: 3, w: 0.08, walk: 4.0, gap: 0.9, soft: true },
  reindeer: { period: 26, dur: 5.6, n: 4, w: 0.07, walk: 3.6, gap: 0.6, soft: true },
  monkey:   { period: 9,  dur: 2.8, n: 2, w: 0.05, walk: 1.7, gap: 0.6, soft: true },
  rock:     { period: 12, dur: 3.6, n: 3, w: 0.08, walk: 2.3, gap: 0.55, soft: false },
  tumble:   { period: 6,  dur: 4.2, n: 2, w: 0.06, walk: 3.6, gap: 0.8, soft: true, free: true },
  devil:    { period: 16, dur: 16, n: 1, w: 0.22, walk: 16, gap: 0, soft: true, free: true }
};

function mulberry(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

/* Sections for a track: [segments, curve, hill (segment lengths), flags] */
function sections(def){
  const rnd = mulberry(def.seed), st = def.style, out = [];
  let total = 0, sp = 0;
  const specials = def.special.slice().sort((a, b) => a[0] - b[0]);
  const push = s => { out.push(s); total += s[0]; };
  push([60, 0, 0, 'start']);
  while(total < st.len){
    if(sp < specials.length && total >= specials[sp][0] * st.len){
      const k = specials[sp++][1];
      if(k === 'bridge'){ push([24, 0, 0]); push([60, 0, 0, 'bridge']); push([20, 0, 0]); }
      else if(k === 'tunnel') push([130, 1.2, 0, 'tunnel']);
      else if(k === 'canopy') push([150, (rnd() < 0.5 ? -1 : 1) * 1.6, 4, 'canopy']);
      else if(k === 'straight') push([200, 0, (rnd() - 0.5) * 6]);
      else if(k === 'switch'){ const d = rnd() < 0.5 ? -1 : 1; push([40, 0, 8]); for(let i = 0; i < 4; i++) push([34, (i % 2 ? -d : d) * 5.6, 6]); push([30, 0, 0]); }
      continue;
    }
    const n = 40 + Math.floor(rnd() * 90);
    const bend = rnd() < st.curvy ? (rnd() < 0.5 ? -1 : 1) * (0.8 + Math.pow(rnd(), 1.4) * (st.bend - 0.8)) : 0;
    const hill = (rnd() - 0.5) * 2 * st.hills * (0.3 + rnd() * 0.7);
    push([n, Math.round(bend * 10) / 10, Math.round(hill), '']);
  }
  push([240, 0, 0, 'runout']);
  return out;
}

/* Build the whole track: segments, scenery, hazards, crossings and lane closures. Deterministic. */
function buildTrack(ix, diff){
  const def = TRACKS[ix], d = DIFF[diff] || DIFF.normal, segs = [];
  const rnd = mulberry(def.seed * 31 + DIFF_ORDER.indexOf(diff) * 7 + 5);
  let y = 0;
  const add = (curve, yy, flags) => { const n = segs.length; segs.push({ i: n, curve, y1: y, y2: yy, flags, sprites: [], haz: [], paint: [], w: 1, color: Math.floor(n / 3) % 2 }); y = yy; };
  for(const [n, curve, hill, fl] of sections(def)){
    const flags = {}; (fl || '').split(' ').filter(Boolean).forEach(f => flags[f] = 1);
    const enter = Math.floor(n * 0.25), hold = n - enter * 2, y0 = y, y1 = y0 + hill * SEG, total = enter * 2 + hold;
    for(let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(y0, y1, i / total), flags);
    for(let i = 0; i < hold; i++) add(curve, easeInOut(y0, y1, (enter + i) / total), flags);
    for(let i = 0; i < enter; i++) add(easeInOut(curve, 0, i / enter), easeInOut(y0, y1, (enter + hold + i) / total), flags);
  }
  const N = segs.length;
  // the road narrows over bridges (2 lanes)
  segs.forEach(s => { if(s.flags.bridge) s.w = 0.55; });
  for(let i = 1; i < N; i++){ if(segs[i].flags.bridge && !segs[i - 1].flags.bridge) for(let k = 1; k <= 10 && i - k >= 0; k++) segs[i - k].w = Math.min(segs[i - k].w, 0.55 + 0.45 * k / 10); }
  for(let i = N - 2; i >= 0; i--){ if(segs[i].flags.bridge && !segs[i + 1].flags.bridge) for(let k = 1; k <= 10 && i + k < N; k++) segs[i + k].w = Math.min(segs[i + k].w, 0.55 + 0.45 * k / 10); }
  const finishSeg = N - 240;
  const T = { def, ix, diff, segs, N, len: N * SEG, finish: finishSeg * SEG, haz: [], cross: [], clo: [], cones: [], rid: 0 };
  // lane closures (traffic merges out of these lanes)
  const close = (z1, z2, lanes, cr) => T.clo.push({ z1, z2, lanes, cr: cr || null });
  // bridges close the outer lanes
  let bs = -1;
  for(let i = 0; i < N; i++){
    const on = segs[i].w < 0.99;
    if(on && bs < 0) bs = i;
    if(!on && bs >= 0){ close(bs * SEG, i * SEG, [1, 0, 0, 1]); bs = -1; }
  }
  // ---------- hazards ----------
  const busy = new Uint8Array(N);       // segments already used by something
  const mark = (a, b) => { for(let i = Math.max(0, a); i < Math.min(N, b); i++) busy[i] = 1; };
  const free = (a, b) => { for(let i = Math.max(0, a); i < Math.min(N, b); i++) if(busy[i]) return false; return true; };
  for(let i = 0; i < N; i++) if(segs[i].w < 0.99 || segs[i].flags.tunnel) busy[i] = 1;
  mark(0, 30 + 45); mark(finishSeg - 30, N);
  let hid = 0, cid = 0;
  const addHaz = (k, zs, len, x, w, o) => {
    const h = Object.assign({ id: hid++, k, z: zs, len, x, w }, o || {});
    T.haz.push(h);
    for(let i = Math.floor(zs / SEG); i <= Math.floor((zs + len) / SEG) && i < N; i++) segs[i].haz.push(h);
    return h;
  };
  const sign = (segI, text, col) => { const s = segs[Math.max(0, segI)]; if(s) s.sprites.push({ kind: 'warn', x: (rnd() < 0.5 ? -1 : 1) * 1.28, text, col: col || '#f5c542' }); };
  // things that cross the road, at fixed spots
  for(const [k, at] of def.cross){
    let i = Math.floor(finishSeg * at);
    for(let tries = 0; tries < 80 && (!free(i - 30, i + 20) || Math.abs(segs[i].curve) > 1.2); tries++) i += 7;
    if(i >= finishSeg - 40) continue;
    const C = CROSS[k], cr = { id: T.cross.length, k, z: i * SEG, seg: i, period: C.period, dur: k === 'train' ? d.cross : C.dur, phase: rnd() * C.period, n: C.n, w: C.w, walk: C.walk, gap: C.gap, dirSeed: Math.floor(rnd() * 2) };
    if(k === 'train') cr.walk = cr.dur - 0.8;
    T.cross.push(cr);
    segs[i].sprites.push({ kind: 'crossing', cr: cr.id });
    if(!C.free) close(i * SEG - 150, i * SEG + (C.n > 1 ? 400 : 250), [1, 1, 1, 1], cr);
    const txt = { train: 'LEVEL CROSSING', sheep: 'SHEEP CROSSING', zebra: 'ZEBRA CROSSING', elephant: 'ELEPHANTS!', giraffe: 'GIRAFFES!', reindeer: 'REINDEER', monkey: 'MONKEYS!', rock: 'FALLING ROCKS', tumble: 'TUMBLEWEEDS', devil: 'DUST DEVILS' }[k];
    sign(i - 55, txt); sign(i - 110, txt);
    mark(i - 30, i + 22);
  }
  // road hazards, spaced so there is always time to react
  const kinds = Object.keys(def.haz), wsum = kinds.reduce((a, k) => a + def.haz[k], 0);
  const gapScale = d.gentle ? 1.5 : diff === 'pro' ? 0.8 : 1;
  let i = 90;
  while(i < finishSeg - 50){
    i += Math.floor((28 + rnd() * 34) * gapScale);
    let w = rnd() * wsum, k = kinds[0];
    for(const kk of kinds){ w -= def.haz[kk]; if(w < 0){ k = kk; break; } }
    const need = k === 'cones' ? 34 : k === 'sand' || k === 'ice' || k === 'rough' ? 16 : 8;
    if(!free(i - 6, i + need + 6)) continue;
    const z = i * SEG + rnd() * SEG;
    const lane = Math.floor(rnd() * 4);
    if(k === 'hole'){ const n = 1 + Math.floor(rnd() * 3); for(let j = 0; j < n; j++) addHaz('hole', z + j * 500 + rnd() * 200, 120, clamp(LANE_X[lane] + (rnd() - 0.5) * 0.9, -0.9, 0.9), 0.065); }
    else if(k === 'oil') addHaz('oil', z, 3 * SEG, clamp(LANE_X[lane] + (rnd() - 0.5) * 0.4, -0.85, 0.85), 0.16 + rnd() * 0.06);
    else if(k === 'sand') addHaz('sand', z, (8 + rnd() * 6) * SEG, clamp((rnd() - 0.5) * 1.4, -0.7, 0.7), 0.26 + rnd() * 0.12);
    else if(k === 'ice') addHaz('ice', z, (8 + rnd() * 6) * SEG, clamp((rnd() - 0.5) * 1.4, -0.7, 0.7), 0.28 + rnd() * 0.12);
    else if(k === 'rough') addHaz('rough', z, (10 + rnd() * 6) * SEG, clamp((rnd() - 0.5) * 1.0, -0.5, 0.5), 0.34 + rnd() * 0.16);
    else if(k === 'drift') addHaz('drift', z, 2 * SEG, LANE_X[lane], 0.17);
    else if(k === 'debris'){ const n = 2 + Math.floor(rnd() * 3); for(let j = 0; j < n; j++) addHaz('debris', z + j * 260, 100, clamp(LANE_X[lane] + (rnd() - 0.5) * 0.7, -0.9, 0.9), 0.05, { v: Math.floor(rnd() * 3) }); }
    else if(k === 'ramp') addHaz('ramp', z, 300, LANE_X[lane], 0.16);
    else if(k === 'bale'){ addHaz('bale', z, 260, LANE_X[lane], 0.13); close(z - 200, z + 400, [0, 1, 2, 3].map(l => l === lane ? 1 : 0)); sign(Math.floor(z / SEG) - 50, 'HAY BALES'); }
    else if(k === 'log'){ const two = rnd() < 0.4 && lane < 3; const lx = two ? (LANE_X[lane] + LANE_X[lane + 1]) / 2 : LANE_X[lane]; addHaz('log', z, 220, lx, two ? 0.45 : 0.22); close(z - 200, z + 400, [0, 1, 2, 3].map(l => l === lane || (two && l === lane + 1) ? 1 : 0)); sign(Math.floor(z / SEG) - 50, 'FALLEN TREE'); }
    else if(k === 'cones'){
      // road works: a taper of cones closing one lane, with a barrier board at the end
      const l = rnd() < 0.5 ? 0 : 3, dir = l === 0 ? 1 : -1, zl = (26 + Math.floor(rnd() * 8)) * SEG;
      for(let j = 0; j <= 12; j++){ const u = Math.min(1, j / 4); T.cones.push(addHaz('cone', z + j * zl / 12, 60, LANE_X[l] + dir * 0.24 * (2 * u - 1), 0.035, { cid: cid++ })); }
      addHaz('barrier', z + zl + 80, 120, LANE_X[l], 0.2);
      close(z - 100, z + zl + 400, [0, 1, 2, 3].map(q => q === l ? 1 : 0));
      sign(Math.floor(z / SEG) - 50, 'ROAD WORKS', '#ff9f43');
      mark(Math.floor(z / SEG) - 4, Math.floor((z + zl) / SEG) + 8);
      continue;
    }
    mark(i - 4, i + need + 4);
  }
  T.haz.sort((a, b) => a.z - b.z);
  T.clo.sort((a, b) => a.z1 - b.z1);
  // ---------- scenery ----------
  const sp = (i, kind, x, o) => { if(i >= 0 && i < N) segs[i].sprites.push(Object.assign({ kind, x }, o || {})); };
  const boards = ['BLACKTOP', 'XRETRO', 'ZOOM COLA', 'MOTO MART'];
  let hyCount = 0;
  for(let i = 8; i < N; i += 5){
    const s = segs[i], side = (Math.floor(i / 5) % 2) ? 1 : -1, bridge = s.w < 0.99;
    if(s.flags.tunnel) continue;
    // Humble Yeti boards: several per race
    if(i % 150 === 40 && !bridge){ sp(i, 'hy', side * 1.62); hyCount++; continue; }
    if(i % 150 === 115 && !bridge){ sp(i, 'board', side * 1.62, { text: boards[Math.floor(rnd() * boards.length)] }); continue; }
    if(bridge){ if(i % 10 === 0) sp(i, 'water', side * 1.6); continue; }
    if(s.flags.canopy){ sp(i, 'jtree', side * (1.35 + rnd() * 0.3)); sp(i, 'jtree', -side * (1.35 + rnd() * 0.3)); continue; }
    const r = rnd(), far = side * (1.7 + rnd() * 2.2), near = side * (1.4 + rnd() * 0.4);
    switch(def.biome){
      case 'meadow':
        if(r < 0.3) sp(i, 'tree', far); else if(r < 0.42) sp(i, 'fence', side * 1.4); else if(r < 0.5) sp(i, 'cow', far); else if(r < 0.56) sp(i, 'hay', far); else if(r < 0.6) sp(i, 'barn', side * (2.6 + rnd())); else if(r < 0.66) sp(i, 'bush', near);
        break;
      case 'beach':
        if(r < 0.3) sp(i, 'palm', near); else if(r < 0.42) sp(i, 'shack', side * (2 + rnd()), { col: CAR_COLS[Math.floor(rnd() * CAR_COLS.length)] }); else if(r < 0.52) sp(i, 'umbrella', far, { col: CAR_COLS[Math.floor(rnd() * 6)] }); else if(r < 0.56) sp(i, 'lifeguard', far);
        break;
      case 'mountain':
        if(r < 0.45) sp(i, 'pine', far); else if(r < 0.6) sp(i, 'rock', near); else if(r < 0.7) sp(i, 'post', side * 1.3);
        if(rnd() < 0.4) sp(i, 'pine', -side * (1.8 + rnd() * 2));
        break;
      case 'desert':
        if(r < 0.25) sp(i, 'cactus', far); else if(r < 0.32) sp(i, 'mesa', side * (3 + rnd() * 2)); else if(r < 0.4) sp(i, 'rock', near); else if(r < 0.44) sp(i, 'windpump', side * (2.5 + rnd()));
        break;
      case 'jungle':
        sp(i, 'jtree', far); if(r < 0.5) sp(i, 'fern', near); else if(r < 0.6) sp(i, 'banana', near); else if(r < 0.64) sp(i, 'ruin', side * (2 + rnd()));
        if(rnd() < 0.6) sp(i, 'jtree', -side * (1.6 + rnd() * 1.5));
        break;
      case 'savanna':
        if(r < 0.22) sp(i, 'acacia', far); else if(r < 0.3) sp(i, 'mound', far); else if(r < 0.5) sp(i, 'tuft', near); else if(r < 0.53) sp(i, 'hut', side * (2.4 + rnd()));
        break;
      case 'tundra':
        if(r < 0.35) sp(i, 'snowpine', far); else if(r < 0.42) sp(i, 'snowman', near); else if(r < 0.47) sp(i, 'igloo', side * (2.2 + rnd()));
        if(i % 20 === 0) sp(i, 'lamp', side * 1.3);
        break;
    }
  }
  // start gantry, finish gantry, grandstand crowds
  sp(30, 'gantry', 0, { text: 'START' }); sp(finishSeg, 'gantry', 0, { text: 'FINISH', fin: 1 });
  for(let i = finishSeg - 30; i < finishSeg + 10; i += 8) sp(i, 'stand', -1.75);
  for(let i = 22; i < 36; i += 7) sp(i, 'stand', 1.75);
  T.finishSeg = finishSeg;
  T.hyCount = hyCount;
  // ---------- traffic ----------
  buildTraffic(T, rnd, d, diff);
  return T;
}

/* Is lane l blocked between z and z + look at time t? Returns the distance to the closure, or -1. */
function closedAhead(T, l, z, look, t){
  for(const c of T.clo){
    if(c.z1 > z + look) break;
    if(c.z2 < z || !c.lanes[l]) continue;
    if(c.cr && !crossActive(c.cr, t, 1.4)) continue;
    return Math.max(0, c.z1 - z);
  }
  return -1;
}
/* Crossings run on the race clock, so every screen agrees where the animals and trains are. */
function crossCycle(cr, t){ const p = t - cr.phase; return { k: Math.floor(p / cr.period), u: ((p % cr.period) + cr.period) % cr.period }; }
function crossActive(cr, t, early){ const { u } = crossCycle(cr, t); return u < cr.dur || u > cr.period - (early || 0); }
/* x of member j of a crossing (null = not on the road right now) */
function crossX(cr, t, j){
  const C = CROSS[cr.k], { k, u } = crossCycle(cr, t);
  const dir = (k + cr.dirSeed) % 2 ? -1 : 1;
  if(cr.k === 'devil') return Math.sin(t * 0.33 + cr.phase) * 1.05 + Math.sin(t * 0.8 + cr.phase * 2) * 0.2;
  const s = (u - j * cr.gap) / cr.walk;
  if(s < 0 || s > 1) return null;
  return dir * (-1.55 + 3.1 * s);
}

/* ---------- Deterministic traffic ----------
   Every vehicle is simulated once, when the track is built, for the whole race: it keeps its lane, slows
   behind slower traffic, changes lane to pass or to merge round road works and bridges, and waits at level
   crossings and for animals. Positions are stored every 0.2 s, so any screen can look them up from the clock. */
function buildTraffic(T, rnd, d, diff){
  const def = T.def, mix = def.traffic, kinds = Object.keys(mix), wsum = kinds.reduce((a, k) => a + mix[k], 0);
  const V = [], VR = 7600, laneEnd = [[], [], [], []];
  const spacing = def.spacing / d.traffic;
  let P = START_Z + 60 * SEG;
  while(P < T.finish - 10 * SEG){
    let w = rnd() * wsum, kind = kinds[0];
    for(const k of kinds){ w -= mix[k]; if(w < 0){ kind = k; break; } }
    const K = VEH[kind], v0 = K.v[0] + rnd() * (K.v[1] - K.v[0]);
    const z0 = START_Z + (P - START_Z) * (1 - v0 / VR) + 40 * SEG;
    let lane = Math.floor(rnd() * 4);
    if(kind === 'tractor' || kind === 'truck' || kind === 'bus') lane = rnd() < 0.7 ? 3 : 2;      // slow traffic keeps right
    for(let tries = 0; tries < 4; tries++){
      const l = (lane + tries) % 4;
      if(closedAhead(T, l, z0 - 600, 1400, 0) >= 0) continue;
      if(laneEnd[l].some(q => Math.abs(q[0] - z0) < q[1] + K.len + 900)) continue;
      lane = l; laneEnd[l].push([z0, K.len]);
      V.push({ id: V.length, kind, lane, x: LANE_X[lane], z: z0, v: v0 * 0.9, v0, len: K.len, w: K.w, col: CAR_COLS[Math.floor(rnd() * CAR_COLS.length)], cd: 0, tl: lane });
      break;
    }
    P += spacing * (0.55 + rnd() * 0.9);
  }
  const n = V.length, steps = Math.ceil(TEND / TDT) + 1;
  const ZS = new Float32Array(n * steps), XS = new Float32Array(n * steps);
  const order = V.map((q, i) => i);
  for(let k = 0; k < steps; k++){
    const t = k * TDT;
    for(let i = 0; i < n; i++){ ZS[i * steps + k] = V[i].z; XS[i * steps + k] = V[i].x; }
    // keep the list sorted by position (insertion sort: it is almost sorted already)
    for(let a = 1; a < n; a++){ const q = order[a]; let b = a - 1; while(b >= 0 && V[order[b]].z > V[q].z){ order[b + 1] = order[b]; b--; } order[b + 1] = q; }
    const pos = new Int32Array(n); for(let a = 0; a < n; a++) pos[order[a]] = a;
    const inLane = (q, l) => q.tl === l || Math.abs(q.x - LANE_X[l]) < 0.3;
    const leaderGap = (me, l) => {
      let best = 1e9, lv = 0;
      for(let a = pos[me.id] + 1; a < n; a++){ const q = V[order[a]]; const dz = q.z - me.z; if(dz > 4000) break; if(inLane(q, l)){ const g = dz - q.len; if(g < best){ best = g; lv = q.v; } } }
      return [best, lv];
    };
    const laneFree = (me, l) => {
      for(let a = pos[me.id] + 1; a < n; a++){ const q = V[order[a]]; const dz = q.z - me.z; if(dz > me.len + 900) break; if(inLane(q, l)) return false; }
      for(let a = pos[me.id] - 1; a >= 0; a--){ const q = V[order[a]]; const dz = me.z - q.z; if(dz > q.len + 1300) break; if(inLane(q, l)) return false; }
      return closedAhead(T, l, me.z - 300, 3200, t) < 0;
    };
    for(let a = n - 1; a >= 0; a--){
      const me = V[order[a]];
      if(me.cd > 0) me.cd -= TDT;
      let l = me.tl;
      const [gap, lv] = leaderGap(me, l);
      const obs = closedAhead(T, l, me.z, 3400, t);
      // pass slower traffic, merge round closures, and now and then just change lane
      if(me.cd <= 0 && Math.abs(me.x - LANE_X[l]) < 0.05){
        const wantPass = gap < 2600 && lv < me.v0 - 250;
        const mustMerge = obs >= 0 && obs < 3000 && !(T.clo.some(c => c.cr && c.z1 >= me.z && c.z1 - me.z < 3400));
        const whim = rnd() < 0.006;
        if(wantPass || mustMerge || whim){
          const opts = [l - 1, l + 1].filter(q => q >= 0 && q < 4 && laneFree(me, q));
          if(opts.length){ me.tl = opts.length > 1 ? opts[rnd() < 0.5 ? 0 : 1] : opts[0]; me.cd = 3 + rnd() * 3; }
          else if(whim) me.cd = 1;
        }
      }
      l = me.tl;
      // speed: cruise, follow the car in front, stop for closures (crossings, lane still closed)
      let vt = me.v0;
      const [g2, lv2] = leaderGap(me, l);
      if(g2 < 1800) vt = Math.min(vt, lv2 + (g2 - 700) * 1.2);
      const o2 = closedAhead(T, l, me.z, 3400, t);
      if(o2 >= 0 && o2 > 120) vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 5000 * (o2 - 350))));
      vt = Math.max(0, vt);
      me.v = me.v < vt ? Math.min(vt, me.v + 1600 * TDT) : Math.max(vt, me.v - 7000 * TDT);
      me.z += me.v * TDT;
      const tx = LANE_X[me.tl], dx = tx - me.x, stepX = 0.4 * TDT;
      me.x = Math.abs(dx) <= stepX ? tx : me.x + Math.sign(dx) * stepX;
    }
  }
  T.veh = V.map(q => ({ id: q.id, kind: q.kind, len: q.len, w: q.w, col: q.col, z: 0, x: 0, v: 0 }));
  T.ZS = ZS; T.XS = XS; T.steps = steps;
}
/* Where every vehicle is at race time t */
function trafficAt(T, t){
  const s = T.steps, f = t / TDT, k = Math.min(s - 2, Math.max(0, Math.floor(f))), u = Math.min(1.5, f - k);
  for(const q of T.veh){
    const b = q.id * s + k, z1 = T.ZS[b], z2 = T.ZS[b + 1];
    q.v = (z2 - z1) / TDT; q.z = z1 + (z2 - z1) * u; q.x = T.XS[b] + (T.XS[b + 1] - T.XS[b]) * Math.min(1, u);
    q.dx = (T.XS[b + 1] - T.XS[b]) / TDT;
  }
}
let TK = null;
const segAt = z => TK.segs[clamp(Math.floor(z / SEG), 0, TK.N - 1)];

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('brawl.diff', 'normal'), trackIx: A.Store.get('brawl.track', 0), mode: A.Store.get('brawl.mode', 'quick'),
  gridIx: A.Store.get('brawl.grid', 0), bike: A.Store.get('brawl.bike', 'mixed'),
  unlocked: A.Store.get('brawl.unlocked', 3), bikes: A.Store.get('brawl.bikes', ['street']),
  riders: [], players: [], order: [], time: 0, stateT: 0, raceT: 0, simT: 0, raceId: 0, firstFinish: -1, net: null, results: null, champ: null,
  rain: false, cop: null, ghost: null, rec: null, bot: false, hitCones: new Set(), copWarn: 0
};
if(!DIFF[G.diff]) G.diff = 'normal';
if(!MODES.some(m => m.id === G.mode)) G.mode = 'quick';
if(!(G.gridIx >= 0 && G.gridIx < GRIDS.length)) G.gridIx = 0;
if(!(G.unlocked >= 3 && G.unlocked <= TRACKS.length)) G.unlocked = 3;
if(!Array.isArray(G.bikes)) G.bikes = ['street'];
if(!(G.trackIx >= 0 && G.trackIx < G.unlocked)) G.trackIx = 0;
const D = () => DIFF[G.diff];
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
const ordinal = n => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');
function fmt(t){ if(!(t >= 0)) return '--:--.-'; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
const progress = r => clamp((r.dist - START_Z) / (TK.finish - START_Z), 0, 1);
const racers = () => G.riders.filter(r => !r.police && !r.ghost);
const humans = () => G.riders.filter(r => r.human);

/* ---------- Riders ---------- */
let nextId = 1;
function makeRider(o){
  return Object.assign({ id: nextId++, dist: 0, x: 0, v: 0, lat: 0, kb: 0, lean: 0, h: 0, air: null, prevDist: 0,
    bal: 0, balT: 9, stagT: 0, fallT: 0, fallVx: 0, invT: 0, hitT: 0, hitK: 0, hitSide: 0,
    atkT: 0, atkPend: 0, atkCd: 0, atkKind: 'punch', atkSide: 1, fireHeld: 0, blk: false, blkT: 0, counterT: 0,
    nitro: 0, nitroT: 0, tuck: false, brake: false, off: false, surf: '', towT: 0, dustT: 0, shake: 0,
    msg: '', msgT: 0, msgCol: '', fin: -1, lastPlace: 0, score: 0, chain: 0, chainT: 0, mult: 1, streak: 0, bestStreak: 0, topV: 0,
    wanted: 0, skill: 1, pers: null, aiT: 0, aiX: null, hitIds: [], lastSteer: 1, style: 'street', stretch: false,
    stats: { overtakes: 0, passes: 0, near: 0, hits: 0, swings: 0, takedowns: 0, copBops: 0, falls: 0, traffic: 0, blocks: 0, nitros: 0, air: 0, rivalHits: 0, gained: 0, worst: 0, chal: [] } }, o);
}
function say(r, msg, col, t){
  if(r.cpu && !r.police) { r.msg = msg; r.msgT = t || 0.9; r.msgCol = col || ''; return; }
  r.msg = msg; r.msgT = t || 1.2; r.msgCol = col || '';
}
const NONE = { left: false, right: false, down: false, up: false, upP: false, fire: false, fireP: false, block: false };
function controls(r){
  if(r.police) return policeControls(r);
  if(r.cpu || (G.bot && r.human)) return cpuControls(r);
  const s = A.Input.get(r.source), on = !!(s && s.connected);
  if(!on) return NONE;
  return { left: s.left, right: s.right, down: s.down, up: s.up, upP: A.Input.pressed(s, 'up'), fire: s.fire, fireP: A.Input.pressed(s, 'fire'), block: false };
}
const grip = () => G.rain ? 0.8 : 1;
const cornerSpeed = curve => Math.abs(curve) < 0.05 ? 1.3 : Math.sqrt(STEER * grip() * 0.85 * 6 / (Math.abs(curve) * PUSH));

/* ---------- CPU riders ---------- */
function opponentsNear(r, dzMax){
  const out = [];
  for(const q of G.riders){ if(q === r || q.ghost || q.fallT > 0 || q.fin >= 0 && !G.demo) continue; const dz = q.dist - r.dist; if(Math.abs(dz) < dzMax) out.push(q); }
  return out;
}
/* Cost of riding at lateral position x for the next second or so */
function laneCost(r, x, look, care){
  const seg0 = segAt(r.dist), w = seg0.w;
  let cost = Math.abs(x - r.x) * 1.4;
  if(Math.abs(x) > w - 0.1) cost += 12;
  const ahead = r.dist + look;
  const lo = Math.min(x, r.x), hi = Math.max(x, r.x);
  for(const q of TK.veh){
    const dz = q.z - r.dist;
    if(dz < -q.len - BIKE_L || dz > look) continue;
    const rel = Math.max(300, r.v - q.v), tta = Math.max(0, dz) / rel, qx = q.x + (q.dx || 0) * Math.min(tta, 1.5);
    const need = q.w / 2 + BIKE_W / 2 + 0.045;
    if(Math.abs(x - qx) < need){
      if(tta < 1.6 || dz < 900) cost += (14 + 10 * (1 - Math.min(1, tta / 1.6))) * care;
      else cost += 3 * care;
    }
    // can't steer through something beside us, or across something ahead faster than we can lean over
    else if(Math.abs(r.x - q.x) >= need && hi > q.x - need && lo < q.x + need){
      if(dz < BIKE_L * 1.2) cost += 20 * care;
      else if((hi - lo) / 1.3 > dz / rel) cost += 12 * care;
    }
  }
  for(let i = Math.floor(r.dist / SEG); i <= Math.floor(ahead / SEG) && i < TK.N; i++){
    const s = TK.segs[i];
    if(s.w < w - 0.01 && Math.abs(x) > s.w - 0.1) cost += 8;
    for(const h of s.haz){
      if(Math.abs(x - h.x) > h.w + BIKE_W / 2 + 0.05) continue;
      if(h.k === 'cone' && G.hitCones.has(h.cid)) continue;
      cost += ({ barrier: 30, log: 30, bale: 16, hole: 3, oil: 5, sand: 3, ice: 5, drift: 4, rough: 1.2, debris: 2.5, cone: 3, ramp: -2.5 })[h.k] * (h.k === 'ramp' ? 1 : care) / (s.haz.length > 3 ? 2 : 1);
    }
  }
  for(const cr of TK.cross){
    const dz = cr.z - r.dist; if(dz < -200 || dz > look + 800) continue;
    const tta = Math.max(0, dz) / Math.max(1500, r.v), t = G.simT + tta;
    if(cr.k === 'train'){ if(crossActive(cr, t, 0.8) && dz > 0) cost += 0.5; continue; }
    for(let j = 0; j < cr.n; j++){ const cx = crossX(cr, t, j); if(cx !== null && Math.abs(cx - x) < cr.w + 0.14) cost += (cr.k === 'tumble' ? 3 : 12) * care; }
  }
  return cost;
}
function cpuControls(r){
  const k = { left: false, right: false, down: false, up: false, upP: false, fire: false, fireP: false, block: false };
  if(r.fallT > 0) return k;
  const p = r.pers || RIVALS[3], d = D(), sp = r.v / MAXV;
  const seg = segAt(r.dist), look = 900 + r.v * 1.1;
  // pick a line through the traffic every so often
  r.aiT -= 1 / 60;
  if(r.aiT <= 0 || r.aiX === null){
    r.aiT = 0.14 + (r.id % 5) * 0.012;
    const care = p.care * (r.human ? 1.4 : 1);
    let best = r.aiX === null ? r.x : r.aiX, bc = laneCost(r, best, look, care) - 1.2;
    const w = seg.w;
    for(let x = -w + 0.125; x <= w - 0.12; x += 0.0625){
      let c = laneCost(r, x, look, care);
      // brawlers drift towards someone to bump
      if(p.aggro > 0.6 && !r.human && r.engageT > 0) for(const q of opponentsNear(r, BIKE_L * 5)) if(!q.police && Math.abs(q.x - x) > 0.11 && Math.abs(q.x - x) < 0.22) c -= 2.2 * p.aggro * Math.min(1, d.aggro + 0.3);
      if(c < bc){ bc = c; best = x; }
    }
    r.aiX = best; r.aiCost = bc;
  }
  const dx = r.aiX - r.x;
  if(dx > 0.025) k.right = true; else if(dx < -0.025) k.left = true;
  // brake for tight bends and for blocked roads
  const lookN = 10 + Math.floor(sp * 34);
  let target = MAXV * 2;
  for(let i = 1; i <= lookN; i++){
    const s = TK.segs[Math.min(TK.N - 1, seg.i + i)], vc = Math.min(1.3, cornerSpeed(s.curve) * 0.98) * MAXV;
    const allowed = Math.sqrt(vc * vc + 2 * BRAKE * 0.6 * i * SEG);
    if(allowed < target) target = allowed;
  }
  target = Math.min(target, Math.min(1.3, cornerSpeed(seg.curve)) * MAXV);
  // something slow right in front and no time to swerve round it: brake
  for(const q of TK.veh){
    const dz = q.z - r.dist - BIKE_L; if(dz < -60 || dz > 4200) continue;
    const need = q.w / 2 + BIKE_W / 2 + 0.02, off = Math.abs(q.x - r.x); if(off >= need) continue;
    const rel = r.v - q.v;
    if(dz < 380 && Math.abs(r.aiX - q.x) < need){ target = Math.min(target, q.v - 120); continue; }
    if(rel <= 0) continue;
    const dodging = Math.abs(r.aiX - q.x) >= need, tDodge = dodging ? (need - off + 0.03) / 1.3 : 99;
    if(dz < rel * rel / (2 * BRAKE * 0.7) + 300 && tDodge > dz / rel * 0.8) target = Math.min(target, q.v - 150);
  }
  // brawlers look for a fight now and then: ease off to let a rival come alongside
  if(!r.human && p.aggro > 0.6 && (G.state === 'race' || G.demo)){
    r.engageT = (r.engageT || 0) - 1 / 60;
    if(r.engageT < -6 && Math.random() < 0.01 * p.aggro) r.engageT = 4 + Math.random() * 3;
    if(r.engageT > 0){ const q = opponentsNear(r, BIKE_L * 3).find(q => !q.police && q.dist < r.dist && r.dist - q.dist < BIKE_L * 2.5); if(q) target = Math.min(target, q.v - 200); }
  }
  if(r.v > target * 1.02) k.down = true;
  // train on the way down? wait for it
  for(const cr of TK.cross) if(cr.k === 'train'){ const dz = cr.z - r.dist - BIKE_L; if(dz > 0 && dz < 2600 && crossActive(cr, G.simT + dz / Math.max(2000, r.v), 0.3)) k.down = true; }
  // nitro on a clear stretch
  if(r.nitro >= 34 && r.nitroT <= 0 && !k.down && r.aiCost < 4 && G.state === 'race'){
    let straight = true; for(let i = 1; i < 30; i++) if(Math.abs(TK.segs[Math.min(TK.N - 1, seg.i + i)].curve) > 1.5){ straight = false; break; }
    if(straight && Math.random() < 0.03 * p.nitro) k.upP = true;
  }
  // fighting
  if((G.state === 'race' || G.demo) && r.stagT <= 0 && !r.air){
    const reach = 0.27, foes = opponentsNear(r, BIKE_L * 0.95).filter(q => Math.abs(q.x - r.x) < reach && Math.abs(q.x - r.x) > 0.02 && !q.ghost && q.invT <= 0);
    const aggro = (r.human ? 0.6 : p.aggro) * d.aggro * (G.demo ? 0.5 : 1);
    if(r.counterT > 0){ r.counterT -= 1 / 60; if(r.counterT <= 0 && foes.length && r.atkCd <= 0){ k.fireP = true; k.down = Math.random() < p.kick * d.kick * 0.6 && Math.abs(foes[0].x - r.x) < 0.18; k.left = foes[0].x < r.x; k.right = !k.left; } }
    else if(foes.length && r.atkCd <= 0 && Math.random() < 0.035 * aggro){
      const f = foes[0]; k.fireP = true; k.left = f.x < r.x; k.right = !k.left;
      if(Math.abs(f.x - r.x) < 0.18 && Math.random() < p.kick * d.kick * 0.5) k.down = true;
    }
    // guard up when a rival alongside is winding up (or just being careful)
    if(r.blkT > 0){ r.blkT -= 1 / 60; k.block = true; }
    else if(!k.fireP && foes.some(q => q.atkPend > 0 || q.atkT > 0.15) && Math.random() < 0.35 * p.block * (d.gentle ? 0.6 : 1)){ r.blkT = 0.5 + Math.random() * 0.4; k.block = true; }
  }
  return k;
}
/* Police bikes chase whoever is causing trouble, ride alongside and give them a shove. Knock them off and they give up. */
function policeControls(r){
  const k = { left: false, right: false, down: false, up: false, upP: false, fire: false, fireP: false, block: false };
  if(r.fallT > 0 || r.leaving) { return k; }
  r.aiT -= 1 / 60;
  if(r.aiT <= 0){
    r.aiT = 0.8;
    const cands = G.riders.filter(q => !q.police && !q.ghost && q.fin < 0 && q.fallT <= 0);
    let best = null, bw = -1;
    for(const q of cands){ const w = q.wanted * (q.human ? 1.3 : 1) + (q.human ? 0.4 : 0) - Math.max(0, q.dist - r.dist) / 40000; if(w > bw){ bw = w; best = q; } }
    r.target = best ? best.id : 0;
  }
  const t = G.riders.find(q => q.id === r.target);
  const look = 900 + r.v * 1.1;
  let want = t ? t.x + (t.x > 0 ? -0.16 : 0.16) : r.x;
  if(t && t.dist - r.dist > BIKE_L * 3){ want = t.x; }
  // still dodge traffic
  let best = want, bc = 1e9;
  for(let x = -0.88; x <= 0.88; x += 0.14){ const c = laneCost(r, x, look, 1.2) + Math.abs(x - want) * 3; if(c < bc){ bc = c; best = x; } }
  const dx = best - r.x;
  if(dx > 0.025) k.right = true; else if(dx < -0.025) k.left = true;
  if(t && Math.abs(t.dist - r.dist) < BIKE_L * 0.8 && Math.abs(t.x - r.x) < 0.26 && r.atkCd <= 0 && Math.random() < 0.06){ k.fireP = true; k.left = t.x < r.x; k.right = !k.left; }
  // brake for bends like everyone else
  const seg = segAt(r.dist);
  for(let i = 1; i < 20; i++){ const s = TK.segs[Math.min(TK.N - 1, seg.i + i)]; if(r.v > Math.min(1.3, cornerSpeed(s.curve)) * MAXV * (1.02 + i * 0.03)) k.down = true; }
  return k;
}

/* Rubber band: rivals ease off when far ahead of every human and push when far behind */
function band(r){
  if(G.demo || r.human) return 1;
  const hum = G.riders.filter(q => q.human && q.fin < 0);
  if(!hum.length) return 1;
  let lead = -1e9, back = 1e9;
  for(const q of hum){ lead = Math.max(lead, q.dist); back = Math.min(back, q.dist); }
  const kids = G.diff === 'kids';
  if(r.police){
    const t = G.riders.find(q => q.id === r.target) || hum[0];
    const gap = t.dist - r.dist;
    return gap > 8 * SEG ? 1.1 * D().police : gap > 0 ? D().police : 0.96;
  }
  const ahead = r.dist - lead, behind = back - r.dist;
  if(ahead > 25 * SEG) return Math.max(kids ? 0.8 : 0.88, 1 - (ahead - 25 * SEG) / (kids ? 60000 : 120000));
  if(behind > 30 * SEG) return Math.min(1.08, 1 + (behind - 30 * SEG) / 100000);
  return 1;
}

/* ---------- Scoring ---------- */
function addScore(r, pts, chain){
  if(!r.human || G.demo) return;
  if(chain){
    r.chain++; r.chainT = 2.6;
    const m = 1 + Math.min(4, Math.floor(r.chain / 3));
    if(m > r.mult){ r.mult = m; say(r, 'COMBO x' + m + '!', '#ff7eb6', 1.2); sfx('combo'); }
    pts *= r.mult;
  }
  r.score += Math.round(pts);
}
function addNitro(r, n){
  const before = r.nitro;
  r.nitro = Math.min(100, r.nitro + n * (r.human ? D().nitro : 1));
  if(r.human && Math.floor(before / 34) < Math.floor(r.nitro / 34) && r.nitroT <= 0) sfx('nitroFull');
}

/* ---------- Combat ---------- */
function nearestSide(r, reach){
  let best = 0, bd = 1e9;
  for(const q of G.riders){
    if(q === r || q.ghost || q.fallT > 0) continue;
    const dz = Math.abs(q.dist - r.dist), dx = q.x - r.x;
    if(dz > BIKE_L || Math.abs(dx) > reach || Math.abs(dx) < 0.01) continue;
    const dd = dz / BIKE_L + Math.abs(dx) * 3;
    if(dd < bd){ bd = dd; best = Math.sign(dx); }
  }
  return best;
}
function startAttack(r, kind, steer){
  const side = steer || nearestSide(r, 0.36) || r.lastSteer || 1;
  r.atkKind = kind; r.atkSide = side; r.atkT = kind === 'kick' ? 0.36 : 0.26; r.atkPend = 0.09;
  r.atkCd = (kind === 'kick' ? 0.95 : 0.55) * (r.cpu && D().gentle ? 1.7 : 1) * (r.police ? 1.8 : 1);
  r.stats.swings++; r.blk = false;
  if(kind === 'kick') r.v *= 0.99;
}
function resolveAttack(r){
  const kick = r.atkKind === 'kick', reach = kick ? 0.2 : 0.28, zr = kick ? BIKE_L * 0.8 : BIKE_L * 1.0, side = r.atkSide;
  let best = null, bd = 1e9;
  for(const q of G.riders){
    if(q === r || q.ghost || q.fallT > 0 || q.invT > 0 || (q.fin >= 0 && !G.demo) || (r.police && q.police)) continue;
    const dz = Math.abs(q.dist - r.dist), dx = (q.x - r.x) * side;
    if(dz > zr || dx < 0.015 || dx > reach || Math.abs(q.h - r.h) > 160) continue;
    const dd = dz / zr + dx / reach;
    if(dd < bd){ bd = dd; best = q; }
  }
  if(!best){ if(r.human) sfx('whoosh'); return; }
  hit(r, best, kick ? 'kick' : 'punch');
}
function canFall(t){
  const d = D();
  if(t.police) return true;
  if(t.human && !d.falls) return false;
  return true;
}
function hit(a, t, kind){
  const d = D(), side = a.atkSide, blocked = t.blk && t.fallT <= 0;
  let dmg = kind === 'kick' ? 46 : a.police ? 34 : 31;
  if(a.cpu || a.police) dmg *= d.dmg;
  if(t.police) dmg *= 0.55;
  if(blocked){
    dmg *= 0.3; t.stats.blocks++; addNitro(t, 5);
    say(t, 'BLOCKED!', '#7fe3ff'); sfx('block');
    a.kb -= side * 0.35; a.atkCd += 0.25;
  } else {
    sfx(kind === 'kick' ? 'kick' : 'punch');
    a.stats.hits++; addNitro(a, 8); addScore(a, 50, true);
    if(!t.police && !a.police && !(t.human && a.human)) a.stats.rivalHits++;
    if(t.police) a.stats.rivalHits++;
  }
  a.wanted = Math.min(6, a.wanted + (t.police ? 1.5 : 1));
  t.kb += side * (kind === 'kick' ? 1.1 : 0.62) * (blocked ? 0.35 : 1) * (t.police ? 0.6 : 1);
  t.v *= blocked ? 0.995 : kind === 'kick' ? 0.93 : 0.97;
  t.hitT = 0.35; t.hitK = blocked ? 3 : kind === 'kick' ? 2 : 1; t.hitSide = side; t.balT = 0;
  if(!blocked){
    if(t.stagT > 0 && canFall(t)){ fall(t, kind === 'kick' ? 'WHAM!' : 'POW!', side); takedown(a, t); }
    else {
      t.bal += dmg;
      say(t, kind === 'kick' ? 'WHAM!' : a.police ? 'SHOVE!' : 'POW!', '#ffd166', 0.8);
      if(t.bal >= 100){ t.bal = 100; stagger(t); }
    }
    if(!t.human && !t.police && t.pers && Math.random() < t.pers.counter * Math.min(1.2, d.aggro + 0.2)){ t.counterT = 0.25 + Math.random() * 0.35; }
  }
}
function stagger(r){
  if(r.stagT > 0 || r.fallT > 0) return;
  r.stagT = 1.5; r.nitroT = 0;
  say(r, 'DIZZY!', '#ffd166', 1.2); sfx('stagger');
  if(r.human) r.shake = Math.max(r.shake, 0.5);
}
function fall(r, why, side){
  if(r.fallT > 0) return;
  const d = D();
  r.fallT = r.police ? 1.6 : d.gentle ? 1.4 : G.diff === 'pro' ? 2.0 : 1.75;
  r.fallVx = (side || (r.x > 0 ? -1 : 1)) * 0.7; r.v *= 0.6; r.stagT = 0; r.bal = 0; r.nitroT = 0; r.air = null; r.h = 0; r.blk = false; r.atkPend = 0;
  r.stats.falls++; endStreak(r);
  if(G.log) G.log.push(['fall', r.name, why, +G.raceT.toFixed(1), Math.round(r.v), +r.x.toFixed(2), r.stagT, r.surf]);
  r.chain = 0; r.mult = 1;
  say(r, (why || 'OOPS!') + ' TUMBLE!', '#ff9f43', 1.4); sfx('fall');
  if(r.human) r.shake = 1;
  if(r.police) r.leaving = true;
}
function remount(r){
  r.fallT = 0; r.invT = 1.5; r.v = Math.max(r.v, MAXV * 0.3); r.bal = 0; r.kb = 0; r.lat = 0;
  const w = segAt(r.dist).w; r.x = clamp(r.x, -w + 0.1, w - 0.1);
  say(r, 'BACK ON!', '#3fd07a', 1); sfx('backOn');
}
function takedown(a, t){
  a.stats.takedowns++; addNitro(a, 20); addScore(a, 400, true);
  if(t.police){ a.stats.copBops++; say(a, 'COP BOPPED!', '#7aa8ff', 1.4); }
  else say(a, 'TAKEDOWN!', '#ff5a4e', 1.3);
}
function endStreak(r){
  if(r.streak >= 3 && r.human && !G.demo){
    const pts = Math.round(r.streak * 60); addScore(r, pts, false);
    say(r, 'STREAK ' + Math.floor(r.streak) + 's +' + pts, '#7fe3ff', 1.3);
  }
  r.bestStreak = Math.max(r.bestStreak, r.streak); r.streak = 0;
}
function startAir(r, sp){
  const dur = 0.5 + 0.5 * sp;
  r.air = { t: 0, dur, peak: 350 + 550 * sp }; r.stats.air++;
  say(r, 'WHEE!', '#7fe3ff', 0.9); if(r.human) sfx('whee');
}

/* ---------- One rider, one step ---------- */
function stepRider(r, dt){
  for(const k of ['msgT', 'invT', 'hitT', 'atkT', 'atkCd', 'nitroT', 'towT', 'dustT']) if(r[k] > 0) r[k] -= dt;
  if(r.shake > 0) r.shake = Math.max(0, r.shake - dt * 2.5);
  if(r.chainT > 0){ r.chainT -= dt; if(r.chainT <= 0){ r.chain = 0; r.mult = 1; } }
  r.wanted = Math.max(0, r.wanted - 0.08 * dt);
  r.balT += dt;
  if(r.balT > 1.6 && r.bal > 0 && r.stagT <= 0) r.bal = Math.max(0, r.bal - 13 * dt);
  r.prevDist = r.dist;
  if(r.ghost) return;
  const racing = G.state === 'race' || G.state === 'finishing' || G.demo;
  if(!racing){ r.v = 0; r.lean *= 0.9; return; }
  const d = D(), seg = segAt(r.dist);
  // tumbling: slide along, then hop back on
  if(r.fallT > 0){
    r.fallT -= dt; r.v = Math.max(0, r.v - 6000 * dt); r.dist += r.v * dt;
    r.x += r.fallVx * dt; r.fallVx *= 1 - 3 * dt; r.x = clamp(r.x, -seg.w - 0.3, seg.w + 0.3);
    r.lean += ((r.fallVx >= 0 ? 1 : -1) * 1.6 - r.lean) * Math.min(1, dt * 6);
    if(r.fallT <= 0) remount(r);
    return;
  }
  const ctl0 = controls(r), ctl = r.fin >= 0 && !G.demo ? Object.assign({}, ctl0, { fireP: false, fire: false, upP: false, block: false }) : ctl0;
  let steer = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0);
  if(steer) r.lastSteer = steer;
  if(r.stagT > 0){ r.stagT -= dt; steer = steer * 0.4 + Math.sin(G.simT * 9 + r.id) * 0.7; if(r.stagT <= 0) r.bal = 45; }
  // in the air
  if(r.air){
    r.air.t += dt; const u = r.air.t / r.air.dur;
    if(u >= 1){ r.air = null; r.h = 0; if(r.human){ sfx('land'); r.shake = Math.max(r.shake, 0.35); } addNitro(r, 6); addScore(r, 200, true); say(r, 'BIG AIR!', '#7fe3ff', 1); }
    else r.h = r.air.peak * 4 * u * (1 - u);
  }
  // FIRE: punch (DOWN+FIRE kicks); hold FIRE to block
  if(ctl.fireP && r.stagT <= 0 && !r.air && r.fin < 0){
    r.fireHeld = 0;
    if(r.atkCd <= 0) startAttack(r, ctl.down && (!r.cpu || d.kick > 0) ? 'kick' : 'punch', steer);
  }
  r.fireHeld = ctl.fire ? r.fireHeld + dt : 0;
  r.blk = !!((ctl.block || (ctl.fire && r.fireHeld > 0.22)) && r.atkT <= 0 && r.stagT <= 0 && !r.air);
  if(r.atkPend > 0){ r.atkPend -= dt; if(r.atkPend <= 0) resolveAttack(r); }
  // UP: nitro, or tuck in when the tank is empty
  if(ctl.upP && r.nitro >= 34 && r.nitroT <= 0 && r.stagT <= 0 && (G.state === 'race' || G.demo)){
    r.nitro -= 34; r.nitroT = 2.0; r.stats.nitros++;
    say(r, 'NITRO!', '#ff9f43', 1); if(r.human){ sfx('nitro'); r.shake = Math.max(r.shake, 0.3); }
  }
  r.tuck = !!ctl.up && r.nitroT <= 0 && !r.blk && r.atkT <= 0;
  r.brake = !!ctl.down && r.v > 300;
  // surfaces under the wheels
  let gripK = grip(), drag = 1;
  r.surf = '';
  if(!r.air){
    const front = r.dist + BIKE_L * 0.6;
    for(const h of segAt(front).haz){
      if(front < h.z || front > h.z + h.len + BIKE_L * 0.4 || Math.abs(r.x - h.x) > h.w + BIKE_W * 0.4) continue;
      if(h.k === 'cone' && G.hitCones.has(h.cid)) continue;
      touchHazard(r, h, dt);
      if(h.k === 'oil'){ gripK *= 0.22; r.surf = 'oil'; }
      else if(h.k === 'ice'){ gripK *= 0.3; r.surf = 'ice'; }
      else if(h.k === 'sand'){ gripK *= 0.55; drag *= 0.72; r.surf = 'sand'; }
      else if(h.k === 'rough'){ drag *= 0.86; r.surf = 'rough'; }
      else if(h.k === 'drift'){ drag *= 0.55; r.surf = 'drift'; }
    }
  }
  // speed
  const sp = r.v / MAXV;
  let vmax = MAXV * r.skill * band(r) * drag;
  if(r.tuck) vmax *= 1.045;
  if(r.nitroT > 0) vmax *= 1.22;
  if(r.towT > 0) vmax *= 1.08;
  if(r.stagT > 0) vmax *= 0.78;
  if(r.blk) vmax *= 0.95;
  if(r.off) vmax *= 0.6;
  if(r.fin >= 0 && !G.demo) vmax = Math.min(vmax, MAXV * 0.55);
  if(r.police && r.leaving) vmax = MAXV * 0.55;
  // Kids: gentle brake assist before the tightest bends
  let assist = false;
  if(r.human && d.gentle && !ctl.down){ for(let i = 0; i < 14 && !assist; i++){ const s2 = TK.segs[Math.min(TK.N - 1, seg.i + i)]; if(r.v > Math.min(1.3, cornerSpeed(s2.curve)) * MAXV * (1.02 + i * 0.025)) assist = true; } }
  if(r.brake || assist) r.v = Math.max(0, r.v - BRAKE * (assist && !r.brake ? 0.55 : 1) * dt);
  else if(r.v < vmax) r.v = Math.min(vmax, r.v + ACC * (r.nitroT > 0 ? 1.8 : 1) * (1 - 0.55 * r.v / vmax) * dt);
  else r.v = Math.max(vmax, r.v - (r.off ? 7000 : 2600) * dt);
  // steering: freeform across the road; bends push you wide; slippery patches make you slide
  const want = steer * STEER * (0.45 + 0.55 * Math.min(1, sp)) * (r.air ? 0.35 : 1) * (r.tuck ? 0.8 : 1) * (r.blk ? 0.85 : 1);
  r.lat += (want - r.lat) * Math.min(1, dt * 9 * gripK);
  const push = -seg.curve / 6 * sp * sp * PUSH * (d.gentle ? 0.8 : 1) * (r.air ? 0.3 : 1);
  r.kb *= Math.max(0, 1 - 4 * dt);
  r.x += (r.lat + push + r.kb) * dt;
  // too fast for the bend: the tyres scrub and you run wide
  const excess = Math.abs(push) - STEER * gripK * 0.9;
  if(excess > 0 && !r.air){ r.v = Math.max(MAXV * 0.3, r.v - excess * 1400 * dt); r.bal += excess * 8 * dt; }
  if(r.surf === 'oil' || r.surf === 'ice') r.bal += (d.gentle ? 5 : 11) * dt * Math.abs(steer || 0.3);
  if(r.surf === 'sand' || r.surf === 'drift' || r.surf === 'rough') r.bal += 4 * dt;
  if(r.bal >= 100 && r.stagT <= 0){ r.bal = 100; stagger(r); }
  const leanT = clamp(r.lat / STEER * 0.9 - push * 0.08 + r.kb * 0.3, -1, 1) + (r.stagT > 0 ? Math.sin(G.simT * 12 + r.id) * 0.3 : 0);
  r.lean += (leanT - r.lean) * Math.min(1, dt * 8);
  // edges: shoulder slows you; walls and bridge rails bounce you back
  const w = seg.w, ax = Math.abs(r.x);
  r.off = false;
  if(w < 0.99 && ax > w + 0.03){
    r.x = Math.sign(r.x) * (w + 0.03); r.kb = -Math.sign(r.x) * 0.8; r.lat = 0;
    if(r.hitT <= 0){ r.bal += d.gentle ? 6 : 14; r.hitT = 0.3; r.hitK = 4; if(r.human) sfx('scrape'); say(r, 'SCRAPE!', '#ffd166', 0.6); }
  } else if(ax > w + 0.02){
    r.off = !r.air;
    if(ax > w + 0.45){ r.x = Math.sign(r.x) * (w + 0.45); r.kb = -Math.sign(r.x) * 0.9; r.lat = 0; if(r.hitT <= 0){ r.bal += d.gentle ? 6 : 12; r.hitT = 0.3; r.hitK = 4; if(r.human) sfx('scrape'); } }
  }
  if(r.off && r.human) r.shake = Math.max(r.shake, 0.18);
  if(r.bal >= 100 && r.stagT <= 0){ r.bal = 100; stagger(r); }
  r.dist += r.v * dt;
  // speed streaks and top speed
  const kmh = r.v * KMH; if(kmh > r.topV) r.topV = kmh;
  if(r.v > MAXV * 0.86 && r.stagT <= 0 && !r.off){ const before = r.streak; r.streak += dt; if(r.human && Math.floor(before / 5) < Math.floor(r.streak / 5)){ say(r, 'SPEED STREAK ' + Math.floor(r.streak) + 's!', '#7fe3ff', 1.1); addNitro(r, 5); } }
  else if(r.v < MAXV * 0.72 || r.off) endStreak(r);
  // crossing the line
  if(r.human && !r.stretch && progress(r) > 0.88 && G.state === 'race'){ r.stretch = true; say(r, 'FINAL STRETCH!', '#f5c542', 1.4); sfx('final'); }
  if(r.fin < 0 && !r.police && r.dist >= TK.finish && G.state === 'race'){
    r.fin = G.raceT; orderRiders();
    const pl = place(r);
    if(r.human){ sfx('flag'); say(r, pl === 1 && !G.tt ? 'WINNER!' : 'FINISH! ' + ordinal(pl), '#f5c542', 3); }
    if(G.firstFinish < 0) G.firstFinish = G.raceT;
  }
}
/* Bumps, slicks, cones, bales, logs and ramps */
function touchHazard(r, h, dt){
  const d = D();
  if(r.hitIds.includes(h.id)) return;
  const once = () => { r.hitIds.push(h.id); if(r.hitIds.length > 8) r.hitIds.shift(); };
  const inv = r.invT > 0;
  switch(h.k){
    case 'hole': once(); if(inv) break; r.v *= d.hole; r.bal += d.gentle ? 8 : 16; r.balT = 0; r.hitT = 0.25; r.hitK = 5; say(r, 'BUMP!', '#ffd166', 0.7); if(r.human){ sfx('pothole'); r.shake = Math.max(r.shake, 0.5); } break;
    case 'debris': once(); if(inv) break; r.v *= 0.9; r.bal += d.gentle ? 6 : 12; r.balT = 0; say(r, 'CLUNK!', '#ffd166', 0.7); if(r.human){ sfx('clunk'); r.shake = Math.max(r.shake, 0.35); } break;
    case 'cone': once(); G.hitCones.add(h.cid); r.v *= 0.94; r.bal += 5; say(r, 'OOPS!', '#ff9f43', 0.6); if(r.human) sfx('cone'); break;
    case 'ramp': once(); startAir(r, Math.min(1.1, r.v / MAXV)); break;
    case 'bale': once(); if(inv) break; r.v *= d.gentle ? 0.6 : 0.45; r.bal += d.gentle ? 15 : 34; r.balT = 0; r.kb = (r.x >= h.x ? 1 : -1) * 0.9; r.hitT = 0.4; r.hitK = 6; say(r, 'POOF!', '#f5d67a', 0.9); if(r.human){ sfx('poof'); r.shake = 0.6; } break;
    case 'barrier': case 'log':
      once(); if(inv) break;
      r.stats.traffic++;
      if(canFall(r) && !d.gentle && r.v > MAXV * 0.35) { fall(r, 'BONK!', r.x >= h.x ? 1 : -1); r.v *= 0.4; }
      else { r.v *= d.barrier; r.bal += d.gentle ? 12 : 30; r.balT = 0; r.kb = (r.x >= h.x ? 1 : -1) * 1.1; r.hitT = 0.4; r.hitK = 4; say(r, 'BOING!', '#ffd166', 0.9); if(r.human){ sfx('boing'); r.shake = 0.7; } }
      r.dist = Math.min(r.dist, h.z - BIKE_L * 0.6);
      break;
  }
}
/* Trains, animals, rocks, tumbleweeds and dust devils */
function crossings(r){
  if(r.air || r.fallT > 0 || r.ghost) return;
  const d = D(), front = r.dist + BIKE_L;
  for(const cr of TK.cross){
    const dz = cr.z - r.dist; if(dz < -700 || dz > 1200) continue;
    if(cr.k === 'train'){
      const bar = cr.z - 260;
      if(crossActive(cr, G.simT, 0) && r.prevDist + BIKE_L <= bar + 5 && front > bar){ r.dist = bar - BIKE_L; r.v = 0; if(r.msgT <= 0.2) say(r, 'WAIT FOR THE TRAIN!', '#ffd166', 1); }
      continue;
    }
    const C = CROSS[cr.k];
    for(let j = 0; j < cr.n; j++){
      const x = crossX(cr, G.simT, j); if(x === null) continue;
      const zj = cr.z + (j % 2) * 180;
      if(front < zj - 60 || r.dist > zj + 200) continue;
      if(cr.k === 'devil'){
        if(Math.abs(r.x - x) < cr.w + 0.1){ r.kb += Math.sign(r.x - x || 1) * 2.2 * (1 / 60); r.bal += (d.gentle ? 4 : 9) / 60; r.dustT = 0.8; if(r.msgT <= 0) say(r, 'DUST DEVIL!', '#e0b36c', 0.8); }
        continue;
      }
      if(Math.abs(r.x - x) > cr.w + BIKE_W / 2) continue;
      const key = 100000 + cr.id * 100 + j + crossCycle(cr, G.simT).k * 7;
      if(r.hitIds.includes(key) || r.invT > 0) continue;
      r.hitIds.push(key); if(r.hitIds.length > 8) r.hitIds.shift();
      const side = r.x >= x ? 1 : -1;
      r.kb = side * 0.9; r.hitT = 0.35; r.hitK = 6; r.balT = 0;
      if(cr.k === 'rock'){ r.v *= 0.7; r.bal += d.gentle ? 14 : 40; say(r, 'WHUMP!', '#ffd166', 0.9); if(r.human){ sfx('rumble'); r.shake = 0.8; } if(r.stagT > 0 && canFall(r) && !d.gentle) fall(r, 'ROCKS!', side); }
      else if(cr.k === 'tumble'){ r.v *= 0.96; r.bal += 8; say(r, 'PFFT!', '#e0b36c', 0.6); if(r.human) sfx('poof'); }
      else if(cr.k === 'monkey'){ r.v *= 0.9; r.bal += d.gentle ? 6 : 14; say(r, 'OOK OOK!', '#ffd166', 0.8); if(r.human) sfx('monkey'); }
      else { r.v *= 0.55; r.bal += d.gentle ? 10 : 24; say(r, 'BOING!', '#ffd166', 0.9); if(r.human){ sfx('boing'); sfx('animal'); r.shake = 0.5; } }
      if(C && r.bal >= 100 && r.stagT <= 0){ r.bal = 100; stagger(r); }
    }
  }
}
/* Civilian traffic: rear-ends, side scrapes, overtakes and near misses */
function traffic(r){
  if(r.ghost || r.fallT > 0) return;
  const d = D(), front = r.dist + BIKE_L;
  for(const q of TK.veh){
    const dz = q.z - r.dist;
    if(dz < -q.len - 3000 || dz > 3000) continue;
    const qFront = q.z + q.len;
    // passing a vehicle: overtake (and maybe a near miss)
    if(r.prevDist <= (q.pz === undefined ? q.z : q.pz) + q.len && r.dist > qFront && !r.police && G.state === 'race'){
      const gap = Math.abs(r.x - q.x) - q.w / 2 - BIKE_W / 2;
      const fresh = !(r.passed || (r.passed = new Set())).has(q.id);
      if(!fresh) continue;
      r.passed.add(q.id);
      r.stats.overtakes++; addNitro(r, 4); addScore(r, 50, true);
      if(r.human && r.msgT < 0.3) sfx('pass');
      if(gap < 0.09 && r.v > MAXV * 0.55 && !r.air){ r.stats.near++; addNitro(r, 6); addScore(r, 100, true); say(r, 'NEAR MISS!', '#7fe3ff', 0.9); if(r.human) sfx('near'); }
    }
    if(r.air && r.h > 120) continue;
    if(!(r.dist < qFront && front > q.z)) continue;
    if(Math.abs(r.x - q.x) >= q.w / 2 + BIKE_W / 2) continue;
    if(r.invT > 0) continue;
    const side = r.x >= q.x ? 1 : -1;
    const wasBehind = r.prevDist + BIKE_L <= (q.pz === undefined ? q.z : q.pz) + 80;
    if(r.hitT <= 0 || wasBehind) r.stats.traffic++;
    r.balT = 0;
    if(G.log) G.log.push([wasBehind ? 'rear' : 'side', r.name, q.kind, +G.raceT.toFixed(1), Math.round(r.v - q.v), +(q.x - r.x).toFixed(2), r.aiX, +(r.aiCost || 0).toFixed(1), r.stagT > 0 ? 'stag' : '']);
    if(wasBehind){
      const rel = r.v - q.v;
      r.dist = q.z - BIKE_L - 5;
      if(rel > (G.diff === 'pro' ? 2200 : 2700) && canFall(r) && !d.gentle){ fall(r, 'BONK!', side); r.v = q.v * 0.5; sfx('crash'); sfx('honk'); }
      else {
        r.v = Math.max(0, q.v - (d.gentle ? 400 : 250)); r.bal += d.gentle ? 8 : 22; r.hitT = 0.35; r.hitK = 4;
        say(r, d.gentle ? 'BOING!' : 'BUMP!', '#ffd166', 0.8);
        if(r.human){ sfx(d.gentle ? 'boing' : 'crash'); sfx('honk'); r.shake = 0.6; }
        if(d.gentle && !r.air){ r.air = { t: 0, dur: 0.4, peak: 220 }; }
      }
    } else {
      r.x = q.x + side * (q.w / 2 + BIKE_W / 2 + 0.006); r.kb = side * 0.8; r.lat = 0; r.v *= 0.94;
      if(r.hitT <= 0){ r.bal += d.gentle ? 8 : 20; r.hitT = 0.3; r.hitK = 4; say(r, 'SCRAPE!', '#ffd166', 0.7); if(r.human){ sfx('scrape'); sfx('honk'); r.shake = 0.4; } }
      if(r.stagT > 0 && canFall(r) && !d.gentle && r.v > MAXV * 0.5){ fall(r, 'BONK!', side); }
    }
    if(r.bal >= 100 && r.stagT <= 0 && r.fallT <= 0){ r.bal = 100; stagger(r); }
  }
}
/* Riders bump instead of passing through each other */
function riderCollisions(){
  const list = G.riders.filter(r => !r.ghost && r.fallT <= 0);
  for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
    let a = list[i], b = list[j];
    let dz = b.dist - a.dist;
    if(Math.abs(dz) >= BIKE_L || Math.abs(a.x - b.x) >= BIKE_W || Math.abs(a.h - b.h) > 150) continue;
    if(dz < 0){ const t = a; a = b; b = t; dz = -dz; }
    if(dz > BIKE_L * 0.6){ a.dist = b.dist - BIKE_L; if(a.v > b.v) a.v = b.v; }
    else { const p = (BIKE_W - Math.abs(a.x - b.x)) / 2 + 0.003, s = a.x < b.x ? -1 : 1; a.x += s * p; b.x -= s * p; a.kb += s * 0.2; b.kb -= s * 0.2; }
  }
}
function place(r){ const i = G.order.indexOf(r); return i < 0 ? G.order.length : i + 1; }
function orderRiders(){
  G.order = racers().sort((a, b) => {
    if(a.fin >= 0 && b.fin >= 0) return a.fin - b.fin;
    if(a.fin >= 0) return -1; if(b.fin >= 0) return 1;
    return b.dist - a.dist;
  });
}

/* ---------- Shared camera: keep the family together ----------
   Everyone rides on one screen. Fall far behind and you get a tow; drop right off the back and you
   are zipped back into view. */
const SPREAD_TOW = 22 * SEG, SPREAD_MAX = 34 * SEG;
function camFocus(){
  const hum = G.riders.filter(r => r.human && (r.fin < 0 || G.state !== 'race'));
  const list = hum.length ? hum : G.riders.filter(r => r.human);
  if(!list.length) return null;
  let lead = -1e9, rear = 1e9;
  for(const r of list){ lead = Math.max(lead, r.dist); rear = Math.min(rear, r.dist); }
  return { lead, rear, focus: Math.max(rear, lead - SPREAD_MAX), n: list.length };
}
function keepTogether(){
  if(G.state !== 'race') return;
  const f = camFocus(); if(!f || f.n < 2) return;
  for(const r of G.riders){
    if(!r.human || r.fin >= 0 || r.fallT > 0) continue;
    const behind = f.lead - r.dist;
    if(behind > SPREAD_TOW){ if(r.towT <= 0) say(r, 'TOW!', '#7fe3ff', 0.8); r.towT = 0.3; }
    if(r.dist < f.focus - 1300){
      const lead = G.riders.filter(q => q.human && q.fin < 0).reduce((a, b) => a.dist > b.dist ? a : b);
      r.dist = f.focus - 300; r.v = Math.max(r.v, lead.v * 0.9); r.invT = Math.max(r.invT, 1.2);
      say(r, 'CATCH UP!', '#7fe3ff', 1.2); sfx('nitro');
    }
  }
}

/* ---------- Police ---------- */
function copEvents(){
  if(!GRIDS[G.gridIx].cops || G.tt || G.demo) return [];
  return G.diff === 'kids' ? [[0.45, 1]] : G.diff === 'pro' ? [[0.24, 1], [0.5, 2], [0.74, 1]] : [[0.3, 1], [0.64, 2]];
}
function policeDirector(dt){
  if(G.state !== 'race') return;
  const hum = G.riders.filter(r => r.human && r.fin < 0);
  if(!hum.length) return;
  const lead = Math.max(...hum.map(progress));
  if(G.cop && G.cop.i < G.cop.ev.length){
    const [at, n] = G.cop.ev[G.cop.i];
    if(lead >= at - 0.03 && !G.cop.warned){ G.cop.warned = true; G.copWarn = 2.5; G.copMsg = 'POLICE BEHIND!'; sfx('siren'); }
    if(lead >= at){
      G.cop.i++; G.cop.warned = false;
      const rear = Math.min(...hum.map(r => r.dist));
      for(let k = 0; k < n; k++){
        const p = makeRider({ police: true, name: 'POLICE', color: '#2f6fe0', slot: 20 + k, skill: 1, dist: rear - (9 + k * 3) * SEG, x: k ? 0.5 : -0.5, v: MAXV * 0.95, life: 30, style: 'police' });
        G.riders.push(p);
      }
    }
  }
  if(G.copWarn > 0) G.copWarn -= dt;
  const rear = Math.min(...hum.map(r => r.dist));
  for(let i = G.riders.length - 1; i >= 0; i--){
    const p = G.riders[i]; if(!p.police) continue;
    p.life -= dt;
    if(p.life <= 0 && !p.leaving){ p.leaving = true; if(G.copWarn <= 0){ G.copWarn = 2; G.copMsg = 'THE POLICE GAVE UP!'; } }
    if(p.leaving && p.dist < rear - 30 * SEG) G.riders.splice(i, 1);
  }
}

/* ---------- Ghost (time trial) ---------- */
function ghostKey(){ return 'brawl.ghost.' + G.trackIx + '.' + (G.diff === 'kids' ? 'kids' : 'std'); }
function loadGhost(){
  const g = A.Store.get(ghostKey(), null);
  if(!g || !Array.isArray(g.d) || g.d.length < 30) return null;
  return makeRider({ ghost: true, name: g.n, color: g.c || '#e9ecf1', gt: g.t, gd: g.d, slot: 30, dist: START_Z, style: g.s || 'street' });
}
function stepGhost(r){
  const d = r.gd, f = G.raceT / 0.1, k = Math.floor(f), u = f - k, n = d.length / 3;
  if(G.state !== 'race' && G.state !== 'finishing'){ r.dist = START_Z - 2 * BIKE_L; r.x = 0.12; return; }
  if(k >= n - 1){ r.dist = START_Z + d[(n - 1) * 3] + (G.raceT - (n - 1) * 0.1) * MAXV * 0.5; return; }
  const a = k * 3, b = a + 3;
  r.prevDist = r.dist;
  r.dist = START_Z + d[a] + (d[b] - d[a]) * u; r.x = (d[a + 1] + (d[b + 1] - d[a + 1]) * u) / 1000; r.lean = (d[a + 2] + (d[b + 2] - d[a + 2]) * u) / 100;
  r.v = (d[b] - d[a]) / 0.1;
}
function recordGhosts(){
  if(!G.rec) return;
  const k = Math.floor(G.raceT / 0.1);
  if(k === G.rec.k) return;
  G.rec.k = k;
  for(const r of G.riders) if(r.human && r.fin < 0){
    const a = G.rec.runs[r.id] || (G.rec.runs[r.id] = []);
    while(a.length / 3 <= k) a.push(Math.round(r.dist - START_Z), Math.round(r.x * 1000), Math.round(r.lean * 100));
  }
}

/* ---------- Race flow ---------- */
function bikeFor(slot){
  const own = BIKES.map(b => b.id).filter(id => G.bikes.includes(id));
  if(G.bike === 'mixed') return own[slot % own.length] || 'street';
  return own.includes(G.bike) ? G.bike : 'street';
}
const RIVAL_BIKE = { Brutus: 'cruiser', Zippy: 'street', Crash: 'street', Rosie: 'cafe', Tank: 'cruiser', Moxie: 'scooter', 'Nitro Nell': 'street' };
function setupRace(hs){
  TK = buildTrack(G.trackIx, G.diff); TK.rid = ++G.raceId;
  G.hitCones = new Set(); G.riders = []; G.order = []; G.firstFinish = -1; G.results = null; G.raceT = 0; G.simT = 0; G.copWarn = 0;
  G.tt = G.mode === 'tt' && !G.demo;
  G.rain = !G.demo && !!TK.def.rainy && Math.random() < 0.5;
  G.cop = { ev: copEvents(), i: 0, warned: false };
  const d = D(), total = G.tt ? 0 : G.demo ? 8 : GRIDS[G.gridIx].n;
  const cpuN = total ? Math.max(0, total - hs.length) : 0;
  const grid = [];
  for(let j = 0; j < cpuN; j++){
    const p = RIVALS[j % RIVALS.length];
    grid.push(makeRider({ cpu: true, name: p.name, color: p.color, slot: 10 + j, pers: p, style: RIVAL_BIKE[p.name] || 'street', skill: d.cpu * (p.skill - (d.gentle ? 0.015 * j : 0)) }));
  }
  const mid = cpuN - Math.floor(cpuN / 2);
  hs.forEach((p, i) => grid.splice(Math.min(grid.length, mid + i), 0, makeRider({ human: true, source: p.source, name: p.name, color: p.color, slot: p.slot, skill: 1, style: bikeFor(p.slot) })));
  grid.forEach((r, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    r.dist = START_Z - 250 - row * 760 - col * 220; r.x = (col ? 0.32 : -0.32) + (row % 2 ? 0.14 : -0.14); r.prevDist = r.dist;
    r.stats.worst = i + 1;
  });
  G.riders = grid;
  if(G.tt){ const g = loadGhost(); if(g) G.riders.push(g); G.rec = { k: -1, runs: {} }; } else G.rec = null;
  for(const q of TK.veh) q.pz = undefined;
  trafficAt(TK, 0);
  orderRiders();
}
function startDemo(){
  G.demo = true; G.players = []; G.tt = false;
  const keep = G.trackIx;
  G.trackIx = Math.floor(Math.random() * TRACKS.length);
  setupRace([]);
  G.demoTrack = G.trackIx; G.trackIx = keep;
  for(const r of G.riders){ r.skill = 0.86 + Math.random() * 0.1; r.dist += 12 * SEG; r.v = MAXV * 0.6; }
}
function newRace(players){
  G.demo = false; G.players = players.map(p => ({ source: p.source, name: p.name, color: p.color, slot: p.slot }));
  setupRace(G.players);
  G.state = 'count'; G.stateT = 0;
  A.Menu.close(); A.keepAwake();
  A.toast(G.rain ? 'Rain on ' + TK.def.name + '! Less grip: steer and brake a little earlier.' : TK.def.name + ': ' + TK.def.fact, 3600);
}
function champTracks(){ return TRACKS.map((t, i) => i).filter(i => i < G.unlocked); }
function startChampionship(players){
  G.mode = 'champ'; G.champ = { round: 0, tracks: champTracks(), pts: {}, cols: {}, human: {} };
  G.trackIx = G.champ.tracks[0]; newRace(players);
}
/* Drop-in: someone new presses FIRE mid-race and takes over the last rival's bike (or joins at the back) */
function dropIn(){
  if(G.demo || G.state !== 'race') return;
  const hum = G.riders.filter(r => r.human);
  if(hum.length >= 4) return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.riders.some(r => r.source === s.id)) continue;
    const used = hum.map(r => r.slot), slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.riders.map(r => r.name));
    const cpus = G.order.filter(r => r.cpu && r.fin < 0);
    let r;
    if(cpus.length){ r = cpus[cpus.length - 1]; Object.assign(r, { cpu: false, human: true, pers: null, source: s.id, name, color: A.PLAYER_COLORS[slot], slot, skill: 1, style: bikeFor(slot), invT: 2 }); }
    else {
      const f = camFocus(), base = f ? f.focus : START_Z;
      r = makeRider({ human: true, source: s.id, name, color: A.PLAYER_COLORS[slot], slot, skill: 1, style: bikeFor(slot), dist: base - 200, prevDist: base - 200, x: 0, v: MAXV * 0.7, invT: 2 });
      G.riders.push(r);
    }
    say(r, 'JOINED! GO GO GO', '#3fd07a', 2);
    G.players.push({ source: s.id, name, color: r.color, slot }); G.players.sort((a, b) => a.slot - b.slot);
    S('join');
    return;
  }
}
function sim(dt){
  const running = G.state === 'race' || G.state === 'finishing' || G.demo;
  if(running){ G.raceT += dt; G.simT += dt; }
  for(const q of TK.veh) q.pz = q.z;
  trafficAt(TK, G.simT);
  for(const r of G.riders){ if(r.ghost) stepGhost(r); else stepRider(r, dt); }
  if(running) for(const r of G.riders){ traffic(r); crossings(r); }
  riderCollisions();
  orderRiders();
  if(G.demo){
    const lead = G.order[0];
    if(lead && lead.dist > TK.finish + 50 * SEG){ G.trackIx = (G.demoTrack + 1) % TRACKS.length; const keep = A.Store.get('brawl.track', 0); startDemo(); G.trackIx = keep < G.unlocked ? keep : 0; }
    return;
  }
  policeDirector(dt); keepTogether(); recordGhosts();
  if(G.state === 'race'){
    if(G.raceT > 3) for(const r of G.order){
      if(r.fin >= 0) continue;
      const pl = place(r);
      if(r.lastPlace && pl < r.lastPlace){
        r.stats.passes++; addNitro(r, 10);
        if(r.human){ addScore(r, 150, true); if(r.msgT < 0.5 || /^P\d/.test(r.msg)) say(r, 'P' + pl + '!', '#f5c542', 1); sfx('rival'); }
      }
      r.lastPlace = pl; r.stats.worst = Math.max(r.stats.worst, pl);
    }
    const hum = G.riders.filter(r => r.human), lim = G.tt ? 0 : D().limit;
    if(hum.length && hum.every(r => r.fin >= 0)){ G.state = 'finishing'; G.stateT = 0; }
    else if(lim && G.firstFinish >= 0 && G.raceT - G.firstFinish > lim){ G.state = 'finishing'; G.stateT = 0; }
  }
}

/* ---------- Results, medals, bests, unlocks ---------- */
const AWARD_DEFS = [
  { title: 'Race Winner', stat: p => p.place === 1 && G.results && G.results.rivals ? 1 : 0 },
  { title: 'Overtake King', stat: p => p.stats.overtakes + p.stats.passes, min: 6 },
  { title: 'Takedown Champ', stat: p => p.stats.takedowns, min: 1 },
  { title: 'Cop Stopper', stat: p => p.stats.copBops, min: 1 },
  { title: 'Bump Master', stat: p => p.stats.hits, min: 3 },
  { title: 'Team Player', stat: p => p.stats.rivalHits, min: 4, runnerUp: 'Good Sport' },
  { title: 'Speed Demon', stat: p => Math.round(p.topV), min: 200 },
  { title: 'Near-Miss Ninja', stat: p => p.stats.near, min: 3 },
  { title: 'Iron Guard', stat: p => p.stats.blocks, min: 3 },
  { title: 'Big Air', stat: p => p.stats.air, min: 2 },
  { title: 'Nitro Nut', stat: p => p.stats.nitros, min: 3 },
  { title: 'Comeback Kid', stat: p => p.stats.gained, min: 3 },
  { title: 'Untouchable', stat: p => p.fin >= 0 ? p.stats.falls + p.stats.traffic : 99, low: true, min: 0, all: true },
  { title: 'Clean Racer', stat: p => p.fin >= 0 ? p.stats.swings : 99, low: true, min: 0, all: true }
];
function medalFor(place, time, rivals){
  const kids = G.diff === 'kids';
  if(G.tt){ const par = TRACK_PAR[G.trackIx] * (kids ? 1.25 : G.diff === 'pro' ? 0.97 : 1); return A.Medals.pick(time, { gold: par, silver: par * 1.1 }, true); }
  if(!rivals) return null;
  if(kids) return place <= 2 ? 'gold' : place <= 4 ? 'silver' : 'bronze';
  return place === 1 ? 'gold' : place === 2 ? 'silver' : place === 3 ? 'bronze' : null;
}
/* Time trial par times (the test bot's time on Normal, a little over) */
const TRACK_PAR = [67, 67, 69, 70, 70, 62, 67];
function challengeDone(ch, r, rivals){
  const [k, n] = ch, s = r.stats, pl = place(r);
  switch(k){
    case 'overtakes': return s.overtakes >= n; case 'nofall': return r.fin >= 0 && s.falls === 0; case 'copbop': return s.copBops >= n;
    case 'air': return s.air >= n; case 'nearmiss': return s.near >= n; case 'win': return rivals && r.fin >= 0 && pl === 1;
    case 'podium': return rivals && r.fin >= 0 && pl <= 3; case 'takedowns': return s.takedowns >= n; case 'streak': return r.bestStreak >= n;
    case 'topspeed': return r.topV >= n; case 'blocks': return s.blocks >= n; case 'nitros': return s.nitros >= n;
  }
  return false;
}
function unlockBike(id, notes){ if(!G.bikes.includes(id)){ G.bikes.push(id); A.Store.set('brawl.bikes', G.bikes); notes.push('New bike unlocked: <b>' + BIKES.find(b => b.id === id).label + '</b>!'); sfx('unlock'); } }
function finishRace(){
  G.state = 'podium'; G.stateT = 0;
  for(const r of G.riders) endStreak(r);
  orderRiders();
  const order = G.order, rivals = order.some(r => r.cpu), lead = order[0], t = G.trackIx, def = TRACKS[t];
  const hum = order.filter(r => r.human);
  hum.forEach(r => { r.place = place(r); r.stats.gained = Math.max(0, r.stats.worst - r.place); });
  // position score + challenge bonus
  const chal = A.Store.get('brawl.chal.' + t, 0);
  let newChal = 0;
  for(const r of hum){
    if(r.fin >= 0 && rivals) r.score += PLACE_SCORE[r.place - 1] || 0;
    if(r.fin >= 0 && r.stats.falls === 0) r.score += 1000;
    def.challenges.forEach((ch, i) => { if(challengeDone(ch, r, rivals)){ r.score += 1000; r.stats.chal.push(i); newChal |= 1 << i; } });
  }
  const chalNow = chal | newChal, chalNew = chalNow & ~chal;
  if(chalNew){ A.Store.set('brawl.chal.' + t, chalNow); }
  G.results = { rivals, chal: chalNow, chalNew, notes: [], medal: null, medalImproved: false, bestTime: false, bestScore: false,
    rows: order.map((r, i) => {
      const gap = i === 0 || G.tt ? fmt(r.fin) : r.fin >= 0 ? '+' + (r.fin - lead.fin).toFixed(1) + 's' : 'still riding';
      return { place: i + 1, name: r.name, color: r.color, cpu: !!r.cpu, type: r.pers ? r.pers.type : '', time: r.fin, gap, score: r.human ? r.score : 0, id: r.id, style: r.style };
    }) };
  const res = G.results, notes = res.notes;
  // medals (best over the humans), personal bests
  const fins = hum.filter(r => r.fin >= 0);
  if(fins.length){
    let medal = null; const rank = { gold: 3, silver: 2, bronze: 1 };
    for(const r of fins){ const m = medalFor(r.place, r.fin, rivals); if(m && (!medal || rank[m] > rank[medal])) medal = m; }
    if(medal){ const mr = A.Medals.award(GAME, 'tr' + (t + 1), G.diff, medal); res.medal = medal; res.medalImproved = mr.improved; }
    const bt = Math.min(...fins.map(r => r.fin)), who = fins.find(r => r.fin === bt);
    const rec = A.Celebrate.record(GAME, (G.tt ? 'tt.' : 'time.') + t + '.' + G.diff, bt, true);
    res.bestTime = rec.isNew; res.time = bt; res.timeWho = who.name;
    if(!G.tt){ const bs = Math.max(...hum.map(r => r.score)); const rs = A.Celebrate.record(GAME, 'score.' + t + '.' + G.diff, bs, false); res.bestScore = rs.isNew; res.score = bs; }
    const streak = Math.max(...hum.map(r => r.bestStreak)); if(streak >= 3){ const rs = A.Celebrate.record(GAME, 'streak', Math.round(streak * 10) / 10, false); res.bestStreak = rs.isNew; res.streak = streak; }
    // time trial: family best list and ghost
    if(G.tt){
      const key = 'brawl.tt.' + t + '.' + (G.diff === 'kids' ? 'kids' : 'std'), list = A.Store.get(key, []);
      for(const r of fins) list.push({ n: r.name, t: r.fin });
      list.sort((a, b) => a.t - b.t); A.Store.set(key, list.slice(0, 5));
      const g = A.Store.get(ghostKey(), null);
      if((!g || bt < g.t) && G.rec && G.rec.runs[who.id]){ A.Store.set(ghostKey(), { n: who.name, c: who.color, t: bt, s: who.style, d: G.rec.runs[who.id] }); notes.push('<b>' + A.esc(who.name) + '</b> is the new family ghost on ' + def.name + '!'); }
    }
    // unlocks
    const pod = fins.filter(r => rivals && r.place <= 3);
    if(pod.length && t + 2 > G.unlocked && G.unlocked < TRACKS.length){ G.unlocked = Math.min(TRACKS.length, t + 2); A.Store.set('brawl.unlocked', G.unlocked); notes.push('New track unlocked: <b>' + TRACKS[G.unlocked - 1].name + '</b>!'); sfx('unlock'); }
    if(pod.length){ const pods = A.Store.get('brawl.podiums', []); if(!pods.includes(t)){ pods.push(t); A.Store.set('brawl.podiums', pods); } if(pods.length >= 3) unlockBike('cafe', notes); }
    if(G.diff === 'kids') unlockBike('scooter', notes);
    if(fins.some(r => rivals && r.place === 1)) unlockBike('cruiser', notes);
    if(TRACKS.every((tr, i) => A.Medals.get(GAME, 'tr' + (i + 1)) === 'gold')) unlockBike('gold', notes);
  }
  // championship points
  if(G.mode === 'champ' && G.champ){
    order.forEach((r, i) => { const p = POINTS[i] || 0; G.champ.pts[r.name] = (G.champ.pts[r.name] || 0) + p; G.champ.cols[r.name] = r.color; if(r.human) G.champ.human[r.name] = 1; });
    G.champ.round++;
  }
  // one big celebration (it goes to every online screen too)
  const cols = hum.map(r => r.color).concat(['#ffd45e']);
  if(res.bestTime) A.Celebrate.show({ title: 'NEW BEST!', sub: def.name + ' in ' + fmt(res.time) + (res.medalImproved ? ' · ' + A.Medals.label(res.medal) + ' medal!' : ''), colors: cols });
  else if(res.medalImproved) A.Celebrate.show({ title: A.Medals.label(res.medal).toUpperCase() + ' MEDAL!', sub: def.name + ' · ' + D().label, colors: cols });
  else if(res.bestScore) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Top score ' + res.score.toLocaleString() + ' on ' + def.name, colors: cols });
  else if(res.bestStreak) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Speed streak ' + res.streak.toFixed(1) + ' s', colors: cols });
  else S('win');
}
function awardsHtml(){
  const hum = G.riders.filter(r => r.human);
  if(!hum.length) return '';
  const res = A.Awards.pick(hum, AWARD_DEFS, { max: 3 });
  const tot = k => hum.reduce((a, r) => a + r.stats[k], 0);
  const team = (hum.length > 1 ? 'Family: ' : 'Race: ') + (tot('overtakes') + tot('passes')) + ' overtakes · ' + tot('takedowns') + ' takedowns · ' + tot('near') + ' near misses · top speed ' + Math.round(Math.max(...hum.map(r => r.topV))) + ' km/h';
  return A.Awards.html(res, team);
}
function resultsMenu(){
  G.state = 'results'; sfx('results');
  const def = TK.def, res = G.results;
  const rows = res.rows.map(r => '<b style="color:' + r.color + '">' + r.place + '. ' + A.esc(r.name) + '</b>' + (r.cpu ? ' <span style="opacity:.6">(' + r.type.toLowerCase() + ')</span>' : '') +
    ' · ' + r.gap + (r.score ? ' · <b>' + r.score.toLocaleString() + '</b> pts' : '')).join('<br>');
  let extra = '';
  if(res.medal) extra += '<br><br>' + A.Medals.html(res.medal) + ' <b>' + A.Medals.label(res.medal) + ' medal</b>' + (res.medalImproved ? ' · new!' : '');
  if(res.time) extra += (res.medal ? ' · ' : '<br><br>') + 'best time <b>' + fmt(res.time) + '</b>' + (res.bestTime ? ' · <b>new best!</b>' : '');
  extra += '<br>Challenges: ' + def.challenges.map((ch, i) => (res.chal & (1 << i) ? '✓ ' : '○ ') + CHALLENGE_TEXT[ch[0]](ch[1]) + (res.chalNew & (1 << i) ? ' <b>(new!)</b>' : '')).join(' · ');
  if(res.notes.length) extra += '<br>' + res.notes.join('<br>');
  if(G.tt){ const list = A.Store.get('brawl.tt.' + G.trackIx + '.' + (G.diff === 'kids' ? 'kids' : 'std'), []); if(list.length) extra += '<br>Family best times: ' + list.map((e, i) => (i + 1) + '. ' + A.esc(e.n) + ' ' + fmt(e.t)).join(' · '); }
  extra += '<br><br>' + awardsHtml();
  let items;
  if(G.mode === 'champ' && G.champ){
    const tbl = Object.keys(G.champ.pts).sort((a, b) => G.champ.pts[b] - G.champ.pts[a]).slice(0, 8)
      .map((n, i) => '<b style="color:' + G.champ.cols[n] + '">' + (i + 1) + '. ' + A.esc(n) + '</b> ' + G.champ.pts[n] + ' pts').join(' · ');
    const over = G.champ.round >= G.champ.tracks.length;
    extra += '<br><br><b>Championship after round ' + G.champ.round + ' of ' + G.champ.tracks.length + '</b><br>' + tbl;
    items = over ? [{ label: 'See the champion', select: championMenu }]
      : [{ label: 'Next round: ' + TRACKS[G.champ.tracks[G.champ.round]].name, select: () => { G.trackIx = G.champ.tracks[G.champ.round]; newRace(G.players); } },
         { label: 'Quit championship', select: () => { G.champ = null; hosting() ? openLobby(null) : toTitle(); } }];
  } else {
    const next = (G.trackIx + 1) % G.unlocked;
    items = [
      { label: 'Next track: ' + TRACKS[next].name, select: () => { G.trackIx = next; A.Store.set('brawl.track', G.trackIx); newRace(G.players); } },
      { label: G.tt ? 'Try again' : 'Race again', select: () => newRace(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change riders', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ];
  }
  const w = res.rows[0];
  A.Menu.open({ center: true, shared: true, kicker: def.name + ' · ' + (G.tt ? 'Time trial · ' : '') + D().label + (G.rain ? ' · wet' : ''),
    title: G.tt ? (res.time ? 'Time: ' + fmt(res.time) : 'Time trial') : w.cpu ? A.esc(w.name) + ' wins' : A.esc(w.name) + ' wins!', text: rows + extra, items });
}
function championMenu(){
  const names = Object.keys(G.champ.pts).sort((a, b) => G.champ.pts[b] - G.champ.pts[a]);
  const w = names[0], notes = [];
  G.state = 'champion'; G.stateT = 0; G.champWinner = { name: w, color: G.champ.cols[w] };
  if(G.champ.human[w]){
    unlockBike('neon', notes);
    const best = Math.max(...names.filter(n => G.champ.human[n]).map(n => G.champ.pts[n]));
    const rec = A.Celebrate.record(GAME, 'champ.' + G.diff, best, false);
    A.Celebrate.show({ title: rec.isNew ? 'NEW BEST!' : 'CHAMPION!', sub: w + ' wins the Blacktop Cup with ' + G.champ.pts[w] + ' pts', colors: [G.champ.cols[w], '#ffd45e', '#ffffff'] });
  }
  A.Menu.open({ center: true, shared: true, kicker: 'Blacktop Cup · ' + D().label, title: A.esc(w) + ' is the champion!',
    text: names.slice(0, 8).map((n, i) => '<b style="color:' + G.champ.cols[n] + '">' + (i + 1) + '. ' + A.esc(n) + '</b> ' + G.champ.pts[n] + ' pts').join('<br>') +
      (notes.length ? '<br><br>' + notes.join('<br>') : '') + '<br><br>' + G.champ.tracks.length + ' tracks of traffic, trains, police and pillow-soft punches. Well ridden!',
    items: [
      { label: 'New championship', select: () => startChampionship(G.players) },
      { label: hosting() ? 'Back to room lobby' : 'Change riders', select: () => { G.champ = null; openLobby(null); } },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: () => { G.champ = null; toTitle(); } }])
    ] });
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
function trackLine(i){
  const m = A.Medals.get(GAME, 'tr' + (i + 1)), ch = A.Store.get('brawl.chal.' + i, 0);
  const stars = [0, 1, 2].map(b => ch & (1 << b) ? '★' : '☆').join('');
  return (i + 1) + ' · ' + TRACKS[i].name + ' ' + stars + (m ? ' · ' + A.Medals.label(m) : '');
}
function medalBoard(){
  return TRACKS.map((t, i) => i < G.unlocked ? (A.Medals.html(A.Medals.get(GAME, 'tr' + (i + 1))) || '<span class="medal" style="opacity:.25;border:1px solid currentColor;border-radius:50%"></span>') : '<span title="locked" style="opacity:.6">🔒</span>').join(' ');
}
function titleMenu(start){
  G.state = 'title';
  const mode = G.mode, tt = mode === 'tt', champ = mode === 'champ', def = TRACKS[G.trackIx];
  const touch = A.Input.isTouch;
  A.Menu.open({ kicker: 'xRetro', title: 'BLACKTOP BRAWL', start: start || 0,
    text: 'Chase-cam biker racing with cartoon punch-ups! Weave through traffic, <b>' + (touch ? 'HIT' : 'FIRE') + '</b> punches, <b>down+' + (touch ? 'HIT' : 'FIRE') + '</b> kicks, hold to <b>block</b>, <b>up</b> = nitro. ' +
          '<span class="medal-row">' + medalBoard() + '</span>',
    items: [
      { label: champ ? 'Start the Blacktop Cup' : tt ? 'Start time trial' : 'Race', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Mode', value: () => MODES.find(m => m.id === G.mode).label + (champ ? ' · ' + G.unlocked + ' tracks' : ''), change: d => { const i = MODES.findIndex(m => m.id === G.mode); G.mode = MODES[(i + d + MODES.length) % MODES.length].id; A.Store.set('brawl.mode', G.mode); titleMenu(2); } },
      ...(champ ? [] : [{ label: 'Track', value: () => trackLine(G.trackIx), change: d => { G.trackIx = (G.trackIx + d + G.unlocked) % G.unlocked; A.Store.set('brawl.track', G.trackIx); titleMenu(3); } }]),
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('brawl.diff', G.diff); } },
      ...(tt ? [] : [
        { label: 'Rivals', value: () => GRIDS[G.gridIx].label, change: d => { G.gridIx = (G.gridIx + d + GRIDS.length) % GRIDS.length; A.Store.set('brawl.grid', G.gridIx); } }]),
      { label: 'Bike', value: () => G.bike === 'mixed' ? 'Mixed (' + G.bikes.length + ' of ' + BIKES.length + ')' : BIKES.find(b => b.id === G.bike).label, change: d => { const own = ['mixed'].concat(BIKES.map(b => b.id).filter(id => G.bikes.includes(id))); const i = Math.max(0, own.indexOf(G.bike)); G.bike = own[(i + d + own.length) % own.length]; A.Store.set('brawl.bike', G.bike); } },
      { label: 'Family bests', select: () => bestsMenu(() => titleMenu(0)) },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: bestLine() });
}
function bestLine(){
  const n = A.Input.pads().length, t = G.trackIx;
  const bt = A.Store.get('best.' + GAME + '.' + (G.mode === 'tt' ? 'tt.' : 'time.') + t + '.' + G.diff, null);
  const locked = TRACKS.length - G.unlocked;
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') +
    (bt ? 'Best on ' + TRACKS[t].name + ': ' + fmt(bt) + '. ' : '') + (locked ? locked + ' track' + (locked > 1 ? 's' : '') + ' locked: finish on the podium to unlock the next.' : '');
}
function bestsMenu(back){
  const lines = TRACKS.map((tr, i) => {
    const m = A.Medals.get(GAME, 'tr' + (i + 1));
    const times = DIFF_ORDER.map(d => { const v = A.Store.get('best.' + GAME + '.time.' + i + '.' + d, null); return v ? DIFF[d].label + ' ' + fmt(v) : ''; }).filter(Boolean).join(', ');
    const tt = A.Store.get('brawl.tt.' + i + '.std', [])[0];
    return (i < G.unlocked ? '' : '🔒 ') + (m ? A.Medals.html(m) + ' ' : '') + '<b>' + tr.name + '</b>' + (times ? ' · ' + times : '') + (tt ? ' · time trial: ' + A.esc(tt.n) + ' ' + fmt(tt.t) : '');
  });
  const st = A.Store.get('best.' + GAME + '.streak', null), ch = A.Store.get('best.' + GAME + '.champ.normal', null);
  const nextBike = BIKES.find(b => !G.bikes.includes(b.id));
  A.Menu.open({ center: true, kicker: 'Blacktop Brawl', title: 'Family bests',
    text: lines.join('<br>') + '<br><br>' + (st ? 'Longest speed streak: <b>' + st.toFixed(1) + ' s</b><br>' : '') + (ch ? 'Best Blacktop Cup (Normal): <b>' + ch + ' pts</b><br>' : '') +
      'Bikes: ' + G.bikes.length + ' of ' + BIKES.length + (nextBike ? ' · next: <b>' + nextBike.label + '</b> (' + nextBike.how + ')' : ' · all unlocked!'),
    items: [{ label: 'Back', select: back }], back });
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting(), champ = G.mode === 'champ', tt = G.mode === 'tt';
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + (champ ? 'Blacktop Cup · ' + G.unlocked + ' tracks' : TRACKS[G.trackIx].name) + (tt ? ' · Time trial' : '') + ' · ' + D().label,
    title: 'Who is riding?',
    text: (online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 riders share one screen' + (tt || !GRIDS[G.gridIx].n ? '.' : '; rival riders fill the grid.') + ' More can drop in mid-race by pressing FIRE.') +
          (champ ? '' : '<br><b>' + TRACKS[G.trackIx].name + '</b> challenges: ' + TRACKS[G.trackIx].challenges.map((c, i) => (A.Store.get('brawl.chal.' + G.trackIx, 0) & (1 << i) ? '✓ ' : '○ ') + CHALLENGE_TEXT[c[0]](c[1])).join(' · ')),
    min: 1, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => { if(G.mode === 'champ') startChampionship(players); else newRace(players); },
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
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: TK.def.name + ' · ' + Math.round(progress(G.order[0] || G.riders[0]) * 100) + '%', title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'race'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'race'; }
function toTitle(){
  A.Menu.close(); A.Lobby.close(); A.Mirror.hide(); buf.clear();
  if(G.net) Net.close();
  G.net = null; G.champ = null;
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
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 riders from any mix of devices, all on the same road.',
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
  const t = A.Input.isTouch, F = t ? 'HIT' : 'FIRE';
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to ride',
    text: 'Your bike <b>rides itself</b>. <b>' + (t ? 'Stick left/right' : 'Left/right') + '</b> steers anywhere across the road, <b>down</b> brakes (bends push you wide: brake before the tight ones).<br>' +
          '<b>' + F + '</b> = side punch at whoever is right alongside (hold left or right to pick the side). <b>Down + ' + F + '</b> = kick: shorter reach, bigger shove. <b>Hold ' + F + '</b> = block: hits hardly move you.<br>' +
          '<b>Balance:</b> hits, bumps and slippery patches fill it. Full = dizzy stagger; get hit again while dizzy and you tumble off, then hop straight back on. Attacks have a cooldown, so timing beats button mashing.<br>' +
          '<b>Nitro:</b> earned by clean overtakes, near misses, jumps and good hits. Press <b>up</b> to burn one can (up to 3). No nitro? Holding up tucks you in for a little extra speed.<br>' +
          '<b>Traffic</b> drives in lanes: cars leave gaps, trucks and buses block more, tractors crawl. Level crossings, animals and rocks close the road for a moment: weave through or wait.<br>' +
          '<b>Police</b> chase whoever is causing the most trouble. Dodge them or knock them off (they are tough).<br>' +
          '<b>Points:</b> finishing place, overtakes, near misses, takedowns, speed streaks and air, with combos for chains. Podiums unlock new tracks, wins unlock bikes. Everyone shares one screen: fall way behind and the camera tows you back in.<br>' +
          '<b>Kids mode:</b> nobody falls off, bumps just boing you, slower police, brake help before bends.',
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
const STYLES = ['street', 'scooter', 'cruiser', 'cafe', 'neon', 'gold', 'police'];
function sendSnap(){
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), rt: r2(G.raceT), sm: r3(G.simT), ri: TK.rid, tk: TK.ix, d: G.diff, dm: G.demo ? 1 : 0,
    tt: G.tt ? 1 : 0, rn: G.rain ? 1 : 0, ff: r2(G.firstFinish), cw: r1(G.copWarn), cm: G.copMsg || '', hc: Array.from(G.hitCones),
    r: G.riders.map(r => [r.id, Math.round(r.dist), r3(r.x), Math.round(r.v), r2(r.lean), Math.round(r.h),
      (r.cpu ? 1 : 0) | (r.human ? 2 : 0) | (r.police ? 4 : 0) | (r.ghost ? 8 : 0) | (r.blk ? 16 : 0) | (r.brake ? 32 : 0) | (r.tuck ? 64 : 0) | (r.off ? 128 : 0) | (r.leaving ? 256 : 0),
      Math.round(r.bal), r2(r.stagT), r2(r.fallT), r2(r.invT), r2(r.hitT), r.hitK, r.hitSide, r2(r.atkT), r.atkKind === 'kick' ? 1 : 0, r.atkSide, Math.round(r.nitro), r2(r.nitroT),
      r.fin >= 0 ? r2(r.fin) : -1, r.name, r.color, r.source || '', r.msgT > 0 ? r.msg : '', r2(r.msgT), r.msgCol, r.score, r.mult, r1(r.streak), STYLES.indexOf(r.style), r.slot || 0, r2(r.dustT), r2(r.shake), r.surf]) };
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  Net.broadcast(s);
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!TK || TK.ix !== s.tk || TK.rid !== s.ri || TK.diff !== s.d){ TK = buildTrack(s.tk, s.d); TK.rid = s.ri; parts = []; fxPrev.clear(); }
  const same = a.ri === b.ri;
  G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.tt = !!s.tt; G.rain = !!s.rn; G.firstFinish = s.ff; G.copWarn = s.cw; G.copMsg = s.cm; G.trackIx = s.tk;
  G.raceT = same && a.st === b.st ? L(a.rt, b.rt) : b.rt;
  G.simT = same ? L(a.sm, b.sm) : b.sm;
  G.hitCones = new Set(s.hc || []);
  for(const q of TK.veh) q.pz = q.z;
  trafficAt(TK, G.simT);
  const prev = new Map(a.r.map(q => [q[0], q]));
  G.riders = s.r.map(q => {
    const o = same ? prev.get(q[0]) : null, near = o && Math.abs(o[1] - q[1]) < 3000, f = q[6];
    return { id: q[0], dist: near ? L(o[1], q[1]) : q[1], x: near ? L(o[2], q[2]) : q[2], v: q[3], lean: near ? L(o[4], q[4]) : q[4], h: near ? L(o[5], q[5]) : q[5],
      cpu: !!(f & 1), human: !!(f & 2), police: !!(f & 4), ghost: !!(f & 8), blk: !!(f & 16), brake: !!(f & 32), tuck: !!(f & 64), off: !!(f & 128), leaving: !!(f & 256),
      bal: q[7], stagT: q[8], fallT: q[9], invT: q[10], hitT: q[11], hitK: q[12], hitSide: q[13], atkT: q[14], atkKind: q[15] ? 'kick' : 'punch', atkSide: q[16], nitro: q[17], nitroT: q[18],
      fin: q[19], name: q[20], color: q[21], source: q[22], msg: q[23], msgT: q[24], msgCol: q[25], score: q[26], mult: q[27], streak: q[28], style: STYLES[q[29]] || 'street', slot: q[30], dustT: q[31], shake: q[32], surf: q[33],
      stats: { chal: [] } };
  });
  orderRiders();
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  if(G.demo || G.state === 'title' || G.state === 'lobby' || G.state === 'online') want = A.THEMES.menu;
  else if(G.state === 'podium' || G.state === 'results' || G.state === 'champion') want = PODIUM_THEME;
  else if(TK) want = TK.def.music;
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(G.state === 'paused' || G.state === 'count');
}
function myRiders(){
  const hum = G.riders.filter(r => r.human);
  const mine = hum.filter(r => G.net === 'guest' ? Net.isMine(r.source) : !String(r.source).includes('/'));
  return (mine.length ? mine : hum).sort((a, b) => (a.slot || 0) - (b.slot || 0)).slice(0, 4);
}
function step(dt){
  G.time += dt;
  const racing = G.state === 'race' || G.state === 'count';
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = racing && myRiders().some(r => r.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('HIT'); }
    Net.setPlaying(racing);
    music(); return;
  }
  const wantTouch = racing && G.riders.some(r => r.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('HIT'); }
  music();
  if(Net) Net.setPlaying(racing);
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
      if(G.stateT >= 3){ G.state = 'race'; S('go'); }
      sim(dt); break;
    case 'race':
      if(pausePressed){ pause(); return; }
      dropIn(); sim(dt); break;
    case 'finishing':
      G.stateT += dt; sim(dt);
      if(G.stateT > 2.4) finishRace();
      break;
    case 'podium':
      G.stateT += dt; coolDown(dt);
      if(G.stateT > 5.5 || (G.stateT > 1.5 && A.Input.all().some(s => A.Input.pressed(s, 'fire')))) resultsMenu();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
/* After the flag everyone rolls on slowly */
function coolDown(dt){
  G.simT += dt; trafficAt(TK, G.simT);
  for(const r of G.riders){ r.v = Math.min(r.v, MAXV * 0.45); r.dist += r.v * dt; r.lean *= 0.95; r.atkT = 0; r.blk = false; if(r.fallT > 0){ r.fallT = 0; } }
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
function outlined(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineWidth = Math.max(1, size / 4); c.strokeStyle = 'rgba(8,8,14,.85)'; c.lineJoin = 'round'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
const RGB = new Map();
function rgb(hex){ let v = RGB.get(hex); if(!v){ const n = parseInt(hex.slice(1), 16); v = [n >> 16, n >> 8 & 255, n & 255]; RGB.set(hex, v); } return v; }
function shade(hex, k){ const [r, g, b] = rgb(hex), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
function mix(a, b, t, k){ const A1 = rgb(a), B1 = rgb(b), kk = k || 1; return 'rgb(' + [0, 1, 2].map(i => Math.round(clamp(A1[i] * kk * (1 - t) + B1[i] * t, 0, 255))).join(',') + ')'; }
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
function rr(c, x, y, w, h, r){ r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); }
function quad(c, x1, y1, x2, y2, x3, y3, x4, y4, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4); c.closePath(); c.fill(); }
function star(c, x, y, R, rot){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = rot + i * Math.PI / 5, d = i % 2 ? R * 0.45 : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); c.fill(); }
function burstShape(c, x, y, R, spikes, rot){ c.beginPath(); for(let i = 0; i < spikes * 2; i++){ const a = rot + i * Math.PI / spikes, d = i % 2 ? R * 0.62 : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); }

/* ---------- Colours per track (with distance fog / night / dusk tint) ---------- */
const HY = { dark: '#242021', green: '#328F42', yellow: '#F5E20A', lime: '#B0C936', leaf: '#7BB33B', pale: '#C5DF8A', orange: '#F5981F', deep: '#E95824', gold: '#FFCC00' };
let PAL = null;
function palette(){
  const def = TK.def, key = TK.rid + ':' + G.rain + ':' + def.id;
  if(PAL && PAL.key === key) return PAL;
  const night = def.time === 'night', dusk = def.time === 'dusk';
  const fogC = def.fog || (night ? '#0b1233' : def.haze ? '#f3dcae' : dusk ? '#f7b98a' : '#cfe3f2');
  const maxF = def.fog ? (G.rain ? 0.95 : 0.85) : night ? 0.9 : dusk ? 0.55 : 0.45;
  const dim = night ? (def.snow ? 0.74 : 0.62) : 1, warm = dusk ? rgb('#ff9a5a') : null, fogRGB = rgb(fogC);
  // base colour → (warm dusk tint) → (night dimming) → fog towards the horizon
  const col = (hex, f, k) => {
    const c0 = rgb(hex);
    return 'rgb(' + [0, 1, 2].map(i => { let v = c0[i]; if(warm) v = v * 0.88 + warm[i] * 0.12; v *= k; return Math.round(clamp(v * (1 - f) + fogRGB[i] * f, 0, 255)); }).join(',') + ')';
  };
  const lv = [];
  for(let L = 0; L < 12; L++){
    const f = Math.pow(L / 11, 1.25) * maxF, row = [];
    for(let alt = 0; alt < 2; alt++){
      row.push({
        grass: col(def.ground[alt], f, dim), road: col(def.road[alt], f, dim * (G.rain ? 0.85 : 1)), shoulder: col(def.shoulder, f, dim),
        line: col(def.line, f, night ? 0.85 : 1), rumble: col(def.rumble[alt], f, dim), fogA: f
      });
    }
    lv.push(row);
  }
  PAL = { key, lv, fogC };
  return PAL;
}

/* ---------- Camera: a MotoGP-style chase cam behind the pack ---------- */
const cam = { z: 0, x: 0, back: 1500, h: 850, fov: 50, shake: 0, roll: 0, bg: 0, ok: false, focusV: 0, lastT: 0 };
function focusRiders(){
  if(G.demo){ const o = G.order.length ? G.order : G.riders; return o.length ? [o[Math.min(2, o.length - 1)]] : []; }
  const hum = G.riders.filter(r => r.human);
  return hum.length ? hum : G.order.slice(0, 1);
}
function updateCamera(dt){
  const F = focusRiders(); if(!F.length) return null;
  let focus, lead = -1e9;
  if(!G.demo && F[0].human){ const f = camFocus(); focus = f ? f.focus : F[0].dist; lead = f ? f.lead : F[0].dist; }
  else { focus = F[0].dist; lead = focus; }
  // who is near the focus point decides the lateral aim, the lean and the speed feel
  const near = F.filter(r => r.dist > focus - 400 && r.dist < focus + 14 * SEG);
  const list = near.length ? near : F;
  let ax = 0, lean = 0, v = 0, sh = 0, nit = false;
  for(const r of list){ ax += r.x; lean += r.lean; v += r.v; sh = Math.max(sh, r.shake || 0); if(r.nitroT > 0) nit = true; }
  ax /= list.length; lean /= list.length; v /= list.length;
  // bunched-up pack or thick traffic: the camera pulls in tighter
  let crowd = 0;
  for(const r of G.riders) if(!r.ghost && r.dist > focus - 600 && r.dist < focus + 9 * SEG) crowd++;
  for(const q of TK.veh) if(q.z > focus - 400 && q.z < focus + 9 * SEG) crowd += 0.7;
  const tight = clamp((crowd - 2) / 6, 0, 1), sp = v / MAXV;
  const spread = lead - focus;
  const tBack = 1500 - tight * 330 + clamp(spread / SPREAD_MAX, 0, 1) * 250;
  const tH = 860 - tight * 150 + clamp(spread / SPREAD_MAX, 0, 1) * 150;
  const tFov = 48 + clamp(sp, 0, 1.3) * 9 + (nit ? 6 : 0);
  const k = Math.min(1, dt * 2.5);
  if(!cam.ok){ cam.back = tBack; cam.h = tH; cam.fov = tFov; cam.x = ax; cam.ok = true; }
  cam.back += (tBack - cam.back) * k; cam.h += (tH - cam.h) * k; cam.fov += (tFov - cam.fov) * Math.min(1, dt * 3);
  cam.x += (ax - cam.x) * Math.min(1, dt * 4);
  cam.roll += (-lean * (list.length === 1 && F.length === 1 ? 0.1 : 0) - cam.roll) * Math.min(1, dt * 5);
  const hit = G.riders.some(r => (r.human || G.demo) && (r.hitT > 0.2 || r.fallT > 1.2) && Math.abs(r.dist - focus) < 3 * SEG);
  cam.shake = Math.max(sh * 0.9, sp > 0.92 ? (sp - 0.92) * 1.5 : 0, nit ? 0.18 : 0, hit ? 0.35 : 0);
  cam.focus = focus; cam.focusV = v; cam.sp = sp;
  const seg = segAt(focus);
  cam.bg += seg.curve * sp * dt * 14;
  return cam;
}

/* ---------- Projection ---------- */
const P = [];
for(let i = 0; i < DRAW; i++) P.push({ seg: null, z1: 0, z2: 0, x1: 0, x2: 0, s1: 0, s2: 0, sx1: 0, sy1: 0, w1: 0, sx2: 0, sy2: 0, w2: 0, objs: [] });
const V = { cx: 0, hy: 0, f: 0, fovD: 1, camX: 0, camY: 0, cz0: 0, b: 0, frac: 0, n: 0 };
function project(z, xr, hh){
  const n = Math.floor(z / SEG) - V.b;
  if(n < 0 || n >= V.n) return null;
  const p = P[n], rz = z - V.cz0; if(rz < NEAR) return null;
  const t = clamp((z - (V.b + n) * SEG) / SEG, 0, 1), s = V.fovD / rz;
  const wy = p.seg.y1 + (p.seg.y2 - p.seg.y1) * t, wx = p.x1 + (p.x2 - p.x1) * t + xr * ROADW;
  return { x: V.cx + s * (wx - V.camX) * V.f, y: V.hy - s * (wy + (hh || 0) - V.camY) * V.f, s: s * V.f, n, rz };
}
function drawWorld(c, v){
  const def = TK.def, dt = Math.min(0.05, Math.max(0, G.time - cam.lastT)); cam.lastT = G.time;
  if(!updateCamera(dt || 1 / 60)) return;
  const pal = palette();
  const f = v.h * 0.95, cx = v.x + v.w / 2, hy = v.y + v.h * 0.44;
  V.f = f; V.cx = cx; V.hy = hy; V.fovD = 1 / Math.tan(cam.fov * Math.PI / 180);
  const cz0 = Math.max(0, cam.focus - cam.back), b = Math.floor(cz0 / SEG), frac = (cz0 - b * SEG) / SEG;
  V.cz0 = cz0; V.b = b; V.frac = frac;
  // road centre-line positions ahead of the camera
  let x = 0, dx = -(TK.segs[b].curve * frac), n = 0;
  for(; n < DRAW && b + n < TK.N; n++){
    const seg = TK.segs[b + n], p = P[n];
    p.seg = seg; p.z1 = n * SEG - frac * SEG; p.z2 = p.z1 + SEG; p.x1 = x; p.x2 = x + dx; x += dx; dx += seg.curve; p.objs.length = 0;
  }
  V.n = n;
  // where the camera sits: behind the focus point, following the riders across the road
  const fz = cam.focus, fn = clamp(Math.floor(fz / SEG) - b, 0, n - 1), fp = P[fn], ft = clamp((fz - (b + fn) * SEG) / SEG, 0, 1);
  const roadX = fp.x1 + (fp.x2 - fp.x1) * ft, fy = fp.seg.y1 + (fp.seg.y2 - fp.seg.y1) * ft;
  V.camX = roadX + cam.x * ROADW * 0.8; V.camY = fy + cam.h;
  for(let i = 0; i < n; i++){
    const p = P[i], zz1 = Math.max(NEAR, p.z1), zz2 = Math.max(NEAR + 1, p.z2);
    p.s1 = V.fovD / zz1; p.s2 = V.fovD / zz2;
    p.sx1 = cx + p.s1 * (p.x1 - V.camX) * f; p.sy1 = hy - p.s1 * (p.seg.y1 - V.camY) * f; p.w1 = p.s1 * ROADW * f * p.seg.w;
    p.sx2 = cx + p.s2 * (p.x2 - V.camX) * f; p.sy2 = hy - p.s2 * (p.seg.y2 - V.camY) * f; p.w2 = p.s2 * ROADW * f * (TK.segs[Math.min(TK.N - 1, p.seg.i + 1)].w);
  }
  // road hidden behind a hill crest never needs painting
  let maxy = v.y + v.h + 60;
  for(let i = 0; i < n; i++){ const p = P[i]; p.clip = maxy; if(p.z2 > NEAR && p.sy2 < maxy) maxy = p.sy2; }
  // screen shake and camera roll (the view banks with the bikes)
  c.save();
  if(cam.shake > 0.01){ const a = cam.shake * 2.6; c.translate((rng(Math.floor(G.time * 60)) - 0.5) * a, (rng(Math.floor(G.time * 60) + 7) - 0.5) * a); }
  const pivotY = v.y + v.h * 0.9;
  // (a level canvas draws much faster, so tiny rolls are skipped)
  const roll = Math.abs(cam.roll) > 0.02 ? cam.roll : 0;
  if(roll){ c.translate(cx, pivotY); c.rotate(roll); c.translate(-cx, -pivotY); }
  const m = Math.ceil(Math.abs(roll) * 240) + 3, big = { x: v.x - m, y: v.y - m, w: v.w + 2 * m, h: v.h + 2 * m };
  drawBackdrop(c, big, hy, cam.bg, def);
  c.fillStyle = pal.lv[11][0].grass; c.fillRect(big.x, hy, big.w, big.y + big.h - hy);
  // bucket everything that moves into the segment it is on
  const put = (z, o) => { const k = Math.floor(z / SEG) - b; if(k >= 0 && k < n && z - cz0 > NEAR + 30) P[k].objs.push(o); };
  for(const q of TK.veh) put(q.z, { t: 'veh', q, z: q.z });
  for(const r of G.riders) put(r.dist, { t: 'rider', r, z: r.dist });
  for(const cr of TK.cross){
    if(cr.z < cz0 || cr.z > cz0 + n * SEG) continue;
    if(cr.k === 'train'){ put(cr.z + 40, { t: 'train', cr, z: cr.z + 40 }); continue; }
    for(let j = 0; j < cr.n; j++){ const xx = crossX(cr, G.simT, j); if(xx !== null) put(cr.z + (j % 2) * 180, { t: 'cross', cr, j, x: xx, z: cr.z + (j % 2) * 180 }); }
  }
  for(let i = n - 1; i >= 0; i--){
    const p = P[i];
    if(p.z2 <= NEAR) continue;
    const L = Math.min(11, Math.floor(i / n * 12));
    if(p.sy2 < p.clip - 0.05 || p.sy1 < p.clip - 0.05) drawSegment(c, big, p, def, pal.lv[L][p.seg.color], i);
    drawSegmentExtras(c, big, p, def, pal.lv[L][p.seg.color]);
    const fogA = pal.lv[L][0].fogA;
    if(fogA > 0.25) c.globalAlpha = Math.max(0.15, 1 - fogA * 0.9);
    for(const spr of p.seg.sprites) drawSprite(c, big, p, spr, def);
    for(const h of p.seg.haz) if(h.z >= (b + i) * SEG && h.z < (b + i + 1) * SEG) drawHazard(c, p, h, def);
    c.globalAlpha = 1;
    if(p.objs.length){
      p.objs.sort((a1, b1) => b1.z - a1.z);
      for(const o of p.objs){
        // anything between the camera and the riders it follows would fill the screen: fade it, skip the closest
        const rz = o.z - cz0, close = rz < cam.back - 250 && !(o.t === 'rider' && o.r.human);
        if(close && (o.t === 'veh' || o.t === 'rider')){ if(rz < cam.back * 0.6) continue; c.globalAlpha = 0.45; }
        if(o.t === 'veh'){ const pr = project(o.q.z, o.q.x, 0); if(pr) drawVehicle(c, o.q, pr.x, pr.y, pr.s); }
        else if(o.t === 'rider'){ const r = o.r, pr = project(r.dist, r.x, r.h); if(pr){ const gr = r.h > 1 ? project(r.dist, r.x, 0) : pr; drawRider(c, r, pr.x, pr.y, pr.s, gr ? gr.y : pr.y); } }
        else if(o.t === 'cross'){ const pr = project(o.z, o.x, 0); if(pr) drawCrosser(c, o.cr, o.j, pr.x, pr.y, pr.s); }
        else if(o.t === 'train') drawTrain(c, o.cr, p);
        c.globalAlpha = 1;
      }
    }
  }
  drawParticles(c);
  weather(c, big, hy, def);
  c.restore();
  speedLines(c, v);
}

/* ---------- Road ---------- */
function drawSegment(c, v, p, def, col, n){
  const seg = p.seg, y1 = p.sy1, y2 = p.sy2;
  const top = Math.min(y1, y2), bot = Math.max(y1, y2);
  const bridge = seg.w < 0.99;
  c.fillStyle = bridge && seg.flags.bridge ? (def.biome === 'mountain' ? '#3a3f4a' : def.biome === 'tundra' ? '#9fb8d0' : '#2f7fb8') : col.grass;
  c.fillRect(v.x, top, v.w, bot - top + 1);
  if(bridge && seg.flags.bridge && seg.color){ c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(v.x, top, v.w, Math.max(0.5, (bot - top) * 0.3)); }
  const w1 = p.w1, w2 = p.w2;
  // shoulders and rumble strips
  // shoulders, kerbs and road as three nested quads (each paints over the middle of the one before)
  if(!bridge || !seg.flags.bridge) quad(c, p.sx1 - w1 * 1.35, y1, p.sx1 + w1 * 1.35, y1, p.sx2 + w2 * 1.35, y2, p.sx2 - w2 * 1.35, y2, col.shoulder);
  quad(c, p.sx1 - w1 * 1.07, y1, p.sx1 + w1 * 1.07, y1, p.sx2 + w2 * 1.07, y2, p.sx2 - w2 * 1.07, y2, col.rumble);
  quad(c, p.sx1 - w1, y1, p.sx1 + w1, y1, p.sx2 + w2, y2, p.sx2 - w2, y2, bridge && seg.flags.bridge && def.biome === 'jungle' ? (seg.color ? '#8a6a44' : '#7c5f3c') : col.road);
  // edge and lane lines (far away they are thinner than a pixel: skip them)
  const e1 = w1 * 0.02, e2 = w2 * 0.02;
  if(e1 > 0.12){
    quad(c, p.sx1 - w1, y1, p.sx1 - w1 + e1, y1, p.sx2 - w2 + e2, y2, p.sx2 - w2, y2, col.line);
    quad(c, p.sx1 + w1, y1, p.sx1 + w1 - e1, y1, p.sx2 + w2 - e2, y2, p.sx2 + w2, y2, col.line);
  }
  if(seg.color && e1 > 0.1){
    const lines = seg.w < 0.8 ? [0] : [-0.5, 0, 0.5];
    for(const lx of lines){
      const k = lx / seg.w, a1 = p.sx1 + w1 * k, a2 = p.sx2 + w2 * k, h1 = w1 * 0.012 / seg.w, h2 = w2 * 0.012 / seg.w;
      quad(c, a1 - h1, y1, a1 + h1, y1, a2 + h2, y2, a2 - h2, y2, col.line);
    }
  }
  // patches painted on the road: oil, sand, ice, rough
  for(const h of seg.haz){
    const pk = h.k === 'oil' || h.k === 'sand' || h.k === 'ice' || h.k === 'rough';
    if(!pk) continue;
    const segZ = seg.i * SEG;
    if(h.z > segZ + SEG || h.z + h.len < segZ) continue;
    const u1 = (h.x - h.w) / seg.w, u2 = (h.x + h.w) / seg.w;
    const edge = (segZ < h.z + 2 * SEG) || (segZ > h.z + h.len - 2 * SEG);
    const shrink = edge ? 0.7 : 1, mid = (u1 + u2) / 2, hw = (u2 - u1) / 2 * shrink;
    const colr = h.k === 'oil' ? (seg.color ? '#1d1a26' : '#262233') : h.k === 'sand' ? (seg.color ? '#e3c989' : '#d9bd7c') : h.k === 'ice' ? (seg.color ? '#cfe8fb' : '#bfdcf3') : (seg.color ? shade(TK.def.road[0], 0.75) : shade(TK.def.road[1], 0.68));
    quad(c, p.sx1 + w1 * (mid - hw), y1, p.sx1 + w1 * (mid + hw), y1, p.sx2 + w2 * (mid + hw), y2, p.sx2 + w2 * (mid - hw), y2, colr);
    if(h.k === 'oil' && seg.color){ c.globalAlpha = 0.35; quad(c, p.sx1 + w1 * (mid - hw * 0.3), y1, p.sx1 + w1 * (mid + hw * 0.1), y1, p.sx2 + w2 * (mid + hw * 0.1), y2, p.sx2 + w2 * (mid - hw * 0.3), y2, '#9b7bff'); c.globalAlpha = 1; }
    if(h.k === 'ice' && seg.i % 3 === 0){ c.globalAlpha = 0.7; quad(c, p.sx1 + w1 * (mid - hw * 0.6), y1, p.sx1 + w1 * (mid - hw * 0.5), y1, p.sx2 + w2 * (mid + hw * 0.2), y2, p.sx2 + w2 * (mid + hw * 0.1), y2, '#ffffff'); c.globalAlpha = 1; }
    if(h.k === 'sand' && seg.i % 2 === 0){ quad(c, p.sx1 + w1 * (mid - hw * 0.8), y1, p.sx1 + w1 * (mid + hw * 0.8), y1, p.sx1 + w1 * (mid + hw * 0.8), y1 - Math.max(0.4, (y1 - y2) * 0.15), p.sx1 + w1 * (mid - hw * 0.8), y1 - Math.max(0.4, (y1 - y2) * 0.15), '#c9a868'); }
  }
  // wet road shine
  if(G.rain && seg.color){ c.globalAlpha = 0.1; quad(c, p.sx1 - w1 * 0.25, y1, p.sx1 + w1 * 0.25, y1, p.sx2 + w2 * 0.25, y2, p.sx2 - w2 * 0.25, y2, '#cfe6ff'); c.globalAlpha = 1; }
  // start and finish lines: chequered bands
  if(seg.i === 30 || seg.i === TK.finishSeg){
    const rows = 2, cols = 16;
    for(let r = 0; r < rows; r++) for(let k = 0; k < cols; k++){
      if((r + k) % 2) continue;
      const ya = y1 + (y2 - y1) * (r / rows), yb = y1 + (y2 - y1) * ((r + 1) / rows);
      const sa = p.sx1 + (p.sx2 - p.sx1) * (r / rows), wa = w1 + (w2 - w1) * (r / rows), sb = p.sx1 + (p.sx2 - p.sx1) * ((r + 1) / rows), wb = w1 + (w2 - w1) * ((r + 1) / rows);
      const u0 = -1 + 2 * k / cols, u1 = -1 + 2 * (k + 1) / cols;
      quad(c, sa + wa * u0, ya, sa + wa * u1, ya, sb + wb * u1, yb, sb + wb * u0, yb, '#f4f1ea');
    }
  }
}
/* Vertical surfaces: bridge rails, tunnel walls, the jungle canopy */
function wallQuad(c, p, u, hWorld, col, u2){
  const ub = u2 === undefined ? u : u2;
  const bx1 = p.sx1 + p.w1 * u, bx2 = p.sx2 + p.w2 * ub, t1 = p.sy1 - hWorld * p.s1 * V.f, t2 = p.sy2 - hWorld * p.s2 * V.f;
  quad(c, bx1, p.sy1, bx2, p.sy2, bx2, t2, bx1, t1, col);
  return [bx1, t1, bx2, t2];
}
function drawSegmentExtras(c, v, p, def, col){
  const seg = p.seg, alt = seg.color;
  if(seg.flags.tunnel){
    const H = 1600;
    const L = wallQuad(c, p, -1.4, H, alt ? '#6b6158' : '#62584f'), R = wallQuad(c, p, 1.4, H, alt ? '#6b6158' : '#62584f');
    quad(c, L[0], L[1], R[0], R[1], R[2], R[3], L[2], L[3], alt ? '#3d3630' : '#37302b');
    if(seg.i % 8 === 0 && p.z1 > 400){ c.fillStyle = '#fff1b0'; const lx = (L[0] + R[0]) / 2, ly = (L[1] + R[1]) / 2 + 1; rr(c, lx - p.w1 * 0.3, ly, p.w1 * 0.6, Math.max(1, p.w1 * 0.04), 1); c.fill(); }
    const prev = TK.segs[Math.max(0, seg.i - 1)];
    if(!prev.flags.tunnel){
      const top = p.sy1 - H * p.s1 * V.f, lx = p.sx1 - p.w1 * 1.4, rx = p.sx1 + p.w1 * 1.4;
      c.fillStyle = '#7d7568'; c.fillRect(v.x, v.y, v.w, top - v.y); c.fillRect(v.x, top, lx - v.x, p.sy1 - top); c.fillRect(rx, top, v.x + v.w - rx, p.sy1 - top);
      c.fillStyle = '#5f584d'; c.fillRect(v.x, top - p.w1 * 0.1, v.w, p.w1 * 0.1);
      c.fillStyle = '#e9ecf1'; for(let k = -1; k < 2; k++) { c.beginPath(); c.moveTo(v.x + v.w * (0.3 + k * 0.4), top - p.w1 * 0.1); c.lineTo(v.x + v.w * (0.5 + k * 0.4), top - p.w1 * 0.9); c.lineTo(v.x + v.w * (0.7 + k * 0.4), top - p.w1 * 0.1); c.fill(); }
    }
    return;
  }
  if(seg.flags.canopy){
    // leafy arches over the road, with light breaking through
    const H = 2200;
    if(seg.i % 6 === 0 && p.z1 < 90 * SEG){
      const L = wallQuad(c, p, -1.6, H, alt ? '#1f5a2e' : '#1b5028'), R = wallQuad(c, p, 1.6, H, alt ? '#1f5a2e' : '#1b5028');
      c.fillStyle = alt ? '#246b35' : '#1f5e2e';
      c.beginPath(); c.moveTo(L[0], L[1]); c.quadraticCurveTo((L[0] + R[0]) / 2, L[1] - (R[0] - L[0]) * 0.18, R[0], R[1]); c.lineTo(R[2], R[3]); c.quadraticCurveTo((L[2] + R[2]) / 2, L[3] - (R[2] - L[2]) * 0.18, L[2], L[3]); c.fill();
      if(seg.i % 12 === 0){ c.strokeStyle = '#2f8a3e'; c.lineWidth = Math.max(0.5, p.w1 * 0.02); c.beginPath(); c.moveTo((L[0] + R[0]) / 2 - p.w1 * 0.3, L[1] - (R[0] - L[0]) * 0.1); c.quadraticCurveTo((L[0] + R[0]) / 2 - p.w1 * 0.2, L[1] + p.w1 * 0.25, (L[0] + R[0]) / 2 - p.w1 * 0.25, L[1] + p.w1 * 0.5); c.stroke(); }
    }
  }
  if(seg.w < 0.99 && seg.flags.bridge){
    const railC = def.biome === 'jungle' ? '#6b4a2e' : '#b8bec8';
    wallQuad(c, p, -1.04, 200, alt ? railC : shade(railC, 0.85)); wallQuad(c, p, 1.04, 200, alt ? railC : shade(railC, 0.85));
    if(seg.i % 4 === 0){ wallQuad(c, p, -1.06, 420, '#6f7482', -1.04); wallQuad(c, p, 1.06, 420, '#6f7482', 1.04); }
  }
}

/* ---------- Roadside boards (drawn once, then scaled) ---------- */
const boardCache = new Map();
function drawLogo(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s, s);
  const g = c.createLinearGradient(-26, -30, 26, 30); g.addColorStop(0, HY.lime); g.addColorStop(0.55, HY.leaf); g.addColorStop(1, HY.green);
  c.fillStyle = 'rgba(0,0,0,.25)'; circ(c, 2, 3, 38); c.fill();
  c.fillStyle = g; circ(c, 0, 0, 38); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.8; circ(c, 0, 0, 34.5); c.stroke();
  c.font = '600 13px ' + SANS; c.fillStyle = HY.dark; c.textAlign = 'center'; c.textBaseline = 'middle';
  const word = 'HUMBLE', span = 1.25;
  for(let i = 0; i < word.length; i++){ const a = -Math.PI / 2 - span / 2 + span * (i + 0.5) / word.length; c.save(); c.translate(Math.cos(a) * 26, Math.sin(a) * 26); c.rotate(a + Math.PI / 2); c.fillText(word[i], 0, 0); c.restore(); }
  c.save(); c.rotate(-0.1);
  c.font = 'italic 600 30px ' + SANS; c.lineJoin = 'round';
  const og = c.createLinearGradient(0, -18, 0, 16); og.addColorStop(0, HY.yellow); og.addColorStop(0.5, HY.orange); og.addColorStop(1, HY.deep);
  c.strokeStyle = og; c.lineWidth = 9; c.strokeText('Yeti', 0, 8);
  c.fillStyle = HY.dark; c.fillText('Yeti', 2, 10);
  c.strokeStyle = HY.dark; c.lineWidth = 2.2; c.strokeText('Yeti', 1.2, 9);
  c.fillStyle = '#ffffff'; c.fillText('Yeti', 0, 8);
  c.restore(); c.restore();
}
function boardImg(kind){
  let cv = boardCache.get(kind); if(cv) return cv;
  cv = document.createElement('canvas'); cv.width = 256; cv.height = 88;
  const c = cv.getContext('2d');
  rr(c, 2, 2, 252, 84, 10);
  if(kind === 'HUMBLE YETI'){
    const g = c.createLinearGradient(0, 0, 0, 88); g.addColorStop(0, '#3aa04c'); g.addColorStop(1, HY.green);
    c.fillStyle = g; c.fill(); c.lineWidth = 4; c.strokeStyle = '#ffffff'; c.stroke();
    drawLogo(c, 46, 44, 0.98);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.font = '700 27px ' + SANS; c.lineWidth = 5; c.strokeStyle = HY.dark; c.lineJoin = 'round'; c.strokeText('HUMBLE YETI', 94, 32); c.fillStyle = HY.yellow; c.fillText('HUMBLE YETI', 94, 32);
    c.font = '600 18px ' + SANS; c.fillStyle = '#ffffff'; c.fillText('humbleyeti.com', 96, 62);
  } else {
    const look = { BLACKTOP: ['#17181d', '#ff9f43', '#f4efe2'], XRETRO: ['#17181d', '#ff5a4e', '#7fe3ff'], 'ZOOM COLA': ['#d9343a', '#ffffff', '#ffd166'], 'MOTO MART': ['#2f6fe0', '#f5c542', '#ffffff'] }[kind] || ['#f5c542', '#17181d', '#17181d'];
    c.fillStyle = look[0]; c.fill(); c.lineWidth = 4; c.strokeStyle = look[2]; c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 40px ' + SANS; c.fillStyle = look[1];
    let size = 40; while(size > 12 && c.measureText(kind).width > 220){ size -= 2; c.font = '700 ' + size + 'px ' + SANS; }
    c.fillText(kind, 128, 46);
    if(kind === 'ZOOM COLA'){ c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 72); c.bezierCurveTo(80, 60, 170, 84, 236, 70); c.stroke(); }
  }
  boardCache.set(kind, cv);
  return cv;
}

/* ---------- Scenery ---------- */
function drawSprite(c, v, p, spr, def){
  const s = p.s1 * V.f;
  if(s * 2000 < 1.5) return;
  const x = p.sx1 + s * ROADW * spr.x, y = p.sy1, dusk = def.time === 'dusk', night = def.time === 'night';
  if(x < v.x - s * 5000 || x > v.x + v.w + s * 5000) return;
  const leaf = night ? '#1c3b2c' : dusk ? '#4f7a36' : '#3a8a3a', leaf2 = night ? '#24492f' : dusk ? '#628a3e' : '#4fa446';
  switch(spr.kind){
    case 'tree': { const h = 1900 * s, r = 720 * s; c.fillStyle = '#6b4a2e'; c.fillRect(x - 70 * s, y - h * 0.55, 140 * s, h * 0.55); c.fillStyle = leaf; circ(c, x, y - h * 0.7, r); c.fill(); circ(c, x - r * 0.6, y - h * 0.55, r * 0.7); c.fill(); circ(c, x + r * 0.6, y - h * 0.58, r * 0.7); c.fill(); c.fillStyle = leaf2; circ(c, x - r * 0.25, y - h * 0.8, r * 0.55); c.fill(); break; }
    case 'bush': { c.fillStyle = leaf; circ(c, x, y - 200 * s, 320 * s); c.fill(); circ(c, x + 280 * s, y - 150 * s, 240 * s); c.fill(); break; }
    case 'pine': case 'snowpine': {
      const h = 2500 * s, w = 820 * s; c.fillStyle = '#4a3322'; c.fillRect(x - 60 * s, y - h * 0.2, 120 * s, h * 0.2);
      for(let k = 0; k < 3; k++){ c.fillStyle = spr.kind === 'snowpine' ? (k % 2 ? '#1f4a3a' : '#25584a') : k % 2 ? '#1f5a2e' : '#256b35'; c.beginPath(); const yb = y - h * (0.15 + k * 0.25), yt = yb - h * 0.45, ww = w * (1 - k * 0.22); c.moveTo(x - ww, yb); c.lineTo(x, yt); c.lineTo(x + ww, yb); c.closePath(); c.fill();
        if(spr.kind === 'snowpine'){ c.fillStyle = '#eef4fb'; c.beginPath(); c.moveTo(x - ww * 0.45, yt + (yb - yt) * 0.45); c.lineTo(x, yt); c.lineTo(x + ww * 0.45, yt + (yb - yt) * 0.45); c.closePath(); c.fill(); } }
      break;
    }
    case 'palm': case 'jtree': {
      const h = (spr.kind === 'jtree' ? 3000 : 2300) * s, lean = (spr.x < 0 ? -1 : 1) * 300 * s;
      c.strokeStyle = dusk ? '#6a4a30' : '#8a6038'; c.lineWidth = Math.max(1, 120 * s); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x, y - h * 0.6, x + lean, y - h); c.stroke();
      c.strokeStyle = spr.kind === 'jtree' ? '#1f6a33' : dusk ? '#3f7a3a' : '#2f9e44'; c.lineWidth = Math.max(1, 150 * s); c.lineCap = 'round';
      for(let i = 0; i < 7; i++){ const a = -Math.PI / 2 + (i - 3) * 0.5, L = (spr.kind === 'jtree' ? 1300 : 900) * s; c.beginPath(); c.moveTo(x + lean, y - h); c.quadraticCurveTo(x + lean + Math.cos(a) * L * 0.7, y - h + Math.sin(a) * L * 0.5 - 200 * s, x + lean + Math.cos(a) * L, y - h + 300 * s); c.stroke(); }
      c.lineCap = 'butt';
      if(spr.kind === 'jtree'){ c.strokeStyle = '#2f7a3a'; c.lineWidth = Math.max(0.5, 30 * s); c.beginPath(); c.moveTo(x + lean * 0.5, y - h * 0.8); c.quadraticCurveTo(x + lean * 0.5 + 200 * s, y - h * 0.5, x + lean * 0.5 + 60 * s, y - h * 0.3); c.stroke(); }
      break;
    }
    case 'fence': { c.fillStyle = '#9a7650'; for(let k = -1; k <= 1; k++) c.fillRect(x + k * 350 * s - 25 * s, y - 380 * s, 50 * s, 380 * s); c.fillRect(x - 400 * s, y - 330 * s, 800 * s, 40 * s); c.fillRect(x - 400 * s, y - 180 * s, 800 * s, 40 * s); break; }
    case 'cow': {
      const w = 700 * s, h = 380 * s, bob = Math.sin(G.time * 2 + spr.x) * 10 * s;
      c.fillStyle = '#f4f1ea'; rr(c, x - w / 2, y - h - 250 * s, w, h, 90 * s); c.fill();
      c.fillStyle = '#2a2a30'; circ(c, x - w * 0.15, y - h - 150 * s, 90 * s); c.fill(); circ(c, x + w * 0.2, y - h - 60 * s, 70 * s); c.fill();
      c.fillRect(x - w * 0.4, y - 260 * s, 60 * s, 260 * s); c.fillRect(x + w * 0.32, y - 260 * s, 60 * s, 260 * s);
      c.fillStyle = '#f4f1ea'; rr(c, x + w * 0.4, y - h - 200 * s + bob, 220 * s, 180 * s, 60 * s); c.fill(); c.fillStyle = '#f0a0a8'; rr(c, x + w * 0.52, y - h - 100 * s + bob, 110 * s, 80 * s, 30 * s); c.fill();
      break;
    }
    case 'hay': case 'bale': { c.fillStyle = '#e9c35a'; circ(c, x, y - 320 * s, 330 * s); c.fill(); c.strokeStyle = '#c9a03f'; c.lineWidth = Math.max(0.5, 30 * s); circ(c, x, y - 320 * s, 200 * s); c.stroke(); circ(c, x, y - 320 * s, 90 * s); c.stroke(); break; }
    case 'barn': { const w = 2000 * s, h = 1400 * s; c.fillStyle = '#b83a32'; c.fillRect(x - w / 2, y - h, w, h); c.fillStyle = '#5a3a2a'; c.beginPath(); c.moveTo(x - w * 0.58, y - h); c.lineTo(x, y - h - 700 * s); c.lineTo(x + w * 0.58, y - h); c.fill(); c.strokeStyle = '#f4efe2'; c.lineWidth = Math.max(0.5, 50 * s); c.strokeRect(x - w * 0.2, y - h * 0.7, w * 0.4, h * 0.7); c.beginPath(); c.moveTo(x - w * 0.2, y - h * 0.7); c.lineTo(x + w * 0.2, y); c.moveTo(x + w * 0.2, y - h * 0.7); c.lineTo(x - w * 0.2, y); c.stroke(); break; }
    case 'shack': { const w = 1500 * s, h = 1000 * s; c.fillStyle = spr.col || '#3fd0b0'; c.fillRect(x - w / 2, y - h, w, h); c.fillStyle = '#f4efe2'; c.fillRect(x - w * 0.55, y - h - 160 * s, w * 1.1, 160 * s); for(let k = 0; k < 5; k++){ c.fillStyle = k % 2 ? '#ff5a4e' : '#f4efe2'; c.fillRect(x - w * 0.55 + k * w * 0.22, y - h - 60 * s, w * 0.22, 200 * s); } c.fillStyle = night || dusk ? '#ffd98a' : '#5a7fa0'; c.fillRect(x - w * 0.3, y - h * 0.65, w * 0.6, h * 0.3); break; }
    case 'umbrella': { c.fillStyle = '#f4efe2'; c.fillRect(x - 20 * s, y - 900 * s, 40 * s, 900 * s); c.fillStyle = spr.col; c.beginPath(); c.moveTo(x - 600 * s, y - 800 * s); c.quadraticCurveTo(x, y - 1250 * s, x + 600 * s, y - 800 * s); c.fill(); break; }
    case 'lifeguard': { c.fillStyle = '#e9ecf1'; c.fillRect(x - 350 * s, y - 900 * s, 50 * s, 900 * s); c.fillRect(x + 300 * s, y - 900 * s, 50 * s, 900 * s); c.fillStyle = '#e2463c'; c.fillRect(x - 450 * s, y - 1600 * s, 900 * s, 700 * s); c.fillStyle = '#f4efe2'; c.fillRect(x - 450 * s, y - 1300 * s, 900 * s, 120 * s); break; }
    case 'rock': { c.fillStyle = def.biome === 'desert' ? '#b9774a' : '#8a8f96'; c.beginPath(); c.moveTo(x - 500 * s, y); c.lineTo(x - 350 * s, y - 500 * s); c.lineTo(x + 100 * s, y - 650 * s); c.lineTo(x + 480 * s, y - 250 * s); c.lineTo(x + 520 * s, y); c.fill(); c.fillStyle = 'rgba(255,255,255,.15)'; c.beginPath(); c.moveTo(x - 350 * s, y - 500 * s); c.lineTo(x + 100 * s, y - 650 * s); c.lineTo(x, y - 300 * s); c.fill(); break; }
    case 'post': { c.fillStyle = '#e9ecf1'; c.fillRect(x - 40 * s, y - 500 * s, 80 * s, 500 * s); c.fillStyle = '#e2463c'; c.fillRect(x - 40 * s, y - 460 * s, 80 * s, 90 * s); break; }
    case 'cactus': { c.fillStyle = '#4f9a4a'; rr(c, x - 110 * s, y - 1500 * s, 220 * s, 1500 * s, 100 * s); c.fill(); rr(c, x - 420 * s, y - 1100 * s, 160 * s, 500 * s, 80 * s); c.fill(); c.fillRect(x - 420 * s, y - 700 * s, 330 * s, 140 * s); rr(c, x + 260 * s, y - 1300 * s, 160 * s, 600 * s, 80 * s); c.fill(); c.fillRect(x + 90 * s, y - 800 * s, 330 * s, 140 * s); break; }
    case 'mesa': { const w = 4000 * s, h = 1800 * s; c.fillStyle = '#c4683f'; c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w * 0.36, y - h); c.lineTo(x + w * 0.36, y - h); c.lineTo(x + w / 2, y); c.fill(); c.fillStyle = '#a8552f'; c.fillRect(x - w * 0.4, y - h * 0.55, w * 0.8, 120 * s); break; }
    case 'windpump': { c.strokeStyle = '#6f7482'; c.lineWidth = Math.max(0.5, 50 * s); c.beginPath(); c.moveTo(x - 300 * s, y); c.lineTo(x, y - 2200 * s); c.lineTo(x + 300 * s, y); c.stroke(); const a = G.time * 3; for(let k = 0; k < 8; k++){ const aa = a + k * Math.PI / 4; c.beginPath(); c.moveTo(x, y - 2200 * s); c.lineTo(x + Math.cos(aa) * 500 * s, y - 2200 * s + Math.sin(aa) * 500 * s); c.stroke(); } break; }
    case 'fern': { c.strokeStyle = '#2f8a3e'; c.lineWidth = Math.max(0.5, 90 * s); c.lineCap = 'round'; for(let k = 0; k < 5; k++){ const a = -Math.PI / 2 + (k - 2) * 0.5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * 300 * s, y + Math.sin(a) * 500 * s, x + Math.cos(a) * 600 * s, y + Math.sin(a) * 350 * s); c.stroke(); } c.lineCap = 'butt'; break; }
    case 'banana': { c.fillStyle = '#6b4a2e'; c.fillRect(x - 60 * s, y - 1200 * s, 120 * s, 1200 * s); c.fillStyle = '#3fae4a'; for(let k = 0; k < 4; k++){ c.beginPath(); c.ellipse(x + (k % 2 ? 1 : -1) * 350 * s, y - 1200 * s - k * 60 * s, 450 * s, 140 * s, (k % 2 ? 1 : -1) * 0.4, 0, Math.PI * 2); c.fill(); } c.fillStyle = '#f5d33a'; circ(c, x + 80 * s, y - 1050 * s, 90 * s); c.fill(); break; }
    case 'ruin': { c.fillStyle = '#8f9a7a'; c.fillRect(x - 700 * s, y - 1400 * s, 1400 * s, 1400 * s); c.fillStyle = '#6f7a5a'; c.fillRect(x - 250 * s, y - 800 * s, 500 * s, 800 * s); c.fillStyle = '#3f8a3a'; c.fillRect(x - 700 * s, y - 1450 * s, 1400 * s, 150 * s); c.fillRect(x + 300 * s, y - 1300 * s, 100 * s, 700 * s); break; }
    case 'acacia': { c.strokeStyle = '#5a3a22'; c.lineWidth = Math.max(0.5, 100 * s); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 1300 * s); c.lineTo(x - 400 * s, y - 1900 * s); c.moveTo(x, y - 1300 * s); c.lineTo(x + 450 * s, y - 1900 * s); c.stroke(); c.fillStyle = dusk ? '#6f7a2e' : '#7f8a3a'; c.beginPath(); c.ellipse(x, y - 2000 * s, 1100 * s, 260 * s, 0, 0, Math.PI * 2); c.fill(); break; }
    case 'mound': { c.fillStyle = '#b07a42'; c.beginPath(); c.moveTo(x - 350 * s, y); c.quadraticCurveTo(x - 200 * s, y - 1500 * s, x, y - 1600 * s); c.quadraticCurveTo(x + 200 * s, y - 1500 * s, x + 350 * s, y); c.fill(); break; }
    case 'tuft': { c.strokeStyle = '#d9b860'; c.lineWidth = Math.max(0.5, 40 * s); for(let k = -3; k <= 3; k++){ c.beginPath(); c.moveTo(x + k * 40 * s, y); c.lineTo(x + k * 110 * s, y - (350 - Math.abs(k) * 40) * s); c.stroke(); } break; }
    case 'hut': { const w = 1300 * s; c.fillStyle = '#c9955b'; c.fillRect(x - w / 2, y - 800 * s, w, 800 * s); c.fillStyle = '#8a6a3a'; c.beginPath(); c.moveTo(x - w * 0.7, y - 800 * s); c.lineTo(x, y - 1500 * s); c.lineTo(x + w * 0.7, y - 800 * s); c.fill(); c.fillStyle = '#3a2a1a'; c.fillRect(x - 150 * s, y - 500 * s, 300 * s, 500 * s); break; }
    case 'snowman': { c.fillStyle = '#f4f8fc'; circ(c, x, y - 300 * s, 300 * s); c.fill(); circ(c, x, y - 750 * s, 210 * s); c.fill(); c.fillStyle = '#ff9f43'; c.beginPath(); c.moveTo(x, y - 760 * s); c.lineTo(x + 200 * s, y - 740 * s); c.lineTo(x, y - 720 * s); c.fill(); c.fillStyle = '#2a2a30'; c.fillRect(x - 170 * s, y - 1050 * s, 340 * s, 90 * s); c.fillRect(x - 110 * s, y - 1250 * s, 220 * s, 220 * s); c.fillStyle = '#e2463c'; c.fillRect(x - 200 * s, y - 590 * s, 400 * s, 70 * s); break; }
    case 'igloo': { c.fillStyle = '#e6eef8'; c.beginPath(); c.arc(x, y, 900 * s, Math.PI, 0); c.fill(); c.strokeStyle = '#b8c8dc'; c.lineWidth = Math.max(0.5, 25 * s); for(let k = 1; k < 4; k++){ c.beginPath(); c.arc(x, y, 900 * s * (1 - k * 0.22), Math.PI, 0); c.stroke(); } c.fillStyle = '#2a3550'; c.beginPath(); c.arc(x + 300 * s, y, 280 * s, Math.PI, 0); c.fill(); break; }
    case 'lamp': { c.fillStyle = '#4a5064'; c.fillRect(x - 30 * s, y - 2000 * s, 60 * s, 2000 * s); c.fillRect(x - (spr.x < 0 ? -30 : 400) * s, y - 2000 * s, 430 * s, 60 * s); const lx = x + (spr.x < 0 ? 400 : -400) * s; c.fillStyle = '#fff4c8'; c.fillRect(lx - 60 * s, y - 1960 * s, 120 * s, 40 * s); c.globalAlpha = 0.18; c.fillStyle = '#ffe7a0'; circ(c, lx, y - 1900 * s, 380 * s); c.fill(); c.globalAlpha = 1; break; }
    case 'water': { if(p.seg.color) { c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x - 300 * s, y - 10 * s, 600 * s, Math.max(0.5, 40 * s)); } break; }
    case 'hy': case 'board': {
      const w = 2200 * s, h = w * 88 / 256, top = y - 1300 * s;
      if(w < 2) break;
      c.fillStyle = '#4a4d58'; c.fillRect(x - w * 0.36, top + h, 70 * s, 1300 * s - h); c.fillRect(x + w * 0.33, top + h, 70 * s, 1300 * s - h);
      c.drawImage(boardImg(spr.kind === 'hy' ? 'HUMBLE YETI' : spr.text), x - w / 2, top, w, h);
      if(night){ c.globalAlpha = 0.14; c.fillStyle = '#fff4c8'; c.fillRect(x - w / 2, top, w, h); c.globalAlpha = 1; }
      break;
    }
    case 'warn': {
      const d2 = 330 * s, top = y - 1250 * s;
      c.fillStyle = '#6f7482'; c.fillRect(x - 25 * s, top, 50 * s, 1250 * s);
      c.fillStyle = spr.col; c.beginPath(); c.moveTo(x, top - d2); c.lineTo(x + d2, top); c.lineTo(x, top + d2); c.lineTo(x - d2, top); c.closePath(); c.fill();
      c.strokeStyle = '#17181d'; c.lineWidth = Math.max(0.5, 30 * s); c.stroke();
      if(d2 > 3) text(c, '!', x, top + 0.5, d2 * 1.1, '#17181d', 'center', 'middle');
      if(d2 > 5){ const pw = 1100 * s, ph = 220 * s; c.fillStyle = spr.col; c.fillRect(x - pw / 2, top + d2 + 40 * s, pw, ph); text(c, spr.text, x, top + d2 + 40 * s + ph / 2 + 0.3, fitText(c, spr.text, pw * 0.92, ph * 0.7), '#17181d', 'center', 'middle'); }
      break;
    }
    case 'crossing': {
      const cr = TK.cross[spr.cr];
      if(cr.k !== 'train') break;
      // rails across the road, flashing lights, and the barrier arms
      c.fillStyle = '#3a3530'; c.fillRect(p.sx1 - p.w1 * 1.6, y - Math.max(0.6, 25 * s), p.w1 * 3.2, Math.max(0.6, 30 * s)); c.fillRect(p.sx1 - p.w1 * 1.6, y - Math.max(1.2, 110 * s), p.w1 * 3.2, Math.max(0.6, 30 * s));
      const down = crossActive(cr, G.simT, 0), warn = crossActive(cr, G.simT, 1.6), fl = Math.floor(G.time * 4) % 2;
      for(const sd of [-1, 1]){
        const px = p.sx1 + sd * p.w1 * 1.12 / p.seg.w * p.seg.w, top = y - 1300 * s;
        c.fillStyle = '#e9ecf1'; c.fillRect(px - 30 * s, top, 60 * s, 1300 * s);
        c.save(); c.translate(px, top + 150 * s); c.rotate(0.6); c.fillStyle = '#f4efe2'; c.fillRect(-350 * s, -45 * s, 700 * s, 90 * s); c.rotate(-1.2); c.fillRect(-350 * s, -45 * s, 700 * s, 90 * s); c.restore();
        c.fillStyle = '#17181d'; c.fillRect(px - 260 * s, top + 350 * s, 520 * s, 180 * s);
        c.fillStyle = warn && fl ? '#ff3b30' : '#4a1a1a'; circ(c, px - 130 * s, top + 440 * s, 75 * s); c.fill();
        c.fillStyle = warn && !fl ? '#ff3b30' : '#4a1a1a'; circ(c, px + 130 * s, top + 440 * s, 75 * s); c.fill();
        // arm: pivots on the post, sweeps across its half of the road
        const ang = down ? 0 : warn ? -0.7 : -1.45, len = p.w1 * 1.05;
        c.save(); c.translate(px, y - 700 * s); c.rotate(sd < 0 ? ang : -ang);
        for(let k = 0; k < 6; k++){ c.fillStyle = k % 2 ? '#e2463c' : '#f4efe2'; c.fillRect(sd < 0 ? k * len / 6 : -(k + 1) * len / 6, -40 * s, len / 6, 80 * s); }
        c.restore();
      }
      break;
    }
    case 'gantry': {
      const top = y - 1700 * s, lx = p.sx1 - p.w1 * 1.2 / p.seg.w, rx = p.sx1 + p.w1 * 1.2 / p.seg.w, pw = 130 * s;
      c.fillStyle = '#3a3d48'; c.fillRect(lx - pw / 2, top, pw, y - top); c.fillRect(rx - pw / 2, top, pw, y - top);
      const bh = 420 * s;
      for(let k = 0; k < 24; k++){ c.fillStyle = k % 2 ? '#17181d' : '#f4f1ea'; c.fillRect(lx + k * (rx - lx) / 24, top, (rx - lx) / 24 + 0.5, bh * 0.25); }
      c.fillStyle = spr.fin ? '#e2463c' : '#23252e'; c.fillRect(lx, top + bh * 0.25, rx - lx, bh * 0.75);
      if(bh > 5){ const t2 = spr.fin ? 'FINISH' : 'BLACKTOP BRAWL · ' + TK.def.name.toUpperCase(); text(c, t2, (lx + rx) / 2, top + bh * 0.62, fitText(c, t2, (rx - lx) * 0.8, bh * 0.5), '#f5c542', 'center', 'middle'); }
      if(!spr.fin && (G.state === 'count' || G.state === 'race' && G.raceT < 1)){
        const lit = G.state === 'count' ? Math.min(3, Math.floor(G.stateT / 0.8 + 0.25)) : 4;
        for(let i = 0; i < 3; i++){ const bx = x - 400 * s + i * 400 * s; c.fillStyle = '#101014'; c.fillRect(bx - 150 * s, top + bh + 30 * s, 300 * s, 300 * s); c.fillStyle = lit >= 4 ? '#3fd07a' : i < lit ? '#ff3b30' : '#3a1414'; circ(c, bx, top + bh + 180 * s, 110 * s); c.fill(); }
      }
      break;
    }
    case 'stand': {
      const w = 2600 * s, h = 1000 * s; c.fillStyle = '#b8bec8'; c.fillRect(x - w / 2, y - h, w, h); c.fillStyle = '#e2463c'; c.fillRect(x - w / 2 - 60 * s, y - h - 180 * s, w + 120 * s, 180 * s);
      if(s * 100 > 0.6) for(let r = 0; r < 4; r++) for(let k = 0; k < 14; k++){ const hue = Math.floor(rng(r * 31 + k * 7 + spr.x * 3) * 360), bob = Math.sin(G.time * 6 + k + r) * 20 * s; c.fillStyle = 'hsl(' + hue + ',70%,60%)'; c.fillRect(x - w * 0.46 + k * w * 0.066, y - h + 160 * s + r * 200 * s + bob, 110 * s, 110 * s); }
      break;
    }
  }
}

/* ---------- Hazards on the road ---------- */
function drawHazard(c, p, h, def){
  if(h.k === 'oil' || h.k === 'sand' || h.k === 'ice' || h.k === 'rough') return;
  const pr = project(h.z, h.x, 0); if(!pr) return;
  const s = pr.s, x = pr.x, y = pr.y, w = h.w * ROADW * s;
  if(w < 0.4) return;
  switch(h.k){
    case 'hole': c.fillStyle = '#1f1d22'; c.beginPath(); c.ellipse(x, y, w, Math.max(0.5, w * 0.28), 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(x, y - w * 0.08, w * 0.9, Math.max(0.3, w * 0.12), 0, Math.PI, 0); c.fill(); break;
    case 'debris': {
      const kind = def.biome === 'beach' ? 0 : def.biome === 'mountain' || def.biome === 'savanna' ? 1 : 2;
      if(kind === 1){ c.fillStyle = '#8a8f96'; circ(c, x - w * 0.4, y - w * 0.3, w * 0.45); c.fill(); circ(c, x + w * 0.5, y - w * 0.2, w * 0.35); c.fill(); }
      else { c.save(); c.translate(x, y - w * 0.15); c.rotate((h.v - 1) * 0.4); c.fillStyle = kind === 0 ? '#b89a72' : '#8a6038'; rr(c, -w * 1.3, -w * 0.18, w * 2.6, w * 0.36, w * 0.15); c.fill(); c.restore(); }
      break;
    }
    case 'cone': {
      if(G.hitCones.has(h.cid)) break;
      const ch = 520 * s, cw = 180 * s;
      c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(x - cw, y); c.lineTo(x - cw * 0.2, y - ch); c.lineTo(x + cw * 0.2, y - ch); c.lineTo(x + cw, y); c.fill();
      c.fillStyle = '#f4efe2'; c.fillRect(x - cw * 0.55, y - ch * 0.55, cw * 1.1, ch * 0.14);
      c.fillStyle = '#2a2a30'; c.fillRect(x - cw * 1.2, y - Math.max(0.5, 40 * s), cw * 2.4, Math.max(0.5, 40 * s));
      break;
    }
    case 'barrier': {
      const bh = 700 * s, top = y - bh;
      c.fillStyle = '#4a4d58'; c.fillRect(x - w * 0.9, top + bh * 0.4, 60 * s, bh * 0.6); c.fillRect(x + w * 0.9 - 60 * s, top + bh * 0.4, 60 * s, bh * 0.6);
      c.save(); c.beginPath(); c.rect(x - w, top, w * 2, bh * 0.45); c.clip();
      c.fillStyle = '#f4efe2'; c.fillRect(x - w, top, w * 2, bh * 0.45);
      c.fillStyle = '#ff7a1a'; for(let k = -6; k < 8; k++){ c.beginPath(); const bx = x - w + k * w * 0.35; c.moveTo(bx, top + bh * 0.45); c.lineTo(bx + w * 0.17, top + bh * 0.45); c.lineTo(bx + w * 0.17 + bh * 0.45, top); c.lineTo(bx + bh * 0.45, top); c.fill(); }
      c.restore();
      c.fillStyle = Math.floor(G.time * 3) % 2 ? '#ffd166' : '#8a6a1a'; circ(c, x - w * 0.8, top - 60 * s, 70 * s); c.fill(); circ(c, x + w * 0.8, top - 60 * s, 70 * s); c.fill();
      break;
    }
    case 'bale': { c.fillStyle = '#e9c35a'; rr(c, x - w, y - w * 1.3, w * 2, w * 1.3, w * 0.25); c.fill(); c.strokeStyle = '#c9a03f'; c.lineWidth = Math.max(0.5, w * 0.08); for(let k = 1; k < 4; k++){ c.beginPath(); c.moveTo(x - w, y - w * 1.3 * k / 4); c.lineTo(x + w, y - w * 1.3 * k / 4); c.stroke(); } break; }
    case 'log': {
      const lh = 360 * s;
      c.fillStyle = '#6b4a2e'; rr(c, x - w, y - lh, w * 2, lh, lh * 0.4); c.fill();
      c.fillStyle = '#c9a070'; c.beginPath(); c.ellipse(x - w + lh * 0.25, y - lh / 2, lh * 0.25, lh * 0.45, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x + w - lh * 0.25, y - lh / 2, lh * 0.25, lh * 0.45, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3fae4a'; for(let k = 0; k < 4; k++){ circ(c, x - w * 0.6 + k * w * 0.4, y - lh, lh * 0.35); c.fill(); }
      break;
    }
    case 'ramp': {
      const rh = 420 * s, far = project(h.z + h.len, h.x, 0);
      const fy = far ? far.y : y - rh, fw = far ? h.w * ROADW * far.s : w * 0.8;
      quad(c, x - w, y, x + w, y, (far ? far.x : x) + fw, fy - (far ? 420 * far.s : rh), (far ? far.x : x) - fw, fy - (far ? 420 * far.s : rh), '#f5c542');
      c.fillStyle = '#17181d'; for(let k = 0; k < 3; k++){ const u = (k + 0.5) / 3; const yy = y + ((fy - (far ? 420 * far.s : rh)) - y) * u, ww = w + (fw - w) * u, xx = x + ((far ? far.x : x) - x) * u; c.fillRect(xx - ww, yy - Math.max(0.4, rh * 0.05), ww * 2, Math.max(0.5, rh * 0.1)); }
      break;
    }
    case 'drift': { c.fillStyle = '#f4f8fc'; c.beginPath(); c.ellipse(x, y, w * 1.1, w * 0.55, 0, Math.PI, 0); c.fill(); c.fillStyle = '#dbe6f2'; c.beginPath(); c.ellipse(x + w * 0.2, y, w * 0.6, w * 0.3, 0, Math.PI, 0); c.fill(); break; }
  }
}

/* ---------- Traffic (seen from behind) ---------- */
function drawVehicle(c, q, sx, sy, ppu){
  const K = VEH[q.kind], W = q.w * ROADW * ppu, H = K.h * ppu;
  if(W < 1) return;
  const night = TK.def.time === 'night', dusk = TK.def.time === 'dusk';
  const braking = q.v < K.v[0] * 0.75, blink = Math.floor(G.time * 3) % 2 && Math.abs(q.dx || 0) > 0.05;
  c.save(); c.translate(sx, sy);
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 0, W * 0.58, Math.max(0.5, W * 0.07), 0, 0, Math.PI * 2); c.fill();
  const bounce = Math.sin(G.time * 18 + q.id) * H * 0.01;
  c.translate(0, bounce);
  const col = q.kind === 'icecream' ? '#fbe9f0' : q.kind === 'camper' ? '#f4efe2' : q.kind === 'jeep' ? '#b5a36a' : q.kind === 'tractor' ? (q.id % 2 ? '#3f9a3a' : '#e2463c') : q.kind === 'bus' ? (TK.def.biome === 'meadow' ? '#f5c542' : '#e2463c') : q.col;
  const dk = shade(col, 0.7), lt = shade(col, 1.15);
  const wheels = (y0, ww, hh) => { c.fillStyle = '#15151a'; rr(c, -W * 0.5, -hh, ww, hh, ww * 0.25); c.fill(); rr(c, W * 0.5 - ww, -hh, ww, hh, ww * 0.25); c.fill(); };
  const tail = (y0, tw, th) => {
    c.fillStyle = braking ? '#ff3030' : '#b01f25'; c.fillRect(-W * 0.47, y0, tw, th); c.fillRect(W * 0.47 - tw, y0, tw, th);
    if(braking || night || dusk){ c.globalAlpha = braking ? 0.45 : 0.3; c.fillStyle = '#ff4040'; circ(c, -W * 0.47 + tw / 2, y0 + th / 2, tw * 1.6); c.fill(); circ(c, W * 0.47 - tw / 2, y0 + th / 2, tw * 1.6); c.fill(); c.globalAlpha = 1; }
    if(blink){ c.fillStyle = '#ffb020'; const sd = (q.dx || 0) > 0 ? 1 : -1; c.fillRect(sd * W * 0.47 - (sd > 0 ? tw : 0), y0 - th * 0.9, tw, th * 0.7); }
  };
  switch(q.kind){
    case 'car': case 'jeep': {
      wheels(0, W * 0.2, H * 0.3);
      c.fillStyle = col; rr(c, -W * 0.5, -H * 0.62, W, H * 0.46, H * 0.08); c.fill();
      c.fillStyle = dk; c.fillRect(-W * 0.5, -H * 0.2, W, H * 0.06);
      if(q.kind === 'jeep'){ c.strokeStyle = '#3a3a40'; c.lineWidth = Math.max(0.6, W * 0.04); c.beginPath(); c.moveTo(-W * 0.4, -H * 0.62); c.lineTo(-W * 0.36, -H); c.lineTo(W * 0.36, -H); c.lineTo(W * 0.4, -H * 0.62); c.stroke(); c.fillStyle = '#2a2a30'; circ(c, 0, -H * 0.42, W * 0.17); c.fill(); c.fillStyle = '#6a6a70'; circ(c, 0, -H * 0.42, W * 0.08); c.fill(); for(let k = 0; k < 3; k++){ c.fillStyle = '#2a2a30'; c.fillRect(-W * 0.45 + k * W * 0.08, -H * 0.6, W * 0.03, H * 0.35); } }
      else { c.fillStyle = lt; c.beginPath(); c.moveTo(-W * 0.42, -H * 0.62); c.lineTo(-W * 0.32, -H); c.lineTo(W * 0.32, -H); c.lineTo(W * 0.42, -H * 0.62); c.fill(); c.fillStyle = night ? '#1a2238' : '#3a4a66'; c.beginPath(); c.moveTo(-W * 0.36, -H * 0.66); c.lineTo(-W * 0.29, -H * 0.94); c.lineTo(W * 0.29, -H * 0.94); c.lineTo(W * 0.36, -H * 0.66); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-W * 0.2, -H * 0.9, W * 0.1, H * 0.2); }
      tail(-H * 0.55, W * 0.14, H * 0.12);
      c.fillStyle = '#f4efe2'; c.fillRect(-W * 0.12, -H * 0.42, W * 0.24, H * 0.1);
      break;
    }
    case 'van': case 'icecream': case 'camper': {
      wheels(0, W * 0.18, H * 0.22);
      c.fillStyle = col; rr(c, -W * 0.5, -H, W, H * 0.9, H * 0.06); c.fill();
      c.strokeStyle = dk; c.lineWidth = Math.max(0.5, W * 0.015); c.beginPath(); c.moveTo(0, -H * 0.95); c.lineTo(0, -H * 0.15); c.stroke();
      c.fillStyle = night ? '#1a2238' : '#3a4a66'; c.fillRect(-W * 0.4, -H * 0.9, W * 0.34, H * 0.22); c.fillRect(W * 0.06, -H * 0.9, W * 0.34, H * 0.22);
      if(q.kind === 'icecream'){ c.fillStyle = '#ff7eb6'; c.fillRect(-W * 0.5, -H * 0.55, W, H * 0.1); c.fillStyle = '#e9b36a'; c.beginPath(); c.moveTo(-W * 0.12, -H); c.lineTo(0, -H * 1.35); c.lineTo(W * 0.12, -H); c.fill(); c.beginPath(); c.moveTo(0, -H * 1.0); c.lineTo(-W * 0.1, -H * 1.3); c.lineTo(W * 0.1, -H * 1.3); c.fill(); c.fillStyle = '#ffd1e4'; circ(c, 0, -H * 1.4, W * 0.11); c.fill(); c.fillStyle = '#e2463c'; circ(c, W * 0.03, -H * 1.52, W * 0.03); c.fill(); }
      if(q.kind === 'camper'){ c.fillStyle = '#8a5a3a'; c.fillRect(-W * 0.5, -H * 0.5, W, H * 0.08); c.fillStyle = '#2a2a30'; circ(c, W * 0.22, -H * 0.36, W * 0.12); c.fill(); c.strokeStyle = '#8d93a1'; c.beginPath(); c.moveTo(-W * 0.3, -H * 0.2); c.lineTo(-W * 0.3, -H * 1.02); c.moveTo(-W * 0.2, -H * 0.2); c.lineTo(-W * 0.2, -H * 1.02); c.stroke(); }
      tail(-H * 0.4, W * 0.1, H * 0.16);
      break;
    }
    case 'bus': case 'truck': {
      wheels(0, W * 0.16, H * 0.18);
      c.fillStyle = q.kind === 'truck' ? (q.id % 3 === 0 ? '#e9ecf1' : q.col) : col; rr(c, -W * 0.5, -H, W, H * 0.9, H * 0.04); c.fill();
      if(q.kind === 'bus'){ c.fillStyle = night ? '#1a2238' : '#3a4a66'; c.fillRect(-W * 0.44, -H * 0.9, W * 0.88, H * 0.3); c.fillStyle = '#17181d'; c.fillRect(-W * 0.3, -H * 0.98, W * 0.6, H * 0.07); if(W > 20) text(c, 'EXPRESS', 0, -H * 0.945, fitText(c, 'EXPRESS', W * 0.55, H * 0.06), '#ffb020', 'center', 'middle'); c.fillStyle = dk; c.fillRect(-W * 0.3, -H * 0.45, W * 0.6, H * 0.14); }
      else { c.strokeStyle = shade(q.id % 3 === 0 ? '#e9ecf1' : q.col, 0.7); c.lineWidth = Math.max(0.5, W * 0.012); for(const lx of [-0.25, 0, 0.25]){ c.beginPath(); c.moveTo(W * lx, -H * 0.95); c.lineTo(W * lx, -H * 0.15); c.stroke(); } c.fillStyle = '#8d93a1'; c.fillRect(-W * 0.03, -H * 0.62, W * 0.06, H * 0.12); if(W > 26){ const nm = ['MOO MILK', 'FRESH FRUIT', 'SNACK CO', 'TOY TRUCK'][q.id % 4]; text(c, nm, 0, -H * 0.8, fitText(c, nm, W * 0.7, H * 0.1), '#17181d', 'center', 'middle'); } c.fillStyle = '#2a2a30'; c.fillRect(-W * 0.5, -H * 0.16, W * 0.12, H * 0.14); c.fillRect(W * 0.38, -H * 0.16, W * 0.12, H * 0.14); }
      tail(-H * 0.28, W * 0.08, H * 0.1);
      break;
    }
    case 'tractor': {
      c.fillStyle = '#15151a'; rr(c, -W * 0.5, -H * 0.62, W * 0.28, H * 0.62, W * 0.1); c.fill(); rr(c, W * 0.22, -H * 0.62, W * 0.28, H * 0.62, W * 0.1); c.fill();
      c.fillStyle = '#2c2c34'; for(let k = 0; k < 4; k++){ const yy = -H * 0.62 + ((k / 4 + G.time * 2) % 1) * H * 0.6; c.fillRect(-W * 0.48, yy, W * 0.24, H * 0.04); c.fillRect(W * 0.24, yy, W * 0.24, H * 0.04); }
      c.fillStyle = col; rr(c, -W * 0.2, -H * 0.7, W * 0.4, H * 0.55, W * 0.05); c.fill();
      c.fillStyle = '#e9c09a'; circ(c, 0, -H * 0.84, W * 0.08); c.fill(); c.fillStyle = '#d9b860'; c.beginPath(); c.ellipse(0, -H * 0.9, W * 0.16, W * 0.04, 0, 0, Math.PI * 2); c.fill(); c.fillRect(-W * 0.07, -H * 1.0, W * 0.14, H * 0.1);
      c.fillStyle = '#3a3a40'; c.fillRect(W * 0.12, -H * 1.1, W * 0.04, H * 0.4);
      c.fillStyle = Math.floor(G.time * 2) % 2 ? '#ffb020' : '#7a4a0a'; circ(c, -W * 0.14, -H * 0.74, W * 0.04); c.fill();
      if(Math.floor(G.time * 5 + q.id) % 3 === 0){ c.fillStyle = 'rgba(80,80,90,.4)'; circ(c, W * 0.15, -H * 1.18, W * 0.06); c.fill(); }
      break;
    }
  }
  c.restore();
}

/* ---------- Bikes and riders (seen from behind) ---------- */
function drawRider(c, r, sx, sy, ppu, groundY){
  const k = ppu;                                 // pixels per world unit
  if(BIKE_W * ROADW * k < 1.2) return;
  const night = TK.def.time === 'night';
  const blinkOut = r.invT > 0 && Math.floor(G.time * 14) % 2 === 0;
  // headlight pool on the road ahead at night
  if(night && !r.ghost && r.fallT <= 0 && !G.podiumDraw){ const hp = project(r.dist + 1100, r.x, 0); if(hp){ c.globalAlpha = 0.22; c.fillStyle = '#fff2c0'; c.beginPath(); c.ellipse(hp.x, hp.y, 260 * hp.s, 90 * hp.s, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; } }
  // shadow on the ground
  c.fillStyle = 'rgba(0,0,0,' + (r.ghost ? 0.12 : 0.32) + ')'; c.beginPath(); c.ellipse(sx, groundY, 150 * k * (1 - Math.min(0.5, r.h / 1200)), Math.max(0.5, 30 * k), 0, 0, Math.PI * 2); c.fill();
  if(r.style === 'neon' && !r.ghost){ c.globalAlpha = 0.4; c.fillStyle = 'hsl(' + ((G.time * 120) % 360) + ',95%,60%)'; c.beginPath(); c.ellipse(sx, groundY, 200 * k, Math.max(0.6, 50 * k), 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  if(r.ghost) c.globalAlpha = 0.42; else if(blinkOut) c.globalAlpha = 0.45;
  if(r.fallT > 0){ drawTumble(c, r, sx, sy, k); c.globalAlpha = 1; return; }
  c.save(); c.translate(sx, sy); c.rotate(r.lean * 0.5); c.scale(k, k);
  const col = r.color || '#e2463c', police = r.police, style = r.style || 'street';
  const body = police ? '#f4f6fa' : style === 'gold' ? '#e8b923' : col, dk = shade(police ? '#2f6fe0' : body, 0.65);
  // nitro flames and exhaust
  if(r.nitroT > 0){ for(let i = 0; i < 3; i++){ const fl = 120 + rng(Math.floor(G.time * 30) + i) * 160; c.fillStyle = i ? '#ffd166' : '#ff7a3c'; c.beginPath(); c.moveTo(70 + i * 6, -120); c.lineTo(95 + i * 8, -120 + fl * 0.2); c.lineTo(80, -120 + fl); c.fill(); } c.fillStyle = 'rgba(127,227,255,.35)'; circ(c, 0, -180, 170); c.fill(); }
  // rear tyre
  const tyreW = style === 'cruiser' ? 95 : style === 'scooter' ? 85 : 72, tyreH = style === 'scooter' ? 170 : 250;
  c.fillStyle = '#15151a'; rr(c, -tyreW / 2, -tyreH, tyreW, tyreH, 30); c.fill();
  c.fillStyle = '#2c2c34'; const ph = ((r.dist || 0) / 90) % 1; for(let i = 0; i < 3; i++){ const yy = -tyreH + ((i / 3 + ph) % 1) * tyreH; c.fillRect(-tyreW * 0.35, yy, tyreW * 0.7, 12); }
  // exhaust pipe
  c.fillStyle = '#b9bec8'; rr(c, 60, -170, 45, 70, 12); c.fill(); c.fillStyle = '#3a3a40'; circ(c, 82, -135, 14); c.fill();
  // tail section by bike style
  if(style === 'scooter'){
    c.fillStyle = body; rr(c, -120, -380, 240, 250, 90); c.fill(); c.fillStyle = dk; rr(c, -95, -470, 190, 110, 30); c.fill();
  } else if(style === 'cruiser'){
    c.fillStyle = body; c.beginPath(); c.arc(0, -210, 110, Math.PI, 0); c.fill(); c.fillStyle = '#5a3a2a'; rr(c, -175, -300, 70, 120, 20); c.fill(); rr(c, 105, -300, 70, 120, 20); c.fill();
    c.strokeStyle = '#b9bec8'; c.lineWidth = 18; c.beginPath(); c.moveTo(-70, -330); c.lineTo(-60, -520); c.lineTo(60, -520); c.lineTo(70, -330); c.stroke();
  } else if(style === 'cafe'){
    c.fillStyle = body; c.beginPath(); c.ellipse(0, -330, 95, 70, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f4efe2'; c.fillRect(-12, -395, 24, 130);
  } else {
    c.fillStyle = body; c.beginPath(); c.moveTo(-95, -250); c.lineTo(-70, -360); c.lineTo(70, -360); c.lineTo(95, -250); c.closePath(); c.fill();
    c.fillStyle = police ? '#2f6fe0' : style === 'neon' ? 'hsl(' + ((G.time * 120 + 180) % 360) + ',95%,60%)' : dk; c.fillRect(-95, -290, 190, 18);
  }
  // number plate and tail light (bright when braking)
  c.fillStyle = '#f4efe2'; c.fillRect(-45, -245, 90, 40);
  c.fillStyle = r.brake ? '#ff3030' : '#a81c24'; rr(c, -40, style === 'scooter' ? -330 : -285, 80, 26, 8); c.fill();
  if(r.brake || night){ c.globalAlpha *= 0.4; c.fillStyle = '#ff3030'; circ(c, 0, style === 'scooter' ? -317 : -272, 60); c.fill(); c.globalAlpha = r.ghost ? 0.42 : blinkOut ? 0.45 : 1; }
  // police light bar
  if(police){ const on = Math.floor(G.time * 8) % 2; c.fillStyle = on ? '#ff3b30' : '#4a1a1a'; rr(c, -90, -410, 80, 30, 8); c.fill(); c.fillStyle = on ? '#1a2a5a' : '#3f7bff'; rr(c, 10, -410, 80, 30, 8); c.fill(); c.globalAlpha *= 0.3; c.fillStyle = on ? '#ff3b30' : '#3f7bff'; circ(c, on ? -50 : 50, -395, 110); c.fill(); c.globalAlpha = 1; }
  // the rider
  const tuck = r.tuck || r.nitroT > 0, upright = style === 'cruiser' || style === 'scooter';
  const hip = style === 'scooter' ? -380 : -340, sh = tuck ? -540 : upright ? -640 : -600, head = sh - (tuck ? 70 : 90);
  const jacket = police ? '#2f6fe0' : col, jdk = shade(jacket, 0.72);
  const atk = r.atkT > 0 ? 1 - r.atkT / (r.atkKind === 'kick' ? 0.36 : 0.26) : -1, ext = atk >= 0 ? Math.sin(Math.min(1, atk * 1.4) * Math.PI) : 0;
  // legs and boots (a kick sweeps one leg out sideways)
  for(const sd of [-1, 1]){
    const kicking = atk >= 0 && r.atkKind === 'kick' && sd === r.atkSide;
    c.fillStyle = '#2a2d38';
    if(kicking){ c.save(); c.translate(sd * 80, hip + 40); c.rotate(-sd * (0.3 + ext * 1.1)); rr(c, -35, 0, 70, 250 + ext * 80, 30); c.fill(); c.fillStyle = '#17181d'; rr(c, -45, 220 + ext * 80, 95, 70, 25); c.fill(); c.restore(); if(ext > 0.6){ c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 14; for(let i = 0; i < 3; i++){ c.beginPath(); c.moveTo(sd * (200 + i * 40), hip + 150 + i * 40); c.lineTo(sd * (330 + i * 40), hip + 120 + i * 40); c.stroke(); } } }
    else { rr(c, sd * 60 - 35, hip, 70, 200, 30); c.fill(); c.fillStyle = '#17181d'; rr(c, sd * 95 - 40, -200, 80, 90, 25); c.fill(); }
  }
  // back / jacket (police: POLICE on the back)
  c.fillStyle = jacket; rr(c, -105, sh, 210, hip - sh + 40, 60); c.fill();
  c.fillStyle = police ? '#f4f6fa' : 'rgba(255,255,255,.75)'; if(police){ c.fillRect(-100, sh + 70, 200, 60); if(k * 200 > 14){ c.font = '48px ' + FONT; c.fillStyle = '#2f6fe0'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('POLICE', 0, sh + 102); } } else c.fillRect(-18, sh + 20, 36, hip - sh - 10);
  c.fillStyle = jdk; c.fillRect(-105, hip - 10, 210, 40);
  // handlebars and mirrors
  const barW = style === 'cruiser' ? 230 : 165, barY = style === 'cruiser' ? sh + 10 : sh + 90;
  c.fillStyle = '#2a2a30'; c.fillRect(-barW, barY, barW * 2, 22);
  c.fillStyle = '#9aa1ad'; circ(c, -barW - 10, barY - 70, 28); c.fill(); circ(c, barW + 10, barY - 70, 28); c.fill();
  // arms: a punch shoots a big foam glove out sideways; blocking raises both arms
  for(const sd of [-1, 1]){
    const punching = atk >= 0 && r.atkKind === 'punch' && sd === r.atkSide;
    const sx0 = sd * 95, sy0 = sh + 50;
    let ex = sd * barW, ey = barY + 10, glove = 42, gcol = police ? '#17181d' : '#f4efe2';
    if(punching){ ex = sd * (140 + ext * 330); ey = sh + 40 - ext * 30; glove = 60 + ext * 25; gcol = police ? '#3f7bff' : '#ff5a4e'; }
    else if(r.blk){ ex = sd * 60; ey = head - 10; glove = 55; gcol = '#7fe3ff'; }
    c.strokeStyle = jdk; c.lineWidth = 58; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx0, sy0); c.lineTo(ex, ey); c.stroke(); c.lineCap = 'butt';
    c.fillStyle = gcol; circ(c, ex, ey, glove); c.fill();
    if(punching && ext > 0.55){ c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 12; for(let i = 0; i < 3; i++){ c.beginPath(); c.moveTo(ex - sd * (90 + i * 30), ey - 40 + i * 40); c.lineTo(ex - sd * (200 + i * 30), ey - 40 + i * 40); c.stroke(); } }
  }
  if(r.blk){ c.strokeStyle = 'rgba(127,227,255,.6)'; c.lineWidth = 16; c.beginPath(); c.arc(0, head + 20, 220, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  // helmet
  c.fillStyle = police ? '#f4f6fa' : style === 'gold' ? '#ffd54a' : shade(col, 1.1); circ(c, 0, head, 88); c.fill();
  c.fillStyle = police ? '#2f6fe0' : '#ffffff'; c.fillRect(-14, head - 86, 28, 150);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.arc(0, head, 88, 0.2, Math.PI - 0.2); c.fill();
  if(style === 'gold' && Math.floor(G.time * 6) % 3 === 0){ c.fillStyle = '#fff6c0'; star(c, 70 * Math.sin(G.time * 3), head - 140, 30, G.time); }
  c.restore();
  // dizzy stars and hit flash (drawn upright)
  const hx = sx + Math.sin(r.lean * 0.5) * -head * k, hy = sy + Math.cos(r.lean * 0.5) * head * k;
  if(r.stagT > 0){ for(let i = 0; i < 3; i++){ const a = G.time * 6 + i * 2.1; c.fillStyle = i % 2 ? '#fff3b0' : '#f5c542'; star(c, hx + Math.cos(a) * 140 * k, hy - 110 * k + Math.sin(a) * 40 * k, Math.max(1.2, 42 * k), a); } }
  c.globalAlpha = 1;
  // name tag and callouts for players; a short bubble for rivals up close
  if(r.human || r.ghost || (r.police && k * 100 > 3)){
    const nm = r.ghost ? 'BEST: ' + (r.name || '').toUpperCase() : (r.name || '').toUpperCase(), sz = clamp(k * 55, 4, 6.5);
    if(r.human && humansOnScreen() > 1 || r.ghost || r.police){ outlined(c, nm, hx, hy - 150 * k - sz, sz, r.ghost ? '#e9ecf1' : r.color); }
    if(r.human && humansOnScreen() > 1 && r.bal > 5){ const bw = clamp(k * 260, 10, 26), by = hy - 150 * k - sz * 2 - 2; c.fillStyle = 'rgba(10,10,14,.6)'; c.fillRect(hx - bw / 2 - 1, by - 1, bw + 2, 3); c.fillStyle = r.bal > 70 ? '#ff5a4e' : '#f5c542'; c.fillRect(hx - bw / 2, by, bw * r.bal / 100, 1.5); }
  }
  if(r.msgT > 0 && r.msg && (r.human || k * 100 > 5)){
    const sz = clamp(k * 70, 5, r.human ? 9 : 6.5), a = Math.min(1, r.msgT * 3), rise = (1 - Math.min(1, r.msgT)) * 8;
    c.globalAlpha = a; outlined(c, r.msg, hx, hy - 190 * k - sz * 2.4 - rise, sz, r.msgCol || '#f4efe2'); c.globalAlpha = 1;
  }
}
let humansCount = 0;
const humansOnScreen = () => humansCount;
/* A fallen rider: the bike slides on its side and the rider tumbles along beside it (then hops back on) */
function drawTumble(c, r, sx, sy, k){
  const col = r.police ? '#2f6fe0' : r.color, side = r.lean >= 0 ? 1 : -1, t = r.fallT;
  c.save(); c.translate(sx - side * 120 * k, sy); c.rotate(side * 1.35); c.scale(k, k);
  c.fillStyle = '#15151a'; rr(c, -36, -250, 72, 250, 30); c.fill();
  c.fillStyle = r.police ? '#f4f6fa' : col; c.beginPath(); c.moveTo(-95, -250); c.lineTo(-70, -360); c.lineTo(70, -360); c.lineTo(95, -250); c.fill();
  c.restore();
  // sparks and dust
  if(r.v > 800){ c.fillStyle = '#ffd166'; for(let i = 0; i < 4; i++){ const a = rng(Math.floor(G.time * 40) + i) * Math.PI; c.fillRect(sx + Math.cos(a) * 120 * k, sy - Math.sin(a) * 80 * k, 1.2, 1.2); } }
  const bx = sx + side * 200 * k, by = sy - (180 + Math.abs(Math.sin(t * 7)) * 260) * k, rot = t * 11 * side;
  c.save(); c.translate(bx, by); c.rotate(rot); c.scale(k, k);
  c.fillStyle = col; rr(c, -110, -110, 220, 220, 90); c.fill();
  c.fillStyle = '#2a2d38'; rr(c, -40, 80, 80, 160, 30); c.fill();
  c.fillStyle = '#f4efe2'; circ(c, -150, -20, 50); c.fill(); circ(c, 150, 30, 50); c.fill();
  c.fillStyle = r.police ? '#f4f6fa' : shade(col, 1.1); circ(c, 0, -170, 90); c.fill();
  c.restore();
  for(let i = 0; i < 3; i++){ const a = G.time * 7 + i * 2.1; c.fillStyle = '#f5c542'; star(c, bx + Math.cos(a) * 150 * k, by - 250 * k + Math.sin(a) * 40 * k, Math.max(1.2, 40 * k), a); }
  if(r.msgT > 0 && r.msg && r.human){ outlined(c, r.msg, bx, by - 380 * k - 6, clamp(k * 70, 5, 9), r.msgCol || '#ff9f43'); }
}

/* ---------- Things crossing the road (seen from the side as they walk across) ---------- */
function drawCrosser(c, cr, j, x, y, s){
  const dir = (crossCycle(cr, G.simT).k + cr.dirSeed) % 2 ? -1 : 1;
  const step = Math.sin(G.time * 10 + j * 2);
  c.save(); c.translate(x, y); c.scale(dir * s, s);
  switch(cr.k){
    case 'sheep': c.fillStyle = '#2a2a30'; c.fillRect(-120, -220, 40, 220 + step * 20); c.fillRect(80, -220, 40, 220 - step * 20); c.fillStyle = '#f4f4f0'; for(let i = 0; i < 5; i++){ circ(c, -150 + i * 75, -330 - (i % 2) * 50, 110); c.fill(); } c.fillStyle = '#2a2a30'; rr(c, 180, -440, 130, 110, 40); c.fill(); break;
    case 'zebra': { c.fillStyle = '#f4f4f0'; rr(c, -330, -700, 660, 330, 140); c.fill(); for(let i = 0; i < 6; i++){ c.fillStyle = '#17181d'; c.fillRect(-280 + i * 100, -690, 40, 310); } c.fillStyle = '#f4f4f0'; c.fillRect(-280, -400, 60, 400 + step * 30); c.fillRect(220, -400, 60, 400 - step * 30); c.save(); c.translate(300, -620); c.rotate(-0.7); rr(c, 0, -60, 330, 120, 50); c.fill(); c.fillStyle = '#17181d'; c.fillRect(120, -60, 30, 120); c.fillRect(220, -60, 30, 120); c.restore(); break; }
    case 'elephant': { c.fillStyle = '#8f96a3'; rr(c, -600, -1300, 1100, 800, 350); c.fill(); c.fillRect(-500, -600, 180, 600 + step * 30); c.fillRect(250, -600, 180, 600 - step * 30); circ(c, 520, -1100, 320); c.fill(); c.strokeStyle = '#8f96a3'; c.lineWidth = 130; c.lineCap = 'round'; c.beginPath(); c.moveTo(740, -1000); c.quadraticCurveTo(880, -600, 760 + Math.sin(G.time * 3) * 60, -350); c.stroke(); c.lineCap = 'butt'; c.fillStyle = '#7a808c'; c.beginPath(); c.ellipse(420, -1080, 180, 260, 0.2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#17181d'; circ(c, 620, -1180, 30); c.fill(); c.fillStyle = '#f4efe2'; c.beginPath(); c.moveTo(700, -900); c.lineTo(860, -820); c.lineTo(700, -860); c.fill(); break; }
    case 'giraffe': { c.fillStyle = '#e9b04a'; rr(c, -300, -1000, 600, 330, 140); c.fill(); c.fillRect(-250, -700, 60, 700 + step * 30); c.fillRect(190, -700, 60, 700 - step * 30); c.save(); c.translate(230, -920); c.rotate(-0.25); c.fillRect(0, -1100, 120, 1100); rr(c, -40, -1250, 260, 170, 70); c.fill(); c.fillStyle = '#8a5a2a'; for(let i = 0; i < 5; i++){ circ(c, 60, -200 - i * 200, 45); c.fill(); } c.fillRect(20, -1330, 20, 90); c.fillRect(100, -1330, 20, 90); c.restore(); c.fillStyle = '#8a5a2a'; for(let i = 0; i < 6; i++){ circ(c, -220 + i * 90, -840 + (i % 2) * 70, 50); c.fill(); } break; }
    case 'reindeer': { c.fillStyle = '#8a5a3a'; rr(c, -300, -650, 560, 290, 120); c.fill(); c.fillRect(-250, -380, 50, 380 + step * 25); c.fillRect(180, -380, 50, 380 - step * 25); c.save(); c.translate(250, -600); c.rotate(-0.6); rr(c, 0, -55, 300, 110, 45); c.fill(); c.restore(); c.fillStyle = '#f4efe2'; c.fillRect(-300, -520, 80, 80); c.strokeStyle = '#c9a070'; c.lineWidth = 28; c.beginPath(); c.moveTo(440, -840); c.lineTo(420, -1100); c.lineTo(340, -1200); c.moveTo(420, -1100); c.lineTo(520, -1180); c.moveTo(470, -840); c.lineTo(560, -1060); c.stroke(); break; }
    case 'monkey': { const hop = Math.abs(Math.sin(G.time * 12 + j)) * 260; c.translate(0, -hop); c.fillStyle = '#8a5a2a'; rr(c, -120, -380, 240, 240, 100); c.fill(); circ(c, 140, -420, 100); c.fill(); c.fillStyle = '#e9c09a'; circ(c, 170, -410, 60); c.fill(); c.strokeStyle = '#8a5a2a'; c.lineWidth = 40; c.lineCap = 'round'; c.beginPath(); c.moveTo(-120, -260); c.quadraticCurveTo(-320, -300, -280, -520); c.stroke(); c.lineCap = 'butt'; c.fillStyle = '#17181d'; circ(c, 190, -440, 14); c.fill(); break; }
    case 'rock': { c.rotate(G.time * 8 * dir); c.fillStyle = '#7d828c'; c.beginPath(); for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4, d = 260 + (i % 3) * 40; c.lineTo(Math.cos(a) * d, -300 + Math.sin(a) * d); } c.fill(); c.strokeStyle = '#5a5f6a'; c.lineWidth = 30; c.beginPath(); c.moveTo(-150, -300); c.lineTo(150, -300); c.stroke(); break; }
    case 'tumble': { const hop = Math.abs(Math.sin(G.time * 6 + j * 2)) * 400; c.translate(0, -hop); c.rotate(G.time * 7); c.strokeStyle = '#a87a42'; c.lineWidth = 26; for(let i = 0; i < 6; i++){ c.beginPath(); c.arc(0, -220, 150 + i * 12, i, i + 3.5); c.stroke(); } break; }
    case 'devil': { c.fillStyle = 'rgba(224,179,108,.45)'; for(let i = 0; i < 10; i++){ const yy = -i * 280, w = 180 + i * 90, sw = Math.sin(G.time * 8 + i) * 80; c.beginPath(); c.ellipse(sw, yy, w, 90, 0, 0, Math.PI * 2); c.fill(); } break; }
  }
  c.restore();
}
function drawTrain(c, cr, p){
  if(!crossActive(cr, G.simT, 0)) return;
  const { k, u } = crossCycle(cr, G.simT), dir = (k + cr.dirSeed) % 2 ? -1 : 1;
  const head = dir * (-3.2 + 6.4 * (u / cr.dur));
  const pr0 = project(cr.z + 40, 0, 0); if(!pr0) return;
  const s = pr0.s, H = 1300 * s, carW = 0.9;
  for(let i = 0; i < 6; i++){
    const cx0 = head - dir * i * (carW + 0.06), a = cx0 - carW / 2, b = cx0 + carW / 2;
    const x1 = pr0.x + a * ROADW * s, x2 = pr0.x + b * ROADW * s;
    if(x2 < -60 || x1 > VW + 60) continue;
    c.fillStyle = i === 0 ? '#e2463c' : ['#3f8fe0', '#3fae4a', '#f5c542'][i % 3];
    rr(c, x1, pr0.y - H, x2 - x1, H * 0.85, H * 0.08); c.fill();
    c.fillStyle = '#f4efe2'; for(let w = 0; w < 3; w++) c.fillRect(x1 + (x2 - x1) * (0.1 + w * 0.3), pr0.y - H * 0.85, (x2 - x1) * 0.2, H * 0.25);
    c.fillStyle = '#17181d'; circ(c, x1 + (x2 - x1) * 0.2, pr0.y - H * 0.12, H * 0.12); c.fill(); circ(c, x1 + (x2 - x1) * 0.8, pr0.y - H * 0.12, H * 0.12); c.fill();
    if(i === 0){ c.fillStyle = '#17181d'; c.fillRect(x1 + (x2 - x1) * 0.4, pr0.y - H * 1.25, (x2 - x1) * 0.15, H * 0.4); if(Math.floor(G.time * 4) % 2){ c.fillStyle = 'rgba(230,230,235,.7)'; circ(c, x1 + (x2 - x1) * 0.47, pr0.y - H * 1.4, H * 0.15); c.fill(); } }
  }
}

/* ---------- Cartoon effects: worked out from rider state, so every online screen sees them ---------- */
let parts = [];
const fxPrev = new Map();
const CONFETTI = ['#f5c542', '#e2463c', '#3fd0b0', '#7aa8ff', '#ff7eb6', '#f4efe2'];
function puff(z, x, h, n, col, kind, spd){
  for(let i = 0; i < n; i++) parts.push({ z, x, h, vz: (Math.random() - 0.5) * 900, vx: (Math.random() - 0.5) * (spd || 0.6), vh: 200 + Math.random() * 600, t: 0, life: 0.4 + Math.random() * 0.4, col: Array.isArray(col) ? col[i % col.length] : col, r: 30 + Math.random() * 40, kind: kind || 'sq', rot: Math.random() * 6 });
  if(parts.length > 260) parts.splice(0, parts.length - 260);
}
function fxStep(dt){
  const seen = new Set();
  for(const r of G.riders){
    seen.add(r.id);
    const p = fxPrev.get(r.id) || { hit: 0, fall: 0, h: 0, fin: -1, stag: 0 };
    if(r.hitT > p.hit + 0.05){
      const word = r.hitK === 2 ? 'WHAM!' : r.hitK === 1 ? 'POW!' : r.hitK === 3 ? 'BLOCK!' : r.hitK === 6 ? 'BOING!' : '';
      if(word) parts.push({ z: r.dist + 100, x: r.x - (r.hitSide || 0) * 0.08, h: 520, vz: r.v * 0.9, vx: 0, vh: 150, t: 0, life: 0.55, kind: 'word', txt: word, col: r.hitK === 3 ? '#7fe3ff' : r.hitK === 6 ? '#f5d67a' : '#ffd166', r: 1 });
      if(r.hitK === 4) puff(r.dist + 200, r.x, 80, 6, ['#ffd166', '#fff3b0'], 'spark', 1.2);
      else if(r.hitK === 5) puff(r.dist + 200, r.x, 0, 6, '#8a8070');
      else puff(r.dist + 200, r.x, 450, 6, ['#f5c542', '#ffffff'], 'star');
    }
    if(r.fallT > 0 && p.fall <= 0){ puff(r.dist + 200, r.x, 50, 12, ['#d8c8a8', '#bfb198'], 'dust'); puff(r.dist + 200, r.x, 500, 6, ['#f5c542', '#fff3b0'], 'star'); }
    if(r.fallT > 0 && Math.random() < 0.4) puff(r.dist, r.x, 20, 1, '#cfc2a4', 'dust');
    if(r.h <= 1 && p.h > 60) puff(r.dist + 150, r.x, 0, 8, '#d8c8a8', 'dust');
    if(r.nitroT > 0 && Math.random() < 0.8) parts.push({ z: r.dist - 40, x: r.x + 0.035, h: 130, vz: r.v * 0.75, vx: (Math.random() - 0.5) * 0.15, vh: 120, t: 0, life: 0.22, col: Math.random() < 0.5 ? '#ffd166' : '#ff7a3c', r: 22, kind: 'flame', rot: 0 });
    if((r.surf === 'sand' || r.surf === 'drift' || r.surf === 'ice' || r.off) && r.v > 2000 && Math.random() < 0.5) parts.push({ z: r.dist, x: r.x + (Math.random() - 0.5) * 0.06, h: 30, vz: r.v * 0.7, vx: (Math.random() - 0.5) * 0.5, vh: 300 + Math.random() * 300, t: 0, life: 0.4, col: r.surf === 'sand' ? '#e0c080' : r.surf === 'ice' || r.surf === 'drift' ? '#eef6ff' : TK.def.shoulder, r: 22, kind: 'flame', rot: 0 });
    if(r.fin >= 0 && p.fin < 0 && r.human && !G.demo) for(let i = 0; i < 40; i++) parts.push({ z: r.dist + 300, x: r.x, h: 500, vz: r.v * 0.8 + (Math.random() - 0.5) * 900, vx: (Math.random() - 0.5) * 1.4, vh: 400 + Math.random() * 900, t: 0, life: 1.2 + Math.random() * 0.6, col: CONFETTI[i % CONFETTI.length], r: 40, kind: 'sq', rot: Math.random() * 6 });
    fxPrev.set(r.id, { hit: r.hitT, fall: r.fallT, h: r.h, fin: r.fin, stag: r.stagT });
  }
  for(const id of fxPrev.keys()) if(!seen.has(id)) fxPrev.delete(id);
  // cones knocked flying
  for(const cid of G.hitCones){ const h = TK.cones[cid]; if(h && !h.flew){ h.flew = true; parts.push({ z: h.z, x: h.x, h: 50, vz: 4000 + Math.random() * 2000, vx: (Math.random() - 0.5) * 2, vh: 900 + Math.random() * 400, t: 0, life: 0.9, col: '#ff7a1a', r: 1, kind: 'cone', rot: 0 }); } }
  for(const q of parts){ q.t += dt; q.z += q.vz * dt; q.x += q.vx * dt; q.h = Math.max(0, q.h + q.vh * dt); q.vh -= 1800 * dt; q.rot += dt * 9; }
  parts = parts.filter(q => q.t < q.life);
}
function drawParticles(c){
  for(const q of parts){
    const pr = project(q.z, q.x, q.h); if(!pr) continue;
    const a = Math.max(0, 1 - q.t / q.life);
    if(q.kind === 'word'){ const sz = clamp(pr.s * 260, 6, 16) * (1 + (1 - a) * 0.3); c.globalAlpha = Math.min(1, a * 2); c.fillStyle = '#17181d'; burstShape(c, pr.x, pr.y, sz * 1.5, 9, q.t * 2); c.fill(); c.fillStyle = q.col; burstShape(c, pr.x, pr.y, sz * 1.3, 9, q.t * 2); c.fill(); outlined(c, q.txt, pr.x, pr.y, sz * 0.62, '#17181d'); c.globalAlpha = 1; continue; }
    const r = Math.max(0.6, q.r * pr.s);
    c.globalAlpha = q.kind === 'dust' ? a * 0.6 : a;
    c.fillStyle = q.col;
    if(q.kind === 'star') star(c, pr.x, pr.y, Math.max(1.5, r * 1.6), q.rot);
    else if(q.kind === 'dust'){ circ(c, pr.x, pr.y, r * (1.5 + q.t * 3)); c.fill(); }
    else if(q.kind === 'flame'){ circ(c, pr.x, pr.y, r * (1 - q.t / q.life * 0.6)); c.fill(); }
    else if(q.kind === 'cone'){ const cw = 180 * pr.s, ch = 520 * pr.s; c.save(); c.translate(pr.x, pr.y); c.rotate(q.rot); c.beginPath(); c.moveTo(-cw, ch / 2); c.lineTo(0, -ch / 2); c.lineTo(cw, ch / 2); c.fill(); c.restore(); }
    else c.fillRect(pr.x - r, pr.y - r, r * 2, r * 2);
  }
  c.globalAlpha = 1;
}

/* ---------- Weather and light ---------- */
function weather(c, v, hy, def){
  const f = focusRiders()[0], sp = cam.sp || 0;
  if(G.rain){
    c.strokeStyle = 'rgba(200,215,235,.45)'; c.lineWidth = 0.7; c.beginPath();
    const n = Math.floor(v.w * v.h / 800);
    for(let i = 0; i < n; i++){ const x = v.x + (rng(i) * v.w + G.time * (40 + i % 7 * 5)) % v.w, y = v.y + (rng(i + 99) * v.h + G.time * 280) % v.h; c.moveTo(x, y); c.lineTo(x - 1.5 - sp * 3, y + 5 + sp * 6); }
    c.stroke();
  }
  if(def.snow){
    c.fillStyle = 'rgba(240,246,255,.85)';
    for(let i = 0; i < 90; i++){ const x = v.x + ((rng(i) * v.w + Math.sin(G.time + i) * 12 - G.time * sp * 30 * (rng(i + 3) - 0.5)) % v.w + v.w) % v.w, y = v.y + (rng(i + 50) * v.h + G.time * (30 + rng(i + 9) * 40 + sp * 80)) % v.h; c.fillRect(x, y, 1.3, 1.3); }
  }
  if(def.fog){ const g = c.createLinearGradient(0, hy - 30, 0, hy + 40); g.addColorStop(0, 'rgba(201,211,220,0)'); g.addColorStop(0.5, 'rgba(201,211,220,' + (G.rain ? 0.55 : 0.4) + ')'); g.addColorStop(1, 'rgba(201,211,220,0)'); c.fillStyle = g; c.fillRect(v.x, hy - 30, v.w, 70); }
  if(def.haze){ c.strokeStyle = 'rgba(255,240,210,.35)'; c.lineWidth = 1; for(let i = 0; i < 6; i++){ const yy = hy + 2 + i * 3; c.beginPath(); for(let x = v.x; x < v.x + v.w; x += 8){ c.lineTo(x, yy + Math.sin(x * 0.08 + G.time * 5 + i) * 1.2); } c.stroke(); } }
  if(def.biome === 'jungle' && TK.segs[Math.floor((cam.focus || 0) / SEG)] && TK.segs[Math.floor(cam.focus / SEG)].flags.canopy){
    c.fillStyle = 'rgba(0,30,10,.25)'; c.fillRect(v.x, v.y, v.w, v.h);
    for(let i = 0; i < 4; i++){ const x = v.x + ((i * 120 + cam.bg * 20) % (v.w + 100)) - 50; c.fillStyle = 'rgba(255,250,200,.1)'; c.beginPath(); c.moveTo(x, v.y); c.lineTo(x + 30, v.y); c.lineTo(x + 90, v.y + v.h); c.lineTo(x + 40, v.y + v.h); c.fill(); }
  }
  if(f && f.dustT > 0){ c.fillStyle = 'rgba(214,170,110,' + Math.min(0.6, f.dustT) + ')'; c.fillRect(v.x, v.y, v.w, v.h); }
}
function speedLines(c, v){
  const sp = cam.sp || 0, nit = focusRiders().some(r => r.nitroT > 0);
  const amt = clamp((sp - 0.88) * 5, 0, 1) + (nit ? 0.8 : 0);
  if(amt <= 0.02 || G.demo) return;
  c.strokeStyle = nit ? 'rgba(255,220,160,' + 0.35 * Math.min(1, amt) + ')' : 'rgba(255,255,255,' + 0.25 * Math.min(1, amt) + ')'; c.lineWidth = 1;
  const cx = v.x + v.w / 2, cy = v.y + v.h * 0.44;
  c.beginPath();
  for(let i = 0; i < 26; i++){
    const a = rng(i + Math.floor(G.time * 20) * 3) * Math.PI * 2, r0 = v.w * (0.32 + rng(i * 7) * 0.2), L = 18 + amt * 30;
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.7); c.lineTo(cx + Math.cos(a) * (r0 + L), cy + Math.sin(a) * (r0 + L) * 0.7);
  }
  c.stroke();
}

/* ---------- Skies and horizons for every biome ---------- */
function drawBackdrop(c, v, hy, off, def){
  const g = c.createLinearGradient(0, v.y, 0, hy);
  g.addColorStop(0, def.sky[0]); g.addColorStop(1, G.rain ? '#9aa4b0' : def.sky[1]);
  c.fillStyle = g; c.fillRect(v.x, v.y, v.w, hy - v.y + 1);
  const W = v.w, k = VH / 216, px = (par, span) => ((-off * par * 60 * k) % span + span) % span;
  const layer = (par, fn) => { const span = W * 2, o = px(par, span); for(let rep = -1; rep < 2; rep++) fn(v.x + rep * span - o, span); };
  const night = def.time === 'night', dusk = def.time === 'dusk';
  if(night){
    c.fillStyle = '#fff'; for(let i = 0; i < 60; i++){ const sx = v.x + ((rng(i) * W * 2 + px(0.05, W * 2)) % (W * 2)) - W * 0.5, sy = v.y + rng(i + 50) * (hy - v.y) * 0.85; if(sx > v.x && sx < v.x + W) c.fillRect(sx, sy, 1, 1); }
    // the northern lights
    for(let b = 0; b < 3; b++){
      c.fillStyle = b === 1 ? 'rgba(160,110,255,.16)' : 'rgba(80,255,170,.16)'; c.beginPath();
      const base = v.y + (hy - v.y) * (0.25 + b * 0.12);
      c.moveTo(v.x, base);
      for(let x = 0; x <= W; x += 12) c.lineTo(v.x + x, base + Math.sin(x * 0.02 + G.time * 0.5 + b + off * 0.3) * 14 * k);
      for(let x = W; x >= 0; x -= 12) c.lineTo(v.x + x, base + 26 * k + Math.sin(x * 0.025 + G.time * 0.4 + b * 2 + off * 0.3) * 10 * k);
      c.fill();
    }
    c.fillStyle = '#f4f1dc'; circ(c, v.x + W * 0.78, v.y + (hy - v.y) * 0.2, 7 * k); c.fill();
  } else if(!G.rain){
    const sunY = dusk ? hy - 16 * k : v.y + (hy - v.y) * 0.3, sunR = (dusk ? 22 : 10) * k;
    c.fillStyle = dusk ? 'rgba(255,220,150,.35)' : 'rgba(255,250,215,.35)'; circ(c, v.x + W * 0.72, sunY, sunR * 1.6); c.fill();
    c.fillStyle = dusk ? '#ffd27a' : 'rgba(255,248,220,.95)'; circ(c, v.x + W * 0.72, sunY, sunR); c.fill();
  }
  if(!night){
    c.fillStyle = G.rain ? 'rgba(90,98,112,.85)' : dusk ? 'rgba(255,190,160,.7)' : 'rgba(255,255,255,.85)';
    for(let i = 0; i < 5; i++){ const span = W * 1.6, cx = v.x - W * 0.3 + (rng(i * 3) * span + px(0.12, span)) % span, cy = v.y + (0.12 + rng(i * 5) * 0.3) * (hy - v.y); const r = (6 + rng(i) * 6) * k; circ(c, cx, cy, r); c.fill(); circ(c, cx + r, cy + r * 0.2, r * 0.8); c.fill(); circ(c, cx - r, cy + r * 0.25, r * 0.7); c.fill(); }
  }
  const hills = (par, base, amp, col, seed, freq) => layer(par, (x0, span) => { c.fillStyle = col; c.beginPath(); c.moveTo(x0, base); for(let i = 0; i <= 24; i++) c.lineTo(x0 + i * span / 24, base - (Math.sin(i * (freq || 0.9) + seed) * 0.5 + Math.sin(i * 2.3 + seed * 2) * 0.25 + 0.75) * amp); c.lineTo(x0 + span, base); c.fill(); });
  switch(def.biome){
    case 'meadow':
      hills(0.1, hy, 24 * k, '#7fae8a', 1); hills(0.22, hy, 14 * k, '#5f9e4a', 3);
      layer(0.3, (x0, span) => { for(let i = 0; i < 12; i++){ c.fillStyle = ['#8fbf55', '#c9b44a', '#6fa840', '#b6c85a'][i % 4]; c.fillRect(x0 + i * span / 12, hy - 3 * k, span / 12 - 1, 3 * k); } const wx = x0 + span * 0.35, wy = hy - 18 * k; c.fillStyle = '#f4efe2'; c.fillRect(wx - 1.5 * k, wy, 3 * k, 16 * k); c.strokeStyle = '#f4efe2'; c.lineWidth = 1; for(let b = 0; b < 4; b++){ const a = G.time * 1.5 + b * Math.PI / 2; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * 9 * k, wy + Math.sin(a) * 9 * k); c.stroke(); } });
      break;
    case 'beach':
      c.fillStyle = '#e07a5a'; c.fillRect(v.x, hy - 7 * k, W, 7 * k + 1);
      layer(0.2, (x0, span) => { for(let i = 0; i < 18; i++){ const bw = (6 + rng(i * 3) * 8) * k, bh = (8 + rng(i * 7) * 16) * k, bx = x0 + i * span / 18; c.fillStyle = '#7a4a5e'; c.fillRect(bx, hy - 7 * k - bh, bw, bh); c.fillStyle = 'rgba(255,217,138,.9)'; for(let yy = hy - 7 * k - bh + 2 * k; yy < hy - 9 * k; yy += 4 * k) if(rng(i * 13 + yy) < 0.5) c.fillRect(bx + 2 * k, yy, 1.4 * k, 1.4 * k); } });
      c.fillStyle = '#3a7ab0'; c.fillRect(v.x, hy - 2 * k, W, 2 * k + 1);
      c.fillStyle = 'rgba(255,220,150,.6)'; c.fillRect(v.x + W * 0.66, hy - 2 * k, W * 0.12, 2 * k);
      layer(0.4, (x0, span) => { for(let i = 0; i < 6; i++){ const bx = x0 + (i + 0.3) * span / 6; c.strokeStyle = '#5a3a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx, hy); c.quadraticCurveTo(bx + 2 * k, hy - 12 * k, bx + 5 * k, hy - 20 * k); c.stroke(); c.fillStyle = '#4a3a3a'; for(let f = 0; f < 5; f++){ const a = -Math.PI / 2 + (f - 2) * 0.6; c.beginPath(); c.ellipse(bx + 5 * k + Math.cos(a) * 5 * k, hy - 20 * k + Math.sin(a) * 3 * k, 5 * k, 1.2 * k, a, 0, Math.PI * 2); c.fill(); } } });
      break;
    case 'mountain':
      layer(0.08, (x0, span) => { for(let i = 0; i < 7; i++){ const bx = x0 + i * span / 7, h = (40 + rng(i * 3) * 30) * k, w = span / 5; c.fillStyle = '#7d8fa8'; c.beginPath(); c.moveTo(bx - w / 2, hy); c.lineTo(bx, hy - h); c.lineTo(bx + w / 2, hy); c.fill(); c.fillStyle = '#eef3f8'; c.beginPath(); c.moveTo(bx - w * 0.14, hy - h * 0.72); c.lineTo(bx, hy - h); c.lineTo(bx + w * 0.14, hy - h * 0.72); c.lineTo(bx + w * 0.05, hy - h * 0.66); c.lineTo(bx - w * 0.04, hy - h * 0.75); c.fill(); } });
      hills(0.2, hy, 16 * k, '#4f7a58', 2, 1.6);
      layer(0.3, (x0, span) => { c.fillStyle = '#2f5a3a'; for(let i = 0; i < 40; i++){ const tx = x0 + i * span / 40, h2 = (8 + rng(i) * 8) * k; c.beginPath(); c.moveTo(tx - 3 * k, hy); c.lineTo(tx, hy - h2); c.lineTo(tx + 3 * k, hy); c.fill(); } });
      break;
    case 'desert':
      layer(0.1, (x0, span) => { for(let i = 0; i < 5; i++){ if(rng(i + 3) < 0.3) continue; const bx = x0 + i * span / 5, w = (50 + rng(i + 2) * 40) * k, h = (18 + rng(i + 3) * 18) * k; c.fillStyle = '#d9894f'; c.beginPath(); c.moveTo(bx, hy); c.lineTo(bx + 8 * k, hy - h); c.lineTo(bx + w - 8 * k, hy - h); c.lineTo(bx + w, hy); c.fill(); c.fillStyle = '#c4703f'; c.fillRect(bx + 5 * k, hy - h * 0.55, w - 10 * k, 2 * k); } });
      hills(0.25, hy, 6 * k, '#e8bf7c', 4);
      break;
    case 'jungle':
      hills(0.08, hy, 30 * k, '#4f9a7a', 1, 1.3);
      layer(0.2, (x0, span) => { c.fillStyle = '#2f7a4a'; for(let i = 0; i < 26; i++){ const tx = x0 + i * span / 26, r = (6 + rng(i * 11) * 6) * k; circ(c, tx, hy - r * 0.6, r); c.fill(); } });
      c.fillStyle = 'rgba(220,255,230,.25)'; c.fillRect(v.x, hy - 10 * k, W, 10 * k);
      break;
    case 'savanna':
      layer(0.06, (x0, span) => { const mx = x0 + span * 0.3; c.fillStyle = '#b07a6a'; c.beginPath(); c.moveTo(mx - 60 * k, hy); c.lineTo(mx - 14 * k, hy - 34 * k); c.lineTo(mx + 14 * k, hy - 36 * k); c.lineTo(mx + 60 * k, hy); c.fill(); c.fillStyle = '#f4efe2'; c.beginPath(); c.moveTo(mx - 14 * k, hy - 34 * k); c.lineTo(mx + 14 * k, hy - 36 * k); c.lineTo(mx + 20 * k, hy - 28 * k); c.lineTo(mx - 20 * k, hy - 27 * k); c.fill(); });
      hills(0.18, hy, 5 * k, '#b08a45', 2);
      layer(0.3, (x0, span) => { c.fillStyle = '#3a2a1a'; for(let i = 0; i < 6; i++){ const tx = x0 + (i + rng(i)) * span / 6; c.fillRect(tx - 0.6, hy - 10 * k, 1.2, 10 * k); c.beginPath(); c.ellipse(tx, hy - 11 * k, 10 * k, 2.5 * k, 0, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#4a3a2e'; for(let i = 0; i < 3; i++){ const ex = x0 + span * (0.55 + i * 0.05); c.beginPath(); c.ellipse(ex, hy - 4 * k, 4 * k, 2.6 * k, 0, 0, Math.PI * 2); c.fill(); c.fillRect(ex - 3 * k, hy - 3 * k, 1, 3 * k); c.fillRect(ex + 2 * k, hy - 3 * k, 1, 3 * k); } });
      break;
    case 'tundra':
      layer(0.08, (x0, span) => { for(let i = 0; i < 6; i++){ const bx = x0 + i * span / 6, h = (30 + rng(i * 5) * 26) * k, w = span / 4.5; c.fillStyle = '#26345a'; c.beginPath(); c.moveTo(bx - w / 2, hy); c.lineTo(bx, hy - h); c.lineTo(bx + w / 2, hy); c.fill(); c.fillStyle = '#9fb3d6'; c.beginPath(); c.moveTo(bx - w * 0.12, hy - h * 0.75); c.lineTo(bx, hy - h); c.lineTo(bx + w * 0.12, hy - h * 0.75); c.fill(); } });
      hills(0.2, hy, 8 * k, '#8ea4c4', 3);
      break;
  }
  if(G.rain){ c.fillStyle = 'rgba(120,130,145,.25)'; c.fillRect(v.x, v.y, W, hy - v.y); }
}

/* ---------- HUD ---------- */
function chip(c, x, y, label, col, h){
  c.font = (h * 0.62) + 'px ' + FONT; const w = c.measureText(label).width + h * 0.6;
  c.fillStyle = col; rr(c, x, y, w, h, h * 0.25); c.fill();
  text(c, label, x + h * 0.3, y + h * 0.2, h * 0.62, '#101014');
  return w + 2;
}
function nitroCans(c, x, y, w, h, r){
  for(let i = 0; i < 3; i++){
    const fill = clamp((r.nitro - i * 34) / 34, 0, 1), cx = x + i * (w + 2);
    c.fillStyle = 'rgba(10,10,14,.6)'; rr(c, cx, y, w, h, 1.5); c.fill();
    c.fillStyle = r.nitroT > 0 ? '#fff3b0' : fill >= 1 ? (Math.floor(G.time * 4) % 2 ? '#ff9f43' : '#ffb86a') : '#b0643a';
    if(fill > 0) c.fillRect(cx + 1, y + 1 + (h - 2) * (1 - fill), w - 2, (h - 2) * fill);
  }
}
function balanceBar(c, x, y, w, h, r){
  c.fillStyle = 'rgba(10,10,14,.6)'; rr(c, x - 1, y - 1, w + 2, h + 2, 1.5); c.fill();
  const b = r.bal / 100, col = r.stagT > 0 ? (Math.floor(G.time * 8) % 2 ? '#ff5a4e' : '#ffd166') : b > 0.7 ? '#ff5a4e' : b > 0.4 ? '#f5c542' : '#3fd07a';
  c.fillStyle = col; c.fillRect(x, y, w * b, h);
  if(r.blk){ c.strokeStyle = '#7fe3ff'; c.lineWidth = 1; c.strokeRect(x - 1, y - 1, w + 2, h + 2); }
}
function drawHUD(c){
  const hum = G.riders.filter(r => r.human).sort((a, b) => (a.slot || 0) - (b.slot || 0)), n = hum.length;
  // race progress strip: every rider on one line, finish flag at the end
  const bx = VW / 2 - 70, bw = 140, by = 5;
  c.fillStyle = 'rgba(10,10,14,.55)'; rr(c, bx - 6, by - 3, bw + 12, 10, 3); c.fill();
  c.fillStyle = 'rgba(244,239,226,.4)'; c.fillRect(bx, by + 2, bw, 1);
  for(let i = 0; i < 4; i++){ c.fillStyle = i % 2 ? '#17181d' : '#f4f1ea'; c.fillRect(bx + bw - 3 + (i % 2) * 2, by - 1 + Math.floor(i / 2) * 3, 2, 3); }
  const dots = G.riders.slice().sort((a, b) => (a.human ? 1 : 0) - (b.human ? 1 : 0));
  for(const r of dots){
    if(r.police && r.leaving) continue;
    const px = bx + progress(r) * bw;
    if(r.police){ c.fillStyle = Math.floor(G.time * 6) % 2 ? '#3f7bff' : '#ff3b30'; c.fillRect(px - 1.5, by + 1, 3, 3); continue; }
    c.fillStyle = r.ghost ? 'rgba(233,236,241,.6)' : r.color; circ(c, px, by + 2.5, r.human ? 2.4 : 1.6); c.fill();
    if(r.human){ c.strokeStyle = '#fff'; c.lineWidth = 0.7; c.stroke(); }
  }
  if(G.state === 'race' || G.state === 'finishing') text(c, fmt(G.raceT), bx + bw / 2, by + 7, 5, '#f4efe2', 'center');
  // one panel per player
  const corners = n <= 1 ? null : [[3, 3], [VW - 95, 3], [3, VH - 31], [VW - 95, VH - 31]];
  hum.forEach((r, i) => { if(n <= 1) bigPanel(c, r); else smallPanel(c, r, corners[i][0], corners[i][1]); });
  // start lights / countdown
  if(G.state === 'count'){
    const left = 3 - G.stateT, num = Math.ceil(left);
    if(num >= 1 && num <= 3){ const f = left - Math.floor(left); outlined(c, String(num), VW / 2, VH * 0.36, 26 + f * 10, num === 1 ? '#ffd166' : '#f4efe2'); }
  } else if(G.state === 'race' && G.raceT < 1){ outlined(c, 'GO!', VW / 2, VH * 0.36, 28, '#3fd07a'); }
  if(G.copWarn > 0 && (G.copMsg !== 'POLICE BEHIND!' || Math.floor(G.time * 5) % 2)){ c.fillStyle = 'rgba(20,30,80,.8)'; rr(c, VW / 2 - 60, 22, 120, 14, 3); c.fill(); outlined(c, G.copMsg || 'POLICE BEHIND!', VW / 2, 29, 7, '#7fb0ff'); }
  const lim = G.tt ? 0 : D().limit;
  if(lim && G.firstFinish >= 0 && G.state === 'race' && hum.some(r => r.fin < 0)){ const left = Math.max(0, lim - (G.raceT - G.firstFinish)); outlined(c, 'FINISH IN ' + Math.ceil(left), VW / 2, 42, 7, '#ff8a6a'); }
  if(G.tt){ const g = G.riders.find(r => r.ghost), me = hum[0]; if(g && me && G.state === 'race'){ const dd = (me.dist - g.dist) / Math.max(3000, me.v); outlined(c, (dd >= 0 ? '-' : '+') + Math.abs(dd).toFixed(1) + 's vs ' + g.name.toUpperCase(), VW / 2, 22, 5.5, dd >= 0 ? '#3fd07a' : '#ff8a6a'); } }
  if(G.state === 'count' || (G.state === 'race' && G.raceT < 4)){
    const t = A.Input.isTouch;
    const tip = t ? 'STICK STEER · ▼ BRAKE · ▲ NITRO · HIT PUNCH · ▼+HIT KICK · HOLD HIT BLOCK' : '◀ ▶ STEER · ▼ BRAKE · ▲ NITRO · FIRE PUNCH · ▼+FIRE KICK · HOLD FIRE BLOCK';
    const sz = fitText(c, tip, VW - 20, 5);
    const ty = touchShown ? VH * 0.6 : VH - (n > 2 ? 44 : 13);
    c.fillStyle = 'rgba(10,10,14,.72)'; c.fillRect(8, ty, VW - 16, 11);
    text(c, tip, VW / 2, ty + 2, sz, '#f4efe2', 'center');
  }
}
function bigPanel(c, r){
  const pl = place(r), total = G.order.length;
  if(!G.tt && total > 1){ outlined(c, 'P' + pl, 16, 14, 15, pl === 1 ? '#f5c542' : '#f4efe2'); text(c, '/' + total, 28, 9, 6, '#c9c6d6'); }
  const nm = (r.name || '').toUpperCase(); text(c, nm, 5, G.tt || total <= 1 ? 5 : 24, fitText(c, nm, 70, 5), r.color);
  // score and combo
  if(!G.tt){ text(c, r.score.toLocaleString(), VW - 5, 5, 7, '#f4efe2', 'right'); if(r.mult > 1) outlined(c, 'x' + r.mult, VW - 12, 18, 9, '#ff7eb6'); }
  // balance + nitro (moved clear of the stick and HIT button on phones)
  const tch = touchShown, x0 = 6, y0 = tch ? 44 : VH - 26;
  c.fillStyle = 'rgba(10,10,14,.45)'; rr(c, x0 - 3, y0 - 10, 72, 26, 3); c.fill();
  text(c, 'BALANCE', x0, y0 - 7, 4.5, r.stagT > 0 ? '#ff5a4e' : '#e3e0ee'); balanceBar(c, x0, y0, 64, 4, r);
  text(c, 'NITRO', x0, y0 + 7, 4.5, '#e3e0ee'); nitroCans(c, x0 + 26, y0 + 6, 12, 7, r);
  if(r.nitro >= 34 && r.nitroT <= 0 && Math.floor(G.time * 2) % 2) text(c, A.Input.isTouch ? '▲ = NITRO!' : 'UP = NITRO!', x0 + 70, y0 + 7, 4.5, '#ff9f43');
  // speed
  const kmh = Math.round(r.v * KMH);
  const sy0 = tch ? 44 : VH - 18;
  outlined(c, String(kmh), VW - 24, sy0, 13, r.nitroT > 0 ? '#ffb86a' : '#f4efe2');
  text(c, 'KM/H', VW - 5, sy0 + 9, 4.5, '#c9c6d6', 'right');
  if(r.streak >= 2) text(c, 'STREAK ' + Math.floor(r.streak) + 's', VW - 5, tch ? sy0 + 16 : VH - 33, 5, '#7fe3ff', 'right');
  let cx = x0 + 70; const cy = y0 - 8;
  if(r.blk) cx += chip(c, cx, cy, 'BLOCK', '#7fe3ff', 7);
  if(r.nitroT > 0) cx += chip(c, cx, cy, 'NITRO', '#ff9f43', 7);
  if(r.towT > 0) cx += chip(c, cx, cy, 'TOW', '#e9ecf1', 7);
  if(r.fin >= 0) outlined(c, 'FINISHED ' + ordinal(pl), VW / 2, VH * 0.26, 11, pl <= 3 ? '#f5c542' : '#f4efe2');
}
function smallPanel(c, r, x, y){
  const pl = place(r), w = 92, h = 28;
  c.fillStyle = 'rgba(10,10,14,.6)'; rr(c, x, y, w, h, 3); c.fill();
  c.fillStyle = r.color; c.fillRect(x, y, 2, h);
  if(!G.tt) outlined(c, 'P' + pl, x + 11, y + 6, 8, pl === 1 ? '#f5c542' : '#f4efe2', 'center');
  const nm = (r.name || '').toUpperCase(); text(c, nm, x + (G.tt ? 5 : 20), y + 3, fitText(c, nm, 40, 5), r.color);
  if(r.fin >= 0) text(c, 'DONE ' + ordinal(pl), x + w - 3, y + 3, 5, '#f5c542', 'right');
  else text(c, Math.round(r.v * KMH) + ' KM/H', x + w - 3, y + 3, 5, r.nitroT > 0 ? '#ffb86a' : '#f4efe2', 'right');
  balanceBar(c, x + 5, y + 13, 50, 3, r);
  nitroCans(c, x + 60, y + 11, 8, 7, r);
  if(!G.tt) text(c, r.score.toLocaleString() + (r.mult > 1 ? ' x' + r.mult : ''), x + 5, y + 20, 4.5, r.mult > 1 ? '#ff7eb6' : '#c9c6d6');
  if(r.blk) text(c, 'BLOCK', x + w - 3, y + 20, 4.5, '#7fe3ff', 'right');
  else if(r.stagT > 0) text(c, 'DIZZY', x + w - 3, y + 20, 4.5, '#ff5a4e', 'right');
}

/* ---------- Podium and champion ---------- */
function drawPodium(c){
  const def = TK.def, v = { x: 0, y: 0, w: VW, h: VH }, hy = VH * 0.55;
  drawBackdrop(c, v, hy, 0, def);
  c.fillStyle = def.ground[0]; c.fillRect(0, hy, VW, VH - hy);
  c.fillStyle = shade(def.road[0], 1); c.beginPath(); c.moveTo(VW * 0.2, VH); c.lineTo(VW * 0.47, hy); c.lineTo(VW * 0.53, hy); c.lineTo(VW * 0.8, VH); c.fill();
  const rows = (G.results && G.results.rows || []).slice(0, 3), cxp = VW * 0.66;
  const blocks = [[cxp, 50, 1], [cxp - 58, 34, 2], [cxp + 58, 24, 3]];
  G.podiumDraw = true;
  for(const [bx, h, n] of blocks){
    c.fillStyle = '#e9ecf1'; c.fillRect(bx - 26, VH - 20 - h, 52, h); c.fillStyle = '#c9ced8'; c.fillRect(bx - 26, VH - 20 - h, 52, 4);
    text(c, String(n), bx, VH - 20 - h / 2, 14, n === 1 ? '#d4a017' : '#6a6f7a', 'center', 'middle');
    const r = rows[n - 1]; if(!r) continue;
    const fake = { id: r.id, human: !r.cpu, color: r.color, name: r.name, style: r.style, lean: Math.sin(G.time * 2 + n) * 0.1, h: 0, dist: 0, v: 0, bal: 0, atkT: n === 1 ? (0.26 * (0.5 + 0.5 * Math.sin(G.time * 4))) : 0, atkKind: 'punch', atkSide: 1, stagT: 0, fallT: 0, invT: 0, nitroT: 0, msgT: 0 };
    drawRider(c, fake, bx, VH - 20 - h, 0.045 * (n === 1 ? 1.1 : 1), VH - 20 - h);
    const nm = r.name.toUpperCase(); outlined(c, nm, bx, VH - 20 - h - 44, fitText(c, nm, 60, 7), r.color);
    if(n === 1){ c.fillStyle = '#f5c542'; c.beginPath(); c.moveTo(bx - 7, VH - 20 - h - 72); c.lineTo(bx + 7, VH - 20 - h - 72); c.lineTo(bx + 4, VH - 20 - h - 60); c.lineTo(bx - 4, VH - 20 - h - 60); c.fill(); c.fillRect(bx - 1, VH - 20 - h - 60, 2, 4); c.fillRect(bx - 5, VH - 20 - h - 56, 10, 2); }
  }
  G.podiumDraw = false;
  for(let i = 0; i < 70; i++){ const x = (rng(i) * VW + Math.sin(G.time + i) * 10) % VW, y = (rng(i + 7) * VH + G.time * (30 + rng(i + 3) * 40)) % VH; c.fillStyle = 'hsl(' + Math.floor(rng(i + 1) * 360) + ',85%,62%)'; c.fillRect(x, y, 2, 3); }
  if(G.state === 'results') return;
  outlined(c, G.state === 'champion' ? 'CHAMPION!' : G.tt ? 'TIME TRIAL' : 'CHEQUERED FLAG', VW * 0.66, 18, 12, '#f5c542');
  outlined(c, def.name.toUpperCase() + ' · ' + D().label.toUpperCase(), VW * 0.66, 32, 5.5, '#f4efe2');
  if(G.state === 'champion' && G.champWinner){ c.fillStyle = 'rgba(10,10,14,.45)'; c.fillRect(VW * 0.4, 44, VW * 0.55, 20); outlined(c, G.champWinner.name.toUpperCase() + ' WINS THE CUP!', VW * 0.66, 54, 7, G.champWinner.color); }
  if(G.state === 'podium' && G.stateT > 1.5 && G.net !== 'guest') text(c, A.Input.isTouch ? 'TAP HIT FOR RESULTS' : 'PRESS FIRE FOR RESULTS', VW * 0.66, VH - 10, 5, 'rgba(244,239,226,.7)', 'center');
}

/* ---------- Main render ---------- */
let sirenT = 0, honkT = 0;
function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  if(!TK || !G.riders.length) return;
  c.setTransform(s, 0, 0, s, 0, 0);
  humansCount = G.riders.filter(r => r.human).length;
  fxStep(Math.min(0.05, dt));
  if(!G.demo && (G.state === 'podium' || G.state === 'results' || G.state === 'champion')){ drawPodium(c); engine(null); return; }
  drawWorld(c, { x: 0, y: 0, w: VW, h: VH });
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.3)'; c.fillRect(0, 0, VW, VH); }
  else drawHUD(c);
  const mine = myRiders(), focus = mine.find(r => r.fin < 0) || mine[0] || null;
  engine(G.demo ? null : focus);
  // sirens when a police bike is near, honks when you tailgate (worked out on every screen)
  if(!G.demo && (G.state === 'race' || G.state === 'finishing')){
    sirenT -= dt; honkT -= dt;
    if(sirenT <= 0 && G.riders.some(r => r.police && !r.leaving && Math.abs(r.dist - (cam.focus || 0)) < 25 * SEG)){ sirenT = 1.0; try{ SX.siren(A.Sound); }catch(e){} }
    if(focus && honkT <= 0 && TK.veh.some(q => q.z - focus.dist > BIKE_L && q.z - focus.dist < 900 && Math.abs(q.x - focus.x) < q.w / 2 + 0.05) && Math.random() < 0.02){ honkT = 2.5; try{ SX.honk(A.Sound); }catch(e){} }
  }
}

/* Motorbike engine for the bike this screen follows: it revs up through the gears */
const Motor = { a: null, b: null, gain: null, filt: null };
const GEARS = [0.2, 0.36, 0.52, 0.68, 0.84, 1.3];
function engine(r){
  const S0 = A.Sound;
  if(!S0.ctx || S0.ctx.state !== 'running') return;
  if(!Motor.a){
    const c = S0.ctx;
    Motor.a = c.createOscillator(); Motor.a.type = 'sawtooth';
    Motor.b = c.createOscillator(); Motor.b.type = 'square';
    Motor.filt = c.createBiquadFilter(); Motor.filt.type = 'lowpass'; Motor.filt.frequency.value = 700; Motor.filt.Q.value = 3;
    Motor.gain = c.createGain(); Motor.gain.gain.value = 0;
    const bg = c.createGain(); bg.gain.value = 0.4;
    Motor.a.connect(Motor.filt); Motor.b.connect(bg); bg.connect(Motor.filt); Motor.filt.connect(Motor.gain); Motor.gain.connect(S0.bus);
    Motor.a.start(); Motor.b.start();
  }
  const live = r && (G.state === 'race' || G.state === 'finishing' || G.state === 'count') && r.fallT <= 0;
  const t = S0.ctx.currentTime, sp = r ? r.v / MAXV : 0;
  let g = 0; while(g < GEARS.length - 1 && sp > GEARS[g]) g++;
  const lo = g ? GEARS[g - 1] : 0, rpm = clamp((sp - lo) / (GEARS[g] - lo), 0, 1);
  const f = (G.state === 'count' ? 55 + Math.sin(G.time * 9) * 6 : 48 + rpm * 70 + g * 7) + (r && r.nitroT > 0 ? 25 : 0);
  Motor.a.frequency.setTargetAtTime(f, t, 0.05); Motor.b.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  Motor.filt.frequency.setTargetAtTime(400 + rpm * 900 + g * 80, t, 0.06);
  Motor.gain.gain.setTargetAtTime(live ? 0.028 + rpm * 0.012 : 0, t, 0.1);
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('HIT');
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
window.__brawl = G;
window.__brawlDebug = { Net, TK: () => TK, TRACKS, RIVALS, buildTrack, newRace, startChampionship, finishRace, resultsMenu, sim, step, place, fall, stagger, hit, startAttack,
  makeRider, stepRider, orderRiders, trafficAt, crossX, crossActive, laneCost, cam, V, camFocus, setupRace, titleMenu, CROSS, medalFor, TRACK_PAR, BIKES, render, display };
})();
