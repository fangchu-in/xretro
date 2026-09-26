/* BIG TOP — a circus platform adventure for 1–4 acrobats on one shared screen, or online.
   A prankster wind scattered the circus! Run with the D-pad, FIRE jumps (hold it to jump higher).
   Collect star tokens to raise the Big Top again: leap through hoops, bounce on trampolines
   (hold FIRE as you land for a SUPER BOUNCE), ride cannons, catch trapezes (FIRE lets go),
   float on balloon clusters and ring the 3 hidden bells in every act to open the bonus tent.
   All characters, levels, art and music are original and made in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;
const GAME = 'bigtop';

/* ---------- Constants ---------- */
const VW = 384, VH = 216, T = 16, ROWS = 14, LH = ROWS * T, GROUND = 12 * T;
const FONT = '"Silkscreen","Courier New",monospace';
const WALK = 88, RUN = 142, ROPE_MAX = 78, ACC = 440, AIR_ACC = 330, SKID = 950, FRICTION = 560;
const JUMP = 322, G_HOLD = 720, G_FALL = 1500, MAX_FALL = 430, STOMP_V = 250, STOMP_HOLD = 345;
const TRAMP_V = 390, SUPER_V = 505, FLY_G = 825, CANNON_V = 520;
const HERO_W = 12, HERO_H = 18;
const SOLID = new Set(['#', 'X', '?', 'M', 'U', 'c']);
const isSolid = ch => SOLID.has(ch);
const isOneWay = ch => ch === '=' || ch === '~';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;

const DIFF = {
  kids:   { label: 'Kids',   lives: Infinity, hearts: 3, pitBounce: true,  fireSafe: true,  enemy: 0.62, ball: 0.55, bossHp: 3, props: 0.7 },
  normal: { label: 'Normal', lives: 5,        hearts: 3, pitBounce: false, fireSafe: false, enemy: 1.0,  ball: 1.0,  bossHp: 4, props: 1.0 },
  pro:    { label: 'Pro',    lives: 3,        hearts: 2, pitBounce: false, fireSafe: false, enemy: 1.22, ball: 1.2,  bossHp: 5, props: 1.2 }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];

/* ---------- Music: big-band chiptune (trumpet, tuba oom-pah, snare, calliope), all original ---------- */
const PARADE_THEME = {
  bpm: 136, brass: true, bass: 'tuba', leadVol: 0.07, chords: ['C', 'G7', 'C', 'F', 'C', 'G7', 'F', 'C'],
  lead: [
    'G4 - C5 - E5 - G5 - - - E5 - C5 - E5 -', 'F5 - - - D5 - B4 - G4 - B4 - D5 - F5 -',
    'E5 - - - C5 - E5 - G5 - C6 - - - G5 -', 'A5 - - - F5 - A5 - C6 - A5 - F5 - C5 -',
    'E5 - G5 - C6 - - - B5 - A5 - G5 - E5 -', 'D5 - F5 - B5 - - - A5 - G5 - F5 - D5 -',
    'C5 - F5 - A5 - F5 - G5 - E5 - D5 - B4 -', 'C5 - - - G4 - - - C5 - - - . . . .'],
  drums: ['k...s...k...s...', 'k...s...k...s.r.', 'k...s...k.k.s...', 'z...s...k...srr.']
};
const FIRE_THEME = {
  bpm: 150, brass: true, bass: 'tuba', leadVol: 0.068, chords: ['Am', 'E7', 'Am', 'Dm', 'Am', 'E7', 'F', 'E7'],
  lead: [
    'A4 - C5 - E5 - A5 - - - G#5 - A5 - . .', 'B5 - - - G#5 - E5 - D5 - - - B4 - - -',
    'C5 - E5 - A5 - C6 - B5 - A5 - E5 - C5 -', 'D5 - - - F5 - A5 - D6 - - - C6 - A5 -',
    'E5 - A5 - C6 - - - E6 - D6 - C6 - B5 -', 'G#5 - - - B5 - D6 - - - B5 - G#5 - E5 -',
    'F5 - A5 - C6 - F6 - E6 - - - C6 - A5 -', 'B5 - - - G#5 - - - E5 - - - . . E5 -'],
  drums: ['k.s.k.s.k.s.k.sr', 'k.s.k.s.k.s.krsr', 'k.s.k.s.k.s.k.s.', 'z.s.k.s.k.srk.rr']
};
const WIRE_THEME = {
  bpm: 118, calliope: true, bass: 'tuba', leadVol: 0.07, chords: ['F', 'C7', 'F', 'Bb', 'F', 'Dm', 'Bb', 'C7'],
  lead: [
    'A5 - - - F5 - C5 - F5 - A5 - C6 - - -', 'Bb5 - - - G5 - E5 - C5 - E5 - G5 - - -',
    'A5 - G5 - F5 - C5 - A4 - C5 - F5 - - -', 'D6 - - - Bb5 - F5 - D5 - F5 - Bb5 - - -',
    'C6 - - - A5 - F5 - C6 - D6 - C6 - A5 -', 'A5 - - - F5 - D5 - F5 - A5 - D6 - - -',
    'D6 - C6 - Bb5 - A5 - G5 - F5 - D5 - Bb4 -', 'C5 - - - E5 - - - G5 - - - Bb5 - - -'],
  drums: ['k...h...s...h...', 'k...h...s...h.h.', 'k...h...s...h...', 'k...h...s.r.s...']
};
const CANNON_THEME = {
  bpm: 156, brass: true, bass: 'tuba', leadVol: 0.068, chords: ['D', 'A7', 'D', 'G', 'D', 'Bm', 'E7', 'A7'],
  lead: [
    'D5 - F#5 - A5 - D6 - - - A5 - D6 - - -', 'C#6 - - - A5 - E5 - G5 - - - C#6 - - -',
    'D6 - C#6 - D6 - A5 - F#5 - A5 - D6 - F#6 -', 'G6 - - - D6 - B5 - G5 - B5 - D6 - B5 -',
    'A5 - - - F#5 - D5 - F#5 - A5 - D6 - A5 -', 'B5 - - - F#5 - D5 - B4 - D5 - F#5 - B5 -',
    'G#5 - B5 - E6 - - - D6 - B5 - G#5 - E5 -', 'A5 - - - C#6 - - - E6 - - - . . A4 -'],
  drums: ['k.k.s...k.k.s...', 'k.k.s...k.k.s.rr', 'k.k.s...k.k.s...', 'z...s.k.k.k.srrr']
};
const NIGHT_THEME = {
  bpm: 108, calliope: true, bass: 'tuba', leadVol: 0.062, chords: ['Em', 'C', 'Am', 'B7', 'Em', 'C', 'D', 'B7'],
  lead: [
    'E5 - - - G5 - B5 - - - A5 - G5 - - -', 'E5 - - - - - - - C5 - E5 - G5 - - -',
    'A5 - - - C6 - E6 - - - D6 - C6 - - -', 'B5 - - - - - D#5 - F#5 - A5 - B5 - - -',
    'G5 - - - B5 - E6 - - - D6 - B5 - - -', 'C6 - - - G5 - E5 - G5 - C6 - E6 - - -',
    'D6 - - - A5 - F#5 - D5 - F#5 - A5 - - -', 'B5 - - - A5 - F#5 - D#5 - - - B4 - - -'],
  drums: ['k.......s.......', 'k.......s...h.h.', 'k.......s.......', 'k.....k.s...r...']
};
const FINALE_THEME = {
  bpm: 160, brass: true, bass: 'tuba', leadVol: 0.07, chords: ['G', 'D7', 'G', 'C', 'G', 'Em', 'A7', 'D7'],
  lead: [
    'D5 - G5 - B5 - D6 - - - B5 - G5 - B5 -', 'C6 - - - A5 - F#5 - D5 - F#5 - A5 - C6 -',
    'B5 - D6 - G6 - - - F#6 - E6 - D6 - B5 -', 'C6 - E6 - G6 - E6 - C6 - - - G5 - E5 -',
    'D6 - - - B5 - G5 - D6 - E6 - D6 - B5 -', 'E6 - - - B5 - G5 - E5 - G5 - B5 - E6 -',
    'C#6 - E6 - A6 - - - G6 - E6 - C#6 - A5 -', 'D6 - - - F#6 - - - A6 - - - . . D5 -'],
  drums: ['k.s.k.s.k.s.k.s.', 'k.s.k.s.k.s.krsr', 'k.s.k.s.k.s.k.s.', 'z.s.k.s.krsrkrrr']
};
const BOSS_THEME = {
  bpm: 164, brass: true, bass: 'gallop', arp: 'fast', leadVol: 0.066, chords: ['Cm', 'Cm', 'Ab', 'G', 'Cm', 'Cm', 'Ab', 'G'],
  lead: [
    'C5 - . C5 Eb5 - G5 - C6 - - - B5 - G5 -', 'Ab5 - G5 - F5 - Eb5 - D5 - - - . . G4 -',
    'Ab4 - C5 - Eb5 - Ab5 - G5 - - - Eb5 - C5 -', 'B4 - D5 - G5 - B5 - D6 - - - B5 - G5 -',
    'C5 - . C5 Eb5 - G5 - C6 - - - D6 - Eb6 -', 'D6 - C6 - B5 - G5 - - - . . G5 - - -',
    'Ab5 - - - C6 - - - Eb6 - - - Ab6 - - -', 'G6 - - - D6 - - - B5 - - - G5 - - -'],
  drums: ['k.hsk.hsk.hsk.ss', 'krhsk.hskkhsk.rr']
};
const PRANK_THEME = {
  bpm: 172, calliope: true, bass: 'gallop', arp: 'fast', leadVol: 0.07, chords: ['Dm', 'A7', 'Dm', 'Bb', 'Gm', 'Dm', 'E7', 'A7'],
  lead: [
    'D5 - F5 - A5 - D6 - C#6 - D6 - A5 - F5 -', 'E5 - G5 - C#6 - E6 - - - C#6 - A5 - G5 -',
    'F5 - A5 - D6 - F6 - E6 - D6 - A5 - F5 -', 'Bb5 - - - F5 - D5 - Bb4 - D5 - F5 - Bb5 -',
    'G5 - Bb5 - D6 - G6 - F6 - D6 - Bb5 - G5 -', 'A5 - - - F5 - D5 - A5 - D6 - F6 - A6 -',
    'G#5 - B5 - E6 - G#6 - - - E6 - B5 - G#5 -', 'A5 - C#6 - E6 - A6 - G6 - E6 - C#6 - A5 -'],
  drums: ['k.hsk.hsk.hsk.ss', 'krhsk.hskkhsk.rr']
};
const CAPE_THEME = {
  bpm: 186, calliope: true, bass: 'drive', arp: 'fast', leadVol: 0.07, chords: ['C', 'F', 'C', 'G'],
  lead: [
    'C6 - G5 - E5 - G5 - C6 - E6 - G6 - E6 -', 'F6 - C6 - A5 - C6 - F6 - A6 - F6 - C6 -',
    'E6 - C6 - G5 - C6 - E6 - G6 - C6 - E6 -', 'D6 - B5 - G5 - B5 - D6 - F6 - D6 - B5 -'],
  drums: ['k.hsk.hsk.hsk.hs']
};
const BONUS_THEME = {
  bpm: 176, calliope: true, bass: 'tuba', leadVol: 0.07, chords: ['F', 'C7', 'F', 'Bb', 'F', 'C7', 'Bb', 'F'],
  lead: [
    'C6 - A5 - F5 - A5 - C6 - F6 - C6 - A5 -', 'Bb5 - G5 - E5 - G5 - C6 - E6 - C6 - G5 -',
    'A5 - C6 - F6 - C6 - A5 - F5 - A5 - C6 -', 'D6 - Bb5 - F5 - Bb5 - D6 - F6 - D6 - Bb5 -',
    'C6 - A5 - F5 - A5 - C6 - F6 - A6 - F6 -', 'E6 - C6 - G5 - C6 - E6 - G6 - E6 - C6 -',
    'D6 - F6 - D6 - Bb5 - G5 - Bb5 - D6 - Bb5 -', 'A5 - - - C6 - - - F6 - - - . . . .'],
  drums: ['k.s.k.s.k.s.k.s.', 'k.s.k.s.k.s.krsr']
};
const ENDING_THEME = {
  bpm: 104, brass: true, bass: 'tuba', leadVol: 0.075, chords: ['C', 'Am', 'F', 'G7', 'C', 'Am', 'Dm', 'G7'],
  lead: [
    'E5 - - - G5 - C6 - - - B5 - A5 - G5 -', 'A5 - - - - - E5 - A5 - C6 - E6 - - -',
    'F6 - - - C6 - A5 - F5 - A5 - C6 - F6 -', 'D6 - - - B5 - G5 - D5 - - - G5 - - -',
    'C6 - - - E6 - G6 - - - E6 - C6 - G5 -', 'A5 - - - C6 - E6 - - - D6 - C6 - A5 -',
    'D6 - - - F6 - A6 - - - G6 - F6 - D6 -', 'G6 - - - F6 - D6 - B5 - - - G5 - - -'],
  drums: ['k...s...k...s...', 'k...s...k...s.r.']
};

/* ---------- Acts (each has its own ground, sky and music) ---------- */
const ACTS = [
  { key: 'parade', name: 'Grand Parade', music: PARADE_THEME, sky: ['#5ab4ff', '#ffe6b4'],
    g: { top: '#5fd35b', topHi: '#b3f58a', topDk: '#3a9a45', fill: '#c98a4c', fillDk: '#98612f', fillHi: '#e3a866', speck: '#8f5a2e' },
    ped: ['#e84a4a', '#fff3e0', '#ffd45e'], plank: ['#c27d44', '#7a4a24', '#ffd45e'] },
  { key: 'ring', name: 'Ring of Fire', music: FIRE_THEME, sky: ['#3a1640', '#c2415a'], tent: true,
    g: { top: '#f3c96d', topHi: '#fff0b8', topDk: '#c7913c', fill: '#b8323c', fillDk: '#861f2c', fillHi: '#e0525a', speck: '#6d1824' },
    ped: ['#3a7bd5', '#f4efe2', '#ffd45e'], plank: ['#b86d38', '#6a3a1c', '#ffd45e'] },
  { key: 'wire', name: 'High Wire', music: WIRE_THEME, sky: ['#4a7fe0', '#ffc9a8'], wind: true,
    g: { top: '#7fd8ff', topHi: '#e2f7ff', topDk: '#3f98c4', fill: '#5b5fb8', fillDk: '#3e4190', fillHi: '#7f83d8', speck: '#353878' },
    ped: ['#ff8a3d', '#fff3e0', '#ffd45e'], plank: ['#a8693b', '#6f4424', '#ffd45e'] },
  { key: 'cannon', name: 'Cannon Alley', music: CANNON_THEME, sky: ['#2b3c8f', '#ff9e6b'],
    g: { top: '#ffb347', topHi: '#ffe0a0', topDk: '#c97d1c', fill: '#6b4a8c', fillDk: '#4c3368', fillHi: '#8d68b0', speck: '#3c2856' },
    ped: ['#34b37a', '#f4efe2', '#ffd45e'], plank: ['#b5743e', '#7a4a24', '#ffd45e'] },
  { key: 'night', name: 'Midnight Trapeze', music: NIGHT_THEME, sky: ['#0b0a24', '#2c2358'], tent: true, dark: true,
    g: { top: '#9b7bff', topHi: '#d8c9ff', topDk: '#6146c4', fill: '#2d2560', fillDk: '#1d1844', fillHi: '#463a8a', speck: '#161236' },
    ped: ['#7a5cff', '#e6e0ff', '#ffd45e'], plank: ['#8a6a4a', '#4f3a26', '#ffd45e'] },
  { key: 'finale', name: 'Big Tent Finale', music: FINALE_THEME, sky: ['#5a1030', '#ff7a5a'], tent: true,
    g: { top: '#ffd45e', topHi: '#fff3b8', topDk: '#c99a2e', fill: '#c42e46', fillDk: '#8c1d33', fillHi: '#e85468', speck: '#6e1426' },
    ped: ['#f4efe2', '#e84a4a', '#ffd45e'], plank: ['#c27d44', '#7a4a24', '#ffd45e'] }
];

/* ---------- Level pieces ----------
   Rows are bottom-aligned (the last two rows are usually ground). Legend:
   # ground   X pedestal   ? token crate   M prize crate   c crumbling pedestal   = plank   ~ tightrope   o star token
   w cheeky monkey   r rolling barrel   b barrel wagon (rolls barrels at you)   O bouncy ball   f fire pot
   i hoop   I fire hoop   j swinging fire hoop   T trampoline   K cannon   k tall-shot cannon   Y trapeze (pivot)
   Q balloon cluster   L hidden bell   S spotlight   @ start   C checkpoint   N bonus tent   P podium   Z boss */
const CH = {
  S1: ['..........', 'L.........', '==........', '..........', '..........', '...@......', '##########', '##########'],
  S:  ['........', '.@......', '########', '########'],
  crates: ['....?.M.?...', '............', '............', '......w.....', '############', '############'],
  crates2: ['...?.?.?.?....', '..............', '..............', '..............', '....w.....w...', '##############', '##############'],
  planks: ['...........ooo..', '...........===..', '................', '.....ooo........', '.....===........', '................', '................', '###..........###', '###..........###'],
  tramp0: ['.........ooooo....', '.........=====....', '..................', '..................', '..................', '..................', '..................', '....T.............', '##################', '##################'],
  tramp: ['.........ooooo.L..', '.........=====....', '..................', '..................', '..................', '..................', '..................', '....T.............', '##################', '##################'],
  wagon: ['..................b.', '####################', '####################'],
  balloon: ['..............ooo...L....', '.........ooo.............', '....ooo..................', '.........................', '.........................', '.........................',
            '.........................', '..........===............', '..Q......................', '.........................', '########.......##########', '########.......##########'],
  pedsteps: ['.............', '..........X..', '.......X..X..', '....X..X..X..', '#############', '#############'],
  ringpeds: ['.......L........', '................', '................', '................', '...cc...cc...cc.', '................', '##............##', '##............##'],
  firesteps: ['.......L........', '................', '................', '................', '.......X........', '...X...X...X....', '...X.f.X.f.X....', '################', '################'],
  trampbell: ['....L.......', '...===......', '............', '............', '............', '............', '............', '............', '............', '.T..........', '############', '############'],
  rope1: ['X~~~~~~~~~~X', '##........##', '##........##'],
  rope2: ['X~~~~~~w~~~~~~~X', 'X..............X', 'X..............X', '##............##', '##............##'],
  ropebell: ['........L.........', '..................', '..................', '..................', 'X~~~~~~~~~~~~~~~~X', 'X................X', '##..............##', '##..............##'],
  ropeball: ['......O.........', '................', '................', 'X~~~~~~~~~~~~~~X', 'X..............X', '##............##', '##............##'],
  rope3: ['..........L..........', '.....................', '.....................', '....ooo.......ooo....', 'X~~~~~~~~~~w~~~~~~~~X', 'X...................X', 'X...................X', '##.................##', '##.................##'],
  cannon: ['K..................', '###..............##', '###..............##'],
  cannonbell: ['.................', '...............L.', '.............====', '.................', '.................', '.................', '.................', '.................', '.k...............', '######......#####', '######......#####'],
  walltramp: ['........L......', '...............', '...............', '...............', '........X......', '........X......', '........X......', '........X......', '..T.....X......', '###############', '###############'],
  wallbell: ['...L.......', '..===......', '...........', '...........', '...........', '...........', '...........', '.......XX..', '.......XX..', '.......XX..', '.T.....XX..', '###########', '###########'],
  trap1: ['.....Y......Y......', '...................', '...................', '...................', '...................', '...................', '...................', '...................', '...................', '###..............##', '###..............##'],
  trap2: ['.....Y......Y......Y......', '..........................', '..........................', '................L.........', '..........................', '..........................', '..........................', '..........................', '..........................', '###.....................##', '###.....................##'],
  trap3: ['.....Y......Y......Y......', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '###.....................##', '###.....................##'],
  trapbell: ['....................', '.....Y..............', '....................', '....................', '..........L.........', '.........===........', '....................', '....................', '....................', '....................', '....................', '###.........########', '###.........########'],
  spots: ['..S.........S.........S...', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '..........................', '##########################', '##########################'],
  END: ['.............................', '.............................', '...X.........................', '..XX.........................', '.XXX.......N..........P.......', '##############################', '##############################'],
  arenaLeo: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
             'X..=====........=====..X', 'X......................X', 'X......................X', 'X.@..............Z.....X', '########################', '########################'],
  arenaKaboom: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X.........====.........X',
             'X......................X', 'X......................X', 'X......................X', 'X.@.T.........Z....T...X', '########################', '########################'],
  arenaPrank: ['X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X', 'X......................X',
             'X...====........====...X', 'X......................X', 'X......................X', 'X.@...T.....Z.....T....X', '########################', '########################'],
  bonus: ['X......................X', 'X..o..o..o..o..o..o..o.X', 'X......................X', 'X.o..o..o..o..o..o..o..X', 'X......................X', 'X..=====....=====......X', 'X..ooooo....ooooo......X',
          'X......................X', 'X.o.o.o.o.o.o.o.o.o.o..X', 'X......................X', 'X......................X', 'X.@..T.....T.....T.....X', '########################', '########################']
};

/* A level is a list of pieces: F<n> flat ground (letters after the number are placed along it),
   G<n> gap (G3o = with a token arc), R<h> raise the ground to h, C checkpoint, W1/W0 wind on/off, or a piece name. */
const LEVELS = [
  { act: 0, code: '1', name: 'Grand Parade', parts: 'S1 F6 crates F8w F12ioi F6 wagon F6 planks F6w C F4 tramp F8ww F10i?i F4 balloon F6w R1 F5 R2 F6r R0 F8 wagon F6w F6o pedsteps F4 END' },
  { act: 1, code: '2', name: 'Ring of Fire', parts: 'S F8 F14I F6o crates F16IfI F4 ringpeds F8f F6 firesteps F6 C F4 F16jf F6 trampbell F10w F12IoI F6 pedsteps F8fwf F6 F14jj F4 END' },
  { act: 1, code: '2', name: 'Leo’s Ring', boss: 0, parts: 'arenaLeo' },
  { act: 2, code: '3', name: 'High Wire', wind: true, parts: 'S F8 F10O rope1 F6w rope2 F6 F12OwO C F4 ropebell F8 balloon F8w rope3 F6 R1 F4 R2 F4 R0 F8O ropeball F6 crates2 F6 END' },
  { act: 3, code: '4', name: 'Cannon Alley', parts: 'S F8 F8r cannon F10 walltramp F8w F6O crates C F4 cannonbell F10rr cannon F6 F10OwO wallbell F8 wagon F8 cannon F8w F4 END' },
  { act: 3, code: '4', name: 'Colonel Kaboom', boss: 1, parts: 'arenaKaboom' },
  { act: 4, code: '5', name: 'Midnight Trapeze', dark: true, parts: 'S F8 spots trap1 F8w F6 crates F4 trap2 F6 C F4 trapbell F8ww planks F6 trap3 F8 balloon F6w F4 END' },
  { act: 5, code: '6', name: 'Big Tent Finale', parts: 'S F8 F12IoI F6 wagon F4 W1 ropebell F6 ropeball W0 F6 C F4 cannon F10 trap1 F6 tramp0 F8wIw F4 ringpeds F6 crates F6 wallbell F8 F14jj F4 END' },
  { act: 5, code: '6', name: 'The Prankster', boss: 2, parts: 'arenaPrank' }
];
const BONUS_LV = LEVELS.length;          // the bonus tent room has its own index
LEVELS.push({ act: -1, code: '★', name: 'Bonus Tent', bonus: true, parts: 'bonus' });
const BOSS_NAMES = ['LEO THE LION', 'COLONEL KABOOM', 'THE PRANKSTER'];
const BOSS_LINES = [
  ['Leo the Lion: “A whoopee cushion on my throne? RAWR!”', 'Leo: “Oof… my paws are all dizzy.”', 'Leo: “Purrr… fine. I’ll hold the tent pole.”'],
  ['Colonel Kaboom: “Ten-HUT! Nobody crosses Cannon Alley!”', 'Kaboom: “Whew, running hot!”', 'Kaboom: “At ease… the confetti cannons are yours.”'],
  ['The Prankster: “Ha HA! My wind blew your whole circus away!”', 'The Prankster: “Oh no, my balloon has a leak!”', 'The Prankster: “Okay, okay! I’ll help put the Big Top back up!”']
];
const isBoss = ix => LEVELS[ix] && LEVELS[ix].boss !== undefined;
const actFirst = a => LEVELS.findIndex(l => l.act === a);
const actLast = a => { let ix = -1; LEVELS.forEach((l, i) => { if(l.act === a) ix = i; }); return ix; };
const ENT_CHARS = 'wrbOfiIjTKkYQLSCNPZ';
/* Medal times per act (seconds, whole act including its boss). Kids get more time. */
const MEDAL_TIMES = [
  { gold: 45, silver: 65 }, { gold: 95, silver: 135 }, { gold: 48, silver: 70 },
  { gold: 78, silver: 110 }, { gold: 55, silver: 80 }, { gold: 90, silver: 130 }
];
const medalFor = (act, t, diff) => { const m = MEDAL_TIMES[act], k = diff === 'kids' ? 1.6 : 1; return A.Medals.pick(t, { gold: m.gold * k, silver: m.silver * k }, true); };

const BUILT = {};
function buildLevel(ix){
  if(BUILT[ix]) return BUILT[ix];
  const def = LEVELS[ix], act = ACTS[def.bonus ? 5 : Math.max(0, def.act)];
  const cols = [], ents = [], wind = [];
  let h = 0, start = null, windFrom = def.wind ? 0 : -1;
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
        if('wrbOfiIjTKk'.includes(ch)) place(x, 11 - h, ch);
        else if(ch === 'Q') place(x, 10 - h, ch);
        else if(ch === 'o'){ for(let k = -1; k <= 1; k++) if(x + k >= x0 && x + k < x0 + n) place(x + k, 9 - h, 'o'); }
        else place(x, 8 - h, ch);
      }
    } else if((m = /^G(\d+)(o?)$/.exec(tok))){
      const n = +m[1], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(emptyCol());
      if(m[2]) for(let i = 0; i < n; i++) place(x0 + i, 9 - h - Math.round(Math.sin(Math.PI * (i + 0.5) / n) * 2), 'o');
    } else if((m = /^R(\d)$/.exec(tok))) h = +m[1];
    else if(tok === 'W1') windFrom = cols.length;
    else if(tok === 'W0'){ if(windFrom >= 0) wind.push([windFrom * T, cols.length * T]); windFrom = -1; }
    else if(tok === 'C'){ const x0 = cols.length; for(let i = 0; i < 4; i++) cols.push(groundCol()); place(x0 + 1, 11 - h, 'C'); }
    else if(CH[tok]){
      if(tok === 'END' || tok.startsWith('arena') || tok === 'bonus') h = 0;
      const rows = CH[tok], n = rows.length, w = Math.max(...rows.map(r => r.length)), x0 = cols.length;
      for(let i = 0; i < w; i++) cols.push(emptyCol());
      for(let r = 0; r < n; r++){
        const row = ROWS - n + r - h;
        for(let i = 0; i < w; i++){ const ch = rows[r][i] || '.'; if(ch !== '.') place(x0 + i, row, ch); }
      }
      if(h > 0) for(let i = 0; i < w; i++) if(rows[n - 1][i] === '#') for(let r = ROWS - h; r < ROWS; r++) cols[x0 + i][r] = '#';
    }
  }
  if(windFrom >= 0) wind.push([windFrom * T, cols.length * T]);
  const W = cols.length, map = new Array(W * ROWS);
  for(let x = 0; x < W; x++) for(let r = 0; r < ROWS; r++) map[r * W + x] = cols[x][r];
  // cannons: a trail of star tokens along the flight path shows where they go
  for(const e of ents){
    if(e.ch !== 'K' && e.ch !== 'k') continue;
    const sh = cannonShot(e.ch), mx = e.tx * T + 8 + sh.mx, my = (e.ty + 1) * T - 22;
    for(let t = 0.16; t < 1.4; t += 0.14){
      const px = mx + sh.vx * t, py = my + sh.vy * t + 0.5 * FLY_G * t * t;
      const tx = Math.floor(px / T), ty = Math.floor(py / T);
      if(tx < 0 || tx >= W || ty < 0 || ty >= 12) break;
      if(map[ty * W + tx] !== '.') break;
      map[ty * W + tx] = 'o';
    }
  }
  const bells = ents.filter(e => e.ch === 'L').length;
  return (BUILT[ix] = { map, W, ents, start: start || { tx: 1, ty: 11 }, def, act, wind, bells });
}
function cannonShot(ch){
  const a = ch === 'k' ? 66 * Math.PI / 180 : 48 * Math.PI / 180, v = ch === 'k' ? 560 : CANNON_V;
  return { vx: Math.cos(a) * v, vy: -Math.sin(a) * v, a, mx: 10 };
}

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('bigtop.diff', 'normal'), lv: 0, startAct: 0,
  unlocked: Math.min(ACTS.length - 1, A.Store.get('bigtop.unlocked', 0) | 0),
  players: [], roster: [], ents: [], map: null, W: 0, mods: [], act: ACTS[0], def: LEVELS[0],
  cam: { x: 0, y: LH - VH }, score: 0, lives: 5, tokens: 0, time: 0, stateT: 0, lvT: 0, actT: 0, introLen: 2.4,
  check: null, goalT: -1, wipeT: 0, loadN: 0, net: null, shake: 0, bumps: [], crumbles: new Map(),
  levelScore: 0, actScore: 0, podium: null, tent: null, god: false, demoT: 0, modsApplied: 0,
  bells: 0, bellsMax: 3, wind: { t: 0, ph: 0, dir: -1, on: false, zones: [] }, bonusT: 0, back: null, say: '', sayN: 0,
  runStats: null
};
if(!DIFF[G.diff]) G.diff = 'normal';
G.startAct = Math.min(G.unlocked, A.Store.get('bigtop.start', 0) | 0);
const D = () => DIFF[G.diff];
const hasLives = () => D().lives !== Infinity;

/* ---------- Sounds ---------- */
const SX = {
  jump:   s => s.tone({ wave: 'pulse25', f: 320, f2: 660, t: 0.13, v: 0.07 }),
  token:  s => { s.tone({ wave: 'triangle', f: 1568, t: 0.05, v: 0.1 }); s.tone({ wave: 'triangle', f: 2349, t: 0.14, v: 0.1, at: 0.05 }); },
  stomp:  s => { s.tone({ f: 260, f2: 90, t: 0.1, v: 0.12 }); s.noise({ t: 0.07, v: 0.12, f: 1400, f2: 300 }); },
  bump:   s => s.tone({ wave: 'triangle', f: 170, f2: 110, t: 0.09, v: 0.2 }),
  boing:  s => s.tone({ wave: 'sine', f: 330, f2: 760, t: 0.13, v: 0.13 }),
  tramp:  s => s.tone({ wave: 'triangle', f: 200, f2: 820, t: 0.24, v: 0.15, vib: true }),
  super:  s => { s.tone({ wave: 'triangle', f: 180, f2: 1400, t: 0.4, v: 0.15, vib: true }); s.melody([[1047, .06], [1319, .06], [1568, .1]], { wave: 'sine', v: 0.08, at: 0.12 }); },
  honk:   s => { s.tone({ wave: 'sawtooth', f: 330, t: 0.12, v: 0.09, lp: 1400 }); s.tone({ wave: 'sawtooth', f: 262, t: 0.18, v: 0.09, at: 0.13, lp: 1200 }); },
  hoop:   s => { s.noise({ t: 0.18, v: 0.1, f: 3000, f2: 800, type: 'bandpass' }); s.melody([[1319, .05], [1760, .1]], { wave: 'sine', v: 0.1, at: 0.05 }); },
  fire:   s => { s.noise({ t: 0.3, v: 0.16, f: 1800, f2: 400 }); s.melody([[1568, .05], [2093, .12]], { wave: 'triangle', v: 0.1, at: 0.08 }); },
  load:   s => { s.tone({ wave: 'triangle', f: 700, f2: 250, t: 0.18, v: 0.12 }); s.noise({ t: 0.08, v: 0.1, f: 900 }); },
  cannon: s => { s.noise({ t: 0.5, v: 0.34, f: 1600, f2: 80 }); s.tone({ wave: 'sine', f: 110, f2: 45, t: 0.35, v: 0.3 }); s.tone({ wave: 'sine', f: 700, f2: 1800, t: 0.7, v: 0.05, at: 0.1 }); },
  grab:   s => { s.tone({ wave: 'triangle', f: 520, f2: 780, t: 0.09, v: 0.1 }); s.noise({ t: 0.12, v: 0.06, f: 3000, type: 'bandpass' }); },
  swing:  s => s.noise({ t: 0.35, v: 0.07, f: 900, f2: 2400, type: 'bandpass', q: 2 }),
  balloon: s => { s.tone({ wave: 'sine', f: 900, f2: 1300, t: 0.12, v: 0.08 }); s.tone({ wave: 'sine', f: 1100, f2: 1500, t: 0.1, v: 0.06, at: 0.1 }); },
  pop:    s => { s.tone({ wave: 'sine', f: 1300, f2: 320, t: 0.09, v: 0.15 }); s.noise({ t: 0.05, v: 0.1, f: 6000, type: 'highpass' }); },
  bubble: s => { s.tone({ wave: 'sine', f: 380, f2: 900, t: 0.26, v: 0.15 }); s.tone({ wave: 'sine', f: 620, f2: 1300, t: 0.2, v: 0.08, at: 0.09 }); },
  bell:   s => { for(const [f, v, t] of [[1760, 0.12, 1.2], [2217, 0.05, 0.9], [3520, 0.04, 0.6], [880, 0.05, 1.4]]) s.tone({ wave: 'sine', f, t, v, attack: 0.002 });
                 s.tone({ wave: 'sine', f: 1760, t: 1.0, v: 0.08, at: 0.3, attack: 0.002 }); },
  sprout: s => s.melody([[523, .05], [659, .05], [784, .05], [1047, .09]], { wave: 'triangle', v: 0.11 }),
  flag:   s => s.melody([[784, .07], [988, .07], [1175, .07], [1568, .16]], { wave: 'triangle', v: 0.12 }),
  die:    s => s.melody([[988, .08], [932, .08], [880, .08], [0, .12], [659, .12], [523, .12], [392, .28]], { wave: 'pulse25', v: 0.1 }),
  fanfare: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .22], [0, .05], [880, .1], [1047, .1], [1319, .4]], { wave: 'sawtooth', v: 0.07 });
                  s.melody([[131, .32], [175, .32], [196, .4], [262, .5]], { wave: 'triangle', v: 0.16 }); },
  drumroll: s => { for(let i = 0; i < 14; i++) s.noise({ t: 0.05, v: 0.05 + i * 0.006, f: 5000, f2: 1600, type: 'bandpass', at: i * 0.045 }); s.noise({ t: 0.9, v: 0.12, f: 7000, type: 'highpass', at: 0.65 }); },
  cheer:  s => { s.noise({ t: 1.3, v: 0.14, f: 1500, type: 'bandpass', q: 0.6, attack: 0.25 }); s.noise({ t: 1.1, v: 0.06, f: 4000, type: 'bandpass', q: 1, attack: 0.3 }); },
  bossHit: s => { s.noise({ t: 0.3, v: 0.3, f: 2200, f2: 200 }); s.tone({ wave: 'sawtooth', f: 330, f2: 110, t: 0.3, v: 0.1 }); s.tone({ wave: 'sine', f: 600, f2: 1400, t: 0.2, v: 0.08, at: 0.1 }); },
  land:   s => { s.noise({ t: 0.35, v: 0.35, f: 900, f2: 60 }); s.tone({ wave: 'sine', f: 90, f2: 40, t: 0.3, v: 0.25 }); },
  roar:   s => { s.tone({ wave: 'sawtooth', f: 180, f2: 90, t: 0.6, v: 0.12, lp: 900, lpFrom: 300 }); s.noise({ t: 0.6, v: 0.16, f: 700, f2: 250, attack: 0.05 }); },
  poomf:  s => { s.noise({ t: 0.25, v: 0.2, f: 1100, f2: 150 }); s.tone({ wave: 'sine', f: 160, f2: 60, t: 0.2, v: 0.2 }); },
  steam:  s => s.noise({ t: 0.6, v: 0.12, f: 6000, f2: 2500, type: 'highpass', attack: 0.05 }),
  splat:  s => { s.noise({ t: 0.18, v: 0.2, f: 800, f2: 200 }); s.tone({ wave: 'sine', f: 240, f2: 80, t: 0.12, v: 0.12 }); },
  squawk: s => { s.tone({ wave: 'square', f: 700, f2: 1300, t: 0.08, v: 0.06 }); s.tone({ wave: 'square', f: 1200, f2: 600, t: 0.12, v: 0.06, at: 0.08 }); },
  slip:   s => s.tone({ wave: 'sine', f: 400, f2: 1800, t: 0.35, v: 0.12 }),
  whoosh: s => s.noise({ t: 0.9, v: 0.1, f: 500, f2: 1600, type: 'bandpass', q: 1.5, attack: 0.3 }),
  laugh:  s => s.melody([[660, .07], [0, .03], [620, .07], [0, .03], [580, .07], [0, .03], [540, .12]], { wave: 'square', v: 0.05 }),
  warn:   s => s.tone({ f: 1760, t: 0.05, v: 0.05 }),
  crumble: s => s.noise({ t: 0.25, v: 0.16, f: 1600, f2: 250 }),
  firework: s => { s.noise({ t: 0.5, v: 0.22, f: 2200, f2: 200 }); s.tone({ wave: 'triangle', f: 1400, f2: 500, t: 0.2, v: 0.04 }); }
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
  for(let r = 2; r < ROWS; r++){ const ch = tileAt(tx, r); if((isSolid(ch) || isOneWay(ch)) && !isSolid(tileAt(tx, r - 1))) return r * T; }
  return GROUND;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* Move a body through the tile map: X first, then Y. Sets onGround, hitWall and hitHead. Planks and ropes are one-way. */
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
  b.y += b.vy * dt; b.onGround = false; b.onRope = false;
  const x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w - 0.01) / T);
  if(b.vy > 0){
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for(let tx = x0; tx <= x1; tx++){
      const ch = tileAt(tx, ty);
      if(isSolid(ch) || (isOneWay(ch) && prevBottom <= ty * T + 0.5 && !b.dropT)){ b.y = ty * T - b.h; b.vy = 0; b.onGround = true; if(ch === '~') b.onRope = true; break; }
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
      const cx = b.x + b.w / 2;
      let best = hit[0]; for(const tx of hit) if(Math.abs(tx * T + 8 - cx) < Math.abs(best * T + 8 - cx)) best = tx;
      b.y = (ty + 1) * T; b.vy = 0; b.hitHead = { tx: best, ty };
    }
  }
}

/* ---------- Entities ---------- */
let nextEnt = 1;
const SIZES = { monkey: [12, 12], barrel: [14, 14], wagon: [30, 24], ball: [16, 16], pot: [14, 10], hoop: [10, 60], tramp: [24, 8], cannon: [26, 18],
  trapeze: [20, 4], balloon: [14, 10], bell: [12, 14], spot: [10, 10], check: [16, 44], tent: [48, 40], podium: [40, 26],
  pop: [12, 12], ticket: [12, 10], cape: [12, 12], star: [10, 10], boss: [40, 30], roar: [12, 16], fhoop: [16, 16], cball: [12, 12],
  pie: [12, 8], chicken: [12, 10], banana: [12, 6] };
const FOES = new Set(['monkey', 'barrel', 'ball']);
const ITEMS = new Set(['pop', 'ticket', 'cape']);
const SHOTS = new Set(['roar', 'fhoop', 'cball', 'pie', 'chicken', 'banana']);
function mkEnt(k, x, y, o){
  const sz = SIZES[k] || [12, 12];
  const e = Object.assign({ id: nextEnt++, k, x, y, w: sz[0], h: sz[1], vx: 0, vy: 0, face: -1, st: '', t: 0, on: false, dead: 0 }, o);
  G.ents.push(e); return e;
}
function spawnFromMap(o){
  const bx = o.tx * T, by = (o.ty + 1) * T;
  const foot = (k, o2) => { const sz = SIZES[k]; return mkEnt(k, bx + (T - sz[0]) / 2, by - sz[1], o2); };
  switch(o.ch){
    case 'w': foot('monkey', { st: 'walk', face: -1 }); break;
    case 'r': foot('barrel', { st: 'roll', face: -1 }); break;
    case 'b': mkEnt('wagon', bx - 7, by - 24, { st: 'idle', t: 1.2 }); break;
    case 'O': mkEnt('ball', bx, by - 16, { st: 'bounce', face: -1, bx }); break;
    case 'f': foot('pot', { on: true }); break;
    case 'i': case 'I': case 'j': { const cy = by - 42; mkEnt('hoop', bx + 3, cy - 27, { on: true, cx: bx + 8, cy, ry: 24, fire: o.ch !== 'i', swing: o.ch === 'j', bx: bx + 8, passed: 0 }); break; }
    case 'T': mkEnt('tramp', bx - 4, by - 8, { on: true }); break;
    case 'K': case 'k': mkEnt('cannon', bx - 5, by - 18, { on: true, st: 'idle', tall: o.ch === 'k', rider: -1 }); break;
    case 'Y': mkEnt('trapeze', bx - 2, o.ty * T + 70, { on: true, px: bx + 8, py: o.ty * T, len: 70, amp: 0.78, ph: o.tx * 0.37, riders: 0 }); break;
    case 'Q': mkEnt('balloon', bx + 1, by - 10, { on: true, st: 'idle', hx: bx + 1, hy: by - 10, rider: -1 }); break;
    case 'L': mkEnt('bell', bx + 2, o.ty * T + 1, { on: true, st: '' }); break;
    case 'S': mkEnt('spot', bx + 3, o.ty * T, { on: true, ph: o.tx * 0.5 }); break;
    case 'C': mkEnt('check', bx, by - 44, { on: true, st: G.check !== null && G.check >= bx ? 'got' : '' }); break;
    case 'N': G.tent = mkEnt('tent', bx - 16, by - 40, { on: true }); break;
    case 'P': G.podium = mkEnt('podium', bx - 12, by - 26, { on: true }); break;
    case 'Z': makeBoss(G.def.boss, bx, by); break;
  }
}

/* ---------- Players ---------- */
function makeHero(o){
  return Object.assign({ slot: 0, source: null, name: 'Player', color: '#f5c542', x: 0, y: 0, w: HERO_W, h: HERO_H, vx: 0, vy: 0, face: 1,
    onGround: false, onRope: false, hearts: 3, inv: 0, cape: 0, bubble: false, bubbleT: 0, dead: 0, done: 0, away: false,
    coyote: 0, buffer: 0, jumping: false, springy: false, runT: 0, runDir: 0, chain: 0, prevBottom: 0,
    hang: null, cannon: null, ride: null, flying: 0, grabCD: 0, slipT: 0, squashT: 0, pose: 0, lean: 0, bot: false,
    st: newStats() }, o);
}
function newStats(){ return { tokens: 0, hoops: 0, stomps: 0, bounces: 0, flights: 0, swings: 0, balloons: 0, bells: 0, hurts: 0, falls: 0 }; }
const active = p => !p.bubble && !(p.dead > 0) && !p.done && !p.away;
function placePlayers(x0){
  G.players.forEach((p, i) => {
    Object.assign(p, { vx: 0, vy: 0, bubble: false, dead: 0, done: 0, inv: 0, cape: 0, chain: 0, jumping: false, springy: false, face: 1,
      hang: null, cannon: null, ride: null, flying: 0, grabCD: 0, slipT: 0, pose: 0, botBest: 0, botStuck: 0, botHold: 0, hearts: D().hearts });
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
const CONFETTI = ['#ff5a6e', '#ffd45e', '#3fd0b0', '#7aa8ff', '#ff7eb6', '#ffffff'];
function spawnFx(type, x, y, arg, arg2){
  const R = Math.random;
  switch(type){
    case 'text': parts.push({ kind: 'text', x, y, vx: 0, vy: -34, g: 0, t: 0, life: 0.95, str: arg, col: arg2 || '#fff' }); break;
    case 'big': parts.push({ kind: 'big', x, y, vx: 0, vy: -18, g: 0, t: 0, life: 1.3, str: arg, col: arg2 || '#ffd45e' }); break;
    case 'token': parts.push({ kind: 'token', x, y, vx: (R() - 0.5) * 40, vy: -230, g: 700, t: 0, life: 0.55 }); break;
    case 'poof': for(let i = 0; i < 7; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 80, vy: (R() - 0.7) * 60, g: 0, t: 0, life: 0.35 + R() * 0.2, col: 'rgba(255,255,255,.9)', r: 2 + R() * 2 }); break;
    case 'dust': for(let i = 0; i < 4; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 8, y, vx: (R() - 0.5) * 50, vy: -10 - R() * 20, g: 0, t: 0, life: 0.3, col: 'rgba(255,255,255,.7)', r: 1.5 + R() }); break;
    case 'smoke': for(let i = 0; i < 8; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 6, y: y + (R() - 0.5) * 6, vx: (arg || 1) * (30 + R() * 60), vy: -20 - R() * 40, g: -10, t: 0, life: 0.6 + R() * 0.3, col: 'rgba(235,235,245,.8)', r: 3 + R() * 3 }); break;
    case 'chunk': for(let i = 0; i < 4; i++) parts.push({ kind: 'chunk', x: x + (i % 2) * 8 - 4, y: y + (i > 1 ? 4 : -4), vx: (i % 2 ? 1 : -1) * (40 + R() * 30), vy: -200 - (i > 1 ? 0 : 80), g: 900, t: 0, life: 1.0, col: arg || '#e84a4a', r: 5, rot: R() * 6 }); break;
    case 'confetti': for(let i = 0; i < (arg2 || 24); i++){ const a = -Math.PI / 2 + (R() - 0.5) * 2.4, sp = 80 + R() * 120; parts.push({ kind: 'conf', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 260, t: 0, life: 1.4 + R() * 0.6, col: arg || CONFETTI[i % CONFETTI.length], r: 2, rot: R() * 6 }); } break;
    case 'pop': for(let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, g: 0, t: 0, life: 0.3, col: arg || 'rgba(210,240,255,.95)', r: 1.6 }); } break;
    case 'sparkle': for(let i = 0; i < 5; i++) parts.push({ kind: 'star', x: x + (R() - 0.5) * 12, y: y + (R() - 0.5) * 12, vx: (R() - 0.5) * 30, vy: -20 - R() * 30, g: 0, t: 0, life: 0.5, col: arg || '#fff6b0', r: 2 }); break;
    case 'trail': parts.push({ kind: 'star', x, y, vx: 0, vy: 0, g: 0, t: 0, life: 0.4, col: arg || '#ffd45e', r: 1.8 }); break;
    case 'firework': { const col = arg || '#ffd45e'; for(let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2, sp = 70 + R() * 50; parts.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, t: 0, life: 0.9 + R() * 0.3, col, r: 1.8 }); } break; }
    case 'cream': for(let i = 0; i < 9; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 120, vy: -60 - R() * 90, g: 500, t: 0, life: 0.6, col: i % 3 ? '#fffaf0' : '#ffb3c8', r: 2 + R() * 2 }); break;
    case 'bump': G.bumps.push({ i: x, t: 0 }); break;
    case 'shake': G.shake = Math.max(G.shake, x); break;
  }
  if(parts.length > 360) parts.splice(0, parts.length - 360);
}
function fxStep(dt){
  for(const p of parts){ p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if(p.rot !== undefined) p.rot += dt * 8; if(p.kind === 'conf'){ p.vx *= 1 - 1.5 * dt; } }
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
function windForce(p){
  const w = G.wind;
  if(!w.on || w.ph !== 2) return 0;
  const k = G.diff === 'kids' ? 0.55 : G.diff === 'pro' ? 1.15 : 1;
  return w.dir * (p.onRope ? 300 : p.onGround ? 250 : 190) * k;
}
function stepPlayer(p, dt){
  if(p.inv > 0) p.inv -= dt;
  if(p.squashT > 0) p.squashT -= dt;
  if(p.grabCD > 0) p.grabCD -= dt;
  if(p.slipT > 0) p.slipT -= dt;
  if(p.pose > 0) p.pose -= dt;
  if(p.dropT > 0) p.dropT -= dt;
  if(p.cape > 0) p.cape = Math.max(0, p.cape - dt);
  if(!p.bot){ const s = A.Input.get(p.source); p.away = !(s && s.connected); }
  if(p.done){ stepDone(p, dt); return; }
  if(p.dead > 0){ p.dead += dt; if(p.dead > 0.5){ p.vy = Math.min(MAX_FALL, p.vy + G_FALL * 0.7 * dt); p.y += p.vy * dt; } return; }
  if(p.bubble || (p.away && G.players.length > 1)){ releaseAll(p); stepBubble(p, dt); return; }
  if(G.state !== 'play' && !G.demo) return;
  const c = controls(p);
  if(p.cannon){ stepInCannon(p, c, dt); return; }
  if(p.hang){ stepHang(p, c, dt); return; }
  if(p.ride){ stepRide(p, c, dt); return; }
  const dir = p.flying > 0 ? 0 : (c.right ? 1 : 0) - (c.left ? 1 : 0);
  if(p.flying > 0){ p.flying -= dt; }
  if(dir) p.face = dir;
  if(dir && p.onGround){ if(dir === p.runDir) p.runT += dt; else { p.runDir = dir; p.runT = 0; } }
  else if(!dir && p.onGround) p.runT = 0;
  let max = p.runT > 0.45 ? RUN : WALK;
  if(p.onRope) max = ROPE_MAX;
  p.skid = false;
  if(p.slipT > 0){ /* banana peel: whoosh, no control */ }
  else if(dir){
    const reversing = Math.sign(p.vx) === -dir && Math.abs(p.vx) > 20;
    const acc = p.onGround ? (reversing ? SKID : ACC) : AIR_ACC;
    if(reversing && p.onGround) p.skid = true;
    if(Math.abs(p.vx) < max || Math.sign(p.vx) !== dir) p.vx += dir * acc * dt;
    if(Math.abs(p.vx) > max && Math.sign(p.vx) === dir) p.vx = dir * Math.max(max, Math.abs(p.vx) - (p.onGround ? 300 : p.leap ? 0 : 60) * dt);
  } else if(p.onGround){
    const f = FRICTION * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  const wf = windForce(p);
  if(wf){ p.vx += wf * dt; p.vx = clamp(p.vx, -RUN * 1.1, RUN * 1.1); }
  // jump (buffered, with a little coyote time); down + FIRE drops through a plank or rope
  if(c.fireP) p.buffer = 0.12;
  if(p.onGround) p.coyote = 0.09; else p.coyote -= dt;
  if(p.buffer > 0 && p.coyote > 0 && p.flying <= 0){
    if(c.down && p.onGround && isOneWay(tileAt(Math.floor((p.x + p.w / 2) / T), Math.floor((p.y + p.h + 1) / T)))){ p.dropT = 0.2; p.onGround = false; p.buffer = 0; p.coyote = 0; p.y += 1; }
    else {
      p.vy = -(JUMP + Math.min(46, Math.abs(p.vx) * 0.26) + (p.onRope ? 24 : 0)); p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.springy = false;
      sfx(p.onRope ? 'boing' : 'jump');
    }
  }
  p.buffer -= dt;
  const grav = p.flying || p.flyArc ? FLY_G : p.vy < 0 && (p.springy || (c.fire && p.jumping)) ? G_HOLD : G_FALL;
  if(p.vy >= 0){ p.jumping = false; p.springy = false; }
  p.vy = Math.min(MAX_FALL, p.vy + grav * dt);
  const wasGround = p.onGround;
  p.prevBottom = p.y + p.h;
  moveBody(p, dt, true);
  if(p.hitHead) bumpTile(p.hitHead.tx, p.hitHead.ty, p);
  const pd = G.podium;
  if(pd && overlap(p, pd) && p.prevBottom > pd.y + 4){
    if(p.x + p.w / 2 < pd.x + pd.w / 2){ p.x = pd.x - p.w; if(p.vx > 0) p.vx = 0; } else { p.x = pd.x + pd.w; if(p.vx < 0) p.vx = 0; }
  }
  if(p.onGround || p.hitWall) p.leap = false;
  if(p.onGround || p.hitWall){ if(p.flyArc && p.onGround){ fx('dust', p.x + 6, p.y + p.h); fx('dust', p.x + 6, p.y + p.h); } p.flyArc = false; p.flying = 0; }
  if(p.flyArc && Math.random() < 0.6) spawnFx('trail', p.x + 6 - p.vx * 0.02, p.y + 9, p.color);
  // trampolines, cannons, trapezes, balloons
  for(const e of G.ents){
    if(e.k === 'tramp' && p.vy > 0 && p.x + p.w > e.x + 2 && p.x < e.x + e.w - 2 && p.prevBottom <= e.y + 4 && p.y + p.h >= e.y){
      const sup = c.fire;
      p.y = e.y - p.h; p.vy = -(sup ? SUPER_V : TRAMP_V); p.springy = true; p.jumping = true; p.onGround = false; e.t = 0.3; p.chain = 0; p.flyArc = false;
      p.st.bounces++;
      if(sup){ sfx('super'); fx('text', e.x + 12, e.y - 12, 'SUPER BOUNCE!', '#ffd45e'); fx('sparkle', e.x + 12, e.y); }
      else { sfx('tramp'); if(!G.trampTip && !G.demo){ G.trampTip = true; fx('text', e.x + 12, e.y - 12, 'HOLD FIRE: SUPER!', '#9fe8d7'); } }
      fx('dust', e.x + 12, e.y);
    } else if(e.k === 'cannon' && e.st === 'idle' && p.grabCD <= 0 && !p.flyArc && overlap(p, e)){
      p.cannon = e; e.st = 'loaded'; e.t = 0; e.rider = p.slot; p.vx = 0; p.vy = 0; sfx('load');
    } else if(e.k === 'trapeze' && p.grabCD <= 0 && !p.onGround && Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 18 && p.y > e.y - 16 && p.y < e.y + 14){
      p.hang = e; e.riders++; p.hangT = 0; p.leap = false; p.flyArc = false; p.flying = 0; p.vx = 0; p.vy = 0; p.st.swings++; sfx('grab'); fx('sparkle', e.x + 10, e.y);
    } else if(e.k === 'balloon' && e.st === 'idle' && p.grabCD <= 0 && overlap(p, e)){
      p.ride = e; e.st = 'ride'; e.t = 0; e.rider = p.slot; p.st.balloons++; p.flyArc = false; p.flying = 0; p.vy = Math.min(p.vy, 0); sfx('balloon');
      fx('text', p.x + 6, p.y - 8, 'UP, UP!', '#ff9ec4');
    }
  }
  p.onRope = p.onGround && p.onRope;
  if(p.onGround){ p.chain = 0; if(!wasGround) p.squashT = 0.12; }
  p.lean = p.onRope ? p.lean + ((wf ? wf / 300 : 0) * 0.6 + p.vx / 300 - p.lean) * Math.min(1, dt * 4) : p.lean * 0.9;
  // crumbling pedestals
  if(p.onGround){
    const ty = Math.floor((p.y + p.h + 1) / T);
    for(let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++)
      if(tileAt(tx, ty) === 'c'){ const i = ty * G.W + tx; if(!G.crumbles.has(i)) G.crumbles.set(i, 0); }
  }
  touchTiles(p);
  // falling out of the world: Kids bounce back off the safety net
  if(p.y > LH + 12){
    if(D().pitBounce || G.demo || G.god){
      p.y = LH + 12; p.vy = -560; p.vx = (p.face || 1) * 90; p.springy = true; p.jumping = true; sfx('tramp'); G.pitBounces = (G.pitBounces || 0) + 1;
      fx('text', p.x + 6, LH - 30, 'BOING!', '#ffd45e');
    } else { p.st.falls++; kill(p, true); }
  }
}
function releaseAll(p){
  if(p.hang){ p.hang.riders = Math.max(0, p.hang.riders - 1); p.hang = null; }
  if(p.cannon){ p.cannon.st = 'idle'; p.cannon.rider = -1; p.cannon = null; }
  if(p.ride){ p.ride.st = 'away'; p.ride.t = 0; p.ride.rider = -1; p.ride = null; }
  p.flying = 0; p.flyArc = false;
}
function stepInCannon(p, c, dt){
  const e = p.cannon;
  p.x = e.x + 7; p.y = e.y - 4; p.vx = 0; p.vy = 0; p.onGround = false;
  e.t += 0;   // the cannon's own step counts its timer
  const auto = p.bot || G.diff === 'kids' ? 1.1 : 2.6;
  if((c.fireP && e.t > 0.25) || e.t > auto){
    const sh = cannonShot(e.tall ? 'k' : 'K');
    p.cannon = null; e.st = 'cool'; e.t = 0; e.rider = -1;
    p.x = e.x + 5 + sh.mx; p.y = e.y + 18 - 22 - p.h / 2; p.vx = sh.vx; p.vy = sh.vy; p.face = 1;
    p.flying = 0.45; p.flyArc = true; p.jumping = false; p.springy = false; p.grabCD = 0.3; p.onGround = false;
    p.st.flights++;
    sfx('cannon'); fx('smoke', e.x + 24, e.y - 2, 1); fx('confetti', e.x + 24, e.y - 4, undefined, 14); fx('shake', 0.2);
    fx('text', p.x + 6, p.y - 10, 'WHEEE!', '#ffd45e');
  }
}
function trapezeBar(e, t){
  const th = e.amp * Math.sin(t * 2.3 + e.ph);
  return { x: e.px + Math.sin(th) * e.len, y: e.py + Math.cos(th) * e.len, th };
}
function stepHang(p, c, dt){
  const e = p.hang;
  p.hangT = (p.hangT || 0) + dt;
  p.x = e.x + e.w / 2 - p.w / 2; p.y = e.y - 1; p.vx = e.vx; p.vy = e.vy; p.onGround = false; p.jumping = false;
  p.face = e.vx >= 0 ? 1 : -1;
  if(c.fireP){
    e.riders = Math.max(0, e.riders - 1); p.hang = null; p.grabCD = 0.35;
    // a helping push in the direction you hold (or forward): acrobats leap, they don't just drop
    const dir = c.left ? -1 : c.right ? 1 : (e.vx >= 0 ? 1 : -1);
    p.vx = clamp(e.vx * 1.1 + dir * 140, -260, 260); p.vy = Math.min(0, e.vy * 0.5) - 175; p.jumping = true; p.springy = true; p.face = dir; p.leap = true;
    sfx('swing'); fx('sparkle', p.x + 6, p.y);
  }
}
function stepRide(p, c, dt){
  const e = p.ride;
  const dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  if(dir) p.face = dir;
  p.vx += ((28 + dir * 62) - p.vx) * Math.min(1, dt * 3);
  const wf = windForce(p); if(wf) p.vx += wf * 0.5 * dt;
  p.vy = e.t < 5.2 ? -44 : 30;
  p.prevBottom = p.y + p.h;
  moveBody(p, dt);
  if(p.y < 30){ p.y = 30; p.vy = 0; }
  e.x = p.x + p.w / 2 - e.w / 2; e.y = p.y - 2;
  if(c.fireP || e.t > 6.2 || p.onGround && e.t > 0.6){
    p.ride = null; e.st = 'away'; e.t = 0; e.rider = -1; p.grabCD = 0.6;
    if(!p.onGround){ p.vy = c.fireP ? -200 : 0; p.jumping = true; }
    sfx('pop');
  }
  touchTiles(p);
}
function touchTiles(p){
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.01) / T);
  for(let ty = y0; ty <= y1; ty++) for(let tx = x0; tx <= x1; tx++){
    if(tileAt(tx, ty) === 'o'){ setTile(tx, ty, '.'); getToken(p, tx * T + 8, ty * T + 8); }
  }
}
function getToken(p, x, y){
  G.tokens++; p.st.tokens++; addScore(50);
  sfx('token'); fx('sparkle', x, y, '#ffe27a');
  if(G.tokens % 100 === 0){ if(hasLives()){ G.lives++; sfx('lifeUp'); fx('text', x, y - 10, '1UP', '#7dff8a'); } else addScore(1000, x, y - 10, '#7dff8a'); }
}
function bounce(p, v){
  const s = p.bot ? null : A.Input.get(p.source);
  const held = p.bot || (s && s.fire);
  p.vy = -(v || (held ? STOMP_HOLD : STOMP_V)); p.jumping = true; p.springy = false; p.onGround = false; p.flyArc = false; p.flying = 0;
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
  releaseAll(p);
  p.bubble = true; p.bubbleT = 0; p.vx = 0; p.vy = 0; p.cape = 0; p.slipT = 0;
  sfx('bubble');
}
function pop(p){
  p.bubble = false; p.inv = 1.5; p.vy = -170; p.vx = 0; p.onGround = false; p.jumping = false; p.hearts = D().hearts;
  sfx('pop'); fx('pop', p.x + p.w / 2, p.y + p.h / 2);
}
function hurt(p, soft){
  if(!active(p) || p.inv > 0 || p.cape > 0 || p.cannon) return;
  if(G.demo || G.god){ p.inv = 1; return; }
  p.st.hurts++;
  if(G.log) G.log.push('hurt lv' + G.lv + ' x' + Math.floor(p.x / T));
  p.hearts--;
  releaseAll(p);
  if(p.hearts > 0){ p.inv = 1.8; sfx('honk'); fx('poof', p.x + 6, p.y + p.h / 2); fx('text', p.x + 6, p.y - 6, 'HONK!', '#ff9a8a'); if(!soft){ p.vy = -220; p.onGround = false; p.jumping = false; } return; }
  kill(p, false);
}
function kill(p, fell){
  if(G.demo || G.god) return;
  if(G.log) G.log.push((fell ? 'fell' : 'ko') + ' lv' + G.lv + ' x' + Math.floor(p.x / T));
  releaseAll(p);
  if(G.players.length > 1){
    toBubble(p);
    if(fell){ p.x = G.cam.x + VW / 2 - 6; p.y = G.cam.y + 60; }
    fx('poof', p.x + 6, p.y + 8);
  } else {
    p.dead = 0.001; p.vy = -330; p.vx = 0; p.cape = 0;
    if(fell){ p.dead = 0.6; p.vy = 0; }
    sfx('die');
  }
}
function stepDone(p, dt){
  // standing on the podium, taking a bow
  if(G.podium && p.done === 1){ p.y = G.podium.y - p.h; p.vx = 0; p.vy = 0; p.onGround = true; }
}

/* A little autopilot: the title-screen demo acrobats (and the test harness) use it. */
function botControls(p){
  const c = { left: false, right: true, up: false, down: false, fire: false, fireP: false };
  const tick = () => { if(p.botHold > 0){ c.fire = true; p.botHold -= 1 / 60; } };
  if(p.cannon){ return c; }
  if(p.hang){
    // bars swing on a clock, so the bot can look ahead: let go only when the flight catches the next bar or lands ahead
    const e = p.hang;
    if(e.vx > 0 && predictFlight(p, e.x + e.w / 2 - p.w / 2, e.y - 1, clamp(e.vx * 1.1 + 140, -260, 260), Math.min(0, e.vy * 0.5) - 175, e) === 'ok') c.fireP = true;
    else if(p.hangT > 7) c.fireP = true;
    return c;
  }
  if(p.ride){ c.right = true; if(p.ride.t > 3.6 && !gapBelow(p)) c.fireP = true; return c; }
  const boss = G.ents.find(e => e.k === 'boss' && e.st !== 'defeat');
  if(boss) return botBoss(p, boss, c);
  const feet = p.y + p.h, fr = Math.floor((feet - 1) / T);
  const lookX = p.x + p.w + 5 + Math.max(0, p.vx) * 0.14;
  const tx = Math.floor(lookX / T);
  const wall = isSolid(tileAt(tx, fr)) || isSolid(tileAt(tx, fr - 1)) || isSolid(tileAt(tx, Math.floor(p.y / T)));
  let gap = true;
  for(let r = fr + 1; r < ROWS; r++){ const ch = tileAt(tx, r); if(isSolid(ch) || isOneWay(ch)){ gap = false; break; } }
  const foe = G.ents.some(e => e.on && (FOES.has(e.k) || e.k === 'pot') && e.st !== 'flip' && e.st !== 'flat' &&
    e.x + e.w > p.x - 2 && e.x - (p.x + p.w) < (e.k === 'barrel' ? 38 : e.k === 'ball' ? 34 : 26) && Math.abs((e.y + e.h) - feet) < 34);
  // hoops: walk up, then a quick hop through the middle
  const hoop = G.ents.find(e => e.k === 'hoop' && e.cx > p.x && e.cx - (p.x + p.w / 2) < 90);
  if(hoop && p.onGround){
    p.runT = 0;
    const dx = hoop.cx - (p.x + p.w / 2);
    if(dx < 22 && dx > 10){ c.fireP = true; p.botHold = 0; }
  }
  // trapezes: wait on the edge until the bar swings close, then jump for it
  const trap = G.ents.find(e => e.k === 'trapeze' && e.riders === 0 && e.px > p.x - 20 && e.px - p.x < 110);
  if(trap && gap && p.onGround){
    c.right = false; p.runT = 0;
    if(predictFlight(p, p.x, p.y, Math.max(40, p.vx), -(JUMP + Math.min(46, Math.abs(p.vx) * 0.26)), null) === 'ok'){ c.fireP = true; p.botHold = 0.6; c.right = true; }
  }
  // cannons and trampolines are fine to walk into; balloons too
  const cannon = G.ents.find(e => e.k === 'cannon' && e.x > p.x - 4 && e.x - p.x < 60);
  const tramp = G.ents.find(e => e.k === 'tramp' && e.x > p.x - 8 && e.x - p.x < 70);
  if(tramp){ c.fire = true; p.botHold = Math.max(p.botHold, 0.1); }
  // the podium: walk up and hop so we come down right in the middle
  const pd = G.podium, pgap = pd ? pd.x - (p.x + p.w) : 1e9;
  if(pgap < 70 && pgap > -30 && p.onGround){ p.runT = 0; if(pgap <= 22 && pgap >= 16){ c.fireP = true; p.botHold = 0.15; } else if(pgap < 16 && pgap > -30){ c.right = false; c.left = true; } }
  // walking bots wait for the very edge before leaping a gap (running ones use the look-ahead for a long jump)
  let edgeGap = true; const ex = Math.floor((p.x + p.w + 3) / T);
  for(let r = fr + 1; r < ROWS; r++){ const ch = tileAt(ex, r); if(isSolid(ch) || isOneWay(ch)){ edgeGap = false; break; } }
  const gapNow = gap && (Math.abs(p.vx) > 110 || edgeGap);
  const needJump = (wall || (gapNow && !cannon && !trap) || (foe && !hoop));
  // a gap with stepping stones (pedestals, planks) just ahead and a little higher: a short hop, not a long leap
  let stones = false;
  if(gap) for(let dx = 1; dx <= 2 && !stones; dx++) for(let r = fr - 2; r <= fr; r++){ const ch = tileAt(tx + dx, r); if((isSolid(ch) || isOneWay(ch)) && !isSolid(tileAt(tx + dx, r - 1))){ stones = true; break; } }
  if(p.onGround && needJump && c.right && !(cannon && cannon.st !== 'loaded' && gap)){ p.botHold = stones && !wall ? 0.22 : 0.36 + ((p.slot * 7 + Math.floor(G.lvT)) % 3) * 0.04; c.fireP = true; if(stones) p.runT = 0; }
  if(cannon && cannon.st !== 'idle' && gap && p.onGround){ c.right = false; }
  tick();
  if(p.x > (p.botBest || 0) + 3){ p.botBest = p.x; p.botStuck = 0; } else p.botStuck = (p.botStuck || 0) + 1 / 60;
  if(trap && gap) p.botStuck = 0;
  if(trap && gap && p.onGround && !c.fireP) return c;
  if(p.botStuck > 1.4 && p.botStuck < 1.7){ c.right = false; c.left = true; }
  else if(p.botStuck >= 1.7 && p.onGround){ c.fireP = true; c.fire = true; p.botHold = 0.45; p.botStuck = 0.8; }
  return c;
}
/* Where does a leap from (x, y) with this velocity end up? 'ok' = catches a trapeze ahead or lands on solid ground ahead. */
function predictFlight(p, x, y, vx, vy, from){
  const bars = G.ents.filter(q => q.k === 'trapeze' && q !== from && (!from || q.px > from.px - 4) && q.riders === 0);
  const x0 = x, max = p.runT > 0.45 ? RUN : WALK;
  for(let k = 1; k < 100; k++){
    const dt = 1 / 60;
    vy = Math.min(MAX_FALL, vy + (vy < 0 ? G_HOLD : G_FALL) * dt);
    if(vx < max) vx = Math.min(max, vx + AIR_ACC * dt); else if(!from) vx = Math.max(max, vx - 60 * dt);
    const prevFeet = y + p.h;
    x += vx * dt; y += vy * dt;
    if(k > 6) for(const q of bars){
      const b = trapezeBar(q, q.t + k * dt);
      if(Math.abs(x + p.w / 2 - b.x) < 12 && y > b.y - 10 && y < b.y + 8) return 'ok';
    }
    if(vy > 0){
      const feet = y + p.h, ty = Math.floor(feet / T);
      if(ty < ROWS) for(const tx of [Math.floor((x + 5) / T), Math.floor((x + p.w - 5) / T)]){
        const ch = tileAt(tx, ty);
        if((isSolid(ch) || isOneWay(ch)) && prevFeet <= ty * T + 1) return x > x0 + 20 && (!from || x > from.px + 20) ? 'ok' : 'back';
      }
      const wx = Math.floor((x + p.w) / T), wy = Math.floor((y + p.h - 3) / T);
      if(wy >= Math.floor(prevFeet / T) && isSolid(tileAt(wx, wy)) && prevFeet > wy * T + 1) return 'wall';
    }
    if(y > LH) return 'fall';
  }
  return 'fall';
}
function gapBelow(p){
  const tx = Math.floor((p.x + p.w / 2) / T);
  for(let r = Math.floor((p.y + p.h) / T); r < ROWS; r++){ const ch = tileAt(tx, r); if(isSolid(ch) || isOneWay(ch)) return false; }
  return true;
}
function botBoss(p, boss, c){
  const bx = boss.x + boss.w / 2, dx = bx - (p.x + p.w / 2), open = bossOpen(boss);
  c.right = false; c.left = false;
  const L = T * 2 + 4, R = G.W * T - T * 3;
  if(open){ c.right = dx > 4; c.left = dx < -4; if(Math.abs(dx) < 50) p.runT = 0; if(p.onGround && Math.abs(dx) < 26){ c.fireP = true; p.botHold = boss.bw === 2 ? 0.45 : 0.25; } }
  else {
    const away = dx > 0 ? -1 : 1, ad = Math.abs(dx);
    if(ad < 64){ c.right = away > 0; c.left = away < 0; }
    else if(ad > 120 && boss.bw !== 0){ c.right = away < 0; c.left = away > 0; p.runT = 0; }
    if(p.x < L){ c.left = false; c.right = true; } if(p.x > R){ c.right = false; c.left = true; }
    // hop over anything rolling at us
    const threat = G.ents.some(e => SHOTS.has(e.k) && Math.abs(e.x + e.w / 2 - (p.x + p.w / 2)) < 36 && e.y + e.h > p.y - 30);
    if(p.onGround && (threat || (Math.abs(dx) < 50 && boss.st !== 'dizzy' && boss.bw !== 2))){ c.fireP = true; p.botHold = 0.4; }
  }
  if(p.botHold > 0){ c.fire = true; p.botHold -= 1 / 60; }
  return c;
}

/* ---------- Crates ---------- */
function bumpTile(tx, ty, p){
  const ch = tileAt(tx, ty), x = tx * T + 8, y = ty * T;
  if(ch === '?'){ setTile(tx, ty, 'U'); fx('token', x, y - 6); getToken(p, x, y - 8); addScore(100); }
  else if(ch === 'c'){ const i = ty * G.W + tx; if(!G.crumbles.has(i)) G.crumbles.set(i, 0.3); sfx('bump'); return; }
  else if(ch === 'M'){
    setTile(tx, ty, 'U');
    const k = G.players.some(q => active(q) && q.hearts < D().hearts) ? 'pop' : (Math.floor(tx * 0.37) % 3 === 0 ? 'ticket' : 'cape');
    mkEnt(k, tx * T + 2, y, { on: true, st: 'rise', t: 0, face: 1 }); sfx('sprout');
  } else { sfx('bump'); return; }
  fx('bump', ty * G.W + tx, 0);
  if(tileAt(tx, ty - 1) === 'o'){ setTile(tx, ty - 1, '.'); getToken(p, x, y - 8); }
  for(const e of G.ents){
    if(e.dead || e.x + e.w <= tx * T || e.x >= tx * T + T || Math.abs(e.y + e.h - y) > 3) continue;
    if(e.k === 'monkey' && e.st !== 'flip') knockMonkey(e, p, e.x + e.w / 2 < x ? -1 : 1);
    else if(ITEMS.has(e.k) && e.st !== 'rise'){ e.vy = -240; e.face = e.x + e.w / 2 < x ? -1 : 1; }
  }
}
function stepCrumbles(dt){
  for(const [i, t] of G.crumbles){
    const nt = t + dt;
    if(nt > 0.6){
      G.crumbles.delete(i);
      const tx = i % G.W, ty = Math.floor(i / G.W);
      setTile(tx, ty, '.'); fx('chunk', tx * T + 8, ty * T + 8, G.act.ped[0]); sfx('crumble');
      G.regrow.push({ i, t: 3.5 });
    } else G.crumbles.set(i, nt);
  }
  for(const g of G.regrow){
    g.t -= dt;
    if(g.t > 0) continue;
    const tx = g.i % G.W, ty = Math.floor(g.i / G.W), box = { x: tx * T, y: ty * T, w: T, h: T };
    if(G.players.some(p => overlap(p, box))){ g.t = 0.3; continue; }
    setTile(tx, ty, 'c'); fx('sparkle', tx * T + 8, ty * T + 4, '#fff6b0'); g.done = 1;
  }
  G.regrow = G.regrow.filter(g => !g.done);
}

/* ---------- Enemies, props and items ---------- */
function knockMonkey(e, p, dir){
  e.st = 'flip'; e.vy = -230; e.vx = (dir || 1) * 50; e.t = 0;
  const n = p ? CHAIN[Math.min(CHAIN.length - 1, p.chain || 0)] : 100;
  addScore(n, e.x + e.w / 2, e.y - 4, '#fff');
  if(p) p.st.stomps++;
  sfx('stomp');
}
function walkerAI(e, dt, speed){
  e.vx = e.face * speed * D().enemy;
  e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt);
  moveBody(e, dt);
  if(e.hitWall) e.face = -e.hitWall;
  if(e.onGround){
    const ax = e.face > 0 ? e.x + e.w + 1 : e.x - 1, tx = Math.floor(ax / T), ty = Math.floor((e.y + e.h + 1) / T);
    const ch = tileAt(tx, ty);
    if(!isSolid(ch) && !isOneWay(ch)) e.face = -e.face;
  }
}
function nearestPlayer(x){
  let best = null, bd = 1e9;
  for(const p of G.players) if(active(p) || p.cannon || p.hang || p.ride){ const d = Math.abs(p.x - x); if(d < bd){ bd = d; best = p; } }
  return best;
}
const onScreen = (e, pad) => e.x + e.w > G.cam.x - (pad || 0) && e.x < G.cam.x + VW + (pad || 0);
function stepEnt(e, dt){
  if(!e.on){ if(e.x < G.cam.x + VW + 40) e.on = true; else return; }
  e.t += dt;
  if(FOES.has(e.k) && e.st === 'flip'){ e.vy += G_FALL * dt; e.x += e.vx * dt; e.y += e.vy * dt; if(e.y > LH + 40) e.dead = 1; return; }
  if(FOES.has(e.k) && e.x + e.w < G.cam.x - 160){ e.dead = 1; return; }
  if(FOES.has(e.k) && e.x > G.cam.x + VW + 120) return;
  switch(e.k){
    case 'monkey':
      if(e.st === 'flat'){ if(e.t > 0.5) e.dead = 1; return; }
      walkerAI(e, dt, 32); break;
    case 'barrel':
      e.vx = e.face * 72 * D().enemy; e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt); moveBody(e, dt);
      if(e.hitWall){ e.face = -e.hitWall; }
      e.rot = (e.rot || 0) + e.vx * dt / 7;
      if(e.y > LH + 20 || e.t > 14) e.dead = 1;
      break;
    case 'ball': {
      const k = D().ball;
      e.vx = e.face * 30 * k; e.vy = Math.min(MAX_FALL, e.vy + 1000 * k * k * dt); moveBody(e, dt);
      if(e.hitWall) e.face = -e.hitWall;
      if(e.onGround){ e.vy = -300 * k; e.sq = 0.12; }
      if(e.sq > 0) e.sq -= dt;
      if(e.y > LH + 20) e.dead = 1;
      break;
    }
    case 'wagon':
      if(!onScreen(e, 30) || G.state !== 'play') break;
      e.t2 = (e.t2 || 0) - dt;
      if(e.t2 <= 0 && G.ents.filter(q => q.k === 'barrel' && q.from === e.id && !q.dead).length < 2){
        e.t2 = 2.8 / D().enemy; e.kick = 0.3;
        mkEnt('barrel', e.x - 10, e.y + e.h - 14, { st: 'roll', face: -1, on: true, from: e.id }); sfx('poomf');
      }
      if(e.kick > 0) e.kick -= dt;
      break;
    case 'hoop':
      if(e.swing){ e.cx = e.bx + Math.sin(e.t * 0.9) * 36; e.x = e.cx - 5; }
      break;
    case 'tramp': if(e.t > 0.3) e.t = 0.3; break;
    case 'cannon': if(e.st === 'cool' && e.t > 0.7){ e.st = 'idle'; e.t = 0; } break;
    case 'trapeze': {
      const b = trapezeBar(e, e.t), nx = b.x - e.w / 2, ny = b.y;
      e.vx = (nx - e.x) / dt; e.vy = (ny - e.y) / dt; e.x = nx; e.y = ny; e.th = b.th;
      if(e.vx > 0 && e.th > -0.05 && e.th - e.vx * dt / e.len < -0.05 && e.riders && Math.random() < 0.5) sfx('swing');
      break;
    }
    case 'balloon':
      if(e.st === 'idle') e.y = e.hy + Math.sin(e.t * 2 + e.hx) * 2;
      else if(e.st === 'away'){ e.y -= 60 * dt; e.x += 10 * dt; if(e.t > 4.5){ e.st = 'idle'; e.x = e.hx; e.y = e.hy; e.t = 0; fx('sparkle', e.hx + 7, e.hy); } }
      break;
    case 'bell':
      if(!e.st) for(const p of G.players) if((active(p) || p.ride || p.hang) && overlap(p, e)){ ringBell(e, p); break; }
      break;
    case 'check':
      if(e.st !== 'got') for(const p of G.players) if(active(p) && overlap(p, e)){
        e.st = 'got'; G.check = e.x; sfx('flag'); fx('confetti', e.x + 8, e.y + 6, undefined, 16);
        addScore(500, e.x + 8, e.y - 6, '#7dff8a'); break;
      }
      break;
    case 'tent':
      e.st = G.def.bonus ? '' : G.back && G.back.used ? 'used' : G.bells >= G.bellsMax ? 'open' : '';
      if(e.st === 'open') for(const p of G.players) if(active(p) && p.onGround && Math.abs(p.x + p.w / 2 - (e.x + e.w / 2)) < 8 && overlap(p, e)){ enterBonus(); return; }
      break;
    case 'pop': case 'ticket': case 'cape':
      if(e.st === 'rise'){ e.y -= 32 * dt; if(e.t > 0.5){ e.st = 'go'; e.vx = 0; e.vy = 0; } break; }
      e.vx = e.face * (e.k === 'cape' ? 70 : 50);
      e.vy = Math.min(MAX_FALL, e.vy + (e.k === 'cape' ? 900 : G_FALL) * dt);
      moveBody(e, dt);
      if(e.hitWall) e.face = -e.hitWall;
      if(e.k === 'cape' && e.onGround) e.vy = -280;
      if(e.y > LH + 20) e.dead = 1;
      break;
    case 'boss': stepBoss(e, dt); break;
    case 'roar':
      e.x += e.vx * dt; if(e.x < T || e.x > G.W * T - T - e.w || e.t > 4) e.dead = 1; break;
    case 'fhoop':
      e.x += e.vx * dt; e.rot = (e.rot || 0) + e.vx * dt / 8; if(e.x < T || e.x > G.W * T - T - e.w || e.t > 5) e.dead = 1; break;
    case 'cball':
      e.vy += 900 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if(e.x < T + 1){ e.x = T + 1; e.vx = Math.abs(e.vx); } if(e.x > G.W * T - T - e.w - 1){ e.x = G.W * T - T - e.w - 1; e.vx = -Math.abs(e.vx); }
      if(e.y + e.h >= GROUND){ e.y = GROUND - e.h; e.bn = (e.bn || 0) + 1; e.vy = -Math.abs(e.vy) * 0.62; sfx('poomf'); if(e.bn > 1){ e.dead = 1; fx('confetti', e.x + 6, e.y + 6, undefined, 14); } }
      break;
    case 'pie': case 'chicken': case 'banana': stepProp(e, dt); break;
  }
  if(FOES.has(e.k) && e.y > LH + 30) e.dead = 1;
}
function stepProp(e, dt){
  if(e.st === 'lie'){ if(e.t > 5){ e.dead = 1; fx('poof', e.x + 6, e.y + 3); } return; }
  e.vy += 700 * D().props * dt; e.x += e.vx * dt; e.y += e.vy * dt;
  e.x = clamp(e.x, T + 1, G.W * T - T - e.w - 1);
  if(e.y + e.h >= GROUND){
    e.y = GROUND - e.h;
    if(e.k === 'pie'){ e.dead = 1; fx('cream', e.x + 6, e.y + 4); sfx('splat'); }
    else if(e.k === 'banana'){ e.st = 'lie'; e.t = 0; e.vx = 0; e.vy = 0; }
    else { e.bn = (e.bn || 0) + 1; e.vy = -260; const p = nearestPlayer(e.x); e.vx = (p && p.x < e.x ? -1 : 1) * 70 * D().props; sfx('squawk'); if(e.bn > 3){ e.dead = 1; fx('poof', e.x + 6, e.y + 5); } }
  }
}
function ringBell(e, p){
  e.st = 'rung'; e.t = 0;
  G.bellMask |= 1 << (e.bi || 0);
  G.bells = popcount(G.bellMask);
  p.st.bells++;
  addScore(1000, e.x + 6, e.y - 6, '#ffd45e'); sfx('bell'); fx('sparkle', e.x + 6, e.y + 6, '#ffe27a'); fx('confetti', e.x + 6, e.y + 6, undefined, 18);
  fx('big', e.x + 6, e.y - 14, G.bells >= G.bellsMax ? 'BONUS TENT OPEN!' : 'BELL ' + G.bells + '/' + G.bellsMax, '#ffd45e');
  const act = G.def.act, saved = A.Store.get('bigtop.bells', {});
  saved[act] = (saved[act] | 0) | G.bellMask; A.Store.set('bigtop.bells', saved);
}
function popcount(n){ let c = 0; while(n){ c += n & 1; n >>= 1; } return c; }
function enemyBumps(){
  const list = G.ents.filter(e => e.on && !e.dead && e.k === 'monkey' && e.st === 'walk' && onScreen(e, 40));
  for(let i = 0; i < list.length; i++) for(let j = i + 1; j < list.length; j++){
    const a = list[i], b = list[j];
    if(!overlap(a, b)) continue;
    if(a.x < b.x){ a.face = -1; b.face = 1; } else { a.face = 1; b.face = -1; }
  }
}
function hoopCheck(e, p){
  const pcx = p.x + p.w / 2, pcy = p.y + p.h / 2;
  const prev = e.side ? e.side[p.slot] : undefined;
  const side = pcx < e.cx ? -1 : 1;
  if(!e.side) e.side = [];
  e.side[p.slot] = side;
  // the rim: top and bottom of the ring (seen from the side)
  const inX = p.x + p.w > e.cx - 4 && p.x < e.cx + 4;
  if(inX){
    const topBand = p.y < e.cy - e.ry + 3 && p.y + p.h > e.cy - e.ry - 3;
    const botBand = p.y < e.cy + e.ry + 3 && p.y + p.h > e.cy + e.ry - 3;
    if((topBand || botBand) && e.fire){
      if(D().fireSafe || G.demo || G.god){ if(!e.warm || G.time - e.warm > 0.6){ e.warm = G.time; fx('text', e.cx, e.cy - e.ry - 8, 'WARM!', '#ffb36b'); } }
      else if(p.inv <= 0 && p.cape <= 0) hurt(p);
    }
  }
  if(prev !== undefined && prev !== side && Math.abs(pcy - e.cy) < e.ry - 4 && p.y > e.cy - e.ry + 1 && p.y + p.h < e.cy + e.ry - 1){
    if(!e.done) e.done = {};
    if(!e.done[p.slot]){
      e.done[p.slot] = 1; p.st.hoops++;
      const n = e.fire ? 500 : 200;
      addScore(n, e.cx, e.cy - e.ry - 6, '#ffd45e'); fx('big', e.cx, e.cy - e.ry - 16, e.fire ? 'RING OF FIRE!' : 'HOOP!', e.fire ? '#ff9a3d' : '#ffd45e');
      sfx(e.fire ? 'fire' : 'hoop'); fx('sparkle', e.cx, e.cy, e.fire ? '#ffb36b' : '#fff6b0');
    }
  }
}
function interact(){
  const act = G.players.filter(active);
  for(const e of G.ents){
    if(e.dead || !e.on) continue;
    if(e.k === 'hoop'){ for(const p of act) hoopCheck(e, p); continue; }
    for(const p of act){
      if(!active(p) || !overlap(p, e)) continue;
      if(ITEMS.has(e.k)){ if(e.st !== 'rise') collect(e, p); break; }
      if(e.k === 'boss'){ bossContact(e, p); continue; }
      if(e.k === 'pot'){
        if(p.cape > 0) continue;
        if(D().fireSafe || G.demo || G.god){ if(p.vy >= -100 && p.prevBottom <= e.y + 6){ p.vy = -340; p.springy = true; p.jumping = true; p.onGround = false; sfx('boing'); fx('text', p.x + 6, p.y - 4, 'HOT FEET!', '#ffb36b'); } }
        else if(p.y + p.h > e.y + 2) hurt(p);
        continue;
      }
      if(e.k === 'banana'){ if(e.st === 'lie' && p.onGround && p.slipT <= 0){ p.slipT = 0.7; p.vx = (p.face || 1) * 230; e.dead = 1; sfx('slip'); fx('text', p.x + 6, p.y - 8, 'WHOA!', '#ffe27a'); } continue; }
      if(SHOTS.has(e.k)){
        if(p.cape > 0) continue;
        if((e.k === 'cball' || e.k === 'chicken') && p.vy > 0 && p.prevBottom <= e.y + 6){ e.dead = 1; bounce(p, 330); fx('confetti', e.x + 6, e.y + 6, undefined, 12); sfx('pop'); addScore(200, e.x + 6, e.y - 4); continue; }
        if((e.k === 'roar' || e.k === 'fhoop') && D().fireSafe && e.k === 'fhoop'){ continue; }
        if(e.k === 'pie'){ e.dead = 1; fx('cream', p.x + 6, p.y + 4); sfx('splat'); }
        hurt(p); continue;
      }
      if(!FOES.has(e.k) || e.st === 'flip' || e.st === 'flat') continue;
      if(p.cape > 0){ if(e.k === 'monkey') knockMonkey(e, p, p.x < e.x ? 1 : -1); else { addScore(200, e.x + 6, e.y - 4); fx('poof', e.x + 7, e.y + 7); e.dead = 1; sfx('stomp'); } continue; }
      const stompy = p.vy > 0 && p.prevBottom <= e.y + Math.max(5, e.h * 0.55);
      if(stompy){
        if(e.k === 'monkey'){ stompMonkey(e, p); bounce(p); }
        else if(e.k === 'barrel'){ const n = CHAIN[Math.min(CHAIN.length - 1, p.chain)]; p.chain++; addScore(n, e.x + 7, e.y - 4); bounce(p, 330); sfx('boing'); p.st.stomps++; }
        else if(e.k === 'ball'){ p.y = e.y - p.h; bounce(p, 440); p.springy = true; e.sq = 0.2; sfx('tramp'); p.st.bounces++; fx('text', e.x + 8, e.y - 6, 'BOING!', '#ff9ec4'); }
      } else hurt(p);
    }
  }
  // friends can bounce on each other's heads
  for(const a of act) for(const b of act){
    if(a === b || a.vy <= 0 || a.prevBottom > b.y + 3 || !overlap(a, b)) continue;
    a.y = b.y - a.h; bounce(a, a.bot ? 300 : undefined); b.squashT = 0.2; sfx('boing');
  }
  // the podium: land on top to finish (the middle is worth the most)
  const pd = G.podium;
  if(pd) for(const p of act){
    if(p.vy >= 0 && p.prevBottom <= pd.y + 4 && p.y + p.h >= pd.y && p.x + p.w > pd.x + 2 && p.x < pd.x + pd.w - 2){
      const off = Math.abs(p.x + p.w / 2 - (pd.x + pd.w / 2));
      const perfect = off < 5 && !p.onGroundBefore;
      const bonus = perfect ? 5000 : off < 10 ? 2000 : 800;
      p.y = pd.y - p.h; p.vy = 0; p.vx = 0; p.done = 1; p.pose = 99; p.bonus = bonus; p.onGround = true; releaseAll(p);
      addScore(bonus, pd.x + pd.w / 2, pd.y - 30, bonus >= 5000 ? '#ffd45e' : '#fff');
      fx('big', pd.x + pd.w / 2, pd.y - 44, perfect ? 'PERFECT LANDING!' : 'TA-DA!', perfect ? '#ffd45e' : p.color);
      fx('confetti', pd.x + pd.w / 2, pd.y - 10, undefined, 30);
      sfx(perfect ? 'drumroll' : 'cheer');
      if(G.goalT < 0) G.goalT = 0;
    }
  }
}
function stompMonkey(e, p){
  const n = CHAIN[Math.min(CHAIN.length - 1, p.chain)];
  addScore(n, e.x + e.w / 2, e.y - 4, p.chain > 2 ? '#ffd45e' : '#fff');
  p.chain++; p.st.stomps++;
  e.st = 'flat'; e.t = 0; e.vx = 0;
  sfx('stomp'); fx('poof', e.x + e.w / 2, e.y + e.h / 2);
}
function collect(e, p){
  e.dead = 1;
  const x = e.x + 6, y = e.y;
  if(e.k === 'pop'){ if(p.hearts < D().hearts){ p.hearts++; fx('text', x, y, '+1 HEART', '#ff8fa0'); } else addScore(1000, x, y, '#ffd45e'); sfx('powerUp'); }
  else if(e.k === 'cape'){ p.cape = 9; sfx('powerUp'); addScore(1000, x, y, '#ffd45e'); fx('big', x, y - 10, 'STAR CAPE!', '#ffd45e'); }
  else if(e.k === 'ticket'){ if(hasLives()){ G.lives++; fx('text', x, y, '1UP', '#7dff8a'); } else addScore(2000, x, y, '#7dff8a'); sfx('lifeUp'); }
  fx('sparkle', x, y + 4);
}

/* ---------- Bosses: grumpy circus stars the Prankster tricked. Nobody gets hurt: they cheer up. ---------- */
function makeBoss(bw, bx, by){
  const hp = D().bossHp;
  const base = { bw, st: 'intro', hp, max: hp, inv: 0, face: -1, on: true, name: BOSS_NAMES[bw], n: 0 };
  if(bw === 0) return mkEnt('boss', bx - 12, by - 30, Object.assign(base, { w: 40, h: 30 }));
  if(bw === 1) return mkEnt('boss', VW + 10, by - 30, Object.assign(base, { w: 36, h: 30 }));
  return mkEnt('boss', VW * 0.55, -70, Object.assign(base, { w: 30, h: 20 }));
}
function bossOpen(e){
  if(e.inv > 0 || e.st === 'defeat' || e.st === 'intro' || e.st === 'stun') return false;
  return e.bw === 0 ? e.st === 'dizzy' : e.bw === 1 ? e.st === 'steam' : e.st === 'low';
}
function setBoss(e, st){ e.st = st; e.t = 0; }
function bossSay(i, bw){ const line = BOSS_LINES[bw === undefined ? 0 : bw][i]; if(!line || G.demo) return; G.say = line; G.sayN++; A.toast(line, 3200); }
function stepBoss(e, dt){
  if(e.inv > 0) e.inv -= dt;
  const L = T + 1, R = G.W * T - T - 1 - e.w, anger = e.max - e.hp;
  const tgt = nearestPlayer(e.x) || G.players[0];
  const tx = tgt ? tgt.x + tgt.w / 2 : VW / 2;
  const toward = tx < e.x + e.w / 2 ? -1 : 1;
  const spd = (1 + anger * 0.18) * (G.diff === 'kids' ? 0.78 : G.diff === 'pro' ? 1.15 : 1);
  if(e.st === 'defeat'){
    if(e.bw === 2){ e.vy = Math.min(40, e.vy + 60 * dt); e.y += e.vy * dt; e.x += Math.sin(e.t * 2) * 20 * dt; }
    else { e.x += e.face * 12 * dt; }
    if(Math.random() < 0.2) fx('sparkle', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#fff');
    if(e.t > 2.6){ e.dead = 1; bossDefeated(e); }
    return;
  }
  if(e.st === 'stun'){ if(e.t > 0.9) setBoss(e, e.bw === 0 ? 'prowl' : e.bw === 1 ? 'roll' : 'rise'); return; }
  if(e.bw === 0){
    // Leo the Lion: prowls, roars (ground waves to hop over), leaps with a shadow, then sits down dizzy
    if(e.st === 'intro'){ if(e.t > 0.2 && e.t - dt <= 0.2){ sfx('roar'); fx('shake', 0.4); bossSay(0, 0); } if(e.t > 1.6) setBoss(e, 'prowl'); return; }
    if(e.st === 'prowl'){ e.face = toward; e.x += e.face * 40 * spd * dt; if(e.t > 1.5){ e.n++; setBoss(e, e.n % 2 ? 'roar' : 'crouch'); } }
    else if(e.st === 'roar'){
      if(e.t > 0.55 && e.t - dt <= 0.55){
        sfx('roar'); fx('shake', 0.3);
        const gy = GROUND - 16;
        mkEnt('roar', e.x - 10, gy, { on: true, vx: -105 * spd, face: -1 });
        mkEnt('roar', e.x + e.w - 2, gy, { on: true, vx: 105 * spd, face: 1 });
        if(anger >= 2) mkEnt('fhoop', e.face > 0 ? e.x + e.w : e.x - 16, GROUND - 16, { on: true, vx: e.face * 95 * spd });
      }
      if(e.t > 1.4) setBoss(e, 'prowl');
    } else if(e.st === 'crouch'){ if(e.t > 0.6){ e.face = toward; const land = clamp(tx - e.w / 2, L, R); e.vx = (land - e.x) / 0.9; e.vy = -420; e.land = land; setBoss(e, 'leap'); } }
    else if(e.st === 'leap'){
      e.vy += 930 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if(e.y + e.h >= GROUND && e.vy > 0){ e.y = GROUND - e.h; e.vy = 0; fx('shake', 0.45); sfx('land'); fx('dust', e.x + e.w / 2, GROUND); fx('dust', e.x + 6, GROUND); setBoss(e, 'dizzy'); if(!e.saidDizzy){ e.saidDizzy = 1; bossSay(1, 0); } }
    } else if(e.st === 'dizzy'){ if(e.t > (G.diff === 'kids' ? 3.2 : G.diff === 'pro' ? 2.2 : 2.6)) setBoss(e, 'prowl'); }
    if(e.x < L){ e.x = L; e.face = 1; } if(e.x > R){ e.x = R; e.face = -1; }
  } else if(e.bw === 1){
    // Colonel Kaboom: a marching cannon. Rolls, aims, fires bouncy cannonballs, then overheats: stomp the lid
    if(e.st === 'intro'){ e.y = GROUND - e.h; e.x -= 70 * dt; if(e.x < VW * 0.62){ setBoss(e, 'roll'); bossSay(0, 1); sfx('poomf'); } return; }
    e.y = GROUND - e.h;
    if(e.st === 'roll'){ e.face = toward; const dir = e.t < 1 ? -toward : toward; e.x += dir * 55 * spd * dt; if(e.t > 2.0) setBoss(e, 'aim'); }
    else if(e.st === 'aim'){ e.face = toward; if(e.t > 0.6){ setBoss(e, 'fire'); e.shots = 0; } }
    else if(e.st === 'fire'){
      const n = G.diff === 'kids' ? 2 + Math.min(1, anger) : G.diff === 'pro' ? 3 + Math.min(2, anger) : 3 + Math.min(1, anger);
      if(e.shots < n && e.t > e.shots * 0.4){
        e.shots++; const p = G.players.filter(active)[e.shots % Math.max(1, G.players.filter(active).length)] || tgt;
        const dx = (p ? p.x + 6 : tx) - (e.x + e.w / 2);
        mkEnt('cball', e.x + e.w / 2 + e.face * 14 - 6, e.y - 4, { on: true, vx: clamp(dx / 1.05, -230, 230) * (G.diff === 'kids' ? 0.8 : 1), vy: -390 });
        sfx('cannon'); fx('smoke', e.x + e.w / 2 + e.face * 16, e.y, e.face); fx('shake', 0.15);
      }
      if(e.t > n * 0.4 + 0.7){ setBoss(e, 'steam'); sfx('steam'); if(!e.saidSteam){ e.saidSteam = 1; bossSay(1, 1); } }
    } else if(e.st === 'steam'){ if(Math.random() < 0.3) fx('smoke', e.x + e.w / 2, e.y, 0); if(e.t > (G.diff === 'kids' ? 3.6 : G.diff === 'pro' ? 2.4 : 2.9)) setBoss(e, 'roll'); }
    if(e.x < L){ e.x = L; } if(e.x > R){ e.x = R; }
  } else {
    // The Prankster: floats over in his balloon dropping trick props, then his balloon springs a leak and sinks low
    const high = 64, low = GROUND - 62;
    if(e.st === 'intro'){ e.y += (high - e.y) * Math.min(1, dt * 1.6); if(e.t > 0.5 && e.t - dt <= 0.5){ bossSay(0, 2); sfx('laugh'); } if(e.t > 2.0) setBoss(e, 'hover'); return; }
    e.face = toward;
    if(e.st === 'hover'){
      e.x += clamp(tx - e.w / 2 - e.x, -1, 1) * Math.min(Math.abs(tx - e.w / 2 - e.x), 62 * spd * dt);
      e.y = high + Math.sin(G.time * 2.2) * 5;
      const drops = 3 + Math.min(2, anger), every = 0.95 / Math.min(1.4, spd * D().props);
      if(e.t > 0.6 && Math.floor((e.t - 0.6) / every) !== Math.floor((e.t - 0.6 - dt) / every) && e.n < drops){
        const kinds = ['pie', 'chicken', 'banana'], k = kinds[(e.n + e.hp) % 3];
        mkEnt(k, e.x + e.w / 2 - 6, e.y + e.h, { on: true, vx: toward * 25, vy: 20 }); e.n++; sfx(k === 'chicken' ? 'squawk' : 'warn');
      }
      if(e.n >= drops && e.t > 0.6 + drops * every + 0.5){ e.n = 0; setBoss(e, 'leak'); sfx('steam'); if(!e.saidLeak){ e.saidLeak = 1; bossSay(1, 2); } }
    } else if(e.st === 'leak'){ e.x += Math.sin(e.t * 40) * 0.6; if(e.t > 0.8) setBoss(e, 'sink'); }
    else if(e.st === 'sink'){ e.y = Math.min(low, e.y + 120 * dt); e.x += clamp(tx - e.w / 2 - e.x, -1, 1) * 20 * dt; if(e.y >= low) setBoss(e, 'low'); }
    else if(e.st === 'low'){ e.y = low + Math.sin(G.time * 3) * 2; e.x += toward * 16 * dt; if(e.t > (G.diff === 'kids' ? 3.4 : 2.8)){ setBoss(e, 'rise'); sfx('laugh'); } }
    else if(e.st === 'rise'){ e.y -= 90 * dt; if(e.y <= high){ e.y = high; setBoss(e, 'hover'); } }
    e.x = clamp(e.x, L + 6, R - 6);
  }
}
function hitBoss(e, p){
  e.hp--; e.inv = 1.3;
  sfx('bossHit'); fx('shake', 0.3); fx('confetti', e.x + e.w / 2, e.y + 4, undefined, 16);
  addScore(1000, e.x + e.w / 2, e.y - 6, '#ffd45e');
  if(p) p.st.stomps++;
  if(e.hp <= 0){ setBoss(e, 'defeat'); e.vy = e.bw === 2 ? -40 : 0; sfx('boom'); for(let i = 0; i < 3; i++) fx('firework', e.x + Math.random() * e.w, e.y + Math.random() * e.h, CONFETTI[i]); G.ents.forEach(q => { if(SHOTS.has(q.k)) q.dead = 1; }); }
  else setBoss(e, 'stun');
}
function bossContact(e, p){
  if(e.st === 'defeat' || e.st === 'intro') return;
  const stompy = p.vy > 0 && p.prevBottom <= e.y + 10;
  if(e.bw === 2){
    // the Prankster never bumps you: bonk the basket when it's low (or from a super bounce while he floats)
    if(e.inv > 0) { if(stompy) bounce(p, 300); return; }
    if(bossOpen(e) || (p.vy < -60 && p.y > e.y) || (stompy && e.st !== 'stun')){ hitBoss(e, p); bounce(p, 360); return; }
    if(stompy) bounce(p, 300);
    return;
  }
  if(stompy){
    if(bossOpen(e)){ hitBoss(e, p); bounce(p, 380); p.chain++; return; }
    bounce(p, 300); if(e.inv <= 0 && e.st !== 'stun') hurt(p, true); return;
  }
  if(p.cape > 0){ if(e.inv <= 0) hitBoss(e, p); return; }
  if(e.st === 'stun' || e.inv > 0.9 || bossOpen(e)) return;
  hurt(p);
  if(active(p)) p.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1) * 140;
}
function bossDefeated(e){
  addScore(5000, e.x + e.w / 2, 80, '#ffd45e');
  for(const p of G.players) if(p.bubble) pop(p);
  bossSay(2, e.bw);
  if(G.goalT < 0) G.goalT = 0;
  sfx('win');
}

/* ---------- Wind (High Wire and parts of the Finale): calm, a warning, then a gust ---------- */
function stepWind(dt){
  const w = G.wind, cx = G.cam.x + VW / 2;
  w.on = w.zones.some(z => cx >= z[0] - VW / 2 && cx <= z[1] + VW / 2);
  if(!w.on){ w.ph = 0; w.t = 0; return; }
  w.t += dt;
  const len = [4.2, 1.0, 2.3][w.ph];
  if(w.t > len){
    w.t = 0; w.ph = (w.ph + 1) % 3;
    if(w.ph === 1){ w.n = (w.n || 0) + 1; w.dir = w.n % 3 === 0 ? 1 : -1; }
    if(w.ph === 2) sfx('whoosh');
  }
}

/* ---------- Camera: one screen for everyone ---------- */
function camera(dt, snap){
  const maxX = Math.max(0, G.W * T - VW);
  let list = G.players.filter(p => active(p) || p.cannon || p.hang || p.ride);
  if(!list.length) list = G.players.filter(p => p.done);
  if(!list.length) return;
  let lead = -1e9, trail = 1e9, sum = 0;
  for(const p of list){ const cx = p.x + p.w / 2; lead = Math.max(lead, cx); trail = Math.min(trail, cx); sum += cx; }
  const avg = sum / list.length;
  let target = list.length === 1 ? avg - VW * 0.42 : avg - VW * 0.5 + 20;
  target = Math.min(target, trail - 28);
  target = Math.max(target, lead - VW * 0.7);
  target = clamp(target, 0, maxX);
  G.cam.x = snap ? target : G.cam.x + (target - G.cam.x) * Math.min(1, dt * (list.some(p => p.flyArc) ? 9 : 6));
  G.cam.x = clamp(Math.max(G.cam.x, lead - VW * 0.8), 0, maxX);
  G.cam.y = LH - VH;
}
function clampPlayers(){
  for(const p of G.players){
    if(!active(p) || p.cannon) continue;
    if(p.x < G.cam.x){ p.x = G.cam.x; if(p.vx < 0) p.vx = 0; if(p.hang) releaseAll(p); if(rectSolid(p) && G.players.length > 1) toBubble(p); }
    if(p.x + p.w > G.cam.x + VW){ p.x = G.cam.x + VW - p.w; if(p.vx > 0) p.vx = 0; }
  }
}

/* ---------- Level flow ---------- */
function loadLevel(ix, mode){
  const L = buildLevel(ix);
  G.lv = ix; G.def = L.def; G.W = L.W; G.act = L.act; G.bumps = []; G.crumbles = new Map();
  G.ents = []; nextEnt = 1; G.podium = null; G.tent = null; G.regrow = []; G.goalT = -1; G.wipeT = 0; G.shake = 0;
  G.wind.zones = L.wind; G.wind.ph = 0; G.wind.t = 0;
  G.bellsMax = L.bells;
  if(mode === 'back'){
    const b = G.back;
    G.map = b.map; G.mods = b.mods; G.check = b.check; G.lvT = b.lvT;
    for(const e of L.ents) if(e.tx * T > b.x - VW || e.ch === 'N' || e.ch === 'P') spawnFromMap(e);
  } else {
    G.map = L.map.slice(); G.mods = [];
    if(!mode){ G.check = null; G.lvT = 0; G.levelScore = G.score; if(!L.def.bonus){ G.bellMask = 0; G.back = null; } }
    for(const e of L.ents) spawnFromMap(e);
  }
  let bi = 0; for(const e of G.ents) if(e.k === 'bell'){ e.bi = bi++; if(G.bellMask & (1 << e.bi)) e.st = 'rung'; }
  G.bells = popcount(G.bellMask || 0);
  G.loadN++; parts = [];
  const x0 = mode === 'back' ? G.back.x : mode !== 'bonus' && G.check !== null ? G.check + 2 : L.start.tx * T + 2;
  placePlayers(x0);
  if(L.def.bonus) G.bonusT = 12;
  camera(0, true);
}
function startIntro(short){
  A.Menu.close();
  G.state = 'intro'; G.stateT = 0; G.introLen = short ? 1.4 : 2.6;
  sfx('stageStart'); A.keepAwake();
}
function newGame(players){
  G.demo = false;
  G.roster = players.map(p => ({ slot: p.slot, source: p.source, name: p.name, color: p.color }));
  G.players = G.roster.map(r => makeHero(Object.assign({}, r)));
  G.players.forEach(p => { p.run = newStats(); });
  G.score = 0; G.tokens = 0; G.lives = D().lives; G.runT = 0; G.medalsWon = [];
  startAct(G.startAct);
}
function startAct(a){
  G.actT = 0; G.actScore = G.score;
  for(const p of G.players){ p.st = newStats(); if(!p.run) p.run = newStats(); }
  loadLevel(actFirst(a)); startIntro();
}
function startDemo(){
  G.demo = true;
  const pick = [0, 3, 4, 6].filter(i => LEVELS[i].act <= Math.max(1, G.unlocked));
  const ix = pick[Math.floor(Math.random() * pick.length)];
  G.players = [makeHero({ slot: 0, bot: true, name: 'Tumble', color: A.PLAYER_COLORS[0] }), makeHero({ slot: 1, bot: true, name: 'Twirl', color: A.PLAYER_COLORS[1] })];
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
    const p = makeHero({ slot, source: s.id, color: A.PLAYER_COLORS[slot], name, hearts: D().hearts });
    p.run = newStats();
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
  if(G.def.bonus){
    G.bonusT -= dt;
    if(G.bonusT <= 0){ leaveBonus(); return; }
  }
  if(G.goalT >= 0){
    G.goalT += dt;
    const left = G.players.some(p => active(p) || p.cannon || p.hang || p.ride);
    if(isBoss(G.lv) ? G.goalT > 3.4 : (G.goalT > 1.4 && (!left || G.goalT > 6))) startClear();
  }
}
function loseLife(){
  G.wipeT = 0;
  if(G.def.bonus){ leaveBonus(); return; }
  if(hasLives()) G.lives--;
  if(hasLives() && G.lives <= 0){ gameOver(); return; }
  for(const p of G.players) p.cape = 0;
  const boss = G.ents.find(e => e.k === 'boss');
  const keep = boss && G.diff === 'kids' ? boss.hp : 0;
  loadLevel(G.lv, 'check'); startIntro(true);
  if(keep){ const nb = G.ents.find(e => e.k === 'boss'); if(nb) nb.hp = Math.max(1, keep); }
}
/* The bonus tent: ring all 3 bells in an act and its flap opens. 12 seconds of stars and trampolines. */
function enterBonus(){
  if(G.back && G.back.used) return;
  G.back = { lv: G.lv, map: G.map.slice(), mods: G.mods.slice(), x: G.tent.x + G.tent.w + 6, check: G.check, lvT: G.lvT, used: false };
  sfx('fanfare'); fx('confetti', G.tent.x + 24, G.tent.y, undefined, 30);
  loadLevel(BONUS_LV, 'bonus'); startIntro(true);
}
function leaveBonus(){
  const b = G.back; if(!b) return;
  b.used = true;
  for(const p of G.players){ p.bubble = false; p.dead = 0; }
  loadLevel(b.lv, 'back'); startIntro(true);
}
function startClear(){
  G.state = 'clear'; G.stateT = 0; sfx('fanfare');
  for(const p of G.players) if(p.bubble) pop(p);
}
function afterClear(){
  const a = G.def.act;
  if(G.lv + 1 < LEVELS.length && LEVELS[G.lv + 1].act === a && !LEVELS[G.lv + 1].bonus){ nextLevel(); return; }
  results();
}
function nextLevel(){
  for(const p of G.players){ p.done = 0; p.bubble = false; }
  loadLevel(G.lv + 1); startIntro();
}
const AWARD_DEFS = [
  { title: 'Untouchable', stat: p => p.S.hurts + p.S.falls, low: true, min: 0, all: true },
  { title: 'Bell Ringer', stat: p => p.S.bells, all: true },
  { title: 'Star Catcher', stat: p => p.S.tokens, min: 5 },
  { title: 'Ring Leader', stat: p => p.S.hoops },
  { title: 'Human Cannonball', stat: p => p.S.flights },
  { title: 'Sky Swinger', stat: p => p.S.swings },
  { title: 'Bounce Boss', stat: p => p.S.bounces, min: 2 },
  { title: 'Monkey Business', stat: p => p.S.stomps, min: 2 },
  { title: 'Balloonist', stat: p => p.S.balloons }
];
function awardsHtml(which, time){
  const list = G.players.map(p => Object.assign({}, p, { S: which === 'run' ? p.run : p.st }));
  const res = A.Awards.pick(list, AWARD_DEFS, { max: 3 });
  const sum = k => list.reduce((n, p) => n + (p.S[k] || 0), 0);
  const team = 'Team · ' + sum('tokens') + ' stars · ' + sum('hoops') + ' hoops · ' + sum('bells') + ' bells' + (time ? ' · ' + fmt(time) : '');
  return A.Awards.html(res, team);
}
function results(){
  G.state = 'results'; G.stateT = 0;
  const a = G.def.act, t = r1(G.actT), stage = 'act' + (a + 1);
  for(const p of G.players){ if(!p.run) p.run = newStats(); for(const k in p.st) p.run[k] = (p.run[k] || 0) + p.st[k]; }
  G.runT = (G.runT || 0) + G.actT;
  G.unlocked = Math.max(G.unlocked, Math.min(ACTS.length - 1, a + 1)); A.Store.set('bigtop.unlocked', G.unlocked);
  const medal = medalFor(a, t, G.diff);
  const mr = A.Medals.award(GAME, stage, G.diff, medal);
  const rec = A.Celebrate.record(GAME, stage + '.' + G.diff, t, true);
  G.medalsWon.push(medal);
  const cols = G.players.map(p => p.color).concat(['#ffd45e', '#ffffff']);
  if(rec.isNew) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Act ' + (a + 1) + ' in ' + fmt(t) + (mr.improved ? ' · ' + A.Medals.label(medal) + ' medal!' : ''), colors: cols });
  else if(mr.improved) A.Celebrate.show({ title: A.Medals.label(medal).toUpperCase() + ' MEDAL!', sub: 'Act ' + (a + 1) + ' · ' + ACTS[a].name, colors: cols });
  else sfx('medal');
  const bestT = A.Store.get('best.' + GAME + '.' + stage + '.' + G.diff, null);
  G.lastResult = { act: a, t, medal, rec: rec.isNew };
  const last = a >= ACTS.length - 1;
  if(last){ ending(); return; }
  const next = ACTS[a + 1];
  const th = MEDAL_TIMES[a], k = G.diff === 'kids' ? 1.6 : 1;
  const medalLine = A.Medals.html(medal) + ' <b>' + A.Medals.label(medal) + ' medal</b> · time <b>' + fmt(t) + '</b>' + (rec.isNew ? ' · <b>new best!</b>' : bestT ? ' · best ' + fmt(bestT) : '') +
    (medal !== 'gold' ? '<br><small>Gold under ' + fmt(th.gold * k) + (medal === 'bronze' ? ', silver under ' + fmt(th.silver * k) : '') + '</small>' : '');
  const bellLine = G.bellsMax ? '<br>Bells rung <b>' + G.bells + '/' + G.bellsMax + '</b>' + (G.back && G.back.used ? ' · bonus tent visited!' : '') : '';
  const items = [
    { label: 'Next: Act ' + (a + 2) + ' · ' + next.name, select: () => { for(const p of G.players){ p.done = 0; p.bubble = false; } startAct(a + 1); } },
    { label: 'Play it again', select: () => { G.score = G.actScore; for(const p of G.players){ for(const k2 in p.st) p.run[k2] -= p.st[k2]; } G.runT -= G.actT; startAct(a); } },
    { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) }
  ];
  if(!hosting()) items.push({ label: 'Quit to title', select: toTitle });
  A.Menu.open({ center: true, shared: true, kicker: 'Act ' + (a + 1) + ' · ' + ACTS[a].name + ' · ' + D().label, title: 'Act ' + (a + 1) + ' clear!',
    text: medalLine + bellLine + '<br>' + awardsHtml('act', t) + '<br>Score <b>' + G.score.toLocaleString() + '</b>', items });
}
function ending(){
  A.Menu.close();
  G.state = 'ending'; G.stateT = 0; A.Store.set('bigtop.beaten', true);
  G.players.forEach((p, i) => { p.done = 0; p.bubble = false; p.dead = 0; p.x = VW / 2 - 40 + i * 24; p.y = GROUND - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.face = 1; p.pose = 99; releaseAll(p); });
  G.ents = [];
}
function endingMenu(){
  const rec = G.score > 0 ? A.Celebrate.record(GAME, 'score.' + G.diff, G.score, false) : { isNew: false };
  if(rec.isNew) A.Celebrate.show({ title: 'NEW BEST!', sub: 'Top score ' + G.score.toLocaleString(), colors: G.players.map(p => p.color).concat(['#ffd45e']) });
  const lr = G.lastResult || {};
  A.Menu.open({ center: true, shared: true, kicker: 'Big Top · ' + D().label, title: 'The Big Top is up!',
    text: 'The Prankster said sorry and helped raise the tent. Thanks for a wonderful show, acrobats!<br>' +
      (lr.medal ? 'Finale ' + A.Medals.html(lr.medal) + ' <b>' + A.Medals.label(lr.medal) + '</b> in ' + fmt(lr.t) + '<br>' : '') +
      awardsHtml('run', G.runT) + '<br>Team score <b>' + G.score.toLocaleString() + '</b>' + (rec.isNew ? ' · <b>new best!</b>' : ''),
    items: [
      { label: 'Play again from Act 1', select: () => { G.startAct = 0; newGame(G.roster); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function gameOver(){
  G.state = 'gameover'; G.stateT = 0; sfx('gameOver');
  A.Menu.open({ center: true, shared: true, kicker: 'Act ' + (G.def.act + 1) + ' · ' + G.def.name, title: 'The show must go on!',
    text: 'Out of lives, but no problem: pick up right where you were with fresh lives.',
    items: [
      { label: 'Keep going', select: () => { G.lives = D().lives; G.score = G.levelScore; loadLevel(G.lv); startIntro(); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  G.lvT += dt;
  if(!G.def.bonus && !G.demo && G.state === 'play') G.actT += dt;
  for(const e of G.ents) if(e.k === 'trapeze') stepEnt(e, dt);
  for(const p of G.players) stepPlayer(p, dt);
  for(const e of G.ents) if(!e.dead && e.k !== 'trapeze') stepEnt(e, dt);
  enemyBumps();
  interact();
  stepCrumbles(dt);
  stepWind(dt);
  camera(dt);
  clampPlayers();
  G.ents = G.ents.filter(e => !e.dead);
  if(G.demo){
    G.demoT += dt;
    if(G.players.some(p => p.done) || G.demoT > 55 || G.def.bonus) startDemo();
  }
}

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
const actLabel = a => 'Act ' + (a + 1) + ' · ' + ACTS[a].name;
function medalSuffix(a){ const m = A.Medals.get(GAME, 'act' + (a + 1)); return m ? ' · ' + A.Medals.label(m) : ''; }
function titleMenu(){
  G.state = 'title';
  A.Menu.open({ kicker: 'xRetro', title: 'BIG TOP',
    text: 'A prankster wind scattered the circus! Collect <b>star tokens</b>, leap through hoops, fly from cannons and swing on trapezes to raise the Big Top again. <b>1–4 acrobats</b> on one screen, or online.',
    items: [
      { label: 'Play', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Start at', value: () => actLabel(G.startAct) + medalSuffix(G.startAct), change: d => { G.startAct = (G.startAct + d + G.unlocked + 1) % (G.unlocked + 1); A.Store.set('bigtop.start', G.startAct); } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('bigtop.diff', G.diff); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: controllerLine() });
}
function controllerLine(){
  const n = A.Input.pads().length;
  const s = A.Medals.summary(GAME, 6);
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') +
    (s.won ? 'Medals: ' + s.won + '/6 acts. ' : '') + 'Kids mode: fire can’t hurt, safety nets, no game over.';
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + actLabel(G.startAct) + ' · ' + D().label,
    title: 'Who’s in the show?',
    text: online ? 'Friends join from any device with the code or invite link. Everyone presses FIRE to join, then FIRE again when ready.'
                 : 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 acrobats share one screen. More can drop in later by pressing FIRE.',
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
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart act', select: () => { G.score = G.actScore; startAct(Math.max(0, G.def.act)); } }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: G.def.bonus ? 'Bonus Tent' : actLabel(Math.max(0, G.def.act)), title: 'Paused', items, back: resume });
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
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. Up to 4 acrobats from any mix of devices.',
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
    Net.host(GAME, name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, GAME, name, netHandlers).then(() => {
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
  A.Menu.open({ center: true, kicker: 'How to play', title: 'Showtime!',
    text: '<b>Left / right</b> run (keep holding to sprint) · <b>A / Space / FIRE</b> jump, hold it to jump higher · <b>Down + FIRE</b> drops through a plank or rope.<br>' +
          'Jump <b>through hoops</b> for bonus points; fire hoops are hot on the rim, so aim for the middle. Bop <b>monkeys</b>, hop over <b>barrels</b> and bounce on <b>balls</b>.<br>' +
          '<b>Trampolines</b>: hold FIRE as you land for a SUPER BOUNCE. Walk into a <b>cannon</b>, then FIRE to launch. Jump to catch a <b>trapeze</b> and press FIRE to let go. Grab a <b>balloon cluster</b> to float up.<br>' +
          'Find the <b>3 hidden bells</b> in each act to open the <b>bonus tent</b>. Land in the middle of the <b>podium</b> for a PERFECT finish. Medals for fast acts! Kids mode: fire can’t hurt, safety nets, no game over.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0, modsSent = 0, lastLoadSent = -1, snapN = 0, forceFull = false, lastSayN = null;
const KINDS = ['monkey', 'barrel', 'wagon', 'ball', 'pot', 'hoop', 'tramp', 'cannon', 'trapeze', 'balloon', 'bell', 'spot', 'check', 'tent', 'podium',
  'pop', 'ticket', 'cape', 'boss', 'roar', 'fhoop', 'cball', 'pie', 'chicken', 'banana'];
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
    if(q.k !== 'boss' && q.k !== 'podium' && q.k !== 'tent' && (q.x + q.w < cx - 60 || q.x > cx + VW + 60)) continue;
    const row = [q.id, KI[q.k], r1(q.x), r1(q.y), q.face, q.st || '', r2(q.t)];
    if(q.k === 'boss') row.push([q.hp, q.max, r2(q.inv), q.bw]);
    else if(q.k === 'hoop') row.push([r1(q.cx), r1(q.cy), q.fire ? 1 : 0]);
    else if(q.k === 'trapeze') row.push([q.px, q.py, r2(q.th || 0)]);
    else if(q.k === 'cannon') row.push(q.tall ? 1 : 0);
    else if(q.k === 'barrel') row.push(r1(q.rot || 0));
    else if(q.k === 'spot') row.push(q.ph);
    e.push(row);
  }
  const w = G.wind;
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), lv: G.lv, ln: G.loadN, d: G.diff, dm: G.demo ? 1 : 0,
    sc: G.score, li: hasLives() ? G.lives : -1, tk: G.tokens, cx: r1(cx), gt: r2(G.goalT), lt: r1(G.lvT), at: r1(G.actT), il: G.introLen,
    bl: G.bells, bm: G.bellsMax, bt: r1(G.bonusT), wd: [w.on ? 1 : 0, w.ph, w.dir, r2(w.t)], sy: G.sayN, sx: G.say,
    p: G.players.map(p => [p.slot, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.face,
      (p.onGround ? 1 : 0) | (p.bubble ? 2 : 0) | (p.done ? 4 : 0) | (p.inv > 0 ? 8 : 0) | (p.away ? 16 : 0) | (p.skid ? 32 : 0) |
      (p.onRope ? 64 : 0) | (p.hang ? 128 : 0) | (p.cannon ? 256 : 0) | (p.ride ? 512 : 0) | (p.flyArc ? 1024 : 0) | (p.slipT > 0 ? 2048 : 0),
      p.hearts, r2(p.dead), r2(p.cape), p.name, p.color, p.source || '', p.st.tokens, r2(p.bubbleT), r2(p.squashT), r2(p.lean), r2(p.pose)]),
    e };
  if(G.loadN !== lastLoadSent){ lastLoadSent = G.loadN; modsSent = 0; s.mf = flatMods(G.mods); }
  else if(++snapN % 60 === 0 || forceFull){ s.mf = flatMods(G.mods); forceFull = false; }
  else if(G.mods.length > modsSent) s.md = [modsSent].concat(flatMods(G.mods.slice(modsSent)));
  modsSent = G.mods.length;
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  if(netFx.length){ s.fx = netFx; netFx = []; }
  Net.broadcast(s);
}
function guestLevel(lv){
  const L = buildLevel(lv);
  G.lv = lv; G.def = L.def; G.W = L.W; G.act = L.act; G.map = L.map.slice(); G.modsApplied = 0; G.bumps = [];
}
function receiveMeta(m){
  if(m.ln !== G.loadN || m.lv !== G.lv || !G.map){ G.loadN = m.ln; guestLevel(m.lv); parts = []; }
  const apply = (arr, from) => { for(let i = from; i + 1 < arr.length; i += 2) G.map[arr[i]] = arr[i + 1]; };
  if(m.mf){ G.map = buildLevel(m.lv).map.slice(); apply(m.mf, 0); G.modsApplied = m.mf.length / 2; }
  else if(m.md && m.md[0] === G.modsApplied){ apply(m.md, 1); G.modsApplied += (m.md.length - 1) / 2; }
  if(m.sy !== lastSayN){ if(lastSayN !== null && m.sx && !m.dm) A.toast(m.sx, 3200); lastSayN = m.sy; }
}
function guestFrame(dt){
  const smp = buf.sample(dt); if(!smp) return;
  const { a, b, t } = smp, s = b, L = (x, y) => x + (y - x) * t;
  if(!G.map || s.lv !== G.lv) guestLevel(s.lv);
  G.diff = s.d; G.demo = !!s.dm; G.state = s.st; G.stateT = s.sT; G.score = s.sc; G.lives = s.li < 0 ? Infinity : s.li; G.tokens = s.tk;
  G.goalT = s.gt; G.lvT = s.lt; G.actT = s.at; G.introLen = s.il || 2.4; G.bells = s.bl; G.bellsMax = s.bm; G.bonusT = s.bt;
  G.wind.on = !!s.wd[0]; G.wind.ph = s.wd[1]; G.wind.dir = s.wd[2]; G.wind.t = s.wd[3];
  G.cam.x = a.lv === b.lv && Math.abs(a.cx - b.cx) < 80 ? L(a.cx, b.cx) : b.cx; G.cam.y = LH - VH;
  const pp = new Map(a.p.map(q => [q[0], q]));
  G.players = s.p.map(q => {
    const o = pp.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60 && Math.abs(o[2] - q[2]) < 60;
    const f = q[6];
    return { slot: q[0], x: near ? L(o[1], q[1]) : q[1], y: near ? L(o[2], q[2]) : q[2], vx: q[3], vy: q[4], face: q[5],
      onGround: !!(f & 1), bubble: !!(f & 2), done: (f & 4) ? 1 : 0, inv: (f & 8) ? 1 : 0, away: !!(f & 16), skid: !!(f & 32),
      onRope: !!(f & 64), hang: (f & 128) ? {} : null, cannon: (f & 256) ? {} : null, ride: (f & 512) ? {} : null, flyArc: !!(f & 1024), slipT: (f & 2048) ? 1 : 0,
      hearts: q[7], dead: q[8], cape: q[9], name: q[10], color: q[11], source: q[12], st: { tokens: q[13] }, w: HERO_W, h: HERO_H,
      bubbleT: q[14], squashT: q[15], lean: q[16], pose: q[17] };
  });
  const pe = new Map(a.e.map(q => [q[0], q]));
  G.ents = s.e.map(q => {
    const o = pe.get(q[0]), near = o && Math.abs(o[2] - q[2]) < 48 && Math.abs(o[3] - q[3]) < 48;
    const k = KINDS[q[1]], sz = SIZES[k] || [12, 12];
    const e = { id: q[0], k, x: near ? L(o[2], q[2]) : q[2], y: near ? L(o[3], q[3]) : q[3], w: sz[0], h: sz[1], face: q[4], st: q[5], t: q[6], on: true };
    if(k === 'boss'){ const x = q[7]; e.hp = x[0]; e.max = x[1]; e.inv = x[2]; e.bw = x[3]; e.w = [40, 36, 30][e.bw]; e.h = [30, 30, 20][e.bw]; e.name = BOSS_NAMES[e.bw]; }
    else if(k === 'hoop'){ const x = q[7], ox = o && o[7]; e.cx = near && ox ? L(ox[0], x[0]) : x[0]; e.cy = x[1]; e.fire = !!x[2]; e.ry = 24; }
    else if(k === 'trapeze'){ const x = q[7]; e.px = x[0]; e.py = x[1]; e.th = x[2]; e.len = 70; }
    else if(k === 'cannon') e.tall = !!q[7];
    else if(k === 'barrel') e.rot = q[7];
    else if(k === 'spot') e.ph = q[7];
    return e;
  });
  G.podium = G.ents.find(e => e.k === 'podium') || null;
  G.tent = G.ents.find(e => e.k === 'tent') || null;
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
    else if(G.def.bonus) want = BONUS_THEME;
    else if(G.players.some(p => p.cape > 0 && !p.bubble && !p.done)) want = CAPE_THEME;
    else if(isBoss(G.lv)) want = boss && boss.st !== 'defeat' ? (G.def.boss === 2 ? PRANK_THEME : BOSS_THEME) : null;
    else want = G.act.music;
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
      for(const e of G.ents) if(e.k === 'trapeze' || e.k === 'balloon') stepEnt(e, dt);
      if(G.stateT >= G.introLen){ G.state = 'play'; G.stateT = 0; }
      break;
    case 'play':
      if(pausePressed){ pause(); return; }
      G.stateT += dt;
      dropIn(); sim(dt); flowChecks(dt);
      break;
    case 'clear':
      G.stateT += dt;
      for(const p of G.players){ if(p.pose < 50) p.pose = 99; }
      if(Math.floor(G.stateT * 2.5) !== Math.floor((G.stateT - dt) * 2.5) && G.stateT < 2.6){
        fx('firework', G.cam.x + 60 + Math.random() * (VW - 120), 40 + Math.random() * 50, CONFETTI[Math.floor(Math.random() * 5)]); sfx('firework');
      }
      if(G.stateT > 3.4) afterClear();
      break;
    case 'ending':
      G.stateT += dt;
      for(const p of G.players){ p.vy += G_FALL * dt; p.y += p.vy * dt; if(p.y + p.h >= GROUND){ p.y = GROUND - p.h; p.vy = 0; p.onGround = true; if(Math.random() < 0.02){ p.vy = -300; p.onGround = false; } } else p.onGround = false; }
      if(Math.floor(G.stateT * 1.6) !== Math.floor((G.stateT - dt) * 1.6)){ fx('firework', 40 + Math.random() * (VW - 80), 30 + Math.random() * 60, CONFETTI[Math.floor(Math.random() * 5)]); sfx('firework'); }
      if(G.stateT > 7 && !A.Menu.isOpen()) endingMenu();
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
  if(hex[0] !== '#') return hex;
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
const wrap = (v, span) => ((v % span) + span) % span;
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
function drawGround(c, ac, top, left, right, bottom, v){
  const g = ac.g, k = ac.key;
  c.fillStyle = g.fill; c.fillRect(0, 0, T, T);
  if(k === 'ring' || k === 'finale'){
    c.fillStyle = g.fillDk; c.beginPath(); c.moveTo(8, 3); c.lineTo(13, 8); c.lineTo(8, 13); c.lineTo(3, 8); c.fill();
    c.fillStyle = g.fillHi; c.fillRect(7.4, 4.5, 1.2, 1.2);
  } else if(k === 'cannon'){
    c.fillStyle = g.fillDk; c.fillRect(0, 0, 8, 8); c.fillRect(8, 8, 8, 8); c.fillStyle = g.fillHi; c.fillRect(1, 1, 6, 1); c.fillRect(9, 9, 6, 1);
  } else if(k === 'wire' || k === 'night'){
    c.fillStyle = g.speck; c.fillRect(0, 7.5, T, 1); c.fillRect(v % 2 ? 4 : 11, 0, 1, 7.5); c.fillRect(v % 2 ? 11 : 4, 8.5, 1, 7.5);
    c.fillStyle = g.fillHi; c.fillRect(0, 8.5, T, 0.8); if(v === 1){ c.fillStyle = 'rgba(255,240,200,.6)'; star5(c, 12, 12, 1.4, 0.6); c.fill(); }
  } else {
    c.fillStyle = g.speck; const pts = [[3, 9], [11, 5], [7, 13], [13, 12], [2, 3], [9, 9]];
    for(let i = 0; i < 3; i++){ const q = pts[(v + i * 2) % pts.length]; rr(c, q[0], q[1], 2.2, 1.6, 0.8); c.fill(); }
    c.fillStyle = g.fillHi; const q = pts[(v + 3) % pts.length]; c.fillRect(q[0] + 1, q[1] - 1, 1.4, 1);
  }
  if(left){ c.fillStyle = g.fillDk; c.fillRect(0, 0, 1.6, T); }
  if(right){ c.fillStyle = g.fillDk; c.fillRect(T - 1.6, 0, 1.6, T); }
  if(bottom){ c.fillStyle = g.fillDk; c.fillRect(0, T - 2, T, 2); }
  if(top){
    c.fillStyle = g.topDk; c.fillRect(0, 0, T, 6.5);
    c.fillStyle = g.top; c.fillRect(0, 0, T, 4.6);
    for(let i = 0; i < 4; i++){ circ(c, 2 + i * 4, 4.6, 2.1); c.fill(); }
    c.fillStyle = g.topHi; c.fillRect(0, 0.7, T, 1.1);
    if(k === 'parade' && v === 2){ c.fillStyle = '#fff'; circ(c, 6, 1.4, 1); c.fill(); c.fillStyle = '#ffd45e'; circ(c, 6, 1.4, 0.45); c.fill(); }
    if((k === 'ring' || k === 'finale') && v === 1){ c.fillStyle = '#fff'; circ(c, 10, 2, 0.8); c.fill(); }
    if(left){ c.fillStyle = g.topDk; c.fillRect(0, 0, 1.4, 6.5); }
    if(right){ c.fillStyle = g.topDk; c.fillRect(T - 1.4, 0, 1.4, 6.5); }
  }
}
function drawPedestal(c, ped, top, bottom, cracked){
  c.fillStyle = ped[0]; c.fillRect(1, 0, T - 2, T);
  c.fillStyle = ped[1]; for(let i = 0; i < 3; i++) c.fillRect(3 + i * 4.3, 0, 2, T);
  c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(T - 4, 0, 3, T);
  c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(1.6, 0, 1, T);
  if(top){ c.fillStyle = ped[2]; rr(c, 0, 0, T, 4, 1.5); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(1, 0.7, T - 2, 0.9); c.fillStyle = shade(ped[2], 0.7); c.fillRect(0, 3.2, T, 0.8); }
  if(bottom){ c.fillStyle = ped[2]; c.fillRect(0, T - 3, T, 3); c.fillStyle = shade(ped[2], 0.7); c.fillRect(0, T - 1, T, 1); }
  if(cracked){ c.strokeStyle = 'rgba(40,20,20,.7)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(4, 4); c.lineTo(7, 8); c.lineTo(5, 13); c.moveTo(7, 8); c.lineTo(12, 10); c.lineTo(11, 15); c.stroke(); }
}
function tileSprite(ch, tx, ty, frame){
  const ac = G.act, k = ac.key;
  if(ch === '#'){
    const top = tileAt(tx, ty - 1) !== '#', left = tileAt(tx - 1, ty) !== '#' && tx > 0, right = tileAt(tx + 1, ty) !== '#' && tx < G.W - 1, bottom = ty < ROWS - 1 && tileAt(tx, ty + 1) !== '#';
    const v = (tx * 7 + ty * 13) % 3;
    return sprite(k + '#' + (+top) + (+left) + (+right) + (+bottom) + v, c => drawGround(c, ac, top, left, right, bottom, v));
  }
  if(ch === 'X' || ch === 'c'){
    const top = tileAt(tx, ty - 1) !== ch, bottom = tileAt(tx, ty + 1) !== ch && !isSolid(tileAt(tx, ty + 1));
    return sprite(k + ch + (+top) + (+bottom), c => drawPedestal(c, ch === 'c' ? [shade(ac.ped[0], 1.15), shade(ac.ped[1], 0.95), '#d9b36a'] : ac.ped, top, bottom, ch === 'c'));
  }
  if(ch === '?') return sprite('crate' + frame, c => {
    c.fillStyle = '#7a4a24'; c.fillRect(0, 0, T, T); c.fillStyle = '#c27d44'; c.fillRect(1, 1, T - 2, T - 2);
    c.fillStyle = '#a4642f'; c.fillRect(1, 5, T - 2, 1); c.fillRect(1, 10, T - 2, 1);
    c.fillStyle = '#e3a866'; c.fillRect(1, 1, T - 2, 1);
    const glow = [0.8, 0.95, 1, 0.95][frame];
    c.fillStyle = 'rgba(255,212,94,' + glow + ')'; star5(c, 8, 8, 5, 2.2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; star5(c, 7.6, 7.4, 2, 0.9); c.fill();
  });
  if(ch === 'M') return sprite('gift' + frame, c => {
    c.fillStyle = '#9c2a4e'; c.fillRect(0, 0, T, T); c.fillStyle = '#ff5a8a'; c.fillRect(1, 1, T - 2, T - 2);
    c.fillStyle = '#ffd45e'; c.fillRect(6.5, 0, 3, T); c.fillRect(0, 6.5, T, 3);
    c.fillStyle = 'rgba(255,255,255,' + [0.25, 0.45, 0.6, 0.45][frame] + ')'; c.fillRect(1, 1, 5, 5);
    c.fillStyle = '#fff3b0'; ell(c, 5.5, 3, 2.5, 1.6, -0.5); c.fill(); ell(c, 10.5, 3, 2.5, 1.6, 0.5); c.fill();
  });
  if(ch === 'U') return sprite('used', c => { c.fillStyle = '#5a3f2a'; c.fillRect(0, 0, T, T); c.fillStyle = '#8a6a4a'; c.fillRect(1, 1, T - 2, T - 2); c.fillStyle = '#6f5238'; c.fillRect(1, 5, T - 2, 1); c.fillRect(1, 10, T - 2, 1); });
  if(ch === '=') return sprite(k + '=', c => {
    const p = ac.plank;
    c.fillStyle = p[1]; c.fillRect(0, 1, T, 6); c.fillStyle = p[0]; c.fillRect(0, 1, T, 4.2);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(0, 1.3, T, 0.8);
    c.fillStyle = p[2]; circ(c, 3, 4.5, 0.9); c.fill(); circ(c, 13, 4.5, 0.9); c.fill();
    c.fillStyle = p[1]; c.fillRect(7.5, 1, 1, 6);
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
      if(ch === '.' || ch === 'o' || ch === '~') continue;
      const sp = tileSprite(ch, tx, ty, frame); if(!sp) continue;
      const x0 = Math.round((tx * T - camX) * s), x1 = Math.round(((tx + 1) * T - camX) * s);
      let dy = 0, dx = 0;
      if(G.bumps.length){ const i = ty * G.W + tx; for(const b of G.bumps) if(b.i === i) dy = -Math.round(Math.sin(b.t / 0.2 * Math.PI) * 4 * s); }
      if(ch === 'c' && G.crumbles.size){ const t = G.crumbles.get(ty * G.W + tx); if(t !== undefined) dx = Math.round(Math.sin(t * 70) * s); }
      c.drawImage(sp, x0 + dx, y0 + dy, x1 - x0, y1 - y0);
    }
  }
}
/* tightropes: one springy line per run of rope, sagging under anyone standing on it */
function drawRopes(c, camX){
  const tx0 = Math.floor(camX / T) - 1, tx1 = Math.floor((camX + VW) / T) + 1;
  const riders = G.players.filter(p => p.onRope && !p.bubble);
  for(let ty = 0; ty < ROWS; ty++){
    let tx = tx0;
    while(tx <= tx1){
      if(tileAt(tx, ty) !== '~'){ tx++; continue; }
      let e = tx; while(tileAt(e + 1, ty) === '~') e++;
      const x0 = tx * T - 1, x1 = (e + 1) * T + 1, y = ty * T + 0.8;
      const sagAt = x => { let s = 0; for(const p of riders){ const d = (x - (p.x + p.w / 2)) / 26; s += 3.2 * Math.exp(-d * d); } return s * Math.min(1, (x - x0) / 12, (x1 - x) / 12); };
      c.lineWidth = 1.6; c.strokeStyle = '#6b4a2a'; c.beginPath();
      for(let x = x0; x <= x1; x += 3) c.lineTo(x, y + sagAt(x) + Math.sin(G.time * 3 + x * 0.05) * 0.25);
      c.lineTo(x1, y); c.stroke();
      c.lineWidth = 0.6; c.strokeStyle = 'rgba(255,240,200,.7)'; c.beginPath();
      for(let x = x0; x <= x1; x += 3) c.lineTo(x, y - 0.5 + sagAt(x));
      c.stroke();
      tx = e + 1;
    }
  }
}
function drawTokens(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++) for(let tx = tx0; tx <= tx1; tx++){
    if(tileAt(tx, ty) !== 'o') continue;
    drawToken(c, tx * T + 8, ty * T + 8 + Math.sin(G.time * 3 + tx) * 0.8, Math.abs(Math.cos(G.time * 3.2 + tx * 0.6)));
  }
}
function drawToken(c, x, y, sx){
  const w = Math.max(0.35, sx);
  c.save(); c.translate(x, y); c.scale(w, 1);
  c.fillStyle = '#c9800d'; star5(c, 0, 0.5, 6.4, 3); c.fill();
  c.fillStyle = '#ffcf3f'; star5(c, 0, 0, 5.6, 2.6); c.fill();
  c.fillStyle = '#fff3b0'; star5(c, -0.6, -0.8, 2.4, 1.1); c.fill();
  c.restore();
}

/* ---------- Backgrounds ---------- */
function cloud(c, x, y, s, col){ c.fillStyle = col; circ(c, x, y, 9 * s); c.fill(); circ(c, x + 10 * s, y - 4 * s, 11 * s); c.fill(); circ(c, x + 22 * s, y, 9 * s); c.fill(); rr(c, x - 4 * s, y - 2 * s, 30 * s, 10 * s, 5 * s); c.fill(); }
function hills(c, off, base, amp, col, freq, seed){
  c.fillStyle = col; c.beginPath(); c.moveTo(0, VH);
  for(let sx = 0; sx <= VW + 6; sx += 6){ const w = sx + off; c.lineTo(sx, base - (Math.sin(w * freq + seed) * 0.55 + Math.sin(w * freq * 2.3 + seed * 2) * 0.3 + 1) * amp); }
  c.lineTo(VW, VH); c.fill();
}
function bunting(c, off, y, span, sag, cols){
  for(let k = Math.floor(off / span) - 1; k <= Math.floor((off + VW) / span) + 1; k++){
    const x0 = k * span - off;
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo(x0 + span / 2, y + sag * 2, x0 + span, y); c.stroke();
    for(let i = 1; i < 8; i++){
      const t = i / 8, fx0 = x0 + span * t, fy = y + sag * 4 * t * (1 - t);
      c.fillStyle = cols[(k * 3 + i) % cols.length]; c.beginPath(); c.moveTo(fx0 - 3, fy); c.lineTo(fx0 + 3, fy); c.lineTo(fx0, fy + 6 + Math.sin(G.time * 3 + i + k) * 0.6); c.fill();
    }
  }
}
function tentShape(c, x, base, w, h, a, b){
  c.fillStyle = a; c.beginPath(); c.moveTo(x - w / 2, base); c.quadraticCurveTo(x - w * 0.18, base - h * 0.5, x, base - h); c.quadraticCurveTo(x + w * 0.18, base - h * 0.5, x + w / 2, base); c.fill();
  c.fillStyle = b;
  for(let i = -2; i <= 2; i += 2){ c.beginPath(); c.moveTo(x, base - h); c.lineTo(x + (i - 0.5) * w / 6, base); c.lineTo(x + (i + 0.5) * w / 6, base); c.fill(); }
  c.fillStyle = '#ffd45e'; c.fillRect(x - 0.6, base - h - 7, 1.2, 7); c.beginPath(); c.moveTo(x + 0.6, base - h - 7); c.lineTo(x + 6, base - h - 5); c.lineTo(x + 0.6, base - h - 3); c.fill();
}
function drawBG(c, camX){
  const ac = G.act, k = ac.key;
  const g = c.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, ac.sky[0]); g.addColorStop(1, ac.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  const flags = ['#ff5a6e', '#ffd45e', '#3fd0b0', '#7aa8ff', '#ff9ec4'];
  if(k === 'parade' || k === 'cannon' || k === 'wire'){
    if(k === 'cannon'){ for(let i = 0; i < 30; i++){ c.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.3 * Math.sin(G.time * 2 + i)) + ')'; c.fillRect(wrap(rng(i) * 700 - camX * 0.03, VW), rng(i + 9) * 60, 1, 1); } }
    else { c.fillStyle = 'rgba(255,250,210,.35)'; circ(c, 318, 42, 24); c.fill(); c.fillStyle = '#fff5c2'; circ(c, 318, 42, 14); c.fill(); }
    for(let i = 0; i < 6; i++){ const x = wrap(i * 83 - camX * 0.07 - G.time * (k === 'wire' ? 14 : 5), VW + 120) - 60; cloud(c, x, 22 + (i * 37) % 54, 0.55 + (i % 3) * 0.22, k === 'cannon' ? 'rgba(255,190,160,.35)' : 'rgba(255,255,255,.9)'); }
    const o1 = camX * 0.14;
    hills(c, o1, 162, 26, k === 'parade' ? '#a8e28f' : k === 'wire' ? '#9db8ff' : '#6b4f9a', 0.012, 1);
    // distant tents and a ferris wheel
    for(let t = Math.floor((o1 - 100) / 260); t <= Math.floor((o1 + VW + 100) / 260); t++){
      const x = t * 260 + 120 - o1;
      tentShape(c, x, 150, 70, 42, k === 'cannon' ? '#c24a6a' : '#e84a4a', k === 'cannon' ? '#e8a0b4' : '#fff3e0');
      if(t % 2 === 0){
        const wx = x + 110, wy = 110, R = 30;
        c.strokeStyle = k === 'cannon' ? 'rgba(255,220,180,.6)' : 'rgba(255,255,255,.75)'; c.lineWidth = 1.3; circ(c, wx, wy, R); c.stroke();
        for(let s2 = 0; s2 < 8; s2++){ const a = s2 * Math.PI / 4 + G.time * 0.25; c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(a) * R, wy + Math.sin(a) * R); c.stroke();
          c.fillStyle = flags[s2 % 5]; rr(c, wx + Math.cos(a) * R - 2.5, wy + Math.sin(a) * R, 5, 4, 1); c.fill(); }
        c.beginPath(); c.moveTo(wx - 12, 150); c.lineTo(wx, wy); c.lineTo(wx + 12, 150); c.stroke();
      }
    }
    const o2 = camX * 0.32;
    hills(c, o2, 186, 18, k === 'parade' ? '#6cc566' : k === 'wire' ? '#7392e0' : '#4a3570', 0.02, 2);
    bunting(c, camX * 0.5, 8, 150, 7, flags);
    if(k === 'wire'){ // high wire poles far away
      for(let q = Math.floor(camX * 0.22 / 200) - 1; q <= Math.floor((camX * 0.22 + VW) / 200) + 1; q++){
        const x = q * 200 - camX * 0.22; c.fillStyle = 'rgba(80,90,160,.5)'; c.fillRect(x, 60, 3, 120); c.fillRect(x + 120, 60, 3, 120);
        c.strokeStyle = 'rgba(80,90,160,.5)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 2, 62); c.lineTo(x + 121, 62); c.stroke();
      }
    }
  } else {
    // inside the big tent: stripes rising to the peak, bleachers with a happy crowd, rigging lights
    const o1 = camX * 0.12, stripeA = k === 'night' ? '#2a1f5c' : k === 'ring' ? '#7a1f3c' : '#9c1f3a', stripeB = k === 'night' ? '#1c1540' : k === 'ring' ? '#4a1636' : '#f4e3c8';
    for(let i = Math.floor(o1 / 40) - 1; i <= Math.floor((o1 + VW) / 40) + 1; i++){
      const x = i * 40 - o1; c.fillStyle = i % 2 ? stripeA : stripeB;
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 40, 0); c.lineTo(x + 52, 120); c.lineTo(x + 12, 120); c.fill();
    }
    const g2 = c.createLinearGradient(0, 0, 0, 120); g2.addColorStop(0, 'rgba(0,0,0,.35)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, VW, 120);
    // string lights
    for(let q = Math.floor(camX * 0.3 / 120) - 1; q <= Math.floor((camX * 0.3 + VW) / 120) + 1; q++){
      const x0 = q * 120 - camX * 0.3;
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(x0, 20); c.quadraticCurveTo(x0 + 60, 44, x0 + 120, 20); c.stroke();
      for(let i = 1; i < 10; i++){ const t = i / 10, lx = x0 + 120 * t, ly = 20 + 12 * 4 * t * (1 - t); c.fillStyle = flags[(q + i) % 5]; c.globalAlpha = 0.6 + 0.4 * Math.sin(G.time * 4 + i + q); circ(c, lx, ly + 1, 1.3); c.fill(); }
      c.globalAlpha = 1;
    }
    // bleachers with a waving crowd
    const o2 = camX * 0.3, by = 128;
    c.fillStyle = k === 'night' ? '#1a1438' : '#3a2440'; c.fillRect(0, by, VW, VH - by);
    for(let row = 0; row < 3; row++){
      c.fillStyle = k === 'night' ? '#241c4c' : '#4f3056'; c.fillRect(0, by + row * 18 + 12, VW, 3);
      for(let i = Math.floor(o2 / 11) - 1; i <= Math.floor((o2 + VW) / 11) + 1; i++){
        const x = i * 11 - o2 + (row % 2) * 5, n = i * 3 + row * 7, jump = Math.max(0, Math.sin(G.time * 5 + n * 0.9)) * (G.state === 'clear' ? 3 : 1);
        c.fillStyle = k === 'night' ? 'rgba(160,150,220,.35)' : ['#ffcf9e', '#c98b5e', '#8a5a3a', '#f0b890'][n % 4];
        circ(c, x, by + row * 18 + 4 - jump, 3); c.fill();
        c.fillStyle = k === 'night' ? 'rgba(120,110,190,.35)' : flags[n % 5]; rr(c, x - 3.5, by + row * 18 + 7 - jump, 7, 6, 2); c.fill();
      }
    }
    c.fillStyle = k === 'night' ? 'rgba(10,8,30,.2)' : 'rgba(40,16,40,.38)'; c.fillRect(0, by, VW, VH - by);
    if(k !== 'night'){ c.fillStyle = 'rgba(255,240,200,.07)'; c.beginPath(); c.moveTo(VW * 0.3, 0); c.lineTo(VW * 0.15, VH); c.lineTo(VW * 0.45, VH); c.fill(); c.beginPath(); c.moveTo(VW * 0.7, 0); c.lineTo(VW * 0.55, VH); c.lineTo(VW * 0.85, VH); c.fill(); }
    else for(let i = 0; i < 40; i++){ c.fillStyle = 'rgba(255,255,255,' + (0.2 + 0.4 * Math.sin(G.time * 2 + i * 1.7)) + ')'; c.fillRect(wrap(rng(i) * 900 - camX * 0.05, VW), rng(i + 9) * 110, 1, 1); }
  }
}
function drawWeather(c){
  const w = G.wind;
  if(!w.on) return;
  if(w.ph === 2){
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 0.8; c.beginPath();
    for(let i = 0; i < 26; i++){
      const x = wrap(rng(i) * VW + w.dir * G.time * 420, VW + 60) - 30, y = 20 + rng(i + 3) * 170;
      c.moveTo(x, y); c.lineTo(x - w.dir * (14 + rng(i + 7) * 16), y + Math.sin(G.time * 6 + i) * 1.5);
    }
    c.stroke();
  }
  if(w.ph >= 1){
    const x = VW / 2, y = 34, a = w.ph === 1 ? (Math.floor(G.time * 6) % 2 ? 1 : 0.5) : 0.85;
    c.globalAlpha = a;
    outlined(c, w.ph === 1 ? 'WIND COMING!' : 'WHOOSH!', x, y, 6, '#bff0ff');
    c.fillStyle = '#bff0ff'; c.beginPath();
    const ax = x + w.dir * 38; c.moveTo(ax + w.dir * 7, y); c.lineTo(ax, y - 4); c.lineTo(ax, y + 4); c.fill(); c.fillRect(Math.min(ax, ax - w.dir * 10), y - 1.2, 10, 2.4);
    c.globalAlpha = 1;
  }
}

/* ---------- Acrobats ---------- */
const SKIN = '#ffd9b8', TIGHTS = '#2d2748';
function drawHero(c, p){
  if(p.cannon) return;
  if(p.inv > 0 && !p.bubble && Math.floor(G.time * 20) % 2) return;
  const cx = p.x + p.w / 2, fy = p.y + p.h;
  const capeOn = p.cape > 0 && (p.cape > 2 || Math.floor(G.time * 10) % 2);
  const col = capeOn ? hue(G.time * 500 + p.slot * 90) : p.color;
  const dark = capeOn ? hue(G.time * 500 + p.slot * 90 + 60, 80, 40) : shade(p.color, 0.62);
  const hang = !!p.hang, ride = !!p.ride, fly = !!p.flyArc, air = !p.onGround && !(p.dead > 0) && !hang, bow = p.pose > 0 && (p.done || G.state === 'clear' || G.state === 'ending');
  // balance pole on the tightrope (drawn level-ish, tilting with the wobble)
  if(p.onRope && !air){
    c.save(); c.translate(cx, fy - 9); c.rotate(clamp(p.lean || 0, -0.35, 0.35) + Math.sin(G.time * 3 + p.slot) * 0.04);
    c.fillStyle = '#8a5a2e'; c.fillRect(-19, -0.8, 38, 1.6); c.fillStyle = col; circ(c, -19, 0, 1.6); c.fill(); circ(c, 19, 0, 1.6); c.fill(); c.restore();
  }
  c.save(); c.translate(cx, fy);
  let sy = 1;
  if(p.squashT > 0) sy = 1 - p.squashT * 1.1;
  if(p.dead > 0) c.rotate(Math.sin(p.dead * 18) * 0.25);
  if(fly){ c.translate(0, -9); c.rotate(clamp(Math.atan2(p.vy, Math.abs(p.vx) + 1), -0.9, 0.9) * (p.face < 0 ? -1 : 1)); c.translate(0, 9); }
  if(p.slipT > 0){ c.translate(0, -9); c.rotate((p.face || 1) * -0.5); c.translate(0, 9); }
  if(p.onRope && !air) c.rotate(clamp(p.lean || 0, -0.3, 0.3) * 0.4);
  c.scale((p.face < 0 ? -1 : 1) * (2 - sy), sy);
  const moving = Math.abs(p.vx) > 6 && !hang && !ride, ph = p.x * 0.32, step = !air && moving ? Math.sin(ph) : 0;
  const bob = !air && moving ? Math.abs(Math.cos(ph)) * 0.8 : 0;
  // star cape
  if(capeOn || p.cape > 0){
    const flap = Math.sin(G.time * 14) * 1.5;
    c.fillStyle = dark; c.beginPath(); c.moveTo(-2, -12 - bob); c.lineTo(-9 - Math.abs(p.vx) * 0.02, -4 + flap); c.lineTo(-3, -3); c.closePath(); c.fill();
  }
  // legs (tights + little white slippers)
  c.fillStyle = TIGHTS;
  if(hang || ride){ rr(c, -3.2, -6.5, 2.6, 6, 1.2); c.fill(); rr(c, 0.8, -6, 2.6, 6, 1.2); c.fill(); }
  else if(fly){ rr(c, -7, -5, 6, 2.6, 1.2); c.fill(); rr(c, -6, -2.6, 6, 2.6, 1.2); c.fill(); }
  else if(air){ rr(c, -4.2, -6, 2.6, 5, 1.2); c.fill(); rr(c, 1.2, -6.5, 2.6, 4.2, 1.2); c.fill(); }
  else { rr(c, -3.4 + step * 1.6, -6.5, 2.6, 6.5, 1.2); c.fill(); rr(c, 0.8 - step * 1.6, -6.5, 2.6, 6.5, 1.2); c.fill(); }
  c.fillStyle = '#fffaf0';
  if(hang || ride){ ell(c, -1.9, 0, 1.9, 1.1); c.fill(); ell(c, 2.1, 0.4, 1.9, 1.1); c.fill(); }
  else if(fly){ ell(c, -7.5, -3.7, 1.2, 1.6); c.fill(); ell(c, -6.5, -1.3, 1.2, 1.6); c.fill(); }
  else if(air){ ell(c, -2.9, -0.8, 2, 1.1); c.fill(); ell(c, 2.9, -2, 2, 1.1); c.fill(); }
  else { ell(c, -1.9 + step * 1.6, 0, 2, 1.1); c.fill(); ell(c, 2.3 - step * 1.6, 0, 2, 1.1); c.fill(); }
  // body: leotard with a star, gold belt
  c.fillStyle = col; rr(c, -4.3, -13 - bob, 8.6, 8, 3); c.fill();
  c.fillStyle = dark; c.fillRect(-4.3, -7.2 - bob, 8.6, 1.4);
  c.fillStyle = '#ffd45e'; c.fillRect(-4.3, -7.6 - bob, 8.6, 0.9);
  c.fillStyle = 'rgba(255,255,255,.9)'; star5(c, 0.6, -10.2 - bob, 2.1, 0.9); c.fill();
  c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(-3.1, -12 - bob, 1.1, 4.5);
  // arms
  c.strokeStyle = SKIN; c.lineWidth = 2.1; c.lineCap = 'round'; c.beginPath();
  const sh = -11.6 - bob;
  if(hang){ c.moveTo(-2.6, sh); c.lineTo(-2.2, -18.5); c.moveTo(2.6, sh); c.lineTo(2.2, -18.5); }
  else if(ride){ c.moveTo(2.4, sh); c.lineTo(2, -18.5); c.moveTo(-2.6, sh); c.lineTo(-5.4, -8.5); }
  else if(bow || (p.done && p.pose > 0)){ const w = Math.sin(G.time * 8) * 0.8; c.moveTo(-2.8, sh); c.lineTo(-7, -18 + w); c.moveTo(2.8, sh); c.lineTo(7, -18 - w); }
  else if(fly){ c.moveTo(2.4, sh); c.lineTo(8.5, -13.5); c.moveTo(-1, sh); c.lineTo(5, -11); }
  else if(p.onRope){ c.moveTo(-2.6, sh); c.lineTo(-5.5, -9.5); c.moveTo(2.6, sh); c.lineTo(5.5, -9.5); }
  else if(air){ c.moveTo(-2.6, sh); c.lineTo(-6.5, -16.5); c.moveTo(2.6, sh); c.lineTo(6.5, -16.5); }
  else { c.moveTo(-2.4, sh); c.lineTo(-3.4 + step * 2.2, -7.5); c.moveTo(2.4, sh); c.lineTo(3.4 - step * 2.2, -7.5); }
  c.stroke();
  // head, hair tuft, face
  const hy = -16.4 - bob;
  c.fillStyle = '#5a3422'; circ(c, -1.2, hy - 0.8, 4.4); c.fill();
  c.fillStyle = SKIN; circ(c, 0.6, hy + 0.3, 4.1); c.fill();
  c.fillStyle = '#5a3422'; ell(c, -2.4, hy - 2.6, 2.8, 1.8, -0.4); c.fill();
  if(p.dead > 0){
    c.strokeStyle = '#231c35'; c.lineWidth = 0.8; c.beginPath();
    for(const ex of [1.6, 4]){ c.moveTo(ex - 0.8, hy - 1.4); c.lineTo(ex + 0.8, hy + 0.2); c.moveTo(ex + 0.8, hy - 1.4); c.lineTo(ex - 0.8, hy + 0.2); }
    c.stroke();
  } else {
    const blink = Math.floor(G.time * 10 + p.slot * 13) % 37 === 0;
    c.fillStyle = '#231c35';
    if(blink){ c.fillRect(1.1, hy - 0.2, 1.4, 0.6); c.fillRect(3.4, hy - 0.2, 1.4, 0.6); }
    else { rr(c, 1.3, hy - 1.4, 1.3, 2.3, 0.65); c.fill(); rr(c, 3.6, hy - 1.4, 1.3, 2.3, 0.65); c.fill(); c.fillStyle = '#fff'; c.fillRect(1.55, hy - 1.15, 0.55, 0.55); c.fillRect(3.85, hy - 1.15, 0.55, 0.55); }
    c.fillStyle = 'rgba(255,110,130,.55)'; circ(c, 0.6, hy + 1.8, 0.9); c.fill(); circ(c, 4.9, hy + 1.8, 0.7); c.fill();
    c.strokeStyle = '#8a4a4a'; c.lineWidth = 0.55; c.beginPath(); c.arc(3.1, hy + 1.4, bow || air ? 1.2 : 0.9, 0.15, Math.PI - 0.15); c.stroke();
  }
  // tiny top hat in the player colour
  c.save(); c.translate(-0.2, hy - 3.6); c.rotate(-0.18 + (air ? Math.sin(G.time * 10) * 0.05 : 0));
  c.fillStyle = dark; rr(c, -3.4, -0.6, 6.8, 1.5, 0.7); c.fill();
  c.fillStyle = col; rr(c, -2.3, -4.8, 4.6, 4.6, 0.8); c.fill();
  c.fillStyle = '#fffaf0'; c.fillRect(-2.3, -1.8, 4.6, 0.9);
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-1.8, -4.4, 0.8, 2.4);
  c.restore();
  c.restore();
  if(capeOn && Math.random() < 0.3 && G.state !== 'paused') spawnFx('sparkle', cx, p.y + p.h / 2, hue(G.time * 500));
}
function drawBubble(c, p){
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = 13 + Math.sin(G.time * 4 + p.slot) * 0.9;
  c.save(); c.translate(cx, cy); c.scale(0.72, 0.72); c.translate(-cx, -cy - 2);
  drawHero(c, Object.assign({}, p, { inv: 0, onGround: true, vx: 0, cape: 0, squashT: 0, dead: 0, hang: null, ride: null, flyArc: false, onRope: false, pose: 0, y: cy - p.h / 2 + 1 }));
  c.restore();
  c.fillStyle = 'rgba(190,230,255,.22)'; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = 'rgba(220,245,255,.85)'; c.lineWidth = 1.1; circ(c, cx, cy, r); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.8)'; ell(c, cx - r * 0.45, cy - r * 0.5, 3, 1.6, -0.6); c.fill();
}

/* ---------- Circus things ---------- */
function eyes(c, x, y, face, sp, happy){
  c.fillStyle = '#fff'; ell(c, x - sp, y, 1.8, 2.2); c.fill(); ell(c, x + sp, y, 1.8, 2.2); c.fill();
  c.fillStyle = '#231c35';
  if(happy){ c.strokeStyle = '#231c35'; c.lineWidth = 0.7; c.beginPath(); c.arc(x - sp, y + 0.6, 1.2, Math.PI, 0); c.moveTo(x + sp + 1.2, y + 0.6); c.arc(x + sp, y + 0.6, 1.2, 0, Math.PI, true); c.stroke(); return; }
  circ(c, x - sp + face * 0.7, y + 0.3, 1); c.fill(); circ(c, x + sp + face * 0.7, y + 0.3, 1); c.fill();
}
function drawMonkey(c, e){
  const flip = e.st === 'flip', flat = e.st === 'flat', cx = e.x + e.w / 2, fy = e.y + e.h;
  c.save(); c.translate(cx, fy);
  if(flip) { c.translate(0, -6); c.rotate(e.t * 12); c.translate(0, 6); }
  if(flat) c.scale(1.3, 0.45);
  c.scale(e.face < 0 ? -1 : 1, 1);
  const st = Math.sin(e.t * 14) * 1.4;
  c.strokeStyle = '#7a4a2a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(-10, -6 + st, -8, -12); c.stroke();
  c.fillStyle = '#7a4a2a'; rr(c, -4 + st * 0.5, -3, 3, 3, 1); c.fill(); rr(c, 1 - st * 0.5, -3, 3, 3, 1); c.fill();
  c.fillStyle = '#9a6238'; ell(c, 0, -5.5, 4.8, 3.8); c.fill();
  c.fillStyle = '#9a6238'; circ(c, 1, -10.5, 4.4); c.fill();
  c.fillStyle = '#f1c9a0'; ell(c, 2.4, -9.8, 3, 2.6); c.fill();
  c.fillStyle = '#f1c9a0'; circ(c, -3.4, -11, 1.6); c.fill();
  c.fillStyle = '#e84a4a'; rr(c, -1.6, -17.2, 4.2, 3.6, 0.8); c.fill(); c.fillStyle = '#ffd45e'; c.fillRect(0.4, -18.8, 0.6, 1.8);
  if(flip || flat){ c.strokeStyle = '#231c35'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(1.2, -11.6); c.lineTo(2.4, -10.4); c.moveTo(2.4, -11.6); c.lineTo(1.2, -10.4); c.moveTo(3.8, -11.6); c.lineTo(5, -10.4); c.moveTo(5, -11.6); c.lineTo(3.8, -10.4); c.stroke(); }
  else { c.fillStyle = '#231c35'; circ(c, 1.9, -11, 0.8); c.fill(); circ(c, 4.3, -11, 0.8); c.fill(); c.strokeStyle = '#6a3a22'; c.lineWidth = 0.6; c.beginPath(); c.arc(3.2, -9.4, 1.2, 0.2, Math.PI - 0.2); c.stroke(); }
  c.restore();
}
function drawBarrel(c, e){
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  c.save(); c.translate(cx, cy); c.rotate(e.rot || 0);
  c.fillStyle = '#7a4a24'; circ(c, 0, 0, 7.2); c.fill();
  c.fillStyle = '#c27d44'; circ(c, 0, 0, 6.2); c.fill();
  c.fillStyle = '#e84a4a'; c.fillRect(-6.2, -1.6, 12.4, 3.2);
  c.fillStyle = '#ffd45e'; star5(c, 0, 0, 2.6, 1.1); c.fill();
  c.strokeStyle = '#7a4a24'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(-4.4, -4.4); c.lineTo(4.4, 4.4); c.moveTo(-4.4, 4.4); c.lineTo(4.4, -4.4); c.stroke();
  c.restore();
}
function drawWagon(c, e){
  const x = e.x, y = e.y, kick = e.kick > 0 ? Math.sin(e.kick * 30) * 1.5 : 0;
  c.fillStyle = '#e84a4a'; rr(c, x, y + 4 + kick, 30, 14, 2); c.fill();
  c.fillStyle = '#ffd45e'; c.fillRect(x, y + 4 + kick, 30, 2.5); c.fillRect(x, y + 15 + kick, 30, 2);
  c.fillStyle = '#fff3e0'; for(let i = 0; i < 3; i++) c.fillRect(x + 4 + i * 9, y + 7 + kick, 4, 7);
  for(const wx of [x + 7, x + 23]){ c.fillStyle = '#5a3422'; circ(c, wx, y + 20, 4.2); c.fill(); c.fillStyle = '#ffd45e'; circ(c, wx, y + 20, 1.6); c.fill(); }
  c.fillStyle = '#c27d44'; circ(c, x + 22, y + 2 + kick, 4.5); c.fill(); c.fillStyle = '#e84a4a'; c.fillRect(x + 17.5, y + 1 + kick, 9, 2);
  c.fillStyle = '#231c35'; ell(c, x - 1, y + 10 + kick, 2, 5); c.fill();
}
function drawBall(c, e){
  const cx = e.x + e.w / 2, fy = e.y + e.h, sq = e.sq > 0 ? e.sq * 1.6 : 0;
  c.save(); c.translate(cx, fy - 8 + sq * 3); c.scale(1 + sq * 0.7, 1 - sq);
  const cols = ['#ff5a6e', '#ffd45e', '#3fd0b0', '#7aa8ff'];
  for(let i = 0; i < 4; i++){ c.fillStyle = cols[i]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 8, i * Math.PI / 2 + e.x * 0.05, (i + 1) * Math.PI / 2 + e.x * 0.05); c.fill(); }
  c.fillStyle = '#fff'; circ(c, 0, 0, 2.2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, -3, -3.8, 2.6, 1.3, -0.6); c.fill();
  c.restore();
}
function flame(c, x, y, s, seed){
  const f = Math.sin(G.time * 18 + seed) * 0.25 + 1;
  c.fillStyle = '#ff7a1a'; c.beginPath(); c.moveTo(x - 2.4 * s, y); c.quadraticCurveTo(x - 2 * s, y - 4 * s * f, x, y - 6.5 * s * f); c.quadraticCurveTo(x + 2 * s, y - 4 * s * f, x + 2.4 * s, y); c.fill();
  c.fillStyle = '#ffd45e'; c.beginPath(); c.moveTo(x - 1.2 * s, y); c.quadraticCurveTo(x - 1 * s, y - 2.5 * s * f, x, y - 3.8 * s * f); c.quadraticCurveTo(x + 1 * s, y - 2.5 * s * f, x + 1.2 * s, y); c.fill();
}
function drawPot(c, e){
  const cx = e.x + e.w / 2, by = e.y + e.h;
  flame(c, cx - 2, e.y + 2, 1, e.x); flame(c, cx + 2.5, e.y + 2, 0.8, e.x + 3);
  c.fillStyle = '#b07d0c'; c.beginPath(); c.moveTo(e.x, e.y + 2); c.lineTo(e.x + e.w, e.y + 2); c.lineTo(e.x + e.w - 3, by); c.lineTo(e.x + 3, by); c.fill();
  c.fillStyle = '#ffd45e'; c.fillRect(e.x, e.y + 2, e.w, 2); c.fillStyle = '#e84a4a'; c.fillRect(e.x + 3, e.y + 6, e.w - 6, 1.5);
}
/* hoops are drawn in two halves so acrobats pass through them: back half first, front half later */
function drawHoop(c, e, front){
  const cx = e.cx, cy = e.cy, ry = e.ry || 24, rx = 5.5;
  if(!front){ c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(cx, cy - ry); c.lineTo(cx, cy - ry - 40); c.stroke(); }
  c.lineWidth = 2.6; c.strokeStyle = e.fire ? '#c9531a' : '#b07d0c';
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, front ? Math.PI / 2 : -Math.PI / 2, front ? Math.PI * 1.5 : Math.PI / 2); c.stroke();
  c.lineWidth = 1.1; c.strokeStyle = e.fire ? '#ffb36b' : '#ffe08a';
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, front ? Math.PI / 2 : -Math.PI / 2, front ? Math.PI * 1.5 : Math.PI / 2); c.stroke();
  if(e.fire){
    for(let i = 0; i < 10; i++){
      const a = (i / 10) * Math.PI * 2 + 0.2, onFront = Math.cos(a) < 0;
      if(onFront !== !!front) continue;
      const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      flame(c, x, y + 1.5, 0.75, i * 2.1 + e.cx);
    }
  } else if(!front){
    for(let i = 0; i < 4; i++){ const y = cy - ry + 4 + i * (ry * 2 - 8) / 3; c.fillStyle = CONFETTI[i]; c.beginPath(); c.moveTo(cx + rx, y); c.lineTo(cx + rx + 4, y + 2 + Math.sin(G.time * 4 + i) * 1.2); c.lineTo(cx + rx, y + 3); c.fill(); }
  }
}
function drawTramp(c, e){
  const t = e.t || 0, dip = t > 0 && t < 0.3 ? Math.sin((0.3 - t) / 0.3 * Math.PI) * 3 : 0;
  c.fillStyle = '#e84a4a'; c.fillRect(e.x + 1, e.y + 4, 3, 5); c.fillRect(e.x + e.w - 4, e.y + 4, 3, 5);
  c.strokeStyle = '#3f6fd8'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(e.x + 1, e.y + 2); c.quadraticCurveTo(e.x + e.w / 2, e.y + 2 + dip * 2, e.x + e.w - 1, e.y + 2); c.stroke();
  c.fillStyle = '#ffd45e'; rr(c, e.x - 1, e.y + 1, 4, 3, 1); c.fill(); rr(c, e.x + e.w - 3, e.y + 1, 4, 3, 1); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(e.x + 4, e.y + 1.4); c.quadraticCurveTo(e.x + e.w / 2, e.y + 1.4 + dip * 2, e.x + e.w - 4, e.y + 1.4); c.stroke();
}
function drawCannon(c, e){
  const a = e.tall ? 66 * Math.PI / 180 : 48 * Math.PI / 180, bx = e.x + 13, by = e.y + 10;
  const loaded = e.st === 'loaded', shake = loaded ? Math.sin(G.time * 40) * 0.4 * Math.min(1, e.t) : 0;
  const rider = loaded ? G.players.find(p => p.cannon) : null;
  c.save(); c.translate(bx + shake, by); c.rotate(-a);
  c.fillStyle = '#b8323c'; rr(c, -7, -6, 24, 12, 3); c.fill();
  c.fillStyle = '#ffd45e'; c.fillRect(-3, -6, 2.4, 12); c.fillRect(9, -6, 2.4, 12);
  c.fillStyle = '#ffd45e'; rr(c, 15, -7.5, 5, 15, 1.5); c.fill();
  c.fillStyle = '#231c35'; ell(c, 20, 0, 1.5, 5.4); c.fill();
  if(rider){ c.fillStyle = rider.color; rr(c, 17, -3.2, 4.4, 5, 0.8); c.fill(); c.fillStyle = '#fffaf0'; c.fillRect(17, -0.2, 4.4, 0.9); }
  c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-5, -4.6, 18, 1.4);
  c.restore();
  for(const wx of [e.x + 6, e.x + 20]){ c.fillStyle = '#5a3422'; circ(c, wx, e.y + 14, 4.4); c.fill(); c.fillStyle = '#ffd45e'; circ(c, wx, e.y + 14, 1.7); c.fill(); c.strokeStyle = '#ffd45e'; c.lineWidth = 0.6; circ(c, wx, e.y + 14, 3.4); c.stroke(); }
  if(loaded){
    const left = Math.max(0, (G.diff === 'kids' ? 1.1 : 2.6) - e.t);
    outlined(c, 'FIRE!', e.x + 13, e.y - 18 - Math.abs(Math.sin(G.time * 8)) * 2, 5, '#ffd45e');
    c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(e.x + 3, e.y - 12, 20 * (left / (G.diff === 'kids' ? 1.1 : 2.6)), 1.5);
  }
}
function drawTrapeze(c, e){
  const th = e.th || 0, bx = e.x + e.w / 2, by = e.y, ca = Math.cos(th), sa = Math.sin(th);
  const l = { x: bx - ca * 9, y: by + sa * 9 }, r = { x: bx + ca * 9, y: by - sa * 9 };
  c.strokeStyle = 'rgba(240,230,210,.85)'; c.lineWidth = 0.8; c.beginPath();
  c.moveTo(e.px - 3, e.py); c.lineTo(l.x, l.y); c.moveTo(e.px + 3, e.py); c.lineTo(r.x, r.y); c.stroke();
  c.strokeStyle = '#ffd45e'; c.lineWidth = 2.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(l.x, l.y); c.lineTo(r.x, r.y); c.stroke();
  c.fillStyle = '#c9c2b0'; rr(c, e.px - 6, e.py - 3, 12, 4, 1.5); c.fill();
}
function drawBalloons(c, e){
  const tx = e.x + e.w / 2, ty = e.y + 2, a = e.st === 'away' ? Math.max(0, 1 - e.t / 4) : 1;
  if(a <= 0) return;
  c.globalAlpha = a;
  const offs = [[-7, -22], [0, -26], [7, -22], [-3.5, -17], [3.5, -17]], cols = ['#ff5a6e', '#ffd45e', '#3fd0b0', '#7aa8ff', '#ff9ec4'];
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.5; c.beginPath();
  for(const o of offs){ c.moveTo(tx, ty); c.lineTo(tx + o[0] + Math.sin(G.time * 2 + o[0]) * 0.6, ty + o[1] + 5); } c.stroke();
  offs.forEach((o, i) => { const x = tx + o[0] + Math.sin(G.time * 2 + i) * 0.6, y = ty + o[1];
    c.fillStyle = cols[i]; ell(c, x, y, 4, 5); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, x - 1.3, y - 1.8, 1.1, 1.6, -0.4); c.fill();
    c.fillStyle = shade(cols[i], 0.7); c.beginPath(); c.moveTo(x - 1, y + 5); c.lineTo(x + 1, y + 5); c.lineTo(x, y + 6.2); c.fill(); });
  c.globalAlpha = 1;
}
function drawBell(c, e){
  const rung = e.st === 'rung', sw = rung ? Math.sin(e.t * 10) * Math.max(0, 0.6 - e.t * 0.2) : Math.sin(G.time * 2 + e.x) * 0.08;
  const cx = e.x + e.w / 2;
  if(!rung){ c.fillStyle = 'rgba(255,230,120,' + (0.18 + 0.12 * Math.sin(G.time * 4)) + ')'; circ(c, cx, e.y + 8, 11); c.fill(); }
  c.save(); c.translate(cx, e.y); c.rotate(sw);
  c.fillStyle = '#e84a4a'; ell(c, -2.5, 1, 2.6, 1.6, -0.4); c.fill(); ell(c, 2.5, 1, 2.6, 1.6, 0.4); c.fill();
  c.fillStyle = rung ? '#c9a24a' : '#ffcf3f'; c.beginPath(); c.moveTo(-3, 3); c.quadraticCurveTo(-4, 10, -6.5, 12); c.lineTo(6.5, 12); c.quadraticCurveTo(4, 10, 3, 3); c.quadraticCurveTo(0, 1, -3, 3); c.fill();
  c.fillStyle = '#b07d0c'; c.fillRect(-6.5, 11, 13, 1.6); circ(c, 0, 13.4, 1.4); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-2, 4, 1, 6);
  c.restore();
  if(!rung && Math.random() < 0.04 && G.state !== 'paused') spawnFx('sparkle', cx, e.y + 6, '#fff6b0');
}
function drawSpot(c, e){
  const cx = e.x + e.w / 2;
  c.fillStyle = '#3a3a4a'; rr(c, cx - 4, e.y, 8, 6, 1.5); c.fill(); c.fillStyle = '#fff6c8'; ell(c, cx, e.y + 6, 3, 1.2); c.fill();
}
function spotAngle(e){ return Math.sin(G.time * 0.7 + (e.ph || 0)) * 0.5; }
function drawBeam(c, e){
  const cx = e.x + e.w / 2, a = spotAngle(e), len = 200;
  const ex = cx + Math.sin(a) * len, ey = e.y + 6 + Math.cos(a) * len;
  c.fillStyle = 'rgba(255,245,200,.12)'; c.beginPath(); c.moveTo(cx - 2, e.y + 6); c.lineTo(cx + 2, e.y + 6);
  c.lineTo(ex + Math.cos(a) * 34, ey - Math.sin(a) * 34); c.lineTo(ex - Math.cos(a) * 34, ey + Math.sin(a) * 34); c.fill();
}
function drawCheck(c, e){
  const got = e.st === 'got', x = e.x + 6, top = e.y, base = e.y + e.h;
  c.fillStyle = '#c9c2b0'; c.fillRect(x, top, 2, e.h); c.fillStyle = '#ffd45e'; circ(c, x + 1, top, 2.2); c.fill();
  const fy = got ? top + 3 : base - 14, wv = Math.sin(G.time * 6) * 1.5;
  c.fillStyle = got ? '#ff5a6e' : '#8a8fa3'; c.beginPath(); c.moveTo(x + 2, fy); c.lineTo(x + 14, fy + 3 + wv); c.lineTo(x + 2, fy + 8); c.fill();
  c.fillStyle = '#fff'; star5(c, x + 6.5, fy + 4, 2, 0.9); c.fill();
}
function drawTent(c, e){
  const x = e.x, y = e.y, w = e.w, h = e.h, open = e.st === 'open', used = e.st === 'used';
  if(open){ c.fillStyle = 'rgba(255,220,120,' + (0.2 + 0.1 * Math.sin(G.time * 4)) + ')'; circ(c, x + w / 2, y + h - 12, 30); c.fill(); }
  c.fillStyle = '#e84a4a'; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x + 6, y + 14); c.lineTo(x + w / 2, y); c.lineTo(x + w - 6, y + 14); c.lineTo(x + w, y + h); c.fill();
  c.fillStyle = '#fff3e0';
  for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + 4 + i * 12, y + h); c.lineTo(x + 9 + i * 12, y + h); c.fill(); }
  c.fillStyle = '#ffd45e'; c.fillRect(x + 3, y + 14, w - 6, 3);
  for(let i = 0; i < 6; i++){ c.fillStyle = i % 2 ? '#ffd45e' : '#e84a4a'; c.beginPath(); c.moveTo(x + 3 + i * 7, y + 17); c.lineTo(x + 10 + i * 7, y + 17); c.lineTo(x + 6.5 + i * 7, y + 21); c.fill(); }
  c.fillStyle = '#ffd45e'; c.fillRect(x + w / 2 - 0.6, y - 8, 1.2, 8); c.fillStyle = '#3fd0b0'; c.beginPath(); c.moveTo(x + w / 2 + 0.6, y - 8); c.lineTo(x + w / 2 + 7, y - 6); c.lineTo(x + w / 2 + 0.6, y - 4); c.fill();
  // the flap
  const fx0 = x + w / 2 - 7, fw = 14, fy = y + 22;
  if(open){ c.fillStyle = '#2a1830'; c.beginPath(); c.moveTo(fx0, y + h); c.lineTo(x + w / 2, fy); c.lineTo(fx0 + fw, y + h); c.fill();
    c.fillStyle = 'rgba(255,220,120,.6)'; star5(c, x + w / 2, y + h - 7, 3, 1.3); c.fill();
    outlined(c, 'BONUS!', x + w / 2, y - 14 - Math.abs(Math.sin(G.time * 5)) * 2, 5, '#ffd45e'); }
  else { c.fillStyle = used ? '#8a6a4a' : '#b8323c'; c.beginPath(); c.moveTo(fx0, y + h); c.lineTo(x + w / 2, fy); c.lineTo(fx0 + fw, y + h); c.fill();
    if(!used){ // bell slots show how many are rung
      for(let i = 0; i < Math.max(3, G.bellsMax); i++){ const bx = x + w / 2 - 8 + i * 8, by = y + h - 9; c.fillStyle = i < G.bells ? '#ffd45e' : 'rgba(0,0,0,.35)';
        c.beginPath(); c.moveTo(bx - 2.4, by + 3); c.quadraticCurveTo(bx - 2.4, by - 2.6, bx, by - 2.6); c.quadraticCurveTo(bx + 2.4, by - 2.6, bx + 2.4, by + 3); c.fill(); }
    } else outlined(c, 'THANKS!', x + w / 2, y - 12, 4.5, '#fff3e0'); }
}
function drawPodium(c, e){
  const x = e.x, y = e.y, w = e.w, h = e.h;
  c.fillStyle = '#b8323c'; rr(c, x + 3, y + 4, w - 6, h - 4, 2); c.fill();
  c.fillStyle = '#fff3e0'; for(let i = 0; i < 4; i++) c.fillRect(x + 7 + i * 8, y + 5, 3.5, h - 6);
  c.fillStyle = '#ffd45e'; rr(c, x, y, w, 5, 2); c.fill(); c.fillRect(x + 1, y + h - 3, w - 2, 3);
  c.fillStyle = '#fff'; ell(c, x + w / 2, y + 1.6, 8, 1.4); c.fill(); c.fillStyle = '#e84a4a'; ell(c, x + w / 2, y + 1.6, 4.6, 0.9); c.fill(); c.fillStyle = '#fff'; ell(c, x + w / 2, y + 1.6, 1.8, 0.5); c.fill();
  c.fillStyle = '#ffd45e'; star5(c, x + w / 2, y + h / 2 + 3, 5, 2.2); c.fill();
  if(G.goalT < 0 && G.state === 'play') outlined(c, 'LAND HERE!', x + w / 2, y - 12 - Math.abs(Math.sin(G.time * 4)) * 2, 4.5, '#ffd45e');
}
function drawItem(c, e){
  const x = e.x, y = e.y;
  if(e.k === 'pop'){
    c.fillStyle = '#fff'; for(const [px, py] of [[3, 1], [6, -0.5], [9, 1], [4.5, 2], [7.5, 2]]){ circ(c, x + px, y + py + 1, 2); c.fill(); }
    c.fillStyle = '#e84a4a'; c.beginPath(); c.moveTo(x + 1, y + 3); c.lineTo(x + 11, y + 3); c.lineTo(x + 9.5, y + 12); c.lineTo(x + 2.5, y + 12); c.fill();
    c.fillStyle = '#fff'; c.fillRect(x + 3.6, y + 3, 1.4, 9); c.fillRect(x + 7, y + 3, 1.4, 9);
  } else if(e.k === 'ticket'){
    c.fillStyle = '#ffd45e'; rr(c, x, y + 1, 12, 8, 1.2); c.fill(); c.fillStyle = '#b07d0c'; circ(c, x, y + 5, 1.5); c.fill(); circ(c, x + 12, y + 5, 1.5); c.fill();
    text(c, '1UP', x + 6, y + 5.2, 3.8, '#8a3a1a', 'center', 'middle');
  } else {
    c.fillStyle = hue(G.time * 300); c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + 10, y + 2); c.lineTo(x + 12, y + 12); c.lineTo(x, y + 12); c.fill();
    c.fillStyle = '#fff'; star5(c, x + 6, y + 7, 3, 1.3); c.fill();
  }
}
function drawShot(c, e){
  if(e.k === 'roar'){
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2, d = e.vx > 0 ? 1 : -1;
    c.strokeStyle = 'rgba(255,240,200,.9)'; c.lineWidth = 1.4;
    for(let i = 0; i < 3; i++){ c.beginPath(); c.arc(cx - d * i * 4, cy, 5 + i * 2, d > 0 ? -1 : Math.PI - 1, d > 0 ? 1 : Math.PI + 1); c.stroke(); }
  } else if(e.k === 'fhoop'){
    const cx = e.x + 8, cy = e.y + 8;
    c.strokeStyle = '#c9531a'; c.lineWidth = 2; circ(c, cx, cy, 6.5); c.stroke();
    for(let i = 0; i < 6; i++){ const a = (e.rot || 0) + i * Math.PI / 3; if(!D().fireSafe) flame(c, cx + Math.cos(a) * 6.5, cy + Math.sin(a) * 6.5 + 1, 0.55, i); }
    if(D().fireSafe){ c.strokeStyle = '#ffb36b'; c.lineWidth = 1; circ(c, cx, cy, 6.5); c.stroke(); }
  } else if(e.k === 'cball'){
    const cx = e.x + 6, cy = e.y + 6;
    c.fillStyle = '#7aa8ff'; circ(c, cx, cy, 6); c.fill(); c.fillStyle = '#fff'; for(const [a, b] of [[-2, -2], [2.5, 1], [-1, 3]]){ circ(c, cx + a, cy + b, 1.2); c.fill(); }
  } else if(e.k === 'pie'){
    const cx = e.x + 6, cy = e.y + 4;
    c.fillStyle = '#c98b4f'; c.beginPath(); c.moveTo(cx - 6, cy); c.lineTo(cx + 6, cy); c.lineTo(cx + 4.5, cy + 4); c.lineTo(cx - 4.5, cy + 4); c.fill();
    c.fillStyle = '#fffaf0'; ell(c, cx, cy, 6, 2.6); c.fill(); c.fillStyle = '#ff5a6e'; circ(c, cx, cy - 2.2, 1.3); c.fill();
  } else if(e.k === 'chicken'){
    const cx = e.x + 6, cy = e.y + 5, fl = Math.sin(G.time * 20);
    c.save(); c.translate(cx, cy); c.rotate(e.st === 'lie' ? 0 : Math.sin(e.t * 12) * 0.4);
    c.fillStyle = '#ffe66b'; ell(c, 0, 0, 6, 3.4); c.fill(); circ(c, 5, -3, 2.4); c.fill();
    c.fillStyle = '#ff5a3d'; c.beginPath(); c.moveTo(4, -5.5); c.lineTo(5, -7 + fl * 0.3); c.lineTo(6, -5.5); c.fill();
    c.fillStyle = '#ff9a3d'; c.beginPath(); c.moveTo(7, -3); c.lineTo(9.5, -2.4); c.lineTo(7, -1.8); c.fill();
    c.fillStyle = '#231c35'; circ(c, 5.6, -3.4, 0.5); c.fill();
    c.restore();
  } else if(e.k === 'banana'){
    const cx = e.x + 6, cy = e.y + 4;
    c.fillStyle = '#ffe14a'; c.beginPath(); c.moveTo(cx - 6, cy); c.quadraticCurveTo(cx, cy + 5, cx + 6, cy); c.quadraticCurveTo(cx, cy + 2.5, cx - 6, cy); c.fill();
    c.fillStyle = '#ffe14a'; c.beginPath(); c.moveTo(cx - 1, cy + 1); c.lineTo(cx - 4, cy - 3); c.lineTo(cx - 2, cy + 1); c.moveTo(cx + 1, cy + 1); c.lineTo(cx + 4, cy - 3); c.lineTo(cx + 2, cy + 1); c.fill();
    c.fillStyle = '#6b4a2a'; c.fillRect(cx - 6.5, cy - 0.6, 1.2, 1.2);
  }
}

/* ---------- Bosses ---------- */
function drawBoss(c, e){
  if(e.inv > 0 && Math.floor(G.time * 16) % 2 && e.st !== 'defeat') c.globalAlpha = 0.55;
  if(e.bw === 0) drawLeo(c, e); else if(e.bw === 1) drawKaboom(c, e); else drawPrankster(c, e);
  c.globalAlpha = 1;
}
function dizzyStars(c, x, y){
  for(let i = 0; i < 3; i++){ const a = G.time * 5 + i * 2.1; c.fillStyle = '#ffe27a'; star5(c, x + Math.cos(a) * 9, y + Math.sin(a) * 3, 2.4, 1); c.fill(); }
}
function drawLeo(c, e){
  const cx = e.x + e.w / 2, fy = e.y + e.h, st = e.st, f = e.face < 0 ? -1 : 1;
  if(st === 'leap'){ const sx = (e.land || e.x) + e.w / 2; c.fillStyle = 'rgba(0,0,0,.25)'; ell(c, sx, GROUND - 1, 18, 3); c.fill(); }
  c.save(); c.translate(cx, fy); c.scale(f, 1);
  const crouch = st === 'crouch' ? Math.sin(e.t * 30) * 0.8 + 3 : 0, walk = st === 'prowl' ? Math.sin(e.t * 10) : 0, sit = st === 'dizzy' || st === 'defeat';
  // tail
  c.strokeStyle = '#d99a3c'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-15, -14 + crouch); c.quadraticCurveTo(-24, -20 + Math.sin(G.time * 4) * 3, -21, -28); c.stroke();
  c.fillStyle = '#8a4a1c'; circ(c, -21, -29, 3); c.fill();
  // body and legs
  c.fillStyle = '#e8b04a'; ell(c, -2, -12 + crouch * 0.6, 17, 9 - crouch * 0.3); c.fill();
  c.fillStyle = '#d99a3c';
  if(sit){ rr(c, -16, -6, 8, 6, 3); c.fill(); rr(c, 6, -6, 9, 6, 3); c.fill(); }
  else { rr(c, -14 + walk * 2, -8, 6, 8, 2.5); c.fill(); rr(c, -6 - walk * 2, -8, 6, 8, 2.5); c.fill(); rr(c, 4 + walk * 2, -8, 6, 8, 2.5); c.fill(); rr(c, 11 - walk * 2, -8, 6, 8, 2.5); c.fill(); }
  c.fillStyle = '#fff3e0'; for(const px of sit ? [-12, 10] : [-11 + walk * 2, -3 - walk * 2, 7 + walk * 2, 14 - walk * 2]){ ell(c, px, -0.8, 3, 1.3); c.fill(); }
  // big fluffy mane
  const hx = 12, hy = -22 + crouch;
  c.fillStyle = '#b8562a'; for(let i = 0; i < 12; i++){ const a = i / 12 * Math.PI * 2 + Math.sin(G.time * 2) * 0.05; circ(c, hx + Math.cos(a) * 10, hy + Math.sin(a) * 10, 5.2); c.fill(); }
  c.fillStyle = '#d9713a'; circ(c, hx, hy, 11); c.fill();
  c.fillStyle = '#f1c26a'; circ(c, hx + 1, hy + 1, 7.5); c.fill();
  c.fillStyle = '#f1c26a'; circ(c, hx - 5, hy - 7, 2.6); c.fill(); circ(c, hx + 6, hy - 7, 2.6); c.fill();
  c.fillStyle = '#fff3e0'; ell(c, hx + 2.5, hy + 4, 4.5, 3); c.fill();
  c.fillStyle = '#6b3a1c'; ell(c, hx + 2.5, hy + 1.6, 2, 1.3); c.fill();
  if(sit){ c.strokeStyle = '#231c35'; c.lineWidth = 0.9; c.beginPath(); c.arc(hx - 1.5, hy - 2, 1.6, 0, Math.PI * 2); c.moveTo(hx + 7.6, hy - 2); c.arc(hx + 6, hy - 2, 1.6, 0, Math.PI * 2); c.stroke(); dizzyStars(c, hx, hy - 14); }
  else {
    const angry = st === 'roar' || st === 'crouch';
    c.fillStyle = '#fff'; ell(c, hx - 1.5, hy - 2, 2, 2.2); c.fill(); ell(c, hx + 6, hy - 2, 2, 2.2); c.fill();
    c.fillStyle = '#231c35'; circ(c, hx - 0.8, hy - 1.6, 1.1); c.fill(); circ(c, hx + 6.7, hy - 1.6, 1.1); c.fill();
    if(angry){ c.strokeStyle = '#6b3a1c'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx - 4, hy - 5.5); c.lineTo(hx + 0.5, hy - 4); c.moveTo(hx + 9, hy - 5.5); c.lineTo(hx + 4.5, hy - 4); c.stroke(); }
  }
  if(st === 'roar' && e.t > 0.4 && e.t < 1.0){ c.fillStyle = '#8a2a2a'; ell(c, hx + 3, hy + 5.5, 3.5, 3); c.fill(); c.fillStyle = '#ff8fa0'; ell(c, hx + 3, hy + 6.8, 2, 1.2); c.fill(); }
  else { c.strokeStyle = '#6b3a1c'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(hx + 2.5, hy + 3); c.lineTo(hx + 2.5, hy + 5); c.arc(hx + 1.3, hy + 5, 1.2, 0, Math.PI); c.moveTo(hx + 4.9, hy + 5); c.arc(hx + 3.7, hy + 5, 1.2, 0, Math.PI); c.stroke(); }
  // a tiny crown (he's the king of the ring, after all)
  c.fillStyle = '#ffd45e'; c.beginPath(); c.moveTo(hx - 5, hy - 10); c.lineTo(hx - 5, hy - 15); c.lineTo(hx - 2, hy - 12); c.lineTo(hx + 1, hy - 16); c.lineTo(hx + 4, hy - 12); c.lineTo(hx + 7, hy - 15); c.lineTo(hx + 7, hy - 10); c.fill();
  c.restore();
}
function drawKaboom(c, e){
  const cx = e.x + e.w / 2, fy = e.y + e.h, f = e.face < 0 ? -1 : 1, st = e.st;
  const aim = st === 'aim' || st === 'fire' ? 0.55 : 0.25, hot = st === 'steam';
  c.save(); c.translate(cx, fy); c.scale(f, 1);
  // barrel
  c.save(); c.translate(2, -18); c.rotate(-aim - (st === 'fire' ? Math.max(0, 0.2 - (e.t % 0.32)) : 0));
  c.fillStyle = hot ? '#ff7a5a' : '#3f6fd8'; rr(c, -4, -7, 26, 14, 4); c.fill();
  c.fillStyle = '#ffd45e'; c.fillRect(4, -7, 2.4, 14); c.fillRect(13, -7, 2.4, 14); rr(c, 20, -8.5, 5, 17, 1.5); c.fill();
  c.fillStyle = '#231c35'; ell(c, 25, 0, 1.6, 6); c.fill();
  c.restore();
  // body with a face and a general's hat
  c.fillStyle = '#e84a4a'; rr(c, -16, -24, 26, 18, 5); c.fill();
  c.fillStyle = '#ffd45e'; c.fillRect(-16, -12, 26, 2);
  c.fillStyle = '#fff'; ell(c, -8, -18, 2.4, 2.6); c.fill(); ell(c, -1.5, -18, 2.4, 2.6); c.fill();
  c.fillStyle = '#231c35'; circ(c, -7.2, -17.6, 1.2); c.fill(); circ(c, -0.7, -17.6, 1.2); c.fill();
  c.fillStyle = '#5a3422'; c.beginPath(); c.moveTo(-10, -14); c.quadraticCurveTo(-5, -11, -4.5, -14); c.quadraticCurveTo(-4, -11, 1, -14); c.quadraticCurveTo(-4.5, -12.4, -10, -14); c.fill();
  if(hot){ c.fillStyle = 'rgba(255,90,110,.6)'; circ(c, -10, -15, 1.6); c.fill(); circ(c, 2.5, -15, 1.6); c.fill(); }
  // hat: its lid pops open when overheated
  c.save(); c.translate(-3, -24); if(hot) c.rotate(-0.6 - Math.sin(G.time * 20) * 0.1);
  c.fillStyle = '#2a2f5a'; rr(c, -9, -6, 18, 6, 2); c.fill(); c.fillStyle = '#ffd45e'; c.fillRect(-9, -1.5, 18, 1.5); star5(c, 0, -3.5, 2.2, 1); c.fill();
  c.restore();
  if(hot){ c.fillStyle = 'rgba(255,255,255,.8)'; for(let i = 0; i < 3; i++){ const t = (G.time * 2 + i / 3) % 1; circ(c, -3 + Math.sin(t * 9 + i) * 3, -26 - t * 16, 2 + t * 3); c.fill(); }
    outlined(c, 'HOT!', -3, -46, 5, '#ffb36b'); }
  // wheels
  for(const wx of [-11, 5]){ c.fillStyle = '#5a3422'; circ(c, wx, -5, 5.2); c.fill(); c.fillStyle = '#ffd45e'; circ(c, wx, -5, 2); c.fill();
    c.strokeStyle = '#ffd45e'; c.lineWidth = 0.8; for(let s = 0; s < 4; s++){ const a = s * Math.PI / 2 + e.x * 0.2; c.beginPath(); c.moveTo(wx, -5); c.lineTo(wx + Math.cos(a) * 4.4, -5 + Math.sin(a) * 4.4); c.stroke(); } }
  c.restore();
}
function drawPrankster(c, e){
  const cx = e.x + e.w / 2, by = e.y, st = e.st, leak = st === 'leak' || st === 'sink' || st === 'low';
  const defeat = st === 'defeat';
  // balloon (deflates a little when leaking) or an umbrella once he's beaten
  if(defeat){
    c.fillStyle = '#7a5cff'; c.beginPath(); c.arc(cx, by - 14, 16, Math.PI, 0); c.fill();
    c.fillStyle = '#ffd45e'; for(let i = 0; i < 4; i++){ c.beginPath(); c.moveTo(cx, by - 30); c.lineTo(cx - 16 + i * 8 + 2, by - 14); c.lineTo(cx - 16 + i * 8 + 6, by - 14); c.fill(); }
    c.strokeStyle = '#5a3422'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, by - 14); c.lineTo(cx, by + 2); c.stroke();
  } else {
    const s = leak ? 0.82 + Math.sin(G.time * 30) * 0.02 : 1, bw = 22 * s, bh = 26 * s, bcy = by - 30;
    c.strokeStyle = 'rgba(80,60,40,.9)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(cx - 12, by + 1); c.lineTo(cx - bw * 0.6, bcy + bh * 0.6); c.moveTo(cx + 12, by + 1); c.lineTo(cx + bw * 0.6, bcy + bh * 0.6); c.stroke();
    const cols = ['#7a5cff', '#ffd45e', '#ff5a6e', '#3fd0b0'];
    for(let i = 0; i < 4; i++){ c.fillStyle = cols[i]; c.beginPath(); c.ellipse(cx, bcy, bw * (1 - i * 0.25), bh, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, cx - bw * 0.45, bcy - bh * 0.4, 4, 7, -0.3); c.fill();
    c.fillStyle = '#231c35'; text(c, '?', cx, bcy, 12, 'rgba(35,28,53,.55)', 'center', 'middle');
    if(leak){ c.fillStyle = 'rgba(255,255,255,.7)'; for(let i = 0; i < 3; i++){ const t = (G.time * 3 + i / 3) % 1; circ(c, cx + bw * 0.8 + t * 12, bcy + 4 - t * 4, 1.5 + t * 2); c.fill(); } }
  }
  // the Prankster: purple coat, curly moustache, a top hat with a question mark
  const hx = cx, hy = by - 3, grin = st === 'hover' || st === 'intro' || st === 'rise';
  c.fillStyle = '#6a3fb0'; rr(c, hx - 6, hy - 4, 12, 9, 3); c.fill();
  c.fillStyle = '#ffd9b8'; circ(c, hx, hy - 8, 5); c.fill();
  c.fillStyle = '#231c35'; circ(c, hx - 1.8, hy - 9, 0.9); c.fill(); circ(c, hx + 1.8, hy - 9, 0.9); c.fill();
  c.strokeStyle = '#3a2418'; c.lineWidth = 1; c.beginPath(); c.moveTo(hx, hy - 6.6); c.quadraticCurveTo(hx - 3, hy - 5, hx - 5, hy - 7.5); c.moveTo(hx, hy - 6.6); c.quadraticCurveTo(hx + 3, hy - 5, hx + 5, hy - 7.5); c.stroke();
  if(grin){ c.strokeStyle = '#8a3a3a'; c.lineWidth = 0.6; c.beginPath(); c.arc(hx, hy - 5.8, 2, 0.2, Math.PI - 0.2); c.stroke(); }
  else { c.fillStyle = '#8a3a3a'; ell(c, hx, hy - 4.6, 1.3, 1.1); c.fill(); }
  c.fillStyle = '#231c35'; rr(c, hx - 5.5, hy - 13.6, 11, 1.6, 0.6); c.fill(); rr(c, hx - 3.5, hy - 20, 7, 6.6, 1); c.fill();
  c.fillStyle = '#ff5a6e'; c.fillRect(hx - 3.5, hy - 15.6, 7, 1.3);
  text(c, '?', hx, hy - 17.8, 4.4, '#ffd45e', 'center', 'middle');
  // basket
  c.fillStyle = '#b5743e'; rr(c, e.x, by, e.w, e.h - 2, 3); c.fill();
  c.strokeStyle = '#7a4a24'; c.lineWidth = 0.7; for(let i = 1; i < 5; i++){ c.beginPath(); c.moveTo(e.x + i * e.w / 5, by); c.lineTo(e.x + i * e.w / 5, by + e.h - 2); c.stroke(); }
  c.fillStyle = '#ffd45e'; c.fillRect(e.x - 1, by, e.w + 2, 2.4);
  if(st === 'low' || st === 'stun'){ dizzyStars(c, hx, hy - 24); }
}

/* ---------- HUD and overlays ---------- */
function bellIcon(c, x, y, s, on){
  c.fillStyle = on ? '#ffcf3f' : 'rgba(255,255,255,.22)';
  c.beginPath(); c.moveTo(x - 2.6 * s, y + 2.6 * s); c.quadraticCurveTo(x - 2.4 * s, y - 2.6 * s, x, y - 2.8 * s); c.quadraticCurveTo(x + 2.4 * s, y - 2.6 * s, x + 2.6 * s, y + 2.6 * s); c.fill();
  circ(c, x, y + 3.2 * s, 0.9 * s); c.fill();
}
function drawHUD(c){
  const def = G.def;
  const g = c.createLinearGradient(0, 0, 0, 18); g.addColorStop(0, 'rgba(10,8,24,.55)'); g.addColorStop(1, 'rgba(10,8,24,0)');
  c.fillStyle = g; c.fillRect(0, 0, VW, 18);
  outlined(c, String(G.score).padStart(7, '0'), 8, 8, 7, '#fff6e0', 'left');
  if(def.bonus) outlined(c, 'BONUS TENT · ' + Math.max(0, Math.ceil(G.bonusT)), VW / 2, 8, 6, '#ffd45e');
  else {
    outlined(c, 'ACT ' + (def.act + 1) + '  ' + def.name.toUpperCase(), VW / 2, 7, 5, '#ffd45e');
    if(G.bellsMax){ for(let i = 0; i < G.bellsMax; i++) bellIcon(c, VW / 2 - (G.bellsMax - 1) * 5 + i * 10, 15.5, 0.9, i < G.bells); }
  }
  drawToken(c, VW - 70, 8, 1);
  outlined(c, '×' + String(G.tokens).padStart(3, '0'), VW - 63, 8.4, 6, '#fff6e0', 'left');
  if(hasLives()){ heart(c, VW - 24, 7.5, 3.4, '#ff5a6e'); outlined(c, '×' + Math.max(0, G.lives), VW - 19, 8.4, 6, '#fff6e0', 'left'); }
  else outlined(c, 'KIDS', VW - 16, 8.4, 5, '#7dff8a');
  // every acrobat: name and hearts
  const n = G.players.length, colW = n > 2 ? 60 : 72;
  G.players.forEach((p, i) => {
    const x = 8 + i * colW, y = 22;
    c.fillStyle = 'rgba(10,8,24,.42)'; rr(c, x - 2, y - 4, colW - 6, 9, 3); c.fill();
    c.fillStyle = p.color; circ(c, x + 2, y + 0.5, 2.3); c.fill();
    const nm = p.name.toUpperCase(), sz = fitText(c, nm, colW - 34, 4.5);
    text(c, nm, x + 6, y + 0.5, sz, p.bubble ? '#a9a6c0' : '#fff6e0', 'left', 'middle');
    for(let h = 0; h < D().hearts; h++) heart(c, x + colW - 22 + h * 5.5, y + 0.3, 2, h < p.hearts ? '#ff5a6e' : 'rgba(255,255,255,.2)');
  });
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.st !== 'defeat'){
    const bw = 100, by = VH - 15;
    c.fillStyle = 'rgba(10,8,24,.6)'; rr(c, VW / 2 - bw / 2 - 4, by - 8, bw + 8, 17, 4); c.fill();
    outlined(c, boss.name, VW / 2, by - 3, 4.5, '#ff9a8a');
    for(let i = 0; i < boss.max; i++){ const px = VW / 2 - (boss.max - 1) * 6 + i * 12; heart(c, px, by + 4.5, 2.6, i < boss.hp ? '#ff5a6e' : 'rgba(255,255,255,.2)'); }
  }
  if(!A.Input.isTouch && G.state === 'play' && G.lvT < 5 && G.net !== 'guest') text(c, 'PAUSE: START / ESC', 8, VH - 10, 4.5, 'rgba(255,255,255,.55)');
  if(!def.bonus && G.state === 'play' && !isBoss(G.lv)) outlined(c, fmt(G.actT), VW - 8, VH - 8, 4.5, 'rgba(255,255,255,.7)', 'right');
  for(const p of G.players){
    if(p.done || p.bubble) continue;
    if(p.y + p.h < G.cam.y + 2){ const sx = p.x + p.w / 2 - G.cam.x; c.fillStyle = p.color; c.beginPath(); c.moveTo(sx, 30); c.lineTo(sx - 3.5, 35); c.lineTo(sx + 3.5, 35); c.fill(); }
  }
}
function drawIntro(c){
  const def = G.def, t = G.stateT, len = G.introLen || 2.4;
  const a = Math.min(1, t * 5) * Math.min(1, Math.max(0, (len - t) / 0.35));
  c.globalAlpha = a;
  c.fillStyle = 'rgba(20,10,28,.84)'; c.fillRect(0, 0, VW, VH);
  // curtains
  c.fillStyle = '#b8323c'; for(const s of [-1, 1]){ c.beginPath(); c.moveTo(VW / 2 + s * VW / 2, 0); c.lineTo(VW / 2 + s * (VW / 2 - 60), 0); c.quadraticCurveTo(VW / 2 + s * (VW / 2 - 40), VH * 0.5, VW / 2 + s * (VW / 2 - 70), VH); c.lineTo(VW / 2 + s * VW / 2, VH); c.fill(); }
  c.fillStyle = '#ffd45e'; c.fillRect(0, 0, VW, 4);
  if(def.bonus){ outlined(c, 'BONUS TENT!', VW / 2, 70, 14, '#ffd45e'); outlined(c, 'GRAB ALL THE STARS YOU CAN', VW / 2, 92, 6, '#fff6e0'); }
  else {
    outlined(c, isBoss(G.lv) ? 'THE BIG RING' : 'ACT ' + (def.act + 1), VW / 2, 58, 8, '#ffd45e');
    outlined(c, def.name.toUpperCase(), VW / 2, 80, fitText(c, def.name.toUpperCase(), VW - 120, 14), '#fff6e0');
    outlined(c, isBoss(G.lv) ? 'BOSS: ' + BOSS_NAMES[def.boss] : ['LEAP THE HOOPS', 'MIND THE FLAMES', 'KEEP YOUR BALANCE', 'FIRE AWAY!', 'SWING TO THE STARS', 'THE GRAND FINALE'][def.act], VW / 2, 98, 5.5, isBoss(G.lv) ? '#ff9a8a' : '#9fe8d7');
  }
  const n = G.players.length;
  G.players.forEach((p, i) => {
    const cx = VW / 2 - (n - 1) * 26 + i * 52;
    const fake = Object.assign({}, p, { x: cx - 6, y: 144 - p.h, onGround: true, vx: 0, inv: 0, bubble: false, dead: 0, done: 0, face: 1, cape: 0, squashT: 0, hang: null, ride: null, cannon: null, flyArc: false, onRope: false, pose: 0 });
    drawHero(c, fake);
    const nm = p.name.toUpperCase(); outlined(c, nm, cx, 152, fitText(c, nm, 48, 5), p.color);
  });
  if(hasLives()){ heart(c, VW / 2 - 12, 174, 4, '#ff5a6e'); outlined(c, '× ' + G.lives, VW / 2 + 4, 174.5, 7, '#fff6e0'); }
  else outlined(c, 'KIDS MODE · NO GAME OVER', VW / 2, 174, 5, '#7dff8a');
  c.globalAlpha = 1;
}
function drawClear(c){
  const msg = isBoss(G.lv) ? 'BRAVO!' : G.def.bonus ? 'WHAT A HAUL!' : 'ACT CLEAR!';
  const t = G.stateT, n = msg.length, size = 14;
  c.font = size + 'px ' + FONT; const wAll = c.measureText(msg).width;
  let x = VW / 2 - wAll / 2;
  for(let i = 0; i < n; i++){
    const ch = msg[i], cw = c.measureText(ch).width;
    const appear = Math.max(0, Math.min(1, (t * 12 - i) / 2));
    if(appear > 0) outlined(c, ch, x + cw / 2, 70 - Math.sin(Math.min(1, appear) * Math.PI) * 8 + Math.sin(G.time * 5 + i * 0.6) * 1.5, size, hue(i * 25 + G.time * 90, 90, 68));
    x += cw;
  }
  if(t > 0.8){ outlined(c, 'SCORE ' + G.score.toLocaleString(), VW / 2, 92, 6, '#fff6e0'); if(!isBoss(G.lv) && !G.def.bonus) outlined(c, 'TIME ' + fmt(G.actT), VW / 2, 104, 5, '#9fe8d7'); }
}
function drawEnding(c){
  const t = G.stateT, rise = Math.min(1, t / 4);
  const base = GROUND, cx = VW / 2, h = 150 * (0.15 + 0.85 * (1 - Math.pow(1 - rise, 3)));
  c.globalAlpha = 0.95;
  tentShape(c, cx, base, 300, h, '#e84a4a', '#fff3e0');
  c.globalAlpha = 1;
  bunting(c, 0, base - h * 0.55, 200, 6, CONFETTI);
  if(t > 1.5 && t < 7){ outlined(c, 'THE BIG TOP IS UP!', VW / 2, 40, 12, hue(G.time * 80, 90, 72)); outlined(c, 'THANK YOU, ACROBATS', VW / 2, 58, 6, '#fff6e0'); }
  if(t > 3 && t < 7) outlined(c, 'An xRetro original · art, levels & music made in code', VW / 2, 72, 4.2, '#ffe8c8');
}
function drawNames(c){
  if(G.players.length < 2 || G.demo) return;
  for(const p of G.players){
    if(p.cannon) continue;
    const top = p.bubble ? p.y + p.h / 2 - 17 : p.y - 12;
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
  // Kids: a springy safety net
  for(let tx = tx0; tx <= tx1; tx++){
    if(isSolid(tileAt(tx, ROWS - 1)) || tx < 0 || tx >= G.W) continue;
    const x = tx * T, y = LH - 6 + Math.sin(G.time * 5 + tx) * 0.6;
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 0.6; c.beginPath();
    for(let i = 0; i <= 4; i++){ c.moveTo(x + i * 4, y); c.lineTo(x + i * 4 + 2, y + 4); c.moveTo(x + i * 4 + 4, y); c.lineTo(x + i * 4 + 2, y + 4); }
    c.stroke(); c.fillStyle = 'rgba(255,90,110,.9)'; c.fillRect(x, y - 1, T, 1.6);
  }
}
function boardFits(){
  const panel = document.querySelector('.ui-layer:not([hidden]) .menu-panel'); if(!panel) return false;
  const r = panel.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  return cr.left + (VW - 152) / VW * cr.width > r.right + 8;
}
/* The act board on the title screen: medals, bells and how high the Big Top is so far */
function drawActBoard(c){
  const x = VW - 150, y = 26, w = 142;
  c.fillStyle = 'rgba(14,10,24,.78)'; rr(c, x, y, w, 170, 6); c.fill();
  c.strokeStyle = 'rgba(245,197,66,.5)'; c.lineWidth = 0.8; rr(c, x, y, w, 170, 6); c.stroke();
  const done = A.Medals.summary(GAME, 6).won, bells = A.Store.get('bigtop.bells', {});
  c.save(); c.beginPath(); c.rect(x + 4, y + 4, w - 8, 44); c.clip();
  tentShape(c, x + w / 2, y + 46, 90, 10 + 30 * (done / 6), '#e84a4a', '#fff3e0');
  c.restore();
  outlined(c, 'BIG TOP ' + Math.round(done / 6 * 100) + '% UP', x + w / 2, y + 54, 4.5, '#ffd45e');
  for(let i = 0; i < 6; i++){
    const ry = y + 68 + i * 16.5, lock = i > G.unlocked, sel = i === G.startAct;
    if(sel){ c.fillStyle = 'rgba(245,197,66,.18)'; rr(c, x + 4, ry - 7, w - 8, 14, 3); c.fill(); }
    outlined(c, String(i + 1), x + 12, ry, 5.5, lock ? '#6d6880' : '#ffd45e');
    const nm = lock ? '???' : ACTS[i].name.toUpperCase();
    text(c, nm, x + 20, ry, fitText(c, nm, 70, 4.4), lock ? '#6d6880' : '#fff6e0', 'left', 'middle');
    const m = A.Medals.get(GAME, 'act' + (i + 1));
    A.Medals.draw(c, x + w - 38, ry + 1, 3.6, m);
    const mask = bells[i] | 0;
    for(let b = 0; b < 3; b++) bellIcon(c, x + w - 26 + b * 7, ry, 0.72, mask & (1 << b));
  }
}
/* Midnight Trapeze: the tent is dark apart from spotlights and a glow around each acrobat */
let darkCv = null;
function drawDark(c, camX, camY, s){
  if(!G.def.dark) return;
  if(!darkCv) darkCv = document.createElement('canvas');
  if(darkCv.width !== canvas.width || darkCv.height !== canvas.height){ darkCv.width = canvas.width; darkCv.height = canvas.height; }
  const d = darkCv.getContext('2d');
  d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, darkCv.width, darkCv.height);
  d.fillStyle = 'rgba(6,4,22,.72)'; d.fillRect(0, 0, darkCv.width, darkCv.height);
  d.setTransform(s, 0, 0, s, -camX * s, -camY * s);
  d.globalCompositeOperation = 'destination-out';
  const glow = (x, y, r, a) => { const g = d.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,' + a + ')'); g.addColorStop(1, 'rgba(0,0,0,0)'); d.fillStyle = g; d.fillRect(x - r, y - r, r * 2, r * 2); };
  for(const p of G.players) if(!p.done || G.state !== 'play') glow(p.x + p.w / 2, p.y + p.h / 2, 76, 1);
  for(const e of G.ents){
    if(e.k === 'spot'){
      const cx = e.x + e.w / 2, a = spotAngle(e), len = 210, ex = cx + Math.sin(a) * len, ey = e.y + 6 + Math.cos(a) * len;
      const g = d.createLinearGradient(cx, e.y, ex, ey); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
      d.fillStyle = g; d.beginPath(); d.moveTo(cx - 2, e.y + 6); d.lineTo(cx + 2, e.y + 6); d.lineTo(ex + Math.cos(a) * 36, ey - Math.sin(a) * 36); d.lineTo(ex - Math.cos(a) * 36, ey + Math.sin(a) * 36); d.fill();
    } else if(e.k === 'bell' && e.st !== 'rung') glow(e.x + 6, e.y + 8, 22, 0.8);
    else if(e.k === 'trapeze') glow(e.x + e.w / 2, e.y, 26, 0.7);
    else if(e.k === 'podium' || e.k === 'tent' || e.k === 'check') glow(e.x + e.w / 2, e.y + e.h / 2, 40, 0.8);
    else if(e.k === 'balloon') glow(e.x + 7, e.y - 16, 20, 0.7);
  }
  // star tokens twinkle through the dark
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++) for(let tx = tx0; tx <= tx1; tx++) if(tileAt(tx, ty) === 'o') glow(tx * T + 8, ty * T + 8, 12, 0.85);
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(darkCv, 0, 0);
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
  if(G.state === 'ending'){ drawBG(c, 0); }
  else drawBG(c, camX);
  const world = () => c.setTransform(s, 0, 0, s, -camX * s, -camY * s);
  if(G.state !== 'ending'){
    world();
    for(const e of G.ents) if(e.k === 'spot'){ drawBeam(c, e); drawSpot(c, e); }
    for(const e of G.ents){
      if(e.k === 'tent') drawTent(c, e); else if(e.k === 'check') drawCheck(c, e); else if(e.k === 'trapeze') drawTrapeze(c, e);
      else if(e.k === 'hoop') drawHoop(c, e, false);
    }
    for(const e of G.ents) if(ITEMS.has(e.k) && e.st === 'rise') drawItem(c, e);
    c.setTransform(1, 0, 0, 1, 0, 0);
    drawTiles(c, camX, camY, s);
    world();
    drawRopes(c, camX);
    drawTokens(c, camX);
    drawPitNets(c, camX);
    for(const e of G.ents){
      switch(e.k){
        case 'monkey': drawMonkey(c, e); break;
        case 'barrel': drawBarrel(c, e); break;
        case 'wagon': drawWagon(c, e); break;
        case 'ball': drawBall(c, e); break;
        case 'pot': drawPot(c, e); break;
        case 'tramp': drawTramp(c, e); break;
        case 'cannon': drawCannon(c, e); break;
        case 'balloon': drawBalloons(c, e); break;
        case 'bell': drawBell(c, e); break;
        case 'podium': drawPodium(c, e); break;
        case 'boss': drawBoss(c, e); break;
        case 'pop': case 'ticket': case 'cape': if(e.st !== 'rise') drawItem(c, e); break;
        default: if(SHOTS.has(e.k)) drawShot(c, e);
      }
    }
  } else world();
  const order = G.players.slice().sort((a, b) => (a.bubble ? 1 : 0) - (b.bubble ? 1 : 0));
  for(const p of order){ if(p.bubble) drawBubble(c, p); else drawHero(c, p); }
  if(G.state !== 'ending') for(const e of G.ents) if(e.k === 'hoop') drawHoop(c, e, true);
  for(const p of parts){
    const a = 1 - p.t / p.life;
    if(p.kind === 'text'){ c.globalAlpha = Math.min(1, a * 2); outlined(c, p.str, p.x, p.y, 5, p.col); }
    else if(p.kind === 'big'){ c.globalAlpha = Math.min(1, a * 2.5); outlined(c, p.str, p.x, p.y, 7 + Math.min(1, p.t * 8) * 1.5, p.col); }
    else if(p.kind === 'token'){ c.globalAlpha = 1; drawToken(c, p.x, p.y, Math.abs(Math.cos(p.t * 20))); }
    else if(p.kind === 'chunk'){ c.globalAlpha = a; c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.8); c.restore(); }
    else if(p.kind === 'conf'){ c.globalAlpha = Math.min(1, a * 2); c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-1.6, -0.9, 3.2, 1.8 * Math.abs(Math.cos(p.rot * 1.3))); c.restore(); }
    else if(p.kind === 'star'){ c.globalAlpha = a; c.fillStyle = p.col; star5(c, p.x, p.y, p.r * 1.4, p.r * 0.55); c.fill(); }
    else { c.globalAlpha = a; c.fillStyle = p.col; circ(c, p.x, p.y, p.r * (0.5 + a * 0.5)); c.fill(); }
  }
  c.globalAlpha = 1;
  drawNames(c);
  drawDark(c, camX, camY, s);
  c.setTransform(s, 0, 0, s, 0, 0);
  if(G.state === 'ending') drawEnding(c);
  else if(!G.demo){ drawWeather(c); drawHUD(c); }
  if(G.state === 'intro') drawIntro(c);
  if(G.state === 'clear') drawClear(c);
  if(G.demo){ c.fillStyle = 'rgba(11,12,16,0.32)'; c.fillRect(0, 0, VW, VH); if(G.state === 'title' && A.Menu.isOpen() && boardFits()) drawActBoard(c); }
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
window.__bigtop = G;
window.__bigtopDebug = { mkEnt, hurt, toBubble, bumpTile, step, sim, Net, LEVELS, ACTS, CH, buildLevel, loadLevel, tileAt, startIntro, newGame, startAct,
  results, startClear, afterClear, ending, predictFlight, active, enterBonus, leaveBonus, ringBell, MEDAL_TIMES, cannonShot, trapezeBar, display };
})();
