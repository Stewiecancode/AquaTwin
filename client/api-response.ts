export async function readApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    // Proxies can return HTML or plain text instead of the API envelope.
  }
  const envelope =
    body !== null && typeof body === "object"
      ? (body as { error?: unknown; data?: T })
      : undefined;
  if (!res.ok) {
    if (typeof envelope?.error === "string" && envelope.error)
      throw new Error(envelope.error);
    throw new Error(
      `API request failed (HTTP ${res.status}). Check that the API server is running and the API URL is correct.`,
    );
  }
  if (res.status === 204) return undefined as T;
  if (!envelope || !("data" in envelope))
    throw new Error(
      "The API returned an empty or invalid response. Check the API URL and server.",
    );
  return envelope.data as T;
}
