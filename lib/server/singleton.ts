// Next.js re-evaluates server modules on every hot reload in dev, and route
// handlers can land in separate module instances. Anything long-lived (the
// WhatsApp browser sessions above all) must therefore hang off globalThis
// rather than off module scope, or a single file save would orphan a running
// Chromium and force a fresh QR scan.
const store = ((globalThis as Record<string, unknown>).__weddingBroadcast ??= {}) as Record<
  string,
  unknown
>;

export function singleton<T>(key: string, create: () => T): T {
  if (!(key in store)) {
    store[key] = create();
  }
  return store[key] as T;
}
