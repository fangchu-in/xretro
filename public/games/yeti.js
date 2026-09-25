/* MIGHTY YETI: A Wild Quest Across India — a Humble Yeti game for 1–4 players on one shared screen, or online.
   Himu the explorer yeti travels from the backwaters of Kerala to the top of Kangchenjunga.
   Run with the D-pad, FIRE jumps (hold it to jump higher), Down + FIRE throws a kindness snowball.
   Gobble up goodness to fill the Mighty Meter: Tiny → Yeti → Mighty → Glide. Yuck monsters are never hurt:
   a snowball or a bop turns them into happy little critters. Friends join along the way and help out.
   All characters, levels, music and sounds are original and made in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;

/* ---------- Constants ---------- */
const VW = 384, VH = 216, T = 16, ROWS = 14, LH = ROWS * T;
const FONT = '"Silkscreen","Courier New",monospace', SANS = '"Chakra Petch","Segoe UI",sans-serif';
const WALK = 84, RUN = 134, ACC = 430, AIR_ACC = 320, SKID = 900, FRICTION = 540, ICE_FRICTION = 70;
const JUMP = 318, G_HOLD = 720, G_FALL = 1500, MAX_FALL = 430, GLIDE_FALL = 42, STOMP_V = 250, STOMP_HOLD = 340, SPRING_V = 480, TOWER_V = 440;
const STAGES = [
  { w: 10, h: 14, s: 0.72, name: 'TINY' },
  { w: 12, h: 20, s: 1.0,  name: 'YETI' },
  { w: 14, h: 25, s: 1.24, name: 'MIGHTY' },
  { w: 14, h: 25, s: 1.24, name: 'GLIDE' }
];
const HW = 12, HH = 20;
const SOLID = new Set(['#', 'X', 'k', 'j', 'c', 'B', 'D', 'I']);
const isSolid = ch => SOLID.has(ch);
const GOODS = { a: 6, b: 6, g: 8, p: 25, w: 4 };
const isGood = ch => GOODS[ch] !== undefined;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
/* Humble Yeti brand colours */
const HY = { dark: '#242021', green: '#328F42', yellow: '#F5E20A', lime: '#B0C936', leaf: '#7BB33B', pale: '#C5DF8A', orange: '#F5981F', deep: '#E95824', gold: '#FFCC00' };
const YETI_COLORS = ['#ff5a4e', '#3fd0b0', '#7aa8ff', '#f5c542'];

const DIFF = {
  kids:   { label: 'Kids',   lives: Infinity, pitBounce: true,  enemy: 0.72, bossHp: 6,  roll: 0.72, dive: false, dark: 0.5,  wind: 0.45, meter: 1.25, tinySafe: true },
  normal: { label: 'Normal', lives: 5,        pitBounce: false, enemy: 1.0,  bossHp: 9,  roll: 1.0,  dive: true,  dark: 0.78, wind: 1.0,  meter: 1.0,  tinySafe: false },
  pro:    { label: 'Pro',    lives: 3,        pitBounce: false, enemy: 1.25, bossHp: 12, roll: 1.2,  dive: true,  dark: 0.88, wind: 1.3,  meter: 0.8,  tinySafe: false }
};
const DIFF_ORDER = ['kids', 'normal', 'pro'];

/* ---------- Music: chiptunes with tabla, dhol, bansuri, sitar and tanpura (all original) ---------- */
const TITLE_THEME = {
  bpm: 116, flute: true, chords: ['C', 'C', 'F', 'C', 'C', 'Am', 'G', 'C'], bass: 'walk', arp: 'slow', leadVol: 0.09,
  lead: [
    'E5 - G5 - A5 - G5 - E5 - D5 - C5 - - -', 'D5 - E5 - G5 - - - A5 - G5 - E5 - D5 -',
    'C6 - - - A5 - G5 - A5 - C6 - D6 - C6 -', 'A5 - G5 - E5 - G5 - - - . . E5 - D5 -',
    'E5 - G5 - A5 - C6 - D6 - C6 - A5 - G5 -', 'A5 - - - G5 - E5 - D5 - E5 - C5 - - -',
    'D5 - E5 - G5 - A5 - G5 - E5 - D5 - C5 -', 'C5 - - - - - - - . . G4 - A4 - C5 -'],
  drums: ['d.t.n.tdd.t.ntn.', 'd.t.n.tdd.tnt.nj']
};
const KERALA_THEME = {
  bpm: 132, chords: ['D', 'D', 'G', 'A', 'D', 'Bm', 'G', 'A'], bass: 'drive', arp: 'slow', leadVol: 0.07, leadWave: 'pulse25',
  lead: [
    'D5 - F#5 - A5 - B5 - A5 - F#5 - E5 - D5 -', 'F#5 - A5 - . A5 B5 - D6 - B5 - A5 - - -',
    'B5 - D6 - B5 - A5 - G5 - A5 - B5 - - -', 'A5 - F#5 - E5 - F#5 - A5 - - - . . A4 -',
    'D6 - - - B5 - A5 - F#5 - A5 - B5 - D6 -', 'B5 - A5 - F#5 - E5 - F#5 - - - D5 - E5 -',
    'G5 - B5 - D6 - B5 - A5 - G5 - F#5 - E5 -', 'E5 - F#5 - A5 - - - D5 - - - . . A4 -'],
  drums: ['g.tng.tnd.tngtnt', 'g.tnd.tng.tnddtn']
};
const ODISHA_THEME = {
  bpm: 112, flute: true, chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'], bass: 'walk', arp: 'slow', leadVol: 0.09,
  lead: [
    'B5 - - - D6 - B5 - A5 - G5 - E5 - - -', 'G5 - A5 - B5 - - - A5 - G5 - E5 - D5 -',
    'E5 - G5 - A5 - B5 - D6 - - - B5 - A5 -', 'A5 - - - - - . . B5 - A5 - G5 - E5 -',
    'D6 - - - E6 - D6 - B5 - A5 - B5 - D6 -', 'B5 - - - A5 - G5 - E5 - G5 - A5 - - -',
    'G5 - E5 - D5 - E5 - G5 - A5 - B5 - A5 -', 'G5 - - - - - - - . . D5 - E5 - G5 -'],
  drums: ['d.t.n.tdd.t.ntn.', 'd.t.n.tdd.tnt.nt']
};
const ELLORA_THEME = {
  bpm: 96, flute: true, drone: true, droneRoot: 'D3', chords: ['Dm', 'Dm', 'C', 'Dm', 'Dm', 'F', 'C', 'Dm'], bass: 'pulse', leadVol: 0.085,
  lead: [
    'D5 - - - F5 - - - G5 - A5 - - - . .', 'A5 - C6 - A5 - G5 - F5 - - - . . D5 -',
    'E5 - G5 - - - F5 - E5 - C5 - - - . .', 'D5 - - - - - - - . . . . A4 - C5 -',
    'D5 - F5 - A5 - - - C6 - D6 - C6 - A5 -', 'C6 - - - A5 - G5 - F5 - A5 - - - . .',
    'G5 - E5 - C5 - E5 - G5 - - - F5 - E5 -', 'D5 - - - - - - - - - - - . . . .'],
  drums: ['d...t.n.d.d.t...', 'd...t.n.d...t.nt']
};
const RAJASTHAN_THEME = {
  bpm: 138, sitar: true, chords: ['Am', 'Am', 'Dm', 'E', 'Am', 'G', 'F', 'E'], bass: 'gallop', arp: 'slow', leadVol: 0.1,
  lead: [
    'A5 - . A5 C6 - B5 - A5 - G#5 - A5 - E5 -', 'A5 - . A5 C6 - D6 - E6 - D6 - C6 - B5 -',
    'D6 - - - C6 - A5 - F5 - A5 - D6 - C6 -', 'B5 - G#5 - E5 - G#5 - B5 - - - . . E5 -',
    'A5 - C6 - E6 - - - D6 - C6 - B5 - A5 -', 'G5 - B5 - D6 - - - C6 - B5 - G5 - - -',
    'F5 - A5 - C6 - F6 - E6 - C6 - A5 - F5 -', 'E5 - G#5 - B5 - E6 - - - . . . . E5 -'],
  drums: ['d.tnd.tnd.tnd.tn', 'd.tnd.tnddtnd.nt']
};
const ASSAM_THEME = {
  bpm: 144, chords: ['C', 'C', 'F', 'G', 'C', 'Am', 'F', 'G'], bass: 'drive', arp: 'fast', leadVol: 0.07, leadWave: 'pulse12',
  lead: [
    'G5 - A5 - C6 - . C6 A5 - G5 - E5 - G5 -', 'C6 - - - D6 - C6 - A5 - G5 - A5 - - -',
    'A5 - C6 - D6 - E6 - D6 - C6 - A5 - C6 -', 'D6 - - - C6 - A5 - G5 - - - . . G5 -',
    'E6 - - - D6 - C6 - D6 - E6 - G6 - E6 -', 'D6 - C6 - A5 - C6 - D6 - - - . . E6 -',
    'D6 - C6 - A5 - G5 - A5 - C6 - D6 - E6 -', 'C6 - - - - - - - G5 - - - C6 - - -'],
  drums: ['g.g.tgt.g.gtt.gt', 'g.gttgt.g.gtggtt']
};
const SIKKIM_THEME = {
  bpm: 100, flute: true, drone: true, droneRoot: 'F3', chords: ['F', 'F', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'], bass: 'walk', arp: 'slow', leadVol: 0.09,
  lead: [
    'A5 - - - C6 - D6 - C6 - A5 - G5 - - -', 'F5 - G5 - A5 - - - C6 - A5 - G5 - F5 -',
    'D6 - - - F6 - D6 - C6 - - - A5 - C6 -', 'C6 - - - - - - - . . A5 - G5 - A5 -',
    'C6 - D6 - F6 - - - G6 - F6 - D6 - C6 -', 'D6 - - - C6 - A5 - F5 - A5 - - - . .',
    'G5 - A5 - C6 - D6 - C6 - A5 - G5 - A5 -', 'F5 - - - - - - - - - - - . . C5 -'],
  drums: ['d...j...t...j.t.', 'd...j...t.t.j...']
};
const BOSS_THEME = {
  bpm: 160, sitar: true, chords: ['Am', 'Bb', 'Am', 'Bb', 'Dm', 'C', 'Bb', 'E'], bass: 'gallop', arp: 'fast', leadVol: 0.1,
  lead: [
    'A5 - . A5 Bb5 - A5 - G5 - A5 - E5 - . .', 'A5 - . A5 Bb5 - C6 - D6 - C6 - Bb5 - A5 -',
    'E6 - . E6 D6 - C6 - Bb5 - A5 - G5 - A5 -', 'Bb5 - A5 - G5 - F5 - E5 - - - . . E5 -',
    'D6 - . D6 F6 - E6 - D6 - C6 - A5 - D6 -', 'C6 - . C6 E6 - D6 - C6 - G5 - E5 - G5 -',
    'Bb5 - D6 - F6 - D6 - Bb5 - A5 - G5 - F5 -', 'E5 - G#5 - B5 - E6 - - - - - . . E5 -'],
  drums: ['g.tng.tng.tnggtn', 'g.tngttng.tngnnt']
};
const GLOW_THEME = {
  bpm: 176, flute: true, chords: ['C', 'F', 'C', 'G'], bass: 'drive', arp: 'fast', leadVol: 0.09,
  lead: ['E6 . E6 - G6 - E6 - C6 - D6 - E6 - - -', 'F6 . F6 - A6 - F6 - C6 - D6 - F6 - - -',
         'E6 . E6 - G6 - E6 - D6 - C6 - A5 - C6 -', 'D6 - C6 - A5 - G5 - A5 - C6 - D6 - - -'],
  drums: ['d.tnd.tnd.tnd.tn']
};
const ENDING_THEME = {
  bpm: 90, flute: true, drone: true, droneRoot: 'G3', chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'G'], bass: 'walk', arp: 'slow', leadVol: 0.09,
  lead: [
    'B5 - - - D6 - - - B5 - A5 - G5 - - -', 'E5 - G5 - A5 - B5 - A5 - - - . . G5 -',
    'C6 - - - B5 - A5 - G5 - E5 - G5 - A5 -', 'A5 - - - - - - - D6 - - - C6 - B5 -',
    'B5 - D6 - E6 - - - D6 - B5 - A5 - G5 -', 'E5 - G5 - A5 - - - B5 - A5 - G5 - E5 -',
    'C6 - - - B5 - A5 - G5 - A5 - B5 - D6 -', 'G5 - - - - - - - - - - - . . . .'],
  drums: ['d...t.n.d.d.t.n.', 'd...t.n.d.j.t...']
};
const SONGS = { TITLE_THEME, KERALA_THEME, ODISHA_THEME, ELLORA_THEME, RAJASTHAN_THEME, ASSAM_THEME, SIKKIM_THEME, BOSS_THEME, GLOW_THEME, ENDING_THEME };

/* ---------- The journey: six regions, south to north ---------- */
const REGIONS = [
  { key: 'kerala', name: 'Kerala Backwaters', short: 'KERALA', music: KERALA_THEME, sky: ['#35b5d6', '#d9f6e4'], pit: 'water',
    fact: "Kerala's backwaters are a maze of canals, lakes and rivers. People get around by boat!",
    g: { top: '#5cc94a', topHi: '#a6ef7c', topDk: '#2f8f3a', fill: '#b5562e', fillDk: '#8a3d1e', fillHi: '#d0743f', speck: '#7e3418' },
    stone: ['#c9643a', '#8a3d1e', '#e9926a'], ledge: ['#9a6a3c', '#5e3c1e', '#d6a266'] },
  { key: 'odisha', name: 'Odisha Coast', short: 'ODISHA', music: ODISHA_THEME, sky: ['#46a8f0', '#fff1c8'], pit: 'sea',
    fact: "Every year, huge numbers of Olive Ridley sea turtles come to Odisha's beaches to lay their eggs.",
    g: { top: '#fbe3a2', topHi: '#fff6d8', topDk: '#e2bd72', fill: '#e9c27c', fillDk: '#c99a55', fillHi: '#f8dca0', speck: '#cfa262' },
    stone: ['#c7a27a', '#8d6d4c', '#e6caa6'], ledge: ['#a88a6a', '#6d5640', '#d8c0a0'] },
  { key: 'ellora', name: 'Ellora Caves', short: 'ELLORA', music: ELLORA_THEME, sky: ['#1a1222', '#4a3040'], pit: 'abyss',
    fact: 'The Kailasa temple at Ellora was carved out of one single giant rock, from the top down.',
    g: { top: '#7a7466', topHi: '#a59e8e', topDk: '#4f4a42', fill: '#4a3d36', fillDk: '#2e2521', fillHi: '#62524a', speck: '#2a211d' },
    stone: ['#7a6e64', '#463d36', '#a39686'], ledge: ['#6a5e54', '#3a322c', '#948676'] },
  { key: 'rajasthan', name: 'Rajasthan Forts', short: 'RAJASTHAN', music: RAJASTHAN_THEME, sky: ['#f59a3a', '#ffe7a8'], pit: 'sand',
    fact: "Jaisalmer's fort is built from yellow sandstone. It glows gold at sunset, so people call it the Golden Fort.",
    g: { top: '#f2c46a', topHi: '#ffe3a0', topDk: '#d09a44', fill: '#e0aa55', fillDk: '#b98035', fillHi: '#f3c878', speck: '#c48c3c' },
    stone: ['#e0a860', '#a8702e', '#f6cf90'], ledge: ['#c98e4a', '#86561f', '#f0c080'] },
  { key: 'assam', name: 'Assam Tea Hills', short: 'ASSAM', music: ASSAM_THEME, sky: ['#8fd0e0', '#e8f8e0'], pit: 'river',
    fact: "Kaziranga in Assam is home to about two-thirds of all the world's one-horned rhinos.",
    g: { top: '#4fb843', topHi: '#9fe878', topDk: '#2a7f34', fill: '#6b4a30', fillDk: '#4a321e', fillHi: '#8a6444', speck: '#3e2a18' },
    stone: ['#8f9a86', '#5f6958', '#c2cbb8'], ledge: ['#b8c84a', '#6f7a24', '#e2ee8a'] },
  { key: 'sikkim', name: 'Sikkim · Kangchenjunga', short: 'SIKKIM', music: SIKKIM_THEME, sky: ['#2f7fe0', '#d6efff'], pit: 'crevasse',
    fact: 'Kangchenjunga is the highest mountain in India, and the third highest in the whole world.',
    g: { top: '#f4fbff', topHi: '#ffffff', topDk: '#bcd8ee', fill: '#6f7c8e', fillDk: '#4a5566', fillHi: '#8e9cae', speck: '#58657a' },
    stone: ['#bfe6f8', '#7ab0d0', '#eaf8ff'], ledge: ['#8a5a30', '#553518', '#c08850'] }
];

/* ---------- Level pieces ----------
   Rows are bottom-aligned (the last two rows are the ground). Legend:
   # ground   I ice   X stone   = ledge (jump up through it)   c crumbling rock   v rope (hold UP to climb)
   B brick (a MIGHTY yeti smashes it)   D junk wall (Rudra, a MIGHTY yeti or 3 snowballs break it)
   r palm-oil slick   F thorns   k cracked boulder (O = boulder hiding a secret cave)   a b g p w goodies
   s sugar blob   e fizz bubble   f candy bot   m maida phantom   z sloth cloud   R rolling things come from here
   E K S crates (mighty star, feather, karma glow)   N trapped critter   U thirsty sapling   H a friend's cage
   T bounce drum   - boat   | lift   C basecamp tent   L lantern   Q eagle   P goal   Y cave exit   Z boss   @ start */
const CH = {
  S: ['........', '........', '.@......', '########', '########'],
  logs: ['.........aba....', '.........===....', '................', '...bgb..........', '...===..........', '................', '................', '###..........###', '###..........###'],
  steps: ['......a.......', '.....XXX......', '....XXXXX.....', '...XXXXXXX....', '##############', '##############'],
  raft: ['.....a.w.a......', '...-............', '................', '................', '##............##', '##............##'],
  lift: ['..............', '..............', '...|....|.....', '..............', '..............', '##..........##', '##..........##'],
  spring: ['.....ggg.....', '....g...g....', '...a.....a...', '.............', '.............', '.............', '.............', '.............', '.....T.......', '#############', '#############'],
  thorns: ['.....bwb......', '....=====.....', '..............', '..............', '...F.....F....', '##############', '##############'],
  crumble: ['....a..w..a...', '..............', '##cccccccccc##', '##..........##'],
  cave: ['....XXXX', '..kkXXXX', '..OkXXXX', '########', '########'],
  exit: ['..XXXX....', '.XXXXX....', 'XXXXXXY...', '##########', '##########'],
  mighty: ['....a.a.a.a.....', '..XXXXXXXXXXXX..', '..B..w.p.w...B..', '..B.........EB..', '################', '################'],
  junk: ['.........', '....DD...', '....DD...', '....DD...', '....DD...', '#########', '#########'],
  eagle: ['....................', '....................', '....................', '....................', '....................', '....................', '....................',
          '..Q.......a.w.......', '....................', '....................', '....................', '....................', '####..........######', '####..........######'],
  high: [
    '....a.b.g.a.w.p.a.b.g.a.w.a.................',
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
/* A level is a list of pieces: F<n> flat ground (letters after the number are placed along it), I<n> the same on ice,
   G<n> gap (G3o = goodies arc over it), R<h> raise the ground to h, C basecamp checkpoint, or a piece name. */
const LEVELS = [
  { i: 0, code: '1-1', name: 'Coconut Canals', parts: 'S F10a F6s F6b G2 F6aw R1 F6s R0 F6r F4b logs F8s F6N G3o F8b C F6e F8ab spring F6f F6w R1 F6R F4a R0 F6s mighty F6bK F8a raft F6e F6s G3o F10bU END' },
  { i: 0, code: '1-2', name: 'Houseboat Bend', friend: 0, parts: 'S F8a F6s F6r F4b raft F6a F6f cave F6s F6bN G3o F8r F6a F6e logs F6s F8H C F6f F6a raft F6s F6bE F6r exit F8a F6eR G2 F6g R1 F6s R0 F6U F4b spring F6f F8a END' },
  { i: 1, code: '2-1', name: 'Turtle Tides', parts: 'S F8b F6s F6w raft F6aN F6f G3o F6b logs F6m F6s C F6r F4bE raft F6s F6e R1 F6a R0 F6fR F6b mighty F8g spring F6s F6aU F6 END' },
  { i: 1, code: '2-2', name: 'Sun Wheel Shore', parts: 'S F6 F6aK F6f high F6b F6r C F6e lift F6s F6aN cave F6fR F6b G3o F8r F6m logs F6e F6s exit F6b F6f F4a steps F6e F6aU G3o F6s F6 END' },
  { i: 2, code: '3-1', name: 'Carved Caverns', dark: 1, friend: 1, parts: 'S F6L F6aL F6s F6w F3 G3o F6fL F6r cave F6e F6bL thorns F6s C F6aH F6mL G3 F6f F6rK F3 crumble F6eL F6aN exit F6sR F6L F6b G3o F6f F6aU steps F6eL F6 END' },
  { i: 2, code: '3-2', name: 'Lantern Halls', dark: 1, parts: 'S F6aL F6f R1 F6r R2 F6sL R0 G3 F6e lift F6bL F6m C F6sRL crumble F6aE raft F6fL cave F6e F6rN F3 G4o F6bL thorns F6s exit F6aRL F6f mighty F6eL F6aU F6sL END' },
  { i: 2, code: '3-B', name: 'Echo Hall', boss: 1, parts: 'arena1' },
  { i: 3, code: '4-1', name: 'Golden Dunes', wind: 1, parts: 'S F6 F6aR F6s spring F6b R1 F6r R0 F6w G3o F6f lift F6aN F6sR cave F6e F6b thorns F6 C F6fa R1 F6r R2 F6a R0 G3o F6s spring F6bK exit F6eR F8a steps F6s F6gU G2 F6ab spring F6f F6 END' },
  { i: 3, code: '4-2', name: 'Fort Gate Run', wind: 1, parts: 'S F6a F6f steps F6s lift F6bN F6m R1 F6r R0 C F6e lift F6sR mighty F6aE F6f cave F6m F6r F3 G3o F6b thorns F6s exit F6aR F6f lift F6eU F6a spring F6s END' },
  { i: 3, code: '4-B', name: 'Dust Devil Dunes', boss: 0, parts: 'arena0' },
  { i: 4, code: '5-1', name: 'Tea Terraces', friend: 2, parts: 'S F6 F6H F6a junk F6s R1 F6b R2 F6f R0 F6w G3o F6s high F6aN C F6e junk F6r F4b raft F6s F6fR F6bE F6m junk F6a G3o F6sU R1 F6b R0 spring F6f F6 END' },
  { i: 4, code: '5-2', name: 'Rhino River', parts: 'S F6a F6s junk F6r raft F6bK F6f G3o F6e high F6s C F6aN junk F6m raft F6f F6bE cave F6sR F6r mighty F6a exit F6e junk F6aU G2 F6s spring F6f F6 END' },
  { i: 5, code: '6-1', name: 'Prayer Flag Pass', parts: 'S F6 I6a F6s I4 G2 F6bw F6f eagle F6aN I6s F6e C F6r R1 F6b R0 I6m G3o F6f crumble F6aE I6sR F6e cave F6b I4 exit F6aU steps F6s F6 END' },
  { i: 5, code: '6-2', name: 'Eagle Ridge', parts: 'S F6a I6s F6f eagle F6bN F6m lift F6e C I6s F6aR G3o F6fK eagle F6s I6z mighty F6aE F6e crumble F6fU R1 F6b R0 I6s spring F6a F6 END' },
  { i: 5, code: '6-B', name: 'Summit of Kangchenjunga', boss: 2, parts: 'arena2' }
];
const BOSS_NAMES = ['SANDSTORM DJINN', 'BAT SWARM', 'SUGAR CUBE KING'];
const BOSS_LINES = ['The Sandstorm Djinn whirls up out of the dunes!', 'The Bat Swarm swoops down from the cave roof!', 'The Sugar Cube King blocks the way to the summit!'];
const BOSS_TITLES = ['The Sandstorm Djinn', 'The Bat Swarm', 'The Sugar Cube King'];
const BOSS_WIN = ['The Djinn settles into a sleepy little breeze.', 'The bats flutter home, calm and happy.', 'The Sugar Cube King melts into a brand new friend!'];
const FRIENDS = [
  { id: 0, name: 'Ishu', kind: 'red panda', lv: 1, line: 'Ishu the red panda joins the quest! Ishu will catch you if you fall.' },
  { id: 1, name: 'Ganu', kind: 'monkey', lv: 4, line: 'Ganu the monkey joins the quest! Ganu grabs goodies that are out of reach.' },
  { id: 2, name: 'Rudra', kind: 'rhino', lv: 10, line: 'Rudra the rhino joins the quest! Rudra charges through junk walls.' }
];
const isBoss = ix => LEVELS[ix] && LEVELS[ix].boss !== undefined;
const ENT_CHARS = 'sefmzREKST-|CPYZWNUHQL';

const BUILT = {};
function buildLevel(ix){
  if(BUILT[ix]) return BUILT[ix];
  const def = LEVELS[ix], region = REGIONS[def.i];
  const cols = [], ents = [];
  let h = 0, start = null;
  const emptyCol = () => new Array(ROWS).fill('.');
  const groundCol = ice => { const c = emptyCol(); for(let r = 12 - h; r < ROWS; r++) c[r] = '#'; if(ice) c[12 - h] = 'I'; return c; };
  const place = (x, r, ch) => {
    if(r < 0 || r >= ROWS || !cols[x]) return;
    if(ch === '@'){ start = { tx: x, ty: r }; return; }
    if(ch === 'O'){ cols[x][r] = 'k'; ents.push({ ch: 'W', tx: x, ty: r }); return; }
    if(ENT_CHARS.includes(ch)){ ents.push({ ch, tx: x, ty: r }); return; }
    cols[x][r] = ch;
  };
  for(const tok of def.parts.trim().split(/\s+/)){
    let m;
    if((m = /^([FI])(\d+)(.*)$/.exec(tok))){
      const ice = m[1] === 'I', n = +m[2], ex = m[3], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(groundCol(ice));
      for(let j = 0; j < ex.length; j++){
        const ch = ex[j], x = x0 + Math.floor(n * (j + 1) / (ex.length + 1));
        if('sfREKSTrFNUH'.includes(ch)) place(x, 11 - h, ch);
        else if(ch === 'e' || ch === 'z') place(x, 7 - h, ch);
        else if(ch === 'p' || ch === 'm') place(x, 8 - h, ch);
        else if(ch === 'L') place(x, 6 - h, ch);
        else place(x, 10 - h, ch);
      }
    } else if((m = /^G(\d+)(o?)$/.exec(tok))){
      const n = +m[1], x0 = cols.length;
      for(let i = 0; i < n; i++) cols.push(emptyCol());
      if(m[2]) for(let i = 0; i < n; i++) place(x0 + i, 9 - h - Math.round(Math.sin(Math.PI * (i + 0.5) / n) * 2), 'abgw'[i % 4]);
    } else if((m = /^R(\d)$/.exec(tok))) h = +m[1];
    else if(tok === 'C'){ const x0 = cols.length; for(let i = 0; i < 6; i++) cols.push(groundCol(false)); place(x0 + 1, 11 - h, 'C'); }
    else if(CH[tok]){
      if(tok === 'END' || tok.startsWith('arena') || tok === 'high' || tok === 'eagle') h = 0;
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
  return (BUILT[ix] = { map, W, ents, start: start || { tx: 1, ty: 11 }, def, region });
}

/* ---------- State ---------- */
const G = {
  state: 'title', demo: true, diff: A.Store.get('yeti.diff', 'normal'), lv: 0, startLv: 0,
  unlocked: Math.min(LEVELS.length - 1, A.Store.get('yeti.unlocked', 0) | 0),
  players: [], roster: [], ents: [], pals: [], map: null, W: 0, mods: [], region: REGIONS[0],
  cam: { x: 0, y: LH - VH }, score: 0, lives: 5, time: 0, stateT: 0, lvT: 0, introLen: 2.4,
  check: null, goalT: -1, wipeT: 0, loadN: 0, net: null, shake: 0, crumbles: new Map(),
  levelScore: 0, gate: null, god: false, demoT: 0, modsApplied: 0, warp: null, secret: false,
  rescued: new Set(), badges: 0, lvBadges: 0, lvBadgeMax: 0, levelBadges: 0, gust: 0, windT: 0, ishuCD: 0, junk: new Map(), cheers: 0, karmaDone: new Set()
};
if(!DIFF[G.diff]) G.diff = 'normal';
G.startLv = Math.min(G.unlocked, A.Store.get('yeti.start', 0) | 0);
const D = () => DIFF[G.diff];
const hasLives = () => D().lives !== Infinity;
const lvDef = () => LEVELS[G.lv];

/* ---------- Sounds ---------- */
const SX = {
  jump:   s => s.tone({ wave: 'pulse25', f: 300, f2: 620, t: 0.12, v: 0.07 }),
  good:   s => { s.tone({ wave: 'sine', f: 1047, t: 0.06, v: 0.12 }); s.tone({ wave: 'sine', f: 1568, t: 0.14, v: 0.1, at: 0.05 }); s.tone({ wave: 'sine', f: 3136, t: 0.06, v: 0.03, at: 0.05 }); },
  combo:  s => s.melody([[784, .05], [988, .05], [1175, .05], [1568, .05], [1976, .14]], { wave: 'triangle', v: 0.12 }),
  cheer:  s => { s.melody([[880, .05], [1175, .05], [1760, .09]], { wave: 'sine', v: 0.12 }); s.noise({ t: 0.06, v: 0.06, f: 5000, type: 'highpass' }); },
  stomp:  s => { s.tone({ f: 260, f2: 90, t: 0.1, v: 0.1 }); s.tone({ wave: 'sine', f: 880, f2: 1760, t: 0.14, v: 0.08, at: 0.05 }); },
  throw:  s => { s.noise({ t: 0.12, v: 0.08, f: 3000, f2: 900, type: 'bandpass' }); s.tone({ wave: 'sine', f: 700, f2: 420, t: 0.08, v: 0.05 }); },
  puff:   s => { s.noise({ t: 0.12, v: 0.1, f: 4000, f2: 1200 }); s.tone({ wave: 'sine', f: 1400, f2: 900, t: 0.06, v: 0.05 }); },
  clink:  s => { s.tone({ wave: 'triangle', f: 1600, f2: 1200, t: 0.07, v: 0.07 }); s.noise({ t: 0.04, v: 0.05, f: 6000, type: 'highpass' }); },
  crack:  s => { s.noise({ t: 0.16, v: 0.2, f: 2400, f2: 500 }); s.tone({ wave: 'triangle', f: 300, f2: 120, t: 0.1, v: 0.1 }); },
  crate:  s => { s.noise({ t: 0.1, v: 0.14, f: 2500, f2: 800 }); s.melody([[659, .05], [880, .05], [1319, .1]], { wave: 'triangle', v: 0.1, at: 0.05 }); },
  grow:   s => s.melody([[392, .05], [523, .05], [659, .05], [784, .05], [1047, .05], [1319, .14]], { wave: 'triangle', v: 0.13 }),
  shrink: s => s.melody([[880, .06], [659, .06], [523, .06], [392, .12]], { wave: 'pulse25', v: 0.1 }),
  oof:    s => s.tone({ wave: 'triangle', f: 400, f2: 200, t: 0.14, v: 0.12 }),
  die:    s => s.melody([[988, .08], [932, .08], [880, .08], [0, .12], [659, .12], [523, .12], [392, .28]], { wave: 'pulse25', v: 0.1 }),
  splash: s => { s.noise({ t: 0.4, v: 0.25, f: 2000, f2: 300 }); s.tone({ wave: 'sine', f: 500, f2: 150, t: 0.2, v: 0.1 }); },
  sink:   s => { s.noise({ t: 0.45, v: 0.2, f: 900, f2: 120 }); s.tone({ wave: 'sine', f: 300, f2: 90, t: 0.35, v: 0.12 }); },
  bubble: s => { s.tone({ wave: 'sine', f: 380, f2: 900, t: 0.26, v: 0.15 }); s.tone({ wave: 'sine', f: 620, f2: 1300, t: 0.2, v: 0.08, at: 0.09 }); },
  pop:    s => { s.tone({ wave: 'sine', f: 1300, f2: 320, t: 0.09, v: 0.15 }); s.noise({ t: 0.05, v: 0.08, f: 6000, type: 'highpass' }); },
  spring: s => { s.tone({ wave: 'sine', f: 110, f2: 60, t: 0.2, v: 0.3 }); s.tone({ wave: 'triangle', f: 220, f2: 900, t: 0.26, v: 0.12, vib: true }); },
  tower:  s => { s.tone({ wave: 'triangle', f: 260, f2: 1300, t: 0.3, v: 0.15, vib: true }); s.tone({ wave: 'sine', f: 520, f2: 2000, t: 0.25, v: 0.06, at: 0.05 }); },
  boing:  s => s.tone({ wave: 'sine', f: 330, f2: 760, t: 0.13, v: 0.13 }),
  tent:   s => { s.melody([[523, .07], [659, .07], [784, .07], [1047, .16]], { wave: 'sine', v: 0.12 }); s.tone({ wave: 'sine', f: 2960, t: 0.3, v: 0.03, at: 0.2 }); },
  secret: s => s.melody([[523, .07], [659, .07], [784, .07], [1047, .07], [1319, .07], [1568, .2]], { wave: 'triangle', v: 0.12 }),
  warp:   s => { s.tone({ wave: 'sine', f: 900, f2: 120, t: 0.45, v: 0.13 }); s.noise({ t: 0.45, v: 0.08, f: 3000, f2: 300 }); },
  gate:   s => s.melody([[784, .07], [988, .07], [1175, .07], [1568, .16]], { wave: 'triangle', v: 0.12 }),
  fanfare: s => { s.melody([[523, .1], [659, .1], [784, .1], [1047, .22], [0, .05], [880, .1], [1047, .1], [1319, .4]], { wave: 'sine', v: 0.13 });
                  s.melody([[262, .32], [349, .32], [392, .4], [523, .5]], { wave: 'triangle', v: 0.15 }); },
  bossHit: s => { s.noise({ t: 0.25, v: 0.2, f: 3000, f2: 400 }); s.tone({ wave: 'triangle', f: 660, f2: 330, t: 0.25, v: 0.1 }); },
  land:   s => { s.noise({ t: 0.35, v: 0.35, f: 900, f2: 60 }); s.tone({ wave: 'sine', f: 90, f2: 40, t: 0.3, v: 0.25 }); },
  drum:   s => { s.tone({ wave: 'sine', f: 140, f2: 55, t: 0.22, v: 0.3 }); s.noise({ t: 0.1, v: 0.12, f: 700, f2: 200 }); },
  spit:   s => { s.noise({ t: 0.25, v: 0.16, f: 1800, f2: 400 }); s.tone({ wave: 'sine', f: 300, f2: 600, t: 0.18, v: 0.06 }); },
  screech: s => s.tone({ wave: 'sawtooth', f: 1400, f2: 1900, t: 0.18, v: 0.04, vib: true }),
  warn:   s => s.tone({ f: 1760, t: 0.05, v: 0.05 }),
  rock:   s => { s.noise({ t: 0.25, v: 0.16, f: 700, f2: 200 }); },
  shatter: s => { s.noise({ t: 0.3, v: 0.22, f: 2500, f2: 300 }); s.tone({ wave: 'triangle', f: 400, f2: 100, t: 0.15, v: 0.08 }); },
  smash:  s => { s.noise({ t: 0.35, v: 0.3, f: 1800, f2: 150 }); s.tone({ wave: 'square', f: 180, f2: 60, t: 0.2, v: 0.08 }); },
  bump:   s => { s.tone({ wave: 'triangle', f: 180, f2: 120, t: 0.08, v: 0.14 }); },
  firework: s => { s.noise({ t: 0.5, v: 0.22, f: 2200, f2: 200 }); s.tone({ wave: 'triangle', f: 1400, f2: 500, t: 0.2, v: 0.04 }); },
  crumble: s => s.noise({ t: 0.25, v: 0.16, f: 1600, f2: 250 }),
  karma:  s => { s.melody([[1047, .08], [1319, .08], [1568, .08], [2093, .2]], { wave: 'sine', v: 0.12 }); s.tone({ wave: 'sine', f: 2960, t: 0.5, v: 0.03, at: 0.25 }); s.tone({ wave: 'sine', f: 4180, t: 0.4, v: 0.02, at: 0.33 }); },
  friend: s => { s.melody([[523, .08], [659, .08], [784, .08], [1047, .08], [784, .08], [1047, .24]], { wave: 'triangle', v: 0.13 }); s.melody([[262, .32], [392, .32]], { wave: 'sine', v: 0.12 }); },
  slip:   s => { s.tone({ wave: 'sine', f: 600, f2: 1200, t: 0.2, v: 0.08 }); s.noise({ t: 0.2, v: 0.06, f: 3000, f2: 6000, type: 'bandpass' }); },
  sleepy: s => s.melody([[523, .12], [440, .12], [349, .24]], { wave: 'sine', v: 0.08 }),
  eagle:  s => { s.tone({ wave: 'sawtooth', f: 1800, f2: 1200, t: 0.25, v: 0.035, vib: true }); s.noise({ t: 0.3, v: 0.06, f: 1500, f2: 700 }); },
  wind:   s => s.noise({ t: 1.2, v: 0.08, f: 600, f2: 2400, type: 'bandpass', q: 1.5, attack: 0.3 }),
  melt:   s => s.melody([[784, .1], [659, .1], [523, .1], [659, .1], [784, .1], [1047, .3]], { wave: 'sine', v: 0.12 })
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
      b.y = (ty + 1) * T; b.vy = 0; b.hitHead = hit.map(tx => [tx, ty]);
    }
  }
}

/* ---------- Entities ---------- */
let nextEnt = 1;
const SIZES = { blob: [14, 11], fizz: [12, 11], bot: [14, 13], phantom: [14, 14], sloth: [18, 11], roll: [14, 14], dust: [10, 10], cube: [10, 10], fallcube: [14, 14],
  snow: [8, 8], crate: [14, 13], star: [12, 12], feather: [12, 12], glow: [12, 12], spring: [16, 10], plat: [48, 8], lift: [32, 8],
  tent: [36, 30], gate: [44, 64], cave: [32, 32], exit: [16, 32], spawner: [16, 16], boss: [40, 40], bird: [14, 14], sapling: [14, 18],
  cage: [20, 20], eagle: [28, 16], lantern: [8, 10] };
const FOES = new Set(['blob', 'fizz', 'bot', 'phantom', 'sloth']);
const HAZARDS = new Set(['roll', 'dust', 'cube', 'fallcube']);
const ITEMS = new Set(['star', 'feather', 'glow']);
const cheerable = e => FOES.has(e.k) && e.st !== 'happy';
function mkEnt(k, x, y, o){
  const sz = SIZES[k] || [12, 12];
  const e = Object.assign({ id: nextEnt++, k, x, y, w: sz[0], h: sz[1], vx: 0, vy: 0, face: -1, st: '', t: 0, on: false, dead: 0 }, o);
  G.ents.push(e); return e;
}
function spawnFromMap(o){
  const bx = o.tx * T, by = (o.ty + 1) * T;
  const foot = (k, o2) => { const sz = SIZES[k]; return mkEnt(k, bx + (T - sz[0]) / 2, by - sz[1], o2); };
  switch(o.ch){
    case 's': foot('blob', { st: 'walk' }); break;
    case 'f': foot('bot', { st: 'sit', t: (o.tx % 7) / 7 }); break;
    case 'e': mkEnt('fizz', bx + 2, o.ty * T + 3, { st: 'fly', bx: bx + 2, by: o.ty * T + 3, t: o.tx * 0.7, cool: 1 }); break;
    case 'm': mkEnt('phantom', bx + 1, o.ty * T, { st: 'float', bx: bx + 1, by: o.ty * T, t: o.tx * 0.5 }); break;
    case 'z': mkEnt('sloth', bx - 1, o.ty * T + 2, { st: 'drift', bx: bx - 1, by: o.ty * T + 2, t: o.tx * 0.3 }); break;
    case 'R': mkEnt('spawner', bx, by - 16, { on: true, st: 'idle', t: 0 }); break;
    case 'E': foot('crate', { on: true, item: 'star' }); break;
    case 'K': foot('crate', { on: true, item: 'feather' }); break;
    case 'S': foot('crate', { on: true, item: 'glow' }); break;
    case 'T': mkEnt('spring', bx, by - 10, { on: true }); break;
    case '-': mkEnt('plat', bx, o.ty * T, { on: true, bx, by: o.ty * T, range: 7 * T, speed: 0.95, t: 0, dx: 0, dy: 0 }); break;
    case '|': mkEnt('lift', bx, o.ty * T, { on: true, bx, by: o.ty * T, range: 3 * T, speed: 1.1, t: o.tx * 0.9, dx: 0, dy: 0 }); break;
    case 'C': mkEnt('tent', bx - 4, by - 30, { on: true, st: G.check !== null && G.check >= bx - 4 ? 'got' : '' }); break;
    case 'P': G.gate = mkEnt('gate', bx - 14, by - 64, { on: true }); break;
    case 'W': mkEnt('cave', bx, by - 32, { on: true, tx: o.tx, ty: o.ty }); break;
    case 'Y': mkEnt('exit', bx, by - 32, { on: true }); break;
    case 'N': case 'U': { G.lvBadgeMax++; const key = o.tx + ',' + o.ty; if(!G.karmaDone.has(key)) foot(o.ch === 'N' ? 'bird' : 'sapling', { on: true, key }); break; }
    case 'H': { const f = lvDef().friend; if(f !== undefined && !G.rescued.has(f)) foot('cage', { on: true, fid: f }); break; }
    case 'Q': mkEnt('eagle', bx - 6, o.ty * T, { on: true, st: 'perch', px: bx - 6, py: o.ty * T, land: landingX(o.tx) }); break;
    case 'L': mkEnt('lantern', bx + 4, o.ty * T, { on: true }); break;
    case 'Z': makeBoss(lvDef().boss, bx, by); break;
  }
}
/* Where an eagle drops its passengers: the first solid ground after the gap in front of its perch */
function landingX(tx){
  let x = tx + 1;
  while(x < G.W && !pitAt(x)) x++;
  while(x < G.W && pitAt(x)) x++;
  return (x + 2) * T;
}

/* ---------- Players ---------- */
function makeHero(o){
  return Object.assign({ slot: 0, source: null, name: 'Player', color: YETI_COLORS[0], x: 0, y: 0, w: HW, h: HH, vx: 0, vy: 0, face: 1,
    onGround: false, stage: 1, meter: 0, glow: 0, inv: 0, bubble: false, bubbleT: 0, dead: 0, done: 0, away: false,
    coyote: 0, buffer: 0, jumping: false, springy: false, runT: 0, runDir: 0, chain: 0, prevBottom: 0, plat: null,
    throwT: 0, snowCD: 0, squashT: 0, slipT: 0, slowT: 0, slipIx: -1, climb: false, airGood: 0, carry: 0, gliding: false,
    lf: 0, lb: 0, lk: 0, bot: false, hintB: 0 }, o);
}
const active = p => !p.bubble && !(p.dead > 0) && !p.done && !p.away;
function setStage(p, s){
  const st = STAGES[s], ow = p.w, oh = p.h, ox = p.x, oy = p.y;
  p.stage = s; p.w = st.w; p.h = st.h; p.x += (ow - p.w) / 2; p.y += oh - p.h;
  if(p.h > oh && rectSolid(p)){ p.x = ox; p.y = oy; p.w = ow; p.h = oh; p.stage = s; p.growPend = 1; return false; }
  p.growPend = 0; return true;
}
function placePlayers(x0){
  G.players.forEach((p, i) => {
    Object.assign(p, { vx: 0, vy: 0, bubble: false, dead: 0, done: 0, inv: 0, glow: 0, plat: null, chain: 0, jumping: false, springy: false,
      face: 1, climb: false, slipT: 0, slowT: 0, airGood: 0, carry: 0, gliding: false, botBest: 0, botStuck: 0, botHold: 0 });
    const st = STAGES[p.stage]; p.w = st.w; p.h = st.h;
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
    case 'toast': if(!G.demo) A.toast(arg, 4200); break;
    case 'poof': for(let i = 0; i < 7; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 80, vy: (R() - 0.7) * 60, g: 0, t: 0, life: 0.35 + R() * 0.2, col: 'rgba(255,255,255,.9)', r: 2 + R() * 2 }); break;
    case 'dust': for(let i = 0; i < 4; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 8, y, vx: (R() - 0.5) * 50, vy: -10 - R() * 20, g: 0, t: 0, life: 0.3, col: arg || 'rgba(255,245,220,.75)', r: 1.5 + R() }); break;
    case 'chunks': for(let i = 0; i < 6; i++) parts.push({ kind: 'chunk', x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 8, vx: (R() - 0.5) * 150, vy: -120 - R() * 130, g: 900, t: 0, life: 0.9, col: arg || '#8a7a6a', r: 3 + R() * 3, rot: R() * 6 }); break;
    case 'snow': for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, g: 200, t: 0, life: 0.4, col: i % 2 ? '#ffffff' : '#cfeaff', r: 1.6 }); } break;
    case 'juice': for(let i = 0; i < 6; i++){ const a = i / 6 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 55, vy: Math.sin(a) * 55 - 20, g: 120, t: 0, life: 0.4, col: arg || '#ff6a5a', r: 1.6 }); } break;
    case 'splash': for(let i = 0; i < 12; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 10, y, vx: (R() - 0.5) * 90, vy: -120 - R() * 140, g: 700, t: 0, life: 0.7, col: arg || 'rgba(190,240,255,.95)', r: 1.5 + R() * 1.5 }); break;
    case 'sparks': for(let i = 0; i < 5; i++) parts.push({ kind: 'dot', x, y, vx: (R() - 0.5) * 120, vy: -40 - R() * 80, g: 500, t: 0, life: 0.35, col: '#fff3a0', r: 1 }); break;
    case 'pop': for(let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; parts.push({ kind: 'dot', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, g: 0, t: 0, life: 0.3, col: 'rgba(210,240,255,.95)', r: 1.6 }); } break;
    case 'sparkle': for(let i = 0; i < 5; i++) parts.push({ kind: 'star', x: x + (R() - 0.5) * 12, y: y + (R() - 0.5) * 12, vx: (R() - 0.5) * 30, vy: -20 - R() * 30, g: 0, t: 0, life: 0.5, col: arg || '#fff6b0', r: 2 }); break;
    case 'hearts': for(let i = 0; i < (arg || 4); i++) parts.push({ kind: 'heart', x: x + (R() - 0.5) * 14, y: y + (R() - 0.5) * 6, vx: (R() - 0.5) * 30, vy: -30 - R() * 30, g: 0, t: 0, life: 0.9 + R() * 0.3, col: i % 2 ? '#ff7eb6' : '#ff5a6e', r: 2.2 }); break;
    case 'flour': for(let i = 0; i < 10; i++) parts.push({ kind: 'dot', x: x + (R() - 0.5) * 10, y: y + (R() - 0.5) * 6, vx: (R() - 0.5) * 90, vy: -30 - R() * 50, g: 60, t: 0, life: 0.6 + R() * 0.3, col: 'rgba(250,246,236,.9)', r: 2 + R() * 2.5 }); break;
    case 'firework': { const col = arg || '#ffd45e'; for(let i = 0; i < 26; i++){ const a = i / 26 * Math.PI * 2, sp = 70 + R() * 50; parts.push({ kind: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 60, t: 0, life: 0.9 + R() * 0.3, col, r: 1.8 }); } break; }
    case 'critter': parts.push({ kind: 'critter', x, y, vx: (arg || 1) * 26, vy: -46, g: 0, t: 0, life: 1.6, col: arg2 || '#ffb3d9' }); break;
    case 'bird': parts.push({ kind: 'bird', x, y, vx: 60, vy: -70, g: 0, t: 0, life: 2.2, col: arg || '#ffd45e' }); break;
    case 'shake': G.shake = Math.max(G.shake, x); break;
  }
  if(parts.length > 360) parts.splice(0, parts.length - 360);
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
const ropeAt = (x, y) => tileAt(Math.floor(x / T), Math.floor(y / T)) === 'v';
function underFeet(p){ const ty = Math.floor((p.y + p.h + 1) / T); return [tileAt(Math.floor((p.x + 1) / T), ty), tileAt(Math.floor((p.x + p.w - 1) / T), ty)]; }
function stepPlayer(p, dt){
  if(p.inv > 0) p.inv -= dt;
  if(p.throwT > 0) p.throwT -= dt;
  if(p.snowCD > 0) p.snowCD -= dt;
  if(p.squashT > 0) p.squashT -= dt;
  if(p.slowT > 0) p.slowT -= dt;
  if(p.glow > 0) p.glow = Math.max(0, p.glow - dt);
  if(!p.bot){ const s = A.Input.get(p.source); p.away = !(s && s.connected); } else p.away = false;
  if(p.done){ stepDone(p, dt); return; }
  if(p.dead > 0){ p.dead += dt; if(p.dead > 0.5){ p.vy = Math.min(MAX_FALL, p.vy + G_FALL * 0.7 * dt); p.y += p.vy * dt; } return; }
  if(p.bubble || (p.away && G.players.length > 1)){ stepBubble(p, dt); return; }
  if(G.state !== 'play' && !G.demo) return;
  if(p.growPend) setStage(p, p.stage);
  // riding an eagle across a big gap
  if(p.carry){
    const e = G.ents.find(q => q.id === p.carry);
    if(!e || e.st !== 'carry'){ p.carry = 0; p.vy = 0; p.jumping = false; }
    else { const k = G.players.filter(q => q.carry === e.id).indexOf(p); p.x = e.x + e.w / 2 - p.w / 2 + (k - 0.5) * 5; p.y = e.y + e.h - 3; p.vx = e.vx; p.vy = 0; p.onGround = false; p.face = 1; return; }
  }
  const c = controls(p);
  if(p.plat){ p.x += p.plat.dx; p.y += p.plat.dy; p.plat = null; }
  let dir = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  // ropes: hold UP to climb, FIRE to leap off
  const cx = p.x + p.w / 2;
  const onRope = ropeAt(cx, p.y + p.h - 3) || ropeAt(cx, p.y + 5);
  if(!p.climb && onRope && c.up && !c.fireP){ p.climb = true; p.vx = 0; p.vy = 0; p.jumping = false; p.gliding = false; p.x = Math.floor(cx / T) * T + (T - p.w) / 2; }
  if(p.climb){
    if(!onRope){ p.climb = false; }
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
  if(p.slipT > 0){ p.slipT -= dt; dir = 0; }
  if(dir) p.face = dir;
  if(dir && p.onGround){ if(dir === p.runDir) p.runT += dt; else { p.runDir = dir; p.runT = 0; } }
  else if(!dir && p.onGround) p.runT = 0;
  const feet = p.onGround ? underFeet(p) : [];
  const ice = feet.includes('I');
  const wind = G.gust > 0 && !isBoss(G.lv) ? D().wind : 0;
  let max = p.runT > 0.45 ? RUN : WALK;
  if(p.stage === 0) max *= 0.95;
  if(p.slowT > 0) max *= 0.55;
  if(p.gliding) max *= 1.2;
  if(wind) max *= dir > 0 ? 1 - 0.38 * Math.min(1, wind) : dir < 0 ? 1 + 0.25 * wind : 1;
  p.skid = false;
  if(dir){
    const reversing = Math.sign(p.vx) === -dir && Math.abs(p.vx) > 20;
    const acc = p.onGround ? (reversing ? SKID * (ice ? 0.25 : 1) : ACC * (ice ? 0.45 : 1)) : AIR_ACC;
    if(reversing && p.onGround) p.skid = true;
    if(Math.abs(p.vx) < max || Math.sign(p.vx) !== dir) p.vx += dir * acc * dt;
    if(Math.abs(p.vx) > max && Math.sign(p.vx) === dir) p.vx = dir * Math.max(max, Math.abs(p.vx) - (p.onGround ? 300 : 80) * dt);
  } else if(p.onGround){
    const f = (ice || p.slipT > 0 ? ICE_FRICTION : FRICTION) * dt, tgt = p.plat ? 0 : -18 * wind;
    const d = p.vx - tgt; p.vx = Math.abs(d) <= f ? tgt : p.vx - Math.sign(d) * f;
  }
  if(wind && !p.onGround) p.vx -= 45 * wind * dt;
  // jump (buffered, with a little coyote time), or DOWN + FIRE to throw a kindness snowball
  if(c.fireP && c.down){ throwSnow(p); }
  else if(c.fireP) p.buffer = 0.12;
  if(p.onGround) p.coyote = 0.09; else p.coyote -= dt;
  if(p.buffer > 0 && p.coyote > 0){
    const jv = (JUMP + Math.min(40, Math.abs(p.vx) * 0.22) + (p.stage === 0 ? 12 : 0)) * (p.slowT > 0 ? 0.86 : 1);
    p.vy = -jv; p.onGround = false; p.coyote = 0; p.buffer = 0; p.jumping = true; p.springy = false;
    sfx('jump');
  }
  p.buffer -= dt;
  const g = p.vy < 0 && (p.springy || (c.fire && p.jumping)) ? G_HOLD : G_FALL;
  if(p.vy >= 0){ p.jumping = false; p.springy = false; }
  p.vy = Math.min(MAX_FALL, p.vy + g * dt);
  // GLIDE power: hold FIRE while falling to float down slowly
  p.gliding = p.stage === 3 && !p.onGround && p.vy > 0 && c.fire && !c.down;
  if(p.gliding) p.vy = Math.min(p.vy, GLIDE_FALL);
  const wasGround = p.onGround;
  p.prevBottom = p.y + p.h;
  moveBody(p, dt, true);
  // MIGHTY yetis smash bricks, junk walls and boulders by running into them, and bricks by bumping them
  if(p.hitWall && p.wallTile){ const [tx, ty] = p.wallTile, ch = tileAt(tx, ty); if(p.stage >= 2) mightySmash(p, tx, ty, ch); else if(ch === 'B' || ch === 'D') mightyHint(p); }
  if(p.hitHead) for(const [tx, ty] of p.hitHead){
    const ch = tileAt(tx, ty);
    if(ch === 'B'){ if(p.stage >= 2) mightySmash(p, tx, ty, ch); else { sfx('bump'); fx('sparks', tx * T + 8, ty * T + T); mightyHint(p); } break; }
  }
  // moving platforms and bounce drums
  for(const e of G.ents){
    if((e.k === 'plat' || e.k === 'lift') && p.vy >= 0 && p.x + p.w > e.x + 1 && p.x < e.x + e.w - 1 && p.prevBottom <= e.y - e.dy + 2 && p.y + p.h >= e.y){
      p.y = e.y - p.h; p.vy = 0; p.onGround = true; p.plat = e;
    } else if(e.k === 'spring' && p.vy > 0 && p.x + p.w > e.x + 2 && p.x < e.x + e.w - 2 && p.prevBottom <= e.y + 3 && p.y + p.h >= e.y){
      p.y = e.y - p.h; p.vy = -SPRING_V; p.springy = true; p.jumping = true; p.onGround = false; e.t = 0.3; p.chain = 0;
      sfx('spring'); fx('sparkle', e.x + 8, e.y, '#ffd45e');
    }
  }
  if(p.onGround){
    p.chain = 0; p.gliding = false;
    if(!wasGround){ p.squashT = 0.12; if(p.stage >= 2 && p.prevVy > 300){ fx('dust', p.x + p.w / 2, p.y + p.h); } }
    p.airGood = 0;
  }
  p.prevVy = p.vy;
  // crumbling rock
  if(p.onGround && !p.plat){
    const ty = Math.floor((p.y + p.h + 1) / T);
    for(let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++)
      if(tileAt(tx, ty) === 'c'){ const i = ty * G.W + tx; if(!G.crumbles.has(i)) G.crumbles.set(i, 0); }
  }
  touchTiles(p);
  // falling into the water, the sand or a crevasse
  if(p.y > LH + 12){
    const pit = G.region.pit, col = pit === 'sand' ? '#e0aa55' : pit === 'abyss' ? '#7a5aa0' : pit === 'crevasse' ? '#dff4ff' : undefined;
    if(D().pitBounce || G.demo || G.god){
      p.y = LH + 12; p.vy = -540; p.springy = true; p.jumping = true; sfx('spring'); G.pitBounces = (G.pitBounces || 0) + 1;
      fx('splash', p.x + 6, LH - 6, col); fx('text', p.x + 6, LH - 30, 'BOING!', '#ffd45e');
    } else if(palOn(0) && G.ishuCD <= 0){
      p.y = LH + 12; p.vy = -560; p.springy = true; p.jumping = true; G.ishuCD = 20; sfx('friend');
      const ishu = G.pals.find(q => q.id === 0); if(ishu){ ishu.x = p.x; ishu.y = LH - 30; ishu.st = 'catch'; ishu.t = 0; }
      fx('splash', p.x + 6, LH - 6, col); fx('big', p.x + 6, LH - 50, 'ISHU CATCHES YOU!', '#ff9a5a'); fx('hearts', p.x + 6, LH - 30, 5);
    } else { fx('splash', p.x + 6, LH - 6, col); sfx(pit === 'sand' ? 'sink' : 'splash'); kill(p, true); }
  }
}
function mightyHint(p){
  if(p.hintB > G.time || G.demo) return;
  p.hintB = G.time + 4;
  fx('text', p.x + p.w / 2, p.y - 8, 'NEED MIGHTY!', '#ffd45e');
}
function mightySmash(p, tx, ty, ch){
  if(ch === 'B'){ setTile(tx, ty, '.'); fx('chunks', tx * T + 8, ty * T + 8, G.region.stone[0]); sfx('smash'); addScore(50, tx * T + 8, ty * T); fx('shake', 0.1); if(p.vy < 0) p.vy = Math.max(p.vy, -60); }
  else if(ch === 'D') smashJunk(tx, ty);
  else if(ch === 'k' || ch === 'j') smashBoulder(tx, ty);
}
function touchTiles(p){
  const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + p.w - 0.01) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + p.h - 0.01) / T);
  let onSlick = -1;
  for(let ty = y0; ty <= y1; ty++) for(let tx = x0; tx <= x1; tx++){
    const ch = tileAt(tx, ty);
    if(isGood(ch)){ setTile(tx, ty, '.'); eatGood(p, ch, tx * T + 8, ty * T + 8); }
    else if(ch === 'r' && p.y + p.h > ty * T + 11 && p.x + p.w > tx * T + 2 && p.x < tx * T + 14){
      const ix = ty * G.W + tx; onSlick = ix;
      if(p.slipIx !== ix && p.onGround && Math.abs(p.vx) > 25 && !p.climb) slip(p, ix);
    }
    else if(ch === 'F' && p.y + p.h > ty * T + 6 && p.x + p.w > tx * T + 3 && p.x < tx * T + 13) prick(p);
  }
  if(onSlick < 0) p.slipIx = -1;
}
function slip(p, ix){
  p.slipIx = ix;
  if(G.demo || G.god) return;
  p.slipT = G.diff === 'pro' ? 0.75 : 0.55; p.vx = Math.sign(p.vx) * Math.min(RUN * 1.15, Math.abs(p.vx) * 1.3);
  fx('text', p.x + p.w / 2, p.y - 6, 'SLIPPY!', '#ffe14a'); fx('splash', p.x + p.w / 2, p.y + p.h, 'rgba(230,190,60,.9)');
  sfx('slip');
}
function prick(p){
  if(p.glow > 0 || p.inv > 0) return;
  if(G.demo || G.god){ if(p.vy >= -100){ p.vy = -330; p.springy = true; p.jumping = true; p.onGround = false; } return; }
  hurt(p, 'thorns');
  if(active(p)){ p.vy = -300; p.onGround = false; p.jumping = false; fx('text', p.x + p.w / 2, p.y - 6, 'OUCH!', '#ffb347'); }
}
/* Goodness fills the Mighty Meter; a full meter grows you one size */
function eatGood(p, ch, x, y){
  if(!p.onGround) p.airGood++;
  const mult = p.airGood >= 6 ? 3 : p.airGood >= 3 ? 2 : 1;
  const n = (ch === 'p' ? 300 : 50) * mult;
  addScore(n, x, y - 6, mult > 1 ? '#ffd45e' : '#fff6e0');
  p.lf++;
  sfx('good'); fx('juice', x, y, ch === 'a' ? '#ffb020' : ch === 'b' ? '#ffe14a' : ch === 'g' ? '#8a4cc8' : ch === 'w' ? '#8fdcff' : '#f4efe2');
  addMeter(p, GOODS[ch] * D().meter);
  if(p.airGood === 3 || p.airGood === 6){
    fx('big', x, y - 16, p.airGood === 3 ? 'GOODNESS COMBO! x2' : 'GOODNESS COMBO! x3', '#ffd45e'); sfx('combo'); G.combos = (G.combos || 0) + 1;
  }
}
function addMeter(p, n){
  p.meter += n;
  if(p.meter >= 100){
    p.meter -= 100;
    if(p.stage < 3) grow(p, p.stage + 1);
    else { addScore(1000, p.x + p.w / 2, p.y - 12, '#ffd45e'); fx('sparkle', p.x + p.w / 2, p.y, '#ffd45e'); }
  }
}
const GROW_TEXT = ['', 'BACK TO YETI SIZE!', 'MIGHTY YETI!', 'GLIDE POWER!'];
function grow(p, s){
  s = Math.min(3, s);
  if(s <= p.stage){ addScore(1000, p.x + p.w / 2, p.y - 12, '#ffd45e'); return; }
  setStage(p, s); p.squashT = 0.2; p.inv = Math.max(p.inv, 0.3);
  sfx('grow'); fx('sparkle', p.x + p.w / 2, p.y + p.h / 2, '#ffd45e'); fx('sparkle', p.x + p.w / 2, p.y, '#fff');
  fx('big', p.x + p.w / 2, p.y - 18, GROW_TEXT[s], s === 3 ? '#9fe8ff' : '#ffd45e');
  if(s === 3 && !G.glideTip && !G.demo){ G.glideTip = 1; fx('toast', 0, 0, 'GLIDE POWER! Hold ' + (A.Input.isTouch ? 'JUMP' : 'FIRE') + ' in the air to float.'); }
  if(s === 2 && !G.mightyTip && !G.demo){ G.mightyTip = 1; fx('toast', 0, 0, 'MIGHTY YETI! Run into bricks and junk walls to smash them.'); }
}
function throwSnow(p){
  if(p.snowCD > 0 || p.climb || p.carry) return;
  if(G.ents.filter(e => e.k === 'snow' && e.owner === p.slot).length >= 2) return;
  const hy = p.y + Math.min(6, p.h * 0.3);
  mkEnt('snow', p.face > 0 ? p.x + p.w - 2 : p.x - 6, hy, { on: true, owner: p.slot, face: p.face, vx: p.face * 210 + p.vx * 0.35, vy: -120, t: 0, bounces: 0 });
  p.throwT = 0.2; p.snowCD = 0.24; sfx('throw');
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
  p.bubble = true; p.bubbleT = 0; p.vx = 0; p.vy = 0; p.glow = 0; p.plat = null; p.climb = false; p.slipT = 0; p.carry = 0; p.gliding = false;
  sfx('bubble');
}
function pop(p){
  p.bubble = false; p.inv = 1.5; p.vy = -170; p.vx = 0; p.onGround = false; p.jumping = false;
  if(p.stage < 1){ setStage(p, 1); }
  sfx('pop'); fx('pop', p.x + p.w / 2, p.y + p.h / 2);
}
/* A hit makes you one size smaller. A tiny yeti who gets hit loses a life (never on Kids). */
function hurt(p, why){
  if(!active(p) || p.inv > 0 || p.glow > 0) return;
  if(G.log) G.log.push(['hurt', why || '?', Math.round(p.x)]);
  if(G.demo || G.god){ p.inv = 1; return; }
  const kb = () => { p.vx = p.onGround ? -p.face * 110 : p.vx * 0.5; p.vy = -190; p.onGround = false; p.jumping = false; p.climb = false; p.gliding = false; };
  if(p.stage > 0){
    setStage(p, p.stage - 1); p.meter = 0; p.inv = 1.6; sfx('shrink'); kb();
    fx('text', p.x + p.w / 2, p.y - 8, p.stage === 0 ? 'TINY!' : 'OOF!', '#ff9a8a'); fx('poof', p.x + p.w / 2, p.y + p.h / 2);
    return;
  }
  if(D().tinySafe){ p.inv = 1.4; sfx('oof'); kb(); fx('text', p.x + p.w / 2, p.y - 8, 'OOF!', '#ffd45e'); return; }
  kill(p, false);
}
function kill(p, fell){
  if(G.demo || G.god) return;
  if(G.log) G.log.push([fell ? 'FELL' : 'KO', Math.round(p.x)]);
  p.climb = false; p.slipT = 0; p.carry = 0; p.gliding = false;
  if(G.players.length > 1){
    toBubble(p);
    if(fell){ p.x = G.cam.x + VW / 2 - 6; p.y = G.cam.y + 60; }
    fx('poof', p.x + 6, p.y + 8);
  } else {
    p.dead = 0.001; p.vy = -330; p.vx = 0; p.glow = 0;
    if(fell){ p.dead = 0.6; p.vy = 0; }
    sfx('die');
  }
}
function stepDone(p, dt){
  // walk through the basecamp gate and do a little happy dance
  const gx = G.gate ? G.gate.x + G.gate.w + 26 + p.slot * 18 : p.x;
  p.climb = false; p.carry = 0; p.gliding = false;
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

/* A little autopilot: the title-screen demo yetis (and the test harness) use it. */
function botControls(p){
  const c = { left: false, right: true, up: false, down: false, fire: false, fireP: false };
  const tick = 1 / 60;
  const boss = G.ents.find(e => e.k === 'boss' && e.st !== 'defeat');
  if(boss){
    const bx = boss.x + boss.w / 2, cx = p.x + p.w / 2, dx = bx - cx;
    const side = boss.bw === 0 ? -1 : (cx < bx ? -1 : 1);
    let want = boss.bw === 0 ? (boss.st === 'tired' ? 12.5 * T : 10 * T) : bx + side * 95;
    if(want < 2.5 * T || want > G.W * T - 2.5 * T) want = bx - side * 95;
    const warn = G.ents.find(e => e.k === 'fallcube' && Math.abs(e.x + 7 - cx) < 24);
    if(warn) want = cx + (warn.x + 7 < cx ? 60 : -60);
    if(boss.bw === 2 && boss.st === 'hop'){ const toLeft = boss.hopTo < G.W * T / 2, ahead = toLeft ? cx < bx + 20 : cx > bx - 20; if(ahead) want = toLeft ? G.W * T - 3 * T : 3 * T; }
    if(boss.bw === 2 && boss.st === 'spit' && Math.abs(dx) < 70) want = cx - Math.sign(dx) * 80;
    const lands = G.ents.filter(e => e.k === 'dust').map(e => { const g = 600, h = 12 * T - (e.y + e.h), tt = (-e.vy + Math.sqrt(Math.max(0, e.vy * e.vy + 2 * g * h))) / g; return e.x + 5 + e.vx * tt; });
    if(lands.length){ let bestX = want, bestD = -1; for(let x = 2.5 * T; x <= 14.5 * T; x += 8){ const d = Math.min(...lands.map(l => Math.abs(l - x))) - Math.abs(x - cx) * 0.05; if(d > bestD){ bestD = d; bestX = x; } } if(bestD > 0 && Math.min(...lands.map(l => Math.abs(l - cx))) < 28) want = bestX; }
    c.right = want - cx > 10; c.left = want - cx < -10;
    const faceOk = Math.sign(dx) === p.face;
    if(!c.left && !c.right && !faceOk){ if(dx > 0) c.right = true; else c.left = true; }
    if(bossWeak(boss) && faceOk && Math.abs(dx) < 170 && p.snowCD <= 0 && Math.random() < 0.3){ c.down = true; c.fireP = true; return c; }
    const threat = G.ents.some(e => (e.k === 'cube' || (e.k === 'fizz' && e.st === 'dive')) && Math.abs(e.x - cx) < 46 && e.y > p.y - 40);
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
  const foe = G.ents.find(e => e.on && cheerable(e) && e.st !== 'fade' &&
    e.x + e.w > p.x - 2 && e.x - (p.x + p.w) < 80 && Math.abs((e.y + e.h) - feet) < 40);
  const rock = G.ents.find(e => e.k === 'roll' && e.x + e.w > p.x - 4 && e.x - (p.x + p.w) < 42 + Math.abs(e.vx) * 0.25 && Math.abs(e.y + e.h - feet) < 60);
  const crate = G.ents.find(e => (e.k === 'crate' || e.k === 'bird' || e.k === 'sapling') && e.st !== 'open' && e.st !== 'free' && e.st !== 'bloom' && e.x > p.x && e.x - p.x < 70 && Math.abs(e.y + e.h - feet) < 20);
  const boulder = tileAt(tx, fr) === 'k' || tileAt(tx, fr) === 'j';
  const junk = tileAt(tx, fr) === 'D' || tileAt(tx, fr - 1) === 'D' || tileAt(tx + 1, fr) === 'D';
  const brick = tileAt(tx, fr) === 'B' || tileAt(tx, fr - 1) === 'B';
  let gapW = 0;
  if(gap) for(let i = 0; i < 12; i++){ let solid = false; for(let r = fr + 1; r < ROWS; r++){ const ch = tileAt(tx + i, r); if(isSolid(ch) || ch === '='){ solid = true; break; } } if(solid) break; gapW++; }
  const eagle = G.ents.find(e => e.k === 'eagle' && e.px + 40 > p.x && e.px - p.x < 140);
  if(eagle && gapW > 5 && !p.carry){
    // wait for the eagle, walk under it and hop up to grab its feet
    const ex = eagle.x + eagle.w / 2, cx = p.x + p.w / 2;
    if(eagle.st !== 'perch'){ c.right = false; if(gap && p.onGround) c.left = true; return c; }
    c.right = ex - cx > 3; c.left = ex - cx < -6;
    if(Math.abs(ex - cx) < 8 && p.onGround){ c.fireP = true; p.botHold = 0.4; }
    if(p.botHold > 0){ c.fire = true; p.botHold -= tick; }
    return c;
  }
  const platNear = gapW > 3 && G.ents.find(e => (e.k === 'plat' || e.k === 'lift') && e.x + e.w > p.x && e.x < p.x + 220 && e.y > p.y - 60);
  if(gap && p.onGround && platNear && !p.plat){
    const ahead = platNear.x > p.x - 6 && platNear.x - (p.x + p.w) < 26 && platNear.y > p.y - 40 && platNear.y < feet + 30;
    if(!ahead){ c.right = false; p.botStuck = 0; p.botBest = p.x; }
  }
  if(gap && p.onGround && p.plat){
    let near = false;
    for(let i = 0; i <= 4 && !near; i++){ const x = tx + i; for(let r = Math.max(2, fr - 2); r < ROWS; r++){ const ch = tileAt(x, r); if(isSolid(ch) || ch === '='){ near = i <= 3 && r >= fr - 2 && r <= fr + 4; break; } } }
    const next = G.ents.find(e => (e.k === 'plat' || e.k === 'lift') && e !== p.plat && e.x > p.x && e.x - (p.x + p.w) < 64 && Math.abs(e.y - feet) < 30);
    p.botRide = (p.botRide || 0) + tick;
    if(!near && !next && p.botRide < 8){ c.right = false; p.botStuck = 0; p.botBest = p.x; }
  } else if(p.onGround && !p.plat) p.botRide = 0;
  if(false){
  }
  if(G.gust > 0 && p.onGround && (gap || p.plat)){ c.right = false; p.botStuck = 0; p.botBest = p.x; return c; }
  if(junk && p.stage < 2){ c.right = p.x + p.w < tx * T - 12; if(p.snowCD <= 0){ c.down = true; c.fireP = true; } return c; }
  if((foe && foe.x - (p.x + p.w) < 70) || crate || (boulder && G.botSecret)){ if(p.snowCD <= 0 && Math.random() < 0.35){ c.down = true; c.fireP = true; return c; } }
  const nearFoe = foe && foe.x - (p.x + p.w) < 26;
  const smashable = (boulder && G.botSecret) || (brick && p.stage >= 2 && G.botSecret);
  if(p.onGround && (wall || gap || trap || nearFoe || rock) && c.right && !smashable){ p.botHold = 0.36 + ((p.slot * 7 + Math.floor(G.lvT)) % 3) * 0.04; c.fireP = true; }
  if(p.botHold > 0){ c.fire = true; p.botHold -= tick; }
  if(p.stage === 3 && !p.onGround && p.vy > 0 && gap){ c.fire = true; }
  if(p.x > (p.botBest || 0) + 3){ p.botBest = p.x; p.botStuck = 0; } else p.botStuck = (p.botStuck || 0) + tick;
  if(p.botStuck > 1.4 && p.botStuck < 1.7){ c.right = false; c.left = true; }
  else if(p.botStuck >= 1.7 && p.onGround){ c.fireP = true; c.fire = true; p.botHold = 0.45; p.botStuck = 0.8; }
  return c;
}

/* ---------- Yuck monsters (never hurt: they cheer up), hazards and items ---------- */
const HAPPY_COL = { blob: '#ffb3d9', fizz: '#9fe8ff', bot: '#ffd45e', phantom: '#fff6e0', sloth: '#c9b3ff' };
function cheerUp(e, p, dir, stomped){
  if(!cheerable(e)) return;
  const n = p ? CHAIN[Math.min(CHAIN.length - 1, p.chain || 0)] : 100;
  addScore(n, e.x + e.w / 2, e.y - 4, stomped && p && p.chain > 2 ? '#ffd45e' : '#fff');
  if(p){ p.lb++; if(stomped) p.chain++; }
  G.cheers++;
  e.st = 'happy'; e.t = 0; e.dead = 1;
  fx('critter', e.x + e.w / 2, e.y + e.h / 2, dir || 1, HAPPY_COL[e.k]); fx('hearts', e.x + e.w / 2, e.y, 2);
  sfx(stomped ? 'stomp' : 'cheer');
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
function openCrate(e, p){
  if(e.st === 'open') return;
  e.st = 'open'; e.t = 0;
  fx('chunks', e.x + 7, e.y + 4, '#c89a5a');
  const it = e.item;
  mkEnt(it, e.x + e.w / 2 - SIZES[it][0] / 2, e.y - 2, { on: true, st: 'rise', t: 0, vy: -150 });
  sfx('crate');
  if(p) addScore(100, e.x + 7, e.y - 4);
}
function collect(e, p){
  e.dead = 1;
  const x = e.x + e.w / 2, y = e.y;
  if(e.k === 'star'){ addScore(500); grow(p, p.stage + 1); if(p.stage < 3) p.meter = 0; }
  else if(e.k === 'feather'){ addScore(500); if(p.stage < 3) grow(p, 3); else addScore(1000, x, y, '#ffd45e'); }
  else if(e.k === 'glow'){ p.glow = 8; sfx('grow'); fx('big', x, y - 10, 'KARMA GLOW!', '#ffd45e'); addScore(500); }
  fx('sparkle', x, y + 4);
}
function karma(e, p){
  if(e.st) return;
  e.st = e.k === 'bird' ? 'free' : 'bloom'; e.t = 0;
  G.karmaDone.add(e.key); G.lvBadges++; G.badges++;
  const who = p || nearestPlayer(e.x) || G.players[0];
  if(who){ who.lk++; addMeter(who, 50); }
  addScore(1000, e.x + e.w / 2, e.y - 6, '#7dff8a');
  fx('big', e.x + e.w / 2, e.y - 18, 'KINDNESS! +1 BADGE', '#7dff8a'); fx('hearts', e.x + e.w / 2, e.y + 2, 6);
  if(e.k === 'bird' && G.region.key !== 'odisha') fx('bird', e.x + 7, e.y + 4, ['#ffd45e', '#7ad3ff', '#ff9a5a'][e.id % 3]);
  sfx('karma');
}
function freeFriend(e, p){
  if(e.st) return;
  e.st = 'open'; e.t = 0;
  const f = FRIENDS[e.fid];
  G.rescued.add(f.id); addPal(f.id, e.x + 4, e.y);
  addScore(2000, e.x + 10, e.y - 8, '#ffd45e');
  fx('big', e.x + 10, e.y - 22, f.name.toUpperCase() + ' JOINS YOU!', '#ffd45e'); fx('hearts', e.x + 10, e.y, 6); fx('toast', 0, 0, f.line);
  sfx('friend');
}
function snowHit(s, o){
  s.dead = 1; fx('snow', s.x + 4, s.y + 4);
  const p = G.players.find(q => q.slot === s.owner);
  if(cheerable(o)){ cheerUp(o, p, s.face, false); return; }
  if(o.k === 'crate'){ openCrate(o, p); return; }
  if(o.k === 'bird' || o.k === 'sapling'){ karma(o, p); return; }
  if(o.k === 'cage'){ freeFriend(o, p); return; }
  if(o.k === 'dust' || o.k === 'cube'){ o.dead = 1; addScore(100, o.x + 4, o.y - 4); fx(o.k === 'dust' ? 'flour' : 'chunks', o.x + 5, o.y + 5, '#ffe6f0'); sfx('puff'); return; }
  if(o.k === 'boss'){ snowBoss(o, s); return; }
  sfx('clink');
}
function stepEnt(e, dt){
  if(!e.on){ if(e.x < G.cam.x + VW + 40) e.on = true; else return; }
  e.t += dt;
  if(FOES.has(e.k) && e.x + e.w < G.cam.x - 160){ e.dead = 1; return; }
  if(e.k === 'roll' && e.x + e.w < G.cam.x - 160){ e.dead = 1; return; }
  if(FOES.has(e.k) && e.x > G.cam.x + VW + 120) return;
  switch(e.k){
    case 'blob': walkerAI(e, dt, 17); break;
    case 'bot':
      e.vy = Math.min(MAX_FALL, e.vy + G_FALL * 0.8 * dt);
      moveBody(e, dt);
      if(e.onGround){
        e.vx = 0;
        if(e.t > 1.5 / D().enemy){ const p = nearestPlayer(e.x); e.face = p && p.x < e.x ? -1 : 1; e.vy = -290; e.vx = e.face * 55 * D().enemy; e.t = 0; }
      }
      if(e.hitWall) e.face = -e.hitWall;
      break;
    case 'fizz': {
      e.cool -= dt;
      const p = nearestPlayer(e.x);
      if(e.st === 'fly'){
        e.x += e.face * 20 * D().enemy * dt;
        if(e.x < e.bx - 50) e.face = 1; else if(e.x > e.bx + 36) e.face = -1;
        e.y = e.by + Math.sin(e.t * 2.6) * 14;
        if(D().dive && p && e.cool <= 0 && Math.abs(p.x - e.x) < 100 && p.y > e.y){ e.st = 'aim'; e.t = 0; e.tx = p.x + p.w / 2; e.ty = p.y + 4; e.face = e.tx < e.x ? -1 : 1; }
      } else if(e.st === 'aim'){
        e.x += Math.sin(e.t * 60) * 0.6;
        if(e.t > 0.45){ e.st = 'dive'; e.t = 0; const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy) || 1, sp = 130 * D().enemy; e.vx = dx / d * sp; e.vy = dy / d * sp; if(G.region.key === 'ellora') sfx('screech'); }
      } else if(e.st === 'dive'){
        e.x += e.vx * dt; e.y += e.vy * dt;
        if(e.t > 1.0 || e.y > 11 * T){ e.st = 'back'; e.t = 0; }
      } else if(e.st === 'back'){
        e.y += (e.by - e.y) * Math.min(1, dt * 2.2); e.x += e.face * 12 * dt;
        if(Math.abs(e.y - e.by) < 2){ e.st = 'fly'; e.t = 0; e.bx = e.x; e.cool = 2.4; }
      }
      break;
    }
    case 'phantom': {
      // Maida phantoms drift slowly towards you and fade out now and then (you pass right through them when faded)
      const p = nearestPlayer(e.x), cyc = e.t % 4.2;
      e.st = cyc > 3 ? 'fade' : 'float';
      if(p && Math.abs(p.x - e.x) < 200){
        const sp = 24 * D().enemy;
        e.face = p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1;
        e.x += e.face * sp * dt;
        const ty = clamp(p.y - 4, 3 * T, 11 * T - e.h);
        e.by += clamp(ty - e.by, -1, 1) * Math.min(Math.abs(ty - e.by), 18 * dt);
      }
      e.y = e.by + Math.sin(e.t * 2.2) * 4;
      break;
    }
    case 'sloth':
      e.x = e.bx + Math.sin(e.t * 0.5) * 36; e.y = e.by + Math.sin(e.t * 1.3) * 5; e.face = Math.cos(e.t * 0.5) > 0 ? 1 : -1;
      break;
    case 'spawner': {
      const edge = G.cam.x + VW;
      if(edge > e.x - 40 && edge < e.x + 180 && G.goalT < 0){
        e.t2 = (e.t2 || 0) - dt;
        if(e.t2 <= 0 && G.ents.filter(q => q.k === 'roll').length < 3){
          e.t2 = 3.4 / D().roll;
          const x = edge + 6, y = groundY(x + 7) - 14;
          mkEnt('roll', x, y, { on: true, vx: -64 * D().roll, face: -1 }); if(!G.demo) sfx('rock');
        }
      }
      break;
    }
    case 'roll':
      e.vx = -64 * D().roll;
      e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt);
      moveBody(e, dt);
      if(e.onGround && e.vyWas > 160){ e.vy = -e.vyWas * 0.35; fx('dust', e.x + 7, e.y + 14); }
      e.vyWas = e.vy;
      if(e.hitWall){ e.dead = 1; fx('chunks', e.x + 7, e.y + 7, rollColor()); sfx('shatter'); }
      if(e.y > LH + 20) e.dead = 1;
      break;
    case 'snow': {
      e.vy += 700 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      const tx = Math.floor((e.x + 4) / T), ty = Math.floor((e.y + 4) / T), ch = tileAt(tx, ty);
      if(isSolid(ch) && ty < ROWS){
        const below = Math.floor((e.y + 8) / T), prevY = e.y - e.vy * dt;
        if(e.vy > 0 && Math.floor((prevY + 7) / T) < ty && e.bounces < 1 && ch !== 'D' && ch !== 'k' && ch !== 'j' && ch !== 'U'){
          e.y = ty * T - 8; e.vy = -150; e.bounces++; break;
        }
        e.dead = 1; fx('snow', e.x + 4, e.y + 4);
        if(ch === 'k' || ch === 'j') crackBoulder(tx, ty);
        else if(ch === 'D') junkHit(tx, ty);
        else sfx('puff');
        void below;
        break;
      }
      if(e.y > LH || e.x < G.cam.x - 30 || e.x > G.cam.x + VW + 30){ e.dead = 1; break; }
      for(const o of G.ents){
        if(o.dead || o === e || !o.on) continue;
        const target = (cheerable(o) && o.st !== 'fade') || (o.k === 'crate' && o.st !== 'open') || ((o.k === 'bird' || o.k === 'sapling' || o.k === 'cage') && !o.st) ||
          o.k === 'roll' || o.k === 'dust' || o.k === 'cube' || (o.k === 'boss' && o.st !== 'defeat');
        if(target && overlap(e, o.k === 'boss' ? bossBox(o) : o)){ snowHit(e, o); break; }
      }
      break;
    }
    case 'star': case 'feather': case 'glow':
      if(e.st === 'rise'){ e.vy += 500 * dt; e.y += e.vy * dt; if(e.t > 0.45){ e.st = 'sit'; e.vy = 0; } break; }
      if(e.k === 'star'){ e.vx = e.vx || 50; e.vy = Math.min(MAX_FALL, e.vy + G_FALL * dt); moveBody(e, dt); if(e.hitWall) e.vx = -e.hitWall * 50; if(e.onGround) e.vy = -200; }
      else { e.vy = Math.min(MAX_FALL, e.vy + G_FALL * 0.3 * dt); e.vx = 0; moveBody(e, dt); }
      if(e.y > LH + 20) e.dead = 1;
      break;
    case 'plat': { const ox = e.x; e.x = e.bx + (1 - Math.cos(e.t * e.speed)) / 2 * e.range; e.dx = e.x - ox; e.dy = 0; break; }
    case 'lift': { const oy = e.y; e.y = e.by + Math.sin(e.t * e.speed) * e.range * 0.83; e.dy = e.y - oy; e.dx = 0; break; }
    case 'spring': if(e.t > 0.3) e.t = 0.3; break;
    case 'tent':
      if(e.st !== 'got') for(const p of G.players) if(active(p) && overlap(p, e)){
        e.st = 'got'; G.check = e.x; G.ishuCD = 0; sfx('tent'); fx('sparkle', e.x + 18, e.y + 4, '#ffd45e');
        fx('text', e.x + 18, e.y - 8, 'BASECAMP!', '#7dff8a'); addScore(500); break;
      }
      break;
    case 'cave':
      if(!G.warp && !isBoulderCh(tileAt(e.tx, e.ty)) && !isBoulderCh(tileAt(e.tx + 1, e.ty))){
        e.st = 'open';
        for(const p of G.players) if(active(p) && p.x + p.w / 2 > e.x + 6 && p.x + p.w / 2 < e.x + e.w - 4 && p.y + p.h > e.y + 10){ startWarp(e); break; }
      }
      break;
    case 'eagle': stepEagle(e, dt); break;
    case 'boss': stepBoss(e, dt); break;
    case 'dust':
      e.vy += 600 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if(e.y + e.h >= groundY(e.x + 4) && e.vy > 0 && !pitAt(Math.floor((e.x + 4) / T))){ e.y = groundY(e.x + 4) - e.h; e.dead = 1; fx('flour', e.x + 5, e.y + 5); sfx('puff'); }
      if(e.y > LH + 20 || e.t > 5 || e.x < T) e.dead = 1;
      break;
    case 'cube':
      e.vy += 900 * dt; e.x += e.vx * dt; e.y += e.vy * dt;
      if(e.y + e.h >= 12 * T && e.vy > 0){ e.y = 12 * T - e.h; e.vy = -230; }
      if(e.x < T || e.x > G.W * T - T - e.w || e.t > 6){ e.dead = 1; fx('sparkle', e.x + 4, e.y + 4, '#ffe6f0'); }
      break;
    case 'fallcube':
      if(e.st === 'warn'){ if(e.t > 0.9){ e.st = 'fall'; e.vy = 60; } }
      else { e.vy += 900 * dt; e.y += e.vy * dt; if(e.y + e.h >= 12 * T){ e.dead = 1; fx('chunks', e.x + 7, 12 * T - 6, '#ffe6f0'); sfx('shatter'); fx('shake', 0.12); } }
      break;
  }
  if(FOES.has(e.k) && e.y > LH + 30) e.dead = 1;
}
function rollColor(){ return { kerala: '#7a4b2a', odisha: '#ff5a6e', ellora: '#8f8478', rajasthan: '#b88a4a', assam: '#8a5a30', sikkim: '#ffffff' }[G.region.key]; }
/* Eagles perch next to big gaps. Touch its feet and it carries you across. */
function stepEagle(e, dt){
  if(e.st === 'perch'){
    e.x = e.px; e.y = e.py + Math.sin(e.t * 3) * 3; e.vx = 0; e.face = 1;
    const riders = G.players.filter(p => active(p) && !p.carry && overlap(p, { x: e.x + 4, y: e.y + 6, w: e.w - 8, h: e.h + 6 }));
    if(riders.length){ riders.forEach(p => { p.carry = e.id; p.climb = false; p.gliding = false; }); e.st = 'carry'; e.t = 0; sfx('eagle'); fx('text', e.x + e.w / 2, e.y - 8, 'WHEEE!', '#ffd45e'); }
  } else if(e.st === 'carry'){
    const dropX = e.land;
    e.vx = 120; e.x += e.vx * dt; e.y += ((e.py - 24) - e.y) * Math.min(1, dt * 1.5);
    for(const p of G.players) if(p.carry === e.id && !active(p)) p.carry = 0;
    if(e.x + e.w / 2 >= dropX){ for(const p of G.players) if(p.carry === e.id){ p.carry = 0; p.vy = 0; p.jumping = false; } e.st = 'back'; e.t = 0; }
  } else if(e.st === 'back'){
    e.vx = -170; e.x += e.vx * dt; e.y += (e.py - 40 - e.y) * Math.min(1, dt * 2); e.face = -1;
    if(e.x <= e.px){ e.x = e.px; e.st = 'perch'; e.t = 0; }
  }
}
const isBoulderCh = ch => ch === 'k' || ch === 'j';
function boulderCluster(tx, ty, test){
  const group = new Set(), stack = [[tx, ty]];
  while(stack.length){ const [x, y] = stack.pop(), key = x + ',' + y; if(group.has(key)) continue; if(!test(tileAt(x, y))) continue; group.add(key); stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
  return [...group].map(k => k.split(',').map(Number));
}
function smashBoulder(tx, ty){
  for(const [x, y] of boulderCluster(tx, ty, isBoulderCh)){ setTile(x, y, '.'); fx('chunks', x * T + 8, y * T + 8, '#a8957e'); }
  sfx('shatter'); fx('shake', 0.2); addScore(500, tx * T + 8, ty * T - 8, '#ffd45e');
}
function crackBoulder(tx, ty){
  // cracked boulders take two snowballs (or one MIGHTY yeti)
  const cells = [];
  for(let y = ty - 1; y <= ty + 1; y++) for(let x = tx - 1; x <= tx + 1; x++){ const ch = tileAt(x, y); if(isBoulderCh(ch)) cells.push([x, y, ch]); }
  if(cells.some(c => c[2] === 'j')) smashBoulder(tx, ty);
  else { for(const c of cells) setTile(c[0], c[1], 'j'); sfx('crack'); fx('chunks', tx * T + 8, ty * T + 8, '#a8957e'); }
}
function smashJunk(tx, ty){
  const cells = boulderCluster(tx, ty, ch => ch === 'D');
  for(const [x, y] of cells){ setTile(x, y, '.'); fx('chunks', x * T + 8, y * T + 8, ['#8a7a6a', '#c0763a', '#7a8a9a'][(x + y) % 3]); }
  sfx('smash'); fx('shake', 0.3); addScore(500, tx * T + 8, ty * T - 8, '#ffd45e');
}
function junkHit(tx, ty){
  const cells = boulderCluster(tx, ty, ch => ch === 'D');
  if(!cells.length) return;
  const key = cells[0].join(','), n = (G.junk.get(key) || 0) + 1;
  G.junk.set(key, n);
  if(n >= 3) smashJunk(tx, ty);
  else { sfx('crack'); fx('chunks', tx * T + 8, ty * T + 8, '#8a7a6a'); fx('text', tx * T + 8, ty * T - 4, n === 1 ? 'CRACK!' : 'ONE MORE!', '#ffd45e'); }
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
      p.x = w.x + 4 + i * 16; p.y = w.y - p.h; p.vx = 30; p.vy = 0; p.bubble = false; p.climb = false; p.plat = null; p.onGround = true; p.inv = Math.max(p.inv, 1); p.carry = 0;
    });
    G.pals.forEach((q, i) => { q.x = w.x - 10 - i * 14; q.y = w.y - q.h; q.vx = 0; q.vy = 0; q.st = 'follow'; });
    G.ents = G.ents.filter(e => !(e.k === 'roll' || e.k === 'snow'));
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
      if(!active(p) || p.carry) continue;
      if(e.k === 'boss'){ if(overlap(p, bossBox(e))) bossContact(e, p); continue; }
      if(!overlap(p, e)) continue;
      if(ITEMS.has(e.k)){ if(e.st !== 'rise') collect(e, p); break; }
      if(e.k === 'crate'){ if(e.st !== 'open') openCrate(e, p); continue; }
      if(e.k === 'bird' || e.k === 'sapling'){ if(!e.st) karma(e, p); continue; }
      if(e.k === 'cage'){ if(!e.st) freeFriend(e, p); continue; }
      if(e.k === 'fallcube'){ if(e.st === 'fall') hurt(p, 'cube'); continue; }
      const stompy = p.vy > 0 && p.prevBottom <= e.y + Math.max(5, e.h * 0.55);
      if(HAZARDS.has(e.k)){
        if(p.glow > 0){ e.dead = 1; fx('chunks', e.x + 5, e.y + 5, e.k === 'roll' ? rollColor() : '#ffe6f0'); addScore(200, e.x + 5, e.y - 4); sfx('shatter'); continue; }
        if(e.k === 'roll' && stompy){ bounce(p, 300); p.y = e.y - p.h; sfx('boing'); addScore(100, e.x + 7, e.y - 4); continue; }
        hurt(p, e.k); continue;
      }
      if(!cheerable(e)) continue;
      if(e.k === 'phantom' && e.st === 'fade') continue;
      if(p.glow > 0){ cheerUp(e, p, p.x < e.x ? 1 : -1, false); continue; }
      if(stompy){ cheerUp(e, p, p.x < e.x ? 1 : -1, true); bounce(p); continue; }
      if(e.k === 'sloth'){ if(p.slowT <= 0){ sfx('sleepy'); fx('text', p.x + p.w / 2, p.y - 8, 'SO SLEEPY...', '#c9b3ff'); } p.slowT = 2.5; continue; }
      hurt(p, e.k);
    }
  }
  // Yeti tower: land on a friend who is standing still to spring off their head
  for(const a of act) for(const b of act){
    if(a === b || a.carry || b.carry || a.vy <= 0 || a.prevBottom > b.y + 3 || !overlap(a, b)) continue;
    a.y = b.y - a.h; b.squashT = 0.2;
    if(b.onGround && Math.abs(b.vx) < 10 && !b.climb){ bounce(a, TOWER_V); a.springy = true; sfx('tower'); fx('big', a.x + 6, a.y - 14, 'YETI TOWER!', '#ffd45e'); fx('sparkle', b.x + 6, b.y, '#fff'); G.towers = (G.towers || 0) + 1; }
    else { bounce(a, a.bot ? 280 : 260); sfx('boing'); }
  }
  // the basecamp gate at the end
  if(G.gate && G.goalT < 0) for(const p of act){
    if(p.x + p.w / 2 > G.gate.x + G.gate.w / 2){ reachGoal(); break; }
  }
}
function reachGoal(){
  G.goalT = 0; sfx('gate');
  let bonus = 0;
  for(const p of G.players){
    if(p.bubble){ p.bubble = false; p.x = G.gate.x + 4; p.y = groundY(p.x + 6) - p.h; }
    p.dead = 0; p.done = 1; p.vy = 0; p.glow = 0; p.climb = false; p.carry = 0;
    const b = (p.stage + 1) * 500 + Math.round(p.meter) * 5; bonus += b; p.bonus = b;
    fx('text', p.x + 6, p.y - 10, 'MIGHTY +' + b, '#7dff8a');
  }
  G.score += bonus;
  fx('firework', G.gate.x + 22, G.gate.y + 10, '#ffd45e');
}

/* ---------- Friends: they follow the team and help out ---------- */
const PAL_SIZE = [[12, 11], [11, 12], [18, 13]];
function addPal(id, x, y){
  if(G.pals.some(q => q.id === id)) return;
  const sz = PAL_SIZE[id];
  G.pals.push({ id, x, y: y + 20 - sz[1], w: sz[0], h: sz[1], vx: 0, vy: 0, face: 1, st: 'follow', t: 0, cd: 1.5, onGround: false });
}
const palOn = id => G.pals.some(q => q.id === id);
function friendsFor(lv){ return FRIENDS.filter(f => lv > f.lv || G.rescued.has(f.id)).map(f => f.id); }
function stepPals(dt){
  if(G.ishuCD > 0) G.ishuCD -= dt;
  const list = G.players.filter(active);
  const lead = list.length ? list.reduce((a, b) => a.x > b.x ? a : b) : G.players.find(p => p.done);
  if(!lead) return;
  G.pals.forEach((q, k) => {
    q.t += dt; if(q.cd > 0) q.cd -= dt;
    if(q.st === 'catch'){ q.vy = -200; q.y += q.vy * dt; if(q.t > 0.6){ q.st = 'follow'; q.x = lead.x - 20; q.y = groundY(q.x + 6) - q.h; fx('poof', q.x + 6, q.y + 6); } return; }
    if(q.st === 'leap'){
      q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      const tx = q.gx, ty = q.gy;
      if(Math.hypot(q.x + q.w / 2 - (tx * T + 8), q.y + q.h / 2 - (ty * T + 8)) < 12 || q.t > 0.8){
        const ch = tileAt(tx, ty);
        if(isGood(ch)){ setTile(tx, ty, '.'); const p = nearestPlayer(q.x); if(p){ eatGood(p, ch, tx * T + 8, ty * T + 8); fx('text', tx * T + 8, ty * T - 6, 'THANKS GANU!', '#ffd45e'); } }
        q.st = 'follow'; q.cd = 2.6;
      }
      if(q.y > LH + 20){ q.st = 'follow'; q.x = lead.x - 24; q.y = groundY(q.x + 6) - q.h - 10; q.vy = 0; }
      return;
    }
    if(q.st === 'charge'){
      q.face = 1; q.vx = 260; q.x += q.vx * dt;
      const ty = Math.floor((q.y + q.h - 2) / T);
      let hit = null;
      for(let r = ty - 3; r <= ty; r++){ const tx = Math.floor((q.x + q.w + 2) / T); if(tileAt(tx, r) === 'D'){ hit = [tx, r]; break; } }
      if(hit){ smashJunk(hit[0], hit[1]); fx('big', hit[0] * T, hit[1] * T - 20, 'RUDRA SMASH!', '#ffd45e'); q.st = 'follow'; q.cd = 1; q.vx = 0; }
      else if(q.t > 1.6){ q.st = 'follow'; }
      q.y = groundY(q.x + q.w / 2) - q.h;
      return;
    }
    // follow the leader, hopping over bumps and gaps
    const slotX = lead.x + lead.w / 2 - (22 + k * 16) * (lead.face || 1);
    const dx = slotX - (q.x + q.w / 2);
    const want = Math.abs(dx) > 6 ? Math.sign(dx) * Math.min(150, Math.abs(dx) * 3) : 0;
    q.vx += clamp(want - q.vx, -600 * dt, 600 * dt);
    if(Math.abs(q.vx) > 4) q.face = Math.sign(q.vx);
    q.vy = Math.min(MAX_FALL, q.vy + G_FALL * dt);
    moveBody(q, dt);
    if(q.onGround){
      const ahead = Math.floor((q.x + (q.face > 0 ? q.w + 6 : -6)) / T), fr = Math.floor((q.y + q.h - 1) / T);
      if(q.hitWall || (Math.abs(q.vx) > 20 && pitAt(ahead)) || (lead.y + lead.h < q.y - 24 && Math.abs(dx) < 40)) q.vy = -330;
    }
    if(q.y > LH + 10 || Math.abs(dx) > 260){ q.x = lead.x - 20 - k * 14; q.y = groundY(q.x + 6) - q.h - 8; q.vy = 0; q.vx = 0; fx('poof', q.x + 6, q.y + 6); }
    if(G.demo || G.state !== 'play' || G.goalT >= 0 || q.cd > 0) return;
    // Ganu leaps for goodies high above the team
    if(q.id === 1){
      const tx0 = Math.floor((lead.x - 20) / T), tx1 = Math.floor((lead.x + 150) / T);
      for(let tx = tx0; tx <= tx1; tx++) for(let ty = 1; ty < ROWS; ty++){
        if(!isGood(tileAt(tx, ty)) || ty * T > lead.y - 46) continue;
        const tgx = tx * T + 8, tgy = ty * T + 8, dist = tgx - (q.x + q.w / 2);
        if(Math.abs(dist) > 170) continue;
        const tm = 0.6; q.vx = dist / tm; q.vy = (tgy - (q.y + q.h / 2) - 0.5 * 900 * tm * tm) / tm; q.gx = tx; q.gy = ty; q.st = 'leap'; q.t = 0; q.face = Math.sign(dist) || 1;
        sfx('boing'); return;
      }
      q.cd = 0.5;
    }
    // Rudra charges junk walls in front of the team
    if(q.id === 2){
      const fr = Math.floor((lead.y + lead.h - 1) / T);
      for(let tx = Math.floor((lead.x + lead.w) / T); tx <= Math.floor((lead.x + 100) / T); tx++){
        for(let r = fr - 3; r <= fr; r++) if(tileAt(tx, r) === 'D'){ q.st = 'charge'; q.t = 0; q.x = Math.min(q.x, lead.x - 10); fx('text', q.x + 9, q.y - 8, 'CHARGE!', '#ffd45e'); sfx('drum'); return; }
      }
      q.cd = 0.4;
    }
  });
}

/* ---------- Bosses: beaten with kindness snowballs (and bops while they rest) ---------- */
function makeBoss(bw, bx, by){
  const hp = D().bossHp;
  const base = { bw, st: 'intro', hp, max: hp, inv: 0, face: -1, on: true, name: BOSS_NAMES[bw], t: 0 };
  if(bw === 0) return mkEnt('boss', 17.2 * T, LH + 10, Object.assign(base, { w: 46, h: 42 }));
  if(bw === 1) return mkEnt('boss', VW / 2 - 17, -50, Object.assign(base, { w: 36, h: 30 }));
  return mkEnt('boss', bx - 22, 12 * T + 20, Object.assign(base, { w: 44, h: 46 }));
}
const BOSS_WH = [[46, 42], [36, 30], [44, 46]];
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
    if(e.bw === 2){ e.vy = 0; } else { e.vy += 300 * dt; e.y += e.vy * dt; e.x += e.face * 20 * dt; }
    if(Math.random() < 0.3) fx('sparkle', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#fff');
    if(Math.random() < 0.15) spawnFx('hearts', e.x + e.w / 2, e.y + 10, 1);
    if(e.t > 2.6){ e.dead = 1; bossDefeated(e); }
    return;
  }
  if(e.bw === 0){
    // The Sandstorm Djinn whirls in the quicksand, lobs balls of maida dust, then flops on the sand for a rest
    const up = ground - 30, low = ground - 20;
    if(e.st === 'intro'){ e.y += (up - e.y) * Math.min(1, dt * 1.6); if(Math.random() < 0.3) fx('flour', e.x + Math.random() * e.w, ground + 4); if(e.t > 1.8) setBoss(e, 'throw'); return; }
    if(e.st === 'throw'){
      e.y = up + Math.sin(G.time * 3) * 2;
      const n = G.diff === 'kids' ? 2 : 3 + Math.min(2, Math.floor(anger / 3)), gap = 0.62 / spd;
      for(let i = 0; i < n; i++){ const at = 0.5 + i * gap; if(e.t - dt < at && e.t >= at){
        const sx = e.x + 6, sy = e.y + 8, fl = 1.15, aimX = clamp(tx + (i - 1) * 26, 2 * T, 15 * T);
        mkEnt('dust', sx, sy, { on: true, vx: (aimX - sx) / fl, vy: (ground - 8 - sy) / fl - 0.5 * 600 * fl, face: -1 }); sfx('throw');
      } }
      if(e.t > 0.5 + n * gap + 0.4) setBoss(e, 'sink');
    } else if(e.st === 'sink'){ e.y += 90 * dt; if(e.y > ground + 12){ setBoss(e, e.rested ? 'rise' : 'lunge'); e.rested = !e.rested; e.x = e.rested ? 15.6 * T : 17.2 * T; } }
    else if(e.st === 'rise'){ e.y -= 80 * dt; if(e.y <= up){ e.y = up; setBoss(e, 'throw'); } }
    else if(e.st === 'lunge'){ e.y -= 90 * dt; if(e.y <= low){ e.y = low; setBoss(e, 'tired'); fx('flour', e.x + 10, ground + 2); sfx('sink'); } }
    else if(e.st === 'tired'){ e.y = low + Math.sin(e.t * 4) * 1.2; if(e.t > (G.diff === 'kids' ? 3.4 : 2.6)) setBoss(e, 'sink'); }
    e.face = -1;
  } else if(e.bw === 1){
    // The Bat Swarm hovers, sends out little bats, then swoops down and lands in a dizzy heap
    const high = 36;
    if(e.st === 'intro'){ e.y += (high - e.y) * Math.min(1, dt * 1.5); if(e.t > 1.8) setBoss(e, 'hover'); return; }
    e.face = toward;
    if(e.st === 'hover'){
      e.x += clamp(tx - e.w / 2 - e.x, -1, 1) * Math.min(Math.abs(tx - e.w / 2 - e.x), 55 * spd * dt);
      e.y = high + Math.sin(G.time * 2.6) * 6;
      if(e.t > 1.8 / spd){ e.n = (e.n || 0) + 1; setBoss(e, e.n % 2 ? 'summon' : 'aim'); }
    } else if(e.st === 'summon'){
      if(e.t - dt < 0.4 && e.t >= 0.4){
        const bats = G.ents.filter(q => q.k === 'fizz').length, n = G.diff === 'kids' ? 1 : 2;
        for(let i = 0; i < n && bats + i < 3; i++) mkEnt('fizz', e.x + e.w / 2 - 6 + (i ? 14 : -14), e.y + e.h, { on: true, st: 'fly', bx: e.x + (i ? 60 : -40), by: 70 + i * 20, t: i, cool: 1.5, face: i ? 1 : -1 });
        sfx('screech');
      }
      if(e.t > 1.0) setBoss(e, 'hover');
    } else if(e.st === 'aim'){ e.x += Math.sin(e.t * 50) * 0.8; e.tx = tx - e.w / 2; if(Math.floor(e.t * 8) !== Math.floor((e.t - dt) * 8)) sfx('warn'); if(e.t > 0.8){ setBoss(e, 'dive'); sfx('screech'); } }
    else if(e.st === 'dive'){
      const dx = e.tx - e.x; e.x += clamp(dx, -1, 1) * Math.min(Math.abs(dx), 160 * dt); e.y += 230 * spd * dt;
      if(e.y + e.h >= ground){ e.y = ground - e.h; setBoss(e, 'stuck'); fx('shake', 0.3); sfx('land'); fx('dust', e.x + e.w / 2, ground); }
    } else if(e.st === 'stuck'){ e.x += Math.sin(e.t * 30) * 0.4; if(e.t > (G.diff === 'kids' ? 2.6 : 1.9)) setBoss(e, 'rise'); }
    else if(e.st === 'rise'){ e.y -= 110 * dt; if(e.y <= high){ e.y = high; setBoss(e, 'hover'); } }
    e.x = clamp(e.x, T + 2, G.W * T - T - 2 - e.w);
  } else {
    // The Sugar Cube King stomps (sugar cubes rain down), flings bouncing cubes, hops across, then needs a sit-down
    const floor = ground - e.h;
    if(e.st === 'intro'){ e.y += (floor - e.y) * Math.min(1, dt * 1.2); if(Math.random() < 0.4) fx('snow', e.x + Math.random() * e.w, ground); if(e.t > 2.2){ e.y = floor; setBoss(e, 'drum'); } return; }
    if(e.st === 'drum'){
      const n = G.diff === 'kids' ? 2 : 3 + Math.min(2, Math.floor(anger / 3));
      for(let i = 0; i < n; i++){ const at = 0.3 + i * 0.38; if(e.t - dt < at && e.t >= at){
        const x = i === 0 ? clamp(tx - 7, 2 * T, G.W * T - 3 * T) : 2 * T + Math.random() * (G.W - 5) * T;
        mkEnt('fallcube', x, T, { on: true, st: 'warn' }); sfx('drum'); fx('shake', 0.08);
      } }
      if(e.t > 0.3 + n * 0.38 + 0.4){ e.face = toward; setBoss(e, 'spit'); }
    } else if(e.st === 'spit'){
      const n = G.diff === 'kids' ? 1 : 2;
      for(let i = 0; i < n; i++){ const at = 0.4 + i * 0.5; if(e.t - dt < at && e.t >= at){
        mkEnt('cube', e.face > 0 ? e.x + e.w - 4 : e.x - 6, e.y + 22, { on: true, vx: e.face * 95 * spd, vy: -120, face: e.face }); sfx('spit');
      } }
      if(e.t > 0.4 + n * 0.5 + 0.3){ setBoss(e, 'hop'); e.vy = -440; e.hopTo = e.x + e.w / 2 < G.W * T / 2 ? G.W * T - 5 * T : 3 * T; }
    } else if(e.st === 'hop'){
      e.vy += 1000 * dt; e.y += e.vy * dt; e.x += clamp(e.hopTo - e.x, -1, 1) * Math.min(Math.abs(e.hopTo - e.x), 170 * dt);
      if(e.y >= floor && e.vy > 0){ e.y = floor; e.vy = 0; setBoss(e, 'tired'); fx('shake', 0.45); sfx('land'); fx('snow', e.x + e.w / 2, ground); }
    } else if(e.st === 'tired'){ if(e.t > (G.diff === 'kids' ? 3.2 : 2.4)){ setBoss(e, 'drum'); } }
    e.x = clamp(e.x, T + 1, G.W * T - T - 1 - e.w);
  }
}
function hitBoss(e, n){
  e.hp = Math.max(0, e.hp - (n || 1)); e.inv = 0.55;
  sfx('bossHit'); fx('shake', 0.2); fx('sparkle', e.x + e.w / 2, e.y + 6, '#fff'); fx('hearts', e.x + e.w / 2, e.y + 4, 2);
  addScore(500 * (n || 1), e.x + e.w / 2, e.y - 6, '#ffd45e');
  if(e.hp <= 0){
    setBoss(e, 'defeat'); e.vy = -200; e.inv = 0; sfx('melt');
    G.ents.forEach(q => { if(HAZARDS.has(q.k)) q.dead = 1; else if(q.k === 'fizz' && cheerable(q)) cheerUp(q, null, 1, false); });
    for(let i = 0; i < 3; i++) fx('firework', e.x + Math.random() * e.w, e.y + Math.random() * e.h, '#ffd45e');
    fx('toast', 0, 0, BOSS_WIN[e.bw]);
  }
}
function snowBoss(e, s){
  if(e.st === 'defeat' || e.st === 'intro') return;
  if(!bossWeak(e)){ fx('snow', s.x + 4, s.y + 4); sfx('clink'); return; }
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
    bounce(p, 300); hurt(p, 'boss'); return;
  }
  if(p.glow > 0){ if(e.inv <= 0) hitBoss(e, 1); return; }
  if(resting || e.inv > 0.3) return;
  hurt(p, 'boss');
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
    if(!active(p) || p.carry) continue;
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
      setTile(tx, ty, '.'); fx('chunks', tx * T + 8, ty * T + 8, G.region.stone[0]); sfx('crumble');
    } else G.crumbles.set(i, nt);
  }
}
/* Rajasthan sandstorms: every few seconds a gust pushes the team back */
function stepWind(dt){
  if(!lvDef().wind || isBoss(G.lv)){ G.gust = 0; return; }
  G.windT += dt;
  const cyc = G.windT % 9;
  if(cyc >= 6 && cyc - dt < 6 && !G.demo){ fx('big', G.cam.x + VW / 2, 60, 'SANDSTORM!', '#ffe7a8'); sfx('wind'); }
  G.gust = cyc >= 6.4 ? 1 : 0;
}

/* ---------- Level flow ---------- */
function loadLevel(ix, fromCheck){
  const L = buildLevel(ix);
  if(!fromCheck){ G.karmaDone = new Set(); G.lvBadges = 0; }
  G.lv = ix; G.W = L.W; G.map = L.map.slice(); G.region = L.region; G.mods = []; G.crumbles = new Map(); G.junk = new Map();
  G.ents = []; nextEnt = 1; G.gate = null; G.goalT = -1; G.wipeT = 0; G.shake = 0; G.warp = null; G.lvBadgeMax = 0; G.gust = 0; G.windT = 0; G.ishuCD = 0;
  if(!fromCheck){ G.check = null; G.lvT = 0; G.levelScore = G.score; G.levelBadges = G.badges; G.secret = false; for(const p of G.players){ p.lf = 0; p.lb = 0; p.lk = 0; } }
  for(const e of L.ents) spawnFromMap(e);
  G.loadN++; parts = [];
  placePlayers(G.check !== null ? G.check + 2 : L.start.tx * T + 2);
  G.pals = [];
  const lead = G.players[0];
  const fl = G.demo ? FRIENDS.filter(f => ix > f.lv).map(f => f.id) : friendsFor(ix);
  fl.forEach((id, k) => addPal(id, (lead ? lead.x : 40) - 22 - k * 16, (lead ? lead.y + lead.h : 12 * T) - 20));
  G.pals.forEach(q => { q.y = groundY(q.x + q.w / 2) - q.h; });
  // basecamp cheers everyone on before a boss: at least MIGHTY size (at least YETI on Pro)
  if(isBoss(ix)) for(const p of G.players){ const want = G.diff === 'pro' ? 1 : 2; if(p.stage < want){ p.stage = want; const st = STAGES[want]; p.w = st.w; p.h = st.h; p.y = groundY(p.x + p.w / 2) - p.h; } }
  camera(0, true);
}
function startIntro(short){
  A.Menu.close();
  const first = !short && (G.lv === 0 || LEVELS[G.lv - 1].i !== lvDef().i);
  G.state = 'intro'; G.stateT = 0; G.introLen = short ? 1.4 : first ? 4.2 : 2.4;
  sfx('stageStart'); A.keepAwake();
  if(isBoss(G.lv) && !G.demo) A.toast(BOSS_LINES[lvDef().boss], 3400);
}
function newGame(players){
  G.demo = false;
  G.roster = players.map(p => ({ slot: p.slot, source: p.source, name: p.name, color: p.color }));
  G.players = G.roster.map(r => makeHero(Object.assign({}, r)));
  G.score = 0; G.lives = D().lives; G.badges = 0; G.cheers = 0; G.rescued = new Set();
  loadLevel(G.startLv); startIntro();
}
function startDemo(){
  G.demo = true;
  const pick = [0, 2, 4, 7, 10, 12].filter(i => i <= Math.max(2, G.unlocked));
  const ix = pick[Math.floor(Math.random() * pick.length)];
  G.players = [makeHero({ slot: 0, bot: true, name: 'Durgi', color: YETI_COLORS[0] }), makeHero({ slot: 1, bot: true, name: 'Krish', color: YETI_COLORS[1] })];
  G.players[1].stage = 2;
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
    const p = makeHero({ slot, source: s.id, color: YETI_COLORS[slot], name });
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
  for(const p of G.players){ p.glow = 0; p.stage = Math.max(1, Math.min(p.stage, 1)); p.meter = 0; }
  loadLevel(G.lv, true); startIntro(true);
}
function startClear(){
  G.state = 'clear'; G.stateT = 0; sfx('fanfare');
  G.unlocked = Math.max(G.unlocked, Math.min(LEVELS.length - 1, G.lv + 1)); A.Store.set('yeti.unlocked', G.unlocked);
}
function results(){
  G.state = 'results'; G.stateT = 0;
  const key = 'yeti.best.' + G.lv + '.' + G.diff, best = A.Store.get(key, 0);
  let rec = false;
  if(!best || G.lvT < best){ A.Store.set(key, r1(G.lvT)); rec = true; }
  const def = lvDef(), last = G.lv >= LEVELS.length - 1;
  const rows = G.players.map(p => '<b style="color:' + p.color + '">' + A.esc(p.name) + '</b> · ' + p.lf + (p.lf === 1 ? ' goodie · ' : ' goodies · ') + p.lb + ' cheered up' +
    (p.lk ? ' · ' + p.lk + ' kind deed' + (p.lk > 1 ? 's' : '') : '') + (p.bonus ? ' · mighty +' + p.bonus : '')).join('<br>');
  G.players.forEach(p => { p.bonus = 0; });
  const title = isBoss(G.lv) ? BOSS_TITLES[def.boss] + ' is calm again!' : 'Stage ' + def.code + ' clear!';
  const kind = G.lvBadgeMax ? '<br>Kindness badges here: <b>' + G.lvBadges + ' of ' + G.lvBadgeMax + '</b>' + (G.lvBadges >= G.lvBadgeMax ? ' · every critter helped!' : '') : '';
  const items = [];
  if(last) items.push({ label: 'See the ending', select: ending });
  else items.push({ label: 'Next: ' + LEVELS[G.lv + 1].code + ' ' + LEVELS[G.lv + 1].name, select: () => { nextLevel(); } });
  items.push({ label: 'Play it again', select: () => { G.score = G.levelScore; G.badges = G.levelBadges; loadLevel(G.lv); startIntro(); } });
  items.push({ label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) });
  if(!hosting()) items.push({ label: 'Quit to title', select: toTitle });
  A.Menu.open({ center: true, shared: true, kicker: def.code + ' · ' + def.name + ' · ' + D().label, title,
    text: rows + kind + (G.secret ? '<br>You found the <b>secret shortcut</b>!' : '') + '<br><br>Team score <b>' + G.score.toLocaleString() + '</b> · time <b>' + fmt(G.lvT) + '</b>' + (rec ? ' · <b>new best!</b>' : best ? ' · best ' + fmt(best) : ''),
    items });
}
function nextLevel(){
  const n = G.lv + 1;
  for(const p of G.players){ p.done = 0; p.bubble = false; }
  G.startLv = n; loadLevel(n); startIntro();
}
function ending(){
  A.Menu.close();
  G.state = 'ending'; G.stateT = 0; A.Store.set('yeti.beaten', true);
  G.ents = G.ents.filter(e => !HAZARDS.has(e.k) && e.k !== 'fizz' && e.k !== 'snow');
  G.players.forEach((p, i) => { p.done = 0; p.bubble = false; p.dead = 0; p.x = G.cam.x + VW / 2 - 30 + i * 22; p.y = 12 * T - p.h; p.vx = 0; p.vy = 0; p.onGround = true; p.face = 1; p.glow = 0; });
  [0, 1, 2].forEach(id => addPal(id, G.cam.x + 60 + id * 26, 12 * T - 20));
  G.pals.forEach((q, k) => { q.x = G.cam.x + (k < 2 ? 70 + k * 30 : VW - 90); q.y = 12 * T - q.h; q.st = 'party'; });
}
function endingMenu(){
  A.Menu.open({ center: true, shared: true, kicker: 'Mighty Yeti · A Wild Quest Across India', title: 'You made it to the top!',
    text: 'Not by being the biggest or the fastest, but by being kind all the way up. Every critter you cheered and every friend you helped climbed with you. That is what makes a yeti mighty. The mountains are big, but a kind heart is bigger.<br>' +
          '<b>Eat well. Explore more. Be kind. Stay humble.</b><br><br>' +
          'Team score <b>' + G.score.toLocaleString() + '</b> · kindness badges <b>' + G.badges + '</b> · yucks cheered up <b>' + G.cheers + '</b><br><br>' +
          '<span style="font-size:.85em">Thank you for climbing with us, little explorer. Made with love by <b>Humble Yeti</b>, mighty goodness for little explorers. Grown-ups, thank you for playing alongside them. Come and say hello: ' +
          '<a href="https://humbleyeti.com" target="_blank" rel="noopener" style="color:#C5DF8A">humbleyeti.com</a></span>',
    items: [
      { label: 'Play again from 1-1', select: () => { G.startLv = 0; newGame(G.roster); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function gameOver(){
  G.state = 'gameover'; G.stateT = 0; sfx('gameOver');
  A.Menu.open({ center: true, shared: true, kicker: lvDef().code + ' · ' + lvDef().name, title: 'Take a breath, explorer!',
    text: 'Every mountain is climbed one step at a time. Pick up right where you were with fresh lives.',
    items: [
      { label: 'Keep going', select: () => { G.lives = D().lives; G.score = G.levelScore; G.badges = G.levelBadges; for(const p of G.players){ p.stage = 1; p.meter = 0; } loadLevel(G.lv); startIntro(); } },
      { label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) },
      ...(hosting() ? [] : [{ label: 'Quit to title', select: toTitle }])
    ] });
}
function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

function sim(dt){
  G.lvT += dt;
  if(G.warp){ stepWarp(dt); for(const e of G.ents) if(e.k === 'plat' || e.k === 'lift') stepEnt(e, dt); return; }
  stepWind(dt);
  for(const e of G.ents) if(e.k === 'plat' || e.k === 'lift' || e.k === 'eagle') stepEnt(e, dt);
  for(const p of G.players) stepPlayer(p, dt);
  for(const e of G.ents) if(!e.dead && e.k !== 'plat' && e.k !== 'lift' && e.k !== 'eagle') stepEnt(e, dt);
  interact();
  stepPals(dt);
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
  A.Menu.open({ kicker: 'Humble Yeti presents', title: 'MIGHTY YETI<br><span style="font-size:.3em;letter-spacing:.06em;color:#C5DF8A">A WILD QUEST ACROSS INDIA</span>',
    text: 'Himu the explorer yeti is off on a quest from the backwaters of <b>Kerala</b> to the top of <b>Kangchenjunga</b>! Gobble up <b>goodness</b> to grow mighty, throw <b>kindness snowballs</b> to cheer up the yucky Sugar Blobs, and help friends along the way. <b>1–4 yetis</b> on one screen, or online.',
    items: [
      { label: 'Play', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Start at', value: () => levelLabel(G.startLv), change: d => { G.startLv = (G.startLv + d + G.unlocked + 1) % (G.unlocked + 1); A.Store.set('yeti.start', G.startLv); } },
      { label: 'Difficulty', value: () => D().label, change: d => { G.diff = DIFF_ORDER[(DIFF_ORDER.indexOf(G.diff) + d + 3) % 3]; A.Store.set('yeti.diff', G.diff); } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: controllerLine() });
}
function controllerLine(){
  const n = A.Input.pads().length;
  const unl = G.unlocked > 0 ? 'Unlocked up to ' + LEVELS[G.unlocked].code + '. ' : '';
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') + unl + 'Kids mode: no game over, and water bounces you back.';
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting();
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + levelLabel(G.startLv) + ' · ' + D().label,
    title: 'Who is exploring?',
    text: online ? 'Friends join from any device with the code or invite link. Press FIRE to join, then FIRE again when ready.'
                 : 'Press FIRE to join, then FIRE again when ready. 1 to 4 yetis share one screen. A friend can drop in later by pressing FIRE.',
    min: 1, max: 4, colors: YETI_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => newGame(players),
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : titleMenu
  });
}
function pause(){
  if(G.state !== 'play' && G.state !== 'intro') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const items = [{ label: 'Resume', select: resume }, { label: 'Restart stage', select: () => { G.score = G.levelScore; G.badges = G.levelBadges; loadLevel(G.lv); startIntro(); } }];
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
    text: 'The host gets a <b>4-letter code</b>; friends type it in or open the invite link. Up to four yetis from any mix of devices.',
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
    Net.host('yeti', name, netHandlers).then(() => { G.net = 'host'; A.Sound.play('online'); openLobby(src); },
      why => { A.toast(Net.why(why), 4000); onlineMenu(src); });
  }, () => onlineMenu(src));
}
function joinRoom(code){
  withName(name => {
    A.Menu.open({ center: true, kicker: 'Room ' + code, title: 'Joining…', items: [] });
    Net.join(code, 'yeti', name, netHandlers).then(() => {
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
  const touch = A.Input.isTouch, J = touch ? 'JUMP' : 'A / Space / FIRE', F = touch ? 'JUMP' : 'FIRE';
  A.Menu.open({ center: true, kicker: 'How to play', title: 'Explorer tips',
    text: '<b>Left / right</b> run (keep holding to sprint) · <b>' + J + '</b> jumps, hold it to jump higher · <b>Down + ' + F + '</b> throws a <b>kindness snowball</b>.<br>' +
          'Gobble up <b>goodness</b> (mangoes, bananas, jamun, coconuts, water) to fill the <b>Mighty Meter</b>. A full meter makes you bigger: <b>Tiny → Yeti → Mighty → Glide</b>. A bump makes you one size smaller.<br>' +
          '<b>Mighty</b> yetis smash bricks and junk walls. <b>Glide</b> yetis hold ' + F + ' in the air to float. Crates hide stars, feathers and the <b>Karma Glow</b>.<br>' +
          'Yuck monsters are never hurt: a snowball or a bop turns them into happy critters. Free trapped critters and water thirsty saplings for <b>kindness badges</b>. Friends you rescue follow you and help. Two or more yetis? Land on a friend standing still for a <b>Yeti Tower</b>.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Online: snapshots ---------- */
const buf = new A.SnapBuffer(0.08);
let netStep = 0, modsSent = 0, lastLoadSent = -1, snapN = 0, forceFull = false;
const KINDS = ['blob', 'fizz', 'bot', 'phantom', 'sloth', 'roll', 'dust', 'cube', 'fallcube', 'snow', 'crate', 'star', 'feather', 'glow', 'spring', 'plat', 'lift', 'tent', 'gate', 'cave', 'exit', 'spawner', 'boss', 'bird', 'sapling', 'cage', 'eagle', 'lantern'];
const KI = {}; KINDS.forEach((k, i) => { KI[k] = i; });
const ITEM_IX = ['star', 'feather', 'glow'];
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
    if(q.k !== 'boss' && q.k !== 'gate' && q.k !== 'eagle' && (q.x + q.w < cx - 40 || q.x > cx + VW + 40)) continue;
    const row = [q.id, KI[q.k], r1(q.x), r1(q.y), q.face, q.st || '', r2(q.t)];
    if(q.k === 'boss') row.push([q.hp, q.max, r2(q.inv), q.bw]);
    else if(q.k === 'crate') row.push(ITEM_IX.indexOf(q.item));
    else if(q.k === 'cage') row.push(q.fid);
    e.push(row);
  }
  const s = { t: 's', tm: r2(G.time), st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), lv: G.lv, ln: G.loadN, d: G.diff, dm: G.demo ? 1 : 0,
    sc: G.score, li: hasLives() ? G.lives : -1, cx: r1(cx), gt: r2(G.goalT), lt: r1(G.lvT), il: G.introLen, wp: G.warp ? r2(G.warp.t) : -1,
    bd: G.badges, lb: G.lvBadges, lbm: G.lvBadgeMax, gu: G.gust, ch: G.cheers,
    p: G.players.map(p => [p.slot, r1(p.x), r1(p.y), Math.round(p.vx), Math.round(p.vy), p.face,
      (p.onGround ? 1 : 0) | (p.bubble ? 2 : 0) | (p.done ? 4 : 0) | (p.inv > 0 ? 8 : 0) | (p.away ? 16 : 0) | (p.skid ? 32 : 0) | (p.gliding ? 64 : 0) | (p.climb ? 128 : 0) | (p.slipT > 0 ? 256 : 0) | (p.slowT > 0 ? 512 : 0) | (p.carry ? 1024 : 0),
      p.stage, r1(p.meter), r2(p.dead), r2(p.glow), p.name, p.color, p.source || '', p.lf, r2(p.bubbleT), r2(p.throwT), r2(p.squashT)]),
    pl: G.pals.map(q => [q.id, r1(q.x), r1(q.y), q.face, q.st, Math.round(q.vx)]),
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
  G.lv = lv; G.W = L.W; G.region = L.region; G.map = L.map.slice(); G.modsApplied = 0;
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
  G.badges = s.bd || 0; G.lvBadges = s.lb || 0; G.lvBadgeMax = s.lbm || 0; G.gust = s.gu || 0; G.cheers = s.ch || 0;
  if(G.state === 'intro' && guestLastState !== 'intro' && isBoss(G.lv) && !G.demo) A.toast(BOSS_LINES[lvDef().boss], 3400);
  guestLastState = G.state;
  G.cam.x = a.lv === b.lv && Math.abs(a.cx - b.cx) < 80 ? L(a.cx, b.cx) : b.cx; G.cam.y = LH - VH;
  const pp = new Map(a.p.map(q => [q[0], q]));
  G.players = s.p.map(q => {
    const o = pp.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60 && Math.abs(o[2] - q[2]) < 60;
    const f = q[6], st = STAGES[q[7]] || STAGES[1];
    return { slot: q[0], x: near ? L(o[1], q[1]) : q[1], y: near ? L(o[2], q[2]) : q[2], vx: q[3], vy: q[4], face: q[5],
      onGround: !!(f & 1), bubble: !!(f & 2), done: (f & 4) ? 1 : 0, inv: (f & 8) ? 1 : 0, away: !!(f & 16), skid: !!(f & 32),
      gliding: !!(f & 64), climb: !!(f & 128), slipT: (f & 256) ? 0.3 : 0, slowT: (f & 512) ? 1 : 0, carry: (f & 1024) ? 1 : 0,
      stage: q[7], meter: q[8], dead: q[9], glow: q[10], name: q[11], color: q[12], source: q[13], lf: q[14], w: st.w, h: st.h,
      bubbleT: q[15], throwT: q[16], squashT: q[17] };
  });
  const ap = new Map((a.pl || []).map(q => [q[0], q]));
  G.pals = (s.pl || []).map(q => { const o = ap.get(q[0]), near = o && Math.abs(o[1] - q[1]) < 60; const sz = PAL_SIZE[q[0]];
    return { id: q[0], x: near ? L(o[1], q[1]) : q[1], y: near ? L(o[2], q[2]) : q[2], face: q[3], st: q[4], vx: q[5], w: sz[0], h: sz[1], onGround: true }; });
  const pe = new Map(a.e.map(q => [q[0], q]));
  G.ents = s.e.map(q => {
    const o = pe.get(q[0]), near = o && Math.abs(o[2] - q[2]) < 48 && Math.abs(o[3] - q[3]) < 48;
    const k = KINDS[q[1]], sz = SIZES[k] || [12, 12];
    const e = { id: q[0], k, x: near ? L(o[2], q[2]) : q[2], y: near ? L(o[3], q[3]) : q[3], w: sz[0], h: sz[1], face: q[4], st: q[5], t: q[6], on: true };
    if(k === 'boss'){ const x = q[7]; e.hp = x[0]; e.max = x[1]; e.inv = x[2]; e.bw = x[3]; e.w = BOSS_WH[e.bw][0]; e.h = BOSS_WH[e.bw][1]; e.name = BOSS_NAMES[e.bw]; }
    else if(k === 'crate') e.item = ITEM_IX[q[7]] || 'star';
    else if(k === 'cage') e.fid = q[7];
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
  if(G.demo || st === 'title' || st === 'lobby' || st === 'online') want = TITLE_THEME;
  else if(st === 'ending') want = ENDING_THEME;
  else if(st === 'results' || st === 'gameover') want = TITLE_THEME;
  else if(st === 'intro' || st === 'play' || st === 'paused'){
    if(G.goalT >= 0) want = null;
    else if(G.players.length === 1 && G.players[0].dead > 0) want = null;
    else if(G.players.some(p => p.glow > 0 && !p.bubble && !p.done)) want = GLOW_THEME;
    else if(isBoss(G.lv)) want = boss && boss.st !== 'defeat' ? BOSS_THEME : null;
    else want = G.region.music;
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
        fx('firework', hx - 60 + Math.random() * 120, 40 + Math.random() * 50, YETI_COLORS[Math.floor(Math.random() * 4)]); sfx('firework');
      }
      if(G.stateT > 3.4) results();
      break;
    case 'ending':
      G.stateT += dt;
      for(const p of G.players){ p.vy += G_FALL * dt; p.y += p.vy * dt; if(p.y + p.h >= 12 * T){ p.y = 12 * T - p.h; p.vy = 0; p.onGround = true; if(Math.random() < 0.02){ p.vy = -300; p.onGround = false; } } else p.onGround = false; }
      for(const q of G.pals){ q.vy = (q.vy || 0) + G_FALL * dt; q.y += q.vy * dt; if(q.y + q.h >= 12 * T){ q.y = 12 * T - q.h; q.vy = Math.random() < 0.03 ? -260 : 0; } }
      if(Math.floor(G.stateT * 1.6) !== Math.floor((G.stateT - dt) * 1.6)){ fx('firework', G.cam.x + 40 + Math.random() * (VW - 80), 30 + Math.random() * 60, YETI_COLORS[Math.floor(Math.random() * 4)]); sfx('firework'); }
      if(G.stateT > 12.4 && !A.Menu.isOpen()) endingMenu();
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
function tri(c, x1, y1, x2, y2, x3, y3){ c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill(); }

/* The Humble Yeti logo, redrawn in code: HUMBLE arched over a green disc, with "Yeti" in bold white lettering outlined in orange */
function drawLogo(c, x, y, s){
  c.save(); c.translate(x, y); c.scale(s, s);
  const g = c.createLinearGradient(-26, -30, 26, 30); g.addColorStop(0, HY.lime); g.addColorStop(0.55, HY.leaf); g.addColorStop(1, HY.green);
  c.fillStyle = 'rgba(0,0,0,.25)'; circ(c, 2, 3, 38); c.fill();
  c.fillStyle = g; circ(c, 0, 0, 38); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 0.8; circ(c, 0, 0, 34.5); c.stroke();
  // HUMBLE along the top arc
  c.font = '600 13px ' + SANS; c.fillStyle = HY.dark; c.textAlign = 'center'; c.textBaseline = 'middle';
  const word = 'HUMBLE', span = 1.25;
  for(let i = 0; i < word.length; i++){
    const a = -Math.PI / 2 - span / 2 + span * (i + 0.5) / word.length;
    c.save(); c.translate(Math.cos(a) * 46, Math.sin(a) * 46); c.rotate(a + Math.PI / 2); c.fillText(word[i], 0, 0); c.restore();
  }
  // "Yeti"
  c.save(); c.rotate(-0.1);
  c.font = 'italic 600 34px ' + SANS; c.lineJoin = 'round';
  const og = c.createLinearGradient(0, -18, 0, 16); og.addColorStop(0, HY.yellow); og.addColorStop(0.5, HY.orange); og.addColorStop(1, HY.deep);
  c.strokeStyle = og; c.lineWidth = 11; c.strokeText('Yeti', 0, 4);
  c.fillStyle = HY.dark; c.fillText('Yeti', 2, 6.5);
  c.strokeStyle = HY.dark; c.lineWidth = 2.5; c.strokeText('Yeti', 1.2, 5.2);
  c.fillStyle = '#ffffff'; c.fillText('Yeti', 0, 4);
  c.restore();
  c.restore();
}
/* A tiny version of the brand mark for crates, flags and signs */
function miniMark(c, x, y, r){
  c.fillStyle = HY.green; circ(c, x, y, r); c.fill();
  c.fillStyle = HY.lime; circ(c, x - r * 0.25, y - r * 0.25, r * 0.55); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = Math.max(0.5, r * 0.28); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - r * 0.45, y - r * 0.45); c.lineTo(x, y); c.lineTo(x + r * 0.45, y - r * 0.45); c.moveTo(x, y); c.lineTo(x, y + r * 0.55); c.stroke();
  c.lineCap = 'butt';
}

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
  c.fillStyle = g.speck;
  for(let i = 0; i < 3; i++){ const q = pts[(v + i * 2) % pts.length]; rr(c, q[0], q[1], 2.2, 1.6, 0.8); c.fill(); }
  c.fillStyle = g.fillHi; const q = pts[(v + 3) % pts.length]; c.fillRect(q[0] + 1, q[1] - 1, 1.4, 1);
  if(k === 'odisha' && v === 1 && !top){ c.fillStyle = '#ffd0dc'; c.beginPath(); c.arc(10, 11, 1.8, Math.PI, 0); c.fill(); c.fillStyle = '#e89aae'; c.fillRect(8.4, 11, 3.2, 0.6); }
  if(k === 'kerala' && v === 2){ c.fillStyle = 'rgba(0,0,0,.18)'; circ(c, 5, 6, 1); c.fill(); circ(c, 12, 11, 0.8); c.fill(); }
  if(left){ c.fillStyle = g.fillDk; c.fillRect(0, 0, 1.6, T); }
  if(right){ c.fillStyle = g.fillDk; c.fillRect(T - 1.6, 0, 1.6, T); }
  if(bottom){ c.fillStyle = g.fillDk; c.fillRect(0, T - 2, T, 2); }
  if(top){
    c.fillStyle = g.topDk; c.fillRect(0, 0, T, 6.5);
    c.fillStyle = g.top; c.fillRect(0, 0, T, 4.4);
    for(let i = 0; i < 4; i++){ circ(c, 2 + i * 4, 4.4, 2.1); c.fill(); }
    c.fillStyle = g.topHi; c.fillRect(0, 0.6, T, 1.1);
    if(k === 'kerala' || k === 'assam'){
      c.fillStyle = g.topDk; for(let i = 0; i < 4; i++){ tri(c, 1 + i * 4 + v, 4.5, 2 + i * 4 + v, 1.8, 3 + i * 4 + v, 4.5); }
      if(v === 2){ c.fillStyle = k === 'kerala' ? '#ffe14a' : '#ff8ab0'; circ(c, 11, 1.6, 1.1); c.fill(); c.fillStyle = '#fff'; circ(c, 11, 1.6, 0.45); c.fill(); }
    } else if(k === 'odisha' || k === 'rajasthan'){
      if(v === 0 && k === 'odisha'){ c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(5, 3, 1.6, Math.PI, 0); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(v * 4 + 2, 2.4, 3, 0.6);
      if(k === 'rajasthan'){ c.strokeStyle = 'rgba(180,120,50,.5)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(1, 3.2); c.quadraticCurveTo(5, 2.2, 9, 3.2); c.quadraticCurveTo(12, 4, 15, 3); c.stroke(); }
    } else if(k === 'ellora'){
      c.fillStyle = 'rgba(120,170,90,.55)'; ell(c, 3 + v * 4, 1.4, 2.4, 1, 0); c.fill();
    } else {
      c.fillStyle = 'rgba(160,200,235,.8)'; c.fillRect(0, 5, T, 1.5);
      c.fillStyle = '#ffffff'; if(v === 1){ circ(c, 6, 1.2, 0.8); c.fill(); }
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
  const I = G.region, k = I.key;
  if(ch === '#' || ch === 'I'){
    if(ch === 'I') return sprite(k + 'I' + (tx % 2), c => {
      c.fillStyle = I.g.fill; c.fillRect(0, 0, T, T);
      const g = c.createLinearGradient(0, 0, 0, 8); g.addColorStop(0, '#f2fbff'); g.addColorStop(1, '#8fd0f0');
      c.fillStyle = g; c.fillRect(0, 0, T, 8); c.fillStyle = '#5fa8d0'; c.fillRect(0, 7.2, T, 1);
      c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(tx % 2 ? 2 : 8, 1.5, 5, 0.8); c.fillRect(tx % 2 ? 9 : 3, 3.5, 2, 0.6);
    });
    const solidG = x => { const t2 = tileAt(x, ty); return t2 === '#' || t2 === 'I'; };
    const above = tileAt(tx, ty - 1);
    const top = above !== '#' && above !== 'I', left = !solidG(tx - 1) && tx > 0, right = !solidG(tx + 1) && tx < G.W - 1, bottom = ty < ROWS - 1 && !(tileAt(tx, ty + 1) === '#' || tileAt(tx, ty + 1) === 'I');
    const v = (tx * 7 + ty * 13) % 3;
    return sprite(k + '#' + (+top) + (+left) + (+right) + (+bottom) + v, c => drawGround(c, I, top, left, right, bottom, v));
  }
  if(ch === 'X') return sprite(k + 'X' + ((tx + ty) % 2), c => {
    const s = I.stone;
    if(k === 'sikkim'){
      c.fillStyle = s[1]; c.fillRect(0, 0, T, T); c.fillStyle = s[0]; c.fillRect(0.8, 0.8, T - 1.6, T - 1.6);
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(2, 2); c.lineTo(7, 2); c.lineTo(2, 7); c.fill();
      c.fillStyle = s[2]; c.fillRect(10, 10, 3, 1); return;
    }
    drawBlock(c, s[0], s[1], s[2]);
    c.strokeStyle = s[1]; c.lineWidth = 0.7; c.beginPath();
    if(k === 'rajasthan'){ c.moveTo(0, 8); c.lineTo(T, 8); c.moveTo(8, 0.8); c.lineTo(8, 8); c.moveTo(4, 8); c.lineTo(4, T); c.moveTo(12, 8); c.lineTo(12, T); c.stroke(); if((tx + ty) % 2){ c.fillStyle = s[1]; c.beginPath(); c.moveTo(5, 7); c.lineTo(5, 4); c.quadraticCurveTo(8, 1.6, 11, 4); c.lineTo(11, 7); c.fill(); } return; }
    if(k === 'ellora'){ c.strokeRect(3, 3, 10, 9); c.beginPath(); c.arc(8, 7.5, 2.2, 0, Math.PI * 2); c.moveTo(3, 7.5); c.lineTo(5.8, 7.5); c.moveTo(10.2, 7.5); c.lineTo(13, 7.5); c.stroke(); return; }
    if(k === 'kerala'){ c.stroke(); c.fillStyle = s[1]; for(const d of [[4, 5], [10, 4], [7, 10], [12, 12], [3, 12]]){ circ(c, d[0], d[1], 0.9); c.fill(); } return; }
    if((tx + ty) % 2){ c.moveTo(3, 5); c.lineTo(7, 7); c.lineTo(6, 11); c.moveTo(7, 7); c.lineTo(12, 6); } else { c.moveTo(9, 3); c.lineTo(10, 8); c.lineTo(13, 11); c.moveTo(4, 12); c.lineTo(8, 13); }
    c.stroke();
    if(k === 'assam'){ c.fillStyle = 'rgba(90,190,80,.7)'; ell(c, 4, 2, 3, 1.4); c.fill(); ell(c, 12, 14, 2.4, 1.1); c.fill(); }
  });
  if(ch === 'B') return sprite(k + 'B', c => {
    const s = I.stone, base = k === 'sikkim' ? '#9ec8e0' : shade(s[0], 0.92);
    c.fillStyle = shade(s[1], 0.8); c.fillRect(0, 0, T, T);
    c.fillStyle = base; c.fillRect(0.6, 0.6, 7, 6.8); c.fillRect(8.4, 0.6, 7, 6.8); c.fillRect(0.6, 8.4, 3, 6.8); c.fillRect(4.4, 8.4, 7.2, 6.8); c.fillRect(12.4, 8.4, 3, 6.8);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0.6, 0.6, 7, 1); c.fillRect(8.4, 0.6, 7, 1); c.fillRect(4.4, 8.4, 7.2, 1);
    c.strokeStyle = 'rgba(40,20,10,.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(6, 10); c.lineTo(8, 12); c.lineTo(7, 14.5); c.moveTo(8, 12); c.lineTo(10.5, 11); c.stroke();
  });
  if(ch === 'D') return sprite(k + 'D' + ((tx + ty) % 3), c => {
    const v = (tx + ty) % 3;
    c.fillStyle = '#5a4a40'; c.fillRect(0, 0, T, T);
    if(v === 0){ c.fillStyle = '#b07a44'; c.fillRect(1, 1, 9, 7); c.fillStyle = '#8a5a30'; c.fillRect(1, 4, 9, 1); c.fillStyle = '#9aa4ac'; rr(c, 10, 2, 5, 7, 1.5); c.fill(); c.fillStyle = '#e04a6a'; c.fillRect(10, 4, 5, 2); c.fillStyle = '#c86a9a'; tri(c, 1, 15, 8, 9, 10, 15); c.fillStyle = '#6a8a4a'; c.fillRect(10, 10, 5, 5); }
    else if(v === 1){ c.fillStyle = '#9aa4ac'; rr(c, 1, 1, 6, 8, 1.5); c.fill(); c.fillStyle = '#ffcc40'; c.fillRect(1, 3.5, 6, 2); c.fillStyle = '#b07a44'; c.fillRect(8, 1, 7, 6); c.fillStyle = '#7a5a8a'; c.fillRect(2, 10, 8, 5); c.fillStyle = '#e8e0d0'; tri(c, 10, 15, 13, 8, 15, 15); }
    else { c.fillStyle = '#c86a9a'; rr(c, 1, 2, 7, 5, 2); c.fill(); c.fillStyle = '#6a8a4a'; c.fillRect(9, 1, 6, 7); c.fillStyle = '#b07a44'; c.fillRect(1, 9, 10, 6); c.fillStyle = '#8a5a30'; c.fillRect(1, 12, 10, 1); c.fillStyle = '#9aa4ac'; circ(c, 13, 12, 2.4); c.fill(); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.6; c.strokeRect(0.3, 0.3, T - 0.6, T - 0.6);
  });
  if(ch === '=') return sprite(k + '=', c => {
    const p = I.ledge;
    if(k === 'assam'){
      c.fillStyle = p[1]; rr(c, 0, 1, T, 6, 3); c.fill(); c.fillStyle = p[0]; rr(c, 0, 1, T, 4.6, 2.3); c.fill();
      c.fillStyle = p[2]; c.fillRect(0, 1.6, T, 1); c.fillStyle = p[1]; c.fillRect(7, 1, 1.2, 6);
    } else if(k === 'rajasthan'){
      c.fillStyle = p[1]; c.fillRect(0, 1, T, 7); c.fillStyle = p[0]; c.fillRect(0, 0, T, 5); c.fillStyle = p[2]; c.fillRect(0, 0.4, T, 1);
      c.fillStyle = p[1]; for(let i = 0; i < 3; i++){ c.beginPath(); c.arc(2.7 + i * 5.3, 8, 2, 0, Math.PI); c.fill(); }
    } else if(k === 'ellora'){
      c.fillStyle = p[1]; c.fillRect(0, 1, T, 7); c.fillStyle = p[0]; c.fillRect(0, 0, T, 5); c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(0, 0.4, T, 1);
      c.fillStyle = p[1]; c.fillRect(3, 5, 1, 3); c.fillRect(11, 5, 1, 3);
    } else if(k === 'sikkim'){
      c.fillStyle = p[1]; rr(c, 0, 2, T, 5, 1); c.fill(); c.fillStyle = p[0]; c.fillRect(0, 2, T, 3.4);
      c.strokeStyle = p[1]; c.lineWidth = 0.5; c.beginPath(); c.moveTo(5, 2); c.lineTo(5, 7); c.moveTo(11, 2); c.lineTo(11, 7); c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(0, 0.8, T, 1.4); c.fillStyle = 'rgba(200,230,255,.9)'; circ(c, 4, 1.4, 1.4); c.fill(); circ(c, 12, 1.4, 1.2); c.fill();
    } else {
      c.fillStyle = p[1]; rr(c, 0, 1, T, 7, 2); c.fill(); c.fillStyle = p[0]; rr(c, 0, 1, T, 5.5, 2); c.fill();
      c.fillStyle = p[2]; c.fillRect(0, 1.4, T, 1.1); c.strokeStyle = p[1]; c.lineWidth = 0.5; c.beginPath(); c.moveTo(2, 4); c.lineTo(7, 4); c.moveTo(9, 3.2); c.lineTo(14, 3.2); c.stroke();
    }
  });
  if(ch === 'c') return sprite(k + 'c', c => {
    const s = I.stone; drawBlock(c, shade(s[0], 1.1), s[1], s[2]);
    c.strokeStyle = s[1]; c.lineWidth = 0.8; c.beginPath(); c.moveTo(3, 2); c.lineTo(7, 7); c.lineTo(5, 12); c.moveTo(7, 7); c.lineTo(12, 9); c.lineTo(13, 14); c.moveTo(11, 2); c.lineTo(10, 5); c.stroke();
  });
  if(ch === 'v') return sprite(k + 'v' + (ty % 2), c => {
    const vine = k === 'kerala' || k === 'assam';
    c.strokeStyle = vine ? '#2f7a2a' : '#6f4a26'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(8, 0); c.quadraticCurveTo(ty % 2 ? 10 : 6, 8, 8, T); c.stroke();
    c.strokeStyle = vine ? '#5fc84a' : '#b08050'; c.lineWidth = 1; c.beginPath(); c.moveTo(7.6, 0); c.quadraticCurveTo(ty % 2 ? 9.4 : 5.6, 8, 7.6, T); c.stroke();
    if(vine){ c.fillStyle = '#56c84a'; ell(c, ty % 2 ? 12.5 : 3.5, 5, 3, 1.5, ty % 2 ? 0.5 : -0.5); c.fill(); }
    else { c.fillStyle = '#4a2c14'; c.fillRect(6.4, 7, 3.2, 1.6); if(k === 'sikkim' && ty % 2){ c.fillStyle = ['#3f7fe0', '#ffffff', '#e8413a', '#3fbf5a', '#ffd23a'][tx % 5]; c.fillRect(9, 2, 4, 3); } }
  });
  if(ch === 'r') return sprite(k + 'r', c => {
    c.fillStyle = 'rgba(0,0,0,.15)'; ell(c, 8, 15, 7.5, 1.5); c.fill();
    c.fillStyle = '#c9a020'; ell(c, 8, 14.2, 7.5, 2); c.fill();
    c.fillStyle = '#f0c93a'; ell(c, 7.4, 13.8, 6.2, 1.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; ell(c, 5, 13.4, 2, 0.5); c.fill();
    c.fillStyle = 'rgba(120,200,255,.5)'; ell(c, 10.5, 14, 1.6, 0.4); c.fill();
    c.fillStyle = '#6a4a0a'; c.fillRect(5.6, 13.6, 0.8, 0.8); c.fillRect(8.6, 13.6, 0.8, 0.8);
  });
  if(ch === 'F') return sprite(k + 'F', c => drawThorns(c, k));
  if(isBoulder(ch)){
    const L = isBoulder(tileAt(tx - 1, ty)), R = isBoulder(tileAt(tx + 1, ty)), U = isBoulder(tileAt(tx, ty - 1)), Dn = isBoulder(tileAt(tx, ty + 1));
    return sprite(k + ch + (+L) + (+R) + (+U) + (+Dn), c => {
      const s = k === 'sikkim' ? ['#9aa8b8', '#5a6878', '#d0dcea'] : I.stone, rad = 6;
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
function drawThorns(c, k){
  if(k === 'kerala' || k === 'odisha'){
    // a purple sea urchin
    c.strokeStyle = '#4a1f6a'; c.lineWidth = 0.9;
    for(let i = 0; i < 11; i++){ const a = Math.PI + i * Math.PI / 10; c.beginPath(); c.moveTo(8, 13); c.lineTo(8 + Math.cos(a) * 8, 13 + Math.sin(a) * 8); c.stroke(); }
    c.fillStyle = '#7a3aa0'; ell(c, 8, 13.5, 5, 3.4); c.fill(); c.fillStyle = '#a868d0'; ell(c, 7, 12.6, 2, 1); c.fill();
  } else if(k === 'ellora'){
    c.fillStyle = '#5a4e46'; tri(c, 1, T, 4.5, 5, 8, T); tri(c, 7, T, 11, 2, 15, T);
    c.fillStyle = '#8a7c70'; tri(c, 4.5, 5, 5.5, T, 3.5, T); tri(c, 11, 2, 12, T, 10, T);
  } else if(k === 'rajasthan'){
    c.fillStyle = '#3f8a3a'; rr(c, 6, 3, 4, 13, 2); c.fill(); rr(c, 1.6, 7, 3, 6, 1.5); c.fill(); rr(c, 11.4, 5, 3, 6, 1.5); c.fill();
    c.fillRect(3, 11, 4, 2); c.fillRect(9, 9, 3.4, 2);
    c.fillStyle = '#6ac25a'; c.fillRect(7, 4, 1, 11);
    c.fillStyle = '#fff6c0'; for(const d of [[5.4, 5], [10.6, 7], [5.4, 10], [10.6, 12], [1, 9], [15, 7]]) c.fillRect(d[0], d[1], 0.8, 0.8);
    c.fillStyle = '#ff6a8a'; circ(c, 8, 2.6, 1.4); c.fill();
  } else if(k === 'assam'){
    c.fillStyle = '#2a6a2a'; ell(c, 8, 12, 7, 4.5); c.fill(); c.fillStyle = '#3f8f3a'; ell(c, 7, 11, 5, 3); c.fill();
    c.strokeStyle = '#d8d0a0'; c.lineWidth = 0.7; c.beginPath(); for(const d of [[2, 9, -1, 7], [5, 7.5, 4, 5], [9, 7.3, 9.5, 5], [13, 8.5, 15, 6.5], [14.5, 11, 16, 10]]){ c.moveTo(d[0], d[1]); c.lineTo(d[2], d[3]); } c.stroke();
  } else {
    c.fillStyle = '#8fd0f0'; tri(c, 1, T, 4, 4, 7, T); tri(c, 6, T, 9.5, 1, 13, T); tri(c, 11, T, 13.5, 7, 16, T);
    c.fillStyle = 'rgba(255,255,255,.85)'; tri(c, 4, 4, 4.6, T, 3.2, T); tri(c, 9.5, 1, 10.2, T, 8.8, T);
  }
}
function drawTiles(c, camX, camY, s){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++){
    const y0 = Math.round((ty * T - camY) * s), y1 = Math.round(((ty + 1) * T - camY) * s);
    if(y1 < 0) continue;
    for(let tx = tx0; tx <= tx1; tx++){
      const ch = tileAt(tx, ty);
      if(ch === '.' || isGood(ch)) continue;
      const sp = tileSprite(ch, tx, ty); if(!sp) continue;
      const x0 = Math.round((tx * T - camX) * s), x1 = Math.round(((tx + 1) * T - camX) * s);
      let dx = 0;
      if(ch === 'c' && G.crumbles.size){ const t = G.crumbles.get(ty * G.W + tx); if(t !== undefined) dx = Math.round(Math.sin(t * 70) * s); }
      c.drawImage(sp, x0 + dx, y0, x1 - x0, y1 - y0);
    }
  }
}
/* Goodies and boulder glints are animated, so they are drawn fresh every frame */
function drawLive(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T);
  for(let ty = 0; ty < ROWS; ty++) for(let tx = tx0; tx <= tx1; tx++){
    const ch = tileAt(tx, ty);
    if(isGood(ch)) drawGood(c, ch, tx * T + 8, ty * T + 8 + Math.sin(G.time * 3 + tx) * 1.2);
    else if((ch === 'k' && !isBoulder(tileAt(tx - 1, ty)) && !isBoulder(tileAt(tx, ty - 1))) || (ch === 'B' && (tx + ty) % 3 === 0)){
      const ph = (G.time * 0.6 + tx * 0.37) % 1;
      if(ph < 0.18){ const a = Math.sin(ph / 0.18 * Math.PI); c.fillStyle = 'rgba(255,255,230,' + (a * 0.9) + ')'; star5(c, tx * T + 12, ty * T + 4, 3 * a + 0.5, 0.8); c.fill(); }
    }
  }
}
function drawGood(c, ch, x, y){
  c.fillStyle = 'rgba(0,0,0,.12)'; ell(c, x, y + 7, 4, 1.2); c.fill();
  if(ch === 'a'){
    // mango
    c.save(); c.translate(x, y + 0.5); c.rotate(-0.35);
    c.fillStyle = '#e07a10'; ell(c, 0, 0, 4.4, 5.6); c.fill();
    const g = c.createLinearGradient(-4, -5, 4, 5); g.addColorStop(0, '#ffe04a'); g.addColorStop(0.6, '#ffb020'); g.addColorStop(1, '#ff7a2a');
    c.fillStyle = g; ell(c, -0.3, -0.3, 3.8, 5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.65)'; ell(c, -1.6, -2.4, 1, 1.6, 0.2); c.fill();
    c.fillStyle = '#6b3a1c'; c.fillRect(-0.4, -6.6, 0.9, 2); c.fillStyle = '#3fbf5a'; ell(c, 2, -5.8, 2.4, 1, -0.5); c.fill();
    c.restore();
  } else if(ch === 'b'){
    c.fillStyle = '#c9a012'; c.beginPath(); c.arc(x + 1, y - 4, 8, 1.75, 3.0); c.arc(x + 3, y - 6.5, 7.4, 3.0, 1.75, true); c.fill();
    c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(x + 1, y - 4, 7.2, 1.8, 2.95); c.arc(x + 2.6, y - 6, 7, 2.95, 1.8, true); c.fill();
    c.fillStyle = '#5a3a14'; c.fillRect(x - 5.6, y - 3, 1.4, 1.4); c.fillRect(x + 1, y + 3, 1.2, 1.2);
  } else if(ch === 'g'){
    // a bunch of jamun
    const dots = [[-2.4, -1.8], [2.4, -1.8], [0, -2], [-1.2, 1.4], [1.2, 1.4], [0, 4]];
    c.fillStyle = '#2a1040'; for(const d of dots){ ell(c, x + d[0], y + d[1], 2, 2.4); c.fill(); }
    c.fillStyle = '#5a2a8a'; for(const d of dots){ ell(c, x + d[0] - 0.3, y + d[1] - 0.3, 1.5, 1.9); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.6)'; for(const d of [[-2.4, -1.8], [1.2, 1.4], [0, 4]]) c.fillRect(x + d[0] - 1, y + d[1] - 1.2, 0.7, 0.7);
    c.fillStyle = '#3fbf5a'; ell(c, x + 2, y - 5, 2.2, 1, 0.4); c.fill(); c.fillStyle = '#6b3a1c'; c.fillRect(x - 0.3, y - 6, 0.8, 2.4);
  } else if(ch === 'w'){
    // a drop of clean water
    const g = c.createLinearGradient(x, y - 6, x, y + 5); g.addColorStop(0, '#bff0ff'); g.addColorStop(1, '#3fa8f0');
    c.fillStyle = '#1f78c0'; c.beginPath(); c.moveTo(x, y - 6.4); c.quadraticCurveTo(x + 5.4, y + 0.4, x + 3.8, y + 3.4); c.arc(x, y + 1.8, 4.2, 0.4, Math.PI - 0.4); c.quadraticCurveTo(x - 5.4, y + 0.4, x, y - 6.4); c.fill();
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y - 5.4); c.quadraticCurveTo(x + 4.4, y + 0.4, x + 3.2, y + 3); c.arc(x, y + 1.8, 3.4, 0.4, Math.PI - 0.4); c.quadraticCurveTo(x - 4.4, y + 0.4, x, y - 5.4); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)'; ell(c, x - 1.4, y + 0.4, 0.9, 1.6, 0.3); c.fill();
  } else {
    // a tender coconut with a straw: the big one
    const pulse = 1 + Math.sin(G.time * 5) * 0.05;
    c.fillStyle = 'rgba(255,240,150,.25)'; circ(c, x, y, 10 * pulse); c.fill();
    c.fillStyle = '#3f7a2a'; ell(c, x, y + 1.5, 6.4, 6); c.fill();
    c.fillStyle = '#6ab83a'; ell(c, x - 0.5, y + 1, 5.6, 5.2); c.fill();
    c.fillStyle = '#9ad85a'; ell(c, x - 2, y - 1, 2, 2.6, 0.3); c.fill();
    c.fillStyle = '#f4efe2'; ell(c, x + 0.5, y - 3.6, 2.4, 1.1); c.fill();
    c.strokeStyle = '#ff5a6e'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 0.5, y - 3.8); c.lineTo(x + 3, y - 9); c.lineTo(x + 5, y - 9.6); c.stroke();
  }
}
function drawPits(c, camX){
  const tx0 = Math.floor(camX / T), tx1 = Math.floor((camX + VW) / T), kind = G.region.pit;
  const top = 12 * T + 6;
  const cols = { water: ['#2aa89a', '#bff6e8', '#16706a'], sea: ['#2f8fe0', '#bff0ff', '#1f5fb0'], abyss: ['#2a1a3a', '#8a6ac0', '#0a0612'],
    sand: ['#e0aa55', '#ffe0a0', '#a8702e'], river: ['#3f9ab8', '#a8e8ff', '#1d5a76'], crevasse: ['#8fd0f0', '#ffffff', '#2a5a8a'] }[kind];
  for(let tx = tx0; tx <= tx1; tx++){
    if(!pitAt(tx)) continue;
    const x = tx * T;
    const g = c.createLinearGradient(0, top, 0, LH);
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[2]);
    c.fillStyle = g; c.beginPath(); c.moveTo(x, LH);
    const wave = kind === 'sand' || kind === 'crevasse' ? 0.4 : 1.3;
    for(let i = 0; i <= 4; i++){ const px = x + i * 4; c.lineTo(px, top + Math.sin(G.time * 3 + px * 0.25) * wave); }
    c.lineTo(x + T, LH); c.fill();
    c.fillStyle = cols[1]; c.globalAlpha = 0.7;
    if(kind === 'sand'){ const a = G.time * 2 + tx; c.strokeStyle = cols[2]; c.lineWidth = 0.7; c.beginPath(); c.arc(x + 8, top + 10, 3 + Math.sin(a) * 1.2, a, a + 4); c.stroke(); }
    else if(kind === 'crevasse'){ c.fillRect(x + 2 + (tx % 3) * 3, top + 3, 1, 12); }
    else if(kind === 'abyss'){ if(rng(tx + Math.floor(G.time * 2)) < 0.3){ c.fillRect(x + 4 + (tx % 4) * 2, top + 6 + (G.time * 6 % 10), 1, 1); } }
    else for(let i = 0; i < 2; i++){ const px = x + ((G.time * (kind === 'river' ? 30 : 8) + i * 8 + tx * 5) % T); c.fillRect(px, top + 1 + Math.sin(G.time * 3 + px * 0.25) * 1.3, 3, 0.8); }
    c.globalAlpha = 1;
    if(D().pitBounce){
      const y = LH - 7 + Math.sin(G.time * 4 + tx) * 0.8;
      c.fillStyle = '#ffffff'; c.fillRect(x, y, T, 2.2);
      c.fillStyle = HY.orange; c.fillRect(x + 4, y, 4, 2.2); c.fillRect(x + 12, y, 4, 2.2);
      if(tx % 3 === 0){ c.fillStyle = HY.gold; circ(c, x + 8, y + 1, 2.4); c.fill(); c.fillStyle = HY.green; c.fillRect(x + 7.4, y - 1.4, 1.2, 4.8); }
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
function flagString(c, x0, y0, x1, y1, sag, seed, hy){
  const cols = ['#3f7fe0', '#ffffff', '#e8413a', '#3fbf5a', '#ffd23a'];
  c.strokeStyle = 'rgba(60,40,30,.7)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); c.stroke();
  const n = Math.max(3, Math.floor(Math.abs(x1 - x0) / 7));
  for(let i = 1; i < n; i++){
    const t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * (x0 + x1) / 2 + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * ((y0 + y1) / 2 + sag) + t * t * y1;
    const w = Math.sin(G.time * 3 + i + seed) * 0.8;
    if(hy && i === Math.floor(n / 2)){ c.fillStyle = HY.green; c.fillRect(x - 2.5, y, 5, 5 + w * 0.3); miniMark(c, x, y + 2.5, 1.6); continue; }
    c.fillStyle = cols[(i + seed) % 5]; c.fillRect(x - 2, y, 4, 4.4 + w * 0.3);
  }
}
function drawBG(c, camX){
  const I = G.region, k = I.key;
  const g = c.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, I.sky[0]); g.addColorStop(1, I.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  if(k === 'kerala'){
    const sx = 300 - camX * 0.02 % 60;
    c.fillStyle = 'rgba(255,250,200,.35)'; circ(c, sx, 40, 22); c.fill(); c.fillStyle = '#fff6c8'; circ(c, sx, 40, 13); c.fill();
    for(let i = 0; i < 5; i++){ const x = wrap(i * 101 - camX * 0.05 - G.time * 3, VW + 120) - 60; cloud(c, x, 22 + (i * 29) % 40, 0.5 + (i % 3) * 0.2, 'rgba(255,255,255,.85)'); }
    // far: the backwater with houseboats and fishing nets
    const o1 = camX * 0.08;
    c.fillStyle = '#2f9f8a'; c.fillRect(0, 122, VW, VH - 122);
    c.fillStyle = 'rgba(255,255,255,.35)';
    for(let i = 0; i < 16; i++){ const x = wrap(rng(i) * 700 - o1 * 1.5 + G.time * 4, VW + 40) - 20, y = 126 + rng(i + 3) * 60; c.fillRect(x, y, 5 + rng(i + 7) * 8, 0.7); }
    for(let kx = Math.floor((o1 - 100) / 200); kx <= Math.floor((o1 + VW + 100) / 200); kx++){
      const x = kx * 200 + 40 + rng(kx) * 60 - o1;
      if(rng(kx + 5) < 0.5){
        // a houseboat with its curved thatched roof
        c.fillStyle = '#5a3418'; c.beginPath(); c.moveTo(x - 22, 122); c.quadraticCurveTo(x, 130, x + 22, 122); c.lineTo(x + 18, 124); c.lineTo(x - 18, 124); c.fill();
        c.fillStyle = '#c89a4a'; c.beginPath(); c.moveTo(x - 16, 121); c.quadraticCurveTo(x, 106, x + 16, 121); c.fill();
        c.fillStyle = '#8a5a2a'; c.fillRect(x - 8, 116, 3, 4); c.fillRect(x + 2, 116, 3, 4);
      } else {
        // a cantilevered fishing net
        c.strokeStyle = '#4a3020'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - 12, 124); c.lineTo(x + 6, 96); c.lineTo(x + 24, 118); c.moveTo(x + 6, 96); c.lineTo(x + 2, 124); c.stroke();
        c.strokeStyle = 'rgba(80,60,40,.5)'; c.lineWidth = 0.4; c.beginPath(); for(let j = 0; j < 5; j++){ c.moveTo(x + 6, 96); c.lineTo(x + 12 + j * 3, 118 + j * 0.4); } c.stroke();
      }
    }
    // middle: coconut palms along the bank
    const o2 = camX * 0.3;
    hills(c, o2, 186, 8, '#4fa84a', 0.02, 1);
    for(let kx = Math.floor(o2 / 70) - 1; kx <= Math.floor((o2 + VW) / 70) + 1; kx++){
      if(rng(kx + 11) < 0.3) continue;
      const x = kx * 70 + rng(kx) * 30 - o2, by = hillY(o2, 186, 8, 0.02, 1, x) + 2;
      palm(c, x, by, 44 + rng(kx + 4) * 18, (rng(kx + 5) - 0.2) * 22, '#7a5a3a', '#2f8f3a', 1);
    }
    const o3 = camX * 0.55;
    hills(c, o3, 206, 6, '#3f9a3f', 0.03, 4);
    for(let kx = Math.floor(o3 / 30) - 1; kx <= Math.floor((o3 + VW) / 30) + 1; kx++){
      const x = kx * 30 + rng(kx + 20) * 14 - o3, by = hillY(o3, 206, 6, 0.03, 4, x) + 2;
      c.strokeStyle = '#8ad05a'; c.lineWidth = 0.8; c.beginPath(); for(let b = -2; b <= 2; b++){ c.moveTo(x + b * 1.5, by); c.lineTo(x + b * 2.4 + Math.sin(G.time * 2 + kx) * 0.6, by - 7); } c.stroke();
    }
  } else if(k === 'odisha'){
    const sx = 80 - camX * 0.02 % 60;
    c.fillStyle = 'rgba(255,240,180,.3)'; circ(c, sx, 50, 26); c.fill(); c.fillStyle = '#fff3c0'; circ(c, sx, 50, 15); c.fill();
    for(let i = 0; i < 5; i++){ const x = wrap(i * 97 - camX * 0.05 - G.time * 4, VW + 120) - 60; cloud(c, x, 20 + (i * 31) % 40, 0.5 + (i % 3) * 0.2, 'rgba(255,255,255,.9)'); }
    const o1 = camX * 0.08;
    const sea = c.createLinearGradient(0, 120, 0, VH); sea.addColorStop(0, '#2fa6e8'); sea.addColorStop(1, '#1b6fc0');
    c.fillStyle = sea; c.fillRect(0, 120, VW, VH - 120);
    c.fillStyle = 'rgba(255,255,255,.45)';
    for(let i = 0; i < 18; i++){ const x = wrap(rng(i) * 700 - o1 * 1.5 + G.time * 6 * (i % 2 ? 1 : -1), VW + 40) - 20, y = 126 + rng(i + 3) * 70; c.fillRect(x, y, 6 + rng(i + 7) * 10, 0.8); }
    // far: the sun temple on the shore: a stepped stone tower on a platform lined with great chariot wheels
    const tx = 250 - o1 % 520;
    c.fillStyle = '#a8784e'; c.fillRect(tx - 46, 110, 92, 12);
    c.fillStyle = '#b8845a';
    for(let i = 0; i < 5; i++){ const w = 34 - i * 6, yy = 110 - (i + 1) * 7; c.fillRect(tx - w, yy, w * 2, 6); c.fillStyle = i % 2 ? '#b8845a' : '#c4905e'; }
    c.fillStyle = '#9a6a44'; c.beginPath(); c.arc(tx, 75, 5, Math.PI, 0); c.fill(); c.fillRect(tx - 1, 66, 2, 5);
    c.fillStyle = '#8a5a38'; c.fillRect(tx - 5, 100, 10, 10);
    c.strokeStyle = '#6a4428';
    for(const wx of [tx - 34, tx + 34]){
      c.lineWidth = 1.2; circ(c, wx, 116, 5.4); c.stroke();
      c.lineWidth = 0.5; c.beginPath(); for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4 + G.time * 0.1; c.moveTo(wx, 116); c.lineTo(wx + Math.cos(a) * 5.4, 116 + Math.sin(a) * 5.4); } c.stroke();
    }
    // middle: dunes with casuarina trees
    const o2 = camX * 0.3;
    hills(c, o2, 186, 12, '#f3d68f', 0.018, 1);
    for(let kx = Math.floor(o2 / 80) - 1; kx <= Math.floor((o2 + VW) / 80) + 1; kx++){
      if(rng(kx + 11) < 0.4) continue;
      const x = kx * 80 + rng(kx) * 40 - o2, by = hillY(o2, 186, 12, 0.018, 1, x) + 2, h = 30 + rng(kx + 4) * 14;
      c.fillStyle = '#7a5a3a'; c.fillRect(x - 1, by - h * 0.5, 2, h * 0.5);
      c.fillStyle = '#3f7a4a'; c.beginPath(); c.moveTo(x, by - h); c.lineTo(x + 8, by - h * 0.35); c.lineTo(x - 8, by - h * 0.35); c.fill();
    }
    // near: sand, and baby turtles heading for the sea
    const o3 = camX * 0.55;
    hills(c, o3, 206, 7, '#ecc77e', 0.03, 4);
    for(let kx = Math.floor(o3 / 60) - 1; kx <= Math.floor((o3 + VW) / 60) + 1; kx++){
      if(rng(kx + 40) < 0.5) continue;
      const x = kx * 60 + rng(kx + 20) * 20 - o3 + (G.time * 3 % 60), by = hillY(o3, 206, 7, 0.03, 4, x) + 2;
      c.fillStyle = '#3f6a3a'; ell(c, x, by - 1.5, 3, 1.8); c.fill(); c.fillStyle = '#6a9a5a'; circ(c, x + 3, by - 1.6, 1); c.fill();
    }
  } else if(k === 'ellora'){
    // inside the rock-cut caves: carved pillars, arched windows and a warm lamp glow
    const o1 = camX * 0.1;
    c.fillStyle = '#2e2028';
    for(let kx = Math.floor((o1 - 60) / 120); kx <= Math.floor((o1 + VW + 60) / 120); kx++){
      const x = kx * 120 - o1;
      c.fillStyle = '#3a2a30'; rr(c, x + 20, 40, 60, 140, 30); c.fill();
      c.fillStyle = '#1a1018'; rr(c, x + 30, 60, 40, 120, 20); c.fill();
      c.fillStyle = '#4a3a3e'; c.fillRect(x - 6, 30, 16, 170); c.fillRect(x - 10, 30, 24, 8); c.fillRect(x - 10, 190, 24, 8);
      c.fillStyle = '#5a4a4c'; for(let j = 0; j < 5; j++) c.fillRect(x - 6, 50 + j * 28, 16, 2);
      if(kx % 3 === 1){
        // a carving of the brand mark, very faint, as if chiselled long ago
        c.globalAlpha = 0.22; c.strokeStyle = '#c8b89c'; c.lineWidth = 1.4; circ(c, x + 50, 100, 11); c.stroke();
        c.beginPath(); c.moveTo(x + 44, 94); c.lineTo(x + 50, 101); c.lineTo(x + 56, 94); c.moveTo(x + 50, 101); c.lineTo(x + 50, 108); c.stroke(); c.globalAlpha = 1;
      }
    }
    const o2 = camX * 0.3;
    for(let kx = Math.floor(o2 / 40) - 1; kx <= Math.floor((o2 + VW) / 40) + 1; kx++){
      const x = kx * 40 + rng(kx) * 20 - o2, h = 12 + rng(kx + 3) * 26;
      c.fillStyle = '#241820'; tri(c, x - 7, 0, x + 7, 0, x, h);
    }
    c.fillStyle = 'rgba(255,170,80,.08)'; for(let i = 0; i < 3; i++){ const x = wrap(i * 150 - camX * 0.2, VW + 100) - 50; circ(c, x, 120, 50); c.fill(); }
    const o3 = camX * 0.55;
    hills(c, o3, 212, 10, '#1a1016', 0.035, 3);
    for(let i = 0; i < 14; i++){ const x = wrap(rng(i) * VW - camX * 0.4 + Math.sin(G.time * 0.5 + i) * 6, VW), y = 60 + rng(i + 4) * 120 + Math.sin(G.time + i) * 8; c.fillStyle = 'rgba(255,220,150,' + (0.25 + 0.2 * Math.sin(G.time * 2 + i)) + ')'; c.fillRect(x, y, 0.8, 0.8); }
  } else if(k === 'rajasthan'){
    const sx = 290 - camX * 0.02 % 60;
    c.fillStyle = 'rgba(255,230,160,.35)'; circ(c, sx, 60, 32); c.fill(); c.fillStyle = '#fff0b8'; circ(c, sx, 60, 18); c.fill();
    // far: a hill fort with walls, towers and a little green and yellow flag
    const o1 = camX * 0.06, fx0 = 170 - o1 % 560;
    c.fillStyle = '#e0a860'; c.beginPath(); c.moveTo(fx0 - 120, 150); c.quadraticCurveTo(fx0 - 40, 96, fx0, 98); c.quadraticCurveTo(fx0 + 50, 96, fx0 + 130, 150); c.fill();
    c.fillStyle = '#c98a44'; c.fillRect(fx0 - 60, 82, 120, 22);
    for(let i = 0; i < 12; i++) c.fillRect(fx0 - 60 + i * 10.4, 78, 5, 5);
    for(const tx of [-60, -18, 24, 60]){ c.fillStyle = '#b87a38'; rr(c, fx0 + tx - 7, 66, 14, 38, 3); c.fill(); c.fillStyle = '#e8b870'; c.beginPath(); c.arc(fx0 + tx, 66, 7, Math.PI, 0); c.fill(); c.fillStyle = '#8a5a28'; c.fillRect(fx0 + tx - 2, 76, 4, 6); }
    c.strokeStyle = '#6a4a28'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(fx0 + 24, 59); c.lineTo(fx0 + 24, 44); c.stroke();
    const fw = Math.sin(G.time * 4) * 1;
    c.fillStyle = HY.green; c.beginPath(); c.moveTo(fx0 + 24, 44); c.lineTo(fx0 + 34, 46 + fw); c.lineTo(fx0 + 24, 49); c.fill();
    c.fillStyle = HY.yellow; c.fillRect(fx0 + 25, 46, 3, 1);
    // middle: golden dunes, camels and khejri trees
    const o2 = camX * 0.25;
    hills(c, o2, 180, 18, '#f0bc62', 0.012, 1);
    for(let kx = Math.floor(o2 / 150) - 1; kx <= Math.floor((o2 + VW) / 150) + 1; kx++){
      const x = kx * 150 + rng(kx) * 60 - o2, by = hillY(o2, 180, 18, 0.012, 1, x);
      if(rng(kx + 3) < 0.5){
        c.fillStyle = '#a8702e'; ell(c, x, by - 10, 8, 4); c.fill(); circ(c, x - 2, by - 14, 3.4); c.fill();
        c.fillRect(x - 6, by - 8, 1.4, 8); c.fillRect(x + 5, by - 8, 1.4, 8); c.fillRect(x - 3, by - 8, 1.4, 8); c.fillRect(x + 2, by - 8, 1.4, 8);
        c.beginPath(); c.moveTo(x + 6, by - 11); c.quadraticCurveTo(x + 12, by - 14, x + 12, by - 18); c.lineTo(x + 15, by - 18); c.lineTo(x + 14, by - 16); c.lineTo(x + 12, by - 12); c.fill();
      } else {
        c.strokeStyle = '#7a5a3a'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, by); c.lineTo(x, by - 16); c.lineTo(x - 5, by - 22); c.moveTo(x, by - 16); c.lineTo(x + 6, by - 21); c.stroke();
        c.fillStyle = '#6a8a3a'; ell(c, x - 5, by - 24, 7, 3.5); c.fill(); ell(c, x + 6, by - 23, 7, 3.5); c.fill();
      }
    }
    const o3 = camX * 0.5;
    hills(c, o3, 206, 8, '#e8b260', 0.028, 4);
    if(G.gust > 0 || lvDef().wind){
      const a = G.gust > 0 ? 0.5 : 0.12;
      c.strokeStyle = 'rgba(255,235,190,' + a + ')'; c.lineWidth = 0.8;
      for(let i = 0; i < 30; i++){ const y = rng(i) * VH, x = wrap(rng(i + 9) * VW - G.time * (200 + rng(i + 2) * 200), VW + 40) - 20; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 16 + rng(i) * 10, y - 1); c.stroke(); }
    }
  } else if(k === 'assam'){
    for(let i = 0; i < 4; i++){ const x = wrap(i * 120 - camX * 0.04 - G.time * 2, VW + 120) - 60; cloud(c, x, 26 + (i * 27) % 36, 0.6, 'rgba(255,255,255,.7)'); }
    // far: misty blue hills
    const o1 = camX * 0.06;
    hills(c, o1, 130, 26, '#8ab8c8', 0.01, 2);
    hills(c, o1 * 1.4, 150, 20, '#6aa0a0', 0.014, 5);
    // middle: rows and rows of tea bushes on the slopes, with shade trees
    const o2 = camX * 0.22;
    hills(c, o2, 182, 22, '#3f9a4a', 0.012, 1);
    c.fillStyle = '#2f8a3a';
    for(let row = 0; row < 5; row++){
      const base = 150 + row * 11;
      for(let sx = -10; sx < VW + 10; sx += 9){ const y = Math.max(base, hillY(o2, 182, 22, 0.012, 1, sx) + 4 + row * 2); if(y < 196){ ell(c, sx + (row % 2) * 4 - (o2 % 9), y, 5.5, 3); c.fill(); } }
    }
    for(let kx = Math.floor(o2 / 110) - 1; kx <= Math.floor((o2 + VW) / 110) + 1; kx++){
      const x = kx * 110 + rng(kx) * 40 - o2, by = hillY(o2, 182, 22, 0.012, 1, x);
      c.strokeStyle = '#5a4030'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, by); c.lineTo(x, by - 26); c.stroke();
      c.fillStyle = '#4a8a3a'; ell(c, x, by - 28, 14, 4); c.fill(); ell(c, x + 4, by - 33, 9, 3); c.fill();
    }
    // near: tall grass and one-horned rhinos grazing
    const o3 = camX * 0.5;
    hills(c, o3, 208, 6, '#5aa84a', 0.03, 4);
    for(let kx = Math.floor(o3 / 220) - 1; kx <= Math.floor((o3 + VW) / 220) + 1; kx++){
      if(rng(kx + 50) < 0.4) continue;
      const x = kx * 220 + rng(kx + 51) * 80 - o3, by = hillY(o3, 208, 6, 0.03, 4, x) + 1;
      c.fillStyle = '#6a6e70'; ell(c, x, by - 7, 11, 5.5); c.fill(); ell(c, x + 10, by - 6, 5, 4); c.fill();
      c.fillRect(x - 8, by - 4, 3, 4); c.fillRect(x + 5, by - 4, 3, 4);
      c.fillStyle = '#d8d0c0'; tri(c, x + 13, by - 8, x + 16, by - 12, x + 15, by - 7);
    }
    for(let kx = Math.floor(o3 / 24) - 1; kx <= Math.floor((o3 + VW) / 24) + 1; kx++){
      const x = kx * 24 + rng(kx + 20) * 12 - o3, by = hillY(o3, 208, 6, 0.03, 4, x) + 2;
      c.strokeStyle = '#8ac85a'; c.lineWidth = 0.8; c.beginPath(); for(let b = -1; b <= 1; b++){ c.moveTo(x + b * 2, by); c.lineTo(x + b * 3 + Math.sin(G.time * 1.6 + kx) * 1, by - 10 - Math.abs(b) * -2); } c.stroke();
    }
  } else {
    // Sikkim: the five snowy peaks of Kangchenjunga, pine forest, a monastery and prayer flags
    const o1 = camX * 0.04, mx = 200 - o1 % 700;
    const peaks = [[-170, 112], [-110, 80], [-55, 62], [0, 50], [52, 60], [104, 80], [165, 114]];
    c.fillStyle = '#8aa8c8'; c.beginPath(); c.moveTo(mx - 220, 150);
    for(const pk of peaks) c.lineTo(mx + pk[0], pk[1]);
    c.lineTo(mx + 230, 150); c.fill();
    c.fillStyle = '#ffffff';
    for(let i = 1; i < peaks.length - 1; i++){
      const [x, y] = peaks[i];
      c.beginPath(); c.moveTo(mx + x, y); c.lineTo(mx + x - 18, y + 22); c.lineTo(mx + x - 8, y + 18); c.lineTo(mx + x, y + 26); c.lineTo(mx + x + 9, y + 18); c.lineTo(mx + x + 18, y + 22); c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 140, VW, 12);
    const o2 = camX * 0.2;
    hills(c, o2, 180, 18, '#3a6a5a', 0.013, 2);
    for(let kx = Math.floor(o2 / 26) - 1; kx <= Math.floor((o2 + VW) / 26) + 1; kx++){
      const x = kx * 26 + rng(kx) * 12 - o2, by = hillY(o2, 180, 18, 0.013, 2, x) + 6, h = 16 + rng(kx + 2) * 12;
      c.fillStyle = '#244a3a'; tri(c, x - 6, by, x + 6, by, x, by - h); c.fillStyle = '#fff'; tri(c, x - 2.5, by - h * 0.62, x + 2.5, by - h * 0.62, x, by - h);
    }
    const mox = 120 - o2 % 640;
    c.fillStyle = '#f0e8d8'; c.fillRect(mox - 18, 138, 36, 18); c.fillStyle = '#b8322a'; c.fillRect(mox - 18, 140, 36, 3);
    c.fillStyle = '#d4a020'; c.beginPath(); c.moveTo(mox - 22, 138); c.lineTo(mox, 126); c.lineTo(mox + 22, 138); c.fill();
    c.fillStyle = '#7a3a1a'; c.fillRect(mox - 3, 146, 6, 10); c.fillStyle = '#ffd23a'; circ(c, mox, 124, 1.6); c.fill();
    const o3 = camX * 0.45;
    for(let kx = Math.floor(o3 / 180) - 1; kx <= Math.floor((o3 + VW) / 180) + 1; kx++){
      const x = kx * 180 - o3;
      c.strokeStyle = '#5a3a20'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, 196); c.lineTo(x, 150); c.stroke();
      flagString(c, x, 151, x + 90, 170, 10, kx, kx % 3 === 0);
    }
    hills(c, camX * 0.55, 208, 6, '#eef8ff', 0.03, 4);
    for(let i = 0; i < 30; i++){ const x = wrap(rng(i) * VW - camX * 0.3 + Math.sin(G.time + i) * 10, VW), y = wrap(rng(i + 3) * VH + G.time * (12 + rng(i) * 14), VH); c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(x, y, 1.2, 1.2); }
  }
}
/* Foreground: a few leaves and rocks sweep past in front, faster than the ground (kept low so they never hide the action) */
function drawFG(c, camX){
  const k = G.region.key, o = camX * 1.3;
  for(let kx = Math.floor(o / 170) - 1; kx <= Math.floor((o + VW) / 170) + 1; kx++){
    if(rng(kx + 70) < 0.45) continue;
    const x = kx * 170 + rng(kx + 71) * 80 - o;
    if(k === 'kerala' || k === 'assam'){
      c.fillStyle = k === 'kerala' ? 'rgba(30,100,50,.88)' : 'rgba(30,90,40,.9)';
      for(let j = 0; j < 6; j++){ const a = -Math.PI / 2 + (j - 2.5) * 0.4 + Math.sin(G.time * 1.2 + kx) * 0.05; ell(c, x + Math.cos(a) * 14, VH + 4 + Math.sin(a) * 14, 14, 3, a); c.fill(); }
    } else if(k === 'odisha'){
      c.fillStyle = 'rgba(40,110,60,.85)';
      for(let j = 0; j < 5; j++){ const a = -Math.PI / 2 + (j - 2) * 0.45 + Math.sin(G.time * 1.5 + kx) * 0.04; ell(c, x + Math.cos(a) * 12, VH + 2 + Math.sin(a) * 12, 12, 2.6, a); c.fill(); }
    } else if(k === 'sikkim'){
      c.fillStyle = 'rgba(235,245,255,.95)'; ell(c, x, VH + 2, 30, 10); c.fill(); c.fillStyle = 'rgba(190,215,240,.9)'; ell(c, x + 6, VH + 5, 22, 6); c.fill();
    } else {
      c.fillStyle = k === 'ellora' ? 'rgba(18,10,16,.94)' : 'rgba(150,100,40,.9)';
      c.beginPath(); c.moveTo(x - 26, VH); c.lineTo(x - 12, VH - 12); c.lineTo(x + 4, VH - 9); c.lineTo(x + 20, VH - 14); c.lineTo(x + 30, VH); c.fill();
    }
  }
}

/* ---------- Himu, the explorer yeti (every player is a yeti; the helmet shows your colour) ----------
   Mountain-explorer look: striped helmet, big mirrored goggles, shadowed face, huge shaggy beard, trail boots
   and a Humble Yeti backpack. Drawn with a dark outline (see outlined sprite below) so he pops on any background. */
const FUR = '#fbfaf5', FUR_DK = '#d3e0ec', FUR_LN = '#8fa6bd', PAD = '#bfd9e8', INK = '#1d1a24', FACE = '#2b3350';
function fluff(c, x, y, rx, ry, n, col){
  c.fillStyle = col || FUR;
  ell(c, x, y, rx, ry); c.fill();
  for(let i = 0; i < n; i++){ const a = i / n * Math.PI * 2; circ(c, x + Math.cos(a) * rx * 0.92, y + Math.sin(a) * ry * 0.92, Math.min(rx, ry) * 0.34); c.fill(); }
}
function yBoot(c, x, y, lift){
  c.fillStyle = '#3b3038'; rr(c, x - 2.4, y - 3.2 - lift, 5.2, 3.4, 1.3); c.fill();
  c.fillStyle = HY.orange; c.fillRect(x - 2.4, y - 0.9 - lift, 5.4, 1);
  c.fillStyle = '#f0e2c8'; c.fillRect(x - 0.4, y - 2.8 - lift, 1.8, 0.5);
}
function drawYeti(c, o){
  // o: color, face, stage, air, moving, ph, dead, done, climb, throwT, glide, slow, squash, slot, carry, blink
  const s = STAGES[o.stage || 0].s;
  c.save(); c.scale((o.face < 0 ? -1 : 1) * s * (2 - o.squash), s * o.squash);
  const step = o.moving && !o.air && !o.climb ? Math.sin(o.ph) : 0, bob = o.moving && !o.air ? Math.abs(Math.cos(o.ph)) * 0.7 : 0;
  const fy = -bob, by = fy - 7.4, hx = 1.4, hy = by - 8.4, gy = hy - 0.6, col = o.color;
  // backpack (Humble Yeti green, lime flap, yellow buckle, rolled bedroll on top)
  c.fillStyle = '#1f6a2c'; rr(c, -9.6, by - 6.4, 6, 9.6, 1.8); c.fill();
  c.fillStyle = HY.green; rr(c, -9.2, by - 6, 5.2, 8.6, 1.6); c.fill();
  c.fillStyle = HY.lime; rr(c, -9.2, by - 6, 5.2, 3, 1.4); c.fill();
  c.fillStyle = HY.yellow; c.fillRect(-7.4, by - 3.4, 1.8, 1.4);
  c.fillStyle = HY.deep; rr(c, -10, by - 8.4, 6.2, 2.6, 1.3); c.fill();
  c.fillStyle = '#b8401a'; c.fillRect(-7.2, by - 8.4, 0.7, 2.6);
  // legs and boots
  if(o.climb){ const cl = Math.sin(o.ph) * 1.5; fluff(c, -2.4, fy - 4 + cl, 2.3, 2.4, 5); fluff(c, 2.8, fy - 4 - cl, 2.3, 2.4, 5);yBoot(c, -2.4, fy + cl, 1.2);yBoot(c, 2.8, fy - cl, 1.2); }
  else if(o.air || o.carry){ fluff(c, -2.6, fy - 4.6, 2.3, 2.4, 5); fluff(c, 2.8, fy - 3.6, 2.3, 2.4, 5);yBoot(c, -2.8, fy, 2);yBoot(c, 3, fy, 0.8); }
  else { fluff(c, -2.4 + step * 2, fy - 3.8, 2.4, 2.4, 5); fluff(c, 2.8 - step * 2, fy - 3.8, 2.4, 2.4, 5);yBoot(c, -2.4 + step * 2.2, fy, Math.max(0, step) * 1.2);yBoot(c, 3 - step * 2.2, fy, Math.max(0, -step) * 1.2); }
  // body: shaggy fur with a cool blue shadow
  fluff(c, 0, by, 6.2, 5.8, 9);
  c.fillStyle = FUR_DK; ell(c, -1, by + 3, 4.8, 2.2); c.fill();
  c.fillStyle = '#1f6a2c'; c.beginPath(); c.moveTo(-5.2, by - 4.6); c.lineTo(-3.4, by - 5.4); c.lineTo(-0.6, by + 3.6); c.lineTo(-2.4, by + 4); c.closePath(); c.fill();
  c.fillStyle = HY.yellow; c.fillRect(-2.9, by + 0.6, 1.6, 1.2);
  // arms
  const ay = by - 1.2;
  if(o.glide){ fluff(c, -8.4, ay - 2, 5, 2, 6); fluff(c, 8, ay - 2, 5, 2, 6); c.fillStyle = 'rgba(160,230,255,.7)'; ell(c, 11.8, ay - 2, 2.4, 1); c.fill(); ell(c, -12, ay - 2, 2.4, 1); c.fill(); }
  else if(o.climb || o.carry){ const cl = o.carry ? 0 : Math.sin(o.ph) * 2; fluff(c, -3.8, ay - 8 - cl, 2, 3.6, 5); fluff(c, 4, ay - 8 + cl, 2, 3.6, 5); }
  else if(o.air){ fluff(c, -5, ay - 3.4, 2, 3, 5); }
  else if(o.done === 2){ const w = Math.sin(G.time * 12 + o.slot) * 1.4; fluff(c, -5.4, ay - 5 - w, 2, 3, 5); }
  // head
  fluff(c, hx, hy, 6.8, 6.2, 10);
  c.fillStyle = FUR_DK; ell(c, hx - 4.2, hy + 1.6, 2.2, 3); c.fill();
  // the face in shadow under the goggles, with a button nose
  c.fillStyle = FACE; rr(c, hx - 1.4, gy + 1.4, 10.2, 4.6, 2); c.fill();
  // huge shaggy beard: a pointed wedge of fur that sweeps down over the chest
  const sway = o.air ? -0.8 : o.moving ? Math.sin(o.ph * 0.5) * 0.4 : 0;
  c.fillStyle = FUR; c.beginPath(); c.moveTo(hx - 3.8, gy + 3.4);
  const B = [[-4.6, 6.6, -2.8, 8.8], [-1.6, 10, 0.4, 10.4], [1.4, 12.8, 3.4 + sway, 13.8 + sway * 0.5], [5.4, 12.8, 6.2, 10.8], [8, 10, 8.6, 8], [10.2, 6.6, 9.8, 4.6]];
  for(const q of B) c.quadraticCurveTo(hx + q[0], gy + q[1], hx + q[2], gy + q[3]);
  c.lineTo(hx + 5.4, gy + 5.6); c.lineTo(hx + 0.6, gy + 5.4);
  c.closePath(); c.fill();
  c.strokeStyle = FUR_LN; c.lineWidth = 0.55; c.lineJoin = 'round'; c.stroke();
  c.fillStyle = FUR_DK; c.beginPath(); c.moveTo(hx + 1.6, gy + 9.4); c.quadraticCurveTo(hx + 2.6, gy + 12.6, hx + 3.4 + sway, gy + 13.2 + sway * 0.5); c.quadraticCurveTo(hx + 4.6, gy + 11.4, hx + 4.4, gy + 9.2); c.fill();
  c.strokeStyle = 'rgba(120,145,170,.7)'; c.lineWidth = 0.45; c.lineCap = 'round'; c.beginPath();
  for(const j of [[0.6, 7.6, 0.2, 9.4], [3.4, 7.4, 3.4, 11], [6.4, 7.4, 7, 9.4]]){ c.moveTo(hx + j[0], gy + j[1]); c.lineTo(hx + j[2], gy + j[3]); }
  c.stroke();
  // button nose sitting in the shadowed face, just above the moustache
  c.fillStyle = '#12151f'; ell(c, hx + 6.6, gy + 3.9, 1.8, 1.25); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; circ(c, hx + 6.1, gy + 3.4, 0.45); c.fill();
  // moustache: two curls either side of the nose
  c.fillStyle = FUR; ell(c, hx + 3.8, gy + 5.6, 3.2, 1.4, 0.18); c.fill(); ell(c, hx + 8.4, gy + 5.4, 2.1, 1.2, -0.4); c.fill();
  c.strokeStyle = FUR_LN; c.lineWidth = 0.4; c.beginPath(); c.moveTo(hx + 1, gy + 5.8); c.quadraticCurveTo(hx + 3.8, gy + 7, hx + 6.4, gy + 5.8); c.stroke();
  if(o.air || o.done || o.carry || o.throwT > 0){ c.fillStyle = '#3a1f2a'; ell(c, hx + 5.6, gy + 7.4, 1.4, 1); c.fill(); c.fillStyle = '#ff7a8a'; ell(c, hx + 5.6, gy + 7.9, 0.8, 0.4); c.fill(); }
  // helmet in the player's colour: racing stripes, a brim, and the goggle strap wrapped round it
  c.fillStyle = shade(col, 0.62); c.beginPath(); c.arc(hx, hy - 0.8, 7.2, Math.PI * 1.0, Math.PI * 2.0); c.lineTo(hx + 7.6, hy + 0.2); c.lineTo(hx - 7.2, hy + 0.2); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(hx, hy - 1.2, 6.8, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); c.fill();
  c.save(); c.beginPath(); c.arc(hx, hy - 1.2, 6.8, Math.PI, Math.PI * 2); c.clip();
  c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(hx - 3.4, hy - 9); c.lineTo(hx - 0.4, hy - 9); c.lineTo(hx + 3.8, hy - 1); c.lineTo(hx + 0.8, hy - 1); c.fill();
  c.fillStyle = HY.gold; c.beginPath(); c.moveTo(hx + 0.4, hy - 9); c.lineTo(hx + 1.6, hy - 9); c.lineTo(hx + 5.8, hy - 1); c.lineTo(hx + 4.6, hy - 1); c.fill();
  c.fillStyle = INK; c.beginPath(); c.moveTo(hx - 7, hy - 3.2); c.lineTo(hx - 5.4, hy - 3.2); c.lineTo(hx - 3.8, hy - 1); c.lineTo(hx - 7, hy - 1); c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.5)'; ell(c, hx - 3, hy - 5, 1.8, 0.8, -0.5); c.fill();
  c.fillStyle = shade(col, 0.5); rr(c, hx + 3, hy - 1.2, 6.4, 1.3, 0.6); c.fill();
  // goggle strap
  c.fillStyle = INK; c.fillRect(hx - 7.2, gy - 1.2, 5, 2.4);
  c.fillStyle = HY.orange; c.fillRect(hx - 7.2, gy - 0.5, 5, 0.8);
  // big goggles: orange frame, mirrored lens with snowy peaks reflected in it
  c.fillStyle = INK; rr(c, hx - 3.2, gy - 3, 12.4, 6, 2.6); c.fill();
  c.fillStyle = HY.orange; rr(c, hx - 2.7, gy - 2.6, 11.4, 5.2, 2.3); c.fill();
  c.fillStyle = HY.deep; c.fillRect(hx + 2.6, gy - 2.6, 0.9, 5.2);
  const lx = hx - 1.7, lw = 9.4, lt = gy - 1.7, lh = 3.5;
  if(o.dead){
    c.fillStyle = '#6fb0d8'; rr(c, lx, lt, lw, lh, 1.6); c.fill();
    c.strokeStyle = '#231c35'; c.lineWidth = 0.7; c.beginPath();
    for(const ex of [hx + 1.4, hx + 5.4]){ c.moveTo(ex - 0.9, gy - 1); c.lineTo(ex + 0.9, gy + 1); c.moveTo(ex + 0.9, gy - 1); c.lineTo(ex - 0.9, gy + 1); }
    c.stroke();
  } else {
    c.save(); rr(c, lx, lt, lw, lh, 1.6); c.clip();
    const lens = c.createLinearGradient(0, lt, 0, lt + lh);
    lens.addColorStop(0, o.stage === 3 ? '#fff4a0' : '#bff0ff'); lens.addColorStop(1, o.stage === 3 ? '#ffb020' : '#2a8fe0');
    c.fillStyle = lens; c.fillRect(lx, lt, lw, lh);
    c.fillStyle = '#5b6b86'; c.beginPath(); c.moveTo(lx, lt + lh); c.lineTo(lx + 1.8, lt + 1.2); c.lineTo(lx + 3.2, lt + 2.2); c.lineTo(lx + 5, lt + 0.4); c.lineTo(lx + 7.4, lt + 2.4); c.lineTo(lx + lw, lt + 1.4); c.lineTo(lx + lw, lt + lh); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(lx + 1.8, lt + 1.2); c.lineTo(lx + 2.5, lt + 1.8); c.lineTo(lx + 1.3, lt + 1.9); c.fill();
    c.beginPath(); c.moveTo(lx + 5, lt + 0.4); c.lineTo(lx + 6.1, lt + 1.3); c.lineTo(lx + 4.9, lt + 1.5); c.lineTo(lx + 4, lt + 1.3); c.fill();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.moveTo(lx + 6.6, lt); c.lineTo(lx + 7.6, lt); c.lineTo(lx + 5.8, lt + lh); c.lineTo(lx + 4.8, lt + lh); c.fill();
    if(o.blink){ c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(lx, lt, lw, lh); }
    if(o.slow){ c.fillStyle = 'rgba(40,20,60,.5)'; c.fillRect(lx, lt, lw, lh * 0.5); }
    c.restore();
  }
  // front arm last, so it sits over the beard
  if(o.throwT > 0){ fluff(c, 6.4, ay, 3.8, 2, 5); const k = o.throwT / 0.2; if(k > 0.5){ c.fillStyle = '#fff'; circ(c, 10.4, ay - 1, 2.1); c.fill(); c.fillStyle = PAD; circ(c, 10.8, ay - 0.4, 1); c.fill(); } }
  else if(o.done === 2){ const w = Math.sin(G.time * 12 + o.slot) * 1.4; fluff(c, 6, ay - 6 + w, 2, 3, 5); }
  else if(!o.glide && !o.climb && !o.carry) fluff(c, 3.2 - step * 1.2, ay + 1.6, 2.1, 3.1, 5);
  c.restore();
}
/* Outlined sprite: draw into a small offscreen canvas at screen resolution, then stamp a dark ring round it. */
const OUT = { a: document.createElement('canvas'), b: document.createElement('canvas') };
function withOutline(c, halfW, top, bottom, draw, ink, width){
  const m = c.getTransform(), sc = Math.max(1, Math.hypot(m.a, m.b)), pad = 2;
  const lw = halfW * 2 + pad * 2, lh = bottom - top + pad * 2, W = Math.ceil(lw * sc), H = Math.ceil(lh * sc);
  if(W > 600 || H > 600){ draw(c); return; }
  for(const k of ['a', 'b']){ if(OUT[k].width < W) OUT[k].width = W; if(OUT[k].height < H) OUT[k].height = H; }
  const a = OUT.a.getContext('2d'), b = OUT.b.getContext('2d');
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, W + 2, H + 2);
  a.setTransform(sc, 0, 0, sc, (halfW + pad) * sc, (-top + pad) * sc); draw(a);
  b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, W + 2, H + 2); b.globalCompositeOperation = 'source-over';
  const o = Math.max(1, (width || 0.75) * sc);
  for(let i = 0; i < 8; i++){ const ang = i / 8 * Math.PI * 2; b.drawImage(OUT.a, 0, 0, W, H, Math.cos(ang) * o, Math.sin(ang) * o, W, H); }
  b.globalCompositeOperation = 'source-in'; b.fillStyle = ink || INK; b.fillRect(0, 0, W, H);
  b.globalCompositeOperation = 'source-over'; b.drawImage(OUT.a, 0, 0, W, H, 0, 0, W, H);
  c.drawImage(OUT.b, 0, 0, W, H, -halfW - pad, top - pad, W / sc, H / sc);
}
function yetiSprite(c, o){
  const k = STAGES[o.stage || 0].s * 1.25; withOutline(c, 16 * k, -30 * k, 3 * k, cc => drawYeti(cc, o), INK, 0.7);
}
function drawHero(c, p){
  if(p.inv > 0 && !p.bubble && !p.done && Math.floor(G.time * 20) % 2) return;
  const cx = p.x + p.w / 2, fy = p.y + p.h;
  const glowOn = p.glow > 0 && (p.glow > 2 || Math.floor(G.time * 10) % 2);
  if(glowOn){ c.fillStyle = hue(G.time * 400 + p.slot * 90, 95, 65); c.globalAlpha = 0.35; ell(c, cx, fy - p.h / 2, p.w * 0.95, p.h * 0.75); c.fill(); c.globalAlpha = 1; }
  c.save(); c.translate(cx, fy);
  let sq = 1;
  if(p.squashT > 0) sq = 1 - p.squashT * 1.1;
  if(p.dead > 0) c.rotate(Math.sin(p.dead * 18) * 0.25);
  if(p.slipT > 0) c.rotate(Math.sin(G.time * 30) * 0.12);
  const moving = Math.abs(p.vx) > 6, air = !p.onGround && !(p.dead > 0) && !p.climb;
  const yo = { color: p.color, face: p.face, stage: p.stage === undefined ? 1 : p.stage, air, moving, ph: p.x * 0.3, dead: p.dead > 0, done: p.done, climb: p.climb,
    throwT: p.throwT, glide: p.gliding, slow: p.slowT > 0, squash: sq, slot: p.slot, carry: p.carry, blink: Math.floor(G.time * 10 + p.slot * 13) % 41 === 0 };
  yetiSprite(c, yo);
  c.restore();
  if(p.slowT > 0 && Math.floor(G.time * 2) % 2 === 0) outlined(c, 'z', cx + 7, p.y - 3 - (G.time * 6 % 4), 5, '#c9b3ff');
  if(glowOn && Math.random() < 0.3 && G.state !== 'paused') spawnFx('sparkle', cx, p.y + p.h / 2, hue(G.time * 500));
}
function drawBubble(c, p){
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2, r = 14 + Math.sin(G.time * 4 + p.slot) * 0.9;
  c.save(); c.translate(cx, cy); c.scale(0.7, 0.7); c.translate(-cx, -cy - 3);
  drawHero(c, Object.assign({}, p, { inv: 0, onGround: true, vx: 0, glow: 0, squashT: 0, dead: 0, slipT: 0, climb: false, throwT: 0, gliding: false, carry: 0 }));
  c.restore();
  c.fillStyle = 'rgba(190,230,255,.2)'; circ(c, cx, cy, r); c.fill();
  c.strokeStyle = p.away ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.8)'; c.lineWidth = 1; circ(c, cx, cy, r); c.stroke();
  c.strokeStyle = p.color; c.globalAlpha = 0.6; c.lineWidth = 0.6; circ(c, cx, cy, r - 1.2); c.stroke(); c.globalAlpha = 1;
  c.fillStyle = 'rgba(255,255,255,.85)'; ell(c, cx - r * 0.45, cy - r * 0.5, 3, 1.6, -0.7); c.fill();
  if(p.away) outlined(c, 'AWAY', cx, cy + r + 5, 4, '#bbb');
}

/* ---------- Friends: Ishu the red panda, Ganu the monkey, Rudra the rhino ---------- */
function drawPal(c, q){
  const x = q.x + q.w / 2, fy = q.y + q.h, run = Math.abs(q.vx || 0) > 10, ph = G.time * 14 + q.id;
  const step = run ? Math.sin(ph) * 1.4 : 0, hop = q.st === 'party' ? 0 : 0;
  c.save(); c.translate(x, fy + hop); c.scale(q.face < 0 ? -1 : 1, 1);
  if(q.id === 0){
    // Ishu: rusty red fur, white cheeks, a big ringed tail and a yellow scarf
    c.strokeStyle = '#c8502a'; c.lineWidth = 3.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(-10, -5 - Math.sin(G.time * 5) * 1.5, -9, -11); c.stroke();
    c.strokeStyle = '#5a2412'; c.lineWidth = 3.5; c.setLineDash([1.4, 1.8]); c.beginPath(); c.moveTo(-5.5, -4.2); c.quadraticCurveTo(-10, -5 - Math.sin(G.time * 5) * 1.5, -9, -11); c.stroke(); c.setLineDash([]); c.lineCap = 'butt';
    c.fillStyle = '#3a1a10'; c.fillRect(-3.6 + step, -3, 2, 3); c.fillRect(1.6 - step, -3, 2, 3);
    c.fillStyle = '#c8502a'; ell(c, 0, -5, 5, 3.2); c.fill();
    c.fillStyle = '#3a1a10'; ell(c, 0.6, -3.2, 3.4, 1.2); c.fill();
    c.fillStyle = HY.yellow; c.fillRect(1.4, -7.2, 3, 1.4);
    c.fillStyle = '#c8502a'; circ(c, 4, -9, 3.6); c.fill();
    c.fillStyle = '#fff6ea'; ell(c, 5.6, -8.4, 1.8, 1.4); c.fill(); ell(c, 3, -7.8, 1.2, 0.9); c.fill();
    c.fillStyle = '#c8502a'; circ(c, 1.6, -12.2, 1.4); c.fill(); circ(c, 5.4, -12.4, 1.4); c.fill();
    c.fillStyle = '#fff6ea'; circ(c, 1.6, -12.2, 0.6); c.fill(); circ(c, 5.4, -12.4, 0.6); c.fill();
    c.fillStyle = '#231c35'; circ(c, 5, -9.6, 0.7); c.fill(); c.fillRect(7, -8.8, 0.9, 0.8);
  } else if(q.id === 1){
    // Ganu: a cheeky brown monkey with a curly tail and a little green cap
    c.strokeStyle = '#6a4020'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(-3, -4); c.quadraticCurveTo(-9, -4, -8, -9); c.arc(-6.6, -9, 1.4, Math.PI, Math.PI * 2.6); c.stroke();
    c.fillStyle = '#6a4020'; c.fillRect(-3 + step, -3.6, 2, 3.6); c.fillRect(1 - step, -3.6, 2, 3.6);
    c.fillStyle = '#8a5a30'; ell(c, 0, -6, 3.8, 3.6); c.fill();
    c.fillStyle = '#e8c89a'; ell(c, 0.8, -5.6, 2.2, 2.4); c.fill();
    const armUp = q.st === 'leap' || q.st === 'party';
    c.fillStyle = '#8a5a30'; rr(c, 2.4, armUp ? -12 : -7, 1.6, 5, 0.8); c.fill();
    c.fillStyle = '#8a5a30'; circ(c, 1, -11, 3.6); c.fill();
    c.fillStyle = '#e8c89a'; circ(c, -2.4, -11, 1.4); c.fill(); circ(c, 4.4, -11, 1.4); c.fill(); ell(c, 2, -10.4, 2.6, 2.2); c.fill();
    c.fillStyle = HY.green; c.beginPath(); c.arc(1, -12.4, 3.4, Math.PI, 0); c.fill(); c.fillRect(1, -12.8, 5, 1);
    c.fillStyle = '#231c35'; circ(c, 1.6, -11, 0.6); c.fill(); circ(c, 3.4, -11, 0.6); c.fill();
    c.strokeStyle = '#6a3222'; c.lineWidth = 0.5; c.beginPath(); c.arc(2.6, -9.8, 0.9, 0.2, Math.PI - 0.2); c.stroke();
  } else {
    // Rudra: a round grey rhino with one proud horn and a green bandana
    const charge = q.st === 'charge';
    c.fillStyle = '#5a6068'; c.fillRect(-7 + step, -4, 3, 4); c.fillRect(-2 - step, -4, 3, 4); c.fillRect(3 + step, -4, 3, 4);
    c.fillStyle = '#8a9098'; ell(c, -1, -7, 8.4, 5.4); c.fill();
    c.fillStyle = '#a8aeb6'; ell(c, -2, -9, 5, 2); c.fill();
    c.strokeStyle = '#6a7078'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(-4, -11.6); c.quadraticCurveTo(-5, -7, -3, -3); c.stroke();
    c.fillStyle = HY.green; c.fillRect(4.2, -11, 1.8, 7);
    c.fillStyle = '#8a9098'; ell(c, 7.4, -7, 4.2, 3.6); c.fill();
    c.fillStyle = '#e8e0cc'; tri(c, 9.4, -9, 11.6, -14.4, 11.6, -8.4);
    c.fillStyle = '#8a9098'; ell(c, 5.4, -10.6, 1, 1.8, -0.3); c.fill();
    c.fillStyle = '#231c35'; circ(c, 8, -8.2, 0.7); c.fill();
    c.fillStyle = '#6a7078'; c.fillRect(10.2, -6, 0.8, 0.8);
    if(charge && Math.random() < 0.5 && G.state !== 'paused') spawnFx('dust', q.x, q.y + q.h);
  }
  c.restore();
}

/* ---------- Yuck monsters, hazards and items ---------- */
function eyes(c, x, y, face, angry, sp){
  sp = sp || 3.4;
  c.fillStyle = '#fff'; ell(c, x, y, 1.6, 2); c.fill(); ell(c, x + sp, y, 1.6, 2); c.fill();
  c.fillStyle = '#1d1630'; circ(c, x + face * 0.6, y + 0.3, 0.9); c.fill(); circ(c, x + sp + face * 0.6, y + 0.3, 0.9); c.fill();
  if(angry){ c.strokeStyle = '#1d1630'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x - 1.6, y - 2.6); c.lineTo(x + 1.2, y - 1.8); c.moveTo(x + sp + 1.6, y - 2.6); c.lineTo(x + sp - 1.2, y - 1.8); c.stroke(); }
}
function drawFoe(c, e){
  const x = e.x, y = e.y, w = e.w, h = e.h, f = e.face || -1;
  if(e.k === 'blob'){
    // Sugar Blob: a wobbly pink jelly covered in sugar sparkles
    const wob = Math.sin(G.time * 8 + e.id) * 0.8;
    c.fillStyle = '#e0508a'; c.beginPath(); c.moveTo(x, y + h); c.quadraticCurveTo(x - 1, y + 2 - wob, x + w / 2, y + 1 + wob); c.quadraticCurveTo(x + w + 1, y + 2 - wob, x + w, y + h); c.closePath(); c.fill();
    c.fillStyle = '#ff8ab8'; c.beginPath(); c.moveTo(x + 1.4, y + h - 1); c.quadraticCurveTo(x + 0.4, y + 3 - wob, x + w / 2, y + 2.4 + wob); c.quadraticCurveTo(x + w - 0.4, y + 3 - wob, x + w - 1.4, y + h - 1); c.closePath(); c.fill();
    c.fillStyle = '#fff'; for(const d of [[3, 4], [9, 3.4], [11.4, 7], [2.6, 8]]) c.fillRect(x + d[0], y + d[1] + wob * 0.3, 1, 1);
    c.fillStyle = '#e0508a'; ell(c, x + (f > 0 ? 12 : 2), y + h + 0.4, 1, 1.4); c.fill();
    eyes(c, x + (f > 0 ? 5 : 3), y + 5.6, f, true, 3.6);
    c.strokeStyle = '#7a1a4a'; c.lineWidth = 0.6; c.beginPath(); c.arc(x + w / 2 + f, y + 9.4, 1.4, Math.PI + 0.3, -0.3); c.stroke();
  } else if(e.k === 'fizz'){
    if(G.region.key === 'ellora' || isBoss(G.lv) && lvDef().boss === 1){
      // a little cave bat
      const fl = Math.sin(G.time * 30 + e.id), aim = e.st === 'aim' || e.st === 'dive';
      c.fillStyle = '#4a2a5a'; c.beginPath(); c.moveTo(x + 6, y + 5); c.lineTo(x - 2, y + 1 - fl * 3); c.lineTo(x + 1, y + 7); c.lineTo(x + 3, y + 6); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x + 6, y + 5); c.lineTo(x + 14, y + 1 - fl * 3); c.lineTo(x + 11, y + 7); c.lineTo(x + 9, y + 6); c.closePath(); c.fill();
      c.fillStyle = '#6a3a7a'; ell(c, x + 6, y + 6, 3.6, 3.8); c.fill();
      tri(c, x + 3.4, y + 3, x + 4.4, y - 0.4, x + 5.4, y + 3); tri(c, x + 6.6, y + 3, x + 7.6, y - 0.4, x + 8.6, y + 3);
      c.fillStyle = aim ? '#ff6a4a' : '#ffd45e'; circ(c, x + 4.8, y + 5.6, 0.9); c.fill(); circ(c, x + 7.2, y + 5.6, 0.9); c.fill();
      c.fillStyle = '#fff'; c.fillRect(x + 5.4, y + 8, 0.6, 0.9); c.fillRect(x + 6.4, y + 8, 0.6, 0.9);
      return;
    }
    // Fizz Bubble: a grumpy fizzy-drink bubble trailing little bubbles
    const cx = x + 6, cy = y + 6 + Math.sin(G.time * 5 + e.id) * 0.6, aim = e.st === 'aim' || e.st === 'dive';
    c.fillStyle = 'rgba(255,150,60,.35)'; circ(c, cx, cy, 6.6); c.fill();
    c.fillStyle = 'rgba(255,170,70,.85)'; circ(c, cx, cy, 5.4); c.fill();
    c.fillStyle = 'rgba(255,230,160,.8)'; ell(c, cx - 2, cy - 2.4, 1.8, 1.2, -0.5); c.fill();
    c.fillStyle = 'rgba(255,255,255,.7)'; for(let i = 0; i < 3; i++){ const t = (G.time * 1.5 + i / 3 + e.id * 0.1) % 1; circ(c, cx - f * (4 + i * 2), cy + 3 - t * 8, 0.8 + (1 - t) * 0.6); c.fill(); }
    eyes(c, cx - 2.6 + f * 0.4, cy - 0.4, f, aim || true, 3.4);
  } else if(e.k === 'bot'){
    // Candy Bot: a boxy sweet-shop robot on a spring, lollipop antenna and all
    const air = e.onGround === false, sq = e.onGround && e.t < 0.1 ? 1.5 : 0;
    c.strokeStyle = '#7a8088'; c.lineWidth = 1; c.beginPath();
    for(let i = 0; i < 4; i++){ c.moveTo(x + 4, y + h - 3.6 + i * (air ? 1.2 : 0.9) - sq); c.lineTo(x + 10, y + h - 3 + i * (air ? 1.2 : 0.9) - sq); }
    c.stroke();
    c.fillStyle = '#c83a6a'; rr(c, x + 1, y + 3 + sq, 12, 8, 2); c.fill();
    c.fillStyle = '#ff7aa8'; rr(c, x + 1.8, y + 3.6 + sq, 10.4, 6.6, 1.6); c.fill();
    c.fillStyle = '#fff'; for(let i = 0; i < 3; i++) c.fillRect(x + 2.4 + i * 3.6, y + 9 + sq, 1.6, 1);
    c.strokeStyle = '#ffffff'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 7, y + 3 + sq); c.lineTo(x + 7, y - 0.6 + sq); c.stroke();
    c.fillStyle = '#ffd23a'; circ(c, x + 7, y - 1.4 + sq, 1.8); c.fill(); c.strokeStyle = '#e8413a'; c.lineWidth = 0.5; c.beginPath(); c.arc(x + 7, y - 1.4 + sq, 1, 0, 4.5); c.stroke();
    c.fillStyle = '#1d1630'; rr(c, x + 3, y + 5 + sq, 8, 2.8, 1); c.fill();
    c.fillStyle = '#7dff8a'; c.fillRect(x + 4 + (f > 0 ? 1.6 : 0), y + 5.8 + sq, 1.6, 1.2); c.fillRect(x + 7.4 + (f > 0 ? 1.6 : 0), y + 5.8 + sq, 1.6, 1.2);
  } else if(e.k === 'phantom'){
    // Maida Phantom: a puff of white flour with a cheeky grin
    const faded = e.st === 'fade';
    c.globalAlpha = faded ? 0.28 : 0.95;
    const cx = x + 7;
    c.fillStyle = '#f7f2e6'; c.beginPath(); c.arc(cx, y + 6, 6.4, Math.PI, 0);
    for(let i = 0; i <= 4; i++){ const px = cx + 6.4 - i * 3.2; c.lineTo(px, y + 13 + (i % 2 ? -1.6 : 0.4) + Math.sin(G.time * 6 + i) * 0.6); }
    c.closePath(); c.fill();
    c.fillStyle = '#e4dccb'; ell(c, cx + 2, y + 9, 3, 2); c.fill();
    c.fillStyle = '#3a3040'; ell(c, cx - 2 + f, y + 5.4, 1.1, 1.6); c.fill(); ell(c, cx + 2 + f, y + 5.4, 1.1, 1.6); c.fill();
    c.strokeStyle = '#3a3040'; c.lineWidth = 0.6; c.beginPath(); c.arc(cx + f, y + 8, 1.8, 0.2, Math.PI - 0.2); c.stroke();
    c.globalAlpha = 1;
    if(!faded && Math.random() < 0.15 && G.state !== 'paused') spawnFx('dust', cx, y + 13, 'rgba(250,246,236,.7)');
  } else if(e.k === 'sloth'){
    // Sloth Cloud: a sleepy lavender cloud. Touch it and you get very, very slow.
    const cx = x + 9, cy = y + 6;
    c.fillStyle = '#b8a4e8'; circ(c, cx - 5, cy + 1, 4); c.fill(); circ(c, cx, cy - 1.5, 5.4); c.fill(); circ(c, cx + 5.4, cy + 1, 4); c.fill(); rr(c, cx - 8, cy, 17, 5, 2.5); c.fill();
    c.fillStyle = '#d8ccff'; circ(c, cx - 1.4, cy - 3, 2.4); c.fill();
    c.strokeStyle = '#4a3a6a'; c.lineWidth = 0.7; c.beginPath(); c.arc(cx - 2.4, cy + 1, 1.2, 0.2, Math.PI - 0.2); c.moveTo(cx + 3.6, cy + 1); c.arc(cx + 2.4, cy + 1, 1.2, 0.2, Math.PI - 0.2); c.stroke();
    c.fillStyle = '#4a3a6a'; ell(c, cx, cy + 3.4, 1, 0.8); c.fill();
    if(Math.floor(G.time * 1.5 + e.id) % 2) outlined(c, 'z', cx + 8, cy - 6 - (G.time * 5 % 4), 4, '#e0d4ff');
  }
}
function drawRoll(c, x, y, r, rot){
  const k = G.region.key;
  c.save(); c.translate(x, y); c.rotate(rot);
  if(k === 'kerala'){ c.fillStyle = '#5a3418'; circ(c, 0, 0, r); c.fill(); c.fillStyle = '#7a4b2a'; circ(c, -0.6, -0.6, r - 1.2); c.fill(); c.fillStyle = '#2b1a0c'; circ(c, -1.6, -1.4, 1); c.fill(); circ(c, 1.6, -1.4, 1); c.fill(); circ(c, 0, 1.6, 1); c.fill(); }
  else if(k === 'odisha'){ c.fillStyle = '#fff'; circ(c, 0, 0, r); c.fill(); c.fillStyle = '#ff5a6e'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, 0, Math.PI / 2); c.fill(); c.fillStyle = '#3f8fe0'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, Math.PI, Math.PI * 1.5); c.fill(); c.fillStyle = '#ffd23a'; circ(c, 0, 0, 1.6); c.fill(); }
  else if(k === 'rajasthan'){ c.strokeStyle = '#a8803a'; c.lineWidth = 1; for(let i = 0; i < 6; i++){ c.beginPath(); c.arc(0, 0, r - i * 0.8, i, i + 4.4); c.stroke(); } }
  else if(k === 'assam'){ c.fillStyle = '#8a5a30'; circ(c, 0, 0, r); c.fill(); c.strokeStyle = '#c8905a'; c.lineWidth = 0.7; circ(c, 0, 0, r * 0.66); c.stroke(); circ(c, 0, 0, r * 0.33); c.stroke(); }
  else if(k === 'sikkim'){ c.fillStyle = '#d8ecf8'; circ(c, 0, 0, r); c.fill(); c.fillStyle = '#ffffff'; circ(c, -1, -1, r - 1.4); c.fill(); c.fillStyle = '#b8d8ee'; circ(c, 2, 2, 1.6); c.fill(); }
  else { const s = G.region.stone; c.fillStyle = shade(s[1], 0.85); circ(c, 0, 0, r); c.fill(); c.fillStyle = s[0]; circ(c, -0.6, -0.6, r - 1.2); c.fill(); c.strokeStyle = s[1]; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-r * 0.6, -r * 0.2); c.lineTo(0, 0.4); c.lineTo(r * 0.3, r * 0.7); c.stroke(); }
  c.restore();
}
function sugarCube(c, x, y, s, rot){
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  c.fillStyle = '#e8d8e0'; rr(c, -s, -s, s * 2, s * 2, s * 0.3); c.fill();
  c.fillStyle = '#ffffff'; rr(c, -s + 0.6, -s + 0.6, s * 2 - 2, s * 2 - 2, s * 0.25); c.fill();
  c.fillStyle = '#f4c8dc'; c.fillRect(-s * 0.5, -s * 0.2, 1, 1); c.fillRect(s * 0.3, s * 0.4, 1, 1); c.fillRect(s * 0.1, -s * 0.6, 1, 1);
  c.restore();
}
function drawHazard(c, e){
  const x = e.x, y = e.y;
  if(e.k === 'roll'){
    c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, x + 7, groundY(x + 7) - 0.5, 7, 1.6); c.fill();
    drawRoll(c, x + 7, y + 7, 7, -x / 7);
  } else if(e.k === 'dust'){
    c.fillStyle = 'rgba(250,246,236,.5)'; circ(c, x + 5, y + 5, 7); c.fill();
    c.fillStyle = '#f7f2e6'; circ(c, x + 5, y + 5, 5); c.fill(); c.fillStyle = '#e0d6c0'; c.beginPath(); c.arc(x + 5, y + 5, 3, e.t * 8, e.t * 8 + 3.6); c.lineTo(x + 5, y + 5); c.fill();
  } else if(e.k === 'cube'){ sugarCube(c, x + 5, y + 5, 5, e.t * 6); }
  else if(e.k === 'fallcube'){
    if(e.st === 'warn'){
      const a = Math.min(1, e.t / 0.9);
      c.fillStyle = 'rgba(0,0,0,' + (0.15 + a * 0.3) + ')'; ell(c, x + 7, 12 * T - 1, 4 + a * 6, 1.6); c.fill();
      if(Math.floor(G.time * 12) % 2){ c.fillStyle = 'rgba(255,200,230,.7)'; tri(c, x + 7, 26, x + 4, 20, x + 10, 20); }
    } else sugarCube(c, x + 7, y + 7, 7, e.t * 4);
  }
}
function drawItem(c, e){
  const x = e.x, y = e.y, bobY = e.st === 'sit' ? Math.sin(G.time * 4 + e.id) * 1 : 0;
  if(e.k === 'crate'){
    // a Humble Yeti supply crate (kraft box, green band, the little brand mark)
    const open = e.st === 'open', wob = !open && Math.sin(G.time * 3 + e.id) > 0.92 ? Math.sin(G.time * 40) * 0.1 : 0;
    c.save(); c.translate(x + 7, y + 13); c.rotate(wob);
    c.fillStyle = 'rgba(0,0,0,.18)'; ell(c, 0, 0, 7.5, 1.4); c.fill();
    c.fillStyle = '#a8763a'; c.fillRect(-7, -11, 14, 11);
    c.fillStyle = '#c89a5a'; c.fillRect(-6.4, -10.4, 12.8, 9.8);
    if(open){ c.fillStyle = '#6a4a20'; c.fillRect(-6, -10.4, 12, 3); c.fillStyle = '#c89a5a'; c.beginPath(); c.moveTo(-7, -11); c.lineTo(-10, -15); c.lineTo(-5, -13); c.fill(); c.beginPath(); c.moveTo(7, -11); c.lineTo(10, -15); c.lineTo(5, -13); c.fill(); }
    else { c.fillStyle = '#b88a4a'; c.fillRect(-7, -12.4, 14, 1.8); }
    c.fillStyle = HY.green; c.fillRect(-7, -6.6, 14, 3);
    miniMark(c, 0, -5.1, 2.6);
    if(!open){ c.fillStyle = e.item === 'feather' ? '#9fe8ff' : e.item === 'glow' ? '#ff9ad0' : HY.gold; circ(c, 4.6, -9, 0.9); c.fill(); }
    c.restore();
  } else if(e.k === 'star'){
    const cx = x + 6, cy = y + 6 + bobY;
    c.fillStyle = 'rgba(255,212,94,.3)'; circ(c, cx, cy, 9 + Math.sin(G.time * 6)); c.fill();
    c.fillStyle = '#e8a010'; star5(c, cx, cy, 7, 3.2); c.fill(); c.fillStyle = HY.gold; star5(c, cx, cy - 0.3, 6, 2.7); c.fill();
    c.fillStyle = '#6a3a0a'; c.fillRect(cx - 2, cy - 1, 1, 1.6); c.fillRect(cx + 1, cy - 1, 1, 1.6);
    c.strokeStyle = '#6a3a0a'; c.lineWidth = 0.5; c.beginPath(); c.arc(cx, cy + 1, 1.2, 0.2, Math.PI - 0.2); c.stroke();
  } else if(e.k === 'feather'){
    const cx = x + 6, cy = y + 6 + bobY + Math.sin(G.time * 3) * 1.5;
    c.fillStyle = 'rgba(160,230,255,.3)'; circ(c, cx, cy, 9); c.fill();
    c.save(); c.translate(cx, cy); c.rotate(-0.6 + Math.sin(G.time * 2) * 0.2);
    c.fillStyle = '#e8f8ff'; ell(c, 0, 0, 2.6, 7); c.fill(); c.fillStyle = '#9fe0ff'; ell(c, 0.8, 1.6, 1.4, 4.6); c.fill();
    c.strokeStyle = '#6aa8d0'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, 9); c.stroke();
    c.restore();
  } else if(e.k === 'glow'){
    const cx = x + 6, cy = y + 6 + bobY;
    c.fillStyle = hue(G.time * 200, 90, 70); c.globalAlpha = 0.4; circ(c, cx, cy, 9 + Math.sin(G.time * 6)); c.fill(); c.globalAlpha = 1;
    c.fillStyle = hue(G.time * 200 + 60, 90, 72); circ(c, cx, cy, 5.2); c.fill();
    heart(c, cx, cy, 2.6, '#ffffff');
  }
}
function drawStall(c, x, by){
  // a little Humble Yeti pancake stall at every basecamp
  c.fillStyle = '#8a5a30'; c.fillRect(x + 1, by - 18, 1.6, 18); c.fillRect(x + 21, by - 18, 1.6, 18);
  for(let i = 0; i < 6; i++){ c.fillStyle = i % 2 ? HY.yellow : HY.green; c.beginPath(); c.moveTo(x - 1 + i * 4.2, by - 20); c.lineTo(x + 3.2 + i * 4.2, by - 20); c.lineTo(x + 3.2 + i * 4.2, by - 16.6); c.quadraticCurveTo(x + 1.1 + i * 4.2, by - 15, x - 1 + i * 4.2, by - 16.6); c.fill(); }
  c.fillStyle = '#b07a44'; c.fillRect(x, by - 8, 24, 8); c.fillStyle = '#c89a5a'; c.fillRect(x, by - 8, 24, 1.6);
  c.fillStyle = HY.green; c.fillRect(x + 3, by - 5.4, 18, 3); miniMark(c, x + 12, by - 3.9, 1.3);
  for(let i = 0; i < 3; i++){ c.fillStyle = '#c87a2a'; ell(c, x + 8, by - 9 - i * 1.6, 4, 1.1); c.fill(); c.fillStyle = '#f0b050'; ell(c, x + 8, by - 9.4 - i * 1.6, 3.6, 0.8); c.fill(); }
  c.fillStyle = '#b8522a'; ell(c, x + 8, by - 14, 2.4, 0.8); c.fill(); c.fillStyle = '#e8413a'; circ(c, x + 8.6, by - 14.8, 0.9); c.fill();
  c.fillStyle = '#f4efe2'; rr(c, x + 14, by - 12, 7, 3.4, 1); c.fill(); c.fillStyle = '#c87a2a'; ell(c, x + 17.5, by - 11, 2.4, 0.7); c.fill();
}
function drawProp(c, e){
  const I = G.region, x = e.x, y = e.y, k = I.key;
  if(e.k === 'snow'){ c.fillStyle = 'rgba(180,220,255,.4)'; circ(c, x + 4, y + 4, 5.4); c.fill(); c.fillStyle = '#ffffff'; circ(c, x + 4, y + 4, 4); c.fill(); c.fillStyle = '#cfe6f8'; circ(c, x + 5.2, y + 5.2, 1.8); c.fill(); }
  else if(e.k === 'plat'){
    const w = e.w;
    if(k === 'odisha'){
      // a friendly sea turtle giving you a ride
      const pad = Math.sin(G.time * 5) * 2;
      c.fillStyle = '#4a9a6a'; ell(c, x + 6 - pad, y + 7, 5, 2, -0.4); c.fill(); ell(c, x + w - 8 + pad, y + 7, 5, 2, 0.4); c.fill();
      c.fillStyle = '#5ab87a'; circ(c, x + w + 2, y + 3, 4); c.fill(); c.fillStyle = '#1d1630'; circ(c, x + w + 3.4, y + 2, 0.8); c.fill();
      c.strokeStyle = '#1d1630'; c.lineWidth = 0.5; c.beginPath(); c.arc(x + w + 3, y + 3.6, 1.2, 0.2, Math.PI - 0.2); c.stroke();
      c.fillStyle = '#3a6a2a'; ell(c, x + w / 2, y + 4, w / 2, 5.4); c.fill();
      c.fillStyle = '#6a9a3a'; ell(c, x + w / 2, y + 3, w / 2 - 2, 4); c.fill();
      c.strokeStyle = '#3a6a2a'; c.lineWidth = 0.7; c.beginPath(); for(let i = 1; i < 4; i++){ c.moveTo(x + i * w / 4, y); c.lineTo(x + i * w / 4 + (i - 2) * 2, y + 7); } c.moveTo(x + 4, y + 3.5); c.lineTo(x + w - 4, y + 3.5); c.stroke();
    } else if(k === 'sikkim'){
      c.fillStyle = '#8fc8e8'; rr(c, x, y, w, 8, 3); c.fill(); c.fillStyle = '#e8f8ff'; rr(c, x + 1, y, w - 2, 4.6, 2.3); c.fill(); c.fillStyle = '#fff'; c.fillRect(x + 6, y + 1.4, 8, 0.8);
    } else if(k === 'kerala'){
      // a little canoe with a curled prow
      c.fillStyle = '#5a3418'; c.beginPath(); c.moveTo(x - 4, y - 3); c.quadraticCurveTo(x + 2, y + 8, x + w / 2, y + 8); c.quadraticCurveTo(x + w - 2, y + 8, x + w + 4, y - 3); c.lineTo(x + w - 2, y + 1); c.lineTo(x + 2, y + 1); c.fill();
      c.fillStyle = '#8a5a30'; c.fillRect(x + 1, y, w - 2, 2.2); c.fillStyle = '#ffd23a'; c.fillRect(x + 8, y + 3.6, w - 16, 0.8);
      c.fillStyle = '#e8413a'; circ(c, x - 3.4, y - 3.4, 1); c.fill(); circ(c, x + w + 3.4, y - 3.4, 1); c.fill();
    } else {
      const bam = k === 'assam';
      for(let i = 0; i < 4; i++){ c.fillStyle = bam ? '#8a9a2a' : '#6f4523'; rr(c, x + i * 12, y, 11.4, 8, 3.5); c.fill(); c.fillStyle = bam ? '#c8d85a' : '#b27b45'; rr(c, x + 0.6 + i * 12, y + 0.6, 10.2, 5, 2.5); c.fill(); }
      c.fillStyle = '#e9d9b0'; c.fillRect(x + 7, y, 1.4, 8); c.fillRect(x + w - 8.4, y, 1.4, 8);
    }
  } else if(e.k === 'lift'){
    const w = e.w;
    if(k === 'sikkim'){ c.fillStyle = '#7ab0d0'; rr(c, x, y, w, 8, 2); c.fill(); c.fillStyle = '#d8f0ff'; rr(c, x + 0.5, y, w - 1, 5, 2); c.fill(); }
    else if(k === 'kerala' || k === 'assam' || k === 'odisha'){
      c.fillStyle = '#2f8f3a'; ell(c, x + w / 2, y + 3.5, w / 2 + 2, 4.6); c.fill();
      c.fillStyle = '#56c84a'; ell(c, x + w / 2, y + 3, w / 2, 3.6); c.fill();
      c.fillStyle = '#ff8ab0'; circ(c, x + w - 6, y + 1.4, 1.8); c.fill(); c.fillStyle = '#fff'; circ(c, x + w - 6, y + 1.4, 0.7); c.fill();
    } else { const s = I.stone; c.fillStyle = s[1]; rr(c, x, y, w, 8, 2); c.fill(); c.fillStyle = s[0]; rr(c, x + 0.5, y, w - 1, 5, 2); c.fill(); c.fillStyle = s[2]; c.fillRect(x + 2, y + 0.6, w - 4, 1); }
  } else if(e.k === 'spring'){
    const cmp = e.t > 0 && e.t < 0.3 ? Math.sin(e.t / 0.3 * Math.PI) : 0;
    if(k === 'rajasthan'){
      // a sitting camel: bounce off its hump!
      const hy = y + 1 + cmp * 3;
      c.fillStyle = '#b8803a'; ell(c, x + 8, y + 8, 8, 2.6); c.fill();
      c.fillStyle = '#d09a50'; ell(c, x + 8, hy + 4, 6, 3.6); c.fill(); ell(c, x + 8, hy + 1.6, 3.4, 2.6); c.fill();
      c.fillStyle = '#d09a50'; rr(c, x + 13, y + 1, 2.4, 7, 1.2); c.fill(); ell(c, x + 15.6, y + 1, 2.6, 1.8); c.fill();
      c.fillStyle = '#1d1630'; circ(c, x + 16, y + 0.4, 0.5); c.fill();
      c.fillStyle = '#e8413a'; c.fillRect(x + 4, hy + 2.6, 8, 1.2); c.fillStyle = HY.yellow; c.fillRect(x + 5, hy + 3.8, 1, 1); c.fillRect(x + 8, hy + 3.8, 1, 1); c.fillRect(x + 11, hy + 3.8, 1, 1);
    } else {
      // a dhol drum
      const top = y + 1 + cmp * 3;
      c.fillStyle = '#a8322a'; rr(c, x + 1, top + 1, 14, y + 10 - top - 1, 2); c.fill();
      c.strokeStyle = HY.yellow; c.lineWidth = 0.6; c.beginPath(); for(let i = 0; i < 4; i++){ c.moveTo(x + 2 + i * 4, top + 1.6); c.lineTo(x + 4 + i * 4, y + 9.4); c.moveTo(x + 4 + i * 4, top + 1.6); c.lineTo(x + 2 + i * 4, y + 9.4); } c.stroke();
      c.fillStyle = '#f4ead8'; ell(c, x + 8, top + 1, 7, 1.8); c.fill(); c.fillStyle = '#d8c8a8'; ell(c, x + 8, top + 1, 3, 0.8); c.fill();
    }
  } else if(e.k === 'tent'){
    const got = e.st === 'got', bx = x, by = y + e.h;
    drawStall(c, bx + 40, by);
    c.fillStyle = '#1f6a2c'; tri(c, bx, by, bx + 18, by - 26, bx + 36, by);
    c.fillStyle = HY.green; tri(c, bx + 2, by, bx + 18, by - 24, bx + 34, by);
    c.fillStyle = HY.leaf; tri(c, bx + 18, by - 24, bx + 34, by, bx + 26, by);
    c.fillStyle = '#123e1a'; tri(c, bx + 12, by, bx + 18, by - 12, bx + 24, by);
    c.fillStyle = HY.yellow; c.fillRect(bx + 2, by - 1.4, 32, 1.4);
    c.strokeStyle = HY.yellow; c.lineWidth = 0.7; c.beginPath(); c.moveTo(bx + 18, by - 24); c.lineTo(bx + 18, by - 12); c.stroke();
    c.strokeStyle = '#6a4a28'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(bx + 18, by - 25); c.lineTo(bx + 18, by - 36); c.stroke();
    const fw = got ? Math.sin(G.time * 6) * 1.2 : 0;
    c.fillStyle = got ? HY.green : '#8a8a8a'; c.beginPath(); c.moveTo(bx + 18, by - 36); c.lineTo(bx + 28, by - 34 + fw); c.lineTo(bx + 18, by - 31); c.fill();
    if(got){ miniMark(c, bx + 22, by - 33.6, 1.5); }
    // campfire
    c.fillStyle = '#6b3a1c'; c.save(); c.translate(bx - 7, by - 1.5); c.rotate(0.35); c.fillRect(-5, -1, 10, 2); c.rotate(-0.7); c.fillRect(-5, -1, 10, 2); c.restore();
    if(got){ const f = G.time * 12; c.fillStyle = 'rgba(255,150,60,.25)'; circ(c, bx - 7, by - 6, 8); c.fill();
      c.fillStyle = '#ff5a2a'; c.beginPath(); c.moveTo(bx - 11, by - 2); c.quadraticCurveTo(bx - 10, by - 9, bx - 7 + Math.sin(f) * 1.2, by - 12); c.quadraticCurveTo(bx - 4, by - 9, bx - 3, by - 2); c.fill();
      c.fillStyle = '#ffd24a'; c.beginPath(); c.moveTo(bx - 9, by - 2); c.quadraticCurveTo(bx - 8.5, by - 6, bx - 7 + Math.sin(f + 1), by - 8); c.quadraticCurveTo(bx - 5.5, by - 6, bx - 5, by - 2); c.fill(); }
  } else if(e.k === 'gate'){
    // the basecamp gate: bamboo poles, a sign with the brand mark and a string of prayer flags
    const post = px => { c.fillStyle = '#8a9a2a'; rr(c, px, y + 10, 6, 54, 2); c.fill(); c.fillStyle = '#c8d85a'; c.fillRect(px + 1, y + 10, 1.4, 54); c.fillStyle = '#6a7a1a'; for(let i = 0; i < 5; i++) c.fillRect(px, y + 18 + i * 10, 6, 1.2); };
    post(x); post(x + e.w - 6);
    flagString(c, x + 3, y + 22, x + e.w - 3, y + 22, 8, 1, false);
    c.fillStyle = '#6a4a28'; rr(c, x - 4, y + 2, e.w + 8, 13, 2); c.fill();
    c.fillStyle = '#c89a5a'; rr(c, x - 3, y + 3, e.w + 6, 11, 2); c.fill();
    miniMark(c, x + 7, y + 8.5, 4);
    text(c, 'CAMP', x + 13, y + 5.6, 5, HY.dark, 'left', 'top');
  } else if(e.k === 'cave'){
    c.fillStyle = '#120a10'; c.beginPath(); c.moveTo(x + 1, y + 32); c.lineTo(x + 1, y + 12); c.quadraticCurveTo(x + 16, y - 4, x + 31, y + 12); c.lineTo(x + 31, y + 32); c.fill();
    if(e.st === 'open'){
      const a = 0.5 + Math.sin(G.time * 4) * 0.3;
      c.fillStyle = 'rgba(255,212,94,' + a + ')'; star5(c, x + 16, y + 20, 3.4, 1.4); c.fill();
      outlined(c, 'SECRET!', x + 16, y - 6 + Math.sin(G.time * 3) * 1.5, 4.5, '#ffd45e');
    }
  } else if(e.k === 'exit'){
    c.fillStyle = '#120a10'; c.beginPath(); c.moveTo(x - 14, y + 32); c.lineTo(x - 14, y + 18); c.quadraticCurveTo(x - 7, y + 8, x, y + 14); c.lineTo(x, y + 32); c.fill();
  } else if(e.k === 'bird'){
    if(k === 'odisha'){
      // a baby turtle stuck on its back; touch it to flip it over
      if(!e.st){ const wig = Math.sin(G.time * 10) * 1.2; c.fillStyle = '#6a9a5a'; ell(c, x + 3 + wig, y + 9, 1.6, 2.6, 0.6); c.fill(); ell(c, x + 11 - wig, y + 9, 1.6, 2.6, -0.6); c.fill(); c.fillStyle = '#e8e0b0'; ell(c, x + 7, y + 11, 5.4, 3); c.fill(); c.fillStyle = '#6a9a5a'; circ(c, x + 13, y + 12, 1.8); c.fill(); outlined(c, 'HELP!', x + 7, y + 2 + Math.sin(G.time * 4), 3.6, '#ffd45e'); }
      else { const dx = Math.min(40, e.t * 14); c.fillStyle = '#3f6a3a'; ell(c, x + 7 + dx, y + 11.6, 5, 2.6); c.fill(); c.fillStyle = '#6a9a5a'; circ(c, x + 12.6 + dx, y + 12, 1.6); c.fill(); if(e.t < 2) heart(c, x + 7 + dx, y + 4 - e.t * 3, 2, '#ff7eb6'); }
      return;
    }
    // a little bird in a bamboo cage
    c.fillStyle = '#6a4a28'; c.fillRect(x, y + 12, 14, 2); c.fillRect(x + 1, y, 12, 1.6);
    if(!e.st){
      const hop = Math.abs(Math.sin(G.time * 5)) * 1.2;
      c.fillStyle = '#ffd45e'; ell(c, x + 7, y + 9 - hop, 3.2, 2.6); c.fill(); circ(c, x + 9, y + 6.4 - hop, 2); c.fill();
      c.fillStyle = '#ff9a3a'; tri(c, x + 10.6, y + 6 - hop, x + 12.4, y + 6.6 - hop, x + 10.6, y + 7.2 - hop); c.fillStyle = '#1d1630'; circ(c, x + 9.4, y + 6 - hop, 0.5); c.fill();
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.8; c.beginPath(); for(let i = 0; i < 5; i++){ c.moveTo(x + 1.5 + i * 2.75, y + 1); c.lineTo(x + 1.5 + i * 2.75, y + 12); } c.stroke();
      outlined(c, 'HELP!', x + 7, y - 4 + Math.sin(G.time * 4), 3.6, '#ffd45e');
    } else { c.strokeStyle = '#8a6a3a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x + 1.5, y + 1); c.lineTo(x + 1.5, y + 12); c.moveTo(x + 12.5, y + 1); c.lineTo(x + 12.5, y + 12); c.moveTo(x + 4, y + 1); c.lineTo(x - 2, y - 4); c.stroke(); }
  } else if(e.k === 'sapling'){
    const bx = x + 7, by = y + e.h;
    c.fillStyle = '#7a5a3a'; ell(c, bx, by - 1, 6, 2); c.fill();
    if(!e.st){
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx, by - 2); c.quadraticCurveTo(bx + 1, by - 9, bx + 4, by - 10); c.stroke();
      c.fillStyle = '#b89a5a'; ell(c, bx + 4.6, by - 8.6, 2, 1, 1.1); c.fill(); ell(c, bx - 1.6, by - 6, 2, 1, -0.9); c.fill();
      outlined(c, 'THIRSTY', bx, y - 2 + Math.sin(G.time * 4), 3.4, '#9fdcff');
    } else {
      const g = Math.min(1, e.t * 2);
      c.strokeStyle = '#4a7a2a'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(bx, by - 2); c.lineTo(bx, by - 2 - 12 * g); c.stroke();
      c.fillStyle = '#3fbf5a'; ell(c, bx - 3, by - 8 * g, 3, 1.4, -0.4); c.fill(); ell(c, bx + 3, by - 10 * g, 3, 1.4, 0.4); c.fill();
      c.fillStyle = '#ff8ab0'; for(let i = 0; i < 5; i++){ const a = i * 1.26 + G.time; circ(c, bx + Math.cos(a) * 1.8, by - 15 * g + Math.sin(a) * 1.8, 1.2); c.fill(); }
      c.fillStyle = HY.yellow; circ(c, bx, by - 15 * g, 1); c.fill();
    }
  } else if(e.k === 'cage'){
    const open = !!e.st;
    if(!open){ drawPal(c, { id: e.fid, x: x + 10 - PAL_SIZE[e.fid][0] / 2, y: y + 18 - PAL_SIZE[e.fid][1], w: PAL_SIZE[e.fid][0], h: PAL_SIZE[e.fid][1], face: 1, vx: 0 }); }
    c.fillStyle = '#6a4a28'; c.fillRect(x, y + 18, 20, 2.4); c.fillRect(x, y, 20, 2);
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 1; c.beginPath();
    for(let i = 0; i < 6; i++){ if(open && i > 0 && i < 5) continue; c.moveTo(x + 1 + i * 3.6, y + 1); c.lineTo(x + 1 + i * 3.6, y + 18); }
    c.stroke();
    if(!open) outlined(c, 'HELP ' + FRIENDS[e.fid].name.toUpperCase() + '!', x + 10, y - 5 + Math.sin(G.time * 4), 4, '#ffd45e');
  } else if(e.k === 'eagle'){
    // a Himalayan golden eagle that gives rides across big gaps
    const fl = Math.sin(G.time * (e.st === 'perch' ? 6 : 12)), cx = x + e.w / 2, cy = y + 6;
    c.save(); c.translate(cx, cy); c.scale(e.face < 0 ? -1 : 1, 1);
    c.fillStyle = '#6a4020'; c.beginPath(); c.moveTo(-2, 0); c.quadraticCurveTo(-10, -6 - fl * 5, -16, -2 - fl * 7); c.quadraticCurveTo(-9, 2, -2, 3); c.fill();
    c.beginPath(); c.moveTo(2, 0); c.quadraticCurveTo(8, -6 - fl * 5, 14, -2 - fl * 7); c.quadraticCurveTo(8, 2, 2, 3); c.fill();
    c.fillStyle = '#8a5a2a'; ell(c, 0, 1.6, 6, 3.6); c.fill();
    c.fillStyle = '#d8a040'; circ(c, 6, -1, 3); c.fill();
    c.fillStyle = HY.gold; tri(c, 8.4, -1.6, 11.4, -0.4, 8.4, 0.6);
    c.fillStyle = '#1d1630'; circ(c, 7, -1.8, 0.7); c.fill();
    c.fillStyle = '#6a4020'; tri(c, -6, 1, -11, 4, -6, 4);
    c.strokeStyle = HY.gold; c.lineWidth = 1; c.beginPath(); c.moveTo(-2, 4.6); c.lineTo(-2.4, 9); c.moveTo(2, 4.6); c.lineTo(2.4, 9); c.stroke();
    c.restore();
    if(e.st === 'perch') outlined(c, 'RIDE!', cx, y - 8 + Math.sin(G.time * 4), 4, '#ffd45e');
  } else if(e.k === 'lantern'){
    c.strokeStyle = '#3a2a20'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(x + 4, y - 6); c.lineTo(x + 4, y); c.stroke();
    c.fillStyle = 'rgba(255,190,90,.25)'; circ(c, x + 4, y + 5, 8 + Math.sin(G.time * 5 + e.id) * 0.6); c.fill();
    c.fillStyle = '#b8862a'; rr(c, x, y, 8, 10, 2); c.fill(); c.fillStyle = '#ffd87a'; rr(c, x + 1.4, y + 2, 5.2, 6, 1.6); c.fill();
    c.fillStyle = '#b8862a'; c.fillRect(x + 3.6, y + 2, 0.8, 6);
  }
}

/* ---------- Bosses ---------- */
function drawBoss(c, e){
  const x = e.x, y = e.y, w = e.w, h = e.h, f = e.face || -1, flash = e.inv > 0 && Math.floor(G.time * 16) % 2;
  if(e.bw === 2 && e.st === 'hop'){ const gy = 12 * T, k = clamp(1 - (gy - (y + h)) / 120, 0.3, 1); c.fillStyle = 'rgba(20,10,40,' + (0.18 + k * 0.25) + ')'; ell(c, x + w / 2, gy - 1, w * 0.55 * k + 4, 3 * k + 1); c.fill(); }
  c.save();
  if(e.st === 'defeat' && e.bw !== 2){ c.translate(x + w / 2, y + h / 2); c.rotate(Math.sin(e.t * 6) * 0.3); c.translate(-(x + w / 2), -(y + h / 2)); }
  if(e.bw === 0){
    // The Sandstorm Djinn: a grumpy swirl of maida dust with a tornado tail
    const tired = e.st === 'tired', cx = x + w / 2, hy = y + 14;
    c.save(); if(!tired && e.st !== 'defeat'){ c.beginPath(); c.rect(x - 40, y - 40, w + 80, 12 * T + 6 - (y - 40)); c.clip(); }
    const body = flash ? '#ffffff' : '#efe6d2', dk = flash ? '#ffffff' : '#d4c6a8';
    c.strokeStyle = dk; c.lineWidth = 2.2;
    for(let i = 0; i < 5; i++){ const r = 13 - i * 2.4, yy = hy + 16 + i * 6, a = G.time * 8 + i; c.beginPath(); c.ellipse(cx + Math.sin(a) * 2, yy, Math.max(1, r), 2.4, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = body; for(const d of [[-12, 2, 9], [12, 2, 9], [0, -4, 13], [-6, 8, 9], [7, 8, 9]]){ circ(c, cx + d[0], hy + d[1], d[2]); c.fill(); }
    c.fillStyle = flash ? '#fff' : '#fffaf0'; circ(c, cx - 5, hy - 8, 5); c.fill();
    if(tired){
      c.strokeStyle = '#4a3a2a'; c.lineWidth = 0.8;
      for(const ex of [cx - 6, cx + 4]){ c.beginPath(); c.arc(ex, hy, 2.4, G.time * 8, G.time * 8 + 4.6); c.stroke(); }
      for(let i = 0; i < 3; i++){ const a = G.time * 5 + i * 2.1; c.fillStyle = '#ffd45e'; star5(c, cx + Math.cos(a) * 13, hy - 18 + Math.sin(a) * 3, 2.2, 1); c.fill(); }
    } else {
      c.fillStyle = '#3a2a20'; ell(c, cx - 6, hy, 2.2, 2.8); c.fill(); ell(c, cx + 4, hy, 2.2, 2.8); c.fill();
      c.fillStyle = '#fff'; circ(c, cx - 6.6, hy - 1, 0.8); c.fill(); circ(c, cx + 3.4, hy - 1, 0.8); c.fill();
      c.strokeStyle = '#3a2a20'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(cx - 10, hy - 5); c.lineTo(cx - 3, hy - 3); c.moveTo(cx + 8, hy - 5); c.lineTo(cx + 1, hy - 3); c.stroke();
      c.fillStyle = '#6a4a3a'; ell(c, cx - 1, hy + 7, 3, 1.6 + (e.st === 'throw' ? Math.abs(Math.sin(G.time * 8)) : 0)); c.fill();
      if(e.st === 'throw'){ c.fillStyle = '#f7f2e6'; circ(c, x - 2, hy - 8 + Math.sin(G.time * 10) * 2, 4.4); c.fill(); }
    }
    c.restore();
    if(!tired && e.st !== 'defeat' && e.st !== 'intro' && Math.random() < 0.4 && G.state !== 'paused') spawnFx('flour', x + Math.random() * w, 12 * T + 4);
  } else if(e.bw === 1){
    // The Bat Swarm: a big purple bat with a crowd of little bats circling
    const cx = x + w / 2, stuck = e.st === 'stuck', fl = stuck ? 0 : Math.sin(G.time * 14);
    for(let i = 0; i < 4; i++){ const a = G.time * 3 + i * Math.PI / 2, bx = cx + Math.cos(a) * 24, byy = y + 12 + Math.sin(a) * 10;
      c.fillStyle = '#4a2a5a'; tri(c, bx, byy, bx - 5, byy - 3 - Math.sin(G.time * 30 + i) * 2, bx - 2, byy + 2); tri(c, bx, byy, bx + 5, byy - 3 - Math.sin(G.time * 30 + i) * 2, bx + 2, byy + 2);
      c.fillStyle = '#6a3a7a'; circ(c, bx, byy, 2); c.fill(); }
    const body = flash ? '#ffffff' : '#5a2a6a', light = flash ? '#fff' : '#7a4a8a';
    c.fillStyle = body;
    if(stuck){ ell(c, cx - 14, y + h - 4, 12, 4, 0.2); c.fill(); ell(c, cx + 14, y + h - 4, 12, 4, -0.2); c.fill(); }
    else {
      c.beginPath(); c.moveTo(cx - 6, y + 12); c.quadraticCurveTo(cx - 20, y - 4 - fl * 8, cx - 30, y + 4 - fl * 10); c.lineTo(cx - 24, y + 14); c.lineTo(cx - 18, y + 12); c.lineTo(cx - 12, y + 18); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(cx + 6, y + 12); c.quadraticCurveTo(cx + 20, y - 4 - fl * 8, cx + 30, y + 4 - fl * 10); c.lineTo(cx + 24, y + 14); c.lineTo(cx + 18, y + 12); c.lineTo(cx + 12, y + 18); c.closePath(); c.fill();
    }
    c.fillStyle = body; ell(c, cx, y + h / 2 + 3, 11, 12); c.fill();
    c.fillStyle = light; ell(c, cx, y + h / 2 + 6, 7, 7); c.fill();
    c.fillStyle = body; tri(c, cx - 9, y + 6, cx - 7, y - 6, cx - 2, y + 4); tri(c, cx + 9, y + 6, cx + 7, y - 6, cx + 2, y + 4);
    c.fillStyle = '#e8a0d0'; tri(c, cx - 7.6, y + 4, cx - 6.8, y - 2.4, cx - 4.4, y + 3);
    tri(c, cx + 7.6, y + 4, cx + 6.8, y - 2.4, cx + 4.4, y + 3);
    if(stuck){
      c.strokeStyle = '#ffd45e'; c.lineWidth = 0.7; for(const ex of [cx - 4, cx + 4]){ c.beginPath(); c.arc(ex, y + 11, 1.8, G.time * 8, G.time * 8 + 4.6); c.stroke(); }
      for(let i = 0; i < 3; i++){ const a = G.time * 6 + i * 2.1; c.fillStyle = '#fff'; star5(c, cx + Math.cos(a) * 12, y - 4 + Math.sin(a) * 2.5, 2.2, 1); c.fill(); }
    } else {
      const aim = e.st === 'aim' || e.st === 'dive';
      c.fillStyle = aim ? '#ff6a4a' : '#ffd45e'; ell(c, cx - 4 + f * 0.6, y + 11, 2.2, 2.6); c.fill(); ell(c, cx + 4 + f * 0.6, y + 11, 2.2, 2.6); c.fill();
      c.fillStyle = '#1d1630'; circ(c, cx - 4 + f * 1.2, y + 11.4, 1); c.fill(); circ(c, cx + 4 + f * 1.2, y + 11.4, 1); c.fill();
    }
    c.fillStyle = '#fff'; tri(c, cx - 2.4, y + 16, cx - 1.4, y + 18.6, cx - 0.4, y + 16); tri(c, cx + 0.4, y + 16, cx + 1.4, y + 18.6, cx + 2.4, y + 16);
  } else {
    // The Sugar Cube King: a sparkly sugar cube with a crown and a candy-cane sceptre
    const cx = x + w / 2, melt = e.st === 'defeat' ? Math.min(1, e.t / 2.2) : 0;
    const open = e.st === 'spit' || e.st === 'tired', stomp = e.st === 'drum';
    c.save();
    c.translate(cx, y + h); c.scale(1 - melt * 0.55, 1 - melt * 0.62); c.translate(-cx, -(y + h));
    const body = flash ? '#ffffff' : '#fff4f8', edge = flash ? '#fff' : '#e8c8d8';
    if(e.st === 'intro'){ c.fillStyle = 'rgba(255,200,230,.5)'; ell(c, cx, 12 * T, 30, 5); c.fill(); }
    c.fillStyle = edge; rr(c, x, y + 6, w, h - 6, 6); c.fill();
    c.fillStyle = body; rr(c, x + 2, y + 7, w - 6, h - 11, 5); c.fill();
    c.fillStyle = '#f8dce8'; for(let i = 0; i < 10; i++){ c.fillRect(x + 4 + rng(i) * (w - 10), y + 10 + rng(i + 9) * (h - 18), 1.4, 1.4); }
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x + 5, y + 9, 3, h - 18);
    // crown
    c.fillStyle = HY.gold; c.beginPath(); c.moveTo(cx - 12, y + 7); c.lineTo(cx - 12, y - 3); c.lineTo(cx - 6, y + 2); c.lineTo(cx, y - 6); c.lineTo(cx + 6, y + 2); c.lineTo(cx + 12, y - 3); c.lineTo(cx + 12, y + 7); c.fill();
    c.fillStyle = '#e8413a'; circ(c, cx, y + 2, 1.6); c.fill(); c.fillStyle = '#3f7fe0'; circ(c, cx - 7, y + 4, 1.2); c.fill(); circ(c, cx + 7, y + 4, 1.2); c.fill();
    // face
    if(e.st === 'tired' || e.st === 'defeat'){
      c.strokeStyle = '#6a3a5a'; c.lineWidth = 0.8; for(const ex of [cx - 8, cx + 8]){ c.beginPath(); c.arc(ex, y + 19, 2.6, G.time * 6, G.time * 6 + 4.6); c.stroke(); }
      c.fillStyle = '#9fdcff'; for(let i = 0; i < 3; i++){ const t = (G.time * 1.2 + i / 3) % 1; ell(c, x + 6 + i * 14, y + h - 10 + t * 10, 1.2, 1.8); c.fill(); }
    } else {
      c.fillStyle = '#3a2030'; ell(c, cx - 8 + f, y + 19, 2.4, 3); c.fill(); ell(c, cx + 8 + f, y + 19, 2.4, 3); c.fill();
      c.fillStyle = '#fff'; circ(c, cx - 8.6 + f, y + 18, 0.9); c.fill(); circ(c, cx + 7.4 + f, y + 18, 0.9); c.fill();
      c.strokeStyle = '#3a2030'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(cx - 12, y + 13); c.lineTo(cx - 5, y + 15); c.moveTo(cx + 12, y + 13); c.lineTo(cx + 5, y + 15); c.stroke();
    }
    const mh = open ? 8 : 3;
    c.fillStyle = '#6a3a5a'; rr(c, cx - 7, y + 28, 14, mh, 2); c.fill();
    if(melt > 0.3){ c.strokeStyle = '#6a3a5a'; c.lineWidth = 1; c.beginPath(); c.arc(cx, y + 28, 4, 0.2, Math.PI - 0.2); c.stroke(); }
    // arms and sceptre
    const lift = stomp ? Math.abs(Math.sin(G.time * 16)) * 4 : 0;
    c.fillStyle = body; circ(c, x - 1, y + 24 - lift, 3.4); c.fill(); circ(c, x + w + 1, y + 24, 3.4); c.fill();
    c.strokeStyle = '#ffffff'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x + w + 1, y + 30); c.lineTo(x + w + 1, y + 10); c.arc(x + w + 4, y + 10, 3, Math.PI, 0); c.stroke();
    c.strokeStyle = '#e8413a'; c.lineWidth = 2.4; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x + w + 1, y + 30); c.lineTo(x + w + 1, y + 10); c.arc(x + w + 4, y + 10, 3, Math.PI, 0); c.stroke(); c.setLineDash([]);
    c.restore();
  }
  c.restore();
}

/* ---------- HUD and overlays ---------- */
function meterBar(c, x, y, p, wide){
  const n = wide ? 20 : 14, sw = wide ? 3.6 : 2.6, lit = Math.floor(p.meter / 100 * n);
  c.fillStyle = 'rgba(10,8,24,.55)'; rr(c, x - 2, y - 3.5, n * (sw + 0.7) + 3, 7, 2); c.fill();
  for(let i = 0; i < n; i++){
    const col = i >= lit ? 'rgba(255,255,255,.14)' : i < 7 ? HY.lime : i < 14 ? HY.gold : HY.orange;
    c.fillStyle = col; c.fillRect(x + i * (sw + 0.7), y - 2, sw, 4);
  }
  let ix = x + n * (sw + 0.7) + 4;
  const nm = STAGES[p.stage || 0].name;
  outlined(c, nm, ix, y + 0.4, wide ? 4.5 : 3.6, p.stage === 3 ? '#9fe8ff' : p.stage === 2 ? '#ffd45e' : '#fff6e0', 'left');
  c.font = (wide ? 4.5 : 3.6) + 'px ' + FONT; ix += c.measureText(nm).width + 4;
  if(p.glow > 0){ c.fillStyle = hue(G.time * 400); circ(c, ix + 3, y, 3); c.fill(); }
}
function drawHUD(c){
  const def = lvDef();
  const hh = G.players.length > 1 ? 34 : 28, g = c.createLinearGradient(0, 0, 0, hh); g.addColorStop(0, 'rgba(10,8,24,.55)'); g.addColorStop(1, 'rgba(10,8,24,0)');
  c.fillStyle = g; c.fillRect(0, 0, VW, hh);
  outlined(c, String(G.score).padStart(7, '0'), 8, 8, 7, '#fff6e0', 'left');
  outlined(c, def.code + '  ' + def.name.toUpperCase(), VW / 2, 8, 5, '#ffd45e');
  if(hasLives()){ heart(c, VW - 28, 7.5, 3.4, '#ff5a6e'); outlined(c, '×' + Math.max(0, G.lives), VW - 23, 8.4, 6, '#fff6e0', 'left'); }
  else outlined(c, 'KIDS', VW - 20, 8.4, 5, '#7dff8a');
  if(G.lvBadgeMax){ const bx = VW - 64; c.fillStyle = '#7dff8a'; heart(c, bx, 7.5, 3, '#7dff8a'); outlined(c, G.lvBadges + '/' + G.lvBadgeMax, bx + 5, 8.4, 5, '#dfffe0', 'left'); }
  if(G.players.length === 1){ const p = G.players[0]; miniMark(c, 13, 20, 3.6); meterBar(c, 21, 20, p, true); }
  else G.players.forEach((p, i) => {
    const colW = VW / Math.max(2, G.players.length), x = 6 + i * colW, y = 17;
    c.fillStyle = p.color; circ(c, x + 2, y, 2.4); c.fill();
    const nm = p.name.toUpperCase(), sz = fitText(c, nm, colW - 16, 4.2);
    text(c, nm, x + 7, y, sz, p.bubble ? '#a9a6c0' : '#fff6e0', 'left', 'middle');
    meterBar(c, x + 2, y + 7.5, p, false);
  });
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.st !== 'defeat'){
    const bw = 120, by = VH - 15;
    c.fillStyle = 'rgba(10,8,24,.6)'; rr(c, VW / 2 - bw / 2 - 4, by - 8, bw + 8, 17, 4); c.fill();
    outlined(c, boss.name, VW / 2, by - 3, 4.5, '#ffb3d9');
    const n = boss.max, sp = Math.min(10, 100 / n);
    for(let i = 0; i < n; i++){ const px = VW / 2 - (n - 1) * sp / 2 + i * sp; heart(c, px, by + 4.5, 2.4, i < boss.hp ? '#ff7eb6' : 'rgba(255,255,255,.2)'); }
  }
  if(!A.Input.isTouch && G.state === 'play' && G.lvT < 5 && G.net !== 'guest') text(c, 'PAUSE: START / ESC', 8, VH - 10, 4.5, 'rgba(255,255,255,.55)');
  if(G.state === 'play' && G.lvT < 7 && G.lv === 0 && G.net !== 'guest'){
    const tip = A.Input.isTouch ? 'Tap JUMP to jump   ▼ + JUMP: kindness snowball   Eat goodness to grow!' : 'FIRE: jump   DOWN + FIRE: kindness snowball   Eat goodness to grow!';
    outlined(c, tip, VW / 2, VH - 26, 4.5, '#fff6e0');
  }
  for(const p of G.players){
    if(p.done || p.bubble) continue;
    if(p.y + p.h < G.cam.y + 2){ const sx = p.x + p.w / 2 - G.cam.x; c.fillStyle = p.color; tri(c, sx, 34, sx - 3.5, 39, sx + 3.5, 39); }
  }
}
/* The journey trail: Kerala in the south all the way up to Kangchenjunga */
function drawTrail(c, y, cur){
  const n = REGIONS.length, x0 = 58, x1 = VW - 58;
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y - 14); c.stroke(); c.setLineDash([]);
  for(let i = 0; i < n; i++){
    const x = x0 + (x1 - x0) * i / (n - 1), yy = y - 14 * i / (n - 1);
    const done = i < cur, here = i === cur;
    c.fillStyle = here ? HY.gold : done ? HY.lime : 'rgba(255,255,255,.3)'; circ(c, x, yy, here ? 4 : 3); c.fill();
    if(i === n - 1){ c.fillStyle = '#fff'; tri(c, x - 4, yy - 3, x, yy - 10, x + 4, yy - 3); }
    outlined(c, REGIONS[i].short, x, yy + 9, 3.4, here ? '#ffd45e' : done ? '#dfffb0' : '#a9a6c0');
  }
}
function drawIntro(c){
  const def = lvDef(), t = G.stateT, len = G.introLen || 2.4;
  const a = Math.min(1, t * 5) * Math.min(1, Math.max(0, (len - t) / 0.35));
  c.globalAlpha = a;
  c.fillStyle = 'rgba(12,10,28,.84)'; c.fillRect(0, 0, VW, VH);
  const I = REGIONS[def.i], first = len > 4;
  outlined(c, 'STAGE ' + def.code, VW / 2, 34, 7, '#ffd45e');
  outlined(c, def.name.toUpperCase(), VW / 2, 52, fitText(c, def.name.toUpperCase(), VW - 40, 13), '#fff6e0');
  outlined(c, isBoss(G.lv) ? 'BOSS: ' + BOSS_NAMES[def.boss] : I.name.toUpperCase(), VW / 2, 68, 5.5, isBoss(G.lv) ? '#ffb3d9' : '#C5DF8A');
  if(first){
    c.font = '9px ' + SANS; c.fillStyle = '#fff0d8'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const words = I.fact.split(' '), lines = []; let line = '';
    for(const wd of words){ const tst = line ? line + ' ' + wd : wd; if(c.measureText(tst).width > VW - 80){ lines.push(line); line = wd; } else line = tst; }
    lines.push(line);
    lines.forEach((l, i) => c.fillText(l, VW / 2, 84 + i * 11));
  }
  drawTrail(c, 132, def.i);
  const n = G.players.length;
  G.players.forEach((p, i) => {
    const cx = VW / 2 - (n - 1) * 26 + i * 52;
    c.save(); c.translate(cx, 178);
    yetiSprite(c, { color: p.color, face: 1, stage: p.stage, air: false, moving: false, ph: 0, squash: 1, slot: p.slot, done: 2 });
    c.restore();
    const nm = p.name.toUpperCase(); outlined(c, nm, cx, 186, fitText(c, nm, 48, 5), p.color);
  });
  G.pals.forEach((q, k) => drawPal(c, Object.assign({}, q, { x: VW / 2 + (n - 1) * 26 + 34 + k * 20, y: 178 - q.h, face: -1, vx: 0 })));
  if(hasLives()){ heart(c, VW / 2 - 12, 202, 4, '#ff5a6e'); outlined(c, '× ' + G.lives, VW / 2 + 4, 202.5, 7, '#fff6e0'); }
  else outlined(c, 'KIDS MODE · NO GAME OVER', VW / 2, 202, 5, '#7dff8a');
  c.globalAlpha = 1;
}
function drawClear(c){
  const boss = isBoss(G.lv), msg = boss ? 'KINDNESS WINS!' : 'STAGE CLEAR!';
  const t = G.stateT, n = msg.length, size = 13;
  c.font = size + 'px ' + FONT; const wAll = c.measureText(msg).width;
  let x = VW / 2 - wAll / 2;
  for(let i = 0; i < n; i++){
    const ch = msg[i], cw = c.measureText(ch).width;
    const appear = Math.max(0, Math.min(1, (t * 12 - i) / 2));
    if(appear > 0) outlined(c, ch, x + cw / 2, 70 - Math.sin(Math.min(1, appear) * Math.PI) * 8 + Math.sin(G.time * 5 + i * 0.6) * 1.5, size, hue(i * 25 + G.time * 90, 90, 68));
    x += cw;
  }
  if(t > 0.8){ outlined(c, 'SCORE ' + G.score.toLocaleString(), VW / 2, 92, 6, '#fff6e0'); outlined(c, 'TIME ' + fmt(G.lvT), VW / 2, 104, 5, '#C5DF8A'); }
}
const ENDING_LINES = ['YOU REACHED THE TOP OF KANGCHENJUNGA!', 'KINDNESS MADE YOU MIGHTY', 'THE BIGGEST HEARTS STAY HUMBLE', 'SHARE. HELP. SAY THANK YOU.', 'GIVE SOMEONE A BIG YETI HUG TODAY!'];
function drawEnding(c){
  const t = G.stateT, rise = Math.min(1, t / 3);
  c.fillStyle = 'rgba(255,200,120,' + (0.22 * rise) + ')'; c.fillRect(0, 0, VW, VH);
  const sy = 120 - rise * 40;
  c.fillStyle = 'rgba(255,230,160,.35)'; circ(c, VW / 2, sy, 40); c.fill();
  c.fillStyle = '#ffe9a0'; circ(c, VW / 2, sy, 22); c.fill();
  // the summit flag
  const fx0 = VW / 2 + 60;
  c.strokeStyle = '#5a3a20'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(fx0, 12 * T); c.lineTo(fx0, 12 * T - 60 * rise); c.stroke();
  if(rise > 0.9){ const wv = Math.sin(G.time * 5) * 2; c.fillStyle = HY.green; c.beginPath(); c.moveTo(fx0, 12 * T - 60); c.lineTo(fx0 + 30, 12 * T - 56 + wv); c.lineTo(fx0 + 30, 12 * T - 38 + wv); c.lineTo(fx0, 12 * T - 42); c.fill(); miniMark(c, fx0 + 15, 12 * T - 49 + wv * 0.5, 6); }
  drawLogo(c, 70, 64, 0.62 * Math.min(1, t / 1.5));
  const li = Math.floor((t - 1) / 2.2);
  if(t > 1 && li < ENDING_LINES.length){
    const lt = (t - 1) % 2.2, a = Math.min(1, lt * 3, (2.2 - lt) * 3);
    c.globalAlpha = Math.max(0, a); outlined(c, ENDING_LINES[li], VW / 2 + 40, 30, fitText(c, ENDING_LINES[li], VW - 150, 7), li === 0 ? hue(G.time * 80, 90, 72) : '#fff6e0'); c.globalAlpha = 1;
  }
  if(t > 2) outlined(c, 'Made with love by Humble Yeti · art, levels & music made in code', VW / 2 + 40, 44, 3.8, '#fff0d8');
}
function drawNames(c){
  if(G.players.length < 2 || G.demo) return;
  for(const p of G.players){
    const top = p.bubble ? p.y + p.h / 2 - 18 : p.y - 12;
    const nm = p.name.toUpperCase();
    outlined(c, nm, p.x + p.w / 2, top, fitText(c, nm, 40, 4), p.color);
  }
}
/* Ellora's caves are dark: every yeti carries a warm glow, and lanterns and tents light the way */
let darkCv = null;
function drawDark(c, camX, camY, s){
  const a = D().dark;
  if(!darkCv) darkCv = document.createElement('canvas');
  if(darkCv.width !== canvas.width || darkCv.height !== canvas.height){ darkCv.width = canvas.width; darkCv.height = canvas.height; }
  const d = darkCv.getContext('2d');
  d.setTransform(1, 0, 0, 1, 0, 0); d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, darkCv.width, darkCv.height);
  d.fillStyle = 'rgba(6,4,14,' + a + ')'; d.fillRect(0, 0, darkCv.width, darkCv.height);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    const sx = (x - camX) * s, sy = (y - camY) * s, R = r * s;
    if(sx < -R || sx > darkCv.width + R) return;
    const g = d.createRadialGradient(sx, sy, R * 0.25, sx, sy, R); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g; d.beginPath(); d.arc(sx, sy, R, 0, Math.PI * 2); d.fill();
  };
  for(const p of G.players) hole(p.x + p.w / 2, p.y + p.h / 2, p.bubble ? 40 : 72 + Math.sin(G.time * 3 + p.slot) * 3);
  for(const e of G.ents){
    if(e.k === 'lantern') hole(e.x + 4, e.y + 5, 46 + Math.sin(G.time * 5 + e.id) * 2);
    else if(e.k === 'tent') hole(e.x + 18, e.y + 16, e.st === 'got' ? 80 : 44);
    else if(e.k === 'gate') hole(e.x + 22, e.y + 30, 70);
    else if(e.k === 'snow' || ITEMS.has(e.k)) hole(e.x + 4, e.y + 4, 18);
  }
  for(const q of G.pals) hole(q.x + q.w / 2, q.y + q.h / 2, 26);
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(darkCv, 0, 0);
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
  for(const e of G.ents) if(e.k === 'gate' || e.k === 'tent' || e.k === 'cave' || e.k === 'lantern') drawProp(c, e);
  const boss = G.ents.find(e => e.k === 'boss');
  if(boss && boss.bw === 2) drawBoss(c, boss);
  c.setTransform(1, 0, 0, 1, 0, 0);
  drawTiles(c, camX, camY, s);
  world();
  drawLive(c, camX);
  for(const e of G.ents){
    if(e.k === 'gate' || e.k === 'tent' || e.k === 'cave' || e.k === 'spawner' || e.k === 'lantern') continue;
    if(FOES.has(e.k)) drawFoe(c, e);
    else if(HAZARDS.has(e.k)) drawHazard(c, e);
    else if(ITEMS.has(e.k) || e.k === 'crate') drawItem(c, e);
    else if(e.k === 'boss'){ if(e.bw !== 2) drawBoss(c, e); }
    else drawProp(c, e);
  }
  for(const q of G.pals) drawPal(c, q);
  const order = G.players.slice().sort((a, b) => (a.bubble ? 1 : 0) - (b.bubble ? 1 : 0));
  for(const p of order){ if(p.bubble) drawBubble(c, p); else drawHero(c, p); }
  drawPits(c, camX);
  for(const p of parts){
    const a = 1 - p.t / p.life;
    if(p.kind === 'text'){ c.globalAlpha = Math.min(1, a * 2); outlined(c, p.str, p.x, p.y, 5, p.col); }
    else if(p.kind === 'big'){ c.globalAlpha = Math.min(1, a * 2); const sc = 1 + Math.max(0, 0.25 - p.t) * 2; outlined(c, p.str, p.x, p.y, 7 * sc, p.col); }
    else if(p.kind === 'chunk'){ c.globalAlpha = a; c.fillStyle = p.col; c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.8); c.restore(); }
    else if(p.kind === 'star'){ c.globalAlpha = a; c.fillStyle = p.col; star5(c, p.x, p.y, p.r * 1.4, p.r * 0.55); c.fill(); }
    else if(p.kind === 'heart'){ c.globalAlpha = a; heart(c, p.x, p.y, p.r, p.col); }
    else if(p.kind === 'critter'){
      // a cheered-up yuck, now a happy little critter flying off
      c.globalAlpha = Math.min(1, a * 2); const fl = Math.sin(p.t * 30);
      c.fillStyle = '#ffffff'; ell(c, p.x - 4, p.y - 1 - fl, 3, 1.6, -0.4); c.fill(); ell(c, p.x + 4, p.y - 1 - fl, 3, 1.6, 0.4); c.fill();
      c.fillStyle = p.col; circ(c, p.x, p.y, 3.6); c.fill();
      c.fillStyle = '#1d1630'; c.fillRect(p.x - 1.6, p.y - 1, 0.9, 0.9); c.fillRect(p.x + 0.8, p.y - 1, 0.9, 0.9);
      c.strokeStyle = '#1d1630'; c.lineWidth = 0.5; c.beginPath(); c.arc(p.x, p.y + 0.4, 1.2, 0.2, Math.PI - 0.2); c.stroke();
    }
    else if(p.kind === 'bird'){ c.globalAlpha = Math.min(1, a * 2); const fl = Math.sin(p.t * 26); c.fillStyle = p.col; ell(c, p.x, p.y, 3, 2.2); c.fill(); tri(c, p.x - 1, p.y, p.x - 5, p.y - 3 - fl * 2, p.x + 1, p.y - 1); c.fillStyle = '#ff9a3a'; tri(c, p.x + 2.6, p.y - 0.6, p.x + 4.4, p.y, p.x + 2.6, p.y + 0.6); }
    else { c.globalAlpha = a; c.fillStyle = p.col; circ(c, p.x, p.y, p.r * (0.5 + a * 0.5)); c.fill(); }
  }
  c.globalAlpha = 1;
  drawNames(c);
  if(lvDef().dark && !G.demo) drawDark(c, camX, camY, s);
  else if(lvDef().dark){ c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgba(6,4,14,.3)'; c.fillRect(0, 0, canvas.width, canvas.height); }
  c.setTransform(s, 0, 0, s, 0, 0);
  drawFG(c, camX);
  if(G.gust > 0 && !G.demo){ c.fillStyle = 'rgba(240,200,130,.18)'; c.fillRect(0, 0, VW, VH); }
  if(G.warp){ const t = G.warp.t, a = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.45); c.fillStyle = 'rgba(8,6,12,' + a + ')'; c.fillRect(0, 0, VW, VH); }
  if(G.state === 'ending') drawEnding(c);
  else if(!G.demo) drawHUD(c);
  if(G.state === 'intro') drawIntro(c);
  if(G.state === 'clear') drawClear(c);
  if(G.demo){
    c.fillStyle = 'rgba(11,12,16,0.32)'; c.fillRect(0, 0, VW, VH);
    if(G.state === 'title') drawLogo(c, VW - 78, 70, 0.9 + Math.sin(G.time * 2) * 0.02);
  }
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
  Promise.race([Promise.all([document.fonts.load('10px "Silkscreen"'), document.fonts.load('600 10px "Chakra Petch"')]), new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
} else boot();
window.__yeti = G;
window.__yetiDebug = { botControls, mkEnt, hurt, toBubble, step, Net, LEVELS, REGIONS, buildLevel, loadLevel, tileAt, setTile, startIntro, newGame, results, startClear, ending, sim, active, CH, crackBoulder, reachGoal, throwSnow, grow, setStage, addPal, SONGS, drawLogo, drawYeti, yetiSprite, drawPal, STAGES };
})();
