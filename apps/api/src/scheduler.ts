import { parseClock, zonedDate, zonedParts } from '@furrow/shared';

import type { Services } from './services/container';

/**
 * Background loop for a single instance: keeps weather and readings current and
 * re-seeds the demo once a day. A production system would use a job queue.
 */
export function startScheduler(
  services: Services,
  options: { nightlyReset: boolean; resetAt: string; intervalMs?: number },
) {
  let lastResetDate: string | null = null;
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const farm = await services.getFarm();
      const now = services.clock();
      const today = zonedDate(now, farm.timezone);
      const { hour, minute } = zonedParts(now, farm.timezone);

      if (options.nightlyReset) {
        if (lastResetDate === null) {
          lastResetDate = today; // the boot-time seed counts for today
        } else if (today !== lastResetDate && hour * 60 + minute >= parseClock(options.resetAt)) {
          await services.resetDemo();
          lastResetDate = today;
        }
      }
      await services.ensureFresh(true);
    } catch (error) {
      services.logger.error('scheduler.tick_failed', { error: String(error) });
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, options.intervalMs ?? 60_000);
  void tick();
  return { stop: () => clearInterval(timer) };
}
