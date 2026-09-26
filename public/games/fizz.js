/* FIZZ LAB — a falling-capsule puzzle for 1–4 young scientists on one screen, or online.
   Grumpy Gloomies (cute blobs in 3 colours) have taken over the candy lab. Drop two-colour fizz capsules
   into the beaker and line up 4 or more of one colour (capsule halves or Gloomies) in a row or column
   to pop them. Clear every Gloomy to clean the lab. LEFT/RIGHT move, DOWN soft drop, double-tap DOWN
   hard drop, FIRE rotates, UP rotates the other way (hold UP to use the hold slot).
   Modes: Solo (levels 1–20), Versus (combos fling loose halves at the leader, best of 3), Big Beaker
   co-op (one wide shared beaker), the Daily Lab Puzzle and 30 Puzzle beakers.
   All characters, art and music are original and made in code. */
(function(){
'use strict';
const A = window.Arcade, Net = A.Net;
const GAME = 'fizz';

/* ---------- Constants ---------- */
const VW = 384, VH = 216;
const FONT = '"Silkscreen","Courier New",monospace';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r2 = v => Math.round(v * 100) / 100;
const BW = 8, BH = 16;
const POP_T = 0.34, FALL_T = 0.06, SPAWN_T = 0.12, DAS = 0.16, ARR = 0.05, SOFT = 0.034, TAP2 = 0.28, HOLD_PRESS = 0.36;

const COLS = [
  { name: 'Berry', main: '#ff5c9d', dark: '#a8225e', light: '#ffc6df', deep: '#6d1240' },
  { name: 'Lemon', main: '#ffd23f', dark: '#b87d06', light: '#fff5bd', deep: '#6e4800' },
  { name: 'Sky',   main: '#3fc1ff', dark: '#1669ad', light: '#c9efff', deep: '#0b3a66' }
];
const RAINBOW = 3, BOMB = 4;
const RAINBOW_COLS = ['#ff5c9d', '#ff9a3c', '#ffd23f', '#5fe08a', '#3fc1ff', '#a77bff'];
const SPEEDS = { low: { label: 'Low', grav: 0.7, lock: 0.42, mult: 1 }, med: { label: 'Med', grav: 0.42, lock: 0.34, mult: 2 }, hi: { label: 'Hi', grav: 0.24, lock: 0.26, mult: 3 } };
const SPEED_ORDER = ['low', 'med', 'hi'];
const MODES = {
  solo:   { label: 'Solo',       min: 1, max: 1 },
  versus: { label: 'Versus',     min: 1, max: 4 },
  coop:   { label: 'Big Beaker', min: 1, max: 4 },
  daily:  { label: 'Daily Lab',  min: 1, max: 4 },
  puzzle: { label: 'Puzzles',    min: 1, max: 1 }
};
const MODE_ORDER = ['solo', 'versus', 'coop', 'daily', 'puzzle'];
const SONG_ORDER = ['fizz', 'chill', 'fever', 'off'];
const SONG_LABEL = { fizz: 'Fizz', chill: 'Chill', fever: 'Fever', off: 'Off' };
const BANDS = [5, 10, 15, 20];
/* solo medals per 5 levels: capsules used ÷ (Gloomies + 6) over the levels of the band played (fewer is better); Kids ×1.5.
   The test bot scores about 1.9 (silver/bronze), so gold needs tidy play. */
const BAND_MEDAL = { gold: 1.3, silver: 1.9 };

/* ---------- Music: three original chiptunes, picked in the menu (plus the xRetro menu theme) ---------- */
const SONGS = {
  fizz: {
    bpm: 140, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'], bass: 'drive', arp: 'slow', leadVol: 0.068, leadWave: 'pulse25',
    lead: [
      'E5 - G5 - C6 - G5 - E5 - . D5 E5 - C5 -', 'A4 - C5 - E5 - . E5 D5 - C5 - A4 - - -',
      'F5 - A5 - F5 - C5 - A4 - C5 - F5 - E5 -', 'D5 - - - G4 - B4 - D5 - G5 - F5 - D5 -',
      'E5 - G5 - C6 - . C6 B5 - G5 - E5 - G5 -', 'A5 - - - E5 - C5 - A4 - B4 - C5 - E5 -',
      'F5 - E5 - D5 - A4 - D5 - F5 - A5 - F5 -', 'G5 - - - F5 - D5 - B4 - - - G4 - - -'],
    drums: ['k.h.s.h.k.h.s.hh', 'k.h.s.h.k.k.s.h.', 'k.h.s.h.k.h.s.hh', 'k.h.s.hkk.hks.ss']
  },
  chill: {
    bpm: 92, chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gm7', 'C7'], bass: 'walk', arp: 'slow', arpOct: 1, leadVol: 0.07, leadWave: 'triangle',
    lead: [
      'A5 - - - G5 - E5 - - - C5 - D5 - E5 -', 'D5 - - - - - B4 - G4 - - - . . . .',
      'F5 - - - E5 - D5 - C5 - - - A4 - C5 -', 'E5 - - - - - - - . . G5 - E5 - C5 -',
      'D5 - - - F5 - A5 - - - G5 - F5 - D5 -', 'E5 - - - C5 - - - A4 - - - . . C5 -',
      'D5 - - - Bb4 - D5 - F5 - - - E5 - D5 -', 'C5 - - - - - - - E5 - G5 - Bb5 - - -'],
    drums: ['k.......s.....h.', 'k..k....s...h...', 'k.......s.....h.', 'k..k....s..hs.h.']
  },
  fever: {
    bpm: 168, chords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'F', 'E'], bass: 'drive', arp: 'fast', leadVol: 0.064, leadWave: 'pulse25',
    lead: [
      'A5 . A5 . E5 - A5 - C6 - B5 - A5 - E5 -', 'G5 - A5 - E5 - C5 - D5 - E5 - - - . .',
      'F5 . F5 . A5 - C6 - A5 - F5 - C5 - F5 -', 'G5 - - - D5 - G5 - B5 - A5 - G5 - D5 -',
      'A5 . A5 . C6 - E6 - D6 - C6 - B5 - A5 -', 'E5 - - - A5 - - - C6 - B5 - A5 - G5 -',
      'F5 - A5 - C6 - F6 - E6 - C6 - A5 - F5 -', 'E5 - G#5 - B5 - E6 - D6 - B5 - G#5 - E5 -'],
    drums: ['k.h.s.hkk.h.s.h.', 'k.h.s.hkk.hks.ss', 'k.h.s.hkk.h.s.h.', 'kkh.s.hkk.hksrss']
  }
};

/* ---------- Sounds ---------- */
const SX = {
  move:    s => s.tone({ wave: 'triangle', f: 1250, t: 0.02, v: 0.04 }),
  rot:     s => s.tone({ wave: 'pulse25', f: 700, f2: 980, t: 0.05, v: 0.05 }),
  land:    s => { s.tone({ wave: 'triangle', f: 260, f2: 150, t: 0.06, v: 0.12 }); s.noise({ t: 0.04, v: 0.05, f: 2000, f2: 600 }); },
  drop:    s => { s.noise({ t: 0.1, v: 0.07, f: 900, f2: 3200, type: 'bandpass' }); s.tone({ wave: 'sine', f: 190, f2: 70, t: 0.12, v: 0.22, at: 0.04 }); },
  pop:     s => { s.tone({ wave: 'sine', f: 480, f2: 1450, t: 0.07, v: 0.13 }); s.noise({ t: 0.22, v: 0.07, f: 6500, type: 'highpass', attack: 0.01 }); },
  glpop:   s => { s.tone({ wave: 'square', f: 880, f2: 1320, t: 0.05, v: 0.045 }); s.tone({ wave: 'triangle', f: 1760, t: 0.09, v: 0.07, at: 0.05 }); },
  fizz:    s => s.noise({ t: 0.55, v: 0.06, f: 3000, f2: 9000, type: 'highpass', attack: 0.02 }),
  send:    s => s.melody([[784, .04], [1047, .04], [1568, .08]], { wave: 'pulse25', v: 0.07 }),
  garbage: s => { for(let i = 0; i < 4; i++) s.tone({ wave: 'triangle', f: 1250 - i * 190, t: 0.05, v: 0.07, at: i * 0.05 }); },
  bomb:    s => { s.noise({ t: 0.6, v: 0.3, f: 2500, f2: 90 }); s.tone({ wave: 'sine', f: 140, f2: 40, t: 0.4, v: 0.3 }); s.noise({ t: 0.9, v: 0.06, f: 7000, type: 'highpass', at: 0.2, attack: 0.05 }); },
  rainbow: s => s.melody([[1047, .04], [1319, .04], [1568, .04], [2093, .09]], { wave: 'sine', v: 0.08 }),
  hold:    s => s.noise({ t: 0.14, v: 0.07, f: 900, f2: 2500, type: 'bandpass', q: 2 }),
  throw:   s => s.tone({ wave: 'sine', f: 420, f2: 900, t: 0.08, v: 0.04 }),
  appear:  s => s.tone({ wave: 'triangle', f: 700 + Math.random() * 700, t: 0.03, v: 0.025 }),
  ready:   s => s.melody([[523, .09], [659, .09], [784, .09], [1047, .2]], { wave: 'pulse25', v: 0.08 }),
  clear:   s => { s.melody([[784, .08], [988, .08], [1175, .08], [1568, .16], [0, .04], [1319, .08], [1568, .3]], { wave: 'pulse25', v: 0.08 });
                  s.melody([[196, .24], [247, .24], [294, .4]], { wave: 'triangle', v: 0.14 }); },
  roundWin: s => { s.melody([[659, .1], [784, .1], [1047, .1], [1319, .3]], { wave: 'pulse25', v: 0.09 }); s.tone({ wave: 'triangle', f: 262, t: 0.6, v: 0.12 }); },
  results: s => { s.melody([[1047, .12], [988, .06], [1047, .06], [1175, .12], [1319, .24], [0, .06], [1175, .12], [1319, .12], [1568, .48]], { wave: 'pulse25', v: 0.08 });
                  s.melody([[262, .36], [349, .36], [392, .36], [523, .54]], { wave: 'triangle', v: 0.13 });
                  for(let i = 0; i < 5; i++) s.tone({ wave: 'sine', f: 2093 + i * 260, t: 0.07, v: 0.025, at: 1.25 + i * 0.05 }); },
  topout:  s => s.melody([[523, .12], [494, .12], [466, .12], [440, .34]], { wave: 'triangle', v: 0.12 }),
  fizzaway: s => { s.noise({ t: 0.8, v: 0.12, f: 1500, f2: 9000, type: 'bandpass', q: 0.8, attack: 0.05 }); s.melody([[1568, .06], [1319, .06], [1047, .12]], { wave: 'sine', v: 0.07, at: 0.3 }); },
  warn:    s => s.tone({ wave: 'sine', f: 1480, t: 0.06, v: 0.04 })
};
for(let n = 1; n <= 7; n++){
  // chain chimes climb higher with every link in the chain
  const k = Math.pow(2, (n - 1) * 2 / 12);
  SX['chime' + n] = s => { s.melody([[1047 * k, .05], [1319 * k, .05], [1568 * k, .05], [2093 * k, .12]], { wave: 'triangle', v: 0.09 });
    s.tone({ wave: 'sine', f: 2093 * k, t: 0.5, v: 0.05, at: 0.15 }); s.noise({ t: 0.35, v: 0.05, f: 7000, type: 'highpass' }); };
}
let netSfx = [], netFx = [];
function sfx(name){
  if(G.demo) return;
  playNetSfx(name);
  if(Net && Net.role === 'host' && netSfx.length < 24) netSfx.push(name);
}
function playNetSfx(n){ const f = SX[n]; if(f){ try{ f(A.Sound); }catch(e){} } else A.Sound.play(n); }

/* ---------- Random numbers (seeded, so Versus and the Daily Lab are the same for everyone) ---------- */
function mulberry(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s){ let h = 2166136261; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function today(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

/* ---------- Cells ----------
   0 empty · 1..3 a Gloomy (colour 0..2) · 16 + colour*5 + link: a capsule half (colour 0..2, 3 = rainbow),
   link = where its partner is: 0 none, 1 left, 2 right, 3 up, 4 down. */
const L_NONE = 0, L_L = 1, L_R = 2, L_U = 3, L_D = 4;
const LDX = [0, -1, 1, 0, 0], LDY = [0, 0, 0, -1, 1];
const glV = c => 1 + c;
const halfV = (c, l) => 16 + c * 5 + l;
const isGl = v => v >= 1 && v <= 3;
const isHalf = v => v >= 16;
const colOf = v => isGl(v) ? v - 1 : isHalf(v) ? ((v - 16) / 5) | 0 : -1;
const linkOf = v => isHalf(v) ? (v - 16) % 5 : 0;
const sameCol = (a, b) => a === b || a === RAINBOW || b === RAINBOW;

function makeBoard(W, H){
  return { W, H, g: new Array(W * H).fill(0), own: new Array(W * H).fill(0), gl: 0, glStart: 0, cnt: [0, 0, 0],
    phase: 'idle', t: 0, dirty: false, popCells: [], seq: null, players: [], out: false, done: false, time: 0, bubbles: [], danger: 0 };
}
function recount(b){
  b.cnt = [0, 0, 0]; let n = 0;
  for(const v of b.g) if(isGl(v)){ n++; b.cnt[v - 1]++; }
  b.gl = n; return n;
}

/* Gloomies: never 3 of a colour in a row, and never the same colour two cells apart (like the classic) */
function glCount(lvl, kids, W){
  const n = kids ? Math.min(40, 2 + lvl * 2) : Math.min(84, (lvl + 1) * 4);
  return Math.round(n * W / BW);
}
function glTop(lvl, kids, H){ return kids ? H - 8 : lvl >= 16 ? 4 : lvl >= 13 ? 5 : 6; }
function genGloomies(b, lvl, rng, kids){
  const W = b.W, H = b.H, top = glTop(lvl, kids, H);
  let n = Math.min(glCount(lvl, kids, W), Math.floor(W * (H - top) * 0.72));
  const ok = (x, y, c) => {
    const at = (xx, yy) => xx >= 0 && xx < W && yy >= 0 && yy < H ? b.g[yy * W + xx] : 0;
    if(at(x - 2, y) === glV(c) || at(x + 2, y) === glV(c) || at(x, y - 2) === glV(c) || at(x, y + 2) === glV(c)) return false;
    let adj = 0; for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if(at(x + dx, y + dy) === glV(c)) adj++;
    return adj < 2;
  };
  let placed = 0, tries = 0;
  const off = (rng() * 3) | 0;
  while(placed < n && tries < 6000){
    tries++;
    const x = (rng() * W) | 0, y = top + ((rng() * (H - top)) | 0), i = y * W + x;
    if(b.g[i]) continue;
    let c = (placed + off) % 3, done = false;
    for(let k = 0; k < 3 && !done; k++){ const cc = (c + k) % 3; if(ok(x, y, cc)){ b.g[i] = glV(cc); done = true; } }
    if(done) placed++;
  }
  recount(b); b.glStart = b.gl;
}

/* Matches: runs of 4+ in a row or column. Rainbow halves match any colour. */
function findMatches(b){
  const W = b.W, H = b.H, g = b.g, mark = new Uint8Array(W * H), runs = [];
  const line = idx => {
    let lastEnd = -1;
    for(let i = 0; i < idx.length; i++){
      if(!g[idx[i]]) continue;
      let j = i, col = -1;
      while(j < idx.length){
        const v = g[idx[j]]; if(!v) break;
        const c = colOf(v);
        if(c !== RAINBOW){ if(col < 0) col = c; else if(c !== col) break; }
        j++;
      }
      if(j - i >= 4){
        for(let k = i; k < j; k++) mark[idx[k]] = 1;
        if(j > lastEnd){ runs.push({ col: col < 0 ? RAINBOW : col, len: j - i }); lastEnd = j; }
      }
    }
  };
  for(let y = 0; y < H; y++){ const r = []; for(let x = 0; x < W; x++) r.push(y * W + x); line(r); }
  for(let x = 0; x < W; x++){ const r = []; for(let y = 0; y < H; y++) r.push(y * W + x); line(r); }
  const cells = []; for(let i = 0; i < mark.length; i++) if(mark[i]) cells.push(i);
  return { cells, runs };
}
function removeCells(b, cells){
  const W = b.W, set = new Set(cells);
  for(const i of cells){
    const v = b.g[i];
    if(isHalf(v)){
      const l = linkOf(v);
      if(l){ const j = i + LDX[l] + LDY[l] * W; if(!set.has(j) && isHalf(b.g[j])) b.g[j] = halfV(colOf(b.g[j]), 0); }
    }
    b.g[i] = 0; if(b.own) b.own[i] = 0;
  }
  if(b.cnt) recount(b);
}
/* One row of gravity: loose halves and pairs fall, Gloomies stay put. blocked = cells under falling capsules. */
function gravityStep(b, blocked){
  const W = b.W, H = b.H, g = b.g, own = b.own;
  const free = i => !g[i] && !(blocked && blocked.has(i));
  let moved = false;
  const mv = (from, to) => { g[to] = g[from]; g[from] = 0; if(own){ own[to] = own[from]; own[from] = 0; } };
  for(let y = H - 2; y >= 0; y--) for(let x = 0; x < W; x++){
    const i = y * W + x, v = g[i];
    if(!isHalf(v)) continue;
    const l = linkOf(v);
    if(l === L_L || l === L_D) continue;          // moved together with its partner
    if(l === L_R){ const j = i + 1; if(free(i + W) && free(j + W)){ mv(i, i + W); mv(j, j + W); moved = true; } }
    else if(l === L_U){ const j = i - W; if(free(i + W)){ mv(i, i + W); mv(j, i); moved = true; } }
    else if(free(i + W)){ mv(i, i + W); moved = true; }
  }
  return moved;
}
function simBoard(b){ return { W: b.W, H: b.H, g: b.g.slice(), own: null }; }

/* ---------- Capsules ----------
   o: 0 = A left/B right, 1 = A bottom/B top, 2 = B left/A right, 3 = B bottom/A top. */
function pieceCells(pc){
  if(pc.single) return [[pc.x, pc.y, pc.a, L_NONE]];
  switch(pc.o){
    case 0: return [[pc.x, pc.y, pc.a, L_R], [pc.x + 1, pc.y, pc.b, L_L]];
    case 1: return [[pc.x, pc.y, pc.a, L_U], [pc.x, pc.y - 1, pc.b, L_D]];
    case 2: return [[pc.x, pc.y, pc.b, L_R], [pc.x + 1, pc.y, pc.a, L_L]];
    default: return [[pc.x, pc.y, pc.b, L_U], [pc.x, pc.y - 1, pc.a, L_D]];
  }
}
/* 0 = fits, 1 = blocked by the beaker (walls, floor, settled cells), 2 = blocked by a friend's falling capsule */
function blockedBy(b, pc, self){
  const cells = pieceCells(pc);
  for(const [x, y] of cells){
    if(x < 0 || x >= b.W || y < 0 || y >= b.H) return 1;
    if(b.g[y * b.W + x]) return 1;
  }
  if(b.players && b.players.length > 1){
    for(const q of b.players){
      if(q === self || !q.piece) continue;
      for(const [x, y] of pieceCells(q.piece)) for(const [x2, y2] of cells) if(x === x2 && y === y2) return 2;
    }
  }
  return 0;
}
function shifted(b, pc, dx, dy, self){ const t = Object.assign({}, pc, { x: pc.x + dx, y: pc.y + dy }); return blockedBy(b, t, self) ? null : t; }
function rotated(b, pc, dir, self){
  if(pc.single) return null;
  const o = (pc.o + dir + 4) % 4;
  const kicks = o % 2 === 0 ? [[0, 0], [-1, 0]] : [[0, 0], [0, 1], [1, 0]];
  for(const [kx, ky] of kicks){
    const t = Object.assign({}, pc, { o, x: pc.x + kx, y: pc.y + ky });
    if(!blockedBy(b, t, self)) return t;
  }
  return null;
}
function dropY(b, pc, self){ let t = pc; for(;;){ const n = shifted(b, t, 0, 1, self); if(!n) return t; t = n; } }
function ghostOf(b, pc){ let t = pc; for(;;){ const n = Object.assign({}, t, { y: t.y + 1 }); if(blockedBy({ W: b.W, H: b.H, g: b.g, players: null }, n)) return t; t = n; } }
function parseCap(tok){
  if(tok === 'X') return { a: BOMB, b: BOMB, single: true };
  const m = { P: 0, Y: 1, B: 2, R: RAINBOW };
  return { a: m[tok[0]], b: m[tok[1]] };
}

/* ---------- Puzzles: 30 hand-picked beakers. rows = the bottom rows (p y b = Gloomies, P Y B = loose halves),
   caps = the capsule order (PY = berry+lemon, RR = rainbow, X = fizz bomb), par = fewest capsules (checked by solver). */
const PUZZLES = [
  { name: "First Fizz", par: 1, caps: 'PP PY YB BP PB YY',
    rows: ['...p....', '...p....'] },
  { name: "Side by Side", par: 1, caps: 'YY BP PB YB BY PP',
    rows: ['..yy....'] },
  { name: "Two for One", par: 1, caps: 'PY BB YP BY PB PP',
    rows: ['...py...', '...py...', '...py...'] },
  { name: "Lemon Drop", par: 1, caps: 'YB PB BP PP BB YP',
    rows: ['yy.y....'] },
  { name: "Rainbow Bridge", par: 1, caps: 'RR PY BP YB BY PP',
    rows: ['ppp.bbb.'] },
  { name: "Bomb Voyage", par: 1, caps: 'X PB BY YP PP BB',
    rows: ['..b.p...', '..pyb...'] },
  { name: "Chain Starter", par: 1, caps: 'BP PY YB BB PP YY',
    rows: ['...Y....', 'yyyBbb..'] },
  { name: "Double Up", par: 2, caps: 'BP BY PP YY BB PY',
    rows: ['..bb....'] },
  { name: "Sky Tower", par: 2, caps: 'YP YY YY YY YP YY YY',
    rows: ['.......Y', '.......y', 'y......y', 'y.......', '........', 'Y.......'] },
  { name: "Pink Pair", par: 2, caps: 'PP PP PP PP PP BB PP',
    rows: ['..P.....', '..p.....', '........', '.ppP....'] },
  { name: "Sour Stack", par: 2, caps: 'BB BY YY BY YB BY YY',
    rows: ['y.......', 'Y.......', 'y.......', '..B.bb.B'] },
  { name: "Blue Mood", par: 2, caps: 'YY BY PP YB YB BY BB',
    rows: ['.......b', '.......b', '.......b', '.Y......', '.y......', '........'] },
  { name: "Pink Party", par: 2, caps: 'BP PP PP PP PP PP PP',
    rows: ['.....p..', '.....p..', '....ppp.', 'B.Y.....'] },
  { name: "Rainbow Rescue", par: 2, caps: 'RR PY PP PP PY PY PP',
    rows: ['.......p', '.P.....P', '.p.....p', '........'] },
  { name: "Tower Trouble", par: 2, caps: 'BP YY YY YY YY YY YP',
    rows: ['.......y', '.......y', '.......y', '.B...PY.'] },
  { name: "The Gap", par: 2, caps: 'PB YY PP PY YY BY PY',
    rows: ['......P.', '......p.', '..y...p.', '..y.....', '....bBB.'] },
  { name: "Zig Zag", par: 3, caps: 'YP YB PP PP PP PP PY YP',
    rows: ['.......P', '...p...p', '...p....', '...p....', '........', '.......P'] },
  { name: "Berry Jam", par: 3, caps: 'PP PP PB PP PP YB PY PP',
    rows: ['.....p..', '........', '....ppP.', '..BY..PP'] },
  { name: "Tangle", par: 3, caps: 'BB BB PB BB BP BY PY BB',
    rows: ['......B.', '......B.', '..P..bb.', '..P.....', '..p..B..'] },
  { name: "Boom Room", par: 3, caps: 'YY X BY PP BP BY PP PB',
    rows: ['..p.....', '........', '........', '..P.....', '..PPY...', '..BbYbB.'] },
  { name: "Mint Muddle", par: 3, caps: 'BB BB BB BP BB YP BY PB',
    rows: ['....bb..', '..P.....', '..b.bb..', '..bbb..B'] },
  { name: "Triple Treat", par: 3, caps: 'PB RR RR PB BP PB BB PB',
    rows: ['.B......', '.b......', '.b......', '....bB..', '.....P..', '.YP..p..'] },
  { name: "Up and Over", par: 3, caps: 'PY BP PP PP PB BP PP PY',
    rows: ['..p.....', '..p.ppBp', '..p...b.', '......b.'] },
  { name: "Lab Mess", par: 3, caps: 'PP PP PY YB BY BY YY YY',
    rows: ['..p..p..', '........', '....P...', '...PB...', '.Y.yYy..'] },
  { name: "Mixed Up", par: 3, caps: 'BB PY PP PB BP BP BP BB',
    rows: ['..ppp.b.', '......b.', '......b.', 'P.......', 'P.......'] },
  { name: "Cascade", par: 3, caps: 'PY YB PB PP BB YP YY PY',
    rows: ['.......P', '.......p', '........', '..y.....', '..y.....', '.By....P'] },
  { name: "Knot Again", par: 4, caps: 'YP YB BP PY BY YY YB YY BB',
    rows: ['yy.y...b', '......YB', '......yb', '........'] },
  { name: "Brain Bubbles", par: 4, caps: 'BY YB PB YY YB PP PB YP BY',
    rows: ['.yyy....', '........', '..P..b..', '..p..B..', '..pYPb..'] },
  { name: "Mad Science", par: 4, caps: 'PY X BB PB PB BB BY BB PP',
    rows: ['...P....', '...p....', '....B.B.', '....B.B.', '..P.b.b.', 'P.pp....'] },
  { name: "Grand Finale", par: 4, caps: 'YB BB BB PY YP BY BY BP YB',
    rows: ['.bb.b...', 'Y..B....', 'yy.y....', 'b..B....', '..By.yy.'] }
];

/* ---------- Game state ---------- */
const OPTS = Object.assign({ mode: 'solo', level: 1, speed: 'med', song: 'fizz', kids: false, power: true, pz: 0 }, A.Store.get('fizz.opts', {}));
const G = {
  state: 'title', demo: true, mode: MODES[OPTS.mode] ? OPTS.mode : 'solo', level: clamp(OPTS.level | 0, 1, 20), speed: SPEEDS[OPTS.speed] ? OPTS.speed : 'med',
  song: SONG_LABEL[OPTS.song] ? OPTS.song : 'fizz', kids: !!OPTS.kids, power: OPTS.power !== false, pz: clamp(OPTS.pz | 0, 0, 29),
  boards: [], players: [], roster: [], time: 0, stateT: 0, loadN: 0, net: null, round: 1, winner: null, seed: 1,
  playT: 0, pending: [], bestsShown: {}, bandLog: {}, lastResult: null, daily: '', botFast: false, cpuName: 'Fizzbot', score: 0, startLevel: 1
};
function saveOpts(){ A.Store.set('fizz.opts', { mode: G.mode, level: G.level, speed: G.speed, song: G.song, kids: G.kids, power: G.power, pz: G.pz }); }
const diffKey = () => G.kids ? 'kids' : 'normal';
const SP = () => SPEEDS[G.speed];
const boardOf = p => G.boards[p.board];
const holdOn = () => G.power;

/* ---------- Players ---------- */
function newStats(){ return { gl: 0, used: 0, maxChain: 0, lines: 0, hard: 0, rainbow: 0, bombs: 0, sent: 0, left: 0, halves: 0, fizzed: 0, holds: 0 }; }
function stat(p, k, n){ if(!p) return; p.st[k] = (p.st[k] || 0) + (n === undefined ? 1 : n); p.run[k] = (p.run[k] || 0) + (n === undefined ? 1 : n); }
function statMax(p, k, v){ if(!p) return; p.st[k] = Math.max(p.st[k] || 0, v); p.run[k] = Math.max(p.run[k] || 0, v); }
function makePlayer(o){
  return Object.assign({ slot: 0, name: 'Player', color: A.PLAYER_COLORS[0], source: null, bot: false, cpu: false, board: 0,
    piece: null, next: [], hold: null, holdUsed: false, state: 'wait', waitT: 0, gravT: 0, lockT: 0, resets: 0,
    dasDir: 0, dasT: 0, arrT: 0, lastDown: -9, upT: 0, upDone: true, softOk: true, pieceN: 0, used: 0, score: 0,
    stars: 0, pending: [], rng: Math.random, seqN: 0, spawnX: 3, throwT: 0, st: newStats(), run: newStats(), plan: null, botT: 0, finishT: null }, o);
}
function genPiece(p){
  if(MD() === 'puzzle'){ const pz = PUZZLES[G.pz]; const caps = pz.caps.trim().split(/\s+/); return parseCap(caps[p.seqN++ % caps.length]); }
  const r = p.rng, power = G.power || MD() === 'daily';
  if(power){
    const bm = G.kids ? 0.04 : 0.028, rb = G.kids ? 0.1 : 0.045, x = r();
    if(x < bm) return { a: BOMB, b: BOMB, single: true };
    if(x < bm + rb) return { a: RAINBOW, b: RAINBOW };
  }
  return { a: (r() * 3) | 0, b: (r() * 3) | 0 };
}
function gravInterval(p){
  const base = SP().grav * (G.kids ? 1.7 : 1);
  const fast = Math.pow(G.kids ? 0.975 : 0.94, Math.floor(p.pieceN / 10));
  return Math.max(G.kids ? 0.18 : 0.07, base * fast * (1 - (G.level - 1) * 0.012));
}
const lockDelay = () => G.kids ? 0.55 : SP().lock;

function spawn(p){
  const b = boardOf(p), t = p.next[0];
  const pc = { x: p.spawnX, y: 0, o: 0, a: t.a, b: t.b, single: !!t.single };
  const why = blockedBy(b, pc, p);
  if(why === 2) return;                          // a friend's capsule is in the way: wait a moment
  if(why === 1){ topOut(p); return; }
  p.next.shift(); p.next.push(genPiece(p));
  place(p, pc);
}
function place(p, pc){
  p.piece = pc; p.state = 'fall'; p.gravT = 0; p.lockT = 0; p.resets = 0; p.holdUsed = p.holdUsed && p.justHeld; p.justHeld = false;
  p.throwT = 0.35; p.plan = null; p.botT = 0;
  const s = p.source && A.Input.get(p.source);
  p.softOk = !(s && s.down);
  if(!G.demo && boardOf(p).players[0] === p) sfx('throw');
}
function topOut(p){
  const b = boardOf(p);
  if(G.kids){ fizzTop(b); stat(p, 'fizzed'); return; }
  p.state = 'out'; p.piece = null;
  b.out = b.players.every(q => q.state === 'out') || MD() === 'coop';
  sfx('topout'); callout(b, 'OVERFLOW!', '#ff8a8a');
}
/* Kids mode: no game over. When the beaker fills up, the top 4 rows fizz away and you keep going. */
function fizzTop(b){
  const cells = []; for(let i = 0; i < b.W * 4; i++) if(b.g[i]) cells.push(i);
  if(!b.seq) b.seq = newSeq(null);
  b.phase = 'pop'; b.t = 0; b.popCells = cells;
  callout(b, 'FIZZ AWAY!', '#7dffcf'); sfx('fizzaway');
  for(const i of cells) cellFx(b, i % b.W, (i / b.W) | 0, colOf(b.g[i]), 'bub');
}
function newSeq(by){ return { by, lines: 0, gl: 0, cols: [], chain: 0, halves: 0 }; }

function move(p, dx){
  const b = boardOf(p), t = shifted(b, p.piece, dx, 0, p); if(!t) return false;
  p.piece = t; groundReset(p); return true;
}
function rotate(p, dir){
  const b = boardOf(p), t = rotated(b, p.piece, dir, p); if(!t) return false;
  p.piece = t; groundReset(p); return true;
}
function groundReset(p){ if(p.lockT > 0 && p.resets < 12){ p.lockT = 0; p.resets++; } }
function hardDrop(p){
  const b = boardOf(p), start = p.piece.y;
  p.piece = dropY(b, p.piece, p);
  stat(p, 'hard');
  const dist = p.piece.y - start;
  if(dist > 0) for(const [x, y, col] of pieceCells(p.piece)) for(let k = 0; k < 3; k++) cellFx(b, x, y - 1 - k * 1.4, col, 'trail');
  if(blockedBy(b, Object.assign({}, p.piece, { y: p.piece.y + 1 }), p) === 1){ sfx('drop'); lockPiece(p); }
}
function doHold(p){
  if(!holdOn() || p.holdUsed || !p.piece) return;
  const cur = { a: p.piece.a, b: p.piece.b, single: p.piece.single };
  let nt;
  if(p.hold) nt = p.hold; else { nt = p.next.shift(); p.next.push(genPiece(p)); }
  p.hold = cur; p.holdUsed = true; p.justHeld = true;
  const pc = { x: p.spawnX, y: 0, o: 0, a: nt.a, b: nt.b, single: !!nt.single };
  stat(p, 'holds'); sfx('hold');
  if(blockedBy(boardOf(p), pc, p) === 1){ p.piece = null; topOut(p); return; }
  if(blockedBy(boardOf(p), pc, p) === 2){ p.hold = nt; p.holdUsed = false; p.justHeld = false; return; }
  place(p, pc);
}
function lockPiece(p){
  const b = boardOf(p), pc = p.piece;
  p.piece = null; p.state = 'wait'; p.waitT = 0; p.used++; p.pieceN++; stat(p, 'used');
  if(!b.seq) b.seq = newSeq(p); else if(!b.seq.by) b.seq.by = p;
  if(pc.a === BOMB){ bombAt(b, pc.x, pc.y, p); return; }
  if(pc.a === RAINBOW){ stat(p, 'rainbow'); sfx('rainbow'); }
  for(const [x, y, col, l] of pieceCells(pc)){ const i = y * b.W + x; b.g[i] = halfV(col, l); b.own[i] = p.slot + 1; }
  b.dirty = true; sfx('land');
  for(const [x, y, col] of pieceCells(pc)) cellFx(b, x, y + 0.4, col, 'dust');
}
/* Fizz bomb: pops everything in a 3×3 around where it lands */
function bombAt(b, x, y, p){
  const cells = [];
  for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){
    const xx = x + dx, yy = y + dy; if(xx < 0 || yy < 0 || xx >= b.W || yy >= b.H) continue;
    if(b.g[yy * b.W + xx]) cells.push(yy * b.W + xx);
  }
  stat(p, 'bombs'); sfx('bomb'); G.shake = 0.35;
  cellFx(b, x, y, BOMB, 'boom'); callout(b, 'FIZZ BOMB!', '#c9a8ff');
  if(cells.length) startPop(b, cells, [], true);
  else b.dirty = true;
}
function startPop(b, cells, runs, bomb){
  if(!b.seq) b.seq = newSeq(null);
  const s = b.seq; s.chain++; s.lines += runs.length;
  for(const r of runs) s.cols.push(r.col === RAINBOW ? (Math.random() * 3) | 0 : r.col);
  let gl = 0;
  const mult = SP().mult;
  for(const i of cells){
    const v = b.g[i];
    if(isGl(v)){ gl++; s.gl++; const pts = 100 * Math.pow(2, Math.min(5, s.gl - 1)) * mult; if(s.by){ s.by.score += pts; } G.score += pts;
      if(s.by) stat(s.by, 'gl'); }
    else s.halves++;
    cellFx(b, i % b.W, (i / b.W) | 0, colOf(v), isGl(v) ? 'glpop' : 'pop');
  }
  b.phase = 'pop'; b.t = 0; b.popCells = cells;
  if(!bomb){
    sfx(s.chain >= 2 ? 'chime' + Math.min(7, s.chain) : 'pop');
    if(s.chain >= 2) callout(b, 'FIZZ x' + s.chain + '!', null, s.chain);
    else if(runs.length >= 2) callout(b, 'DOUBLE FIZZ!', '#ffe27a');
  }
  if(gl) sfx('glpop');
  if(s.chain >= 2) sfx('fizz');
}
function finishSeq(b){
  const s = b.seq; b.seq = null;
  const by = s.by; if(!by) return;
  statMax(by, 'maxChain', s.chain); stat(by, 'lines', s.lines);
  if(s.chain > (G.bestChain || 0)){ G.bestChain = s.chain; G.bestChainBy = by.name; }
  if(MD() === 'versus' && s.lines >= 2) sendGarbage(by, s.cols.slice(0, Math.min(4, s.lines)));
}
/* Versus: combos fling loose capsule halves at the leader (whoever has the fewest Gloomies left) */
function sendGarbage(from, cols){
  const foes = G.players.filter(q => q !== from && q.state !== 'out' && !boardOf(q).done);
  if(!foes.length) return;
  let best = Infinity; for(const q of foes) best = Math.min(best, boardOf(q).gl);
  const leaders = foes.filter(q => boardOf(q).gl === best);
  const to = leaders[(Math.random() * leaders.length) | 0];
  to.pending.push(...cols); if(to.pending.length > 8) to.pending.length = 8;
  stat(from, 'sent', cols.length);
  sfx('send');
  fxAdd({ kind: 'orb', from: from.board, to: to.board, t: 0, life: 0.6, cols: cols.slice() });
  callout(boardOf(to), 'INCOMING!', '#ffb3d1');
}
function deliverGarbage(p){
  const b = boardOf(p), cols = p.pending.splice(0, 4);
  const xs = []; for(let x = 0; x < b.W; x++) xs.push(x);
  for(let i = xs.length - 1; i > 0; i--){ const j = (p.rng() * (i + 1)) | 0; [xs[i], xs[j]] = [xs[j], xs[i]]; }
  const blocked = activeSet(b);
  let k = 0;
  for(const c of cols){
    while(k < xs.length && (b.g[xs[k]] || blocked.has(xs[k]))) k++;
    if(k >= xs.length) break;
    b.g[xs[k]] = halfV(c, 0); b.own[xs[k]] = 0; k++;
  }
  b.phase = 'fall'; b.t = 0; sfx('garbage');
}
function activeSet(b){
  const s = new Set();
  for(const q of b.players) if(q.piece) for(const [x, y] of pieceCells(q.piece)) s.add(y * b.W + x);
  return s;
}

/* ---------- Stepping a beaker and its scientists ---------- */
function stepBoard(b, dt){
  if(b.out || b.done) return;
  if(b.phase === 'pop'){
    b.t += dt;
    if(b.t >= POP_T){ removeCells(b, b.popCells); b.popCells = []; b.phase = 'fall'; b.t = FALL_T; }
  } else if(b.phase === 'fall'){
    b.t += dt;
    while(b.t >= FALL_T){
      b.t -= FALL_T;
      if(!gravityStep(b, activeSet(b))){ b.phase = 'idle'; b.t = 0; b.dirty = true; break; }
    }
  }
  if(b.phase === 'idle' && b.dirty){
    b.dirty = false;
    const m = findMatches(b);
    if(m.cells.length) startPop(b, m.cells, m.runs);
    else if(b.seq) finishSeq(b);
  }
  // danger: how close the stack is to the top in the spawn columns
  let top = b.H; for(let y = 0; y < b.H && top === b.H; y++) for(let x = 0; x < b.W; x++) if(b.g[y * b.W + x]){ top = y; break; }
  b.danger = top <= 3 ? 1 : 0;
}
const NOC = { left: false, right: false, down: false, up: false, fire: false, leftP: false, rightP: false, downP: false, upP: false, fireP: false };
function readControls(p){
  const s = p.source && A.Input.get(p.source);
  if(!s || !s.connected) return NOC;
  const P = b => A.Input.pressed(s, b);
  return { left: s.left, right: s.right, down: s.down, up: s.up, fire: s.fire, leftP: P('left'), rightP: P('right'), downP: P('down'), upP: P('up'), fireP: P('fire') };
}
function stepPlayer(p, dt){
  const b = boardOf(p);
  if(p.throwT > 0) p.throwT -= dt;
  if(p.state === 'out' || p.state === 'won' || p.state === 'done' || b.done || b.out) return;
  if(p.state === 'wait'){
    p.waitT += dt;
    if(b.phase !== 'idle' || b.dirty || b.seq) return;
    if(b.gl === 0) return;
    if(p.pending.length){ deliverGarbage(p); return; }
    if(MD() === 'puzzle' && p.used >= puzzleLimit()) return;
    if(p.waitT >= SPAWN_T) spawn(p);
    return;
  }
  if(!p.piece) return;
  let soft = false;
  if(p.bot){ soft = botStep(p, dt); if(!p.piece) return; }
  else {
    const c = readControls(p);
    if(c.leftP || c.rightP){ const d = c.leftP ? -1 : 1; if(move(p, d)) sfx('move'); p.dasDir = d; p.dasT = 0; p.arrT = 0; }
    else if(p.dasDir && (p.dasDir < 0 ? c.left : c.right)){
      p.dasT += dt;
      if(p.dasT >= DAS){ p.arrT += dt; while(p.arrT >= ARR){ p.arrT -= ARR; if(move(p, p.dasDir)) sfx('move'); else break; } }
    } else p.dasDir = 0;
    if(c.fireP && rotate(p, 1)) sfx('rot');
    if(c.upP){ if(rotate(p, -1)) sfx('rot'); p.upT = 0; p.upDone = false; }
    if(c.up && !p.upDone){ p.upT += dt; if(p.upT >= HOLD_PRESS){ p.upDone = true; if(holdOn()){ doHold(p); if(!p.piece) return; } } }
    if(!c.up) p.upDone = true;
    if(c.downP){
      if(G.time - p.lastDown < TAP2){ p.lastDown = -9; hardDrop(p); return; }
      p.lastDown = G.time; p.softOk = true;
    }
    if(!c.down) p.softOk = true;
    soft = c.down && p.softOk;
  }
  const below = blockedBy(b, Object.assign({}, p.piece, { y: p.piece.y + 1 }), p);
  if(below === 1){
    p.lockT += dt; p.gravT = 0;
    if(p.lockT >= (soft ? 0.05 : lockDelay())) lockPiece(p);
    return;
  }
  p.lockT = 0;
  if(below === 2){ p.gravT = 0; return; }
  p.gravT += dt;
  const iv = soft ? Math.min(SOFT, gravInterval(p)) : gravInterval(p);
  if(p.gravT >= iv){ p.gravT = Math.min(p.gravT - iv, iv); p.piece = Object.assign({}, p.piece, { y: p.piece.y + 1 }); }
}

/* ---------- The bot: tries every spot, simulates the pops and chains, picks the best ----------
   Used for the title-screen demo, for Fizzbot (the Versus CPU) and for testing (G.botFast). */
function resolveSim(sim){
  let chain = 0, gl = 0;
  for(;;){
    const m = findMatches(sim); if(!m.cells.length) break;
    chain++; for(const i of m.cells) if(isGl(sim.g[i])) gl++;
    removeCells(sim, m.cells); while(gravityStep(sim, null)){}
    if(chain > 8) break;
  }
  return { chain, gl };
}
function applyPlacement(W, H, g0, t){
  const sim = { W, H, g: g0.slice(), own: null };
  let gl = 0, chain = 0;
  if(t.a === BOMB){
    const cells = [];
    for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const xx = t.x + dx, yy = t.y + dy; if(xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const i = yy * W + xx; if(sim.g[i]){ cells.push(i); if(isGl(sim.g[i])) gl++; } }
    removeCells(sim, cells); while(gravityStep(sim, null)){}
    if(!cells.length) gl = -0.3;              // a wasted bomb
  } else for(const [x, y, col, l] of pieceCells(t)) sim.g[y * W + x] = halfV(col, l);
  const r = resolveSim(sim);
  return { sim, gl: gl + r.gl, chain: r.chain };
}
/* how good a beaker looks: Gloomies left, what is stacked on them, holes, height near the spawn */
const BOTW = { hole: 34, run: 38, blk: 42, r3: 60, r2: 18, gl: 700, h: 2, need: 1, gn: 60, seg: 36 };
function evalBoard(sim){
  const W = sim.W, H = sim.H, g = sim.g, K = BOTW;
  let sc = 0, gl = 0;
  const tops = new Array(W).fill(H);
  for(let x = 0; x < W; x++) for(let y = 0; y < H; y++) if(g[y * W + x]){ tops[x] = y; break; }
  for(let x = 0; x < W; x++){
    for(let y = tops[x] + 1; y < H; y++) if(!g[y * W + x]) sc -= K.hole;
    sc -= (H - tops[x]) * K.h;
  }
  for(let y = 0; y < H; y++) for(let x = 0; x < W; x++){
    const v = g[y * W + x]; if(!isGl(v)) continue;
    gl++;
    const col = v - 1; let k = y - 1, run = 0;
    while(k >= 0){ const u = g[k * W + x]; if(!u || !sameCol(colOf(u), col)) break; run++; k--; }
    if(K.need){
      // how many more halves this column needs: the Gloomy's own run, then every blocker segment above it
      let need = Math.max(0, 3 - run) * K.gn;
      while(k >= 0){
        const u = g[k * W + x]; if(!u) break;
        const c0 = colOf(u); let len = 0, cc = c0;
        while(k >= 0){ const w2 = g[k * W + x]; if(!w2) break; const c2 = colOf(w2); if(cc === RAINBOW) cc = c2; if(!sameCol(cc, c2)) break; len++; k--; }
        need += Math.max(0, 4 - len) * K.seg;
      }
      sc -= need;
    } else {
      let blk = 0; while(k >= 0){ if(g[k * W + x]) blk++; k--; }
      sc += Math.min(run, 3) * K.run - blk * K.blk;
    }
  }
  // partial runs of 2 or 3 that could still grow
  const runScan = (idx) => {
    let i = 0;
    while(i < idx.length){
      const v = g[idx[i]]; if(!v){ i++; continue; }
      let j = i, col = -1;
      while(j < idx.length){ const u = g[idx[j]]; if(!u) break; const c = colOf(u); if(c !== RAINBOW){ if(col < 0) col = c; else if(c !== col) break; } j++; }
      const len = j - i, open = (i > 0 && !g[idx[i - 1]]) || (j < idx.length && !g[idx[j]]);
      if(open && len === 3) sc += K.r3; else if(open && len === 2) sc += K.r2;
      i = Math.max(i + 1, j);
    }
  };
  for(let y = 0; y < H; y++){ const r = []; for(let x = 0; x < W; x++) r.push(y * W + x); runScan(r); }
  for(let x = 0; x < W; x++){ const r = []; for(let y = 0; y < H; y++) r.push(y * W + x); runScan(r); }
  const mid = Math.floor(W / 2);
  for(let x = 0; x < W; x++){
    const near = x >= mid - 2 && x <= mid + 1;
    if(near && tops[x] <= 4) sc -= (5 - tops[x]) * 120;
    for(let y = 0; y < 3; y++) if(g[y * W + x]) sc -= (near ? 900 : 220) * (3 - y);
  }
  return sc - gl * K.gl;
}
const plyScore = r => r.gl * 1300 + (r.chain > 1 ? r.chain * 220 : 0) + evalBoard(r.sim);
/* every spot a capsule can reach from where it is now: rotate first, then slide, then drop */
function reachable(bb, pc, self){
  const out = [], rots = pc.single ? [0] : pc.a === pc.b ? [0, 1] : [0, 1, 2, 3];
  for(const k of rots){
    let t = pc, ok = true;
    for(let r = 0; r < k && ok; r++){ const n = rotated(bb, t, 1, self); if(n) t = n; else ok = false; }
    if(!ok) continue;
    for(let x = 0; x < bb.W; x++){
      let u = t, fine = true;
      while(u.x !== x && fine){ const n = shifted(bb, u, x > u.x ? 1 : -1, 0, self); if(n) u = n; else fine = false; }
      if(fine) out.push({ k, x, t: dropY(bb, u, self) });
    }
  }
  return out;
}
function botPlan(p){
  const b = boardOf(p), pc = p.piece, W = b.W, H = b.H;
  const opts = reachable(b, pc, p).map(o => { const r = applyPlacement(W, H, b.g, o.t); return Object.assign(o, { r, sc: plyScore(r) }); });
  if(!opts.length){ p.plan = { k: 0, x: pc.x }; return; }
  opts.sort((a, c) => c.sc - a.sc);
  // look one capsule ahead for the best few
  const nt = p.next[0];
  if(nt && !(p.cpu && G.kids)){
    for(const o of opts.slice(0, p.cpu ? 4 : 7)){
      const sim = o.r.sim, bb = { W, H, g: sim.g, players: null };
      const start = { x: p.spawnX, y: 0, o: 0, a: nt.a, b: nt.b, single: !!nt.single };
      if(blockedBy(bb, start)){ o.sc2 = o.sc - 5000; continue; }
      let best = -Infinity;
      for(const q of reachable(bb, start, null)){ const r2 = applyPlacement(W, H, sim.g, q.t); best = Math.max(best, plyScore(r2)); }
      o.sc2 = o.r.gl * 1300 + (o.r.chain > 1 ? o.r.chain * 220 : 0) + best;
    }
    const top = opts.filter(o => o.sc2 !== undefined).sort((a, c) => c.sc2 - a.sc2);
    if(top.length) opts.unshift(top[0]);
  }
  let pick = opts[0];
  if(p.cpu){
    const slip = G.kids ? 0.3 : G.speed === 'low' ? 0.2 : G.speed === 'med' ? 0.1 : 0.05;
    if(Math.random() < slip) pick = opts[Math.min(opts.length - 1, 1 + ((Math.random() * 3) | 0))];
  }
  p.plan = { k: pick.k, x: pick.x };
}
function botStep(p, dt){
  if(!p.plan) botPlan(p);
  const fast = G.botFast && !p.cpu;
  const delay = fast ? 0 : p.cpu ? (G.kids ? 0.32 : G.speed === 'low' ? 0.24 : G.speed === 'med' ? 0.15 : 0.1) : 0.09;
  p.botT += dt;
  let guard = 0;
  while(p.piece && (fast || p.botT >= delay) && guard++ < 30){
    p.botT -= delay;
    const pl = p.plan;
    if(pl.k > 0){ if(rotate(p, 1)) pl.k--; else pl.k = 0; continue; }
    if(p.piece.x !== pl.x){ const d = pl.x > p.piece.x ? 1 : -1; if(!move(p, d)) pl.x = p.piece.x; continue; }
    if(p.cpu && G.speed === 'low' && !G.kids) return true;   // slow Fizzbot soft-drops instead of slamming
    hardDrop(p); return false;
  }
  return false;
}

/* ---------- Setting up beakers ---------- */
function zones(b){
  const n = b.players.length, zw = b.W / n;
  b.players.forEach((p, i) => { p.spawnX = n === 1 ? Math.floor(b.W / 2) - 1 : clamp(Math.floor(zw * i + zw / 2) - 1, 0, b.W - 2); });
}
function resetPlayer(p, seed){
  p.piece = null; p.hold = null; p.holdUsed = false; p.justHeld = false; p.state = 'wait'; p.waitT = 0; p.pending = []; p.used = 0; p.pieceN = 0; p.seqN = 0;
  p.plan = null; p.finishT = null; p.lastDown = -9; p.dasDir = 0; p.upDone = true; p.throwT = 0;
  p.rng = seed !== undefined ? mulberry(seed) : Math.random;
  p.next = [genPiece(p), genPiece(p)];
  p.st = newStats();
}
function buildBoards(){
  G.boards = [];
  if(MD() === 'coop'){
    const n = G.players.length, b = makeBoard(Math.min(20, BW + 4 * (n - 1)), BH);
    G.boards.push(b); G.players.forEach(p => { p.board = 0; b.players.push(p); }); zones(b);
  } else G.players.forEach((p, i) => { const b = makeBoard(BW, BH); b.players.push(p); p.board = i; p.spawnX = 3; G.boards.push(b); });
}
function loadPuzzle(b, pz){
  const rows = pz.rows, top = b.H - rows.length;
  const map = { p: glV(0), y: glV(1), b: glV(2), P: halfV(0, 0), Y: halfV(1, 0), B: halfV(2, 0) };
  rows.forEach((r, ry) => { for(let x = 0; x < b.W; x++){ const v = map[r[x]]; if(v) b.g[(top + ry) * b.W + x] = v; } });
  recount(b); b.glStart = b.gl;
}
const DAILY_LEVEL = 6;
function startLevel(){
  G.loadN++; G.state = 'intro'; G.stateT = 0; G.playT = 0; G.winner = null; parts = [];
  buildBoards();
  let seed;
  const md = MD();
  if(md === 'daily') seed = hashStr('fizzlab-daily-' + G.daily);
  else seed = (Math.random() * 4294967296) >>> 0;
  G.seed = seed;
  G.boards.forEach((b, i) => {
    if(md === 'puzzle') loadPuzzle(b, PUZZLES[G.pz]);
    else if(md === 'daily') genGloomies(b, DAILY_LEVEL, mulberry(seed), false);
    else genGloomies(b, G.level, mulberry(md === 'versus' ? seed : seed + i * 7919), G.kids);
  });
  const shared = md === 'versus' || md === 'daily';
  G.players.forEach((p, i) => resetPlayer(p, shared ? (seed ^ 0x5bd1e995) >>> 0 : undefined));
  if(!G.demo) sfx('ready');
}
function newGame(roster){
  G.demo = false; G.botFast = false;
  G.roster = roster.map(p => ({ slot: p.slot, source: p.source, name: p.name, color: p.color }));
  G.players = G.roster.map(r => makePlayer(r));
  if(G.mode === 'versus' && G.players.length === 1){
    const slot = G.players[0].slot === 1 ? 0 : 1;
    G.players.push(makePlayer({ slot, name: G.cpuName, color: '#b58cff', bot: true, cpu: true }));
  }
  G.pending = []; G.score = 0; G.round = 1; G.bestChain = 0; G.bestChainBy = ''; G.bestsShown = {}; G.bandLog = {}; G.startLevel = G.level;
  for(const p of G.players){ p.stars = 0; p.score = 0; p.run = newStats(); }
  if(G.mode === 'daily'){
    G.daily = today();
    const done = dailyRuns().map(r => r.n.toLowerCase());
    for(const p of G.players) p.practice = done.includes(p.name.toLowerCase());
    const pr = G.players.filter(p => p.practice).map(p => p.name);
    if(pr.length) setTimeout(() => A.toast(pr.join(', ') + (pr.length > 1 ? ' already did' : ' already did') + ' today’s puzzle: practice run', 3600), 300);
  }
  startLevel();
}
function startDemo(){
  G.demo = true; G.botFast = false;
  const prev = G.state;
  G.players = [makePlayer({ slot: 0, name: 'Pip', color: A.PLAYER_COLORS[0], bot: true, cpu: true }), makePlayer({ slot: 1, name: 'Dot', color: A.PLAYER_COLORS[1], bot: true, cpu: true })];
  const lv = G.level; G.level = 6; startLevel(); G.level = lv;
  G.state = ['title', 'lobby', 'online'].includes(prev) ? prev : 'play'; G.demoT = 0;
}
function dropIn(){
  if(G.demo || (G.mode !== 'versus' && G.mode !== 'coop')) return;
  if(G.state !== 'play' && G.state !== 'intro' && G.state !== 'roundEnd') return;
  const humans = G.players.filter(p => !p.cpu).length + G.pending.length;
  for(const s of A.Input.all()){
    if(!A.Input.pressed(s, 'fire')) continue;
    if(G.players.some(p => p.source === s.id) || G.pending.some(r => r.source === s.id)) continue;
    if(humans >= 4) return;
    const used = G.players.filter(p => !p.cpu).map(p => p.slot).concat(G.pending.map(r => r.slot));
    const slot = [0, 1, 2, 3].find(i => !used.includes(i));
    const name = s.kind === 'net' && s.name ? s.name : A.Names.forSource(s.id, G.players.map(p => p.name));
    const r = { slot, source: s.id, name, color: A.PLAYER_COLORS[slot] };
    G.roster.push(r);
    if(G.mode === 'coop'){
      const b = G.boards[0], p = makePlayer(r);
      resetPlayer(p); p.board = 0; p.run = newStats(); b.players.push(p); G.players.push(p); zones(b);
      callout(b, name.toUpperCase() + ' JOINED!', r.color);
    } else { G.pending.push(r); A.toast(name + ' joins next round!'); }
    sfx('join');
    return;
  }
}
function vsWinner(){ return G.players.find(p => p.stars >= 2) || null; }
function nextRound(){
  G.round++;
  if(G.pending.length){
    G.players = G.players.filter(p => !p.cpu);
    for(const r of G.pending){ const p = makePlayer(r); p.stars = 0; p.run = newStats(); G.players.push(p); }
    G.pending = []; G.players.sort((a, b) => a.slot - b.slot);
  }
  startLevel();
}

/* ---------- Flow ---------- */
function flowChecks(dt){
  G.playT += dt;
  for(const b of G.boards) if(!b.done && !b.out) b.time += dt;
  for(const b of G.boards){
    if(b.done || b.out) continue;
    if(b.gl === 0 && b.phase === 'idle' && !b.dirty && !b.seq){
      b.done = true;
      for(const p of b.players){ p.piece = null; p.state = 'won'; p.finishT = b.time; }
      boardCleared(b);
      if(G.state !== 'play') return;
    }
  }
  const m = G.mode;
  if(m === 'solo' || m === 'coop'){
    if(G.boards[0].out){ gameOver(); return; }
  } else if(m === 'versus'){
    const alive = G.players.filter(p => p.state !== 'out');
    if(G.players.length > 1 && alive.length <= 1){ roundEnd(alive[0] || null); return; }
  } else if(m === 'daily'){
    if(G.boards.every(b => b.done || b.out)){ dailyResults(); return; }
  } else if(m === 'puzzle'){
    const b = G.boards[0], p = G.players[0];
    if(b.out || (p.state === 'wait' && p.used >= puzzleLimit() && b.phase === 'idle' && !b.dirty && !b.seq && b.gl > 0)){ puzzleResults(false); return; }
  }
}
function boardCleared(b){
  const m = G.mode;
  sfx('clear');
  for(let i = 0; i < 26; i++) cellFx(b, Math.random() * b.W, b.H * 0.3 + Math.random() * b.H * 0.5, (Math.random() * 3) | 0, 'conf');
  if(m === 'solo' || m === 'coop'){ G.state = 'clear'; G.stateT = 0; }
  else if(m === 'versus') roundEnd(b.players[0]);
  else if(m === 'daily') callout(b, 'DONE ' + fmt(b.time), '#7dffcf');
  else if(m === 'puzzle'){ G.state = 'clear'; G.stateT = 0; }
}
function roundEnd(w){
  G.state = 'roundEnd'; G.stateT = 0; G.winner = w ? w.slot : -1;
  for(const p of G.players) p.piece = null;
  if(w){ w.stars++; w.state = 'won'; sfx('roundWin'); callout(boardOf(w), w.stars >= 2 ? 'CHAMPION!' : 'WIN!', '#ffe27a', 3); }
}
function afterRoundEnd(){ if(vsWinner()) matchResults(); else nextRound(); }
const puzzleLimit = () => PUZZLES[G.pz] ? PUZZLES[G.pz].par + (G.kids ? 8 : 5) : 99;

function fmt(t){ const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
function tidyStats(){
  for(const p of G.players){
    const b = boardOf(p); let n = 0;
    if(b) for(let i = 0; i < b.g.length; i++) if(isHalf(b.g[i]) && (G.mode !== 'coop' || b.own[i] === p.slot + 1)) n++;
    p.st.left = n; p.run.left = n;
  }
}
const AWARD_DEFS = [
  { title: 'Chain Champion', stat: p => p.S.maxChain, min: 2 },
  { title: 'Best Helper', stat: p => G.mode === 'coop' && G.players.length > 1 ? p.S.gl : 0, min: 1 },
  { title: 'Gloomy Buster', stat: p => G.mode !== 'coop' ? p.S.gl : 0, min: 4 },
  { title: 'Fizz Flinger', stat: p => p.S.sent, min: 2 },
  { title: 'Tidy Scientist', stat: p => p.S.used >= 4 ? p.S.left : 99, low: true, min: 30 },
  { title: 'Speedy Dropper', stat: p => p.S.hard, min: 5 },
  { title: 'Rainbow Ranger', stat: p => p.S.rainbow, min: 1 },
  { title: 'Bomb Squad', stat: p => p.S.bombs, min: 1 },
  { title: 'Combo Chemist', stat: p => p.S.lines, min: 3 },
  { title: 'Steady Hands', stat: p => p.S.used, min: 8 }
];
function awardsHtml(which, time){
  const list = G.players.filter(p => !p.cpu).map(p => Object.assign({}, p, { S: which === 'run' ? p.run : p.st }));
  if(!list.length) return '';
  const res = A.Awards.pick(list, AWARD_DEFS, { max: 3 });
  const sum = k => list.reduce((n, p) => n + (p.S[k] || 0), 0);
  const chain = Math.max(0, ...list.map(p => p.S.maxChain || 0));
  const team = (list.length > 1 ? 'Team · ' : '') + sum('gl') + ' Gloomies fizzed · ' + sum('used') + ' capsules' + (chain >= 2 ? ' · best chain x' + chain : '') + (time ? ' · ' + fmt(time) : '');
  return A.Awards.html(res, team);
}
function colorsNow(){ return G.players.map(p => p.color).concat(COLS.map(c => c.main)).concat(['#ffffff']); }
/* NEW BEST banners: several bests at once go on one banner */
function celebrate(bests, medal, where){
  if(bests.length) A.Celebrate.show({ title: 'NEW BEST!', sub: bests.join(' · ') + (medal ? ' · ' + A.Medals.label(medal) + ' medal!' : ''), colors: colorsNow() });
  else if(medal) A.Celebrate.show({ title: A.Medals.label(medal).toUpperCase() + ' MEDAL!', sub: where || '', colors: colorsNow() });
  else sfx('results');
}
function chainBest(bests){
  if((G.bestChain || 0) >= 2){
    const rec = A.Celebrate.record(GAME, 'chain', G.bestChain);
    if(rec.isNew && G.bestChain >= 3 && !G.bestsShown['chain' + G.bestChain]){ G.bestsShown['chain' + G.bestChain] = true; bests.push('Longest chain x' + G.bestChain + (G.players.filter(p => !p.cpu).length > 1 ? ' (' + G.bestChainBy + ')' : '')); }
  }
}
function scoreBest(bests){
  if(G.mode !== 'solo' || G.score <= 0) return false;
  const rec = A.Celebrate.record(GAME, 'score.' + diffKey(), G.score);
  if(rec.isNew && !G.bestsShown.score){ G.bestsShown.score = true; bests.push('Top score ' + G.score.toLocaleString()); }
  return rec.isNew;
}
const bandOf = lv => Math.ceil(lv / 5) * 5;
function bandMedal(ratio){ const k = G.kids ? 1.5 : 1; return A.Medals.pick(ratio, { gold: BAND_MEDAL.gold * k, silver: BAND_MEDAL.silver * k }, true); }
const lobbyItem = () => ({ label: hosting() ? 'Back to room lobby' : 'Change players', select: () => openLobby(null) });
const quitItems = () => hosting() ? [] : [{ label: 'Quit to title', select: toTitle }];

function levelResults(){
  G.state = 'results'; G.stateT = 0;
  const b = G.boards[0], lvl = G.level, used = G.players.reduce((n, p) => n + p.used, 0);
  tidyStats();
  const bests = []; let medal = null, medalLine = '';
  if(G.mode === 'solo'){
    const rec = A.Celebrate.record(GAME, 'level.' + diffKey(), lvl);
    if(rec.isNew && !G.bestsShown.level && lvl > 1){ G.bestsShown.level = true; bests.push('Highest level ' + lvl); }
    const band = bandOf(lvl); (G.bandLog[band] = G.bandLog[band] || []).push({ used, gl: b.glStart });
    if(lvl % 5 === 0){
      const log = G.bandLog[band], su = log.reduce((a, c) => a + c.used, 0), room = log.reduce((a, c) => a + c.gl + 6, 0);
      medal = bandMedal(su / room);
      const mr = A.Medals.award(GAME, 'lv' + lvl, diffKey(), medal), k = G.kids ? 1.5 : 1;
      medalLine = '<br>Levels ' + (lvl - 4) + '–' + lvl + ': ' + A.Medals.html(mr.medal) + ' <b>' + A.Medals.label(mr.medal) + ' medal</b> · ' + su + ' capsules over ' + log.length + ' level' + (log.length > 1 ? 's' : '') +
        (medal !== 'gold' ? '<br><small>Gold: ' + Math.floor(BAND_MEDAL.gold * k * room) + ' capsules or fewer' + (medal === 'bronze' ? ', silver: ' + Math.floor(BAND_MEDAL.silver * k * room) : '') + '</small>' : '');
      if(!mr.improved) medal = null;
    }
    scoreBest(bests);
  }
  chainBest(bests);
  celebrate(bests, medal, 'Levels ' + (lvl - 4) + '–' + lvl);
  const last = lvl >= 20, showAwards = G.mode === 'coop' || lvl % 5 === 0;
  const items = [
    { label: last ? 'Encore: Level 20 again' : 'Next: Level ' + (lvl + 1), select: () => { G.level = Math.min(20, lvl + 1); startLevel(); } },
    { label: 'Play it again', select: () => startLevel() },
    lobbyItem(), ...quitItems()
  ];
  A.Menu.open({ center: true, shared: true, kicker: modeLabel() + ' · Level ' + lvl + ' · ' + SP().label + (G.kids ? ' · Kids' : ''),
    title: last ? 'All 20 labs clean!' : 'Lab clean!',
    text: 'Cleared <b>' + b.glStart + '</b> Gloomies in <b>' + fmt(b.time) + '</b> with <b>' + used + '</b> capsules' + medalLine +
      (showAwards ? '<br>' + awardsHtml(G.mode === 'coop' ? 'level' : 'run', b.time) : '') + '<br>Score <b>' + G.score.toLocaleString() + '</b>', items });
}
function gameOver(){
  G.state = 'over'; G.stateT = 0; tidyStats();
  const bests = []; scoreBest(bests); chainBest(bests);
  if(bests.length) celebrate(bests); else sfx('topout');
  const lvl = G.level;
  A.Menu.open({ center: true, shared: true, kicker: modeLabel() + ' · Level ' + lvl + ' · ' + SP().label, title: 'The beaker overflowed!',
    text: 'The Gloomies filled the beaker on level <b>' + lvl + '</b>. Great work, scientists!<br>' + awardsHtml('run') + '<br>Score <b>' + G.score.toLocaleString() + '</b>',
    items: [{ label: 'Try level ' + lvl + ' again', select: () => startLevel() }, lobbyItem(), ...quitItems()] });
}
function matchResults(){
  G.state = 'results'; G.stateT = 0; tidyStats();
  const w = vsWinner(), bests = []; chainBest(bests); celebrate(bests);
  const stars = G.players.map(p => '<b style="color:' + p.color + '">' + A.esc(p.name) + '</b> ' + '★'.repeat(p.stars) + '☆'.repeat(Math.max(0, 2 - p.stars))).join(' &nbsp; ');
  A.Menu.open({ center: true, shared: true, kicker: 'Versus · Level ' + G.level + ' · ' + SP().label, title: w ? w.name + ' wins!' : 'Match over',
    text: stars + '<br>' + awardsHtml('run'),
    items: [{ label: 'Rematch', select: () => { for(const p of G.players){ p.stars = 0; p.run = newStats(); } G.round = 0; nextRound(); } }, lobbyItem(), ...quitItems()] });
}
function dailyRuns(){ const d = A.Store.get('fizz.daily', null); return d && d.date === today() && Array.isArray(d.runs) ? d.runs : []; }
function dailyResults(){
  G.state = 'results'; G.stateT = 0; tidyStats();
  const runs = dailyRuns().slice(), bests = [];
  const famBest = runs.filter(r => r.t).reduce((m, r) => Math.min(m, r.t), Infinity);
  let lines = [];
  for(const p of G.players){
    const t = boardOf(p).done ? r2(boardOf(p).time) : null;
    if(!p.practice){ runs.push({ n: p.name, t, k: G.kids }); }
    lines.push('<b style="color:' + p.color + '">' + A.esc(p.name) + '</b> ' + (t ? fmt(t) : 'overflowed') + (p.practice ? ' <small>(practice)</small>' : ''));
    if(t && !p.practice){
      const rec = A.Celebrate.record(GAME, 'daily', t, true);
      if(rec.isNew) bests.push('Fastest Lab Puzzle ' + fmt(t) + (G.players.length > 1 ? ' (' + p.name + ')' : ''));
      else if(t < famBest) bests.push(p.name + ' is fastest in the family today!');
    }
  }
  A.Store.set('fizz.daily', { date: today(), runs });
  chainBest(bests); celebrate(bests);
  const board = runs.filter(r => r.t).sort((a, b) => a.t - b.t).slice(0, 6)
    .map((r, i) => (i === 0 ? '🏆 ' : (i + 1) + '. ') + A.esc(r.n) + ' ' + fmt(r.t) + (r.k ? ' <small>(kids)</small>' : '')).join(' · ');
  A.Menu.open({ center: true, shared: true, kicker: 'Daily Lab Puzzle · ' + today(), title: 'Lab report',
    text: lines.join('<br>') + '<br>' + (board ? 'Family best today: ' + board : 'Nobody has cleared today’s beaker yet. Tomorrow brings a new one!') + '<br>' + awardsHtml('run'),
    items: [{ label: 'Practice again', select: () => { for(const p of G.players) p.practice = true; startLevel(); } }, lobbyItem(), ...quitItems()] });
}
function puzzleMedal(used, par){ const k = G.kids ? 1 : 0; return used <= par + k ? 'gold' : used <= par + 2 + k * 2 ? 'silver' : 'bronze'; }
function puzzleResults(ok){
  G.state = 'results'; G.stateT = 0; tidyStats();
  const pz = PUZZLES[G.pz], p = G.players[0], used = p.used, n = G.pz + 1;
  const items = [];
  if(ok){
    const medal = puzzleMedal(used, pz.par), mr = A.Medals.award(GAME, 'pz' + n, diffKey(), medal);
    const solved = A.Store.get('fizz.pzSolved', 0) | 0; if(n > solved) A.Store.set('fizz.pzSolved', n);
    const bests = []; chainBest(bests);
    celebrate(bests, mr.improved ? medal : null, 'Puzzle ' + n + ' · ' + pz.name);
    if(G.pz < PUZZLES.length - 1) items.push({ label: 'Next: Puzzle ' + (n + 1), select: () => { G.pz++; saveOpts(); startLevel(); } });
    items.push({ label: 'Try it again', select: () => startLevel() });
    items.push(...quitItems());
    if(hosting()) items.push(lobbyItem());
    A.Menu.open({ center: true, shared: true, kicker: 'Puzzle ' + n + ' · ' + pz.name, title: 'Puzzle solved!',
      text: A.Medals.html(medal) + ' <b>' + A.Medals.label(medal) + '</b> · cleared in <b>' + used + '</b> capsule' + (used > 1 ? 's' : '') + ' · par <b>' + pz.par + '</b>' +
        (medal !== 'gold' ? '<br><small>Gold: clear it in ' + (pz.par + (G.kids ? 1 : 0)) + '</small>' : '') + '<br>' + awardsHtml('level'), items });
  } else {
    sfx('topout');
    items.push({ label: 'Try again', select: () => startLevel() });
    if(G.pz < PUZZLES.length - 1 && G.pz + 1 < puzzleOpen()) items.push({ label: 'Skip to puzzle ' + (n + 1), select: () => { G.pz++; saveOpts(); startLevel(); } });
    items.push(...quitItems());
    if(hosting()) items.push(lobbyItem());
    A.Menu.open({ center: true, shared: true, kicker: 'Puzzle ' + n + ' · ' + pz.name, title: 'Out of capsules!',
      text: 'So close! Par is <b>' + pz.par + '</b>. Tip: look for spots where one capsule lines up two colours at once.', items });
  }
}
const puzzleOpen = () => Math.min(PUZZLES.length, Math.max(6, (A.Store.get('fizz.pzSolved', 0) | 0) + 3));

/* ---------- Menus & online ---------- */
const hosting = () => G.net === 'host';
const fromGuest = src => !!(src && src.kind === 'net');
const modeLabel = () => MODES[G.mode].label;
function medalSuffix(stage){ const m = A.Medals.get(GAME, stage); return m ? ' · ' + A.Medals.label(m) : ''; }
function levelItem(){
  if(G.mode === 'puzzle'){
    const open = puzzleOpen();
    return { label: 'Puzzle', value: () => (G.pz + 1) + ' · ' + PUZZLES[G.pz].name + ' · par ' + PUZZLES[G.pz].par + medalSuffix('pz' + (G.pz + 1)),
      change: d => { G.pz = (G.pz + d + open) % open; saveOpts(); } };
  }
  if(G.mode === 'daily'){
    return { label: 'Today', value: () => { const r = dailyRuns(); const best = r.filter(x => x.t).sort((a, b) => a.t - b.t)[0]; return today() + (best ? ' · best ' + fmt(best.t) : r.length ? ' · ' + r.length + ' tried' : ' · new!'); }, change: () => {} };
  }
  return { label: 'Level', value: () => G.level + (G.mode === 'solo' ? medalSuffix('lv' + bandOf(G.level)) : ''), change: d => { G.level = ((G.level - 1 + d + 20) % 20) + 1; saveOpts(); } };
}
function modeBlurb(){
  switch(G.mode){
    case 'versus': return '<b>2–4 scientists</b> side by side. Combos and chains fling loose capsule halves at the leader. First to clean their beaker, or the last one standing, wins a star. <b>Best of 3.</b> Playing alone? <b>Fizzbot</b> takes you on.';
    case 'coop': return '<b>Big Beaker:</b> 1–4 players drop capsules into one wide shared beaker together. Each capsule glows in its owner’s colour. Team up and clean the lab!';
    case 'daily': return '<b>Today’s Lab Puzzle:</b> the same beaker for the whole family. One try each per day, fastest clean-up wins. A new beaker every morning.';
    case 'puzzle': return '<b>30 hand-made beakers.</b> Every capsule is known in advance: clear each beaker in as few capsules as you can. Match par for gold!';
    default: return 'Grumpy <b>Gloomies</b> have taken over the candy lab! Drop fizz capsules and line up <b>4 of a colour</b> in a row or column to pop them. Clear every Gloomy to clean the lab. <b>Levels 1–20.</b>';
  }
}
function titleMenu(start){
  G.state = 'title';
  const reopen = i => () => titleMenu(i);
  A.Menu.open({ kicker: 'xRetro', title: 'FIZZ LAB', text: modeBlurb(), start: start || 0,
    items: [
      { label: 'Play', select: src => openLobby(src) },
      { label: 'Play online', select: src => onlineMenu(src) },
      { label: 'Mode', value: () => modeLabel(), change: d => { G.mode = MODE_ORDER[(MODE_ORDER.indexOf(G.mode) + d + MODE_ORDER.length) % MODE_ORDER.length]; saveOpts(); setTimeout(reopen(2), 0); } },
      levelItem(),
      { label: 'Speed', value: () => SP().label, change: d => { G.speed = SPEED_ORDER[(SPEED_ORDER.indexOf(G.speed) + d + 3) % 3]; saveOpts(); } },
      { label: 'Music', value: () => SONG_LABEL[G.song], change: d => { G.song = SONG_ORDER[(SONG_ORDER.indexOf(G.song) + d + 4) % 4]; saveOpts(); } },
      { label: 'Kids mode', value: () => G.kids ? 'On' : 'Off', change: () => { G.kids = !G.kids; saveOpts(); } },
      { label: 'More…', select: () => moreMenu() }
    ], footer: controllerLine() });
}
function moreMenu(start){
  A.Menu.open({ center: true, kicker: 'Fizz Lab', title: 'More', start: start || 0,
    items: [
      { label: 'Power-ups', value: () => G.power ? 'On (rainbow, bomb, hold)' : 'Off (classic)', change: () => { G.power = !G.power; saveOpts(); } },
      { label: 'Family bests', select: () => bestsMenu(() => moreMenu(1)) },
      { label: 'How to play', select: () => helpMenu(() => moreMenu(2)) },
      { label: 'Settings', select: () => settingsMenu(() => moreMenu(3)) },
      { label: 'All games', select: () => { location.href = 'index.html'; } },
      { label: 'Back', select: () => titleMenu(7) }
    ], back: () => titleMenu(7) });
}
function bestsMenu(back){
  const B = k => A.Store.get('best.' + GAME + '.' + k, null);
  const lines = [];
  const sc = B('score.normal'), sk = B('score.kids'), lv = B('level.normal'), lk = B('level.kids'), ch = B('chain'), dl = B('daily');
  lines.push('Top score: <b>' + (sc ? sc.toLocaleString() : '—') + '</b>' + (sk ? ' · Kids <b>' + sk.toLocaleString() + '</b>' : ''));
  lines.push('Highest level: <b>' + (lv || '—') + '</b>' + (lk ? ' · Kids <b>' + lk + '</b>' : ''));
  lines.push('Longest chain: <b>' + (ch ? 'x' + ch : '—') + '</b> · Fastest Lab Puzzle: <b>' + (dl ? fmt(dl) : '—') + '</b>');
  const runs = dailyRuns().filter(r => r.t).sort((a, b) => a.t - b.t);
  lines.push('Today’s Lab Puzzle: ' + (runs.length ? runs.slice(0, 5).map(r => A.esc(r.n) + ' <b>' + fmt(r.t) + '</b>').join(' · ') : 'no times yet'));
  const s = A.Medals.summary(GAME, 34), pzN = PUZZLES.filter((z, i) => A.Medals.get(GAME, 'pz' + (i + 1))).length;
  lines.push('Medals: <b>' + s.won + '</b> (' + s.gold + ' gold, ' + s.silver + ' silver, ' + s.bronze + ' bronze) · puzzles <b>' + pzN + '/30</b> · level bands <b>' + BANDS.filter(n => A.Medals.get(GAME, 'lv' + n)).length + '/4</b>');
  A.Menu.open({ center: true, kicker: 'Fizz Lab', title: 'Family bests', text: lines.join('<br>'), items: [{ label: 'Back', select: back }], back });
}
function controllerLine(){
  const n = A.Input.pads().length, s = A.Medals.summary(GAME, 34);
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') +
    (s.won ? 'Medals: ' + s.won + '/34. ' : '') + 'Kids mode: slower drops, big ghost, no game over.';
}
function openLobby(src){
  if(!G.demo) startDemo();
  G.state = 'lobby';
  const online = hosting(), M = MODES[G.mode];
  const what = G.mode === 'puzzle' ? 'Puzzle ' + (G.pz + 1) : G.mode === 'daily' ? today() : 'Level ' + G.level + ' · ' + SP().label;
  A.Lobby.open({
    kicker: (online ? 'Online · ' : '') + modeLabel() + ' · ' + what + (G.kids ? ' · Kids' : ''),
    title: G.mode === 'coop' ? 'Who’s in the lab?' : M.max === 1 ? 'Ready, scientist?' : 'Who’s playing?',
    text: (online ? 'Friends join from any device with the code or invite link. ' : '') +
      (M.max === 1 ? 'Press FIRE to join, then FIRE again when ready. (Versus, Big Beaker and the Daily Lab take up to 4.)' :
       G.mode === 'versus' ? 'Everyone presses FIRE to join, then FIRE again when ready. 1 player plays Fizzbot. More can drop in for the next round.' :
       'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 players.' + (G.mode === 'coop' ? ' More can drop in later by pressing FIRE.' : '')),
    min: M.min, max: M.max, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    room: online ? { code: Net.code, link: Net.inviteLink(Net.code) } : null,
    backLabel: online ? 'Close room' : 'Back',
    onStart: players => newGame(players),
    onBack: online ? () => leaveRoom(null, () => openLobby(null)) : () => titleMenu()
  });
}
function pause(){
  if(G.state !== 'play' && G.state !== 'intro') return;
  G.paused = G.state; G.state = 'paused'; A.Sound.play('pause');
  const again = G.mode === 'puzzle' ? 'Restart puzzle' : G.mode === 'versus' ? 'Restart round' : G.mode === 'daily' ? 'Restart (practice)' : 'Restart level';
  const items = [{ label: 'Resume', select: resume }, { label: again, select: () => { if(G.mode === 'daily') for(const p of G.players) p.practice = true; startLevel(); } }];
  if(hosting()){
    items.push({ label: 'Back to room lobby', select: () => openLobby(null) });
    items.push({ label: 'Settings (host)', select: src => { if(!fromGuest(src)) settingsMenu(pauseAgain); } });
    items.push({ label: 'Leave the room', select: src => leaveRoom(src, pauseAgain) });
  } else {
    items.push({ label: 'Settings', select: () => settingsMenu(pauseAgain) });
    items.push({ label: 'How to play', select: () => helpMenu(pauseAgain) });
    items.push({ label: 'Quit to title', select: toTitle });
  }
  A.Menu.open({ center: true, shared: true, kicker: modeLabel() + (G.mode === 'puzzle' ? ' · Puzzle ' + (G.pz + 1) : G.mode === 'daily' ? '' : ' · Level ' + G.level), title: 'Paused', items, back: resume });
}
function pauseAgain(){ G.state = G.paused || 'play'; pause(); }
function resume(){ A.Menu.close(); G.state = G.paused || 'play'; }
function toTitle(){
  A.Menu.close(); A.Lobby.close(); A.Mirror.hide();
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
      items: [{ label: 'Back', select: () => titleMenu(1) }], back: () => titleMenu(1) });
    return;
  }
  A.Menu.open({ center: true, kicker: 'Play online', title: 'Online rooms', start: start || 0,
    text: 'The host gets a <b>4-letter code</b>; everyone else types it in or opens the invite link. The host picks the mode (' + modeLabel() + ' now).',
    items: [
      { label: 'Host a game', select: s => hostRoom(s) },
      { label: 'Join with a code', select: () => A.Online.codeEntry(code => joinRoom(code), () => onlineMenu(src, 1)) },
      { label: 'Your name', value: () => A.Names.device() || 'not set', change: () => A.Online.askName(() => onlineMenu(src, 2), () => onlineMenu(src, 2)) },
      { label: 'Back', select: () => titleMenu(1) }
    ], back: () => titleMenu(1) });
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
      G.net = 'guest'; A.Menu.close(); A.Sound.play('online'); G.loadN = -1; guest.grids = [];
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
  A.Menu.open({ center: true, kicker: 'How to play', title: 'Lab rules',
    text: (touch ? '<b>Stick</b> left/right moves, down soft-drops, up rotates the other way (hold up = hold slot). <b>ROTATE</b> spins the capsule. <b>Swipe down</b> anywhere drops it, <b>swipe up</b> holds it.<br>'
                 : '<b>Left / right</b> move · <b>Down</b> soft drop · <b>double-tap Down</b> hard drop · <b>FIRE</b> rotates · <b>Up</b> rotates the other way · <b>hold Up</b> swaps with the hold slot.<br>') +
      'Line up <b>4 or more of one colour</b> (capsule halves or Gloomies) in a row or column and they pop. Loose halves fall, and new matches make a <b>chain</b>: FIZZ x2, x3…<br>' +
      '<b>Rainbow capsules</b> match any colour. A <b>fizz bomb</b> pops everything in a 3×3. The ghost shows where your capsule will land.<br>' +
      '<b>Versus:</b> chains and double pops fling loose halves at the leader. <b>Big Beaker:</b> everyone shares one wide beaker. <b>Kids mode:</b> slower, big ghost, more rainbows, and when the beaker fills the top rows fizz away.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Effects (in beaker-cell coordinates, so every screen draws them in the right place) ---------- */
let parts = [];
function fxAdd(o){ if(parts.length < 600) parts.push(o); if(Net && Net.role === 'host' && !G.demo && netFx.length < 60) netFx.push(o); }
function cellFx(b, x, y, col, kind){ const bi = G.boards.indexOf(b); if(bi < 0) return; fxAdd({ kind, bi, x, y, col, t: 0 }); }
function callout(b, str, col, lvl){ const bi = G.boards.indexOf(b); if(bi < 0) return; fxAdd({ kind: 'call', bi, str, col: col || null, lvl: lvl || 1, t: 0 }); }
function expandFx(o){
  // one effect event becomes a handful of particles (done on every screen, so snapshots stay small)
  const out = [], R = Math.random;
  const P = (q) => out.push(Object.assign({ bi: o.bi, t: 0, col: o.col }, q));
  switch(o.kind){
    case 'pop': for(let i = 0; i < 5; i++) P({ k: 'bub', x: o.x + 0.5, y: o.y + 0.5, vx: (R() - 0.5) * 3, vy: -1 - R() * 2.5, r: 0.12 + R() * 0.16, life: 0.6 + R() * 0.5 }); break;
    case 'glpop':
      for(let i = 0; i < 8; i++){ const a = i / 8 * Math.PI * 2; P({ k: 'spark', x: o.x + 0.5, y: o.y + 0.5, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, r: 0.16, life: 0.45 }); }
      P({ k: 'ring', x: o.x + 0.5, y: o.y + 0.5, r: 0.2, life: 0.4 });
      for(let i = 0; i < 4; i++) P({ k: 'bub', x: o.x + 0.5, y: o.y + 0.5, vx: (R() - 0.5) * 2, vy: -1.5 - R() * 2, r: 0.14 + R() * 0.14, life: 0.8 + R() * 0.4 });
      break;
    case 'bub': for(let i = 0; i < 3; i++) P({ k: 'bub', x: o.x + 0.5, y: o.y + 0.5, vx: (R() - 0.5) * 2, vy: -2 - R() * 3, r: 0.14 + R() * 0.2, life: 0.9 + R() * 0.5 }); break;
    case 'dust': P({ k: 'puff', x: o.x + 0.2, y: o.y + 0.5, vx: -1.5, vy: -0.3, r: 0.2, life: 0.3 }); P({ k: 'puff', x: o.x + 0.8, y: o.y + 0.5, vx: 1.5, vy: -0.3, r: 0.2, life: 0.3 }); break;
    case 'trail': P({ k: 'trail', x: o.x + 0.5, y: o.y + 0.5, vx: 0, vy: 0, r: 0.3, life: 0.22 }); break;
    case 'boom':
      P({ k: 'ring', x: o.x + 0.5, y: o.y + 0.5, r: 0.6, life: 0.5, col: BOMB });
      for(let i = 0; i < 18; i++){ const a = R() * Math.PI * 2, sp = 2 + R() * 5; P({ k: 'bub', x: o.x + 0.5, y: o.y + 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, r: 0.15 + R() * 0.25, life: 0.6 + R() * 0.5, col: (R() * 3) | 0 }); }
      break;
    case 'conf': P({ k: 'conf', x: o.x, y: o.y, vx: (R() - 0.5) * 6, vy: -4 - R() * 5, r: 0.25, life: 1.6 + R(), rot: R() * 6, col: (R() * 6) | 0 }); break;
    case 'call': P({ k: 'call', x: 0, y: 0, str: o.str, lvl: o.lvl, life: 1.2 }); out[out.length - 1].col = o.col; break;
    case 'orb': out.push({ k: 'orb', from: o.from, to: o.to, t: 0, life: o.life || 0.6, cols: o.cols }); break;
  }
  return out;
}
let live = [];
function fxStep(dt){
  for(const o of parts) live.push(...expandFx(o));
  parts = [];
  for(const q of live){
    q.t += dt;
    if(q.k === 'bub'){ q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - 2 * dt; q.vy -= 1.5 * dt; }
    else if(q.k === 'spark' || q.k === 'puff'){ q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - 5 * dt; q.vy *= 1 - 5 * dt; }
    else if(q.k === 'conf'){ q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 9 * dt; q.vx *= 1 - 1.5 * dt; q.rot += 8 * dt; }
  }
  live = live.filter(q => q.t < q.life);
  if(live.length > 900) live.splice(0, live.length - 900);
}

/* ---------- Online: snapshots (the beaker is sent as a short string, only when it changes) ---------- */
const guest = { grids: [], mode: 'solo' };
let netStep = 0, snapN = 0, forceFull = false, lastLoadSent = -1, lastGrids = [];
function gridStr(b){ let s = ''; for(const v of b.g) s += String.fromCharCode(48 + v); return s; }
const pieceArr = t => t ? [t.a, t.b, t.single ? 1 : 0] : 0;
const arrPiece = q => q ? { a: q[0], b: q[1], single: !!q[2] } : null;
function sendSnap(){
  if(G.loadN !== lastLoadSent){ lastLoadSent = G.loadN; lastGrids = []; }
  const full = forceFull || (++snapN % 90 === 0); forceFull = false;
  const s = { t: 's', st: G.state === 'paused' ? 'paused' : G.state, sT: r2(G.stateT), md: MD(), dm: G.demo ? 1 : 0, kd: G.kids ? 1 : 0, lv: G.level, sp: G.speed, mu: G.song,
    pz: G.pz, rd: G.round, wn: G.winner, ln: G.loadN, sc: G.score, pw: G.power ? 1 : 0, dy: G.daily,
    b: G.boards.map((b, i) => {
      const row = [b.W, b.H, b.gl, b.phase === 'pop' ? b.popCells : 0, r2(b.t), (b.out ? 1 : 0) | (b.done ? 2 : 0) | (b.danger ? 4 : 0), r2(b.time), b.glStart, b.cnt];
      const gs = gridStr(b); if(full || gs !== lastGrids[i]){ row.push(gs); lastGrids[i] = gs; }
      return row;
    }),
    p: G.players.map(p => [p.slot, p.board, p.piece ? [p.piece.x, p.piece.y, p.piece.o, p.piece.a, p.piece.b, p.piece.single ? 1 : 0] : 0, p.next.slice(0, 2).map(pieceArr), pieceArr(p.hold),
      p.state, p.score, p.stars, p.name, p.color, p.source || '', p.pending.length, p.used, r2(p.throwT), p.cpu ? 1 : 0, p.practice ? 1 : 0, p.seqN]) };
  if(netSfx.length){ s.sfx = netSfx; netSfx = []; }
  if(netFx.length){ s.fx = netFx; netFx = []; }
  Net.broadcast(s);
}
function applySnap(s){
  if(s.ln !== G.loadN){ G.loadN = s.ln; guest.grids = []; live = []; }
  G.state = s.st; G.stateT = s.sT; G.demo = !!s.dm; G.kids = !!s.kd; G.level = s.lv; G.speed = s.sp; G.song = s.mu; G.pz = s.pz;
  G.round = s.rd; G.winner = s.wn; G.score = s.sc; G.power = !!s.pw; G.daily = s.dy; guest.mode = s.md;
  G.boards = s.b.map((r, i) => {
    const old = G.boards[i], b = old && old.W === r[0] ? old : makeBoard(r[0], r[1]);
    b.gl = r[2]; b.popCells = r[3] || []; b.phase = r[3] ? 'pop' : 'idle'; b.t = r[4]; b.out = !!(r[5] & 1); b.done = !!(r[5] & 2); b.danger = (r[5] & 4) ? 1 : 0;
    b.time = r[6]; b.glStart = r[7]; b.cnt = r[8] || [0, 0, 0];
    if(r[9]) guest.grids[i] = r[9];
    const gs = guest.grids[i]; if(gs && gs.length === b.g.length) for(let k = 0; k < gs.length; k++) b.g[k] = gs.charCodeAt(k) - 48;
    b.players = []; return b;
  });
  G.players = s.p.map(q => {
    const p = makePlayer({ slot: q[0], board: q[1], name: q[8], color: q[9], source: q[10] });
    if(q[2]){ const c = q[2]; p.piece = { x: c[0], y: c[1], o: c[2], a: c[3], b: c[4], single: !!c[5] }; }
    p.next = (q[3] || []).map(arrPiece).filter(Boolean); p.hold = arrPiece(q[4]); p.state = q[5]; p.score = q[6]; p.stars = q[7];
    p.pending = new Array(q[11]).fill(0); p.used = q[12]; p.throwT = q[13]; p.cpu = !!q[14]; p.practice = !!q[15]; p.seqN = q[16] | 0;
    if(G.boards[p.board]) G.boards[p.board].players.push(p);
    return p;
  });
}
const netHandlers = {
  onEnd(why){ const msg = Net.why(why); G.net = null; toTitle(); A.toast(msg, 4500); },
  onPeer(){ forceFull = true; },
  onRename(id, name){ const p = G.players.find(x => x.source === id); if(p) p.name = name; const r = G.roster.find(x => x.source === id); if(r) r.name = name; },
  onMessage(m){
    if(m.t !== 's') return;
    applySnap(m);
    if(m.sfx && !m.dm) m.sfx.forEach(playNetSfx);
    if(m.fx) for(const o of m.fx) parts.push(o);
  }
};
function MD(){ return G.net === 'guest' ? guest.mode : G.demo ? 'versus' : G.mode; }

/* ---------- Main step ---------- */
let touchShown = false, lastMusic = null, introBeeps = 0;
function music(){
  const st = G.state, song = G.song === 'off' ? null : SONGS[G.song];
  let want = null;
  if(G.demo || st === 'title' || st === 'lobby' || st === 'online') want = song;
  else if(st === 'intro' || st === 'play' || st === 'paused' || st === 'roundEnd') want = song;
  if(want !== lastMusic){ lastMusic = want; A.Music.play(want); }
  A.Music.duck(st === 'paused');
}
function myTouch(){
  if(G.net === 'guest') return G.players.some(p => p.source === Net.peer + '/touch');
  return G.players.some(p => p.source === 'touch');
}
function step(dt){
  G.time += dt;
  const playing = G.state === 'play' || G.state === 'intro';
  const wantTouch = playing && !G.demo && myTouch() && !(G.net === 'guest' && A.Mirror.ui);
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); A.Touch.label('ROTATE'); }
  if(G.net === 'guest'){ Net.guestTick(); Net.setPlaying(playing && !G.demo); music(); return; }
  music();
  if(Net) Net.setPlaying(playing && !G.demo);
  hostStep(dt);
  if(G.net === 'host'){ Net.hostTick(); if(++netStep % 2 === 0 && Net.hasGuests()) sendSnap(); }
}
function sim(dt){
  for(const b of G.boards) stepBoard(b, dt);
  for(const p of G.players) stepPlayer(p, dt);
  if(G.demo){
    G.demoT = (G.demoT || 0) + dt;
    if(G.boards.some(b => b.done || b.out) || G.demoT > 75) startDemo();
  }
}
function hostStep(dt){
  if(A.Lobby.isOpen()){ A.Lobby.update(); if(G.demo) sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); if(G.demo) sim(dt); return; }
  if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
  const pausePressed = A.Input.all().some(s => A.Input.pressed(s, 'pause') && (s.kind !== 'net' || G.players.some(p => p.source === s.id)));
  switch(G.state){
    case 'intro': {
      if(pausePressed){ pause(); return; }
      const before = G.stateT; G.stateT += dt;
      if(Math.floor(G.stateT * 14) !== Math.floor(before * 14) && G.stateT < 1.1) sfx('appear');
      if(G.stateT >= 1.6){ G.state = 'play'; G.stateT = 0; }
      break;
    }
    case 'play':
      if(pausePressed){ pause(); return; }
      G.stateT += dt;
      dropIn(); sim(dt); flowChecks(dt);
      break;
    case 'clear':
      G.stateT += dt;
      for(const b of G.boards) stepBoard(b, dt);
      if(G.stateT > 2.3){ if(MD() === 'puzzle') puzzleResults(true); else levelResults(); }
      break;
    case 'roundEnd':
      G.stateT += dt; dropIn();
      if(G.stateT > 3) afterRoundEnd();
      break;
    case 'title': titleMenu(); break;
    default: if(G.demo) sim(dt);
  }
}
document.addEventListener('visibilitychange', () => {
  if(!document.hidden || (G.state !== 'play' && G.state !== 'intro') || G.net === 'guest' || G.demo) return;
  pause(); if(G.net === 'host'){ Net.hostTick(); sendSnap(); }
});

/* Touch: swipe down anywhere drops the capsule, swipe up puts it in the hold slot */
let swipe = null;
window.addEventListener('pointerdown', e => {
  if(e.pointerType !== 'touch' || !touchShown) return;
  if(e.target && e.target.closest && e.target.closest('.touch-stick,.touch-fire,.touch-pause,button')) return;
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
}, { passive: true });
window.addEventListener('pointerup', e => {
  if(!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y, dt = performance.now() - swipe.t; swipe = null;
  const u = Math.min(window.innerWidth, window.innerHeight) * 0.07;
  if(dt > 700 || Math.abs(dy) < u || Math.abs(dy) < Math.abs(dx) * 1.2) return;
  if(dy > 0){ A.Input.tapTouch('down'); setTimeout(() => A.Input.tapTouch('down'), 150); }   // = double-tap DOWN (works online too)
  else if(A.Input.holdTouch) A.Input.holdTouch('up', 460);                                      // = hold UP
}, { passive: true });

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);

function shade(hex, k){
  if(hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return 'rgb(' + f(n >> 16 & 255) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')';
}
function rr(c, x, y, w, h, r){ r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function rrC(c, x, y, w, h, tl, tr, br, bl){
  c.beginPath(); c.moveTo(x + tl, y); c.lineTo(x + w - tr, y); c.arcTo(x + w, y, x + w, y + tr, tr); c.lineTo(x + w, y + h - br); c.arcTo(x + w, y + h, x + w - br, y + h, br);
  c.lineTo(x + bl, y + h); c.arcTo(x, y + h, x, y + h - bl, bl); c.lineTo(x, y + tl); c.arcTo(x, y, x + tl, y, tl); c.closePath();
}
function circ(c, x, y, r){ c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); }
function ell(c, x, y, rx, ry, rot){ c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, Math.PI * 2); }
function text(c, str, x, y, size, color, align, base){ c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = base || 'top'; c.fillText(str, x, y); }
function outlined(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = Math.max(1.5, size / 3.2); c.strokeStyle = 'rgba(28,12,48,.92)'; c.strokeText(str, x, y); c.fillStyle = color; c.fillText(str, x, y);
}
function fitText(c, str, maxW, size){ c.font = size + 'px ' + FONT; while(size > 3 && c.measureText(str).width > maxW){ size -= 0.5; c.font = size + 'px ' + FONT; } return size; }
function star5(c, x, y, R, r){ c.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); }
function card(c, x, y, w, h, accent){
  c.fillStyle = 'rgba(34,16,64,.62)'; rr(c, x, y, w, h, 4); c.fill();
  c.strokeStyle = accent || 'rgba(255,255,255,.22)'; c.lineWidth = 0.7; rr(c, x, y, w, h, 4); c.stroke();
}
const colMain = c => c === RAINBOW ? '#ffffff' : c === BOMB ? '#a77bff' : COLS[c].main;

/* Music beat, for dancing Gloomies (read from the sequencer so they dance in time) */
function beatNow(){
  const m = A.Music, ctx = A.Sound.ctx;
  if(m.song && ctx && ctx.state === 'running'){ const sd = 60 / m.song.bpm / 4; return (m.step - (m.nextT - ctx.currentTime) / sd) / 4; }
  return G.time * 2;
}

/* ---------- Sprites (cached at screen resolution) ---------- */
const spriteCache = new Map(); let spriteScale = 0;
function sprite(key, w, h, draw){
  const s = display.scale;
  if(s !== spriteScale){ spriteCache.clear(); spriteScale = s; }
  let cv = spriteCache.get(key);
  if(!cv){
    cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * s)); cv.height = Math.max(1, Math.ceil(h * s));
    const c = cv.getContext('2d'); c.scale(cv.width / w, cv.height / h); draw(c); spriteCache.set(key, cv);
  }
  return cv;
}
/* a capsule half: rounded on its outer end, flat where it meets its partner */
function paintHalf(c, s, col, link){
  const p = s * 0.07, R = s * 0.46, r = s * 0.1;
  let x = p, y = p, w = s - 2 * p, h = s - 2 * p, tl = R, tr = R, br = R, bl = R;
  if(link === L_R){ w += p; tr = br = r; }
  else if(link === L_L){ x -= p; w += p; tl = bl = r; }
  else if(link === L_U){ y -= p; h += p; tl = tr = r; }
  else if(link === L_D){ h += p; bl = br = r; }
  let fill;
  if(col === RAINBOW){ fill = c.createLinearGradient(0, 0, s, s); RAINBOW_COLS.forEach((k, i) => fill.addColorStop(i / 5, k)); }
  else { const C = COLS[col]; fill = c.createLinearGradient(0, 0, 0, s); fill.addColorStop(0, C.light); fill.addColorStop(0.35, C.main); fill.addColorStop(1, C.dark); }
  c.fillStyle = fill; rrC(c, x, y, w, h, tl, tr, br, bl); c.fill();
  c.strokeStyle = col === RAINBOW ? 'rgba(60,20,90,.8)' : COLS[col].deep; c.lineWidth = s * 0.07; rrC(c, x, y, w, h, tl, tr, br, bl); c.stroke();
  // shine and fizz bubbles
  c.fillStyle = 'rgba(255,255,255,.55)'; ell(c, x + w * 0.34, y + h * 0.3, w * 0.16, h * 0.1, -0.5); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)'; circ(c, x + w * 0.62, y + h * 0.62, s * 0.06); c.fill(); circ(c, x + w * 0.5, y + h * 0.78, s * 0.04); c.fill();
  if(link){ c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = s * 0.05; c.beginPath();
    if(link === L_R){ c.moveTo(s - 0.2, y + 2); c.lineTo(s - 0.2, y + h - 2); } else if(link === L_L){ c.moveTo(0.2, y + 2); c.lineTo(0.2, y + h - 2); }
    else if(link === L_U){ c.moveTo(x + 2, 0.2); c.lineTo(x + w - 2, 0.2); } else { c.moveTo(x + 2, s - 0.2); c.lineTo(x + w - 2, s - 0.2); } c.stroke(); }
}
function halfSprite(col, link, s){ return sprite('h' + col + '_' + link + '_' + s, s, s, c => paintHalf(c, s, col, link)); }
function paintBomb(c, s){
  const cx = s / 2, cy = s * 0.55, R = s * 0.38;
  const g = c.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R); g.addColorStop(0, '#d9c4ff'); g.addColorStop(0.4, '#8a5cff'); g.addColorStop(1, '#3d1f8a');
  c.fillStyle = g; circ(c, cx, cy, R); c.fill(); c.strokeStyle = '#24104f'; c.lineWidth = s * 0.07; circ(c, cx, cy, R); c.stroke();
  c.fillStyle = '#ffe27a'; star5(c, cx, cy + s * 0.02, R * 0.45, R * 0.2); c.fill();
  c.strokeStyle = '#6b4a2a'; c.lineWidth = s * 0.08; c.beginPath(); c.moveTo(cx + R * 0.4, cy - R * 0.8); c.quadraticCurveTo(cx + R * 0.7, cy - R * 1.3, cx + R * 1.0, cy - R * 1.1); c.stroke();
}
function bombSprite(s){ return sprite('bomb' + s, s, s, c => paintBomb(c, s)); }
/* Gloomies: Berry (round, with a leafy sprout), Lemon (lemon-shaped, pointy ends), Sky (a droplet with little horns).
   mood 0 grumpy, 1 nervous, 2 happy (popping) */
function paintGloomy(c, S, col, mood){
  const C = COLS[col], cx = S / 2, cy = S * 0.56, R = S * 0.3;
  c.lineJoin = 'round';
  const body = () => {
    c.beginPath();
    if(col === 0){ c.arc(cx, cy, R, 0, Math.PI * 2); }
    else if(col === 1){ c.moveTo(cx - R * 1.28, cy); c.bezierCurveTo(cx - R * 1.0, cy - R * 1.1, cx + R * 1.0, cy - R * 1.1, cx + R * 1.28, cy); c.bezierCurveTo(cx + R * 1.0, cy + R * 1.05, cx - R * 1.0, cy + R * 1.05, cx - R * 1.28, cy); }
    else { c.moveTo(cx, cy - R * 1.35); c.bezierCurveTo(cx + R * 0.5, cy - R * 0.8, cx + R * 1.05, cy - R * 0.2, cx + R * 1.0, cy + R * 0.3); c.arc(cx, cy + R * 0.25, R * 1.0, 0.05, Math.PI - 0.05); c.bezierCurveTo(cx - R * 1.05, cy - R * 0.2, cx - R * 0.5, cy - R * 0.8, cx, cy - R * 1.35); }
    c.closePath();
  };
  // extras behind the body
  if(col === 0){ c.fillStyle = '#4fcf6a'; c.strokeStyle = '#1f6b31'; c.lineWidth = S * 0.035;
    c.beginPath(); c.ellipse(cx - R * 0.35, cy - R * 1.02, R * 0.34, R * 0.16, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(cx + R * 0.35, cy - R * 1.02, R * 0.34, R * 0.16, 0.5, 0, Math.PI * 2); c.fill(); c.stroke(); }
  if(col === 2){ c.fillStyle = C.dark; c.strokeStyle = C.deep; c.lineWidth = S * 0.035;
    for(const sx of [-1, 1]){ c.beginPath(); c.moveTo(cx + sx * R * 0.45, cy - R * 0.7); c.lineTo(cx + sx * R * 0.85, cy - R * 1.2); c.lineTo(cx + sx * R * 0.8, cy - R * 0.55); c.closePath(); c.fill(); c.stroke(); } }
  const g = c.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R * 1.3);
  g.addColorStop(0, C.light); g.addColorStop(0.45, C.main); g.addColorStop(1, C.dark);
  c.fillStyle = g; body(); c.fill();
  c.strokeStyle = C.deep; c.lineWidth = S * 0.045; body(); c.stroke();
  if(col === 0){ c.fillStyle = 'rgba(255,240,200,.75)'; for(const [fx, fy] of [[-0.5, 0.45], [0.55, 0.4], [0.05, 0.7]]){ circ(c, cx + fx * R, cy + fy * R, S * 0.018); c.fill(); } }
  // face
  const ey = cy - R * 0.08, ex = R * 0.42, er = R * (mood === 1 ? 0.3 : 0.25);
  if(mood === 2){
    c.strokeStyle = C.deep; c.lineWidth = S * 0.05; c.lineCap = 'round';
    for(const sx of [-1, 1]){ c.beginPath(); c.arc(cx + sx * ex, ey + er * 0.3, er * 0.8, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    c.fillStyle = C.deep; c.beginPath(); c.arc(cx, cy + R * 0.3, R * 0.3, 0, Math.PI); c.fill();
    c.fillStyle = 'rgba(255,120,150,.5)'; circ(c, cx - R * 0.7, cy + R * 0.25, R * 0.14); c.fill(); circ(c, cx + R * 0.7, cy + R * 0.25, R * 0.14); c.fill();
    return;
  }
  for(const sx of [-1, 1]){
    c.fillStyle = '#fff'; ell(c, cx + sx * ex, ey, er, er * 1.12); c.fill();
    c.strokeStyle = C.deep; c.lineWidth = S * 0.025; ell(c, cx + sx * ex, ey, er, er * 1.12); c.stroke();
    c.fillStyle = '#231433'; circ(c, cx + sx * ex + (mood === 1 ? 0 : -sx * er * 0.2), ey + er * (mood === 1 ? 0 : 0.25), er * (mood === 1 ? 0.35 : 0.52)); c.fill();
    c.fillStyle = '#fff'; circ(c, cx + sx * ex - er * 0.2, ey - er * 0.1, er * 0.16); c.fill();
  }
  c.strokeStyle = C.deep; c.lineWidth = S * 0.05; c.lineCap = 'round';
  c.beginPath();
  if(mood === 1){   // worried brows go up in the middle
    c.moveTo(cx - ex - er, ey - er * 1.25); c.lineTo(cx - ex + er * 0.8, ey - er * 1.6);
    c.moveTo(cx + ex + er, ey - er * 1.25); c.lineTo(cx + ex - er * 0.8, ey - er * 1.6);
  } else {          // grumpy brows slope down to the middle
    c.moveTo(cx - ex - er, ey - er * 1.55); c.lineTo(cx - ex + er * 0.9, ey - er * 1.05);
    c.moveTo(cx + ex + er, ey - er * 1.55); c.lineTo(cx + ex - er * 0.9, ey - er * 1.05);
  }
  c.stroke();
  c.beginPath();
  if(mood === 1){ c.fillStyle = C.deep; ell(c, cx, cy + R * 0.48, R * 0.16, R * 0.2); c.fill(); }
  else { c.arc(cx, cy + R * 0.72, R * 0.32, Math.PI * 1.2, Math.PI * 1.8); c.stroke(); }
  if(mood === 1){ c.fillStyle = '#bfefff'; c.beginPath(); c.moveTo(cx + R * 1.0, cy - R * 0.75); c.quadraticCurveTo(cx + R * 1.25, cy - R * 0.35, cx + R * 1.0, cy - R * 0.25); c.quadraticCurveTo(cx + R * 0.78, cy - R * 0.35, cx + R * 1.0, cy - R * 0.75); c.fill(); }
}
function gloomySprite(col, mood, s){ const S = s * 1.5; return sprite('g' + col + '_' + mood + '_' + s, S, S, c => paintGloomy(c, S, col, mood)); }
/* draw a Gloomy centred on (x, y), dancing to the beat */
function drawGloomy(c, x, y, s, col, mood, beat, ix, scaleUp){
  const bi = Math.floor(beat), ph = beat - bi, side = ((bi + col) % 2) ? 1 : -1;
  const bounce = Math.sin(ph * Math.PI), sq = 0.08 * (1 - bounce);
  let ang = side * 0.12 * bounce, dx = 0;
  if(mood === 1){ dx = Math.sin(G.time * 42 + ix) * s * 0.05; ang *= 0.4; }
  const k = scaleUp || 1, spr = gloomySprite(col, mood, s), S = s * 1.5;
  c.save(); c.translate(x + dx, y + s * 0.42); c.rotate(ang); c.scale(k * (1 + sq), k * (1 - sq));
  c.drawImage(spr, -S / 2, -S * 0.56 - s * 0.42 - bounce * s * 0.06, S, S);
  c.restore();
}
function nervous(b, x, y, col){
  const W = b.W, H = b.H, g = b.g, at = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H ? g[yy * W + xx] : 0;
  let occ = 0; for(const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if(at(x + dx, y + dy)) occ++;
  if(occ >= 3) return true;
  for(const [dx, dy] of [[1, 0], [0, 1]]){
    let n = 1;
    for(const sgn of [1, -1]) for(let k = 1; k < 4; k++){ const v = at(x + dx * k * sgn, y + dy * k * sgn); if(v && sameCol(col, colOf(v))) n++; else break; }
    if(n >= 3) return true;
  }
  return false;
}

/* ---------- Layout: where each beaker goes ---------- */
function layout(){
  const n = G.boards.length, L = [];
  if(!n) return L;
  if(MD() === 'coop'){
    const b = G.boards[0], cs = b.W <= 12 ? 11 : b.W <= 16 ? 10 : 9, w = b.W * cs, h = b.H * cs;
    const x = Math.round(Math.min(VW - w - 14, 150 + (VW - 150 - w) / 2));
    L.push({ x, y: Math.round((VH - h) / 2) + 6, cs, w, h, kind: 'coop' });
  } else if(n === 1) L.push({ x: 148, y: 28, cs: 11, w: 88, h: 176, kind: 'solo' });
  else if(n === 2){ L.push({ x: 84, y: 30, cs: 11, w: 88, h: 176, kind: 'left' }); L.push({ x: 212, y: 30, cs: 11, w: 88, h: 176, kind: 'right' }); }
  else { const cw = VW / n, cs = n === 3 ? 10 : 9, w = BW * cs, h = BH * cs; for(let i = 0; i < n; i++) L.push({ x: Math.round(i * cw + (cw - w) / 2), y: VH - h - 8, cs, w, h, kind: 'top' }); }
  return L;
}

/* ---------- The candy lab ---------- */
let bgCv = null, bgKey = '';
function paintLab(c){
  const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, '#6a55cf'); g.addColorStop(0.55, '#a86fd6'); g.addColorStop(1, '#ee8cc0');
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  // wall tiles
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 0.5;
  for(let x = 0; x <= VW; x += 16){ c.beginPath(); c.moveTo(x, 0); c.lineTo(x, VH - 18); c.stroke(); }
  for(let y = 0; y <= VH - 18; y += 16){ c.beginPath(); c.moveTo(0, y); c.lineTo(VW, y); c.stroke(); }
  // soft bokeh bubbles
  const R = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for(let i = 0; i < 26; i++){ c.fillStyle = 'rgba(255,255,255,' + (0.04 + R(i) * 0.06) + ')'; circ(c, R(i + 50) * VW, R(i + 90) * (VH - 30), 4 + R(i + 7) * 16); c.fill(); }
  // top shelf with flasks
  c.fillStyle = '#5a3a8a'; c.fillRect(0, 13, VW, 3); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 16, VW, 2);
  const flask = (x, col, kind) => {
    const C = COLS[col];
    c.fillStyle = 'rgba(255,255,255,.35)'; c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.6;
    if(kind === 0){ c.beginPath(); c.moveTo(x - 1.5, 3); c.lineTo(x + 1.5, 3); c.lineTo(x + 1.5, 7); c.lineTo(x + 5, 13); c.lineTo(x - 5, 13); c.lineTo(x - 1.5, 7); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = C.main; c.beginPath(); c.moveTo(x - 3.2, 10); c.lineTo(x + 3.2, 10); c.lineTo(x + 4.6, 12.6); c.lineTo(x - 4.6, 12.6); c.closePath(); c.fill(); }
    else if(kind === 1){ c.fillRect(x - 1.3, 2, 2.6, 6); circ(c, x, 9.5, 3.5); c.fill(); c.stroke(); c.fillStyle = C.main; c.beginPath(); c.arc(x, 9.5, 3, 0.1, Math.PI - 0.1); c.fill(); }
    else { rr(c, x - 1.6, 3, 3.2, 10, 1.5); c.fill(); c.stroke(); c.fillStyle = C.main; rr(c, x - 1.2, 7, 2.4, 5.6, 1.2); c.fill(); }
  };
  for(let i = 0; i < 16; i++) flask(10 + i * 24 + (R(i + 200) - 0.5) * 6, i % 3, (i * 7) % 3);
  // lab counter / floor
  c.fillStyle = '#4a2f78'; c.fillRect(0, VH - 18, VW, 18);
  c.fillStyle = '#6d4aa6'; c.fillRect(0, VH - 18, VW, 2);
  for(let x = 0; x < VW; x += 12){ c.fillStyle = (x / 12) % 2 ? 'rgba(255,170,210,.16)' : 'rgba(255,255,255,.06)'; c.fillRect(x, VH - 16, 12, 16); }
}
function drawBG(c){
  const s = display.scale, key = canvas.width + 'x' + canvas.height;
  if(bgKey !== key){ bgKey = key; bgCv = document.createElement('canvas'); bgCv.width = canvas.width; bgCv.height = canvas.height; const b = bgCv.getContext('2d'); b.scale(s, s); paintLab(b); }
  c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(bgCv, 0, 0); c.setTransform(s, 0, 0, s, 0, 0);
  // little bubbles rising out of the shelf flasks
  for(let i = 0; i < 16; i++){
    const ph = (G.time * 0.6 + i * 0.37) % 1, x = 10 + i * 24 + Math.sin(G.time * 2 + i) * 1.2;
    c.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - ph)) + ')'; circ(c, x, 3 - ph * 4 + 1, 0.8 + ph * 0.6); c.fill();
  }
}

/* ---------- Beakers ---------- */
function drawBeaker(c, L, b, bi){
  const { x, y, w, h } = L;
  c.fillStyle = 'rgba(30,8,50,.35)'; rrC(c, x - 1, y + 2, w + 6, h + 4, 1, 1, 8, 8); c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#2c2166'); g.addColorStop(1, '#150f38');
  c.fillStyle = g; rrC(c, x - 1.5, y - 1, w + 3, h + 2.5, 0.5, 0.5, 7, 7); c.fill();
  if(b.danger && !b.done && !b.out){
    const a = 0.25 + 0.15 * Math.sin(G.time * 8);
    const dg = c.createLinearGradient(0, y, 0, y + L.cs * 4); dg.addColorStop(0, 'rgba(255,70,110,' + a + ')'); dg.addColorStop(1, 'rgba(255,70,110,0)');
    c.fillStyle = dg; c.fillRect(x, y, w, L.cs * 4);
  }
  // dots on the cell grid
  c.fillStyle = 'rgba(255,255,255,.06)';
  for(let yy = 1; yy < b.H; yy++) for(let xx = 1; xx < b.W; xx++){ c.fillRect(x + xx * L.cs - 0.3, y + yy * L.cs - 0.3, 0.6, 0.6); }
  // fizz bubbles rising in the liquid
  for(let i = 0; i < 7; i++){
    const ph = (G.time * (0.12 + (i % 3) * 0.05) + i * 0.27 + bi * 0.13) % 1;
    const bx = x + ((i * 37 + bi * 11) % 100) / 100 * w, by = y + h - ph * h;
    c.strokeStyle = 'rgba(200,230,255,' + (0.28 * (1 - ph)) + ')'; c.lineWidth = 0.5; circ(c, bx + Math.sin(G.time * 3 + i) * 1.2, by, 0.8 + (i % 3) * 0.4); c.stroke();
  }
}
function drawGlass(c, L, b, tint){
  const { x, y, w, h } = L;
  c.strokeStyle = 'rgba(236,244,255,.85)'; c.lineWidth = 1.5; rrC(c, x - 2.5, y - 2, w + 5, h + 4.5, 0.5, 0.5, 8, 8); c.stroke();
  c.beginPath(); c.moveTo(x - 6, y - 4); c.lineTo(x - 2.5, y - 2); c.moveTo(x + w + 6, y - 4); c.lineTo(x + w + 2.5, y - 2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(x + 1.6, y + 6); c.lineTo(x + 1.6, y + h * 0.55); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.5;
  for(let r = 2; r < b.H; r += 2){ const yy = y + r * L.cs, len = r % 4 === 0 ? 3 : 1.6; c.beginPath(); c.moveTo(x + w + 2.5, yy); c.lineTo(x + w + 2.5 + len, yy); c.stroke(); }
  if(tint){ c.fillStyle = tint; rr(c, x + w / 2 - 14, y + h + 3.4, 28, 2.2, 1.1); c.fill(); }
}
function cellXY(L, x, y){ return [L.x + x * L.cs, L.y + y * L.cs]; }
function drawCells(c, L, b, beat){
  const cs = L.cs, pop = b.phase === 'pop' ? new Set(b.popCells) : null, popK = b.phase === 'pop' ? clamp(b.t / POP_T, 0, 1) : 0;
  const appear = G.state === 'intro' ? clamp(G.stateT / 1.1, 0, 1) : 1, showN = Math.ceil(appear * b.gl);
  let rank = 0;
  for(let y = b.H - 1; y >= 0; y--) for(let x = 0; x < b.W; x++){
    const i = y * b.W + x, v = b.g[i]; if(!v) continue;
    const [px, py] = cellXY(L, x, y), popping = pop && pop.has(i);
    if(isGl(v)){
      const k = rank++; if(k >= showN && !popping) continue;
      const col = v - 1, mood = popping ? 2 : nervous(b, x, y, col) ? 1 : 0;
      const grow = popping ? 1 + popK * 0.35 : appear < 1 ? clamp((appear * b.gl - k) * 0.8, 0, 1) : 1;
      if(popping) c.globalAlpha = 1 - popK * popK;
      drawGloomy(c, px + cs / 2, py + cs / 2, cs, col, mood, beat, i, grow);
      c.globalAlpha = 1;
    } else {
      const col = colOf(v), link = linkOf(v);
      if(popping){ c.globalAlpha = 1 - popK * 0.7; }
      c.drawImage(halfSprite(col, link, cs), px, py, cs, cs);
      if(popping){ c.globalAlpha = 0.8 * Math.abs(Math.sin(popK * Math.PI * 3)); c.fillStyle = '#fff'; rr(c, px + 1, py + 1, cs - 2, cs - 2, cs * 0.4); c.fill(); }
      c.globalAlpha = 1;
    }
  }
}
function drawPieceAt(c, L, pc, alpha){
  const cs = L.cs;
  c.globalAlpha = alpha === undefined ? 1 : alpha;
  for(const [x, y, col, link] of pieceCells(pc)){
    const [px, py] = cellXY(L, x, y);
    if(pc.a === BOMB){ c.drawImage(bombSprite(cs), px, py, cs, cs); continue; }
    c.drawImage(halfSprite(col, link, cs), px, py, cs, cs);
  }
  c.globalAlpha = 1;
}
function drawGhost(c, L, b, p){
  const gp = ghostOf(b, p.piece); if(gp.y === p.piece.y) return;
  const cs = L.cs, big = G.kids, pulse = 0.5 + 0.5 * Math.sin(G.time * 6);
  if(gp.a === BOMB){
    const [px, py] = cellXY(L, gp.x - 1, gp.y - 1);
    c.strokeStyle = 'rgba(200,170,255,' + (0.5 + pulse * 0.3) + ')'; c.lineWidth = 0.8; c.setLineDash([1.5, 1.5]); rr(c, px + 0.5, py + 0.5, cs * 3 - 1, cs * 3 - 1, 2); c.stroke(); c.setLineDash([]);
    return;
  }
  for(const [x, y, col] of pieceCells(gp)){
    const [px, py] = cellXY(L, x, y), m = colMain(col);
    if(big){
      c.globalAlpha = 0.28 + pulse * 0.12; c.fillStyle = m; rr(c, px + 0.8, py + 0.8, cs - 1.6, cs - 1.6, cs * 0.4); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = m; c.lineWidth = 1.3; rr(c, px + 0.8, py + 0.8, cs - 1.6, cs - 1.6, cs * 0.4); c.stroke();
    } else {
      c.globalAlpha = 0.14; c.fillStyle = m; rr(c, px + 1, py + 1, cs - 2, cs - 2, cs * 0.4); c.fill(); c.globalAlpha = 0.75;
      c.strokeStyle = m; c.lineWidth = 0.7; c.setLineDash([1.4, 1.2]); rr(c, px + 1, py + 1, cs - 2, cs - 2, cs * 0.4); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    }
  }
}
function drawPlayerPiece(c, L, b, p, coop){
  if(!p.piece) return;
  drawGhost(c, L, b, p);
  if(coop){
    c.strokeStyle = p.color; c.lineWidth = 1.2; c.globalAlpha = 0.8 + 0.2 * Math.sin(G.time * 7);
    for(const [x, y] of pieceCells(p.piece)){ const [px, py] = cellXY(L, x, y); rr(c, px - 0.4, py - 0.4, L.cs + 0.8, L.cs + 0.8, L.cs * 0.45); c.stroke(); }
    c.globalAlpha = 1;
  }
  drawPieceAt(c, L, p.piece);
  if(coop){
    const cells = pieceCells(p.piece), top = Math.min(...cells.map(q => q[1])), cx = cells.reduce((s, q) => s + q[0], 0) / cells.length;
    const [px, py] = cellXY(L, cx, top); const nm = p.name.toUpperCase();
    outlined(c, nm, px + L.cs / 2, py - 3.5, fitText(c, nm, 40, 4), p.color);
  }
}
/* a capsule shown in a NEXT / HOLD box */
function drawMini(c, cx, cy, t, s){
  if(!t) return;
  if(t.single){ c.drawImage(bombSprite(s), cx - s / 2, cy - s / 2, s, s); return; }
  c.drawImage(halfSprite(t.a, L_R, s), cx - s, cy - s / 2, s, s);
  c.drawImage(halfSprite(t.b, L_L, s), cx, cy - s / 2, s, s);
}
function box(c, x, y, w, h, label, t, s, dim){
  card(c, x, y, w, h);
  text(c, label, x + 3, y + 2.2, 3.8, 'rgba(255,230,250,.75)');
  c.globalAlpha = dim ? 0.4 : 1; drawMini(c, x + w / 2, y + h / 2 + 2.4, t, s); c.globalAlpha = 1;
}
function miniGloomyRow(c, x, y, b, s){
  for(let k = 0; k < 3; k++){ drawGloomy(c, x + k * (s * 5), y, s, k, 0, beatNow(), k); outlined(c, '×' + (b.cnt[k] || 0), x + k * (s * 5) + s * 0.9, y + 0.5, s * 0.72, '#fff', 'left'); }
}
function starsRow(c, x, y, n, r, align){
  const w = r * 2.8, x0 = align === 'right' ? x - w * 2 + r : align === 'center' ? x - w / 2 : x + r;
  for(let i = 0; i < 2; i++){ const on = i < n; c.fillStyle = on ? '#ffd84a' : 'rgba(255,255,255,.18)'; star5(c, x0 + i * w, y, r, r * 0.45); c.fill(); if(on){ c.strokeStyle = '#8a5a00'; c.lineWidth = 0.4; star5(c, x0 + i * w, y, r, r * 0.45); c.stroke(); } }
}
function pendingPips(c, L, p){
  const n = p.pending.length; if(!n) return;
  for(let i = 0; i < n; i++){ const px = L.x + L.w / 2 - (n - 1) * 3 + i * 6, py = L.y - 6.5 + Math.sin(G.time * 10 + i) * 0.6;
    c.fillStyle = '#ff6b9a'; circ(c, px, py, 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 0.5; circ(c, px, py, 2); c.stroke(); }
}

/* ---------- Kid scientists ---------- */
const SKIN = ['#ffd9b8', '#e8b48a', '#c68b5e', '#8d5a3b'], HAIR = ['#4a2c1a', '#1c1c28', '#e0a340', '#7a3b1f'];
function drawKid(c, x, y, s, p, mood){
  const slot = p.slot || 0, col = p.color, up = p.throwT > 0, won = mood === 'won', sad = mood === 'out';
  const bob = won ? Math.abs(Math.sin(G.time * 6)) * 2 : Math.sin(beatNow() * Math.PI) * 0.4;
  c.save(); c.translate(x, y - bob); c.scale(s, s);
  c.fillStyle = '#3b3355'; rr(c, -4, -9, 3.2, 9, 1); c.fill(); rr(c, 0.8, -9, 3.2, 9, 1); c.fill();
  c.fillStyle = '#231c35'; ell(c, -2.4, 0, 2.8, 1.3); c.fill(); ell(c, 2.4, 0, 2.8, 1.3); c.fill();
  // lab coat
  c.fillStyle = '#f5f4ff'; c.strokeStyle = '#8f86b8'; c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(-6.5, -7); c.lineTo(6.5, -7); c.lineTo(4.8, -20); c.lineTo(-4.8, -20); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = '#c9c3e6'; c.beginPath(); c.moveTo(0, -20); c.lineTo(0, -7); c.stroke();
  c.fillStyle = col; rr(c, 1.5, -15, 3, 2.4, 0.5); c.fill();
  c.fillStyle = '#f5f4ff'; c.strokeStyle = '#8f86b8';
  const arm = (sx, raise) => { c.save(); c.translate(sx * 4.6, -18.5); c.rotate(raise ? sx * -2.4 : sx * 0.25); rr(c, -1.3, 0, 2.6, 8, 1.2); c.fill(); c.stroke(); c.fillStyle = SKIN[slot]; circ(c, 0, 8.4, 1.5); c.fill(); c.fillStyle = '#f5f4ff'; c.restore(); };
  arm(-1, won); arm(1, up || won);
  // head
  c.fillStyle = SKIN[slot]; circ(c, 0, -25, 6); c.fill();
  c.fillStyle = HAIR[slot];
  c.beginPath(); c.arc(0, -26, 6.3, Math.PI * 1.02, Math.PI * 1.98); c.fill();
  if(slot === 1){ circ(c, 5.6, -24, 2.2); c.fill(); circ(c, -5.6, -24, 2.2); c.fill(); }
  if(slot === 2){ c.beginPath(); c.moveTo(-6, -27); c.quadraticCurveTo(-8.5, -20, -6, -17); c.lineTo(-5, -24); c.fill(); c.beginPath(); c.moveTo(6, -27); c.quadraticCurveTo(8.5, -20, 6, -17); c.lineTo(5, -24); c.fill(); }
  if(slot === 3){ for(let i = -2; i <= 2; i++){ circ(c, i * 2.4, -31.5, 1.6); c.fill(); } }
  // goggles pushed up on the forehead, in the player's colour
  c.fillStyle = col; c.fillRect(-6.2, -29.4, 12.4, 1.8);
  for(const sx of [-1, 1]){ c.fillStyle = col; circ(c, sx * 2.6, -28.5, 2.3); c.fill(); c.fillStyle = '#bff3ff'; circ(c, sx * 2.6, -28.5, 1.5); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; circ(c, sx * 2.6 - 0.5, -29, 0.5); c.fill(); }
  c.fillStyle = '#2a1a33'; circ(c, -2.2, -24.3, 0.75); c.fill(); circ(c, 2.2, -24.3, 0.75); c.fill();
  c.strokeStyle = '#2a1a33'; c.lineWidth = 0.6; c.beginPath();
  if(sad) c.arc(0, -19.6, 1.6, Math.PI * 1.15, Math.PI * 1.85); else c.arc(0, -22.2, 1.9, 0.2, Math.PI - 0.2);
  c.stroke();
  c.fillStyle = 'rgba(255,120,140,.35)'; circ(c, -3.8, -22.4, 1); c.fill(); circ(c, 3.8, -22.4, 1); c.fill();
  c.restore();
}
function kidMood(p){ return p.state === 'won' || boardOf(p) && boardOf(p).done ? 'won' : p.state === 'out' ? 'out' : ''; }

/* ---------- Panels ---------- */
function drawSoloPanels(c, L, b, p){
  const md = MD(), beat = beatNow();
  // left: level / score card
  card(c, 12, 28, 124, 78);
  if(md === 'puzzle'){
    const pz = PUZZLES[G.pz];
    outlined(c, 'PUZZLE ' + (G.pz + 1), 74, 37, 7, '#ffe27a');
    outlined(c, pz.name.toUpperCase(), 74, 47, fitText(c, pz.name.toUpperCase(), 112, 4.8), '#fff');
    text(c, 'CAPSULES', 20, 56, 4.2, 'rgba(255,230,250,.75)');
    outlined(c, p.used + ' / ' + puzzleLimit(), 128, 58, 6.5, p.used > pz.par ? '#ffb3c8' : '#fff', 'right');
    text(c, 'PAR (GOLD)', 20, 68, 4.2, 'rgba(255,230,250,.75)');
    outlined(c, String(pz.par + (G.kids ? 1 : 0)), 128, 70, 6.5, '#ffe27a', 'right');
    const m = A.Medals.get(GAME, 'pz' + (G.pz + 1)); text(c, 'BEST', 20, 80, 4.2, 'rgba(255,230,250,.75)');
    if(m) A.Medals.draw(c, 124, 83, 3.4, m); else outlined(c, '—', 128, 82, 5, '#fff', 'right');
    text(c, G.kids ? 'KIDS' : SP().label.toUpperCase() + ' SPEED', 20, 93, 4.2, 'rgba(255,230,250,.6)');
  } else if(md === 'daily'){
    outlined(c, 'LAB PUZZLE', 74, 37, 6.5, '#ffe27a');
    outlined(c, G.daily || today(), 74, 47, 4.6, '#fff');
    text(c, 'TIME', 20, 56, 4.2, 'rgba(255,230,250,.75)'); outlined(c, fmt(b.time), 128, 58, 6.5, '#fff', 'right');
    const best = dailyRuns().filter(r => r.t).sort((x, y) => x.t - y.t)[0];
    text(c, 'FAMILY BEST', 20, 68, 4.2, 'rgba(255,230,250,.75)'); outlined(c, best ? fmt(best.t) : '—', 128, 70, 6, '#ffe27a', 'right');
    if(best){ const nm = best.n.toUpperCase(); outlined(c, nm, 128, 79, fitText(c, nm, 60, 4.2), '#ffe27a', 'right'); }
    text(c, p.practice ? 'PRACTICE RUN' : 'ONE TRY TODAY!', 20, 92, 4.2, p.practice ? 'rgba(255,230,250,.6)' : '#7dffcf');
  } else {
    text(c, 'LEVEL', 20, 34, 4.2, 'rgba(255,230,250,.75)'); outlined(c, String(G.level), 128, 38, 9, '#ffe27a', 'right');
    text(c, 'SPEED', 20, 50, 4.2, 'rgba(255,230,250,.75)'); outlined(c, SP().label.toUpperCase() + (G.kids ? ' · KIDS' : ''), 128, 52, 5.2, '#fff', 'right');
    text(c, 'SCORE', 20, 62, 4.2, 'rgba(255,230,250,.75)'); outlined(c, G.score.toLocaleString(), 128, 66, 7, '#fff', 'right');
    const top = A.Store.get('best.' + GAME + '.score.' + diffKey(), 0) || 0;
    text(c, 'TOP', 20, 78, 4.2, 'rgba(255,230,250,.75)'); outlined(c, Math.max(top, G.score).toLocaleString(), 128, 82, 5.5, '#ffe27a', 'right');
    text(c, fmt(b.time), 20, 93, 4.2, 'rgba(255,230,250,.6)');
  }
  // left: the Gloomy flask, the three big Gloomies dance (and look worried when their colour is nearly gone)
  const fx = 74, fy = 162;
  c.fillStyle = 'rgba(40,20,80,.55)'; circ(c, fx, fy, 38); c.fill();
  const lg = c.createLinearGradient(0, fy - 20, 0, fy + 38); lg.addColorStop(0, 'rgba(120,230,210,.45)'); lg.addColorStop(1, 'rgba(60,160,190,.55)');
  c.save(); circ(c, fx, fy, 37); c.clip(); c.fillStyle = lg; c.fillRect(fx - 40, fy - 6 + Math.sin(G.time * 2) * 1.2, 80, 50);
  for(let i = 0; i < 6; i++){ const ph = (G.time * 0.3 + i * 0.17) % 1; c.strokeStyle = 'rgba(255,255,255,' + 0.4 * (1 - ph) + ')'; c.lineWidth = 0.6; circ(c, fx - 26 + i * 10, fy + 36 - ph * 40, 1.2); c.stroke(); }
  c.restore();
  c.strokeStyle = 'rgba(236,244,255,.85)'; c.lineWidth = 1.5; circ(c, fx, fy, 38); c.stroke();
  c.fillStyle = 'rgba(40,20,80,.55)'; c.fillRect(fx - 8, fy - 52, 16, 16); c.strokeRect(fx - 8, fy - 52, 16, 16);
  const spots = [[fx - 18, fy + 8], [fx + 18, fy + 8], [fx, fy - 12]];
  for(let k = 0; k < 3; k++){
    const n = b.cnt[k] || 0, [gx, gy] = spots[k];
    if(n > 0) drawGloomy(c, gx, gy, 20, k, n <= 3 ? 1 : 0, beat, k);
    else { c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * Math.sin(G.time * 5 + k)) + ')'; star5(c, gx, gy, 5, 2); c.fill(); }
  }
  // right: next, hold, kid
  box(c, 248, 28, 58, 30, 'NEXT', p.next[0], 10);
  if(holdOn() && md !== 'puzzle') box(c, 312, 28, 58, 30, A.Input.isTouch ? 'HOLD (SWIPE UP)' : 'HOLD (HOLD ▲)', p.hold, 10, p.holdUsed);
  if(md === 'puzzle'){
    // puzzles show every capsule still to come
    card(c, 312, 28, 58, 96); text(c, 'COMING UP', 315, 30.2, 3.8, 'rgba(255,230,250,.75)');
    const caps = PUZZLES[G.pz].caps.trim().split(/\s+/);
    for(let k = 1; k < 8; k++){ const n = p.used + 1 + k; if(n >= puzzleLimit()) break; const cap = parseCap(caps[n % caps.length]); c.globalAlpha = k === 1 ? 1 : 0.8; drawMini(c, 341, 40 + (k - 1) * 11.5, cap, 8); c.globalAlpha = 1; }
  }
  card(c, 248, 64, 58, 28);
  text(c, 'LEFT', 251, 66.2, 3.8, 'rgba(255,230,250,.75)');
  outlined(c, String(b.gl), 277, 82, 9, b.gl <= 3 ? '#7dffcf' : '#fff');
  const nm = p.name.toUpperCase();
  drawKid(c, md === 'puzzle' ? 277 : 330, 196, 1.45, p, kidMood(p));
  outlined(c, nm, md === 'puzzle' ? 277 : 330, VH - 8, fitText(c, nm, 70, 5.5), p.color);
  if(!A.Input.isTouch && G.state === 'play' && G.stateT < 6 && G.net !== 'guest') text(c, 'DOUBLE-TAP ▼ DROP · ESC PAUSE', 248, 100, 3.6, 'rgba(255,255,255,.6)');
}
function drawSidePanel(c, L, b, p, right){
  const x0 = right ? L.x + L.w + 10 : 8, w = right ? VW - 8 - x0 : L.x - 18;
  const cx = x0 + w / 2;
  const nm = p.name.toUpperCase();
  outlined(c, nm, cx, 34, fitText(c, nm, w - 4, 6.5), p.color);
  if(MD() === 'versus') starsRow(c, cx, 44, p.stars, 3.6, 'center');
  box(c, x0, 52, w, 26, 'NEXT', p.next[0], 9);
  if(holdOn()) box(c, x0, 82, w, 26, 'HOLD', p.hold, 9, p.holdUsed);
  card(c, x0, 112, w, 24); text(c, 'LEFT', x0 + 3, 114, 3.8, 'rgba(255,230,250,.75)'); outlined(c, String(b.gl), cx, 128, 8, b.gl <= 3 ? '#7dffcf' : '#fff');
  if(MD() === 'daily') outlined(c, fmt(b.time), cx, 144, 5.5, '#fff');
  drawKid(c, cx, 200, 1.25, p, kidMood(p));
}
function drawTopPanel(c, L, b, p){
  const x0 = L.x - 6, w = L.w + 12, y0 = L.y - 50;
  const nm = p.name.toUpperCase();
  c.fillStyle = 'rgba(34,16,64,.55)'; rr(c, x0, y0 + 1, w, 9, 3); c.fill();
  outlined(c, nm, x0 + 3, y0 + 5.8, fitText(c, nm, w - (MD() === 'versus' ? 26 : 6), 5.5), p.color, 'left');
  if(MD() === 'versus') starsRow(c, x0 + w - 3, y0 + 5.6, p.stars, 3, 'right');
  const hw = holdOn() ? (w - 3) / 2 : w;
  box(c, x0, y0 + 13, hw, 22, 'NEXT', p.next[0], 7.5);
  if(holdOn()) box(c, x0 + hw + 3, y0 + 13, hw, 22, 'HOLD', p.hold, 7.5, p.holdUsed);
  drawGloomy(c, x0 + 6, y0 + 41, 7, 0, 0, beatNow(), 1);
  outlined(c, '×' + b.gl + (MD() === 'daily' ? '  ' + fmt(b.time) : ''), x0 + 12, y0 + 41.5, 5, b.gl <= 3 ? '#7dffcf' : '#fff', 'left');
}
function drawCoopPanel(c, L, b){
  const w = Math.min(128, L.x - 18), x0 = L.x - 14 - w;
  card(c, x0, 22, w, 40);
  outlined(c, 'BIG BEAKER', x0 + w / 2, 28, 5, '#7dffcf');
  text(c, 'LEVEL', x0 + 4, 35, 4, 'rgba(255,230,250,.75)'); outlined(c, String(G.level), x0 + 30, 38, 6.5, '#ffe27a', 'right');
  text(c, 'SCORE', x0 + w / 2 - 4, 35, 4, 'rgba(255,230,250,.75)'); outlined(c, G.score.toLocaleString(), x0 + w - 4, 38, 5.5, '#fff', 'right');
  miniGloomyRow(c, x0 + 12, 52, b, 7);
  const n = b.players.length, rowH = Math.min(38, (VH - 72) / Math.max(1, n));
  b.players.forEach((p, i) => {
    const y = 68 + i * rowH, hw = (w - 38) / 2;
    card(c, x0, y, w, rowH - 4, p.color);
    drawKid(c, x0 + 14, y + rowH - 6, rowH > 36 ? 0.95 : 0.8, p, kidMood(p));
    const nm = p.name.toUpperCase(); outlined(c, nm, x0 + 30, y + 6, fitText(c, nm, w - 34, 5), p.color, 'left');
    drawMini(c, x0 + 30 + hw / 2, y + rowH / 2 + 3, p.next[0], 8);
    if(holdOn()){ c.globalAlpha = p.holdUsed ? 0.4 : 1; drawMini(c, x0 + 34 + hw * 1.5, y + rowH / 2 + 3, p.hold, 8); c.globalAlpha = 1;
      text(c, 'HOLD', x0 + 34 + hw, y + rowH / 2 - 5, 3.2, 'rgba(255,230,250,.6)'); }
    text(c, 'NEXT', x0 + 30, y + rowH / 2 - 5, 3.2, 'rgba(255,230,250,.6)');
  });
}

/* ---------- Title-screen lab board: medals for level bands and puzzles ---------- */
function boardFits(){
  const panel = document.querySelector('.ui-layer:not([hidden]) .menu-panel'); if(!panel) return false;
  const r = panel.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  return cr.left + (VW - 132) / VW * cr.width > r.right + 8;
}
function drawMedalBoard(c){
  const x = VW - 128, y = 22, w = 120, h = 176;
  c.fillStyle = 'rgba(30,14,60,.84)'; rr(c, x, y, w, h, 6); c.fill();
  c.strokeStyle = 'rgba(255,210,240,.5)'; c.lineWidth = 0.8; rr(c, x, y, w, h, 6); c.stroke();
  outlined(c, 'LAB MEDALS', x + w / 2, y + 9, 5.5, '#ffe27a');
  text(c, 'LEVELS', x + 8, y + 18, 4, 'rgba(255,230,250,.75)');
  BANDS.forEach((n, i) => { const mx = x + 18 + i * 28; A.Medals.draw(c, mx, y + 36, 5, A.Medals.get(GAME, 'lv' + n)); outlined(c, (n - 4) + '-' + n, mx, y + 46, 3.8, '#fff'); });
  text(c, 'PUZZLES', x + 8, y + 54, 4, 'rgba(255,230,250,.75)');
  const open = puzzleOpen();
  for(let i = 0; i < 30; i++){
    const cx = x + 14 + (i % 6) * 18.4, cy = y + 72 + Math.floor(i / 6) * 16, m = A.Medals.get(GAME, 'pz' + (i + 1));
    if(i >= open){ c.fillStyle = 'rgba(255,255,255,.12)'; circ(c, cx, cy, 3); c.fill(); continue; }
    A.Medals.draw(c, cx, cy + 1, 3.2, m);
    if(!m) text(c, String(i + 1), cx, cy + 1.2, 3, 'rgba(255,255,255,.5)', 'center', 'middle');
    if(G.mode === 'puzzle' && i === G.pz){ c.strokeStyle = '#ffe27a'; c.lineWidth = 0.7; circ(c, cx, cy + 0.5, 6); c.stroke(); }
  }
  const s = A.Medals.summary(GAME, 34);
  outlined(c, s.won + ' / 34', x + w / 2, y + h - 8, 5, '#fff');
}

/* ---------- Overlays ---------- */
function drawParticles(c, Ls){
  const stack = {};
  for(const q of live){
    const a = 1 - q.t / q.life;
    if(q.k === 'orb'){
      const A1 = Ls[q.from], B1 = Ls[q.to]; if(!A1 || !B1) continue;
      const k = q.t / q.life, sx = A1.x + A1.w / 2, sy = A1.y + A1.h * 0.4, ex = B1.x + B1.w / 2, ey = B1.y - 6;
      const px = sx + (ex - sx) * k, py = sy + (ey - sy) * k - Math.sin(k * Math.PI) * 30;
      q.cols.forEach((col, i) => { c.fillStyle = colMain(col); circ(c, px + (i - q.cols.length / 2) * 3, py, 2.2); c.fill(); });
      continue;
    }
    const L = Ls[q.bi]; if(!L) continue;
    const cs = L.cs, px = L.x + q.x * cs, py = L.y + q.y * cs;
    if(q.k === 'call'){
      const k = q.t / q.life, pop = Math.min(1, q.t * 7), size = (q.lvl >= 3 ? 9 : q.lvl >= 2 ? 8 : 6.5) * (0.6 + 0.4 * pop) * (L.cs / 11);
      c.globalAlpha = Math.min(1, (1 - k) * 3);
      const col = q.col || RAINBOW_COLS[Math.floor(G.time * 12) % RAINBOW_COLS.length];
      const slot = stack[q.bi] = (stack[q.bi] || 0) + 1;
      c.save(); c.translate(L.x + L.w / 2, L.y + L.h * 0.38 - k * 14 + (slot - 1) * 11 * (L.cs / 11)); c.rotate(Math.sin(q.t * 10) * 0.04);
      outlined(c, q.str, 0, 0, size, col); c.restore(); c.globalAlpha = 1; continue;
    }
    c.globalAlpha = Math.max(0, a);
    const col = q.col === BOMB ? '#c9a8ff' : q.col === RAINBOW ? RAINBOW_COLS[Math.floor(q.t * 20) % 6] : q.k === 'conf' ? RAINBOW_COLS[q.col % 6] : COLS[q.col >= 0 && q.col < 3 ? q.col : 0].main;
    if(q.k === 'bub'){ c.strokeStyle = col; c.lineWidth = 0.6; circ(c, px, py, q.r * cs); c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; circ(c, px - q.r * cs * 0.3, py - q.r * cs * 0.3, q.r * cs * 0.3); c.fill(); }
    else if(q.k === 'spark'){ c.fillStyle = col; star5(c, px, py, q.r * cs * 1.6, q.r * cs * 0.6); c.fill(); }
    else if(q.k === 'ring'){ c.strokeStyle = q.col === BOMB ? '#e2d2ff' : '#fff'; c.lineWidth = 1; circ(c, px, py, (q.r + q.t * 3) * cs); c.stroke(); }
    else if(q.k === 'puff'){ c.fillStyle = 'rgba(255,255,255,.5)'; circ(c, px, py, q.r * cs * (1 + q.t * 3)); c.fill(); }
    else if(q.k === 'trail'){ c.fillStyle = col; c.globalAlpha = a * 0.35; rr(c, px - cs * 0.3, py - cs * 0.5, cs * 0.6, cs, cs * 0.3); c.fill(); }
    else if(q.k === 'conf'){ c.fillStyle = col; c.save(); c.translate(px, py); c.rotate(q.rot); c.fillRect(-1.4, -0.8, 2.8, 1.6 * Math.abs(Math.cos(q.rot))); c.restore(); }
  }
  c.globalAlpha = 1;
}
function drawBanner(c, str, sub, col){
  c.fillStyle = 'rgba(28,12,48,.55)'; c.fillRect(0, VH / 2 - 20, VW, 40);
  outlined(c, str, VW / 2, VH / 2 - 3, 14, col || '#ffe27a');
  if(sub) outlined(c, sub, VW / 2, VH / 2 + 12, 5.5, '#fff');
}
function drawOverlays(c, Ls){
  const md = MD();
  if(G.state === 'intro'){
    const t = G.stateT, what = md === 'puzzle' ? 'PUZZLE ' + (G.pz + 1) : md === 'daily' ? 'TODAY’S LAB' : md === 'versus' ? 'ROUND ' + G.round : 'LEVEL ' + G.level;
    const sub = md === 'puzzle' ? 'Clear it in ' + (PUZZLES[G.pz] ? PUZZLES[G.pz].par : '?') + ' capsules for gold' : md === 'versus' ? 'Best of 3 · Level ' + G.level : md === 'coop' ? 'Big Beaker · work together!' : 'Line up 4 of a colour!';
    if(t < 1.15) drawBanner(c, what, sub);
    else drawBanner(c, 'FIZZ!', '', RAINBOW_COLS[Math.floor(G.time * 12) % 6]);
  }
  if(G.state === 'clear') drawBanner(c, md === 'puzzle' ? 'SOLVED!' : 'LAB CLEAN!', md === 'puzzle' ? PUZZLES[G.pz].name : 'Level ' + G.level + ' cleared!', '#7dffcf');
  if(G.state === 'roundEnd'){
    const w = G.players.find(p => p.slot === G.winner);
    if(w) drawBanner(c, w.name.toUpperCase() + (w.stars >= 2 ? ' WINS THE MATCH!' : ' WINS!'), 'Round ' + G.round, w.color);
    else drawBanner(c, 'DRAW!', 'Nobody gets a star');
  }
  G.boards.forEach((b, i) => {
    const L = Ls[i]; if(!L) return;
    if(b.out && G.state !== 'roundEnd' || (md === 'versus' && b.players.every(p => p.state === 'out'))){
      c.fillStyle = 'rgba(20,10,40,.55)'; c.fillRect(L.x, L.y, L.w, L.h); outlined(c, 'OUT', L.x + L.w / 2, L.y + L.h / 2, 9, '#ff9ab5');
    } else if(md === 'daily' && b.done){ c.fillStyle = 'rgba(20,10,40,.35)'; c.fillRect(L.x, L.y, L.w, L.h); outlined(c, fmt(b.time), L.x + L.w / 2, L.y + L.h / 2, 8, '#7dffcf'); }
  });
}

let shakeT = 0;
function render(dt){
  const c = display.ctx, s = display.scale;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0c10'; c.fillRect(0, 0, canvas.width, canvas.height);
  c.setTransform(s, 0, 0, s, 0, 0);
  drawBG(c);
  const frozen = G.state === 'paused' || G.state === 'results' || G.state === 'over';
  if(!frozen) fxStep(Math.min(dt, 0.05));
  if(!G.boards.length) return;
  if(G.shake > 0){ G.shake = Math.max(0, G.shake - dt); }
  const shx = G.shake > 0 ? (Math.random() - 0.5) * 3 * G.shake : 0;
  c.setTransform(s, 0, 0, s, Math.round(shx * s), 0);
  const Ls = layout(), md = MD(), beat = beatNow();
  G.boards.forEach((b, i) => {
    const L = Ls[i]; if(!L) return;
    drawBeaker(c, L, b, i);
    drawCells(c, L, b, beat);
    if(G.state === 'play' || G.state === 'paused' || G.state === 'intro') for(const p of b.players) if(p.piece) drawPlayerPiece(c, L, b, p, md === 'coop' && b.players.length > 1);
    drawGlass(c, L, b, md === 'coop' ? null : b.players[0] && b.players[0].color);
    for(const p of b.players) pendingPips(c, L, p);
  });
  G.boards.forEach((b, i) => {
    const L = Ls[i]; if(!L) return; const p = b.players[0]; if(!p) return;
    if(L.kind === 'solo') drawSoloPanels(c, L, b, p);
    else if(L.kind === 'left') drawSidePanel(c, L, b, p, false);
    else if(L.kind === 'right') drawSidePanel(c, L, b, p, true);
    else if(L.kind === 'top') drawTopPanel(c, L, b, p);
    else if(L.kind === 'coop') drawCoopPanel(c, L, b);
  });
  if(Ls.length === 2 && Ls[0].kind === 'left'){
    outlined(c, 'VS', VW / 2, 60, 8, '#ffe27a');
    outlined(c, 'LV ' + G.level, VW / 2, 74, 4.5, '#fff'); outlined(c, SP().label.toUpperCase(), VW / 2, 82, 4.5, '#fff');
    if(md === 'versus' && !G.demo) outlined(c, 'RND ' + G.round, VW / 2, 92, 4.5, '#fff');
  }
  drawParticles(c, Ls);
  c.setTransform(s, 0, 0, s, 0, 0);
  if(!G.demo) drawOverlays(c, Ls);
  if(G.demo){
    c.fillStyle = 'rgba(28,12,48,.4)'; c.fillRect(0, 0, VW, VH);
    if(G.state === 'title' && A.Menu.isOpen() && boardFits()) drawMedalBoard(c);
  }
}

/* ---------- Puzzle solver (checks par: the fewest capsules that clear a puzzle, straight drops only) ---------- */
function solvePuzzle(pz, maxD){
  const b = makeBoard(BW, BH); loadPuzzle(b, pz);
  const caps = pz.caps.trim().split(/\s+/).map(parseCap);
  let layer = [b.g.slice()], seen = new Set([b.g.join('')]);
  for(let d = 0; d < maxD; d++){
    const cap = caps[d % caps.length], next = [];
    for(const g0 of layer){
      const bb = { W: BW, H: BH, g: g0, players: null };
      const rots = cap.single ? [0] : [0, 1, 2, 3];
      for(const o of rots) for(let x = 0; x < BW; x++){
        const t = { x, y: 1, o, a: cap.a, b: cap.b, single: cap.single };
        if(blockedBy(bb, t)) continue;
        const d0 = dropY(bb, t);
        const sim = { W: BW, H: BH, g: g0.slice(), own: null };
        if(cap.single){
          const [cx, cy] = pieceCells(d0)[0], cells = [];
          for(let dy = -1; dy <= 1; dy++) for(let dx = -1; dx <= 1; dx++){ const xx = cx + dx, yy = cy + dy; if(xx >= 0 && yy >= 0 && xx < BW && yy < BH && sim.g[yy * BW + xx]) cells.push(yy * BW + xx); }
          removeCells(sim, cells); while(gravityStep(sim, null)){}
        } else for(const [x2, y2, col, l] of pieceCells(d0)) sim.g[y2 * BW + x2] = halfV(col, l);
        for(let k = 0; k < 12; k++){ const m = findMatches(sim); if(!m.cells.length) break; removeCells(sim, m.cells); while(gravityStep(sim, null)){} }
        if(!sim.g.some(isGl)) return { par: d + 1, first: { x, o } };
        const key = sim.g.join(''); if(seen.has(key)) continue; seen.add(key); next.push(sim.g);
      }
    }
    layer = next;
    if(layer.length > 400000) break;
  }
  return { par: null };
}

/* ---------- Boot ---------- */
A.Touch.mount(); A.Touch.label('ROTATE');
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
window.__fizz = G;
window.__fizzDebug = { makeBoard, genGloomies, findMatches, removeCells, gravityStep, pieceCells, blockedBy, evalBoard, applyPlacement, botPlan, BOTW, newGame, startLevel, startDemo,
  sim, step, stepBoard, stepPlayer, lockPiece, hardDrop, spawn, topOut, levelResults, gameOver, matchResults, dailyResults, puzzleResults, solvePuzzle, loadPuzzle,
  PUZZLES, SONGS, layout, display, parseCap, makePlayer, resetPlayer, titleMenu, openLobby, Net, MD, sendGarbage, dailyRuns };
})();
