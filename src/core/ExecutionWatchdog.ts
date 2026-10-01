export class ExecutionTimeoutError extends Error {
  constructor(commandName: string, timeoutMs: number) {
    super(`Command "${commandName}" exceeded maximum execution timeout of ${timeoutMs}ms`);
    this.name = "ExecutionTimeoutError";
  }
}

export class ExecutionWatchdog {
  constructor(private defaultTimeoutMs: number = 15000) {}

  public get timeoutMs(): number {
    return this.defaultTimeoutMs;
  }

  public setTimeout(ms: number): void {
    this.defaultTimeoutMs = ms;
  }

  /**
   * Races an asynchronous execution against a timeout timer.
   * Background tasks (isBackground: true) or commands with timeout = 0 are exempt.
   */
  async race<T>(
    commandName: string,
    taskPromise: Promise<T>,
    timeoutMs?: number,
    onTimeout?: () => void
  ): Promise<T> {
    const effectiveTimeout = timeoutMs !== undefined ? timeoutMs : this.defaultTimeoutMs;

    if (effectiveTimeout <= 0) {
      return taskPromise;
    }

    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        if (onTimeout) {
          try {
            onTimeout();
          } catch (e) {
            console.error("[OCC Watchdog] Error calling onTimeout handler:", e);
          }
        }
        reject(new ExecutionTimeoutError(commandName, effectiveTimeout));
      }, effectiveTimeout);
    });

    try {
      return await Promise.race([taskPromise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }
}
