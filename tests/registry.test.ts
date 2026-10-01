import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp, MockPlugin } from "./mocks/obsidian";
import { CommandRegistry } from "../src/core/CommandRegistry";
import type { OCCCommand } from "../src/types/command";

describe("CommandRegistry", () => {
  let app: MockApp;
  let plugin: MockPlugin;
  let registry: CommandRegistry;
  let executeMock: any;

  beforeEach(() => {
    app = new MockApp();
    plugin = new MockPlugin(app);
    executeMock = vi.fn().mockResolvedValue("done");
    registry = new CommandRegistry(app as any, plugin as any, executeMock);
  });

  const dummyCommand: OCCCommand = {
    metadata: {
      id: "my-cmd",
      name: "My Command",
    },
    execute: vi.fn(),
  };

  it("should register command in OCC and bind to Obsidian", () => {
    registry.register(dummyCommand, "commands/my-cmd.js");

    expect(registry.has("my-cmd")).toBe(true);
    expect(registry.get("my-cmd")).toBe(dummyCommand);
    expect(app.commands.commands["obsidian-command-center:my-cmd"]).toBeDefined();
  });

  it("should trigger execution callback when Obsidian command is executed", async () => {
    registry.register(dummyCommand, "commands/my-cmd.js");

    await app.commands.executeCommandById("obsidian-command-center:my-cmd");
    expect(executeMock).toHaveBeenCalledWith("my-cmd");
  });

  it("should unregister command from OCC and Obsidian", () => {
    registry.register(dummyCommand, "commands/my-cmd.js");
    expect(registry.has("my-cmd")).toBe(true);

    const unregistered = registry.unregister("my-cmd");
    expect(unregistered).toBe(true);
    expect(registry.has("my-cmd")).toBe(false);
    expect(app.commands.commands["obsidian-command-center:my-cmd"]).toBeUndefined();
  });

  it("should list registered commands and records", () => {
    registry.register(dummyCommand, "commands/my-cmd.js");
    expect(registry.list()).toEqual([dummyCommand]);
    const records = registry.listRecords();
    expect(records.length).toBe(1);
    expect(records[0]?.filePath).toBe("commands/my-cmd.js");
  });
});
