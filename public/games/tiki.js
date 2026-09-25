/* TIKI TRAIL — a tropical side-scroller for 1–2 players on one shared screen, or online.
   Run with the D-pad, FIRE jumps (hold it to jump higher), Down + FIRE throws your stone axe.
   Your ENERGY drains as you go, so keep eating fruit. Eggs hide skateboards, sun charms and melons.
   Three islands, three areas each, and a boss at the end of every island.
   All characters, levels, music and sounds are original and made in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants ---------- */
const VW = 384, VH = 216, T = 16, ROWS = 14, LH = ROWS * T;
const FONT = '"Silkscreen","Courier New",monospace';
const WALK = 84, RUN = 134, BOARD = 182, ACC = 430, AIR_ACC = 320, SKID = 900, FRICTION = 540, BOARD_FRICTION = 60;
const JUMP = 318, G_HOLD = 720, G_FALL = 1500, MAX_FALL = 430, STOMP_V = 250, STOMP_HOLD = 340, SPRING_V = 480, TOWER_V = 440;
const HW = 12, HH = 20;
const SOLID = new Set(['#', 'X', 'k', 'j', 'c']);
const isSolid = ch => SOLID.has(ch);
const FRUIT = { a: 4, b: 4, g: 6, p: 15 };
const isFruit = ch => FRUIT[ch] !== undefined;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

const DIFF = {
  kids:   { label: 'Kids',   lives: Infinity, pitBounce: true,  drain: 1.0, floor: 18, hit: 12,  trip: 0,  enemy: 0.72, bossHp: 6,  rock: 0.72, dive: false },
  normal: { label: 'Normal', lives: 5,        pitBounce: false, drain: 2.1, floor: 0,  hit: 30,  trip: 5,  enemy: 1.0,  bossHp: 9,  rock: 1.0,  dive: true },
  pro:    { label: 'Pro',    lives: 3,        pitBounce: false, drain: 2.8, floor: 0,  hit: 999, trip: 9,  enemy: 1.25, bossHp: 12, rock: 1.2,  dive: true }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];

/* ---------- Music: steel-drum chiptunes, one per island ---------- */
const BEACH_THEME = {
  bpm: 132, steel: true, chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'], bass: 'calypso', arp: 'slow', leadVol: 0.1,
  lead: [
    'E5 . G5 - C6 - G5 . A5 - G5 - E5 - D5 -', 'F5 - A5 - . A5 C6 - A5 - F5 - C5 - - -',
    'D5 - G5 - B5 - D6 - . D6 C6 - B5 - G5 -', 'C6 - - - G5 - E5 - C5 - - - . . G4 -',
    'A5 - C6 - E6 - C6 . A5 - E5 - A5 - C6 -', 'C6 - A5 - F5 - A5 . C6 - F6 - E6 - C6 -',
    'D6 - B5 - G5 - B5 - D6 - - - F5 - E5 -', 'C5 - E5 - G5 - C6 - - - - - . . G4 -'],
  drums: ['k.c.b.cls.cbk.c.', 'k.cbl.c.s.cbk.bl']
};
const JUNGLE_THEME = {
  bpm: 118, steel: true, chords: ['Dm', 'G', 'Dm', 'C', 'Dm', 'G', 'Bb', 'A'], bass: 'calypso', arp: 'slow', leadVol: 0.1,
  lead: [
    'D5 - F5 - A5 - . A5 G5 - F5 - D5 - . .', 'B4 - D5 - G5 - - - F5 - E5 - D5 - B4 -',
    'A5 - . A5 D6 - A5 - F5 - . F5 A5 - - -', 'G5 - E5 - C5 - E5 - G5 - - - . . C5 -',
    'D6 - - - C6 - A5 - F5 - A5 - D6 - F6 -', 'E6 - D6 - B5 - G5 - . G5 B5 - D6 - - -',
    'F5 - Bb5 - D6 - Bb5 - F5 - D5 - F5 - Bb5 -', 'A5 - - - C#6 - - - E6 - - - . . A4 -'],
  drums: ['l.cbl.c.s.cbl.cb', 'l.cbl.cbs.cbllcb']
};
const VOLCANO_THEME = {
  bpm: 146, steel: true, chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'], bass: 'drive', arp: 'fast', leadVol: 0.095,
  lead: [
    'E5 - G5 - B5 - E6 - . E6 D6 - B5 - G5 -', 'C6 - - - G5 - E5 - C6 - B5 - G5 - E5 -',
    'F#5 - A5 - D6 - F#6 - E6 - D6 - A5 - F#5 -', 'D#6 - - - B5 - F#5 - B5 - - - . . B4 -',
    'G5 - B5 - E6 - G6 - F#6 - E6 - B5 - G5 -', 'E6 - - - C6 - G5 - E6 - D6 - C6 - G5 -',
    'A5 - C6 - E6 - A6 - G6 - E6 - C6 - A5 -', 'B5 - - - D#6 - - - F#6 - - - . . B5 -'],
  drums: ['k.cbs.cbk.cbs.cb', 'k.cbs.cbkkcbs.bl']
};
const BOSS_THEME = {
  bpm: 164, steel: true, chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'], bass: 'gallop', arp: 'fast', leadVol: 0.1,
  lead: [
    'A5 - . A5 E6 - A5 - C6 - B5 - A5 - E5 -', 'A5 - . A5 E6 - A5 - D6 - C6 - B5 - C6 -',
    'F5 - A5 - C6 - F6 - E6 - C6 - A5 - F5 -', 'G5 - B5 - D6 - G6 - F6 - D6 - B5 - G5 -',
    'A5 - C6 - E6 - A6 - G6 - E6 - C6 - A5 -', 'B5 - C6 - B5 - A5 - E5 - - - . . A4 -',
    'F5 - - - A5 - - - C6 - - - F6 - - -', 'G#5 - - - B5 - - - E6 - - - - - - -'],
  drums: ['k.bsk.bsk.bsk.ss', 'kkbsk.bskkbsk.bl']
};
const CHARM_THEME = {
  bpm: 180, steel: true, chords: ['C', 'F', 'C', 'G'], bass: 'drive', arp: 'fast', leadVol: 0.1,
  lead: ['E6 . E6 - C6 - G5 - E6 . E6 - G6 - - -', 'F6 . F6 - C6 - A5 - F6 . F6 - A6 - - -',
         'E6 . E6 - C6 - G5 - C6 - E6 - G6 - E6 -', 'D6 - B5 - G5 - B5 - D6 - F6 - G6 - - -'],
  drums: ['k.bbk.bbk.bbkbbb']
};
const ENDING_THEME = {
  bpm: 104, steel: true, chords: ['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'F'], bass: 'calypso', arp: 'slow', leadVol: 0.1,
  lead: [
    'A5 - - - C6 - A5 - F5 - - - G5 - A5 -', 'G5 - - - E5 - C5 - E5 - G5 - C6 - - -',
    'D6 - - - A5 - F5 - A5 - - - D6 - C6 -', 'Bb5 - - - F5 - D5 - F5 - - - . . F5 -',
    'A5 - C6 - F6 - - - E6 - C6 - A5 - - -', 'G5 - C6 - E6 - - - D6 - C6 - G5 - - -',
    'F5 - Bb5 - D6 - - - C6 - Bb5 - G5 - - -', 'F5 - - - - - - - C5 - - - F5 - - -'],
  drums: ['k.c.l.c.s.c.l.c.', 'k.c.l.cbs.c.lbc.']
};

/* ---------- Islands ---------- */
const ISLANDS = [
  { key: 'beach', name: 'Coconut Cove', music: BEACH_THEME, sky: ['#3fa9f5', '#c8f1ff'], pit: 'water',
    g: { top: '#fbe3a2', topHi: '#fff6d8', topDk: '#e2bd72', fill: '#e9c27c', fillDk: '#c99a55', fillHi: '#f8dca0', speck: '#cfa262' },
    stone: ['#b8a48e', '#86735f', '#e4d8c6'], ledge: ['#b27b45', '#6f4523', '#dca36a'],
    snail: ['#ff8fb0', '#c24f73'], frog: ['#4fd2b0', '#1f8a70'] },
  { key: 'jungle', name: 'Jungle Drums', music: JUNGLE_THEME, sky: ['#1f6b5a', '#9fe0a8'], pit: 'river',
    g: { top: '#56c84a', topHi: '#a8f07a', topDk: '#2f8f3a', fill: '#7a4b2e', fillDk: '#5a3620', fillHi: '#9a6440', speck: '#4e2f1c' },
    stone: ['#8f9a86', '#5f6958', '#c2cbb8'], ledge: ['#7a5230', '#4a3018', '#6bd35a'],
    snail: ['#ffb347', '#c9761c'], frog: ['#ff6a5a', '#b8332a'] },
  { key: 'volcano', name: 'Mount Ember', music: VOLCANO_THEME, sky: ['#2a1030', '#ff7a4a'], pit: 'lava',
    g: { top: '#6b5a6e', topHi: '#9a88a0', topDk: '#453a4a', fill: '#3b3040', fillDk: '#261e2c', fillHi: '#56475c', speck: '#ff7a3a' },
    stone: ['#6e6070', '#443a48', '#9c8ea0'], ledge: ['#5a4a5e', '#2e2432', '#ff9a4a'],
    snail: ['#c0a6ff', '#7456c4'], frog: ['#ffd24a', '#c28a12'] }
];

/* ---------- Level pieces ----------
   Rows are bottom-aligned (the last two rows are the ground). Legend:
   # ground   X stone   = ledge (jump up through it)   c crumbling rock   v vine (hold UP to climb)
   r trip stone   F bonfire   k cracked boulder (O = boulder hiding a secret cave)   a b g p fruit
   s snail   e bee   f frog   R rolling rocks come from here   E K S eggs (melon, skateboard, sun charm)
   T bounce flower   - raft   | lift   C torch   P goal gate   Y cave exit   Z boss   @ start */
const CH = {
  S: ['........', '........', '.@......', '########', '########'],
  logs: ['.........aba....', '.........===....', '................', '...bgb..........', '...===..........', '................', '................', '###..........###', '###..........###'],
  steps: ['......a.......', '.....XXX......', '....XXXXX.....', '...XXXXXXX....', '##############', '##############'],
  raft: ['.....a.a.a......', '...-............', '................', '................', '##............##', '##............##'],
  lift: ['..............', '..............', '...|....|.....', '..............', '..............', '##..........##', '##..........##'],
  spring: ['.....ggg.....', '....g...g....', '...a.....a...', '.............', '.............', '.............', '.............', '.............', '.....T.......', '#############', '#############'],
  fires: ['.....bab......', '....=====.....', '..............', '..............', '...F.....F....', '##############', '##############'],
  crumble: ['....a..a..a...', '..............', '##cccccccccc##', '##..........##'],
  cave: ['....XXXX', '..kkXXXX', '..OkXXXX', '########', '########'],
  exit: ['..XXXX....', '.XXXXX....', 'XXXXXXY...', '##########', '##########'],
  canopy: [
    '....a.b.g.a.b.p.a.b.g.a.b.a.................',
    '.v===========================...............',
    '.v..........................................',
    '.v..........................................',
    '.v........e..........e............e.........',
    '.v..........................................',
    '.v..........................................',
    '.v..........................................',
    '.v..r...........F.......f.......r....s......',
    '########...######...##########....##########',
    '########...######...##########....##########'],
  END: ['........................', '........................', '...........P............', '########################', '########################'],
  arena0: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
           'X......................X', 'X......................X', 'X...=====..............X', 'X......................X', 'X......................X', 'X.@..............Z.....X',
           '################......XX', '################......XX'],
  arena1: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
           'X......................X', 'X......................X', 'X...=====......=====...X', 'X......................X', 'X......................X', 'X.@..............Z.....X',
           '########################', '########################'],
  arena2: ['XXXXXXXXXXXXXXXXXXXXXXXX', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
           'X......................X', 'X......................X', 'X..====..........====..X', 'X......................X', 'X......................X', 'X.@.............Z......X',
           '########################', '########################']
};
/* A level is a list of pieces: F<n> flat ground (letters after the number are placed along it),
   G<n> gap (G3o = fruit arc over it, G3L = a lava blob hops out of it), R<h> raise the ground to h,
   C checkpoint torch, or a piece name. */
const LEVELS = [
  { i: 0, code: '1-1', name: 'Sunny Shore', parts: 'S F10a F6s F6b G2 F6ag R1 F6s R0 F6r F4b logs F8s F6a G3o F8b C F6e F8ab spring F6f F6g R1 F6r F4a R0 F6s G2 F6bK F8a steps F8a F6e F6s G3o F10b END' },
  { i: 0, code: '1-2', name: 'Tidepool Trail', parts: 'S F8a F6s F6r F4b raft F6a F6f cave F6s F6b G3o F8r F6a F6e logs F6s F8b C F6f F6a raft F6s F6bE F6r exit F8a F6e G2 F6g R1 F6s R0 F6r F4b spring F6f F8a END' },
  { i: 0, code: '1-3', name: 'Coral Cliffs', parts: 'S F6 F6aR F6s R2 F6b R0 F6r F4 G3o F6f lift F6a F6sR cave F6e F6b fires F6 C F6fa R1 F6r R2 F6a R0 G3o F6s raft F6bK exit F6eR F8a steps F6s F6g G2 F6ab spring F6f F6 END' },
  { i: 0, code: '1-B', name: 'Kelp Lagoon', boss: 0, parts: 'arena0' },
  { i: 1, code: '2-1', name: 'Banana Grove', parts: 'S F8b F6f F6r F4a fires F6s F6e G3o F6b canopy F6a F6f C F6r F4bE logs F6s F6e R1 F6a R0 F6fR F6b G2 F8g spring F6s F6a END' },
  { i: 1, code: '2-2', name: 'Vine Valley', parts: 'S F6 F6aK F6f canopy F6b F6r C F6e lift F6s F6a cave F6fR F6b G3o F8r F6a logs F6e F6s exit F6b F6fr F4a steps F6e F6a G3o F6s END' },
  { i: 1, code: '2-3', name: 'Waterfall Way', parts: 'S F6a F6f F6r F3 lift F6e F6bS canopy F6s F6a C F6f fires F6r F6e raft F6b F6s cave F6a G3o F6fR F6r F6e F6bE exit F6s R2 F6a R0 F6f F6g spring F6e END' },
  { i: 1, code: '2-B', name: 'Buzzing Hive', boss: 1, parts: 'arena1' },
  { i: 2, code: '3-1', name: 'Ashen Path', parts: 'S F6 F6aR F6s F6F F3 G3oL F6f F6r cave F6e F6b fires F6s C F6aR G4L F6f F6rK F3 crumble F6e F6a exit F6sR F6F F6b G3oL F6f F6a steps F6e F6 END' },
  { i: 2, code: '3-2', name: 'Magma Steps', parts: 'S F6a F6f R1 F6r R2 F6s R0 G3L F6e lift F6b F6F C F6sR crumble F6aE raft F6f cave F6e F6r F3 G4oL F6b fires F6s exit F6aR F6f G3L F6e F6a spring F6s END' },
  { i: 2, code: '3-3', name: 'Lava Rapids', parts: 'S F6 F6aS raft F6f F6r F3 lift F6eR cave F6b crumble F6s C F6F G4oL F6f raft F6aK F6e fires F6sR F6b exit F6r F3 G3L F6f lift F6a F6e steps F6s F6 END' },
  { i: 2, code: '3-B', name: 'Ember Crater', boss: 2, parts: 'arena2' }
];
const BOSS_NAMES = ['CAPTAIN KELP', 'QUEEN BUZZBELLE', 'BIG BONGO'];
const BOSS_LINES = ['Captain Kelp bursts out of the lagoon!', 'Queen Buzzbelle buzzes down from her hive!', 'Big Bongo rises from the lava!'];
const BOSS_TITLES = ['Captain Kelp', 'Queen Buzzbelle', 'Big Bongo'];
const isBoss = ix => LEVELS[ix] && LEVELS[ix].boss !== undefined;
const ENT_CHARS = 'sefREKST-|CPYZWL';

const BUILT = {};
function buildLevel(ix){
  if(BUILT[ix]) return BUILT[ix];
  const def = LEVELS[ix], island = ISLANDS[def.i];
  const cols = [], ents = [];
  let h = 0, start = null;
  const emptyCol = () => new Array(ROWS).fill('.');
  const groundCol = () => { const c = emptyCol(); for(let r = 12 - h; r < ROWS; r++) c[r] = '#'; return c; };
  const place = (x, r, ch) => {
    if(r < 0 || r >= ROWS || !cols[x]) return;
    if(ch === '@'){ start = { tx: x, ty: r }; return; }
    if(ch === 'O'){ cols[x][r] = 'k'; ents.push({ ch: 'W', tx: x, ty: r }); return; }
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
        if('sfREKSTrF'.includes(ch)) place(x, 11 - h, ch);
        else if(ch === 'e') place(x, 7 - h, ch);
        else if(ch === 'p') place(x, 8 - h, ch);
        else place(x, 10 - h, ch);
      }
    } else if((m = /^G(\d+)(o?)(L?)$/.exec(tok))){
      const n = +m[1], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(emptyCol());
      if(m[2]) for(let i = 0; i < n; i++) place(x0 + i, 9 - h - Math.round(Math.sin(Math.PI * (i + 0.5) / n) * 2), 'abg'[i % 3]);
      if(m[3]) place(x0 + Math.floor(n / 2), 13, 'L');
    } else if((m = /^R(\d)$/.exec(tok))) h = +m[1];
    else if(tok === 'C'){ const x0 = cols.length; for(let i = 0; i < 4; i++) cols.push(groundCol()); place(x0 + 1, 11 - h, 'C'); }
    else if(CH[tok]){
      if(tok === 'END' || tok.startsWith('arena') || tok === 'canopy') h = 0;
      const rows = CH[tok], n = rows.length, w = Math.max(...rows.map(r => r.length)), x0 = cols.length;
      for(let i = 0; i < w; i++) cols.push(emptyCol());
      for(let r = 0; r < n; r++){
        const row = ROWS - n + r - h;
        for(let i = 0; i < w; i++){ const ch = rows[r][i] || '.'; if(ch !== '.') place(x0 + i, row, ch); }
      }
      if(h > 0) for(let i = 0; i < w; i++) if(rows[n - 1][i] === '#') for(let r = ROWS - h; r < ROWS; r++) cols[x0 + i][r] = '#';
    }
  }
  const W = cols.length, map = new Array(W * ROWS);
  for(let x = 0; x < W; x++) for(let r = 0; r < ROWS; r++) map[r * W + x] = cols[x][r];
  return (BUILT[ix] = { map, W, ents, start: start || { tx: 1, ty: 11 }, def, island });
}

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('tiki.diff', 'normal'), lv: 0, startLv: 0,
  unlocked: Math.min(LEVELS.length - 1, A.Store.get('tiki.unlocked', 0) | 0),
  players: [], roster: [], ents: [], map: null, W: 0, mods: [], island: ISLANDS[0],
  cam: { x: 0, y: LH - VH }, score: 0, lives: 5, time: 0, stateT: 0, lvT: 0, introLen: 2.4,
  check: null, goalT: -1, wipeT: 0, loadN: 0, net: null, shake: 0, crumbles: new Map(),
  levelScore: 0, gate: null, god: false, demoT: 0, modsApplied: 0, warp: null, secret: false
};
if(!DIFF[G.diff]) G.diff = 'normal';
G.startLv = Math.min(G.unlocked, A.Store.get('tiki.start', 0) | 0);
const D = () => DIFF[G.diff];
const hasLives = () => D().lives !== Infinity;

/* ---------- Sounds ---------- */
const SX = {
  jump:   s => s.tone({ wave: 'pulse25', f: 320, f2: 640, t: 0.12, v: 0.07 }),
  fruit:  s => { s.tone({ wave: 'sine', f: 988, t: 0.06, v: 0.12 }); s.tone({ wave: 'sine', f: 1480, t: 0.14, v: 0.1, at: 0.05 }); s.tone({ wave: 'sine', f: 2960, t: 0.06, v: 0.03, at: 0.05 }); },
  frenzy: s => s.melody([[784, .05], [988, .05], [1175, .05], [1568, .05], [1976, .14]], { wave: 'triangle', v: 0.12 }),
  stomp:  s => { s.tone({ f: 240, f2: 80, t: 0.1, v: 0.12 }); s.noise({ t: 0.07, v: 0.12, f: 1400, f2: 300 }); },
  kick:   s => { s.tone({ f: 640, f2: 260, t: 0.07, v: 0.1 }); s.noise({ t: 0.05, v: 0.1, f: 3500, f2: 800 }); },
  throw:  s => { s.noise({ t: 0.09, v: 0.07, f: 2400, f2: 900, type: 'bandpass' }); s.tone({ wave: 'triangle', f: 520, f2: 300, t: 0.08, v: 0.06 }); },
  clink:  s => { s.tone({ wave: 'triangle', f: 1900, f2: 1400, t: 0.08, v: 0.08 }); s.noise({ t: 0.04, v: 0.06, f: 6000, type: 'highpass' }); },
  crack:  s => { s.noise({ t: 0.16, v: 0.2, f: 2400, f2: 500 }); s.tone({ wave: 'triangle', f: 300, f2: 120, t: 0.1, v: 0.1 }); },
  egg:    s => { s.noise({ t: 0.08, v: 0.14, f: 4000, f2: 1500 }); s.melody([[659, .05], [880, .05], [1319, .1]], { wave: 'triangle', v: 0.1, at: 0.05 }); },
  ouch:   s => s.melody([[622, .06], [466, .06], [311, .12]], { wave: 'pulse25', v: 0.1 }),
  board:  s => { s.noise({ t: 0.3, v: 0.08, f: 1200, f2: 600 }); s.tone({ wave: 'triangle', f: 200, f2: 90, t: 0.25, v: 0.12 }); },
  trip:   s => { s.tone({ wave: 'triangle', f: 220, f2: 110, t: 0.12, v: 0.14 }); s.noise({ t: 0.08, v: 0.08, f: 1200, f2: 400 }); },
  hungry: s => s.tone({ wave: 'triangle', f: 440, f2: 330, t: 0.09, v: 0.07 }),
  faint:  s => s.melody([[784, .1], [698, .1], [622, .1], [0, .08], [523, .14], [392, .14], [262, .3]], { wave: 'triangle', v: 0.12 }),
  die:    s => s.melody([[988, .08], [932, .08], [880, .08], [0, .12], [659, .12], [523, .12], [392, .28]], { wave: 'pulse25', v: 0.1 }),
  splash: s => { s.noise({ t: 0.4, v: 0.25, f: 2000, f2: 300 }); s.tone({ wave: 'sine', f: 500, f2: 150, t: 0.2, v: 0.1 }); },
  sizzle: s => { s.noise({ t: 0.5, v: 0.18, f: 6000, f2: 2000, type: 'highpass' }); s.tone({ wave: 'sawtooth', f: 200, f2: 60, t: 0.3, v: 0.06 }); },
  bubble: s => { s.tone({ wave: 'sine', f: 380, f2: 900, t: 0.26, v: 0.15 }); s.tone({ wave: 'sine', f: 620, f2: 1300, t: 0.2, v: 0.08, at: 0.09 }); },
  pop:    s => { s.tone({ wave: 'sine', f: 1300, f2: 320, t: 0.09, v: 0.15 }); s.noise({ t: 0.05, v: 0.08, f: 6000, type: 'highpass' }); },
  spring: s => s.tone({ wave: 'triangle', f: 190, f2: 950, t: 0.28, v: 0.15, vib: true }),
  tower:  s => { s.tone({ wave: 'triangle', f: 260, f2: 1300, t: 0.3, v: 0.15, vib: true }); s.tone({ wave: 'sine', f: 520, f2: 2000, t: 0.25, v: 0.06, at: 0.05 }); },
  boing:  s => s.tone({ wave: 'sine', f: 330, f2: 760, t: 0.13, v: 0.13 }),
  torch:  s => { s.noise({ t: 0.35, v: 0.14, f: 1800, f2: 600 }); s.melody([[523, .07], [784, .07], [1047, .14]], { wave: 'triangle', v: 0.11 }); },
  secret: s => s.melody([[523, .07], [659, .07], [784, .07], [1047, .07], [1319, .07], [1568, .2]], { wave: 'triangle', v: 0.12 }),
  warp:   s => { s.tone({ wave: 'sine', f: 900, f2: 120, t: 0.45, v: 0.13 }); s.noise({ t: 0.45, v: 0.08, f: 3000, f2: 300 }); },
  gate:   s => s.melody([[784, .07], [988, .07], [1175, .07], [1568, .16]], { wave: 'triangle', v: 0.12 }),
  fanfare: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .22], [0, .05], [880, .1], [1047, .1], [1319, .4]], { wave: 'sine', v: 0.13 });
                  s.melody([[262, .32], [349, .32], [392, .4], [523, .5]], { wave: 'triangle', v: 0.15 }); },
  bossHit: s => { s.noise({ t: 0.3, v: 0.3, f: 2200, f2: 200 }); s.tone({ wave: 'sawtooth', f: 330, f2: 110, t: 0.3, v: 0.1 }); },
  land:   s => { s.noise({ t: 0.35, v: 0.35, f: 900, f2: 60 }); s.tone({ wave: 'sine', f: 90, f2: 40, t: 0.3, v: 0.25 }); },
  drum:   s => { s.tone({ wave: 'sine', f: 160, f2: 60, t: 0.22, v: 0.3 }); s.noise({ t: 0.1, v: 0.12, f: 700, f2: 200 }); },
  spit:   s => { s.noise({ t: 0.25, v: 0.16, f: 1800, f2: 400 }); s.tone({ wave: 'sawtooth', f: 180, f2: 420, t: 0.18, v: 0.06 }); },
  buzz:   s => s.tone({ wave: 'sawtooth', f: 180, f2: 240, t: 0.3, v: 0.05, vib: true }),
  warn:   s => s.tone({ f: 1760, t: 0.05, v: 0.05 }),
  rock:   s => { s.noise({ t: 0.25, v: 0.16, f: 700, f2: 200 }); },
  shatter: s => { s.noise({ t: 0.3, v: 0.22, f: 2500, f2: 300 }); s.tone({ wave: 'triangle', f: 400, f2: 100, t: 0.15, v: 0.08 }); },
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
const pitAt = tx => tx >= 0 && tx < G.W && !isSolid(tileAt(tx, ROWS - 1));

/* Move a body through the tile map: X first, then Y. Sets onGround, hitWall and hitHead. */
function moveBody(b, dt, corner){
  b.hitWall = 0; b.hitHead = null;
  const dx = b.vx * dt;
  if(dx){
    b.x += dx;
    const y0 = Math.floor(b.y / T), y1 = Math.floor((b.y + b.h - 0.01) / T);
    if(dx > 0){ const tx = Math.floor((b.x + b.w - 0.01) / T); for(let ty = y0; ty <= y1; ty++) if(isSolid(tileAt(tx, ty))){ b.x = tx * T - b.w; b.hitWall = 1; b.wallTile = [tx, ty]; break; } }
    else { const tx = Math.floor(b.x / T); for(let ty = y0; ty <= y1; ty++) if(isSolid(tileAt(tx, ty))){ b.x = (tx + 1) * T; b.hitWall = -1; b.wallTile = [tx, ty]; break; } }
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
      if(corner && hit.length === 1 && x0 !== x1){
        const tx = hit[0];
        if(tx === x0 && (tx + 1) * T - b.x <= 5 && !isSolid(tileAt(tx + 1, ty))){ b.x = (tx + 1) * T; return; }
        if(tx === x1 && b.x + b.w - tx * T <= 5 && !isSolid(tileAt(tx - 1, ty))){ b.x = tx * T - b.w; return; }
      }
      b.y = (ty + 1) * T; b.vy = 0; b.hitHead = true;
    }
  }
}

/* ---------- Entities ---------- */
let nextEnt = 1;
const SIZES = { snail: [14, 11], bee: [12, 10], frog: [14, 12], rock: [14, 14], ember: [9, 9], coconut: [9, 9], fireball: [10, 9], fallrock: [14, 14],
  axe: [9, 9], egg: [12, 14], board: [16, 9], charm: [12, 12], melon: [14, 12], spring: [16, 10], plat: [48, 8], lift: [32, 8],
  torch: [12, 40], gate: [44, 64], cave: [32, 32], exit: [16, 32], spawner: [16, 16], boss: [40, 40] };
const FOES = new Set(['snail', 'bee', 'frog']);
const HAZARDS = new Set(['rock', 'ember', 'coconut', 'fireball', 'fallrock']);
const ITEMS = new Set(['board', 'charm', 'melon']);
function mkEnt(k, x, y, o){
  const sz = SIZES[k] || [12, 12];
  const e = Object.assign({ id: nextEnt++, k, x, y, w: sz[0], h: sz[1], vx: 0, vy: 0, face: -1, st: '', t: 0, on: false, dead: 0 }, o);
  G.ents.push(e); return e;
}
function spawnFromMap(o){
  const bx = o.tx * T, by = (o.ty + 1) * T;
  const foot = (k, o2) => { const sz = SIZES[k]; return mkEnt(k, bx + (T - sz[0]) / 2, by - sz[1], o2); };
  switch(o.ch){
    case 's': foot('snail', { st: 'walk' }); break;
    case 'f': foot('frog', { st: 'sit', t: (o.tx % 7) / 7 }); break;
    case 'e': mkEnt('bee', bx + 2, o.ty * T + 3, { st: 'fly', bx: bx + 2, by: o.ty * T + 3, t: o.tx * 0.7, cool: 1 }); break;
    case 'R': mkEnt('spawner', bx, by - 16, { on: true, st: 'idle', t: 0 }); break;
    case 'E': foot('egg', { on: true, item: 'melon' }); break;
    case 'K': foot('egg', { on: true, item: 'board' }); break;
    case 'S': foot('egg', { on: true, item: 'charm' }); break;
    case 'T': mkEnt('spring', bx, by - 10, { on: true }); break;
    case 'L': mkEnt('ember', bx + 4, LH + 20, { on: true, st: 'wait', t: (o.tx % 5) * 0.3, by: LH + 20 }); break;
    case '-': mkEnt('plat', bx, o.ty * T, { on: true, bx, by: o.ty * T, range: 7 * T, speed: 0.95, t: 0, dx: 0, dy: 0 }); break;
    case '|': mkEnt('lift', bx, o.ty * T, { on: true, bx, by: o.ty * T, range: 3 * T, speed: 1.1, t: o.tx * 0.9, dx: 0, dy: 0 }); break;
    case 'C': mkEnt('torch', bx + 2, by - 40, { on: true, st: G.check !== null && G.check >= bx ? 'got' : '' }); break;
    case 'P': G.gate = mkEnt('gate', bx - 14, by - 64, { on: true }); break;
    case 'W': mkEnt('cave', bx, by - 32, { on: true, tx: o.tx, ty: o.ty }); break;
    case 'Y': mkEnt('exit', bx, by - 32, { on: true }); break;
    case 'Z': makeBoss(LEVELS[G.lv].boss, bx, by); break;
  }
}

/* ---------- Players ---------- */
function makeHero(o){
  return Object.assign({ slot: 0, source: null, name: 'Player', color: '#f5c542', x: 0, y: 0, w: HW, h: HH, vx: 0, vy: 0, face: 1,
    onGround: false, energy: 100, board: false, charm: 0, inv: 0, bubble: false, bubbleT: 0, dead: 0, done: 0, away: false,
    coyote: 0, buffer: 0, jumping: false, springy: false, runT: 0, runDir: 0, chain: 0, prevBottom: 0, plat: null,
    throwT: 0, axeCD: 0, squashT: 0, tripT: 0, tripIx: -1, climb: false, airFruit: 0, hungryT: 0, faint: false, lf: 0, lb: 0, bot: false }, o);
}
const active = p => !p.bubble && !(p.dead > 0) && !p.done && !p.away;
function placePlayers(x0){
  G.players.forEach((p, i) => {
    Object.assign(p, { vx: 0, vy: 0, bubble: false, dead: 0, done: 0, inv: 0, charm: 0, plat: null, chain: 0, jumping: false, springy: false,
      face: 1, climb: false, tripT: 0, airFruit: 0, energy: 100, faint: false, botBest: 0, botStuck: 0, botHold: 0 });
    const x = x0 + i * 16;
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
    case 'big': parts.push({ kind: 'big', x, y, vx: 0, vy: -20, g: 0, t: 0, life: 1.3, str: arg, col: arg2 || '#fff' }); break;
    case 'poof': for(let i = 0; i < 7; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 80, vy: (R() - 0.7) * 60, g: 0, t: 0, life: 0.35 + R() * 0.2, col: 'rgba(255,255,255,.9)', r: 2 + R() * 2 }); break;
    case 'dust': for(let i = 0; i < 4; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 8, y, vx: (R() - 0.5) * 50, vy: -10 - R() * 20, g: 0, t: 0, life: 0.3, col: arg || 'rgba(255,245,220,.75)', r: 1.5 + R() }); break;
    case 'chunks': for(let i = 0; i < 6; i++) parts.push({ kind: 'chunk', x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 8, vx: (R() - 0.5) * 150, vy: -120 - R() * 130, g: 900, t: 0, life: 0.9, col: arg || '#8a7a6a', r: 3 + R() * 3, rot: R() * 6 }); break;
    case 'shell': for(let i = 0; i < 5; i++) parts.push({ kind: 'chunk', x, y, vx: (R() - 0.5) * 110, vy: -100 - R() * 100, g: 800, t: 0, life: 0.7, col: i % 2 ? '#fffaf0' : (arg || '#ffd0e0'), r: 3, rot: R() * 6 }); break;
    case 'juice': for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55 - 20, g: 120, t: 0, life: 0.4, col: arg || '#ff6a5a', r: 1.6 }); } break;
    case 'splash': for(let i = 0; i < 12; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 10, y, vx: (R() - 0.5) * 90, vy: -120 - R() * 140, g: 700, t: 0, life: 0.7, col: arg || 'rgba(190,240,255,.95)', r: 1.5 + R() * 1.5 }); break;
    case 'sparks': for(let i = 0; i < 5; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 120, vy: -40 - R() * 80, g: 500, t: 0, life: 0.35, col: '#fff3a0', r: 1 }); break;
    case 'pop': for(let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, g: 0, t: 0, life: 0.3, col: 'rgba(210,240,255,.95)', r: 1.6 }); } break;
    case 'sparkle': for(let i = 0; i < 5; i++) parts.push({ kind: 'star', x: x + (R() - 0.5) * 12, y: y + (R() - 0.5) * 12, vx: (R() - 0.5) * 30, vy: -20 - R() * 30, g: 0, t: 0, life: 0.5, col: arg || '#fff6b0', r: 2 }); break;
    case 'firework': { const col = arg || '#ffd45e'; for(let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2, sp = 70 + R() * 50; parts.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, t: 0, life: 0.9 + R() * 0.3, col, r: 1.8 }); } break; }
    case 'board': parts.push({ kind: 'board', x, y, vx: (arg || 1) * 90, vy: -220, g: 900, t: 0, life: 1.1, rot: 0 }); break;
    case 'shake': G.shake = Math.max(G.shake, x); break;
  }
  if(parts.length > 340) parts.splice(0, parts.length - 340);
}
function fxStep(dt){
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if(p.rot !== undefined) p.rot += dt * 9; }
  parts = parts.filter(p => p.t < p.life);
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
const vineAt = (x, y) => tileAt(Math.floor(x / T), Math.floor(y / T)) === 'v';
function stepPlayer(p, dt){
  if(p.inv > 0) p.inv -= dt;
  if(p.throwT > 0) p.throwT -= dt;
  if(p.axeCD > 0) p.axeCD -= dt;
  if(p.squashT > 0) p.squashT -= dt;
  if(p.charm > 0) p.charm = Math.max(0, p.charm - dt);
  if(!p.bot){ const s = A.Input.get(p.source); p.away = !(s && s.connected); }
  if(p.done){ stepDone(p, dt); return; }
  if(p.dead > 0){ p.dead += dt; if(p.dead > 0.5){ p.vy = Math.min(MAX_FALL, p.vy + G_FALL * 0.7 * dt); p.y += p.vy * dt; } return; }
  if(p.bubble || (p.away && G.players.length > 1)){ stepBubble(p, dt); return; }
  if(G.state !== 'play' && !G.demo) return;
  // energy drains as you go; fruit fills it back up
  if(!G.demo && !G.god && !isBoss(G.lv)){
    p.energy -= D().drain * dt;
    if(p.energy < D().floor && D().floor > 0) p.energy = D().floor;
    if(p.energy < 25){ p.hungryT -= dt; if(p.hungryT <= 0){ p.hungryT = p.energy < 12 ? 0.5 : 1; if(!p.bot) sfx('hungry'); } }
    if(p.energy <= 0){ p.energy = 0; p.faint = true; kill(p, false); return; }
  }
  const c = controls(p);
  if(p.plat){ p.x += p.plat.dx; p.y += p.plat.dy; p.plat = null; }
  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  // vines: hold UP to climb, FIRE to leap off
  const cx = p.x + p.w / 2;
  const onVine = vineAt(cx, p.y + p.h - 3) || vineAt(cx, p.y + 5);
  if(!p.climb && onVine && c.up && !c.fireP){ p.climb = true; p.vx = 0; p.vy = 0; p.jumping = false; p.x = Math.floor(cx / T) * T + (T - p.w) / 2; }
  if(p.climb){
    if(!onVine){ p.climb = false; }
    else if(c.fireP){ p.climb = false; p.vy = -JUMP * 0.86; p.vx = dir * 90; p.jumping = true; sfx('jump'); }
    else if(dir && !c.up && !c.down){ p.climb = false; p.vx = dir * 70; p.face = dir; }
    else {
      p.vx = 0; p.vy = ((c.down ? 1 : 0) - (c.up ? 1 : 0)) * 72;
      const tx = Math.floor(cx / T); let top = Math.floor((p.y + p.h - 3) / T);
      while(tileAt(tx, top - 1) === 'v') top--;
      p.prevBottom = p.y + p.h;
      moveBody(p, dt);
      if(p.y + p.h < top * T){ p.y = top * T - p.h; p.vy = 0; }
      if(p.onGround && c.down) p.climb = false;
      touchTiles(p);
      return;
    }
  }
  if(dir && !(p.tripT > 0)) p.face = dir;
  if(dir && p.onGround){ if(dir === p.runDir) p.runT += dt; else { p.runDir = dir; p.runT = 0; } }
  else if(!dir && p.onGround) p.runT = 0;
  const max = p.board ? BOARD : p.runT > 0.45 ? RUN : WALK;
  p.skid = false;
  if(p.tripT > 0){
    p.tripT -= dt;
    if(p.onGround){ const f = FRICTION * 0.6 * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  } else if(dir){
    const reversing = Math.sign(p.vx) === -dir && Math.abs(p.vx) > 20;
    const acc = p.onGround ? (reversing ? SKID : ACC * (p.board ? 0.8 : 1)) : AIR_ACC;
    if(reversing && p.onGround) p.skid = true;
    if(Math.abs(p.vx) < max || Math.sign(p.vx) !== dir) p.vx += dir * acc * dt;
    if(Math.abs(p.vx) > max && Math.sign(p.vx) === dir) p.vx = dir * Math.max(max, Math.abs(p.vx) - (p.onGround ? 300 : 80) * dt);
  } else if(p.onGround){
    const f = (p.board ? BOARD_FRICTION : FRICTION) * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  // jump (buffered, with a little coyote time), or DOWN + FIRE to throw the axe
  if(c.fireP && c.down){ throwAxe(p); }
  else if(c.fireP) p.buffer = 0.12;
  if(p.onGround) p.coyote = 0.09; else p.coyote -= dt;
  if(p.buffer > 0 && p.coyote > 0 && !(p.tripT > 0.25)){
    p.vy = -(JUMP + Math.min(40, Math.abs(p.vx) * 0.22) + (p.board ? 14 : 0)); p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.springy = false;
    sfx('jump');
  }
  p.buffer -= dt;
  const g = p.vy < 0 && (p.springy || (c.fire && p.jumping)) ? G_HOLD : G_FALL;
  if(p.vy >= 0){ p.jumping = false; p.springy = false; }
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);
  const wasGround = p.onGround;
  p.prevBottom = p.y + p.h;
  moveBody(p, dt, true);
  // moving platforms and bounce flowers
  for(const e of G.ents){
    if((e.k === 'plat' || e.k === 'lift') && p.vy >= 0 && p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 && p.prevBottom <= e.y - e.dy + 2 && p.y + p.h >= e.y){
      p.y = e.y - p.h; p.vy = 0; p.onGround = true; p.plat = e;
    } else if(e.k === 'spring' && p.vy > 0 && p.x + p.w > e.x + 2 && p.x < e.x + e.w - 2 && p.prevBottom <= e.y + 3 && p.y + p.h >= e.y){
      p.y = e.y - p.h; p.vy = -SPRING_V; p.springy = true; p.jumping = true; p.onGround = false; e.t = 0.3; p.chain = 0;
      sfx('spring'); fx('sparkle', e.x + 8, e.y, '#ffb3d9');
    }
  }
  if(p.onGround){
    p.chain = 0;
    if(!wasGround){ p.squashT = 0.12; if(p.board) fx('dust', p.x + 6, p.y + p.h); }
    p.airFruit = 0;
  }
  // crumbling rock
  if(p.onGround && !p.plat){
    const ty = Math.floor((p.y + p.h + 1) / T);
    for(let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++)
      if(tileAt(tx, ty) === 'c'){ const i = ty * G.W + tx; if(!G.crumbles.has(i)) G.crumbles.set(i, 0); }
  }
  touchTiles(p);
  // falling into the sea, the river or the lava
  if(p.y > LH + 12){
    if(D().pitBounce || G.demo || G.god){
      p.y = LH + 12; p.vy = -540; p.springy = true; p.jumping = true; sfx('spring'); G.pitBounces = (G.pitBounces || 0) + 1;
      fx('splash', p.x + 6, LH - 6, G.island.pit === 'lava' ? '#ffb347' : undefined);
      fx('text', p.x + 6, LH - 30, 'BOING!', '#ffd45e');
    } else { fx('splash', p.x + 6, LH - 6, G.island.pit === 'lava' ? '#ffb347' : undefined); sfx(G.island.pit === 'lava' ? 'sizzle' : 'splash'); kill(p, true); }
  }
}
function touchTiles(p){
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.01) / T);
  let onStone = -1;
  for(let ty = y0; ty <= y1; ty++) for(let tx = x0; tx <= x1; tx++){
    const ch = tileAt(tx, ty);
    if(isFruit(ch)){ setTile(tx, ty, '.'); eatFruit(p, ch, tx * T + 8, ty * T + 8); }
    else if(ch === 'r' && p.y + p.h > ty * T + 9 && p.x + p.w > tx * T + 3 && p.x < tx * T + 13){
      const ix = ty * G.W + tx; onStone = ix;
      if(p.board){ setTile(tx, ty, '.'); fx('chunks', tx * T + 8, ty * T + 12, '#9a8a78'); addScore(100, tx * T + 8, ty * T); sfx('crack'); }
      else if(p.tripIx !== ix && p.onGround && Math.abs(p.vx) > 25 && !p.climb) tripOver(p, ix);
    }
    else if(ch === 'F' && p.y + p.h > ty * T + 5 && p.x + p.w > tx * T + 3 && p.x < tx * T + 13) burn(p);
  }
  if(onStone < 0) p.tripIx = -1;
}
function tripOver(p, ix){
  p.tripIx = ix;
  if(G.demo || G.god) return;
  p.tripT = 0.5; p.vx *= 0.25; p.vy = -110; p.onGround = false; p.jumping = false;
  const lose = D().trip;
  if(lose){ p.energy = Math.max(1, p.energy - lose); fx('text', p.x + 6, p.y - 6, '-' + lose, '#ff9a8a'); }
  else fx('text', p.x + 6, p.y - 6, 'OOPS!', '#ffd45e');
  sfx('trip');
}
function burn(p){
  if(p.charm > 0 || p.inv > 0) return;
  if(G.demo || G.god){ if(p.vy >= -100){ p.vy = -330; p.springy = true; p.jumping = true; p.onGround = false; } return; }
  hurt(p, 'fire');
  if(active(p)){ p.vy = -300; p.onGround = false; p.jumping = false; fx('text', p.x + 6, p.y - 6, 'HOT!', '#ffb347'); }
}
function eatFruit(p, ch, x, y){
  if(!p.onGround) p.airFruit++;
  const mult = p.airFruit >= 6 ? 3 : p.airFruit >= 3 ? 2 : 1;
  const n = (ch === 'p' ? 300 : 50) * mult;
  addScore(n, x, y - 6, mult > 1 ? '#ffd45e' : '#fff6e0');
  p.energy = Math.min(100, p.energy + FRUIT[ch]); p.lf++;
  sfx('fruit'); fx('juice', x, y, ch === 'a' ? '#ff5a4e' : ch === 'b' ? '#ffe14a' : ch === 'g' ? '#b45cff' : '#ffb347');
  if(p.airFruit === 3 || p.airFruit === 6){
    fx('big', x, y - 16, p.airFruit === 3 ? 'FRUIT FRENZY! x2' : 'FRUIT FRENZY! x3', '#ffd45e'); sfx('frenzy'); G.frenzies = (G.frenzies || 0) + 1;
  }
}
function throwAxe(p){
  if(p.axeCD > 0 || p.climb) return;
  if(G.ents.filter(e => e.k === 'axe' && e.owner === p.slot).length >= 2) return;
  mkEnt('axe', p.face > 0 ? p.x + p.w - 2 : p.x - 7, p.y + 4, { on: true, owner: p.slot, face: p.face, vx: p.face * 230 + p.vx * 0.35, vy: -170, t: 0 });
  p.throwT = 0.2; p.axeCD = 0.24; sfx('throw');
}
function bounce(p, v){
  const s = p.bot ? null : A.Input.get(p.source);
  const held = p.bot || (s && s.fire);
  p.vy = -(v || (held ? STOMP_HOLD : STOMP_V)); p.jumping = true; p.springy = false; p.onGround = false; p.climb = false;
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
  p.x = clamp(p.x, G.cam.x + 8, G.cam.x + VW - 8 - p.w); p.y = clamp(p.y, G.cam.y + 26, G.cam.y + VH - 40);
  if(tgt && !p.away && p.bubbleT > 0.7){
    const d = Math.hypot(tgt.x + tgt.w / 2 - (p.x + p.w / 2), tgt.y + tgt.h / 2 - (p.y + p.h / 2));
    if((d < 18 || (p.bubbleT > 7 && d < 44)) && !rectSolid(p)) pop(p);
  }
}
function toBubble(p){
  if(p.bubble) return;
  p.bubble = true; p.bubbleT = 0; p.vx = 0; p.vy = 0; p.charm = 0; p.plat = null; p.climb = false; p.board = false; p.tripT = 0;
  sfx('bubble');
}
function pop(p){
  p.bubble = false; p.inv = 1.5; p.vy = -170; p.vx = 0; p.onGround = false; p.jumping = false; p.faint = false;
  p.energy = Math.max(p.energy, 60);
  sfx('pop'); fx('pop', p.x + p.w / 2, p.y + p.h / 2);
}
function hurt(p, why){
  if(!active(p) || p.inv > 0 || p.charm > 0) return;
  if(G.log) G.log.push(['hurt', why || '?', Math.round(p.x)]);
  if(G.demo || G.god){ p.inv = 1; return; }
  const kb = () => { p.vx = p.onGround ? -p.face * 110 : p.vx * 0.5; p.vy = -190; p.onGround = false; p.jumping = false; p.climb = false; };
  if(p.board){ p.board = false; p.inv = 1.6; sfx('board'); fx('board', p.x + 6, p.y + p.h - 4, -p.face); fx('text', p.x + 6, p.y - 8, 'SAVED!', '#9fe8d7'); kb(); return; }
  const lose = D().hit;
  if(lose >= 100){ kill(p, false); return; }
  p.energy = Math.max(D().floor ? D().floor : 0, p.energy - lose); p.inv = 1.6; sfx('ouch'); kb();
  fx('text', p.x + 6, p.y - 8, '-' + lose, '#ff9a8a');
  if(p.energy <= 0){ p.faint = true; kill(p, false); }
}
function kill(p, fell){
  if(G.demo || G.god) return;
  if(G.log) G.log.push([fell ? 'FELL' : (p.faint ? 'FAINT' : 'KO'), Math.round(p.x)]);
  p.climb = false; p.tripT = 0;
  if(G.players.length > 1){
    toBubble(p);
    if(fell){ p.x = G.cam.x + VW / 2 - 6; p.y = G.cam.y + 60; }
    fx('poof', p.x + 6, p.y + 8);
  } else {
    p.dead = 0.001; p.vy = -330; p.vx = 0; p.charm = 0; p.board = false;
    if(fell){ p.dead = 0.6; p.vy = 0; }
    sfx(p.faint ? 'faint' : 'die');
  }
}
function stepDone(p, dt){
  // walk through the tiki gate and do a little dance
  const gx = G.gate ? G.gate.x + G.gate.w + 26 + p.slot * 18 : p.x;
  p.climb = false;
  if(p.done === 1){
    p.vx = p.x < gx - 2 ? 80 : 0; p.face = 1;
    p.vy = Math.min(MAX_FALL, p.vy + G_FALL * dt); moveBody(p, dt);
    if(p.vx === 0 && p.onGround){ p.done = 2; p.t = 0; }
    if(p.hitWall) p.done = 2;
  } else {
    p.vy = Math.min(MAX_FALL, p.vy + G_FALL * dt); p.vx = 0; moveBody(p, dt);
    if(p.onGround && Math.random() < 0.03){ p.vy = -240; p.onGround = false; p.face = -p.face; }
  }
}

/* A little autopilot: the title-screen demo islanders (and the test harness) use it. */
function botControls(p){
  const c = { left: false, right: true, up: false, down: false, fire: false, fireP: false };
  const tick = 1 / 60;
  const boss = G.ents.find(e => e.k === 'boss' && e.st !== 'defeat');
  if(boss){
    const bx = boss.x + boss.w / 2, cx = p.x + p.w / 2, dx = bx - cx;
    const side = boss.bw === 0 ? -1 : (cx < bx ? -1 : 1);
    let want = boss.bw === 0 ? (boss.st === 'tired' ? 12.5 * T : 10 * T) : bx + side * 95;
    if(want < 2.5 * T || want > G.W * T - 2.5 * T) want = bx - side * 95;
    const warn = G.ents.find(e => e.k === 'fallrock' && Math.abs(e.x + 7 - cx) < 24);
    if(warn) want = cx + (e => e.x + 7 < cx ? 60 : -60)(warn);
    c.right = want - cx > 10; c.left = want - cx < -10;
    const faceOk = Math.sign(dx) === p.face;
    if(!c.left && !c.right && !faceOk){ if(dx > 0) c.right = true; else c.left = true; }
    if(bossWeak(boss) && faceOk && Math.abs(dx) < 160 && p.axeCD <= 0 && Math.random() < 0.3){ c.down = true; c.fireP = true; return c; }
    const threat = G.ents.some(e => (e.k === 'coconut' || e.k === 'fireball' || (e.k === 'bee' && e.st === 'dive')) && Math.abs(e.x - cx) < 46 && e.y > p.y - 40);
    if(threat && p.onGround){ c.fireP = true; p.botHold = 0.3; }
    if(p.botHold > 0){ c.fire = true; p.botHold -= tick; }
    return c;
  }
  const feet = p.y + p.h, fr = Math.floor((feet - 1) / T);
  const lookX = p.x + p.w + 5 + Math.max(0, p.vx) * 0.16;
  const tx = Math.floor(lookX / T);
  const wall = isSolid(tileAt(tx, fr)) || isSolid(tileAt(tx, fr - 1));
  let gap = true;
  for(let r = fr + 1; r < ROWS; r++){ const ch = tileAt(tx, r); if(isSolid(ch) || ch === '='){ gap = false; break; } }
  const trap = ['r', 'F'].includes(tileAt(tx, fr)) || ['r', 'F'].includes(tileAt(tx + 1, fr));
  const foe = G.ents.find(e => e.on && FOES.has(e.k) && e.st !== 'flip' && e.st !== 'flat' &&
    e.x + e.w > p.x - 2 && e.x - (p.x + p.w) < 80 && Math.abs((e.y + e.h) - feet) < 40);
  const rock = G.ents.find(e => (e.k === 'rock' || e.k === 'ember') && e.x + e.w > p.x - 4 && e.x - (p.x + p.w) < 42 + Math.abs(e.vx) * 0.25 && Math.abs(e.y + e.h - feet) < 60);
  const egg = G.ents.find(e => e.k === 'egg' && e.x > p.x && e.x - p.x < 70 && Math.abs(e.y + e.h - feet) < 20);
  const boulder = tileAt(tx, fr) === 'k' || tileAt(tx, fr) === 'j';
  let gapW = 0;
  if(gap) for(let i = 0; i < 9; i++){ let solid = false; for(let r = fr + 1; r < ROWS; r++){ const ch = tileAt(tx + i, r); if(isSolid(ch) || ch === '='){ solid = true; break; } } if(solid) break; gapW++; }
  const platNear = gapW > 3 && G.ents.find(e => (e.k === 'plat' || e.k === 'lift') && e.x + e.w > p.x && e.x < p.x + 220 && e.y > p.y - 60);
  if(gap && p.onGround && platNear && !p.plat){
    const ahead = platNear.x > p.x - 6 && platNear.x - (p.x + p.w) < 26 && platNear.y > p.y - 40 && platNear.y < feet + 30;
    if(!ahead){ c.right = false; p.botStuck = 0; p.botBest = p.x; }
  }
  if(gap && p.onGround && p.plat){
    // riding a raft or lift: wait until ground or the next platform is close enough to jump to
    let near = false;
    for(let i = 0; i <= 4 && !near; i++){ const x = tx + i; for(let r = Math.max(2, fr - 2); r < ROWS; r++){ const ch = tileAt(x, r); if(isSolid(ch) || ch === '='){ near = i <= 3 && r >= fr - 2 && r <= fr + 4; break; } } }
    const next = G.ents.find(e => (e.k === 'plat' || e.k === 'lift') && e !== p.plat && e.x > p.x && e.x - (p.x + p.w) < 56 && Math.abs(e.y - feet) < 30);
    if(!near && !next){ c.right = false; p.botStuck = 0; p.botBest = p.x; }
  }
  if((foe && foe.x - (p.x + p.w) < 70) || egg || (boulder && G.botSecret)){ if(p.axeCD <= 0 && Math.random() < 0.35){ c.down = true; c.fireP = true; return c; } }
  const nearFoe = foe && foe.x - (p.x + p.w) < 26;
  if(p.onGround && (wall || gap || trap || nearFoe || rock) && c.right && !(boulder && G.botSecret)){ p.botHold = 0.36 + ((p.slot * 7 + Math.floor(G.lvT)) % 3) * 0.04; c.fireP = true; }
  if(p.botHold > 0){ c.fire = true; p.botHold -= tick; }
  if(p.x > (p.botBest || 0) + 3){ p.botBest = p.x; p.botStuck = 0; } else p.botStuck = (p.botStuck || 0) + tick;
  if(p.botStuck > 1.4 && p.botStuck < 1.7){ c.right = false; c.left = true; }
  else if(p.botStuck >= 1.7 && p.onGround){ c.fireP = true; c.fire = true; p.botHold = 0.45; p.botStuck = 0.8; }
  return c;
}

/* ---------- Enemies, hazards and items ---------- */
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
  if(e.k === 'bee'){ e.st = 'flip'; e.vy = 0; e.vx = 0; e.t = 0; }
  else { e.st = 'flat'; e.t = 0; e.vx = 0; if(e.k === 'snail') fx('shell', e.x + 7, e.y + 4, G.island.snail[0]); }
  sfx('stomp'); fx('poof', e.x + e.w / 2, e.y + e.h / 2);
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
function crackEgg(e, p){
  if(e.dead) return;
  e.dead = 1;
  fx('shell', e.x + 6, e.y + 6, e.item === 'board' ? '#7ac8ff' : e.item === 'charm' ? '#ffd45e' : '#7dff8a');
  mkEnt(e.item, e.x + e.w / 2 - SIZES[e.item][0] / 2, e.y + e.h - SIZES[e.item][1], { on: true, st: 'rise', t: 0, vy: -150 });
  sfx('egg');
  if(p) addScore(100, e.x + 6, e.y - 4);
}
function collect(e, p){
  e.dead = 1;
  const x = e.x + e.w / 2, y = e.y;
  if(e.k === 'board'){
    if(p.board) addScore(1000, x, y, '#ffd45e'); else { fx('big', x, y - 10, 'SKATEBOARD!', '#7ac8ff'); addScore(500); }
    p.board = true; sfx('powerUp');
  } else if(e.k === 'charm'){ p.charm = 8; sfx('powerUp'); fx('big', x, y - 10, 'SUN CHARM!', '#ffd45e'); addScore(500); }
  else if(e.k === 'melon'){ p.energy = Math.min(100, p.energy + 45); p.lf++; sfx('fruit'); fx('juice', x, y, '#ff5a6e'); addScore(500, x, y, '#7dff8a'); fx('text', x, y - 12, 'YUM!', '#7dff8a'); }
  fx('sparkle', x, y + 4);
}
function axeHit(e, o){
  e.dead = 1;
  const p = G.players.find(q => q.slot === e.owner);
  if(FOES.has(o.k)){ killEnemy(o, p, e.face); fx('poof', e.x, e.y); return; }
  if(o.k === 'egg'){ crackEgg(o, p); return; }
  if(o.k === 'coconut' || o.k === 'fireball'){ o.dead = 1; addScore(100, o.x + 4, o.y - 4); fx('chunks', o.x + 4, o.y + 4, o.k === 'coconut' ? '#7a4b2a' : '#ff9a3a'); sfx('shatter'); return; }
  if(o.k === 'boss'){ axeBoss(o, e); return; }
  fx('sparks', e.x + 4, e.y + 4); sfx('clink');
}
function stepEnt(e, dt){
  if(!e.on){ if(e.x < G.cam.x + VW + 40) e.on = true; else return; }
  e.t += dt;
  if(FOES.has(e.k) && e.st === 'flip'){ e.vy += G_FALL * dt; e.x += e.vx * dt; e.y += e.vy * dt; if(e.y > LH + 40) e.dead = 1; return; }
  if((FOES.has(e.k) || e.k === 'rock') && e.x + e.w < G.cam.x - 160){ e.dead = 1; return; }
  if(FOES.has(e.k) && e.x > G.cam.x + VW + 120) return;
  switch(e.k){
    case 'snail':
      if(e.st === 'flat'){ if(e.t > 0.5) e.dead = 1; return; }
      walkerAI(e, dt, 16); break;
    case 'frog':
      if(e.st === 'flat'){ if(e.t > 0.5) e.dead = 1; return; }
      e.vy = Math.min(MAX_FALL, e.vy + G_FALL * 0.8 * dt);
      moveBody(e, dt);
      if(e.onGround){
        e.vx = 0;
        if(e.t > 1.5 / D().enemy){ const p = nearestPlayer(e.x); e.face = p && p.x < e.x ? -1 : 1; e.vy = -290; e.vx = e.face * 55 * D().enemy; e.t = 0; }
      }
      if(e.hitWall) e.face = -e.hitWall;
      break;
    case 'bee': {
      e.cool -= dt;
      const p = nearestPlayer(e.x);
      if(e.st === 'fly'){
        e.x += e.face * 20 * D().enemy * dt;
        if(e.x < e.bx - 50) e.face = 1; else if(e.x > e.bx + 36) e.face = -1;
        e.y = e.by + Math.sin(e.t * 2.6) * 14;
        if(D().dive && p && e.cool <= 0 && Math.abs(p.x - e.x) < 100 && p.y > e.y){ e.st = 'aim'; e.t = 0; e.tx = p.x + p.w / 2; e.ty = p.y + 4; e.face = e.tx < e.x ? -1 : 1; }
      } else if(e.st === 'aim'){
        e.x += Math.sin(e.t * 60) * 0.6;
        if(e.t > 0.45){ e.st = 'dive'; e.t = 0; const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy) || 1, sp = 130 * D().enemy; e.vx = dx / d * sp; e.vy = dy / d * sp; sfx('buzz'); }
      } else if(e.st === 'dive'){
        e.x += e.vx * dt; e.y += e.vy * dt;
        if(e.t > 1.0 || e.y > 11 * T){ e.st = 'back'; e.t = 0; }
      } else if(e.st === 'back'){
        e.y += (e.by - e.y) * Math.min(1, dt * 2.2); e.x += e.face * 12 * dt;
        if(Math.abs(e.y - e.by) < 2){ e.st = 'fly'; e.t = 0; e.bx = e.x; e.cool = 2.4; }
      }
      break;
    }
    case 'spawner': {
      const edge = G.cam.x + VW;
      if(edge > e.x - 40 && edge < e.x + 180 && G.goalT < 0){
        e.t2 = (e.t2 || 0) - dt;
        if(e.t2 <= 0 && G.ents.filter(q => q.k === 'rock').length < 3){
          e.t2 = 3.4 / D().rock;
          const x = edge + 6, y = groundY(x + 7) - 14;
          mkEnt('rock', x, y, { on: true, vx: -64 * D().rock, face: -1 }); if(!G.demo) sfx('rock');
        }
      }
      break;
    }
    case 'rock':
      e.vx = -64 * D().rock * (e.st === 'fall' ? 0.6 : 1);
      e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt);
      moveBody(e, dt);
      if(e.onGround && e.vyWas > 160){ e.vy = -e.vyWas * 0.35; fx('dust', e.x + 7, e.y + 14); }
      e.vyWas = e.vy;
      if(e.hitWall){ e.dead = 1; fx('chunks', e.x + 7, e.y + 7, '#8f8478'); sfx('shatter'); }
      if(e.y > LH + 20) e.dead = 1;
      break;
    case 'ember':
      if(e.st === 'wait'){ e.y = e.by; if(e.t > 2.2){ e.st = 'up'; e.t = 0; e.vy = -430; if(e.x > G.cam.x - 20 && e.x < G.cam.x + VW + 20) fx('splash', e.x + 4, LH - 4, '#ffb347'); } }
      else { e.vy += 700 * dt; e.y += e.vy * dt; if(e.y > e.by && e.vy > 0){ e.st = 'wait'; e.t = 0; e.y = e.by; } }
      break;
    case 'axe': {
      e.vy += 640 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      const tx = Math.floor((e.x + 4.5) / T), ty = Math.floor((e.y + 4.5) / T), ch = tileAt(tx, ty);
      if(isSolid(ch) && ty < ROWS){
        e.dead = 1;
        if(ch === 'k' || ch === 'j') crackBoulder(tx, ty);
        else { fx('sparks', e.x + 4, e.y + 4); sfx('clink'); }
        break;
      }
      if(e.y > LH || e.x < G.cam.x - 30 || e.x > G.cam.x + VW + 30){ e.dead = 1; break; }
      for(const o of G.ents){
        if(o.dead || o === e || !o.on) continue;
        if((FOES.has(o.k) && o.st !== 'flip' && o.st !== 'flat') || o.k === 'egg' || o.k === 'rock' || o.k === 'coconut' || o.k === 'fireball' || (o.k === 'boss' && o.st !== 'defeat')){
          if(overlap(e, o.k === 'boss' ? bossBox(o) : o)){ axeHit(e, o); break; }
        }
      }
      break;
    }
    case 'board': case 'charm': case 'melon':
      if(e.st === 'rise'){ e.vy += 500 * dt; e.y += e.vy * dt; if(e.t > 0.45){ e.st = 'sit'; e.vy = 0; } break; }
      e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt); e.vx = 0; moveBody(e, dt);
      if(e.y > LH + 20) e.dead = 1;
      break;
    case 'plat': { const ox = e.x; e.x = e.bx + (1 - Math.cos(e.t * e.speed)) / 2 * e.range; e.dx = e.x - ox; e.dy = 0; break; }
    case 'lift': { const oy = e.y; e.y = e.by + Math.sin(e.t * e.speed) * e.range * 0.83; e.dy = e.y - oy; e.dx = 0; break; }
    case 'spring': if(e.t > 0.3) e.t = 0.3; break;
    case 'torch':
      if(e.st !== 'got') for(const p of G.players) if(active(p) && overlap(p, e)){
        e.st = 'got'; G.check = e.x; sfx('torch'); fx('sparkle', e.x + 6, e.y + 4, '#ffb347');
        addScore(500, e.x + 6, e.y - 6, '#7dff8a'); break;
      }
      break;
    case 'cave':
      if(!G.warp && tileAt(e.tx, e.ty) !== 'k' && tileAt(e.tx, e.ty) !== 'j' && tileAt(e.tx + 1, e.ty) !== 'k' && tileAt(e.tx + 1, e.ty) !== 'j'){
        e.st = 'open';
        for(const p of G.players) if(active(p) && p.x + p.w / 2 > e.x + 6 && p.x + p.w / 2 < e.x + e.w - 4 && p.y + p.h > e.y + 10){ startWarp(e); break; }
      }
      break;
    case 'boss': stepBoss(e, dt); break;
    case 'coconut':
      e.vy += 600 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if(e.y + e.h >= groundY(e.x + 4) && e.vy > 0 && !pitAt(Math.floor((e.x + 4) / T))){ e.y = groundY(e.x + 4) - e.h; if(e.bounced){ e.dead = 1; fx('chunks', e.x + 4, e.y + 6, '#fffaf0'); fx('chunks', e.x + 4, e.y + 6, '#7a4b2a'); sfx('shatter'); } else { e.vy = -e.vy * 0.4; e.vx *= 0.5; e.bounced = 1; sfx('rock'); } }
      if(e.y > LH + 20 || e.t > 5 || e.x < T) e.dead = 1;
      break;
    case 'fireball':
      e.vy += 900 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if(e.y + e.h >= 12 * T && e.vy > 0){ e.y = 12 * T - e.h; e.vy = -230; }
      if(e.x < T || e.x > G.W * T - T - e.w || e.t > 6){ e.dead = 1; fx('sparks', e.x + 4, e.y + 4); }
      break;
    case 'fallrock':
      if(e.st === 'warn'){ if(e.t > 0.9){ e.st = 'fall'; e.vy = 60; } }
      else { e.vy += 900 * dt; e.y += e.vy * dt; if(e.y + e.h >= 12 * T){ e.dead = 1; fx('chunks', e.x + 7, 12 * T - 6, '#6e6070'); sfx('shatter'); fx('shake', 0.12); } }
      break;
  }
  if(FOES.has(e.k) && e.y > LH + 30) e.dead = 1;
}
function crackBoulder(tx, ty){
  // cracked boulders take two axe hits; the second one smashes the whole boulder
  const cells = [];
  for(let y = ty - 1; y <= ty + 1; y++) for(let x = tx - 1; x <= tx + 1; x++){ const ch = tileAt(x, y); if(ch === 'k' || ch === 'j') cells.push([x, y, ch]); }
  const broken = cells.some(c => c[2] === 'j');
  if(broken){
    const group = new Set(), stack = [[tx, ty]];
    while(stack.length){ const [x, y] = stack.pop(), key = x + ',' + y; if(group.has(key)) continue; const ch = tileAt(x, y); if(ch !== 'k' && ch !== 'j') continue; group.add(key); stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
    for(const key of group){ const [x, y] = key.split(',').map(Number); setTile(x, y, '.'); fx('chunks', x * T + 8, y * T + 8, '#a8957e'); }
    sfx('shatter'); fx('shake', 0.2); addScore(500, tx * T + 8, ty * T - 8, '#ffd45e');
  } else {
    for(const c of cells) setTile(c[0], c[1], 'j');
    sfx('crack'); fx('chunks', tx * T + 8, ty * T + 8, '#a8957e');
  }
}
function startWarp(cave){
  const exit = G.ents.filter(e => e.k === 'exit' && e.x > cave.x).sort((a, b) => a.x - b.x)[0];
  if(!exit) return;
  G.warp = { t: 0, x: exit.x, y: exit.y + exit.h, moved: false };
  sfx('warp'); G.secret = true;
}
function stepWarp(dt){
  const w = G.warp;
  w.t += dt;
  if(!w.moved && w.t >= 0.45){
    w.moved = true;
    G.players.forEach((p, i) => {
      if(p.done) return;
      p.x = w.x + 4 + i * 16; p.y = w.y - p.h; p.vx = 30; p.vy = 0; p.bubble = false; p.climb = false; p.plat = null; p.onGround = true; p.inv = Math.max(p.inv, 1);
    });
    G.ents = G.ents.filter(e => !(e.k === 'rock' || e.k === 'axe'));
    camera(0, true);
    fx('big', w.x + 20, w.y - 50, 'SECRET SHORTCUT!', '#ffd45e'); addScore(2000);
    sfx('secret');
    if(G.check === null || G.check < w.x) G.check = w.x;
  }
  if(w.t > 0.9) G.warp = null;
}
function interact(){
  const act = G.players.filter(active);
  for(const e of G.ents){
    if(e.dead || !e.on) continue;
    for(const p of act){
      if(!active(p)) continue;
      if(e.k === 'boss'){ if(overlap(p, bossBox(e))) bossContact(e, p); continue; }
      if(!overlap(p, e)) continue;
      if(ITEMS.has(e.k)){ if(e.st !== 'rise') collect(e, p); break; }
      if(e.k === 'egg'){ crackEgg(e, p); break; }
      if(e.k === 'fallrock'){ if(e.st === 'fall') hurt(p); continue; }
      const stompy = p.vy > 0 && p.prevBottom <= e.y + Math.max(5, e.h * 0.55);
      if(HAZARDS.has(e.k)){
        if(p.charm > 0){ if(e.k !== 'ember'){ e.dead = 1; fx('chunks', e.x + 5, e.y + 5, '#9a8a78'); addScore(200, e.x + 5, e.y - 4); sfx('shatter'); } continue; }
        if(e.k === 'rock' && stompy){ bounce(p, 300); p.y = e.y - p.h; sfx('boing'); addScore(100, e.x + 7, e.y - 4); continue; }
        hurt(p, e.k); continue;
      }
      if(!FOES.has(e.k) || e.st === 'flip' || e.st === 'flat') continue;
      if(p.charm > 0){ killEnemy(e, p, p.x < e.x ? 1 : -1); continue; }
      if(stompy){ stomp(e, p); bounce(p); }
      else hurt(p, e.k);
    }
  }
  // Tiki tower: land on a friend who is standing still to spring off their head
  for(const a of act) for(const b of act){
    if(a === b || a.vy <= 0 || a.prevBottom > b.y + 3 || !overlap(a, b)) continue;
    a.y = b.y - a.h; b.squashT = 0.2;
    if(b.onGround && Math.abs(b.vx) < 10 && !b.climb){ bounce(a, TOWER_V); a.springy = true; sfx('tower'); fx('big', a.x + 6, a.y - 14, 'TIKI TOWER!', '#ffd45e'); fx('sparkle', b.x + 6, b.y, '#fff'); G.towers = (G.towers || 0) + 1; }
    else { bounce(a, a.bot ? 280 : 260); sfx('boing'); }
  }
  // the goal gate
  if(G.gate && G.goalT < 0) for(const p of act){
    if(p.x + p.w / 2 > G.gate.x + G.gate.w / 2){ reachGoal(); break; }
  }
}
function reachGoal(){
  G.goalT = 0; sfx('gate');
  let bonus = 0;
  for(const p of G.players){
    if(p.bubble){ p.bubble = false; p.x = G.gate.x + 4; p.y = groundY(p.x + 6) - p.h; }
    p.dead = 0; p.done = 1; p.vy = 0; p.charm = 0; p.climb = false;
    const b = Math.round(p.energy) * 20; bonus += b; p.bonus = b;
    fx('text', p.x + 6, p.y - 10, 'ENERGY +' + b, '#7dff8a');
  }
  G.score += bonus;
  fx('firework', G.gate.x + 22, G.gate.y + 10, '#ffd45e');
}

/* ---------- Bosses ---------- */
function makeBoss(bw, bx, by){
  const hp = D().bossHp;
  const base = { bw, st: 'intro', hp, max: hp, inv: 0, face: -1, on: true, name: BOSS_NAMES[bw], t: 0 };
  if(bw === 0) return mkEnt('boss', 17.2 * T, LH + 10, Object.assign(base, { w: 46, h: 42 }));
  if(bw === 1) return mkEnt('boss', VW / 2 - 17, -50, Object.assign(base, { w: 34, h: 30 }));
  return mkEnt('boss', bx - 22, 12 * T + 20, Object.assign(base, { w: 44, h: 48 }));
}
function bossBox(e){
  if(e.bw === 0) return { x: e.x + 4, y: e.y + 2, w: e.w - 8, h: Math.max(0, Math.min(e.h - 4, 12 * T + 4 - e.y)) };
  return { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 };
}
function bossWeak(e){
  if(e.inv > 0 || e.st === 'defeat' || e.st === 'intro') return false;
  if(e.bw === 0) return e.st === 'throw' || e.st === 'tired';
  if(e.bw === 1) return e.st !== 'rise';
  return e.st === 'spit' || e.st === 'tired';
}
function setBoss(e, st){ e.st = st; e.t = 0; }
function stepBoss(e, dt){
  if(e.inv > 0) e.inv -= dt;
  const ground = 12 * T, anger = e.max - e.hp;
  const tgt = nearestPlayer(e.x) || G.players[0];
  const tx = tgt ? tgt.x + tgt.w / 2 : VW / 2;
  const toward = tx < e.x + e.w / 2 ? -1 : 1;
  const spd = (1 + anger * 0.05) * (G.diff === 'kids' ? 0.8 : G.diff === 'pro' ? 1.15 : 1);
  if(e.st === 'defeat'){
    e.vy += 700 * dt; e.y += e.vy * dt; e.x += e.face * 20 * dt;
    if(Math.random() < 0.25) fx('sparkle', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#fff');
    if(e.t > 2.4){ e.dead = 1; bossDefeated(e); }
    return;
  }
  if(e.bw === 0){
    // Captain Kelp lives in the lagoon on the right, lobs coconuts, then flops onto the beach to rest
    const up = ground - 30, low = ground - 20;
    if(e.st === 'intro'){ e.y += (up - e.y) * Math.min(1, dt * 1.6); if(Math.random() < 0.3) fx('splash', e.x + Math.random() * e.w, ground + 4); if(e.t > 1.8) setBoss(e, 'throw'); return; }
    if(e.st === 'throw'){
      e.y = up + Math.sin(G.time * 3) * 2;
      const n = G.diff === 'kids' ? 2 : 3 + Math.min(2, Math.floor(anger / 3)), gap = 0.62 / spd;
      for(let i = 0; i < n; i++){ const at = 0.5 + i * gap; if(e.t - dt < at && e.t >= at){
        const sx = e.x + 6, sy = e.y + 8, fl = 1.15, aimX = clamp(tx + (i - 1) * 26, 2 * T, 15 * T);
        mkEnt('coconut', sx, sy, { on: true, vx: (aimX - sx) / fl, vy: (ground - 8 - sy) / fl - 0.5 * 600 * fl, face: -1 }); sfx('throw');
      } }
      if(e.t > 0.5 + n * gap + 0.4) setBoss(e, 'sink');
    } else if(e.st === 'sink'){ e.y += 90 * dt; if(e.y > ground + 12){ setBoss(e, e.rested ? 'rise' : 'lunge'); e.rested = !e.rested; e.x = e.rested ? 15.6 * T : 17.2 * T; } }
    else if(e.st === 'rise'){ e.y -= 80 * dt; if(e.y <= up){ e.y = up; setBoss(e, 'throw'); } }
    else if(e.st === 'lunge'){ e.y -= 90 * dt; if(e.y <= low){ e.y = low; setBoss(e, 'tired'); fx('splash', e.x + 10, ground + 2); sfx('splash'); } }
    else if(e.st === 'tired'){ e.y = low + Math.sin(e.t * 4) * 1.2; if(e.t > (G.diff === 'kids' ? 3.4 : 2.6)) setBoss(e, 'sink'); }
    e.face = -1;
  } else if(e.bw === 1){
    // Queen Buzzbelle hovers, calls her bees, then dives and gets her stinger stuck
    const high = 36;
    if(e.st === 'intro'){ e.y += (high - e.y) * Math.min(1, dt * 1.5); if(e.t > 1.8) setBoss(e, 'hover'); return; }
    e.face = toward;
    if(e.st === 'hover'){
      e.x += clamp(tx - e.w / 2 - e.x, -1, 1) * Math.min(Math.abs(tx - e.w / 2 - e.x), 55 * spd * dt);
      e.y = high + Math.sin(G.time * 2.6) * 6;
      if(e.t > 1.8 / spd){ e.n = (e.n || 0) + 1; setBoss(e, e.n % 2 ? 'summon' : 'aim'); }
    } else if(e.st === 'summon'){
      if(e.t - dt < 0.4 && e.t >= 0.4){
        const bees = G.ents.filter(q => q.k === 'bee' && q.st !== 'flip').length, n = G.diff === 'kids' ? 1 : 2;
        for(let i = 0; i < n && bees + i < 3; i++) mkEnt('bee', e.x + e.w / 2 - 6 + (i ? 14 : -14), e.y + e.h, { on: true, st: 'fly', bx: e.x + (i ? 60 : -40), by: 70 + i * 20, t: i, cool: 1.5, face: i ? 1 : -1 });
        sfx('buzz');
      }
      if(e.t > 1.0) setBoss(e, 'hover');
    } else if(e.st === 'aim'){ e.x += Math.sin(e.t * 50) * 0.8; e.tx = tx - e.w / 2; if(Math.floor(e.t * 8) !== Math.floor((e.t - dt) * 8)) sfx('warn'); if(e.t > 0.8){ setBoss(e, 'dive'); sfx('buzz'); } }
    else if(e.st === 'dive'){
      const dx = e.tx - e.x; e.x += clamp(dx, -1, 1) * Math.min(Math.abs(dx), 160 * dt); e.y += 230 * spd * dt;
      if(e.y + e.h >= ground){ e.y = ground - e.h; setBoss(e, 'stuck'); fx('shake', 0.3); sfx('land'); fx('dust', e.x + e.w / 2, ground); }
    } else if(e.st === 'stuck'){ e.x += Math.sin(e.t * 30) * 0.4; if(e.t > (G.diff === 'kids' ? 2.6 : 1.9)) setBoss(e, 'rise'); }
    else if(e.st === 'rise'){ e.y -= 110 * dt; if(e.y <= high){ e.y = high; setBoss(e, 'hover'); } }
    e.x = clamp(e.x, T + 2, G.W * T - T - 2 - e.w);
  } else {
    // Big Bongo drums up falling rocks, spits fireballs, hops across the crater, then needs a rest
    const floor = ground - e.h;
    if(e.st === 'intro'){ e.y += (floor - e.y) * Math.min(1, dt * 1.2); if(Math.random() < 0.4) fx('splash', e.x + Math.random() * e.w, ground, '#ffb347'); if(e.t > 2.2){ e.y = floor; setBoss(e, 'drum'); } return; }
    if(e.st === 'drum'){
      const n = G.diff === 'kids' ? 2 : 3 + Math.min(2, Math.floor(anger / 3));
      for(let i = 0; i < n; i++){ const at = 0.3 + i * 0.38; if(e.t - dt < at && e.t >= at){
        const x = i === 0 ? clamp(tx - 7, 2 * T, G.W * T - 3 * T) : 2 * T + Math.random() * (G.W - 5) * T;
        mkEnt('fallrock', x, T, { on: true, st: 'warn' }); sfx('drum'); fx('shake', 0.08);
      } }
      if(e.t > 0.3 + n * 0.38 + 0.4){ e.face = toward; setBoss(e, 'spit'); }
    } else if(e.st === 'spit'){
      const n = G.diff === 'kids' ? 1 : 2;
      for(let i = 0; i < n; i++){ const at = 0.4 + i * 0.5; if(e.t - dt < at && e.t >= at){
        mkEnt('fireball', e.face > 0 ? e.x + e.w - 4 : e.x - 6, e.y + 24, { on: true, vx: e.face * 95 * spd, vy: -120, face: e.face }); sfx('spit');
      } }
      if(e.t > 0.4 + n * 0.5 + 0.3){ setBoss(e, 'hop'); e.vy = -440; e.hopTo = e.x + e.w / 2 < G.W * T / 2 ? G.W * T - 5 * T : 3 * T; }
    } else if(e.st === 'hop'){
      e.vy += 1000 * dt; e.y += e.vy * dt; e.x += clamp(e.hopTo - e.x, -1, 1) * Math.min(Math.abs(e.hopTo - e.x), 170 * dt);
      if(e.y >= floor && e.vy > 0){ e.y = floor; e.vy = 0; setBoss(e, 'tired'); fx('shake', 0.45); sfx('land'); fx('dust', e.x + e.w / 2, ground, '#ffb347'); }
    } else if(e.st === 'tired'){ if(e.t > (G.diff === 'kids' ? 3.2 : 2.4)){ setBoss(e, 'drum'); } }
    e.x = clamp(e.x, T + 1, G.W * T - T - 1 - e.w);
  }
}
function hitBoss(e, n){
  e.hp = Math.max(0, e.hp - (n || 1)); e.inv = 0.55;
  sfx('bossHit'); fx('shake', 0.25); fx('sparkle', e.x + e.w / 2, e.y + 6, '#fff');
  addScore(500 * (n || 1), e.x + e.w / 2, e.y - 6, '#ffd45e');
  if(e.hp <= 0){ setBoss(e, 'defeat'); e.vy = -300; e.inv = 0; sfx('boom'); G.ents.forEach(q => { if(HAZARDS.has(q.k) || q.k === 'bee') q.dead = 1; }); for(let i = 0; i < 3; i++) fx('firework', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#ffd45e'); }
}
function axeBoss(e, axe){
  if(e.st === 'defeat' || e.st === 'intro') return;
  if(!bossWeak(e)){ fx('sparks', axe.x + 4, axe.y + 4); sfx('clink'); return; }
  hitBoss(e, 1);
}
function bossContact(e, p){
  if(e.st === 'defeat' || e.st === 'intro') return;
  const box = bossBox(e);
  const stompy = p.vy > 0 && p.prevBottom <= box.y + 10;
  const resting = (e.bw === 0 && e.st === 'tired') || (e.bw === 1 && e.st === 'stuck') || (e.bw === 2 && e.st === 'tired');
  if(stompy){
    if(resting && e.inv <= 0){ hitBoss(e, 2); bounce(p, 380); p.chain++; return; }
    if(resting || e.inv > 0){ bounce(p, 300); return; }
    bounce(p, 300); hurt(p); return;
  }
  if(p.charm > 0){ if(e.inv <= 0) hitBoss(e, 1); return; }
  if(resting || e.inv > 0.3) return;
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
  if(!list.length) list = G.players.filter(p => p.done);
  if(!list.length) return;
  let lead = -1e9, trail = 1e9, sum = 0;
  for(const p of list){ const cx = p.x + p.w / 2; lead = Math.max(lead, cx); trail = Math.min(trail, cx); sum += cx; }
  const avg = sum / list.length;
  let target = list.length === 1 ? avg - VW * 0.4 : avg - VW * 0.5 + 20;
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
    if(p.x < G.cam.x){ p.x = G.cam.x; if(p.vx < 0) p.vx = 0; if(rectSolid(p) && G.players.length > 1) toBubble(p); }
    if(p.x + p.w > G.cam.x + VW){ p.x = G.cam.x + VW - p.w; if(p.vx > 0) p.vx = 0; }
  }
}
function stepCrumbles(dt){
  for(const [i, t] of G.crumbles){
    const nt = t + dt;
    if(nt > 0.45){
      G.crumbles.delete(i);
      const tx = i % G.W, ty = Math.floor(i / G.W);
      setTile(tx, ty, '.'); fx('chunks', tx * T + 8, ty * T + 8, G.island.g.fill); sfx('crumble');
    } else G.crumbles.set(i, nt);
  }
}

/* ---------- Level flow ---------- */
function loadLevel(ix, fromCheck){
  const L = buildLevel(ix);
  G.lv = ix; G.W = L.W; G.map = L.map.slice(); G.island = L.island; G.mods = []; G.crumbles = new Map();
  G.ents = []; nextEnt = 1; G.gate = null; G.goalT = -1; G.wipeT = 0; G.shake = 0; G.warp = null;
  if(!fromCheck){ G.check = null; G.lvT = 0; G.levelScore = G.score; G.secret = false; for(const p of G.players){ p.lf = 0; p.lb = 0; } }
  for(const e of L.ents) spawnFromMap(e);
  G.loadN++; parts = [];
  placePlayers(G.check !== null ? G.check + 2 : L.start.tx * T + 2);
  camera(0, true);
}
function startIntro(short){
  A.Menu.close();
  G.state = 'intro'; G.stateT = 0; G.introLen = short ? 1.4 : 2.4;
  sfx('stageStart'); A.keepAwake();
  if(isBoss(G.lv) && !G.demo) A.toast(BOSS_LINES[LEVELS[G.lv].boss], 3400);
}
function newGame(players){
  G.demo = false;
  G.roster = players.map(p => ({ slot: p.slot, source: p.source, name: p.name, color: p.color }));
  G.players = G.roster.map(r => makeHero(Object.assign({}, r)));
  G.score = 0; G.lives = D().lives;
  loadLevel(G.startLv); startIntro();
}
function startDemo(){
  G.demo = true;
  const pick = [0, 1, 4, 8].filter(i => i <= Math.max(1, G.unlocked));
  const ix = pick[Math.floor(Math.random() * pick.length)];
  G.players = [makeHero({ slot: 0, bot: true, name: 'Koa', color: A.PLAYER_COLORS[0] }), makeHero({ slot: 1, bot: true, name: 'Lani', color: A.PLAYER_COLORS[1] })];
  loadLevel(ix); G.demoT = 0;
  G.players[1].x -= 20;
}
function dropIn(){
  if(G.demo || G.players.length >= 2 || G.state !== 'play') return;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire') || G.players.some(p => p.source === s.id)) continue;
    const used = G.players.map(p => p.slot);
    const slot = [0, 1].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.players.map(p => p.name));
    const p = makeHero({ slot, source: s.id, color: A.PLAYER_COLORS[slot], name });
    const act = G.players.filter(active);
    const ref = act[0] || G.players[0];
    p.x = ref ? ref.x : G.cam.x + 40; p.y = ref ? ref.y - 30 : 100;
    G.players.push(p); G.players.sort((a, b) => a.slot - b.slot);
    G.roster = G.players.map(q => ({ slot: q.slot, source: q.source, name: q.name, color: q.color }));
    if(act.length){ toBubble(p); p.bubbleT = 0.2; } else { p.y = groundY(p.x + 6) - p.h; }
    sfx('join'); fx('text', p.x + 6, p.y - 10, name.toUpperCase() + ' JOINED!', p.color);
    return;
  }
}
function flowChecks(dt){
  const alive = G.players.filter(p => !p.away);
  const wiped = alive.length > 0 && alive.every(p => p.bubble || p.dead > 0) && !G.players.some(p => p.done);
  if(wiped){ G.wipeT += dt; if(G.wipeT > (G.players.length > 1 ? 1.3 : 2.4)) loseLife(); }
  else G.wipeT = 0;
  if(G.goalT >= 0){
    G.goalT += dt;
    if(G.goalT > (isBoss(G.lv) ? 3.4 : 2.2)) startClear();
  }
}
function loseLife(){
  G.wipeT = 0;
  if(hasLives()) G.lives--;
  if(hasLives() && G.lives <= 0){ gameOver(); return; }
  for(const p of G.players){ p.charm = 0; p.board = false; }
  loadLevel(G.lv, true); startIntro(true);
}
function startClear(){
  G.state = 'clear'; G.stateT = 0; sfx('fanfare');
  G.unlocked = Math.max(G.unlocked, Math.min(LEVELS.length - 1, G.lv + 1)); A.Store.set('tiki.unlocked', G.unlocked);
}
function results(){
  G.state = 'results'; G.stateT = 0;
  const key = 'tiki.best.' + G.lv + '.' + G.diff, best = A.Store.get(key, 0);
  let rec = false;
  if(!best || G.lvT < best){ A.Store.set(key, r1(G.lvT)); rec = true; }
  const def = LEVELS[G.lv], last = G.lv >= LEVELS.length - 1;
  const rows = G.players.map(p => '<b style="color:' + p.color + '">' + A.esc(p.name) + '</b> · ' + p.lf + (p.lf === 1 ? ' fruit · ' : ' fruits · ') + p.lb + (p.lb === 1 ? ' bop' : ' bops') +
    (p.bonus ? ' · energy +' + p.bonus : '')).join('<br>');
  G.players.forEach(p => { p.bonus = 0; });
  const title = isBoss(G.lv) ? BOSS_TITLES[def.boss] + ' is beaten!' : 'Area ' + def.code + ' clear!';
  const items = [];
  if(last) items.push({ label: 'See the ending', select: ending });
  else items.push({ label: 'Next: ' + LEVELS[G.lv + 1].code + ' ' + LEVELS[G.lv + 1].name, select: () => { nextLevel(); } });
  items.push({ label: 'Play it again', select: () => { G.score = G.levelScore; loadLevel(G.lv); startIntro(); } });
  items.push({ label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) });
  if(!hosting()) items.push({ label: 'Quit to title', select: toTitle });
  A.Menu.open({ center: true, shared: true, kicker: def.code + ' · ' + def.name + ' · ' + D().label, title,
    text: rows + (G.secret ? '<br>You found the <b>secret shortcut</b>!' : '') + '<br><br>Team score <b>' + G.score.toLocaleString() + '</b> · time <b>' + fmt(G.lvT) + '</b>' + (rec ? ' · <b>new best!</b>' : best ? ' · best ' + fmt(best) : ''),
    items });
}
function nextLevel(){
  const n = G.lv + 1;
  for(const p of G.players){ p.done = 0; p.bubble = false; }
  G.startLv = n; loadLevel(n); startIntro();
}
function ending(){
  A.Menu.close();
  G.state = 'ending'; G.stateT = 0; A.Store.set('tiki.beaten', true);
  G.ents = G.ents.filter(e => !HAZARDS.has(e.k) && e.k !== 'bee' && e.k !== 'axe');
  G.players.forEach((p, i) => { p.done = 0; p.bubble = false; p.dead = 0; p.x = G.cam.x + VW / 2 - 16 + i * 24; p.y = 12 * T - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.face = 1; p.board = false; p.charm = 0; });
}
function endingMenu(){
  A.Menu.open({ center: true, shared: true, kicker: 'Tiki Trail', title: 'The Sunstone is home!',
    text: 'Big Bongo has cooled right down, and the sun is shining on the islands again. Thanks for playing, islanders!<br>Team score <b>' + G.score.toLocaleString() + '</b>',
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
      { label: 'Keep going', select: () => { G.lives = D().lives; G.score = G.levelScore; for(const p of G.players) p.board = false; loadLevel(G.lv); startIntro(); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  G.lvT += dt;
  if(G.warp){ stepWarp(dt); for(const e of G.ents) if(e.k === 'plat' || e.k === 'lift') stepEnt(e, dt); return; }
  for(const e of G.ents) if(e.k === 'plat' || e.k === 'lift') stepEnt(e, dt);
  for(const p of G.players) stepPlayer(p, dt);
  for(const e of G.ents) if(!e.dead && e.k !== 'plat' && e.k !== 'lift') stepEnt(e, dt);
  interact();
  stepCrumbles(dt);
  camera(dt);
  clampPlayers();
  G.ents = G.ents.filter(e => !e.dead);
  if(G.demo){
    G.demoT += dt;
    if(G.goalT >= 0) G.goalT += dt;
    if(G.goalT > 2.5 || G.demoT > 70){ startDemo(); }
  }
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
const levelLabel = ix => LEVELS[ix].code + ' · ' + LEVELS[ix].name;
function titleMenu(){
  G.state = 'title';
  A.Menu.open({ kicker: 'xRetro', title: 'TIKI TRAIL',
    text: 'Big Bongo has run off with the island <b>Sunstone</b>! Run, jump and throw your <b>stone axe</b> across Coconut Cove, the Jungle Drums and Mount Ember. Keep your energy up with <b>fruit</b>. <b>1–2 islanders</b> on one screen, or online.',
    items: [
      { label: 'Play', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Start at', value: () => levelLabel(G.startLv), change: d => { G.startLv = (G.startLv + d + G.unlocked + 1) % (G.unlocked + 1); A.Store.set('tiki.start', G.startLv); } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('tiki.diff', G.diff); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: controllerLine() });
}
function controllerLine(){
  const n = A.Input.pads().length;
  const unl = G.unlocked > 0 ? 'Unlocked up to ' + LEVELS[G.unlocked].code + '. ' : '';
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + unl + 'Kids mode: energy never runs out and the sea bounces you back.';
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + levelLabel(G.startLv) + ' · ' + D().label,
    title: 'Who is on the trail?',
    text: online ? 'A friend joins from any device with the code or invite link. Press FIRE to join, then FIRE again when ready.'
                 : 'Press FIRE to join, then FIRE again when ready. 1 or 2 islanders share one screen. A friend can drop in later by pressing FIRE.',
    min: 1, max: 2, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => newGame(players),
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'play' && G.state !== 'intro') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart area', select: () => { G.score = G.levelScore; loadLevel(G.lv); startIntro(); } }];
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
    text: 'The host gets a <b>4-letter code</b>; a friend types it in or opens the invite link. Two islanders from any mix of devices.',
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
    Net.host('tiki', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'tiki', name, netHandlers).then(() => {
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
  const touch = A.Input.isTouch;
  A.Menu.open({ center: true, kicker: 'How to play', title: 'On the trail',
    text: '<b>Left / right</b> run (keep holding to sprint) · <b>' + (touch ? 'JUMP' : 'A / Space / FIRE') + '</b> jumps, hold it to jump higher · <b>Down + ' + (touch ? 'JUMP' : 'FIRE') + '</b> throws your stone axe.<br>' +
          'Your <b>energy bar</b> drains as you go: eat <b>fruit</b> to fill it. Grab 3 fruits in one jump for a <b>Fruit Frenzy</b>. Watch out for trip stones and campfires.<br>' +
          'Crack open <b>eggs</b>: a <b>skateboard</b> makes you fast and takes one hit for you, a <b>sun charm</b> makes you unstoppable, a <b>melon</b> fills you up.<br>' +
          'Bop snails, bees and frogs from above or with your axe. Jump over rolling rocks. Two players? Land on a friend who is standing still for a <b>Tiki Tower</b> leap. Some cracked boulders hide <b>secret caves</b>, and <b>vines</b> (hold UP) lead up to the treetops.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0, modsSent = 0, lastLoadSent = -1, snapN = 0, forceFull = false;
const KINDS = ['snail', 'bee', 'frog', 'rock', 'ember', 'coconut', 'fireball', 'fallrock', 'axe', 'egg', 'board', 'charm', 'melon', 'spring', 'plat', 'lift', 'torch', 'gate', 'cave', 'exit', 'spawner', 'boss'];
const KI = {}; KINDS.forEach((k, i) => { KI[k] = i; });
const ITEM_IX = ['melon', 'board', 'charm'];
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
    if(q.dead || q.k === 'spawner') continue;
    if(q.k !== 'boss' && q.k !== 'gate' && (q.x + q.w < cx - 40 || q.x > cx + VW + 40)) continue;
    const row = [q.id, KI[q.k], r1(q.x), r1(q.y), q.face, q.st || '', r2(q.t)];
    if(q.k === 'boss') row.push([q.hp, q.max, r2(q.inv), q.bw]);
    else if(q.k === 'egg') row.push(ITEM_IX.indexOf(q.item));
    e.push(row);
  }
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), lv: G.lv, ln: G.loadN, d: G.diff, dm: G.demo ? 1 : 0,
    sc: G.score, li: hasLives() ? G.lives : -1, cx: r1(cx), gt: r2(G.goalT), lt: r1(G.lvT), il: G.introLen, wp: G.warp ? r2(G.warp.t) : -1,
    p: G.players.map(p => [p.slot, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.face,
      (p.onGround ? 1 : 0) | (p.bubble ? 2 : 0) | (p.done ? 4 : 0) | (p.inv > 0 ? 8 : 0) | (p.away ? 16 : 0) | (p.skid ? 32 : 0) | (p.board ? 64 : 0) | (p.climb ? 128 : 0) | (p.tripT > 0 ? 256 : 0) | (p.faint ? 512 : 0),
      r1(p.energy), r2(p.dead), r2(p.charm), p.name, p.color, p.source || '', p.lf, r2(p.bubbleT), r2(p.throwT), r2(p.squashT)]),
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
  G.lv = lv; G.W = L.W; G.island = L.island; G.map = L.map.slice(); G.modsApplied = 0;
}
function receiveMeta(m){
  if(m.ln !== G.loadN || m.lv !== G.lv || !G.map){ G.loadN = m.ln; guestLevel(m.lv); parts = []; }
  const apply = (arr, from) => { for(let i = from; i + 1 < arr.length; i += 2) G.map[arr[i]] = arr[i + 1]; };
  if(m.mf){ G.map = buildLevel(m.lv).map.slice(); apply(m.mf, 0); G.modsApplied = m.mf.length / 2; }
  else if(m.md && m.md[0] === G.modsApplied){ apply(m.md, 1); G.modsApplied += (m.md.length - 1) / 2; }
}
let guestLastState = '';
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!G.map || s.lv !== G.lv) guestLevel(s.lv);
  G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.score = s.sc; G.lives = s.li < 0 ? Infinity : s.li;
  G.goalT = s.gt; G.lvT = s.lt; G.introLen = s.il || 2.4; G.warp = s.wp >= 0 ? { t: s.wp } : null;
  if(G.state === 'intro' && guestLastState !== 'intro' && isBoss(G.lv) && !G.demo) A.toast(BOSS_LINES[LEVELS[G.lv].boss], 3400);
  guestLastState = G.state;
  G.cam.x = a.lv === b.lv && Math.abs(a.cx - b.cx) < 80 ? L(a.cx, b.cx) : b.cx; G.cam.y = LH - VH;
  const pp = new Map(a.p.map(q => [q[0], q]));
  G.players = s.p.map(q => {
    const o = pp.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60 && Math.abs(o[2] - q[2]) < 60;
    const f = q[6];
    return { slot: q[0], x: near ? L(o[1], q[1]) : q[1], y: near ? L(o[2], q[2]) : q[2], vx: q[3], vy: q[4], face: q[5],
      onGround: !!(f & 1), bubble: !!(f & 2), done: (f & 4) ? 1 : 0, inv: (f & 8) ? 1 : 0, away: !!(f & 16), skid: !!(f & 32),
      board: !!(f & 64), climb: !!(f & 128), tripT: (f & 256) ? 0.3 : 0, faint: !!(f & 512),
      energy: q[7], dead: q[8], charm: q[9], name: q[10], color: q[11], source: q[12], lf: q[13], w: HW, h: HH,
      bubbleT: q[14], throwT: q[15], squashT: q[16] };
  });
  const pe = new Map(a.e.map(q => [q[0], q]));
  G.ents = s.e.map(q => {
    const o = pe.get(q[0]), near = o && Math.abs(o[2] - q[2]) < 48 && Math.abs(o[3] - q[3]) < 48;
    const k = KINDS[q[1]], sz = SIZES[k] || [12, 12];
    const e = { id: q[0], k, x: near ? L(o[2], q[2]) : q[2], y: near ? L(o[3], q[3]) : q[3], w: sz[0], h: sz[1], face: q[4], st: q[5], t: q[6], on: true };
    if(k === 'boss'){ const x = q[7]; e.hp = x[0]; e.max = x[1]; e.inv = x[2]; e.bw = x[3]; e.w = [46, 34, 44][e.bw]; e.h = [42, 30, 48][e.bw]; e.name = BOSS_NAMES[e.bw]; }
    else if(k === 'egg') e.item = ITEM_IX[q[7]] || 'melon';
    return e;
  });
  G.gate = G.ents.find(e => e.k === 'gate') || null;
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
    else if(G.players.some(p => p.charm > 0 && !p.bubble && !p.done)) want = CHARM_THEME;
    else if(isBoss(G.lv)) want = boss && boss.st !== 'defeat' ? BOSS_THEME : null;
    else want = G.island.music;
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
      for(const p of G.players) if(p.done) stepDone(p, dt);
      if(Math.floor(G.stateT * 2.5) !== Math.floor((G.stateT - dt) * 2.5) && G.stateT < 2.6){
        const hx = G.gate ? G.gate.x + 22 : VW / 2 + G.cam.x;
        fx('firework', hx - 60 + Math.random() * 120, 40 + Math.random() * 50, A.PLAYER_COLORS[Math.floor(Math.random() * 4)]); sfx('firework');
      }
      if(G.stateT > 3.4) results();
      break;
    case 'ending':
      G.stateT += dt;
      for(const p of G.players){ p.vy += G_FALL * dt; p.y += p.vy * dt; if(p.y + p.h >= 12 * T){ p.y = 12 * T - p.h; p.vy = 0; p.onGround = true; if(Math.random() < 0.02){ p.vy = -300; p.onGround = false; } } else p.onGround = false; }
      if(Math.floor(G.stateT * 1.6) !== Math.floor((G.stateT - dt) * 1.6)){ fx('firework', G.cam.x + 40 + Math.random() * (VW - 80), 30 + Math.random() * 60, A.PLAYER_COLORS[Math.floor(Math.random() * 4)]); sfx('firework'); }
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
function rr(c, x, y, w, h, r){ r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
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
function heart(c, x, y, s, col){ c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s * 0.9); c.bezierCurveTo(x - s * 1.3, y, x - s * 0.7, y - s * 0.9, x, y - s * 0.25); c.bezierCurveTo(x + s * 0.7, y - s * 0.9, x + s * 1.3, y, x, y + s * 0.9); c.fill(); }

/* ---------- Tiles (cached per screen resolution, drawn on whole device pixels: no seams) ---------- */
const tileCache = new Map(); let cacheSize = 0;
function sprite(key, draw){
  const S = Math.max(1, Math.round(T * display.scale));
  if(S !== cacheSize){ tileCache.clear(); cacheSize = S; }
  let cv = tileCache.get(key);
  if(!cv){ cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.scale(S / T, S / T); draw(c); tileCache.set(key, cv); }
  return cv;
}
function drawGround(c, I, top, left, right, bottom, v){
  const g = I.g, k = I.key;
  c.fillStyle = g.fill; c.fillRect(0, 0, T, T);
  const pts = [[3, 9], [11, 5], [7, 13], [13, 12], [2, 3], [9, 9]];
  if(k === 'volcano'){
    c.fillStyle = g.fillDk; for(let i = 0; i < 3; i++){ const q = pts[(v + i * 2) % pts.length]; rr(c, q[0] - 1, q[1] - 1, 4, 3, 1); c.fill(); }
    c.strokeStyle = 'rgba(255,122,58,.75)'; c.lineWidth = 0.7; c.beginPath();
    if(v === 0){ c.moveTo(2, 10); c.lineTo(6, 8); c.lineTo(9, 11); }
    else if(v === 1){ c.moveTo(8, 4); c.lineTo(11, 7); c.lineTo(14, 6); }
    else { c.moveTo(4, 14); c.lineTo(7, 12); }
    c.stroke();
    c.fillStyle = 'rgba(255,190,90,.8)'; c.fillRect(pts[v][0], pts[v][1], 0.9, 0.9);
  } else {
    c.fillStyle = g.speck;
    for(let i = 0; i < 3; i++){ const q = pts[(v + i * 2) % pts.length]; rr(c, q[0], q[1], 2.2, 1.6, 0.8); c.fill(); }
    c.fillStyle = g.fillHi; const q = pts[(v + 3) % pts.length]; c.fillRect(q[0] + 1, q[1] - 1, 1.4, 1);
    if(k === 'beach' && v === 1 && !top){ c.fillStyle = '#ffd0dc'; c.beginPath(); c.arc(10, 11, 1.8, Math.PI, 0); c.fill(); c.fillStyle = '#e89aae'; c.fillRect(8.4, 11, 3.2, 0.6); }
  }
  if(left){ c.fillStyle = g.fillDk; c.fillRect(0, 0, 1.6, T); }
  if(right){ c.fillStyle = g.fillDk; c.fillRect(T - 1.6, 0, 1.6, T); }
  if(bottom){ c.fillStyle = g.fillDk; c.fillRect(0, T - 2, T, 2); }
  if(top){
    c.fillStyle = g.topDk; c.fillRect(0, 0, T, 6.5);
    c.fillStyle = g.top; c.fillRect(0, 0, T, 4.4);
    for(let i = 0; i < 4; i++){ circ(c, 2 + i * 4, 4.4, 2.1); c.fill(); }
    c.fillStyle = g.topHi; c.fillRect(0, 0.6, T, 1.1);
    if(k === 'jungle'){
      c.fillStyle = g.topDk; for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(1 + i * 4 + v, 4.5); c.lineTo(2 + i * 4 + v, 1.8); c.lineTo(3 + i * 4 + v, 4.5); c.fill(); }
      if(v === 2){ c.fillStyle = '#ff6ab0'; circ(c, 11, 1.6, 1.1); c.fill(); c.fillStyle = '#ffe14a'; circ(c, 11, 1.6, 0.45); c.fill(); }
    } else if(k === 'beach'){
      if(v === 0){ c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(5, 3, 1.6, Math.PI, 0); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(v * 4 + 2, 2.4, 3, 0.6);
    } else {
      c.fillStyle = 'rgba(255,140,70,.5)'; c.fillRect(v * 5 + 1, 5.4, 3, 0.8);
    }
    if(left){ c.fillStyle = g.topDk; c.fillRect(0, 0, 1.4, 6.5); }
    if(right){ c.fillStyle = g.topDk; c.fillRect(T - 1.4, 0, 1.4, 6.5); }
  }
}
function drawBlock(c, base, dk, hi){
  c.fillStyle = dk; c.fillRect(0, 0, T, T);
  c.fillStyle = base; c.fillRect(0.8, 0.8, T - 1.6, T - 2);
  c.fillStyle = hi; c.fillRect(0.8, 0.8, T - 1.6, 1.4); c.fillRect(0.8, 0.8, 1.4, T - 2);
}
const isBoulder = ch => ch === 'k' || ch === 'j';
function tileSprite(ch, tx, ty){
  const I = G.island, k = I.key;
  if(ch === '#'){
    const top = tileAt(tx, ty - 1) !== '#', left = tileAt(tx - 1, ty) !== '#' && tx > 0, right = tileAt(tx + 1, ty) !== '#' && tx < G.W - 1, bottom = ty < ROWS - 1 && tileAt(tx, ty + 1) !== '#';
    const v = (tx * 7 + ty * 13) % 3;
    return sprite(k + '#' + (+top) + (+left) + (+right) + (+bottom) + v, c => drawGround(c, I, top, left, right, bottom, v));
  }
  if(ch === 'X') return sprite(k + 'X' + ((tx + ty) % 2), c => {
    const s = I.stone; drawBlock(c, s[0], s[1], s[2]);
    c.strokeStyle = s[1]; c.lineWidth = 0.7; c.beginPath();
    if((tx + ty) % 2){ c.moveTo(3, 5); c.lineTo(7, 7); c.lineTo(6, 11); c.moveTo(7, 7); c.lineTo(12, 6); } else { c.moveTo(9, 3); c.lineTo(10, 8); c.lineTo(13, 11); c.moveTo(4, 12); c.lineTo(8, 13); }
    c.stroke();
    if(k === 'jungle'){ c.fillStyle = 'rgba(90,190,80,.7)'; ell(c, 4, 2, 3, 1.4); c.fill(); ell(c, 12, 14, 2.4, 1.1); c.fill(); }
  });
  if(ch === '=') return sprite(k + '=', c => {
    const p = I.ledge;
    if(k === 'beach'){
      c.fillStyle = p[1]; rr(c, 0, 1, T, 7, 2); c.fill(); c.fillStyle = p[0]; rr(c, 0, 1, T, 5.5, 2); c.fill();
      c.fillStyle = p[2]; c.fillRect(0, 1.4, T, 1.1); c.strokeStyle = p[1]; c.lineWidth = 0.5; c.beginPath(); c.moveTo(2, 4); c.lineTo(7, 4); c.moveTo(9, 3.2); c.lineTo(14, 3.2); c.stroke();
    } else if(k === 'jungle'){
      c.fillStyle = p[1]; rr(c, 0, 3, T, 4.5, 2); c.fill(); c.fillStyle = p[0]; c.fillRect(0, 3.4, T, 2.4);
      c.fillStyle = p[2]; for(let i = 0; i < 3; i++){ ell(c, 3 + i * 5.3, 2.2, 3, 1.5, (i % 2 ? 0.3 : -0.3)); c.fill(); }
      c.fillStyle = '#a8f07a'; c.fillRect(1, 1.2, 3, 0.6); c.fillRect(9, 1.2, 3, 0.6);
    } else {
      c.fillStyle = p[1]; c.fillRect(0, 1, T, 7); c.fillStyle = p[0]; c.fillRect(0, 0, T, 5);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 0.4, T, 1);
      c.fillStyle = 'rgba(255,140,60,.8)'; c.fillRect(0, 7, T, 1); c.fillStyle = 'rgba(255,140,60,.35)'; c.fillRect(0, 8, T, 2);
    }
  });
  if(ch === 'c') return sprite(k + 'c', c => {
    const s = I.stone; drawBlock(c, shade(s[0], 1.1), s[1], s[2]);
    c.strokeStyle = s[1]; c.lineWidth = 0.8; c.beginPath(); c.moveTo(3, 2); c.lineTo(7, 7); c.lineTo(5, 12); c.moveTo(7, 7); c.lineTo(12, 9); c.lineTo(13, 14); c.moveTo(11, 2); c.lineTo(10, 5); c.stroke();
  });
  if(ch === 'v') return sprite(k + 'v' + (ty % 2), c => {
    c.strokeStyle = '#2f7a2a'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(8, 0); c.quadraticCurveTo(ty % 2 ? 11 : 5, 8, 8, T); c.stroke();
    c.strokeStyle = '#5fc84a'; c.lineWidth = 1; c.beginPath(); c.moveTo(7.6, 0); c.quadraticCurveTo(ty % 2 ? 10.4 : 4.6, 8, 7.6, T); c.stroke();
    c.fillStyle = '#56c84a'; ell(c, ty % 2 ? 12.5 : 3.5, 5, 3, 1.5, ty % 2 ? 0.5 : -0.5); c.fill(); ell(c, ty % 2 ? 4.5 : 11.5, 12, 2.6, 1.3, ty % 2 ? -0.5 : 0.5); c.fill();
  });
  if(ch === 'r') return sprite(k + 'r', c => {
    const s = I.stone;
    c.fillStyle = 'rgba(0,0,0,.2)'; ell(c, 8, 15, 6.5, 1.4); c.fill();
    c.fillStyle = s[1]; ell(c, 8, 12.6, 6, 3.8); c.fill();
    c.fillStyle = s[0]; ell(c, 7.6, 12, 5.2, 3.1); c.fill();
    c.fillStyle = s[2]; ell(c, 6, 10.6, 2.2, 1); c.fill();
  });
  if(isBoulder(ch)){
    const L = isBoulder(tileAt(tx - 1, ty)), R = isBoulder(tileAt(tx + 1, ty)), U = isBoulder(tileAt(tx, ty - 1)), Dn = isBoulder(tileAt(tx, ty + 1));
    return sprite(k + ch + (+L) + (+R) + (+U) + (+Dn), c => {
      const s = I.stone, rad = 6;
      c.fillStyle = shade(s[1], 0.9);
      c.beginPath();
      const tl = !L && !U ? rad : 0, tr = !R && !U ? rad : 0, br = !R && !Dn ? rad : 0, bl = !L && !Dn ? rad : 0;
      c.moveTo(tl, 0); c.lineTo(T - tr, 0); if(tr) c.arcTo(T, 0, T, tr, tr); c.lineTo(T, T - br); if(br) c.arcTo(T, T, T - br, T, br); c.lineTo(bl, T); if(bl) c.arcTo(0, T, 0, T - bl, bl); c.lineTo(0, tl); if(tl) c.arcTo(0, 0, tl, 0, tl); c.fill();
      c.fillStyle = shade(s[0], 1.05); c.save(); c.clip(); c.fillRect(L ? 0 : 1, U ? 0 : 1, T - (L ? 0 : 1) - (R ? 0 : 2), T - (U ? 0 : 1) - (Dn ? 0 : 2)); c.restore();
      if(!U){ c.fillStyle = s[2]; c.fillRect(L ? 0 : 4, 1.5, T - (L ? 0 : 4) - (R ? 0 : 4), 1.2); }
      c.strokeStyle = '#3a3028'; c.lineWidth = 0.9; c.beginPath();
      if(!L && !U){ c.moveTo(T, 6); c.lineTo(11, 8); c.lineTo(9, 13); c.lineTo(10, T); }
      else if(!R && !U){ c.moveTo(0, 6); c.lineTo(4, 9); c.lineTo(3, T); }
      else if(!L){ c.moveTo(T, 3); c.lineTo(10, 6); c.lineTo(12, 11); }
      else { c.moveTo(0, 3); c.lineTo(5, 5); c.lineTo(3, 10); }
      if(ch === 'j'){ c.moveTo(2, 2); c.lineTo(7, 7); c.lineTo(4, 14); c.moveTo(7, 7); c.lineTo(14, 9); }
      c.stroke();
    });
  }
  return null;
}
function drawTiles(c, camX, camY, s){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++){
    const y0 = Math.round((ty * T - camY) * s), y1 = Math.round(((ty + 1) * T - camY) * s);
    if(y1 < 0) continue;
    for(let tx = tx0; tx <= tx1; tx++){
      const ch = tileAt(tx, ty);
      if(ch === '.' || ch === 'F' || isFruit(ch)) continue;
      const sp = tileSprite(ch, tx, ty); if(!sp) continue;
      const x0 = Math.round((tx * T - camX) * s), x1 = Math.round(((tx + 1) * T - camX) * s);
      let dx = 0;
      if(ch === 'c' && G.crumbles.size){ const t = G.crumbles.get(ty * G.W + tx); if(t !== undefined) dx = Math.round(Math.sin(t * 70) * s); }
      c.drawImage(sp, x0 + dx, y0, x1 - x0, y1 - y0);
    }
  }
}
/* Fruit, fires and boulder glints are animated, so they are drawn fresh every frame */
function drawLive(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++) for(let tx = tx0; tx <= tx1; tx++){
    const ch = tileAt(tx, ty);
    if(isFruit(ch)) drawFruit(c, ch, tx * T + 8, ty * T + 8 + Math.sin(G.time * 3 + tx) * 1.2);
    else if(ch === 'F') drawFire(c, tx * T + 8, ty * T + T, tx);
    else if(ch === 'k' && !isBoulder(tileAt(tx - 1, ty)) && !isBoulder(tileAt(tx, ty - 1))){
      const ph = (G.time * 0.6 + tx * 0.37) % 1;
      if(ph < 0.18){ const a = Math.sin(ph / 0.18 * Math.PI); c.fillStyle = 'rgba(255,255,230,' + (a * 0.9) + ')'; star5(c, tx * T + 12, ty * T + 4, 3 * a + 0.5, 0.8); c.fill(); }
    }
  }
}
function drawFruit(c, ch, x, y){
  c.fillStyle = 'rgba(0,0,0,.12)'; ell(c, x, y + 7, 4, 1.2); c.fill();
  if(ch === 'a'){
    c.fillStyle = '#c92a2a'; circ(c, x - 1.6, y + 0.6, 4); c.fill(); circ(c, x + 1.6, y + 0.6, 4); c.fill();
    c.fillStyle = '#ff5a4e'; circ(c, x - 1.4, y + 0.2, 3.3); c.fill(); circ(c, x + 1.4, y + 0.2, 3.3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, x - 2.2, y - 1.2, 1.2, 0.8, -0.5); c.fill();
    c.fillStyle = '#6b3a1c'; c.fillRect(x - 0.4, y - 5.2, 0.9, 2.4); c.fillStyle = '#4bc452'; ell(c, x + 1.8, y - 4.4, 2, 0.9, -0.4); c.fill();
  } else if(ch === 'b'){
    c.fillStyle = '#c9a012'; c.beginPath(); c.arc(x + 1, y - 4, 8, 1.75, 3.0); c.arc(x + 3, y - 6.5, 7.4, 3.0, 1.75, true); c.fill();
    c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(x + 1, y - 4, 7.2, 1.8, 2.95); c.arc(x + 2.6, y - 6, 7, 2.95, 1.8, true); c.fill();
    c.fillStyle = '#5a3a14'; c.fillRect(x - 5.6, y - 3, 1.4, 1.4); c.fillRect(x + 1, y + 3, 1.2, 1.2);
  } else if(ch === 'g'){
    c.fillStyle = '#6a2a9c'; for(const d of [[-2.4, -1.8], [2.4, -1.8], [0, -2], [-1.2, 1.4], [1.2, 1.4], [0, 4]]){ circ(c, x + d[0], y + d[1], 2.2); c.fill(); }
    c.fillStyle = '#b45cff'; for(const d of [[-2.4, -1.8], [2.4, -1.8], [0, -2], [-1.2, 1.4], [1.2, 1.4], [0, 4]]){ circ(c, x + d[0] - 0.3, y + d[1] - 0.3, 1.6); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.7)'; for(const d of [[-2.4, -1.8], [1.2, 1.4]]){ c.fillRect(x + d[0] - 1, y + d[1] - 1, 0.8, 0.8); }
    c.fillStyle = '#4bc452'; ell(c, x + 2, y - 5, 2.2, 1, 0.4); c.fill(); c.fillStyle = '#6b3a1c'; c.fillRect(x - 0.3, y - 6, 0.8, 2.4);
  } else {
    // pineapple: the big one
    const pulse = 1 + Math.sin(G.time * 5) * 0.05;
    c.fillStyle = 'rgba(255,220,120,.25)'; circ(c, x, y, 9 * pulse); c.fill();
    c.fillStyle = '#2f9e44'; for(const a of [-0.6, -0.2, 0.2, 0.6]){ c.beginPath(); c.moveTo(x - 1.4, y - 4); c.lineTo(x + Math.sin(a) * 6, y - 11 + Math.abs(a) * 3); c.lineTo(x + 1.4, y - 4); c.fill(); }
    c.fillStyle = '#c98a12'; ell(c, x, y + 1.5, 5, 6.2); c.fill();
    c.fillStyle = '#ffc93a'; ell(c, x - 0.4, y + 1, 4.2, 5.4); c.fill();
    c.strokeStyle = '#c98a12'; c.lineWidth = 0.6; c.beginPath();
    for(let i = -2; i <= 2; i++){ c.moveTo(x - 4 + i * 2.2, y - 3); c.lineTo(x + i * 2.2 + 2, y + 6); c.moveTo(x + 4 + i * 2.2, y - 3); c.lineTo(x + i * 2.2 - 2, y + 6); }
    c.save(); ell(c, x - 0.4, y + 1, 4.2, 5.4); c.clip(); c.stroke(); c.restore();
  }
}
function drawFire(c, x, by, seed){
  c.fillStyle = '#6b3a1c'; c.save(); c.translate(x, by - 2); c.rotate(0.35); c.fillRect(-7, -1.4, 14, 2.8); c.rotate(-0.7); c.fillRect(-7, -1.4, 14, 2.8); c.restore();
  const f = G.time * 12 + seed;
  const flame = (w, h, col, off) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(x - w, by - 3);
    c.quadraticCurveTo(x - w * 0.9, by - h * 0.55, x + Math.sin(f + off) * 1.6, by - h);
    c.quadraticCurveTo(x + w * 0.9, by - h * 0.55, x + w, by - 3); c.closePath(); c.fill();
  };
  c.fillStyle = 'rgba(255,150,60,.2)'; circ(c, x, by - 7, 10 + Math.sin(f) * 0.8); c.fill();
  flame(6, 14 + Math.sin(f * 0.7) * 2, '#ff5a2a', 0); flame(4.4, 11 + Math.sin(f * 0.9 + 1) * 1.6, '#ffa62a', 1); flame(2.6, 7 + Math.sin(f * 1.3) * 1.2, '#fff1a0', 2);
}
function drawPits(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T), kind = G.island.pit;
  const top = 12 * T + 6;
  const cols = kind === 'lava' ? ['#ff5a1f', '#ffb347', '#b8260e'] : kind === 'river' ? ['#2f9fb8', '#8fe8ff', '#1d6a86'] : ['#2f8fe0', '#bff0ff', '#1f5fb0'];
  for(let tx = tx0; tx <= tx1; tx++){
    if(!pitAt(tx)) continue;
    const x = tx * T;
    const g = c.createLinearGradient(0, top, 0, LH);
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[2]);
    c.fillStyle = g; c.beginPath(); c.moveTo(x, LH);
    for(let i = 0; i <= 4; i++){ const px = x + i * 4; c.lineTo(px, top + Math.sin(G.time * 3 + px * 0.25) * 1.3); }
    c.lineTo(x + T, LH); c.fill();
    c.fillStyle = cols[1]; c.globalAlpha = 0.7;
    for(let i = 0; i < 2; i++){ const px = x + ((G.time * (kind === 'river' ? 30 : 8) + i * 8 + tx * 5) % T); c.fillRect(px, top + 1 + Math.sin(G.time * 3 + px * 0.25) * 1.3, 3, 0.8); }
    if(kind === 'lava' && rng(tx + Math.floor(G.time * 2)) < 0.25){ circ(c, x + 8 + Math.sin(G.time * 5 + tx) * 4, top + 4, 1.2 + (G.time * 3 % 1)); c.fill(); }
    c.globalAlpha = 1;
    if(D().pitBounce){
      const y = LH - 7 + Math.sin(G.time * 4 + tx) * 0.8;
      c.fillStyle = '#ffffff'; c.fillRect(x, y, T, 2.2);
      c.fillStyle = '#ff5a6e'; c.fillRect(x + 4, y, 4, 2.2); c.fillRect(x + 12, y, 4, 2.2);
      if(tx % 3 === 0){ c.fillStyle = '#ffd45e'; circ(c, x + 8, y + 1, 2.4); c.fill(); c.fillStyle = '#ff5a6e'; c.fillRect(x + 7.4, y - 1.4, 1.2, 4.8); }
    }
  }
}

/* ---------- Backgrounds: far, middle and near layers scroll at different speeds ---------- */
const wrap = (v, span) => ((v % span) + span) % span;
function cloud(c, x, y, s, col){ c.fillStyle = col; circ(c, x, y, 9 * s); c.fill(); circ(c, x + 10 * s, y - 4 * s, 11 * s); c.fill(); circ(c, x + 22 * s, y, 9 * s); c.fill(); rr(c, x - 4 * s, y - 2 * s, 30 * s, 10 * s, 5 * s); c.fill(); }
function hills(c, off, base, amp, col, freq, seed){
  c.fillStyle = col; c.beginPath(); c.moveTo(0, VH);
  for(let sx = 0; sx <= VW + 6; sx += 6){ const w = sx + off; c.lineTo(sx, base - (Math.sin(w * freq + seed) * 0.55 + Math.sin(w * freq * 2.3 + seed * 2) * 0.3 + 1) * amp); }
  c.lineTo(VW, VH); c.fill();
}
function hillY(off, base, amp, freq, seed, sx){ const w = sx + off; return base - (Math.sin(w * freq + seed) * 0.55 + Math.sin(w * freq * 2.3 + seed * 2) * 0.3 + 1) * amp; }
function palm(c, x, by, h, lean, col, leaf, sway){
  c.strokeStyle = col; c.lineWidth = Math.max(1.5, h * 0.07); c.lineCap = 'round';
  const tx = x + lean, ty = by - h;
  c.beginPath(); c.moveTo(x, by); c.quadraticCurveTo(x + lean * 0.2, by - h * 0.6, tx, ty); c.stroke();
  c.strokeStyle = leaf; c.lineWidth = Math.max(1.5, h * 0.09);
  for(let i = 0; i < 6; i++){
    const a = -Math.PI / 2 + (i - 2.5) * 0.62 + Math.sin(G.time * 1.3 + x * 0.05) * 0.05 * sway, L = h * 0.42;
    c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * L * 0.6, ty + Math.sin(a) * L * 0.6 - L * 0.15, tx + Math.cos(a) * L, ty + Math.sin(a) * L + L * 0.35); c.stroke();
  }
  c.lineCap = 'butt';
}
function drawBG(c, camX){
  const I = G.island, k = I.key;
  const g = c.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, I.sky[0]); g.addColorStop(1, I.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  if(k === 'beach'){
    const sx = 300 - camX * 0.02 % 60;
    c.fillStyle = 'rgba(255,250,200,.25)'; circ(c, sx, 44, 30); c.fill();
    c.fillStyle = 'rgba(255,245,190,.45)'; circ(c, sx, 44, 20); c.fill(); c.fillStyle = '#fff6c8'; circ(c, sx, 44, 13); c.fill();
    for(let i = 0; i < 6; i++){ const x = wrap(i * 91 - camX * 0.05 - G.time * 4, VW + 120) - 60; cloud(c, x, 24 + (i * 31) % 44, 0.5 + (i % 3) * 0.2, 'rgba(255,255,255,.9)'); }
    // far: the open sea and little islands
    const o1 = camX * 0.08;
    const sea = c.createLinearGradient(0, 118, 0, VH); sea.addColorStop(0, '#2fa6e8'); sea.addColorStop(1, '#1b6fc0');
    c.fillStyle = sea; c.fillRect(0, 118, VW, VH - 118);
    c.fillStyle = 'rgba(255,255,255,.45)';
    for(let i = 0; i < 18; i++){ const x = wrap(rng(i) * 700 - o1 * 1.5 + G.time * 6 * (i % 2 ? 1 : -1), VW + 40) - 20, y = 124 + rng(i + 3) * 70; c.fillRect(x, y, 6 + rng(i + 7) * 10, 0.8); }
    for(let kx = Math.floor((o1 - 100) / 260); kx <= Math.floor((o1 + VW + 100) / 260); kx++){
      const x = kx * 260 + 60 + rng(kx) * 80 - o1;
      c.fillStyle = '#3c9a86'; c.beginPath(); c.ellipse(x, 120, 34 + rng(kx + 2) * 20, 9, 0, Math.PI, 0); c.fill();
      palm(c, x + 6, 114, 16, 4, '#2d6f60', '#2d6f60', 0);
    }
    // middle: dunes with palms
    const o2 = camX * 0.3;
    hills(c, o2, 184, 14, '#f3d68f', 0.018, 1);
    for(let kx = Math.floor(o2 / 90) - 1; kx <= Math.floor((o2 + VW) / 90) + 1; kx++){
      if(rng(kx + 11) < 0.35) continue;
      const x = kx * 90 + rng(kx) * 40 - o2, by = hillY(o2, 184, 14, 0.018, 1, x) + 2;
      palm(c, x, by, 40 + rng(kx + 4) * 16, (rng(kx + 5) - 0.3) * 18, '#9a6a3c', '#2f9e44', 1);
    }
    // near: grass tufts on the sand
    const o3 = camX * 0.55;
    hills(c, o3, 206, 8, '#ecc77e', 0.03, 4);
    for(let kx = Math.floor(o3 / 38) - 1; kx <= Math.floor((o3 + VW) / 38) + 1; kx++){
      const x = kx * 38 + rng(kx + 20) * 20 - o3, by = hillY(o3, 206, 8, 0.03, 4, x) + 2;
      c.strokeStyle = '#6aa84a'; c.lineWidth = 1; c.beginPath();
      for(let b = -2; b <= 2; b++){ c.moveTo(x + b * 1.5, by); c.lineTo(x + b * 3 + Math.sin(G.time * 2 + kx) * 0.6, by - 6 - Math.abs(2 - Math.abs(b)) * 2); }
      c.stroke();
    }
  } else if(k === 'jungle'){
    for(let i = 0; i < 5; i++){
      const x = wrap(i * 110 - camX * 0.04, VW + 100) - 50;
      c.fillStyle = 'rgba(255,255,210,.07)'; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 26, 0); c.lineTo(x + 70, VH); c.lineTo(x + 34, VH); c.fill();
    }
    // far: misty peaks with a waterfall
    const o1 = camX * 0.08;
    c.fillStyle = '#4f9a86';
    for(let kx = Math.floor(o1 / 120) - 1; kx <= Math.floor((o1 + VW) / 120) + 1; kx++){
      const x = kx * 120 - o1, h = 70 + rng(kx) * 40;
      c.beginPath(); c.moveTo(x - 70, 170); c.quadraticCurveTo(x - 20, 170 - h, x, 170 - h); c.quadraticCurveTo(x + 20, 170 - h, x + 70, 170); c.fill();
      if(rng(kx + 9) < 0.4){
        c.fillStyle = 'rgba(220,250,255,.75)'; c.fillRect(x - 3, 170 - h + 12, 6, h - 12);
        c.fillStyle = 'rgba(255,255,255,.6)'; for(let j = 0; j < 4; j++){ const yy = 170 - h + 12 + ((G.time * 40 + j * 12) % (h - 12)); c.fillRect(x - 2, yy, 1.2, 4); }
        c.fillStyle = '#4f9a86';
      }
    }
    c.fillStyle = 'rgba(200,255,220,.25)'; c.fillRect(0, 140, VW, 40);
    // middle: jungle canopy
    const o2 = camX * 0.26;
    for(let kx = Math.floor(o2 / 44) - 1; kx <= Math.floor((o2 + VW) / 44) + 1; kx++){
      const x = kx * 44 + rng(kx) * 20 - o2, h = 50 + rng(kx + 3) * 40;
      c.fillStyle = '#2d5a3a'; c.fillRect(x - 2, VH - h, 4, h);
      c.fillStyle = '#2f7a4a'; circ(c, x, VH - h, 18 + rng(kx + 1) * 8); c.fill();
      c.fillStyle = '#3f9a55'; circ(c, x - 6, VH - h - 4, 10); c.fill();
    }
    // near: hanging vines and big leaves
    const o3 = camX * 0.5;
    for(let kx = Math.floor(o3 / 60) - 1; kx <= Math.floor((o3 + VW) / 60) + 1; kx++){
      const x = kx * 60 + rng(kx + 30) * 30 - o3, len = 20 + rng(kx + 31) * 40, sw = Math.sin(G.time * 1.2 + kx) * 2;
      c.strokeStyle = '#1f5a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + sw, len * 0.6, x + sw * 1.5, len); c.stroke();
      c.fillStyle = '#2f8f3a'; ell(c, x + sw * 1.5 + 2, len, 3, 1.5, 0.5); c.fill();
      const by = 200 + rng(kx + 40) * 10;
      c.fillStyle = '#1f6a34'; for(let j = -1; j <= 1; j++){ ell(c, x + 20 + j * 6, by, 7, 2.6, j * 0.7 - Math.PI / 2 * 0.3); c.fill(); }
    }
    for(let i = 0; i < 12; i++){ const x = wrap(rng(i) * VW - camX * 0.6 + Math.sin(G.time + i) * 8, VW), y = 90 + rng(i + 4) * 90 + Math.sin(G.time * 1.5 + i) * 6; c.fillStyle = 'rgba(230,255,140,' + (0.4 + 0.4 * Math.sin(G.time * 4 + i)) + ')'; circ(c, x, y, 1); c.fill(); }
  } else {
    // far: the big volcano with a glowing crater and smoke
    const o1 = camX * 0.05, vx = 230 - o1 % 400;
    c.fillStyle = 'rgba(255,120,60,.25)'; circ(c, vx, 70, 60); c.fill();
    c.fillStyle = '#4a2438'; c.beginPath(); c.moveTo(vx - 170, VH); c.lineTo(vx - 30, 70); c.lineTo(vx + 30, 70); c.lineTo(vx + 170, VH); c.fill();
    c.fillStyle = '#ff7a3a'; c.beginPath(); c.moveTo(vx - 30, 70); c.lineTo(vx + 30, 70); c.lineTo(vx + 22, 76); c.lineTo(vx - 22, 76); c.fill();
    c.strokeStyle = 'rgba(255,110,50,.7)'; c.lineWidth = 2; c.beginPath(); c.moveTo(vx - 8, 76); c.quadraticCurveTo(vx - 20, 110, vx - 40, 150); c.moveTo(vx + 12, 76); c.quadraticCurveTo(vx + 26, 120, vx + 30, 170); c.stroke();
    for(let i = 0; i < 6; i++){ const t = (G.time * 0.15 + i / 6) % 1; c.fillStyle = 'rgba(80,60,80,' + (0.5 * (1 - t)) + ')'; circ(c, vx + Math.sin(t * 5 + i) * 10 + t * 30, 64 - t * 60, 8 + t * 16); c.fill(); }
    // middle: jagged rock spires
    const o2 = camX * 0.25;
    for(let kx = Math.floor(o2 / 50) - 1; kx <= Math.floor((o2 + VW) / 50) + 1; kx++){
      const x = kx * 50 + rng(kx) * 20 - o2, h = 40 + rng(kx + 2) * 50;
      c.fillStyle = '#2e1a2e'; c.beginPath(); c.moveTo(x - 18, VH); c.lineTo(x - 4, VH - h); c.lineTo(x + 3, VH - h + 8); c.lineTo(x + 18, VH); c.fill();
      if(rng(kx + 5) < 0.4){ c.strokeStyle = 'rgba(255,120,50,' + (0.5 + 0.3 * Math.sin(G.time * 2 + kx)) + ')'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 2, VH - h + 10); c.lineTo(x + 2, VH - h * 0.5); c.lineTo(x - 1, VH); c.stroke(); }
    }
    // near: glowing horizon and rising embers
    const gl = c.createLinearGradient(0, 170, 0, VH); gl.addColorStop(0, 'rgba(255,90,30,0)'); gl.addColorStop(1, 'rgba(255,90,30,.45)'); c.fillStyle = gl; c.fillRect(0, 170, VW, VH - 170);
    const o3 = camX * 0.5;
    hills(c, o3, 210, 10, '#1d1220', 0.035, 3);
    for(let i = 0; i < 22; i++){ const x = wrap(rng(i) * VW - camX * 0.4 + Math.sin(G.time + i) * 6, VW), y = wrap(VH - G.time * (14 + rng(i) * 16) - rng(i + 3) * VH, VH); c.fillStyle = 'rgba(255,' + (140 + (i % 3) * 30) + ',60,' + (0.5 + 0.4 * Math.sin(G.time * 5 + i)) + ')'; c.fillRect(x, y, 1.2, 1.2); }
  }
}
/* Foreground: a few leaves and rocks sweep past in front, faster than the ground (kept low so they never hide the action) */
function drawFG(c, camX){
  const k = G.island.key, o = camX * 1.3;
  for(let kx = Math.floor(o / 170) - 1; kx <= Math.floor((o + VW) / 170) + 1; kx++){
    if(rng(kx + 70) < 0.45) continue;
    const x = kx * 170 + rng(kx + 71) * 80 - o;
    if(k === 'beach'){
      c.fillStyle = 'rgba(40,110,60,.85)';
      for(let j = 0; j < 5; j++){ const a = -Math.PI / 2 + (j - 2) * 0.45 + Math.sin(G.time * 1.5 + kx) * 0.04; ell(c, x + Math.cos(a) * 12, VH + 2 + Math.sin(a) * 12, 12, 2.6, a); c.fill(); }
    } else if(k === 'jungle'){
      c.fillStyle = 'rgba(20,70,35,.9)';
      for(let j = 0; j < 6; j++){ const a = -Math.PI / 2 + (j - 2.5) * 0.4 + Math.sin(G.time * 1.2 + kx) * 0.05; ell(c, x + Math.cos(a) * 14, VH + 4 + Math.sin(a) * 14, 14, 3, a); c.fill(); }
    } else {
      c.fillStyle = 'rgba(20,10,22,.92)'; c.beginPath(); c.moveTo(x - 26, VH); c.lineTo(x - 12, VH - 12); c.lineTo(x + 4, VH - 9); c.lineTo(x + 20, VH - 14); c.lineTo(x + 30, VH); c.fill();
      c.fillStyle = 'rgba(255,110,40,.6)'; c.fillRect(x - 4, VH - 7, 8, 0.8);
    }
  }
}

/* ---------- Islanders ---------- */
const SKIN = '#c98b5e', SKIN_DK = '#9c6440', HAIR = '#2b1a14';
function drawAxe(c, x, y, rot, s){
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s || 1, s || 1);
  c.fillStyle = '#7a4a24'; rr(c, -0.8, -5, 1.8, 10, 0.8); c.fill();
  c.fillStyle = '#e9d9b0'; c.fillRect(-1.2, -3.4, 2.6, 1.2);
  c.fillStyle = '#6d7680'; c.beginPath(); c.moveTo(0.6, -5.6); c.quadraticCurveTo(6.4, -6, 6, -1.2); c.quadraticCurveTo(3.4, -2.2, 0.6, -2.2); c.fill();
  c.fillStyle = '#b4bec8'; c.beginPath(); c.moveTo(1.4, -5); c.quadraticCurveTo(5, -5.2, 5.2, -2.8); c.lineTo(1.4, -3.4); c.fill();
  c.restore();
}
function drawHero(c, p){
  if(p.inv > 0 && !p.bubble && !p.done && Math.floor(G.time * 20) % 2) return;
  const cx = p.x + p.w / 2, fy = p.y + p.h;
  const charmOn = p.charm > 0 && (p.charm > 2 || Math.floor(G.time * 10) % 2);
  if(charmOn){ c.fillStyle = hue(G.time * 400 + p.slot * 90, 95, 65); c.globalAlpha = 0.35; ell(c, cx, fy - 11, 11, 14); c.fill(); c.globalAlpha = 1; }
  c.save(); c.translate(cx, fy);
  let sy = 1;
  if(p.squashT > 0) sy = 1 - p.squashT * 1.1;
  if(p.dead > 0) c.rotate(Math.sin(p.dead * 18) * 0.25);
  if(p.tripT > 0) c.rotate(p.face * 0.4);
  c.scale((p.face < 0 ? -1 : 1) * (2 - sy), sy);
  const moving = Math.abs(p.vx) > 6, air = !p.onGround && !(p.dead > 0) && !p.climb;
  const ph = p.x * 0.3, step = !air && moving && !p.board && !p.climb ? Math.sin(ph) : 0;
  const base = p.board ? -4 : 0, bob = !air && moving && !p.board ? Math.abs(Math.cos(ph)) * 0.8 : 0;
  const hungry = p.energy < 25 && !(p.dead > 0) && !p.done;
  // skateboard
  if(p.board){
    c.fillStyle = '#2b2440'; circ(c, -5, -1.5, 1.6); c.fill(); circ(c, 5, -1.5, 1.6); c.fill();
    c.fillStyle = '#c0763a'; rr(c, -8.5, -4.6, 17, 2.6, 1.3); c.fill();
    c.fillStyle = p.color; c.fillRect(-5, -4.2, 10, 0.9);
    if(moving && Math.floor(G.time * 12) % 2){ c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-13, -3, 3, 0.7); c.fillRect(-15, -1.5, 4, 0.7); }
  }
  const legY = base - bob;
  c.fillStyle = SKIN;
  if(p.climb){ const cl = Math.sin(p.y * 0.5) * 1.5; rr(c, -3.4, legY - 6 + cl, 2.6, 5.5, 1.2); c.fill(); rr(c, 0.8, legY - 6 - cl, 2.6, 5.5, 1.2); c.fill(); }
  else if(air){ rr(c, -3.8, legY - 7, 2.6, 4.6, 1.2); c.fill(); rr(c, 1, legY - 5.6, 2.6, 4.6, 1.2); c.fill(); }
  else if(p.board){ rr(c, -4.4, legY - 6, 2.6, 6, 1.2); c.fill(); rr(c, 1.8, legY - 6, 2.6, 6, 1.2); c.fill(); }
  else { rr(c, -3.2 + step * 1.8, legY - 6, 2.6, 6, 1.2); c.fill(); rr(c, 0.6 - step * 1.8, legY - 6, 2.6, 6, 1.2); c.fill(); }
  c.fillStyle = SKIN_DK;
  if(!air && !p.climb){ ell(c, -1.8 + (p.board ? -1.2 : step * 1.8), legY - 0.6, 2, 0.9); c.fill(); ell(c, 2 + (p.board ? 1.2 : -step * 1.8), legY - 0.6, 2, 0.9); c.fill(); }
  // shorts and grass skirt
  const wy = legY - 9.5;
  c.fillStyle = p.color; rr(c, -4, wy, 8, 3.6, 1); c.fill();
  c.fillStyle = '#4fb043';
  for(let i = 0; i < 6; i++){ const sx = -4.6 + i * 1.8, sw = Math.sin(G.time * 10 + i) * (moving || air ? 0.8 : 0.2); c.beginPath(); c.moveTo(sx, wy + 0.5); c.lineTo(sx + 1.8, wy + 0.5); c.lineTo(sx + 0.9 + sw, wy + 5.4); c.fill(); }
  c.fillStyle = '#7ad35e'; for(let i = 0; i < 3; i++){ c.fillRect(-3.6 + i * 3.4, wy + 0.8, 0.6, 3.2); }
  c.fillStyle = '#e9c46a'; c.fillRect(-4.4, wy, 8.8, 1.1);
  // body
  const ty = wy - 6.2;
  c.fillStyle = SKIN; rr(c, -3.6, ty, 7.2, 7, 2.6); c.fill();
  c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-2.4, ty + 1.2, 1, 4.2);
  c.fillStyle = '#fffaf0'; for(let i = 0; i < 4; i++){ circ(c, -2.2 + i * 1.5, ty + 1.8 + (i === 1 || i === 2 ? 0.7 : 0), 0.7); c.fill(); }
  c.fillStyle = p.color; circ(c, 0.1, ty + 2.8, 0.8); c.fill();
  // arms (and the axe when throwing)
  c.fillStyle = SKIN;
  if(p.climb){ const cl = Math.sin(p.y * 0.5) * 2; rr(c, -4.6, ty - 5 - cl, 2, 7, 1); c.fill(); rr(c, 2.6, ty - 5 + cl, 2, 7, 1); c.fill(); }
  else if(p.throwT > 0){ const k2 = p.throwT / 0.2; rr(c, 1.6, ty + 0.6, 6, 2, 1); c.fill(); if(k2 > 0.5) drawAxe(c, 7.4, ty - 1, -1.2 + (1 - k2) * 3, 0.8); }
  else if(air){ rr(c, 2.4, ty - 3.4, 2, 5, 1); c.fill(); rr(c, -4.2, ty - 2.6, 2, 5, 1); c.fill(); }
  else if(p.done === 2){ const w2 = Math.sin(G.time * 12 + p.slot) * 1.4; rr(c, 2.4, ty - 4 + w2, 2, 5, 1); c.fill(); rr(c, -4.4, ty - 4 - w2, 2, 5, 1); c.fill(); }
  else { rr(c, 2.4 - step, ty + 0.8, 2, 5.4, 1); c.fill(); }
  // head
  const hy = ty - 4.8;
  c.fillStyle = HAIR; circ(c, -0.6, hy - 0.6, 5.4); c.fill();
  c.fillStyle = SKIN; circ(c, 0.7, hy + 0.5, 4.6); c.fill();
  c.fillStyle = HAIR; c.beginPath(); c.arc(-0.4, hy - 0.4, 5.3, Math.PI * 0.95, Math.PI * 1.85); c.lineTo(3.2, hy - 1.2); c.lineTo(-1, hy - 1.6); c.lineTo(-4.4, hy + 1.8); c.closePath(); c.fill();
  // topknot and headband with a leaf
  const bounce = (air ? -0.8 : 0) + Math.sin(G.time * 6 + p.slot) * 0.3;
  c.fillStyle = HAIR; circ(c, -1.6, hy - 6 + bounce, 2.3); c.fill();
  c.fillStyle = p.color; c.fillRect(-5.2, hy - 3.2, 9.2, 1.6);
  c.fillStyle = shade(p.color, 1.25); c.fillRect(-5.2, hy - 3.2, 9.2, 0.5);
  c.fillStyle = '#4fb043'; ell(c, -5.6, hy - 5 + bounce, 1.3, 3.4, -0.5); c.fill();
  c.fillStyle = '#ff7eb6'; for(let i = 0; i < 5; i++){ const a = i * 1.26; circ(c, -4.6 + Math.cos(a) * 1.3, hy - 2.4 + Math.sin(a) * 1.3, 0.9); c.fill(); }
  c.fillStyle = '#ffe14a'; circ(c, -4.6, hy - 2.4, 0.6); c.fill();
  // face
  if(p.dead > 0){
    c.strokeStyle = '#231c35'; c.lineWidth = 0.8; c.beginPath();
    for(const ex of [1.6, 4.2]){ c.moveTo(ex - 0.8, hy - 0.9); c.lineTo(ex + 0.8, hy + 0.7); c.moveTo(ex + 0.8, hy - 0.9); c.lineTo(ex - 0.8, hy + 0.7); }
    c.stroke();
  } else {
    const blink = Math.floor(G.time * 10 + p.slot * 13) % 41 === 0;
    c.fillStyle = '#231c35';
    if(blink || hungry){ c.fillRect(1, hy - 0.1 + (hungry ? 0.5 : 0), 1.5, 0.6); c.fillRect(3.5, hy - 0.1 + (hungry ? 0.5 : 0), 1.5, 0.6); }
    else { rr(c, 1.2, hy - 1.2, 1.4, 2.4, 0.7); c.fill(); rr(c, 3.6, hy - 1.2, 1.4, 2.4, 0.7); c.fill(); c.fillStyle = '#fff'; c.fillRect(1.45, hy - 0.95, 0.6, 0.6); c.fillRect(3.85, hy - 0.95, 0.6, 0.6); }
    c.fillStyle = 'rgba(255,110,110,.45)'; circ(c, 0.8, hy + 2, 0.9); c.fill(); circ(c, 5, hy + 2, 0.7); c.fill();
    c.strokeStyle = '#6a3222'; c.lineWidth = 0.55; c.beginPath();
    if(hungry) { c.moveTo(2.4, hy + 3); c.lineTo(4.2, hy + 2.6); }
    else if(air || p.done) c.arc(3.2, hy + 2, 1.1, 0.1, Math.PI - 0.1);
    else c.arc(3.2, hy + 1.8, 0.9, 0.2, Math.PI - 0.2);
    c.stroke();
    if(hungry && Math.floor(G.time * 3) % 2){ c.fillStyle = '#9fdcff'; c.beginPath(); c.moveTo(-3.6, hy - 1); c.quadraticCurveTo(-2.4, hy + 1.2, -3.6, hy + 1.6); c.quadraticCurveTo(-4.8, hy + 1.2, -3.6, hy - 1); c.fill(); }
  }
  c.restore();
  if(charmOn && Math.random() < 0.3 && G.state !== 'paused') spawnFx('sparkle', cx, p.y + p.h / 2, hue(G.time * 500));
}
function drawBubble(c, p){
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = 14 + Math.sin(G.time * 4 + p.slot) * 0.9;
  c.save(); c.translate(cx, cy); c.scale(0.7, 0.7); c.translate(-cx, -cy - 3);
  drawHero(c, Object.assign({}, p, { inv: 0, onGround: true, vx: 0, charm: 0, squashT: 0, dead: 0, tripT: 0, board: false, climb: false, throwT: 0 }));
  c.restore();
  c.fillStyle = 'rgba(190,230,255,.2)'; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = p.away ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)'; c.lineWidth = 1; circ(c, cx, cy, r); c.stroke();
  c.strokeStyle = p.color; c.globalAlpha = 0.6; c.lineWidth = 0.6; circ(c, cx, cy, r - 1.2); c.stroke(); c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.85)'; ell(c, cx - r * 0.45, cy - r * 0.5, 3, 1.6, -0.7); c.fill();
  if(p.away) outlined(c, 'AWAY', cx, cy + r + 5, 4, '#bbb');
}

/* ---------- Critters, hazards and items ---------- */
function eyes(c, x, y, face, angry, sp){
  sp = sp || 3.4;
  c.fillStyle = '#fff'; ell(c, x, y, 1.6, 2); c.fill(); ell(c, x + sp, y, 1.6, 2); c.fill();
  c.fillStyle = '#1d1630'; circ(c, x + face * 0.6, y + 0.3, 0.9); c.fill(); circ(c, x + sp + face * 0.6, y + 0.3, 0.9); c.fill();
  if(angry){ c.strokeStyle = '#1d1630'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 1.6, y - 2.6); c.lineTo(x + 1.2, y - 1.8); c.moveTo(x + sp + 1.6, y - 2.6); c.lineTo(x + sp - 1.2, y - 1.8); c.stroke(); }
}
function drawFoe(c, e){
  const I = G.island, x = e.x, y = e.y, w = e.w, h = e.h;
  c.save();
  if(e.st === 'flip'){ c.translate(x + w / 2, y + h / 2); c.scale(1, -1); c.translate(-(x + w / 2), -(y + h / 2)); }
  if(e.k === 'snail'){
    const s = I.snail;
    if(e.st === 'flat'){ c.fillStyle = s[1]; ell(c, x + 7, y + h - 1.5, 7, 1.8); c.fill(); c.restore(); return; }
    const f = e.face, stretch = Math.sin(G.time * 6 + e.id) * 0.8;
    c.fillStyle = '#d8e88a'; rr(c, x + (f > 0 ? 1 : 0) - stretch * 0.5, y + h - 3.6, w + stretch, 3.6, 1.8); c.fill();
    const hx = f > 0 ? x + w - 2 : x + 2;
    c.fillStyle = '#d8e88a'; rr(c, hx - 2, y + h - 8, 4, 6, 2); c.fill();
    c.strokeStyle = '#b8c86a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(hx - 0.5, y + h - 7.5); c.lineTo(hx - 1.2 + f, y + h - 12); c.moveTo(hx + 0.5, y + h - 7.5); c.lineTo(hx + 1.4 + f, y + h - 11.4); c.stroke();
    c.fillStyle = '#1d1630'; circ(c, hx - 1.2 + f, y + h - 12, 0.9); c.fill(); circ(c, hx + 1.4 + f, y + h - 11.4, 0.9); c.fill();
    const sx = x + w / 2 - f * 1.5, sy2 = y + 5;
    c.fillStyle = s[1]; circ(c, sx, sy2, 5.6); c.fill();
    c.fillStyle = s[0]; circ(c, sx - 0.3, sy2 - 0.3, 4.8); c.fill();
    c.strokeStyle = s[1]; c.lineWidth = 0.9; c.beginPath();
    for(let a = 0; a < 9; a += 0.4){ const r = 0.4 + a * 0.45; c.lineTo(sx + Math.cos(a - f * G.time * 0) * r * f, sy2 + Math.sin(a) * r); }
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,.45)'; ell(c, sx - 2, sy2 - 2.6, 1.6, 0.8, -0.4); c.fill();
  } else if(e.k === 'bee'){
    const fl = Math.sin(G.time * 44 + e.id), aim = e.st === 'aim' || e.st === 'dive';
    c.fillStyle = 'rgba(255,255,255,.75)'; ell(c, x + 4, y + 0.5 - fl, 3, 2 + fl, -0.4); c.fill(); ell(c, x + 8, y + 0.2 - fl, 3, 2 + fl, 0.4); c.fill();
    c.fillStyle = '#ffcf3f'; ell(c, x + 6, y + 6, 6, 4.4); c.fill();
    c.fillStyle = '#2b2440'; c.fillRect(x + 4, y + 2, 1.6, 8); c.fillRect(x + 7.4, y + 2, 1.6, 8);
    c.fillStyle = '#2b2440'; c.beginPath(); const tx = e.face > 0 ? x : x + 12; c.moveTo(tx, y + 5); c.lineTo(tx - e.face * 3.4, y + 6.5); c.lineTo(tx, y + 8); c.fill();
    eyes(c, e.face > 0 ? x + 8.6 : x + 1.6, y + 5, e.face, aim, 2.2);
  } else if(e.k === 'frog'){
    const fr = I.frog;
    if(e.st === 'flat'){ c.fillStyle = fr[1]; ell(c, x + 7, y + h - 2, 8, 2.4); c.fill(); c.restore(); return; }
    const jumping = !e.onGround && e.t < 0.9;
    c.fillStyle = fr[1];
    if(jumping){ ell(c, x + 2, y + h + 1, 1.6, 3.8, 0.5); c.fill(); ell(c, x + 12, y + h + 1, 1.6, 3.8, -0.5); c.fill(); }
    else { ell(c, x + 2.6, y + h - 1.2, 3.2, 1.6); c.fill(); ell(c, x + 11.4, y + h - 1.2, 3.2, 1.6); c.fill(); }
    const puff = e.onGround ? 1 + Math.max(0, Math.sin(e.t * 9)) * 0.08 : 1;
    c.fillStyle = fr[0]; ell(c, x + 7, y + 7.8, 7 * puff, 4.6); c.fill();
    c.fillStyle = '#fff7d6'; ell(c, x + 7, y + 9.6, 4.4, 2.2); c.fill();
    c.fillStyle = fr[1]; circ(c, x + 4, y + 7, 0.9); c.fill(); circ(c, x + 10.5, y + 6.5, 0.8); c.fill();
    c.fillStyle = fr[0]; circ(c, x + 3.6, y + 3.2, 2.8); c.fill(); circ(c, x + 10.4, y + 3.2, 2.8); c.fill();
    c.fillStyle = '#ffe14a'; circ(c, x + 3.6, y + 3, 1.9); c.fill(); circ(c, x + 10.4, y + 3, 1.9); c.fill();
    c.fillStyle = '#1d1630'; c.fillRect(x + 3.6 + e.face * 0.5 - 1, y + 2.6, 2, 0.9); c.fillRect(x + 10.4 + e.face * 0.5 - 1, y + 2.6, 2, 0.9);
    c.strokeStyle = '#1d1630'; c.lineWidth = 0.6; c.beginPath(); c.arc(x + 7, y + 6.6, 3, 0.35, Math.PI - 0.35); c.stroke();
  }
  c.restore();
}
function drawRock(c, x, y, r, rot, col){
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = shade(col[1], 0.85); circ(c, 0, 0, r); c.fill();
  c.fillStyle = col[0]; circ(c, -0.6, -0.6, r - 1.2); c.fill();
  c.strokeStyle = col[1]; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-r * 0.6, -r * 0.2); c.lineTo(0, 0.4); c.lineTo(r * 0.3, r * 0.7); c.moveTo(0, 0.4); c.lineTo(r * 0.6, -r * 0.3); c.stroke();
  c.fillStyle = col[2]; ell(c, -r * 0.4, -r * 0.45, r * 0.3, r * 0.18, -0.5); c.fill();
  c.restore();
}
function drawHazard(c, e){
  const x = e.x, y = e.y;
  if(e.k === 'rock'){
    c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, x + 7, groundY(x + 7) - 0.5, 7, 1.6); c.fill();
    drawRock(c, x + 7, y + 7, 7, -x / 7, G.island.stone);
    if(Math.floor(G.time * 10) % 3 === 0 && e.onGround !== false){ c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 14, y + 12, 2, 1); }
  } else if(e.k === 'ember'){
    if(e.st === 'wait') return;
    const f = Math.sin(G.time * 20 + e.id);
    c.fillStyle = 'rgba(255,160,60,.35)'; circ(c, x + 4.5, y + 4.5, 7); c.fill();
    c.fillStyle = '#ff5a1f'; c.beginPath(); c.moveTo(x, y + 5); c.quadraticCurveTo(x + 4.5, y - 6 - f * 2 + (e.vy > 0 ? 10 : 0), x + 9, y + 5); c.arc(x + 4.5, y + 5, 4.5, 0, Math.PI); c.fill();
    c.fillStyle = '#ffd24a'; circ(c, x + 4.5, y + 5.4, 3); c.fill();
    c.fillStyle = '#5a1a0a'; c.fillRect(x + 2.6, y + 4.4, 1, 1.4); c.fillRect(x + 5.4, y + 4.4, 1, 1.4);
  } else if(e.k === 'coconut'){
    c.save(); c.translate(x + 4.5, y + 4.5); c.rotate(e.t * 8);
    c.fillStyle = '#5a3418'; circ(c, 0, 0, 4.6); c.fill(); c.fillStyle = '#7a4b2a'; circ(c, -0.5, -0.5, 3.8); c.fill();
    c.fillStyle = '#2b1a0c'; circ(c, -1.2, -1, 0.7); c.fill(); circ(c, 1.2, -1, 0.7); c.fill(); circ(c, 0, 1.2, 0.7); c.fill();
    c.restore();
  } else if(e.k === 'fireball'){
    const f = Math.sin(G.time * 24 + e.id);
    c.fillStyle = 'rgba(255,150,50,.35)'; circ(c, x + 5, y + 4.5, 8); c.fill();
    c.fillStyle = '#ff5a1f'; c.beginPath(); c.moveTo(x + 5 - e.face * 12, y + 4.5 + f); c.lineTo(x + 5, y); c.lineTo(x + 5, y + 9); c.fill();
    c.fillStyle = '#ff8a2a'; circ(c, x + 5, y + 4.5, 4.6); c.fill(); c.fillStyle = '#fff1a0'; circ(c, x + 5 + e.face, y + 4, 2.4); c.fill();
  } else if(e.k === 'fallrock'){
    if(e.st === 'warn'){
      const a = Math.min(1, e.t / 0.9);
      c.fillStyle = 'rgba(0,0,0,' + (0.15 + a * 0.3) + ')'; ell(c, x + 7, 12 * T - 1, 4 + a * 6, 1.6); c.fill();
      if(Math.floor(G.time * 12) % 2){ c.fillStyle = 'rgba(255,200,120,.6)'; c.beginPath(); c.moveTo(x + 7, 26); c.lineTo(x + 4, 20); c.lineTo(x + 10, 20); c.fill(); }
    } else drawRock(c, x + 7, y + 7, 7, e.t * 6, G.island.stone);
  }
}
function drawItem(c, e){
  const x = e.x, y = e.y, bobY = e.st === 'sit' ? Math.sin(G.time * 4 + e.id) * 1 : 0;
  if(e.k === 'egg'){
    const wob = Math.sin(G.time * 3 + e.id) > 0.9 ? Math.sin(G.time * 40) * 0.12 : 0;
    const spot = e.item === 'board' ? '#3f8fe0' : e.item === 'charm' ? '#ff9f1a' : '#3fbf5a';
    c.save(); c.translate(x + 6, y + 14); c.rotate(wob);
    c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, 0, 0, 6, 1.4); c.fill();
    c.fillStyle = '#e8dcc8'; ell(c, 0, -6.6, 6, 7.4); c.fill();
    c.fillStyle = '#fffaf0'; ell(c, -0.4, -7, 5.2, 6.6); c.fill();
    c.fillStyle = spot; circ(c, -2, -9, 1.5); c.fill(); circ(c, 2.4, -6, 1.8); c.fill(); circ(c, -1.6, -3.2, 1.2); c.fill(); circ(c, 1.2, -11.4, 1); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)'; ell(c, -2.6, -10.4, 1.2, 2, -0.3); c.fill();
    c.restore();
  } else if(e.k === 'board'){
    const yy = y + bobY;
    c.fillStyle = 'rgba(122,200,255,.3)'; ell(c, x + 8, yy + 4, 11, 7); c.fill();
    c.fillStyle = '#2b2440'; circ(c, x + 3.5, yy + 7, 1.8); c.fill(); circ(c, x + 12.5, yy + 7, 1.8); c.fill();
    c.fillStyle = '#c0763a'; rr(c, x, yy + 2, 16, 3.4, 1.7); c.fill();
    c.fillStyle = '#3f8fe0'; c.fillRect(x + 4, yy + 2.6, 8, 1.2); c.fillStyle = '#ffd45e'; c.fillRect(x + 7, yy + 2.6, 2, 1.2);
  } else if(e.k === 'charm'){
    const cx = x + 6, cy = y + 6 + bobY;
    c.fillStyle = 'rgba(255,212,94,.3)'; circ(c, cx, cy, 9 + Math.sin(G.time * 6)); c.fill();
    c.save(); c.translate(cx, cy); c.rotate(G.time * 1.5); c.fillStyle = '#ff9f1a';
    for(let i = 0; i < 8; i++){ c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(-1.4, -4); c.lineTo(0, -7.4); c.lineTo(1.4, -4); c.fill(); }
    c.restore();
    c.fillStyle = '#ffd45e'; circ(c, cx, cy, 4.4); c.fill(); c.fillStyle = '#fff3b0'; circ(c, cx - 1, cy - 1, 1.8); c.fill();
    c.fillStyle = '#b86a0c'; c.fillRect(cx - 1.8, cy - 0.4, 0.9, 1.2); c.fillRect(cx + 0.9, cy - 0.4, 0.9, 1.2);
  } else if(e.k === 'melon'){
    const cx = x + 7, cy = y + 6 + bobY;
    c.fillStyle = '#1f7a34'; ell(c, cx, cy, 7, 5.6); c.fill();
    c.fillStyle = '#3fbf5a'; ell(c, cx - 0.3, cy - 0.3, 6.2, 4.9); c.fill();
    c.strokeStyle = '#1f7a34'; c.lineWidth = 0.9; c.beginPath(); for(let i = -2; i <= 2; i++){ c.moveTo(cx + i * 2.4, cy - 4.6); c.quadraticCurveTo(cx + i * 3, cy, cx + i * 2.4, cy + 4.6); } c.stroke();
    c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, cx - 3, cy - 2.4, 1.6, 0.8, -0.4); c.fill();
  }
}
function drawProp(c, e){
  const I = G.island, x = e.x, y = e.y, k = I.key;
  if(e.k === 'axe'){ drawAxe(c, x + 4.5, y + 4.5, e.t * 16 * (e.face || 1), 1); }
  else if(e.k === 'plat'){
    const w = e.w;
    if(k === 'volcano'){ c.fillStyle = '#2e2432'; rr(c, x, y, w, 8, 2); c.fill(); c.fillStyle = '#5a4a5e'; rr(c, x + 0.5, y, w - 1, 5, 2); c.fill(); c.fillStyle = 'rgba(255,140,60,.8)'; c.fillRect(x + 2, y + 7, w - 4, 1.4); }
    else {
      for(let i = 0; i < 4; i++){ c.fillStyle = '#6f4523'; rr(c, x, y + i * 0.2, w, 8, 4); c.fill(); }
      c.fillStyle = '#6f4523'; rr(c, x, y, w, 8, 3.5); c.fill();
      c.fillStyle = '#b27b45'; for(let i = 0; i < 4; i++){ rr(c, x + 0.6 + i * 11.8, y + 0.6, 11.2, 6.4, 3); c.fill(); }
      c.fillStyle = '#dca36a'; for(let i = 0; i < 4; i++) c.fillRect(x + 2 + i * 11.8, y + 1.2, 8, 0.9);
      c.fillStyle = '#e9d9b0'; c.fillRect(x + 7, y, 1.4, 8); c.fillRect(x + w - 8.4, y, 1.4, 8);
    }
  } else if(e.k === 'lift'){
    const w = e.w;
    if(k === 'jungle' || k === 'beach'){
      c.fillStyle = '#2f8f3a'; ell(c, x + w / 2, y + 3.5, w / 2 + 2, 4.6); c.fill();
      c.fillStyle = '#56c84a'; ell(c, x + w / 2, y + 3, w / 2, 3.6); c.fill();
      c.strokeStyle = '#2f8f3a'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x + 2, y + 3); c.lineTo(x + w - 2, y + 3); for(let i = 1; i < 5; i++){ c.moveTo(x + i * w / 5, y + 3); c.lineTo(x + i * w / 5 + 3, y + 0.5); c.moveTo(x + i * w / 5, y + 3); c.lineTo(x + i * w / 5 + 3, y + 5.5); } c.stroke();
    } else { c.fillStyle = '#2e2432'; rr(c, x, y, w, 8, 2); c.fill(); c.fillStyle = '#6e6070'; rr(c, x + 0.5, y, w - 1, 5, 2); c.fill(); c.fillStyle = 'rgba(255,140,60,.8)'; c.fillRect(x + 3, y + 7, w - 6, 1.2); }
  } else if(e.k === 'spring'){
    const cmp = e.t > 0 && e.t < 0.3 ? Math.sin(e.t / 0.3 * Math.PI) : 0, top = y + 1 + cmp * 3;
    c.fillStyle = '#2f8f3a'; c.fillRect(x + 7, top + 2, 2, y + 10 - top - 2);
    c.fillStyle = '#3fbf5a'; ell(c, x + 4, y + 8, 4, 1.6, -0.4); c.fill(); ell(c, x + 12, y + 8, 4, 1.6, 0.4); c.fill();
    c.fillStyle = '#ff5aa0'; for(let i = 0; i < 6; i++){ ell(c, x + 8 + Math.cos(i * 1.05) * 5, top + 1.6 + Math.sin(i * 1.05) * 1.6, 3.4, 1.8, i * 1.05); c.fill(); }
    c.fillStyle = '#ffb3d9'; ell(c, x + 8, top + 1, 5.6, 1.8); c.fill();
    c.fillStyle = '#ffe14a'; ell(c, x + 8, top + 1.2, 2.6, 1.1); c.fill();
  } else if(e.k === 'torch'){
    const got = e.st === 'got';
    c.fillStyle = '#6f4523'; c.fillRect(x + 5, y + 10, 2.4, 30); c.fillStyle = '#8a5a30'; c.fillRect(x + 5, y + 10, 0.8, 30);
    c.fillStyle = '#e9d9b0'; c.fillRect(x + 4.4, y + 18, 3.6, 1); c.fillRect(x + 4.4, y + 26, 3.6, 1);
    c.fillStyle = '#5a3418'; c.beginPath(); c.moveTo(x + 1, y + 6); c.lineTo(x + 11, y + 6); c.lineTo(x + 8.4, y + 11); c.lineTo(x + 3.6, y + 11); c.fill();
    if(got) drawFire(c, x + 6, y + 7, e.id);
    else { for(let i = 0; i < 2; i++){ const t = (G.time * 0.5 + i / 2) % 1; c.fillStyle = 'rgba(200,200,200,' + (0.4 * (1 - t)) + ')'; circ(c, x + 6 + Math.sin(t * 6) * 1.5, y + 4 - t * 10, 1 + t * 2); c.fill(); } }
  } else if(e.k === 'gate'){
    const post = (px) => {
      c.fillStyle = '#6f4523'; rr(c, px, y + 8, 10, 56, 2); c.fill();
      c.fillStyle = '#8f5a30'; c.fillRect(px + 1, y + 8, 2, 56);
      for(let i = 0; i < 2; i++){ const fy = y + 16 + i * 22;
        c.fillStyle = '#4a2c14'; rr(c, px + 1, fy, 8, 16, 2); c.fill();
        c.fillStyle = '#ffd45e'; c.fillRect(px + 2.4, fy + 3.6, 2, 2); c.fillRect(px + 5.6, fy + 3.6, 2, 2);
        c.fillStyle = '#e9d9b0'; c.fillRect(px + 2.6, fy + 9, 4.8, 2.6); c.fillStyle = '#4a2c14'; for(let t2 = 0; t2 < 3; t2++) c.fillRect(px + 3.4 + t2 * 1.6, fy + 9, 0.5, 2.6); }
    };
    post(x); post(x + e.w - 10);
    c.fillStyle = '#5a3418'; rr(c, x - 4, y + 4, e.w + 8, 7, 2); c.fill();
    c.fillStyle = '#8f5a30'; c.fillRect(x - 3, y + 5, e.w + 6, 1.4);
    c.fillStyle = '#3fbf5a'; for(let i = 0; i < 9; i++){ ell(c, x - 2 + i * 6, y + 3, 4, 2, (i % 2 ? 0.4 : -0.4)); c.fill(); }
    const wv = Math.sin(G.time * 5) * 1.2;
    const cols = ['#ff5a6e', '#ffd45e', '#3fd0b0', '#7aa8ff', '#ff9f43'];
    for(let i = 0; i < 5; i++){ c.fillStyle = cols[i]; c.beginPath(); const fx0 = x + 6 + i * 8; c.moveTo(fx0 - 2.6, y + 11); c.lineTo(fx0 + 2.6, y + 11); c.lineTo(fx0 + wv * (i % 2 ? 1 : -1) * 0.5, y + 17); c.fill(); }
    drawFire(c, x + 5, y + 8, 3); drawFire(c, x + e.w - 5, y + 8, 5);
  } else if(e.k === 'cave'){
    c.fillStyle = '#120a10'; c.beginPath(); c.moveTo(x + 1, y + 32); c.lineTo(x + 1, y + 12); c.quadraticCurveTo(x + 16, y - 4, x + 31, y + 12); c.lineTo(x + 31, y + 32); c.fill();
    c.fillStyle = '#2a1c24'; for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(x + 6 + i * 6, y + 6 + (i % 2) * 2); c.lineTo(x + 8 + i * 6, y + 12 + (i % 2) * 3); c.lineTo(x + 10 + i * 6, y + 6 + (i % 2) * 2); c.fill(); }
    if(e.st === 'open'){
      const a = 0.5 + Math.sin(G.time * 4) * 0.3;
      c.fillStyle = 'rgba(255,212,94,' + a + ')'; star5(c, x + 16, y + 20, 3.4, 1.4); c.fill();
      outlined(c, 'SECRET!', x + 16, y - 6 + Math.sin(G.time * 3) * 1.5, 4.5, '#ffd45e');
    }
  } else if(e.k === 'exit'){
    c.fillStyle = '#120a10'; c.beginPath(); c.moveTo(x - 14, y + 32); c.lineTo(x - 14, y + 18); c.quadraticCurveTo(x - 7, y + 8, x, y + 14); c.lineTo(x, y + 32); c.fill();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x - 13, y + 18, 1, 14);
  }
}

/* ---------- Bosses ---------- */
function drawBoss(c, e){
  const x = e.x, y = e.y, w = e.w, h = e.h, f = e.face || -1, flash = e.inv > 0 && Math.floor(G.time * 16) % 2;
  c.save();
  if(e.st === 'defeat'){ c.translate(x + w / 2, y + h / 2); c.rotate(e.t * 3 * f); c.translate(-(x + w / 2), -(y + h / 2)); }
  if(e.bw === 0){
    // Captain Kelp: a big lagoon octopus in a captain's cap
    const tired = e.st === 'tired', cx = x + w / 2, hy = y + 15;
    c.save(); if(!tired && e.st !== 'defeat'){ c.beginPath(); c.rect(x - 40, y - 40, w + 80, 12 * T + 6 - (y - 40)); c.clip(); }
    const body = flash ? '#ffffff' : '#c2458a', light = flash ? '#ffffff' : '#e46aac';
    c.strokeStyle = body; c.lineWidth = 5; c.lineCap = 'round';
    for(let i = 0; i < 4; i++){
      const bx = x + 6 + i * 11, wv = Math.sin(G.time * 5 + i * 1.3) * 5;
      c.beginPath(); c.moveTo(bx, hy + 12); c.quadraticCurveTo(bx + wv - (tired ? 14 : 0), hy + 24, bx + wv * 1.4 - (tired ? 24 : 0), hy + (tired ? 26 : 36)); c.stroke();
    }
    c.lineCap = 'butt';
    c.fillStyle = body; ell(c, cx, hy + 2, w / 2, 17); c.fill();
    c.fillStyle = light; ell(c, cx - 6, hy - 6, 10, 7); c.fill();
    c.fillStyle = flash ? '#fff' : '#9a2f6a'; for(const d of [[-12, 6], [10, 8], [2, -8], [16, -2]]){ circ(c, cx + d[0], hy + d[1], 1.8); c.fill(); }
    // cap
    c.fillStyle = '#1f2d5a'; rr(c, cx - 15, hy - 20, 30, 8, 3); c.fill(); c.fillStyle = '#26386e'; ell(c, cx, hy - 20, 13, 5); c.fill();
    c.fillStyle = '#1a2448'; rr(c, cx - 22, hy - 13.5, 22, 3, 1.5); c.fill();
    c.fillStyle = '#ffd45e'; c.fillRect(cx - 15, hy - 14.5, 30, 1.2);
    c.strokeStyle = '#ffd45e'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx + 2, hy - 22); c.lineTo(cx + 2, hy - 16.5); c.moveTo(cx - 0.5, hy - 20.5); c.lineTo(cx + 4.5, hy - 20.5); c.arc(cx + 2, hy - 18, 2.2, 0.2, Math.PI - 0.2); c.stroke();
    // face
    if(tired){
      c.strokeStyle = '#1d1630'; c.lineWidth = 0.8;
      for(const ex of [cx - 9, cx + 1]){ c.beginPath(); c.arc(ex, hy + 1, 2.4, G.time * 8, G.time * 8 + 4.6); c.stroke(); }
      c.fillStyle = '#ff7aa0'; ell(c, cx - 4, hy + 10, 2.6, 3.4); c.fill();
      for(let i = 0; i < 3; i++){ const a = G.time * 5 + i * 2.1; c.fillStyle = '#ffd45e'; star5(c, cx + Math.cos(a) * 12, hy - 24 + Math.sin(a) * 3, 2.2, 1); c.fill(); }
    } else {
      c.fillStyle = '#fff'; ell(c, cx - 9, hy + 1, 4, 4.6); c.fill(); ell(c, cx + 1, hy + 1, 4, 4.6); c.fill();
      c.fillStyle = '#1d1630'; circ(c, cx - 10.2, hy + 1.6, 1.9); c.fill(); circ(c, cx - 0.2, hy + 1.6, 1.9); c.fill();
      c.strokeStyle = '#1d1630'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 13, hy - 4.4); c.lineTo(cx - 6, hy - 2.6); c.moveTo(cx + 5, hy - 4.4); c.lineTo(cx - 2, hy - 2.6); c.stroke();
      c.fillStyle = '#7a1f4a'; ell(c, cx - 4, hy + 10, 3, 1.8 + (e.st === 'throw' ? Math.abs(Math.sin(G.time * 8)) : 0)); c.fill();
      if(e.st === 'throw'){ c.fillStyle = '#7a4b2a'; circ(c, x - 2, hy - 8 + Math.sin(G.time * 10) * 2, 4.2); c.fill(); }
    }
    c.restore();
    if(!tired && e.st !== 'defeat' && e.st !== 'intro'){ c.fillStyle = 'rgba(255,255,255,.7)'; for(let i = 0; i < 5; i++){ c.fillRect(x - 4 + i * 11 + Math.sin(G.time * 4 + i) * 2, 12 * T + 5, 6, 1); } }
  } else if(e.bw === 1){
    // Queen Buzzbelle: a royal bee with a crown and a very long stinger
    const cx = x + w / 2, stuck = e.st === 'stuck', fl = Math.sin(G.time * 40);
    c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, cx - 7, y + 4 - fl * 2, 8, 5 + fl * 2, -0.5); c.fill(); ell(c, cx + 7, y + 4 - fl * 2, 8, 5 + fl * 2, 0.5); c.fill();
    c.strokeStyle = 'rgba(160,200,255,.8)'; c.lineWidth = 0.6; ell(c, cx - 7, y + 4 - fl * 2, 8, 5 + fl * 2, -0.5); c.stroke(); ell(c, cx + 7, y + 4 - fl * 2, 8, 5 + fl * 2, 0.5); c.stroke();
    c.fillStyle = '#2b2440'; c.beginPath(); c.moveTo(cx - 3, y + h - 2); c.lineTo(cx, y + h + (stuck ? 6 : 5)); c.lineTo(cx + 3, y + h - 2); c.fill();
    c.fillStyle = flash ? '#fff' : '#ffc21f'; ell(c, cx, y + h / 2 + 4, 13, 11); c.fill();
    c.fillStyle = flash ? '#fff' : '#2b2440'; for(let i = -1; i <= 1; i++){ c.save(); ell(c, cx, y + h / 2 + 4, 13, 11); c.clip(); c.fillRect(cx - 14, y + h / 2 + 4 + i * 6 - 1.6, 28, 3.2); c.restore(); }
    c.fillStyle = flash ? '#fff' : '#ffd45e'; circ(c, cx, y + 7, 7.5); c.fill();
    c.fillStyle = '#ffe14a'; c.beginPath(); c.moveTo(cx - 6, y + 1); c.lineTo(cx - 6, y - 5); c.lineTo(cx - 3, y - 2); c.lineTo(cx, y - 7); c.lineTo(cx + 3, y - 2); c.lineTo(cx + 6, y - 5); c.lineTo(cx + 6, y + 1); c.fill();
    c.fillStyle = '#ff5aa0'; circ(c, cx, y - 1.5, 1.2); c.fill();
    c.strokeStyle = '#2b2440'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(cx - 3, y + 1); c.quadraticCurveTo(cx - 6, y - 6, cx - 9, y - 5); c.moveTo(cx + 3, y + 1); c.quadraticCurveTo(cx + 6, y - 6, cx + 9, y - 5); c.stroke();
    if(stuck){
      c.strokeStyle = '#1d1630'; c.lineWidth = 0.7; for(const ex of [cx - 3, cx + 3]){ c.beginPath(); c.arc(ex, y + 7, 1.6, G.time * 8, G.time * 8 + 4.6); c.stroke(); }
      for(let i = 0; i < 3; i++){ const a = G.time * 6 + i * 2.1; c.fillStyle = '#fff'; star5(c, cx + Math.cos(a) * 11, y - 8 + Math.sin(a) * 2.5, 2.2, 1); c.fill(); }
    } else eyes(c, cx - 3.2 + f * 0.6, y + 7, f, e.st === 'aim' || e.st === 'dive', 5);
    c.fillStyle = '#b8742a'; c.fillRect(cx - 2, y + 11, 4, 0.8);
  } else {
    // Big Bongo: a grumpy stone tiki with bongo drums
    const cx = x + w / 2, open = e.st === 'spit' || e.st === 'tired', drum = e.st === 'drum';
    const stone = flash ? '#ffffff' : '#7a6a7e', dk = flash ? '#ffffff' : '#4a3c50', lt = flash ? '#fff' : '#9c8ca0';
    if(e.st === 'intro'){ c.fillStyle = 'rgba(255,120,40,.6)'; ell(c, cx, 12 * T, 30, 5); c.fill(); }
    c.fillStyle = '#3fbf5a'; for(let i = 0; i < 7; i++){ const a = -Math.PI / 2 + (i - 3) * 0.32; ell(c, cx + Math.cos(a) * 20, y + 2 + Math.sin(a) * 14, 3, 10, a + Math.PI / 2); c.fill(); }
    c.fillStyle = dk; rr(c, x, y + 2, w, h - 2, 8); c.fill();
    c.fillStyle = stone; rr(c, x + 2, y + 2, w - 4, h - 6, 7); c.fill();
    c.fillStyle = lt; c.fillRect(x + 5, y + 5, 3, h - 14);
    c.fillStyle = dk; rr(c, x + 5, y + 10, w - 10, 5, 2); c.fill();
    const glow = e.st === 'tired' ? '#6a5a4a' : '#ffb347';
    c.fillStyle = '#231a26'; rr(c, cx - 15, y + 15, 11, 8, 3); c.fill(); rr(c, cx + 4, y + 15, 11, 8, 3); c.fill();
    if(e.st === 'tired'){ c.strokeStyle = '#ffb347'; c.lineWidth = 0.8; for(const ex of [cx - 9.5, cx + 9.5]){ c.beginPath(); c.arc(ex, y + 19, 2.4, G.time * 6, G.time * 6 + 4.6); c.stroke(); } }
    else { c.fillStyle = glow; circ(c, cx - 9.5 + f, y + 19, 2.4); c.fill(); circ(c, cx + 9.5 + f, y + 19, 2.4); c.fill(); }
    c.fillStyle = dk; c.beginPath(); c.moveTo(cx - 3, y + 21); c.lineTo(cx + 3, y + 21); c.lineTo(cx + 4, y + 29); c.lineTo(cx - 4, y + 29); c.fill();
    const mh = open ? 11 : 4;
    c.fillStyle = '#231a26'; rr(c, cx - 13, y + 31, 26, mh, 2); c.fill();
    if(open){ c.fillStyle = e.st === 'spit' ? '#ff7a2a' : '#ff5a7a'; rr(c, cx - 7, y + 31 + mh - 4, 14, 4, 2); c.fill(); }
    c.fillStyle = '#e9e0d0'; for(let i = 0; i < 6; i++){ c.fillRect(cx - 12 + i * 4.3, y + 31, 2.6, 2); c.fillRect(cx - 12 + i * 4.3, y + 31 + mh - 2, 2.6, 2); }
    // little arms and drums
    const beat = drum ? Math.abs(Math.sin(G.time * 16)) * 4 : 0;
    c.fillStyle = '#8a5a30'; for(const sd of [-1, 1]){ const dx = cx + sd * 18; rr(c, dx - 6, y + h - 12, 12, 11, 3); c.fill(); c.fillStyle = '#e9d9b0'; ell(c, dx, y + h - 12, 6, 2); c.fill(); c.fillStyle = '#8a5a30'; }
    c.fillStyle = stone; for(const sd of [-1, 1]){ circ(c, cx + sd * 18, y + h - 17 - (sd > 0 ? beat : 4 - beat), 3); c.fill(); }
    if(e.st === 'tired' && Math.random() < 0.2 && G.state !== 'paused') spawnFx('dust', cx + (Math.random() - 0.5) * 20, y, 'rgba(200,200,200,.6)');
  }
  c.restore();
}

/* ---------- HUD and overlays ---------- */
function energyBar(c, x, y, p, wide){
  const n = 20, sw = wide ? 3.6 : 2.6, e = p.energy, lit = Math.ceil(e / 100 * n);
  const low = e < 25, blink = low && Math.floor(G.time * 6) % 2;
  c.fillStyle = 'rgba(10,8,24,.55)'; rr(c, x - 2, y - 3.5, n * (sw + 0.8) + 3, 7, 2); c.fill();
  for(let i = 0; i < n; i++){
    const col = i >= lit ? 'rgba(255,255,255,.14)' : e > 50 ? '#6be05a' : e > 25 ? '#ffd45e' : (blink ? '#ffffff' : '#ff5a4e');
    c.fillStyle = col; c.fillRect(x + i * (sw + 0.8), y - 2, sw, 4);
  }
  let ix = x + n * (sw + 0.8) + 4;
  if(p.board){ c.fillStyle = '#c0763a'; rr(c, ix, y - 1.5, 9, 2, 1); c.fill(); c.fillStyle = '#2b2440'; circ(c, ix + 2, y + 1.5, 1); c.fill(); circ(c, ix + 7, y + 1.5, 1); c.fill(); ix += 12; }
  if(p.charm > 0){ c.fillStyle = hue(G.time * 400); circ(c, ix + 3, y, 3); c.fill(); ix += 9; }
}
function drawHUD(c){
  const def = LEVELS[G.lv];
  const g = c.createLinearGradient(0, 0, 0, 26); g.addColorStop(0, 'rgba(10,8,24,.55)'); g.addColorStop(1, 'rgba(10,8,24,0)');
  c.fillStyle = g; c.fillRect(0, 0, VW, 26);
  outlined(c, String(G.score).padStart(7, '0'), 8, 8, 7, '#fff6e0', 'left');
  outlined(c, def.code + '  ' + def.name.toUpperCase(), VW / 2, 8, 5, '#ffd45e');
  if(hasLives()){ heart(c, VW - 28, 7.5, 3.4, '#ff5a6e'); outlined(c, '×' + Math.max(0, G.lives), VW - 23, 8.4, 6, '#fff6e0', 'left'); }
  else outlined(c, 'KIDS', VW - 20, 8.4, 5, '#7dff8a');
  if(!isBoss(G.lv)){
    if(G.players.length === 1){ drawFruit(c, 'a', 14, 20); energyBar(c, 22, 20, G.players[0], true); }
    else G.players.forEach((p, i) => {
      const x = 8 + i * 196, y = 20;
      c.fillStyle = p.color; circ(c, x + 2, y, 2.4); c.fill();
      const nm = p.name.toUpperCase(), sz = fitText(c, nm, 34, 4.5);
      text(c, nm, x + 7, y, sz, p.bubble ? '#a9a6c0' : '#fff6e0', 'left', 'middle');
      energyBar(c, x + 44, y, p, false);
    });
  } else if(G.players.length > 1){
    G.players.forEach((p, i) => { const x = 8 + i * 60, y = 19; c.fillStyle = p.color; circ(c, x + 2, y, 2.4); c.fill(); const nm = p.name.toUpperCase(); text(c, nm, x + 7, y, fitText(c, nm, 44, 4.5), '#fff6e0', 'left', 'middle'); });
  }
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.st !== 'defeat'){
    const bw = 110, by = VH - 15;
    c.fillStyle = 'rgba(10,8,24,.6)'; rr(c, VW / 2 - bw / 2 - 4, by - 8, bw + 8, 17, 4); c.fill();
    outlined(c, boss.name, VW / 2, by - 3, 4.5, '#ff9a8a');
    const n = boss.max, sp = Math.min(10, 100 / n);
    for(let i = 0; i < n; i++){ const px = VW / 2 - (n - 1) * sp / 2 + i * sp; heart(c, px, by + 4.5, 2.4, i < boss.hp ? '#ff5a6e' : 'rgba(255,255,255,.2)'); }
  }
  if(!A.Input.isTouch && G.state === 'play' && G.lvT < 5 && G.net !== 'guest') text(c, 'PAUSE: START / ESC', 8, VH - 10, 4.5, 'rgba(255,255,255,.55)');
  if(G.state === 'play' && G.lvT < 6 && G.lv === 0 && G.net !== 'guest'){
    const tip = A.Input.isTouch ? 'Tap JUMP to jump   ▼ + JUMP: throw axe   Eat fruit for energy!' : 'FIRE: jump   DOWN + FIRE: throw axe   Eat fruit for energy!';
    outlined(c, tip, VW / 2, VH - 26, 4.5, '#fff6e0');
  }
  for(const p of G.players){
    if(p.done || p.bubble) continue;
    if(p.y + p.h < G.cam.y + 2){ const sx = p.x + p.w / 2 - G.cam.x; c.fillStyle = p.color; c.beginPath(); c.moveTo(sx, 26); c.lineTo(sx - 3.5, 31); c.lineTo(sx + 3.5, 31); c.fill(); }
  }
}
function drawIntro(c){
  const def = LEVELS[G.lv], t = G.stateT, len = G.introLen || 2.4;
  const a = Math.min(1, t * 5) * Math.min(1, Math.max(0, (len - t) / 0.35));
  c.globalAlpha = a;
  c.fillStyle = 'rgba(12,10,28,.82)'; c.fillRect(0, 0, VW, VH);
  const I = ISLANDS[def.i];
  outlined(c, 'AREA ' + def.code, VW / 2, 62, 8, '#ffd45e');
  outlined(c, def.name.toUpperCase(), VW / 2, 82, fitText(c, def.name.toUpperCase(), VW - 40, 14), '#fff6e0');
  outlined(c, isBoss(G.lv) ? 'BOSS: ' + BOSS_NAMES[def.boss] : I.name.toUpperCase(), VW / 2, 100, 5.5, isBoss(G.lv) ? '#ff9a8a' : '#9fe8d7');
  const n = G.players.length;
  G.players.forEach((p, i) => {
    const cx = VW / 2 - (n - 1) * 30 + i * 60;
    const fake = Object.assign({}, p, { x: cx - 6, y: 142 - HH, onGround: true, vx: 0, inv: 0, bubble: false, dead: 0, done: 0, face: 1, charm: 0, squashT: 0, tripT: 0, climb: false, throwT: 0, energy: 100 });
    drawHero(c, fake);
    const nm = p.name.toUpperCase(); outlined(c, nm, cx, 152, fitText(c, nm, 52, 5), p.color);
  });
  if(hasLives()){ heart(c, VW / 2 - 12, 172, 4, '#ff5a6e'); outlined(c, '× ' + G.lives, VW / 2 + 4, 172.5, 7, '#fff6e0'); }
  else outlined(c, 'KIDS MODE · NO GAME OVER', VW / 2, 172, 5, '#7dff8a');
  c.globalAlpha = 1;
}
function drawClear(c){
  const boss = isBoss(G.lv), msg = boss ? 'BOSS BEATEN!' : 'AREA CLEAR!';
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
  const t = G.stateT, rise = Math.min(1, t / 3);
  const sy = 190 - rise * 110;
  c.fillStyle = 'rgba(255,200,90,' + (0.25 * rise) + ')'; c.fillRect(0, 0, VW, VH);
  c.fillStyle = 'rgba(255,230,150,.35)'; circ(c, VW / 2, sy, 44); c.fill();
  c.save(); c.translate(VW / 2, sy); c.rotate(G.time * 0.4); c.fillStyle = 'rgba(255,212,94,.5)';
  for(let i = 0; i < 12; i++){ c.rotate(Math.PI / 6); c.beginPath(); c.moveTo(-3, -30); c.lineTo(0, -52); c.lineTo(3, -30); c.fill(); }
  c.restore();
  c.fillStyle = '#ffd45e'; circ(c, VW / 2, sy, 26); c.fill(); c.fillStyle = '#fff3b0'; circ(c, VW / 2 - 7, sy - 7, 9); c.fill();
  c.fillStyle = '#ff9f1a'; star5(c, VW / 2, sy, 12, 5); c.fill();
  if(t > 1.2 && t < 6){ outlined(c, 'THE SUNSTONE IS HOME!', VW / 2, 34, 11, hue(G.time * 80, 90, 72)); outlined(c, 'THANK YOU, ISLANDERS', VW / 2, 52, 6, '#fff6e0'); }
  if(t > 2.4 && t < 6) outlined(c, 'An xRetro original · art, levels & music made in code', VW / 2, 64, 4.2, '#fff0d8');
}
function drawNames(c){
  if(G.players.length < 2 || G.demo) return;
  for(const p of G.players){
    const top = p.bubble ? p.y + p.h / 2 - 18 : p.y - 12;
    const nm = p.name.toUpperCase();
    outlined(c, nm, p.x + p.w / 2, top, fitText(c, nm, 40, 4), p.color);
  }
}

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
  for(const e of G.ents) if(e.k === 'gate' || e.k === 'torch' || e.k === 'cave') drawProp(c, e);
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.bw === 2) drawBoss(c, boss);
  c.setTransform(1, 0, 0, 1, 0, 0);
  drawTiles(c, camX, camY, s);
  world();
  drawLive(c, camX);
  for(const e of G.ents){
    if(e.k === 'gate' || e.k === 'torch' || e.k === 'cave' || e.k === 'spawner') continue;
    if(FOES.has(e.k)) drawFoe(c, e);
    else if(HAZARDS.has(e.k)) drawHazard(c, e);
    else if(ITEMS.has(e.k) || e.k === 'egg') drawItem(c, e);
    else if(e.k === 'boss'){ if(e.bw !== 2) drawBoss(c, e); }
    else drawProp(c, e);
  }
  const order = G.players.slice().sort((a, b) => (a.bubble ? 1 : 0) - (b.bubble ? 1 : 0));
  for(const p of order){ if(p.bubble) drawBubble(c, p); else drawHero(c, p); }
  drawPits(c, camX);
  for(const p of parts){
    const a = 1 - p.t / p.life;
    if(p.kind === 'text'){ c.globalAlpha = Math.min(1, a * 2); outlined(c, p.str, p.x, p.y, 5, p.col); }
    else if(p.kind === 'big'){ c.globalAlpha = Math.min(1, a * 2); const sc = 1 + Math.max(0, 0.25 - p.t) * 2; outlined(c, p.str, p.x, p.y, 7 * sc, p.col); }
    else if(p.kind === 'chunk'){ c.globalAlpha = a; c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.8); c.restore(); }
    else if(p.kind === 'star'){ c.globalAlpha = a; c.fillStyle = p.col; star5(c, p.x, p.y, p.r * 1.4, p.r * 0.55); c.fill(); }
    else if(p.kind === 'board'){ c.globalAlpha = a; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = '#c0763a'; rr(c, -8, -1.3, 16, 2.6, 1.3); c.fill(); c.fillStyle = '#2b2440'; circ(c, -5, 2, 1.5); c.fill(); circ(c, 5, 2, 1.5); c.fill(); c.restore(); }
    else { c.globalAlpha = a; c.fillStyle = p.col; circ(c, p.x, p.y, p.r * (0.5 + a * 0.5)); c.fill(); }
  }
  c.globalAlpha = 1;
  drawNames(c);
  c.setTransform(s, 0, 0, s, 0, 0);
  drawFG(c, camX);
  if(G.warp){ const t = G.warp.t, a = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.45); c.fillStyle = 'rgba(8,6,12,' + a + ')'; c.fillRect(0, 0, VW, VH); }
  if(G.state === 'ending') drawEnding(c);
  else if(!G.demo) drawHUD(c);
  if(G.state === 'intro') drawIntro(c);
  if(G.state === 'clear') drawClear(c);
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.32)'; c.fillRect(0, 0, VW, VH); }
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
window.__tiki = G;
window.__tikiDebug = { mkEnt, hurt, toBubble, step, Net, LEVELS, buildLevel, loadLevel, tileAt, setTile, startIntro, newGame, results, startClear, ending, sim, active, CH, crackBoulder, reachGoal, throwAxe };
})();
