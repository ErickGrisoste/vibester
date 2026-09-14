const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRIES = 3;
const BASE_DELAY_MS = 500;

export async function fetchWithTimeout(
  url: URL | string,
  initOrTimeout?: RequestInit | number,
  retries = DEFAULT_RETRIES
): Promise<Response> {
  const timeoutMs = typeof initOrTimeout === "number" ? initOrTimeout : DEFAULT_TIMEOUT_MS;
  const init: RequestInit = typeof initOrTimeout === "object" ? initOrTimeout : {};

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url.toString(), { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const backoff = BASE_DELAY_MS * Math.pow(2, attempt);
        const jitter = Math.random() * backoff * 0.5;
        await new Promise((r) => setTimeout(r, backoff + jitter));
      }
    }
  }

  throw lastError;
}
