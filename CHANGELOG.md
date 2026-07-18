# Changelog

## 0.1.7 — 2026-07-19

- Recognize the official OpenAI `beta.chat.completions.runTools` helper as a high-confidence SDK context.
- Preserve a runtime-confirmation finding when a model expression combines a literal fallback with a dynamic override.

## 0.1.2 — 2026-07-19

- Add six newly verified OpenAI model snapshots scheduled to shut down on 2026-12-11.
- Require provider-specific official documentation URLs in the lifecycle database.
- Reject high-confidence replacements that are themselves deprecated or retired.
- Route replacement chains to a current endpoint and keep chained migrations report-only.
- Correct the JavaScript Action output metadata contract.

## 0.1.1 — 2026-07-19

- Fix the bundled native AST parser bootstrap on GitHub-hosted Linux runners.
- Validate bundled native and Python parser assets before starting analysis.

## 0.1.0 — 2026-07-19

- Detect 99 exact OpenAI, Anthropic, and Gemini deprecated or retired model IDs and aliases.
- Scan TypeScript, JavaScript, Python, and common configuration formats.
- Add GitHub line annotations, Job Summary evidence tables, and JSON report outputs.
- Mark unresolved dynamic and environment-backed SDK model arguments for runtime confirmation.
- Separate detection confidence from replacement confidence.
- Treat only high-confidence official replacements as safe automatic-fix candidates.
- Run without sending repository code to SunsetPR or an external model.
