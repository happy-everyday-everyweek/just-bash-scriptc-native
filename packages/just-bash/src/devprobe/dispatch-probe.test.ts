import { describe, expect, it } from "vitest";
import { Bash } from "../Bash.js";

describe("dispatch probe", () => {
  it("compares a builtin with a registry command", async () => {
    const bash = new Bash();
    for (const script of ["help", "echo hi", "/bin/echo hi", "pwd"]) {
      const result = await bash.exec(script);
      console.log(
        "DISPATCH",
        JSON.stringify(script),
        "code",
        result.exitCode,
        "stdout",
        JSON.stringify(result.stdout),
        "stderr",
        JSON.stringify(result.stderr),
      );
    }
    expect(true).toBe(true);
  });
});