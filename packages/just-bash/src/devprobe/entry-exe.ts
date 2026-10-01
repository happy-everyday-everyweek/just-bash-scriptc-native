/* just-bash exe-lane entry (dev only, delete after) */
import { Bash } from "../Bash.js";
import "./probe-union.js";

async function main(): Promise<void> {
  const bash = new Bash();
  const r1 = await bash.exec("echo hello | wc -c");
  console.log("R1[" + r1.exitCode + "]:" + r1.stdout.trim());
  const r2 = await bash.exec(
    "mkdir -p /tmp/x && echo data > /tmp/x/a.txt && cat /tmp/x/a.txt",
  );
  console.log("R2[" + r2.exitCode + "]:" + r2.stdout.trim());
  const r3 = await bash.exec("ls /tmp/x");
  console.log("R3[" + r3.exitCode + "]:" + r3.stdout.trim());
  console.log("DONE");
}
void main();
