/**
 * Skrypty interfejsu: menu mobilne, animacja pojawiania się sekcji, lightbox.
 *
 * Wszystko waniliowe i defensywne — każda funkcja sprawdza, czy jej elementy
 * w ogóle są na stronie. Serwis ma działać bez JS-a: menu mobilne to jedyna
 * rzecz, która go wymaga, a galeria bez lightboxa nadal pokazuje wszystkie
 * zdjęcia (kafle są linkami do pełnych plików).
 */

/* -------------------------------------------------------------------------
   Menu mobilne
   ------------------------------------------------------------------------- */

function initDrawer(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-drawer-toggle]');
  const drawer = document.querySelector<HTMLElement>('.drawer');
  if (!toggle || !drawer) return;

  function setOpen(open: boolean): void {
    drawer!.classList.toggle('is-open', open);
    toggle!.setAttribute('aria-expanded', String(open));
    toggle!.setAttribute('aria-label', open ? 'Zamknij menu' : 'Otwórz menu');
    document.body.style.overflow = open ? 'hidden' : '';
  }

  toggle.addEventListener('click', () => {
    setOpen(!drawer.classList.contains('is-open'));
  });

  // Kliknięcie w pozycję menu prowadzi na inną stronę albo do kotwicy —
  // w obu wypadkach szuflada ma się zamknąć.
  drawer.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  // Przejście na desktop przy otwartej szufladzie zostawiłoby zablokowane
  // przewijanie strony bez widocznej przyczyny.
  const wide = window.matchMedia('(min-width: 1081px)');
  wide.addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

/* -------------------------------------------------------------------------
   Pojawianie się sekcji
   ------------------------------------------------------------------------- */

function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('.reveal');
  if (targets.length === 0) return;

  if (
    !('IntersectionObserver' in window) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    targets.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  targets.forEach((element) => observer.observe(element));
}

/* -------------------------------------------------------------------------
   Zwijanie długich galerii
   ------------------------------------------------------------------------- */

function initGalleries(): void {
  for (const gallery of document.querySelectorAll<HTMLElement>('[data-collapsible]')) {
    const button = gallery.parentElement?.querySelector<HTMLButtonElement>('[data-gallery-more]');
    if (!button) continue;

    // Zwijamy dopiero tutaj: gdyby skrypt nie wystartował, galeria zostaje
    // rozwinięta, a przycisk — ukryty.
    gallery.classList.add('is-collapsed');
    button.hidden = false;

    button.addEventListener('click', () => {
      gallery.classList.remove('is-collapsed');
      button.remove();
    });
  }
}

/* -------------------------------------------------------------------------
   Lightbox galerii
   ------------------------------------------------------------------------- */

interface Slide {
  href: string;
  alt: string;
}

function initLightbox(): void {
  const box = document.querySelector<HTMLElement>('.lightbox');
  if (!box) return;

  const image = box.querySelector<HTMLImageElement>('[data-lightbox-image]');
  const caption = box.querySelector<HTMLElement>('[data-lightbox-caption]');
  const counter = box.querySelector<HTMLElement>('[data-lightbox-counter]');
  const closeButton = box.querySelector<HTMLButtonElement>('[data-lightbox-close]');
  const prevButton = box.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
  const nextButton = box.querySelector<HTMLButtonElement>('[data-lightbox-next]');
  if (!image) return;

  /** Aktywna galeria — lightbox przechodzi tylko w obrębie jednego bloku. */
  let slides: Slide[] = [];
  let index = 0;
  let opener: HTMLElement | null = null;

  function show(next: number): void {
    if (slides.length === 0) return;
    index = (next + slides.length) % slides.length;
    const slide = slides[index]!;
    image!.src = slide.href;
    image!.alt = slide.alt;
    if (caption) caption.textContent = slide.alt;
    if (counter) counter.textContent = `${index + 1} / ${slides.length}`;

    const many = slides.length > 1;
    prevButton?.toggleAttribute('hidden', !many);
    nextButton?.toggleAttribute('hidden', !many);
  }

  function open(gallery: HTMLElement, item: HTMLAnchorElement): void {
    const links = [...gallery.querySelectorAll<HTMLAnchorElement>('[data-lightbox-item]')];
    slides = links.map((link) => ({
      href: link.href,
      alt: link.querySelector('img')?.alt ?? '',
    }));

    opener = item;
    box!.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    show(links.indexOf(item));
    closeButton?.focus();
  }

  function close(): void {
    box!.classList.remove('is-open');
    document.body.style.overflow = '';
    // Pusty src zwalnia pamięć po dużym zdjęciu i kasuje je z widoku,
    // gdyby przeglądarka animowała zamknięcie.
    image!.removeAttribute('src');
    opener?.focus();
    opener = null;
  }

  document.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLAnchorElement>('[data-lightbox-item]');
    if (!item) return;
    const gallery = item.closest<HTMLElement>('[data-lightbox-gallery]');
    if (!gallery) return;

    event.preventDefault();
    open(gallery, item);
  });

  closeButton?.addEventListener('click', close);
  prevButton?.addEventListener('click', () => show(index - 1));
  nextButton?.addEventListener('click', () => show(index + 1));

  // Kliknięcie w tło (a nie w samo zdjęcie ani w przyciski) zamyka podgląd.
  box.addEventListener('click', (event) => {
    if (event.target === box) close();
  });

  document.addEventListener('keydown', (event) => {
    if (!box.classList.contains('is-open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });

  /* --- przesunięcie palcem --- */

  let startX = 0;
  let startY = 0;

  box.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    },
    { passive: true },
  );

  box.addEventListener(
    'touchend',
    (event) => {
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Próg 45 px i przewaga poziomu nad pionem, żeby nie łapać przewijania.
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      show(dx > 0 ? index - 1 : index + 1);
    },
    { passive: true },
  );
}

/* -------------------------------------------------------------------------
   Formularz kontaktowy: informacja zwrotna po wysłaniu
   ------------------------------------------------------------------------- */

function initForm(): void {
  const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
  if (!form) return;

  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const endpoint = form.action;

  // Formularz bez endpointu (fallback na mailto:) obsługuje przeglądarka.
  if (!endpoint || form.dataset.mode !== 'ajax') return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (button) {
      button.disabled = true;
      button.dataset.label = button.textContent ?? '';
      button.textContent = 'Wysyłanie…';
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      form.reset();
      if (status) {
        status.textContent = 'Dziękujemy — wiadomość została wysłana. Odezwiemy się wkrótce.';
        status.dataset.state = 'ok';
      }
    } catch {
      if (status) {
        status.textContent =
          'Nie udało się wysłać wiadomości. Prosimy o telefon albo e-mail — dane są obok formularza.';
        status.dataset.state = 'error';
      }
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = button.dataset.label ?? 'Wyślij';
      }
    }
  });
}

/* ------------------------------------------------------------------------- */

initDrawer();
initReveal();
initGalleries();
initLightbox();
initForm();
