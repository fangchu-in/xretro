/* xretro.pages.dev/rooms/ABCD  →  the room's Durable Object (in the xretro-rooms Worker).
   Same address as the site, so no extra domain or CORS setup is needed. */
/* Only the xRetro site (and local testing) may use the rooms. Other websites can't borrow them. */
const okOrigin = o => { if (!o) return true; try { const h = new URL(o).hostname; return h === 'xretro.pages.dev' || h.endsWith('.xretro.pages.dev') || h === 'localhost' || h === '127.0.0.1'; } catch (e) { return false; } };
export async function onRequest({ request, env, params }) {
  if (!okOrigin(request.headers.get('Origin'))) return new Response('Rooms are only for xretro.pages.dev.', { status: 403 });
  if (!env.ROOMS) return new Response('Online rooms are not switched on yet.', { status: 503 });
  const code = String(params.code || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return new Response('Room codes are 4 letters.', { status: 400 });
  return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
}
