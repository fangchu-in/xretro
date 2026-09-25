/* xretro.pages.dev/rooms/ABCD  →  the room's Durable Object (in the xretro-rooms Worker).
   Same address as the site, so no extra domain or CORS setup is needed. */
export async function onRequest({ request, env, params }) {
  if (!env.ROOMS) return new Response('Online rooms are not switched on yet.', { status: 503 });
  const code = String(params.code || '').toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return new Response('Room codes are 4 letters.', { status: 400 });
  return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
}
