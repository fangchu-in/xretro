/* Family Arcade core — shared by every game.
   Input (keyboard, up to 4 controllers, touch), synthesized sound, crisp
   resolution-independent display, fixed-step game loop, TV-friendly menus and
   a "press A to join" lobby.
   Plain script (no modules, no build step) so it runs from a USB stick,
   file://, a Raspberry Pi, or any static web host. */
(function(){
'use strict';

/* ================= Storage (never required to work) ================= */
const Store = {
  get(key, fallback){
    try{ const v = localStorage.getItem('arcade.' + key); return v === null ? fallback : JSON.parse(v); }
    catch(e){ return fallback; }
  },
  set(key, value){ try{ localStorage.setItem('arcade.' + key, JSON.stringify(value)); }catch(e){} }
};

const Settings = Object.assign({ volume: 7, quality: 'auto' }, Store.get('settings', {}));
function saveSettings(){ Store.set('settings', { volume: Settings.volume, quality: Settings.quality }); }

/* ================= Sound (Web Audio synth, no files) ================= */
const Sound = {
  ctx: null, bus: null, master: null, noiseBuf: null,
  unlock(){
    try{
      if(!this.ctx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return;
        const c = this.ctx = new AC();
        this.master = c.createGain();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        const soften = c.createBiquadFilter();
        soften.type = 'lowpass'; soften.frequency.value = 9000;   // takes the edge off square waves on TV speakers
        this.bus = c.createGain();
        this.bus.connect(soften); soften.connect(comp); comp.connect(this.master); this.master.connect(c.destination);
        const len = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      this.applyVolume();
      if(this.ctx.state === 'suspended') this.ctx.resume();
    }catch(e){}
  },
  applyVolume(){ if(this.master) this.master.gain.value = Math.pow(Settings.volume / 10, 2) * 0.9; },
  ok(){ return this.ctx && this.ctx.state === 'running' && Settings.volume > 0; },
  env(g, t0, v, dur, attack){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t0 + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  },
  tone(o){
    if(!this.ok()) return;
    const c = this.ctx, t0 = c.currentTime + (o.at || 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.wave || 'square';
    osc.frequency.setValueAtTime(o.f, t0);
    if(o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.t);
    this.env(g, t0, o.v || 0.15, o.t, o.attack);
    osc.connect(g); g.connect(this.bus);
    osc.start(t0); osc.stop(t0 + o.t + 0.03);
  },
  noise(o){
    if(!this.ok()) return;
    const c = this.ctx, t0 = c.currentTime + (o.at || 0);
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f || 3000, t0);
    if(o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.t);
    const g = c.createGain(); this.env(g, t0, o.v || 0.2, o.t, o.attack);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.t + 0.03);
  },
  melody(notes, o){
    o = o || {}; let at = o.at || 0;
    for(const [f, d] of notes){
      if(f) this.tone({ wave: o.wave || 'square', f, t: d * (o.legato || 0.9), v: o.v || 0.12, at });
      at += d;
    }
  },
  play(name){ const fx = SFX[name]; if(fx) try{ fx(this); }catch(e){} }
};
const N = { C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494, C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988, C6:1047, E6:1319, G6:1568 };
const SFX = {
  move:    s => s.tone({ f: 520, t: 0.035, v: 0.07 }),
  select:  s => s.tone({ f: 700, t: 0.05, v: 0.1 }),
  confirm: s => { s.tone({ f: N.C5, t: 0.07, v: 0.12 }); s.tone({ f: N.G5, t: 0.1, v: 0.12, at: 0.06 }); },
  back:    s => s.tone({ f: 392, f2: 250, t: 0.1, v: 0.1 }),
  join:    s => s.melody([[N.C5, .06], [N.E5, .06], [N.G5, .1]], { v: 0.12 }),
  pause:   s => { s.tone({ f: N.B5, t: 0.06, v: 0.1 }); s.tone({ f: N.E5, t: 0.09, v: 0.1, at: 0.07 }); },
  shoot:   s => { s.tone({ f: 900, f2: 240, t: 0.08, v: 0.09 }); s.noise({ t: 0.05, v: 0.07, f: 6000, f2: 900 }); },
  brick:   s => s.noise({ t: 0.12, v: 0.2, f: 2600, f2: 300 }),
  steel:   s => { s.tone({ wave: 'triangle', f: 1900, f2: 1500, t: 0.12, v: 0.1 }); s.tone({ f: 2700, t: 0.04, v: 0.04 }); },
  armor:   s => { s.tone({ f: 320, f2: 180, t: 0.08, v: 0.12 }); s.tone({ wave: 'triangle', f: 1400, t: 0.05, v: 0.06 }); },
  explode: s => { s.noise({ t: 0.5, v: 0.32, f: 1800, f2: 70 }); s.tone({ wave: 'sawtooth', f: 150, f2: 40, t: 0.35, v: 0.1 }); },
  boom:    s => { s.noise({ t: 1.2, v: 0.45, f: 1300, f2: 40 }); s.tone({ wave: 'sawtooth', f: 95, f2: 28, t: 1.0, v: 0.16 }); },
  spawn:   s => s.tone({ wave: 'triangle', f: 240, f2: 720, t: 0.22, v: 0.05 }),
  powerAppear: s => s.melody([[N.A5, .05], [1175, .05], [1397, .05], [1760, .08]], { wave: 'triangle', v: 0.11 }),
  powerUp: s => s.melody([[N.C5, .05], [N.E5, .05], [N.G5, .05], [N.C6, .05], [N.E6, .1]], { v: 0.1 }),
  lifeUp:  s => s.melody([[N.G5, .08], [N.B5, .08], [1175, .08], [N.G6, .12], [1175, .08], [N.G6, .16]], { v: 0.1 }),
  freeze:  s => s.melody([[N.G6, .09], [N.E6, .09], [N.C6, .09], [N.G5, .16]], { wave: 'triangle', v: 0.12 }),
  bomb:    s => { s.noise({ t: 1.0, v: 0.5, f: 2500, f2: 60 }); s.tone({ wave: 'square', f: 200, f2: 30, t: 0.8, v: 0.12 }); },
  stageStart: s => { s.melody([[N.C5, .12], [N.E5, .12], [N.G5, .12], [N.C6, .24], [0, .06], [N.G5, .12], [N.C6, .36]], { v: 0.12 });
                     s.melody([[N.C4, .36], [N.G4, .36], [N.C4, .48]], { wave: 'triangle', v: 0.14 }); },
  stageClear: s => s.melody([[N.E5, .1], [N.G5, .1], [N.C6, .1], [N.E5, .1], [N.G5, .1], [N.C6, .1], [N.E6, .4]], { v: 0.11 }),
  gameOver: s => { s.melody([[N.G4, .22], [N.E4, .22], [N.C4, .22], [196, .6]], { wave: 'triangle', v: 0.16 }); },
  win:      s => s.melody([[N.C5, .1], [N.C5, .1], [N.C5, .1], [N.C5, .3], [N.A4, .3], [N.B4, .3], [N.C5, .2], [N.B4, .1], [N.C5, .5]], { v: 0.12 })
};

/* ================= Input ================= */
const KEYSETS = {
  kb1: { label: 'Keyboard: arrows + Space', up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
         fire: ['Space', 'Enter', 'NumpadEnter', 'KeyM', 'ControlRight', 'Numpad0'], back: ['Backspace'] },
  kb2: { label: 'Keyboard: W A S D + F', up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
         fire: ['KeyF', 'KeyG', 'KeyE'], back: ['KeyQ'] }
};
const PAUSE_KEYS = ['Escape', 'KeyP', 'BrowserBack', 'GoBack'];
const GAME_KEYS = new Set([].concat(...Object.values(KEYSETS).map(k => [...k.up, ...k.down, ...k.left, ...k.right, ...k.fire])));
GAME_KEYS.add('Tab');

const keysDown = new Set(), keysLatch = new Set();
function onKey(e, down){
  const code = e.code || e.key;
  if(down){ keysDown.add(code); keysLatch.add(code); Sound.unlock(); }
  else keysDown.delete(code);
  if(GAME_KEYS.has(code) || PAUSE_KEYS.includes(code)) e.preventDefault();
}
window.addEventListener('keydown', e => onKey(e, true));
window.addEventListener('keyup', e => onKey(e, false));
window.addEventListener('blur', () => keysDown.clear());
['pointerdown', 'touchend', 'mousedown'].forEach(ev => window.addEventListener(ev, () => Sound.unlock(), { passive: true }));

const BTN = ['up', 'down', 'left', 'right', 'fire', 'back', 'pause'];
function makeSource(id, kind, label){
  const s = { id, kind, label, connected: true, dir: -1, dirOrder: [0, 1, 2, 3], held: [false, false, false, false], prev: {} };
  BTN.forEach(b => { s[b] = false; s.prev[b] = false; });
  return s;
}
const sources = new Map();
sources.set('kb1', makeSource('kb1', 'kb', KEYSETS.kb1.label));
sources.set('kb2', makeSource('kb2', 'kb', KEYSETS.kb2.label));

const touchState = { up: false, down: false, left: false, right: false, fire: false, pause: false };
const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
if(isTouch) sources.set('touch', makeSource('touch', 'touch', 'Touch screen'));

let toastFn = null;
window.addEventListener('gamepadconnected', e => { toastFn && toastFn('Controller ' + (e.gamepad.index + 1) + ' connected'); Sound.unlock(); });
window.addEventListener('gamepaddisconnected', e => { toastFn && toastFn('Controller ' + (e.gamepad.index + 1) + ' disconnected'); });

function padLabel(gp){
  const name = (gp.id || '').replace(/\(.*?\)/g, '').replace(/Vendor.*$/i, '').trim();
  const short = /xbox/i.test(name) ? 'Xbox' : /playstation|dualsense|dualshock|wireless controller/i.test(name) ? 'PlayStation' : '';
  return 'Controller ' + (gp.index + 1) + (short ? ' (' + short + ')' : '');
}
function readPad(gp, s){
  const b = i => { const x = gp.buttons[i]; return !!(x && (x.pressed || x.value > 0.5)); };
  let up = b(12), down = b(13), left = b(14), right = b(15);
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if(gp.mapping !== 'standard' && gp.axes.length >= 8){      // D-pad reported as a hat on some Linux/Firefox setups
    const hx = gp.axes[6], hy = gp.axes[7];
    if(hx < -0.5) left = true; if(hx > 0.5) right = true; if(hy < -0.5) up = true; if(hy > 0.5) down = true;
  }
  if(Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5){
    if(Math.abs(ax) > Math.abs(ay)){ if(ax < 0) left = true; else right = true; }
    else { if(ay < 0) up = true; else down = true; }
  }
  s.up = up; s.down = down; s.left = left; s.right = right;
  s.fire = b(0) || b(2) || b(3) || b(5) || b(7);   // A, X, Y, RB, RT
  s.back = b(1) || b(8);                            // B, View/Back
  s.pause = b(9);                                   // Menu/Start
  if(s.fire || s.pause) Sound.unlock();
}
function updateDir(s){
  const now = [s.up, s.right, s.down, s.left];
  for(let i = 0; i < 4; i++) if(now[i] && !s.held[i]) s.dirOrder = [i].concat(s.dirOrder.filter(x => x !== i));
  s.held = now; s.dir = -1;
  for(const i of s.dirOrder) if(now[i]){ s.dir = i; break; }
}

const Input = {
  isTouch,
  poll(){
    for(const s of sources.values()) BTN.forEach(b => { s.prev[b] = s[b]; });
    for(const id of ['kb1', 'kb2']){
      const s = sources.get(id), k = KEYSETS[id];
      const on = list => list.some(c => keysDown.has(c) || keysLatch.has(c));
      s.up = on(k.up); s.down = on(k.down); s.left = on(k.left); s.right = on(k.right);
      s.fire = on(k.fire); s.back = on(k.back); s.pause = id === 'kb1' && on(PAUSE_KEYS);
    }
    keysLatch.clear();
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const seen = new Set();
    for(const gp of pads){
      if(!gp || !gp.connected) continue;
      const id = 'pad' + gp.index; seen.add(id);
      let s = sources.get(id);
      if(!s){ s = makeSource(id, 'pad', padLabel(gp)); sources.set(id, s); }
      s.connected = true; readPad(gp, s);
    }
    for(const s of sources.values()) if(s.kind === 'pad' && !seen.has(s.id)){ s.connected = false; BTN.forEach(b => { s[b] = false; }); }
    const t = sources.get('touch');
    if(t) Object.assign(t, touchState);
    for(const s of sources.values()) updateDir(s);
  },
  all(){ return Array.from(sources.values()).filter(s => s.connected); },
  get(id){ return sources.get(id) || null; },
  pressed(s, b){ return !!(s && s[b] && !s.prev[b]); },
  pads(){ return Array.from(sources.values()).filter(s => s.kind === 'pad' && s.connected); }
};

/* ================= Touch controls ================= */
const Touch = {
  el: null,
  mount(){
    if(!isTouch || this.el) return;
    const ui = document.createElement('div'); ui.className = 'touch-ui'; ui.hidden = true;
    ui.innerHTML = '<div class="touch-stick"><div class="touch-knob"></div></div>' +
                   '<div class="touch-fire">FIRE</div><button class="touch-pause" type="button">II</button>';
    document.body.appendChild(ui); this.el = ui;
    const stick = ui.querySelector('.touch-stick'), knob = ui.querySelector('.touch-knob');
    let pid = null;
    const move = e => {
      const r = stick.getBoundingClientRect(), R = r.width / 2;
      let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
      const d = Math.hypot(dx, dy); if(d > R){ dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      const nx = dx / R, ny = dy / R, dead = 0.3;
      touchState.up = touchState.down = touchState.left = touchState.right = false;
      if(Math.hypot(nx, ny) > dead){
        if(Math.abs(nx) > Math.abs(ny)){ if(nx < 0) touchState.left = true; else touchState.right = true; }
        else { if(ny < 0) touchState.up = true; else touchState.down = true; }
      }
    };
    const end = () => { pid = null; knob.style.transform = 'translate(-50%,-50%)'; touchState.up = touchState.down = touchState.left = touchState.right = false; };
    stick.addEventListener('pointerdown', e => { pid = e.pointerId; stick.setPointerCapture(pid); move(e); e.preventDefault(); });
    stick.addEventListener('pointermove', e => { if(e.pointerId === pid) move(e); });
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const fire = ui.querySelector('.touch-fire');
    fire.addEventListener('pointerdown', e => { touchState.fire = true; fire.classList.add('on'); fire.setPointerCapture(e.pointerId); e.preventDefault(); });
    const fireEnd = () => { touchState.fire = false; fire.classList.remove('on'); };
    fire.addEventListener('pointerup', fireEnd); fire.addEventListener('pointercancel', fireEnd);
    const pause = ui.querySelector('.touch-pause');
    pause.addEventListener('pointerdown', e => { touchState.pause = true; e.preventDefault(); });
    pause.addEventListener('pointerup', () => { setTimeout(() => { touchState.pause = false; }, 50); });
  },
  show(on){ if(this.el) this.el.hidden = !on; }
};

/* ================= DOM helpers, toast ================= */
function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
let toastEl = null, toastTimer = 0;
function toast(msg){
  if(!toastEl){ toastEl = el('div', 'toast'); toastEl.hidden = true; document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}
toastFn = toast;

/* ================= Menu (controller, keyboard, remote, mouse, touch) ================= */
const Menu = {
  def: null, idx: 0, layer: null, btns: [],
  ensure(){ if(!this.layer){ this.layer = el('div', 'ui-layer'); this.layer.hidden = true; document.body.appendChild(this.layer); } },
  open(def){
    this.ensure(); Lobby.close();
    this.def = def; this.idx = def.start || 0;
    this.layer.className = 'ui-layer' + (def.center ? ' center' : '');
    this.render(); this.layer.hidden = false;
  },
  close(){ this.def = null; if(this.layer) this.layer.hidden = true; },
  isOpen(){ return !!this.def; },
  render(){
    const d = this.def; this.layer.innerHTML = '';
    const p = el('div', 'menu-panel');
    if(d.kicker) p.appendChild(el('div', 'menu-kicker', d.kicker));
    p.appendChild(el('h1', 'menu-title', d.title));
    if(d.text) p.appendChild(el('p', 'menu-text', d.text));
    const list = el('div', 'menu-items');
    this.btns = d.items.map((it, i) => {
      const b = el('button', 'menu-item');
      b.type = 'button'; b.tabIndex = -1;
      b.innerHTML = '<span class="mi-label"></span>' + (it.value ? '<span class="mi-value"><i>&lsaquo;</i><b></b><i>&rsaquo;</i></span>' : '');
      b.querySelector('.mi-label').textContent = it.label;
      b.addEventListener('click', e => {
        Sound.unlock(); this.idx = i;
        const left = it.value && e.target.tagName === 'I' && e.target === b.querySelector('.mi-value i');
        this.activate(left ? -1 : 1, null);
      });
      b.addEventListener('pointerenter', e => { if(e.pointerType === 'mouse') this.focus(i, true); });
      list.appendChild(b); return b;
    });
    p.appendChild(list);
    if(d.footer) p.appendChild(el('div', 'menu-footer', d.footer));
    this.layer.appendChild(p);
    this.refresh();
  },
  refresh(){
    if(!this.def) return;
    this.btns.forEach((b, i) => {
      b.classList.toggle('focus', i === this.idx);
      const it = this.def.items[i];
      if(it.value) b.querySelector('.mi-value b').textContent = it.value();
    });
  },
  focus(i, quiet){ if(i !== this.idx){ this.idx = i; if(!quiet) Sound.play('move'); this.refresh(); } },
  activate(dirn, src){
    const it = this.def && this.def.items[this.idx]; if(!it) return;
    if(it.value){ if(it.change){ it.change(dirn); Sound.play('select'); this.refresh(); } }
    else if(it.select){ Sound.play('confirm'); it.select(src); }
  },
  update(){
    if(!this.def) return false;
    const n = this.def.items.length;
    for(const s of Input.all()){
      if(!this.def) break;
      if(Input.pressed(s, 'up')) this.focus((this.idx - 1 + n) % n);
      else if(Input.pressed(s, 'down')) this.focus((this.idx + 1) % n);
      else if(Input.pressed(s, 'left') && this.def.items[this.idx].value) this.activate(-1, s);
      else if(Input.pressed(s, 'right') && this.def.items[this.idx].value) this.activate(1, s);
      else if(Input.pressed(s, 'fire')){ this.activate(1, s); break; }
      else if(Input.pressed(s, 'back') || Input.pressed(s, 'pause')){ if(this.def.back){ Sound.play('back'); this.def.back(); break; } }
    }
    return true;
  }
};

/* ================= Lobby: everyone presses FIRE to join ================= */
const Lobby = {
  cfg: null, layer: null, slots: [], countdown: -1, lastText: '',
  open(cfg){
    Menu.close();
    if(!this.layer){ this.layer = el('div', 'ui-layer center'); this.layer.hidden = true; document.body.appendChild(this.layer); }
    this.cfg = cfg; this.slots = []; this.countdown = -1; this.lastText = '';
    if(cfg.initial && cfg.initial !== 'touch') this.slots.push({ source: cfg.initial, ready: false });
    this.render(); this.layer.hidden = false;
  },
  close(){ this.cfg = null; if(this.layer) this.layer.hidden = true; },
  isOpen(){ return !!this.cfg; },
  srcLabel(id){ const s = Input.get(id); return s ? s.label : id; },
  render(){
    const c = this.cfg; this.layer.innerHTML = '';
    const wrap = el('div', 'lobby');
    wrap.appendChild(el('div', 'menu-kicker', c.kicker || 'Who is playing?'));
    wrap.appendChild(el('h1', 'menu-title', c.title));
    wrap.appendChild(el('p', 'menu-text', c.text || ''));
    const grid = el('div', 'lobby-slots');
    for(let i = 0; i < c.max; i++){
      const slot = this.slots[i];
      const card = el('div', 'slot' + (slot ? ' joined' : '') + (slot && slot.ready ? ' ready' : ''));
      card.style.setProperty('--slot-color', c.colors[i]);
      card.appendChild(el('div', 'slot-tag', 'P' + (i + 1)));
      const src = el('div', 'slot-src'); src.textContent = slot ? this.srcLabel(slot.source) : ''; card.appendChild(src);
      card.appendChild(el('div', 'slot-state', !slot ? 'Press FIRE to join' : slot.ready ? 'Ready!' : 'Press FIRE when ready'));
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
    this.countEl = el('div', 'lobby-count', ''); wrap.appendChild(this.countEl);
    const actions = el('div', 'lobby-actions');
    if(isTouch){
      const tb = el('button', 'btn primary', 'Tap to join / ready'); tb.type = 'button';
      tb.addEventListener('click', () => { Sound.unlock(); goLandscape(); this.press('touch'); });
      actions.appendChild(tb);
    }
    const back = el('button', 'btn', 'Back'); back.type = 'button';
    back.addEventListener('click', () => { const cb = this.cfg.onBack; this.close(); Sound.play('back'); cb(); });
    actions.appendChild(back);
    wrap.appendChild(actions);
    wrap.appendChild(el('div', 'menu-footer',
      'Controller: <span class="keycap">A</span> join / ready, <span class="keycap">B</span> leave. ' +
      'Keyboard: <span class="keycap">Arrows</span>+<span class="keycap">Space</span> or <span class="keycap">WASD</span>+<span class="keycap">F</span>. ' +
      '<span class="keycap">Esc</span> goes back.'));
    this.layer.appendChild(wrap);
  },
  press(id){
    const slot = this.slots.find(x => x.source === id);
    if(!slot){
      if(this.slots.length >= this.cfg.max) return;
      this.slots.push({ source: id, ready: false }); Sound.play('join');
    } else { slot.ready = !slot.ready; Sound.play(slot.ready ? 'confirm' : 'back'); }
    this.render();
  },
  update(){
    if(!this.cfg) return false;
    for(const s of Input.all()){
      if(!this.cfg) return true;
      if(s.kind === 'touch') continue;               // touch players use the on-screen button
      const slot = this.slots.find(x => x.source === s.id);
      if(Input.pressed(s, 'fire')) this.press(s.id);
      else if(Input.pressed(s, 'back') || Input.pressed(s, 'pause')){
        if(slot){
          if(slot.ready) slot.ready = false; else this.slots.splice(this.slots.indexOf(slot), 1);
          Sound.play('back'); this.render();
        } else if(this.slots.length === 0 || s.kind === 'kb'){
          const cb = this.cfg.onBack; this.close(); Sound.play('back'); cb(); return true;
        }
      }
    }
    // drop players whose controller vanished
    const before = this.slots.length;
    this.slots = this.slots.filter(x => { const s = Input.get(x.source); return s && s.connected; });
    if(this.slots.length !== before) this.render();

    const enough = this.slots.length >= this.cfg.min;
    const allReady = enough && this.slots.every(x => x.ready);
    let text;
    if(allReady){
      if(this.countdown < 0) this.countdown = 1.5;
      this.countdown -= 1 / 60;
      text = 'Starting in ' + Math.max(1, Math.ceil(this.countdown)) + '…';
      if(this.countdown <= 0){
        const players = this.slots.map((x, i) => ({ slot: i, source: x.source, color: this.cfg.colors[i] }));
        const cb = this.cfg.onStart; this.close(); cb(players); return true;
      }
    } else {
      this.countdown = -1;
      text = !enough ? (this.cfg.min > 1 ? 'Needs at least ' + this.cfg.min + ' players' : '') :
             'Waiting for everyone to press FIRE…';
    }
    if(text !== this.lastText){ this.lastText = text; this.countEl.textContent = text; }
    return true;
  }
};

/* ================= Display: crisp at any resolution ================= */
function Display(canvas, vw, vh){
  this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
  this.vw = vw; this.vh = vh; this.scale = 1; this.dyn = 1; this.onResize = null;
  this.ema = 16; this.slowFor = 0; this.fastFor = 0;
  const fit = () => this.resize();
  window.addEventListener('resize', fit);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', fit);
  this.resize();
}
Display.prototype.resize = function(){
  const cw = window.innerWidth, ch = window.innerHeight, dpr = window.devicePixelRatio || 1;
  const fit = Math.min(cw / this.vw, ch / this.vh);
  const cssW = Math.floor(this.vw * fit), cssH = Math.floor(this.vh * fit);
  this.canvas.style.width = cssW + 'px'; this.canvas.style.height = cssH + 'px';
  let px = fit * dpr;
  const cap = { auto: 2160, high: 2160, medium: 1080, low: 720 }[Settings.quality] || 2160;
  if(this.vh * px > cap) px = cap / this.vh;
  if(Settings.quality === 'auto') px *= this.dyn;
  this.canvas.width = Math.max(1, Math.round(this.vw * px));
  this.canvas.height = Math.max(1, Math.round(this.vh * px));
  this.scale = this.canvas.width / this.vw;
  this.ctx.imageSmoothingEnabled = true;
  if(this.onResize) this.onResize(this.scale);
};
/* Auto quality: if frames are slow (e.g. Pi Zero at 4K) render fewer pixels. */
Display.prototype.track = function(dt){
  if(Settings.quality !== 'auto' || dt > 0.2) return;
  this.ema = this.ema * 0.95 + dt * 1000 * 0.05;
  if(this.ema > 21){ this.slowFor += dt; this.fastFor = 0; } else if(this.ema < 13){ this.fastFor += dt; this.slowFor = 0; } else { this.slowFor = 0; this.fastFor = 0; }
  if(this.slowFor > 1.5 && this.dyn > 0.35){ this.dyn *= 0.8; this.slowFor = 0; this.ema = 16; this.resize(); }
  else if(this.fastFor > 8 && this.dyn < 1){ this.dyn = Math.min(1, this.dyn * 1.12); this.fastFor = 0; this.resize(); }
};
Display.prototype.resolutionLabel = function(){ return this.canvas.width + '×' + this.canvas.height; };

/* ================= Loop: fixed 60 steps/second on every device ================= */
function run(step, render, display){
  const STEP = 1 / 60; let acc = 0, last = performance.now();
  function frame(now){
    let dt = (now - last) / 1000; last = now;
    if(dt > 0.25) dt = 0.25;
    acc += dt; let n = 0;
    while(acc >= STEP && n < 5){ Input.poll(); step(STEP); acc -= STEP; n++; }
    if(n === 5) acc = 0;
    render(dt);
    if(display) display.track(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* ================= Misc ================= */
let wakeLock = null;
async function keepAwake(){
  try{ if('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && wakeLock) keepAwake(); });
function toggleFullscreen(){
  try{
    if(document.fullscreenElement) document.exitFullscreen();
    else if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => toast('Fullscreen is not available here'));
    else toast('Fullscreen is not available here');
  }catch(e){ toast('Fullscreen is not available here'); }
}
/* Phones: fullscreen + landscape. Must run inside a tap, so the lobby's touch button calls it. */
function goLandscape(){
  try{
    const lock = () => { try{ if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }catch(e){} };
    if(!document.fullscreenElement && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().then(lock, () => {});
    else lock();
  }catch(e){}
}
function registerOffline(){
  if(!/^https?:$/.test(location.protocol) || !('serviceWorker' in navigator)) return;
  try{ navigator.serviceWorker.register('sw.js').catch(() => {}); }catch(e){}
}

window.Arcade = {
  Store, Settings, saveSettings, Sound, Input, Touch, Menu, Lobby, Display, run, toast, keepAwake, toggleFullscreen, goLandscape, registerOffline, el,
  PLAYER_COLORS: ['#f5c542', '#3fd0b0', '#7aa8ff', '#ff7eb6'],
  QUALITY_LABELS: { auto: 'Auto', high: 'Up to 4K', medium: '1080p', low: '720p' }
};
})();
