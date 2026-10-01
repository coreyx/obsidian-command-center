import { describe, it, expect, beforeEach } from "vitest";
import { MockApp } from "./mocks/obsidian";
import { ModuleLoader } from "../src/core/ModuleLoader";
import type { CommandFileDescriptor } from "../src/types/command";

describe("ModuleLoader", () => {
  let app: MockApp;
  let loader: ModuleLoader;

  beforeEach(() => {
    app = new MockApp();
    // In test environment, set adapter.getBasePath to null to exercise function evaluation or mock
    (app.vault.adapter as any).getBasePath = () => null;
    loader = new ModuleLoader(app as any);
  });

  it("should load a valid declarative JSON command", async () => {
    const jsonContent = JSON.stringify({
      id: "test-macro",
      name: "Test Macro",
      steps: [{ commandId: "editor:toggle-fold" }],
    });
    await app.vault.adapter.write("commands/test.json", jsonContent);

    const desc: CommandFileDescriptor = {
      path: "commands/test.json",
      filename: "test.json",
      extension: "json",
      isDirectoryBundle: false,
    };

    const cmd = await loader.load(desc);
    expect(cmd.metadata.id).toBe("test-macro");
    expect(cmd.metadata.name).toBe("Test Macro");
    expect(typeof cmd.execute).toBe("function");
  });

  it("should fail if JSON command is missing required metadata", async () => {
    await app.vault.adapter.write("commands/invalid.json", JSON.stringify({ name: "No ID" }));
    const desc: CommandFileDescriptor = {
      path: "commands/invalid.json",
      filename: "invalid.json",
      extension: "json",
      isDirectoryBundle: false,
    };

    await expect(loader.load(desc)).rejects.toThrow('missing or invalid "id"');
  });

  it("should load a valid JavaScript script command via scoped evaluation", async () => {
    const jsCode = `
      module.exports = {
        metadata: {
          id: "custom-script",
          name: "Custom Script"
        },
        execute: async (context) => {
          return "executed " + context.input;
        }
      };
    `;
    await app.vault.adapter.write("commands/script.js", jsCode);

    const desc: CommandFileDescriptor = {
      path: "commands/script.js",
      filename: "script.js",
      extension: "js",
      isDirectoryBundle: false,
    };

    const cmd = await loader.load(desc);
    expect(cmd.metadata.id).toBe("custom-script");
    expect(cmd.metadata.name).toBe("Custom Script");
    const result = await cmd.execute({ input: "hello" } as any);
    expect(result).toBe("executed hello");
  });

  it("should fail if script lacks an execute function", async () => {
    const jsCode = `
      module.exports = {
        metadata: { id: "no-exec", name: "No Exec" }
      };
    `;
    await app.vault.adapter.write("commands/no-exec.js", jsCode);

    const desc: CommandFileDescriptor = {
      path: "commands/no-exec.js",
      filename: "no-exec.js",
      extension: "js",
      isDirectoryBundle: false,
    };

    await expect(loader.load(desc)).rejects.toThrow('must implement an "execute" function');
  });
});
