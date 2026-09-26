/* STRIKE FORCE — a run-and-gun robot-busting adventure for 1–4 players on one shared screen, or online.
   General Rustbolt's Scrap Army has stolen the Sky Crystal. Run, jump and blast through six stages:
   a jungle outpost, a waterfall climb, a frozen base, a scrap factory, a jet-board chase in the sky
   and the Iron Citadel. D-pad runs, UP jumps (keep holding it to aim up), DOWN crouches (aims down
   in the air), FIRE shoots (hold it for rapid fire). Every robot you beat gets recycled: no blood,
   just bolts and springs. All characters, levels, music and sounds are original and made in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants ---------- */
const VW = 384, VH = 216, T = 16, ROWS = 14;
const FONT = '"Silkscreen","Courier New",monospace';
const RUN = 92, GROUND_ACC = 1400, AIR_ACC = 900, ICE_ACC = 260, GRAV = 1000, GRAV_CUT = 2000, JUMP_V = 338, MAX_FALL = 430;
const PW = 10, STAND_H = 22, CROUCH_H = 12, BALL_H = 14, MECH_W = 22, MECH_H = 30;
const SOLID = new Set(['#', 'X', 'c', '>', '<', 'z', 'i', 'D']);
const isSolid = ch => SOLID.has(ch);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const DIFF = {
  kids:   { label: 'Kids',   hearts: 5, lives: Infinity, extra: 0, pitBounce: true,  fire: 0.5,  bspeed: 0.68, ehp: 0.7, bhp: 0.55, keep: 2, runners: 0.5, assist: true },
  normal: { label: 'Normal', hearts: 3, lives: 4,        extra: 2, pitBounce: false, fire: 1.0,  bspeed: 1.0,  ehp: 1.0, bhp: 1.0,  keep: 1, runners: 1.0, assist: false },
  pro:    { label: 'Pro',    hearts: 1, lives: 3,        extra: 1, pitBounce: false, fire: 1.35, bspeed: 1.2,  ehp: 1.2, bhp: 1.3,  keep: 0, runners: 1.4, assist: false }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];

/* ---------- Weapons: pick up the same one again to power it up (up to level 3) ---------- */
const WEAPONS = {
  blaster: { name: 'BLASTER',  col: '#fff3a8', rate: [0.15, 0.11, 0.1],  max: [5, 7, 10], spd: 330, dmg: [1, 1, 1] },
  fan:     { name: 'FAN SHOT', col: '#ff8a5c', rate: [0.24, 0.22, 0.2],  max: [15, 20, 26], spd: 290, dmg: [1, 1, 1.4], ways: [3, 5, 5] },
  beam:    { name: 'BEAM',     col: '#7fe3ff', rate: [0.3, 0.26, 0.22],  max: [2, 3, 3],  spd: 520, dmg: [2, 3, 4] },
  seek:    { name: 'SEEKER',   col: '#b48cff', rate: [0.27, 0.22, 0.18], max: [3, 4, 5],  spd: 215, dmg: [2, 2, 3] }
};
const W_ORDER = ['blaster', 'fan', 'beam', 'seek'];
const ITEM_KINDS = ['fan', 'beam', 'seek', 'shield', 'nova', 'heart'];
const ITEM_NAMES = { fan: 'FAN SHOT!', beam: 'BEAM!', seek: 'SEEKERS!', shield: 'SHIELD!', nova: 'NOVA BLAST!', heart: 'REPAIR!' };

/* ---------- Music: original themes ---------- */
const JUNGLE_THEME = {
  bpm: 156, chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'], bass: 'gallop', arp: 'fast', leadVol: 0.07,
  lead: [
    'E5 - - B4 E5 - G5 - F#5 - E5 - D5 - E5 -', 'B5 - - - A5 - G5 - F#5 - G5 - A5 - - -',
    'G5 - - E5 G5 - C6 - B5 - A5 - G5 - E5 -', 'F#5 - - - D5 - F#5 - A5 - - - F#5 - D5 -',
    'E5 - - B4 E5 - G5 - B5 - - - A5 - G5 -', 'E6 - - - D6 - B5 - G5 - A5 - B5 - - -',
    'C6 - B5 - A5 - G5 - E5 - G5 - A5 - C6 -', 'B5 - - - - - - - D#5 - - - F#5 - - -'],
  drums: ['k.hsk.hsk.hskkhs', 'k.hsk.hsk.hsk.ss']
};
const FALLS_THEME = {
  bpm: 132, chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'], bass: 'drive', arp: 'slow', leadVol: 0.075,
  lead: [
    'D5 - F5 - A5 - - - G5 - F5 - E5 - F5 -', 'D5 - - - Bb4 - D5 - F5 - - - E5 - D5 -',
    'C5 - F5 - A5 - C6 - - - A5 - G5 - F5 -', 'E5 - - - G5 - - - C5 - - - . . . .',
    'A5 - - - D6 - - - C6 - A5 - F5 - A5 -', 'Bb5 - - - A5 - F5 - D5 - F5 - Bb5 - - -',
    'G5 - Bb5 - D6 - - - C6 - Bb5 - A5 - G5 -', 'A5 - - - - - - - C#6 - - - E6 - - -'],
  drums: ['k...s...k.k.s...', 'k...s...k.k.s.hs']
};
const FROST_THEME = {
  bpm: 146, chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'], bass: 'pulse', arp: 'fast', leadWave: 'triangle', leadVol: 0.11, arpOct: 1,
  lead: [
    'A5 - E5 - A5 - C6 - B5 - A5 - E5 - - -', 'G5 - D5 - G5 - B5 - A5 - G5 - D5 - - -',
    'F5 - A5 - C6 - F6 - E6 - C6 - A5 - - -', 'E5 - G#5 - B5 - E6 - D6 - B5 - G#5 - - -',
    'C6 - - - B5 - A5 - E6 - - - C6 - A5 -', 'B5 - - - A5 - G5 - D6 - - - B5 - G5 -',
    'A5 - C6 - F6 - E6 - C6 - A5 - F5 - A5 -', 'G#5 - - - - - - - B5 - - - E6 - - -'],
  drums: ['k.h.s.h.k.h.s.h.', 'k.h.s.h.k.hks.hh']
};
const FACTORY_THEME = {
  bpm: 138, chords: ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'G'], bass: 'drive', arp: 'fast', leadWave: 'sawtooth', leadVol: 0.05,
  lead: [
    'C5 - C5 - Eb5 - C5 - G5 - - - F5 - Eb5 -', 'D5 - - - C5 - Bb4 - C5 - - - . . G4 -',
    'Ab4 - C5 - Eb5 - Ab5 - G5 - - - Eb5 - C5 -', 'Bb4 - D5 - F5 - Bb5 - Ab5 - G5 - F5 - D5 -',
    'C6 - - - G5 - - - Eb5 - - - C5 - Eb5 -', 'F5 - Eb5 - D5 - C5 - D5 - - - G4 - - -',
    'Ab5 - - - G5 - F5 - Eb5 - F5 - G5 - Ab5 -', 'G5 - - - - - - - B4 - - - D5 - - -'],
  drums: ['k..hs.k.k..hs.hh', 'k..hs.k.k.khs.ss']
};
const SKY_THEME = {
  bpm: 168, chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'], bass: 'drive', arp: 'fast', leadVol: 0.07,
  lead: [
    'D5 - F#5 - A5 - D6 - - - C#6 - A5 - F#5 -', 'E5 - - - C#6 - - - A5 - - - E5 - - -',
    'F#5 - B5 - D6 - F#6 - - - E6 - D6 - B5 -', 'D6 - - - B5 - G5 - B5 - - - D6 - - -',
    'A5 - D6 - F#6 - - - E6 - D6 - C#6 - D6 -', 'E6 - - - A5 - C#6 - E6 - - - A6 - - -',
    'G6 - F#6 - E6 - D6 - B5 - D6 - G6 - - -', 'F#6 - - - E6 - - - C#6 - - - A5 - - -'],
  drums: ['k.hsk.hsk.hsk.hs', 'kkhsk.hskkhsk.ss']
};
const CITADEL_THEME = {
  bpm: 150, chords: ['Bm', 'G', 'Em', 'F#', 'Bm', 'G', 'Em', 'F#'], bass: 'gallop', arp: 'fast', leadVol: 0.07,
  lead: [
    'B4 - - D5 F#5 - - - B5 - A5 - F#5 - D5 -', 'G5 - - - F#5 - E5 - D5 - E5 - F#5 - - -',
    'E5 - - G5 B5 - - - E6 - D6 - B5 - G5 -', 'F#5 - - - A#5 - C#6 - F#6 - - - - - - -',
    'B5 - - - D6 - C#6 - B5 - F#5 - D5 - F#5 -', 'G5 - - - B5 - D6 - G6 - F#6 - E6 - D6 -',
    'E6 - D6 - B5 - G5 - E5 - G5 - B5 - E6 -', 'F#6 - - - C#6 - - - A#5 - - - F#5 - - -'],
  drums: ['k.hsk.hsk.hsk.hs', 'k.hsk.hskkhskkss']
};
const BOSS_THEME = {
  bpm: 172, chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'Am', 'B'], bass: 'gallop', arp: 'fast', leadVol: 0.07,
  lead: [
    'E5 - E5 - G5 - E5 - B5 - - - A5 - G5 -', 'E5 - - - G5 - C6 - B5 - - - G5 - E5 -',
    'A5 - - - C6 - A5 - E5 - - - A5 - C6 -', 'B5 - - - D#6 - - - F#6 - - - B5 - - -',
    'E6 - - - D6 - B5 - G5 - B5 - D6 - E6 -', 'G6 - - - E6 - C6 - G5 - C6 - E6 - G6 -',
    'A6 - - - E6 - C6 - A5 - C6 - E6 - A6 -', 'B6 - - - A6 - F#6 - D#6 - - - B5 - - -'],
  drums: ['kkhsk.hskkhsk.hs', 'kkhskkhskkhsksss']
};
const FINAL_THEME = {
  bpm: 180, chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Fm', 'G'], bass: 'gallop', arp: 'fast', leadWave: 'sawtooth', leadVol: 0.055,
  lead: [
    'C5 - Eb5 - G5 - C6 - B5 - G5 - Eb5 - D5 -', 'C5 - - - Eb5 - Ab5 - G5 - - - Eb5 - C5 -',
    'F5 - Ab5 - C6 - F6 - Eb6 - C6 - Ab5 - F5 -', 'G5 - - - B5 - D6 - G6 - - - F6 - D6 -',
    'Eb6 - - - D6 - C6 - G5 - - - C6 - Eb6 -', 'Ab6 - - - G6 - Eb6 - C6 - - - Eb6 - Ab6 -',
    'F6 - Eb6 - C6 - Ab5 - F5 - Ab5 - C6 - F6 -', 'G6 - - - F6 - D6 - B5 - - - G5 - - -'],
  drums: ['kkhsk.hskkhskkhs', 'kkhskkhskkhskkss']
};
const ENDING_THEME = {
  bpm: 110, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], bass: 'walk', arp: 'slow', leadVol: 0.08,
  lead: [
    'G5 - - - E5 - C5 - E5 - G5 - C6 - - -', 'B5 - - - G5 - D5 - G5 - B5 - D6 - - -',
    'C6 - - - A5 - E5 - A5 - C6 - E6 - - -', 'D6 - C6 - A5 - F5 - A5 - - - C6 - - -',
    'E6 - - - D6 - C6 - G5 - - - C6 - E6 -', 'D6 - - - B5 - G5 - D6 - - - G6 - - -',
    'F6 - E6 - D6 - C6 - A5 - C6 - F6 - - -', 'E6 - - - - - - - C6 - - - - - - -'],
  drums: ['k...h...s...h...', 'k...h...s...h.k.']
};
const SHIELD_THEME = {
  bpm: 190, chords: ['E', 'A', 'E', 'B'], bass: 'drive', arp: 'fast', leadVol: 0.07,
  lead: ['E6 - B5 - E6 - G#6 - B6 - G#6 - E6 - B5 -', 'A5 - C#6 - E6 - A6 - E6 - C#6 - A5 - C#6 -',
         'G#5 - B5 - E6 - B5 - G#5 - B5 - E6 - G#6 -', 'F#6 - D#6 - B5 - F#5 - B5 - D#6 - F#6 - B6 -'],
  drums: ['k.hsk.hsk.hsk.hs']
};

/* ---------- Stages ----------
   Side stages are built from pieces (like Hop Hero). Rows are bottom-aligned; the last two rows are ground.
   Tiles: # ground   X rock/metal   = one-way ledge (jump up through it, double-tap DOWN to drop)
          c crumbling bridge   ~ water (wade in it, DOWN dives)   > < conveyor   z zap floor   i ice   D breakable wall
   Things: g Blip Bot (shooter)   t Swivel turret   f Buzzer drone   m Lobber (mortar)   h Peeker (hides in bushes)
          o Rolly spawner (or falling rocks on the waterfall)   k Trundle tank   j Jetter spawn   W Stomp Walker
          p supply crate   1-6 crate with fan/beam/seeker/shield/nova/repair   P supply pod flies over
          M Stomper mech to ride   G gold gear (secret)   C checkpoint beacon   u crusher   B boss   @ start */
const CH = {
  S: ['..........', '..........', '.@........', '##########', '##########'],
  ledges: ['..........g...', '.........====.', '..............', '...g..........', '..====........', '..............', '..............', '##############', '##############'],
  ledges2: ['....G.........', '...===........', '..............', '..........h...', '........=====.', '..............', '..............', '##############', '##############'],
  ledges3: ['.......p......', '......====....', '..............', '..h.......g...', '.=====...=====', '..............', '..............', '##############', '##############'],
  bunker: ['.....t......', '....XXXX....', '...XXXXXX...', '############', '############'],
  bunker2: ['....g...t....', '...XXXXXXX...', '..XXXXXXXXX..', '#############', '#############'],
  igloo: ['......m.......', '....XXXXX.....', '...XXXXXXX....', '##############', '##############'],
  icefield: ['..............', '..h.......g...', 'iiiiiiiiiiiiii', '##############'],
  icefield2: ['..f...........', '..............', '......k.......', 'iiiiiiiiiiiiii', '##############'],
  conv: ['..g.........', '>>>>>>>>>>>>', '############'],
  conv2: ['.........g..', '<<<<<<<<<<<<', '############'],
  crusher: ['...u.....u..', '############', '############'],
  zap: ['.....h......', '....zzzz....', '############'],
  zap2: ['..t.........', '..XX..zzzz..', '############']
};
const CH_ABS = {
  bridge: ['###cccccccccc###', '###..........###', '###~~~~~~~~~~###', '################']
};
CH_ABS.bridge2 = ['###cccccccccccc###', '###............###', '###~~~~~~~~~~~~###', '##################'];
const ARENAS = [
  ['........................', '...=====...=====........', '........................', '..@...............B.....', '########################', '########################'],
  null,
  ['........................', '........................', '........................', '..======................', '........................', '..@...............B.....', '########################', '########################'],
  ['..........B.............', '........................', '........................', '........................', '........................', '........................', '..=====..........=====..', '........................', '..@.....................', '########################', '########################'],
  null,
  ['........................', '........................', '........................', '....====................', '........................', '........................', '.========...............', '........................', '..@...............B.....', '########################', '########################']
];

/* The waterfall climb is authored top to bottom, 22 columns inside rock walls. Ledges are 3 rows apart. */
const FALLS_MAP = [
  'XXXXXXXXXXXXXXXXXXXXXX',  // 0
  '......................',
  '......................',
  '......................',
  '..........B...........',
  '......................',  // 5
  '......................',
  '..======......======..',
  '......................',
  '......................',
  '=====.....======..====',  // 10
  '......................',
  '......................',
  '======================',
  '......................',
  '.................g....',  // 15
  '.....======....======.',
  '......................',
  '...............p......',
  '======.....P.======...',
  '......................',  // 20
  '.........h............',
  '.......======.........',
  '...j..................',
  '................g.....',
  '..======......======..',  // 25
  '......................',
  '...........o..........',
  '.........======.......',
  '....................G.',
  '......................',  // 30
  '.....======......=====',
  '......................',
  '..g......o............',
  '======......======....',
  '......................',  // 35
  '..........h...........',
  '.......======.........',
  '......................',
  '...p..................',
  '..=====........=======',  // 40
  '......................',
  '..............h.......',
  '...........=======....',
  '......................',
  '.......g..............',  // 45
  '.....======.........j.',
  '......................',
  '...............h......',
  '======.......======...',
  '..........P...........',  // 50
  '..........C...........',
  '.......=======........',
  '......................',
  '..................g...',
  '..======.......=======',  // 55
  '......................',
  '.j....................',
  '..........======......',
  '............o.........',
  '......................',  // 60
  '...======.......=====.',
  '......................',
  '...........h..........',
  '.......========.......',
  '......................',  // 65
  '..................p...',
  '=====..........=======',
  '......................',
  '.........h............',
  '.......======.........',  // 70
  '......................',
  '................g.....',
  '..=====.......=====...',
  '......................',
  '..@...................',  // 75
  '######################',
  '######################',
];

const STAGES = [
  { key: 'jungle', code: '1', name: 'Jungle Outpost', kind: 'side', music: JUNGLE_THEME, boss: 0, runners: 2.6,
    pool: ['fan', 'beam', 'seek', 'heart', 'fan', 'shield'],
    parts: 'S F8 F8g F4 P F6h F6g ledges F4 F6gt R1 F4 R2 F4g bridge F4 R0 F6 W8 F6 F6p C F8gh P F6 ledges2 F8m G3 F6g bunker F6h F6k F4 G2 F6 P F4 R1 F4g R2 F6h R0 F8 C F6t F6gg ledges3 F8 A0',
    fact: 'Stay together: the camera only moves forward!' },
  { key: 'falls', code: '2', name: 'Thunder Falls', kind: 'up', music: FALLS_THEME, boss: 1, runners: 0,
    pool: ['beam', 'fan', 'seek', 'heart', 'shield', 'nova'], map: FALLS_MAP,
    fact: 'Climb! Ledges let you jump up through them.' },
  { key: 'frost', code: '3', name: 'Frostbite Base', kind: 'side', music: FROST_THEME, boss: 2, runners: 2.8,
    pool: ['seek', 'fan', 'beam', 'heart', 'nova', 'shield'],
    parts: 'S F8 F8g F6h P F6 icefield F6m R1 F6g R0 F6k F4 G3 F6h ledges F8t C F6 P F4 igloo F8gm F4 icefield2 R2 F6h R0 F6k F4 G3 F6gt F6 P F8 C F6hh ledges2 F10k F6 A2',
    fact: 'Ice is slippery. Tanks shoot low: jump their shells!' },
  { key: 'factory', code: '4', name: 'Scrap Factory', kind: 'side', ceiling: true, music: FACTORY_THEME, boss: 3, runners: 2.4,
    pool: ['beam', 'seek', 'fan', 'heart', 'shield', 'nova'],
    parts: 'S F8 F6g conv F6t crusher F6h P F4 D3 F6g zap F6 F2M F8 conv2 C F6gW F6 crusher F4 P ledges F6t zap2 F6 D3 F8W F6 conv F4 G2 F6g C F6 crusher F6W bunker2 F8 A3',
    fact: 'Hop in a Stomper mech and flatten some bots!' },
  { key: 'sky', code: '5', name: 'Skyway Chase', kind: 'fly', music: SKY_THEME, boss: 4, runners: 0,
    pool: ['fan', 'seek', 'beam', 'heart', 'shield', 'nova'],
    fact: 'Jet boards! The D-pad flies you anywhere on screen.' },
  { key: 'citadel', code: '6', name: 'Iron Citadel', kind: 'side', music: CITADEL_THEME, boss: 5, runners: 2.2,
    pool: ['fan', 'beam', 'seek', 'heart', 'shield', 'nova'],
    parts: 'S F8 F6gt P F6 D3 F6W zap F4 ledges2 F6h C F6k crusher F6m G3 F6t P bunker F6gg D3 F2M F8W F6 conv F6 zap C F6t F4 G2 F6W ledges3 F8k P F6 D3 F6g bunker2 F8 A5',
    fact: 'General Rustbolt is waiting at the top. Go get the Sky Crystal!' }
];
const BOSS_NAMES = ['GATEKEEPER', 'BOULDER BOT', 'SNOWPLOW', 'MEGA CLAW', 'THUNDERHULL', 'GENERAL RUSTBOLT'];
const BOSS_LINES = ['The Gatekeeper is locking the jungle gate!', 'Boulder Bot is throwing rocks down the falls!',
  'The Snowplow is clearing the road… of you!', 'Mega Claw wants to put you in the scrap pile!',
  'The Thunderhull gunship is closing in!', 'General Rustbolt: “You will never get the Sky Crystal!”'];

/* The jet-board stage is a timeline of waves: [seconds, kind, y (0-1 of the screen), count or item]. */
const SKY_WAVES = [
  [2, 'saucers', 0.3, 5], [5, 'saucers', 0.65, 5], [8, 'pod', 0.4, 'fan'], [10, 'barge', 0.7], [13, 'saucers', 0.25, 6],
  [15, 'missile', 0.5], [17, 'mine', 0.35, 3], [20, 'saucers', 0.55, 6], [22, 'jet', 0.3], [24, 'missile', 0.3], [25, 'missile', 0.7],
  [27, 'pod', 0.6, 'heart'], [29, 'barge', 0.25], [31, 'barge', 0.75], [34, 'saucers', 0.4, 7], [36, 'mine', 0.6, 4],
  [39, 'jet', 0.7], [40, 'jet', 0.3], [43, 'pod', 0.35, 'seek'], [45, 'saucers', 0.2, 6], [46, 'saucers', 0.8, 6],
  [49, 'missile', 0.45], [50, 'missile', 0.6], [52, 'barge', 0.5], [55, 'mine', 0.3, 4], [57, 'saucers', 0.5, 8],
  [60, 'pod', 0.5, 'shield'], [62, 'jet', 0.25], [62.5, 'jet', 0.75], [65, 'saucers', 0.35, 7], [67, 'missile', 0.4],
  [68, 'barge', 0.7], [71, 'mine', 0.5, 5], [73, 'saucers', 0.65, 8], [76, 'pod', 0.45, 'nova'], [78, 'end']
];

/* ---------- Level building ---------- */
const ENT_CHARS = 'gtfmhokjWp123456PMGCuB';
const BUILT = {};
function buildSide(ix){
  const def = STAGES[ix], cols = [], ents = [];
  let h = 0, start = null, arena = null;
  const emptyCol = () => new Array(ROWS).fill('.');
  const groundCol = () => { const c = emptyCol(); for(let r = 12 - h; r < ROWS; r++) c[r] = '#'; return c; };
  const place = (x, r, ch) => {
    if(r < 0 || r >= ROWS || !cols[x]) return;
    if(ch === '@'){ if(!start) start = { tx: x, ty: r }; return; }
    if(ENT_CHARS.includes(ch)){ ents.push({ ch, tx: x, ty: r }); return; }
    cols[x][r] = ch;
  };
  const chunk = (rows, off, x0) => {
    const n = rows.length, w = Math.max(...rows.map(r => r.length));
    for(let i = 0; i < w; i++) cols.push(emptyCol());
    for(let r = 0; r < n; r++){
      const row = ROWS - n + r - off;
      for(let i = 0; i < w; i++){ const ch = rows[r][i] || '.'; if(ch !== '.') place(x0 + i, row, ch); }
    }
    if(off > 0) for(let i = 0; i < w; i++) if(rows[n - 1][i] === '#' || rows[n - 1][i] === 'i') for(let r = ROWS - off; r < ROWS; r++) cols[x0 + i][r] = '#';
    return w;
  };
  for(const tok of def.parts.trim().split(/\s+/)){
    let m;
    if((m = /^F(\d+)(.*)$/.exec(tok))){
      const n = +m[1], ex = m[2], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(groundCol());
      for(let j = 0; j < ex.length; j++){
        const ch = ex[j], x = x0 + Math.floor(n * (j + 1) / (ex.length + 1));
        if(ch === 'f') place(x, 7 - h, ch);
        else if(ch === 'G') place(x, 8 - h, ch);
        else place(x, 11 - h, ch);
      }
    } else if((m = /^W(\d+)$/.exec(tok))){
      const n = +m[1];
      for(let i = 0; i < n; i++){ const c = groundCol(); c[12 - h] = '~'; cols.push(c); }
    } else if((m = /^G(\d+)$/.exec(tok))){
      for(let i = 0; i < +m[1]; i++) cols.push(emptyCol());
    } else if((m = /^R(\d)$/.exec(tok))) h = +m[1];
    else if((m = /^D(\d)$/.exec(tok))){
      const c = groundCol(); for(let k = 1; k <= +m[1]; k++) c[12 - h - k] = 'D'; cols.push(c);
    } else if(tok === 'P'){ place(cols.length - 1, 4, 'P'); }
    else if(tok === 'C'){ const x0 = cols.length; for(let i = 0; i < 4; i++) cols.push(groundCol()); place(x0 + 1, 11 - h, 'C'); }
    else if((m = /^A(\d)$/.exec(tok))){ h = 0; const x0 = cols.length; chunk(ARENAS[+m[1]], 0, x0); arena = { x0: x0 * T }; }
    else if(CH_ABS[tok]) chunk(CH_ABS[tok], 0, cols.length);
    else if(CH[tok]) chunk(CH[tok], h, cols.length);
  }
  if(def.ceiling) for(const c of cols){ c[0] = 'X'; c[1] = 'X'; }
  const W = cols.length, map = new Array(W * ROWS);
  for(let x = 0; x < W; x++) for(let r = 0; r < ROWS; r++) map[r * W + x] = cols[x][r];
  // the arena's own '@' is only used when restarting at the boss
  return { map, W, H: ROWS, ents, start: start || { tx: 2, ty: 11 }, arena, def };
}
function buildUp(ix){
  const def = STAGES[ix], rows = def.map, H = rows.length, W = 24, map = new Array(W * H), ents = [];
  let start = null;
  for(let r = 0; r < H; r++){
    const s = (rows[r] || '').replace(/ /g, '.').padEnd(22, '.').slice(0, 22);
    const line = (r === 0 || r >= H - 2) ? 'X' + s + 'X' : 'X' + s + 'X';
    for(let x = 0; x < W; x++){
      const ch = line[x];
      if(ch === '@'){ if(!start) start = { tx: x, ty: r }; map[r * W + x] = '.'; }
      else if(ENT_CHARS.includes(ch)){ ents.push({ ch, tx: x, ty: r }); map[r * W + x] = '.'; }
      else map[r * W + x] = ch;
    }
  }
  return { map, W, H, ents, start: start || { tx: 3, ty: H - 3 }, arena: { y0: 0 }, def };
}
function buildLevel(ix){
  if(BUILT[ix]) return BUILT[ix];
  const def = STAGES[ix];
  let L;
  if(def.kind === 'side') L = buildSide(ix);
  else if(def.kind === 'up') L = buildUp(ix);
  else L = { map: [], W: 0, H: Math.ceil(VH / T), ents: [], start: { tx: 3, ty: 6 }, arena: null, def };
  return (BUILT[ix] = L);
}

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('strike.diff', 'normal'), lv: 0, startLv: 0,
  unlocked: Math.min(STAGES.length - 1, A.Store.get('strike.unlocked', 0) | 0),
  players: [], roster: [], ents: [], shots: [], eshots: [], map: null, W: 0, H: ROWS, mods: [], def: STAGES[0], kind: 'side',
  cam: { x: 0, y: 0 }, score: 0, lives: 4, time: 0, stateT: 0, lvT: 0, introLen: 2.8,
  check: null, arena: null, locked: false, bossSpot: null, bossT: -1, clearT: -1, flySpeed: 62, skyT: 0, waveIx: 0,
  loadN: 0, net: null, shake: 0, flash: 0, combo: 0, comboT: 0, runnerT: 2, crumbles: new Map(), wallHp: new Map(),
  god: false, demoT: 0, say: 0, sayText: '', gears: A.Store.get('strike.gears', []), gotGear: false, continues: 0, nextLife: 20000,
  levelScore: 0, modsApplied: 0, stats: null
};
if(!DIFF[G.diff]) G.diff = 'normal';
G.startLv = Math.min(G.unlocked, A.Store.get('strike.start', 0) | 0);
const D = () => DIFF[G.diff];
const hasLives = () => D().lives !== Infinity;

/* ---------- Sounds ---------- */
const SX = {
  pew:    s => { s.tone({ wave: 'pulse25', f: 1250, f2: 520, t: 0.06, v: 0.045 }); s.noise({ t: 0.03, v: 0.03, f: 7000, type: 'highpass' }); },
  fan:    s => { s.tone({ wave: 'square', f: 900, f2: 300, t: 0.08, v: 0.045 }); s.noise({ t: 0.06, v: 0.05, f: 4000, f2: 900 }); },
  beam:   s => { s.tone({ wave: 'sawtooth', f: 1800, f2: 2600, t: 0.12, v: 0.04 }); s.tone({ wave: 'sine', f: 900, f2: 1400, t: 0.14, v: 0.05 }); },
  seek:   s => { s.tone({ wave: 'triangle', f: 380, f2: 900, t: 0.12, v: 0.07 }); s.noise({ t: 0.12, v: 0.05, f: 1500, f2: 500 }); },
  cannon: s => { s.tone({ wave: 'square', f: 220, f2: 70, t: 0.14, v: 0.1 }); s.noise({ t: 0.12, v: 0.12, f: 1800, f2: 200 }); },
  hit:    s => s.tone({ wave: 'triangle', f: 1500, f2: 900, t: 0.04, v: 0.05 }),
  clank:  s => { s.tone({ wave: 'triangle', f: 2400, f2: 1900, t: 0.06, v: 0.06 }); s.tone({ f: 3100, t: 0.03, v: 0.025 }); },
  pop:    s => { s.noise({ t: 0.22, v: 0.2, f: 2600, f2: 300 }); s.tone({ wave: 'square', f: 420, f2: 90, t: 0.14, v: 0.07 }); },
  boomL:  s => { s.noise({ t: 0.7, v: 0.36, f: 1600, f2: 60 }); s.tone({ wave: 'sawtooth', f: 130, f2: 35, t: 0.5, v: 0.12 }); },
  eshot:  s => s.tone({ wave: 'pulse12', f: 620, f2: 380, t: 0.07, v: 0.04 }),
  lob:    s => s.tone({ wave: 'triangle', f: 300, f2: 700, t: 0.18, v: 0.06 }),
  jump:   s => s.tone({ wave: 'pulse25', f: 260, f2: 560, t: 0.11, v: 0.05 }),
  land:   s => s.noise({ t: 0.06, v: 0.05, f: 900, f2: 300 }),
  stomp:  s => { s.noise({ t: 0.25, v: 0.25, f: 700, f2: 60 }); s.tone({ wave: 'sine', f: 110, f2: 45, t: 0.22, v: 0.2 }); },
  hurt:   s => { s.tone({ wave: 'square', f: 440, f2: 180, t: 0.16, v: 0.1 }); s.noise({ t: 0.1, v: 0.08, f: 3000, f2: 600 }); },
  warpOut: s => { s.tone({ wave: 'sine', f: 300, f2: 1800, t: 0.5, v: 0.12 }); s.tone({ wave: 'triangle', f: 600, f2: 2600, t: 0.45, v: 0.06, at: 0.05 }); },
  warpIn: s => { s.tone({ wave: 'sine', f: 1800, f2: 400, t: 0.35, v: 0.1 }); s.melody([[523, .06], [784, .08]], { wave: 'triangle', v: 0.08 }); },
  pickup: s => s.melody([[659, .05], [988, .05], [1319, .05], [1760, .1]], { wave: 'pulse25', v: 0.09 }),
  powerUp: s => s.melody([[523, .05], [659, .05], [784, .05], [1047, .05], [1319, .05], [1568, .12]], { wave: 'square', v: 0.08 }),
  shieldOn: s => { s.tone({ wave: 'sine', f: 400, f2: 1600, t: 0.3, v: 0.1, vib: true }); },
  nova:   s => { s.noise({ t: 1.2, v: 0.4, f: 3000, f2: 60 }); s.tone({ wave: 'sine', f: 1600, f2: 60, t: 1.0, v: 0.15 }); },
  heart:  s => s.melody([[784, .07], [988, .07], [1175, .12]], { wave: 'triangle', v: 0.12 }),
  gear:   s => s.melody([[1047, .06], [1319, .06], [1568, .06], [2093, .16]], { wave: 'triangle', v: 0.12 }),
  crumble: s => s.noise({ t: 0.3, v: 0.16, f: 1400, f2: 200 }),
  splash: s => { s.noise({ t: 0.25, v: 0.14, f: 2200, f2: 500, type: 'bandpass', q: 1.2 }); },
  zap:    s => { s.tone({ wave: 'sawtooth', f: 90, t: 0.25, v: 0.06 }); s.noise({ t: 0.2, v: 0.08, f: 6000, type: 'highpass' }); },
  crush:  s => { s.noise({ t: 0.3, v: 0.3, f: 600, f2: 60 }); s.tone({ wave: 'square', f: 90, f2: 40, t: 0.2, v: 0.12 }); },
  mechIn: s => s.melody([[196, .08], [262, .08], [392, .08], [523, .16]], { wave: 'square', v: 0.1 }),
  siren:  s => { for(let i = 0; i < 3; i++){ s.tone({ wave: 'square', f: 620, f2: 880, t: 0.3, v: 0.06, at: i * 0.6 }); s.tone({ wave: 'square', f: 880, f2: 620, t: 0.3, v: 0.06, at: i * 0.6 + 0.3 }); } },
  bossHit: s => { s.tone({ wave: 'square', f: 300, f2: 200, t: 0.05, v: 0.06 }); s.noise({ t: 0.05, v: 0.06, f: 2500, type: 'highpass' }); },
  partDown: s => { s.noise({ t: 0.6, v: 0.32, f: 2000, f2: 90 }); s.melody([[392, .08], [330, .08], [262, .16]], { wave: 'square', v: 0.07 }); },
  revive: s => s.melody([[392, .07], [523, .07], [659, .07], [784, .07], [1047, .16]], { wave: 'triangle', v: 0.12 }),
  combo:  s => s.tone({ wave: 'triangle', f: 1175, f2: 1568, t: 0.08, v: 0.06 }),
  check:  s => s.melody([[784, .08], [1047, .08], [1319, .14]], { wave: 'pulse25', v: 0.09 }),
  laserWarn: s => s.tone({ wave: 'sine', f: 1400, f2: 2200, t: 0.7, v: 0.05 }),
  laser:  s => { s.tone({ wave: 'sawtooth', f: 180, t: 0.45, v: 0.08 }); s.noise({ t: 0.45, v: 0.08, f: 4000, f2: 1200 }); },
  fanfare: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .22], [0, .05], [880, .1], [1047, .1], [1319, .4]], { v: 0.11 });
                  s.melody([[262, .32], [349, .32], [392, .4], [523, .5]], { wave: 'triangle', v: 0.15 }); },
  firework: s => { s.noise({ t: 0.5, v: 0.22, f: 2200, f2: 200 }); s.tone({ wave: 'triangle', f: 1400, f2: 500, t: 0.2, v: 0.04 }); }
};
let netSfx = [], netFx = [], sfxThisFrame = new Set();
function sfx(name){
  if(G.demo || sfxThisFrame.has(name)) return;
  sfxThisFrame.add(name);
  const f = SX[name];
  if(f){ try{ f(A.Sound); }catch(e){} } else A.Sound.play(name);
  if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name);
}
function playNetSfx(n){ const f = SX[n]; if(f){ try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }
function say(text){ G.say++; G.sayText = text; if(!G.demo) A.toast(text, 3400); }

/* ---------- Map helpers ---------- */
function tileAt(tx, ty){
  if(G.kind === 'fly') return '.';
  if(tx < 0 || tx >= G.W) return 'X';
  if(ty < 0) return G.def.ceiling ? 'X' : '.';
  if(ty >= G.H) return G.kind === 'side' ? (isSolid(G.map[(G.H - 1) * G.W + tx]) ? '#' : '.') : '.';
  return G.map[ty * G.W + tx];
}
function setTile(tx, ty, ch){
  if(tx < 0 || tx >= G.W || ty < 0 || ty >= G.H) return;
  const i = ty * G.W + tx; if(G.map[i] === ch) return;
  G.map[i] = ch; G.mods.push([i, ch]);
}
function rectSolid(b){
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
  for(let ty = y0; ty <= y1; ty++) for(let tx = x0; tx <= x1; tx++) if(isSolid(tileAt(tx, ty))) return true;
  return false;
}
const standable = ch => isSolid(ch) || ch === '=';
/* The top of the first floor at or below y in this column (or null). */
function floorBelow(px, y){
  const tx = Math.floor(px / T);
  for(let r = Math.max(0, Math.floor(y / T)); r < G.H; r++) if(standable(tileAt(tx, r)) && !isSolid(tileAt(tx, r - 1))) return r * T;
  return null;
}
function zapOn(tx){ const ph = (G.lvT * 0.34 + tx * 0.0) % 1; return ph > 0.66; }
function zapWarn(tx){ const ph = (G.lvT * 0.34) % 1; return ph > 0.5 && ph <= 0.66; }

/* Move a body through the tiles: X first, then Y. One-way ledges hold you unless dropping. */
function moveBody(b, dt, noLedge){
  b.hitWall = 0; b.hitHead = false;
  const dx = b.vx * dt;
  if(dx){
    b.x += dx;
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
    if(dx > 0){ const tx = Math.floor((b.x + b.w - 0.01) / T); for(let ty = y0; ty <= y1; ty++) if(isSolid(tileAt(tx, ty))){ b.x = tx * T - b.w; b.hitWall = 1; break; } }
    else { const tx = Math.floor(b.x / T); for(let ty = y0; ty <= y1; ty++) if(isSolid(tileAt(tx, ty))){ b.x = (tx + 1) * T; b.hitWall = -1; break; } }
  }
  const prevBottom = b.y + b.h;
  b.y += b.vy * dt; b.onGround = false;
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
  if(b.vy >= 0){
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for(let tx = x0; tx <= x1; tx++){
      const ch = tileAt(tx, ty);
      if(isSolid(ch) || (ch === '=' && !noLedge && prevBottom <= ty * T + 0.5)){ b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else {
    const ty = Math.floor(b.y / T);
    for(let tx = x0; tx <= x1; tx++) if(isSolid(tileAt(tx, ty))){ b.y = (ty + 1) * T; b.vy = 0; b.hitHead = true; break; }
  }
}

/* ---------- Particles (cosmetic, run on every screen) ---------- */
let parts = [];
function fx(type, a, b, c, d){
  spawnFx(type, a, b, c, d);
  if(Net && Net.role === 'host' && netFx.length < 40) netFx.push([type, r1(a), r1(b), c === undefined ? null : c, d === undefined ? null : d]);
}
const BOLT_COLS = ['#c9ced8', '#8d94a3', '#ffd45e', '#ff8a5c'];
function spawnFx(type, x, y, arg, arg2){
  const R = Math.random;
  switch(type){
    case 'text': parts.push({ kind: 'text', x, y, vx: 0, vy: -30, g: 0, t: 0, life: 0.9, str: arg, col: arg2 || '#fff', size: 5 }); break;
    case 'big': parts.push({ kind: 'text', x, y, vx: 0, vy: -16, g: 0, t: 0, life: 1.3, str: arg, col: arg2 || '#fff', size: 8 }); break;
    case 'spark': for(let i = 0; i < 3; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 120, vy: (R() - 0.5) * 120, g: 0, t: 0, life: 0.15 + R() * 0.1, col: arg || '#fff6b0', r: 1.4 }); break;
    case 'clank': for(let i = 0; i < 2; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 90, vy: -40 - R() * 60, g: 300, t: 0, life: 0.25, col: '#e8f0ff', r: 1.1 }); break;
    case 'boom': {   // a small robot pop: bolts, springs and a puff
      const n = arg || 1;
      parts.push({ kind: 'ring', x, y, t: 0, life: 0.3, r: 10 * n, col: '#fff3c4' });
      for(let i = 0; i < 6 * n; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 150 * n, vy: (R() - 0.5) * 150 * n, g: 0, t: 0, life: 0.3 + R() * 0.25, col: R() < 0.5 ? '#ffb347' : '#fff0a8', r: 2 + R() * 2.5 * n });
      for(let i = 0; i < 4 + 2 * n; i++) parts.push({ kind: R() < 0.4 ? 'spring' : 'bolt', x, y, vx: (R() - 0.5) * 170, vy: -90 - R() * 150, g: 650, t: 0, life: 0.9 + R() * 0.3, col: BOLT_COLS[i % 4], rot: R() * 6, r: 2.5 });
      break;
    }
    case 'puff': for(let i = 0; i < 6; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 10, y: y + (R() - 0.5) * 6, vx: (R() - 0.5) * 40, vy: -10 - R() * 30, g: 0, t: 0, life: 0.5, col: arg || 'rgba(255,255,255,.75)', r: 3 + R() * 2 }); break;
    case 'dust': for(let i = 0; i < 4; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 8, y, vx: (R() - 0.5) * 50, vy: -10 - R() * 20, g: 0, t: 0, life: 0.3, col: arg || 'rgba(255,255,255,.6)', r: 1.5 + R() }); break;
    case 'splash': for(let i = 0; i < 8; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 10, y, vx: (R() - 0.5) * 70, vy: -60 - R() * 90, g: 500, t: 0, life: 0.5, col: 'rgba(200,240,255,.9)', r: 1.6 }); break;
    case 'chunks': for(let i = 0; i < 6; i++) parts.push({ kind: 'chunk', x: x + (R() - 0.5) * 10, y: y + (R() - 0.5) * 10, vx: (R() - 0.5) * 160, vy: -120 - R() * 120, g: 700, t: 0, life: 0.9, col: arg || '#8d94a3', r: 4, rot: R() * 6 }); break;
    case 'sparkle': for(let i = 0; i < 6; i++) parts.push({ kind: 'star', x: x + (R() - 0.5) * 14, y: y + (R() - 0.5) * 14, vx: (R() - 0.5) * 30, vy: -20 - R() * 30, g: 0, t: 0, life: 0.6, col: arg || '#fff6b0', r: 2 }); break;
    case 'warp': parts.push({ kind: 'warp', x, y, t: 0, life: 0.6, col: arg || '#7fe3ff' }); break;
    case 'firework': { const col = arg || '#ffd45e'; for(let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2, sp = 70 + R() * 50; parts.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, t: 0, life: 0.9 + R() * 0.3, col, r: 1.8 }); } break; }
    case 'novaRing': parts.push({ kind: 'nova', x, y, t: 0, life: 0.8 }); break;
    case 'shake': G.shake = Math.max(G.shake, x); break;
    case 'flash': G.flash = Math.max(G.flash, x); break;
  }
  if(parts.length > 420) parts.splice(0, parts.length - 420);
}
function fxStep(dt){
  for(const p of parts){ p.t += dt; if(p.vx !== undefined){ p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; } if(p.rot !== undefined) p.rot += dt * 9; }
  parts = parts.filter(p => p.t < p.life);
}
function addScore(n, x, y, col){
  G.score += n;
  if(x !== undefined) fx('text', x, y, String(n), col || '#fff');
  if(hasLives() && G.score >= G.nextLife){ G.nextLife += 20000; G.lives++; sfx('heart'); fx('big', G.cam.x + VW / 2, G.cam.y + 60, 'EXTRA LIFE!', '#7dff8a'); }
}

/* ---------- Entities ---------- */
let nextEnt = 1, nextShot = 1;
const SIZES = { runner: [12, 20], gunner: [14, 22], turret: [16, 14], drone: [16, 12], mortar: [16, 18], hider: [14, 16], roller: [14, 14],
  rock: [16, 16], tank: [42, 24], jetbot: [16, 18], walker: [24, 30], crusher: [20, 16], crate: [16, 14], pod: [20, 12], item: [14, 12],
  mech: [MECH_W, MECH_H], check: [10, 40], gear: [12, 12], saucer: [18, 10], missile: [18, 8], barge: [36, 18], mine: [14, 14],
  spawner: [2, 2], boss: [60, 60] };
const FOE_HP = { runner: 1, gunner: 2, turret: 8, drone: 2, mortar: 3, hider: 1, roller: 3, rock: 3, tank: 16, jetbot: 3, walker: 12,
  crate: 3, pod: 3, saucer: 1, missile: 2, barge: 8, mine: 3 };
const FOE_PTS = { runner: 100, gunner: 200, turret: 500, drone: 300, mortar: 300, hider: 300, roller: 200, rock: 100, tank: 1500, jetbot: 400,
  walker: 1200, crate: 100, pod: 500, saucer: 150, missile: 200, barge: 800, mine: 150 };
const FOES = new Set(Object.keys(FOE_HP).concat(['boss']));
const HURTS = new Set(['runner', 'gunner', 'drone', 'roller', 'rock', 'tank', 'jetbot', 'walker', 'saucer', 'missile', 'barge', 'mine', 'mortar', 'hider']);
function mkEnt(k, x, y, o){
  const sz = SIZES[k] || [12, 12];
  const e = Object.assign({ id: nextEnt++, k, x, y, w: sz[0], h: sz[1], vx: 0, vy: 0, face: -1, st: '', t: 0, on: true, dead: 0, hp: 1, max: 1, hf: 0, awake: false }, o);
  if(FOE_HP[k] && o && o.hp === undefined){ e.hp = e.max = Math.max(1, Math.round(FOE_HP[k] * D().ehp)); }
  G.ents.push(e); return e;
}
function spawnFromMap(o){
  const bx = o.tx * T, by = (o.ty + 1) * T;
  const foot = (k, o2) => { const sz = SIZES[k]; return mkEnt(k, bx + (T - sz[0]) / 2, by - sz[1], o2); };
  const itemOf = ch => ch === 'p' ? null : ITEM_KINDS['123456'.indexOf(ch)];
  switch(o.ch){
    case 'g': foot('gunner', { t: Math.random() * 1.2 }); break;
    case 't': foot('turret', { st: 'closed', ang: Math.PI, t: Math.random() }); break;
    case 'f': mkEnt('drone', bx, o.ty * T, { by: o.ty * T, t: o.tx * 0.7 }); break;
    case 'm': foot('mortar', { t: 1 + Math.random() }); break;
    case 'h': foot('hider', { st: 'hide', t: Math.random() }); break;
    case 'o': mkEnt('spawner', bx + 7, o.ty * T, { sub: G.kind === 'up' ? 'rock' : 'roll', t: 1.5 }); break;
    case 'k': foot('tank', { t: 1.5 }); break;
    case 'j': mkEnt('spawner', bx, o.ty * T, { sub: 'jet' }); break;
    case 'W': foot('walker', { t: 1.2 }); break;
    case 'p': case '1': case '2': case '3': case '4': case '5': case '6': foot('crate', { item: itemOf(o.ch) }); break;
    case 'P': mkEnt('spawner', bx, o.ty * T, { sub: 'pod' }); break;
    case 'M': foot('mech', {}); break;
    case 'G': mkEnt('gear', bx + 2, o.ty * T + 2, { by: o.ty * T + 2 }); break;
    case 'C': mkEnt('check', bx + 3, by - 40, { st: G.check && G.check.x >= bx ? 'on' : '' }); break;
    case 'u': {
      let top = o.ty; while(top > 0 && !isSolid(tileAt(o.tx, top - 1))) top--;
      let fl = o.ty; while(fl < G.H - 1 && !isSolid(tileAt(o.tx, fl + 1))) fl++;
      mkEnt('crusher', bx - 2, top * T, { top: top * T, floor: (fl + 1) * T, ext: top * T + 16, st: 'up', t: (o.tx % 5) * 0.4 });
      break;
    }
    case 'B': G.bossSpot = { x: bx, y: by }; break;
  }
}

/* ---------- Players ---------- */
function makeHero(o){
  return Object.assign({ slot: 0, source: null, name: 'Player', color: '#f5c542', x: 0, y: 0, w: PW, h: STAND_H, vx: 0, vy: 0, face: 1,
    onGround: false, ax: 1, ay: 0, hp: 3, maxHp: 3, inv: 0, shield: 0, weapon: 'blaster', wlv: 1, fireT: 0, shotT: 0,
    crouch: false, dive: false, spin: false, swim: false, jumping: false, coyote: 0, buffer: 0, dropT: 0, tapDown: 0,
    out: 0, sos: false, sosT: 0, dropIn: 0, mech: 0, away: false, runT: 0, squashT: 0, hurtT: 0,
    kills: 0, shots: 0, hits: 0, downs: 0, pods: 0, bot: false }, o);
}
const active = p => !p.out && !p.sos && !p.away;
const alivePlayers = () => G.players.filter(active);
function resetHero(p){
  Object.assign(p, { vx: 0, vy: 0, out: 0, sos: false, inv: 0, shield: 0, crouch: false, dive: false, spin: false, jumping: false, dropIn: 0, hurtT: 0, face: 1 });
  p.maxHp = D().hearts; p.hp = p.maxHp;
  if(p.mech){ p.mech = 0; }
  p.w = PW; p.h = STAND_H;
}
function placePlayers(x0, y0){
  G.players.forEach((p, i) => {
    resetHero(p);
    if(G.kind === 'fly'){ p.x = G.cam.x + 40; p.y = 50 + i * 34; p.w = 16; p.h = 12; return; }
    const x = x0 + i * 16;
    p.x = x; const f = floorBelow(x + 5, y0 - 20); p.y = (f !== null ? f : y0) - p.h; p.onGround = true;
  });
}
function setHeight(p, h){
  if(p.h === h) return true;
  const old = { y: p.y, h: p.h };
  p.y += p.h - h; p.h = h;
  if(h > old.h && rectSolid(p)){ p.y = old.y; p.h = old.h; return false; }
  return true;
}

const NOC = { left: false, right: false, up: false, down: false, fire: false, upP: false, downP: false, fireP: false };
function controls(p){
  if(p.bot) return botControls(p);
  const s = A.Input.get(p.source);
  if(!s || !s.connected) return NOC;
  return { left: s.left, right: s.right, up: s.up, down: s.down, fire: s.fire,
    upP: A.Input.pressed(s, 'up'), downP: A.Input.pressed(s, 'down'), fireP: A.Input.pressed(s, 'fire') };
}
const isTouchSrc = src => src === 'touch' || /\/touch$/.test(String(src || ''));

function stepPlayer(p, dt){
  if(p.inv > 0) p.inv -= dt;
  if(p.shield > 0) p.shield = Math.max(0, p.shield - dt);
  if(p.fireT > 0) p.fireT -= dt;
  if(p.shotT > 0) p.shotT -= dt;
  if(p.squashT > 0) p.squashT -= dt;
  if(p.hurtT > 0) p.hurtT -= dt;
  if(p.dropT > 0) p.dropT -= dt;
  if(p.tapDown > 0) p.tapDown -= dt;
  if(!p.bot){ const s = A.Input.get(p.source); p.away = !(s && s.connected); }
  if(p.out){ stepOut(p, dt); return; }
  if(p.sos){ stepSOS(p, dt); return; }
  if(p.away){ p.vx = 0; if(G.kind !== 'fly'){ p.vy = Math.min(MAX_FALL, p.vy + GRAV * dt); moveBody(p, dt); } return; }
  if(G.state !== 'play' && G.state !== 'warn' && !G.demo) return;
  const c = controls(p);
  if(G.kind === 'fly'){ stepFlyer(p, dt, c); return; }
  const mech = p.mech > 0;
  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  const feetT = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 1) / T));
  const ice = p.onGround && feetT === 'i', belt = p.onGround ? (feetT === '>' ? 42 : feetT === '<' ? -42 : 0) : 0;
  const water = tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h - 3) / T)) === '~';
  if(water && !p.swim){ p.swim = true; if(p.vy > 60) { sfx('splash'); fx('splash', p.x + p.w / 2, p.y + p.h - 6); } }
  else if(!water) p.swim = false;
  // double-tap DOWN on a ledge to drop through it
  if(c.downP){
    if(p.tapDown > 0 && p.onGround && !mech){
      const ty = Math.floor((p.y + p.h + 1) / T); let ledge = true;
      for(let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++) if(tileAt(tx, ty) !== '=' && tileAt(tx, ty) !== '.') ledge = false;
      if(ledge){ p.dropT = 0.22; p.onGround = false; p.vy = 40; p.tapDown = 0; }
    } else p.tapDown = 0.32;
  }
  p.crouch = p.onGround && c.down && !dir && !p.swim && !mech;
  p.dive = p.swim && p.onGround && c.down && !mech;
  if(dir) p.face = dir;
  const top = mech ? 70 : p.swim ? 58 : RUN;
  const target = (p.crouch || p.dive) ? 0 : dir * top;
  const acc = !p.onGround ? AIR_ACC : ice ? ICE_ACC : GROUND_ACC;
  p.vx += clamp(target - p.vx, -acc * dt, acc * dt);
  // jump: UP (buffered, a little coyote time); holding UP jumps higher and aims up
  if(c.upP) p.buffer = 0.13;
  if(p.onGround) p.coyote = 0.08; else p.coyote -= dt;
  if(p.buffer > 0 && p.coyote > 0 && !p.dive){
    p.vy = -(mech ? 300 : JUMP_V); p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.spin = !mech;
    sfx('jump'); if(p.swim) fx('splash', p.x + p.w / 2, p.y + p.h - 4);
  }
  p.buffer -= dt;
  const g = p.vy < 0 && c.up && p.jumping ? GRAV : p.vy < 0 ? GRAV_CUT : GRAV;
  if(p.vy >= 0) p.jumping = false;
  p.vy = Math.min(p.dropIn > 0 ? 150 : MAX_FALL, p.vy + g * dt);
  // body size follows the pose (feet stay put)
  const wantH = mech ? MECH_H : (!p.onGround && p.spin) ? BALL_H : (p.crouch || p.dive) ? CROUCH_H : STAND_H;
  if(!setHeight(p, wantH)){ p.crouch = true; setHeight(p, CROUCH_H); }
  const wasGround = p.onGround, fallV = p.vy;
  moveBody(p, dt, p.dropT > 0);
  if(belt && p.onGround){ const sv = p.vx, svy = p.vy; p.vx = belt; p.vy = 0; moveBody(p, dt); p.vx = sv; p.vy = svy; p.onGround = true; }
  if(p.onGround && !wasGround){
    p.spin = false; p.jumping = false; p.dropIn = 0; p.squashT = 0.1;
    if(mech && fallV > 150){ sfx('stomp'); fx('shake', 0.25); fx('dust', p.x + p.w / 2, p.y + p.h, 'rgba(255,255,255,.8)'); mechStomp(p); }
    else if(fallV > 200) sfx('land');
    if(!setHeight(p, mech ? MECH_H : STAND_H)){ setHeight(p, CROUCH_H); }
  }
  if(p.onGround && dir && !p.crouch) p.runT += dt; else if(p.onGround) p.runT = 0;
  // the floor under your feet
  if(p.onGround){
    const ty = Math.floor((p.y + p.h + 1) / T);
    for(let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++){
      const ch = tileAt(tx, ty);
      if(ch === 'c'){ const i = ty * G.W + tx; if(!G.crumbles.has(i)) G.crumbles.set(i, 0); }
      else if(ch === 'z' && zapOn(tx)) hurt(p, 'zap');
    }
  }
  aim(p, c);
  if(c.fire && p.fireT <= 0 && !p.dive) shoot(p);
  // falling out of the world
  const bottom = G.kind === 'up' ? G.cam.y + VH + 14 : G.H * T + 12;
  if(p.y > bottom){
    if(D().pitBounce || G.demo || G.god){
      p.y = bottom - 2; p.vy = -560; p.jumping = false; p.spin = true; sfx('jump'); fx('text', p.x + p.w / 2, p.y - 20, 'BOING!', '#ffd45e');
    } else { p.hp = 0; knockOut(p, true); }
  }
}
function aim(p, c){
  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  let ax = p.face, ay = 0;
  if(c.up){ ay = -1; ax = dir; }
  else if(c.down){
    if(p.onGround){ if(dir){ ay = 1; ax = dir; } }
    else { ay = 1; ax = dir; }
  }
  if(ax === 0 && ay === 0) ax = p.face;
  p.ax = ax; p.ay = ay;
}
const AIMS = [[1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1]];
const aimIndex = (ax, ay) => { for(let i = 0; i < 8; i++) if(AIMS[i][0] === ax && AIMS[i][1] === ay) return i; return 0; };
function muzzle(p){
  const cx = p.x + p.w / 2;
  if(G.kind === 'fly') return [p.x + p.w + 4, p.y + p.h / 2 + 1];
  if(p.mech) return [cx + p.ax * 14, p.y + 9 + p.ay * 10];
  const oy = p.crouch ? p.y + 5 : (!p.onGround && p.spin) ? p.y + p.h / 2 : p.y + 9;
  const n = Math.hypot(p.ax, p.ay) || 1;
  return [cx + p.ax / n * 10, oy + p.ay / n * (p.ay < 0 ? 12 : 10)];
}
function nearestFoe(x, y, maxD, cone){
  let best = null, bd = maxD || 1e9;
  for(const e of G.ents){
    if(!e.on || e.dead || !FOES.has(e.k) || e.k === 'crate' || !e.awake || (e.k === 'hider' && e.st === 'hide')) continue;
    const ex = e.x + e.w / 2, ey = e.y + e.h / 2, d = Math.hypot(ex - x, ey - y);
    if(cone && Math.abs(angDiff(Math.atan2(ey - y, ex - x), cone[0])) > cone[1]) continue;
    if(d < bd){ bd = d; best = e; }
  }
  return best;
}
const angDiff = (a, b) => { let d = a - b; while(d > Math.PI) d -= Math.PI * 2; while(d < -Math.PI) d += Math.PI * 2; return d; };

function mkShot(o){ const s = Object.assign({ id: nextShot++, life: 1.6, r: 2.5, dmg: 1 }, o); G.shots.push(s); return s; }
function shoot(p){
  const mech = p.mech > 0, w = WEAPONS[mech ? 'blaster' : p.weapon], lv = mech ? 0 : p.wlv - 1;
  const mine = G.shots.filter(s => s.owner === p.slot);
  const kind = mech ? 'mech' : p.weapon;
  if(mine.filter(s => s.k === kind || (kind === 'blaster' && s.k === 'bl')).length >= (mech ? 4 : w.max[lv])) return;
  p.fireT = mech ? 0.2 : w.rate[lv]; p.shotT = 0.1; p.shots++;
  const [ox, oy] = muzzle(p);
  let ang = Math.atan2(p.ay, p.ax);
  if(G.kind === 'fly') ang = 0;
  if(D().assist || isTouchSrc(p.source)){
    const f = nearestFoe(ox, oy, 240, [ang, 0.5]);
    if(f){ const want = Math.atan2(f.y + f.h / 2 - oy, f.x + f.w / 2 - ox); ang += clamp(angDiff(want, ang), -0.35, 0.35); }
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  if(mech){ mkShot({ k: 'mech', owner: p.slot, x: ox, y: oy, vx: c * 320, vy: s * 320, dmg: 3, r: 4 }); sfx('cannon'); return; }
  switch(p.weapon){
    case 'blaster':
      if(p.wlv >= 3){ for(const o of [-3, 3]) mkShot({ k: 'bl', owner: p.slot, x: ox - s * o, y: oy + c * o, vx: c * w.spd, vy: s * w.spd, dmg: 1 }); }
      else mkShot({ k: 'bl', owner: p.slot, x: ox, y: oy, vx: c * w.spd, vy: s * w.spd, dmg: 1 });
      sfx('pew'); break;
    case 'fan': {
      const n = w.ways[lv], step = 0.2;
      for(let i = 0; i < n; i++){ const a = ang + (i - (n - 1) / 2) * step; mkShot({ k: 'fan', owner: p.slot, x: ox, y: oy, vx: Math.cos(a) * w.spd, vy: Math.sin(a) * w.spd, dmg: w.dmg[lv], r: 3, life: 0.9 }); }
      sfx('fan'); break;
    }
    case 'beam':
      mkShot({ k: 'beam', owner: p.slot, x: ox, y: oy, vx: c * w.spd, vy: s * w.spd, dmg: w.dmg[lv], r: 3 + lv, hit: [], life: 0.9, lv });
      sfx('beam'); break;
    case 'seek':
      mkShot({ k: 'seek', owner: p.slot, x: ox, y: oy, vx: c * w.spd[lv], vy: s * w.spd[lv] - 20, dmg: w.dmg[lv], r: 3, life: 2.2, spd: w.spd[lv] });
      sfx('seek'); break;
  }
}
function giveItem(p, kind){
  if(kind === 'heart'){ p.hp = Math.min(p.maxHp + (p.maxHp < 5 ? 1 : 0), p.hp + 1); if(p.hp > p.maxHp) p.maxHp = p.hp; sfx('heart'); }
  else if(kind === 'shield'){ p.shield = 10; sfx('shieldOn'); }
  else if(kind === 'nova'){ nova(p); }
  else {
    if(p.weapon === kind){ if(p.wlv < 3){ p.wlv++; sfx('powerUp'); fx('text', p.x + p.w / 2, p.y - 22, 'LEVEL ' + p.wlv + '!', '#7dff8a'); } else { addScore(1000, p.x + p.w / 2, p.y - 22, '#7dff8a'); sfx('pickup'); } }
    else { p.weapon = kind; p.wlv = 1; sfx('pickup'); }
  }
  fx('text', p.x + p.w / 2, p.y - 12, ITEM_NAMES[kind], WEAPONS[kind] ? WEAPONS[kind].col : '#fff');
  fx('sparkle', p.x + p.w / 2, p.y + p.h / 2, p.color);
}
function nova(p){
  sfx('nova'); fx('flash', 0.5); fx('shake', 0.5); fx('novaRing', p.x + p.w / 2, p.y + p.h / 2);
  G.eshots = [];
  for(const e of G.ents){
    if(!FOES.has(e.k) || e.dead || e.k === 'crate' || e.k === 'pod') continue;
    const inView = e.x + e.w > G.cam.x - 8 && e.x < G.cam.x + VW + 8 && e.y + e.h > G.cam.y - 8 && e.y < G.cam.y + VH + 8;
    if(!inView) continue;
    if(e.k === 'boss') { for(let i = 0; i < e.ph.length; i++) if(e.ph[i] > 0 && partOpen(e, i)) damagePart(e, i, 6, p); }
    else damage(e, 99, p);
  }
}

/* Knocked out: the hero warps out in a flash of light and warps back in from the sky (if there are lives). */
function hurt(p, why){
  if(!active(p) || p.inv > 0 || p.shield > 0 || p.dropIn > 0) return;
  if(p.dive && why === 'shot') return;
  if(G.demo || G.god){ p.inv = 0.8; return; }
  if(p.mech > 0){
    p.mech--; p.inv = 1.0; p.hurtT = 0.3; sfx('hurt'); fx('clank', p.x + p.w / 2, p.y + 6);
    if(p.mech <= 0) ejectMech(p);
    return;
  }
  p.hp--; p.hurtT = 0.35; sfx('hurt');
  if(p.hp > 0){ p.inv = 1.4; fx('puff', p.x + p.w / 2, p.y + p.h / 2, 'rgba(255,200,200,.8)'); return; }
  knockOut(p, false);
}
function knockOut(p, fell){
  if(G.demo || G.god) return;
  p.downs++; p.mech = 0; p.w = PW; p.h = STAND_H;
  fx('warp', p.x + p.w / 2, fell ? G.cam.y + VH - 30 : p.y + p.h / 2, p.color); sfx('warpOut');
  if(!fell) fx('boom', p.x + p.w / 2, p.y + p.h / 2, 1);
  const k = D().keep;
  if(k === 1){ if(p.wlv > 1) p.wlv--; else { p.weapon = 'blaster'; p.wlv = 1; } }
  else if(k === 0){ p.weapon = 'blaster'; p.wlv = 1; }
  p.shield = 0; p.vx = 0; p.vy = 0;
  if(!hasLives() || G.lives > 0){
    if(hasLives()) G.lives--;
    p.out = 1.3;
  } else if(G.players.some(q => q !== p && active(q))){
    p.sos = true; p.sosT = 0; p.x = clamp(p.x, G.cam.x + 20, G.cam.x + VW - 30); p.y = clamp(p.y, G.cam.y + 30, G.cam.y + VH - 50);
    fx('text', p.x + 5, p.y - 10, 'SOS!', '#ff9a8a');
  } else { p.out = 999; }
}
function stepOut(p, dt){
  p.out -= dt;
  if(p.out > 0 || p.out > 100) return;
  if(G.state !== 'play' && G.state !== 'warn'){ p.out = 0.1; return; }
  respawn(p);
}
function respawnSpot(p){
  const partner = G.players.find(q => q !== p && active(q) && !q.dropIn);
  if(G.kind === 'fly') return { x: G.cam.x + 40, y: 60 + p.slot * 24 };
  if(G.kind === 'up'){
    // the highest ledge on screen near the middle
    const ref = partner ? partner.x : VW / 2;
    for(let r = Math.floor((G.cam.y + 30) / T); r < Math.floor((G.cam.y + VH - 10) / T); r++)
      for(let d = 0; d < 22; d++) for(const sgn of [1, -1]){
        const tx = Math.floor(ref / T) + d * sgn;
        if(standable(tileAt(tx, r)) && !isSolid(tileAt(tx, r - 1)) && !isSolid(tileAt(tx, r - 2)) && tx > 0 && tx < G.W - 1) return { x: tx * T + 3, y: Math.max(G.cam.y - 20, T + 2) };
      }
    return { x: VW / 2, y: Math.max(G.cam.y - 20, T + 2) };
  }
  const want = partner ? partner.x - 20 : G.cam.x + 70;
  for(let d = 0; d < 20; d++) for(const sgn of [1, -1]){
    const x = clamp(want + d * 8 * sgn, G.cam.x + 16, G.cam.x + VW - 40);
    const f = floorBelow(x + 5, G.cam.y + 20);
    if(f !== null && f < G.H * T - 1 + 1 && tileAt(Math.floor((x + 5) / T), Math.floor(f / T)) !== '~') return { x, y: G.cam.y - 24 };
  }
  return { x: G.cam.x + 60, y: G.cam.y - 24 };
}
function respawn(p){
  resetHero(p);
  const s = respawnSpot(p);
  p.x = s.x; p.y = s.y; p.inv = 2.6; p.dropIn = 1; p.vy = 60;
  if(G.kind !== 'fly'){ let n = 0; while(rectSolid(p) && n++ < 40) p.y += 4; if(G.def.ceiling) p.y = Math.max(p.y, 2 * T + 2); }
  if(G.kind === 'fly'){ p.w = 16; p.h = 12; p.dropIn = 0; p.inv = 2.6; }
  sfx('warpIn'); fx('warp', p.x + p.w / 2, p.y + 20, p.color);
}
function stepSOS(p, dt){
  p.sosT += dt;
  let tgt = null, best = 1e9;
  for(const q of G.players) if(q !== p && active(q)){ const d = Math.hypot(q.x - p.x, q.y - p.y); if(d < best){ best = d; tgt = q; } }
  if(tgt){
    const dx = tgt.x - p.x, dy = tgt.y - 16 - p.y, d = Math.hypot(dx, dy) || 1, sp = d > 60 ? 55 : 18;
    p.x += dx / d * sp * dt; p.y += (dy / d * sp + Math.sin(p.sosT * 3) * 10) * dt;
    if(p.sosT > 0.8 && d < 18){
      p.sos = false; resetHero(p); p.inv = 2; p.hp = Math.max(1, Math.ceil(p.maxHp / 2));
      sfx('revive'); fx('sparkle', p.x + 5, p.y + 10, p.color); fx('text', p.x + 5, p.y - 14, 'BACK IN!', '#7dff8a');
      if(G.kind === 'fly'){ p.w = 16; p.h = 12; }
    }
  }
  p.x = clamp(p.x, G.cam.x + 8, G.cam.x + VW - 20); p.y = clamp(p.y, G.cam.y + 24, G.cam.y + VH - 30);
}
function mechStomp(p){
  for(const e of G.ents){
    if(!FOES.has(e.k) || e.dead || e.k === 'boss' || e.k === 'crate') continue;
    if(e.x < p.x + p.w + 14 && e.x + e.w > p.x - 14 && Math.abs(e.y + e.h - (p.y + p.h)) < 18) damage(e, 5, p);
  }
}
function boardMech(p, m){
  const nx = m.x, ny = m.y;
  const test = { x: nx, y: ny, w: MECH_W, h: MECH_H };
  if(rectSolid(test)) return false;
  p.x = nx; p.y = ny; p.w = MECH_W; p.h = MECH_H; p.mech = 6; p.inv = 0.6; p.spin = false;
  m.dead = 1; sfx('mechIn'); fx('text', p.x + 11, p.y - 10, 'STOMPER!', '#ffd45e');
  return true;
}
function ejectMech(p){
  sfx('boomL'); fx('boom', p.x + p.w / 2, p.y + p.h / 2, 2); fx('shake', 0.4);
  p.mech = 0; p.x += 6; p.w = PW; p.y += MECH_H - STAND_H; p.h = STAND_H; p.vy = -300; p.onGround = false; p.jumping = false; p.spin = true; p.inv = 1.6;
  if(rectSolid(p)){ p.h = BALL_H; p.y += STAND_H - BALL_H; }
}
/* Jet boards (Skyway Chase): the D-pad flies you anywhere on screen, FIRE shoots ahead. */
function stepFlyer(p, dt, c){
  const dx = (c.right ? 1 : 0) - (c.left ? 1 : 0), dy = (c.down ? 1 : 0) - (c.up ? 1 : 0);
  const sp = 128, n = dx && dy ? 0.72 : 1;
  p.vx = G.flySpeed + dx * sp * n; p.vy = dy * sp * n;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, G.cam.x + 4, G.cam.x + VW - 24); p.y = clamp(p.y, 22, VH - 18);
  p.face = 1; p.ax = 1; p.ay = 0; p.tilt = dy;
  if(c.fire && p.fireT <= 0) shoot(p);
}

/* ---------- Enemy shots ---------- */
let nextE = 1;
function eshot(k, x, y, vx, vy, o){
  const m = o && o.raw ? 1 : D().bspeed;
  const s = Object.assign({ id: nextE++, k, x, y, vx: vx * m, vy: vy * m, g: 0, life: 6, r: 3 }, o);
  G.eshots.push(s); return s;
}
function targetPlayer(x, y){
  let best = null, bd = 1e9;
  for(const p of G.players){ if(!active(p) || p.dropIn > 0) continue; const d = Math.hypot(p.x + p.w / 2 - x, p.y + p.h / 2 - y); if(d < bd){ bd = d; best = p; } }
  return best;
}
function aimAt(x, y, spd, spread){
  const p = targetPlayer(x, y);
  const a = p ? Math.atan2(p.y + p.h / 2 - y, p.x + p.w / 2 - x) : Math.PI;
  const b = a + (spread || 0);
  return [Math.cos(b) * spd, Math.sin(b) * spd];
}
/* A lobbed bomb that lands near the nearest hero. */
function lob(x, y, k, time){
  const p = targetPlayer(x, y), g = 380;
  time = (time || 1.3) / Math.sqrt(D().bspeed);
  const tx = p ? p.x + p.w / 2 + (Math.random() - 0.5) * 20 : x - 80, ty = p ? p.y + p.h : y;
  const vx = (tx - x) / time, vy = (ty - y - 0.5 * g * time * time) / time;
  eshot(k || 'bomb', x, y, vx, vy, { g, raw: true, r: 4 });
  sfx('lob');
}
function pHurtBox(p){ return { x: p.x + 1.5, y: p.y + 2, w: p.w - 3, h: p.h - 3 }; }
function blast(x, y, r){
  fx('boom', x, y, 1); sfx('pop');
  for(const p of G.players) if(active(p)){ const b = pHurtBox(p); const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h); if(Math.hypot(cx - x, cy - y) < r) hurt(p, 'blast'); }
}
function stepEShots(dt){
  const vx0 = G.cam.x - 50, vx1 = G.cam.x + VW + 50, vy0 = G.cam.y - 90, vy1 = G.cam.y + VH + 50;
  for(const s of G.eshots){
    s.life -= dt; s.vy += s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if(s.life <= 0 || s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1){ s.dead = 1; continue; }
    if(s.k === 'ice'){
      const ahead = tileAt(Math.floor((s.x + Math.sign(s.vx) * 6) / T), Math.floor(s.y / T));
      if(isSolid(ahead)){ s.dead = 1; fx('chunks', s.x, s.y, '#bfefff'); continue; }
    } else if(G.kind !== 'fly' && isSolid(tileAt(Math.floor(s.x / T), Math.floor(s.y / T)))){
      s.dead = 1;
      if(s.k === 'bomb' || s.k === 'scrap') blast(s.x, s.y - 4, 16); else fx('spark', s.x, s.y, '#ffb38a');
      continue;
    }
    for(const p of G.players){
      if(!active(p)) continue;
      const b = pHurtBox(p);
      if(s.x + s.r > b.x && s.x - s.r < b.x + b.w && s.y + s.r > b.y && s.y - s.r < b.y + b.h){
        if(p.dive && s.k !== 'bomb' && s.k !== 'scrap') continue;
        if(s.k === 'bomb' || s.k === 'scrap'){ s.dead = 1; blast(s.x, s.y, 16); }
        else { if(p.shield > 0 || p.inv > 0 || p.dropIn > 0) { if(p.shield > 0){ s.dead = 1; fx('spark', s.x, s.y, '#7fe3ff'); } continue; } s.dead = 1; hurt(p, 'shot'); }
        break;
      }
    }
  }
  G.eshots = G.eshots.filter(s => !s.dead);
}

/* ---------- Player shots ---------- */
function stepShots(dt){
  const vx0 = G.cam.x - 24, vx1 = G.cam.x + VW + 24, vy0 = G.cam.y - 24, vy1 = G.cam.y + VH + 24;
  for(const s of G.shots){
    s.life -= dt;
    if(s.k === 'seek'){
      const t = nearestFoe(s.x, s.y, 260);
      if(t){
        const want = Math.atan2(t.y + t.h / 2 - s.y, t.x + t.w / 2 - s.x), cur = Math.atan2(s.vy, s.vx);
        const na = cur + clamp(angDiff(want, cur), -6 * dt, 6 * dt);
        s.vx = Math.cos(na) * s.spd; s.vy = Math.sin(na) * s.spd;
      }
      s.spd = Math.min(s.spd + 160 * dt, 380);
    }
    s.x += s.vx * dt; s.y += s.vy * dt;
    if(s.life <= 0 || s.x < vx0 || s.x > vx1 || s.y < vy0 || s.y > vy1){ s.dead = 1; continue; }
    if(G.kind !== 'fly'){
      const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T), ch = tileAt(tx, ty);
      if(isSolid(ch)){
        s.dead = 1;
        if(ch === 'D') hitWall(tx, ty, s.dmg);
        else fx('spark', s.x - Math.sign(s.vx) * 2, s.y, '#fff6c8');
        continue;
      }
    }
    const owner = G.players.find(p => p.slot === s.owner);
    for(const e of G.ents){
      if(e.dead || !FOES.has(e.k) || !e.on) continue;
      if(e.k === 'boss'){ if(shotBoss(s, e, owner)) break; continue; }
      if(s.x + s.r < e.x || s.x - s.r > e.x + e.w || s.y + s.r < e.y || s.y - s.r > e.y + e.h) continue;
      if(s.k === 'beam'){ if(s.hit.includes(e.id)) continue; s.hit.push(e.id); }
      if(owner) owner.hits++;
      if(armored(e)){ fx('clank', s.x, s.y); sfx('clank'); s.dead = 1; break; }
      damage(e, s.dmg, owner);
      fx('spark', s.x, s.y, owner ? owner.color : '#fff');
      if(s.k !== 'beam'){ s.dead = 1; break; }
    }
  }
  G.shots = G.shots.filter(s => !s.dead);
}
function hitWall(tx, ty, dmg){
  const i = ty * G.W + tx, hp = (G.wallHp.has(i) ? G.wallHp.get(i) : Math.round(5 * D().ehp)) - dmg;
  fx('chunks', tx * T + 8, ty * T + 8, '#9aa0b4'); sfx('hit');
  if(hp <= 0){ G.wallHp.delete(i); setTile(tx, ty, '.'); fx('boom', tx * T + 8, ty * T + 8, 1); sfx('crumble'); addScore(50); }
  else G.wallHp.set(i, hp);
}
function armored(e){
  if(e.k === 'turret') return e.st !== 'open';
  if(e.k === 'hider') return e.st === 'hide';
  return false;
}
function damage(e, dmg, p){
  if(e.dead) return;
  e.hp -= dmg; e.hf = 0.08;
  if(e.hp <= 0) killFoe(e, p); else sfx('hit');
}
function killFoe(e, p){
  e.dead = 1;
  const x = e.x + e.w / 2, y = e.y + e.h / 2, big = e.k === 'tank' || e.k === 'walker' || e.k === 'barge';
  fx('boom', x, y, big ? 2 : 1); sfx(big ? 'boomL' : 'pop'); if(big) fx('shake', 0.35);
  if(e.k === 'crate' || e.k === 'pod'){
    const kind = e.item || G.def.pool[Math.floor(Math.random() * G.def.pool.length)];
    mkEnt('item', x - 7, y - 6, { item: kind, vy: G.kind === 'fly' ? 0 : -210, vx: e.k === 'pod' && G.kind !== 'fly' ? 30 : 0, t: 0, st: 'pop' });
    if(p && e.k === 'pod') p.pods++;
    addScore(FOE_PTS[e.k], x, e.y - 4);
    return;
  }
  G.combo++; G.comboT = 1.5;
  const mult = G.combo >= 4 ? Math.min(5, 1 + Math.floor(G.combo / 4)) : 1;
  addScore((FOE_PTS[e.k] || 100) * mult, x, e.y - 4, mult > 1 ? '#ffd45e' : '#fff6e0');
  if(G.combo >= 4 && G.combo % 4 === 0){ fx('big', x, e.y - 16, 'COMBO ×' + mult, '#ffd45e'); sfx('combo'); }
  if(p) p.kills++;
}

/* ---------- Robots ---------- */
function inView(e, m){ m = m || 0; return e.x + e.w > G.cam.x - m && e.x < G.cam.x + VW + m && e.y + e.h > G.cam.y - m && e.y < G.cam.y + VH + m; }
const fireRate = () => D().fire;
function stepEnt(e, dt){
  e.t += dt; if(e.hf > 0) e.hf -= dt;
  if(!e.awake && inView(e, 8)) e.awake = true;
  // robots left far behind are recycled
  if(e.k !== 'boss' && e.k !== 'check' && G.kind !== 'fly'){
    if(G.kind === 'side' && e.x + e.w < G.cam.x - 72 && e.k !== 'spawner'){ e.dead = 1; return; }
    if(G.kind === 'up' && e.y > G.cam.y + VH + 80){ e.dead = 1; return; }
  }
  if(G.kind === 'fly' && e.k !== 'boss' && (e.x + e.w < G.cam.x - 40)){ e.dead = 1; return; }
  const P = targetPlayer(e.x + e.w / 2, e.y + e.h / 2);
  const dxP = P ? P.x + P.w / 2 - (e.x + e.w / 2) : -1, dyP = P ? P.y + P.h / 2 - (e.y + e.h / 2) : 0;
  switch(e.k){
    case 'runner': {
      e.vx = e.face * (D().fire < 0.8 ? 78 : 104);
      e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt);
      const wasG = e.onGround;
      moveBody(e, dt);
      if(e.hitWall && e.onGround){ e.vy = -300; e.onGround = false; e.jumped = (e.jumped || 0) + 1; if(e.jumped > 2) e.face = -e.face; }
      if(wasG && !e.onGround && e.vy >= 0 && Math.random() < 0.3){ e.vy = -260; }
      if(e.y > G.H * T + 20 || e.x < G.cam.x - 40 || e.x > G.cam.x + VW + 40) e.dead = 1;
      break;
    }
    case 'gunner':
      if(!e.awake) break;
      e.face = dxP < 0 ? -1 : 1;
      if(e.t > 1.8 / fireRate() && P && Math.abs(dxP) < 250 && Math.abs(dyP) < 160){
        e.t = Math.random() * 0.5; e.st = 'shoot'; e.stT = 0.25;
        const [vx, vy] = aimAt(e.x + e.w / 2 + e.face * 8, e.y + 8, 105);
        eshot('orb', e.x + e.w / 2 + e.face * 8, e.y + 8, vx, vy); sfx('eshot');
      }
      if(e.stT > 0){ e.stT -= dt; if(e.stT <= 0) e.st = ''; }
      break;
    case 'turret': {
      const near = P && Math.abs(dxP) < 230 && Math.abs(dyP) < 170;
      if(e.st === 'closed' && near){ e.st = 'opening'; e.t = 0; }
      else if(e.st === 'opening' && e.t > 0.4){ e.st = 'open'; e.t = 0; e.shots = 0; }
      else if(e.st === 'open'){
        if(P){ const want = Math.atan2(dyP, dxP); e.ang += clamp(angDiff(want, e.ang), -2.4 * dt, 2.4 * dt); }
        const cyc = 2.4 / fireRate();
        if(e.t > cyc && e.shots < 3 && e.t > cyc + e.shots * 0.16){
          e.shots++; const c = Math.cos(e.ang), s = Math.sin(e.ang);
          eshot('orb', e.x + 8 + c * 11, e.y + 6 + s * 11, c * 110, s * 110); sfx('eshot');
          if(e.shots >= 3){ e.t = 0; e.shots = 0; }
        }
        if(!near && e.t > 1.5){ e.st = 'closed'; e.t = 0; }
      }
      break;
    }
    case 'drone':
      if(!e.awake) break;
      e.x += clamp(dxP, -1, 1) * 36 * dt;
      e.y = e.by + Math.sin(e.t * 2.4) * 10;
      e.face = dxP < 0 ? -1 : 1;
      e.bt = (e.bt || 1.5) - dt * fireRate();
      if(e.bt <= 0 && Math.abs(dxP) < 60){ e.bt = 2.4; eshot('bomb', e.x + 8, e.y + 12, 0, 20, { g: 360, r: 4 }); sfx('lob'); }
      break;
    case 'mortar':
      if(!e.awake) break;
      e.face = dxP < 0 ? -1 : 1;
      if(e.t > 3 / fireRate() && P && Math.abs(dxP) < 280){ e.t = 0; e.st = 'shoot'; e.stT = 0.3; lob(e.x + 8, e.y + 2, 'bomb', 1.35); }
      if(e.stT > 0){ e.stT -= dt; if(e.stT <= 0) e.st = ''; }
      break;
    case 'hider': {
      const near = P && Math.abs(dxP) < 240 && Math.abs(dyP) < 150;
      e.face = dxP < 0 ? -1 : 1;
      if(e.st === 'hide'){ if(near && e.t > 1.6 / fireRate()){ e.st = 'up'; e.t = 0; } }
      else if(e.st === 'up'){
        if(e.t > 0.35 && !e.fired){ e.fired = true; const [vx, vy] = aimAt(e.x + 7, e.y + 4, 100); eshot('orb', e.x + 7, e.y + 4, vx, vy); sfx('eshot'); }
        if(e.t > 1.2){ e.st = 'hide'; e.t = 0; e.fired = false; }
      }
      break;
    }
    case 'roller':
      e.vx = e.face * 70; e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt);
      moveBody(e, dt); e.spin = (e.spin || 0) + e.vx * dt / 7;
      if(e.hitWall){ if(e.onGround) e.vy = -220; }
      if(e.y > G.H * T + 20) e.dead = 1;
      break;
    case 'rock':
      if(e.st === 'warn'){ if(e.t > 0.7){ e.st = 'fall'; e.t = 0; } break; }
      if(e.sub === 'boulder'){
        e.vy = Math.min(360, e.vy + 520 * dt);
        const vy0 = e.vy; moveBody(e, dt);
        if(e.onGround && vy0 > 110){ e.vy = -vy0 * 0.5; sfx('crush'); fx('dust', e.x + 8, e.y + 16); }
        if(e.hitWall) e.vx = -e.vx;
        e.spin = (e.spin || 0) + e.vx * dt / 8;
        if(e.t > 6) e.dead = 1;
      } else { e.vy = Math.min(260, e.vy + 500 * dt); e.y += e.vy * dt; e.spin = (e.spin || 0) + dt * 3; }
      if(e.y > G.cam.y + VH + 30) e.dead = 1;
      break;
    case 'tank':
      if(!e.awake) break;
      e.face = dxP < 0 ? -1 : 1;
      if(Math.abs(dxP) > 150){ e.vx = e.face * 26; } else e.vx = 0;
      e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt); moveBody(e, dt);
      e.tread = (e.tread || 0) + Math.abs(e.vx) * dt;
      if(e.t > 2.6 / fireRate() && P){
        e.t = 0; e.alt = !e.alt; e.st = 'shoot'; e.stT = 0.3;
        if(e.alt) { eshot('shell', e.x + e.w / 2 + e.face * 24, e.y + 8, e.face * 140, 0, { r: 3.5 }); sfx('cannon'); }
        else lob(e.x + e.w / 2, e.y, 'bomb', 1.4);
      }
      if(e.stT > 0){ e.stT -= dt; if(e.stT <= 0) e.st = ''; }
      break;
    case 'jetbot': {
      const sx = e.x - G.cam.x;
      if(e.st === 'in'){ const d = e.hx - sx; e.x += clamp(d, -1, 1) * 110 * dt; if(Math.abs(d) < 3){ e.st = 'hover'; e.t = 0; e.n = 0; } }
      else if(e.st === 'hover'){
        if(e.t > 1.3 / fireRate()){ e.t = 0; e.n++; const [vx, vy] = aimAt(e.x + 8, e.y + 10, 105); eshot('orb', e.x + 8, e.y + 10, vx, vy); sfx('eshot'); if(e.n >= 3){ e.st = 'out'; e.t = 0; } }
      } else { e.y -= 70 * dt; e.x += (sx < VW / 2 ? -1 : 1) * 70 * dt; if(e.t > 3) e.dead = 1; }
      if(G.kind === 'fly') e.x += G.flySpeed * dt;
      e.bob = Math.sin(G.time * 5 + e.id) * 2;
      e.face = dxP < 0 ? -1 : 1;
      break;
    }
    case 'walker':
      if(!e.awake) break;
      e.face = dxP < 0 ? -1 : 1;
      e.vx = Math.abs(dxP) > 120 ? e.face * 30 : 0;
      e.vy = Math.min(MAX_FALL, e.vy + GRAV * dt); moveBody(e, dt);
      e.walk = (e.walk || 0) + Math.abs(e.vx) * dt;
      if(e.t > 2.8 / fireRate()){ e.st = 'shoot'; if(e.t > 2.8 / fireRate() + (e.n || 0) * 0.18){ e.n = (e.n || 0) + 1; eshot('orb', e.x + e.w / 2 + e.face * 14, e.y + 11, e.face * 130, 0); sfx('eshot'); if(e.n >= 3){ e.t = 0; e.n = 0; e.st = ''; } } }
      break;
    case 'crusher': {
      const full = e.floor - 2;
      if(e.st === 'up'){ e.ext = e.top + 16; if(e.t > 1.7){ e.st = 'warn'; e.t = 0; } }
      else if(e.st === 'warn'){ if(e.t > 0.55){ e.st = 'down'; e.t = 0; } }
      else if(e.st === 'down'){ e.ext = Math.min(full, e.ext + 900 * dt); if(e.ext >= full){ e.st = 'hold'; e.t = 0; if(inView(e, 0)){ sfx('crush'); fx('shake', 0.2); fx('dust', e.x + 10, full); } } }
      else if(e.st === 'hold'){ if(e.t > 0.5){ e.st = 'rise'; e.t = 0; } }
      else { e.ext = Math.max(e.top + 16, e.ext - 150 * dt); if(e.ext <= e.top + 16){ e.st = 'up'; e.t = 0; } }
      break;
    }
    case 'crate': break;
    case 'pod':
      if(G.kind === 'fly'){ e.x += (G.flySpeed - 70) * dt; e.y = e.by + Math.sin(e.t * 3) * 14; }
      else { e.x += e.vx * dt; e.y = e.by + Math.sin(e.t * 2.6) * 16; if(e.x > G.cam.x + VW + 40 || e.x < G.cam.x - 60) e.dead = 1; }
      break;
    case 'item':
      if(G.kind === 'fly'){ e.y += Math.sin(e.t * 3) * 0.2; }
      else if(e.st === 'pop' || !e.onGround){ e.vy = Math.min(300, e.vy + 700 * dt); moveBody(e, dt); if(e.onGround){ e.vx = 0; e.st = 'rest'; } }
      if(e.t > 14) e.dead = 1;
      break;
    case 'gear': e.y = e.by + Math.sin(e.t * 3) * 2; break;
    case 'spawner': stepSpawner(e, dt); break;
    case 'saucer':
      e.x += (G.flySpeed - 150) * dt; e.y = e.by + Math.sin(e.t * 3 + e.ph) * 22;
      if(!e.fired && e.t > 1.1 + e.ph * 0.3 && Math.random() < (D().fire > 0.8 ? 0.5 : 0.25)){ e.fired = true; const [vx, vy] = aimAt(e.x, e.y + 5, 100); eshot('orb', e.x, e.y + 5, vx + G.flySpeed, vy); }
      else if(e.t > 1.1 + e.ph * 0.3) e.fired = true;
      break;
    case 'missile':
      if(e.sub === 'homing'){
        const a = Math.atan2(e.vy, e.vx), want = P ? Math.atan2(dyP, dxP) : a, na = a + clamp(angDiff(want, a), -1.6 * dt, 1.6 * dt);
        e.vx = Math.cos(na) * 95 * D().bspeed; e.vy = Math.sin(na) * 95 * D().bspeed;
        e.x += (e.vx + G.flySpeed) * dt; e.y += e.vy * dt; if(e.t > 5.5){ killFoe(e, null); }
      } else if(e.st === 'warn'){ e.x = G.cam.x + VW + 30; if(e.t > 0.9){ e.st = 'go'; e.t = 0; sfx('seek'); } }
      else e.x += (G.flySpeed - 300 * D().bspeed) * dt;
      break;
    case 'barge': {
      const sx = e.x - G.cam.x;
      if(e.st === 'in'){ e.x += (G.flySpeed - 90) * dt; if(sx < VW - 96){ e.st = 'hover'; e.t = 0; } }
      else if(e.st === 'hover'){
        e.x += G.flySpeed * dt; e.y = e.by + Math.sin(e.t * 1.6) * 8;
        if((e.ft = (e.ft || 0.8) - dt * fireRate()) <= 0){ e.ft = 1.4; const [vx, vy] = aimAt(e.x + 8, e.y + 6, 110); eshot('orb', e.x + 8, e.y + 6, vx + G.flySpeed, vy); sfx('eshot'); }
        if(e.t > 7){ e.st = 'out'; e.t = 0; }
      } else e.x += (G.flySpeed - 70) * dt;
      break;
    }
    case 'mine': e.x += (G.flySpeed - 40) * dt; e.y = e.by + Math.sin(e.t * 2 + e.id) * 10; break;
    case 'boss': stepBoss(e, dt); break;
  }
}
function stepSpawner(e, dt){
  if(e.sub === 'pod'){
    const trig = G.kind === 'up' ? e.y > G.cam.y + 10 && e.y < G.cam.y + VH - 20 : e.x < G.cam.x + VW - 20;
    if(trig){ e.dead = 1; const fromLeft = G.kind === 'up' ? true : true; mkEnt('pod', fromLeft ? G.cam.x - 22 : G.cam.x + VW + 2, e.y, { by: e.y, vx: fromLeft ? 72 : -72, item: null }); }
  } else if(e.sub === 'jet'){
    const trig = G.kind === 'up' ? e.y > G.cam.y + 20 && e.y < G.cam.y + VH - 40 : e.x < G.cam.x + VW;
    if(trig){ e.dead = 1; const left = (e.x - G.cam.x) < VW / 2; mkEnt('jetbot', left ? G.cam.x - 20 : G.cam.x + VW + 4, e.y, { st: 'in', hx: left ? 40 + Math.random() * 40 : VW - 80 - Math.random() * 40, t: 0, face: left ? 1 : -1 }); }
  } else if(e.sub === 'roll'){
    if(e.x > G.cam.x - 20 && e.x < G.cam.x + VW + 60 && !G.locked){
      e.t -= dt;
      if(e.t <= 0){ e.t = 4.5 / D().runners; const P = targetPlayer(e.x, e.y); mkEnt('roller', e.x - 7, e.y + 2, { face: P && P.x > e.x ? 1 : -1 }); }
    }
  } else if(e.sub === 'rock'){
    if(e.y > G.cam.y - 90 && e.y < G.cam.y + VH && !G.locked){
      e.t -= dt;
      if(e.t <= 0){ e.t = 3.4 / D().runners; mkEnt('rock', e.x - 8, G.cam.y - 4, { st: 'warn', sub: 'fall', vy: 20 }); }
    }
  }
}
function spawnRunner(){
  const n = G.ents.filter(e => e.k === 'runner' && !e.dead).length;
  if(n >= 3) return;
  const fromLeft = Math.random() < 0.25 && G.cam.x > 40;
  const x = fromLeft ? G.cam.x - 12 : G.cam.x + VW + 2;
  const f = floorBelow(x + 6, G.cam.y + 20);
  if(f === null || f >= G.H * T) return;
  const tx = Math.floor((x + 6) / T), ty = Math.floor(f / T);
  if(tileAt(tx, ty - 1) === '~' || isSolid(tileAt(tx, ty - 1))) return;
  mkEnt('runner', x, f - 20, { face: fromLeft ? 1 : -1 });
}

/* ---------- The jet-board chase ---------- */
function stepSky(dt){
  G.skyT += dt;
  while(G.waveIx < SKY_WAVES.length && SKY_WAVES[G.waveIx][0] <= G.skyT){
    const w = SKY_WAVES[G.waveIx++], y = 24 + w[2] * (VH - 60), x = G.cam.x + VW + 16;
    if(w[1] === 'saucers') for(let i = 0; i < w[3]; i++) mkEnt('saucer', x + i * 24, y, { by: y, ph: i * 0.7 });
    else if(w[1] === 'missile') mkEnt('missile', x + 20, y, { st: 'warn' });
    else if(w[1] === 'barge') mkEnt('barge', x, y, { by: y, st: 'in' });
    else if(w[1] === 'mine') for(let i = 0; i < w[3]; i++) mkEnt('mine', x + i * 44, 30 + ((i * 53 + w[0] * 17) % (VH - 70)), { by: 30 + ((i * 53 + w[0] * 17) % (VH - 70)) });
    else if(w[1] === 'jet') mkEnt('jetbot', x, y, { st: 'in', hx: VW - 70, face: -1 });
    else if(w[1] === 'pod') mkEnt('pod', x, y, { by: y, item: w[3] });
    else if(w[1] === 'end') G.skyEnd = true;
    if(w[0] >= 40 && (!G.check || !G.check.sky)) G.check = { sky: 40 };
  }
  if(G.skyEnd && !G.locked && !G.ents.some(e => FOES.has(e.k) && !e.dead && e.k !== 'pod')) bossStart();
}

/* ---------- Touching things ---------- */
function interact(){
  for(const p of G.players){
    if(!active(p)) continue;
    const hb = pHurtBox(p);
    for(const e of G.ents){
      if(e.dead || !e.on) continue;
      if(e.k === 'item'){ if(overlap(p, e)){ e.dead = 1; giveItem(p, e.item); } continue; }
      if(e.k === 'gear'){ if(overlap(p, e)){ e.dead = 1; gotGear(p, e); } continue; }
      if(e.k === 'mech'){ if(!p.mech && overlap(p, e) && G.kind === 'side') boardMech(p, e); continue; }
      if(e.k === 'check'){ if(e.st !== 'on' && p.x > e.x - 4 && Math.abs(p.y - e.y) < 90){ e.st = 'on'; G.check = G.kind === 'up' ? { x: e.x, y: e.y + 40 } : { x: e.x }; sfx('check'); fx('text', e.x + 5, e.y - 8, 'CHECKPOINT', '#7dff8a'); } continue; }
      if(e.k === 'crusher'){ if(e.st === 'down' || e.st === 'hold'){ const r = { x: e.x + 2, y: e.top, w: 16, h: e.ext - e.top }; if(overlap(hb, r)) hurt(p, 'crush'); } continue; }
      if(e.k === 'boss'){ bossContact(e, p, hb); continue; }
      if(!HURTS.has(e.k)) continue;
      if(e.k === 'hider' && e.st === 'hide') continue;
      if(e.k === 'rock' && e.st === 'warn') continue;
      if(e.k === 'missile' && e.st === 'warn') continue;
      if(!overlap(hb, e)) continue;
      if(p.mech && (e.k === 'runner' || e.k === 'roller' || e.k === 'hider' || e.k === 'gunner')){ damage(e, 5, p); fx('dust', e.x + e.w / 2, e.y + e.h); continue; }
      hurt(p, 'touch');
    }
  }
}
function gotGear(p, e){
  G.gotGear = true; addScore(5000, e.x + 6, e.y - 6, '#ffd45e'); sfx('gear'); fx('sparkle', e.x + 6, e.y + 6, '#ffd45e');
  fx('big', e.x + 6, e.y - 18, 'GOLD GEAR!', '#ffd45e');
  if(!G.gears.includes(G.lv)){ G.gears.push(G.lv); A.Store.set('strike.gears', G.gears); }
}

/* ---------- Bosses ----------
   Each boss has parts with their own health (ph). Shots on armour clank off.
   Everything a screen needs to draw a boss lives in st, t, ph and v[], so online guests draw it exactly. */
const BOSS_PARTS = [[10, 10, 28], [12, 12, 26], [36, 14], [34, 8, 8], [14, 14, 40], [18, 18, 50]];
function makeBoss(bw){
  const hpM = D().bhp, ph = BOSS_PARTS[bw].map(h => Math.max(3, Math.round(h * hpM)));
  const e = mkEnt('boss', 0, 0, { bw, ph, pm: ph.slice(), phf: ph.map(() => 0), v: [0, 0, 0, 0, 0, 0, 0, 0], st: 'intro', t: 0, on: true, awake: true, name: BOSS_NAMES[bw] });
  BOSS[bw].init(e);
  return e;
}
const x0 = () => G.arena ? G.arena.x0 : 0;
const BOSS = [
  { // GATEKEEPER: a jungle fortress gate with two cannons and a core behind a shutter
    init(e){ e.x = x0() + 300; e.y = 32; e.w = 84; e.h = 160; e.fa = 1.4; e.fb = 2.2; e.gt = 3; e.burst = 0; },
    step(e, dt){
      if(e.st === 'intro'){ if(e.t > 1.4){ e.st = 'fight'; e.t = 0; } return; }
      const cannons = e.ph[0] > 0 || e.ph[1] > 0;
      const want = cannons ? ((G.lvT % 3.8) < 1.5 ? 0 : 1) : 1;
      e.v[0] += clamp(want - e.v[0], -dt * 3.5, dt * 3.5);
      e.v[1] = Math.max(0, e.v[1] - dt * 4); e.v[2] = Math.max(0, e.v[2] - dt * 4);
      e.fa -= dt * fireRate();
      if(e.fa <= 0 && e.ph[0] > 0){ e.fa = 2.3; lob(e.x + 2, e.y + 41, 'bomb', 1.25); e.v[1] = 1; }
      e.fb -= dt * fireRate();
      if(e.fb <= 0 && e.ph[1] > 0){
        e.burst++; e.fb = e.burst % 3 ? 0.22 : 2.4;
        const [vx, vy] = aimAt(e.x + 2, e.y + 93, 120); eshot('orb', e.x + 2, e.y + 93, vx, vy); sfx('eshot'); e.v[2] = 1;
      }
      e.gt -= dt;
      if(e.gt <= 0 && e.v[0] > 0.8){ e.gt = 3.8 / D().runners; if(G.ents.filter(q => q.k === 'runner' && !q.dead).length < 2) mkEnt('runner', e.x + 4, 172, { face: -1 }); }
    },
    zones(e){ return [{ x: e.x, y: e.y + 34, w: 26, h: 14, part: 0 }, { x: e.x, y: e.y + 86, w: 26, h: 14, part: 1 },
      { x: e.x + 12, y: e.y + 122, w: 28, h: 38, part: 2 }, { x: e.x + 14, y: e.y, w: 70, h: 160, part: -1, contact: true }]; },
    open(e, i){ return i < 2 || e.v[0] > 0.6; },
    wall(e){ return e.x + 10; },
    won(e){ return e.ph[2] <= 0; }
  },
  { // BOULDER BOT: a rock robot at the top of the falls that throws boulders and roars
    init(e){ e.x = 144; e.y = -60; e.w = 96; e.h = 72; e.fa = 1.6; e.arm = 0; e.rt = 4; e.throwT = 0; },
    step(e, dt){
      if(e.st === 'intro'){ e.y = -60 + Math.min(1, e.t / 1.4) * 76; if(e.t > 1.4){ e.st = 'fight'; e.t = 0; } return; }
      e.v[0] = Math.sin(G.lvT * 0.6) * 28; e.x = 144 + e.v[0];
      const arms = [e.ph[0] > 0, e.ph[1] > 0];
      e.v[1] = Math.max(0, e.v[1] - dt * 2.5); e.v[2] = Math.max(0, e.v[2] - dt * 2.5);
      if(e.throwT > 0){
        e.throwT -= dt; const k = 1 + e.arm; e.v[k] = Math.min(1, e.v[k] + dt * 4);
        if(e.throwT <= 0 && arms[e.arm]){
          const hx = e.arm ? e.x + 110 : e.x - 14, hy = e.y + 24, P = targetPlayer(hx, hy);
          const vx = P ? clamp((P.x - hx) * 0.9, -110, 110) : 0;
          mkEnt('rock', hx - 8, hy, { sub: 'boulder', vx, vy: -120, st: 'fall' }); sfx('lob');
        }
      } else {
        e.fa -= dt * fireRate();
        if(e.fa <= 0 && (arms[0] || arms[1])){ e.arm = arms[0] && arms[1] ? 1 - e.arm : arms[0] ? 0 : 1; e.throwT = 0.5; e.fa = arms[0] && arms[1] ? 2.2 : 1.6; }
      }
      e.rt -= dt;
      if(e.rt <= 0 && e.st === 'fight'){ e.st = 'roar'; e.t = 0; e.shot = 0; }
      if(e.st === 'roar'){
        e.v[3] = Math.min(1, e.v[3] + dt * 5);
        if(e.t > 0.45 && e.shot === 0 || e.t > 1.05 && e.shot === 1 && !(arms[0] || arms[1])){
          e.shot++; const n = 5; for(let i = 0; i < n; i++){ const a = Math.PI / 2 + (i - 2) * 0.32; eshot('orb', e.x + 48, e.y + 70, Math.cos(a) * 95, Math.sin(a) * 95); } sfx('eshot');
        }
        if(e.t > 1.7){ e.st = 'fight'; e.t = 0; e.rt = arms[0] || arms[1] ? 4.2 : 2.4; }
      } else e.v[3] = Math.max(0, e.v[3] - dt * 4);
    },
    zones(e){
      const la = e.y + 34 - e.v[1] * 20, ra = e.y + 34 - e.v[2] * 20, z = [];
      z.push({ x: e.x + 34, y: e.y + 60, w: 28, h: 16, part: 2 });
      if(e.ph[0] > 0) z.push({ x: e.x - 26, y: la, w: 24, h: 24, part: 0, contact: true });
      if(e.ph[1] > 0) z.push({ x: e.x + 98, y: ra, w: 24, h: 24, part: 1, contact: true });
      z.push({ x: e.x + 6, y: e.y + 34, w: 28, h: 38, part: -1, contact: true }, { x: e.x + 62, y: e.y + 34, w: 28, h: 38, part: -1, contact: true },
        { x: e.x + 34, y: e.y + 34, w: 28, h: 26, part: -1, contact: true }, { x: e.x + 28, y: e.y + 2, w: 40, h: 34, part: -1, contact: true });
      return z;
    },
    open(e, i){ return i < 2 || e.v[3] > 0.5 || (e.ph[0] <= 0 && e.ph[1] <= 0); },
    won(e){ return e.ph[2] <= 0; }
  },
  { // SNOWPLOW: an armoured plough tank. Shoot the cockpit on top; hop onto the ledge when it charges
    init(e){ e.home = x0() + 250; e.x = x0() + VW + 30; e.y = 146; e.w = 96; e.h = 46; e.face = -1; e.fa = 2; e.fb = 3.4; e.ct = 6; e.vx = 0; },
    step(e, dt){
      const X0 = x0();
      e.v[1] = Math.max(0, e.v[1] - dt * 4);
      if(e.st === 'intro'){ e.vx = -60; if(e.x <= e.home){ e.st = 'fight'; e.t = 0; e.vx = 0; } }
      else if(e.st === 'fight'){
        e.vx = Math.sin(e.t * 0.8) * 22;
        e.fa -= dt * fireRate(); e.fb -= dt * fireRate(); e.ct -= dt;
        if(e.fa <= 0 && e.ph[1] > 0){ e.fa = 2.4; lob(e.x + 22, e.y + 8, 'bomb', 1.3); e.v[1] = 1; }
        if(e.fb <= 0){ e.fb = 3.8; eshot('ice', e.x - 4, 186, -120, 0, { r: 6 }); sfx('crumble'); }
        if(e.ct <= 0 && e.ph[0] < e.pm[0] * 0.7){ e.st = 'rev'; e.t = 0; say('It’s going to charge! Jump onto the ledge!'); }
      } else if(e.st === 'rev'){ e.vx = 12; e.v[2] = 1; if(Math.random() < 0.3) fx('puff', e.x + 92, e.y + 8, 'rgba(120,130,150,.6)'); if(e.t > 1.1){ e.st = 'charge'; e.t = 0; sfx('boomL'); } }
      else if(e.st === 'charge'){ e.vx = -230; if(e.x <= X0 + 36){ e.st = 'back'; e.t = 0; fx('shake', 0.5); sfx('crush'); } }
      else if(e.st === 'back'){ e.vx = 90; e.v[2] = 0; if(e.x >= e.home){ e.st = 'fight'; e.t = 0; e.ct = 6.5; } }
      e.x += e.vx * dt;
      e.v[0] += Math.abs(e.vx) * dt;
    },
    zones(e){
      const z = [{ x: e.x + 43, y: e.y - 18, w: 36, h: 32, part: 0 }];
      if(e.ph[1] > 0) z.push({ x: e.x + 18, y: e.y + 4, w: 24, h: 12, part: 1 });
      z.push({ x: e.x - 6, y: e.y + 20, w: 22, h: 26, part: -1, contact: true }, { x: e.x + 12, y: e.y + 16, w: 84, h: 30, part: -1, contact: true });
      return z;
    },
    open(){ return true; },
    won(e){ return e.ph[0] <= 0; }
  },
  { // MEGA CLAW: a ceiling crane. It slams the claw down; the core glows open while it rests
    init(e){ e.x = x0() + 190; e.y = 34; e.w = 44; e.h = 28; e.bt = 1.2; e.st = 'intro'; e.v[0] = 0; },
    step(e, dt){
      const X0 = x0(), floorGap = 192 - (e.y + 30);
      if(e.st === 'intro'){ if(e.t > 1.2){ e.st = 'track'; e.t = 0; } return; }
      const P = targetPlayer(e.x, 150);
      if(e.st === 'track'){
        if(P) e.x += clamp(P.x + P.w / 2 - e.x, -1, 1) * Math.min(95, Math.abs(P.x + P.w / 2 - e.x) * 4) * dt;
        e.x = clamp(e.x, X0 + 36, X0 + VW - 36);
        e.v[0] = 6 + Math.sin(e.t * 4) * 3; e.v[1] = 0.3;
        e.bt -= dt * fireRate();
        if(e.bt <= 0 && (e.ph[1] > 0 || e.ph[2] > 0)){ e.bt = e.ph[1] > 0 && e.ph[2] > 0 ? 1.3 : 2; const side = e.ph[1] > 0 && (e.ph[2] <= 0 || Math.random() < 0.5) ? -1 : 1; eshot('scrap', e.x + side * 18, e.y + 24, side * 40, 0, { g: 420, r: 4, raw: true }); sfx('lob'); }
        if(e.t > 2.3){ e.st = 'aim'; e.t = 0; }
      } else if(e.st === 'aim'){ e.v[1] = 1; if(e.t > 0.55){ e.st = 'slam'; e.t = 0; } }
      else if(e.st === 'slam'){ e.v[0] = Math.min(floorGap - 2, e.v[0] + 560 * dt); if(e.v[0] >= floorGap - 2){ e.st = 'rest'; e.t = 0; sfx('crush'); fx('shake', 0.45); fx('dust', e.x, 190); } }
      else if(e.st === 'rest'){ e.v[2] = Math.min(1, e.v[2] + dt * 4); e.v[1] = 0.1; if(e.t > 1.9){ e.st = 'lift'; e.t = 0; if(e.ph[0] < e.pm[0] * 0.5){ for(let i = 0; i < 6; i++){ const a = Math.PI * (0.15 + i * 0.14); eshot('orb', e.x, e.y + 26, Math.cos(a) * 100, Math.sin(a) * 100); } sfx('eshot'); } } }
      else if(e.st === 'lift'){ e.v[2] = Math.max(0, e.v[2] - dt * 3); e.v[0] = Math.max(6, e.v[0] - 170 * dt); if(e.v[0] <= 6){ e.st = 'track'; e.t = 0; } }
    },
    zones(e){
      const cy = e.y + 30 + e.v[0], z = [{ x: e.x - 22, y: e.y + 14, w: 44, h: 14, part: 0 }];
      if(e.ph[1] > 0) z.push({ x: e.x - 26, y: e.y + 6, w: 12, h: 12, part: 1 });
      if(e.ph[2] > 0) z.push({ x: e.x + 14, y: e.y + 6, w: 12, h: 12, part: 2 });
      z.push({ x: e.x - 22, y: e.y, w: 44, h: 28, part: -1 }, { x: e.x - 15, y: cy - 22, w: 30, h: 22, part: -1, contact: true });
      return z;
    },
    open(e, i){ return i > 0 || e.v[2] > 0.5; },
    won(e){ return e.ph[0] <= 0; }
  },
  { // THUNDERHULL: a sky gunship with two turrets and an engine core
    init(e){ e.sx = VW + 20; e.x = G.cam.x + e.sx; e.y = 60; e.w = 110; e.h = 74; e.fa = 1.5; e.fb = 3; e.fc = 3; e.burst = 0; },
    step(e, dt){
      if(e.st === 'intro'){ e.sx -= 70 * dt; if(e.sx <= VW - 128){ e.st = 'fight'; e.t = 0; } }
      else { e.y = 64 + Math.sin(e.t * 0.8) * 46; }
      e.x = G.cam.x + e.sx;
      e.v[0] += dt * 12;
      if(e.st !== 'fight') return;
      e.fa -= dt * fireRate();
      if(e.fa <= 0){
        e.burst++; e.fa = e.burst % 2 ? 0.25 : 1.7;
        for(const i of [0, 1]) if(e.ph[i] > 0){ const tx = e.x + 14, ty = e.y + (i ? 64 : 9); const [vx, vy] = aimAt(tx, ty, 115); eshot('orb', tx, ty, vx + G.flySpeed, vy); }
        sfx('eshot');
      }
      e.fb -= dt * fireRate();
      if(e.fb <= 0){ e.fb = 3.6; mkEnt('missile', e.x + 40, e.y + 36, { sub: 'homing', vx: -90, vy: 0, hp: 1, max: 1 }); sfx('seek'); }
      if(e.ph[2] < e.pm[2] * 0.5){ e.fc -= dt * fireRate(); if(e.fc <= 0){ e.fc = 2.6; for(let i = 0; i < 5; i++){ const a = Math.PI + (i - 2) * 0.28; eshot('orb', e.x + 44, e.y + 37, Math.cos(a) * 110 + G.flySpeed, Math.sin(a) * 110); } } }
    },
    zones(e){
      const z = [];
      if(e.ph[0] > 0) z.push({ x: e.x + 8, y: e.y + 2, w: 24, h: 14, part: 0, contact: true });
      if(e.ph[1] > 0) z.push({ x: e.x + 8, y: e.y + 58, w: 24, h: 14, part: 1, contact: true });
      z.push({ x: e.x + 42, y: e.y + 27, w: 28, h: 20, part: 2 }, { x: e.x + 28, y: e.y + 12, w: 82, h: 15, part: -1, contact: true },
        { x: e.x + 28, y: e.y + 47, w: 82, h: 15, part: -1, contact: true }, { x: e.x + 70, y: e.y + 27, w: 40, h: 20, part: -1, contact: true });
      return z;
    },
    open(){ return true; },
    won(e){ return e.ph[2] <= 0; }
  },
  { // GENERAL RUSTBOLT: giant fists slam down, eye lasers sweep, then his chest core opens
    init(e){ const X0 = x0(); e.x = X0 + 236; e.y = 150; e.w = 128; e.h = 120; e.fs = 0; e.ft = 2; e.lt = 5; e.st = 'intro'; e.dt2 = 7; e.spin = 0; e.burstT = 0;
      e.fist = [{ st: 'idle', t: 0 }, { st: 'idle', t: 0 }];
      e.v[0] = X0 + 214; e.v[1] = 120; e.v[2] = X0 + 350; e.v[3] = 120; },
    step(e, dt){
      const X0 = x0(), rest = [[X0 + 214, 118], [X0 + 352, 118]];
      if(e.st === 'intro'){ e.y = 150 - Math.min(1, e.t / 2) * 126; if(e.t > 2.1){ e.st = 'fight'; e.t = 0; } }
      // fists
      for(let i = 0; i < 2; i++){
        const f = e.fist[i], xi = i * 2, yi = xi + 1;
        if(e.ph[i] <= 0){ e.v[yi] = Math.min(260, e.v[yi] + 200 * dt); continue; }
        f.t += dt;
        const P = targetPlayer(X0 + VW / 2, 180);
        if(f.st === 'idle'){
          e.v[xi] += (rest[i][0] - e.v[xi]) * Math.min(1, dt * 4); e.v[yi] = rest[i][1] + Math.sin(G.lvT * 2 + i) * 4;
        } else if(f.st === 'lift'){
          const tx = P ? clamp(P.x + P.w / 2, X0 + 24, X0 + VW - 40) : X0 + 150;
          e.v[xi] += (tx - e.v[xi]) * Math.min(1, dt * 3.5); e.v[yi] += (44 - e.v[yi]) * Math.min(1, dt * 4);
          if(f.t > 1.0){ f.st = 'warn'; f.t = 0; }
        } else if(f.st === 'warn'){ if(f.t > 0.55 / Math.max(0.7, D().bspeed)){ f.st = 'slam'; f.t = 0; } }
        else if(f.st === 'slam'){ e.v[yi] = Math.min(181, e.v[yi] + 640 * dt); if(e.v[yi] >= 181){ f.st = 'stuck'; f.t = 0; sfx('stomp'); fx('shake', 0.5); fx('dust', e.v[xi], 192); } }
        else if(f.st === 'stuck'){ if(f.t > 1.2){ f.st = 'back'; f.t = 0; } }
        else if(f.st === 'back'){ e.v[xi] += (rest[i][0] - e.v[xi]) * Math.min(1, dt * 3); e.v[yi] += (rest[i][1] - e.v[yi]) * Math.min(1, dt * 3); if(f.t > 0.9){ f.st = 'idle'; f.t = 0; } }
      }
      if(e.st === 'intro') return;
      const fistsAlive = e.ph[0] > 0 || e.ph[1] > 0;
      e.ft -= dt * fireRate();
      if(e.ft <= 0 && fistsAlive){
        const pick = e.ph[e.fs] > 0 ? e.fs : 1 - e.fs;
        if(e.fist[pick].st === 'idle'){ e.fist[pick].st = 'lift'; e.fist[pick].t = 0; }
        e.fs = 1 - e.fs; e.ft = e.ph[0] > 0 && e.ph[1] > 0 ? 2.1 : 1.6;
      }
      // eye laser sweep: low beam (jump it) or high beam (crouch under it)
      e.lt -= dt;
      if(e.v[5] === 0 && e.lt <= 0){ e.v[5] = 1; e.v[4] = e.hi ? 172 : 184; e.hi = !e.hi; e.lw = 0; sfx('laserWarn'); }
      if(e.v[5] === 1){ e.lw += dt; if(e.lw > (D().bspeed < 0.8 ? 1.3 : 0.9)){ e.v[5] = 2; e.lw = 0; sfx('laser'); fx('shake', 0.25); } }
      else if(e.v[5] === 2){
        e.lw += dt;
        for(const p of G.players){ if(!active(p)) continue; const b = pHurtBox(p); if(b.x < e.x + 40 && b.y < e.v[4] + 3 && b.y + b.h > e.v[4] - 3) hurt(p, 'laser'); }
        if(e.lw > 0.5){ e.v[5] = 0; e.lt = fistsAlive ? 6.5 : 5; }
      }
      // phase two: the chest core opens and spins out bullets
      if(!fistsAlive){
        if(e.v[6] < 1){ if(e.v[6] === 0) say('Rustbolt’s chest core is open! Blast it!'); e.v[6] = Math.min(1, e.v[6] + dt * 1.5); }
        e.burstT += dt;
        const cyc = e.burstT % 3.6;
        if(cyc < 2.2){ e.spin += dt; if((e.sT = (e.sT || 0) - dt * fireRate()) <= 0){ e.sT = 0.16; for(let k = 0; k < 2; k++){ const a = e.spin * 2.4 + k * Math.PI; eshot('orb', e.x + 64, e.y + 69, Math.cos(a) * 85, Math.sin(a) * 85); } sfx('eshot'); } }
        e.dt2 -= dt;
        if(e.dt2 <= 0){ e.dt2 = 9; if(G.ents.filter(q => q.k === 'drone' && !q.dead).length < 2){ mkEnt('drone', e.x + 10, 60, { by: 60, awake: true }); } }
      }
      e.v[7] = e.v[5] === 1 ? 1 : e.v[5] === 2 ? 2 : 0;
    },
    zones(e){
      const z = [];
      for(let i = 0; i < 2; i++) if(e.ph[i] > 0) z.push({ x: e.v[i * 2] - 13, y: e.v[i * 2 + 1] - 11, w: 26, h: 22, part: i, contact: true });
      z.push({ x: e.x + 46, y: e.y + 54, w: 36, h: 30, part: 2 }, { x: e.x + 12, y: e.y - 10, w: 104, h: 62, part: -1, contact: true },
        { x: e.x + 84, y: e.y + 52, w: 32, h: 68, part: -1, contact: true }, { x: e.x + 12, y: e.y + 88, w: 34, h: 32, part: -1, contact: true });
      return z;
    },
    open(e, i){ return i < 2 || e.v[6] > 0.6; },
    won(e){ return e.ph[2] <= 0; }
  }
];
function stepBoss(e, dt){
  for(let i = 0; i < e.phf.length; i++) if(e.phf[i] > 0) e.phf[i] -= dt;
  if(e.st === 'defeat'){
    if(Math.floor(e.t * 7) !== Math.floor((e.t - dt) * 7)){
      const z = BOSS[e.bw].zones(e), r = z[Math.floor(Math.random() * z.length)];
      fx('boom', r.x + Math.random() * r.w, r.y + Math.random() * r.h, 2); sfx('boomL');
    }
    if(e.bw === 5 || e.bw === 1) e.y += (e.bw === 5 ? 30 : -20) * dt;
    if(e.t > 3){ e.dead = 1; fx('boom', e.x + e.w / 2, e.y + e.h / 2, 3); fx('flash', 0.6); fx('shake', 0.8); startClear(); }
    return;
  }
  BOSS[e.bw].step(e, dt);
}
function partOpen(e, i){ return BOSS[e.bw].open(e, i); }
function damagePart(e, i, dmg, p){
  if(e.st === 'defeat' || e.st === 'intro' || e.ph[i] <= 0) return;
  e.ph[i] = Math.max(0, e.ph[i] - dmg); e.phf[i] = 0.08; sfx('bossHit');
  e.hp = e.ph.reduce((a, b) => a + b, 0);
  if(e.ph[i] <= 0){
    const z = BOSS[e.bw].zones(e).find(q => q.part === i) || { x: e.x, y: e.y, w: 20, h: 20 };
    sfx('partDown'); fx('boom', z.x + z.w / 2, z.y + z.h / 2, 2); fx('shake', 0.4); addScore(3000, z.x + z.w / 2, z.y);
    if(p) p.kills++;
  }
  if(BOSS[e.bw].won(e)){
    e.st = 'defeat'; e.t = 0; G.eshots = [];
    for(const q of G.ents) if(q !== e && FOES.has(q.k) && q.k !== 'crate') { q.dead = 1; fx('boom', q.x + q.w / 2, q.y + q.h / 2, 1); }
    addScore(10000, e.x + e.w / 2, e.y + 10, '#ffd45e'); sfx('boomL'); fx('flash', 0.4);
  }
}
function shotBoss(s, e, owner){
  if(e.st === 'defeat') return false;
  const zs = BOSS[e.bw].zones(e).filter(z => !(s.x + s.r < z.x || s.x - s.r > z.x + z.w || s.y + s.r < z.y || s.y - s.r > z.y + z.h));
  zs.sort((a, b) => (b.part >= 0 && e.ph[b.part] > 0 && partOpen(e, b.part) ? 1 : 0) - (a.part >= 0 && e.ph[a.part] > 0 && partOpen(e, a.part) ? 1 : 0));
  for(const z of zs){
    if(s.k === 'beam'){ const key = 'b' + z.part; if(s.hit.includes(key)) return false; s.hit.push(key); }
    if(z.part >= 0 && e.ph[z.part] > 0 && partOpen(e, z.part) && e.st !== 'intro'){
      damagePart(e, z.part, s.dmg, owner); if(owner) owner.hits++;
      fx('spark', s.x, s.y, owner ? owner.color : '#fff');
      if(s.k !== 'beam') s.dead = 1;
    } else { fx('clank', s.x, s.y); sfx('clank'); s.dead = 1; }
    return true;
  }
  return false;
}
function bossContact(e, p, hb){
  if(e.st === 'defeat') return;
  for(const z of BOSS[e.bw].zones(e)) if(z.contact && overlap(hb, z)){ hurt(p, 'touch'); return; }
}
function bossStart(){
  if(G.locked) return;
  G.locked = true; G.state = 'warn'; G.stateT = 0;
  const bw = G.def.boss;
  for(const q of G.ents) if(q.k === 'spawner' || q.k === 'runner') q.dead = 1;
  const e = makeBoss(bw);
  G.check = Object.assign({}, G.check || {}, { boss: true });
  sfx('siren'); say(BOSS_LINES[bw]);
  return e;
}

/* ---------- Camera: one screen for everyone, it only moves forward ---------- */
function camera(dt, snap){
  if(G.kind === 'fly'){ G.cam.y = 0; return; }
  let list = G.players.filter(p => active(p) && !(p.dropIn > 0));
  if(!list.length) list = G.players.filter(active);
  if(G.kind === 'side'){
    G.cam.y = G.H * T - VH;
    const maxX = Math.max(0, G.W * T - VW);
    if(G.locked && G.arena){ G.cam.x += (G.arena.x0 - G.cam.x) * Math.min(1, dt * 6); if(Math.abs(G.arena.x0 - G.cam.x) < 0.5 || snap) G.cam.x = G.arena.x0; return; }
    if(!list.length) return;
    let lead = -1e9, trail = 1e9, sum = 0;
    for(const p of list){ const cx = p.x + p.w / 2; lead = Math.max(lead, cx); trail = Math.min(trail, cx); sum += cx; }
    const avg = sum / list.length;
    let target = list.length === 1 ? avg - VW * 0.38 : avg - VW * 0.5;
    target = Math.min(target, trail - 30);
    target = clamp(target, 0, maxX);
    if(snap) G.cam.x = target;
    else if(target > G.cam.x) G.cam.x += (target - G.cam.x) * Math.min(1, dt * 5);
    if(G.arena && G.cam.x > G.arena.x0) G.cam.x = G.arena.x0;
  } else {
    G.cam.x = 0;
    if(G.locked){ G.cam.y += (0 - G.cam.y) * Math.min(1, dt * 4); if(G.cam.y < 0.5 || snap) G.cam.y = 0; return; }
    if(!list.length) return;
    let top = 1e9, bottom = -1e9;
    for(const p of list){ top = Math.min(top, p.y); bottom = Math.max(bottom, p.y + p.h); }
    let target = top - VH * 0.38;
    target = Math.max(target, bottom - VH + 34);
    target = clamp(target, 0, G.H * T - VH);
    if(snap) G.cam.y = target;
    else if(target < G.cam.y) G.cam.y += (target - G.cam.y) * Math.min(1, dt * 5);
  }
}
function clampPlayers(){
  if(G.kind === 'fly') return;
  const boss = G.ents.find(e => e.k === 'boss' && !e.dead);
  const wall = boss && BOSS[boss.bw].wall && boss.st !== 'defeat' ? BOSS[boss.bw].wall(boss) : 1e9;
  for(const p of G.players){
    if(p.out || p.sos) continue;
    if(G.kind === 'side'){
      const minX = G.cam.x + 2, maxX = Math.min(G.cam.x + VW - p.w - 2, wall - p.w);
      if(p.x < minX){ p.x = minX; if(p.vx < 0) p.vx = 0; let n = 0; while(rectSolid(p) && n++ < 10) p.y -= 4; }
      if(p.x > maxX){ p.x = maxX; if(p.vx > 0) p.vx = 0; }
    } else {
      if(p.y < G.cam.y - 24){ p.y = G.cam.y - 24; if(p.vy < 0) p.vy = 0; }
    }
  }
}

/* ---------- Level flow ---------- */
const startLives = n => hasLives() ? D().lives + (n - 1) * D().extra : Infinity;
function loadLevel(ix, fromCheck){
  const L = buildLevel(ix);
  G.lv = ix; G.def = L.def; G.kind = L.def.kind; G.W = L.W; G.H = L.H; G.map = L.map.slice(); G.mods = [];
  G.crumbles = new Map(); G.wallHp = new Map(); G.ents = []; G.shots = []; G.eshots = []; nextEnt = 1;
  G.arena = L.arena ? Object.assign({}, L.arena) : null; G.locked = false; G.bossSpot = null; G.clearT = -1; G.overT = 0;
  G.combo = 0; G.comboT = 0; G.runnerT = 2.5; G.skyT = 0; G.waveIx = 0; G.skyEnd = false; G.flySpeed = 62; G.shake = 0; G.flash = 0;
  if(!fromCheck){ G.check = null; G.lvT = 0; G.levelScore = G.score; G.gotGear = false; for(const p of G.players){ p.kills = 0; p.shots = 0; p.hits = 0; p.downs = 0; p.pods = 0; } }
  for(const e of L.ents) spawnFromMap(e);
  G.loadN++; parts = [];
  if(G.kind === 'fly'){
    G.cam.x = 0; G.cam.y = 0;
    if(fromCheck && G.check){
      if(G.check.boss){ G.waveIx = SKY_WAVES.length; G.skyEnd = true; G.skyT = 80; }
      else if(G.check.sky){ G.skyT = G.check.sky; G.waveIx = SKY_WAVES.findIndex(w => w[0] >= G.check.sky); if(G.waveIx < 0) G.waveIx = SKY_WAVES.length; }
    }
    placePlayers(0, 0);
    return;
  }
  let sx = L.start.tx * T + 2, sy = (L.start.ty + 1) * T;
  if(fromCheck && G.check){
    if(G.check.boss){ if(G.kind === 'side'){ sx = G.arena.x0 + 36; sy = 12 * T; } else { sx = 5 * T; sy = 13 * T; } }
    else if(G.check.x !== undefined){ sx = G.check.x; if(G.check.y !== undefined) sy = G.check.y; }
  }
  if(G.kind === 'side'){ G.cam.y = G.H * T - VH; G.cam.x = clamp(sx - 70, 0, Math.max(0, G.W * T - VW)); }
  else { G.cam.x = 0; G.cam.y = clamp(sy - VH + 44, 0, G.H * T - VH); }
  placePlayers(sx, sy);
  if(fromCheck) for(const e of G.ents) if(G.kind === 'side' ? e.x < G.cam.x - 20 : e.y > G.cam.y + VH + 20) if(e.k !== 'check') e.dead = 1;
  G.ents = G.ents.filter(e => !e.dead);
  camera(0, true);
}
function startIntro(short){
  A.Menu.close();
  G.state = 'intro'; G.stateT = 0; G.introLen = short ? 1.6 : 2.8;
  sfx('stageStart'); A.keepAwake();
}
function newGame(players){
  G.demo = false;
  G.roster = players.map(p => ({ slot: p.slot, source: p.source, name: p.name, color: p.color }));
  G.players = G.roster.map(r => makeHero(Object.assign({}, r)));
  G.score = 0; G.lives = startLives(G.players.length); G.nextLife = 20000; G.continues = 0;
  loadLevel(G.startLv); startIntro();
}
function startDemo(){
  G.demo = true;
  const pick = [0, 2, 3, 5].filter(i => i <= Math.max(0, G.unlocked));
  const ix = pick[Math.floor(Math.random() * pick.length)];
  G.players = [makeHero({ slot: 0, bot: true, name: 'Blaze', color: A.PLAYER_COLORS[0] }), makeHero({ slot: 1, bot: true, name: 'Echo', color: A.PLAYER_COLORS[1] })];
  G.lives = Infinity;
  loadLevel(ix); G.demoT = 0;
}
function dropIn(){
  if(G.demo || G.players.length >= 4) return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.players.some(p => p.source === s.id)) continue;
    const used = G.players.map(p => p.slot);
    const slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.players.map(p => p.name));
    const p = makeHero({ slot, source: s.id, color: A.PLAYER_COLORS[slot], name });
    G.players.push(p); G.players.sort((a, b) => a.slot - b.slot);
    G.roster = G.players.map(q => ({ slot: q.slot, source: q.source, name: q.name, color: q.color }));
    respawn(p);
    sfx('join'); fx('text', p.x + 5, G.cam.y + 40, name.toUpperCase() + ' JOINED!', p.color);
    return;
  }
}
function flowChecks(dt){
  if(hasLives() && G.lives > 0) for(const p of G.players) if(p.sos || p.out > 100){ G.lives--; p.sos = false; p.out = 0.6; if(G.lives <= 0) break; }
  const here = G.players.filter(p => !p.away);
  const hopeless = here.length > 0 && here.every(p => p.sos || p.out > 100);
  if(hopeless && G.state !== 'clear'){ G.overT += dt; if(G.overT > 1.6) gameOver(); }
  else G.overT = 0;
}
function stepCrumbles(dt){
  for(const [i, t] of G.crumbles){
    const nt = t + dt; G.crumbles.set(i, nt);
    if(nt > 0.32){
      G.crumbles.delete(i);
      const tx = i % G.W, ty = Math.floor(i / G.W);
      setTile(tx, ty, '.'); fx('chunks', tx * T + 8, ty * T + 6, '#a8703c'); sfx('crumble');
      if(Math.random() < 0.5) fx('boom', tx * T + 8, ty * T + 6, 1);
    }
  }
}
function startClear(){
  if(G.state === 'clear') return;
  G.state = 'clear'; G.stateT = 0; sfx('fanfare'); G.eshots = [];
  for(const p of G.players){ if(p.sos){ p.sos = false; resetHero(p); } if(p.out > 0){ p.out = 0; respawn(p); p.dropIn = 0; } }
  G.unlocked = Math.max(G.unlocked, Math.min(STAGES.length - 1, G.lv + 1)); A.Store.set('strike.unlocked', G.unlocked);
}
function rankOf(p){
  const acc = p.shots ? p.hits / p.shots : 0;
  if(p.downs === 0 && acc >= 0.45) return 'S';
  if(p.downs <= 1 && acc >= 0.3) return 'A';
  if(p.downs <= 3) return 'B';
  return 'C';
}
function results(){
  G.state = 'results'; G.stateT = 0;
  const key = 'strike.best.' + G.lv + '.' + G.diff, best = A.Store.get(key, 0);
  let rec = false;
  if(!best || G.lvT < best){ A.Store.set(key, r1(G.lvT)); rec = true; }
  const def = G.def, last = G.lv >= STAGES.length - 1;
  const ps = G.players;
  const top = (f, min) => { let b = null; for(const p of ps) if(f(p) > (min || 0) && (!b || f(p) > f(b))) b = p; return b; };
  const awards = [];
  const bb = top(p => p.kills); if(bb && ps.length > 1) awards.push('Bot Buster: <b style="color:' + bb.color + '">' + A.esc(bb.name) + '</b>');
  const sh = top(p => p.shots >= 20 ? p.hits / p.shots : 0); if(sh) awards.push('Sharpshooter: <b style="color:' + sh.color + '">' + A.esc(sh.name) + '</b>');
  const pp = top(p => p.pods); if(pp) awards.push('Pod Popper: <b style="color:' + pp.color + '">' + A.esc(pp.name) + '</b>');
  const un = ps.filter(p => p.downs === 0); if(un.length) awards.push('Untouchable: ' + un.map(p => '<b style="color:' + p.color + '">' + A.esc(p.name) + '</b>').join(', '));
  const rows = ps.map(p => '<b style="color:' + p.color + '">' + A.esc(p.name) + '</b> · rank <b>' + rankOf(p) + '</b> · ' + p.kills + (p.kills === 1 ? ' bot' : ' bots') +
    ' · ' + Math.round(p.shots ? p.hits / p.shots * 100 : 0) + '% hits' + (p.downs ? ' · warped out ' + p.downs + '×' : '')).join('<br>');
  const items = [];
  if(last) items.push({ label: 'See the ending', select: ending });
  else items.push({ label: 'Next: ' + STAGES[G.lv + 1].code + ' ' + STAGES[G.lv + 1].name, select: () => nextLevel() });
  items.push({ label: 'Play it again', select: () => { G.score = G.levelScore; loadLevel(G.lv); startIntro(); } });
  items.push({ label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) });
  if(!hosting()) items.push({ label: 'Quit to title', select: toTitle });
  A.Menu.open({ center: true, shared: true, kicker: 'Stage ' + def.code + ' · ' + def.name + ' · ' + D().label, title: ['The gate is smashed!', 'Boulder Bot is gravel!', 'The Snowplow is scrap!', 'Mega Claw is scrap!', 'Thunderhull is down!', 'Rustbolt is scrap!'][def.boss],
    text: rows + (awards.length ? '<br>' + awards.join(' · ') : '') + (G.gotGear ? '<br><b style="color:#ffd45e">Gold gear found!</b>' : '') +
      '<br><br>Team score <b>' + G.score.toLocaleString() + '</b> · time <b>' + fmt(G.lvT) + '</b>' + (rec ? ' · <b>new best!</b>' : best ? ' · best ' + fmt(best) : ''),
    items });
}
function nextLevel(){ G.startLv = G.lv + 1; loadLevel(G.lv + 1); startIntro(); }
function ending(){
  A.Menu.close();
  G.state = 'ending'; G.stateT = 0; A.Store.set('strike.beaten', true);
  G.kind = 'ending'; G.cam.x = 0; G.cam.y = 0; G.ents = []; G.shots = []; G.eshots = [];
  G.players.forEach((p, i) => { resetHero(p); const n = G.players.length; p.x = VW / 2 + (i - (n - 1) / 2) * 32 + (i < n / 2 ? -34 : 34) - 5; p.y = 170 - STAND_H; p.onGround = true; p.face = 1; });
}
function endingMenu(){
  A.Menu.open({ center: true, shared: true, kicker: 'Strike Force', title: 'The Sky Crystal is home!',
    text: 'General Rustbolt’s Scrap Army is beaten, and every bot you stopped is being recycled into playground rides. Great teamwork, Strike Force!<br>Team score <b>' + G.score.toLocaleString() + '</b>' +
      ' · gold gears <b>' + G.gears.length + ' / 6</b>' + (G.continues ? ' · continues ' + G.continues : ''),
    items: [
      { label: 'Play again from stage 1', select: () => { G.startLv = 0; newGame(G.roster); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function gameOver(){
  G.state = 'gameover'; G.stateT = 0; sfx('gameOver');
  const cp = G.check ? (G.check.boss ? ' (right at the boss)' : ' (from the checkpoint)') : '';
  A.Menu.open({ center: true, shared: true, kicker: 'Stage ' + G.def.code + ' · ' + G.def.name, title: 'Out of lives!',
    text: 'No problem: jump back in with fresh lives' + cp + '. Your score stays.',
    items: [
      { label: 'Continue', select: () => { G.continues++; G.lives = startLives(G.players.length); for(const p of G.players){ p.out = 0; p.sos = false; } loadLevel(G.lv, true); startIntro(true); } },
      { label: 'Restart the stage', select: () => { G.lives = startLives(G.players.length); G.score = G.levelScore; loadLevel(G.lv); startIntro(); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  G.lvT += dt;
  if(G.comboT > 0){ G.comboT -= dt; if(G.comboT <= 0) G.combo = 0; }
  if(G.kind === 'fly'){ G.cam.x += G.flySpeed * dt; stepSky(dt); }
  for(const p of G.players) stepPlayer(p, dt);
  for(const e of G.ents) if(!e.dead) stepEnt(e, dt);
  stepShots(dt); stepEShots(dt);
  interact();
  stepCrumbles(dt);
  if(G.kind === 'side' && !G.locked && G.def.runners){
    G.runnerT -= dt;
    if(G.runnerT <= 0){ G.runnerT = G.def.runners / D().runners * (0.7 + Math.random() * 0.6); spawnRunner(); }
  }
  camera(dt); clampPlayers();
  if(!G.locked && !G.demo){
    if(G.kind === 'side' && G.arena && G.cam.x >= G.arena.x0 - 0.5) bossStart();
    else if(G.kind === 'up' && G.players.some(p => active(p) && p.onGround && p.y + p.h <= 13 * T + 1)){
      bossStart();
      for(const p of G.players) if(active(p) && p.y > 13 * T){ fx('warp', p.x + 5, p.y + 10, p.color); p.x = 40 + p.slot * 20; p.y = 13 * T - p.h; p.vy = 0; p.inv = 1.5; fx('warp', p.x + 5, p.y + 10, p.color); }
    }
  }
  G.ents = G.ents.filter(e => !e.dead);
  if(G.demo){
    G.demoT += dt;
    const nearEnd = (G.kind === 'side' && G.arena && G.cam.x > G.arena.x0 - 260) || (G.kind === 'up' && G.cam.y < 260);
    if(G.demoT > 50 || nearEnd) startDemo();
  }
}

/* A little autopilot for the title-screen demo (and the test harness). */
function botControls(p){
  const c = { left: false, right: false, up: false, down: false, fire: true, upP: false, downP: false, fireP: false };
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  const boss = G.ents.find(e => e.k === 'boss' && e.st !== 'defeat');
  let tgt = null;
  if(boss){
    const zs = BOSS[boss.bw].zones(boss).filter(z => z.part >= 0 && boss.ph[z.part] > 0);
    const open = zs.filter(z => partOpen(boss, z.part));
    const win = [2, 2, 0, 0, 2, 2][boss.bw];
    const z = (open.length ? open : zs).sort((a, b) => ((a.part === win ? 0 : 1) - (b.part === win ? 0 : 1)) || (boss.ph[a.part] - boss.ph[b.part]))[0];
    if(z) tgt = { x: z.x + z.w / 2, y: z.y + z.h / 2 };
  }
  if(!tgt){ const f = nearestFoe(cx, cy, 250); if(f) tgt = { x: f.x + f.w / 2, y: f.y + f.h / 2 }; }
  if(G.kind === 'fly'){
    const ty = tgt ? tgt.y : VH / 2;
    const danger = G.eshots.find(s => Math.abs(s.x - cx) < 50 && Math.abs(s.y - cy) < 16);
    if(danger){ if(danger.y > cy) c.up = true; else c.down = true; }
    else if(ty < cy - 4) c.up = true; else if(ty > cy + 4) c.down = true;
    const wantX = G.cam.x + 60 + p.slot * 18;
    if(p.x < wantX - 6) c.right = true; else if(p.x > wantX + 6) c.left = true;
    return c;
  }
  const feet = p.y + p.h, fr = Math.floor((feet - 1) / T);
  let moveDir = 1;
  if(G.kind === 'up'){
    // climb: find the nearest ledge up to 3 rows above and get under/next to it
    let goal = p.onGround ? null : p.botGoal;
    if(!G.locked && !goal){
      // the ledge we stand on, then the closest ledge above that a jump can reach from it
      const fr0 = Math.floor((feet + 1) / T), ctx = Math.floor(cx / T);
      let a = ctx, b = ctx; while(a > 1 && standable(tileAt(a - 1, fr0))) a--; while(b < G.W - 2 && standable(tileAt(b + 1, fr0))) b++;
      for(let dr = 3; dr >= 2 && !goal; dr--){
        const r = Math.floor(feet / T) - dr; let best = null;
        for(let tx = 1; tx < G.W - 1; tx++) if(tileAt(tx, r) === '=' || (isSolid(tileAt(tx, r)) && !isSolid(tileAt(tx, r - 1)))){
          const gap = Math.max(0, tx - b - 1, a - tx - 1); if(gap > 2) continue;
          const d = Math.abs(tx * T + 8 - cx); if(!best || d < best.d) best = { tx, d, r };
        }
        if(best) goal = best;
      }
    } else if(G.locked) goal = { tx: boss ? Math.floor((boss.x + boss.w / 2) / T) + (p.slot ? 3 : -3) : 11, d: 0, r: 7 };
    p.botGoal = goal;
    moveDir = 0;
    if(goal){
      const gx = goal.tx * T + 8;
      if(gx > cx + 5) moveDir = 1; else if(gx < cx - 5) moveDir = -1;
      if(p.onGround && Math.abs(gx - cx) < 26 && goal.r * T < feet - 8){ c.upP = true; p.botHold = 0.45; }
      const ahead = tileAt(Math.floor((cx + moveDir * (p.w / 2 + 3)) / T), Math.floor((feet + 2) / T));
      if(moveDir && p.onGround && !standable(ahead) && goal.r * T < feet - 8){ c.upP = true; p.botHold = 0.45; }
    }
    if(p.botHold > 0){ c.up = true; p.botHold -= 1 / 60; }
  } else {
    if(G.locked && G.arena){
      const X0 = G.arena.x0, home = X0 + 70 + p.slot * 22;
      moveDir = cx < home - 24 ? 1 : cx > home + 24 ? -1 : 0;
      if(!moveDir && tgt) p.face = tgt.x > cx ? 1 : -1;
      if(boss && boss.bw === 3){ const off = boss.x - cx; if(Math.abs(off) < 24) moveDir = off > 0 ? -1 : 1; else if(Math.abs(off) > 36) moveDir = off > 0 ? 1 : -1; else { moveDir = 0; p.face = off > 0 ? 1 : -1; } }
      if(boss && boss.bw === 2){ moveDir = cx < X0 + 70 ? 1 : cx > X0 + 100 ? -1 : 0; if(!moveDir) p.face = 1; if(p.onGround && feet > 150 && Math.abs(cx - X0 - 80) < 50){ c.upP = true; p.botHold = 0.45; } }
      if(boss && boss.bw === 2 && (boss.st === 'rev' || boss.st === 'charge')){ moveDir = cx < X0 + 64 ? 1 : cx > X0 + 90 ? -1 : 0; if(p.onGround && feet > 150){ c.upP = true; p.botHold = 0.5; } }
      if(boss && boss.bw === 5 && boss.v[5] >= 1){ if(boss.v[4] > 178){ if(p.onGround && boss.v[5] === 2 || (boss.lw > 0.6 && p.onGround)){ c.upP = true; p.botHold = 0.4; } } else if(p.onGround) { c.down = true; moveDir = 0; } }
    } else {
      const lookX = p.x + p.w + 6 + Math.max(0, p.vx) * 0.15, tx = Math.floor(lookX / T);
      const wall = isSolid(tileAt(tx, fr)) || isSolid(tileAt(tx, fr - 1));
      let gap = true; for(let r = fr + 1; r < G.H; r++){ if(standable(tileAt(tx, r))){ gap = false; break; } }
      const water = tileAt(tx, fr) === '~' && !p.swim;
      if(p.onGround && (wall || gap || (p.swim && isSolid(tileAt(tx, fr - 1))))){ c.upP = true; p.botHold = 0.45; }
      if(water && p.onGround && Math.random() < 0.02){ c.upP = true; p.botHold = 0.3; }
      if(p.x > (p.botBest || 0) + 3){ p.botBest = p.x; p.botStuck = 0; } else p.botStuck = (p.botStuck || 0) + 1 / 60;
      if(p.botStuck > 1.5 && p.onGround){ c.upP = true; p.botHold = 0.5; p.botStuck = 0.6; }
      // wait for a lagging partner a little
      const partner = G.players.find(q => q !== p && active(q));
      if(partner && cx - (partner.x + partner.w / 2) > 150) moveDir = 0;
    }
    if(p.botHold > 0){ c.up = true; p.botHold -= 1 / 60; }
  }
  // aim at the target: up / diagonal / forward / down
  if(tgt){
    const dx = tgt.x - cx, dy = tgt.y - (p.y + 9), a = Math.atan2(dy, dx);
    const oct = Math.round(a / (Math.PI / 4));   // -4..4
    const ax = [-1, -1, 0, 1, 1, 1, 0, -1, -1][oct + 4], ay = [0, -1, -1, -1, 0, 1, 1, 1, 0][oct + 4];
    if(G.kind === 'up' && !G.locked){ if(ay < 0 && (!ax || ax === moveDir)) c.up = true; }
    else if(Math.abs(dx) < 260){
      if(dy < -12 && dy > -46 && p.onGround && !p.botHold && Math.random() < 0.08){ c.upP = true; }
      else if(ay < 0){ c.up = true; if(ax){ moveDir = ax; } else moveDir = 0; }
      else if(ay > 0 && !p.onGround){ c.down = true; if(ax) moveDir = ax; }
      else if(ax && Math.sign(ax) !== Math.sign(moveDir || p.face) && Math.abs(dx) < 140){ moveDir = ax; }
      else if(ay > 0 && p.onGround && Math.abs(dy) < 14){ c.down = true; moveDir = 0; }
    }
  }
  if(G.locked && G.arena && G.kind === 'side'){ const home = G.arena.x0 + 70 + p.slot * 22; if(cx > home + 60) moveDir = -1; else if(cx < home - 40) moveDir = 1; }
  if(moveDir > 0) c.right = true; else if(moveDir < 0) c.left = true;
  if(p.mech && G.kind === 'side' && !G.locked) c.right = true;
  if(p.mech && G.locked && p.onGround) ejectMech(p);
  return c;
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
const stageLabel = ix => STAGES[ix].code + ' · ' + STAGES[ix].name;
function titleMenu(){
  G.state = 'title';
  A.Menu.open({ kicker: 'xRetro', title: 'STRIKE FORCE',
    text: 'General Rustbolt’s Scrap Army has stolen the <b>Sky Crystal</b>! Run, jump and blast your way through six stages of robots. <b>1–4 players</b> on one screen, or online.',
    items: [
      { label: 'Play', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Start at', value: () => stageLabel(G.startLv), change: d => { G.startLv = (G.startLv + d + G.unlocked + 1) % (G.unlocked + 1); A.Store.set('strike.start', G.startLv); } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('strike.diff', G.diff); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: controllerLine() });
}
function controllerLine(){
  const n = A.Input.pads().length;
  const unl = G.unlocked > 0 ? 'Unlocked up to stage ' + STAGES[G.unlocked].code + '. ' : '';
  const gears = G.gears.length ? 'Gold gears ' + G.gears.length + '/6. ' : '';
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + unl + gears + 'Kids mode: 5 hearts, no game over.';
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + 'Stage ' + stageLabel(G.startLv) + ' · ' + D().label,
    title: 'Who is on the team?',
    text: online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 players share one screen. More can drop in later by pressing FIRE.',
    min: 1, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => newGame(players),
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'play' && G.state !== 'intro' && G.state !== 'warn') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart stage', select: () => { G.score = G.levelScore; G.lives = startLives(G.players.length); loadLevel(G.lv); startIntro(); } }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: 'Stage ' + stageLabel(G.lv), title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'play'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'play'; }
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
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 players from any mix of devices.',
    items: [
      { label: 'Host a game', select: s => hostRoom(s) },
      { label: 'Join with a code', select: () => A.Online.codeEntry(code => joinRoom(code), () => onlineMenu(src, 1)) },
      { label: 'Your name', value: () => A.Names.device() || 'not set', change: () => A.Online.askName(() => onlineMenu(src, 2), () => onlineMenu(src, 2)) },
      { label: 'Back', select: titleMenu }
    ], back: titleMenu });
}
function withName(then, back){ const n = A.Names.device(); if(n) then(n); else A.Online.askName(then, back); }
function hostRoom(src){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Play online', title: 'Opening a room…', items: [] });
    Net.host('strike', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'strike', name, netHandlers).then(() => {
      G.net = 'guest'; A.Menu.close(); buf.clear(); A.Sound.play('online'); G.loadN = -1;
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
  A.Menu.open({ center: true, kicker: 'How to play', title: 'Strike Force training',
    text: '<b>Left / right</b> run · <b>UP</b> jumps (keep holding it to jump higher and aim up) · <b>DOWN</b> crouches, and aims down in the air · <b>FIRE</b> shoots, hold it for rapid fire. ' +
          'Hold two directions to aim diagonally (<b>Up + Right</b>).<br>' +
          'Shoot <b>supply pods</b> and crates: <b>Fan Shot</b>, <b>Beam</b> (goes through bots) and <b>Seekers</b>. Grab the same one again to power it up! ' +
          '<b>Shield</b>, <b>Nova Blast</b> (clears the screen) and <b>Repair</b> (+1 heart).<br>' +
          'Double-tap <b>DOWN</b> to drop through a ledge. In water, DOWN dives under bullets. Walk into a <b>Stomper mech</b> to ride it.<br>' +
          'Knocked out? You warp back in from the sky. No lives left but a friend is still going? Float as an <b>SOS</b> until they touch you. ' +
          'Kids mode: 5 hearts, slower bullets, pits bounce you back, no game over.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0, modsSent = 0, lastLoadSent = -1, snapN = 0, forceFull = false, lastSay = 0;
const KINDS = ['runner', 'gunner', 'turret', 'drone', 'mortar', 'hider', 'roller', 'rock', 'tank', 'jetbot', 'walker', 'crusher', 'crate', 'pod', 'item',
  'mech', 'check', 'gear', 'saucer', 'missile', 'barge', 'mine', 'boss'];
const KI = {}; KINDS.forEach((k, i) => { KI[k] = i; });
const SHOTK = ['bl', 'fan', 'beam', 'seek', 'mech'], ESHK = ['orb', 'bomb', 'shell', 'ice', 'scrap'];
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onPeer(){ forceFull = true; },
  onRename(id, name){ const p = G.players.find(x => x.source === id); if(p) p.name = name; const r = G.roster.find(x => x.source === id); if(r) r.name = name; },
  onMessage(m){ if(m.t === 's'){ receiveMeta(m); if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx); if(m.fx) m.fx.forEach(f => spawnFx(f[0], f[1], f[2], f[3] === null ? undefined : f[3], f[4] === null ? undefined : f[4])); buf.push(m); } }
};
function flatMods(list){ const out = []; for(const m of list) out.push(m[0], m[1]); return out; }
function entRow(q){
  const row = [q.id, KI[q.k], r1(q.x), r1(q.y), q.face, q.st || '', r2(q.t), q.hf > 0 ? 1 : 0];
  switch(q.k){
    case 'turret': row.push(r2(q.ang)); break;
    case 'crusher': row.push(r1(q.ext), r1(q.top)); break;
    case 'item': row.push(ITEM_KINDS.indexOf(q.item)); break;
    case 'rock': row.push(q.sub === 'boulder' ? 1 : 0, r2(q.spin || 0)); break;
    case 'roller': row.push(r2(q.spin || 0)); break;
    case 'tank': row.push(r1(q.tread || 0)); break;
    case 'walker': row.push(r1(q.walk || 0)); break;
    case 'missile': row.push(q.sub === 'homing' ? 1 : 0, r2(Math.atan2(q.vy || 0, q.vx || -1))); break;
    case 'boss': row.push([q.bw, q.ph, q.pm, q.v.map(r1), q.phf.map(v => v > 0 ? 1 : 0), q.fist ? q.fist.map(f => f.st) : 0, r1(q.w), r1(q.h)]); break;
  }
  return row;
}
function sendSnap(){
  const e = [];
  for(const q of G.ents){
    if(q.dead || q.k === 'spawner') continue;
    if(q.k !== 'boss' && !inView(q, 60)) continue;
    e.push(entRow(q));
  }
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), lv: G.lv, ln: G.loadN, d: G.diff, dm: G.demo ? 1 : 0, kd: G.kind,
    sc: G.score, li: hasLives() ? G.lives : -1, cx: r1(G.cam.x), cy: r1(G.cam.y), lt: r1(G.lvT), il: G.introLen, lk: G.locked ? 1 : 0, fs: G.flySpeed,
    cb: G.comboT > 0 ? G.combo : 0, gg: G.gotGear ? 1 : 0,
    p: G.players.map(p => [p.slot, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.face,
      (p.onGround ? 1 : 0) | (p.crouch ? 2 : 0) | (p.dive ? 4 : 0) | (p.spin ? 8 : 0) | (p.swim ? 16 : 0) | (p.out > 0 ? 32 : 0) | (p.sos ? 64 : 0) | (p.away ? 128 : 0) | (p.dropIn > 0 ? 256 : 0) | (p.inv > 0 ? 512 : 0) | (p.hurtT > 0 ? 1024 : 0),
      aimIndex(p.ax, p.ay), W_ORDER.indexOf(p.weapon), p.wlv, p.hp, p.maxHp, p.name, p.color, p.source || '', r1(p.shield), p.mech, r2(p.shotT), r2(p.runT), p.kills, p.h, p.w, p.tilt || 0, r2(p.sosT)]),
    e,
    b: G.shots.map(q => [q.id, SHOTK.indexOf(q.k), r1(q.x), r1(q.y), Math.round(q.vx), Math.round(q.vy), q.owner, q.lv || 0]),
    eb: G.eshots.map(q => [q.id, ESHK.indexOf(q.k), r1(q.x), r1(q.y), Math.round(q.vx), Math.round(q.vy)]) };
  if(G.say !== lastSay){ lastSay = G.say; s.sy = G.say; s.sx = G.sayText; }
  if(G.loadN !== lastLoadSent){ lastLoadSent = G.loadN; modsSent = 0; }
  if(++snapN % 60 === 0 || forceFull){ s.mf = flatMods(G.mods); forceFull = false; }
  else if(G.mods.length > modsSent) s.md = [modsSent].concat(flatMods(G.mods.slice(modsSent)));
  modsSent = G.mods.length;
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  if(netFx.length){ s.fx = netFx; netFx = []; }
  Net.broadcast(s);
}
function guestLevel(lv){
  const L = buildLevel(lv);
  G.lv = lv; G.def = L.def; G.kind = L.def.kind; G.W = L.W; G.H = L.H; G.map = L.map.slice(); G.modsApplied = 0;
}
let guestSay = 0;
function receiveMeta(m){
  if(m.ln !== G.loadN || m.lv !== G.lv || !G.map){ G.loadN = m.ln; guestLevel(m.lv); parts = []; }
  const apply = (arr, from) => { for(let i = from; i + 1 < arr.length; i += 2) G.map[arr[i]] = arr[i + 1]; };
  if(m.mf){ G.map = buildLevel(m.lv).map.slice(); apply(m.mf, 0); G.modsApplied = m.mf.length / 2; }
  else if(m.md && m.md[0] === G.modsApplied){ apply(m.md, 1); G.modsApplied += (m.md.length - 1) / 2; }
  if(m.sy && m.sy !== guestSay){ guestSay = m.sy; if(!m.dm) A.toast(m.sx, 3400); }
}
function lerpById(aList, bList, t, idIx, xIx, yIx, far){
  const pa = new Map(aList.map(q => [q[idIx], q]));
  return bList.map(q => {
    const o = pa.get(q[idIx]), near = o && Math.abs(o[xIx] - q[xIx]) < far && Math.abs(o[yIx] - q[yIx]) < far;
    return { q, x: near ? o[xIx] + (q[xIx] - o[xIx]) * t : q[xIx], y: near ? o[yIx] + (q[yIx] - o[yIx]) * t : q[yIx] };
  });
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!G.map || s.lv !== G.lv) guestLevel(s.lv);
  G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.score = s.sc; G.lives = s.li < 0 ? Infinity : s.li;
  G.lvT = s.lt; G.introLen = s.il || 2.8; G.locked = !!s.lk; G.flySpeed = s.fs; G.combo = s.cb; G.comboT = s.cb ? 1 : 0; G.gotGear = !!s.gg;
  G.kind = s.kd || G.def.kind;
  const same = a.lv === b.lv && a.ln === b.ln;
  G.cam.x = same && Math.abs(a.cx - b.cx) < 80 ? L(a.cx, b.cx) : b.cx; G.cam.y = same && Math.abs(a.cy - b.cy) < 80 ? L(a.cy, b.cy) : b.cy;
  G.players = lerpById(same ? a.p : [], s.p, t, 0, 1, 2, 60).map(({ q, x, y }) => {
    const f = q[6], ai = AIMS[q[7]] || AIMS[0];
    return { slot: q[0], x, y, vx: q[3], vy: q[4], face: q[5], onGround: !!(f & 1), crouch: !!(f & 2), dive: !!(f & 4), spin: !!(f & 8), swim: !!(f & 16),
      out: (f & 32) ? 1 : 0, sos: !!(f & 64), away: !!(f & 128), dropIn: (f & 256) ? 1 : 0, inv: (f & 512) ? 1 : 0, hurtT: (f & 1024) ? 0.2 : 0,
      ax: ai[0], ay: ai[1], weapon: W_ORDER[q[8]] || 'blaster', wlv: q[9], hp: q[10], maxHp: q[11], name: q[12], color: q[13], source: q[14],
      shield: q[15], mech: q[16], shotT: q[17], runT: q[18], kills: q[19], h: q[20], w: q[21], tilt: q[22], sosT: q[23] };
  });
  G.ents = lerpById(same ? a.e : [], s.e, t, 0, 2, 3, 48).map(({ q, x, y }) => {
    const k = KINDS[q[1]], sz = SIZES[k] || [12, 12];
    const e = { id: q[0], k, x, y, w: sz[0], h: sz[1], face: q[4], st: q[5], t: q[6], hf: q[7] ? 0.05 : 0, on: true, awake: true };
    switch(k){
      case 'turret': e.ang = q[8]; break;
      case 'crusher': e.ext = q[8]; e.top = q[9]; break;
      case 'item': e.item = ITEM_KINDS[q[8]]; break;
      case 'rock': e.sub = q[8] ? 'boulder' : 'fall'; e.spin = q[9]; break;
      case 'roller': e.spin = q[8]; break;
      case 'tank': e.tread = q[8]; break;
      case 'walker': e.walk = q[8]; break;
      case 'missile': e.sub = q[8] ? 'homing' : ''; e.ang = q[9]; break;
      case 'boss': { const x2 = q[8]; e.bw = x2[0]; e.ph = x2[1]; e.pm = x2[2]; e.v = x2[3]; e.phf = x2[4]; e.fist = x2[5] ? x2[5].map(st => ({ st })) : null; e.w = x2[6]; e.h = x2[7]; e.name = BOSS_NAMES[e.bw];
        e.hp = e.ph.reduce((m, n) => m + n, 0); break; }
    }
    return e;
  });
  G.shots = lerpById(same ? a.b : [], s.b, t, 0, 2, 3, 40).map(({ q, x, y }) => ({ id: q[0], k: SHOTK[q[1]], x, y, vx: q[4], vy: q[5], owner: q[6], lv: q[7] }));
  G.eshots = lerpById(same ? a.eb : [], s.eb, t, 0, 2, 3, 40).map(({ q, x, y }) => ({ id: q[0], k: ESHK[q[1]], x, y, vx: q[4], vy: q[5] }));
}

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null;
function music(){
  let want = null;
  const st = G.state;
  const boss = G.ents.find(e => e.k === 'boss');
  if(G.demo || st === 'title' || st === 'lobby' || st === 'online') want = A.THEMES.menu;
  else if(st === 'ending') want = ENDING_THEME;
  else if(st === 'results' || st === 'gameover') want = A.THEMES.menu;
  else if(st === 'intro' || st === 'play' || st === 'paused' || st === 'warn'){
    if(boss && boss.st === 'defeat') want = null;
    else if(G.players.some(p => p.shield > 0 && !p.out && !p.sos)) want = SHIELD_THEME;
    else if(boss || st === 'warn') want = G.def.boss === 5 ? FINAL_THEME : BOSS_THEME;
    else want = G.def.music;
  }
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(st === 'paused' || st === 'results' || st === 'gameover');
}
function myPlayers(){
  if(G.net !== 'guest') return G.players;
  return G.players.filter(p => Net.isMine(p.source));
}
const playing = () => G.state === 'play' || G.state === 'intro' || G.state === 'warn';
function step(dt){
  G.time += dt; sfxThisFrame.clear();
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = playing() && myPlayers().some(p => p.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('FIRE'); }
    Net.setPlaying(playing());
    music(); return;
  }
  const wantTouch = playing() && G.players.some(p => p.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('FIRE'); }
  music();
  if(Net) Net.setPlaying(playing());
  hostStep(dt);
  if(G.net === 'host'){ Net.hostTick(); if(++netStep % 2 === 0 && Net.hasGuests()) sendSnap(); }
}
function hostStep(dt){
  if(A.Lobby.isOpen()){ A.Lobby.update(); if(G.demo) sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); if(G.demo) sim(dt); return; }
  if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
  const pausePressed = A.Input.all().some(s => A.Input.pressed(s, 'pause') && (s.kind !== 'net' || G.players.some(p => p.source === s.id)));
  switch(G.state){
    case 'intro':
      if(pausePressed){ pause(); return; }
      G.stateT += dt; camera(dt);
      if(G.stateT >= G.introLen){ G.state = 'play'; G.stateT = 0; }
      break;
    case 'play': case 'warn':
      if(pausePressed){ pause(); return; }
      G.stateT += dt;
      dropIn(); sim(dt); flowChecks(dt);
      if(G.state === 'warn' && G.stateT > 2.6){ G.state = 'play'; G.stateT = 0; }
      break;
    case 'clear':
      G.stateT += dt; G.lvT += 0;
      for(const e of G.ents) if(e.k === 'item' || e.k === 'gear') stepEnt(e, dt);
      if(Math.floor(G.stateT * 2.5) !== Math.floor((G.stateT - dt) * 2.5) && G.stateT < 3){
        fx('firework', G.cam.x + 40 + Math.random() * (VW - 80), G.cam.y + 30 + Math.random() * 60, A.PLAYER_COLORS[Math.floor(Math.random() * 4)]); sfx('firework');
      }
      if(G.stateT > 4) results();
      break;
    case 'ending':
      G.stateT += dt;
      for(const p of G.players){ p.vy = (p.vy || 0) + GRAV * dt; p.y += p.vy * dt; if(p.y + p.h >= 170){ p.y = 170 - p.h; p.vy = 0; p.onGround = true; if(Math.random() < 0.015){ p.vy = -300; p.onGround = false; } } else p.onGround = false; p.shotT = Math.max(0, p.shotT - dt); }
      if(Math.floor(G.stateT * 1.6) !== Math.floor((G.stateT - dt) * 1.6)){ fx('firework', 40 + Math.random() * (VW - 80), 26 + Math.random() * 60, A.PLAYER_COLORS[Math.floor(Math.random() * 4)]); sfx('firework'); }
      if(G.stateT > 7 && !A.Menu.isOpen()) endingMenu();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || !playing() || G.net === 'guest') return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);

function rng(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function rr(c, x, y, w, h, r){ r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); }
function ell(c, x, y, rx, ry, rot){ c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2); }
function text(c, str, x, y, size, color, align, base){ c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y); }
function outlined(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, size / 3.5); c.strokeStyle = 'rgba(12,10,24,.92)'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
function star5(c, x, y, R, r){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); }
function heart(c, x, y, s, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.3, y, x - s * 0.7, y - s * 0.9, x, y - s * 0.25); c.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.3, y, x, y + s * 0.9); c.fill(); }
function gearShape(c, x, y, R, r, n, rot){ c.beginPath(); for(let i = 0; i < n * 2; i++){ const a = rot + i * Math.PI / n, d = i % 2 ? r : R; c.lineTo(x + Math.cos(a - 0.12) * d, y + Math.sin(a - 0.12) * d); c.lineTo(x + Math.cos(a + 0.12) * d, y + Math.sin(a + 0.12) * d); } c.closePath(); }
const hue = (t, s, l) => 'hsl(' + ((t % 360 + 360) % 360) + ',' + (s || 95) + '%,' + (l || 62) + '%)';
const wrap = (v, span) => ((v % span) + span) % span;
const INK = '#16121e';

const PAL = {
  jungle: { sky: ['#ff8f5a', '#ffc98a', '#ffe8c0'], far: '#b0607a', mid: '#3f7d4c', near: '#27583b',
    top: '#6ad05a', topHi: '#b8f27c', topDk: '#3a9a45', fill: '#7a5234', fillDk: '#5b3b25', speck: '#94663f',
    rock: ['#8e8a78', '#65604f', '#bdb8a4'], ledge: ['#a86d3c', '#6b4424', '#e3a86c'], water: 'rgba(63,166,216,.72)', waterTop: '#bfefff' },
  falls: { sky: ['#1b3456', '#3a6c9c', '#8ec3e0'], far: '#34445c', mid: '#46566e',
    top: '#63d077', topHi: '#b0f59e', topDk: '#2f8a4a', fill: '#4d5563', fillDk: '#363c47', speck: '#5f6878',
    rock: ['#6b7382', '#4a515e', '#9aa3b3'], ledge: ['#7d8594', '#4a515e', '#6fd07a'], water: 'rgba(120,200,240,.7)', waterTop: '#e0f8ff' },
  frost: { sky: ['#86b8e6', '#c9e2f8', '#f1f8ff'], far: '#b9cbe6', mid: '#8aa7cf', near: '#5f7fae',
    top: '#ffffff', topHi: '#ffffff', topDk: '#c8dcf0', fill: '#7b98c4', fillDk: '#5d78a3', speck: '#9db6da',
    rock: ['#9fb4d4', '#6f86ad', '#d4e2f5'], ledge: ['#b6c9e6', '#7b92ba', '#ffffff'], water: 'rgba(120,190,230,.7)', waterTop: '#fff' },
  factory: { sky: ['#17131f', '#241e2e', '#2f2639'], far: '#2a2433', mid: '#3a3244',
    top: '#8a8f9c', topHi: '#c3c8d4', topDk: '#5c616d', fill: '#3d404b', fillDk: '#2b2d36', speck: '#4c505c',
    rock: ['#5c606e', '#3c3f4a', '#8a8f9c'], ledge: ['#f5c542', '#8a6a12', '#ffe28a'], water: 'rgba(90,140,90,.7)', waterTop: '#cfe' },
  sky: { sky: ['#3b2a6e', '#ff7e6b', '#ffc27a'] },
  citadel: { sky: ['#160a1f', '#3d1330', '#7a2238'], far: '#2a1330', mid: '#3a1b3e',
    top: '#9a8fb0', topHi: '#d8d0ea', topDk: '#6a5f80', fill: '#3b3348', fillDk: '#2a2334', speck: '#4a4058',
    rock: ['#6a5f80', '#473e58', '#9a8fb0'], ledge: ['#ff5470', '#8a2238', '#ffb0be'], water: 'rgba(120,60,90,.7)', waterTop: '#fcd' }
};
const pal = () => PAL[G.def.key] || PAL.jungle;

/* ---------- Tiles (cached per screen resolution, drawn on whole device pixels) ---------- */
const tileCache = new Map(); let cacheSize = 0;
function sprite(key, draw){
  const S = Math.max(1, Math.round(T * display.scale));
  if(S !== cacheSize){ tileCache.clear(); cacheSize = S; }
  let cv = tileCache.get(key);
  if(!cv){ cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.scale(S / T, S / T); draw(c); tileCache.set(key, cv); }
  return cv;
}
function drawGround(c, P, top, v){
  c.fillStyle = P.fill; c.fillRect(0, 0, T, T);
  c.fillStyle = P.speck; for(let i = 0; i < 3; i++){ const px = rng(v * 7 + i) * 13 + 1, py = rng(v * 11 + i * 3) * 12 + 2; c.fillRect(px, py, 2, 1.5); }
  c.fillStyle = P.fillDk; c.fillRect(0, T - 1, T, 1);
  if(top){
    if(G.def.key === 'factory' || G.def.key === 'citadel'){
      c.fillStyle = P.top; c.fillRect(0, 0, T, 5); c.fillStyle = P.topHi; c.fillRect(0, 0, T, 1.2); c.fillStyle = P.topDk; c.fillRect(0, 4, T, 1.2);
      c.fillStyle = P.topDk; c.fillRect(3, 1.8, 1.4, 1.4); c.fillRect(11, 1.8, 1.4, 1.4);
    } else if(G.def.key === 'frost'){
      c.fillStyle = P.top; c.fillRect(0, 0, T, 5); c.beginPath(); c.moveTo(0, 5); for(let i = 0; i <= 4; i++) c.quadraticCurveTo(i * 4 - 2, 8, i * 4, 5); c.fill();
      c.fillStyle = P.topDk; c.fillRect(0, 4, T, 0.8);
    } else {
      c.fillStyle = P.top; c.fillRect(0, 0, T, 4.5);
      c.beginPath(); for(let i = 0; i < 4; i++){ c.moveTo(i * 4, 4); c.lineTo(i * 4 + 2, 7 + rng(v + i) * 2); c.lineTo(i * 4 + 4, 4); } c.fill();
      c.fillStyle = P.topHi; c.fillRect(0, 0, T, 1.3);
      c.fillStyle = P.topDk; for(let i = 0; i < 3; i++) c.fillRect(rng(v * 3 + i) * 14, 1.5 + rng(v + i * 5) * 2, 1, 2);
    }
  }
}
function drawRock(c, P, v, top){
  const [b, d, h] = P.rock;
  c.fillStyle = b; c.fillRect(0, 0, T, T);
  if(G.def.key === 'factory' || G.def.key === 'citadel'){
    c.fillStyle = h; c.fillRect(0, 0, T, 1.2); c.fillRect(0, 0, 1.2, T);
    c.fillStyle = d; c.fillRect(0, T - 1.4, T, 1.4); c.fillRect(T - 1.4, 0, 1.4, T);
    c.fillStyle = d; for(const [x, y] of [[3, 3], [13, 3], [3, 13], [13, 13]]){ circ(c, x, y, 0.9); c.fill(); }
    if(v % 3 === 0){ c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(5, 5, 6, 6); }
  } else {
    c.fillStyle = d; c.fillRect(0, T - 2, T, 2); c.fillRect(T - 2, 0, 2, T);
    c.fillStyle = h; c.fillRect(0, 0, T - 2, 1.5); c.fillRect(0, 0, 1.5, T - 2);
    c.strokeStyle = d; c.lineWidth = 0.8; c.beginPath(); c.moveTo(4 + rng(v) * 4, 2); c.lineTo(6 + rng(v + 1) * 4, 8); c.lineTo(3 + rng(v + 2) * 8, 13); c.stroke();
    if(top && G.def.key !== 'frost'){ c.fillStyle = P.top; c.fillRect(0, 0, T, 2.5); c.fillStyle = P.topHi; c.fillRect(0, 0, T, 0.9); }
    if(top && G.def.key === 'frost'){ c.fillStyle = '#fff'; c.fillRect(0, 0, T, 3); }
  }
}
function drawLedge(c, P){
  const [b, d, h] = P.ledge;
  if(G.def.key === 'factory' || G.def.key === 'citadel'){
    c.fillStyle = d; c.fillRect(0, 0, T, 5); c.fillStyle = b; c.fillRect(0, 0, T, 3.5);
    c.fillStyle = INK; for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(i * 4, 3.5); c.lineTo(i * 4 + 2, 0); c.lineTo(i * 4 + 3.5, 0); c.lineTo(i * 4 + 1.5, 3.5); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(2, 5, 1.5, 3); c.fillRect(12, 5, 1.5, 3);
  } else if(G.def.key === 'falls'){
    c.fillStyle = d; rr(c, 0, 0, T, 7, 2.5); c.fill(); c.fillStyle = b; rr(c, 0, 0, T, 5.5, 2.5); c.fill();
    c.fillStyle = h; c.fillRect(0, 0, T, 2); c.fillStyle = '#2f8a4a'; for(let i = 0; i < 3; i++) c.fillRect(2 + i * 5, 2, 1.2, 2.5 + (i % 2) * 2);
  } else {
    c.fillStyle = d; c.fillRect(0, 1, T, 5); c.fillStyle = b; c.fillRect(0, 0, T, 4); c.fillStyle = h; c.fillRect(0, 0, T, 1.2);
    c.fillStyle = d; c.fillRect(7.5, 0, 1, 4); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(1, 6, 1.5, 4); c.fillRect(13.5, 6, 1.5, 4);
  }
}
function drawBridge(c){
  c.fillStyle = '#6b4424'; c.fillRect(0, 2, T, 5); c.fillStyle = '#b77b3f'; c.fillRect(0.5, 1, 7, 5); c.fillRect(8.5, 1, 7, 5);
  c.fillStyle = '#e2a868'; c.fillRect(0.5, 1, 7, 1); c.fillRect(8.5, 1, 7, 1);
  c.strokeStyle = '#d8c08a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(8, -3, 16, -6); c.stroke();
  c.fillStyle = '#6b4424'; c.fillRect(7.3, -7, 1.4, 8);
}
function drawIce(c, v){
  c.fillStyle = '#9ad8f2'; c.fillRect(0, 0, T, T); c.fillStyle = '#d8f6ff'; c.fillRect(0, 0, T, 3);
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(3 + v % 5, 5); c.lineTo(7 + v % 5, 5); c.lineTo(4 + v % 5, 11); c.lineTo(2 + v % 5, 11); c.fill();
  c.fillStyle = '#6fb8da'; c.fillRect(0, T - 1, T, 1);
}
function drawBreak(c, dmg){
  c.fillStyle = '#5c606e'; c.fillRect(0, 0, T, T);
  c.fillStyle = '#7a7f8e'; c.fillRect(1, 1, 6, 6); c.fillRect(9, 1, 6, 6); c.fillRect(1, 9, 6, 6); c.fillRect(9, 9, 6, 6);
  c.fillStyle = '#f5c542'; c.fillRect(0, 7, T, 2); c.fillStyle = INK; for(let i = 0; i < 4; i++) c.fillRect(i * 4 + 1, 7, 2, 2);
  if(dmg > 0){ c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(3, 1); c.lineTo(7, 6); c.lineTo(5, 10); c.lineTo(9, 15); if(dmg > 1){ c.moveTo(14, 2); c.lineTo(10, 7); c.lineTo(13, 12); } c.stroke(); }
}
function tileSprite(ch, tx, ty){
  const P = pal(), k = G.def.key, v = (tx * 7 + ty * 13) % 3;
  if(ch === '#'){ const top = !isSolid(tileAt(tx, ty - 1)); return sprite(k + '#' + (top ? 1 : 0) + v, c => drawGround(c, P, top, v)); }
  if(ch === 'X'){ const top = !isSolid(tileAt(tx, ty - 1)) && ty > 1; return sprite(k + 'X' + v + (top ? 't' : ''), c => drawRock(c, P, v, top)); }
  if(ch === '=') return sprite(k + '=', c => drawLedge(c, P));
  if(ch === 'c') return sprite(k + 'c', c => drawBridge(c));
  if(ch === 'i') return sprite(k + 'i' + v, c => drawIce(c, v));
  if(ch === 'D'){ const hp = G.wallHp.get(ty * G.W + tx), dmg = hp === undefined ? 0 : hp > 3 ? 1 : 2; return sprite(k + 'D' + dmg, c => drawBreak(c, dmg)); }
  return null;
}
function drawTiles(c, camX, camY, s){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T), ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(G.H - 1, Math.floor((camY + VH) / T));
  for(let ty = ty0; ty <= ty1; ty++) for(let tx = tx0; tx <= tx1; tx++){
    if(tx < 0 || tx >= G.W) continue;
    const ch = G.map[ty * G.W + tx];
    if(ch === '.' || ch === '~' || ch === '>' || ch === '<' || ch === 'z') continue;
    const spr = tileSprite(ch, tx, ty); if(!spr) continue;
    const x0 = Math.round((tx * T - camX) * s), y0 = Math.round((ty * T - camY) * s), x1 = Math.round(((tx + 1) * T - camX) * s), y1 = Math.round(((ty + 1) * T - camY) * s);
    c.drawImage(spr, x0, y0, x1 - x0, y1 - y0);
  }
}
/* Animated tiles, drawn in world space: conveyors, zap floors (before actors) and water (after, so waders sink in). */
function drawLiveTiles(c, camX, camY, water){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T), ty0 = Math.max(0, Math.floor(camY / T)), ty1 = Math.min(G.H - 1, Math.floor((camY + VH) / T));
  const P = pal();
  for(let ty = ty0; ty <= ty1; ty++) for(let tx = tx0; tx <= tx1; tx++){
    if(tx < 0 || tx >= G.W) continue;
    const ch = G.map[ty * G.W + tx], x = tx * T, y = ty * T;
    if(water){
      if(ch !== '~') continue;
      c.fillStyle = P.water; c.fillRect(x, y + 3, T, T - 3);
      const w = Math.sin(G.time * 3 + tx * 0.9) * 1.2;
      c.fillStyle = P.waterTop; c.fillRect(x, y + 3 + w, T, 1.3);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + wrap(G.time * 14 + tx * 5, 16), y + 7, 4, 0.8);
      continue;
    }
    if(ch === '>' || ch === '<'){
      c.fillStyle = '#2b2d36'; c.fillRect(x, y, T, T); c.fillStyle = '#45485a'; rr(c, x, y + 1, T, 7, 3.5); c.fill();
      const dir = ch === '>' ? 1 : -1, off = wrap(G.time * 42 * dir, 8);
      c.fillStyle = '#f5c542'; for(let i = -1; i < 2; i++){ const ax = x + i * 8 + off; if(ax < x - 4 || ax > x + T - 2) continue; c.beginPath(); c.moveTo(ax + (dir > 0 ? 0 : 5), y + 2.5); c.lineTo(ax + (dir > 0 ? 5 : 0), y + 4.5); c.lineTo(ax + (dir > 0 ? 0 : 5), y + 6.5); c.fill(); }
      c.fillStyle = '#6c6f7a'; for(let i = 0; i < 2; i++){ circ(c, x + 4 + i * 8, y + 11, 2.2); c.fill(); }
    } else if(ch === 'z'){
      const on = zapOn(tx), warn = zapWarn(tx);
      c.fillStyle = '#34363f'; c.fillRect(x, y, T, T); c.fillStyle = on ? '#7fe3ff' : warn ? '#3f7a9a' : '#4a4d5a'; c.fillRect(x, y, T, 4);
      c.fillStyle = '#f5c542'; c.fillRect(x, y + 5, T, 2); c.fillStyle = INK; for(let i = 0; i < 4; i++) c.fillRect(x + i * 4 + 1, y + 5, 2, 2);
      if(on){ c.strokeStyle = 'rgba(200,250,255,.95)'; c.lineWidth = 1; c.beginPath(); let px = x, py = y; c.moveTo(px, py); for(let i = 1; i <= 4; i++){ px = x + i * 4; py = y - 2 - rng(tx * 9 + i + Math.floor(G.time * 20)) * 8; c.lineTo(px, py); } c.stroke(); }
      else if(warn && Math.floor(G.time * 10) % 2){ c.fillStyle = 'rgba(127,227,255,.6)'; c.fillRect(x + 2, y - 1, 2, 1); c.fillRect(x + 10, y - 2, 2, 1); }
    }
  }
}

/* ---------- Backgrounds ---------- */
function hillY(off, base, amp, freq, seed, sx){ const w = sx + off; return base - (Math.sin(w * freq + seed) * 0.55 + Math.sin(w * freq * 2.3 + seed * 2) * 0.3 + 1) * amp; }
function hills(c, off, base, amp, col, freq, seed){
  c.fillStyle = col; c.beginPath(); c.moveTo(0, VH);
  for(let x = 0; x <= VW; x += 8) c.lineTo(x, hillY(off, base, amp, freq, seed, x));
  c.lineTo(VW, VH); c.fill();
}
function skyGrad(c, cols){ const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(1, cols[2]); c.fillStyle = g; c.fillRect(0, 0, VW, VH); }
function palm(c, x, y, s, col){
  c.strokeStyle = col; c.lineWidth = 2.2 * s; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 4 * s, y - 18 * s, x + 2 * s, y - 34 * s); c.stroke();
  c.fillStyle = col; for(let i = 0; i < 6; i++){ const a = -Math.PI / 2 + (i - 2.5) * 0.55; c.beginPath(); c.moveTo(x + 2 * s, y - 34 * s); c.quadraticCurveTo(x + 2 * s + Math.cos(a) * 12 * s, y - 34 * s + Math.sin(a) * 12 * s - 4 * s, x + 2 * s + Math.cos(a) * 20 * s, y - 34 * s + Math.sin(a) * 20 * s + 5 * s); c.quadraticCurveTo(x + 2 * s + Math.cos(a) * 10 * s, y - 34 * s + Math.sin(a) * 8 * s, x + 2 * s, y - 34 * s); c.fill(); }
}
function pine(c, x, y, s, col, snow){
  c.fillStyle = col; for(let i = 0; i < 3; i++){ c.beginPath(); c.moveTo(x, y - 30 * s + i * 8 * s); c.lineTo(x - (8 + i * 3) * s, y - 14 * s + i * 8 * s); c.lineTo(x + (8 + i * 3) * s, y - 14 * s + i * 8 * s); c.fill(); }
  c.fillRect(x - 1.5 * s, y, 3 * s, -6 * s);
  if(snow){ c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(x, y - 30 * s); c.lineTo(x - 3 * s, y - 25 * s); c.lineTo(x + 3 * s, y - 25 * s); c.fill(); }
}
function drawBG(c, camX, camY){
  const k = G.kind === 'ending' ? 'ending' : G.def.key, t = G.time;
  if(k === 'jungle'){
    skyGrad(c, PAL.jungle.sky);
    const g = c.createRadialGradient(300, 70, 4, 300, 70, 70); g.addColorStop(0, 'rgba(255,245,200,.95)'); g.addColorStop(0.25, 'rgba(255,220,150,.5)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = g; c.fillRect(200, 0, 184, 160); c.fillStyle = '#fff3c8'; circ(c, 300, 70, 16); c.fill();
    hills(c, camX * 0.08, 150, 42, '#c9708a', 0.011, 1.3); hills(c, camX * 0.16, 165, 36, '#9c5a78', 0.014, 4.1);
    hills(c, camX * 0.32, 185, 26, PAL.jungle.mid, 0.02, 2.2);
    for(let i = -1; i < 7; i++){ const x = i * 70 - wrap(camX * 0.32, 70) + 20; palm(c, x, hillY(camX * 0.32, 185, 26, 0.02, 2.2, x) + 4, 0.9 + rng(i + Math.floor(camX * 0.32 / 70)) * 0.3, '#2c5e3a'); }
    hills(c, camX * 0.55, 210, 18, PAL.jungle.near, 0.03, 5.3);
  } else if(k === 'falls'){
    skyGrad(c, PAL.falls.sky);
    const py = camY * 0.25;
    c.fillStyle = '#2c3a50'; for(let i = 0; i < 6; i++){ const y = wrap(i * 70 - py, 420) - 60; c.beginPath(); c.moveTo(0, y); c.lineTo(70 + rng(i) * 30, y + 30); c.lineTo(40 + rng(i + 1) * 30, y + 80); c.lineTo(0, y + 90); c.fill(); c.beginPath(); c.moveTo(VW, y + 20); c.lineTo(VW - 60 - rng(i + 3) * 40, y + 50); c.lineTo(VW - 40, y + 100); c.lineTo(VW, y + 110); c.fill(); }
    // the great waterfall
    const wx = 100, ww = 184;
    const g = c.createLinearGradient(wx, 0, wx + ww, 0); g.addColorStop(0, 'rgba(140,210,245,.55)'); g.addColorStop(0.5, 'rgba(200,240,255,.7)'); g.addColorStop(1, 'rgba(140,210,245,.55)');
    c.fillStyle = g; c.fillRect(wx, 0, ww, VH);
    c.fillStyle = 'rgba(255,255,255,.55)';
    for(let i = 0; i < 26; i++){ const x = wx + 4 + rng(i) * (ww - 8), len = 14 + rng(i + 9) * 26, y = wrap(t * (140 + rng(i + 3) * 80) + rng(i + 5) * 300 - camY * 0.5, VH + 60) - 40; c.fillRect(x, y, 1.4, len); }
    const m = c.createLinearGradient(0, VH - 50, 0, VH); m.addColorStop(0, 'rgba(255,255,255,0)'); m.addColorStop(1, 'rgba(230,248,255,.45)'); c.fillStyle = m; c.fillRect(0, VH - 50, VW, 50);
  } else if(k === 'frost'){
    skyGrad(c, PAL.frost.sky);
    c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, 90, 44, 14); c.fill();
    const peaks = (off, base, h, col, snow) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, VH); for(let i = -1; i < 8; i++){ const x = i * 64 - wrap(off, 64); const hh = h * (0.6 + rng(i + Math.floor(off / 64)) * 0.5); c.lineTo(x, base); c.lineTo(x + 32, base - hh); } c.lineTo(VW, base); c.lineTo(VW, VH); c.fill();
      if(snow){ c.fillStyle = '#ffffff'; for(let i = -1; i < 8; i++){ const x = i * 64 - wrap(off, 64); const hh = h * (0.6 + rng(i + Math.floor(off / 64)) * 0.5); c.beginPath(); c.moveTo(x + 32, base - hh); c.lineTo(x + 22, base - hh + 14); c.lineTo(x + 30, base - hh + 11); c.lineTo(x + 36, base - hh + 15); c.lineTo(x + 42, base - hh + 14); c.fill(); } } };
    peaks(camX * 0.08, 160, 90, '#b3c7e6', true); peaks(camX * 0.18 + 30, 175, 60, '#8fa9d2', true);
    for(let i = -1; i < 9; i++){ const x = i * 48 - wrap(camX * 0.35, 48) + 10; pine(c, x, 196, 1 + rng(i + Math.floor(camX * 0.35 / 48)) * 0.4, '#4f6f9e', true); }
    c.fillStyle = '#e9f3ff'; c.fillRect(0, 196, VW, 20);
  } else if(k === 'factory'){
    skyGrad(c, PAL.factory.sky);
    const off = camX * 0.3;
    c.fillStyle = '#231d2b'; for(let i = -1; i < 6; i++){ const x = i * 90 - wrap(off, 90); c.fillRect(x + 10, 40, 60, 120); c.fillStyle = '#ffb347'; for(let r = 0; r < 3; r++) for(let q = 0; q < 3; q++) if(rng(i * 9 + r * 3 + q + Math.floor(off / 90) * 31) > 0.35) c.fillRect(x + 16 + q * 18, 52 + r * 30, 10, 14); c.fillStyle = '#231d2b'; }
    const off2 = camX * 0.5;
    for(let i = -1; i < 5; i++){ const x = i * 110 - wrap(off2, 110); c.fillStyle = '#3a3346'; gearShape(c, x + 40, 120, 26, 20, 9, t * 0.6 * (i % 2 ? 1 : -1)); c.fill(); c.fillStyle = '#231d2b'; circ(c, x + 40, 120, 8); c.fill(); }
    c.fillStyle = '#4a4258'; c.fillRect(0, 164, VW, 8); c.fillRect(0, 60, VW, 5);
    c.fillStyle = '#5a5068'; for(let i = -1; i < 12; i++){ const x = i * 40 - wrap(off2, 40); c.fillRect(x, 162, 4, 12); c.fillRect(x, 58, 4, 9); }
    for(let i = -1; i < 5; i++){ const x = i * 100 - wrap(camX * 0.6, 100) + 50; c.strokeStyle = '#2a2433'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, 32); c.lineTo(x, 50); c.stroke(); c.fillStyle = '#ffcf6a'; circ(c, x, 53, 3); c.fill(); const lg = c.createRadialGradient(x, 56, 1, x, 56, 40); lg.addColorStop(0, 'rgba(255,200,100,.25)'); lg.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = lg; c.fillRect(x - 40, 50, 80, 60); }
  } else if(k === 'sky'){
    skyGrad(c, PAL.sky.sky);
    c.fillStyle = 'rgba(255,240,200,.9)'; circ(c, 300, 128, 24); c.fill();
    c.fillStyle = '#6a4a8a'; for(let i = -1; i < 20; i++){ const x = i * 24 - wrap(camX * 0.05, 24); const h = 8 + rng(i + Math.floor(camX * 0.05 / 24)) * 22; c.fillRect(x, 160 - h, 20, h); }
    const sea = c.createLinearGradient(0, 160, 0, VH); sea.addColorStop(0, '#3b3f8a'); sea.addColorStop(1, '#1b2050'); c.fillStyle = sea; c.fillRect(0, 160, VW, VH - 160);
    c.fillStyle = 'rgba(255,220,170,.7)'; for(let i = 0; i < 18; i++){ const x = wrap(i * 53 - camX * 0.3, VW + 40) - 20, y = 166 + (i * 7) % 46; c.fillRect(x, y, 8 + (i % 3) * 4, 1); }
    const cloud = (x, y, s, col) => { c.fillStyle = col; circ(c, x, y, 9 * s); c.fill(); circ(c, x + 11 * s, y - 5 * s, 12 * s); c.fill(); circ(c, x + 24 * s, y, 9 * s); c.fill(); rr(c, x - 5 * s, y - 2 * s, 34 * s, 10 * s, 5 * s); c.fill(); };
    for(let i = 0; i < 6; i++) cloud(wrap(i * 90 - camX * 0.25, VW + 90) - 60, 30 + (i * 37) % 90, 0.9, 'rgba(255,210,200,.45)');
    for(let i = 0; i < 4; i++) cloud(wrap(i * 140 - camX * 0.9, VW + 140) - 80, 60 + (i * 53) % 110, 1.3, 'rgba(255,235,230,.55)');
    c.fillStyle = 'rgba(255,255,255,.35)'; for(let i = 0; i < 10; i++){ const y = 24 + (i * 19) % 170, x = wrap(i * 71 - t * 420, VW + 80) - 40; c.fillRect(x, y, 30, 0.8); }
  } else if(k === 'citadel'){
    skyGrad(c, PAL.citadel.sky);
    const flash = Math.floor(t * 0.5) % 7 === 3 && wrap(t, 2) < 0.12;
    if(flash){ c.fillStyle = 'rgba(255,220,255,.25)'; c.fillRect(0, 0, VW, VH); }
    for(let i = 0; i < 3; i++){ const a = Math.sin(t * 0.5 + i * 2) * 0.5 - Math.PI / 2; const bx = 60 + i * 130 - wrap(camX * 0.1, 130); c.fillStyle = 'rgba(255,120,150,.08)'; c.beginPath(); c.moveTo(bx, 200); c.lineTo(bx + Math.cos(a - 0.08) * 300, 200 + Math.sin(a - 0.08) * 300); c.lineTo(bx + Math.cos(a + 0.08) * 300, 200 + Math.sin(a + 0.08) * 300); c.fill(); }
    const towers = (off, base, col, win, sc) => { for(let i = -1; i < 8; i++){ const x = i * 60 * sc - wrap(off, 60 * sc), n = Math.floor(off / (60 * sc)) + i, h = (60 + rng(n) * 80) * sc, w = (22 + rng(n + 3) * 16) * sc;
      c.fillStyle = col; c.fillRect(x, base - h, w, h + 40); c.beginPath(); c.moveTo(x - 2, base - h); c.lineTo(x + w / 2, base - h - 16 * sc); c.lineTo(x + w + 2, base - h); c.fill();
      c.fillStyle = win; for(let r = 0; r < h / 14; r++) if(rng(n * 7 + r) > 0.5) c.fillRect(x + w / 2 - 1.5, base - h + 8 + r * 14, 3, 5); } };
    towers(camX * 0.1, 190, '#2a1330', '#ff5470', 1.1); towers(camX * 0.25 + 20, 205, '#3a1b3e', '#ffb347', 0.8);
  } else {   // ending: sunrise over the jungle, the Sky Crystal back on its tower
    skyGrad(c, ['#6fb6ff', '#ffd1a6', '#fff0c8']);
    const g = c.createRadialGradient(VW / 2, 190, 10, VW / 2, 190, 170); g.addColorStop(0, 'rgba(255,240,180,.9)'); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    hills(c, t * 4, 170, 30, '#8fbf7a', 0.015, 2); hills(c, t * 8, 190, 16, '#5c9f5c', 0.02, 4);
    const cx = VW / 2, cy = 70 + Math.sin(t * 1.5) * 3;
    c.fillStyle = '#6b7382'; c.fillRect(cx - 6, cy + 16, 12, 100); c.fillRect(cx - 14, cy + 12, 28, 6);
    const cg = c.createRadialGradient(cx, cy, 2, cx, cy, 40); cg.addColorStop(0, 'rgba(160,240,255,.9)'); cg.addColorStop(1, 'rgba(160,240,255,0)'); c.fillStyle = cg; c.fillRect(cx - 40, cy - 40, 80, 80);
    c.fillStyle = '#9ff0ff'; c.beginPath(); c.moveTo(cx, cy - 14); c.lineTo(cx + 8, cy); c.lineTo(cx, cy + 12); c.lineTo(cx - 8, cy); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(cx, cy - 14); c.lineTo(cx + 3, cy - 2); c.lineTo(cx - 3, cy); c.fill();
    c.strokeStyle = 'rgba(160,240,255,.6)'; c.lineWidth = 1.2; for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4 + t * 0.4; c.beginPath(); c.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16); c.lineTo(cx + Math.cos(a) * 26, cy + Math.sin(a) * 26); c.stroke(); }
    c.fillStyle = '#4c8a4c'; c.fillRect(0, 170, VW, VH - 170); c.fillStyle = '#6ad05a'; c.fillRect(0, 170, VW, 4);
  }
}
function drawWeather(c, camX, camY){
  const k = G.def.key, t = G.time;
  if(G.kind === 'ending') return;
  if(k === 'frost'){ c.fillStyle = 'rgba(255,255,255,.85)'; for(let i = 0; i < 40; i++){ const x = wrap(i * 37 + Math.sin(t + i) * 12 - camX * 0.6, VW), y = wrap(i * 53 + t * (20 + (i % 5) * 6), VH); c.fillRect(x, y, 1.6, 1.6); } }
  else if(k === 'falls'){ c.fillStyle = 'rgba(220,245,255,.5)'; for(let i = 0; i < 24; i++){ const x = wrap(i * 41 + Math.sin(t * 2 + i) * 6, VW), y = wrap(i * 29 + t * 90 - camY * 0.3, VH); c.fillRect(x, y, 1, 3); } }
  else if(k === 'citadel'){ for(let i = 0; i < 18; i++){ const x = wrap(i * 47 - camX * 0.5 + Math.sin(t + i) * 10, VW), y = VH - wrap(i * 31 + t * 30, VH); c.fillStyle = i % 2 ? 'rgba(255,140,90,.8)' : 'rgba(255,210,120,.7)'; c.fillRect(x, y, 1.4, 1.4); } }
}

/* ---------- Heroes ---------- */
function drawGun(c, sx, sy, ax, ay, face, weapon, shotT, len){
  const ang = Math.atan2(ay, ax || (ay ? 0 : face));
  const col = (WEAPONS[weapon] || WEAPONS.blaster).col;
  c.save(); c.translate(sx, sy); c.rotate(ang);
  if(Math.abs(ang) > Math.PI / 2) c.scale(1, -1);
  c.fillStyle = INK; rr(c, -1, -2.4, (len || 10) + 1.5, 4.8, 1.5); c.fill();
  c.fillStyle = '#3b4252'; rr(c, 0, -1.6, len || 10, 3.2, 1); c.fill();
  c.fillStyle = col; c.fillRect((len || 10) - 2.5, -1.6, 2.5, 3.2);
  c.fillStyle = '#5a6272'; c.fillRect(2, 1.2, 2.4, 2.4);
  if(shotT > 0){ c.fillStyle = 'rgba(255,250,210,.95)'; circ(c, (len || 10) + 2.5, 0, 2.6 + shotT * 12); c.fill(); c.fillStyle = col; circ(c, (len || 10) + 2.5, 0, 1.6); c.fill(); }
  c.restore();
}
function drawHelmet(c, x, y, face, color, r){
  r = r || 4.6;
  c.fillStyle = INK; circ(c, x, y, r + 0.9); c.fill();
  c.fillStyle = color; circ(c, x, y, r); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; circ(c, x - face * 1.2, y - 1.8, r * 0.38); c.fill();
  c.fillStyle = '#10182a'; rr(c, face > 0 ? x - 0.6 : x - 4.4, y - 1.2, 5, 2.8, 1.3); c.fill();
  c.fillStyle = '#7fe3ff'; c.fillRect(face > 0 ? x + 1.6 : x - 3.2, y - 0.8, 1.6, 0.9);
  c.fillStyle = INK; c.fillRect(x - r, y + 0.6, r * 2, 0.8);
}
function drawHero(c, p){
  if(p.out) return;
  if(p.sos){ drawSOS(c, p); return; }
  const blink = p.inv > 0 && !p.dropIn && Math.floor(G.time * 20) % 2 === 0;
  if(blink) c.globalAlpha = 0.4;
  if(G.kind === 'fly'){ drawBoarder(c, p); c.globalAlpha = 1; drawShield(c, p); return; }
  if(p.mech){ drawMech(c, p.x, p.y, p.face, p.color, p.runT, p.ax, p.ay, p.shotT, true, p.hurtT > 0, p.onGround); c.globalAlpha = 1; drawShield(c, p); return; }
  const cx = p.x + p.w / 2, feet = p.y + p.h, f = p.face, col = p.color;
  const hurtFlash = p.hurtT > 0 && Math.floor(G.time * 30) % 2 === 0;
  if(p.dropIn){
    c.fillStyle = 'rgba(127,227,255,.8)'; for(let i = 0; i < 2; i++){ const fx2 = cx + (i ? 3 : -3); c.beginPath(); c.moveTo(fx2 - 1.8, feet); c.lineTo(fx2, feet + 6 + Math.random() * 5); c.lineTo(fx2 + 1.8, feet); c.fill(); }
  }
  c.lineJoin = 'round';
  if(!p.onGround && p.spin){
    const cy = p.y + p.h / 2, a = G.time * 20 * f;
    c.save(); c.translate(cx, cy); c.rotate(a);
    c.fillStyle = INK; circ(c, 0, 0, 7.6); c.fill();
    c.fillStyle = '#4a5568'; circ(c, 0, 0, 6.6); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(0, 0, 6.6, 0, Math.PI * 0.7); c.lineTo(0, 0); c.fill();
    c.fillStyle = '#2a2230'; circ(c, 4, 3.6, 2.2); c.fill(); circ(c, -4.2, 3.2, 2.2); c.fill();
    c.fillStyle = col; circ(c, -1.5, -3.5, 3.6); c.fill(); c.fillStyle = '#10182a'; c.fillRect(-0.2, -4.6, 3.2, 1.8);
    c.restore();
    c.strokeStyle = hexA(col, 0.35); c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, 10, a, a + 1.4); c.stroke();
    drawGun(c, cx + p.ax * 3, cy + p.ay * 3, p.ax, p.ay, f, p.weapon, p.shotT, 8);
    c.globalAlpha = 1; drawShield(c, p); return;
  }
  if(p.crouch || p.dive){
    const by = feet;
    c.fillStyle = INK; rr(c, cx - 7.5, by - 8.5, 15, 8, 3); c.fill();
    c.fillStyle = '#2a2230'; rr(c, cx - f * 7 - 2.5, by - 4, 5, 4, 1.5); c.fill();
    c.fillStyle = '#3b4252'; rr(c, cx - 6.5, by - 7.5, 13, 6.5, 2.5); c.fill();
    c.fillStyle = hurtFlash ? '#fff' : col; c.fillRect(cx - 3, by - 7.5, 3, 6.5);
    drawHelmet(c, cx + f * 5, by - 8.5, f, hurtFlash ? '#fff' : col, 4.2);
    if(!p.dive) drawGun(c, cx + f * 3, by - 4.5, p.ax, p.ay, f, p.weapon, p.shotT, 10);
    else if(Math.floor(G.time * 3) % 2){ c.fillStyle = 'rgba(220,245,255,.85)'; circ(c, cx + f * 6, by - 16 - wrap(G.time * 20, 8), 1.4); c.fill(); }
    c.globalAlpha = 1; drawShield(c, p); return;
  }
  const run = p.onGround ? p.runT * 13 : 0.8, l1 = p.onGround ? Math.sin(run) * 3.4 : 2.4, l2 = p.onGround ? -l1 : -1.6;
  const bob = p.onGround && p.runT > 0 ? Math.abs(Math.sin(run)) * 0.8 : 0;
  const hy = feet - 10 - bob;
  c.strokeStyle = INK; c.lineWidth = 4.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - 1.5, hy); c.lineTo(cx - 1.5 + l2 * f, feet - 1.5); c.moveTo(cx + 1.5, hy); c.lineTo(cx + 1.5 + l1 * f, feet - 1.5); c.stroke();
  c.strokeStyle = '#3b4252'; c.lineWidth = 2.8;
  c.beginPath(); c.moveTo(cx - 1.5, hy); c.lineTo(cx - 1.5 + l2 * f, feet - 1.8); c.stroke();
  c.strokeStyle = '#4a5468'; c.beginPath(); c.moveTo(cx + 1.5, hy); c.lineTo(cx + 1.5 + l1 * f, feet - 1.8); c.stroke();
  c.fillStyle = '#2a2230'; rr(c, cx - 1.5 + l2 * f - 2.2 + f, feet - 2.6, 4.6, 2.6, 1); c.fill(); rr(c, cx + 1.5 + l1 * f - 2.2 + f, feet - 2.6, 4.6, 2.6, 1); c.fill();
  c.lineCap = 'butt';
  const ty = feet - 19 - bob;
  c.fillStyle = INK; rr(c, cx - 5.5, ty - 0.8, 11, 10.6, 3); c.fill();
  c.fillStyle = '#4a5568'; rr(c, cx - 4.6, ty, 9.2, 9, 2.5); c.fill();
  c.fillStyle = hurtFlash ? '#fff' : col; rr(c, cx - 4.6, ty + 1, 9.2, 3.2, 1.2); c.fill();
  c.fillStyle = '#2a2230'; c.fillRect(cx - 4.6, ty + 7, 9.2, 1.6); c.fillStyle = '#f5c542'; c.fillRect(cx - 0.8, ty + 7, 1.6, 1.6);
  c.fillStyle = '#2c3140'; rr(c, cx - f * 5.5 - 2, ty + 1.5, 4, 6.5, 1.5); c.fill();   // backpack
  drawHelmet(c, cx + f * 0.4, ty - 3.4, f, hurtFlash ? '#fff' : col);
  const sy = ty + 3.5 + (p.ay < 0 ? -1 : 0);
  drawGun(c, cx + f * 1.5, sy, p.ax, p.ay, f, p.weapon, p.shotT, 10);
  c.fillStyle = '#e8c9a0'; circ(c, cx + f * 1.5 + (p.ax || 0) * 2, sy + (p.ay || 0) * 2, 1.5); c.fill();
  c.globalAlpha = 1;
  drawShield(c, p);
}
function hexA(hex, a){ const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
function drawShield(c, p){
  if(!(p.shield > 0)) return;
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = Math.max(p.w, p.h) * 0.62 + 4;
  if(p.shield < 2.5 && Math.floor(G.time * 10) % 2) return;
  c.strokeStyle = 'rgba(127,227,255,.9)'; c.lineWidth = 1.4; circ(c, cx, cy, r); c.stroke();
  c.fillStyle = 'rgba(127,227,255,.14)'; c.fill();
  c.strokeStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(cx, cy, r - 2, -2.4 + G.time * 3, -1.6 + G.time * 3); c.stroke();
}
function drawSOS(c, p){
  const cx = p.x + 5, cy = p.y + 10, r = 11 + Math.sin(G.time * 4) * 0.8;
  c.fillStyle = 'rgba(255,120,140,.18)'; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = 'rgba(255,180,190,.9)'; c.lineWidth = 1.2; c.stroke();
  drawHelmet(c, cx, cy, 1, p.color, 4.4);
  if(Math.floor(G.time * 3) % 2) outlined(c, 'SOS', cx, cy - r - 5, 5, '#ff9a8a');
}
function drawBoarder(c, p){
  const x = p.x, y = p.y, col = p.color, tilt = (p.tilt || 0) * 0.15;
  c.save(); c.translate(x + 8, y + 10); c.rotate(tilt);
  c.fillStyle = 'rgba(127,227,255,.85)'; c.beginPath(); c.moveTo(-10, -1); c.lineTo(-17 - Math.random() * 6, 1); c.lineTo(-10, 3); c.fill();
  c.fillStyle = 'rgba(255,240,180,.9)'; c.beginPath(); c.moveTo(-10, 0); c.lineTo(-14 - Math.random() * 3, 1); c.lineTo(-10, 2); c.fill();
  c.fillStyle = INK; rr(c, -11, -1.5, 23, 5.5, 2.5); c.fill();
  c.fillStyle = col; rr(c, -10, -0.8, 21, 4, 2); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-7, -0.6, 14, 1);
  c.strokeStyle = INK; c.lineWidth = 3.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(-3, -2); c.lineTo(-1, -8); c.moveTo(3, -2); c.lineTo(2, -8); c.stroke();
  c.strokeStyle = '#3b4252'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(-3, -2); c.lineTo(-1, -8); c.moveTo(3, -2); c.lineTo(2, -8); c.stroke(); c.lineCap = 'butt';
  c.fillStyle = INK; rr(c, -4.5, -17, 9.5, 10, 3); c.fill(); c.fillStyle = '#4a5568'; rr(c, -3.8, -16.3, 8, 8.6, 2.5); c.fill();
  c.fillStyle = col; c.fillRect(-3.8, -15, 8, 3);
  drawHelmet(c, 0.8, -20, 1, col, 4.3);
  drawGun(c, 2, -12.5, 1, 0, 1, p.weapon, p.shotT, 10);
  c.restore();
}
/* The Stomper: a friendly walking mech. Parked ones wait for a pilot. */
function drawMech(c, x, y, face, col, walk, ax, ay, shotT, pilot, hurt, ground){
  const cx = x + MECH_W / 2, feet = y + MECH_H, f = face;
  const ph = walk * 9, s1 = ground ? Math.sin(ph) * 3 : 2, s2 = ground ? -s1 : -2;
  const bodyC = hurt && Math.floor(G.time * 30) % 2 ? '#ffffff' : '#e0a33a', dark = '#8a5a1a';
  c.lineJoin = 'round';
  for(const [ox, sw, shade] of [[-4, s2, dark], [4, s1, '#b87a22']]){
    c.strokeStyle = INK; c.lineWidth = 5.5; c.beginPath(); c.moveTo(cx + ox, feet - 13); c.lineTo(cx + ox + f * 3 + sw * f * 0.5, feet - 7); c.lineTo(cx + ox + sw * f, feet - 1.5); c.stroke();
    c.strokeStyle = shade; c.lineWidth = 3.6; c.stroke();
    c.fillStyle = INK; rr(c, cx + ox + sw * f - 4.5, feet - 3, 9, 3, 1); c.fill();
  }
  c.fillStyle = INK; rr(c, cx - 10, feet - 27, 20, 16, 5); c.fill();
  c.fillStyle = bodyC; rr(c, cx - 9, feet - 26, 18, 14, 4.5); c.fill();
  c.fillStyle = '#ffd98a'; c.fillRect(cx - 8, feet - 25, 16, 2);
  c.fillStyle = INK; for(let i = 0; i < 3; i++) c.fillRect(cx - 7 + i * 5.5, feet - 14.5, 3, 1.4);
  c.fillStyle = 'rgba(160,230,255,.55)'; rr(c, cx - 6.5 + f * 1.5, feet - 31, 13, 8, 4); c.fill();
  c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  if(pilot) drawHelmet(c, cx + f * 1.5, feet - 27, f, col, 3.6);
  else { c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(cx - 3 + f * 1.5, feet - 29, 3, 1); }
  drawGun(c, cx + f * 4, feet - 20, ax, ay, f, 'blaster', shotT, 13);
  c.fillStyle = col || '#7aa8ff'; c.fillRect(cx - 9, feet - 19, 3, 3);
}

/* ---------- Robots ---------- */
const MET = '#c9ced8', MET2 = '#8d94a3', MET3 = '#5a6070', EYE = '#ff3b5c', EYE2 = '#ffe14a';
function flashCol(e, col){ return e.hf > 0 ? '#ffffff' : col; }
function eye(c, x, y, r, col){ c.fillStyle = INK; circ(c, x, y, r + 0.8); c.fill(); c.fillStyle = col || EYE; circ(c, x, y, r); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; circ(c, x - r * 0.3, y - r * 0.3, r * 0.35); c.fill(); }
function drawFoe(c, e){
  const f = e.face, x = e.x, y = e.y, w = e.w, h = e.h, cx = x + w / 2;
  c.lineJoin = 'round';
  switch(e.k){
    case 'runner': {
      const ph = G.time * 16 + e.id, l = Math.sin(ph) * 3;
      c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - 1, y + 13); c.lineTo(cx - 1 + l, y + h - 1); c.moveTo(cx + 1, y + 13); c.lineTo(cx + 1 - l, y + h - 1); c.stroke();
      c.strokeStyle = MET2; c.lineWidth = 1.6; c.stroke(); c.lineCap = 'butt';
      c.fillStyle = INK; rr(c, x + 0.5, y + 6, 11, 8.5, 3); c.fill(); c.fillStyle = flashCol(e, '#e0584a'); rr(c, x + 1.3, y + 6.8, 9.4, 7, 2.5); c.fill();
      c.fillStyle = INK; circ(c, cx, y + 4.5, 5); c.fill(); c.fillStyle = flashCol(e, MET); circ(c, cx, y + 4.5, 4.2); c.fill();
      eye(c, cx + f * 1.8, y + 4.3, 1.8, EYE2);
      c.strokeStyle = INK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(cx - f * 1.5, y); c.lineTo(cx - f * 3, y - 3); c.stroke(); c.fillStyle = EYE; circ(c, cx - f * 3, y - 3, 1); c.fill();
      break;
    }
    case 'gunner': {
      c.fillStyle = INK; c.fillRect(cx - 4.5, y + h - 8, 3.5, 8); c.fillRect(cx + 1, y + h - 8, 3.5, 8);
      c.fillStyle = MET3; c.fillRect(cx - 3.8, y + h - 7.5, 2.2, 7); c.fillRect(cx + 1.7, y + h - 7.5, 2.2, 7);
      c.fillStyle = INK; rr(c, x, y + 7, w, 9, 2.5); c.fill(); c.fillStyle = flashCol(e, '#6f8fbf'); rr(c, x + 0.8, y + 7.8, w - 1.6, 7.4, 2); c.fill();
      c.fillStyle = '#ffd45e'; c.fillRect(cx - 1.5, y + 10, 3, 2);
      c.fillStyle = INK; rr(c, x + 1.5, y, w - 3, 8, 2.5); c.fill(); c.fillStyle = flashCol(e, MET); rr(c, x + 2.2, y + 0.7, w - 4.4, 6.6, 2); c.fill();
      c.fillStyle = INK; c.fillRect(cx - 3.5 + f * 1.2, y + 2.5, 7, 2.6); c.fillStyle = e.st === 'shoot' ? EYE2 : EYE; c.fillRect(cx - 2.8 + f * 1.2, y + 3, 5.6, 1.6);
      c.fillStyle = INK; rr(c, cx + f * 3 - (f < 0 ? 10 : 0), y + 9.5, 10, 3.6, 1); c.fill();
      c.fillStyle = MET2; c.fillRect(cx + f * 3 - (f < 0 ? 9 : -1), y + 10.3, 8, 2);
      if(e.st === 'shoot'){ c.fillStyle = 'rgba(255,240,180,.9)'; circ(c, cx + f * 14, y + 11.3, 2.5); c.fill(); }
      break;
    }
    case 'turret': {
      const open = e.st === 'open' ? 1 : e.st === 'opening' ? Math.min(1, e.t / 0.4) : 0;
      c.fillStyle = INK; rr(c, x - 1, y + 8, w + 2, 7, 2); c.fill(); c.fillStyle = MET3; rr(c, x, y + 9, w, 5, 1.5); c.fill();
      if(open > 0){
        c.save(); c.translate(cx, y + 7); c.rotate(e.ang); c.fillStyle = INK; rr(c, 0, -2.4, 13 * open, 4.8, 1.5); c.fill(); c.fillStyle = MET2; c.fillRect(1, -1.4, 11 * open, 2.8); c.fillStyle = EYE; c.fillRect(11 * open - 1.5, -1.4, 1.5, 2.8); c.restore();
      }
      c.fillStyle = INK; c.beginPath(); c.arc(cx, y + 9, 8, Math.PI, 0); c.fill();
      c.fillStyle = flashCol(e, open > 0.9 ? '#b85a6a' : MET2); c.beginPath(); c.arc(cx, y + 9, 7, Math.PI, 0); c.fill();
      c.fillStyle = open > 0.9 ? EYE : '#40444f'; c.fillRect(cx - 4, y + 4, 8, 1.8 + open);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cx, y + 9, 5.5, Math.PI * 1.15, Math.PI * 1.5); c.lineTo(cx, y + 9); c.fill();
      break;
    }
    case 'drone': {
      const blur = G.time * 40;
      c.fillStyle = 'rgba(40,40,60,.35)'; ell(c, cx, y - 1, 9 + Math.sin(blur) * 1.5, 1.6); c.fill();
      c.fillStyle = INK; c.fillRect(cx - 0.7, y - 1, 1.4, 4);
      c.fillStyle = INK; ell(c, cx, y + 6, 8.5, 5.5); c.fill(); c.fillStyle = flashCol(e, '#8fd06a'); ell(c, cx, y + 6, 7.6, 4.6); c.fill();
      c.fillStyle = '#5a9a4a'; c.fillRect(x + 1, y + 7, w - 2, 2);
      eye(c, cx + f * 2.5, y + 5.2, 2.2, EYE);
      c.fillStyle = INK; c.fillRect(cx - 4, y + 10, 1.4, 3); c.fillRect(cx + 2.6, y + 10, 1.4, 3);
      break;
    }
    case 'mortar': {
      c.fillStyle = INK; rr(c, x - 1, y + h - 6, w + 2, 6, 3); c.fill(); c.fillStyle = MET3; rr(c, x, y + h - 5.3, w, 4.6, 2.3); c.fill();
      c.fillStyle = MET2; for(let i = 0; i < 3; i++){ circ(c, x + 3 + i * 5, y + h - 3, 1.4); c.fill(); }
      c.save(); c.translate(cx, y + 8); c.rotate(-Math.PI / 2 + f * 0.55 - (e.st === 'shoot' ? f * 0.1 : 0));
      c.fillStyle = INK; rr(c, -1, -3.4, 13, 6.8, 2); c.fill(); c.fillStyle = flashCol(e, '#9a7fd0'); c.fillRect(0, -2.6, 11, 5.2); c.fillStyle = INK; c.fillRect(9, -2.6, 2, 5.2); c.restore();
      c.fillStyle = INK; rr(c, x + 1, y + 6, w - 2, 7, 3); c.fill(); c.fillStyle = flashCol(e, '#b69ae6'); rr(c, x + 1.8, y + 6.8, w - 3.6, 5.4, 2.4); c.fill();
      eye(c, cx + f * 3, y + 9.5, 1.6, EYE2);
      break;
    }
    case 'hider': {
      const up = e.st === 'up' ? Math.min(1, e.t / 0.2) * (e.t > 1 ? Math.max(0, (1.2 - e.t) / 0.2) : 1) : 0;
      if(up > 0){
        const hy = y + h - 6 - up * 12;
        c.fillStyle = INK; rr(c, cx - 5.5, hy - 1, 11, 10, 3); c.fill(); c.fillStyle = flashCol(e, MET); rr(c, cx - 4.7, hy - 0.2, 9.4, 8.4, 2.5); c.fill();
        c.fillStyle = INK; c.fillRect(cx - 3.5 + f, hy + 2.2, 7, 2.4); c.fillStyle = EYE; c.fillRect(cx - 2.8 + f, hy + 2.6, 5.6, 1.6);
        c.fillStyle = INK; c.fillRect(cx - 0.6, hy - 4, 1.2, 3.4); c.fillStyle = EYE2; circ(c, cx, hy - 4.4, 1.2); c.fill();
      }
      const k = G.def.key;
      if(k === 'factory' || k === 'citadel'){ c.fillStyle = INK; rr(c, x - 2, y + h - 10, w + 4, 10, 2); c.fill(); c.fillStyle = k === 'citadel' ? '#7a3a5a' : '#6a7a4a'; rr(c, x - 1.2, y + h - 9.2, w + 2.4, 8.4, 1.5); c.fill(); c.fillStyle = '#f5c542'; c.fillRect(x - 1.2, y + h - 6.5, w + 2.4, 1.6); }
      else { const bc = k === 'frost' ? ['#f2f8ff', '#c8dcf0'] : ['#3f9a4a', '#2c7a3a']; for(const [ox, oy, r, ci] of [[-4, -3, 5, 1], [4, -3, 5, 1], [0, -6, 5.5, 0], [-5, -1, 4, 0], [5, -1, 4, 0]]){ c.fillStyle = bc[ci]; circ(c, cx + ox, y + h + oy, r); c.fill(); } }
      break;
    }
    case 'roller': {
      c.save(); c.translate(cx, y + h / 2); c.rotate(e.spin || 0);
      c.fillStyle = INK; for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a - 0.3) * 6, Math.sin(a - 0.3) * 6); c.lineTo(Math.cos(a) * 9.5, Math.sin(a) * 9.5); c.lineTo(Math.cos(a + 0.3) * 6, Math.sin(a + 0.3) * 6); c.fill(); }
      c.fillStyle = INK; circ(c, 0, 0, 7); c.fill(); c.fillStyle = flashCol(e, '#8a8f9c'); circ(c, 0, 0, 6.2); c.fill();
      c.fillStyle = '#b8bdc8'; c.fillRect(-6, -1, 12, 2); c.restore();
      eye(c, cx, y + h / 2, 2.2, EYE);
      break;
    }
    case 'rock': {
      if(e.st === 'warn'){ const sx = cx; c.fillStyle = 'rgba(255,255,255,.7)'; for(let i = 0; i < 3; i++){ circ(c, sx - 5 + i * 5, G.cam.y + 4 + wrap(G.time * 30 + i * 4, 10), 1.2); c.fill(); } if(Math.floor(G.time * 8) % 2) outlined(c, '!', sx, G.cam.y + 18, 8, '#ff9a8a'); break; }
      c.save(); c.translate(cx, y + h / 2); c.rotate(e.spin || 0);
      c.fillStyle = INK; c.beginPath(); for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4, r = 8.8 + rng(e.id + i) * 1.2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
      c.fillStyle = flashCol(e, '#8a7a66'); c.beginPath(); for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4, r = 7.8 + rng(e.id + i) * 1.2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill();
      c.fillStyle = '#b4a48c'; circ(c, -2.5, -2.5, 2.6); c.fill(); c.strokeStyle = '#5a4c3c'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(1, -5); c.lineTo(3, 0); c.lineTo(0, 4); c.stroke();
      c.restore(); break;
    }
    case 'tank': {
      const tr = e.tread || 0;
      c.fillStyle = INK; rr(c, x - 1, y + 13, w + 2, 11, 5); c.fill(); c.fillStyle = '#3c3f4a'; rr(c, x, y + 14, w, 9, 4.5); c.fill();
      c.fillStyle = MET2; for(let i = 0; i < 5; i++){ circ(c, x + 5 + i * 8, y + 18.5, 2.8); c.fill(); }
      c.fillStyle = '#5a5f6c'; for(let i = 0; i < 9; i++){ const tx = x + 1 + wrap(i * 5 - tr * f, 44); if(tx < x + w - 2) c.fillRect(tx, y + 13.6, 2, 1.4); }
      c.fillStyle = INK; rr(c, x + 3, y + 5, w - 6, 10, 3); c.fill(); c.fillStyle = flashCol(e, '#6a8f5a'); rr(c, x + 4, y + 6, w - 8, 8, 2.5); c.fill();
      c.fillStyle = '#4a6f3a'; c.fillRect(x + 4, y + 11, w - 8, 3);
      c.fillStyle = INK; rr(c, cx + f * 10 - (f < 0 ? 16 : 0), y + 5.5, 16, 4.4, 1.5); c.fill(); c.fillStyle = MET3; c.fillRect(cx + f * 10 - (f < 0 ? 15 : -1), y + 6.3, 14, 2.8);
      c.fillStyle = INK; rr(c, cx - 8, y - 1, 16, 8, 3); c.fill(); c.fillStyle = flashCol(e, '#7fa56a'); rr(c, cx - 7.2, y - 0.2, 14.4, 6.4, 2.5); c.fill();
      eye(c, cx + f * 3, y + 2.8, 1.8, EYE);
      if(e.st === 'shoot'){ c.fillStyle = 'rgba(255,230,160,.9)'; circ(c, cx + f * 27, y + 7.7, 3); c.fill(); }
      break;
    }
    case 'jetbot': {
      const by = y + (e.bob || 0);
      c.fillStyle = 'rgba(255,190,90,.9)'; c.beginPath(); c.moveTo(cx - f * 5 - 2, by + 14); c.lineTo(cx - f * 5, by + 20 + Math.random() * 4); c.lineTo(cx - f * 5 + 2, by + 14); c.fill();
      c.fillStyle = INK; rr(c, cx - f * 5 - 3, by + 5, 6, 10, 2); c.fill(); c.fillStyle = MET3; rr(c, cx - f * 5 - 2.2, by + 5.8, 4.4, 8.4, 1.5); c.fill();
      c.fillStyle = INK; rr(c, x + 1, by + 6, w - 2, 10, 3); c.fill(); c.fillStyle = flashCol(e, '#e07ac0'); rr(c, x + 1.8, by + 6.8, w - 3.6, 8.4, 2.5); c.fill();
      c.fillStyle = INK; circ(c, cx, by + 4, 5.2); c.fill(); c.fillStyle = flashCol(e, MET); circ(c, cx, by + 4, 4.4); c.fill();
      eye(c, cx + f * 1.8, by + 3.8, 1.8, EYE);
      c.fillStyle = INK; rr(c, cx + f * 3 - (f < 0 ? 8 : 0), by + 10, 8, 3, 1); c.fill();
      break;
    }
    case 'walker': {
      const ph = (e.walk || 0) * 0.3, s1 = Math.sin(ph) * 3, s2 = -s1;
      for(const [ox, sw] of [[-5, s2], [5, s1]]){ c.strokeStyle = INK; c.lineWidth = 5; c.beginPath(); c.moveTo(cx + ox, y + 17); c.lineTo(cx + ox - f * 3, y + 23); c.lineTo(cx + ox + sw, y + h - 1.5); c.stroke(); c.strokeStyle = '#8a3040'; c.lineWidth = 3.2; c.stroke(); c.fillStyle = INK; rr(c, cx + ox + sw - 4, y + h - 3, 8, 3, 1); c.fill(); }
      c.fillStyle = INK; rr(c, x, y + 3, w, 16, 4); c.fill(); c.fillStyle = flashCol(e, '#c24a5a'); rr(c, x + 1, y + 4, w - 2, 14, 3.5); c.fill();
      c.fillStyle = '#e8707e'; c.fillRect(x + 2, y + 5, w - 4, 2);
      c.fillStyle = INK; c.fillRect(cx - 6 + f * 3, y + 8, 12, 4); c.fillStyle = EYE2; c.fillRect(cx - 5 + f * 3, y + 9, 10, 2);
      c.fillStyle = INK; rr(c, cx + f * 8 - (f < 0 ? 12 : 0), y + 10, 12, 4.4, 1.5); c.fill(); c.fillStyle = MET2; c.fillRect(cx + f * 8 - (f < 0 ? 11 : -1), y + 10.8, 10, 2.8);
      break;
    }
    case 'saucer': {
      c.fillStyle = INK; ell(c, cx, y + 6, 10, 4.5); c.fill(); c.fillStyle = flashCol(e, MET); ell(c, cx, y + 6, 9, 3.6); c.fill();
      c.fillStyle = INK; ell(c, cx, y + 3.5, 5, 4); c.fill(); c.fillStyle = 'rgba(130,230,255,.9)'; ell(c, cx, y + 3.5, 4.2, 3.2); c.fill();
      c.fillStyle = Math.floor(G.time * 8 + e.id) % 2 ? EYE : EYE2; for(let i = -1; i <= 1; i++){ circ(c, cx + i * 5, y + 7, 1); c.fill(); }
      break;
    }
    case 'missile': {
      if(e.st === 'warn'){ if(Math.floor(G.time * 10) % 2){ const sx = G.cam.x + VW - 12; c.fillStyle = 'rgba(255,60,90,.85)'; c.beginPath(); c.moveTo(sx + 8, y - 6); c.lineTo(sx + 8, y + 14); c.lineTo(sx - 4, y + 4); c.fill(); outlined(c, '!', sx + 4, y + 4, 7, '#fff'); } break; }
      const ang = e.sub === 'homing' ? (e.ang !== undefined ? e.ang : Math.atan2(e.vy || 0, e.vx || -1)) : Math.PI;
      c.save(); c.translate(cx, y + h / 2); c.rotate(ang);
      c.fillStyle = 'rgba(255,190,90,.9)'; c.beginPath(); c.moveTo(-8, -2.5); c.lineTo(-14 - Math.random() * 6, 0); c.lineTo(-8, 2.5); c.fill();
      c.fillStyle = INK; rr(c, -9, -4, 18, 8, 3.5); c.fill(); c.fillStyle = flashCol(e, '#d8dde6'); rr(c, -8, -3.2, 16, 6.4, 3); c.fill();
      c.fillStyle = EYE; c.beginPath(); c.moveTo(4, -3.2); c.lineTo(10, 0); c.lineTo(4, 3.2); c.fill();
      c.fillStyle = MET3; c.beginPath(); c.moveTo(-8, -3); c.lineTo(-11, -6); c.lineTo(-5, -3); c.moveTo(-8, 3); c.lineTo(-11, 6); c.lineTo(-5, 3); c.fill();
      c.restore(); break;
    }
    case 'barge': {
      c.fillStyle = 'rgba(40,40,60,.35)'; for(const px of [x + 5, x + w - 5]){ ell(c, px, y + h + 2, 6 + Math.sin(G.time * 40) * 1.5, 1.4); c.fill(); }
      c.fillStyle = INK; rr(c, x, y + 6, w, 12, 3); c.fill(); c.fillStyle = flashCol(e, '#7a86a6'); rr(c, x + 1, y + 7, w - 2, 10, 2.5); c.fill();
      c.fillStyle = '#f5c542'; c.fillRect(x + 1, y + 13, w - 2, 2); c.fillStyle = INK; for(let i = 0; i < 8; i++) c.fillRect(x + 2 + i * 4.3, y + 13, 2, 2);
      c.fillStyle = INK; c.beginPath(); c.arc(x + 10, y + 7, 6, Math.PI, 0); c.fill(); c.fillStyle = flashCol(e, '#b85a6a'); c.beginPath(); c.arc(x + 10, y + 7, 5, Math.PI, 0); c.fill();
      c.fillStyle = INK; c.fillRect(x - 2, y + 3, 10, 3); eye(c, x + 10, y + 4.5, 1.6, EYE2);
      break;
    }
    case 'mine': {
      c.fillStyle = INK; for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4 + G.time; c.beginPath(); c.moveTo(cx + Math.cos(a - 0.3) * 5, y + 7 + Math.sin(a - 0.3) * 5); c.lineTo(cx + Math.cos(a) * 9, y + 7 + Math.sin(a) * 9); c.lineTo(cx + Math.cos(a + 0.3) * 5, y + 7 + Math.sin(a + 0.3) * 5); c.fill(); }
      c.fillStyle = INK; circ(c, cx, y + 7, 6.2); c.fill(); c.fillStyle = flashCol(e, '#7a6a8a'); circ(c, cx, y + 7, 5.4); c.fill();
      c.fillStyle = Math.floor(G.time * 4 + e.id) % 2 ? EYE : '#5a2030'; circ(c, cx, y + 7, 1.8); c.fill();
      break;
    }
  }
}
function itemIcon(c, kind, x, y, s){
  s = s || 1;
  c.save(); c.translate(x, y); c.scale(s, s);
  const col = WEAPONS[kind] ? WEAPONS[kind].col : kind === 'shield' ? '#7fe3ff' : kind === 'nova' ? '#ffd45e' : kind === 'heart' ? '#ff5a6e' : '#fff';
  c.fillStyle = INK;
  if(kind === 'fan'){ c.fillStyle = col; for(let i = -1; i <= 1; i++){ c.save(); c.rotate(i * 0.45); rr(c, 0, -1, 5, 2, 1); c.fill(); c.restore(); } circ(c, 0, 0, 1.6); c.fill(); }
  else if(kind === 'beam'){ c.fillStyle = col; c.beginPath(); c.moveTo(1, -4.5); c.lineTo(-2.5, 0.5); c.lineTo(0, 0.5); c.lineTo(-1, 4.5); c.lineTo(2.8, -0.8); c.lineTo(0.3, -0.8); c.closePath(); c.fill(); }
  else if(kind === 'seek'){ c.strokeStyle = col; c.lineWidth = 1.2; circ(c, 0, 0, 3.6); c.stroke(); circ(c, 0, 0, 1.4); c.fillStyle = col; c.fill(); c.beginPath(); c.moveTo(-5, 0); c.lineTo(-3, 0); c.moveTo(3, 0); c.lineTo(5, 0); c.moveTo(0, -5); c.lineTo(0, -3); c.moveTo(0, 3); c.lineTo(0, 5); c.stroke(); }
  else if(kind === 'shield'){ c.fillStyle = col; c.beginPath(); c.moveTo(0, -4.5); c.lineTo(4, -2.8); c.lineTo(3.4, 1.5); c.lineTo(0, 4.6); c.lineTo(-3.4, 1.5); c.lineTo(-4, -2.8); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-0.6, -3, 1.2, 5.5); }
  else if(kind === 'nova'){ c.fillStyle = col; star5(c, 0, 0, 5, 2.2); c.fill(); }
  else if(kind === 'heart'){ heart(c, 0, 0.2, 3.6, col); }
  else { c.fillStyle = col; circ(c, 0, 0, 3); c.fill(); }
  c.restore();
}
function drawProp(c, e){
  const x = e.x, y = e.y, cx = x + e.w / 2;
  switch(e.k){
    case 'crusher': {
      const top = e.top, ext = e.ext;
      c.fillStyle = '#2b2d36'; c.fillRect(x + 6, top, 8, ext - top - 10);
      c.fillStyle = '#4a4d5a'; c.fillRect(x + 7, top, 2, ext - top - 10);
      c.fillStyle = INK; rr(c, x - 1, ext - 12, 22, 12, 2); c.fill();
      c.fillStyle = '#6c6f7a'; rr(c, x, ext - 11, 20, 10, 1.5); c.fill();
      c.fillStyle = '#f5c542'; c.fillRect(x, ext - 5, 20, 3); c.fillStyle = INK; for(let i = 0; i < 5; i++) c.fillRect(x + i * 4 + 1, ext - 5, 2, 3);
      c.fillStyle = e.st === 'warn' && Math.floor(G.time * 12) % 2 ? '#ff3b5c' : '#6a2030'; circ(c, x + 10, ext - 8, 1.6); c.fill();
      if(e.st === 'warn'){ c.fillStyle = 'rgba(255,60,90,.18)'; c.fillRect(x, ext, 20, e.floor - ext); }
      break;
    }
    case 'crate': {
      c.fillStyle = INK; rr(c, x - 0.5, y - 0.5, e.w + 1, e.h + 1, 2); c.fill();
      c.fillStyle = e.hf > 0 ? '#fff' : '#6a7a8a'; rr(c, x + 0.5, y + 0.5, e.w - 1, e.h - 1, 1.5); c.fill();
      c.fillStyle = '#8a9aaa'; c.fillRect(x + 1, y + 1, e.w - 2, 2); c.fillStyle = '#4a5664'; c.fillRect(x + 1, y + e.h - 3, e.w - 2, 2);
      const g = 0.5 + Math.sin(G.time * 4 + e.id) * 0.3;
      c.fillStyle = 'rgba(20,24,34,.9)'; rr(c, cx - 5, y + 3, 10, 8, 2); c.fill();
      if(e.item) itemIcon(c, e.item, cx, y + 7, 0.85); else outlined(c, '?', cx, y + 7.5, 6, 'rgba(255,230,120,' + (0.6 + g * 0.4) + ')');
      break;
    }
    case 'pod': {
      const wing = Math.sin(G.time * 18) * 2;
      c.fillStyle = INK; c.beginPath(); c.moveTo(cx - 3, y + 5); c.lineTo(cx - 12, y + 1 - wing); c.lineTo(cx - 10, y + 7); c.fill(); c.beginPath(); c.moveTo(cx + 3, y + 5); c.lineTo(cx + 12, y + 1 - wing); c.lineTo(cx + 10, y + 7); c.fill();
      c.fillStyle = '#c9ced8'; c.beginPath(); c.moveTo(cx - 3, y + 5); c.lineTo(cx - 11, y + 2 - wing); c.lineTo(cx - 9.5, y + 6); c.fill(); c.beginPath(); c.moveTo(cx + 3, y + 5); c.lineTo(cx + 11, y + 2 - wing); c.lineTo(cx + 9.5, y + 6); c.fill();
      c.fillStyle = INK; ell(c, cx, y + 6, 7, 5.5); c.fill(); c.fillStyle = e.hf > 0 ? '#fff' : '#ff8a3c'; ell(c, cx, y + 6, 6.2, 4.7); c.fill();
      c.fillStyle = '#ffd45e'; c.fillRect(cx - 6, y + 5, 12, 2);
      c.fillStyle = Math.floor(G.time * 6) % 2 ? '#fff' : '#ff3b5c'; circ(c, cx, y + 1.8, 1.4); c.fill();
      break;
    }
    case 'item': {
      if(e.t > 11 && Math.floor(G.time * 10) % 2) break;
      const bob = e.st === 'rest' || G.kind === 'fly' ? Math.sin(G.time * 4 + e.id) * 1.2 : 0;
      const col = WEAPONS[e.item] ? WEAPONS[e.item].col : e.item === 'shield' ? '#7fe3ff' : e.item === 'nova' ? '#ffd45e' : '#ff5a6e';
      const g = c.createRadialGradient(cx, y + 6 + bob, 1, cx, y + 6 + bob, 13); g.addColorStop(0, hexA(col.length === 7 ? col : '#ffffff', 0.5)); g.addColorStop(1, hexA(col.length === 7 ? col : '#ffffff', 0));
      c.fillStyle = g; c.fillRect(cx - 13, y - 7 + bob, 26, 26);
      c.fillStyle = INK; rr(c, x - 1, y - 1 + bob, e.w + 2, e.h + 2, 5); c.fill();
      c.fillStyle = '#e8ecf4'; rr(c, x, y + bob, e.w, e.h, 4.5); c.fill();
      c.fillStyle = col; rr(c, x, y + bob, e.w, 3.5, 2); c.fill(); rr(c, x, y + e.h - 3.5 + bob, e.w, 3.5, 2); c.fill();
      itemIcon(c, e.item, cx, y + 6 + bob, 0.9);
      break;
    }
    case 'mech':
      drawMech(c, x, y, 1, '#7aa8ff', 0, 1, 0, 0, false, false, true);
      if(Math.floor(G.time * 2) % 2) outlined(c, 'HOP IN!', cx, y - 8 + Math.sin(G.time * 4) * 1.5, 4.5, '#ffd45e');
      break;
    case 'check': {
      const on = e.st === 'on';
      c.fillStyle = INK; c.fillRect(cx - 1.5, y, 3, 40); c.fillStyle = '#8d94a3'; c.fillRect(cx - 0.8, y, 1.6, 40);
      c.fillStyle = INK; rr(c, cx - 5, y + 34, 10, 6, 1.5); c.fill(); c.fillStyle = '#5a6070'; rr(c, cx - 4.2, y + 34.8, 8.4, 4.4, 1); c.fill();
      c.fillStyle = on ? '#7dff8a' : '#ff5a6e'; circ(c, cx, y + 1, 2.8); c.fill();
      if(on){ c.strokeStyle = 'rgba(125,255,138,.6)'; c.lineWidth = 1; const r = 5 + wrap(G.time * 12, 10); c.globalAlpha = 1 - r / 15; circ(c, cx, y + 1, r); c.stroke(); c.globalAlpha = 1;
        c.fillStyle = '#7dff8a'; c.beginPath(); c.moveTo(cx + 1.5, y + 5); c.lineTo(cx + 12 + Math.sin(G.time * 6) * 1, y + 8); c.lineTo(cx + 1.5, y + 11); c.fill(); }
      break;
    }
    case 'gear': {
      const g = c.createRadialGradient(cx, y + 6, 1, cx, y + 6, 12); g.addColorStop(0, 'rgba(255,220,100,.6)'); g.addColorStop(1, 'rgba(255,220,100,0)'); c.fillStyle = g; c.fillRect(cx - 12, y - 6, 24, 24);
      c.fillStyle = INK; gearShape(c, cx, y + 6, 7, 5, 8, G.time * 2); c.fill();
      c.fillStyle = '#ffd45e'; gearShape(c, cx, y + 6, 6, 4.2, 8, G.time * 2); c.fill();
      c.fillStyle = '#b8861a'; circ(c, cx, y + 6, 1.8); c.fill();
      break;
    }
  }
}

/* ---------- Bosses ---------- */
const hitC = (e, i, col) => e.phf && e.phf[i] > 0 ? '#ffffff' : col;
function smoke(c, x, y){ for(let i = 0; i < 3; i++){ const t = wrap(G.time * 0.9 + i * 0.33, 1); c.fillStyle = 'rgba(60,60,70,' + (0.5 - t * 0.5) + ')'; circ(c, x + Math.sin(i * 3 + G.time) * 3, y - t * 18, 2.5 + t * 5); c.fill(); } }
function drawBoss(c, e){
  const x = e.x, y = e.y, v = e.v || [0, 0, 0, 0, 0, 0, 0, 0], ph = e.ph;
  c.lineJoin = 'round';
  if(e.st === 'defeat' && Math.floor(G.time * 16) % 2) c.globalAlpha = 0.7;
  switch(e.bw){
    case 0: {   // GATEKEEPER
      c.fillStyle = INK; c.fillRect(x + 11, y - 6, 76, 168);
      for(let r = 0; r < 11; r++) for(let q = 0; q < 5; q++){ const bx = x + 12 + q * 15 - (r % 2) * 7, by = y + r * 14.6; if(bx < x + 12){ continue; } c.fillStyle = (r * 5 + q) % 3 ? '#8e8a78' : '#7d7968'; c.fillRect(bx, by, 14, 13.6); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(bx, by, 14, 1.4); }
      c.fillStyle = '#8e8a78'; c.fillRect(x + 12, y + 2, 5, 150);
      for(let i = 0; i < 5; i++){ c.fillStyle = INK; c.fillRect(x + 12 + i * 15, y - 14, 11, 10); c.fillStyle = '#a19c88'; c.fillRect(x + 13 + i * 15, y - 13, 9, 8); }
      c.strokeStyle = '#3f8a45'; c.lineWidth = 2; for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(x + 16 + i * 18, y - 4); c.quadraticCurveTo(x + 12 + i * 18 + Math.sin(G.time + i) * 2, y + 30 + i * 9, x + 18 + i * 18, y + 50 + i * 14); c.stroke(); }
      c.fillStyle = Math.floor(G.time * 3) % 2 ? '#ff3b5c' : '#6a2030'; for(const lx of [x + 30, x + 66]){ circ(c, lx, y - 17, 2.4); c.fill(); }
      for(let i = 0; i < 2; i++){
        const cy = y + (i ? 93 : 41);
        if(ph[i] > 0){
          const rc = v[1 + i] * 4;
          c.fillStyle = INK; rr(c, x - 4 + rc, cy - 4.5, 22, 9, 2); c.fill(); c.fillStyle = hitC(e, i, '#5a6070'); rr(c, x - 3 + rc, cy - 3.5, 20, 7, 1.5); c.fill();
          c.fillStyle = INK; circ(c, x + 20, cy, 10); c.fill(); c.fillStyle = hitC(e, i, '#b8484a'); circ(c, x + 20, cy, 8.8); c.fill();
          c.fillStyle = '#e07a6a'; circ(c, x + 17, cy - 3, 3); c.fill(); c.fillStyle = EYE2; circ(c, x + 21, cy + 1, 2); c.fill();
        } else { c.fillStyle = INK; circ(c, x + 20, cy, 9); c.fill(); c.fillStyle = '#3a3230'; circ(c, x + 20, cy, 7.5); c.fill(); smoke(c, x + 16, cy - 6); }
      }
      const dx = x + 10, dy = y + 118, open = v[0];
      c.fillStyle = INK; c.fillRect(dx - 2, dy - 4, 36, 46); c.fillStyle = '#2a2230'; c.fillRect(dx, dy, 32, 42);
      if(ph[2] > 0){
        const g = c.createRadialGradient(dx + 16, dy + 22, 2, dx + 16, dy + 22, 18); g.addColorStop(0, e.phf[2] > 0 ? '#fff' : '#ffe0a0'); g.addColorStop(0.35, '#ff3b5c'); g.addColorStop(1, 'rgba(120,20,40,.2)');
        c.fillStyle = g; circ(c, dx + 16, dy + 22, 14); c.fill(); c.fillStyle = INK; ell(c, dx + 16, dy + 22, 3, 7); c.fill();
      } else smoke(c, dx + 16, dy + 20);
      const sh = 21 * (1 - open);
      c.fillStyle = '#6c6f7a'; c.fillRect(dx, dy, 32, sh); c.fillRect(dx, dy + 42 - sh, 32, sh);
      c.fillStyle = '#f5c542'; if(sh > 3){ c.fillRect(dx, dy + sh - 3, 32, 3); c.fillRect(dx, dy + 42 - sh, 32, 3); }
      break;
    }
    case 1: {   // BOULDER BOT
      const la = y + 34 - v[1] * 20, ra = y + 34 - v[2] * 20;
      const arm = (sx, sy, fx2, fy, i) => {
        c.strokeStyle = INK; c.lineWidth = 11; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(fx2, fy); c.stroke();
        c.strokeStyle = '#7a6a56'; c.lineWidth = 8.5; c.stroke(); c.lineCap = 'butt';
        c.fillStyle = INK; circ(c, fx2, fy, 13.5); c.fill(); c.fillStyle = hitC(e, i, '#9a8a74'); circ(c, fx2, fy, 12.2); c.fill();
        c.fillStyle = '#b8a890'; circ(c, fx2 - 3, fy - 4, 4); c.fill(); c.strokeStyle = '#ff9a3c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(fx2 - 6, fy + 3); c.lineTo(fx2 + 2, fy + 6); c.lineTo(fx2 + 7, fy - 1); c.stroke();
      };
      if(ph[0] > 0) arm(x + 12, y + 44, x - 14, la + 12, 0); else smoke(c, x + 8, y + 42);
      if(ph[1] > 0) arm(x + 84, y + 44, x + 110, ra + 12, 1); else smoke(c, x + 88, y + 42);
      c.fillStyle = INK; ell(c, x + 48, y + 52, 48, 26); c.fill(); c.fillStyle = '#8a7a66'; ell(c, x + 48, y + 52, 46, 24); c.fill();
      c.fillStyle = '#6f604e'; ell(c, x + 48, y + 60, 40, 14); c.fill();
      c.strokeStyle = '#ff8a3c'; c.lineWidth = 1.4; c.globalAlpha = 0.6 + Math.sin(G.time * 4) * 0.3;
      c.beginPath(); c.moveTo(x + 20, y + 44); c.lineTo(x + 30, y + 54); c.lineTo(x + 26, y + 66); c.moveTo(x + 70, y + 42); c.lineTo(x + 64, y + 56); c.lineTo(x + 76, y + 64); c.stroke(); c.globalAlpha = e.st === 'defeat' && Math.floor(G.time * 16) % 2 ? 0.7 : 1;
      // belly furnace: the weak spot, its doors swing open while it roars (or once both arms are gone)
      const fo = (ph[0] <= 0 && ph[1] <= 0) ? 1 : v[3], fx3 = x + 34, fy3 = y + 60;
      c.fillStyle = INK; rr(c, fx3 - 2, fy3 - 2, 32, 20, 4); c.fill();
      if(ph[2] > 0){ const g = c.createRadialGradient(fx3 + 14, fy3 + 8, 1, fx3 + 14, fy3 + 8, 16); g.addColorStop(0, e.phf[2] > 0 ? '#fff' : '#fff3c0'); g.addColorStop(0.45, '#ff6a3c'); g.addColorStop(1, '#5a1a10'); c.fillStyle = g; c.fillRect(fx3, fy3, 28, 16); }
      else smoke(c, fx3 + 14, fy3 + 4);
      c.fillStyle = '#5a4c3c'; c.fillRect(fx3, fy3, 14 * (1 - fo), 16); c.fillRect(fx3 + 28 - 14 * (1 - fo), fy3, 14 * (1 - fo), 16);
      c.fillStyle = '#3a3028'; for(let i = 0; i < 3; i++){ c.fillRect(fx3, fy3 + 3 + i * 5, 14 * (1 - fo), 1.2); c.fillRect(fx3 + 28 - 14 * (1 - fo), fy3 + 3 + i * 5, 14 * (1 - fo), 1.2); }
      c.fillStyle = INK; rr(c, x + 27, y + 3, 42, 37, 9); c.fill(); c.fillStyle = '#a4947c'; rr(c, x + 28.5, y + 4.5, 39, 34, 8); c.fill();
      c.fillStyle = '#c2b298'; rr(c, x + 31, y + 6, 20, 6, 3); c.fill();
      c.fillStyle = INK; c.fillRect(x + 32, y + 13, 32, 8); c.fillStyle = EYE2; circ(c, x + 40, y + 17, 3); c.fill(); circ(c, x + 56, y + 17, 3); c.fill();
      const mo = v[3] * 9;
      c.fillStyle = INK; rr(c, x + 36, y + 25, 24, 4 + mo, 2); c.fill();
      if(mo > 1){ const g = c.createRadialGradient(x + 48, y + 27 + mo / 2, 1, x + 48, y + 27 + mo / 2, 12); g.addColorStop(0, '#fff3c0'); g.addColorStop(0.5, '#ff6a3c'); g.addColorStop(1, 'rgba(255,60,60,0)'); c.fillStyle = g; c.fillRect(x + 37, y + 26, 22, 2 + mo); }
      c.fillStyle = '#e8dcc4'; for(let i = 0; i < 4; i++) c.fillRect(x + 38 + i * 5.5, y + 25, 3, 2.4);
      break;
    }
    case 2: {   // SNOWPLOW
      const tr = v[0];
      c.fillStyle = INK; rr(c, x + 6, y + 28, 92, 18, 8); c.fill(); c.fillStyle = '#34384a'; rr(c, x + 7, y + 29, 90, 16, 7.5); c.fill();
      c.fillStyle = '#6a7090'; for(let i = 0; i < 7; i++){ circ(c, x + 14 + i * 13, y + 37, 4.5); c.fill(); }
      c.fillStyle = '#9aa0b8'; for(let i = 0; i < 18; i++){ const tx = x + 8 + wrap(i * 5.2 + tr, 90); c.fillRect(tx, y + 29, 2.2, 1.6); }
      c.fillStyle = INK; rr(c, x + 11, y + 10, 86, 22, 4); c.fill(); c.fillStyle = '#5a7fb8'; rr(c, x + 12, y + 11, 84, 20, 3.5); c.fill();
      c.fillStyle = '#ffffff'; rr(c, x + 12, y + 10, 84, 4, 2); c.fill(); for(let i = 0; i < 6; i++){ c.beginPath(); c.moveTo(x + 16 + i * 14, y + 14); c.lineTo(x + 18 + i * 14, y + 18); c.lineTo(x + 20 + i * 14, y + 14); c.fill(); }
      c.fillStyle = '#3f5f94'; c.fillRect(x + 20, y + 22, 70, 3);
      c.fillStyle = INK; c.beginPath(); c.moveTo(x - 8, y + 20); c.lineTo(x + 16, y + 16); c.lineTo(x + 18, y + 46); c.lineTo(x - 10, y + 46); c.closePath(); c.fill();
      c.save(); c.beginPath(); c.moveTo(x - 6, y + 21.5); c.lineTo(x + 15, y + 17.5); c.lineTo(x + 16.5, y + 44.5); c.lineTo(x - 8, y + 44.5); c.closePath(); c.clip();
      c.fillStyle = '#f5c542'; c.fillRect(x - 10, y + 8, 28, 40); c.fillStyle = INK; for(let i = -2; i < 8; i++){ c.beginPath(); c.moveTo(x - 10, y + 8 + i * 8); c.lineTo(x + 20, y + 8 + i * 8 + 12); c.lineTo(x + 20, y + 8 + i * 8 + 16); c.lineTo(x - 10, y + 8 + i * 8 + 4); c.fill(); } c.restore();
      if(ph[1] > 0){ c.save(); c.translate(x + 30, y + 10); c.rotate(-2.4 + v[1] * 0.1); c.fillStyle = INK; rr(c, -1, -3.5, 20 - v[1] * 4, 7, 2); c.fill(); c.fillStyle = hitC(e, 1, '#7a809a'); c.fillRect(0, -2.5, 18 - v[1] * 4, 5); c.restore(); c.fillStyle = INK; circ(c, x + 30, y + 10, 6); c.fill(); c.fillStyle = hitC(e, 1, '#5a6070'); circ(c, x + 30, y + 10, 5); c.fill(); }
      else smoke(c, x + 30, y + 6);
      c.fillStyle = INK; c.fillRect(x + 60, y - 16, 1.4, 10); c.fillStyle = '#ff5470'; c.fillRect(x + 61.4, y - 16, 6, 4);
      c.fillStyle = INK; c.beginPath(); c.arc(x + 61, y + 12, 19, Math.PI, 0); c.lineTo(x + 80, y + 14); c.lineTo(x + 42, y + 14); c.fill();
      c.fillStyle = e.phf[0] > 0 ? '#ffffff' : 'rgba(160,220,255,.85)'; c.beginPath(); c.arc(x + 61, y + 12, 17.5, Math.PI, 0); c.fill();
      c.fillStyle = '#c9ced8'; circ(c, x + 61, y + 3, 7); c.fill(); eye(c, x + 57.5, y + 2.5, 2.4, EYE);
      c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(x + 61, y + 12, 14, Math.PI * 1.15, Math.PI * 1.45); c.lineTo(x + 61, y + 12); c.fill();
      c.fillStyle = INK; c.fillRect(x + 86, y - 2, 5, 13); c.fillStyle = '#6a7090'; c.fillRect(x + 87, y - 1, 3, 11);
      if(v[2] > 0 || e.st === 'charge') smoke(c, x + 88, y - 4);
      if(e.st === 'rev' && Math.floor(G.time * 10) % 2){ c.fillStyle = 'rgba(255,60,90,.9)'; circ(c, x + 4, y + 4, 2.5); c.fill(); }
      break;
    }
    case 3: {   // MEGA CLAW
      const X0 = x0(), cy = y + 30 + v[0];
      c.fillStyle = INK; c.fillRect(X0, 32, VW, 5); c.fillStyle = '#5c616d'; c.fillRect(X0, 33, VW, 3); c.fillStyle = '#8a8f9c'; for(let i = 0; i < 24; i++) c.fillRect(X0 + i * 16 + 6, 33.5, 2, 2);
      if(e.st === 'aim' && Math.floor(G.time * 10) % 2){ c.fillStyle = 'rgba(255,60,90,.45)'; ell(c, x, 191, 18, 3); c.fill(); }
      else { c.fillStyle = 'rgba(0,0,0,.25)'; ell(c, x, 191, 12 + v[0] * 0.05, 2.5); c.fill(); }
      c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 4, y + 26); c.lineTo(x - 4, cy - 20); c.moveTo(x + 4, y + 26); c.lineTo(x + 4, cy - 20); c.stroke();
      c.strokeStyle = '#8a8f9c'; c.lineWidth = 1.4; c.stroke();
      const op = v[1];
      c.fillStyle = INK; rr(c, x - 14, cy - 24, 28, 12, 3); c.fill(); c.fillStyle = '#6c6f7a'; rr(c, x - 13, cy - 23, 26, 10, 2.5); c.fill();
      for(const sgn of [-1, 0, 1]){
        c.save(); c.translate(x + sgn * 9, cy - 13); c.rotate(sgn * (0.2 + op * 0.5));
        c.fillStyle = INK; c.beginPath(); c.moveTo(-3.5, 0); c.lineTo(3.5, 0); c.lineTo(2.5, 10); c.lineTo(sgn * 4, 14); c.lineTo(-2.5, 10); c.closePath(); c.fill();
        c.fillStyle = '#9aa0ac'; c.beginPath(); c.moveTo(-2.5, 0.5); c.lineTo(2.5, 0.5); c.lineTo(1.6, 9.5); c.lineTo(sgn * 3.4, 12.5); c.lineTo(-1.6, 9.5); c.closePath(); c.fill();
        c.restore();
      }
      c.fillStyle = INK; rr(c, x - 23, y - 1, 46, 30, 5); c.fill(); c.fillStyle = '#f5c542'; rr(c, x - 22, y, 44, 28, 4.5); c.fill();
      c.fillStyle = INK; for(let i = 0; i < 6; i++){ c.beginPath(); c.moveTo(x - 22 + i * 8, y + 28); c.lineTo(x - 18 + i * 8, y + 22); c.lineTo(x - 14 + i * 8, y + 22); c.lineTo(x - 18 + i * 8, y + 28); c.fill(); }
      for(const [i, hx] of [[1, x - 26], [2, x + 14]]){ c.fillStyle = INK; rr(c, hx - 0.5, y + 5.5, 13, 13, 2); c.fill(); if(ph[i] > 0){ c.fillStyle = hitC(e, i, '#c24a5a'); rr(c, hx + 0.5, y + 6.5, 11, 11, 1.5); c.fill(); c.fillStyle = '#ffd45e'; c.fillRect(hx + 4, y + 10, 4, 4); } else smoke(c, hx + 6, y + 8); }
      if(v[2] > 0.1){ c.fillStyle = 'rgba(255,60,90,' + (0.35 + v[2] * 0.4 + Math.sin(G.time * 12) * 0.15) + ')'; rr(c, x - 21, y + 22, 42, 7, 3); c.fill(); }
      c.fillStyle = INK; circ(c, x, y + 20, 8); c.fill();
      if(v[2] > 0.1){ const g = c.createRadialGradient(x, y + 20, 1, x, y + 20, 8); g.addColorStop(0, e.phf[0] > 0 ? '#fff' : '#ffe0a0'); g.addColorStop(0.5, '#ff3b5c'); g.addColorStop(1, '#6a1020'); c.fillStyle = g; circ(c, x, y + 20, 7 * v[2]); c.fill(); }
      c.fillStyle = '#6c6f7a'; c.beginPath(); c.arc(x, y + 20, 7, Math.PI, Math.PI + Math.PI * (1 - v[2])); c.lineTo(x, y + 20); c.fill(); c.beginPath(); c.arc(x, y + 20, 7, 0, Math.PI * (1 - v[2])); c.lineTo(x, y + 20); c.fill();
      c.fillStyle = INK; c.fillRect(x - 8, y + 2, 16, 5); c.fillStyle = EYE; c.fillRect(x - 7, y + 3, 14, 3);
      break;
    }
    case 4: {   // THUNDERHULL
      const bob = 0;
      for(const py of [y + 18, y + 56]){ c.fillStyle = INK; c.fillRect(x + 100, py - 2, 10, 4); c.fillStyle = 'rgba(40,40,60,.45)'; ell(c, x + 112, py, 3, 12 + Math.sin(v[0] * 3) * 4); c.fill(); }
      c.fillStyle = INK; c.beginPath(); c.moveTo(x - 2, y + 37); c.quadraticCurveTo(x + 14, y + 8, x + 44, y + 10); c.lineTo(x + 104, y + 14); c.lineTo(x + 108, y + 60); c.lineTo(x + 44, y + 64); c.quadraticCurveTo(x + 14, y + 66, x - 2, y + 37); c.fill();
      c.fillStyle = '#4a4f66'; c.beginPath(); c.moveTo(x + 1, y + 37); c.quadraticCurveTo(x + 15, y + 10, x + 44, y + 12); c.lineTo(x + 102, y + 16); c.lineTo(x + 106, y + 58); c.lineTo(x + 44, y + 62); c.quadraticCurveTo(x + 15, y + 64, x + 1, y + 37); c.fill();
      c.fillStyle = '#6a7090'; c.fillRect(x + 30, y + 14, 70, 5); c.fillStyle = '#ff5470'; c.fillRect(x + 20, y + 44, 84, 4);
      c.fillStyle = '#ffd45e'; for(let i = 0; i < 6; i++) c.fillRect(x + 72 + (i % 3) * 9, y + 24 + Math.floor(i / 3) * 8, 5, 3);
      for(const [i, ty] of [[0, y + 9], [1, y + 65]]){
        if(ph[i] <= 0){ smoke(c, x + 20, ty); continue; }
        const P = targetPlayer(x + 20, ty), a = P ? Math.atan2(P.y + P.h / 2 - ty, P.x + P.w / 2 - (x + 20)) : Math.PI;
        c.save(); c.translate(x + 20, ty); c.rotate(a); c.fillStyle = INK; rr(c, 0, -2.6, 14, 5.2, 1.5); c.fill(); c.fillStyle = MET2; c.fillRect(1, -1.6, 12, 3.2); c.restore();
        c.fillStyle = INK; circ(c, x + 20, ty, 8); c.fill(); c.fillStyle = hitC(e, i, '#b85a6a'); circ(c, x + 20, ty, 7); c.fill(); eye(c, x + 18, ty - 1, 1.8, EYE2);
      }
      const pulse = 0.7 + Math.sin(G.time * 8) * 0.3;
      c.fillStyle = INK; circ(c, x + 56, y + 37, 11); c.fill();
      if(ph[2] > 0){ const g = c.createRadialGradient(x + 56, y + 37, 1, x + 56, y + 37, 10); g.addColorStop(0, e.phf[2] > 0 ? '#fff' : '#fff3c0'); g.addColorStop(0.45, 'rgba(255,140,60,' + pulse + ')'); g.addColorStop(1, '#6a2030'); c.fillStyle = g; circ(c, x + 56, y + 37, 9.5); c.fill(); }
      c.strokeStyle = '#8a8fa6'; c.lineWidth = 1.2; circ(c, x + 56, y + 37, 10.5); c.stroke();
      c.fillStyle = 'rgba(130,230,255,.85)'; c.beginPath(); c.moveTo(x + 8, y + 30); c.quadraticCurveTo(x + 14, y + 22, x + 26, y + 22); c.lineTo(x + 26, y + 32); c.closePath(); c.fill();
      break;
    }
    case 5: {   // GENERAL RUSTBOLT
      const X0 = x0(), fist = e.fist || [{ st: '' }, { st: '' }];
      for(let i = 0; i < 2; i++){
        const fs = fist[i] && fist[i].st;
        if(ph[i] > 0 && (fs === 'warn' || fs === 'lift') && Math.floor(G.time * 10) % 2){ c.fillStyle = 'rgba(255,60,90,.45)'; ell(c, v[i * 2], 191, 16, 3); c.fill(); }
      }
      if(v[5] === 1 && Math.floor(G.time * 14) % 2){ c.strokeStyle = 'rgba(255,60,90,.85)'; c.lineWidth = 1; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(X0, v[4]); c.lineTo(x + 40, v[4]); c.stroke(); c.setLineDash([]); }
      const sx = [x + 10, x + 118];
      for(let i = 0; i < 2; i++){
        const fx2 = v[i * 2], fy = v[i * 2 + 1];
        if(ph[i] <= 0) continue;
        c.strokeStyle = INK; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(sx[i], y + 40); c.quadraticCurveTo((sx[i] + fx2) / 2, Math.max(y + 40, fy) + 20, fx2, fy); c.stroke();
        c.strokeStyle = '#6a5f80'; c.lineWidth = 6.5; c.stroke();
        c.strokeStyle = '#473e58'; c.lineWidth = 6.5; c.setLineDash([2, 4]); c.stroke(); c.setLineDash([]); c.lineCap = 'butt';
      }
      c.fillStyle = INK; rr(c, x + 16, y + 22, 96, 100, 10); c.fill(); c.fillStyle = '#6a5f80'; rr(c, x + 18, y + 24, 92, 96, 9); c.fill();
      c.fillStyle = '#7d7194'; c.fillRect(x + 22, y + 28, 84, 6); c.fillStyle = '#574c6c'; c.fillRect(x + 24, y + 90, 16, 26); c.fillRect(x + 90, y + 90, 16, 26);
      c.fillStyle = '#231a2c'; c.fillRect(x + 46, y + 86, 36, 34); c.fillStyle = '#3a2f48'; for(let i = 0; i < 4; i++) c.fillRect(x + 48 + i * 9, y + 88, 4, 30);
      const dd = v[6] * 14;
      c.fillStyle = INK; rr(c, x + 44, y + 52, 40, 34, 4); c.fill();
      if(ph[2] > 0){ const g = c.createRadialGradient(x + 64, y + 69, 2, x + 64, y + 69, 16); g.addColorStop(0, e.phf[2] > 0 ? '#fff' : '#ffe0f0'); g.addColorStop(0.4, '#ff3b8a'); g.addColorStop(1, '#4a1030'); c.fillStyle = g; c.fillRect(x + 46, y + 54, 36, 30); }
      c.fillStyle = '#8a2238'; c.fillRect(x + 46 - dd, y + 54, 18, 30); c.fillRect(x + 64 + dd, y + 54, 18, 30);
      c.fillStyle = '#f5c542'; c.fillRect(x + 46 - dd, y + 67, 18, 3); c.fillRect(x + 64 + dd, y + 67, 18, 3);
      for(const px of [x + 10, x + 118]){ c.fillStyle = INK; circ(c, px, y + 34, 20); c.fill(); c.fillStyle = '#8a2238'; circ(c, px, y + 34, 18.5); c.fill(); c.fillStyle = '#b83a52'; circ(c, px - 5, y + 28, 7); c.fill(); c.fillStyle = '#f5c542'; for(let i = 0; i < 3; i++){ circ(c, px - 8 + i * 8, y + 44, 1.6); c.fill(); } }
      const hx = x + 38, hy = y - 12;
      c.fillStyle = INK; rr(c, hx - 1, hy - 1, 54, 40, 8); c.fill(); c.fillStyle = '#7d7194'; rr(c, hx, hy, 52, 38, 7.5); c.fill();
      const eyeCol = v[5] === 2 ? '#ffffff' : v[5] === 1 ? '#ff7a9a' : EYE;
      c.fillStyle = INK; rr(c, hx + 6, hy + 12, 40, 9, 3); c.fill();
      for(const ex of [hx + 16, hx + 36]){ const g = c.createRadialGradient(ex, hy + 16.5, 0.5, ex, hy + 16.5, 7); g.addColorStop(0, eyeCol); g.addColorStop(1, 'rgba(255,60,90,0)'); c.fillStyle = g; c.fillRect(ex - 7, hy + 9, 14, 15); c.fillStyle = eyeCol; circ(c, ex, hy + 16.5, 2.8); c.fill(); }
      c.fillStyle = '#f5c542'; rr(c, hx + 12, hy + 25, 28, 8, 2); c.fill(); c.fillStyle = INK; for(let i = 0; i < 6; i++) c.fillRect(hx + 14 + i * 4.3, hy + 25, 1.2, 8);
      c.fillStyle = INK; c.beginPath(); c.moveTo(hx - 6, hy + 4); c.lineTo(hx + 58, hy + 4); c.lineTo(hx + 50, hy - 6); c.quadraticCurveTo(hx + 26, hy - 18, hx + 2, hy - 6); c.closePath(); c.fill();
      c.fillStyle = '#8a2238'; c.beginPath(); c.moveTo(hx - 4, hy + 3); c.lineTo(hx + 56, hy + 3); c.lineTo(hx + 49, hy - 5); c.quadraticCurveTo(hx + 26, hy - 16, hx + 3, hy - 5); c.closePath(); c.fill();
      c.fillStyle = INK; c.fillRect(hx - 6, hy + 2, 64, 3.5);
      c.fillStyle = '#ffd45e'; gearShape(c, hx + 26, hy - 5, 5.5, 4, 8, G.time); c.fill(); c.fillStyle = '#8a2238'; circ(c, hx + 26, hy - 5, 1.8); c.fill();
      for(let i = 0; i < 2; i++){
        const fx2 = v[i * 2], fy = v[i * 2 + 1];
        if(ph[i] <= 0){ if(fy < 250) smoke(c, sx[i], y + 34); continue; }
        c.fillStyle = INK; rr(c, fx2 - 14, fy - 12, 28, 24, 5); c.fill(); c.fillStyle = hitC(e, i, '#8a2238'); rr(c, fx2 - 13, fy - 11, 26, 22, 4.5); c.fill();
        c.fillStyle = hitC(e, i, '#b83a52'); for(let k = 0; k < 4; k++) rr(c, fx2 - 12 + k * 6.2, fy + (fy > 150 ? 3 : -11), 5.4, 8, 2); c.fill();
        c.fillStyle = '#f5c542'; c.fillRect(fx2 - 13, fy - 1, 26, 2.4);
      }
      if(v[5] === 2){
        const ly = v[4], g = c.createLinearGradient(0, ly - 6, 0, ly + 6); g.addColorStop(0, 'rgba(255,60,120,0)'); g.addColorStop(0.5, 'rgba(255,240,250,1)'); g.addColorStop(1, 'rgba(255,60,120,0)');
        c.fillStyle = g; c.fillRect(X0, ly - 6, x + 40 - X0, 12);
        c.strokeStyle = 'rgba(255,90,140,.8)'; c.lineWidth = 3; c.beginPath(); c.moveTo(hx + 16, hy + 16); c.lineTo(x + 40, ly); c.moveTo(hx + 36, hy + 16); c.lineTo(x + 40, ly); c.stroke();
      }
      break;
    }
  }
  c.globalAlpha = 1;
}

/* ---------- Shots ---------- */
function drawShots(c){
  for(const s of G.shots){
    const p = G.players.find(q => q.slot === s.owner), col = p ? p.color : '#fff3a8';
    if(s.k === 'beam'){
      const a = Math.atan2(s.vy, s.vx), L = 16 + (s.lv || 0) * 4, W = 2.6 + (s.lv || 0) * 0.9;
      c.save(); c.translate(s.x, s.y); c.rotate(a);
      c.fillStyle = 'rgba(127,227,255,.35)'; rr(c, -L, -W - 1.5, L + 3, W * 2 + 3, W + 1.5); c.fill();
      c.fillStyle = '#7fe3ff'; rr(c, -L + 1, -W, L + 1, W * 2, W); c.fill(); c.fillStyle = '#ffffff'; rr(c, -L + 3, -W * 0.4, L - 3, W * 0.8, W * 0.4); c.fill();
      c.restore();
    } else if(s.k === 'seek'){
      const a = Math.atan2(s.vy, s.vx);
      c.save(); c.translate(s.x, s.y); c.rotate(a);
      c.fillStyle = 'rgba(180,140,255,.4)'; c.fillRect(-12, -1, 8, 2);
      c.fillStyle = INK; rr(c, -5, -2.4, 9, 4.8, 2); c.fill(); c.fillStyle = '#b48cff'; rr(c, -4.2, -1.6, 7.6, 3.2, 1.5); c.fill(); c.fillStyle = '#fff'; c.fillRect(1.5, -1, 1.8, 2);
      c.restore();
    } else if(s.k === 'mech'){
      c.fillStyle = 'rgba(255,170,60,.4)'; circ(c, s.x, s.y, 6.5); c.fill(); c.fillStyle = '#ffb347'; circ(c, s.x, s.y, 4); c.fill(); c.fillStyle = '#fff3c0'; circ(c, s.x, s.y, 2); c.fill();
    } else {
      const cc = s.k === 'fan' ? '#ff8a5c' : col;
      c.fillStyle = hexA(cc.length === 7 ? cc : '#ffffff', 0.35); circ(c, s.x, s.y, 4.2); c.fill();
      c.fillStyle = cc; circ(c, s.x, s.y, 2.7); c.fill(); c.fillStyle = '#ffffff'; circ(c, s.x, s.y, 1.3); c.fill();
    }
  }
  for(const s of G.eshots){
    if(s.k === 'orb'){
      const pu = 1 + Math.sin(G.time * 18 + s.id) * 0.15;
      c.fillStyle = 'rgba(255,60,110,.3)'; circ(c, s.x, s.y, 5 * pu); c.fill(); c.fillStyle = '#ff4a7a'; circ(c, s.x, s.y, 3.2); c.fill(); c.fillStyle = '#fff0f4'; circ(c, s.x, s.y, 1.5); c.fill();
    } else if(s.k === 'bomb'){
      c.fillStyle = INK; circ(c, s.x, s.y, 4.4); c.fill(); c.fillStyle = '#3a3346'; circ(c, s.x, s.y, 3.6); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; circ(c, s.x - 1.2, s.y - 1.2, 1.2); c.fill();
      c.fillStyle = Math.floor(G.time * 16) % 2 ? '#ffd45e' : '#ff5a3c'; circ(c, s.x + 2, s.y - 4, 1.4); c.fill();
    } else if(s.k === 'shell'){
      c.fillStyle = INK; rr(c, s.x - 5, s.y - 2.8, 10, 5.6, 2.5); c.fill(); c.fillStyle = '#c9ced8'; rr(c, s.x - 4.2, s.y - 2, 8.4, 4, 2); c.fill(); c.fillStyle = '#ff9a3c'; c.fillRect(s.x + (s.vx > 0 ? -5 : 3), s.y - 1, 2, 2);
    } else if(s.k === 'ice'){
      c.fillStyle = '#bfefff'; for(let i = 0; i < 3; i++){ c.beginPath(); c.moveTo(s.x - 7 + i * 5, s.y + 6); c.lineTo(s.x - 5 + i * 5, s.y - 6 - (i === 1 ? 4 : 0)); c.lineTo(s.x - 2 + i * 5, s.y + 6); c.fill(); }
      c.fillStyle = '#ffffff'; c.fillRect(s.x - 5, s.y - 2, 1.2, 6);
    } else if(s.k === 'scrap'){
      c.fillStyle = INK; gearShape(c, s.x, s.y, 5, 3.6, 6, G.time * 6); c.fill(); c.fillStyle = '#a8703c'; gearShape(c, s.x, s.y, 4.2, 3, 6, G.time * 6); c.fill();
      c.fillStyle = Math.floor(G.time * 16) % 2 ? '#ffd45e' : '#ff5a3c'; circ(c, s.x, s.y, 1.3); c.fill();
    }
  }
}

/* ---------- HUD and overlays ---------- */
function drawChip(c, p, x, y, w){
  c.fillStyle = 'rgba(10,8,24,.62)'; rr(c, x, y, w, 18, 4); c.fill();
  c.fillStyle = p.color; rr(c, x, y, 3, 18, 1.5); c.fill();
  const nm = p.name.toUpperCase(), sz = fitText(c, nm, w - 34, 4.6);
  text(c, nm, x + 6, y + 5.5, sz, p.out || p.sos || p.away ? '#a9a6c0' : '#fff6e0', 'left', 'middle');
  if(p.sos){ if(Math.floor(G.time * 3) % 2) text(c, 'SOS', x + 6, y + 13, 4.4, '#ff9a8a', 'left', 'middle'); }
  else if(p.out){ text(c, 'WARPING…', x + 6, y + 13, 4.2, '#7fe3ff', 'left', 'middle'); }
  else if(p.away){ text(c, 'AWAY', x + 6, y + 13, 4.2, '#a9a6c0', 'left', 'middle'); }
  else if(p.mech){ for(let j = 0; j < 6; j++){ c.fillStyle = j < p.mech ? '#ffb347' : 'rgba(255,255,255,.18)'; c.fillRect(x + 6 + j * 5, y + 11.5, 4, 3); } }
  else for(let j = 0; j < p.maxHp; j++) heart(c, x + 8 + j * 6.5, y + 12.5, 2.3, j < p.hp ? '#ff5a6e' : 'rgba(255,255,255,.2)');
  c.fillStyle = 'rgba(255,255,255,.1)'; rr(c, x + w - 25, y + 2.5, 13, 13, 3); c.fill();
  itemIcon(c, G.kind === 'fly' || !p.mech ? p.weapon : 'blaster', x + w - 18.5, y + 9, 0.95);
  for(let j = 0; j < 3; j++){ c.fillStyle = j < p.wlv ? (WEAPONS[p.weapon] || WEAPONS.blaster).col : 'rgba(255,255,255,.2)'; circ(c, x + w - 6.5, y + 4.5 + j * 4.5, 1.4); c.fill(); }
  if(p.shield > 0){ c.strokeStyle = '#7fe3ff'; c.lineWidth = 1; rr(c, x + 0.5, y + 0.5, w - 1, 17, 4); c.stroke(); }
}
function drawHUD(c){
  const n = G.players.length, bottom = n >= 3;
  const g = c.createLinearGradient(0, 0, 0, 22); g.addColorStop(0, 'rgba(10,8,24,.5)'); g.addColorStop(1, 'rgba(10,8,24,0)'); c.fillStyle = g; c.fillRect(0, 0, VW, 22);
  if(bottom){ const w = 90; G.players.forEach((p, i) => drawChip(c, p, 4 + i * (w + 4), VH - 21, w)); }
  else G.players.forEach((p, i) => drawChip(c, p, 4 + i * 110, 3, 106));
  outlined(c, String(G.score).padStart(7, '0'), VW - 8, 8, 7, '#fff6e0', 'right');
  if(hasLives()){
    drawHelmet(c, VW - 34, 19, 1, '#f5c542', 3.2);
    outlined(c, '×' + Math.max(0, G.lives), VW - 28, 19.5, 5.5, '#fff6e0', 'left');
  } else outlined(c, 'KIDS', VW - 8, 19.5, 5, '#7dff8a', 'right');
  if(G.gotGear){ c.fillStyle = '#ffd45e'; gearShape(c, VW - 52, 19, 3.6, 2.6, 7, G.time); c.fill(); }
  if(G.combo >= 4 && G.comboT > 0) outlined(c, 'COMBO ×' + Math.min(5, 1 + Math.floor(G.combo / 4)), VW - 8, 30, 5, hue(G.time * 200, 90, 70), 'right');
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.st !== 'defeat' && boss.pm){
    const tot = boss.pm.reduce((a, b) => a + b, 0), cur = boss.ph.reduce((a, b) => a + b, 0);
    const bw = 150, bx = VW / 2 - bw / 2, by = bottom ? 12 : 30;
    c.fillStyle = 'rgba(10,8,24,.7)'; rr(c, bx - 4, by - 9, bw + 8, 17, 4); c.fill();
    outlined(c, boss.name, VW / 2, by - 4, 4.5, '#ff9a8a');
    c.fillStyle = 'rgba(255,255,255,.15)'; rr(c, bx, by + 1, bw, 4, 2); c.fill();
    c.fillStyle = '#ff5a6e'; rr(c, bx, by + 1, bw * cur / tot, 4, 2); c.fill();
  }
  if(!A.Input.isTouch && G.state === 'play' && G.lvT < 5 && G.net !== 'guest' && !bottom) text(c, 'PAUSE: START / ESC', 8, VH - 10, 4.5, 'rgba(255,255,255,.55)');
  // heroes off the top of the screen get a marker
  for(const p of G.players){
    if(p.out || p.sos) continue;
    if(p.y + p.h < G.cam.y + 2){ const sx = p.x + p.w / 2 - G.cam.x; c.fillStyle = p.color; c.beginPath(); c.moveTo(sx, 24); c.lineTo(sx - 3.5, 29); c.lineTo(sx + 3.5, 29); c.fill(); }
  }
}
function drawIntro(c){
  const def = G.def, t = G.stateT, len = G.introLen || 2.8;
  const a = Math.min(1, t * 5) * Math.min(1, Math.max(0, (len - t) / 0.35));
  c.globalAlpha = a;
  c.fillStyle = 'rgba(12,10,28,.84)'; c.fillRect(0, 0, VW, VH);
  c.fillStyle = '#f5c542'; c.fillRect(0, 44, VW * Math.min(1, t * 2), 2); c.fillRect(VW - VW * Math.min(1, t * 2), 132, VW * Math.min(1, t * 2), 2);
  outlined(c, 'STAGE ' + def.code, VW / 2, 58, 8, '#ffd45e');
  outlined(c, def.name.toUpperCase(), VW / 2, 80, fitText(c, def.name.toUpperCase(), VW - 40, 15), '#fff6e0');
  outlined(c, def.fact, VW / 2, 100, fitText(c, def.fact, VW - 30, 5), '#9fe8d7');
  outlined(c, 'BOSS: ' + BOSS_NAMES[def.boss], VW / 2, 114, 4.5, '#ff9a8a');
  const n = G.players.length;
  G.players.forEach((p, i) => {
    const cx = VW / 2 - (n - 1) * 30 + i * 60;
    const fake = Object.assign({}, p, { x: cx - 5, y: 170 - STAND_H, h: STAND_H, w: PW, onGround: true, vx: 0, inv: 0, out: 0, sos: false, dropIn: 0, face: 1, ax: 1, ay: 0, shield: 0, crouch: false, dive: false, spin: false, mech: 0, runT: 0, shotT: 0, hurtT: 0 });
    if(G.kind === 'fly'){ fake.w = 16; fake.h = 12; fake.y = 158; fake.x = cx - 8; }
    c.save(); drawHero(c, fake); c.restore(); c.globalAlpha = a;
    const nm = p.name.toUpperCase(); outlined(c, nm, cx, 180, fitText(c, nm, 56, 5), p.color);
  });
  if(hasLives()){ drawHelmet(c, VW / 2 - 12, 200, 1, '#f5c542', 3.6); outlined(c, '× ' + G.lives, VW / 2 + 4, 200.5, 7, '#fff6e0'); }
  else outlined(c, 'KIDS MODE · NO GAME OVER', VW / 2, 200, 5, '#7dff8a');
  c.globalAlpha = 1;
}
function drawWarn(c){
  const t = G.stateT, a = Math.min(1, t * 4) * Math.min(1, Math.max(0, (2.6 - t) / 0.4));
  if(a <= 0) return;
  c.globalAlpha = a;
  const on = Math.floor(t * 4) % 2 === 0;
  for(const by of [70, 116]){
    c.fillStyle = on ? 'rgba(255,40,70,.85)' : 'rgba(140,10,30,.85)'; c.fillRect(0, by, VW, 14);
    c.fillStyle = 'rgba(0,0,0,.35)'; for(let i = -1; i < 26; i++){ const x = i * 18 + wrap(t * 60 * (by > 100 ? -1 : 1), 18); c.beginPath(); c.moveTo(x, by); c.lineTo(x + 9, by); c.lineTo(x + 3, by + 14); c.lineTo(x - 6, by + 14); c.fill(); }
  }
  outlined(c, 'WARNING!', VW / 2, 99, 14, on ? '#fff' : '#ffb0be');
  outlined(c, G.def.boss !== undefined ? BOSS_NAMES[G.def.boss] + ' APPROACHING' : '', VW / 2, 147, 6, '#ffd45e');
  c.globalAlpha = 1;
}
function drawClear(c){
  const msg = 'STAGE CLEAR!', t = G.stateT, n = msg.length, size = 14;
  c.font = size + 'px ' + FONT; const wAll = c.measureText(msg).width;
  let x = VW / 2 - wAll / 2;
  for(let i = 0; i < n; i++){
    const ch = msg[i], cw = c.measureText(ch).width;
    const appear = Math.max(0, Math.min(1, (t * 12 - i) / 2));
    if(appear > 0) outlined(c, ch, x + cw / 2, 66 - Math.sin(Math.min(1, appear) * Math.PI) * 8 + Math.sin(G.time * 5 + i * 0.6) * 1.5, size, hue(i * 25 + G.time * 90, 90, 68));
    x += cw;
  }
  if(t > 0.8){ outlined(c, 'SCORE ' + G.score.toLocaleString(), VW / 2, 90, 6, '#fff6e0'); outlined(c, 'TIME ' + fmt(G.lvT), VW / 2, 102, 5, '#9fe8d7'); }
  if(t > 1.4){
    const n2 = G.players.length;
    G.players.forEach((p, i) => { const cx = VW / 2 - (n2 - 1) * 40 + i * 80; outlined(c, p.name.toUpperCase(), cx, 122, fitText(c, p.name.toUpperCase(), 70, 5), p.color); const r = rankOf(p); outlined(c, r, cx, 138, 12, r === 'S' ? '#ffd45e' : r === 'A' ? '#7dff8a' : '#fff6e0'); });
  }
}
function drawEnding(c){
  const t = G.stateT;
  if(t > 1 && t < 7){ outlined(c, 'MISSION COMPLETE!', VW / 2, 22, 11, hue(G.time * 80, 90, 72)); outlined(c, 'THE SKY CRYSTAL IS HOME', VW / 2, 38, 6, '#fff6e0'); }
  if(t > 2.4 && t < 7) outlined(c, 'An xRetro original · art, levels & music made in code', VW / 2, 206, 4.2, '#4a3a6a');
}
function drawNames(c){
  if(G.players.length < 2 || G.demo) return;
  for(const p of G.players){
    if(p.out || p.sos) continue;
    const top = G.kind === 'fly' ? p.y - 24 : p.mech ? p.y - 12 : p.y - 9;
    const nm = p.name.toUpperCase();
    outlined(c, nm, p.x + p.w / 2, top, fitText(c, nm, 40, 4), p.color);
  }
}
function drawParts(c){
  for(const p of parts){
    const a = 1 - p.t / p.life;
    if(p.kind === 'text'){ c.globalAlpha = Math.min(1, a * 2); outlined(c, p.str, p.x, p.y, p.size || 5, p.col); }
    else if(p.kind === 'chunk'){ c.globalAlpha = a; c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.8); c.restore(); }
    else if(p.kind === 'bolt'){ c.globalAlpha = a; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-2.5, -0.9, 5, 1.8); c.fillRect(-3, -1.8, 1.8, 3.6); c.restore(); }
    else if(p.kind === 'spring'){ c.globalAlpha = a; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.strokeStyle = p.col; c.lineWidth = 0.9; c.beginPath(); for(let i = 0; i < 5; i++){ c.lineTo(-3 + i * 1.5, i % 2 ? -2 : 2); } c.stroke(); c.restore(); }
    else if(p.kind === 'star'){ c.globalAlpha = a; c.fillStyle = p.col; star5(c, p.x, p.y, p.r * 1.4, p.r * 0.55); c.fill(); }
    else if(p.kind === 'ring'){ c.globalAlpha = a; c.strokeStyle = p.col; c.lineWidth = 2 * a + 0.5; circ(c, p.x, p.y, p.r * (0.4 + (1 - a) * 1.2)); c.stroke(); }
    else if(p.kind === 'warp'){ c.globalAlpha = a; const g = c.createLinearGradient(p.x - 8, 0, p.x + 8, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, p.col); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(p.x - 8 * a, G.cam.y, 16 * a, p.y - G.cam.y + 20); c.fillStyle = '#fff'; c.fillRect(p.x - 1.5 * a, G.cam.y, 3 * a, p.y - G.cam.y + 20); }
    else if(p.kind === 'nova'){ c.globalAlpha = a; c.strokeStyle = '#ffd45e'; c.lineWidth = 8 * a; circ(c, p.x, p.y, (1 - a) * 320); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 3 * a; circ(c, p.x, p.y, (1 - a) * 300); c.stroke(); }
    else { c.globalAlpha = a; c.fillStyle = p.col; circ(c, p.x, p.y, p.r * (0.5 + a * 0.5)); c.fill(); }
  }
  c.globalAlpha = 1;
}

function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  if(!G.map && G.kind !== 'fly' && G.kind !== 'ending') return;
  const paused = G.state === 'paused' || G.state === 'results' || G.state === 'gameover';
  if(!paused) fxStep(Math.min(dt, 0.05));
  let shx = 0, shy = 0;
  if(G.shake > 0){ G.shake = Math.max(0, G.shake - dt); shx = (Math.random() - 0.5) * 8 * G.shake; shy = (Math.random() - 0.5) * 6 * G.shake; }
  const camX = Math.round((G.cam.x + shx) * s) / s, camY = Math.round((G.cam.y + shy) * s) / s;
  c.setTransform(s, 0, 0, s, 0, 0);
  drawBG(c, camX, camY);
  const world = () => c.setTransform(s, 0, 0, s, -camX * s, -camY * s);
  if(G.kind !== 'fly' && G.kind !== 'ending'){ c.setTransform(1, 0, 0, 1, 0, 0); drawTiles(c, camX, camY, s); }
  world();
  if(G.kind !== 'fly' && G.kind !== 'ending') drawLiveTiles(c, camX, camY, false);
  const boss = G.ents.find(e => e.k === 'boss');
  for(const e of G.ents) if(e.k === 'check' || e.k === 'mech' || e.k === 'crate' || e.k === 'gear') drawProp(c, e);
  if(boss && boss.bw !== 3) drawBoss(c, boss);
  for(const e of G.ents){
    if(e.k === 'check' || e.k === 'mech' || e.k === 'crate' || e.k === 'gear' || e.k === 'boss') continue;
    if(e.k === 'crusher' || e.k === 'pod' || e.k === 'item') drawProp(c, e); else drawFoe(c, e);
  }
  const order = G.players.slice().sort((a, b) => (a.sos ? 1 : 0) - (b.sos ? 1 : 0));
  for(const p of order) drawHero(c, p);
  if(boss && boss.bw === 3) drawBoss(c, boss);
  drawShots(c);
  if(G.kind !== 'fly' && G.kind !== 'ending') drawLiveTiles(c, camX, camY, true);
  drawParts(c);
  drawNames(c);
  c.setTransform(s, 0, 0, s, 0, 0);
  drawWeather(c, camX, camY);
  if(G.flash > 0){ G.flash = Math.max(0, G.flash - dt); c.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, G.flash * 1.6) + ')'; c.fillRect(0, 0, VW, VH); }
  if(G.state === 'ending') drawEnding(c);
  else if(!G.demo) drawHUD(c);
  if(G.state === 'intro') drawIntro(c);
  if(G.state === 'warn') drawWarn(c);
  if(G.state === 'clear') drawClear(c);
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.32)'; c.fillRect(0, 0, VW, VH); }
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('FIRE');
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
window.__strike = G;
window.__strikeDebug = { STAGES, buildLevel, loadLevel, newGame, sim, step, startIntro, startClear, results, ending, bossStart, makeBoss, mkEnt, hurt, knockOut,
  giveItem, respawn, damagePart, BOSS, tileAt, camera, gameOver, SKY_WAVES, drawHero, Net };
})();
