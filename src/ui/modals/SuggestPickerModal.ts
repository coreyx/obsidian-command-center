import { App, SuggestModal } from "obsidian";
import type { SuggestOptions } from "../../types/context";

export class SuggestPickerModal<T> extends SuggestModal<T> {
  private resolve!: (value: T | null) => void;
  private selected = false;

  constructor(
    app: App,
    private items: T[],
    private options?: SuggestOptions<T>
  ) {
    super(app);
    if (this.options?.placeholder) {
      this.setPlaceholder(this.options.placeholder);
    }
  }

  openAndAwait(): Promise<T | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }

  getSuggestions(query: string): T[] {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return this.items;

    return this.items.filter((item) => {
      const text = this.getItemText(item).toLowerCase();
      return text.includes(cleanQuery);
    });
  }

  renderSuggestion(item: T, el: HTMLElement): void {
    el.empty();
    el.createEl("span", { text: this.getItemText(item) });
  }

  onChooseSuggestion(item: T, _evt: MouseEvent | KeyboardEvent): void {
    this.selected = true;
    this.resolve(item);
  }

  onClose(): void {
    if (!this.selected) {
      this.resolve(null);
    }
  }

  private getItemText(item: T): string {
    if (this.options?.renderItem) {
      return this.options.renderItem(item);
    }
    if (typeof item === "string") {
      return item;
    }
    if (item && typeof item === "object") {
      const candidate = (item as any).name || (item as any).title || (item as any).id;
      if (candidate) return String(candidate);
    }
    return String(item);
  }
}
