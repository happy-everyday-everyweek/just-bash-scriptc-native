import { describe, expect, it } from "vitest";
import { createLazyCommands } from "../commands/registry.js";

describe("registry probe", () => {
  it("reports how many commands the registry builds", () => {
    let count = -1;
    let error = "";
    try {
      count = createLazyCommands().length;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    console.log("REGISTRY_COUNT", count, "ERROR", error);
    expect(count).toBeGreaterThan(10);
  });
});