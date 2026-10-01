export interface ExecutionLogRecord {
  id: string;
  timestamp: number;
  commandId: string;
  commandName: string;
  durationMs: number;
  status: "success" | "error";
  error?: string;
  errorStack?: string;
}

export class ExecutionLogger {
  private logs: ExecutionLogRecord[] = [];
  private readonly maxEntries = 100;
  private listeners = new Set<() => void>();

  public log(entry: Omit<ExecutionLogRecord, "id">): ExecutionLogRecord {
    const record: ExecutionLogRecord = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };

    this.logs.unshift(record);
    if (this.logs.length > this.maxEntries) {
      this.logs.length = this.maxEntries;
    }

    this.notifyListeners();
    return record;
  }

  public getLogs(): ExecutionLogRecord[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
    this.notifyListeners();
  }

  public exportJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public onLog(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (e) {
        console.error("[OCC] Error notifying log listener:", e);
      }
    }
  }
}
