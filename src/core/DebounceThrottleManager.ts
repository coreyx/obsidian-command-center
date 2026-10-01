export class DebounceCancelledError extends Error {
  constructor(message = "Debounced execution cancelled") {
    super(message);
    this.name = "DebounceCancelledError";
  }
}

interface DebounceEntry {
  timer: any;
  listeners: Array<{
    resolve: (val: any) => void;
    reject: (err: any) => void;
  }>;
}

export class DebounceThrottleManager {
  private debounceMap = new Map<string, DebounceEntry>();
  private throttleMap = new Map<string, number>(); // id -> lastRunTimestamp

  /**
   * Debounces execution of a function until delayMs quiet period has elapsed.
   */
  debounce<T>(id: string, fn: () => Promise<T> | T, delayMs: number): Promise<T> {
    const existing = this.debounceMap.get(id);
    if (existing) {
      clearTimeout(existing.timer);
    }

    return new Promise<T>((resolve, reject) => {
      const listeners = existing ? existing.listeners : [];
      listeners.push({ resolve, reject });

      const timer = setTimeout(async () => {
        this.debounceMap.delete(id);
        try {
          const result = await fn();
          for (const l of listeners) {
            l.resolve(result);
          }
        } catch (err) {
          for (const l of listeners) {
            l.reject(err);
          }
        }
      }, delayMs);

      this.debounceMap.set(id, { timer, listeners });
    });
  }

  /**
   * Cancels a pending debounced invocation.
   * Returns true if a pending debounce was found and cancelled, false otherwise.
   */
  cancelDebounce(id: string): boolean {
    const entry = this.debounceMap.get(id);
    if (!entry) {
      return false;
    }

    clearTimeout(entry.timer);
    this.debounceMap.delete(id);

    const cancelErr = new DebounceCancelledError(`Debounced execution for "${id}" was cancelled`);
    for (const l of entry.listeners) {
      l.reject(cancelErr);
    }
    return true;
  }

  /**
   * Throttles execution of a function to at most once per intervalMs.
   */
  async throttle<T>(
    id: string,
    fn: () => Promise<T> | T,
    intervalMs: number
  ): Promise<T | undefined> {
    const now = Date.now();
    const lastRun = this.throttleMap.get(id) ?? 0;

    if (now - lastRun >= intervalMs) {
      this.throttleMap.set(id, now);
      return await fn();
    }

    return undefined;
  }

  /**
   * Resets all pending debounce timers and throttle timestamps.
   */
  clearAll(): void {
    for (const entry of this.debounceMap.values()) {
      clearTimeout(entry.timer);
      const cancelErr = new DebounceCancelledError("Debounce manager cleared all pending timers");
      for (const l of entry.listeners) {
        l.reject(cancelErr);
      }
    }
    this.debounceMap.clear();
    this.throttleMap.clear();
  }
}
