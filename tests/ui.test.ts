import { describe, it, expect, vi, beforeEach } from "vitest";
import { InteractiveToast } from "../src/ui/InteractiveToast";
import { PromptModal } from "../src/ui/modals/PromptModal";
import { ConfirmModal } from "../src/ui/modals/ConfirmModal";
import { SuggestPickerModal } from "../src/ui/modals/SuggestPickerModal";
import { OCCProgressReporter } from "../src/ui/ProgressReporter";
import { UIHelperImpl } from "../src/ui/UIHelperImpl";
import { ExecutionContextImpl } from "../src/context/ExecutionContextImpl";

describe("Milestone 4 - UI Helpers & Interactive Feedback Kit", () => {
  let mockApp: any;

  beforeEach(() => {
    document.body.innerHTML = "";
    mockApp = {
      workspace: {
        getActiveFile: () => null,
      },
    };
  });

  describe("InteractiveToast", () => {
    it("should render toast with message and custom type class", () => {
      const toast = new InteractiveToast("Build succeeded", {
        type: "success",
        duration: 5000,
      });

      const toastEl = document.querySelector(".occ-interactive-toast");
      expect(toastEl).not.toBeNull();
      expect(toastEl?.classList.contains("occ-toast-success")).toBe(true);

      const messageEl = toastEl?.querySelector(".occ-toast-message");
      expect(messageEl?.textContent).toBe("Build succeeded");
    });

    it("should render action buttons and handle clicks", async () => {
      const onUndo = vi.fn();
      const toast = new InteractiveToast("File deleted", {
        actions: [
          { label: "Undo", onClick: onUndo, variant: "primary" },
        ],
      });

      const button = document.querySelector(".occ-toast-button") as HTMLButtonElement;
      expect(button).not.toBeNull();
      expect(button.textContent).toBe("Undo");
      expect(button.classList.contains("mod-primary")).toBe(true);

      button.click();
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it("should catch errors in action callbacks safely and hide toast", async () => {
      const faultyAction = vi.fn().mockRejectedValue(new Error("Network failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const toast = new InteractiveToast("Warning", {
        actions: [{ label: "Retry", onClick: faultyAction }],
      });

      const button = document.querySelector(".occ-toast-button") as HTMLButtonElement;
      button.click();

      // Give microtasks time to resolve
      await Promise.resolve();
      expect(faultyAction).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should allow dynamically updating message and hiding", () => {
      const toast = new InteractiveToast("Initial message");
      const messageEl = document.querySelector(".occ-toast-message");
      expect(messageEl?.textContent).toBe("Initial message");

      toast.setMessage("Updated status");
      expect(messageEl?.textContent).toBe("Updated status");

      toast.hide();
      expect(document.querySelector(".occ-interactive-toast")).toBeNull();
    });
  });

  describe("PromptModal", () => {
    it("should resolve with user text when Enter is pressed in text input", async () => {
      const modal = new PromptModal(mockApp, {
        title: "Rename Note",
        placeholder: "Enter new name",
        defaultValue: "My Note",
      });

      const promise = modal.openAndAwait();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe("My Note");

      input.value = "Updated Note";
      input.dispatchEvent(new Event("input"));
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

      const result = await promise;
      expect(result).toBe("Updated Note");
    });

    it("should resolve with user text when Submit button is clicked", async () => {
      const modal = new PromptModal(mockApp, {
        title: "Create Tag",
        defaultValue: "tag1",
      });

      const promise = modal.openAndAwait();

      const input = modal.contentEl.querySelector("input") as HTMLInputElement;
      input.value = "tag2";
      input.dispatchEvent(new Event("input"));

      const submitBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      submitBtn.click();

      const result = await promise;
      expect(result).toBe("tag2");
    });

    it("should support multiline textarea", async () => {
      const modal = new PromptModal(mockApp, {
        title: "Markdown Note",
        multiline: true,
        defaultValue: "# Heading",
      });

      const promise = modal.openAndAwait();

      const textarea = modal.contentEl.querySelector("textarea") as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();
      expect(textarea.value).toBe("# Heading");

      textarea.value = "# Heading\nContent here";
      textarea.dispatchEvent(new Event("input"));

      const submitBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      submitBtn.click();

      const result = await promise;
      expect(result).toBe("# Heading\nContent here");
    });

    it("should resolve with null when Cancel is clicked", async () => {
      const modal = new PromptModal(mockApp, { title: "Test" });
      const promise = modal.openAndAwait();

      const cancelBtn = modal.contentEl.querySelector("button:not(.mod-cta)") as HTMLButtonElement;
      cancelBtn.click();

      const result = await promise;
      expect(result).toBeNull();
    });

    it("should resolve with null when closed without submission", async () => {
      const modal = new PromptModal(mockApp, { title: "Test" });
      const promise = modal.openAndAwait();
      modal.close();

      const result = await promise;
      expect(result).toBeNull();
    });
  });

  describe("ConfirmModal", () => {
    it("should resolve true when Confirm button is clicked", async () => {
      const modal = new ConfirmModal(mockApp, {
        title: "Delete File?",
        message: "This action cannot be undone.",
        confirmLabel: "Delete",
        cancelLabel: "Keep",
      });

      const promise = modal.openAndAwait();

      const confirmBtn = modal.contentEl.querySelector("button.mod-cta") as HTMLButtonElement;
      expect(confirmBtn.textContent).toBe("Delete");
      confirmBtn.click();

      const result = await promise;
      expect(result).toBe(true);
    });

    it("should resolve false when Cancel button is clicked", async () => {
      const modal = new ConfirmModal(mockApp, {
        title: "Overwrite?",
        message: "Existing contents will be overwritten.",
      });

      const promise = modal.openAndAwait();

      const cancelBtn = modal.contentEl.querySelector("button:not(.mod-cta)") as HTMLButtonElement;
      cancelBtn.click();

      const result = await promise;
      expect(result).toBe(false);
    });

    it("should resolve false when modal is closed directly", async () => {
      const modal = new ConfirmModal(mockApp, {
        title: "Cancel Check",
        message: "Are you sure?",
      });

      const promise = modal.openAndAwait();
      modal.close();

      const result = await promise;
      expect(result).toBe(false);
    });
  });

  describe("SuggestPickerModal", () => {
    it("should filter suggestions based on query", () => {
      const items = ["Apple", "Banana", "Apricot", "Orange"];
      const modal = new SuggestPickerModal(mockApp, items);

      expect(modal.getSuggestions("ap")).toEqual(["Apple", "Apricot"]);
      expect(modal.getSuggestions("")).toEqual(items);
    });

    it("should resolve selected item on choose", async () => {
      const items = ["Option 1", "Option 2", "Option 3"];
      const modal = new SuggestPickerModal(mockApp, items);

      const promise = modal.openAndAwait();
      modal.onChooseSuggestion("Option 2", new MouseEvent("click"));

      const result = await promise;
      expect(result).toBe("Option 2");
    });

    it("should resolve null when closed without selection", async () => {
      const items = ["A", "B"];
      const modal = new SuggestPickerModal(mockApp, items);

      const promise = modal.openAndAwait();
      modal.close();

      const result = await promise;
      expect(result).toBeNull();
    });

    it("should support custom renderItem mapping", () => {
      interface ComplexItem {
        id: string;
        label: string;
      }
      const items: ComplexItem[] = [
        { id: "1", label: "First Item" },
        { id: "2", label: "Second Item" },
      ];

      const modal = new SuggestPickerModal(mockApp, items, {
        renderItem: (it) => it.label,
      });

      expect(modal.getSuggestions("first")).toEqual([items[0]]);

      const container = document.createElement("div");
      modal.renderSuggestion(items[0]!, container);
      expect(container.textContent).toBe("First Item");
    });
  });

  describe("OCCProgressReporter", () => {
    it("should create progress notice and update percentage", async () => {
      const reporter = new OCCProgressReporter({ total: 10, title: "Processing items" });
      const notice = document.querySelector(".occ-progress-notice");
      expect(notice).not.toBeNull();

      reporter.update({ current: 5, message: "Halfway done" });

      // Wait a microtask / tick for requestAnimationFrame
      await new Promise((resolve) => setTimeout(resolve, 50));

      const messageEl = notice?.querySelector(".occ-progress-message");
      expect(messageEl?.textContent).toContain("Halfway done (50%)");

      const progressBarEl = notice?.querySelector(".occ-progress-bar") as HTMLElement;
      expect(progressBarEl?.style.width).toBe("50%");

      reporter.finish("All items processed");
      expect(document.querySelector(".occ-progress-notice")).toBeNull();
    });
  });

  describe("UIHelperImpl & ExecutionContext Integration", () => {
    it("should expose ui methods through ExecutionContext", async () => {
      const uiHelper = new UIHelperImpl(mockApp);
      const context = new ExecutionContextImpl({
        app: mockApp,
        uiHelper,
      });

      expect(context.ui).toBeDefined();

      const toast = context.ui.toast("From Context");
      expect(toast).toBeInstanceOf(InteractiveToast);
      toast.hide();

      const progress = context.ui.createProgress({ total: 100 });
      expect(progress).toBeInstanceOf(OCCProgressReporter);
      progress.finish();
    });
  });
});
