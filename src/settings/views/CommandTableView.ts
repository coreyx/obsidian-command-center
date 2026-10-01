import { Setting } from "obsidian";
import type CommandCenterPlugin from "../../main";

export class CommandTableView {
  constructor(private containerEl: HTMLElement, private plugin: CommandCenterPlugin) {}

  render(): void {
    const { containerEl, plugin } = this;
    containerEl.empty();
    containerEl.addClass("occ-command-table-view");

    // Header & Actions
    const topBar = containerEl.createDiv({ cls: "occ-tab-topbar" });
    topBar.createEl("h3", { text: "Discovered Commands" });

    new Setting(topBar)
      .addButton((btn) =>
        btn
          .setButtonText("Reload Commands")
          .setCta()
          .onClick(async () => {
            btn.setDisabled(true);
            btn.setButtonText("Reloading...");
            await plugin.reloadAllCommands();
            this.render();
          })
      );

    const records = plugin.registry.listRecords();

    if (records.length === 0) {
      containerEl.createEl("p", {
        text: "No commands discovered. Place .js, .mjs, or .macro.json files in your commands folder.",
        cls: "occ-empty-notice",
      });
      return;
    }

    const table = containerEl.createEl("table", { cls: "occ-dashboard-table" });
    const headerRow = table.createEl("tr");
    headerRow.createEl("th", { text: "Name" });
    headerRow.createEl("th", { text: "ID" });
    headerRow.createEl("th", { text: "Type" });
    headerRow.createEl("th", { text: "File" });
    headerRow.createEl("th", { text: "Status" });
    headerRow.createEl("th", { text: "Active" });

    for (const record of records) {
      const row = table.createEl("tr", { cls: "occ-dashboard-row" });
      const filename = plugin.scanner.getFilename(record.filePath);
      const isMacro = filename.endsWith(".macro.json") || filename.endsWith(".json");
      const isEnabled = !plugin.settings.disabledCommands.includes(filename);

      // Name
      row.createEl("td", { text: record.command.metadata.name, cls: "occ-cmd-name" });

      // ID
      row.createEl("td", { text: record.command.metadata.id, cls: "occ-cmd-id" });

      // Type
      const typeTd = row.createEl("td");
      typeTd.createEl("span", {
        text: isMacro ? "Macro" : "Script",
        cls: `occ-type-badge ${isMacro ? "occ-type-macro" : "occ-type-script"}`,
      });

      // File
      row.createEl("td", { text: filename, cls: "occ-cmd-file" });

      // Status
      const statusTd = row.createEl("td");
      statusTd.createEl("span", {
        text: isEnabled ? "Active" : "Disabled",
        cls: `occ-status-badge ${isEnabled ? "occ-status-enabled" : "occ-status-disabled"}`,
      });

      // Toggle switch
      const toggleTd = row.createEl("td", { cls: "occ-cmd-toggle" });
      new Setting(toggleTd).addToggle((toggle) => {
        toggle.setValue(isEnabled).onChange(async (val) => {
          if (val) {
            plugin.settings.disabledCommands = plugin.settings.disabledCommands.filter(
              (f) => f !== filename
            );
          } else {
            if (!plugin.settings.disabledCommands.includes(filename)) {
              plugin.settings.disabledCommands.push(filename);
            }
          }
          await plugin.saveSettings();

          // Immediately update registry binding in Obsidian
          const context = plugin.engine.createContext();
          if (val) {
            plugin.registry.register(record.command, record.filePath, true);
          } else {
            plugin.registry.unregister(record.command.metadata.id);
            // Keep in internal record but disabled
            plugin.registry.register(record.command, record.filePath, false);
          }
          this.render();
        });
      });
    }
  }
}
