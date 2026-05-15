// Access token lives only in memory — not in localStorage nor sessionStorage.
// On page refresh, AuthProvider calls /auth/refresh (httpOnly cookie) to recover it.

let _accessToken: string | null = null;

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

export function clearAccessToken(): void {
  _accessToken = null;
}
