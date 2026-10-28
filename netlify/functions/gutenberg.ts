import { fetchGutenbergText, textHeaders } from '../../api/_gutenberg.js';

// Netlify counterpart of api/gutenberg/[id].ts: without it the SPA fallback
// in netlify.toml answers /api/gutenberg/<id> with index.html.
export default async (request: Request, context: { params: Record<string, string> }) => {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  }

  const result = await fetchGutenbergText(context.params.id);
  return new Response(result.text, {
    status: result.status,
    headers: result.status === 200 ? textHeaders : undefined,
  });
};

export const config = { path: '/api/gutenberg/:id' };
