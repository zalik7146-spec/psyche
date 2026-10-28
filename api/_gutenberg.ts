// Shared by the Vercel route (api/gutenberg/[id].ts) and the Netlify function
// (netlify/functions/gutenberg.ts). Files starting with "_" are not routes on Vercel.

export type GutenbergResult =
  | { status: 200; text: string }
  | { status: 400 | 502; text: string };

export async function fetchGutenbergText(id: string | undefined): Promise<GutenbergResult> {
  if (!id || !/^\d{1,8}$/.test(id)) return { status: 400, text: 'Invalid book id' };

  const paths = [
    `/cache/epub/${id}/pg${id}.txt`,
    `/files/${id}/${id}-0.txt`,
    `/files/${id}/${id}.txt`,
    `/ebooks/${id}.txt.utf-8`,
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
      return { status: 200, text };
    } catch {
      // Try the next standard Gutenberg filename when one path is unavailable.
    }
  }

  return { status: 502, text: 'The public text could not be loaded from Project Gutenberg' };
}

export const textHeaders = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
  'X-Content-Type-Options': 'nosniff',
};
