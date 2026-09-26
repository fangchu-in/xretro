/* xRetro core — shared by every game.
   Input (keyboard, up to 4 controllers, touch, and players joining online),
   synthesized sound effects and music, crisp resolution-independent display,
   fixed-step game loop, TV-friendly menus, name entry and a "press A to join" lobby.
   Plain script (no modules, no build step) so it runs from a USB stick,
   file://, a laptop or any static web host. */
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

const Settings = Object.assign({ volume: 7, music: 6, quality: 'auto' }, Store.get('settings', {}));
function saveSettings(){ Store.set('settings', { volume: Settings.volume, music: Settings.music, quality: Settings.quality }); }

/* ================= Sound (Web Audio synth, no files) ================= */
const Sound = {
  ctx: null, bus: null, musicBus: null, noiseBuf: null, pulse: {},
  unlock(){
    try{
      if(!this.ctx){
        const AC = window.AudioContext || window.webkitAudioContext;
        if(!AC) return;
        const c = this.ctx = new AC();
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        const soften = c.createBiquadFilter();
        soften.type = 'lowpass'; soften.frequency.value = 9000;   // takes the edge off square waves on TV speakers
        this.bus = c.createGain(); this.musicBus = c.createGain();
        this.bus.connect(soften); this.musicBus.connect(soften); soften.connect(comp); comp.connect(c.destination);
        const len = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        // Narrow pulse waves give music that classic chip sound.
        for(const duty of [0.125, 0.25]){
          const n = 32, re = new Float32Array(n), im = new Float32Array(n);
          for(let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
          this.pulse[duty] = c.createPeriodicWave(re, im);
        }
      }
      this.applyVolume();
      if(this.ctx.state === 'suspended') this.ctx.resume().then(() => Music.kick(), () => {});
      Music.kick();
    }catch(e){}
  },
  applyVolume(){
    if(this.bus) this.bus.gain.value = Math.pow(Settings.volume / 10, 2) * 0.9;
    if(this.musicBus) this.musicBus.gain.value = Math.pow(Settings.music / 10, 2) * 0.55 * Music.duckLevel;
  },
  ok(){ return this.ctx && this.ctx.state === 'running' && Settings.volume > 0; },
  env(g, t0, v, dur, attack){
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t0 + (attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  },
  osc(wave){
    const o = this.ctx.createOscillator();
    if(wave === 'pulse25' || wave === 'pulse12') o.setPeriodicWave(this.pulse[wave === 'pulse25' ? 0.25 : 0.125]);
    else o.type = wave || 'square';
    return o;
  },
  tone(o){
    if(!this.ok() && !o.bus) return;
    const c = this.ctx, t0 = o.when || (c.currentTime + (o.at || 0));
    const osc = this.osc(o.wave), g = c.createGain();
    if(o.glide){ osc.frequency.setValueAtTime(o.f * (o.glideFrom || 0.94), t0); osc.frequency.exponentialRampToValueAtTime(o.f, t0 + o.glide); }
    else osc.frequency.setValueAtTime(o.f, t0);
    if(o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.t);
    if(o.vib){
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = o.vibRate || 5.5; lg.gain.setValueAtTime(0, t0); lg.gain.linearRampToValueAtTime(o.f * (o.vibDepth || 0.012), t0 + Math.min(o.t, o.vibRate ? 0.12 : 0.4));
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + o.t + 0.05);
    }
    this.env(g, t0, o.v || 0.15, o.t, o.attack);
    if(o.lp){
      // optional low-pass (brass "blat": the filter opens as the note starts)
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.q || 1.2;
      lp.frequency.setValueAtTime(o.lpFrom || o.lp, t0);
      if(o.lpFrom) lp.frequency.exponentialRampToValueAtTime(o.lp, t0 + 0.07);
      osc.connect(lp); lp.connect(g);
    } else osc.connect(g);
    g.connect(o.bus || this.bus);
    osc.start(t0); osc.stop(t0 + o.t + 0.03);
  },
  noise(o){
    if(!this.ok() && !o.bus) return;
    const c = this.ctx, t0 = o.when || (c.currentTime + (o.at || 0));
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.f || 3000, t0);
    if(o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.t);
    const g = c.createGain(); this.env(g, t0, o.v || 0.2, o.t, o.attack);
    src.connect(f); f.connect(g); g.connect(o.bus || this.bus);
    src.start(t0, Math.random() * 0.5); src.stop(t0 + o.t + 0.03);
  },
  melody(notes, o){
    o = o || {}; let at = o.at || 0;
    for(const [f, d] of notes){
      if(f) this.tone({ wave: o.wave || 'square', f, t: d * (o.legato || 0.9), v: o.v || 0.12, at });
      at += d;
    }
  },
  play(name){ const fx = SFX[name]; if(fx) try{ fx(this); }catch(e){} if(Sound.onPlay) Sound.onPlay(name); }
};
const N = { C4:262, D4:294, E4:330, F4:349, G4:392, A4:440, B4:494, C5:523, D5:587, E5:659, F5:698, G5:784, A5:880, B5:988, C6:1047, E6:1319, G6:1568 };
const SFX = {
  move:    s => s.tone({ f: 520, t: 0.035, v: 0.07 }),
  select:  s => s.tone({ f: 700, t: 0.05, v: 0.1 }),
  confirm: s => { s.tone({ f: N.C5, t: 0.07, v: 0.12 }); s.tone({ f: N.G5, t: 0.1, v: 0.12, at: 0.06 }); },
  back:    s => s.tone({ f: 392, f2: 250, t: 0.1, v: 0.1 }),
  join:    s => s.melody([[N.C5, .06], [N.E5, .06], [N.G5, .1]], { v: 0.12 }),
  online:  s => s.melody([[N.G5, .06], [N.C6, .06], [N.E6, .06], [N.G6, .14]], { wave: 'triangle', v: 0.13 }),
  leave:   s => s.melody([[N.E5, .07], [N.C5, .07], [N.G4, .12]], { wave: 'triangle', v: 0.12 }),
  pause:   s => { s.tone({ f: N.B5, t: 0.06, v: 0.1 }); s.tone({ f: N.E5, t: 0.09, v: 0.1, at: 0.07 }); },
  type:    s => s.tone({ f: 880 + Math.random() * 200, t: 0.03, v: 0.06, wave: 'triangle' }),
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
  win:      s => s.melody([[N.C5, .1], [N.C5, .1], [N.C5, .1], [N.C5, .3], [N.A4, .3], [N.B4, .3], [N.C5, .2], [N.B4, .1], [N.C5, .5]], { v: 0.12 }),
  countdown: s => s.tone({ f: 660, t: 0.12, v: 0.14 }),
  go:        s => { s.tone({ f: 1320, t: 0.35, v: 0.14 }); s.tone({ f: 660, t: 0.35, v: 0.08, wave: 'triangle' }); },
  // family features: personal best and medal jingles
  best:      s => { s.melody([[N.G5, .08], [N.C6, .08], [N.E6, .08], [N.G6, .16], [0, .04], [N.E6, .08], [N.G6, .34]], { wave: 'triangle', v: 0.13 });
                    s.melody([[N.C5, .24], [N.E5, .24], [N.G5, .5]], { wave: 'pulse25', v: 0.06 });
                    for(let i = 0; i < 6; i++) s.tone({ wave: 'sine', f: 2400 + i * 300, t: 0.08, v: 0.03, at: 0.5 + i * 0.05 }); },
  medal:     s => { s.melody([[N.E6, .07], [N.G6, .07], [N.C6 * 2, .22]], { wave: 'sine', v: 0.1 }); s.tone({ wave: 'triangle', f: N.C6, t: 0.4, v: 0.06, at: 0.14 }); }
};

/* ================= Music: a tiny chiptune sequencer =================
   Songs are written as 16th-note steps: "C5" starts a note, "-" holds it, "." is a rest.
   Chords drive the bass line and arpeggio automatically, so a song is mostly its melody. */
const NOTE_IX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function midi(name){
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name); if(!m) return null;
  return 12 * (+m[3] + 1) + NOTE_IX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
function chordNotes(ch){
  const m = /^([A-G][#b]?)(m7|maj7|m|7|sus4|dim|5)?$/.exec(ch); if(!m) return [57, 60, 64];
  const root = midi(m[1] + '3');
  const iv = { m: [0, 3, 7], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], '7': [0, 4, 7, 10], sus4: [0, 5, 7], dim: [0, 3, 6], '5': [0, 7, 12] }[m[2]] || [0, 4, 7];
  return iv.map(i => root + i);
}
const Music = {
  song: null, want: null, step: 0, nextT: 0, timer: 0, duckLevel: 1, layers: 1,
  play(song){
    if(!song){ this.stop(); return; }
    if(this.want === song) return;
    this.stop(); this.want = song; this.kick();
  },
  kick(){
    const s = Sound;
    if(!this.want || this.song === this.want || !s.ctx || s.ctx.state !== 'running') return;
    this.song = this.want; this.step = 0; this.nextT = s.ctx.currentTime + 0.08;
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 25);
  },
  stop(){ clearInterval(this.timer); this.timer = 0; this.song = null; this.want = null; },
  duck(on){ this.duckLevel = on ? 0.35 : 1; Sound.applyVolume(); },
  intensity(n){ this.layers = n; },
  tick(){
    const s = Sound, c = s.ctx, song = this.song;
    if(!song || !c) return;
    if(c.state !== 'running' || Settings.music <= 0){ this.nextT = c.currentTime + 0.05; return; }
    const stepDur = 60 / song.bpm / 4;
    if(this.nextT < c.currentTime - 0.3) this.nextT = c.currentTime + 0.02;   // tab was asleep
    while(this.nextT < c.currentTime + 0.14){ this.schedule(song, this.step, this.nextT, stepDur); this.nextT += stepDur; this.step++; }
  },
  schedule(song, step, t, sd){
    const s = Sound, bus = s.musicBus, bars = song.chords.length, total = bars * 16;
    const i = step % total, bar = Math.floor(i / 16), k = i % 16;
    const ch = chordNotes(song.chords[bar]);
    const lead = song.leadSteps || (song.leadSteps = song.lead.join(' ').trim().split(/\s+/));
    // melody (repeats if shorter than the chord loop)
    const li = i % lead.length, tok = lead[li];
    if(tok && tok !== '-' && tok !== '.'){
      let len = 1; while(lead[(li + len) % lead.length] === '-' && len < 32) len++;
      const n = midi(tok);
      if(n && song.steel){
        // steel-drum lead: bright struck partials that fade fast; long notes are rolled like a real pan
        const v = song.leadVol || 0.075, f = hz(n), hits = len >= 4 ? Math.floor(len / 2) : 1;
        for(let j = 0; j < hits; j++){
          const w = when => when + j * sd * 2, vv = v * (j ? 0.62 : 1);
          s.tone({ bus, when: w(t), wave: 'sine', f, t: Math.min(0.55, len * sd), v: vv, attack: 0.004 });
          s.tone({ bus, when: w(t), wave: 'sine', f: f * 2.01, t: 0.2, v: vv * 0.42, attack: 0.003 });
          s.tone({ bus, when: w(t), wave: 'triangle', f: f * 3, t: 0.09, v: vv * 0.2, attack: 0.002 });
        }
      } else if(n && song.flute){
        // bansuri-style flute: soft sine that slides up into the note, with a breath of air and vibrato on long notes
        const v = song.leadVol || 0.075, f = hz(n), dur = len * sd * 0.95, prev = lead[(li - 1 + lead.length) % lead.length];
        s.tone({ bus, when: t, wave: 'sine', f, t: dur, v, vib: len >= 3, attack: 0.03, glide: prev === '.' || len >= 4 ? 0.07 : 0, glideFrom: 0.945 });
        s.tone({ bus, when: t, wave: 'triangle', f: f * 2, t: dur * 0.8, v: v * 0.12, attack: 0.04 });
        s.noise({ bus, when: t, t: Math.min(0.14, dur), v: v * 0.35, f: f * 2.2, type: 'bandpass', q: 3, attack: 0.01 });
      } else if(n && song.sitar){
        // sitar-style pluck: bright buzzy attack that rings down, with a little bend (meend) into long notes
        const v = song.leadVol || 0.075, f = hz(n), ring = Math.min(0.9, len * sd * 1.2);
        s.tone({ bus, when: t, wave: 'sawtooth', f, t: ring, v: v * 0.55, attack: 0.002, glide: len >= 4 ? 0.09 : 0, glideFrom: 0.955 });
        s.tone({ bus, when: t, wave: 'triangle', f: f * 2.003, t: ring * 0.7, v: v * 0.5, attack: 0.002 });
        s.tone({ bus, when: t, wave: 'sine', f: f * 4.01, t: 0.06, v: v * 0.3, attack: 0.001 });
      } else if(n && song.brass){
        // big-band trumpet: a sawtooth whose filter opens as the note speaks, with a little lip bend into long notes
        const v = song.leadVol || 0.07, f = hz(n), dur = len * sd * 0.9;
        s.tone({ bus, when: t, wave: 'sawtooth', f, t: dur, v: v * 0.62, attack: 0.022, vib: len >= 4, glide: len >= 3 ? 0.05 : 0, glideFrom: 0.97, lp: Math.min(6000, f * 5), lpFrom: f * 1.5 });
        s.tone({ bus, when: t, wave: 'pulse25', f, t: dur, v: v * 0.3, attack: 0.018, lp: Math.min(5000, f * 3.5) });
      } else if(n && song.calliope){
        // steam calliope: round organ pipes with a fast, wobbly vibrato
        const v = song.leadVol || 0.07, f = hz(n), dur = len * sd * 0.94;
        s.tone({ bus, when: t, wave: 'sine', f, t: dur, v, attack: 0.01, vib: true, vibRate: 7.5, vibDepth: 0.016 });
        s.tone({ bus, when: t, wave: 'triangle', f: f * 2, t: dur, v: v * 0.34, attack: 0.01, vib: true, vibRate: 7.5, vibDepth: 0.016 });
        s.tone({ bus, when: t, wave: 'sine', f: f * 4, t: dur * 0.6, v: v * 0.07, attack: 0.01 });
        s.noise({ bus, when: t, t: Math.min(0.08, dur), v: v * 0.2, f: f * 3, type: 'bandpass', q: 2, attack: 0.005 });
      } else if(n) s.tone({ bus, when: t, wave: song.leadWave || 'pulse25', f: hz(n), t: len * sd * 0.92, v: song.leadVol || 0.075, vib: len >= 4, attack: 0.008 });
    }
    // tanpura-style drone: a soft Pa–Sa–Sa–Sa cycle under the whole song
    if(song.drone && k % 4 === 0){
      const dn = [ch[0] - 5, ch[0], ch[0], ch[0] - 12][k / 4], dRoot = song.droneRoot !== undefined ? midi(song.droneRoot) : null;
      const note = dRoot !== null ? [dRoot + 7, dRoot + 12, dRoot + 12, dRoot][k / 4] : dn;
      s.tone({ bus, when: t, wave: 'sawtooth', f: hz(note), t: sd * 5.5, v: 0.018, attack: 0.05 });
      s.tone({ bus, when: t, wave: 'sine', f: hz(note), t: sd * 5.5, v: 0.05, attack: 0.04 });
    }
    // bass
    const bassStyle = song.bass || 'drive';
    const root = ch[0] - 12;
    let bn = null;
    if(bassStyle === 'drive'){ if(k % 2 === 0) bn = root + (k % 4 === 2 ? 12 : 0); }
    else if(bassStyle === 'pulse'){ if(k % 4 === 0) bn = root; else if(k % 4 === 2) bn = root + 12; }
    else if(bassStyle === 'walk'){ if(k % 4 === 0) bn = [root, root + 7, root + 12, root + 7][k / 4]; }
    else if(bassStyle === 'gallop'){ if(k % 4 !== 1) bn = root + (k === 8 ? 7 : 0); }
    else if(bassStyle === 'calypso'){ const at = [0, 3, 6, 8, 11, 14].indexOf(k); if(at >= 0) bn = [root, root + 7, root + 12, root, ch[1] - 12, root + 7][at]; }
    else if(bassStyle === 'tuba'){ if(k % 8 === 0) bn = k === 0 ? root : root + 7; }
    if(bn !== null && bassStyle === 'tuba'){
      // circus oom-pah: a round tuba "oom" on 1 and 3, a soft band chord "pah" on 2 and 4
      s.tone({ bus, when: t, wave: 'sawtooth', f: hz(bn), t: sd * 3.2, v: 0.15, attack: 0.02, lp: 520, lpFrom: 180 });
      s.tone({ bus, when: t, wave: 'triangle', f: hz(bn), t: sd * 3.2, v: 0.12, attack: 0.01 });
    } else if(bn !== null) s.tone({ bus, when: t, wave: 'triangle', f: hz(bn), t: sd * (bassStyle === 'walk' ? 3.6 : 1.7), v: 0.16, attack: 0.004 });
    if(bassStyle === 'tuba' && k % 8 === 4) for(const nn of ch) s.tone({ bus, when: t, wave: 'triangle', f: hz(nn + 12), t: sd * 1.3, v: 0.026, attack: 0.004 });
    // arpeggio
    if(song.arp && this.layers >= 1){
      const every = song.arp === 'fast' ? 1 : 2;
      if(k % every === 0){
        const idx = (k / every) % ch.length;
        s.tone({ bus, when: t, wave: 'pulse12', f: hz(ch[idx] + 12 + (song.arpOct || 0) * 12), t: sd * every * 0.8, v: 0.03, attack: 0.003 });
      }
    }
    // drums
    const dp = song.drums ? song.drums[bar % song.drums.length] : '';
    const d = dp[k];
    if(d === 'k' || d === 'x'){ s.tone({ bus, when: t, wave: 'sine', f: 150, f2: 42, t: 0.16, v: 0.34, attack: 0.002 }); }
    if(d === 's' || d === 'x'){ s.noise({ bus, when: t, t: 0.14, v: 0.16, f: 5200, f2: 1400, type: 'bandpass', q: 0.7 }); s.tone({ bus, when: t, wave: 'triangle', f: 220, f2: 150, t: 0.07, v: 0.07 }); }
    if(d === 'h'){ s.noise({ bus, when: t, t: 0.035, v: 0.05, f: 9000, type: 'highpass' }); }
    // marching band: r = snare roll (three quick taps), z = kick + cymbal crash
    if(d === 'r'){ for(let j = 0; j < 3; j++) s.noise({ bus, when: t + j * sd / 3, t: 0.06, v: 0.06 + j * 0.02, f: 5200, f2: 1800, type: 'bandpass', q: 0.8 }); }
    if(d === 'z'){ s.tone({ bus, when: t, wave: 'sine', f: 150, f2: 42, t: 0.16, v: 0.3, attack: 0.002 }); s.noise({ bus, when: t, t: 0.9, v: 0.07, f: 6500, type: 'highpass' }); }
    if(d === 'o'){ s.noise({ bus, when: t, t: 0.16, v: 0.05, f: 8000, type: 'highpass' }); }
    // island percussion: b = high bongo, l = low bongo, c = shaker
    if(d === 'b'){ s.tone({ bus, when: t, wave: 'sine', f: 440, f2: 330, t: 0.09, v: 0.16, attack: 0.002 }); }
    if(d === 'l'){ s.tone({ bus, when: t, wave: 'sine', f: 280, f2: 200, t: 0.13, v: 0.2, attack: 0.002 }); }
    if(d === 'c'){ s.noise({ bus, when: t, t: 0.05, v: 0.045, f: 7000, type: 'highpass', attack: 0.012 }); }
    // Indian percussion: d = tabla bass (dha, bends up), t = tabla ring (tin), n = bright na, g = dhol boom, j = manjira bells
    if(d === 'd'){ s.tone({ bus, when: t, wave: 'sine', f: 96, f2: 150, t: 0.22, v: 0.3, attack: 0.002 }); s.tone({ bus, when: t, wave: 'sine', f: 520, t: 0.1, v: 0.07, attack: 0.001 }); }
    if(d === 't'){ s.tone({ bus, when: t, wave: 'sine', f: 560, t: 0.16, v: 0.12, attack: 0.001 }); s.tone({ bus, when: t, wave: 'sine', f: 1130, t: 0.06, v: 0.04, attack: 0.001 }); }
    if(d === 'n'){ s.tone({ bus, when: t, wave: 'triangle', f: 760, t: 0.1, v: 0.1, attack: 0.001 }); s.noise({ bus, when: t, t: 0.03, v: 0.05, f: 5000, type: 'highpass' }); }
    if(d === 'g'){ s.tone({ bus, when: t, wave: 'sine', f: 120, f2: 52, t: 0.24, v: 0.36, attack: 0.002 }); s.noise({ bus, when: t, t: 0.08, v: 0.1, f: 900, f2: 200 }); }
    if(d === 'j'){ s.tone({ bus, when: t, wave: 'sine', f: 2960, t: 0.22, v: 0.03, attack: 0.001 }); s.tone({ bus, when: t, wave: 'sine', f: 4180, t: 0.14, v: 0.018, attack: 0.001 }); }
  }
};

/* The xRetro menu theme, shared by the launcher and every game's menus. */
const THEMES = {
  menu: {
    bpm: 112, chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'], bass: 'pulse', arp: 'slow', leadVol: 0.06,
    lead: [
      'A4 - C5 - E5 - - - D5 - C5 - B4 - C5 -', 'A4 - - - . . F4 - A4 - C5 - F5 - E5 -',
      'E5 - - - G5 - E5 - C5 - - - D5 - E5 -', 'D5 - - - - - - - B4 - D5 - G5 - F5 -',
      'E5 - - - A5 - G5 - E5 - C5 - D5 - E5 -', 'F5 - - - E5 - C5 - A4 - C5 - D5 - C5 -',
      'E5 - D5 - C5 - G4 - C5 - E5 - G5 - E5 -', 'G#5 - - - - - - - E5 - - - B4 - - -'],
    drums: ['k...h...s...h.k.', 'k...h...s...h...', 'k...h...s...h.k.', 'k...h.k.s...hhs.']
  }
};

/* ================= Names: every player gets one ================= */
const FUN_NAMES = ['Tiger', 'Rocket', 'Mango', 'Pixel', 'Comet', 'Panda', 'Blaze', 'Ziggy', 'Nova', 'Chilli', 'Bolt', 'Coco', 'Turbo', 'Kiwi', 'Ninja', 'Luna', 'Masala', 'Jazz', 'Dino', 'Sparky'];
const Names = {
  map: Store.get('names', {}),
  device(){ return Store.get('deviceName', ''); },
  setDevice(n){ Store.set('deviceName', n); },
  set(id, n){ this.map[id] = n; Store.set('names', this.map); if(!this.device()) this.setDevice(n); },
  forSource(id, taken){
    taken = (taken || []).map(x => String(x).toLowerCase());
    const free = n => n && !taken.includes(n.toLowerCase());
    if(free(this.map[id])) return this.map[id];
    if(free(this.device())) return this.device();
    const pool = FUN_NAMES.filter(free);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'Player';
  },
  clean(s, n){ return String(s || '').replace(/[^\p{L}\p{N} _.'!-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, n || 10); }
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
const typingTarget = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); };
function onKey(e, down){
  if(typingTarget(e)) return;                      // let people type their name
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
  const s = { id, kind, label, name: '', connected: true, dir: -1, dirOrder: [0, 1, 2, 3], held: [false, false, false, false], prev: {}, used: false };
  BTN.forEach(b => { s[b] = false; s.prev[b] = false; });
  return s;
}
const sources = new Map();
sources.set('kb1', makeSource('kb1', 'kb', KEYSETS.kb1.label));
sources.set('kb2', makeSource('kb2', 'kb', KEYSETS.kb2.label));

const touchState = { up: false, down: false, left: false, right: false, fire: false, pause: false };
const touchLatch = { fire: false, pause: false };   // a tap shorter than one frame still counts
const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || (navigator.maxTouchPoints || 0) > 0;
if(isTouch) sources.set('touch', makeSource('touch', 'touch', 'Touch screen'));
function tapTouch(btn){ touchState[btn] = true; touchLatch[btn] = true; setTimeout(() => { touchState[btn] = false; }, 90); }

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
  s.analogX = Math.abs(ax) > 0.15 ? ax : 0;
  s.throttle = Math.max(b(7) ? (gp.buttons[7].value || 1) : 0, b(0) ? 1 : 0);
  if(s.fire || s.pause) Sound.unlock();
}
function updateDir(s){
  const now = [s.up, s.right, s.down, s.left];
  for(let i = 0; i < 4; i++) if(now[i] && !s.held[i]) s.dirOrder = [i].concat(s.dirOrder.filter(x => x !== i));
  s.held = now; s.dir = -1;
  for(const i of s.dirOrder) if(now[i]){ s.dir = i; break; }
}

/* Remote players: their device sends button states; we turn them into ordinary input sources.
   Taps that start and end between two of our frames are never lost (edge counters). */
const EDGE_BTNS = ['fire', 'back', 'pause'];
const Remote = {
  ensure(id, label, name){
    let s = sources.get(id);
    if(!s){ s = makeSource(id, 'net', label); s.latch = { fire: 0, back: 0, pause: 0 }; s.count = null; s.bits = 0; sources.set(id, s); }
    s.connected = true; if(label) s.label = label; if(name) s.name = name;
    return s;
  },
  feed(id, pk){
    const s = sources.get(id); if(!s || !Array.isArray(pk)) return;
    s.bits = pk[0] | 0;
    const counts = [pk[1] | 0, pk[2] | 0, pk[3] | 0];
    if(s.count) EDGE_BTNS.forEach((b, i) => { const d = counts[i] - s.count[i]; if(d > 0 && d < 50) s.latch[b] += d; });
    s.count = counts;
  },
  disconnect(prefix){ for(const s of sources.values()) if(s.kind === 'net' && s.id.startsWith(prefix)){ s.connected = false; s.bits = 0; BTN.forEach(b => { s[b] = false; }); } },
  poll(s){
    const bits = s.bits;
    s.up = !!(bits & 1); s.down = !!(bits & 2); s.left = !!(bits & 4); s.right = !!(bits & 8);
    s.fire = !!(bits & 16); s.back = !!(bits & 32); s.pause = !!(bits & 64);
    for(const b of EDGE_BTNS){
      if(s.latch[b] > 0){
        if(s.prev[b]) s[b] = false;              // show a release first so the press counts as new
        else { s[b] = true; s.latch[b]--; }
      }
    }
  }
};
/* The other direction: pack a local source for sending. */
function packSource(s){
  if(!s.edge){ s.edge = [0, 0, 0]; }
  EDGE_BTNS.forEach((b, i) => { if(s[b] && !s.prev[b]) s.edge[i]++; });
  const bits = (s.up ? 1 : 0) | (s.down ? 2 : 0) | (s.left ? 4 : 0) | (s.right ? 8 : 0) | (s.fire ? 16 : 0) | (s.back ? 32 : 0) | (s.pause ? 64 : 0);
  return [bits, s.edge[0], s.edge[1], s.edge[2]];
}

const Input = {
  isTouch, Remote, packSource,
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
    if(t){ Object.assign(t, touchState); if(touchLatch.fire){ t.fire = true; touchLatch.fire = false; } if(touchLatch.pause){ t.pause = true; touchLatch.pause = false; } }
    for(const s of sources.values()){
      if(s.kind === 'net' && s.connected) Remote.poll(s);
      updateDir(s);
      if(!s.used && s.kind !== 'net' && BTN.some(b => s[b])) s.used = true;
    }
  },
  all(){ return Array.from(sources.values()).filter(s => s.connected); },
  local(){ return Array.from(sources.values()).filter(s => s.connected && s.kind !== 'net'); },
  get(id){ return sources.get(id) || null; },
  pressed(s, b){ return !!(s && s[b] && !s.prev[b]); },
  pads(){ return Array.from(sources.values()).filter(s => s.kind === 'pad' && s.connected); },
  tapTouch
};

/* ================= Touch controls ================= */
const Touch = {
  el: null,
  mount(){
    if(!isTouch || this.el) return;
    const ui = document.createElement('div'); ui.className = 'touch-ui'; ui.hidden = true;
    ui.innerHTML = '<div class="touch-stick"><div class="touch-knob"></div></div>' +
                   '<div class="touch-fire">FIRE</div><button class="touch-pause" type="button" aria-label="Pause">II</button>';
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
    stick.addEventListener('pointerdown', e => { pid = e.pointerId; try{ stick.setPointerCapture(pid); }catch(err){} move(e); e.preventDefault(); });
    stick.addEventListener('pointermove', e => { if(e.pointerId === pid) move(e); });
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const fire = ui.querySelector('.touch-fire');
    fire.addEventListener('pointerdown', e => { touchState.fire = true; touchLatch.fire = true; fire.classList.add('on'); try{ fire.setPointerCapture(e.pointerId); }catch(err){} e.preventDefault(); });
    const fireEnd = () => { touchState.fire = false; fire.classList.remove('on'); };
    fire.addEventListener('pointerup', fireEnd); fire.addEventListener('pointercancel', fireEnd);
    const pause = ui.querySelector('.touch-pause');
    pause.addEventListener('pointerdown', e => { touchState.pause = true; touchLatch.pause = true; e.preventDefault(); });
    pause.addEventListener('pointerup', () => { setTimeout(() => { touchState.pause = false; }, 50); });
  },
  label(txt){ if(this.el) this.el.querySelector('.touch-fire').textContent = txt; },
  show(on){ if(this.el) this.el.hidden = !on; }
};

/* ================= DOM helpers, toast ================= */
function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
let toastEl = null, toastTimer = 0;
function toast(msg, ms){
  if(!toastEl){ toastEl = el('div', 'toast'); toastEl.hidden = true; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, ms || 2600);
}
toastFn = toast;

/* Shared DOM builders: the same markup draws a local menu/lobby or a mirror of the host's. */
function menuDom(m, onClick){
  const p = el('div', 'menu-panel');
  if(m.kicker) p.appendChild(el('div', 'menu-kicker', m.kicker));
  p.appendChild(el('h1', 'menu-title', m.title));
  if(m.text) p.appendChild(el('p', 'menu-text', m.text));
  const list = el('div', 'menu-items');
  const btns = (m.items || []).map((it, i) => {
    const b = el('button', 'menu-item' + (i === m.idx ? ' focus' : '') + (it.dim ? ' dim' : ''));
    b.type = 'button'; b.tabIndex = -1;
    b.innerHTML = '<span class="mi-label"></span>' + (it.value != null ? '<span class="mi-value"><i>&lsaquo;</i><b></b><i>&rsaquo;</i></span>' : '');
    b.querySelector('.mi-label').textContent = it.label;
    if(it.value != null) b.querySelector('.mi-value b').textContent = it.value;
    if(onClick) b.addEventListener('click', e => onClick(i, e, b));
    list.appendChild(b); return b;
  });
  p.appendChild(list);
  if(m.footer) p.appendChild(el('div', 'menu-footer', m.footer));
  return { panel: p, btns };
}
function lobbyDom(m, h){
  const wrap = el('div', 'lobby');
  const head = el('div', 'lobby-head');
  const hl = el('div');
  hl.appendChild(el('div', 'menu-kicker', m.kicker || 'Who is playing?'));
  hl.appendChild(el('h1', 'menu-title', m.title));
  head.appendChild(hl);
  if(m.room){
    const rc = el('div', 'room-card');
    rc.innerHTML = '<div class="room-label">Room code</div><div class="room-code"></div><div class="room-link"></div>';
    rc.querySelector('.room-code').textContent = m.room.code;
    rc.querySelector('.room-link').textContent = m.room.link.replace(/^https?:\/\//, '');
    if(h.share){
      const sb = el('button', 'btn small', navigator.share && isTouch ? 'Share invite' : 'Copy invite link'); sb.type = 'button';
      sb.addEventListener('click', () => h.share(m.room)); rc.appendChild(sb);
    }
    head.appendChild(rc);
  }
  wrap.appendChild(head);
  if(m.text) wrap.appendChild(el('p', 'menu-text', m.text));
  const grid = el('div', 'lobby-slots');
  for(let i = 0; i < m.max; i++){
    const slot = m.slots[i];
    const card = el('div', 'slot' + (slot ? ' joined' : '') + (slot && slot.ready ? ' ready' : '') + (slot && slot.mine ? ' mine' : ''));
    card.style.setProperty('--slot-color', m.colors[i]);
    const top = el('div', 'slot-top');
    top.appendChild(el('div', 'slot-tag', 'P' + (i + 1)));
    if(slot && slot.online) top.appendChild(el('span', 'slot-online', 'online'));
    card.appendChild(top);
    const nm = el('div', 'slot-name'); nm.textContent = slot ? slot.name : ''; card.appendChild(nm);
    if(slot && slot.canRename && h.rename){ nm.classList.add('renamable'); nm.title = 'Change name'; nm.addEventListener('click', () => h.rename(i)); }
    const src = el('div', 'slot-src'); src.textContent = slot ? slot.label : ''; card.appendChild(src);
    card.appendChild(el('div', 'slot-state', !slot ? 'Press FIRE to join' : slot.ready ? 'Ready!' : (slot.canRename ? 'FIRE when ready · ▲ rename' : 'FIRE when ready')));
    grid.appendChild(card);
  }
  wrap.appendChild(grid);
  const count = el('div', 'lobby-count'); count.textContent = m.count || ''; wrap.appendChild(count);
  const actions = el('div', 'lobby-actions');
  if(h.touch){
    const tb = el('button', 'btn primary', 'Tap to join / ready'); tb.type = 'button';
    tb.addEventListener('click', () => { Sound.unlock(); goLandscape(); h.touch(); });
    actions.appendChild(tb);
  }
  if(h.back){
    const back = el('button', 'btn', h.backLabel || 'Back'); back.type = 'button';
    back.addEventListener('click', h.back);
    actions.appendChild(back);
  }
  wrap.appendChild(actions);
  wrap.appendChild(el('div', 'menu-footer', m.footer ||
    'Controller: <span class="keycap">A</span> join / ready, <span class="keycap">B</span> leave. ' +
    'Keyboard: <span class="keycap">Arrows</span>+<span class="keycap">Space</span> or <span class="keycap">WASD</span>+<span class="keycap">F</span>. ' +
    '<span class="keycap">Esc</span> goes back.'));
  return { wrap, count };
}

/* ================= Text entry: a keyboard you can drive with a controller ================= */
const KEY_ROWS = ['ABCDEFGHIJ', 'KLMNOPQRST', 'UVWXYZ0123', '456789'];
const TextEntry = {
  cfg: null, layer: null, value: '', row: 0, col: 0, keys: [], lastTyped: false,
  isOpen(){ return !!this.cfg; },
  open(cfg){
    if(!this.layer){
      this.layer = el('div', 'ui-layer center text-layer'); this.layer.hidden = true; document.body.appendChild(this.layer);
      window.addEventListener('keydown', e => this.onKey(e), true);
    }
    this.cfg = cfg; this.value = cfg.value || ''; this.row = 0; this.col = 0; this.lastTyped = false;
    this.render(); this.layer.hidden = false;
  },
  close(){ this.cfg = null; if(this.layer) this.layer.hidden = true; if(this.input) this.input.blur(); },
  charset(){ return this.cfg.letters ? KEY_ROWS.map(r => r.replace(/[0-9]/g, '')).filter(Boolean) : KEY_ROWS; },
  rows(){
    const r = this.charset().map(s => s.split(''));
    const special = [];
    if(!this.cfg.letters) special.push('SPACE');
    special.push('DEL', 'DONE');
    return r.concat([special]);
  },
  render(){
    const c = this.cfg; this.layer.innerHTML = '';
    const p = el('div', 'menu-panel text-panel');
    if(c.kicker) p.appendChild(el('div', 'menu-kicker', c.kicker));
    p.appendChild(el('h1', 'menu-title small', c.title));
    if(c.text) p.appendChild(el('p', 'menu-text', c.text));
    const inp = this.input = el('input', 'text-value');
    inp.type = 'text'; inp.maxLength = c.max; inp.value = this.value; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.setAttribute('autocapitalize', c.letters ? 'characters' : 'words');
    inp.setAttribute('aria-label', c.title);
    if(!isTouch) inp.readOnly = true;              // TV/laptop: type anywhere, the field just shows it
    inp.addEventListener('input', () => { this.value = this.filter(inp.value); if(inp.value !== this.value) inp.value = this.value; });
    inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); this.done(); } });
    p.appendChild(inp);
    const grid = el('div', 'kbd');
    this.keys = this.rows().map((row, ri) => {
      const line = el('div', 'kbd-row');
      const ks = row.map((k, ci) => {
        const b = el('button', 'kbd-key' + (k.length > 1 ? ' wide' : '')); b.type = 'button'; b.tabIndex = -1;
        b.textContent = k === 'SPACE' ? 'Space' : k === 'DEL' ? '⌫ Del' : k === 'DONE' ? 'Done' : k;
        b.addEventListener('click', () => { this.row = ri; this.col = ci; this.press(k); });
        line.appendChild(b); return b;
      });
      grid.appendChild(line); return ks;
    });
    p.appendChild(grid);
    const acts = el('div', 'lobby-actions');
    const cancel = el('button', 'btn', 'Cancel'); cancel.type = 'button'; cancel.addEventListener('click', () => this.cancel());
    acts.appendChild(cancel); p.appendChild(acts);
    p.appendChild(el('div', 'menu-footer', 'Type on a keyboard, or pick letters with the D-pad and <span class="keycap">A</span>. <span class="keycap">B</span> deletes.'));
    this.layer.appendChild(p);
    this.refresh();
  },
  refresh(){
    if(!this.cfg) return;
    this.keys.forEach((row, ri) => row.forEach((b, ci) => b.classList.toggle('focus', ri === this.row && ci === this.col)));
    if(this.input && this.input.value !== this.value) this.input.value = this.value;
    this.layer.querySelector('.text-value').classList.toggle('empty', !this.value);
  },
  filter(v){ v = this.cfg.letters ? String(v).toUpperCase().replace(/[^A-Z]/g, '') : Names.clean(v, this.cfg.max).replace(/^\s+/, ''); return v.slice(0, this.cfg.max); },
  press(k){
    if(k === 'DEL'){ this.value = this.value.slice(0, -1); Sound.play('back'); }
    else if(k === 'DONE'){ this.done(); return; }
    else if(k === 'SPACE'){ if(this.value && !this.value.endsWith(' ') && this.value.length < this.cfg.max){ this.value += ' '; Sound.play('type'); } }
    else if(this.value.length < this.cfg.max){ this.value = this.filter(this.value + k); Sound.play('type');
      if(this.cfg.letters && this.value.length === this.cfg.max){ const r = this.rows(); this.row = r.length - 1; this.col = r[this.row].length - 1; } }
    this.refresh();
  },
  done(){
    const v = this.cfg.letters ? this.value : Names.clean(this.value, this.cfg.max);
    if(this.cfg.letters && v.length !== this.cfg.max){ toast('Room codes have ' + this.cfg.max + ' letters'); Sound.play('back'); return; }
    if(!v){ Sound.play('back'); return; }
    const cb = this.cfg.onDone; this.close(); Sound.play('confirm'); cb(v);
  },
  cancel(){ const cb = this.cfg.onCancel; this.close(); Sound.play('back'); if(cb) cb(); },
  onKey(e){
    if(!this.cfg || typingTarget(e)) return;
    const k = e.key;
    if(/^[a-zA-Z0-9]$/.test(k) || (k === ' ' && !this.cfg.letters && this.lastTyped)){
      e.preventDefault(); e.stopImmediatePropagation(); this.lastTyped = true;
      if(k === ' ') this.press('SPACE'); else if(!(this.cfg.letters && /[0-9]/.test(k))) this.press(this.cfg.letters ? k.toUpperCase() : k);
    } else if(k === 'Backspace'){ e.preventDefault(); e.stopImmediatePropagation(); this.press('DEL'); }
    else if(k === 'Enter' && this.lastTyped){ e.preventDefault(); e.stopImmediatePropagation(); this.done(); }
    else if(k === 'Escape'){ e.preventDefault(); e.stopImmediatePropagation(); this.cancel(); }
    else if(k.startsWith('Arrow')) this.lastTyped = false;
  },
  update(){
    if(!this.cfg) return false;
    const rows = this.rows();
    for(const s of Input.local()){
      if(!this.cfg) break;
      if(this.cfg.src && s.id !== this.cfg.src && s.kind !== 'kb') continue;
      if(s.id === 'kb2') continue;                  // W A S D are letters here
      const mv = (dr, dc) => {
        this.row = (this.row + dr + rows.length) % rows.length;
        if(dc) this.col = (this.col + dc + rows[this.row].length) % rows[this.row].length;
        this.col = Math.min(this.col, rows[this.row].length - 1);
        Sound.play('move'); this.refresh();
      };
      if(Input.pressed(s, 'up')) mv(-1, 0);
      else if(Input.pressed(s, 'down')) mv(1, 0);
      else if(Input.pressed(s, 'left')) mv(0, -1);
      else if(Input.pressed(s, 'right')) mv(0, 1);
      else if(Input.pressed(s, 'fire') && !(s.kind === 'kb' && this.lastTyped)){ this.press(rows[this.row][this.col]); break; }
      else if(Input.pressed(s, 'back') && s.kind !== 'kb'){ this.press('DEL'); break; }
      else if(Input.pressed(s, 'pause') && s.kind !== 'kb'){ this.cancel(); break; }
    }
    return true;
  }
};

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
  model(){
    const d = this.def;
    return { kicker: d.kicker || '', title: d.title, text: d.text || '', center: !!d.center, idx: this.idx, footer: d.footer || '',
      items: d.items.map(it => ({ label: it.label, value: it.value ? it.value() : null })) };
  },
  /* What online guests see. Menus not marked shared are the host's own business. */
  snapshot(){
    if(!this.def) return null;
    if(!this.def.shared) return { kicker: this.def.kicker || '', title: 'One moment', text: 'The host is in a menu…', center: true, items: [], idx: 0 };
    const m = this.model(); m.footer = ''; return m;
  },
  render(){
    this.layer.innerHTML = '';
    const { panel, btns } = menuDom(this.model(), (i, e, b) => {
      Sound.unlock(); this.idx = i;
      const it = this.def.items[i];
      const left = it.value && e.target.tagName === 'I' && e.target === b.querySelector('.mi-value i');
      this.activate(left ? -1 : 1, null);
    });
    btns.forEach((b, i) => b.addEventListener('pointerenter', e => { if(e.pointerType === 'mouse') this.focus(i, true); }));
    this.btns = btns;
    this.layer.appendChild(panel);
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
    if(it.value){ if(it.change){ it.change(dirn, src); Sound.play('select'); this.refresh(); } }
    else if(it.select){ Sound.play('confirm'); it.select(src); }
  },
  remoteSelect(i, src){
    if(!this.def || !this.def.shared || !this.def.items[i]) return;
    this.focus(i, true); this.activate(1, src);
  },
  update(){
    if(TextEntry.isOpen()){ TextEntry.update(); return true; }
    if(!this.def) return false;
    const n = this.def.items.length;
    for(const s of Input.all()){
      if(!this.def) break;
      if(s.kind === 'net' && !this.def.shared) continue;
      if(Input.pressed(s, 'up')) this.focus((this.idx - 1 + n) % n);
      else if(Input.pressed(s, 'down')) this.focus((this.idx + 1) % n);
      else if(Input.pressed(s, 'left') && this.def.items[this.idx].value) this.activate(-1, s);
      else if(Input.pressed(s, 'right') && this.def.items[this.idx].value) this.activate(1, s);
      else if(Input.pressed(s, 'fire')){ this.activate(1, s); break; }
      else if(Input.pressed(s, 'back') || Input.pressed(s, 'pause')){ if(this.def.back){ Sound.play('back'); this.def.back(s); break; } }
    }
    return true;
  }
};

/* ================= Lobby: everyone presses FIRE to join ================= */
const Lobby = {
  cfg: null, layer: null, slots: [], countdown: -1, lastText: '', countEl: null,
  open(cfg){
    Menu.close();
    if(!this.layer){ this.layer = el('div', 'ui-layer center'); this.layer.hidden = true; document.body.appendChild(this.layer); }
    this.cfg = cfg; this.slots = []; this.countdown = -1; this.lastText = '';
    if(cfg.initial && cfg.initial !== 'touch') this.add(cfg.initial);
    this.render(); this.layer.hidden = false;
  },
  close(){ this.cfg = null; if(this.layer) this.layer.hidden = true; },
  isOpen(){ return !!this.cfg; },
  add(id){
    const s = Input.get(id);
    const name = (s && s.kind === 'net' && s.name) ? s.name : Names.forSource(id, this.slots.map(x => x.name));
    this.slots.push({ source: id, ready: false, name });
  },
  slotModel(x){
    const s = Input.get(x.source), online = !!(s && s.kind === 'net');
    return { name: x.name, label: online ? (s.label || 'Online') : (s ? s.label : x.source), ready: x.ready, online,
      canRename: !online && !x.ready, src: x.source };
  },
  model(){
    const c = this.cfg;
    return { kicker: c.kicker, title: c.title, text: c.text || '', max: c.max, colors: c.colors, room: c.room || null,
      slots: this.slots.map(x => this.slotModel(x)), count: this.lastText };
  },
  snapshot(){ return this.cfg ? this.model() : null; },
  render(){
    this.layer.innerHTML = '';
    const { wrap, count } = lobbyDom(this.model(), {
      touch: isTouch ? () => this.press('touch') : null,
      back: () => { const cb = this.cfg.onBack; this.close(); Sound.play('back'); cb(); },
      backLabel: this.cfg.backLabel,
      rename: i => this.rename(i, null),
      share: this.cfg.room ? room => shareInvite(room) : null
    });
    this.countEl = count; this.layer.appendChild(wrap);
  },
  rename(i, srcId){
    const slot = this.slots[i]; if(!slot || slot.ready) return;
    const s = Input.get(slot.source); if(s && s.kind === 'net') return;
    TextEntry.open({ kicker: 'Player ' + (i + 1), title: 'Your name', value: slot.name, max: 10, src: srcId,
      onDone: v => { if(this.slots[i] === slot){ slot.name = v; Names.set(slot.source, v); } this.render(); if(this.cfg && this.cfg.onChange) this.cfg.onChange(); },
      onCancel: () => this.render() });
  },
  setName(id, name){ const slot = this.slots.find(x => x.source === id); if(slot){ slot.name = name; this.render(); } },
  press(id){
    const slot = this.slots.find(x => x.source === id);
    if(!slot){
      if(this.slots.length >= this.cfg.max) return;
      this.add(id); Sound.play('join');
    } else { slot.ready = !slot.ready; Sound.play(slot.ready ? 'confirm' : 'back'); }
    this.render();
  },
  update(){
    if(TextEntry.isOpen()){ TextEntry.update(); return true; }
    if(!this.cfg) return false;
    for(const s of Input.all()){
      if(!this.cfg || TextEntry.isOpen()) return true;
      if(s.kind === 'touch') continue;               // touch players use the on-screen button
      const slot = this.slots.find(x => x.source === s.id);
      if(Input.pressed(s, 'fire')) this.press(s.id);
      else if(slot && Input.pressed(s, 'up') && s.kind !== 'net' && !slot.ready) this.rename(this.slots.indexOf(slot), s.id);
      else if(Input.pressed(s, 'back') || Input.pressed(s, 'pause')){
        if(slot){
          if(slot.ready) slot.ready = false; else this.slots.splice(this.slots.indexOf(slot), 1);
          Sound.play('back'); this.render();
        } else if((this.slots.length === 0 && s.kind !== 'net') || s.kind === 'kb'){
          const cb = this.cfg.onBack; this.close(); Sound.play('back'); cb(); return true;
        }
      }
    }
    // drop players whose controller vanished (or whose device left the room)
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
        const players = this.slots.map((x, i) => ({ slot: i, source: x.source, color: this.cfg.colors[i], name: x.name }));
        const cb = this.cfg.onStart; this.close(); cb(players); return true;
      }
    } else {
      this.countdown = -1;
      text = !enough ? (this.cfg.min > 1 ? 'Needs at least ' + this.cfg.min + ' players' : '') :
             'Waiting for everyone to press FIRE…';
    }
    if(text !== this.lastText){ this.lastText = text; if(this.countEl) this.countEl.textContent = text; }
    return true;
  }
};

function shareInvite(room){
  const text = 'Join my xRetro game! Room ' + room.code;
  if(navigator.share && isTouch){ navigator.share({ title: 'xRetro', text, url: room.link }).catch(() => {}); return; }
  const done = () => toast('Invite link copied. Paste it in WhatsApp!');
  try{ navigator.clipboard.writeText(room.link).then(done, () => toast(room.link, 6000)); }catch(e){ toast(room.link, 6000); }
}

/* ================= Display: crisp at any resolution ================= */
function Display(canvas, vw, vh){
  this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
  this.vw = vw; this.vh = vh; this.scale = 1; this.dyn = 1; this.onResize = null;
  this.ema = 16; this.slowFor = 0; this.fastFor = 0;
  this.settle = 3;          // seconds to ignore: loading and resizing make the first frames slow
  this.failed = 9;          // lowest render scale that proved too slow (never retried)
  const fit = () => { this.settle = Math.max(this.settle, 1.5); this.resize(); };
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
/* Auto quality: if frames are slow (e.g. an old laptop at 4K) render fewer pixels.
   A 60 Hz TV runs at 16.7 ms a frame, so "keeping up" means under ~18.5 ms (not 13 ms, which a TV
   can never reach). Slow loading frames are ignored, the scale steps back up gradually, and a scale
   that proved too slow isn't retried (for a minute of smooth frames), so it can't bounce up and down. */
Display.prototype.track = function(dt){
  if(Settings.quality !== 'auto') return;
  if(dt > 0.2 || document.hidden) return;                          // a hitch or a hidden tab says nothing about speed
  if(this.settle > 0){ this.settle -= dt; this.ema = 16.7; this.slowFor = 0; this.fastFor = 0; return; }
  this.ema = this.ema * 0.95 + dt * 1000 * 0.05;
  if(this.ema > 22){ this.slowFor += dt; this.fastFor = 0; this.goodFor = 0; }
  else if(this.ema < 18.5){ this.fastFor += dt; this.slowFor = 0; this.goodFor = (this.goodFor || 0) + dt; }
  else { this.slowFor = 0; this.fastFor = 0; }
  if(this.goodFor > 60 && this.failed < 9){ this.failed = 9; this.goodFor = 0; }   // a full minute of smooth frames: allow one more try
  if(this.slowFor > 1.5 && this.dyn > 0.5){
    this.failed = Math.min(this.failed, this.dyn);
    this.dyn = Math.max(0.5, Math.round(this.dyn * 0.8 * 100) / 100);
    this.slowFor = 0; this.ema = 16.7; this.settle = 1; this.resize();
  } else if(this.fastFor > 3 && this.dyn < 1){
    const next = Math.min(1, Math.round((this.dyn + 0.1) * 100) / 100);
    this.fastFor = 0;
    if(next < this.failed - 0.001){ this.dyn = next; this.settle = 1; this.resize(); }
  }
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

/* Settings items every game can drop into its settings menu. */
function settingsItems(display){
  return [
    { label: 'Effects volume', value: () => Settings.volume + ' / 10', change: d => { Settings.volume = Math.max(0, Math.min(10, Settings.volume + d)); Sound.applyVolume(); saveSettings(); Sound.play('shoot'); } },
    { label: 'Music volume', value: () => Settings.music + ' / 10', change: d => { Settings.music = Math.max(0, Math.min(10, Settings.music + d)); Sound.applyVolume(); saveSettings(); } },
    { label: 'Resolution', value: () => QUALITY_LABELS[Settings.quality], change: d => { const o = ['auto', 'high', 'medium', 'low']; Settings.quality = o[(o.indexOf(Settings.quality) + d + 4) % 4]; saveSettings(); if(display){ display.dyn = 1; display.failed = 9; display.settle = 3; display.resize(); } } },
    { label: 'Fullscreen', select: () => toggleFullscreen() }
  ];
}
const QUALITY_LABELS = { auto: 'Auto', high: 'Up to 4K', medium: '1080p', low: '720p' };

/* ================= Family features (every game: see the handover, section 5a) =================
   Celebrate: confetti + jingle + a "NEW BEST!" banner, drawn over everything (menus too).
   On an online host it is sent to every guest as well, so the whole family sees it. */
const Celebrate = {
  cv: null, ctx: null, banner: null, bits: [], raf: 0, hideT: 0,
  ensure(){
    if(this.cv) return;
    this.cv = el('canvas', 'celebrate-fx'); this.cv.setAttribute('aria-hidden', 'true'); document.body.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d');
    this.banner = el('div', 'celebrate-banner'); this.banner.hidden = true; this.banner.setAttribute('role', 'status');
    document.body.appendChild(this.banner);
  },
  /* o: { title, sub, colors } */
  show(o, remote){
    o = Object.assign({ title: 'NEW BEST!', sub: '' }, o || {});
    try{
      this.ensure();
      this.banner.innerHTML = '<div class="cb-title"></div><div class="cb-sub"></div>';
      this.banner.querySelector('.cb-title').textContent = o.title;
      this.banner.querySelector('.cb-sub').textContent = o.sub || '';
      this.banner.hidden = false; this.banner.classList.remove('go'); void this.banner.offsetWidth; this.banner.classList.add('go');
      clearTimeout(this.hideT); this.hideT = setTimeout(() => { this.banner.hidden = true; }, 3600);
      this.burst(o.colors);
      Sound.play('best');
    }catch(e){}
    const Net = window.Arcade && window.Arcade.Net;
    if(!remote && Net && Net.role === 'host') Net.broadcast({ t: 'cel', o: { title: o.title, sub: o.sub, colors: o.colors } });
  },
  burst(colors){
    const W = this.cv.width = window.innerWidth, H = this.cv.height = window.innerHeight;
    const cols = colors && colors.length ? colors : ['#f5c542', '#3fd0b0', '#7aa8ff', '#ff7eb6', '#ff5a4e', '#ffffff'];
    const u = Math.max(4, Math.min(W, H) / 110);
    for(let i = 0; i < 160; i++){
      const fromLeft = i % 2 === 0, a = (fromLeft ? -0.95 : -2.2) + (Math.random() - 0.5) * 0.7, sp = (0.9 + Math.random() * 0.9) * Math.min(W, H) * 1.5;
      this.bits.push({ x: fromLeft ? 0 : W, y: H * 0.85, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        w: u * (0.8 + Math.random()), h: u * (0.4 + Math.random() * 0.5), col: cols[i % cols.length], t: 0, life: 2.6 + Math.random() * 1.2 });
    }
    if(!this.raf){ let last = performance.now(); const tick = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const c = this.ctx; c.clearRect(0, 0, this.cv.width, this.cv.height);
      for(const b of this.bits){
        b.t += dt; b.vy += Math.min(W, H) * 1.6 * dt; b.vx *= 1 - 1.6 * dt; b.vy *= 1 - 1.2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
        c.save(); c.globalAlpha = Math.max(0, Math.min(1, (b.life - b.t) * 2)); c.translate(b.x, b.y); c.rotate(b.r); c.scale(1, Math.cos(b.t * 9 + b.r));
        c.fillStyle = b.col; c.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); c.restore();
      }
      this.bits = this.bits.filter(b => b.t < b.life);
      if(this.bits.length) this.raf = requestAnimationFrame(tick); else { this.raf = 0; c.clearRect(0, 0, this.cv.width, this.cv.height); }
    }; this.raf = requestAnimationFrame(tick); }
  },
  /* Personal bests, saved per game and key (stage, difficulty…). Returns true when this beats the old best
     (a first clear counts too). lower = smaller is better (times). */
  record(game, key, value, lower){
    const k = 'best.' + game + '.' + key, prev = Store.get(k, null);
    const better = prev === null || (lower ? value < prev : value > prev);
    if(better) Store.set(k, value);
    return { isNew: better, prev };
  }
};

/* Medals: Gold / Silver / Bronze per stage and difficulty, saved under arcade.medals.<game>.
   The launcher's game cards read the same key (works offline and on file://). */
const MEDAL_RANK = { bronze: 1, silver: 2, gold: 3 };
const Medals = {
  COLORS: { gold: ['#ffd54a', '#b07d0c', '#fff3b0'], silver: ['#dfe6ef', '#7f8a99', '#ffffff'], bronze: ['#e59a5c', '#8f4f22', '#ffd2ac'] },
  all(game){ const v = Store.get('medals.' + game, {}); return v && typeof v === 'object' ? v : {}; },
  /* best medal for a stage (over every difficulty), or for one difficulty */
  get(game, stage, diff){
    const s = this.all(game)[stage]; if(!s) return null;
    if(diff) return s[diff] || null;
    let best = null; for(const k in s) if(MEDAL_RANK[s[k]] > (MEDAL_RANK[best] || 0)) best = s[k];
    return best;
  },
  /* thresholds { gold, silver, bronze? }; lower = smaller value is better (times) */
  pick(value, th, lower){
    if(lower === false){ if(value >= th.gold) return 'gold'; if(value >= th.silver) return 'silver'; return th.bronze === undefined || value >= th.bronze ? 'bronze' : null; }
    if(value <= th.gold) return 'gold'; if(value <= th.silver) return 'silver'; return th.bronze === undefined || value <= th.bronze ? 'bronze' : null;
  },
  award(game, stage, diff, medal){
    if(!medal) return { medal: null, improved: false, prev: null };
    const all = this.all(game), s = all[stage] || (all[stage] = {}), prev = s[diff] || null;
    const improved = !prev || MEDAL_RANK[medal] > MEDAL_RANK[prev];
    if(improved){ s[diff] = medal; Store.set('medals.' + game, all); }
    return { medal, improved, prev };
  },
  summary(game, stages){
    const out = { gold: 0, silver: 0, bronze: 0, won: 0, total: stages || 0 };
    const all = this.all(game);
    for(const st in all){ const m = this.get(game, st); if(m){ out[m]++; out.won++; } }
    return out;
  },
  label(m){ return m ? m.charAt(0).toUpperCase() + m.slice(1) : ''; },
  html(m){ return m ? '<span class="medal medal-' + m + '" title="' + this.label(m) + '"></span>' : ''; },
  /* a medal on a game canvas: ribbon, rim, face and a little star */
  draw(c, x, y, r, m){
    if(!m){ c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = Math.max(0.6, r * 0.18); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); return; }
    const col = this.COLORS[m];
    c.fillStyle = '#d9434f'; c.beginPath(); c.moveTo(x - r * 0.9, y - r * 1.9); c.lineTo(x - r * 0.1, y - r * 1.9); c.lineTo(x + r * 0.2, y - r * 0.6); c.lineTo(x - r * 0.5, y - r * 0.6); c.fill();
    c.fillStyle = '#3f6fd8'; c.beginPath(); c.moveTo(x + r * 0.9, y - r * 1.9); c.lineTo(x + r * 0.1, y - r * 1.9); c.lineTo(x - r * 0.2, y - r * 0.6); c.lineTo(x + r * 0.5, y - r * 0.6); c.fill();
    c.fillStyle = col[1]; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = col[0]; c.beginPath(); c.arc(x, y, r * 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = col[2]; c.beginPath();
    for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.2 : r * 0.48; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    c.fill();
  }
};

/* Awards: every player gets at least one kind, fun award on the results screen.
   defs: [{ title, stat: p => number, min (default 1), all: true = everyone who qualifies, low: true = smaller wins }]
   Returns [{ p, list: [titles] }] in player order. */
const KIND_AWARDS = ['Team Spirit', 'Crowd Pleaser', 'Never Gave Up', 'Best Bow'];
const Awards = {
  pick(players, defs, opts){
    opts = opts || {};
    const max = opts.max || 3, out = players.map(p => ({ p, list: [] }));
    const give = (i, title) => { if(out[i].list.length < max && !out[i].list.includes(title)) out[i].list.push(title); };
    for(const d of defs){
      const min = d.min === undefined ? 1 : d.min;
      const vals = players.map(p => { try{ return +d.stat(p) || 0; }catch(e){ return 0; } });
      const ok = vals.map(v => d.low ? v <= min : v >= min);
      if(d.all){ ok.forEach((y, i) => { if(y) give(i, d.title); }); continue; }
      let best = null; vals.forEach((v, i) => { if(ok[i] && (best === null || (d.low ? v < best : v > best))) best = v; });
      if(best === null) continue;
      vals.forEach((v, i) => { if(ok[i] && v === best) give(i, d.title); });
    }
    // nobody leaves empty-handed: their strongest stat relative to the table, or a kind award
    let kind = 0;
    out.forEach((o, i) => {
      if(o.list.length) return;
      let pickD = null, score = 0;
      for(const d of defs){
        if(d.all || d.low) continue;
        const vals = players.map(p => { try{ return +d.stat(p) || 0; }catch(e){ return 0; } });
        const top = Math.max(...vals); if(top <= 0 || vals[i] <= 0) continue;
        const r = vals[i] / top; if(r > score){ score = r; pickD = d; }
      }
      o.list.push(pickD && pickD.runnerUp ? pickD.runnerUp : KIND_AWARDS[kind++ % KIND_AWARDS.length]);
    });
    return out;
  },
  /* HTML for a menu's text: one line per player, then the team stats */
  html(result, team){
    const rows = result.map(o => '<b style="color:' + o.p.color + '">' + esc(o.p.name) + '</b> ' +
      o.list.map(t => '<span class="award">' + esc(t) + '</span>').join(' '));
    return '<span class="awards">' + rows.join('<br>') + '</span>' + (team ? '<br><span class="team-stats">' + team + '</span>' : '');
  }
};

window.Arcade = {
  Store, Settings, saveSettings, Sound, Music, THEMES, Names, Input, Touch, Menu, Lobby, TextEntry, Display, run, toast, keepAwake,
  toggleFullscreen, goLandscape, registerOffline, settingsItems, shareInvite, el, esc, dom: { menuDom, lobbyDom },
  Celebrate, Medals, Awards,
  PLAYER_COLORS: ['#f5c542', '#3fd0b0', '#7aa8ff', '#ff7eb6'],
  QUALITY_LABELS
};
})();
