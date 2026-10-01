import { App, PluginSettingTab, Setting } from "obsidian";
import type CommandCenterPlugin from "../main";
import { CommandTableView } from "./views/CommandTableView";
import { MacroBuilderView } from "./views/MacroBuilderView";
import { LogViewerView } from "./views/LogViewerView";

export type OCCSettingTabId = "commands" | "builder" | "logs" | "settings";

export class OCCSettingTab extends PluginSettingTab {
  private activeTab: OCCSettingTabId = "commands";
  private logViewer?: LogViewerView;

  constructor(app: App, private plugin: CommandCenterPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("occ-settings-tab-container");

    // Title & Header
    containerEl.createEl("h2", { text: "Obsidian Command Center" });

    // Navigation Tabs Bar
    const navBar = containerEl.createDiv({ cls: "occ-nav-tabs" });

    const tabs: Array<{ id: OCCSettingTabId; label: string }> = [
      { id: "commands", label: "Commands" },
      { id: "builder", label: "Macro Builder" },
      { id: "logs", label: "Execution Logs" },
      { id: "settings", label: "General Settings" },
    ];

    for (const tab of tabs) {
      const tabBtn = navBar.createEl("button", {
        text: tab.label,
        cls: `occ-nav-tab-btn ${this.activeTab === tab.id ? "is-active" : ""}`,
      });
      tabBtn.addEventListener("click", () => {
        if (this.activeTab !== tab.id) {
          this.activeTab = tab.id;
          this.renderTabContent(contentArea);
          this.updateNavButtons(navBar);
        }
      });
    }

    // Active View Container Area
    const contentArea = containerEl.createDiv({ cls: "occ-tab-content-area" });
    this.renderTabContent(contentArea);
  }

  private updateNavButtons(navBar: HTMLElement): void {
    const buttons = navBar.querySelectorAll(".occ-nav-tab-btn");
    buttons.forEach((btn, index) => {
      const tabIds: OCCSettingTabId[] = ["commands", "builder", "logs", "settings"];
      if (tabIds[index] === this.activeTab) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });
  }

  private renderTabContent(container: HTMLElement): void {
    if (this.logViewer) {
      this.logViewer.destroy();
      this.logViewer = undefined;
    }

    container.empty();

    switch (this.activeTab) {
      case "commands":
        new CommandTableView(container, this.plugin).render();
        break;
      case "builder":
        new MacroBuilderView(container, this.plugin).render();
        break;
      case "logs":
        this.logViewer = new LogViewerView(container, this.plugin.engine.getLogger());
        this.logViewer.render();
        break;
      case "settings":
        this.renderGeneralSettings(container);
        break;
    }
  }

  private renderGeneralSettings(container: HTMLElement): void {
    container.createEl("h3", { text: "General Configuration" });

    new Setting(container)
      .setName("Commands Directory")
      .setDesc("Path to the vault directory where scripts and macros are located.")
      .addText((text) =>
        text
          .setPlaceholder(".obsidian/plugins/obsidian-command-center/commands")
          .setValue(this.plugin.settings.commandsDirectory)
          .onChange(async (val) => {
            this.plugin.settings.commandsDirectory =
              val.trim() || ".obsidian/plugins/obsidian-command-center/commands";
            await this.plugin.saveSettings();
            await this.plugin.reloadAllCommands();
          })
      );

    new Setting(container)
      .setName("Enable Hot-Reloading")
      .setDesc("Automatically watch the commands directory and hot-reload when files change.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableHotReload).onChange(async (val) => {
          this.plugin.settings.enableHotReload = val;
          await this.plugin.saveSettings();
          if (val) {
            this.plugin.setupFileWatcher();
          } else {
            this.plugin.watcher?.stop();
          }
        })
      );
  }

  hide(): void {
    if (this.logViewer) {
      this.logViewer.destroy();
      this.logViewer = undefined;
    }
    this.containerEl.empty();
  }
}
