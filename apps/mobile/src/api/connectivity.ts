/**
 * "Online" for this app means the device has a network AND our API answers.
 * NetInfo covers the first; failed requests plus a /health probe cover the
 * second (a field with Wi-Fi but no route to the server is offline too).
 * TanStack Query pauses queries and mutations while offline and resumes them
 * when this flips back.
 */

import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

import { API_URL } from './config';

const PROBE_INTERVAL_MS = 4000;
const PROBE_TIMEOUT_MS = 3000;

let deviceOnline = true;
let apiReachable = true;
let probeTimer: ReturnType<typeof setInterval> | null = null;

function publish() {
  onlineManager.setOnline(deviceOnline && apiReachable);
}

async function probe() {
  if (!deviceOnline) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}/health`, { signal: controller.signal });
    if (res.ok) markApiReachable();
  } catch {
    // still unreachable
  } finally {
    clearTimeout(timeout);
  }
}

export function markApiUnreachable() {
  if (!apiReachable) return;
  apiReachable = false;
  publish();
  probeTimer ??= setInterval(probe, PROBE_INTERVAL_MS);
}

export function markApiReachable() {
  if (probeTimer) {
    clearInterval(probeTimer);
    probeTimer = null;
  }
  if (apiReachable) return;
  apiReachable = true;
  publish();
}

onlineManager.setEventListener(() =>
  NetInfo.addEventListener((state) => {
    deviceOnline = state.isConnected !== false;
    publish();
    if (deviceOnline && !apiReachable) void probe();
  }),
);
