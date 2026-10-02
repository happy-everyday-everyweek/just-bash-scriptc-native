import { describe, expect, it } from "vitest";
import { Bash } from "../Bash.js";

describe("output probe", () => {
  it("echo produces stdout", async () => {
    const bash = new Bash();
    const result = await bash.exec("echo hi");
    console.log("PROBE_RESULT", JSON.stringify(result));
    expect(result.stdout).toBe("hi\n");
  });
});