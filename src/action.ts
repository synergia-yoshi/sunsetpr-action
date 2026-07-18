import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { loadDatabase } from "./database.js";
import { renderScanText } from "./report.js";
import { scanRepository } from "./scanner.js";
import type { Finding, ScanReport } from "./types.js";

const FAIL_THRESHOLDS = new Set(["never", "deprecated", "retired"]);
const REPAIR_BETA_URL =
  "https://github.com/synergia-yoshi/sunsetpr-action/issues/new?template=repair-beta.yml";

async function appendIfConfigured(environmentName: string, content: string): Promise<void> {
  const outputPath = process.env[environmentName];
  if (outputPath) {
    await appendFile(outputPath, content, "utf8");
  }
}

export function escapeSummaryHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "&#64;");
}

function escapeMarkdown(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ")
    .replaceAll("@", "@\u200b");
}

function inlineCode(value: string): string {
  return `\`${escapeMarkdown(value).replaceAll("`", "ˋ")}\``;
}

function workflowCommandValue(value: string): string {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

function workflowCommandMessage(value: string): string {
  return value.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
}

export function resolveReportPath(input: string): string {
  if (/[\r\n]/u.test(input)) {
    throw new Error("Report path must not contain newline characters");
  }
  return path.resolve(input);
}

export function renderAnnotation(finding: Finding): string {
  const level =
    finding.kind === "runtime_check"
      ? "notice"
      : finding.status === "retired"
        ? "error"
        : "warning";
  const title =
    finding.kind === "runtime_check"
      ? "SunsetPR: runtime confirmation required"
      : `SunsetPR: ${finding.provider} model ${finding.status}`;
  const message =
    finding.kind === "runtime_check"
      ? finding.message
      : `${finding.modelId} → ${finding.replacement}; shutdown ${finding.shutdownDate}; replacement confidence ${finding.replacementConfidence}. Official source: ${finding.sourceUrl}`;
  return `::${level} file=${workflowCommandValue(finding.location.path)},line=${finding.location.line},col=${finding.location.column},title=${workflowCommandValue(title)}::${workflowCommandMessage(message)}`;
}

export function renderActionSummary(report: ScanReport): string {
  const modelFindings = report.findings.filter((finding) => finding.kind === "model_reference");
  const rows = modelFindings
    .map(
      (finding) =>
        `| ${finding.status === "retired" ? "🔴 retired" : "🟠 deprecated"} | ${escapeMarkdown(finding.provider)} | ${inlineCode(finding.modelId)} | ${inlineCode(finding.replacement)} | ${finding.shutdownDate} | ${escapeMarkdown(finding.confidence)} | ${escapeMarkdown(finding.replacementConfidence)} | [official](${finding.sourceUrl}) | ${inlineCode(`${finding.location.path}:${finding.location.line}`)} |`,
    )
    .join("\n");
  const runtimeRows = report.findings
    .filter((finding) => finding.kind === "runtime_check")
    .map(
      (finding) =>
        `- ${inlineCode(`${finding.location.path}:${finding.location.line}`)} — ${escapeMarkdown(finding.message)}`,
    )
    .join("\n");
  const limitationRows = report.limitations
    .map((limitation) => `- ${inlineCode(limitation.path)} — ${escapeMarkdown(limitation.reason)}`)
    .join("\n");

  return `## SunsetPR model lifecycle check

${modelFindings.length === 0 ? "✅ No known deprecated or retired model IDs were found." : `Found **${modelFindings.length}** model reference(s): **${report.summary.retired} retired**, **${report.summary.deprecated} deprecated**. **${report.summary.safeAutoFixes}** meet both the high-confidence code-context and official-replacement gates.`}

| Status | Provider | Model | Official replacement | Shutdown | Detection confidence | Replacement confidence | Evidence | Location |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${rows || "| ✅ clear | — | — | — | — | — | — | — | — |"}
${runtimeRows ? `\n### Runtime confirmation required\n\nStatic analysis could not resolve these values. SunsetPR does **not** classify them as unaffected.\n\n${runtimeRows}\n` : ""}
${limitationRows ? `\n### Scan limitations\n\n${limitationRows}\n` : ""}
### Scope and data handling

- Scanned ${report.filesScanned} TypeScript, JavaScript, Python, and supported config file(s) locally on this runner.
- Model values that are dynamic or environment-backed remain explicitly unconfirmed.
- No repository code or environment values are sent to SunsetPR or to an external AI model.
- SunsetPR Action **v${report.toolVersion}**; lifecycle database checked **${report.databaseCheckedAt}** against provider documentation.
${modelFindings.length > 0 ? `\n[Request an evidence-backed draft repair PR](${REPAIR_BETA_URL}) — early access; no automatic merge.\n` : ""}
`;
}

export async function main(): Promise<void> {
  const root = path.resolve(process.env.INPUT_PATH ?? ".");
  const reportPath = resolveReportPath(process.env.INPUT_REPORT ?? ".sunsetpr/report.json");
  const failOn = process.env["INPUT_FAIL-ON"] ?? "never";
  if (!FAIL_THRESHOLDS.has(failOn)) {
    throw new Error(`Invalid fail-on value "${failOn}"; expected never, deprecated, or retired`);
  }
  const database = await loadDatabase();
  const report = await scanRepository(root, database);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  await appendIfConfigured(
    "GITHUB_OUTPUT",
    `findings=${report.summary.modelReferences}\nruntime-checks=${report.summary.runtimeChecks}\nretired=${report.summary.retired}\ndeprecated=${report.summary.deprecated}\nsafe-auto-fixes=${report.summary.safeAutoFixes}\nreport=${reportPath}\n`,
  );
  await appendIfConfigured("GITHUB_STEP_SUMMARY", renderActionSummary(report));
  for (const finding of report.findings) {
    process.stdout.write(`${renderAnnotation(finding)}\n`);
  }
  process.stdout.write(`${renderScanText(report)}\n`);

  const modelFindings = report.findings.filter((finding) => finding.kind === "model_reference");
  const fails =
    failOn === "retired"
      ? modelFindings.some((finding) => finding.status === "retired")
      : failOn === "never"
        ? false
        : modelFindings.length > 0;
  if (fails) {
    process.exitCode = 2;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    process.stderr.write(`SunsetPR action failed: ${message}\n`);
    process.exitCode = 1;
  });
}
