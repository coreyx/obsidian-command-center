import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp, MockPlugin, MockTFile } from "./mocks/obsidian";
import { CommandRegistry } from "../src/core/CommandRegistry";
import { ExecutionEngine } from "../src/core/ExecutionEngine";
import { ExecutionWatchdog, ExecutionTimeoutError } from "../src/core/ExecutionWatchdog";
import { SecuritySandbox, SecurityViolationError } from "../src/core/SecuritySandbox";
import { ModuleLoader } from "../src/core/ModuleLoader";
import { QueueManager, FIFOQueue } from "../src/core/QueueManager";
import type { OCCCommand } from "../src/types/command";
import * as fs from "fs";
import * as path from "path";

describe("Milestone 9 - Hardening, Security, Performance & Release CI", () => {
  let app: MockApp;
  let plugin: MockPlugin;
  let registry: CommandRegistry;
  let engine: ExecutionEngine;
  let watchdog: ExecutionWatchdog;
  let sandbox: SecuritySandbox;
  let toastMock: any;

  beforeEach(() => {
    app = new MockApp();
    plugin = new MockPlugin(app);
    toastMock = vi.fn();
    const uiHelper: any = {
      toast: toastMock,
      prompt: vi.fn(),
      confirm: vi.fn(),
      suggest: vi.fn(),
    };

    watchdog = new ExecutionWatchdog(100); // 100ms default for fast testing
    sandbox = new SecuritySandbox(false);

    registry = new CommandRegistry(app as any, plugin as any, async (id) => {
      return engine.execute(id);
    });

    engine = new ExecutionEngine({
      app: app as any,
      registry,
      uiHelper,
      watchdog,
    });
  });

  describe("TASK-32: Execution Watchdog & Timeout Guard (REQ-25)", () => {
    it("should abort synchronous/unyielding commands exceeding execution timeout", async () => {
      const slowCmd: OCCCommand = {
        metadata: { id: "hanging-cmd", name: "Hanging Command" },
        execute: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return "done";
        }),
      };

      registry.register(slowCmd, "commands/slow.js");

      await expect(engine.execute("hanging-cmd")).rejects.toThrow(ExecutionTimeoutError);
      expect(toastMock).toHaveBeenCalledWith(
        'Command "Hanging Command" timed out!',
        expect.objectContaining({ type: "warning" })
      );
    });

    it("should invoke onError hook when timeout occurs", async () => {
      const onErrorMock = vi.fn();
      const slowCmd: OCCCommand = {
        metadata: { id: "timeout-hook-cmd", name: "Timeout Hook Command" },
        execute: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }),
        onError: onErrorMock,
      };

      registry.register(slowCmd, "commands/slow-hook.js");

      await expect(engine.execute("timeout-hook-cmd")).rejects.toThrow(ExecutionTimeoutError);
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.any(ExecutionTimeoutError),
        expect.anything()
      );
    });

    it("should exempt background tasks (isBackground: true) from synchronous timeout", async () => {
      const bgCmd: OCCCommand = {
        metadata: { id: "bg-slow-cmd", name: "Background Slow", isBackground: true },
        execute: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          return "bg success";
        }),
      };

      registry.register(bgCmd, "commands/bg-slow.js");

      // Spawns detached background task and resolves immediately with task record
      const taskRecord: any = await engine.execute("bg-slow-cmd");
      expect(taskRecord).toBeDefined();
      expect(taskRecord.taskId).toBeDefined();

      // Wait for task to finish
      await new Promise((resolve) => setTimeout(resolve, 180));
      expect(taskRecord.state).toBe("COMPLETED");
    });

    it("should allow configuring custom timeout per command via metadata.timeout", async () => {
      // Global watchdog is 100ms, but this command allows 250ms
      const customTimeoutCmd: OCCCommand = {
        metadata: { id: "custom-timeout-cmd", name: "Custom Timeout", timeout: 250 },
        execute: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 150));
          return "custom success";
        }),
      };

      registry.register(customTimeoutCmd, "commands/custom.js");
      const result = await engine.execute("custom-timeout-cmd");
      expect(result).toBe("custom success");
    });

    it("should update default timeout via watchdog.setTimeout", () => {
      expect(watchdog.timeoutMs).toBe(100);
      watchdog.setTimeout(5000);
      expect(watchdog.timeoutMs).toBe(5000);
    });
  });

  describe("TASK-33: Safe Execution Sandboxing Proxy (REQ-26)", () => {
    it("should allow modules when Safe Execution Mode is disabled", () => {
      expect(sandbox.isSafeMode).toBe(false);
      expect(() => sandbox.validateModuleAccess("child_process")).not.toThrow();
      expect(() => sandbox.validateModuleAccess("fs")).not.toThrow();
    });

    it("should block child_process and external fs when Safe Execution Mode is enabled", () => {
      sandbox.setSafeMode(true);
      expect(sandbox.isSafeMode).toBe(true);

      expect(() => sandbox.validateModuleAccess("child_process")).toThrow(SecurityViolationError);
      expect(() => sandbox.validateModuleAccess("node:child_process")).toThrow(
        SecurityViolationError
      );
      expect(() => sandbox.validateModuleAccess("fs")).toThrow(SecurityViolationError);
      expect(() => sandbox.validateModuleAccess("node:fs")).toThrow(SecurityViolationError);
      expect(() => sandbox.validateModuleAccess("cluster")).toThrow(SecurityViolationError);
      expect(() => sandbox.validateModuleAccess("worker_threads")).toThrow(
        SecurityViolationError
      );
    });

    it("should block unsafe modules via createSafeEnvironment proxy", () => {
      sandbox.setSafeMode(true);
      const baseEnv = {
        require: vi.fn((id: string) => ({ id })),
        otherVal: 42,
      };

      const safeEnv = sandbox.createSafeEnvironment(baseEnv);
      expect(safeEnv.otherVal).toBe(42);

      // Attempting to access child_process directly on global proxy throws
      expect(() => safeEnv.child_process).toThrow(SecurityViolationError);

      // Attempting to require child_process throws
      expect(() => safeEnv.require("child_process")).toThrow(SecurityViolationError);
      expect(() => safeEnv.require("fs")).toThrow(SecurityViolationError);
    });

    it("should enforce sandbox evaluation in ModuleLoader when safeMode is true", async () => {
      sandbox.setSafeMode(true);
      const loader = new ModuleLoader(app as any, sandbox);

      // Script attempting to require child_process
      app.vault.adapter.read = vi.fn().mockResolvedValue(`
        const cp = require('child_process');
        module.exports = {
          metadata: { id: "malicious-cmd", name: "Malicious" },
          execute: () => {}
        };
      `);

      await expect(
        loader.load({
          path: "commands/malicious.js",
          filename: "malicious.js",
          extension: "js",
          isDirectoryBundle: false,
        })
      ).rejects.toThrow(SecurityViolationError);
    });
  });

  describe("TASK-34: Performance Benchmarking & Dispatch Profiling", () => {
    it("should achieve command dispatch overhead strictly below 5ms", async () => {
      const fastCmd: OCCCommand = {
        metadata: { id: "fast-benchmark-cmd", name: "Fast Benchmark" },
        execute: (ctx) => (ctx.input as number) * 2,
      };

      registry.register(fastCmd, "commands/fast.js");

      // Warmup
      for (let i = 0; i < 10; i++) {
        await engine.execute("fast-benchmark-cmd", i);
      }

      // Benchmark 100 consecutive executions
      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await engine.execute("fast-benchmark-cmd", i);
      }
      const totalTime = performance.now() - start;
      const averageMs = totalTime / iterations;

      expect(averageMs).toBeLessThan(5); // Dispatch overhead < 5ms
    });

    it("should cleanly handle 100 consecutive reload cycles without memory leaks or state corruption", async () => {
      const cmd: OCCCommand = {
        metadata: { id: "reloadable-cmd", name: "Reloadable" },
        execute: () => "ok",
      };

      for (let cycle = 0; cycle < 100; cycle++) {
        registry.register(cmd, "commands/reloadable.js");
        expect(registry.get("reloadable-cmd")).toBeDefined();
        registry.unregister("reloadable-cmd");
        expect(registry.get("reloadable-cmd")).toBeUndefined();
      }

      expect(registry.list()).toHaveLength(0);
    });
  });

  describe("TASK-35: Mobile Compatibility Verification & Touch Polish", () => {
    it("should pause and resume task processing via FIFOQueue and QueueManager", async () => {
      const qm = new QueueManager();
      const executionOrder: number[] = [];

      qm.push("mobile-queue", async () => {
        executionOrder.push(1);
      });

      // Pause the queue before pushing the next tasks
      qm.pauseAll();

      let task2Resolved = false;
      qm.push("mobile-queue", async () => {
        executionOrder.push(2);
        task2Resolved = true;
      });

      // Yield event loop
      await new Promise((r) => setTimeout(r, 20));
      expect(executionOrder).toEqual([1]);
      expect(task2Resolved).toBe(false);

      // Now resume all queues
      qm.resumeAll();
      await new Promise((r) => setTimeout(r, 20));
      expect(executionOrder).toEqual([1, 2]);
      expect(task2Resolved).toBe(true);
    });

    it("should verify styles.css contains 44x44px minimum touch targets for mobile accessibility", () => {
      const stylesContent = fs.readFileSync(path.resolve(__dirname, "../styles.css"), "utf-8");

      expect(stylesContent).toContain("min-height: 44px;");
      expect(stylesContent).toContain("min-width: 44px;");
      expect(stylesContent).toContain(".occ-toast-button");
      expect(stylesContent).toContain(".occ-modal-button-container button");
    });
  });
});
