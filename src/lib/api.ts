export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error(body.error?.message ?? "เกิดข้อผิดพลาด");
  return body;
}
