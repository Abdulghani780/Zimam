const RETRY_KEY = 'asaas-chunk-reload';
const RETRY_WINDOW_MS = 30_000;

export function recoverFailedChunk(error: unknown): boolean {
  if (!(error instanceof Error) || !/dynamically imported module|loading chunk/i.test(error.message)) {
    return false;
  }

  try {
    const now = Date.now();
    const previous = JSON.parse(sessionStorage.getItem(RETRY_KEY) || 'null') as { path?: string; at?: number } | null;
    if (previous?.path === location.pathname && now - Number(previous.at) < RETRY_WINDOW_MS) {
      return false;
    }
    sessionStorage.setItem(RETRY_KEY, JSON.stringify({ path: location.pathname, at: now }));
  } catch {
    return false;
  }

  location.reload();
  return true;
}
