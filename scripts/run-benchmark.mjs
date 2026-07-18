import path from "node:path";
import process from "node:process";
import { runBenchmark } from "../dist/src/benchmark.js";
import { loadDatabase } from "../dist/src/database.js";

const result = await runBenchmark(
  path.resolve(process.argv[2] ?? "fixtures/benchmark"),
  await loadDatabase(),
);

process.stdout.write(
  `${JSON.stringify(
    {
      ...result,
      recallPercent: `${(result.recall * 100).toFixed(1)}%`,
      falsePositiveRatePercent: `${(result.falsePositiveRate * 100).toFixed(1)}%`,
    },
    null,
    2,
  )}\n`,
);

if (!result.passed) {
  process.exitCode = 1;
}
