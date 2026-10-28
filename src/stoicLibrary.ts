// «Стоическая библиотека»: подобранные тексты из общественного достояния.
// Тексты загружаются с Project Gutenberg через собственный маршрут /api/gutenberg/<id>.
// Книга на полке связывается с текстом по названию, поэтому связь не теряется
// при синхронизации между устройствами.

export interface StoicText {
  gutenbergId: number;
  title: string;
  author: string;
  note: string;
}

export const STOIC_LIBRARY: StoicText[] = [
  { gutenbergId: 2680, title: 'Meditations', author: 'Марк Аврелий', note: 'Записи императора для самого себя' },
  { gutenbergId: 45109, title: 'The Enchiridion', author: 'Эпиктет', note: 'Краткое руководство: что в нашей власти' },
  { gutenbergId: 10661, title: 'A Selection from the Discourses of Epictetus', author: 'Эпиктет', note: 'Беседы, записанные Аррианом' },
  { gutenbergId: 871, title: 'The Golden Sayings of Epictetus', author: 'Эпиктет', note: 'Изречения и гимн Клеанфа' },
  { gutenbergId: 64576, title: 'Minor Dialogues', author: 'Сенека', note: 'О гневе, о блаженной жизни, о краткости жизни' },
  { gutenbergId: 56075, title: "Seneca's Morals of a Happy Life", author: 'Сенека', note: 'О счастливой жизни, благодеяниях и гневе' },
  { gutenbergId: 3794, title: 'On Benefits', author: 'Сенека', note: 'Как давать и принимать' },
  { gutenbergId: 14328, title: 'The Consolation of Philosophy', author: 'Боэций', note: 'Философия как утешение в темнице' },
  { gutenbergId: 14988, title: 'Tusculan Disputations', author: 'Цицерон', note: 'О смерти, боли и страстях' },
  { gutenbergId: 2808, title: 'On Friendship and Old Age', author: 'Цицерон', note: 'Два трактата о дружбе и старости' },
];

const norm = (s: string) => s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function stoicTextFor(title: string): StoicText | undefined {
  const t = norm(title);
  return STOIC_LIBRARY.find(b => norm(b.title) === t);
}
