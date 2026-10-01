import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BackgroundWorkerManager } from "../src/core/BackgroundWorkerManager";
import { StatusBarMonitor } from "../src/ui/StatusBarMonitor";
import { TaskInspectorModal } from "../src/ui/modals/TaskInspectorModal";
import { ExecutionEngine } from "../src/core/ExecutionEngine";
import { CommandRegistry } from "../src/core/CommandRegistry";
import type { OCCCommand } from "../src/types/command";
import type { BackgroundTaskRecord } from "../src/types/worker";

describe("Milestone 6 - Background Worker Engine & Cancellation", () => {
  let mockApp: any;
  let mockPlugin: any;
  let registry: CommandRegistry;
  let workerManager: BackgroundWorkerManager;
  let engine: ExecutionEngine;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockApp = {
      workspace: {
        getActiveFile: () => null,
      },
    };
    mockPlugin = {
      addCommand: vi.fn((cmd) => cmd),
      manifest: { id: "obsidian-command-center" },
    };
    registry = new CommandRegistry(mockApp, mockPlugin);
    workerManager = new BackgroundWorkerManager();
    engine = new ExecutionEngine({
      app: mockApp,
      registry,
      workerManager,
    });
  });

  afterEach(async () => {
    await workerManager.cancelAll();
  });

  describe("TASK-22: Background Worker Execution Runner", () => {
    it("should spawn background task and transition to COMPLETED upon finish", async () => {
      let executed = false;

      const bgCmd: OCCCommand = {
        metadata: {
          id: "sync-bg-cmd",
          name: "Sync Data",
          isBackground: true,
        },
        execute: async () => {
          await new Promise((r) => setTimeout(r, 20));
          executed = true;
          return "synced";
        },
      };

      registry.register(bgCmd);

      // Execute returns the BackgroundTaskRecord immediately without waiting 20ms
      const record = (await engine.execute("sync-bg-cmd")) as BackgroundTaskRecord;

      expect(record).toBeDefined();
      expect(record.commandId).toBe("sync-bg-cmd");
      expect(record.commandName).toBe("Sync Data");
      expect(record.state).toBe("RUNNING");
      expect(workerManager.getActiveCount()).toBe(1);

      // Wait for task to finish
      await new Promise((r) => setTimeout(r, 40));

      expect(executed).toBe(true);
      expect(record.state).toBe("COMPLETED");
      expect(record.endTime).toBeGreaterThanOrEqual(record.startTime);
      expect(workerManager.getActiveCount()).toBe(0);
    });

    it("should update task state to FAILED if unhandled exception occurs", async () => {
      const failingCmd: OCCCommand = {
        metadata: {
          id: "fail-bg-cmd",
          name: "Failing Background Command",
          isBackground: true,
        },
        execute: async () => {
          await new Promise((r) => setTimeout(r, 10));
          throw new Error("Disk full");
        },
      };

      registry.register(failingCmd);

      const record = (await engine.execute("fail-bg-cmd")) as BackgroundTaskRecord;
      expect(record.state).toBe("RUNNING");

      // Give microtasks time to complete execution
      await new Promise((r) => setTimeout(r, 20));

      expect(record.state).toBe("FAILED");
      expect(record.error?.message).toBe("Disk full");
      expect(workerManager.getActiveCount()).toBe(0);
    });
  });

  describe("TASK-23: Status Bar Monitor & Task Inspector Modal", () => {
    it("should dynamically update status bar text and class as tasks run", async () => {
      const statusBarEl = document.createElement("div");
      const monitor = new StatusBarMonitor(statusBarEl, workerManager, mockApp);

      expect(statusBarEl.textContent).toBe("");
      expect(statusBarEl.classList.contains("occ-status-active")).toBe(false);

      const longCmd: OCCCommand = {
        metadata: {
          id: "long-bg-cmd",
          name: "Long Task",
          isBackground: true,
        },
        execute: async () => {
          await new Promise((r) => setTimeout(r, 40));
        },
      };
      registry.register(longCmd);

      await engine.execute("long-bg-cmd");

      // Active count should be 1
      expect(statusBarEl.textContent).toContain("1 task running");
      expect(statusBarEl.classList.contains("occ-status-active")).toBe(true);

      // Wait for task completion
      await new Promise((r) => setTimeout(r, 60));

      // After task completes, status bar returns to empty/inactive
      expect(statusBarEl.textContent).toBe("");
      expect(statusBarEl.classList.contains("occ-status-active")).toBe(false);

      monitor.destroy();
    });

    it("should render active tasks in TaskInspectorModal and allow cancellation", async () => {
      const longCmd: OCCCommand = {
        metadata: {
          id: "inspect-cmd",
          name: "Inspectable Task",
          isBackground: true,
        },
        execute: async (context) => {
          while (!context.abortSignal.aborted) {
            await context.yield();
          }
        },
      };
      registry.register(longCmd);

      const record = (await engine.execute("inspect-cmd")) as BackgroundTaskRecord;
      expect(record.state).toBe("RUNNING");

      const modal = new TaskInspectorModal(mockApp, workerManager);
      modal.open();

      const modalEl = modal.contentEl;
      expect(modalEl.querySelector("h2")?.textContent).toContain("Background Tasks");

      const rows = modalEl.querySelectorAll("tr.occ-task-row");
      expect(rows.length).toBe(1);

      const nameCell = modalEl.querySelector(".occ-task-name");
      expect(nameCell?.textContent).toBe("Inspectable Task");

      const cancelBtn = modalEl.querySelector(".occ-task-cancel-btn") as HTMLButtonElement;
      expect(cancelBtn).not.toBeNull();

      // Click cancel in modal
      cancelBtn.click();
      await new Promise((r) => setTimeout(r, 20));

      expect(record.state).toBe("CANCELLED");
      modal.close();
    });
  });

  describe("TASK-24: Cooperative Task Cancellation (AbortSignal)", () => {
    it("should trigger abort signal and call cleanup hook when cancelled", async () => {
      let abortedDetected = false;
      let cleanupCalled = false;

      const cancellableCmd: OCCCommand = {
        metadata: {
          id: "cancellable-cmd",
          name: "Cancellable Command",
          isBackground: true,
        },
        execute: async (context) => {
          return new Promise<void>((resolve, reject) => {
            context.abortSignal.addEventListener("abort", () => {
              abortedDetected = true;
              reject(new Error("Task aborted"));
            });
          });
        },
        cleanup: async () => {
          cleanupCalled = true;
        },
      };

      registry.register(cancellableCmd);

      const record = (await engine.execute("cancellable-cmd")) as BackgroundTaskRecord;
      expect(record.state).toBe("RUNNING");

      // Cancel the task
      const success = await workerManager.cancelTask(record.taskId);
      expect(success).toBe(true);

      await new Promise((r) => setTimeout(r, 20));

      expect(abortedDetected).toBe(true);
      expect(cleanupCalled).toBe(true);
      expect(record.state).toBe("CANCELLED");
    });
  });
});
