import { Notice, Setting } from "obsidian";
import type { ExecutionLogger, ExecutionLogRecord } from "../../core/ExecutionLogger";

export class LogViewerView {
  private searchQuery = "";
  private statusFilter: "all" | "success" | "error" = "all";
  private unsubscribe?: () => void;

  constructor(private containerEl: HTMLElement, private logger: ExecutionLogger) {}

  render(): void {
    const { containerEl, logger } = this;
    containerEl.empty();
    containerEl.addClass("occ-log-viewer-view");

    containerEl.createEl("h3", { text: "Execution Logs & Diagnostics" });
    containerEl.createEl("p", {
      text: "Real-time telemetry ring-buffer of the last 100 command runs.",
      cls: "setting-item-description",
    });

    // 1. Controls Toolbar
    const toolbar = containerEl.createDiv({ cls: "occ-log-toolbar" });

    // Search input
    new Setting(toolbar)
      .setName("Filter Logs")
      .addText((text) =>
        text
          .setPlaceholder("Search by command name or ID...")
          .setValue(this.searchQuery)
          .onChange((val) => {
            this.searchQuery = val.toLowerCase().trim();
            this.renderLogList(listContainer);
          })
      )
      .addDropdown((dd) =>
        dd
          .addOption("all", "All Statuses")
          .addOption("success", "Success Only")
          .addOption("error", "Errors Only")
          .setValue(this.statusFilter)
          .onChange((val: any) => {
            this.statusFilter = val;
            this.renderLogList(listContainer);
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Copy Diagnostics")
          .setCta()
          .onClick(async () => {
            try {
              const json = logger.exportJson();
              if (navigator.clipboard) {
                await navigator.clipboard.writeText(json);
              }
              new Notice("Sanitized diagnostics copied to clipboard!");
            } catch (e: any) {
              new Notice(`Failed to copy diagnostics: ${e.message}`);
            }
          })
      )
      .addButton((btn) =>
        btn.setButtonText("Clear Logs").onClick(() => {
          logger.clear();
          this.renderLogList(listContainer);
        })
      );

    // 2. Logs List
    const listContainer = containerEl.createDiv({ cls: "occ-log-list" });
    this.renderLogList(listContainer);

    // Live subscription
    if (!this.unsubscribe) {
      this.unsubscribe = logger.onLog(() => {
        this.renderLogList(listContainer);
      });
    }
  }

  private renderLogList(container: HTMLElement): void {
    container.empty();

    let logs = this.logger.getLogs();

    // Apply filters
    if (this.statusFilter !== "all") {
      logs = logs.filter((l) => l.status === this.statusFilter);
    }
    if (this.searchQuery) {
      logs = logs.filter(
        (l) =>
          l.commandName.toLowerCase().includes(this.searchQuery) ||
          l.commandId.toLowerCase().includes(this.searchQuery)
      );
    }

    if (logs.length === 0) {
      container.createEl("p", {
        text: "No execution logs match the current filter.",
        cls: "occ-empty-notice",
      });
      return;
    }

    const table = container.createEl("table", { cls: "occ-log-table" });
    const header = table.createEl("tr");
    header.createEl("th", { text: "Time" });
    header.createEl("th", { text: "Command" });
    header.createEl("th", { text: "Status" });
    header.createEl("th", { text: "Duration" });
    header.createEl("th", { text: "Details" });

    for (const log of logs) {
      const row = table.createEl("tr", { cls: `occ-log-row occ-log-${log.status}` });

      // Timestamp
      const d = new Date(log.timestamp);
      const timeStr = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
      row.createEl("td", { text: timeStr, cls: "occ-log-time" });

      // Command Name
      const cmdTd = row.createEl("td", { cls: "occ-log-cmd" });
      cmdTd.createEl("strong", { text: log.commandName });
      cmdTd.createEl("span", { text: ` (${log.commandId})`, cls: "occ-log-cmd-id" });

      // Status
      const statusTd = row.createEl("td");
      statusTd.createEl("span", {
        text: log.status.toUpperCase(),
        cls: `occ-log-badge occ-log-badge-${log.status}`,
      });

      // Duration
      row.createEl("td", { text: `${log.durationMs}ms`, cls: "occ-log-duration" });

      // Details
      const detailsTd = row.createEl("td", { cls: "occ-log-details" });
      if (log.error) {
        detailsTd.createEl("span", { text: log.error, cls: "occ-log-error-msg" });
      } else {
        detailsTd.createEl("span", { text: "OK", cls: "occ-log-ok-msg" });
      }
    }
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }
}
