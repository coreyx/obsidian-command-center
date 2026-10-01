import { describe, it, expect, beforeEach } from "vitest";
import { MockApp } from "./mocks/obsidian";
import { CommandScanner } from "../src/core/CommandScanner";

describe("CommandScanner", () => {
  let app: MockApp;
  let scanner: CommandScanner;

  beforeEach(() => {
    app = new MockApp();
    scanner = new CommandScanner(app as any);
  });

  it("should create directory if it does not exist and return empty array", async () => {
    const descriptors = await scanner.scan("commands");
    expect(descriptors).toEqual([]);
    expect(await app.vault.adapter.exists("commands")).toBe(true);
  });

  it("should discover single-file scripts and json macros", async () => {
    await app.vault.adapter.mkdir("commands");
    await app.vault.adapter.write("commands/test1.js", "// js script");
    await app.vault.adapter.write("commands/test2.mjs", "// mjs script");
    await app.vault.adapter.write("commands/macro.json", "{}");
    await app.vault.adapter.write("commands/ignored.txt", "text");
    await app.vault.adapter.write("commands/.hidden.js", "hidden");
    await app.vault.adapter.write("commands/types.d.ts", "typescript types");

    const descriptors = await scanner.scan("commands");

    expect(descriptors.length).toBe(3);
    const filenames = descriptors.map((d) => d.filename);
    expect(filenames).toContain("test1.js");
    expect(filenames).toContain("test2.mjs");
    expect(filenames).toContain("macro.json");
  });

  it("should discover folder-bundled commands containing command.js or index.js", async () => {
    await app.vault.adapter.mkdir("commands");
    await app.vault.adapter.mkdir("commands/my-bundle");
    await app.vault.adapter.write("commands/my-bundle/command.js", "// bundle script");
    await app.vault.adapter.write("commands/my-bundle/helper.js", "// helper");

    const descriptors = await scanner.scan("commands");

    expect(descriptors.length).toBe(1);
    expect(descriptors[0]).toEqual({
      path: "commands/my-bundle/command.js",
      filename: "my-bundle",
      extension: "js",
      isDirectoryBundle: true,
    });
  });

  it("should recursively traverse subdirectories if not a bundle", async () => {
    await app.vault.adapter.mkdir("commands");
    await app.vault.adapter.mkdir("commands/nested");
    await app.vault.adapter.write("commands/nested/deep-command.js", "// deep");

    const descriptors = await scanner.scan("commands");
    expect(descriptors.length).toBe(1);
    expect(descriptors[0]?.filename).toBe("deep-command.js");
  });
});
