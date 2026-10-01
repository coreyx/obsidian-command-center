import { App, PluginSettingTab, Setting } from "obsidian";
import type CommandCenterPlugin from "../main";

export class OCCSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: CommandCenterPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Obsidian Command Center" });
    containerEl.createEl("p", {
      text: "Configure your custom commands directory and automation settings.",
    });

    new Setting(containerEl)
      .setName("Commands Directory")
      .setDesc("Path to the folder containing your command scripts and macros.")
      .addText((text) =>
        text
          .setPlaceholder(".obsidian/plugins/obsidian-command-center/commands")
          .setValue(this.plugin.settings.commandsDirectory)
          .onChange(async (value) => {
            this.plugin.settings.commandsDirectory = value.trim() || ".obsidian/plugins/obsidian-command-center/commands";
            await this.plugin.saveSettings();
            await this.plugin.reloadAllCommands();
          })
      );

    new Setting(containerEl)
      .setName("Reload Commands")
      .setDesc("Scan the commands directory and re-register all discovered commands.")
      .addButton((button) =>
        button.setButtonText("Reload Now").onClick(async () => {
          await this.plugin.reloadAllCommands();
        })
      );

    const records = this.plugin.registry.listRecords();
    containerEl.createEl("h3", { text: `Registered Commands (${records.length})` });

    if (records.length === 0) {
      containerEl.createEl("p", {
        text: "No commands discovered yet. Add .js, .mjs, or .json files to your commands folder.",
        cls: "occ-empty-notice",
      });
    } else {
      const listEl = containerEl.createEl("ul");
      for (const record of records) {
        const itemEl = listEl.createEl("li");
        itemEl.createEl("strong", { text: record.command.metadata.name });
        itemEl.createEl("span", {
          text: ` (${record.command.metadata.id}) — ${record.filePath}`,
          cls: "occ-command-detail",
        });
      }
    }
  }
}
