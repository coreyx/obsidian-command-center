import type { App } from "obsidian";
import type {
  ConfirmOptions,
  InteractiveToastHandle,
  OCCUIHelper,
  ProgressOptions,
  ProgressReporter,
  PromptOptions,
  SuggestOptions,
  ToastOptions,
} from "../types/context";
import { InteractiveToast } from "./InteractiveToast";
import { PromptModal } from "./modals/PromptModal";
import { ConfirmModal } from "./modals/ConfirmModal";
import { SuggestPickerModal } from "./modals/SuggestPickerModal";
import { OCCProgressReporter } from "./ProgressReporter";

export class UIHelperImpl implements OCCUIHelper {
  constructor(private app: App) {}

  toast(message: string, options?: ToastOptions): InteractiveToastHandle {
    return new InteractiveToast(message, options);
  }

  async prompt(options: PromptOptions): Promise<string | null> {
    const modal = new PromptModal(this.app, options);
    return modal.openAndAwait();
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    const modal = new ConfirmModal(this.app, options);
    return modal.openAndAwait();
  }

  async suggest<T>(items: T[], options?: SuggestOptions<T>): Promise<T | null> {
    const modal = new SuggestPickerModal<T>(this.app, items, options);
    return modal.openAndAwait();
  }

  createProgress(options?: ProgressOptions): ProgressReporter {
    return new OCCProgressReporter(options);
  }
}
