import type {
  ActivitiesResponse,
  ActivityDto,
  ActivityType,
  ApiErrorBody,
  CreateActivityInput,
  FarmResponse,
  ForecastResponse,
  PlotDetailDto,
  PlotsResponse,
  ReadingsRange,
  ReadingsResponse,
} from '@furrow/shared';

import { API_URL } from './config';
import { markApiReachable, markApiUnreachable } from './connectivity';

const TIMEOUT_MS = 12_000;

/** The server answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** The request never got an answer (no network, server down, timeout). */
export class NetworkError extends Error {}

/** Worth retrying later: network failures and server-side errors, not 4xx. */
export function isRetryable(error: unknown): boolean {
  return error instanceof NetworkError || (error instanceof ApiError && error.status >= 500);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { accept: 'application/json', 'content-type': 'application/json', ...init.headers },
    });
  } catch {
    markApiUnreachable();
    throw new NetworkError('Could not reach the Furrow server');
  } finally {
    clearTimeout(timeout);
  }
  markApiReachable();

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (${res.status})`,
      error?.details,
    );
  }
  return body as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined) as [
    string,
    string | number,
  ][];
  return entries.length
    ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
    : '';
}

export const api = {
  farm: () => request<FarmResponse>('/v1/farm'),
  plots: () => request<PlotsResponse>('/v1/plots'),
  plot: (id: string) => request<PlotDetailDto>(`/v1/plots/${id}`),
  readings: (id: string, range: ReadingsRange) =>
    request<ReadingsResponse>(`/v1/plots/${id}/readings${query({ range })}`),
  forecast: () => request<ForecastResponse>('/v1/forecast'),
  activities: (params: { plotId?: string; type?: ActivityType; cursor?: string; limit?: number }) =>
    request<ActivitiesResponse>(`/v1/activities${query(params)}`),
  createActivity: (input: CreateActivityInput) =>
    request<ActivityDto>('/v1/activities', { method: 'POST', body: JSON.stringify(input) }),
};
