import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockApp, MockPlugin, MockTFile } from "./mocks/obsidian";
import { CommandScanner } from "../src/core/CommandScanner";
import { ModuleLoader } from "../src/core/ModuleLoader";
import { CommandRegistry } from "../src/core/CommandRegistry";
import { ExecutionEngine } from "../src/core/ExecutionEngine";
import { MacroOrchestrator } from "../src/core/MacroOrchestrator";
import * as fs from "fs";
import * as path from "path";

describe("Example Plugin & Macro Verification", () => {
  let app: MockApp;
  let plugin: MockPlugin;
  let scanner: CommandScanner;
  let loader: ModuleLoader;
  let registry: CommandRegistry;
  let engine: ExecutionEngine;
  let toastMock: any;
  let promptMock: any;
  let suggestMock: any;

  beforeEach(() => {
    app = new MockApp();
    (app.vault.adapter as any).getBasePath = () => null;
    plugin = new MockPlugin(app);
    toastMock = vi.fn().mockReturnValue({ hide: vi.fn(), setMessage: vi.fn() });
    promptMock = vi.fn();
    suggestMock = vi.fn();

    const uiHelper: any = {
      toast: toastMock,
      prompt: promptMock,
      confirm: vi.fn(),
      suggest: suggestMock,
      createProgress: vi.fn(),
    };

    scanner = new CommandScanner(app as any);
    loader = new ModuleLoader(app as any);
    registry = new CommandRegistry(app as any, plugin as any, async (id) => {
      return engine.execute(id);
    });
    engine = new ExecutionEngine({
      app: app as any,
      registry,
      uiHelper,
    });
  });

  it("should scan and recognize vault-librarian as a directory bundle", async () => {
    const examplesDir = "commands";
    await app.vault.adapter.mkdir(examplesDir);
    await app.vault.adapter.mkdir(`${examplesDir}/vault-librarian`);

    const commandCode = fs.readFileSync(
      path.resolve(__dirname, "../examples/vault-librarian/command.js"),
      "utf-8"
    );
    await app.vault.adapter.write(`${examplesDir}/vault-librarian/command.js`, commandCode);

    const descriptors = await scanner.scan(examplesDir);
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0]).toEqual({
      path: "commands/vault-librarian/command.js",
      filename: "vault-librarian",
      extension: "js",
      isDirectoryBundle: true,
    });
  });

  it("should load vault-librarian command object with complete metadata and lifecycle hooks", async () => {
    const commandCode = fs.readFileSync(
      path.resolve(__dirname, "../examples/vault-librarian/command.js"),
      "utf-8"
    );
    await app.vault.adapter.write("commands/vault-librarian/command.js", commandCode);

    const command = await loader.load({
      path: "commands/vault-librarian/command.js",
      filename: "vault-librarian",
      extension: "js",
      isDirectoryBundle: true,
    });

    expect(command.metadata.id).toBe("vault-librarian");
    expect(command.metadata.name).toBe("Vault Librarian: Inspect & Organize Note");
    expect(command.metadata.queueName).toBe("vault-mutations");
    expect(command.metadata.timeout).toBe(10000);
    expect(typeof command.init).toBe("function");
    expect(typeof command.canExecute).toBe("function");
    expect(typeof command.execute).toBe("function");
    expect(typeof command.onError).toBe("function");
    expect(typeof command.cleanup).toBe("function");
  });

  it("should enforce canExecute pre-condition when no active note is open", async () => {
    const commandCode = fs.readFileSync(
      path.resolve(__dirname, "../examples/vault-librarian/command.js"),
      "utf-8"
    );
    await app.vault.adapter.write("commands/vault-librarian/command.js", commandCode);

    const command = await loader.load({
      path: "commands/vault-librarian/command.js",
      filename: "vault-librarian",
      extension: "js",
      isDirectoryBundle: true,
    });
    registry.register(command, "commands/vault-librarian/command.js");

    app.workspace.activeFile = null;

    const result = await engine.execute("vault-librarian");
    expect(result).toBeNull();
    expect(toastMock).toHaveBeenCalledWith(
      "Please open a markdown note in the editor before running Vault Librarian.",
      expect.objectContaining({ type: "warning" })
    );
  });

  it("should execute vault-librarian stats action and register undo toast", async () => {
    const commandCode = fs.readFileSync(
      path.resolve(__dirname, "../examples/vault-librarian/command.js"),
      "utf-8"
    );
    await app.vault.adapter.write("commands/vault-librarian/command.js", commandCode);

    const command = await loader.load({
      path: "commands/vault-librarian/command.js",
      filename: "vault-librarian",
      extension: "js",
      isDirectoryBundle: true,
    });
    registry.register(command, "commands/vault-librarian/command.js");

    const note = await app.vault.create("Notes/Sample.md", "Hello world from the Obsidian Command Center.");
    app.workspace.activeFile = note;

    // User selects 'stats' in suggest modal
    suggestMock.mockResolvedValueOnce({ id: "stats" });

    const result: any = await engine.execute("vault-librarian");

    expect(result).toBeDefined();
    expect(result.action).toBe("stats");
    expect(result.wordCount).toBe(7);
    expect(result.lineCount).toBe(1);

    // Verify note was modified with stats block
    const updatedContent = await app.vault.read(note);
    expect(updatedContent).toContain("> [!INFO] Document Metrics");
    expect(updatedContent).toContain("> - **Word Count:** 7");

    // Verify undo toast was triggered with Undo button
    expect(toastMock).toHaveBeenCalledWith(
      "Inserted document metrics block.",
      expect.objectContaining({
        type: "success",
        actions: expect.arrayContaining([
          expect.objectContaining({ label: "Undo", variant: "warning" }),
        ]),
      })
    );

    // Test clicking the Undo button
    const toastCall = toastMock.mock.calls.find((c: any) => c[0] === "Inserted document metrics block.");
    const undoAction = toastCall[1].actions.find((a: any) => a.label === "Undo");
    await undoAction.onClick();

    const restoredContent = await app.vault.read(note);
    expect(restoredContent).toBe("Hello world from the Obsidian Command Center.");
  });

  it("should execute vault-librarian tag addition action", async () => {
    const commandCode = fs.readFileSync(
      path.resolve(__dirname, "../examples/vault-librarian/command.js"),
      "utf-8"
    );
    await app.vault.adapter.write("commands/vault-librarian/command.js", commandCode);

    const command = await loader.load({
      path: "commands/vault-librarian/command.js",
      filename: "vault-librarian",
      extension: "js",
      isDirectoryBundle: true,
    });
    registry.register(command, "commands/vault-librarian/command.js");

    const note = await app.vault.create("Notes/Article.md", "---\ntags:\n  - draft\n---\nArticle content.");
    app.workspace.activeFile = note;

    suggestMock.mockResolvedValueOnce({ id: "tags" });
    promptMock.mockResolvedValueOnce("published");

    const result: any = await engine.execute("vault-librarian");
    expect(result.action).toBe("tags");

    expect(toastMock).toHaveBeenCalledWith(
      "Added tag #published to frontmatter.",
      expect.objectContaining({ type: "success" })
    );
  });

  it("should validate and execute companion daily-review.macro.json", async () => {
    const macroJson = fs.readFileSync(
      path.resolve(__dirname, "../examples/daily-review.macro.json"),
      "utf-8"
    );
    await app.vault.adapter.write("commands/daily-review.macro.json", macroJson);

    const orchestrator = new MacroOrchestrator();
    const parsed = JSON.parse(macroJson);
    const definition = orchestrator.validateDefinition(parsed, "commands/daily-review.macro.json");

    expect(definition.id).toBe("daily-review-macro");
    expect(definition.steps).toHaveLength(2);
    expect(definition.steps[0]?.commandId).toBe("vault-librarian");
    expect(definition.steps[1]?.commandId).toBe("editor:save-file");
  });
});
