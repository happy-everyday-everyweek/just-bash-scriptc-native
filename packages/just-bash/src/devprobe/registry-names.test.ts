import { describe, expect, it } from "vitest";
import { createLazyCommands } from "../commands/registry.js";

describe("registry names probe", () => {
  it("lists the command names the registry builds", () => {
    const names: string[] = [];
    for (const command of createLazyCommands()) {
      names.push(command.name);
    }
    console.log("REGISTRY_NAMES", names.join(","));
    console.log("HAS_ECHO", names.indexOf("echo") !== -1);
    expect(names.length).toBeGreaterThan(10);
  });
});