import { describe, expect, it } from "vitest";
import { Bash } from "../Bash.js";

describe("command lookup probe", () => {
  it("reports whether the constructed shell can resolve echo", async () => {
    const bash = new Bash();
    const holder = bash as unknown as {
      commands?: { get(name: string): unknown; size?: number };
    };
    const registry = holder.commands;
    if (registry === undefined) {
      console.log("LOOKUP no-registry-field");
    } else {
      console.log("LOOKUP has-echo", registry.get("echo") !== undefined);
      console.log("LOOKUP size", registry.size);
    }
    const result = await bash.exec("echo hi");
    console.log("LOOKUP stdout", JSON.stringify(result.stdout), "code", result.exitCode);
    expect(result.stdout).toBe("hi\n");
  });
});