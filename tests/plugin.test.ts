import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp, MockPlugin } from "./mocks/obsidian";
import CommandCenterPlugin from "../src/main";

describe("CommandCenterPlugin End-to-End MVP Integration", () => {
  let app: MockApp;
  let plugin: CommandCenterPlugin;

  beforeEach(() => {
    app = new MockApp();
    plugin = new CommandCenterPlugin(app as any, {
      id: "obsidian-command-center",
      name: "Command Center",
    } as any);

    // Override addCommand to route through MockApp
    plugin.addCommand = ((cmd: any) => {
      const fullId = `obsidian-command-center:${cmd.id}`;
      const entry = { ...cmd, id: fullId };
      app.commands.commands[fullId] = entry;
      return entry;
    }) as any;

    plugin.addSettingTab = vi.fn();
    plugin.loadData = vi.fn().mockResolvedValue({});
    plugin.saveData = vi.fn().mockResolvedValue(undefined);
    (app.vault.adapter as any).getBasePath = () => null;
  });

  it("should initialize, discover commands, and execute them", async () => {
    // 1. Prepare sample script command in commands folder
    await app.vault.adapter.mkdir(".obsidian/plugins/obsidian-command-center/commands");
    const scriptCode = `
      module.exports = {
        metadata: {
          id: "greet-user",
          name: "Greet User"
        },
        execute: async (context) => {
          return "Hello from OCC! Input: " + context.input;
        }
      };
    `;
    await app.vault.adapter.write(
      ".obsidian/plugins/obsidian-command-center/commands/greet.js",
      scriptCode
    );

    // 2. Load plugin
    await plugin.onload();
    await plugin.reloadAllCommands();

    // 3. Verify registered command
    expect(plugin.registry.has("greet-user")).toBe(true);
    expect(app.commands.commands["obsidian-command-center:greet-user"]).toBeDefined();

    // 4. Trigger command via Obsidian command bus
    const result = await plugin.engine.execute("greet-user", "Alice");
    expect(result).toBe("Hello from OCC! Input: Alice");

    // 5. Unload plugin
    plugin.onunload();
    expect(plugin.registry.list().length).toBe(0);
  });
});
