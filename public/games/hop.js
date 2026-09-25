/* HOP HERO — a side-scrolling platform adventure for 1–4 players on one shared screen, or online.
   Run with the D-pad, FIRE jumps (hold it to jump higher), Down + FIRE throws sparks once you
   have a Zap Flower. Bop enemies, grab the goal pole high, and if you get hit with friends
   around you float back in a bubble. All characters, levels, music and sounds are original. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants ---------- */
const VW = 384, VH = 216, T = 16, ROWS = 14, LH = ROWS * T;
const FONT = '"Silkscreen","Courier New",monospace';
const WALK = 88, RUN = 142, ACC = 440, AIR_ACC = 330, SKID = 950, FRICTION = 560;
const JUMP = 322, G_HOLD = 720, G_FALL = 1500, MAX_FALL = 430, STOMP_V = 250, STOMP_HOLD = 345, SPRING_V = 475;
const SMALL_H = 15, BIG_H = 24;
const SOLID = new Set(['#', 'X', 'B', '?', 'M', '*', 'L', 'U', 'c']);
const isSolid = ch => SOLID.has(ch);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

const DIFF = {
  kids:   { label: 'Kids',   lives: Infinity, pitBounce: true,  spikeBounce: true,  enemy: 0.72, bossHp: 2, startBig: true },
  normal: { label: 'Normal', lives: 5,        pitBounce: false, spikeBounce: false, enemy: 1.0,  bossHp: 3, startBig: false },
  pro:    { label: 'Pro',    lives: 3,        pitBounce: false, spikeBounce: false, enemy: 1.28, bossHp: 4, startBig: false }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];

/* ---------- Music: every world has its own original theme ---------- */
const MEADOW_THEME = {
  bpm: 144, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'], bass: 'pulse', arp: 'slow', leadVol: 0.07,
  lead: [
    'E5 - G5 - C6 - G5 - A5 - G5 - E5 - D5 -', 'C5 - - - E5 - A5 - - - G5 - E5 - C5 -',
    'F5 - A5 - C6 - A5 - F5 - G5 - A5 - C6 -', 'B5 - - - G5 - D5 - G5 - - - . . D5 -',
    'E5 - C5 - E5 - G5 - C6 - - - B5 - C6 -', 'A5 - - - G5 - E5 - C5 - E5 - A5 - G5 -',
    'F5 - E5 - D5 - F5 - A5 - - - G5 - F5 -', 'D5 - E5 - F5 - G5 - - - - - . . G4 -'],
  drums: ['k...h.k.s...h...', 'k...h.k.s...h.k.', 'k...h.k.s...h...', 'k.h.h.k.s.h.sss.']
};
const CAVE_THEME = {
  bpm: 112, chords: ['Fmaj7', 'C', 'Dm', 'Bb', 'Fmaj7', 'C', 'Bb', 'C'], bass: 'walk', arp: 'slow', leadWave: 'triangle', leadVol: 0.1,
  lead: [
    'A5 - - - C6 - - - E6 - - - C6 - - -', 'G5 - - - E5 - - - G5 - C6 - - - - -',
    'F5 - - - A5 - - - D6 - - - C6 - A5 -', 'Bb5 - - - A5 - - - F5 - - - - - - -',
    'C6 - A5 - F5 - A5 - C6 - - - E6 - - -', 'E6 - - - D6 - C6 - G5 - - - - - . .',
    'D6 - - - C6 - Bb5 - A5 - - - G5 - - -', 'G5 - - - - - - - E5 - F5 - G5 - - -'],
  drums: ['k.......s.......', 'k.....k.s.....h.']
};
const SKY_THEME = {
  bpm: 150, chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G', 'A'], bass: 'drive', arp: 'fast', leadVol: 0.065,
  lead: [
    'F#5 - A5 - D6 - - - A5 - F#5 - A5 - D6 -', 'E6 - - - C#6 - A5 - E5 - - - A5 - C#6 -',
    'D6 - - - B5 - F#5 - B5 - D6 - F#6 - - -', 'E6 - D6 - B5 - G5 - B5 - - - . . G5 -',
    'A5 - D6 - F#6 - - - E6 - D6 - A5 - F#5 -', 'E5 - A5 - C#6 - - - E6 - - - C#6 - A5 -',
    'B5 - - - G5 - B5 - D6 - - - E6 - - -', 'E6 - - - - - - - C#6 - - - E6 - - -'],
  drums: ['k.h.s.h.k.h.s.hh', 'k.h.s.h.k.hks.h.']
};
const BOSS_THEME = {
  bpm: 166, chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'], bass: 'gallop', arp: 'fast', leadVol: 0.07,
  lead: [
    'A5 - . A5 C6 - A5 - E6 - - - D6 - C6 -', 'B5 - A5 - G5 - A5 - - - . . E5 - - -',
    'F5 - A5 - C6 - F6 - E6 - - - C6 - A5 -', 'G5 - B5 - D6 - G6 - F6 - - - D6 - B5 -',
    'A5 - . A5 C6 - A5 - E6 - - - D6 - C6 -', 'C6 - B5 - A5 - E5 - - - . . A4 - - -',
    'F5 - - - A5 - - - C6 - - - F6 - - -', 'G#5 - - - B5 - - - E6 - - - - - - -'],
  drums: ['k.hsk.hsk.hsk.ss', 'kkhsk.hskkhsk.hs']
};
const STAR_THEME = {
  bpm: 184, chords: ['C', 'F', 'C', 'G'], bass: 'drive', arp: 'fast', leadVol: 0.07,
  lead: [
    'C6 - G5 - C6 - E6 - G6 - E6 - C6 - G5 -', 'A5 - C6 - F6 - C6 - A5 - C6 - F6 - A6 -',
    'G5 - C6 - E6 - C6 - G5 - C6 - E6 - G6 -', 'G6 - F6 - D6 - B5 - G5 - B5 - D6 - F6 -'],
  drums: ['k.hsk.hsk.hsk.hs']
};
const ENDING_THEME = {
  bpm: 108, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], bass: 'walk', arp: 'slow', leadVol: 0.08,
  lead: [
    'E5 - - - D5 - C5 - D5 - - - G4 - - -', 'B4 - - - D5 - G5 - - - F5 - E5 - D5 -',
    'C5 - - - E5 - A5 - - - G5 - E5 - C5 -', 'F5 - - - A5 - C6 - - - A5 - G5 - F5 -',
    'E5 - G5 - C6 - - - D6 - C6 - B5 - G5 -', 'D6 - - - B5 - G5 - - - G5 - A5 - B5 -',
    'C6 - - - A5 - F5 - - - A5 - G5 - F5 -', 'E5 - - - - - - - C5 - - - - - - -'],
  drums: ['k...h...s...h...', 'k...h...s...h.k.']
};

/* ---------- Worlds ---------- */
const WORLDS = [
  { key: 'meadow', name: 'Meadow', sky: ['#56b0ff', '#c4ecff'], far: '#a8e28f', near: '#6cc566', music: MEADOW_THEME,
    g: { top: '#5fd35b', topHi: '#b3f58a', topDk: '#3a9a45', fill: '#bb7442', fillDk: '#8f5431', fillHi: '#d8925c', speck: '#8a522e' },
    brick: ['#e27a42', '#a9502a', '#ffae76'], stone: ['#c2ae90', '#8d7a62', '#e8dcc6'], plat: ['#a8693b', '#6f4424', '#63d85e'],
    spike: ['#eef3f8', '#98a4b5'], used: ['#a07c56', '#6d5238'],
    nut: ['#cf8a4c', '#7a4b2a'], shell: ['#4cbc5c', '#2d8a3f'], prick: ['#78b84f', '#eef7c8'], frog: ['#5fcf6a', '#2f9447'] },
  { key: 'caves', name: 'Crystal Caves', ceiling: true, sky: ['#120a26', '#34205c'], far: '#241646', near: '#2f1c58', music: CAVE_THEME,
    g: { top: '#43e2c9', topHi: '#b2fff2', topDk: '#1f9c93', fill: '#4b3579', fillDk: '#34245a', fillHi: '#6c50a4', speck: '#2c1c4a' },
    brick: ['#9c61d8', '#6a3ca2', '#cfa2ff'], stone: ['#726c93', '#4c4769', '#a19bc0'], plat: ['#73e3ff', '#2f8fb8', '#d4f9ff'],
    spike: ['#a4f5ff', '#3aa6c8'], used: ['#5c4c7a', '#3c3057'],
    nut: ['#9d8be0', '#4d3f93'], shell: ['#3bc6c0', '#1f8a86'], prick: ['#3aa7c9', '#c6f8ff'], frog: ['#5aa6ff', '#2c63c4'] },
  { key: 'sky', name: 'Sky Castle', sky: ['#3043b3', '#ffa3d0'], far: '#7b70d2', near: '#ffffff', music: SKY_THEME,
    g: { top: '#ffd45e', topHi: '#fff3b8', topDk: '#d7a232', fill: '#ece5f7', fillDk: '#c3b7de', fillHi: '#ffffff', speck: '#b6a8d4' },
    brick: ['#f3c3dd', '#c98cb0', '#ffe8f3'], stone: ['#cbc3e2', '#9c93c2', '#f1ecff'], plat: ['#ffffff', '#d5d8f6', '#ffffff'],
    spike: ['#ffd45e', '#c78d1c'], used: ['#bbb0d8', '#8d83b3'],
    nut: ['#f2b8d4', '#a86f97'], shell: ['#a98bf2', '#6d52c2'], prick: ['#8d86cc', '#ffe07a'], frog: ['#ff8fc0', '#c9508a'] }
];

/* ---------- Level pieces ----------
   Rows are bottom-aligned (the last two rows are the ground). Legend:
   # ground   X stone   B brick   ? coin block   M power block   * star block   L extra-life block
   o coin   = one-way ledge   ^ spikes   c crumbling block   T spring   - moving platform   | lift
   w Nutlet (walker)   k Clonk (shell)   f Buzzbee (flier)   s Prickle (spiky)   h Boingo (hopper)
   @ start   C checkpoint   P goal pole   H house   Z boss */
const CH = {
  S: ['........', '........', '.@......', '########', '########'],
  blocks: ['........?...', '............', '............', '............', '..M...B?B?B.', '............', '............', '.........w..', '############', '############'],
  bricks: ['...B*BB.......', '..............', '..............', '..............', '.B?B......B?B.', '..............', '..............', '.......w..w...', '##############', '##############'],
  cols: ['..........XX..', '....XX....XX..', '....XX..w.XX..', '##############', '##############'],
  tallcols: ['.........XX...', '....XX...XX...', '....XX...XX...', '....XX.w.XX..w', '##############', '##############'],
  plats: ['...........ooo..', '...........===..', '................', '.....ooo........', '.....===........', '................', '................', '###..........###', '###..........###'],
  moving: ['...-..........', '..............', '..............', '##..........##', '##..........##'],
  lift: ['..............', '..............', '...|....|.....', '..............', '..............', '##..........##', '##..........##'],
  crumble: ['..............', '##cccccccccc##', '##..........##'],
  spring: ['.....oo.....', '....o..o....', '...o....o...', '............', '............', '............', '............', '............', '.....T......', '############', '############'],
  spikes: ['.....===......', '..............', '....^^^^^^....', '##############', '##############'],
  spikes2: ['...^^....^^^..', '##############', '##############'],
  fliers: ['..........f...', '..............', '.....f........', '..............', '......==......', '..............', '###........###', '###........###'],
  stairs: ['...XX..XX...', '..XXX..XXX..', '.XXXX..XXXX.', 'XXXXX..XXXXX', '#####..#####', '#####..#####'],
  END: ['...X....................', '..XX....................', '.XXX....................', 'XXXX......P.......H.....', '########################', '########################'],
  arena1: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
           'X......................X', 'X......................X', 'X...M..............M...X', 'X......................X', 'X......................X', 'X.@...............Z....X',
           '########################', '########################'],
  arena2: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
           'X......................X', 'X......................X', 'X...M..............M...X', 'X......................X', 'X......................X', 'X.@..............Z.....X',
           '########################', '########################'],
  arena3: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......M.........M.....X', 'X......................X',
           'X......................X', 'X......................X', 'X...=====......=====...X', 'X......................X', 'X......................X', 'X.@................Z...X',
           '########################', '########################']
};
/* A level is a list of pieces: F<n> flat ground (letters after the number are placed along it),
   G<n> gap (G3o = with a coin arc), R<h> raise the ground to h, C checkpoint, or a piece name. */
const LEVELS = [
  { w: 0, code: '1-1', name: 'Sunny Meadow', parts: 'S F8 blocks F6w R1 F4 R2 F6w R0 F6 G2 F6ww cols F4 G3o F6 C F6k F10ww bricks F4 R1 F3 R2 F3 R3 F5 R0 F4 G2 F5 spring F8w?w F4 END' },
  { w: 0, code: '1-2', name: 'Buttercup Hills', parts: 'S F6 F8?o R1 F4w R2 F4 R3 F6h R1 F6ww R0 F4 G3 F6k F12www plats F4 C F6 blocks R2 F8wh R0 F4 G3o F6h moving F6ww F2 R1 F2 R2 F2 R3 F6 R0 G2 F6L F4 END' },
  { w: 0, code: '1-3', name: 'Windmill Way', windmills: true, parts: 'S F6 F8f?f R2 F6w R0 G3 F4 crumble F6hh blocks F4 C F6 lift F8kw fliers F6h R1 F4 R2 F4w R0 moving F6hw stairs F6 END' },
  { w: 0, code: '1-B', name: 'Thornback’s Den', boss: 0, parts: 'arena1' },
  { w: 1, code: '2-1', name: 'Glimmer Grotto', parts: 'S F8 F8w?s spikes2 F6 G3 F6ww R1 F4 R2 F6s R0 F4 cols F6k C F10wsw plats F6s bricks F4 G3o F6 END' },
  { w: 1, code: '2-2', name: 'Echo Tunnels', parts: 'S F4 F8ss blocks G4 F6hh R2 F6w R0 spikes F4 C lift F6ks F4 moving F8w?h F4 R1 F3 R2 F3 R3 F4 R0 G3 F6 END' },
  { w: 1, code: '2-3', name: 'Geode Gorge', parts: 'S F6 crumble F6s plats F4 G4 F6hs spikes C F6 fliers F6kww moving F4 G3o R2 F6s R0 lift F4 tallcols F6L END' },
  { w: 1, code: '2-B', name: 'Crag Crab’s Lair', boss: 1, parts: 'arena2' },
  { w: 2, code: '3-1', name: 'Cloud Steps', parts: 'S F6 G3 F4w G3 F6 plats F4 moving F6ff F3T R5 F8w R2 F4 C F4 crumble F6hh G4 F6 lift F6 END' },
  { w: 2, code: '3-2', name: 'Rainbow Ramparts', parts: 'S F4 G2 F4 G3 F4h fliers F4 spikes2 C F4 lift F6ss moving F4 F3T R5 F6hw R3 F4 R1 F4 crumble F6k G4o F6 bricks stairs F4 END' },
  { w: 2, code: '3-3', name: 'Storm Tower', storm: true, parts: 'S F6 spikes F4 G4 F6hh moving plats C F6ss crumble F4 lift F6ff F3T R5 F6w R2 F4 fliers F6kk spikes2 G4o F6L stairs F4 END' },
  { w: 2, code: '3-B', name: 'Baron Grumble’s Throne', boss: 2, parts: 'arena3' }
];
const BOSS_NAMES = ['THORNBACK', 'CRAG CRAB', 'BARON GRUMBLE'];
const isBoss = ix => LEVELS[ix] && LEVELS[ix].boss !== undefined;
const ENT_CHARS = 'wkfshT-|CPHZ';

const BUILT = {};
function buildLevel(ix){
  if(BUILT[ix]) return BUILT[ix];
  const def = LEVELS[ix], world = WORLDS[def.w];
  const cols = [], ents = [];
  let h = 0, start = null;
  const emptyCol = () => new Array(ROWS).fill('.');
  const groundCol = () => { const c = emptyCol(); for(let r = 12 - h; r < ROWS; r++) c[r] = '#'; return c; };
  const place = (x, r, ch) => {
    if(r < 0 || r >= ROWS || !cols[x]) return;
    if(ch === '@'){ start = { tx: x, ty: r }; return; }
    if(ENT_CHARS.includes(ch)){ ents.push({ ch, tx: x, ty: r }); return; }
    cols[x][r] = ch;
  };
  for(const tok of def.parts.trim().split(/\s+/)){
    let m;
    if((m = /^F(\d+)(.*)$/.exec(tok))){
      const n = +m[1], ex = m[2], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(groundCol());
      for(let j = 0; j < ex.length; j++){
        const ch = ex[j], x = x0 + Math.floor(n * (j + 1) / (ex.length + 1));
        if('wkshT'.includes(ch)) place(x, 11 - h, ch);
        else if(ch === 'f') place(x, 8 - h, ch);
        else if(ch === 'o'){ for(let k = -1; k <= 1; k++) if(x + k >= x0 && x + k < x0 + n) place(x + k, 9 - h, 'o'); }
        else place(x, 8 - h, ch);
      }
    } else if((m = /^G(\d+)(o?)$/.exec(tok))){
      const n = +m[1], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(emptyCol());
      if(m[2]) for(let i = 0; i < n; i++) place(x0 + i, 9 - h - Math.round(Math.sin(Math.PI * (i + 0.5) / n) * 2), 'o');
    } else if((m = /^R(\d)$/.exec(tok))) h = +m[1];
    else if(tok === 'C'){ const x0 = cols.length; for(let i = 0; i < 4; i++) cols.push(groundCol()); place(x0 + 1, 11 - h, 'C'); }
    else if(CH[tok]){
      if(tok === 'END' || tok.startsWith('arena')) h = 0;
      const rows = CH[tok], n = rows.length, w = Math.max(...rows.map(r => r.length)), x0 = cols.length;
      for(let i = 0; i < w; i++) cols.push(emptyCol());
      for(let r = 0; r < n; r++){
        const row = ROWS - n + r - h;
        for(let i = 0; i < w; i++){ const ch = rows[r][i] || '.'; if(ch !== '.') place(x0 + i, row, ch); }
      }
      if(h > 0) for(let i = 0; i < w; i++) if(rows[n - 1][i] === '#') for(let r = ROWS - h; r < ROWS; r++) cols[x0 + i][r] = '#';
    }
  }
  if(world.ceiling) for(const c of cols) if(c[0] === '.') c[0] = '#';
  const W = cols.length, map = new Array(W * ROWS);
  for(let x = 0; x < W; x++) for(let r = 0; r < ROWS; r++) map[r * W + x] = cols[x][r];
  return (BUILT[ix] = { map, W, ents, start: start || { tx: 1, ty: 11 }, def, world });
}

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('hop.diff', 'normal'), lv: 0, startLv: 0,
  unlocked: Math.min(LEVELS.length - 1, A.Store.get('hop.unlocked', 0) | 0),
  players: [], roster: [], ents: [], map: null, W: 0, mods: [], world: WORLDS[0],
  cam: { x: 0, y: LH - VH }, score: 0, lives: 5, coins: 0, time: 0, stateT: 0, lvT: 0, introLen: 2.4,
  check: null, goalT: -1, wipeT: 0, loadN: 0, net: null, shake: 0, bumps: [], crumbles: new Map(),
  levelScore: 0, pole: null, house: null, god: false, demoT: 0, modsApplied: 0
};
if(!DIFF[G.diff]) G.diff = 'normal';
G.startLv = Math.min(G.unlocked, A.Store.get('hop.start', 0) | 0);
const D = () => DIFF[G.diff];
const hasLives = () => D().lives !== Infinity;

/* ---------- Sounds ---------- */
const SX = {
  jump:   s => s.tone({ wave: 'pulse25', f: 300, f2: 620, t: 0.13, v: 0.07 }),
  coin:   s => { s.tone({ wave: 'triangle', f: 1319, t: 0.05, v: 0.11 }); s.tone({ wave: 'triangle', f: 1976, t: 0.16, v: 0.11, at: 0.05 }); },
  stomp:  s => { s.tone({ f: 240, f2: 80, t: 0.1, v: 0.12 }); s.noise({ t: 0.07, v: 0.12, f: 1400, f2: 300 }); },
  bump:   s => s.tone({ wave: 'triangle', f: 170, f2: 110, t: 0.09, v: 0.2 }),
  kick:   s => { s.tone({ f: 640, f2: 260, t: 0.07, v: 0.1 }); s.noise({ t: 0.05, v: 0.1, f: 3500, f2: 800 }); },
  shrink: s => s.melody([[784, .06], [587, .06], [440, .06], [330, .1]], { wave: 'pulse25', v: 0.1 }),
  bubble: s => { s.tone({ wave: 'sine', f: 380, f2: 900, t: 0.26, v: 0.15 }); s.tone({ wave: 'sine', f: 620, f2: 1300, t: 0.2, v: 0.08, at: 0.09 }); },
  pop:    s => { s.tone({ wave: 'sine', f: 1300, f2: 320, t: 0.09, v: 0.15 }); s.noise({ t: 0.05, v: 0.08, f: 6000, type: 'highpass' }); },
  spring: s => s.tone({ wave: 'triangle', f: 190, f2: 950, t: 0.28, v: 0.15, vib: true }),
  boing:  s => s.tone({ wave: 'sine', f: 330, f2: 760, t: 0.13, v: 0.13 }),
  throw:  s => s.tone({ wave: 'pulse12', f: 900, f2: 1700, t: 0.08, v: 0.08 }),
  sprout: s => s.melody([[523, .05], [659, .05], [784, .05], [1047, .09]], { wave: 'triangle', v: 0.11 }),
  pole:   s => s.tone({ wave: 'pulse25', f: 1500, f2: 300, t: 0.75, v: 0.07 }),
  flag:   s => s.melody([[784, .07], [988, .07], [1175, .07], [1568, .16]], { wave: 'triangle', v: 0.12 }),
  die:    s => s.melody([[988, .08], [932, .08], [880, .08], [0, .12], [659, .12], [523, .12], [392, .28]], { wave: 'pulse25', v: 0.1 }),
  fanfare: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .22], [0, .05], [880, .1], [1047, .1], [1319, .4]], { v: 0.11 });
                  s.melody([[262, .32], [349, .32], [392, .4], [523, .5]], { wave: 'triangle', v: 0.15 }); },
  bossHit: s => { s.noise({ t: 0.3, v: 0.3, f: 2200, f2: 200 }); s.tone({ wave: 'sawtooth', f: 330, f2: 110, t: 0.3, v: 0.1 }); },
  land:   s => { s.noise({ t: 0.35, v: 0.35, f: 900, f2: 60 }); s.tone({ wave: 'sine', f: 90, f2: 40, t: 0.3, v: 0.25 }); },
  thunder: s => { s.noise({ t: 0.7, v: 0.35, f: 3000, f2: 90 }); s.tone({ wave: 'sawtooth', f: 120, f2: 40, t: 0.5, v: 0.1 }); },
  warn:   s => s.tone({ f: 1760, t: 0.05, v: 0.05 }),
  shard:  s => { s.tone({ wave: 'triangle', f: 2600, f2: 1700, t: 0.12, v: 0.08 }); s.noise({ t: 0.1, v: 0.1, f: 7000, type: 'highpass' }); },
  firework: s => { s.noise({ t: 0.5, v: 0.22, f: 2200, f2: 200 }); s.tone({ wave: 'triangle', f: 1400, f2: 500, t: 0.2, v: 0.04 }); },
  crumble: s => s.noise({ t: 0.25, v: 0.16, f: 1600, f2: 250 })
};
let netSfx = [], netFx = [];
function sfx(name){
  if(G.demo) return;
  const f = SX[name];
  if(f){ try{ f(A.Sound); }catch(e){} } else A.Sound.play(name);
  if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name);
}
function playNetSfx(n){ const f = SX[n]; if(f){ try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* ---------- Map helpers ---------- */
function tileAt(tx, ty){
  if(ty < 0) return '.';
  if(ty >= ROWS){ if(tx < 0 || tx >= G.W) return 'X'; return isSolid(G.map[(ROWS - 1) * G.W + tx]) ? '#' : '.'; }
  if(tx < 0 || tx >= G.W) return 'X';
  return G.map[ty * G.W + tx];
}
function setTile(tx, ty, ch){
  if(tx < 0 || tx >= G.W || ty < 0 || ty >= ROWS) return;
  const i = ty * G.W + tx; if(G.map[i] === ch) return;
  G.map[i] = ch; G.mods.push([i, ch]);
}
function rectSolid(b){
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T), y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
  for(let ty = y0; ty <= y1; ty++) for(let tx = x0; tx <= x1; tx++) if(isSolid(tileAt(tx, ty))) return true;
  return false;
}
function groundY(px){
  const tx = Math.floor(px / T);
  for(let r = 2; r < ROWS; r++) if(isSolid(tileAt(tx, r)) && !isSolid(tileAt(tx, r - 1))) return r * T;
  return 12 * T;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* Move a body through the tile map: X first, then Y. Sets onGround, hitWall and hitHead. */
function moveBody(b, dt, corner){
  b.hitWall = 0; b.hitHead = null;
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
  if(b.vy > 0){
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for(let tx = x0; tx <= x1; tx++){
      const ch = tileAt(tx, ty);
      if(isSolid(ch) || (ch === '=' && prevBottom <= ty * T + 0.5)){ b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break; }
    }
  } else if(b.vy < 0){
    const ty = Math.floor(b.y / T), hit = [];
    for(let tx = x0; tx <= x1; tx++) if(isSolid(tileAt(tx, ty))) hit.push(tx);
    if(hit.length){
      // corner correction: clipping the very edge of a block nudges you past it
      if(corner && hit.length === 1 && x0 !== x1){
        const tx = hit[0];
        if(tx === x0 && (tx + 1) * T - b.x <= 5 && !isSolid(tileAt(tx + 1, ty))){ b.x = (tx + 1) * T; return; }
        if(tx === x1 && b.x + b.w - tx * T <= 5 && !isSolid(tileAt(tx - 1, ty))){ b.x = tx * T - b.w; return; }
      }
      const cx = b.x + b.w / 2;
      let best = hit[0]; for(const tx of hit) if(Math.abs(tx * T + 8 - cx) < Math.abs(best * T + 8 - cx)) best = tx;
      b.y = (ty + 1) * T; b.vy = 0; b.hitHead = { tx: best, ty };
    }
  }
}

/* ---------- Entities ---------- */
let nextEnt = 1;
const SIZES = { walker: [12, 12], shell: [14, 13], flier: [12, 10], spiky: [12, 12], hopper: [14, 12], spark: [6, 6],
  grow: [12, 12], zap: [12, 12], star: [12, 12], life: [12, 12], spring: [16, 10], plat: [48, 8], lift: [32, 8],
  check: [16, 44], pole: [4, 160], house: [48, 40], shard: [8, 12], bolt: [10, 100], boss: [34, 26] };
const FOES = new Set(['walker', 'shell', 'flier', 'spiky', 'hopper']);
const ITEMS = new Set(['grow', 'zap', 'star', 'life']);
function mkEnt(k, x, y, o){
  const sz = SIZES[k] || [12, 12];
  const e = Object.assign({ id: nextEnt++, k, x, y, w: sz[0], h: sz[1], vx: 0, vy: 0, face: -1, st: '', t: 0, on: false, dead: 0 }, o);
  G.ents.push(e); return e;
}
function spawnFromMap(o){
  const bx = o.tx * T, by = (o.ty + 1) * T;
  const foot = (k, o2) => { const sz = SIZES[k]; return mkEnt(k, bx + (T - sz[0]) / 2, by - sz[1], o2); };
  switch(o.ch){
    case 'w': foot('walker', { st: 'walk' }); break;
    case 'k': foot('shell', { st: 'walk' }); break;
    case 's': foot('spiky', { st: 'walk' }); break;
    case 'h': foot('hopper', { st: 'sit', t: Math.random() }); break;
    case 'f': mkEnt('flier', bx + 2, o.ty * T + 3, { st: 'fly', bx: bx + 2, by: o.ty * T + 3, t: o.tx * 0.7 }); break;
    case 'T': mkEnt('spring', bx, by - 10, { on: true }); break;
    case '-': mkEnt('plat', bx, o.ty * T, { on: true, bx, by: o.ty * T, range: 6 * T, speed: 0.55, t: 0, dx: 0, dy: 0 }); break;
    case '|': mkEnt('lift', bx, o.ty * T, { on: true, bx, by: o.ty * T, range: 3 * T, speed: 1.1, t: o.tx * 0.9, dx: 0, dy: 0 }); break;
    case 'C': mkEnt('check', bx, by - 44, { on: true, st: G.check !== null && G.check >= bx ? 'got' : '' }); break;
    case 'P': G.pole = mkEnt('pole', bx + 6, 2 * T, { on: true, w: 4, h: by - 2 * T }); break;
    case 'H': G.house = mkEnt('house', bx - 16, by - 40, { on: true }); break;
    case 'Z': makeBoss(LEVELS[G.lv].boss, bx, by); break;
  }
}

/* ---------- Players ---------- */
function makeHero(o){
  return Object.assign({ slot: 0, source: null, name: 'Player', color: '#f5c542', x: 0, y: 0, w: 12, h: SMALL_H, vx: 0, vy: 0, face: 1,
    onGround: false, power: 0, inv: 0, star: 0, bubble: false, bubbleT: 0, dead: 0, done: 0, away: false,
    coyote: 0, buffer: 0, jumping: false, springy: false, runT: 0, runDir: 0, chain: 0, prevBottom: 0, plat: null,
    throwT: 0, growT: 0, squashT: 0, lc: 0, lb: 0, bot: false }, o);
}
function setPower(p, pw){
  const wasBig = p.power > 0, big = pw > 0;
  p.power = pw;
  if(big && !wasBig){ p.y -= BIG_H - SMALL_H; p.h = BIG_H; p.growT = 0.6; }
  else if(!big && wasBig){ p.y += BIG_H - SMALL_H; p.h = SMALL_H; p.growT = 0.6; }
}
const active = p => !p.bubble && !(p.dead > 0) && !p.done && !p.away;
function placePlayers(x0){
  G.players.forEach((p, i) => {
    Object.assign(p, { vx: 0, vy: 0, bubble: false, dead: 0, done: 0, inv: 0, star: 0, plat: null, chain: 0, jumping: false, springy: false, face: 1, botBest: 0, botStuck: 0, botHold: 0 });
    if(D().startBig && p.power === 0) setPower(p, 1);
    p.growT = 0;
    const x = x0 + i * 14;
    p.x = x; p.y = groundY(x + 6) - p.h; p.prevBottom = p.y + p.h; p.onGround = true;
  });
}

/* ---------- Particles and effects (cosmetic, run on every screen) ---------- */
let parts = [];
function fx(type, a, b, c, d){
  spawnFx(type, a, b, c, d);
  if(Net && Net.role === 'host' && netFx.length < 40) netFx.push([type, r1(a), r1(b), c === undefined ? null : c, d === undefined ? null : d]);
}
function spawnFx(type, x, y, arg, arg2){
  const R = Math.random;
  switch(type){
    case 'text': parts.push({ kind: 'text', x, y, vx: 0, vy: -34, g: 0, t: 0, life: 0.9, str: arg, col: arg2 || '#fff' }); break;
    case 'coin': parts.push({ kind: 'coin', x, y, vx: 0, vy: -230, g: 700, t: 0, life: 0.55 }); break;
    case 'poof': for(let i = 0; i < 7; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 80, vy: (R() - 0.7) * 60, g: 0, t: 0, life: 0.35 + R() * 0.2, col: 'rgba(255,255,255,.9)', r: 2 + R() * 2 }); break;
    case 'dust': for(let i = 0; i < 4; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 8, y, vx: (R() - 0.5) * 50, vy: -10 - R() * 20, g: 0, t: 0, life: 0.3, col: 'rgba(255,255,255,.7)', r: 1.5 + R() }); break;
    case 'brick': for(let i = 0; i < 4; i++) parts.push({ kind: 'chunk', x: x + (i % 2) * 8 - 4, y: y + (i > 1 ? 4 : -4), vx: (i % 2 ? 1 : -1) * (40 + R() * 30), vy: -200 - (i > 1 ? 0 : 80), g: 900, t: 0, life: 1.0, col: arg || '#e27a42', r: 5, rot: R() * 6 }); break;
    case 'shards': for(let i = 0; i < 6; i++) parts.push({ kind: 'chunk', x, y, vx: (R() - 0.5) * 140, vy: -80 - R() * 120, g: 800, t: 0, life: 0.7, col: arg || '#a4f5ff', r: 3, rot: R() * 6 }); break;
    case 'pop': for(let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, g: 0, t: 0, life: 0.3, col: 'rgba(210,240,255,.95)', r: 1.6 }); } break;
    case 'sparkle': for(let i = 0; i < 5; i++) parts.push({ kind: 'star', x: x + (R() - 0.5) * 12, y: y + (R() - 0.5) * 12, vx: (R() - 0.5) * 30, vy: -20 - R() * 30, g: 0, t: 0, life: 0.5, col: arg || '#fff6b0', r: 2 }); break;
    case 'firework': { const col = arg || '#ffd45e'; for(let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2, sp = 70 + R() * 50; parts.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, t: 0, life: 0.9 + R() * 0.3, col, r: 1.8 }); } break; }
    case 'bump': G.bumps.push({ i: x, t: 0 }); break;
    case 'shake': G.shake = Math.max(G.shake, x); break;
  }
  if(parts.length > 320) parts.splice(0, parts.length - 320);
}
function fxStep(dt){
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if(p.rot !== undefined) p.rot += dt * 8; }
  parts = parts.filter(p => p.t < p.life);
  for(const b of G.bumps) b.t += dt;
  G.bumps = G.bumps.filter(b => b.t < 0.2);
}
function addScore(n, x, y, col){ G.score += n; if(x !== undefined) fx('text', x, y, String(n), col || '#fff'); }
const CHAIN = [100, 200, 400, 800, 1000, 2000, 4000, 5000];

/* ---------- Player movement ---------- */
const NOC = { left: false, right: false, up: false, down: false, fire: false, fireP: false };
function controls(p){
  if(p.bot) return botControls(p);
  const s = A.Input.get(p.source);
  if(!s || !s.connected) return NOC;
  return { left: s.left, right: s.right, up: s.up, down: s.down, fire: s.fire, fireP: A.Input.pressed(s, 'fire') };
}
function stepPlayer(p, dt){
  if(p.inv > 0) p.inv -= dt;
  if(p.growT > 0) p.growT -= dt;
  if(p.throwT > 0) p.throwT -= dt;
  if(p.squashT > 0) p.squashT -= dt;
  if(p.star > 0) p.star = Math.max(0, p.star - dt);
  if(!p.bot){ const s = A.Input.get(p.source); p.away = !(s && s.connected); }
  if(p.done){ stepDone(p, dt); return; }
  if(p.dead > 0){ p.dead += dt; if(p.dead > 0.5){ p.vy = Math.min(MAX_FALL, p.vy + G_FALL * 0.7 * dt); p.y += p.vy * dt; } return; }
  if(p.bubble || (p.away && G.players.length > 1)){ stepBubble(p, dt); return; }
  if(G.state !== 'play' && !G.demo) return;
  const c = controls(p);
  // ride platforms
  if(p.plat){ p.x += p.plat.dx; p.y += p.plat.dy; p.plat = null; }
  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  if(dir) p.face = dir;
  if(dir && p.onGround){ if(dir === p.runDir) p.runT += dt; else { p.runDir = dir; p.runT = 0; } }
  else if(!dir && p.onGround) p.runT = 0;
  const max = p.runT > 0.45 ? RUN : WALK;
  p.skid = false;
  if(dir){
    const reversing = Math.sign(p.vx) === -dir && Math.abs(p.vx) > 20;
    const acc = p.onGround ? (reversing ? SKID : ACC) : AIR_ACC;
    if(reversing && p.onGround) p.skid = true;
    if(Math.abs(p.vx) < max || Math.sign(p.vx) !== dir) p.vx += dir * acc * dt;
    if(Math.abs(p.vx) > max && Math.sign(p.vx) === dir) p.vx = dir * Math.max(max, Math.abs(p.vx) - (p.onGround ? 300 : 80) * dt);
  } else if(p.onGround){
    const f = FRICTION * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  // jump (buffered, with a little coyote time), or throw
  if(c.fireP) p.buffer = 0.12;
  if(p.onGround) p.coyote = 0.09; else p.coyote -= dt;
  if(c.fireP && c.down && p.power === 2){ throwSpark(p); p.buffer = 0; }
  else if(p.buffer > 0 && p.coyote > 0){
    p.vy = -(JUMP + Math.min(46, Math.abs(p.vx) * 0.26)); p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.springy = false;
    sfx('jump');
  }
  p.buffer -= dt;
  const g = p.vy < 0 && (p.springy || (c.fire && p.jumping)) ? G_HOLD : G_FALL;
  if(p.vy >= 0){ p.jumping = false; p.springy = false; }
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);
  const wasGround = p.onGround;
  p.prevBottom = p.y + p.h;
  moveBody(p, dt, true);
  if(p.hitHead) bumpTile(p.hitHead.tx, p.hitHead.ty, p);
  // moving platforms and springs
  for(const e of G.ents){
    if((e.k === 'plat' || e.k === 'lift') && p.vy >= 0 && p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 && p.prevBottom <= e.y - e.dy + 2 && p.y + p.h >= e.y){
      p.y = e.y - p.h; p.vy = 0; p.onGround = true; p.plat = e;
    } else if(e.k === 'spring' && p.vy > 0 && p.x + p.w > e.x + 2 && p.x < e.x + e.w - 2 && p.prevBottom <= e.y + 3 && p.y + p.h >= e.y){
      p.y = e.y - p.h; p.vy = -SPRING_V; p.springy = true; p.jumping = true; p.onGround = false; e.t = 0.3; p.chain = 0;
      sfx('spring'); fx('dust', e.x + 8, e.y);
    }
  }
  if(p.onGround){ p.chain = 0; if(!wasGround) p.squashT = 0.12; }
  // crumbling blocks
  if(p.onGround && !p.plat){
    const ty = Math.floor((p.y + p.h + 1) / T);
    for(let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++)
      if(tileAt(tx, ty) === 'c'){ const i = ty * G.W + tx; if(!G.crumbles.has(i)) G.crumbles.set(i, 0); }
  }
  touchTiles(p);
  // falling out of the world
  if(p.y > LH + 12){
    if(D().pitBounce || G.demo || G.god){
      p.y = LH + 12; p.vy = -520; p.springy = true; p.jumping = true; sfx('spring'); G.pitBounces = (G.pitBounces || 0) + 1;
      fx('text', p.x + 6, LH - 30, 'BOING!', '#ffd45e');
    } else kill(p, true);
  }
}
function touchTiles(p){
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.01) / T);
  for(let ty = y0; ty <= y1; ty++) for(let tx = x0; tx <= x1; tx++){
    const ch = tileAt(tx, ty);
    if(ch === 'o'){ setTile(tx, ty, '.'); getCoin(p, tx * T + 8, ty * T + 8); }
    else if(ch === '^' && p.y + p.h > ty * T + 7 && p.x + p.w > tx * T + 2 && p.x < tx * T + 14) spikeHit(p);
  }
}
function spikeHit(p){
  if(p.star > 0) return;
  if(D().spikeBounce || G.demo || G.god){
    if(p.vy >= -100){ p.vy = -360; p.springy = true; p.jumping = true; p.onGround = false; sfx('boing'); fx('text', p.x + 6, p.y - 4, 'OUCH!', '#ff9a8a'); }
    return;
  }
  const had = p.inv > 0;
  hurt(p);
  if(!had && active(p)){ p.vy = -300; p.jumping = false; p.onGround = false; }
}
function getCoin(p, x, y){
  G.coins++; p.lc++; addScore(50);
  sfx('coin'); fx('sparkle', x, y, '#ffe27a');
  if(G.coins % 100 === 0){ if(hasLives()){ G.lives++; sfx('lifeUp'); fx('text', x, y - 10, '1UP', '#7dff8a'); } else addScore(1000, x, y - 10, '#7dff8a'); }
}
function throwSpark(p){
  if(G.ents.filter(e => e.k === 'spark' && e.owner === p.slot).length >= 2) return;
  mkEnt('spark', p.face > 0 ? p.x + p.w : p.x - 6, p.y + 7, { on: true, owner: p.slot, face: p.face, vx: p.face * 200, vy: 60, t: 0 });
  p.throwT = 0.18; sfx('throw');
}
function bounce(p, v){
  const s = p.bot ? null : A.Input.get(p.source);
  const held = p.bot || (s && s.fire);
  p.vy = -(v || (held ? STOMP_HOLD : STOMP_V)); p.jumping = true; p.springy = false; p.onGround = false;
}
function stepBubble(p, dt){
  p.bubbleT += dt;
  const c = p.away ? NOC : controls(p);
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  let tgt = null, best = 1e9;
  for(const q of G.players) if(q !== p && active(q)){ const d = Math.hypot(q.x - p.x, q.y - p.y); if(d < best){ best = d; tgt = q; } }
  let vx = ((c.right ? 1 : 0) - (c.left ? 1 : 0)) * 70, vy = ((c.down ? 1 : 0) - (c.up ? 1 : 0)) * 70;
  if(tgt){
    const dx = tgt.x + tgt.w / 2 - cx, dy = tgt.y - 6 - cy, d = Math.hypot(dx, dy) || 1, sp = d > 50 ? 80 : 30;
    vx += dx / d * sp; vy += dy / d * sp;
    if(c.fireP){ p.x += dx / d * 8; p.y += dy / d * 8; }
  }
  vy += Math.sin(p.bubbleT * 3) * 12;
  p.x += vx * dt; p.y += vy * dt;
  p.x = clamp(p.x, G.cam.x + 8, G.cam.x + VW - 8 - p.w); p.y = clamp(p.y, G.cam.y + 22, G.cam.y + VH - 40);
  if(tgt && !p.away && p.bubbleT > 0.7){
    const d = Math.hypot(tgt.x + tgt.w / 2 - (p.x + p.w / 2), tgt.y + tgt.h / 2 - (p.y + p.h / 2));
    if((d < 17 || (p.bubbleT > 7 && d < 44)) && !rectSolid(p)) pop(p);
  }
}
function toBubble(p){
  if(p.bubble) return;
  p.bubble = true; p.bubbleT = 0; p.vx = 0; p.vy = 0; p.star = 0; p.plat = null;
  setPower(p, D().startBig ? 1 : 0); p.growT = 0;
  sfx('bubble');
}
function pop(p){
  p.bubble = false; p.inv = 1.5; p.vy = -170; p.vx = 0; p.onGround = false; p.jumping = false;
  sfx('pop'); fx('pop', p.x + p.w / 2, p.y + p.h / 2);
}
function hurt(p){
  if(!active(p) || p.inv > 0 || p.star > 0) return;
  if(G.demo || G.god){ p.inv = 1; return; }
  if(p.power > 0){ setPower(p, p.power === 2 ? 1 : 0); p.inv = 1.8; sfx('shrink'); fx('poof', p.x + 6, p.y + p.h / 2); return; }
  kill(p, false);
}
function kill(p, fell){
  if(G.demo || G.god) return;
  if(G.players.length > 1){
    toBubble(p);
    if(fell){ p.x = G.cam.x + VW / 2 - 6; p.y = G.cam.y + 60; }
    fx('poof', p.x + 6, p.y + 8);
  } else {
    p.dead = 0.001; p.vy = -330; p.vx = 0; p.star = 0;
    if(fell){ p.dead = 0.6; p.vy = 0; }
    sfx('die');
  }
}
function stepDone(p, dt){
  if(p.done === 1){
    const pole = G.pole;
    p.x = pole.x - p.w + 1; p.y += 120 * dt; p.vx = 0;
    const bottom = pole.y + pole.h;
    if(p.y + p.h >= bottom){ p.y = bottom - p.h; p.done = 2; p.face = 1; p.onGround = true; p.x = pole.x + pole.w + 1; }
  } else if(p.done === 2){
    const hx = G.house ? G.house.x + G.house.w / 2 : p.x + 120;
    p.vx = 72; p.vy = Math.min(MAX_FALL, p.vy + G_FALL * dt); moveBody(p, dt);
    if(p.x + p.w / 2 >= hx - 2 || p.hitWall){ p.done = 3; sfx('select'); fx('sparkle', hx, p.y + 6); }
  }
}

/* A little autopilot: the title-screen demo heroes (and the test harness) use it. */
function botControls(p){
  const c = { left: false, right: true, up: false, down: false, fire: false, fireP: false };
  const boss = G.ents.find(e => e.k === 'boss' && e.st !== 'defeat');
  if(boss){
    const dx = boss.x + boss.w / 2 - (p.x + p.w / 2), open = bossOpen(boss);
    c.right = open ? dx > 4 : dx < 0 && Math.abs(dx) < 90 ? true : dx > 90;
    c.left = open ? dx < -4 : dx > 0 && Math.abs(dx) < 90 ? true : dx < -90;
    if(p.x < T * 2 + 4) { c.left = false; c.right = true; } if(p.x > G.W * T - T * 3) { c.right = false; c.left = true; }
    if(p.onGround && ((open && Math.abs(dx) < 30) || (!open && Math.abs(dx) < 40 && boss.bw !== 2))){ c.fireP = true; p.botHold = 0.4; }
    if(p.botHold > 0){ c.fire = true; p.botHold -= 1 / 60; }
    return c;
  }
  const feet = p.y + p.h, fr = Math.floor((feet - 1) / T);
  const lookX = p.x + p.w + 5 + Math.max(0, p.vx) * 0.14;
  const tx = Math.floor(lookX / T);
  const wall = isSolid(tileAt(tx, fr)) || isSolid(tileAt(tx, fr - 1)) || (p.h > 16 && isSolid(tileAt(tx, Math.floor(p.y / T))));
  let gap = true;
  for(let r = fr + 1; r < ROWS; r++){ const ch = tileAt(tx, r); if(isSolid(ch) || ch === '='){ gap = false; break; } }
  const spike = tileAt(tx, fr) === '^' || tileAt(tx + 1, fr) === '^';
  const foe = G.ents.some(e => e.on && (FOES.has(e.k) || e.k === 'boss') && e.st !== 'flip' && e.st !== 'flat' && e.st !== 'shell' &&
    e.x + e.w > p.x - 2 && e.x - (p.x + p.w) < 30 && Math.abs((e.y + e.h) - feet) < 30);
  const platNear = G.ents.find(e => (e.k === 'plat' || e.k === 'lift') && e.x < p.x + 90 && e.x + e.w > p.x + 10 && e.y > p.y - 50);
  if(gap && p.onGround && platNear){
    const ahead = platNear.x > p.x + 4 && platNear.x - (p.x + p.w) < 26 && platNear.y > p.y - 40 && platNear.y < feet + 30;
    const under = p.plat === platNear;
    if(!ahead && !under){ c.right = false; }
  }
  if(p.onGround && (wall || gap || spike || foe) && c.right){ p.botHold = 0.36 + ((p.slot * 7 + Math.floor(G.lvT)) % 3) * 0.04; c.fireP = true; }
  if(p.botHold > 0){ c.fire = true; p.botHold -= 1 / 60; }
  if(p.x > (p.botBest || 0) + 3){ p.botBest = p.x; p.botStuck = 0; } else p.botStuck = (p.botStuck || 0) + 1 / 60;
  if(p.botStuck > 1.4 && p.botStuck < 1.7){ c.right = false; c.left = true; }
  else if(p.botStuck >= 1.7 && p.onGround){ c.fireP = true; c.fire = true; p.botHold = 0.45; p.botStuck = 0.8; }
  if(p.power === 2 && foe && Math.random() < 0.05){ c.down = true; c.fireP = true; }
  return c;
}

/* ---------- Blocks ---------- */
function bumpTile(tx, ty, p){
  const ch = tileAt(tx, ty), x = tx * T + 8, y = ty * T;
  if(ch === '?'){ setTile(tx, ty, 'U'); fx('coin', x, y - 6); G.coins++; p.lc++; addScore(50); sfx('coin');
    if(G.coins % 100 === 0 && hasLives()){ G.lives++; sfx('lifeUp'); } }
  else if(ch === 'M' || ch === '*' || ch === 'L'){
    setTile(tx, ty, 'U');
    const k = ch === '*' ? 'star' : ch === 'L' ? 'life' : p.power === 0 ? 'grow' : 'zap';
    mkEnt(k, tx * T + 2, y, { on: true, st: 'rise', t: 0, face: 1 }); sfx('sprout');
  } else if(ch === 'B'){
    if(p.power > 0){ setTile(tx, ty, '.'); fx('brick', x, y + 8, G.world.brick[0]); addScore(50); sfx('brick'); }
    else sfx('bump');
  } else { sfx('bump'); return; }
  fx('bump', ty * G.W + tx, 0);
  // whatever stands on the block gets bumped too
  if(tileAt(tx, ty - 1) === 'o'){ setTile(tx, ty - 1, '.'); getCoin(p, x, y - 8); }
  for(const e of G.ents){
    if(e.dead || e.x + e.w <= tx * T || e.x >= tx * T + T || Math.abs(e.y + e.h - y) > 3) continue;
    if(FOES.has(e.k) && e.st !== 'flip') killEnemy(e, p, e.x + e.w / 2 < x ? -1 : 1);
    else if(ITEMS.has(e.k) && e.st !== 'rise'){ e.vy = -240; e.face = e.x + e.w / 2 < x ? -1 : 1; }
  }
}
function stepCrumbles(dt){
  for(const [i, t] of G.crumbles){
    const nt = t + dt;
    if(nt > 0.45){
      G.crumbles.delete(i);
      const tx = i % G.W, ty = Math.floor(i / G.W);
      setTile(tx, ty, '.'); fx('brick', tx * T + 8, ty * T + 8, '#e3b979'); sfx('crumble');
    } else G.crumbles.set(i, nt);
  }
}

/* ---------- Enemies and items ---------- */
function killEnemy(e, p, dir){
  e.st = 'flip'; e.vy = -230; e.vx = (dir || 1) * 50; e.t = 0;
  const n = p ? CHAIN[Math.min(CHAIN.length - 1, p.chain || 0)] : 100;
  addScore(n, e.x + e.w / 2, e.y - 4, '#fff');
  if(p){ p.lb++; }
  sfx('kick');
}
function stomp(e, p){
  const n = CHAIN[Math.min(CHAIN.length - 1, p.chain)];
  addScore(n, e.x + e.w / 2, e.y - 4, p.chain > 2 ? '#ffd45e' : '#fff');
  p.chain++; p.lb++;
  if(e.k === 'shell'){ e.st = 'shell'; e.vx = 0; e.t = 0; e.grace = 0.15; }
  else if(e.k === 'flier'){ e.st = 'flip'; e.vy = 0; e.vx = 0; e.t = 0; }
  else { e.st = 'flat'; e.t = 0; e.vx = 0; }
  sfx('stomp'); fx('poof', e.x + e.w / 2, e.y + e.h / 2);
}
function kickShell(e, p){
  e.st = 'spin'; e.face = (p.x + p.w / 2 < e.x + e.w / 2) ? 1 : -1; e.vx = e.face * 235; e.grace = 0.2; e.chain = 0;
  addScore(100, e.x + e.w / 2, e.y - 4);
  sfx('kick');
}
function walkerAI(e, dt, speed){
  e.vx = e.face * speed * D().enemy;
  e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt);
  moveBody(e, dt);
  if(e.hitWall) e.face = -e.hitWall;
  if(e.onGround){
    const ax = e.face > 0 ? e.x + e.w + 1 : e.x - 1, tx = Math.floor(ax / T), ty = Math.floor((e.y + e.h + 1) / T);
    const ch = tileAt(tx, ty);
    if(!isSolid(ch) && ch !== '=') e.face = -e.face;
  }
}
function nearestPlayer(x){
  let best = null, bd = 1e9;
  for(const p of G.players) if(active(p)){ const d = Math.abs(p.x - x); if(d < bd){ bd = d; best = p; } }
  return best;
}
function stepEnt(e, dt){
  if(!e.on){ if(e.x < G.cam.x + VW + 40) e.on = true; else return; }
  e.t += dt;
  if(FOES.has(e.k) && (e.st === 'flip')){ e.vy += G_FALL * dt; e.x += e.vx * dt; e.y += e.vy * dt; if(e.y > LH + 40) e.dead = 1; return; }
  if(FOES.has(e.k) && e.x + e.w < G.cam.x - 160) { e.dead = 1; return; }
  if(FOES.has(e.k) && e.x > G.cam.x + VW + 120) return;
  switch(e.k){
    case 'walker': case 'spiky':
      if(e.st === 'flat'){ if(e.t > 0.5) e.dead = 1; return; }
      walkerAI(e, dt, e.k === 'walker' ? 30 : 24); break;
    case 'shell':
      if(e.grace > 0) e.grace -= dt;
      if(e.st === 'walk') walkerAI(e, dt, 26);
      else if(e.st === 'shell'){ e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt); e.vx = 0; moveBody(e, dt); if(e.t > 7){ e.st = 'walk'; e.t = 0; } }
      else if(e.st === 'spin'){
        e.vx = e.face * 235; e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt); moveBody(e, dt);
        if(e.hitWall){ e.face = -e.hitWall; sfx('bump'); }
        for(const o of G.ents) if(o !== e && !o.dead && FOES.has(o.k) && o.st !== 'flip' && overlap(e, o)){
          e.chain = (e.chain || 0) + 1; killEnemy(o, null, e.face);
        }
      }
      break;
    case 'flier':
      e.x += e.face * 22 * D().enemy * dt;
      if(e.x < e.bx - 56) e.face = 1; else if(e.x > e.bx + 40) e.face = -1;
      e.y = e.by + Math.sin(e.t * 2.4) * 18; break;
    case 'hopper':
      if(e.st === 'flat'){ if(e.t > 0.5) e.dead = 1; return; }
      e.vy = Math.min(MAX_FALL, e.vy + G_FALL * 0.8 * dt);
      moveBody(e, dt);
      if(e.onGround){
        e.vx = 0;
        if(e.t > 1.4 / D().enemy){ const p = nearestPlayer(e.x); e.face = p && p.x < e.x ? -1 : 1; e.vy = -300; e.vx = e.face * 58 * D().enemy; e.t = 0; }
      }
      if(e.hitWall) e.face = -e.hitWall;
      break;
    case 'spark':
      e.vx = e.face * 200; e.vy = Math.min(MAX_FALL, e.vy + 1200 * dt); moveBody(e, dt);
      if(e.onGround) e.vy = -170;
      if(e.hitWall || e.t > 2.2 || e.y > LH || e.x < G.cam.x - 20 || e.x > G.cam.x + VW + 20){ e.dead = 1; fx('poof', e.x + 3, e.y + 3); break; }
      for(const o of G.ents){
        if(o.dead) continue;
        if(FOES.has(o.k) && o.st !== 'flip' && o.on && overlap(e, o)){ e.dead = 1; const p = G.players.find(q => q.slot === e.owner); killEnemy(o, p, e.face); fx('poof', e.x, e.y); break; }
        if(o.k === 'boss' && overlap(e, o)){ e.dead = 1; fx('sparkle', e.x, e.y, '#fff'); sparkBoss(o); break; }
      }
      break;
    case 'grow': case 'life': case 'star': case 'zap':
      if(e.st === 'rise'){ e.y -= 32 * dt; if(e.t > 0.5){ e.st = 'go'; e.vx = 0; e.vy = 0; } break; }
      if(e.k === 'zap'){ e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt); e.vx = 0; moveBody(e, dt); break; }
      e.vx = e.face * (e.k === 'star' ? 78 : 58);
      e.vy = Math.min(MAX_FALL, e.vy + (e.k === 'star' ? 900 : G_FALL) * dt);
      moveBody(e, dt);
      if(e.hitWall) e.face = -e.hitWall;
      if(e.k === 'star' && e.onGround) e.vy = -290;
      if(e.y > LH + 20) e.dead = 1;
      break;
    case 'plat': { const ox = e.x; e.x = e.bx + (1 - Math.cos(e.t * e.speed)) / 2 * e.range; e.dx = e.x - ox; e.dy = 0; break; }
    case 'lift': { const oy = e.y; e.y = e.by + Math.sin(e.t * e.speed) * e.range * 0.83; e.dy = e.y - oy; e.dx = 0; break; }
    case 'spring': if(e.t > 0.3) e.t = 0.3; break;
    case 'check':
      if(e.st !== 'got') for(const p of G.players) if(active(p) && overlap(p, e)){
        e.st = 'got'; G.check = e.x; sfx('flag'); fx('sparkle', e.x + 8, e.y + 6, '#fff');
        addScore(500, e.x + 8, e.y - 6, '#7dff8a'); break;
      }
      break;
    case 'boss': stepBoss(e, dt); break;
    case 'shard':
      if(e.st === 'warn'){ if(e.t > 0.85){ e.st = 'fall'; e.vy = 40; } }
      else { e.vy += 900 * dt; e.y += e.vy * dt; if(e.y + e.h >= 12 * T){ e.dead = 1; fx('shards', e.x + 4, 12 * T - 4, '#a4f5ff'); sfx('shard'); } }
      break;
    case 'bolt': if(e.t > 0.38) e.dead = 1; break;
  }
  if(FOES.has(e.k) && e.y > LH + 30) e.dead = 1;
}
function enemyBumps(){
  const list = G.ents.filter(e => e.on && !e.dead && (e.k === 'walker' || e.k === 'spiky' || (e.k === 'shell' && e.st === 'walk')) && e.x > G.cam.x - 40 && e.x < G.cam.x + VW + 40);
  for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
    const a = list[i], b = list[j];
    if(!overlap(a, b)) continue;
    if(a.x < b.x){ a.face = -1; b.face = 1; } else { a.face = 1; b.face = -1; }
  }
}
function interact(){
  const act = G.players.filter(active);
  for(const e of G.ents){
    if(e.dead || !e.on) continue;
    for(const p of act){
      if(!active(p) || !overlap(p, e)) continue;
      if(ITEMS.has(e.k)){ if(e.st !== 'rise') collect(e, p); break; }
      if(e.k === 'boss'){ bossContact(e, p); continue; }
      if(e.k === 'shard'){ if(e.st === 'fall') hurt(p); continue; }
      if(e.k === 'bolt'){ hurt(p); continue; }
      if(!FOES.has(e.k) || e.st === 'flip' || e.st === 'flat') continue;
      if(p.star > 0){ killEnemy(e, p, p.x < e.x ? 1 : -1); continue; }
      const stompy = p.vy > 0 && p.prevBottom <= e.y + Math.max(5, e.h * 0.55);
      if(e.k === 'shell' && e.st === 'shell'){ if(e.grace > 0) continue; kickShell(e, p); if(stompy) bounce(p); continue; }
      if(e.k === 'shell' && e.st === 'spin'){ if(stompy && e.grace <= 0){ e.st = 'shell'; e.vx = 0; e.t = 0; e.grace = 0.2; bounce(p); sfx('stomp'); } continue; }
      if(stompy && e.k !== 'spiky'){ stomp(e, p); bounce(p); }
      else if(stompy && e.k === 'spiky'){ hurt(p); if(active(p)) bounce(p, 240); }
      else hurt(p);
    }
  }
  // friends can bounce on each other's heads
  for(const a of act) for(const b of act){
    if(a === b || a.vy <= 0 || a.prevBottom > b.y + 3 || !overlap(a, b)) continue;
    a.y = b.y - a.h; bounce(a, a.bot ? 300 : undefined); b.squashT = 0.2; sfx('boing');
  }
  // the goal pole
  if(G.pole) for(const p of act){
    if(p.x + p.w > G.pole.x && p.x < G.pole.x + G.pole.w && p.y < G.pole.y + G.pole.h){
      const frac = clamp((G.pole.y + G.pole.h - (p.y + p.h)) / G.pole.h, 0, 1);
      const bonus = frac > 0.9 ? 5000 : frac > 0.66 ? 2000 : frac > 0.42 ? 800 : frac > 0.2 ? 400 : 100;
      addScore(bonus, G.pole.x, p.y - 8, bonus >= 5000 ? '#ffd45e' : '#fff');
      if(bonus >= 5000){ fx('text', G.pole.x, p.y - 20, 'TOP!', '#ffd45e'); fx('firework', G.pole.x, G.pole.y + 10, p.color); }
      p.done = 1; p.vx = 0; p.vy = 0; p.star = 0; p.bonus = bonus; sfx('pole');
      if(G.goalT < 0) G.goalT = 0;
    }
  }
}
function collect(e, p){
  e.dead = 1;
  const x = e.x + 6, y = e.y;
  if(e.k === 'grow'){ if(p.power === 0){ setPower(p, 1); sfx('powerUp'); } else sfx('coin'); addScore(1000, x, y, '#ffd45e'); }
  else if(e.k === 'zap'){ const was = p.power; setPower(p, 2); if(was > 0) p.growT = 0.4; sfx('powerUp'); addScore(1000, x, y, '#ffd45e'); }
  else if(e.k === 'star'){ p.star = 9; sfx('powerUp'); addScore(1000, x, y, '#ffd45e'); }
  else if(e.k === 'life'){ if(hasLives()){ G.lives++; fx('text', x, y, '1UP', '#7dff8a'); } else addScore(1000, x, y, '#7dff8a'); sfx('lifeUp'); }
  fx('sparkle', x, y + 4);
}

/* ---------- Bosses ---------- */
function makeBoss(bw, bx, by){
  const hp = D().bossHp;
  if(bw === 0) return mkEnt('boss', bx - 9, -60, { w: 34, h: 26, bw, st: 'intro', hp, max: hp, inv: 0, face: -1, on: true, name: BOSS_NAMES[0] });
  if(bw === 1) return mkEnt('boss', bx - 11, by - 22, { w: 38, h: 22, bw, st: 'intro', hp, max: hp, inv: 0, face: -1, on: true, name: BOSS_NAMES[1] });
  return mkEnt('boss', VW + 20, 34, { w: 36, h: 30, bw, st: 'intro', hp, max: hp, inv: 0, face: -1, on: true, bolts: 0, name: BOSS_NAMES[2] });
}
const bossSpikes = e => e.bw === 0 ? (e.st === 'bristle' || e.st === 'charge') : e.bw === 1 ? e.st === 'claws' : false;
function bossOpen(e){
  if(e.inv > 0 || e.st === 'defeat' || e.st === 'intro' || e.st === 'stun') return false;
  if(e.bw === 0) return !bossSpikes(e);
  if(e.bw === 1) return e.st === 'scuttle' || e.st === 'tired';
  return e.st === 'low' || e.st === 'swoop';
}
function setBoss(e, st){ e.st = st; e.t = 0; }
function stepBoss(e, dt){
  if(e.inv > 0) e.inv -= dt;
  const ground = 12 * T, L = T + 1, R = G.W * T - T - 1 - e.w, anger = e.max - e.hp;
  const tgt = nearestPlayer(e.x) || G.players[0];
  const tx = tgt ? tgt.x + tgt.w / 2 : VW / 2;
  const toward = tx < e.x + e.w / 2 ? -1 : 1;
  if(e.st === 'defeat'){
    e.vy += 700 * dt; e.y += e.vy * dt; e.x += e.face * 30 * dt;
    if(Math.random() < 0.25) fx('sparkle', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#fff');
    if(e.t > 2.4){ e.dead = 1; bossDefeated(e); }
    return;
  }
  if(e.st === 'stun'){ if(e.t > 1.0) setBoss(e, e.bw === 0 ? 'bristle' : e.bw === 1 ? 'scuttle' : 'rise'); return; }
  if(e.bw === 0){
    const spd = (1 + anger * 0.25) * (G.diff === 'kids' ? 0.8 : G.diff === 'pro' ? 1.15 : 1);
    if(e.st === 'intro'){ e.vy += 900 * dt; e.y += e.vy * dt; if(e.y + e.h >= ground){ e.y = ground - e.h; e.vy = 0; fx('shake', 0.5); sfx('land'); fx('dust', e.x + e.w / 2, ground); setBoss(e, 'walk'); } return; }
    if(e.st === 'walk'){ e.x += e.face * 40 * spd * dt; if(e.t > 2.3) setBoss(e, 'bristle'); }
    else if(e.st === 'bristle'){ if(e.t > 0.7){ e.face = toward; setBoss(e, 'charge'); sfx('warn'); } }
    else if(e.st === 'charge'){ e.x += e.face * 125 * spd * dt; if(Math.random() < 0.3) fx('dust', e.x + (e.face > 0 ? 0 : e.w), ground); if(e.t > 1.8){ setBoss(e, 'hop'); e.vy = -360; } }
    else if(e.st === 'hop'){ e.vy += 1100 * dt; e.y += e.vy * dt; e.x += toward * 50 * dt; if(e.y + e.h >= ground && e.vy > 0){ e.y = ground - e.h; e.vy = 0; fx('shake', 0.35); sfx('land'); fx('dust', e.x + e.w / 2, ground); setBoss(e, 'walk'); } }
    if(e.x < L){ e.x = L; e.face = 1; if(e.st === 'charge'){ fx('shake', 0.2); sfx('bump'); } }
    if(e.x > R){ e.x = R; e.face = -1; if(e.st === 'charge'){ fx('shake', 0.2); sfx('bump'); } }
  } else if(e.bw === 1){
    const spd = (1 + anger * 0.22) * (G.diff === 'kids' ? 0.8 : G.diff === 'pro' ? 1.15 : 1);
    if(e.st === 'intro'){ if(e.t > 1.2) setBoss(e, 'scuttle'); if(Math.random() < 0.3) fx('dust', e.x + Math.random() * e.w, ground); return; }
    if(e.st === 'scuttle'){ e.x += e.face * 72 * spd * dt; if(e.t > 3.2) setBoss(e, 'claws'); }
    else if(e.st === 'claws'){
      const drops = [0.2, 0.55, 0.9, 1.25].slice(0, 2 + Math.min(2, anger));
      for(const at of drops) if(e.t - dt < at && e.t >= at){
        const x = at === 0.2 && tgt ? clamp(tx - 4, L, G.W * T - T - 10) : L + Math.random() * (G.W * T - 2 * T - 10);
        mkEnt('shard', x, T, { st: 'warn', on: true }); sfx('warn');
      }
      if(e.t > 1.9) setBoss(e, 'tired');
    } else if(e.st === 'tired'){ if(e.t > 1.8){ e.face = toward; setBoss(e, 'scuttle'); } }
    if(e.x < L){ e.x = L; e.face = 1; } if(e.x > R){ e.x = R; e.face = -1; }
  } else {
    const spd = (1 + anger * 0.2) * (G.diff === 'kids' ? 0.8 : G.diff === 'pro' ? 1.15 : 1);
    const low = ground - e.h, high = 30;
    e.face = toward;
    if(e.st === 'intro'){ e.x += (VW * 0.6 - e.x) * Math.min(1, dt * 1.6); e.y = high + Math.sin(G.time * 2) * 4; if(e.t > 1.8) setBoss(e, 'hover'); return; }
    if(e.st === 'hover'){ e.x += clamp(tx - e.w / 2 - e.x, -1, 1) * Math.min(Math.abs(tx - e.w / 2 - e.x), 70 * spd * dt); e.y = high + Math.sin(G.time * 2.5) * 5; if(e.t > 1.5) setBoss(e, 'warn'); }
    else if(e.st === 'warn'){ if(Math.floor(e.t * 10) !== Math.floor((e.t - dt) * 10)) sfx('warn'); if(e.t > 0.75 / Math.min(1.3, spd)){
        mkEnt('bolt', e.x + e.w / 2 - 5, e.y + e.h - 4, { on: true, w: 10, h: ground - (e.y + e.h - 4), st: 'hot' });
        sfx('thunder'); fx('shake', 0.25);
        e.bolts++; setBoss(e, e.bolts >= 3 ? 'swoop' : 'hover'); } }
    else if(e.st === 'swoop'){ e.y = Math.min(low, e.y + 150 * dt); if(e.y >= low) setBoss(e, 'low'); }
    else if(e.st === 'low'){ e.x += toward * 28 * spd * dt; e.y = low; if(e.t > 2.6) setBoss(e, 'rise'); }
    else if(e.st === 'rise'){ e.y -= 110 * dt; if(e.y <= high){ e.y = high; e.bolts = 0; setBoss(e, 'hover'); } }
    e.x = clamp(e.x, L, R);
  }
}
function hitBoss(e){
  e.hp--; e.inv = 1.3; e.dmg = 0;
  sfx('bossHit'); fx('shake', 0.3); fx('sparkle', e.x + e.w / 2, e.y + 4, '#fff');
  addScore(1000, e.x + e.w / 2, e.y - 6, '#ffd45e');
  if(e.hp <= 0){ setBoss(e, 'defeat'); e.vy = -300; sfx('boom'); for(let i = 0; i < 3; i++) fx('firework', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#ffd45e'); }
  else setBoss(e, 'stun');
}
function sparkBoss(e){
  if(e.inv > 0 || e.st === 'defeat' || e.st === 'intro') return;
  e.dmg = (e.dmg || 0) + 1;
  if(e.dmg >= 3) hitBoss(e); else sfx('bump');
}
function bossContact(e, p){
  if(e.st === 'defeat' || e.st === 'intro') return;
  const stompy = p.vy > 0 && p.prevBottom <= e.y + 10;
  if(stompy){
    if(bossOpen(e)){ hitBoss(e); bounce(p, 380); p.chain++; return; }
    if(e.inv > 0 || e.st === 'stun'){ bounce(p, 300); return; }
    bounce(p, 300); hurt(p); return;
  }
  if(p.star > 0){ if(e.inv <= 0) hitBoss(e); return; }
  if(e.st === 'stun' || e.inv > 0.9) return;
  hurt(p);
  if(active(p)) p.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1) * 140;
}
function bossDefeated(e){
  addScore(5000, e.x + e.w / 2, 80, '#ffd45e');
  for(const p of G.players) if(p.bubble) pop(p);
  if(G.goalT < 0) G.goalT = 0;
  sfx('win');
}

/* ---------- Camera: one screen for everyone ---------- */
function camera(dt, snap){
  const maxX = Math.max(0, G.W * T - VW);
  let list = G.players.filter(active);
  if(!list.length) list = G.players.filter(p => p.done && p.done < 3);
  if(!list.length) return;
  let lead = -1e9, trail = 1e9, sum = 0;
  for(const p of list){ const cx = p.x + p.w / 2; lead = Math.max(lead, cx); trail = Math.min(trail, cx); sum += cx; }
  const avg = sum / list.length;
  let target = list.length === 1 ? avg - VW * 0.42 : avg - VW * 0.5 + 20;
  target = Math.min(target, trail - 28);
  target = Math.max(target, lead - VW * 0.7);
  target = clamp(target, 0, maxX);
  G.cam.x = snap ? target : G.cam.x + (target - G.cam.x) * Math.min(1, dt * 6);
  G.cam.x = clamp(Math.max(G.cam.x, lead - VW * 0.78), 0, maxX);
  G.cam.y = LH - VH;
}
function clampPlayers(){
  for(const p of G.players){
    if(!active(p)) continue;
    if(p.x < G.cam.x){ p.x = G.cam.x; if(p.vx < 0) p.vx = 0; if(rectSolid(p) && G.players.length > 1){ toBubble(p); } }
    if(p.x + p.w > G.cam.x + VW){ p.x = G.cam.x + VW - p.w; if(p.vx > 0) p.vx = 0; }
  }
}

/* ---------- Level flow ---------- */
function loadLevel(ix, fromCheck){
  const L = buildLevel(ix);
  G.lv = ix; G.W = L.W; G.map = L.map.slice(); G.world = L.world; G.mods = []; G.bumps = []; G.crumbles = new Map();
  G.ents = []; nextEnt = 1; G.pole = null; G.house = null; G.goalT = -1; G.wipeT = 0; G.shake = 0;
  if(!fromCheck){ G.check = null; G.lvT = 0; G.levelScore = G.score; for(const p of G.players){ p.lc = 0; p.lb = 0; } }
  for(const e of L.ents) spawnFromMap(e);
  G.loadN++; parts = [];
  placePlayers(G.check !== null ? G.check + 2 : L.start.tx * T + 2);
  camera(0, true);
}
function startIntro(short){
  A.Menu.close();
  G.state = 'intro'; G.stateT = 0; G.introLen = short ? 1.4 : 2.4;
  sfx('stageStart'); A.keepAwake();
}
function newGame(players){
  G.demo = false;
  G.roster = players.map(p => ({ slot: p.slot, source: p.source, name: p.name, color: p.color }));
  G.players = G.roster.map(r => makeHero(Object.assign({}, r)));
  G.score = 0; G.coins = 0; G.lives = D().lives;
  loadLevel(G.startLv); startIntro();
}
function startDemo(){
  G.demo = true;
  const pick = [0, 1, 4, 8].filter(i => i <= Math.max(1, G.unlocked));
  const ix = pick[Math.floor(Math.random() * pick.length)];
  G.players = [makeHero({ slot: 0, bot: true, name: 'Sprig', color: A.PLAYER_COLORS[0] }), makeHero({ slot: 1, bot: true, name: 'Sprout', color: A.PLAYER_COLORS[1] })];
  loadLevel(ix); G.demoT = 0;
  G.players[1].x -= 20;
}
function dropIn(){
  if(G.demo || G.players.length >= 4 || G.state !== 'play') return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.players.some(p => p.source === s.id)) continue;
    const used = G.players.map(p => p.slot);
    const slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.players.map(p => p.name));
    const p = makeHero({ slot, source: s.id, color: A.PLAYER_COLORS[slot], name });
    const act = G.players.filter(active);
    const ref = act[0] || G.players[0];
    p.x = ref ? ref.x : G.cam.x + 40; p.y = ref ? ref.y - 30 : 100;
    if(D().startBig) setPower(p, 1);
    G.players.push(p); G.players.sort((a, b) => a.slot - b.slot);
    G.roster = G.players.map(q => ({ slot: q.slot, source: q.source, name: q.name, color: q.color }));
    if(act.length){ toBubble(p); p.bubbleT = 0.2; } else { p.y = groundY(p.x + 6) - p.h; }
    sfx('join'); fx('text', p.x + 6, p.y - 10, name.toUpperCase() + ' JOINED!', p.color);
    return;
  }
}
function flowChecks(dt){
  // everyone in a bubble (or the solo hero fell): back to the last flag
  const alive = G.players.filter(p => !p.away);
  const wiped = alive.length > 0 && alive.every(p => p.bubble || p.dead > 0) && !G.players.some(p => p.done);
  if(wiped){ G.wipeT += dt; if(G.wipeT > (G.players.length > 1 ? 1.3 : 2.4)) loseLife(); }
  else G.wipeT = 0;
  if(G.goalT >= 0){
    G.goalT += dt;
    const sliding = G.players.some(p => p.done === 1 || p.done === 2);
    const left = G.players.some(active);
    if(isBoss(G.lv) ? G.goalT > 3.4 : (G.goalT > 1.2 && !sliding && (!left || G.goalT > 6))) startClear();
  }
}
function loseLife(){
  G.wipeT = 0;
  if(hasLives()) G.lives--;
  if(hasLives() && G.lives <= 0){ gameOver(); return; }
  for(const p of G.players){ if(!D().startBig) setPower(p, 0); p.star = 0; }
  loadLevel(G.lv, true); startIntro(true);
}
function startClear(){
  G.state = 'clear'; G.stateT = 0; sfx('fanfare');
  G.unlocked = Math.max(G.unlocked, Math.min(LEVELS.length - 1, G.lv + 1)); A.Store.set('hop.unlocked', G.unlocked);
}
function results(){
  G.state = 'results'; G.stateT = 0;
  const key = 'hop.best.' + G.lv + '.' + G.diff, best = A.Store.get(key, 0);
  let rec = false;
  if(!best || G.lvT < best){ A.Store.set(key, r1(G.lvT)); rec = true; }
  const def = LEVELS[G.lv], last = G.lv >= LEVELS.length - 1;
  const rows = G.players.map(p => '<b style="color:' + p.color + '">' + A.esc(p.name) + '</b> · ' + p.lc + (p.lc === 1 ? ' coin · ' : ' coins · ') + p.lb + (p.lb === 1 ? ' bop' : ' bops') +
    (p.bonus ? ' · pole +' + p.bonus : '')).join('<br>');
  G.players.forEach(p => { p.bonus = 0; });
  const title = isBoss(G.lv) ? BOSS_NAMES[def.boss].charAt(0) + BOSS_NAMES[def.boss].slice(1).toLowerCase() + ' is beaten!' : 'World ' + def.code + ' clear!';
  const items = [];
  if(last) items.push({ label: 'See the ending', select: ending });
  else items.push({ label: 'Next: ' + LEVELS[G.lv + 1].code + ' ' + LEVELS[G.lv + 1].name, select: () => { nextLevel(); } });
  items.push({ label: 'Play it again', select: () => { G.score = G.levelScore; loadLevel(G.lv); startIntro(); } });
  items.push({ label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) });
  if(!hosting()) items.push({ label: 'Quit to title', select: toTitle });
  A.Menu.open({ center: true, shared: true, kicker: def.code + ' · ' + def.name + ' · ' + D().label, title: title.replace('Crag crab', 'Crag Crab').replace('Baron grumble', 'Baron Grumble'),
    text: rows + '<br><br>Team score <b>' + G.score.toLocaleString() + '</b> · time <b>' + fmt(G.lvT) + '</b>' + (rec ? ' · <b>new best!</b>' : best ? ' · best ' + fmt(best) : ''),
    items });
}
function nextLevel(){
  const n = G.lv + 1;
  for(const p of G.players){ p.done = 0; if(p.bubble){ p.bubble = false; } }
  G.startLv = n; loadLevel(n); startIntro();
}
function ending(){
  A.Menu.close();
  G.state = 'ending'; G.stateT = 0; A.Store.set('hop.beaten', true);
  G.players.forEach((p, i) => { p.done = 0; p.bubble = false; p.dead = 0; p.x = VW / 2 - 40 + i * 24; p.y = 12 * T - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.face = 1; });
  G.ents = G.ents.filter(e => e.k !== 'bolt' && e.k !== 'shard');
}
function endingMenu(){
  A.Menu.open({ center: true, shared: true, kicker: 'Hop Hero', title: 'The rainbow is free!',
    text: 'Baron Grumble has floated off to sulk, and colour is back in the sky. Thanks for playing, heroes!<br>Team score <b>' + G.score.toLocaleString() + '</b>',
    items: [
      { label: 'Play again from 1-1', select: () => { G.startLv = 0; newGame(G.roster); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function gameOver(){
  G.state = 'gameover'; G.stateT = 0; sfx('gameOver');
  A.Menu.open({ center: true, shared: true, kicker: LEVELS[G.lv].code + ' · ' + LEVELS[G.lv].name, title: 'Out of lives!',
    text: 'No problem: pick up right where you were with fresh lives.',
    items: [
      { label: 'Keep going', select: () => { G.lives = D().lives; G.score = G.levelScore; for(const p of G.players) setPower(p, 0); loadLevel(G.lv); startIntro(); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  G.lvT += dt;
  for(const e of G.ents) if(e.k === 'plat' || e.k === 'lift') stepEnt(e, dt);
  for(const p of G.players) stepPlayer(p, dt);
  for(const e of G.ents) if(!e.dead && e.k !== 'plat' && e.k !== 'lift') stepEnt(e, dt);
  enemyBumps();
  interact();
  stepCrumbles(dt);
  camera(dt);
  clampPlayers();
  G.ents = G.ents.filter(e => !e.dead);
  if(G.demo){
    G.demoT += dt;
    for(const p of G.players) if(p.done === 3 || G.demoT > 55){ startDemo(); break; }
  }
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
const levelLabel = ix => LEVELS[ix].code + ' · ' + LEVELS[ix].name;
function titleMenu(){
  G.state = 'title';
  A.Menu.open({ kicker: 'xRetro', title: 'HOP HERO',
    text: 'Baron Grumble has bottled up the rainbow! Run, jump and <b>bop</b> your way through the Meadow, the Crystal Caves and the Sky Castle. <b>1–4 heroes</b> on one screen, or online.',
    items: [
      { label: 'Play', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Start at', value: () => levelLabel(G.startLv), change: d => { G.startLv = (G.startLv + d + G.unlocked + 1) % (G.unlocked + 1); A.Store.set('hop.start', G.startLv); } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('hop.diff', G.diff); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: controllerLine() });
}
function controllerLine(){
  const n = A.Input.pads().length;
  const unl = G.unlocked > 0 ? 'Unlocked up to ' + LEVELS[G.unlocked].code + '. ' : '';
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + unl + 'Kids mode: pits and spikes bounce you back.';
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + levelLabel(G.startLv) + ' · ' + D().label,
    title: 'Who is hopping?',
    text: online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 heroes share one screen. More can drop in later by pressing FIRE.',
    min: 1, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => newGame(players),
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'play' && G.state !== 'intro') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart level', select: () => { G.score = G.levelScore; loadLevel(G.lv); startIntro(); } }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: levelLabel(G.lv), title: 'Paused', items, back: resume });
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
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 heroes from any mix of devices.',
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
    Net.host('hop', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'hop', name, netHandlers).then(() => {
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
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to hop',
    text: '<b>Left / right</b> run (keep holding to sprint) · <b>A / Space / FIRE</b> jump, hold it to jump higher · <b>Down + FIRE</b> throws sparks once you have a <b>Zap Flower</b>.<br>' +
          'Jump on enemies to bop them. <b>Prickles</b> are spiky, so don’t land on them! Bop a <b>Clonk</b>, then kick its shell into other enemies.<br>' +
          'Hit the glowing blocks from below. A <b>Sunberry</b> makes you big (one extra hit), the <b>Rainbow Star</b> makes you unstoppable. Land on friends’ heads for a boost.<br>' +
          'Hit with friends around? You float in a <b>bubble</b>: touch a friend to pop out. Grab the goal pole <b>high</b> for a big bonus. In Kids mode pits and spikes bounce you back.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0, modsSent = 0, lastLoadSent = -1, snapN = 0, forceFull = false;
const KINDS = ['walker', 'shell', 'flier', 'spiky', 'hopper', 'spark', 'grow', 'zap', 'star', 'life', 'plat', 'lift', 'spring', 'check', 'pole', 'house', 'boss', 'bolt', 'shard'];
const KI = {}; KINDS.forEach((k, i) => { KI[k] = i; });
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onPeer(){ forceFull = true; },
  onRename(id, name){ const p = G.players.find(x => x.source === id); if(p) p.name = name; const r = G.roster.find(x => x.source === id); if(r) r.name = name; },
  onMessage(m){ if(m.t === 's'){ receiveMeta(m); if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx); if(m.fx) m.fx.forEach(f => spawnFx(f[0], f[1], f[2], f[3] === null ? undefined : f[3], f[4] === null ? undefined : f[4])); buf.push(m); } }
};
function flatMods(list){ const out = []; for(const m of list) out.push(m[0], m[1]); return out; }
function sendSnap(){
  const cx = G.cam.x, e = [];
  for(const q of G.ents){
    if(q.dead) continue;
    if(q.k !== 'boss' && q.k !== 'pole' && (q.x + q.w < cx - 40 || q.x > cx + VW + 40)) continue;
    const row = [q.id, KI[q.k], r1(q.x), r1(q.y), q.face, q.st || '', r2(q.t)];
    if(q.k === 'boss') row.push([q.hp, q.max, r2(q.inv), q.bw]);
    else if(q.k === 'bolt' || q.k === 'pole') row.push(r1(q.h));
    e.push(row);
  }
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), lv: G.lv, ln: G.loadN, d: G.diff, dm: G.demo ? 1 : 0,
    sc: G.score, li: hasLives() ? G.lives : -1, co: G.coins, cx: r1(cx), gt: r2(G.goalT), lt: r1(G.lvT), il: G.introLen,
    p: G.players.map(p => [p.slot, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.face,
      (p.onGround ? 1 : 0) | (p.bubble ? 2 : 0) | (p.done === 3 ? 4 : 0) | (p.inv > 0 ? 8 : 0) | (p.away ? 16 : 0) | (p.skid ? 32 : 0),
      p.power, r2(p.dead), r2(p.star), p.name, p.color, p.source || '', p.lc, p.h, r2(p.bubbleT), r2(p.throwT), r2(p.growT), r2(p.squashT)]),
    e };
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
  G.lv = lv; G.W = L.W; G.world = L.world; G.map = L.map.slice(); G.modsApplied = 0; G.bumps = [];
}
function receiveMeta(m){
  if(m.ln !== G.loadN || m.lv !== G.lv || !G.map){ G.loadN = m.ln; guestLevel(m.lv); parts = []; }
  const apply = (arr, from) => { for(let i = from; i + 1 < arr.length; i += 2) G.map[arr[i]] = arr[i + 1]; };
  if(m.mf){ G.map = buildLevel(m.lv).map.slice(); apply(m.mf, 0); G.modsApplied = m.mf.length / 2; }
  else if(m.md && m.md[0] === G.modsApplied){ apply(m.md, 1); G.modsApplied += (m.md.length - 1) / 2; }
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!G.map || s.lv !== G.lv) guestLevel(s.lv);
  G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.score = s.sc; G.lives = s.li < 0 ? Infinity : s.li; G.coins = s.co;
  G.goalT = s.gt; G.lvT = s.lt; G.introLen = s.il || 2.4;
  G.cam.x = a.lv === b.lv && Math.abs(a.cx - b.cx) < 80 ? L(a.cx, b.cx) : b.cx; G.cam.y = LH - VH;
  const pp = new Map(a.p.map(q => [q[0], q]));
  G.players = s.p.map(q => {
    const o = pp.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60 && Math.abs(o[2] - q[2]) < 60;
    const f = q[6];
    return { slot: q[0], x: near ? L(o[1], q[1]) : q[1], y: near ? L(o[2], q[2]) : q[2], vx: q[3], vy: q[4], face: q[5],
      onGround: !!(f & 1), bubble: !!(f & 2), done: (f & 4) ? 3 : 0, inv: (f & 8) ? 1 : 0, away: !!(f & 16), skid: !!(f & 32),
      power: q[7], dead: q[8], star: q[9], name: q[10], color: q[11], source: q[12], lc: q[13], h: q[14], w: 12,
      bubbleT: q[15], throwT: q[16], growT: q[17], squashT: q[18] };
  });
  const pe = new Map(a.e.map(q => [q[0], q]));
  G.ents = s.e.map(q => {
    const o = pe.get(q[0]), near = o && Math.abs(o[2] - q[2]) < 48 && Math.abs(o[3] - q[3]) < 48;
    const k = KINDS[q[1]], sz = SIZES[k] || [12, 12];
    const e = { id: q[0], k, x: near ? L(o[2], q[2]) : q[2], y: near ? L(o[3], q[3]) : q[3], w: sz[0], h: sz[1], face: q[4], st: q[5], t: q[6], on: true };
    if(k === 'boss'){ const x = q[7]; e.hp = x[0]; e.max = x[1]; e.inv = x[2]; e.bw = x[3]; e.w = [34, 38, 36][e.bw]; e.h = [26, 22, 30][e.bw]; e.name = BOSS_NAMES[e.bw]; }
    else if(k === 'bolt' || k === 'pole') e.h = q[7];
    return e;
  });
  G.pole = G.ents.find(e => e.k === 'pole') || null;
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
  else if(st === 'intro' || st === 'play' || st === 'paused'){
    if(G.goalT >= 0) want = null;
    else if(G.players.length === 1 && G.players[0].dead > 0) want = null;
    else if(G.players.some(p => p.star > 0 && !p.bubble && !p.done)) want = STAR_THEME;
    else if(isBoss(G.lv)) want = boss && boss.st !== 'defeat' ? BOSS_THEME : null;
    else want = G.world.music;
  }
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(st === 'paused' || st === 'results' || st === 'gameover');
}
function myPlayers(){
  if(G.net !== 'guest') return G.players;
  return G.players.filter(p => Net.isMine(p.source));
}
function step(dt){
  G.time += dt;
  if(G.net === 'guest'){
    Net.guestTick();
    const wantTouch = (G.state === 'play' || G.state === 'intro') && myPlayers().some(p => p.source === Net.peer + '/touch') && !A.Mirror.ui;
    if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('JUMP'); }
    Net.setPlaying(G.state === 'play' || G.state === 'intro');
    music(); return;
  }
  const wantTouch = (G.state === 'play' || G.state === 'intro') && G.players.some(p => p.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('JUMP'); }
  music();
  if(Net) Net.setPlaying(G.state === 'play' || G.state === 'intro');
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
    case 'play':
      if(pausePressed){ pause(); return; }
      G.stateT += dt;
      dropIn(); sim(dt); flowChecks(dt);
      break;
    case 'clear':
      G.stateT += dt;
      for(const p of G.players) if(p.done === 1 || p.done === 2) stepDone(p, dt);
      if(Math.floor(G.stateT * 2.5) !== Math.floor((G.stateT - dt) * 2.5) && G.stateT < 2.6){
        const hx = G.house ? G.house.x + 24 : VW / 2 + G.cam.x;
        fx('firework', hx - 40 + Math.random() * 80, 40 + Math.random() * 50, A.PLAYER_COLORS[Math.floor(Math.random() * 4)]); sfx('firework');
      }
      if(G.stateT > 3.4) results();
      break;
    case 'ending':
      G.stateT += dt;
      for(const p of G.players){ p.vy += G_FALL * dt; p.y += p.vy * dt; if(p.y + p.h >= 12 * T){ p.y = 12 * T - p.h; p.vy = 0; p.onGround = true; if(Math.random() < 0.02) { p.vy = -300; p.onGround = false; } } else p.onGround = false; }
      if(Math.floor(G.stateT * 1.6) !== Math.floor((G.stateT - dt) * 1.6)){ fx('firework', 40 + Math.random() * (VW - 80), 30 + Math.random() * 60, A.PLAYER_COLORS[Math.floor(Math.random() * 4)]); sfx('firework'); }
      if(G.stateT > 6 && !A.Menu.isOpen()) endingMenu();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || (G.state !== 'play' && G.state !== 'intro') || G.net === 'guest') return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);

function rng(i){ const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function shade(hex, k){
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
}
function rr(c, x, y, w, h, r){ r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); }
function ell(c, x, y, rx, ry, rot){ c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2); }
function text(c, str, x, y, size, color, align, base){ c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y); }
function outlined(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, size / 3.5); c.strokeStyle = 'rgba(12,10,24,.9)'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
function star5(c, x, y, R, r){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); }
const hue = (t, s, l) => 'hsl(' + ((t % 360 + 360) % 360) + ',' + (s || 95) + '%,' + (l || 62) + '%)';

/* ---------- Tiles (cached per screen resolution, drawn on whole device pixels: no seams) ---------- */
const tileCache = new Map(); let cacheSize = 0;
function sprite(key, draw){
  const S = Math.max(1, Math.round(T * display.scale));
  if(S !== cacheSize){ tileCache.clear(); cacheSize = S; }
  let cv = tileCache.get(key);
  if(!cv){ cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.scale(S / T, S / T); draw(c); tileCache.set(key, cv); }
  return cv;
}
function drawGround(c, W_, top, left, right, bottom, v){
  const g = W_.g;
  c.fillStyle = g.fill; c.fillRect(0, 0, T, T);
  if(W_.key === 'sky'){
    c.fillStyle = g.fillDk; c.fillRect(0, 7.5, T, 1); c.fillRect(v % 2 ? 4 : 11, 0, 1, 7.5); c.fillRect(v % 2 ? 11 : 4, 8.5, 1, 7.5); c.fillRect(0, 15, T, 1);
    c.fillStyle = g.fillHi; c.fillRect(0, 8.5, T, 0.8); c.fillRect(0, 0, T, 0.8);
  } else {
    c.fillStyle = g.speck;
    const pts = [[3, 9], [11, 5], [7, 13], [13, 12], [2, 3], [9, 9]];
    for(let i = 0; i < 3; i++){ const q = pts[(v + i * 2) % pts.length]; rr(c, q[0], q[1], 2.2, 1.6, 0.8); c.fill(); }
    c.fillStyle = g.fillHi; const q = pts[(v + 3) % pts.length]; c.fillRect(q[0] + 1, q[1] - 1, 1.4, 1);
    if(W_.key === 'caves' && v === 1){ c.fillStyle = 'rgba(120,255,235,.55)'; c.beginPath(); c.moveTo(9, 12); c.lineTo(10.5, 8); c.lineTo(12, 12); c.fill(); }
  }
  if(left){ c.fillStyle = g.fillDk; c.fillRect(0, 0, 1.6, T); }
  if(right){ c.fillStyle = g.fillDk; c.fillRect(T - 1.6, 0, 1.6, T); }
  if(bottom){ c.fillStyle = g.fillDk; c.fillRect(0, T - 2, T, 2);
    if(W_.key === 'caves'){ c.fillStyle = g.fill; c.beginPath(); c.moveTo(3 + v, T); c.lineTo(5 + v, T + 0); c.lineTo(4 + v, T - 0.1); c.fill(); } }
  if(top){
    c.fillStyle = g.topDk; c.fillRect(0, 0, T, 6.5);
    c.fillStyle = g.top; c.fillRect(0, 0, T, 4.6);
    for(let i = 0; i < 4; i++){ circ(c, 2 + i * 4, 4.6, 2.1); c.fill(); }
    c.fillStyle = g.topHi; c.fillRect(0, 0.7, T, 1.1);
    if(W_.key === 'meadow' && v === 2){ c.fillStyle = '#fff'; circ(c, 6, 1.4, 1); c.fill(); c.fillStyle = '#ffd45e'; circ(c, 6, 1.4, 0.45); c.fill(); }
    if(left){ c.fillStyle = g.topDk; c.fillRect(0, 0, 1.4, 6.5); }
    if(right){ c.fillStyle = g.topDk; c.fillRect(T - 1.4, 0, 1.4, 6.5); }
  }
}
function drawBlock(c, base, dk, hi){
  c.fillStyle = dk; c.fillRect(0, 0, T, T);
  c.fillStyle = base; c.fillRect(0.8, 0.8, T - 1.6, T - 2);
  c.fillStyle = hi; c.fillRect(0.8, 0.8, T - 1.6, 1.4); c.fillRect(0.8, 0.8, 1.4, T - 2);
}
function tileSprite(ch, tx, ty, frame){
  const W_ = G.world, k = W_.key;
  if(ch === '#'){
    const top = tileAt(tx, ty - 1) !== '#', left = tileAt(tx - 1, ty) !== '#' && tx > 0, right = tileAt(tx + 1, ty) !== '#' && tx < G.W - 1, bottom = ty < ROWS - 1 && tileAt(tx, ty + 1) !== '#';
    const v = (tx * 7 + ty * 13) % 3;
    return sprite(k + '#' + (+top) + (+left) + (+right) + (+bottom) + v, c => drawGround(c, W_, top, left, right, bottom, v));
  }
  if(ch === 'X') return sprite(k + 'X', c => { const s = W_.stone; drawBlock(c, s[0], s[1], s[2]); c.fillStyle = s[1]; c.fillRect(4, 4, 8, 7.5); c.fillStyle = s[0]; c.fillRect(5, 5, 6, 5.5); c.fillStyle = s[2]; c.fillRect(5, 5, 6, 1); });
  if(ch === 'B') return sprite(k + 'B', c => {
    const b = W_.brick; c.fillStyle = b[1]; c.fillRect(0, 0, T, T); c.fillStyle = b[0];
    const rows = [[0, 0, 7.3, 4.8], [8.3, 0, 7.7, 4.8], [0, 5.6, 3.3, 4.8], [4.3, 5.6, 7.4, 4.8], [12.7, 5.6, 3.3, 4.8], [0, 11.2, 7.3, 4.8], [8.3, 11.2, 7.7, 4.8]];
    for(const r of rows){ c.fillRect(r[0] + 0.3, r[1] + 0.3, r[2] - 0.3, r[3] - 0.6); }
    c.fillStyle = b[2]; for(const r of rows) c.fillRect(r[0] + 0.3, r[1] + 0.3, r[2] - 0.3, 0.9);
  });
  if(ch === '?' || ch === 'M' || ch === '*' || ch === 'L') return sprite('gift' + frame, c => {
    drawBlock(c, '#ffb52e', '#b86a0c', '#ffe08a');
    c.fillStyle = '#b86a0c'; for(const p of [[2.2, 2.2], [12.6, 2.2], [2.2, 12], [12.6, 12]]) c.fillRect(p[0], p[1], 1.2, 1.2);
    const glow = [0.75, 0.9, 1, 0.9][frame];
    c.fillStyle = 'rgba(255,255,255,' + glow + ')'; star5(c, 8, 7.6, 4.6, 2); c.fill();
    c.fillStyle = 'rgba(184,106,12,.5)'; star5(c, 8.4, 8.3, 4.6, 2); c.globalCompositeOperation = 'destination-over'; c.fill(); c.globalCompositeOperation = 'source-over';
  });
  if(ch === 'U') return sprite(k + 'U', c => { const u = W_.used; drawBlock(c, u[0], u[1], shade(u[0], 1.18)); c.fillStyle = u[1]; for(const p of [[2.5, 2.5], [12.3, 2.5], [2.5, 12], [12.3, 12]]) c.fillRect(p[0], p[1], 1.3, 1.3); });
  if(ch === 'c') return sprite('crumble', c => { drawBlock(c, '#e6bd7f', '#a9793f', '#ffe1ad'); c.strokeStyle = '#9b6b3a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(3, 2); c.lineTo(7, 7); c.lineTo(5, 12); c.moveTo(7, 7); c.lineTo(12, 9); c.lineTo(13, 14); c.moveTo(11, 2); c.lineTo(10, 5); c.stroke(); });
  if(ch === '=') return sprite(k + '=', c => {
    const p = W_.plat;
    if(k === 'sky'){ c.fillStyle = '#ffffff'; for(let i = 0; i < 4; i++){ circ(c, 2 + i * 4, 4, 3.4); c.fill(); } c.fillStyle = '#e4e2fb'; c.fillRect(0, 5, T, 2.6); }
    else if(k === 'caves'){ c.fillStyle = p[1]; c.fillRect(0, 1, T, 5); c.fillStyle = p[0]; c.fillRect(0, 0, T, 3); c.fillStyle = p[2]; c.fillRect(0, 0, T, 0.9); c.fillStyle = p[1]; c.beginPath(); c.moveTo(3, 6); c.lineTo(5, 10); c.lineTo(7, 6); c.moveTo(10, 6); c.lineTo(11.5, 9); c.lineTo(13, 6); c.fill(); }
    else { c.fillStyle = p[1]; c.fillRect(0, 2, T, 5); c.fillStyle = p[0]; c.fillRect(0, 2, T, 3.8); c.fillStyle = p[2]; c.fillRect(0, 0, T, 2.6); for(let i = 0; i < 4; i++){ circ(c, 2 + i * 4, 2.2, 1.6); c.fill(); } c.fillStyle = p[1]; c.fillRect(7.5, 3, 1, 3); }
  });
  if(ch === '^') return sprite(k + '^', c => {
    const s = W_.spike;
    for(let i = 0; i < 3; i++){ const x = i * 5.33; c.fillStyle = s[1]; c.beginPath(); c.moveTo(x, T); c.lineTo(x + 2.66, 6); c.lineTo(x + 5.33, T); c.fill(); c.fillStyle = s[0]; c.beginPath(); c.moveTo(x + 0.8, T); c.lineTo(x + 2.66, 6); c.lineTo(x + 2.9, T); c.fill(); }
  });
  return null;
}
function drawTiles(c, camX, camY, s){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T), frame = Math.floor(G.time * 5) % 4;
  for(let ty = 0; ty < ROWS; ty++){
    const y0 = Math.round((ty * T - camY) * s), y1 = Math.round(((ty + 1) * T - camY) * s);
    if(y1 < 0) continue;
    for(let tx = tx0; tx <= tx1; tx++){
      const ch = tileAt(tx, ty);
      if(ch === '.' || ch === 'o') continue;
      const sp = tileSprite(ch, tx, ty, frame); if(!sp) continue;
      const x0 = Math.round((tx * T - camX) * s), x1 = Math.round(((tx + 1) * T - camX) * s);
      let dy = 0, dx = 0;
      if(G.bumps.length){ const i = ty * G.W + tx; for(const b of G.bumps) if(b.i === i) dy = -Math.round(Math.sin(b.t / 0.2 * Math.PI) * 4 * s); }
      if(ch === 'c' && G.crumbles.size){ const t = G.crumbles.get(ty * G.W + tx); if(t !== undefined) dx = Math.round(Math.sin(t * 70) * s); }
      c.drawImage(sp, x0 + dx, y0 + dy, x1 - x0, y1 - y0);
    }
  }
}
function drawCoins(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++) for(let tx = tx0; tx <= tx1; tx++){
    if(tileAt(tx, ty) !== 'o') continue;
    drawCoin(c, tx * T + 8, ty * T + 8 + Math.sin(G.time * 3 + tx) * 0.8, Math.abs(Math.cos(G.time * 3.2 + tx * 0.6)));
  }
}
function drawCoin(c, x, y, sx){
  const w = Math.max(0.8, 4.6 * sx);
  c.fillStyle = '#c9800d'; ell(c, x, y, w, 6); c.fill();
  c.fillStyle = '#ffcf3f'; ell(c, x, y, Math.max(0.5, w - 0.9), 5.2); c.fill();
  c.fillStyle = '#ffe98a'; ell(c, x, y, Math.max(0.3, w * 0.45), 3.4); c.fill();
  if(sx > 0.4){ c.fillStyle = '#fff8d6'; c.fillRect(x - w * 0.55, y - 3.5, Math.max(0.5, w * 0.25), 2.6); }
}

/* ---------- Backgrounds ---------- */
const wrap = (v, span) => ((v % span) + span) % span;
function cloud(c, x, y, s, col){ c.fillStyle = col; circ(c, x, y, 9 * s); c.fill(); circ(c, x + 10 * s, y - 4 * s, 11 * s); c.fill(); circ(c, x + 22 * s, y, 9 * s); c.fill(); rr(c, x - 4 * s, y - 2 * s, 30 * s, 10 * s, 5 * s); c.fill(); }
function hills(c, off, base, amp, col, freq, seed){
  c.fillStyle = col; c.beginPath(); c.moveTo(0, VH);
  for(let sx = 0; sx <= VW + 6; sx += 6){ const w = sx + off; c.lineTo(sx, base - (Math.sin(w * freq + seed) * 0.55 + Math.sin(w * freq * 2.3 + seed * 2) * 0.3 + 1) * amp); }
  c.lineTo(VW, VH); c.fill();
}
function hillY(off, base, amp, freq, seed, sx){ const w = sx + off; return base - (Math.sin(w * freq + seed) * 0.55 + Math.sin(w * freq * 2.3 + seed * 2) * 0.3 + 1) * amp; }
function drawBG(c, camX){
  const W_ = G.world, def = LEVELS[G.lv] || {};
  const storm = !!def.storm;
  const g = c.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, storm ? '#1b1c44' : W_.sky[0]); g.addColorStop(1, storm ? '#6c5a92' : W_.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  if(W_.key === 'meadow'){
    c.fillStyle = 'rgba(255,250,210,.35)'; circ(c, 318, 42, 24); c.fill(); c.fillStyle = '#fff5c2'; circ(c, 318, 42, 14); c.fill();
    for(let i = 0; i < 7; i++){ const x = wrap(i * 83 - camX * 0.07 - G.time * 5, VW + 120) - 60; cloud(c, x, 22 + (i * 37) % 54, 0.55 + (i % 3) * 0.22, 'rgba(255,255,255,.92)'); }
    const o1 = camX * 0.16; hills(c, o1, 158, 28, W_.far, 0.012, 1);
    if(def.windmills){
      for(let k = Math.floor((o1 - 60) / 230); k <= Math.floor((o1 + VW + 60) / 230); k++){
        const sx = k * 230 + 90 - o1, by = hillY(o1, 158, 28, 0.012, 1, sx);
        c.fillStyle = '#f3ead7'; c.beginPath(); c.moveTo(sx - 6, by + 4); c.lineTo(sx - 3, by - 26); c.lineTo(sx + 3, by - 26); c.lineTo(sx + 6, by + 4); c.fill();
        c.fillStyle = '#c9584a'; c.beginPath(); c.moveTo(sx - 5, by - 26); c.lineTo(sx, by - 33); c.lineTo(sx + 5, by - 26); c.fill();
        c.save(); c.translate(sx, by - 26); c.rotate(G.time * 1.2 + k); c.fillStyle = '#fffaf0';
        for(let b = 0; b < 4; b++){ c.rotate(Math.PI / 2); c.fillRect(-1.2, 2, 2.4, 16); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(1.2, 5, 3, 11); c.fillStyle = '#fffaf0'; }
        c.restore(); c.fillStyle = '#6b4b3a'; circ(c, sx, by - 26, 1.6); c.fill();
      }
    }
    const o2 = camX * 0.34; hills(c, o2, 182, 22, W_.near, 0.02, 2);
    for(let k = Math.floor(o2 / 70) - 1; k <= Math.floor((o2 + VW) / 70) + 1; k++){
      const sx = k * 70 + rng(k) * 40 - o2, by = hillY(o2, 182, 22, 0.02, 2, sx);
      if(rng(k + 3) < 0.45){ c.fillStyle = '#7a5236'; c.fillRect(sx - 1, by - 10, 2, 11); c.fillStyle = '#3fae4e'; circ(c, sx, by - 13, 7); c.fill(); c.fillStyle = '#5fcf62'; circ(c, sx - 2, by - 15, 4); c.fill(); }
      else { for(let f = 0; f < 3; f++){ c.fillStyle = ['#ffffff', '#ffd45e', '#ff8fc0'][(k + f) % 3]; circ(c, sx + f * 5, by + 3 + (f % 2) * 2, 1.2); c.fill(); } }
    }
  } else if(W_.key === 'caves'){
    const o1 = camX * 0.18;
    c.fillStyle = W_.far;
    for(let k = Math.floor(o1 / 40) - 1; k <= Math.floor((o1 + VW) / 40) + 1; k++){
      const sx = k * 40 - o1, h1 = 16 + rng(k) * 38, h2 = 20 + rng(k + 50) * 44;
      c.beginPath(); c.moveTo(sx - 16, 0); c.lineTo(sx + 2, h1); c.lineTo(sx + 18, 0); c.fill();
      c.beginPath(); c.moveTo(sx - 12, VH); c.lineTo(sx + 6, VH - h2); c.lineTo(sx + 22, VH); c.fill();
    }
    const o2 = camX * 0.38;
    for(let k = Math.floor(o2 / 150) - 1; k <= Math.floor((o2 + VW) / 150) + 1; k++){
      const sx = k * 150 + rng(k + 9) * 60 - o2, by = 170 + rng(k + 4) * 20, col = rng(k) < 0.5 ? [66, 226, 201] : [255, 120, 200];
      const pulse = 0.5 + Math.sin(G.time * 1.6 + k) * 0.2;
      c.fillStyle = 'rgba(' + col.join(',') + ',' + (0.12 * pulse + 0.05) + ')'; circ(c, sx, by - 14, 26); c.fill();
      for(let j = -1; j <= 1; j++){
        const h = 22 - Math.abs(j) * 8, w = 5;
        c.fillStyle = 'rgba(' + col.join(',') + ',' + (0.55 + pulse * 0.3) + ')';
        c.beginPath(); c.moveTo(sx + j * 8 - w, by); c.lineTo(sx + j * 8 - w * 0.6 + j * 3, by - h); c.lineTo(sx + j * 8 + j * 3, by - h - 5); c.lineTo(sx + j * 8 + w * 0.6 + j * 3, by - h); c.lineTo(sx + j * 8 + w, by); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(sx + j * 8 - 1 + j * 2, by - h + 2, 1, h - 4);
      }
    }
    c.fillStyle = W_.near;
    for(let k = Math.floor(o2 / 60) - 1; k <= Math.floor((o2 + VW) / 60) + 1; k++){ const sx = k * 60 - o2, h1 = 8 + rng(k + 20) * 20; c.beginPath(); c.moveTo(sx - 10, 0); c.lineTo(sx, h1 + 10); c.lineTo(sx + 10, 0); c.fill(); }
    for(let i = 0; i < 26; i++){
      const x = wrap(rng(i) * VW - camX * 0.5, VW), y = wrap(rng(i + 40) * VH - G.time * (6 + rng(i) * 8), VH);
      c.fillStyle = 'rgba(180,255,240,' + (0.3 + 0.3 * Math.sin(G.time * 3 + i)) + ')'; c.fillRect(x, y, 1.2, 1.2);
    }
  } else {
    for(let i = 0; i < 40; i++){ c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.4 * Math.sin(G.time * 2 + i * 1.7)) + ')'; c.fillRect(wrap(rng(i) * 900 - camX * 0.03, VW), rng(i + 9) * 70, 1, 1); }
    const o1 = camX * 0.1;
    c.fillStyle = storm ? 'rgba(40,36,90,.8)' : 'rgba(110,96,200,.55)';
    for(let k = Math.floor(o1 / 180) - 1; k <= Math.floor((o1 + VW) / 180) + 1; k++){
      const sx = k * 180 - o1 + 40, base = 150;
      for(const t of [[-26, 34, 8], [-12, 58, 10], [4, 44, 9], [20, 30, 7]]){
        const tx = sx + t[0], th = t[1] + rng(k) * 10, tw = t[2];
        c.fillRect(tx - tw / 2, base - th, tw, th + 60);
        c.beginPath(); c.moveTo(tx - tw / 2 - 2, base - th); c.lineTo(tx, base - th - tw * 1.6); c.lineTo(tx + tw / 2 + 2, base - th); c.fill();
      }
      c.fillRect(sx - 30, base - 18, 60, 80);
    }
    const o2 = camX * 0.26;
    for(let i = 0; i < 6; i++){ const x = wrap(i * 97 - o2 - G.time * 3, VW + 140) - 70; cloud(c, x, 70 + (i * 29) % 50, 0.8 + (i % 2) * 0.4, storm ? 'rgba(120,110,170,.6)' : 'rgba(255,230,245,.7)'); }
    const o3 = camX * 0.5;
    c.fillStyle = storm ? '#7d6ea8' : '#ffe6f3';
    for(let k = Math.floor(o3 / 26) - 1; k <= Math.floor((o3 + VW) / 26) + 1; k++){ circ(c, k * 26 - o3, 212 + rng(k) * 6, 16 + rng(k + 1) * 6); c.fill(); }
    c.fillStyle = storm ? '#9a8cc4' : '#ffffff';
    for(let k = Math.floor(o3 / 34) - 1; k <= Math.floor((o3 + VW) / 34) + 1; k++){ circ(c, k * 34 - o3 + 12, 222 + rng(k + 7) * 5, 14); c.fill(); }
  }
}
function drawWeather(c, camX){
  const def = LEVELS[G.lv] || {};
  if(!def.storm) return;
  c.strokeStyle = 'rgba(200,210,255,.35)'; c.lineWidth = 0.7; c.beginPath();
  for(let i = 0; i < 50; i++){ const x = wrap(rng(i) * VW + G.time * 50 - camX * 0.3, VW), y = wrap(rng(i + 5) * VH + G.time * 380, VH); c.moveTo(x, y); c.lineTo(x - 2.5, y + 8); }
  c.stroke();
  const f = (G.time % 7.3);
  if(f < 0.12 || (f > 0.2 && f < 0.26)){ c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(0, 0, VW, VH); }
}

/* ---------- Heroes ---------- */
const SKIN = '#ffd9b8';
function drawHero(c, p){
  if(p.done === 3) return;
  if(p.inv > 0 && !p.bubble && Math.floor(G.time * 20) % 2) return;
  const big = p.power > 0, cx = p.x + p.w / 2, fy = p.y + p.h;
  const starOn = p.star > 0 && (p.star > 2 || Math.floor(G.time * 10) % 2);
  const col = starOn ? hue(G.time * 500 + p.slot * 90) : p.color;
  const dark = starOn ? hue(G.time * 500 + p.slot * 90 + 60, 80, 40) : shade(p.color, 0.62);
  c.save(); c.translate(cx, fy);
  let sy = 1;
  if(p.squashT > 0) sy = 1 - p.squashT * 1.1;
  if(p.growT > 0 && Math.floor(p.growT * 16) % 2) sy *= big ? 0.72 : 1.3;
  if(p.dead > 0) c.rotate(Math.sin(p.dead * 18) * 0.25);
  c.scale((p.face < 0 ? -1 : 1) * (2 - sy), sy);
  const moving = Math.abs(p.vx) > 6, air = !p.onGround && !(p.dead > 0);
  const ph = p.x * 0.32, step = !air && moving ? Math.sin(ph) : 0;
  const bodyH = big ? 11 : 5, bodyW = big ? 10 : 9, bob = !air && moving ? Math.abs(Math.cos(ph)) * 0.8 : 0;
  const neckY = -3 - bodyH - bob;
  // scarf tail
  const flap = Math.sin(G.time * 16 + p.slot) * (moving || air ? 1.6 : 0.5);
  const tail = 7 + Math.min(4, Math.abs(p.vx) * 0.035);
  c.fillStyle = dark; c.beginPath(); c.moveTo(-2, neckY + 0.5); c.lineTo(-tail, neckY + 2 + flap); c.lineTo(-tail + 1.5, neckY + 4.5 + flap * 0.6); c.lineTo(-1, neckY + 3.2); c.closePath(); c.fill();
  // boots
  c.fillStyle = '#2d2748';
  if(air){ rr(c, -4.8, -4.8, 4.2, 3.2, 1.3); c.fill(); rr(c, 1, -3.4, 4.2, 3.2, 1.3); c.fill(); }
  else if(p.skid){ rr(c, -5.5, -3, 4.2, 3, 1.3); c.fill(); rr(c, 1.8, -3, 4.2, 3, 1.3); c.fill(); }
  else { rr(c, -4.6 + step * 1.8, -3, 4.2, 3, 1.3); c.fill(); rr(c, 0.6 - step * 1.8, -3, 4.2, 3, 1.3); c.fill(); }
  // body (hoodie)
  c.fillStyle = col; rr(c, -bodyW / 2, -3 - bodyH - bob, bodyW, bodyH + 1.2, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-bodyW / 2 + 1.4, -3 - bodyH - bob + 1.2, 1.3, bodyH - 1.2);
  if(big){
    c.fillStyle = dark; c.fillRect(-bodyW / 2, -7.5 - bob, bodyW, 1.3);
    if(p.power === 2){ c.fillStyle = '#fff4a8'; star5(c, 1.2, -10.5 - bob, 2.6, 1.1); c.fill(); }
  }
  // arm
  const armUp = air || p.throwT > 0;
  c.fillStyle = SKIN;
  if(p.throwT > 0){ circ(c, 6, -3 - bodyH * 0.7 - bob, 1.7); c.fill(); }
  else { circ(c, armUp ? 3.8 : 2.6 - step * 0.9, -3 - bodyH * (armUp ? 0.95 : 0.4) - bob, 1.6); c.fill(); }
  // head: hood rim, face, eyes, sprout
  const hy = neckY - 4.1;
  c.fillStyle = col; circ(c, -0.4, hy, 5.9); c.fill();
  c.fillStyle = dark; circ(c, -1.6, hy + 0.2, 4.2); c.fill();
  c.fillStyle = col; circ(c, -1.1, hy - 0.4, 4.4); c.fill();
  c.fillStyle = SKIN; circ(c, 1.3, hy + 0.5, 4.5); c.fill();
  if(p.dead > 0){
    c.strokeStyle = '#231c35'; c.lineWidth = 0.8; c.beginPath();
    for(const ex of [2.2, 4.6]){ c.moveTo(ex - 0.8, hy - 1.6); c.lineTo(ex + 0.8, hy); c.moveTo(ex + 0.8, hy - 1.6); c.lineTo(ex - 0.8, hy); }
    c.stroke();
  } else {
    const blink = Math.floor(G.time * 10 + p.slot * 13) % 37 === 0;
    c.fillStyle = '#231c35';
    if(blink){ c.fillRect(1.6, hy - 0.3, 1.5, 0.6); c.fillRect(4, hy - 0.3, 1.5, 0.6); }
    else { rr(c, 1.8, hy - 1.6, 1.4, 2.5, 0.7); c.fill(); rr(c, 4.2, hy - 1.6, 1.4, 2.5, 0.7); c.fill(); c.fillStyle = '#fff'; c.fillRect(2.05, hy - 1.35, 0.6, 0.6); c.fillRect(4.45, hy - 1.35, 0.6, 0.6); }
    c.fillStyle = 'rgba(255,110,130,.5)'; circ(c, 1.3, hy + 1.8, 0.9); c.fill(); circ(c, 5.4, hy + 1.8, 0.7); c.fill();
    c.strokeStyle = '#8a4a4a'; c.lineWidth = 0.55; c.beginPath(); c.arc(3.6, hy + 1.6, 0.9, 0.2, Math.PI - 0.2); c.stroke();
  }
  const sb = Math.sin(G.time * 6 + p.slot) * 0.6 + (air ? -0.9 : 0);
  c.strokeStyle = '#3e9b3a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-0.5, hy - 5.6); c.quadraticCurveTo(0.2, hy - 7.5, -0.2 + sb * 0.3, hy - 9); c.stroke();
  if(p.power === 2){
    for(let i = 0; i < 5; i++){ const a = G.time * 2 + i * Math.PI * 0.4; c.fillStyle = '#ffe14a'; circ(c, -0.2 + Math.cos(a) * 1.7, hy - 9.6 + Math.sin(a) * 1.7, 1.2); c.fill(); }
    c.fillStyle = '#ff8a3d'; circ(c, -0.2, hy - 9.6, 1); c.fill();
  } else {
    c.fillStyle = '#5fd35b'; ell(c, -2.2, hy - 9 + sb, 2.5, 1.2, -0.5); c.fill(); ell(c, 1.8, hy - 9.5 - sb * 0.5, 2.5, 1.2, 0.5); c.fill();
    c.fillStyle = '#9ef08a'; ell(c, -2.4, hy - 9.3 + sb, 1.2, 0.45, -0.5); c.fill();
  }
  c.restore();
  if(starOn && Math.random() < 0.3 && G.state !== 'paused') spawnFx('sparkle', cx, p.y + p.h / 2, hue(G.time * 500));
}
function drawBubble(c, p){
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = 13 + Math.sin(G.time * 4 + p.slot) * 0.9;
  c.save(); c.translate(cx, cy); c.scale(0.72, 0.72); c.translate(-cx, -cy - 2);
  drawHero(c, Object.assign({}, p, { inv: 0, onGround: true, vx: 0, star: 0, growT: 0, squashT: 0, dead: 0, y: cy - p.h / 2 + (p.h > 20 ? -2 : 1) }));
  c.restore();
  c.fillStyle = 'rgba(190,230,255,.2)'; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = p.away ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)'; c.lineWidth = 1; circ(c, cx, cy, r); c.stroke();
  c.strokeStyle = p.color; c.globalAlpha = 0.6; c.lineWidth = 0.6; circ(c, cx, cy, r - 1.2); c.stroke(); c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.85)'; ell(c, cx - r * 0.45, cy - r * 0.5, 3, 1.6, -0.7); c.fill();
  if(p.away){ outlined(c, 'AWAY', cx, cy + r + 5, 4, '#bbb'); }
}

/* ---------- Enemies, items and props ---------- */
function eyes(c, x, y, face, angry, sp){
  sp = sp || 3.4;
  c.fillStyle = '#fff'; ell(c, x, y, 1.6, 2); c.fill(); ell(c, x + sp, y, 1.6, 2); c.fill();
  c.fillStyle = '#1d1630'; circ(c, x + face * 0.6, y + 0.3, 0.9); c.fill(); circ(c, x + sp + face * 0.6, y + 0.3, 0.9); c.fill();
  if(angry){ c.strokeStyle = '#1d1630'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 1.6, y - 2.6); c.lineTo(x + 1.2, y - 1.8); c.moveTo(x + sp + 1.6, y - 2.6); c.lineTo(x + sp - 1.2, y - 1.8); c.stroke(); }
}
function drawFoe(c, e){
  const W_ = G.world, x = e.x, y = e.y, w = e.w, h = e.h;
  const walkPh = Math.sin((e.x + e.id * 7) * 0.5);
  c.save();
  if(e.st === 'flip'){ c.translate(x + w / 2, y + h / 2); c.scale(1, -1); c.translate(-(x + w / 2), -(y + h / 2)); }
  if(e.k === 'walker'){
    const n = W_.nut;
    if(e.st === 'flat'){ c.fillStyle = n[1]; ell(c, x + 6, y + h - 2, 7, 2.4); c.fill(); c.fillStyle = n[0]; ell(c, x + 6, y + h - 1.4, 6, 1.6); c.fill(); c.restore(); return; }
    c.fillStyle = '#2b2440'; ell(c, x + 3 + walkPh, y + 11.2, 2.6, 1.3); c.fill(); ell(c, x + 9 - walkPh, y + 11.2, 2.6, 1.3); c.fill();
    c.fillStyle = n[0]; ell(c, x + 6, y + 7.5, 5.8, 4.6); c.fill();
    c.fillStyle = 'rgba(255,255,255,.25)'; ell(c, x + 3.5, y + 6.5, 1.5, 2.2, 0.3); c.fill();
    c.fillStyle = n[1]; c.beginPath(); c.ellipse(x + 6, y + 4.6, 6.6, 4.2, 0, Math.PI, 0); c.fill(); c.fillRect(x - 0.6, y + 4, 13.2, 1.4);
    c.strokeStyle = shade(n[1].length === 7 ? n[1] : '#7a4b2a', 1.35); c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + 5, y + 4.8); c.moveTo(x + 6, y + 0.8); c.lineTo(x + 9, y + 4.8); c.moveTo(x + 9.5, y + 1.8); c.lineTo(x + 11, y + 4); c.stroke();
    c.fillStyle = n[1]; c.fillRect(x + 5.4, y - 1.4, 1.4, 2.4);
    eyes(c, x + 4.2 + e.face * 0.6, y + 7.4, e.face, true);
  } else if(e.k === 'shell'){
    const s = W_.shell, inShell = e.st === 'shell' || e.st === 'spin';
    if(!inShell){
      c.fillStyle = '#2b2440'; for(let i = 0; i < 3; i++){ ell(c, x + 3 + i * 4 + (i % 2 ? walkPh : -walkPh), y + h - 0.8, 1.4, 1.1); c.fill(); }
      const hx = e.face > 0 ? x + w - 1 : x + 1;
      c.fillStyle = '#ffd36b'; circ(c, hx, y + 6.5, 3.4); c.fill();
      c.fillStyle = '#1d1630'; circ(c, hx + e.face * 1.2, y + 5.8, 0.9); c.fill();
    }
    const wob = e.st === 'shell' && e.t > 5.2 ? Math.sin(e.t * 40) * 0.8 : 0;
    c.fillStyle = s[1]; c.beginPath(); c.ellipse(x + w / 2 + wob, y + h - 2, w / 2, h - 2, 0, Math.PI, 0); c.fill(); c.fillRect(x + wob, y + h - 3, w, 2.4);
    c.fillStyle = s[0]; c.beginPath(); c.ellipse(x + w / 2 + wob, y + h - 2.6, w / 2 - 1.2, h - 3.6, 0, Math.PI, 0); c.fill();
    c.strokeStyle = s[1]; c.lineWidth = 0.7; c.beginPath();
    const spinOff = e.st === 'spin' ? (G.time * 30) % 4 : 0;
    for(let i = -1; i <= 2; i++){ const px = x + 3 + i * 4 + spinOff + wob; c.moveTo(px, y + h - 3); c.lineTo(px + 1.6, y + 3.5); }
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, x + w / 2 - 2.5 + wob, y + 3.6, 2.4, 1.2, -0.3); c.fill();
    c.fillStyle = '#f3ead7'; c.fillRect(x + 0.5 + wob, y + h - 2.4, w - 1, 1.2);
    if(e.st === 'spin'){ c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8; c.beginPath(); for(let i = 0; i < 3; i++){ const sx = e.face > 0 ? x - 3 - i * 3 : x + w + 3 + i * 3; c.moveTo(sx, y + 4 + i * 3); c.lineTo(sx - e.face * 4, y + 4 + i * 3); } c.stroke(); }
  } else if(e.k === 'flier'){
    const fl = Math.sin(G.time * 40 + e.id);
    c.fillStyle = 'rgba(255,255,255,.75)'; ell(c, x + 4, y + 1 - fl, 3, 2 + fl, -0.4); c.fill(); ell(c, x + 8, y + 0.6 - fl, 3, 2 + fl, 0.4); c.fill();
    c.fillStyle = '#ffcf3f'; ell(c, x + 6, y + 6, 6, 4.4); c.fill();
    c.fillStyle = '#2b2440'; c.fillRect(x + 4, y + 2, 1.6, 8); c.fillRect(x + 7.4, y + 2, 1.6, 8);
    c.fillStyle = '#2b2440'; c.beginPath(); const tx = e.face > 0 ? x : x + 12; c.moveTo(tx, y + 5); c.lineTo(tx - e.face * 3, y + 6.5); c.lineTo(tx, y + 8); c.fill();
    eyes(c, e.face > 0 ? x + 8.6 : x + 1.6, y + 5, e.face, false, 2.2);
  } else if(e.k === 'spiky'){
    const pk = W_.prick;
    c.fillStyle = '#2b2440'; ell(c, x + 3 + walkPh, y + 11.2, 2.4, 1.2); c.fill(); ell(c, x + 9 - walkPh, y + 11.2, 2.4, 1.2); c.fill();
    c.fillStyle = pk[1];
    for(let i = 0; i < 9; i++){ const a = Math.PI + i * Math.PI / 8 + Math.sin(G.time * 3) * 0.05; c.beginPath(); c.moveTo(x + 6 + Math.cos(a - 0.22) * 5, y + 7 + Math.sin(a - 0.22) * 5); c.lineTo(x + 6 + Math.cos(a) * 8.6, y + 7 + Math.sin(a) * 8.6); c.lineTo(x + 6 + Math.cos(a + 0.22) * 5, y + 7 + Math.sin(a + 0.22) * 5); c.fill(); }
    c.fillStyle = pk[0]; circ(c, x + 6, y + 7, 5.2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.3)'; circ(c, x + 4, y + 5, 1.6); c.fill();
    eyes(c, x + 4.2 + e.face * 0.8, y + 7.4, e.face, true, 3);
  } else if(e.k === 'hopper'){
    const fr = W_.frog;
    if(e.st === 'flat'){ c.fillStyle = fr[1]; ell(c, x + 7, y + h - 2, 8, 2.4); c.fill(); c.restore(); return; }
    const jumping = e.t < 0.55;
    c.fillStyle = fr[1];
    if(jumping){ ell(c, x + 3, y + h + 1, 1.6, 3.4, 0.4); c.fill(); ell(c, x + 11, y + h + 1, 1.6, 3.4, -0.4); c.fill(); }
    else { ell(c, x + 3, y + h - 1.4, 3, 1.6); c.fill(); ell(c, x + 11, y + h - 1.4, 3, 1.6); c.fill(); }
    c.fillStyle = fr[0]; ell(c, x + 7, y + 7.5, 7, 4.8); c.fill();
    c.fillStyle = shade(fr[0], 1.25); ell(c, x + 7, y + 9, 4.5, 2.4); c.fill();
    c.fillStyle = fr[0]; circ(c, x + 4, y + 3, 2.6); c.fill(); circ(c, x + 10, y + 3, 2.6); c.fill();
    c.fillStyle = '#fff'; circ(c, x + 4, y + 2.7, 1.7); c.fill(); circ(c, x + 10, y + 2.7, 1.7); c.fill();
    c.fillStyle = '#1d1630'; circ(c, x + 4 + e.face * 0.6, y + 2.9, 0.9); c.fill(); circ(c, x + 10 + e.face * 0.6, y + 2.9, 0.9); c.fill();
    c.strokeStyle = '#1d1630'; c.lineWidth = 0.6; c.beginPath(); c.arc(x + 7, y + 7, 2.5, 0.3, Math.PI - 0.3); c.stroke();
  }
  c.restore();
}
function drawItem(c, e){
  const x = e.x, y = e.y, cx = x + 6, cy = y + 6;
  if(e.k === 'grow'){
    c.fillStyle = 'rgba(255,200,80,.25)'; circ(c, cx, cy + 1, 7.5 + Math.sin(G.time * 6) * 0.6); c.fill();
    c.fillStyle = '#c93a2a'; circ(c, cx, cy + 1.5, 5.6); c.fill();
    c.fillStyle = '#ff6a3d'; circ(c, cx - 0.4, cy + 1, 4.8); c.fill();
    c.fillStyle = '#ffd45e'; for(const d of [[-2, 0], [1.5, -1.2], [0.5, 2.2], [-1.6, 2.8], [2.4, 1.6]]) { c.fillRect(cx + d[0], cy + 1 + d[1], 0.9, 0.9); }
    c.fillStyle = 'rgba(255,255,255,.6)'; ell(c, cx - 2.2, cy - 0.8, 1.4, 0.9, -0.5); c.fill();
    c.fillStyle = '#4bc452'; ell(c, cx + 2, cy - 4, 2.8, 1.3, -0.5); c.fill(); c.fillStyle = '#3e8a3a'; c.fillRect(cx - 0.4, cy - 5.4, 0.9, 2.4);
  } else if(e.k === 'zap'){
    c.fillStyle = '#3e9b3a'; c.fillRect(cx - 0.5, cy + 2, 1, 5); ell(c, cx - 2.4, cy + 5.5, 2.2, 1, 0.4); c.fill(); ell(c, cx + 2.4, cy + 5, 2.2, 1, -0.4); c.fill();
    for(let i = 0; i < 5; i++){ const a = G.time * 1.5 + i * Math.PI * 0.4; c.fillStyle = '#ffe14a'; circ(c, cx + Math.cos(a) * 3.4, cy - 0.5 + Math.sin(a) * 3.4, 2.4); c.fill(); }
    c.fillStyle = '#7fe3ff'; circ(c, cx, cy - 0.5, 2.3); c.fill(); c.fillStyle = '#fff'; circ(c, cx - 0.6, cy - 1.1, 0.9); c.fill();
    if(Math.floor(G.time * 8) % 3 === 0){ c.strokeStyle = '#bff6ff'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(cx + 5, cy - 4); c.lineTo(cx + 6.5, cy - 2.5); c.lineTo(cx + 5.5, cy - 2); c.lineTo(cx + 7, cy - 0.5); c.stroke(); }
  } else if(e.k === 'star'){
    c.fillStyle = hue(G.time * 400, 95, 70); c.globalAlpha = 0.35; circ(c, cx, cy, 8); c.fill(); c.globalAlpha = 1;
    c.fillStyle = hue(G.time * 400); star5(c, cx, cy, 6.8, 3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; star5(c, cx - 0.6, cy - 0.8, 3.4, 1.4); c.fill();
    c.fillStyle = '#1d1630'; c.fillRect(cx - 2, cy - 1, 0.9, 1.8); c.fillRect(cx + 1.1, cy - 1, 0.9, 1.8);
  } else if(e.k === 'life'){
    c.fillStyle = 'rgba(125,255,138,.25)'; circ(c, cx, cy, 8); c.fill();
    c.fillStyle = '#2f9e44'; for(const a of [0, 2.1, 4.2]){ ell(c, cx + Math.cos(a - 1.57) * 2.6, cy + Math.sin(a - 1.57) * 2.6, 3, 2.4, a); c.fill(); }
    c.fillStyle = '#62e06a'; for(const a of [0, 2.1, 4.2]){ ell(c, cx + Math.cos(a - 1.57) * 2.6, cy + Math.sin(a - 1.57) * 2.6, 2.2, 1.7, a); c.fill(); }
    c.fillStyle = '#2f9e44'; c.fillRect(cx - 0.4, cy + 2, 0.9, 4);
    outlined(c, '1UP', cx, cy - 8, 3.6, '#7dff8a');
  }
}
function drawProp(c, e){
  const W_ = G.world, x = e.x, y = e.y;
  if(e.k === 'spark'){
    c.fillStyle = 'rgba(255,240,150,.4)'; circ(c, x + 3, y + 3, 5); c.fill();
    c.fillStyle = '#fff6b0'; c.save(); c.translate(x + 3, y + 3); c.rotate(G.time * 14); star5(c, 0, 0, 4, 1.4); c.fill(); c.restore();
  } else if(e.k === 'plat' || e.k === 'lift'){
    const w = e.w, p = W_.plat;
    if(W_.key === 'sky'){ c.fillStyle = '#e4e2fb'; rr(c, x, y + 2, w, 6, 3); c.fill(); c.fillStyle = '#fff'; for(let i = 0; i < w / 6; i++){ circ(c, x + 3 + i * 6, y + 2.5, 3.6); c.fill(); } }
    else if(W_.key === 'caves'){ c.fillStyle = p[1]; rr(c, x, y, w, 8, 2); c.fill(); c.fillStyle = p[0]; rr(c, x + 0.5, y, w - 1, 5, 2); c.fill(); c.fillStyle = p[2]; c.fillRect(x + 2, y + 0.6, w - 4, 1); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(x + 4, y + 2, 3, 1); }
    else { c.fillStyle = p[1]; rr(c, x, y, w, 8, 4); c.fill(); c.fillStyle = p[0]; rr(c, x + 0.5, y + 0.5, w - 1, 6, 3.5); c.fill(); c.fillStyle = shade('#a8693b', 1.25); c.fillRect(x + 4, y + 2, w - 8, 1);
      c.fillStyle = '#e0b07a'; ell(c, x + 3, y + 4, 2.2, 3); c.fill(); ell(c, x + w - 3, y + 4, 2.2, 3); c.fill(); c.strokeStyle = p[1]; c.lineWidth = 0.5; circ(c, x + w - 3, y + 4, 1.2); c.stroke();
      c.fillStyle = p[2]; for(let i = 0; i < w / 8; i++){ c.beginPath(); c.moveTo(x + 5 + i * 8, y + 0.5); c.lineTo(x + 6 + i * 8, y - 2.5); c.lineTo(x + 7.5 + i * 8, y + 0.5); c.fill(); } }
    if(e.k === 'lift'){ c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.6; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x + w / 2, y + 8); c.lineTo(x + w / 2, y + 30); c.stroke(); c.setLineDash([]); }
  } else if(e.k === 'spring'){
    const cmp = e.t > 0 && e.t < 0.3 ? Math.sin(e.t / 0.3 * Math.PI) : 0, top = y + 1 + cmp * 3;
    c.fillStyle = '#5a5470'; rr(c, x + 1, y + 7, 14, 3, 1); c.fill();
    c.strokeStyle = '#c9c4dc'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 4, y + 7);
    for(let i = 0; i < 4; i++){ const yy = y + 7 - (7 - (top - y) - 2) * (i + 0.5) / 4; c.lineTo(i % 2 ? x + 4 : x + 12, yy); }
    c.lineTo(x + 8, top + 2); c.stroke();
    c.fillStyle = '#e8483c'; rr(c, x, top, 16, 3.4, 1.7); c.fill(); c.fillStyle = '#fff'; circ(c, x + 4, top + 1.4, 0.9); c.fill(); circ(c, x + 9, top + 1.2, 0.9); c.fill(); circ(c, x + 13, top + 1.6, 0.7); c.fill();
  } else if(e.k === 'check'){
    const got = e.st === 'got';
    c.fillStyle = '#e9e5f2'; c.fillRect(x + 7, y + 2, 1.6, 42); c.fillStyle = got ? '#ffd45e' : '#9d97b8'; circ(c, x + 7.8, y + 2, 1.8); c.fill();
    const wv = Math.sin(G.time * 6) * 1.2;
    c.fillStyle = got ? '#3fd07a' : '#8a86a8'; c.beginPath(); c.moveTo(x + 8.6, y + 4); c.quadraticCurveTo(x + 14, y + 6 + wv, x + 19, y + 7 + wv); c.lineTo(x + 8.6, y + 13); c.fill();
    if(got){ c.fillStyle = '#fff'; star5(c, x + 12, y + 8 + wv * 0.4, 2, 0.9); c.fill(); }
    c.fillStyle = '#5a5470'; rr(c, x + 4, y + 41, 8, 3, 1); c.fill();
  } else if(e.k === 'pole'){
    c.fillStyle = '#5a5470'; rr(c, x - 4, y + e.h - 5, 12, 5, 1.5); c.fill();
    c.fillStyle = '#f2eff9'; c.fillRect(x + 0.8, y, 2.4, e.h - 4); c.fillStyle = '#c9c4dc'; c.fillRect(x + 2.4, y, 0.8, e.h - 4);
    c.fillStyle = '#ffd45e'; circ(c, x + 2, y - 2, 3.2); c.fill(); c.fillStyle = '#fff6c4'; circ(c, x + 1, y - 3, 1.1); c.fill();
    const fy = y + 4 + (G.goalT >= 0 ? Math.min(1, G.goalT / 1.2) : 0) * (e.h - 26), wv = Math.sin(G.time * 5) * 1.5;
    c.fillStyle = '#3fd07a'; c.beginPath(); c.moveTo(x, fy); c.quadraticCurveTo(x - 9, fy + 3 + wv, x - 18, fy + 5 + wv); c.lineTo(x, fy + 13); c.fill();
    c.fillStyle = '#fff'; star5(c, x - 7, fy + 6 + wv * 0.5, 2.6, 1.1); c.fill();
  } else if(e.k === 'house'){
    const k = W_.key, wall = k === 'caves' ? '#8f7ad0' : k === 'sky' ? '#fff4fb' : '#fff1d6', roof = k === 'caves' ? '#43e2c9' : k === 'sky' ? '#ffd45e' : '#e2583c', rdk = shade(roof, 0.7);
    c.fillStyle = shade(wall.length === 7 ? wall : '#fff1d6', 0.85); c.fillRect(x + 4, y + 16, 40, 24);
    c.fillStyle = wall; c.fillRect(x + 4, y + 16, 38, 24);
    c.fillStyle = rdk; c.beginPath(); c.moveTo(x - 2, y + 18); c.lineTo(x + 24, y - 2); c.lineTo(x + 50, y + 18); c.fill();
    c.fillStyle = roof; c.beginPath(); c.moveTo(x + 1, y + 16); c.lineTo(x + 24, y + 1); c.lineTo(x + 47, y + 16); c.fill();
    c.fillStyle = '#6b4b3a'; c.fillRect(x + 33, y + 1, 5, 10);
    if(k !== 'caves'){ for(let i = 0; i < 3; i++){ const t = (G.time * 0.6 + i / 3) % 1; c.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - t)) + ')'; circ(c, x + 35.5 + Math.sin(t * 6) * 2, y - 2 - t * 16, 2 + t * 3); c.fill(); } }
    c.fillStyle = '#4a3450'; rr(c, x + 18, y + 24, 12, 16, 6); c.fill(); c.fillRect(x + 18, y + 32, 12, 8);
    c.fillStyle = '#ffd45e'; circ(c, x + 27, y + 33, 0.9); c.fill();
    c.fillStyle = '#7fd3ff'; c.fillRect(x + 7, y + 22, 7, 6); c.fillStyle = '#fff'; c.fillRect(x + 10, y + 22, 1, 6); c.fillRect(x + 7, y + 24.5, 7, 1);
    c.fillStyle = '#7fd3ff'; c.fillRect(x + 34, y + 22, 7, 6); c.fillStyle = '#fff'; c.fillRect(x + 37, y + 22, 1, 6); c.fillRect(x + 34, y + 24.5, 7, 1);
  } else if(e.k === 'shard'){
    if(e.st === 'warn'){
      const a = 0.35 + 0.35 * Math.sin(G.time * 30);
      c.fillStyle = 'rgba(0,0,0,' + (0.2 + e.t * 0.2) + ')'; ell(c, x + 4, 12 * T - 1, 4 + e.t * 4, 1.4); c.fill();
      c.fillStyle = 'rgba(164,245,255,' + a + ')'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y + 10 * Math.min(1, e.t * 1.4)); c.lineTo(x + 8, y); c.fill();
    } else {
      c.fillStyle = '#3aa6c8'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 8, y); c.lineTo(x + 4, y + 12); c.fill();
      c.fillStyle = '#c6f8ff'; c.beginPath(); c.moveTo(x + 1.5, y); c.lineTo(x + 4, y); c.lineTo(x + 4, y + 10); c.fill();
    }
  } else if(e.k === 'bolt'){
    const h = e.h;
    c.fillStyle = 'rgba(255,245,170,.25)'; c.fillRect(x - 6, y, 22, h);
    c.strokeStyle = '#fff6b0'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 5, y);
    for(let i = 1; i <= 8; i++) c.lineTo(x + 5 + (i % 2 ? 4 : -4) * (i < 8 ? 1 : 0), y + h * i / 8); c.stroke();
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, x + 5, y + h, 10, 3); c.fill();
  }
}
function drawBoss(c, e){
  const x = e.x, y = e.y, w = e.w, h = e.h, f = e.face || -1, flash = e.inv > 0 && Math.floor(G.time * 16) % 2;
  c.save();
  if(e.st === 'defeat'){ c.translate(x + w / 2, y + h / 2); c.rotate(e.t * 4 * f); c.translate(-(x + w / 2), -(y + h / 2)); }
  if(e.bw === 0){
    const spikes = e.st === 'bristle' || e.st === 'charge', jig = e.st === 'bristle' ? Math.sin(G.time * 60) * 0.8 : 0;
    const ph = Math.sin(G.time * (e.st === 'charge' ? 22 : 10));
    c.fillStyle = '#3b2a1c'; for(let i = 0; i < 4; i++){ ell(c, x + 6 + i * 7.5 + (i % 2 ? ph : -ph) * 1.5, y + h - 1, 3, 2); c.fill(); }
    c.fillStyle = spikes ? '#ff5a4e' : '#4f7a33';
    const n = 9;
    for(let i = 0; i < n; i++){ const a = Math.PI * 1.05 + i * (Math.PI * 0.9) / (n - 1), L2 = spikes ? 11 : 6;
      c.beginPath(); c.moveTo(x + w / 2 + jig + Math.cos(a - 0.14) * 14, y + h * 0.62 + Math.sin(a - 0.14) * 12); c.lineTo(x + w / 2 + jig + Math.cos(a) * (14 + L2), y + h * 0.62 + Math.sin(a) * (12 + L2)); c.lineTo(x + w / 2 + jig + Math.cos(a + 0.14) * 14, y + h * 0.62 + Math.sin(a + 0.14) * 12); c.fill(); }
    c.fillStyle = flash ? '#ffffff' : '#6b8f3a'; ell(c, x + w / 2 + jig, y + h * 0.6, w / 2, h * 0.5); c.fill();
    c.fillStyle = flash ? '#ffffff' : '#86ad4a'; ell(c, x + w / 2 + jig - 3, y + h * 0.48, w / 3, h * 0.25); c.fill();
    const fx0 = f > 0 ? x + w - 8 : x + 8;
    c.fillStyle = '#c58d5a'; ell(c, fx0 + jig, y + h * 0.66, 7.5, 6); c.fill();
    c.fillStyle = '#8a5a34'; ell(c, fx0 + f * 4 + jig, y + h * 0.7, 3, 2.4); c.fill();
    c.fillStyle = '#1d1630'; circ(c, fx0 + f * 3.4 + jig, y + h * 0.7, 0.7); c.fill();
    c.fillStyle = '#fff4dc'; c.beginPath(); c.moveTo(fx0 + f * 1 + jig, y + h * 0.8); c.lineTo(fx0 + f * 2 + jig, y + h * 0.95 + 2); c.lineTo(fx0 + f * 3 + jig, y + h * 0.8); c.fill();
    if(e.st === 'stun'){ for(let i = 0; i < 3; i++){ const a = G.time * 6 + i * 2.1; c.fillStyle = '#ffd45e'; star5(c, fx0 + Math.cos(a) * 8, y + 2 + Math.sin(a) * 2.5, 2.2, 1); c.fill(); } eyes(c, fx0 - 3, y + h * 0.5, f, false, 4); }
    else eyes(c, fx0 - 3 + f, y + h * 0.5, f, true, 4);
  } else if(e.bw === 1){
    const clawsUp = e.st === 'claws', tired = e.st === 'tired' || e.st === 'stun', ph = Math.sin(G.time * (e.st === 'scuttle' ? 26 : 6));
    c.strokeStyle = '#a8342a'; c.lineWidth = 1.8;
    for(let i = 0; i < 3; i++){ for(const sd of [-1, 1]){ const bx = x + w / 2 + sd * (8 + i * 4); c.beginPath(); c.moveTo(bx, y + h - 6); c.lineTo(bx + sd * 4, y + h - 3 + (i % 2 ? ph : -ph)); c.lineTo(bx + sd * 5, y + h); c.stroke(); } }
    for(const sd of [-1, 1]){
      const bx = x + w / 2 + sd * 17, lift = clawsUp ? -14 + Math.sin(G.time * 18) * 1.5 : tired ? 2 : -2;
      c.strokeStyle = '#c9412f'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + w / 2 + sd * 10, y + h - 9); c.lineTo(bx, y + h - 10 + lift); c.stroke();
      c.fillStyle = flash ? '#fff' : clawsUp ? '#ff6a4e' : '#e2583c'; ell(c, bx + sd * 2, y + h - 12 + lift, 5.5, 4.2, sd * 0.4); c.fill();
      c.fillStyle = '#1d1630'; c.beginPath(); c.moveTo(bx + sd * 2, y + h - 12 + lift); c.lineTo(bx + sd * 8, y + h - 14 + lift); c.lineTo(bx + sd * 6, y + h - 10 + lift); c.fill();
      if(clawsUp){ c.fillStyle = 'rgba(255,255,200,.6)'; circ(c, bx + sd * 2, y + h - 12 + lift, 7); c.fill(); }
    }
    c.fillStyle = flash ? '#fff' : '#e2583c'; ell(c, x + w / 2, y + h - 8, w / 2 - 3, 9); c.fill();
    c.fillStyle = flash ? '#fff' : '#ff8a5e'; ell(c, x + w / 2, y + h - 11, w / 2 - 8, 4); c.fill();
    const cols = ['#a4f5ff', '#ff9ad8', '#a4f5ff', '#fff4a8'];
    for(let i = 0; i < 4; i++){ const sx = x + 9 + i * 6.5, hh = 7 + (i % 2) * 4; c.fillStyle = cols[i]; c.beginPath(); c.moveTo(sx - 2.5, y + h - 14); c.lineTo(sx, y + h - 14 - hh); c.lineTo(sx + 2.5, y + h - 14); c.fill(); }
    for(const sd of [-1, 1]){ const ex = x + w / 2 + sd * 5; c.strokeStyle = '#c9412f'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(ex, y + h - 12); c.lineTo(ex, y + h - 18); c.stroke();
      c.fillStyle = '#fff'; circ(c, ex, y + h - 19, 2.4); c.fill();
      if(tired){ c.strokeStyle = '#1d1630'; c.lineWidth = 0.6; c.beginPath(); c.arc(ex, y + h - 19, 1.3, G.time * 8, G.time * 8 + 4.5); c.stroke(); }
      else { c.fillStyle = '#1d1630'; circ(c, ex + f * 0.8, y + h - 18.6, 1.1); c.fill(); } }
    c.strokeStyle = '#7a2a20'; c.lineWidth = 0.8; c.beginPath(); c.arc(x + w / 2, y + h - 6, 3, 0.3, Math.PI - 0.3); c.stroke();
  } else {
    const low = e.st === 'low' || e.st === 'swoop', charging = e.st === 'warn';
    const cy = y + h - 9, cloudCol = flash ? '#ffffff' : charging ? '#5d5a8f' : '#77739f';
    if(charging && Math.floor(G.time * 20) % 2){ c.strokeStyle = 'rgba(255,245,170,.8)'; c.lineWidth = 1; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x + w / 2, y + h); c.lineTo(x + w / 2, 12 * T); c.stroke(); c.setLineDash([]); }
    // Baron himself
    const bx = x + w / 2, by = y + 9 + Math.sin(G.time * 3) * 0.8;
    c.fillStyle = flash ? '#fff' : '#8e5bd6'; circ(c, bx, by, 7); c.fill();
    c.fillStyle = flash ? '#fff' : '#b48cf0'; circ(c, bx - 2, by - 2, 3); c.fill();
    c.fillStyle = '#231c35'; rr(c, bx - 7, by - 7.5, 14, 2.2, 1); c.fill(); c.fillRect(bx - 4.5, by - 16, 9, 9);
    c.fillStyle = '#ffd45e'; c.fillRect(bx - 4.5, by - 9.4, 9, 1.4);
    if(e.st === 'stun'){ for(let i = 0; i < 3; i++){ const a = G.time * 6 + i * 2.1; c.fillStyle = '#ffd45e'; star5(c, bx + Math.cos(a) * 10, by - 17 + Math.sin(a) * 2.5, 2.2, 1); c.fill(); } }
    eyes(c, bx - 2.2 + f * 0.6, by - 1, f, e.st !== 'stun', 4);
    c.fillStyle = '#e9e5f2'; c.beginPath(); c.moveTo(bx, by + 2.5); c.quadraticCurveTo(bx - 5, by + 1, bx - 8, by + 4); c.quadraticCurveTo(bx - 4, by + 4.5, bx, by + 3.6); c.quadraticCurveTo(bx + 4, by + 4.5, bx + 8, by + 4); c.quadraticCurveTo(bx + 5, by + 1, bx, by + 2.5); c.fill();
    // storm cloud
    c.fillStyle = cloudCol;
    for(const p of [[-13, 2, 7], [-5, -1, 9], [5, -1, 9], [13, 2, 7], [0, 3, 8]]){ circ(c, bx + p[0], cy + p[1], p[2]); c.fill(); }
    c.fillStyle = flash ? '#fff' : '#9d99c4'; circ(c, bx - 6, cy - 3, 4); c.fill();
    if(!low && Math.floor(G.time * 6) % 5 === 0){ c.strokeStyle = '#fff6b0'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(bx - 8, cy + 8); c.lineTo(bx - 6, cy + 12); c.lineTo(bx - 9, cy + 13); c.lineTo(bx - 7, cy + 17); c.stroke(); }
  }
  c.restore();
}

/* ---------- HUD and overlays ---------- */
function heart(c, x, y, s, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.3, y, x - s * 0.7, y - s * 0.9, x, y - s * 0.25); c.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.3, y, x, y + s * 0.9); c.fill(); }
function drawHUD(c){
  const def = LEVELS[G.lv];
  const g = c.createLinearGradient(0, 0, 0, 18); g.addColorStop(0, 'rgba(10,8,24,.55)'); g.addColorStop(1, 'rgba(10,8,24,0)');
  c.fillStyle = g; c.fillRect(0, 0, VW, 18);
  outlined(c, String(G.score).padStart(7, '0'), 8, 8, 7, '#fff6e0', 'left');
  outlined(c, def.code + '  ' + def.name.toUpperCase(), VW / 2, 8, 5, '#ffd45e');
  drawCoin(c, VW - 70, 8, Math.abs(Math.cos(G.time * 3)));
  outlined(c, '×' + String(G.coins % 100).padStart(2, '0'), VW - 63, 8.4, 6, '#fff6e0', 'left');
  if(hasLives()){ heart(c, VW - 28, 7.5, 3.4, '#ff5a6e'); outlined(c, '×' + Math.max(0, G.lives), VW - 23, 8.4, 6, '#fff6e0', 'left'); }
  else outlined(c, 'KIDS', VW - 20, 8.4, 5, '#7dff8a');
  if(G.players.length > 1){
    G.players.forEach((p, i) => {
      const x = 8 + i * 60, y = 19;
      c.fillStyle = 'rgba(10,8,24,.4)'; rr(c, x - 2, y - 4, 56, 8, 3); c.fill();
      c.fillStyle = p.color; circ(c, x + 2, y, 2.4); c.fill();
      if(p.power > 0){ c.fillStyle = p.power === 2 ? '#ffe14a' : '#ff6a3d'; circ(c, x + 49, y, 1.6); c.fill(); }
      const nm = p.name.toUpperCase(), sz = fitText(c, nm, 38, 4.5);
      text(c, nm, x + 7, y, sz, p.bubble ? '#a9a6c0' : '#fff6e0', 'left', 'middle');
    });
  }
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.st !== 'defeat'){
    const bw = 90, bx = VW / 2 - bw / 2, by = VH - 15;
    c.fillStyle = 'rgba(10,8,24,.6)'; rr(c, bx - 4, by - 8, bw + 8, 17, 4); c.fill();
    outlined(c, boss.name, VW / 2, by - 3, 4.5, '#ff9a8a');
    for(let i = 0; i < boss.max; i++){ const px = VW / 2 - (boss.max - 1) * 6 + i * 12; heart(c, px, by + 4.5, 2.6, i < boss.hp ? '#ff5a6e' : 'rgba(255,255,255,.2)'); }
  }
  if(!A.Input.isTouch && G.state === 'play' && G.lvT < 5 && G.net !== 'guest') text(c, 'PAUSE: START / ESC', 8, VH - 10, 4.5, 'rgba(255,255,255,.55)');
  // heroes above the top of the screen get a marker
  for(const p of G.players){
    if(p.done === 3 || p.bubble) continue;
    if(p.y + p.h < G.cam.y + 2){ const sx = p.x + p.w / 2 - G.cam.x; c.fillStyle = p.color; c.beginPath(); c.moveTo(sx, 20); c.lineTo(sx - 3.5, 25); c.lineTo(sx + 3.5, 25); c.fill(); }
  }
}
function drawIntro(c){
  const def = LEVELS[G.lv], t = G.stateT, len = G.introLen || 2.4;
  const a = Math.min(1, t * 5) * Math.min(1, Math.max(0, (len - t) / 0.35));
  c.globalAlpha = a;
  c.fillStyle = 'rgba(12,10,28,.82)'; c.fillRect(0, 0, VW, VH);
  const W_ = WORLDS[def.w];
  outlined(c, 'WORLD ' + def.code, VW / 2, 62, 8, '#ffd45e');
  outlined(c, def.name.toUpperCase(), VW / 2, 82, fitText(c, def.name.toUpperCase(), VW - 40, 14), '#fff6e0');
  outlined(c, isBoss(G.lv) ? 'BOSS: ' + BOSS_NAMES[def.boss] : W_.name.toUpperCase(), VW / 2, 100, 5.5, isBoss(G.lv) ? '#ff9a8a' : '#9fe8d7');
  const n = G.players.length;
  G.players.forEach((p, i) => {
    const cx = VW / 2 - (n - 1) * 26 + i * 52;
    const fake = Object.assign({}, p, { x: cx - 6, y: 140 - p.h, onGround: true, vx: 0, inv: 0, bubble: false, dead: 0, done: 0, face: 1, star: 0, growT: 0, squashT: 0 });
    drawHero(c, fake);
    const nm = p.name.toUpperCase(); outlined(c, nm, cx, 150, fitText(c, nm, 48, 5), p.color);
  });
  if(hasLives()){ heart(c, VW / 2 - 12, 172, 4, '#ff5a6e'); outlined(c, '× ' + G.lives, VW / 2 + 4, 172.5, 7, '#fff6e0'); }
  else outlined(c, 'KIDS MODE · NO GAME OVER', VW / 2, 172, 5, '#7dff8a');
  c.globalAlpha = 1;
}
function drawClear(c){
  const boss = isBoss(G.lv), msg = boss ? 'BOSS DEFEATED!' : 'COURSE CLEAR!';
  const t = G.stateT, n = msg.length, size = 13;
  c.font = size + 'px ' + FONT; const wAll = c.measureText(msg).width;
  let x = VW / 2 - wAll / 2;
  for(let i = 0; i < n; i++){
    const ch = msg[i], cw = c.measureText(ch).width;
    const appear = Math.max(0, Math.min(1, (t * 12 - i) / 2));
    if(appear > 0) outlined(c, ch, x + cw / 2, 70 - Math.sin(Math.min(1, appear) * Math.PI) * 8 + Math.sin(G.time * 5 + i * 0.6) * 1.5, size, hue(i * 25 + G.time * 90, 90, 68));
    x += cw;
  }
  if(t > 0.8){ outlined(c, 'SCORE ' + G.score.toLocaleString(), VW / 2, 92, 6, '#fff6e0'); outlined(c, 'TIME ' + fmt(G.lvT), VW / 2, 104, 5, '#9fe8d7'); }
}
function drawEnding(c){
  const t = G.stateT, a = Math.min(1, t / 2);
  const cx = VW / 2, cy = 190;
  const cols = ['#ff5a6e', '#ff9f43', '#ffd45e', '#7dff8a', '#3fd0b0', '#7aa8ff', '#b48cf0'];
  c.globalAlpha = a * 0.85; c.lineWidth = 6;
  for(let i = 0; i < 7; i++){ c.strokeStyle = cols[i]; c.beginPath(); c.arc(cx, cy, 170 - i * 6, Math.PI, Math.PI + Math.PI * Math.min(1, t / 2.5)); c.stroke(); }
  c.globalAlpha = 1;
  if(t > 1.2 && t < 6){ outlined(c, 'THE RAINBOW IS FREE!', VW / 2, 52, 11, hue(G.time * 80, 90, 72)); outlined(c, 'THANK YOU, HEROES', VW / 2, 70, 6, '#fff6e0'); }
  if(t > 2.4 && t < 6) outlined(c, 'An xRetro original · art, levels & music made in code', VW / 2, 84, 4.2, '#d8d2ff');
}
function drawNames(c){
  if(G.players.length < 2 || G.demo) return;
  for(const p of G.players){
    if(p.done === 3) continue;
    const top = p.bubble ? p.y + p.h / 2 - 17 : p.y - 8;
    const nm = p.name.toUpperCase();
    outlined(c, nm, p.x + p.w / 2, top, fitText(c, nm, 40, 4), p.color);
  }
}
function drawPitNets(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  if(!D().pitBounce){
    const g = c.createLinearGradient(0, 12 * T, 0, LH);
    g.addColorStop(0, 'rgba(10,6,24,0)'); g.addColorStop(1, 'rgba(10,6,24,.55)');
    c.fillStyle = g;
    for(let tx = tx0; tx <= tx1; tx++) if(tx >= 0 && tx < G.W && !isSolid(tileAt(tx, ROWS - 1))) c.fillRect(tx * T, 12 * T, T, 2 * T);
    return;
  }
  for(let tx = tx0; tx <= tx1; tx++){
    if(isSolid(tileAt(tx, ROWS - 1)) || tx < 0 || tx >= G.W) continue;
    const x = tx * T, y = LH - 5 + Math.sin(G.time * 5 + tx) * 0.6;
    c.fillStyle = 'rgba(255,90,110,.85)'; c.fillRect(x, y, T, 2.4);
    c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(x + 4, y, 4, 2.4); c.fillRect(x + 12, y, 4, 2.4);
  }
}

let lastT = 0;
function render(dt){
  if(G.net === 'guest') guestFrame(dt);
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  if(!G.map) return;
  const paused = G.state === 'paused' || G.state === 'results' || G.state === 'gameover';
  if(!paused) fxStep(Math.min(dt, 0.05));
  let shx = 0;
  if(G.shake > 0){ G.shake = Math.max(0, G.shake - dt); shx = (Math.random() - 0.5) * 8 * G.shake; }
  const shy = G.shake > 0 ? (Math.random() - 0.5) * 6 * G.shake : 0;
  const camX = Math.round((G.cam.x + shx) * s) / s, camY = Math.round((G.cam.y + shy) * s) / s;
  c.setTransform(s, 0, 0, s, 0, 0);
  drawBG(c, camX);
  const world = () => c.setTransform(s, 0, 0, s, -camX * s, -camY * s);
  world();
  for(const e of G.ents) if(e.k === 'house' || e.k === 'pole' || e.k === 'check') drawProp(c, e);
  for(const e of G.ents) if(ITEMS.has(e.k) && e.st === 'rise') drawItem(c, e);
  c.setTransform(1, 0, 0, 1, 0, 0);
  drawTiles(c, camX, camY, s);
  world();
  drawCoins(c, camX);
  drawPitNets(c, camX);
  for(const e of G.ents){
    if(e.k === 'house' || e.k === 'pole' || e.k === 'check') continue;
    if(ITEMS.has(e.k)){ if(e.st !== 'rise') drawItem(c, e); }
    else if(FOES.has(e.k)) drawFoe(c, e);
    else if(e.k === 'boss') drawBoss(c, e);
    else drawProp(c, e);
  }
  const order = G.players.slice().sort((a, b) => (a.bubble ? 1 : 0) - (b.bubble ? 1 : 0));
  for(const p of order){ if(p.bubble) drawBubble(c, p); else drawHero(c, p); }
  for(const p of parts){
    const a = 1 - p.t / p.life;
    if(p.kind === 'text'){ c.globalAlpha = Math.min(1, a * 2); outlined(c, p.str, p.x, p.y, 5, p.col); }
    else if(p.kind === 'coin'){ c.globalAlpha = 1; drawCoin(c, p.x, p.y, Math.abs(Math.cos(p.t * 20))); }
    else if(p.kind === 'chunk'){ c.globalAlpha = a; c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.8); c.restore(); }
    else if(p.kind === 'star'){ c.globalAlpha = a; c.fillStyle = p.col; star5(c, p.x, p.y, p.r * 1.4, p.r * 0.55); c.fill(); }
    else { c.globalAlpha = a; c.fillStyle = p.col; circ(c, p.x, p.y, p.r * (0.5 + a * 0.5)); c.fill(); }
  }
  c.globalAlpha = 1;
  drawNames(c);
  c.setTransform(s, 0, 0, s, 0, 0);
  drawWeather(c, camX);
  if(G.state === 'ending') drawEnding(c);
  else if(!G.demo) drawHUD(c);
  if(G.state === 'intro') drawIntro(c);
  if(G.state === 'clear') drawClear(c);
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.32)'; c.fillRect(0, 0, VW, VH); }
  lastT = G.time;
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('JUMP');
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
window.__hop = G;
window.__hopDebug = { mkEnt, setPower, hurt, toBubble, bumpTile, step, Net, LEVELS, buildLevel, loadLevel, tileAt, startIntro, newGame, results, startClear, ending, sim, active, CH };
})();
