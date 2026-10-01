import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExecutionEngine } from "../src/core/ExecutionEngine";
import { CommandRegistry } from "../src/core/CommandRegistry";
import { QueueManager, QueueHaltedError } from "../src/core/QueueManager";
import { DebounceThrottleManager, DebounceCancelledError } from "../src/core/DebounceThrottleManager";
import type { OCCCommand } from "../src/types/command";

describe("Milestone 5 - Asynchronous Execution, Queuing & Scheduling", () => {
  let mockApp: any;
  let registry: CommandRegistry;
  let queueManager: QueueManager;
  let debounceManager: DebounceThrottleManager;
  let engine: ExecutionEngine;

  beforeEach(() => {
    mockApp = {
      workspace: {
        getActiveFile: () => null,
      },
    };
    const mockPlugin: any = {
      addCommand: vi.fn((cmd) => cmd),
    };
    registry = new CommandRegistry(mockApp, mockPlugin);
    queueManager = new QueueManager();
    debounceManager = new DebounceThrottleManager();
    engine = new ExecutionEngine({
      app: mockApp,
      registry,
      queueManager,
      debounceThrottleManager: debounceManager,
    });
  });

  describe("TASK-19: Non-blocking Asynchronous Runner & Cooperative Yielding", () => {
    it("should allow interleaved microtasks during context.yield()", async () => {
      let counter = 0;
      let interleavedRan = false;

      const asyncCmd: OCCCommand = {
        metadata: { id: "async-yield-cmd", name: "Async Yield Command" },
        execute: async (context) => {
          counter++;
          await context.yield();
          counter++;
          return counter;
        },
      };

      registry.register(asyncCmd);

      // Start the command execution
      const executionPromise = engine.execute("async-yield-cmd");

      // Schedule a task to run while the command cooperatively yields
      queueMicrotask(() => {
        interleavedRan = true;
      });

      const result = await executionPromise;
      expect(result).toBe(2);
      expect(interleavedRan).toBe(true);
    });

    it("should handle async commands returning complex objects", async () => {
      const asyncDataCmd: OCCCommand = {
        metadata: { id: "async-data-cmd", name: "Async Data Command" },
        execute: async (context) => {
          await context.yield();
          return { status: "complete", items: [1, 2, 3] };
        },
      };

      registry.register(asyncDataCmd);
      const result = await engine.execute("async-data-cmd");
      expect(result).toEqual({ status: "complete", items: [1, 2, 3] });
    });
  });

  describe("TASK-20: Named Serial FIFO Queue Manager", () => {
    it("should execute queued tasks in strict serial order", async () => {
      const executionOrder: number[] = [];

      const p1 = queueManager.push("sync-queue", async () => {
        await new Promise((r) => setTimeout(r, 30));
        executionOrder.push(1);
        return "result-1";
      });

      const p2 = queueManager.push("sync-queue", async () => {
        await new Promise((r) => setTimeout(r, 10));
        executionOrder.push(2);
        return "result-2";
      });

      const p3 = queueManager.push("sync-queue", async () => {
        executionOrder.push(3);
        return "result-3";
      });

      const results = await Promise.all([p1, p2, p3]);

      expect(results).toEqual(["result-1", "result-2", "result-3"]);
      // Even though task 1 took 30ms and task 2 took 10ms, task 1 must finish before task 2 starts
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should continue processing subsequent queue tasks if a task fails when haltOnError is false", async () => {
      const p1 = queueManager.push(
        "resilient-queue",
        async () => {
          throw new Error("Task 1 failed");
        },
        { haltOnError: false }
      );

      const p2 = queueManager.push(
        "resilient-queue",
        async () => {
          return "Task 2 success";
        },
        { haltOnError: false }
      );

      await expect(p1).rejects.toThrow("Task 1 failed");
      const res2 = await p2;
      expect(res2).toBe("Task 2 success");
    });

    it("should halt queue and reject subsequent tasks with QueueHaltedError when haltOnError is true", async () => {
      const p1 = queueManager.push(
        "strict-queue",
        async () => {
          throw new Error("Task 1 critical failure");
        },
        { haltOnError: true }
      );

      const p2 = queueManager.push(
        "strict-queue",
        async () => "Task 2",
        { haltOnError: true }
      );

      const p3 = queueManager.push(
        "strict-queue",
        async () => "Task 3",
        { haltOnError: true }
      );

      await expect(p1).rejects.toThrow("Task 1 critical failure");
      await expect(p2).rejects.toBeInstanceOf(QueueHaltedError);
      await expect(p3).rejects.toBeInstanceOf(QueueHaltedError);

      const queue = queueManager.getQueue("strict-queue");
      expect(queue.isHalted).toBe(true);

      // Pushing to an already halted queue should also immediately reject
      await expect(queue.push(async () => "Task 4")).rejects.toBeInstanceOf(QueueHaltedError);

      // Resuming allows new tasks to run
      queue.resume();
      expect(queue.isHalted).toBe(false);
      const res5 = await queue.push(async () => "Task 5");
      expect(res5).toBe("Task 5");
    });

    it("should route commands declaring metadata.queueName through the serial queue automatically", async () => {
      const trace: string[] = [];

      const cmdA: OCCCommand = {
        metadata: {
          id: "cmd-a",
          name: "Command A",
          queueName: "vault-writer",
        },
        execute: async () => {
          await new Promise((r) => setTimeout(r, 20));
          trace.push("A");
          return "done-A";
        },
      };

      const cmdB: OCCCommand = {
        metadata: {
          id: "cmd-b",
          name: "Command B",
          queueName: "vault-writer",
        },
        execute: async () => {
          trace.push("B");
          return "done-B";
        },
      };

      registry.register(cmdA);
      registry.register(cmdB);

      // Launch concurrently
      const [resA, resB] = await Promise.all([
        engine.execute("cmd-a"),
        engine.execute("cmd-b"),
      ]);

      expect(resA).toBe("done-A");
      expect(resB).toBe("done-B");
      expect(trace).toEqual(["A", "B"]);
    });

    it("should allow pushing tasks from within context.queue.push", async () => {
      const cmd: OCCCommand = {
        metadata: { id: "enqueue-cmd", name: "Enqueue Command" },
        execute: async (context) => {
          const result = await context.queue.push("sub-queue", async () => "from-sub-queue");
          return result;
        },
      };

      registry.register(cmd);
      const res = await engine.execute("enqueue-cmd");
      expect(res).toBe("from-sub-queue");
    });
  });

  describe("TASK-21: Debounce and Throttle Scheduler", () => {
    it("should debounce rapid invocations and only execute once after quiet period", async () => {
      let executionCount = 0;

      const debouncedCmd: OCCCommand = {
        metadata: {
          id: "debounced-cmd",
          name: "Debounced Command",
          debounce: 40,
        },
        execute: async () => {
          executionCount++;
          return executionCount;
        },
      };

      registry.register(debouncedCmd);

      // Trigger 3 times rapidly
      const p1 = engine.execute("debounced-cmd");
      const p2 = engine.execute("debounced-cmd");
      const p3 = engine.execute("debounced-cmd");

      // Wait for debounce period (40ms) to elapse
      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(executionCount).toBe(1);
      expect(r1).toBe(1);
      expect(r2).toBe(1);
      expect(r3).toBe(1);
    });

    it("should cancel pending debounce via cancelDebounce()", async () => {
      let executionCount = 0;

      const debouncedCmd: OCCCommand = {
        metadata: {
          id: "cancellable-debounced-cmd",
          name: "Cancellable Debounced Command",
          debounce: 50,
        },
        execute: async () => {
          executionCount++;
          return executionCount;
        },
      };

      registry.register(debouncedCmd);

      const p1 = engine.execute("cancellable-debounced-cmd");

      // Cancel the debounce before 50ms expires
      const cancelled = debounceManager.cancelDebounce("cancellable-debounced-cmd");
      expect(cancelled).toBe(true);

      await expect(p1).rejects.toBeInstanceOf(DebounceCancelledError);
      expect(executionCount).toBe(0);

      // Subsequent cancel returns false since none is pending
      expect(debounceManager.cancelDebounce("cancellable-debounced-cmd")).toBe(false);
    });

    it("should support context.cancelDebounce() from within ExecutionContext", async () => {
      const context = engine.createContext(undefined, undefined, "my-cmd");
      // Schedule a timer in manager
      const promise = debounceManager.debounce("my-cmd", () => "test", 100);
      promise.catch(() => {});

      expect(context.cancelDebounce()).toBe(true);
      expect(context.cancelDebounce()).toBe(false);
      await expect(promise).rejects.toBeInstanceOf(DebounceCancelledError);
    });

    it("should throttle invocations to at most once per interval", async () => {
      let callCount = 0;

      const throttledCmd: OCCCommand = {
        metadata: {
          id: "throttled-cmd",
          name: "Throttled Command",
          throttle: 60,
        },
        execute: async () => {
          callCount++;
          return callCount;
        },
      };

      registry.register(throttledCmd);

      // First call executes immediately
      const r1 = await engine.execute("throttled-cmd");
      expect(r1).toBe(1);
      expect(callCount).toBe(1);

      // Immediate second call should be throttled (returns undefined)
      const r2 = await engine.execute("throttled-cmd");
      expect(r2).toBeUndefined();
      expect(callCount).toBe(1);

      // Wait for throttle window (60ms) to pass
      await new Promise((r) => setTimeout(r, 70));

      // Third call executes after interval
      const r3 = await engine.execute("throttled-cmd");
      expect(r3).toBe(2);
      expect(callCount).toBe(2);
    });
  });
});
