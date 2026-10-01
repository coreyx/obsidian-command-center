import { Notice, Setting } from "obsidian";
import type CommandCenterPlugin from "../../main";

interface StepDraft {
  commandId: string;
  onError: "halt" | "continue" | "fallback";
  fallbackCommandId?: string;
}

export class MacroBuilderView {
  private macroName = "";
  private macroId = "";
  private macroDesc = "";
  private steps: StepDraft[] = [];

  constructor(private containerEl: HTMLElement, private plugin: CommandCenterPlugin) {}

  render(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("occ-macro-builder-view");

    containerEl.createEl("h3", { text: "Visual Macro Builder" });
    containerEl.createEl("p", {
      text: "Create and assemble custom multi-step macro pipelines without writing JSON by hand.",
      cls: "setting-item-description",
    });

    // 1. Macro Metadata Fields
    new Setting(containerEl)
      .setName("Macro Name")
      .setDesc("Display name for the macro in the Command Palette.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. Daily Note & Task Setup")
          .setValue(this.macroName)
          .onChange((val) => {
            this.macroName = val;
            if (!this.macroId) {
              this.macroId = val.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
            }
          })
      );

    new Setting(containerEl)
      .setName("Macro ID")
      .setDesc("Unique identifier for the macro command.")
      .addText((text) =>
        text
          .setPlaceholder("e.g. daily-note-setup")
          .setValue(this.macroId)
          .onChange((val) => {
            this.macroId = val.trim();
          })
      );

    // 2. Steps List Container
    containerEl.createEl("h4", { text: `Macro Steps (${this.steps.length})` });
    const stepsContainer = containerEl.createDiv({ cls: "occ-builder-steps" });

    if (this.steps.length === 0) {
      stepsContainer.createEl("p", {
        text: "No steps added yet. Click \"Add Step\" below to build your pipeline.",
        cls: "occ-empty-notice",
      });
    } else {
      this.renderSteps(stepsContainer);
    }

    // 3. Actions Toolbar
    const actionsBar = containerEl.createDiv({ cls: "occ-builder-actions" });

    new Setting(actionsBar)
      .addButton((btn) =>
        btn
          .setButtonText("+ Add Step")
          .onClick(() => {
            this.steps.push({
              commandId: "",
              onError: "halt",
            });
            this.render();
          })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Save Macro")
          .setCta()
          .onClick(async () => {
            await this.saveMacro();
          })
      );
  }

  private renderSteps(container: HTMLElement): void {
    container.empty();

    this.steps.forEach((step, index) => {
      const stepCard = container.createDiv({ cls: "occ-step-card" });

      const header = stepCard.createDiv({ cls: "occ-step-card-header" });
      header.createEl("strong", { text: `Step ${index + 1}` });

      const stepControls = header.createDiv({ cls: "occ-step-controls" });

      // Move Up
      if (index > 0) {
        const upBtn = stepControls.createEl("button", { text: "↑", cls: "clickable-icon" });
        upBtn.title = "Move Up";
        upBtn.addEventListener("click", () => {
          const temp = this.steps[index - 1]!;
          this.steps[index - 1] = step;
          this.steps[index] = temp;
          this.render();
        });
      }

      // Move Down
      if (index < this.steps.length - 1) {
        const downBtn = stepControls.createEl("button", { text: "↓", cls: "clickable-icon" });
        downBtn.title = "Move Down";
        downBtn.addEventListener("click", () => {
          const temp = this.steps[index + 1]!;
          this.steps[index + 1] = step;
          this.steps[index] = temp;
          this.render();
        });
      }

      // Delete
      const deleteBtn = stepControls.createEl("button", { text: "✕", cls: "clickable-icon mod-danger" });
      deleteBtn.title = "Remove Step";
      deleteBtn.addEventListener("click", () => {
        this.steps.splice(index, 1);
        this.render();
      });

      // Command ID Input
      new Setting(stepCard)
        .setName("Command ID")
        .setDesc("Obsidian or Command Center command to execute.")
        .addText((text) =>
          text
            .setPlaceholder("e.g. editor:toggle-fold or my-command")
            .setValue(step.commandId)
            .onChange((val) => {
              step.commandId = val.trim();
            })
        );

      // Error Policy
      new Setting(stepCard)
        .setName("On Error Policy")
        .setDesc("Action to take if this step fails.")
        .addDropdown((dd) =>
          dd
            .addOption("halt", "Halt (abort macro immediately)")
            .addOption("continue", "Continue (skip error and proceed)")
            .addOption("fallback", "Fallback (execute fallback command)")
            .setValue(step.onError)
            .onChange((val: any) => {
              step.onError = val;
              this.render();
            })
        );

      // Fallback Command ID if selected
      if (step.onError === "fallback") {
        new Setting(stepCard)
          .setName("Fallback Command ID")
          .setDesc("Command to execute if this step fails.")
          .addText((text) =>
            text
              .setPlaceholder("e.g. my-backup-command")
              .setValue(step.fallbackCommandId ?? "")
              .onChange((val) => {
                step.fallbackCommandId = val.trim();
              })
          );
      }
    });
  }

  private async saveMacro(): Promise<void> {
    const id = this.macroId.trim();
    const name = this.macroName.trim();

    if (!id || !name) {
      new Notice("Please provide both a Macro Name and Macro ID.");
      return;
    }

    if (this.steps.length === 0) {
      new Notice("A macro must contain at least one step.");
      return;
    }

    for (let i = 0; i < this.steps.length; i++) {
      if (!this.steps[i]?.commandId) {
        new Notice(`Step ${i + 1} is missing a Command ID.`);
        return;
      }
    }

    const macroDefinition = {
      id,
      name,
      steps: this.steps.map((s, idx) => ({
        id: `step-${idx + 1}`,
        commandId: s.commandId,
        onError: s.onError,
        ...(s.fallbackCommandId ? { fallbackCommandId: s.fallbackCommandId } : {}),
      })),
    };

    const targetDir = this.plugin.settings.commandsDirectory;
    const filename = `${id}.macro.json`;
    const fullPath = `${targetDir}/${filename}`.replace(/\/+/g, "/");

    try {
      // Ensure target directory exists
      if (!await this.plugin.app.vault.adapter.exists(targetDir)) {
        await this.plugin.app.vault.createFolder(targetDir);
      }

      await this.plugin.app.vault.adapter.write(
        fullPath,
        JSON.stringify(macroDefinition, null, 2)
      );

      new Notice(`Macro "${name}" saved to ${filename}!`);
      await this.plugin.reloadAllCommands();

      // Reset form
      this.macroId = "";
      this.macroName = "";
      this.macroDesc = "";
      this.steps = [];
      this.render();
    } catch (err: any) {
      new Notice(`Failed to save macro: ${err.message}`);
      console.error("[OCC MacroBuilder Error]:", err);
    }
  }
}
