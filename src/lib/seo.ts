import { site } from './globals';

export const SITE_URL = (
  import.meta.env.PUBLIC_SITE_URL ?? 'https://szklarz.pruszkow.pl'
).replace(/\/$/, '');

/**
 * Sufiks doklejany do tytułów podstron. Stary serwis miał tu samo „— SZKLARZ";
 * dokładamy miasto, bo to ono decyduje o widoczności w wyszukiwaniu lokalnym.
 * Strona główna ma własny, pełny tytuł.
 */
const TITLE_SUFFIX = `${site.companyName} Pruszków`;

const MAX_TITLE = 60;
const MAX_DESCRIPTION = 160;

export interface SeoInput {
  metaTitle?: string | undefined;
  metaDescription?: string | undefined;
  ogImage?: string | undefined;
  canonical?: string | undefined;
  noindex?: boolean | undefined;
  keywords?: string[] | undefined;
}

export interface ResolvedSeo {
  title: string;
  description: string;
  canonical: string;
  ogImage: string | undefined;
  noindex: boolean;
  keywords: string[];
}

/** Przycina do pełnego słowa, żeby opis nie urywał się w połowie wyrazu. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Buduje absolutny URL kanoniczny. Serwis pracuje bez końcowego ukośnika. */
export function absoluteUrl(pathname: string): string {
  const path = `/${pathname}`.replace(/\/{2,}/g, '/');
  const withoutTrailing = path.length > 1 ? path.replace(/\/$/, '') : '/';
  return `${SITE_URL}${withoutTrailing}`;
}

/**
 * Składa `<title>`, `meta description` i `canonical` z pola `seo` wpisu,
 * z fallbackami na tytuł i treść. Nigdy nie zwraca pustego opisu — brak
 * unikalnego `meta description` był problemem nr 5 w audycie oryginału.
 */
export function resolveSeo(options: {
  seo?: SeoInput | undefined;
  title: string;
  fallbackDescription?: string | undefined;
  pathname: string;
  isHome?: boolean;
}): ResolvedSeo {
  const { seo, title, fallbackDescription, pathname, isHome = false } = options;

  const rawTitle = seo?.metaTitle ?? (isHome ? title : `${title} | ${TITLE_SUFFIX}`);
  const rawDescription =
    seo?.metaDescription ?? fallbackDescription ?? `${title} — ${site.tagline}.`;

  return {
    title: truncate(rawTitle, MAX_TITLE),
    description: truncate(rawDescription, MAX_DESCRIPTION),
    canonical: seo?.canonical ?? absoluteUrl(pathname),
    ogImage: seo?.ogImage,
    noindex: seo?.noindex ?? false,
    keywords: seo?.keywords ?? [],
  };
}

/** Zamienia Markdown na tekst nadający się na `meta description`. */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
