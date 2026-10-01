import { Notice } from "obsidian";
import type { InteractiveToastHandle, ToastOptions } from "../types/context";

export class InteractiveToast implements InteractiveToastHandle {
  private notice: Notice;
  private messageEl: HTMLElement;

  constructor(message: string, options?: ToastOptions) {
    const duration = options?.duration !== undefined ? options.duration : 4000;
    // Pass empty DocumentFragment to Notice so we can build custom DOM inside noticeEl
    const fragment = document.createDocumentFragment();
    this.notice = new Notice(fragment, duration);

    const noticeEl = (this.notice as any).noticeEl as HTMLElement;
    if (noticeEl) {
      noticeEl.addClass("occ-interactive-toast");
      if (options?.type) {
        noticeEl.addClass(`occ-toast-${options.type}`);
      }
    }

    // 1. Message container
    this.messageEl = document.createElement("div");
    this.messageEl.className = "occ-toast-message";
    this.messageEl.textContent = message;
    if (noticeEl) {
      noticeEl.appendChild(this.messageEl);
    }

    // 2. Action buttons
    if (options?.actions && options.actions.length > 0 && noticeEl) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "occ-toast-actions";

      for (const action of options.actions) {
        const btn = document.createElement("button");
        btn.className = "occ-toast-button";
        btn.textContent = action.label;

        if (action.variant && action.variant !== "default") {
          btn.classList.add(`mod-${action.variant}`);
        }

        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await action.onClick();
          } catch (err) {
            console.error("[OCC Toast Action Error]:", err);
          } finally {
            this.hide();
          }
        });

        actionsEl.appendChild(btn);
      }

      noticeEl.appendChild(actionsEl);
    }
  }

  setMessage(msg: string): void {
    if (this.messageEl) {
      this.messageEl.textContent = msg;
    }
  }

  hide(): void {
    this.notice.hide();
  }
}
