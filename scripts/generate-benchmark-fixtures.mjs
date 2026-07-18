import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve("fixtures/benchmark");
const checkOnly = process.argv.includes("--check");
const database = JSON.parse(await readFile("data/lifecycle.json", "utf8"));
const manifestPath = path.join(root, "benchmark-manifest");
const existingManifest = JSON.parse(await readFile(manifestPath, "utf8"));
const generatedPaths = new Set([
  "positives/generated.ts",
  "positives/generated.py",
  "negatives/generated.ts",
  "negatives/generated.py",
]);
const positives = existingManifest.positives.filter(
  (entry) => !generatedPaths.has(entry.path),
);
const negatives = existingManifest.negatives.filter(
  (entry) => !generatedPaths.has(entry.path),
);
const positiveTypeScript = [];
const positivePython = [];
const negativeTypeScript = [];
const negativePython = [];

for (const [index, entry] of database.entries.entries()) {
  const sequence = String(index + 1).padStart(3, "0");
  positiveTypeScript.push(`const provider_model_${sequence} = ${JSON.stringify(entry.modelId)};`);
  positivePython.push(`provider_model_${sequence} = ${JSON.stringify(entry.modelId)}`);
  negativeTypeScript.push(
    `const documentation_example_${sequence} = ${JSON.stringify(entry.modelId)};`,
  );
  negativePython.push(`display_label_${sequence} = ${JSON.stringify(entry.modelId)}`);
  positives.push(
    {
      path: "positives/generated.ts",
      line: index + 1,
      modelId: entry.modelId,
    },
    {
      path: "positives/generated.py",
      line: index + 1,
      modelId: entry.modelId,
    },
  );
  negatives.push(
    {
      path: "negatives/generated.ts",
      description: `unrelated documentation string for ${entry.modelId}`,
    },
    {
      path: "negatives/generated.py",
      description: `unrelated display label for ${entry.modelId}`,
    },
  );
}

const expectedFiles = new Map([
  ["positives/generated.ts", `${positiveTypeScript.join("\n")}\n`],
  ["positives/generated.py", `${positivePython.join("\n")}\n`],
  ["negatives/generated.ts", `${negativeTypeScript.join("\n")}\n`],
  ["negatives/generated.py", `${negativePython.join("\n")}\n`],
  ["benchmark-manifest", `${JSON.stringify({ positives, negatives }, null, 2)}\n`],
]);

if (checkOnly) {
  const stale = [];
  for (const [relativePath, expected] of expectedFiles) {
    let actual;
    try {
      actual = await readFile(path.join(root, relativePath), "utf8");
    } catch {
      stale.push(relativePath);
      continue;
    }
    if (actual !== expected) {
      stale.push(relativePath);
    }
  }
  if (stale.length > 0) {
    throw new Error(
      `Benchmark fixtures are stale: ${stale.join(", ")}. Run npm run benchmark:generate.`,
    );
  }
  process.stdout.write(
    `Benchmark fixtures are current: ${positives.length} positive and ${negatives.length} negative cases.\n`,
  );
} else {
  await mkdir(path.join(root, "positives"), { recursive: true });
  await mkdir(path.join(root, "negatives"), { recursive: true });
  for (const [relativePath, content] of expectedFiles) {
    await writeFile(path.join(root, relativePath), content, "utf8");
  }
  process.stdout.write(
    `Generated ${positives.length} positive and ${negatives.length} negative benchmark cases.\n`,
  );
}
