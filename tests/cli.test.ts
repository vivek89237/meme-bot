import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execute = promisify(execFile);
const runnerUrl = new URL("../src/cli/run.ts", import.meta.url).href;

test("CLI waits for provider polling even when its timer is unreferenced", async () => {
  const script = `
    import { run } from ${JSON.stringify(runnerUrl)};
    run(async () => {
      await new Promise(resolve => setTimeout(resolve, 30).unref());
      console.log("Command completed");
    });
  `;
  const { stdout } = await execute(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", script],
    { timeout: 10_000 },
  );
  assert.equal(stdout.trim(), "Command completed");
});

test("CLI reports a polling failure with a nonzero exit and releases its keepalive", async () => {
  const script = `
    import { run } from ${JSON.stringify(runnerUrl)};
    run(async () => {
      await new Promise((_, reject) => setTimeout(() => reject(new Error("Provider failed")), 30).unref());
    });
  `;
  await assert.rejects(
    execute(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { timeout: 10_000 },
    ),
    (error: Error & { code?: number; stderr?: string }) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr ?? "", /Provider failed/);
      return true;
    },
  );
});
