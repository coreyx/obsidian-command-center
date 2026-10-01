export class MockTFile {
  constructor(public path: string, public name: string = path.split("/").pop() || "") {}
}

export class MockDataAdapter {
  public files = new Map<string, string>();
  public directories = new Set<string>();
  public basePath = "/vault";

  getBasePath(): string {
    return this.basePath;
  }

  async exists(normalizedPath: string): Promise<boolean> {
    const clean = normalizedPath.replace(/\\/g, "/").replace(/\/$/, "");
    if (this.directories.has(clean)) return true;
    for (const key of this.files.keys()) {
      if (key === clean || key.startsWith(clean + "/")) return true;
    }
    return false;
  }

  async mkdir(normalizedPath: string): Promise<void> {
    const clean = normalizedPath.replace(/\\/g, "/").replace(/\/$/, "");
    this.directories.add(clean);
  }

  async read(normalizedPath: string): Promise<string> {
    const clean = normalizedPath.replace(/\\/g, "/");
    const content = this.files.get(clean);
    if (content === undefined) {
      throw new Error(`File not found: ${normalizedPath}`);
    }
    return content;
  }

  async write(normalizedPath: string, data: string): Promise<void> {
    const clean = normalizedPath.replace(/\\/g, "/");
    this.files.set(clean, data);
  }

  async list(normalizedPath: string): Promise<{ files: string[]; folders: string[] }> {
    const clean = normalizedPath.replace(/\\/g, "/").replace(/\/$/, "");
    const files: string[] = [];
    const folders = new Set<string>();

    for (const f of this.files.keys()) {
      if (f.startsWith(clean + "/")) {
        const rest = f.slice(clean.length + 1);
        if (rest.includes("/")) {
          folders.add(`${clean}/${rest.split("/")[0]}`);
        } else {
          files.push(f);
        }
      }
    }

    for (const d of this.directories) {
      if (d.startsWith(clean + "/") && d !== clean) {
        const rest = d.slice(clean.length + 1);
        if (!rest.includes("/")) {
          folders.add(d);
        }
      }
    }

    return { files, folders: Array.from(folders) };
  }
}

export class MockVault {
  public adapter = new MockDataAdapter();
  private tfiles = new Map<string, MockTFile>();

  async read(file: any): Promise<string> {
    return this.adapter.read(file.path);
  }

  async modify(file: any, content: string): Promise<void> {
    await this.adapter.write(file.path, content);
  }

  async create(path: string, content: string): Promise<MockTFile> {
    await this.adapter.write(path, content);
    const tfile = new MockTFile(path);
    this.tfiles.set(path, tfile);
    return tfile;
  }

  private listeners = new Map<string, Set<Function>>();

  on(event: string, callback: Function): any {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return { event, callback };
  }

  offref(ref: any): void {
    if (ref && ref.event && this.listeners.has(ref.event)) {
      this.listeners.get(ref.event)!.delete(ref.callback);
    }
  }

  trigger(event: string, ...args: any[]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        cb(...args);
      }
    }
  }
}

export class MockWorkspace {
  public activeFile: MockTFile | null = null;
  public activeEditor: any = null;

  getActiveFile(): MockTFile | null {
    return this.activeFile;
  }

  getActiveViewOfType(): any {
    if (this.activeEditor) {
      return { editor: this.activeEditor };
    }
    return null;
  }

  onLayoutReady(cb: () => void): void {
    cb();
  }
}

export class MockHotkeyManager {
  public customKeys: Record<string, any[]> = {};
}

export class MockCommandRegistry {
  public commands: Record<string, any> = {};

  executeCommandById(id: string): any {
    const cmd = this.commands[id];
    if (!cmd) throw new Error(`Command ${id} not found`);
    return cmd.callback ? cmd.callback() : null;
  }

  removeCommand(id: string): void {
    delete this.commands[id];
  }
}

export class MockApp {
  public vault = new MockVault();
  public workspace = new MockWorkspace();
  public commands = new MockCommandRegistry();
  public hotkeyManager = new MockHotkeyManager();
  public fileManager: any = null;
}

export class MockPlugin {
  public manifest = { id: "obsidian-command-center", name: "Command Center" };
  private data: any = {};

  constructor(public app: MockApp) {}

  addCommand(command: any): any {
    const fullId = `${this.manifest.id}:${command.id}`;
    const entry = { ...command, id: fullId };
    this.app.commands.commands[fullId] = entry;
    return entry;
  }

  addSettingTab(_tab: any): void {}

  async loadData(): Promise<any> {
    return this.data;
  }

  async saveData(data: any): Promise<void> {
    this.data = data;
  }
}
