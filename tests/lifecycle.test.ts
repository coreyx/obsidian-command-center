import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp, MockPlugin } from "./mocks/obsidian";
import { CommandRegistry } from "../src/core/CommandRegistry";
import { ModuleLoader } from "../src/core/ModuleLoader";
import { LifecycleManager } from "../src/core/LifecycleManager";
import type { OCCCommand, CommandFileDescriptor } from "../src/types/command";

describe("LifecycleManager", () => {
  let app: MockApp;
  let plugin: MockPlugin;
  let registry: CommandRegistry;
  let loader: ModuleLoader;
  let lifecycle: LifecycleManager;
  let dummyContext: any;

  beforeEach(() => {
    app = new MockApp();
    plugin = new MockPlugin(app);
    registry = new CommandRegistry(app as any, plugin as any, vi.fn());
    (app.vault.adapter as any).getBasePath = () => null;
    loader = new ModuleLoader(app as any);
    lifecycle = new LifecycleManager(app as any, registry, loader);
    dummyContext = { app };
  });

  it("should invoke init(context) when registering a command", async () => {
    const initMock = vi.fn();
    const command: OCCCommand = {
      metadata: { id: "init-test", name: "Init Test" },
      init: initMock,
      execute: vi.fn(),
    };
    vi.spyOn(loader, "load").mockResolvedValue(command);

    const desc: CommandFileDescriptor = {
      path: "commands/init.js",
      filename: "init.js",
      extension: "js",
      isDirectoryBundle: false,
    };

    await lifecycle.loadAndRegister(desc, dummyContext);

    expect(initMock).toHaveBeenCalledWith(dummyContext);
    expect(lifecycle.getState("init-test")).toBe("READY");
    expect(registry.has("init-test")).toBe(true);
  });

  it("should preserve user-assigned hotkeys on reload", async () => {
    const cmd1: OCCCommand = {
      metadata: { id: "hotkey-cmd", name: "Hotkey Command v1" },
      execute: vi.fn(),
    };
    const cmd2: OCCCommand = {
      metadata: { id: "hotkey-cmd", name: "Hotkey Command v2" },
      execute: vi.fn(),
    };

    vi.spyOn(loader, "load").mockResolvedValueOnce(cmd1).mockResolvedValueOnce(cmd2);

    const desc: CommandFileDescriptor = {
      path: "commands/hotkey.js",
      filename: "hotkey.js",
      extension: "js",
      isDirectoryBundle: false,
    };

    // First registration
    await lifecycle.loadAndRegister(desc, dummyContext);
    const obsId = "obsidian-command-center:hotkey-cmd";

    // Simulate user setting a hotkey in Obsidian
    app.hotkeyManager.customKeys[obsId] = [{ modifiers: ["Mod"], key: "H" }];

    // Hot-reload the command
    await lifecycle.loadAndRegister(desc, dummyContext);

    // Verify hotkey was preserved
    expect(app.hotkeyManager.customKeys[obsId]).toEqual([
      { modifiers: ["Mod"], key: "H" },
    ]);
  });

  it("should invoke cleanup() when removing a command by file path", async () => {
    const cleanupMock = vi.fn();
    const command: OCCCommand = {
      metadata: { id: "cleanup-test", name: "Cleanup Test" },
      cleanup: cleanupMock,
      execute: vi.fn(),
    };
    vi.spyOn(loader, "load").mockResolvedValue(command);

    const desc: CommandFileDescriptor = {
      path: "commands/cleanup.js",
      filename: "cleanup.js",
      extension: "js",
      isDirectoryBundle: false,
    };

    await lifecycle.loadAndRegister(desc, dummyContext);
    expect(registry.has("cleanup-test")).toBe(true);

    const removed = await lifecycle.removeByFilePath("commands/cleanup.js", dummyContext);
    expect(removed).toBe(true);
    expect(cleanupMock).toHaveBeenCalledWith(dummyContext);
    expect(registry.has("cleanup-test")).toBe(false);
  });
});
