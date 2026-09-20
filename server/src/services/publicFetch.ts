export class UpstreamTimeoutError extends Error {
  constructor(url: string) {
    super(`Timed out fetching ${url}`);
    this.name = 'UpstreamTimeoutError';
  }
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Upstream ${url} returned ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new UpstreamTimeoutError(url);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
