/**
 * API Client - Standardized fetch utilities for API calls
 * Provides consistent error handling, request/response processing
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, unknown>): string {
  const url = new URL(endpoint, window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Base fetch function with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const config: RequestInit = {
    ...rest,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  };

  const response = await fetch(endpoint, config);

  // Handle non-JSON responses
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  if (!response.ok) {
    const errorData = isJson ? await response.json() : await response.text();
    const message = typeof errorData === "object" && errorData.error
      ? errorData.error
      : `API Error: ${response.status}`;
    throw new ApiError(message, response.status, errorData);
  }

  // Return empty object for 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return isJson ? response.json() : response.text();
}

/**
 * API client methods
 */
export const api = {
  /**
   * GET request
   */
  get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const url = buildUrl(endpoint, params);
    return apiFetch<T>(url, { method: "GET" });
  },

  /**
   * POST request
   */
  post<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, { method: "POST", body });
  },

  /**
   * PATCH request
   */
  patch<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, { method: "PATCH", body });
  },

  /**
   * PUT request
   */
  put<T>(endpoint: string, body?: unknown): Promise<T> {
    return apiFetch<T>(endpoint, { method: "PUT", body });
  },

  /**
   * DELETE request
   */
  delete<T>(endpoint: string): Promise<T> {
    return apiFetch<T>(endpoint, { method: "DELETE" });
  },
};

export default api;
