/// <reference types="astro/client" />

declare module '*.yml?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  /** Ustawiane przez Cloudflare Pages. `main` = produkcja, reszta = preview. */
  readonly CF_PAGES_BRANCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
