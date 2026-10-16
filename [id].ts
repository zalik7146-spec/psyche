interface VercelRequest {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  send(body: string): void;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).send('Method not allowed');
  }

  const rawId = request.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id || !/^\d{1,8}$/.test(id)) return response.status(400).send('Invalid book id');

  const paths = [
    `/cache/epub/${id}/pg${id}.txt`,
    `/files/${id}/${id}-0.txt`,
    `/files/${id}/${id}.txt`,
  ];
  const deadline = Date.now() + 8_000;

  for (const path of paths) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const upstream = await fetch(`https://www.gutenberg.org${path}`, {
        headers: { Accept: 'text/plain' },
        redirect: 'follow',
        signal: AbortSignal.timeout(remaining),
      });
      if (!upstream.ok) continue;

      const text = await upstream.text();
      if (text.length < 100) continue;
      response.setHeader('Content-Type', 'text/plain; charset=utf-8');
      response.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      return response.status(200).send(text);
    } catch {
      // Try the next standard Gutenberg filename when one path is unavailable.
    }
  }

  return response.status(502).send('The public text could not be loaded from Project Gutenberg');
}
