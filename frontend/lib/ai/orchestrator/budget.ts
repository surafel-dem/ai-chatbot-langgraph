export const MAX_STEPS = 8;
export const TOOL_TIMEOUT_MS = 12_000;

export async function withTimeout<T>(p: Promise<T>, ms = TOOL_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('tool-timeout')), ms)),
  ]);
}

export async function withRetries<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (attempt++ >= retries) throw e;
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
}


