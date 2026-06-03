// Access token lives only in memory — not in localStorage nor sessionStorage.
// On page refresh, AuthProvider calls /auth/refresh (httpOnly cookie) to recover it.

let _accessToken: string | null = null;
const AUTH_EXPIRED_EVENT = "auth:expired";

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearAccessToken(): void {
  _accessToken = null;
}

export function notifyAuthExpired(): void {
  clearAccessToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

export function onAuthExpired(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener(AUTH_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, callback);
}
