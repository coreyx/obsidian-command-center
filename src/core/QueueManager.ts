import type { QueueOptions } from "../types/context";

export class QueueHaltedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueHaltedError";
  }
}

interface QueuedItem<T = any> {
  task: () => Promise<T> | T;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export class FIFOQueue {
  private items: QueuedItem[] = [];
  private processing = false;
  private halted = false;
  private paused = false;

  constructor(public readonly name: string, public options: QueueOptions = {}) {}

  get size(): number {
    return this.items.length;
  }

  get isProcessing(): boolean {
    return this.processing;
  }

  get isHalted(): boolean {
    return this.halted;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  public push<T>(task: () => Promise<T> | T): Promise<T> {
    if (this.halted) {
      return Promise.reject(new QueueHaltedError(`Queue "${this.name}" is halted`));
    }

    return new Promise<T>((resolve, reject) => {
      this.items.push({ task, resolve, reject });
      if (!this.processing && !this.paused) {
        this.processNext();
      }
    });
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    if (this.items.length === 0) return;
    if (this.halted || this.paused) return;

    this.processing = true;
    const item = this.items.shift()!;

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      if (this.options.haltOnError) {
        this.halted = true;
        item.reject(error);
        // Reject all remaining pending items with QueueHaltedError
        while (this.items.length > 0) {
          const pending = this.items.shift()!;
          pending.reject(
            new QueueHaltedError(
              `Queue "${this.name}" halted due to error in preceding task: ${(error as any)?.message}`
            )
          );
        }
        this.processing = false;
        return;
      } else {
        item.reject(error);
      }
    } finally {
      this.processing = false;
      if (!this.halted && !this.paused && this.items.length > 0) {
        this.processNext();
      }
    }
  }

  public clear(): void {
    while (this.items.length > 0) {
      const pending = this.items.shift()!;
      pending.reject(new Error(`Queue "${this.name}" was cleared`));
    }
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    this.halted = false;
    if (this.items.length > 0 && !this.processing) {
      this.processNext();
    }
  }
}

export class QueueManager {
  private queues: Map<string, FIFOQueue> = new Map();

  getQueue(name: string, options?: QueueOptions): FIFOQueue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new FIFOQueue(name, options);
      this.queues.set(name, queue);
    } else if (options?.haltOnError !== undefined) {
      queue.options.haltOnError = options.haltOnError;
    }
    return queue;
  }

  push<T>(name: string, task: () => Promise<T> | T, options?: QueueOptions): Promise<T> {
    const queue = this.getQueue(name, options);
    return queue.push(task);
  }

  pauseAll(): void {
    for (const queue of this.queues.values()) {
      queue.pause();
    }
  }

  resumeAll(): void {
    for (const queue of this.queues.values()) {
      queue.resume();
    }
  }

  clearAll(): void {
    for (const queue of this.queues.values()) {
      queue.clear();
    }
    this.queues.clear();
  }
}
