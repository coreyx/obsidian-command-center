import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeDefinitionGenerator } from "../src/core/TypeDefinitionGenerator";
import { CommandScaffolder } from "../src/core/CommandScaffolder";

describe("Milestone 8 - Developer Experience (DX), Scaffolding & Type Safety", () => {
  let mockVault: any;
  let mockWorkspace: any;
  let typeGen: TypeDefinitionGenerator;
  let scaffolder: CommandScaffolder;

  beforeEach(() => {
    mockVault = {
      adapter: {
        exists: vi.fn().mockResolvedValue(true),
        write: vi.fn().mockResolvedValue(undefined),
      },
      createFolder: vi.fn().mockResolvedValue(undefined),
    };
    mockWorkspace = {
      openLinkText: vi.fn().mockResolvedValue(undefined),
    };
    typeGen = new TypeDefinitionGenerator();
    scaffolder = new CommandScaffolder();
  });

  describe("TASK-29: Automated Type Definition Generator (occ.d.ts)", () => {
    it("should generate comprehensive TypeScript declaration content", () => {
      const declarations = typeGen.generateTypeDeclarations();

      expect(declarations).toContain("export interface ExecutionContext");
      expect(declarations).toContain("export interface OCCCommand");
      expect(declarations).toContain("export interface OCCCommandMetadata");
      expect(declarations).toContain("export interface VaultHelper");
      expect(declarations).toContain("export interface ToastOptions");
      expect(declarations).toContain("export interface OCCUIHelper");
      expect(declarations).toContain("export interface OCCQueueHelper");
      expect(declarations).toContain("export interface QueueOptions");
    });

    it("should write occ.d.ts into the target commands directory", async () => {
      const writtenPath = await typeGen.ensureDeclarationsFile("custom/commands", mockVault);

      expect(writtenPath).toBe("custom/commands/occ.d.ts");
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "custom/commands/occ.d.ts",
        expect.stringContaining("export interface ExecutionContext")
      );
    });

    it("should create directory if it does not exist before writing declarations", async () => {
      mockVault.adapter.exists = vi.fn().mockResolvedValue(false);

      await typeGen.ensureDeclarationsFile("new/folder", mockVault);

      expect(mockVault.createFolder).toHaveBeenCalledWith("new/folder");
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "new/folder/occ.d.ts",
        expect.any(String)
      );
    });
  });

  describe("TASK-30: Interactive Command Scaffolder Wizard", () => {
    it("should slugify names cleanly into valid command IDs", () => {
      expect(scaffolder.slugify("Daily Briefing!")).toBe("daily-briefing");
      expect(scaffolder.slugify("Format & Export (Markdown)")).toBe("format-export-markdown");
      expect(scaffolder.slugify("   multiple---hyphens   ")).toBe("multiple-hyphens");
      expect(scaffolder.slugify("")).toBe("my-command");
    });

    it("should scaffold a starter JavaScript command and open in workspace", async () => {
      const createdPath = await scaffolder.scaffoldCommand(
        { name: "My Quick Script", type: "script" },
        "my-commands",
        mockVault,
        mockWorkspace
      );

      expect(createdPath).toBe("my-commands/my-quick-script.js");
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/my-quick-script.js",
        expect.stringContaining('id: "my-quick-script"')
      );
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/my-quick-script.js",
        expect.stringContaining("export async function execute(context)")
      );

      // Verify file was opened in workspace editor
      expect(mockWorkspace.openLinkText).toHaveBeenCalledWith(
        "my-quick-script.js",
        "my-commands/my-quick-script.js",
        true
      );
    });

    it("should scaffold a starter Declarative Macro JSON definition", async () => {
      const createdPath = await scaffolder.scaffoldCommand(
        { name: "My Format Macro", type: "macro" },
        "my-commands",
        mockVault,
        mockWorkspace
      );

      expect(createdPath).toBe("my-commands/my-format-macro.macro.json");
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/my-format-macro.macro.json",
        expect.stringContaining('"id": "my-format-macro"')
      );
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/my-format-macro.macro.json",
        expect.stringContaining('"steps"')
      );
    });
  });

  describe("TASK-31: Starter Command Template Library", () => {
    it("should install all three bundled starter templates", async () => {
      const installed = await scaffolder.installStarterTemplates("my-commands", mockVault);

      expect(installed.length).toBe(3);
      expect(installed).toEqual([
        "my-commands/daily-briefing.js",
        "my-commands/format-and-export.macro.json",
        "my-commands/sync-notes-worker.js",
      ]);

      // Daily briefing check
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/daily-briefing.js",
        expect.stringContaining('id: "daily-briefing"')
      );

      // Format and export macro check
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/format-and-export.macro.json",
        expect.stringContaining('"id": "format-and-export"')
      );

      // Sync notes background worker check
      expect(mockVault.adapter.write).toHaveBeenCalledWith(
        "my-commands/sync-notes-worker.js",
        expect.stringContaining("isBackground: true")
      );
    });
  });
});
