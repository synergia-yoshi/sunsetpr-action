# SunsetPR AI Model Lifecycle Check

[![Test](https://github.com/synergia-yoshi/sunsetpr-action/actions/workflows/test.yml/badge.svg)](https://github.com/synergia-yoshi/sunsetpr-action/actions/workflows/test.yml)
[![Official source monitor](https://github.com/synergia-yoshi/sunsetpr-action/actions/workflows/official-source-monitor.yml/badge.svg)](https://github.com/synergia-yoshi/sunsetpr-action/actions/workflows/official-source-monitor.yml)
[![CodeQL](https://github.com/synergia-yoshi/sunsetpr-action/actions/workflows/codeql.yml/badge.svg)](https://github.com/synergia-yoshi/sunsetpr-action/actions/workflows/codeql.yml)
[![Latest release](https://img.shields.io/github/v/release/synergia-yoshi/sunsetpr-action)](https://github.com/synergia-yoshi/sunsetpr-action/releases/latest)
[![License](https://img.shields.io/github/license/synergia-yoshi/sunsetpr-action)](LICENSE)

Catch deprecated OpenAI, Anthropic, and Google Gemini model IDs in CI before their shutdown date.

SunsetPR reports the exact file and line, the provider's recommended replacement, the shutdown date, replacement confidence, and a link to the official provider documentation. Dynamic model selection is never reported as “unaffected”; it is marked for runtime confirmation.

**Proof, not a screenshot:** inspect the [public demo scan workflow](https://github.com/synergia-yoshi/sunsetpr-demo/actions/workflows/sunsetpr.yml) and the [draft repair PR it complements](https://github.com/synergia-yoshi/sunsetpr-demo/pull/2). The PR shows the generated diff, migration invariants, official evidence, skipped checks, and repository CI in public.

## Start in one minute

Create `.github/workflows/model-lifecycle.yml`:

```yaml
name: AI model lifecycle

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "17 3 * * 1"

permissions:
  contents: read

jobs:
  sunsetpr:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: synergia-yoshi/sunsetpr-action@v0
        with:
          fail-on: never
```

The first run adds line annotations and a structured table to the GitHub Actions Job Summary. A machine-readable report is written to `.sunsetpr/report.json`.

## What it detects

- TypeScript, JavaScript, and Python
- hardcoded model IDs in major official SDK call shapes
- model IDs assigned to model-named variables
- `.env`, JSON, YAML, TOML, INI, and CFG model settings
- OpenAI, Anthropic, and Google Gemini entries verified against official provider documentation
- unresolved SDK arguments that require runtime confirmation

The bundled database currently contains 105 exact model IDs and aliases, checked on 2026-07-19. Provider documentation is the only source of truth.

[Browse all model shutdown dates and official replacements](MODEL-LIFECYCLE.md), or consume the canonical [`data/lifecycle.json`](data/lifecycle.json).

The same official-source data also powers [105 crawlable model shutdown pages](https://synergia-yoshi.github.io/sunsetpr-action/models/) on GitHub Pages. The pages are generated and count-checked in public CI; they do not add tracking or a separate data source.

The maintainer workflow fetches only the three configured provider-owned pages each week. It verifies that every current ID, shutdown date, and replacement remains represented and compares semantic model/date fingerprints. Drift opens one refreshable GitHub issue; it never rewrites lifecycle data without an official-source review.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `path` | `.` | Repository directory to scan |
| `fail-on` | `never` | `never` annotates without failing; opt into `deprecated` or `retired` after the first scan |
| `report` | `.sunsetpr/report.json` | JSON report output path |

## Outputs

| Output | Meaning |
| --- | --- |
| `findings` | Deprecated or retired model references |
| `runtime-checks` | Dynamic values that static analysis could not resolve |
| `retired` | References to models already shut down |
| `deprecated` | References to models with an announced shutdown |
| `safe-auto-fixes` | Findings with both high-confidence code context and official replacement |
| `report` | Absolute path to the JSON report |

## Security and privacy

- The Action requests only `contents: read`.
- Analysis runs entirely inside your GitHub Actions runner.
- It makes no network request and sends no repository code to SunsetPR or an AI model.
- It never prints arbitrary file contents or environment-variable values.
- Symlinks and common generated, dependency, VCS, and virtual-environment directories are skipped.
- Individual files over 2 MiB are reported as limitations; the scan is bounded to 25,000 supported files and 100 MiB.
- Automatic merge and deployment are not part of this Action.

The checked-in bundle is built from the checked-in TypeScript source. See [DATA-HANDLING.md](DATA-HANDLING.md) and [SECURITY.md](SECURITY.md).

## Honest limits

Static analysis cannot prove the deployed value of an environment variable, a database lookup, a remote feature flag, or an arbitrary computed expression. These cases are surfaced as “runtime confirmation required.”

An official replacement can still differ in behavior, quality, latency, price, token limits, or supported parameters. The free Action does not edit code. Detection confidence is separate from replacement confidence; both must be high before the repair product considers a finding eligible for a deterministic edit. Preview or ambiguous successors are not considered safe automatic fixes.

The repository includes 230 labeled positive and 230 labeled negative synthetic cases and currently measures 100% recall and 0% false-positive rate. It is a reproducible regression suite, not a claim about all real repositories.

```bash
npm ci
npm run benchmark:check
npm run benchmark
```

`benchmark:check` also proves that the generated cases still cover every lifecycle-database row. The same commands run in the public Linux CI.

See [BENCHMARK.md](BENCHMARK.md) for the corpus construction, thresholds, exact current confusion matrix, and limits.

## Evidence-backed repair beta

The paid product is being validated separately. It proposes a draft pull request with conservative code changes, location-scoped migration invariants, official evidence, and customer-CI results. The invariants do not prove live model behavior. It never auto-merges. If CI fails or the successor is ambiguous, the result remains a draft or report.

[Request repair beta access](https://github.com/synergia-yoshi/sunsetpr-action/issues/new?template=repair-beta.yml)

Pricing is under design-partner validation and is not an active purchase offer.

## Supported runner

The `v0` release is packaged and tested for GitHub-hosted `ubuntu-latest` runners on x64. Other runner operating systems and architectures are not yet supported.

## Versioning

Pin `@v0` for compatible updates during the public beta, or pin the full immutable release `@v0.1.6` for a fixed review target. Release notes document lifecycle-data and scanner changes.

Apache-2.0. SunsetPR is independent of OpenAI, Anthropic, Google, and GitHub.
