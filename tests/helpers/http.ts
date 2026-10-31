// Builds the Request objects and route params that Next.js hands to route handlers.

export function jsonRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function rawRequest(url: string, method: string, body: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, { method, headers, body });
}

export function formRequest(url: string, form: FormData, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${url}`, { method: "POST", body: form, headers });
}

export function params<T extends Record<string, string>>(p: T) {
  return { params: Promise.resolve(p) };
}

export async function readJson(res: Response) {
  return (await res.json()) as Record<string, any>;
}
