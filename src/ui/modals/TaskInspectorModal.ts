import { App, Modal } from "obsidian";
import type { BackgroundWorkerManager } from "../../core/BackgroundWorkerManager";
import type { BackgroundTaskRecord } from "../../types/worker";

export class TaskInspectorModal extends Modal {
  private unsubscribe?: () => void;
  private timerInterval?: any;

  constructor(app: App, private workerManager: BackgroundWorkerManager) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("occ-task-inspector-modal");

    contentEl.createEl("h2", { text: "Command Center — Background Tasks" });

    const listContainer = contentEl.createDiv({ cls: "occ-task-list" });

    this.unsubscribe = this.workerManager.onTasksChanged((tasks) => {
      this.renderTasks(listContainer, tasks);
    });

    // Tick every second to update running durations in real-time
    this.timerInterval = setInterval(() => {
      this.renderTasks(listContainer, this.workerManager.listTasks());
    }, 1000);
  }

  private renderTasks(container: HTMLElement, tasks: BackgroundTaskRecord[]): void {
    container.empty();

    if (tasks.length === 0) {
      container.createEl("p", {
        text: "No active or recent background tasks.",
        cls: "occ-task-empty",
      });
      return;
    }

    const table = container.createEl("table", { cls: "occ-task-table" });
    const headerRow = table.createEl("tr");
    headerRow.createEl("th", { text: "Command" });
    headerRow.createEl("th", { text: "Status" });
    headerRow.createEl("th", { text: "Duration" });
    headerRow.createEl("th", { text: "Action" });

    for (const task of tasks.slice().reverse()) {
      const row = table.createEl("tr", { cls: `occ-task-row occ-row-${task.state.toLowerCase()}` });

      // 1. Name
      row.createEl("td", { text: task.commandName, cls: "occ-task-name" });

      // 2. Status badge
      const statusTd = row.createEl("td");
      statusTd.createEl("span", {
        text: task.state,
        cls: `occ-task-badge occ-badge-${task.state.toLowerCase()}`,
      });

      // 3. Duration
      const durationMs = (task.endTime ?? Date.now()) - task.startTime;
      const durationSec = Math.max(0, Math.round(durationMs / 1000));
      row.createEl("td", { text: `${durationSec}s`, cls: "occ-task-duration" });

      // 4. Action
      const actionTd = row.createEl("td");
      if (task.state === "RUNNING" || task.state === "PENDING") {
        const cancelBtn = actionTd.createEl("button", {
          text: "Cancel",
          cls: "mod-warning occ-task-cancel-btn",
        });
        cancelBtn.addEventListener("click", async () => {
          cancelBtn.disabled = true;
          cancelBtn.textContent = "Cancelling...";
          await this.workerManager.cancelTask(task.taskId);
        });
      } else {
        actionTd.createEl("span", { text: "—", cls: "occ-task-no-action" });
      }
    }
  }

  onClose(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.contentEl.empty();
  }
}
