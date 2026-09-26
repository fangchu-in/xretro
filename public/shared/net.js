/* xRetro online play.
   One device HOSTS: it runs the game exactly as it would offline. Other devices
   JOIN with a 4-letter room code: they send their buttons to the host and draw
   what the host sends back. A remote player is just one more input source, so
   the lobby, menus and game code barely know the difference.

   Relay: xretro.pages.dev/rooms/CODE (a Cloudflare Durable Object, see /server). */
(function(){
'use strict';
const A = window.Arcade;
const CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';     // no vowels, so codes never spell words
const KEEPALIVE = 20000;

function peerId(){
  let id = null;
  try{ id = sessionStorage.getItem('xretro.peer'); }catch(e){}
  if(!id){ id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); try{ sessionStorage.setItem('xretro.peer', id); }catch(e){} }
  return id;
}
function roomUrl(code){
  const q = new URLSearchParams(location.search).get('server');
  if(q) return q.replace(/\/$/, '') + '/rooms/' + code;
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/rooms/' + code;
}
function randomCode(){ let s = ''; for(let i = 0; i < 4; i++) s += CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]; return s; }
const WHY = {
  'no-room': 'No game with that code. Check the letters with the host.',
  'taken': 'That room is already in use.',
  'full': 'That room is full.',
  'offline': 'Could not reach the xRetro server. Check the internet connection.',
  'kicked': 'You left the room.',
  'closed': 'The host closed the room.',
  'host-left': 'The host has left, so the game ended.'
};

const Net = {
  role: null, code: null, peer: peerId(), ws: null, game: '', name: '', hostName: '', h: {},
  peers: new Map(), closing: false, retry: 0, retryTimer: 0, pingTimer: 0, awaySince: 0,
  lastUi: '', uiCache: null, pill: null, playing: false, lastSend: 0, lastPacket: '', srcNames: {}, sentMeta: '',

  available(){ return /^https?:$/.test(location.protocol); },
  why(code){ return WHY[code] || (String(code).startsWith('other-game:') ? 'That room is playing a different game.' : 'Something went wrong (' + code + ').'); },
  inviteLink(code){ return location.origin + location.pathname.replace(/[^/]*$/, '') + (this.game || 'index') + '.html?room=' + code; },

  /* ---------- connecting ---------- */
  open(role, code){
    return new Promise((resolve, reject) => {
      let settled = false, ws;
      const q = 'role=' + role + '&peer=' + encodeURIComponent(this.peer) + '&name=' + encodeURIComponent(this.name) + '&game=' + encodeURIComponent(this.game);
      try{ ws = new WebSocket(roomUrl(code) + '?' + q); }catch(e){ reject('offline'); return; }
      const timer = setTimeout(() => { if(!settled){ settled = true; try{ ws.close(); }catch(e){} reject('offline'); } }, 8000);
      ws.onmessage = ev => {
        if(ev.data === 'pong') return;
        let m; try{ m = JSON.parse(ev.data); }catch(e){ return; }
        if(!settled){
          settled = true; clearTimeout(timer);
          if(m.t === 'err'){ reject(m.why); return; }
          if(m.t === 'welcome'){ this.ws = ws; this.code = code; this.role = role; this.hostName = m.hostName; this.welcome(m); resolve(m); return; }
        }
        this.onMessage(m);
      };
      ws.onclose = () => { clearTimeout(timer); if(!settled){ settled = true; reject('offline'); return; } if(this.ws === ws) this.dropped(); };
      ws.onerror = () => {};
    });
  },
  welcome(m){
    this.retry = 0; this.awaySince = 0;
    clearInterval(this.pingTimer);
    this.pingTimer = setInterval(() => { try{ this.ws && this.ws.send('ping'); }catch(e){} }, KEEPALIVE);
    if(this.role === 'host'){ for(const p of m.peers || []) this.peers.set(p.id, p); }
    this.updatePill();
  },
  async host(game, name, handlers){
    this.game = game; this.name = name; this.h = handlers || {}; this.closing = false; this.peers.clear();
    for(let i = 0; i < 6; i++){
      try{ await this.open('host', randomCode()); this.lastUi = ''; return this.code; }
      catch(e){ if(e !== 'taken') throw e; }
    }
    throw 'taken';
  },
  async join(code, game, name, handlers){
    this.game = game; this.name = name; this.h = handlers || {}; this.closing = false;
    await this.open('guest', code.toUpperCase());
    return this.code;
  },
  dropped(){
    this.ws = null;
    if(this.closing || !this.role) return;
    this.awaySince = this.awaySince || Date.now();
    this.updatePill();
    const role = this.role, code = this.code;
    const wait = Math.min(8000, 700 * Math.pow(1.7, this.retry++));
    if(Date.now() - this.awaySince > 45000){ this.end('offline'); return; }
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      if(this.closing || this.role !== role) return;
      this.open(role, code).then(() => { A.toast('Back online'); if(this.h.onReconnect) this.h.onReconnect(); },
        why => { if(why === 'no-room' || why === 'taken') this.end(role === 'guest' ? 'host-left' : 'taken'); else this.dropped(); });
    }, wait);
  },
  close(){
    if(!this.role) return;
    this.closing = true;
    if(this.role === 'host') this.broadcast({ t: 'bye', why: 'closed' });
    const ws = this.ws; this.ws = null;
    setTimeout(() => { try{ ws && ws.close(1000, 'bye'); }catch(e){} }, 60);
    this.reset();
  },
  end(why){
    const cb = this.h.onEnd; const ws = this.ws; this.ws = null; this.closing = true;
    try{ ws && ws.close(); }catch(e){}
    this.reset();
    A.Sound.play('leave');
    if(cb) cb(why); else A.toast(this.why(why), 4000);
  },
  reset(){
    clearInterval(this.pingTimer); clearTimeout(this.retryTimer);
    if(this.role === 'host') for(const id of this.peers.keys()) A.Input.Remote.disconnect(id + '/');
    this.role = null; this.code = null; this.peers.clear(); this.lastUi = ''; this.uiCache = null;
    Mirror.hide(); this.updatePill();
  },

  /* ---------- sending ---------- */
  raw(s){ try{ if(this.ws && this.ws.readyState === 1){ this.ws.send(s); return true; } }catch(e){} return false; },
  send(obj){ return this.raw(JSON.stringify(obj)); },                    // guest → host, or host → everyone
  broadcast(obj){ return this.role === 'host' && this.raw(JSON.stringify(obj)); },
  to(peer, obj){ return this.raw(JSON.stringify({ to: peer, m: obj })); },
  kick(peer, why){ this.raw(JSON.stringify({ to: peer, m: { t: 'bye', why: why || 'kicked' }, kick: true })); },
  hasGuests(){ return this.role === 'host' && this.peers.size > 0; },
  peerOf(sourceId){ const i = String(sourceId).indexOf('/'); return i > 0 ? sourceId.slice(0, i) : null; },
  isMine(sourceId){ return String(sourceId).startsWith(this.peer + '/'); },

  /* ---------- receiving ---------- */
  onMessage(m){
    if(this.role === 'host'){
      if(m.t === 'join'){
        const was = this.peers.has(m.id);
        this.peers.set(m.id, { id: m.id, name: m.name });
        if(!was){ A.toast(m.name + ' joined the room'); A.Sound.play('online'); }
        if(this.uiCache) this.to(m.id, { t: 'ui', ui: this.uiCache });
        if(this.h.onPeer) this.h.onPeer(m.id);
        this.updatePill();
      } else if(m.t === 'leave'){
        const p = this.peers.get(m.id); this.peers.delete(m.id);
        A.Input.Remote.disconnect(m.id + '/');
        if(p){ A.toast(p.name + ' left the room'); A.Sound.play('leave'); }
        if(this.h.onLeave) this.h.onLeave(m.id);
        this.updatePill();
      } else if(m.t === 'from') this.fromGuest(m.from, m.m || {});
      return;
    }
    // guest
    if(m.t === 'ui'){ this.uiCache = m.ui; Mirror.show(m.ui); return; }
    if(m.t === 'bye'){ this.end(m.why || 'closed'); return; }
    if(m.t === 'host-away'){ this.awaySince = Date.now(); this.updatePill(); return; }
    if(m.t === 'host-back'){ this.awaySince = 0; this.updatePill(); return; }
    if(m.t === 'cel'){ if(A.Celebrate) A.Celebrate.show(m.o, true); return; }     // NEW BEST! on every screen
    if(this.h.onMessage) this.h.onMessage(m);
  },
  fromGuest(peer, m){
    const who = this.peers.get(peer);
    if(m.t === 'in'){
      const keys = Array.from(new Set(Object.keys(m.s || {}).concat(Object.keys(m.n || {})))).slice(0, 4);
      for(const src of keys){
        const id = peer + '/' + src;
        const name = m.n && m.n[src] ? A.Names.clean(m.n[src], 10) : null;
        const known = A.Input.get(id);
        const label = m.l && m.l[src] ? 'Online · ' + String(m.l[src]).slice(0, 28) : (known ? known.label : 'Online');
        const s = A.Input.Remote.ensure(id, label, name || (known && known.name) || (who && who.name));
        if(m.s && m.s[src]) A.Input.Remote.feed(id, m.s[src]);
        if(name && name !== s.lastName){ s.lastName = name; if(A.Lobby.isOpen()) A.Lobby.setName(id, name); if(this.h.onRename) this.h.onRename(id, name); }
      }
    } else if(m.t === 'menu'){
      const src = A.Input.all().find(s => s.kind === 'net' && s.id.startsWith(peer + '/'));
      A.Menu.remoteSelect(m.i | 0, src || { id: peer + '/?', kind: 'net' });
    } else if(this.h.onGuestMessage) this.h.onGuestMessage(peer, m);
  },

  /* ---------- per-frame work (call from the game's step) ---------- */
  hostTick(){
    if(this.role !== 'host') return;
    let ui = null;
    if(A.TextEntry.isOpen()) ui = { menu: { title: 'One moment', text: 'The host is typing…', center: true, items: [], idx: 0 } };
    else if(A.Lobby.isOpen()) ui = { lobby: A.Lobby.snapshot() };
    else if(A.Menu.isOpen()) ui = { menu: A.Menu.snapshot() };
    const s = JSON.stringify(ui);
    if(s !== this.lastUi){ this.lastUi = s; this.uiCache = ui; this.raw('{"t":"ui","ui":' + s + '}'); }
  },
  guestTick(){
    if(this.role !== 'guest') return;
    Mirror.localControls();
    const quiet = A.TextEntry.isOpen() || A.Menu.isOpen();
    const pk = {}, names = {}, labels = {};
    for(const s of A.Input.local()){
      if(!s.used) continue;
      pk[s.id] = quiet ? [0, (s.edge || [0, 0, 0])[0], (s.edge || [0, 0, 0])[1], (s.edge || [0, 0, 0])[2]] : A.Input.packSource(s);
      if(!this.srcNames[s.id]) this.srcNames[s.id] = A.Names.forSource(s.id, Object.values(this.srcNames));
      names[s.id] = this.srcNames[s.id]; labels[s.id] = s.label;
    }
    const body = JSON.stringify(pk), now = performance.now();
    if((body !== this.lastPacket && now - this.lastSend > 30) || now - this.lastSend > 500){
      const meta = JSON.stringify(names);
      const msg = { t: 'in', s: pk };
      if(meta !== this.sentMeta || now - this.lastMeta > 3000){ msg.n = names; msg.l = labels; this.sentMeta = meta; this.lastMeta = now; }
      if(this.send(msg)){ this.lastPacket = body; this.lastSend = now; }
    }
  },
  renameLocal(srcId, name){
    this.srcNames[srcId] = name; A.Names.set(srcId, name); this.sentMeta = '';
  },

  /* ---------- the little "online" pill ---------- */
  setPlaying(on){ this.playing = on; this.updatePill(); },
  updatePill(){
    if(!this.pill){ this.pill = A.el('div', 'net-pill'); this.pill.hidden = true; document.body.appendChild(this.pill); }
    const p = this.pill;
    if(!this.role && !this.awaySince){ p.hidden = true; return; }
    const warn = !this.ws || this.awaySince;
    let t;
    if(!this.role) t = '';
    else if(!this.ws) t = 'Reconnecting…';
    else if(this.role === 'guest' && this.awaySince) t = 'Waiting for ' + (this.hostName || 'the host') + '…';
    else if(this.role === 'host') t = 'Room ' + this.code + ' · ' + (this.peers.size ? this.peers.size + ' device' + (this.peers.size > 1 ? 's' : '') + ' online' : 'waiting for friends');
    else t = 'Online · ' + (this.hostName || 'host') + '’s room ' + this.code;
    p.textContent = t; p.classList.toggle('warn', !!warn);
    p.hidden = !t || (this.playing && !warn);
  }
};

/* ---------- Guests: show the host's menus and lobby ---------- */
const Mirror = {
  layer: null, ui: null, key: '',
  ensure(){ if(!this.layer){ this.layer = A.el('div', 'ui-layer mirror-layer'); this.layer.hidden = true; document.body.appendChild(this.layer); } },
  hide(){ this.ui = null; this.key = ''; if(this.layer) this.layer.hidden = true; },
  mySlots(){ return this.ui && this.ui.lobby ? this.ui.lobby.slots.filter(s => Net.isMine(s.src)) : []; },
  show(ui){
    this.ensure(); this.ui = ui;
    if(!ui){ this.layer.hidden = true; this.key = ''; return; }
    const key = JSON.stringify(ui); if(key === this.key) return; this.key = key;
    this.layer.innerHTML = '';
    if(ui.lobby){
      const m = Object.assign({}, ui.lobby);
      m.slots = m.slots.map(s => Object.assign({}, s, { mine: Net.isMine(s.src), canRename: Net.isMine(s.src) && !s.ready, label: Net.isMine(s.src) ? 'This device' : s.label }));
      m.footer = 'You are in ' + A.esc(Net.hostName || 'the host') + '’s room. Press <span class="keycap">A</span> / FIRE to join, again when ready. <span class="keycap">▲</span> changes your name.';
      this.layer.className = 'ui-layer center mirror-layer';
      const { wrap } = A.dom.lobbyDom(m, {
        touch: A.Input.isTouch ? () => A.Input.tapTouch('fire') : null,
        back: () => Net.end('kicked'), backLabel: 'Leave room',
        rename: i => this.rename(m.slots[i]),
        share: room => A.shareInvite(room)
      });
      this.layer.appendChild(wrap);
    } else if(ui.menu){
      this.layer.className = 'ui-layer mirror-layer' + (ui.menu.center ? ' center' : '');
      const { panel } = A.dom.menuDom(ui.menu, i => { A.Sound.unlock(); Net.send({ t: 'menu', i }); });
      if(!ui.menu.items.length){
        const acts = A.el('div', 'lobby-actions');
        const b = A.el('button', 'btn', 'Leave room'); b.type = 'button'; b.addEventListener('click', () => Net.end('kicked'));
        acts.appendChild(b); panel.appendChild(acts);
      }
      this.layer.appendChild(panel);
    }
    this.layer.hidden = false;
  },
  rename(slot){
    if(!slot || !slot.mine || slot.ready) return;
    const srcId = slot.src.slice(Net.peer.length + 1);
    A.TextEntry.open({ kicker: 'Online', title: 'Your name', value: slot.name, max: 10, src: srcId,
      onDone: v => { Net.renameLocal(srcId, v); Net.send({ t: 'in', s: {}, n: { [srcId]: v } }); } });
  },
  /* Guests' own controllers: ▲ renames, B with no slot leaves. Everything else goes to the host. */
  localControls(){
    if(A.TextEntry.isOpen()){ A.TextEntry.update(); return; }
    if(!this.ui || !this.ui.lobby) return;
    const mine = this.mySlots();
    for(const s of A.Input.local()){
      const slot = mine.find(x => x.src === Net.peer + '/' + s.id);
      if(slot && A.Input.pressed(s, 'up') && !slot.ready){ this.rename(slot); return; }
      if(!slot && (A.Input.pressed(s, 'back') || (s.kind === 'kb' && A.Input.pressed(s, 'pause'))) && !mine.length){ Net.end('kicked'); return; }
    }
  }
};

/* ---------- Guests: smooth motion between the host's snapshots ---------- */
function SnapBuffer(delay){ this.list = []; this.clock = null; this.delay = delay || 0.075; }
SnapBuffer.prototype.push = function(s){
  if(this.list.length && s.tm < this.list[this.list.length - 1].tm - 1) this.list = [];   // host restarted its clock
  this.list.push(s); if(this.list.length > 30) this.list.shift();
};
SnapBuffer.prototype.sample = function(dt){
  const L = this.list; if(!L.length) return null;
  const target = L[L.length - 1].tm - this.delay;
  if(this.clock === null || Math.abs(target - this.clock) > 0.5) this.clock = target;
  else this.clock += dt + (target - this.clock) * 0.08;
  let a = L[0], b = L[0];
  for(let i = 0; i < L.length; i++){ if(L[i].tm <= this.clock) a = L[i]; if(L[i].tm >= this.clock){ b = L[i]; break; } b = L[i]; }
  const span = b.tm - a.tm, t = span > 0 ? Math.max(0, Math.min(1, (this.clock - a.tm) / span)) : 1;
  while(L.length > 2 && L[1].tm < this.clock - 0.2) L.shift();
  return { a, b, t };
};
SnapBuffer.prototype.clear = function(){ this.list = []; this.clock = null; };

/* ---------- Online menus every game can reuse ---------- */
function codeEntry(onCode, onBack){
  A.TextEntry.open({ kicker: 'Join a friend', title: 'Room code', text: 'Type the 4 letters shown on the host’s screen.', value: '', max: 4, letters: true,
    onDone: onCode, onCancel: onBack });
}
function askName(then, onBack){
  A.TextEntry.open({ kicker: 'Online', title: 'Your name', text: 'Shown to everyone in the room.', value: A.Names.device() || '', max: 10,
    onDone: v => { A.Names.setDevice(v); then(v); }, onCancel: onBack });
}

A.Net = Net; A.Mirror = Mirror; A.SnapBuffer = SnapBuffer; A.Online = { codeEntry, askName, randomCode };
})();
