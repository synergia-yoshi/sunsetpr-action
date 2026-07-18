import assert from "node:assert/strict";
import test from "node:test";
import { renderActionSummary } from "../src/action.js";
import { loadDatabase } from "../src/database.js";
import { scanRepository } from "../src/scanner.js";

test("ships a current validated lifecycle database", async () => {
  const database = await loadDatabase();
  assert.equal(database.checkedAt, "2026-07-19");
  assert.equal(database.entries.length, 105);
  assert.equal(new Set(database.entries.map((entry) => entry.modelId)).size, 105);
});

test("detects known IDs and preserves dynamic model uncertainty", async () => {
  const report = await scanRepository("test-fixture", await loadDatabase());
  assert.equal(report.summary.modelReferences, 1);
  assert.equal(report.summary.runtimeChecks, 1);
  assert.equal(report.summary.safeAutoFixes, 1);
  const summary = renderActionSummary(report);
  assert.match(summary, /official/);
  assert.match(summary, /Runtime confirmation required/);
  assert.match(summary, /repair PR/);
});
