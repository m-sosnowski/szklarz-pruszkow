import { setTimeout as sleep } from 'node:timers/promises';

/**
 * Minimalny klient HTTP do migracji: kolejkuje żądania, ogranicza
 * równoległość i ponawia błędy przejściowe.
 *
 * Stara strona stoi na jednym nginxie i nie ma powodu jej zalewać —
 * pobranie ~500 zasobów przy 4 równoległych połączeniach trwa kilka minut
 * i nie robi nikomu krzywdy.
 */

// Nagłówki HTTP muszą być ASCII — bez polskich znaków.
const USER_AGENT =
  'szklarz-pruszkow-migration/1.0 (one-off content migration of our own site)';

export interface FetchOptions {
  /** Ile razy ponowić przy błędzie sieci lub 5xx. */
  retries?: number;
  /** Odstęp między próbami, podwajany przy każdej kolejnej. */
  backoffMs?: number;
}

const TRANSIENT_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function fetchBuffer(
  url: string,
  options: FetchOptions = {},
): Promise<{ body: Buffer; status: number; contentType: string }> {
  const { retries = 3, backoffMs = 800 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (attempt > 0) await sleep(backoffMs * 2 ** (attempt - 1));

    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, 'accept-encoding': 'gzip, deflate' },
        redirect: 'follow',
        signal: AbortSignal.timeout(30_000),
      });

      if (TRANSIENT_STATUS.has(response.status)) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }

      return {
        body: Buffer.from(await response.arrayBuffer()),
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Nie udało się pobrać ${url} po ${retries + 1} próbach: ` +
      (lastError instanceof Error ? lastError.message : String(lastError)),
  );
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  const { body } = await fetchBuffer(url, options);
  return body.toString('utf8');
}

/** Uruchamia zadania z ograniczoną równoległością, zachowując kolejność wyników. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]!, index);
    }
  });

  await Promise.all(runners);
  return results;
}
