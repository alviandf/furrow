import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';
import type { CreateActivityInput } from '@furrow/shared';

import { api, isRetryable } from './client';
import './connectivity';

const DAY_MS = 24 * 60 * 60 * 1000;

export const CREATE_ACTIVITY_KEY = ['activities', 'create'] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: DAY_MS,
      retry: (count, error) => isRetryable(error) && count < 2,
    },
  },
});

/**
 * The offline outbox. Defaults are registered up front so mutations restored
 * from storage after an app restart still know how to run. Offline, they
 * pause and are persisted; online again, they resume in order.
 */
queryClient.setMutationDefaults(CREATE_ACTIVITY_KEY, {
  mutationFn: (input: CreateActivityInput) => api.createActivity(input),
  retry: (count, error) => isRetryable(error) && count < 8,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
  onSettled: () =>
    Promise.all(
      [['farm'], ['plots'], ['plot'], ['readings'], ['activities', 'list']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    ),
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'furrow-query-cache',
  throttleTime: 1000,
});

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: DAY_MS,
  buster: 'v1',
};

/** After the cache is restored: replay queued writes, then refresh. */
export async function onCacheRestored() {
  await queryClient.resumePausedMutations();
  await queryClient.invalidateQueries();
}
