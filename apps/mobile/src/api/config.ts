import Constants from 'expo-constants';

const API_PORT = 8787;

/** Host of the Metro bundler, e.g. "192.168.1.20" — the dev machine as seen from the device. */
function devMachineHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  return hostUri ? (hostUri.split(':')[0] ?? null) : null;
}

/**
 * EXPO_PUBLIC_API_URL wins (deployed API). In development the API is assumed
 * to run on the same machine as Metro, which also works from a physical phone
 * on the same Wi-Fi.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? `http://${devMachineHost() ?? 'localhost'}:${API_PORT}`;
