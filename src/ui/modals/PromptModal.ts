import { App, Modal, Setting } from "obsidian";
import type { PromptOptions } from "../../types/context";

export class PromptModal extends Modal {
  private resolve!: (value: string | null) => void;
  private value: string;
  private submitted = false;

  constructor(app: App, private options: PromptOptions) {
    super(app);
    this.value = options.defaultValue ?? "";
  }

  openAndAwait(): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("occ-prompt-modal");

    if (this.options.title) {
      contentEl.createEl("h3", { text: this.options.title });
    }

    if (this.options.multiline) {
      const textarea = contentEl.createEl("textarea", {
        cls: "occ-prompt-textarea",
        placeholder: this.options.placeholder ?? "",
      });
      textarea.value = this.value;
      textarea.addEventListener("input", (e) => {
        this.value = (e.target as HTMLTextAreaElement).value;
      });
      textarea.focus();
    } else {
      new Setting(contentEl).addText((text) => {
        text
          .setPlaceholder(this.options.placeholder ?? "")
          .setValue(this.value)
          .onChange((val) => {
            this.value = val;
          });

        text.inputEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.submitted = true;
            this.close();
            this.resolve(this.value);
          }
        });

        setTimeout(() => text.inputEl.focus(), 50);
      });
    }

    const buttonContainer = contentEl.createDiv({ cls: "occ-modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.close();
    });

    const submitBtn = buttonContainer.createEl("button", {
      text: "Submit",
      cls: "mod-cta",
    });
    submitBtn.addEventListener("click", () => {
      this.submitted = true;
      this.close();
      this.resolve(this.value);
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.submitted) {
      this.resolve(null);
    }
  }
}
