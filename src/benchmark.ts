import { readFile } from "node:fs/promises";
import path from "node:path";
import { scanRepository } from "./scanner.js";
import type {
  BenchmarkManifest,
  BenchmarkResult,
  LifecycleDatabase,
  ModelFinding,
} from "./types.js";

function key(pathValue: string, line: number, modelId: string): string {
  return `${pathValue}:${line}:${modelId}`;
}

export async function runBenchmark(
  fixtureRoot: string,
  database: LifecycleDatabase,
): Promise<BenchmarkResult> {
  const manifest = JSON.parse(
    await readFile(path.join(fixtureRoot, "benchmark-manifest"), "utf8"),
  ) as BenchmarkManifest;
  const report = await scanRepository(fixtureRoot, database);
  const findings = report.findings.filter(
    (finding): finding is ModelFinding => finding.kind === "model_reference",
  );
  const actual = new Set(
    findings.map((finding) => key(finding.location.path, finding.location.line, finding.modelId)),
  );
  const expected = new Set(
    manifest.positives.map((positive) => key(positive.path, positive.line, positive.modelId)),
  );
  const missing = [...expected].filter((item) => !actual.has(item));
  const unexpected = [...actual].filter((item) => !expected.has(item));
  const negativePaths = new Set(manifest.negatives.map((negative) => negative.path));
  const falsePositives = findings.filter((finding) =>
    negativePaths.has(finding.location.path),
  ).length;
  const truePositives = expected.size - missing.length;
  const falseNegatives = missing.length;
  const trueNegatives = Math.max(0, manifest.negatives.length - falsePositives);
  const recall = expected.size === 0 ? 1 : truePositives / expected.size;
  const falsePositiveRate =
    manifest.negatives.length === 0 ? 0 : falsePositives / manifest.negatives.length;
  return {
    truePositives,
    falseNegatives,
    falsePositives,
    trueNegatives,
    recall,
    falsePositiveRate,
    passed: recall >= 0.95 && falsePositiveRate < 0.05 && unexpected.length === 0,
    missing,
    unexpected,
  };
}
