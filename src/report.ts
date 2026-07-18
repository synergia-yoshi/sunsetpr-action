import path from "node:path";
import type { MigrationReport, ScanReport, VerificationStep } from "./types.js";

function escapeTable(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function inlineCode(value: string): string {
  const oneLine = [...value]
    .map((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code <= 31 || code === 127 ? " " : character;
    })
    .join("");
  const safe = oneLine.replaceAll("`", "ˋ").replaceAll("@", "@\u200b");
  return `\`${safe}\``;
}

function verificationTable(steps: VerificationStep[]): string {
  return steps
    .map(
      (step) =>
        `| ${escapeTable(step.name)} | ${step.status} | \`${escapeTable(step.command)}\` | ${step.durationMs} ms |`,
    )
    .join("\n");
}

export function renderScanText(report: ScanReport): string {
  const lines = [
    `SunsetPR scanned ${report.filesScanned} files (${report.summary.filesSkipped} skipped): ${report.summary.modelReferences} model reference(s), ${report.summary.runtimeChecks} runtime check(s).`,
  ];
  for (const limitation of report.limitations) {
    lines.push(`LIMIT ${limitation.path} ${limitation.reason}`);
  }
  for (const finding of report.findings) {
    if (finding.kind === "model_reference") {
      lines.push(
        `${finding.status === "retired" ? "ERROR" : "WARN"} ${finding.location.path}:${finding.location.line}:${finding.location.column} ${finding.modelId} -> ${finding.replacement} (${finding.shutdownDate}, ${finding.confidence})`,
      );
    } else {
      lines.push(
        `CHECK ${finding.location.path}:${finding.location.line}:${finding.location.column} ${finding.message}`,
      );
    }
  }
  return lines.join("\n");
}

export function renderPrBody(report: MigrationReport): string {
  const modelFindings = report.initialScan.findings.filter(
    (finding) => finding.kind === "model_reference",
  );
  const uniqueEvidence = new Map(
    modelFindings.map((finding) => [
      finding.modelId,
      {
        modelId: finding.modelId,
        replacement: finding.replacement,
        shutdownDate: finding.shutdownDate,
        sourceUrl: finding.sourceUrl,
        detectionConfidence: finding.confidence,
        replacementConfidence: finding.replacementConfidence,
      },
    ]),
  );
  const evidenceRows = [...uniqueEvidence.values()]
    .map(
      (item) =>
        `| \`${item.modelId}\` | \`${item.replacement}\` | ${item.shutdownDate} | ${item.detectionConfidence} | ${item.replacementConfidence} | [official source](${item.sourceUrl}) |`,
    )
    .join("\n");
  const editedFiles = [...new Set(report.edits.map((edit) => edit.path))];
  const compatibilityTestFile = report.compatibilityTestPath
    ? path.relative(report.root, report.compatibilityTestPath).split(path.sep).join("/")
    : null;
  const changedFiles = [...editedFiles, ...(compatibilityTestFile ? [compatibilityTestFile] : [])];
  const failed = report.verification.filter((step) => step.status === "failed");
  const skipped = report.verification.filter((step) => step.status === "skipped");

  return `## SunsetPR migration

This is an automatically generated **draft**. It is never eligible for automatic merge.

### Outcome

- Disposition: **${report.disposition}**
- Changed ${report.edits.length} model reference(s) in ${editedFiles.length} source/config file(s).
- Added ${compatibilityTestFile ? `generated migration invariants in ${inlineCode(compatibilityTestFile)}` : "no generated migration invariants"}.
- Verification result: ${failed.length === 0 ? `all executed checks passed${skipped.length > 0 ? `; ${skipped.length} check(s) skipped` : ""}` : `${failed.length} check(s) failed`}.
- Generated migration invariants do not prove live model behavior.

### Official evidence

| Deprecated model | Recommended replacement | Shutdown date | Detection | Replacement | Evidence |
| --- | --- | --- | --- | --- | --- |
${evidenceRows || "| — | — | — | — | — | — |"}

### Changed files

${changedFiles.length > 0 ? changedFiles.map((file) => `- ${inlineCode(file)}`).join("\n") : "- No safe automatic edit was available."}

### Verification

| Check | Result | Command | Duration |
| --- | --- | --- | --- |
${verificationTable(report.verification)}

### Unconfirmed / requires review

${report.unconfirmed.length > 0 ? report.unconfirmed.map((item) => `- ${item}`).join("\n") : "- No statically unresolved model expressions were found."}
${report.initialScan.limitations.length > 0 ? `\n### Scan limitations\n\n${report.initialScan.limitations.map((limitation) => `- ${inlineCode(limitation.path)}: ${limitation.reason}`).join("\n")}` : ""}
${skipped.length > 0 ? `\n### Skipped checks\n\n${skipped.map((step) => `- **${step.name}:** ${step.output}`).join("\n")}` : ""}

### Safety

- No secrets or environment values were read into this report.
- No customer code was sent to an external model.
- No merge or deployment action was attempted.
- Review behavior, quality, cost, rate limits, and live API responses before merging.
`;
}
