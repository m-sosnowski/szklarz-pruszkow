// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Serwis mieszka na apeksie — to on jest kanoniczny w Google od lat
// i nie ma powodu przenosić dorobku na www tylko dla symetrii z innym projektem.
const SITE = process.env.PUBLIC_SITE_URL ?? 'https://szklarz.pruszkow.pl';

export default defineConfig({
  site: SITE,
  output: 'static',
  trailingSlash: 'never',
  build: {
    // Pliki zamiast katalogów: /kontakt.html, nie /kontakt/index.html.
    // Spójne z trailingSlash: 'never' i z canonical.
    format: 'file',
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  image: {
    responsiveStyles: true,
  },
});
