import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockApp, MockTFile } from "./mocks/obsidian";
import { FileWatcher } from "../src/core/FileWatcher";

describe("FileWatcher", () => {
  let app: MockApp;
  let watcher: FileWatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    app = new MockApp();
    watcher = new FileWatcher(app as any, 100);
  });

  afterEach(() => {
    watcher.stop();
    vi.useRealTimers();
  });

  it("should ignore events outside the watched directory", () => {
    const handler = vi.fn();
    watcher.onEvent(handler);
    watcher.start("commands");

    app.vault.trigger("modify", new MockTFile("other/file.md"));
    vi.advanceTimersByTime(200);

    expect(handler).not.toHaveBeenCalled();
  });

  it("should debounce rapid modify events on the same file", () => {
    const handler = vi.fn();
    watcher.onEvent(handler);
    watcher.start("commands");

    const file = new MockTFile("commands/script.js");
    app.vault.trigger("modify", file);
    vi.advanceTimersByTime(50);
    app.vault.trigger("modify", file);
    vi.advanceTimersByTime(50);
    app.vault.trigger("modify", file);

    // Only after full 100ms quiet period should handler be called once
    vi.advanceTimersByTime(110);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      type: "MODIFY",
      path: "commands/script.js",
    });
  });

  it("should handle create and delete events", () => {
    const handler = vi.fn();
    watcher.onEvent(handler);
    watcher.start("commands");

    app.vault.trigger("create", new MockTFile("commands/new.js"));
    app.vault.trigger("delete", new MockTFile("commands/old.js"));

    vi.advanceTimersByTime(150);

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ type: "CREATE", path: "commands/new.js" });
    expect(handler).toHaveBeenCalledWith({ type: "DELETE", path: "commands/old.js" });
  });
});
