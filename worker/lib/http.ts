export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function error(status: number, code: string, message: string) {
  return json({ error: { code, message } }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}
