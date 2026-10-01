import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp, MockPlugin, MockTFile } from "./mocks/obsidian";
import { CommandRegistry } from "../src/core/CommandRegistry";
import { ExecutionEngine } from "../src/core/ExecutionEngine";
import type { OCCCommand } from "../src/types/command";

describe("ExecutionEngine", () => {
  let app: MockApp;
  let plugin: MockPlugin;
  let registry: CommandRegistry;
  let engine: ExecutionEngine;
  let toastMock: any;

  beforeEach(() => {
    app = new MockApp();
    plugin = new MockPlugin(app);
    toastMock = vi.fn();
    const uiHelper: any = {
      toast: toastMock,
      prompt: vi.fn(),
      confirm: vi.fn(),
    };

    registry = new CommandRegistry(app as any, plugin as any, async (id) => {
      return engine.execute(id);
    });

    engine = new ExecutionEngine({
      app: app as any,
      registry,
      uiHelper,
    });
  });

  it("should create execution context with active file and editor", () => {
    const file = new MockTFile("notes/daily.md");
    app.workspace.activeFile = file;
    app.workspace.activeEditor = { getCursor: vi.fn() };

    const ctx = engine.createContext({ custom: 123 });
    expect(ctx.app).toBe(app);
    expect(ctx.file?.path).toBe("notes/daily.md");
    expect(ctx.editor).toBeDefined();
    expect(ctx.input).toEqual({ custom: 123 });
    expect(ctx.$prevOutput).toEqual({ custom: 123 });
  });

  it("should execute a registered command and return its result", async () => {
    const cmd: OCCCommand = {
      metadata: { id: "sum-cmd", name: "Sum Command" },
      execute: vi.fn().mockImplementation((ctx) => {
        return (ctx.input as number) + 10;
      }),
    };

    registry.register(cmd, "commands/sum.js");
    const result = await engine.execute("sum-cmd", 5);

    expect(result).toBe(15);
    expect(cmd.execute).toHaveBeenCalled();
  });

  it("should respect canExecute returning false and not run execute", async () => {
    const cmd: OCCCommand = {
      metadata: { id: "guarded-cmd", name: "Guarded" },
      canExecute: vi.fn().mockResolvedValue(false),
      execute: vi.fn().mockResolvedValue("ran"),
    };

    registry.register(cmd, "commands/guarded.js");
    const result = await engine.execute("guarded-cmd");

    expect(result).toBeNull();
    expect(cmd.execute).not.toHaveBeenCalled();
  });

  it("should display a warning toast if canExecute returns a string", async () => {
    const cmd: OCCCommand = {
      metadata: { id: "reason-cmd", name: "Reason" },
      canExecute: vi.fn().mockResolvedValue("Must have an active file open"),
      execute: vi.fn(),
    };

    registry.register(cmd, "commands/reason.js");
    const result = await engine.execute("reason-cmd");

    expect(result).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      "Must have an active file open",
      expect.objectContaining({ type: "warning" })
    );
    expect(cmd.execute).not.toHaveBeenCalled();
  });

  it("should catch errors, invoke onError hook, and display error toast", async () => {
    const onErrorMock = vi.fn();
    const cmd: OCCCommand = {
      metadata: { id: "failing-cmd", name: "Failing Command" },
      execute: vi.fn().mockRejectedValue(new Error("Disk exploded")),
      onError: onErrorMock,
    };

    registry.register(cmd, "commands/failing.js");

    await expect(engine.execute("failing-cmd")).rejects.toThrow("Disk exploded");
    expect(onErrorMock).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ app })
    );
    expect(toastMock).toHaveBeenCalledWith(
      'Command "Failing Command" failed: Disk exploded',
      expect.objectContaining({ type: "error" })
    );
  });
});
