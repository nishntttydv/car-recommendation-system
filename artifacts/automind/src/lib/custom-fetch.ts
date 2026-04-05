import { getToken } from "./auth";

export const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return fetch(input, { ...init, headers });
};
