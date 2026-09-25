/* xRetro rooms — the online-multiplayer relay.

   One Durable Object per 4-letter room code. The host's browser runs the game;
   guests send their controller input to the host, the host sends the picture
   (game state) back to everyone. This server never runs game logic: it only
   passes messages along, so every game works online without server changes.

   Uses the WebSocket Hibernation API: an idle room costs nothing. */
import { DurableObject } from 'cloudflare:workers';

const MAX_SOCKETS = 10;
const CODE_RE = /^[A-Z]{4}$/;
const clean = (s, n) => String(s || '').replace(/[^\p{L}\p{N} _.'!-]/gu, '').trim().slice(0, n);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/rooms\/([A-Za-z]{4})\/?$/);
    if (!m) return new Response('xRetro rooms server. Play at https://xretro.pages.dev', { status: 200 });
    const code = m[1].toUpperCase();
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
  }
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the room up.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  sockets() {
    return this.ctx.getWebSockets().map(ws => ({ ws, a: ws.deserializeAttachment() || {} })).filter(x => x.a.peer);
  }
  host() { return this.sockets().find(x => x.a.role === 'host') || null; }
  peers() { return this.sockets().filter(x => x.a.role === 'guest').map(x => ({ id: x.a.peer, name: x.a.name })); }
  send(ws, obj) { try { ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj)); } catch (e) {} }
  toGuests(msg, except) { for (const x of this.sockets()) if (x.a.role === 'guest' && x.a.peer !== except) this.send(x.ws, msg); }

  async fetch(request) {
    const url = new URL(request.url);
    const code = (url.pathname.match(/([A-Za-z]{4})\/?$/) || [])[1];
    if (request.headers.get('Upgrade') !== 'websocket') {
      const h = this.host();
      return Response.json({ code: code && code.toUpperCase(), open: !!h, game: h ? h.a.game : null, players: this.peers().length + (h ? 1 : 0) });
    }
    const role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const peer = clean(url.searchParams.get('peer'), 24);
    const name = clean(url.searchParams.get('name'), 12) || 'Player';
    const game = clean(url.searchParams.get('game'), 20);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const refuse = (why) => { this.send(server, { t: 'err', why }); server.close(4000, why); return new Response(null, { status: 101, webSocket: client }); };
    if (!peer) return refuse('bad-request');

    // A reconnect from the same device replaces its old connection.
    for (const x of this.sockets()) if (x.a.peer === peer) { try { x.ws.close(4001, 'replaced'); } catch (e) {} x.ws.serializeAttachment({}); }

    const host = this.host();
    if (role === 'host' && host) return refuse('taken');
    if (role === 'guest') {
      if (!host) return refuse('no-room');
      if (game && host.a.game && game !== host.a.game) return refuse('other-game:' + host.a.game);
    }
    if (this.sockets().length >= MAX_SOCKETS) return refuse('full');

    server.serializeAttachment({ role, peer, name, game: role === 'host' ? game : (host && host.a.game) });
    this.send(server, { t: 'welcome', you: peer, role, host: role === 'host' ? peer : host.a.peer, hostName: role === 'host' ? name : host.a.name, peers: this.peers() });
    if (role === 'guest') this.send(host.ws, { t: 'join', id: peer, name });
    else this.toGuests({ t: 'host-back' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, msg) {
    const a = ws.deserializeAttachment() || {};
    if (!a.peer || typeof msg !== 'string' || msg.length > 200000) return;
    if (a.role === 'host') {
      // {"to":"peer","m":{...}} goes to one guest; anything else goes to every guest.
      if (msg.startsWith('{"to":')) {
        let o; try { o = JSON.parse(msg); } catch (e) { return; }
        const g = this.sockets().find(x => x.a.peer === o.to && x.a.role === 'guest');
        if (g) this.send(g.ws, o.m);
        if (o.kick && g) { try { g.ws.close(4002, 'kicked'); } catch (e) {} }
      } else this.toGuests(msg);
    } else {
      const h = this.host();
      if (!h) return;
      // Wrap without re-parsing: the host learns who sent it.
      if (msg[0] !== '{') return;
      this.send(h.ws, '{"t":"from","from":"' + a.peer + '","m":' + msg + '}');
    }
  }

  async webSocketClose(ws, code) {
    const a = ws.deserializeAttachment() || {};
    ws.serializeAttachment({});
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {}
    if (!a.peer) return;
    if (a.role === 'host') this.toGuests({ t: 'host-away' });
    else { const h = this.host(); if (h) this.send(h.ws, { t: 'leave', id: a.peer }); }
  }
  async webSocketError(ws) { return this.webSocketClose(ws, 1011); }
}
