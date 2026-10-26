export interface BookSearchResult {
  id: string
  title: string
  author: string
  coverUrl?: string
  year?: string
  pages?: number
  genre?: string
  description?: string
  source: 'Google Books' | 'Open Library' | 'Project Gutenberg'
  sourceUrl?: string
  textUrl?: string
  gutenbergId?: number
}

interface GoogleBook {
  id: string
  volumeInfo?: {
    title?: string
    authors?: string[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    publishedDate?: string
    pageCount?: number
    categories?: string[]
    description?: string
    previewLink?: string
  }
}

interface OpenLibraryBook {
  key: string
  title?: string
  author_name?: string[]
  cover_i?: number
  first_publish_year?: number
  number_of_pages_median?: number
  subject?: string[]
}

interface GutenbergBook {
  id: number
  title: string
  authors?: Array<{ name: string }>
  subjects?: string[]
  media_type?: string
  formats?: Record<string, string>
}

const normalizeTitle = (value: string) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()

// AbortSignal.any/timeout are missing in older Safari (iOS < 17.4), where calling them
// throws and every catalog source looks "unavailable".
export function withTimeout(signal: AbortSignal, ms: number): AbortSignal {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, ms)
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return controller.signal
}

function asJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`Catalog request failed (${response.status})`)
  return response.json() as Promise<T>
}

async function searchGoogle(query: string, signal: AbortSignal): Promise<BookSearchResult[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12&printType=books`
  const data = await asJson<{ items?: GoogleBook[] }>(await fetch(url, { signal }))
  return (data.items || []).flatMap(({ id, volumeInfo: info }) => {
    if (!info?.title) return []
    const coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail
    return [{
      id: `google:${id}`,
      title: info.title,
      author: info.authors?.join(', ') || 'Автор неизвестен',
      coverUrl: coverUrl?.replace(/^http:/, 'https:'),
      year: info.publishedDate?.slice(0, 4),
      pages: info.pageCount,
      genre: info.categories?.[0],
      description: info.description,
      source: 'Google Books' as const,
      sourceUrl: info.previewLink,
    }]
  })
}

async function searchOpenLibrary(query: string, signal: AbortSignal): Promise<BookSearchResult[]> {
  const fields = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject'
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12&fields=${fields}`
  const data = await asJson<{ docs?: OpenLibraryBook[] }>(await fetch(url, { signal }))
  return (data.docs || []).flatMap(book => {
    if (!book.title || !book.key) return []
    return [{
      id: `openlibrary:${book.key}`,
      title: book.title,
      author: book.author_name?.join(', ') || 'Автор неизвестен',
      coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : undefined,
      year: book.first_publish_year?.toString(),
      pages: book.number_of_pages_median,
      genre: book.subject?.[0],
      source: 'Open Library' as const,
      sourceUrl: `https://openlibrary.org${book.key}`,
    }]
  })
}

async function searchGutenberg(query: string, signal: AbortSignal): Promise<BookSearchResult[]> {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`
  const data = await asJson<{ results?: GutenbergBook[] }>(await fetch(url, { signal }))
  return (data.results || []).flatMap(book => {
    if (!book.title || !Number.isFinite(book.id)) return []
    // Audiobooks ("Sound") share titles with the texts but only ship a readme.
    if (book.media_type && book.media_type !== 'Text') return []
    if (book.formats && !Object.keys(book.formats).some(type => type.startsWith('text/plain'))) return []
    const textUrl = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`
    return [{
      id: `gutenberg:${book.id}`,
      title: book.title,
      author: book.authors?.map(author => author.name).join(', ') || 'Автор неизвестен',
      coverUrl: `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.cover.medium.jpg`,
      genre: book.subjects?.[0],
      source: 'Project Gutenberg' as const,
      sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
      textUrl,
      gutenbergId: book.id,
    }]
  })
}

export async function searchBooks(query: string, signal: AbortSignal) {
  const requestSignal = withTimeout(signal, 15_000)
  const sources = await Promise.allSettled([
    searchGoogle(query, requestSignal),
    searchOpenLibrary(query, requestSignal),
    // Gutendex often needs 20–40 s for an uncached query; it is the only source of readable texts.
    searchGutenberg(query, withTimeout(signal, 45_000)),
  ])
  if (signal.aborted) return { books: [], failedSources: [] as string[] }

  const labels = ['Google Books', 'Open Library', 'Project Gutenberg']
  const failedSources = sources.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : [])
  const books = sources.flatMap(result => result.status === 'fulfilled' ? result.value : [])

  // Prefer an openly readable Gutenberg edition when catalog providers list the same work.
  const editions = new Map<string, BookSearchResult>()
  for (const book of books) {
    const key = normalizeTitle(book.title)
    if (!key) continue
    const current = editions.get(key)
    if (!current) {
      editions.set(key, book)
    } else if (book.textUrl && !current.textUrl) {
      editions.set(key, {
        ...current,
        ...book,
        coverUrl: book.coverUrl || current.coverUrl,
        year: book.year || current.year,
        pages: book.pages || current.pages,
        genre: book.genre || current.genre,
        description: book.description || current.description,
      })
    }
  }
  return { books: [...editions.values()].slice(0, 30), failedSources }
}
