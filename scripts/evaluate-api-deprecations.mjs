import { readFile } from "node:fs/promises";
import { analyzeCode } from "../dist/src/analyzer.js";
import { loadDatabase } from "../dist/src/database.js";

const MAX_SOURCE_BYTES = 1_048_576;
const RAW_GITHUB_HOST = "raw.githubusercontent.com";
const manifest = JSON.parse(
  await readFile("validation/api-deprecation-sample.json", "utf8"),
);
const database = await loadDatabase();
const entries = new Map(database.entries.map((entry) => [entry.modelId, entry]));

function rawUrl(repository, commit, filePath) {
  const [owner, name] = repository.split("/");
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  return `https://${RAW_GITHUB_HOST}/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${commit}/${encodedPath}`;
}

async function fetchSource(repository, commit, filePath) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ||
    !/^[a-f0-9]{40}$/i.test(commit) ||
    filePath.startsWith("/") ||
    filePath.split("/").includes("..")
  ) {
    throw new Error("Invalid fixed public-source manifest entry");
  }
  const response = await fetch(rawUrl(repository, commit, filePath), {
    headers: {
      Accept: "text/plain",
      "User-Agent": "SunsetPR-public-evaluation/0.2",
    },
    redirect: "follow",
  });
  const finalUrl = new URL(response.url);
  if (
    !response.ok ||
    finalUrl.protocol !== "https:" ||
    finalUrl.hostname !== RAW_GITHUB_HOST
  ) {
    throw new Error(`Unable to fetch fixed public source (${response.status})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_SOURCE_BYTES) {
    throw new Error("Fixed public source exceeds the evaluation size limit");
  }
  return bytes.toString("utf8");
}

const results = [];
for (const repository of manifest.repositories) {
  for (const file of repository.files) {
    const source = await fetchSource(repository.name, repository.commit, file.path);
    const findings = analyzeCode(
      file.path,
      source,
      entries,
      database.apiDeprecations,
    ).filter(
      (finding) =>
        finding.kind === "api_deprecation" && finding.apiId === "assistants-api",
    );
    results.push({
      repository: repository.name,
      commit: repository.commit,
      path: file.path,
      expected: file.expectedAssistantsFindings,
      actual: findings.length,
      passed: findings.length === file.expectedAssistantsFindings,
    });
  }
}

const totals = results.reduce(
  (summary, result) => {
    summary.files += 1;
    summary.expected += result.expected;
    summary.actual += result.actual;
    if (!result.passed) {
      summary.failedFiles += 1;
    }
    return summary;
  },
  {
    repositories: manifest.repositories.length,
    files: 0,
    expected: 0,
    actual: 0,
    failedFiles: 0,
  },
);
const report = {
  schemaVersion: 1,
  checkedAt: manifest.checkedAt,
  officialSource: manifest.officialSource,
  ...totals,
  passed: totals.failedFiles === 0,
  results,
  limitations: [
    "This is a curated positive engineering sample, not a prevalence, recall, or false-positive estimate.",
    "The evaluation downloads fixed public source files into memory and does not redistribute them.",
  ],
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.passed) {
  process.exitCode = 1;
}
