import { getAccessToken } from "../auth/session";
import type { APIResponse, APIError } from "../../types/api";

const DEFAULT_API_URL = "http://localhost:8000/api/v1";

/**
 * Custom error class capturing backend HTTP status and standardized APIError envelopes.
 */
export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown> | null;

  constructor(status: number, message: string, code: string, details?: Record<string, unknown> | null) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  token?: string | null;
  params?: Record<string, string | number | boolean | undefined | null>;
}

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function mapStatusToDefaultCode(status: number): string {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "AUTHENTICATION_REQUIRED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 500:
      return "INTERNAL_SERVER_ERROR";
    case 502:
      return "AI_PROVIDER_ERROR";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return `HTTP_${status}`;
  }
}

/**
 * Core request dispatcher wrapping native fetch with automatic Bearer token injection,
 * JSON serialization, and canonical error envelope handling.
 */
async function request<T>(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  body?: unknown,
  options: RequestOptions = {}
): Promise<APIResponse<T>> {
  const baseUrl = getBaseUrl();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // Build query string if params are provided
  let url = `${baseUrl}${cleanEndpoint}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  // Header assembly
  const headers = new Headers(options.headers);

  if (body !== undefined && !(body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  // Retrieve token: use explicitly passed token or retrieve from active session
  let token = options.token;
  if (token === undefined) {
    token = await getAccessToken();
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    method,
    headers,
    body: body !== undefined && !(body instanceof FormData) ? JSON.stringify(body) : (body as BodyInit | null | undefined),
  };

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (netErr: unknown) {
    const netMessage = netErr instanceof Error ? netErr.message : "Network request failed: backend service unreachable";
    throw new ApiClientError(
      0,
      netMessage,
      "NETWORK_ERROR"
    );
  }

  // Parse JSON response safely
  let json: unknown = null;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      json = await response.json();
    } catch {
      json = null;
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        json = { message: text };
      }
    } catch {
      json = null;
    }
  }

  const parsedRecord = (json && typeof json === "object" ? json : null) as Record<string, unknown> | null;

  // Handle non-2xx responses
  if (!response.ok) {
    const status = response.status;
    const backendError = parsedRecord?.error as APIError | undefined;
    const message = backendError?.message || (typeof parsedRecord?.message === "string" ? parsedRecord.message : null) || `Request failed with status ${status}`;
    const code = backendError?.code || mapStatusToDefaultCode(status);
    const details = backendError?.details || (parsedRecord?.detail ? { detail: parsedRecord.detail } : null);

    throw new ApiClientError(status, message, code, details);
  }

  // Backend envelope validation
  if (parsedRecord && "success" in parsedRecord) {
    return json as APIResponse<T>;
  }

  // Fallback wrapping if response was not wrapped in APIResponse envelope
  return {
    success: true,
    message: null,
    data: json as T,
  };
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, "GET", undefined, options),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => request<T>(endpoint, "POST", body, options),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) => request<T>(endpoint, "PATCH", body, options),
  delete: <T>(endpoint: string, options?: RequestOptions) => request<T>(endpoint, "DELETE", undefined, options),
};
