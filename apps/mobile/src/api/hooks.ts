import type { ActivityDto, ActivityType, CreateActivityInput, ReadingsRange } from '@furrow/shared';
import {
  keepPreviousData,
  onlineManager,
  useInfiniteQuery,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { api } from './client';
import { CREATE_ACTIVITY_KEY } from './query-client';

const MINUTE = 60_000;

export const queryKeys = {
  farm: ['farm'] as const,
  plots: ['plots'] as const,
  plot: (id: string) => ['plot', id] as const,
  readings: (id: string, range: ReadingsRange) => ['readings', id, range] as const,
  forecast: ['forecast'] as const,
  activities: (filter: { plotId?: string; type?: ActivityType }) =>
    ['activities', 'list', filter] as const,
};

export function useFarm() {
  return useQuery({ queryKey: queryKeys.farm, queryFn: api.farm, refetchInterval: MINUTE });
}

export function usePlots() {
  return useQuery({ queryKey: queryKeys.plots, queryFn: api.plots, refetchInterval: MINUTE });
}

export function usePlot(id: string) {
  return useQuery({
    queryKey: queryKeys.plot(id),
    queryFn: () => api.plot(id),
    refetchInterval: MINUTE,
  });
}

export function useReadings(id: string, range: ReadingsRange) {
  return useQuery({
    queryKey: queryKeys.readings(id, range),
    queryFn: () => api.readings(id, range),
    placeholderData: keepPreviousData,
    refetchInterval: 5 * MINUTE,
  });
}

export function useForecast() {
  return useQuery({ queryKey: queryKeys.forecast, queryFn: api.forecast, staleTime: 30 * MINUTE });
}

export function useActivities(filter: { plotId?: string; type?: ActivityType } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.activities(filter),
    queryFn: ({ pageParam }) => api.activities({ ...filter, cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

/** Queues an activity; works offline (see setMutationDefaults in query-client). */
export function useCreateActivity() {
  return useMutation<ActivityDto, Error, CreateActivityInput>({ mutationKey: CREATE_ACTIVITY_KEY });
}

export interface PendingActivity {
  input: CreateActivityInput;
  failed: boolean;
  error: string | null;
  submittedAt: number;
}

/** Activities the server hasn't confirmed yet — the source of truth for "Pending sync". */
export function usePendingActivities(): PendingActivity[] {
  return useMutationState({
    filters: {
      mutationKey: CREATE_ACTIVITY_KEY,
      predicate: (m) => m.state.status === 'pending' || m.state.status === 'error',
    },
    select: (m) => ({
      input: m.state.variables as CreateActivityInput,
      failed: m.state.status === 'error',
      error: m.state.error instanceof Error ? m.state.error.message : null,
      submittedAt: m.state.submittedAt,
    }),
  });
}

/** Drops activities the server rejected (e.g. validation), so they stop showing as failed. */
export function useDismissFailedActivities() {
  const client = useQueryClient();
  return () => {
    const cache = client.getMutationCache();
    for (const mutation of cache.findAll({ mutationKey: CREATE_ACTIVITY_KEY, status: 'error' })) {
      cache.remove(mutation);
    }
  };
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
