export function getToken(): string | null {
  return localStorage.getItem("automind_token");
}

export function setToken(token: string): void {
  localStorage.setItem("automind_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("automind_token");
}

export function getAuthHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
