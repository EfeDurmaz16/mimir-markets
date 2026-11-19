import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve("scripts/check-tracked-path-case.mjs");

test("checks indexed files and directories without checking out either spelling", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "mimir-path-case-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (args: string[], input?: string) =>
    execFileSync("git", args, { cwd, input, encoding: "utf8" });
  git(["init", "--quiet"]);
  git(["config", "core.ignorecase", "false"]);
  const blob = git(["hash-object", "-w", "--stdin"], "").trim();
  const stage = (paths: string[]) =>
    git(["update-index", "-z", "--index-info"], paths.map((p) => `100644 ${blob}\t${p}\0`).join(""));
  const check = () => spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });

  stage(["docs/b.md", "src/name\nfile.ts"]);
  const clean = check();
  assert.equal(clean.status, 0, clean.stderr);
  assert.equal(clean.stderr, "");

  stage(["src/Name\nfile.ts", "Docs/a.md"]);
  const clash = check();
  assert.equal(clash.status, 1);
  assert.deepEqual(clash.stderr.trimEnd().split(/\r?\n/), [
    'Case-only tracked path collision: "Docs" / "docs"',
    'Case-only tracked path collision: "src/Name\\nfile.ts" / "src/name\\nfile.ts"',
  ]);
});
