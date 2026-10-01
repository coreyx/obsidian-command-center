import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp } from "./mocks/obsidian";
import { OCCCommandBridgeImpl } from "../src/core/CommandBridge";
import { CommandNotFoundError } from "../src/types/macro";

describe("OCCCommandBridgeImpl", () => {
  let app: MockApp;
  let bridge: OCCCommandBridgeImpl;

  beforeEach(() => {
    app = new MockApp();
    bridge = new OCCCommandBridgeImpl(app as any);
  });

  it("should execute an existing Obsidian command and return its result", async () => {
    app.commands.commands["editor:toggle-fold"] = {
      id: "editor:toggle-fold",
      name: "Editor: Toggle fold",
      callback: vi.fn().mockReturnValue("folded"),
    };

    const result = await bridge.execute("editor:toggle-fold");
    expect(result).toBe("folded");
    expect(app.commands.commands["editor:toggle-fold"].callback).toHaveBeenCalled();
  });

  it("should throw CommandNotFoundError when command does not exist", async () => {
    await expect(bridge.execute("non-existent-cmd")).rejects.toThrow(CommandNotFoundError);
    await expect(bridge.execute("non-existent-cmd")).rejects.toThrow(
      'Command not found: "non-existent-cmd"'
    );
  });

  it("should list available commands in Obsidian", () => {
    app.commands.commands["cmd-1"] = { id: "cmd-1", name: "Command 1" };
    app.commands.commands["cmd-2"] = { id: "cmd-2", name: "Command 2" };

    const list = bridge.listCommands();
    expect(list).toEqual([
      { id: "cmd-1", name: "Command 1" },
      { id: "cmd-2", name: "Command 2" },
    ]);
  });
});
