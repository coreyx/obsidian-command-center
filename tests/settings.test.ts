import { describe, it, expect, vi, beforeEach } from "vitest";
import { OCCSettingTab } from "../src/settings/SettingTab";
import { CommandTableView } from "../src/settings/views/CommandTableView";
import { MacroBuilderView } from "../src/settings/views/MacroBuilderView";
import { LogViewerView } from "../src/settings/views/LogViewerView";
import { ExecutionLogger } from "../src/core/ExecutionLogger";
import { CommandRegistry } from "../src/core/CommandRegistry";
import { ExecutionEngine } from "../src/core/ExecutionEngine";
import { CommandScanner } from "../src/core/CommandScanner";
import type { OCCCommand } from "../src/types/command";

describe("Milestone 7 - Command Center Dashboard & Settings UI", () => {
  let mockApp: any;
  let mockPlugin: any;
  let registry: CommandRegistry;
  let engine: ExecutionEngine;
  let logger: ExecutionLogger;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockApp = {
      workspace: { getActiveFile: () => null },
      vault: {
        adapter: {
          exists: vi.fn().mockResolvedValue(true),
          write: vi.fn().mockResolvedValue(undefined),
        },
        createFolder: vi.fn().mockResolvedValue(undefined),
      },
    };

    logger = new ExecutionLogger();
    const pluginInstance = {
      addCommand: vi.fn((cmd) => cmd),
      manifest: { id: "obsidian-command-center" },
    };
    registry = new CommandRegistry(mockApp, pluginInstance as any);
    engine = new ExecutionEngine({
      app: mockApp,
      registry,
      logger,
    });

    mockPlugin = {
      app: mockApp,
      settings: {
        commandsDirectory: "commands",
        enableHotReload: true,
        disabledCommands: [],
      },
      registry,
      engine,
      scanner: new CommandScanner(mockApp),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      reloadAllCommands: vi.fn().mockResolvedValue(undefined),
      setupFileWatcher: vi.fn(),
      watcher: { stop: vi.fn() },
    };
  });

  describe("TASK-25: Settings Tab Navigation", () => {
    it("should render navigation tabs and switch between views", () => {
      const tab = new OCCSettingTab(mockApp, mockPlugin);
      tab.display();

      const navTabs = tab.containerEl.querySelectorAll(".occ-nav-tab-btn");
      expect(navTabs.length).toBe(4);
      expect(navTabs[0]?.textContent).toBe("Commands");
      expect(navTabs[1]?.textContent).toBe("Macro Builder");
      expect(navTabs[2]?.textContent).toBe("Execution Logs");
      expect(navTabs[3]?.textContent).toBe("General Settings");

      // Default active tab is commands
      expect(navTabs[0]?.classList.contains("is-active")).toBe(true);
      expect(tab.containerEl.querySelector(".occ-command-table-view")).not.toBeNull();

      // Click Macro Builder tab
      (navTabs[1] as HTMLElement).click();
      expect(navTabs[1]?.classList.contains("is-active")).toBe(true);
      expect(tab.containerEl.querySelector(".occ-macro-builder-view")).not.toBeNull();

      // Click Execution Logs tab
      (navTabs[2] as HTMLElement).click();
      expect(navTabs[2]?.classList.contains("is-active")).toBe(true);
      expect(tab.containerEl.querySelector(".occ-log-viewer-view")).not.toBeNull();

      tab.hide();
      expect(tab.containerEl.innerHTML).toBe("");
    });
  });

  describe("TASK-26: Command Registry Table View", () => {
    it("should display discovered commands with details and toggle active state", async () => {
      const cmd1: OCCCommand = {
        metadata: { id: "cmd-1", name: "Format Markdown" },
        execute: () => {},
      };
      registry.register(cmd1, "commands/format.js", true);

      const container = document.createElement("div");
      const view = new CommandTableView(container, mockPlugin);
      view.render();

      const rows = container.querySelectorAll("tr.occ-dashboard-row");
      expect(rows.length).toBe(1);

      const nameCell = container.querySelector(".occ-cmd-name");
      expect(nameCell?.textContent).toBe("Format Markdown");

      const typeBadge = container.querySelector(".occ-type-badge");
      expect(typeBadge?.textContent).toBe("Script");

      const statusBadge = container.querySelector(".occ-status-badge");
      expect(statusBadge?.textContent).toBe("Active");

      // Toggle off
      const toggleInput = container.querySelector("input[type=checkbox]") as HTMLInputElement;
      expect(toggleInput).not.toBeNull();
      expect(toggleInput.checked).toBe(true);

      toggleInput.checked = false;
      toggleInput.dispatchEvent(new Event("change"));

      expect(mockPlugin.settings.disabledCommands).toContain("format.js");
      expect(mockPlugin.saveSettings).toHaveBeenCalled();
    });

    it("should trigger reloadAllCommands when Reload button is clicked", async () => {
      const container = document.createElement("div");
      const view = new CommandTableView(container, mockPlugin);
      view.render();

      const reloadBtn = container.querySelector(".occ-tab-topbar button") as HTMLButtonElement;
      expect(reloadBtn).not.toBeNull();
      reloadBtn.click();

      expect(mockPlugin.reloadAllCommands).toHaveBeenCalled();
    });
  });

  describe("TASK-27: Visual Macro Builder UI", () => {
    it("should allow adding, reordering, and saving macro definitions", async () => {
      const container = document.createElement("div");
      const view = new MacroBuilderView(container, mockPlugin);
      view.render();

      // Set Name and ID
      const inputs = container.querySelectorAll("input[type=text]");
      const nameInput = inputs[0] as HTMLInputElement;
      const idInput = inputs[1] as HTMLInputElement;

      nameInput.value = "Test Macro";
      nameInput.dispatchEvent(new Event("input"));
      idInput.value = "test-macro";
      idInput.dispatchEvent(new Event("input"));

      // Click Add Step twice
      const addStepBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === "+ Add Step"
      )!;
      addStepBtn.click();
      addStepBtn.click();

      let stepCards = container.querySelectorAll(".occ-step-card");
      expect(stepCards.length).toBe(2);

      // Fill in step command IDs
      const step1CmdInput = stepCards[0]?.querySelector("input[type=text]") as HTMLInputElement;
      step1CmdInput.value = "command-alpha";
      step1CmdInput.dispatchEvent(new Event("input"));

      const step2CmdInput = stepCards[1]?.querySelector("input[type=text]") as HTMLInputElement;
      step2CmdInput.value = "command-beta";
      step2CmdInput.dispatchEvent(new Event("input"));

      // Click move up on second step
      const upBtn = stepCards[1]?.querySelector("button[title='Move Up']") as HTMLButtonElement;
      upBtn.click();

      // Step cards should have swapped
      stepCards = container.querySelectorAll(".occ-step-card");
      const firstInputAfterSwap = stepCards[0]?.querySelector("input[type=text]") as HTMLInputElement;
      expect(firstInputAfterSwap.value).toBe("command-beta");

      // Click Save Macro
      const saveBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === "Save Macro"
      )!;
      saveBtn.click();
      await new Promise((r) => setTimeout(r, 20));

      // Verify file write to vault adapter
      expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
        "commands/test-macro.macro.json",
        expect.stringContaining('"id": "test-macro"')
      );
      expect(mockPlugin.reloadAllCommands).toHaveBeenCalled();
    });
  });

  describe("TASK-28: Diagnostic Telemetry & Execution Log Viewer", () => {
    it("should maintain 100-entry ring buffer in ExecutionLogger", () => {
      for (let i = 0; i < 120; i++) {
        logger.log({
          timestamp: Date.now() + i,
          commandId: `cmd-${i}`,
          commandName: `Command ${i}`,
          durationMs: i,
          status: i % 2 === 0 ? "success" : "error",
        });
      }

      const logs = logger.getLogs();
      expect(logs.length).toBe(100);
      // Newest entry is first (cmd-119)
      expect(logs[0]?.commandId).toBe("cmd-119");
    });

    it("should render logs and support filtering in LogViewerView", () => {
      logger.log({
        timestamp: Date.now(),
        commandId: "alpha-cmd",
        commandName: "Alpha Command",
        durationMs: 15,
        status: "success",
      });
      logger.log({
        timestamp: Date.now() + 10,
        commandId: "beta-cmd",
        commandName: "Beta Command",
        durationMs: 45,
        status: "error",
        error: "Execution crashed",
      });

      const container = document.createElement("div");
      const view = new LogViewerView(container, logger);
      view.render();

      let rows = container.querySelectorAll("tr.occ-log-row");
      expect(rows.length).toBe(2);

      // Search filter for "beta"
      const searchInput = container.querySelector(".occ-log-toolbar input[type=text]") as HTMLInputElement;
      searchInput.value = "beta";
      searchInput.dispatchEvent(new Event("input"));

      rows = container.querySelectorAll("tr.occ-log-row");
      expect(rows.length).toBe(1);
      expect(rows[0]?.textContent).toContain("Beta Command");

      view.destroy();
    });

    it("should copy sanitized JSON diagnostics to clipboard", async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: writeTextMock },
        configurable: true,
      });

      logger.log({
        timestamp: 1700000000000,
        commandId: "test-cmd",
        commandName: "Test Command",
        durationMs: 10,
        status: "success",
      });

      const container = document.createElement("div");
      const view = new LogViewerView(container, logger);
      view.render();

      const copyBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === "Copy Diagnostics"
      )!;
      await copyBtn.click();

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const exportedJson = writeTextMock.mock.calls[0][0];
      expect(exportedJson).toContain('"commandId": "test-cmd"');

      view.destroy();
    });
  });
});
