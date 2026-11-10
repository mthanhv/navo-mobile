import * as SecureStore from "expo-secure-store";

/**
 * The one HTTP client of the mobile app. The session token lives in secure
 * storage (never AsyncStorage) and is sent as a Bearer header; every call has a
 * request id the API logs. Errors keep codes so they are worded in the user's language.
 */
export type FieldError = { field: string; code: string; params?: Record<string, unknown> };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly reason?: string,
    readonly params?: Record<string, unknown>,
    readonly fields: FieldError[] = [],
    readonly requestId?: string,
  ) {
    super(message);
  }
}

export type Page<T> = { items: T[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } };

/** Simulator default; a phone on the LAN needs EXPO_PUBLIC_API_URL=http://<computer-ip>:8080. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
const TOKEN_KEY = "navo.session";
const TIMEOUT_MS = 20_000;

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function loadToken(): Promise<string | null> {
  token = await SecureStore.getItemAsync(TOKEN_KEY);
  return token;
}

export async function saveToken(value: string | null) {
  token = value;
  if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

const rid = () => `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** A file picked on the phone (photo), sent as multipart. */
export type LocalFile = { uri: string; name: string; type: string };

export async function upload<T>(path: string, fields: Record<string, string>, file: LocalFile): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  form.append("file", file as unknown as Blob); // React Native's FormData takes { uri, name, type }
  return api<T>(path, { method: "POST", form, timeoutMs: 120_000 });
}

export async function api<T>(path: string, { method = "GET", body, form, timeoutMs = TIMEOUT_MS }: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number } = {}): Promise<T> {
  const requestId = rid();
  const headers: Record<string, string> = { "X-Request-ID": requestId };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)), signal: controller.signal });
  } catch (e) {
    throw new ApiError(0, (e as Error).name === "AbortError" ? "network.timeout" : "network.offline", (e as Error).message, undefined, undefined, [], requestId);
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T; error_code?: string; error?: string; reason?: string; params?: Record<string, unknown>; errors?: FieldError[]; request_id?: string;
  } | null;
  if (!res.ok) {
    // Only a request that carried a session can find it expired.
    if (res.status === 401 && path !== "/auth/login" && headers.Authorization) onUnauthorized?.();
    throw new ApiError(res.status, json?.error_code ?? "server.internal", json?.error ?? "", json?.reason, json?.params, json?.errors ?? [], json?.request_id ?? requestId);
  }
  return json?.data as T;
}

/** Complete small selector lists; never silently drop entries after the first page. */
export async function allPages<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const result = await api<Page<T>>(`${path}${path.includes("?") ? "&" : "?"}page_size=100&page=${page}`);
    out.push(...result.items);
    if (page >= result.pagination.totalPages) return out;
  }
}
