import type { App } from "obsidian";
import type { BackgroundWorkerManager } from "../core/BackgroundWorkerManager";
import { TaskInspectorModal } from "./modals/TaskInspectorModal";

export class StatusBarMonitor {
  private unsubscribe?: () => void;

  constructor(
    private statusBarEl: HTMLElement,
    private workerManager: BackgroundWorkerManager,
    private app: App
  ) {
    this.init();
  }

  private init(): void {
    this.statusBarEl.addClass("occ-status-bar-item");
    this.statusBarEl.addEventListener("click", () => {
      new TaskInspectorModal(this.app, this.workerManager).open();
    });

    this.unsubscribe = this.workerManager.onTasksChanged(() => {
      this.updateStatus();
    });

    this.updateStatus();
  }

  public updateStatus(): void {
    const activeCount = this.workerManager.getActiveCount();

    if (activeCount > 0) {
      this.statusBarEl.textContent = `OCC: ${activeCount} task${activeCount > 1 ? "s" : ""} running`;
      this.statusBarEl.addClass("occ-status-active");
      this.statusBarEl.setAttribute(
        "aria-label",
        "Command Center: Background tasks running. Click to inspect."
      );
    } else {
      this.statusBarEl.textContent = "";
      this.statusBarEl.removeClass("occ-status-active");
      this.statusBarEl.removeAttribute("aria-label");
    }
  }

  public destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
    this.statusBarEl.empty();
  }
}
