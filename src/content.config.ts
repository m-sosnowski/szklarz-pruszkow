import { defineCollection, type SchemaContext } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ICON_NAMES } from './lib/icons';

/**
 * Model treści serwisu. Ten plik jest źródłem prawdy dla builda;
 * jego odpowiednikiem dla edytora jest `public/admin/config.yml`.
 * Zgodności obu pilnuje `scripts/check-cms-schema.ts` w CI.
 */

/** Funkcja `image` wstrzykiwana przez Astro do schematu kolekcji. */
type ImageFn = SchemaContext['image'];

/* ---------------------------------------------------------------------------
   Wspólne fragmenty
   --------------------------------------------------------------------------- */

const seo = z
  .object({
    metaTitle: z.string().max(70).optional(),
    metaDescription: z.string().min(50).max(170).optional(),
    ogImage: z.string().optional(),
    /**
     * CMS zapisuje puste pole `string` jako `''`, nie pomija go —
     * `z.url()` odrzuca pusty string, więc zamieniamy go na `undefined`.
     */
    canonical: z
      .union([z.literal(''), z.url()])
      .nullable()
      .optional()
      .transform((value) => (value ? value : undefined)),
    noindex: z.boolean().default(false),
    keywords: z.array(z.string()).default([]),
  })
  .default({ canonical: undefined, noindex: false, keywords: [] });

/**
 * `alt` jest wymagany świadomie. Na starym serwisie wszystkie 156 zdjęć
 * miało `alt=""`; tutaj brak opisu wywala build, więc problem nie ma jak wrócić.
 */
const imageWithAlt = (image: ImageFn) =>
  z.object({
    src: image(),
    alt: z.string().min(3),
  });

const link = z.object({
  label: z.string(),
  href: z.string(),
});

/**
 * CMS zapisuje pusty (nierozwinięty) `widget: object` jako `null`,
 * nie pomija go — zod przyjmuje tu tylko `undefined` dla `.optional()`.
 */
const optionalLink = link
  .nullable()
  .optional()
  .transform((value) => value ?? undefined);

const icon = z.enum(ICON_NAMES);

/**
 * Wspólne pola każdego bloku-sekcji. `background` robi rytm strony —
 * naprzemienne `paper` / `mist` / `deep` / `glass` zamiast jednej białej
 * płachty od nagłówka do stopki. `anchor` daje adres z kotwicą, na który
 * linkuje stopka (np. /uslugi-szklarskie#kabiny).
 */
const sectionShape = {
  eyebrow: z.string().optional(),
  anchor: z.string().optional(),
  background: z.enum(['paper', 'mist', 'deep', 'glass']).default('paper'),
  tight: z.boolean().default(false),
};

/* ---------------------------------------------------------------------------
   Bloki treści. Wartość `type` mapuje się 1:1 na komponent
   w `src/components/blocks/`.
   --------------------------------------------------------------------------- */

const blocks = (image: ImageFn) =>
  z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('richText'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          body: z.string(),
          /** `panel` zamyka tekst w ramkę z akcentem — dobre dla krótkich not. */
          variant: z.enum(['prose', 'panel']).default('prose'),
        }),

        z.object({
          type: z.literal('valueCards'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          items: z
            .array(
              z.object({
                icon: icon.default('shield'),
                title: z.string(),
                body: z.string().optional(),
              }),
            )
            .min(1),
        }),

        z.object({
          type: z.literal('offerCards'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          items: z
            .array(
              z.object({
                title: z.string(),
                body: z.string().optional(),
                href: z.string().optional(),
                linkLabel: z.string().optional(),
                image: image().optional(),
                imageAlt: z.string().optional(),
              }),
            )
            .min(1),
        }),

        z.object({
          type: z.literal('split'),
          ...sectionShape,
          heading: z.string(),
          body: z.string().optional(),
          image: image().optional(),
          imageAlt: z.string().optional(),
          /** Zdjęcie po lewej zamiast po prawej. */
          reverse: z.boolean().default(false),
          checks: z.array(z.string()).default([]),
          buttons: z.array(link).default([]),
        }),

        z.object({
          type: z.literal('steps'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          items: z.array(z.object({ title: z.string(), body: z.string() })).min(1),
        }),

        z.object({
          type: z.literal('stats'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          items: z.array(z.object({ value: z.string(), label: z.string() })).min(1),
        }),

        /**
         * Siatka etykiet asortymentu. Treść oryginału to w dużej mierze
         * wyliczenia („szkło bezbarwne, kolorowe, bezpieczne, antywłamaniowe,
         * laminowane…") — jako proza są nieczytelne, jako chipy czytają się
         * od razu i nadal indeksują się jako zwykły tekst.
         */
        z.object({
          type: z.literal('chips'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          groups: z
            .array(
              z.object({
                title: z.string(),
                items: z.array(z.string()).min(1),
              }),
            )
            .min(1),
        }),

        z.object({
          type: z.literal('imageGallery'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          columns: z.enum(['2', '3', '4']).default('4'),
          images: z.array(imageWithAlt(image)).min(1),
        }),

        z.object({
          type: z.literal('specTable'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          rows: z.array(z.object({ name: z.string(), value: z.string() })).min(1),
        }),

        z.object({
          type: z.literal('faq'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          items: z.array(z.object({ question: z.string(), answer: z.string() })).min(1),
        }),

        z.object({
          type: z.literal('areaServed'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
        }),

        z.object({
          type: z.literal('cta'),
          heading: z.string(),
          body: z.string().optional(),
          primary: optionalLink,
          secondary: optionalLink,
        }),

        z.object({
          type: z.literal('contact'),
          ...sectionShape,
          heading: z.string().optional(),
          intro: z.string().optional(),
          /**
           * Adres usługi przyjmującej POST. Puste pole = Web3Forms, jeśli
           * w `site.yml` jest klucz dostępu, a w przeciwnym razie formularz
           * otwiera program pocztowy.
           */
          endpoint: z.string().default(''),
        }),
      ]),
    )
    .default([]);

/* ---------------------------------------------------------------------------
   Hero
   --------------------------------------------------------------------------- */

const hero = (image: ImageFn) =>
  z
    .object({
      /** `home` to duży hero z kolażem, `page` — nagłówek podstrony. */
      variant: z.enum(['home', 'page']).default('page'),
      eyebrow: z.string().optional(),
      heading: z.string(),
      subheading: z.string().optional(),
      ctaPrimary: optionalLink,
      ctaSecondary: optionalLink,
      stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
      /** Trzy kadry kolażu w wariancie `home`; nadmiarowe są ignorowane. */
      collage: z.array(imageWithAlt(image)).default([]),
    })
    .optional();

/* ---------------------------------------------------------------------------
   Kolekcje
   --------------------------------------------------------------------------- */

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** Ścieżka bez wiodącego ukośnika. Pusty string = strona główna. */
      slug: z.string(),
      draft: z.boolean().default(false),
      order: z.number().int().default(0),
      /** Krótki opis; zasila `meta description` i karty linkujące tutaj. */
      summary: z.string().optional(),
      /**
       * Nazwa usługi do grafu `Service` w JSON-LD. Puste = strona nie opisuje
       * pojedynczej usługi (strona główna, kontakt) i grafu nie emitujemy.
       */
      serviceName: z.string().optional(),
      hero: hero(image),
      blocks: blocks(image),
      seo,
    }),
});

export const collections = {
  pages,
};
