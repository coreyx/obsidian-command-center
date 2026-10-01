import { App, Modal } from "obsidian";
import type { ConfirmOptions } from "../../types/context";

export class ConfirmModal extends Modal {
  private resolve!: (value: boolean) => void;
  private confirmed = false;

  constructor(app: App, private options: ConfirmOptions) {
    super(app);
  }

  openAndAwait(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("occ-confirm-modal");

    if (this.options.title) {
      contentEl.createEl("h3", { text: this.options.title });
    }

    contentEl.createEl("p", {
      text: this.options.message,
      cls: "occ-confirm-message",
    });

    const buttonContainer = contentEl.createDiv({ cls: "occ-modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", {
      text: this.options.cancelLabel ?? "Cancel",
    });
    cancelBtn.addEventListener("click", () => {
      this.close();
    });

    const confirmBtn = buttonContainer.createEl("button", {
      text: this.options.confirmLabel ?? "Confirm",
      cls: "mod-cta",
    });
    confirmBtn.addEventListener("click", () => {
      this.confirmed = true;
      this.close();
      this.resolve(true);
    });

    setTimeout(() => confirmBtn.focus(), 50);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.confirmed) {
      this.resolve(false);
    }
  }
}
