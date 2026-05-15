import { clearAccessToken, getAccessToken, setAccessToken } from "./auth";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://92.113.39.212:8000";

export interface UserInfo {
  id: number;
  username: string;
  role: "admin" | "gestor" | "escuela";
  school_id: number | null;
}

// Wraps fetch: attaches Bearer token, retries once after a transparent refresh.
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const doRequest = (token: string | null) => {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_URL}${path}`, { ...options, headers, credentials: "include" });
  };

  let res = await doRequest(getAccessToken());

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doRequest(getAccessToken());
    }
  }

  return res;
}

// Returns true if a new access token was obtained.
export async function tryRefresh(): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) {
    clearAccessToken();
    return false;
  }
  const data = await res.json();
  setAccessToken(data.access_token);
  return true;
}

export async function apiLogin(
  username: string,
  password: string
): Promise<{ access_token: string; user: UserInfo }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Error al iniciar sesión");
  }
  return res.json();
}

export async function apiLogout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  clearAccessToken();
}

export async function apiGetMe(): Promise<UserInfo> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) throw new Error("No autenticado");
  return res.json();
}
