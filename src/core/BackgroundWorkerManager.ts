import type { OCCCommand } from "../types/command";
import type { ExecutionContext } from "../types/context";
import type { BackgroundTaskRecord, BackgroundTaskState } from "../types/worker";

export class BackgroundWorkerManager {
  private tasks = new Map<string, BackgroundTaskRecord>();
  private listeners = new Set<(tasks: BackgroundTaskRecord[]) => void>();
  private cleanupCallbacks = new Map<string, () => Promise<void> | void>();

  /**
   * Spawns a background task running detached from the main execution caller.
   */
  spawn(
    command: OCCCommand,
    executor: (context: ExecutionContext) => Promise<unknown>,
    createContext: (abortSignal: AbortSignal) => ExecutionContext
  ): BackgroundTaskRecord {
    const taskId = `task_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const abortController = new AbortController();

    const record: BackgroundTaskRecord = {
      taskId,
      commandId: command.metadata.id,
      commandName: command.metadata.name,
      state: "RUNNING",
      startTime: Date.now(),
      abortController,
    };

    this.tasks.set(taskId, record);
    const context = createContext(abortController.signal);

    if (typeof command.cleanup === "function") {
      this.cleanupCallbacks.set(taskId, () => command.cleanup!(context));
    }

    // Detached background execution loop
    (async () => {
      this.notifyListeners();
      try {
        await executor(context);
        if (!abortController.signal.aborted) {
          record.state = "COMPLETED";
          record.endTime = Date.now();
        }
      } catch (err: any) {
        if (abortController.signal.aborted) {
          record.state = "CANCELLED";
          record.endTime = Date.now();
          await this.invokeCleanup(taskId);
        } else {
          record.state = "FAILED";
          record.error = err;
          record.endTime = Date.now();
        }
      } finally {
        this.notifyListeners();
      }
    })();

    return record;
  }

  /**
   * Cancels a running background task via cooperative AbortSignal.
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const record = this.tasks.get(taskId);
    if (!record || (record.state !== "RUNNING" && record.state !== "PENDING")) {
      return false;
    }

    record.abortController.abort();
    record.state = "CANCELLED";
    record.endTime = Date.now();

    await this.invokeCleanup(taskId);
    this.notifyListeners();
    return true;
  }

  private async invokeCleanup(taskId: string): Promise<void> {
    const cleanup = this.cleanupCallbacks.get(taskId);
    if (cleanup) {
      try {
        await cleanup();
      } catch (e) {
        console.error(`[OCC] Error during background task cleanup for "${taskId}":`, e);
      } finally {
        this.cleanupCallbacks.delete(taskId);
      }
    }
  }

  public listTasks(): BackgroundTaskRecord[] {
    return Array.from(this.tasks.values());
  }

  public getTask(taskId: string): BackgroundTaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  public getActiveCount(): number {
    let count = 0;
    for (const task of this.tasks.values()) {
      if (task.state === "RUNNING" || task.state === "PENDING") {
        count++;
      }
    }
    return count;
  }

  public onTasksChanged(callback: (tasks: BackgroundTaskRecord[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.listTasks());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    const taskList = this.listTasks();
    for (const listener of this.listeners) {
      try {
        listener(taskList);
      } catch (e) {
        console.error("[OCC] Error notifying task listener:", e);
      }
    }
  }

  public async cancelAll(): Promise<void> {
    const activeTasks = this.listTasks().filter(
      (t) => t.state === "RUNNING" || t.state === "PENDING"
    );
    for (const task of activeTasks) {
      await this.cancelTask(task.taskId);
    }
    this.tasks.clear();
    this.cleanupCallbacks.clear();
  }
}
