if (typeof HTMLElement !== "undefined") {
  const proto = HTMLElement.prototype as any;
  if (!proto.addClass) {
    proto.addClass = function (...classes: string[]) {
      this.classList.add(...classes);
      return this;
    };
  }
  if (!proto.removeClass) {
    proto.removeClass = function (...classes: string[]) {
      this.classList.remove(...classes);
      return this;
    };
  }
  if (!proto.empty) {
    proto.empty = function () {
      this.innerHTML = "";
      return this;
    };
  }
  if (!proto.createEl) {
    proto.createEl = function (tag: string, opt?: any) {
      const child = document.createElement(tag);
      if (opt?.text) child.textContent = opt.text;
      if (opt?.cls) child.className = opt.cls;
      if (opt?.placeholder) (child as any).placeholder = opt.placeholder;
      this.appendChild(child);
      return child;
    };
  }
  if (!proto.createDiv) {
    proto.createDiv = function (opt?: any) {
      return this.createEl("div", opt);
    };
  }
  if (!proto.createSpan) {
    proto.createSpan = function (opt?: any) {
      return this.createEl("span", opt);
    };
  }
}

export class Notice {
  public noticeEl: HTMLElement;
  constructor(public message: string | DocumentFragment, public duration?: number) {
    this.noticeEl = document.createElement("div");
    this.noticeEl.className = "notice";
    if (typeof message === "string") {
      this.noticeEl.textContent = message;
    } else if (message) {
      this.noticeEl.appendChild(message);
    }
    document.body?.appendChild(this.noticeEl);
  }
  hide(): void {
    if (this.noticeEl.parentElement) {
      this.noticeEl.remove();
    }
  }
}

export class Plugin {
  app: any;
  manifest: any = { id: "obsidian-command-center", name: "Command Center" };
  constructor(app: any, manifest: any) {
    this.app = app;
    if (manifest) this.manifest = manifest;
  }
  addCommand(cmd: any): any {
    return cmd;
  }
  addSettingTab(tab: any): any {
    return tab;
  }
  async loadData(): Promise<any> {
    return {};
  }
  async saveData(data: any): Promise<void> {}
}

export class PluginSettingTab {
  containerEl: HTMLElement;
  constructor(public app: any, public plugin: any) {
    this.containerEl = document.createElement("div");
    this.setupElementHelpers(this.containerEl);
  }
  display(): void {}
  hide(): void {}

  private setupElementHelpers(el: any): void {
    el.empty = () => { el.innerHTML = ""; };
    el.createEl = (tag: string, opt?: any) => {
      const child = document.createElement(tag);
      if (opt?.text) child.textContent = opt.text;
      if (opt?.cls) child.className = opt.cls;
      el.appendChild(child);
      this.setupElementHelpers(child);
      return child;
    };
    el.createDiv = (opt?: any) => el.createEl("div", opt);
  }
}

export class Setting {
  public settingEl: HTMLElement;
  constructor(public containerEl: any) {
    this.settingEl = document.createElement("div");
    this.settingEl.className = "setting-item";
    containerEl.appendChild(this.settingEl);
  }
  setName(name: string): this {
    return this;
  }
  setDesc(desc: string): this {
    return this;
  }
  addText(cb: (text: any) => any): this {
    const inputEl = document.createElement("input");
    inputEl.type = "text";
    this.settingEl.appendChild(inputEl);
    const textComponent: any = {
      inputEl,
      setPlaceholder: (p: string) => {
        inputEl.placeholder = p;
        return textComponent;
      },
      setValue: (v: string) => {
        inputEl.value = v;
        return textComponent;
      },
      onChange: (fn: (val: string) => void) => {
        inputEl.addEventListener("input", (e) => fn((e.target as HTMLInputElement).value));
        return textComponent;
      },
    };
    cb(textComponent);
    return this;
  }
  addButton(cb: (btn: any) => any): this {
    const buttonEl = document.createElement("button");
    this.settingEl.appendChild(buttonEl);
    cb({
      buttonEl,
      setButtonText: (t: string) => {
        buttonEl.textContent = t;
        return { onClick: () => ({}) };
      },
      onClick: (fn: () => void) => {
        buttonEl.addEventListener("click", fn);
      },
    });
    return this;
  }
}

export class Modal {
  public contentEl: HTMLElement;
  constructor(public app: any) {
    this.contentEl = document.createElement("div");
    this.contentEl.className = "modal-content";
    this.setupElementHelpers(this.contentEl);
  }

  open(): void {
    if (typeof (this as any).onOpen === "function") {
      (this as any).onOpen();
    }
  }

  close(): void {
    if (typeof (this as any).onClose === "function") {
      (this as any).onClose();
    }
  }

  private setupElementHelpers(el: any): void {
    el.empty = () => { el.innerHTML = ""; };
    el.addClass = (cls: string) => el.classList.add(cls);
    el.createEl = (tag: string, opt?: any) => {
      const child = document.createElement(tag);
      if (opt?.text) child.textContent = opt.text;
      if (opt?.cls) child.className = opt.cls;
      el.appendChild(child);
      this.setupElementHelpers(child);
      return child;
    };
    el.createDiv = (opt?: any) => el.createEl("div", opt);
  }
}

export class SuggestModal<T> {
  public placeholder = "";
  public contentEl: HTMLElement;
  constructor(public app: any) {
    this.contentEl = document.createElement("div");
  }

  setPlaceholder(p: string): void {
    this.placeholder = p;
  }

  open(): void {
    if (typeof (this as any).onOpen === "function") {
      (this as any).onOpen();
    }
  }

  close(): void {
    if (typeof (this as any).onClose === "function") {
      (this as any).onClose();
    }
  }
}
