# Changelog

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
