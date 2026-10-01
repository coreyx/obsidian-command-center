import { describe, it, expect, beforeEach, vi } from "vitest";
import { MacroOrchestrator } from "../src/core/MacroOrchestrator";
import type { MacroDefinition } from "../src/types/macro";

describe("MacroOrchestrator", () => {
  let orchestrator: MacroOrchestrator;
  let mockCommands: any;
  let context: any;

  beforeEach(() => {
    orchestrator = new MacroOrchestrator();
    mockCommands = {
      execute: vi.fn(),
      listCommands: vi.fn(),
    };
    context = {
      input: "initial",
      $prevOutput: "initial",
      commands: mockCommands,
      ui: { toast: vi.fn() },
    };
  });

  it("should validate valid macro definitions", () => {
    const raw = {
      id: "my-macro",
      name: "My Macro",
      steps: [{ commandId: "cmd-1" }, "cmd-2"],
    };

    const def = orchestrator.validateDefinition(raw, "commands/my-macro.json");
    expect(def.id).toBe("my-macro");
    expect(def.name).toBe("My Macro");
    expect(def.steps.length).toBe(2);
    expect(def.steps[0]?.commandId).toBe("cmd-1");
    expect(def.steps[1]?.commandId).toBe("cmd-2");
  });

  it("should execute steps sequentially and pipe output from step to step", async () => {
    const def: MacroDefinition = {
      id: "pipe-macro",
      name: "Pipe Macro",
      steps: [
        { commandId: "step-1" },
        { commandId: "step-2" },
      ],
    };

    mockCommands.execute
      .mockResolvedValueOnce("output-from-1")
      .mockResolvedValueOnce("output-from-2");

    const cmd = orchestrator.createCommand(def);
    const finalResult = await cmd.execute(context);

    expect(finalResult).toBe("output-from-2");
    expect(mockCommands.execute).toHaveBeenNthCalledWith(1, "step-1", undefined);
    expect(mockCommands.execute).toHaveBeenNthCalledWith(2, "step-2", undefined);
    expect(context.$prevOutput).toBe("output-from-2");
    expect(context.steps.length).toBe(2);
    expect(context.steps[0].output).toBe("output-from-1");
    expect(context.steps[1].output).toBe("output-from-2");
  });

  it("should halt execution when a step fails with halt policy", async () => {
    const def: MacroDefinition = {
      id: "halt-macro",
      name: "Halt Macro",
      steps: [
        { commandId: "step-1", onError: "halt" },
        { commandId: "step-2" },
      ],
    };

    mockCommands.execute.mockRejectedValueOnce(new Error("Step 1 failed"));

    const cmd = orchestrator.createCommand(def);
    await expect(cmd.execute(context)).rejects.toThrow('Macro "Halt Macro" step 0 ("step-1") failed: Step 1 failed');
    expect(mockCommands.execute).toHaveBeenCalledTimes(1);
  });

  it("should continue execution when a step fails with continue policy", async () => {
    const def: MacroDefinition = {
      id: "continue-macro",
      name: "Continue Macro",
      steps: [
        { commandId: "optional-step", onError: "continue" },
        { commandId: "critical-step" },
      ],
    };

    mockCommands.execute
      .mockRejectedValueOnce(new Error("Non-fatal failure"))
      .mockResolvedValueOnce("final-output");

    const cmd = orchestrator.createCommand(def);
    const result = await cmd.execute(context);

    expect(result).toBe("final-output");
    expect(mockCommands.execute).toHaveBeenCalledTimes(2);
    expect(context.steps[0].status).toBe("failed");
    expect(context.steps[1].status).toBe("success");
  });

  it("should execute fallback command when a step fails with fallback policy", async () => {
    const def: MacroDefinition = {
      id: "fallback-macro",
      name: "Fallback Macro",
      steps: [
        {
          commandId: "primary-cmd",
          onError: "fallback",
          fallbackCommandId: "backup-cmd",
        },
        { commandId: "next-cmd" },
      ],
    };

    mockCommands.execute
      .mockRejectedValueOnce(new Error("Primary failed"))
      .mockResolvedValueOnce("fallback-recovered-data")
      .mockResolvedValueOnce("completed");

    const cmd = orchestrator.createCommand(def);
    const result = await cmd.execute(context);

    expect(result).toBe("completed");
    expect(mockCommands.execute).toHaveBeenNthCalledWith(1, "primary-cmd", undefined);
    expect(mockCommands.execute).toHaveBeenNthCalledWith(2, "backup-cmd");
    expect(mockCommands.execute).toHaveBeenNthCalledWith(3, "next-cmd", undefined);
  });
});
