import { fetchGutenbergText, textHeaders } from '../_gutenberg.js';

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
  const result = await fetchGutenbergText(id);
  if (result.status === 200) {
    for (const [name, value] of Object.entries(textHeaders)) response.setHeader(name, value);
  }
  return response.status(result.status).send(result.text);
}
