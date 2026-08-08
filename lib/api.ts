/** Fetch wrapper that turns the API's `{ error }` payloads into thrown Errors. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error('אין תקשורת עם השרת');
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data as { error?: string } | null)?.error || 'שגיאת שרת');
  }
  return data as T;
}

export function apiJson<T>(url: string, method: string, body: unknown): Promise<T> {
  return api<T>(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
