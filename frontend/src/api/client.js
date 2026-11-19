// Client HTTP générique : base d'URL, jeton administrateur, erreurs lisibles.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter ? Number(retryAfter) : null;
  }
}

export async function request(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Impossible de joindre le serveur.", 0);
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* réponse sans JSON */
  }
  if (!res.ok) throw new ApiError(data?.message || `Erreur HTTP ${res.status}`, res.status, res.headers.get("Retry-After"));
  return data;
}
