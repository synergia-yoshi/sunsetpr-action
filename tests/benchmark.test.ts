import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runBenchmark } from "../src/benchmark.js";
import { loadDatabase } from "../src/database.js";

test("meets the published detection benchmark thresholds", async () => {
  const fixtureRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../fixtures/benchmark",
  );
  const result = await runBenchmark(fixtureRoot, await loadDatabase());
  assert.equal(result.passed, true, JSON.stringify(result, null, 2));
  assert.ok(result.recall >= 0.95);
  assert.ok(result.falsePositiveRate < 0.05);
});
