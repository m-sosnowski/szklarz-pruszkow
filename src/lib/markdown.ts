import { Marked } from 'marked';

/**
 * Renderuje Markdown zapisany w polach frontmatteru (bloki `richText`,
 * odpowiedzi FAQ). Treść pochodzi wyłącznie z repozytorium — z migracji
 * albo z panelu CMS, do którego dostęp ma tylko właściciel tokenu — więc
 * nie ma tu ścieżki od anonimowego użytkownika do HTML-a na stronie.
 */
const marked = new Marked({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(source: string): string {
  return marked.parse(source, { async: false });
}

/** Wariant dla krótkich tekstów: bez opakowywania w `<p>`. */
export function renderInline(source: string): string {
  return marked.parseInline(source, { async: false });
}
