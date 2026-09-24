/* TANK — defend the crystal. Co-op for 1–4 players, or battle each other.
   Original artwork and levels, drawn with vectors so it stays sharp at any resolution. */
(function(){
'use strict';
const A = window.Arcade;
const S = name => { if(!G.demo) A.Sound.play(name); };

/* ---------- World constants ---------- */
const VW = 384, VH = 216;           // virtual screen (16:9)
const F = 52;                       // field size in blocks (13 tiles × 4)
const BP = 4;                       // virtual px per block
const FX = (VW - F * BP) / 2, FY = (VH - F * BP) / 2;
const EPS = 0.001;
const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREES: 4, ICE: 5, BASE: 6 };
const DIRV = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const FONT = '"Silkscreen","Courier New",monospace';

const COL = {
  surround: '#171920', panel: '#1e212b', line: '#2e3242', ground: '#0d0e12', groundDot: '#1b1d25',
  brick: '#a24a2b', brickHi: '#c9673f', mortar: '#5b2616',
  steel: '#8e97a3', steelHi: '#d2d8df', steelLo: '#4f5661', steelMid: '#b1b9c3',
  water: '#1f4f8c', waterHi: '#6aa6e6', ice: '#a7c3d0', iceHi: '#e0eef4',
  tree: '#2d6534', treeHi: '#4d9448', treeLo: '#1d4424',
  tread: '#17181d', treadHi: '#3b3e48',
  bulletP: '#fff3c4', bulletE: '#ffb4a0', fire: '#ff9f43', fireCore: '#fff0b3',
  text: '#ece6d6', muted: '#8f8f9e', amber: '#f5c542', danger: '#ff5a4e', frost: '#9fe0ff'
};

const DIFF = {
  kids:   { label: 'Kids',   lives: Infinity, baseHp: 3, enemies: 12, maxOnField: 3, spawnEvery: 3.4, enemySpeed: 0.72, fireRate: 0.45, targetBase: 0.3, friendlyFire: false, startLevel: 1, keepLevel: true,  spawnShield: 5, powerLife: 22 },
  normal: { label: 'Normal', lives: 3,        baseHp: 1, enemies: 20, maxOnField: 4, spawnEvery: 2.6, enemySpeed: 1.0,  fireRate: 0.9,  targetBase: 0.5, friendlyFire: true,  startLevel: 0, keepLevel: false, spawnShield: 3, powerLife: 15 },
  hard:   { label: 'Hard',   lives: 2,        baseHp: 1, enemies: 20, maxOnField: 5, spawnEvery: 1.9, enemySpeed: 1.15, fireRate: 1.4,  targetBase: 0.6, friendlyFire: true,  startLevel: 0, keepLevel: false, spawnShield: 3, powerLife: 12 }
};
const DIFF_ORDER = ['kids', 'normal', 'hard'];
const ETYPE = {
  basic: { speed: 6,  bullet: 24, hp: 1, pts: 100, name: 'Scout' },
  fast:  { speed: 12, bullet: 24, hp: 1, pts: 200, name: 'Runner' },
  power: { speed: 8,  bullet: 40, hp: 1, pts: 300, name: 'Gunner' },
  armor: { speed: 6,  bullet: 28, hp: 4, pts: 400, name: 'Heavy' }
};
const CARRIERS = [3, 10, 17];                        // these enemies flash and drop a power-up when hit
const ENEMY_SPAWNS = [[24, 0], [48, 0], [0, 0]];
const COOP_SPAWNS = [[16, 48, 0], [32, 48, 0], [8, 48, 0], [40, 48, 0]];
const VS_SPAWNS = [[0, 0, 2], [48, 48, 0], [48, 0, 2], [0, 48, 0]];

/* ---------- Levels: 13×13 tiles.  # brick  @ steel  ~ water  % trees  - ice
   l r u d = half brick (left/right/up/down), L R U D = half steel. The crystal and its wall are added automatically. */
const STAGES = [
  { name: 'Brick Rows', map: [
    '.............',
    '.#.#.#.#.#.#.',
    '.#.#.#.#.#.#.',
    '.#.#.#@#.#.#.',
    '.#.#.#.#.#.#.',
    '.#.#.....#.#.',
    '.....#.#.....',
    'u.##.....##.u',
    '.....#.#.....',
    '.#.#.###.#.#.',
    '.#.#.#.#.#.#.',
    '.#.........#.',
    '.#.........#.'] },
  { name: 'Steel Lake', map: [
    '..@.......@..',
    '.##..@@@..##.',
    '.##.......##.',
    '....~~.~~....',
    '@#..~~.~~..#@',
    '@#.........#@',
    '...%%%.%%%...',
    '.#.%%%.%%%.#.',
    '.#....#....#.',
    '.#.@.###.@.#.',
    '....d...d....',
    '#..#.....#..#',
    '#..#.....#..#'] },
  { name: 'Green Maze', map: [
    '...%%...%%...',
    '.#.%%.#.%%.#.',
    '.#....#....#.',
    '%%.##...##.%%',
    '%%.#.....#.%%',
    '...#.@.@.#...',
    '~~.........~~',
    '...#.@.@.#...',
    '%%.#.....#.%%',
    '%%.##.#.##.%%',
    '.....###.....',
    '##.#.....#.##',
    '##.#.....#.##'] },
  { name: 'Ice Fort', map: [
    '..#.......#..',
    '.@#.-----.#@.',
    '..#.-----.#..',
    '##..-----..##',
    '....#####....',
    '.~~.#...#.~~.',
    '.~~...@...~~.',
    '.~~.#...#.~~.',
    '....##.##....',
    '@...........@',
    '.#.#.#.#.#.#.',
    '...#.....#...',
    '...#.....#...'] },
  { name: 'Crossfire', map: [
    '.....@.@.....',
    '.###.@.@.###.',
    '.#.........#.',
    '.#.##~~~##.#.',
    '....#...#....',
    '@@.........@@',
    '..#.#.%.#.#..',
    '..#.#%%%#.#..',
    '..#...%...#..',
    '.~~.#####.~~.',
    '.............',
    '.#.#.....#.#.',
    '.#.#.....#.#.'] },
  { name: 'Last Stand', map: [
    '..@...%...@..',
    '..@.#.%.#.@..',
    '....#...#....',
    '##.###.###.##',
    '-----...-----',
    '..@.......@..',
    '.###.@@@.###.',
    '.....~.~.....',
    '#.#.#...#.#.#',
    '..%%%.#.%%%..',
    '..%%%...%%%..',
    '.#.#.....#.#.',
    '.#.#.....#.#.'] }
];
const ARENA = { name: 'Arena', map: [
  '.....%.%.....',
  '.@#.......#@.',
  '.#..~~.~~..#.',
  '....~~.~~....',
  '.%.........%.',
  '%%.##.@.##.%%',
  '....#...#....',
  '%%.##.@.##.%%',
  '.%.........%.',
  '....~~.~~....',
  '.#..~~.~~..#.',
  '.@#.......#@.',
  '.....%.%.....'] };

/* ---------- Game state ---------- */
const G = {
  state: 'title', mode: 'coop', diff: A.Store.get('tank.diff', 'normal'), startStage: 1, stage: 1,
  demo: true, time: 0, stateT: 0, grid: new Uint8Array(F * F), water: [], players: [], tanks: [], bullets: [],
  powerups: [], fx: [], popups: [], spawns: [], base: { hp: 1, dead: false, flash: 0 },
  fortressT: 0, freezeT: 0, roster: [], total: 0, spawned: 0, spawnTimer: 0, spawnPoint: 0,
  clearT: -1, shake: 0, vsTarget: 5, vsPowerT: 8, winner: null, dirty: [], cacheStale: true, flashT: 0
};
if(!DIFF[G.diff]) G.diff = 'normal';
const D = () => DIFF[G.diff];

/* ---------- Map helpers ---------- */
const at = (x, y) => (x < 0 || y < 0 || x >= F || y >= F) ? -1 : G.grid[y * F + x];
function setB(x, y, v){ if(x < 0 || y < 0 || x >= F || y >= F) return; const i = y * F + x; if(G.grid[i] !== v){ G.grid[i] = v; G.dirty.push(i); } }
const RING = []; // wall around the crystal
for(let y = 46; y < 52; y++) for(let x = 22; x < 30; x++) if(!(x >= 24 && x < 28 && y >= 48)) RING.push([x, y]);

function parseMap(rows, withBase){
  const g = new Uint8Array(F * F);
  const fill = (tx, ty, x0, y0, w, h, v) => { for(let y = y0; y < y0 + h; y++) for(let x = x0; x < x0 + w; x++) g[(ty * 4 + y) * F + tx * 4 + x] = v; };
  rows.forEach((row, ty) => { for(let tx = 0; tx < 13; tx++){
    const c = row[tx] || '.';
    const v = '#lrud'.includes(c) ? T.BRICK : '@LRUD'.includes(c) ? T.STEEL : c === '~' ? T.WATER : c === '%' ? T.TREES : c === '-' ? T.ICE : 0;
    if(!v) continue;
    const k = c.toLowerCase();
    if(k === 'l') fill(tx, ty, 0, 0, 2, 4, v); else if(k === 'r') fill(tx, ty, 2, 0, 2, 4, v);
    else if(k === 'u') fill(tx, ty, 0, 0, 4, 2, v); else if(k === 'd') fill(tx, ty, 0, 2, 4, 2, v);
    else fill(tx, ty, 0, 0, 4, 4, v);
  }});
  if(withBase){
    for(const [x, y] of RING) g[y * F + x] = T.BRICK;
    for(let y = 48; y < 52; y++) for(let x = 24; x < 28; x++) g[y * F + x] = T.BASE;
  }
  return g;
}
function setRing(v){
  for(const [x, y] of RING){
    if(G.tanks.some(t => t.alive && x + 1 > t.x && x < t.x + 4 && y + 1 > t.y && y < t.y + 4)) continue;
    setB(x, y, v);
  }
}

/* ---------- Players & tanks ---------- */
function mix(a, b, t){
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
function paletteOf(hex){ return { body: hex, top: mix(hex, '#ffffff', 0.38), dark: mix(hex, '#000000', 0.5) }; }
const EPAL = {
  basic: paletteOf('#aab1bb'), fast: paletteOf('#cdb98a'), power: paletteOf('#98b89b'),
  armor4: paletteOf('#7fbf6a'), armor3: paletteOf('#d4c35a'), armor2: paletteOf('#d99557'), armor1: paletteOf('#aab1bb'),
  carrier: paletteOf('#e2463c'), frozen: paletteOf('#9cc9e6')
};

function makePlayer(lp){
  return { slot: lp.slot, source: lp.source, color: lp.color, pal: paletteOf(lp.color), name: 'P' + (lp.slot + 1),
    lives: D().lives - 1, level: D().startLevel, score: 0, kills: { basic: 0, fast: 0, power: 0, armor: 0 },
    tank: null, respawnT: 0, out: false, vs: 0, nextLife: 20000, stageScore: 0 };
}
function applyLevel(t){
  const l = t.player.level;
  t.bulletSpeed = l >= 1 ? 42 : 28; t.maxBullets = l >= 2 ? 2 : 1; t.power = l >= 3 ? 1 : 0;
}
function spawnPlayer(p){
  const sp = (G.mode === 'versus' ? VS_SPAWNS : COOP_SPAWNS)[p.slot];
  G.spawns.push({ x: sp[0], y: sp[1], dir: sp[2], t: 0.6, kind: 'player', player: p });
}
function makePlayerTank(p, x, y, dir){
  const t = { kind: 'player', player: p, x, y, dir, size: 4, speed: G.diff === 'kids' ? 10 : 10.5, alive: true,
    shield: G.mode === 'versus' ? 2 : D().spawnShield, stun: 0, cool: 0, active: 0, anim: 0, moving: false, slide: 0, labelT: 3, flash: 0 };
  applyLevel(t); p.tank = t; G.tanks.push(t); return t;
}
function makeEnemy(etype, x, y, carrier){
  const e = ETYPE[etype], loop = Math.floor((G.stage - 1) / STAGES.length);
  const t = { kind: 'enemy', etype, x, y, dir: 2, size: 4, speed: e.speed * D().enemySpeed * (1 + loop * 0.08), alive: true,
    hp: e.hp, carrier, bulletSpeed: e.bullet, maxBullets: 1, power: 0, cool: 0.6, active: 0, anim: 0, moving: true,
    shield: 0, stun: 0, ai: { t: 0.4 + Math.random() }, flash: 0 };
  G.tanks.push(t); return t;
}
function makeRoster(stage){
  const n = D().enemies, s = stage - 1;
  const w = { basic: Math.max(2, 10 - s * 1.4), fast: 2 + s * 0.8, power: 1 + s * 0.9, armor: (G.diff === 'kids' ? 0.3 : 1) + s * 1.0 };
  if(G.diff === 'hard') w.armor += 1.5;
  const sum = w.basic + w.fast + w.power + w.armor, rank = { basic: 0, fast: 1, power: 2, armor: 3 };
  const list = [];
  for(let i = 0; i < n; i++){
    let r = Math.random() * sum, pick = 'basic';
    for(const k of ['basic', 'fast', 'power', 'armor']){ if(r < w[k]){ pick = k; break; } r -= w[k]; }
    list.push(pick);
  }
  return list.map(k => ({ k, key: rank[k] + Math.random() * 3 })).sort((a, b) => a.key - b.key).map(o => o.k);
}

/* ---------- Movement & collision ---------- */
const overlap = (ax, ay, as, bx, by, bs) => ax < bx + bs - EPS && ax + as > bx + EPS && ay < by + bs - EPS && ay + as > by + EPS;
function solidForTank(v){ return v === T.BRICK || v === T.STEEL || v === T.WATER || v === T.BASE; }
function free(self, x, y){
  const s = self.size;
  if(x < -EPS || y < -EPS || x + s > F + EPS || y + s > F + EPS) return false;
  const x0 = Math.floor(x + EPS), x1 = Math.floor(x + s - EPS), y0 = Math.floor(y + EPS), y1 = Math.floor(y + s - EPS);
  for(let by = y0; by <= y1; by++) for(let bx = x0; bx <= x1; bx++){
    if(solidForTank(at(bx, by)) && !overlap(self.x, self.y, s, bx, by, 1)) return false;
  }
  for(const o of G.tanks){
    if(o === self || !o.alive) continue;
    if(overlap(x, y, s, o.x, o.y, o.size) && !overlap(self.x, self.y, s, o.x, o.y, o.size)) return false;
  }
  return true;
}
function moveTank(t, dir, dist){
  if(dir !== t.dir){
    if((dir & 1) !== (t.dir & 1)){             // turning a corner: line up with the half-tile grid
      const k = (t.dir & 1) ? 'x' : 'y', v = t[k];
      for(const c of [Math.round(v / 2) * 2, Math.floor(v / 2) * 2, Math.ceil(v / 2) * 2]){
        const nx = k === 'x' ? c : t.x, ny = k === 'y' ? c : t.y;
        if(Math.abs(c - v) <= 1.2 && free(t, nx, ny)){ t[k] = c; break; }
      }
    }
    t.dir = dir;
  }
  const [dx, dy] = DIRV[dir];
  const nx = t.x + dx * dist, ny = t.y + dy * dist;
  if(free(t, nx, ny)){ t.x = nx; t.y = ny; return true; }
  let c;                                       // slide right up to the obstacle
  if(dx > 0){ c = Math.floor(t.x + t.size + dist) - t.size; if(c > t.x + EPS && free(t, c, t.y)){ t.x = c; return true; } }
  if(dx < 0){ c = Math.ceil(t.x - dist); if(c < t.x - EPS && free(t, c, t.y)){ t.x = c; return true; } }
  if(dy > 0){ c = Math.floor(t.y + t.size + dist) - t.size; if(c > t.y + EPS && free(t, t.x, c)){ t.y = c; return true; } }
  if(dy < 0){ c = Math.ceil(t.y - dist); if(c < t.y - EPS && free(t, t.x, c)){ t.y = c; return true; } }
  return false;
}
function onIce(t){ return at(Math.floor(t.x + 2), Math.floor(t.y + 2)) === T.ICE; }
function areaClear(x, y){ return !G.tanks.some(t => t.alive && overlap(x, y, 4, t.x, t.y, 4)); }

/* ---------- Shooting ---------- */
function fire(t){
  if(t.cool > 0 || t.active >= t.maxBullets || !t.alive) return;
  const [dx, dy] = DIRV[t.dir];
  G.bullets.push({ x: t.x + 2 + dx * 2, y: t.y + 2 + dy * 2, dir: t.dir, speed: t.bulletSpeed, owner: t, power: t.power, alive: true });
  t.active++; t.cool = t.kind === 'player' ? 0.16 : 0.35;
  if(t.kind === 'player') S('shoot');
}
function killBullet(b){ if(b.alive){ b.alive = false; b.owner.active = Math.max(0, b.owner.active - 1); } }
function impact(b){
  const vert = b.dir === 0 || b.dir === 2;
  let front;
  if(b.dir === 0) front = Math.floor(b.y - 0.5); else if(b.dir === 2) front = Math.floor(b.y + 0.5 - EPS);
  else if(b.dir === 1) front = Math.floor(b.x + 0.5 - EPS); else front = Math.floor(b.x - 0.5);
  const c = vert ? b.x : b.y;
  let hit = false;
  for(let k = Math.floor(c - 0.5); k <= Math.floor(c + 0.5 - EPS); k++){
    const v = vert ? at(k, front) : at(front, k);
    if(v === T.BRICK || v === T.STEEL || v === T.BASE) hit = true;
  }
  if(!hit) return false;
  const center = Math.round(c), depth = b.power ? 2 : 1, stepDir = (b.dir === 0 || b.dir === 3) ? -1 : 1;
  let brick = false, steel = false, base = false;
  for(let d = 0; d < depth; d++){
    const line = front + d * stepDir;
    for(let k = center - 2; k < center + 2; k++){
      const bx = vert ? k : line, by = vert ? line : k, v = at(bx, by);
      if(v === T.BRICK){ setB(bx, by, T.EMPTY); brick = true; }
      else if(v === T.STEEL){ if(b.power){ setB(bx, by, T.EMPTY); brick = true; } else steel = true; }
      else if(v === T.BASE && d === 0) base = true;
    }
  }
  if(b.owner.kind === 'player'){ if(brick) S('brick'); else if(steel) S('steel'); }
  addFx(b.x, b.y, false, true);
  if(base) hitBase();
  return true;
}
function bulletStep(b){
  if(b.x < 0.5 || b.y < 0.5 || b.x > F - 0.5 || b.y > F - 0.5){
    if(b.owner.kind === 'player') S('steel');
    addFx(Math.max(0.5, Math.min(F - 0.5, b.x)), Math.max(0.5, Math.min(F - 0.5, b.y)), false, true);
    return true;
  }
  if(impact(b)) return true;
  for(const t of G.tanks){
    if(!t.alive || t === b.owner || !overlap(b.x - 0.5, b.y - 0.5, 1, t.x, t.y, 4)) continue;
    const o = b.owner;
    if(o.kind === 'enemy' && t.kind === 'enemy') continue;       // enemies can't hurt each other
    if(t.kind === 'player'){
      if(o.kind === 'enemy' || G.mode === 'versus'){
        if(t.shield > 0) addFx(b.x, b.y, false, true); else destroyPlayer(t, o);
      } else if(D().friendlyFire && t.shield <= 0){ t.stun = 2; S('armor'); addPopup(t.x + 2, t.y, 'OOPS!', COL.frost); }
      return true;
    }
    hitEnemy(t, o.player);
    return true;
  }
  for(const o of G.bullets){
    if(o === b || !o.alive) continue;
    if(o.owner.kind === 'enemy' && b.owner.kind === 'enemy') continue;
    if(Math.abs(o.x - b.x) < 1 && Math.abs(o.y - b.y) < 1){ killBullet(o); addFx(b.x, b.y, false, true); return true; }
  }
  return false;
}

/* ---------- Damage, scoring, power-ups ---------- */
function hitBase(){
  if(G.demo || G.base.dead || G.mode !== 'coop') return;
  G.base.hp--; G.base.flash = 0.5; G.shake = 2;
  if(G.base.hp > 0){ S('armor'); addPopup(26, 47, 'CRYSTAL HIT!', COL.danger); return; }
  G.base.dead = true; addFx(26, 50, true); addFx(25, 49, true); S('boom');
  startGameOver();
}
function hitEnemy(e, p){
  if(e.carrier){ e.carrier = false; spawnPowerup(); }
  e.hp--;
  if(e.hp > 0){ S('armor'); e.flash = 0.12; return; }
  e.alive = false; addFx(e.x + 2, e.y + 2, true); S('explode');
  if(p){ const pts = ETYPE[e.etype].pts; p.score += pts; p.stageScore += pts; p.kills[e.etype]++; addPopup(e.x + 2, e.y, '+' + pts, p.color); checkLife(p); }
}
function destroyPlayer(t, killer){
  t.alive = false; addFx(t.x + 2, t.y + 2, true); S('explode'); G.shake = Math.max(G.shake, 1.2);
  const p = t.player; p.tank = null;
  if(G.mode === 'versus'){
    const kp = killer && killer.player;
    if(kp && kp !== p){ kp.vs++; addPopup(t.x + 2, t.y, kp.name + ' +1', kp.color); if(kp.vs >= G.vsTarget) startVsWin(kp); }
    p.respawnT = 1.6; return;
  }
  if(!D().keepLevel) p.level = 0;
  if(p.lives > 0){ if(p.lives !== Infinity) p.lives--; p.respawnT = 1.2; }
  else p.out = true;
}
function checkLife(p){
  if(p.score >= p.nextLife){ p.nextLife += 20000; if(p.lives !== Infinity){ p.lives++; S('lifeUp'); addPopup(26, 26, p.name + ' EXTRA LIFE', p.color); } }
}
const PU_COLORS = { shield: '#7fe3ff', star: '#ffd24a', bomb: '#ff8a3d', freeze: '#bfe9ff', fortress: '#d98a5f', life: '#8be38b' };
const PU_NAMES = { shield: 'SHIELD', star: 'POWER UP', bomb: 'BOOM!', freeze: 'FREEZE', fortress: 'STEEL WALL', life: 'EXTRA LIFE' };
function spawnPowerup(){
  const types = G.mode === 'versus' ? ['shield', 'star', 'freeze'] : ['shield', 'star', 'bomb', 'freeze', 'fortress', 'life'];
  const type = types[Math.floor(Math.random() * types.length)];
  for(let tries = 0; tries < 60; tries++){
    const x = 2 * Math.floor(Math.random() * 25), y = 2 * Math.floor(Math.random() * (G.mode === 'versus' ? 25 : 22));
    let ok = true;
    for(let yy = y; yy < y + 4 && ok; yy++) for(let xx = x; xx < x + 4; xx++){ const v = at(xx, yy); if(v === T.WATER || v === T.STEEL || v === T.BASE){ ok = false; break; } }
    if(!ok) continue;
    G.powerups = [{ type, x, y, t: D().powerLife }];
    S('powerAppear'); return;
  }
}
function applyPowerup(p, pu){
  const t = p.tank; if(!t) return;
  S(pu.type === 'life' ? 'lifeUp' : pu.type === 'freeze' ? 'freeze' : pu.type === 'bomb' ? 'bomb' : 'powerUp');
  addPopup(pu.x + 2, pu.y, PU_NAMES[pu.type], PU_COLORS[pu.type]);
  if(G.mode === 'coop'){ p.score += 500; p.stageScore += 500; checkLife(p); }
  switch(pu.type){
    case 'shield': t.shield = G.mode === 'versus' ? 6 : 10; break;
    case 'star': p.level = Math.min(3, p.level + 1); applyLevel(t); break;
    case 'bomb': G.flashT = 0.35; for(const e of G.tanks) if(e.kind === 'enemy' && e.alive){ e.alive = false; addFx(e.x + 2, e.y + 2, true); } G.shake = 2.5; break;
    case 'freeze':
      if(G.mode === 'versus'){ for(const o of G.tanks) if(o.kind === 'player' && o !== t && o.alive) o.stun = 3; }
      else G.freezeT = 10;
      break;
    case 'fortress': G.fortressT = 18; setRing(T.STEEL); break;
    case 'life': if(p.lives === Infinity){ t.shield = Math.max(t.shield, 8); } else p.lives++; break;
  }
}

/* ---------- Effects ---------- */
let fxId = 0;
function addFx(x, y, big, small){ G.fx.push({ x, y, t: 0, dur: big ? 0.7 : small ? 0.18 : 0.35, big: !!big, small: !!small, id: fxId++ }); if(G.fx.length > 60) G.fx.shift(); }
function addPopup(x, y, text, color){ G.popups.push({ x, y, text, color, t: 0 }); if(G.popups.length > 12) G.popups.shift(); }

/* ---------- Enemy brain ---------- */
function chooseDir(e){
  let target = null; const r = Math.random();
  if(G.mode === 'coop' && !G.base.dead && r < D().targetBase) target = { x: 24, y: 48 };
  else if(r < D().targetBase + 0.25){
    let best = null, bd = 1e9;
    for(const t of G.tanks) if(t.kind === 'player' && t.alive){ const d = Math.abs(t.x - e.x) + Math.abs(t.y - e.y); if(d < bd){ bd = d; best = t; } }
    if(best) target = best;
  }
  let dir;
  if(target){
    const dx = target.x - e.x, dy = target.y - e.y;
    const useX = Math.random() < Math.abs(dx) / (Math.abs(dx) + Math.abs(dy) + 0.01);
    dir = useX ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
  } else dir = Math.random() < 0.4 ? 2 : Math.floor(Math.random() * 4);
  return dir;
}
function updateEnemy(e, dt){
  if(e.cool > 0) e.cool -= dt;
  if(e.flash > 0) e.flash -= dt;
  if(G.freezeT > 0){ e.moving = false; return; }
  const moved = moveTank(e, e.dir, e.speed * dt);
  e.moving = moved; if(moved) e.anim += e.speed * dt;
  e.ai.t -= dt;
  if((!moved && Math.random() < dt * 5) || e.ai.t <= 0){ moveTank(e, chooseDir(e), 0); e.ai.t = 0.8 + Math.random() * 2.2; }
  if(!moved && Math.random() < dt * 2.5) fire(e);
  if(Math.random() < dt * D().fireRate) fire(e);
}

/* ---------- Player control ---------- */
function updatePlayer(p, dt){
  const t = p.tank, s = A.Input.get(p.source);
  const fireHeld = !!(s && s.connected && (s.fire || (s.kind === 'pad' && s.back)));
  if(!t){
    if(p.respawnT > 0){ p.respawnT -= dt; if(p.respawnT <= 0) spawnPlayer(p); }
    else if(p.out && s && A.Input.pressed(s, 'fire')){
      const donor = G.players.filter(q => q !== p && q.lives >= 1 && q.lives !== Infinity).sort((a, b) => b.lives - a.lives)[0];
      if(donor){ donor.lives--; p.out = false; p.respawnT = 0.3; S('join'); addPopup(26, 26, donor.name + ' SHARED A LIFE', donor.color); }
    }
    return;
  }
  if(t.labelT > 0) t.labelT -= dt;
  if(t.shield > 0) t.shield -= dt;
  if(t.cool > 0) t.cool -= dt;
  if(t.stun > 0){ t.stun -= dt; t.moving = false; return; }
  const dir = s && s.connected ? s.dir : -1;
  if(dir >= 0){
    t.moving = moveTank(t, dir, t.speed * dt) || true;
    t.slide = onIce(t) ? 0.35 : 0;
  } else if(t.slide > 0){ t.slide -= dt; moveTank(t, t.dir, t.speed * dt); t.moving = true; }
  else t.moving = false;
  if(t.moving) t.anim += t.speed * dt;
  if(fireHeld) fire(t);
  for(const pu of G.powerups) if(overlap(t.x, t.y, 4, pu.x, pu.y, 4)){ G.powerups = G.powerups.filter(x => x !== pu); applyPowerup(p, pu); break; }
}

/* ---------- Simulation step ---------- */
function sim(dt){
  if(G.shake > 0) G.shake = Math.max(0, G.shake - dt * 6);
  if(G.flashT > 0) G.flashT -= dt;
  if(G.base.flash > 0) G.base.flash -= dt;
  if(G.freezeT > 0) G.freezeT -= dt;
  if(G.fortressT > 0){
    G.fortressT -= dt;
    if(G.fortressT <= 0) setRing(T.BRICK);
    else if(G.fortressT < 3) setRing(Math.floor(G.fortressT * 4) % 2 ? T.STEEL : T.BRICK);
  }
  // enemy arrivals
  if(G.mode === 'coop'){
    if(G.demo && G.roster.length === 0) G.roster = makeRoster(1);
    G.spawnTimer -= dt;
    const alive = G.tanks.filter(t => t.kind === 'enemy' && t.alive).length + G.spawns.filter(s => s.kind === 'enemy').length;
    const cap = D().maxOnField + Math.max(0, G.players.length - 2);
    if(G.spawnTimer <= 0 && G.roster.length && alive < cap){
      const [sx, sy] = ENEMY_SPAWNS[G.spawnPoint % 3]; G.spawnPoint++;
      if(areaClear(sx, sy) && !G.spawns.some(s => s.x === sx && s.y === sy)){
        G.spawns.push({ x: sx, y: sy, t: 0.9, kind: 'enemy', etype: G.roster.shift(), carrier: !G.demo && CARRIERS.includes(G.spawned) });
        G.spawned++; G.spawnTimer = D().spawnEvery; S('spawn');
      }
    }
  } else {
    G.vsPowerT -= dt;
    if(G.vsPowerT <= 0){ G.vsPowerT = 9; if(!G.powerups.length) spawnPowerup(); }
  }
  // sparkles become tanks
  for(const sp of G.spawns){
    sp.t -= dt;
    if(sp.t <= 0){
      if(!areaClear(sp.x, sp.y)){ sp.t = 0.1; continue; }
      sp.done = true;
      if(sp.kind === 'enemy') makeEnemy(sp.etype, sp.x, sp.y, sp.carrier);
      else if(sp.player.tank == null) makePlayerTank(sp.player, sp.x, sp.y, sp.dir);
    }
  }
  G.spawns = G.spawns.filter(s => !s.done);

  for(const p of G.players) updatePlayer(p, dt);
  for(const t of G.tanks) if(t.kind === 'enemy' && t.alive) updateEnemy(t, dt);

  for(const b of G.bullets){
    if(!b.alive) continue;
    const dist = b.speed * dt, n = Math.max(1, Math.ceil(dist / 0.5)), d = dist / n, [dx, dy] = DIRV[b.dir];
    for(let i = 0; i < n && b.alive; i++){ b.x += dx * d; b.y += dy * d; if(bulletStep(b)) killBullet(b); }
  }
  G.bullets = G.bullets.filter(b => b.alive);
  G.tanks = G.tanks.filter(t => t.alive);
  for(const pu of G.powerups) pu.t -= dt;
  G.powerups = G.powerups.filter(pu => pu.t > 0);
  for(const f of G.fx) f.t += dt;
  G.fx = G.fx.filter(f => f.t < f.dur);
  for(const p of G.popups) p.t += dt;
  G.popups = G.popups.filter(p => p.t < 1.2);

  if(G.demo || G.state !== 'play') return;
  if(G.mode === 'coop'){
    const pending = G.players.some(p => p.tank || p.respawnT > 0 || G.spawns.some(s => s.player === p));
    if(!pending && G.players.every(p => p.out)) startGameOver();
    const enemiesLeft = G.roster.length + G.tanks.filter(t => t.kind === 'enemy').length + G.spawns.filter(s => s.kind === 'enemy').length;
    if(enemiesLeft === 0){
      if(G.clearT < 0) G.clearT = 2.5;
      G.clearT -= dt;
      if(G.clearT <= 0) showTally();
    }
  }
}

/* ---------- Flow ---------- */
function loadStage(){
  const def = G.mode === 'versus' ? ARENA : STAGES[(G.stage - 1) % STAGES.length];
  G.grid = parseMap(def.map, G.mode === 'coop');
  G.water = []; for(let i = 0; i < F * F; i++) if(G.grid[i] === T.WATER) G.water.push(i);
  G.tanks = []; G.bullets = []; G.powerups = []; G.fx = []; G.popups = []; G.spawns = [];
  G.base = { hp: D().baseHp, dead: false, flash: 0 };
  G.fortressT = 0; G.freezeT = 0; G.clearT = -1; G.shake = 0; G.flashT = 0; G.vsPowerT = 6;
  G.roster = G.mode === 'coop' ? makeRoster(G.stage) : []; G.total = G.roster.length; G.spawned = 0; G.spawnTimer = 0.2; G.spawnPoint = 0;
  G.stageName = def.name;
  for(const p of G.players){ p.tank = null; p.respawnT = 0; p.out = false; p.stageScore = 0; p.kills = { basic: 0, fast: 0, power: 0, armor: 0 }; if(p.lives < 0) p.lives = 0; }
  G.cacheStale = true;
}
function startDemo(){
  G.demo = true; G.mode = 'coop'; G.players = []; G.stage = 1 + Math.floor(Math.random() * 3);
  const keep = G.diff; G.diff = 'normal'; loadStage(); G.diff = keep;
}
function newGame(mode, lobbyPlayers){
  G.mode = mode; G.demo = false;
  G.players = lobbyPlayers.map(makePlayer);
  G.stage = mode === 'coop' ? G.startStage : 1;
  loadStage(); startIntro();
  A.keepAwake();
}
function startIntro(){ A.Menu.close(); G.state = 'intro'; G.stateT = 0; S('stageStart'); }
function startGameOver(){ if(G.state !== 'play') return; G.state = 'overAnim'; G.stateT = 0; setTimeout(() => S('gameOver'), 600); }
function startVsWin(p){ if(G.state !== 'play') return; G.winner = p; G.state = 'vsAnim'; G.stateT = 0; S('win'); }
function pause(){
  if(G.state !== 'play') return;
  G.state = 'paused'; S('pause');
  A.Menu.open({ center: true, kicker: G.mode === 'coop' ? 'Stage ' + G.stage + ' · ' + G.stageName : 'Battle', title: 'Paused', start: 0,
    items: [
      { label: 'Resume', select: resume },
      { label: 'Settings', select: () => settingsMenu(pauseAgain) },
      { label: G.mode === 'coop' ? 'Restart this stage' : 'Restart battle', select: restartStage },
      { label: 'Quit to title', select: toTitle }
    ], back: resume });
}
function pauseAgain(){ G.state = 'play'; pause(); }
function resume(){ A.Menu.close(); G.state = 'play'; }
function restartStage(resetScore){
  for(const p of G.players){
    p.lives = D().lives - 1; p.level = D().startLevel; p.vs = 0;
    p.score = resetScore === true ? 0 : Math.max(0, p.score - p.stageScore);
    p.nextLife = (Math.floor(p.score / 20000) + 1) * 20000;
  }
  loadStage(); startIntro();
}
function toTitle(){ A.Menu.close(); A.Lobby.close(); G.players = []; startDemo(); G.state = 'title'; titleMenu(); }
function teamScore(){ return G.players.reduce((a, p) => a + p.score, 0); }
function saveHigh(){
  const key = 'tank.hi.' + G.diff, best = A.Store.get(key, 0), now = teamScore();
  if(now > best){ A.Store.set(key, now); return true; } return false;
}
function showTally(){
  G.state = 'tally'; S('stageClear');
  let mvp = null;
  if(G.players.length > 1){
    const top = G.players.slice().sort((a, b) => b.stageScore - a.stageScore);
    if(top[0].stageScore > 0 && top[0].stageScore > top[1].stageScore){ mvp = top[0]; mvp.score += 1000; checkLife(mvp); }
  }
  const newBest = saveHigh();
  const rows = G.players.map(p => {
    const k = p.kills, n = k.basic + k.fast + k.power + k.armor;
    return '<b style="color:' + p.color + '">' + p.name + '</b> · ' + n + ' tanks · ' + p.stageScore.toLocaleString() + ' pts' + (p === mvp ? ' · <b>top tank +1000</b>' : '');
  }).join('<br>');
  A.Menu.open({ center: true, kicker: 'Stage ' + G.stage + ' · ' + G.stageName, title: 'Stage clear!',
    text: rows + '<br><br>Team score <b>' + teamScore().toLocaleString() + '</b>' + (newBest ? ' · <b>new best!</b>' : ''),
    items: [
      { label: 'Next stage', select: () => { G.stage++; loadStage(); startIntro(); } },
      { label: 'Quit to title', select: toTitle }
    ] });
}
function showGameOver(){
  G.state = 'over';
  const newBest = saveHigh(), best = A.Store.get('tank.hi.' + G.diff, 0);
  A.Menu.open({ center: true, kicker: 'Stage ' + G.stage + ' · ' + DIFF[G.diff].label, title: 'Game over',
    text: (G.base.dead ? 'The crystal was destroyed.' : 'Every tank is out of lives.') +
          '<br>Team score <b>' + teamScore().toLocaleString() + '</b> · Best <b>' + best.toLocaleString() + '</b>' + (newBest ? ' · new best!' : '') +
          (G.diff !== 'kids' ? '<br>Tip: Kids difficulty gives unlimited lives and a tougher crystal.' : ''),
    items: [
      { label: 'Try this stage again', select: () => restartStage(true) },
      { label: 'Change players', select: () => openLobby('coop', null) },
      { label: 'Quit to title', select: toTitle }
    ] });
}
function showVsWin(){
  G.state = 'vsover';
  const p = G.winner;
  A.Menu.open({ center: true, kicker: 'Battle', title: p.name + ' wins!',
    text: G.players.map(q => '<b style="color:' + q.color + '">' + q.name + '</b> ' + q.vs).join(' · '),
    items: [
      { label: 'Rematch', select: () => { for(const q of G.players){ q.vs = 0; q.level = 0; } loadStage(); startIntro(); } },
      { label: 'Change players', select: () => openLobby('versus', null) },
      { label: 'Quit to title', select: toTitle }
    ] });
}

/* ---------- Menus ---------- */
function controllerLine(){
  const n = A.Input.pads().length;
  const best = A.Store.get('tank.hi.' + G.diff, 0);
  return (n ? n + ' controller' + (n > 1 ? 's' : '') + ' ready. ' : 'Controllers: press any button to wake them up. ') +
         (best ? 'Best team score (' + DIFF[G.diff].label + '): ' + best.toLocaleString() + '.' : '');
}
function titleMenu(){
  G.state = 'title';
  A.Menu.open({ kicker: 'Family Arcade', title: 'TANK',
    text: 'Guard the <b>crystal</b> at the bottom of the map. Team up with up to 4 players against waves of enemy tanks, or battle each other.',
    items: [
      { label: 'Team up', select: src => openLobby('coop', src) },
      { label: 'Battle each other', select: src => openLobby('versus', src) },
      { label: 'Difficulty', value: () => DIFF[G.diff].label, change: d => { const i = DIFF_ORDER.indexOf(G.diff); G.diff = DIFF_ORDER[(i + d + 3) % 3]; A.Store.set('tank.diff', G.diff); } },
      { label: 'Stage', value: () => G.startStage + ' · ' + STAGES[G.startStage - 1].name, change: d => { G.startStage = ((G.startStage - 1 + d + STAGES.length) % STAGES.length) + 1; } },
      { label: 'Settings', select: () => settingsMenu(titleMenu) },
      { label: 'How to play', select: () => helpMenu(titleMenu) },
      { label: 'All games', select: () => { location.href = 'index.html'; } }
    ], footer: controllerLine() });
}
function openLobby(mode, src){
  G.state = 'lobby';
  if(!G.demo) startDemo();
  A.Lobby.open({
    kicker: mode === 'coop' ? 'Team up · ' + DIFF[G.diff].label : 'Battle · first to ' + G.vsTarget,
    title: mode === 'coop' ? 'Who is playing?' : 'Who is battling?',
    text: mode === 'coop' ? 'Everyone presses FIRE to join, then FIRE again when ready. 1 to 4 players.' : 'Needs 2 to 4 players. Everyone presses FIRE to join, then FIRE again when ready.',
    min: mode === 'coop' ? 1 : 2, max: 4, colors: A.PLAYER_COLORS, initial: src ? src.id : null,
    onStart: players => newGame(mode, players), onBack: titleMenu
  });
}
function settingsMenu(back){
  A.Menu.open({ center: true, kicker: 'Settings', title: 'Settings',
    text: 'Resolution now: ' + display.resolutionLabel() + '. Auto lowers the resolution by itself if the game runs slowly.',
    items: [
      { label: 'Volume', value: () => A.Settings.volume + ' / 10', change: d => { A.Settings.volume = Math.max(0, Math.min(10, A.Settings.volume + d)); A.Sound.applyVolume(); A.saveSettings(); A.Sound.play('shoot'); } },
      { label: 'Resolution', value: () => A.QUALITY_LABELS[A.Settings.quality], change: d => { const o = ['auto', 'high', 'medium', 'low']; A.Settings.quality = o[(o.indexOf(A.Settings.quality) + d + 4) % 4]; A.saveSettings(); display.dyn = 1; display.resize(); } },
      { label: 'Fullscreen', select: () => A.toggleFullscreen() },
      { label: 'Back', select: back }
    ], back });
}
function helpMenu(back){
  A.Menu.open({ center: true, kicker: 'How to play', title: 'How to play',
    text: '<b>Move</b> with the stick, D-pad or arrows. <b>Fire</b> with A (any face button). <b>Pause</b> with Start, Esc or P.<br>' +
          'Enemy tanks come from the top. Stop them reaching the <b>crystal</b>. Flashing red tanks drop a power-up when hit.<br>' +
          '<b>Shield</b> 10s invincible · <b>Star</b> stronger gun (level 3 breaks steel) · <b>Bomb</b> clears the screen · ' +
          '<b>Snowflake</b> freezes enemies · <b>Wall</b> steel around the crystal · <b>Tank</b> extra life.<br>' +
          'Out of lives? Press FIRE to borrow one from a teammate. Kids difficulty: unlimited lives, no friendly fire.',
    items: [{ label: 'Back', select: back }], back });
}

/* ---------- Main step ---------- */
let touchShown = false;
function step(dt){
  G.time += dt;
  const wantTouch = G.state === 'play' && G.players.some(p => p.source === 'touch');
  if(wantTouch !== touchShown){ touchShown = wantTouch; A.Touch.show(wantTouch); }
  if(A.Lobby.isOpen()){ A.Lobby.update(); sim(dt); return; }
  if(A.Menu.isOpen()){ A.Menu.update(); if(G.demo) sim(dt); return; }
  switch(G.state){
    case 'intro':
      G.stateT += dt;
      if(G.stateT >= 2.2){ G.state = 'play'; for(const p of G.players) spawnPlayer(p); }
      break;
    case 'play':
      if(A.Input.all().some(s => A.Input.pressed(s, 'pause'))){ pause(); return; }
      sim(dt); break;
    case 'overAnim':
      G.stateT += dt; sim(dt);
      if(G.stateT > 3) showGameOver();
      break;
    case 'vsAnim':
      G.stateT += dt; sim(dt);
      if(G.stateT > 1.6) showVsWin();
      break;
    case 'title': titleMenu(); break;
  }
}
document.addEventListener('visibilitychange', () => { if(document.hidden && G.state === 'play') pause(); });

/* ================= Rendering ================= */
const canvas = document.getElementById('screen');
const display = new A.Display(canvas, VW, VH);
let terrain = null, trees = null, bpx = 0;
display.onResize = () => { G.cacheStale = true; };

function paintBlock(c, bx, by, v){
  c.fillStyle = COL.ground; c.fillRect(bx, by, 1, 1);
  if(v === T.BRICK){
    c.fillStyle = COL.brick; c.fillRect(bx, by, 1, 1);
    c.fillStyle = COL.brickHi; c.fillRect(bx, by, 1, 0.14);
    c.fillStyle = COL.mortar; c.fillRect(bx, by + 0.84, 1, 0.16); c.fillRect((by & 1) ? bx + 0.5 : bx, by, 0.12, 0.84);
  } else if(v === T.STEEL){
    c.fillStyle = COL.steel; c.fillRect(bx, by, 1, 1);
    c.fillStyle = COL.steelHi; c.fillRect(bx, by, 1, 0.14); c.fillRect(bx, by, 0.14, 1);
    c.fillStyle = COL.steelLo; c.fillRect(bx, by + 0.86, 1, 0.14); c.fillRect(bx + 0.86, by, 0.14, 1);
    c.fillStyle = COL.steelMid; c.fillRect(bx + 0.34, by + 0.34, 0.32, 0.32);
  } else if(v === T.ICE){
    c.fillStyle = COL.ice; c.fillRect(bx, by, 1, 1);
    c.fillStyle = COL.iceHi; c.fillRect(bx + ((bx + by) & 1) * 0.45, by + 0.25, 0.4, 0.1); c.fillRect(bx + 0.2, by + 0.7, 0.3, 0.08);
  } else if(v === T.EMPTY || v === T.TREES || v === T.WATER || v === T.BASE){
    if(bx % 4 === 0 && by % 4 === 0){ c.fillStyle = COL.groundDot; c.fillRect(bx, by, 0.14, 0.14); }
  }
}
function rebuildCaches(){
  bpx = Math.max(2, Math.round(BP * display.scale));
  const size = F * bpx;
  if(!terrain){ terrain = document.createElement('canvas'); trees = document.createElement('canvas'); }
  terrain.width = trees.width = size; terrain.height = trees.height = size;
  const c = terrain.getContext('2d');
  c.setTransform(bpx, 0, 0, bpx, 0, 0);
  for(let y = 0; y < F; y++) for(let x = 0; x < F; x++) paintBlock(c, x, y, G.grid[y * F + x]);
  const tc = trees.getContext('2d');
  tc.setTransform(bpx, 0, 0, bpx, 0, 0); tc.clearRect(0, 0, F, F);
  for(let y = 0; y < F; y++) for(let x = 0; x < F; x++) if(G.grid[y * F + x] === T.TREES){
    tc.fillStyle = COL.treeLo; tc.beginPath(); tc.arc(x + 0.5, y + 0.58, 0.72, 0, 7); tc.fill();
  }
  for(let y = 0; y < F; y++) for(let x = 0; x < F; x++) if(G.grid[y * F + x] === T.TREES){
    tc.fillStyle = COL.tree; tc.beginPath(); tc.arc(x + 0.5, y + 0.45, 0.6, 0, 7); tc.fill();
    tc.fillStyle = COL.treeHi; tc.beginPath(); tc.arc(x + 0.32 + ((x * 7 + y * 3) % 3) * 0.1, y + 0.3, 0.26, 0, 7); tc.fill();
  }
  G.dirty = []; G.cacheStale = false;
}
function flushDirty(){
  if(!G.dirty.length) return;
  const c = terrain.getContext('2d'); c.setTransform(bpx, 0, 0, bpx, 0, 0);
  for(const i of G.dirty) paintBlock(c, i % F, (i / F) | 0, G.grid[i]);
  G.dirty = [];
}

function circle(c, x, y, r){ c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
function tankPalette(t){
  if(t.kind === 'player') return t.player.pal;
  if(G.freezeT > 0) return EPAL.frozen;
  if(t.carrier && Math.floor(G.time * 7) % 2) return EPAL.carrier;
  if(t.etype === 'armor') return EPAL['armor' + Math.max(1, t.hp)];
  return EPAL[t.etype];
}
function drawTank(c, t){
  if(t.kind === 'player' && t.stun > 0 && Math.floor(G.time * 10) % 2) return;
  const pal = t.flash > 0 ? { body: '#ffffff', top: '#ffffff', dark: '#9aa0a8' } : tankPalette(t);
  c.save(); c.translate(t.x + 2, t.y + 2); c.rotate(t.dir * Math.PI / 2);
  // treads
  c.fillStyle = COL.tread; c.fillRect(-2, -1.95, 1.05, 3.9); c.fillRect(0.95, -1.95, 1.05, 3.9);
  c.fillStyle = COL.treadHi;
  const off = (t.anim * 0.6) % 0.8;
  for(let k = -1.95 + off; k < 1.7; k += 0.8){ c.fillRect(-1.92, k, 0.9, 0.22); c.fillRect(1.02, k, 0.9, 0.22); }
  const lvl = t.kind === 'player' ? t.player.level : 0;
  // hull
  if(t.etype === 'fast'){
    c.fillStyle = pal.dark; c.beginPath(); c.moveTo(-1.1, 1.6); c.lineTo(1.1, 1.6); c.lineTo(0.9, -1.3); c.lineTo(-0.9, -1.3); c.fill();
    c.fillStyle = pal.body; c.beginPath(); c.moveTo(-0.95, 1.45); c.lineTo(0.95, 1.45); c.lineTo(0.78, -1.15); c.lineTo(-0.78, -1.15); c.fill();
  } else {
    const wide = t.etype === 'armor' || lvl >= 3 ? 1.3 : 1.12;
    c.fillStyle = pal.dark; c.fillRect(-wide, -1.55, wide * 2, 3.2);
    c.fillStyle = pal.body; c.fillRect(-wide + 0.12, -1.43, wide * 2 - 0.24, 2.96);
    if(t.etype === 'armor'){ c.fillStyle = pal.dark; for(const [rx, ry] of [[-0.95, -1.15], [0.95, -1.15], [-0.95, 1.15], [0.95, 1.15]]) circle(c, rx, ry, 0.14); }
  }
  // barrel(s)
  const bw = lvl >= 1 ? 0.52 : 0.42, blen = lvl >= 2 ? 2.35 : 2.2;
  const barrels = t.etype === 'power' ? [-0.32, 0.32] : [0];
  for(const bx of barrels){ c.fillStyle = pal.dark; c.fillRect(bx - bw / 2, -blen, bw, blen); c.fillStyle = pal.top; c.fillRect(bx - bw / 2 + 0.1, -blen + 0.1, bw - 0.2, 0.5); }
  // turret
  c.fillStyle = pal.dark; circle(c, 0, 0.25, 0.98);
  c.fillStyle = pal.top; circle(c, 0, 0.18, 0.8);
  if(lvl >= 3){ c.fillStyle = pal.dark; circle(c, 0, 0.18, 0.3); }
  c.restore();
  if(t.shield > 0 && !(t.shield < 1.5 && Math.floor(G.time * 10) % 2)){
    c.save(); c.translate(t.x + 2, t.y + 2); c.rotate(G.time * 3);
    c.strokeStyle = COL.frost; c.lineWidth = 0.22; c.setLineDash([0.7, 0.45]);
    c.beginPath(); c.arc(0, 0, 2.55, 0, Math.PI * 2); c.stroke(); c.restore();
  }
}
function drawSparkle(c, sp){
  const p = (sp.t * 7) % 2, r = 0.6 + (p < 1 ? p : 2 - p) * 1.5;
  c.save(); c.translate(sp.x + 2, sp.y + 2); c.fillStyle = sp.kind === 'player' ? sp.player.color : '#ffffff';
  c.beginPath(); c.moveTo(0, -r); c.lineTo(0.3, 0); c.lineTo(0, r); c.lineTo(-0.3, 0); c.fill();
  c.beginPath(); c.moveTo(-r, 0); c.lineTo(0, 0.3); c.lineTo(r, 0); c.lineTo(0, -0.3); c.fill();
  c.restore();
}
function drawBase(c){
  if(G.mode !== 'coop') return;
  const b = G.base;
  c.fillStyle = '#23262f'; c.fillRect(24.15, 48.15, 3.7, 3.7);
  c.fillStyle = '#343846'; c.fillRect(24.15, 51.1, 3.7, 0.75);
  if(b.dead){
    c.fillStyle = '#4b505c'; c.beginPath(); c.moveTo(24.8, 51.1); c.lineTo(25.5, 49.9); c.lineTo(26.2, 50.5); c.lineTo(26.9, 49.6); c.lineTo(27.3, 51.1); c.fill();
    return;
  }
  const hot = b.flash > 0 && Math.floor(G.time * 16) % 2;
  const glow = 0.5 + Math.sin(G.time * 3) * 0.5;
  c.fillStyle = hot ? '#ffffff' : COL.amber;
  c.beginPath(); c.moveTo(26, 48.5); c.lineTo(27.35, 49.85); c.lineTo(26, 51.1); c.lineTo(24.65, 49.85); c.fill();
  c.fillStyle = hot ? '#ffffff' : mix('#fff1b8', '#ffffff', glow);
  c.beginPath(); c.moveTo(26, 48.9); c.lineTo(26.6, 49.5); c.lineTo(26, 50.1); c.lineTo(25.4, 49.5); c.fill();
}
function drawPowerup(c, pu){
  if(pu.t < 4 && Math.floor(G.time * 6) % 2) return;
  const x = pu.x + 2, y = pu.y + 2, col = PU_COLORS[pu.type];
  c.fillStyle = '#1d2029'; c.fillRect(pu.x + 0.25, pu.y + 0.25, 3.5, 3.5);
  c.strokeStyle = col; c.lineWidth = 0.22; c.strokeRect(pu.x + 0.36, pu.y + 0.36, 3.28, 3.28);
  c.save(); c.translate(x, y); c.fillStyle = col; c.strokeStyle = col;
  switch(pu.type){
    case 'shield': c.beginPath(); c.moveTo(0, -1.2); c.lineTo(1.05, -0.75); c.lineTo(0.85, 0.55); c.lineTo(0, 1.25); c.lineTo(-0.85, 0.55); c.lineTo(-1.05, -0.75); c.fill(); break;
    case 'star': c.beginPath(); for(let i = 0; i < 10; i++){ const r = i % 2 ? 0.55 : 1.3, a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); break;
    case 'bomb': c.fillStyle = '#4a4f5c'; circle(c, -0.15, 0.25, 0.95); c.fillStyle = '#8a90a0'; circle(c, -0.45, -0.05, 0.25);
      c.lineWidth = 0.18; c.strokeStyle = '#c9a66b'; c.beginPath(); c.moveTo(0.4, -0.5); c.lineTo(0.85, -1.0); c.stroke(); c.fillStyle = col; circle(c, 0.95, -1.1, 0.28); break;
    case 'freeze': c.lineWidth = 0.26; for(let i = 0; i < 3; i++){ const a = i * Math.PI / 3; c.beginPath(); c.moveTo(Math.cos(a) * 1.25, Math.sin(a) * 1.25); c.lineTo(-Math.cos(a) * 1.25, -Math.sin(a) * 1.25); c.stroke(); } break;
    case 'fortress': c.fillStyle = COL.steelHi; c.fillRect(-1.2, -1.1, 2.4, 0.6); c.fillStyle = COL.brick;
      for(let r = 0; r < 2; r++) for(let k = 0; k < 3; k++) c.fillRect(-1.2 + k * 0.82 + (r ? 0.2 : 0), -0.3 + r * 0.72, 0.72, 0.6); break;
    case 'life': c.fillRect(-0.9, -0.5, 1.8, 1.4); c.fillStyle = '#1d2029'; circle(c, 0, 0.2, 0.45); c.fillStyle = col; c.fillRect(-0.18, -1.3, 0.36, 0.9); break;
  }
  c.restore();
}
function drawFx(c, f){
  const p = f.t / f.dur, id = f.id;
  if(f.small){ c.fillStyle = p < 0.5 ? COL.fireCore : COL.fire; circle(c, f.x, f.y, 0.4 + p * 0.6); return; }
  const R = (f.big ? 3.4 : 1.8) * (0.45 + p * 0.8);
  c.globalAlpha = 1 - p;
  c.fillStyle = COL.fire; circle(c, f.x, f.y, R);
  c.fillStyle = COL.fireCore; circle(c, f.x, f.y, R * 0.55);
  c.fillStyle = '#6b6f7a';
  for(let i = 0; i < 6; i++){ const a = (id * 1.7 + i * 1.05), d = R * 1.2; c.fillRect(f.x + Math.cos(a) * d - 0.2, f.y + Math.sin(a) * d - 0.2, 0.4, 0.4); }
  c.globalAlpha = 1;
}
function drawWater(c){
  const phase = Math.floor(G.time * 2.5);
  c.fillStyle = COL.water;
  for(const i of G.water) c.fillRect(i % F, (i / F) | 0, 1, 1);
  c.fillStyle = COL.waterHi;
  for(const i of G.water){ const x = i % F, y = (i / F) | 0; if((x + y + phase) % 3 === 0) c.fillRect(x + 0.15, y + 0.35, 0.55, 0.12); else if((x * 2 + y + phase) % 5 === 0) c.fillRect(x + 0.4, y + 0.72, 0.45, 0.1); }
}

/* HUD helpers (virtual px space) */
function text(c, str, x, y, size, color, align){
  c.font = size + 'px ' + FONT; c.fillStyle = color; c.textAlign = align || 'left'; c.textBaseline = 'top'; c.fillText(str, x, y);
}
function miniTank(c, x, y, s, color){
  c.fillStyle = color; c.fillRect(x, y + s * 0.3, s, s * 0.7); c.fillRect(x + s * 0.4, y, s * 0.2, s * 0.5);
}
function drawHUD(c){
  // left panel
  c.fillStyle = COL.panel; c.fillRect(6, 6, FX - 12, VH - 12);
  if(G.mode === 'coop' && !G.demo){
    text(c, 'STAGE', 14, 14, 6, COL.muted);
    text(c, String(G.stage), 14, 22, 18, COL.amber);
    text(c, (G.stageName || '').toUpperCase(), 14, 42, 5, COL.text);
    text(c, 'ENEMIES', 14, 58, 5, COL.muted);
    const remaining = G.roster.length;
    for(let i = 0; i < G.total; i++){
      const col = i % 5, row = Math.floor(i / 5);
      miniTank(c, 14 + col * 11, 67 + row * 10, 7, i < remaining ? '#8b909c' : '#2a2d37');
    }
    const y0 = 67 + Math.ceil(G.total / 5) * 10 + 8;
    text(c, DIFF[G.diff].label.toUpperCase() + ' MODE', 14, y0, 5, G.diff === 'kids' ? COL.frost : G.diff === 'hard' ? COL.danger : COL.muted);
    if(D().baseHp > 1){
      text(c, 'CRYSTAL', 14, y0 + 12, 5, COL.muted);
      for(let i = 0; i < D().baseHp; i++){ c.fillStyle = i < G.base.hp ? COL.amber : '#2a2d37'; c.beginPath(); const x = 18 + i * 10, y = y0 + 24; c.moveTo(x, y - 3); c.lineTo(x + 3, y); c.lineTo(x, y + 3); c.lineTo(x - 3, y); c.fill(); }
    }
    let y1 = y0 + (D().baseHp > 1 ? 36 : 14);
    if(G.freezeT > 0){ text(c, 'FREEZE ' + Math.ceil(G.freezeT), 14, y1, 6, COL.frost); y1 += 10; }
    if(G.fortressT > 0){ text(c, 'STEEL ' + Math.ceil(G.fortressT), 14, y1, 6, COL.steelHi); }
  } else if(G.mode === 'versus' && !G.demo){
    text(c, 'BATTLE', 14, 14, 8, COL.amber);
    text(c, 'FIRST TO ' + G.vsTarget, 14, 28, 6, COL.text);
    text(c, 'POWER-UPS', 14, 50, 5, COL.muted);
    text(c, 'APPEAR OFTEN', 14, 58, 5, COL.muted);
  }
  if(!G.demo) text(c, 'PAUSE: START / ESC', 14, VH - 20, 4.5, COL.muted);

  // right panel: players
  const rx = FX + F * BP + 6, rw = VW - rx - 6;
  c.fillStyle = COL.panel; c.fillRect(rx, 6, rw, VH - 12);
  if(G.demo){ text(c, 'PRESS FIRE', rx + 8, 14, 6, COL.text); text(c, 'TO PLAY', rx + 8, 24, 6, COL.text); return; }
  G.players.forEach((p, i) => {
    const y = 12 + i * 50;
    c.fillStyle = p.color; c.fillRect(rx + 6, y, 2, 40);
    miniTank(c, rx + 12, y + 1, 9, p.color);
    text(c, p.name, rx + 25, y, 9, p.color);
    if(G.mode === 'versus'){
      text(c, p.vs + ' / ' + G.vsTarget, rx + 12, y + 14, 9, COL.text);
      for(let k = 0; k < 3; k++){ c.fillStyle = k < p.level ? COL.amber : '#2a2d37'; c.fillRect(rx + 12 + k * 7, y + 30, 5, 5); }
      return;
    }
    const lives = p.lives === Infinity ? '∞' : String(Math.max(0, p.lives));
    text(c, 'LIVES ' + lives, rx + 12, y + 13, 5.5, COL.text);
    text(c, String(p.score), rx + 12, y + 21, 6, COL.text);
    for(let k = 0; k < 3; k++){ c.fillStyle = k < p.level ? COL.amber : '#2a2d37'; c.fillRect(rx + 12 + k * 7, y + 31, 5, 5); }
    if(p.out){
      const canBorrow = G.players.some(q => q !== p && q.lives >= 1 && q.lives !== Infinity);
      text(c, canBorrow ? 'FIRE = BORROW LIFE' : 'OUT', rx + 36, y + 31, 4.5, canBorrow ? COL.amber : COL.danger);
    }
  });
}

function render(){
  const c = display.ctx, s = display.scale;
  if(G.cacheStale || !terrain) rebuildCaches();
  flushDirty();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = COL.surround; c.fillRect(0, 0, canvas.width, canvas.height);

  const sx = G.shake ? (Math.random() - 0.5) * G.shake : 0, sy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  c.setTransform(s * BP, 0, 0, s * BP, s * (FX + sx), s * (FY + sy));
  c.drawImage(terrain, 0, 0, F, F);
  drawWater(c);
  drawBase(c);
  for(const sp of G.spawns) drawSparkle(c, sp);
  for(const t of G.tanks) drawTank(c, t);
  for(const b of G.bullets){
    c.fillStyle = b.owner.kind === 'player' ? COL.bulletP : COL.bulletE;
    if(b.dir % 2 === 0) c.fillRect(b.x - 0.3, b.y - 0.5, 0.6, 1); else c.fillRect(b.x - 0.5, b.y - 0.3, 1, 0.6);
  }
  c.drawImage(trees, 0, 0, F, F);
  for(const pu of G.powerups) drawPowerup(c, pu);
  for(const f of G.fx) drawFx(c, f);
  if(G.flashT > 0){ c.fillStyle = 'rgba(255,240,200,' + (G.flashT * 1.6).toFixed(2) + ')'; c.fillRect(0, 0, F, F); }

  // text layer
  c.setTransform(s, 0, 0, s, 0, 0);
  for(const p of G.popups) text(c, p.text, FX + p.x * BP, FY + p.y * BP - 6 - p.t * 14, 6, p.color, 'center');
  for(const t of G.tanks) if(t.kind === 'player' && t.labelT > 0) text(c, t.player.name, FX + (t.x + 2) * BP, FY + t.y * BP - 9, 6, t.player.color, 'center');
  c.strokeStyle = COL.line; c.lineWidth = 1; c.strokeRect(FX - 0.5, FY - 0.5, F * BP + 1, F * BP + 1);
  drawHUD(c);

  // overlays
  if(G.state === 'intro'){
    const t = G.stateT, close = Math.min(1, t / 0.35), open = t > 1.8 ? Math.min(1, (t - 1.8) / 0.4) : 0, k = close * (1 - open);
    const h = (F * BP / 2) * k;
    c.fillStyle = '#2a2d38'; c.fillRect(FX, FY, F * BP, h); c.fillRect(FX, FY + F * BP - h, F * BP, h);
    if(k > 0.95){
      text(c, G.mode === 'coop' ? 'STAGE ' + G.stage : 'BATTLE', VW / 2, VH / 2 - 16, 16, COL.amber, 'center');
      text(c, G.mode === 'coop' ? G.stageName.toUpperCase() : 'FIRST TO ' + G.vsTarget + ' WINS', VW / 2, VH / 2 + 6, 7, COL.text, 'center');
    }
  }
  if(G.state === 'overAnim'){
    const y = Math.max(VH / 2 - 10, FY + F * BP - G.stateT * 90);
    text(c, 'GAME OVER', VW / 2, y, 16, COL.danger, 'center');
  }
  if(G.state === 'vsAnim' && G.winner) text(c, G.winner.name + ' WINS!', VW / 2, VH / 2 - 10, 16, G.winner.color, 'center');
  if(G.demo && (A.Menu.isOpen() || A.Lobby.isOpen())){ c.fillStyle = 'rgba(11,12,16,0.35)'; c.fillRect(0, 0, VW, VH); }
}

/* ---------- Boot ---------- */
A.Touch.mount();
A.registerOffline();
startDemo();
const boot = () => { titleMenu(); A.run(step, render, display); };
if(document.fonts && document.fonts.load){
  Promise.race([document.fonts.load('10px "Silkscreen"'), new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
} else boot();
window.__tank = G; // handy for debugging in the browser console
window.__tankDebug = { spawnPowerup, applyPowerup, hitBase, startGameOver, destroyPlayer };
})();
