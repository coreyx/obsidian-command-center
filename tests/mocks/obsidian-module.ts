export class Notice {
  constructor(public message: string | DocumentFragment, public duration?: number) {}
  hide(): void {}
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
  containerEl: any = {
    empty: () => {},
    createEl: () => ({ createEl: () => ({}) }),
  };
  constructor(public app: any, public plugin: any) {}
  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(public containerEl: any) {}
  setName(name: string): this {
    return this;
  }
  setDesc(desc: string): this {
    return this;
  }
  addText(cb: (text: any) => any): this {
    cb({
      setPlaceholder: () => ({ setValue: () => ({ onChange: () => ({}) }) }),
      setValue: () => ({ onChange: () => ({}) }),
      onChange: () => ({}),
    });
    return this;
  }
  addButton(cb: (btn: any) => any): this {
    cb({
      setButtonText: () => ({ onClick: () => ({}) }),
      onClick: () => ({}),
    });
    return this;
  }
}

export class Modal {
  constructor(public app: any) {}
  open(): void {}
  close(): void {}
}

export class SuggestModal {
  constructor(public app: any) {}
  open(): void {}
  close(): void {}
}
