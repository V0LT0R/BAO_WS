const canonicalOrigin = 'https://bao-cv.com';
const redirectHost = 'www.bao-cv.com';

export default {
  fetch(request) {
    const incoming = new URL(request.url);
    if (incoming.hostname !== redirectHost) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
    }

    // Assign URL parts instead of resolving an untrusted path that may start with //.
    const destination = new URL(canonicalOrigin);
    destination.pathname = incoming.pathname;
    destination.search = incoming.search;
    return new Response(null, {
      status: 308,
      headers: {
        Location: destination.href,
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
  },
};
