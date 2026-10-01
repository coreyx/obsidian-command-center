import { Notice } from "obsidian";
import type { ProgressOptions, ProgressReporter, ProgressUpdate } from "../types/context";

export class OCCProgressReporter implements ProgressReporter {
  private notice: Notice;
  private messageEl: HTMLElement;
  private progressBarEl: HTMLElement;
  private current: number = 0;
  private total: number;
  private pendingUpdate = false;
  private lastUpdateMessage: string;

  constructor(options?: ProgressOptions) {
    this.total = options?.total ?? 100;
    this.lastUpdateMessage = options?.initialMessage ?? options?.title ?? "Processing...";

    // DocumentFragment for custom DOM
    const fragment = document.createDocumentFragment();
    // 0 duration keeps the notice persistent while running
    this.notice = new Notice(fragment, 0);

    const noticeEl = (this.notice as any).noticeEl as HTMLElement;
    if (noticeEl) {
      noticeEl.addClass("occ-progress-notice");
    }

    this.messageEl = document.createElement("div");
    this.messageEl.className = "occ-progress-message";
    this.messageEl.textContent = this.lastUpdateMessage;
    if (noticeEl) {
      noticeEl.appendChild(this.messageEl);
    }

    const containerEl = document.createElement("div");
    containerEl.className = "occ-progress-container";

    this.progressBarEl = document.createElement("div");
    this.progressBarEl.className = "occ-progress-bar";
    this.progressBarEl.style.width = "0%";

    containerEl.appendChild(this.progressBarEl);
    if (noticeEl) {
      noticeEl.appendChild(containerEl);
    }
  }

  update(update: ProgressUpdate): void {
    if (update.current !== undefined) {
      this.current = update.current;
    }
    if (update.total !== undefined) {
      this.total = update.total;
    }
    if (update.message !== undefined) {
      this.lastUpdateMessage = update.message;
    }

    // Throttle DOM updates to avoid layout thrashing
    if (!this.pendingUpdate) {
      this.pendingUpdate = true;
      const scheduleFn =
        typeof requestAnimationFrame === "function"
          ? requestAnimationFrame
          : (cb: () => void) => setTimeout(cb, 16);

      scheduleFn(() => {
        this.render();
        this.pendingUpdate = false;
      });
    }
  }

  private render(): void {
    const pct = this.total > 0 ? Math.min(100, Math.max(0, Math.round((this.current / this.total) * 100))) : 0;
    if (this.progressBarEl) {
      this.progressBarEl.style.width = `${pct}%`;
    }
    if (this.messageEl) {
      this.messageEl.textContent = `${this.lastUpdateMessage} (${pct}%)`;
    }
  }

  finish(completionMessage?: string): void {
    this.notice.hide();
    if (completionMessage) {
      new Notice(completionMessage, 4000);
    }
  }
}
